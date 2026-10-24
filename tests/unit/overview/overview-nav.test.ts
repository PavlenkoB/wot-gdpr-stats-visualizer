import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isNavKey,
  nextTileIndex,
  rovingIndex,
  type NavKey,
  type TileRect,
} from '../../../src/lib/features/overview/overview-nav.ts';

// =============================================================================
// The bento's KEYBOARD TARGETS (13-10 Task 1, D-16)
// =============================================================================
//
// The component can only hand in bounding rectangles; which tile an arrow key
// lands on is decided here, from numbers. The layouts below are built on a
// grid of 100px cells with a 16px gap, the same shape the bento draws.
// =============================================================================

const CELL = 100;
const GAP = 16;

/** A tile at grid cell (col,row), `w` cells wide and `h` cells tall, offset down by `dy`. */
function tile(col: number, row: number, w = 1, h = 1, dy = 0): TileRect {
  const left = col * (CELL + GAP);
  const top = row * (CELL + GAP) + dy;
  return {
    left,
    top,
    right: left + w * CELL + (w - 1) * GAP,
    bottom: top + h * CELL + (h - 1) * GAP,
  };
}

/**
 * Four columns: two heroes (2x2 each), a feature 4 wide, four metrics.
 *
 *   0 1 2 3
 *   H H H H   index 0 (cols 0-1), index 1 (cols 2-3), rows 0-1
 *   H H H H
 *   F F F F   index 2, row 2
 *   m m m m   indexes 3..6, row 3
 */
const FOUR_COLUMN: TileRect[] = [
  tile(0, 0, 2, 2),
  tile(2, 0, 2, 2),
  tile(0, 2, 4, 1),
  tile(0, 3),
  tile(1, 3),
  tile(2, 3),
  tile(3, 3),
];

/** Two columns: a hero, then two metrics, then a feature. */
const TWO_COLUMN: TileRect[] = [tile(0, 0, 2, 2), tile(0, 2), tile(1, 2), tile(0, 3, 2, 1)];

/** One column: a plain list. */
const ONE_COLUMN: TileRect[] = [tile(0, 0), tile(0, 1), tile(0, 2), tile(0, 3)];

describe('nextTileIndex: left, right, home, end', () => {
  it('ArrowRight and ArrowLeft step one tile in DOM order', () => {
    expect(nextTileIndex('ArrowRight', 0, FOUR_COLUMN)).toBe(1);
    expect(nextTileIndex('ArrowRight', 2, FOUR_COLUMN)).toBe(3);
    expect(nextTileIndex('ArrowLeft', 3, FOUR_COLUMN)).toBe(2);
    expect(nextTileIndex('ArrowLeft', 1, FOUR_COLUMN)).toBe(0);
  });

  it('does not wrap at either end', () => {
    expect(nextTileIndex('ArrowLeft', 0, FOUR_COLUMN)).toBeNull();
    expect(nextTileIndex('ArrowRight', FOUR_COLUMN.length - 1, FOUR_COLUMN)).toBeNull();
  });

  it('Home and End go to the first and last tile', () => {
    expect(nextTileIndex('Home', 4, FOUR_COLUMN)).toBe(0);
    expect(nextTileIndex('End', 4, FOUR_COLUMN)).toBe(FOUR_COLUMN.length - 1);
    expect(nextTileIndex('Home', 0, FOUR_COLUMN)).toBe(0);
    expect(nextTileIndex('End', FOUR_COLUMN.length - 1, FOUR_COLUMN)).toBe(FOUR_COLUMN.length - 1);
  });
});

describe('nextTileIndex: up and down by rectangle', () => {
  it('ArrowDown from either hero reaches the feature below both of them', () => {
    expect(nextTileIndex('ArrowDown', 0, FOUR_COLUMN)).toBe(2);
    expect(nextTileIndex('ArrowDown', 1, FOUR_COLUMN)).toBe(2);
  });

  it('ArrowDown from the feature picks the metric with the largest overlap, earliest first', () => {
    // All four metrics sit the same distance below and overlap the feature by
    // one cell each: an exact tie goes to the earlier tile in DOM order.
    expect(nextTileIndex('ArrowDown', 2, FOUR_COLUMN)).toBe(3);
  });

  it('ArrowDown from a metric with nothing below returns null', () => {
    expect(nextTileIndex('ArrowDown', 3, FOUR_COLUMN)).toBeNull();
    expect(nextTileIndex('ArrowDown', 6, FOUR_COLUMN)).toBeNull();
  });

  it('ArrowUp from a metric under a hero reaches the feature, and from the feature a hero', () => {
    expect(nextTileIndex('ArrowUp', 3, FOUR_COLUMN)).toBe(2);
    expect(nextTileIndex('ArrowUp', 6, FOUR_COLUMN)).toBe(2);
    // The feature overlaps both heroes by two cells: the earlier hero wins.
    expect(nextTileIndex('ArrowUp', 2, FOUR_COLUMN)).toBe(0);
  });

  it('ArrowUp from the first row returns null', () => {
    expect(nextTileIndex('ArrowUp', 0, FOUR_COLUMN)).toBeNull();
    expect(nextTileIndex('ArrowUp', 1, FOUR_COLUMN)).toBeNull();
  });

  it('still finds the next row across a 24px gap between groups', () => {
    const grouped: TileRect[] = [tile(0, 0, 2, 1), tile(0, 1, 1, 1, 24), tile(1, 1, 1, 1, 24)];
    expect(nextTileIndex('ArrowDown', 0, grouped)).toBe(1);
    expect(nextTileIndex('ArrowUp', 2, grouped)).toBe(0);
  });

  it('breaks a tie in overlap by taking the earlier tile in DOM order', () => {
    // A two-cell tile above two one-cell tiles that each overlap it by 100px.
    const rects: TileRect[] = [tile(1, 0, 2, 1), tile(1, 1), tile(2, 1)];
    expect(nextTileIndex('ArrowDown', 0, rects)).toBe(1);
  });

  it('prefers the larger overlap when the distance is equal', () => {
    const rects: TileRect[] = [
      tile(0, 0, 2, 1),
      // Overlaps cell 1 only: 100px.
      { left: 116, top: 116, right: 216, bottom: 216 },
      // Overlaps both cells: 216px, listed later but wider.
      { left: 0, top: 116, right: 216, bottom: 216 },
    ];
    expect(nextTileIndex('ArrowDown', 0, rects)).toBe(2);
  });

  it('prefers the nearer row when two candidates differ in distance', () => {
    // The far candidate is listed first; the nearer one still wins.
    const rects: TileRect[] = [tile(0, 0), tile(0, 3), tile(0, 1)];
    expect(nextTileIndex('ArrowDown', 0, rects)).toBe(2);
    const above: TileRect[] = [tile(0, 3), tile(0, 0), tile(0, 2)];
    expect(nextTileIndex('ArrowUp', 0, above)).toBe(2);
  });

  it('ignores a candidate that overlaps horizontally by exactly one pixel', () => {
    const rects: TileRect[] = [
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 99, top: 116, right: 199, bottom: 216 },
    ];
    expect(nextTileIndex('ArrowDown', 0, rects)).toBeNull();
    // Two pixels is a real overlap.
    const two: TileRect[] = [rects[0], { left: 98, top: 116, right: 198, bottom: 216 }];
    expect(nextTileIndex('ArrowDown', 0, two)).toBe(1);
  });

  it('ignores a candidate that lies behind the current tile', () => {
    const rects: TileRect[] = [tile(0, 2), tile(0, 0)];
    expect(nextTileIndex('ArrowDown', 0, rects)).toBeNull();
    expect(nextTileIndex('ArrowUp', 0, rects)).toBe(1);
  });

  it('works in a two-column layout', () => {
    expect(nextTileIndex('ArrowDown', 0, TWO_COLUMN)).toBe(1);
    expect(nextTileIndex('ArrowDown', 1, TWO_COLUMN)).toBe(3);
    expect(nextTileIndex('ArrowDown', 2, TWO_COLUMN)).toBe(3);
    expect(nextTileIndex('ArrowUp', 3, TWO_COLUMN)).toBe(1);
    expect(nextTileIndex('ArrowUp', 2, TWO_COLUMN)).toBe(0);
  });

  it('behaves like one step in a one-column layout', () => {
    for (let i = 0; i < ONE_COLUMN.length; i += 1) {
      expect(nextTileIndex('ArrowDown', i, ONE_COLUMN)).toBe(
        i + 1 < ONE_COLUMN.length ? i + 1 : null,
      );
      expect(nextTileIndex('ArrowUp', i, ONE_COLUMN)).toBe(i > 0 ? i - 1 : null);
    }
  });
});

describe('nextTileIndex: degenerate input', () => {
  const keys: NavKey[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

  it('returns null for an empty list', () => {
    for (const key of keys) expect(nextTileIndex(key, 0, [])).toBeNull();
  });

  it('returns null for an out-of-range current', () => {
    for (const key of keys) {
      expect(nextTileIndex(key, -1, FOUR_COLUMN)).toBeNull();
      expect(nextTileIndex(key, FOUR_COLUMN.length, FOUR_COLUMN)).toBeNull();
      expect(nextTileIndex(key, 1.5, FOUR_COLUMN)).toBeNull();
    }
  });

  it('a lone tile has nowhere to go but itself for Home and End', () => {
    const lone = [tile(0, 0)];
    expect(nextTileIndex('ArrowLeft', 0, lone)).toBeNull();
    expect(nextTileIndex('ArrowRight', 0, lone)).toBeNull();
    expect(nextTileIndex('ArrowUp', 0, lone)).toBeNull();
    expect(nextTileIndex('ArrowDown', 0, lone)).toBeNull();
    expect(nextTileIndex('Home', 0, lone)).toBe(0);
    expect(nextTileIndex('End', 0, lone)).toBe(0);
  });
});

describe('rovingIndex', () => {
  const ids = ['logged', 'tank', 'hour'];

  it('is the index of the last focused tile', () => {
    expect(rovingIndex(ids, 'hour')).toBe(2);
    expect(rovingIndex(ids, 'logged')).toBe(0);
  });

  it('is the first tile when nothing has been focused', () => {
    expect(rovingIndex(ids, null)).toBe(0);
  });

  it('is the first tile when the focused one is no longer present', () => {
    expect(rovingIndex(ids, 'nat')).toBe(0);
  });

  it('is -1 for an empty list', () => {
    expect(rovingIndex([], null)).toBe(-1);
    expect(rovingIndex([], 'hour')).toBe(-1);
  });
});

describe('isNavKey', () => {
  it('accepts the six navigation keys', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      expect(isNavKey(key)).toBe(true);
    }
  });

  it('rejects every other key', () => {
    for (const key of ['Enter', ' ', 'Escape', 'p', 'P', 'Tab', 'PageDown', 'arrowdown', '']) {
      expect(isNavKey(key)).toBe(false);
    }
  });
});

describe('the module is dependency-free', () => {
  it('imports nothing', () => {
    const file = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../src/lib/features/overview/overview-nav.ts',
    );
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/from\s+['"]svelte/);
  });
});
