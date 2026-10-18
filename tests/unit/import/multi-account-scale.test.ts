import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteActiveDatabase,
  importWorkerDb,
  ingestExport,
  installWorkerScope,
  loadWorker,
  postRequest,
  type WorkerPostSpy,
} from '../../helpers/worker-harness.ts';
import {
  MA_LARGE_ROOTS_D16_ORDER,
  MA_LARGE_VEHICLE_COUNTS,
  buildLargeThreeAccountExport,
  type LargeSessionPair,
  type LargeThreeAccountExpected,
} from '../../fixtures/multi-account-fixtures.ts';
import { oracleCurrency, type OracleRow } from '../../helpers/finance-oracle.ts';
import { MAX_LOGIN_IPS } from '../../../src/lib/features/logins/login-shared.ts';
import type {
  DataQuery,
  DataResult,
  IngestRequest,
  IngestResponse,
  PlaytimeSlice,
  PlaytimeView,
} from '../../../src/lib/core/types/worker-messages.ts';

// =============================================================================
// multi-account-scale.test.ts — the LARGE three-account import (Phase 10, 10-06)
//
// SCALE-01 / D-17. One synthetic archive with a 54,000-row currency file, about
// 20,000 sessions over three games, 7,000 vehicle rows and a login history that
// shares addresses across accounts is imported ONCE through the real worker and
// read many times.
//
// Every expected figure is computed here from `expected` (the generated text and
// the generated sessions), never from the app: playtime from a minute bitmap,
// currency from `oracleCurrency`, vehicles and logins from the generator's own
// counts. A test that read its answer back from the code it checks would pass
// against a wrong aggregator.
//
// MEASURED on the development machine (Apple silicon, Node 24, fake-indexeddb):
// the 1.37 MB archive imports through the worker in about 1.8 s, the currency
// query answers in about 0.25 s, and the whole file runs in under 3 s, so the
// sessions and vehicles were NOT shrunk (D-17 allows it only past roughly 90 s).
// =============================================================================

/** The longest any one `it` may take (the import itself is in `beforeAll`). */
const IT_TIMEOUT_MS = 120_000;

/** `beforeAll` ceiling: building the archive and importing it through the worker. */
const SETUP_TIMEOUT_MS = 300_000;

/** The longest one ask may wait for its reply. */
const ASK_TIMEOUT_MS = 60_000;

/** The generous bound on the currency query, through the worker (item h). */
const CURRENCY_QUERY_BOUND_MS = 30_000;

let post: WorkerPostSpy;
let expected: LargeThreeAccountExpected;
let done: Extract<IngestResponse, { type: 'done' }>;
let nextQueryId = 1;

/** Poll the spy until `pick` finds this query's reply. */
async function waitFor<T>(label: string, pick: (msg: IngestResponse) => T | undefined): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < ASK_TIMEOUT_MS) {
    for (const call of post.mock.calls) {
      const found = pick(call[0] as IngestResponse);
      if (found !== undefined) return found;
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`${label}: no reply within ${ASK_TIMEOUT_MS} ms`);
}

/** Post one data-query and return the result it answered with. */
async function askData(query: DataQuery): Promise<DataResult> {
  const queryId = nextQueryId++;
  post.mockClear();
  postRequest({ type: 'data-query', queryId, query } as IngestRequest);
  return waitFor(`askData(${query.channel})`, (msg) => {
    if (msg.type === 'data-error') {
      throw new Error(`expected a data-result, got data-error (${msg.detail})`);
    }
    if (msg.type === 'data-result' && msg.queryId === queryId) {
      if (msg.result === null) throw new Error('the worker answered a null result');
      return msg.result;
    }
    return undefined;
  });
}

/** Post one playtime query for a game (null is All) and return the ready slice. */
async function askPlaytime(game: string | null): Promise<PlaytimeSlice> {
  const queryId = nextQueryId++;
  post.mockClear();
  postRequest({ type: 'playtime-query', queryId, valueIndex: null, game } as IngestRequest);
  const view = await waitFor<PlaytimeView>(`askPlaytime(${game})`, (msg) => {
    if (msg.type === 'playtime-error') {
      throw new Error(`expected a playtime-result, got playtime-error (${msg.detail})`);
    }
    if (msg.type === 'playtime-result' && msg.queryId === queryId) {
      if (msg.view === null) throw new Error('the worker answered a null playtime view');
      return msg.view;
    }
    return undefined;
  });
  if (view.status !== 'ready') throw new Error(`expected ready, got ${view.status}`);
  return view.slice;
}

/**
 * The independent playtime oracle: a MINUTE BITMAP.
 *
 * Every minute covered by any session is marked in one `Uint8Array` spanning the
 * whole range, and the answer is the marked count times sixty. This shares no
 * code with the app's interval merge (sort and sweep), and a 14-year span is
 * fine here although `oracleSlice` refuses anything over 400 days. Sessions are
 * counted as ROWS and active days as distinct start days (D-07 as amended).
 */
function minuteBitmapOracle(pairs: readonly LargeSessionPair[]): {
  seconds: number;
  sessions: number;
  days: number;
} {
  let low = Infinity;
  let high = -Infinity;
  for (const [start, end] of pairs) {
    if (start < low) low = start;
    if (end > high) high = end;
  }
  const firstMinute = Math.floor(low / 60);
  const minutes = Math.ceil(high / 60) - firstMinute;
  const bitmap = new Uint8Array(minutes);
  const days = new Set<number>();
  for (const [start, end] of pairs) {
    bitmap.fill(1, Math.floor(start / 60) - firstMinute, Math.floor(end / 60) - firstMinute);
    days.add(Math.floor(start / 86_400));
  }
  let marked = 0;
  for (let i = 0; i < bitmap.length; i++) marked += bitmap[i]!;
  return { seconds: marked * 60, sessions: pairs.length, days: days.size };
}

/**
 * Split a generated, quote-all CSV into header-keyed rows for the oracle.
 *
 * Naive on purpose: the generator quotes nothing that needs quoting, and an
 * oracle sharing the production parser would validate the parser against itself.
 */
function splitFixtureCsv(csv: string): OracleRow[] {
  const [headerLine, ...dataLines] = csv.split('\r');
  const unquote = (cell: string): string => cell.replace(/^"(.*)"$/s, '$1');
  const header = (headerLine ?? '').split(';').map(unquote);
  return dataLines
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const cells = line.split(';').map(unquote);
      const row: Record<string, string> = {};
      header.forEach((name, i) => {
        row[name] = cells[i] ?? '';
      });
      return row;
    });
}

/** Oracle thousandths to the micro-units the app stores, exactly. */
const micro = (thousandths: number): bigint => BigInt(thousandths) * 1000n;

beforeAll(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();

  const built = buildLargeThreeAccountExport();
  expected = built.expected;

  const started = performance.now();
  const terminal = await ingestExport(post, built.bytes, 'large-three.zip', 240_000);
  console.log(
    `[10-06] large import through the worker: ${Math.round(performance.now() - started)} ms ` +
      `(${built.bytes.byteLength} zip bytes)`,
  );
  if (terminal.type !== 'done') {
    throw new Error(
      `the large import did not finish: ${terminal.type}${
        terminal.type === 'error' ? ` (${terminal.detail})` : ''
      }`,
    );
  }
  done = terminal;
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  await deleteActiveDatabase();
});

describe('Phase 10 scale: the large three-account import (SCALE-01, D-17)', () => {
  it(
    'publishes three accounts in D-16 order, stores version-3 aggregates and keeps the schema at version 2',
    async () => {
      expect(done.result.accounts?.map((account) => account.root)).toEqual(
        MA_LARGE_ROOTS_D16_ORDER,
      );

      const { db } = await importWorkerDb();
      const meta = await db.meta.get('active');
      if (meta === undefined) throw new Error('no stored meta record');
      expect(meta.playtime?.v).toBe(3);
      expect(meta.playtime?.byGame?.map((entry) => entry.game)).toEqual(['WOT', 'WOTB', 'WOWS']);
      expect(meta.logins?.v).toBe(3);
      // D-16: the non-indexed `account` field stayed non-indexed. An indexed key
      // later needs a `version(3)` with a lossless upgrader (costly to reverse).
      expect(db.verno).toBe(2);
    },
    IT_TIMEOUT_MS,
  );

  it(
    'answers playtime for All and for each game from a minute-bitmap oracle',
    async () => {
      const cases = [
        { game: null, pairs: expected.sessions.all, sessions: 20_000 },
        { game: 'WOT', pairs: expected.sessions.WOT, sessions: 12_000 },
        { game: 'WOTB', pairs: expected.sessions.WOTB, sessions: 6_500 },
        { game: 'WOWS', pairs: expected.sessions.WOWS, sessions: 1_500 },
      ] as const;
      for (const { game, pairs, sessions } of cases) {
        const label = game ?? 'All';
        const oracle = minuteBitmapOracle(pairs);
        expect(oracle.sessions, `${label} generated sessions`).toBe(sessions);
        const slice = await askPlaytime(game);
        expect(slice.seconds, `${label} seconds`).toBe(oracle.seconds);
        expect(slice.sessions, `${label} sessions`).toBe(sessions);
        expect(slice.dayIndex.length, `${label} active days`).toBe(oracle.days);
        expect(slice.excluded, `${label} excluded rows`).toBe(0);
      }
    },
    IT_TIMEOUT_MS,
  );

  it(
    'answers the vehicles channel with 7,000 rows split 5,000 / 1,500 / 500 by account',
    async () => {
      const result = await askData({ channel: 'vehicles', title: null, battleType: null });
      if (result.channel !== 'vehicles') throw new Error('expected the vehicles channel');
      expect(result.view.title).toBe('wot');
      expect(result.view.rows).toHaveLength(7_000);
      const byAccount = new Map<string, number>();
      for (const row of result.view.rows) {
        byAccount.set(row.account, (byAccount.get(row.account) ?? 0) + 1);
      }
      expect([...byAccount.keys()].sort()).toEqual([...MA_LARGE_ROOTS_D16_ORDER].sort());
      MA_LARGE_ROOTS_D16_ORDER.forEach((root, index) => {
        expect(byAccount.get(root), `vehicle rows of ${root}`).toBe(MA_LARGE_VEHICLE_COUNTS[index]);
        expect(byAccount.get(root)).toBe(expected.vehicleCounts[root]);
      });
    },
    IT_TIMEOUT_MS,
  );

  it(
    'answers the logins channel with every address once, its accounts named, and the totals adding up',
    async () => {
      const result = await askData({ channel: 'logins' });
      if (result.channel !== 'logins') throw new Error('expected the logins channel');
      const view = result.view;
      if (view.status !== 'ready') throw new Error(`expected ready, got ${view.status}`);

      expect(view.addresses.length).toBeLessThanOrEqual(MAX_LOGIN_IPS);
      expect(view.totalLogins).toBe(20_000);
      const countryLogins = view.countries.reduce((sum, country) => sum + country.logins, 0);
      expect(countryLogins + view.unknown.logins).toBe(view.totalLogins);
      const listedLogins = view.addresses.reduce((sum, address) => sum + address.logins, 0);
      expect(listedLogins + view.other.logins).toBe(view.totalLogins);

      // The distinct address set is the generator's, one row per address (D-05).
      expect(view.addresses.length).toBe(expected.addresses.length);
      expect(view.addresses.map((address) => address.ip).sort()).toEqual([...expected.addresses]);

      for (const address of view.addresses) {
        const accounts = address.accounts ?? [];
        expect(accounts.length, `accounts of ${address.ip}`).toBeGreaterThanOrEqual(1);
        expect(accounts, `accounts of ${address.ip} sorted`).toEqual([...accounts].sort());
      }
      // The pool is shared, so at least one address names more than one account.
      expect(view.addresses.some((address) => (address.accounts ?? []).length > 1)).toBe(true);
    },
    IT_TIMEOUT_MS,
  );

  it(
    'merges the three currency files exactly as oracleCurrency does, and measures the query',
    async () => {
      expect(expected.currencyCsvs.map((csv) => splitFixtureCsv(csv).length)).toEqual([
        54_000, 2_000, 500,
      ]);
      const rows = expected.currencyCsvs.flatMap((csv) => splitFixtureCsv(csv));
      const oracle = oracleCurrency(rows);

      const started = performance.now();
      const result = await askData({ channel: 'currency' });
      const elapsed = performance.now() - started;
      console.log(`[10-06] currency query through the worker: ${Math.round(elapsed)} ms`);
      expect(elapsed).toBeLessThan(CURRENCY_QUERY_BOUND_MS);

      if (result.channel !== 'currency') throw new Error('expected the currency channel');
      const view = result.view;
      if (view.status !== 'ready') throw new Error(`expected ready, got ${view.status}`);

      expect(view.excluded, 'excluded rows').toBe(oracle.excluded);
      expect(view.charts.map((chart) => chart.code ?? '')).toEqual(
        oracle.charted.map((group) => group.code),
      );
      expect(view.others.map((other) => other.code ?? '')).toEqual(
        oracle.others.map((group) => group.code),
      );
      const pairs = [
        [view.charts, oracle.charted],
        [view.others, oracle.others],
      ] as const;
      for (const [actual, wanted] of pairs) {
        wanted.forEach((group, index) => {
          const entry = actual[index]!;
          expect(entry.ops, `${group.code} operations`).toBe(group.operations);
          expect(BigInt(entry.inUnits), `${group.code} deposited`).toBe(
            micro(group.depositedThousandths),
          );
          expect(BigInt(entry.outUnits), `${group.code} withdrawn`).toBe(
            micro(group.withdrawnThousandths),
          );
        });
      }
    },
    IT_TIMEOUT_MS,
  );

  it(
    'splits every Payments card per account so the shares add up to the card',
    async () => {
      const result = await askData({ channel: 'spend' });
      if (result.channel !== 'spend') throw new Error('expected the spend channel');
      const view = result.view;
      if (view.status !== 'ready') throw new Error(`expected ready, got ${view.status}`);
      expect(view.cards.length).toBeGreaterThan(0);

      const contributors = new Set<string>();
      for (const card of view.cards) {
        const label = card.code ?? 'no unit';
        let paid = 0;
        let units = 0n;
        for (const share of card.byAccount) {
          paid += share.paid;
          units += BigInt(share.units);
          contributors.add(share.account);
        }
        expect(paid, `${label} paid orders`).toBe(card.paid);
        expect(units, `${label} units`).toBe(BigInt(card.units));
      }
      // Every account carries the same hand Orders file, so all three pay.
      expect([...contributors].sort()).toEqual([...MA_LARGE_ROOTS_D16_ORDER].sort());
    },
    IT_TIMEOUT_MS,
  );
});
