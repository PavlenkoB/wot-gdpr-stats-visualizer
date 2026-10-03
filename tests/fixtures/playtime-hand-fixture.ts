// =============================================================================
// The nine-row hand fixture (phase 04, plan 04-11).
//
// WHY THIS IS A MODULE AND NOT A SPEC
// Two Playwright specs and one Node test all need the SAME hand numbers, and
// Playwright refuses to load a spec that imports another spec. So the rows and
// every number derived from them live here, once, in a plain module with no
// Playwright or Vitest import and no side effect.
//
// EVERY NUMBER BELOW IS DERIVED BY HAND from `HAND_ROWS`, in the comment
// beside it. None of it is read back from the UI, and `tests/unit/
// playtime-hand-fixture.test.ts` recomputes all of it with the INDEPENDENT
// oracle from plan 04-03 — an implementation that shares no primitive with
// the aggregator it checks. A wrong hand number fails in Node, in seconds,
// rather than in a browser run hours later in CI.
//
// The nine rows are small on purpose. Merged coverage is the sum of five
// disjoint spans plus two contained rows, so every total below can be checked
// with arithmetic rather than with a rerun:
//
//   row 1  eu-1   2018-03-05 20:00:00 -> 22:00:00   2h 00m  7,200s
//   row 2  eu-1   2018-03-05 21:00:00 -> 21:30:00   contained in row 1
//   row 3  na-1   2019-07-13 23:30:00 -> 2019-07-14 00:30:00   1h 00m  3,600s
//   row 4  na-1   2019-07-14 10:00:00 -> 10:00:00   zero length
//   row 5  eu-1   2021-01-01 00:00:00 -> 00:00:30   0m 00m30s     30s
//   row 6  eu-1   2021-12-31 12:00:00 -> 13:30:00   1h 30m  5,400s
//   row 7  blank  2021-12-31 12:30:00 -> 12:45:00   contained in row 6
//   row 8  na-1   2020-05-05 10:00:00 -> (empty)    EXCLUDED, no end
//   row 9  eu-1   2021-06-01 12:00:00 -> 11:00:00   EXCLUDED, end < start
//
// Merged coverage = 7,200 + 3,600 + 0 + 30 + 5,400 = 16,230 seconds, which
// is 4h 30m 30s and reads "4.5 hours" (D-06: one decimal, trailing ".0"
// dropped). Seven usable sessions, two excluded rows, five active days
// (2018-03-05, 2019-07-13, 2019-07-14, 2021-01-01, 2021-12-31), and three
// active years with 2020 empty so the collapsed-run line is exercised.
//
// The dates are chosen for their WEEKDAYS, which is what the hour table is
// made of: 2018-03-05 is a Monday, 2019-07-13 a Saturday, 2019-07-14 a
// Sunday, and 2021-01-01 and 2021-12-31 both Fridays. A row that crosses
// midnight (row 3) puts seconds in two different weekdays, which is the only
// way the two bases can be told apart beyond a single midnight case.
//
// Decisions: D-01 (dates and hours as recorded), D-02 (excluded rows are
// counted and are not sessions), D-03 (the split and its selector), D-05
// (duration bins), D-06 (the totals).
// =============================================================================

import {
  HOUR_GRID_BASIS,
  type HourGridBasis,
} from '../../src/lib/features/playtime/playtime-shared.ts';
import { SESSION_FIXTURE_IP } from './sessions-fixtures.ts';

/** The Sessions.csv column order the export writes, for indexing `HAND_ROWS`. */
const START = 0;
const END = 1;
const BUILD = 2;
const PLATFORM = 3;
const SERVER = 4;
const ADDRESS = 5;

/**
 * The nine rows, as six-field string arrays in the export's own column order
 * (`SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP`).
 *
 * The address column is `SESSION_FIXTURE_IP` on EVERY row, including the two
 * excluded ones: T-04-01 says the aggregator never reads it, and a fixture
 * that only populated it on usable rows would make the browser privacy
 * assertions unable to fail. A blank server cell is `''`, which is the whole
 * point of row 7 — it is a DIFFERENT value from eu-1, and it is contained in
 * row 6, so the parts of the split sum to more than the All total.
 *
 * Every build is `1.0` and every platform is `win`, so the split column
 * chosen is SERVER_NAME (three distinct usable values) and not the
 * CLIENT_PLATFORM fallback (one).
 */
export const HAND_ROWS: readonly (readonly string[])[] = [
  // 1. The long Monday-evening session: the only source of cells 20 and 21.
  ['2018-03-05 20:00:00', '2018-03-05 22:00:00', '1.0', 'win', 'eu-1', SESSION_FIXTURE_IP],
  // 2. Contained in row 1. It adds a SESSION and no seconds, which is how a
  //    reader can see the two counted separately and the time counted once.
  ['2018-03-05 21:00:00', '2018-03-05 21:30:00', '1.0', 'win', 'eu-1', SESSION_FIXTURE_IP],
  // 3. Crosses midnight Saturday -> Sunday: 30 minutes either side.
  ['2019-07-13 23:30:00', '2019-07-14 00:30:00', '1.0', 'win', 'na-1', SESSION_FIXTURE_IP],
  // 4. Zero length. A session that held no play and still counts as one.
  ['2019-07-14 10:00:00', '2019-07-14 10:00:00', '1.0', 'win', 'na-1', SESSION_FIXTURE_IP],
  // 5. Thirty seconds. The smallest non-zero day, and the only reason a
  //    "<1 min" string exists in the whole fixture.
  ['2021-01-01 00:00:00', '2021-01-01 00:00:30', '1.0', 'win', 'eu-1', SESSION_FIXTURE_IP],
  // 6. The Friday afternoon session: cells 108 and 109 under `overlap`.
  ['2021-12-31 12:00:00', '2021-12-31 13:30:00', '1.0', 'win', 'eu-1', SESSION_FIXTURE_IP],
  // 7. The BLANK server, contained in row 6. Its 900 seconds exist in the
  //    blank value's own slice and nowhere in the All total.
  ['2021-12-31 12:30:00', '2021-12-31 12:45:00', '1.0', 'win', '', SESSION_FIXTURE_IP],
  // 8. EXCLUDED: no end. 2020 is the empty year, so the collapsed-run line
  //    and the year head's active-day count are both exercised by it.
  ['2020-05-05 10:00:00', '', '1.0', 'win', 'na-1', SESSION_FIXTURE_IP],
  // 9. EXCLUDED: an hour before it starts.
  ['2021-06-01 12:00:00', '2021-06-01 11:00:00', '1.0', 'win', 'eu-1', SESSION_FIXTURE_IP],
];

/** Column indexes, exported so a spec can read a row without re-typing them. */
export const HAND_COLUMNS = {
  start: START,
  end: END,
  build: BUILD,
  platform: PLATFORM,
  server: SERVER,
  address: ADDRESS,
} as const;

/** The three split values in the order the worker sorts them. */
export const HAND_SERVER_EU = 'eu-1';
export const HAND_SERVER_NA = 'na-1';
/** A blank SERVER_NAME cell, which the app shows as "(not recorded)". */
export const HAND_SERVER_BLANK = '';

/**
 * The total every value adds up to, named once so no caller re-derives it.
 * 7,200 (row 1) + 3,600 (row 3) + 0 (row 4) + 30 (row 5) + 5,400 (row 6).
 */
export const HAND_ALL_SECONDS = 16_230;

/** One slice's figures and the two strings the UI spells them with. */
export interface HandSlice {
  /** Merged playtime, in seconds. */
  seconds: number;
  /** Usable sessions, including the contained and zero-length ones. */
  sessions: number;
  /** Days at least one usable session started on. */
  activeDays: number;
  /** Rows the aggregator counted and did not turn into sessions (D-02). */
  excluded: number;
  /** The hours tile's text, `formatHours(seconds)`. */
  hoursText: string;
  /** The status live region's text after choosing this value. */
  announcement: string;
}

/**
 * All sessions: 16,230s over 7 sessions on 5 days, 2 rows excluded.
 * 16,230 / 3600 = 4.508h -> one decimal, ".5" -> "4.5 hours".
 */
export const HAND_ALL: HandSlice = {
  seconds: HAND_ALL_SECONDS,
  sessions: 7,
  activeDays: 5,
  excluded: 2,
  hoursText: '4.5 hours',
  announcement: 'Showing all sessions: 4.5 hours, 7 sessions, 5 active days.',
};

/**
 * eu-1 holds rows 1, 2, 5 and 6, and the excluded row 9.
 * 7,200 + 0 + 30 + 5,400 = 12,630s over 4 sessions (2018-03-05, 2021-01-01,
 * 2021-12-31). 12,630 / 3600 = 3.508h -> "3.5 hours".
 */
export const HAND_EU: HandSlice = {
  seconds: 12_630,
  sessions: 4,
  activeDays: 3,
  excluded: 1,
  hoursText: '3.5 hours',
  announcement: 'Showing eu-1: 3.5 hours, 4 sessions, 3 active days.',
};

/**
 * na-1 holds rows 3 and 4, and the excluded row 8 (the empty 2020 row).
 * 3,600 + 0 = 3,600s over 2 sessions on 2 days. Exactly one hour, and
 * `formatHours` drops the trailing ".0".
 */
export const HAND_NA: HandSlice = {
  seconds: 3_600,
  sessions: 2,
  activeDays: 2,
  excluded: 1,
  hoursText: '1 hour',
  announcement: 'Showing na-1: 1 hour, 2 sessions, 2 active days.',
};

/**
 * The blank server holds row 7 only: 900s, 1 session, 1 active day, and no
 * excluded row — the only value in the fixture with a zero excluded count.
 * 900s is under an hour, so it reads in minutes: "15 min".
 */
export const HAND_BLANK: HandSlice = {
  seconds: 900,
  sessions: 1,
  activeDays: 1,
  excluded: 0,
  hoursText: '15 min',
  announcement: 'Showing (not recorded): 15 min, 1 session, 1 active day.',
};

/** The four slices, keyed the way the selector labels them. */
export const HAND_SLICES: Readonly<Record<'all' | 'eu' | 'na' | 'blank', HandSlice>> = {
  all: HAND_ALL,
  eu: HAND_EU,
  na: HAND_NA,
  blank: HAND_BLANK,
};

/** One year block's head, and the figures the head's three parts are built from. */
export interface HandYear {
  /** Merged playtime in that year, in seconds. */
  seconds: number;
  /** Usable sessions that started in that year. */
  sessions: number;
  /** Active days in that year. */
  activeDays: number;
  /** The head's full text, `{h} · {n} sessions · {d} active days`. */
  head: string;
}

/**
 * The three year heads, keyed by the year.
 *
 * 2021: 30s on Jan 1 + 5,400s on Dec 31 + row 7's contained 0s = 5,430s over
 * 3 sessions on 2 days. 5,430 / 3600 = 1.508h -> "1.5 hours".
 * 2019: 3,600s on Jul 13 + row 4's 0s on Jul 14 = 3,600s over 2 sessions on
 * 2 days -> "1 hour".
 * 2018: row 1's 7,200s + row 2's contained 0s = 7,200s over 2 sessions on
 * 1 day -> "2 hours".
 *
 * 2020 is ABSENT on purpose: it holds only the excluded row 8, so the calendar
 * collapses it into the run line "2020: no sessions recorded".
 */
export const HAND_YEARS: Readonly<Record<number, HandYear>> = {
  2021: {
    seconds: 5_430,
    sessions: 3,
    activeDays: 2,
    head: '1.5 hours · 3 sessions · 2 active days',
  },
  2019: {
    seconds: 3_600,
    sessions: 2,
    activeDays: 2,
    head: '1 hour · 2 sessions · 2 active days',
  },
  2018: {
    seconds: 7_200,
    sessions: 2,
    activeDays: 1,
    head: '2 hours · 2 sessions · 1 active day',
  },
};

/** The collapsed run between 2019 and 2021, as the calendar shows it. */
export const HAND_EMPTY_YEAR_RUN = '2020: no sessions recorded';

/**
 * The collapsed run under eu-1, which drops 2019 and leaves "2019-2020" —
 * the two-year form of the line, reached by removing a year rather than by
 * choosing one.
 */
export const HAND_EMPTY_YEAR_RUN_EU = '2019-2020: no sessions recorded';

/**
 * Calendar cells drawn for each slice: the total days of its active years.
 * 2018, 2019 and 2021 are all 365-day years, so All is 1,095, eu-1 is 730
 * (2018 and 2021) and na-1 is 365 (2019 alone). 2020 is never drawn.
 */
export const HAND_CALENDAR_CELLS = { all: 1_095, eu: 730, na: 365 } as const;

/**
 * The twelve duration-bin counts, by RAW session length (D-05 — the raw
 * length, not the merged increment, so the contained and zero-length rows
 * each land in their own bucket):
 *
 *   row 1  7,200s = 120 min -> bin 8   "2-4 hours"      (>= 120)
 *   row 2  1,800s =  30 min -> bin 6   "30-60 min"      (>= 30)
 *   row 3  3,600s =  60 min -> bin 7   "1-2 hours"      (>= 60)
 *   row 4      0s =   0 min -> bin 0   "Under 1 min"
 *   row 5     30s =   0 min -> bin 0   "Under 1 min"    (>= 0, < 1)
 *   row 6  5,400s =  90 min -> bin 7   "1-2 hours"
 *   row 7    900s =  15 min -> bin 4   "10-20 min"      (>= 10)
 *
 * Two rows in bin 0, one in 4, one in 6, two in 7, one in 8: seven sessions,
 * which is the Sessions tile.
 */
export const HAND_BINS: readonly number[] = [2, 0, 0, 0, 1, 0, 1, 2, 1, 0, 0, 0];

/**
 * The twelve-bin row TEXTS, for the bins that hold sessions, keyed by bin
 * index. `formatDurationRowText(count, sessions)` is `{count} · {n}%` over
 * seven sessions rounded to whole percent:
 *
 *   2 / 7 = 28.57% -> 29%    1 / 7 = 14.28% -> 14%
 *
 * so bins 0 and 7 read "2 · 29%" and bins 4, 6 and 8 read "1 · 14%".
 */
export const HAND_BIN_TEXTS: Readonly<Record<number, string>> = {
  0: '2 · 29%',
  4: '1 · 14%',
  6: '1 · 14%',
  7: '2 · 29%',
  8: '1 · 14%',
};

/**
 * The per-day figures for the four days the specs name, as
 * `{ 'YYYY-MM-DD': { seconds, sessions } }`.
 *
 * 2021-12-31  5,400 / 2   row 6 with row 7 contained in it
 * 2019-07-13  3,600 / 1   row 3's Saturday half
 * 2019-07-14      0 / 1   row 3's Sunday half is zero, and row 4 is a
 *                          zero-length session that still counts as one
 * 2021-01-01     30 / 1    row 5
 */
export const HAND_DAYS: Readonly<
  Record<string, { seconds: number; sessions: number; label: string }>
> = {
  '2021-12-31': { seconds: 5_400, sessions: 2, label: 'Fri, Dec 31, 2021' },
  '2019-07-13': { seconds: 3_600, sessions: 1, label: 'Sat, Jul 13, 2019' },
  '2019-07-14': { seconds: 0, sessions: 1, label: 'Sun, Jul 14, 2019' },
  '2021-01-01': { seconds: 30, sessions: 1, label: 'Fri, Jan 1, 2021' },
};

/**
 * The 168 weekday-hour cells, per basis, as index -> seconds, NON-ZERO CELLS
 * ONLY. Monday 00:00 is index 0, so the index is `weekday * 24 + hour`.
 *
 * Derivation, from the merged coverage of the nine rows:
 *
 *   OVERLAP — each session's seconds land in the hours it actually occupies.
 *     row 1 (Mon 20:00-22:00)   -> cell 20 = 3,600 and cell 21 = 3,600
 *     row 2                     -> contained, adds 0 to cell 21
 *     row 3 (Sat 23:30 -> Sun 00:30)
 *                                -> cell 143 = 1,800 and cell 144 = 1,800
 *     row 4                     -> zero length, adds 0
 *     row 5 (Fri 00:00-00:00:30) -> cell 96 = 30
 *     row 6 (Fri 12:00-13:30)   -> cell 108 = 3,600 and cell 109 = 1,800
 *     row 7                     -> contained, adds 0
 *     total 16,230
 *
 *   START — each session's merged increment lands in its START hour.
 *     row 1 -> cell 20 = 7,200;  row 2 -> cell 21 = 0
 *     row 3 -> cell 143 = 3,600
 *     row 4 -> 0
 *     row 5 -> cell 96 = 30
 *     row 6 -> cell 108 = 5,400;  row 7 -> adds 0
 *     total 16,230
 *
 * The two tables therefore differ in exactly SIX cells, not the two the
 * weekend alone would suggest: 20, 21, 108, 109, 143 and 144. Cell 96 is the
 * one cell the two agree on that is non-zero, because that session neither
 * crosses an hour boundary nor has a contained neighbour.
 */
export const HOUR_EXPECTED: Readonly<Record<HourGridBasis, Readonly<Record<number, number>>>> = {
  overlap: { 20: 3_600, 21: 3_600, 96: 30, 108: 3_600, 109: 1_800, 143: 1_800, 144: 1_800 },
  start: { 20: 7_200, 96: 30, 108: 5_400, 143: 3_600 },
};

/** The 168 cells of the weekday-by-hour grid, as a layout constant. */
export const HOUR_CELL_TOTAL = 168;

/**
 * The 168-entry array for one basis, every unlisted cell zero.
 *
 * The DEFAULT is `HOUR_GRID_BASIS`, the same constant the app reads, so the
 * user's open decision (`overlap` vs `start`) changes what the specs expect
 * without a single spec edit — and a basis flip is a one-line change
 * (04-CONTEXT D-01).
 */
export function expectedHourSeconds(basis: HourGridBasis = HOUR_GRID_BASIS): number[] {
  const cells = new Array<number>(HOUR_CELL_TOTAL).fill(0);
  for (const [index, seconds] of Object.entries(HOUR_EXPECTED[basis])) {
    cells[Number(index)] = seconds;
  }
  return cells;
}

/** Hour cell 20's first tooltip line, the same under both bases (D-01). */
export const HOUR_CELL_20_LINE1 = 'Monday, 20:00-21:00';

/**
 * The hour-cell 20 expectations under one key, rather than two names, so a
 * spec that indexes by the active `HOUR_GRID_BASIS` cannot half-use one and
 * hard-code the other.
 *
 * `HOUR_CELL_20_LINE1` is deliberately NOT a record: the first line is the
 * hour's own name and is identical under both bases, so making it a lookup
 * would invite a spec to write `LINE1[basis]` and suggest the two differ.
 */
export const HOUR_CELL_20_LINE2: Readonly<Record<HourGridBasis, string>> = {
  overlap: '1 hour played',
  start: '2 hours played in sessions starting this hour',
};

/** Hour cell 21's second line, which the two bases DO differ on. */
export const HOUR_CELL_21_LINE2: Readonly<Record<HourGridBasis, string>> = {
  overlap: '1 hour played',
  start: 'No sessions',
};

/**
 * The six cells the two bases disagree on, ascending. A guard on the TABLE
 * rather than on the app: a plan or a future edit that got the basis tables
 * wrong in a way that cancelled out would otherwise pass every index-by-index
 * comparison against an equally wrong oracle input.
 */
export const HOUR_BASIS_DIFFERENCES: readonly number[] = [20, 21, 108, 109, 143, 144];
