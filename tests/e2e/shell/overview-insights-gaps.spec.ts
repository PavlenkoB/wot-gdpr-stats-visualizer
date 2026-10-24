import { expect, test } from '@playwright/test';
import { SYNTHETIC_ZIP_NAME, gotoApp, importExport } from '../_support/helpers.ts';
import { buildOverviewInsightExport } from '../../fixtures/overview-fixtures.ts';

// =============================================================================
// overview-insights-gaps.spec.ts — the open findings of 13-REVIEW.md that only
// a real browser can show (WR-01)
//
// =============================================================================
//
// WHAT THIS PROVES
//   WR-01: "Pin toggle reads stale `pins` while a view transition is pending,
//   so rapid pins are lost."
//
//   The pin toggle computes the next pin list SYNCHRONOUSLY and assigns it
//   only inside the view transition's update callback, and it PERSISTS that
//   same list synchronously. While a transition is pending, the state the
//   second pin reads is the state before the first pin, so the second pin's
//   list omits the first pin and overwrites it — in the page AND in storage.
//
//   The test makes the pending window DETERMINISTIC rather than racing it:
//   `document.startViewTransition` is replaced by a stub that HOLDS the update
//   callback instead of running it, so the transition stays pending until the
//   test releases it. A real transition is pending for a frame or two, which
//   is enough for a held key or a fast second click.
//
// STATUS
//   Fixed: the next pin list is derived inside the update closure, from the
//   latest pins. The test was an expected failure (`test.fail()`) until the fix
//   and is now an ordinary regression test.
// =============================================================================

test('(gap WR-01) two pins issued while a view transition is pending keep both', async ({
  page,
}) => {
  // Hold every view transition's update callback, so the transition stays
  // pending for as long as the test wants it to.
  await page.addInitScript(() => {
    const held: Array<() => void> = [];
    (window as unknown as { __heldTransitions: Array<() => void> }).__heldTransitions = held;
    document.startViewTransition = ((update: () => void) => {
      held.push(update);
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    }) as unknown as typeof document.startViewTransition;
  });

  await gotoApp(page);
  await importExport(page, SYNTHETIC_ZIP_NAME, buildOverviewInsightExport());
  await expect(page.getByTestId('ov-tile-logged')).toBeVisible();

  // Two pins, both while the transition is pending.
  await page.getByTestId('ov-star-hour').click();
  await page.getByTestId('ov-star-streak').click();

  // Release the held transitions: the page now holds the state the two pins
  // produced.
  await page.evaluate(() => {
    const held = (window as unknown as { __heldTransitions: Array<() => void> }).__heldTransitions;
    held.splice(0).forEach((update) => update());
  });

  // BOTH pins must be in the Pinned group: the first pin is not undone by the
  // second one.
  const pinned = await page
    .getByTestId('ov-grid-pinned')
    .locator(':scope > [data-tile-id]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-tile-id')));
  expect(pinned).toContain('hour');
  expect(pinned).toContain('streak');

  // And the same in storage: the persisted list is the reader's choice, not
  // the choice of the last click.
  const stored = await page.evaluate(() => localStorage.getItem('wg-overview-pins'));
  expect(stored).toContain('"hour"');
  expect(stored).toContain('"streak"');
});
