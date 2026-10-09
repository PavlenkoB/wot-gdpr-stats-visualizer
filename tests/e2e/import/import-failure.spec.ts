import '../_support/pin-locale';
import { expect, test } from '@playwright/test';
import {
  buildMultiRootZip,
  buildNoRecognizedCategoryZip,
  buildNotAZipBytes,
  buildSampleExport,
  buildTruncatedExport,
} from '../../fixtures/export-fixtures.ts';
import { SAMPLE_NICKNAME } from '../../fixtures/export-fixtures.ts';
import { GENERIC_FAILURE_MESSAGE } from '../../../src/lib/ui-copy.ts';
import { dropFiles } from '../_support/helpers.ts';

// =============================================================================
// IMPORT-05 — every failure mode at the UI level (RESEARCH Wave 0 gap)
// =============================================================================
//
// Why this file exists (01-04-PLAN Task 3):
//   The unit tests (tests/unit/import/ingest-client.test.ts) prove the state
//   machine; this file proves the UI surface. The two together are
//   success criterion 2 ("a non-zip file, a corrupt archive and a
//   structurally unrecognizable zip each show one generic failure
//   state, and the user can drop another file right away").
//
//   Every test below exercises the FULL built app via vite preview,
//   including the worker. Every failure source in the spec lands at
//   the same single banner copy (GENERIC_FAILURE_MESSAGE) — D-04,
//   D-07, Pitfall 2 (one error path, not two). The console-error
//   trace differs by cause; the visible text never does.
//
// Conventions (per 01-01 zero-network.spec.ts):
//   - Use page.getByTestId(...) and page.getByRole(heading, ...)
//     locators, not raw CSS selectors.
//   - Wait on data-worker-ready="true" before any submission — the
//     worker is spawned eagerly at app init, but the 'ready' message
//     is asynchronous.
//   - Buffer.from(...) wraps the Uint8Array fixture for setInputFiles;
//     dropFiles is the synthetic-drag equivalent.
//
//   "No identity was ever loaded" is asserted as `identity-nickname`
// having count 0 plus the bar being the FULL variant. It used to be a
// level-2 heading count, but headings are pane titles now and the
// first-visit page still carries several, so that count is not a
// meaningful "nothing loaded" signal. The first-visit page is the
// empty-state detail pane, which hosts the one dropzone and file input;
// once a dataset loads the import region moves to the list pane.
//
// All console errors observed during each test are collected by the
// beforeEach handler so individual tests can assert specific causes
// (e.g. 'invalid zip data', 'no-recognized-category') without
// scattering console spies.
// =============================================================================

const consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
    timeout: 10_000,
  });
});

function bannerTextContaining(needle: string): boolean {
  return consoleErrors.some((line) => line.includes(needle));
}

// -----------------------------------------------------------------------------
// (a) A wrong-extension file via the file input
// -----------------------------------------------------------------------------

test('(a) a notes.txt set on the file input shows the failure banner; no worker message; banner has zero <a> or <button> children', async ({
  page,
}) => {
  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });

  const banner = page.getByTestId('failure-banner');
  // The banner is announced from the import bar's notice slot — the
  // single live region (D-26) — not rendered loose on the page.
  const slotBanner = page.getByTestId('notice-slot').getByTestId('failure-banner');
  await expect(slotBanner).toBeVisible();
  await expect(banner).toHaveText(GENERIC_FAILURE_MESSAGE);

  // No successful classify ever ran, so the identity header is still
  // the skeleton and the bar is still the full variant.
  await expect(page.getByTestId('identity-nickname')).toHaveCount(0);
  await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');

  // The banner carries no reporting affordance — no link, no button
  // (prohibition P3: never offer to ship the failure detail off-device).
  const bannerChildren = await banner.evaluate((el: HTMLElement) => ({
    anchors: el.querySelectorAll('a').length,
    buttons: el.querySelectorAll('button').length,
  }));
  expect(bannerChildren.anchors).toBe(0);
  expect(bannerChildren.buttons).toBe(0);

  // The dropzone is still enabled (immediate re-arm).
  await expect(page.getByTestId('file-input')).toBeEnabled();

  // The failure cause is in the console (D-05).
  expect(bannerTextContaining('[ingest] import failed:')).toBe(true);
  expect(bannerTextContaining('pre-check')).toBe(true);
});

// -----------------------------------------------------------------------------
// (b) A file whose bytes are not a zip at all
// -----------------------------------------------------------------------------

test('(b) a non-zip .zip (buildNotAZipBytes) shows the banner with the invalid-zip cause in the console', async ({
  page,
}) => {
  await page.getByTestId('file-input').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildNotAZipBytes()),
  });

  const banner = page.getByTestId('failure-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveText(GENERIC_FAILURE_MESSAGE);

  // The worker threw on fflate's unzipSync; the client's #fail routed
  // the message through. The detail includes 'invalid zip data' (A2).
  await expect.poll(() => bannerTextContaining('invalid zip data')).toBe(true);
});

// -----------------------------------------------------------------------------
// (c) A truncated zip
// -----------------------------------------------------------------------------

test('(c) a truncated .zip (buildTruncatedExport) shows the banner', async ({ page }) => {
  await page.getByTestId('file-input').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildTruncatedExport()),
  });

  const banner = page.getByTestId('failure-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveText(GENERIC_FAILURE_MESSAGE);
});

// -----------------------------------------------------------------------------
// (d) A valid zip with no recognized Wargaming category, then a multi-root zip
// -----------------------------------------------------------------------------

test('(d) a photos zip with no recognized category shows the banner; then a multi-root zip also shows the banner', async ({
  page,
}) => {
  await page.getByTestId('file-input').setInputFiles({
    name: 'photos.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildNoRecognizedCategoryZip()),
  });

  const banner = page.getByTestId('failure-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveText(GENERIC_FAILURE_MESSAGE);
  await expect.poll(() => bannerTextContaining('no-recognized-category')).toBe(true);

  // Reset for the second case: drop another invalid zip.
  await page.getByTestId('file-input').setInputFiles({
    name: 'multi-root.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildMultiRootZip()),
  });

  await expect(banner).toBeVisible();
  await expect(banner).toHaveText(GENERIC_FAILURE_MESSAGE);
});

// -----------------------------------------------------------------------------
// (e) Two .zip files dropped together — pre-check rejects (D-16)
// -----------------------------------------------------------------------------

test('(e) dropping two zips at once shows the banner; no identity header appears', async ({
  page,
}) => {
  const sample = Array.from(buildSampleExport());
  await dropFiles(page, page.getByTestId('dropzone'), [
    { name: 'first.zip', mimeType: 'application/zip', bytes: sample },
    { name: 'second.zip', mimeType: 'application/zip', bytes: sample },
  ]);

  const banner = page.getByTestId('failure-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveText(GENERIC_FAILURE_MESSAGE);
  await expect.poll(() => bannerTextContaining('pre-check')).toBe(true);

  // No identity header — the worker never saw a submission.
  await expect(page.getByTestId('identity-nickname')).toHaveCount(0);
  await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
});

// -----------------------------------------------------------------------------
// (f) Recovery — failure followed by a valid export shows the heading
// -----------------------------------------------------------------------------

test('(f) after a failure, dropping a valid export loads the identity header and clears the banner', async ({
  page,
}) => {
  // First, fail.
  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hi'),
  });
  await expect(page.getByTestId('failure-banner')).toBeVisible();

  // Now drop a valid export.
  await page.getByTestId('file-input').setInputFiles({
    name: 'sample-export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildSampleExport()),
  });

  await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
  await expect(page.getByTestId('failure-banner')).toHaveCount(0);

  // The import region moved with the dataset: the banner was shown from the
  // empty-state detail pane, and the slim bar now lives in the list pane.
  await expect(page.getByTestId('list-pane').getByTestId('import-bar')).toHaveAttribute(
    'data-variant',
    'slim',
  );
  await expect(page.getByTestId('empty-state')).toHaveCount(0);
});

// -----------------------------------------------------------------------------
// (g) No auto-dismiss — the banner stays visible after a delay (D-06)
// -----------------------------------------------------------------------------

test('(g) after a failure the banner is still visible 1500 ms later (no auto-dismiss)', async ({
  page,
}) => {
  await page.getByTestId('file-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hi'),
  });
  await expect(page.getByTestId('failure-banner')).toBeVisible();

  // Wait past any plausible auto-dismiss window.
  await page.waitForTimeout(1500);

  await expect(page.getByTestId('failure-banner')).toBeVisible();
});

// -----------------------------------------------------------------------------
// (h) Click-to-browse path opens a single-file picker with .zip accept
// -----------------------------------------------------------------------------

test('(h) clicking the dropzone opens a single-file picker filtered to .zip; setting a valid file loads the identity header', async ({
  page,
}) => {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('dropzone').click(),
  ]);

  expect(await chooser.isMultiple()).toBe(false);
  const inputAccept = await page.getByTestId('file-input').getAttribute('accept');
  expect(inputAccept).toBe('.zip');

  await chooser.setFiles({
    name: 'sample-export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(buildSampleExport()),
  });

  await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
});

// -----------------------------------------------------------------------------
// (i) Drag-and-drop path with a single valid export
// -----------------------------------------------------------------------------

test('(i) dropping a single valid export via dropFiles loads the identity header', async ({
  page,
}) => {
  const sample = Array.from(buildSampleExport());
  await dropFiles(page, page.getByTestId('dropzone'), [
    { name: 'sample-export.zip', mimeType: 'application/zip', bytes: sample },
  ]);

  await expect(page.getByTestId('identity-nickname')).toHaveText(SAMPLE_NICKNAME);
});

// -----------------------------------------------------------------------------
// (j) A drop OUTSIDE the dropzone is prevented at the window level
// -----------------------------------------------------------------------------

test('(j) a stray drop / dragover on document.body is prevented; no banner or identity header appears', async ({
  page,
}) => {
  const observed = await page.evaluate(() => {
    const dt = new DataTransfer();

    // The <svelte:window> handler runs as a bubble-phase listener on
    // window — last in the propagation chain. We install capture
    // listeners on document (false at capture time) and bubble
    // listeners on window (true once the window handler has run),
    // and we look for ANY entry where defaultPrevented became true.
    // That's the proof that the window handler fired.
    const log: Array<{ phase: string; event: string; defaultPrevented: boolean }> = [];

    const record =
      (phase: string) =>
      (event: string) =>
      (e: Event): void => {
        log.push({ phase, event, defaultPrevented: e.defaultPrevented });
      };

    document.addEventListener('drop', record('capture')('drop'), { capture: true });
    document.addEventListener('dragover', record('capture')('dragover'), { capture: true });
    window.addEventListener('drop', record('bubble')('drop'));
    window.addEventListener('dragover', record('bubble')('dragover'));

    const dragover = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });

    document.body.dispatchEvent(dragover);
    document.body.dispatchEvent(drop);

    return { log };
  });

  // By the time the window bubble-phase listener saw the event, the
  // Svelte handler had already called preventDefault — that flips
  // defaultPrevented to true.
  expect(
    observed.log.some((l) => l.phase === 'bubble' && l.event === 'dragover' && l.defaultPrevented),
  ).toBe(true);
  expect(
    observed.log.some((l) => l.phase === 'bubble' && l.event === 'drop' && l.defaultPrevented),
  ).toBe(true);

  // Nothing was submitted; the page is still in its idle state.
  await expect(page.getByTestId('failure-banner')).toHaveCount(0);
  await expect(page.getByTestId('identity-nickname')).toHaveCount(0);
  await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
});
