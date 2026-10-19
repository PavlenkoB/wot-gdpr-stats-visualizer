import { describe, expect, it } from 'vitest';
import {
  PLAIN_TABLE_MAX_ROWS,
  cardSummary,
  firstRowPerAccount,
  orderRowsByAccount,
  shouldWindow,
  viewSummary,
} from '../../../src/lib/features/new-data/new-data-state.ts';
import type { NewDataCardView } from '../../../src/lib/features/new-data/new-data-shared.ts';
import type { AccountTagModel } from '../../../src/lib/shell/identity-model.ts';

// =============================================================================
// Plan 11-07 Task 3 — the pure pane helpers
// =============================================================================

function tagsOf(...roots: string[]): ReadonlyMap<string, AccountTagModel> {
  return new Map(
    roots.map((root, i) => [root, { root, letter: String.fromCharCode(65 + i), nickname: null }]),
  );
}

const row = (account: string, n: number) => ({ account, cells: [n] });

describe('orderRowsByAccount', () => {
  it('is a stable sort by the position of the account in the tag map', () => {
    const rows = [row('B', 1), row('A', 2), row('B', 3), row('A', 4)];
    const ordered = orderRowsByAccount(rows, tagsOf('A', 'B'));
    expect(ordered.map((r) => r.cells[0])).toEqual([2, 4, 1, 3]);
  });

  it('puts an account that is not in the map last, keeping relative order', () => {
    const rows = [row('Z', 1), row('B', 2), row('Y', 3), row('A', 4)];
    const ordered = orderRowsByAccount(rows, tagsOf('A', 'B'));
    expect(ordered.map((r) => r.cells[0])).toEqual([4, 2, 1, 3]);
  });

  it('returns the input unchanged with no tags', () => {
    const rows = [row('B', 1), row('A', 2)];
    expect(orderRowsByAccount(rows, null)).toBe(rows);
  });

  it('treats a root named __proto__ as an ordinary account', () => {
    const rows = [row('A', 1), row('__proto__', 2), row('constructor', 3)];
    const ordered = orderRowsByAccount(rows, tagsOf('constructor', '__proto__', 'A'));
    expect(ordered.map((r) => r.cells[0])).toEqual([3, 2, 1]);
  });

  it('orders ten thousand rows quickly', () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => row(i % 2 === 0 ? 'B' : 'A', i));
    const start = performance.now();
    const ordered = orderRowsByAccount(rows, tagsOf('A', 'B'));
    expect(performance.now() - start).toBeLessThan(500);
    expect(ordered).toHaveLength(10_000);
    expect(ordered[0]!.account).toBe('A');
    expect(ordered[9_999]!.account).toBe('B');
  });
});

describe('shouldWindow', () => {
  it('switches at 500 rows', () => {
    expect(PLAIN_TABLE_MAX_ROWS).toBe(500);
    expect(shouldWindow(0)).toBe(false);
    expect(shouldWindow(500)).toBe(false);
    expect(shouldWindow(501)).toBe(true);
  });
});

describe('firstRowPerAccount', () => {
  it('keeps the first row of each account in order of first appearance', () => {
    const rows = [row('B', 1), row('A', 2), row('B', 3), row('A', 4), row('__proto__', 5)];
    expect(firstRowPerAccount(rows).map((r) => r.cells[0])).toEqual([1, 2, 5]);
  });
});

describe('cardSummary and viewSummary', () => {
  const readyCard = (rowCount: number): NewDataCardView => ({
    status: 'ready',
    columns: [],
    rows: [],
    rowCount,
  });

  it('cardSummary reports the status and zero rows unless ready', () => {
    expect(cardSummary({ status: 'skipped' })).toEqual({ status: 'skipped', rows: 0 });
    expect(cardSummary({ status: 'no-rows' })).toEqual({ status: 'no-rows', rows: 0 });
    expect(cardSummary({ status: 'not-in-export' })).toEqual({ status: 'not-in-export', rows: 0 });
    expect(cardSummary(readyCard(7))).toEqual({ status: 'ready', rows: 7 });
  });

  it('viewSummary counts cards by status and sums ready rows', () => {
    expect(
      viewSummary({
        cards: {
          a: readyCard(3),
          b: readyCard(4),
          c: { status: 'skipped' },
          d: { status: 'no-rows' },
          e: { status: 'not-in-export' },
        },
      }),
    ).toEqual({ ready: 2, noRows: 1, skipped: 1, notInExport: 1, rows: 7 });
  });
});

describe('orderRowsByAccount over any element with an account (plan 11-10)', () => {
  it('orders the Warplanes account blocks by the same rules, whatever else they carry', () => {
    const blocks = [
      { account: 'B', cells: ['b'] },
      { account: 'Z', cells: ['z'] },
      { account: 'A', cells: ['a'] },
    ];
    expect(orderRowsByAccount(blocks, tagsOf('A', 'B')).map((b) => b.cells[0])).toEqual([
      'a',
      'b',
      'z',
    ]);
    expect(orderRowsByAccount(blocks, null)).toBe(blocks);
  });
});
