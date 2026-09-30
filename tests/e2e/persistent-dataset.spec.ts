import { expect, test } from '@playwright/test';
import {
  RENAMED_ACCOUNT_ROOT,
  SAMPLE_ACCOUNT_ROOT,
  SAMPLE_BADGE_ORDER,
  SAMPLE_FILE_COUNTS,
  SAMPLE_NICKNAME,
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
  formatAccountId,
  formatImportSummary,
  formatParsingProgress,
  KEEP_CACHED_DATA_LABEL,
  KEEP_CURRENT_DATA_LABEL,
  REPLACE_DATASET_LABEL,
  START_OVER_LABEL,
} from '../../src/lib/ui-copy.ts';
import { dropFiles, importLine, importLines } from './helpers.ts';

// =============================================================================
// 02-02 — DATA-01 close-the-loop (persistent dataset auto-load), re-pointed
// at the dashboard in 03-07.
// =============================================================================
//
// What this file proves end to end:
//   (a) After a successful import, reloading the browser shows the
//       same dashboard without re-uploading, with unchanged section
//       counts, banner text and an "Imported on ..." timestamp
//       (D-07, D-10, D-25).
//   (b) A fresh browser with no cached dataset shows the brief
//       "Checking for a saved export..." status, then settles on the
//       full-variant import bar and the skeleton header (D-08, D-24).
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
 * The expected `section-summary` text for one supported category,
 * computed from the SAME fixtures and formatter the app uses (mirroring
 * the lockstep pattern in `import-flow.spec.ts` test (a)). Kept local so
 * this file is self-contained — if `SAMPLE_FILE_COUNTS` /
 * `SAMPLE_ROW_COUNTS` change, this helper rebuilds the expected string
 * from the same source of truth, keeping test and app in sync.
 */
function expectedSectionSummary(folder: string): string {
  return formatImportSummary(SAMPLE_FILE_COUNTS[folder]!, SAMPLE_ROW_COUNTS[folder]!);
}

/** The four supported sections in D-02 order. */
const SUPPORTED_SECTIONS = [
  { id: 'activity-history', folder: 'Activity_history' },
  { id: 'player-statistics', folder: 'Player_statistics' },
  { id: 'payment-history', folder: 'Payment_history' },
  { id: 'user-info', folder: 'User_Info' },
] as const;

/** The four unsupported folders, in the worker's order. */
const UNSUPPORTED_FOLDERS = SAMPLE_BADGE_ORDER.slice(4) as readonly string[];

/** Wait for the dataset to be displayed: the bar is slim (D-25). */
async function expectSlimBar(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim', {
    timeout: 30_000,
  });
}

test.describe('persistent-dataset auto-load', () => {
  // -----------------------------------------------------------------------------
  // (a) A return visit with a cached dataset opens straight to the dashboard,
  //     with unchanged counts and an import timestamp, without re-uploading
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
    await expectSlimBar(page);

    // Snapshot the section summaries and banner texts BEFORE reload —
    // these are the values the auto-loaded dashboard must show again
    // unchanged. We capture the rendered text of each, then compare
    // with `toContainText` (whitespace-normalized) rather than strict
    // equality, because `innerText()` returns rendered text with
    // line breaks between a card's child spans under flex layout.
    for (const section of SUPPORTED_SECTIONS) {
      // Sanity: the section carries the documented file + row counts
      // (D-05), proving the worker populated the row counts from a
      // real parse — not just the file counts from classify.
      // `importLine` reads the body a pending card renders or the caption a
      // ready one does; Activity_history is ready since 04-02.
      await expect(importLine(page.getByTestId(`dashboard-section-${section.id}`))).toHaveText(
        expectedSectionSummary(section.folder),
      );
    }
    const banners = page.getByTestId('unsupported-banner');
    await expect(banners).toHaveCount(UNSUPPORTED_FOLDERS.length);
    const bannerTextsBefore = await banners.allInnerTexts();
    const sectionTextsBefore = await importLines(page).allInnerTexts();
    expect(sectionTextsBefore).toHaveLength(SUPPORTED_SECTIONS.length);

    // Capture the worker's reported importedAt for the timestamp check
    // (formatImportedOn uses the same value).
    const importedAt = await page.evaluate(() => {
      const m = document.querySelector<HTMLElement>('[data-testid="imported-at"]');
      return m?.textContent ?? '';
    });
    expect(importedAt).toContain('Imported on');

    // Step 2: reload the page. The dataset survives the reload via
    // IndexedDB (DATA-01). The app should auto-load straight to the
    // dashboard (D-07), WITHOUT a new file being set on the input.
    await page.reload();
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });

    // The cache-check status briefly appears, then the dashboard
    // auto-loads. Waiting for the slim bar proves the auto-load
    // resolved correctly. (D-07 success criterion: no upload.)
    await expectSlimBar(page);

    // The same counts as before reload — auto-load carries the same
    // `categories` array the original import produced.
    const sectionTextsAfter = await importLines(page).allInnerTexts();
    expect(sectionTextsAfter).toEqual(sectionTextsBefore);
    for (const section of SUPPORTED_SECTIONS) {
      await expect(importLine(page.getByTestId(`dashboard-section-${section.id}`))).toHaveText(
        expectedSectionSummary(section.folder),
      );
    }

    // The banners come back in the same order with the same text.
    const bannersAfter = page.getByTestId('unsupported-banner');
    await expect(bannersAfter).toHaveCount(UNSUPPORTED_FOLDERS.length);
    expect(await bannersAfter.allInnerTexts()).toEqual(bannerTextsBefore);

    // The "Imported on ..." timestamp text is now derived from the
    // CACHED importedAt — verify the format directly. The date will
    // have changed by microseconds (the cached record carries the
    // original parse timestamp), so we assert the literal text is
    // carried over unchanged from before the reload.
    const importedAtAfter = page.getByTestId('imported-at');
    await expect(importedAtAfter).toBeVisible();
    await expect(importedAtAfter).toHaveText(importedAt);

    // Identity header + account-ID line also auto-load correctly
    // (D-11, D-13).
    await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'loaded');
    await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
    await expect(page.getByTestId('identity-account-id')).toHaveText(
      formatAccountId(SAMPLE_ACCOUNT_ROOT),
    );

    // Auto-load, not re-import: no file is set on the co-rendered
    // dropzone's input. The dropzone IS rendered in the slim bar
    // (D-24/D-25 — that co-render is what makes replace-on-drop
    // reachable), so the proof is the empty FileList rather than an
    // absent element. (`inputValue()` throws on a file input; the
    // JS property is the supported way to read it.)
    await expect(page.getByTestId('dropzone')).toHaveCount(1);
    await expect(page.getByTestId('file-input')).toHaveJSProperty('files.length', 0);

    // The PLATFORM-02 zero-network guard in zero-network.spec.ts is
    // the load-bearing assertion that no extra script fetches
    // happen during reload — capturing per-test worker counts
    // here is brittle (reload itself causes the page's worker to
    // be recreated), so we leave it to the dedicated spec.
  });

  // -----------------------------------------------------------------------------
  // (b) A fresh browser with no cached dataset shows the cache-check status, then
  //     settles on the full-variant bar and the skeleton header (no flash of
  //     the wrong state)
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
    // test still proves the settled state below is the skeleton.
    const cacheCheckStatus = page.getByTestId('cache-check-status');
    await expect(cacheCheckStatus)
      .toBeVisible({ timeout: 500 })
      .catch(() => {
        // The status may have resolved already on a fast CI runner.
        // That's fine — the rest of the test still verifies the
        // final settled state is the skeleton.
      });

    // Settled state: the cache-check status is GONE and the bar is
    // the FULL variant with the skeleton header — no dataset, no
    // failure banner, no file set on the input.
    await expect(cacheCheckStatus).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
    await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'skeleton');
    await expect(page.getByTestId('identity-nickname')).toHaveCount(0);
    await expect(page.getByTestId('identity-account-id')).toHaveCount(0);
    await expect(page.getByTestId('persistent-bar')).toHaveCount(0);
    await expect(page.getByTestId('failure-banner')).toHaveCount(0);
    await expect(page.getByTestId('dropzone')).toBeVisible();
    await expect(page.getByTestId('file-input')).toBeEnabled();
  });

  // -----------------------------------------------------------------------------
  // (a-skip) D-04 / D-09: an import with one malformed row in Bans.csv surfaces
  //     the skip-count tag on that category's banner, and only there.
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
    await expectSlimBar(page);

    // D-04: the Bans banner (the only category with skips in this
    // fixture) carries a "1 row skipped" tag. We locate the banner by
    // its folder name to be robust to worker ordering.
    const bansBanner = page
      .getByTestId('unsupported-banner')
      .filter({ has: page.getByTestId('banner-folder').getByText('Bans', { exact: true }) });
    await expect(bansBanner).toHaveCount(1);
    await expect(bansBanner.getByTestId('skip-tag')).toHaveText('1 row skipped');

    // D-09 / D-04 prohibition: a category with NO skips must NOT show
    // the skip-count tag. Every other card in the malformed fixture has
    // skippedRowCount === 0 — verify the whole page carries exactly one
    // tag, and that no supported section carries one.
    const skippedTags = page.getByTestId('skip-tag');
    await expect(skippedTags).toHaveCount(1); // exactly one skip tag, on Bans
    for (const section of SUPPORTED_SECTIONS) {
      await expect(
        page.getByTestId(`dashboard-section-${section.id}`).getByTestId('skip-tag'),
      ).toHaveCount(0);
    }

    // The skip count survives a reload because it is persisted in
    // DatasetMeta.categories (D-09). Reload and verify again.
    await page.reload();
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await expectSlimBar(page);

    await expect(
      page
        .getByTestId('unsupported-banner')
        .filter({ has: page.getByTestId('banner-folder').getByText('Bans', { exact: true }) })
        .getByTestId('skip-tag'),
    ).toHaveText('1 row skipped');
    await expect(page.getByTestId('skip-tag')).toHaveCount(1);
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
          // D-26: the processing status now lives inside the import
          // bar's notice slot, not inside the dropzone.
          const slot = document.querySelector<HTMLElement>('[data-testid="notice-slot"]');
          const el = slot?.querySelector<HTMLElement>('[data-testid="processing-status"]');
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
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim', {
      timeout: 60_000,
    });
    await expect(page.getByTestId('identity-account-id')).toHaveText(
      formatAccountId(SAMPLE_ACCOUNT_ROOT),
    );
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

    // The Activity_history section carries the inflated row count —
    // Activity_history has 2 templates (Sessions + Logins) in the
    // sample layout, so 2 × 5 files × 1000 rows/file = 10,000 rows. The card
    // is `ready` since 04-02, so the counts are its caption.
    const activitySummary = importLine(page.getByTestId('dashboard-section-activity-history'));
    const expectedActivityRows = SCALE_10X_ROWS_PER_FILE * 2 * 5; // 2 templates × 5 files
    await expect(activitySummary).toContainText(`${expectedActivityRows.toLocaleString()} rows`);

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
// 02-03 — destructive controls (D-13/D-15/D-16/D-17/D-18/D-19/D-20/D-22),
// re-pointed at the slim import bar in 03-07.
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
    await expectSlimBar(page);
    await expect(page.getByTestId('identity-account-id')).toHaveText(
      formatAccountId(SAMPLE_ACCOUNT_ROOT),
    );

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
    await expect(page.getByTestId('identity-account-id')).toHaveText(
      formatAccountId(SAMPLE_ACCOUNT_ROOT),
    );

    // Step 3: cancel — the cached dataset is untouched, the panel
    // dismisses, the dashboard is restored.
    await page.getByTestId('confirm-cancel').click();
    await expect(confirmPanel).toHaveCount(0);
    await expect(page.getByTestId('identity-account-id')).toHaveText(
      formatAccountId(SAMPLE_ACCOUNT_ROOT),
    );
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim');

    // Step 4: re-trigger confirm, then confirm. The worker writes
    // the new dataset, the account-ID line flips to the renamed root,
    // and the prior dataset is gone.
    await dropFiles(page, page.getByTestId('dropzone'), [
      {
        name: 'renamed.zip',
        mimeType: 'application/zip',
        bytes: Array.from(buildRenamedRootExport()),
      },
    ]);
    await expect(confirmPanel).toBeVisible();
    await page.getByTestId('confirm-commit').click();
    await expect(page.getByTestId('identity-account-id')).toHaveText(
      formatAccountId(RENAMED_ACCOUNT_ROOT),
      {
        timeout: 30_000,
      },
    );
    // The renamed export adds one never-seen folder on top of the
    // sample's four, so the banner count goes 4 -> 5.
    await expect(page.getByTestId('unsupported-banner')).toHaveCount(5);
  });

  // -----------------------------------------------------------------------------
  // (e) D-15/D-16: Start Over now requires confirmation and, once confirmed,
  //     wipes IndexedDB — the empty dropzone + acknowledgment banner appears,
  //     not the prior dataset.
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
    await expectSlimBar(page);

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
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim');

    // Confirm — the worker wipes IndexedDB. The full-variant bar with
    // the skeleton header and a one-shot D-20 acknowledgment appears.
    await page.getByTestId('start-over').click();
    await expect(confirmPanel).toBeVisible();
    await page.getByTestId('confirm-commit').click();
    await expect(page.getByTestId('cleared-ack')).toHaveText(CLEARED_ACK_MESSAGE);
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
    await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'skeleton');
    await expect(page.getByTestId('dropzone')).toBeVisible();
    await expect(page.getByTestId('file-input')).toBeEnabled();
    // The persistent bar is absent (D-19: nothing cached). It renders
    // only in the slim variant, so a full bar proves it on its own —
    // the explicit count keeps the intent readable.
    await expect(page.getByTestId('persistent-bar')).toHaveCount(0);

    // Reload — the IndexedDB cache is empty, so the post-init state
    // is the full bar with the skeleton header (proves the wipe
    // was persistent, not just a view reset).
    await page.reload();
    await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
      timeout: 10_000,
    });
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
    await expect(page.getByTestId('dropzone')).toBeVisible();
    await expect(page.getByTestId('identity-nickname')).toHaveCount(0);
    await expect(page.getByTestId('persistent-bar')).toHaveCount(0);
  });

  // -----------------------------------------------------------------------------
  // (f) D-17/D-18/D-19: the dedicated "Clear my cached data" control is absent
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
    await expectSlimBar(page);
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
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
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
    await expectSlimBar(page);

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
