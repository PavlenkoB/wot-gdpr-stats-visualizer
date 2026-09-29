import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import {
  ROWS_PER_BULKPUT_CHUNK,
  checkCache,
  clearData,
  db,
  writeDataset,
} from '../../src/lib/worker/db.ts';
import type { CategoryEntry } from '../../src/lib/types/worker-messages.ts';
import type { DatasetRow } from '../../src/lib/worker/db.ts';

// =============================================================================
// db — Dexie schema + transactional writeDataset + checkCache (RESEARCH.md Pattern 3)
// =============================================================================
//
// Why this file exists (02-01-PLAN Task 3, Test 4, RED then GREEN):
//   DATA-01 requires every import to land in a single active IndexedDB
//   dataset, and IMPORT-06 / SC3 requires the hash dedup gate to read
//   the SAME dataset back. Both hinge on db.ts's two exported
//   functions — writeDataset and checkCache — and on the schema's
//   `meta` table holding exactly one row keyed by 'active'.
//
// The fake-indexeddb/auto polyfill (loaded in tests/unit/setup.ts
// per Task 2) provides an in-memory `indexedDB` global so Dexie can
// open the database under Node. Each test starts from a clean
// database via `db.delete()` + `db.open()` so prior-write state from
// the previous test does not bleed through.
//
// The four testable invariants per the plan's Behavior block:
//   1. writeDataset leaves rows.count() === rows.length and
//      meta.get('active') carries the hash/accountRoot/categories
//      that were written.
//   2. A second writeDataset call with a DIFFERENT hash clears
//      every row from the first import before writing the second
//      (no stale row from a prior hash survives).
//   3. checkCache() returns null when no 'active' record exists.
//   4. checkCache() returns the stored record otherwise.
// =============================================================================

const CATEGORIES: CategoryEntry[] = [
  { name: 'Activity_history', status: 'supported', fileCount: 1, rowCount: 2, skippedRowCount: 0 },
  { name: 'Clans', status: 'known-deferred', fileCount: 1, rowCount: 1, skippedRowCount: 0 },
];

function makeRows(n: number): DatasetRow[] {
  const out: DatasetRow[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      category: i % 2 === 0 ? 'Activity_history' : 'Clans',
      sourceFile: i % 2 === 0 ? 'Sessions.csv' : 'Clan_membership.csv',
      rowIndex: i,
      data: { idx: String(i) },
    });
  }
  return out;
}

describe('ROWS_PER_BULKPUT_CHUNK', () => {
  test('is exported and is a positive integer (1000 per RESEARCH Open Question 1)', () => {
    expect(typeof ROWS_PER_BULKPUT_CHUNK).toBe('number');
    expect(ROWS_PER_BULKPUT_CHUNK).toBe(1000);
  });
});

describe('writeDataset', () => {
  beforeEach(async () => {
    // Start every test from a clean database so prior-write counts
    // don't bleed through. db.delete() resolves once the underlying
    // IndexedDB delete request completes.
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  test('after writeDataset, rows.count() equals rows.length and the meta record matches the inputs', async () => {
    const rows = makeRows(5);
    const hash = 'a'.repeat(64);
    const accountRoot = '123456789';
    await writeDataset(hash, accountRoot, CATEGORIES, rows);

    expect(await db.rows.count()).toBe(rows.length);
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();
    expect(meta!.id).toBe('active');
    expect(meta!.hash).toBe(hash);
    expect(meta!.accountRoot).toBe(accountRoot);
    expect(meta!.categories).toEqual(CATEGORIES);
    expect(typeof meta!.importedAt).toBe('string');
    // importedAt is a valid ISO 8601 string (Date.toISOString() shape).
    expect(meta!.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test('a second writeDataset with a DIFFERENT hash clears every row from the first import before writing the second', async () => {
    await writeDataset('hash-A'.padEnd(64, 'a'), 'root-A', CATEGORIES, makeRows(3));
    expect(await db.rows.count()).toBe(3);

    // Different hash → the entire rows table is cleared and re-written.
    const secondRows = makeRows(7);
    await writeDataset('hash-B'.padEnd(64, 'b'), 'root-B', CATEGORIES, secondRows);

    expect(await db.rows.count()).toBe(7);
    // No row from the first import survives — its `idx` values were
    // 0..2, the second's are 0..6; a stale row would show up as
    // an extra entry with idx 0..2.
    const allIdx = await db.rows.toArray();
    const idxValues = allIdx.map((r) => r.rowIndex).sort((a, b) => a - b);
    expect(idxValues).toEqual([0, 1, 2, 3, 4, 5, 6]);

    // Meta record reflects the SECOND write.
    const meta = await db.meta.get('active');
    expect(meta!.hash).toBe('hash-B'.padEnd(64, 'b'));
    expect(meta!.accountRoot).toBe('root-B');
  });
});

describe('checkCache', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  test('returns null when db.meta has no "active" record', async () => {
    // No writeDataset call — the meta table is empty.
    const meta = await checkCache();
    expect(meta).toBeNull();
  });

  test('returns the stored record when db.meta has an "active" record', async () => {
    await writeDataset('hash-X'.padEnd(64, 'x'), 'root-X', CATEGORIES, makeRows(2));
    const meta = await checkCache();
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('active');
    expect(meta!.hash).toBe('hash-X'.padEnd(64, 'x'));
    expect(meta!.accountRoot).toBe('root-X');
    expect(meta!.categories).toEqual(CATEGORIES);
  });
});

// =============================================================================
// 02-03 — clearData (DATA-02 close-the-loop, destructive controls)
//
// Why this block exists (02-03-PLAN Task 1, Behavior Tests 1 + 2):
//   DATA-02's persistent "Clear my cached data" control and Start Over's
//   newly-destructive behavior (D-15) both wipe the IndexedDB cache via
//   this function. The clear must be atomic (same transactional
//   discipline as writeDataset — RESEARCH.md Pattern 3) so a crash
//   mid-clear can never leave a meta record pointing at a partial rows
//   table.
//
// The two invariants per the plan's Behavior block:
//   1. clearData() leaves `db.rows.count() === 0` and deletes the
//      'active' record from `db.meta` (`checkCache()` returns null
//      afterwards).
//   2. clearData() when no dataset was ever written does NOT throw
//      (clear() of an empty table is a no-op; deleting a missing key
//      is also a no-op).
// =============================================================================

describe('clearData', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  test('clearData() leaves zero rows and removes the "active" meta record', async () => {
    // Seed a real dataset so we can prove clearData() empties it.
    await writeDataset('hash-Y'.padEnd(64, 'y'), 'root-Y', CATEGORIES, makeRows(4));
    expect(await db.rows.count()).toBe(4);
    expect(await db.meta.get('active')).toBeDefined();

    await clearData();

    // No row from the prior import survives.
    expect(await db.rows.count()).toBe(0);
    // The 'active' meta record is gone — checkCache() reports cached: null
    // (DATA-02: the cached data control is hidden when there is nothing
    // to clear; a subsequent page load lands on the empty dropzone, not
    // stale results).
    expect(await db.meta.get('active')).toBeUndefined();
    expect(await checkCache()).toBeNull();
  });

  test('clearData() when no dataset was ever written does not throw', async () => {
    // No prior writeDataset call — the meta table is empty and the rows
    // table is empty. clearData() must be a safe no-op so the persistent
    // "Clear my cached data" control (which D-19 only renders when a
    // dataset exists) can never crash on an edge case.
    expect(await db.rows.count()).toBe(0);
    await expect(clearData()).resolves.toBeUndefined();
    // Calling it twice in a row is also a no-op — second clear must
    // not throw either (the user could conceivably click "Clear" again
    // after the empty state has rendered).
    await expect(clearData()).resolves.toBeUndefined();
    expect(await db.rows.count()).toBe(0);
    expect(await checkCache()).toBeNull();
  });
});
