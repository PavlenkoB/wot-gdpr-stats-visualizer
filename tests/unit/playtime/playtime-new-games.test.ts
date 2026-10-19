// =============================================================================
// playtime-new-games.test.ts — does HEAT/WOTC need a PLAYTIME_VERSION bump?
// (plan 11-01, D-13 / 11-RESEARCH Pattern 11)
// =============================================================================
//
// THE QUESTION. A stored aggregate's `v` is the hook that makes a returning
// user's cache re-derive itself. Bumping it costs every returning reader one
// rebuild, so it must be bought by a change in what the aggregate MEANS — not
// by new files arriving. The suspicion when HEAT and WoT Console sessions became
// readable was that the per-game scopes (`games` / `byGame`) could not hold
// them, which would have made the bump necessary.
//
// The answer is written as this test rather than as a paragraph: it asks the
// REAL worker for All, HEAT, WOTC and WOT through `playtime-query`, compares
// each answer with a literal typed into the fixture BY HAND from the interval
// arithmetic, and then proves the rebuild path (`meta.playtime = null` followed
// by a second query) reproduces the import-time aggregate exactly.
//
// Every expected number is `NG_EXPECTED` in `tests/fixtures/new-data-fixtures.ts`,
// where the union arithmetic is written out beside the rows it comes from.
// Nothing here is read back off the code under test.
//
// WHY IT IS A WORKER TEST: two of the guarantees are about what crosses the
// `postMessage` boundary and what reaches IndexedDB — the per-game scope must
// be STORED at import so a chip click is a single-key read, and `game` is a
// field the worker did not author.
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
import { buildNewGamesExport } from '../../fixtures/multi-account-fixtures.ts';
import { NG_EXPECTED } from '../../fixtures/new-data-fixtures.ts';
import { PLAYTIME_VERSION } from '../../../src/lib/features/playtime/playtime-shared.ts';
import type {
  IngestRequest,
  IngestResponse,
  PlaytimeAggregates,
  PlaytimeView,
} from '../../../src/lib/core/types/worker-messages.ts';

/** The ceiling every worker round-trip is raced against, copied from 10-01. */
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

async function ingestDone(bytes: Uint8Array, name: string): Promise<void> {
  post.mockClear();
  const terminal = await ingestExport(post, bytes, name);
  expect(terminal.type, `ingest of ${name}`).toBe('done');
}

/** Post one playtime query and return the view it answered with. */
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

function ready(view: PlaytimeView): Extract<PlaytimeView, { status: 'ready' }> {
  if (view.status !== 'ready') throw new Error(`expected ready, got ${view.status}`);
  return view;
}

async function storedAggregate(): Promise<PlaytimeAggregates> {
  const { db } = await importWorkerDb();
  const value = (await db.meta.get('active'))?.playtime as PlaytimeAggregates | null | undefined;
  if (value == null) throw new Error('no stored playtime aggregate');
  return value;
}

/**
 * Ask one game and assert the whole answer against the hand-written key.
 *
 * The `days` assertion reads `dayIndex.length`, the same integer the
 * multi-account suite reads, so a disagreement between this file and that one
 * would be a disagreement about the field rather than about the number.
 */
async function expectGame(
  queryId: number,
  game: 'HEAT' | 'WOTC' | 'WOT',
  expected: { seconds: number; sessions: number; days: number },
): Promise<PlaytimeView> {
  const view = ready(await askPlaytime(queryId, game));
  expect(view.game).toBe(game);
  expect(view.slice.seconds, `${game} seconds`).toBe(expected.seconds);
  expect(view.slice.sessions, `${game} sessions`).toBe(expected.sessions);
  expect(view.slice.dayIndex.length, `${game} active days`).toBe(expected.days);
  expect(view.slice.excluded, `${game} excluded rows`).toBe(0);
  // The chip list is the ALL-games list whatever is selected.
  expect(view.games).toEqual([...NG_EXPECTED.games]);
  return view;
}

// -----------------------------------------------------------------------------

describe('D-13: HEAT and WoT Console through the real worker, at the stored version', () => {
  it('the hand-written key holds the literals the interval arithmetic produced', () => {
    // The key is typed by hand, so it needs its own guard: a later edit to
    // `NG_EXPECTED` that made the fixture disagree with itself would otherwise
    // be caught only as a mysterious worker failure.
    expect(NG_EXPECTED.HEAT).toEqual({ seconds: 9_000, sessions: 3, days: 2 });
    expect(NG_EXPECTED.WOTC).toEqual({ seconds: 3_600, sessions: 1, days: 1 });
    expect(NG_EXPECTED.WOT).toEqual({ seconds: 7_200, sessions: 2, days: 2 });
    expect(NG_EXPECTED.ALL).toEqual({ seconds: 19_800, sessions: 6, days: 5 });
    expect(NG_EXPECTED.games).toEqual(['HEAT', 'WOT', 'WOTC']);
    // And the three games add up to All, because no two of them overlap in time
    // in this fixture — a check the union itself cannot fail.
    expect(NG_EXPECTED.HEAT.seconds + NG_EXPECTED.WOTC.seconds + NG_EXPECTED.WOT.seconds).toBe(
      NG_EXPECTED.ALL.seconds,
    );
  });

  it('answers All games with the hand-computed union', async () => {
    await ingestDone(buildNewGamesExport(), 'new-games.zip');

    const view = ready(await askPlaytime(1));

    expect(view.slice.seconds).toBe(NG_EXPECTED.ALL.seconds);
    expect(view.slice.sessions).toBe(NG_EXPECTED.ALL.sessions);
    expect(view.slice.dayIndex.length).toBe(NG_EXPECTED.ALL.days);
    expect(view.slice.excluded).toBe(NG_EXPECTED.excluded);
    expect(view.game).toBeNull();
  });

  it('answers HEAT from a stored per-game scope, WITHOUT a version bump', async () => {
    // 05.03 20:00-22:00 (two overlapping accounts' rows) = 7,200, plus
    // 06.03 20:00-20:30 = 1,800.
    await ingestDone(buildNewGamesExport(), 'new-games.zip');
    await expectGame(2, 'HEAT', NG_EXPECTED.HEAT);
  });

  it('answers WoT Console from a stored per-game scope', async () => {
    await ingestDone(buildNewGamesExport(), 'new-games.zip');
    await expectGame(3, 'WOTC', NG_EXPECTED.WOTC);
  });

  it('still answers WoT, the game that already had a chip', async () => {
    await ingestDone(buildNewGamesExport(), 'new-games.zip');
    await expectGame(4, 'WOT', NG_EXPECTED.WOT);
  });

  it('stores the three games in one list, at the version the build declares', async () => {
    await ingestDone(buildNewGamesExport(), 'new-games.zip');

    const stored = await storedAggregate();

    expect(stored.v).toBe(PLAYTIME_VERSION);
    expect(stored.games).toEqual([...NG_EXPECTED.games]);
    expect(stored.byGame?.map((entry) => entry.game)).toEqual([...NG_EXPECTED.games]);
  });

  it('rebuilds to the SAME aggregate when the stored one is gone (D-13)', async () => {
    // The rebuild path is what a version bump would force every returning
    // reader through. If it produced anything different from the import-time
    // aggregate, a bump would be changing numbers as well as costing work.
    await ingestDone(buildNewGamesExport(), 'new-games.zip');
    const atImport = await storedAggregate();

    const { db } = await importWorkerDb();
    await db.meta.update('active', { playtime: null });
    const rebuilt = await storedAggregateAfterQuery();

    expect(rebuilt).toEqual(atImport);
    // And the write-back left the same thing behind, so a second read is the
    // same answer rather than a fresh computation each time.
    expect(await storedAggregate()).toEqual(atImport);
  });

  it('re-asking HEAT after the rebuild still answers the hand-written figures', async () => {
    await ingestDone(buildNewGamesExport(), 'new-games.zip');

    const { db } = await importWorkerDb();
    await db.meta.update('active', { playtime: null });

    await expectGame(5, 'HEAT', NG_EXPECTED.HEAT);
    await expectGame(6, 'WOTC', NG_EXPECTED.WOTC);
    await expectGame(7, 'WOT', NG_EXPECTED.WOT);
  });
});

/** Ask for something (so the worker rebuilds), then read the stored aggregate. */
async function storedAggregateAfterQuery(): Promise<PlaytimeAggregates> {
  await askPlaytime(90);
  return storedAggregate();
}
