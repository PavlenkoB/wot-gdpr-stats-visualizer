// =============================================================================
// The mixed-points fixture (phase 04, plan 04-11, Task 2).
// =============================================================================
//
// WHY A SECOND FIXTURE
// The nine-row hand fixture is the arithmetic case: every number in it can be
// checked with a pencil. It is deliberately too SMALL to exercise the shapes a
// real export has, and a chart that only ever renders nine rows passes it. So
// this fixture is the shape case — 15 usable rows across three servers and two
// years — and it is what the geometry, the aggregation and the density tests
// read.
//
// WHAT IT IS SHAPED TO CONTAIN
//   - fifteen usable rows and three excluded, so the CSV is 19 lines
//   - two servers in each of three rows, so no server dominates the picture
//   - exactly one row crossing midnight, and one crossing a YEAR boundary
//   - a Monday 20:00 pair and a Monday 12:00 overlap pair, so the hour grid
//     has a cell with two sessions and a cell with an overlap
//   - a Saturday cell and a Sunday cell, so no weekday is unrepresented
//   - a zero-length session, which counts as a session and holds no seconds
//
// Decisions: D-01, D-02, D-05, D-06.
// =============================================================================

import { buildSessionsCsvFromRows, SESSION_FIXTURE_IP } from './sessions-fixtures.ts';

/** The Sessions.csv column order, for indexing `MIXED_ROWS`. */
const START = 0;
const END = 1;
const BUILD = 2;
const PLATFORM = 3;
const SERVER = 4;
const ADDRESS = 5;

/**
 * Eighteen rows: fifteen usable and three excluded.
 *
 * One row per server per shape, and every row carries the fixture address —
 * including the excluded ones, so the browser privacy assertions can fail.
 * Three servers qualify the SERVER_NAME split (two to fifty distinct usable
 * values), so the split is by server and CLIENT_PLATFORM never comes up.
 *
 * The three servers are `alpha`, `bravo` and `charlie`: chosen because they
 * sort in that order, so a test that reads the selector by index is reading
 * the worker's DESCENDING-by-seconds order and not an alphabetical accident.
 */
export const MIXED_ROWS: readonly (readonly string[])[] = [
  // Monday 2022-01-03, the densest day: four sessions over three servers.
  // 20:00 and 20:30 overlap, so cell 44 holds two sessions and 1,800
  // overlapping seconds — the cell the "Monday 20:00 pair" test asserts.
  ['2022-01-03 20:00:00', '2022-01-03 20:45:00', '1.0', 'win', 'alpha', SESSION_FIXTURE_IP],
  ['2022-01-03 20:30:00', '2022-01-03 21:15:00', '1.0', 'win', 'bravo', SESSION_FIXTURE_IP],
  // 12:00 and 12:15 overlap for the same reason in a different hour, so the
  // two Monday pairs are not the same cell twice.
  ['2022-01-03 12:00:00', '2022-01-03 12:30:00', '1.0', 'win', 'bravo', SESSION_FIXTURE_IP],
  ['2022-01-03 12:15:00', '2022-01-03 13:00:00', '1.0', 'win', 'alpha', SESSION_FIXTURE_IP],
  // Saturday 2022-01-08: 14:00 and 14:10 overlap, and a third session at
  // 18:00 keeps the day from being a single hotspot.
  ['2022-01-08 14:00:00', '2022-01-08 14:20:00', '1.0', 'win', 'charlie', SESSION_FIXTURE_IP],
  ['2022-01-08 14:10:00', '2022-01-08 15:00:00', '1.0', 'win', 'alpha', SESSION_FIXTURE_IP],
  // The ONLY row crossing a YEAR boundary: Friday into Saturday.
  ['2021-12-31 23:15:00', '2022-01-01 00:45:00', '1.0', 'mac', 'bravo', SESSION_FIXTURE_IP],
  // Sunday 2022-01-09: a ZERO-LENGTH session beside a real one. The calendar
  // cell for 08:00 holds a session and no seconds, which is the case a
  // "level 0" cell must still be reachable by keyboard.
  ['2022-01-09 08:00:00', '2022-01-09 08:00:00', '1.0', 'win', 'charlie', SESSION_FIXTURE_IP],
  ['2022-01-09 07:00:00', '2022-01-09 07:30:00', '1.0', 'mac', 'alpha', SESSION_FIXTURE_IP],
  // Saturday 2022-01-15: 09:00 and 09:05 overlap, 600s into a 1,200s cell.
  ['2022-01-15 09:00:00', '2022-01-15 09:10:00', '1.0', 'win', 'bravo', SESSION_FIXTURE_IP],
  ['2022-01-15 09:05:00', '2022-01-15 09:20:00', '1.0', 'win', 'bravo', SESSION_FIXTURE_IP],
  // Three one-session days, so the calendar has quiet cells beside busy ones
  // and the density ramp is read across a range rather than at one value.
  ['2022-01-10 17:00:00', '2022-01-10 17:05:00', '1.0', 'win', 'bravo', SESSION_FIXTURE_IP],
  ['2022-01-11 19:00:00', '2022-01-11 20:30:00', '1.0', 'win', 'charlie', SESSION_FIXTURE_IP],
  ['2022-01-12 06:00:00', '2022-01-12 06:15:00', '1.0', 'win', 'alpha', SESSION_FIXTURE_IP],
  ['2022-01-13 22:00:00', '2022-01-13 22:45:00', '1.0', 'win', 'bravo', SESSION_FIXTURE_IP],
  // EXCLUDED: one per server, and one per REASON — an empty end on alpha,
  // an end before the start on bravo, and an empty end on charlie again, so
  // every server's excluded count is one and the "which reason" is a claim
  // about the aggregator rather than about one server.
  ['2022-01-05 10:00:00', '', '1.0', 'win', 'alpha', SESSION_FIXTURE_IP],
  ['2022-01-06 11:00:00', '2022-01-06 10:00:00', '1.0', 'win', 'bravo', SESSION_FIXTURE_IP],
  ['2022-01-07 12:00:00', '', '1.0', 'win', 'charlie', SESSION_FIXTURE_IP],
];

/** Column indexes, so a spec can read a row without re-typing them. */
export const MIXED_COLUMNS = {
  start: START,
  end: END,
  build: BUILD,
  platform: PLATFORM,
  server: SERVER,
  address: ADDRESS,
} as const;

/** The three servers, in the order the selector lists them. */
export const MIXED_SERVERS = ['bravo', 'alpha', 'charlie'] as const;

/** The split column this fixture's shapes force, and the one it avoids. */
export const MIXED_SPLIT_COLUMN = 'SERVER_NAME';
export const MIXED_UNSPLIT_COLUMN = 'CLIENT_PLATFORM';

/**
 * The CSV, built from `MIXED_ROWS` through the SHARED builder.
 *
 * Built rather than pasted, because a hand-written CSV here would be a
 * second source of truth that the row array could drift from, and the
 * idempotence test would only catch it after the fact. There is no
 * `HAND_CSV` equivalent on purpose.
 */
export const MIXED_CSV = buildSessionsCsvFromRows(MIXED_ROWS);

/** The three servers' slices, keyed by server name. */
export const MIXED_BY_VALUE: Readonly<
  Record<
    string,
    { seconds: number; sessions: number; activeDays: number; excluded: number; hoursText: string }
  >
> = {
  // bravo leads on merged seconds (14,100) so it sorts FIRST under D-06's
  // descending order, ahead of alpha — which is the opposite of alphabetical
  // and the reason a test reading index 0 for "alpha" would be wrong.
  bravo: { seconds: 14_100, sessions: 7, activeDays: 5, excluded: 1, hoursText: '3.9 hours' },
  alpha: { seconds: 11_100, sessions: 5, activeDays: 4, excluded: 1, hoursText: '3.1 hours' },
  charlie: { seconds: 6_600, sessions: 3, activeDays: 3, excluded: 1, hoursText: '1.8 hours' },
};

/** All servers: 29,400s over 15 sessions on 9 active days, 3 excluded. */
export const MIXED_ALL = {
  seconds: 29_400,
  sessions: 15,
  activeDays: 9,
  excluded: 3,
  hoursText: '8.2 hours',
} as const;
