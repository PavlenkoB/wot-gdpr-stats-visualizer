import '../_support/pin-locale';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  detailPane,
  gotoApp,
  importAndOpen,
  playtimeBlock,
  premiumBlock,
  SYNTHETIC_ZIP_NAME,
} from '../_support/helpers.ts';
import { buildCustomExport, buildSampleExport } from '../../fixtures/export-fixtures.ts';
import {
  PREMIUM_HAND_ROWS,
  PREMIUM_HEADER,
  premiumRow,
  renderQuoteAllCsv,
} from '../../fixtures/finance-fixtures.ts';

/**
 * Plan 08-20 (gap G-08-3): the Finance charts fill the detail pane and nothing
 * in the pane runs past its edge.
 *
 * The unit tests pin the layout arithmetic; only a browser can prove the
 * measured container width reaches the svg, follows a resize, and that no
 * element outside a scroller crosses the pane's content edge.
 */

/** How far an svg is from the width of the scroller that measures itself. */
async function widthGap(svg: Locator): Promise<number> {
  return svg.evaluate((node) => {
    const scroller = node.closest('[data-testid="bar-scroller"]');
    return scroller === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(Number(node.getAttribute('width')) - scroller.clientWidth);
  });
}

/** Every Finance chart svg (premium and each currency) fills its scroller. */
async function expectChartsFill(page: Page): Promise<void> {
  const charts = page.locator('[data-testid="premium-chart"], [data-testid="currency-svg"]');
  expect(await charts.count()).toBeGreaterThan(0);
  for (let index = 0; index < (await charts.count()); index += 1) {
    const chart = charts.nth(index);
    await expect.poll(() => widthGap(chart)).toBeLessThanOrEqual(1);
  }
}

/**
 * Elements of the detail pane that are NOT inside a scroller and extend more
 * than 1px past the pane's content edge, plus the page's own sideways overflow.
 * Scrollers (overflow-x auto, scroll or hidden) are designed to be wider than
 * their box, so what is inside one is skipped.
 */
async function paneOverflow(page: Page): Promise<{ offenders: string[]; page: number }> {
  return page.evaluate(() => {
    const pane = document.querySelector('[data-testid="detail-pane"]');
    if (pane === null) return { offenders: ['no detail-pane'], page: 0 };
    const style = getComputedStyle(pane);
    const edge =
      pane.getBoundingClientRect().right -
      parseFloat(style.paddingRight) -
      parseFloat(style.borderRightWidth);
    const scrolls = (el: Element): boolean => {
      const overflowX = getComputedStyle(el).overflowX;
      return overflowX === 'auto' || overflowX === 'scroll';
    };
    const offenders: string[] = [];
    const nameOf = (el: Element): string => {
      const id = el.getAttribute('data-testid');
      return id !== null ? id : el.tagName.toLowerCase() + '.' + el.className;
    };
    for (const el of pane.querySelectorAll('*')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0) continue;
      let inside = false;
      for (let a = el.parentElement; a !== null && a !== pane; a = a.parentElement) {
        if (scrolls(a)) {
          inside = true;
          break;
        }
      }
      if (inside) continue;
      if (box.right > edge + 1) {
        offenders.push(`${nameOf(el)} right ${box.right.toFixed(1)} > edge ${edge.toFixed(1)}`);
      }
      // An unbroken word overflows its box without growing it, so the element's
      // own rectangle cannot see it: measure the text itself.
      for (const child of el.childNodes) {
        if (child.nodeType !== Node.TEXT_NODE || (child.textContent ?? '').trim() === '') continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        const right = range.getBoundingClientRect().right;
        if (right > edge + 1) {
          offenders.push(`${nameOf(el)} text right ${right.toFixed(1)} > edge ${edge.toFixed(1)}`);
        }
      }
    }
    const root = document.documentElement;
    return { offenders, page: root.scrollWidth - root.clientWidth };
  });
}

async function expectNoOverflow(page: Page, label: string): Promise<void> {
  await expect(detailPane(page)).toHaveAttribute('data-pane', 'finance');
  // The layout follows the window through a resize observer, so right after a
  // setViewportSize a loaded worker can still be on the old geometry. Poll until it
  // settles; an overflow that persists still fails once the timeout runs out.
  await expect
    .poll(async () => (await paneOverflow(page)).offenders, {
      message: `${label}: elements past the pane content edge`,
    })
    .toEqual([]);
  await expect
    .poll(async () => (await paneOverflow(page)).page, {
      message: `${label}: the page scrolls sideways`,
    })
    .toBeLessThanOrEqual(0);
}

/** A premium file with the hand rows plus one unrecognised 300-character token. */
function buildLongTokenExport(): Uint8Array {
  return buildCustomExport({
    overrides: {
      'Financial_data/Operations_with_Premium_Days.csv': renderQuoteAllCsv(PREMIUM_HEADER, [
        ...PREMIUM_HAND_ROWS,
        premiumRow('Z'.repeat(300), '2019-06-13 00:00:00'),
      ]),
    },
  });
}

test('finance charts fill the detail pane', async ({ page, browser }) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, buildSampleExport(), 'finance');
  await expect(premiumBlock(page)).toHaveAttribute('data-state', 'ready');

  // 1280: every chart is exactly as wide as its scroller, and a short chart is a
  // column chart across the pane, not slabs: no bar is wider than 32px.
  await expectChartsFill(page);
  const widths = await page
    .getByTestId('premium-chart')
    .locator('[data-testid="in-bar"]')
    .evaluateAll((rects) => rects.map((rect) => Number(rect.getAttribute('width'))));
  expect(widths.length).toBeGreaterThan(0);
  for (const barWidth of widths) {
    expect(barWidth).toBeLessThanOrEqual(32);
  }
  await expectNoOverflow(page, 'sample at 1280');

  // The layout follows the window, not only first paint, and nothing stops it
  // short at a wide width: there is no upper bound.
  await page.setViewportSize({ width: 800, height: 900 });
  await expectChartsFill(page);
  await expectNoOverflow(page, 'sample at 800');

  await page.setViewportSize({ width: 2400, height: 900 });
  await expectChartsFill(page);

  // 375: dense charts keep their own scroller, so only the guard applies.
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoOverflow(page, 'sample at 375');

  // A 300-character unbroken premium value, listed on screen, still wraps.
  // A fresh context: the app caches the imported dataset per origin, so a second
  // page of the same context would open the sample again instead of this file.
  const longContext = await browser.newContext();
  const long = await longContext.newPage();
  await long.setViewportSize({ width: 1280, height: 900 });
  await gotoApp(long);
  await importAndOpen(long, SYNTHETIC_ZIP_NAME, buildLongTokenExport(), 'finance');
  await expect(premiumBlock(long)).toHaveAttribute('data-state', 'ready');
  await long.getByTestId('premium-unrecognised').locator('summary').click();
  await expect(long.getByTestId('premium-unrecognised').locator('ul')).toBeVisible();
  await expectNoOverflow(long, 'long token at 1280');
  await long.setViewportSize({ width: 800, height: 900 });
  await expectNoOverflow(long, 'long token at 800');
  await long.setViewportSize({ width: 375, height: 800 });
  await expectNoOverflow(long, 'long token at 375');
  await longContext.close();
});

/** How far an svg is from the clientWidth of the scroller that holds it. */
async function scrollerGap(page: Page, scrollerId: string, svgSelector: string): Promise<number> {
  return page.evaluate(
    ([scrollerSel, svgSel]) => {
      const scroller = document.querySelector(`[data-testid^="${scrollerSel}"]`);
      const svg = scroller?.querySelector(svgSel);
      if (!scroller || !svg) return Number.POSITIVE_INFINITY;
      return Math.abs(Number(svg.getAttribute('width')) - scroller.clientWidth);
    },
    [scrollerId, svgSelector] as const,
  );
}

/** The first rect of a test id: one attribute as a number. */
async function firstCellAttr(page: Page, testId: string, attr: string): Promise<number> {
  return page
    .getByTestId(testId)
    .first()
    .evaluate((node, name) => Number(node.getAttribute(name)), attr);
}

test('playtime charts fill the detail pane', async ({ page }) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, buildSampleExport(), 'playtime');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('calendar-chart')).toBeVisible();

  // 1280: the pane content is about 879px; the first year's svg equals its
  // scroller and its cells are no longer the old 10px.
  await expect.poll(() => scrollerGap(page, 'calendar-scroller-', 'svg')).toBeLessThanOrEqual(1);
  await expect.poll(() => firstCellAttr(page, 'calendar-cell', 'width')).toBeGreaterThanOrEqual(14);
  await expect.poll(() => scrollerGap(page, 'hour-scroller', 'svg')).toBeLessThanOrEqual(1);

  // 2400: nothing stops the chart short of the pane, and only the cell height
  // is capped (row pitch 24).
  await page.setViewportSize({ width: 2400, height: 900 });
  await expect.poll(() => scrollerGap(page, 'calendar-scroller-', 'svg')).toBeLessThanOrEqual(1);
  await expect.poll(() => firstCellAttr(page, 'calendar-cell', 'height')).toBeLessThanOrEqual(23);
  await expect.poll(() => scrollerGap(page, 'hour-scroller', 'svg')).toBeLessThanOrEqual(1);
});
