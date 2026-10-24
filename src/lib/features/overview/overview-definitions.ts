/**
 * overview-definitions.ts — the Overview's TILE CATALOGUE (13-06, D-06, D-12, D-15).
 *
 * ## What this module is
 *
 * The catalogue: which tiles exist, how big each one is, which group it
 * belongs to, which pane its "Open <Section>" link opens, and which source it
 * reads. It is DATA, not behaviour — the only runtime logic here is the list
 * handling that keeps the catalogue honest (see `tileDefsOf`).
 *
 * ## THE ONE ORDER (the decision this module settles)
 *
 * There is exactly ONE tile order in this codebase, and it lives in
 * `overview-shared.ts` as `OVERVIEW_TILE_IDS`:
 *
 *     logged, hour, streak, sess, busy, tank, cls, fleet, nat,
 *     dmg, xp, kills, snip, cred, bat, ord
 *
 * It is the wire contract (the worker hands the page its tiles in that order),
 * it is the UI-SPEC "Tile Catalogue" table's order, and it is the order the
 * bento's reading order follows. This module does not declare a second one:
 * `OVERVIEW_TILE_DEFS` is the catalogue flattened and re-ordered by that one
 * tuple, and every other module (the grid, the pins store, the layout, the
 * bento) reads its order from here or from that tuple — never from a list of
 * its own.
 *
 * The plan 13-03 oracle's tile lists (`tests/helpers/overview-oracle.ts`)
 * group tiles by the SOURCE they read, so `bat` sits beside the record tiles
 * there rather than in its catalogue place after `cred`. Those are per-need
 * lists, not a catalogue order, and they are not read as one.
 *
 * ## Per-game lists (D-06)
 *
 * The tiles are declared as per-game definition LISTS. Today there are two: a
 * `shared` list holding Logged in (which spans every game, D-20) and a `WOT`
 * list holding the other fifteen (WoT-only for now). Another game adds its
 * own list here, and neither the grid nor the bento has to change to carry
 * it — that is the whole point of D-06.
 */

/**
 * The wire contract's tile ids, in CATALOGUE order.
 *
 * Read from `overview-shared.ts` rather than redeclared: this module is the
 * catalogue, and the catalogue cannot have its own order.
 */
import { OVERVIEW_TILE_IDS } from './overview-shared.ts';
import type { OverviewGroupId, OverviewNeed, OverviewTileId } from './overview-shared.ts';
// Type-only: the pane ids come from the shell's selection state, and a
// runtime import would put the shell's module into this leaf's bundle.
import type { PaneId } from '../../shell/selection-state.ts';

/**
 * How large a tile is.
 *
 * `hero` is 2x2 (four cells), `feat` is 2x1 (two cells) and `met` is 1x1 (one
 * cell) — D-15. Only feature tiles ever widen to fill leftover cells; heroes
 * and metrics never stretch.
 */
export type OverviewTileSize = 'hero' | 'feat' | 'met';

/**
 * The panes an Overview tile can open.
 *
 * The four existing detail panes, named here rather than as a wider union so
 * that a tile can only ever link to a pane that exists.
 */
export type OverviewPaneId = Extract<PaneId, 'playtime' | 'vehicles' | 'finance' | 'payments'>;

/**
 * One tile's definition.
 *
 * `need` always equals `OVERVIEW_TILE_NEEDS[id]`; it is carried here so a
 * reader of one definition never has to look up another table to learn what
 * the tile reads.
 */
export interface OverviewTileDef {
  /** The tile's id, from the closed catalogue tuple. */
  id: OverviewTileId;
  /** The group the tile belongs to (never `pinned` — that is derived). */
  group: OverviewGroupId;
  /** The tile's size in the bento. */
  size: OverviewTileSize;
  /** The pane the tile's "Open <Section>" link opens. */
  pane: OverviewPaneId;
  /** The source the tile reads. */
  need: OverviewNeed;
}

/**
 * ONE GAME's tiles.
 *
 * `list` names the game the definitions belong to, and is what makes a
 * second game's tiles additive rather than a rewrite of the first game's.
 */
export interface OverviewDefinitionList {
  /** The game's list name (`shared`, `WOT`, and later others). */
  list: string;
  /** The tiles this game contributes. */
  defs: readonly OverviewTileDef[];
}

/**
 * The tiles that span EVERY game (D-20).
 *
 * Logged in counts every game's sessions, so it is not a WoT tile: it is the
 * one definition that belongs to no single game.
 */
const SHARED_DEFS: readonly OverviewTileDef[] = [
  { id: 'logged', group: 'time', size: 'hero', pane: 'playtime', need: 'session-history' },
];

/**
 * The World of Tanks tiles.
 *
 * Every tile other than Logged in is WoT-only for now (D-06). Another game
 * adds a list of its own; it does not add to this one.
 */
const WOT_DEFS: readonly OverviewTileDef[] = [
  { id: 'hour', group: 'time', size: 'feat', pane: 'playtime', need: 'session-history' },
  { id: 'streak', group: 'time', size: 'met', pane: 'playtime', need: 'session-history' },
  { id: 'sess', group: 'time', size: 'met', pane: 'playtime', need: 'session-history' },
  { id: 'busy', group: 'time', size: 'met', pane: 'playtime', need: 'session-history' },
  { id: 'tank', group: 'tanks', size: 'hero', pane: 'vehicles', need: 'vehicle-statistics' },
  { id: 'cls', group: 'tanks', size: 'feat', pane: 'vehicles', need: 'vehicle-statistics' },
  { id: 'fleet', group: 'tanks', size: 'met', pane: 'vehicles', need: 'vehicle-statistics' },
  { id: 'nat', group: 'tanks', size: 'met', pane: 'vehicles', need: 'vehicle-statistics' },
  { id: 'dmg', group: 'records', size: 'met', pane: 'vehicles', need: 'account-statistics' },
  { id: 'xp', group: 'records', size: 'met', pane: 'vehicles', need: 'account-statistics' },
  { id: 'kills', group: 'records', size: 'met', pane: 'vehicles', need: 'account-statistics' },
  { id: 'snip', group: 'records', size: 'met', pane: 'vehicles', need: 'account-statistics' },
  { id: 'cred', group: 'totals', size: 'feat', pane: 'finance', need: 'currency-operations' },
  { id: 'bat', group: 'totals', size: 'met', pane: 'vehicles', need: 'account-statistics' },
  { id: 'ord', group: 'totals', size: 'met', pane: 'payments', need: 'payment-history' },
];

/**
 * The per-game definition lists, in the order they are read.
 *
 * The `shared` list comes first because Logged in is the Overview's primary
 * visual anchor, and the rest follow in catalogue order.
 */
export const OVERVIEW_DEFINITION_LISTS: readonly OverviewDefinitionList[] = [
  { list: 'shared', defs: SHARED_DEFS },
  { list: 'WOT', defs: WOT_DEFS },
];

/** Whether a value is one of the catalogue's tile ids. */
export function isTileId(value: unknown): value is OverviewTileId {
  return typeof value === 'string' && (OVERVIEW_TILE_IDS as readonly string[]).includes(value);
}

/**
 * Flatten definition lists into ONE catalogue-ordered array.
 *
 * Two rules make the flattening safe, and both throw rather than repair:
 *
 *   1. No id may be claimed twice. Two lists claiming the same tile is a
 *      contradiction, and silently letting the later one win would make the
 *      catalogue depend on list order.
 *   2. No id may be outside the catalogue. A second game's list names ids
 *      that are not in `OVERVIEW_TILE_IDS` yet, and adding them to the
 *      catalogue tuple is what makes them legal — the definition list cannot
 *      invent an id the wire contract does not carry.
 *
 * The result is ordered by `OVERVIEW_TILE_IDS`, so the order of the LISTS
 * never reaches the reader: only the catalogue's order does.
 */
export function tileDefsOf(lists: readonly OverviewDefinitionList[]): OverviewTileDef[] {
  const seen = new Set<OverviewTileId>();
  for (const list of lists) {
    for (const def of list.defs) {
      if (!isTileId(def.id)) {
        throw new Error(`unknown tile id in list "${list.list}": ${String(def.id)}`);
      }
      if (seen.has(def.id)) {
        throw new Error(`duplicate tile id: ${def.id}`);
      }
      seen.add(def.id);
    }
  }
  const byId = new Map<OverviewTileId, OverviewTileDef>();
  for (const list of lists) {
    for (const def of list.defs) byId.set(def.id, def);
  }
  const ordered: OverviewTileDef[] = [];
  for (const id of OVERVIEW_TILE_IDS) {
    const def = byId.get(id);
    if (def !== undefined) ordered.push(def);
  }
  return ordered;
}

/**
 * The whole catalogue, in catalogue order.
 *
 * Every module that needs "which tiles are there, and in what order" reads
 * this array. It is the ONE list.
 */
export const OVERVIEW_TILE_DEFS: readonly OverviewTileDef[] = tileDefsOf(OVERVIEW_DEFINITION_LISTS);

/**
 * The catalogue's tile ids, in catalogue order.
 *
 * The same order `OVERVIEW_TILE_IDS` carries, exposed from the catalogue so a
 * module that only needs the ORDER does not have to know where the wire
 * contract lives.
 */
export const OVERVIEW_CATALOGUE_ORDER: readonly OverviewTileId[] = OVERVIEW_TILE_DEFS.map(
  (def) => def.id,
);

/**
 * The one definition of a tile.
 *
 * The ids are a closed set, so a miss is a bug rather than a case to handle:
 * it throws instead of returning `undefined` and letting the caller invent a
 * fallback.
 */
export function tileDef(id: OverviewTileId): OverviewTileDef {
  const def = OVERVIEW_TILE_DEFS.find((candidate) => candidate.id === id);
  if (def === undefined) throw new Error(`unknown tile id: ${id}`);
  return def;
}

/**
 * The GROUPS of the bento, in reading order.
 *
 * `pinned` comes first and is DERIVED: a pinned tile keeps its own group
 * identity underneath, so `pinned` is never a definition's group (D-11).
 * The fifth group is `totals` (D-12).
 */
export const OVERVIEW_GROUP_ORDER = ['pinned', 'time', 'tanks', 'records', 'totals'] as const;

/** One group key of the bento, including the derived `pinned` group. */
export type OverviewGroupKey = (typeof OVERVIEW_GROUP_ORDER)[number];
