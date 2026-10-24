// =============================================================================
// overview-time.test.ts — the Time group and the Wargaming life strip (13-08)
//
// WHAT THIS PROVES
//   1. THE ORACLE. The five Time tiles and the per-game strip of the
//      synthetic archive are exactly the answer key's figures: the union
//      across every account and every game, the four WoT-only habits, and the
//      lifetime battle time beside the logged-in seconds.
//   2. THE NAMED ABSENCES. Every omit option answers the way the key says:
//      no session file at all takes the whole group, and a dataset with only
//      the Blitz file keeps Logged in and loses the four habits.
//   3. THE DELICATE CASES. A legacy `Sessions.csv` (no game token), an
//      aggregate written before the longest-session fields existed, every tie
//      rule, a streak across a month and a year boundary, and the hour grid
//      the `HOUR_GRID_BASIS` constant selects.
//
// Every expected figure lives in `tests/helpers/overview-oracle.ts`, which
// imports NOTHING and states the arithmetic beside each number.
// =============================================================================

import { describe, expect, it } from 'vitest';
import type {
  PlaytimeAggregates,
  PlaytimeScope,
  PlaytimeSlice,
} from '../../../src/lib/core/types/worker-messages.ts';
import {
  HOUR_GRID_BASIS,
  PLAYTIME_VERSION,
} from '../../../src/lib/features/playtime/playtime-shared.ts';
import {
  WOT_GAME,
  buildLife,
  buildTimeTiles,
  dayRange,
} from '../../../src/lib/features/overview/overview-time.ts';
import type { OverviewTile } from '../../../src/lib/features/overview/overview-shared.ts';
import { OV_EXPECTED } from '../../helpers/overview-oracle.ts';
import {
  overviewInputsFromArchive,
  overviewPlaytimeFromArchive,
} from '../../helpers/overview-inputs.ts';
import { buildOverviewInsightExport } from '../../fixtures/overview-fixtures.ts';

// -----------------------------------------------------------------------------
// The helpers
// -----------------------------------------------------------------------------

/** The tile of an id, ready. Throws when the tile is absent. */
function ready(tiles: readonly OverviewTile[], id: string): Record<string, unknown> {
  const tile = tiles.find((entry) => entry.id === id);
  if (tile === undefined) throw new Error(`no tile ${id}`);
  if (tile.status !== 'ok') throw new Error(`expected a ready ${id} tile`);
  return tile as unknown as Record<string, unknown>;
}

/** The tile of an id, absent. Throws when the tile is ready. */
function absent(tiles: readonly OverviewTile[], id: string): Record<string, unknown> {
  const tile = tiles.find((entry) => entry.id === id);
  if (tile === undefined) throw new Error(`no tile ${id}`);
  if (tile.status !== 'absent') throw new Error(`expected an absent ${id} tile`);
  return tile as unknown as Record<string, unknown>;
}

/** A slice with every field filled, so a case states only what it changes. */
function sliceOf(partial: Partial<PlaytimeSlice>): PlaytimeSlice {
  return {
    seconds: 0,
    sessions: 0,
    excluded: 0,
    dayIndex: [],
    daySeconds: [],
    daySessions: [],
    hourOverlap: new Array<number>(168).fill(0),
    hourStart: new Array<number>(168).fill(0),
    bins: new Array<number>(12).fill(0),
    ...partial,
  };
}

/** A scope around one slice. */
function scopeOf(all: PlaytimeSlice): PlaytimeScope {
  return {
    v: PLAYTIME_VERSION,
    sessionsFileSeen: true,
    splitColumn: null,
    values: [],
    all,
    byValue: [],
  };
}

/**
 * An aggregate with one per-game scope.
 *
 * `game` names the scope's token, so a case can build the WOT scope, another
 * game's scope, or both.
 */
function aggregateOf(
  all: PlaytimeSlice,
  byGame: { game: string; scope: PlaytimeScope }[] = [],
): PlaytimeAggregates {
  return {
    v: PLAYTIME_VERSION,
    sessionsFileSeen: true,
    splitColumn: null,
    values: [],
    all,
    byValue: [],
    byGame,
  };
}

// -----------------------------------------------------------------------------
// 1. The oracle
// -----------------------------------------------------------------------------

describe('the Time group of the synthetic archive', () => {
  const playtime = overviewPlaytimeFromArchive(buildOverviewInsightExport());
  const tiles = buildTimeTiles(playtime, OV_EXPECTED.sessions.battleSeconds);

  it('reads Logged in as the union across every account and every game', () => {
    const logged = ready(tiles, 'logged');

    expect(logged.seconds).toBe(OV_EXPECTED.sessions.allSeconds);
    expect(logged.firstDay).toBe(OV_EXPECTED.sessions.firstDay);
    expect(logged.lastDay).toBe(OV_EXPECTED.sessions.lastDay);
    expect(logged.years).toEqual([...OV_EXPECTED.sessions.years]);
    expect(logged.battleSeconds).toBe(OV_EXPECTED.sessions.battleSeconds);
  });

  it('reads the four habits from the WoT scope alone', () => {
    const hour = ready(tiles, 'hour');
    expect(hour.hours).toEqual([...OV_EXPECTED.sessions.hours]);
    expect(hour.peakHour).toBe(OV_EXPECTED.sessions.peakHour);

    const streak = ready(tiles, 'streak');
    expect(streak.days).toBe(OV_EXPECTED.sessions.streak);
    expect(streak.startDay).toBe(OV_EXPECTED.sessions.days[0]!.day);
    expect(streak.endDay).toBe(OV_EXPECTED.sessions.days[2]!.day);

    const sess = ready(tiles, 'sess');
    expect(sess.seconds).toBe(OV_EXPECTED.sessions.longestSession.seconds);
    expect(sess.day).toBe(OV_EXPECTED.sessions.longestSession.day);

    const busy = ready(tiles, 'busy');
    expect(busy.seconds).toBe(OV_EXPECTED.sessions.busiestDay.seconds);
    expect(busy.day).toBe(OV_EXPECTED.sessions.busiestDay.day);
  });

  it('lists every game in the Wargaming life strip', () => {
    expect(buildLife(playtime)).toEqual([...OV_EXPECTED.sessions.life]);
  });

  it('takes the answer’s first and last day from the same aggregate', () => {
    expect(dayRange(playtime)).toEqual({
      firstDay: OV_EXPECTED.sessions.firstDay,
      lastDay: OV_EXPECTED.sessions.lastDay,
    });
  });

  it('reads the archive through the production parser, not a private one', () => {
    // The helper is the only bridge: it parses with `parseCsvFile` and
    // aggregates with `buildPlaytimeFromSources`, so the figures above are the
    // ones the WORKER would produce for the same archive.
    const inputs = overviewInputsFromArchive(buildOverviewInsightExport());
    expect(inputs.accountCount).toBe(OV_EXPECTED.stats.accountCount);
    expect(inputs.sessionSources).toHaveLength(3);
    // The sources are in the archive's own entry order, which is the sorted
    // file name: the Blitz file of the first root sorts before its WoT file.
    expect(inputs.sessionSources.map((source) => source.game)).toEqual(['WOTB', 'WOT', 'WOT']);
    expect(inputs.accountStats.seen).toBe(true);
    expect(inputs.accountStats.groups).toHaveLength(2);
    expect(inputs.orders.seen).toBe(true);
    expect(inputs.currency.seen).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// 2. The named absences
// -----------------------------------------------------------------------------

describe('the Time group of a dataset without the session history', () => {
  it('is absent in every part when there is no session file at all', () => {
    const playtime = overviewPlaytimeFromArchive(
      buildOverviewInsightExport({ omit: ['sessions'] }),
    );
    const tiles = buildTimeTiles(playtime, null);

    for (const id of ['logged', 'hour', 'streak', 'sess', 'busy']) {
      const tile = absent(tiles, id);
      expect(tile.need, id).toBe('session-history');
      expect(tile.column, id).toBeNull();
    }
    expect(buildLife(playtime)).toEqual([]);
  });

  it('keeps Logged in and loses the four habits when only the Blitz file is left', () => {
    const playtime = overviewPlaytimeFromArchive(
      buildOverviewInsightExport({ omit: ['wot-sessions'] }),
    );
    const tiles = buildTimeTiles(playtime, null);

    const logged = ready(tiles, 'logged');
    expect(logged.seconds).toBe(OV_EXPECTED.absent['wot-sessions']!.loggedSeconds);
    for (const id of ['hour', 'streak', 'sess', 'busy']) {
      expect(absent(tiles, id).need, id).toBe('session-history');
    }
    expect(buildLife(playtime)).toEqual([
      { game: 'WOTB', seconds: OV_EXPECTED.sessions.wotbSeconds },
    ]);
  });

  it('answers a legacy Sessions.csv with a ready Logged in and four absent habits', () => {
    // A legacy file names no game, so it cannot make a claim about WoT
    // sessions — the habits are absent while Logged in stays ready (T-13-25).
    const legacy = sliceOf({
      seconds: 3600,
      sessions: 1,
      dayIndex: [18322],
      daySeconds: [3600],
      daySessions: [1],
      longestSeconds: 3600,
      longestStart: 18322 * 86400,
    });
    const playtime = aggregateOf(legacy, []);
    const tiles = buildTimeTiles(playtime, null);

    expect(ready(tiles, 'logged').seconds).toBe(3600);
    for (const id of ['hour', 'streak', 'sess', 'busy']) {
      expect(absent(tiles, id).need, id).toBe('session-history');
    }
    expect(buildLife(playtime)).toEqual([]);
  });

  it('answers a null aggregate with five absent tiles and no life', () => {
    const tiles = buildTimeTiles(null, null);

    expect(tiles).toHaveLength(5);
    for (const id of ['logged', 'hour', 'streak', 'sess', 'busy']) {
      expect(absent(tiles, id).need, id).toBe('session-history');
    }
    expect(buildLife(null)).toEqual([]);
    expect(dayRange(null)).toEqual({ firstDay: null, lastDay: null });
  });
});

// -----------------------------------------------------------------------------
// 3. The delicate cases
// -----------------------------------------------------------------------------

describe('the delicate Time cases', () => {
  it('leaves the longest session absent when the aggregate predates the field', () => {
    // A v3-shaped aggregate has no `longestSeconds`/`longestStart`, and an
    // absent value is NOT a zero (T-13-14).
    const wot = sliceOf({
      seconds: 3600,
      sessions: 1,
      dayIndex: [18322],
      daySeconds: [3600],
      daySessions: [1],
      hourOverlap: gridOf({ 0: 3600 }),
    });
    const playtime = aggregateOf(wot, [{ game: WOT_GAME, scope: scopeOf(wot) }]);
    const tiles = buildTimeTiles(playtime, null);

    expect(absent(tiles, 'sess').need).toBe('session-history');
    expect(ready(tiles, 'logged').seconds).toBe(3600);
    expect(ready(tiles, 'streak').days).toBe(1);
    expect(ready(tiles, 'busy').seconds).toBe(3600);
    expect(ready(tiles, 'hour').peakHour).toBe(0);
  });

  it('picks the earliest day when two days hold the same seconds', () => {
    const wot = sliceOf({
      seconds: 200,
      sessions: 2,
      dayIndex: [18310, 18320],
      daySeconds: [100, 100],
      daySessions: [1, 1],
    });
    const playtime = aggregateOf(wot, [{ game: WOT_GAME, scope: scopeOf(wot) }]);

    expect(ready(buildTimeTiles(playtime, null), 'busy')).toMatchObject({
      seconds: 100,
      day: 18310,
    });
  });

  it('picks the earliest streak when two runs are equally long', () => {
    const wot = sliceOf({
      seconds: 400,
      sessions: 4,
      dayIndex: [18310, 18311, 18320, 18321],
      daySeconds: [100, 100, 100, 100],
      daySessions: [1, 1, 1, 1],
    });
    const playtime = aggregateOf(wot, [{ game: WOT_GAME, scope: scopeOf(wot) }]);

    expect(ready(buildTimeTiles(playtime, null), 'streak')).toMatchObject({
      days: 2,
      startDay: 18310,
      endDay: 18311,
    });
  });

  it('picks the earlier hour when two hours hold the same seconds', () => {
    const wot = sliceOf({
      seconds: 200,
      sessions: 2,
      dayIndex: [18310],
      daySeconds: [200],
      daySessions: [2],
      hourOverlap: gridOf({ 3: 100, 5: 100 }),
    });
    const playtime = aggregateOf(wot, [{ game: WOT_GAME, scope: scopeOf(wot) }]);

    expect(ready(buildTimeTiles(playtime, null), 'hour').peakHour).toBe(3);
  });

  it('counts a streak across a month boundary', () => {
    // 2020-02-29, 2020-03-01 and 2020-03-02 are three consecutive days.
    const wot = sliceOf({
      seconds: 300,
      sessions: 3,
      dayIndex: [18321, 18322, 18323],
      daySeconds: [100, 100, 100],
      daySessions: [1, 1, 1],
    });
    const playtime = aggregateOf(wot, [{ game: WOT_GAME, scope: scopeOf(wot) }]);

    expect(ready(buildTimeTiles(playtime, null), 'streak')).toMatchObject({
      days: 3,
      startDay: 18321,
      endDay: 18323,
    });
  });

  it('counts a streak across a year boundary', () => {
    // 2020-12-31, 2021-01-01 and 2021-01-02 are three consecutive days.
    const wot = sliceOf({
      seconds: 300,
      sessions: 3,
      dayIndex: [18627, 18628, 18629],
      daySeconds: [100, 100, 100],
      daySessions: [1, 1, 1],
    });
    const playtime = aggregateOf(wot, [{ game: WOT_GAME, scope: scopeOf(wot) }]);

    expect(ready(buildTimeTiles(playtime, null), 'streak')).toMatchObject({
      days: 3,
      startDay: 18627,
      endDay: 18629,
    });
  });

  it('sums the hour grid the HOUR_GRID_BASIS constant selects', () => {
    // The two grids differ, so the constant decides which one is read. The
    // expectation is derived from the constant rather than hard-coded, so the
    // case survives a flip of the basis.
    const overlap = gridOf({ 0: 100 });
    const start = gridOf({ 0: 5 });
    const wot = sliceOf({
      seconds: 100,
      sessions: 1,
      dayIndex: [18310],
      daySeconds: [100],
      daySessions: [1],
      hourOverlap: overlap,
      hourStart: start,
    });
    const playtime = aggregateOf(wot, [{ game: WOT_GAME, scope: scopeOf(wot) }]);

    const hour = ready(buildTimeTiles(playtime, null), 'hour');
    expect(hour.hours).toEqual(
      HOUR_GRID_BASIS === 'overlap'
        ? [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        : [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    );
  });

  it('is absent for an hour tile whose grid holds nothing', () => {
    const wot = sliceOf({
      seconds: 100,
      sessions: 1,
      dayIndex: [18310],
      daySeconds: [100],
      daySessions: [1],
    });
    const playtime = aggregateOf(wot, [{ game: WOT_GAME, scope: scopeOf(wot) }]);

    expect(absent(buildTimeTiles(playtime, null), 'hour').need).toBe('session-history');
  });
});

/**
 * A 168-cell grid with the given weekday-0 cells filled.
 *
 * The cells are `weekday * 24 + hour`, and every case here puts its seconds in
 * the FIRST weekday, so the hour of day is the cell's own hour.
 */
function gridOf(cells: Record<number, number>): number[] {
  const grid = new Array<number>(168).fill(0);
  for (const [hour, seconds] of Object.entries(cells)) {
    grid[Number(hour)] = seconds;
  }
  return grid;
}
