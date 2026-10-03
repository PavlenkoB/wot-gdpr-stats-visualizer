import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { unzipSync } from 'fflate';
import { CURRENCY_OPS_HEADER, PREMIUM_HEADER, premiumRow } from '../fixtures/finance-fixtures.ts';
import {
  SAMPLE_ACCOUNT_ROOT,
  SAMPLE_NICKNAME,
  buildCustomExport,
  buildSampleExport,
} from '../fixtures/export-fixtures.ts';
import { analyzeExport, sortCategoryEntries } from '../../src/lib/worker/classify.ts';
import type { CategoryEntry } from '../../src/lib/types/worker-messages.ts';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  waitForMessage,
  type WorkerPostSpy,
} from '../helpers/worker-harness.ts';

// =============================================================================
// 05-03 tracer — Financial_data supported on import AND on replay
// =============================================================================
//
// The two halves of D-01 that only exist at the WORKER boundary:
//
//   1. IMPORT. `Financial_data` is a real top-level folder in Wargaming's
//      export, so it belongs in `SUPPORTED`. Until it does, it classifies
//      `unknown`: no section card, and a wrong "Not yet supported" banner.
//
//   2. REPLAY. The interesting half, and the reason this is a worker test
//      rather than a `classifyFolder` unit test. A user who imported with a
//      Phase-4 build has a cached `meta.categories` in IndexedDB that SAYS
//      `Financial_data: unknown` — while its rows are sitting in the `rows`
//      table, because the worker parses every category regardless of status.
//      Re-classifying only at import would leave every existing user seeing
//      "Not in this export" for a folder they demonstrably have. So
//      `resultFromMeta` — the ONE place both replay paths (`cache-status`
//      on reload, `duplicate` on a hash-identical re-drop) build their
//      result — must re-derive every status from the stored NAME and re-sort
//      with the same comparator `analyzeExport` uses.
//
//      And it must do that with NO Dexie version bump: the rows are valid
//      and only a derived label is stale, so wiping a user's cache to fix a
//      label would be a self-inflicted data loss. Hence the `db.verno`
//      assertion at the bottom, which fails the moment someone "fixes" this
//      with a migration.
//
// The stale status is seeded by WRITING the meta record, not by mocking
// `classifyFolder`: the guarantee is that a status already in the database
// is repaired, and only a real write can show that.
// =============================================================================

const CRLF = '\r\n';

/**
 * `Financial_data/Virtual_Currencies_Operations.csv` — one deposit row,
 * with the export's real six-column header.
 *
 * The headers are imported from plan 05-01's finance fixture module rather
 * than retyped, so a header correction there fails HERE instead of leaving
 * this test asserting a header no real export has. Values are fabricated:
 * `ru.wot.crystal` / `Crystal` / `100` is the currency vocabulary 05-01's
 * hand fixture already established.
 */
const FINANCE_CURRENCY_OPS_CSV =
  CRLF +
  CURRENCY_OPS_HEADER.join(';') +
  CRLF +
  ['2019-04-01 09:00:00', 'ru.wot.crystal', 'Crystal', '100', 'deposit', ''].join(';') +
  CRLF;

/**
 * `Financial_data/Operations_with_Premium_Days.csv` — one one-day grant.
 *
 * `PREMIUM` carries the DURATION AS TEXT (`1 day`), not a number: that is
 * the shape FINANCE-01 exists to parse, so a numeric-looking cell here would
 * quietly stop exercising the real thing.
 *
 * The row is built with the fixture module's own `premiumRow`, so it carries the
 * real export's shape (plan 05-18): the grant datetime in `CURR_PREMIUM` and the
 * shared bulk-migration stamp in `CREATED` and `UPDATED`. The assertions below
 * are about re-classification, not about the premium figure, so they are
 * unchanged.
 */
const FINANCE_PREMIUM_CSV =
  CRLF +
  PREMIUM_HEADER.join(';') +
  CRLF +
  premiumRow('1 day', '2019-03-05 10:00:00').join(';') +
  CRLF;

/** The export under test: the shared sample plus the two finance files. */
function buildFinancialExport(): Uint8Array {
  return buildCustomExport({
    overrides: {
      'Financial_data/Virtual_Currencies_Operations.csv': FINANCE_CURRENCY_OPS_CSV,
      'Financial_data/Operations_with_Premium_Days.csv': FINANCE_PREMIUM_CSV,
    },
  });
}

/**
 * The canonical order `sortCategoryEntries` must produce.
 *
 * Spelled out rather than read from a fixture constant because THIS is the
 * contract: status group (supported, known-deferred, unknown), then
 * lower-case code-unit name, then raw name. Note `Payment_history` sorts
 * BEFORE `Player_statistics` — `paymen` vs `playe`, and `l` < `y` — which
 * reads like a typo but is the locale-INDEPENDENT order D-05 requires.
 */
const REPAIRED_ORDER = [
  'Activity_history',
  'Financial_data',
  'Payment_history',
  'Player_statistics',
  'User_Info',
  'Chat_history',
  'Clans',
  'Bans',
  'Device_info',
] as const;

/** The four categories a Phase-4 build already knew were supported. */
const PRE_PHASE5_SUPPORTED = [
  'Activity_history',
  'Payment_history',
  'Player_statistics',
  'User_Info',
] as const;

describe('05-03 tracer: Financial_data supported on import and on replay', () => {
  let postSpy: WorkerPostSpy;
  let savedSelf: unknown;

  beforeEach(async () => {
    savedSelf = (globalThis as unknown as { self?: unknown }).self;
    await deleteActiveDatabase();
    postSpy = installWorkerScope();
    await loadWorker();
    // The module-load handshake is not part of any assertion here.
    postSpy.mockClear();
  });

  afterAll(async () => {
    await deleteActiveDatabase();
    if ('self' in globalThis) {
      (globalThis as unknown as { self?: unknown }).self = savedSelf;
    }
  });

  // ---------------------------------------------------------------------------
  // (import) the folder is supported the moment the archive is analysed
  // ---------------------------------------------------------------------------

  test('an export holding Financial_data classifies it supported and counts it', async () => {
    const terminal = await ingestExport(postSpy, buildFinancialExport(), 'financial.zip');

    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') return;

    const financial = terminal.result.categories.find((c) => c.name === 'Financial_data');
    expect(financial).toBeDefined();
    // THE assertion. Before this change the entry exists but reads `unknown`,
    // which is why the category renders as a "Not yet supported" banner.
    expect(financial!.status).toBe('supported');

    // `counts` is derived from the same status list, so it moves with it —
    // the four pre-existing supported folders plus the new one.
    expect(terminal.result.counts).toEqual({ supported: 5, 'known-deferred': 2, unknown: 2 });

    // It sits in the SUPPORTED GROUP, in lower-case name order, rather than
    // being appended or left where an unknown folder would have gone.
    const names = terminal.result.categories.map((c) => c.name);
    expect(names.slice(0, 5)).toEqual([...REPAIRED_ORDER].slice(0, 5));
  });

  // ---------------------------------------------------------------------------
  // (replay) a stale stored status is repaired, on BOTH replay paths
  // ---------------------------------------------------------------------------

  /**
   * Rewrite the stored meta record the way a Phase-4 build would have left
   * it: `Financial_data` carrying `unknown`, sorted into the unknown group by
   * the same comparator (a status-only change never moves the sort rules).
   *
   * This is the state a real returning user is in: correct folder name,
   * correct counts, correct rows on disk, wrong label.
   */
  async function seedStaleUnknownStatus(): Promise<{ before: string[] }> {
    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();

    const stale = sortCategoryEntries(
      meta!.categories.map((entry): CategoryEntry =>
        entry.name === 'Financial_data' ? { ...entry, status: 'unknown' } : entry,
      ),
    );
    await db.meta.put({ ...meta!, categories: stale });

    // Record what the DB now holds so the assertions can prove the replay
    // CHANGED something rather than passing on the import's own output.
    const reread = await db.meta.get('active');
    const financial = reread!.categories.find((c) => c.name === 'Financial_data');
    expect(financial?.status).toBe('unknown');
    return { before: reread!.categories.map((c) => c.name) };
  }

  test('check-cache repairs a stale unknown status into supported, in order', async () => {
    await ingestExport(postSpy, buildFinancialExport(), 'financial.zip');
    const { before } = await seedStaleUnknownStatus();

    postSpy.mockClear();
    postRequest({ type: 'check-cache', jobId: 7 });
    const status = await waitForMessage(postSpy, 'cache-status');
    expect(status.type).toBe('cache-status');
    if (status.type !== 'cache-status') return;

    const cached = status.cached;
    expect(cached).not.toBeNull();
    const categories = cached!.categories;

    // The repair itself.
    const financial = categories.find((c) => c.name === 'Financial_data');
    expect(financial!.status).toBe('supported');

    // The whole list comes back in the canonical order, not just the one
    // entry — a remap that skipped the re-sort would leave the repaired
    // folder stranded among the unknown ones.
    expect(categories.map((c) => c.name)).toEqual([...REPAIRED_ORDER]);

    // `counts` must be recomputed AFTER the remap. Deriving them before it is
    // the one ordering mistake that would leave supported at 4 here while
    // every entry says `supported`.
    expect(cached!.counts).toEqual({ supported: 5, 'known-deferred': 2, unknown: 2 });

    // No user's data was touched to achieve this: the rows and the account
    // root ride through the repair unchanged.
    expect(cached!.accountRoot).toBe(SAMPLE_ACCOUNT_ROOT);
    expect(cached!.identity?.nickname).toBe(SAMPLE_NICKNAME);
    expect(before.filter((n) => n !== 'Financial_data')).toEqual(
      categories.map((c) => c.name).filter((n) => n !== 'Financial_data'),
    );
  });

  test('a hash-identical re-drop (duplicate) yields the same repaired list', async () => {
    // Both replay paths read the same meta record and must produce the same
    // object (D-20): when they were separate literals a field added to one
    // and not the other surfaced as a page that rendered differently after a
    // reload than after a re-drop. So this asserts EQUALITY of the two
    // replies, not merely that both are supported.
    await ingestExport(postSpy, buildFinancialExport(), 'financial.zip');
    await seedStaleUnknownStatus();

    postSpy.mockClear();
    postRequest({ type: 'check-cache', jobId: 7 });
    const fromCache = await waitForMessage(postSpy, 'cache-status');

    postSpy.mockClear();
    const duplicate = await ingestExport(postSpy, buildFinancialExport(), 'financial.zip');
    expect(duplicate.type).toBe('duplicate');

    if (fromCache.type !== 'cache-status' || duplicate.type !== 'duplicate') return;
    expect(duplicate.result.categories).toEqual(fromCache.cached!.categories);
    expect(duplicate.result.counts).toEqual(fromCache.cached!.counts);
  });

  test('the other categories keep their own status through the same repair', async () => {
    await ingestExport(postSpy, buildFinancialExport(), 'financial.zip');
    await seedStaleUnknownStatus();

    postSpy.mockClear();
    postRequest({ type: 'check-cache', jobId: 7 });
    const status = await waitForMessage(postSpy, 'cache-status');
    if (status.type !== 'cache-status') return;

    const byName = new Map(status.cached!.categories.map((c) => [c.name, c.status]));

    // Re-deriving every status must not sweep OTHER folders into supported:
    // a blanket "everything in the list is ours" would light up all four
    // unknown/deferred folders too.
    expect(byName.get('Chat_history')).toBe('known-deferred');
    expect(byName.get('Clans')).toBe('known-deferred');
    expect(byName.get('Bans')).toBe('unknown');
    expect(byName.get('Device_info')).toBe('unknown');
    for (const name of PRE_PHASE5_SUPPORTED) {
      expect(byName.get(name)).toBe('supported');
    }
  });

  // ---------------------------------------------------------------------------
  // (no migration) the repair is derived at replay, not by a schema bump
  // ---------------------------------------------------------------------------

  test('the Dexie schema version is still 2 — a status fix must not wipe a cache', async () => {
    const { db } = await importWorkerDb();
    // The whole backward-safety argument in one number. A `version(3)` here
    // would discard a returning user's rows to correct a label.
    expect(db.verno).toBe(2);

    // And the repair genuinely still works with the user's rows in place —
    // a version bump that "kept" the rows would be the other half of the
    // promise, so assert the stored categories the repair reads are the
    // ones an import wrote.
    await ingestExport(postSpy, buildFinancialExport(), 'financial.zip');
    const meta = await db.meta.get('active');
    expect(meta!.categories.find((c) => c.name === 'Financial_data')).toBeDefined();
    expect(db.verno).toBe(2);
  });
});

// =============================================================================
// The sample's Financial_data headers really are the export's headers
// =============================================================================
//
// This exists because of a compromise forced by an import cycle. The shared
// sample's two finance headers are written out as literals in
// `export-fixtures.ts` — transcribing plan 05-01's `PREMIUM_HEADER` and
// `CURRENCY_OPS_HEADER` — because importing them would close the cycle
// `finance-fixtures.ts` -> `sessions-fixtures.ts` -> `export-fixtures.ts` and
// the module body would read `undefined` from a half-evaluated cycle.
//
// A copied constant with nothing comparing it to its source is exactly how
// 05-01 shipped a wrong answer key: a header transcribed from RESEARCH prose
// instead of from the real module, and every assertion against it agreed
// because they all read the same wrong string. So this test reads the REAL
// BYTES out of the built sample and compares them to 05-01's constants. A
// header correction in 05-01 now fails here.
// =============================================================================

describe('the sample export carries the real Financial_data headers', () => {
  /** The first non-empty line of one entry inside the sample archive. */
  function headerLineOf(bytes: Uint8Array, path: string): string {
    const inflated = unzipSync(bytes);
    const text = new TextDecoder('utf-8').decode(inflated[path]!);
    for (const line of text.split(/\r\n|\n|\r/)) {
      if (line.length > 0) return line;
    }
    throw new Error(`no non-empty line found in ${path}`);
  }

  test('both finance files carry 05-01 headers verbatim, in 05-01 order', () => {
    const bytes = buildSampleExport();

    // The exact strings, in the exact order, of PREMIUM_HEADER.
    expect(headerLineOf(bytes, '123456789/Financial_data/Operations_with_Premium_Days.csv')).toBe(
      'PREMIUM;CURR_PREMIUM;CREATED;UPDATED',
    );
    expect(PREMIUM_HEADER.join(';')).toBe(
      headerLineOf(bytes, '123456789/Financial_data/Operations_with_Premium_Days.csv'),
    );

    // …and of CURRENCY_OPS_HEADER: CREATED first, ORDER last.
    expect(headerLineOf(bytes, '123456789/Financial_data/Virtual_Currencies_Operations.csv')).toBe(
      'CREATED;CURRENCY_CODE;CURRENCY_TITLE;AMOUNT;TYPE;ORDER',
    );
    expect(CURRENCY_OPS_HEADER.join(';')).toBe(
      headerLineOf(bytes, '123456789/Financial_data/Virtual_Currencies_Operations.csv'),
    );
  });

  test('the premium duration is TEXT in the sample, not a number', () => {
    // The one cell shape FINANCE-01 exists to parse. A numeric-looking cell
    // in the shared sample would make every later premium test pass against
    // a format the export never writes.
    const inflated = unzipSync(buildSampleExport());
    const text = new TextDecoder('utf-8').decode(
      inflated['123456789/Financial_data/Operations_with_Premium_Days.csv']!,
    );
    expect(text).toContain('1 day');
  });
});

// =============================================================================
// sortCategoryEntries — the comparator, now shared by import AND replay
// =============================================================================
//
// The comparator moved OUT of `analyzeExport` unchanged so the replay path
// could reuse it. "Unchanged" is the claim that needs a test: a replay list
// that sorted by anything else would quietly disagree with an import list,
// and the user would see one order in one session and another after a reload.
// =============================================================================

describe('sortCategoryEntries', () => {
  test('orders by status group, then lower-case code-unit name, then raw name', () => {
    const entries: CategoryEntry[] = [
      { name: 'Bans', status: 'unknown', fileCount: 1 },
      { name: 'User_Info', status: 'supported', fileCount: 1 },
      { name: 'user_info', status: 'supported', fileCount: 1 },
      { name: 'Clans', status: 'known-deferred', fileCount: 1 },
      { name: 'Activity_history', status: 'supported', fileCount: 2 },
      { name: 'Device_info', status: 'unknown', fileCount: 1 },
      { name: 'Chat_history', status: 'known-deferred', fileCount: 1 },
    ];

    expect(sortCategoryEntries(entries).map((e) => e.name)).toEqual([
      // supported group, lower-case order; `User_Info` before `user_info`
      // because the raw-name tie-break is plain code-unit comparison and
      // uppercase sorts first.
      'Activity_history',
      'User_Info',
      'user_info',
      // then known-deferred, then unknown
      'Chat_history',
      'Clans',
      'Bans',
      'Device_info',
    ]);
  });

  test('is a pure sort: the input array is not mutated and a new array comes back', () => {
    // `analyzeExport` sorts an array it then reads to build the result, and
    // the replay path maps into a fresh list. Returning the input itself
    // would let a caller mutate another list by accident.
    const entries: CategoryEntry[] = [
      { name: 'Bans', status: 'unknown', fileCount: 1 },
      { name: 'Activity_history', status: 'supported', fileCount: 2 },
    ];
    const sorted = sortCategoryEntries(entries);
    expect(sorted).not.toBe(entries);
    expect(entries.map((e) => e.name)).toEqual(['Bans', 'Activity_history']);
    expect(sorted.map((e) => e.name)).toEqual(['Activity_history', 'Bans']);
  });

  test('sorts an analyzeExport result to itself — the two paths cannot disagree', () => {
    // Lockstep: `analyzeExport` still sorts with these exact rules, so a
    // freshly imported export and a replayed one of the same archive come
    // out in the same order. If the comparator ever drifts in one caller,
    // this fails rather than the user seeing an order that changes on reload.
    const outcome = analyzeExport([
      '123456789/Activity_history/Sessions.csv',
      '123456789/Player_statistics/WOT_stats.csv',
      '123456789/User_Info/Account_Info.csv',
      '123456789/Payment_history/Orders.csv',
      '123456789/Chat_history/Messages.csv',
      '123456789/Clans/Clan_membership.csv',
      '123456789/Bans/Bans.csv',
      '123456789/Device_info/Devices.csv',
    ]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(sortCategoryEntries(outcome.result.categories)).toEqual(outcome.result.categories);
  });
});
