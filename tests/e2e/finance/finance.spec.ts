import '../_support/pin-locale';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  SYNTHETIC_ZIP_NAME,
  currencyBlock,
  financialSection,
  gotoApp,
  importExport,
  premiumBlock,
  replaceExport,
} from '../_support/helpers.ts';
import { buildCustomExport, buildSampleExport } from '../../fixtures/export-fixtures.ts';
import {
  CURRENCY_HAND_CSV,
  CURRENCY_20Y_SPEC,
  CURRENCY_HAND_EXPECTED,
  CURRENCY_INCOME_ONLY_EXPECTED,
  CURRENCY_INCOME_ONLY_ROWS,
  CURRENCY_OPS_HEADER,
  CURRENCY_STRAY_YEAR_SPEC,
  FINANCE_CANARIES,
  generateCurrencyOpsCsv,
  PREMIUM_HAND_EXPECTED,
  PREMIUM_HEADER,
  PREMIUM_REAL_SHAPE_EXPECTED,
  PREMIUM_REAL_SHAPE_ROWS,
  premiumRow,
  renderQuoteAllCsv,
} from '../../fixtures/finance-fixtures.ts';
import { oracleCurrency } from '../../helpers/finance-oracle';
import { MAX_LISTED_UNRECOGNISED } from '../../../src/lib/features/finance/finance-shared.ts';
import {
  CURRENCY_BLANK_CODE,
  CURRENCY_BLOCK_CAPTION,
  CURRENCY_EXCLUDED_EXPLANATION,
  CURRENCY_NO_USABLE,
  CURRENCY_TABLE_HEADERS,
  FINANCIAL_CURRENCY_HEADING,
  FINANCIAL_LOADING,
  FINANCIAL_NOT_IN_EXPORT,
  FINANCIAL_PREMIUM_HEADING,
  FLOW_LEGEND_DEPOSITED,
  FLOW_LEGEND_WITHDRAWN,
  MONTHLY_TABLE_DISCLOSURE,
  PREMIUM_EXCLUDED_EXPLANATION,
  SECTION_NOTE_PENDING,
  formatCurrencySummary,
  formatCompactNumber,
  formatFinancialNoRows,
  formatFlowAmount,
  formatOperationExcludedPill,
  formatOtherCurrencyRow,
  formatPremiumExcludedPill,
  formatPremiumSummary,
  formatPremiumUnrecognisedDisclosure,
  formatUnrecognisedOverflow,
} from '../../../src/lib/ui-copy.ts';

// =============================================================================
// Phase 05, plan 05-10 — the Premium time SUB-BLOCK, in a real browser
// =============================================================================
//
// WHY A BROWSER SPEC AND NOT A UNIT TEST
// `tests/unit/finance/finance-state.test.ts` already proves which state is on screen and
// which figures produce the sentence. What it cannot prove is that the block
// ASKS, that the worker answers, and that the six branches reach the screen —
// which exist only once a component renders. Vitest has no DOM, so the
// instrument has to be a browser.
//
// WHY THE EXPECTED SENTENCE IS COMPUTED IN NODE
// From the 05-01 hand fixture, through the same `ui-copy` formatter the
// component uses, and never by reading a value out of the page. A spec that
// scraped the sentence and compared it with itself would pass against a block
// that renders a fixed string. `pin-locale` is imported for the same reason
// `playtime.spec.ts` does: Node's number grouping must match the browser's.
//
// WHY THESE SPECS EXIST RATHER THAN BEING FOLDS IN
// Two of the three claims below are about states a reader reaches by EXPORTING
// something different, and the third is about the sentence itself. A sub-block
// that only ever renders the happy path has its `not-in-export` and `no-rows`
// branches tested by nothing, and those are the two that are easy to get
// backwards.
//
// THE TEST BUDGET
// CI runs one Playwright worker and every import costs a full unzip, parse and
// ingest, so the sample's assertions share ONE import through the serial
// describe below rather than paying for it per test. The two-state test needs
// two exports by nature, and the no-folder test needs its own page because it
// asserts on a card that is not `ready`.
//
// Decisions: D-01 (the two files keep two sub-blocks), D-02 (each sub-block
// states its own), D-19 (the summary sentence), D-28 (a replaced dataset's
// answer is never applied), DATA-04 (absent is not empty).
// =============================================================================

/**
 * The axis length, read from the fixture's own `axisMonths` rather than from
 * `months.length`.
 *
 * The two differ by exactly the April 2019 gap, and using the wrong one would
 * produce "4 of 4 months" for an export that granted nothing in April. The
 * literal cross-check in the tracer test below is what would catch it.
 *
 * Declared BEFORE {@link EXPECTED_SENTENCE}, because that expectation is built
 * at module load and a constant read one line later would still be in its
 * temporal dead zone there.
 */
const PREMIUM_HAND_EXPENDED_AXIS_MONTHS = PREMIUM_HAND_EXPECTED.axisMonths.length;

/**
 * The expected summary sentence, computed from the hand fixture.
 *
 * `PREMIUM_HAND_EXPECTED` is the 05-01 answer key, derived by arithmetic from
 * the eighteen premium rows and independently recomputed by
 * `tests/helpers/finance-oracle.ts`. Reading the six figures from it is what
 * makes this an expectation rather than a transcript.
 *
 * The peak is reduced from the fixture's own months with the SAME rule
 * `premiumFigures` uses — strictly greater, so a tie takes the earlier month —
 * because the fixture states no peak: it is a figure the sentence needs and
 * neither the view nor the workers compute it.
 */
const EXPECTED_SENTENCE = formatPremiumSummary(
  (() => {
    const peak = PREMIUM_HAND_EXPECTED.months.reduce((best, month) =>
      month.seconds > best.seconds ? month : best,
    );
    return {
      monthsWithGrants: PREMIUM_HAND_EXPECTED.months.length,
      spanMonths: PREMIUM_HAND_EXPENDED_AXIS_MONTHS,
      totalSeconds: PREMIUM_HAND_EXPECTED.totalSeconds,
      grants: PREMIUM_HAND_EXPECTED.grants,
      peakMonth: peak.month,
      peakSeconds: peak.seconds,
    };
  })(),
  'en-US',
);

/** A premium file with its header and no rows, in the export's own format. */
const HEADER_ONLY_PREMIUM = renderQuoteAllCsv(PREMIUM_HEADER, []);

// -----------------------------------------------------------------------------
// The sample export: one import, several claims
// -----------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' });

test.describe('05-10 premium time: the sample export', () => {
  let context: BrowserContext;
  let page: Page;

  // The import lives HERE rather than in `beforeEach` because every assertion
  // below reads the same imported dataset, and the card is identical across
  // them. One unzip instead of three.
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('(tracer) the card is ready and the block renders the fixture sentence', async () => {
    // The cross-checks come first, and they are literals on purpose: if the
    // fixture's own answer key were wrong, every expectation below would be
    // wrong in the same direction and the suite would pass. 4 busy months of a
    // 5-month axis (April 2019 granted nothing), 18 rows of which 11 were
    // usable, totalling 4,579,200 s — 53 days.
    expect(PREMIUM_HAND_EXPECTED.months.length).toBe(4);
    expect(PREMIUM_HAND_EXPENDED_AXIS_MONTHS).toBe(5);
    expect(PREMIUM_HAND_EXPECTED.grants).toBe(11);
    expect(PREMIUM_HAND_EXPECTED.totalSeconds).toBe(4_579_200);
    expect(EXPECTED_SENTENCE).toBe(
      'Premium time was granted in 4 of 5 months: 53 days in total across 11 operations. ' +
        'The largest month was 2019-05 with 31.5 days.',
    );

    // The card and the block are two different claims. The card is `ready`
    // because the export was imported; the block is `ready` because the worker
    // has answered. A spec that asserted only the card would pass before any
    // premium number existed.
    await expect(financialSection(page)).toHaveAttribute('data-status', 'ready');
    await expect(premiumBlock(page)).toHaveAttribute('data-state', 'ready');

    // `loading` is a real state and a TRANSIENT one, so the spec that pins the
    // numbers must also prove the block is not parked in it. Asserting the
    // sentence alone would pass on a page still computing.
    await expect(premiumBlock(page)).not.toContainText(FINANCIAL_LOADING);
    await expect(premiumBlock(page)).toHaveAttribute('aria-busy', 'false');

    // The sub-heading is the block's own label, from the Phase 5 inventory.
    await expect(premiumBlock(page).locator('h3')).toHaveText(FINANCIAL_PREMIUM_HEADING);
    await expect(page.getByTestId('premium-summary')).toHaveText(EXPECTED_SENTENCE);
  });

  test('(excluded) the sample shows the pill and the two strings that were not charted', async () => {
    // The cross-check, again as a literal: 7 of the 18 premium rows were dropped
    // and exactly two of them carried a string worth naming. The fixture states
    // no overflow figure — the hand export's seven exclusions list two strings
    // and hold nothing back, so the absence of an overflow LINE below is the
    // assertion rather than a number to compare.
    expect(PREMIUM_HAND_EXPECTED.excluded).toBe(7);
    expect(PREMIUM_HAND_EXPECTED.unrecognised).toHaveLength(2);
    expect(formatPremiumExcludedPill(PREMIUM_HAND_EXPECTED.excluded, 'en-US')).toBe(
      '7 premium rows excluded',
    );

    // The pill is the SHARED notice, so the hook is the premium one and the
    // words are the premium ones — the same amber chrome the playtime block has
    // used since 04-02, reached through the generalised props.
    const pill = page.getByTestId('premium-excluded');
    await expect(pill).toHaveCount(1);
    await expect(pill).toContainText('7 premium rows excluded');
    await expect(pill).toContainText(PREMIUM_EXCLUDED_EXPLANATION);

    // The disclosure's heading counts the export's own distinct strings, and
    // the two listed are compared SORTED: the worker's list order is count
    // descending then code units, not file order, and `PREMIUM_HAND_EXPECTED`
    // stores them as the rows appear in the CSV. The disclosure's order is
    // 05-04's documented rule and is pinned by `finance.test.ts`; what this
    // asserts is that the SCREEN names both, which is D-20's claim.
    const disclosure = page.getByTestId('premium-unrecognised');
    await expect(disclosure).toHaveCount(1);
    await expect(disclosure.locator('summary')).toHaveText(
      formatPremiumUnrecognisedDisclosure(PREMIUM_HAND_EXPECTED.unrecognised.length),
    );
    const listed = await disclosure.locator('li').allTextContents();
    expect(listed.sort()).toEqual([...PREMIUM_HAND_EXPECTED.unrecognised].sort());
    // Two strings and nothing else: no overflow line, because nothing was held
    // back. A reader who sees "and N more" for a two-string list is being told
    // the list is partial when it is complete.
    await expect(disclosure.locator('li.overflow')).toHaveCount(0);

    // Plain TEXT, and text that is really in the document. The values came out
    // of an export the user opened, so they are rendered by interpolation and
    // never as markup: if a string ever reached an attribute a selector reads
    // back, the paragraph's own text would not be the string itself.
    await expect(disclosure).toHaveText(/premium forever/);
    await expect(disclosure).toHaveText(/withdrawal WOT premium_plus 86400 sec/);
    // The native control is closed until it is opened, so the values are not
    // announced as a wall of text on load.
    await expect(disclosure.locator('ul')).toBeHidden();
  });

  test('(chart) the premium chart draws one cell per month with the hand-derived heights', async () => {
    const chart = page.getByTestId('premium-chart');
    await expect(chart).toHaveCount(1);
    await expect(chart).toHaveAttribute('width', '140');
    await expect(chart).toHaveAttribute('height', '128');

    const cells = chart.locator('[role="gridcell"]');
    await expect(cells).toHaveCount(5);

    const marchBar = chart.locator('[data-month="24230"]');
    const mayBar = chart.locator('[data-month="24232"]');
    const juneBar = chart.locator('[data-month="24233"]');
    const julyBar = chart.locator('[data-month="24234"]');
    const aprilBar = chart.locator('[data-month="24231"]');

    await expect(marchBar).toHaveAttribute('height', '15');
    await expect(mayBar).toHaveAttribute('height', '96');
    await expect(juneBar).toHaveAttribute('height', '8');
    await expect(julyBar).toHaveAttribute('height', '43');
    await expect(aprilBar).toHaveCount(0);

    const aprilCell = cells.nth(1);
    await expect(aprilCell).toHaveAttribute('data-days', '0');
    await expect(aprilCell).toHaveAttribute('aria-label', '2019-04: no premium granted');

    let sumDays = 0;
    let sumGrants = 0;
    for (let i = 0; i < 5; i++) {
      const cell = cells.nth(i);
      const days = Number(await cell.getAttribute('data-days'));
      const grants = Number(await cell.getAttribute('data-grants'));
      sumDays += days;
      sumGrants += grants;
    }
    expect(sumDays).toBe(53);
    expect(sumGrants).toBe(11);

    const nodeCount = await chart.locator('*').count();
    expect(nodeCount).toBeLessThanOrEqual(55);
  });

  test('(hover) a month shows the finance tooltip and its ring', async () => {
    const chart = page.getByTestId('premium-chart');
    const tooltip = page.getByTestId('finance-tooltip');
    const hoverRing = page.getByTestId('bar-hover-ring');

    const marchCell = chart.locator('[role="gridcell"]').nth(0);
    await marchCell.hover();

    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('2019-03');
    await expect(hoverRing).toBeVisible();

    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();
    await expect(hoverRing).toBeHidden();
  });

  test('(keyboard) one tab stop and the documented keys', async () => {
    const chart = page.getByTestId('premium-chart');
    const tooltip = page.getByTestId('finance-tooltip');
    const focusRing = page.getByTestId('bar-focus-ring');
    const cells = chart.locator('[role="gridcell"]');

    await cells.nth(4).focus();
    await page.keyboard.press('ArrowLeft');

    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('2019-06');
    await expect(focusRing).toBeVisible();

    await page.keyboard.press('Home');
    await expect(tooltip).toContainText('2019-03');

    await page.keyboard.press('End');
    await expect(tooltip).toContainText('2019-07');

    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();

    const tabStopCount = await chart.locator('[role="gridcell"][tabindex="0"]').count();
    expect(tabStopCount).toBe(1);
  });

  test('(sizes) the July tooltip lists three sizes and one more', async () => {
    const chart = page.getByTestId('premium-chart');
    const tooltip = page.getByTestId('finance-tooltip');
    const julyCell = chart.locator('[role="gridcell"]').nth(4);
    await julyCell.hover();

    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('2019-07');
    await expect(tooltip).toContainText('+1 more sizes');

    const aprilCell = chart.locator('[role="gridcell"]').nth(1);
    await aprilCell.hover();
    await expect(tooltip).toContainText('No premium granted');
    await expect(tooltip).toContainText('Dates as recorded in the export');
  });

  test('(clip) the first and last month keep the tooltip inside the viewport', async () => {
    const chart = page.getByTestId('premium-chart');
    const tooltip = page.getByTestId('finance-tooltip');

    await chart.locator('[role="gridcell"]').nth(0).hover();
    await expect(tooltip).toBeVisible();
    let box = await tooltip.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(8);
      const viewport = page.viewportSize();
      if (viewport) {
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 8);
      }
    }

    await chart.locator('[role="gridcell"]').nth(4).hover();
    await expect(tooltip).toBeVisible();
    box = await tooltip.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(8);
      const viewport = page.viewportSize();
      if (viewport) {
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 8);
      }
    }
  });

  test('(table) closed by default, five rows newest first when open, summing to the summary', async () => {
    // Scoped to the premium BLOCK, not the page: from 05-13 the currency
    // charts carry the same disclosure hook, and an unscoped `monthly-table`
    // assertion would be satisfied by the wrong block's table the moment one
    // of them was open.
    const disclosure = premiumBlock(page).getByTestId('monthly-table-disclosure');
    await expect(disclosure).toBeVisible();

    await expect(premiumBlock(page).getByTestId('monthly-table')).toHaveCount(0);

    await disclosure.locator('summary').click();

    const table = premiumBlock(page).getByTestId('monthly-table');
    await expect(table).toBeVisible();

    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(5);

    await expect(rows.nth(0)).toContainText('2019-07');

    await expect(rows.nth(3)).toContainText('2019-04');
    await expect(rows.nth(3)).toContainText('0 days');

    let sumDays = 0;
    for (let i = 0; i < 5; i++) {
      const text = await rows.nth(i).locator('td').nth(1).textContent();
      if (text) {
        const days = Number(text.replace(/[^0-9.]/g, ''));
        sumDays += days;
      }
    }
    expect(sumDays).toBe(53);
  });
});

test.describe('05-11 single-month premium timeline', () => {
  test('(single-month) one grant draws one cell and one axis label', async ({ page }) => {
    const singleGrantExport = buildCustomExport({
      overrides: {
        'Financial_data/Operations_with_Premium_Days.csv': renderQuoteAllCsv(PREMIUM_HEADER, [
          premiumRow('1 day', '2019-05-02 12:00:00'),
        ]),
      },
    });
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, singleGrantExport);

    const chart = page.getByTestId('premium-chart');
    await expect(chart).toBeVisible();

    const cells = chart.locator('[role="gridcell"]');
    await expect(cells).toHaveCount(1);

    const xLabels = chart.locator('text.x-axis');
    await expect(xLabels).toHaveCount(1);
    await expect(xLabels).toHaveText('2019-05');
  });
});

// -----------------------------------------------------------------------------
// 05-18 / UAT G-05-3: a premium file with the REAL export's column semantics
// -----------------------------------------------------------------------------

/**
 * The summary sentence for the real-shaped set, read from the fixture's own
 * answer key rather than typed out.
 *
 * `PREMIUM_REAL_SHAPE_EXPECTED` states months, seconds and grants by hand and is
 * recomputed by the independent oracle, so this is an expectation and not a
 * transcript. The peak is reduced with the same strictly-greater rule
 * `premiumFigures` uses, because the key states no peak.
 */
const REAL_SHAPE_SENTENCE = formatPremiumSummary(
  (() => {
    const peak = PREMIUM_REAL_SHAPE_EXPECTED.months.reduce((best, month) =>
      month.seconds > best.seconds ? month : best,
    );
    return {
      monthsWithGrants: PREMIUM_REAL_SHAPE_EXPECTED.months.length,
      spanMonths: PREMIUM_REAL_SHAPE_EXPECTED.axisMonths.length,
      totalSeconds: PREMIUM_REAL_SHAPE_EXPECTED.totalSeconds,
      grants: PREMIUM_REAL_SHAPE_EXPECTED.grants,
      peakMonth: peak.month,
      peakSeconds: peak.seconds,
    };
  })(),
  'en-US',
);

test.describe('05-18 premium time: the real export dates each grant by CURR_PREMIUM', () => {
  test('(real-shape) four months of grant dates, and never the bulk stamp month', async ({
    page,
  }) => {
    // The bug this closes was invisible to every other spec because every
    // fixture dated its own rows in CREATED. Here `CREATED` and `UPDATED` are
    // the invented bulk-migration stamp shared by all seven rows, so a builder
    // still reading CREATED would draw ONE bar — at month 24,197 — instead of
    // the four months below.
    const realShapeExport = buildCustomExport({
      overrides: {
        'Financial_data/Operations_with_Premium_Days.csv': renderQuoteAllCsv(
          PREMIUM_HEADER,
          PREMIUM_REAL_SHAPE_ROWS,
        ),
      },
    });
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, realShapeExport);

    await expect(premiumBlock(page)).toHaveAttribute('data-state', 'ready');

    const summary = page.getByTestId('premium-summary');
    await expect(summary).toHaveText(REAL_SHAPE_SENTENCE);
    // The cross-check as a literal, so a copy change and a figure change cannot
    // quietly agree with each other: the sentence is checked against what a
    // reader would see AND against the app's own formatter.
    await expect(summary).toContainText('Premium time was granted in 4 of 4 months');
    await expect(summary).toContainText('65.3 days in total across 6 operations');
    await expect(summary).toContainText('The largest month was 2014-01 with 31 days');

    const chart = page.getByTestId('premium-chart');
    await expect(chart).toBeVisible();
    // Four drawn months, all of them carrying a grant — which is what lets each
    // one be asserted as a bar rather than as a cell.
    await expect(chart.locator('[role="gridcell"]')).toHaveCount(4);
    for (const month of [24_167, 24_168, 24_169, 24_170]) {
      await expect(chart.locator(`[data-month="${month}"]`)).toHaveCount(1);
    }
    // THE assertion: the bulk stamp's month. Dating this file by CREATED would
    // draw exactly one bar, here, and nothing above would exist.
    await expect(chart.locator('[data-month="24197"]')).toHaveCount(0);

    // One zero-second removal: counted in the pill, and listed with its text
    // trimmed, because a withdrawal is excluded rather than silently dropped.
    // The pill also carries its shared explanation sentence, so the figure is
    // matched inside it rather than as the element's whole text.
    await expect(page.getByTestId('premium-excluded')).toContainText(
      formatPremiumExcludedPill(1, 'en-US'),
    );
    await expect(page.getByTestId('premium-unrecognised')).toContainText(
      'withdrawal WOT premium_plus 0 sec',
    );
  });
});

// -----------------------------------------------------------------------------
// The two empty states, which are NOT the same state (DATA-04, D-02)
// -----------------------------------------------------------------------------

test.describe('05-10 premium time: a file that is absent and a file with no rows', () => {
  test('(states) reads two different sentences, and the replace moves between them', async ({
    page,
  }) => {
    // First: a Financial_data folder that holds ONLY the currency file. The
    // section is `ready` — the currency file has rows — while the premium
    // sub-block is `not-in-export`, which is D-02's claim: the two files
    // decide their own states and the card's readiness is not either of them.
    //
    // `gotoApp` here rather than in a `beforeEach`, because this test opens the
    // app once and then REPLACES into the same dataset — the replace is half of
    // what is being asserted, so it has to happen on the page the first import
    // put on screen.
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildAbsentPremiumFileExport());

    await expect(financialSection(page)).toHaveAttribute('data-status', 'ready');
    await expect(premiumBlock(page)).toHaveAttribute('data-state', 'not-in-export');
    await expect(premiumBlock(page)).toContainText(FINANCIAL_NOT_IN_EXPORT);
    // DATA-04, asserted from both sides: absent must not borrow the empty
    // wording, or the reader cannot tell "not exported" from "nothing granted".
    await expect(premiumBlock(page)).not.toContainText(formatFinancialNoRows('premium'));
    await expect(page.getByTestId('premium-summary')).toHaveCount(0);

    // Then a REPLACE with a premium file that has its header and no rows. This
    // is the load-bearing half of the test: D-28 says an answer computed for a
    // replaced dataset is never applied, so if the block held its previous
    // `not-in-export` state across the replace it would still be showing
    // `FINANCIAL_NOT_IN_EXPORT` here and `toContainText` would pass on the
    // stale value. The exact-text assertion below is what distinguishes the
    // two sentences.
    await replaceExport(page, SYNTHETIC_ZIP_NAME, buildHeaderOnlyPremiumExport());

    await expect(financialSection(page)).toHaveAttribute('data-status', 'ready');
    await expect(premiumBlock(page)).toHaveAttribute('data-state', 'no-rows');
    await expect(premiumBlock(page).locator('p.body')).toHaveText(formatFinancialNoRows('premium'));
    await expect(premiumBlock(page)).not.toContainText(FINANCIAL_NOT_IN_EXPORT);
  });
});

// -----------------------------------------------------------------------------
// The two counts that are easy to get wrong: a truncated list, and a row
// excluded for a reason that has no string to show
// -----------------------------------------------------------------------------

/** How many distinct junk strings the overflow export carries. */
const JUNK_STRING_COUNT = 25;

/**
 * Twenty-five DISTINCT premium values, zero-padded so the fixture's documented
 * tie-break (equal counts order by code units) is also the natural row order —
 * which means the listed twenty are `junk-premium-01` through
 * `junk-premium-20` and the held-back five are the rest.
 *
 * Every row is built by `premiumRow`, so the date is the row's GRANT date in
 * `CURR_PREMIUM` and both `CREATED` and `UPDATED` carry the shared bulk stamp —
 * the real export's shape (UAT G-05-3). Every grant date is readable, so each
 * row is excluded for its VALUE rather than for its date, which is the case the
 * disclosure exists for.
 */
const JUNK_ROWS: readonly (readonly string[])[] = Array.from(
  { length: JUNK_STRING_COUNT },
  (_unused, index) => {
    const day = String(index + 1).padStart(2, '0');
    return premiumRow(`junk-premium-${day}`, `2019-06-${day} 00:00:00`);
  },
);

/**
 * One usable grant plus three rows whose GRANT DATES are impossible.
 *
 * Every one of the three is a real day number on a month that does not have it —
 * 31 April, 31 June and 30 February — and `PREMIUM` is a perfectly good `1 day`
 * in all three. That is the point: the row is dropped for a reason that has no
 * string to disclose. The bad values sit in `CURR_PREMIUM`, which is the column
 * the file is dated by, and the bulk stamp in `CREATED` is deliberately NOT a
 * usable fallback for them — if it were, these rows would be charted on the
 * migration month instead of counted (D-20).
 *
 * The dates were originally 31 April, 31 June and 31 JULY, and the third was
 * charted: July has 31 days. The spec caught that by expecting three exclusions
 * and being given two, which is the claim working — an impossible date has to
 * be impossible, not merely unusual.
 */
const DATE_EXCLUDED_ROWS: readonly (readonly string[])[] = [
  premiumRow('1 day', '2019-05-02 12:00:00'),
  premiumRow('1 day', '2019-04-31 10:00:00'),
  premiumRow('1 day', '2019-06-31 10:00:00'),
  premiumRow('1 day', '2019-02-30 10:00:00'),
];

test.describe('05-10 premium time: excluded rows the sample does not cover', () => {
  test('(overflow) twenty-five distinct strings list twenty and then "and 5 more"', async ({
    page,
  }) => {
    // A user who needs to know which of their rows were dropped has to be able
    // to see that the list is PARTIAL. A heading that said (20) over a list of
    // twenty would read as complete; this is the line that prevents that, and
    // the heading that counts all twenty-five.
    expect(MAX_LISTED_UNRECOGNISED).toBe(20);
    expect(JUNK_STRING_COUNT - MAX_LISTED_UNRECOGNISED).toBe(5);

    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildJunkPremiumExport());

    // Every row was excluded for its value, so the block has no months and is
    // `no-usable` — which still shows the notice, because "every row was
    // dropped" and "some rows were dropped" are the same fact at two magnitudes
    // (D-02). The pill renders here too, so the count is not lost with the
    // summary sentence.
    await expect(premiumBlock(page)).toHaveAttribute('data-state', 'no-usable');
    await expect(page.getByTestId('premium-excluded')).toContainText(
      formatPremiumExcludedPill(JUNK_STRING_COUNT, 'en-US'),
    );

    const disclosure = page.getByTestId('premium-unrecognised');
    await expect(disclosure.locator('summary')).toHaveText(
      formatPremiumUnrecognisedDisclosure(JUNK_STRING_COUNT),
    );
    // Exactly twenty values, then the overflow line — twenty-one items in all,
    // and the twenty-first is not a value.
    const items = disclosure.locator('li');
    await expect(items).toHaveCount(MAX_LISTED_UNRECOGNISED + 1);
    await expect(disclosure.locator('li.overflow')).toHaveText(
      formatUnrecognisedOverflow(JUNK_STRING_COUNT - MAX_LISTED_UNRECOGNISED),
    );
    const values = await items.allTextContents();
    expect(values[0]).toBe('junk-premium-01');
    expect(values[MAX_LISTED_UNRECOGNISED - 1]).toBe('junk-premium-20');
    // The held-back five are the tail, and they are NOT in the list.
    expect(values).not.toContain('junk-premium-25');
  });

  test('(date-only) rows excluded for an impossible date are counted but not listed', async ({
    page,
  }) => {
    // A row dropped for its DATE is not a row whose value could not be read, so
    // there is no string to disclose and the disclosure must not appear at all.
    // Rendering an empty one would invite a reader to wonder what the app could
    // not read when the answer is "nothing — three dates".
    expect(DATE_EXCLUDED_ROWS.length - 1).toBe(3);

    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildDateExcludedPremiumExport());

    // The usable row is still charted, so the block is `ready` and the summary
    // renders: three dropped rows must not cost the reader the one month.
    await expect(premiumBlock(page)).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('premium-summary')).toHaveCount(1);

    // Counted…
    await expect(page.getByTestId('premium-excluded')).toContainText(
      formatPremiumExcludedPill(DATE_EXCLUDED_ROWS.length - 1, 'en-US'),
    );
    // …and listed as nothing at all. Not an empty `details`, not a heading with
    // a zero: absent.
    await expect(page.getByTestId('premium-unrecognised')).toHaveCount(0);
  });
});

// -----------------------------------------------------------------------------
// No folder at all: the greyed card, and no sub-block
// -----------------------------------------------------------------------------

test.describe('05-10 premium time: no Financial_data folder', () => {
  test('(no-folder) the greyed card and no premium block anywhere on the page', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(
      page,
      SYNTHETIC_ZIP_NAME,
      buildCustomExport({ omitFolders: ['Financial_data'] }),
    );

    // The card is a greyed skeleton: `no-export`, the D-10 wording, and none of
    // the note a `pending` section carries. A card that said a dashboard was
    // coming would be promising one for a section it will never have.
    await expect(financialSection(page)).toHaveAttribute('data-status', 'no-export');
    await expect(financialSection(page).getByTestId('section-status')).toHaveText(
      FINANCIAL_NOT_IN_EXPORT,
    );
    await expect(financialSection(page)).not.toContainText(SECTION_NOTE_PENDING);

    // No sub-block at all, so there is nothing to say `loading` and no way for a
    // query to fire against a file this export does not have.
    await expect(page.getByTestId('premium-block')).toHaveCount(0);
  });
});

// -----------------------------------------------------------------------------
// The exports
// -----------------------------------------------------------------------------

/**
 * `Financial_data` present with the premium file GONE and the currency file
 * left in place.
 *
 * The currency file is what keeps the section `ready`, and keeping it is the
 * point: a section that went grey because one of its two files was missing
 * would be the "a sub-block is not the card" bug this test exists to catch.
 */
function buildAbsentPremiumFileExport(): Uint8Array {
  return buildCustomExport({
    omitFolders: ['Financial_data'],
    overrides: { 'Financial_data/Virtual_Currencies_Operations.csv': CURRENCY_HAND_CSV },
  });
}

/**
 * `Financial_data` present with both files, and the premium file carrying its
 * header and no rows.
 *
 * Rendered through `renderQuoteAllCsv` with an empty row list, so the file is
 * the export's OWN header and the export's OWN bare-CR terminator — a string
 * literal would drift from the real format the first time the fixture changes.
 */
function buildHeaderOnlyPremiumExport(): Uint8Array {
  return buildCustomExport({
    overrides: { 'Financial_data/Operations_with_Premium_Days.csv': HEADER_ONLY_PREMIUM },
  });
}

/**
 * A premium file of twenty-five distinct values the app cannot read, and
 * nothing else.
 *
 * Rendered through `renderQuoteAllCsv`, so the header is the export's own and
 * the terminator is the export's own bare CR.
 */
function buildJunkPremiumExport(): Uint8Array {
  return buildCustomExport({
    overrides: {
      'Financial_data/Operations_with_Premium_Days.csv': renderQuoteAllCsv(
        PREMIUM_HEADER,
        JUNK_ROWS,
      ),
    },
  });
}

/** A premium file whose only exclusions are three impossible dates. */
function buildDateExcludedPremiumExport(): Uint8Array {
  return buildCustomExport({
    overrides: {
      'Financial_data/Operations_with_Premium_Days.csv': renderQuoteAllCsv(
        PREMIUM_HEADER,
        DATE_EXCLUDED_ROWS,
      ),
    },
  });
}

// =============================================================================
// Phase 05, plan 05-13 — the Virtual currency SUB-BLOCK, in a real browser
// =============================================================================
//
// WHY THESE CLAIMS NEED A BROWSER
// `tests/unit/finance/finance-state.test.ts` proves the month series and the exact
// domain a currency chart is built from, and `tests/unit/finance/currency-blocks.test.ts`
// proves the component's source contract. Neither can prove the thing the
// reader actually sees: that the summed `data-in`/`data-out` attributes across
// a chart's cells add up to the figures in the summary sentence sitting above
// that same chart. That claim spans the worker's answer, the model, the
// component and the DOM, so it can only be made in a browser.
//
// WHY THE EXPECTATIONS ARE BUILT IN NODE
// Every figure is read from `CURRENCY_HAND_EXPECTED` — the 05-01 hand answer
// key, derived by arithmetic from 119 rows — and put through the same
// `ui-copy` formatter the component uses. A spec that read the sentence off the
// page and compared it with itself would pass against a block rendering a fixed
// string.
//
// THE VOCABULARY HAZARD
// 05-12 had to rekey `ui-copy`'s column labels after the label layer and the
// worker's field names drifted apart. This spec therefore names the codes, the
// attributes and the order it expects, and derives every NUMBER from the
// fixture — never from a previous assertion in the same test.
//
// Decisions: D-15, D-16, D-17, D-18, D-25, D-26, D-27.
// =============================================================================

/**
 * The two charted currencies' summary sentences, built from the hand answer key.
 *
 * Credits walk thirty months from 2018-01, depositing `1,000,000 + 1,000k` and
 * withdrawing 400,000 in each; gold walks the last twenty-six of those months
 * at 250 in and 100 out. Both totals are the fixture's arithmetic, cross-checked
 * against the independent oracle in the unit file.
 */
const CURRENCY_SUMMARIES = {
  credits: formatCurrencySummary(
    {
      inUnits: 30_435_000_000_000n,
      outUnits: 12_000_000_000_000n,
      ops: 60,
      firstMonth: 24_216,
      lastMonth: 24_245,
    },
    'en-US',
  ),
  gold: formatCurrencySummary(
    {
      inUnits: 6_500_000_000n,
      outUnits: 2_600_000_000n,
      ops: 52,
      firstMonth: 24_220,
      lastMonth: 24_245,
    },
    'en-US',
  ),
} as const;

/**
 * Sum a chart's cell attributes and return the pair.
 *
 * The cells are the bars' data, not the summary's: a chart that drew a bar
 * whose height came from a different number than the sentence quotes would
 * pass every sentence assertion above and fail only here.
 */
async function sumCells(
  cells: ReturnType<Page['locator']>,
): Promise<{ deposited: number; withdrawn: number; ops: number; months: number }> {
  let deposited = 0;
  let withdrawn = 0;
  let ops = 0;
  const count = await cells.count();
  for (let i = 0; i < count; i += 1) {
    const cell = cells.nth(i);
    deposited += Number((await cell.getAttribute('data-in')) ?? '0');
    withdrawn += Number((await cell.getAttribute('data-out')) ?? '0');
    ops += Number((await cell.getAttribute('data-ops')) ?? '0');
  }
  return { deposited, withdrawn, ops, months: count };
}

// The whole file already runs in serial mode (the `describe.configure` above
// the 05-10 suites), so this one needs no configure of its own — declaring it
// again is an error, not a default.
test.describe('05-13 virtual currency: the sample export', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('(currency-tracer) the sample charts credits then gold with summed cells equal to the summaries', async () => {
    // The cross-checks come first and they are literals on purpose. If the
    // fixture's own key were wrong, every expectation below would be wrong in
    // the same direction and the suite would pass.
    expect(CURRENCY_HAND_EXPECTED.usable).toBe(119);
    expect(CURRENCY_HAND_EXPECTED.excluded).toBe(6);
    expect(CURRENCY_SUMMARIES.credits).toBe(
      'Deposited 30,435,000 and withdrew 12,000,000 across 60 operations, from 2018-01 to 2020-06.',
    );
    expect(CURRENCY_SUMMARIES.gold).toBe(
      'Deposited 6,500 and withdrew 2,600 across 52 operations, from 2018-05 to 2020-06.',
    );

    // The block is `ready` in its own right while the CARD stays ready too —
    // two different claims, and the sub-block's is the one about the answer.
    await expect(financialSection(page)).toHaveAttribute('data-status', 'ready');
    await expect(currencyBlock(page)).toHaveAttribute('data-state', 'ready');
    await expect(currencyBlock(page)).not.toContainText(FINANCIAL_LOADING);
    await expect(currencyBlock(page)).toHaveAttribute('aria-busy', 'false');
    await expect(currencyBlock(page).locator('h3')).toHaveText(FINANCIAL_CURRENCY_HEADING);

    // D-01: the section keeps BOTH sub-headings, so a reader can see the
    // premium timeline above and the currency flow below in the same card.
    await expect(financialSection(page).locator('h3')).toHaveCount(2);

    // The premium block above is untouched, and its one tooltip is the one
    // both charts share.
    await expect(premiumBlock(page)).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('premium-summary')).toHaveCount(1);

    // D-15: small multiples ordered by operation count DESCENDING — credits at
    // 60 above gold at 52 — each with its own scale.
    const charts = page.getByTestId('currency-chart');
    await expect(charts).toHaveCount(2);
    await expect(charts.nth(0)).toHaveAttribute('data-currency', 'ru.wot.credits');
    await expect(charts.nth(1)).toHaveAttribute('data-currency', 'ru.shared_currency.gold');

    for (const [index, code, title, summary] of [
      [0, 'ru.wot.credits', 'Credits', CURRENCY_SUMMARIES.credits],
      [1, 'ru.shared_currency.gold', 'Gold', CURRENCY_SUMMARIES.gold],
    ] as const) {
      const chart = charts.nth(index);
      await expect(chart.locator('h4')).toHaveText(code);
      await expect(chart.locator('p.caption.title')).toHaveText(title);
      await expect(chart.locator('p.body')).toHaveText(summary);
    }

    // D-25's last clause: the cells sum to the sentence. Credits' rise by
    // 1,000 a month, so its drawn month count is the fixture's 30 and gold's
    // is 26 — the difference being the four months gold has no history for.
    const creditsCells = charts.nth(0).getByTestId('currency-cell');
    expect(await sumCells(creditsCells)).toEqual({
      deposited: 30_435_000,
      withdrawn: 12_000_000,
      ops: 60,
      months: 30,
    });
    const goldCells = charts.nth(1).getByTestId('currency-cell');
    expect(await sumCells(goldCells)).toEqual({
      deposited: 6_500,
      withdrawn: 2_600,
      ops: 52,
      months: 26,
    });

    // The diverging geometry, stated as a claim about the DOM: the deposit
    // bars are ABOVE the zero line and the withdrawal bars below it, so colour
    // is not the only cue (T-05-41).
    const creditsSvg = page.getByTestId('currency-svg').first();
    await expect(creditsSvg).toHaveAttribute('height', '192');
    await expect(creditsSvg.locator('[data-testid="in-bar"]').first()).toBeVisible();
    await expect(creditsSvg.locator('[data-testid="out-bar"]').first()).toBeVisible();

    // D-27: the legend names both directions in REAL TEXT, so the two hues —
    // which sit 1.36:1 apart — are never the only thing separating them.
    const legend = page.getByTestId('flow-legend').first();
    await expect(legend).toContainText(FLOW_LEGEND_DEPOSITED);
    await expect(legend).toContainText(FLOW_LEGEND_WITHDRAWN);
    await expect(legend.locator('[aria-hidden="true"]')).toHaveCount(2);

    // One tooltip instance serves the whole card, both blocks.
    await expect(page.getByTestId('finance-tooltip')).toHaveCount(1);
  });

  test('(frame) the zero line and both bound hairlines carry the Color table strokes', async () => {
    // 05-UI-REVIEW top fix 2, UAT G-05-9. The rgb strings are the spec's
    // `#5f6368` and `#dadce0` written out as literals and never read back off
    // the page: the contract is the source of these values, so a test that
    // scraped the computed colour and compared it with itself would pass
    // against a chart painted in whatever the stylesheet happened to say.
    const ZERO_LINE = 'rgb(95, 99, 104)'; // #5f6368
    const HAIRLINE = 'rgb(218, 220, 224)'; // #dadce0

    const strokes = (testId: string) =>
      page
        .getByTestId(testId)
        .first()
        .evaluate((svg) => ({
          zero: getComputedStyle(svg.querySelector('.zero-line')!).stroke,
          bounds: [...svg.querySelectorAll('.hairline')].map(
            (line) => getComputedStyle(line).stroke,
          ),
        }));

    // The premium chart draws the same frame as the currency one, so the pin
    // holds on a chart with no second direction to separate at all.
    for (const testId of ['premium-chart', 'currency-svg']) {
      const frame = await strokes(testId);

      expect(frame.zero, testId).toBe(ZERO_LINE);
      expect(frame.bounds, testId).toHaveLength(2);
      for (const bound of frame.bounds) {
        expect(bound, testId).toBe(HAIRLINE);
      }
    }
  });

  test('(axis-sample) each chart divides its plot between the two directions', async () => {
    // 05-21, G-05-9's empty-axis clause. Both charts on the sample page are
    // deposit-led, which is the shape that used to waste half the plot, so both
    // zero lines now sit LOW and both bottom labels name a quarter-of-the-
    // deposit axis value rather than a month.
    //
    // Every expected number below is hand-derived from the fixture and typed as
    // a literal; the strings are built with the same `ui-copy` formatters the
    // component uses, because the point of the assertion is that the label and
    // the geometry are the same claim made twice.
    const MICRO = 1_000_000n;

    const frame = (index: number) =>
      page
        .getByTestId('currency-svg')
        .nth(index)
        .evaluate((svg) => {
          const bar = (testId: string) =>
            [...svg.querySelectorAll(`[data-testid="${testId}"]`)].map((node) => ({
              y: Number(node.getAttribute('y')),
              height: Number(node.getAttribute('height')),
            }));
          // The visible text of a label EXCLUDES its `<title>` child, which is
          // where the exact figure lives — `textContent` would run the two
          // together into one string and every expectation below would be off.
          const visible = (node: Element) =>
            [...node.childNodes]
              .filter((child) => child.nodeType === Node.TEXT_NODE)
              .map((child) => child.textContent ?? '')
              .join('')
              .trim();
          return {
            zeroY: Number(svg.querySelector('.zero-line')!.getAttribute('y1')),
            inBars: bar('in-bar'),
            outBars: bar('out-bar'),
            labels: [...svg.querySelectorAll('text.y-axis')].map((node) => ({
              y: Number(node.getAttribute('y')),
              text: visible(node),
              title: node.querySelector('title')?.textContent ?? null,
            })),
          };
        });

    // Credits: deposits rise 1,000 a month from 1,000,000, so the largest is
    // 1,029,000 and the withdrawals are flat at 400,000. A quarter of 400,000
    // (100,000) is below the withdrawal maximum, and a quarter of 1,029,000
    // (257,250) is below 400,000 too — so both extents are their own maxima and
    // the split is 1,029,000 : 400,000 over 160px: 115 above, 45 below.
    const credits = await frame(0);
    expect(credits.zeroY).toBe(123); // 8 + 115
    expect(credits.inBars.length).toBe(30);
    // 1,029,000 / 1,429,000 x 160 is 115.21, so the tallest is the whole up room.
    expect(credits.inBars.reduce((tallest, b) => Math.max(tallest, b.height), 0)).toBe(115);
    expect(credits.inBars[29]).toEqual({ y: 8, height: 115 });
    // 400,000 / 1,429,000 x 160 is 44.79, so 45 — and every month has one.
    for (const bar of credits.outBars) {
      expect(bar).toEqual({ y: 123, height: 45 });
    }
    expect(credits.labels.map((label) => label.text)).toEqual([
      formatCompactNumber(1_029_000), // 1M
      '0',
      formatCompactNumber(-400_000),
    ]);
    // The exact figure is in the `<title>`, so the compact text is never the
    // only record of the number the axis reaches (D-25).
    expect(credits.labels.map((label) => label.title)).toEqual([
      formatFlowAmount(1_029_000n * MICRO),
      null, // the zero line's label carries no exact figure
      formatFlowAmount(-400_000n * MICRO),
    ]);

    // Gold: 250 in and 100 out in every month. A quarter of 100 is 25 and a
    // quarter of 250 is 62.5, both below the other side's own maximum, so the
    // split is 250 : 100 over 160px: 114 above, 46 below.
    const gold = await frame(1);
    expect(gold.zeroY).toBe(122); // 8 + 114
    expect(gold.inBars.reduce((tallest, b) => Math.max(tallest, b.height), 0)).toBe(114);
    expect(gold.inBars[0]).toEqual({ y: 8, height: 114 });
    for (const bar of gold.outBars) {
      expect(bar).toEqual({ y: 122, height: 46 });
    }
    expect(gold.labels.map((label) => label.text)).toEqual([
      formatCompactNumber(250),
      '0',
      formatCompactNumber(-100),
    ]);
    expect(gold.labels.map((label) => label.title)).toEqual([
      formatFlowAmount(250n * MICRO),
      null,
      formatFlowAmount(-100n * MICRO),
    ]);

    // The frame itself is unchanged: 8 + 160 + 24, whatever the split.
    await expect(page.getByTestId('currency-svg').nth(0)).toHaveAttribute('height', '192');
    await expect(page.getByTestId('currency-svg').nth(1)).toHaveAttribute('height', '192');
  });
});

/**
 * The four "Other currencies" rows the sample carries, built from the 05-01
 * answer key through the same formatter the component uses.
 *
 * The order is the worker's rule (operations descending, then plain code units,
 * blank last) and it is the claim being made: `ru.wot.crystal` at 3 operations,
 * `UAH` at 2, then `__proto__` and the blank code tied on one apiece — where
 * `'__proto__' < ''` is FALSE under a naive comparison, which is why the blank
 * code is last and the two one-operation currencies are not in file order.
 */
const EXPECTED_OTHER_ROWS = CURRENCY_HAND_EXPECTED.others.map((group) =>
  formatOtherCurrencyRow(
    {
      code: group.code === '' ? null : group.code,
      inUnits: BigInt(group.depositedThousandths) * 1_000n,
      outUnits: BigInt(group.withdrawnThousandths) * 1_000n,
      ops: group.operations,
      firstMonth: group.firstMonth ?? 0,
      lastMonth: group.lastMonth ?? 0,
    },
    'en-US',
  ),
);

test.describe('05-13 virtual currency: the sample export (other rows and tables)', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('(other) the pill and the four text rows in order, UAH among them', async () => {
    // The cross-checks first, as literals: six of the sample's 125 rows are
    // dropped — two `refund` types, an unparseable amount, a blank amount, an
    // unreadable date and a NEGATIVE amount — and they all sit on credits, so
    // a count taken after the grouping would be 66 rather than 60.
    expect(CURRENCY_HAND_EXPECTED.excluded).toBe(6);
    expect(formatOperationExcludedPill(CURRENCY_HAND_EXPECTED.excluded, 'en-US')).toBe(
      '6 operation rows excluded',
    );
    // crystal's income of 50 is money up (D-18), so its row reads 150 deposited
    // and UAH's reads 512.5 — the 12.5 deposit beside the 500 income.
    expect(EXPECTED_OTHER_ROWS).toEqual([
      'Deposited 150 · Withdrawn 30 · 2019-04 to 2020-01 · 3 operations',
      'Deposited 512.5 · Withdrawn 0 · 2019-01 to 2019-06 · 2 operations',
      'Deposited 1 · Withdrawn 0 · 2019-03 · 1 operation',
      'Deposited 7 · Withdrawn 0 · 2019-02 · 1 operation',
    ]);

    // The pill sits directly under the block caption and ABOVE the first
    // chart, which is the UI-SPEC's placement rule: a row the reader cannot
    // account for is stated before the charts that do not contain it.
    const block = currencyBlock(page);
    const pill = block.getByTestId('currency-excluded');
    await expect(pill).toHaveCount(1);
    await expect(pill).toContainText('6 operation rows excluded');
    await expect(pill).toContainText(CURRENCY_EXCLUDED_EXPLANATION);

    const caption = block.locator('p.caption').first();
    const pillTop = (await pill.boundingBox())!.y;
    const captionBottom = (await caption.boundingBox())!.y + (await caption.boundingBox())!.height;
    expect(pillTop).toBeGreaterThanOrEqual(captionBottom);
    const firstChartTop = (await block.getByTestId('currency-chart').first().boundingBox())!.y;
    expect(pillTop).toBeLessThan(firstChartTop);

    // Four rows, in the order above, and the code is a separate node from the
    // figures so a screen reader reads "UAH" then the sentence.
    const rows = block.getByTestId('currency-other-row');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('ru.wot.crystal');
    await expect(rows.nth(1)).toContainText('UAH');
    await expect(rows.nth(2)).toContainText('__proto__');
    // The blank code is `(not recorded)`, never an empty heading — a blank row
    // reads as a broken row rather than as a code the export left out.
    await expect(rows.nth(3)).toContainText(CURRENCY_BLANK_CODE);
    for (let i = 0; i < 4; i += 1) {
      await expect(rows.nth(i).locator('p.caption')).toHaveText(EXPECTED_OTHER_ROWS[i]!);
    }

    // UAH appears here and NOT as a chart, with no title caption: the export
    // left its CURRENCY_TITLE blank and two operations is below the threshold.
    await expect(page.locator('[data-testid="currency-chart"][data-currency="UAH"]')).toHaveCount(
      0,
    );

    // Nothing is dropped: the charts' codes followed by the list's codes is
    // every code in the hand fixture, once each, in the worker's order. The
    // two halves are read through DIFFERENT hooks on purpose — a chart's code
    // is an attribute and a listed code is text — so a component that rendered
    // a code in only one of the two places would fail here rather than pass by
    // counting the same nodes twice.
    const chartCodes = await page
      .getByTestId('currency-chart')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-currency')));
    const listedCodes = await block
      .getByTestId('currency-other-row')
      .locator('p.code')
      .allTextContents();
    expect(chartCodes).toEqual(['ru.wot.credits', 'ru.shared_currency.gold']);
    expect([...chartCodes, ...listedCodes]).toEqual([
      'ru.wot.credits',
      'ru.shared_currency.gold',
      'ru.wot.crystal',
      'UAH',
      '__proto__',
      CURRENCY_BLANK_CODE,
    ]);
  });

  test('(tables) each chart has a closed monthly table that opens newest first', async () => {
    const chart = page.getByTestId('currency-chart').nth(0);
    const disclosure = chart.getByTestId('monthly-table-disclosure');

    // Closed by default, so a closed disclosure adds no row nodes: a charted
    // currency with a 20-year history must not put 240 rows in the DOM to
    // show a chart of 240 months.
    await expect(disclosure.locator('summary')).toHaveText(MONTHLY_TABLE_DISCLOSURE);
    await expect(chart.getByTestId('monthly-table')).toHaveCount(0);

    await disclosure.locator('summary').click();
    const table = chart.getByTestId('monthly-table');
    await expect(table).toBeVisible();

    // The four columns, in the order the UI-SPEC fixes.
    await expect(table.locator('thead th')).toHaveText(CURRENCY_TABLE_HEADERS);

    // One row per DRAWN month, newest first — 30 for credits, not 30 sparse
    // entries and not the fixture's 26.
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(30);
    await expect(rows.nth(0)).toContainText('2020-06');
    await expect(rows.nth(29)).toContainText('2018-01');

    // The rows carry the exact figures, and they sum to the summary sentence
    // above the chart. `1,029,000` is the fixture's last deposit
    // (`1,000,000 + 1,000 × 29`).
    await expect(rows.nth(0).locator('td').nth(1)).toHaveText('1,029,000');
    await expect(rows.nth(0).locator('td').nth(2)).toHaveText('400,000');

    let deposited = 0n;
    let withdrawn = 0n;
    for (let i = 0; i < 30; i += 1) {
      const cells = rows.nth(i).locator('td');
      deposited += BigInt(((await cells.nth(1).textContent()) ?? '0').replace(/,/g, ''));
      withdrawn += BigInt(((await cells.nth(2).textContent()) ?? '0').replace(/,/g, ''));
    }
    // Whole units, not micro: the table shows the exact amount the reader
    // reads, and `formatFlowAmount` prints units with fractions trimmed.
    expect(deposited).toBe(30_435_000n);
    expect(withdrawn).toBe(12_000_000n);
  });

  test('(empty-month) a currency month with no operations reads No operations', async () => {
    // The sample's charted currencies have no gaps, so the empty-month form is
    // unreachable from them — and an `income` month is no longer a way in
    // either, because an income is money up and its month carries operations
    // (D-18). The form is now reached only by a GAP, which 05-13's Task 3 spec
    // forces on a real sparse history; what is asserted here is the cell
    // ACCESSIBLE NAME the axis and the gap rule make reachable.
    const cells = page.getByTestId('currency-chart').nth(0).getByTestId('currency-cell');
    await expect(cells).toHaveCount(30);
    await expect(cells.nth(0)).toHaveAttribute(
      'aria-label',
      '2018-01: deposited 1,000,000, withdrawn 400,000, 2 operations',
    );
  });
});

// -----------------------------------------------------------------------------
// 05-21: the axis of a currency that only ever moved one way
// -----------------------------------------------------------------------------

test.describe('05-21 the currency axis on a one-sided currency', () => {
  test('(axis-one-sided) the empty side gets a quarter of the plot and says so', async ({
    page,
  }) => {
    // Sixty 1,000-unit deposits and one 10-unit withdrawal, all in 2019-05, so
    // 61 operations clear the chart threshold in one month. This is the shape
    // the rule exists for: the withdrawal is real but tiny, and under the old
    // even split its bar was a 2px hairline 80px below a `−10` label while the
    // deposits squashed into the top half.
    //
    // Hand-derived: the up extent is the largest deposit month, 60,000; the down
    // extent is the quarter rule rather than the 10 that exists, 15,000; the
    // span is 75,000 over 160px, so 128 above and 32 below, and the zero line
    // sits at 8 + 128 = 136.
    const MICRO = 1_000_000n;
    const rows = [
      ...depositsIn('solo.axis', 'Solo Axis', '2019-05', 60, '1000'),
      currencyRow('2019-05-15 12:30:00', 'solo.axis', 'Solo Axis', '10', 'withdrawal'),
    ];
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, currencyExport(rows));

    const svg = page.getByTestId('currency-svg');
    await expect(svg).toHaveCount(1);
    // One month at the widest pitch, and the frame is unchanged by the split.
    await expect(svg).toHaveAttribute('width', '76');
    await expect(svg).toHaveAttribute('height', '192');

    const frame = await svg.evaluate((node) => {
      const visible = (el: Element) =>
        [...el.childNodes]
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent ?? '')
          .join('')
          .trim();
      return {
        zeroY: Number(node.querySelector('.zero-line')!.getAttribute('y1')),
        inBar: {
          y: Number(node.querySelector('[data-testid="in-bar"]')!.getAttribute('y')),
          height: Number(node.querySelector('[data-testid="in-bar"]')!.getAttribute('height')),
        },
        outBar: {
          y: Number(node.querySelector('[data-testid="out-bar"]')!.getAttribute('y')),
          height: Number(node.querySelector('[data-testid="out-bar"]')!.getAttribute('height')),
        },
        labels: [...node.querySelectorAll('text.y-axis')].map((el) => ({
          text: visible(el),
          title: el.querySelector('title')?.textContent ?? null,
        })),
      };
    });

    expect(frame.zeroY).toBe(136);
    // 60,000 / 75,000 x 160 is 128 exactly, so the deposit bar is the whole up room.
    expect(frame.inBar).toEqual({ y: 8, height: 128 });
    // 10 / 75,000 x 160 rounds to nothing, so the 2px floor is what the reader
    // gets — a visible mark, and never "no month" (the exact 10 is in the
    // tooltip, the cell's accessible name and the monthly table).
    expect(frame.outBar).toEqual({ y: 136, height: 2 });

    // The bottom label names the AXIS VALUE — 15,000 — and not the 10 that is
    // actually on the chart. That is the honest thing to label: the hairline
    // sits at 15,000 either side of the line, and the quarter rule is recorded
    // in the UI-SPEC amendment rather than left for a reader to infer.
    expect(frame.labels.map((label) => label.text)).toEqual([
      formatCompactNumber(60_000),
      '0',
      formatCompactNumber(-15_000),
    ]);
    expect(frame.labels.map((label) => label.title)).toEqual([
      formatFlowAmount(60_000n * MICRO),
      null,
      formatFlowAmount(-15_000n * MICRO),
    ]);
  });
});

// -----------------------------------------------------------------------------
// 05-22: the whole-pixel pitch, in a real browser
// -----------------------------------------------------------------------------

test.describe('05-22 the whole-pixel pitch', () => {
  test('(pitch-73) 73 months draw at pitch 7, 571px wide, with three labels', async ({ page }) => {
    // Seventy-three consecutive months, one 100-unit deposit each, from
    // 2015-01 through 2021-01. This is the month count that exposed the old
    // ladder: 16, 12, 8 and 4 answered 4 for 73 months, so the chart drew 292
    // of its 576px — 50.7% — and came out 352px wide. floor(576 / 73) is 7, so
    // the plot is 511px, 88.7% full, and the width is 56 + 511 + 4.
    //
    // 73 operations clears CHART_MIN_OPS (50), so this is one chart of one
    // currency and not a list, and every month is populated so every month has
    // a bar to measure.
    const rows = Array.from({ length: 73 }, (_unused, k) =>
      currencyRow(
        `${2015 + Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}-01 10:00:00`,
        'ru.shared_currency.pitch',
        'Pitch Probe',
        '100',
        'deposit',
      ),
    );
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, currencyExport(rows));

    const svg = page.getByTestId('currency-svg');
    await expect(svg).toHaveCount(1);
    await expect(svg).toHaveAttribute('width', '571');
    // The frame is untouched by the pitch: 8 + 160 + 24, split by the extents.
    await expect(svg).toHaveAttribute('height', '192');

    const cells = svg.getByTestId('currency-cell');
    await expect(cells).toHaveCount(73);
    // The cell x attributes, not just the width: a chart could reach 571px by
    // scaling, and this says it got there by using a 7px pitch.
    expect(Number(await cells.nth(0).getAttribute('x'))).toBe(56);
    expect(Number(await cells.nth(1).getAttribute('x'))).toBe(63);
    // Bar width stays pitch - 1, so a 7px pitch draws a 6px bar and a 1px gap.
    await expect(svg.locator('[data-testid="in-bar"]').first()).toHaveAttribute('width', '6');

    // 12 x 7 is 84, under the UI-SPEC's 96px floor, so the stride doubles to 24
    // months: 2015-01, 2017-01 and 2019-01. There is no fourth label, because
    // 2021-01 sits at x 560 and 560 + 56 = 616 runs past the 571px width.
    expect(await svg.locator('text.x-axis').allTextContents()).toEqual([
      '2015-01',
      '2017-01',
      '2019-01',
    ]);

    // And the point of the whole rule at this month count: at 571px the chart
    // fits its own column, so there is nothing left to scroll. The 240-month
    // spec above asserts the other half of the same scroller.
    const metrics = await currencyBlock(page)
      .getByTestId('bar-scroller')
      .evaluate((node) => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  });
});

// -----------------------------------------------------------------------------
// The three exports that need their own page: none charted, the cap, and the
// single-month singular forms
// -----------------------------------------------------------------------------
/** One currency-operation row in the export's own column order. */
function currencyRow(
  created: string,
  code: string,
  title: string,
  amount: string,
  type: string,
): readonly string[] {
  return [created, code, title, amount, type, FINANCE_CANARIES.orderId];
}

/** `n` deposit rows in one month, all at `amount`. */
function depositsIn(
  code: string,
  title: string,
  month: string,
  n: number,
  amount = '100',
): readonly (readonly string[])[] {
  return Array.from({ length: n }, (_unused, i) =>
    currencyRow(
      `${month}-${String((i % 28) + 1).padStart(2, '0')} 10:00:00`,
      code,
      title,
      amount,
      'deposit',
    ),
  );
}

/** An export whose currency file is exactly the rows given. */
function currencyExport(rows: readonly (readonly string[])[]): Uint8Array {
  return buildCustomExport({
    overrides: {
      'Financial_data/Virtual_Currencies_Operations.csv': renderQuoteAllCsv(
        CURRENCY_OPS_HEADER,
        rows,
      ),
    },
  });
}

test.describe('05-13 virtual currency: no currency clears the threshold', () => {
  test('(none-charted) every code is listed and no chart is drawn', async ({ page }) => {
    // Five codes of four operations each: below CHART_MIN_OPS, so the block
    // shows the caption, the pill and the list and nothing else (D-16). A
    // block that dropped a currency here would show four rows for a five-code
    // export, and the user could never learn the fifth currency existed.
    const codes = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
    const rows = codes.flatMap((code) => depositsIn(code, code, '2019-05', 4));
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, currencyExport(rows));

    const block = currencyBlock(page);
    await expect(block).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('currency-chart')).toHaveCount(0);
    // The caption and the section's own sub-heading still render, so the block
    // does not collapse into a bare list.
    await expect(block.locator('h3')).toHaveText(FINANCIAL_CURRENCY_HEADING);
    await expect(block.locator('p.caption').first()).toHaveText(CURRENCY_BLOCK_CAPTION);
    // Nothing was excluded, so the pill is ABSENT rather than "0 excluded".
    await expect(block.getByTestId('currency-excluded')).toHaveCount(0);

    const other = block.getByTestId('currency-other-row');
    await expect(other).toHaveCount(5);
    const codes_ = await other.locator('p.code').allTextContents();
    expect(codes_).toEqual(codes);
    for (let i = 0; i < 5; i += 1) {
      await expect(other.nth(i).locator('p.caption')).toHaveText(
        formatOtherCurrencyRow(
          {
            code: codes[i]!,
            inUnits: 400_000_000n,
            outUnits: 0n,
            ops: 4,
            firstMonth: 24_232,
            lastMonth: 24_232,
          },
          'en-US',
        ),
      );
    }
  });
});

test.describe('05-13 virtual currency: the cap of eight', () => {
  test('(cap) ten currencies chart eight and list two', async ({ page }) => {
    // Every code has EXACTLY 60 operations, so the ordering rule falls to
    // plain code units and the chart order is the code order — which is the
    // only way to tell a cap that took the first eight from a cap that took
    // the eight largest by some other measure.
    const codes = Array.from(
      { length: 10 },
      (_unused, i) => `cur.${String(i + 1).padStart(2, '0')}`,
    );
    const rows = codes.flatMap((code) => depositsIn(code, code, '2019-05', 60));
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, currencyExport(rows));

    await expect(page.getByTestId('currency-chart')).toHaveCount(8);
    const chartCodes = await page
      .getByTestId('currency-chart')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-currency')));
    expect(chartCodes).toEqual(codes.slice(0, 8));

    // The cap hides a CHART, never a currency: the two that did not fit are
    // both listed with their exact figures.
    const other = currencyBlock(page).getByTestId('currency-other-row');
    await expect(other).toHaveCount(2);
    await expect(other.nth(0)).toContainText(codes[8]!);
    await expect(other.nth(1)).toContainText(codes[9]!);
    await expect(other.nth(0).locator('p.caption')).toHaveText(
      formatOtherCurrencyRow(
        {
          code: codes[8]!,
          inUnits: 6_000_000_000n,
          outUnits: 0n,
          ops: 60,
          firstMonth: 24_232,
          lastMonth: 24_232,
        },
        'en-US',
      ),
    );
  });
});

test.describe('05-13 virtual currency: singular forms', () => {
  test('(single) one month, one label, "in YYYY-MM" and "1 operation"', async ({ page }) => {
    // One currency with 60 operations in ONE month clears the threshold, so it
    // charts — and its axis is a single cell at the widest pitch. The second
    // currency has one operation, which cannot chart and is the only place the
    // singular "1 operation" and the single-month span appear together.
    const rows = [
      ...depositsIn('solo.many', 'Solo Many', '2019-05', 60),
      ...depositsIn('solo.one', 'Solo One', '2019-05', 1, '7'),
    ];
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, currencyExport(rows));

    const chart = page.getByTestId('currency-chart');
    await expect(chart).toHaveCount(1);
    await expect(chart).toHaveAttribute('data-currency', 'solo.many');

    // One cell, and the widest pitch: 1 × 16 ≤ 576 and nothing narrower is
    // tried, so a one-month chart is a one-month chart at full width.
    const svg = page.getByTestId('currency-svg');
    await expect(svg).toHaveAttribute('width', '76');
    await expect(chart.getByTestId('currency-cell')).toHaveCount(1);
    await expect(svg.locator('text.x-axis')).toHaveCount(1);
    await expect(svg.locator('text.x-axis')).toHaveText('2019-05');

    // The single-month form of the date clause, and the plural operations.
    await expect(chart.locator('p.body')).toHaveText(
      formatCurrencySummary(
        { inUnits: 6_000_000_000n, outUnits: 0n, ops: 60, firstMonth: 24_232, lastMonth: 24_232 },
        'en-US',
      ),
    );
    expect(
      formatCurrencySummary(
        { inUnits: 6_000_000_000n, outUnits: 0n, ops: 60, firstMonth: 24_232, lastMonth: 24_232 },
        'en-US',
      ),
    ).toBe('Deposited 6,000 and withdrew 0 across 60 operations, in 2019-05.');

    // The one-operation row: singular noun, and the bare month rather than a
    // range that reads like a date bug.
    const other = currencyBlock(page).getByTestId('currency-other-row');
    await expect(other).toHaveCount(1);
    expect(
      formatOtherCurrencyRow(
        {
          code: 'solo.one',
          inUnits: 7_000_000n,
          outUnits: 0n,
          ops: 1,
          firstMonth: 24_232,
          lastMonth: 24_232,
        },
        'en-US',
      ),
    ).toBe('Deposited 7 · Withdrawn 0 · 2019-05 · 1 operation');
    await expect(other.locator('p.caption')).toHaveText(
      'Deposited 7 · Withdrawn 0 · 2019-05 · 1 operation',
    );
  });
});

// -----------------------------------------------------------------------------
// The currency block's own states, beside a READY section (D-02, DATA-04)
// -----------------------------------------------------------------------------

test.describe('05-13 virtual currency: a file that is empty and one nothing survives', () => {
  test('(states) no-rows, no-usable and ready each read a different sentence', async ({ page }) => {
    // A header-only currency file: the file is PRESENT and holds no rows, which
    // is a different problem for the reader than a file that is not in the zip
    // at all — only the first is fixed by a wider export range.
    await gotoApp(page);
    await importExport(
      page,
      SYNTHETIC_ZIP_NAME,
      buildCustomExport({
        overrides: {
          'Financial_data/Virtual_Currencies_Operations.csv': renderQuoteAllCsv(
            CURRENCY_OPS_HEADER,
            [],
          ),
        },
      }),
    );
    await expect(financialSection(page)).toHaveAttribute('data-status', 'ready');
    await expect(currencyBlock(page)).toHaveAttribute('data-state', 'no-rows');
    await expect(currencyBlock(page).locator('p.body')).toHaveText(
      formatFinancialNoRows('currency'),
    );
    await expect(currencyBlock(page)).not.toContainText(FINANCIAL_NOT_IN_EXPORT);
    await expect(page.getByTestId('currency-chart')).toHaveCount(0);

    // Then a REPLACE in which every row is excluded — an unknown TYPE on all
    // of them. This is the `no-usable` state, and it is the one that still
    // SHOWS the pill: "every row was dropped" and "some rows were dropped" are
    // the same fact at two magnitudes, and a reader whose account has nothing
    // else on screen is the one who most needs the count.
    await replaceExport(
      page,
      SYNTHETIC_ZIP_NAME,
      currencyExport(
        Array.from({ length: 4 }, () =>
          currencyRow('2019-05-01 10:00:00', 'ru.wot.credits', 'Credits', '100', 'refund'),
        ),
      ),
    );
    await expect(currencyBlock(page)).toHaveAttribute('data-state', 'no-usable');
    await expect(currencyBlock(page).locator('p.body')).toHaveText(CURRENCY_NO_USABLE);
    await expect(currencyBlock(page).getByTestId('currency-excluded')).toContainText(
      '4 operation rows excluded',
    );
    await expect(currencyBlock(page).getByTestId('currency-excluded')).toContainText(
      CURRENCY_EXCLUDED_EXPLANATION,
    );
    await expect(page.getByTestId('currency-chart')).toHaveCount(0);
  });
});

// =============================================================================
// 05-13 scale and interaction: a 20-year history, keyboard, and clipping
// =============================================================================
//
// WHAT ONLY A BROWSER CAN PROVE
// A 240-month chart is the case the whole per-bucket rule exists for. It is
// not enough to assert that the model draws 240 cells — the failure this guards
// against is a DOM of 240 × 3 nodes at once, a chart that widens the PAGE
// rather than scrolling inside its own box, a last month a keyboard user can
// never reach, and a tooltip that leaves the viewport at either end. Every one
// of those is a layout fact.
//
// THE EXPORT IS IMPORTED ONCE
// `CURRENCY_20Y_SPEC` is 2,000 rows over all 240 months from 2001-01 to
// 2020-12, round-robin assigned so every month has at least one row. Its
// excluded count is ZERO by construction (no unknown types, no unparseable
// amounts, no out-of-window dates), so the charted currency is the only one and
// the page has exactly one currency chart to measure.
//
// ORACLE INDEPENDENCE
// The stray-year case is checked against `tests/helpers/finance-oracle.ts`,
// which imports nothing from `src/`. The rows reach it through a splitter
// written HERE rather than through the app's own `parseCsvFile`: a spec that
// parsed the file with the parser under test would make the oracle agree with
// the app by construction.
// =============================================================================

/**
 * Split one fixture CSV into header-keyed rows, without the app's parser.
 *
 * The format is the export's own and is simple: a bare header line, then
 * quote-all data cells joined with `;`, every line terminated by a bare CR.
 * Hand-written here on purpose — see the independence note above.
 */
function splitFixtureCsv(csv: string): readonly Record<string, string>[] {
  const [headerLine, ...dataLines] = csv.split('\r');
  if (headerLine === undefined) return [];
  const header = headerLine.split(';');
  return dataLines
    .filter((line) => line !== '')
    .map((line) => {
      const cells = line.split(';').map((cell) => cell.replace(/^"(.*)"$/s, '$1'));
      const row: Record<string, string> = {};
      header.forEach((name, i) => {
        row[name] = cells[i] ?? '';
      });
      return row;
    });
}

/** An export whose currency file is the generated CSV for one spec. */
function generatedCurrencyExport(csv: string): Uint8Array {
  return buildCustomExport({
    overrides: { 'Financial_data/Virtual_Currencies_Operations.csv': csv },
  });
}

test.describe('05-13 virtual currency: a twenty-year history', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await gotoApp(page);
    await importExport(
      page,
      SYNTHETIC_ZIP_NAME,
      generatedCurrencyExport(generateCurrencyOpsCsv(CURRENCY_20Y_SPEC)),
    );
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('(240-months) 240 cells at pitch 4, a bounded DOM and its own scroller', async () => {
    // The span, from the spec: 2001-01 to 2020-12 inclusive is 240 months.
    expect(CURRENCY_20Y_SPEC.lastMonth - CURRENCY_20Y_SPEC.firstMonth + 1).toBe(240);
    expect(CURRENCY_20Y_SPEC.outOfWindowDateRows).toBe(0);
    expect(CURRENCY_20Y_SPEC.nonNumericAmountRows).toBe(0);
    expect(CURRENCY_20Y_SPEC.unknownTypeRows).toBe(0);

    await expect(currencyBlock(page)).toHaveAttribute('data-state', 'ready');
    const chart = page.getByTestId('currency-chart');
    await expect(chart).toHaveCount(1);
    await expect(chart).toHaveAttribute('data-currency', 'ru.shared_currency.gold');
    // Nothing was excluded, so the pill is absent rather than "0 excluded".
    await expect(currencyBlock(page).getByTestId('currency-excluded')).toHaveCount(0);

    const svg = page.getByTestId('currency-svg');
    const cells = svg.getByTestId('currency-cell');
    await expect(cells).toHaveCount(240);

    // Pitch 4, which is the narrowest step and the one 240 months cannot go
    // below: 56 + 240 × 4 + 4. Asserting the width AND two adjacent cells'
    // `x` is stronger than the width alone, because a chart could reach the
    // right width by scaling rather than by using the pitch.
    await expect(svg).toHaveAttribute('width', '1020');
    const firstX = Number(await cells.nth(0).getAttribute('x'));
    const secondX = Number(await cells.nth(1).getAttribute('x'));
    expect(secondX - firstX).toBe(4);

    // T-05-40's node bound: one pointer target, at most two bars, a text and a
    // tick per label, and a fixed frame. Over 240 months that is 760, and the
    // binding property is that the count scales with MONTHS and not with rows —
    // this file has 2,000 rows and draws at most 720 of them.
    const nodeCount = await svg.locator('*').count();
    expect(nodeCount).toBeLessThanOrEqual(3 * 240 + 40);
    expect(nodeCount).toBeGreaterThan(240);

    // It scrolls inside its own box and does NOT widen the page. The page-level
    // assertion is the one that matters at phone width (UI-SPEC section 14), and
    // at desktop it is the cheap proof that the overflow is contained.
    const scroller = currencyBlock(page).getByTestId('bar-scroller');
    const metrics = await scroller.evaluate((node) => ({
      overflowX: getComputedStyle(node).overflowX,
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }));
    expect(metrics.overflowX).toBe('auto');
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);

    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(1);
  });

  test('(keys) one tab stop, and End reaches the last month inside the scroller', async () => {
    const svg = page.getByTestId('currency-svg');
    const cells = svg.getByTestId('currency-cell');
    const scroller = currencyBlock(page).getByTestId('bar-scroller');

    // One tab stop in the whole chart: months are never individual stops.
    await expect(svg.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);

    // The chart is brought into view BEFORE the first key press, and that is
    // part of what is being tested rather than a convenience. `node.focus()`
    // scrolls the page when the element is off screen, and the scroll event
    // lands after the tooltip has already been opened against the cell's old
    // rect — so the shared tooltip correctly dismissed it as stale and the
    // first ArrowRight appeared to do nothing. A reader who has scrolled the
    // chart into view does not hit this; the test has to put them there.
    await svg.scrollIntoViewIfNeeded();

    // Arrive at the FIRST month, then walk right and come back with Home. The
    // tab stop FOLLOWS focus, so the stop has to move with the reader rather
    // than staying where the chart was entered.
    await cells.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('finance-tooltip')).toContainText('2001-02');
    await page.keyboard.press('Home');
    await expect(page.getByTestId('finance-tooltip')).toContainText('2001-01');
    // At the first month, ArrowLeft is a no-op that must NOT move the page.
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('finance-tooltip')).toContainText('2001-01');
    await expect(svg.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1);

    // End, the case that matters: a cell 239 steps to the right is roughly 956px
    // outside the visible box, and a keyboard reader who cannot reach the newest
    // month of a twenty-year history cannot read this chart at all.
    await page.keyboard.press('End');
    await expect(page.getByTestId('finance-tooltip')).toContainText('2020-12');

    const lastCell = cells.nth(239);
    await expect(lastCell).toBeFocused();
    const cellBox = (await lastCell.boundingBox())!;
    const scrollerBox = (await scroller.boundingBox())!;
    // Inside the scroller's own box, with a pixel of tolerance for the
    // fractional layout the 04-11 head/nav finding taught this repo to expect.
    expect(cellBox.x).toBeGreaterThanOrEqual(scrollerBox.x - 1);
    expect(cellBox.x + cellBox.width).toBeLessThanOrEqual(scrollerBox.x + scrollerBox.width + 1);
    // And the page itself did not scroll sideways to make room for it.
    const pageScrollLeft = await page.evaluate(() => document.documentElement.scrollLeft);
    expect(pageScrollLeft).toBe(0);
  });

  test('(clip) the first and last month keep the finance tooltip inside the viewport', async () => {
    const cells = page.getByTestId('currency-svg').getByTestId('currency-cell');
    const tooltip = page.getByTestId('finance-tooltip');
    const viewport = page.viewportSize()!;
    // The sticky nav's own bottom, so the flip assertion below states the
    // condition rather than a guessed pixel.
    const navBottom = await page.evaluate(() => {
      const nav = document.querySelector('[data-testid="dashboard-nav"]');
      return nav === null ? 72 : nav.getBoundingClientRect().bottom;
    });

    // Both ends, and the near-the-top flip, are the two places a tooltip
    // anchored to a cell is most likely to leave the screen: one horizontally
    // against the column edge, the other vertically under the sticky nav.
    for (const index of [0, 239]) {
      await cells.nth(index).hover();
      await expect(tooltip).toBeVisible();
      const box = (await tooltip.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(8);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 8);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }

    // The FLIP, which is the half of the backstop a plain clamp does not
    // reach: a cell near the TOP of the viewport has no room above it, so the
    // tooltip goes below rather than off the screen. The page is scrolled to
    // put the chart's first cell just under the top edge, which is the only
    // way to create that condition — an unscrolled page puts the cell in the
    // middle, where "above" is always the right answer.
    //
    // The scroll is INSTANT, and that is what makes this test deterministic.
    // `app.css` gives the page `scroll-behavior: smooth` whenever the reader has
    // not asked for reduced motion, which is Chromium's default under
    // Playwright, so a bare `window.scrollTo(x, y)` is a glide: `scrollY` has
    // not moved when the call returns, `hover()` opens the tooltip against a
    // cell that is still on its way, and the next frame of the glide moves the
    // cell more than a pixel. The shared tooltip dismisses a tooltip whose
    // cell has moved — correctly, see `ChartTooltip.isStale` — so the box read
    // below came back null in 4 to 15 of 20 isolated runs, depending on load.
    // The other specs that scroll the page pin it too: playtime-charts.spec.ts
    // with reduced motion, scroll-nav.spec.ts with this same instant scroll.
    await page.evaluate(() => {
      const chart = document.querySelector('[data-testid="currency-svg"]');
      if (chart !== null)
        window.scrollTo({
          top: chart.getBoundingClientRect().top + window.scrollY - 6,
          left: 0,
          behavior: 'instant',
        });
    });
    await cells.nth(0).hover();
    await expect(tooltip).toBeVisible();
    const cellBox = (await cells.nth(0).boundingBox())!;
    const flipped = (await tooltip.boundingBox())!;
    expect(cellBox.y).toBeLessThan(navBottom);
    expect(flipped.y).toBeGreaterThanOrEqual(cellBox.y + cellBox.height);
    expect(flipped.y + flipped.height).toBeLessThanOrEqual(viewport.height);

    // An empty month is the other tooltip form, and a 20-year history drawn
    // round-robin has no gaps — so the reachable one is the FIRST month of a
    // currency that only started later, which the sample export's gold is.
    await expect(cells.nth(0)).toHaveAttribute('data-month', '2001-01');
  });
});

// -----------------------------------------------------------------------------
// A second import: the two ends of the plausible-date window
// -----------------------------------------------------------------------------

test.describe('05-13 virtual currency: dates outside the window', () => {
  test('(stray-years) the 1969 and 9999 rows are counted and chart nothing', async ({ page }) => {
    // Twenty rows in 2019 of which FOUR are dated 9999-01-01 or 1969-12-31.
    // The whole point is that a stray year is a dropped ROW and not a dropped
    // FILE: the block stays `ready`, the sixteen readable rows are still
    // listed, and the four are counted rather than quietly discarded.
    const csv = generateCurrencyOpsCsv(CURRENCY_STRAY_YEAR_SPEC);
    const oracle = oracleCurrency(splitFixtureCsv(csv));
    expect(oracle.excluded).toBe(4);
    expect(oracle.usable).toBe(16);
    // Sixteen operations is below the threshold, so the claim "a stray year
    // does not cost the user the rest of the export" is observable here: the
    // readable rows are still a visible row.
    expect(oracle.charted).toHaveLength(0);
    expect(oracle.others).toHaveLength(1);

    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, generatedCurrencyExport(csv));

    await expect(currencyBlock(page)).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('currency-chart')).toHaveCount(0);
    await expect(currencyBlock(page).getByTestId('currency-excluded')).toContainText(
      formatOperationExcludedPill(oracle.excluded, 'en-US'),
    );
    await expect(currencyBlock(page).getByTestId('currency-excluded')).toContainText(
      CURRENCY_EXCLUDED_EXPLANATION,
    );
    const other = currencyBlock(page).getByTestId('currency-other-row');
    await expect(other).toHaveCount(1);
    await expect(other.locator('p.code')).toHaveText('ru.wot.credits');
  });
});

// =============================================================================
// Phase 05, plan 05-17 — an `income` is money up, in a real browser (UAT G-05-4)
// =============================================================================
//
// WHY A BROWSER SPEC AND NOT ANOTHER UNIT TEST
// `tests/unit/finance/finance.test.ts` already proves the builder totals an income into
// the deposit side, from the parsed CSV and at the per-month level. What it
// cannot prove is what the reader is SHOWN: the Other-currencies caption and
// the month cell's accessible name are two sentences the app composes, and the
// sentence that reached the user in UAT was "Deposited 0 · Withdrawn 0 ·
// 5 operations" for a currency that really did receive money. Each test below
// asserts the rendered string against BOTH a literal and the app's own
// formatter, so a copy change and a figure change cannot quietly agree with
// each other.

test.describe('05-17 virtual currency: an income counts as up', () => {
  test('(income-only) an income-only currency reports its deposits, not zero', async ({ page }) => {
    // The real export's shape: a stray `UAH` whose five rows are all `income`,
    // a blank title, and nothing else. This is the export that read
    // "Deposited 0 / Withdrawn 0 over 5 operations" in UAT.
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, currencyExport(CURRENCY_INCOME_ONLY_ROWS));

    const block = currencyBlock(page);
    await expect(block).toHaveAttribute('data-state', 'ready');
    // Five operations is below CHART_MIN_OPS, so this is a LISTED currency: no
    // chart, and no amber pill because nothing was excluded.
    await expect(page.getByTestId('currency-chart')).toHaveCount(0);
    await expect(block.getByTestId('currency-excluded')).toHaveCount(0);

    const rows = block.getByTestId('currency-other-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.locator('p.code')).toHaveText(CURRENCY_INCOME_ONLY_EXPECTED.others[0]!.code);

    // The caption is the whole point, so it is asserted three ways: the app's
    // own formatter over micro-units, the literal a reader would read, and the
    // two agreeing. 600 whole units over 5 operations is 600,000,000 micro —
    // the `* 1000n` is the fixture's thousandths-to-micro conversion.
    const group = CURRENCY_INCOME_ONLY_EXPECTED.others[0]!;
    const expectedCaption = formatOtherCurrencyRow(
      {
        code: group.code,
        inUnits: 600_000_000n,
        outUnits: 0n,
        ops: 5,
        firstMonth: 24_228,
        lastMonth: 24_231,
      },
      'en-US',
    );
    expect(expectedCaption).toBe('Deposited 600 · Withdrawn 0 · 2019-01 to 2019-04 · 5 operations');
    await expect(rows.locator('p.caption')).toHaveText(expectedCaption);
  });

  test('(income-month) a month of nothing but incomes names its operations', async ({ page }) => {
    // The per-MONTH half. Sixty incomes of 100 in 2019-05 clear the threshold,
    // so the currency charts, and its only month cell must announce its
    // operations rather than "no operations" — a cell that read "no
    // operations" over sixty real operations is the same defect as the
    // "Deposited 0" caption, one level down.
    const rows = Array.from({ length: 60 }, (_unused, i) =>
      currencyRow(
        `2019-05-${String((i % 28) + 1).padStart(2, '0')} 10:00:00`,
        'inc.month',
        'Income Only',
        '100',
        'income',
      ),
    );
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, currencyExport(rows));

    const chart = page.getByTestId('currency-chart');
    await expect(chart).toHaveCount(1);
    const cells = chart.getByTestId('currency-cell');
    await expect(cells).toHaveCount(1);
    await expect(cells.first()).toHaveAttribute(
      'aria-label',
      '2019-05: deposited 6,000, withdrawn 0, 60 operations',
    );
  });
});
