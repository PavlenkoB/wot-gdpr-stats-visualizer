/**
 * overview-grid.ts — the bento's FILL RULE (13-06, D-15).
 *
 * ## What this is
 *
 * A faithful port of the sketch's `fillSpans` / `gridHoles`
 * (`.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/sources/overview-final/_shared/model.js`),
 * which was verified against 309,247 cases. PORT, do not redesign: the
 * algorithm here is the sketch's algorithm, branch for branch, with the
 * DOM-less JavaScript idioms replaced by typed ones.
 *
 * ## The rule, in words
 *
 * Only FEATURE tiles ever widen. Heroes stay 2x2 and metrics stay 1x1, so a
 * single metric never stretches across a row. Among the feature widths 2..C
 * the rule picks the combination with the fewest empty cells, then the least
 * widening. Holes that no feature can fill (three lone metrics in four
 * columns) are accepted. The one-column layout never has holes.
 *
 * A combination is REJECTED when the dense placement would put a tile
 * before an earlier one: the visual order has to stay the DOM order, or the
 * reading order of the bento would differ from the catalogue.
 *
 * ## Why the result is not a style attribute
 *
 * `fillSpans` returns the EXTRA column span per tile, and plan 13-09 writes
 * those to the page through the CSSOM as `--span4`, `--rows4` and `--span2`.
 * A `style` attribute is never used: the page's CSP forbids inline styles.
 */

import type { OverviewTileSize } from './overview-definitions.ts';

/**
 * A tile's size, as the fill rule reads it.
 *
 * The same vocabulary the catalogue uses: `hero` (2x2), `feat` (2x1) and
 * `met` (1x1).
 */
export type TileSize = OverviewTileSize;

/**
 * The outcome of a dense-placement simulation.
 *
 * `rows` is how many rows the tiles occupy, `holes` counts the empty cells
 * inside those rows, and `reorder` says whether the dense placement put any
 * tile BEFORE an earlier one — which would make the visual order differ from
 * the DOM order.
 */
export interface GridPlacement {
  rows: number;
  holes: number;
  reorder: boolean;
}

/**
 * How the grid places its items.
 *
 * `dense` is `grid-auto-flow: dense` (the four catalogue groups). `sparse` is
 * the default `row` flow (the Pinned group): every item is placed at or after
 * the previous item's position and the cursor never goes back, so nothing is
 * reordered and `reorder` is always false (13-12).
 */
export type GridFlow = 'dense' | 'sparse';

/** The EXTRA column span per tile, for the four-column and two-column layouts. */
export interface FillSpans {
  /** Extra columns per tile at four columns. */
  c4: number[];
  /** Extra rows per tile at four columns. Always zero: nothing ever grows down. */
  r4: number[];
  /** Extra columns per tile at two columns. */
  c2: number[];
}

/**
 * Simulates CSS `grid-auto-flow: dense` for `columns` columns.
 *
 * For each `[colSpan, rowSpan]` in order it takes the FIRST free slot
 * (row-major) where the width fits, marks the cells, and records that the
 * dense placement reordered when the placed slot index is earlier than the
 * previous tile's slot.
 *
 * The width is capped at the column count, exactly as the browser caps a
 * grid item that is wider than its track.
 */
export function gridHoles(
  dims: readonly (readonly [number, number])[],
  columns: number,
  flow: GridFlow = 'dense',
): GridPlacement {
  const occ: (boolean[] | undefined)[] = [];
  let rows = 0;
  let last = -1;
  let reorder = false;

  const free = (r: number, c: number, w: number, h: number): boolean => {
    for (let y = r; y < r + h; y += 1) {
      const row = occ[y];
      if (!row) continue;
      for (let x = c; x < c + w; x += 1) if (row[x]) return false;
    }
    return true;
  };

  for (const [w0, h] of dims) {
    const w = Math.min(w0, columns);
    let done = false;
    // Sparse flow never looks behind the previous item; dense looks everywhere.
    for (let r = flow === 'sparse' ? Math.max(0, Math.floor(last / columns)) : 0; !done; r += 1) {
      for (let c = 0; c + w <= columns && !done; c += 1) {
        if (flow === 'sparse' && r * columns + c < last) continue;
        if (!free(r, c, w, h)) continue;
        for (let y = r; y < r + h; y += 1) {
          const row = occ[y] ?? [];
          occ[y] = row;
          for (let x = c; x < c + w; x += 1) row[x] = true;
        }
        // Dense placement put this tile BEFORE an earlier one: the visual
        // order would differ from the DOM order.
        if (r * columns + c < last) reorder = true;
        last = r * columns + c;
        rows = Math.max(rows, r + h);
        done = true;
      }
    }
  }

  let holes = 0;
  for (let y = 0; y < rows; y += 1) {
    const row = occ[y];
    for (let x = 0; x < columns; x += 1) if (!row || !row[x]) holes += 1;
  }
  return { rows, holes, reorder };
}

/** The base size of each tile size: `[columns, rows]`. */
const BASE: Readonly<Record<TileSize, readonly [number, number]>> = {
  hero: [2, 2],
  feat: [2, 1],
  met: [1, 1],
};

/**
 * The extra column span each tile takes in the four-column and two-column
 * layouts.
 *
 * `sizes` are the sizes of ONE group's ordered visible tiles. The result is
 * the extra columns each tile takes: `0` means the tile keeps its base
 * width.
 *
 * The solve is the sketch's, branch for branch:
 *
 *   1. The baseline is every tile at its base size. A baseline that REORDERS
 *      scores infinitely many holes, so it can never win.
 *   2. Every feature tile is tried at every width from 2 to the column
 *      count; heroes and metrics are never widened.
 *   3. A combination whose dense placement reorders is rejected outright.
 *   4. The combination with the fewest holes wins; a tie is won by the
 *      least total widening.
 *
 * `r4` is always zero: nothing ever grows down.
 */
export function fillSpans(sizes: readonly TileSize[], flow: GridFlow = 'dense'): FillSpans {
  const out: FillSpans = {
    c4: sizes.map(() => 0),
    r4: sizes.map(() => 0),
    c2: sizes.map(() => 0),
  };

  const solve = (columns: number, key: 'c4' | 'c2'): void => {
    const base: [number, number][] = sizes.map((size): [number, number] => [
      BASE[size][0],
      BASE[size][1],
    ]);
    const feats: number[] = [];
    sizes.forEach((size, index) => {
      if (size === 'feat') feats.push(index);
    });

    const g0 = gridHoles(base, columns, flow);
    let best: { holes: number; extra: number; mods: [number, number][] } = {
      holes: g0.reorder ? Infinity : g0.holes,
      extra: 0,
      mods: [],
    };

    const rec = (k: number, mods: [number, number][], extra: number): void => {
      if (k === feats.length) {
        const dims = base.map((pair) => [pair[0], pair[1]] as [number, number]);
        for (const [index, e] of mods) dims[index][0] += e;
        const g = gridHoles(dims, columns, flow);
        if (g.reorder) return;
        const h = g.holes;
        if (h < best.holes || (h === best.holes && extra < best.extra)) {
          best = { holes: h, extra, mods: mods.slice() };
        }
        return;
      }
      for (let e = 0; BASE.feat[0] + e <= columns; e += 1) {
        rec(k + 1, e ? mods.concat([[feats[k], e]]) : mods, extra + e);
      }
    };

    rec(0, [], 0);

    for (const [index, e] of best.mods) out[key][index] = e;
  };

  solve(4, 'c4');
  solve(2, 'c2');
  return out;
}
