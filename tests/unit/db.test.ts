import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import Dexie from 'dexie';
import {
  ROWS_PER_BULKPUT_CHUNK,
  AppDb,
  checkCache,
  clearData,
  db,
  writeDataset,
} from '../../src/lib/worker/db.ts';
import type { AccountIdentity, CategoryEntry } from '../../src/lib/types/worker-messages.ts';
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

// =============================================================================
// 03-01 Task 3 — Dexie v2 wipes Phase 2 caches, and meta carries the identity
// =============================================================================
//
// Why this block exists (03-01-PLAN Task 3, D-19, threat T-03-02):
//   D-18 stops the account email from being written from here on, but a
//   returning user already has a Phase 2 database sitting in their browser
//   with the raw LOGIN already in it. D-19 discards it: the schema version
//   is bumped and every row and meta record is cleared on the upgrade.
//
//   The nuance that makes this a real test rather than a version bump: a
//   bare `version(2).stores(<same>)` PRESERVES all data (RESEARCH Q1 probe
//   A) — only an `upgrade` callback discards it. So the assertion that
//   matters is emptiness after opening a seeded v1 database, and it fails
//   loudly if someone later "simplifies" the declaration and drops the
//   upgrader.
//
//   Renaming the database is NOT an option and would be worse: it would
//   leave the emailed `wg-export-viewer` store in the user's browser
//   forever, which is precisely what D-19 exists to prevent.
// =============================================================================

const IDENTITY: AccountIdentity = {
  nickname: 'Synthetic Player',
  region: 'CA',
  createdAt: '2020-01-01 00:00:00',
};

/** A v1 row in the shape Phase 2 wrote, with the email still at rest. */
const LEGACY_ROW = {
  category: 'User_Info',
  sourceFile: 'Account_Info.csv',
  rowIndex: 0,
  data: {
    ID: '123456789',
    NAME: 'Synthetic Player',
    LOGIN: 'synthetic.player@example.invalid',
    BIRTH_DATE: '1990-01-01',
  },
};

const LEGACY_META = {
  id: 'active' as const,
  hash: 'legacy-hash',
  accountRoot: '123456789',
  importedAt: '2020-01-01T00:00:00.000Z',
  categories: [] as CategoryEntry[],
};

describe('03-01 — Dexie v2 upgrade discards a Phase 2 cache (D-19)', () => {
  beforeEach(async () => {
    // Delete whatever the previous test left behind, but DELIBERATELY do
    // not open the module singleton here. Opening it would create the
    // database directly at the current version, and the seeded v1 store
    // below would then have nothing to upgrade — no versionchange
    // transaction, no upgrade callback, and the seeded row would survive
    // for a reason that has nothing to do with the upgrader.
    await db.delete();
  });

  afterAll(async () => {
    await db.close();
  });

  test('opening a seeded v1 database leaves rows and meta empty', async () => {
    // Seed the legacy store with a bare Dexie declaring the v1 schema, so
    // what the upgrade finds is genuinely a v1 database rather than an
    // empty one that merely looks fresh.
    const legacy = new Dexie('wg-export-viewer');
    legacy.version(1).stores({ rows: '++id, category, sourceFile', meta: 'id' });
    await legacy.open();
    await legacy.table('rows').add(LEGACY_ROW);
    await legacy.table('meta').add(LEGACY_META);
    await legacy.close();

    const upgraded = new AppDb();
    await upgraded.open();
    try {
      // The email-bearing row and the meta record that described it are
      // both gone: the user is left on the empty state and re-imports once.
      expect(await upgraded.rows.count()).toBe(0);
      expect(await upgraded.meta.count()).toBe(0);
    } finally {
      await upgraded.close();
    }
  });

  test('the same database NAME is reused, so the emailed v1 store is actually reached', async () => {
    // A different name would orphan the old store rather than wipe it.
    const upgraded = new AppDb();
    await upgraded.open();
    try {
      expect(upgraded.name).toBe('wg-export-viewer');
    } finally {
      await upgraded.close();
    }
  });
});

describe('03-01 — the upgrader runs once and never on a fresh install', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  test('data written at v2 survives a close and re-open — the upgrader never re-runs', async () => {
    // Opening this database at v2 is exactly the "brand-new install" path
    // Dexie documents: it initializes at the last version directly and no
    // upgrade function runs, so the rows written below must still be there
    // on the next open.
    await writeDataset('v2-hash'.padEnd(64, '2'), 'root-v2', CATEGORIES, makeRows(3), IDENTITY);
    expect(await db.rows.count()).toBe(3);
    await db.close();

    const reopened = new AppDb();
    await reopened.open();
    try {
      expect(await reopened.rows.count()).toBe(3);
      expect(await reopened.meta.count()).toBe(1);
      expect((await reopened.meta.get('active'))?.identity).toEqual(IDENTITY);
    } finally {
      await reopened.close();
    }
  });
});

describe('03-01 — the identity rides on the meta record (D-20)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  test('writeDataset with an identity stores it and checkCache replays it', async () => {
    await writeDataset('id-hash'.padEnd(64, 'i'), 'root-id', CATEGORIES, makeRows(2), IDENTITY);
    expect((await db.meta.get('active'))?.identity).toEqual(IDENTITY);
    // The return-visit path reads the identity from meta with no row query.
    expect((await checkCache())?.identity).toEqual(IDENTITY);
  });

  test('omitting the fifth argument leaves meta.identity null (the D-16 fallback)', async () => {
    // The four-argument call must keep working — several existing tests
    // and no User_Info export both use it.
    await writeDataset('no-id-hash'.padEnd(64, 'n'), 'root-none', CATEGORIES, makeRows(2));
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();
    expect(meta!.identity ?? null).toBeNull();
  });

  test('a replaced dataset does not inherit the previous identity', async () => {
    await writeDataset('first-hash'.padEnd(64, 'f'), 'root-a', CATEGORIES, makeRows(2), IDENTITY);
    await writeDataset('second-hash'.padEnd(64, 's'), 'root-b', CATEGORIES, makeRows(2));
    expect((await checkCache())?.identity ?? null).toBeNull();
  });
});
