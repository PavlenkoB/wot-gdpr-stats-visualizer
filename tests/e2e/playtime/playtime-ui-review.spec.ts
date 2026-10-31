import '../_support/pin-locale';
import { expect, test, type Page } from '@playwright/test';
import { SYNTHETIC_ZIP_NAME, gotoApp, importAndOpen, playtimeBlock } from '../_support/helpers.ts';
import { SCALE_5K_SPEC, buildSessionsExport } from '../../fixtures/sessions-fixtures.ts';

// =============================================================================
// Phase 04, plans 04-17 and 04-18 — the UI-review gaps, in a real browser
// =============================================================================
//
// WHAT THIS FILE HOLDS
// The browser proofs for the gaps the Phase 4 UI audit filed (UAT G-04-UI-1 to
// G-04-UI-3). 04-17 adds the two below; 04-18 appends the tile and legend ones.
//
// WHY A SEPARATE SPEC AND NOT A BLOCK IN playtime-charts.spec.ts
// That spec is already past the 16-test cap its own header records (17 listed),
// and every test in it costs an import through the single CI worker. A gap
// closure adds tests to a phase that is already built, so they belong beside
// the other gap tests rather than growing a finished spec.
//
// WHERE THE NUMBERS COME FROM
// Every figure in the comments below was MEASURED against the built app with
// the synthetic export below, before the plan that writes this file was
// written, and every measurement is a font metric or a box in the DOM — never
// a figure from the real archive. The real archive is never opened here: the
// export is `SCALE_5K_SPEC` through the same fixture builder every other spec
// uses, and it is synthetic by construction.
// =============================================================================

test.use({ reducedMotion: 'reduce' });

/**
 * The export, built ONCE at module level.
 *
 * A 5,000-session export over twelve years is the one this spec needs and the
 * reason the assertions below are not written against a nine-row hand fixture:
 * it has twelve year blocks, a four-digit hours total, and a year head whose
 * summary is long enough to WRAP at 375px. The hand fixture has none of those,
 * so a test written on it would pass against a chart that only ever renders one
 * narrow, single-line year.
 */
const SCALE_EXPORT = buildSessionsExport(SCALE_5K_SPEC).bytes;

/**
 * Open the app, import the export, open the Playtime pane and wait for the block
 * to settle. A viewport resize after this keeps the open pane (the click
 * recorded the detail view), so `setWidth` below needs no re-open.
 */
async function withScaleFixture(page: Page): Promise<void> {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, SCALE_EXPORT, 'playtime');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('playtime-charts')).toBeVisible();
}

/**
 * Resize and let layout settle.
 *
 * Two animation frames, because a sticky element's stuck position and a
 * wrapped flex row's height both land one frame after the viewport changes;
 * measuring on the first frame reads the pre-resize layout.
 */
async function setWidth(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 720 });
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
  );
}

test('G-04-UI-1: calendar weekday labels sit fully inside the gutter of every year, at 1280px and 375px', async ({
  page,
}) => {
  await withScaleFixture(page);
  const chart = page.getByTestId('calendar-chart');

  for (const width of [1280, 375] as const) {
    await setWidth(page, width);
    await chart.scrollIntoViewIfNeeded();

    // ONE evaluation over every year svg, because twelve years at two widths is
    // 24 layouts and round-tripping each through the protocol would turn a
    // geometry assertion into a timing one.
    //
    // The gutter is MEASURED from the DOM — the smallest x among that svg's own
    // cells — and never written as a literal, because the claim under test is
    // "the labels fit the gutter the chart actually drew", not "the gutter
    // equals a number this file repeats". A test that compared the labels with
    // a copy of the constant would pass on any chart whose two halves agree,
    // including the clipped one this was filed for.
    const years = await chart.evaluate((root) =>
      Array.from(root.querySelectorAll('svg')).map((svg) => {
        const cells = Array.from(svg.querySelectorAll('[data-testid="calendar-cell"]'));
        const xs = cells.map((cell) => Number(cell.getAttribute('x')));
        const scroller = svg.closest('[data-testid^="calendar-scroller-"]');
        const scrollerLeft = scroller?.getBoundingClientRect().left ?? 0;
        // Typed as `SVGTextElement` rather than the base `Element` a bare
        // query gives, because `getBBox` is on the SVG element interface —
        // which is exactly the kind of place an untyped query would fail in the
        // typecheck rather than at runtime.
        const labels = Array.from(svg.querySelectorAll<SVGTextElement>('text.axis'))
          .map((text) => ({ text: (text.textContent ?? '').trim(), node: text }))
          .filter((label) => label.text === 'Mon' || label.text === 'Wed' || label.text === 'Fri')
          .map((label) => {
            // getBBox is the label's own text box in the svg's user space: the
            // x it starts at is the number that went negative when the gutter
            // was too narrow, and the width is the widest the label can be.
            const box = label.node.getBBox();
            return {
              text: label.text,
              x: box.x,
              width: box.width,
              clientLeft: label.node.getBoundingClientRect().left,
            };
          });
        return {
          width: Number(svg.getAttribute('width')),
          scrollerWidth: scroller?.clientWidth ?? 0,
          gutter: Math.min(...xs),
          scrollerLeft,
          labels,
        };
      }),
    );

    // The empty-chart guard. Without it every loop below iterates nothing and
    // the test passes on a page that drew no calendar at all.
    expect(years.length).toBeGreaterThanOrEqual(2);

    for (const year of years) {
      expect(year.labels).toHaveLength(3);
      for (const label of year.labels) {
        // The claim, in the label's own coordinates: the text starts inside
        // the svg and ends before the first column. A MEASURED text box and
        // not a pixel literal, because the CI runner is self-hosted and its
        // fallback face may set these three words wider than this machine's.
        expect(
          label.x,
          `${label.text} starts left of the svg at ${width}px`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          label.x + label.width,
          `${label.text} runs into the first column at ${width}px`,
        ).toBeLessThanOrEqual(year.gutter);

        // And in the page's own coordinates: nothing is painted left of the
        // scroller that clips it. The 0.01 is a sub-pixel rounding allowance,
        // not a tolerance for a clipped label — a clipped one is about 4px and
        // 5px out, as the audit measured.
        expect(label.clientLeft).toBeGreaterThanOrEqual(year.scrollerLeft - 0.01);
      }

      // The measured rule (plan 08-21, G-08-3): the svg is either today's 634px
      // floor (and scrolls, at 375px) or exactly as wide as the scroller that
      // measures it. A gutter change that broke the 54-column fit would show
      // here as a width that is neither.
      const fillsScroller = Math.abs(year.width - year.scrollerWidth) <= 1;
      expect(
        year.width === 634 || fillsScroller,
        `svg ${year.width}px vs scroller ${year.scrollerWidth}px at ${width}px`,
      ).toBe(true);
    }
  }
});

/** The `data-date` of whatever currently holds DOM focus, or null. */
function activeDate(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute('data-date') ?? null);
}

/** The `data-index` of whatever currently holds DOM focus, or null. */
function activeIndex(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute('data-index') ?? null);
}

// -----------------------------------------------------------------------------
// G-04-UI-3, sticky-head clause: the focus correction's DIRECTION
// -----------------------------------------------------------------------------
//
// The year head is a wrapping row: it declares a 32px min-height on a
// content-box element, and MEASURES 41px at 1280px with the summary on one line
// and 52px at 375px with the summary wrapped. `CalendarHeatmap` reads its
// offsetHeight at focus time and passes it to `scrollClear`, so the height
// reaches the correction as a measurement.
//
// The fault this test was filed for is the SIGN, not the height. `scrollClear`
// negated `focusScrollDelta`'s result, so a cell that needed to move DOWN on
// screen scrolled the page DOWN and moved up: parked under the stuck head and
// moved with ArrowUp, the cell went from 68px to 31px below the viewport top at
// 1280px and from 69px to 21px at 375px — the correction fired and buried the
// cell. 04-11 could not reach the path because the browser's own `focus()`
// centres a cell that is OFF screen; it is reachable exactly when the cell is
// ON screen and under the chrome, which is the normal state while scrolling
// down through the stacked years. Parking the cell by hand is how this test
// gets there from a real key sequence.

/**
 * The year block this test drives, and why this one.
 *
 * SCALE_5K_SPEC covers 2012 to 2023 and the blocks are newest first, so 2022
 * is the second block: near the top of the calendar, where there is document
 * above it to scroll and the head is stuck, and its April cells sit at the top
 * of the grid where a single row step lands directly under the head. Its April
 * summary is long enough to wrap at 375px, which is what makes the head there
 * 52px rather than 41px — the reason the correction has to measure it.
 */
const YEAR = 2022;
/** 2022-04-18 was a Monday (row 0); 2022-04-19 a Tuesday (row 1), same column. */
const MONDAY = '2022-04-18';
const TUESDAY = '2022-04-19';

test('G-04-UI-3: a key move into a row hidden under the sticky chrome scrolls the page up until the cell is clear', async ({
  page,
}) => {
  await withScaleFixture(page);

  // 375 FIRST. A correction that hard-codes the declared 32px falls short by
  // the most where the head is tallest, so the width that catches it is the
  // one that runs first — the mutation check at the end of plan 04-17's task
  // depends on this order.
  const headHeights: number[] = [];

  for (const width of [375, 1280] as const) {
    await setWidth(page, width);
    await page.getByTestId('calendar-chart').scrollIntoViewIfNeeded();
    await page.locator(`[data-testid="calendar-cell"][data-date="${TUESDAY}"]`).focus();

    // Park the Monday of the same week under the stuck head: scroll by exactly
    // what puts its top 12px below the VIEWPORT top (there is no nav above the
    // content, so the stuck head sits at the very top). 12px is inside the
    // head's own height at both widths, so the cell is genuinely behind it.
    const parked = await page.evaluate(
      ({ date, year }) => {
        const cell = document.querySelector(`[data-testid="calendar-cell"][data-date="${date}"]`);
        const head = document.querySelector(`[data-testid="calendar-year-head-${year}"]`);
        if (cell === null || head === null) return null;
        const target = 12;
        window.scrollTo({
          top: window.scrollY + (cell.getBoundingClientRect().top - target),
          left: 0,
          behavior: 'instant',
        });
        const h = head.getBoundingClientRect();
        return {
          scrollY: window.scrollY,
          cellTop: cell.getBoundingClientRect().top,
          headTop: h.top,
          headBottom: h.bottom,
          headHeight: (head as HTMLElement).offsetHeight,
        };
      },
      { date: MONDAY, year: YEAR },
    );
    expect(parked).not.toBeNull();

    // Guards on the SETUP, not the behaviour. Each one exists because the
    // assertion below would otherwise pass for the wrong reason:
    //   - the head is STUCK (its top is the sticky's 0px), so it really is
    //     overlaying the grid rather than sitting above it by coincidence;
    //   - the cell really is BEHIND the head, so there is something to clear;
    //   - the cell really is ON SCREEN (top at or below the viewport top), so the
    //     browser's own `focus()` will not scroll it and the correction is the
    //     only thing that can move it. This is the case 04-11 could not reach.
    expect(Math.abs(parked!.headTop)).toBeLessThanOrEqual(1);
    expect(parked!.cellTop).toBeLessThan(parked!.headBottom);
    expect(parked!.cellTop).toBeGreaterThanOrEqual(0);
    headHeights.push(parked!.headHeight);

    await page.keyboard.press('ArrowUp');
    await expect.poll(() => activeDate(page)).toBe(MONDAY);

    const after = await page.evaluate(
      ({ date, year }) => {
        const cell = document.querySelector(`[data-testid="calendar-cell"][data-date="${date}"]`);
        const head = document.querySelector(`[data-testid="calendar-year-head-${year}"]`);
        if (cell === null || head === null) return null;
        return {
          scrollY: window.scrollY,
          cellTop: cell.getBoundingClientRect().top,
          headBottom: head.getBoundingClientRect().bottom,
        };
      },
      { date: MONDAY, year: YEAR },
    );
    expect(after).not.toBeNull();

    // The claim. No tolerance: the cell is either clear of the head or it is
    // not, and the clearance the correction promises is 8px, so anything
    // inside the head's own height is a failure by a visible amount.
    expect(after!.cellTop, `the cell is still under the head at ${width}px`).toBeGreaterThanOrEqual(
      after!.headBottom,
    );
    // And the page moved UP, which is the only way content can move down. With
    // the old sign the page scrolled down by the same amount and the cell
    // ended 37px further under the head.
    expect(after!.scrollY, `the page did not scroll up at ${width}px`).toBeLessThan(
      parked!.scrollY,
    );
  }

  // What makes the test sensitive to a hard-coded 32: the head it cleared
  // against is TALLER than its declared 32px minimum at both widths (4px of
  // padding, a 1px rule and a 19.6px line make it 41px). A correction that used
  // 32 instead of the measured height clears 32 + 8 and leaves the cell about 9px
  // under the head, which the assertion above catches, and which is recorded in
  // 04-17-SUMMARY as a mutation check rather than assumed.
  //
  // The old claim that the head is TALLER at 375px than at 1280px no longer
  // holds: in the master-detail shell the detail pane is 343px wide at 375px (it
  // was a 293px card), so the 2022 summary (about 328px with the year) fits on
  // one line at both widths. The head only wraps where the pane is narrower, so
  // the width-to-width inequality is not asserted; the measured-exceeds-declared
  // claim is the one the correction depends on.
  for (const height of headHeights) expect(height).toBeGreaterThan(32);
  expect(headHeights[0]).toBeGreaterThanOrEqual(headHeights[1]!);

  // ---------------------------------------------------------------------
  // The hour grid half: no year head above it and no sticky chrome over the
  // content, so the correction keeps the cell 8px clear of the viewport top and
  // nothing else.
  // ---------------------------------------------------------------------
  await setWidth(page, 1280);
  await page.getByTestId('hour-chart').scrollIntoViewIfNeeded();
  // Index is weekday * 24 + hour: 36 is Tuesday 12:00, 12 is Monday 12:00.
  await page.locator('[data-testid="hour-cell"][data-index="36"]').focus();

  const parkedHour = await page.evaluate(() => {
    const cell = document.querySelector('[data-testid="hour-cell"][data-index="12"]');
    if (cell === null) return null;
    // The hour grid sits near the end of the page, so the page cannot scroll far
    // enough to put its top row 2px from the viewport top (the old test only had
    // to reach the nav's bottom, 58px down). Extend the scrollable height with
    // test-only space below the content; it changes no layout above the cell.
    document.body.style.paddingBottom = '1200px';
    const target = 2;
    window.scrollTo({
      top: window.scrollY + (cell.getBoundingClientRect().top - target),
      left: 0,
      behavior: 'instant',
    });
    return {
      scrollY: window.scrollY,
      cellTop: cell.getBoundingClientRect().top,
    };
  });
  expect(parkedHour).not.toBeNull();
  // The setup guards: the cell is on screen (the browser's own focus will not
  // scroll it) and inside the 8px clearance line, so the correction has work to do.
  expect(parkedHour!.cellTop).toBeGreaterThanOrEqual(0);
  expect(parkedHour!.cellTop).toBeLessThan(7.5);

  await page.keyboard.press('ArrowUp');
  await expect.poll(() => activeIndex(page)).toBe('12');

  const afterHour = await page.evaluate(() => {
    const cell = document.querySelector('[data-testid="hour-cell"][data-index="12"]');
    if (cell === null) return null;
    return { cellTop: cell.getBoundingClientRect().top };
  });
  expect(afterHour).not.toBeNull();
  // 8px of clearance, asserted at 7.5 because the cell's own box is fractional
  // and lands a sub-pixel either way.
  expect(afterHour!.cellTop).toBeGreaterThanOrEqual(7.5);
});

// -----------------------------------------------------------------------------
// G-04-UI-2: the tile value breaks inside its own parts
// -----------------------------------------------------------------------------
//
// The hours tile's dd is a flex ROW of a Display numeral and a Label unit, and
// it carried `overflow-wrap: anywhere`. That rule was inherited from the
// UI-SPEC's blanket sentence about children that hold UNTRUSTED text, and a
// formatted number is not untrusted text. At 375px two tiles share the 293px
// card, so a tile's inner width is 104.5px while "2,467", a 4px gap and "hours"
// need 118.9px; with anywhere a flex item's minimum width is ONE CHARACTER, so
// both parts shrank instead of the unit dropping to a second line and the
// headline figure rendered as "2,46 / 7" over "hour / s".
//
// The measurement below is GEOMETRY — how many line boxes each value's contents
// occupy — and not a computed style, because a style assertion passing says
// nothing about what a reader sees: the old rule declared exactly the property
// a style assertion would have checked.

test('G-04-UI-2: at 375px the hours tile keeps its numeral and its unit whole', async ({
  page,
}) => {
  await withScaleFixture(page);
  const tiles = page.getByTestId('playtime-tiles');

  // 375 FIRST. A mid-word break only exists where the tile is narrow, so a
  // regression is reported at the width it appears at rather than at the width
  // where everything already fit.
  for (const width of [375, 1280] as const) {
    await setWidth(page, width);
    await tiles.scrollIntoViewIfNeeded();

    // ONE evaluation over the three dd elements, because each width needs all
    // three and round-tripping six boxes through the protocol would turn a
    // layout assertion into a timing one.
    const measured = await tiles.evaluate((root) => {
      // The distinct rounded tops among the client rects of a range over an
      // element's contents: one per line box the text occupies.
      const lineCount = (el: Element): number => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const tops = new Set<number>();
        for (const rect of range.getClientRects()) {
          if (rect.width > 0 && rect.height > 0) tops.add(Math.round(rect.top));
        }
        return tops.size;
      };
      return Array.from(root.querySelectorAll('dd')).map((dd) => {
        // The hours tile splits its value into a numeral and a unit; the other
        // two are a single text node in the dd itself.
        const number = dd.querySelector('.number') ?? dd;
        const unit = dd.querySelector('.unit');
        return {
          testId: dd.getAttribute('data-testid') ?? '',
          numberText: (number.textContent ?? '').trim(),
          numberLines: lineCount(number),
          unitText: unit === null ? '' : (unit.textContent ?? '').trim(),
          unitLines: unit === null ? 0 : lineCount(unit),
          fontSize: getComputedStyle(number).fontSize,
          scrollWidth: dd.scrollWidth,
          clientWidth: dd.clientWidth,
          height: dd.getBoundingClientRect().height,
        };
      });
    });

    expect(measured).toHaveLength(3);
    const hours = measured.find((tile) => tile.testId === 'playtime-total-hours');
    expect(hours, `the hours tile at ${width}px`).toBeDefined();

    // The precondition guard. A total without a thousands separator is short
    // enough to sit beside its unit, so on that number this test would pass
    // against the very stylesheet it was filed against — the nine-row hand
    // fixture never reaches four digits, which is why this spec imports the
    // 5,000-session export.
    expect(hours!.numberText, `the hours numeral at ${width}px`).toContain(',');

    for (const tile of measured) {
      expect(tile.numberLines, `${tile.testId} numeral lines at ${width}px`).toBe(1);
      // The UI-SPEC numeral sizes (R10, D-08): 26px on desktop, 18px at 375px.
      // The computed value, since the claim is what the reader sees.
      expect(tile.fontSize, `${tile.testId} numeral size at ${width}px`).toBe(
        width === 375 ? '18px' : '26px',
      );
      // And the dd is not a scroller holding its own overflow either: an
      // unbreakable numeral that does not fit would be clipped rather than
      // read wrong, and the page-overflow check is the outer backstop.
      expect(
        tile.scrollWidth,
        `${tile.testId} overflows its own width at ${width}px`,
      ).toBeLessThanOrEqual(tile.clientWidth + 0.5);
    }

    // The unit is one whole word, and it is the PLURAL: "hour" alone would mean
    // the tile is rendering a different figure, and `formatHours`'s unit rule
    // is not what this test is about.
    expect(hours!.unitText, `the hours unit at ${width}px`).toBe('hours');
    expect(hours!.unitLines, `the hours unit lines at ${width}px`).toBe(1);

    if (width === 1280) {
      // At 1280 the pair still shares one line, and this is the assertion that
      // says so: one 26px Display line at 1.3 measures about 34px, so a dd
      // under 40px cannot be holding two line boxes. It is also the half that
      // passed BEFORE the fix, which is what makes the 375 half meaningful —
      // the change is a fix at one width and nothing at the other.
      expect(hours!.height, `the hours dd is on two lines at ${width}px`).toBeLessThan(40);
    }
  }
});

// -----------------------------------------------------------------------------
// G-04-UI-3, legend clause: the note runs on from "More"
// -----------------------------------------------------------------------------
//
// Both heatmaps share ChartLegend: a wrapping flex row of the word Less, one
// swatch per level, the word More and the boundary note. The weekday-by-hour
// note is short enough to sit beside More, so at 1280px it read as one run-on
// line ("Less [swatches] More Shades rank the busiest hours of the week."),
// and the calendar's longer note was on its own line only because it did not
// FIT beside More — by accident, with the same 4px gap above it.

test('G-04-UI-3: the legend note sits on its own line, 8px under the swatch row, in both legends at both widths', async ({
  page,
}) => {
  await withScaleFixture(page);

  // 375 FIRST, for the same reason the tile test runs it first: the width that
  // shows a defect is the width that reports it.
  for (const width of [375, 1280] as const) {
    for (const testId of ['hour-legend', 'calendar-legend'] as const) {
      const legend = page.getByTestId(testId);
      await setWidth(page, width);
      await legend.scrollIntoViewIfNeeded();

      const read = await legend.evaluate((root) => {
        // The note is the last child, and "More" is the second `.word` — Less
        // first, the swatches between them, by the component's own markup.
        const words = Array.from(root.querySelectorAll('.word'));
        const more = words[1];
        const note = root.querySelector('.note');
        if (more === undefined || note === null) return null;
        const legendBox = root.getBoundingClientRect();
        const moreBox = more.getBoundingClientRect();
        const noteBox = note.getBoundingClientRect();
        return {
          more: (more.textContent ?? '').trim(),
          moreBottom: moreBox.bottom,
          noteText: (note.textContent ?? '').trim(),
          noteTop: noteBox.top,
          noteLeft: noteBox.left,
          legendLeft: legendBox.left,
        };
      });
      expect(read, `${testId} at ${width}px has no More word or note`).not.toBeNull();
      expect(read!.more).toBe('More');

      // The claim, in the page's own coordinates: the note STARTS a line below
      // the word it used to run on from. 7.5 and 0.5 absorb fractional line
      // heights and sub-pixel layout, not a tolerance for a shared line — the
      // 4px gap this was filed for is 3.5px short of 7.5.
      expect(
        read!.noteTop,
        `${testId} note starts ${(read!.noteTop - read!.moreBottom).toFixed(2)}px under More at ${width}px`,
      ).toBeGreaterThanOrEqual(read!.moreBottom + 7.5);
      // And on that line it is left-aligned with the legend, not indented under
      // the swatches — a note in the second flex column reads as belonging to
      // the swatch beside it.
      expect(
        Math.abs(read!.noteLeft - read!.legendLeft),
        `${testId} note is not aligned with the legend at ${width}px`,
      ).toBeLessThanOrEqual(0.5);
      // The note keeps its text (D-04 states the scale's boundary as text); a
      // rule that hid or truncated it would pass the two assertions above.
      expect(read!.noteText.length, `${testId} note text at ${width}px`).toBeGreaterThan(0);
    }
  }
});
