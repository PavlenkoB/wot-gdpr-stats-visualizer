// =============================================================================
// Independent playtime oracle (phase 04, plan 04-03).
//
// WHAT THIS IS FOR
// The aggregator in `src/lib/worker/playtime.ts` sweeps sessions in start
// order, keeping a single `covered` watermark, and peels whole weeks out of
// the weekday-hour grid. Both are compact — and both are exactly the kind of
// shortcut that can be wrong in a way its own tests never notice, because a
// test written next to the shortcut tends to reproduce the shortcut.
//
// So this module recomputes the same numbers a deliberately naive way, and
// nothing here is allowed to import the implementation:
//
//   * OVERLAP is resolved with a per-second `Uint8Array` bitmap instead of a
//     watermark. Every second is looked at on its own, so an off-by-one in the
//     watermark sweep shows up as a disagreement instead of cancelling out.
//   * The weekday-hour cell is derived with `Date` + `getUTCDay()` instead of
//     the implementation's arithmetic on absolute hour numbers.
//   * The day index is built with a `Map` in a second pass, not by a
//     last-entry-equals comparison inside a single sweep.
//
// The two implementations are written from different primitives on purpose:
// this file is useful only while it is able to disagree with the thing it
// checks. Keep it that way — do NOT "simplify" it to match the production
// code.
//
// Only usable sessions go in. A row whose start or end is missing, unparseable
// or inverted is an EXCLUDED ROW, not a session: the production importer
// counts it in `slice.excluded` and never hands it to the aggregator, and the
// oracle would disagree for the wrong reason if it saw one. Feeding excluded
// rows in is a bug in the CALLER, not something the oracle filters for you.
//
// The only import is the seeded PRNG, which is a property of the test data and
// not of the aggregation.
// =============================================================================

import { mulberry32 } from '../fixtures/sessions-fixtures';

/** Twelve duration bins; index 11 is the open-ended "16 hours and over" bucket. */
const BIN_COUNT = 12;

/** The 168 weekday-hour cells a PlaytimeSlice grid is laid out as. */
const CELL_COUNT = 168;

const HOURS_PER_DAY = 24;

const SECONDS_PER_HOUR = 3600;

const SECONDS_PER_DAY = 86400;

/**
 * A naive oracle can only afford one mark per second, so a single session
 * spanning more than this refuses to run rather than allocating gigabytes.
 * 400 days is far beyond anything the tests legitimately need; a session that
 * long is covered by a direct sum check against `slice.hourOverlap` instead.
 */
const MAX_ORACLE_SECONDS = 400 * SECONDS_PER_DAY;

export interface OracleSession {
  /** Unix seconds. */
  start: number;
  /** Unix seconds, never earlier than `start`. */
  end: number;
}

export interface OracleSlice {
  /** Merged playtime: the size of the union of all session intervals. */
  seconds: number;
  /** Count of usable sessions, including any that merged to zero seconds. */
  sessions: number;
  /** Active day numbers, ascending. */
  dayIndex: number[];
  /** Merged seconds attributed to each session's START day, parallel to `dayIndex`. */
  daySeconds: number[];
  /** Usable sessions starting on that day, parallel to `dayIndex`. */
  daySessions: number[];
  /** Merged seconds per weekday-hour cell, attributed to the hours they actually occupy. */
  hourOverlap: number[];
  /** Merged seconds per weekday-hour cell, attributed to the session's START hour. */
  hourStart: number[];
  /** Usable sessions per raw-duration bin. */
  bins: number[];
}

function emptySlice(): OracleSlice {
  return {
    seconds: 0,
    sessions: 0,
    dayIndex: [],
    daySeconds: [],
    daySessions: [],
    hourOverlap: new Array<number>(CELL_COUNT).fill(0),
    hourStart: new Array<number>(CELL_COUNT).fill(0),
    bins: new Array<number>(BIN_COUNT).fill(0),
  };
}

/**
 * The weekday-hour cell of an instant, via the platform date API.
 *
 * Cell 0 is Monday 00:00, cell 23 is Monday 23:00, cell 24 is Tuesday 00:00.
 * The implementation reaches the same answer by arithmetic on absolute hour
 * numbers, which is why the two can catch each other.
 */
function cellOfInstant(seconds: number): number {
  const at = new Date(seconds * 1000);
  const mondayFirst = (at.getUTCDay() + 6) % 7;
  return mondayFirst * HOURS_PER_DAY + at.getUTCHours();
}

/** The day number (floor(unixSeconds / 86400)) of an instant. */
function dayOfInstant(seconds: number): number {
  return Math.floor(seconds / SECONDS_PER_DAY);
}

/**
 * Duration-bin membership from twelve lower bounds, written in MINUTES.
 *
 * The production `binOf` walks a list of upper bounds from a different
 * direction. A lower bound is inclusive, so exactly 600s lands in the 10-20
 * minute bucket there and here.
 */
const BIN_LOWER_BOUNDS_MINUTES = [0, 1, 2, 5, 10, 20, 30, 60, 120, 240, 480, 960];

function binOfRawLength(lengthSeconds: number): number {
  let bin = 0;
  for (let i = 0; i < BIN_LOWER_BOUNDS_MINUTES.length; i++) {
    if (lengthSeconds >= BIN_LOWER_BOUNDS_MINUTES[i]! * 60) bin = i;
  }
  return bin;
}

/**
 * Recompute a PlaytimeSlice from a set of usable sessions, naively.
 *
 * Sessions may arrive in any order; they are sorted by start time first, the
 * same way the aggregator sorts them.
 */
export function oracleSlice(sessions: readonly OracleSession[]): OracleSlice {
  if (sessions.length === 0) return emptySlice();

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const session of sessions) {
    if (session.start < min) min = session.start;
    if (session.end > max) max = session.end;
  }
  const span = max - min;
  if (span > MAX_ORACLE_SECONDS) {
    throw new Error(
      `oracleSlice: fixture spans ${span}s, above the ${MAX_ORACLE_SECONDS}s bitmap limit`,
    );
  }

  // One mark per second, the whole session set. Marking is what merges
  // overlaps: a second already marked by an earlier session is not counted
  // again.
  const marked = new Uint8Array(span);
  const ordered = [...sessions].sort((a, b) => a.start - b.start);
  const byDay = new Map<number, { seconds: number; sessions: number }>();
  const hourStart = new Array<number>(CELL_COUNT).fill(0);
  const bins = new Array<number>(BIN_COUNT).fill(0);

  let seconds = 0;
  for (const session of ordered) {
    let fresh = 0;
    for (let at = session.start; at < session.end; at++) {
      const index = at - min;
      if (marked[index] === 0) {
        marked[index] = 1;
        fresh++;
      }
    }
    seconds += fresh;

    // A session counts as a session on its start day even when every one of
    // its seconds was already covered.
    const day = dayOfInstant(session.start);
    const bucket = byDay.get(day) ?? { seconds: 0, sessions: 0 };
    bucket.seconds += fresh;
    bucket.sessions += 1;
    byDay.set(day, bucket);

    hourStart[cellOfInstant(session.start)] += fresh;
    bins[binOfRawLength(session.end - session.start)] += 1;
  }

  // The overlap grid is read off the bitmap in a second pass, so it can only
  // describe seconds somebody actually claimed.
  const hourOverlap = new Array<number>(CELL_COUNT).fill(0);
  for (let index = 0; index < span; index++) {
    if (marked[index] === 1) hourOverlap[cellOfInstant(min + index)] += 1;
  }

  const dayIndex = [...byDay.keys()].sort((a, b) => a - b);
  return {
    seconds,
    sessions: ordered.length,
    dayIndex,
    daySeconds: dayIndex.map((day) => byDay.get(day)!.seconds),
    daySessions: dayIndex.map((day) => byDay.get(day)!.sessions),
    hourOverlap,
    hourStart,
    bins,
  };
}

/**
 * A seeded stream of deliberately hostile session intervals.
 *
 * The hand-written cases above pin down the shapes a person thought of. What
 * they cannot do is find the case nobody thought of, so this generator aims
 * the sweep at the boundaries instead: zero-length sessions, sessions that
 * touch exactly, sessions that share a single second, and sessions long
 * enough to cross several hour cells.
 *
 * The stream is `mulberry32`, the same PRNG the CSV fixture uses, so a failing
 * seed reproduces exactly. Sessions are laid out inside a `days`-day window
 * and then WRAPPED back to its start, so the tail of one lap overlaps the
 * head of the next: that is what produces a non-monotonic session list whose
 * only correct order is by start time, which a sweep that trusts file order
 * would get wrong. The oracle sorts, so it is unaffected.
 */
export function randomSessions(seed: number, count: number, days = 30): OracleSession[] {
  const rand = mulberry32(seed);
  const sessions: OracleSession[] = [];
  const window = days * SECONDS_PER_DAY;
  let cursor = SECONDS_PER_DAY;
  for (let i = 0; i < count; i++) {
    const roll = rand();
    // One in sixteen sessions has no duration at all; most stop within two
    // hours; the rest run seven hours, long enough to span several hour cells
    // and land the week-peel in `addHourOverlap` territory.
    const length =
      roll < 1 / 16
        ? 0
        : roll < 0.85
          ? Math.floor(rand() * 2 * SECONDS_PER_HOUR)
          : 7 * SECONDS_PER_HOUR;
    sessions.push({ start: cursor, end: cursor + length });
    // A short gap produces exact touches and single shared seconds; a long one
    // leaves the sessions completely disjoint.
    const gap = rand() < 0.5 ? Math.floor(rand() * 3) : Math.floor(rand() * 6 * SECONDS_PER_HOUR);
    cursor += length + gap;
    if (cursor >= SECONDS_PER_DAY + window) cursor = SECONDS_PER_DAY;
  }
  return sessions;
}
