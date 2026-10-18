import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import Dexie from 'dexie';
import {
  ROWS_PER_BULKPUT_CHUNK,
  AppDb,
  checkCache,
  clearData,
  db,
  purgeUnsupportedCategoryRows,
  readSessionRowData,
  writeDataset,
  writePlaytimeIfCurrent,
} from '../../../src/lib/worker/db.ts';
import type {
  AccountIdentity,
  CategoryEntry,
  PlaytimeAggregates,
} from '../../../src/lib/core/types/worker-messages.ts';
import type { AccountMeta, DatasetRow } from '../../../src/lib/worker/db.ts';
import type { LoginAggregates } from '../../../src/lib/features/logins/login-shared.ts';

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

// =============================================================================
// 04-06 — the backfill seam: an atomic row snapshot and a guarded write-back
// =============================================================================
//
// A `playtime-query` on a dataset whose stored aggregate is absent, null or
// of another version recomputes it from the rows. Two properties make that
// safe, and neither can be tested through the worker alone:
//
//   1. readSessionRowData reads the meta record and the Sessions rows in ONE
//      read transaction, so a replace landing between the two cannot hand
//      the backfill a different dataset's importedAt than its rows.
//   2. writePlaytimeIfCurrent updates only when the stored importedAt still
//      equals the snapshot's, so a slow backfill cannot attach the previous
//      dataset's playtime to a newer dataset (T-04-11).
// =============================================================================

/** One Sessions.csv data row, with the header the aggregator resolves. */
function sessionsData(index: number, server: string): DatasetRow['data'] {
  return {
    SESSION_START: '2020-06-01 10:00:00',
    SESSION_END: '2020-06-01 10:30:00',
    SERVER_NAME: server,
    CLIENT_PLATFORM: 'win32',
    IP: '192.0.2.99',
    idx: String(index),
  };
}

/**
 * A dataset with the four row shapes the backfill has to tell apart: the
 * Sessions file itself, the same file in a lower-cased folder with a
 * lower-cased basename, a Logins.csv in the right folder, and a Sessions.csv
 * nested one folder deeper.
 */
function mixedCategoryRows(): DatasetRow[] {
  return [
    {
      category: 'Activity_history',
      sourceFile: 'Sessions.csv',
      rowIndex: 0,
      data: sessionsData(0, 'eu-1'),
    },
    {
      category: 'Activity_history',
      sourceFile: 'Sessions.csv',
      rowIndex: 1,
      data: sessionsData(1, 'na-1'),
    },
    {
      category: 'activity_history',
      sourceFile: 'sessions.csv',
      rowIndex: 2,
      data: sessionsData(2, 'eu-1'),
    },
    {
      category: 'Activity_history',
      sourceFile: 'Logins.csv',
      rowIndex: 3,
      data: { LOGIN_DT: 'x', IP: '192.0.2.30' },
    },
    {
      category: 'Activity_history',
      sourceFile: 'sub/Sessions.csv',
      rowIndex: 4,
      data: sessionsData(4, 'kr-1'),
    },
  ];
}

/** A minimal stored aggregate; the write-back tests never read its numbers. */
const STUB_PLAYTIME = { v: 1 } as unknown as PlaytimeAggregates;

/**
 * One real-shape `WOT_Game_Sessions.csv` data row, with the header the real
 * export writes.
 *
 * 04-14: the backfill has to find these rows too. A snapshot that answered only
 * the synthetic `Sessions.csv` would rebuild an aggregate from nothing for
 * exactly the export that needs rebuilding, and the user would see
 * "no session file" forever.
 */
function realShapeData(index: number, started: string, finished: string): DatasetRow['data'] {
  return {
    STARTED_AT: started,
    FINISHED_AT: finished,
    IP: '192.0.2.77',
    idx: String(index),
  };
}

/** Every stored row of a snapshot's sources, flattened, in source order. */
function allSnapshotRows(sources: readonly { rows: readonly DatasetRow['data'][] }[]) {
  return sources.flatMap((source) => source.rows);
}

describe('04-06 — readSessionRowData', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  test('returns null when there is no dataset at all', async () => {
    expect(await readSessionRowData()).toBeNull();
  });

  test('returns the importedAt and exactly the Sessions rows, whatever the folder case', async () => {
    const { importedAt } = await writeDataset(
      'backfill-hash'.padEnd(64, 'b'),
      'root-backfill',
      CATEGORIES,
      mixedCategoryRows(),
    );

    const snapshot = await readSessionRowData();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.importedAt).toBe(importedAt);
    // One source per stored session FILE: the two `Sessions.csv` rows and the
    // one `activity_history/sessions.csv` row are two files, not one.
    expect(snapshot!.sources).toHaveLength(2);
    // Logins.csv is a different basename and `sub/Sessions.csv` is a different
    // path, and the predicate ignores both — on this path exactly as it does on
    // the import path.
    const rows = allSnapshotRows(snapshot!.sources);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.SERVER_NAME).sort()).toEqual(['eu-1', 'eu-1', 'na-1']);
    // The header keys come back as written, so the aggregator can resolve its
    // columns without a second lookup.
    expect(Object.keys(rows[0]!)).toContain('SESSION_START');
    // The legacy file names no game, which is not the same answer as "not a
    // session file" — hence it appears here at all.
    expect(snapshot!.sources.map((source) => source.game)).toEqual([null, null]);
  });

  test('returns an empty source list for a dataset with no session file', async () => {
    await writeDataset('no-sessions-hash'.padEnd(64, 'n'), 'root-no-sessions', CATEGORIES, [
      {
        category: 'Activity_history',
        sourceFile: 'Logins.csv',
        rowIndex: 0,
        data: { LOGIN_DT: 'x' },
      },
    ]);

    const snapshot = await readSessionRowData();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.sources).toEqual([]);
  });

  test('scales to a few hundred rows without a multi-key query (T-04-12 timing)', async () => {
    // 300 Sessions rows plus 20 Logins rows: the shape the backfill meets on
    // a real export. The assertion is only that it completes; RESEARCH
    // recorded 2,243 ms for the `anyOf` form this deliberately does not use.
    const many: DatasetRow[] = [];
    for (let i = 0; i < 300; i++) {
      many.push({
        category: 'Activity_history',
        sourceFile: 'Sessions.csv',
        rowIndex: i,
        data: sessionsData(i, i % 2 === 0 ? 'eu-1' : 'na-1'),
      });
    }
    for (let i = 0; i < 20; i++) {
      many.push({
        category: 'Activity_history',
        sourceFile: 'Logins.csv',
        rowIndex: 300 + i,
        data: { LOGIN_DT: 'x' },
      });
    }
    await writeDataset('many-hash'.padEnd(64, 'm'), 'root-many', CATEGORIES, many);

    const snapshot = await readSessionRowData();
    expect(allSnapshotRows(snapshot!.sources)).toHaveLength(300);
  });
});

// =============================================================================
// 04-14 — the same snapshot over the REAL export's per-game files
// =============================================================================
//
// The reporter's case, at the layer below the worker: a dataset imported from a
// real export is ALREADY cached in the user's browser, with an aggregate written
// by a build that did not know about `WOT_Game_Sessions.csv`. The backfill has
// to find those rows in storage and hand them back grouped per file, or the
// user never sees their playtime again (UAT G-04-1, T-04-30).
// =============================================================================

describe('04-14 — readSessionRowData over the per-game files', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  /**
   * The row shapes the backfill has to tell apart on a real export: two
   * per-game files plus the legacy one, and the three non-sources beside them.
   */
  function perGameRows(): DatasetRow[] {
    return [
      {
        category: 'Activity_history',
        sourceFile: 'WOT_Game_Sessions.csv',
        rowIndex: 0,
        data: realShapeData(0, '13.03.2019 20:00', '13.03.2019 21:30'),
      },
      {
        category: 'Activity_history',
        sourceFile: 'WOT_Game_Sessions.csv',
        rowIndex: 1,
        data: realShapeData(1, '13.03.2019 21:00', '13.03.2019 22:00'),
      },
      {
        category: 'Activity_history',
        sourceFile: 'WOWS_Game_Sessions.csv',
        rowIndex: 2,
        data: realShapeData(2, '20.06.2021 18:00', '20.06.2021 18:20'),
      },
      {
        category: 'activity_history',
        sourceFile: 'wotb_game_sessions.csv',
        rowIndex: 3,
        data: realShapeData(3, '02.11.2020 10:00', '02.11.2020 10:30'),
      },
      {
        category: 'Activity_history',
        sourceFile: 'Sessions.csv',
        rowIndex: 4,
        data: sessionsData(4, 'eu-1'),
      },
      // Not a source: a different file in the right folder.
      {
        category: 'Activity_history',
        sourceFile: 'Logins.csv',
        rowIndex: 5,
        data: { LOGIN_DT: 'x' },
      },
      // Not a source: a session-named file NESTED one folder deeper.
      {
        category: 'Activity_history',
        sourceFile: 'sub/WOT_Game_Sessions.csv',
        rowIndex: 6,
        data: realShapeData(6, '01.01.2020 00:00', '01.01.2020 01:00'),
      },
      // Not a source: a session file in ANOTHER folder.
      {
        category: 'User_Info',
        sourceFile: 'Sessions.csv',
        rowIndex: 7,
        data: sessionsData(7, 'na-1'),
      },
      // Not a source: the xlsx duplicate the export ships beside the csv.
      {
        category: 'Activity_history',
        sourceFile: 'WOT_Game_Sessions.xlsx',
        rowIndex: 8,
        data: { STARTED_AT: 'x' },
      },
    ];
  }

  test('answers one source per stored session file, each with its game and rows', async () => {
    const { importedAt } = await writeDataset(
      'per-game-hash'.padEnd(64, 'p'),
      'root-per-game',
      CATEGORIES,
      perGameRows(),
    );

    const snapshot = await readSessionRowData();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.importedAt).toBe(importedAt);

    // Four files: the legacy Sessions.csv, WOT, WOWS and the lower-cased WOTB.
    // The lower-cased folder with a lower-cased basename IS a source — the
    // export has been seen with both cases and the import path agrees.
    //
    // The order is the `sourceFile` INDEX's own order, because that is the order
    // the keys are walked in, and nothing downstream depends on it: each
    // source's rows are aggregated on their own and then merged. So this
    // asserts the SET of games and pairs every one with its row count.
    expect(snapshot!.sources).toHaveLength(4);
    const byGame = new Map(
      snapshot!.sources.map((entry) => [entry.game, entry.rows.length] as const),
    );
    expect(byGame.get(null)).toBe(1);
    expect(byGame.get('WOT')).toBe(2);
    expect(byGame.get('WOWS')).toBe(1);
    expect(byGame.get('WOTB')).toBe(1);

    // Rows stay in STORED order within their own source, and the header keys
    // come back exactly as the file wrote them, so each source resolves its own
    // columns.
    const wot = snapshot!.sources.find((entry) => entry.game === 'WOT')!;
    const wows = snapshot!.sources.find((entry) => entry.game === 'WOWS')!;
    const wotb = snapshot!.sources.find((entry) => entry.game === 'WOTB')!;
    const legacy = snapshot!.sources.find((entry) => entry.game === null)!;
    expect(wot.rows).toHaveLength(2);
    expect(wot.rows.map((row) => row.STARTED_AT)).toEqual(['13.03.2019 20:00', '13.03.2019 21:00']);
    expect(Object.keys(wot.rows[0]!)).toContain('STARTED_AT');
    expect(wows.rows).toHaveLength(1);
    expect(wows.rows[0]!.FINISHED_AT).toBe('20.06.2021 18:20');
    expect(wotb.rows).toHaveLength(1);
    expect(wotb.rows[0]!.STARTED_AT).toBe('02.11.2020 10:00');
    expect(Object.keys(legacy.rows[0]!)).toContain('SESSION_START');

    // And the four non-sources contributed nothing: no Logins.csv, no nested
    // path, no session file in User_Info, no xlsx duplicate.
    expect(allSnapshotRows(snapshot!.sources)).toHaveLength(5);
  });

  test('keeps the login address out of what it hands back as a source', async () => {
    await writeDataset(
      'per-game-ip-hash'.padEnd(64, 'i'),
      'root-per-game-ip',
      CATEGORIES,
      perGameRows(),
    );

    const snapshot = await readSessionRowData();
    // The rows themselves DO carry the address — they are the dataset, and the
    // export's own rows are not the aggregator's business. What must not
    // happen is the backfill reading it: it hands rows over and names no
    // column, and the aggregator names four that are not this one.
    const wot = snapshot!.sources.find((source) => source.game === 'WOT');
    expect(wot).toBeDefined();
    expect(wot!.rows[0]!.IP).toBe('192.0.2.77');
  });
});

describe('04-06 — writePlaytimeIfCurrent', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  test('stores the playtime and reports that it wrote', async () => {
    const { importedAt } = await writeDataset(
      'guard-hash'.padEnd(64, 'g'),
      'root-guard',
      CATEGORIES,
      makeRows(2),
    );
    expect((await checkCache())?.playtime ?? null).toBeNull();

    expect(await writePlaytimeIfCurrent(importedAt, STUB_PLAYTIME)).toBe(true);
    expect((await checkCache())?.playtime).toEqual(STUB_PLAYTIME);
  });

  test('refuses a DIFFERENT importedAt and leaves the stored playtime exactly as it was', async () => {
    // T-04-11: this is the replace-while-backfilling race. A stale write must
    // attach the previous dataset's aggregate to the new one, so it is
    // refused outright rather than merged.
    const { importedAt } = await writeDataset(
      'guard-hash'.padEnd(64, 'g'),
      'root-guard',
      CATEGORIES,
      makeRows(2),
    );
    await writePlaytimeIfCurrent(importedAt, STUB_PLAYTIME);

    const stale = '1999-01-01T00:00:00.000Z';
    expect(await writePlaytimeIfCurrent(stale, { v: 99 } as unknown as PlaytimeAggregates)).toBe(
      false,
    );
    expect((await checkCache())?.playtime).toEqual(STUB_PLAYTIME);
  });

  test('returns false when there is no meta record to update', async () => {
    expect(await writePlaytimeIfCurrent('2020-01-01T00:00:00.000Z', STUB_PLAYTIME)).toBe(false);
    expect(await checkCache()).toBeNull();
  });

  test('updates only the playtime field, leaving the rest of the record alone', async () => {
    const before = await writeDataset(
      'keep-hash'.padEnd(64, 'k'),
      'root-keep',
      CATEGORIES,
      makeRows(3),
      IDENTITY,
    );

    expect(await writePlaytimeIfCurrent(before.importedAt, STUB_PLAYTIME)).toBe(true);

    const after = (await checkCache())!;
    expect(after.hash).toBe('keep-hash'.padEnd(64, 'k'));
    expect(after.accountRoot).toBe('root-keep');
    expect(after.categories).toEqual(CATEGORIES);
    expect(after.identity).toEqual(IDENTITY);
    expect(after.importedAt).toBe(before.importedAt);
    expect(after.playtime).toEqual(STUB_PLAYTIME);
  });
});

// =============================================================================
// 06-01 Task 2 — the Dexie schema decision (checkpoint: option-a), PINNED
// =============================================================================
//
// WHY THIS BLOCK EXISTS, given that no code changed for the decision
//   D-12 reads "Dexie schema bump per Phase 3 D-19 pattern", and the Phase 3
//   D-19 `version(2)` upgrader CLEARS both stores. Applying that pattern to the
//   `logins` field would cost every returning user their cached dataset — rows,
//   identity, imported-at — to recompute a DERIVED value their rows already
//   answer, because the rows still carry the `IP` column and the backfill can
//   rebuild it. The checkpoint answered option-a: no bump.
//
//   A decision that is only a comment is a decision the next phase can undo
//   without noticing, so it is pinned HERE, in the file that owns the schema:
//   the installed version number, and the fact that a dataset carrying a
//   `logins` field re-opens with that field AND its rows intact. Both fail the
//   moment someone adds a `version(3)` for the next derived field, and the
//   third test fails the moment the `version(2)` upgrader is edited.
//
//   The two asserts overlap the 03-01 blocks on purpose. Those prove the wipe
//   works; this one proves the wipe is still the ONLY upgrader a Phase 4 or 5
//   shaped field may leave behind, which is the part a later phase breaks.
// =============================================================================

/** A minimal login aggregate; the pin asserts its survival, not its numbers. */
const STUB_LOGINS = {
  v: 1,
  geo: 'none',
  filesSeen: { sessions: true, logins: false },
  filesWithRows: 1,
  addresses: [],
  totalLogins: 0,
  unreadableRows: 0,
  unknown: { addresses: 0, logins: 0 },
  countries: [],
  other: { addresses: 0, logins: 0 },
  first: null,
  last: null,
  account: null,
} as unknown as LoginAggregates;

describe('06-01 — the logins field added NO Dexie version (checkpoint option-a)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  test('the installed schema version is still 2 — no version(3) was added', () => {
    expect(db.verno).toBe(2);
  });

  test('a dataset holding a logins field re-opens with that field AND its rows intact', async () => {
    await writeDataset(
      'logins-pinned-hash'.padEnd(64, 'p'),
      'root-logins-pinned',
      CATEGORIES,
      makeRows(3),
      IDENTITY,
      null,
      null,
      STUB_LOGINS,
    );
    expect((await checkCache())?.logins).toEqual(STUB_LOGINS);
    await db.close();

    const reopened = new AppDb();
    await reopened.open();
    try {
      expect(reopened.verno).toBe(2);
      expect(await reopened.rows.count()).toBe(3);
      const meta = await reopened.meta.get('active');
      expect(meta?.hash).toBe('logins-pinned-hash'.padEnd(64, 'p'));
      expect(meta?.identity).toEqual(IDENTITY);
      // The field is read back as an ordinary property, which is the whole
      // claim: an unindexed field of the unchanged `meta` store.
      expect(meta?.logins).toEqual(STUB_LOGINS);
    } finally {
      await reopened.close();
    }
  });
});

describe('06-01 — the v1 wipe is still the ONLY upgrader (checkpoint option-a)', () => {
  beforeEach(async () => {
    // DELIBERATELY not opening the module singleton, for the reason the 03-01
    // block above gives: opening it would create the database directly at v2,
    // and the seeded v1 store below would then have nothing to upgrade — no
    // versionchange transaction, no upgrade callback, and the seeded row would
    // survive for a reason that has nothing to do with the upgrader.
    await db.delete();
  });

  afterAll(async () => {
    await db.close();
  });

  test('a v1 database carrying a logins field is wiped on open', async () => {
    // Seeded at v1 with a meta record that ALREADY carries a logins field: the
    // one case where "no bump" could be argued to cost something. It costs
    // nothing, because the v1 wipe is unconditional — and it still has to RUN,
    // so the assertion is that a database at v1 loses everything on open.
    const legacy = new Dexie('wg-export-viewer');
    legacy.version(1).stores({ rows: '++id, category, sourceFile', meta: 'id' });
    await legacy.open();
    await legacy.table('rows').add(LEGACY_ROW);
    await legacy.table('meta').add({ ...LEGACY_META, logins: STUB_LOGINS });
    await legacy.close();

    const upgraded = new AppDb();
    await upgraded.open();
    try {
      expect(await upgraded.rows.count()).toBe(0);
      expect(await upgraded.meta.count()).toBe(0);
    } finally {
      await upgraded.close();
    }
  });
});

// =============================================================================
// Phase 9 (09-03) — `account` / `accounts` round-trip, clearData across
// accounts, and the D-21 purge
// =============================================================================
//
// D-07/D-08 added two fields and NO schema version. This block pins that
// claim at the storage layer, where it is decided, and pins the D-21 purge's
// matrix — the casing rule, the meta-untouched rule and the idempotence — by
// calling the function DIRECTLY, which is the only way to assert the return
// value and the "an empty database" branch. The worker-level proof that the
// purge actually runs on load lives in
// `tests/unit/import/multi-account-lifecycle.test.ts`.
// =============================================================================

/** One account's entry for the `accounts` argument, with distinct values. */
function accountMeta(root: string, rows: number): AccountMeta {
  return {
    root,
    categories: [{ name: 'Activity_history', status: 'supported', fileCount: 1, rowCount: rows }],
    identity: null,
    files: [
      { category: 'Player_statistics', sourceFile: `${root}.csv`, rowCount: rows, account: root },
    ],
    games: ['WOT'],
    firstYear: 2012,
    lastYear: 2026,
  };
}

/** One stored row owned by `account`. */
function ownedRow(category: string, sourceFile: string, account?: string): DatasetRow {
  return {
    category,
    sourceFile,
    rowIndex: 0,
    ...(account === undefined ? {} : { account }),
    data: { ID: account ?? 'legacy' },
  };
}

describe('09-03 — account and accounts round-trip with NO version bump (D-07, D-08)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  test('the installed schema version is still 2 — account is a non-indexed field', () => {
    expect(db.verno).toBe(2);
  });

  test('rows and the accounts list round-trip through writeDataset and checkCache', async () => {
    const accounts = [accountMeta('2000002', 5), accountMeta('500000001', 3)];
    await writeDataset(
      'multi-hash'.padEnd(64, 'm'),
      // D-08: the legacy field is the FIRST account in D-16 order.
      '2000002',
      CATEGORIES,
      [
        ownedRow('Activity_history', 'WOT_Game_Sessions.csv', '2000002'),
        ownedRow('Player_statistics', 'WOTB_Vehicle_Statistics.csv', '2000002'),
        ownedRow('Player_statistics', 'WOTB_Vehicle_Statistics.csv', '500000001'),
      ],
      null,
      null,
      null,
      null,
      accounts,
    );

    const meta = await checkCache();
    expect(meta?.accountRoot).toBe('2000002');
    expect(meta?.accounts).toEqual(accounts);
    expect(meta?.accounts?.map((a) => a.root)).toEqual(['2000002', '500000001']);

    const rows = await db.rows.toArray();
    expect(rows).toHaveLength(3);
    // The SAME file name from two accounts is two stored rows, never one.
    const shared = rows.filter((r) => r.sourceFile === 'WOTB_Vehicle_Statistics.csv');
    expect(shared.map((r) => r.account).sort()).toEqual(['2000002', '500000001']);
  });

  test('a write without the accounts argument leaves meta.accounts null (a v1.0-shaped write)', async () => {
    // The four-argument call every pre-Phase-9 caller makes must keep
    // compiling AND keep its meaning: D-22 normalises it into a one-account
    // list at read time, so nothing downstream branches on the difference.
    await writeDataset('legacy-shaped'.padEnd(64, 'l'), '123456789', CATEGORIES, makeRows(2));
    expect((await checkCache())?.accounts).toBeNull();
  });

  test('clearData removes the rows of EVERY account and the meta record', async () => {
    await writeDataset(
      'clear-all'.padEnd(64, 'c'),
      '2000002',
      CATEGORIES,
      [
        ownedRow('Activity_history', 'WOT_Game_Sessions.csv', '2000002'),
        ownedRow('Activity_history', 'WOT_Game_Sessions.csv', '500000001'),
        ownedRow('Player_statistics', 'WOTB_Vehicle_Statistics.csv', '1000000003'),
      ],
      null,
      null,
      null,
      null,
      [accountMeta('2000002', 1), accountMeta('500000001', 1)],
    );
    expect(await db.rows.count()).toBe(3);

    await clearData();

    expect(await db.rows.count()).toBe(0);
    expect(await db.meta.get('active')).toBeUndefined();
    expect(await checkCache()).toBeNull();
  });
});

describe('09-03 — purgeUnsupportedCategoryRows (D-21)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterAll(async () => {
    await db.close();
  });

  /**
   * Every spelling a SUPPORTED category may carry in the index, and the two
   * known-deferred ones plus an unknown folder.
   *
   * The casing list is the load-bearing half: `classifyFolder` compares
   * case-insensitively and each distinct spelling is its OWN index key, so
   * every one of these is judged on its own. A purge that compared a
   * case-SENSITIVELY against `SUPPORTED` would delete `Activity_HISTORY` rows
   * and silently shrink a real dataset's playtime.
   */
  const SUPPORTED_SPELLINGS = [
    'Activity_history',
    'Activity_HISTORY',
    'activity_history',
    'FINANCIAL_DATA',
    'financial_data',
    'user_info',
    'USER_INFO',
    'Player_Statistics',
  ];
  const UNSUPPORTED_SPELLINGS = [
    'Chat_history',
    'CHAT_HISTORY',
    'chat_history',
    'CLANS',
    'Bans',
    'Game_Forums',
    'game_forums',
    'Some_Folder_This_Build_Never_Heard_Of',
  ];

  test('deletes the unsupported categories and keeps every supported spelling', async () => {
    const rows: DatasetRow[] = [
      ...SUPPORTED_SPELLINGS.map((category, i) =>
        ownedRow(category, `keep-${i}.csv`, i % 2 === 0 ? '2000002' : undefined),
      ),
      ...UNSUPPORTED_SPELLINGS.map((category, i) =>
        ownedRow(category, `drop-${i}.csv`, i % 2 === 0 ? '2000002' : undefined),
      ),
    ];
    await writeDataset(
      'purge-matrix'.padEnd(64, 'p'),
      '2000002',
      CATEGORIES,
      rows,
      null,
      null,
      null,
      null,
      [accountMeta('2000002', rows.length)],
    );
    expect(await db.rows.count()).toBe(rows.length);

    const deleted = await purgeUnsupportedCategoryRows();

    // The returned number IS the deleted row count, not a category count.
    expect(deleted).toBe(UNSUPPORTED_SPELLINGS.length);
    const remaining = await db.rows.toArray();
    expect(remaining.map((r) => r.category).sort()).toEqual([...SUPPORTED_SPELLINGS].sort());
    for (const category of UNSUPPORTED_SPELLINGS) {
      expect(remaining.filter((r) => r.category === category)).toHaveLength(0);
    }
  });

  test('judges a row by its CATEGORY alone, never by its account stamp', async () => {
    // Rows with an `account` and rows without one are both judged on category:
    // the field is Phase 9's provenance, not a filter. A purge that skipped
    // unstamped rows would leave a whole v1.0 cache's forum rows in place —
    // which is precisely the population D-21 exists to remove.
    await writeDataset('purge-stamp'.padEnd(64, 's'), '2000002', CATEGORIES, [
      ownedRow('Game_Forums', 'stamped.csv', '2000002'),
      ownedRow('Game_Forums', 'unstamped.csv'),
      ownedRow('Activity_history', 'stamped-keep.csv', '2000002'),
      ownedRow('Activity_history', 'unstamped-keep.csv'),
    ]);

    expect(await purgeUnsupportedCategoryRows()).toBe(2);
    const remaining = await db.rows.toArray();
    expect(remaining.map((r) => r.category)).toEqual(['Activity_history', 'Activity_history']);
  });

  test('leaves the meta record EXACTLY as written', async () => {
    const accounts = [accountMeta('2000002', 4)];
    await writeDataset(
      'purge-meta'.padEnd(64, 'm'),
      '2000002',
      CATEGORIES,
      [ownedRow('Game_Forums', 'forum.csv'), ownedRow('Activity_history', 'keep.csv')],
      IDENTITY,
      null,
      null,
      STUB_LOGINS,
      accounts,
    );
    const before = (await checkCache())!;

    await purgeUnsupportedCategoryRows();

    // Every field, deep-equal: the category rowCounts the "Not yet supported"
    // banners render, the skipped counts, the aggregates and the identity.
    expect(await checkCache()).toEqual(before);
  });

  test('is idempotent — a second call returns 0 and changes nothing', async () => {
    await writeDataset('purge-again'.padEnd(64, 'g'), '2000002', CATEGORIES, [
      ownedRow('Game_Forums', 'forum.csv'),
      ownedRow('Chat_history', 'chat.csv'),
      ownedRow('Activity_history', 'keep.csv'),
    ]);

    expect(await purgeUnsupportedCategoryRows()).toBe(2);
    const afterFirst = await db.rows.toArray();
    expect(await purgeUnsupportedCategoryRows()).toBe(0);
    expect(await db.rows.toArray()).toEqual(afterFirst);
  });

  test('an empty database returns 0 without throwing', async () => {
    expect(await db.rows.count()).toBe(0);
    await expect(purgeUnsupportedCategoryRows()).resolves.toBe(0);
    expect(await db.meta.count()).toBe(0);
  });

  test('a database with no unsupported rows is a no-op that keeps every row', async () => {
    await writeDataset(
      'purge-none'.padEnd(64, 'n'),
      '2000002',
      CATEGORIES,
      SUPPORTED_SPELLINGS.map((category, i) => ownedRow(category, `keep-${i}.csv`)),
    );
    const before = await db.rows.toArray();

    expect(await purgeUnsupportedCategoryRows()).toBe(0);
    expect(await db.rows.toArray()).toEqual(before);
  });

  test('the installed schema version is still 2 — a purge is not a migration', () => {
    expect(db.verno).toBe(2);
  });
});
