// =============================================================================
// perks-worker.test.ts — the Surveys slice, end to end through the real worker
// =============================================================================
//
// WHAT THIS PROVES, in one line: a `Surveys` file goes through the per-file
// column allowlist at the worker's row choke point, lands in Dexie under the
// three spec keys only, is answered by the new `perks` channel as four ordered
// cards, and shows up as a pane fact — and everything the phase promises about
// NOT storing is proved by planting a canary and looking for it at rest.
//
// The archive is built HERE rather than in a shared fixture, on purpose. The
// canaries are the point of the test, and a canary planted in a shared fixture
// is a canary three other suites also depend on: changing it would break
// them, and a suite that breaks with it is a suite that cannot be trusted to
// notice a real leak. Here every string is hand-typed and every expected value
// is hand-typed too — never computed by the code under test.
//
// The four states of D-09 are all exercised, because the perks channel is the
// first channel to answer all four for a file whose header may drift:
//
//   stored rows        -> `ready`
//   rows, none stored  -> `skipped`
//   a header and no rows -> `no-rows`
//   no file at all     -> `not-in-export`
// =============================================================================

import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DataQuery } from '../../../src/lib/core/types/worker-messages.ts';
import {
  NEW_DATA_PANE_IDS,
  PERKS_CARD_IDS,
  type NewDataCardView,
  type NewDataPaneId,
  type PerksView,
} from '../../../src/lib/features/new-data/new-data-shared.ts';
import { isDataQuery } from '../../../src/lib/worker/data-queries.ts';
import { paneEntries } from '../../../src/lib/shell/selection-state.ts';
import { formatRowCount } from '../../../src/lib/ui-copy.ts';
import { NEW_DATA_SPEC_FILES } from '../../../src/lib/worker/new-data-specs.ts';
import { CAPTURED_FILES, headersOf } from '../../fixtures/new-data-headers.ts';
import { zipSync } from '../../fixtures/pinned-zip.ts';
import {
  PK_ADDRESS_CANARY,
  PK_BATTLE_CANARY,
  PK_CANARIES,
  PK_CODE_CANARY,
  PK_EMAIL_ANSWER,
  PK_EMAIL_STATUS,
  PK_EMAIL_SUBSCRIBED,
  PK_EMAIL_USER_IP,
  PK_EXPECTED,
  PK_NICKNAME_CANARY,
  PK_PROFILE_CANARY,
  PK_ROOT_A,
  buildPerksThreeAccountExport,
  pkFileKey,
  type PkCardId,
  type PkExpectedRow,
} from '../../fixtures/perks-fixtures.ts';
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

const WAIT_MS = 5_000;

/** The account root of the archive: a numeric folder name, as a real export has. */
const ROOT = '620000001';

// ---------------------------------------------------------------------------
// The archive, hand-typed
// ---------------------------------------------------------------------------

/**
 * The captured header of `HEAT_Surveys.csv`, in the capture's own order.
 *
 * Six columns, and the spec names FOUR of them since plan 12-08 (the rating
 * `PLAYER_ANSWER` is allowlisted). In this fixture that cell holds an email, so
 * the value-level email guard drops it and each stored row still has three keys;
 * `PROFILE_ID` and `BATTLE_ID` are the two excluded columns and carry the other
 * canaries.
 */
const SURVEY_HEADER = 'PROFILE_ID,BATTLE_ID,QUESTION_ID,PLAYER_ANSWER,SKIPPED_BY_PLAYER,MESSAGE_TS';

/** The three canaries: a profile id, a battle id and an email address. */
const PROFILE_CANARY = 'CANARY-PROFILE-0001';
const BATTLE_CANARY = 'CANARY-BATTLE-0001';
const EMAIL_CANARY = 'canary-survey@example.invalid';

/** Every canary the assertions below look for at rest. */
const CANARIES: readonly string[] = [PROFILE_CANARY, BATTLE_CANARY, EMAIL_CANARY];

/**
 * Three body rows: literal question ids, literal flags, literal stamps.
 *
 * The question ids are the numbers a reader would see (`1001`, `1002`,
 * `1003`), the flags are `true`/`false` as the export writes them, and the
 * stamps are the export's own `DD.MM.YYYY HH:MM` shape (D-01). Nothing here is
 * derived from the code under test.
 */
const SURVEY_ROWS: readonly string[] = [
  'CANARY-PROFILE-0001,CANARY-BATTLE-0001,1001,canary-survey@example.invalid,false,05.03.2024 20:00',
  'CANARY-PROFILE-0002,CANARY-BATTLE-0002,1002,canary-survey@example.invalid,true,06.03.2024 21:30',
  'CANARY-PROFILE-0003,CANARY-BATTLE-0003,1003,canary-survey@example.invalid,false,07.03.2024 22:45',
];

/** The whole Surveys file, header and three rows. */
const SURVEYS_CSV = [SURVEY_HEADER, ...SURVEY_ROWS].join('\n');

/** A file in the Surveys folder whose NAME no pattern knows. */
const UNLISTED_CSV = [
  'QUESTION_ID,NOTE',
  '1001,an unlisted file',
  '1002,another unlisted row',
].join('\n');

/** A Surveys file whose headers match no allowlisted column. */
const DRIFTED_CSV = ['DRIFTED_ALPHA,DRIFTED_BETA', 'x,y', 'z,w'].join('\n');

/** A Surveys file that is a header and nothing else. */
const HEADER_ONLY_CSV = `${SURVEY_HEADER}\n`;

/** One archive: `Folder/File.csv -> body` pairs under {@link ROOT}. */
function archiveOf(entries: Readonly<Record<string, string>>): Uint8Array {
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  return zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([path, body]) => [`${ROOT}/${path}`, encode(body)]),
    ),
  );
}

/** The archive this file is mostly about: the one Surveys file, three rows. */
function surveysArchive(): Uint8Array {
  return archiveOf({ 'Surveys/HEAT_Surveys.csv': SURVEYS_CSV });
}

// ---------------------------------------------------------------------------
// The worker
// ---------------------------------------------------------------------------

let post: WorkerPostSpy;
let nextQueryId = 500;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/** Ingest one archive and fail loudly unless the import finished `done`. */
async function ingest(bytes: Uint8Array, name: string) {
  post.mockClear();
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type, `ingest of ${name}`).toBe('done');
  if (terminal.type !== 'done') throw new Error('expected done');
  return terminal.result;
}

/** Every stored row of one file name, as written. */
async function storedRows(sourceFile: string): Promise<Record<string, unknown>[]> {
  const { db } = await importWorkerDb();
  const all = await db.rows.toArray();
  return all
    .filter((row) => row.sourceFile === sourceFile)
    .map((row) => row.data as Record<string, unknown>);
}

/** The JSON of everything at rest: every row and the active meta record. */
async function everythingAtRest(): Promise<string> {
  const { db } = await importWorkerDb();
  return JSON.stringify([await db.rows.toArray(), (await db.meta.get('active')) ?? null]);
}

/** Ask one query and return the posted reply's view. */
async function ask(query: DataQuery): Promise<unknown> {
  post.mockClear();
  postRequest({ type: 'data-query', queryId: nextQueryId++, query });
  const reply = await waitForMessage(post, 'data-result', WAIT_MS);
  if (reply.type !== 'data-result') throw new Error('expected data-result');
  if (reply.result === null) throw new Error('expected a result');
  expect(reply.result.channel).toBe(query.channel);
  return reply.result.view;
}

/** Ask the perks channel and return its view. */
async function askPerks(): Promise<PerksView> {
  return (await ask({ channel: 'perks' })) as PerksView;
}

/** The ready card, or a failure naming the card that was not ready. */
function ready(card: NewDataCardView, id: string) {
  if (card.status !== 'ready') throw new Error(`expected ${id} ready, got ${card.status}`);
  return card;
}

// ---------------------------------------------------------------------------
// The validator
// ---------------------------------------------------------------------------

describe('the perks channel is a strict field-less query (T-12-06)', () => {
  it('accepts a bare query and rejects a smuggled title, battleType or other field', () => {
    expect(isDataQuery({ channel: 'perks' })).toBe(true);
    expect(isDataQuery({ channel: 'perks', title: 'wot' })).toBe(false);
    expect(isDataQuery({ channel: 'perks', title: null })).toBe(false);
    expect(isDataQuery({ channel: 'perks', battleType: null })).toBe(false);
    expect(isDataQuery({ channel: 'perks', battleType: 'x' })).toBe(false);
    // Any other field at all: the query is a question with ONE answer, and a
    // field this code does not understand is rejected rather than ignored.
    expect(isDataQuery({ channel: 'perks', rows: 3 })).toBe(false);
    expect(isDataQuery({ channel: 'perks', queryId: 1 })).toBe(false);
  });

  it('answers a malformed perks query with the fixed invalid query detail', async () => {
    postRequest({
      type: 'data-query',
      queryId: 7,
      query: { channel: 'perks', title: 'wot' } as unknown as DataQuery,
    });
    const reply = await waitForMessage(post, 'data-error', WAIT_MS);
    if (reply.type !== 'data-error') throw new Error('expected data-error');
    // FIXED, and the same for every malformed shape: the detail never echoes
    // the message that failed the check.
    expect(reply.detail).toBe('invalid query');
  });
});

// ---------------------------------------------------------------------------
// What reaches IndexedDB
// ---------------------------------------------------------------------------

describe('the worker: a Surveys file is stored through the allowlist only', () => {
  it('stores three rows under the three spec keys, and nothing else', async () => {
    await ingest(surveysArchive(), 'surveys.zip');

    const rows = await storedRows('HEAT_Surveys.csv');
    expect(rows.length).toBe(3);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['MESSAGE_TS', 'QUESTION_ID', 'SKIPPED_BY_PLAYER']);
    }
  });

  it('keeps an allowlisted value and drops every excluded one', async () => {
    await ingest(surveysArchive(), 'surveys.zip');

    const rows = await storedRows('HEAT_Surveys.csv');
    expect(rows[0]!['QUESTION_ID']).toBe('1001');
    expect(rows[0]!['SKIPPED_BY_PLAYER']).toBe('false');
    expect(rows[0]!['MESSAGE_TS']).toBe('05.03.2024 20:00');
    expect(rows[1]!['SKIPPED_BY_PLAYER']).toBe('true');
    expect(rows[2]!['QUESTION_ID']).toBe('1003');
  });

  it('leaves no canary anywhere in the stored rows or the stored meta', async () => {
    await ingest(surveysArchive(), 'surveys.zip');

    const haystack = await everythingAtRest();
    for (const canary of CANARIES) {
      expect(haystack, `${canary} reached storage`).not.toContain(canary);
    }
  });

  it('the fixture really does carry the canaries the assertions rule out', async () => {
    // Without this, every negative assertion above would pass against a build
    // that stored the whole row, because the input would have nothing to store.
    for (const canary of CANARIES) expect(SURVEYS_CSV).toContain(canary);
  });
});

// ---------------------------------------------------------------------------
// The category-scoped family rule
// ---------------------------------------------------------------------------

describe('the worker: every file in the Surveys folder fails closed', () => {
  it('stores NOTHING for a file whose name the name patterns do not know', async () => {
    await ingest(
      archiveOf({
        'Surveys/HEAT_Surveys.csv': SURVEYS_CSV,
        'Surveys/Extra_Unlisted.csv': UNLISTED_CSV,
      }),
      'surveys-unlisted.zip',
    );

    // The named file still lands, so the archive was not simply empty.
    expect(await storedRows('HEAT_Surveys.csv')).toHaveLength(3);
    expect(await storedRows('Extra_Unlisted.csv')).toEqual([]);
  });

  it('records a presence fact for the unlisted file: zero stored, two parsed', async () => {
    await ingest(
      archiveOf({
        'Surveys/HEAT_Surveys.csv': SURVEYS_CSV,
        'Surveys/Extra_Unlisted.csv': UNLISTED_CSV,
      }),
      'surveys-unlisted.zip',
    );

    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    const files = meta?.files ?? [];
    const fact = files.find((file) => file.sourceFile === 'Extra_Unlisted.csv');
    expect(fact, 'the unlisted file records a presence fact').toBeDefined();
    // The three states D-09 exists to tell apart: the file WAS there, two rows
    // parsed, and the allowlist kept none of them.
    expect(fact?.rowCount).toBe(0);
    expect(fact?.parsedRowCount).toBe(2);
  });

  it('stores nothing for a Surveys file filed under another category', async () => {
    await ingest(
      archiveOf({ 'Payment_History/HEAT_Surveys.csv': SURVEYS_CSV }),
      'surveys-misfiled.zip',
    );

    expect(await storedRows('HEAT_Surveys.csv')).toEqual([]);
  });

  it('stores nothing for a Surveys file whose headers match no allowlist column', async () => {
    await ingest(archiveOf({ 'Surveys/HEAT_Surveys.csv': DRIFTED_CSV }), 'surveys-drifted.zip');

    expect(await storedRows('HEAT_Surveys.csv')).toEqual([]);
  });

  it('stores nothing for a Surveys file that is a header and nothing else', async () => {
    await ingest(
      archiveOf({ 'Surveys/HEAT_Surveys.csv': HEADER_ONLY_CSV }),
      'surveys-header-only.zip',
    );

    expect(await storedRows('HEAT_Surveys.csv')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The channel's answer
// ---------------------------------------------------------------------------

describe('the worker: the perks channel answers four ordered cards', () => {
  it('answers the four cards in the fixed order, and only those four', async () => {
    await ingest(surveysArchive(), 'surveys.zip');

    const view = await askPerks();
    expect(view.status).toBe('ready');
    expect(Object.keys(view.cards)).toEqual([...PERKS_CARD_IDS]);
    expect(Object.keys(view.cards)).toEqual(['subscriptions', 'coupons', 'bonusCodes', 'surveys']);
  });

  it('answers the Surveys card ready, with the three spec columns and three rows', async () => {
    await ingest(surveysArchive(), 'surveys.zip');

    const view = await askPerks();
    const card = ready(view.cards.surveys, 'surveys');
    expect(card.columns.map((column) => column.id)).toEqual([
      'QUESTION_ID',
      'SKIPPED_BY_PLAYER',
      'MESSAGE_TS',
    ]);
    expect(card.rowCount).toBe(3);
    expect(card.rows).toHaveLength(3);
    // Every row carries the group's account root, never a cell.
    for (const row of card.rows) expect(row.account).toBe(ROOT);
  });

  it('answers the other three cards not-in-export, never an error', async () => {
    await ingest(surveysArchive(), 'surveys.zip');

    const view = await askPerks();
    expect(view.cards.subscriptions).toEqual({ status: 'not-in-export' });
    expect(view.cards.coupons).toEqual({ status: 'not-in-export' });
    expect(view.cards.bonusCodes).toEqual({ status: 'not-in-export' });
  });

  it('carries a zero merge count for Surveys alone, and no canary, in the posted view', async () => {
    await ingest(surveysArchive(), 'surveys.zip');

    const view = await askPerks();
    // Only Subscriptions merges (plan 12-10), so a Surveys-only export removes
    // nothing; a NUMBER rather than a flag so the pane can word the merge note
    // without a second shape.
    expect(view.mergedAway).toBe(0);
    const text = JSON.stringify(view);
    for (const canary of CANARIES)
      expect(text, `${canary} in the posted view`).not.toContain(canary);
  });

  it('answers the Surveys card skipped when the headers drifted', async () => {
    await ingest(archiveOf({ 'Surveys/HEAT_Surveys.csv': DRIFTED_CSV }), 'surveys-drifted.zip');

    const view = await askPerks();
    expect(view.cards.surveys).toEqual({ status: 'skipped' });
  });

  it('answers the Surveys card no-rows when the file is a header and nothing else', async () => {
    await ingest(
      archiveOf({ 'Surveys/HEAT_Surveys.csv': HEADER_ONLY_CSV }),
      'surveys-header-only.zip',
    );

    const view = await askPerks();
    expect(view.cards.surveys).toEqual({ status: 'no-rows' });
  });

  it('answers every card not-in-export for an export with no Surveys file at all', async () => {
    await ingest(archiveOf({ 'Payment_History/orders.csv': 'ID;AMOUNT\n1;2\n' }), 'no-surveys.zip');

    const view = await askPerks();
    for (const id of PERKS_CARD_IDS) {
      expect(view.cards[id], id).toEqual({ status: 'not-in-export' });
    }
  });
});

// ---------------------------------------------------------------------------
// The pane fact, and the row it becomes
// ---------------------------------------------------------------------------

describe('the worker: the Perks pane fact reaches the list', () => {
  it('publishes exactly the Perks pane fact, and nothing else', async () => {
    const result = await ingest(surveysArchive(), 'surveys.zip');

    // One file, three stored rows. Typed by hand from the archive above.
    expect(result.newDataPanes).toEqual({ perks: { fileCount: 1, rowCount: 3 } });
    // Two integers per pane and a pane id as the key: no file name, no
    // category, no account root, no cell (T-12-07).
    for (const match of JSON.stringify(result.newDataPanes).matchAll(/:"([^"]*)"/g)) {
      expect(NEW_DATA_PANE_IDS).toContain(match[1] as NewDataPaneId);
    }
    for (const facts of Object.values(result.newDataPanes ?? {})) {
      expect(Number.isInteger(facts?.fileCount)).toBe(true);
      expect(Number.isInteger(facts?.rowCount)).toBe(true);
    }
  });

  it('renders an unmuted Perks row between Payments and Device info', async () => {
    const result = await ingest(surveysArchive(), 'surveys.zip');

    const entries = paneEntries(result);
    const perks = entries.find((entry) => entry.id === 'perks');
    expect(perks, 'the Perks row exists').toBeDefined();
    expect(perks?.muted).toBe(false);
    expect(perks?.headline).toBe(formatRowCount(3));
    // The documented position (12-UI-SPEC Recorded Choice 1).
    const at = entries.indexOf(perks!);
    expect(entries[at - 1]?.id).toBe('payments');
    expect(entries[at + 1]?.id).toBe('device-info');
  });
});

// ---------------------------------------------------------------------------
// 12-10: the three-account archive, merged and unmerged
// ---------------------------------------------------------------------------
//
// Every expectation below is read from PK_EXPECTED, whose literals were derived
// by hand in the fixture module. It lists the Perks cards PANE_MAPPING marks
// mapped only: a removed card writes no file, is absent from the oracle, and
// must answer not-in-export.

const ALL_CARD_IDS: readonly PkCardId[] = ['subscriptions', 'coupons', 'bonusCodes', 'surveys'];

/** The accounts a displayed row names, sorted (the first-seen order is the builder test's job). */
function accountsOf(row: { account: string; accounts?: readonly string[] }): string[] {
  return [...(row.accounts ?? [row.account])].sort();
}

/** Do the shown rows of a ready card match the oracle's rows, one to one? */
function expectRowsMatch(
  id: string,
  card: Extract<NewDataCardView, { status: 'ready' }>,
  expected: readonly PkExpectedRow[],
): void {
  const ids = card.columns.map((column) => column.id);
  const pool = card.rows.map((row) => ({
    accounts: accountsOf(row),
    cells: Object.fromEntries(ids.map((column, at) => [column, row.cells[at]])),
  }));
  expect(pool, `${id} displayed rows`).toHaveLength(expected.length);
  for (const want of expected) {
    const at = pool.findIndex(
      (have) =>
        JSON.stringify(have.accounts) === JSON.stringify([...want.accounts].sort()) &&
        Object.entries(want.cells).every(([column, value]) => have.cells[column] === value),
    );
    expect(at, `${id}: no displayed row for ${JSON.stringify(want)}`).toBeGreaterThanOrEqual(0);
    pool.splice(at, 1);
  }
  expect(pool, `${id}: rows the oracle does not expect`).toEqual([]);
}

/** Every file name and every EXCLUDED header of the present Perks files. */
function forbiddenNames(): string[] {
  const out: string[] = [];
  for (const id of PK_EXPECTED.cardsPresent) {
    const key = pkFileKey(id);
    const captured = CAPTURED_FILES.find((file) => file.key === key)!;
    out.push(captured.fileName);
    const allowed = new Set(
      NEW_DATA_SPEC_FILES.find((spec) => spec.key === key)!.columns.map((column) => column.header),
    );
    for (const header of headersOf(key)!.headers) if (!allowed.has(header)) out.push(header);
  }
  return out;
}

describe('12-10: the three-account Perks archive through the worker', () => {
  it('answers every present card with the hand-derived counts, accounts and cells', async () => {
    await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    const view = await askPerks();
    for (const id of PK_EXPECTED.cardsPresent) {
      const want = PK_EXPECTED.cards[id]!;
      const card = ready(view.cards[id], id);
      expect(card.rowCount, `${id} rowCount`).toBe(want.displayedRows);
      expect(
        card.columns.map((column) => column.id),
        `${id} columns`,
      ).toEqual(want.columns);
      expectRowsMatch(id, card, want.rows);
    }
    expect(view.mergedAway).toBe(PK_EXPECTED.mergedAway);
  });

  it('merges identical Subscriptions rows and tags the merged row with every account', async () => {
    if (!PK_EXPECTED.cardsPresent.includes('subscriptions')) return;
    await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    const card = ready((await askPerks()).cards.subscriptions, 'subscriptions');
    const merged = card.rows.filter((row) => row.accounts !== undefined);
    // One merged row (A and B), and it is the only one with an accounts list.
    expect(merged).toHaveLength(1);
    expect([...merged[0]!.accounts!].sort()).toEqual([PK_ROOT_A, '630000002']);
    expect(merged[0]!.account).toBe(merged[0]!.accounts![0]);
    expect(card.rowCount).toBe(PK_EXPECTED.cards.subscriptions!.displayedRows);
  });

  it('never merges coupons, bonus codes or surveys: no row carries an accounts list', async () => {
    await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    const view = await askPerks();
    for (const id of PK_EXPECTED.cardsPresent) {
      if (id === 'subscriptions') continue;
      const card = ready(view.cards[id], id);
      for (const row of card.rows) expect('accounts' in row, `${id} row`).toBe(false);
      // Stored rows and displayed rows agree for a card that never merges.
      expect(card.rowCount, id).toBe(PK_EXPECTED.cards[id]!.storedRows);
    }
  });

  it('reconciles the pane fact with the displayed rows through mergedAway', async () => {
    const result = await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    expect(result.newDataPanes).toEqual({ perks: PK_EXPECTED.pane });
    const view = await askPerks();
    let displayed = 0;
    for (const id of PK_EXPECTED.cardsPresent) displayed += ready(view.cards[id], id).rowCount;
    expect(displayed + view.mergedAway).toBe(PK_EXPECTED.pane.rowCount);
  });

  it('answers a removed (unmapped) card not-in-export', async () => {
    await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    const view = await askPerks();
    for (const id of ALL_CARD_IDS) {
      if (PK_EXPECTED.cardsPresent.includes(id)) continue;
      expect(view.cards[id], id).toEqual({ status: 'not-in-export' });
    }
  });

  it('reads the coupon code as the stored string with its leading zeros', async () => {
    if (!PK_EXPECTED.cardsPresent.includes('coupons')) return;
    await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    const card = ready((await askPerks()).cards.coupons, 'coupons');
    const at = card.columns.findIndex((column) => column.kind === 'code');
    const codes = card.rows.map((row) => row.cells[at]);
    expect(codes).toContain('00012345678');
    for (const code of codes) expect(typeof code === 'string' || code === null).toBe(true);
  });

  it('reads the bonus-code address as the canonical address and the dropped one as null', async () => {
    if (!PK_EXPECTED.cardsPresent.includes('bonusCodes')) return;
    await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    const card = ready((await askPerks()).cards.bonusCodes, 'bonusCodes');
    const at = card.columns.findIndex((column) => column.kind === 'address');
    const addresses = card.rows.map((row) => row.cells[at]);
    expect(addresses.filter((cell) => cell === '192.0.2.50')).toHaveLength(2);
    expect(addresses.filter((cell) => cell === null)).toHaveLength(1);
  });
});

describe('12-10: nothing planted reaches storage or a posted view', () => {
  it('the fixture really carries every canary the assertions rule out', () => {
    // Without this, each negative assertion below would pass against a build
    // that stored nothing at all, because there would be nothing to store.
    const entries = unzipSync(buildPerksThreeAccountExport());
    const text = Object.values(entries)
      .map((bytes) => new TextDecoder('utf-8').decode(bytes))
      .join('\n');
    // A canary planted in a column of a card that was removed has no file to
    // live in, so only the canaries of present cards are required.
    const present = new Set(PK_EXPECTED.cardsPresent);
    const required: [PkCardId, string[]][] = [
      ['subscriptions', [PK_EMAIL_SUBSCRIBED, PK_NICKNAME_CANARY]],
      ['coupons', [PK_EMAIL_STATUS, PK_CODE_CANARY, PK_ADDRESS_CANARY]],
      ['bonusCodes', [PK_EMAIL_USER_IP]],
      ['surveys', [PK_EMAIL_ANSWER, PK_PROFILE_CANARY, PK_BATTLE_CANARY]],
    ];
    for (const [card, canaries] of required) {
      if (!present.has(card)) continue;
      for (const canary of canaries) expect(text, `${canary} in the archive`).toContain(canary);
    }
  });

  it('plants an email in an allowlisted cell and finds it nowhere at rest or in the view', async () => {
    await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    const atRest = await everythingAtRest();
    const viewText = JSON.stringify(await askPerks());
    for (const canary of PK_CANARIES) {
      expect(atRest, `${canary} reached storage`).not.toContain(canary);
      expect(viewText, `${canary} reached the posted view`).not.toContain(canary);
    }
    for (const email of [PK_EMAIL_SUBSCRIBED, PK_EMAIL_STATUS, PK_EMAIL_USER_IP, PK_EMAIL_ANSWER]) {
      expect(atRest).not.toContain(email);
    }
  });

  it('the stored rows of the present files carry spec keys only', async () => {
    await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    for (const id of PK_EXPECTED.cardsPresent) {
      const key = pkFileKey(id);
      const captured = CAPTURED_FILES.find((file) => file.key === key)!;
      const allowed = new Set(
        NEW_DATA_SPEC_FILES.find((spec) => spec.key === key)!.columns.map((column) => column.id),
      );
      const rows = await storedRows(captured.fileName);
      expect(rows, id).toHaveLength(PK_EXPECTED.cards[id]!.storedRows);
      for (const row of rows) {
        for (const column of Object.keys(row))
          expect(allowed.has(column), `${id}.${column}`).toBe(true);
      }
    }
  });

  it('the posted view carries no file name, no excluded header text and no nickname', async () => {
    await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    const viewText = JSON.stringify(await askPerks());
    for (const name of forbiddenNames()) {
      expect(viewText, `${name} in the posted view`).not.toContain(name);
    }
  });

  it('a legacy stored row with an extra raw column leaks that column nowhere', async () => {
    await ingest(buildPerksThreeAccountExport(), 'perks-three.zip');

    const legacyValue = 'legacy-raw-value@legacy.example.invalid';
    const { db } = await importWorkerDb();
    await db.rows.clear();
    await db.rows.bulkAdd(
      PK_EXPECTED.cardsPresent.map((id, rowIndex) => {
        const key = pkFileKey(id);
        const captured = CAPTURED_FILES.find((file) => file.key === key)!;
        const data: Record<string, string | undefined> = {};
        for (const column of NEW_DATA_SPEC_FILES.find((spec) => spec.key === key)!.columns) {
          data[column.id] = column.kind === 'number' ? '5' : 'clean';
        }
        data['LEGACY_RAW_COLUMN'] = legacyValue;
        return {
          category: captured.folder,
          sourceFile: captured.fileName,
          rowIndex,
          data,
          account: PK_ROOT_A,
        };
      }),
    );

    const view = await askPerks();
    for (const id of PK_EXPECTED.cardsPresent) {
      expect(ready(view.cards[id], id).rowCount, id).toBe(1);
    }
    const viewText = JSON.stringify(view);
    expect(viewText).not.toContain(legacyValue);
    expect(viewText).not.toContain('LEGACY_RAW_COLUMN');
  });
});

describe('12-10: a second identical import answers the same view', () => {
  it('the memo and the merge are deterministic', async () => {
    const bytes = buildPerksThreeAccountExport();
    await ingest(bytes, 'perks-three.zip');
    const first = JSON.stringify(await askPerks());
    // The memoised repeat.
    expect(JSON.stringify(await askPerks())).toBe(first);

    // A genuine second import: the dataset is cleared, then imported again.
    const { db } = await importWorkerDb();
    await db.rows.clear();
    await db.meta.clear();
    await ingest(bytes, 'perks-three-again.zip');
    expect(JSON.stringify(await askPerks())).toBe(first);
  });
});
