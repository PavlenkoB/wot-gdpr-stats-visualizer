// =============================================================================
// playtime-model — every Phase 4 chart decision as a pure function.
//
// WHY THIS FILE EXISTS
//
// The Phase 4 components (plans 04-08, 04-09, 04-10) are thin glue: they take
// the numbers out of this model and turn them into `<rect>` attributes, class
// names and words. Every DECISION those components make — which shade a day
// gets, where its 10x10 rect goes, what the arrow keys do, which side of the
// sticky nav the tooltip opens on — lives here, so it can be stated once and
// tested without a browser.
//
// The repo's Vitest setup is `environment: 'node'` and deliberately has no
// jsdom (see vitest.config.ts: adding one was tried in 01-04 and rejected).
// That is a feature here, not a limitation: the parts most likely to be subtly
// wrong — the rank scale's tie handling, a navigation reducer that wraps at a
// row edge, a tooltip that lands under the sticky nav — are exactly the parts
// that are painful to pin down from a screenshot. They are arithmetic, so they
// are tested as arithmetic. The DOM wiring stays in the components.
//
// D-04 makes the scale rank-based precisely so ordinary days stay
// distinguishable; these tests are what hold that rule to hand arithmetic
// rather than to a visual impression.
//
// The module under test is loaded through `load()` rather than a static import
// so a missing export is a failure IN THE TEST THAT NEEDS IT, naming the
// symbol, instead of a load-time crash that takes the whole file down and
// hides which behaviours are and are not implemented.
// =============================================================================

import { describe, expect, it } from 'vitest';

import type { PlaytimeSlice, PlaytimeSplit } from '../../src/lib/types/worker-messages';
import { oracleSlice, randomSessions, type OracleSession } from '../helpers/session-oracle';

type Model = typeof import('../../src/lib/playtime-model');

let cached: Promise<Model> | null = null;

const load = (): Promise<Model> => {
  cached ??= import('../../src/lib/playtime-model');
  return cached;
};

/**
 * Day number for a civil date, computed with `Date.UTC` on purpose.
 *
 * The module under test uses `daysFromCivil`/`civilFromDays` (Hinnant integer
 * arithmetic, D-01: never `new Date`, so a reader in another timezone gets the
 * same answer). The tests deliberately use the OTHER path so a calendar bug
 * cannot cancel out on both sides.
 */
const day = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d) / 86_400_000;

/** A zero-filled slice with the three per-day arrays the caller supplies. */
const sliceWithDays = (
  dayIndex: number[],
  daySeconds: number[],
  daySessions: number[],
): PlaytimeSlice => ({
  seconds: daySeconds.reduce((total, value) => total + value, 0),
  sessions: daySessions.reduce((total, value) => total + value, 0),
  excluded: 0,
  dayIndex,
  daySeconds,
  daySessions,
  hourOverlap: new Array<number>(168).fill(0),
  hourStart: new Array<number>(168).fill(0),
  bins: new Array<number>(12).fill(0),
});

/** Every cell of a year block, flattened out of its seven row arrays. */
const cellsOf = <T>(rows: readonly T[][]): T[] => rows.flat();

// =============================================================================
// 04-05 tracer: rank scale and a one-day calendar.
//
// THE INPUT IS CHOSEN TO BE HAND-CHECKABLE, NOT REPRESENTATIVE.
//
// 2020-12-31 is a Thursday, and 2020 is a leap year, so that day is day-of-year
// index 365 of 366 and January 1 fell on a Wednesday (Monday = 0, so
// weekdayOfDay(Jan 1) = 2). The cell therefore lands at:
//
//   col = floor((365 + 2) / 7) = floor(52.428) = 52
//   row = (365 + 2) % 7         = 367 - 364       = 3
//   x   = 32 + 52 * 11 = 604    y = 20 + 3 * 11 = 53
//
// Every expectation below is written from that arithmetic and from Date.UTC,
// never read back out of the module. RESEARCH verified the same formula
// against 2012 (54 columns) and 2020-12-31 (column 52, row 3 = Thursday).
// =============================================================================

describe('04-05 tracer: rank scale and a one-day calendar', () => {
  it('puts the four cut points at the 20/40/60/80 percentiles of the non-zero values', async () => {
    const { rankScale } = await load();

    // Ten ascending values: cut k is the value at index 2k - 1.
    const scale = rankScale([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(scale.cuts).toEqual([2, 4, 6, 8]);

    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(scale.levelOf)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
  });

  it('gives zero no level at all, so a day with no play is never shaded', async () => {
    const { rankScale } = await load();

    expect(rankScale([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).levelOf(0)).toBe(0);
    expect(rankScale([]).levelOf(0)).toBe(0);
  });

  it('has no cuts and no levels to draw for an empty slice', async () => {
    const { rankScale } = await load();

    expect(rankScale([]).cuts).toEqual([]);
  });

  it('places every value in the lowest level when the cuts are all equal', async () => {
    const { rankScale } = await load();

    // Three identical days: all four cuts are 5, so levels 2-5 go unused
    // (UI-SPEC "zero-one-many": duplicate levels collapse).
    const scale = rankScale([5, 5, 5]);
    expect(scale.cuts).toEqual([5, 5, 5, 5]);
    expect([5, 5, 5].map(scale.levelOf)).toEqual([1, 1, 1]);
    // The lowest cut is still a cut: anything above zero is shaded, and only
    // zero is level 0.
    expect(scale.levelOf(1)).toBe(1);
    expect(scale.levelOf(0)).toBe(0);
  });

  it('spreads a two-value slice across the ramp instead of one cut', async () => {
    const { rankScale } = await load();

    // n = 2: cut k is the value at index min(1, ceil(2k/5) - 1), which is
    // index 0 for k = 1,2 and index 1 for k = 3,4.
    const scale = rankScale([3, 7]);
    expect(scale.cuts).toEqual([3, 3, 7, 7]);
    expect(scale.levelOf(3)).toBe(1);
    expect(scale.levelOf(7)).toBe(3);
  });

  it('puts a single value in level 1 and a heavy tail in level 5', async () => {
    const { rankScale } = await load();

    // One active day: there is no fifth to compare against, so it is the
    // lowest level. This is the single-day case the e2e fixtures hit on a
    // fresh account.
    const single = rankScale([3600]);
    expect(single.cuts).toEqual([3600, 3600, 3600, 3600]);
    expect(single.levelOf(3600)).toBe(1);

    // Nine ordinary days and one outlier: the cuts collapse onto the ordinary
    // value, which is exactly the D-04 point — the outlier takes the top shade
    // and the ordinary days still separate.
    const heavyTail = rankScale([1, 1, 1, 1, 1, 1, 1, 1, 1, 1000]);
    expect(heavyTail.cuts).toEqual([1, 1, 1, 1]);
    expect(heavyTail.levelOf(1)).toBe(1);
    expect(heavyTail.levelOf(1000)).toBe(5);
  });

  it('lists level 0 plus the levels in use, and names the darkest boundary only when level 5 is used', async () => {
    const { legendModel, rankScale } = await load();

    const ramp = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const full = legendModel(rankScale(ramp), ramp);
    expect(full.levels).toEqual([0, 1, 2, 3, 4, 5]);
    expect(full.darkestAbove).toBe(8);

    // One level in use: the "Darkest: more than X" sentence is omitted, so the
    // boundary must be null rather than a number nobody should read.
    const flat = legendModel(rankScale([5, 5, 5]), [5, 5, 5]);
    expect(flat.levels).toEqual([0, 1]);
    expect(flat.darkestAbove).toBeNull();

    const none = legendModel(rankScale([]), []);
    expect(none.levels).toEqual([0]);
    expect(none.darkestAbove).toBeNull();
  });

  it('draws 366 cells for one active year and puts 2020-12-31 at column 52, row 3', async () => {
    const { buildCalendarModel } = await load();

    const model = buildCalendarModel(sliceWithDays([day(2020, 12, 31)], [3600], [2]));

    expect(model.blocks).toHaveLength(1);
    const block = model.blocks[0]!;
    expect(block.kind).toBe('year');
    if (block.kind !== 'year') throw new Error('expected a year block');

    expect(block.year).toBe(2020);
    expect(model.cellCount).toBe(366);
    expect(model.years).toEqual([2020]);
    // 366 cells spread over seven weekday rows, the last column at 52.
    expect(block.rows).toHaveLength(7);
    expect(cellsOf(block.rows)).toHaveLength(366);
    expect(block.columns).toBe(53);

    const cells = cellsOf(block.rows);
    const drawn = cells.filter((cell) => cell.seconds > 0);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toMatchObject({
      col: 52,
      row: 3,
      x: 604,
      y: 53,
      level: 1,
      seconds: 3600,
      sessions: 2,
      date: '2020-12-31',
    });

    // Every other day of the year is drawn and empty — D-04 draws all of the
    // year so the grid is a rectangle, not a cloud of session nodes.
    expect(cells.filter((cell) => cell.seconds === 0)).toHaveLength(365);
    expect(cells.every((cell) => cell.sessions === 0 || cell.date === '2020-12-31')).toBe(true);
    expect(
      cellsOf(block.rows).every((cell) => cell.level === 0 || cell.date === '2020-12-31'),
    ).toBe(true);
  });

  it('totals a year from its days and reconciles with the slice', async () => {
    const { buildCalendarModel } = await load();

    const slice = sliceWithDays([day(2020, 12, 31)], [3600], [2]);
    const model = buildCalendarModel(slice);
    const block = model.blocks[0]!;
    if (block.kind !== 'year') throw new Error('expected a year block');

    expect(block.seconds).toBe(3600);
    expect(block.sessions).toBe(2);
    // Active days counts DAYS with a usable session, which can exceed the
    // number of shaded cells (Pitfall 4: a zero-second day is still active).
    expect(block.activeDays).toBe(1);
    expect(cellsOf(block.rows).reduce((total, cell) => total + cell.seconds, 0)).toBe(3600);
    expect(cellsOf(block.rows).reduce((total, cell) => total + cell.sessions, 0)).toBe(2);
  });

  it('formats a day number as a zero-padded ISO date without touching the Date constructor', async () => {
    const { isoDate } = await load();

    expect(isoDate(day(2020, 12, 31))).toBe('2020-12-31');
    expect(isoDate(day(2012, 2, 29))).toBe('2012-02-29');
    expect(isoDate(day(1970, 1, 1))).toBe('1970-01-01');
  });

  it('imports no ui-copy and no Svelte, and never constructs a Date', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../../src/lib/playtime-model.ts', import.meta.url),
      'utf8',
    );
    // Comments are stripped first: the module's WHY-header names these
    // constraints in prose, and the constraint is about the code.
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');

    // The plan's own acceptance criterion is a grep over the import lines, and
    // these three are the boundaries the module must not grow: a component
    // framework (runes are unavailable to a node-environment test), the copy
    // module (models carry numbers, never words), and the Date constructor
    // (D-01 — a reader in another timezone must get the same numbers).
    expect(code).not.toMatch(/from 'svelte/);
    expect(code).not.toMatch(/ui-copy/);
    expect(code).not.toMatch(/\$state|\$derived|\$effect/);
    expect(code).not.toMatch(/\bnew Date\b|toLocale/);
  });
});

// =============================================================================
// calendar layout — multi-year blocks, empty-run collapse and month labels
//
// A run of consecutive empty years is the DoS case T-04-08 is about: one
// stray 1970 or 9999 row between two real years would otherwise draw dozens of
// empty 366-cell grids. The collapse is therefore a node-budget property, so
// it is asserted as one: three active years, 1095 cells, and the stray years
// contribute nothing but a range.
// =============================================================================

describe('calendar layout', () => {
  it('stacks years newest first and collapses one empty year between two active ones', async () => {
    const { buildCalendarModel } = await load();

    const model = buildCalendarModel(
      sliceWithDays([day(2019, 6, 1), day(2021, 6, 1)], [3600, 7200], [1, 2]),
    );

    expect(model.blocks.map((block) => block.kind)).toEqual(['year', 'empty', 'year']);
    expect(model.blocks.map((block) => (block.kind === 'year' ? block.year : 'gap'))).toEqual([
      2021,
      'gap',
      2019,
    ]);
    const gap = model.blocks[1]!;
    if (gap.kind !== 'empty') throw new Error('expected an empty block');
    expect(gap.fromYear).toBe(2020);
    expect(gap.toYear).toBe(2020);
    expect(model.years).toEqual([2019, 2021]);
  });

  it('emits no empty block between consecutive active years', async () => {
    const { buildCalendarModel } = await load();

    const model = buildCalendarModel(
      sliceWithDays([day(2019, 6, 1), day(2020, 6, 1)], [3600, 7200], [1, 2]),
    );

    expect(model.blocks.every((block) => block.kind === 'year')).toBe(true);
    expect(model.blocks).toHaveLength(2);
  });

  it('absorbs a stray 1970 and a stray 9999 into two gap blocks and 1095 cells', async () => {
    const { buildCalendarModel } = await load();

    // The threat case: a crafted or corrupt row puts 1970 and 9999 alongside a
    // real 2019. Nothing may be drawn for the years between them.
    const model = buildCalendarModel(
      sliceWithDays([day(1970, 1, 1), day(2019, 6, 1), day(9999, 1, 1)], [1, 1, 1], [1, 1, 1]),
    );

    expect(model.blocks.filter((block) => block.kind === 'year')).toHaveLength(3);
    expect(model.blocks.filter((block) => block.kind === 'empty')).toHaveLength(2);
    expect(
      model.blocks.map((block) =>
        block.kind === 'year' ? block.year : [block.fromYear, block.toYear],
      ),
    ).toEqual([9999, [2020, 9998], 2019, [1971, 2018], 1970]);
    // None of 1970, 2019 and 9999 is a leap year, so 3 * 365.
    expect(model.cellCount).toBe(1095);
  });

  it('gives 2012 the full 54 columns and never asks for a 55th', async () => {
    const { buildCalendarModel } = await load();
    const { CALENDAR_LAYOUT } = await load();

    // 2012 begins on a Sunday, so its last day sits at column
    // floor((365 + 6) / 7) = 53 and the year needs 54 columns.
    const leap = buildCalendarModel(sliceWithDays([day(2012, 6, 1)], [3600], [1]));
    const leapBlock = leap.blocks[0]!;
    if (leapBlock.kind !== 'year') throw new Error('expected a year block');
    expect(leapBlock.columns).toBe(54);

    // The width constant is derived from that 54, so a year needing more would
    // silently overflow the scroller. Sweep the range RESEARCH verified.
    let widest = 0;
    for (let year = 1990; year <= 2060; year += 1) {
      const model = buildCalendarModel(sliceWithDays([day(year, 7, 1)], [1], [1]));
      const block = model.blocks[0]!;
      if (block.kind !== 'year') throw new Error('expected a year block');
      for (const cell of cellsOf(block.rows)) {
        expect(cell.col).toBeLessThan(CALENDAR_LAYOUT.maxColumns);
        expect(cell.row).toBeLessThan(7);
        expect(cell.x).toBe(CALENDAR_LAYOUT.gutter + cell.col * CALENDAR_LAYOUT.pitch);
        expect(cell.y).toBe(CALENDAR_LAYOUT.band + cell.row * CALENDAR_LAYOUT.pitch);
      }
      if (block.columns > widest) widest = block.columns;
    }
    expect(widest).toBe(54);
  });

  it('partitions a year into seven weekday rows ordered by column', async () => {
    const { buildCalendarModel } = await load();

    const model = buildCalendarModel(sliceWithDays([day(2020, 6, 1)], [3600], [1]));
    const block = model.blocks[0]!;
    if (block.kind !== 'year') throw new Error('expected a year block');

    expect(block.rows).toHaveLength(7);
    expect(cellsOf(block.rows)).toHaveLength(366);
    for (const row of block.rows) {
      const columns = row.map((cell) => cell.col);
      expect(columns).toEqual([...columns].sort((a, b) => a - b));
      expect(new Set(row.map((cell) => cell.row)).size).toBeLessThanOrEqual(1);
    }
  });

  it('places twelve month labels, each at the column of that month s first day', async () => {
    const { buildCalendarModel } = await load();

    // 2018-01-01 was a Monday, so January's label sits in the gutter column.
    const mondayYear = buildCalendarModel(sliceWithDays([day(2018, 6, 1)], [1], [1]));
    const mondayBlock = mondayYear.blocks[0]!;
    if (mondayBlock.kind !== 'year') throw new Error('expected a year block');
    expect(mondayBlock.monthLabels).toHaveLength(12);
    expect(mondayBlock.monthLabels[0]).toMatchObject({ month: 1, col: 0, x: 32 });

    // 2020-01-01 was a Wednesday, so the first days of January fill the top of
    // week column 0 and its label is still column 0 — while February 1 (a
    // Saturday, day-of-year index 31) lands at floor((31 + 2) / 7) = 4. The
    // labels follow each month's first day rather than being spread evenly, and
    // every pair is at least four columns (44px) apart, the shortest month
    // being 28 days.
    const block = buildCalendarModel(sliceWithDays([day(2020, 12, 31)], [3600], [2])).blocks[0]!;
    if (block.kind !== 'year') throw new Error('expected a year block');
    expect(block.monthLabels).toHaveLength(12);
    expect(block.monthLabels[0]).toMatchObject({ month: 1, col: 0, x: 32 });
    expect(block.monthLabels[1]).toMatchObject({ month: 2, col: 4, x: 76 });
    for (let i = 1; i < block.monthLabels.length; i += 1) {
      expect(block.monthLabels[i]!.x - block.monthLabels[i - 1]!.x).toBeGreaterThanOrEqual(44);
    }
  });

  it('totals each year from its days and reconciles with the slice total', async () => {
    const { buildCalendarModel } = await load();

    const daySeconds = [1800, 3600, 900];
    const model = buildCalendarModel(
      sliceWithDays([day(2019, 3, 1), day(2020, 7, 4), day(2020, 12, 31)], daySeconds, [1, 2, 3]),
    );

    const years = model.blocks.filter((block) => block.kind === 'year');
    expect(
      years.reduce((total, block) => total + (block.kind === 'year' ? block.seconds : 0), 0),
    ).toBe(daySeconds.reduce((total, value) => total + value, 0));
    expect(
      years.reduce((total, block) => total + (block.kind === 'year' ? block.sessions : 0), 0),
    ).toBe(6);
    for (const block of years) {
      if (block.kind !== 'year') continue;
      expect(block.seconds).toBe(
        cellsOf(block.rows).reduce((total, cell) => total + cell.seconds, 0),
      );
      expect(block.sessions).toBe(
        cellsOf(block.rows).reduce((total, cell) => total + cell.sessions, 0),
      );
    }
  });

  it('knows which days are drawn and which belong to a collapsed run', async () => {
    const { buildCalendarModel, initialCalendarFocus, isDrawnDay } = await load();

    const model = buildCalendarModel(
      sliceWithDays([day(2019, 6, 1), day(2021, 6, 1)], [3600, 7200], [1, 2]),
    );

    expect(isDrawnDay(model, day(2019, 1, 1))).toBe(true);
    expect(isDrawnDay(model, day(2019, 12, 31))).toBe(true);
    expect(isDrawnDay(model, day(2021, 1, 1))).toBe(true);
    expect(isDrawnDay(model, day(2021, 12, 31))).toBe(true);
    // Inside the collapsed run, and past both ends.
    expect(isDrawnDay(model, day(2020, 6, 15))).toBe(false);
    expect(isDrawnDay(model, day(2018, 6, 15))).toBe(false);
    expect(isDrawnDay(model, day(2022, 1, 1))).toBe(false);

    // Tab lands on the first cell of the NEWEST year (UI-SPEC keyboard table).
    expect(initialCalendarFocus(model)).toBe(day(2021, 1, 1));
    expect(initialCalendarFocus(buildCalendarModel(sliceWithDays([], [], [])))).toBeNull();
  });

  it('builds a forty-year model in well under 100 ms', async () => {
    const { buildCalendarModel } = await load();

    const dayIndex: number[] = [];
    for (let year = 2000; year < 2040; year += 1) dayIndex.push(day(year, 6, 15));
    const slice = sliceWithDays(
      dayIndex,
      dayIndex.map((_, index) => 3600 + index),
      dayIndex.map(() => 1),
    );

    const started = performance.now();
    const model = buildCalendarModel(slice);
    const elapsed = performance.now() - started;

    expect(model.blocks).toHaveLength(40);
    // Node count is a function of the years drawn, not of the sessions: 40
    // contiguous years collapse to zero gap blocks, and the cell count is the
    // days in those years — ten of 2000-2039 are leap years.
    const isLeap = (year: number): boolean =>
      (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const drawn = Array.from({ length: 40 }, (_, index) => 2000 + index).reduce(
      (total, year) => total + (isLeap(year) ? 366 : 365),
      0,
    );
    expect(model.cellCount).toBe(drawn);
    expect(elapsed).toBeLessThan(100);
  });
});

// =============================================================================
// calendar levels and legend — a day with sessions but no seconds (Pitfall 4)
// =============================================================================

describe('calendar levels and legend', () => {
  it('shares the lowest level between equal days and lifts the outlier well clear', async () => {
    const { buildCalendarModel } = await load();

    // Two 60-second days and one hour: the rank scale cuts [60,60,60,3600], so
    // the ordinary days share level 1 and the outlier lands at level 4.
    const model = buildCalendarModel(
      sliceWithDays(
        [day(2020, 1, 1), day(2020, 6, 1), day(2020, 12, 1)],
        [60, 60, 3600],
        [1, 1, 1],
      ),
    );
    const block = model.blocks[0]!;
    if (block.kind !== 'year') throw new Error('expected a year block');
    const byDate = new Map(cellsOf(block.rows).map((cell) => [cell.date, cell]));

    const first = byDate.get('2020-01-01')!;
    const second = byDate.get('2020-06-01')!;
    const outlier = byDate.get('2020-12-01')!;

    expect(first.level).toBe(second.level);
    expect(outlier.level).toBeGreaterThanOrEqual(first.level + 2);
    // The legend prints exactly the levels the chart contains.
    expect(model.legend.levels).toEqual([0, first.level, outlier.level].sort((a, b) => a - b));
  });

  it('keeps the session count on a day with zero merged seconds and shades it level 0', async () => {
    const { buildCalendarModel } = await load();

    // Pitfall 4: a zero-length or fully-contained session adds a session and
    // an active day but no seconds. The cell must be unshaded and must still
    // say "1 session", never "no sessions".
    const model = buildCalendarModel(
      sliceWithDays([day(2020, 1, 1), day(2020, 6, 1)], [0, 3600], [1, 1]),
    );
    const block = model.blocks[0]!;
    if (block.kind !== 'year') throw new Error('expected a year block');
    const empty = cellsOf(block.rows).find((cell) => cell.date === '2020-01-01')!;

    expect(empty.seconds).toBe(0);
    expect(empty.sessions).toBe(1);
    expect(empty.level).toBe(0);
    // The year's ACTIVE day count includes it: activity is measured in
    // sessions, not in shaded cells.
    expect(block.activeDays).toBe(2);
    expect(model.legend.levels).toEqual([0, 1]);
  });
});

// =============================================================================
// calendar navigation — the UI-SPEC key table, case by case
//
// The calendar's grid is a rectangle of 366 days, so every move has a defined
// answer and a defined refusal. What these cases pin down is the REFUSAL: a
// roving focus that wraps is a focus trap, and one that walks into a collapsed
// gap walks off the drawn grid entirely. Every impossible move returns the
// origin day unchanged, so the component needs no special case.
// =============================================================================

describe('calendar navigation', () => {
  /** Contiguous active years 2019 and 2020, the two-year model most cases use. */
  const twoYears = async () => {
    const { buildCalendarModel } = await load();
    return buildCalendarModel(
      sliceWithDays([day(2019, 6, 1), day(2020, 6, 1)], [3600, 3600], [1, 1]),
    );
  };

  it('moves a week left and right', async () => {
    const { calendarNavigate } = await load();
    const model = await twoYears();

    // 2020-03-15 is a Sunday: 2020-01-01 was a Wednesday, so March 1 was a
    // Sunday too and the 15th is two weeks later.
    expect(calendarNavigate(model, day(2020, 3, 15), 'ArrowLeft')).toBe(day(2020, 3, 8));
    expect(calendarNavigate(model, day(2020, 3, 15), 'ArrowRight')).toBe(day(2020, 3, 22));
  });

  it('moves one weekday up, and refuses to move down off a Sunday', async () => {
    const { calendarNavigate } = await load();
    const model = await twoYears();

    expect(calendarNavigate(model, day(2020, 3, 15), 'ArrowUp')).toBe(day(2020, 3, 14));
    // Down from a Sunday would land in the NEXT week column, which is a wrap.
    expect(calendarNavigate(model, day(2020, 3, 15), 'ArrowDown')).toBe(day(2020, 3, 15));
  });

  it('jumps to the first and last week of the year on the current weekday', async () => {
    const { calendarNavigate } = await load();
    const model = await twoYears();

    // The first Sunday of 2020 is January 5 (January 1 was a Wednesday) and
    // the last is December 27 (December 31 was a Thursday).
    expect(calendarNavigate(model, day(2020, 3, 15), 'Home')).toBe(day(2020, 1, 5));
    expect(calendarNavigate(model, day(2020, 3, 15), 'End')).toBe(day(2020, 12, 27));
  });

  it('steps to the same date one year earlier, and stops at the oldest year', async () => {
    const { calendarNavigate } = await load();
    const model = await twoYears();

    expect(calendarNavigate(model, day(2020, 3, 15), 'PageUp')).toBe(day(2019, 3, 15));
    expect(calendarNavigate(model, day(2020, 3, 15), 'PageDown')).toBe(day(2020, 3, 15));
  });

  it('clamps February 29 to February 28 in a common year', async () => {
    const { calendarNavigate } = await load();
    const model = await twoYears();

    expect(calendarNavigate(model, day(2020, 2, 29), 'PageUp')).toBe(day(2019, 2, 28));
  });

  it('crosses into the adjacent drawn year and stops at the oldest first week', async () => {
    const { calendarNavigate } = await load();
    const model = await twoYears();

    // The first Sunday of 2020 is January 5; a week back is 2019-12-29, and
    // 2019 is drawn.
    expect(calendarNavigate(model, day(2020, 1, 5), 'ArrowLeft')).toBe(day(2019, 12, 29));
    // 2019-01-01 was a Tuesday and starts its own column; a week back would
    // be 2018, which is not drawn.
    expect(calendarNavigate(model, day(2019, 1, 1), 'ArrowLeft')).toBe(day(2019, 1, 1));
  });

  it('refuses to move up off a Monday and off the first day of the year', async () => {
    const { calendarNavigate } = await load();
    const model = await twoYears();

    // 2020-03-02 is a Monday, the top row: up would be the previous column.
    expect(calendarNavigate(model, day(2020, 3, 2), 'ArrowUp')).toBe(day(2020, 3, 2));
    // 2020-01-01 is a Wednesday, but it is in column 0: the cell above it is
    // 2019-12-31, a different column and a different year.
    expect(calendarNavigate(model, day(2020, 1, 1), 'ArrowUp')).toBe(day(2020, 1, 1));
  });

  it('skips collapsed empty years on PageUp and PageDown, and refuses to walk into one with an arrow', async () => {
    const { buildCalendarModel, calendarNavigate } = await load();

    // 2018 and 2021 only: 2019 and 2020 are one collapsed run.
    const model = buildCalendarModel(
      sliceWithDays([day(2018, 6, 1), day(2021, 6, 1)], [3600, 3600], [1, 1]),
    );

    expect(calendarNavigate(model, day(2021, 6, 10), 'PageUp')).toBe(day(2018, 6, 10));
    expect(calendarNavigate(model, day(2018, 6, 10), 'PageDown')).toBe(day(2021, 6, 10));
    // A week before 2021-01-03 is 2020-12-27, inside the collapsed run.
    expect(calendarNavigate(model, day(2021, 1, 3), 'ArrowLeft')).toBe(day(2021, 1, 3));
    // A week after the last drawn day of 2021 is in 2022, which is not drawn.
    expect(calendarNavigate(model, day(2021, 12, 31), 'ArrowRight')).toBe(day(2021, 12, 31));
  });

  it('returns the origin day for an empty model rather than throwing', async () => {
    const { buildCalendarModel, calendarNavigate } = await load();

    const empty = buildCalendarModel(sliceWithDays([], [], []));
    for (const key of [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ] as const) {
      expect(calendarNavigate(empty, day(2020, 3, 15), key)).toBe(day(2020, 3, 15));
    }
  });
});

// =============================================================================
// hour grid model and keys — 168 cells, basis by argument
//
// The basis case is built from a slice whose two grids DISAGREE, because a
// slice where they agree cannot tell a basis switch from a constant. 04-01
// stores both grids and `HOUR_GRID_BASIS` is still an open UI-SPEC row, so the
// model takes the basis as an argument and never hard-codes one.
// =============================================================================

describe('hour grid model and keys', () => {
  /** A slice whose two stored hour grids disagree at cell 10. */
  const divergentSlice = (): PlaytimeSlice => {
    const slice = sliceWithDays([], [], []);
    slice.hourOverlap = new Array<number>(168).fill(0);
    slice.hourStart = new Array<number>(168).fill(0);
    slice.hourOverlap[10] = 900;
    slice.hourStart[10] = 1500;
    return slice;
  };

  it('lays out 168 fixed cells indexed weekday times 24 plus hour', async () => {
    const { buildHourGridModel, HOUR_GRID_LAYOUT } = await load();

    const model = buildHourGridModel(divergentSlice());
    expect(model.cells).toHaveLength(168);

    model.cells.forEach((cell, index) => {
      expect(cell.index).toBe(index);
      expect(cell.weekday).toBe(Math.floor(index / 24));
      expect(cell.hour).toBe(index % 24);
      expect(cell.x).toBe(HOUR_GRID_LAYOUT.gutter + cell.hour * HOUR_GRID_LAYOUT.cell);
      expect(cell.y).toBe(HOUR_GRID_LAYOUT.band + cell.weekday * HOUR_GRID_LAYOUT.cell);
    });
    // The grid's size is fixed regardless of the data: that is the ACTIVITY-03
    // scale requirement, provable here without a browser.
    expect(model.cells[0]).toMatchObject({ weekday: 0, hour: 0, x: 48, y: 24 });
    expect(model.cells[167]).toMatchObject({ weekday: 6, hour: 23, x: 600, y: 168 });
  });

  it('reads the grid the basis argument names, and both grids stay stored', async () => {
    const { buildHourGridModel } = await load();
    const { HOUR_GRID_BASIS } = await import('../../src/lib/playtime-shared');

    const slice = divergentSlice();
    expect(buildHourGridModel(slice, 'overlap').cells[10]!.seconds).toBe(900);
    expect(buildHourGridModel(slice, 'start').cells[10]!.seconds).toBe(1500);

    // The default follows the one unresolved constant rather than a literal,
    // and reading one basis does not erase the other.
    const chosen = HOUR_GRID_BASIS === 'start' ? 'hourStart' : 'hourOverlap';
    expect(buildHourGridModel(slice).cells[10]!.seconds).toBe(slice[chosen]![10]);
    expect(slice.hourOverlap[10]).toBe(900);
    expect(slice.hourStart[10]).toBe(1500);
  });

  it('shades only non-zero cells and builds the scale from them', async () => {
    const { buildHourGridModel } = await load();

    const slice = sliceWithDays([], [], []);
    slice.hourOverlap = new Array<number>(168).fill(0);
    slice.hourOverlap[0] = 60;
    slice.hourOverlap[24] = 60;
    slice.hourOverlap[48] = 3600;

    const model = buildHourGridModel(slice);
    expect(model.cells[0]!.level).toBe(model.cells[24]!.level);
    expect(model.cells[48]!.level).toBeGreaterThanOrEqual(model.cells[0]!.level + 2);
    expect(model.cells.filter((cell) => cell.seconds === 0).every((cell) => cell.level === 0)).toBe(
      true,
    );
    expect(model.legend.levels).toEqual(
      [0, model.cells[0]!.level, model.cells[48]!.level].sort((a, b) => a - b),
    );
  });

  it('labels every third hour and all seven weekday rows', async () => {
    const { buildHourGridModel } = await load();

    const model = buildHourGridModel(divergentSlice());
    expect(model.hourLabels.map((label) => label.hour)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
    // Centred in its own 24px column: 48 + hour * 24 + 12.
    expect(model.hourLabels.map((label) => label.x)).toEqual([
      60, 132, 204, 276, 348, 420, 492, 564,
    ]);
    expect(model.weekdayRows).toHaveLength(7);
    expect(model.weekdayRows.map((row) => row.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(model.weekdayRows[0]!.y).toBe(24);
    expect(model.weekdayRows[6]!.y).toBe(168);
  });

  it('moves within the grid and stops at every edge without wrapping', async () => {
    const { hourGridNavigate } = await load();

    // 0 = Monday 00:00, 23 = Monday 23:00, 24 = Tuesday 00:00,
    // 144 = Sunday 00:00, 30 = Tuesday 06:00.
    expect(hourGridNavigate(0, 'ArrowRight')).toBe(1);
    expect(hourGridNavigate(23, 'ArrowRight')).toBe(23);
    expect(hourGridNavigate(24, 'ArrowLeft')).toBe(24);
    expect(hourGridNavigate(0, 'ArrowDown')).toBe(24);
    expect(hourGridNavigate(144, 'ArrowDown')).toBe(144);
    expect(hourGridNavigate(24, 'ArrowUp')).toBe(0);
    expect(hourGridNavigate(5, 'ArrowUp')).toBe(5);
    expect(hourGridNavigate(30, 'Home')).toBe(24);
    expect(hourGridNavigate(30, 'End')).toBe(47);
  });

  it('leaves an index that is not a cell alone rather than returning another cell', async () => {
    const { hourGridNavigate } = await load();

    // A roving focus that received a stale index must not be moved to a
    // different cell, which would make the focus jump for no reason the user
    // asked for.
    expect(hourGridNavigate(-1, 'ArrowRight')).toBe(-1);
    expect(hourGridNavigate(168, 'ArrowLeft')).toBe(168);
  });
});

// =============================================================================
// duration rows — a log axis on the DURATION, a linear bar on the COUNT
// =============================================================================

describe('duration rows', () => {
  it('always returns twelve rows with percent and bar width', async () => {
    const { buildDurationRows } = await load();

    const rows = buildDurationRows([2, 0, 0, 0, 1, 0, 1, 2, 1, 0, 0, 0], 7);
    expect(rows).toHaveLength(12);
    expect(rows.map((row) => row.bin)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    // Percent is a share of the slice's usable sessions; the bar is a share of
    // the largest bin, so the chart is scaled by its own peak rather than by
    // the slice total.
    expect(rows[0]!.percent).toBeCloseTo((2 / 7) * 100, 10);
    expect(rows[4]!.percent).toBeCloseTo((1 / 7) * 100, 10);
    expect(rows[1]!.percent).toBe(0);
    expect(rows[0]!.barWidth).toBe(100);
    expect(rows[4]!.barWidth).toBe(50);
    expect(rows[1]!.barWidth).toBe(0);
  });

  it('never lets a non-empty bin disappear, and never divides by zero', async () => {
    const { buildDurationRows } = await load();

    // A single session in the smallest bin: 1/1 is 100, and the empty bins
    // must be 0 rather than NaN.
    const lone = buildDurationRows([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 1);
    expect(lone[0]!.barWidth).toBe(100);
    expect(lone.every((row) => Number.isFinite(row.barWidth) && Number.isFinite(row.percent))).toBe(
      true,
    );

    // A lone session in a bin of twelve still has to be visible.
    const thin = buildDurationRows([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7], 7);
    expect(thin[11]!.barWidth).toBe(100);

    const none = buildDurationRows(new Array<number>(12).fill(0), 0);
    expect(none).toHaveLength(12);
    expect(none.every((row) => row.percent === 0 && row.barWidth === 0)).toBe(true);
  });
});

// =============================================================================
// split table — All plus at most eight values, so 50 values cannot grow it
// =============================================================================

describe('split table', () => {
  const splitOf = (count: number): PlaytimeSplit => ({
    column: 'SERVER_NAME',
    values: Array.from({ length: count }, (_, index) => ({
      value: `server-${index}`,
      seconds: (count - index) * 3600,
    })),
    allSeconds: 12_345_678,
  });

  it('shows All plus eight values and counts the rest', async () => {
    const { MAX_SPLIT_TABLE_VALUES, buildSplitTable } = await load();

    expect(MAX_SPLIT_TABLE_VALUES).toBe(8);
    const model = buildSplitTable(splitOf(11), null);
    // The cap is the overflow rule from the UI-SPEC's table: the selector still
    // lists every value, the table never grows past eight rows.
    expect(model.rows).toHaveLength(1 + MAX_SPLIT_TABLE_VALUES);
    expect(model.moreCount).toBe(3);

    const fewer = buildSplitTable(splitOf(3), null);
    expect(fewer.rows).toHaveLength(4);
    expect(fewer.moreCount).toBe(0);
  });

  it('carries the split totals and flags exactly the selected row', async () => {
    const { buildSplitTable } = await load();
    const split = splitOf(11);

    const all = buildSplitTable(split, null);
    expect(all.rows[0]).toMatchObject({ isAll: true, seconds: 12_345_678, selected: true });
    expect(all.rows.filter((row) => row.selected)).toHaveLength(1);

    const picked = buildSplitTable(split, 1);
    expect(picked.rows.filter((row) => row.selected)).toHaveLength(1);
    // rows[0] is All, so the value with index 1 is the second value row. The
    // row is identified by its valueIndex, not by its position: the All row
    // shifts every value row down by one.
    expect(picked.rows.find((row) => row.valueIndex === 1)).toMatchObject({
      isAll: false,
      selected: true,
    });
    expect(picked.rows[0]!.selected).toBe(false);

    // A value below the eighth row is not in the table, so no row carries the
    // marker; the selector and the live region are what report it.
    const beyond = buildSplitTable(split, 9);
    expect(beyond.rows.filter((row) => row.selected)).toHaveLength(0);
  });

  it('renders no table at all when there is no split column', async () => {
    const { buildSplitTable } = await load();

    // D-03: no qualifying column means no selector, no table and no note. The
    // model is total so the component needs no null branch of its own.
    expect(buildSplitTable(null, null)).toEqual({ rows: [], moreCount: 0 });
  });
});

// =============================================================================
// selection reset — a stale value can never render
// =============================================================================

describe('selection reset', () => {
  it('applies a requested value only to the dataset it was requested for', async () => {
    const { effectiveSelection } = await load();

    expect(effectiveSelection({ importedAt: 'a', valueIndex: 2 }, 'a', 3)).toBe(2);
    // A replace that lands mid-query gives the answer a different dataset id,
    // and the answer is treated as no answer rather than as a stale one.
    expect(effectiveSelection({ importedAt: 'b', valueIndex: 2 }, 'a', 3)).toBeNull();
  });

  it('applies a requested value only while its index still exists', async () => {
    const { effectiveSelection } = await load();

    expect(effectiveSelection({ importedAt: 'a', valueIndex: 2 }, 'a', 2)).toBeNull();
    expect(effectiveSelection({ importedAt: 'a', valueIndex: -1 }, 'a', 3)).toBeNull();
    expect(effectiveSelection({ importedAt: 'a', valueIndex: 1.5 }, 'a', 3)).toBeNull();
    expect(effectiveSelection({ importedAt: 'a', valueIndex: 3 }, 'a', 3)).toBeNull();
  });

  it('treats no request, and a request for All, as All', async () => {
    const { effectiveSelection } = await load();

    expect(effectiveSelection(null, 'a', 3)).toBeNull();
    expect(effectiveSelection({ importedAt: 'a', valueIndex: null }, 'a', 3)).toBeNull();
    expect(effectiveSelection({ importedAt: null, valueIndex: 2 }, null, 3)).toBeNull();
  });
});

// =============================================================================
// tooltip placement — numbers, because the CSP forbids a style attribute
//
// One viewport, one nav offset and one tooltip size, so every case is a
// hand-computed coordinate: centred horizontally with an 8px gap, flipped
// below when the top edge would sit under the sticky nav, and clamped 8px
// from every viewport edge.
// =============================================================================

describe('tooltip placement', () => {
  const VIEWPORT = { width: 1280, height: 800 };
  const TIP = { width: 100, height: 40 };
  const NAV = 72;

  it('centres above the cell with an 8px gap', async () => {
    const { clampTooltip } = await load();

    // Centre of the anchor: 600 + 5 = 605, so 605 - 50 = 555. Above: 300 - 40
    // - 8 = 252, and 252 is clear of navOffset + 8 = 80.
    expect(
      clampTooltip({ left: 600, top: 300, width: 10, height: 10 }, TIP, VIEWPORT, NAV),
    ).toEqual({ left: 555, top: 252, placement: 'above' });
  });

  it('flips below when the top edge would sit under the sticky nav', async () => {
    const { clampTooltip } = await load();

    // Above would be 100 - 40 - 8 = 52, which is under 80, so the tooltip
    // opens below the cell: 100 + 10 + 8 = 118.
    expect(
      clampTooltip({ left: 600, top: 100, width: 10, height: 10 }, TIP, VIEWPORT, NAV),
    ).toEqual({
      left: 555,
      top: 118,
      placement: 'below',
    });
  });

  it('clamps to 8px from the left and right edges', async () => {
    const { clampTooltip } = await load();

    expect(
      clampTooltip({ left: 0, top: 300, width: 10, height: 10 }, TIP, VIEWPORT, NAV).left,
    ).toBe(8);
    // Centred at 1275 + 5 = 1280 would run off the right; the far edge is
    // 1280 - 100 - 8 = 1172.
    expect(
      clampTooltip({ left: 1275, top: 300, width: 10, height: 10 }, TIP, VIEWPORT, NAV).left,
    ).toBe(1172);
  });

  it('clamps the bottom on a viewport too short to hold the tooltip', async () => {
    const { clampTooltip } = await load();

    // A 100px-tall viewport: below would be 78, and the far edge is
    // 100 - 40 - 8 = 52.
    expect(
      clampTooltip(
        { left: 600, top: 60, width: 10, height: 10 },
        TIP,
        { width: 1280, height: 100 },
        NAV,
      ).top,
    ).toBe(52);
  });

  it('never reports a coordinate above 8px from the top-left corner', async () => {
    const { clampTooltip } = await load();

    for (const anchor of [
      { left: 0, top: 0, width: 10, height: 10 },
      { left: 5, top: 5, width: 4, height: 4 },
      { left: 1279, top: 799, width: 1, height: 1 },
    ]) {
      const placed = clampTooltip(anchor, TIP, { width: 20, height: 20 }, NAV);
      expect(placed.left).toBeGreaterThanOrEqual(8);
      expect(placed.top).toBeGreaterThanOrEqual(8);
    }
  });
});

// =============================================================================
// focus scroll delta and the hours attribute
// =============================================================================

describe('focus scroll delta and hoursAttribute', () => {
  it('reports how far a focused cell is short of the sticky nav plus year head', async () => {
    const { focusScrollDelta } = await load();

    // `Rect` names only the four fields the model reads, so the component can
    // hand it a real `getBoundingClientRect()` result (a DOMRect carries
    // `right` and `bottom` as well) without adapting it first.
    //
    // The required clear line is navBottom 56 + head 32 + the 8px gap = 96, and
    // the cell's top is 60, so it is 36px short. The value is the NEGATIVE of
    // the scroll the caller applies, so the component does
    // `window.scrollBy(0, -delta)`; a cell already clear reports 0 and the
    // component must not scroll at all.
    expect(focusScrollDelta({ left: 0, top: 60, width: 10, height: 10 }, 56, 32)).toBe(-36);
    expect(focusScrollDelta({ left: 0, top: 200, width: 10, height: 10 }, 56, 32)).toBe(0);
  });

  it('reports hours to four decimals with no trailing zeros', async () => {
    const { hoursAttribute } = await load();

    expect(hoursAttribute(5400)).toBe(1.5);
    expect(hoursAttribute(0)).toBe(0);
    expect(hoursAttribute(3600)).toBe(1);
    // One second is 0.000277... hours, which rounds to 0.0003 rather than
    // collapsing to 0 — an aria-label that reads "0 hours" for a real session
    // is a wrong answer, not a rounded one.
    expect(hoursAttribute(1)).toBe(0.0003);
    expect(hoursAttribute(18_000)).toBe(5);
  });
});

// =============================================================================
// 04-10: the calendar's day totals against the INDEPENDENT oracle
// =============================================================================
//
// WHY THIS IS HERE AND NOT IN 04-05's BLOCK
//
// Every calendar test above feeds `buildCalendarModel` a hand-written array
// and then checks the model against ITSELF: the year's total against the sum
// of the slice's own day array, which proves the grouping is consistent and
// says nothing about whether the grouping puts the right playtime on the right
// day. A calendar that is off by one day on every cell still passes all of it.
//
// So this block starts from SESSIONS, recomputes the per-day totals with
// `oracleSlice` — which uses the platform date API rather than the module's
// integer civil arithmetic, so the two can catch each other — and asserts the
// calendar lands the same seconds and the same session count on the same days.
// It is the check 04-12 repeats at scale from a browser; here it is cheap
// enough to run on every change.
describe('04-10: the calendar against the independent session oracle', () => {
  /** A slice in the shape the model reads, built from the oracle's own arrays. */
  const sliceOf = (sessions: readonly OracleSession[]): PlaytimeSlice => {
    const oracle = oracleSlice(sessions);
    return {
      seconds: oracle.seconds,
      sessions: oracle.sessions,
      excluded: 0,
      dayIndex: oracle.dayIndex,
      daySeconds: oracle.daySeconds,
      daySessions: oracle.daySessions,
      hourOverlap: oracle.hourOverlap,
      hourStart: oracle.hourStart,
      bins: oracle.bins,
    };
  };

  const cellsOfAll = (
    model: ReturnType<(typeof import('../../src/lib/playtime-model'))['buildCalendarModel']>,
  ) =>
    model.blocks
      .filter((block) => block.kind === 'year')
      .flatMap((block) => (block.kind === 'year' ? block.rows.flat() : []));

  it('puts the oracle day total on the oracle day, for a hand-chosen set crossing a year', async () => {
    const { buildCalendarModel } = await load();

    // A Sunday 23:30 -> Monday 00:30 crossing, a session entirely inside it, a
    // summer day, and a New Year's Day session in the NEXT year: the calendar
    // has to place merged seconds on the START day (D-02) and still split the
    // set into two year blocks with no day double-counted or lost. The whole
    // set stays inside the oracle's 400-day bitmap window (RESEARCH: the oracle
    // marks one second per session, so a wider span would be a fixture limit
    // rather than a real disagreement).
    const sessions: OracleSession[] = [
      { start: Date.UTC(2019, 2, 3, 23, 30) / 1000, end: Date.UTC(2019, 2, 4, 0, 30) / 1000 },
      { start: Date.UTC(2019, 2, 3, 23, 40) / 1000, end: Date.UTC(2019, 2, 3, 23, 50) / 1000 },
      { start: Date.UTC(2019, 6, 4, 9, 0) / 1000, end: Date.UTC(2019, 6, 4, 10, 0) / 1000 },
      { start: Date.UTC(2020, 0, 1, 12, 0) / 1000, end: Date.UTC(2020, 0, 1, 13, 30) / 1000 },
    ];
    const oracle = oracleSlice(sessions);
    const model = buildCalendarModel(sliceOf(sessions));
    const cells = cellsOfAll(model);

    // Two active years, and the newest one first (D-04).
    expect(model.years).toEqual([2019, 2020]);
    expect(model.blocks.map((block) => (block.kind === 'year' ? block.year : 'gap'))).toEqual([
      2020, 2019,
    ]);

    // Every active day the calendar draws carries the oracle's numbers.
    for (const [index, dayNumber] of oracle.dayIndex.entries()) {
      const cell = cells.find((candidate) => candidate.day === dayNumber);
      expect(cell, `day ${dayNumber} is drawn`).toBeDefined();
      expect(cell?.seconds, `seconds on day ${dayNumber}`).toBe(oracle.daySeconds[index]);
      expect(cell?.sessions, `sessions on day ${dayNumber}`).toBe(oracle.daySessions[index]);
    }

    // And the totals reconcile: the drawn years sum to the oracle's total, and
    // no day the oracle named is lost.
    expect(cells.reduce((total, cell) => total + cell.seconds, 0)).toBe(oracle.seconds);
    expect(cells.reduce((total, cell) => total + cell.sessions, 0)).toBe(oracle.sessions);
  });

  it('agrees with the oracle across a seeded random export spanning two years', async () => {
    const { buildCalendarModel } = await load();

    // 600 sessions over a 300-day window shifted so it straddles New Year, so
    // the two calendar year blocks are both populated by a real merge pattern
    // rather than by hand-picked sessions. Seeded, so a failure reproduces and
    // the test is not itself a source of flake.
    const offset = Date.UTC(2018, 11, 15) / 1000;
    const sessions = randomSessions(20260930, 600, 300).map((session) => ({
      start: session.start + offset,
      end: session.end + offset,
    }));
    const oracle = oracleSlice(sessions);
    const model = buildCalendarModel(sliceOf(sessions));
    const cells = cellsOfAll(model);

    const byDay = new Map(cells.map((cell) => [cell.day, cell]));
    for (const [index, dayNumber] of oracle.dayIndex.entries()) {
      const cell = byDay.get(dayNumber);
      expect(cell?.seconds, `seconds on day ${dayNumber}`).toBe(oracle.daySeconds[index]);
      expect(cell?.sessions, `sessions on day ${dayNumber}`).toBe(oracle.daySessions[index]);
    }

    // The scale criterion: the node count is the DAYS in the active years, so
    // it is the model's own count and never a filtered subset of the data.
    const drawn = cells.length;
    expect(model.cellCount).toBe(drawn);
    expect(drawn).toBeGreaterThan(model.years.length * 364);
  });
});
