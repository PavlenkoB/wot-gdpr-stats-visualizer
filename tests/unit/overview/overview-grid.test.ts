import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import {
  fillSpans,
  gridHoles,
  type FillSpans,
  type GridPlacement,
  type TileSize,
} from '../../../src/lib/features/overview/overview-grid.ts';
import {
  OVERVIEW_GROUP_IDS,
  OVERVIEW_TILE_IDS,
  type OverviewGroupId,
  type OverviewTileId,
} from '../../../src/lib/features/overview/overview-shared.ts';
import { OVERVIEW_TILE_DEFS } from '../../../src/lib/features/overview/overview-definitions.ts';

// =============================================================================
// The bento's FILL RULE (13-06 Task 2, D-15)
// =============================================================================
//
// The rule is a PORT of the sketch's `fillSpans` / `gridHoles`, which was
// verified against 309,247 cases. Port, do not redesign — so these tests
//
//   1. compare the port against the SKETCH ITSELF, sequence by sequence, so
//      "faithful port" is a proved fact and not a claim, and
//   2. pin the catalogue-level guarantee by ENUMERATION: across all 65,536
//      pin subsets, no hero or metric is ever widened and no group is left
//      with more holes than leaving it alone.
//
// The dense flow has one property the sketch's own item sets never showed,
// and the enumeration finds it: a dense placement can pull a NARROW tile up
// into a gap above an earlier one, which makes the visual order differ from
// the DOM order. The four catalogue groups never do it; the derived Pinned
// group can, because a pin subset can put a metric before a hero. The
// enumeration pins exactly that boundary — see "the Pinned group" below.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GRID_PATH = path.join(REPO_ROOT, 'src/lib/features/overview/overview-grid.ts');
const GRID_SOURCE = readFileSync(GRID_PATH, 'utf8');
const SKETCH_PATH = path.join(
  REPO_ROOT,
  '.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/sources/overview-final/_shared/model.js',
);
const SKETCH_SOURCE = readFileSync(SKETCH_PATH, 'utf8');

/** The base size of each tile size: `[columns, rows]`. */
const BASE: Readonly<Record<TileSize, readonly [number, number]>> = {
  hero: [2, 2],
  feat: [2, 1],
  met: [1, 1],
};

/** The dims a list of sizes lays out at, with no widening. */
function dimsOf(sizes: readonly TileSize[]): [number, number][] {
  return sizes.map((size) => [BASE[size][0], BASE[size][1]]);
}

/** The dims a list of sizes lays out at, once the extra spans are added. */
function dimsWith(sizes: readonly TileSize[], spans: readonly number[]): [number, number][] {
  return sizes.map((size, index) => [BASE[size][0] + spans[index], BASE[size][1]]);
}

/**
 * A cache of the placements the enumeration asks for.
 *
 * The enumeration asks the same question thousands of times — the same size
 * sequences come up again and again — and caching the ANSWER does not
 * weaken the claim: the same input still has to produce the same output.
 */
const placementCache = new Map<string, GridPlacement>();

function placementOf(dims: readonly (readonly [number, number])[], columns: number): GridPlacement {
  const key = `${columns}:${dims.map((dim) => `${dim[0]}x${dim[1]}`).join(',')}`;
  const cached = placementCache.get(key);
  if (cached !== undefined) return cached;
  const placement = gridHoles(dims, columns);
  placementCache.set(key, placement);
  return placement;
}

const spanCache = new Map<string, FillSpans>();

function spansOf(sizes: readonly TileSize[]): FillSpans {
  const key = sizes.join('');
  const cached = spanCache.get(key);
  if (cached !== undefined) return cached;
  const spans = fillSpans(sizes);
  spanCache.set(key, spans);
  return spans;
}

/**
 * The failures the enumeration finds.
 *
 * The enumeration visits millions of cases, and a per-case `expect` costs
 * more than the case itself. Collecting the failures and asserting ONCE
 * keeps the test honest (every violation is counted, and the first few are
 * named) without making the suite the slowest in the repository.
 */
class Violations {
  readonly first: string[] = [];
  count = 0;

  add(message: string): void {
    this.count += 1;
    if (this.first.length < 10) this.first.push(message);
  }
}

describe('the port against the sketch', () => {
  /**
   * The sketch's own functions, loaded from its source.
   *
   * The file is a browser script that ends with a CommonJS export, and the
   * repository is an ES module package, so the export line never runs there.
   * Running the source in a VM context with a `module` object gives the
   * sketch's UNMODIFIED functions to compare against.
   */
  const sketch = (() => {
    const sandbox: { module: { exports: unknown } } = { module: { exports: {} } };
    runInNewContext(SKETCH_SOURCE, sandbox);
    return sandbox.module.exports as {
      fillSpans: (tiles: readonly string[]) => { c4: number[]; r4: number[]; c2: number[] };
      gridHoles: (
        dims: readonly (readonly [number, number])[],
        columns: number,
      ) => { rows: number; holes: number; reorder: boolean };
    };
  })();

  /** Every size sequence up to `maxLen`, over hero, feat and met. */
  function* sequences(maxLen: number): Generator<TileSize[]> {
    const rec = function* (acc: TileSize[]): Generator<TileSize[]> {
      if (acc.length > 0) yield [...acc];
      if (acc.length === maxLen) return;
      for (const size of ['hero', 'feat', 'met'] as const) {
        acc.push(size);
        yield* rec(acc);
        acc.pop();
      }
    };
    yield* rec([]);
  }

  it('computes the same spans as the sketch for every sequence up to eight tiles', () => {
    let checked = 0;
    const violations = new Violations();
    for (const sizes of sequences(8)) {
      checked += 1;
      const expected = sketch.fillSpans(sizes);
      const actual = fillSpans(sizes);
      if (JSON.stringify(actual.c4) !== JSON.stringify(expected.c4)) {
        violations.add(`c4 for ${sizes.join(',')}: ${JSON.stringify(actual.c4)}`);
      }
      if (JSON.stringify(actual.r4) !== JSON.stringify(expected.r4)) {
        violations.add(`r4 for ${sizes.join(',')}: ${JSON.stringify(actual.r4)}`);
      }
      if (JSON.stringify(actual.c2) !== JSON.stringify(expected.c2)) {
        violations.add(`c2 for ${sizes.join(',')}: ${JSON.stringify(actual.c2)}`);
      }
    }
    expect(checked).toBe(9840);
    expect(violations.first).toEqual([]);
    expect(violations.count).toBe(0);
  });

  it('simulates the same placements as the sketch at every column count', () => {
    const violations = new Violations();
    for (const sizes of sequences(8)) {
      for (const columns of [1, 2, 3, 4, 5, 6]) {
        const dims = dimsOf(sizes);
        const mine = gridHoles(dims, columns);
        const theirs = sketch.gridHoles(dims, columns);
        if (
          mine.rows !== theirs.rows ||
          mine.holes !== theirs.holes ||
          mine.reorder !== theirs.reorder
        ) {
          violations.add(
            `placement of ${sizes.join(',')} at ${columns} columns: ` +
              `${JSON.stringify(mine)} vs ${JSON.stringify(theirs)}`,
          );
        }
      }
    }
    expect(violations.first).toEqual([]);
    expect(violations.count).toBe(0);
  });
});

describe('gridHoles', () => {
  it('fills two heroes side by side with no hole at four columns', () => {
    expect(
      gridHoles(
        [
          [2, 2],
          [2, 2],
        ],
        4,
      ),
    ).toEqual({ rows: 2, holes: 0, reorder: false });
  });

  it('leaves three holes for a single metric at four columns', () => {
    expect(gridHoles([[1, 1]], 4)).toEqual({ rows: 1, holes: 3, reorder: false });
  });

  it('never leaves a hole at one column, whatever the sizes', () => {
    const sizes: readonly TileSize[] = ['hero', 'feat', 'met', 'hero', 'met', 'feat'];
    for (let count = 1; count <= sizes.length; count += 1) {
      const slice = sizes.slice(0, count);
      expect(placementOf(dimsOf(slice), 1).holes, `${slice.join('')} at one column`).toBe(0);
    }
  });
});

describe("fillSpans — the sketch's documented cases", () => {
  it('leaves the two pinned heroes alone', () => {
    const spans = fillSpans(['hero', 'hero']);
    expect(spans.c4).toEqual([0, 0]);
    expect(spans.c2).toEqual([0, 0]);
    expect(spans.r4).toEqual([0, 0]);
  });

  it("widens the Time group's feature tile to four columns and leaves one hole", () => {
    const sizes: TileSize[] = ['feat', 'met', 'met', 'met'];
    const spans = fillSpans(sizes);
    expect(spans.c4).toEqual([2, 0, 0, 0]);

    const widened = placementOf(dimsWith(sizes, spans.c4), 4);
    expect(widened.holes).toBe(1);
    expect(widened.reorder).toBe(false);

    const plain = placementOf(dimsOf(sizes), 4);
    expect(plain.holes).toBe(3);
  });

  it('leaves the Tanks group without a hole', () => {
    const sizes: TileSize[] = ['feat', 'met', 'met'];
    const spans = fillSpans(sizes);
    expect(placementOf(dimsWith(sizes, spans.c4), 4).holes).toBe(0);
  });

  it('leaves the Records group without a hole', () => {
    const sizes: TileSize[] = ['met', 'met', 'met', 'met'];
    const spans = fillSpans(sizes);
    expect(placementOf(dimsWith(sizes, spans.c4), 4).holes).toBe(0);
  });

  it('leaves the Totals group without a hole', () => {
    const sizes: TileSize[] = ['feat', 'met', 'met'];
    const spans = fillSpans(sizes);
    expect(placementOf(dimsWith(sizes, spans.c4), 4).holes).toBe(0);
  });
});

describe('fillSpans — the exhaustive enumeration', () => {
  /** The catalogue's tiles of one group, in catalogue order. */
  function groupSizes(group: OverviewGroupId, pinned: ReadonlySet<OverviewTileId>): TileSize[] {
    const sizes: TileSize[] = [];
    for (const def of OVERVIEW_TILE_DEFS) {
      if (def.group !== group) continue;
      if (pinned.has(def.id)) continue;
      sizes.push(def.size);
    }
    return sizes;
  }

  it('never widens a hero or a metric, and never makes holes worse', () => {
    const total = OVERVIEW_TILE_IDS.length;
    const violations = new Violations();
    let visited = 0;

    for (let mask = 0; mask < 1 << total; mask += 1) {
      visited += 1;
      const pinned = new Set<OverviewTileId>();
      OVERVIEW_TILE_IDS.forEach((id, index) => {
        if ((mask & (1 << index)) !== 0) pinned.add(id);
      });

      const pinnedSizes: TileSize[] = [];
      for (const def of OVERVIEW_TILE_DEFS) {
        if (pinned.has(def.id)) pinnedSizes.push(def.size);
      }

      const lists: TileSize[][] = [pinnedSizes];
      for (const group of OVERVIEW_GROUP_IDS) lists.push(groupSizes(group, pinned));

      for (const sizes of lists) {
        if (sizes.length === 0) continue;
        const spans = spansOf(sizes);

        sizes.forEach((size, index) => {
          if (size === 'feat') return;
          if (spans.c4[index] !== 0) {
            violations.add(`a ${size} widened at four columns (${sizes.join(',')})`);
          }
          if (spans.c2[index] !== 0) {
            violations.add(`a ${size} widened at two columns (${sizes.join(',')})`);
          }
        });

        for (const columns of [4, 2] as const) {
          const extra = columns === 4 ? spans.c4 : spans.c2;
          const widenedDims = dimsWith(sizes, extra);
          const plainDims = dimsOf(sizes);
          const widened = placementOf(widenedDims, columns);
          const plain = placementOf(plainDims, columns);
          if (!plain.reorder) {
            // A layout that already reads in order: the rule may only make
            // it tidier, never worse and never out of order.
            if (widened.holes > plain.holes) {
              violations.add(
                `holes at ${columns} columns (${sizes.join(',')}): ${widened.holes} > ${plain.holes}`,
              );
            }
            if (widened.reorder) {
              violations.add(
                `the widening reordered a layout that already reads in order (${sizes.join(',')})`,
              );
            }
          } else {
            // A layout that does NOT read in order: the rule's first duty is
            // the reading order, so it accepts a hole to keep it — or, when
            // no combination keeps it, leaves the layout exactly as it was.
            if (
              widened.reorder !== false &&
              JSON.stringify(widenedDims) !== JSON.stringify(plainDims)
            ) {
              violations.add(`a reordered layout must be fixed or left alone (${sizes.join(',')})`);
            }
          }
        }
      }
    }

    expect(visited).toBe(65_536);
    expect(violations.first).toEqual([]);
    expect(violations.count).toBe(0);
  });

  it('never reorders any of the four catalogue groups', () => {
    // The dense flow can pull a NARROW tile up into a gap above an earlier
    // one. In the four catalogue groups it never does: every group either
    // starts with its hero or has no hero at all, so there is no gap for a
    // metric to jump into. This is the guarantee the page relies on.
    const total = OVERVIEW_TILE_IDS.length;
    const violations = new Violations();
    for (let mask = 0; mask < 1 << total; mask += 1) {
      const pinned = new Set<OverviewTileId>();
      OVERVIEW_TILE_IDS.forEach((id, index) => {
        if ((mask & (1 << index)) !== 0) pinned.add(id);
      });
      for (const group of OVERVIEW_GROUP_IDS) {
        const sizes = groupSizes(group, pinned);
        if (sizes.length === 0) continue;
        const spans = spansOf(sizes);
        for (const columns of [4, 2] as const) {
          const extra = columns === 4 ? spans.c4 : spans.c2;
          const plain = placementOf(dimsOf(sizes), columns);
          const widened = placementOf(dimsWith(sizes, extra), columns);
          if (plain.reorder) {
            violations.add(`the ${group} group reordered (${sizes.join(',')})`);
          }
          if (widened.reorder) {
            violations.add(`the ${group} group reordered once widened (${sizes.join(',')})`);
          }
          // The plan's guarantee, in the four groups that always read in
          // order: widening never leaves more holes than leaving the group
          // alone.
          if (widened.holes > plain.holes) {
            violations.add(
              `holes in the ${group} group at ${columns} columns: ${widened.holes} > ${plain.holes}`,
            );
          }
        }
      }
    }
    expect(violations.first).toEqual([]);
    expect(violations.count).toBe(0);
  });

  it('reorders the Pinned group only when a metric can jump up', () => {
    // The Pinned group is DERIVED: it holds whatever the reader pinned, in
    // catalogue order. A subset that puts a metric before a hero (Logged in
    // is the first catalogue entry, Most-played tank the sixth) can leave a
    // gap that the dense flow fills from above, and the visual order then
    // differs from the DOM order.
    //
    // This is a property of the dense ALGORITHM and of the CATALOGUE, not
    // of the port: the port computes exactly what the sketch computes (see
    // "the port against the sketch"), and the four catalogue groups never
    // do it. The default pins — Logged in and Most-played tank — are two
    // heroes and never reorder.
    const total = OVERVIEW_TILE_IDS.length;
    const violations = new Violations();
    let reordering = 0;

    for (let mask = 0; mask < 1 << total; mask += 1) {
      const pinned = new Set<OverviewTileId>();
      OVERVIEW_TILE_IDS.forEach((id, index) => {
        if ((mask & (1 << index)) !== 0) pinned.add(id);
      });
      const sizes: TileSize[] = [];
      for (const def of OVERVIEW_TILE_DEFS) {
        if (pinned.has(def.id)) sizes.push(def.size);
      }
      if (sizes.length === 0) continue;

      const reorders =
        placementOf(dimsOf(sizes), 4).reorder || placementOf(dimsOf(sizes), 2).reorder;
      if (!reorders) continue;
      reordering += 1;
      // Only a NARROW tile can be pulled up: a wide tile needs two adjacent
      // free cells and never finds them above the row it was placed in.
      if (!sizes.includes('met')) {
        violations.add(`a reorder without a metric to jump up (${sizes.join(',')})`);
      }
    }

    expect(reordering).toBeGreaterThan(0);
    expect(violations.first).toEqual([]);
    expect(violations.count).toBe(0);

    const defaults: TileSize[] = OVERVIEW_TILE_DEFS.filter(
      (def) => def.id === 'logged' || def.id === 'tank',
    ).map((def) => def.size);
    expect(defaults).toEqual(['hero', 'hero']);
    expect(placementOf(dimsOf(defaults), 4).reorder).toBe(false);
    expect(placementOf(dimsOf(defaults), 2).reorder).toBe(false);
  });
});

describe('sparse flow (the Pinned group, 13-12)', () => {
  const BASE_DIMS: Record<TileSize, [number, number]> = { hero: [2, 2], feat: [2, 1], met: [1, 1] };
  const dimsOf = (sizes: TileSize[], extra: number[]): [number, number][] =>
    sizes.map((size, i) => [BASE_DIMS[size][0] + extra[i], BASE_DIMS[size][1]]);

  it('never reports a reorder, even where dense flow would reorder', () => {
    // A metric after a hero: dense pulls it into the gap beside the hero's
    // second row only when something precedes it; sparse never goes back.
    const dims: [number, number][] = [
      [2, 2],
      [2, 1],
      [1, 1],
    ];
    expect(gridHoles(dims, 4, 'sparse').reorder).toBe(false);
  });

  it('leaves the default (dense) behaviour untouched', () => {
    const sizes: TileSize[] = ['feat', 'hero', 'met'];
    expect(fillSpans(sizes)).toEqual(fillSpans(sizes, 'dense'));
    const dims = dimsOf(sizes, [0, 0, 0]);
    expect(gridHoles(dims, 4)).toEqual(gridHoles(dims, 4, 'dense'));
  });

  it('places each item at or after the previous one (a hero then a feature leaves the hero row open)', () => {
    // hero (cols 0-1, rows 0-1), then feat (2 wide): sparse puts it at cols 2-3 row 0.
    expect(
      gridHoles(
        [
          [2, 2],
          [2, 1],
        ],
        4,
        'sparse',
      ),
    ).toEqual({ rows: 2, holes: 2, reorder: false });
  });

  it('across every pin subset, never leaves more sparse holes than not widening, and sometimes fewer', () => {
    let fewer = 0;
    for (let mask = 1; mask < 1 << OVERVIEW_TILE_DEFS.length; mask += 1) {
      const sizes = OVERVIEW_TILE_DEFS.filter((_, i) => (mask >> i) & 1).map((def) => def.size);
      const spans = fillSpans(sizes, 'sparse');
      for (const [columns, extra] of [
        [4, spans.c4],
        [2, spans.c2],
      ] as const) {
        const chosen = gridHoles(dimsOf(sizes, extra), columns, 'sparse').holes;
        const untouched = gridHoles(
          dimsOf(
            sizes,
            sizes.map(() => 0),
          ),
          columns,
          'sparse',
        ).holes;
        expect(chosen, `${sizes.join(',')} @${columns}`).toBeLessThanOrEqual(untouched);
        if (chosen < untouched) fewer += 1;
      }
      // Only feature tiles ever widen.
      sizes.forEach((size, i) => {
        if (size !== 'feat') {
          expect(spans.c4[i]).toBe(0);
          expect(spans.c2[i]).toBe(0);
        }
      });
    }
    expect(fewer).toBeGreaterThan(0);
  });

  it('leaves no more holes than the dense-chosen widths do, for every pin subset', () => {
    for (let mask = 1; mask < 1 << OVERVIEW_TILE_DEFS.length; mask += 1) {
      const sizes = OVERVIEW_TILE_DEFS.filter((_, i) => (mask >> i) & 1).map((def) => def.size);
      const sparse = fillSpans(sizes, 'sparse');
      const dense = fillSpans(sizes, 'dense');
      const mine = gridHoles(dimsOf(sizes, sparse.c4), 4, 'sparse').holes;
      const theirs = gridHoles(dimsOf(sizes, dense.c4), 4, 'sparse').holes;
      expect(mine, sizes.join(',')).toBeLessThanOrEqual(theirs);
    }
  });
});

describe('the grid module', () => {
  it('imports nothing but types', () => {
    const imports = GRID_SOURCE.split('\n').filter((line) => /^\s*import\b/.test(line));
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) {
      expect(line, `the grid module must import types only: ${line}`).toMatch(/^\s*import type\b/);
    }
  });
});
