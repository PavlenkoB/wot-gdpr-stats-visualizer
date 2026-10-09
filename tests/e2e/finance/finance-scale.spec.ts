import '../_support/pin-locale';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { CHART_MAX, CHART_MIN_OPS } from '../../../src/lib/features/finance/finance-shared.ts';
import {
  CURRENCY_BLANK_CODE,
  formatCurrencySummary,
  formatMonthLabel,
  formatOperationExcludedPill,
  formatOtherCurrencyRow,
} from '../../../src/lib/ui-copy.ts';
import {
  CURRENCY_10K_SPEC,
  CURRENCY_50K_SPEC,
  generateCurrencyOpsCsv,
} from '../../fixtures/finance-fixtures.ts';
import { buildCustomExport } from '../../fixtures/export-fixtures.ts';
import { openSection } from '../_support/helpers.ts';
import { oracleCurrency, type OracleCurrency } from '../../helpers/finance-oracle.ts';

// =============================================================================
// Phase 05, plan 05-16 Task 1 — the 50,000-operation FINANCE path, in a browser
// =============================================================================
//
// WHY A BROWSER SPEC
// `tests/unit/finance-scale.test.ts` (plan 05-11) proves the 50,000-operation
// ARITHMETIC in Node, and plan 05-14 proves the 50,000-row import does not
// produce a page that hangs. What neither can prove is the claim this file
// exists for: that the currency card at 50,000 operations RENDERS — the right
// chart per currency, in the right order, with a DOM bounded by the months
// drawn rather than by the rows read, and without a main-thread task long
// enough for the user to notice. Only a page can answer those.
//
// WHY THE EXPECTATIONS ARE THE ORACLE'S
// Every number below comes from `oracleCurrency`, the independent
// implementation in `tests/helpers/finance-oracle.ts` that re-reads the
// GENERATED CSV TEXT and recomputes the figures without touching the app's
// worker, the app's aggregation or the DOM. That is the whole point: a spec
// that read the six summaries back out of the page and asserted they agreed
// with each other would pass against a card that is wrong in every figure, which
// is exactly the mistake 04-10 found in the calendar's earlier coverage.
//
// D-03: unusable rows are counted on screen, never silently dropped.
// D-15: one chart per currency, each with its own scale, ordered by row count.
// D-16: a currency below the chart threshold still appears, as a text row — so
//       no code in the export is dropped. At 50,000 rows the stray `UAH` clears
//       the threshold and earns a chart of its own; at 10,000 rows it does not
//       and lands in the Other currencies list. Both files are imported below
//       and the assertion follows the oracle either way.
// D-25: exact money, compact counts, browser locale (pinned to `en-US`).
//
// THE CI BUDGET RULE (plan 05-16 Task 2 derives its timeouts from this)
// The 50,000-operation export is imported into the browser EXACTLY ONCE in the
// whole suite. A serial describe owns one context and one page; the other four
// tests read the same rendered DOM. The DOM-flatness test then replaces it with
// the 10,000-operation export — in the SAME context, so the replace path
// (Phase 3's confirm-before-replace rule) is exercised rather than bypassed, and
// a second 50,000-operation import never happens. Two imports of the big file
// would double this file's cost to prove nothing new: the properties asserted
// here do not depend on how the file is delivered.
//
// A serial describe is the honest way to express that. Its cost is that a
// failure in test 1 skips tests 2 to 5, so each test's own report carries the
// diagnosis — which is why every assertion below names the key it compared
// against, and why the two measurements plan 05-16 Task 2 needs
// (`importToReadyMs`, the node counts) are REPORTED rather than only compared.
// =============================================================================

/** How long the 50,000-operation import may take from submission to `ready`. */
const READY_BUDGET_MS = 60_000;

/**
 * The long-task ceiling, in milliseconds.
 *
 * The same 1,000 ms the 20,000-entry import spec and the 04-12 scale spec use:
 * the conventional "noticeable but not blocking" boundary. All parse and
 * aggregation work is in the worker (PROJECT.md worker-boundary decision), which
 * is what this is checking.
 *
 * This spec uploads an in-memory buffer, and test (4)'s window is the whole page
 * lifetime, so it includes Playwright's own decode of that buffer on the page's
 * main thread (`Uint8Array.from(atob(b64), ...)`, proportional to the payload:
 * ~32 ms for this 714 KB zip on a fast machine, ~30x under the ceiling). That is
 * the cost an earlier version of this note blamed on a `postMessage`
 * structured-clone of the `File`, which it is not: see `pickExportFromDisk` in
 * helpers.ts, which import-flow (f) uses for its 3.6 MB zip, where the same
 * decode is a 140 ms task (1,216 ms on the CI runner that failed it).
 */
const LONG_TASK_LIMIT_MS = 1_000;

/**
 * The per-chart DOM ceiling, as a multiple of the chart's own drawn cell count
 * plus a fixed allowance for everything that is not a cell.
 *
 * A chart's cells are the `in-bar` and `out-bar` rects — two per month drawn,
 * so a chart over 106 months has 212. What else a chart holds is a fixed set:
 * the three plot hairlines, three y-axis labels with their `<title>`, the row
 * group, the sparse x-axis ticks and labels, and the hover and focus rings.
 * Plan 05-16 says "three times its cell count plus forty"; measured, the fixed
 * part is well inside that, so the bound fails by a wide margin if a chart ever
 * grows a node per input ROW instead of per month drawn.
 */
const CHART_NODE_MULTIPLE = 3;
const CHART_NODE_ALLOWANCE = 40;

/**
 * Fixed node cost of the currency card itself: its heading, the excluded
 * notice's pill and explanation, the six chart blocks' code headings, title
 * captions and keyboard hints, and the six collapsed monthly-table
 * disclosures.
 *
 * MEASURED, not guessed. Plan 05-16 asks for the same treatment plan 04-12 gave
 * the activity charts — "the measured overhead plus 100", with the measurement
 * recorded in the comment. The measured overhead is 40: the card holds 1,974
 * nodes and its six chart sections hold 1,934 (349, 349, 344, 325, 339 and
 * 228). So this is 140, and the whole-card ceiling comes to 3,806 against a
 * measured 1,974 — a bound that a chart growing a node per input row would miss
 * by more than an order of magnitude.
 */
const CARD_CHROME_NODES = 140;

/**
 * Allowed error, in WHOLE units, on a per-cell sum.
 *
 * `data-in` and `data-out` carry whole units (D-25 renders a compact form on
 * the chart; the exact value travels in the cell's accessible name and in the
 * monthly table). The oracle's sums are exact integer thousandths. A month
 * whose amount is fractional therefore contributes up to one thousandth of a
 * unit per cell that the DOM cannot represent, so a sum of `n` cells may differ
 * from the oracle by up to `n` thousandths. Two thousandths per cell is that
 * bound, doubled for the float division in `unitsToNumber`, and nothing more:
 * the exact totals are already proven by the summary sentences in test 1, so
 * this check is only asking "do the bars' own figures add up to the totals".
 */
const CELL_SUM_TOLERANCE_PER_CELL = 0.002;

/** `beforeAll` ceiling for building and importing the 50,000-operation export. */
const SCALE_BEFORE_ALL_TIMEOUT_MS = 180_000;

/** Per-test ceiling. The two tests that import pay for their own context. */
const SCALE_TEST_TIMEOUT_MS = 120_000;

// -----------------------------------------------------------------------------
// The exports and their oracles, built lazily
// -----------------------------------------------------------------------------

/**
 * Wrap a builder so it runs at most once, on first call.
 *
 * Two reasons for the laziness. `playwright test --list` LOADS every spec file
 * without running a test, and rendering 50,000 CSV rows at module scope would
 * make listing the suite pay seconds for bytes nothing reads. And the CI budget
 * rule above is only true because each preset has exactly one construction
 * site, which `grep` can check: a second one in this file would be a second
 * 50,000-operation export's worth of time.
 */
function memoised<T>(build: () => T): () => T {
  let built: { value: T } | null = null;
  return () => {
    if (built === null) built = { value: build() };
    return built.value;
  };
}

/**
 * Split a generated CSV into header-keyed rows, for the oracle.
 *
 * The production parser (`src/lib/worker/csv-parse.ts`) is a streaming reader
 * that runs inside the worker and reports a source line, not a row object, so
 * it cannot be called from a test. This splitter is the test's own, and it is
 * deliberately naive: the GENERATOR quotes nothing that needs quoting, so a
 * plain split is enough, and an oracle that shared the production parser would
 * be validating the parser against itself.
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

/**
 * Thousandths, as the oracle reports them, to the micro-units the app stores.
 *
 * The oracle counts in integer thousandths because that is exact for every
 * amount a WOT export writes. The app stores `MICRO_SCALE = 6` decimal places
 * (D-15: micro-unit sums as decimal strings), so the same amount is 1,000×
 * larger there. Every conversion in this file goes through this one function,
 * so the factor is stated once and cannot drift between assertions.
 */
function micro(thousandths: number): bigint {
  return BigInt(thousandths) * 1_000n;
}

/** The 50,000-operation export and its oracle, built together, once. */
const large = memoised(() => {
  const csv = generateCurrencyOpsCsv(CURRENCY_50K_SPEC);
  return {
    bytes: buildCustomExport({
      overrides: { 'Financial_data/Virtual_Currencies_Operations.csv': csv },
    }),
    oracle: oracleCurrency(splitFixtureCsv(csv)),
  };
});

/** The 10,000-operation export and its oracle, for the replace-time comparison. */
const small = memoised(() => {
  const csv = generateCurrencyOpsCsv(CURRENCY_10K_SPEC);
  return {
    bytes: buildCustomExport({
      overrides: { 'Financial_data/Virtual_Currencies_Operations.csv': csv },
    }),
    oracle: oracleCurrency(splitFixtureCsv(csv)),
  };
});

// -----------------------------------------------------------------------------
// The page-side helpers
// -----------------------------------------------------------------------------

/** One recorded main-thread long task, in milliseconds. */
interface LongTask {
  startTime: number;
  duration: number;
}

/**
 * Register the long-task observer BEFORE any app script runs.
 *
 * `addInitScript` is the only way to see the first long task: a script that
 * installs an observer after `page.goto` has already missed the parse, the
 * worker handshake and the module evaluation. An unsupported `longtask` entry
 * type leaves the array empty, which the assertion treats as pass-equivalent —
 * the same choice `tests/e2e/import/import-flow.spec.ts` makes, and the same reason:
 * the spec is Chrome-first and a missing API is not a product defect.
 */
async function installObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __longTasks: { startTime: number; duration: number }[] };
    w.__longTasks = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.__longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // 'longtask' is unsupported here; the array stays empty and the
      // long-task assertion treats that as pass-equivalent.
    }
  });
}

/** The long tasks recorded so far. */
function readLongTasks(page: Page): Promise<LongTask[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __longTasks: { startTime: number; duration: number }[] }).__longTasks,
  );
}

/** One chart block's node counts, measured inside the page. */
interface ChartNodeCounts {
  /** The code as written, or the blank-code marker. */
  code: string;
  /** Every descendant of the chart's own `<section>`. */
  nodes: number;
  /**
   * The `currency-cell` rects: ONE per month of the currency's own range, so
   * this is the length of the axis.
   */
  months: number;
  /**
   * The `in-bar` plus `out-bar` rects: at most two per month, and fewer where a
   * month received only one of the two flows.
   */
  bars: number;
}

/** What one `page.evaluate` over the currency card returns. */
interface CardNodeCounts {
  charts: ChartNodeCounts[];
  /** Every descendant of the whole currency card. */
  total: number;
  /** The card's own element, so the two datasets are read from the same DOM. */
  ready: boolean;
}

/**
 * Count the currency card's nodes in ONE round trip.
 *
 * One evaluate on purpose: the six charts must be measured at the same instant,
 * and six separate evaluates could straddle a re-render and report numbers from
 * two different DOMs.
 */
function measureCard(page: Page): Promise<CardNodeCounts> {
  return page.evaluate(() => {
    const card = document.querySelector('[data-testid="currency-block"]');
    if (card === null) throw new Error('measureCard: the currency card is not on the page');
    const charts = [...card.querySelectorAll('[data-testid="currency-chart"]')].map((chart) => ({
      code: chart.getAttribute('data-currency') ?? '',
      nodes: chart.querySelectorAll('*').length,
      months: chart.querySelectorAll('[data-testid="currency-cell"]').length,
      bars: chart.querySelectorAll('[data-testid="in-bar"], [data-testid="out-bar"]').length,
    }));
    return { charts, total: card.querySelectorAll('*').length, ready: true };
  });
}

/** Open the app and wait for the shell and the worker. */
async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
}

/**
 * Wait until an import or a replace has landed on Overview, within this spec's
 * own budget.
 *
 * The shared `waitForImported` helper has a fixed 30 s ceiling, which a
 * 50,000-operation import is not promised to meet; the budget here is the one
 * the whole spec is measured against. The signal is the same one the helper
 * uses: the identity header leaving its `skeleton` variant, then the processing
 * notice being gone (a replace never shows the skeleton, so the notice is what
 * tells a replace apart from the dataset it is replacing).
 */
async function awaitLanded(page: Page): Promise<void> {
  await expect(page.getByTestId('identity-header')).not.toHaveAttribute(
    'data-variant',
    'skeleton',
    { timeout: READY_BUDGET_MS },
  );
  await expect(page.getByTestId('processing-status')).toHaveCount(0, {
    timeout: READY_BUDGET_MS,
  });
}

/**
 * Import an export, open the Finance pane and wait for the currency card to
 * reach `ready`.
 *
 * An import lands on Overview (R1), where the currency block is not mounted, so
 * the pane is opened once the import has landed. `data-state` on the card is the
 * single signal: it is set in every state, so a wait on it cannot silently pass
 * on a page that never rendered the charts. Returns the milliseconds from
 * submission to `ready`, which is the number the CI budget in plan 05-16 Task 2
 * is derived from; the start point is still the submission.
 */
async function importAndAwaitReady(page: Page, bytes: Uint8Array): Promise<number> {
  const started = Date.now();
  await page.getByTestId('file-input').setInputFiles({
    name: 'finance-scale-export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
  await awaitLanded(page);
  await openSection(page, 'finance');
  await expect(page.getByTestId('currency-block')).toHaveAttribute('data-state', 'ready', {
    timeout: READY_BUDGET_MS,
  });
  return Date.now() - started;
}

/**
 * Wait until the first currency chart says the sentence the given oracle's
 * totals produce.
 *
 * `data-state` is NOT enough here. The card is already `ready` from the import
 * it is replacing, so waiting on it resolves instantly and the caller then
 * measures the dataset it already had — which is exactly the mistake that made
 * an earlier version of test 5 compare the 50,000-row card with itself. Waiting
 * on a VALUE that only the new dataset can produce is what makes the replace
 * observable, and because the value is the oracle's own sentence it doubles as
 * the check that the swap really happened.
 */
async function waitForDataset(page: Page, oracle: OracleCurrency): Promise<void> {
  const first = oracle.charted[0];
  if (first === undefined) throw new Error('waitForDataset: the oracle charted nothing');
  const sentence = formatCurrencySummary(
    {
      inUnits: micro(first.depositedThousandths),
      outUnits: micro(first.withdrawnThousandths),
      ops: first.operations,
      firstMonth: first.firstMonth ?? 0,
      lastMonth: first.lastMonth ?? 0,
    },
    'en-US',
  );
  await expect(page.getByTestId('currency-chart').first().locator('p.body')).toHaveText(sentence, {
    timeout: READY_BUDGET_MS,
  });
}

/**
 * Replace the dataset with another export, confirming the panel.
 *
 * A drop onto a page that already holds a dataset opens the confirm panel
 * BEFORE anything is processed (Phase 3's replace-on-drop rule), so a test that
 * set the file input twice without confirming would wait on a panel nobody
 * dismisses. Returns the milliseconds from the drop to the new dataset being on
 * screen.
 */
async function replaceAndAwaitReady(
  page: Page,
  bytes: Uint8Array,
  oracle: OracleCurrency,
): Promise<number> {
  const started = Date.now();
  await page.getByTestId('file-input').setInputFiles({
    name: 'finance-scale-small.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
  const panel = page.getByTestId('confirm-panel');
  await expect(panel).toBeVisible();
  await panel.getByTestId('confirm-commit').click();
  await expect(panel).toHaveCount(0);
  // The replace landed on Overview (R1): re-open the Finance pane before the
  // block can be read, then wait for the NEW dataset's own sentence below.
  await awaitLanded(page);
  await openSection(page, 'finance');
  await expect(page.getByTestId('currency-block')).toHaveAttribute('data-state', 'ready', {
    timeout: READY_BUDGET_MS,
  });
  await waitForDataset(page, oracle);
  return Date.now() - started;
}

// =============================================================================
// The one serial describe: a single 50,000-operation import, five claims
// =============================================================================

/** The oracle test 1 asserted, read by tests 2 to 5 so none re-derives it. */
let expected: OracleCurrency;

/** Measured on the shared page by the import, reported by test 4. */
let importToReadyMs = 0;

/** Measured by test 3, compared by test 5. */
let largeCounts: CardNodeCounts | null = null;

test.describe.configure({ mode: 'serial' });

test.describe('05-16 scale: 50,000 virtual-currency operations in a real browser', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    test.setTimeout(SCALE_BEFORE_ALL_TIMEOUT_MS);
    expected = large().oracle;

    context = await browser.newContext();
    page = await context.newPage();
    await installObserver(page);

    await gotoApp(page);
    // Idle before the import so the eager worker script fetch and the module
    // graph are not part of what the import is measured against.
    await page.waitForLoadState('networkidle');

    importToReadyMs = await importAndAwaitReady(page, large().bytes);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('(1) the oracle decides which currencies get a chart, in what order, and what each says', async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    const card = page.getByTestId('currency-block');
    const charts = card.getByTestId('currency-chart');

    // D-15: one chart per currency over the threshold, at most CHART_MAX,
    // ordered by row count. The oracle's order is the whole claim: the card
    // must not re-sort by code, and must not drop a chart that the oracle drew.
    await expect(charts).toHaveCount(expected.charted.length);
    for (const [index, group] of expected.charted.entries()) {
      const chart = charts.nth(index);
      await expect(chart).toHaveAttribute(
        'data-currency',
        group.code === '' ? CURRENCY_BLANK_CODE : group.code,
      );
      // The heading is the code as written, so a chart is nameable by a reader
      // and not only by a test attribute.
      await expect(chart.locator('h4')).toHaveText(
        group.code === '' ? CURRENCY_BLANK_CODE : group.code,
      );
    }
    // A sanity check on the fixture itself, so a future change to the
    // generator that quietly stopped exercising the CHART_MAX cap fails here
    // with a clear message rather than passing vacuously.
    expect(expected.charted.length).toBeLessThanOrEqual(CHART_MAX);
    for (const group of expected.charted) {
      expect(group.operations).toBeGreaterThanOrEqual(CHART_MIN_OPS);
    }

    // D-03: the excluded count is on screen and is the oracle's. The notice
    // carries the pill in a `span.pill` and the reason in a `span.explanation`,
    // so the pill is read on its own rather than matched against the whole card.
    await expect(card.getByTestId('currency-excluded').locator('span.pill')).toHaveText(
      formatOperationExcludedPill(expected.excluded, 'en-US'),
    );

    // D-25: each summary sentence is built from the ORACLE's totals in micro
    // units, not from whatever the page happens to have computed.
    for (const [index, group] of expected.charted.entries()) {
      const sentence = formatCurrencySummary(
        {
          inUnits: micro(group.depositedThousandths),
          outUnits: micro(group.withdrawnThousandths),
          ops: group.operations,
          firstMonth: group.firstMonth ?? 0,
          lastMonth: group.lastMonth ?? 0,
        },
        'en-US',
      );
      await expect(charts.nth(index).locator('p.body')).toHaveText(sentence);
    }

    // D-16: the Other currencies list is exactly the oracle's `others`. At
    // 50,000 rows the stray UAH clears CHART_MIN_OPS and is a chart, so the
    // list is legitimately empty here; the assertion is written against the
    // oracle's length rather than a literal 0 so it still means something if
    // the generator's weights ever change.
    const others = card.getByTestId('currency-other-row');
    await expect(others).toHaveCount(expected.others.length);
    for (const [index, group] of expected.others.entries()) {
      const row = others.nth(index);
      // The code and the figures are separate elements on purpose (a screen
      // reader reads the code as a label, then the figures), so the sentence
      // is the row's `p.caption` and the code is its own `p.code`.
      await expect(row.locator('p.caption')).toHaveText(
        formatOtherCurrencyRow(
          {
            code: group.code === '' ? null : group.code,
            inUnits: micro(group.depositedThousandths),
            outUnits: micro(group.withdrawnThousandths),
            ops: group.operations,
            firstMonth: group.firstMonth ?? 0,
            lastMonth: group.lastMonth ?? 0,
          },
          'en-US',
        ),
      );
      await expect(row.locator('p.code')).toHaveText(
        group.code === '' ? CURRENCY_BLANK_CODE : group.code,
      );
    }

    // The stray UAH is not dropped either way: at this scale it is a chart, and
    // it is the one with no title caption, because the export wrote no
    // CURRENCY_TITLE for it.
    const uah = expected.charted.findIndex((group) => group.code === 'UAH');
    expect(
      uah,
      'the generator must still emit the stray UAH at 50,000 rows',
    ).toBeGreaterThanOrEqual(0);
    await expect(charts.nth(uah).locator('p.caption.title')).toHaveCount(0);
  });

  test("(2) every chart draws the oracle's months and their figures add up to its totals", async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    const charts = page.getByTestId('currency-chart');

    // A cell's `data-ops` against the oracle's `operations` IS asserted here,
    // and this is what changed to make it assertable. It used to be a pair of
    // different numbers by construction: `data-ops` was the cell's deposit and
    // withdrawal operations while the oracle counted every usable row, and an
    // `income` was a usable row that FINANCE-02 did not total — so credits drew
    // about 12,600 deposits, 5,100 withdrawals and 2,400 incomes, and no sum
    // could bridge the two. Since an income is money UP (D-18), every usable
    // operation now sits in exactly one direction, and the equality below is
    // the scale-level guard that an operation cannot be swallowed by a month.
    for (const [index, group] of expected.charted.entries()) {
      const chart = charts.nth(index);
      // The axis is drawn for every month in the currency's range, gaps
      // included, so the cell count is the oracle's `months`, not the number of
      // months that happened to receive a row.
      const cells = chart.getByTestId('currency-cell');
      await expect(cells).toHaveCount(group.months);

      // A bar is drawn only for a month that RECEIVED that flow, so the bar
      // count is not the month count: on this fixture the UAH chart's 106
      // months carry 59 deposits and 39 withdrawals. What must hold is the
      // pairing — a bar exists exactly for the cells whose own figure is
      // non-zero — which is what proves each bar is drawn from its cell's
      // figure rather than from some other month or some other series.
      const bars = await chart.evaluate((element) => {
        const cellList = [...element.querySelectorAll('[data-testid="currency-cell"]')];
        const nonZeroIn = cellList.filter((cell) => Number(cell.getAttribute('data-in')) !== 0);
        const nonZeroOut = cellList.filter((cell) => Number(cell.getAttribute('data-out')) !== 0);
        return {
          inBars: element.querySelectorAll('[data-testid="in-bar"]').length,
          outBars: element.querySelectorAll('[data-testid="out-bar"]').length,
          nonZeroIn: nonZeroIn.length,
          nonZeroOut: nonZeroOut.length,
        };
      });
      expect(bars.inBars, `${group.code}: one in-bar per non-zero in-figure`).toBe(bars.nonZeroIn);
      expect(bars.outBars, `${group.code}: one out-bar per non-zero out-figure`).toBe(
        bars.nonZeroOut,
      );

      // D-25: the per-cell figures are whole units, so their sums are compared
      // with the oracle's thousandths to within a thousandth per cell. This
      // checks the BARS' own numbers, not the card's totals — the exact totals
      // are the summary sentences test 1 already proved against the oracle.
      // The operation COUNT is summed here too, and it is EXACT rather than
      // approximate: an income is up, so the cells' operations are the
      // currency's whole operation count and the two must be equal, not close.
      const sums = await chart.evaluate((element) => {
        let deposited = 0;
        let withdrawn = 0;
        let operations = 0;
        for (const cell of element.querySelectorAll('[data-testid="currency-cell"]')) {
          deposited += Number(cell.getAttribute('data-in') ?? '0');
          withdrawn += Number(cell.getAttribute('data-out') ?? '0');
          operations += Number(cell.getAttribute('data-ops') ?? '0');
        }
        return { deposited, withdrawn, operations };
      });
      expect(
        sums.operations,
        `${group.code}: cells hold ${sums.operations} operations, oracle says ${group.operations}`,
      ).toBe(group.operations);
      const tolerance = group.months * CELL_SUM_TOLERANCE_PER_CELL;
      const expectedIn = group.depositedThousandths / 1_000;
      const expectedOut = group.withdrawnThousandths / 1_000;
      expect(
        Math.abs(sums.deposited - expectedIn),
        `${group.code}: cells sum to ${sums.deposited} whole units in, oracle says ${expectedIn}`,
      ).toBeLessThanOrEqual(tolerance);
      expect(
        Math.abs(sums.withdrawn - expectedOut),
        `${group.code}: cells sum to ${sums.withdrawn} whole units out, oracle says ${expectedOut}`,
      ).toBeLessThanOrEqual(tolerance);

      // The axis runs from the oracle's first month to its last, one cell per
      // month drawn, so the first and last cell's own `data-month` are the
      // oracle's endpoints and not whatever the card happened to bucket.
      const firstMonth = await cells.first().getAttribute('data-month');
      const lastMonth = await cells.last().getAttribute('data-month');
      expect(firstMonth, `${group.code}: the axis must start at the oracle's first month`).toBe(
        formatMonthLabel(group.firstMonth ?? 0),
      );
      expect(lastMonth, `${group.code}: the axis must end at the oracle's last month`).toBe(
        formatMonthLabel(group.lastMonth ?? 0),
      );
    }
  });

  test("(3) the card's DOM is bounded by the months drawn, not by the rows read", async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    largeCounts = await measureCard(page);
    expect(largeCounts.charts).toHaveLength(expected.charted.length);

    for (const chart of largeCounts.charts) {
      const ceiling = chart.bars * CHART_NODE_MULTIPLE + CHART_NODE_ALLOWANCE;
      expect(
        chart.nodes,
        `${chart.code}: ${chart.nodes} nodes for ${chart.bars} drawn bars (ceiling ${ceiling})`,
      ).toBeLessThanOrEqual(ceiling);
    }

    // The whole card is bounded by the same arithmetic plus a fixed chrome
    // allowance, so six individually-cheap charts cannot add up to a page that
    // is not. The chrome is measured, not guessed: see CARD_CHROME_NODES.
    const chartCeiling = largeCounts.charts.reduce(
      (sum, chart) => sum + chart.bars * CHART_NODE_MULTIPLE + CHART_NODE_ALLOWANCE,
      0,
    );
    expect(
      largeCounts.total,
      `the whole card holds ${largeCounts.total} nodes against a ${chartCeiling + CARD_CHROME_NODES} ceiling`,
    ).toBeLessThanOrEqual(chartCeiling + CARD_CHROME_NODES);

    // The measurement is REPORTED, not only compared: plan 05-16 Task 2 prices
    // this file's cost in CI seconds from it.
    console.log(
      `05-16 measurement: 50,000 operations import-to-ready ${importToReadyMs} ms; ` +
        `card ${largeCounts.total} nodes over ${largeCounts.charts.reduce((sum, c) => sum + c.bars, 0)} drawn bars ` +
        `on ${largeCounts.charts.reduce((sum, c) => sum + c.months, 0)} chart months`,
    );
  });

  test('(4) no main-thread task of a second or more runs while the import is processed', async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    expect(
      importToReadyMs,
      `50,000 operations reached ready in ${importToReadyMs} ms (budget ${READY_BUDGET_MS} ms)`,
    ).toBeLessThan(READY_BUDGET_MS);

    // PROJECT.md worker-boundary decision: all parse and aggregation work is in
    // the worker, so nothing on the main thread should reach the threshold at
    // which a user notices. The observer is installed before any app script
    // runs, so this covers the whole import and not just its tail.
    const offenders = (await readLongTasks(page)).filter(
      (task) => task.duration >= LONG_TASK_LIMIT_MS,
    );
    expect(
      offenders.map((task) => ({ startTime: task.startTime, duration: task.duration })),
      `long tasks at or over ${LONG_TASK_LIMIT_MS} ms during the 50,000-operation import`,
    ).toEqual([]);
  });

  test('(5) replacing with a fifth of the rows does not grow the DOM', async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    expect(largeCounts, 'test 3 must have measured the 50,000-operation card').not.toBeNull();
    const before = largeCounts as CardNodeCounts;

    const smallExpected = small().oracle;
    const replaceMs = await replaceAndAwaitReady(page, small().bytes, smallExpected);
    const after = await measureCard(page);

    // The smaller file really is a different dataset: the oracle's excluded
    // count is the same by construction (both specs draw the same bad-row
    // counts) but its charted count is not, because the stray UAH falls below
    // CHART_MIN_OPS at 10,000 rows and becomes an Other currencies row (D-16).
    expect(after.charts).toHaveLength(smallExpected.charted.length);
    expect(smallExpected.charted.length).toBeLessThan(expected.charted.length);
    await expect(page.getByTestId('currency-other-row')).toHaveCount(smallExpected.others.length);

    // The comparison is PER CHART, and that is the property this test exists to
    // prove. Plan 05-16 words it as "the replace-time element count equals the
    // 50,000 import's element count", and that equality cannot hold here — not
    // for the whole card and not even for one chart — so the assertions below
    // are written against what the oracle CAN decide, which is strictly
    // stronger in the direction that matters:
    //
    //  1. THE WHOLE-CARD count cannot match, by construction. The 50,000-row
    //     file charts SIX codes; the 10,000-row file charts FIVE and lists the
    //     stray UAH as a text row, because at 10,000 rows it falls below
    //     CHART_MIN_OPS. Two different cards, so two different totals.
    //  2. Even PER CHART the counts may legitimately differ. A chart draws one
    //     `currency-cell` per month of its OWN range — first to last month that
    //     received an operation — so a sparser sample spans a narrower window:
    //     measured, crystal covers 212 cells on 6,032 operations and 207 on
    //     1,263. And it draws one bar per month that actually received that
    //     flow, so credits goes from 349 nodes to 344: five bar rects, not five
    //     input rows' worth of DOM.
    //
    // So the claim is stated as the three things that are true and tight. The
    // axis is EXACTLY the smaller file's own oracle month count — the DOM is a
    // function of the months drawn, never of the rows read. The axis is never
    // WIDER on a fifth of the rows. And the node count never grows, and stays
    // inside the same per-chart ceiling test 3 pinned. A chart that grew a node
    // per input ROW would miss all three by three orders of magnitude.
    const beforeByCode = new Map(before.charts.map((chart) => [chart.code, chart]));
    for (const [index, group] of smallExpected.charted.entries()) {
      const chart = after.charts[index];
      expect(chart, `chart ${index} must be ${group.code}`).toBeDefined();
      expect(chart.code, `chart ${index} must be the oracle's ${index}th code`).toBe(
        group.code === '' ? CURRENCY_BLANK_CODE : group.code,
      );
      expect(
        chart.months,
        `${chart.code}: the axis must be exactly the oracle's ${group.months} drawn months`,
      ).toBe(group.months);

      const was = beforeByCode.get(chart.code);
      expect(was, `${chart.code} must be charted by both files for this comparison`).toBeDefined();
      const prior = was as ChartNodeCounts;
      expect(
        chart.months,
        `${chart.code}: a fifth of the rows cannot span a wider month range ` +
          `(${chart.months} months against ${prior.months})`,
      ).toBeLessThanOrEqual(prior.months);
      expect(
        chart.nodes,
        `${chart.code}: ${chart.nodes} nodes at 10,000 rows against ${prior.nodes} at 50,000`,
      ).toBeLessThanOrEqual(prior.nodes);
      expect(
        chart.nodes,
        `${chart.code}: ${chart.nodes} nodes must stay inside the per-chart ceiling`,
      ).toBeLessThanOrEqual(chart.bars * CHART_NODE_MULTIPLE + CHART_NODE_ALLOWANCE);
    }

    // And the whole card got SMALLER, which is the other half of the claim:
    // five times fewer input rows cannot mean a bigger DOM.
    expect(
      after.total,
      `the 10,000-row card holds ${after.total} nodes against the 50,000-row card's ${before.total}`,
    ).toBeLessThan(before.total);

    console.log(
      `05-16 measurement: 10,000-operation replace-to-ready ${replaceMs} ms; ` +
        `card ${after.total} nodes over ${after.charts.length} charts ` +
        `(was ${before.total} over ${before.charts.length}); ` +
        `per chart ${after.charts.map((c) => `${c.code}=${c.nodes}`).join(', ')}`,
    );
  });
});
