// =============================================================================
// new-data-narrow.test.ts — narrowing already-stored family rows (11-04, D-14)
// =============================================================================
//
// WHAT THIS PROVES.
//
// A returning reader's IndexedDB cache was written by a build that had no
// per-file column allowlist: its HEAT, WoT Console, Warplanes and WoWS rows sit
// at rest with EVERY column, including the WOWP account rows' nickname-like
// `NAME`. Nothing in 11-01 through 11-03 changed data already written, so the
// gap is closed here — one idempotent step on check-cache that rewrites those
// rows to their projections, deletes the rows of family files that should store
// nothing, and puts the presence facts back in agreement with the rows.
//
// The rows are SEEDED, not imported: an import runs the current allowlist and
// would write the narrow shape, so a test that imported could not tell the
// narrowing step from the import. Every value is a synthetic
// `.example.invalid` / `CANARY-` string, and the sweep at the end searches the
// whole serialised `db.rows` for them, so "the canary is gone" is a claim about
// the STORED TABLE rather than about a code path that never wrote it.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CategoryEntry } from '../../../src/lib/core/types/worker-messages.ts';
import type { AccountMeta, DatasetFile, DatasetRow } from '../../../src/lib/worker/db.ts';
import { isNewDataFile } from '../../../src/lib/worker/new-data-allowlist.ts';
import { NEW_DATA_SPEC_FILES, type SpecFile } from '../../../src/lib/worker/new-data-specs.ts';
import { NG_ROOT_A, NG_ROOT_B } from '../../fixtures/new-data-fixtures.ts';
import { CAPTURED_FILES } from '../../fixtures/new-data-headers.ts';
import {
  deleteActiveDatabase,
  importWorkerDb,
  installWorkerScope,
  loadWorker,
  postRequest,
  waitForMessage,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

// -----------------------------------------------------------------------------
// Seeding a v1.1-shaped cache
// -----------------------------------------------------------------------------

/** The folder the archive spells, one per category these tests use. */
const CATEGORIES: CategoryEntry[] = [
  { name: 'Activity_History', status: 'supported', fileCount: 2, rowCount: 4, skippedRowCount: 0 },
  {
    name: 'Player_Statistics',
    status: 'supported',
    fileCount: 6,
    rowCount: 8,
    skippedRowCount: 0,
  },
];

/** A canary a real export could never hold. */
const CANARY_EMAIL = 'narrow-canary@narrow.example.invalid';
const CANARY_NICKNAME = 'CANARY-NICKNAME-NARROW';

/** One legacy row, with the id left to Dexie unless the test pins it. */
function legacyRow(
  category: string,
  sourceFile: string,
  rowIndex: number,
  data: Record<string, string | undefined>,
  account: string = NG_ROOT_A,
): DatasetRow {
  return { category, sourceFile, rowIndex, data, account };
}

/**
 * The FOLDER a spec's file was captured in, spelled as the archive spells it.
 *
 * The spec's own category decides it, because the narrowing step looks the
 * spec up with the row's OWN category: a row filed under a folder the spec was
 * never seen in matches no spec and is deleted rather than narrowed, which is
 * the rule the misfiled-copy case proves.
 */
function folderOf(spec: SpecFile): string {
  // The Phase 12 files are filed under the folder the capture printed (12-08),
  // spelled as the archive spells it, so the seeded category is the spec's own.
  const captured = CAPTURED_FILES.find((entry) => entry.key === spec.key);
  if (captured !== undefined && captured.folder.toLowerCase() === spec.category) {
    return captured.folder;
  }
  switch (spec.category) {
    case 'activity_history':
      return 'Activity_History';
    case 'surveys':
      return 'Surveys';
    default:
      return 'Player_Statistics';
  }
}

/**
 * A pre-allowlist row of a spec file: the file's OWN first column, a personal
 * column the spec never names, and a surplus array no column list can see into
 * — the three shapes a legacy cache holds and a projection must remove.
 */
function legacySpecRow(spec: SpecFile, rowIndex: number, account = NG_ROOT_A): DatasetRow {
  const header = spec.columns[0]?.header ?? 'UNKNOWN';
  return legacyRow(
    folderOf(spec),
    spec.key,
    rowIndex,
    {
      [header]: '11',
      EMAIL: CANARY_EMAIL,
      NICKNAME: CANARY_NICKNAME,
      // The cast is load-bearing, not laziness: PapaParse's surplus-cell array is
      // exactly the shape a legacy row holds and a `Record<string, string>`
      // cannot express, which is the point of planting it.
      __parsed_extra: ['surplus-cell'] as unknown as string,
    },
    account,
  );
}

/** A presence fact as a v1.1 build wrote it: no `parsedRowCount` at all. */
function legacyFact(
  sourceFile: string,
  rowCount: number,
  category = 'Player_Statistics',
  account = NG_ROOT_A,
): DatasetFile {
  return { category, sourceFile, rowCount, account };
}

/** Write rows and a v1.1-shaped meta record straight into the worker's Dexie. */
async function seed(rows: DatasetRow[], files: DatasetFile[], accounts: AccountMeta[] | null) {
  const { db } = await importWorkerDb();
  await db.rows.clear();
  await db.rows.bulkPut(rows);
  await db.meta.put({
    id: 'active',
    hash: 'n'.repeat(64),
    accountRoot: NG_ROOT_A,
    importedAt: '2026-01-02T03:04:05.000Z',
    categories: CATEGORIES,
    identity: null,
    playtime: null,
    files,
    logins: null,
    accounts,
  });
}

/** Every stored row, in id order. */
async function storedRows(): Promise<DatasetRow[]> {
  const { db } = await importWorkerDb();
  return (await db.rows.toArray()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

/** The stored meta record, or a failure. */
async function activeMeta() {
  const { db } = await importWorkerDb();
  const meta = await db.meta.get('active');
  if (meta === undefined) throw new Error('no active meta record');
  return meta;
}

/** Run the step under test. */
async function narrow(): Promise<number> {
  const { narrowStoredNewDataRows } = await importWorkerDb();
  return narrowStoredNewDataRows();
}

// -----------------------------------------------------------------------------
// The table this test iterates
// -----------------------------------------------------------------------------

describe('11-04 — the spec table this test walks is the complete one', () => {
  it('holds more than the two session specs', () => {
    expect(NEW_DATA_SPEC_FILES.length).toBeGreaterThan(2);
  });

  it('names a pane file from HEAT, WoWS and WOWP in the family', () => {
    for (const name of [
      'heat_account_statistics.csv',
      'wows_crews.csv',
      'wowp_19_account_statistics.csv',
    ]) {
      expect(isNewDataFile(name), name).toBe(true);
    }
  });
});

// -----------------------------------------------------------------------------
// The rows
// -----------------------------------------------------------------------------

describe('11-04 — narrowStoredNewDataRows rewrites what an allowlist now stores', () => {
  it('rewrites a legacy row of a spec file to its projection, keeping its identity fields', async () => {
    await seed(
      [
        legacyRow('Activity_History', 'HEAT_Game_Sessions.csv', 7, {
          STARTED_AT: '05.03.2024 20:00',
          FINISHED_AT: '05.03.2024 21:00',
          IP: '203.0.113.4',
          EMAIL: CANARY_EMAIL,
          NICKNAME: CANARY_NICKNAME,
          // The cast is load-bearing, not laziness: PapaParse's surplus-cell array is
          // exactly the shape a legacy row holds and a `Record<string, string>`
          // cannot express, which is the point of planting it.
          __parsed_extra: ['surplus-cell'] as unknown as string,
        }),
      ],
      [legacyFact('HEAT_Game_Sessions.csv', 1, 'Activity_History')],
      null,
    );
    const before = await storedRows();

    expect(await narrow()).toBe(1);

    const after = await storedRows();
    expect(after).toHaveLength(1);
    expect(after[0]!.data).toEqual({
      STARTED_AT: '05.03.2024 20:00',
      FINISHED_AT: '05.03.2024 21:00',
      IP: '203.0.113.4',
    });
    // The row is the SAME row, narrowed — never a replacement that would reset
    // the dataset's row indices or move the file to another account.
    expect(after[0]!.id).toBe(before[0]!.id);
    expect(after[0]!.category).toBe('Activity_History');
    expect(after[0]!.sourceFile).toBe('HEAT_Game_Sessions.csv');
    expect(after[0]!.rowIndex).toBe(7);
    expect(after[0]!.account).toBe(NG_ROOT_A);
  });

  it('deletes the rows of a family file with NO spec (D-15)', async () => {
    await seed(
      [
        legacyRow('Player_Statistics', 'HEAT_Device_Info.csv', 0, {
          ID: CANARY_NICKNAME,
          EMAIL: CANARY_EMAIL,
        }),
        legacyRow('Device_Info', 'HEAT_Device_Info.csv', 0, { ID: CANARY_NICKNAME }),
      ],
      [legacyFact('HEAT_Device_Info.csv', 2)],
      null,
    );

    expect(await narrow()).toBe(2);
    expect(await storedRows()).toEqual([]);
  });

  it('deletes every row of a spec file whose headers match no allowlist column', async () => {
    await seed(
      [
        legacyRow('Activity_History', 'HEAT_Session_Geolocation.csv', 0, {
          DRIFTED_ALPHA: CANARY_NICKNAME,
        }),
      ],
      [legacyFact('HEAT_Session_Geolocation.csv', 1, 'Activity_History')],
      null,
    );

    expect(await narrow()).toBe(1);
    expect(await storedRows()).toEqual([]);
  });

  it('judges a drifted file PER ACCOUNT, leaving the account that matches alone', async () => {
    await seed(
      [
        legacyRow('Activity_History', 'HEAT_Session_Geolocation.csv', 0, { DRIFTED: 'x' }),
        legacyRow(
          'Activity_History',
          'HEAT_Session_Geolocation.csv',
          0,
          {
            IP: '203.0.113.9',
            DRIFTED: 'x',
          },
          NG_ROOT_B,
        ),
      ],
      [
        legacyFact('HEAT_Session_Geolocation.csv', 1, 'Activity_History'),
        legacyFact('HEAT_Session_Geolocation.csv', 1, 'Activity_History', NG_ROOT_B),
      ],
      null,
    );

    // One deleted (the drifted account) and one REWRITTEN (the sibling, whose
    // surplus column the projection drops) — the sibling's row survives, which
    // is the claim the return value alone would not make.
    expect(await narrow()).toBe(2);
    const remaining = await storedRows();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.account).toBe(NG_ROOT_B);
    expect(remaining[0]!.data).toEqual({ IP: '203.0.113.9' });
  });

  it('leaves the rows of NON-family files completely alone', async () => {
    const wot = legacyRow('Activity_History', 'WOT_Game_Sessions.csv', 0, {
      STARTED_AT: '04.03.2024 10:00',
      EMAIL: CANARY_EMAIL,
    });
    await seed(
      [
        wot,
        legacyRow('Player_Statistics', 'WOWS_Ship_Statistics.csv', 0, { NAME: CANARY_NICKNAME }),
      ],
      [],
      null,
    );
    const before = await storedRows();

    expect(await narrow()).toBe(0);
    // Byte for byte, canaries included: those files are not the family, and the
    // Vehicles and Login panes read them as they always have.
    expect(await storedRows()).toEqual(before);
  });

  it('narrows EVERY entry of the spec table, not the two session files', async () => {
    const rows = NEW_DATA_SPEC_FILES.map((spec, index) => legacySpecRow(spec, index));
    await seed(rows, [], null);
    const before = await storedRows();
    expect(before).toHaveLength(NEW_DATA_SPEC_FILES.length);

    expect(await narrow()).toBe(NEW_DATA_SPEC_FILES.length);

    const after = await storedRows();
    expect(after).toHaveLength(NEW_DATA_SPEC_FILES.length);
    const serialised = JSON.stringify(after);
    expect(serialised).not.toContain(CANARY_EMAIL);
    expect(serialised).not.toContain(CANARY_NICKNAME);
    expect(serialised).not.toContain('__parsed_extra');
  });

  it('leaves no canary anywhere in db.rows after narrowing', async () => {
    await seed(
      [
        ...NEW_DATA_SPEC_FILES.map((spec, index) => legacySpecRow(spec, index)),
        legacyRow('Player_Statistics', 'HEAT_Device_Info.csv', 0, { EMAIL: CANARY_EMAIL }),
        legacyRow('Activity_History', 'WOTC_Game_Sessions.csv', 0, {
          STARTED_AT: '07.03.2024 18:00',
          EMAIL: CANARY_EMAIL,
        }),
      ],
      [],
      null,
    );

    await narrow();

    const serialised = JSON.stringify(await storedRows());
    // The WOTC row is a family file, so its canary goes too; a canary that
    // survived would mean the sweep visited keys rather than rows.
    expect(serialised).not.toContain(CANARY_EMAIL);
    expect(serialised).not.toContain(CANARY_NICKNAME);
  });
});

// -----------------------------------------------------------------------------
// The facts
// -----------------------------------------------------------------------------

describe('11-04 — the presence facts follow the rows', () => {
  it('rewrites rowCount to the stored count and parsedRowCount to the old rowCount', async () => {
    await seed(
      [legacySpecRow(specOf('heat_account_statistics.csv'), 0)],
      [legacyFact('heat_account_statistics.csv', 5)],
      null,
    );

    expect(await narrow()).toBe(1);

    const fact = (await activeMeta()).files?.[0];
    expect(fact?.rowCount).toBe(1);
    // The old `rowCount` is what the file PARSED to, so a fact that predates
    // this plan is not lost — it is re-read as the parsed half.
    expect(fact?.parsedRowCount).toBe(5);
  });

  it('keeps a parsedRowCount a newer import already wrote', async () => {
    await seed(
      [legacySpecRow(specOf('heat_account_statistics.csv'), 0)],
      [{ ...legacyFact('heat_account_statistics.csv', 3), parsedRowCount: 9 }],
      null,
    );

    await narrow();

    const fact = (await activeMeta()).files?.[0];
    expect(fact?.rowCount).toBe(1);
    expect(fact?.parsedRowCount).toBe(9);
  });

  it('rewrites the per-account list too, and leaves a deleted file at zero', async () => {
    const accounts: AccountMeta[] = [
      {
        root: NG_ROOT_A,
        categories: CATEGORIES,
        identity: null,
        files: [
          legacyFact('heat_account_statistics.csv', 2),
          legacyFact('heat_device_info.csv', 3),
        ],
        games: [],
        firstYear: null,
        lastYear: null,
      },
    ];
    await seed(
      [
        legacySpecRow(specOf('heat_account_statistics.csv'), 0),
        legacyRow('Player_Statistics', 'HEAT_Device_Info.csv', 0, { EMAIL: CANARY_EMAIL }),
      ],
      [legacyFact('heat_account_statistics.csv', 2), legacyFact('heat_device_info.csv', 3)],
      accounts,
    );

    expect(await narrow()).toBe(2);

    const meta = await activeMeta();
    const perAccount = meta.accounts?.[0]?.files ?? [];
    expect(perAccount.find((f) => f.sourceFile === 'heat_account_statistics.csv')).toMatchObject({
      rowCount: 1,
      parsedRowCount: 2,
    });
    // A file whose rows were all deleted is reported as present and empty, which
    // is the state D-09's `parsedRowCount > 0 && rowCount === 0` exists for.
    expect(perAccount.find((f) => f.sourceFile === 'heat_device_info.csv')).toMatchObject({
      rowCount: 0,
      parsedRowCount: 3,
    });
    // The flattened list is the accounts' own facts, so it says the same.
    expect(meta.files).toEqual(perAccount);
  });

  it('leaves every OTHER part of the meta record byte for byte alone', async () => {
    const identity = { nickname: 'player', region: 'eu', createdAt: '01.03.2015' };
    await seed(
      [legacySpecRow(specOf('heat_account_statistics.csv'), 0)],
      [legacyFact('heat_account_statistics.csv', 4)],
      null,
    );
    const { db } = await importWorkerDb();
    await db.meta.update('active', { identity });
    const before = await activeMeta();

    await narrow();

    const after = await activeMeta();
    expect(after.hash).toBe(before.hash);
    expect(after.accountRoot).toBe(before.accountRoot);
    expect(after.importedAt).toBe(before.importedAt);
    expect(after.categories).toEqual(before.categories);
    expect(after.identity).toEqual(identity);
  });
});

// -----------------------------------------------------------------------------
// Idempotence and the schema
// -----------------------------------------------------------------------------

describe('11-04 — narrowing is idempotent and is not a migration', () => {
  it('changes nothing on a second run and returns 0', async () => {
    await seed(
      [
        ...NEW_DATA_SPEC_FILES.map((spec, index) => legacySpecRow(spec, index)),
        legacyRow('Player_Statistics', 'HEAT_Device_Info.csv', 0, { EMAIL: CANARY_EMAIL }),
      ],
      [legacyFact('heat_account_statistics.csv', 5), legacyFact('heat_device_info.csv', 1)],
      null,
    );

    expect(await narrow()).toBeGreaterThan(0);
    const rowsAfterFirst = await storedRows();
    const metaAfterFirst = await activeMeta();

    expect(await narrow()).toBe(0);
    expect(await narrow()).toBe(0);
    expect(await storedRows()).toEqual(rowsAfterFirst);
    // The meta record is not rewritten either: an idempotent run writes nothing.
    expect(await activeMeta()).toEqual(metaAfterFirst);
  });

  it('is a no-op on an empty database', async () => {
    await expect(narrow()).resolves.toBe(0);
    const { db } = await importWorkerDb();
    expect(await db.rows.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
  });

  it('is a no-op on a database with no family rows at all', async () => {
    await seed(
      [legacyRow('Activity_History', 'WOT_Game_Sessions.csv', 0, { STARTED_AT: 'x' })],
      [legacyFact('WOT_Game_Sessions.csv', 1, 'Activity_History')],
      null,
    );
    const before = await activeMeta();

    expect(await narrow()).toBe(0);
    expect(await activeMeta()).toEqual(before);
  });

  it('adds NO Dexie version', async () => {
    const { db } = await importWorkerDb();
    expect(db.verno).toBe(2);
  });
});

// -----------------------------------------------------------------------------
// Through the worker: the replay a returning reader actually sees
// -----------------------------------------------------------------------------

describe('11-04 — a returning reader gets the narrowed facts on load', () => {
  it('answers cache-status with pane counts that already reflect the narrowing', async () => {
    // Four HEAT pane files, one legacy row each, and facts claiming five rows
    // apiece — the shape a v1.1 cache holds. The pane facts the page reads must
    // be the narrowed ones, not the stored claims.
    const paneFiles = [
      'heat_account_statistics.csv',
      'heat_battle_types_statistics.csv',
      'heat_account_storage.csv',
    ];
    await seed(
      [
        ...paneFiles.map((key, index) => legacySpecRow(specOf(key), index)),
        legacyRow('Activity_History', 'HEAT_Session_Geolocation.csv', 0, { IP: '203.0.113.7' }),
      ],
      [
        ...paneFiles.map((key) => legacyFact(key, 5)),
        legacyFact('heat_session_geolocation.csv', 5, 'Activity_History'),
      ],
      null,
    );

    postRequest({ type: 'check-cache', jobId: 7 });
    const status = await waitForMessage(post, 'cache-status');
    if (status.type !== 'cache-status') throw new Error('expected cache-status');

    expect(status.cached?.newDataPanes).toEqual({ heat: { fileCount: 4, rowCount: 4 } });
    const serialised = JSON.stringify(await storedRows());
    expect(serialised).not.toContain(CANARY_EMAIL);
    expect(serialised).not.toContain(CANARY_NICKNAME);
  });

  it('still answers a cache-status for a cache with no family rows', async () => {
    await seed(
      [legacyRow('Activity_History', 'WOT_Game_Sessions.csv', 0, { STARTED_AT: 'x' })],
      [],
      null,
    );

    postRequest({ type: 'check-cache', jobId: 8 });
    const status = await waitForMessage(post, 'cache-status');
    if (status.type !== 'cache-status') throw new Error('expected cache-status');
    expect(status.cached?.newDataPanes).toEqual({});
  });
});

// -----------------------------------------------------------------------------
// Helpers that read the spec table
// -----------------------------------------------------------------------------

/** One spec by its key, or a failure naming the key. */
function specOf(key: string): SpecFile {
  const spec = NEW_DATA_SPEC_FILES.find((candidate) => candidate.key === key);
  if (spec === undefined) throw new Error(`no spec for ${key} — is 11-03's table complete?`);
  return spec;
}
