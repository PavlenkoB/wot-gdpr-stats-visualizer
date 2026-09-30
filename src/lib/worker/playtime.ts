/**
 * Playtime aggregation over the parsed rows of the export's session files.
 *
 * ## Why this exists
 *
 * - **D-01 — wall clock, no zone.** Every timestamp is the clock the game
 *   recorded, in whatever zone the player was in. It is read as
 *   "wall-clock seconds since 1970-01-01T00:00:00" and never converted, so a
 *   day bucket is the calendar day the player played on. `civil-date.ts` does
 *   the calendar arithmetic for the same reason.
 * - **D-02 — merged, not summed.** A player can have two sessions at once
 *   (two clients, or a reconnect that overlaps). Adding their durations would
 *   invent playtime the player never had, so overlapping sessions are swept
 *   with a covered-until marker and each second is counted once.
 * - **T-04-01 — the IP column is never read.** Every session file carries an
 *   `IP` column and the viewer is a privacy tool, so the aggregator names
 *   exactly
 *   four columns and reads values by direct property access on those keys. No
 *   "pass the whole row" helper exists here for an IP to slip through, and
 *   nothing that reaches Dexie is a row.
 *
 * ## What a real export evidences, and what it does not
 *
 * Read off the real account export inspected on 2021-10-12, and mirrored by
 * `tests/fixtures/playtime-real-shape-fixture.ts`:
 *
 *   - playtime lives in PER-GAME files, `Activity_history/{WOT,WOTB,WOWS}_
 *     Game_Sessions.csv`, not in one `Sessions.csv` — hence
 *     {@link sessionFileGame}, which reads the game token out of the name;
 *   - the header is `STARTED_AT;FINISHED_AT;IP` — hence the two aliases in
 *     {@link resolveSessionColumns} beside the synthetic fixture's
 *     `SESSION_START` / `SESSION_END`;
 *   - timestamps are written `DD.MM.YYYY HH:MM`, dotted and DAY FIRST — hence
 *     the second shape in {@link parseSessionTimestamp}.
 *
 * Still evidenced only by the synthetic fixture, because the real export does
 * not carry them: `SERVER_NAME` and `CLIENT_PLATFORM`. A real export's split is
 * therefore `GAME`, named by the file the rows came from (04-15) — and only
 * when more than one game file holds usable sessions; a single game is not a
 * split, so a one-game export shows All with no selector and says nothing about
 * which game its lone file holds.
 *
 * A column whose name matches neither spelling still reads as `null` and every
 * session is excluded rather than silently mis-bucketed (D-02).
 *
 * This module is pure: no `Date`, no worker globals, no `self`.
 */

import { daysFromCivil, daysInMonth, weekdayOfDay } from '../civil-date';
import {
  DURATION_BIN_COUNT,
  DURATION_BIN_EDGES_SECONDS,
  HOUR_CELL_COUNT,
  MAX_SPLIT_VALUES,
  PLAYTIME_VERSION,
  SPLIT_COLUMNS,
  type SplitColumn,
} from '../playtime-shared';
import type { PlaytimeAggregates, PlaytimeSlice, PlaytimeView } from '../types/worker-messages';

/** One parsed data row of a session file, keyed by the header cells as written. */
export type SessionRow = Readonly<Record<string, string | undefined>>;

/** A session with a usable start and end, as wall-clock seconds since the epoch. */
interface UsableSession {
  start: number;
  end: number;
}

/**
 * A usable session carrying the two split values read beside it.
 *
 * The values are normalised at read time (trimmed, blank to null) and are
 * never re-derived, so a value the user can select and a value the chart is
 * bucketed by are the same string by construction.
 */
export interface SplitSession extends UsableSession {
  /**
   * The game of the FILE this row came from, or null when the file names none.
   *
   * Read as the `GAME` split column since 04-15. It comes from the file NAME
   * and never from a cell, so the selector's label is a claim the export itself
   * makes (T-04-27).
   */
  game: SessionGame;
  server: string | null;
  platform: string | null;
}

/**
 * The four session-file columns this module reads, and the shape plan 04-03
 * and 04-06 index by.
 *
 * Each entry holds the ACTUAL key string from the file, or null when the
 * column is absent. Values are then read by direct property access on that
 * key, which is what makes a padded or oddly-cased header work: the match is
 * `trim` plus upper-case, so ` session_start ` resolves to
 * `row[' session_start ']` and never to a trimmed, invented key.
 */
export interface SessionColumns {
  start: string | null;
  end: string | null;
  server: string | null;
  platform: string | null;
}

/**
 * The synthetic fixture's timestamp shape, anchored end to end with no nested
 * quantifiers, so a hostile 100 KB cell cannot trigger catastrophic
 * backtracking (RESEARCH Pitfall 3 — the same reason the ingest parser bounds
 * cell length).
 *
 * The trailing `Z` is optional and a NUMERIC OFFSET IS NOT ACCEPTED: an
 * offset would mean an instant, and D-01 rules instants out. A cell that
 * carries one is treated as unusable rather than converted.
 */
const ISO_TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/;

/**
 * The REAL export's timestamp shape: `DD.MM.YYYY HH:MM`, two-digit day, dot,
 * two-digit month, dot, four-digit year, one space, then hours and minutes
 * with NO seconds and no zone.
 *
 * DAY FIRST, which is the whole risk in this pattern (T-04-28). A month-first
 * reading would be a one-character change and would silently bucket playtime
 * on the wrong days for every row whose day is 13 or above, and would move
 * `02.11.2020` to 11 February. The two shapes are therefore separate
 * anchored patterns and the field ORDER is explicit in each, rather than one
 * pattern with the order left to a reader.
 *
 * Anchored with no nested quantifiers, for the same reason as the ISO shape.
 */
const DOTTED_TIMESTAMP_RE = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/;

/**
 * Read one session-file timestamp as wall-clock seconds since
 * 1970-01-01T00:00:00, or null when it is missing or not a plain local
 * wall-clock stamp.
 *
 * Both shapes are read and NEITHER is converted: D-01 holds the clock the game
 * recorded, so the same string is the same instant whatever the viewer's zone.
 *
 * The calendar fields are range-checked, not just shape-checked, so
 * `2020-02-30` and `2020-13-01` are null rather than rolling over into the
 * neighbouring month the way `Date` would. The check is SHARED by both shapes
 * (see {@link wallClockSeconds}), so the dotted shape cannot drift into
 * accepting an impossible date the ISO shape rejects — and, per T-04-28, a
 * month field above 12 is EXCLUDED and counted, never swapped with the day.
 */
export function parseSessionTimestamp(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const text = raw.trim();
  const iso = ISO_TIMESTAMP_RE.exec(text);
  if (iso !== null) {
    return wallClockSeconds(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3]),
      Number(iso[4]),
      Number(iso[5]),
      Number(iso[6]),
    );
  }
  const dotted = DOTTED_TIMESTAMP_RE.exec(text);
  if (dotted === null) return null;
  // Seconds are zero: the real shape carries no seconds at all.
  return wallClockSeconds(
    Number(dotted[3]),
    Number(dotted[2]),
    Number(dotted[1]),
    Number(dotted[4]),
    Number(dotted[5]),
    0,
  );
}

/**
 * Range-checked calendar fields to wall-clock seconds, the ONE conversion both
 * timestamp shapes share.
 *
 * The checks are the aggregator's own, so `31.02.2020`, `13.13.2020`,
 * `24:00` and `23:60` are all null whichever shape carried them. Nothing here
 * constructs a `Date`, so no value can be shifted by a zone the viewer happens
 * to be in (D-01).
 */
function wallClockSeconds(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return daysFromCivil(year, month, day) * 86400 + hour * 3600 + minute * 60 + second;
}

/**
 * The real export's per-game session file ending, and the token that precedes
 * it: one to 24 characters of letters, digits and underscore.
 *
 * ONE anchored single-class pattern with no nested quantifier, for the same
 * reason {@link ISO_TIMESTAMP_RE} is anchored (RESEARCH Pitfall 3): a hostile
 * 100 KB file name must not be able to trigger catastrophic backtracking. The
 * length bound is what keeps the name a name — a 25-character token is a
 * something-else file, not a game.
 */
const GAME_SESSIONS_FILE_RE = /^([A-Za-z0-9_]{1,24})_game_sessions\.csv$/;

/**
 * The game a session FILE NAME carries, or null when the name is not a session
 * file's.
 *
 * The name rules with no folder check, so the backfill can screen the stored
 * `sourceFile` index by name alone (one indexed read per candidate) and only
 * then ask the full predicate about the row's own category.
 *
 * Two shapes, and null means "not a session file" for both:
 *   - `sessions.csv`, the synthetic fixture's single file, whose game is null
 *     because its name names no game;
 *   - `<GAME>_game_sessions.csv`, the real export's per-game files, whose game
 *     is the upper-cased token — `WOT`, `WOTB`, `WOWS`, `WOWP_19`.
 *
 * Everything else is null: the `.xlsx` duplicate the export ships beside the
 * csv, a `._`-prefixed sidecar (the classifier rejects those before this runs,
 * and a `.` is not in the token class anyway), a `.bak` backup, a name with no
 * token, a token too long, and a token with a space, a hyphen or an angle
 * bracket in it. The game comes from the FILE NAME and never from a cell, so
 * no untrusted cell text can reach a label (T-04-27).
 */
export function sessionFileNameGame(sourceFile: string): string | null {
  const name = sourceFile.toLowerCase();
  if (name === 'sessions.csv') return null;
  const match = GAME_SESSIONS_FILE_RE.exec(name);
  return match === null ? null : match[1]!.toUpperCase();
}

/**
 * The game a stored row's file carries, or null when the row is not a session
 * row at all.
 *
 * The folder is still `Activity_history`, compared case-insensitively, and only
 * the BASENAME is matched — so a `Sessions.csv` in any other folder is not
 * mistaken for this one, and a session file nested one folder deeper is not
 * either (the import path stores only the basename).
 *
 * `null` is deliberately overloaded and {@link isSessionsRow} is the predicate
 * that separates the two cases, because a caller that wants a LABEL wants null
 * and a caller that wants to know whether the row is session data wants the
 * boolean. Reading the wrong one of the two is a bug a reviewer can see.
 */
export function sessionFileGame(category: string, sourceFile: string): string | null {
  if (category.toLowerCase() !== 'activity_history') return null;
  return sessionFileNameGame(sourceFile);
}

/**
 * True when this file is a session file of EITHER kind the charts are built
 * from: the synthetic fixture's `Sessions.csv` or a real `<GAME>_Game_Sessions
 * .csv`.
 *
 * The truthiness of {@link sessionFileGame}, kept as its own name because every
 * existing caller and every existing test asks this question, not the label
 * question. Note that `sessionFileGame` answers null both for "not a session
 * file" and for "the legacy `Sessions.csv`, which names no game" — so this
 * boolean, and never the game's nullability, is what says whether the file is
 * session data.
 */
export function isSessionsRow(category: string, sourceFile: string): boolean {
  return (
    sessionFileGame(category, sourceFile) !== null || isLegacySessionsFile(category, sourceFile)
  );
}

/**
 * True for the synthetic fixture's `Sessions.csv` in the right folder, which is
 * the one case `sessionFileGame` cannot report through its return value: the
 * name is a session file's, but it names no game, and the return value of null
 * is also what "not a session file" answers.
 */
function isLegacySessionsFile(category: string, sourceFile: string): boolean {
  return (
    category.toLowerCase() === 'activity_history' && sourceFile.toLowerCase() === 'sessions.csv'
  );
}

/**
 * The BASENAME half of the same rule, for the backfill's name-only screen in
 * `db.ts`, which has an index of `sourceFile` values but no row to hand a
 * category to. Exported so the legacy name is spelled once: a second legacy
 * shape added here reaches the backfill screen too, instead of drifting.
 */
export function isLegacySessionsFileName(sourceFile: string): boolean {
  return sourceFile.toLowerCase() === 'sessions.csv';
}

/** The header cell as a comparable key: trimmed and upper-cased. */
function headerKey(name: string): string {
  return name.trim().toUpperCase();
}

/**
 * Resolve the four columns from the KEYS of one row, first match wins.
 *
 * Only the first row is inspected, so a file whose later rows carry extra
 * columns cannot change which column is which. When a column is missing the
 * key is null and every session is excluded — the honest outcome, because a
 * guessed column name would bucket playtime by the wrong thing (D-02).
 */
export function resolveSessionColumns(row: SessionRow): SessionColumns {
  const columns: SessionColumns = { start: null, end: null, server: null, platform: null };
  // Each target carries its ACCEPTED SPELLINGS. The synthetic fixture's
  // `SESSION_START`/`SESSION_END` and the real export's
  // `STARTED_AT`/`FINISHED_AT` are aliases for one field, not two candidates
  // for it: a header carrying both is a hybrid, and the loop below resolves
  // whichever key appears FIRST IN THE ROW rather than by the order of the
  // arrays, so a hybrid file reads the column that actually holds the data.
  // The array order is therefore not meaningful — reordering it changes
  // nothing.
  const targets: [readonly string[], keyof SessionColumns][] = [
    [['SESSION_START', 'STARTED_AT'], 'start'],
    [['SESSION_END', 'FINISHED_AT'], 'end'],
    [['SERVER_NAME'], 'server'],
    [['CLIENT_PLATFORM'], 'platform'],
  ];
  for (const key of Object.keys(row)) {
    const normalized = headerKey(key);
    for (const [names, field] of targets) {
      if (columns[field] === null && names.includes(normalized)) columns[field] = key;
    }
  }
  return columns;
}

/** Read one cell through a resolved column key, or undefined when absent. */
function cell(row: SessionRow, key: string | null): string | undefined {
  return key === null ? undefined : row[key];
}

/**
 * One split value, normalised: a trimmed string, or null for "blank".
 *
 * Three different cells all mean blank and are therefore ONE value, not
 * three: an absent column, a missing cell and a whitespace-only cell. No case
 * folding — `EU-1` and `eu-1` are two servers, because the export's server
 * names are opaque identifiers and folding them would merge a value the
 * export never claimed to be one.
 */
function splitValue(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

/**
 * The values a session-or-excluded-row shape carries for the three split
 * columns.
 *
 * Named rather than written as `SplitSession | ExcludedRow` because the excluded
 * row is not a session: it has no start and no end, only the values the split
 * groups and counts by.
 */
type SplitValues = Pick<SplitSession, 'game' | 'server' | 'platform'>;

/**
 * One split value, from a session OR an excluded row, by column.
 *
 * The ONE place a column is matched to its value. It was three conditionals of
 * the shape `column === 'SERVER_NAME' ? row.server : row.platform` — in the
 * split choice, in the grouping and in the per-value excluded count — and a
 * second column added to a pair of those would have silently grouped by the
 * wrong one.
 *
 * The switch is exhaustive and the return type excludes `undefined`, so adding
 * a fourth column to `SplitColumn` is a COMPILE error here until this function
 * handles it: `tsc` reports a function that lacks an ending return statement.
 */
function splitValueOf(row: SplitValues, column: SplitColumn): string | null {
  switch (column) {
    case 'GAME':
      return row.game;
    case 'SERVER_NAME':
      return row.server;
    case 'CLIENT_PLATFORM':
      return row.platform;
  }
}

/**
 * Which session-file column the split groups on (D-03, UI-SPEC section 3).
 *
 * The first column of `SPLIT_COLUMNS` — `GAME`, then `SERVER_NAME`, then
 * `CLIENT_PLATFORM` — with between 2 and `MAX_SPLIT_VALUES` distinct values
 * among USABLE sessions. Null when none qualifies, and there is then no
 * selector, no split table and nothing on the page saying a split is
 * missing: every chart simply shows All.
 *
 * `GAME` leads because the real export names the game in the session FILE's
 * name, and that is the only one of the three columns the real header has. A
 * legacy `Sessions.csv` names no game, so every one of its sessions carries a
 * null game: ONE distinct value, which is not a split, so `GAME` cannot take a
 * legacy export over on its own and the rule falls through to `SERVER_NAME` and
 * `CLIENT_PLATFORM` exactly as it did before 04-15. One real game file is the
 * same case — one value, no split and no message about it.
 *
 * Only usable sessions are counted. A value that appears on excluded rows
 * and on no usable session is not a value, so it cannot make a column look
 * splittable (RESEARCH A6), and a blank value counts as ONE value — which is
 * why "every row is blank" is not a split but "one blank plus one server" is.
 *
 * Counting STOPS the moment the set exceeds the cap (T-04-12), so a column
 * with a million distinct values costs the same memory as one with fifty-one.
 * That is also why the cap is inclusive: 50 distinct values is a usable
 * split, 51 is not.
 */
export function chooseSplit(sessions: readonly SplitSession[]): SplitColumn | null {
  for (const column of SPLIT_COLUMNS) {
    const distinct = new Set<string | null>();
    for (const session of sessions) {
      distinct.add(splitValueOf(session, column));
      if (distinct.size > MAX_SPLIT_VALUES) break;
    }
    if (distinct.size >= 2 && distinct.size <= MAX_SPLIT_VALUES) return column;
  }
  return null;
}

/** One split value and the slice its sessions aggregate to. */
interface SplitEntry {
  value: string | null;
  slice: PlaytimeSlice;
}

/**
 * Rank split values by merged seconds descending, ties ascending by the plain
 * code-unit comparison, with a blank value last among ties.
 *
 * The comparison is `<` and `>`, never `localeCompare`: a locale-aware
 * comparison depends on the VIEWER's locale, which would make the stored
 * order — and therefore the selector order, the split table order and every
 * index into `byValue` — differ between two people looking at one export.
 */
function compareSplitEntries(a: SplitEntry, b: SplitEntry): number {
  if (b.slice.seconds !== a.slice.seconds) return b.slice.seconds - a.slice.seconds;
  if (a.value === null) return b.value === null ? 0 : 1;
  if (b.value === null) return -1;
  return a.value < b.value ? -1 : 1;
}

/**
 * The weekday-hour cell an absolute hour number falls in.
 *
 * Cell 0 is Monday 00:00, cell 23 is Monday 23:00, cell 24 is Tuesday 00:00.
 * `Math.floor` on both divisions keeps pre-1970 instants on the same grid
 * rather than letting a negative truncation pull them into the wrong day.
 */
export function cellOfHour(absHour: number): number {
  const day = Math.floor(absHour / 24);
  return weekdayOfDay(day) * 24 + (absHour - day * 24);
}

/**
 * Credit the inclusive range `[from, to)` to the weekday-hour cells it covers.
 *
 * A range is clipped at both ends and the fully-covered hours in between are
 * credited `3600` each, because a full hour cell can only be fully covered by
 * an hour inside the range. Long sessions then take the cheap route: a
 * contiguous run of whole weeks lands exactly one `3600` in each of the 168
 * cells, so `weeks * 3600` is added to every cell in a single pass instead of
 * once per hour. The part of the run that is not a whole number of weeks falls
 * through to the per-hour loop.
 *
 * This is the ONLY place a range touches the overlap grid. The two callers
 * are a single hour (double-clipped on purpose — see `aggregateSlice`) and a
 * session's claimed tail.
 */
export function addHourOverlap(grid: number[], from: number, to: number): void {
  if (to <= from) return;
  const first = Math.floor(from / 3600);
  const last = Math.floor((to - 1) / 3600);
  if (first === last) {
    grid[cellOfHour(first)]! += to - from;
    return;
  }
  grid[cellOfHour(first)]! += (first + 1) * 3600 - from;
  grid[cellOfHour(last)]! += to - last * 3600;

  const interior = last - first - 1;
  const weeks = Math.floor(interior / HOUR_CELL_COUNT);
  if (weeks > 0) {
    for (let cell = 0; cell < HOUR_CELL_COUNT; cell++) grid[cell]! += weeks * 3600;
  }
  const skip = weeks * HOUR_CELL_COUNT;
  for (let hour = first + 1 + skip; hour <= last - 1; hour++) grid[cellOfHour(hour)]! += 3600;
}

/**
 * The duration bin a raw session length falls in.
 *
 * Each entry of `DURATION_BIN_EDGES_SECONDS` is a bin's INCLUSIVE lower bound
 * expressed as an upper bound of the bin below it, so the search returns the
 * first entry strictly greater than the length. A length of exactly 600s is
 * therefore 10 minutes and lands in the 10-20 minute bucket, not the one
 * below. The final bucket has no upper bound and catches everything left.
 */
export function binOf(lengthSeconds: number): number {
  for (let i = 0; i < DURATION_BIN_EDGES_SECONDS.length; i++) {
    if (DURATION_BIN_EDGES_SECONDS[i]! > lengthSeconds) return i;
  }
  return DURATION_BIN_COUNT - 1;
}

/**
 * Sweep one slice's sessions and total them.
 *
 * Sessions are walked in START order behind a `covered` marker holding the
 * furthest end seen so far. A session's increment is the part of it that
 * `covered` has not already paid for, so two overlapping sessions sum to
 * their union. Start order also makes day numbers non-decreasing, so the
 * per-day bucket only has to compare against the LAST entry instead of
 * building a Map.
 *
 * The three grids are filled from that same increment, which is the only
 * thing that keeps them describing the same playtime:
 *
 * - `hourOverlap` is credited the session's claimed TAIL, `[end - increment,
 *   end)`, so a second is attributed to the hour it actually occupies. A range
 *   inside a single hour is clipped twice on purpose, which is still one clip
 *   algebraically: the function only splits at an hour boundary.
 * - `hourStart` is credited the hour the session STARTED in, the basis the
 *   `HOUR_GRID_BASIS` constant selects between. Both bases are stored for
 *   every import; see the note on that constant in `playtime-shared.ts`.
 * - `bins` is credited the RAW length, not the increment, because a
 *   fully-overlapped session still occupied a slot.
 */
export function aggregateSlice(usable: readonly UsableSession[], excluded: number): PlaytimeSlice {
  const order = usable.map((_, index) => index).sort((a, b) => usable[a]!.start - usable[b]!.start);
  const slice: PlaytimeSlice = {
    seconds: 0,
    sessions: usable.length,
    excluded,
    dayIndex: [],
    daySeconds: [],
    daySessions: [],
    hourOverlap: new Array<number>(HOUR_CELL_COUNT).fill(0),
    hourStart: new Array<number>(HOUR_CELL_COUNT).fill(0),
    bins: new Array<number>(DURATION_BIN_COUNT).fill(0),
  };
  let covered = -Infinity;
  for (const index of order) {
    const { start, end } = usable[index]!;
    const increment = Math.max(0, end - Math.max(start, covered));
    covered = Math.max(covered, end);

    const day = Math.floor(start / 86400);
    const last = slice.dayIndex.length - 1;
    if (last >= 0 && slice.dayIndex[last] === day) {
      slice.daySeconds[last] += increment;
      slice.daySessions[last] += 1;
    } else {
      slice.dayIndex.push(day);
      slice.daySeconds.push(increment);
      slice.daySessions.push(1);
    }
    if (increment > 0) {
      addHourOverlap(slice.hourOverlap, end - increment, end);
      slice.hourStart[cellOfHour(Math.floor(start / 3600))]! += increment;
    }
    slice.bins[binOf(end - start)]! += 1;
    slice.seconds += increment;
  }
  return slice;
}

/** One file's game, or null for the synthetic fixture's `Sessions.csv`. */
export type SessionGame = string | null;

/** One session FILE of the import: its game, and its parsed rows. */
export interface SessionSource {
  /** The game its FILE NAME carries, or null when the name names no game. */
  game: SessionGame;
  /** The rows of that one file, in the order they were parsed. */
  rows: readonly SessionRow[];
}

/**
 * Aggregate every session row of one import, one SESSION FILE at a time.
 *
 * ## Why the columns are resolved PER SOURCE
 *
 * Each session file has its own header. The synthetic fixture's `Sessions.csv`
 * says `SESSION_START`/`SESSION_END`; a real `WOT_Game_Sessions.csv` says
 * `STARTED_AT`/`FINISHED_AT`; and an export can hold BOTH at once. Resolving
 * the columns once, from the first row of the whole import, would apply one
 * file's header to every other file — and every row read through a column the
 * file does not have is EXCLUDED, not counted, so the whole of the other file
 * would vanish with no error and no clue. That is the difference this
 * function exists to make.
 *
 * A source with no rows has no first row, so it resolves to no columns and
 * contributes no session — but the CALLER's `sessionsFileSeen` is what says the
 * file was there, so a header-only file is still distinguished from a missing
 * one.
 *
 * The source's `game` is carried on each session AND on each excluded row,
 * because a value's excluded count is the excluded rows carrying that value —
 * an excluded row with no game could not be counted against the game it came
 * from. 04-15 reads it through `splitValueOf`; nothing re-derives a game label
 * from a cell (T-04-27).
 */
export function buildPlaytimeFromSources(
  sources: readonly SessionSource[],
  sessionsFileSeen: boolean,
): PlaytimeAggregates {
  const usable: SplitSession[] = [];
  const excludedRows: SplitValues[] = [];
  for (const source of sources) {
    const columns =
      source.rows.length > 0
        ? resolveSessionColumns(source.rows[0]!)
        : { start: null, end: null, server: null, platform: null };
    for (const row of source.rows) {
      const start = parseSessionTimestamp(cell(row, columns.start));
      const end = parseSessionTimestamp(cell(row, columns.end));
      // The split values are read for EVERY row, excluded rows included: a
      // value's excluded count is the excluded rows carrying that value.
      const values = {
        game: source.game,
        server: splitValue(cell(row, columns.server)),
        platform: splitValue(cell(row, columns.platform)),
      };
      if (start === null || end === null || end < start) {
        excludedRows.push(values);
        continue;
      }
      usable.push({ start, end, ...values });
    }
  }
  return rankAggregates(usable, excludedRows, sessionsFileSeen);
}

/**
 * Aggregate every session row of ONE session file — the single-source case.
 *
 * Kept as a named wrapper over {@link buildPlaytimeFromSources} with a null
 * game, so the whole existing matrix and every existing caller keep working
 * unchanged, and so there is one aggregation path rather than two that can
 * drift.
 *
 * A session is EXCLUDED — counted, never silently dropped — when its start or
 * end is missing, unparseable, or the end precedes the start. The excluded
 * count is what the copy reports, so a user with a column-name mismatch sees
 * "0 sessions" next to "N rows could not be read" rather than an empty chart
 * with no explanation.
 *
 * ## Why the parts can add up to more than All
 *
 * Every slice merges overlap among ITS OWN sessions (D-02), and the All slice
 * merges across all of them. So a session on server A that overlaps one on
 * server B is counted once under All and twice under its value. That is not a
 * bug to be fixed; it is what the overlap note under the split table exists
 * to explain. The same holds across FILES: the per-game totals of 04-15 can sum
 * to more than the All total for exactly this reason.
 *
 * The two hour bases (`hourOverlap`, `hourStart`) are filled by
 * `aggregateSlice` for every slice, split or not, and `HOUR_GRID_BASIS` stays
 * the one unresolved constant that chooses between them.
 */
export function buildPlaytime(
  rows: readonly SessionRow[],
  sessionsFileSeen: boolean,
): PlaytimeAggregates {
  return buildPlaytimeFromSources([{ game: null, rows }], sessionsFileSeen);
}

/**
 * The All slice, the split, and the per-value slices, from the collected usable
 * sessions and the excluded rows.
 *
 * Split out of {@link buildPlaytimeFromSources} so the ranking, the split rule
 * and the overlap merge are written ONCE: whether the rows came from one file
 * or five, the numbers are produced by this code and nothing else.
 */
function rankAggregates(
  usable: readonly SplitSession[],
  excludedRows: readonly SplitValues[],
  sessionsFileSeen: boolean,
): PlaytimeAggregates {
  const all = aggregateSlice(usable, excludedRows.length);
  const splitColumn = chooseSplit(usable);
  if (splitColumn === null) {
    return {
      v: PLAYTIME_VERSION,
      sessionsFileSeen,
      splitColumn: null,
      values: [],
      byValue: [],
      all,
    };
  }

  // T-04-10: a `Map`, never an object, so a server genuinely named
  // `__proto__` or `constructor` is a value like any other and writes nothing
  // onto `Object.prototype`. Selection is by INDEX, so a hostile value never
  // has to be safe as a property name — only as text. That holds for a game
  // code read from a file name just as it does for a server read from a cell.
  const groups = new Map<string | null, SplitSession[]>();
  for (const session of usable) {
    const value = splitValueOf(session, splitColumn);
    const group = groups.get(value);
    if (group === undefined) groups.set(value, [session]);
    else group.push(session);
  }

  const ranked: SplitEntry[] = [...groups.entries()].map(([value, members]) => ({
    value,
    slice: aggregateSlice(
      members,
      // A value's excluded count is the excluded rows CARRYING that value, so
      // this reads the same column accessor rather than a second guess at it.
      excludedRows.filter((row) => splitValueOf(row, splitColumn) === value).length,
    ),
  }));
  ranked.sort(compareSplitEntries);

  return {
    v: PLAYTIME_VERSION,
    sessionsFileSeen,
    splitColumn,
    values: ranked.map((entry) => entry.value),
    byValue: ranked.map((entry) => entry.slice),
    all,
  };
}

/**
 * Turn a stored aggregate into the view a query answers with.
 *
 * `valueIndex` is null for the All chart. Anything that is not a whole index
 * into the stored values — negative, fractional, NaN, Infinity, past the end,
 * or simply an index from a DIFFERENT dataset that has since been replaced —
 * falls back to All rather than throwing, so a stale selection can never
 * break the section.
 *
 * `selected` is the index that was actually APPLIED, not the one that was
 * asked for. The UI marks the row it is showing, so the two must not be able
 * to disagree: an out-of-range request answers `selected: null` over the All
 * slice, and the selector shows All rather than a value the view is not
 * holding.
 */
export function viewFromAggregates(
  aggregates: PlaytimeAggregates,
  valueIndex: number | null,
): PlaytimeView {
  if (!aggregates.sessionsFileSeen) return { status: 'no-session-file' };
  if (aggregates.all.sessions === 0)
    return { status: 'no-usable-sessions', excluded: aggregates.all.excluded };
  const split =
    aggregates.splitColumn === null
      ? null
      : {
          column: aggregates.splitColumn,
          values: aggregates.values.map((value, index) => ({
            value: value ?? '',
            seconds: aggregates.byValue[index]?.seconds ?? 0,
          })),
          allSeconds: aggregates.all.seconds,
        };
  const selected =
    valueIndex !== null &&
    Number.isInteger(valueIndex) &&
    valueIndex >= 0 &&
    valueIndex < aggregates.byValue.length
      ? valueIndex
      : null;
  return {
    status: 'ready',
    split,
    selected,
    slice: selected === null ? aggregates.all : aggregates.byValue[selected]!,
  };
}
