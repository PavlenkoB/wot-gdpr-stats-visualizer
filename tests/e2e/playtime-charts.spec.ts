import './pin-locale';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SYNTHETIC_ZIP_NAME, gotoApp, importExport, playtimeBlock } from './helpers.ts';
import {
  buildSessionsCsvFromRows,
  buildSessionsExportFromCsv,
} from '../fixtures/sessions-fixtures.ts';
import {
  HAND_ALL,
  HAND_BINS,
  HAND_CALENDAR_CELLS,
  HAND_EMPTY_YEAR_RUN,
  HAND_EMPTY_YEAR_RUN_EU,
  HAND_ROWS,
  HAND_YEARS,
  HOUR_BASIS_DIFFERENCES,
  HOUR_CELL_20_LINE1,
  HOUR_CELL_20_LINE2,
  HOUR_CELL_21_LINE2,
  HOUR_EXPECTED,
  expectedHourSeconds,
} from '../fixtures/playtime-hand-fixture.ts';
import { SESSION_FIXTURE_IP } from '../fixtures/sessions-fixtures.ts';
import { HOUR_GRID_BASIS } from '../../src/lib/playtime-shared.ts';
import {
  CALENDAR_BASIS_CAPTION,
  DURATION_BIN_LABELS,
  DURATION_LIST_ARIA_LABEL,
  HOUR_GRID_BASIS_CAPTION,
  LEGEND_LESS,
  LEGEND_MORE,
} from '../../src/lib/ui-copy.ts';

// =============================================================================
// Phase 04, plan 04-11 — the three CHARTS, in a real browser
// =============================================================================
//
// WHY A BROWSER SPEC AND NOT A UNIT TEST
// Vitest has no DOM, and every claim below is a claim about geometry: how many
// rects a chart drew, what `data-seconds` each one carries, where a tooltip
// ended up relative to the viewport, whether a sticky head overlaps the nav, and
// whether a 375px row wrapped its bar onto its own line. None of that exists
// until a component renders, so the instrument has to be a browser. The
// `read_first` set for this task is the components' own markup for exactly
// that reason.
//
// WHY THESE NUMBERS ARE LITERALS, AND WHERE THEY COME FROM
// Every expected value is imported from `tests/fixtures/playtime-hand-fixture.ts`,
// which holds nine hand rows small enough to total with a pencil, and which
// `tests/unit/playtime-hand-fixture.test.ts` proves EQUAL to the INDEPENDENT
// oracle from plan 04-03 — an implementation sharing no primitive with the
// aggregator it checks. Nothing here reads the page and compares it with
// itself: a spec that read all 168 hour cells and asserted they agreed with
// each other would pass against a grid that is wrong in every cell. The same
// applies to the calendar, which 04-10 discovered was previously only ever
// compared to the model that produced it.
//
// D-01: dates and hours are as recorded, never converted to local time. The two
// basis captions exist to tell the reader that, and both are asserted as VISIBLE
// TEXT here rather than left to a unit test of the constant.
//
// D-04: the calendar is a year grid with a collapsible run for empty years, and
// the tooltip is ONE shared element fed by whichever chart the pointer is over.
//
// D-05: the duration bins are uneven and are keyed on the RAW session length, so
// a contained session and a zero-length session each land in their own bucket.
//
// THE TEST BUDGET
// 04-11 caps this file at 16 tests and both playtime files at 36, because CI runs
// one Playwright worker and every test costs a full import. Related assertions
// are therefore kept inside one test rather than split for legibility. Plan
// 04-13 derives the global timeout from the recorded `--list` totals.
// =============================================================================

/** Reduced motion: `scroll-behavior: smooth` would make every scroll a race. */
test.use({ reducedMotion: 'reduce' });

/** The nine hand rows as the export the app actually reads. */
const HAND_EXPORT = buildSessionsExportFromCsv(buildSessionsCsvFromRows(HAND_ROWS));

/** Import the hand fixture and wait for the three charts to exist. */
async function withHandFixture(page: Page): Promise<void> {
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT);
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('playtime-charts')).toBeVisible();
}

/** The calendar cell for a `YYYY-MM-DD` date. */
function cell(page: Page, date: string) {
  return page.locator(`[data-testid="calendar-cell"][data-date="${date}"]`);
}

/** The two heatmaps that draw a pointer outline and a keyboard ring. */
type HeatmapChart = 'calendar-chart' | 'hour-chart';

/** Every rect of the named chart's hover outline (the outer accent and the inner white). */
function hoverRings(page: Page, chart: HeatmapChart = 'calendar-chart') {
  return page.getByTestId(chart).locator('rect.hover-ring');
}

/** Every rect of the named chart's keyboard focus ring. */
function focusRings(page: Page, chart: HeatmapChart = 'calendar-chart') {
  return page.getByTestId(chart).locator('rect.focus-ring');
}

/** The paint a ring rect resolves to: what a reader sees, not what the CSS says. */
function ringPaint(target: Locator) {
  return target.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      fill: style.fill,
      pointerEvents: style.pointerEvents,
    };
  });
}

/**
 * A cell's fill level, computed fill and bounding box, for a before/after
 * comparison. The box is in DOCUMENT coordinates, because `hover()` scrolls the
 * cell into view and a viewport-relative box would differ for that reason alone.
 */
function cellSnapshot(target: Locator) {
  return target.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      level: node.getAttribute('data-level'),
      fill: getComputedStyle(node).fill,
      box: {
        x: box.x + window.scrollX,
        y: box.y + window.scrollY,
        width: box.width,
        height: box.height,
      },
    };
  });
}

/** A locator's bounding-box centre, in viewport coordinates. */
async function boxOf(target: Locator): Promise<{ cx: number; cy: number }> {
  const box = await target.boundingBox();
  if (box === null) throw new Error('element has no bounding box');
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

/** The hour grid cell for an index (0..167), by its test id and `data-index`. */
function gridCell(page: Page, index: number) {
  return page.locator(`[data-testid="hour-cell"][data-index="${index}"]`);
}

/** The `data-seconds` of every hour cell, in document order (index 0..167). */
function hourSeconds(page: Page): Promise<number[]> {
  return page
    .locator('[data-testid="hour-cell"]')
    .evaluateAll((nodes) => nodes.map((node) => Number((node as SVGElement).dataset.seconds)));
}

/** The `data-date` of the cell that currently holds the roving tab stop. */
function focusedDate(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute('data-date') ?? null);
}

/** The `data-index` of the hour cell that currently holds the tab stop. */
function focusedHourIndex(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute('data-index') ?? null);
}

// -----------------------------------------------------------------------------
// Calendar (ACTIVITY-02, D-04) — four tests
// -----------------------------------------------------------------------------

test('calendar: (all) three year blocks, the collapsed 2020 run, and the hand cells', async ({
  page,
}) => {
  await withHandFixture(page);
  const calendar = page.getByTestId('calendar-chart');

  // 1,095 cells: 2018, 2019 and 2021 are all 365-day years and 2020 is never
  // drawn at all. This is the node count as a FUNCTION OF THE DATA (RESEARCH
  // "How to assert node counts"), so a stray 1970 or 9999 year would move it.
  await expect(page.getByTestId('calendar-cell')).toHaveCount(HAND_CALENDAR_CELLS.all);

  // Document order is NEWEST FIRST, and the empty year collapses to ONE line
  // between 2019 and 2021 rather than a grid of nothing.
  await expect(page.getByTestId('calendar-year-2021')).toHaveCount(1);
  await expect(page.getByTestId('calendar-year-2019')).toHaveCount(1);
  await expect(page.getByTestId('calendar-year-2018')).toHaveCount(1);
  await expect(page.getByTestId('calendar-year-2020')).toHaveCount(0);
  await expect(page.getByTestId('calendar-empty-run')).toHaveText(HAND_EMPTY_YEAR_RUN);

  // And the order, which a set of three `toHaveCount(1)` assertions does NOT
  // check: 2021, the run line, then 2019, then 2018. The selector is
  // `[data-testid^="calendar-year-"]` from the COMPONENT's own contract, which
  // also matches the nested `calendar-year-head-` — so the run lines are
  // filtered back out here. A prefix that matched the heads too would assert
  // the wrong document order and pass for the wrong reason.
  const order = await page
    .locator('[data-testid^="calendar-year-"], [data-testid="calendar-empty-run"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => (node as Element).getAttribute('data-testid') ?? '')
        .filter((id) => id === 'calendar-empty-run' || /^calendar-year-\d+$/.test(id))
        .map((id) =>
          id === 'calendar-empty-run' ? 'empty-run' : id.replace('calendar-year-', ''),
        ),
    );
  expect(order).toEqual(['2021', 'empty-run', '2019', '2018']);

  // The three heads, each a function of that year's own rows.
  for (const year of [2021, 2019, 2018] as const) {
    await expect(page.getByTestId(`calendar-year-head-${year}`)).toContainText(
      HAND_YEARS[year]!.head,
    );
  }

  // A cell that holds play, a cell that holds a session and no play, and the
  // smallest non-zero day. The zero cell is the one that proves the tooltip is
  // keyed on the SESSION count: `formatCalendarTooltipLine2(0, 1)` is
  // "0 min · 1 session", never "0 min · 0 sessions" (04-RESEARCH Pitfall 4).
  const busy = cell(page, '2021-12-31');
  await expect(busy).toHaveAttribute('data-seconds', '5400');
  await expect(busy).toHaveAttribute('data-sessions', '2');
  expect(await busy.getAttribute('data-level')).not.toBe('0');

  const empty = cell(page, '2019-07-14');
  await expect(empty).toHaveAttribute('data-seconds', '0');
  await expect(empty).toHaveAttribute('data-sessions', '1');
  await expect(empty).toHaveAttribute('data-level', '0');
  await expect(empty).toHaveAccessibleName('Sun, Jul 14, 2019: 0 min, 1 session');

  // 30 seconds is under a minute, so this is the only place the "<1 min"
  // string can be read in the whole fixture.
  await expect(cell(page, '2021-01-01')).toHaveAttribute('data-seconds', '30');
  await expect(cell(page, '2021-01-01')).toHaveAccessibleName(
    'Fri, Jan 1, 2021: <1 min, 1 session',
  );

  // D-01, as visible text: the calendar tells the reader its dates are not
  // local time. A unit test already holds the string; this is the claim that it
  // is on screen and not commented out. Scoped to the SECTION, because the
  // caption is a sibling of the chart rather than inside it — the same
  // structure the hour grid uses, where scoping to `hour-chart` would find
  // nothing.
  const calendarSection = page.locator('section.chart', { hasText: 'Hours per day' });
  await expect(calendarSection).toContainText(CALENDAR_BASIS_CAPTION);
  await expect(calendar).toContainText(LEGEND_LESS);
  await expect(calendar).toContainText(LEGEND_MORE);
});

test('calendar: (eu-1) two year blocks and the two-year collapsed run', async ({ page }) => {
  await withHandFixture(page);

  // eu-1's rows are in 2018 and 2021, so the calendar drops from three grids
  // to two and the gap WIDENS from one year to two. The run line is not the
  // same string, and a spec that only counted cells would never notice.
  await page.getByTestId('playtime-selector').selectOption('0');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('calendar-cell')).toHaveCount(HAND_CALENDAR_CELLS.eu);
  await expect(page.getByTestId('calendar-empty-run')).toHaveText(HAND_EMPTY_YEAR_RUN_EU);
  await expect(page.getByTestId('calendar-year-2019')).toHaveCount(0);
  await expect(page.getByTestId('calendar-year-2021')).toHaveCount(1);
  await expect(page.getByTestId('calendar-year-2018')).toHaveCount(1);
});

test('calendar: (sticky head) the year head is a SIBLING of the scroller and is taller than its declared 32px', async ({
  page,
}) => {
  await withHandFixture(page);

  // The head must not be INSIDE the horizontal scroller, or scrolling the grid
  // sideways would carry the head with it and the year label would leave.
  // A containment assertion is the only one that catches this; reading the
  // head's position would pass either way while the scroller is at 0.
  const nesting = await page.evaluate(() => {
    const head = document.querySelector('[data-testid="calendar-year-head-2021"]');
    const scroller = document.querySelector('[data-testid="calendar-scroller-2021"]');
    if (head === null || scroller === null) return { head: null, nested: null };
    return {
      head: (head as HTMLElement).offsetHeight,
      nested: scroller.contains(head) || head.contains(scroller),
    };
  });
  expect(nesting.nested).toBe(false);

  // The head DECLARES `min-height: 32px` and MEASURES more, because it is a
  // wrapping flex row with 4px of vertical padding and a 1px rule. This is the
  // structural half of the measured-height story: the declaration and the
  // reality are already different, so a focus correction that hard-coded the
  // declared number would be wrong by a visible amount on a real render.
  //
  // It is deliberately NOT a claim that the correction fires; that is a
  // separate test. Reaching the correction needs the cell to be ON screen and
  // UNDER the chrome, which `focus()` will not produce on its own — the
  // browser centres a cell that is off screen, about 355px below the top of
  // the viewport on this fixture, far clear of a nav of 57px plus a head of
  // 41px. tests/e2e/playtime-ui-review.spec.ts parks a cell under the stuck
  // head by hand, presses a real key and proves the correction fires, clears
  // it, and uses the head's MEASURED height (see 04-17-SUMMARY for the
  // mutation check that hard-coding 32 makes that test fail).
  expect(nesting.head).toBeGreaterThan(32);

  // And it parks UNDER the nav rather than under it: the sticky's `top` is
  // `calc(var(--nav-offset) - 16px)`, so with the nav at its own height the
  // head's top is never above the nav's bottom once stuck.
  const stuck = await page.evaluate(() => {
    const head = document.querySelector('[data-testid="calendar-year-head-2021"]');
    const nav = document.querySelector('nav');
    if (head === null || nav === null) return null;
    // The used `top` of a sticky element is the computed value, not a resolved
    // scroll offset, and it is what the CSS declares.
    return {
      top: getComputedStyle(head).top,
      navBottom: Math.round(nav.getBoundingClientRect().bottom),
    };
  });
  expect(stuck?.top).toBe('56px');
  expect(stuck?.navBottom).toBeGreaterThan(0);
});

test('calendar: (hover ring) the cell under the pointer gets the focus ring outline and only that cell', async ({
  page,
}) => {
  await withHandFixture(page);

  const tip = page.getByTestId('chart-tooltip');

  // Nothing is outlined until the pointer is over a cell.
  await expect(hoverRings(page)).toHaveCount(0);
  await expect(focusRings(page)).toHaveCount(0);

  const busy = cell(page, '2021-12-31');
  const above = cell(page, '2021-12-30');

  // Snapshot the hovered cell and its neighbour BEFORE the pointer arrives, so
  // phase (a) can compare them against the same cells with the ring showing.
  const busyBefore = await cellSnapshot(busy);
  const aboveBefore = await cellSnapshot(above);
  await busy.hover();

  // Exactly two rects (outer accent, inner white) across all three year blocks
  // together, so the ring is drawn in one year's svg and not in every year.
  await expect(hoverRings(page)).toHaveCount(2);

  // Centred on THAT cell: the same x/y in another year's svg is a different
  // place on the page, so a 0.5px tolerance proves the year as well as the cell.
  const cellBox = await boxOf(busy);
  const outer = hoverRings(page).nth(0);
  const inner = hoverRings(page).nth(1);
  const outerBox = await boxOf(outer);
  const innerBox = await boxOf(inner);
  expect(Math.abs(outerBox.cx - cellBox.cx)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(outerBox.cy - cellBox.cy)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(innerBox.cx - cellBox.cx)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(innerBox.cy - cellBox.cy)).toBeLessThanOrEqual(0.5);

  // The keyboard ring's geometry: the 3px stroke centred on a rect 3px larger
  // than the cell, and the 1px white one on a rect 7px larger. Read from the
  // `width` attribute, because a bounding box of an SVG rect includes its stroke
  // and would compare three different stroke widths rather than the geometry.
  const cellWidth = Number(await busy.getAttribute('width'));
  expect(Number(await outer.getAttribute('width'))).toBe(cellWidth + 3);
  expect(Number(await inner.getAttribute('width'))).toBe(cellWidth + 7);

  // Painted as the keyboard ring is: accent over white, no fill, no pointer.
  expect(await ringPaint(outer)).toEqual({
    stroke: 'rgb(26, 115, 232)',
    strokeWidth: '3px',
    fill: 'none',
    pointerEvents: 'none',
  });
  const innerPaint = await ringPaint(inner);
  expect(innerPaint.stroke).toBe('rgb(255, 255, 255)');
  expect(innerPaint.strokeWidth).toBe('1px');

  // (a) The ring changes nothing about the cells: level, computed fill and
  // bounding box are identical with it showing, and the shared tooltip is open
  // with the same two lines as without it, so the ring coexists with the tooltip.
  expect(await cellSnapshot(busy)).toEqual(busyBefore);
  expect(await cellSnapshot(above)).toEqual(aboveBefore);
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Fri, Dec 31, 2021');
  await expect(tip).toContainText('1.5 hours · 2 sessions');

  // (b) The ring follows the pointer and cannot intercept it. 2021-12-30 sits
  // directly above 2021-12-31, so the ring's outer band overlaps the bottom
  // 3px of that neighbour. Moving into that band must land on the NEIGHBOUR: a
  // ring that took pointer events would swallow the move, close the tooltip
  // and vanish instead.
  const aboveRect = await above.boundingBox();
  if (aboveRect === null) throw new Error('2021-12-30 has no bounding box');
  await page.mouse.move(aboveRect.x + aboveRect.width / 2, aboveRect.y + aboveRect.height - 1.5);
  await expect
    .poll(async () => {
      const ring = await boxOf(hoverRings(page).nth(0));
      const target = await boxOf(above);
      return Math.hypot(ring.cx - target.cx, ring.cy - target.cy) <= 0.5;
    })
    .toBe(true);
  const ringNow = await boxOf(hoverRings(page).nth(0));
  const busyNow = await boxOf(busy);
  expect(Math.hypot(ringNow.cx - busyNow.cx, ringNow.cy - busyNow.cy)).toBeGreaterThanOrEqual(10);
  await expect(hoverRings(page)).toHaveCount(2);
  await expect(tip).toContainText('Thu, Dec 30, 2021');

  // (c) Leaving clears it: no ring and no tooltip.
  await page.getByTestId('duration-chart').scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await expect(hoverRings(page)).toHaveCount(0);
  await expect(tip).toBeHidden();

  // (d) Hover is not keyboard focus. Nothing above drew a keyboard ring. Then
  // the keyboard ring goes on 2021-12-30 (ArrowUp from 2021-12-31), and the
  // pointer arriving on another cell and leaving again must neither clear it
  // nor move the roving focus.
  await expect(focusRings(page)).toHaveCount(0);
  await busy.focus();
  await page.keyboard.press('ArrowUp');
  expect(await focusedDate(page)).toBe('2021-12-30');
  await expect(focusRings(page)).toHaveCount(2);
  await expect(hoverRings(page)).toHaveCount(0);
  const focusOuter = focusRings(page).nth(0);
  await expect
    .poll(async () => {
      const ring = await boxOf(focusOuter);
      const target = await boxOf(above);
      return Math.hypot(ring.cx - target.cx, ring.cy - target.cy) <= 0.5;
    })
    .toBe(true);

  await busy.hover();
  await expect(hoverRings(page)).toHaveCount(2);
  const hoverAgain = await boxOf(hoverRings(page).nth(0));
  const busyAgain = await boxOf(busy);
  expect(
    Math.hypot(hoverAgain.cx - busyAgain.cx, hoverAgain.cy - busyAgain.cy),
  ).toBeLessThanOrEqual(0.5);
  await expect(focusRings(page)).toHaveCount(2);
  const focusStill = await boxOf(focusRings(page).nth(0));
  const aboveStill = await boxOf(above);
  expect(
    Math.hypot(focusStill.cx - aboveStill.cx, focusStill.cy - aboveStill.cy),
  ).toBeLessThanOrEqual(0.5);

  // (e) Forced colours: while both rings are on screen, each hover rect resolves
  // to the same paint as its keyboard counterpart. The repo has no forced-colors
  // rule of its own, so parity (not an absolute colour) is the claim, and it
  // holds because the two rings share one declaration list.
  await page.emulateMedia({ forcedColors: 'active' });
  const hoverOuterPaint = await ringPaint(hoverRings(page).nth(0));
  const hoverInnerPaint = await ringPaint(hoverRings(page).nth(1));
  expect(hoverOuterPaint).toEqual(await ringPaint(focusRings(page).nth(0)));
  expect(hoverInnerPaint).toEqual(await ringPaint(focusRings(page).nth(1)));
  expect(hoverOuterPaint.fill).toBe('none');
  await page.emulateMedia({ forcedColors: 'none' });

  // The pointer leaves; the keyboard ring and the roving focus are untouched.
  await page.getByTestId('duration-chart').scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await expect(hoverRings(page)).toHaveCount(0);
  await expect(focusRings(page)).toHaveCount(2);
  expect(await focusedDate(page)).toBe('2021-12-30');
});

// -----------------------------------------------------------------------------
// Tooltip (D-04) — two tests
// -----------------------------------------------------------------------------

test('tooltip: (calendar) hover and keyboard show the same two lines, Escape hides it and keeps focus, and the address never appears', async ({
  page,
}) => {
  await withHandFixture(page);
  const tip = page.getByTestId('chart-tooltip');
  await expect(tip).toBeHidden();

  // Hover: the SHARED tooltip, not a second one beside the calendar (D-04).
  await cell(page, '2021-12-31').hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Fri, Dec 31, 2021');
  await expect(tip).toContainText('1.5 hours · 2 sessions');

  // Moving away hides it, which is the half of the contract that a tooltip
  // stuck open would pass.
  await page.getByTestId('duration-chart').scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await expect(tip).toBeHidden();

  // Keyboard: the same two words, so a sighted reader and a screen-reader user
  // are told the same thing about the same cell.
  await cell(page, '2021-12-31').focus();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Fri, Dec 31, 2021');
  await expect(tip).toContainText('1.5 hours · 2 sessions');

  // Escape dismisses the tooltip WITHOUT moving focus: a keyboard user must
  // still be able to arrow onward from the cell they are on.
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  expect(await focusedDate(page)).toBe('2021-12-31');

  // T-04-01, asserted where it can be read: the sessions file carries a
  // real-looking address on every row and none of them may reach the screen.
  const screenText = await page.getByTestId('playtime-charts').textContent();
  expect(screenText).not.toContain(SESSION_FIXTURE_IP);
});

test('tooltip: (hour grid) cell 20 names the hour, and cell 21 and cell 0 are the basis asymmetry', async ({
  page,
}) => {
  await withHandFixture(page);
  const tip = page.getByTestId('chart-tooltip');
  const hourCell = (index: number) =>
    page.locator(`[data-testid="hour-cell"][data-index="${index}"]`);

  // The same 7,200 seconds of play, attributed two ways. The expectation comes
  // from the shared fixture SELECTED BY `HOUR_GRID_BASIS`, never from a
  // per-basis list in this file, so flipping the open D-01 decision needs no
  // edit here.
  await hourCell(20).hover();
  await expect(tip).toContainText(HOUR_CELL_20_LINE1);
  await expect(tip).toContainText(HOUR_CELL_20_LINE2[HOUR_GRID_BASIS]);

  // Cell 21 is the cell the two bases genuinely disagree about: under `overlap`
  // Monday 20:00-21:00 is an hour and Monday 21:00-22:00 is the next hour, and
  // under `start` the whole session sat in cell 20 and 21 is empty. Asserted
  // from the fixture so the expectation follows the basis.
  await hourCell(21).hover();
  await expect(tip).toContainText(HOUR_CELL_21_LINE2[HOUR_GRID_BASIS]);

  // Cell 0, Monday 00:00, is empty under BOTH bases, so its line is basis
  // independent — which is what makes it a control on the two above.
  await hourCell(0).hover();
  await expect(tip).toContainText('No sessions');
  await expect(tip).toContainText('Monday, 00:00-01:00');
});

// -----------------------------------------------------------------------------
// Keyboard (roving tab stop) — one test
// -----------------------------------------------------------------------------

test('keyboard: (calendar) one tab stop for the whole grid, arrows and Page keys per the UI-SPEC, and a second Tab leaves', async ({
  page,
}) => {
  await withHandFixture(page);
  const calendar = page.getByTestId('calendar-chart');

  // Exactly ONE cell in the whole chart is a tab stop, and it is January 1 of
  // the NEWEST year — the model's own initial day, not the first cell in
  // document order (which is 2021-12-31, because the grid is newest first).
  // Getting these two confused is the classic roving-focus bug.
  await expect(calendar.locator('[tabindex="0"]')).toHaveCount(1);
  await expect(calendar.locator('[data-date="2021-01-01"]')).toHaveAttribute('tabindex', '0');

  // Tab from the control before the chart. The chart container itself is
  // `tabindex="-1"` and the svg is a grid, so the first Tab stop inside the
  // chart must be the initial day cell.
  await page.getByTestId('playtime-selector').focus();
  await page.keyboard.press('Tab');
  expect(await focusedDate(page)).toBe('2021-01-01');

  // The grid is WEEKDAY COLUMNS by WEEK ROWS, which is the GitHub shape
  // 04-10 built, and the two axes are NOT symmetric: Right moves a WEEK in the
  // same weekday column, Down moves a WEEKDAY in the same week row. 2021-01-01
  // is a Friday, so Right lands on Friday 2021-01-08 — a week later, same
  // column — while Down lands on Saturday 2021-01-02 — a day later, same row.
  // Asserting both is what distinguishes the axes; a spec that assumed "arrows
  // move one day" would pass the Down half and fail the Right half.
  await page.keyboard.press('ArrowRight');
  expect(await focusedDate(page)).toBe('2021-01-08');
  await page.keyboard.press('ArrowLeft');
  expect(await focusedDate(page)).toBe('2021-01-01');
  await page.keyboard.press('ArrowDown');
  expect(await focusedDate(page)).toBe('2021-01-02');
  await page.keyboard.press('ArrowUp');
  expect(await focusedDate(page)).toBe('2021-01-01');

  // PageUp skips whole years, and it must skip the COLLAPSED 2020 as well: the
  // 2019 grid is the next one with cells. A PageUp that stepped one year would
  // land on a year with no grid at all.
  await page.keyboard.press('PageUp');
  expect(await focusedDate(page)).toBe('2019-01-01');
  await page.keyboard.press('PageDown');
  expect(await focusedDate(page)).toBe('2021-01-01');

  // Home and End move along the WEEKDAY COLUMN to the first and last day of
  // the year that fall in that column — which is a different rule from the
  // hour grid's "the row's own first and last hour", and the two are asserted
  // here and in the hour-grid test respectively. 2021-01-01 is a Friday, and
  // 2021's first Friday IS 2021-01-01 while its last Friday IS 2021-12-31, so
  // End is a real move and Home returns. Asserting both pins the rule: a spec
  // that expected End to be a no-op (because Home is) would catch a
  // Home/End pair that was accidentally symmetric.
  await page.keyboard.press('End');
  expect(await focusedDate(page)).toBe('2021-12-31');
  await page.keyboard.press('Home');
  expect(await focusedDate(page)).toBe('2021-01-01');
  await page.keyboard.press('Home');
  expect(await focusedDate(page)).toBe('2021-01-01');

  // A second Tab LEAVES the chart rather than cycling inside it: the whole
  // point of one tab stop is that the reader gets past 1,095 cells in one press.
  await page.keyboard.press('Tab');
  expect(await focusedDate(page)).not.toBe('2021-01-01');
});

// -----------------------------------------------------------------------------
// Weekday by hour (ACTIVITY-03, D-01) — three tests
// -----------------------------------------------------------------------------

test('hour grid: 168 cells whose data-seconds equal the hand table cell by cell, summing to the All total', async ({
  page,
}) => {
  await withHandFixture(page);

  // The grid is ALWAYS 168 cells: the dense days and the empty hours are drawn
  // alike, and only the `data-level` ramp tells them apart. A grid that drew
  // only non-empty cells would break the "one cell, one hour" contract that the
  // keyboard and the scale tests both rely on.
  await expect(page.getByTestId('hour-cell')).toHaveCount(168);

  // Every cell, compared against the SHARED fixture table selected by the
  // active basis. Not a hard-coded list in this file: a per-basis list here
  // would be a third copy of the numbers, and it is exactly the copy that
  // survives a change to the table.
  const seconds = await hourSeconds(page);
  expect(seconds).toHaveLength(168);
  expect(seconds).toEqual(expectedHourSeconds());

  // And the sum is the All total under EITHER basis, which is the invariant
  // D-01 is really about: the two bases disagree cell by cell and agree on the
  // whole.
  expect(seconds.reduce((a, b) => a + b, 0)).toBe(HAND_ALL.seconds);

  // The two tables differ in exactly six cells, and cell 96 is the one non-zero
  // cell they agree on. The unit cross-check proves the same fact against the
  // oracle; this is the browser reading it off the rendered attributes.
  const differing: number[] = [];
  for (let i = 0; i < 168; i += 1) {
    if (HOUR_EXPECTED.overlap[i] !== HOUR_EXPECTED.start[i]) differing.push(i);
  }
  expect(differing).toEqual([...HOUR_BASIS_DIFFERENCES]);
  expect(HOUR_EXPECTED.overlap[96]).toBe(30);
  expect(HOUR_EXPECTED.start[96]).toBe(30);

  // D-01 on the grid is stronger than on the calendar, because the grid bins by
  // hour: if the export is UTC and the reader is not, WHOLE cells move. So the
  // caption is asserted as visible text directly under the title, not merely
  // present in the source.
  const section = page.locator('section.chart', { hasText: 'Hours by weekday' });
  await expect(section).toContainText(HOUR_GRID_BASIS_CAPTION);
  const title = page.getByText('Hours by weekday and time of day');
  await expect(title).toBeVisible();
});

test('hour grid: arrows, Home, End and Escape move the roving stop, with no wrap at the edges', async ({
  page,
}) => {
  await withHandFixture(page);

  // One tab stop for 168 cells, on Monday 00:00.
  await expect(page.locator('[data-testid="hour-chart"] [tabindex="0"]')).toHaveCount(1);
  await page.locator('[data-index="0"]').focus();
  expect(await focusedHourIndex(page)).toBe('0');

  // Right walks the row; the row is 24 hours, so Right twenty-three times is
  // the last hour of Monday and the twenty-fourth must NOT wrap to Tuesday.
  await page.keyboard.press('ArrowRight');
  expect(await focusedHourIndex(page)).toBe('1');
  await page.keyboard.press('ArrowLeft');
  expect(await focusedHourIndex(page)).toBe('0');
  await page.keyboard.press('ArrowLeft');
  expect(await focusedHourIndex(page)).toBe('0');

  // End is the row's own last hour, Home its own first. On row 0 those are 23
  // and 0.
  await page.keyboard.press('End');
  expect(await focusedHourIndex(page)).toBe('23');
  await page.keyboard.press('ArrowRight');
  expect(await focusedHourIndex(page)).toBe('23');
  await page.keyboard.press('Home');
  expect(await focusedHourIndex(page)).toBe('0');

  // Down a row, and back up. The bottom row is Sunday, so Down from Monday
  // 00:00 is Tuesday 00:00 — the grid is Monday-first by D-01, not Sunday-first.
  await page.keyboard.press('ArrowDown');
  expect(await focusedHourIndex(page)).toBe('24');
  await page.keyboard.press('ArrowUp');
  expect(await focusedHourIndex(page)).toBe('0');

  // Escape closes the tooltip and leaves focus on the cell, so a reader can
  // dismiss the tooltip and keep arrowing without the grid eating the key.
  await page.keyboard.press('Escape');
  expect(await focusedHourIndex(page)).toBe('0');
  await page.keyboard.press('ArrowRight');
  expect(await focusedHourIndex(page)).toBe('1');
});

test('hour grid: (hover ring) the cell under the pointer gets the focus ring outline and only that cell', async ({
  page,
}) => {
  await withHandFixture(page);

  // A wrong test id cannot masquerade as the behaviour under test.
  await expect(page.getByTestId('hour-chart')).toBeVisible();
  await expect(page.getByTestId('hour-cell')).toHaveCount(168);

  // Nothing is outlined until the pointer is over a cell.
  await expect(hoverRings(page, 'hour-chart')).toHaveCount(0);
  await expect(focusRings(page, 'hour-chart')).toHaveCount(0);
  await expect(hoverRings(page, 'calendar-chart')).toHaveCount(0);

  const tip = page.getByTestId('chart-tooltip');
  const monday20 = gridCell(page, 20);
  const monday21 = gridCell(page, 21);

  // Snapshot the hovered cell and its right-hand neighbour BEFORE the pointer
  // arrives, so phase (a) can compare them against the same cells with the ring
  // showing.
  const monday20Before = await cellSnapshot(monday20);
  const monday21Before = await cellSnapshot(monday21);
  await monday20.hover();

  // Exactly two rects (outer accent, inner white) in the grid, none in the calendar.
  await expect(hoverRings(page, 'hour-chart')).toHaveCount(2);
  await expect(hoverRings(page, 'calendar-chart')).toHaveCount(0);

  // Centred on THAT cell: on a 24px pitch a 0.5px tolerance rules out every neighbour.
  const cellBox = await boxOf(monday20);
  const outer = hoverRings(page, 'hour-chart').nth(0);
  const inner = hoverRings(page, 'hour-chart').nth(1);
  const outerBox = await boxOf(outer);
  const innerBox = await boxOf(inner);
  expect(Math.abs(outerBox.cx - cellBox.cx)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(outerBox.cy - cellBox.cy)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(innerBox.cx - cellBox.cx)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(innerBox.cy - cellBox.cy)).toBeLessThanOrEqual(0.5);

  // The keyboard ring's geometry, read from the `width` attribute because a
  // bounding box of an SVG rect includes its stroke.
  const cellWidth = Number(await monday20.getAttribute('width'));
  expect(Number(await outer.getAttribute('width'))).toBe(cellWidth + 3);
  expect(Number(await inner.getAttribute('width'))).toBe(cellWidth + 7);

  // Painted as the keyboard ring is: accent over white, no fill, no pointer.
  expect(await ringPaint(outer)).toEqual({
    stroke: 'rgb(26, 115, 232)',
    strokeWidth: '3px',
    fill: 'none',
    pointerEvents: 'none',
  });
  const innerPaint = await ringPaint(inner);
  expect(innerPaint.stroke).toBe('rgb(255, 255, 255)');
  expect(innerPaint.strokeWidth).toBe('1px');

  // A ring's bounding-box centre is within half a pixel of a cell's centre.
  const isOn = async (ring: Locator, target: Locator): Promise<boolean> => {
    const a = await boxOf(ring);
    const b = await boxOf(target);
    return Math.hypot(a.cx - b.cx, a.cy - b.cy) <= 0.5;
  };

  // (a) The ring changes nothing about the cells: level, computed fill and
  // bounding box are identical with it showing, and the shared tooltip is open
  // with the same two lines as without it, so the ring coexists with the tooltip.
  expect(await cellSnapshot(monday20)).toEqual(monday20Before);
  expect(await cellSnapshot(monday21)).toEqual(monday21Before);
  await expect(tip).toBeVisible();
  await expect(tip).toContainText(HOUR_CELL_20_LINE1);
  await expect(tip).toContainText(HOUR_CELL_20_LINE2[HOUR_GRID_BASIS]);

  // (b) The ring follows the pointer and cannot intercept it. Cell 21 is cell
  // 20's right-hand neighbour and the ring's outer band overlaps its left 3px.
  // Moving 2px inside that edge must land on the NEIGHBOUR: a ring that took
  // pointer events would swallow the move, close the tooltip and vanish instead.
  const monday21Rect = await monday21.boundingBox();
  if (monday21Rect === null) throw new Error('hour cell 21 has no bounding box');
  await page.mouse.move(monday21Rect.x + 2, monday21Rect.y + monday21Rect.height / 2);
  await expect.poll(() => isOn(hoverRings(page, 'hour-chart').nth(0), monday21)).toBe(true);
  const ringNow = await boxOf(hoverRings(page, 'hour-chart').nth(0));
  const monday20Now = await boxOf(monday20);
  expect(
    Math.hypot(ringNow.cx - monday20Now.cx, ringNow.cy - monday20Now.cy),
  ).toBeGreaterThanOrEqual(10);
  await expect(hoverRings(page, 'hour-chart')).toHaveCount(2);
  await expect(tip).toContainText('Monday, 21:00-22:00');
  await expect(tip).toContainText(HOUR_CELL_21_LINE2[HOUR_GRID_BASIS]);

  // (c) Leaving clears it: no ring and no tooltip.
  await page.getByTestId('duration-chart').scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await expect(hoverRings(page, 'hour-chart')).toHaveCount(0);
  await expect(tip).toBeHidden();

  // (d) Hover is not keyboard focus. Nothing above drew a keyboard ring, and a
  // focus alone draws none either. Then the keyboard ring goes on cell 21
  // (ArrowRight from cell 20), and the pointer arriving on another cell and
  // leaving again must neither clear it nor move the roving stop.
  await expect(focusRings(page, 'hour-chart')).toHaveCount(0);
  await monday20.focus();
  await expect(focusRings(page, 'hour-chart')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  expect(await focusedHourIndex(page)).toBe('21');
  await expect(focusRings(page, 'hour-chart')).toHaveCount(2);
  await expect(hoverRings(page, 'hour-chart')).toHaveCount(0);
  await expect.poll(() => isOn(focusRings(page, 'hour-chart').nth(0), monday21)).toBe(true);
  await expect.poll(() => isOn(focusRings(page, 'hour-chart').nth(1), monday21)).toBe(true);

  await monday20.hover();
  await expect(hoverRings(page, 'hour-chart')).toHaveCount(2);
  await expect.poll(() => isOn(hoverRings(page, 'hour-chart').nth(0), monday20)).toBe(true);
  await expect(focusRings(page, 'hour-chart')).toHaveCount(2);
  expect(await isOn(focusRings(page, 'hour-chart').nth(0), monday21)).toBe(true);

  // (e) Parity and hygiene, while both rings are on screen. Each hover rect
  // resolves to the same paint and the same geometry as its keyboard
  // counterpart; the repo has no forced-colors rule of its own, so parity (not
  // an absolute colour) is the claim, and it holds because the two rings share
  // one declaration list.
  const hoverOuter = hoverRings(page, 'hour-chart').nth(0);
  const hoverInner = hoverRings(page, 'hour-chart').nth(1);
  const focusOuter = focusRings(page, 'hour-chart').nth(0);
  const focusInner = focusRings(page, 'hour-chart').nth(1);
  expect(await ringPaint(hoverOuter)).toEqual(await ringPaint(focusOuter));
  expect(await ringPaint(hoverInner)).toEqual(await ringPaint(focusInner));
  expect(await hoverOuter.getAttribute('width')).toBe(await focusOuter.getAttribute('width'));
  expect(await hoverInner.getAttribute('width')).toBe(await focusInner.getAttribute('width'));

  // The rings are not cells: `cellFrom` and `cellNode` resolve cells by
  // `data-index`, so a ring must carry no data attribute, no tabindex, no role.
  for (const ring of [hoverOuter, hoverInner]) {
    const names = await ring.evaluate((node) => node.getAttributeNames());
    expect(names.filter((name) => name.startsWith('data-'))).toEqual([]);
    expect(names).not.toContain('tabindex');
    expect(names).not.toContain('role');
  }

  await page.emulateMedia({ forcedColors: 'active' });
  const forcedOuter = await ringPaint(hoverOuter);
  expect(forcedOuter).toEqual(await ringPaint(focusOuter));
  expect(await ringPaint(hoverInner)).toEqual(await ringPaint(focusInner));
  expect(forcedOuter.fill).toBe('none');
  await page.emulateMedia({ forcedColors: 'none' });

  // The pointer leaves; the keyboard ring and the roving stop are untouched.
  await page.getByTestId('duration-chart').scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await expect(hoverRings(page, 'hour-chart')).toHaveCount(0);
  await expect(focusRings(page, 'hour-chart')).toHaveCount(2);
  expect(await focusedHourIndex(page)).toBe('21');

  // (f) The ring is not cropped at the corner. Cell 167 (Sunday 23:00) is flush
  // with the svg's bottom and right edges, so its ring overhangs the svg on two
  // sides: the svg must not crop it and the scroller must have room for it.
  const corner = gridCell(page, 167);
  await corner.hover();
  await expect(hoverRings(page, 'hour-chart')).toHaveCount(2);
  await expect.poll(() => isOn(hoverRings(page, 'hour-chart').nth(0), corner)).toBe(true);
  await expect.poll(() => isOn(hoverRings(page, 'hour-chart').nth(1), corner)).toBe(true);
  expect(
    await page.getByTestId('hour-chart').evaluate((node) => getComputedStyle(node).overflow),
  ).toBe('visible');
  const ringBox = await hoverRings(page, 'hour-chart').nth(1).boundingBox();
  const scrollerBox = await page.getByTestId('hour-scroller').boundingBox();
  if (ringBox === null || scrollerBox === null) throw new Error('ring or scroller has no box');
  expect(ringBox.x).toBeGreaterThanOrEqual(scrollerBox.x - 0.5);
  expect(ringBox.y).toBeGreaterThanOrEqual(scrollerBox.y - 0.5);
  expect(ringBox.x + ringBox.width).toBeLessThanOrEqual(scrollerBox.x + scrollerBox.width + 0.5);
  expect(ringBox.y + ringBox.height).toBeLessThanOrEqual(scrollerBox.y + scrollerBox.height + 0.5);

  // End with the pointer away and no hover ring.
  await page.getByTestId('duration-chart').scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await expect(hoverRings(page, 'hour-chart')).toHaveCount(0);
});

// -----------------------------------------------------------------------------
// Duration (ACTIVITY-04, D-05) — two tests
// -----------------------------------------------------------------------------

test('duration: twelve bins labelled Under 1 min through 16+ hours, counts from the hand table, summing to the Sessions tile', async ({
  page,
}) => {
  await withHandFixture(page);
  const list = page.getByTestId('duration-chart');
  await expect(list).toHaveAccessibleName(DURATION_LIST_ARIA_LABEL);

  // Twelve rows ALWAYS, empty bins included: the axis is the shape, not the
  // data. Dropping a zero bin would make the list jump under the reader.
  const rows = list.locator('[data-testid="duration-bin"]');
  await expect(rows).toHaveCount(12);

  // Labels in bin order, from the one constant the unit test also holds.
  await expect(rows.locator('.label')).toHaveText([...DURATION_BIN_LABELS]);

  // Counts from the hand table, which is keyed on the RAW length (D-05) so the
  // contained 30-minute session and the zero-length session each land in their
  // own bucket rather than being merged into the session that absorbed them.
  const counts = await rows.evaluateAll((nodes) =>
    nodes.map((node) => Number((node as HTMLElement).dataset.count)),
  );
  expect(counts).toEqual([...HAND_BINS]);
  expect(counts.reduce((a, b) => a + b, 0)).toBe(HAND_ALL.sessions);

  // And the sum is the Sessions TILE, which is the cross-check that the list
  // and the block above it are talking about the same seven sessions.
  await expect(page.getByTestId('playtime-total-sessions')).toHaveText(String(HAND_ALL.sessions));

  // The row texts, derived from the counts over seven sessions rounded to whole
  // percent: 2/7 = 28.6% to "29%" and 1/7 = 14.3% to "14%". Only the five
  // non-empty rows carry a count; an empty row reads "0".
  const texts = await rows.locator('.count').allTextContents();
  expect(texts[0]).toBe('2 · 29%');
  expect(texts[4]).toBe('1 · 14%');
  expect(texts[6]).toBe('1 · 14%');
  expect(texts[7]).toBe('2 · 29%');
  expect(texts[8]).toBe('1 · 14%');
  expect(texts[1]).toBe('0');
  expect(texts[11]).toBe('0');
});

test('duration: at 375px a row lays its bar on a line beneath its label', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await withHandFixture(page);

  // A three-column grid (label, track, count) cannot hold 12px of label plus a
  // bar plus a count in 375px minus the page gutters, so the row wraps: the
  // bar moves to a line of its own under the label and the count stays on the
  // first line. Asserted as GEOMETRY, not as a media query, because a media
  // query passing says nothing about what the reader actually sees.
  const geometry = await page.evaluate(() => {
    const row = document.querySelector('[data-testid="duration-bin"]');
    const label = row?.querySelector('.label');
    const bar = row?.querySelector('.bar');
    const count = row?.querySelector('.count');
    if (!row || !label || !bar || !count) return null;
    const l = label.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    const c = count.getBoundingClientRect();
    return {
      barBelowLabel: b.top >= l.bottom - 0.5,
      barBelowCount: b.top >= c.bottom - 0.5,
      countOnFirstLine: Math.abs(c.top - l.top) < 20,
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry?.barBelowLabel).toBe(true);
  expect(geometry?.barBelowCount).toBe(true);
  expect(geometry?.countOnFirstLine).toBe(true);
});

// -----------------------------------------------------------------------------
// Overflow at 375px — one test
// -----------------------------------------------------------------------------

test('overflow: at 375px neither chart scrolls the PAGE sideways, and both keep their own horizontal scroller', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await withHandFixture(page);

  // The page must not gain a horizontal scrollbar. A 53-week grid is wider than
  // any phone, and the scroller is what absorbs that; a page-level overflow
  // would let the reader drag the ENTIRE dashboard sideways, header and all.
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(pageOverflow).toBeLessThanOrEqual(1);

  // And each chart scrolls ITSELF, so the calendar and the hour grid can be
  // read independently.
  for (const scroller of ['calendar-scroller-2021', 'hour-scroller']) {
    const metrics = await page
      .getByTestId(scroller)
      .evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
    expect(metrics.scroll, `${scroller} is not scrollable at 375px`).toBeGreaterThan(
      metrics.client,
    );
  }

  // The scroller must be able to actually move, not merely overflow.
  const moved = await page.evaluate(() => {
    const node = document.querySelector('[data-testid="hour-scroller"]');
    if (node === null) return 0;
    node.scrollLeft = 120;
    return node.scrollLeft;
  });
  expect(moved).toBeGreaterThan(0);
});

// -----------------------------------------------------------------------------
// Sticky overlap at the two widths — two tests
// -----------------------------------------------------------------------------

for (const [width, headFits] of [
  [1280, true],
  [375, false],
] as const) {
  test(`sticky head: at ${width}px the year head never overlaps the nav`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await withHandFixture(page);

    // Scroll until the 2021 head is STUCK, which is the only state where an
    // overlap could happen — at rest the head sits below the nav by
    // construction and a scroll of zero would prove nothing.
    //
    // Scrolled to the year block's own top rather than to the document bottom.
    // 2021 is the FIRST block, so the document bottom is well past its last
    // row: the head has left with its block and is thousands of pixels above
    // the viewport, which measures the wrong thing entirely and reads as a
    // catastrophic overlap.
    const observed = await page.evaluate(() => {
      const head = document.querySelector('[data-testid="calendar-year-head-2021"]');
      const nav = document.querySelector('nav');
      if (head === null || nav === null) return null;
      // Just past the head's own resting position, so it has stuck but its
      // block still fills the viewport below it.
      const stuck = head.getBoundingClientRect().top + window.scrollY + 40;
      window.scrollTo({ top: stuck, left: 0, behavior: 'instant' });
      const h = head.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      return {
        headTop: h.top,
        headBottom: h.bottom,
        headHeight: h.height,
        navBottom: n.bottom,
        blockStillInView:
          (document.querySelector('[data-testid="calendar-year-2021"]')?.getBoundingClientRect()
            .bottom ?? 0) > 0,
      };
    });
    expect(observed).not.toBeNull();
    // A guard on the SETUP: if the head has not stuck, or its block has already
    // scrolled away, the overlap assertion below would pass vacuously.
    expect(observed!.headTop).toBeCloseTo(56, 0);
    expect(observed!.blockStillInView).toBe(true);

    // The head does not VISIBLY overlap the nav: the sticky's `top` is
    // `calc(var(--nav-offset) - 16px)` = 56px, and the nav measures 56.09px
    // tall because its own content is fractional. So the head's top edge sits
    // about 0.09px INSIDE the nav's bottom edge — a sub-pixel rounding
    // difference, not a layout bug, and the reason this asserts a one-pixel
    // tolerance rather than strict inequality. A tolerance of 0.5px is what
    // this test used first, and it failed on a real browser for that reason.
    //
    // What matters is that no meaningful band of the head is behind the nav:
    // its whole height minus that sliver is still visible.
    expect(observed!.navBottom - observed!.headTop).toBeGreaterThanOrEqual(-1);
    expect(observed!.headHeight - (observed!.headTop - 56)).toBeGreaterThan(
      observed!.headHeight - 1,
    );

    // At 375px the head is TALLER than at 1280px, because its summary wraps
    // below the year instead of sitting beside it. This is the reason the focus
    // correction measures the head rather than trusting its declared 32px, and
    // tests/e2e/playtime-ui-review.spec.ts proves the difference matters: with
    // the measured height the correction clears the head, and with 32
    // hard-coded the same test fails at 375px by about 11px.
    if (headFits) {
      // Wide: the year and the summary share a line, so the head is short.
      expect(observed!.headHeight).toBeLessThan(60);
    } else {
      // Narrow: the summary drops to a second line, so the head is taller than
      // it is at 1280 and taller than its own declared minimum.
      expect(observed!.headHeight).toBeGreaterThan(32);
    }
  });
}

// -----------------------------------------------------------------------------
// Tooltip clipping — one test
// -----------------------------------------------------------------------------

test('tooltip: a cell at the right edge keeps its tooltip inside the viewport', async ({
  page,
}) => {
  await withHandFixture(page);
  const tip = page.getByTestId('chart-tooltip');

  // The rightmost day of 2021 is the last column of that year's grid, so the
  // browser's own scroll-into-view puts it hard against the right edge. A
  // tooltip placed from the cell's right side would be cut off there; the
  // shared tooltip's placement has to flip to the cell's LEFT.
  await cell(page, '2021-12-31').hover();
  await expect(tip).toBeVisible();
  const box = await tip.boundingBox();
  const size = page.viewportSize();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(size!.width);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(size!.height);

  // And at the far LEFT, for the mirror case: a 240px-max tooltip anchored to
  // the left edge must not be pushed off the left of the screen either.
  await cell(page, '2018-03-05').hover();
  await expect(tip).toBeVisible();
  const left = await tip.boundingBox();
  expect(left!.x).toBeGreaterThanOrEqual(0);
  expect(left!.x + left!.width).toBeLessThanOrEqual(size!.width);
});

// -----------------------------------------------------------------------------
// Selector effect on the charts — one test
// -----------------------------------------------------------------------------

test('selector: choosing a server changes the CHARTS, not only the tiles', async ({ page }) => {
  await withHandFixture(page);

  // The All grid and the eu-1 grid differ in cells, because eu-1 is not the
  // whole dataset: the weekend cells 143 and 144 belong to na-1 alone. If a
  // selector only re-rendered the tiles, the charts would keep showing the
  // other server's play, which is the whole point of the control.
  const all = await hourSeconds(page);
  await expect(page.getByTestId('calendar-cell')).toHaveCount(HAND_CALENDAR_CELLS.all);

  await page.getByTestId('playtime-selector').selectOption('0'); // eu-1
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  const eu = await hourSeconds(page);
  await expect(page.getByTestId('calendar-cell')).toHaveCount(HAND_CALENDAR_CELLS.eu);

  expect(eu).not.toEqual(all);
  // eu-1 has no weekend session at all, so cells 143 and 144 are empty under
  // eu-1 and hold 1,800s each under All.
  expect(eu[143]).toBe(0);
  expect(eu[144]).toBe(0);
  expect(all[143]).toBe(HOUR_EXPECTED.overlap[143]);
  // And the sum follows the slice, not the dataset.
  expect(eu.reduce((a, b) => a + b, 0)).toBe(12_630);

  // The tiles move with them, so the reader is never looking at a chart that
  // disagrees with the numbers above it.
  await expect(page.getByTestId('playtime-total-hours')).toHaveText('3.5 hours');

  // Back to All, and the charts come back too.
  await page.getByTestId('playtime-selector').selectOption({ label: 'All' });
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  expect(await hourSeconds(page)).toEqual(all);
  await expect(page.getByTestId('calendar-cell')).toHaveCount(HAND_CALENDAR_CELLS.all);
});

// -----------------------------------------------------------------------------
// No motion — one test
// -----------------------------------------------------------------------------

test('motion: neither chart declares a transition, and a focus correction jumps rather than glides', async ({
  page,
}) => {
  await withHandFixture(page);

  // UI-SPEC section 9: these charts declare no motion of their own. Asserted on
  // the computed style, because a class that sets `transition: none` would still
  // pass a source scan while leaving the value in the cascade.
  for (const selector of ['calendar-chart', 'hour-chart', 'duration-chart']) {
    const motion = await page.getByTestId(selector).evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        transition: style.transitionDuration,
        animation: style.animationName,
      };
    });
    expect(motion.transition, `${selector} has a transition`).toBe('0s');
    expect(motion.animation, `${selector} has an animation`).toBe('none');
  }

  // The tooltip opens with no delay and no fade, so a keyboard reader is told
  // the cell's figures in the same frame the cell takes focus.
  const tip = page.getByTestId('chart-tooltip');
  await cell(page, '2021-12-31').focus();
  await expect(tip).toBeVisible();
  const tipMotion = await tip.evaluate((node) => {
    const style = getComputedStyle(node);
    return { transition: style.transitionDuration, animation: style.animationName };
  });
  expect(tipMotion.transition).toBe('0s');
  expect(tipMotion.animation).toBe('none');
});
