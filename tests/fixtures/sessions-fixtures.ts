import { zipSync } from './pinned-zip.ts';

import { SAMPLE_ACCOUNT_ROOT } from './sample-account.ts';

/**
 * Seeded, PII-free Sessions.csv fixtures with an ANALYTIC answer key
 * (phase 04, plan 04-03).
 *
 * ## Why the answer key is analytic
 *
 * Plans 04-05, 04-06, 04-11 and 04-12 all need a Sessions.csv whose expected
 * aggregation is known before the aggregator runs. Two ways to get one: run
 * the aggregator and record what it said, or compute the answer from the
 * fixture's own layout. The second is the only useful option — an answer key
 * produced by the code under test agrees with it by construction and can only
 * ever catch a crash.
 *
 * So the layout below is built to be computable in closed form:
 *
 *   - base sessions are laid out BACK TO BACK across each year with strictly
 *     positive gaps, so no two of them overlap and merged playtime is simply
 *     the sum of their lengths;
 *   - a contained row is emitted strictly INSIDE one base session, so it
 *     contributes a session count and zero merged seconds;
 *   - a zero-length session is a valid row whose start equals its end.
 *
 * Everything else in `SessionsExpected` is then arithmetic over that layout.
 * The only part that is NOT closed-form-simple is `hourOverlap`, which is
 * accumulated by a deliberately naive per-hour loop rather than by the
 * implementation's whole-week peel — the point of the key is to disagree with
 * the implementation, so it must not borrow the implementation's shortcuts.
 *
 * ## Determinism
 *
 * Everything is drawn from `mulberry32(spec.seed)`, so the same spec always
 * produces byte-identical CSV. A fixture that "usually" produces the same
 * bytes is worse than no fixture: it makes a later failure look like a
 * product bug instead of a test bug. No `Date.now`, no `Math.random`, no
 * iteration over a `Set` whose insertion order carries meaning.
 *
 * ## Privacy
 *
 * Every value is fabricated, per `tests/fixtures/README.md` (fixture=
 * synthetic): the IP column is TEST-NET-1 (`192.0.2.0/24`, RFC 5737) and
 * server names are not real hostnames. Real exports must never be committed.
 */

/** The Sessions.csv header, matching the synthetic export's column names. */
export const SESSIONS_HEADER =
  'SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP';

/**
 * The IP written in every generated row. The aggregator never reads this
 * column (T-04-01); having a real-looking value in it is what makes that
 * guarantee testable rather than merely asserted.
 */
export const SESSION_FIXTURE_IP = '192.0.2.99';

const SECONDS_PER_DAY = 86_400;

const SECONDS_PER_HOUR = 3600;

/** Upper bound of an ordinary session: three hours. */
const ORDINARY_MAX_SECONDS = 3 * SECONDS_PER_HOUR;

/** Bounds of a deliberately oversized session: 16 to 20 hours. */
const LONG_MIN_SECONDS = 16 * SECONDS_PER_HOUR;
const LONG_MAX_SECONDS = 20 * SECONDS_PER_HOUR;

const HOURS_PER_DAY = 24;
const HOURS_PER_WEEK = 168;

/** Twelve duration bins, by INCLUSIVE lower bound in minutes. */
const BIN_LOWER_BOUNDS_MINUTES = [0, 1, 2, 5, 10, 20, 30, 60, 120, 240, 480, 960];

/** The CLIENT_BUILD value written on every row; the aggregator ignores it. */
const CLIENT_BUILD = '12931';

const DEFAULT_PLATFORMS = ['win32', 'macOS'] as const;

/**
 * A small, fast, fully specified 32-bit PRNG.
 *
 * Mulberry32: one 32-bit state word, no floating-point accumulation. It is
 * chosen over `Math.random()` (unseedable, so the fixture could not be
 * regenerated) and over a full library (a fixture should have no dependency
 * that can change under it).
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Render Unix seconds as the `YYYY-MM-DD HH:MM:SS` wall clock the export
 * writes, in UTC.
 *
 * Deliberately NOT `civil-date.ts`: the fixture must not share calendar
 * arithmetic with the code it is checking, or a bug in that arithmetic would
 * cancel out on both sides.
 */
export function formatWallClock(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

export interface SessionsFixtureSpec {
  /** PRNG seed. The same seed always produces byte-identical CSV. */
  seed: number;
  /** Number of base (non-contained, non-duplicated) sessions to lay out. */
  sessions: number;
  /** First calendar year covered. */
  startYear: number;
  /** How many consecutive years to spread the sessions over. */
  years: number;
  /**
   * Split values for SERVER_NAME, drawn uniformly. A `null` entry is written
   * as a BLANK cell, so the split has to cope with a missing value.
   */
  servers: readonly (string | null)[];
  /** Values for CLIENT_PLATFORM, the fallback split column. */
  platforms?: readonly string[];
  /** Share of base sessions that get a second, contained row. */
  containedRate: number;
  /** Share of base sessions whose start equals their end. */
  zeroLengthRate: number;
  /** Share of base sessions stretched to 16-20 hours. */
  longSessionRate: number;
  /** How many rows of each unreadable kind to append. */
  bad: {
    emptyEnd: number;
    endBeforeStart: number;
    garbage: number;
    impossibleDate: number;
    missingStart: number;
  };
  /** Emit one valid 1970 session, pinning the epoch floor. */
  strayEarlyYear: boolean;
}

export interface SessionsExpected {
  /** Merged playtime in seconds. */
  seconds: number;
  /** Usable sessions, including contained and zero-length ones. */
  sessions: number;
  /** Rows the aggregator must count as excluded. */
  excluded: number;
  /** Active day numbers, ascending. */
  dayIndex: number[];
  /** Merged seconds per active day, parallel to `dayIndex`. */
  daySeconds: number[];
  /** Usable sessions starting on that day, parallel to `dayIndex`. */
  daySessions: number[];
  /** Merged seconds per weekday-hour cell, by hour actually occupied. */
  hourOverlap: number[];
  /** Merged seconds per weekday-hour cell, by the hour the session started in. */
  hourStart: number[];
  /** Usable sessions per raw-duration bin. */
  bins: number[];
  /** The split the aggregator should pick, or null when neither column qualifies. */
  splitColumn: 'SERVER_NAME' | 'CLIENT_PLATFORM' | null;
  /** Split values ordered by merged seconds descending, ties ascending, null last. */
  values: (string | null)[];
  /** Merged seconds per entry of `values`. */
  valueSeconds: number[];
  /** Usable sessions per entry of `values`. */
  valueSessions: number[];
  /** Excluded rows per entry of `values`. */
  valueExcluded: number[];
  /** Active calendar years, ascending. */
  years: number[];
  /** Days on which at least one usable session starts, ascending. */
  activeDays: number[];
  /** Calendar cells the charts can draw: total days across the active years. */
  calendarCells: number;
}

/** One laid-out session, before it becomes a CSV row. */
interface LaidSession {
  start: number;
  end: number;
  server: string | null;
  platform: string;
}

/**
 * Render Sessions.csv with the export's real line-ending quirk: bare CR
 * separators, never LF. PapaParse splits on both, so a stray LF would go
 * unnoticed by a test that only checks "the CSV parsed" — it is the mixed
 * endings that a real export ships, and a fixture that quietly normalised them
 * would stop covering that.
 */
export function buildSessionsCsvFromRows(rows: readonly (readonly (string | null)[])[]): string {
  let out = SESSIONS_HEADER;
  for (const row of rows) {
    out += '\r' + row.map((cell) => cell ?? '').join(';');
  }
  return out + '\r';
}

export function buildSessionsCsv(spec: SessionsFixtureSpec): string {
  return buildSessionsCsvFromRows(layoutRows(spec));
}

/** Zip a Sessions.csv into the canonical `Activity_history` export shape. */
export function buildSessionsExportFromCsv(csv: string): Uint8Array {
  return zipSync({
    [`${SAMPLE_ACCOUNT_ROOT}/Activity_history/Sessions.csv`]: new TextEncoder().encode(csv),
  });
}

export function buildSessionsExport(spec: SessionsFixtureSpec): {
  bytes: Uint8Array;
  csv: string;
  expected: SessionsExpected;
} {
  const rows = layoutRows(spec);
  const csv = buildSessionsCsvFromRows(rows);
  return { bytes: buildSessionsExportFromCsv(csv), csv, expected: expectedFrom(spec, rows) };
}

// -----------------------------------------------------------------------------
// Layout
// -----------------------------------------------------------------------------

/** Days from the epoch to 1 January of `year`, in seconds. */
function yearStartSeconds(year: number): number {
  return Date.UTC(year, 0, 1) / 1000;
}

/**
 * The weekday-hour cell of an instant, via the platform date API.
 *
 * Cell 0 is Monday 00:00, cell 23 is Monday 23:00, cell 24 is Tuesday 00:00.
 * Independent of the implementation's arithmetic on absolute hour numbers, so
 * a wrong weekday in either place shows up as a disagreement.
 */
function cellOfInstant(seconds: number): number {
  const at = new Date(seconds * 1000);
  return ((at.getUTCDay() + 6) % 7) * HOURS_PER_DAY + at.getUTCHours();
}

function absoluteHour(seconds: number): number {
  return Math.floor(seconds / SECONDS_PER_HOUR);
}

function binOfRawLength(lengthSeconds: number): number {
  let bin = 0;
  for (let i = 0; i < BIN_LOWER_BOUNDS_MINUTES.length; i++) {
    if (lengthSeconds >= BIN_LOWER_BOUNDS_MINUTES[i]! * 60) bin = i;
  }
  return bin;
}

/**
 * Lay the fixture out, deterministically, and return its rows in file order.
 *
 * The generator draws EVERY base session's length before placing any of them,
 * so a year can be sized against its own total rather than discovered to be
 * full halfway through. Gaps are then drawn from normalised random weights
 * and the residue is handed back one second at a time, so the year's sessions
 * plus their gaps fill the year EXACTLY: no overlap, and no two sessions
 * touching.
 */
function layoutRows(spec: SessionsFixtureSpec): (string | null)[][] {
  const rand = mulberry32(spec.seed);
  const platforms = spec.platforms ?? DEFAULT_PLATFORMS;
  const services: LaidSession[] = [];

  // --- lengths, drawn before any placement -----------------------------------
  const lengths: number[] = new Array(spec.sessions);
  for (let i = 0; i < spec.sessions; i++) {
    const draw = rand();
    if (draw < spec.zeroLengthRate) {
      lengths[i] = 0;
    } else if (draw < spec.zeroLengthRate + spec.longSessionRate) {
      lengths[i] =
        LONG_MIN_SECONDS + Math.floor(rand() * (LONG_MAX_SECONDS - LONG_MIN_SECONDS + 1));
    } else {
      // Log-uniform: most sessions short, a realistic handful long.
      lengths[i] = 1 + Math.floor(ORDINARY_MAX_SECONDS ** rand());
    }
  }

  // --- placement, one pass per year ------------------------------------------
  const byYear = new Map<number, number[]>();
  for (let i = 0; i < spec.sessions; i++) {
    // Round-robin over the years rather than a contiguous block per year, so
    // every year is active no matter how few sessions there are.
    const year = spec.startYear + (i % spec.years);
    const bucket = byYear.get(year);
    if (bucket) bucket.push(i);
    else byYear.set(year, [i]);
  }

  const placed: { start: number; end: number }[] = new Array(spec.sessions);
  for (const [year, indices] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const yearStart = yearStartSeconds(year);
    const yearEnd = yearStartSeconds(year + 1);
    const gaps = drawGaps(
      rand,
      indices.length,
      yearEnd - yearStart,
      totalLength(lengths, indices),
      year,
    );

    let cursor = yearStart;
    for (let k = 0; k < indices.length; k++) {
      cursor += gaps[k]!;
      const index = indices[k]!;
      placed[index] = { start: cursor, end: cursor + lengths[index]! };
      cursor += lengths[index]!;
    }
  }

  // --- rows, in base-session index order -------------------------------------
  for (let i = 0; i < spec.sessions; i++) {
    const { start, end } = placed[i]!;
    const server = spec.servers[Math.floor(rand() * spec.servers.length)] ?? null;
    const platform = platforms[Math.floor(rand() * platforms.length)]!;
    services.push({ start, end, server, platform });

    // A contained row copies its base's split value: it is the same player on
    // the same server, so a per-value chart must not gain a second session
    // there from a duplicate.
    if (end > start && rand() < spec.containedRate) {
      const from = Math.floor(rand() * (end - start));
      const to = from + 1 + Math.floor(rand() * (end - start - from));
      services.push({ start: start + from, end: start + to, server, platform });
    }
  }

  if (spec.strayEarlyYear) {
    // A valid session on the epoch itself. It keeps `years` honest about the
    // floor and exercises a near-zero day number.
    services.push({
      start: 0,
      end: 300,
      server: spec.servers[0] ?? null,
      platform: platforms[0]!,
    });
  }

  const rows = services.map((session) => [
    formatWallClock(session.start),
    formatWallClock(session.end),
    CLIENT_BUILD,
    session.platform,
    session.server,
    SESSION_FIXTURE_IP,
  ]);

  // --- the unreadable rows ---------------------------------------------------
  // Appended last, all with the first split value so the per-value excluded
  // counter is exercised rather than always reading zero.
  const badServer = spec.servers[0] ?? null;
  const pushBad = (start: string, end: string) => {
    rows.push([start, end, CLIENT_BUILD, platforms[0]!, badServer, SESSION_FIXTURE_IP]);
  };
  for (let i = 0; i < spec.bad.emptyEnd; i++) pushBad('2020-02-15 10:00:00', '');
  for (let i = 0; i < spec.bad.impossibleDate; i++)
    pushBad('2020-02-15 10:00:00', '2020-02-30 11:00:00');
  for (let i = 0; i < spec.bad.garbage; i++) pushBad('2020-02-15 10:00:00', 'not-a-timestamp');
  for (let i = 0; i < spec.bad.endBeforeStart; i++)
    pushBad('2020-02-15 12:00:00', '2020-02-15 11:00:00');
  for (let i = 0; i < spec.bad.missingStart; i++) pushBad('', '2020-02-15 13:00:00');

  return rows;
}

function totalLength(lengths: readonly number[], indices: readonly number[]): number {
  let total = 0;
  for (const index of indices) total += lengths[index]!;
  return total;
}

/**
 * `count + 1` gaps that are each at least one second and sum to exactly
 * `free` seconds.
 *
 * The weights are random, so gaps vary from seconds to hours the way real
 * ones do; the residue loop then makes the year add up exactly, which is what
 * keeps the layout free of accidental overlaps.
 */
function drawGaps(
  rand: () => number,
  count: number,
  yearLength: number,
  usedBySessions: number,
  year: number,
): number[] {
  const free = yearLength - usedBySessions;
  if (free < count + 1) {
    throw new Error(
      `sessions fixture: year ${year} needs ${usedBySessions}s of sessions in ${yearLength}s, ` +
        `leaving no room for ${count + 1} positive gaps — lower \`sessions\` or raise \`years\``,
    );
  }
  const weights: number[] = new Array(count + 1);
  let weightTotal = 0;
  for (let i = 0; i <= count; i++) {
    weights[i] = rand();
    weightTotal += weights[i]!;
  }
  const gaps = weights.map((weight) => Math.max(1, Math.floor((weight / weightTotal) * free)));
  const used = gaps.reduce((total, gap) => total + gap, 0);
  let residue = free - used;
  for (let i = 0; residue > 0; i = (i + 1) % gaps.length) {
    gaps[i]! += 1;
    residue -= 1;
  }
  return gaps;
}

// -----------------------------------------------------------------------------
// The analytic answer key
// -----------------------------------------------------------------------------

interface ValueAggregate {
  seconds: number;
  sessions: number;
  excluded: number;
}

function expectedFrom(
  spec: SessionsFixtureSpec,
  rows: readonly (string | null)[][],
): SessionsExpected {
  const services = rows.slice(0, -badRowCount(spec)).map((row) => ({
    start: Date.parse(`${row[0]!.replace(' ', 'T')}Z`) / 1000,
    end: Date.parse(`${row[1]!.replace(' ', 'T')}Z`) / 1000,
    server: (row[4] ?? '').trim() || null,
    platform: row[3]!.trim(),
  }));

  // --- the merge sweep (the same contract the aggregator implements) ----------
  const order = services
    .map((_, index) => index)
    .sort((a, b) => services[a]!.start - services[b]!.start);
  let seconds = 0;
  const increments: number[] = new Array(services.length).fill(0);
  let covered = Number.NEGATIVE_INFINITY;
  for (const index of order) {
    const { start, end } = services[index]!;
    const increment = Math.max(0, end - Math.max(start, covered));
    increments[index] = increment;
    covered = Math.max(covered, end);
    seconds += increment;
  }

  // --- per-day ---------------------------------------------------------------
  const byDay = new Map<number, { seconds: number; sessions: number }>();
  for (const index of order) {
    const day = Math.floor(services[index]!.start / SECONDS_PER_DAY);
    const bucket = byDay.get(day) ?? { seconds: 0, sessions: 0 };
    bucket.seconds += increments[index]!;
    bucket.sessions += 1;
    byDay.set(day, bucket);
  }
  const dayIndex = [...byDay.keys()].sort((a, b) => a - b);

  // --- hour grids ------------------------------------------------------------
  const hourOverlap = new Array<number>(HOURS_PER_WEEK).fill(0);
  const hourStart = new Array<number>(HOURS_PER_WEEK).fill(0);
  const bins = new Array<number>(BIN_LOWER_BOUNDS_MINUTES.length).fill(0);
  for (const index of order) {
    const { start, end } = services[index]!;
    const increment = increments[index]!;
    if (increment > 0) {
      // Naive per-hour walk of the CLAIMED tail. No week peeling, no shared
      // helper with the implementation — the whole point is that this is a
      // different way to get the same answer. `from` tracks the first
      // uncredited second, so a tail starting mid-hour is clipped there
      // rather than at the hour boundary.
      let from = end - increment;
      for (let hour = absoluteHour(from); ; hour++) {
        const hourFrom = hour * SECONDS_PER_HOUR;
        const creditTo = Math.min(hourFrom + SECONDS_PER_HOUR, end);
        if (creditTo <= from) break;
        hourOverlap[cellOfInstant(hourFrom)] += creditTo - from;
        from = creditTo;
      }
      hourStart[cellOfInstant(start)] += increment;
    }
    bins[binOfRawLength(end - start)] += 1;
  }

  // --- split columns ---------------------------------------------------------
  const serverValues = distinctValues(services.map((service) => service.server));
  const platformValues = distinctValues(services.map((service) => service.platform));
  const splitColumn = splitIsUsable(serverValues.length)
    ? 'SERVER_NAME'
    : splitIsUsable(platformValues.length)
      ? 'CLIENT_PLATFORM'
      : null;

  let values: (string | null)[] = [];
  let valueSeconds: number[] = [];
  let valueSessions: number[] = [];
  let valueExcluded: number[] = [];
  if (splitColumn !== null) {
    const readValue = (row: readonly (string | null)[]): string | null =>
      splitColumn === 'SERVER_NAME' ? (row[4] ?? '').trim() || null : row[3]!.trim() || null;
    const readService = (service: LaidSession): string | null =>
      splitColumn === 'SERVER_NAME' ? service.server : service.platform || null;

    const aggregates = new Map<string | null, ValueAggregate>();
    const blank = (): ValueAggregate => ({ seconds: 0, sessions: 0, excluded: 0 });
    for (const index of order) {
      const value = readService(services[index]!);
      const bucket = aggregates.get(value) ?? blank();
      bucket.seconds += increments[index]!;
      bucket.sessions += 1;
      aggregates.set(value, bucket);
    }
    for (const row of rows.slice(services.length)) {
      const value = readValue(row);
      if (!aggregates.has(value)) continue;
      aggregates.get(value)!.excluded += 1;
    }

    const ranked = [...aggregates.entries()].sort(([aValue, a], [bValue, b]) => {
      if (b.seconds !== a.seconds) return b.seconds - a.seconds;
      // Ties break ascending by value, with a blank value always last so it
      // never outranks a named one on equal playtime.
      if (aValue === null) return bValue === null ? 0 : 1;
      if (bValue === null) return -1;
      return aValue < bValue ? -1 : 1;
    });
    values = ranked.map(([value]) => value);
    valueSeconds = ranked.map(([, aggregate]) => aggregate.seconds);
    valueSessions = ranked.map(([, aggregate]) => aggregate.sessions);
    valueExcluded = ranked.map(([, aggregate]) => aggregate.excluded);
  }

  // --- calendar --------------------------------------------------------------
  const years = distinctValues(dayIndex.map((day) => yearOfDay(day))).sort((a, b) => a - b);
  const calendarCells = years.reduce(
    (total, year) =>
      total + (yearStartSeconds(year + 1) - yearStartSeconds(year)) / SECONDS_PER_DAY,
    0,
  );

  return {
    seconds,
    sessions: services.length,
    excluded: rows.length - services.length,
    dayIndex,
    daySeconds: dayIndex.map((day) => byDay.get(day)!.seconds),
    daySessions: dayIndex.map((day) => byDay.get(day)!.sessions),
    hourOverlap,
    hourStart,
    bins,
    splitColumn,
    values,
    valueSeconds,
    valueSessions,
    valueExcluded,
    years,
    activeDays: dayIndex,
    calendarCells,
  };
}

function badRowCount(spec: SessionsFixtureSpec): number {
  const { emptyEnd, endBeforeStart, garbage, impossibleDate, missingStart } = spec.bad;
  return emptyEnd + endBeforeStart + garbage + impossibleDate + missingStart;
}

function yearOfDay(day: number): number {
  return Number(new Date(day * SECONDS_PER_DAY * 1000).toISOString().slice(0, 4));
}

function distinctValues<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** A split is only charted when it has enough values to be a distribution. */
function splitIsUsable(count: number): boolean {
  return count >= 2 && count <= 50;
}

// -----------------------------------------------------------------------------
// Presets
// -----------------------------------------------------------------------------

/** Default counts of each unreadable row kind. */
const DEFAULT_BAD_COUNTS: SessionsFixtureSpec['bad'] = {
  emptyEnd: 2,
  endBeforeStart: 1,
  garbage: 1,
  impossibleDate: 1,
  missingStart: 1,
};

/**
 * 5,000 sessions over twelve years. The default scale for the Activity_time
 * unit and e2e tests.
 */
export const SCALE_5K_SPEC: SessionsFixtureSpec = {
  seed: 20200601,
  sessions: 5_000,
  startYear: 2012,
  years: 12,
  servers: ['eu', 'ru', 'na', 'kr', null],
  platforms: ['win32', 'macOS'],
  containedRate: 0.2,
  zeroLengthRate: 0.02,
  longSessionRate: 0.01,
  bad: DEFAULT_BAD_COUNTS,
  strayEarlyYear: true,
};

/**
 * 60,000 sessions over the same twelve years.
 *
 * Same years and same shape as `SCALE_5K_SPEC`, so the two must agree on
 * `years` and `calendarCells`; only the row count differs. Anything about the
 * aggregate that changed with scale rather than with content would show up as
 * a disagreement between the two keys.
 */
export const SCALE_60K_SPEC: SessionsFixtureSpec = {
  ...SCALE_5K_SPEC,
  seed: 20200602,
  sessions: 60_000,
};

// -----------------------------------------------------------------------------
// Specs that force the two split-column paths 04-03 could not reach
// -----------------------------------------------------------------------------
//
// `SCALE_5K_SPEC` has five distinct SERVER_NAME values and two platforms, so
// `splitColumn` always resolves to SERVER_NAME and neither of the other two
// branches of the rule was ever exercised by a SEEDED fixture. They were
// covered by hand-built inputs in 04-05, which is the weaker kind of
// coverage: the numbers were written next to the code that produced them.
//
// These two specs close that gap. They are small, single-year and fast, and
// their `expected` is the same closed-form answer key every other spec gets,
// computed by the layout above rather than by the aggregator.

/**
 * ONE server and TWO platforms: SERVER_NAME cannot be split (one value is not
 * a split) and CLIENT_PLATFORM can, so the rule must FALL BACK to it.
 *
 * `SCALE_5K_SPEC` never reaches this branch, which is exactly why it exists.
 */
export const PLATFORM_FALLBACK_SPEC: SessionsFixtureSpec = {
  seed: 60601,
  sessions: 240,
  startYear: 2019,
  years: 1,
  servers: ['eu-1'],
  platforms: ['win32', 'macOS'],
  containedRate: 0.2,
  zeroLengthRate: 0.05,
  longSessionRate: 0.02,
  bad: DEFAULT_BAD_COUNTS,
  strayEarlyYear: false,
};

/**
 * ONE server and ONE platform: neither column reaches two distinct values, so
 * there is NO split at all and every consumer sees All only.
 *
 * This is the case the UI-SPEC answers with "no selector, no split table, no
 * overlap note, and nothing on the page saying a split is missing" — the
 * branch `buildSplitTable` has to survive with a null split.
 */
export const NO_SPLIT_SPEC: SessionsFixtureSpec = {
  seed: 60602,
  sessions: 240,
  startYear: 2019,
  years: 1,
  servers: ['eu-1'],
  platforms: ['win32'],
  containedRate: 0.2,
  zeroLengthRate: 0.05,
  longSessionRate: 0.02,
  bad: DEFAULT_BAD_COUNTS,
  strayEarlyYear: false,
};
