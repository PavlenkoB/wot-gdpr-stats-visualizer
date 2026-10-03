/**
 * Every decision the Phase 4 playtime charts make, as pure functions.
 *
 * ## Why this module exists
 *
 * Plans 04-08 to 04-10 are thin glue over these functions. A component takes
 * the numbers a model returns and turns them into `<rect>` attributes, class
 * names and words; it decides nothing. That is deliberate: the parts of a
 * heatmap that are easy to get subtly wrong — which shade a day gets, where
 * its rect lands, what an arrow key does at a row edge, which side of the
 * sticky nav a tooltip opens on — are arithmetic, and arithmetic can be
 * tested without a browser. The repo's Vitest setup runs in the `node`
 * environment with no jsdom (vitest.config.ts explains why adding one was
 * rejected), so keeping the decisions out here is what makes them testable at
 * all; the DOM wiring is the part that is cheap to eyeball.
 *
 * ## The module has no words in it
 *
 * No `ui-copy` import. Numbers go in, numbers come out: levels, columns,
 * pixels, counts. The components turn them into "3.5 hours · 4 sessions" and
 * `aria-label` text, where the Copywriting Contract can see every string. A
 * model that owned its own copy would put user-visible English one import away
 * from a unit test that asserts a shape, and `S-1`-style defects would follow.
 *
 * ## No `Date` (D-01)
 *
 * Every timestamp in this app is a wall clock the game recorded, never an
 * instant, and a reader in another timezone must get the same numbers.
 * `civil-date.ts` does the calendar arithmetic in pure integers and this
 * module never constructs a `Date`; the tests deliberately compute their
 * expected day numbers with `Date.UTC` so the two paths can disagree.
 *
 * ## Geometry is stated, not derived from a magic number
 *
 * Both layouts below carry the arithmetic in comments, because the numbers are
 * checked by tests rather than by a designer: a 634px-wide calendar is
 * `40 + 54 * 11` and a 97px-tall one is `20 + 7 * 11`, and 54 is the widest
 * year in 1990-2060 (2012, which begins on a Sunday). The calendar gutter is
 * 40 rather than the original 32 because the 32 held a 29px "Wed" plus an 8px
 * pad and clipped the label's first letter in every year (UAT G-04-UI-1,
 * 04-UI-SPEC Amendment A-1).
 *
 * ## Colour is rank-based, never linear min-max (D-04)
 *
 * A linear min-max scale on a decade of playtime is decided entirely by the
 * single best day: ordinary days all collapse to the bottom shade and the
 * chart carries no information. `rankScale` cuts the non-zero values at their
 * 20th, 40th, 60th and 80th percentiles instead, so a shaded day means the
 * same amount of play in every year and an outlier takes the top shade alone.
 */

/**
 * Tooltip placement is NUMBERS, not a style string, and that is a CSP
 * consequence rather than a taste call. The build ships
 * `style-src 'self'` with no `unsafe-inline`, and `svelte/no-inline-styles` is
 * an error in this repo, so a tooltip cannot be positioned with a `style`
 * attribute or a `style:` directive. It is placed through the CSSOM
 * (`el.style.left`, `el.style.top`), and that takes numbers. Deciding the
 * numbers here keeps the decision — flip below the sticky nav, clamp 8px from
 * every edge — in a place that can be tested without laying out a page.
 */

import {
  civilFromDays,
  daysFromCivil,
  daysInMonth,
  daysInYear,
  weekdayOfDay,
} from '../../core/civil-date';
import type { PlaytimeSlice, PlaytimeSplit } from '../../core/types/worker-messages';
import {
  DURATION_BIN_COUNT,
  HOUR_CELL_COUNT,
  HOUR_GRID_BASIS,
  type HourGridBasis,
} from './playtime-shared';

// =============================================================================
// Layout constants (04-UI-SPEC sections 5 and 6)
// =============================================================================

/** The calendar heatmap's SVG geometry, in user units. */
export const CALENDAR_LAYOUT = {
  /** Cell edge: 10x10 with no rounded corners, separated by a 1px white stroke. */
  cell: 10,
  /** Cell pitch: 11, so the 1px stroke sits in the gap rather than on the cell. */
  pitch: 11,
  /** Left gutter: 40px for the "Mon"/"Wed"/"Fri" row labels, text-anchor end. */
  gutter: 40,
  /**
   * Clearance between a weekday label's right edge and the first column, so
   * the label's right edge is at `gutter - labelPad`.
   *
   * Named rather than written as an inline subtraction, because the room the
   * labels actually have is the gutter MINUS this number, and a bare 8 hidden
   * in a template is how a 32px gutter ended up holding 24px of room for a
   * 29px label (UAT G-04-UI-1, 04-UI-SPEC Amendment A-1).
   */
  labelPad: 4,
  /** Top band: 20px for the month labels. */
  band: 20,
  /** 40 + 54 * 11 = 634. 54 columns is the widest year in 1990-2060 (2012). */
  width: 634,
  /** 20 + 7 * 11 = 97, for seven weekday rows. */
  height: 97,
  /** Widest year between 1990 and 2060 needs 54 columns (verified in RESEARCH). */
  maxColumns: 54,
  /** Rows carrying a weekday label: Monday, Wednesday, Friday. */
  weekdayLabelRows: [0, 2, 4],
} as const;

/** The weekday x hour heatmap's SVG geometry, in user units. */
export const HOUR_GRID_LAYOUT = {
  /** Cell edge and pitch are both 24: 7 rows x 24 columns of 24px cells. */
  cell: 24,
  /** Left gutter: 48px for the seven weekday labels. */
  gutter: 48,
  /** Top band: 24px for the hour labels, which are every third column. */
  band: 24,
  /** 48 + 24 * 24 = 624, for 24 hour columns. */
  width: 624,
  /** 24 + 7 * 24 = 192, for 7 weekday rows. */
  height: 192,
} as const;

// =============================================================================
// The rank scale (D-04, UI-SPEC "Scale rule")
// =============================================================================

/** The four cut points and the level lookup they imply. */
export interface RankScale {
  /** Ascending cut points, always four, possibly with duplicates. */
  cuts: number[];
  /** Level 0 for zero, else the 1-based index of the first cut reached, else 5. */
  levelOf: (value: number) => number;
}

/**
 * Rank scale over the non-zero values, in whole seconds (D-04).
 *
 * Cut `k` is the value at index `min(n - 1, ceil(n * k / 5) - 1)` of the
 * ascending non-zero values, for `k` 1..4 — a nearest-rank percentile, so the
 * cut is an OBSERVED value rather than an interpolation between two. Whole
 * seconds make the ties exact, which is what lets duplicate cuts collapse
 * honestly instead of being papered over with a float epsilon.
 *
 * With no non-zero values at all the cut list is empty and every level answer
 * is vacuous: no cell can be non-zero when the scale was built from the same
 * values, so `buildCalendarModel` never asks. A positive value against an
 * empty scale resolves to 5 by the rule as written (it exceeds every cut,
 * of which there are none), and that is left as-is rather than special-cased.
 */
export function rankScale(nonZeroSeconds: readonly number[]): RankScale {
  const sorted = [...nonZeroSeconds].sort((a, b) => a - b);
  const n = sorted.length;
  const cuts =
    n === 0 ? [] : [1, 2, 3, 4].map((k) => sorted[Math.min(n - 1, Math.ceil((n * k) / 5) - 1)]!);

  return {
    cuts,
    // `findIndex` is -1 when the value exceeds every cut, so `-1 + 1 === 0`
    // falls through the `||` to level 5.
    levelOf: (value: number) => (value <= 0 ? 0 : cuts.findIndex((cut) => value <= cut) + 1 || 5),
  };
}

/** Which swatches the legend prints, and the boundary note it may carry. */
export interface LegendModel {
  /**
   * Level 0 plus the levels actually in use, ascending.
   *
   * Sparse on purpose (UI-SPEC: "the swatches for level 0 and every level in
   * use"), so a slice with only one shade in use prints two swatches rather
   * than six. Two values can leave a genuine gap — with `[1, 2]` the levels
   * present are 1 and 3 — and the gap is honest: no cell has that level.
   */
  levels: number[];
  /** The fourth cut, when some value is above it; otherwise null (no note). */
  darkestAbove: number | null;
}

/**
 * The legend for a scale, over the values the scale was built from.
 *
 * The "Darkest: more than X" sentence appears only when level 5 is in use: a
 * lone level omits it, because naming a boundary nothing reaches tells the
 * reader about a shade the chart does not contain.
 */
export function legendModel(scale: RankScale, nonZeroSeconds: readonly number[]): LegendModel {
  const used = new Set<number>();
  for (const value of nonZeroSeconds) used.add(scale.levelOf(value));

  return {
    levels: [0, ...used].sort((a, b) => a - b),
    darkestAbove: scale.cuts[3] !== undefined && used.has(5) ? scale.cuts[3] : null,
  };
}

// =============================================================================
// The calendar heatmap (D-04)
// =============================================================================

/** One day of one drawn year, with its place in the grid and its shade. */
export interface CalendarCell {
  /** Day number, 1970-01-01 = 0. */
  day: number;
  /** `YYYY-MM-DD` for the day number, zero-padded (D-01, never a Date). */
  date: string;
  /** Month 1-12, for the month labels and the tooltip's date line. */
  month: number;
  /** Week column, `floor((dayOfYear0 + weekdayOfJan1) / 7)`. */
  col: number;
  /** Weekday row, 0 = Monday. */
  row: number;
  /** `gutter + col * pitch`. */
  x: number;
  /** `band + row * pitch`. */
  y: number;
  /** Merged seconds attributed to this start day for the slice (D-02). */
  seconds: number;
  /** Usable sessions that started on this day, kept even at zero seconds. */
  sessions: number;
  /** Shade level 0-5, 0 meaning no play. */
  level: number;
}

/** A month label, sitting in the top band at its first day's column. */
export interface MonthLabel {
  /** Month 1-12. */
  month: number;
  /** Column holding the first of that month. */
  col: number;
  /** `gutter + col * pitch`. */
  x: number;
}

/** One year that has activity: a head, seven rows of cells and twelve labels. */
export interface CalendarYearBlock {
  kind: 'year';
  year: number;
  /** Seven weekday rows, each ordered by column. */
  rows: CalendarCell[][];
  /** Twelve month labels for the top band. */
  monthLabels: MonthLabel[];
  /** Columns this year needs, at most `CALENDAR_LAYOUT.maxColumns`. */
  columns: number;
  /** Sum of the year's cell seconds; reconciles with the Sessions tile. */
  seconds: number;
  /** Sum of the year's cell sessions. */
  sessions: number;
  /** Days with at least one usable session, which can exceed the shaded cells. */
  activeDays: number;
  /** First and last day numbers of the year, for the navigation reducer. */
  fromDay: number;
  toDay: number;
}

/**
 * A run of consecutive years with no sessions in the slice.
 *
 * D-04 stacks every year so a decade-long account is visible at a glance, and
 * a stray 1970 or 9999 row would otherwise draw dozens of empty grids between
 * two real years. One Caption line per run is the whole point of this block.
 */
export interface CalendarEmptyBlock {
  kind: 'empty';
  fromYear: number;
  toYear: number;
}

export type CalendarBlock = CalendarYearBlock | CalendarEmptyBlock;

/** Everything the calendar component renders, derived from one slice. */
export interface CalendarModel {
  /** Blocks newest first, so the most recent play is what the reader meets. */
  blocks: CalendarBlock[];
  /** Active years ascending — the order PageUp and PageDown walk. */
  years: number[];
  /** One scale for the whole chart, computed across every year together. */
  scale: RankScale;
  legend: LegendModel;
  /** Sum of the drawn years' day counts: the `calendar-cell` node budget. */
  cellCount: number;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** `YYYY-MM-DD` for a day number. The only date formatting in the module. */
export function isoDate(day: number): string {
  const { y, m, d } = civilFromDays(day);
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
}

/** First day number of `year`. */
const startOfYear = (year: number): number => daysFromCivil(year, 1, 1);

/** Last day number of `year`. */
const endOfYear = (year: number): number => startOfYear(year) + daysInYear(year) - 1;

/**
 * Week column of `day` inside `year`, using the same formula the cells use.
 *
 * Recomputed rather than read off a cell so the navigation reducer never has
 * to find the cell: every boundary the reducer needs is civil arithmetic on
 * the year, which keeps a key press independent of how many cells the year
 * drew.
 */
const columnIn = (year: number, day: number): number =>
  Math.floor((day - startOfYear(year) + weekdayOfDay(startOfYear(year))) / 7);

/**
 * Index in `model.years` (ascending) of the active year containing `day`, or
 * -1 when that day is not drawn.
 *
 * A binary search over the year list, so both this and every key press cost
 * `log(active years)` and never anything proportional to the SESSION count —
 * the T-04-09 property, which is the one that matters: a 50,000-session export
 * and a 500-session export produce the same model.
 */
const activeYearIndex = (model: CalendarModel, day: number): number => {
  const years = model.years;
  let low = 0;
  let high = years.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const year = years[mid]!;
    if (day < startOfYear(year)) high = mid - 1;
    else if (day >= endOfYear(year) + 1) low = mid + 1;
    else return mid;
  }

  return -1;
};

/** One year's cells, month labels and totals. */
function buildYearBlock(
  year: number,
  yearStart: number,
  totals: ReadonlyMap<number, { seconds: number; sessions: number }>,
  scale: RankScale,
): CalendarYearBlock {
  const { gutter, pitch, band } = CALENDAR_LAYOUT;
  // Weeks run Monday to Sunday, so the first column starts at January 1's
  // weekday rather than at day 0.
  const jan1Weekday = weekdayOfDay(yearStart);
  const total = daysInYear(year);
  const rows: CalendarCell[][] = [[], [], [], [], [], [], []];
  let seconds = 0;
  let sessions = 0;
  let activeDays = 0;
  let columns = 0;

  for (let offset = 0; offset < total; offset += 1) {
    const day = yearStart + offset;
    const slot = offset + jan1Weekday;
    const col = Math.floor(slot / 7);
    const row = slot % 7;
    const entry = totals.get(day);
    const cellSeconds = entry?.seconds ?? 0;
    const cellSessions = entry?.sessions ?? 0;

    rows[row]!.push({
      day,
      date: isoDate(day),
      month: civilFromDays(day).m,
      col,
      row,
      x: gutter + col * pitch,
      y: band + row * pitch,
      seconds: cellSeconds,
      sessions: cellSessions,
      level: scale.levelOf(cellSeconds),
    });

    if (col + 1 > columns) columns = col + 1;
    seconds += cellSeconds;
    sessions += cellSessions;
    if (cellSessions > 0) activeDays += 1;
  }

  const monthLabels: MonthLabel[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const col = Math.floor((daysFromCivil(year, m, 1) - yearStart + jan1Weekday) / 7);
    monthLabels.push({ month: m, col, x: gutter + col * pitch });
  }

  return {
    kind: 'year',
    year,
    rows,
    monthLabels,
    columns,
    seconds,
    sessions,
    activeDays,
    fromDay: yearStart,
    toDay: yearStart + total - 1,
  };
}

/**
 * The whole calendar for one slice (D-04).
 *
 * Draws EVERY day of every active year, not every day with a session, so the
 * grid is a rectangle whose emptiness is information; the node count is
 * therefore a function of the active years and never of the session count
 * (the scale criterion). Days with a session but zero merged seconds keep
 * their session count at level 0 (Pitfall 4), so the tooltip can say
 * "0 min · 1 session" rather than claiming the day was empty.
 *
 * The scale is computed ONCE across all years, so a dark day means the same
 * amount of play whether it is 2012 or 2024.
 */
export function buildCalendarModel(slice: PlaytimeSlice): CalendarModel {
  const totals = new Map<number, { seconds: number; sessions: number }>();
  slice.dayIndex.forEach((day, index) => {
    totals.set(day, {
      seconds: slice.daySeconds[index] ?? 0,
      sessions: slice.daySessions[index] ?? 0,
    });
  });

  const years = [...new Set(slice.dayIndex.map((day) => civilFromDays(day).y))].sort(
    (a, b) => a - b,
  );
  const nonZero = slice.daySeconds.filter((value) => value > 0);
  const scale = rankScale(nonZero);
  const legend = legendModel(scale, nonZero);

  // Newest year first (D-04: the most recent play is what people look for),
  // with each run of empty years between two active ones collapsed into ONE
  // block. That collapse is the whole defence against a stray 1970 or 9999 row
  // dragging dozens of empty 366-cell grids onto the page (T-04-08).
  const blocks: CalendarBlock[] = [];
  for (let i = years.length - 1; i >= 0; i -= 1) {
    const year = years[i]!;
    blocks.push(buildYearBlock(year, startOfYear(year), totals, scale));
    const older = years[i - 1];
    if (older !== undefined && year - older > 1) {
      blocks.push({ kind: 'empty', fromYear: older + 1, toYear: year - 1 });
    }
  }

  return {
    blocks,
    years,
    scale,
    legend,
    cellCount: years.reduce((total, year) => total + daysInYear(year), 0),
  };
}

/** True when the day belongs to a year the chart actually draws. */
export function isDrawnDay(model: CalendarModel, day: number): boolean {
  return activeYearIndex(model, day) !== -1;
}

/**
 * The day the calendar's single tab stop lands on: January 1 of the newest
 * active year, or null when the slice has no drawn year at all.
 */
export function initialCalendarFocus(model: CalendarModel): number | null {
  const newest = model.years.at(-1);
  return newest === undefined ? null : startOfYear(newest);
}

/** The eight keys the calendar's roving focus answers (04-UI-SPEC section 5). */
export type CalendarKey =
  'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown';

/**
 * Where the calendar's focused day goes for one key press.
 *
 * ## Every impossible move returns `from` unchanged
 *
 * That single rule is what keeps the component free of special cases and stops
 * a roving focus from ever leaving the drawn grid:
 *
 *   - Left and Right move a week and CROSS into the adjacent year when one is
 *     drawn, stopping at the first and last drawn day. A move into a collapsed
 *     empty run is refused; PageUp and PageDown are the keys that skip runs.
 *   - Up and Down stay inside the same week COLUMN, so they refuse at the top
 *     and bottom rows instead of wrapping into the neighbouring column (a
 *     Monday cannot go up, a Sunday cannot go down).
 *   - Home and End go to the first and last day of the SAME year that shares
 *     the focused weekday.
 *   - PageUp and PageDown go to the same month and day in the nearest older or
 *     newer ACTIVE year, clamping the day of month to that month's length, so
 *     February 29 becomes February 28 in a common year.
 */
export function calendarNavigate(model: CalendarModel, from: number, key: CalendarKey): number {
  const index = activeYearIndex(model, from);
  // A day that is not drawn is not a position the focus can be reasoned
  // about; leaving it alone is the safe answer and never throws.
  if (index === -1) return from;

  const year = model.years[index]!;

  switch (key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      const target = from + (key === 'ArrowLeft' ? -7 : 7);
      return activeYearIndex(model, target) === -1 ? from : target;
    }

    case 'ArrowUp':
    case 'ArrowDown': {
      const target = from + (key === 'ArrowUp' ? -1 : 1);
      // Both tests are needed: crossing a year edge changes the column by
      // construction, and a Sunday's next day is Monday, which is also a
      // different column of the same year.
      if (activeYearIndex(model, target) !== index) return from;
      return columnIn(year, target) === columnIn(year, from) ? target : from;
    }

    case 'Home': {
      const weekday = weekdayOfDay(from);
      const first = startOfYear(year);
      return first + ((weekday - weekdayOfDay(first) + 7) % 7);
    }

    case 'End': {
      const weekday = weekdayOfDay(from);
      const last = endOfYear(year);
      return last - ((weekdayOfDay(last) - weekday + 7) % 7);
    }

    case 'PageUp':
    case 'PageDown': {
      const next = index + (key === 'PageUp' ? -1 : 1);
      const targetYear = model.years[next];
      if (targetYear === undefined) return from;
      const { m, d } = civilFromDays(from);
      return daysFromCivil(targetYear, m, Math.min(d, daysInMonth(targetYear, m)));
    }
  }
}

// =============================================================================
// The weekday x hour heatmap (D-01, ACTIVITY-03)
// =============================================================================

/** One weekday-hour cell. 168 of them exist whatever the data says. */
export interface HourCell {
  /** `weekday * 24 + hour`, the index the stored grids already use. */
  index: number;
  /** Weekday row, 0 = Monday, matching the calendar above it. */
  weekday: number;
  /** Hour of day, 0-23. */
  hour: number;
  /** `gutter + hour * cell`. */
  x: number;
  /** `band + weekday * cell`. */
  y: number;
  /** Merged seconds this weekday-hour cell holds, on the chosen basis. */
  seconds: number;
  /** Shade level 0-5, 0 meaning no play. */
  level: number;
}

/** An hour label in the top band, every third column. */
export interface HourAxisLabel {
  hour: number;
  /** `gutter + hour * cell + cell / 2`, centred in its own column. */
  x: number;
}

/** A weekday label in the left gutter. */
export interface WeekdayAxisLabel {
  weekday: number;
  /** `band + weekday * cell`. */
  y: number;
}

/** The whole weekday x hour grid for one slice. */
export interface HourGridModel {
  cells: HourCell[];
  /** Computed over the non-zero cells only, as for the calendar. */
  scale: RankScale;
  legend: LegendModel;
  /** Hours 0, 3, 6 ... 21. */
  hourLabels: HourAxisLabel[];
  /** All seven weekdays, Monday first. */
  weekdayRows: WeekdayAxisLabel[];
}

/**
 * The 168-cell grid, reading ONE of the two stored bases (D-01).
 *
 * `basis` defaults to `HOUR_GRID_BASIS`, which is an UNRESOLVED constant: 04-01
 * stores both grids so a midnight-crossing session's attribution is a
 * one-constant change rather than a re-import, and this function takes the
 * basis as an argument so that flip needs no edit here and no edit in the
 * component. The other grid is read, never written.
 */
export function buildHourGridModel(
  slice: PlaytimeSlice,
  basis: HourGridBasis = HOUR_GRID_BASIS,
): HourGridModel {
  const { gutter, band, cell } = HOUR_GRID_LAYOUT;
  const grid = basis === 'start' ? slice.hourStart : slice.hourOverlap;
  const nonZero = grid.filter((value) => value > 0);
  const scale = rankScale(nonZero);
  const legend = legendModel(scale, nonZero);

  const cells: HourCell[] = [];
  for (let index = 0; index < HOUR_CELL_COUNT; index += 1) {
    const weekday = Math.floor(index / 24);
    const hour = index % 24;
    const seconds = grid[index] ?? 0;
    cells.push({
      index,
      weekday,
      hour,
      x: gutter + hour * cell,
      y: band + weekday * cell,
      seconds,
      level: scale.levelOf(seconds),
    });
  }

  const hourLabels: HourAxisLabel[] = [];
  for (let hour = 0; hour < 24; hour += 3) {
    hourLabels.push({ hour, x: gutter + hour * cell + cell / 2 });
  }

  const weekdayRows: WeekdayAxisLabel[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    weekdayRows.push({ weekday, y: band + weekday * cell });
  }

  return { cells, scale, legend, hourLabels, weekdayRows };
}

/** The six keys the hour grid's roving focus answers (04-UI-SPEC section 6). */
export type HourGridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/**
 * Where the hour grid's focused cell goes for one key press.
 *
 * Rows and columns both stop at their edge rather than wrapping: a wrapped
 * roving focus is a focus trap, and a reader pressing Right at Monday 23:00
 * expects the page to stay put, not to land on Tuesday 00:00. An index that is
 * not one of the 168 cells is returned unchanged, so a stale focus cannot be
 * moved to some other cell.
 */
export function hourGridNavigate(index: number, key: HourGridKey): number {
  if (!Number.isInteger(index) || index < 0 || index >= HOUR_CELL_COUNT) return index;

  const hour = index % 24;
  switch (key) {
    case 'ArrowLeft':
      return hour === 0 ? index : index - 1;
    case 'ArrowRight':
      return hour === 23 ? index : index + 1;
    case 'ArrowUp':
      return index < 24 ? index : index - 24;
    case 'ArrowDown':
      return index >= HOUR_CELL_COUNT - 24 ? index : index + 24;
    case 'Home':
      return index - hour;
    case 'End':
      return index - hour + 23;
  }
}

// =============================================================================
// Session durations (D-05, ACTIVITY-04)
// =============================================================================

/** One duration bin: how many sessions, what share, and how long the bar is. */
export interface DurationRow {
  /** Bin index 0-11, in `DURATION_BIN_EDGES_SECONDS` order. */
  bin: number;
  /** Sessions in the bin; the twelve counts sum to the Sessions tile. */
  count: number;
  /** Percent of the slice's usable sessions. 0 when there are none. */
  percent: number;
  /** Percent of the largest bin, floored at 1 for a non-empty bin. */
  barWidth: number;
}

/**
 * The twelve duration rows (D-05).
 *
 * Two different denominators on purpose. `percent` is a share of the slice, so
 * the counts read as the Sessions tile does; `barWidth` is a share of the
 * LARGEST bin, so the chart is scaled by its own peak and the shortest
 * sessions are still a visible bar rather than a rounding error. The log
 * progression is on the DURATION axis (fixed bin edges, D-05), never on the
 * bar length.
 *
 * A non-empty bin is never narrower than one unit, and the two empty-slice
 * cases return zeros rather than NaN: a bar with `width="NaN"` is a rendering
 * error the user would see.
 */
export function buildDurationRows(bins: readonly number[], sessions: number): DurationRow[] {
  const largest = bins.reduce((max, count) => (count > max ? count : max), 0);

  return Array.from({ length: DURATION_BIN_COUNT }, (_, bin) => {
    const count = bins[bin] ?? 0;
    return {
      bin,
      count,
      percent: sessions > 0 ? (count / sessions) * 100 : 0,
      barWidth: count === 0 || largest === 0 ? 0 : Math.max(1, (count / largest) * 100),
    };
  });
}

// =============================================================================
// The split table (D-03)
// =============================================================================

/** Value rows the table shows before it collapses the rest into a count. */
export const MAX_SPLIT_TABLE_VALUES = 8;

/** One row of the split table: the All row, or one value. */
export interface SplitTableRow {
  /** True for the leading All row. */
  isAll: boolean;
  /** Index into the split's value list, or null for All. */
  valueIndex: number | null;
  /** The untrusted value string, carried through untouched; null for All. */
  value: string | null;
  /** Merged seconds for the row. */
  seconds: number;
  /** True for exactly the row the selector is on. */
  selected: boolean;
}

/** The whole split table, capped so 50 values cannot grow it. */
export interface SplitTableModel {
  rows: SplitTableRow[];
  /** Values past the eighth row, for the "{n} more in the selector" row. */
  moreCount: number;
}

/**
 * All plus at most eight value rows, with the remainder counted (D-03).
 *
 * The cap is the UI-SPEC's overflow rule: the native `<select>` still lists
 * every value, so the table does not need to. A selection past the eighth row
 * therefore flags nothing here — the selector and the live region are what
 * report it, and the table never grows to reach it.
 *
 * A null split (no qualifying column, UI-SPEC section 3) yields an empty model
 * rather than a throw, so the component needs no branch of its own and cannot
 * render a row for a split that does not exist. Labels are `ui-copy`'s job; this
 * carries numbers and the raw value string.
 */
export function buildSplitTable(
  split: PlaytimeSplit | null,
  selected: number | null,
): SplitTableModel {
  if (split === null) return { rows: [], moreCount: 0 };

  const shown = split.values.slice(0, MAX_SPLIT_TABLE_VALUES);
  const rows: SplitTableRow[] = [
    {
      isAll: true,
      valueIndex: null,
      value: null,
      seconds: split.allSeconds,
      selected: selected === null,
    },
  ];

  for (const [valueIndex, entry] of shown.entries()) {
    rows.push({
      isAll: false,
      valueIndex,
      value: entry.value,
      seconds: entry.seconds,
      selected: selected === valueIndex,
    });
  }

  return { rows, moreCount: Math.max(0, split.values.length - MAX_SPLIT_TABLE_VALUES) };
}

// =============================================================================
// Selection lifetime (D-03)
// =============================================================================

/** A requested selection, remembered together with the dataset it was for. */
export interface SelectionRequest {
  /** The dataset the request was made against; null when there was none. */
  importedAt: string | null;
  /** The requested value index; null means All. */
  valueIndex: number | null;
}

/**
 * The selection that may actually be applied right now, or null for All.
 *
 * Three refusals, and together they are the whole of D-03's state-lifetime
 * rule: a request for a DIFFERENT dataset (a replace landed while a query was
 * in flight), a request whose index no longer exists in the current value list,
 * and anything that is not a whole index in range. Every other case is All.
 *
 * Returning All rather than raising is deliberate: there is then no reset hook
 * to forget, because a stale selection is simply never applicable.
 */
export function effectiveSelection(
  request: SelectionRequest | null,
  importedAt: string | null,
  valueCount: number,
): number | null {
  if (request === null || request.valueIndex === null) return null;
  if (importedAt === null || request.importedAt !== importedAt) return null;

  const index = request.valueIndex;
  if (!Number.isInteger(index) || index < 0 || index >= valueCount) return null;
  return index;
}

// =============================================================================
// Tooltip placement and focus scrolling
//
// Both exist here as numbers because the CSP has no `style-src 'unsafe-inline'`
// and `svelte/no-inline-styles` is an error in this repo, so the tooltip is
// positioned through the CSSOM. The arithmetic — flip, clamp, floor — is the
// part worth testing, and it is testable with no page.
// =============================================================================

/** The gap between a cell and the tooltip, and the gap kept at each edge. */
export const TOOLTIP_GAP = 8;

/** Minimum distance kept between the tooltip and every viewport edge. */
export const TOOLTIP_EDGE = 8;

/** A positioned box: a cell's bounding rect, a tooltip's size, a viewport. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** What the component knows when it opens the shared tooltip. */
export interface TooltipRequest {
  /** The focused or hovered cell's bounding rect. */
  anchor: Rect;
  /** First line: the cell's date or weekday-hour label. */
  line1: string;
  /** Second line: its hours and session count, or "no sessions". */
  line2: string;
  /** Optional extra lines (e.g. grant sizes or as-recorded lines in financial timelines). */
  extra?: readonly string[];
}

/** Where the shared tooltip goes, and which side of the cell it opened on. */
export interface TooltipPlacement {
  left: number;
  top: number;
  placement: 'above' | 'below';
}

/**
 * Place the one shared tooltip over a cell (04-UI-SPEC section 8).
 *
 * Centred horizontally with an 8px gap; flipped below the cell when there is
 * not `navOffset + 8px` of room above, because the sticky nav is always
 * there and a tooltip under it is a tooltip nobody can read; then clamped so
 * it keeps 8px from the left, right and bottom edges, and floored at 8px from
 * the top-left corner for a viewport too small to hold it at all.
 *
 * A `Rect` rather than a live element, so this is arithmetic over numbers.
 */
export function clampTooltip(
  anchor: Rect,
  tip: { width: number; height: number },
  viewport: { width: number; height: number },
  navOffset: number,
): TooltipPlacement {
  const centred = anchor.left + anchor.width / 2 - tip.width / 2;
  const left = Math.max(TOOLTIP_EDGE, Math.min(centred, viewport.width - tip.width - TOOLTIP_EDGE));

  const above = anchor.top - tip.height - TOOLTIP_GAP;
  const below = anchor.top + anchor.height + TOOLTIP_GAP;
  // "Not enough room above" is exactly "the top edge would be closer than the
  // gap to the bottom of the sticky nav".
  const placement = above < navOffset + TOOLTIP_GAP ? 'below' : 'above';
  const top = Math.max(
    TOOLTIP_EDGE,
    Math.min(placement === 'above' ? above : below, viewport.height - tip.height - TOOLTIP_EDGE),
  );

  return { left, top, placement };
}

/**
 * How far a focused cell is short of clearing the sticky nav and the year head
 * (RESEARCH Pitfall 6).
 *
 * `scroll-margin-top` is not reliable on an SVG `<rect>`, so the caller
 * measures the rect and corrects. The required clear line is the nav's bottom
 * plus the year head's measured height plus the 8px gap; anything at or below
 * it is already clear and reports 0, so the caller must not scroll at all.
 *
 * THE SIGN: the return is the vertical scroll TO APPLY, passed through to
 * `window.scrollBy` unchanged. It is negative when the cell is short of the
 * clear line, and a negative top scrolls the page UP, which moves the cell
 * down on screen and out from under the chrome — a focused cell that is
 * behind the nav or the head needs exactly that, whenever it takes focus while
 * on screen and under the chrome, which is the normal state while scrolling
 * down through the stacked years. 0 means "do not scroll". The value is
 * therefore never positive.
 */
export function focusScrollDelta(rect: Rect, navBottom: number, headHeight: number): number {
  const requiredTop = navBottom + headHeight + TOOLTIP_GAP;
  return Math.min(0, rect.top - requiredTop);
}

/**
 * Hours for a `data-hours` attribute or an accessible name, to four decimals
 * with no trailing zeros.
 *
 * Four decimals because one second is 0.000277... hours: rounding to two would
 * print "0 hours" for a real session, which is a wrong answer rather than a
 * rounded one. Integer arithmetic rather than `toFixed`, so 1.5 is 1.5 and not
 * 1.5000 (and so no float formatting rule is depended on).
 */
export function hoursAttribute(seconds: number): number {
  return Math.round((seconds * 10_000) / 3600) / 10_000;
}
