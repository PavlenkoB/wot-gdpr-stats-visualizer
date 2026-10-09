// =============================================================================
// Phase 07, plan 07-03 — the shared chart tooltip under a TOUCH pointer
// =============================================================================
//
// WHY A SEPARATE FILE, AND WHY IT ONLY RUNS ON ONE PROJECT
//
// `touch-tooltips.spec.ts` matches the `**/touch-*.spec.ts` glob that
// `playwright.config.ts` routes to the `chromium-mobile` project — Desktop
// Chrome at 375 x 812 with `isMobile` and `hasTouch`. The `chromium` project
// ignores that glob, so every test here is listed on exactly one project and
// runs exactly once.
//
// The project is Desktop Chrome rather than one of Playwright's phone
// descriptors on purpose: those carry a WebKit default browser, WebKit is not
// installed in CI, and the project is Chrome-first (D-04).
//
// WHAT IS PROVEN HERE
//
// The hour grid under a real touch pointer: a tap opens the shared tooltip and
// it is STILL open after the finger lifts, then every pin, move and dismissal
// the UI-SPEC's touch table names, and the two fixed announcements reaching
// one page-level live region.
//
// WHAT IS NOT PROVEN HERE, AND WHERE IT IS PROVEN
//
// Mouse and keyboard behaviour of the same chart is unchanged by any of this,
// and it is covered by `tests/e2e/playtime/playtime-charts.spec.ts`, which
// runs on the desktop project and is left untouched. Those specs are the
// regression guard: if a change here had altered hover, the arrow keys or
// Escape, they would fail.
//
// WHY `pin-locale` IS IMPORTED FIRST
//
// The assertions below compare the live region's text against two fixed
// strings and never against a formatted number, so nothing here needs the
// locale pin today. The import is first anyway because the guard in
// `tests/unit/shell/ui-copy.test.ts` fails any e2e spec that imports the copy
// module without it, and plan 07-04 extends this file with the same tooltips
// on the other three charts — some of which do assert formatted text.
// =============================================================================

import '../_support/pin-locale';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  SYNTHETIC_ZIP_NAME,
  currencyBlock,
  financialSection,
  gotoApp,
  importAndOpen,
  loginHistoryBlock,
  loginMap,
  playtimeBlock,
  premiumBlock,
} from '../_support/helpers.ts';
import {
  buildSessionsCsvFromRows,
  buildSessionsExportFromCsv,
} from '../../fixtures/sessions-fixtures.ts';
import { HAND_ROWS } from '../../fixtures/playtime-hand-fixture.ts';
import { buildSampleExport } from '../../fixtures/export-fixtures.ts';
import { buildLoginsHandExport } from '../../fixtures/logins-fixtures.ts';
import { formatCalendarDate } from '../../../src/lib/ui-copy.ts';

// The nine hand rows, small enough that the charts are predictable and the
// import is fast. Built once and shared, exactly as
// tests/e2e/playtime/playtime.spec.ts:50 does.
const HAND_EXPORT = buildSessionsExportFromCsv(buildSessionsCsvFromRows(HAND_ROWS));

/**
 * The hand export imported and the Playtime pane opened, with the Playtime block
 * settled on its data. The charts only exist while that pane is open (R4); on the
 * touch project `openSection` taps the list row and reaches the detail screen.
 */
async function openPlaytime(page: Page): Promise<void> {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'playtime');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
}

/**
 * The shared tooltip, scoped under the charts container.
 *
 * Scoped rather than `page.getByTestId('chart-tooltip')` so that a tooltip
 * belonging to some other block could not satisfy a test about this chart.
 */
function tooltip(page: Page) {
  return page.getByTestId('playtime-charts').getByTestId('chart-tooltip');
}

/** A cell of the hour grid by its `data-index`. */
function hourCell(page: Page, index: number) {
  return page.locator(`[data-testid="hour-cell"][data-index="${index}"]`);
}

/** The page-level polite live region the two announcements travel through. */
function chartStatus(page: Page) {
  return page.getByTestId('chart-status');
}

/**
 * The ONE tooltip the Financial card owns, scoped under the Financial section.
 *
 * The two monthly bar charts — Premium time and Virtual currency — both call
 * the same `onTip`, so there is a single element, and a tap in the second
 * chart moves that one element rather than opening a second.
 */
function financeTooltip(page: Page) {
  return financialSection(page).getByTestId('finance-tooltip');
}

/**
 * The hour-grid section's own heading — an element that is on screen, is
 * outside the chart's `data-tooltip-surface`, and is not a cell.
 *
 * It is the tap-outside target because tapping it must NOT move the page. A
 * tap Playwright has to scroll for would first dismiss the tooltip as a
 * SILENT scroll dismissal, and the test would then be asserting the wrong
 * dismissal entirely — one that would also pass if the tap-outside rule were
 * broken. The caller asserts it is in the viewport first, so a layout change
 * that moved it off screen fails the test instead of quietly changing what the
 * test means.
 */
function hourGridHeading(page: Page) {
  return page
    .locator('[data-testid="playtime-charts"] section', { has: page.getByTestId('hour-scroller') })
    .getByRole('heading', { level: 4 });
}

/** The tooltip's placed position, read from the CSSOM the component writes. */
async function placedAt(tip: Locator): Promise<string> {
  return tip.evaluate(
    (node) => `${(node as HTMLElement).style.left}/${(node as HTMLElement).style.top}`,
  );
}

/**
 * Fail loudly if a routing mistake put this file on the desktop project.
 *
 * Every test in this file asserts it, because a touch spec that quietly ran
 * on a mouse-capable browser would pass while testing nothing about touch —
 * `tap()` still works, `pointerType` is still `touch`, and the failure would
 * be invisible until CI's real phone run.
 */
async function expectTouchProject(): Promise<void> {
  expect(test.info().project.name).toBe('chromium-mobile');
}

test('a tap on an hour cell opens the shared tooltip, and it is still open after the finger lifts', async ({
  page,
}) => {
  await expectTouchProject();
  await openPlaytime(page);

  const tip = tooltip(page);
  await expect(tip).toBeHidden();

  await hourCell(page, 0).tap();

  await expect(tip).toBeVisible();
  await expect(tip).not.toHaveAttribute('hidden', /.*/);
  const text = ((await tip.textContent()) ?? '').trim();
  expect(text, 'the tooltip carries the tapped cell’s two lines').not.toBe('');

  // The `out` half of a tap must not close what the tap's own press opened,
  // and nothing may time it out: there is no timer anywhere in the touch path
  // (D-05). 600 ms is long past any of this suite's own waits, so a tooltip
  // that survived it survived on its own.
  await page.waitForTimeout(600);
  await expect(tip).toBeVisible();
  expect(((await tip.textContent()) ?? '').trim()).toBe(text);
});

test('a tap announces "Tooltip pinned." in the one page-level live region', async ({ page }) => {
  await expectTouchProject();
  await openPlaytime(page);

  // Empty before anything is pinned: the region exists in the accessibility
  // tree before it speaks, so that the first pin is announced rather than
  // created together with its own text.
  await expect(chartStatus(page)).toHaveText('');

  await hourCell(page, 0).tap();

  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');
  await expect(tooltip(page)).toBeVisible();
});

test('a second tap MOVES the pinned tooltip, changes its text and its place, and announces nothing new', async ({
  page,
}) => {
  await expectTouchProject();
  await openPlaytime(page);

  const tip = tooltip(page);
  // Two ADJACENT cells in the first visible columns, so the second tap does
  // not have to scroll the page — a scroll between the two taps would dismiss
  // the tooltip and this would be testing the wrong thing.
  await hourCell(page, 0).tap();
  await expect(tip).toBeVisible();
  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');

  const firstLine = await tip.locator('p').first().textContent();
  const firstAt = await placedAt(tip);

  await hourCell(page, 1).tap();

  // Still pinned and still open — a move is not a dismissal, and the tooltip
  // is not re-created: the same element carried new text.
  await expect(tip).toBeVisible();
  expect(await tip.locator('p').first().textContent()).not.toBe(firstLine);
  expect(await placedAt(tip)).not.toBe(firstAt);

  // A move announces NOTHING. The region still holds the pin announcement, and
  // it has never said "Tooltip dismissed." — a move that announced either
  // would be a reader being told the tooltip closed while it is on screen.
  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');
});

test('tapping the pinned cell again, tapping outside the chart, and Escape each dismiss it loudly', async ({
  page,
}) => {
  await expectTouchProject();
  await openPlaytime(page);

  const tip = tooltip(page);
  const heading = hourGridHeading(page);

  // (a) A second tap on the anchor of a PINNED tooltip. The document capture
  // handler has to stop this tap before the chart's own press handler runs, or
  // the chart would reopen what the tap just closed inside the same gesture.
  await hourCell(page, 0).tap();
  await expect(tip).toBeVisible();
  await hourCell(page, 0).tap();
  await expect(tip).toBeHidden();
  await expect(chartStatus(page)).toHaveText('Tooltip dismissed.');

  // (b) A tap outside the chart's own surface, on the hour-grid section's own
  // heading. Asserted in the viewport first: if Playwright had to scroll to
  // reach it, the dismissal under test would be the SILENT scroll one instead.
  await hourCell(page, 0).tap();
  await expect(tip).toBeVisible();
  await expect(heading).toBeInViewport();
  await heading.tap();
  await expect(tip).toBeHidden();
  await expect(chartStatus(page)).toHaveText('Tooltip dismissed.');

  // (c) Escape, with focus nowhere in particular: a finger leaves no focus
  // holding a pinned tooltip, so nothing else would ever close it.
  await hourCell(page, 0).tap();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(chartStatus(page)).toHaveText('Tooltip dismissed.');
});

test('a scroll dismisses it SILENTLY, and clearing the region is what lets the next pin speak', async ({
  page,
}) => {
  await expectTouchProject();
  await openPlaytime(page);

  const tip = tooltip(page);

  await hourCell(page, 0).tap();
  await expect(tip).toBeVisible();
  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');

  // The page scrolls, which moves the cell, which is the one dismissal the
  // UI-SPEC makes quiet: the reader moved the page, and did not ask for the
  // tooltip to go.
  //
  // The browser answers every scroll with a synthetic mouse move at the mouse's
  // last position, and a mouse over a cell opens the tooltip again (a hover is a
  // fresh open, so it is not stale). Where that last position sits is a property
  // of the emulation, and with the pane's geometry the scrolled grid lands right
  // under it. The mouse is parked on the page's corner first, which is not on a
  // cell at any scroll offset, so what is asserted is the scroll dismissal and
  // not where an unrelated mouse happens to rest.
  await page.mouse.move(1, 1);
  await page.evaluate(() => window.scrollBy(0, 200));
  await expect(tip).toBeHidden();
  // EMPTY, not "Tooltip dismissed." and not the pin text. The clearing is the
  // load-bearing half: a live region that still held "Tooltip pinned." would
  // not announce that same text a second time, and the next pin would be
  // silent.
  await expect(chartStatus(page)).toHaveText('');

  // Back to the top, then pin again — which is what proves the region was
  // cleared rather than merely not spoken to.
  await page.evaluate(() => window.scrollTo(0, 0));
  await hourCell(page, 0).tap();
  await expect(tip).toBeVisible();
  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');
});

// =============================================================================
// The two Financial bar charts, which SHARE one tooltip
// =============================================================================

/**
 * The sample export, which carries both `Premium_account` and
 * `Virtual_currencies` — the two files D-02 gave the Financial card.
 *
 * Built once and shared, exactly as the playtime helpers above do: every
 * import is a full unzip, parse and ingest, and this test needs one.
 */
const SAMPLE_EXPORT = buildSampleExport();

/** The Finance pane opened, with both sub-blocks settled on their data. */
async function openFinance(page: Page): Promise<void> {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, SAMPLE_EXPORT, 'finance');
  await expect(premiumBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(currencyBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
}

/**
 * A heading inside the Financial card that is NOT inside either chart.
 *
 * The tap-outside target. It is asserted in the viewport before it is tapped,
 * because a tap Playwright had to scroll for would first dismiss the tooltip
 * as a SILENT scroll dismissal — and the test would then be asserting a
 * dismissal that also passes if the tap-outside rule were broken.
 */
function currencyChartHeading(page: Page) {
  return page
    .getByTestId('currency-block')
    .getByTestId('currency-chart')
    .first()
    .getByRole('heading', { level: 4 });
}

test('a tap pins the Financial card’s ONE shared tooltip, a tap in the other chart MOVES it, and a tap outside dismisses it', async ({
  page,
}) => {
  await expectTouchProject();
  await openFinance(page);

  const tip = financeTooltip(page);
  await expect(tip).toBeHidden();

  // (a) A tap in the Premium chart opens and pins the shared tooltip.
  await page.locator('[data-testid="premium-cell"]').first().tap();
  await expect(tip).toBeVisible();
  const premiumLine = ((await tip.locator('p').first().textContent()) ?? '').trim();
  expect(premiumLine, 'the tooltip carries the tapped bar’s first line').not.toBe('');
  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');

  // (b) A tap in the CURRENCY chart moves that same tooltip. The two charts
  // have one owner, so the move crosses charts — which is why this is the
  // tracer: the surface the document handler reads is the chart the tooltip is
  // currently anchored to, and a tap in the other chart is "outside" it, so
  // the dismissal and the re-pin both happen inside one tap.
  //
  // The END state is asserted, not the state between the two: the second tap
  // has to scroll the page (the two charts are far apart at 375px), and that
  // scroll is itself a dismissal. `toHaveText` retries, so it settles on the
  // state the tap produced rather than on the one it passed through.
  await page.locator('[data-testid="currency-cell"]').first().tap();
  await expect(tip).toBeVisible();
  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');
  // ONE element, not two: a second tooltip instance in this card would be two
  // elements racing for the same pointer, and both would be visible at once.
  await expect(financeTooltip(page)).toHaveCount(1);
  const currencyLine = ((await tip.locator('p').first().textContent()) ?? '').trim();
  expect(currencyLine).not.toBe('');
  // The SAME element now carries the other chart's numbers: a second tooltip
  // instance would have left the Premium text in place.
  expect(currencyLine).not.toBe(premiumLine);

  // (c) A tap outside the chart dismisses it loudly. The Currency chart's own
  // heading is the target: it is on screen with the tapped bar, it is not a
  // cell, and it is not inside the chart's `data-tooltip-surface`.
  const heading = currencyChartHeading(page);
  await expect(heading).toBeInViewport();
  await heading.tap();
  await expect(tip).toBeHidden();
  await expect(chartStatus(page)).toHaveText('Tooltip dismissed.');
});

// =============================================================================
// The year calendar, the second Playtime chart on the same tooltip
// =============================================================================

/** One calendar cell, by the date its accessible name carries (UAT-2). */
function calendarCell(page: Page, date: string) {
  return page.locator(`[data-day][aria-label*="${date}"]`).first();
}

test('a tap pins the calendar’s tooltip, a tap on the next day MOVES it, and a tap outside and Escape each dismiss it', async ({
  page,
}) => {
  await expectTouchProject();
  await openPlaytime(page);

  const tip = tooltip(page);
  await expect(tip).toBeHidden();

  // (a) Tap a populated day. March 5, 2018 is row 1 of the hand export, and
  // the two days below sit in the SAME week row 11px apart, so the second tap
  // needs no scroll — a scroll between the two would dismiss the tooltip and
  // the move would never be exercised.
  const day5 = calendarCell(page, 'Mar 5, 2018');
  await day5.tap();
  await expect(tip).toBeVisible();
  expect(
    ((await tip.locator('p').first().textContent()) ?? '').trim(),
    'the tooltip names the day that was tapped, in the format the copy module builds',
  ).toBe(formatCalendarDate(Number(await day5.getAttribute('data-day'))));
  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');

  // (b) The adjacent day MOVES it: same element, new text, and nothing is
  // announced — a move is not a dismissal.
  const firstLine = ((await tip.locator('p').first().textContent()) ?? '').trim();
  const firstAt = await placedAt(tip);
  await calendarCell(page, 'Mar 6, 2018').tap();
  await expect(tip).toBeVisible();
  expect(((await tip.locator('p').first().textContent()) ?? '').trim()).not.toBe(firstLine);
  expect(await placedAt(tip)).not.toBe(firstAt);
  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');

  // (c) A tap outside the calendar dismisses it loudly. The hour grid's own
  // heading is on screen with the calendar at 375px, and it is outside the
  // calendar's `data-tooltip-surface`. Asserted in the viewport first, so a
  // tap Playwright had to scroll for cannot pass as a tap-outside.
  const heading = hourGridHeading(page);
  await expect(heading).toBeInViewport();
  await heading.tap();
  await expect(tip).toBeHidden();
  await expect(chartStatus(page)).toHaveText('Tooltip dismissed.');

  // (d) Escape, with a pin standing and focus nowhere in particular: a finger
  // leaves no focus holding a tooltip open.
  await calendarCell(page, 'Mar 5, 2018').tap();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(chartStatus(page)).toHaveText('Tooltip dismissed.');
});

// =============================================================================
// The world map, the third chart on a tooltip of its own
// =============================================================================

/** A point inside the viewport where a touch press really lands on this country. */
interface TapPoint {
  x: number;
  y: number;
}

/**
 * A point where a press lands on this country's OWN element.
 *
 * A country's readable place is its shape, and a shape is not its bounding box:
 * the centre of Italy's box is in the sea, and Australia is concave enough that
 * a fixed point in its box misses. So the candidates are swept across the box
 * and the first one the browser itself resolves to this country's path (or to
 * its hit circle, which is the only thing a finger can reach for a country a
 * few pixels across) is the one the test uses. Nothing here guesses.
 */
async function tapPointFor(page: Page, iso: string): Promise<TapPoint> {
  const point = await page.evaluate((code) => {
    const map = document.querySelector('[data-testid="login-map"]');
    if (map === null) return null;
    const own = (node: Element | null): boolean => {
      const found = node?.closest('[data-iso]') ?? null;
      return found !== null && found.getAttribute('data-iso') === code;
    };
    const targets = [
      map.querySelector(`[data-testid="login-country"][data-iso="${code}"]`),
      ...map.querySelectorAll(`.hit[data-iso="${code}"], .marker[data-iso="${code}"]`),
    ];
    // A point that is on the country AND has the country on all four sides of
    // it at `margin` pixels, tried with the widest margin first. A country can
    // be a handful of pixels across (Germany is about 7 x 8 at the pane's
    // width), and a point on its very edge is one where `elementFromPoint`
    // answers "this country" but a real touch press, which is hit-tested
    // separately, lands on the map behind it. Falling back to a bare edge point
    // only when no interior point exists keeps a one-pixel country tappable.
    for (const margin of [2, 1, 0]) {
      for (const target of targets) {
        if (!(target instanceof Element)) continue;
        const box = target.getBoundingClientRect();
        // One pixel at a time while the shape is small, coarser as it grows, so
        // a big country does not cost a thousand hit tests.
        const step = Math.max(1, Math.floor(Math.max(box.width, box.height) / 24));
        for (let y = box.top; y <= box.bottom; y += step) {
          for (let x = box.left; x <= box.right; x += step) {
            const around: [number, number][] = [
              [x, y],
              [x - margin, y],
              [x + margin, y],
              [x, y - margin],
              [x, y + margin],
            ];
            if (around.every(([px, py]) => own(document.elementFromPoint(px, py)))) {
              return { x, y };
            }
          }
        }
      }
    }
    return null;
  }, iso);
  expect(point, `${iso} has a point a press really lands on`).not.toBeNull();
  return point as TapPoint;
}

test('a tap pins the map’s tooltip at the finger, a tap elsewhere MOVES it, and tap-again, a tap outside and Escape dismiss it', async ({
  page,
}) => {
  await expectTouchProject();
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, buildLoginsHandExport(), 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  const tip = page.getByTestId('map-tooltip');
  // Both countries are on screen together at 375px, so neither tap has to
  // scroll the page first — a scroll would dismiss the pin and the move would
  // never be exercised.
  await loginMap(page).scrollIntoViewIfNeeded();
  const onA = await tapPointFor(page, 'DE');
  const onB = await tapPointFor(page, 'AU');

  // (a) A tap on a country opens the tooltip AT THE FINGER and pins it.
  await page.touchscreen.tap(onA.x, onA.y);
  await expect(tip).toBeVisible();
  const lineA = ((await tip.locator('p').first().textContent()) ?? '').trim();
  expect(lineA, 'the tooltip carries the tapped country’s name').not.toBe('');
  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');

  // (b) A tap on ANOTHER country moves it, across the map rather than within
  // one chart: same element, new text, and nothing announced.
  await page.touchscreen.tap(onB.x, onB.y);
  await expect(tip).toBeVisible();
  const lineB = ((await tip.locator('p').first().textContent()) ?? '').trim();
  expect(lineB).not.toBe(lineA);
  await expect(chartStatus(page)).toHaveText('Tooltip pinned.');

  // (c) A tap on the SAME country toggles the pin off. The country's own
  // element is the anchor, so the shared tooltip has something to compare the
  // press against; without it this press would re-pin what it just closed.
  await page.touchscreen.tap(onB.x, onB.y);
  await expect(tip).toBeHidden();
  await expect(chartStatus(page)).toHaveText('Tooltip dismissed.');

  // (d) A tap outside the map dismisses it loudly. The map section's own
  // heading is on screen with the map, and it is not inside the svg.
  await page.touchscreen.tap(onA.x, onA.y);
  await expect(tip).toBeVisible();
  const heading = page.getByTestId('login-map-section').getByRole('heading', { level: 4 });
  await expect(heading).toBeInViewport();
  await heading.tap();
  await expect(tip).toBeHidden();
  await expect(chartStatus(page)).toHaveText('Tooltip dismissed.');

  // (e) Escape, with a pin standing and focus nowhere in particular.
  await page.touchscreen.tap(onA.x, onA.y);
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(chartStatus(page)).toHaveText('Tooltip dismissed.');
});
