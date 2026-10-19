// =============================================================================
// Phase 07, plan 07-05 — the 44px touch-target floor (D-08), measured
// =============================================================================
//
// WHY BOUNDING BOXES. The floor is a CSS rule, and a CSS rule can be defeated
// by a more specific one that nobody wrote on purpose: a component's own
// `display`, a `height` that wins, an inline link that ignores `min-height`.
// Reading the stylesheet would prove the rule exists; only the box the browser
// actually laid out proves a finger has 44 x 44 CSS pixels to land on.
//
// WHY THE FLOOR IS GLOBAL. Every button, disclosure summary and link in the app
// is one of three elements, so one rule in the single 480px block of
// `src/app.css` reaches all of them, including the control added next month.
// A per-component rule would be a thing to remember per component. These tests
// are the other half of that bargain: they enumerate the controls that exist
// today, so a later component whose own rule defeats the floor fails HERE, by
// name and by size.
//
// WHY THIS RUNS ON THE TOUCH PROJECT. `touch-targets.spec.ts` matches the
// `**/touch-*.spec.ts` glob that `playwright.config.ts` routes to
// `chromium-mobile` (375 x 812, `isMobile`, `hasTouch`), so every test is listed
// once and runs with a real touch pointer. The page-level overflow sweep that
// lives next to this file runs on the plain desktop project instead
// (`mobile-sweep.spec.ts`).
//
// THE TWO SCREENS. At 375px the shell shows the list OR one pane's detail, so a
// control is measured on the screen that owns it: the list rows, Start over,
// Clear data and the confirm buttons on the list screen, the back button and
// every disclosure and sort header inside the pane that holds it. There is no
// nav bar any more, so nothing here asserts a nav height or `--nav-offset`; the
// back button's 48px bar is asserted as a target, and the offset contract
// lives in the master-detail nav spec.
// =============================================================================

import { expect, test, type Locator } from '@playwright/test';
import {
  SYNTHETIC_ZIP_NAME,
  countryList,
  currencyBlock,
  ensureListScreen,
  gotoApp,
  importAndOpen,
  importExport,
  loginHistoryBlock,
  openSection,
  playerStatsBlock,
  playtimeBlock,
  premiumBlock,
  spendBlock,
} from '../_support/helpers.ts';
import { buildSampleExport } from '../../fixtures/export-fixtures.ts';
import { buildLoginsHandExport } from '../../fixtures/logins-fixtures.ts';

/** The floor, in CSS pixels, both ways. */
const FLOOR = 44;

/**
 * The touch project, asserted rather than assumed: a touch spec that the
 * routing in `playwright.config.ts` sent to the desktop project would measure
 * the desktop layout, pass, and prove nothing about a phone.
 */
async function expectTouchProject(): Promise<void> {
  expect(test.info().project.name).toBe('chromium-mobile');
}

/**
 * Every match must exist, and every match must be at least 44 x 44.
 *
 * The existence check comes FIRST so that a control removed from the app, or a
 * test id renamed, fails instead of passing vacuously over zero elements.
 * Offenders are listed by index and size so the failure names the control.
 */
async function expectTargets(locator: Locator, name: string): Promise<void> {
  const count = await locator.count();
  expect(count, `${name} is not on the page, so its size could not be measured`).toBeGreaterThan(0);

  const offenders: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const box = await locator.nth(index).boundingBox();
    if (box === null) {
      offenders.push(`#${index} has no box`);
      continue;
    }
    if (box.width < FLOOR || box.height < FLOOR) {
      offenders.push(`#${index} is ${box.width}x${box.height}`);
    }
  }
  expect(offenders, `${name}: every match must be at least ${FLOOR}x${FLOOR}px`).toEqual([]);
}

test('every list row, the back button, the persistent bar and the confirm buttons are 44px targets, and Start over only opens the confirm panel', async ({
  page,
}) => {
  await expectTouchProject();
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

  // The list screen: all nine rows, then the persistent bar's controls.
  expect(
    await page.locator('[data-testid^="list-row-"]').count(),
    'the list shows all ten rows: the nine always present and the Warships crews and storage row the sample earns',
  ).toBe(10);
  await expectTargets(page.locator('[data-testid^="list-row-"]'), 'the list rows');
  await expectTargets(page.getByTestId('start-over'), 'Start over');
  await expectTargets(page.getByTestId('clear-data-control'), 'Clear data');

  // T-07-17: a larger target must not make a data-destroying action one
  // mis-tap away. A tap only OPENS the panel; the dataset is still on screen
  // and nothing is gone until the panel's own commit button is pressed.
  await page.getByTestId('start-over').tap();
  const panel = page.getByTestId('confirm-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('identity-nickname')).toBeVisible();
  await expectTargets(page.getByTestId('confirm-cancel'), 'the confirm panel Cancel button');
  await expectTargets(page.getByTestId('confirm-commit'), 'the confirm panel commit button');
  await panel.getByTestId('confirm-cancel').tap();
  await expect(panel).toBeHidden();
  await expect(page.getByTestId('identity-nickname')).toBeVisible();

  // The detail screen's way back. The phone bar is 48px, so the button is at
  // least the 44px floor wide and tall.
  await openSection(page, 'vehicles');
  const back = page.getByTestId('back-button-sections');
  await expectTargets(back, 'the back button');
  const backBox = await back.boundingBox();
  expect(backBox, 'the back button has a box').not.toBeNull();
  expect(backBox!.height, 'the back button is at least 44px high').toBeGreaterThanOrEqual(FLOOR);

  // Going back lands on the list with the dataset intact.
  await ensureListScreen(page);
  await expect(page.getByTestId('identity-nickname')).toBeVisible();
});

test('every sort header, the column picker and every disclosure summary of the dashboard are 44px targets', async ({
  page,
}) => {
  await expectTouchProject();
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, buildSampleExport(), 'vehicles');
  await expect(playerStatsBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  await expectTargets(
    page.locator('[data-testid^="vehicle-sort-"]'),
    'the vehicle table sort headers',
  );
  await expectTargets(
    page.getByTestId('column-picker').locator(':scope > summary'),
    'the column picker summary',
  );
  await expectTargets(
    page.getByTestId('battle-type-summary-disclosure').locator(':scope > summary'),
    'the battle-type summary disclosure',
  );

  await openSection(page, 'finance');
  await expect(premiumBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(currencyBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expectTargets(
    page.getByTestId('monthly-table-disclosure').locator(':scope > summary'),
    'every monthly-table disclosure',
  );
  await expectTargets(
    page.locator('[data-testid^="about-"] > summary'),
    'every about disclosure summary in the Finance pane',
  );

  await openSection(page, 'payments');
  await expect(spendBlock(page)).not.toHaveAttribute('data-state', 'loading', {
    timeout: 30_000,
  });
  await expectTargets(
    page.getByTestId('spend-breakdown').locator(':scope > summary'),
    'the spend breakdown summary',
  );

  await openSection(page, 'playtime');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expectTargets(
    page.locator('[data-testid^="about-"] > summary'),
    'every about disclosure summary in the Playtime pane',
  );
});

test('the login controls are 44px targets: the reveal toggle, all six sort headers, the city Load button, the country list and the attribution link', async ({
  page,
}) => {
  await expectTouchProject();
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, buildLoginsHandExport(), 'login-history');
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  await expectTargets(page.getByTestId('login-mask-toggle'), 'the reveal-addresses toggle');
  const sorts = page.locator('[data-testid^="login-sort-"]');
  expect(await sorts.count(), 'the login table has six sort headers').toBe(6);
  await expectTargets(sorts, 'the login table sort headers');
  await expectTargets(page.getByTestId('city-load'), 'the city Load button');
  await expectTargets(countryList(page).locator(':scope > summary'), 'the country list summary');
  await expectTargets(page.getByTestId('map-attribution-link'), 'the DB-IP attribution link');
});
