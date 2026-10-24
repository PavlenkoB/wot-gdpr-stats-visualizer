/**
 * Constants and types shared by the playtime aggregator (worker side) and the
 * playtime client (main-thread side).
 *
 * This module is pure — no imports, no `Date`, no worker globals — because it
 * is imported from both sides of the `postMessage` boundary. The worker
 * builds the aggregate; the main thread reads the constant and builds the
 * query, and neither may need the other's environment.
 */

/**
 * Which column the future "split by" control groups sessions on.
 *
 * `GAME` is first because it is the one thing that identifies the title on a
 * REAL export: the game is named by the session file's own name
 * (`WOT_Game_Sessions.csv`), and the real header carries neither `SERVER_NAME`
 * nor `CLIENT_PLATFORM` at all. A legacy `Sessions.csv` names no game, so its
 * null game is a single value and never qualifies on its own (D-03).
 */
export type SplitColumn = 'GAME' | 'SERVER_NAME' | 'CLIENT_PLATFORM';

/**
 * Which of the two hour grids the charts read.
 *
 * ## Pending user decision — this constant is the single switch
 *
 * `04-UI-SPEC` has an unresolved row on it. `overlap` credits an hour with
 * every second of playtime that fell inside it, so a session running 09:50 to
 * 10:10 puts 600 s in the 09:00 cell and 600 s in the 10:00 cell. `start`
 * credits the whole session to the hour it began in, so that same session
 * puts 1200 s in the 09:00 cell and nothing in the 10:00 cell.
 *
 * BOTH grids are always computed and stored, so switching the basis is a
 * constant change and never a re-import. Until the decision is made the value
 * below stands. Plans 04-04, 04-05 and 04-09 read `HOUR_GRID_BASIS` and never
 * hard-code a basis, so none of them has to be touched when it flips.
 */
export type HourGridBasis = 'overlap' | 'start';

/** The basis the charts read today. See the pending-decision note above. */
export const HOUR_GRID_BASIS: HourGridBasis = 'overlap';

/**
 * Bumped whenever a stored aggregate would change meaning, so an old dataset
 * is re-aggregated instead of being read with new rules. Plan 04-06 made that
 * a REBUILD from the stored rows rather than a refusal: a cache written before
 * the aggregate existed, or by a build whose aggregation threw at import, is
 * recomputed by the same code the import uses and then written back.
 *
 * 2 — 04-14: bumped because a stored aggregate now depends on the per-game
 * session files, the `STARTED_AT`/`FINISHED_AT` column names and the
 * `DD.MM.YYYY HH:MM` stamp, none of which the previous version knew. A dataset
 * already in a user's browser — imported by the previous build, so its
 * aggregate says this export has no session file — is re-derived from its own
 * stored rows on the next playtime query and shows its playtime with no
 * re-import (T-04-30, UAT gap G-04-1).
 *
 * 3 — 10-01: bumped because a stored aggregate now carries a PER-GAME scope
 * beside the all-games one (`games` / `byGame`), which a v2 cache has no room
 * for. The bump reuses the existing lazy rebuild: a v2 aggregate is recomputed
 * from its own stored rows on the next playtime query and written back, with
 * no re-import and no Dexie bump (D-16, D-21).
 *
 * 4 — 13-05: bumped because a stored slice now carries the longest raw
 * session (`longestSeconds`, `longestStart`), which a v3 record has no room
 * for. The bump reuses the lazy rebuild: a v3 aggregate is recomputed from
 * its own stored session rows on the next playtime or overview query and
 * written back, with no re-import and no Dexie bump (D-01, T-13-14).
 */
export const PLAYTIME_VERSION = 4;

/** Cells in the weekday-by-hour grid: 7 weekdays times 24 hours. */
export const HOUR_CELL_COUNT = 168;

/** Bins in the session-duration histogram. */
export const DURATION_BIN_COUNT = 12;

/**
 * The 11 inner edges of the 12 duration bins, lower inclusive and upper
 * exclusive. The edges come from `04-UI-SPEC` §7: under 1 min, 1-2, 2-5, 5-10,
 * 10-20, 20-30 min, 30-60 min, 1-2, 2-4, 4-8, 8-16 and 16+ hours.
 */
export const DURATION_BIN_EDGES_SECONDS: readonly number[] = [
  60, 120, 300, 600, 1200, 1800, 3600, 7200, 14400, 28800, 57600,
];

/**
 * Cap on distinct split values, so a 50,000-session export cannot blow the
 * stored aggregate up with one cell per server name. The UI copy tells the
 * user when the cap bites rather than silently truncating (plan 04-06).
 */
export const MAX_SPLIT_VALUES = 50;

/**
 * The columns a split may group by, in the order a human is offered them.
 *
 * The order is the rule: the first column with between 2 and
 * `MAX_SPLIT_VALUES` distinct values among usable sessions wins, so `GAME` leads
 * because the export names the game in the session file's name, and the two
 * legacy columns follow in the order the synthetic fixture has always had them.
 */
export const SPLIT_COLUMNS: readonly SplitColumn[] = ['GAME', 'SERVER_NAME', 'CLIENT_PLATFORM'];

/**
 * What a game token LOOKS LIKE, once upper-cased: one to 24 characters of
 * `A-Z`, `0-9` and `_`.
 *
 * The SAME character class `sessionFileGame` matches in a session file's name,
 * upper-cased. Sharing it is the point: a token the aggregator can produce from
 * an archive is a token this accepts, so a game a real export names is never
 * rejected by the filter that is meant to select it, and a token no file name
 * could carry is never accepted in its place.
 *
 * Anchored, single character class and no nested quantifier, for the same reason
 * {@link PLAYTIME_VERSION}'s neighbours in `playtime-aggregate.ts` are: this
 * pattern is run on a `postMessage` field the worker did not author, and a
 * backtracking-prone pattern is a free denial of service on the query path.
 */
export const GAME_TOKEN_RE = /^[A-Z0-9_]{1,24}$/;

/**
 * True when `value` is a game token the stored aggregate can hold.
 *
 * The trust boundary for `playtime-query.game` (T-10-01). It is a pure
 * predicate with no throw, mirroring `isDataQuery` in `data-queries.ts`: a
 * value that is not a token is not an error to report, it is a question the
 * worker cannot answer, and the worker's answer is All. The caller must NEVER
 * copy the raw value into a reply — a malformed token degrades to All rather
 * than being echoed back.
 */
export function isGameToken(value: unknown): value is string {
  return typeof value === 'string' && GAME_TOKEN_RE.test(value);
}
