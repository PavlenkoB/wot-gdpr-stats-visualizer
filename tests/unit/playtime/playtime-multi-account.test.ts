// =============================================================================
// playtime-multi-account.test.ts — the cross-account merge (Phase 10, 10-01)
//
// WHAT THIS FILE IS FOR
//
// Success criterion 1 of phase 10 is "overlapping play across accounts is
// counted once, checkable against a hand-computed two-account fixture" (D-06),
// and D-07 amended settles that a session is a USABLE ROW: only the hours
// dedupe. D-08 adds that the merge must not depend on which account's rows
// arrive first, including for two sessions with the SAME start.
//
// Every number asserted here is a LITERAL typed into
// `tests/fixtures/multi-account-fixtures.ts` beside the interval arithmetic that
// produces it. No expected value is read back off the worker: a key computed by
// the code under test asserts only that the code agrees with itself. The
// independent per-second oracle in `tests/helpers/session-oracle.ts` is the
// cross-check, and it shares no primitive with the aggregator (plan 04-03).
//
// WHY IT IS A WORKER TEST
//
// Two of the guarantees here are about what reaches IndexedDB and what crosses
// the `postMessage` boundary: the per-game scopes must be STORED at import
// (so a chip click is a single-key read), and `playtime-query.game` is a field
// the worker did not author, so its validation lives in the worker. Neither is
// observable by calling the aggregator directly.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  MA_OVERLAP_EXPECTED,
  buildOverlapTwoAccountExport,
} from '../../fixtures/multi-account-fixtures.ts';
import { oracleSlice, type OracleSession } from '../../helpers/session-oracle.ts';
import {
  buildPlaytimeFromSources,
  viewFromAggregates,
  type SessionSource,
} from '../../../src/lib/features/playtime/playtime-aggregate.ts';
import { MAX_SPLIT_VALUES } from '../../../src/lib/features/playtime/playtime-shared.ts';
import type {
  IngestRequest,
  IngestResponse,
  PlaytimeAggregates,
  PlaytimeSlice,
  PlaytimeView,
} from '../../../src/lib/core/types/worker-messages.ts';

/** The ceiling every worker round-trip is raced against, copied from 09-03. */
const REPLY_TIMEOUT_MS = 10_000;

let post: WorkerPostSpy;

beforeEach(async () => {
  post = installWorkerScope();
  await deleteActiveDatabase();
  await loadWorker();
});

afterEach(async () => {
  await deleteActiveDatabase();
});

/**
 * Ingest one archive and assert the terminal reply was `done`.
 *
 * The spy is cleared first, and that is load-bearing rather than cosmetic:
 * `waitForTerminal` scans the whole call history, so a second import in one
 * test would otherwise answer with the FIRST import's `done`.
 */
async function ingestDone(bytes: Uint8Array, name: string): Promise<void> {
  post.mockClear();
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type, `ingest of ${name}`).toBe('done');
}

/**
 * Post one playtime query and return the view it answered with.
 *
 * `game` is put on the message ONLY when it is not undefined, so the "no game
 * field at all" case really is absent from the message rather than present and
 * null — the shape every pre-game test in the suite still sends.
 */
async function askPlaytime(queryId: number, game?: unknown): Promise<PlaytimeView> {
  post.mockClear();
  const message = {
    type: 'playtime-query',
    queryId,
    valueIndex: null,
    ...(game === undefined ? {} : { game }),
  } as unknown as IngestRequest;
  postRequest(message);
  const start = Date.now();
  while (Date.now() - start < REPLY_TIMEOUT_MS) {
    for (const call of post.mock.calls) {
      const msg = call[0] as IngestResponse | undefined;
      if (msg?.type === 'playtime-error') {
        throw new Error(`expected a playtime-result, got playtime-error (${msg.detail})`);
      }
      if (msg?.type === 'playtime-result' && msg.queryId === queryId) {
        if (msg.view === null) throw new Error('the worker answered a null playtime view');
        return msg.view;
      }
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`askPlaytime(${queryId}): no reply within ${REPLY_TIMEOUT_MS} ms`);
}

/** The `ready` view, or a named failure that names the status it got. */
function ready(view: PlaytimeView): Extract<PlaytimeView, { status: 'ready' }> {
  if (view.status !== 'ready') throw new Error(`expected ready, got ${view.status}`);
  return view;
}

/** The stored aggregate, or a named failure. */
async function storedAggregate(): Promise<PlaytimeAggregates> {
  const { db } = await importWorkerDb();
  const value = (await db.meta.get('active'))?.playtime as PlaytimeAggregates | null | undefined;
  if (value == null) throw new Error('no stored playtime aggregate');
  return value;
}

// -----------------------------------------------------------------------------
// Task 1 — the end-to-end "WOT" slice
// -----------------------------------------------------------------------------

describe('Phase 10 playtime: the cross-account merge through the real worker', () => {
  it('answers All games with the hand-computed union, once, across both accounts', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');

    const view = ready(await askPlaytime(1));

    // 04.03 5,400 + 05.03 7,200 + 06.03 5,400 + 08.03 3,600 + 10.03 1,800.
    expect(view.slice.seconds).toBe(23_400);
    // Nine usable rows, one per session row in the fixture. Nothing is dropped
    // for being wholly inside another session (D-07 amended).
    expect(view.slice.sessions).toBe(9);
    expect(view.slice.excluded).toBe(0);
    expect(view.slice.dayIndex.length).toBe(5);
    expect(view.game).toBeNull();
    expect(view.games).toEqual(['WOT', 'WOTB', 'WOWS']);
  });

  it("answers one game with only that game's union, from the stored scope", async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');

    const view = ready(await askPlaytime(2, 'WOT'));

    // 04.03 5,400 + 05.03 7,200 + 08.03 3,600 + 10.03 1,800. The WOTB session
    // inside 04.03 is NOT in this scope.
    expect(view.slice.seconds).toBe(18_000);
    expect(view.slice.sessions).toBe(6);
    expect(view.slice.dayIndex.length).toBe(4);
    expect(view.game).toBe('WOT');
    // The chip list is the ALL-games list whatever is selected.
    expect(view.games).toEqual(['WOT', 'WOTB', 'WOWS']);
  });

  it('stores one complete scope per game at version 3', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');

    const stored = await storedAggregate();

    expect(stored.v).toBe(3);
    expect(stored.games).toEqual(['WOT', 'WOTB', 'WOWS']);
    expect(stored.byGame?.map((entry) => entry.game)).toEqual(['WOT', 'WOTB', 'WOWS']);
    for (const entry of stored.byGame ?? []) {
      // A scope is COMPLETE: the four fields a view needs, and no claim about
      // which scope it is.
      expect(entry.scope.v).toBe(3);
      expect(entry.scope.sessionsFileSeen).toBe(true);
      // `values` and `byValue` are index-parallel, so a scope's split menu can
      // never name a row it has no seconds for.
      expect(entry.scope.values.length).toBe(entry.scope.byValue.length);
      expect(entry.scope.all.sessions).toBeGreaterThan(0);
    }
    // The all-games numbers are untouched by the version bump (D-07 amended:
    // the merge stays exactly v1.0).
    expect(stored.all.seconds).toBe(23_400);
    expect(stored.all.sessions).toBe(9);
  });
});

// -----------------------------------------------------------------------------
// Task 2 — the merge rule, the storage paths and the trust boundary
// -----------------------------------------------------------------------------

/**
 * The overlap fixture's sessions as LITERAL tuples, in archive order: account
 * A's four rows then account B's five.
 *
 * Written out here rather than imported from the fixture module, because the
 * oracle cross-check needs the intervals in a shape it can read WITHOUT the
 * aggregator — and because a table a reader can check the union off by hand is
 * the point of this file.
 */
const OVERLAP_ROWS: readonly (readonly [game: string, start: string, end: string])[] = [
  ['WOT', '04.03.2024 10:00', '04.03.2024 11:00'],
  ['WOT', '05.03.2024 20:00', '05.03.2024 21:00'],
  ['WOT', '08.03.2024 09:00', '08.03.2024 10:00'],
  ['WOWS', '06.03.2024 18:00', '06.03.2024 19:00'],
  ['WOT', '04.03.2024 10:30', '04.03.2024 11:30'],
  ['WOT', '05.03.2024 21:00', '05.03.2024 22:00'],
  ['WOT', '10.03.2024 12:00', '10.03.2024 12:30'],
  ['WOTB', '04.03.2024 10:45', '04.03.2024 11:15'],
  ['WOTB', '06.03.2024 18:30', '06.03.2024 19:30'],
];

/**
 * One `DD.MM.YYYY HH:MM` stamp as Unix seconds through `Date.UTC`.
 *
 * The aggregator reads the same stamp as wall-clock seconds since
 * 1970-01-01T00:00:00 (D-01), and these are the same instant — which is what
 * lets the oracle's per-second bitmap and the aggregator's integer sweep be
 * compared second for second. Written with `Date.UTC` rather than the
 * implementation's own conversion on purpose: the oracle shares no primitive
 * with the thing it checks.
 */
function unixOf(stamp: string): number {
  const [date, time] = stamp.split(' ');
  const [day, month, year] = date!.split('.').map(Number);
  const [hour, minute] = time!.split(':').map(Number);
  return Date.UTC(year!, month! - 1, day!, hour!, minute!) / 1000;
}

/** The oracle's view of the rows of one game, or of every game. */
function oracleFor(game: string | null): ReturnType<typeof oracleSlice> {
  return oracleSlice(
    OVERLAP_ROWS.filter(([token]) => game === null || token === game).map(
      ([, start, end]): OracleSession => ({ start: unixOf(start), end: unixOf(end) }),
    ),
  );
}

/**
 * One session FILE per game, rows keyed by the REAL header names so the pure
 * path reads the same columns a real export writes (T-04-27/T-04-28).
 */
function pureSources(rows: readonly (readonly [string, string, string])[]): SessionSource[] {
  // A `Map` of game -> MUTABLE row list, wrapped as a source on the way out:
  // `SessionSource.rows` is `readonly`, which is right for the aggregator and
  // wrong for the fixture that builds one.
  const byGame = new Map<string, Record<string, string>[]>();
  for (const [game, start, end] of rows) {
    const collected = byGame.get(game) ?? [];
    collected.push({ STARTED_AT: start, FINISHED_AT: end, IP: '192.0.2.10' });
    byGame.set(game, collected);
  }
  return [...byGame.entries()].map(([game, collected]) => ({ game, rows: collected }));
}

describe('Phase 10 playtime: the merge rule', () => {
  it('answers every per-game scope, and their sum is LARGER than All', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');

    const wot = ready(await askPlaytime(1, 'WOT'));
    const wotb = ready(await askPlaytime(2, 'WOTB'));
    const wows = ready(await askPlaytime(3, 'WOWS'));

    expect([wot.slice.seconds, wotb.slice.seconds, wows.slice.seconds]).toEqual([
      MA_OVERLAP_EXPECTED.wot.seconds,
      MA_OVERLAP_EXPECTED.wotb.seconds,
      MA_OVERLAP_EXPECTED.wows.seconds,
    ]);
    expect([wot.slice.sessions, wotb.slice.sessions, wows.slice.sessions]).toEqual([6, 2, 1]);
    expect([
      wot.slice.dayIndex.length,
      wotb.slice.dayIndex.length,
      wows.slice.dayIndex.length,
    ]).toEqual([4, 2, 1]);

    // The documented shape, asserted so a future "fix" that made these add up
    // would FAIL rather than look like an improvement (D-06): each scope merges
    // overlap among its own sessions only, so cross-game concurrent play is
    // counted once under All and twice under the two games.
    const sum = wot.slice.seconds + wotb.slice.seconds + wows.slice.seconds;
    expect(sum).toBe(MA_OVERLAP_EXPECTED.sumOfGames);
    expect(sum).toBeGreaterThan(MA_OVERLAP_EXPECTED.all.seconds);
  });

  it('keeps the touching pair two sessions on one continuous day', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');

    const view = ready(await askPlaytime(4));

    // 05.03: 20:00-21:00 and 21:00-22:00 meet at 21:00. Their time is
    // continuous, so the day holds 7,200 s — but they are two USABLE ROWS and
    // stay two sessions (D-07 amended: only the hours dedupe).
    const at = view.slice.dayIndex.indexOf(unixOf('05.03.2024 00:00') / 86400);
    expect(at).toBe(1);
    expect(view.slice.daySeconds[at]).toBe(MA_OVERLAP_EXPECTED.touchingDay.seconds);
    expect(view.slice.daySessions[at]).toBe(MA_OVERLAP_EXPECTED.touchingDay.sessions);

    // The wholly-contained WOTB session adds a session and no seconds.
    const march4 = view.slice.dayIndex.indexOf(unixOf('04.03.2024 00:00') / 86400);
    expect(view.slice.daySeconds[march4]).toBe(5_400);
    expect(view.slice.daySessions[march4]).toBe(3);
  });

  it('agrees with the independent per-second oracle on All and on each game', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');

    const compare = (slice: PlaytimeSlice, oracle: ReturnType<typeof oracleSlice>): void => {
      expect(slice.seconds).toBe(oracle.seconds);
      expect(slice.sessions).toBe(oracle.sessions);
      expect(slice.dayIndex).toEqual(oracle.dayIndex);
      expect(slice.daySeconds).toEqual(oracle.daySeconds);
      expect(slice.daySessions).toEqual(oracle.daySessions);
      expect(slice.hourOverlap).toEqual(oracle.hourOverlap);
      expect(slice.hourStart).toEqual(oracle.hourStart);
      expect(slice.bins).toEqual(oracle.bins);
    };

    compare(ready(await askPlaytime(5)).slice, oracleFor(null));
    compare(ready(await askPlaytime(6, 'WOT')).slice, oracleFor('WOT'));
    compare(ready(await askPlaytime(7, 'WOTB')).slice, oracleFor('WOTB'));
    compare(ready(await askPlaytime(8, 'WOWS')).slice, oracleFor('WOWS'));
  });

  it('answers identically from a reversed archive, so entry order changes nothing', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'forward.zip');

    const forwardAll = ready(await askPlaytime(10));
    const forwardWot = ready(await askPlaytime(11, 'WOT'));

    await ingestDone(buildOverlapTwoAccountExport({ reversed: true }), 'reversed.zip');

    expect(ready(await askPlaytime(12))).toEqual(forwardAll);
    expect(ready(await askPlaytime(13, 'WOT'))).toEqual(forwardWot);
  });
});

describe('Phase 10 playtime: order independence at the pure level', () => {
  const all = OVERLAP_ROWS.map(([game, start, end]) => [game, start, end] as const);

  it('builds deeply equal aggregates whichever account and row order arrives', () => {
    const forward = buildPlaytimeFromSources(pureSources(all), true);
    const reversedRows = buildPlaytimeFromSources(
      pureSources([...all].reverse()).map((source) => ({
        ...source,
        rows: [...source.rows].reverse(),
      })),
      true,
    );
    // B before A: the two accounts are the two halves of `all`, and an account
    // is invisible to the aggregator (it never reads `source.account`), so
    // reversing the SOURCE order must change nothing at all.
    const half = Math.floor(all.length / 2);
    const accountBFirst = buildPlaytimeFromSources(
      [...pureSources(all.slice(half)), ...pureSources(all.slice(0, half))],
      true,
    );

    expect(reversedRows).toEqual(forward);
    expect(accountBFirst).toEqual(forward);
    expect(forward.all.seconds).toBe(MA_OVERLAP_EXPECTED.all.seconds);
    expect(forward.all.sessions).toBe(MA_OVERLAP_EXPECTED.all.sessions);
  });

  it('credits a same-start pair once, whichever account is read first', () => {
    // Two sessions beginning at the SAME instant in two accounts: one runs to
    // 09:00, the other to 08:30. Whichever is read first claims [08:00, its
    // end) and the other claims what is left, so the union is 3,600 s either
    // way and BOTH are still sessions (D-08).
    const long = {
      game: 'WOT',
      rows: [{ STARTED_AT: '12.03.2024 08:00', FINISHED_AT: '12.03.2024 09:00' }],
    };
    const short = {
      game: 'WOT',
      rows: [{ STARTED_AT: '12.03.2024 08:00', FINISHED_AT: '12.03.2024 08:30' }],
    };

    const longFirst = buildPlaytimeFromSources([long, short], true);
    const shortFirst = buildPlaytimeFromSources([short, long], true);

    expect(longFirst.all.seconds).toBe(3_600);
    expect(longFirst.all.sessions).toBe(2);
    expect(shortFirst).toEqual(longFirst);
    expect(
      oracleSlice([
        { start: unixOf('12.03.2024 08:00'), end: unixOf('12.03.2024 09:00') },
        { start: unixOf('12.03.2024 08:00'), end: unixOf('12.03.2024 08:30') },
      ]).seconds,
    ).toBe(3_600);
  });
});

describe('Phase 10 playtime: the storage paths', () => {
  it('rebuilds a deleted aggregate to the import-time one and writes it back', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');
    const atImport = await storedAggregate();
    expect(atImport.byGame?.map((entry) => entry.game)).toEqual(['WOT', 'WOTB', 'WOWS']);

    const { db } = await importWorkerDb();
    await db.meta.update('active', { playtime: null });

    expect(ready(await askPlaytime(20))).toEqual(viewFromAggregates(atImport, null));
    expect(await storedAggregate()).toEqual(atImport);
  });

  it('rebuilds a v2-stamped aggregate into a v3 one that still answers a game', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');
    const atImport = await storedAggregate();

    // What a returning user's cache really holds after the version bump: an
    // aggregate at the PREVIOUS version, with the fields v3 added absent
    // (D-21). It must be recomputed, not refused and not cast.
    const rest: Record<string, unknown> = { ...atImport };
    delete rest.v;
    delete rest.games;
    delete rest.byGame;
    const { db } = await importWorkerDb();
    await db.meta.update('active', { playtime: { ...rest, v: 2 } as PlaytimeAggregates });

    const view = ready(await askPlaytime(21, 'WOT'));
    expect(view.slice.seconds).toBe(MA_OVERLAP_EXPECTED.wot.seconds);
    expect(view.game).toBe('WOT');

    const rebuilt = await storedAggregate();
    expect(rebuilt.v).toBe(3);
    expect(rebuilt).toEqual(atImport);
  });

  it('stores no IP address anywhere in the aggregate', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');

    // T-10-02: the scopes are built by the same aggregator that names exactly
    // four columns and never reads the fifth. This is the assertion that can
    // FAIL if a per-game scope ever starts carrying row text.
    expect(JSON.stringify(await storedAggregate())).not.toContain('192.0.2');
  });
});

describe('Phase 10 playtime: the game token trust boundary', () => {
  it('answers an unknown but VALID game token with no-game-sessions, keeping the chip list', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');

    // WOTC is a real Wargaming game that THIS export happens not to carry. The
    // answer is not an error and not the same sentence as an absent session
    // file: the export has both a session file and other games.
    const view = await askPlaytime(30, 'WOTC');

    expect(view.status).toBe('no-game-sessions');
    if (view.status !== 'no-game-sessions') throw new Error('unreachable');
    expect(view.game).toBe('WOTC');
    expect(view.games).toEqual(['WOT', 'WOTB', 'WOWS']);
  });

  it('degrades every malformed token to All and never echoes the raw value', async () => {
    await ingestDone(buildOverlapTwoAccountExport(), 'overlap.zip');

    const hostile: readonly unknown[] = [
      'wot',
      '__proto__',
      'A'.repeat(25),
      'WOT ',
      7,
      { game: 'WOT' },
    ];
    let queryId = 31;
    for (const raw of hostile) {
      const view = ready(await askPlaytime(queryId++, raw));
      expect(view.status).toBe('ready');
      expect(view.slice.seconds).toBe(MA_OVERLAP_EXPECTED.all.seconds);
      expect(view.game).toBeNull();

      // T-10-01: the rejected value must not travel into the reply in ANY
      // form. A string is checked as a whole JSON token; a NUMBER is checked
      // only as a `game` field value, because any digit sequence can appear
      // inside a stored day number and a substring search would be vacuous.
      const json = JSON.stringify(view);
      if (typeof raw === 'string') expect(json).not.toContain(JSON.stringify(raw));
      else expect(json).not.toContain('"game":7');
    }
  });

  it('counts an unusable row in its own game only', () => {
    // A WOT row whose end precedes its start. It is EXCLUDED — counted, never
    // silently dropped — and it must be counted under the game its FILE named,
    // because that is the only place the count can be shown to the user.
    const aggregates = buildPlaytimeFromSources(
      [
        {
          game: 'WOT',
          rows: [
            { STARTED_AT: '13.03.2024 12:00', FINISHED_AT: '13.03.2024 11:00' },
            { STARTED_AT: '13.03.2024 14:00', FINISHED_AT: '13.03.2024 15:00' },
          ],
        },
        {
          game: 'WOTB',
          rows: [{ STARTED_AT: '13.03.2024 14:00', FINISHED_AT: '13.03.2024 15:00' }],
        },
      ],
      true,
    );

    expect(aggregates.all.excluded).toBe(1);
    const byGame = new Map((aggregates.byGame ?? []).map((entry) => [entry.game, entry.scope]));
    expect(byGame.get('WOT')?.all.excluded).toBe(1);
    expect(byGame.get('WOTB')?.all.excluded).toBe(0);
  });

  it('cuts the game list at MAX_SPLIT_VALUES before building a scope', () => {
    // T-10-03: an archive of crafted session file names must not be able to
    // grow the stored aggregate one slice per name. Sixty distinct tokens
    // yield exactly the cap.
    const rows: [string, string, string][] = [];
    for (let i = 0; i < 60; i++) {
      const token = `GAME_${String(i).padStart(2, '0')}`;
      rows.push([token, '13.03.2024 14:00', '13.03.2024 15:00']);
    }

    const aggregates = buildPlaytimeFromSources(pureSources(rows), true);

    expect(aggregates.games?.length).toBe(MAX_SPLIT_VALUES);
    expect(aggregates.byGame?.length).toBe(MAX_SPLIT_VALUES);
    // All sixty sessions are still in All; only the SCOPES are capped.
    expect(aggregates.all.sessions).toBe(60);
  });
});
