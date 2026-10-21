import '../_support/pin-locale';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { MAX_LOGIN_IPS } from '../../../src/lib/features/logins/login-shared.ts';
import * as copy from '../../../src/lib/ui-copy.ts';
import {
  buildLargeThreeAccountExport,
  type LargeSessionPair,
} from '../../fixtures/multi-account-fixtures.ts';
import { oracleCurrency } from '../../helpers/finance-oracle.ts';
import {
  currencyBlock,
  loginHistoryBlock,
  openSection,
  pickExportFromDisk,
  playerStatsBlock,
  playtimeBlock,
  spendBlock,
} from '../_support/helpers.ts';

// =============================================================================
// Phase 10, plan 10-06 — the LARGE three-account import, in a real browser
// =============================================================================
//
// WHAT THIS PROVES (SCALE-01, D-17)
// One synthetic archive — three accounts, a 54,000-row `Virtual_Currencies_
// Operations.csv`, 20,000 sessions over three games, 7,000 vehicle rows and a
// login history that shares addresses across accounts — is imported into ONE
// browser context, once. The first test then reads every merged pane off that
// one DOM and asserts four things about it:
//
//   1. the import reaches ready inside the budget (60,000 ms);
//   2. every pane draws a number of nodes set by BUCKETS or VISIBLE WINDOWS, not
//      by rows: the vehicle and login tables draw a window while `aria-rowcount`
//      names the full count, the Playtime block draws its calendar cells and a
//      measured overhead, each currency chart draws bars times three plus 40;
//   3. no main-thread task of 1,000 ms or more runs in the page's life;
//   4. nothing leaves the page: no request after the baseline, one worker, no
//      CSP violation.
//
// The second test runs the game filter flow and the masking toggle on the
// same dataset.
//
// THE CI BUDGET RULE
// The archive is imported EXACTLY ONCE for the whole file: a serial describe owns
// one context and one page, and both tests read the same DOM. The builder is
// memoised so `playwright test --list`, which loads every spec without running a
// test, never builds a 1.4 MB archive.
//
// THE EXPECTATIONS ARE INDEPENDENT
// Playtime is checked against a minute bitmap computed here from the generated
// sessions, and the currency charts against `oracleCurrency` over the generated
// CSV text. Nothing is read back off the page and compared with itself.
// =============================================================================

/** How long the large import may take from submission to the Playtime pane being ready. */
const READY_BUDGET_MS = 60_000;

/** The long-task ceiling, the same 1,000 ms every scale spec in this suite uses. */
const LONG_TASK_LIMIT_MS = 1_000;

/**
 * The most rows a windowed table may DRAW, whatever it holds.
 *
 * The vehicle and login tables draw the rows near the viewport plus a small
 * buffer. 60 is roughly twice what a tall desktop viewport shows, so a table
 * that quietly drew one `<tr>` per row (7,000 or 600) fails by an order of
 * magnitude.
 */
const WINDOW_ROW_BOUND = 60;

/**
 * Fixed node cost of the Playtime block that is not a calendar cell: year heads,
 * weekday groups, month labels, the hour grid's axes, the duration bars, the
 * legends, the shared tooltip, and — on a multi-account dataset — the chip row
 * and the combined caption. Taken from `playtime-scale.spec.ts`'s measured 757
 * for the chart container, the justification being the same: a chart growing a
 * node per session would miss this ceiling by three orders of magnitude. The
 * Playtime BLOCK also holds the tiles and selectors around the charts, and
 * `PLAYTIME_BLOCK_CHROME_NODES` is that remainder, measured below.
 */
const CHART_OVERHEAD_NODES = 757;

/**
 * What the Playtime BLOCK holds beyond its charts' calendar cells and the 757
 * nodes above: the tiles, the chip row, the split selector and the caption.
 *
 * MEASURED: the block held 6,254 nodes over 5,479 calendar cells, an overhead of
 * 775, which is 757 plus 18. The ceiling follows the 04-12 rule (measured plus
 * 100), so this is 118. A node per session (20,000 of them) would miss it by a
 * factor of three on the total and by an order of magnitude on the surplus.
 */
const PLAYTIME_BLOCK_CHROME_NODES = 118;

/** Currency chart ceiling: bars times three plus 40 (the 05-16 rule), and the card's chrome. */
const CHART_NODE_MULTIPLE = 3;
const CHART_NODE_ALLOWANCE = 40;
const CARD_CHROME_NODES = 140;

/** `beforeAll` ceiling for building and importing the large export. */
const SCALE_BEFORE_ALL_TIMEOUT_MS = 180_000;

/** Per-test ceiling. */
const SCALE_TEST_TIMEOUT_MS = 120_000;

// -----------------------------------------------------------------------------
// The export, built lazily
// -----------------------------------------------------------------------------

/** Wrap a builder so it runs at most once, on first call (never at module scope). */
function memoised<T>(build: () => T): () => T {
  let built: { value: T } | null = null;
  return () => {
    if (built === null) built = { value: build() };
    return built.value;
  };
}

/** The large archive and the facts about it, built once. */
const large = memoised(() => buildLargeThreeAccountExport());

/**
 * Split a generated, quote-all CSV into header-keyed rows for the oracle. Naive
 * on purpose: an oracle sharing the production parser would validate the parser
 * against itself.
 */
function splitFixtureCsv(csv: string): readonly Record<string, string>[] {
  const [headerLine, ...dataLines] = csv.split('\r');
  const unquote = (cell: string): string => cell.replace(/^"(.*)"$/s, '$1');
  const header = (headerLine ?? '').split(';').map(unquote);
  return dataLines
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const cells = line.split(';').map(unquote);
      const row: Record<string, string> = {};
      header.forEach((name, i) => {
        row[name] = cells[i] ?? '';
      });
      return row;
    });
}

/** Oracle thousandths to the micro-units the app stores. */
const micro = (thousandths: number): bigint => BigInt(thousandths) * 1_000n;

/** The independent playtime oracle: a minute bitmap over the whole span. */
function minuteBitmapOracle(pairs: readonly LargeSessionPair[]): {
  seconds: number;
  sessions: number;
  days: number;
} {
  let low = Infinity;
  let high = -Infinity;
  for (const [start, end] of pairs) {
    if (start < low) low = start;
    if (end > high) high = end;
  }
  const firstMinute = Math.floor(low / 60);
  const bitmap = new Uint8Array(Math.ceil(high / 60) - firstMinute);
  const days = new Set<number>();
  for (const [start, end] of pairs) {
    bitmap.fill(1, Math.floor(start / 60) - firstMinute, Math.floor(end / 60) - firstMinute);
    days.add(Math.floor(start / 86_400));
  }
  let marked = 0;
  for (let i = 0; i < bitmap.length; i++) marked += bitmap[i]!;
  return { seconds: marked * 60, sessions: pairs.length, days: days.size };
}

/** Everything the two tests compare the page against, computed once from `expected`. */
const oracles = memoised(() => {
  const { expected } = large();
  const currency = oracleCurrency(expected.currencyCsvs.flatMap((csv) => splitFixtureCsv(csv)));
  return {
    expected,
    currency,
    all: minuteBitmapOracle(expected.sessions.all),
    wot: minuteBitmapOracle(expected.sessions.WOT),
    wotb: minuteBitmapOracle(expected.sessions.WOTB),
    wows: minuteBitmapOracle(expected.sessions.WOWS),
  };
});

// -----------------------------------------------------------------------------
// Page-side helpers
// -----------------------------------------------------------------------------

/** One recorded main-thread long task, in milliseconds. */
interface LongTask {
  startTime: number;
  duration: number;
}

/**
 * Register the long-task observer and the CSP-violation recorder BEFORE any app
 * script runs. An unsupported `longtask` entry type leaves the array empty, which
 * the assertion treats as pass-equivalent (the suite is Chrome-first).
 */
async function installObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __longTasks: { startTime: number; duration: number }[];
      __cspViolations: string[];
    };
    w.__longTasks = [];
    w.__cspViolations = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.__longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // 'longtask' is unsupported here; the array stays empty.
    }
    document.addEventListener(
      'securitypolicyviolation',
      (event) => {
        w.__cspViolations.push((event as SecurityPolicyViolationEvent).violatedDirective);
      },
      true,
    );
  });
}

/** The long tasks recorded so far. */
function readLongTasks(page: Page): Promise<LongTask[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __longTasks: { startTime: number; duration: number }[] }).__longTasks,
  );
}

/** The CSP violations recorded so far. */
function readViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);
}

/** Open the app and wait for the shell and the worker. */
async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
}

/**
 * Wait until an import has landed: the identity header has left its skeleton
 * variant and the processing notice is gone.
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

/** What the `page.evaluate` over the currency card returns. */
interface ChartNodeCounts {
  code: string;
  nodes: number;
  bars: number;
}

/** Count the currency card's nodes in ONE round trip (the charts must be measured together). */
function measureCurrencyCard(page: Page): Promise<{ charts: ChartNodeCounts[]; total: number }> {
  return page.evaluate(() => {
    const card = document.querySelector('[data-testid="currency-block"]');
    if (card === null) throw new Error('measureCurrencyCard: the currency card is not on the page');
    const charts = [...card.querySelectorAll('[data-testid="currency-chart"]')].map((chart) => ({
      code: chart.getAttribute('data-currency') ?? '',
      nodes: chart.querySelectorAll('*').length,
      bars: chart.querySelectorAll('[data-testid="in-bar"], [data-testid="out-bar"]').length,
    }));
    return { charts, total: card.querySelectorAll('*').length };
  });
}

// =============================================================================
// The one serial describe: a single large import, read by every test
// =============================================================================

/** Requests recorded for the whole context, and the baseline taken before the import. */
const requests: string[] = [];
const workerUrls: string[] = [];
let baselineCount = 0;

/** Measured by the import in `beforeAll`, reported by test (1). */
let importToReadyMs = 0;

test.describe.configure({ mode: 'serial' });

test.describe('10-06 scale: a three-account export with 54,000 currency rows, in a real browser', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }, testInfo: TestInfo) => {
    test.setTimeout(SCALE_BEFORE_ALL_TIMEOUT_MS);
    const bytes = large().bytes;

    context = await browser.newContext();
    page = await context.newPage();
    await installObservers(page);
    context.on('request', (request) => requests.push(request.url()));
    page.on('worker', (worker) => workerUrls.push(worker.url()));

    await gotoApp(page);
    // Idle before the import so the eager worker script fetch and the module
    // graph belong to the baseline and not to what the import is measured on.
    await page.waitForLoadState('networkidle');
    baselineCount = requests.length;
    expect(baselineCount, 'the page made its own requests before the baseline').toBeGreaterThan(0);
    expect(workerUrls, 'exactly one worker before the import').toHaveLength(1);

    const started = Date.now();
    // By PATH, not by in-memory buffer: Playwright decodes a buffer on the page's
    // MAIN thread, a harness long task proportional to the payload that the
    // observer below would count against the app (see `pickExportFromDisk`).
    await pickExportFromDisk(page, testInfo, 'multi-account-scale-export.zip', bytes);
    await awaitLanded(page);
    // An import lands on Overview, where the Playtime block is not mounted, so
    // the pane that owns it is opened and its own state attribute is the signal.
    await openSection(page, 'playtime');
    await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready', {
      timeout: READY_BUDGET_MS,
    });
    importToReadyMs = Date.now() - started;
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('the large three-account import is under budget, every merged pane is bounded by buckets or windows, and nothing leaves the page', async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    const { expected, currency, all } = oracles();
    console.log(`[10-06] import to ready: ${importToReadyMs} ms`);

    // --- 1. the import budget ------------------------------------------------
    expect(importToReadyMs, `import to ready (budget ${READY_BUDGET_MS} ms)`).toBeLessThan(
      READY_BUDGET_MS,
    );

    // --- 2. the identity header: three accounts, A, B, C ---------------------
    await expect(page.getByTestId('identity-multi-title'), 'header title').toHaveText(
      copy.formatAccountCount(3),
    );
    const legend = page.getByTestId('identity-multi-row').getByTestId('account-tag');
    await expect(legend, 'three legend tags').toHaveCount(3);
    expect(
      await legend.evaluateAll((tags) => tags.map((tag) => (tag.textContent ?? '').trim())),
      'legend letters in the published order',
    ).toEqual(['A', 'B', 'C']);

    // --- 3. Playtime (All games): oracle figures and a bucket-bound DOM -------
    await expect(page.getByTestId('playtime-total-sessions'), 'All sessions tile').toHaveText(
      copy.formatNumber(all.sessions),
    );
    await expect(page.getByTestId('playtime-total-hours'), 'All hours tile').toHaveText(
      copy.formatHours(all.seconds),
    );
    await expect(page.getByTestId('playtime-active-days'), 'All active days tile').toHaveText(
      copy.formatNumber(all.days),
    );
    const playtimeCounts = await page.evaluate(() => {
      const block = document.querySelector('[data-testid="playtime"]');
      if (block === null) throw new Error('the Playtime block is not on the page');
      return {
        nodes: block.querySelectorAll('*').length,
        cells: block.querySelectorAll('[data-testid="calendar-cell"]').length,
      };
    });
    const playtimeCeiling =
      playtimeCounts.cells + CHART_OVERHEAD_NODES + PLAYTIME_BLOCK_CHROME_NODES;
    console.log(
      `[10-06] Playtime block: ${playtimeCounts.nodes} nodes, ${playtimeCounts.cells} calendar cells`,
    );
    expect(
      playtimeCounts.nodes,
      `Playtime block nodes (ceiling ${playtimeCeiling} = ${playtimeCounts.cells} cells + overhead)`,
    ).toBeLessThanOrEqual(playtimeCeiling);
    expect(
      playtimeCounts.nodes,
      `Playtime block nodes against the ${all.sessions} sessions it summarises`,
    ).toBeLessThan(all.sessions);

    // --- 4. Vehicles: a windowed table over 7,000 rows ------------------------
    const vehicleCount = Object.values(expected.vehicleCounts).reduce((sum, n) => sum + n, 0);
    await openSection(page, 'vehicles');
    const stats = playerStatsBlock(page);
    await expect(stats, 'Vehicles block').toHaveAttribute('data-state', 'ready', {
      timeout: READY_BUDGET_MS,
    });
    await expect(page.getByTestId('vehicle-table'), 'vehicle aria-rowcount').toHaveAttribute(
      'aria-rowcount',
      String(vehicleCount + 1),
    );
    const vehicleRows = page.getByTestId('vehicle-row');
    const drawnVehicles = await vehicleRows.count();
    expect(drawnVehicles, 'drawn vehicle rows').toBeGreaterThan(0);
    expect(drawnVehicles, `drawn vehicle rows (window ${WINDOW_ROW_BOUND})`).toBeLessThanOrEqual(
      WINDOW_ROW_BOUND,
    );
    const vehicleTags = await vehicleRows
      .locator('td.sticky-first')
      .evaluateAll((cells) =>
        cells.map((cell) => cell.querySelectorAll('[data-testid="account-tag"]').length),
      );
    expect(
      vehicleTags.every((count) => count === 1),
      `every drawn vehicle row has exactly one account tag (${vehicleTags.join(',')})`,
    ).toBe(true);

    // --- 5. Login history: a windowed table over the distinct addresses --------
    await openSection(page, 'login-history');
    await expect(loginHistoryBlock(page), 'Login history block').toHaveAttribute(
      'data-state',
      'ready',
      { timeout: READY_BUDGET_MS },
    );
    expect(
      expected.addresses.length,
      'the generator stays under the address cap',
    ).toBeLessThanOrEqual(MAX_LOGIN_IPS);
    // No pinned Account record row with several accounts: the header row only.
    await expect(page.getByTestId('login-table'), 'login aria-rowcount').toHaveAttribute(
      'aria-rowcount',
      String(expected.addresses.length + 1),
    );
    const loginRows = page.getByTestId('login-row');
    const drawnLogins = await loginRows.count();
    expect(drawnLogins, 'drawn login rows').toBeGreaterThan(0);
    expect(drawnLogins, `drawn login rows (window ${WINDOW_ROW_BOUND})`).toBeLessThanOrEqual(
      WINDOW_ROW_BOUND,
    );
    const loginChips = await loginRows
      .locator('td.sticky-first')
      .evaluateAll((cells) =>
        cells.map((cell) => cell.querySelectorAll('[data-testid="account-tag"]').length),
      );
    expect(
      loginChips.some((count) => count > 1),
      `a drawn login row names several accounts (${loginChips.join(',')})`,
    ).toBe(true);
    expect(
      loginChips.every((count) => count >= 1 && count <= 3),
      `every drawn login row names one to three accounts (${loginChips.join(',')})`,
    ).toBe(true);

    // --- 6. Finance: one bounded chart per charted currency ---------------------
    await openSection(page, 'finance');
    await expect(currencyBlock(page), 'currency block').toHaveAttribute('data-state', 'ready', {
      timeout: READY_BUDGET_MS,
    });
    const charts = await measureCurrencyCard(page);
    expect(charts.charts.length, 'currency chart count (the oracle charts these codes)').toBe(
      currency.charted.length,
    );
    expect(
      charts.charts.map((chart) => chart.code),
      'chart order follows the oracle',
    ).toEqual(currency.charted.map((group) => group.code));
    let allowed = CARD_CHROME_NODES;
    for (const chart of charts.charts) {
      const ceiling = chart.bars * CHART_NODE_MULTIPLE + CHART_NODE_ALLOWANCE;
      allowed += ceiling;
      expect(
        chart.nodes,
        `${chart.code} chart nodes (ceiling ${ceiling} = ${chart.bars} bars x ${CHART_NODE_MULTIPLE} + ${CHART_NODE_ALLOWANCE})`,
      ).toBeLessThanOrEqual(ceiling);
    }
    expect(charts.total, `currency card nodes (ceiling ${allowed})`).toBeLessThanOrEqual(allowed);
    // A currency chart's summary is the oracle's, not the page's own: the first
    // chart says what the three concatenated files total in that code.
    const first = currency.charted[0];
    if (first === undefined) throw new Error('the oracle charted nothing');
    await expect(
      currencyBlock(page).getByTestId('currency-chart').first().locator('p.body'),
      'the first chart sentence is the oracle sum over all three files',
    ).toHaveText(
      copy.formatCurrencySummary(
        {
          inUnits: micro(first.depositedThousandths),
          outUnits: micro(first.withdrawnThousandths),
          ops: first.operations,
          firstMonth: first.firstMonth ?? 0,
          lastMonth: first.lastMonth ?? 0,
        },
        'en-US',
      ),
    );

    // --- 7. Payments: each card's split has at most three rows -------------------
    await openSection(page, 'payments');
    await expect(spendBlock(page), 'spend block').toHaveAttribute('data-state', 'ready', {
      timeout: READY_BUDGET_MS,
    });
    const splits = spendBlock(page).getByTestId('spend-per-account');
    const splitCount = await splits.count();
    expect(splitCount, 'a split on every card with a paid order').toBeGreaterThan(0);
    for (let index = 0; index < splitCount; index += 1) {
      const split = splits.nth(index);
      if ((await split.getAttribute('open')) === null) await split.locator('summary').click();
      const rows = await split.locator('tbody tr').count();
      expect(rows, `split ${index} rows`).toBeGreaterThanOrEqual(1);
      expect(rows, `split ${index} rows (three accounts)`).toBeLessThanOrEqual(3);
    }

    // --- 8. no long task, no request, one worker, no CSP violation ----------------
    await page.waitForTimeout(500);
    const tasks = await readLongTasks(page);
    const worst = tasks.reduce((max, task) => Math.max(max, task.duration), 0);
    expect(
      worst,
      `the longest main-thread task (${tasks.length} long tasks; limit ${LONG_TASK_LIMIT_MS} ms)`,
    ).toBeLessThan(LONG_TASK_LIMIT_MS);

    const afterBaseline = requests.slice(baselineCount);
    expect(afterBaseline, `requests after the baseline: ${afterBaseline.join(', ')}`).toEqual([]);
    expect(workerUrls, 'still exactly one worker').toHaveLength(1);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of [...requests, ...workerUrls]) {
      expect(new URL(url).origin, `origin of ${url}`).toBe(pageOrigin);
    }
    const violations = await readViolations(page);
    expect(violations, `violated CSP directives: ${violations.join(', ')}`).toEqual([]);
  });

  test('the game filter flow narrows Playtime and Vehicles on the large dataset, and still nothing leaves the page', async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    const { expected, all, wot, wotb, wows } = oracles();
    const vehicleCount = Object.values(expected.vehicleCounts).reduce((sum, n) => sum + n, 0);

    /** Click one chip and wait for the three tiles to read the oracle's figures for it. */
    async function chooseGame(
      chip: 'all' | 'wot' | 'wotb' | 'wows',
      figures: { seconds: number; sessions: number; days: number },
    ): Promise<void> {
      await page.getByTestId(`game-filter-chip-${chip}`).click();
      await expect(playtimeBlock(page), `${chip}: Playtime ready`).toHaveAttribute(
        'data-state',
        'ready',
        { timeout: READY_BUDGET_MS },
      );
      await expect(page.getByTestId('playtime-total-sessions'), `${chip} sessions`).toHaveText(
        copy.formatNumber(figures.sessions),
      );
      await expect(page.getByTestId('playtime-total-hours'), `${chip} hours`).toHaveText(
        copy.formatHours(figures.seconds),
      );
      await expect(page.getByTestId('playtime-active-days'), `${chip} active days`).toHaveText(
        copy.formatNumber(figures.days),
      );
      await expect(
        page.getByTestId(`game-filter-chip-${chip}`).locator('input'),
        `the ${chip} chip is the checked one`,
      ).toBeChecked();
    }

    // --- Playtime: each game's figures are its own bitmap's -------------------
    await openSection(page, 'playtime');
    await expect(playtimeBlock(page), 'Playtime ready').toHaveAttribute('data-state', 'ready', {
      timeout: READY_BUDGET_MS,
    });
    expect(wot.sessions, 'WoT generated sessions').toBe(12_000);
    expect(wows.sessions, 'Warships generated sessions').toBe(1_500);
    expect(wotb.sessions, 'WoT Blitz generated sessions').toBe(6_500);
    await chooseGame('wot', wot);
    await chooseGame('wows', wows);
    await chooseGame('wotb', wotb);

    // --- Vehicles follows the shared filter through its Game select ------------
    // The archive has no WoT Blitz vehicle file, so the title is reported as
    // not in the export and no table is drawn.
    await openSection(page, 'vehicles');
    const stats = playerStatsBlock(page);
    await expect(stats, 'Vehicles ready').toHaveAttribute('data-state', 'ready', {
      timeout: READY_BUDGET_MS,
    });
    const select = stats.getByTestId('player-stats-title-selector');
    await expect(select, 'the Game select follows the Blitz chip').toHaveValue('wotb');
    await expect(stats, 'Blitz has no vehicle file').toHaveAttribute(
      'data-title-state',
      'not-in-export',
    );
    await expect(
      stats.getByTestId('player-stats-title-state'),
      'the not-in-export line',
    ).toHaveCount(1);
    await expect(page.getByTestId('vehicle-table'), 'no table for an absent file').toHaveCount(0);

    // Choosing WoT brings the 7,000-row table back, still a bounded window.
    await select.selectOption('wot');
    await expect(page.getByTestId('vehicle-table'), 'vehicle aria-rowcount').toHaveAttribute(
      'aria-rowcount',
      String(vehicleCount + 1),
      { timeout: READY_BUDGET_MS },
    );
    const drawn = await page.getByTestId('vehicle-row').count();
    expect(drawn, 'drawn vehicle rows').toBeGreaterThan(0);
    expect(drawn, `drawn vehicle rows (window ${WINDOW_ROW_BOUND})`).toBeLessThanOrEqual(
      WINDOW_ROW_BOUND,
    );

    // And the chip on Playtime follows the title chosen here (D-21).
    await openSection(page, 'playtime');
    await expect(playtimeBlock(page), 'Playtime ready again').toHaveAttribute(
      'data-state',
      'ready',
      { timeout: READY_BUDGET_MS },
    );
    await expect(
      page.getByTestId('game-filter-chip-wot').locator('input'),
      'the WoT chip is checked after choosing WoT on Vehicles',
    ).toBeChecked();
    await chooseGame('all', all);

    // --- The masking toggle on the shared Login history table -------------------
    await openSection(page, 'login-history');
    await expect(loginHistoryBlock(page), 'Login history ready').toHaveAttribute(
      'data-state',
      'ready',
      { timeout: READY_BUDGET_MS },
    );
    const toggle = page.getByTestId('login-mask-toggle');
    await toggle.click();
    await toggle.click();
    await expect(page.getByTestId('login-row').first(), 'a login row is still drawn').toBeVisible();

    // --- Still nothing left the page, in the whole file's life -------------------
    await page.waitForTimeout(500);
    const afterBaseline = requests.slice(baselineCount);
    expect(afterBaseline, `requests after the baseline: ${afterBaseline.join(', ')}`).toEqual([]);
    expect(workerUrls, 'still exactly one worker').toHaveLength(1);
    const violations = await readViolations(page);
    expect(violations, `violated CSP directives: ${violations.join(', ')}`).toEqual([]);
    const tasks = await readLongTasks(page);
    const worst = tasks.reduce((max, task) => Math.max(max, task.duration), 0);
    expect(
      worst,
      `the longest main-thread task over the whole file (${tasks.length} long tasks; limit ${LONG_TASK_LIMIT_MS} ms)`,
    ).toBeLessThan(LONG_TASK_LIMIT_MS);
  });
});
