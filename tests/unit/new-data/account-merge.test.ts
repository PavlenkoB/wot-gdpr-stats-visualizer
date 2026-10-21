import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  flattenGroups,
  mergeIdenticalAcrossAccounts,
  type MergedRow,
} from '../../../src/lib/features/new-data/account-merge.ts';
import type { AccountRowGroup, CsvRow } from '../../../src/lib/worker/csv-columns.ts';

// =============================================================================
// Plan 12-05 Task 1 - the read-time cross-account merge (D-10, D-11, D-12)
// =============================================================================
//
// Every literal here is hand-typed. Nothing is computed by the code under test,
// so a wrong rule cannot make its own test pass.

type Row = Record<string, string | undefined>;

function group(account: string, rows: readonly Row[]): AccountRowGroup<CsvRow> {
  return { account, rows };
}

const COLUMNS = ['NAME', 'SERVICE'] as const;

describe('mergeIdenticalAcrossAccounts', () => {
  it('collapses one identical row held by two accounts and counts the removal', () => {
    const result = mergeIdenticalAcrossAccounts(
      [
        group('A1', [{ NAME: 'Old Nick', SERVICE: 'wargaming.net' }]),
        group('A2', [{ NAME: 'Old Nick', SERVICE: 'wargaming.net' }]),
      ],
      COLUMNS,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].accounts).toEqual(['A1', 'A2']);
    expect(result.rows[0].row).toEqual({ NAME: 'Old Nick', SERVICE: 'wargaming.net' });
    expect(result.mergedAway).toBe(1);
  });

  it('keeps two rows apart when they differ in ONE listed column', () => {
    const result = mergeIdenticalAcrossAccounts(
      [
        group('A1', [{ NAME: 'Old Nick', SERVICE: 'wargaming.net' }]),
        group('A2', [{ NAME: 'Old Nick', SERVICE: 'other.example' }]),
      ],
      COLUMNS,
    );

    expect(result.rows.map((row) => row.accounts)).toEqual([['A1'], ['A2']]);
    expect(result.mergedAway).toBe(0);
  });

  it('never merges a second identical row inside the SAME account with the first', () => {
    // Account A holds the row twice; account B holds it once. The first
    // occurrence merges with B's; the second stays A's own (D-10 is about rows
    // identical ACROSS accounts, and a repeat inside one account is a real
    // repeated event).
    const row = { NAME: 'Old Nick', SERVICE: 'wargaming.net' };
    const result = mergeIdenticalAcrossAccounts(
      [group('A1', [row, row]), group('A2', [row])],
      COLUMNS,
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((merged) => merged.accounts)).toEqual([['A1', 'A2'], ['A1']]);
    expect(result.mergedAway).toBe(1);
  });

  it('treats an absent value, an undefined value and an empty string as three different things', () => {
    const absent = mergeIdenticalAcrossAccounts(
      [group('A1', [{ NAME: 'Old Nick' }]), group('A2', [{ SERVICE: 'wargaming.net' }])],
      COLUMNS,
    );
    expect(absent.rows).toHaveLength(2);

    // undefined and absent are the same value.
    const undef = mergeIdenticalAcrossAccounts(
      [
        group('A1', [{ NAME: 'Old Nick', SERVICE: undefined }]),
        group('A2', [{ NAME: 'Old Nick' }]),
      ],
      COLUMNS,
    );
    expect(undef.rows).toHaveLength(1);
    expect(undef.mergedAway).toBe(1);

    // An empty string is a VALUE and is not absence.
    const empty = mergeIdenticalAcrossAccounts(
      [group('A1', [{ NAME: 'Old Nick', SERVICE: '' }]), group('A2', [{ NAME: 'Old Nick' }])],
      COLUMNS,
    );
    expect(empty.rows).toHaveLength(2);
    expect(empty.mergedAway).toBe(0);
  });

  it('ignores a key the caller did not list and keeps the first occurrence own row', () => {
    const result = mergeIdenticalAcrossAccounts(
      [
        group('A1', [{ NAME: 'Old Nick', SERVICE: 'wargaming.net', LEGACY_RAW: 'one' }]),
        group('A2', [{ NAME: 'Old Nick', SERVICE: 'wargaming.net', LEGACY_RAW: 'two' }]),
      ],
      COLUMNS,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].row).toEqual({
      NAME: 'Old Nick',
      SERVICE: 'wargaming.net',
      LEGACY_RAW: 'one',
    });
    expect(result.mergedAway).toBe(1);
  });

  it('cannot be fooled by two different tuples whose joined text would collide', () => {
    // A plain separator join would read ["a", "b c"] and ["a b", "c"] as the same
    // key; the JSON encoding cannot.
    const result = mergeIdenticalAcrossAccounts(
      [group('A1', [{ NAME: 'a', SERVICE: 'b c' }]), group('A2', [{ NAME: 'a b', SERVICE: 'c' }])],
      COLUMNS,
    );

    expect(result.rows).toHaveLength(2);
    expect(result.mergedAway).toBe(0);
  });

  it('treats an account root named __proto__ as an ordinary key (T-09-27)', () => {
    const row = { NAME: 'Old Nick', SERVICE: 'wargaming.net' };
    const result = mergeIdenticalAcrossAccounts(
      [group('__proto__', [row]), group('A1', [row])],
      COLUMNS,
    );

    // An object-keyed grouping would LOSE this row: writing the key `__proto__`
    // on a plain object sets its prototype instead of storing an entry, so the
    // `__proto__` account's row would silently vanish.
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].accounts).toEqual(['__proto__', 'A1']);
    expect(result.mergedAway).toBe(1);
  });

  it('returns rows in first-seen order with every contributing account, in order', () => {
    const first = { NAME: 'First', SERVICE: 'wargaming.net' };
    const second = { NAME: 'Second', SERVICE: 'wargaming.net' };
    const result = mergeIdenticalAcrossAccounts(
      [group('A1', [first, second]), group('A2', [first]), group('A3', [first])],
      COLUMNS,
    );

    expect(result.rows.map((merged: MergedRow) => merged.row.NAME)).toEqual(['First', 'Second']);
    expect(result.rows[0].accounts).toEqual(['A1', 'A2', 'A3']);
    expect(result.rows[1].accounts).toEqual(['A1']);
    expect(result.mergedAway).toBe(2);
  });

  it('never lists the same account twice on one merged row', () => {
    const row = { NAME: 'Old Nick', SERVICE: 'wargaming.net' };
    const result = mergeIdenticalAcrossAccounts(
      [group('A1', [row]), group('A2', [row]), group('A1', [row])],
      COLUMNS,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].accounts).toEqual(['A1', 'A2']);
  });

  it('gives no rows and no removals for an empty input', () => {
    expect(mergeIdenticalAcrossAccounts([], COLUMNS)).toEqual({ rows: [], mergedAway: 0 });
    expect(mergeIdenticalAcrossAccounts([group('A1', [])], COLUMNS)).toEqual({
      rows: [],
      mergedAway: 0,
    });
  });

  it('always reports stored rows minus returned rows', () => {
    const row = { NAME: 'Old Nick', SERVICE: 'wargaming.net' };
    const result = mergeIdenticalAcrossAccounts(
      [group('A1', [row, row, row]), group('A2', [row, row]), group('A3', [row])],
      COLUMNS,
    );

    const stored = 3 + 2 + 1;
    expect(result.mergedAway).toBe(stored - result.rows.length);
    expect(result.mergedAway).toBe(3);
    expect(result.rows.map((merged) => merged.accounts)).toEqual([
      ['A1', 'A2', 'A3'],
      ['A1', 'A2'],
      ['A1'],
    ]);
  });
});

describe('flattenGroups', () => {
  it('returns every stored row once, with its single account and nothing merged', () => {
    const result = flattenGroups([
      group('A1', [{ NAME: 'Old Nick' }, { NAME: 'Old Nick' }]),
      group('A2', [{ NAME: 'Old Nick' }]),
    ]);

    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((merged) => merged.accounts)).toEqual([['A1'], ['A1'], ['A2']]);
    expect(result.mergedAway).toBe(0);
  });

  it('is empty for an empty input', () => {
    expect(flattenGroups([])).toEqual({ rows: [], mergedAway: 0 });
  });
});

describe('the module boundary', () => {
  const MODULE = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../src/lib/features/new-data/account-merge.ts',
  );

  it('imports only types, so a read-time module pulls nothing at runtime', () => {
    const source = readFileSync(MODULE, 'utf8');
    const importLines = source
      .split('\n')
      .filter((line) => line.startsWith('import') && !line.startsWith('import type'));

    expect(importLines).toEqual([]);
  });

  it('groups in a Map, never in an object', () => {
    const source = readFileSync(MODULE, 'utf8');
    expect(source).toMatch(/new Map</);
  });
});
