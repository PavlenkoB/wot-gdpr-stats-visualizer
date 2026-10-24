import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  DataQuery,
  IngestResponse,
  PlaytimeAggregates,
} from '../../../src/lib/core/types/worker-messages.ts';
import {
  OVERVIEW_TILE_IDS,
  OVERVIEW_TILE_NEEDS,
  type OverviewAbsentTile,
  type OverviewReadyTile,
  type OverviewTile,
  type OverviewView,
} from '../../../src/lib/features/overview/overview-shared.ts';
import { PLAYTIME_VERSION } from '../../../src/lib/features/playtime/playtime-shared.ts';
import { DATA_FILES, isDataQuery } from '../../../src/lib/worker/data-queries.ts';
import { HAND_ALL_SECONDS, HAND_ROWS } from '../../fixtures/playtime-hand-fixture.ts';
import {
  OV_NAME_CANARY,
  buildOverviewInsightExport,
  type OverviewOmit,
} from '../../fixtures/overview-fixtures.ts';
import { OV_EXPECTED } from '../../helpers/overview-oracle.ts';
import {
  buildSessionsCsvFromRows,
  buildSessionsExportFromCsv,
} from '../../fixtures/sessions-fixtures.ts';
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

// =============================================================================
// Plan 13-01 — the `overview` channel: the validator and the channel table
// =============================================================================
//
// WHAT THIS PINS
//   - the bare `{ channel: 'overview' }` is the ONLY well-formed shape: a
//     smuggled `title`, `battleType`, `game` or arbitrary extra key is
//     rejected, and an INHERITED key does not make a query well-formed;
//   - a malformed overview query is answered with the FIXED detail
//     `invalid query`, never an echo of the message that failed the check
//     (T-13-02);
//   - the channel's file table names exactly the four files the Overview
//     reads, in the three categories it accepts;
//   - the shared view contract carries sixteen catalogue-ordered tile ids, a
//     source for every one of them, and NO dependency of any kind — the file
//     is imported by both the worker and the page, so a dependency there would
//     leak into one of the two bundles.
//
// The tracer cases — the answer through the REAL worker — live in the
// "tracer" describe at the end of this file.
const WAIT_MS = 5_000;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OVERVIEW_SHARED = path.join(
  REPO_ROOT,
  'src',
  'lib',
  'features',
  'overview',
  'overview-shared.ts',
);

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

describe('the overview channel is a strict field-less query', () => {
  it('accepts the bare query and rejects every smuggled field', () => {
    expect(isDataQuery({ channel: 'overview' })).toBe(true);
    expect(isDataQuery({ channel: 'overview', title: 'wot' })).toBe(false);
    expect(isDataQuery({ channel: 'overview', title: null })).toBe(false);
    expect(isDataQuery({ channel: 'overview', battleType: 'random' })).toBe(false);
    expect(isDataQuery({ channel: 'overview', battleType: null })).toBe(false);
    expect(isDataQuery({ channel: 'overview', game: 'wot' })).toBe(false);
    expect(isDataQuery({ channel: 'overview', anything: 'else' })).toBe(false);
  });

  it('rejects an inherited channel: own keys are what count', () => {
    // `Object.keys` reads OWN enumerable properties only, so a message that
    // carries its channel on the prototype is not a well-formed query. The
    // same rule protects every other field-less channel.
    const inherited = Object.create({ channel: 'overview' }) as object;
    expect(isDataQuery(inherited)).toBe(false);
  });

  it('answers a malformed overview query with the fixed invalid query detail', async () => {
    postRequest({
      type: 'data-query',
      queryId: 31,
      query: { channel: 'overview', title: 'wot' } as unknown as DataQuery,
    });
    const reply = await waitForMessage(post, 'data-error', WAIT_MS);
    if (reply.type !== 'data-error') throw new Error('expected data-error');
    expect(reply.detail).toBe('invalid query');
  });
});

describe('the channel table and the view contract cannot drift', () => {
  it('names exactly the four Overview files in the three Overview categories', () => {
    expect(DATA_FILES.overview.names).toEqual(
      new Set([
        'wot_account_statistics.csv',
        'wot_vehicle_statistics.csv',
        'virtual_currencies_operations.csv',
        'orders.csv',
      ]),
    );
    expect(DATA_FILES.overview.categories).toEqual([
      'player_statistics',
      'financial_data',
      'payment_history',
    ]);
  });

  it('carries sixteen catalogue-ordered tile ids and a source for every one', () => {
    expect(OVERVIEW_TILE_IDS).toHaveLength(16);
    expect(new Set(OVERVIEW_TILE_IDS).size).toBe(16);
    for (const id of OVERVIEW_TILE_IDS) {
      expect(OVERVIEW_TILE_NEEDS[id], id).toBeTruthy();
    }
  });

  it('the shared contract has no dependency of any kind', () => {
    // The file is imported by BOTH the worker and the page, so a dependency
    // there would pull a module into one of the two bundles. Read RAW: the
    // check is on the source text, so a stripped or transpiled copy would
    // not prove it.
    const source = readFileSync(OVERVIEW_SHARED, 'utf8');
    const offending = source.split('\n').filter((line) => line.startsWith('import'));
    expect(offending).toEqual([]);
  });
});

// =============================================================================
// The tracer: one path from the stored session rows to the Logged in tile
// =============================================================================
//
// WHAT THIS PROVES
//   The whole chain, through the REAL worker and the REAL database: an import
//   of a legacy Sessions.csv is answered by the `overview` channel from ONE
//   snapshot, the answer carries sixteen catalogue-ordered tiles with the
//   Logged in tile real and the other fifteen absent, a second ask is served
//   from the memo, a STALE stored aggregate is rebuilt from the stored session
//   rows, and a cleared dataset answers null.
//
// WHY THE REAL WORKER
//   A builder test would prove the arithmetic; this proves the WIRING — the
//   channel table, the snapshot's playtime field, the rebuild rule and the
//   memo — which is what the rest of the phase copies.
describe('the tracer: one answer from stored session rows to the Logged in tile', () => {
  let nextQueryId = 400;

  /** Ask the overview channel and return the posted reply, result or not. */
  async function askOverview(): Promise<Extract<IngestResponse, { type: 'data-result' }>> {
    post.mockClear();
    postRequest({ type: 'data-query', queryId: nextQueryId++, query: { channel: 'overview' } });
    const reply = await waitForMessage(post, 'data-result', WAIT_MS);
    if (reply.type !== 'data-result') throw new Error('expected data-result');
    return reply;
  }

  /** The Logged in tile, when it is real. */
  function loggedOf(view: OverviewView): Extract<OverviewReadyTile, { id: 'logged' }> {
    for (const tile of view.tiles) {
      if (tile.id === 'logged' && tile.status === 'ok') return tile;
    }
    throw new Error('no ready logged tile');
  }

  it('answers from one snapshot, memoises, rebuilds a stale aggregate and clears to null', async () => {
    // The worker's OWN module instances: the harness resets the module
    // registry before the worker is imported, so a static import at the top of
    // this file would be a DIFFERENT instance of the memo.
    const { dataQueryMemoSize, clearDataQueryMemo } =
      await import('../../../src/lib/worker/data-queries.ts');
    const { db } = await importWorkerDb();

    const bytes = buildSessionsExportFromCsv(buildSessionsCsvFromRows(HAND_ROWS));
    const terminal = await ingestExport(post, bytes, 'hand-sessions.zip');
    expect(terminal.type).toBe('done');

    const first = await askOverview();
    expect(first.result?.channel).toBe('overview');
    const view = first.result!.view as OverviewView;

    // The answer carries the dataset's own date, read in the same transaction
    // as the rows behind it.
    const meta = await db.meta.get('active');
    expect(first.importedAt).toBe(meta?.importedAt);

    // Sixteen tiles, in catalogue order.
    expect(view.tiles).toHaveLength(16);
    expect(view.tiles.map((tile) => tile.id)).toEqual([...OVERVIEW_TILE_IDS]);

    // The Logged in tile is real, and its seconds are the merged union.
    const logged = loggedOf(view);
    expect(logged.seconds).toBe(HAND_ALL_SECONDS);
    expect(logged.firstDay).toBeLessThan(logged.lastDay!);
    expect(logged.battleSeconds).toBeNull();
    expect(view.firstDay).toBe(logged.firstDay);
    expect(view.lastDay).toBe(logged.lastDay);

    // The other fifteen are absent, each with the source it needs.
    //
    // 13-07 wired the eight Tanks and Records tiles and 13-08 wired the three
    // Totals tiles, and they are all absent HERE for the same reason as the
    // four habits: this export is a legacy Sessions.csv and carries NEITHER
    // statistics file, no currency log and no orders file, so those groups
    // have no source at all.
    //
    // The four HABIT tiles are absent for a second, sharper reason (D-20,
    // T-13-25): the habits are claims about WoT sessions, and a legacy
    // Sessions.csv names no game at all — so it cannot make that claim even
    // though Logged in, which counts every game, is ready.
    //
    // The list is spelled out rather than derived, so a tile that grew a
    // source without the export growing one would fail loudly.
    const absentHere = [
      'hour',
      'streak',
      'sess',
      'busy',
      'tank',
      'cls',
      'fleet',
      'nat',
      'dmg',
      'xp',
      'kills',
      'snip',
      'cred',
      'bat',
      'ord',
    ];
    for (const tile of view.tiles) {
      if (tile.id === 'logged') continue;
      expect(absentHere, tile.id).toContain(tile.id);
      if (tile.status !== 'absent') throw new Error(`expected absent, got ${tile.status}`);
      expect(tile.need, tile.id).toBe(OVERVIEW_TILE_NEEDS[tile.id]);
      expect(tile.column, tile.id).toBeNull();
    }
    expect(view.tiles.filter((tile) => tile.status === 'absent')).toHaveLength(absentHere.length);

    // The four habits need the SESSION HISTORY the legacy file cannot name:
    // they are absent because the export carries no WoT session file, and the
    // absent row says so in the same words as the rest.
    for (const id of ['hour', 'streak', 'sess', 'busy']) {
      const tile = view.tiles.find((entry) => entry.id === id);
      if (tile === undefined || tile.status !== 'absent') {
        throw new Error(`expected an absent ${id} tile`);
      }
      expect(tile.need, id).toBe('session-history');
    }

    // A legacy Sessions.csv names no game, so the per-game strip is empty.
    expect(view.life).toEqual([]);
    expect(view.accountCount).toBe(1);

    // A second ask is served from the memo: one entry, an equal answer.
    const second = await askOverview();
    expect(second.result!.view).toEqual(first.result!.view);
    expect(dataQueryMemoSize()).toBe(1);

    // A STALE stored aggregate is rebuilt from the stored session rows. The
    // rewrite happens behind the worker's back, and the memo is keyed by the
    // query and the dataset, so the memo is emptied explicitly here — the
    // point of the case is the REBUILD, not the memo.
    const stored = meta?.playtime;
    expect(stored).toBeTruthy();
    await db.meta.update('active', {
      playtime: {
        ...(stored as PlaytimeAggregates),
        v: PLAYTIME_VERSION - 1,
      } as PlaytimeAggregates,
    });
    clearDataQueryMemo();

    const rebuilt = await askOverview();
    expect(rebuilt.result!.view).toEqual(first.result!.view);
    const after = await db.meta.get('active');
    expect(after?.playtime?.v).toBe(PLAYTIME_VERSION);

    // A cleared dataset answers null: no date, no result.
    postRequest({ type: 'clear-data', jobId: 77 });
    await waitForMessage(post, 'cleared', WAIT_MS);
    const cleared = await askOverview();
    expect(cleared.importedAt).toBeNull();
    expect(cleared.result).toBeNull();
  });
});

// =============================================================================
// The Tanks and Records groups, through the REAL worker (13-07)
// =============================================================================
//
// WHAT THIS PROVES
//   The eight tiles plan 13-07 built are live in the channel's answer: an
//   import of the synthetic archive is answered by the `overview` channel
//   with the tank, class, fleet, nation, damage, XP, kills and sniper-series
//   tiles carrying the oracle's figures.
//
//   The tank table is EMPTY in this repository until the Terms-of-Use
//   checkpoint passes (D-07, plan 13-15), so the answer here is the SECOND
//   world: the tag-derived names, no class anywhere, and no record tank. The
//   figures themselves — the battles, the shares, the fleet, the nation and
//   the four records — do not depend on the table, and they are the oracle's.
//
//   So this case proves the WIRING (the channel reads the two statistics
//   files, the reducers run, the worker-only lookup is passed in), and the
//   unit suites prove the arithmetic against the synthetic table.
describe('the Tanks and Records groups are live in the channel answer', () => {
  let nextQueryId = 500;

  /** Ask the overview channel and return the answer's view. */
  async function askOverview(): Promise<OverviewView> {
    post.mockClear();
    postRequest({ type: 'data-query', queryId: nextQueryId++, query: { channel: 'overview' } });
    const reply = await waitForMessage(post, 'data-result', WAIT_MS);
    if (reply.type !== 'data-result') throw new Error('expected data-result');
    return reply.result!.view as OverviewView;
  }

  /** The ready tile of an id. */
  function readyOf(view: OverviewView, id: string): Extract<OverviewReadyTile, { id: 'dmg' }> {
    const found = view.tiles.find((tile) => tile.id === id);
    if (found === undefined) throw new Error(`no tile ${id}`);
    if (found.status !== 'ok') throw new Error(`expected a ready ${id} tile`);
    return found as Extract<OverviewReadyTile, { id: 'dmg' }>;
  }

  it("answers the eight tiles with the oracle's figures", async () => {
    const bytes = buildOverviewInsightExport();
    const terminal = await ingestExport(post, bytes, 'overview-insights.zip');
    expect(terminal.type).toBe('done');

    const view = await askOverview();
    expect(view.tiles).toHaveLength(16);
    expect(view.tiles.map((tile) => tile.id)).toEqual([...OVERVIEW_TILE_IDS]);

    // The most-played tank: 700 + 200 of 1,500 battles, a share of 0.6. The
    // table is empty, so the name is the tag-derived one and the class is
    // unknown (D-09).
    expect(readyOf(view, 'tank')).toMatchObject({
      status: 'ok',
      name: 'SynthOne',
      battles: 900,
      share: 0.6,
      classKey: 'unknown',
      tier: null,
    });

    // The fleet excludes the garage-only tank.
    expect(readyOf(view, 'fleet')).toMatchObject({ count: 4 });

    // The nation is the tag's prefix.
    expect(readyOf(view, 'nat')).toMatchObject({ nation: 'china', share: 0.6 });

    // The class tile is ABSENT, because no battle resolves a class while the
    // table is empty — and an absent tile is not a zero (D-09).
    const cls = view.tiles.find((tile) => tile.id === 'cls');
    expect(cls?.status).toBe('absent');

    // The four records: the maximum across the two accounts, with no tank,
    // because the empty table has no row for any id.
    expect(readyOf(view, 'dmg')).toMatchObject({ value: 6100, tankName: null });
    expect(readyOf(view, 'xp')).toMatchObject({ value: 2100, tankName: null });
    expect(readyOf(view, 'kills')).toMatchObject({ value: 8, tankName: null });
    expect(readyOf(view, 'snip')).toMatchObject({ value: 9 });
  });

  it('carries no nickname in the answer', async () => {
    const bytes = buildOverviewInsightExport();
    const terminal = await ingestExport(post, bytes, 'overview-insights-2.zip');
    expect(terminal.type).toBe('done');

    const view = await askOverview();
    expect(JSON.stringify(view)).not.toContain(OV_NAME_CANARY);
  });

  it('answers the Totals tiles with the oracle’s figures', async () => {
    // 13-08. The three Totals tiles read the currency log, the account
    // statistics and the orders file — the three files the channel table
    // already named — so the figures here are the ones the WORKER produced
    // from the stored rows.
    const bytes = buildOverviewInsightExport();
    const terminal = await ingestExport(post, bytes, 'overview-totals.zip');
    expect(terminal.type).toBe('done');

    const view = await askOverview();

    // The credits in-flow, as the exact micro-unit string.
    expect(readyOf(view, 'cred')).toMatchObject({ status: 'ok', units: '12000000000000' });

    // The battles and wins summed across the two account folders.
    expect(readyOf(view, 'bat')).toMatchObject({
      status: 'ok',
      battles: 1500,
      wins: 780,
      winRate: 0.52,
    });

    // The order COUNT, and nothing else.
    expect(readyOf(view, 'ord')).toMatchObject({ status: 'ok', count: 3 });
  });
  it('holds a real oracle value in all sixteen tiles, the Time group and the life strip included', async () => {
    // 13-08. The whole archive through the real worker: no tile is absent when
    // its source is present, and the Time group carries the oracle's figures.
    const bytes = buildOverviewInsightExport();
    const terminal = await ingestExport(post, bytes, 'overview-all.zip');
    expect(terminal.type).toBe('done');

    const view = await askOverview();
    expect(view.tiles).toHaveLength(16);

    // The record, class and tank tiles read the tank table, which is empty
    // until plan 13-15, so only the class tile may stay absent (D-09).
    const absent = view.tiles.filter((tile) => tile.status === 'absent').map((tile) => tile.id);
    expect(absent).toEqual(['cls']);

    const sessions = OV_EXPECTED.sessions;
    expect(readyOf(view, 'logged')).toMatchObject({
      seconds: sessions.allSeconds,
      firstDay: sessions.firstDay,
      lastDay: sessions.lastDay,
      years: [...sessions.years],
      battleSeconds: sessions.battleSeconds,
    });
    expect(readyOf(view, 'hour')).toMatchObject({
      hours: [...sessions.hours],
      peakHour: sessions.peakHour,
    });
    expect(readyOf(view, 'streak')).toMatchObject({ days: sessions.streak });
    expect(readyOf(view, 'sess')).toMatchObject({
      seconds: sessions.longestSession.seconds,
      day: sessions.longestSession.day,
    });
    expect(readyOf(view, 'busy')).toMatchObject({
      seconds: sessions.busiestDay.seconds,
      day: sessions.busiestDay.day,
    });

    expect(view.life).toEqual([...sessions.life]);
    expect(view.firstDay).toBe(sessions.firstDay);
    expect(view.lastDay).toBe(sessions.lastDay);
  });
});

// =============================================================================
// 13-11 — the oracle archive through the REAL worker
// =============================================================================
//
// WHAT THIS PROVES
//   The pure builders were proved on hand-built groups (13-07, 13-08). This
//   proves the same hand-derived numbers survive the real import, the real
//   Dexie snapshot, the real stale-aggregate rebuild and `postMessage`.
//
//   Every figure is read from `OV_EXPECTED`, which restates the fixture's
//   arithmetic independently of `src/`; the only literals below are
//   vocabulary (tile ids, need names, tag-derived names), never a figure.
//
// THE TANK TABLE
//   The committed table holds ZERO rows until plan 13-15, so the class tile is
//   absent in the real worker path today. The invented tags and record ids are
//   in NEITHER table state, so tag-derived names and a null record tank hold
//   before and after; every assertion here is written to survive both.

/** A data-result message as the worker posts it. */
type OverviewReply = Extract<IngestResponse, { type: 'data-result' }>;

/** The tag-derived names of the four battled invented tags, most played first. */
const TAG_NAMES = ['SynthOne', 'SynthTwo', 'SynthThree', 'SynthFour'] as const;

/** The vehicle-battle keys of the oracle, most played first. */
const BATTLE_KEYS = ['one', 'two', 'three', 'four'] as const;

/**
 * The need each omit option must name, written out as vocabulary.
 *
 * The oracle's own `needs` strings are descriptive English for the option and
 * not the wire vocabulary, so the mapping to the shared `OverviewNeed` is
 * stated here once and reviewed in one place.
 */
const NEED_OF_OMIT = {
  sessions: 'session-history',
  'wot-sessions': 'session-history',
  'account-statistics': 'account-statistics',
  'vehicle-statistics': 'vehicle-statistics',
  currency: 'currency-operations',
  orders: 'payment-history',
  'record-columns': 'account-statistics',
} as const satisfies Record<OverviewOmit, string>;

const OMIT_OPTIONS = Object.keys(NEED_OF_OMIT) as OverviewOmit[];

describe('the oracle archive through the real worker', () => {
  let nextQueryId = 700;

  /** Ask the overview channel and return the posted reply. */
  async function askReply(): Promise<OverviewReply> {
    post.mockClear();
    postRequest({ type: 'data-query', queryId: nextQueryId++, query: { channel: 'overview' } });
    const reply = await waitForMessage(post, 'data-result', WAIT_MS);
    if (reply.type !== 'data-result') throw new Error('expected data-result');
    return reply;
  }

  /** Ask the overview channel and return the view. */
  async function askView(): Promise<OverviewView> {
    const reply = await askReply();
    if (reply.result === null || reply.result.channel !== 'overview') {
      throw new Error('expected an overview result');
    }
    return reply.result.view;
  }

  /** The tile of an id, whatever its status. */
  function tileOf(view: OverviewView, id: string): OverviewTile {
    const found = view.tiles.find((tile) => tile.id === id);
    if (found === undefined) throw new Error(`no tile ${id}`);
    return found;
  }

  /** The ready tile of an id; throws on an absent one. */
  function readyOf<Id extends OverviewReadyTile['id']>(
    view: OverviewView,
    id: Id,
  ): Extract<OverviewReadyTile, { id: Id }> {
    const found = tileOf(view, id);
    if (found.status !== 'ok') throw new Error(`expected a ready ${id} tile`);
    return found as Extract<OverviewReadyTile, { id: Id }>;
  }

  /** The absent tile of an id; throws on a ready one. */
  function absentOf(view: OverviewView, id: string): OverviewAbsentTile {
    const found = tileOf(view, id);
    if (found.status !== 'absent') throw new Error(`expected an absent ${id} tile`);
    return found;
  }

  /** The ids of the absent tiles, in catalogue order. */
  function absentIds(view: OverviewView): string[] {
    return view.tiles.filter((tile) => tile.status === 'absent').map((tile) => tile.id);
  }

  /** Import one archive and require a clean finish. */
  async function importArchive(bytes: Uint8Array, name: string): Promise<void> {
    const terminal = await ingestExport(post, bytes, name);
    expect(terminal.type).toBe('done');
  }

  it('answers all sixteen tiles, tile by tile, with the hand-derived figures', async () => {
    await importArchive(buildOverviewInsightExport(), 'oracle-default.zip');
    const { db } = await importWorkerDb();

    const reply = await askReply();
    const view = reply.result!.view as OverviewView;
    const meta = await db.meta.get('active');
    expect(reply.importedAt).toBe(meta?.importedAt);

    const sessions = OV_EXPECTED.sessions;
    const stats = OV_EXPECTED.stats;

    // Sixteen tiles, in catalogue order.
    expect(view.tiles.map((tile) => tile.id)).toEqual([...OVERVIEW_TILE_IDS]);

    // Time group.
    expect(readyOf(view, 'logged')).toEqual({
      id: 'logged',
      status: 'ok',
      seconds: sessions.allSeconds,
      firstDay: sessions.firstDay,
      lastDay: sessions.lastDay,
      battleSeconds: sessions.battleSeconds,
      years: [...sessions.years],
    });
    expect(readyOf(view, 'hour')).toMatchObject({
      hours: [...sessions.hours],
      peakHour: sessions.peakHour,
    });
    expect(readyOf(view, 'streak')).toMatchObject({
      days: sessions.streak,
      startDay: sessions.firstDay,
      endDay: sessions.firstDay + sessions.streak - 1,
    });
    expect(readyOf(view, 'sess')).toMatchObject({
      seconds: sessions.longestSession.seconds,
      day: sessions.longestSession.day,
    });
    expect(readyOf(view, 'busy')).toMatchObject({
      seconds: sessions.busiestDay.seconds,
      day: sessions.busiestDay.day,
    });

    // Tanks group. The names are tag-derived in BOTH table states: the invented
    // tags are not in the real table (D-09).
    const tank = readyOf(view, 'tank');
    expect(tank).toMatchObject({
      name: TAG_NAMES[0],
      battles: stats.mostPlayed.battles,
      share: stats.mostPlayed.share,
      classKey: 'unknown',
      tier: null,
    });
    expect(tank.top.map((entry) => entry.name)).toEqual([...TAG_NAMES]);
    expect(tank.top.map((entry) => entry.battles)).toEqual(
      BATTLE_KEYS.map((key) => stats.vehicleBattles[key]),
    );
    expect(tank.top.every((entry) => entry.classKey === 'unknown')).toBe(true);
    expect(readyOf(view, 'fleet').count).toBe(stats.fleet);
    expect(readyOf(view, 'nat')).toMatchObject({
      nation: stats.favouriteNation,
      share: stats.nationShares[stats.favouriteNation],
    });
    // No class resolves for the invented tags in either table state, and an
    // absent tile is not a zero.
    expect(absentOf(view, 'cls')).toMatchObject({
      need: 'vehicle-statistics',
      column: null,
    });

    // Records group. The invented record ids are in neither table state.
    const records = stats.records;
    expect(readyOf(view, 'dmg')).toMatchObject({ value: records.damage.value, tankName: null });
    expect(readyOf(view, 'xp')).toMatchObject({ value: records.xp.value, tankName: null });
    expect(readyOf(view, 'kills')).toMatchObject({ value: records.kills.value, tankName: null });
    expect(readyOf(view, 'snip').value).toBe(records.sniperSeries.value);

    // Totals group.
    expect(readyOf(view, 'cred').units).toBe(OV_EXPECTED.money.creditsInFlowMicro);
    expect(readyOf(view, 'bat')).toMatchObject({
      battles: stats.battles,
      wins: stats.wins,
      winRate: stats.winRate,
    });
    expect(readyOf(view, 'ord').count).toBe(OV_EXPECTED.money.orders);

    // The strip and the view-level facts.
    expect(view.life).toEqual([...sessions.life]);
    expect(view.firstDay).toBe(readyOf(view, 'logged').firstDay);
    expect(view.lastDay).toBe(readyOf(view, 'logged').lastDay);
    expect(view.accountCount).toBe(stats.accountCount);

    // Only the class tile is absent today.
    expect(absentIds(view)).toEqual(['cls']);
  });

  describe.each(OMIT_OPTIONS)('with the %s source left out', (omit) => {
    it("answers the oracle's absent set with the right need and column", async () => {
      await importArchive(buildOverviewInsightExport({ omit: [omit] }), `oracle-${omit}.zip`);
      const view = await askView();
      const expected = OV_EXPECTED.absent[omit]!;

      // The oracle's tiles, plus the class tile, which no invented tag resolves.
      const wanted = new Set<string>([...expected.tiles, 'cls']);
      expect(absentIds(view)).toEqual(OVERVIEW_TILE_IDS.filter((id) => wanted.has(id)));

      for (const [index, id] of expected.tiles.entries()) {
        const tile = absentOf(view, id);
        expect(tile.need, id).toBe(NEED_OF_OMIT[omit]);
        // A COLUMN-level absence names its column; a whole-source one does not.
        expect(tile.column, id).toBe(
          expected.droppedColumns === undefined ? null : expected.needs[index],
        );
      }

      // Every tile outside the set still reads.
      for (const tile of view.tiles) {
        if (!wanted.has(tile.id)) expect(tile.status, tile.id).toBe('ok');
      }
    });
  });

  it('reads the record columns by name when only they are missing', async () => {
    await importArchive(
      buildOverviewInsightExport({ omit: ['record-columns'] }),
      'oracle-columns.zip',
    );
    const view = await askView();
    const expected = OV_EXPECTED.absent['record-columns']!;

    expect(expected.tiles.map((id) => absentOf(view, id).column)).toEqual([...expected.needs]);
    // The battles tile reads: `BATTLES_COUNT` is not a record column.
    expect(readyOf(view, 'bat')).toMatchObject({ battles: OV_EXPECTED.stats.battles });
  });

  it('answers a session-less export with an empty strip and no dates', async () => {
    await importArchive(buildOverviewInsightExport({ omit: ['sessions'] }), 'oracle-nosess.zip');
    const view = await askView();
    expect(view.life).toEqual([]);
    expect(view.firstDay).toBeNull();
    expect(view.lastDay).toBeNull();
    expect(view.accountCount).toBe(OV_EXPECTED.stats.accountCount);
  });

  it('keeps Logged in ready on the Blitz file alone and loses the four habits', async () => {
    await importArchive(
      buildOverviewInsightExport({ omit: ['wot-sessions'] }),
      'oracle-wotb-only.zip',
    );
    const view = await askView();
    const blitz = OV_EXPECTED.sessions.life.filter((entry) => entry.game === 'WOTB');
    const expected = OV_EXPECTED.absent['wot-sessions']!;

    expect(readyOf(view, 'logged').seconds).toBe(expected.loggedSeconds);
    expect(view.life).toEqual(blitz);
    expect(['hour', 'streak', 'sess', 'busy'].map((id) => absentOf(view, id).need)).toEqual([
      'session-history',
      'session-history',
      'session-history',
      'session-history',
    ]);
  });

  it("falls back to the vehicle rows' battle seconds without the account statistics", async () => {
    await importArchive(
      buildOverviewInsightExport({ omit: ['account-statistics'] }),
      'oracle-noacct.zip',
    );
    const view = await askView();
    expect(readyOf(view, 'logged').battleSeconds).toBe(
      OV_EXPECTED.absent['account-statistics']!.battleSeconds,
    );
  });

  it('imports and answers the real-looking tags without error', async () => {
    await importArchive(buildOverviewInsightExport({ tanks: 'known' }), 'oracle-known.zip');
    const view = await askView();
    // No assertion on class or name: that depends on the committed table.
    expect(view.tiles).toHaveLength(16);
    expect(readyOf(view, 'fleet').count).toBe(OV_EXPECTED.stats.fleet);
    expect(readyOf(view, 'bat').battles).toBe(OV_EXPECTED.stats.battles);
  });

  it('serves the same view for the same importedAt from one memo entry', async () => {
    const { dataQueryMemoSize } = await import('../../../src/lib/worker/data-queries.ts');
    await importArchive(buildOverviewInsightExport(), 'oracle-memo.zip');

    const first = await askReply();
    const second = await askReply();
    expect(second.result!.view).toEqual(first.result!.view);
    expect(second.importedAt).toBe(first.importedAt);
    expect(dataQueryMemoSize()).toBe(1);
  });

  it('answers the new dataset after a replace and never the previous one', async () => {
    await importArchive(buildOverviewInsightExport(), 'oracle-first.zip');
    const first = await askReply();
    const firstView = first.result!.view as OverviewView;
    expect(readyOf(firstView, 'ord').count).toBe(OV_EXPECTED.money.orders);

    await importArchive(buildOverviewInsightExport({ omit: ['orders'] }), 'oracle-second.zip');
    const second = await askReply();
    const secondView = second.result!.view as OverviewView;

    expect(second.importedAt).not.toBe(first.importedAt);
    expect(secondView).not.toEqual(firstView);
    // The tile that was ready is absent now: nothing of the old answer survives.
    expect(absentOf(secondView, 'ord').need).toBe('payment-history');
    expect(JSON.stringify(secondView)).not.toContain(`"count":${OV_EXPECTED.money.orders}`);
  });

  it('answers a null date and no result once the data is cleared', async () => {
    await importArchive(buildOverviewInsightExport(), 'oracle-clear.zip');
    const before = await askReply();
    expect(before.importedAt).not.toBeNull();

    postRequest({ type: 'clear-data', jobId: 78 });
    await waitForMessage(post, 'cleared', WAIT_MS);

    const cleared = await askReply();
    expect(cleared.importedAt).toBeNull();
    expect(cleared.result).toBeNull();
  });

  describe('a stale or missing stored aggregate is rebuilt and written back', () => {
    /** Drop the 13-05 fields from a scope, the way a v3 record would not have them. */
    function withoutLongest(aggregate: PlaytimeAggregates): PlaytimeAggregates {
      const copy = structuredClone(aggregate);
      const strip = (scope: { all: object; byValue: object[] }): void => {
        for (const slice of [scope.all, ...scope.byValue]) {
          delete (slice as { longestSeconds?: number }).longestSeconds;
          delete (slice as { longestStart?: number }).longestStart;
        }
      };
      strip(copy);
      for (const entry of copy.byGame ?? []) strip(entry.scope);
      return copy;
    }

    it('rebuilds a v3 aggregate with the longest-session fields and the same view', async () => {
      const { clearDataQueryMemo } = await import('../../../src/lib/worker/data-queries.ts');
      const { db } = await importWorkerDb();
      await importArchive(buildOverviewInsightExport(), 'oracle-stale.zip');
      const first = await askReply();

      const stored = (await db.meta.get('active'))!.playtime as PlaytimeAggregates;
      expect(stored.all.longestSeconds).toBe(OV_EXPECTED.sessions.longestSession.seconds);

      const stale = withoutLongest(stored);
      stale.v = 3;
      expect(stale.all.longestSeconds).toBeUndefined();
      await db.meta.update('active', { playtime: stale });
      clearDataQueryMemo();

      const rebuilt = await askReply();
      expect(rebuilt.result!.view).toEqual(first.result!.view);
      expect(rebuilt.importedAt).toBe(first.importedAt);

      // Written back at the current version, with the fields a v3 record lacked.
      const after = (await db.meta.get('active'))!.playtime as PlaytimeAggregates;
      expect(after.v).toBe(PLAYTIME_VERSION);
      expect(after.all.longestSeconds).toBe(OV_EXPECTED.sessions.longestSession.seconds);
      expect(Math.floor((after.all.longestStart ?? 0) / 86_400)).toBe(
        OV_EXPECTED.sessions.longestSession.day,
      );
    });

    it('rebuilds a deleted aggregate to the same view and writes it back', async () => {
      const { clearDataQueryMemo } = await import('../../../src/lib/worker/data-queries.ts');
      const { db } = await importWorkerDb();
      await importArchive(buildOverviewInsightExport(), 'oracle-missing.zip');
      const first = await askReply();

      const meta = (await db.meta.get('active'))!;
      delete meta.playtime;
      await db.meta.put(meta);
      expect((await db.meta.get('active'))?.playtime).toBeUndefined();
      clearDataQueryMemo();

      const rebuilt = await askReply();
      expect(rebuilt.result!.view).toEqual(first.result!.view);
      const after = (await db.meta.get('active'))!.playtime as PlaytimeAggregates;
      expect(after.v).toBe(PLAYTIME_VERSION);
    });
  });

  it('answers an overview ask and a currency ask issued back to back, each on its own channel', async () => {
    await importArchive(buildOverviewInsightExport(), 'oracle-both.zip');
    post.mockClear();
    postRequest({ type: 'data-query', queryId: 910, query: { channel: 'overview' } });
    postRequest({ type: 'data-query', queryId: 911, query: { channel: 'currency' } });

    const start = Date.now();
    const results = (): OverviewReply[] =>
      post.mock.calls
        .map((call) => call[0] as IngestResponse)
        .filter((message): message is OverviewReply => message.type === 'data-result');
    while (results().length < 2 && Date.now() - start < WAIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const byId = new Map(results().map((message) => [message.queryId, message]));
    expect(byId.get(910)?.result?.channel).toBe('overview');
    expect(byId.get(911)?.result?.channel).toBe('currency');
    expect(post.mock.calls.some((call) => (call[0] as IngestResponse).type === 'data-error')).toBe(
      false,
    );
  });
});
