import './pin-locale';
import { expect, test } from '@playwright/test';
import {
  EXTRA_UNKNOWN_FOLDER,
  LARGE_EXPORT_FILES_PER_CATEGORY,
  RENAMED_ACCOUNT_ROOT,
  SAMPLE_ACCOUNT_ROOT,
  SAMPLE_BADGE_ORDER,
  SAMPLE_EXPECTED_COUNTS,
  SAMPLE_FILE_COUNTS,
  SAMPLE_NICKNAME,
  SAMPLE_ROW_COUNTS,
  buildLargeExport,
  buildNotAZipBytes,
  buildRenamedRootExport,
  buildSampleExport,
  buildTruncatedExport,
} from '../fixtures/export-fixtures.ts';
import { formatAccountId, formatImportSummary } from '../../src/lib/ui-copy.ts';
import { dropFiles, importLine, pickExportFromDisk } from './helpers.ts';

// =============================================================================
// IMPORT-02 / PLATFORM-02 — success-path slice against the dashboard (03-07)
// =============================================================================
//
// What this file proves end to end:
//   - While a file is processing, the import bar's notice slot shows a
//     spinner and STAGE_TEXT-driven text (D-26), and the dropzone is
//     disabled and busy (D-08, D-10).
//   - On success the bar goes slim, the identity header shows the raw
//     account root, the five supported sections appear in D-02 order with
//     a `section-summary` built by `formatImportSummary`, and the four
//     unsupported folders become `unsupported-banner` cards in worker
//     order (D-01, D-02, D-03, D-11, D-12, D-13).
//   - Exactly one dropzone exists in BOTH layouts — the co-render that
//     makes replace-on-drop reachable survives the Phase 3 redesign.
//   - Start over confirms before it clears (D-15, D-16).
//   - A file dropped on `main` is ignored (D-13).
//   - Across an entire multi-upload session, exactly one worker is
//     spawned and zero network requests occur after the baseline
//     (PLATFORM-02; session-wide half of success criterion 4).
//   - At 20,000 entries, no main-thread long task of 1000 ms or more
//     occurs between submission and the dashboard (success criterion 3).
//   - No value from inside the export's files is rendered (the
//     synthetic email / IP strings never appear in the page body).
//
// Every expectation is computed from the same fixtures and formatters the
// app uses, so a future refactor that breaks one half breaks both halves
// at once. The Phase 2 hooks (the results wrapper, the account heading,
// the summary line and the per-category badges) are all gone from this
// file: the assertions below point at the hooks Plans 03-04 to 03-06
// actually shipped. Nothing was dropped — each one moved.
// =============================================================================

/**
 * Every stage text the notice slot may show while an import is busy.
 *
 * The five sequential stages, PLUS the per-category progress string the
 * worker posts while it parses (D-11, `formatParsingProgress` in
 * `ui-copy.ts`, asserted in its own right by the 10x-scale test in
 * `persistent-dataset.spec.ts`).
 *
 * The per-category form was added to this list by 05-06, and the reason is
 * worth keeping: the snapshot below is deliberately atomic, and the sample
 * used to be small enough that it always landed on one of the five coarse
 * stages. Growing the sample to the real 29 files means it can equally land
 * on `Parsing Player_statistics (1/9)...` — which is still a processing
 * stage, still the right text, and was simply missing from the allow-list.
 * Without it the test reported a product regression for a stage the product
 * is documented to emit.
 */
const STAGE_PATTERN =
  /^\s*(Checking for a duplicate\.\.\.|Unzipping\.\.\.|Classifying folders\.\.\.|Parsing categories\.\.\.|Saving to local storage\.\.\.|Parsing \S+ \(\d+\/\d+\)\.\.\.)\s*$/;

/**
 * The five supported sections in D-02 order, paired with the fixture
 * folder each one counts. This is the order the DOM must present, and it
 * is NOT `SAMPLE_BADGE_ORDER` (that constant is the worker's
 * status-grouped order, still asserted below for the banners).
 */
const SUPPORTED_SECTIONS = [
  { id: 'activity-history', folder: 'Activity_history' },
  { id: 'player-statistics', folder: 'Player_statistics' },
  { id: 'financial-data', folder: 'Financial_data' },
  { id: 'payment-history', folder: 'Payment_history' },
  { id: 'user-info', folder: 'User_Info' },
] as const;

/**
 * Where the supported group ENDS inside `SAMPLE_BADGE_ORDER`, i.e. the
 * first non-supported entry.
 *
 * DERIVED, never a literal: `SAMPLE_BADGE_ORDER` is the worker's
 * status-grouped order, so the supported group is always a prefix and the
 * unsupported banners are always whatever follows it. 05-03 added
 * `Financial_data` as a fifth supported category, which moved this boundary
 * from 4 to 5 — and a hardcoded index would have silently compared the wrong
 * folder against the wrong `data-status`, which reads as a passing test
 * until the fixture changes again.
 */
const UNSUPPORTED_START = SAMPLE_EXPECTED_COUNTS.supported;

/**
 * The four unsupported folders, in the order the worker reports them, with
 * the status each banner carries. Built from the badge order by slicing off
 * the supported prefix rather than by indexing literal offsets.
 */
const UNSUPPORTED_BANNERS = SAMPLE_BADGE_ORDER.slice(UNSUPPORTED_START).map((folder, index) => ({
  folder,
  // The worker emits known-deferred first, then unknown — so within the
  // unsupported suffix the tiers are still grouped, and the boundary lands
  // where SAMPLE_EXPECTED_COUNTS says the other two live.
  status: index < SAMPLE_EXPECTED_COUNTS['known-deferred'] ? 'known-deferred' : 'unknown',
})) as readonly { folder: string; status: string }[];

// -----------------------------------------------------------------------------
// Page setup — wait for worker ready
// -----------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
});

/** The bar is slim once a dataset is loaded, full on the skeleton. */
async function expectSlimBar(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim', {
    timeout: 30_000,
  });
}

// -----------------------------------------------------------------------------
// (a) Processing feedback while busy, then the dashboard
// -----------------------------------------------------------------------------

test('(a) shows stage feedback while busy, then account, summary and grouped badges (and a co-rendered dropzone for replace-on-drop) when done', async ({
  page,
}) => {
  const sample = Array.from(buildSampleExport());

  // Kick off the upload via the file input. The processing paragraph
  // appears synchronously in the same tick that submitFiles() runs.
  await page.getByTestId('file-input').setInputFiles({
    name: 'sample-export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(sample),
  });

  const processing = page.getByTestId('processing-status');

  // D-08 + D-10 + D-26: the dropzone is busy and the notice slot carries
  // the spinner and the stage text. Snap the busy-state in a single DOM
  // read: the four sequential `toHaveAttribute` polls below used to race
  // the state transition to 'done' on fast CI runners (sample export is
  // small enough that processing completes in well under the 5 s poll
  // window). One evaluate is atomic relative to the App's render cycle.
  const busySnapshot = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="dropzone"]');
    if (!el) return null;
    const slotEl = document.querySelector<HTMLElement>('[data-testid="notice-slot"]');
    const processingEl = slotEl?.querySelector<HTMLElement>('[data-testid="processing-status"]');
    const spinnerEl = processingEl?.querySelector<HTMLElement>('[data-testid="spinner"]');
    return {
      ariaDisabled: el.getAttribute('aria-disabled'),
      ariaBusy: el.getAttribute('aria-busy'),
      // D-26: both the status and the spinner live INSIDE the notice slot.
      processingInSlot: processingEl !== null && processingEl !== null,
      spinnerVisible: spinnerEl !== null,
      processingText: processingEl?.textContent?.trim() ?? null,
    };
  });
  expect(
    busySnapshot,
    'dropzone was already gone — state transitioned to done before busy-state could be captured',
  ).not.toBeNull();
  expect(busySnapshot!.ariaDisabled).toBe('true');
  expect(busySnapshot!.ariaBusy).toBe('true');
  expect(busySnapshot!.processingInSlot).toBe(true);
  expect(busySnapshot!.spinnerVisible).toBe(true);
  expect(busySnapshot!.processingText).toMatch(STAGE_PATTERN);

  // File input is disabled while processing.
  await expect(page.getByTestId('file-input')).toBeDisabled();

  // The bar goes slim and the dataset is displayed.
  await expectSlimBar(page);

  // The dropzone is co-rendered in the slim layout (NOT swapped out) —
  // this is the 02-04 contract that makes D-13 replace-on-drop
  // reachable: a drop on the co-rendered dropzone in the 'done' state
  // lands on submitFiles() → confirm-pending → ConfirmPanel with
  // REPLACE_DATASET_LABEL. Asserting count 1 here is the regression guard
  // against a future refactor silently dropping the co-render and
  // re-breaking D-13. D-24/D-25: exactly one dropzone in both variants.
  await expect(page.getByTestId('dropzone')).toHaveCount(1);
  await expect(processing).toHaveCount(0);

  // Identity header — D-11/D-13: the raw root, on the account-ID line.
  await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'loaded');
  await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
  await expect(page.getByTestId('identity-account-id')).toHaveText(
    formatAccountId(SAMPLE_ACCOUNT_ROOT),
  );

  // The five supported sections, in D-02 order, each with the summary
  // built by the SAME formatter the component uses.
  for (const [index, section] of SUPPORTED_SECTIONS.entries()) {
    const card = page.getByTestId(`dashboard-section-${section.id}`);
    await expect(card).toHaveCount(1);
    const fileCount = SAMPLE_FILE_COUNTS[section.folder]!;
    const rowCount = SAMPLE_ROW_COUNTS[section.folder]!;
    // Two sections are `ready` — Activity_history since 04-02 and
    // Financial_data since 05-10 — and show these counts as their caption; the
    // other three are `pending` and show them as their body. `importLine`
    // reads whichever element this card renders, so the assertion is about the
    // counts rather than about which of the two the card chose.
    await expect(importLine(card)).toHaveText(formatImportSummary(fileCount, rowCount));
    // DOM order is the D-02 contract, not the worker's grouping.
    if (index > 0) {
      const previousId = SUPPORTED_SECTIONS[index - 1]!.id;
      const previousBox = await page.getByTestId(`dashboard-section-${previousId}`).boundingBox();
      const box = await card.boundingBox();
      expect(previousBox).not.toBeNull();
      expect(box).not.toBeNull();
      expect(previousBox!.y).toBeLessThan(box!.y);
    }
  }

  // Four unsupported banners in worker order (the suffix of
  // SAMPLE_BADGE_ORDER after the supported group), with the status each
  // carries and its counts line.
  const banners = page.getByTestId('unsupported-banner');
  await expect(banners).toHaveCount(UNSUPPORTED_BANNERS.length);
  for (const [index, expected] of UNSUPPORTED_BANNERS.entries()) {
    const banner = banners.nth(index);
    await expect(banner).toHaveAttribute('data-status', expected.status);
    await expect(banner.getByTestId('banner-folder')).toHaveText(expected.folder);
  }
  // The first banner's counts are computed from the fixtures, not typed.
  const firstBannerFolder = UNSUPPORTED_BANNERS[0]!.folder;
  await expect(banners.first().getByTestId('banner-counts')).toContainText(
    formatImportSummary(
      SAMPLE_FILE_COUNTS[firstBannerFolder]!,
      SAMPLE_ROW_COUNTS[firstBannerFolder]!,
    ),
  );

  // D-12: identity header, first section and first banner tops strictly
  // increase (top-of-element bounding box).
  const headerBox = await page.getByTestId('identity-header').boundingBox();
  const firstSectionBox = await page
    .getByTestId('dashboard-section-activity-history')
    .boundingBox();
  const firstBannerBox = await banners.first().boundingBox();
  expect(headerBox).not.toBeNull();
  expect(firstSectionBox).not.toBeNull();
  expect(firstBannerBox).not.toBeNull();
  expect(headerBox!.y).toBeLessThan(firstSectionBox!.y);
  expect(firstSectionBox!.y).toBeLessThan(firstBannerBox!.y);
});

// -----------------------------------------------------------------------------
// (b) Renamed root + never-seen folder — proves the classifier is not
// hard-coded to the sample's literal account ID (IMPORT-02).
// -----------------------------------------------------------------------------

test('(b) a renamed root with a never-seen folder is detected without a fixed layout', async ({
  page,
}) => {
  const bytes = Array.from(buildRenamedRootExport());
  await dropFiles(page, page.getByTestId('dropzone'), [
    { name: 'renamed.zip', mimeType: 'application/zip', bytes },
  ]);

  await expectSlimBar(page);
  await expect(page.getByTestId('identity-account-id')).toHaveText(
    formatAccountId(RENAMED_ACCOUNT_ROOT),
  );

  // The sample's four unsupported folders, plus the never-seen one.
  await expect(page.getByTestId('unsupported-banner')).toHaveCount(5);

  // Find the unknown folder banner by its folder name. It must carry
  // data-status="unknown" and end with "2 files, 2 rows".
  const unknownBanner = page.getByTestId('unsupported-banner').filter({
    has: page.getByTestId('banner-folder').getByText(EXTRA_UNKNOWN_FOLDER, { exact: true }),
  });
  await expect(unknownBanner).toHaveCount(1);
  await expect(unknownBanner).toHaveAttribute('data-status', 'unknown');
  await expect(unknownBanner.getByTestId('banner-counts')).toContainText(formatImportSummary(2, 2));
});

// -----------------------------------------------------------------------------
// (c) REMOVED in 02-03 (D-13/D-15/D-16 supersede the prior "no confirmation"
//     behavior — Start Over is now destructive). The replacement assertion
//     that Start Over DOES require a confirmation, then DOES wipe IndexedDB,
//     lives in `tests/e2e/persistent-dataset.spec.ts` test (e). This file no
//     longer carries a test claiming the now-false "single click, no confirm"
//     behavior — leaving it in place would create a contradictory contract
//     between the two specs and let a regression slip past either one.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// (d) A drop on `main` while a dataset is displayed is ignored (D-13)
// -----------------------------------------------------------------------------

test('(d) a file dropped on the results view is ignored', async ({ page }) => {
  // First, import the sample to land on the slim bar.
  await page.getByTestId('file-input').setInputFiles({
    name: 'sample-export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildSampleExport()),
  });
  const bar = page.getByTestId('import-bar');
  await expect(bar).toHaveAttribute('data-variant', 'slim', { timeout: 30_000 });

  // Now drop a non-zip onto `main`, which is a container for the whole
  // shell rather than a drop target of its own.
  await dropFiles(page, page.locator('main'), [
    { name: 'export.zip', mimeType: 'application/zip', bytes: Array.from(buildNotAZipBytes()) },
  ]);

  // Give the (rejected) submission a chance to be processed.
  await page.waitForTimeout(800);

  // The slim bar is still there; no failure banner; no processing status.
  await expect(bar).toHaveAttribute('data-variant', 'slim');
  await expect(page.getByTestId('failure-banner')).toHaveCount(0);
  await expect(page.getByTestId('processing-status')).toHaveCount(0);
});

// -----------------------------------------------------------------------------
// (e) Session-wide: one worker, zero post-baseline requests across many uploads
// -----------------------------------------------------------------------------

test('(e) every upload in a session reuses the one worker and makes zero network requests', async ({
  page,
  context,
}) => {
  // Register listeners BEFORE goto so we capture the worker's script
  // fetch inside the initial-load baseline.
  const requests: string[] = [];
  const workerUrls: string[] = [];
  context.on('request', (req) => requests.push(req.url()));
  page.on('worker', (worker) => workerUrls.push(worker.url()));

  // Re-navigate so the listeners see the initial load too.
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
  await page.waitForLoadState('networkidle');

  const baseline = requests.length;
  expect(baseline).toBeGreaterThan(0);
  expect(workerUrls).toHaveLength(1); // the eager spawn already happened

  // Sequence: valid export -> start over (WITH its confirmation) ->
  // wrong type -> truncated -> renamed. Each step either keeps the slim
  // bar or shows the banner; both are fine.

  // 1. Drop the sample onto the dropzone.
  await dropFiles(page, page.getByTestId('dropzone'), [
    { name: 'sample.zip', mimeType: 'application/zip', bytes: Array.from(buildSampleExport()) },
  ]);
  await expectSlimBar(page);

  // 2. Start over. D-15/D-16: it confirms first. The old flow relied on
  // Start over clearing directly, which no longer exists — and under the
  // drop-during-confirm rule it would hang in `confirm-pending`.
  await page.getByTestId('start-over').click();
  await expect(page.getByTestId('confirm-panel')).toBeVisible();
  await page.getByTestId('confirm-commit').click();
  await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
  await expect(page.getByTestId('dropzone')).toBeVisible();

  // 3. Wrong-extension file (pre-check rejects, no post to worker).
  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });
  await expect(page.getByTestId('failure-banner')).toBeVisible();

  // 4. Truncated zip (worker throws on inflate, lands in error).
  await page.getByTestId('file-input').setInputFiles({
    name: 'truncated.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildTruncatedExport()),
  });
  await expect(page.getByTestId('failure-banner')).toBeVisible();

  // 5. Renamed-root export — successful classify on the second life
  // of the same worker.
  await page.getByTestId('file-input').setInputFiles({
    name: 'renamed.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildRenamedRootExport()),
  });
  await expect(page.getByTestId('identity-account-id')).toHaveText(
    formatAccountId(RENAMED_ACCOUNT_ROOT),
    { timeout: 30_000 },
  );

  // Settle, then assert: still ONE worker, no new requests.
  await page.waitForTimeout(500);
  expect(workerUrls).toHaveLength(1);
  expect(
    requests.length,
    `unexpected requests after baseline: ${requests.slice(baseline).join(', ')}`,
  ).toBe(baseline);
});

// -----------------------------------------------------------------------------
// (f) Responsiveness — no main-thread long task ≥ 1000 ms at 20,000 entries
// -----------------------------------------------------------------------------

test('(f) the page stays responsive while a large export is unzipped', async ({
  page,
}, testInfo) => {
  // Install the PerformanceObserver BEFORE any app script runs so it
  // captures every long task from the moment the worker starts.
  await page.addInitScript(() => {
    const w = window as unknown as { __longTasks: { startTime: number; duration: number }[] };
    w.__longTasks = [];
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.__longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      });
      obs.observe({ type: 'longtask', buffered: true });
    } catch {
      // 'longtask' is unsupported in some browsers; the spec is
      // Chrome-first and the assertion below treats an empty array as
      // pass-equivalent.
    }
  });

  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });

  // Reset the long-task buffer after the initial page load so we only
  // measure tasks emitted between submission and results.
  await page.evaluate(() => {
    (window as unknown as { __longTasks: { startTime: number; duration: number }[] }).__longTasks =
      [];
  });

  // Mark the submission moment, then upload. BY PATH, not by an in-memory
  // buffer: a buffer is decoded on the page's main thread by Playwright itself
  // before the app ever sees the file, and that decode is a long task of its
  // own (see `pickExportFromDisk`, and the note on the assertion below).
  const t0 = await page.evaluate(() => performance.now());
  await pickExportFromDisk(page, testInfo, 'large-export.zip', buildLargeExport());

  // Processing paragraph appears; then the dashboard with a 30 s budget
  // (20k-entry unzip is well under 30 s even on slow hardware).
  await expect(page.getByTestId('processing-status')).toBeVisible();
  await expectSlimBar(page);
  await expect(page.getByTestId('identity-account-id')).toHaveText(
    formatAccountId(SAMPLE_ACCOUNT_ROOT),
  );

  // The Activity_history section counts read "2500 files, ...". The card is
  // `ready`, so the line is the caption after the playtime block.
  const activitySummary = importLine(page.getByTestId('dashboard-section-activity-history'));
  await expect(activitySummary).toContainText(
    formatImportSummary(LARGE_EXPORT_FILES_PER_CATEGORY, LARGE_EXPORT_FILES_PER_CATEGORY),
  );

  // No recorded long task starting at or after the submission mark lasted
  // 1000 ms or more.
  //
  // What this window contains. Because the file arrives by path, the only
  // main-thread work between `t0` and the dashboard is the app's: the change
  // handler and pre-check (~0.2 ms: measured from a capture-phase to a
  // bubble-phase `change` listener), the `postMessage` of a disk-backed `File`
  // handle, and the handler for the worker's results message. Measured against
  // this 3.6 MB / 20,000-entry fixture the largest of those is that results
  // handler at ~9 ms (LoAF attributes it to `Worker.onmessage`); under CDP CPU
  // throttling it is 80 ms at 10x and ~175 ms at 20x. 1 s is therefore more
  // than 100x the app's own worst task, so a failure here means the app blocked
  // the page, not that the runner was slow.
  //
  // What it used to contain, and why the old reading was wrong. An in-memory
  // `setInputFiles({ buffer })` makes Playwright decode the whole 3.6 MB
  // payload on the page's main thread (one task, 140 ms on a fast machine, 1,052
  // to 1,420 ms at 8-10x throttle, 1,216 ms on the CI runner that failed this
  // spec) and dispatch `change` only at the END of that task. This comment used
  // to blame "the postMessage structured clone of a multi-MB File"; the app
  // never touches the bytes on the main thread, and the 1000 ms bound was
  // relaxed from the original 250 ms for a cost that was the harness's.
  //
  // What it does not claim. It is a backstop for a gross block (the pipeline,
  // or an O(n^2) pass over the 20,000 entries, landing on the main thread), not
  // a micro-budget: unzipping this fixture on the main thread costs only ~19 ms
  // (~190 ms at 10x), well under the bound.
  const offenders = await page.evaluate((mark) => {
    const tasks = (window as unknown as { __longTasks: { startTime: number; duration: number }[] })
      .__longTasks;
    return tasks
      .filter((t) => t.startTime >= mark && t.duration >= 1000)
      .map((t) => ({ startTime: t.startTime, duration: t.duration }));
  }, t0);
  expect(offenders).toEqual([]);
});

// -----------------------------------------------------------------------------
// (g) No value from inside the export's files is rendered (prohibition)
// -----------------------------------------------------------------------------

test('(g) no value from inside the export files is rendered', async ({ page }) => {
  await page.getByTestId('file-input').setInputFiles({
    name: 'sample-export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildSampleExport()),
  });
  await expectSlimBar(page);

  // The fixture's LOGIN field is synthetic.player@example.invalid and
  // the IP is 192.0.2.10. Neither should appear anywhere in the page
  // body — only the account root folder name, category folder names
  // and counts are allowed on screen. The IP is still STORED (D-18);
  // this asserts it is still never RENDERED. Deep leak coverage lives in
  // identity-privacy.spec.ts.
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('example.invalid');
  expect(body).not.toContain('192.0.2.10');

  // Sanity: the account-ID line DOES contain the raw root (D-11/D-13) —
  // that's the one allowed place where a value from the export is
  // on-screen.
  expect(body).toContain(formatAccountId(SAMPLE_ACCOUNT_ROOT));
});

// -----------------------------------------------------------------------------
// (h) A second success after Start over still classifies correctly
// -----------------------------------------------------------------------------

test('(h) start over + second import classifies a fresh result', async ({ page }) => {
  // First import: the sample.
  await page.getByTestId('file-input').setInputFiles({
    name: 'sample-export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildSampleExport()),
  });
  await expect(page.getByTestId('identity-account-id')).toHaveText(
    formatAccountId(SAMPLE_ACCOUNT_ROOT),
  );

  // Start over — it confirms first (D-15, D-16) — and re-import with
  // the renamed root.
  await page.getByTestId('start-over').click();
  await expect(page.getByTestId('confirm-panel')).toBeVisible();
  await page.getByTestId('confirm-commit').click();
  await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');

  await page.getByTestId('file-input').setInputFiles({
    name: 'renamed.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildRenamedRootExport()),
  });
  await expect(page.getByTestId('identity-account-id')).toHaveText(
    formatAccountId(RENAMED_ACCOUNT_ROOT),
    { timeout: 30_000 },
  );
  // The renamed export carries one extra unsupported folder, so five
  // banners (the old assertion counted eight badges; four of those
  // became sections and the other four stayed banners).
  await expect(page.getByTestId('unsupported-banner')).toHaveCount(5);
});
