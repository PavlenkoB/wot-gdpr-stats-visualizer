/**
 * overview-layout.ts — which tiles are drawn where (13-10, D-11, D-15).
 *
 * ## What this decides
 *
 * Given the view the worker built, the catalogue and the user's pins, this
 * module decides the GROUPS to draw: which tiles sit in Pinned, which sit in
 * their own group, which wait in a group's dashed absent row, and how wide each
 * tile is. The bento component (13-12) only binds the result to markup.
 *
 * ## The rules
 *
 * - Walk the catalogue in order. A READY tile that is pinned goes to Pinned;
 *   any other ready tile goes to its own group.
 * - An ABSENT tile ALWAYS goes to its own group's absent row, pinned or not
 *   (D-11): a pinned tile with no data waits in its group and never appears in
 *   Pinned. That is also why Logged in is never in Pinned when the export has
 *   no session history (UI-SPEC OI-3).
 * - Groups come out in `OVERVIEW_GROUP_ORDER`. A group with neither tiles nor
 *   absent entries is omitted, so Pinned is omitted when empty.
 * - Spans are computed per group by `fillSpans` over the sizes of the group's
 *   visible tiles (D-15). The caller recomputes only when its inputs change.
 * - The legend flag is true only for Time and Tanks, and only when the group
 *   holds a chart-bearing tile.
 *
 * ## Pinned and sparse flow
 *
 * The four catalogue groups use `grid-auto-flow: dense` and `fillSpans`
 * simulates it. Pinned uses sparse flow (`row`) so it always reads in catalogue
 * order (13-09, WINDOWS entry 27), and its feature widths are therefore chosen
 * by a SPARSE simulation (`fillSpans(sizes, 'sparse')`, 13-12): a dense-chosen
 * width left more holes under sparse placement for a fifth of the possible pin
 * sets (13,325 of 65,535 at four columns).
 *
 * The function is pure: it never mutates its inputs and returns fresh arrays.
 */

import { fillSpans } from './overview-grid.ts';
import type { GridFlow, TileSize } from './overview-grid.ts';
import { OVERVIEW_GROUP_ORDER } from './overview-definitions.ts';
import type { OverviewGroupKey, OverviewTileDef } from './overview-definitions.ts';
import type {
  OverviewGroupId,
  OverviewNeed,
  OverviewReadyTile,
  OverviewTileId,
  OverviewView,
} from './overview-shared.ts';

/** A tile to draw, with its definition. */
export interface LayoutTile {
  tile: OverviewReadyTile;
  def: OverviewTileDef;
}

/** One entry of a group's dashed absent row. */
export interface LayoutAbsent {
  id: OverviewTileId;
  need: OverviewNeed;
  /** The missing record column, or null for a whole-source absence. */
  column: string | null;
}

/** One group to draw. */
export interface LayoutGroup {
  id: OverviewGroupKey;
  /** The ready tiles, in catalogue order. */
  tiles: LayoutTile[];
  /** The extra spans per tile, one entry per tile in the same order. */
  spans: { c4: number; r4: number; c2: number }[];
  /** The tiles that wait here for their source, one entry per absent tile. */
  absent: LayoutAbsent[];
  /** Whether the group heading carries the chart legend. */
  legend: boolean;
}

/** The tiles that carry a chart, per group that has a legend. */
const CHART_TILES: Readonly<Partial<Record<OverviewGroupKey, readonly OverviewTileId[]>>> = {
  time: ['logged', 'hour'],
  tanks: ['tank', 'cls'],
};

/** The grid flow of a group: Pinned is sparse (reads in catalogue order), the rest dense. */
function flowOf(key: OverviewGroupKey): GridFlow {
  return key === 'pinned' ? 'sparse' : 'dense';
}

interface Bucket {
  tiles: LayoutTile[];
  absent: LayoutAbsent[];
}

/**
 * Decide the groups to draw.
 *
 * `defs` is the catalogue in catalogue order and `pins` the user's validated
 * pins. An id in `pins` that the catalogue does not know selects nothing, and a
 * definition the view has no tile for (a malformed view) is treated as absent.
 */
export function layoutGroups(
  view: OverviewView,
  defs: readonly OverviewTileDef[],
  pins: readonly OverviewTileId[],
): LayoutGroup[] {
  const byId = new Map(view.tiles.map((tile) => [tile.id, tile]));
  const pinned = new Set<OverviewTileId>(pins);

  const buckets = new Map<OverviewGroupKey, Bucket>();
  for (const key of OVERVIEW_GROUP_ORDER) buckets.set(key, { tiles: [], absent: [] });

  for (const def of defs) {
    const tile = byId.get(def.id);
    if (tile === undefined || tile.status === 'absent') {
      buckets.get(def.group)?.absent.push({
        id: def.id,
        need: tile?.need ?? def.need,
        column: tile?.column ?? null,
      });
      continue;
    }
    const key: OverviewGroupKey = pinned.has(def.id) ? 'pinned' : def.group;
    buckets.get(key)?.tiles.push({ tile, def });
  }

  const groups: LayoutGroup[] = [];
  for (const key of OVERVIEW_GROUP_ORDER) {
    const bucket = buckets.get(key);
    if (bucket === undefined) continue;
    if (bucket.tiles.length === 0 && bucket.absent.length === 0) continue;

    const filled = fillSpans(
      bucket.tiles.map((entry) => entry.def.size),
      flowOf(key),
    );
    const spans = bucket.tiles.map((_, index) => ({
      c4: filled.c4[index],
      r4: filled.r4[index],
      c2: filled.c2[index],
    }));

    const chartTiles = CHART_TILES[key];
    const legend =
      chartTiles !== undefined && bucket.tiles.some((entry) => chartTiles.includes(entry.tile.id));

    groups.push({ id: key, tiles: bucket.tiles, spans, absent: bucket.absent, legend });
  }
  return groups;
}

/** The tile ids in DOM order: Pinned first, then each group's tiles. */
export function domOrder(groups: readonly LayoutGroup[]): OverviewTileId[] {
  return groups.flatMap((group) => group.tiles.map((entry) => entry.tile.id));
}

/** Whether every tile is absent: the export has nothing the Overview can show. */
export function isEmptyScreen(view: OverviewView): boolean {
  return view.tiles.every((tile) => tile.status === 'absent');
}

/** One group of the loading and error frame: sizes and spans, no tiles. */
export interface SkeletonGroup {
  id: 'pinned' | OverviewGroupId;
  /** The size of each placeholder, in catalogue order. */
  sizes: TileSize[];
  /** The extra spans per placeholder, from the same fill rule as the real page. */
  spans: { c4: number; r4: number; c2: number }[];
}

/**
 * The real layout without a view: what the loading and error frames draw.
 *
 * Every tile is assumed to have data, so the frame has the shape of a full
 * page and nothing moves when the answer arrives for an export that has it all.
 * Pinned holds the pinned tiles' sizes in catalogue order and is omitted when
 * nothing is pinned; a group left with no tiles is omitted. Pure.
 */
export function skeletonGroups(
  defs: readonly OverviewTileDef[],
  pins: readonly OverviewTileId[],
): SkeletonGroup[] {
  const pinned = new Set<OverviewTileId>(pins);
  const sizes = new Map<OverviewGroupKey, TileSize[]>();
  for (const key of OVERVIEW_GROUP_ORDER) sizes.set(key, []);
  for (const def of defs) {
    sizes.get(pinned.has(def.id) ? 'pinned' : def.group)?.push(def.size);
  }

  const groups: SkeletonGroup[] = [];
  for (const key of OVERVIEW_GROUP_ORDER) {
    const own = sizes.get(key) ?? [];
    if (own.length === 0) continue;
    const filled = fillSpans(own, flowOf(key));
    groups.push({
      id: key,
      sizes: own,
      spans: own.map((_, index) => ({
        c4: filled.c4[index],
        r4: filled.r4[index],
        c2: filled.c2[index],
      })),
    });
  }
  return groups;
}
