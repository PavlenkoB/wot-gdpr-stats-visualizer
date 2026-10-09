import '../_support/pin-locale';
import { expect, test } from '@playwright/test';
import {
  SYNTHETIC_ZIP_NAME,
  clearCachedDatasetFromSecondTab,
  failPlaytimeQueryFor,
  gotoApp,
  importAndOpen,
  openActivity,
  playtimeBlock,
  replaceExport,
} from '../_support/helpers.ts';
import {
  buildSessionsCsvFromRows,
  buildSessionsExportFromCsv,
} from '../../fixtures/sessions-fixtures.ts';
import { HAND_ALL, HAND_EU, HAND_ROWS } from '../../fixtures/playtime-hand-fixture.ts';
import {
  PLAYTIME_CACHE_CLEARED,
  SPLIT_ALL_OPTION,
  SPLIT_BLANK_VALUE,
} from '../../../src/lib/ui-copy.ts';

// =============================================================================
// Phase 04, plan 04-11 — the Playtime BLOCK, in a real browser
// =============================================================================
//
// WHY A BROWSER SPEC AND NOT A UNIT TEST
// Vitest has no DOM, and every one of the things this file asserts is a claim
// about what a user SEES: a state name on an element, three tiles reading
// numbers, a native select moving those numbers, and a live region saying so.
// None of it exists until a component renders, so the instrument has to be a
// browser.
//
// WHY THESE NUMBERS ARE LITERALS
// Every expected value is imported from `tests/fixtures/playtime-hand-fixture.ts`
// and was derived BY HAND from its nine rows, then proved equal to the
// INDEPENDENT session oracle from plan 04-03 in
// `tests/unit/playtime/playtime-hand-fixture.test.ts`. Nothing here is read from the
// page and compared with itself: a spec that read the tiles and asserted they
// were equal to each other would pass against a chart that is wrong in every
// cell. The fixture also holds BOTH hour bases, so the open
// `HOUR_GRID_BASIS` decision needs no edit here.
//
// THE TEST BUDGET
// 04-11 caps this file at 19 tests and both spec files at 36, because CI runs
// one Playwright worker and every test costs a full import. Related assertions
// are therefore kept inside one test rather than split for legibility, and
// plan 04-13 derives the global timeout from the recorded `--list` totals.
//
// Decisions: D-02 (excluded rows), D-03 (the split and its selector),
// D-06 (the totals).
// =============================================================================

/** The nine hand rows as the export the app actually reads. */
const HAND_EXPORT = buildSessionsExportFromCsv(buildSessionsCsvFromRows(HAND_ROWS));

test('tracer: import, totals, pick a server, announcement', async ({ page }) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'playtime');

  // The section is `ready` and the block reaches `ready`: the two are
  // different claims. The card can be ready (the export was imported) while
  // the block is still loading (the aggregate is being asked for), and a
  // spec that asserted only the card would pass before the numbers existed.
  await expect(openActivity(page)).toHaveAttribute('data-status', 'ready');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');

  // All: 16,230s over 7 sessions on 5 active days.
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(HAND_ALL.hoursText);
  await expect(page.getByTestId('playtime-total-sessions')).toHaveText(String(HAND_ALL.sessions));
  await expect(page.getByTestId('playtime-active-days')).toHaveText(String(HAND_ALL.activeDays));

  // The selector is labelled with the split column's own name, and lists All
  // plus one option per value in the worker's order: merged seconds DESCENDING
  // (D-06's "play first, and break ties on the value's own text"). eu-1 holds
  // 12,630s, na-1 3,600s and the blank server 900s, so the order is
  // eu-1, na-1, (not recorded) — eu-1 is option index 0, NOT index 1. A spec
  // that assumed the alphabetical or the ascending-by-seconds order would
  // select na-1 and quietly assert the wrong server's numbers.
  const selector = page.getByTestId('playtime-selector');
  await expect(selector).toHaveAccessibleName('Server name');
  await expect(selector.locator('option')).toHaveText([
    SPLIT_ALL_OPTION,
    'eu-1',
    'na-1',
    SPLIT_BLANK_VALUE,
  ]);

  // eu-1: 12,630s over 4 sessions on 3 active days, and the status line
  // repeats the whole set because a live region is the only feedback a
  // screen-reader user gets that the numbers above it changed.
  await selector.selectOption('0');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(HAND_EU.hoursText);
  await expect(page.getByTestId('playtime-total-sessions')).toHaveText(String(HAND_EU.sessions));
  await expect(page.getByTestId('playtime-active-days')).toHaveText(String(HAND_EU.activeDays));
  await expect(page.getByTestId('playtime-status')).toHaveText(HAND_EU.announcement);

  // All restores every tile. A selector that only worked one way would leave
  // the reader unable to get back to the whole picture. Selected BY LABEL,
  // because the All option's `value` is the literal `'all'` and not an index
  // (04-05) — and `'0'` is the first server, never All.
  await selector.selectOption({ label: SPLIT_ALL_OPTION });
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(HAND_ALL.hoursText);
  await expect(page.getByTestId('playtime-total-sessions')).toHaveText(String(HAND_ALL.sessions));
  await expect(page.getByTestId('playtime-active-days')).toHaveText(String(HAND_ALL.activeDays));
});

// -----------------------------------------------------------------------------
// The two states the 04-14 review found, both reached through the real seam.
// -----------------------------------------------------------------------------
//
// Each one was announced at the top of a phase that had already fixed "a stale
// answer is never shown" (T-04-24) and "the error detail stays out of the DOM"
// (D-21), and each one is a state a user can sit in:
//
//   WR-1  A selection query that FAILS leaves the previous slice's
//         announcement in the live region, directly above the red error box,
//         describing a slice that is no longer on screen.
//   WR-2  A selection query that is DROPPED (the worker answers nothing this
//         ask can use) leaves `requested` dangling, so the status line reads
//         "Updating charts..." forever with no way back.
//
// 04-16 (G-04-5) does not change either fix; it adds the word WR-2's flow was
// missing. Reconciling `requested` stops the stuck spinner, but a silently
// ignored selector reads as a broken app, so the same flow must now also say
// what happened and what to do.
//
// Neither state is reachable by a single-tab flow that succeeds, which is why
// these need a failure injected at the transport rather than a flag.

test('WR-1: a failed selection query clears the previous slice announcement', async ({ page }) => {
  // na-1's query cannot be posted; eu-1's and the initial All can. Indexed by
  // split index, so the first two queries that shape the state below are the
  // real ones.
  await failPlaytimeQueryFor(page, 1);
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'playtime');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');

  // A real, successful selection change first: this is the announcement the
  // bug then leaves behind, and without it there would be nothing to clear.
  const selector = page.getByTestId('playtime-selector');
  await selector.selectOption('0');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('playtime-status')).toHaveText(HAND_EU.announcement);

  // Now the post throws. `PlaytimeClient.query` turns the throw into
  // `{ kind: 'error' }` and the block renders the error state.
  await selector.selectOption('1');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'error');
  await expect(page.getByTestId('playtime-error')).toBeVisible();

  // THE CLAIM: the error state keeps no announcement. The line above the error
  // box used to read eu-1's numbers, and the live region announced them at the
  // instant the error appeared.
  await expect(page.getByTestId('playtime-status')).toHaveText('');
  await expect(page.getByTestId('playtime-error')).not.toContainText(HAND_EU.hoursText);
});

test('WR-2: a dropped selection query settles on ready, not on updating forever', async ({
  page,
  context,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'playtime');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');

  // One real selection change applied, so `shown` and `requested` are both set
  // and differ — the only way `awaiting` can be true at the moment the next
  // ask is dropped.
  const selector = page.getByTestId('playtime-selector');
  await selector.selectOption('0');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(HAND_EU.hoursText);

  // A second tab clears the origin-wide cache (D-27). This page is NOT told:
  // it still holds the dataset, so `importedAt` is unchanged and the block
  // still renders eu-1.
  await clearCachedDatasetFromSecondTab(context);

  // na-1's query now reaches a worker whose store is gone. It answers
  // `importedAt: null, view: null`, which `acceptOutcome` drops — no
  // `superseded`, no error, and no view to show.
  await selector.selectOption('1');

  // THE CLAIM: the block reconciles and settles on `ready` showing the slice it
  // actually has. Before the fix `requested` stayed at na-1 with nothing behind
  // it, so `awaiting` never cleared and this read "Updating charts..." until
  // the next import or reload.
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(page.getByTestId('playtime-status')).toHaveText(HAND_EU.announcement);
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(HAND_EU.hoursText);

  // 04-16 (G-04-5): the reconcile above is the WR-2 fix and is unchanged, but
  // settling on `ready` silently is what the reporter actually saw — a
  // selector that did nothing and no word saying why. So the same flow must
  // also TELL the user, in the block, that their cached data was cleared in
  // another tab and that dropping the export again is the way forward.
  const notice = page.getByTestId('playtime-cache-cleared');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(PLAYTIME_CACHE_CLEARED);
  await expect(notice).toHaveAttribute('role', 'alert');

  // The notice must not have become a THIRD EXPLICIT `aria-live` region.
  // `role="alert"` already announces on its own — it is an IMPLICIT live
  // region — so the block's one explicit `aria-live` attribute must still be
  // the only one inside the block (the page also has the notice slot and the
  // chart announcement region, which are outside it). The role is asserted above, which is what a future edit dropping
  // it would break: an `[aria-live]` count cannot see that removal.
  await expect(playtimeBlock(page).locator('[aria-live]')).toHaveCount(1);

  // And the way back must still be on the page: the sentence tells the user to
  // drop the export again, so the control that does it has to be there.
  await expect(page.getByTestId('file-input')).toHaveCount(1);
});

// -----------------------------------------------------------------------------
// 04-16 / G-04-5: the notice has to be clearable, and the sentence names how.
// -----------------------------------------------------------------------------
//
// A notice with no way out is the same defect as no notice, one step later: the
// user is told to drop the export again, so the page has to actually recover
// when they do. This is the same two-tab setup as WR-2, run to its end.

test('G-04-5: dropping the export again removes the cache-cleared notice', async ({
  page,
  context,
}) => {
  await gotoApp(page);
  await importAndOpen(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'playtime');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');

  // One real selection, so `shown` and `requested` differ and the next ask can
  // be dropped with something on screen to keep showing.
  const selector = page.getByTestId('playtime-selector');
  await selector.selectOption('0');
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(HAND_EU.hoursText);

  // The store goes, and the next selection is dropped. The notice is what
  // makes this flow honest, so its arrival is a precondition here rather than
  // the claim: the claim is what the re-drop does to it.
  await clearCachedDatasetFromSecondTab(context);
  await selector.selectOption('1');
  await expect(page.getByTestId('playtime-cache-cleared')).toBeVisible();
  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready');

  // The way back, through the page's own import bar. The SAME hand bytes, and
  // that is deliberate rather than a shortcut: the store is empty, so the
  // worker has no dataset to compare against and cannot take the duplicate
  // path. Re-importing the identical file is exactly what the sentence tells
  // the user to do, and it has to work.
  await replaceExport(page, SYNTHETIC_ZIP_NAME, HAND_EXPORT, 'playtime');

  await expect(playtimeBlock(page)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  // THE CLAIM: the notice is gone. It is a claim about ONE dataset, and the
  // re-drop put a new one on screen, so a notice left up would describe a
  // dataset the block has already moved past.
  await expect(page.getByTestId('playtime-cache-cleared')).toHaveCount(0);

  // The selector is back on All: a new dataset starts at All and never
  // inherits a value that belonged to the old one (D-03). `'all'` is the
  // option's VALUE and `SPLIT_ALL_OPTION` its LABEL — 04-05's distinction, and
  // the reason `'0'` was never All in the first place.
  await expect(selector).toHaveValue('all');
  await expect(selector.locator('option:checked')).toHaveText(SPLIT_ALL_OPTION);

  // And the tiles are the All figures of the hand fixture, not the eu-1 ones
  // the notice was sitting under.
  await expect(page.getByTestId('playtime-total-hours')).toHaveText(HAND_ALL.hoursText);
  await expect(page.getByTestId('playtime-total-sessions')).toHaveText(String(HAND_ALL.sessions));
  await expect(page.getByTestId('playtime-active-days')).toHaveText(String(HAND_ALL.activeDays));
});
