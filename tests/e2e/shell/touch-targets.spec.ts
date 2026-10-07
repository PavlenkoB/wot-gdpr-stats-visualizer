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
// THE NAV-OFFSET CONTRACT. The 44px floor lifts a nav link from 38.6px to 44px,
// which on its own would make the nav about 6px taller. `--nav-offset` is one
// number that the calendar's sticky year head, every anchor's scroll margin,
// the scroll-spy band and the tooltip placement all read, so the nav pays for
// its own taller links by trimming its vertical padding at phone width
// (`DashboardNav.svelte`). The first test asserts the result: the nav still
// fits inside the offset, and it is the same height as the desktop nav.
// =============================================================================

import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  SYNTHETIC_ZIP_NAME,
  countryList,
  gotoApp,
  importExport,
  loginHistoryBlock,
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

/** The document's `--nav-offset`, read as a number of CSS pixels. */
async function navOffset(page: Page): Promise<number> {
  const raw = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--nav-offset'),
  );
  const value = Number.parseFloat(raw);
  expect(Number.isFinite(value), `--nav-offset read as "${raw}"`).toBe(true);
  return value;
}

async function navHeight(page: Page): Promise<number> {
  const box = await page.getByTestId('dashboard-nav').boundingBox();
  expect(box, 'the nav has a box').not.toBeNull();
  return (box as { height: number }).height;
}

test('the nav links and the persistent bar are 44px targets, Start over opens the confirm panel and clears nothing, and the nav still fits --nav-offset', async ({
  page,
}) => {
  await expectTouchProject();
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

  await expectTargets(page.locator('[data-testid^="nav-link-"]'), 'the nav links');
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

  // The offset contract. The nav plus one 16px step of breathing room must
  // still fit in `--nav-offset`, and the nav must be the height it is on a
  // wide screen (within 1px), so that nothing which reads the offset moved.
  const offset = await navOffset(page);
  const phone = await navHeight(page);
  expect(phone + 16, 'the nav plus 16px fits inside --nav-offset').toBeLessThanOrEqual(offset + 1);

  // The focus ring must still sit inside the nav. The nav clips vertically
  // (`overflow-y: hidden`) at its padding box, and the trimmed padding is only
  // 5.5px against a ring that reaches `outline-width + outline-offset` past the
  // link, so measure the focused link's ring against the nav's padding box.
  const firstLink = page.locator('[data-testid^="nav-link-"]').first();
  await page.keyboard.press('Tab');
  await firstLink.focus();
  const ring = await firstLink.evaluate((link) => {
    const style = getComputedStyle(link);
    const nav = link.closest('nav') as HTMLElement;
    const linkBox = link.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    const reach = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
    return {
      reach,
      topRoom: linkBox.top - reach - (navBox.top + nav.clientTop),
      bottomRoom: navBox.bottom - nav.clientTop - (linkBox.bottom + reach),
    };
  });
  expect(ring.reach, 'the focused link draws a ring').toBeGreaterThan(0);
  expect(ring.topRoom, 'the ring clears the nav top edge').toBeGreaterThanOrEqual(0);
  expect(ring.bottomRoom, 'the ring clears the nav bottom edge').toBeGreaterThanOrEqual(0);

  await page.setViewportSize({ width: 1280, height: 812 });
  const wide = await navHeight(page);
  expect(Math.abs(phone - wide), `nav height: ${phone}px at 375 vs ${wide}px at 1280`).toBeLessThan(
    1,
  );
});

test('every sort header, the column picker and every disclosure summary of the dashboard are 44px targets', async ({
  page,
}) => {
  await expectTouchProject();
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

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
  await expectTargets(
    page.getByTestId('monthly-table-disclosure').locator(':scope > summary'),
    'every monthly-table disclosure',
  );
  await expectTargets(
    page.getByTestId('spend-breakdown').locator(':scope > summary'),
    'the spend breakdown summary',
  );
});

test('the login controls are 44px targets: the reveal toggle, all six sort headers, the city Load button, the country list and the attribution link', async ({
  page,
}) => {
  await expectTouchProject();
  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildLoginsHandExport());
  await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  await expectTargets(page.getByTestId('login-mask-toggle'), 'the reveal-addresses toggle');
  const sorts = page.locator('[data-testid^="login-sort-"]');
  expect(await sorts.count(), 'the login table has six sort headers').toBe(6);
  await expectTargets(sorts, 'the login table sort headers');
  await expectTargets(page.getByTestId('city-load'), 'the city Load button');
  await expectTargets(countryList(page).locator(':scope > summary'), 'the country list summary');
  await expectTargets(page.getByTestId('map-attribution-link'), 'the DB-IP attribution link');
});
