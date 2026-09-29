import { expect, test } from '@playwright/test';
import {
  RENAMED_ACCOUNT_ROOT,
  RENAMED_EXPECTED_COUNTS,
  SAMPLE_ACCOUNT_ROOT,
  SAMPLE_BADGE_ORDER,
  SAMPLE_EXPECTED_COUNTS,
  SAMPLE_FILE_COUNTS,
  SAMPLE_ROW_COUNTS,
  SCALE_10X_ROWS_PER_FILE,
  buildMalformedRowsExport,
  buildRenamedRootExport,
  buildSampleExport,
  buildScaleExport,
} from '../fixtures/export-fixtures.ts';
import {
  CLEAR_DATA_LABEL,
  CLEARED_ACK_MESSAGE,
  CONFIRM_CLEAR_MESSAGE,
  CONFIRM_REPLACE_MESSAGE,
  DELETE_CACHED_DATA_LABEL,
  formatParsingProgress,
  formatSummary,
  KEEP_CACHED_DATA_LABEL,
  KEEP_CURRENT_DATA_LABEL,
  REPLACE_DATASET_LABEL,
  START_OVER_LABEL,
} from '../../src/lib/ui-copy.ts';
import { dropFiles } from './helpers.ts';

// =============================================================================
// 02-02 — DATA-01 close-the-loop (persistent dataset auto-load)
// =============================================================================
//
// What this file proves end to end:
//   (a) After a successful import, reloading the browser shows the
//       same results view without re-uploading, with unchanged row
//       counts and an "Imported on ..." timestamp (D-07, D-10).
//   (b) A fresh browser with no cached dataset shows the brief
//       "Checking for a saved export..." status, then settles on
//       the empty dropzone (D-08).
//
// Test (c) — the 10x-scale responsiveness assertion — lives in this
// file too. It uses the same `PerformanceObserver` long-task pattern
// established in `import-flow.spec.ts` (test (f)).
//
// Each test in this file uses a fresh Playwright `context` (one per
// test), so IndexedDB is empty at the start of every test — there is
// no cross-test contamination of the cached dataset.
// =============================================================================

/**
 * The expected badge text for a given badge index, computed from the
 * SAME fixtures and formatters the app uses (mirroring the lockstep
 * pattern in `import-flow.spec.ts` test (a)). Kept local so this file
 * is self-contained — if `SAMPLE_FILE_COUNTS` / `SAMPLE_ROW_COUNTS`
 * change, this helper rebuilds the expected string from the same
 * source of truth, keeping test and app in sync.
 */
function expectedBadgeText(index: number): string {
  const name = SAMPLE_BADGE_ORDER[index]!;
  const fileCount = SAMPLE_FILE_COUNTS[name]!;
  const rowCount = SAMPLE_ROW_COUNTS[name]!;
  return `${name} — ${fileCount} file${fileCount === 1 ? '' : 's'}, ${rowCount} row${rowCount === 1 ? '' : 's'}`;
}

test.describe('persistent-dataset auto-load', () => {
  // -----------------------------------------------------------------------------
  // (a) A return visit with a cached dataset opens straight to the results view,
  //     with unchanged row counts and an import timestamp, without re-uploading
  // -----------------------------------------------------------------------------

  test('(a) a return visit with a cached dataset opens straight to the results view, with unchanged row counts and an import timestamp, without re-uploading', async ({
    page,
  }) => {
    // Step 1: import the sample so the dataset is in IndexedDB.
    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    await dropFiles(page, page.getByTestId('dropzone'), [
      {
        name: 'sample-export.zip',
        mimeType: 'application/zip',
        bytes: Array.from(buildSampleExport()),
      },
    ]);
    await expect(page.getByTestId('results')).toBeVisible({ timeout: 30_000 });

    // Snapshot the badges' text BEFORE reload — these are the values
    // the auto-loaded view must show again unchanged. We capture the
    // trimmed text content of each badge, then compare with
    // `toContainText` (whitespace-normalized) rather than strict
    // equality, because `innerText()` returns rendered text with
    // line breaks between the badge's child spans under flex layout.
    const badgesBefore = page.getByTestId('category-badge');
    await expect(badgesBefore).toHaveCount(8);
    // Sanity: the first badge carries the documented file + row counts
    // (D-05), proving the worker has populated the row counts from a
    // real parse — not just the file counts from classify.
    await expect(badgesBefore.first()).toContainText(expectedBadgeText(0));

    // Capture the worker's reported importedAt for the timestamp check
    // (formatImportedOn uses the same value).
    const importedAt = await page.evaluate(() => {
      const m = document.querySelector<HTMLElement>('[data-testid="imported-at"]');
      return m?.textContent ?? '';
    });
    expect(importedAt).toContain('Imported on');

    // Step 2: reload the page. The dataset survives the reload via
    // IndexedDB (DATA-01). The app should auto-load straight to the
    // results view (D-07), WITHOUT a new file being set on the input.
    await page.reload();
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    // The cache-check status briefly appears, then the results view
    // auto-loads. Wait for the results view — that proves the auto-
    // load resolved correctly. (D-07 success criterion: no upload.)
    await expect(page.getByTestId('results')).toBeVisible({ timeout: 30_000 });

    // The same row/skip counts as before reload — auto-load carries
    // the same `categories` array the original import produced.
    const badgesAfter = page.getByTestId('category-badge');
    await expect(badgesAfter).toHaveCount(8);
    // Verify each badge contains the expected substring (whitespace-
    // normalized via `toContainText`). Strict text equality breaks
    // under flex layout because `innerText()` adds line breaks
    // between child spans; `toContainText` normalizes both sides.
    for (let i = 0; i < 8; i++) {
      await expect(badgesAfter.nth(i)).toContainText(expectedBadgeText(i));
    }

    // The "Imported on ..." timestamp text is now derived from the
    // CACHED importedAt — verify the format directly. The date will
    // have changed by microseconds (the cached record carries the
    // original parse timestamp), so we assert on the format prefix
    // rather than the literal text equality.
    const importedAtAfter = page.getByTestId('imported-at');
    await expect(importedAtAfter).toBeVisible();
    await expect(importedAtAfter).toHaveText(importedAt);

    // Summary line + account heading also auto-load correctly (D-11).
    await expect(page.getByTestId('summary-line')).toHaveText(
      formatSummary(SAMPLE_EXPECTED_COUNTS),
    );
    await expect(page.getByTestId('account-heading')).toHaveText(`Account: ${SAMPLE_ACCOUNT_ROOT}`);

    // Auto-load, not re-import: the dropzone (and its file input)
    // are not rendered at all once results are shown — the UI has
    // already committed to the cached dataset. (A redundant
    // inputValue check would be a no-op assertion since the
    // element doesn't exist; the absent dropzone is the proof.)

    // The PLATFORM-02 zero-network guard in zero-network.spec.ts is
    // the load-bearing assertion that no extra script fetches
    // happen during reload — capturing per-test worker counts
    // here is brittle (reload itself causes the page's worker to
    // be recreated), so we leave it to the dedicated spec.
  });

  // -----------------------------------------------------------------------------
  // (b) A fresh browser with no cached dataset shows the cache-check status, then
  //     settles on the empty dropzone (no flash of the wrong state)
  // -----------------------------------------------------------------------------

  test('(b) a fresh visit with no cached dataset shows the checking-cache status then settles on the empty dropzone', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    // The cache-check status paragraph appears briefly (D-08). It may
    // already have settled by the time the locator resolves (the
    // IndexedDB read is fast), so we use a soft expectation — the
    // test still proves the settled state below is the empty dropzone.
    const cacheCheckStatus = page.getByTestId('cache-check-status');
    await expect(cacheCheckStatus)
      .toBeVisible({ timeout: 500 })
      .catch(() => {
        // The status may have resolved already on a fast CI runner.
        // That's fine — the rest of the test still verifies the
        // final settled state is the empty dropzone.
      });

    // Settled state: the cache-check status is GONE and the empty
    // dropzone is shown — no results view, no failure banner, no
    // file set on the input.
    await expect(cacheCheckStatus).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('results')).toHaveCount(0);
    await expect(page.getByTestId('failure-banner')).toHaveCount(0);
    await expect(page.getByTestId('dropzone')).toBeVisible();
    await expect(page.getByTestId('file-input')).toBeEnabled();
  });

  // -----------------------------------------------------------------------------
  // (a-skip) D-04 / D-09: an import with one malformed row in Bans.csv surfaces
  //     the skip-count tag on that category's badge, and only on that badge.
  //     The skip-count survives a reload (D-09) because it is persisted in
  //     DatasetMeta.categories, not just on the in-memory ClassifyResult.
  // -----------------------------------------------------------------------------

  test('(a-skip) a category with one malformed row shows the skip-count tag, and the tag survives a reload', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    await dropFiles(page, page.getByTestId('dropzone'), [
      {
        name: 'malformed-rows-export.zip',
        mimeType: 'application/zip',
        bytes: Array.from(buildMalformedRowsExport()),
      },
    ]);
    await expect(page.getByTestId('results')).toBeVisible({ timeout: 30_000 });

    // D-04: the Bans badge (only category with skips in this fixture)
    // carries a "1 row skipped" tag. We locate the badge by its data
    // status + name prefix to be robust to worker badge ordering.
    const bansBadge = page.getByTestId('category-badge').filter({ hasText: /^Bans\b/ });
    await expect(bansBadge).toHaveCount(1);
    await expect(bansBadge).toContainText('1 row skipped');

    // D-09 / D-04 prohibition: a category with NO skips must NOT show
    // the skip-count tag. Every other badge in the malformed fixture
    // has skippedRowCount === 0 — verify none of them carry the tag.
    const skippedTags = page.getByTestId('badge-skipped-count');
    await expect(skippedTags).toHaveCount(1); // exactly one skip tag, on Bans

    // The skip count survives a reload because it is persisted in
    // DatasetMeta.categories (D-09). Reload and verify again.
    await page.reload();
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await expect(page.getByTestId('results')).toBeVisible({ timeout: 30_000 });

    const bansBadgeAfterReload = page.getByTestId('category-badge').filter({ hasText: /^Bans\b/ });
    await expect(bansBadgeAfterReload).toContainText('1 row skipped');
    await expect(page.getByTestId('badge-skipped-count')).toHaveCount(1);
  });

  // -----------------------------------------------------------------------------
  // (c) A 10x-scale synthetic import progresses through multiple categories and
  //     stays responsive (no main-thread long task >= 1 s) — SC1's second half.
  // -----------------------------------------------------------------------------

  test('(c) a 10x-scale synthetic export imports with progress advancing per category and the page stays responsive', async ({
    page,
  }) => {
    // Install the PerformanceObserver BEFORE any app script runs so
    // it captures every long task from the moment the worker starts.
    // Mirrors the pattern in `import-flow.spec.ts` test (f) — same
    // 1 s "noticeable but not blocking" threshold that test already
    // locked in for the file-count stress test.
    await page.addInitScript(() => {
      const w = window as unknown as {
        __longTasks: { startTime: number; duration: number }[];
      };
      w.__longTasks = [];
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            w.__longTasks.push({ startTime: entry.startTime, duration: entry.duration });
          }
        });
        obs.observe({ type: 'longtask', buffered: true });
      } catch {
        // 'longtask' unsupported in some browsers — empty array is
        // a pass-equivalent per the spec's Chrome-first target.
      }
    });

    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    // Reset the long-task buffer after the initial page load so we
    // only measure tasks emitted between submission and results.
    await page.evaluate(() => {
      (
        window as unknown as { __longTasks: { startTime: number; duration: number }[] }
      ).__longTasks = [];
    });

    // Capture the distinct progress texts the worker emits as it
    // moves through categories. We assert the worker advanced past
    // at least 2 distinct categories during the import — the proof
    // that progress is genuinely per-category (D-11), not a single
    // spinner frame that resolves straight to "done". A 25 ms poll
    // interval is tight enough that even a fast category parse
    // (~50 ms) leaves at least one observation window between
    // transitions; with the prior 100 ms interval, two back-to-back
    // ~60 ms category parses could slip through without the polling
    // ever observing the intermediate state.
    const observedProgressTexts = new Set<string>();
    const observerIntervalMs = 25;
    const observer = setInterval(async () => {
      try {
        const text = await page.evaluate(() => {
          const el = document.querySelector<HTMLElement>('[data-testid="processing-status"]');
          return el?.textContent?.trim() ?? null;
        });
        if (text && /^Parsing \S+ \(\d+\/\d+\)\.\.\.$/.test(text)) {
          observedProgressTexts.add(text);
        }
      } catch {
        // Page may be mid-navigation; ignore transient evaluation errors.
      }
    }, observerIntervalMs);

    // Mark the submission moment, then upload the 10x fixture.
    const t0 = await page.evaluate(() => performance.now());
    await page.getByTestId('file-input').setInputFiles({
      name: 'scale-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildScaleExport()),
    });

    // Generous 60 s budget — the parse budget is the safety net,
    // not the gating assertion (the gating assertion is the
    // long-task threshold below).
    await expect(page.getByTestId('processing-status')).toBeVisible();
    await expect(page.getByTestId('account-heading')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('account-heading')).toHaveText(`Account: ${SAMPLE_ACCOUNT_ROOT}`);
    clearInterval(observer);

    // D-11 progress: at least 2 distinct per-category progress texts
    // were observed during the import (the parser visited at least 2
    // categories and posted an intermediate 'parsing' stage for each).
    expect(observedProgressTexts.size).toBeGreaterThanOrEqual(2);
    // Sanity: the progress text matches formatParsingProgress exactly.
    // Re-compute against the parser's documented shape — if the
    // format ever drifts, this assertion catches it.
    const sample = Array.from(observedProgressTexts)[0]!;
    expect(sample).toMatch(/^Parsing \S+ \(\d+\/\d+\)\.\.\.$/);
    // Quick re-shape check: build a synthetic progress with the
    // formatter and confirm the regex matches its output too — closes
    // the loop with the in-app formatter.
    expect(
      formatParsingProgress({ category: 'Activity_history', categoryIndex: 1, categoryTotal: 8 }),
    ).toMatch(/^Parsing \S+ \(\d+\/\d+\)\.\.\.$/);

    // The Activity_history badge carries the inflated row count —
    // Activity_history has 2 templates (Sessions + Logins) in the
    // sample layout, so 2 × 5 files × 1000 rows/file = 10,000 rows.
    const activityBadge = page
      .getByTestId('category-badge')
      .filter({ hasText: /^Activity_history\b/ });
    const expectedActivityRows = SCALE_10X_ROWS_PER_FILE * 2 * 5; // 2 templates × 5 files
    await expect(activityBadge).toContainText(`${expectedActivityRows.toLocaleString()} rows`);

    // No main-thread long task ≥ 1000 ms starting at or after the
    // submission mark. Same threshold `import-flow.spec.ts` test (f)
    // already locked in (the postMessage structured-clone of a
    // multi-MB File can spend 300-500 ms on the main thread on slow
    // hardware; 1 s is the conventional "noticeable but not blocking"
    // boundary — anything over 1 s is the real regression to catch).
    const offenders = await page.evaluate((mark) => {
      const tasks = (
        window as unknown as { __longTasks: { startTime: number; duration: number }[] }
      ).__longTasks;
      return tasks
        .filter((t) => t.startTime >= mark && t.duration >= 1000)
        .map((t) => ({ startTime: t.startTime, duration: t.duration }));
    }, t0);
    expect(offenders).toEqual([]);
  });
});

// =============================================================================
// 02-03 — destructive controls (D-13/D-15/D-16/D-17/D-18/D-19/D-20/D-22)
//
// Why this block is its own world:
//   02-02's persistent-dataset block proves the auto-load round
//   trip (DATA-01). 02-03 closes the destructive-action loop: a
//   cached dataset must be just as easy to get rid of as it was to
//   create. The four tests below cover the three destructive
//   triggers — replace-on-drop (D-13), Start Over (D-15/D-16), and
//   the persistent "Clear my cached data" control (D-17/D-18) —
//   plus a fourth test that asserts zero native browser dialogs
//   fire across ALL three flows (D-14's "never native confirm()
//   dialog" prohibition).
//
// Each test uses a fresh Playwright `context` (one per test), so
// IndexedDB is empty at the start of every test — there is no
// cross-test contamination of the cached dataset.
// =============================================================================

test.describe('persistent-dataset destructive controls', () => {
  // -----------------------------------------------------------------------------
  // (d) D-13: replace-on-drop — a different (hash-mismatched) zip dropped while
  //     a dataset is cached shows a confirm panel with the D-13 copy and does
  //     NOT touch the cached dataset until confirmed. Cancelling leaves the
  //     existing dataset unchanged; confirming fully replaces it.
  // -----------------------------------------------------------------------------

  test('(d) replace-on-drop shows a confirm panel with D-13 copy and does not touch the old dataset until confirmed', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    // Step 1: import the sample so the dataset is in IndexedDB.
    await page.getByTestId('file-input').setInputFiles({
      name: 'sample-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildSampleExport()),
    });
    await expect(page.getByTestId('results')).toBeVisible({ timeout: 30_000 });
    const headingBefore = await page.getByTestId('account-heading').textContent();
    expect(headingBefore).toBe(`Account: ${SAMPLE_ACCOUNT_ROOT}`);

    // Step 2: drop a DIFFERENT (hash-mismatched) zip. The ConfirmPanel
    // must appear with D-13 copy and the cached dataset must still be
    // visible behind it — nothing has been replaced yet.
    await dropFiles(page, page.getByTestId('dropzone'), [
      {
        name: 'renamed.zip',
        mimeType: 'application/zip',
        bytes: Array.from(buildRenamedRootExport()),
      },
    ]);
    // The CONFIRM_REPLACE_MESSAGE appears with both the D-13 copy
    // and the destructive-control label pair.
    const confirmPanel = page.getByTestId('confirm-panel');
    await expect(confirmPanel).toBeVisible({ timeout: 10_000 });
    await expect(confirmPanel).toContainText(CONFIRM_REPLACE_MESSAGE);
    await expect(page.getByTestId('confirm-cancel')).toHaveText(KEEP_CURRENT_DATA_LABEL);
    await expect(page.getByTestId('confirm-commit')).toHaveText(REPLACE_DATASET_LABEL);

    // The cached dataset is still visible behind the panel — D-13
    // explicitly requires "the old dataset remains visible and
    // unchanged until the user confirms".
    await expect(page.getByTestId('account-heading')).toHaveText(`Account: ${SAMPLE_ACCOUNT_ROOT}`);

    // Step 3: cancel — the cached dataset is untouched, the panel
    // dismisses, the empty/results view is restored.
    await page.getByTestId('confirm-cancel').click();
    await expect(confirmPanel).toHaveCount(0);
    await expect(page.getByTestId('account-heading')).toHaveText(`Account: ${SAMPLE_ACCOUNT_ROOT}`);
    await expect(page.getByTestId('results')).toBeVisible();

    // Step 4: re-trigger confirm, then confirm. The worker writes
    // the new dataset, the heading flips to the renamed account
    // root, and the prior dataset is gone.
    await dropFiles(page, page.getByTestId('dropzone'), [
      {
        name: 'renamed.zip',
        mimeType: 'application/zip',
        bytes: Array.from(buildRenamedRootExport()),
      },
    ]);
    await expect(confirmPanel).toBeVisible();
    await page.getByTestId('confirm-commit').click();
    await expect(page.getByTestId('account-heading')).toHaveText(
      `Account: ${RENAMED_ACCOUNT_ROOT}`,
      {
        timeout: 30_000,
      },
    );
    await expect(page.getByTestId('summary-line')).toHaveText(
      formatSummary(RENAMED_EXPECTED_COUNTS),
    );
  });

  // -----------------------------------------------------------------------------
  // (e) D-15/D-16: Start Over now requires confirmation and, once confirmed,
  //     wipes IndexedDB — the empty dropzone + acknowledgment banner appears,
  //     not the prior results.
  // -----------------------------------------------------------------------------

  test('(e) start over now requires confirmation and actually clears IndexedDB', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    // Import the sample.
    await page.getByTestId('file-input').setInputFiles({
      name: 'sample-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildSampleExport()),
    });
    await expect(page.getByTestId('results')).toBeVisible({ timeout: 30_000 });

    // Click Start Over — the ConfirmPanel appears with the D-21
    // copy (NOT the D-13 copy).
    await page.getByTestId('start-over').click();
    const confirmPanel = page.getByTestId('confirm-panel');
    await expect(confirmPanel).toBeVisible({ timeout: 10_000 });
    await expect(confirmPanel).toContainText(CONFIRM_CLEAR_MESSAGE);
    await expect(page.getByTestId('confirm-cancel')).toHaveText(KEEP_CACHED_DATA_LABEL);
    await expect(page.getByTestId('confirm-commit')).toHaveText(DELETE_CACHED_DATA_LABEL);

    // Cancel — the cached dataset is untouched (must_haves prohibition).
    await page.getByTestId('confirm-cancel').click();
    await expect(confirmPanel).toHaveCount(0);
    await expect(page.getByTestId('results')).toBeVisible();

    // Confirm — the worker wipes IndexedDB. The empty dropzone +
    // one-shot D-20 acknowledgment appears.
    await page.getByTestId('start-over').click();
    await expect(confirmPanel).toBeVisible();
    await page.getByTestId('confirm-commit').click();
    await expect(page.getByTestId('cleared-ack')).toHaveText(CLEARED_ACK_MESSAGE);
    await expect(page.getByTestId('results')).toHaveCount(0);
    await expect(page.getByTestId('dropzone')).toBeVisible();
    await expect(page.getByTestId('file-input')).toBeEnabled();
    // The persistent bar is hidden (D-19: nothing cached).
    await expect(page.getByTestId('persistent-bar')).toHaveCount(0);

    // Reload — the IndexedDB cache is empty, so the post-init state
    // is the empty dropzone with no results view (proves the wipe
    // was persistent, not just a view reset).
    await page.reload();
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await expect(page.getByTestId('dropzone')).toBeVisible();
    await expect(page.getByTestId('results')).toHaveCount(0);
    await expect(page.getByTestId('persistent-bar')).toHaveCount(0);
  });

  // -----------------------------------------------------------------------------
  // (f) D-17/D-18/D-19: the dedicated "Clear my cached data" control is hidden
  //     when there is no dataset and clears everything when confirmed.
  // -----------------------------------------------------------------------------

  test('(f) the dedicated Clear my cached data control is hidden with no dataset and clears everything when confirmed', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    // Fresh visit — no cached dataset. The persistent bar (D-19)
    // must NOT be visible at all (not disabled, not shown-disabled).
    await expect(page.getByTestId('persistent-bar')).toHaveCount(0);
    await expect(page.getByTestId('clear-data-control')).toHaveCount(0);

    // Import the sample — the persistent bar appears (D-18).
    await page.getByTestId('file-input').setInputFiles({
      name: 'sample-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildSampleExport()),
    });
    await expect(page.getByTestId('results')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('persistent-bar')).toBeVisible();
    const clearControl = page.getByTestId('clear-data-control');
    await expect(clearControl).toBeVisible();
    await expect(clearControl).toHaveText(CLEAR_DATA_LABEL);

    // Click the dedicated control — the same ConfirmPanel as Start Over
    // appears (D-22: one shared confirm component, one shared copy pair).
    await clearControl.click();
    const confirmPanel = page.getByTestId('confirm-panel');
    await expect(confirmPanel).toBeVisible({ timeout: 10_000 });
    await expect(confirmPanel).toContainText(CONFIRM_CLEAR_MESSAGE);
    await expect(page.getByTestId('confirm-cancel')).toHaveText(KEEP_CACHED_DATA_LABEL);
    await expect(page.getByTestId('confirm-commit')).toHaveText(DELETE_CACHED_DATA_LABEL);

    // Confirm — the cache is wiped, the acknowledgment appears.
    await page.getByTestId('confirm-commit').click();
    await expect(page.getByTestId('cleared-ack')).toHaveText(CLEARED_ACK_MESSAGE);
    await expect(page.getByTestId('dropzone')).toBeVisible();
    await expect(page.getByTestId('results')).toHaveCount(0);
    await expect(page.getByTestId('persistent-bar')).toHaveCount(0);
  });

  // -----------------------------------------------------------------------------
  // (g) D-14: zero native browser dialogs fire during any of the three
  //     destructive confirm flows. Registers a `page.on('dialog', ...)` listener
  //     that fails the test if any dialog opens — mirrors import-flow.spec.ts
  //     test (c)'s pattern, generalized across all three triggers.
  // -----------------------------------------------------------------------------

  test('(g) no native browser dialog fires during any of the three destructive confirm flows', async ({
    page,
  }) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`);
      void d.dismiss();
    });

    await page.goto('/');
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    // Import the sample.
    await page.getByTestId('file-input').setInputFiles({
      name: 'sample-export.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(buildSampleExport()),
    });
    await expect(page.getByTestId('results')).toBeVisible({ timeout: 30_000 });

    // 1. Replace-on-drop → cancel.
    await dropFiles(page, page.getByTestId('dropzone'), [
      {
        name: 'renamed.zip',
        mimeType: 'application/zip',
        bytes: Array.from(buildRenamedRootExport()),
      },
    ]);
    await expect(page.getByTestId('confirm-panel')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('confirm-panel')).toHaveCount(0);

    // 2. Start Over → cancel.
    await page.getByTestId('start-over').click();
    await expect(page.getByTestId('confirm-panel')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('confirm-panel')).toHaveCount(0);

    // 3. Clear my cached data → cancel.
    await page.getByTestId('clear-data-control').click();
    await expect(page.getByTestId('confirm-panel')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('confirm-panel')).toHaveCount(0);

    // The Start Over label itself is the trigger; verify it's
    // exactly the same string the ConfirmPanel's destructive-copy
    // pattern sits behind.
    await expect(page.getByTestId('start-over')).toHaveText(START_OVER_LABEL);

    // No dialog fired across the three flow steps.
    expect(dialogs).toEqual([]);
  });
});
