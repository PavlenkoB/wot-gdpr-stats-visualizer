import '../_support/pin-locale';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  SAMPLE_CREATED_DATE,
  SAMPLE_FILE_COUNTS,
  SAMPLE_NICKNAME,
  SAMPLE_REGION,
  SAMPLE_ROW_COUNTS,
  buildLongTextExport,
  buildMissingPaymentHistoryExport,
  buildOnlySupportedExport,
  buildRenamedRootExport,
  buildSampleExport,
  buildTruncatedExport,
  buildZeroRowPaymentExport,
} from '../../fixtures/export-fixtures.ts';
import {
  ABOUT_NAME_CALENDAR,
  CALENDAR_BASIS_CAPTION,
  CALENDAR_KEYBOARD_HINT,
  DUPLICATE_BANNER_MESSAGE,
  EMPTY_STATE_PRIVACY,
  GENERIC_FAILURE_MESSAGE,
  UNSUPPORTED_NONE_DETECTED,
  IDENTITY_SKELETON_TITLE,
  formatAboutThis,
  formatImportSummary,
  formatProvenanceFrom,
  formatSectionStatus,
} from '../../../src/lib/ui-copy.ts';
import { NAV_ORDER } from '../../../src/lib/shell/dashboard-status.ts';
import {
  PANE_IDS,
  PANE_ORDER,
  PANE_SECTION,
  type PaneId,
} from '../../../src/lib/shell/selection-state.ts';
import {
  SYNTHETIC_ZIP_NAME,
  detailPane,
  expectSelected,
  gotoApp,
  importExport,
  listRow,
  openSection,
  playtimeBlock,
  replaceExport,
  startOver,
  waitForImported,
} from '../_support/helpers.ts';
import { SCALE_5K_SPEC, buildSessionsExport } from '../../fixtures/sessions-fixtures.ts';
import { OVERVIEW_SCALE_PX, SCALE_PX } from '../../helpers/components.ts';

// =============================================================================
// 08-02 - the master-detail shell: selection, mounting and persistence
// =============================================================================
//
// The page is a list pane and a detail pane. These tests assert what the user
// can observe: which row is current, which pane is on screen, and which
// sections are actually in the DOM (D-01: only the selected pane's section is
// mounted, the rest are absent rather than hidden).

/**
 * The sizes the Overview page is measured against. The Overview shows its own
 * scale (12 / 14 / 32 / 56px, 13-UI-SPEC) BESIDE the list pane, which keeps the
 * shared scale, and the check is page-wide, so the Overview page may show text on
 * EITHER approved scale. Which one an element belongs to is decided BY FILE: the
 * source-level guard (`phase8-ui-review-guards.test.ts`) owns that per-file rule.
 */
const OVERVIEW_PAGE_SCALE: readonly number[] = [...SCALE_PX, ...OVERVIEW_SCALE_PX];

/** Every other pane is held to the shared 14 / 18 / 26 / 30px scale alone. */
const BASE_SCALE: readonly number[] = [...SCALE_PX];

/**
 * Every visible element that shows text (a non-blank direct text node) and every
 * visible control (button, input, select, textarea, summary) whose computed
 * font-size is NOT on the given scale (08-UI-SPEC Typography; the Overview's own
 * scale is 13-UI-SPEC). An empty list is the contract: no 16px page default and
 * no 13.33px native control. The scale defaults to the Overview page's.
 */
async function offScaleText(
  page: Page,
  scale: readonly number[] = OVERVIEW_PAGE_SCALE,
): Promise<string[]> {
  return page.evaluate(
    ({ allowed }) => {
      const allowedSet = new Set<number>(allowed);
      const controls = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);
      const skipped = new Set(['SCRIPT', 'STYLE', 'TITLE', 'NOSCRIPT', 'HEAD']);
      const off: string[] = [];
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (skipped.has(el.tagName.toUpperCase())) continue;
        if (!el.checkVisibility()) continue;
        const hasText = Array.from(el.childNodes).some(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
        );
        if (!hasText && !controls.has(el.tagName.toUpperCase())) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (!allowedSet.has(size)) {
          const testId = el.getAttribute('data-testid') ?? '';
          off.push(
            `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '')}[${testId}] ${size}px`,
          );
        }
      }
      return off;
    },
    { allowed: [...scale] },
  );
}

/** Offer a file through the confirm panel and commit it (a replace attempt). */
async function offerThroughConfirm(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
  await expect(page.getByTestId('confirm-panel')).toBeVisible();
  await page.getByTestId('confirm-commit').click();
}

/**
 * WR-04 pin (quick 261009-qbo): the element lies fully inside the viewport AND
 * inside the list pane's box. At 900px and wider the import region is a sticky
 * footer of the list pane (Amendment A-2), so a confirm panel, a duplicate
 * notice or a failure banner can never be pushed off screen on a short window.
 */
async function expectInViewportAndListPane(page: Page, target: Locator): Promise<void> {
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const box = await target.boundingBox();
      const pane = await page.getByTestId('list-pane').boundingBox();
      if (box === null || pane === null) return false;
      const eps = 0.5;
      return (
        box.x >= -eps &&
        box.y >= -eps &&
        box.x + box.width <= viewport.width + eps &&
        box.y + box.height <= viewport.height + eps &&
        box.x >= pane.x - eps &&
        box.y >= pane.y - eps &&
        box.x + box.width <= pane.x + pane.width + eps &&
        box.y + box.height <= pane.y + pane.height + eps
      );
    })
    .toBe(true);
}

/**
 * Selection follows focus, read in ONE non-retrying evaluate (quick 261009-0qw).
 *
 * The retrying `toBeFocused` runs first, so the row is known to hold focus; the
 * single read after it then asserts that exactly one list row is `aria-current`
 * and that it is the focused one. That order encodes "the selection is set no
 * later than focus lands" without a flaky fixed wait: a selection that trailed
 * the focus by one keypress would be caught here, where the auto-retrying
 * `expectSelected` would wait it out and pass.
 */
async function expectSelectionIsFocus(page: Page, pane: PaneId): Promise<void> {
  await expect(listRow(page, pane)).toBeFocused();
  const state = await page.evaluate(() => ({
    current: Array.from(document.querySelectorAll('[data-testid="list-nav"] [aria-current]')).map(
      (el) => el.getAttribute('data-testid'),
    ),
    focused: document.activeElement?.getAttribute('data-testid') ?? null,
  }));
  expect(state.current).toEqual([`list-row-${pane}`]);
  expect(state.focused).toBe(`list-row-${pane}`);
}

test.describe('master-detail navigation', () => {
  test('(tracer) import lands on Overview, opening Playtime mounts only Playtime, nothing persists', async ({
    page,
  }) => {
    await gotoApp(page);

    // Before any import: nine rows, every one muted by the shared derivation.
    await expect(page.locator('[data-testid^="list-row-"]')).toHaveCount(9);
    await expect(page.locator('[data-testid^="list-row-"].muted')).toHaveCount(9);

    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
    await expect(page.getByTestId('identity-header')).toHaveAttribute('data-variant', 'loaded');

    // Landing view: Overview is current, and it is the only row that is.
    await expectSelected(page, 'overview');
    await expect(detailPane(page)).toHaveAttribute('data-pane', 'overview');

    // Open Playtime: the selection moves and exactly that pane's section mounts.
    await openSection(page, 'playtime');
    await expectSelected(page, 'playtime');
    await expect(page.getByTestId('dashboard-section-activity-history')).toHaveCount(1);
    await expect(page.getByTestId('playtime')).toHaveCount(1);

    // D-01: every other section is absent, not hidden.
    await expect(page.getByTestId('dashboard-section-financial-data')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-section-player-statistics')).toHaveCount(0);
    await expect(page.getByTestId('login-history')).toHaveCount(0);

    // D-03: selection is component state and leaves no footprint.
    expect(await page.evaluate(() => location.hash)).toBe('');
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });

  test('(mount) switching panes unmounts the old section and remounts on return', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

    await openSection(page, 'playtime');
    await expect(page.getByTestId('playtime')).toHaveCount(1);

    await openSection(page, 'finance');
    await expect(page.getByTestId('dashboard-section-financial-data')).toHaveCount(1);
    await expect(page.getByTestId('dashboard-section-activity-history')).toHaveCount(0);
    await expect(page.getByTestId('playtime')).toHaveCount(0);

    // Switching remounts: the block is back, and asks its own channel again.
    await openSection(page, 'playtime');
    await expect(page.getByTestId('playtime')).toHaveCount(1);
    await expect(page.getByTestId('dashboard-section-financial-data')).toHaveCount(0);
  });

  test('(lifecycle) a replace resets to Overview; a duplicate and a failed replace keep the selection', async ({
    page,
  }) => {
    // WR-04: a short window. The notices must stay on screen and in the list pane.
    await page.setViewportSize({ width: 1280, height: 600 });
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
    await openSection(page, 'finance');

    // (1) A genuinely different archive replaces the dataset: back to Overview.
    // The array is kept so step 2 can offer the very same bytes again; two
    // builder calls within one second can produce identical bytes, because the
    // archive's mtime stamp has one-second resolution.
    const renamed = buildRenamedRootExport();
    await replaceExport(page, 'renamed.zip', renamed);
    await expectSelected(page, 'overview');

    // (2) Re-open Finance, then offer the SAME bytes: a duplicate keeps it.
    await openSection(page, 'finance');
    await offerThroughConfirm(page, 'renamed.zip', renamed);
    const duplicate = page.getByTestId('duplicate-notice');
    await expect(duplicate).toBeVisible({ timeout: 30_000 });
    await expect(duplicate).toHaveText(DUPLICATE_BANNER_MESSAGE);
    await expectInViewportAndListPane(page, duplicate);
    await expectSelected(page, 'finance');
    await expect(detailPane(page)).toHaveAttribute('data-pane', 'finance');

    // (3) A failed replace keeps it too.
    await offerThroughConfirm(page, 'truncated.zip', buildTruncatedExport());
    const banner = page.getByTestId('failure-banner');
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toHaveText(GENERIC_FAILURE_MESSAGE);
    await expectInViewportAndListPane(page, banner);
    await expectSelected(page, 'finance');
    await expect(listRow(page, 'finance')).toHaveAttribute('aria-current', 'true');
  });

  test('(panes) each pane mounts exactly its own section, with a provenance line', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
    expect(await offScaleText(page), 'Overview text is on the type scale').toEqual([]);

    // The canonical folder each data pane reads. Typed here, not imported: the
    // rendered provenance is the contract.
    const folderOf: Partial<Record<PaneId, string>> = {
      playtime: 'Activity_history',
      'login-history': 'Activity_history',
      vehicles: 'Player_statistics',
      finance: 'Financial_data',
      payments: 'Payment_history',
      'device-info': 'Device_info',
      account: 'User_Info',
    };
    const panes: PaneId[] = [
      'vehicles',
      'finance',
      'payments',
      'device-info',
      'account',
      'login-history',
      'playtime',
      'not-yet-supported',
    ];

    for (const pane of panes) {
      await openSection(page, pane);
      await expect(detailPane(page)).toHaveAttribute('data-pane', pane);
      expect(await offScaleText(page, BASE_SCALE), `${pane} text is on the type scale`).toEqual([]);

      // Exactly the pane's own section root exists; the other six do not.
      const own = PANE_SECTION[pane];
      for (const section of NAV_ORDER) {
        await expect(page.getByTestId('dashboard-section-' + section)).toHaveCount(
          section === own ? 1 : 0,
        );
      }

      const folder = folderOf[pane];
      if (folder === undefined) continue;
      // `From <Folder> ·` followed by the import counts, never a raw-folder heading.
      const expected = `${formatProvenanceFrom(folder)} ${formatImportSummary(
        SAMPLE_FILE_COUNTS[folder]!,
        SAMPLE_ROW_COUNTS[folder]!,
      )}`;
      const provenance = page.getByTestId('provenance');
      await expect(provenance).toHaveCount(1);
      await expect(provenance).toHaveText(new RegExp('^' + escapeRegExp(expected)));
      await expect(page.locator('[data-testid^="dashboard-section-"] h2')).not.toHaveText(folder);
    }
  });

  test('(wording) an absent folder and an empty folder read differently in the pane and the row', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildMissingPaymentHistoryExport());
    await openSection(page, 'payments');

    const absent = formatSectionStatus('no-export', 'Payment_history');
    await expect(page.getByTestId('dashboard-section-payment-history')).toHaveAttribute(
      'data-status',
      'no-export',
    );
    await expect(page.getByTestId('section-status')).toHaveText(absent);
    await expect(listRow(page, 'payments')).toContainText(absent);
    expect(absent).toBe('Not in this export');

    // Present but with no rows is a different statement (DATA-04).
    await replaceExport(page, 'zero-rows.zip', buildZeroRowPaymentExport());
    await openSection(page, 'payments');
    const empty = formatSectionStatus('empty', 'Payment_history');
    await expect(page.getByTestId('dashboard-section-payment-history')).toHaveAttribute(
      'data-status',
      'empty',
    );
    await expect(page.getByTestId('section-status')).toHaveText(empty);
    await expect(listRow(page, 'payments')).toContainText(empty);
    expect(empty).not.toBe(absent);

    // An export with no unsupported folders says so: the row is muted and its
    // visible text gives the reason, and opening it shows the greyed panel with
    // the same words.
    await replaceExport(page, 'only-supported.zip', buildOnlySupportedExport());
    await expect(listRow(page, 'not-yet-supported')).toHaveClass(/muted/);
    await expect(listRow(page, 'not-yet-supported')).toContainText(UNSUPPORTED_NONE_DETECTED);
    await openSection(page, 'not-yet-supported');
    await expect(detailPane(page)).toContainText(UNSUPPORTED_NONE_DETECTED);
  });

  test('(long-text) nothing overflows sideways at 375px and 720px with untrusted long text on every pane', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildLongTextExport());

    for (const width of [375, 720]) {
      await page.setViewportSize({ width, height: 800 });

      const measure = async (where: string): Promise<void> => {
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(
          scrollWidth,
          `${where} at ${width}px: scrollWidth ${scrollWidth} exceeds the viewport`,
        ).toBeLessThanOrEqual(width);
      };

      // On the phone this is the list screen; at 720px it is the stacked layout.
      await measure('list screen');
      for (const pane of PANE_IDS) {
        await openSection(page, pane);
        await measure(`pane ${pane}`);
      }
    }
  });

  test('(keyboard) j, k and the arrows walk the list, clamp at the ends and are ignored elsewhere', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
    // Keys must never be sent on the strength of the list pane or a list row
    // existing: both exist in the empty state, where the selection is pinned to
    // Overview. `openSection` waits for the loaded dashboard first.
    await openSection(page, 'overview');

    // Record, in the bubble phase after the nav's own handler has run, whether
    // each keydown was consumed. This is a test-side probe only.
    await page.evaluate(() => {
      const probe: boolean[] = [];
      (window as unknown as { __consumed: boolean[] }).__consumed = probe;
      window.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') probe.push(event.defaultPrevented);
      });
    });

    await listRow(page, 'overview').focus();

    await page.keyboard.press('j');
    await expectSelected(page, 'playtime');
    await expect(listRow(page, 'playtime')).toBeFocused();
    await expectSelectionIsFocus(page, 'playtime');

    await page.keyboard.press('ArrowDown');
    await expectSelected(page, 'login-history');
    await expect(listRow(page, 'login-history')).toBeFocused();
    await expectSelectionIsFocus(page, 'login-history');

    await page.keyboard.press('k');
    await expectSelected(page, 'playtime');
    await expectSelectionIsFocus(page, 'playtime');
    await page.keyboard.press('ArrowUp');
    await expectSelected(page, 'overview');
    await expect(listRow(page, 'overview')).toBeFocused();
    await expectSelectionIsFocus(page, 'overview');

    // Clamp at the first row: no wrap to the footer.
    await page.keyboard.press('k');
    await expectSelected(page, 'overview');
    await expectSelectionIsFocus(page, 'overview');
    await page.keyboard.press('ArrowUp');
    await expectSelectionIsFocus(page, 'overview');

    // Nine presses from the first row reach the last and stay there; after each
    // one the selected row is the focused row (the walk follows the pane order,
    // clamped at the last). The sample export's list has the Warships crews and
    // storage row after Vehicles and no HEAT row, so it is ten rows (plan 11-11).
    // The Perks row is absent too: the sample export holds no Surveys file, so
    // the worker published no Perks pane (12-02). It holds no Account timeline
    // file either, so that row is absent too (12-13).
    const walk = PANE_ORDER.filter(
      (id) => id !== 'heat' && id !== 'perks' && id !== 'account-timeline',
    );
    for (let i = 0; i < walk.length - 1; i += 1) {
      await page.keyboard.press('j');
      await expectSelectionIsFocus(page, walk[Math.min(i + 1, walk.length - 1)]!);
    }
    await expectSelected(page, 'not-yet-supported');
    await expect(listRow(page, 'not-yet-supported')).toBeFocused();
    await page.keyboard.press('j');
    await expectSelected(page, 'not-yet-supported');
    await expectSelectionIsFocus(page, 'not-yet-supported');

    // ArrowDown is consumed even when it does nothing, so the page cannot scroll.
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowDown');
    await expectSelectionIsFocus(page, 'not-yet-supported');
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    expect(
      await page.evaluate(() => (window as unknown as { __consumed: boolean[] }).__consumed),
    ).not.toContain(false);
    await expectSelected(page, 'not-yet-supported');

    // A modified key is somebody else's shortcut.
    await page.keyboard.press('Control+k');
    await expectSelected(page, 'not-yet-supported');

    // D-05: no page-wide handler. The same keys do nothing from the detail pane.
    await listRow(page, 'playtime').click();
    await expectSelected(page, 'playtime');
    await detailPane(page).focus();
    await page.keyboard.press('j');
    await page.keyboard.press('ArrowDown');
    await expectSelected(page, 'playtime');
    await expect(detailPane(page)).toBeFocused();
  });

  test('(enter-escape) Enter goes into the detail, Escape comes back, the hint and skip link behave', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
    await openSection(page, 'playtime');

    // Enter on a row: focus lands in the detail, the selection stands, no hash.
    await listRow(page, 'playtime').focus();
    await expect(page.getByTestId('kbd-hint')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(detailPane(page)).toBeFocused();
    await expectSelected(page, 'playtime');
    expect(await page.evaluate(() => location.hash)).toBe('');

    // The hint belongs to the nav: with focus in the detail it is hidden.
    await expect(page.getByTestId('kbd-hint')).toBeHidden();

    // Escape in the detail pane returns focus to the selected row.
    await page.keyboard.press('Escape');
    await expect(listRow(page, 'playtime')).toBeFocused();
    await expect(page.getByTestId('kbd-hint')).toBeVisible();

    // The skip link is hidden until focused, and writes no hash.
    const skip = page.getByTestId('skip-to-detail');
    await skip.focus();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(detailPane(page)).toBeFocused();
    expect(await page.evaluate(() => location.hash)).toBe('');
    await expectSelected(page, 'playtime');
  });

  test('(chart-chrome) the calendar keeps its basis caption, tucks its keyboard hint into a disclosure, and Escape stays in the chart', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSessionsExport(SCALE_5K_SPEC).bytes);
    await openSection(page, 'playtime');
    await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');

    // The basis caption is requirement-bearing (Phase 4 D-01): visible text, not collapsed.
    await expect(page.getByText(CALENDAR_BASIS_CAPTION, { exact: true })).toBeVisible();

    // The keyboard hint sits in an "About this calendar" disclosure with a 44px summary.
    const about = page.getByTestId('about-calendar');
    await expect(about).toBeVisible();
    const summary = about.locator('summary');
    await expect(summary).toHaveText(formatAboutThis(ABOUT_NAME_CALENDAR));
    const box = await summary.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Closed: the hint is in the DOM (the chart's accessible description) but not visible.
    const hint = about.getByText(CALENDAR_KEYBOARD_HINT, { exact: true });
    await expect(hint).toHaveCount(1);
    await expect(about).toContainText(CALENDAR_KEYBOARD_HINT);
    await expect(hint).toBeHidden();

    // The grid's aria-describedby still resolves to the hint text while the details is closed.
    const grid = page.getByTestId('calendar-chart').locator('svg[role="grid"]').first();
    const describedBy = await grid.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(
      await page.evaluate(
        (id) => document.getElementById(id as string)?.textContent ?? null,
        describedBy,
      ),
    ).toBe(CALENDAR_KEYBOARD_HINT);

    // Opening the summary shows the hint.
    await summary.click();
    await expect(hint).toBeVisible();

    // Escape inside a calendar cell stays in the chart.
    await page.getByTestId('calendar-cell').first().focus();
    await page.keyboard.press('Escape');

    // The chart owns Escape (it dismisses its tooltip); the list does not take it.
    await expect(listRow(page, 'playtime')).not.toBeFocused();
    expect(
      await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null),
    ).toBe('calendar-cell');

    // Regression: the list <nav> is a 100vh sticky column on desktop, so a focus
    // clear that measured the tag `nav` would scroll the page on every arrow key.
    // Park the chart high in the viewport, focus a cell whose top is 200-450px
    // down, and move with ArrowRight: the page must not move.
    await page.evaluate(() => {
      const chart = document.querySelector('[data-testid="calendar-chart"]')!;
      window.scrollTo({
        top: window.scrollY + chart.getBoundingClientRect().top - 100,
        left: 0,
        behavior: 'instant',
      });
    });
    const pickedDate = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('[data-testid="calendar-cell"]'));
      const hit = cells.find((cell) => {
        const box = cell.getBoundingClientRect();
        return box.top >= 200 && box.top <= 450 && box.left >= 0 && box.right <= innerWidth - 24;
      });
      return hit?.getAttribute('data-date') ?? null;
    });
    expect(pickedDate).not.toBeNull();
    const target = page.locator(`[data-testid="calendar-cell"][data-date="${pickedDate}"]`);
    await target.focus();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(0);
    await page.keyboard.press('ArrowRight');
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(
      Math.abs(scrollAfter - scrollBefore),
      `scrollY moved from ${scrollBefore} to ${scrollAfter} on a keyboard move inside the calendar`,
    ).toBeLessThanOrEqual(1);

    // The token has its honest value and the year head parks at the very top.
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--nav-offset').trim(),
      ),
    ).toBe('16px');
    expect(
      await page.evaluate(() => {
        const head = document.querySelector('[data-testid^="calendar-year-head-"]');
        return head === null ? null : getComputedStyle(head).top;
      }),
    ).toBe('0px');
  });

  test('(empty-state) a first visit is a muted list and one large drop target; the import region follows the dataset', async ({
    page,
  }) => {
    await gotoApp(page);

    // First visit: the large drop target and the privacy sentence fill the detail.
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('dropzone-main')).toBeVisible();
    await expect(page.getByTestId('empty-state')).toContainText(EMPTY_STATE_PRIVACY);
    await expect(page.getByTestId('dropzone')).toHaveCount(1);
    await expect(page.getByTestId('file-input')).toHaveCount(1);
    await expect(page.getByTestId('dropzone-main').getByTestId('dropzone')).toHaveCount(1);
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');

    // The identity slot and all nine rows say that nothing is loaded.
    const header = page.getByTestId('identity-header');
    await expect(header).toHaveAttribute('data-variant', 'skeleton');
    await expect(header).toContainText(IDENTITY_SKELETON_TITLE);
    const rows = page.locator('[data-testid^="list-row-"]');
    await expect(rows).toHaveCount(9);
    for (const row of await rows.all()) {
      await expect(row).toHaveClass(/muted/);
      await expect(row).toContainText(formatSectionStatus('not-loaded', ''));
    }

    // With nothing loaded the selection stays on Overview, but j still walks the
    // focused row down the list (review CR-01: it used to stall on the second row).
    await listRow(page, 'overview').focus();
    await page.keyboard.press('j');
    await expect(listRow(page, 'playtime')).toBeFocused();
    await page.keyboard.press('j');
    await expect(listRow(page, 'login-history')).toBeFocused();
    await expectSelected(page, 'overview');

    // The empty-state heading is ink (the skeleton is told apart from the loaded
    // header by its words and by the muted prompt line under it, not by a muted
    // title). The prompt line keeps its muted treatment, which is not asserted.
    await expect(page.getByTestId('identity-title')).toHaveCSS('color', 'rgb(17, 17, 17)');

    // Importing moves the SAME region to the bottom of the list pane, slim.
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
    // A first import lands on Overview (Phase 8 D-03) even though the walk above
    // left focus on the Login history row. This is what the 08-UI-REVIEW
    // keyboard observation recorded: its script pressed keys before the import
    // landed (the list pane exists in the empty state), the import then reset the
    // selection to Overview, and the next press stepped from the focused row.
    await expectSelected(page, 'overview');
    await expect(page.getByTestId('empty-state')).toHaveCount(0);
    await expect(page.getByTestId('dropzone-main')).toHaveCount(0);
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim');
    await expect(page.getByTestId('list-pane').getByTestId('import-bar')).toHaveCount(1);
    await expect(page.getByTestId('dropzone')).toHaveCount(1);
    await expect(page.getByTestId('file-input')).toHaveCount(1);

    // The footer actions stay inside the fold (08-UI-REVIEW top fix 3): at
    // 1280x800 with the 8-row sample both actions and the compact dropzone are
    // fully on screen and the last row clears the footer once scrolled to; at 1280x600 the rows no
    // longer fit, and the sticky footer keeps the three controls visible anyway.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId('start-over')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('clear-data-control')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('dropzone')).toBeInViewport({ ratio: 1 });
    // Scrolled to the end, the last row clears the sticky footer. This holds at any
    // font metrics; whether the rows fit without scrolling depends on the platform's
    // system font (CI's Linux fallback is taller), so it is not asserted.
    await page.getByTestId('list-pane').evaluate((pane) => {
      pane.scrollTop = pane.scrollHeight;
    });
    const overlap = await page.evaluate(() => {
      const lastRow = document.querySelector('[data-testid="list-row-not-yet-supported"]');
      const region = document.querySelector('[data-testid="list-pane"] .import-region');
      return {
        rowBottom: lastRow!.getBoundingClientRect().bottom,
        regionTop: region!.getBoundingClientRect().top,
      };
    });
    expect(overlap.rowBottom).toBeLessThanOrEqual(overlap.regionTop + 1);
    await page.setViewportSize({ width: 1280, height: 600 });
    await expect(page.getByTestId('start-over')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('clear-data-control')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('dropzone')).toBeInViewport({ ratio: 1 });
    await page.setViewportSize({ width: 1280, height: 720 });

    // A confirmed clear brings it back to the detail, with focus on the dropzone.
    await startOver(page);
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'full');
    await expect(page.getByTestId('dropzone')).toHaveCount(1);
    await expect(page.getByTestId('file-input')).toHaveCount(1);
    await expect(page.getByTestId('dropzone')).toBeFocused();
    await expect(page.locator('[data-testid^="list-row-"].muted')).toHaveCount(9);
    await expect(header).toHaveAttribute('data-variant', 'skeleton');
  });

  test('(stability) replacing, cancelling and failing an import never blanks the list or the open section', async ({
    page,
  }) => {
    // WR-04: a short window (1280x600), so the pins below mean something.
    await page.setViewportSize({ width: 1280, height: 600 });
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
    await openSection(page, 'finance');
    const finance = page.getByTestId('dashboard-section-financial-data');
    await expect(finance).toBeVisible();

    // Offer a different valid archive. (A renamed-root export, because two
    // buildSampleExport calls within one second can produce identical bytes.)
    const other = buildRenamedRootExport();
    const offer = async (name: string, bytes: Uint8Array): Promise<void> => {
      await page.getByTestId('file-input').setInputFiles({
        name,
        mimeType: 'application/zip',
        buffer: Buffer.from(bytes),
      });
    };
    await offer('other.zip', other);

    // The confirm panel is in the list pane and fully on screen, so a destructive
    // answer can never be asked off screen (T-08-16). The old section stays put.
    const panel = page.getByTestId('confirm-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('list-pane').getByTestId('confirm-panel')).toHaveCount(1);
    await expectInViewportAndListPane(page, panel);
    await expect(finance).toBeVisible();

    // Cancelling returns focus to the dropzone and leaves the selection alone.
    await panel.getByTestId('confirm-cancel').click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId('dropzone')).toBeFocused();
    await expectSelected(page, 'finance');
    await expect(finance).toBeVisible();

    // Offer it again and commit. While it processes, a page-side observer records
    // what is on screen at every DOM change that shows the processing notice: the
    // ten rows (the sample's nine plus its Warships row) and the OLD finance
    // section must all still be there.
    await page.evaluate(() => {
      const w = window as unknown as { __during: { rows: number; finance: boolean }[] };
      w.__during = [];
      const sample = (): void => {
        if (document.querySelector('[data-testid="processing-status"]') === null) return;
        w.__during.push({
          rows: document.querySelectorAll('[data-testid^="list-row-"]').length,
          finance:
            document.querySelector('[data-testid="dashboard-section-financial-data"]') !== null,
        });
      };
      new MutationObserver(sample).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    });
    await offer('other.zip', other);
    await expect(panel).toBeVisible();
    await panel.getByTestId('confirm-commit').click();
    // WR-05: a confirmed replace leaves focus on the dropzone, not on <body>,
    // and it is still there once the import has landed.
    await expect(page.getByTestId('dropzone')).toBeFocused();
    await expect(page.getByTestId('processing-status')).toHaveCount(0, { timeout: 30_000 });
    await waitForImported(page);
    await expect(page.getByTestId('dropzone')).toBeFocused();
    const during = await page.evaluate(
      () => (window as unknown as { __during: { rows: number; finance: boolean }[] }).__during,
    );
    expect(during.length).toBeGreaterThan(0);
    for (const sample of during) {
      expect(sample).toEqual({ rows: 10, finance: true });
    }
    // The new dataset lands on Overview (R1).
    await expectSelected(page, 'overview');

    // A failed replace: the banner is in the notice slot, the slim region stays in
    // the list pane, and the rows, the nickname and the selection do not move.
    await openSection(page, 'vehicles');
    const nickname = (await page.getByTestId('identity-nickname').textContent()) ?? '';
    await offerThroughConfirm(page, 'truncated.zip', buildTruncatedExport());
    const banner = page.getByTestId('notice-slot').getByTestId('failure-banner');
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toHaveText(GENERIC_FAILURE_MESSAGE);
    await expectInViewportAndListPane(page, banner);
    await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim');
    await expect(page.getByTestId('list-pane').getByTestId('import-bar')).toHaveCount(1);
    // The failed replace left the sample's list alone: its nine rows plus the
    // Warships crews and storage row its two files earn (plan 11-11).
    await expect(page.locator('[data-testid^="list-row-"]')).toHaveCount(10);
    await expect(page.getByTestId('identity-nickname')).toHaveText(nickname);
    await expectSelected(page, 'vehicles');
    await expect(page.getByTestId('dashboard-section-player-statistics')).toBeVisible();
  });

  test('(overview) the landing view is the insights page; a tile opens its section and an absent source is one dashed row', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

    const overview = page.getByTestId('overview');
    await expect(overview).toBeVisible();
    await expect(detailPane(page)).toHaveAttribute('data-pane', 'overview');

    // The sample's legacy Sessions.csv names no game, so the Logged in hero
    // shows and the WoT habit tiles wait in the Time group's one dashed row.
    await expect(page.getByTestId('ov-tile-logged')).toBeVisible();
    const timeAbsent = page.getByTestId('ov-absent-time');
    await expect(timeAbsent).toContainText('Signature hour');
    await expect(timeAbsent).toContainText('session history');
    // The sample holds Orders, so that totals tile is a tile, not an absent row.
    await expect(page.getByTestId('ov-tile-ord')).toBeVisible();

    // Nothing the account card used to show reaches the Overview (the nickname
    // appears once in the document, in the list pane header).
    await expect(overview).not.toContainText(SAMPLE_NICKNAME);
    await expect(overview).not.toContainText(SAMPLE_REGION);
    await expect(overview).not.toContainText(SAMPLE_CREATED_DATE);

    // Expanding a tile and following its Open link selects that pane and moves
    // focus into it.
    await page.getByTestId('ov-tile-button-logged').click();
    await page.getByTestId('ov-tile-open-logged').click();
    await expectSelected(page, 'playtime');
    await expect(detailPane(page)).toHaveAttribute('data-pane', 'playtime');
    await expect(page.getByTestId('overview')).toHaveCount(0);
    await expect(detailPane(page)).toBeFocused();

    // A replace lands on the Overview again; a missing Payment_history turns the
    // Orders tile into a line in the Totals group's dashed row.
    await replaceExport(page, 'no-payments.zip', buildMissingPaymentHistoryExport());
    await expectSelected(page, 'overview');
    await expect(page.getByTestId('ov-absent-totals')).toContainText('Orders');
    await expect(page.getByTestId('ov-absent-totals')).toContainText('payment history');
    await expect(page.getByTestId('ov-tile-ord')).toHaveCount(0);
  });
});

test.describe('master-detail navigation (focus choreography at 800px)', () => {
  // A stacked layout: below 900px the list sits above the detail.
  test.use({ viewport: { width: 800, height: 900 } });

  test('(stacked) a pointer selection moves focus to the detail pane', async ({ page }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

    await listRow(page, 'finance').click();
    await expectSelected(page, 'finance');
    await expect(detailPane(page)).toBeFocused();
  });
});

test.describe('master-detail navigation (phone screens at 375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('(phone-screens) the list and the detail are separate screens joined by a back button', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

    // After the import the page shows the list screen, and nothing of the detail.
    await expect(page.getByTestId('list-pane')).toBeVisible();
    await expect(detailPane(page)).toBeHidden();
    await expect(page.getByTestId('back-button-sections')).toBeHidden();
    await expect(page.getByTestId('dashboard-section-activity-history')).toHaveCount(0);
    expect(
      await offScaleText(page, BASE_SCALE),
      'phone list screen text is on the type scale',
    ).toEqual([]);

    // j on the list screen moves the selection and does not switch screens. The
    // newly selected pane's content is still not mounted.
    await listRow(page, 'overview').focus();
    await page.keyboard.press('j');
    await expectSelected(page, 'playtime');
    await expect(listRow(page, 'playtime')).toBeFocused();
    await expect(page.getByTestId('list-pane')).toBeVisible();
    await expect(detailPane(page)).toBeHidden();
    await expect(page.getByTestId('dashboard-section-activity-history')).toHaveCount(0);

    // Selecting a row opens the detail screen with the back bar.
    await listRow(page, 'vehicles').click();
    await expect(page.getByTestId('list-pane')).toBeHidden();
    await expect(detailPane(page)).toBeVisible();
    await expect(detailPane(page)).toBeFocused();
    const back = page.getByTestId('back-button-sections');
    await expect(back).toBeVisible();
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('dashboard-section-player-statistics')).toBeVisible();
    expect(
      await offScaleText(page, BASE_SCALE),
      'phone detail screen text is on the type scale',
    ).toEqual([]);

    // The hidden-mount guard: the table measured a real height, so it drew rows.
    const scroller = page.getByTestId('vehicle-scroller');
    await expect(scroller).toBeVisible();
    expect((await scroller.boundingBox())!.height).toBeGreaterThan(0);
    await expect(page.getByTestId('vehicle-row').first()).toBeVisible();

    // Back returns to the list screen with focus on the selected row.
    await back.click();
    await expect(page.getByTestId('list-pane')).toBeVisible();
    await expect(listRow(page, 'vehicles')).toBeFocused();
    await expect(page.getByTestId('dashboard-section-player-statistics')).toHaveCount(0);

    // Re-selecting remounts the table, which measures again.
    await listRow(page, 'vehicles').click();
    await expect(page.getByTestId('vehicle-row').first()).toBeVisible();
    expect((await page.getByTestId('vehicle-scroller').boundingBox())!.height).toBeGreaterThan(0);
  });

  test('(phone-empty) a first visit shows the drop target, and the list screen follows an import', async ({
    page,
  }) => {
    await gotoApp(page);

    // No dead end: with nothing loaded the screen is the detail one, with the
    // dropzone and its file input in it.
    await expect(page.getByTestId('list-pane')).toBeHidden();
    await expect(page.getByTestId('dropzone')).toBeVisible();
    await expect(page.getByTestId('file-input')).toBeAttached();

    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
    await expect(page.getByTestId('list-pane')).toBeVisible();
    await expect(detailPane(page)).toBeHidden();
  });
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
