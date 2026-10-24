// =============================================================================
// The longest raw session (phase 13, plan 13-05, D-20).
//
// WHAT THIS FILE IS FOR
// The Overview's "Longest session" tile reads `longestSeconds` and
// `longestStart` from a playtime slice. The slice's other figures are all
// MERGED (overlapping sessions counted once), but this one is RAW: it answers
// "one login to logout", so a session the merge sweep credits ZERO seconds
// still has its own length.
//
// The distinction is the whole point, so every case below is chosen to make
// the two answers DIFFER, and each asserts both:
//   * the MERGED total (`slice.seconds`), which is the union, and
//   * the RAW figure (`slice.longestSeconds`), which is one session's length.
//
// WHY THE EXPECTATIONS ARE HAND-DERIVED
// Every stamp is invented, in the REAL export's dotted shape
// (`DD.MM.YYYY HH:MM`, day first), and every expected number is written out
// in the comment beside it. `unixOf` converts a stamp with the PLATFORM clock
// (`Date.UTC`) rather than with the aggregator's own civil-date arithmetic, so
// the expected start instants are derived by a different route from the
// implementation that produced them.
//
// The tie rule is the part most likely to rot, so it is pinned from both
// sides: a tie on two different days keeps the EARLIER start, and a tie
// inside one day keeps the same start whichever order the rows arrive in.
// =============================================================================

import { describe, expect, it } from 'vitest';

import { buildPlaytimeFromSources } from '../../../src/lib/features/playtime/playtime-aggregate';
import { PLAYTIME_VERSION } from '../../../src/lib/features/playtime/playtime-shared';
import type { SessionSource } from '../../../src/lib/features/playtime/playtime-aggregate';

/**
 * The wall-clock seconds of a dotted stamp, via the platform clock.
 *
 * `Date.UTC` and the aggregator's `daysFromCivil` agree on the day number for
 * a civil date, and the aggregator reads a stamp as wall-clock seconds with no
 * zone conversion (D-01), so this is the same instant the aggregator computes.
 */
function unixOf(stamp: string): number {
  const [date, time] = stamp.split(' ');
  const [day, month, year] = date!.split('.').map(Number);
  const [hour, minute] = time!.split(':').map(Number);
  return Date.UTC(year!, month! - 1, day!, hour!, minute!) / 1000;
}

/** One session row in the real export's header shape. */
function row(
  start: string,
  end: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return { STARTED_AT: start, FINISHED_AT: end, ...extra };
}

/** One session FILE, carrying the game its NAME would carry. */
function source(game: string | null, rows: readonly Record<string, string>[]): SessionSource {
  return { game, rows: rows as Record<string, string>[] };
}

describe('13-05: the longest raw session', () => {
  it('reports the longest of three sessions, and its start', () => {
    // 01.06  10:00 -> 11:00    3,600 s
    // 02.06  10:00 -> 12:00    7,200 s   <- the longest
    // 03.06  10:00 -> 11:30    5,400 s
    // The three days are disjoint, so the merged total is their sum.
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [
          row('01.06.2020 10:00', '01.06.2020 11:00'),
          row('02.06.2020 10:00', '02.06.2020 12:00'),
          row('03.06.2020 10:00', '03.06.2020 11:30'),
        ]),
      ],
      true,
    );

    expect(aggregates.all.longestSeconds).toBe(7_200);
    expect(aggregates.all.longestStart).toBe(unixOf('02.06.2020 10:00'));
    // The merged total is a different figure, and the tile must not read it.
    expect(aggregates.all.seconds).toBe(16_200);
  });

  it('resolves a tie of two equal-length sessions to the EARLIER start', () => {
    // 01.06  10:00 -> 12:00    7,200 s
    // 05.06  08:00 -> 10:00    7,200 s
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [
          row('01.06.2020 10:00', '01.06.2020 12:00'),
          row('05.06.2020 08:00', '05.06.2020 10:00'),
        ]),
      ],
      true,
    );

    expect(aggregates.all.longestSeconds).toBe(7_200);
    expect(aggregates.all.longestStart).toBe(unixOf('01.06.2020 10:00'));
  });

  it('resolves a tie the same way whichever order the rows arrive in', () => {
    const first = row('01.06.2020 10:00', '01.06.2020 12:00');
    const second = row('05.06.2020 08:00', '05.06.2020 10:00');

    const forwards = buildPlaytimeFromSources([source('WOT', [first, second])], true);
    const backwards = buildPlaytimeFromSources([source('WOT', [second, first])], true);

    expect(forwards.all.longestSeconds).toBe(7_200);
    expect(backwards.all.longestSeconds).toBe(7_200);
    expect(backwards.all.longestStart).toBe(forwards.all.longestStart);
    expect(forwards.all.longestStart).toBe(unixOf('01.06.2020 10:00'));
  });

  it('reports a CONTAINED session by its own raw length, never by the merged total', () => {
    // 01.06  10:00 -> 12:00    7,200 s
    // 01.06  10:30 -> 11:30    3,600 s   wholly inside the first one
    //
    // The sweep credits the second session ZERO merged seconds, so the merged
    // total is 7,200. The figure must be a session's OWN length: the raw
    // maximum is 7,200, and it is emphatically NOT the 10,800 the two raw
    // lengths would sum to.
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [
          row('01.06.2020 10:00', '01.06.2020 12:00'),
          row('01.06.2020 10:30', '01.06.2020 11:30'),
        ]),
      ],
      true,
    );

    expect(aggregates.all.seconds).toBe(7_200);
    expect(aggregates.all.sessions).toBe(2);
    expect(aggregates.all.longestSeconds).toBe(7_200);
    expect(aggregates.all.longestSeconds).not.toBe(10_800);
    expect(aggregates.all.longestStart).toBe(unixOf('01.06.2020 10:00'));
  });

  it('never reports the merged union when the union exceeds every raw length', () => {
    // 01.06  10:00 -> 11:30    5,400 s
    // 01.06  10:30 -> 11:00    1,800 s   wholly inside the first one
    // 01.06  11:00 -> 12:30    5,400 s
    //
    // The three sessions cover 10:00 -> 12:30 with no gap, so the merged
    // total is 9,000 s — MORE than any single session. The raw maximum is
    // 5,400, and the two sessions of that length tie, so the EARLIER start
    // (10:00) wins.
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [
          row('01.06.2020 10:00', '01.06.2020 11:30'),
          row('01.06.2020 10:30', '01.06.2020 11:00'),
          row('01.06.2020 11:00', '01.06.2020 12:30'),
        ]),
      ],
      true,
    );

    expect(aggregates.all.seconds).toBe(9_000);
    expect(aggregates.all.longestSeconds).toBe(5_400);
    expect(aggregates.all.longestSeconds).not.toBe(aggregates.all.seconds);
    expect(aggregates.all.longestStart).toBe(unixOf('01.06.2020 10:00'));
  });

  it('keeps a wholly contained session available as its own raw length', () => {
    // 01.06  10:00 -> 11:00    3,600 s
    // 01.06  10:00 -> 11:00    3,600 s   the SAME span, so the second is
    //                                      wholly contained in the first
    //
    // The contained session's own length IS a longest of the pair, and the
    // figure is that raw length. The merged sweep gives the second session
    // nothing, which changes neither the total nor the figure.
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [
          row('01.06.2020 10:00', '01.06.2020 11:00'),
          row('01.06.2020 10:00', '01.06.2020 11:00'),
        ]),
      ],
      true,
    );

    expect(aggregates.all.seconds).toBe(3_600);
    expect(aggregates.all.sessions).toBe(2);
    expect(aggregates.all.longestSeconds).toBe(3_600);
    expect(aggregates.all.longestStart).toBe(unixOf('01.06.2020 10:00'));
  });

  it('reports a session that crosses midnight in full, and on its START day', () => {
    // 01.06  23:30 -> 02.06 00:30    3,600 s
    // 03.06  10:00 -> 10:30       1,800 s
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [
          row('01.06.2020 23:30', '02.06.2020 00:30'),
          row('03.06.2020 10:00', '03.06.2020 10:30'),
        ]),
      ],
      true,
    );

    expect(aggregates.all.longestSeconds).toBe(3_600);
    expect(aggregates.all.longestStart).toBe(unixOf('01.06.2020 23:30'));
    // The day number of the START, not of the end: the tile names the day the
    // session began.
    expect(Math.floor(aggregates.all.longestStart! / 86_400)).toBe(
      Math.floor(unixOf('01.06.2020 00:00') / 86_400),
    );
    expect(Math.floor(aggregates.all.longestStart! / 86_400)).not.toBe(
      Math.floor(unixOf('02.06.2020 00:00') / 86_400),
    );
  });

  it('reports 0 seconds and the earliest start when every session is zero-length', () => {
    // 01.06  10:00 -> 10:00    0 s
    // 03.06  14:00 -> 14:00    0 s
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [
          row('01.06.2020 10:00', '01.06.2020 10:00'),
          row('03.06.2020 14:00', '03.06.2020 14:00'),
        ]),
      ],
      true,
    );

    expect(aggregates.all.sessions).toBe(2);
    expect(aggregates.all.longestSeconds).toBe(0);
    expect(aggregates.all.longestStart).toBe(unixOf('01.06.2020 10:00'));
  });

  it('lets any non-zero session beat a zero-length one', () => {
    // 01.06  10:00 -> 10:00    0 s
    // 03.06  14:00 -> 14:01   60 s
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [
          row('01.06.2020 10:00', '01.06.2020 10:00'),
          row('03.06.2020 14:00', '03.06.2020 14:01'),
        ]),
      ],
      true,
    );

    expect(aggregates.all.longestSeconds).toBe(60);
    expect(aggregates.all.longestStart).toBe(unixOf('03.06.2020 14:00'));
  });

  it('reports 0 and 0 for a slice with no usable session at all', () => {
    // The row has no end, so it is EXCLUDED and counted, never turned into a
    // session. The aggregate is otherwise a valid one.
    const aggregates = buildPlaytimeFromSources(
      [source('WOT', [row('01.06.2020 10:00', '')])],
      true,
    );

    expect(aggregates.v).toBe(PLAYTIME_VERSION);
    expect(aggregates.sessionsFileSeen).toBe(true);
    expect(aggregates.all.sessions).toBe(0);
    expect(aggregates.all.excluded).toBe(1);
    expect(aggregates.all.longestSeconds).toBe(0);
    expect(aggregates.all.longestStart).toBe(0);
  });

  it('gives each per-game scope its own longest session, never the other game’s', () => {
    // WOT   01.06  10:00 -> 12:00    7,200 s
    // WOTB  01.06  10:00 -> 11:00    3,600 s
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [row('01.06.2020 10:00', '01.06.2020 12:00')]),
        source('WOTB', [row('01.06.2020 10:00', '01.06.2020 11:00')]),
      ],
      true,
    );

    expect(aggregates.games).toEqual(['WOT', 'WOTB']);
    const wot = aggregates.byGame!.find((entry) => entry.game === 'WOT')!;
    const wotb = aggregates.byGame!.find((entry) => entry.game === 'WOTB')!;

    expect(wot.scope.all.longestSeconds).toBe(7_200);
    expect(wot.scope.all.longestStart).toBe(unixOf('01.06.2020 10:00'));
    expect(wotb.scope.all.longestSeconds).toBe(3_600);
    expect(wotb.scope.all.longestStart).toBe(unixOf('01.06.2020 10:00'));
    // Neither scope borrowed the other's figure.
    expect(wot.scope.all.longestSeconds).not.toBe(wotb.scope.all.longestSeconds);
  });

  it('gives each split value its own longest session', () => {
    // One file, two servers: the split column is SERVER_NAME (GAME holds a
    // single value, so it cannot be a split).
    // eu-1  01.06  10:00 -> 12:00    7,200 s
    // na-1  02.06  09:00 -> 09:30    1,800 s
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [
          row('01.06.2020 10:00', '01.06.2020 12:00', { SERVER_NAME: 'eu-1' }),
          row('02.06.2020 09:00', '02.06.2020 09:30', { SERVER_NAME: 'na-1' }),
        ]),
      ],
      true,
    );

    expect(aggregates.splitColumn).toBe('SERVER_NAME');
    expect(aggregates.values).toEqual(['eu-1', 'na-1']);

    expect(aggregates.byValue[0]!.longestSeconds).toBe(7_200);
    expect(aggregates.byValue[0]!.longestStart).toBe(unixOf('01.06.2020 10:00'));
    expect(aggregates.byValue[1]!.longestSeconds).toBe(1_800);
    expect(aggregates.byValue[1]!.longestStart).toBe(unixOf('02.06.2020 09:00'));
  });

  it('never lets an excluded row affect the longest session', () => {
    // One usable session of 7,200 s, and three rows that cannot be read:
    // an end before the start, an unparseable end, and no end at all. The
    // first of those would be a 10-hour session if it were read, so it is the
    // row that would break the figure if the exclusion were applied late.
    const aggregates = buildPlaytimeFromSources(
      [
        source('WOT', [
          row('01.06.2020 10:00', '01.06.2020 12:00'),
          row('02.06.2020 10:00', '02.06.2020 08:00'),
          row('03.06.2020 10:00', 'not-a-timestamp'),
          row('04.06.2020 10:00', ''),
        ]),
      ],
      true,
    );

    expect(aggregates.all.sessions).toBe(1);
    expect(aggregates.all.excluded).toBe(3);
    expect(aggregates.all.longestSeconds).toBe(7_200);
    expect(aggregates.all.longestStart).toBe(unixOf('01.06.2020 10:00'));
  });
});
