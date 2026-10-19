import '../_support/pin-locale';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  MA_EXPECTED_PLAYTIME,
  MA_NICKNAME_EU,
  MA_NICKNAME_NA,
  MA_ROOT_EU,
  MA_ROOT_NA,
  MA_ROOT_RU,
  MA_ROOTS_D16_ORDER,
  buildHeatOnlyExport,
  buildNewGamesThreeAccountExport,
  buildOneAccountExport,
  buildRealShapeThreeAccountExport,
} from '../../fixtures/multi-account-fixtures.ts';
import { NG3_EXPECTED, ng3PaneCanaryValues } from '../../fixtures/new-data-fixtures.ts';
import { maskIp } from '../../../src/lib/geo/ip.ts';
import * as copy from '../../../src/lib/ui-copy.ts';
import {
  SYNTHETIC_ZIP_NAME,
  countryList,
  detailPane,
  ensureListScreen,
  gotoApp,
  importExport,
  listRow,
  loginHistoryBlock,
  openSection,
  playerStatsBlock,
  replaceExport,
} from '../_support/helpers.ts';

// =============================================================================
// Phase 11, plan 11-11 - the browser proofs for the new game data
//
// THE LISTED BUDGET. This file holds EXACTLY three `test(...)` calls and no
// `test.describe` loop: the listed suite sat at 260 tests against the 264 the
// three CI limits cover (31 / 33 / 41 minutes), so this plan adds three and the
// limits do not move. A fourth test here would need the three limits raised
// together, never one (tests/unit/guards/ci-budget.test.ts). Every extra claim is
// a `test.step` inside one of the three.
//
// WHERE THE NUMBERS COME FROM. Every expected figure is a fixture literal
// (`NG3_EXPECTED`, `MA_EXPECTED_PLAYTIME`) or a formatter imported from the
// source, never a reading of the page: an expectation read from the page would
// pass whatever the page said.
//
// WHAT ONLY A BROWSER CAN PROVE
//   - PRIV-02: nothing leaves the page. Proved for these panes by the long test in
//     `tests/e2e/guards/zero-network.spec.ts`, which now opens every one of them.
//   - PRIV-01: a planted synthetic email or nickname, or a full HEAT address while
//     masked, is in neither the text nor the markup of a rendered pane.
//   - D-11: a table over 500 rows keeps the DOM at the window plus two spacers.
//   - the chips, the note and the 375px layout behave as the UI contract says.
// =============================================================================

/** The pane section's root, whichever pane is open. */
function pane(page: Page): Locator {
  return detailPane(page);
}

/** The text and the markup of the open pane, for the leak scans. */
async function surfaceOf(page: Page): Promise<{ text: string; html: string }> {
  const root = pane(page);
  return {
    text: await root.innerText(),
    html: await root.evaluate((el) => el.outerHTML),
  };
}

/** The account tag letter a root gets: its D-16 position, A for the first. */
function tagLetterOf(root: string): string {
  const index = MA_ROOTS_D16_ORDER.indexOf(root);
  if (index < 0) throw new Error(`${root} is not a root of the archive`);
  return String.fromCharCode(65 + index);
}

/** Every `data-testid` matching a prefix under a locator, in document order. */
async function testIdsUnder(root: Locator, prefix: string): Promise<string[]> {
  return root
    .locator(`[data-testid^="${prefix}"]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''));
}

/** The tag letter of every drawn data row of a card's table, in row order. */
async function rowTagLetters(card: Locator): Promise<string[]> {
  return card
    .locator('tbody tr:not(.spacer)')
    .evaluateAll((rows) =>
      rows.map(
        (row) =>
          row.querySelector('td.sticky-first [data-testid="account-tag"]')?.textContent?.trim() ??
          '',
      ),
    );
}

/** The page is never wider than its viewport. */
async function expectNoSidewaysScroll(page: Page, where: string): Promise<void> {
  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    viewport.scrollWidth,
    `${where}: the document is ${viewport.scrollWidth}px in a ${viewport.innerWidth}px viewport`,
  ).toBeLessThanOrEqual(viewport.innerWidth);
}

/** No planted canary value is in the open pane's text or markup. */
async function expectNoCanary(page: Page, where: string): Promise<void> {
  const { text, html } = await surfaceOf(page);
  const canaries = ng3PaneCanaryValues();
  expect(canaries.length, 'the canary list is not empty').toBeGreaterThan(20);
  for (const value of canaries) {
    expect(text, `${where}: text leaks ${value}`).not.toContain(value);
    expect(html, `${where}: markup leaks ${value}`).not.toContain(value);
  }
  expect(text, `${where}: the address canary in text`).not.toContain('203.0.113.250');
  expect(html, `${where}: the address canary in markup`).not.toContain('203.0.113.250');
}

const HEAT_CARD_TEST_IDS = [
  'heat-card-account-stats',
  'heat-card-battle-types',
  'heat-card-storage',
  'heat-card-geolocation',
];

test.describe('the new game data panes', () => {
  test('the HEAT pane', async ({ page }) => {
    // Three imports, a replace and several pane opens; explicit rather than
    // inherited so a slow runner cannot read as a product failure.
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildNewGamesThreeAccountExport());

    await test.step('the two rows sit between Vehicles and Finance with the typed counts', async () => {
      const ids = await testIdsUnder(page.getByTestId('list-nav'), 'list-row-');
      const at = (id: string): number => ids.indexOf(id);
      expect(at('list-row-vehicles'), 'Vehicles is listed').toBeGreaterThanOrEqual(0);
      expect(at('list-row-heat')).toBeGreaterThan(at('list-row-vehicles'));
      expect(at('list-row-warships-storage')).toBeGreaterThan(at('list-row-heat'));
      expect(at('list-row-finance')).toBeGreaterThan(at('list-row-warships-storage'));

      const heat = listRow(page, 'heat');
      await expect(heat).toContainText(copy.PANE_TITLES.heat);
      await expect(heat).toContainText(copy.formatRowCount(NG3_EXPECTED.heat.rowCount));
      await expect(heat).toContainText(copy.formatHeatRowSummary(NG3_EXPECTED.heat.fileCount));

      const wows = listRow(page, 'warships-storage');
      await expect(wows).toContainText(copy.PANE_TITLES['warships-storage']);
      await expect(wows).toContainText(copy.formatRowCount(NG3_EXPECTED.warshipsStorage.rowCount));
      await expect(wows).toContainText(
        copy.formatWowsStorageRowSummary(NG3_EXPECTED.warshipsStorage.fileCount),
      );
    });

    await test.step('four ready cards, provenance, the caption and the EU tag on every row', async () => {
      await openSection(page, 'heat');
      const block = page.getByTestId('heat-block');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

      expect(await testIdsUnder(block, 'heat-card-')).toEqual(HEAT_CARD_TEST_IDS);
      for (const id of HEAT_CARD_TEST_IDS) {
        await expect(block.getByTestId(id), id).toHaveAttribute('data-status', 'ready');
      }

      const provenance = pane(page).getByTestId('provenance');
      await expect(provenance).toContainText(
        copy.formatProvenanceFrom(copy.NEW_DATA_PROVENANCE_LABELS.heat),
      );
      await expect(provenance).toContainText(
        copy.formatImportSummary(NG3_EXPECTED.heat.fileCount, NG3_EXPECTED.heat.rowCount),
      );
      await expect(pane(page).getByTestId('combined-caption')).toHaveText(
        copy.formatCombinedCaption(3),
      );

      // The second account in D-16 order holds every HEAT record.
      const eu = tagLetterOf(MA_ROOT_EU);
      expect(eu).toBe('B');
      const stats = block.getByTestId('heat-card-account-stats');
      await expect(stats.getByTestId('account-tag')).toHaveCount(NG3_EXPECTED.roots.heat.length);
      await expect(stats.getByTestId('account-tag')).toHaveText(eu);
      for (const id of HEAT_CARD_TEST_IDS.slice(1)) {
        const letters = await rowTagLetters(block.getByTestId(id));
        expect(letters, `${id}: one tagged row per record`).toEqual([eu, eu, eu]);
      }
    });

    await test.step('masked by default: no full address in text or markup, the masked form present', async () => {
      const toggle = page.getByTestId('heat-mask-toggle');
      await expect(toggle).toHaveAttribute('data-masked', 'true');
      await expect(toggle).toHaveText(copy.MASK_TOGGLE_SHOW);

      const addresses = NG3_EXPECTED.geolocationAddresses;
      const { text, html } = await surfaceOf(page);
      const content = await page.content();
      for (const address of addresses) {
        expect(text, `${address} in the pane text`).not.toContain(address);
        expect(html, `${address} in the pane markup`).not.toContain(address);
        expect(content, `${address} in the page`).not.toContain(address);
        expect(text, `the masked form of ${address}`).toContain(maskIp(address));
      }
      await expectNoCanary(page, 'HEAT pane, masked');
    });

    await test.step('the toggle reveals them, and it is the one reveal Login history reads', async () => {
      const toggle = page.getByTestId('heat-mask-toggle');
      await toggle.click();
      await expect(toggle).toHaveAttribute('data-masked', 'false');
      await expect(toggle).toHaveText(copy.MASK_TOGGLE_HIDE);
      await expect(page.getByTestId('heat-status')).toHaveText(copy.MASK_ANNOUNCE_SHOWN);

      const shown = await surfaceOf(page);
      for (const address of NG3_EXPECTED.geolocationAddresses) {
        expect(shown.text, `${address} after the reveal`).toContain(address);
      }
      await expectNoCanary(page, 'HEAT pane, revealed');

      // Login history reads the same flag, so it opens revealed...
      await openSection(page, 'login-history');
      await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      const loginToggle = page.getByTestId('login-mask-toggle');
      await expect(loginToggle).toHaveAttribute('data-masked', 'false');

      // ...and shows none of the HEAT addresses, in the table, the tiles or the
      // country list (D-04).
      const loginText = await loginHistoryBlock(page).innerText();
      const countries = (await countryList(page).textContent()) ?? '';
      for (const address of NG3_EXPECTED.geolocationAddresses) {
        expect(loginText, `${address} in Login history`).not.toContain(address);
        expect(countries, `${address} in the country list`).not.toContain(address);
      }
      expect(loginText, 'no HEAT range in Login history').not.toContain('203.0.113.');

      // Pressing it there re-masks it here: one reveal, two panes.
      await loginToggle.click();
      await expect(loginToggle).toHaveAttribute('data-masked', 'true');
      await openSection(page, 'heat');
      await expect(page.getByTestId('heat-mask-toggle')).toHaveAttribute('data-masked', 'true');
      const again = await surfaceOf(page);
      for (const address of NG3_EXPECTED.geolocationAddresses) {
        expect(again.text, `${address} after the re-mask`).not.toContain(address);
      }
    });

    let loginCountWithHeat = '';
    await test.step('the Warships pane is clean too, and the Login totals are the HEAT-less ones', async () => {
      await openSection(page, 'warships-storage');
      await expect(page.getByTestId('warships-storage-block')).toHaveAttribute(
        'data-state',
        'ready',
        { timeout: 30_000 },
      );
      await expectNoCanary(page, 'Warships pane');

      await openSection(page, 'login-history');
      await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      loginCountWithHeat = (await page.getByTestId('login-count').innerText()).trim();
      expect(loginCountWithHeat.length, 'the login count line is read').toBeGreaterThan(0);
    });

    await test.step('the same accounts without the new files: no rows, Overview, masked, same Login totals', async () => {
      // Reveal first, so the re-mask on the new dataset is a real change.
      await openSection(page, 'heat');
      await page.getByTestId('heat-mask-toggle').click();
      await expect(page.getByTestId('heat-mask-toggle')).toHaveAttribute('data-masked', 'false');

      await replaceExport(page, 'real-shape.zip', buildRealShapeThreeAccountExport());
      await expect(listRow(page, 'heat')).toHaveCount(0);
      await expect(listRow(page, 'warships-storage')).toHaveCount(0);
      await expect(detailPane(page)).toHaveAttribute('data-pane', 'overview');

      await openSection(page, 'login-history');
      await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      await expect(page.getByTestId('login-mask-toggle')).toHaveAttribute('data-masked', 'true');
      // HEAT geolocation addresses are in no Login total (D-01, D-04): the count
      // line is the one the same accounts give without those files.
      await expect(page.getByTestId('login-count')).toHaveText(loginCountWithHeat);
    });

    await test.step('a one-account replace removes both rows and returns to Overview', async () => {
      await openSection(page, 'vehicles');
      await replaceExport(page, 'one-account.zip', buildOneAccountExport());
      await expect(listRow(page, 'heat')).toHaveCount(0);
      await expect(listRow(page, 'warships-storage')).toHaveCount(0);
      await expect(detailPane(page)).toHaveAttribute('data-pane', 'overview');
      await openSection(page, 'login-history');
      await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      await expect(page.getByTestId('login-mask-toggle')).toHaveAttribute('data-masked', 'true');
    });

    expect(pageErrors, 'no uncaught page error').toEqual([]);
  });

  test('the Warships pane, Warplanes and the no-table note', async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await gotoApp(page);
    await importExport(
      page,
      SYNTHETIC_ZIP_NAME,
      buildNewGamesThreeAccountExport({ largeStorageRows: 3000 }),
    );

    await test.step('both cards are ready and every data row carries its account tag', async () => {
      await openSection(page, 'warships-storage');
      const block = page.getByTestId('warships-storage-block');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expect(block.getByTestId('wows-card-crews')).toHaveAttribute('data-status', 'ready');
      await expect(block.getByTestId('wows-card-storage')).toHaveAttribute('data-status', 'ready');
      await expect(pane(page).getByTestId('provenance')).toContainText(
        copy.formatImportSummary(
          NG3_EXPECTED.warshipsStorageLarge.fileCount,
          NG3_EXPECTED.warshipsStorageLarge.rowCount,
        ),
      );

      // RU and NA hold the files, so the crews table is the two accounts' three
      // rows each, in identity-header order.
      const [ru, na] = [tagLetterOf(MA_ROOT_RU), tagLetterOf(MA_ROOT_NA)];
      expect(await rowTagLetters(block.getByTestId('wows-card-crews'))).toEqual([
        ru,
        ru,
        ru,
        na,
        na,
        na,
      ]);
    });

    await test.step('a 3,000-row table is windowed: bounded DOM, no per-row SVG, the last row reachable', async () => {
      const block = page.getByTestId('warships-storage-block');
      const card = block.getByTestId('wows-card-storage');
      const scroller = card.getByTestId('new-data-table');
      const rows = NG3_EXPECTED.warshipsStorageTableRowsLarge;

      await expect(card.locator('table')).toHaveAttribute('aria-rowcount', String(rows + 1));
      const atTop = await card.locator('tbody tr').count();
      expect(atTop, 'the window plus two spacers, not the table').toBeLessThanOrEqual(40);
      await expect(block.locator('svg'), 'nothing is drawn per row').toHaveCount(0);
      await expectNoSidewaysScroll(page, 'the Warships pane at the default width');

      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const lastDrawn = card.locator('tbody tr:not(.spacer)').last();
      await expect(lastDrawn, 'the last row is in the DOM after scrolling').toHaveAttribute(
        'aria-rowindex',
        String(rows + 1),
      );
      expect(
        await card.locator('tbody tr').count(),
        'still bounded at the end',
      ).toBeLessThanOrEqual(40);
      // The last row is NA's: it is ordered after RU's 3,000.
      expect(await rowTagLetters(card).then((letters) => letters.at(-1))).toBe(
        tagLetterOf(MA_ROOT_NA),
      );
      await expect(card.locator('tbody tr:not(.spacer)').first()).not.toHaveAttribute(
        'aria-rowindex',
        '2',
      );

      await page.setViewportSize({ width: 375, height: 812 });
      await expectNoSidewaysScroll(page, 'the Warships pane at 375px');
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    await test.step('Warplanes shows one Account statistics block, for the one account that holds it', async () => {
      await openSection(page, 'vehicles');
      const stats = playerStatsBlock(page);
      await expect(stats).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      const select = stats.getByTestId('player-stats-title-selector');
      await select.selectOption('wowp');
      const account = stats.getByTestId('wowp-account-stats');
      await expect(account).toHaveCount(NG3_EXPECTED.warplanesAccountCount, { timeout: 30_000 });

      // It carries the RU account's tag and nothing that names the player.
      const wrapper = account.locator('xpath=..');
      await expect(wrapper.getByTestId('account-tag')).toHaveText(tagLetterOf(MA_ROOT_RU));
      const text = await wrapper.innerText();
      for (const name of [MA_NICKNAME_EU, MA_NICKNAME_NA]) {
        expect(text, `the block names ${name}`).not.toContain(name);
      }
      for (const value of ng3PaneCanaryValues()) {
        expect(text, `the block leaks ${value}`).not.toContain(value);
      }
      await expectNoCanary(page, 'Vehicles on Warplanes');
      await expect(stats.getByRole('alert'), 'no error element').toHaveCount(0);
      await expect(stats.getByTestId('player-stats-error')).toHaveCount(0);

      await select.selectOption('wot');
      await expect(stats.getByTestId('wowp-account-stats')).toHaveCount(0);
    });

    await test.step('under HEAT Vehicles keeps its title and says why, and choosing WoT replaces the filter', async () => {
      await openSection(page, 'vehicles');
      const stats = playerStatsBlock(page);
      const select = stats.getByTestId('player-stats-title-selector');
      await select.selectOption('wowp');
      await expect(stats.getByTestId('wowp-account-stats')).toHaveCount(1, { timeout: 30_000 });

      await openSection(page, 'playtime');
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      await page.getByTestId('game-filter-chip-heat').click();
      await expect(page.getByTestId('game-filter-chip-heat').locator('input')).toBeChecked();

      await openSection(page, 'vehicles');
      await expect(stats).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      const note = stats.getByTestId('vehicles-no-table-note');
      await expect(note).toBeVisible();
      await expect(note).toHaveText(
        copy.formatNoVehicleTable(copy.formatGameName('HEAT'), copy.VEHICLE_TITLE_LABELS.wowp),
      );
      await expect(select).toHaveValue('wowp');

      // Opening Vehicles did not clear the filter.
      await openSection(page, 'playtime');
      await expect(page.getByTestId('game-filter-chip-heat').locator('input')).toBeChecked();

      await openSection(page, 'vehicles');
      await select.selectOption('wot');
      await expect(stats.getByTestId('vehicles-no-table-note')).toHaveCount(0);
      await openSection(page, 'playtime');
      await expect(page.getByTestId('game-filter-chip-wot').locator('input')).toBeChecked();
    });

    expect(pageErrors, 'no uncaught page error').toEqual([]);
  });

  test('the HEAT and WoT Console chips', async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildRealShapeThreeAccountExport());
    await openSection(page, 'playtime');
    await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
      timeout: 30_000,
    });

    /** Click one chip and read the three tiles against a hand-typed literal. */
    async function expectChip(
      chip: string,
      figures: { seconds: number; sessions: number; days: number },
    ): Promise<void> {
      await page.getByTestId(`game-filter-chip-${chip}`).click();
      await expect(page.getByTestId(`game-filter-chip-${chip}`).locator('input')).toBeChecked();
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready');
      await expect(page.getByTestId('playtime-total-hours'), `${chip} hours`).toHaveText(
        copy.formatHours(figures.seconds),
      );
      await expect(page.getByTestId('playtime-total-sessions'), `${chip} sessions`).toHaveText(
        String(figures.sessions),
      );
      await expect(page.getByTestId('playtime-active-days'), `${chip} days`).toHaveText(
        String(figures.days),
      );
    }

    await test.step('the chips appear in the header order and narrow Playtime to the typed figures', async () => {
      expect(await testIdsUnder(page.getByTestId('game-filter'), 'game-filter-chip-')).toEqual([
        'game-filter-chip-all',
        'game-filter-chip-wot',
        'game-filter-chip-wotb',
        'game-filter-chip-wows',
        'game-filter-chip-wotc',
        'game-filter-chip-heat',
      ]);
      await expectChip('heat', MA_EXPECTED_PLAYTIME.byGame.HEAT);
      await expectChip('wotc', MA_EXPECTED_PLAYTIME.byGame.WOTC);
      await expectChip('all', MA_EXPECTED_PLAYTIME.all);
    });

    await test.step('at 375px the six chips wrap to two 44px lines and the page does not scroll sideways', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await openSection(page, 'playtime');
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready');

      const boxes = await page
        .getByTestId('game-filter')
        .locator('label.chip')
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const box = node.getBoundingClientRect();
            return { top: Math.round(box.top), height: box.height };
          }),
        );
      expect(boxes, 'six chips').toHaveLength(6);
      expect(new Set(boxes.map((box) => box.top)).size, 'two distinct lines').toBe(2);
      for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
      await expectNoSidewaysScroll(page, 'the six-chip row at 375px');
      await page.setViewportSize({ width: 1280, height: 720 });
      await ensureListScreen(page);
    });

    await test.step('a HEAT-only export has no chip row and still counts HEAT under All games', async () => {
      await replaceExport(page, 'heat-only.zip', buildHeatOnlyExport());
      await openSection(page, 'playtime');
      await expect(page.getByTestId('playtime')).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      await expect(page.getByTestId('game-filter')).toHaveCount(0);
      await expect(page.getByTestId('playtime-total-hours')).toHaveText(
        copy.formatHours(MA_EXPECTED_PLAYTIME.byGame.HEAT.seconds),
      );
    });

    expect(pageErrors, 'no uncaught page error').toEqual([]);
  });
});
