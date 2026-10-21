// =============================================================================
// account-timeline-legacy.test.ts — a v1.0-era cache meets the promoted folders
// (12-07, D-03)
// =============================================================================
//
// WHAT THIS PROVES.
//
// A returning user's IndexedDB cache was written by a build in which Bans,
// Bonus_Codes, Personal_Coupons, Subscriptions, Authorized_Third_Parties and
// Surveys were NOT supported, so their raw rows (IPs, codes, answers, possibly
// emails) were stored in full. Promoting those folders is exactly what makes the
// D-21 purge stop deleting them: the purge only removes categories that are not
// supported. The name-based half of `narrowStoredNewDataRows` does not see them
// either, because an unlisted file name is not a family name. The category walk
// added by 12-07 closes the hole, and this file proves it through the REAL
// worker's `check-cache`, the one entry a returning cache goes through.
//
// The rows are SEEDED straight into Dexie in the v1.0 shape (no `account`
// field), after a small real import has created the meta record, because an
// import would run the current allowlist and write the narrow shape — a test
// that imported could not tell the narrowing from the import. Every canary is a
// synthetic `.example.invalid` / TEST-NET / made-up string, and the sweeps search
// the whole serialised `db.rows` and meta record, so "gone" is a claim about the
// STORED TABLE.
//
// Plan 12-08 extends this file with the projections of the nine specs'd
// families (the last describe): a legacy raw row of each, with extra columns
// and an email in an allowlisted cell, narrowed once and idempotently.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifyFolder } from '../../../src/lib/worker/categories.ts';
import type { AccountMeta, DatasetFile, DatasetRow } from '../../../src/lib/worker/db.ts';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  waitForMessage,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';
import { NEW_DATA_SPEC_FILES } from '../../../src/lib/worker/new-data-specs.ts';
import { CAPTURED_FILES } from '../../fixtures/new-data-headers.ts';
import { zipSync } from '../../fixtures/pinned-zip.ts';

const ROOT = '123456789';
const ROOT_B = '987654321';

/** One canary per kind of cell a v1.0 build stored in these folders. */
const EMAIL_CANARY = 'legacy-promoted@legacy.example.invalid';
const IP_CANARY = '198.51.100.77';
const CODE_CANARY = 'LEGACY-CODE-7Q2X-9Z41';
const PROFILE_CANARY = 'legacy-profile-id-5521';
const ANSWER_CANARY = 'legacy free-text answer 8830';
const FORUM_CANARY = 'legacy-forum@legacy.example.invalid';
const ALL_CANARIES = [
  EMAIL_CANARY,
  IP_CANARY,
  CODE_CANARY,
  PROFILE_CANARY,
  ANSWER_CANARY,
  FORUM_CANARY,
] as const;

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
// Helpers
// -----------------------------------------------------------------------------

/** A small real import: it creates the meta record every later step needs. */
async function importSmallArchive(): Promise<void> {
  const bytes = zipSync({
    [`${ROOT}/User_Info/Account_Info.csv`]: new TextEncoder().encode(
      `ID;NAME\r\n${ROOT};Synthetic Tanker\r\n`,
    ),
  });
  post.mockClear();
  const terminal = await ingestExport(post, bytes, 'legacy-base.zip');
  if (terminal.type !== 'done') throw new Error(`base import ended ${terminal.type}, not done`);
}

/** Run the returning-visit cache read through the real worker. */
async function checkCache(jobId = 7): Promise<void> {
  post.mockClear();
  postRequest({ type: 'check-cache', jobId });
  const status = await waitForMessage(post, 'cache-status');
  if (status.type !== 'cache-status') throw new Error('expected cache-status');
}

/** A v1.0-shaped row: no `account` field. */
function legacyRow(
  category: string,
  sourceFile: string,
  rowIndex: number,
  data: Record<string, string | undefined>,
  account?: string,
): DatasetRow {
  return account === undefined
    ? { category, sourceFile, rowIndex, data }
    : { category, sourceFile, rowIndex, data, account };
}

/** Add rows straight into the worker's Dexie. */
async function addRows(rows: DatasetRow[]): Promise<void> {
  const { db } = await importWorkerDb();
  await db.rows.bulkAdd(rows);
}

/** Replace the presence facts in BOTH lists that hold them. */
async function setFacts(files: DatasetFile[]): Promise<void> {
  const { db } = await importWorkerDb();
  const meta = await db.meta.get('active');
  if (meta === undefined) throw new Error('no active meta record');
  const accounts = (meta.accounts ?? []) as AccountMeta[];
  await db.meta.put({
    ...meta,
    files,
    accounts: accounts.map((account) => ({
      ...account,
      files: files.filter((file) => (file.account ?? meta.accountRoot) === account.root),
    })),
  });
}

async function storedRows(): Promise<DatasetRow[]> {
  const { db } = await importWorkerDb();
  return (await db.rows.toArray()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

async function storedMeta() {
  const { db } = await importWorkerDb();
  const meta = await db.meta.get('active');
  if (meta === undefined) throw new Error('no active meta record');
  return meta;
}

/** Rows and meta as one searchable string. */
async function dumpEverything(): Promise<string> {
  return JSON.stringify({ rows: await storedRows(), meta: await storedMeta() });
}

function rowsOf(rows: readonly DatasetRow[], sourceFile: string): DatasetRow[] {
  return rows.filter((row) => row.sourceFile === sourceFile);
}

// The legacy rows, one per promoted category plus the controls.
const SURVEY_ROWS: DatasetRow[] = [0, 1, 2].map((index) =>
  legacyRow('Surveys', 'HEAT_Surveys.csv', index, {
    QUESTION_ID: `q${index}`,
    SKIPPED_BY_PLAYER: 'False',
    MESSAGE_TS: '2024-03-0' + (index + 1) + ' 10:00:00',
    PROFILE_ID: PROFILE_CANARY,
    // 12-08: the rating is allowlisted now (the user stated it is an enumerated
    // rating), so a legacy row keeps it. The free-text canary lives in the
    // unlisted file and the drifted copy below, which still store nothing.
    PLAYER_ANSWER: '4',
  }),
);

const UNSPECCED_ROWS: DatasetRow[] = [
  legacyRow('Bans', 'Ban_History.csv', 0, { BAN_IP: IP_CANARY, BAN_NOTE: EMAIL_CANARY }),
  legacyRow('Bans', 'Ban_History.csv', 1, { BAN_IP: IP_CANARY, BAN_NOTE: 'x' }),
  legacyRow('Subscriptions', 'Subscription_List.csv', 0, { CONTACT: EMAIL_CANARY }),
  legacyRow('Bonus_Codes', 'Bonus_Code_List.csv', 0, { CODE: CODE_CANARY }),
  legacyRow('Personal_Coupons', 'Coupon_List.csv', 0, { COUPON: CODE_CANARY }),
  legacyRow('Authorized_Third_Parties', 'Third_Party_List.csv', 0, {
    THIRD_PARTY: 'partner',
    CONTACT: EMAIL_CANARY,
  }),
  legacyRow('Surveys', 'Unlisted_Survey.csv', 0, { ANSWER: ANSWER_CANARY, IP: IP_CANARY }),
];

const FORUM_ROW = legacyRow('Game_Forums', 'WOT_Forum_User_Info.csv', 0, {
  EMAIL: FORUM_CANARY,
  IP_ADDRESS: IP_CANARY,
});

const PAYMENT_ROW = legacyRow('Payment_history', 'Payment_history.csv', 0, {
  AMOUNT: '9.99',
  CURRENCY: 'EUR',
});

/** Seed the whole legacy cache and the v1.0-shaped facts that describe it. */
async function seedLegacyCache(): Promise<void> {
  await importSmallArchive();
  await addRows([...SURVEY_ROWS, ...UNSPECCED_ROWS, FORUM_ROW, PAYMENT_ROW]);
  await setFacts([
    // No `account` and no `parsedRowCount`: exactly what v1.0 wrote.
    { category: 'Surveys', sourceFile: 'HEAT_Surveys.csv', rowCount: 3 },
    { category: 'Surveys', sourceFile: 'Unlisted_Survey.csv', rowCount: 1 },
    { category: 'Bans', sourceFile: 'Ban_History.csv', rowCount: 2 },
  ]);
}

// -----------------------------------------------------------------------------
// The tests
// -----------------------------------------------------------------------------

describe('12-07: a v1.0-era cache is narrowed on the next check-cache', () => {
  it('the seed is non-vacuous: every canary really sits at rest before the check', async () => {
    await seedLegacyCache();
    const dump = await dumpEverything();
    for (const canary of ALL_CANARIES) expect(dump, canary).toContain(canary);
    // And the controls are what the test says they are.
    expect(classifyFolder('Payment_history')).toBe('supported');
    expect(classifyFolder('Game_Forums')).toBe('unknown');
  });

  it('deletes the five unspecced categories and the unlisted Surveys file', async () => {
    await seedLegacyCache();
    await checkCache();

    const rows = await storedRows();
    for (const category of [
      'Bans',
      'Subscriptions',
      'Bonus_Codes',
      'Personal_Coupons',
      'Authorized_Third_Parties',
    ]) {
      expect(
        rows.filter((row) => row.category === category),
        category,
      ).toHaveLength(0);
    }
    expect(rowsOf(rows, 'Unlisted_Survey.csv')).toHaveLength(0);
  });

  it('narrows HEAT_Surveys.csv to its four spec keys and keeps the values', async () => {
    await seedLegacyCache();
    await checkCache();

    const surveys = rowsOf(await storedRows(), 'HEAT_Surveys.csv');
    expect(surveys).toHaveLength(3);
    for (const [index, row] of surveys.entries()) {
      expect(Object.keys(row.data).sort()).toEqual(
        ['MESSAGE_TS', 'PLAYER_ANSWER', 'QUESTION_ID', 'SKIPPED_BY_PLAYER'].sort(),
      );
      expect(row.data['QUESTION_ID']).toBe(`q${index}`);
      expect(row.data['PLAYER_ANSWER']).toBe('4');
      expect(row.data['SKIPPED_BY_PLAYER']).toBe('False');
      // The row stays the same row: identity fields survive the rewrite.
      expect(row.rowIndex).toBe(index);
      expect(row.category).toBe('Surveys');
    }
  });

  it('leaves no canary in the rows or the meta record, and no Game_Forums row', async () => {
    await seedLegacyCache();
    await checkCache();

    const dump = await dumpEverything();
    for (const canary of ALL_CANARIES) expect(dump, canary).not.toContain(canary);
    expect((await storedRows()).filter((row) => row.category === 'Game_Forums')).toHaveLength(0);
  });

  it('leaves the Payment_history row byte-identical', async () => {
    await seedLegacyCache();
    const before = rowsOf(await storedRows(), 'Payment_history.csv');
    expect(before).toHaveLength(1);

    await checkCache();

    expect(JSON.stringify(rowsOf(await storedRows(), 'Payment_history.csv'))).toBe(
      JSON.stringify(before),
    );
  });

  it('rewrites the presence facts so counts agree with the rows', async () => {
    await seedLegacyCache();
    await checkCache();

    const meta = await storedMeta();
    const flat = meta.files ?? [];
    const survey = flat.find((file) => file.sourceFile === 'HEAT_Surveys.csv');
    expect(survey?.rowCount).toBe(3);
    // The count it PARSED to: an absent field on a v1.0 fact reads as its old
    // rowCount.
    expect(survey?.parsedRowCount).toBe(3);

    // A seeded fact of a deleted group says nothing is stored, and still says
    // how many rows the file held.
    const unlisted = flat.find((file) => file.sourceFile === 'Unlisted_Survey.csv');
    expect(unlisted?.rowCount).toBe(0);
    expect(unlisted?.parsedRowCount).toBe(1);
    const bans = flat.find((file) => file.sourceFile === 'Ban_History.csv');
    expect(bans?.rowCount).toBe(0);
    expect(bans?.parsedRowCount).toBe(2);

    // The per-account list agrees with the flat one.
    const account = (meta.accounts ?? []).find((candidate) => candidate.root === ROOT);
    expect(account?.files.find((file) => file.sourceFile === 'Ban_History.csv')?.rowCount).toBe(0);
    expect(account?.files.find((file) => file.sourceFile === 'HEAT_Surveys.csv')?.rowCount).toBe(3);
  });

  it('is idempotent: a second check-cache changes no row and no fact', async () => {
    await seedLegacyCache();
    await checkCache();
    const rowsAfterFirst = await storedRows();
    const metaAfterFirst = await storedMeta();

    await checkCache(8);

    expect(await storedRows()).toEqual(rowsAfterFirst);
    expect(await storedMeta()).toEqual(metaAfterFirst);
  });

  it('keeps the Dexie schema at version 2 — narrowing is a data step, not a migration', async () => {
    await seedLegacyCache();
    await checkCache();
    const { db } = await importWorkerDb();
    expect(db.verno).toBe(2);
  });

  it('deletes only the drifted account: a sibling account keeps its good rows', async () => {
    await importSmallArchive();
    await addRows([
      legacyRow(
        'Surveys',
        'HEAT_Surveys.csv',
        0,
        {
          QUESTION_ID: 'good',
          SKIPPED_BY_PLAYER: 'True',
          MESSAGE_TS: '2024-01-01 00:00:00',
          PROFILE_ID: PROFILE_CANARY,
        },
        ROOT,
      ),
      // The drifted copy: headers that match no column of the spec.
      legacyRow(
        'Surveys',
        'HEAT_Surveys.csv',
        0,
        { DRIFTED_A: ANSWER_CANARY, DRIFTED_B: IP_CANARY },
        ROOT_B,
      ),
    ]);

    await checkCache();

    const rows = rowsOf(await storedRows(), 'HEAT_Surveys.csv');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.account).toBe(ROOT);
    expect(rows[0]?.data).toEqual({
      QUESTION_ID: 'good',
      SKIPPED_BY_PLAYER: 'True',
      MESSAGE_TS: '2024-01-01 00:00:00',
    });
    const dump = await dumpEverything();
    expect(dump).not.toContain(ANSWER_CANARY);
    expect(dump).not.toContain(PROFILE_CANARY);
  });

  it('narrows nothing and returns 0 when there is no meta record', async () => {
    const { db, narrowStoredNewDataRows } = await importWorkerDb();
    await db.rows.clear();
    await db.meta.clear();
    await db.rows.bulkAdd([...SURVEY_ROWS, ...UNSPECCED_ROWS]);
    const before = await storedRows();

    expect(await narrowStoredNewDataRows()).toBe(0);

    expect(await storedRows()).toEqual(before);
  });
});

// -----------------------------------------------------------------------------
// 12-08: the nine specs'd Phase 12 files
// -----------------------------------------------------------------------------

/** The nine Phase 12 files: the spec flags say which, the first test pins the count. */
const PHASE12_SPECS = NEW_DATA_SPEC_FILES.filter((spec) => spec.emailGuard === true);

/** The email planted as the value of the FIRST allowlisted cell of each legacy row. */
function plantedLegacyEmail(key: string): string {
  return `legacy-${key.replace(/[^a-z0-9]+/gi, '-')}@legacy.example.invalid`;
}

/**
 * A v1.0-shaped raw row of one spec'd file: every allowlisted column with a
 * clean value, the FIRST one replaced by an email, plus raw columns no spec
 * names (an address, a free-text note, an identifier) and an overflow array.
 */
function legacyPhase12Row(key: string): DatasetRow {
  const spec = PHASE12_SPECS.find((candidate) => candidate.key === key);
  const captured = CAPTURED_FILES.find((entry) => entry.key === key);
  if (spec === undefined || captured === undefined) throw new Error(`no spec or capture: ${key}`);
  const data: Record<string, string | undefined> = {};
  spec.columns.forEach((column, index) => {
    data[column.id] = index === 0 ? plantedLegacyEmail(key) : `clean-${column.id}`;
  });
  data['RAW_NOTE_COLUMN'] = `free text ${PROFILE_CANARY}`;
  data['RAW_ADDRESS_COLUMN'] = IP_CANARY;
  data['__parsed_extra'] = ['surplus-cell'] as unknown as string;
  return legacyRow(captured.folder, captured.fileName, 0, data);
}

describe('12-08: a legacy raw row of every spec file is narrowed in place, idempotently', () => {
  it('covers exactly the nine Phase 12 files, including the three history files', () => {
    expect(PHASE12_SPECS.map((spec) => spec.key).sort()).toEqual([
      'account_name_history.csv',
      'authorized_third_parties.csv',
      'bans.csv',
      'bonus_code_usage.csv',
      'external_services_history.csv',
      'heat_surveys.csv',
      'language_and_country_history.csv',
      'personal_coupons.csv',
      'subscriptions.csv',
    ]);
  });

  it('the seed is non-vacuous: the planted email and the raw columns sit at rest', async () => {
    await importSmallArchive();
    await addRows(PHASE12_SPECS.map((spec) => legacyPhase12Row(spec.key)));

    const dump = await dumpEverything();
    for (const spec of PHASE12_SPECS)
      expect(dump, spec.key).toContain(plantedLegacyEmail(spec.key));
    expect(dump).toContain(IP_CANARY);
    expect(dump).toContain('surplus-cell');
  });

  it.each(PHASE12_SPECS.map((spec) => spec.key))(
    '%s is narrowed to its spec keys, with the email cell absent, by one check-cache',
    async (key) => {
      await importSmallArchive();
      await addRows(PHASE12_SPECS.map((spec) => legacyPhase12Row(spec.key)));

      await checkCache();

      const spec = PHASE12_SPECS.find((candidate) => candidate.key === key)!;
      const captured = CAPTURED_FILES.find((entry) => entry.key === key)!;
      const rows = rowsOf(await storedRows(), captured.fileName);
      expect(rows, key).toHaveLength(1);
      const ids = spec.columns.map((column) => column.id);
      // Every allowlisted key but the first (the email) survives; nothing else does.
      expect(Object.keys(rows[0]!.data).sort(), key).toEqual(ids.slice(1).sort());
      for (const id of ids.slice(1)) expect(rows[0]!.data[id], `${key} ${id}`).toBe(`clean-${id}`);
      // The row stays the same row.
      expect(rows[0]!.category).toBe(captured.folder);
      expect(rows[0]!.rowIndex).toBe(0);
    },
  );

  it('leaves no planted email, address or surplus cell anywhere after one check-cache', async () => {
    await importSmallArchive();
    await addRows(PHASE12_SPECS.map((spec) => legacyPhase12Row(spec.key)));

    await checkCache();

    const dump = await dumpEverything();
    for (const spec of PHASE12_SPECS) {
      expect(dump, spec.key).not.toContain(plantedLegacyEmail(spec.key));
    }
    expect(dump).not.toContain(IP_CANARY);
    expect(dump).not.toContain(PROFILE_CANARY);
    expect(dump).not.toContain('surplus-cell');
    // The base import's Account_Info row is untouched by the history narrowing.
    expect(dump).toContain('Synthetic Tanker');
  });

  it('is idempotent: a second check-cache changes no row and no fact', async () => {
    await importSmallArchive();
    await addRows(PHASE12_SPECS.map((spec) => legacyPhase12Row(spec.key)));

    await checkCache();
    const rowsAfterFirst = await storedRows();
    const metaAfterFirst = await storedMeta();

    await checkCache(8);

    expect(await storedRows()).toEqual(rowsAfterFirst);
    expect(await storedMeta()).toEqual(metaAfterFirst);
  });
});
