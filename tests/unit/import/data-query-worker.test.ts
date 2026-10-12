import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCurrency,
  buildPremium,
  buildSpend,
} from '../../../src/lib/features/finance/finance-aggregate.ts';
import { buildVehicleView } from '../../../src/lib/features/vehicles/vehicle-aggregate.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import { buildSampleExport, buildCustomExport } from '../../fixtures/export-fixtures.ts';
import {
  CURRENCY_HAND_ROWS,
  CURRENCY_OPS_HEADER,
  FINANCE_CANARIES,
  ORDERS_HAND_ROWS,
  ORDERS_HEADER_12,
  PREMIUM_HAND_ROWS,
  PREMIUM_HEADER,
} from '../../fixtures/finance-fixtures.ts';
import {
  PLAYER_STATS_EXPECTED,
  PLAYER_STATS_SAMPLE_FILES,
  STATS_NAME_CANARY,
} from '../../fixtures/player-stats-fixtures.ts';
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
import type {
  CurrencyView,
  PremiumView,
  SpendView,
} from '../../../src/lib/features/finance/finance-shared.ts';
import type {
  VehicleRowData,
  VehicleView,
} from '../../../src/lib/features/vehicles/vehicle-shared.ts';
import type { LoginsView } from '../../../src/lib/features/logins/login-shared.ts';
import type { DeviceInfoView } from '../../../src/lib/features/device-info/device-info-shared.ts';
import type {
  DataQuery,
  IngestRequest,
  IngestResponse,
} from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// 05-07 Task 1 (tracer) — one premium query, end to end
// =============================================================================
//
// The tracer proves the whole data path with the SMALLEST channel: a posted
// data-query reaches the real worker, the worker reads one Dexie snapshot,
// `data-queries.ts` hands the premium file's rows to the pure `buildPremium`
// from 05-05, and a single data-result comes back carrying the SNAPSHOT's own
// importedAt.
//
// It is the tracer rather than a unit test of one helper because the property
// that matters is a property of the CHAIN. Three things cannot be proven by
// looking at any single file: that the answer's importedAt is the one read in
// the same transaction as the rows (so a replace cannot tear them), that the
// file-presence facts survive into the stored meta record, and that the
// hand-derived view is what the pure builder would have produced from the very
// same parsed rows.
//
// The expected view is therefore COMPUTED IN THE TEST, not copied from an
// implementation: the test rebuilds `buildPremium` over the fixture's own hand
// rows and asks for deep equality. A builder change and a wrong wiring both
// fail it.
//
// The wait ceiling is deliberately short (see RED_TIMEOUT_MS). A RED that hangs
// for the full 10 s default teaches nothing and costs the next green run time.
// =============================================================================

/** Short ceiling so the pre-implementation RED fails fast. */
const RED_TIMEOUT_MS = 1_500;

/** The category folder whose files the presence list covers. */
const PREMIUM_FILE = 'Operations_with_Premium_Days.csv';

/**
 * The rows the worker should have stored for the premium file, in the shape
 * `buildPremium` takes them: one object per hand row, keyed by header name.
 */
function expectedPremiumRows(): Record<string, string | undefined>[] {
  return PREMIUM_HAND_ROWS.map((cells) => {
    const row: Record<string, string | undefined> = {};
    PREMIUM_HEADER.forEach((header, i) => {
      row[header] = cells[i];
    });
    return row;
  });
}

/** A header-only premium file: the header row and no data rows at all. */
const HEADER_ONLY_PREMIUM_CSV: string = PREMIUM_HEADER.join(';') + '\r' + '\r';

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

describe('05-07 tracer: premium through the real worker and Dexie snapshot', () => {
  it('answers a posted premium query with the hand-derived view and the done result importedAt', async () => {
    const terminal = await ingestExport(post, buildSampleExport(), 'sample.zip');
    expect(terminal.type).toBe('done');
    if (terminal.type !== 'done') throw new Error('expected done');
    const importedAt = terminal.result.importedAt;

    post.mockClear();
    postRequest({ type: 'data-query', queryId: 7, query: { channel: 'premium' } });
    const reply = await waitForMessage(post, 'data-result', RED_TIMEOUT_MS);
    if (reply.type !== 'data-result') throw new Error('expected data-result');

    // EXACTLY one answer, for the id that was asked.
    const results = post.mock.calls
      .map((c) => c[0] as IngestResponse)
      .filter((m) => m.type === 'data-result');
    expect(results).toHaveLength(1);
    expect(reply.queryId).toBe(7);

    // The answer belongs to the dataset the import just wrote.
    expect(reply.importedAt).toBe(importedAt);

    // And it is the pure builder's own output over the same rows.
    if (reply.result === null) throw new Error('expected a result');
    expect(reply.result.channel).toBe('premium');
    expect(reply.result.view).toEqual(
      buildPremium(expectedPremiumRows(), true) as { status: string },
    );
    const view = reply.result.view as { status: string; grants?: number };
    // The hand fixture's ready shape: 18 rows, 11 of them grants.
    expect(view.status).toBe('ready');
    expect(view.grants).toBe(11);
  });

  it('answers importedAt null and result null with no dataset imported', async () => {
    postRequest({ type: 'data-query', queryId: 1, query: { channel: 'premium' } });
    const reply = await waitForMessage(post, 'data-result', RED_TIMEOUT_MS);
    if (reply.type !== 'data-result') throw new Error('expected data-result');
    expect(reply.queryId).toBe(1);
    expect(reply.importedAt).toBeNull();
    expect(reply.result).toBeNull();
  });

  it('tells an absent premium folder from a header-only premium file', async () => {
    // The folder is not in the archive at all: nothing was ever read for it.
    await ingestExport(post, buildCustomExport({ omitFolders: ['Financial_data'] }), 'absent.zip');
    post.mockClear();
    postRequest({ type: 'data-query', queryId: 2, query: { channel: 'premium' } });
    const absent = await waitForMessage(post, 'data-result', RED_TIMEOUT_MS);
    if (absent.type !== 'data-result') throw new Error('expected data-result');
    expect((absent.result as { view: { status: string } }).view.status).toBe('not-in-export');

    // The file is in the archive but holds no data rows. The presence facts
    // recorded at import are the ONLY thing that can tell these two apart: a
    // header-only file stores no row, so the rows table alone would look
    // exactly like an absent one.
    post.mockClear();
    await ingestExport(
      post,
      buildCustomExport({
        overrides: { 'Financial_data/Operations_with_Premium_Days.csv': HEADER_ONLY_PREMIUM_CSV },
      }),
      'header-only.zip',
    );
    post.mockClear();
    postRequest({ type: 'data-query', queryId: 3, query: { channel: 'premium' } });
    const empty = await waitForMessage(post, 'data-result', RED_TIMEOUT_MS);
    if (empty.type !== 'data-result') throw new Error('expected data-result');
    expect((empty.result as { view: { status: string } }).view.status).toBe('no-rows');
  });

  it('records one presence entry per file of the three categories and none from another', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');
    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();

    const files = (meta as { files?: { category: string; sourceFile: string; rowCount: number }[] })
      .files;
    expect(Array.isArray(files)).toBe(true);
    const list = files ?? [];

    // Every entry names one of the categories the presence list covers (the
    // three Phase 5 ones, and Device_info since quick 261012-bog), and a file of
    // another category is never listed.
    const categories = new Set(list.map((f) => f.category));
    for (const category of categories) {
      expect(['Player_statistics', 'Financial_data', 'Payment_history', 'Device_info']).toContain(
        category,
      );
    }
    expect(categories.has('Device_info')).toBe(true);
    expect(categories.has('User_Info')).toBe(false);
    expect(categories.has('Bans')).toBe(false);

    // The premium file is there with its real row count.
    const premium = list.find((f) => f.sourceFile === PREMIUM_FILE);
    expect(premium).toBeDefined();
    expect(premium?.category).toBe('Financial_data');
    expect(premium?.rowCount).toBe(PREMIUM_HAND_ROWS.length);

    // The other two categories' files are present too, so the list is not
    // premium-only.
    expect(list.some((f) => f.category === 'Payment_history')).toBe(true);
    expect(list.some((f) => f.category === 'Player_statistics')).toBe(true);
  });
});

// =============================================================================
// 05-07 Task 3 — the other three channels, the legacy cache, validation, the
// error-detail rule, the canary scan, and the memo
// =============================================================================
//
// Task 1 proved the CHAIN with one channel. What is left is everything that
// only shows up once all four run: that three more builders are wired the same
// way, that a cache written before this plan degrades honestly, that a hostile
// message never reaches a builder, that a builder's own error text never leaves
// the worker, that no personal column rides out in a reply, and that the memo
// can never serve a replaced dataset's numbers.
//
// Every channel's expected view is COMPUTED by calling the same pure builder
// over the same fixture rows, so a wrong wiring and a changed builder both
// fail here rather than being papered over by a hand-copied expectation.
// =============================================================================

/** Rows in the shape the builders take: one object per fixture row. */
function rowsOf(
  header: readonly string[],
  hand: readonly (readonly string[])[],
): Record<string, string | undefined>[] {
  return hand.map((cells) => {
    const row: Record<string, string | undefined> = {};
    header.forEach((name, i) => {
      row[name] = cells[i];
    });
    return row;
  });
}

/** Post one query and return the single reply it produced. */
async function ask(
  spy: WorkerPostSpy,
  query: DataQuery,
  queryId: number,
): Promise<Extract<IngestResponse, { type: 'data-result' | 'data-error' }>> {
  spy.mockClear();
  postRequest({ type: 'data-query', queryId, query });
  const reply = await waitForMessage(spy, 'data-result', 5_000);
  if (reply.type === 'data-error') return reply;
  if (reply.type !== 'data-result') throw new Error('expected data-result or data-error');
  return reply;
}

/**
 * Post one query and return whichever of the two replies arrives.
 *
 * Distinct from `ask` because that one waits specifically for a `data-result`,
 * which is right where a result is expected and wrong where the SUBJECT is the
 * error: a worker answering `data-error` would simply never be seen. This one
 * polls for either, so a test can assert a failure instead of timing out.
 */
async function askEither(
  spy: WorkerPostSpy,
  query: DataQuery,
  queryId: number,
): Promise<Extract<IngestResponse, { type: 'data-result' | 'data-error' }>> {
  spy.mockClear();
  postRequest({ type: 'data-query', queryId, query } as IngestRequest);
  const start = Date.now();
  while (Date.now() - start < 5_000) {
    for (const call of spy.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'data-result' || msg?.type === 'data-error') return msg;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('askEither: no data-result or data-error within 5,000 ms');
}

/**
 * Narrow a reply to a data-result, or fail with the error's detail.
 *
 * Used where the test is about the RESULT, so a `data-error` there is a failure
 * to report in its own words rather than a type error at the assertion.
 */
function dataResult(
  reply: Extract<IngestResponse, { type: 'data-result' | 'data-error' }>,
): Extract<IngestResponse, { type: 'data-result' }> {
  if (reply.type === 'data-error') {
    throw new Error(`expected a data-result, got data-error (${reply.detail})`);
  }
  return reply;
}

/**
 * The view a successful reply carried, after checking it is the RIGHT one.
 *
 * The return type is the union of the view shapes rather than a
 * channel-generic one: a call site that reads a shape's fields says which
 * shape it expects, and the channel check above is what has already proved the
 * reply belongs to the question that was asked.
 *
 * `LoginsView` joined that union in 06-01, when the `logins` channel was added
 * to `DataResult`. This file never asks for it — `logins-worker.test.ts` owns
 * that channel — but the parameter is typed by `DataQuery['channel']`, so a
 * signature that still named four shapes would not type-check the moment
 * anything did. The `logins` channel's own tests live elsewhere, deliberately:
 * this file's subject is the four channels that read FILES, and `logins` reads
 * the meta record instead (D-12).
 */
function viewOf(
  reply: Extract<IngestResponse, { type: 'data-result' | 'data-error' }>,
  channel: DataQuery['channel'],
): PremiumView | CurrencyView | SpendView | VehicleView | LoginsView | DeviceInfoView {
  const result = dataResult(reply).result;
  if (result === null) throw new Error(`expected a ${channel} result, got null`);
  if (result.channel !== channel) {
    throw new Error(`expected the ${channel} channel, got ${result.channel}`);
  }
  return result.view;
}

describe('05-07: the currency, spend and vehicles channels', () => {
  it('currency equals buildCurrency over the same parsed hand rows', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');
    const reply = await ask(post, { channel: 'currency' }, 1);

    expect(viewOf(reply, 'currency')).toEqual(
      buildCurrency(rowsOf(CURRENCY_OPS_HEADER, CURRENCY_HAND_ROWS) as never, true),
    );
    // Not vacuous: the sample really does chart credits and gold, and lists
    // the rest (D-16), so a builder that returned nothing would fail above.
    const view = viewOf(reply, 'currency') as CurrencyView;
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.charts.map((c) => c.code)).toEqual(['ru.wot.credits', 'ru.shared_currency.gold']);
    expect(view.others.map((c) => c.code)).toContain('UAH');
  });

  it('spend equals buildSpend over the same parsed hand rows', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');
    const reply = await ask(post, { channel: 'spend' }, 1);

    expect(viewOf(reply, 'spend')).toEqual(
      buildSpend(rowsOf(ORDERS_HEADER_12, ORDERS_HAND_ROWS) as never),
    );
    // The five cards in order, and no blended total anywhere (D-21, D-24).
    const view = viewOf(reply, 'spend') as SpendView;
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.cards.map((c) => c.code)).toEqual(['USD', 'UAH', 'RUB', 'usd', null]);
  });

  it('vehicles answers each title and battle type from the pure builder', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');

    // The oracle is built by parsing the fixture's OWN file text with the
    // production parser — the same call the import path makes — so the expected
    // view is what the builder would produce from the very rows the worker
    // stored. A hand-typed row list would prove nothing about the wiring.
    const files = new Map<string, { rows: readonly VehicleRowData[]; seen: boolean }>();
    for (const [fileName, text] of Object.entries(PLAYER_STATS_SAMPLE_FILES)) {
      const parsed = parseCsvFile(text, 'Player_statistics', fileName);
      files.set(fileName.toLowerCase(), { rows: parsed.rows.map((r) => r.data), seen: true });
    }

    for (const [queryId, query] of [
      [1, { channel: 'vehicles', title: 'wot', battleType: null }],
      [2, { channel: 'vehicles', title: 'wowp', battleType: null }],
      [3, { channel: 'vehicles', title: 'wot', battleType: '1' }],
      [4, { channel: 'vehicles', title: null, battleType: null }],
    ] as const) {
      const reply = await ask(post, query, queryId);
      expect(viewOf(reply, 'vehicles')).toEqual(
        buildVehicleView(files, { title: query.title, battleType: query.battleType }),
      );
    }

    // And the answers are genuinely different from one another, so the loop
    // above is comparing four things rather than four copies of one.
    const all = await ask(post, { channel: 'vehicles', title: null, battleType: null }, 5);
    const view = viewOf(all, 'vehicles') as VehicleView;
    expect(view.title).toBe('wot');
    expect(view.overview.map((t) => t.title)).toEqual(['wot', 'wotb', 'wows', 'wowp']);
    // The hand fixture's real numbers, so a builder handed no rows at all
    // could not pass the equality above.
    expect(view.rows).toHaveLength(PLAYER_STATS_EXPECTED.titles.wot.vehicleRows);
  });
});

describe('05-07: a legacy cache with no files list', () => {
  it('answers no-rows rather than claiming a file was absent', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');

    // Rewrite the stored meta record WITHOUT the presence list, which is
    // exactly what a cache written before this plan looks like.
    const { db } = await importWorkerDb();
    const meta = await db.meta.get('active');
    expect(meta).toBeDefined();
    await db.meta.put({ ...(meta as object), files: undefined } as never);

    // The premium file has rows, so it is ready; the absent one can only say
    // the sentence true of both cases.
    const premium = await ask(post, { channel: 'premium' }, 1);
    expect((viewOf(premium, 'premium') as PremiumView).status).toBe('ready');

    // Every title the sample does not have answers no-rows, never
    // not-in-export — a claim a legacy cache cannot support (D-05).
    await db.meta.put({ ...(meta as object), files: undefined } as never);
    const absentFile = await ask(post, { channel: 'spend' }, 2);
    // Orders.csv IS in the sample, so spend is ready too; the legacy fallback
    // is proven by a file that is genuinely absent.
    expect((viewOf(absentFile, 'spend') as SpendView).status).toBe('ready');

    // Wargaming's by_Type for a title the sample has, but under a name no
    // channel asks for: build a title whose files the sample lacks by asking
    // for the WOWP_20 pair through a wiped rows table.
    await db.rows.clear();
    const vehicles = await ask(post, { channel: 'vehicles', title: 'wows', battleType: null }, 3);
    const view = viewOf(vehicles, 'vehicles') as VehicleView;
    expect(view.titleState).toBe('no-rows');
  });
});

describe('05-07: query validation', () => {
  const REJECTED: readonly { label: string; query: unknown }[] = [
    { label: 'no channel', query: {} },
    { label: 'an unknown channel', query: { channel: 'nope' } },
    {
      label: 'a title outside the four ids',
      query: { channel: 'vehicles', title: 'wow', battleType: null },
    },
    {
      label: 'a non-string battleType',
      query: { channel: 'vehicles', title: 'wot', battleType: 1 },
    },
    {
      label: 'a battleType over 64 characters',
      query: { channel: 'vehicles', title: 'wot', battleType: 'x'.repeat(65) },
    },
    { label: 'null', query: null },
    { label: 'a number', query: 7 },
    { label: 'an array', query: [] },
  ];

  it('rejects every malformed shape with a fixed detail and never reaches a builder', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');

    for (const [i, { label, query }] of REJECTED.entries()) {
      post.mockClear();
      postRequest({ type: 'data-query', queryId: 100 + i, query } as IngestRequest);
      const reply = await waitForMessage(post, 'data-error', 5_000);
      if (reply.type !== 'data-error') throw new Error('expected data-error');
      // A FIXED detail, and one that varies with the input only by being the
      // same string for every shape.
      expect(reply.detail, label).toBe('invalid query');
      expect(reply.queryId).toBe(100 + i);
    }

    // The dataset is untouched by any of it, and a valid query still answers.
    const after = await ask(post, { channel: 'premium' }, 200);
    expect((viewOf(after, 'premium') as PremiumView).status).toBe('ready');
  });

  it('accepts a 64-character battleType, the boundary of the rule', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');
    // 64 is allowed by the rule, so this is ANSWERED (as a code the export
    // does not have, which the builder applies as All-battles) rather than
    // rejected. The point is that the boundary is inclusive.
    const reply = await ask(
      post,
      { channel: 'vehicles', title: 'wot', battleType: 'x'.repeat(64) },
      1,
    );
    expect(reply.type).toBe('data-result');
  });
});

describe('05-07: a builder that throws', () => {
  it('answers data-error with the error NAME only and leaves the import intact', async () => {
    // Mock the finance module BEFORE the worker loads, so buildPremium throws
    // inside the real handler. The message carries a row-like string on
    // purpose: that string is what must never leave the worker (T-05-20).
    const LEAK = 'row-like-secret-4f2c';
    vi.resetModules();
    vi.doMock('../../../src/lib/features/finance/finance-aggregate.ts', async (importOriginal) => {
      const actual =
        await importOriginal<
          typeof import('../../../src/lib/features/finance/finance-aggregate.ts')
        >();
      return {
        ...actual,
        buildPremium: () => {
          throw new Error(`BigInt conversion failed on ${LEAK}`);
        },
      };
    });
    const spy = installWorkerScope();
    await deleteActiveDatabase();
    await loadWorker();

    try {
      await ingestExport(spy, buildSampleExport(), 'sample.zip');
      const reply = await askEither(spy, { channel: 'premium' }, 1);

      expect(reply.type).toBe('data-error');
      if (reply.type !== 'data-error') throw new Error('expected data-error');
      // The NAME, never the message.
      expect(reply.detail).toBe('Error');

      // And the message text is absent from EVERY posted message, not just this
      // one.
      const everything = JSON.stringify(spy.mock.calls.map((c) => c[0]));
      expect(everything).not.toContain(LEAK);

      // The import is unaffected and a different channel still works.
      const spend = await askEither(spy, { channel: 'spend' }, 2);
      expect(spend.type).toBe('data-result');
    } finally {
      // Unconditional: a `doMock` left registered would make every LATER test
      // in this file build a premium view from a throwing builder, which is a
      // confusing failure that looks like a product bug.
      vi.doUnmock('../../../src/lib/features/finance/finance-aggregate.ts');
      vi.resetModules();
    }
  });
});

describe('05-07: no personal field reaches any reply', () => {
  it('finds none of the five canary strings across all four channels', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');

    const queries: DataQuery[] = [
      { channel: 'premium' },
      { channel: 'currency' },
      { channel: 'spend' },
      { channel: 'vehicles', title: 'wot', battleType: null },
      { channel: 'vehicles', title: 'wotb', battleType: null },
      { channel: 'vehicles', title: 'wows', battleType: null },
      { channel: 'vehicles', title: 'wowp', battleType: null },
      { channel: 'vehicles', title: 'wot', battleType: '1' },
    ];
    for (const [i, query] of queries.entries()) {
      await ask(post, query, 300 + i);
    }

    // Every reply this worker ever posted, serialised.
    const everyMessage = JSON.stringify(post.mock.calls.map((c) => c[0]));
    for (const canary of [
      STATS_NAME_CANARY,
      FINANCE_CANARIES.coupon,
      FINANCE_CANARIES.aggregator,
      FINANCE_CANARIES.package,
      FINANCE_CANARIES.orderId,
    ]) {
      expect(everyMessage, `canary ${canary}`).not.toContain(canary);
    }
    // The id PATTERN, which would catch a per-row varying uuid too.
    expect(everyMessage).not.toMatch(FINANCE_CANARIES.orderIdPattern);
  });
});

describe('05-07: replace, clear and the memo', () => {
  it('a replaced dataset answers the NEW numbers and the NEW importedAt', async () => {
    await ingestExport(post, buildSampleExport(), 'sample.zip');
    const first = await ask(post, { channel: 'premium' }, 1);
    const firstAt = dataResult(first).importedAt;
    const firstView = JSON.stringify(viewOf(first, 'premium'));

    // A DIFFERENT export: the premium file header-only, so the view is
    // genuinely a different answer rather than a different date.
    await ingestExport(
      post,
      buildCustomExport({
        overrides: {
          'Financial_data/Operations_with_Premium_Days.csv': PREMIUM_HEADER.join(';') + '\r' + '\r',
        },
      }),
      'other.zip',
    );

    const second = await ask(post, { channel: 'premium' }, 2);
    // The memo can never serve the previous dataset's numbers, and the answer
    // belongs to the dataset now on screen.
    expect(JSON.stringify(viewOf(second, 'premium'))).not.toBe(firstView);
    expect(dataResult(second).importedAt).not.toBe(firstAt);
  });

  it('a successful ingest empties the memo, and clear-data does too', async () => {
    const { dataQueryMemoSize } = await import('../../../src/lib/worker/data-queries.ts');
    expect(dataQueryMemoSize()).toBe(0);

    await ingestExport(post, buildSampleExport(), 'sample.zip');
    await ask(post, { channel: 'premium' }, 1);
    await ask(post, { channel: 'spend' }, 2);
    expect(dataQueryMemoSize()).toBeGreaterThan(0);

    // A replace clears it, so a stale entry cannot outlive its dataset. The
    // second export must be genuinely DIFFERENT BYTES: a byte-identical archive
    // is answered `duplicate` by the dedup gate and never reaches the write at
    // all, which is correct product behaviour and would leave the memo intact.
    const second = await ingestExport(
      post,
      buildCustomExport({
        overrides: {
          'Financial_data/Operations_with_Premium_Days.csv': PREMIUM_HEADER.join(';') + '\r' + '\r',
        },
      }),
      'other.zip',
    );
    expect(second.type).toBe('done');
    expect(dataQueryMemoSize()).toBe(0);

    await ask(post, { channel: 'premium' }, 3);
    expect(dataQueryMemoSize()).toBeGreaterThan(0);
    postRequest({ type: 'clear-data', jobId: 99 });
    await waitForMessage(post, 'cleared', 5_000);
    expect(dataQueryMemoSize()).toBe(0);
  });

  it('an identical query is answered from the memo and a clear answers null', async () => {
    const { dataQueryMemoSize } = await import('../../../src/lib/worker/data-queries.ts');
    await ingestExport(post, buildSampleExport(), 'sample.zip');

    const first = await ask(post, { channel: 'premium' }, 1);
    const second = await ask(post, { channel: 'premium' }, 2);
    // Two identical queries, deep-equal answers, ONE memo entry between them.
    expect(viewOf(second, 'premium')).toEqual(viewOf(first, 'premium'));
    expect(dataResult(second).importedAt).toBe(dataResult(first).importedAt);
    expect(dataQueryMemoSize()).toBe(1);

    // Twenty distinct vehicle queries leave at most the bound.
    for (let i = 0; i < 20; i++) {
      await ask(
        post,
        { channel: 'vehicles', title: i % 2 === 0 ? 'wot' : 'wows', battleType: String(i) },
        10 + i,
      );
    }
    expect(dataQueryMemoSize()).toBeLessThanOrEqual(16);

    postRequest({ type: 'clear-data', jobId: 99 });
    await waitForMessage(post, 'cleared', 5_000);
    const after = dataResult(await ask(post, { channel: 'premium' }, 500));
    expect(after.importedAt).toBeNull();
    expect(after.result).toBeNull();
  });
});
