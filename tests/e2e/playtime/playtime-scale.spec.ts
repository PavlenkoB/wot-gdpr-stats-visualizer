import '../_support/pin-locale';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { openSection } from '../_support/helpers.ts';
import {
  DURATION_BIN_COUNT,
  HOUR_CELL_COUNT,
  HOUR_GRID_BASIS,
} from '../../../src/lib/features/playtime/playtime-shared.ts';
import { formatExcludedPill, formatHoursParts, formatNumber } from '../../../src/lib/ui-copy.ts';
import {
  SCALE_5K_SPEC,
  SCALE_60K_SPEC,
  buildSessionsExport,
  type SessionsExpected,
} from '../../fixtures/sessions-fixtures.ts';

// =============================================================================
// Phase 04, plan 04-12 — the SCALE criterion, in a real browser
// =============================================================================
//
// WHY A BROWSER SPEC
// ROADMAP.md phase 4 success criterion 5 is two claims, and only one of them
// is about arithmetic. "Every activity chart RENDERS without freezing the
// tab" is a claim about the page: how long the import takes end to end, how
// many DOM nodes the charts end up holding, and whether any single main-thread
// task runs long enough for the user to notice. `tests/unit/playtime/playtime-scale.test.ts`
// proves the numbers and the aggregation time in Node; nothing in Node can
// prove that 4,748 calendar cells do not cost a second of layout, or that
// switching a split value does not block the main thread.
//
// WHY THE EXPECTATIONS ARE THE FIXTURE'S ANALYTIC KEY
// `SCALE_60K_SPEC.expected` and `SCALE_5K_SPEC.expected` are closed-form
// arithmetic over each fixture's own layout, computed without calling the
// aggregator (see `tests/fixtures/sessions-fixtures.ts`). Every number below
// is read from one of those keys or from a named module constant. Nothing is
// read back out of the page and compared with itself: a spec that read all
// 4,748 cells and asserted they agreed with each other would pass against a
// grid that is wrong in every cell, which is exactly the mistake 04-10 found
// in the calendar's earlier coverage.
//
// D-01: dates and hours are bucketed exactly as recorded, never converted.
// D-02: excluded rows are counted, and merged seconds are overlap-aware.
// D-03: a selector change re-reads the STORED per-value slice — no re-import,
//       no re-aggregation, which is why the sweep is allowed to be fast.
// D-05: twelve duration bins whose counts sum to the Sessions tile.
// D-06: the three tiles, at the size where a rounding error would show.
//
// THE CI BUDGET RULE (plan 04-13 derives its timeouts from this)
// The 60,000-session export is imported into the browser EXACTLY ONCE in the
// whole suite. A serial describe owns one context and one page; the other four
// tests read the same rendered DOM. The node-count comparison imports only the
// 5,000-session preset, in a SECOND context (a fresh context has its own
// IndexedDB, so the two datasets cannot collide), and the zero-network guard
// extension in `zero-network.spec.ts` uses the 5,000-session preset too. Three
// 60,000-session imports would multiply this file's cost threefold to prove
// nothing new: the property being asserted does not depend on data size.
//
// A serial describe is the honest way to express that. Its cost is that a
// failure in test 1 skips tests 2 to 5, so each test's own report has to carry
// the diagnosis — which is why every assertion below names the key it compared
// against, and why the module-level `importToReadyMs` is reported even when a
// later test fails.
// =============================================================================

/** How long the 60,000-session import may take from submission to `ready`. */
const READY_BUDGET_MS = 60_000;

/** How long a single selector change may take to return the block to `ready`. */
const SELECTOR_BUDGET_MS = 5_000;

/** How long a return visit (reload, no re-import) may take to reach `ready`. */
const RETURN_VISIT_BUDGET_MS = 15_000;

/**
 * The long-task ceiling, in milliseconds.
 *
 * The same 1,000 ms the 20,000-entry import spec uses, for the same reason:
 * a `postMessage` structured-clone of a multi-megabyte `File` can legitimately
 * spend a few hundred milliseconds on the main thread on a slow CI runner, so
 * a tighter budget would measure the runner rather than the app.
 */
const LONG_TASK_LIMIT_MS = 1_000;

/**
 * Allowed difference between the 5,000- and 60,000-session node totals.
 *
 * The ONLY nodes allowed to differ are the two legends' level swatches: the
 * calendar's rank scale collapses duplicate levels differently when the
 * distribution changes, so a five-swatch legend can be four swatches on one
 * preset and five on the other. Five nodes per legend, two legends.
 */
const NODE_COUNT_SLACK = 24;

/**
 * Fixed node cost of everything that is not a cell: year heads and their
 * captions, weekday row groups, month labels, the hour grid's axes, the
 * duration list's bars and labels, the legends, and the shared tooltip.
 *
 * MEASURED, not guessed. Plan 04-12 says to set this to the measured overhead
 * plus 100 and to record the measurement, and to keep the 60,000-session total
 * under the calendar-cell count plus 1,500. The measured overhead is 657
 * (5,405 nodes over 4,748 cells) for the 60,000-session preset and 655
 * (5,403 over 4,748) for the 5,000-session one, so this is 757 — which leaves
 * the ceiling at 5,505, comfortably inside the plan's 6,248 and still tight
 * enough that a chart growing a node per session would fail by three orders of
 * magnitude rather than squeaking under.
 */
const CHART_OVERHEAD_NODES = 757;

/** `beforeAll` ceiling for building and importing the 60,000-session export. */
const SCALE_BEFORE_ALL_TIMEOUT_MS = 180_000;

/** Per-test ceiling. The two tests that import pay for their own context. */
const SCALE_TEST_TIMEOUT_MS = 120_000;

// -----------------------------------------------------------------------------
// The exports, built lazily
// -----------------------------------------------------------------------------

/**
 * Wrap a builder so it runs at most once, on first call.
 *
 * Two reasons for the laziness. `playwright test --list` LOADS every spec file
 * without running a test, and building the 60,000-session export at module
 * scope would make listing the suite pay several seconds for bytes nothing
 * reads. And the CI budget rule above is only true because each preset has
 * exactly one construction site, which `grep` can check: a second one in this
 * file would be a second 60,000-session import's worth of time.
 */
function memoised<T>(build: () => T): () => T {
  let built: { value: T } | null = null;
  return () => {
    if (built === null) built = { value: build() };
    return built.value;
  };
}

/** The 60,000-session export: built once, imported once (see the budget rule). */
const largeExport = memoised(() => buildSessionsExport(SCALE_60K_SPEC));

/** The 5,000-session export, for the node-count comparison. */
const smallExport = memoised(() => buildSessionsExport(SCALE_5K_SPEC));

// -----------------------------------------------------------------------------
// The page-side helpers
// -----------------------------------------------------------------------------

/** What one `page.evaluate` over the charts container returns. */
interface NodeCounts {
  /** Every descendant of the charts container. */
  total: number;
  /**
   * The `<svg>` roots themselves plus every descendant of one. Counting the
   * roots too keeps the number stable if the markup ever moves an axis or a
   * legend swatch out of its own `<svg>`.
   */
  inSvg: number;
  calendarCells: number;
  hourCells: number;
  durationBins: number;
}

/** One recorded main-thread long task, in milliseconds. */
interface LongTask {
  startTime: number;
  duration: number;
}

/**
 * Register the observers BEFORE any app script runs.
 *
 * `addInitScript` is the only way to see the first long task: a script that
 * installs an observer after `page.goto` has already missed the parse, the
 * worker handshake and the module evaluation. Two things are recorded:
 *
 * 1. `longtask` entries, which is how "does not freeze the tab" is turned into
 *    a number. An unsupported entry type leaves the array empty, which the
 *    assertions treat as pass-equivalent — the same choice
 *    `tests/e2e/import/import-flow.spec.ts` makes, and the same reason: the spec is
 *    Chrome-first and a missing API is not a product defect.
 * 2. `securitypolicyviolation` events, pushing ONLY the violated directive's
 *    name. Never the blocked address and never row content: this is the
 *    instrument that proves nothing left the machine, so it must not itself
 *    be the thing that copies data out. A blocked `connect-src` and a blocked
 *    inline `style` both show up here, which is why the directive name and
 *    not just a count is recorded.
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
      // 'longtask' is unsupported here; the array stays empty and the
      // long-task assertions treat that as pass-equivalent.
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

/**
 * Forget every long task recorded so far.
 *
 * A resetter rather than a fixed-duration sleep, so the buffer can be cleared
 * at an exact moment — right after the page has settled and before the
 * interaction under test — without guessing how long to wait.
 */
function resetLongTasks(page: Page): Promise<void> {
  return page.evaluate(() => {
    (window as unknown as { __longTasks: unknown[] }).__longTasks = [];
  });
}

/** The violated CSP directive names recorded so far. */
function readCspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);
}

/**
 * Count the page's requests and its workers, from the moment they exist.
 *
 * Requests are counted on the CONTEXT and workers on the PAGE, which is the
 * split Playwright's own types force: `BrowserContext` has a `request` event
 * but no `worker` event, because a worker belongs to the page that spawned it.
 * Listening on the context also means a request made by a sub-frame or a
 * worker would be caught, not just the top document's.
 */
function recordTraffic(
  context: BrowserContext,
  page: Page,
): {
  requests: string[];
  workers: string[];
} {
  const requests: string[] = [];
  const workers: string[] = [];
  context.on('request', (request) => requests.push(request.url()));
  page.on('worker', (worker) => workers.push(worker.url()));
  return { requests, workers };
}

/**
 * One page evaluate that measures everything the node-count claim needs.
 *
 * ONE round trip on purpose: the four charts must be measured at the same
 * instant, and four separate evaluates could straddle a re-render and report
 * numbers from two different DOMs.
 */
function measureCharts(page: Page): Promise<NodeCounts> {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="playtime-charts"]');
    if (container === null)
      throw new Error('measureCharts: the charts container is not on the page');
    return {
      total: container.querySelectorAll('*').length,
      inSvg: container.querySelectorAll('svg, svg *').length,
      calendarCells: container.querySelectorAll('[data-testid="calendar-cell"]').length,
      hourCells: container.querySelectorAll('[data-testid="hour-cell"]').length,
      durationBins: container.querySelectorAll('[data-testid="duration-bin"]').length,
    };
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
 * Wait for an import to land, with a ceiling the caller sets.
 *
 * The same two signals as `waitForImported` in `_support/helpers.ts` (the
 * identity header leaving its `skeleton` variant, then the processing notice
 * being gone), but with the caller's budget instead of that helper's fixed
 * 30 s: the 60,000-session import is allowed `READY_BUDGET_MS`, so a 30 s
 * ceiling on the import wait would fail the spec before the budget it exists to
 * measure was reached.
 */
async function waitForImportLanded(page: Page, budgetMs: number): Promise<void> {
  await expect(page.getByTestId('identity-header')).not.toHaveAttribute(
    'data-variant',
    'skeleton',
    { timeout: budgetMs },
  );
  await expect(page.getByTestId('processing-status')).toHaveCount(0, { timeout: budgetMs });
}

/**
 * Import an export, open the Playtime pane and wait for the block to reach
 * `ready`.
 *
 * `data-state` on the block is the single signal: it is set in every state, so
 * a wait on it cannot silently pass on a page that never rendered the charts.
 * The import lands on Overview, where the Playtime block is not mounted, so the
 * import is awaited first (a click on a muted row before the dataset stamp
 * arrives would be discarded) and the pane is opened before the block is
 * awaited. Returns the milliseconds from submission to `ready`, measured from
 * the same start point as before, which is the number the CI budget in plan
 * 04-13 is derived from.
 */
async function importAndAwaitReady(
  page: Page,
  bytes: Uint8Array,
  budgetMs: number,
): Promise<number> {
  const started = Date.now();
  await page.getByTestId('file-input').setInputFiles({
    name: 'scale-export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
  await waitForImportLanded(page, budgetMs);
  await openSection(page, 'playtime');
  await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
    timeout: budgetMs,
  });
  await expect(page.getByTestId('playtime-charts')).toBeVisible();
  return Date.now() - started;
}

/** The text of the three totals tiles, as the reader sees them. */
async function readTiles(page: Page): Promise<{ hours: string; sessions: string; days: string }> {
  return {
    hours: ((await page.getByTestId('playtime-total-hours').innerText()) ?? '').replace(
      /\s+/g,
      ' ',
    ),
    sessions: ((await page.getByTestId('playtime-total-sessions').innerText()) ?? '').trim(),
    days: ((await page.getByTestId('playtime-active-days').innerText()) ?? '').trim(),
  };
}

// =============================================================================
// The one serial describe: a single 60,000-session import, five claims
// =============================================================================

/** Measured on the shared page by test 1, compared by test 2. */
let largeCounts: NodeCounts | null = null;

/** Measured by test 1 and reported, whether or not every later test runs. */
let importToReadyMs = 0;

test.describe.configure({ mode: 'serial' });

test.describe('04-12 scale: 60,000 sessions in a real browser', () => {
  let context: BrowserContext;
  let page: Page;
  let traffic: { requests: string[]; workers: string[] };
  let baselineRequests = 0;
  let expected: SessionsExpected;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    test.setTimeout(SCALE_BEFORE_ALL_TIMEOUT_MS);
    const large = largeExport();
    expected = large.expected;

    context = await browser.newContext();
    page = await context.newPage();
    traffic = recordTraffic(context, page);
    await installObservers(page);

    await gotoApp(page);
    // Idle before the baseline is taken, so the eager worker script fetch and
    // the module graph are inside it and the import is not counted as a
    // request the app made after load.
    await page.waitForLoadState('networkidle');
    baselineRequests = traffic.requests.length;
    await resetLongTasks(page);

    importToReadyMs = await importAndAwaitReady(page, large.bytes, READY_BUDGET_MS);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('(1) a 60,000-session export renders every chart equal to the analytic key and never freezes the tab', async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    expect(
      importToReadyMs,
      `60,000 sessions reached ready in ${importToReadyMs} ms (budget ${READY_BUDGET_MS} ms)`,
    ).toBeLessThan(READY_BUDGET_MS);

    await test.step('totals tiles read the key (D-06)', async () => {
      await expect(page.getByTestId('playtime-total-sessions')).toHaveText(
        formatNumber(expected.sessions),
      );
      const hours = formatHoursParts(expected.seconds);
      // The hours tile is two separately styled spans, a numeral and a unit,
      // so both parts are asserted rather than the concatenation.
      await expect(page.getByTestId('playtime-total-hours')).toContainText(hours.value);
      await expect(page.getByTestId('playtime-total-hours')).toContainText(hours.unit);
      await expect(page.getByTestId('playtime-active-days')).toHaveText(
        formatNumber(expected.activeDays.length),
      );
      // D-02: the excluded rows are on screen, not silently dropped.
      await expect(page.getByTestId('playtime-excluded')).toContainText(
        formatExcludedPill(expected.excluded),
      );
    });

    await test.step('every calendar cell equals the key, by day, seconds and sessions (ACTIVITY-02)', async () => {
      const byDay = new Map(expected.dayIndex.map((day, index) => [day, index]));
      const mismatches = await page.getByTestId('calendar-cell').evaluateAll(
        (nodes, index) => {
          // The key travels as a plain array of [day, seconds, sessions]
          // triples so the page never has to know the fixture's shape.
          const key = index as unknown as [number, number, number][];
          const lookup = new Map(
            key.map(([day, seconds, sessions]) => [day, { seconds, sessions }]),
          );
          const found: string[] = [];
          for (const node of nodes) {
            const cell = node as SVGElement;
            const day = Number(cell.dataset.day);
            const want = lookup.get(day);
            const seconds = Number(cell.dataset.seconds);
            const sessions = Number(cell.dataset.sessions);
            const level = Number(cell.dataset.level);
            if (want === undefined) {
              // A day outside the key's active days must be drawn as empty.
              if (seconds !== 0 || sessions !== 0 || level !== 0) {
                found.push(
                  `day ${day} is not in the key and is not empty (${seconds}s, level ${level})`,
                );
              }
              continue;
            }
            if (seconds !== want.seconds)
              found.push(`day ${day}: ${seconds}s, key says ${want.seconds}s`);
            if (sessions !== want.sessions) {
              found.push(`day ${day}: ${sessions} sessions, key says ${want.sessions}`);
            }
            // The rank scale's contract: zero is level 0 and nothing else is.
            if ((seconds === 0) !== (level === 0)) {
              found.push(`day ${day}: ${seconds}s at level ${level}`);
            }
          }
          return found;
        },
        [...byDay].map(([day, index]) => [
          day,
          expected.daySeconds[index]!,
          expected.daySessions[index]!,
        ]),
      );

      expect(
        mismatches,
        `calendar cells disagreeing with the key:\n${mismatches.join('\n')}`,
      ).toEqual([]);
    });

    await test.step('the 168 hour cells equal the key on the rendered basis (ACTIVITY-03)', async () => {
      const cells = await page.getByTestId('hour-cell').evaluateAll((nodes) =>
        nodes.map((node) => {
          const cell = node as SVGElement;
          return {
            index: Number(cell.dataset.index),
            seconds: Number(cell.dataset.seconds),
            level: Number(cell.dataset.level),
          };
        }),
      );
      expect(cells).toHaveLength(HOUR_CELL_COUNT);
      const key = HOUR_GRID_BASIS === 'overlap' ? expected.hourOverlap : expected.hourStart;
      let sum = 0;
      for (const cell of cells) {
        expect(cell.seconds, `hour cell ${cell.index}`).toBe(key[cell.index]);
        expect((cell.seconds === 0) === (cell.level === 0), `hour cell ${cell.index} level`).toBe(
          true,
        );
        sum += cell.seconds;
      }
      // Both grids are the same merged seconds under two attributions, so the
      // rendered one must reconcile with the total the Sessions tile shows.
      expect(sum).toBe(expected.seconds);
    });

    await test.step('the twelve duration bins equal the key and account for every session (ACTIVITY-04)', async () => {
      const counts = await page
        .getByTestId('duration-bin')
        .evaluateAll((nodes) => nodes.map((node) => Number((node as HTMLElement).dataset.count)));
      expect(counts).toHaveLength(DURATION_BIN_COUNT);
      expect(counts).toEqual(expected.bins);
      expect(
        counts.reduce((total, count) => total + count, 0),
        'the bins must sum to the Sessions tile',
      ).toBe(expected.sessions);
    });

    await test.step('no interaction produced a long task (the "no freeze" half of criterion 5)', async () => {
      await resetLongTasks(page);
      await page.getByTestId('hour-cell').nth(20).hover();
      await page.getByTestId('calendar-cell').first().focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('PageDown');
      await page.keyboard.press('Escape');

      // Every task, not just the longest: the claim is that the page stays
      // responsive throughout the sequence, and a run of 600 ms tasks is just
      // as unresponsive as one 1,000 ms task.
      const longTasks = await readLongTasks(page);
      const overLimit = longTasks.filter((task) => task.duration >= LONG_TASK_LIMIT_MS);
      expect(
        overLimit.map((task) => `${task.duration.toFixed(0)} ms at ${task.startTime.toFixed(0)}`),
        `long tasks of ${LONG_TASK_LIMIT_MS} ms or more during chart interaction`,
      ).toEqual([]);
    });

    largeCounts = await measureCharts(page);
  });

  test('(2) node counts follow buckets, not sessions: 12x the sessions, the same DOM', async ({
    browser,
  }) => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    const small = smallExport();

    // The 5,000-session preset in its OWN context, so it gets its own
    // IndexedDB and cannot be answered from the 60,000-session dataset's
    // stored aggregate. This is the only second import in the file, and it is
    // the cheap one.
    const smallContext = await browser.newContext();
    const smallPage = await smallContext.newPage();
    let smallCounts: NodeCounts;
    try {
      await gotoApp(smallPage);
      await importAndAwaitReady(smallPage, small.bytes, READY_BUDGET_MS);
      smallCounts = await measureCharts(smallPage);
    } finally {
      await smallContext.close();
    }

    expect(largeCounts, 'test 1 must have measured the 60,000-session charts').not.toBeNull();
    const large = largeCounts!;

    // Each size draws the same buckets: the days in the active years, 168
    // hours and 12 bins. This is the criterion, stated in counts.
    for (const [label, counts, key] of [
      ['5,000 sessions', smallCounts, small.expected],
      ['60,000 sessions', large, expected],
    ] as const) {
      expect(counts.calendarCells, `${label} calendar cells`).toBe(key.calendarCells);
      expect(counts.hourCells, `${label} hour cells`).toBe(HOUR_CELL_COUNT);
      expect(counts.durationBins, `${label} duration bins`).toBe(DURATION_BIN_COUNT);
      expect(
        counts.total,
        `${label} total node count (ceiling ${key.calendarCells + CHART_OVERHEAD_NODES})`,
      ).toBeLessThanOrEqual(key.calendarCells + CHART_OVERHEAD_NODES);
    }

    // THE scale claim: 12x the sessions, the same number of calendar cells and
    // the same DOM within the legend slack. A ratio of 12 on either total
    // would mean one node per session, which is what this whole phase exists
    // to prevent.
    expect(expected.sessions).toBeGreaterThan(small.expected.sessions * 10);
    expect(large.calendarCells).toBe(smallCounts.calendarCells);
    expect(
      Math.abs(large.total - smallCounts.total),
      `total node counts: ${large.total} (60k) vs ${smallCounts.total} (5k)`,
    ).toBeLessThanOrEqual(NODE_COUNT_SLACK);
    expect(
      Math.abs(large.inSvg - smallCounts.inSvg),
      `svg node counts: ${large.inSvg} (60k) vs ${smallCounts.inSvg} (5k)`,
    ).toBeLessThanOrEqual(NODE_COUNT_SLACK);
  });

  test('(3) a selector sweep over every split value stays fast and matches the key (D-03)', async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    const selector = page.getByTestId('playtime-selector');
    // Option zero is All; the rest are the stored values in the order the
    // worker returned them.
    const optionCount = (await selector.locator('option').all()).length;
    expect(optionCount, 'All plus one option per stored split value').toBe(
      expected.values.length + 1,
    );

    await resetLongTasks(page);

    for (let index = 0; index < optionCount; index += 1) {
      const valueIndex = index - 1;
      const wantSeconds = valueIndex === -1 ? expected.seconds : expected.valueSeconds[valueIndex]!;
      const wantSessions =
        valueIndex === -1 ? expected.sessions : expected.valueSessions[valueIndex]!;

      await selector.selectOption({ index });
      // The block passes through `updating` and comes back to `ready`. A
      // budget on the RETURN is the claim: a slice this size must not need to
      // be re-aggregated to change the chart.
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
        timeout: SELECTOR_BUDGET_MS,
      });
      await expect(page.getByTestId('playtime-total-sessions')).toHaveText(
        formatNumber(wantSessions),
      );
      const hours = formatHoursParts(wantSeconds);
      await expect(page.getByTestId('playtime-total-hours')).toContainText(hours.value);
      await expect(page.getByTestId('playtime-total-hours')).toContainText(hours.unit);
      const cells = await page.getByTestId('calendar-cell').count();
      expect(cells, `calendar cells under option ${index}`).toBeLessThanOrEqual(
        expected.calendarCells,
      );
    }

    // Back to All, and the sweep as a whole stayed responsive.
    await selector.selectOption({ index: 0 });
    await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
      timeout: SELECTOR_BUDGET_MS,
    });
    const overLimit = (await readLongTasks(page)).filter(
      (task) => task.duration >= LONG_TASK_LIMIT_MS,
    );
    expect(
      overLimit.map((task) => `${task.duration.toFixed(0)} ms`),
      `long tasks of ${LONG_TASK_LIMIT_MS} ms or more during the ${optionCount}-option sweep`,
    ).toEqual([]);
  });

  test('(4) the large flow stayed inside the page: no request, no second worker, no CSP violation (T-04-21)', async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    // Everything since the baseline: the 60,000-session import, every selector
    // value, and the hover and keyboard interaction on the charts.
    const afterBaseline = traffic.requests.slice(baselineRequests);
    expect(
      afterBaseline,
      `requests made after the page settled: ${afterBaseline.join(', ')}`,
    ).toEqual([]);

    // ONE long-lived worker, spawned eagerly at module init. A second worker
    // would be a second script fetch, which the request assertion above would
    // also catch — but naming it here makes the failure readable.
    expect(traffic.workers, 'exactly one worker, the single long-lived ingest worker').toHaveLength(
      1,
    );

    const origin = new URL(page.url()).origin;
    for (const url of traffic.requests) {
      expect(new URL(url).origin, `request origin: ${url}`).toBe(origin);
    }
    for (const url of traffic.workers) {
      expect(new URL(url).origin, `worker origin: ${url}`).toBe(origin);
    }

    // A blocked `connect-src` and a CSP-blocked inline style BOTH surface here,
    // so an empty array is the whole zero-network guarantee over the large
    // flow, not just its request half.
    const violations = await readCspViolations(page);
    expect(violations, `violated CSP directives: ${violations.join(', ')}`).toEqual([]);
  });

  test('(5) a return visit reads the stored aggregates: same tiles, no re-import (D-03)', async () => {
    test.setTimeout(SCALE_TEST_TIMEOUT_MS);
    const before = await readTiles(page);

    // A reload, not a fresh context: the whole point is that the DATASET
    // survives in IndexedDB, so the second context would prove nothing.
    await page.reload();
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    // The reload lands on Overview, where the Playtime block is not mounted:
    // wait for the cached dataset, then open the pane, inside the measured
    // return visit so the budget still covers submission-free load to ready.
    const started = Date.now();
    await waitForImportLanded(page, RETURN_VISIT_BUDGET_MS);
    await openSection(page, 'playtime');
    await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
      timeout: RETURN_VISIT_BUDGET_MS,
    });
    const returnVisitMs = Date.now() - started;
    expect(
      returnVisitMs,
      `the return visit reached ready in ${returnVisitMs} ms (budget ${RETURN_VISIT_BUDGET_MS} ms)`,
    ).toBeLessThan(RETURN_VISIT_BUDGET_MS);

    // No file was chosen, so the numbers can only have come off the stored
    // aggregate: an import is not reachable from a page with no input.
    expect(await readTiles(page)).toEqual(before);
    expect(await page.getByTestId('calendar-cell').count()).toBe(expected.calendarCells);

    // It runs last because the reload resets the page-level traffic counters
    // that test 4 reads.
  });
});
