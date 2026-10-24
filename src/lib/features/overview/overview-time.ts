/**
 * overview-time.ts — the Time group and the Wargaming life strip (13-08).
 *
 * ## What this module is
 *
 * Five tiles and one list, all of them read from the STORED playtime
 * aggregate: Logged in, Signature hour, Longest streak, Longest session,
 * Busiest day, and the per-game "Wargaming life" strip beside them.
 *
 * Pure: it reads the aggregate it is handed and returns plain figures. No
 * `Date`, no `Intl`, no locale, no DOM — the page formats what this produces.
 *
 * ## Why Logged in is `playtime.all` and nothing else (D-05)
 *
 * Phase 10 already merges the session intervals across every account and
 * every game, so `playtime.all.seconds` IS the union. Merging them again
 * here would double-count nothing and could only ever disagree with the
 * Playtime pane, so this module does not merge at all.
 *
 * ## Why the four HABIT tiles read the WoT scope only (D-20)
 *
 * "Logged in" counts every game's sessions, because that is the number the
 * player recognises. The habits — when they play, how long they streak, how
 * long a sitting lasts — are claims about World of Tanks, and the rule lines
 * say "WoT sessions". So they read the WOT per-game scope and NOTHING else.
 *
 * A dataset whose only session file is a legacy `Sessions.csv` names no game
 * at all, so its habits are ABSENT while Logged in stays ready: the file
 * cannot make a claim about WoT sessions when it never said which game it
 * was. That is a named absence, not a zero (T-13-25).
 *
 * ## Why "In battle" is a separate figure (D-05)
 *
 * Battle time is not logged-in time: it comes from the account statistics'
 * `BATTLE_LIFE_TIME`, and it arrives as an argument. The tile carries it
 * beside the seconds, and the page labels it "In battle" — never "in game"
 * (the spike's own warning).
 *
 * ## Why every tie resolves to the EARLIEST day or hour
 *
 * Two days can hold the same seconds and two hours the same seconds, and the
 * tile has to name one of them. The earliest wins every time, because the
 * earlier day is the one a reader would say the streak "started" on, and a
 * rule that always picks the same one of two equals is a rule a test can pin.
 */

import { civilFromDays } from '../../core/civil-date.ts';
import type { PlaytimeAggregates, PlaytimeSlice } from '../../core/types/worker-messages.ts';
import { HOUR_CELL_COUNT, HOUR_GRID_BASIS } from '../playtime/playtime-shared.ts';
import {
  OVERVIEW_TILE_NEEDS,
  type OverviewAbsentTile,
  type OverviewLife,
  type OverviewTile,
  type OverviewTileId,
} from './overview-shared.ts';

// -----------------------------------------------------------------------------
// The constants
// -----------------------------------------------------------------------------

/**
 * The game token the habit tiles read.
 *
 * The token is the session FILE's own name, upper-cased (`WOT_Game_Sessions.csv`
 * is `WOT`), so it is a claim the export itself makes and never a cell a row
 * carried (T-04-27).
 */
export const WOT_GAME = 'WOT';

/** Seconds in a day. The same 86,400 the playtime aggregator uses. */
const SECONDS_PER_DAY = 86400;

/** The hours of a day, and the weekdays of the grid. */
const HOURS_PER_DAY = 24;
const WEEKDAYS = 7;

// -----------------------------------------------------------------------------
// The absent form
// -----------------------------------------------------------------------------

/**
 * One absent Time tile: the source it needs, and no column.
 *
 * The absence is a WHOLE-SOURCE one — there is no record column behind a
 * session history — so the column is always null (D-03).
 */
function absent(id: OverviewTileId): OverviewAbsentTile {
  return { id, status: 'absent', need: OVERVIEW_TILE_NEEDS[id], column: null };
}

// -----------------------------------------------------------------------------
// The builders
// -----------------------------------------------------------------------------

/**
 * Build the five Time tiles, in catalogue order.
 *
 * The order is the contract: `logged`, `hour`, `streak`, `sess`, `busy` — the
 * same order the wire contract lists them in, so a group can slice the array
 * by index and the order cannot drift.
 */
export function buildTimeTiles(
  playtime: PlaytimeAggregates | null,
  battleSeconds: number | null,
): OverviewTile[] {
  return [loggedTile(playtime, battleSeconds), ...habitTiles(playtime)];
}

/**
 * The Wargaming life strip: every game present, with its own merged seconds.
 *
 * The parts may add up to MORE than Logged in, and that is the documented
 * shape of the numbers rather than a defect: each game's scope merges the
 * overlap among its OWN sessions only, so a Blitz session that falls inside a
 * WoT interval is inside it under "all games" and beside it under "Blitz"
 * (D-06).
 *
 * The stored order is kept — the aggregate lists its games ascending by code
 * unit — so the strip cannot disagree with the Playtime pane's own order.
 */
export function buildLife(playtime: PlaytimeAggregates | null): OverviewLife[] {
  return (
    playtime?.byGame?.map((entry) => ({
      game: entry.game,
      seconds: entry.scope.all.seconds,
    })) ?? []
  );
}

/**
 * The dataset's first and last day with a session.
 *
 * Both come from the SAME aggregate the Logged in tile reads, so the answer's
 * `firstDay`/`lastDay` and the tile can never disagree (D-05).
 */
export function dayRange(playtime: PlaytimeAggregates | null): {
  firstDay: number | null;
  lastDay: number | null;
} {
  const days = playtime?.all.dayIndex ?? [];
  if (days.length === 0) return { firstDay: null, lastDay: null };
  return { firstDay: days[0]!, lastDay: days[days.length - 1]! };
}

// -----------------------------------------------------------------------------
// Logged in
// -----------------------------------------------------------------------------

/**
 * The Logged in tile: the union of every account's and every game's sessions.
 *
 * Three conditions, and all three must hold: the aggregate exists, a session
 * file was SEEN (a header-only file is a file that was there), and there is
 * at least one usable session. A dataset with no session history has no
 * logged-in time to report, so the tile is absent rather than zero.
 */
function loggedTile(
  playtime: PlaytimeAggregates | null,
  battleSeconds: number | null,
): OverviewTile {
  if (playtime === null) return absent('logged');
  if (!playtime.sessionsFileSeen) return absent('logged');
  if (playtime.all.sessions <= 0) return absent('logged');

  const days = playtime.all.dayIndex;
  if (days.length === 0) return absent('logged');

  return {
    id: 'logged',
    status: 'ok',
    seconds: playtime.all.seconds,
    firstDay: days[0]!,
    lastDay: days[days.length - 1]!,
    battleSeconds,
    years: yearsOf(playtime.all),
  };
}

/**
 * The active years, ascending, with the seconds of each.
 *
 * A day number is a calendar day (see `civil-date.ts`), so the year of a day
 * comes from `civilFromDays` — never from a timezone conversion, because the
 * export's stamps are wall clock and must not move between machines.
 */
function yearsOf(slice: PlaytimeSlice): { year: number; seconds: number }[] {
  const totals = new Map<number, number>();
  const days = slice.dayIndex;
  const seconds = slice.daySeconds;
  for (let i = 0; i < days.length; i += 1) {
    const year = civilFromDays(days[i]!).y;
    totals.set(year, (totals.get(year) ?? 0) + (seconds[i] ?? 0));
  }
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, total]) => ({ year, seconds: total }));
}

// -----------------------------------------------------------------------------
// The four habit tiles
// -----------------------------------------------------------------------------

/**
 * The four habit tiles, all of them read from the WoT scope.
 *
 * With no WoT scope — or with a scope that holds no usable session — all
 * four are absent, and they say the same thing: this export has no WoT
 * session history to read them from.
 */
function habitTiles(playtime: PlaytimeAggregates | null): OverviewTile[] {
  const slice = wotSlice(playtime);
  if (slice === null) {
    return [absent('hour'), absent('streak'), absent('sess'), absent('busy')];
  }
  return [hourTile(slice), streakTile(slice), sessTile(slice), busyTile(slice)];
}

/**
 * The WoT scope's own slice, or null when there is none to read.
 *
 * A scope with no usable session is null too: an empty slice is not a set of
 * zero-second habits, it is nothing to say.
 */
function wotSlice(playtime: PlaytimeAggregates | null): PlaytimeSlice | null {
  if (playtime === null) return null;
  const entry = playtime.byGame?.find((scope) => scope.game === WOT_GAME);
  if (entry === undefined) return null;
  if (entry.scope.all.sessions <= 0) return null;
  return entry.scope.all;
}

/**
 * The Signature hour: the seconds of playtime per hour of day.
 *
 * The grid is the one `HOUR_GRID_BASIS` selects, and the constant is READ
 * rather than hard-coded, so flipping the basis is a constant change and never
 * a re-import (see `playtime-shared.ts`). The grid is a weekday-by-hour
 * table, so the hour of day is the sum over the seven weekdays.
 *
 * An all-zero grid is an absence rather than twenty-four zeroes: there is no
 * hour to name.
 */
function hourTile(slice: PlaytimeSlice): OverviewTile {
  const grid = HOUR_GRID_BASIS === 'overlap' ? slice.hourOverlap : slice.hourStart;
  if (!Array.isArray(grid) || grid.length !== HOUR_CELL_COUNT) return absent('hour');

  const hours: number[] = new Array<number>(HOURS_PER_DAY).fill(0);
  for (let weekday = 0; weekday < WEEKDAYS; weekday += 1) {
    for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
      hours[hour] += grid[weekday * HOURS_PER_DAY + hour] ?? 0;
    }
  }

  const peak = Math.max(...hours);
  if (peak <= 0) return absent('hour');

  // The FIRST hour with the maximum: an equal hour never replaces an
  // earlier one.
  const peakHour = hours.indexOf(peak);
  return { id: 'hour', status: 'ok', hours, peakHour };
}

/**
 * The Longest streak: the longest run of CONSECUTIVE days with a session.
 *
 * The day numbers are ascending, so a run is a stretch of days where each one
 * is exactly the previous plus one. The earliest run wins a tie, because a
 * strict `>` never replaces a run that is already the longest.
 */
function streakTile(slice: PlaytimeSlice): OverviewTile {
  const days = slice.dayIndex;
  if (days.length === 0) return absent('streak');

  let bestDays = 1;
  let bestStart = days[0]!;
  let bestEnd = days[0]!;
  let runDays = 1;
  let runStart = days[0]!;

  for (let i = 1; i < days.length; i += 1) {
    const day = days[i]!;
    if (day === days[i - 1]! + 1) {
      runDays += 1;
    } else {
      runStart = day;
      runDays = 1;
    }
    if (runDays > bestDays) {
      bestDays = runDays;
      bestStart = runStart;
      bestEnd = day;
    }
  }

  return { id: 'streak', status: 'ok', days: bestDays, startDay: bestStart, endDay: bestEnd };
}

/**
 * The Longest session: the raw length of the longest single session.
 *
 * The figure is the RAW length, never the merged one: this answers "one
 * login to logout", and a session that was covered by an earlier one still
 * happened. An aggregate written before the field existed has no value here,
 * and an absent value is NOT a zero — the tile is absent (T-13-14).
 */
function sessTile(slice: PlaytimeSlice): OverviewTile {
  const seconds = slice.longestSeconds;
  const start = slice.longestStart;
  if (typeof seconds !== 'number' || typeof start !== 'number') return absent('sess');
  if (slice.sessions <= 0) return absent('sess');
  return { id: 'sess', status: 'ok', seconds, day: Math.floor(start / SECONDS_PER_DAY) };
}

/**
 * The Busiest day: the day with the most merged seconds.
 *
 * The seconds are attributed to the session's START day, which is the same
 * rule the Playtime pane's own day chart uses. The earliest day wins a tie.
 */
function busyTile(slice: PlaytimeSlice): OverviewTile {
  const days = slice.dayIndex;
  if (days.length === 0) return absent('busy');

  let bestIndex = 0;
  let bestSeconds = slice.daySeconds[0] ?? 0;
  for (let i = 1; i < days.length; i += 1) {
    const seconds = slice.daySeconds[i] ?? 0;
    if (seconds > bestSeconds) {
      bestSeconds = seconds;
      bestIndex = i;
    }
  }

  return { id: 'busy', status: 'ok', seconds: bestSeconds, day: days[bestIndex]! };
}
