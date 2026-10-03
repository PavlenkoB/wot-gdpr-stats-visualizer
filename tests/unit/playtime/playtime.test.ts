// =============================================================================
// Playtime slice aggregation — pure unit tests (no fake-indexeddb).
//
// The replay-facing behaviour of `buildPlaytime` — the fact that a failing
// aggregation still posts `done` and stores `playtime: null` — is covered by
// the ingest/identity suites that drive a real worker with fake-indexeddb.
// This file exercises the pure aggregation, which is where the arithmetic
// actually lives.
// =============================================================================

import { describe, expect, it } from 'vitest';

import {
  aggregateSlice,
  binOf,
  buildPlaytime,
  buildPlaytimeFromSources,
  isSessionsRow,
  parseSessionTimestamp,
  resolveSessionColumns,
  sessionFileNameGame,
  viewFromAggregates,
  type SessionSource,
} from '../../../src/lib/features/playtime/playtime-aggregate';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse';
import {
  buildSplitTable,
  effectiveSelection,
} from '../../../src/lib/features/playtime/playtime-model';
import {
  NO_SPLIT_SPEC,
  PLATFORM_FALLBACK_SPEC,
  buildSessionsExport,
} from '../../fixtures/sessions-fixtures';
import {
  REAL_SHAPE_WOT,
  REAL_SHAPE_WOT_ROWS,
  REAL_SHAPE_WOWS_ROWS,
  buildRealShapeCsv,
  type RealShapeRow,
} from '../../fixtures/playtime-real-shape-fixture';
import { oracleSlice, randomSessions, type OracleSession } from '../../helpers/session-oracle';

// =============================================================================
// 04-03 tracer: overlap, midnight crossing and containment.
//
// THE THREE SESSIONS ARE CHOSEN TO BREAK THE TRIVIAL CASE.
// A trivial pair of disjoint sessions proves nothing about a merge: any
// implementation that ignores overlap entirely passes it. This trio does not.
//
//   A  2020-06-01 23:30 -> 2020-06-02 00:30   crosses midnight, so its
//                                             seconds land on two different
//                                             days AND two different hours
//   B  2020-06-01 23:40 -> 23:50              entirely INSIDE A, so it
//                                             contributes 0 merged seconds
//   C  2020-06-02 00:20 -> 01:10              starts inside A but ends after
//                                             it, so the sweep must add only
//                                             the part beyond A's end
//
// 2020-06-01 is a Monday, so hour cells 23/24/25 are Monday 23:00, Tuesday
// 00:00 and Tuesday 01:00 respectively.
// =============================================================================

const A_START = Date.UTC(2020, 5, 1, 23, 30, 0) / 1000;
const A_END = Date.UTC(2020, 5, 2, 0, 30, 0) / 1000;
const B_START = Date.UTC(2020, 5, 1, 23, 40, 0) / 1000;
const B_END = Date.UTC(2020, 5, 1, 23, 50, 0) / 1000;
const C_START = Date.UTC(2020, 5, 2, 0, 20, 0) / 1000;
const C_END = Date.UTC(2020, 5, 2, 1, 10, 0) / 1000;

/** Monday 23:00. */
const MON_23 = 23;
/** Tuesday 00:00. */
const TUE_00 = 24;
/** Tuesday 01:00. */
const TUE_01 = 25;

const TRIO: OracleSession[] = [
  { start: A_START, end: A_END },
  { start: B_START, end: B_END },
  { start: C_START, end: C_END },
];

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

describe('04-03 tracer: overlap, midnight crossing and containment', () => {
  it('merges the trio to 6000 seconds spread across two start days', () => {
    const slice = aggregateSlice(TRIO, 0);

    // A claims 3600, B is fully covered so claims 0, C claims the 2400
    // seconds that fall after A's end.
    expect(slice.seconds).toBe(6000);
    expect(slice.sessions).toBe(3);
    expect(slice.excluded).toBe(0);

    // A and B both START on 2020-06-01, C starts on 2020-06-02.
    expect(slice.dayIndex).toEqual([
      Date.UTC(2020, 5, 1) / 86400_000,
      Date.UTC(2020, 5, 2) / 86400_000,
    ]);
    expect(slice.daySeconds).toEqual([3600, 2400]);
    expect(slice.daySessions).toEqual([2, 1]);
  });

  it('credits hourOverlap with the hours the merged seconds actually occupy', () => {
    const slice = aggregateSlice(TRIO, 0);

    expect(slice.hourOverlap).toHaveLength(168);
    // A spans 23:30 -> 00:30, so 1800s land either side of midnight.
    expect(slice.hourOverlap[MON_23]).toBe(1800);
    // C's CLAIMED span is 00:30 -> 01:10: 1800s in Tuesday 00:00 (on top of
    // A's 1800s) and 600s in Tuesday 01:00.
    expect(slice.hourOverlap[TUE_00]).toBe(3600);
    expect(slice.hourOverlap[TUE_01]).toBe(600);
    // Overlap and start attribution describe the same seconds, so the grid
    // must total the merged playtime.
    expect(sum(slice.hourOverlap)).toBe(slice.seconds);
  });

  it('credits hourStart with the hour each session started in', () => {
    const slice = aggregateSlice(TRIO, 0);

    // A starts Monday 23:00 and claims its whole 3600s there. B also starts
    // there but claims nothing, so the cell is unchanged by it. C starts
    // Tuesday 00:20 and claims 2400s in Tuesday 00:00.
    expect(slice.hourStart[MON_23]).toBe(3600);
    expect(slice.hourStart[TUE_00]).toBe(2400);
    expect(sum(slice.hourStart)).toBe(slice.seconds);
  });

  it('bins the RAW length, so a fully contained session still counts once', () => {
    const slice = aggregateSlice(TRIO, 0);

    expect(slice.bins).toHaveLength(12);
    // A is 60 minutes, B is 10 minutes, C is 50 minutes. B counted zero
    // merged seconds but it is still a session that occupied the server.
    expect(slice.bins[4]).toBe(1);
    expect(slice.bins[6]).toBe(1);
    expect(slice.bins[7]).toBe(1);
    expect(sum(slice.bins)).toBe(slice.sessions);
  });

  it('agrees with the independent per-second oracle on every field', () => {
    const slice = aggregateSlice(TRIO, 0);
    const expected = oracleSlice(TRIO);

    expect(slice.seconds).toBe(expected.seconds);
    expect(slice.sessions).toBe(expected.sessions);
    expect(slice.dayIndex).toEqual(expected.dayIndex);
    expect(slice.daySeconds).toEqual(expected.daySeconds);
    expect(slice.daySessions).toEqual(expected.daySessions);
    expect(slice.hourOverlap).toEqual(expected.hourOverlap);
    expect(slice.hourStart).toEqual(expected.hourStart);
    expect(slice.bins).toEqual(expected.bins);
  });
});

// =============================================================================
// 04-03 characterisation matrix.
//
// The tracer above pins one hand-picked shape. These close the file: the
// parse table, the exclusion contract, the merge shapes a reviewer would
// think to write down, and a seeded cross-check against the oracle so a shape
// nobody thought of still gets compared.
//
// A characterisation test records what the code DOES. Where the expected
// values below were read off a failing run rather than derived, that is
// deliberate and is called out: the value being frozen is the decision
// itself, and deriving it here would quietly re-decide it.
// =============================================================================

describe('parseSessionTimestamp', () => {
  // Wall clock, no zone (D-01): the string is the clock the game recorded and
  // is read as "seconds since 1970-01-01T00:00:00", never converted. A bare
  // trailing `Z` is accepted because it asserts the same wall clock, but a
  // numeric offset is NOT — see the rejected cases below.
  const ACCEPTED: readonly (readonly [string, string])[] = [
    ['2020-06-01 23:30:00', '2020-06-01 23:30:00'],
    ['2020-06-01 23:30:00.123', '2020-06-01 23:30:00'],
    ['2020-06-01T23:30:00', '2020-06-01 23:30:00'],
    ['2020-06-01T23:30:00Z', '2020-06-01 23:30:00'],
    ['  2020-06-01 23:30:00  ', '2020-06-01 23:30:00'],
    ['2020-02-29 12:00:00', '2020-02-29 12:00:00'],
    ['1970-01-01 00:00:00', '1970-01-01 00:00:00'],
    ['1999-12-31 23:59:59', '1999-12-31 23:59:59'],
  ];

  it.each(ACCEPTED)('accepts %s as %s', (input, normalized) => {
    expect(parseSessionTimestamp(input)).toBe(
      Date.UTC(
        Number(normalized.slice(0, 4)),
        Number(normalized.slice(5, 7)) - 1,
        Number(normalized.slice(8, 10)),
        Number(normalized.slice(11, 13)),
        Number(normalized.slice(14, 16)),
        Number(normalized.slice(17, 19)),
      ) / 1000,
    );
  });

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['slash date', '2020/06/01 23:30:00'],
    ['not a timestamp', 'not-a-timestamp'],
    ['impossible day', '2020-02-30 11:00:00'],
    ['non-leap February 29', '2019-02-29 00:00:00'],
    ['month zero', '2020-00-10 00:00:00'],
    ['month thirteen', '2020-13-10 00:00:00'],
    ['day zero', '2020-06-00 00:00:00'],
    ['hour twenty-four', '2020-06-01 24:00:00'],
    ['minute sixty', '2020-06-01 00:60:00'],
    ['second sixty', '2020-06-01 00:00:60'],
    ['date only', '2020-06-01'],
    ['minutes without seconds', '2020-06-01 23:30'],
    ['trailing junk', '2020-06-01 23:30:00abc'],
    // D-01: a numeric offset describes an INSTANT, and instants are ruled
    // out. Rejecting it is the honest outcome; converting it would silently
    // shift a wall clock into whatever zone the offset names.
    ['a numeric UTC offset', '2020-06-01T23:30:00+00:00'],
    ['a numeric non-UTC offset', '2020-06-01T23:30:00+03:00'],
  ])('returns null for %s', (_label, input) => {
    expect(parseSessionTimestamp(input)).toBeNull();
  });
});

describe('isSessionsRow', () => {
  it('matches the Activity_history folder and the Sessions.csv basename', () => {
    expect(isSessionsRow('Activity_history', 'Sessions.csv')).toBe(true);
    expect(isSessionsRow('activity_history', 'sessions.csv')).toBe(true);
    expect(isSessionsRow('ACTIVITY_HISTORY', 'SESSIONS.CSV')).toBe(true);
  });

  it('refuses a Sessions.csv in any other folder, or another file in the right one', () => {
    expect(isSessionsRow('User_Info', 'Sessions.csv')).toBe(false);
    expect(isSessionsRow('Activity_history', 'Sessions_2021.csv')).toBe(false);
    expect(isSessionsRow('', '')).toBe(false);
  });
});

describe('resolveSessionColumns', () => {
  it('resolves the fixture header to the four named columns', () => {
    expect(
      resolveSessionColumns({
        SESSION_START: '2020-06-01 23:30:00',
        SESSION_END: '2020-06-01 23:50:00',
        CLIENT_BUILD: '12931',
        CLIENT_PLATFORM: 'win32',
        SERVER_NAME: 'eu',
        IP: '192.0.2.99',
      }),
    ).toEqual({
      start: 'SESSION_START',
      end: 'SESSION_END',
      server: 'SERVER_NAME',
      platform: 'CLIENT_PLATFORM',
    });
  });

  it('tolerates padding and odd casing in the header without inventing a key', () => {
    // The match is trim plus upper-case, so the value is read back through the
    // ACTUAL key. A trimmed, invented key would read undefined and exclude
    // every row.
    const columns = resolveSessionColumns({
      ' session_start ': '2020-06-01 23:30:00',
      Session_End: '2020-06-01 23:50:00',
      server_name: 'eu',
      Client_Platform: 'win32',
    });
    expect(columns).toEqual({
      start: ' session_start ',
      end: 'Session_End',
      server: 'server_name',
      platform: 'Client_Platform',
    });
  });

  it('leaves an unknown column null rather than guessing at one', () => {
    // A real export with different names must exclude every row, not
    // mis-bucket playtime. Plan 04-12 is the real-export check.
    expect(resolveSessionColumns({ SESSION_ID: '1', SERVER: 'eu' })).toEqual({
      start: null,
      end: null,
      server: null,
      platform: null,
    });
  });
});

describe('excluded rows', () => {
  // The contract, restated: usable + excluded == stored rows, and an
  // unreadable row is COUNTED, never silently dropped, so a user with a
  // column-name mismatch sees why the chart is empty.
  it.each([
    ['a missing start', { SESSION_END: '2020-06-01 23:50:00' }],
    ['a missing end', { SESSION_START: '2020-06-01 23:30:00' }],
    ['an empty end cell', { SESSION_START: '2020-06-01 23:30:00', SESSION_END: '' }],
    [
      'an unparseable end',
      { SESSION_START: '2020-06-01 23:30:00', SESSION_END: 'not-a-timestamp' },
    ],
    [
      'an impossible end date',
      { SESSION_START: '2020-02-15 10:00:00', SESSION_END: '2020-02-30 11:00:00' },
    ],
    [
      'an end before its start',
      { SESSION_START: '2020-06-01 23:50:00', SESSION_END: '2020-06-01 23:30:00' },
    ],
  ])('counts %s as excluded and never as a session', (_label, row) => {
    const aggregates = buildPlaytime([row], true);

    expect(aggregates.all.sessions).toBe(0);
    expect(aggregates.all.excluded).toBe(1);
    expect(aggregates.all.seconds).toBe(0);
    expect(viewFromAggregates(aggregates, null)).toEqual({
      status: 'no-usable-sessions',
      excluded: 1,
    });
  });

  it('keeps usable + excluded equal to the rows it was given', () => {
    const rows = [
      { SESSION_START: '2020-06-01 23:30:00', SESSION_END: '2020-06-01 23:50:00' },
      { SESSION_START: '2020-06-01 23:40:00', SESSION_END: '2020-06-01 23:45:00' },
      { SESSION_START: '2020-06-02 10:00:00', SESSION_END: '2020-06-02 10:30:00' },
      { SESSION_START: '2020-06-02 10:00:00', SESSION_END: '' },
    ];
    const slice = buildPlaytime(rows, true).all;

    expect(slice.sessions + slice.excluded).toBe(rows.length);
    expect(slice.sessions).toBe(3);
    expect(slice.excluded).toBe(1);
  });

  it('excludes every row when the header does not resolve, and still stores a slice', () => {
    const aggregates = buildPlaytime([{ SESSION_ID: '1', SERVER: 'eu' }], true);

    expect(aggregates.all.sessions).toBe(0);
    expect(aggregates.all.excluded).toBe(1);
    expect(aggregates.sessionsFileSeen).toBe(true);
    expect(viewFromAggregates(aggregates, null)).toEqual({
      status: 'no-usable-sessions',
      excluded: 1,
    });
  });
});

describe('T-04-01: the IP column is never read', () => {
  it('changes nothing when the IP changes, or disappears entirely', () => {
    const withIp = buildPlaytime(
      [
        {
          SESSION_START: '2020-06-01 23:30:00',
          SESSION_END: '2020-06-01 23:50:00',
          IP: '192.0.2.99',
        },
      ],
      true,
    );
    const otherIp = buildPlaytime(
      [
        {
          SESSION_START: '2020-06-01 23:30:00',
          SESSION_END: '2020-06-01 23:50:00',
          IP: '198.51.100.7',
        },
      ],
      true,
    );
    const noIp = buildPlaytime(
      [{ SESSION_START: '2020-06-01 23:30:00', SESSION_END: '2020-06-01 23:50:00' }],
      true,
    );

    expect(otherIp.all).toEqual(withIp.all);
    expect(noIp.all).toEqual(withIp.all);
  });

  it('keeps the IP out of the resolved columns', () => {
    // The only four columns the aggregator names. There is no "pass the whole
    // row" helper here for an IP to slip through.
    expect(
      Object.keys(resolveSessionColumns({ SESSION_START: '', SESSION_END: '', IP: '' })),
    ).toEqual(['start', 'end', 'server', 'platform']);
  });
});

describe('merge matrix', () => {
  const MONDAY_10 = Date.UTC(2020, 5, 1, 10, 0, 0) / 1000;

  it.each([
    [
      'two disjoint sessions sum to the total of both',
      [
        { start: MONDAY_10, end: MONDAY_10 + 3600 },
        { start: MONDAY_10 + 7200, end: MONDAY_10 + 10800 },
      ],
      7200,
    ],
    [
      'a half-overlapping pair merges to the union',
      [
        { start: MONDAY_10, end: MONDAY_10 + 3600 },
        { start: MONDAY_10 + 1800, end: MONDAY_10 + 5400 },
      ],
      5400,
    ],
    [
      'a fully contained session adds nothing',
      [
        { start: MONDAY_10, end: MONDAY_10 + 3600 },
        { start: MONDAY_10 + 600, end: MONDAY_10 + 1200 },
      ],
      3600,
    ],
    [
      'a session sharing one second adds one second',
      [
        { start: MONDAY_10, end: MONDAY_10 + 3600 },
        { start: MONDAY_10 + 3599, end: MONDAY_10 + 7200 },
      ],
      7200,
    ],
    [
      'sessions touching exactly do not merge',
      [
        { start: MONDAY_10, end: MONDAY_10 + 3600 },
        { start: MONDAY_10 + 3600, end: MONDAY_10 + 7200 },
      ],
      7200,
    ],
    [
      'a zero-length session inside another adds nothing',
      [
        { start: MONDAY_10, end: MONDAY_10 + 3600 },
        { start: MONDAY_10 + 1800, end: MONDAY_10 + 1800 },
      ],
      3600,
    ],
    [
      'a fully contained earlier-starting session adds nothing',
      [
        { start: MONDAY_10 + 600, end: MONDAY_10 + 1200 },
        { start: MONDAY_10, end: MONDAY_10 + 3600 },
      ],
      3600,
    ],
    [
      'three in a chain merge to the outer span',
      [
        { start: MONDAY_10, end: MONDAY_10 + 1000 },
        { start: MONDAY_10 + 500, end: MONDAY_10 + 2000 },
        { start: MONDAY_10 + 1500, end: MONDAY_10 + 3000 },
      ],
      3000,
    ],
    [
      'an identical duplicate adds nothing',
      [
        { start: MONDAY_10, end: MONDAY_10 + 3600 },
        { start: MONDAY_10, end: MONDAY_10 + 3600 },
      ],
      3600,
    ],
  ] as const)('%s', (_label, sessions, seconds) => {
    const slice = aggregateSlice(sessions, 0);
    expect(slice.seconds).toBe(seconds);
    // Whatever the merge decided, the two hour grids must still describe the
    // same playtime or a chart would contradict the total.
    expect(sum(slice.hourOverlap)).toBe(slice.seconds);
    expect(sum(slice.hourStart)).toBe(slice.seconds);
  });
});

describe('binOf', () => {
  it('places each lower bound in its own bucket, inclusively', () => {
    // Off-by-one territory: 600s is 10 minutes and belongs to the 10-20
    // minute bucket, not the one below it.
    const cases: readonly (readonly [number, number])[] = [
      [0, 0],
      [1, 0],
      [59, 0],
      [60, 1],
      [119, 1],
      [120, 2],
      [299, 2],
      [300, 3],
      [599, 3],
      [600, 4],
      [1199, 4],
      [1200, 5],
      [1799, 5],
      [1800, 6],
      [3599, 6],
      [3600, 7],
      [7199, 7],
      [7200, 8],
      [14399, 8],
      [14400, 9],
      [28799, 9],
      [28800, 10],
      [57599, 10],
      [57600, 11],
      [10 ** 9, 11],
    ];
    for (const [length, bin] of cases) expect(binOf(length)).toBe(bin);
  });
});

describe('bounded time', () => {
  it('handles a 60,000-hour session without a 216-million-iteration loop', () => {
    // The naive reading of "credit every hour the session covers" is a loop
    // per hour. Whole weeks are added to all 168 cells in one pass instead,
    // which is what keeps a 7-year session instant. The oracle cannot check
    // this one — its per-second bitmap would need 216 million cells — so the
    // assertion is the sum identity instead.
    const slice = aggregateSlice([{ start: 0, end: 60_000 * 3600 }], 0);

    expect(slice.seconds).toBe(60_000 * 3600);
    expect(sum(slice.hourOverlap)).toBe(slice.seconds);
    // 833 whole weeks plus the remainder, spread over every cell.
    expect(slice.hourOverlap.filter((value) => value > 0)).toHaveLength(168);
    expect(Math.min(...slice.hourOverlap)).toBeGreaterThan(0);
  });
});

describe('seeded cross-check against the oracle', () => {
  it.each([1, 2, 3, 7, 11])('matches field for field on seed %i', (seed) => {
    const sessions = randomSessions(seed, 300, 30);
    const slice = aggregateSlice(sessions, 0);
    const expected = oracleSlice(sessions);

    expect(slice.seconds).toBe(expected.seconds);
    expect(slice.sessions).toBe(expected.sessions);
    expect(slice.dayIndex).toEqual(expected.dayIndex);
    expect(slice.daySeconds).toEqual(expected.daySeconds);
    expect(slice.daySessions).toEqual(expected.daySessions);
    expect(slice.hourOverlap).toEqual(expected.hourOverlap);
    expect(slice.hourStart).toEqual(expected.hourStart);
    expect(slice.bins).toEqual(expected.bins);
  });

  it('feeds that cross-check sessions that actually overlap', () => {
    // Without this, a change to the generator that stopped producing
    // overlaps would leave the cross-check above passing for the wrong
    // reason: a "sum the durations" implementation would agree with the
    // oracle too.
    const sessions = randomSessions(1, 300, 30);
    const naiveTotal = sessions.reduce((total, s) => total + (s.end - s.start), 0);

    expect(aggregateSlice(sessions, 0).seconds).toBeLessThan(naiveTotal);
    expect(sessions.some((s) => s.end === s.start)).toBe(true);
    expect(new Set(sessions.map((s) => Math.floor(s.start / 86400))).size).toBeGreaterThan(1);
  });
});

// =============================================================================
// 04-06: the split column rule, value handling, ordering and view selection.
//
// The tracer in the worker suite proves the split survives a real import.
// This file proves the RULE, because the rule is what a real export's
// contents decide: which column gets picked, what a "value" is, what order
// they appear in, and what a request for a value that is not there does.
//
// Every expected number here is either hand arithmetic on the rows or the
// independent per-second oracle. Nothing is read back out of the code.
// =============================================================================

/** One Sessions.csv data row keyed by the header, the shape the worker passes. */
type TestRow = Record<string, string | undefined>;

/**
 * A usable row: the two timestamps plus the split values the rule reads.
 *
 * A null value becomes an EMPTY CELL, which is what the export writes for a
 * missing value — the file has no way to write a literal null, and a test
 * that invented one would not be testing the parser's own path.
 */
function sessionRow(
  start: string,
  end: string,
  server: string | null = null,
  platform: string | null = null,
): TestRow {
  return {
    SESSION_START: start,
    SESSION_END: end,
    SERVER_NAME: server ?? '',
    CLIENT_PLATFORM: platform ?? '',
  };
}

/** `n` distinct server names, each carrying one session. */
function rowsForServers(servers: readonly string[]): TestRow[] {
  return servers.map((server) =>
    sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', server, 'win32'),
  );
}

/**
 * The split column the rule picks for these rows, or null.
 *
 * Read through `buildPlaytime` rather than through `chooseSplit` directly, so
 * the matrix pins what a real import STORES and not just what the helper
 * would say if it were called on its own.
 */
function splitFor(rows: TestRow[]) {
  return buildPlaytime(rows, true).splitColumn;
}

/** Turn a bare-CR Sessions.csv into the header-keyed rows `buildPlaytime` takes. */
function sessionRowsFromCsv(csv: string): TestRow[] {
  const [header = '', ...lines] = csv.split('\r').filter((line) => line.length > 0);
  const keys = header.split(';');
  return lines.map((line) => {
    const cells = line.split(';');
    const row: TestRow = {};
    for (const [index, key] of keys.entries()) row[key] = cells[index] ?? '';
    return row;
  });
}

describe('chooseSplit rule matrix', () => {
  it('picks SERVER_NAME when the server column has two distinct values', () => {
    expect(splitFor(rowsForServers(['a', 'b']))).toBe('SERVER_NAME');
  });

  it('falls back to CLIENT_PLATFORM when the servers are all one value', () => {
    // One value is not a split, so the rule has to look at the next column
    // rather than answer "no split" at the first.
    const rows = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', 'eu-1', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', 'eu-1', 'macOS'),
    ];

    expect(splitFor(rows)).toBe('CLIENT_PLATFORM');
  });

  it('picks SERVER_NAME when BOTH columns qualify', () => {
    const rows = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', 'a', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', 'b', 'macOS'),
    ];

    expect(splitFor(rows)).toBe('SERVER_NAME');
  });

  it('accepts exactly 50 distinct server values and refuses 51', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => `srv-${String(i).padStart(2, '0')}`);
    const fiftyOne = [...fifty, 'srv-50'];

    expect(splitFor(rowsForServers(fifty))).toBe('SERVER_NAME');
    // One past the cap, and the platform column is a single value, so there
    // is nothing left to fall back to.
    expect(splitFor(rowsForServers(fiftyOne))).toBeNull();
  });

  it('counts a blank server as ONE value beside a named one', () => {
    // A blank cell is a value the export really carries; it is the SELECTOR
    // that shows it as (not recorded). Two distinct values is a split.
    const rows = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', 'eu-1', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', '   ', 'win32'),
    ];
    const aggregates = buildPlaytime(rows, true);

    expect(aggregates.splitColumn).toBe('SERVER_NAME');
    expect(aggregates.values).toHaveLength(2);
    expect(aggregates.values).toContain(null);
  });

  it('refuses a split when every server value is blank (one value)', () => {
    const rows = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', '', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', '  ', 'win32'),
    ];

    expect(splitFor(rows)).toBeNull();
  });

  it('refuses a split when the header has neither column', () => {
    // Every row's value is null for both columns, so both read as one value.
    const rows = [
      { SESSION_START: '2020-06-01 10:00:00', SESSION_END: '2020-06-01 10:30:00' },
      { SESSION_START: '2020-06-01 11:00:00', SESSION_END: '2020-06-01 11:30:00' },
    ];

    expect(splitFor(rows)).toBeNull();
  });
});

// =============================================================================
// 04-15: the edges of the GAME split column.
//
// 04-06's matrix above pins the rule for the two columns a synthetic
// `Sessions.csv` has. These pin it for `GAME`, which is the column a REAL
// export has, and they are the cases where being wrong is quiet: a game seen
// only on excluded rows, two files of one game, a legacy file beside a real
// one, and a code that reads like an `Object.prototype` member.
//
// The rows come from `buildRealShapeCsv` through `parseCsvFile`, so the cells
// are the ones a real CRLF file yields rather than hand-built objects, and the
// game comes from the FILE NAME the way the worker derives it.
// =============================================================================

/** One 30-minute real-shape session, the unit of the cap and prototype rows. */
function realShapeSession(hour: number): readonly RealShapeRow[] {
  const stamp = String(hour).padStart(2, '0');
  return [[`02.11.2020 ${stamp}:00`, `02.11.2020 ${stamp}:30`]];
}

/** One real-shape session FILE, as the worker sees it: its game and its rows. */
function realShapeSource(file: string, rows: readonly RealShapeRow[]): SessionSource {
  return {
    game: sessionFileNameGame(file),
    rows: parseCsvFile(buildRealShapeCsv(rows), 'Activity_history', file).rows.map(
      (row) => row.data,
    ),
  };
}

/** The two-game export's three files, exactly as a real import would hold them. */
function twoGameSources(extra?: readonly SessionSource[]): readonly SessionSource[] {
  return [
    realShapeSource('WOT_Game_Sessions.csv', REAL_SHAPE_WOT_ROWS),
    realShapeSource('WOTB_Game_Sessions.csv', []),
    realShapeSource('WOWS_Game_Sessions.csv', REAL_SHAPE_WOWS_ROWS),
    ...(extra ?? []),
  ];
}

describe('04-15: the GAME split column at its edges', () => {
  it('splits the real two-game export on GAME, WOT before WOWS, excluded 2 and 0', () => {
    const aggregates = buildPlaytimeFromSources(twoGameSources(), true);

    expect(aggregates.splitColumn).toBe('GAME');
    // WOT holds 12,600 s and WOWS 6,600, so the order is hours descending.
    expect(aggregates.values).toEqual(['WOT', 'WOWS']);
    // Both excluded rows are WOT's: a value's excluded count is the excluded
    // rows CARRYING that value, and WOWS has none of its own.
    expect(aggregates.byValue.map((slice) => slice.excluded)).toEqual([2, 0]);
    // All counts every excluded row whatever game it came from.
    expect(aggregates.all.excluded).toBe(2);
    expect(aggregates.all.sessions).toBe(7);
  });

  it('does not make a value of a game seen only on excluded rows (RESEARCH A6)', () => {
    // WOTB's only row ends before it starts, so it is EXCLUDED: counted, never
    // a session. A game with no usable session is not a value, or a value that
    // holds nothing could pull the selector on an export with one real game.
    const wotb = realShapeSource('WOTB_Game_Sessions.csv', [
      ['03.11.2020 12:00', '03.11.2020 11:00'],
    ]);
    const aggregates = buildPlaytimeFromSources(twoGameSources([wotb]), true);

    expect(aggregates.splitColumn).toBe('GAME');
    expect(aggregates.values).toEqual(['WOT', 'WOWS']);
    // Its row is not dropped from the dataset (D-02): All's excluded count
    // rises to 3 while neither value's does.
    expect(aggregates.all.excluded).toBe(3);
    expect(aggregates.byValue.map((slice) => slice.excluded)).toEqual([2, 0]);
  });

  it('is not a split when the ONLY other game is seen on excluded rows', () => {
    // The decisive shape, and the one that decides whether excluded rows are
    // counted when choosing the column. Two USABLE games make a split whatever
    // a third excluded-only game does, so the row above cannot tell a correct
    // `chooseSplit` from one that fed excluded rows in: counting them here would
    // yield a `GAME` split holding a single value, which is the "a value that
    // holds nothing pulls the selector" failure A6 exists to prevent.
    const wotb = realShapeSource('WOTB_Game_Sessions.csv', [
      ['03.11.2020 12:00', '03.11.2020 11:00'],
    ]);
    const aggregates = buildPlaytimeFromSources(
      [realShapeSource('WOT_Game_Sessions.csv', REAL_SHAPE_WOT_ROWS), wotb],
      true,
    );

    // One USABLE game, so no split, no selector, no table and no message — the
    // page makes no claim about which game a lone file holds.
    expect(aggregates.splitColumn).toBeNull();
    expect(aggregates.values).toEqual([]);
    expect(aggregates.byValue).toEqual([]);
    // Excluded rows are still counted and still never dropped (D-02): the two
    // the WOT fixture already carries, plus WOTB's one.
    expect(aggregates.all.excluded).toBe(3);
  });

  it('treats two files of one game as one value, and one game alone as no split', () => {
    const wotA = realShapeSource('WOT_Game_Sessions.csv', REAL_SHAPE_WOT_ROWS);
    const wotB = realShapeSource('WOT_Game_Sessions.csv', REAL_SHAPE_WOT_ROWS);
    const wows = realShapeSource('WOWS_Game_Sessions.csv', REAL_SHAPE_WOWS_ROWS);

    // A re-zipped export can hold two files of the same game, and the game is
    // the NAME — so they are ONE value whose sessions aggregate together, not
    // two values. The split exists only because WOWS is a third distinct game.
    const both = buildPlaytimeFromSources([wotA, wotB, wows], true);
    expect(both.splitColumn).toBe('GAME');
    expect(both.values).toEqual(['WOT', 'WOWS']);
    // Ten sessions, not seven and not fourteen: both files' usable rows under
    // one value, and both files' excluded rows counted against it.
    expect(both.byValue[0]?.sessions).toBe(REAL_SHAPE_WOT.sessions * 2);
    expect(both.byValue[0]?.excluded).toBe(REAL_SHAPE_WOT.excluded * 2);
    // The duplicated file holds the SAME wall-clock intervals, so merging them
    // credits the hours once: doubling the files did not invent playtime.
    expect(both.byValue[0]?.seconds).toBe(REAL_SHAPE_WOT.seconds);

    // Two WOT files alone are ONE distinct value, which is not a split: no
    // selector, no split table, and no message about a missing split. This is
    // also the shape most real users have — one real game file holding rows.
    const alone = buildPlaytimeFromSources([wotA, wotB], true);
    expect(alone.splitColumn).toBeNull();
    expect(alone.values).toEqual([]);
    // The rows are still counted; deduplicating the files loses nothing.
    expect(alone.all.sessions).toBe(REAL_SHAPE_WOT.sessions * 2);
    expect(alone.all.excluded).toBe(REAL_SHAPE_WOT.excluded * 2);
    expect(alone.all.seconds).toBe(REAL_SHAPE_WOT.seconds);
  });

  it('splits a legacy file beside a real one on the blank value and WOT', () => {
    // A legacy `Sessions.csv` names no game, so its rows carry a null game. Null
    // is a VALUE like any other, so a mixed export has two: the blank one and
    // WOT — and GAME is chosen, which is the point of the mixed export.
    const legacy = sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', 'eu-1', 'win32');
    const aggregates = buildPlaytimeFromSources(
      [
        { game: null, rows: [legacy] },
        realShapeSource('WOT_Game_Sessions.csv', REAL_SHAPE_WOT_ROWS),
      ],
      true,
    );

    expect(aggregates.splitColumn).toBe('GAME');
    expect(aggregates.values).toContain(null);
    expect(aggregates.values).toContain('WOT');
    // The blank is STORED as null, not as an empty string, so `formatSplitValue`
    // can still tell it apart from a game genuinely named "(not recorded)".
    expect(aggregates.values).not.toContain('');
  });

  it('never lets a legacy file alone make GAME the split', () => {
    // Every legacy session has a null game, which is ONE distinct value, so
    // GAME cannot qualify and the rule falls through to the columns a legacy
    // file actually has. This is the regression the whole plan risks.
    const rows = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', 'eu-1', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', 'na-1', 'win32'),
    ];

    expect(buildPlaytime(rows, true).splitColumn).toBe('SERVER_NAME');
    // And the platform fallback is still the fallback.
    const oneServer = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', 'eu-1', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', 'eu-1', 'macOS'),
    ];
    expect(buildPlaytime(oneServer, true).splitColumn).toBe('CLIENT_PLATFORM');
  });

  it('accepts exactly 50 game codes and refuses 51 (the cap is inclusive)', () => {
    // The cap exists so a 50,000-session export cannot blow the stored
    // aggregate up with one cell per value (T-04-12). It applies to GAME like
    // any column, so an attacker-supplied set of file names is bounded too
    // (T-04-34).
    const sourcesFor = (count: number): SessionSource[] =>
      Array.from({ length: count }, (_, i) =>
        realShapeSource(`GAME_${String(i).padStart(2, '0')}_game_sessions.csv`, [
          realShapeSession(0)[0]!,
        ]),
      );

    const fifty = buildPlaytimeFromSources(sourcesFor(50), true);
    expect(fifty.splitColumn).toBe('GAME');
    expect(fifty.values).toHaveLength(50);

    // One past the cap. The real header carries no server and no platform
    // column, so there is nothing left to fall back to.
    const fiftyOne = buildPlaytimeFromSources(sourcesFor(51), true);
    expect(fiftyOne.splitColumn).toBeNull();
    expect(fiftyOne.values).toEqual([]);
  });

  it('upper-cases a game code that reads like an Object.prototype member', () => {
    // T-04-10 for the file-name column: `constructor_game_sessions.csv` is a
    // legal name, and its code must be the plain string CONSTRUCTOR. Grouping
    // is by Map and selection is by index, so no value is ever used as a
    // property name.
    const hostile = ['constructor', '__proto__', 'toString'].map((name, index) =>
      realShapeSource(`${name}_game_sessions.csv`, realShapeSession(10 + index)),
    );
    const keysBefore = Object.getOwnPropertyNames(Object.prototype).length;
    const aggregates = buildPlaytimeFromSources(hostile, true);

    expect(aggregates.splitColumn).toBe('GAME');
    expect(aggregates.values.slice().sort()).toEqual(['CONSTRUCTOR', 'TOSTRING', '__PROTO__']);
    // Each slice holds its own 30 minutes and nobody else's.
    for (const slice of aggregates.byValue) {
      expect(slice.sessions).toBe(1);
      expect(slice.seconds).toBe(1800);
    }

    // Nothing was written onto a prototype. Note WHAT is asserted: `({}).toString`
    // is a function in plain JavaScript, so "the property is undefined" would
    // be false for a fresh object in any implementation. The claim that matters
    // is that aggregating these values ADDED nothing.
    expect(Object.getOwnPropertyNames(Object.prototype)).toHaveLength(keysBefore);
    expect(Object.keys(Object.prototype)).toEqual([]);
    const fresh = {} as Record<string, unknown>;
    expect(Object.getOwnPropertyNames(fresh)).toEqual([]);
    expect(Object.keys({})).toEqual([]);
  });
});

describe('split value handling', () => {
  it('trims a padded value into the same value as the unpadded one', () => {
    const rows = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', ' eu-1 ', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', 'eu-1', 'win32'),
      sessionRow('2020-06-01 12:00:00', '2020-06-01 12:30:00', 'na-1', 'win32'),
    ];
    const aggregates = buildPlaytime(rows, true);

    expect(aggregates.values.sort()).toEqual(['eu-1', 'na-1']);
  });

  it('does NOT case-fold: EU-1 and eu-1 are two servers', () => {
    // Folding them would merge two values the export never claimed were one,
    // and the order of the stored values would then depend on a rule a user
    // cannot see.
    const rows = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', 'EU-1', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', 'eu-1', 'win32'),
    ];
    const aggregates = buildPlaytime(rows, true);

    expect(aggregates.splitColumn).toBe('SERVER_NAME');
    expect(aggregates.values.slice().sort()).toEqual(['EU-1', 'eu-1']);
  });

  it('keeps a value that literally reads "(not recorded)" apart from a blank one', () => {
    // ui-copy's formatSplitValue renders both as (not recorded) and the
    // UI-SPEC accepts that collision. The STORED values must still be two, or
    // a real server name would be swallowed by the blank bucket.
    const rows = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', '(not recorded)', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', '', 'win32'),
    ];
    const aggregates = buildPlaytime(rows, true);

    expect(aggregates.values).toHaveLength(2);
    expect(aggregates.values).toContain('(not recorded)');
    expect(aggregates.values).toContain(null);
  });

  it('gives __proto__, constructor and toString their own correct slices', () => {
    // T-04-10. These are ordinary cells in an attacker-supplied file, so they
    // are ordinary values — never property names, never a prototype write.
    const hostile = ['__proto__', 'constructor', 'toString'];
    const prototypeKeysBefore = Object.getOwnPropertyNames(Object.prototype).length;
    const rows = hostile.map((server, index) =>
      sessionRow(
        `2020-06-01 ${String(10 + index).padStart(2, '0')}:00:00`,
        `2020-06-01 ${String(10 + index).padStart(2, '0')}:30:00`,
        server,
        'win32',
      ),
    );
    const aggregates = buildPlaytime(rows, true);

    expect(aggregates.values.slice().sort()).toEqual(hostile.slice().sort());
    // Each slice holds its own 30 minutes and nobody else's.
    for (const slice of aggregates.byValue) {
      expect(slice.sessions).toBe(1);
      expect(slice.seconds).toBe(1800);
    }

    // Nothing was written onto a prototype or onto a fresh object. Note
    // WHAT is asserted: `({}).__proto__` is `Object.prototype` and
    // `({}).toString` is a function in plain JavaScript, so "the property is
    // undefined" would be false for a fresh object in any implementation.
    // The claim that matters is that aggregating these values ADDED nothing.
    expect(Object.getOwnPropertyNames(Object.prototype)).toHaveLength(prototypeKeysBefore);
    expect(Object.keys(Object.prototype)).toEqual([]);
    const fresh = {} as Record<string, unknown>;
    expect(Object.getOwnPropertyNames(fresh)).toEqual([]);
    expect(Object.keys({})).toEqual([]);
  });
});

describe('split slices and ordering', () => {
  // 10:00-11:00 on server A and 10:30-11:30 on server B: the union is 90
  // minutes, each value alone is 60, and the parts therefore add to MORE
  // than All. That is D-02 applied per value, and it is the surprise the
  // overlap note under the split table exists to explain.
  const A_START = Date.UTC(2020, 5, 1, 10, 0, 0) / 1000;
  const A_END = Date.UTC(2020, 5, 1, 11, 0, 0) / 1000;
  const B_START = Date.UTC(2020, 5, 1, 10, 30, 0) / 1000;
  const B_END = Date.UTC(2020, 5, 1, 11, 30, 0) / 1000;

  const CROSS_ROWS: TestRow[] = [
    {
      SESSION_START: '2020-06-01 10:00:00',
      SESSION_END: '2020-06-01 11:00:00',
      SERVER_NAME: 'A',
      CLIENT_PLATFORM: 'win32',
    },
    {
      SESSION_START: '2020-06-01 10:30:00',
      SESSION_END: '2020-06-01 11:30:00',
      SERVER_NAME: 'B',
      CLIENT_PLATFORM: 'win32',
    },
  ];

  it('merges overlap per value, so the parts add up to more than All', () => {
    const aggregates = buildPlaytime(CROSS_ROWS, true);

    expect(aggregates.all.seconds).toBe(5400);
    expect(aggregates.all.sessions).toBe(2);
    // Equal seconds, so the tie breaks ascending by code unit: A then B.
    expect(aggregates.values).toEqual(['A', 'B']);
    expect(aggregates.byValue.map((slice) => slice.seconds)).toEqual([3600, 3600]);

    const perValue = aggregates.byValue.reduce((total, slice) => total + slice.seconds, 0);
    expect(perValue).toBe(7200);
    expect(perValue).toBeGreaterThan(aggregates.all.seconds);
  });

  it('agrees with the independent per-second oracle over each value', () => {
    const aggregates = buildPlaytime(CROSS_ROWS, true);
    const perValue: Record<string, OracleSession[]> = { A: [], B: [] };
    for (const [index] of CROSS_ROWS.entries()) {
      perValue[index === 0 ? 'A' : 'B']!.push({
        start: index === 0 ? A_START : B_START,
        end: index === 0 ? A_END : B_END,
      });
    }

    expect(aggregates.byValue[0]).toMatchObject(oracleSlice(perValue.A!));
    expect(aggregates.byValue[1]).toMatchObject(oracleSlice(perValue.B!));
    expect(aggregates.all).toMatchObject(oracleSlice([...perValue.A!, ...perValue.B!]));
  });

  it('orders by seconds descending, ties ascending, blank last among ties', () => {
    // Three values with EQUAL seconds, given in a deliberately unhelpful
    // order: b, a, blank. The answer is a, b, blank.
    const rows = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', 'b', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', '', 'win32'),
      sessionRow('2020-06-01 12:00:00', '2020-06-01 12:30:00', 'a', 'win32'),
    ];
    const aggregates = buildPlaytime(rows, true);

    expect(aggregates.values).toEqual(['a', 'b', null]);
    expect(aggregates.byValue.every((slice) => slice.seconds === 1800)).toBe(true);
  });

  it('puts the longest value first regardless of the order the rows arrive in', () => {
    const rows = [
      sessionRow('2020-06-01 10:00:00', '2020-06-01 10:10:00', 'short', 'win32'),
      sessionRow('2020-06-01 11:00:00', '2020-06-01 12:00:00', 'long', 'win32'),
      sessionRow('2020-06-01 13:00:00', '2020-06-01 13:20:00', 'middle', 'win32'),
    ];
    const aggregates = buildPlaytime(rows, true);

    expect(aggregates.values).toEqual(['long', 'middle', 'short']);
    expect(aggregates.byValue.map((slice) => slice.seconds)).toEqual([3600, 1200, 600]);
  });

  it('gives every usable session to exactly one value', () => {
    // zz-9 appears on an excluded row only, so its row is counted under All
    // and no value may claim it (RESEARCH A6).
    const rows = [
      ...CROSS_ROWS,
      {
        SESSION_START: '2020-06-01 12:00:00',
        SESSION_END: '',
        SERVER_NAME: 'A',
        CLIENT_PLATFORM: 'win32',
      },
      {
        SESSION_START: '2020-06-01 12:00:00',
        SESSION_END: '',
        SERVER_NAME: 'zz-9',
        CLIENT_PLATFORM: 'win32',
      },
    ];
    const aggregates = buildPlaytime(rows, true);

    const perValueSessions = aggregates.byValue.reduce((n, slice) => n + slice.sessions, 0);
    const perValueExcluded = aggregates.byValue.reduce((n, slice) => n + slice.excluded, 0);

    expect(perValueSessions).toBe(aggregates.all.sessions);
    // All's excluded count is the higher one, by exactly the row whose value
    // has no usable session.
    expect(perValueExcluded).toBeLessThanOrEqual(aggregates.all.excluded);
    expect(aggregates.all.excluded - perValueExcluded).toBe(1);
    expect(aggregates.values).toEqual(['A', 'B']);
  });
});

describe('viewFromAggregates selection', () => {
  /** Two values, `alpha` with 7,200 s and `beta` with 900 s. */
  const SPLIT_AGGREGATES = buildPlaytime(
    [
      sessionRow('2020-06-01 12:00:00', '2020-06-01 14:00:00', 'alpha', 'win32'),
      sessionRow('2020-06-01 15:00:00', '2020-06-01 15:15:00', 'beta', 'win32'),
    ],
    true,
  );

  it.each([
    ['a negative index', -1],
    ['a fractional index', 2.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['an index past the end', 99],
  ])('answers the All slice for %s', (_label, valueIndex) => {
    const view = viewFromAggregates(SPLIT_AGGREGATES, valueIndex);
    if (view.status !== 'ready') throw new Error('expected a ready view');

    expect(view.selected).toBeNull();
    expect(view.slice).toBe(SPLIT_AGGREGATES.all);
  });

  it('answers the value slice and reports the index it applied', () => {
    const view = viewFromAggregates(SPLIT_AGGREGATES, 1);
    if (view.status !== 'ready') throw new Error('expected a ready view');

    expect(view.selected).toBe(1);
    expect(view.slice).toBe(SPLIT_AGGREGATES.byValue[1]);
    expect(view.slice.seconds).toBe(900);
    expect(view.split?.values[1]).toEqual({ value: 'beta', seconds: 900 });
    // 12:00-14:00 is 7,200 s and 15:00-15:15 is 900 s, and the two do not
    // overlap, so All is their plain sum.
    expect(view.split?.allSeconds).toBe(8100);
  });

  it('answers a null split and a null selection even when an index is passed', () => {
    const noSplit = buildPlaytime(
      [
        sessionRow('2020-06-01 10:00:00', '2020-06-01 10:30:00', 'eu-1', 'win32'),
        sessionRow('2020-06-01 11:00:00', '2020-06-01 11:30:00', 'eu-1', 'win32'),
      ],
      true,
    );
    const view = viewFromAggregates(noSplit, 3);
    if (view.status !== 'ready') throw new Error('expected a ready view');

    expect(view.split).toBeNull();
    expect(view.selected).toBeNull();
    expect(view.slice).toBe(noSplit.all);
  });

  it('carries no split on the two non-ready statuses', () => {
    const noFile = buildPlaytime([], false);
    expect(viewFromAggregates(noFile, 0)).toEqual({ status: 'no-session-file' });

    const allExcluded = buildPlaytime([{ SESSION_START: '2020-06-01 10:00:00' }], true);
    expect(viewFromAggregates(allExcluded, 0)).toEqual({
      status: 'no-usable-sessions',
      excluded: 1,
    });
  });

  it('stores no string but the split values, and never the IP (T-04-01)', () => {
    const rows = [
      {
        SESSION_START: '2020-06-01 12:00:00',
        SESSION_END: '2020-06-01 14:00:00',
        SERVER_NAME: 'eu-1',
        CLIENT_PLATFORM: 'win32',
        CLIENT_BUILD: '12931',
        IP: '192.0.2.99',
      },
      {
        SESSION_START: '2020-06-01 15:00:00',
        SESSION_END: '2020-06-01 15:15:00',
        SERVER_NAME: 'na-1',
        CLIENT_PLATFORM: 'win32',
        CLIENT_BUILD: '12931',
        IP: '192.0.2.99',
      },
    ];
    const aggregates = buildPlaytime(rows, true);
    const json = JSON.stringify(aggregates);

    expect(json).not.toContain('192.0.2.99');
    expect(json).not.toContain('IP');
    expect(json).not.toContain('CLIENT_BUILD');
    // The only server-name strings that survive are the two split values, in
    // `values`. `splitColumn` is the other string, and it is the column's own
    // name — never a cell from the file.
    expect(json.match(/"eu-1"|"na-1"/g)).toHaveLength(2);
    expect(Object.keys(aggregates).sort()).toEqual([
      'all',
      'byValue',
      'sessionsFileSeen',
      'splitColumn',
      'v',
      'values',
    ]);
  });
});

// =============================================================================
// 04-06: the two split paths a seeded fixture never reached
// =============================================================================
//
// 04-03 recorded that `SCALE_5K_SPEC` always resolves to SERVER_NAME, and
// 04-05 recorded that its split-table tests were therefore built from
// hand-written inputs. These two specs close that gap, and with it the two
// model functions get their first coverage derived from a real Sessions.csv:
// `buildSplitTable` and `effectiveSelection` are the only things between the
// worker's answer and the rows 04-08 will render.
// =============================================================================

describe('04-06: a one-server, two-platform fixture forces the CLIENT_PLATFORM fallback', () => {
  const { csv, expected } = buildSessionsExport(PLATFORM_FALLBACK_SPEC);
  const aggregates = buildPlaytime(sessionRowsFromCsv(csv), true);

  it('the fixture really does have no usable SERVER_NAME split', () => {
    // The answer key, computed by the fixture's own layout, not by the code
    // under test: one server, two platforms.
    expect(expected.splitColumn).toBe('CLIENT_PLATFORM');
    expect(aggregates.splitColumn).toBe('CLIENT_PLATFORM');
  });

  it('matches the key value for value', () => {
    expect(aggregates.values).toEqual(expected.values);
    expect(aggregates.byValue.map((slice) => slice.seconds)).toEqual(expected.valueSeconds);
    expect(aggregates.byValue.map((slice) => slice.sessions)).toEqual(expected.valueSessions);
    expect(aggregates.byValue.map((slice) => slice.excluded)).toEqual(expected.valueExcluded);
    expect(aggregates.all).toMatchObject({
      seconds: expected.seconds,
      sessions: expected.sessions,
      excluded: expected.excluded,
    });
  });

  it('feeds buildSplitTable a CLIENT_PLATFORM split for the first time from a fixture', () => {
    const view = viewFromAggregates(aggregates, 1);
    if (view.status !== 'ready') throw new Error('expected a ready view');
    const table = buildSplitTable(view.split, view.selected);

    expect(table.rows[0]).toMatchObject({ isAll: true, value: null, seconds: expected.seconds });
    // The All row is not the selected one; the second value row is.
    expect(table.rows[0]!.selected).toBe(false);
    expect(table.rows.filter((row) => row.selected)).toHaveLength(1);
    expect(table.rows.find((row) => row.selected)).toMatchObject({
      valueIndex: 1,
      value: expected.values[1],
    });
  });

  it("feeds effectiveSelection the fixture's real value count", () => {
    const count = expected.values.length;
    const request = { importedAt: '2020-01-01T00:00:00.000Z', valueIndex: 1 };

    expect(effectiveSelection(request, '2020-01-01T00:00:00.000Z', count)).toBe(1);
    // A replace landed between the request and the answer: the index is
    // refused rather than applied to a different dataset's list.
    expect(effectiveSelection(request, '2020-06-01T00:00:00.000Z', count)).toBeNull();
    // And the last index is as valid as the first, but one past it is not.
    expect(
      effectiveSelection(
        { importedAt: '2020-01-01T00:00:00.000Z', valueIndex: count - 1 },
        '2020-01-01T00:00:00.000Z',
        count,
      ),
    ).toBe(count - 1);
    expect(
      effectiveSelection(
        { importedAt: '2020-01-01T00:00:00.000Z', valueIndex: count },
        '2020-01-01T00:00:00.000Z',
        count,
      ),
    ).toBeNull();
  });
});

describe('04-06: a one-server, one-platform fixture forces the null split', () => {
  const { csv, expected } = buildSessionsExport(NO_SPLIT_SPEC);
  const aggregates = buildPlaytime(sessionRowsFromCsv(csv), true);

  it('the fixture qualifies for no column at all', () => {
    expect(expected.splitColumn).toBeNull();
    expect(aggregates.splitColumn).toBeNull();
    expect(aggregates.values).toEqual([]);
    expect(aggregates.byValue).toEqual([]);
    // The All slice is still a real slice: the sections below it are All-only,
    // not empty.
    expect(aggregates.all.seconds).toBe(expected.seconds);
    expect(aggregates.all.sessions).toBe(expected.sessions);
  });

  it('answers a ready view with no split and no selection, whatever index is asked for', () => {
    for (const valueIndex of [null, 0, 7, -1]) {
      const view = viewFromAggregates(aggregates, valueIndex);
      if (view.status !== 'ready') throw new Error('expected a ready view');
      expect(view.split).toBeNull();
      expect(view.selected).toBeNull();
      expect(view.slice).toBe(aggregates.all);
    }
  });

  it('gives buildSplitTable and effectiveSelection their first fixture-built null paths', () => {
    // The component hands these the view verbatim, so a null split has to
    // survive them without a branch of its own.
    expect(buildSplitTable(null, null)).toEqual({ rows: [], moreCount: 0 });
    expect(buildSplitTable(null, 3)).toEqual({ rows: [], moreCount: 0 });
    // With no value list there is no index to apply, whatever was asked for.
    expect(
      effectiveSelection(
        { importedAt: '2020-01-01T00:00:00.000Z', valueIndex: 0 },
        '2020-01-01T00:00:00.000Z',
        0,
      ),
    ).toBeNull();
    expect(
      effectiveSelection({ importedAt: '2020-01-01T00:00:00.000Z', valueIndex: 0 }, null, 4),
    ).toBeNull();
  });
});

// =============================================================================
// 04-14 Task 2 — the REAL export's per-file sources (UAT gap G-04-1)
// =============================================================================
//
// Everything above was written against the synthetic fixture's single
// `Sessions.csv`. A real export differs in three ways, each with its own case
// here:
//
//   1. the file is named `{GAME}_Game_Sessions.csv`, so the file NAME says which
//      game the rows belong to and the folder alone no longer identifies it;
//   2. the header is `STARTED_AT;FINISHED_AT;IP`, so one column set resolved
//      from the first row of the WHOLE import would read one file's header and
//      apply it to every other file;
//   3. an export can hold a legacy `Sessions.csv` AND a real per-game file at
//      once, and both must be counted.
//
// The dangerous one is (2): resolving the columns once, from the first row that
// arrives, silently excludes every row of the other files. So the per-source
// case is the load-bearing one below.
// =============================================================================

/**
 * The per-file surface 04-14 Task 2 adds, loaded DYNAMICALLY.
 *
 * Dynamic so a missing export fails ONE test with a named message instead of
 * taking this file's whole module scope down, which is the RED this task was
 * written for. The properties are optional for the same reason: at the RED run
 * `sessionFileGame` exists and the other two do not.
 */
interface PerFileSurface {
  sessionFileNameGame?: (sourceFile: string) => string | null;
  sessionFileGame?: (category: string, sourceFile: string) => string | null;
  buildPlaytimeFromSources?: (sources: unknown, sessionsFileSeen: boolean) => unknown;
}

async function loadPerFileSurface(): Promise<PerFileSurface> {
  return (await import('../../../src/lib/features/playtime/playtime-aggregate')) as unknown as PerFileSurface;
}

/** One source in the shape `buildPlaytimeFromSources` takes. */
function source(game: string | null, rows: readonly Record<string, string>[]): unknown {
  return { game, rows };
}

describe('04-14: sessionFileGame reads the game out of the file name', () => {
  it.each([
    ['WOT', 'WOT_Game_Sessions.csv'],
    ['WOTB', 'WOTB_Game_Sessions.csv'],
    ['WOWS', 'WOWS_Game_Sessions.csv'],
    ['WOWP_19', 'wowp_19_game_sessions.csv'],
    ['WOT', 'WOT_GAME_SESSIONS.CSV'],
  ])('answers %s for %s in Activity_history, whatever the case', async (game, name) => {
    const { sessionFileGame } = await loadPerFileSurface();
    expect(typeof sessionFileGame).toBe('function');
    expect(sessionFileGame!('Activity_history', name)).toBe(game);
    expect(sessionFileGame!('activity_history', name)).toBe(game);
    // Any other folder is not this app's session data at all.
    expect(sessionFileGame!('User_Info', name)).toBeNull();
  });

  it('answers null for the legacy Sessions.csv, which names no game', async () => {
    // Not a rejection: the file IS session data and `isSessionsRow` says so.
    // Only the LABEL is absent, which is the whole reason the label and the
    // boolean have to be two different functions.
    const { sessionFileGame } = await loadPerFileSurface();
    expect(sessionFileGame!('Activity_history', 'Sessions.csv')).toBeNull();
    expect(isSessionsRow('Activity_history', 'Sessions.csv')).toBe(true);
  });

  it.each([
    ['an empty token', '_Game_Sessions.csv'],
    ['no token at all', 'Game_Sessions.csv'],
    ['the xlsx duplicate', 'WOT_Game_Sessions.xlsx'],
    ['a backup suffix', 'WOT_Game_Sessions.csv.bak'],
    ['a nested path', 'sub/WOT_Game_Sessions.csv'],
    ['a 25-character token', 'ABCDEFGHIJKLMNOPQRSTUVWXY_Game_Sessions.csv'],
    ['a token with a space', 'WORLD OF TANKS_Game_Sessions.csv'],
    ['a token with a hyphen', 'WORLD-OF-TANKS_Game_Sessions.csv'],
    ['a token with an angle bracket', '<script>_Game_Sessions.csv'],
    ['a macOS sidecar name', '._WOT_Game_Sessions.csv'],
  ])('refuses %s', async (_label, name) => {
    const { sessionFileGame } = await loadPerFileSurface();
    expect(sessionFileGame!('Activity_history', name)).toBeNull();
    expect(isSessionsRow('Activity_history', name)).toBe(false);
  });

  it('applies the same name rules with no folder check', async () => {
    const { sessionFileNameGame } = await loadPerFileSurface();
    expect(typeof sessionFileNameGame).toBe('function');
    expect(sessionFileNameGame!('WOT_Game_Sessions.csv')).toBe('WOT');
    expect(sessionFileNameGame!('wowp_19_game_sessions.csv')).toBe('WOWP_19');
    expect(sessionFileNameGame!('Sessions.csv')).toBeNull();
    expect(sessionFileNameGame!('sub/WOT_Game_Sessions.csv')).toBeNull();
    expect(sessionFileNameGame!('WOT_Game_Sessions.xlsx')).toBeNull();
  });
});

describe('04-14: buildPlaytimeFromSources resolves each file with its own header', () => {
  it('counts a legacy source and a real source in one call', async () => {
    // THE case this plan exists for. Resolved once from the first row of the
    // whole import, the real source's rows would all be excluded and this
    // total would read one session of 5,400 seconds instead of four, with no
    // excluded count to explain the gap.
    const { buildPlaytimeFromSources } = await loadPerFileSurface();
    expect(typeof buildPlaytimeFromSources).toBe('function');

    const aggregates = buildPlaytimeFromSources!(
      [
        source(null, [
          { SESSION_START: '2020-06-01 10:00:00', SESSION_END: '2020-06-01 11:30:00' },
        ]),
        source('WOT', [
          { STARTED_AT: '13.03.2019 20:00', FINISHED_AT: '13.03.2019 21:30' },
          { STARTED_AT: '14.03.2019 23:30', FINISHED_AT: '15.03.2019 00:30' },
          { STARTED_AT: '02.11.2020 10:00', FINISHED_AT: '02.11.2020 10:30' },
        ]),
      ],
      true,
    ) as { all: { sessions: number; excluded: number; seconds: number } };

    expect(aggregates.all.sessions).toBe(4);
    expect(aggregates.all.excluded).toBe(0);
    expect(aggregates.all.seconds).toBe(5400 + 5400 + 3600 + 1800);
  });

  it('gives a single source the same answer as the flat buildPlaytime', async () => {
    // The wrapper is not allowed to change anything, or the whole matrix above
    // would need re-proving against a second code path.
    const { buildPlaytimeFromSources } = await loadPerFileSurface();
    const rows = [
      {
        SESSION_START: '2020-06-01 12:00:00',
        SESSION_END: '2020-06-01 13:30:00',
        SERVER_NAME: 'eu',
      },
      {
        SESSION_START: '2020-06-01 13:00:00',
        SESSION_END: '2020-06-01 14:00:00',
        SERVER_NAME: 'eu',
      },
      {
        SESSION_START: '2020-06-04 10:00:00',
        SESSION_END: '2020-06-04 09:00:00',
        SERVER_NAME: 'na',
      },
    ];

    expect(buildPlaytimeFromSources!([source(null, rows)], true)).toEqual(
      buildPlaytime(rows, true),
    );
    // And the seen flag is the caller's, passed straight through: a source with
    // no rows still marks the file seen, which is what separates a header-only
    // file from a missing one.
    const empty = buildPlaytimeFromSources!([source('WOTB', [])], true) as {
      sessionsFileSeen: boolean;
      all: { sessions: number; excluded: number };
    };
    expect(empty.sessionsFileSeen).toBe(true);
    expect(empty.all.sessions).toBe(0);
    expect(empty.all.excluded).toBe(0);
  });
});

describe('04-14: a hybrid header reads the column that comes first in the row', () => {
  it('prefers SESSION_START over STARTED_AT by row order, not by spelling priority', () => {
    // A hybrid file is malformed, and either reading is defensible. What is NOT
    // defensible is a priority order nobody can see in the file, so the rule is
    // stated: the key that appears first in the row wins, whichever spelling it
    // uses.
    expect(
      resolveSessionColumns({
        SESSION_START: '2020-06-01 12:00:00',
        STARTED_AT: '2020-06-01 13:00:00',
        SESSION_END: '2020-06-01 14:00:00',
        FINISHED_AT: '2020-06-01 15:00:00',
      }),
    ).toEqual({ start: 'SESSION_START', end: 'SESSION_END', server: null, platform: null });

    expect(
      resolveSessionColumns({
        STARTED_AT: '13.03.2019 20:00',
        FINISHED_AT: '13.03.2019 21:30',
        SESSION_START: '2020-06-01 12:00:00',
        SESSION_END: '2020-06-01 14:00:00',
      }),
    ).toEqual({ start: 'STARTED_AT', end: 'FINISHED_AT', server: null, platform: null });
  });
});

describe('T-04-01: the real header’s IP column is never read either', () => {
  it('changes nothing when the address changes, or the column disappears', () => {
    const withIp = buildPlaytime(
      [{ STARTED_AT: '13.03.2019 20:00', FINISHED_AT: '13.03.2019 21:30', IP: '192.0.2.77' }],
      true,
    );
    const otherIp = buildPlaytime(
      [{ STARTED_AT: '13.03.2019 20:00', FINISHED_AT: '13.03.2019 21:30', IP: '198.51.100.7' }],
      true,
    );
    const noIp = buildPlaytime(
      [{ STARTED_AT: '13.03.2019 20:00', FINISHED_AT: '13.03.2019 21:30' }],
      true,
    );

    expect(otherIp.all).toEqual(withIp.all);
    expect(noIp.all).toEqual(withIp.all);
  });

  it('keeps the address out of the resolved columns', () => {
    // The same four fields as the legacy header. `IP` is the THIRD of three
    // columns in the real header and is not among them, which is the whole of
    // T-04-27 on the file shape the real export actually ships.
    //
    // Asserted on the RESOLVED KEY IDENTITY, not on `Object.keys(...)`: the
    // returned object carries those four keys for any input, so a count or a
    // key list would pass unchanged even if a fifth target for `IP` were added
    // and then never matched. Naming the keys the columns resolved TO is what
    // fails if the header starts driving the alias list.
    const columns = resolveSessionColumns({ STARTED_AT: '', FINISHED_AT: '', IP: '' });
    expect(columns).toEqual({
      start: 'STARTED_AT',
      end: 'FINISHED_AT',
      server: null,
      platform: null,
    });
    expect(resolveSessionColumns({ STARTED_AT: '', FINISHED_AT: '', IP: '' }).server).toBeNull();
  });

  it('keeps the address out of the split surface, not just the All slice', () => {
    // The `all`-only comparison above cannot see a leak into a split value:
    // an address reaching `splitColumn`/`values`/`byValue` would change those
    // three and leave `all` identical, so the test would stay green. This
    // compares the WHOLE aggregate across three exports that differ only in
    // the address column.
    const shapes = [
      [{ STARTED_AT: '13.03.2019 20:00', FINISHED_AT: '13.03.2019 21:30', IP: '192.0.2.77' }],
      [{ STARTED_AT: '13.03.2019 20:00', FINISHED_AT: '13.03.2019 21:30', IP: '198.51.100.7' }],
      [{ STARTED_AT: '13.03.2019 20:00', FINISHED_AT: '13.03.2019 21:30' }],
    ];
    const [withIp, otherIp, noIp] = shapes.map((rows) => buildPlaytime(rows, true));

    // One game file, so no split — which is itself the assertion that the
    // address did not become a second distinct value and trip one. With no
    // split there are no values and no per-value slices at all.
    expect(withIp.splitColumn).toBeNull();
    expect(withIp.values).toEqual([]);
    expect(withIp.byValue).toEqual([]);

    // And nothing anywhere in the serialized aggregate is the address. This
    // is the check the `all`-only comparison above could never make: it walks
    // every field the worker will later answer from, so a leak into a future
    // `splitColumn` or `values` entry fails here rather than passing quietly.
    for (const aggregates of [withIp, otherIp, noIp]) {
      const serialized = JSON.stringify(aggregates);
      expect(serialized).not.toContain('192.0.2.77');
      expect(serialized).not.toContain('198.51.100.7');
      expect(serialized).not.toContain('IP');
    }

    // The whole aggregate, not just `all`, is identical across the three.
    expect(otherIp).toEqual(withIp);
    expect(noIp).toEqual(withIp);
  });
});

describe('T-04-28: a month field above 12 is excluded, never swapped with the day', () => {
  it('answers null for a day-first stamp whose month is 13', () => {
    // `13.03.2019` is the March row every answer key depends on. Read
    // month-first, `05.13.2020` would be 13 May and this cell would be a
    // perfectly ordinary March date — so the only thing standing between the
    // two readings is that an out-of-range field is rejected outright.
    expect(parseSessionTimestamp('05.13.2020 10:00')).toBeNull();
  });

  it('counts such a row as excluded rather than as a session', () => {
    const aggregates = buildPlaytime(
      [
        { STARTED_AT: '05.13.2020 10:00', FINISHED_AT: '05.13.2020 11:00' },
        { STARTED_AT: '13.03.2019 20:00', FINISHED_AT: '13.03.2019 21:30' },
      ],
      true,
    );

    expect(aggregates.all.sessions).toBe(1);
    expect(aggregates.all.excluded).toBe(1);
    expect(aggregates.all.seconds).toBe(5400);
  });

  it.each([
    ['31.02.2020 10:00', 'an impossible day'],
    ['13.13.2020 10:00', 'a month of thirteen'],
    ['13.00.2020 10:00', 'a month of zero'],
    ['00.03.2020 10:00', 'a day of zero'],
    ['13.03.2019 24:00', 'an hour of twenty-four'],
    ['13.03.2019 23:60', 'a minute of sixty'],
    ['13.03.2019 23:30:00', 'seconds the real shape does not write'],
    ['13.03.2019T23:30', 'a T separator the real shape does not write'],
    ['13.03.2019 23:30+02:00', 'a numeric offset, which names an instant'],
  ])('rejects %s (%s)', (stamp) => {
    expect(parseSessionTimestamp(stamp)).toBeNull();
  });
});
