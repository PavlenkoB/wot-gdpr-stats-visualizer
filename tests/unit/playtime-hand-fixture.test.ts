// =============================================================================
// The hand-fixture cross-check (phase 04, plan 04-11, Task 1).
//
// WHY THIS FILE EXISTS
// The nine hand rows in `tests/fixtures/playtime-hand-fixture.ts` drive two
// Playwright specs, and a browser run only happens in CI or on a developer
// machine. That leaves the hand numbers themselves unverified until CI runs
// hours later — and a wrong hand number would be a green CI that proves
// nothing. So this test proves them HERE, in Node, against the INDEPENDENT
// oracle from plan 04-03.
//
// `oracleSlice` shares no primitive with the aggregator it checks: overlap is
// resolved with a per-second `Uint8Array` bitmap rather than a watermark
// sweep, and weekday-hour cells come from `Date` + `getUTCDay()` rather than
// arithmetic on absolute hour numbers. This file converts the rows through
// `Date.UTC`, a THIRD path (deliberately not `civil-date.ts`, which is under
// test elsewhere), so the two can disagree.
//
// A failure here means one of three things, and all three are fixed before any
// browser spec is trusted: a hand number in the fixture module is wrong, the
// app's copy drifted from the formatter, or the app genuinely regressed.
//
// Decisions: D-01 (dates and hours as recorded), D-02 (excluded rows),
// D-05 (duration bins).
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  HAND_ALL,
  HAND_BINS,
  HAND_BLANK,
  HAND_EU,
  HAND_NA,
  HAND_ROWS,
  HAND_YEARS,
  HOUR_CELL_20_LINE2,
  HOUR_EXPECTED,
  expectedHourSeconds,
} from '../fixtures/playtime-hand-fixture.ts';
import { oracleSlice, type OracleSession } from '../helpers/session-oracle.ts';
import { SESSION_FIXTURE_IP } from '../fixtures/sessions-fixtures.ts';
import { HOUR_GRID_BASIS } from '../../src/lib/playtime-shared.ts';
import { formatHourCellLine1, formatHourCellLine2 } from '../../src/lib/ui-copy.ts';

/** The wall clock a CSV cell carries, as Unix seconds. */
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

/** One of the nine rows, indexed by the columns the export writes. */
const START = 0;
const END = 1;
const SERVER = 4;

/**
 * A row is usable when both instants parse and the end is not before the
 * start — the whole of D-02's exclusion rule, written once here so the
 * "exactly two rows are unusable" assertion below and the oracle input agree
 * by construction.
 */
function isUsable(row: readonly string[]): boolean {
  const start = row[START] ?? '';
  const end = row[END] ?? '';
  if (start === '' || end === '') return false;
  return wallClockToSeconds(end) >= wallClockToSeconds(start);
}

/** The usable rows as the oracle's input shape. */
function oracleInput(rows: readonly (readonly string[])[]): OracleSession[] {
  return rows.filter(isUsable).map((row) => ({
    start: wallClockToSeconds(row[START]!),
    end: wallClockToSeconds(row[END]!),
  }));
}

/** The usable rows of one server name; a blank cell is `''`. */
function rowsOfServer(server: string): (readonly string[])[] {
  return HAND_ROWS.filter((row) => (row[SERVER] ?? '') === server);
}

/** The day number (`floor(seconds / 86400)`) of a `YYYY-MM-DD` date cell. */
function dayNumber(date: string): number {
  return wallClockToSeconds(`${date} 00:00:00`) / 86400;
}

/** The day index `i` and the per-day figures the oracle reports for it. */
function dayFigures(
  result: ReturnType<typeof oracleSlice>,
  date: string,
): { seconds: number; sessions: number } {
  const at = result.dayIndex.indexOf(dayNumber(date));
  expect(at, `no active day ${date} in the oracle output`).toBeGreaterThanOrEqual(0);
  return { seconds: result.daySeconds[at] ?? 0, sessions: result.daySessions[at] ?? 0 };
}

/**
 * The oracle over a session set that spans more than its 400-day bitmap guard.
 *
 * WHY THIS EXISTS, and why it is sound rather than a workaround
 * ----------------------------------------------------------
 * `oracleSlice` marks one second per session, so it refuses a span above 400
 * days rather than allocating a gigabyte-scale `Uint8Array`. That guard is a
 * MEMORY bound, not a statement that a wider span is harder to check — and
 * 04-11's fixture is 1,399 days wide on purpose: three active years with a
 * collapsed empty one between two of them is what makes the empty-year run
 * line and the 1,095-cell count meaningful at all.
 *
 * So the sessions are split into CLUSTERS at gaps wider than the guard, each
 * cluster is run through the UNMODIFIED oracle, and the cluster results are
 * summed. That composition is exact, and the two properties it needs are
 * ASSERTED below rather than assumed:
 *
 *   1. No session straddles a cluster boundary. Every session is inside
 *      exactly one cluster, so no merge, no `fresh` count and no containment
 *      is split across two calls.
 *   2. Consecutive clusters are separated by at least one whole day. Two
 *      clusters can therefore share neither a second nor a day number, so
 *      `seconds`, the hour grids and the bins are all purely additive, and
 *      `dayIndex` is a disjoint union rather than a merge.
 *
 * The gap assertion is the load-bearing one: without it a cluster boundary
 * through a midnight would silently double-count an overlapping second, and
 * the summed total would be wrong in a way no index-by-index comparison
 * against the hand table would catch — because the hand table is written
 * under the same (wrong) assumption.
 */
const ORACLE_BITMAP_GUARD_SECONDS = 400 * 86_400;

/** One whole day, the minimum separation that keeps two clusters disjoint. */
const ONE_DAY = 86_400;

/**
 * Split sessions into clusters at gaps of at least `guard` seconds, assert
 * the composition is exact, and return the merged oracle result.
 */
function oracleOverWideSpan(sessions: readonly OracleSession[]): ReturnType<typeof oracleSlice> {
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

  // Property 1: no session straddles a boundary. Every cluster's span is
  // inside the guard, so the oracle accepted it rather than throwing.
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
function mergeOracleResults(
  parts: readonly ReturnType<typeof oracleSlice>[],
): ReturnType<typeof oracleSlice> {
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

describe('the hand fixture: row shape (D-01, D-02)', () => {
  it('declares nine rows of six fields, every one carrying the fixture address', () => {
    expect(HAND_ROWS).toHaveLength(9);
    for (const row of HAND_ROWS) {
      expect(row).toHaveLength(6);
      // T-04-01: the address is present in the DATA and read by nothing. That
      // is exactly what makes the browser privacy assertions meaningful, so
      // the module must not quietly drop it.
      expect(row[5]).toBe(SESSION_FIXTURE_IP);
    }
  });

  it('excludes exactly two rows, an empty end and an end before the start', () => {
    const unusable = HAND_ROWS.filter((row) => !isUsable(row));
    expect(unusable).toHaveLength(2);

    // Their SHAPE, not just their count: one row has no end at all, and the
    // other ends exactly one hour before it starts. A count of two would
    // still be satisfied by two rows excluded for the same reason.
    expect(unusable.filter((row) => (row[END] ?? '') === '')).toHaveLength(1);
    expect(
      unusable.filter(
        (row) =>
          (row[END] ?? '') !== '' &&
          wallClockToSeconds(row[END]!) === wallClockToSeconds(row[START]!) - 3600,
      ),
    ).toHaveLength(1);
  });

  it('attributes the excluded rows to na-1 and eu-1, so no blank server is excluded', () => {
    const servers = HAND_ROWS.filter((row) => !isUsable(row)).map((row) => row[SERVER]);
    expect(servers).toEqual(['na-1', 'eu-1']);
  });
});

describe('the hand fixture: the oracle composition over a 1,399-day span', () => {
  it('spans more than the oracle bitmap guard, which is why it is composed', () => {
    // A guard on the COMPOSITION itself. Without this, every assertion below
    // could be satisfied by a single `oracleSlice` call and the merge would
    // never run: the fixture would quietly get shorter, the guard would stop
    // biting, and the path that actually executes would be untested.
    const usable = oracleInput(HAND_ROWS);
    const span = Math.max(...usable.map((s) => s.end)) - Math.min(...usable.map((s) => s.start));
    expect(span).toBeGreaterThan(ORACLE_BITMAP_GUARD_SECONDS);
  });

  it('splits into the three clusters the rows describe, each inside the guard', () => {
    // 2018-03-05 | 2019-07-13 and 14 | 2021-01-01 and 2021-12-31. The third
    // is the tight one: 2021-01-01 to 2021-12-31 is 365 days, which fits only
    // because the guard is 400.
    const usable = oracleInput(HAND_ROWS);
    const byStart = [...usable].sort((a, b) => a.start - b.start);
    const gaps: number[] = [];
    let openEnd: number | null = null;
    for (const session of byStart) {
      if (openEnd !== null) gaps.push(session.start - openEnd);
      openEnd = Math.max(openEnd ?? session.end, session.end);
    }
    const wideGaps = gaps.filter((gap) => gap >= ORACLE_BITMAP_GUARD_SECONDS);
    expect(wideGaps).toHaveLength(2);
    // Both are far wider than a day, which is the property the merge needs.
    for (const gap of wideGaps) expect(gap).toBeGreaterThanOrEqual(ONE_DAY);
  });

  it('puts two nearby sessions in ONE cluster, so the sum stays exact', () => {
    // The negative control on the merge's own precondition. Two disjoint
    // 60-second sessions 30 seconds apart are inside one cluster, so the
    // oracle's OWN per-second bitmap resolves them and the composition is not
    // asked to add across them. Were the boundary ever to fall between them,
    // the answer would be a wrong sum rather than a caught error — which is
    // exactly why the gap threshold is 400 days and not 1.
    const near = [
      { start: 0, end: 60 },
      { start: 90, end: 150 },
    ];
    expect(oracleOverWideSpan(near).seconds).toBe(120);
  });
});

describe('the hand fixture: the All totals (D-06)', () => {
  const result = oracleOverWideSpan(oracleInput(HAND_ROWS));

  it('merges to 16,230 seconds over seven usable sessions and five active days', () => {
    expect(result.seconds).toBe(16_230);
    expect(result.sessions).toBe(7);
    expect(result.dayIndex).toHaveLength(5);
  });

  it('gives the tile its text and the announcement its sentence', () => {
    // 16,230s = 4h 30m 30s, which `formatHours` rounds to one decimal place:
    // "4.5 hours", and five distinct day numbers are five active days.
    expect(HAND_ALL.hoursText).toBe('4.5 hours');
    expect(HAND_ALL.sessions).toBe(result.sessions);
    expect(HAND_ALL.activeDays).toBe(result.dayIndex.length);
    expect(HAND_ALL.excluded).toBe(2);
    expect(HAND_ALL.announcement).toBe(
      'Showing all sessions: 4.5 hours, 7 sessions, 5 active days.',
    );
  });
});

describe('the hand fixture: both hour bases (D-01)', () => {
  const result = oracleOverWideSpan(oracleInput(HAND_ROWS));

  it('matches the hand overlap table index by index', () => {
    expect(result.hourOverlap).toEqual(expectedHourSeconds('overlap'));
  });

  it('matches the hand start table index by index', () => {
    expect(result.hourStart).toEqual(expectedHourSeconds('start'));
  });

  it('sums to 16,230 under either basis, as the merged total does', () => {
    expect(result.hourOverlap.reduce((a, b) => a + b, 0)).toBe(16_230);
    expect(result.hourStart.reduce((a, b) => a + b, 0)).toBe(16_230);
  });

  it('differs in exactly six cells, and the guard on that set holds', () => {
    const differing: number[] = [];
    for (let i = 0; i < result.hourOverlap.length; i += 1) {
      if (result.hourOverlap[i] !== result.hourStart[i]) differing.push(i);
    }
    // 20, 21, 108, 109, 143 and 144 — Monday 20:00 and 21:00, Friday 12:00
    // and 13:00, Saturday 23:00 and Sunday 00:00. A plan that listed only the
    // two weekend cells would have been caught here.
    expect(differing).toEqual([20, 21, 108, 109, 143, 144]);
  });

  it('agrees on cell 96, which neither basis moves', () => {
    // 2021-01-01 00:00:00 to 00:00:30 — 30 seconds in a single cell that is
    // both the session's whole span and its start hour.
    expect(expectedHourSeconds('overlap')[96]).toBe(30);
    expect(expectedHourSeconds('start')[96]).toBe(30);
  });

  it('expands the hand tables to 168 cells and lists only non-zero ones', () => {
    for (const basis of ['overlap', 'start'] as const) {
      const expanded = expectedHourSeconds(basis);
      expect(expanded).toHaveLength(168);
      expect(expanded.filter((value) => value === 0)).toHaveLength(
        168 - Object.keys(HOUR_EXPECTED[basis]).length,
      );
    }
    // The default table is the one the app reads, so a basis flip cannot
    // change the specs' expectations by accident.
    expect(expectedHourSeconds()).toEqual(expectedHourSeconds(HOUR_GRID_BASIS));
  });
});

describe('the hand fixture: the tooltip second line of cell 20 (D-01)', () => {
  it('agrees with the formatter under each basis', () => {
    expect(formatHourCellLine1(0, 20)).toBe('Monday, 20:00-21:00');
    expect(formatHourCellLine2(expectedHourSeconds('overlap')[20]!, 'overlap')).toBe(
      HOUR_CELL_20_LINE2.overlap,
    );
    expect(formatHourCellLine2(expectedHourSeconds('start')[20]!, 'start')).toBe(
      HOUR_CELL_20_LINE2.start,
    );
  });

  it('reads No sessions for cell 21 under the start basis, and 1 hour under overlap', () => {
    // The plan's own asymmetry: a whole session lands in its start-hour cell
    // under `start`, so the next cell is empty — while under `overlap` the
    // hour is genuinely occupied.
    expect(formatHourCellLine2(expectedHourSeconds('start')[21]!, 'start')).toBe('No sessions');
    expect(formatHourCellLine2(expectedHourSeconds('overlap')[21]!, 'overlap')).toBe(
      '1 hour played',
    );
  });

  it('reads No sessions for cell 0 under both bases', () => {
    expect(formatHourCellLine2(expectedHourSeconds('overlap')[0]!, 'overlap')).toBe('No sessions');
    expect(formatHourCellLine2(expectedHourSeconds('start')[0]!, 'start')).toBe('No sessions');
  });
});

describe('the hand fixture: the duration bins (D-05)', () => {
  it('matches the oracle, bin by bin', () => {
    expect(oracleOverWideSpan(oracleInput(HAND_ROWS)).bins).toEqual(HAND_BINS);
  });

  it('holds the twelve hand counts and sums to the Sessions tile', () => {
    expect(HAND_BINS).toEqual([2, 0, 0, 0, 1, 0, 1, 2, 1, 0, 0, 0]);
    expect(HAND_BINS.reduce((a, b) => a + b, 0)).toBe(HAND_ALL.sessions);
  });
});

describe('the hand fixture: the per-day figures', () => {
  const result = oracleOverWideSpan(oracleInput(HAND_ROWS));

  it('puts 5,400 seconds and 2 sessions on 2021-12-31', () => {
    // Row 6 (12:00 to 13:30) merged with row 7 (12:30 to 12:45, contained),
    // so the day holds one hour and a half of play and two sessions — the
    // second session contributing nothing, which is the containment.
    expect(dayFigures(result, '2021-12-31')).toEqual({ seconds: 5_400, sessions: 2 });
  });

  it('puts 3,600 seconds and 1 session on 2019-07-13', () => {
    expect(dayFigures(result, '2019-07-13')).toEqual({ seconds: 3_600, sessions: 1 });
  });

  it('puts 0 seconds and 1 session on 2019-07-14, the zero-length session', () => {
    // Row 4 starts and ends at 10:00 on a Sunday. It is a session — it counts
    // as one — and it holds no seconds, which is why the calendar tooltip is
    // keyed off the session count rather than the seconds (04-RESEARCH
    // Pitfall 4).
    expect(dayFigures(result, '2019-07-14')).toEqual({ seconds: 0, sessions: 1 });
  });

  it('puts 30 seconds and 1 session on 2021-01-01', () => {
    expect(dayFigures(result, '2021-01-01')).toEqual({ seconds: 30, sessions: 1 });
  });
});

describe('the hand fixture: the per-year heads', () => {
  const result = oracleOverWideSpan(oracleInput(HAND_ROWS));

  it('gives 2021, 2019 and 2018 the heads the specs assert', () => {
    expect(dayFigures(result, '2021-01-01')).toEqual({ seconds: 30, sessions: 1 });
    // 2021 holds 30s on Jan 1, 5,400s on Dec 31 and a contained session: three
    // sessions over two active days, 5,430s = 1h 30m 30s -> "1.5 hours".
    expect(HAND_YEARS[2021]).toEqual({
      seconds: 5_430,
      sessions: 3,
      activeDays: 2,
      head: '1.5 hours · 3 sessions · 2 active days',
    });
    expect(HAND_YEARS[2019]).toEqual({
      seconds: 3_600,
      sessions: 2,
      activeDays: 2,
      head: '1 hour · 2 sessions · 2 active days',
    });
    expect(HAND_YEARS[2018]).toEqual({
      seconds: 7_200,
      sessions: 2,
      activeDays: 1,
      head: '2 hours · 2 sessions · 1 active day',
    });
  });
});

describe('the hand fixture: the per-value slices (D-03, D-06)', () => {
  it('gives eu-1 12,630 seconds, 4 sessions, 3 active days and 1 excluded', () => {
    const rows = rowsOfServer('eu-1');
    const result = oracleOverWideSpan(oracleInput(rows));
    expect(result.seconds).toBe(12_630);
    expect(result.sessions).toBe(4);
    expect(result.dayIndex).toHaveLength(3);
    expect(rows.filter((row) => !isUsable(row))).toHaveLength(1);
    expect(HAND_EU).toEqual({
      seconds: 12_630,
      sessions: 4,
      activeDays: 3,
      excluded: 1,
      hoursText: '3.5 hours',
      announcement: 'Showing eu-1: 3.5 hours, 4 sessions, 3 active days.',
    });
  });

  it('gives na-1 3,600 seconds, 2 sessions, 2 active days and 1 excluded', () => {
    const rows = rowsOfServer('na-1');
    const result = oracleOverWideSpan(oracleInput(rows));
    expect(result.seconds).toBe(3_600);
    expect(result.sessions).toBe(2);
    expect(result.dayIndex).toHaveLength(2);
    expect(rows.filter((row) => !isUsable(row))).toHaveLength(1);
    expect(HAND_NA).toEqual({
      seconds: 3_600,
      sessions: 2,
      activeDays: 2,
      excluded: 1,
      hoursText: '1 hour',
      announcement: 'Showing na-1: 1 hour, 2 sessions, 2 active days.',
    });
  });

  it('gives the blank server 900 seconds, 1 session, 1 active day and no excluded row', () => {
    const rows = rowsOfServer('');
    const result = oracleOverWideSpan(oracleInput(rows));
    expect(result.seconds).toBe(900);
    expect(result.sessions).toBe(1);
    expect(result.dayIndex).toHaveLength(1);
    expect(rows.filter((row) => !isUsable(row))).toHaveLength(0);
    expect(HAND_BLANK).toEqual({
      seconds: 900,
      sessions: 1,
      activeDays: 1,
      excluded: 0,
      hoursText: '15 min',
      announcement: 'Showing (not recorded): 15 min, 1 session, 1 active day.',
    });
  });

  it('makes the parts sum to MORE than the All total, which is what the note explains', () => {
    // 12,630 + 3,600 + 900 = 17,130 against All's 16,230. All merges the
    // overlap between eu-1's 20:00-22:00 and na-1's Saturday session… more
    // precisely, All merges row 1 with row 2 and row 6 with row 7, and the
    // blank row 7 is in a DIFFERENT value from row 6, so the parts cannot
    // merge it with anything. This is D-02's arithmetic, and the split table's
    // note is not decoration.
    expect(HAND_EU.seconds + HAND_NA.seconds + HAND_BLANK.seconds).toBe(17_130);
    expect(17_130).toBeGreaterThan(HAND_ALL.seconds);
  });
});
