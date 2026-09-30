// =============================================================================
// The real-shape fixture cross-check (phase 04, plan 04-14, Task 2).
//
// WHY THIS FILE EXISTS
// The rows in `tests/fixtures/playtime-real-shape-fixture.ts` drive a
// Playwright spec and three worker tests, and a browser run only happens in CI
// or on a developer machine. That leaves the hand numbers themselves unverified
// until CI runs hours later — and a wrong hand number would be a green CI that
// proves nothing. So this test proves them HERE, in Node, against the
// INDEPENDENT oracle from plan 04-03.
//
// `oracleSlice` shares no primitive with the aggregator it checks: overlap is
// resolved with a per-second `Uint8Array` bitmap rather than a watermark
// sweep, and weekday-hour cells come from `Date` + `getUTCDay()` rather than
// arithmetic on absolute hour numbers. This file converts the DOTTED stamps
// through `Date.UTC` and its own slicing, a THIRD path (deliberately not
// `civil-date.ts`, and deliberately not the implementation's
// `parseSessionTimestamp`), so the two can disagree.
//
// A failure here means one of three things, and all three are fixed before the
// browser spec is trusted: a hand number in the fixture module is wrong, the
// app's copy drifted from the formatter, or the app genuinely regressed.
//
// Decisions: D-01 (dates and hours as recorded), D-02 (excluded rows), D-05
// (duration bins), D-06 (the totals). T-04-28 (the day-first dotted stamp).
// =============================================================================

import { describe, expect, it } from 'vitest';

import {
  REAL_SHAPE_ALL,
  REAL_SHAPE_HEADER,
  REAL_SHAPE_IP,
  REAL_SHAPE_WOT,
  REAL_SHAPE_WOT_ROWS,
  REAL_SHAPE_WOWS,
  REAL_SHAPE_WOWS_ROWS,
  buildRealShapeCsv,
  type RealShapeRow,
  type RealShapeSlice,
} from '../fixtures/playtime-real-shape-fixture.ts';
import { oracleSlice, type OracleSession, type OracleSlice } from '../helpers/session-oracle.ts';

// -----------------------------------------------------------------------------
// The real shape, and this file's own reading of it
// -----------------------------------------------------------------------------

/**
 * Column index of the address in a rendered `REAL_SHAPE_HEADER` line.
 *
 * The stamp fields are read through the destructuring in
 * {@link dottedToSeconds}'s callers, so only the address needs an index here.
 */
const ADDRESS = 2;

/**
 * The dotted wall clock a session-file cell carries, as Unix seconds.
 *
 * DAY FIRST, and that is the claim under test (T-04-28): this slice reads the
 * first two two-digit fields as the day and the month. The implementation's
 * `parseSessionTimestamp` does the same thing, so a swap in EITHER would have
 * to be made twice, in two files, to hide — which is the point of writing the
 * conversion out again instead of importing it.
 *
 * Deliberately NOT `civil-date.ts` and NOT the app's parser: a shared
 * calendar routine would make a bug in it cancel out on both sides.
 */
function dottedToSeconds(value: string): number {
  return (
    Date.UTC(
      Number(value.slice(6, 10)), // year
      Number(value.slice(3, 5)) - 1, // month, from the SECOND field
      Number(value.slice(0, 2)), // day, from the FIRST field
      Number(value.slice(11, 13)),
      Number(value.slice(14, 16)),
      0, // the real shape carries no seconds
    ) / 1000
  );
}

/**
 * A row is usable when both stamps parse and the end is not before the start —
 * the whole of D-02's exclusion rule, written once here so the excluded-count
 * assertion and the oracle input agree by construction.
 */
function isUsable(row: RealShapeRow): boolean {
  const [started, finished] = row;
  if (started === '' || finished === '') return false;
  return dottedToSeconds(finished) >= dottedToSeconds(started);
}

/** The usable rows as the oracle's input shape. */
function oracleInput(rows: readonly RealShapeRow[]): OracleSession[] {
  return rows.filter(isUsable).map(([started, finished]) => ({
    start: dottedToSeconds(started),
    end: dottedToSeconds(finished),
  }));
}

// -----------------------------------------------------------------------------
// The wide-span composition, copied from tests/unit/playtime-hand-fixture.test.ts
// -----------------------------------------------------------------------------
//
// WHY IT IS HERE AND WHY IT IS A COPY
// `oracleSlice` marks one second per session, so it refuses a span above 400
// days rather than allocating a gigabyte-scale `Uint8Array`. The rows of this
// fixture span about 830 days — 2019, 2020 and 2021 — precisely so the
// collapsed-empty-year run between two active years is exercised, and that is
// over the guard.
//
// The sessions are therefore split into CLUSTERS at gaps wider than the guard,
// each cluster is run through the UNMODIFIED oracle, and the cluster results
// are summed. That composition is exact, and the two properties it needs are
// ASSERTED below rather than assumed:
//
//   1. No session straddles a cluster boundary. Every session is inside
//      exactly one cluster, so no merge, no count and no containment is split
//      across two calls.
//   2. Consecutive clusters are separated by at least one whole day. Two
//      clusters can then share neither a second nor a day number, so
//      `seconds`, the hour grids and the bins are all purely additive, and
//      `dayIndex` is a disjoint union rather than a merge.
//
// The gap assertion is the load-bearing one: without it a boundary through a
// midnight would silently double-count an overlapping second, and the summed
// total would be wrong in a way no index-by-index comparison against the hand
// table would catch, because the hand table is written under the same (wrong)
// assumption.
//
// WHY IT IS DUPLICATED RATHER THAN EXTRACTED
// The helper and its merge function in the hand-fixture test are local to that
// file and are not exported. Extracting them to `tests/helpers/` is the right
// end state and is recorded as follow-up, but it would mean editing a passing
// phase-4 test in a plan that does not own it, so this plan copies them and
// names where they came from.
const ORACLE_BITMAP_GUARD_SECONDS = 400 * 86_400;

/** One whole day, the minimum separation that keeps two clusters disjoint. */
const ONE_DAY = 86_400;

/** The oracle over a session set that spans more than its 400-day guard. */
function oracleOverWideSpan(sessions: readonly OracleSession[]): OracleSlice {
  const ordered = [...sessions].sort((a, b) => a.start - b.start);

  // The running MAXIMUM end of the open cluster, not the last session's end:
  // sessions are sorted by START, so a long one can end after a later-starting
  // short one, and comparing against the wrong one would put a second into the
  // same cluster as a session that overlaps it.
  const clusters: OracleSession[][] = [];
  let openEnd = Number.NEGATIVE_INFINITY;
  for (const session of ordered) {
    if (clusters.length === 0 || session.start - openEnd >= ORACLE_BITMAP_GUARD_SECONDS) {
      clusters.push([session]);
      openEnd = session.end;
      continue;
    }
    clusters.at(-1)!.push(session);
    openEnd = Math.max(openEnd, session.end);
  }

  // Property 1: no session straddles a boundary.
  const results = clusters.map((cluster) => {
    const span = Math.max(...cluster.map((s) => s.end)) - Math.min(...cluster.map((s) => s.start));
    expect(
      span,
      `a cluster still spans ${span}s, above the ${ORACLE_BITMAP_GUARD_SECONDS}s guard`,
    ).toBeLessThanOrEqual(ORACLE_BITMAP_GUARD_SECONDS);
    return oracleSlice(cluster);
  });

  // Property 2: consecutive clusters are at least a day apart, so no second
  // and no day number is shared and every total is additive.
  for (let i = 1; i < clusters.length; i += 1) {
    const previous = clusters[i - 1]!;
    const current = clusters[i]!;
    const previousEnd = Math.max(...previous.map((s) => s.end));
    const currentStart = Math.min(...current.map((s) => s.start));
    expect(
      currentStart - previousEnd,
      `cluster ${i} starts only ${currentStart - previousEnd}s after cluster ${i - 1} ends; ` +
        'the summed result would not be exact',
    ).toBeGreaterThanOrEqual(ONE_DAY);
  }

  return mergeOracleResults(results);
}

/**
 * Add up per-cluster oracle results. Exact under property 2: `seconds`, both
 * hour grids, the bins and the day figures are all disjoint sums, and the day
 * lists concatenate in ascending order because the clusters are ordered.
 */
function mergeOracleResults(parts: readonly OracleSlice[]): OracleSlice {
  const dayIndex: number[] = [];
  const daySeconds: number[] = [];
  const daySessions: number[] = [];
  const hourOverlap = new Array<number>(168).fill(0);
  const hourStart = new Array<number>(168).fill(0);
  const bins = new Array<number>(12).fill(0);
  let seconds = 0;
  let sessions = 0;

  for (const part of parts) {
    seconds += part.seconds;
    sessions += part.sessions;
    part.dayIndex.forEach((day, at) => {
      dayIndex.push(day);
      daySeconds.push(part.daySeconds[at] ?? 0);
      daySessions.push(part.daySessions[at] ?? 0);
    });
    part.hourOverlap.forEach((value, at) => {
      hourOverlap[at] = (hourOverlap[at] ?? 0) + value;
    });
    part.hourStart.forEach((value, at) => {
      hourStart[at] = (hourStart[at] ?? 0) + value;
    });
    part.bins.forEach((value, at) => {
      bins[at] = (bins[at] ?? 0) + value;
    });
  }

  return { seconds, sessions, dayIndex, daySeconds, daySessions, hourOverlap, hourStart, bins };
}

/** A 168-cell grid as a cell-to-seconds record of its NON-ZERO cells. */
function nonZeroCells(grid: readonly number[]): Record<number, number> {
  const cells: Record<number, number> = {};
  grid.forEach((value, cell) => {
    if (value > 0) cells[cell] = value;
  });
  return cells;
}

/**
 * The twelve duration bins, each by its INCLUSIVE lower bound in seconds, the
 * last of which (16 hours) has no upper bound.
 *
 * Re-derived from `04-UI-SPEC.md` §7's table rather than imported from
 * `playtime-shared.ts`, so a change to the app's edge list has to be argued
 * for in this file rather than quietly agreeing with itself.
 */
const BIN_LOWER_BOUNDS_SECONDS = [
  0, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 14400, 28800, 57600,
];

/** The bin a raw length falls in: the LAST bound at or below the length. */
function binOf(lengthSeconds: number): number {
  for (let i = BIN_LOWER_BOUNDS_SECONDS.length - 1; i >= 0; i -= 1) {
    if (lengthSeconds >= BIN_LOWER_BOUNDS_SECONDS[i]!) return i;
  }
  return 0;
}

/** The expected hours tile text, `formatHours`, re-derived here. */
function expectedHoursText(seconds: number): string {
  const hours = seconds / 3600;
  if (hours === 0) return '0 min';
  if (hours < 1) return `${Math.floor(hours * 60)} min`;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
}

// -----------------------------------------------------------------------------
// The row shape
// -----------------------------------------------------------------------------

describe('the real-shape fixture: the file shape the real export ships', () => {
  it('writes the three-column header with CRLF and no leading blank line', () => {
    const csv = buildRealShapeCsv(REAL_SHAPE_WOT_ROWS);

    expect(REAL_SHAPE_HEADER).toBe('STARTED_AT;FINISHED_AT;IP');
    expect(csv.startsWith(`${REAL_SHAPE_HEADER}\r\n`)).toBe(true);
    // Every line ending is CRLF and there is no bare CR or LF separator: the
    // real export's own quirk, which a fixture that normalised it away would
    // stop covering.
    expect(csv.includes('\r\n')).toBe(true);
    expect(csv.split('\r\n').filter((line) => line !== '').length).toBe(
      REAL_SHAPE_WOT_ROWS.length + 1,
    );
    // The whole file is CRLF-terminated, including the last row.
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('gives an empty row list a header-only file, not an empty one', () => {
    // The `WOTB` and `WOWS` files of a one-game account ship exactly like this,
    // and "the file was there and held nothing" is a different answer from
    // "there was no file".
    expect(buildRealShapeCsv([])).toBe(`${REAL_SHAPE_HEADER}\r\n`);
  });

  it('carries the canary address in EVERY row, excluded ones included', () => {
    const lines = buildRealShapeCsv(REAL_SHAPE_WOT_ROWS)
      .split('\r\n')
      .filter((l) => l !== '');
    for (const line of lines.slice(1)) {
      expect(line.split(';')[ADDRESS]).toBe(REAL_SHAPE_IP);
    }
    // T-04-01 made testable rather than merely asserted: a fixture that only
    // populated the address on usable rows could not make a privacy assertion
    // fail.
    expect(lines.filter((l) => !l.startsWith(REAL_SHAPE_HEADER))).toHaveLength(
      REAL_SHAPE_WOT_ROWS.length,
    );
  });

  it('excludes exactly two WOT rows, and both for a named reason', () => {
    const unusable = REAL_SHAPE_WOT_ROWS.filter((row) => !isUsable(row));

    // Their SHAPE, not just their count: one row has no finish cell at all and
    // the other ends before it starts. A count of two would still be satisfied
    // by two rows excluded for the same reason.
    expect(unusable).toHaveLength(2);
    expect(unusable.filter(([, finished]) => finished === '')).toHaveLength(1);
    expect(
      unusable.filter(
        ([started, finished]) =>
          finished !== '' && dottedToSeconds(finished) < dottedToSeconds(started),
      ),
    ).toHaveLength(1);
    expect(REAL_SHAPE_WOWS_ROWS.every(isUsable)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// The three keys against the oracle
// -----------------------------------------------------------------------------

/** Everything one key claims, checked against one oracle run. */
function expectKeyProved(key: RealShapeSlice, rows: readonly RealShapeRow[]): void {
  const result = oracleOverWideSpan(oracleInput(rows));

  expect(result.seconds).toBe(key.seconds);
  expect(result.sessions).toBe(key.sessions);
  expect(rows.length - result.sessions).toBe(key.excluded);
  expect(result.dayIndex.length).toBe(key.activeDays);
  expect(result.dayIndex).toEqual([...key.dayIndex]);
  expect(result.daySeconds).toEqual([...key.daySeconds]);
  expect(result.daySessions).toEqual([...key.daySessions]);
  expect(result.bins).toEqual([...key.bins]);
  expect(nonZeroCells(result.hourOverlap)).toEqual(key.hourOverlapNonZero);
  expect(nonZeroCells(result.hourStart)).toEqual(key.hourStartNonZero);
  // Both grids are full 168-cell arrays, and each one sums to the total, which
  // is what says the two charts describe the SAME playtime.
  expect(result.hourOverlap).toHaveLength(168);
  expect(result.hourStart).toHaveLength(168);
  expect(result.hourOverlap.reduce((a, b) => a + b, 0)).toBe(key.seconds);
  expect(result.hourStart.reduce((a, b) => a + b, 0)).toBe(key.seconds);
  // The bins are counted from the RAW lengths, re-derived here from the edge
  // table so the key's twelve numbers are checked against something.
  const rawBins = new Array<number>(12).fill(0);
  for (const [started, finished] of rows.filter(isUsable)) {
    rawBins[binOf(dottedToSeconds(finished) - dottedToSeconds(started))]! += 1;
  }
  expect(rawBins).toEqual([...key.bins]);
}

describe('the real-shape fixture: WOT alone against the independent oracle', () => {
  it('proves every number in REAL_SHAPE_WOT', () => {
    expectKeyProved(REAL_SHAPE_WOT, REAL_SHAPE_WOT_ROWS);
  });

  it('reads as 3.5 hours and announces itself as the WOT file', () => {
    expect(expectedHoursText(REAL_SHAPE_WOT.seconds)).toBe(REAL_SHAPE_WOT.hoursText);
    expect(REAL_SHAPE_WOT.hoursText).toBe('3.5 hours');
    expect(REAL_SHAPE_WOT.announcement).toBe('Showing WOT: 3.5 hours, 5 sessions, 3 active days.');
  });
});

describe('the real-shape fixture: WOWS alone against the independent oracle', () => {
  it('proves every number in REAL_SHAPE_WOWS', () => {
    expectKeyProved(REAL_SHAPE_WOWS, REAL_SHAPE_WOWS_ROWS);
  });

  it('reads as 1.8 hours and announces itself as the WOWS file', () => {
    expect(expectedHoursText(REAL_SHAPE_WOWS.seconds)).toBe(REAL_SHAPE_WOWS.hoursText);
    expect(REAL_SHAPE_WOWS.hoursText).toBe('1.8 hours');
    expect(REAL_SHAPE_WOWS.announcement).toBe(
      'Showing WOWS: 1.8 hours, 2 sessions, 2 active days.',
    );
  });
});

describe('the real-shape fixture: both files merged, against the oracle', () => {
  it('proves every number in REAL_SHAPE_ALL', () => {
    expectKeyProved(REAL_SHAPE_ALL, [...REAL_SHAPE_WOT_ROWS, ...REAL_SHAPE_WOWS_ROWS]);
  });

  it('is 1,800 seconds LESS than the two game totals, which is D-02', () => {
    // The non-additivity is the point of the shape, not an error in the key:
    // the WOWS row 13.03.2019 21:30-23:00 overlaps the WOT span by half an
    // hour, and the union counts that half hour once. A hand key that simply
    // added the parts would be wrong here and the browser spec would then
    // assert a wrong number.
    const parts = REAL_SHAPE_WOT.seconds + REAL_SHAPE_WOWS.seconds;
    expect(parts - REAL_SHAPE_ALL.seconds).toBe(1800);
    expect(REAL_SHAPE_ALL.sessions).toBe(REAL_SHAPE_WOT.sessions + REAL_SHAPE_WOWS.sessions);
  });

  it('reads as 4.8 hours and announces the whole set, not one game', () => {
    expect(expectedHoursText(REAL_SHAPE_ALL.seconds)).toBe(REAL_SHAPE_ALL.hoursText);
    expect(REAL_SHAPE_ALL.hoursText).toBe('4.8 hours');
    expect(REAL_SHAPE_ALL.announcement).toBe(
      'Showing all sessions: 4.8 hours, 7 sessions, 4 active days.',
    );
  });
});

// -----------------------------------------------------------------------------
// The calendar figures, which no oracle reports
// -----------------------------------------------------------------------------

describe('the real-shape fixture: the calendar cell counts', () => {
  /** Days in a year, through `Date.UTC` rather than the app's own helper. */
  function daysInYear(year: number): number {
    return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
  }

  it.each([
    ['WOT', REAL_SHAPE_WOT, REAL_SHAPE_WOT_ROWS],
    ['WOWS', REAL_SHAPE_WOWS, REAL_SHAPE_WOWS_ROWS],
    ['both games', REAL_SHAPE_ALL, [...REAL_SHAPE_WOT_ROWS, ...REAL_SHAPE_WOWS_ROWS]],
  ])('proves the %s cell count and active years', (_label, key, rows) => {
    const result = oracleOverWideSpan(oracleInput(rows));

    // The drawn years are the distinct calendar years of the ACTIVE day
    // numbers, read through `Date`, so the key's year list is checked rather
    // than assumed.
    const years = [
      ...new Set(result.dayIndex.map((day) => new Date(day * 86_400_000).getUTCFullYear())),
    ].sort((a, b) => a - b);
    expect(years).toEqual([...key.years]);

    const cells = years.reduce((total, year) => total + daysInYear(year), 0);
    expect(cells).toBe(key.calendarCells);
  });

  it('puts the 13th, the 14th and the Monday on the days the key names (T-04-28)', () => {
    // The day-first claim, stated as three named dates. A month-first reading
    // would exclude the two March rows outright as month 13 and 14, and would
    // move the 2 November rows to 11 February — so every one of these three
    // assertions fails if the fields are ever swapped.
    const result = oracleOverWideSpan(oracleInput(REAL_SHAPE_WOT_ROWS));
    const dayNumbers = (y: number, m: number, d: number): number =>
      Date.UTC(y, m - 1, d) / 86_400_000;

    const march13 = result.dayIndex.indexOf(dayNumbers(2019, 3, 13));
    expect(march13).toBeGreaterThanOrEqual(0);
    expect(result.daySeconds[march13]).toBe(7200);
    expect(result.daySessions[march13]).toBe(2);

    const march14 = result.dayIndex.indexOf(dayNumbers(2019, 3, 14));
    expect(result.daySeconds[march14]).toBe(3600);
    expect(result.daySessions[march14]).toBe(1);

    const monday = result.dayIndex.indexOf(dayNumbers(2020, 11, 2));
    expect(monday).toBeGreaterThanOrEqual(0);
    expect(result.daySeconds[monday]).toBe(1800);
    expect(result.daySessions[monday]).toBe(2);

    // And the weekdays the hour cells are built from: 2019-03-13 Wednesday,
    // 2019-03-14 Thursday, 2019-03-15 Friday, 2020-11-02 Monday, 2021-06-20
    // Sunday. `getUTCDay()` numbers Sunday 0; the grid numbers Monday 0.
    const mondayZero = (day: number): number => (new Date(day * 86_400_000).getUTCDay() + 6) % 7;
    expect(mondayZero(dayNumbers(2019, 3, 13))).toBe(2);
    expect(mondayZero(dayNumbers(2019, 3, 14))).toBe(3);
    expect(mondayZero(dayNumbers(2019, 3, 15))).toBe(4);
    expect(mondayZero(dayNumbers(2020, 11, 2))).toBe(0);
    expect(mondayZero(dayNumbers(2021, 6, 20))).toBe(6);

    // The key's cell 10 is therefore Monday 10:00 and its cell 162 Sunday
    // 18:00, which is the arithmetic the two hour tables rest on.
    expect(mondayZero(dayNumbers(2020, 11, 2)) * 24 + 10).toBe(10);
    expect(mondayZero(dayNumbers(2021, 6, 20)) * 24 + 18).toBe(162);
  });
});
