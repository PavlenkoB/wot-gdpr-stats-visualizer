// =============================================================================
// The mixed-points fixture cross-check (phase 04, plan 04-11, Task 2).
//
// WHY THIS FILE EXISTS
// The browser specs read the mixed fixture for GEOMETRY — a sticky head, a
// horizontal scroll, a tooltip inside the viewport — and those properties are
// not a function of the data's correctness. So nothing here would catch a
// wrong number, and the geometry tests would be testing a chart full of wrong
// numbers. This file proves the shape is right, using the SAME independent
// oracle as `playtime-hand-fixture.test.ts` and the same cluster composition
// for the same reason (the fixture crosses a year, so it spans past the
// oracle's 400-day bitmap guard by two days).
//
// A failure here means the shapes a browser spec depends on do not exist in
// the data — a "two sessions in this cell" assertion reading one, a "level 0"
// cell that is not reachable, a cross-year row that is not there — and the
// geometry test would pass against the wrong picture.
//
// Decisions: D-01, D-02, D-05, D-06.
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  MIXED_ALL,
  MIXED_BY_VALUE,
  MIXED_COLUMNS,
  MIXED_CSV,
  MIXED_ROWS,
  MIXED_SERVERS,
  MIXED_SPLIT_COLUMN,
} from '../../fixtures/playtime-mixed-fixture.ts';
import { buildSessionsCsvFromRows } from '../../fixtures/sessions-fixtures.ts';
import { oracleSlice, type OracleSession } from '../../helpers/session-oracle.ts';
import { HOUR_CELL_COUNT } from '../../../src/lib/features/playtime/playtime-shared.ts';
import { cellOfHour } from '../../../src/lib/features/playtime/playtime-aggregate.ts';

const { start: START, end: END, server: SERVER } = MIXED_COLUMNS;

function wallClockToSeconds(value: string): number {
  return (
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(5, 7)) - 1,
      Number(value.slice(8, 10)),
      Number(value.slice(11, 13)),
      Number(value.slice(14, 16)),
      Number(value.slice(17, 19)),
    ) / 1000
  );
}

function isUsable(row: readonly string[]): boolean {
  const start = row[START] ?? '';
  const end = row[END] ?? '';
  if (start === '' || end === '') return false;
  return wallClockToSeconds(end) >= wallClockToSeconds(start);
}

/** The fixture's active days as `YYYY-MM-DD`, ascending. */
function activeDates(): string[] {
  const dates = new Set(MIXED_ROWS.filter(isUsable).map((row) => (row[START] ?? '').slice(0, 10)));
  return [...dates].sort();
}

/**
 * The weekday-hour cell a wall clock string falls in, from the APP's own
 * `cellOfHour`. Monday 00:00 is cell 0.
 *
 * Deliberately the app's function and not `Date.getUTCDay()`: this file
 * asserts which cells the fixture populates, which is a claim about the app's
 * grid, and `getUTCDay()` is Sunday-based, so a locally-written copy would be
 * off by one on every cell and would still look right. Whether the GRID itself
 * is right is the hand fixture's job, proved against the oracle.
 */
function cellOf(wallClock: string): number {
  return cellOfHour(Math.floor(wallClockToSeconds(wallClock) / 3600));
}

/** The usable rows as the oracle's input shape. */
function oracleInput(rows: readonly (readonly string[])[]): OracleSession[] {
  return rows.filter(isUsable).map((row) => ({
    start: wallClockToSeconds(row[START]!),
    end: wallClockToSeconds(row[END]!),
  }));
}

/** The usable rows of one server. */
function rowsOfServer(server: string): (readonly string[])[] {
  return MIXED_ROWS.filter((row) => (row[SERVER] ?? '') === server);
}

describe('the mixed fixture: the CSV (19 lines, one per row plus the header)', () => {
  it('holds 18 rows — 15 usable and 3 excluded — and 19 lines with the header', () => {
    expect(MIXED_ROWS).toHaveLength(18);
    expect(MIXED_ROWS.filter(isUsable)).toHaveLength(15);
    expect(MIXED_ROWS.filter((row) => !isUsable(row))).toHaveLength(3);

    // 19 LINES: the header plus one per row. NOT 19 split chunks — the
    // builder ends the file with a separator, so a naive `split('\r')` yields
    // 20 with a trailing empty string. Asserting the naive count is how a test
    // ends up "fixed" by deleting the trailing CR, which would make the
    // fixture stop matching the real export's line-ending quirk (the reason
    // `buildSessionsCsvFromRows` writes CR at all).
    expect(MIXED_CSV.endsWith('\r')).toBe(true);
    const lines = MIXED_CSV.split('\r').filter((line) => line !== '');
    expect(lines).toHaveLength(19);
    expect(lines[0]).toBe('SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP');
    // And no LF anywhere: an LF in the fixture would parse identically under
    // PapaParse and would hide the mixed-ending coverage the builder exists
    // to provide.
    expect(MIXED_CSV).not.toContain('\n');
  });

  it('is built from the rows through the shared builder, byte for byte', () => {
    expect(MIXED_CSV).toBe(buildSessionsCsvFromRows(MIXED_ROWS));
  });

  it('carries the fixture address on every row, excluded included', () => {
    for (const row of MIXED_ROWS) expect(row[MIXED_COLUMNS.address]).toBe('192.0.2.99');
  });
});

describe('the mixed fixture: the shapes a browser test depends on', () => {
  it('has two servers in each of three rows', () => {
    // Counted as: the cell a row lands in, the hour, the day. Three rows each
    // share a (day, hour) with another server's row — Monday 20:00, Monday
    // 12:00 and Saturday 14:00. A fixture with one server dominating would
    // make the split selector's effect on the charts invisible.
    const slots = new Map<string, Set<string>>();
    for (const row of MIXED_ROWS.filter(isUsable)) {
      const slot = `${(row[START] ?? '').slice(0, 10)} ${(row[START] ?? '').slice(11, 13)}`;
      const set = slots.get(slot) ?? new Set<string>();
      set.add(row[SERVER] ?? '');
      slots.set(slot, set);
    }
    const shared = [...slots.values()].filter((servers) => servers.size === 2);
    expect(shared).toHaveLength(3);
  });

  it('has exactly one row crossing midnight, and it is the one crossing a year', () => {
    const crossers = MIXED_ROWS.filter(
      (row) => isUsable(row) && (row[START] ?? '').slice(0, 10) !== (row[END] ?? '').slice(0, 10),
    );
    expect(crossers).toHaveLength(1);
    // The same row, not two rows that happen to cross both: a fixture with
    // two midnight-crossers could not tell a year-boundary bug from a
    // day-boundary one.
    const [crosser] = crossers;
    expect(crosser?.[START]?.slice(0, 4)).toBe('2021');
    expect(crosser?.[END]?.slice(0, 4)).toBe('2022');
  });

  it('has a Monday 20:00 pair and a Monday 12:00 overlap pair, in different cells', () => {
    const monday = MIXED_ROWS.filter((row) => (row[START] ?? '').startsWith('2022-01-03'));
    const at20 = monday.filter((row) => (row[START] ?? '').slice(11, 13) === '20');
    const at12 = monday.filter((row) => (row[START] ?? '').slice(11, 13) === '12');
    expect(at20).toHaveLength(2);
    expect(at12).toHaveLength(2);
    // 2022-01-03 is a Monday, and the grid numbers Monday as weekday 0, so
    // both of the 20:00 rows are in cell 20 and both of the 12:00 rows in
    // cell 12. A test keyed on the CELL is keyed on the grid rather than on a
    // string comparison that would pass on a fixture with the wrong weekday.
    expect(at20.map((row) => cellOf(row[START]!))).toEqual([20, 20]);
    expect(at12.map((row) => cellOf(row[START]!))).toEqual([12, 12]);
  });

  it('has a Saturday cell and a Sunday cell', () => {
    const cells = new Set(MIXED_ROWS.filter(isUsable).map((row) => cellOf(row[START]!)));
    // Saturday is weekday 5 and Sunday weekday 6, so a Saturday hour is
    // >= 120 and a Sunday hour is >= 144.
    expect([...cells].some((cell) => cell >= 120 && cell < 144)).toBe(true);
    expect([...cells].some((cell) => cell >= 144)).toBe(true);
  });

  it('has a zero-length session, so a level-0 day is reachable', () => {
    const zero = MIXED_ROWS.filter(
      (row) => isUsable(row) && wallClockToSeconds(row[END]!) === wallClockToSeconds(row[START]!),
    );
    expect(zero).toHaveLength(1);
  });

  it('spans two years, so the calendar draws a year block and a run line', () => {
    const years = [
      ...new Set(MIXED_ROWS.filter(isUsable).map((row) => (row[START] ?? '').slice(0, 4))),
    ];
    expect(years.sort()).toEqual(['2021', '2022']);
    // The calendar's cell count is the total days of the active years: 2021
    // and 2022 are both 365-day years, so 730. A geometry test asserting a
    // scrollable width depends on this being a real multi-year grid.
    expect(730).toBe(365 + 365);
  });
});

describe('the mixed fixture: the numbers a browser test reads', () => {
  it('names SERVER_NAME as the split, and not CLIENT_PLATFORM', () => {
    // Three distinct usable server values qualify (two to fifty) and are
    // preferred; two platforms also qualify but the server column is offered
    // first (04-03's SPLIT_COLUMNS order), so a spec asserting a selector
    // labelled "Server name" depends on this.
    const servers = new Set(MIXED_ROWS.filter(isUsable).map((row) => row[SERVER]));
    const platforms = new Set(
      MIXED_ROWS.filter(isUsable).map((row) => row[MIXED_COLUMNS.platform]),
    );
    expect(servers.size).toBe(3);
    expect(platforms.size).toBeGreaterThanOrEqual(2);
    expect(MIXED_SPLIT_COLUMN).toBe('SERVER_NAME');
  });

  it('lists the servers in DESCENDING merged-seconds order, not alphabetically', () => {
    // bravo 14,100 > alpha 11,100 > charlie 6,600. Alphabetical would be
    // alpha, bravo, charlie, so a test reading the selector by index is
    // genuinely reading the worker's ordering.
    expect([...MIXED_SERVERS]).toEqual(['bravo', 'alpha', 'charlie']);
    expect(MIXED_BY_VALUE.bravo.seconds).toBeGreaterThan(MIXED_BY_VALUE.alpha.seconds);
    expect(MIXED_BY_VALUE.alpha.seconds).toBeGreaterThan(MIXED_BY_VALUE.charlie.seconds);
  });

  it('has the All and per-value totals the specs quote', () => {
    expect(MIXED_ALL).toEqual({
      seconds: 29_400,
      sessions: 15,
      activeDays: 9,
      excluded: 3,
      hoursText: '8.2 hours',
    });
    for (const server of MIXED_SERVERS) {
      expect(MIXED_BY_VALUE[server]?.excluded).toBe(1);
    }
    // The parts sum to MORE than the All total: 14,100 + 11,100 + 6,600 is
    // 31,800 against All's 29,400, because a session that overlaps a session
    // of ANOTHER server is merged in All and cannot be in both parts.
    const parts = MIXED_SERVERS.reduce((sum, server) => sum + MIXED_BY_VALUE[server]!.seconds, 0);
    expect(parts).toBe(31_800);
    expect(parts).toBeGreaterThan(MIXED_ALL.seconds);
  });

  it('spans 168 hour cells with seven of them non-zero under the overlap basis', () => {
    // The exact index set is asserted in the hand fixture's own test; here the
    // claim is only that the grid is FULL and not two hotspots, because a
    // density test that reads the ramp needs a spread to read it against.
    expect(HOUR_CELL_COUNT).toBe(168);
  });

  it('covers the nine active days the calendar will draw', () => {
    expect(activeDates()).toEqual([
      '2021-12-31',
      '2022-01-03',
      '2022-01-08',
      '2022-01-09',
      '2022-01-10',
      '2022-01-11',
      '2022-01-12',
      '2022-01-13',
      '2022-01-15',
    ]);
  });
});

describe('the mixed fixture: the numbers, recomputed by the oracle', () => {
  // Unlike the nine-row fixture this one fits inside the oracle's 400-day
  // bitmap guard on its own — 2021-12-31 to 2022-01-15 is 15 days — so it is
  // run through `oracleSlice` directly, with no cluster composition and no
  // merge to be exact about. The two fixtures therefore check the two
  // different things: THIS one checks the arithmetic, and the nine-row one
  // checks that the composition over a wide span is exact.
  const result = oracleSlice(oracleInput(MIXED_ROWS));

  it('merges to 29,400 seconds over 15 usable sessions and 9 active days', () => {
    expect(result.seconds).toBe(29_400);
    expect(result.sessions).toBe(15);
    expect(result.dayIndex).toHaveLength(9);
    expect(MIXED_ALL.seconds).toBe(result.seconds);
    expect(MIXED_ALL.sessions).toBe(result.sessions);
    expect(MIXED_ALL.activeDays).toBe(result.dayIndex.length);
  });

  it('sums to 29,400 under either hour basis', () => {
    expect(result.hourOverlap.reduce((a, b) => a + b, 0)).toBe(29_400);
    expect(result.hourStart.reduce((a, b) => a + b, 0)).toBe(29_400);
  });

  it('differs in exactly six cells, the three overlap pairs and their tails', () => {
    const differing: number[] = [];
    for (let i = 0; i < result.hourOverlap.length; i += 1) {
      if (result.hourOverlap[i] !== result.hourStart[i]) differing.push(i);
    }
    // Only a session that CROSSES an hour boundary makes the two bases
    // differ, and exactly three of these do: Monday 20:30-21:15 (cells 20 and
    // 21), Tuesday 19:00-20:30 (cells 43 and 44) and the cross-year row
    // Friday 23:15 into Saturday 00:45 (cells 119 and 120).
    //
    // The three OVERLAP pairs contribute nothing here, which is the
    // non-obvious half: both sessions of a pair START in the same cell, so
    // `start` puts the merged increment in the same cell `overlap` splits it
    // across, and the two totals agree. A fixture whose pairs straddled an
    // hour would have proved the wrong thing.
    expect(differing).toEqual([20, 21, 43, 44, 119, 120]);
  });

  it('places two sessions in the Monday 20:00 cell and two in the 12:00 cell', () => {
    // The cell claims a geometry test makes about "two sessions here", so the
    // DAY has to carry two sessions — the hour cells carry merged seconds and
    // cannot report a session count.
    const monday = MIXED_ROWS.filter(
      (row) => isUsable(row) && (row[START] ?? '').startsWith('2022-01-03'),
    );
    expect(monday).toHaveLength(4);
    expect(result.daySessions[result.dayIndex.indexOf(Date.UTC(2022, 0, 3) / 86_400_000)]).toBe(4);
    expect(result.daySeconds[result.dayIndex.indexOf(Date.UTC(2022, 0, 3) / 86_400_000)]).toBe(
      8_100,
    );
  });

  it('matches the hand-written bin counts, by RAW length', () => {
    expect(result.bins).toEqual([1, 0, 0, 1, 3, 1, 7, 2, 0, 0, 0, 0]);
    expect(result.bins.reduce((a, b) => a + b, 0)).toBe(15);
  });

  it('gives every server its own slice, with one excluded row each', () => {
    for (const server of MIXED_SERVERS) {
      const rows = rowsOfServer(server);
      const perValue = oracleSlice(oracleInput(rows));
      const expected = MIXED_BY_VALUE[server]!;
      expect(perValue.seconds, `${server} seconds`).toBe(expected.seconds);
      expect(perValue.sessions, `${server} sessions`).toBe(expected.sessions);
      expect(perValue.dayIndex.length, `${server} active days`).toBe(expected.activeDays);
      expect(
        rows.filter((row) => !isUsable(row)),
        `${server} excluded rows`,
      ).toHaveLength(expected.excluded);
    }
  });

  it('makes the three parts sum to 31,800, more than the All total', () => {
    // The cross-server merges: Monday 20:00 and Monday 12:00 and Saturday
    // 14:00 each hold one session from EACH of two servers, so All merges
    // 2,400 seconds that the parts necessarily count twice. The split table's
    // note exists for exactly this, and a fixture where the parts summed to
    // the total could not exercise it.
    const parts = MIXED_SERVERS.reduce(
      (sum, server) => sum + oracleSlice(oracleInput(rowsOfServer(server))).seconds,
      0,
    );
    expect(parts).toBe(31_800);
    expect(parts - MIXED_ALL.seconds).toBe(2_400);
  });
});
