import '../_support/pin-locale';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SCROLLER_MAX_PX, windowRange } from '../../../src/lib/core/windowing.ts';
import { maskCode } from '../../../src/lib/features/new-data/code-mask.ts';
import { maskIp } from '../../../src/lib/geo/ip.ts';
import * as copy from '../../../src/lib/ui-copy.ts';
import {
  ATP_ADDRESSES,
  ATP_BONUS_CODE,
  ATP_CANARY_EMAILS,
  ATP_CODE,
  ATP_CODES,
  ATP_EXPECTED,
  ATP_NEVER_ADDRESSES,
  ATP_NEVER_TEXT,
  buildAccountTimelinePerksExport,
  buildAccountTimelinePerksVariantExport,
  buildLargeAccountTimelineExport,
} from '../../fixtures/account-timeline-perks-export.ts';
import { pkFileKey, type PkCardId } from '../../fixtures/perks-fixtures.ts';
import {
  SYNTHETIC_ZIP_NAME,
  detailPane,
  ensureListScreen,
  gotoApp,
  importExport,
  listRow,
  loginHistoryBlock,
  openSection,
  replaceExport,
} from '../_support/helpers.ts';

// =============================================================================
// Phase 12, plan 12-13 - the browser proofs for the Account timeline and Perks
//
// THE LISTED BUDGET. This file holds EXACTLY two `test(...)` calls inside one
// `test.describe`, with no loop around either: the three CI limits were raised to
// 32 / 34 / 42 minutes for a 265-test suite (plan 12-03), so a third test here
// would need them raised again, all three together, never one
// (tests/unit/guards/ci-budget.test.ts). Every further claim is a `test.step`.
//
// WHERE THE NUMBERS COME FROM. Every expected figure is an `ATP_EXPECTED` literal
// (hand-derived in the two source fixtures, proved against the real worker in
// tests/unit/import/account-timeline-perks-export.test.ts before any browser runs)
// or comes from a `ui-copy` formatter, `maskIp` or `maskCode`. An expectation read
// from the page would pass whatever the page said.
//
// WHAT ONLY A BROWSER CAN PROVE
//   - PRIV-01: a planted email, free-text canary or excluded address is in neither
//     the text nor the markup of a rendered pane, nor in the document title, nor
//     anywhere in `page.content()`; a planted code and the allowlisted address are
//     absent until the single reveal.
//   - D-14, D-13: one reveal across the Perks pane, the Account timeline and Login
//     history, re-masked by a replace and by a reload.
//   - SCALE-01 / D-15: a table over 500 rows keeps the DOM at the window plus two
//     spacer rows.
//   - the chips, badges, tags and the 375px layout behave as the UI contract says.
//
// ONE DEPARTURE FROM THE PLAN TEXT, recorded in the SUMMARY. The plan expected the
// Account timeline to carry a mask toggle and to mask planted bans and third-party
// addresses. The capture admits no address column in any of the five history files
// (plan 12-11, rule d), so those addresses are in EXCLUDED columns and the pane has
// nothing to mask: it renders NO toggle (`hasMaskableEntries` is false). The test
// proves exactly that, and proves the reveal is shared through the Perks pane and
// Login history instead. Nothing here pretends a timeline toggle exists.
// =============================================================================

/** The Account timeline's kind id as the chip test id spells it: `thirdParty` -> `third-party`. */
function chipTestId(kind: string): string {
  return `timeline-kind-chip-${kind.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

/** The Perks card test ids, by card id. */
const CARD_TEST_IDS: Readonly<Record<PkCardId, string>> = {
  subscriptions: 'perks-card-subscriptions',
  coupons: 'perks-card-coupons',
  bonusCodes: 'perks-card-bonus-codes',
  surveys: 'perks-card-surveys',
};

/** The four card ids in the fixed pane order. */
const CARD_ORDER: readonly PkCardId[] = ['subscriptions', 'coupons', 'bonusCodes', 'surveys'];

/** The pane section's root, whichever pane is open. */
function pane(page: Page): Locator {
  return detailPane(page);
}

/** The text and the markup of the open pane, the whole document's markup and its title. */
async function surfacesOf(
  page: Page,
): Promise<{ text: string; html: string; content: string; title: string }> {
  const root = pane(page);
  return {
    text: await root.innerText(),
    html: await root.evaluate((el) => el.outerHTML),
    content: await page.content(),
    title: await page.title(),
  };
}

/** Every value is in none of the open pane's text, its markup, the document markup or the title. */
async function expectAbsent(page: Page, values: readonly string[], where: string): Promise<void> {
  const { text, html, content, title } = await surfacesOf(page);
  expect(values.length, 'the list of values to rule out is not empty').toBeGreaterThan(0);
  for (const value of values) {
    expect(text, `${where}: the text shows ${value}`).not.toContain(value);
    expect(html, `${where}: the markup holds ${value}`).not.toContain(value);
    expect(content, `${where}: the page content holds ${value}`).not.toContain(value);
    expect(title, `${where}: the title holds ${value}`).not.toContain(value);
  }
}

/** No element in the whole document has an attribute value containing any needle. */
async function attributeHits(page: Page, needles: readonly string[]): Promise<string[]> {
  return page.evaluate((values) => {
    const hits: string[] = [];
    for (const element of Array.from(document.querySelectorAll('*'))) {
      for (const attribute of Array.from(element.attributes)) {
        for (const needle of values) {
          if (attribute.value.includes(needle)) {
            hits.push(`${element.tagName.toLowerCase()}[${attribute.name}] holds ${needle}`);
          }
        }
      }
    }
    return hits;
  }, needles);
}

/** Every `data-testid` matching a prefix under a locator, in document order. */
async function testIdsUnder(root: Locator, prefix: string): Promise<string[]> {
  return root
    .locator(`[data-testid^="${prefix}"]`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''));
}

/** The tag letters of every drawn data row of a card's table, one list per row, in row order. */
async function rowTagGroups(card: Locator): Promise<string[][]> {
  return card
    .locator('tbody tr:not(.spacer)')
    .evaluateAll((rows) =>
      rows.map((row) =>
        Array.from(row.querySelectorAll('td.sticky-first [data-testid="account-tag"]')).map(
          (tag) => tag.textContent?.trim() ?? '',
        ),
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

/** What one drawn timeline row says, read from the DOM. */
interface DrawnTimelineRow {
  kind: string;
  date: string;
  letters: string[];
  entry: string;
}

/** Every drawn timeline row: the kind word, the date text, the tag letters and the entry text. */
async function readTimelineRows(page: Page): Promise<DrawnTimelineRow[]> {
  return page
    .getByTestId('timeline-table')
    .locator('tbody tr:not(.spacer)')
    .evaluateAll((rows) =>
      rows.map((row) => {
        const [dateCell, kindCell, entryCell] = Array.from(row.querySelectorAll('td'));
        // The date is a direct text node of the first cell (or the muted "not
        // reported" span); the tag letters and their hidden phrases are other nodes.
        const date = Array.from(dateCell?.childNodes ?? [])
          .filter(
            (node) =>
              node.nodeType === 3 || (node as Element).classList?.contains('muted') === true,
          )
          .map((node) => node.textContent ?? '')
          .join('')
          .replace(/\s+/g, ' ')
          .trim();
        return {
          kind:
            kindCell
              ?.querySelector('[data-testid="timeline-kind-badge"]')
              ?.getAttribute('data-kind') ?? '',
          date,
          letters: Array.from(dateCell?.querySelectorAll('[data-testid="account-tag"]') ?? []).map(
            (tag) => tag.textContent?.trim() ?? '',
          ),
          entry: (entryCell?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        };
      }),
    );
}

/** The entry text the oracle's parts should draw: the primary, then each secondary after a dot. */
function entryTextOf(parts: readonly (string | null)[]): string {
  return parts.map((part) => part ?? copy.DEVICE_NOT_REPORTED).join(' · ');
}

test.describe('the Account timeline and Perks panes', () => {
  test('the Account timeline pane', async ({ page }) => {
    // Three imports, a replace and several pane opens; explicit rather than
    // inherited so a slow runner cannot read as a product failure.
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const timeline = ATP_EXPECTED.timeline;
    const roots = ATP_EXPECTED.roots;

    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildAccountTimelinePerksExport());

    await test.step('the Overview lists a card for each pane with the stored-row headline, and the link opens the pane', async () => {
      const cards = [
        {
          id: 'perks' as const,
          rows: ATP_EXPECTED.perks.rowCount,
          summary: copy.formatPerksRowSummary(ATP_EXPECTED.perks.fileCount),
        },
        {
          id: 'account-timeline' as const,
          rows: timeline.rowCount,
          summary: copy.formatTimelineRowSummary(timeline.fileCount),
        },
      ];
      for (const card of cards) {
        const element = page.getByTestId(`ov-card-${card.id}`);
        await expect(element, `the ${card.id} card`).toBeVisible();
        await expect(element).toContainText(copy.PANE_TITLES[card.id]);
        await expect(element).toContainText(copy.formatRowCount(card.rows));
        await expect(element).toContainText(card.summary);
        await expect(page.getByTestId(`ov-open-${card.id}`)).toHaveText(
          copy.formatOpenSectionLink(copy.PANE_TITLES[card.id]),
        );
      }

      // The link of the Account timeline card opens the pane.
      await expect(page.getByTestId('ov-card-account-timeline')).toBeVisible();
      await page.getByTestId('ov-open-account-timeline').click();
      await expect(detailPane(page)).toHaveAttribute('data-pane', 'account-timeline');
    });

    await test.step('the row sits after Device info and directly above Account, with the stored-row headline', async () => {
      const ids = await testIdsUnder(page.getByTestId('list-nav'), 'list-row-');
      const at = (id: string): number => ids.indexOf(id);
      expect(at('list-row-device-info'), 'Device info is listed').toBeGreaterThanOrEqual(0);
      expect(at('list-row-account-timeline')).toBeGreaterThan(at('list-row-device-info'));
      expect(at('list-row-account')).toBe(at('list-row-account-timeline') + 1);

      const row = listRow(page, 'account-timeline');
      await expect(row).toContainText(copy.PANE_TITLES['account-timeline']);
      await expect(row).toContainText(copy.formatRowCount(timeline.rowCount));
      await expect(row).toContainText(copy.formatTimelineRowSummary(timeline.fileCount));
    });

    const block = page.getByTestId('account-timeline-block');

    await test.step('ready: provenance, import summary, the combined caption and the merge note', async () => {
      await openSection(page, 'account-timeline');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

      const provenance = pane(page).getByTestId('provenance');
      await expect(provenance).toContainText(
        copy.formatProvenanceFrom(copy.NEW_DATA_PROVENANCE_LABELS['account-timeline']),
      );
      await expect(provenance).toContainText(
        copy.formatImportSummary(timeline.fileCount, timeline.rowCount),
      );
      await expect(pane(page).getByTestId('combined-caption')).toHaveText(
        copy.formatCombinedCaption(roots.length),
      );
      await expect(block.getByTestId('timeline-merge-note')).toHaveText(
        copy.formatMergeNote(timeline.mergedAway),
      );
    });

    await test.step('order and content: kinds, dates, tag letters and entry text equal the oracle', async () => {
      const rows = await readTimelineRows(page);
      expect(rows.map((row) => row.kind)).toEqual(timeline.entries.map((entry) => entry.kind));
      expect(rows.map((row) => row.date)).toEqual(
        timeline.entries.map((entry) => entry.date ?? copy.DEVICE_NOT_REPORTED),
      );
      expect(rows.map((row) => row.letters)).toEqual(
        timeline.entries.map((entry) => [...entry.letters]),
      );
      expect(rows.map((row) => row.entry)).toEqual(
        timeline.entries.map((entry) => entryTextOf(entry.parts)),
      );
      // The merged entries carry more than one tag; the widest carries every account.
      expect(Math.max(...rows.map((row) => row.letters.length))).toBe(
        Math.max(...timeline.entries.map((entry) => entry.letters.length)),
      );

      await expect(block.getByTestId('timeline-showing')).toHaveText(
        copy.formatTimelineShowing(timeline.entries.length, timeline.entries.length),
      );
      expect(await block.getByTestId('timeline-kind-badge').count()).toBe(timeline.entries.length);
    });

    await test.step('kind chips: All entries first, the kinds in fixed order, filtering, arrow keys and no URL or storage change', async () => {
      const filter = page.getByTestId('timeline-kind-filter');
      if (timeline.chipCount === 0) {
        await expect(filter, 'fewer than two kinds: no chip row').toHaveCount(0);
        return;
      }
      expect(await testIdsUnder(filter, 'timeline-kind-chip-')).toEqual([
        'timeline-kind-chip-all',
        ...timeline.kindsPresent.map(chipTestId),
      ]);
      expect(await filter.locator('label.chip').count()).toBe(timeline.chipCount);
      await expect(
        filter.getByRole('radiogroup', { name: copy.TIMELINE_KIND_FILTER_LABEL }),
      ).toBeVisible();
      await expect(page.getByTestId('timeline-kind-chip-all').locator('input')).toBeChecked();

      const kind = timeline.filterKind;
      if (kind === undefined) throw new Error('a chip row exists, so a kind exists');
      const total = timeline.entries.length;
      const matching = timeline.entries.filter((entry) => entry.kind === kind).length;
      const urlBefore = page.url();
      const storageBefore = await page.evaluate(
        () => window.localStorage.length + window.sessionStorage.length,
      );

      await page.getByTestId(chipTestId(kind)).click();
      await expect(page.getByTestId(chipTestId(kind)).locator('input')).toBeChecked();
      const badges = await block
        .getByTestId('timeline-kind-badge')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-kind')));
      expect(badges).toEqual(Array(matching).fill(kind));
      await expect(block.getByTestId('timeline-showing')).toHaveText(
        copy.formatTimelineShowing(matching, total),
      );

      // An arrow key moves the radio selection to the previous chip and applies it.
      const chips = ['all', ...timeline.kindsPresent];
      const previous = chips[chips.indexOf(kind) - 1] ?? 'all';
      const previousId = previous === 'all' ? 'timeline-kind-chip-all' : chipTestId(previous);
      await filter.locator('input:checked').focus();
      await page.keyboard.press('ArrowLeft');
      await expect(page.getByTestId(previousId).locator('input')).toBeChecked();
      const previousMatching =
        previous === 'all'
          ? total
          : timeline.entries.filter((entry) => entry.kind === previous).length;
      await expect(block.getByTestId('timeline-showing')).toHaveText(
        copy.formatTimelineShowing(previousMatching, total),
      );

      // All entries restores the whole list.
      await page.getByTestId('timeline-kind-chip-all').click();
      await expect(page.getByTestId('timeline-kind-chip-all').locator('input')).toBeChecked();
      expect(await block.getByTestId('timeline-kind-badge').count()).toBe(total);
      await expect(block.getByTestId('timeline-showing')).toHaveText(
        copy.formatTimelineShowing(total, total),
      );

      expect(page.url(), 'a chip change is not a navigation').toBe(urlBefore);
      expect(
        await page.evaluate(() => window.localStorage.length + window.sessionStorage.length),
        'a chip change writes no storage',
      ).toBe(storageBefore);
    });

    await test.step('masked by default: no email, canary or address anywhere, no toggle, no per-file line, past names only as text', async () => {
      await expectAbsent(page, ATP_CANARY_EMAILS, 'Account timeline, emails');
      await expectAbsent(page, ATP_NEVER_TEXT, 'Account timeline, free text');
      await expectAbsent(page, ATP_NEVER_ADDRESSES, 'Account timeline, excluded addresses');
      await expectAbsent(page, ATP_ADDRESSES, 'Account timeline, allowlisted addresses');
      await expectAbsent(page, ATP_CODES, 'Account timeline, codes');

      // The capture admits no address column in the five history files, so this
      // pane has nothing the single reveal could govern: no toggle, no caption.
      await expect(page.getByTestId('timeline-mask-toggle')).toHaveCount(0);
      await expect(page.getByTestId('timeline-mask-caption')).toHaveCount(0);

      // The past nicknames are page text only: no attribute anywhere holds one,
      // and none holds an address either.
      if (timeline.pastNames.length > 0) {
        const text = await pane(page).innerText();
        for (const name of timeline.pastNames) expect(text, `${name} as text`).toContain(name);
      }
      expect(
        await attributeHits(page, [
          ...timeline.pastNames,
          ...ATP_NEVER_ADDRESSES,
          ...ATP_ADDRESSES,
          ...ATP_CANARY_EMAILS,
        ]),
        'no attribute holds a name-history value, an address or an email',
      ).toEqual([]);

      // The main archive holds no skipped or header-only history file.
      await expect(block.getByTestId('timeline-file-state')).toHaveCount(0);
    });

    await test.step('the reveal is one: pressed in Perks it leaves this pane unchanged and Login history opens revealed, until it is pressed there', async () => {
      await openSection(page, 'perks');
      await expect(page.getByTestId('perks-block')).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      const perksToggle = page.getByTestId('perks-mask-toggle');
      await perksToggle.click();
      await expect(perksToggle).toHaveAttribute('data-masked', 'false');

      // Revealed, the timeline still shows no address and no email: a reveal
      // cannot make an excluded value appear.
      await openSection(page, 'account-timeline');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expectAbsent(page, ATP_CANARY_EMAILS, 'Account timeline revealed, emails');
      await expectAbsent(page, ATP_NEVER_ADDRESSES, 'Account timeline revealed, addresses');
      await expectAbsent(page, ATP_ADDRESSES, 'Account timeline revealed, bonus address');
      await expect(page.getByTestId('timeline-mask-toggle')).toHaveCount(0);

      await openSection(page, 'login-history');
      await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      const loginToggle = page.getByTestId('login-mask-toggle');
      await expect(loginToggle).toHaveAttribute('data-masked', 'false');
      await loginToggle.click();
      await expect(loginToggle).toHaveAttribute('data-masked', 'true');

      await openSection(page, 'perks');
      await expect(page.getByTestId('perks-mask-toggle')).toHaveAttribute('data-masked', 'true');
      await openSection(page, 'account-timeline');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    });

    await test.step('375px: no sideways scroll, the chips wrap to a second line and every chip is 44px tall', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await openSection(page, 'account-timeline');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expectNoSidewaysScroll(page, 'the Account timeline at 375px');

      if (timeline.chipCount > 0) {
        const boxes = await page
          .getByTestId('timeline-kind-filter')
          .locator('label.chip')
          .evaluateAll((nodes) =>
            nodes.map((node) => {
              const box = node.getBoundingClientRect();
              return { top: Math.round(box.top), height: box.height };
            }),
          );
        expect(boxes, 'the oracle chip count').toHaveLength(timeline.chipCount);
        const lines = new Set(boxes.map((box) => box.top)).size;
        if (timeline.chipCount >= 6) {
          expect(lines, 'six or more chips wrap to a second line').toBeGreaterThanOrEqual(2);
        } else {
          expect(lines, 'few chips stay on one line').toBeGreaterThanOrEqual(1);
        }
        for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await expectNoSidewaysScroll(page, 'the Account timeline chips at 375px');
      await page.setViewportSize({ width: 1280, height: 720 });
      await ensureListScreen(page);
    });

    await test.step('a replace re-masks the reveal and returns the kind to All entries', async () => {
      // Choose a kind and reveal, so the reset is a real change.
      await openSection(page, 'account-timeline');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      const kind = timeline.filterKind;
      if (kind !== undefined) {
        await page.getByTestId(chipTestId(kind)).click();
        await expect(page.getByTestId(chipTestId(kind)).locator('input')).toBeChecked();
      }
      await openSection(page, 'perks');
      await expect(page.getByTestId('perks-block')).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      await page.getByTestId('perks-mask-toggle').click();
      await expect(page.getByTestId('perks-mask-toggle')).toHaveAttribute('data-masked', 'false');

      await replaceExport(
        page,
        'variant.zip',
        buildAccountTimelinePerksVariantExport({
          omitFolders: [ATP_EXPECTED.perks.omittedCard.folder],
        }),
      );

      await openSection(page, 'login-history');
      await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      await expect(page.getByTestId('login-mask-toggle')).toHaveAttribute('data-masked', 'true');

      await openSection(page, 'account-timeline');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      if (timeline.chipCount > 0) {
        await expect(page.getByTestId('timeline-kind-chip-all').locator('input')).toBeChecked();
      }
      await expect(block.getByTestId('timeline-showing')).toHaveText(
        copy.formatTimelineShowing(timeline.entries.length, timeline.entries.length),
      );
    });

    await test.step('windowing: over 500 entries the drawn rows are the window plus two spacers, whatever the count', async () => {
      await replaceExport(
        page,
        'large.zip',
        buildLargeAccountTimelineExport(ATP_EXPECTED.large.count),
      );
      await openSection(page, 'account-timeline');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

      const entries = ATP_EXPECTED.large.timelineEntries;
      const scroller = page.getByTestId('timeline-table');
      const table = scroller.locator('table');
      await expect(table).toHaveAttribute('aria-rowcount', String(entries + 1));

      const top = windowRange(0, SCROLLER_MAX_PX, entries);
      expect(entries, 'the fixture is over the windowing threshold').toBeGreaterThan(500);
      expect(await scroller.locator('tbody tr').count()).toBe(top.last - top.first + 2);
      await expect(block.locator('svg'), 'nothing is drawn per row').toHaveCount(0);
      // The whole table is a handful of nodes, not thousands.
      expect(await table.locator('*').count()).toBeLessThanOrEqual(400);

      const firstBefore = await scroller
        .locator('tbody tr:not(.spacer)')
        .first()
        .getAttribute('aria-rowindex');
      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const lastDrawn = scroller.locator('tbody tr:not(.spacer)').last();
      await expect(lastDrawn, 'the last entry is in the DOM after scrolling').toHaveAttribute(
        'aria-rowindex',
        String(entries + 1),
      );
      const firstAfter = await scroller
        .locator('tbody tr:not(.spacer)')
        .first()
        .getAttribute('aria-rowindex');
      expect(firstAfter, 'scrolling changed the first drawn row').not.toBe(firstBefore);

      // The widest window (a scroll position in the middle) bounds the drawn rows.
      const middle = windowRange((entries / 2) * 40, SCROLLER_MAX_PX, entries);
      expect(await scroller.locator('tbody tr').count()).toBeLessThanOrEqual(
        middle.last - middle.first + 2,
      );
      expect(await table.locator('*').count()).toBeLessThanOrEqual(400);
      await expect(block.locator('svg')).toHaveCount(0);
      await expectNoSidewaysScroll(page, 'the large Account timeline');
    });

    expect(pageErrors, 'no uncaught page error').toEqual([]);
  });

  test('the Perks pane', async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const perks = ATP_EXPECTED.perks;
    const roots = ATP_EXPECTED.roots;
    const present = (card: PkCardId): boolean => perks.cardsPresent.includes(card);

    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildAccountTimelinePerksExport());
    const block = page.getByTestId('perks-block');

    await test.step('the row sits after Payments and before Device info, with the stored-row headline', async () => {
      const ids = await testIdsUnder(page.getByTestId('list-nav'), 'list-row-');
      const at = (id: string): number => ids.indexOf(id);
      expect(at('list-row-payments'), 'Payments is listed').toBeGreaterThanOrEqual(0);
      expect(at('list-row-perks')).toBeGreaterThan(at('list-row-payments'));
      expect(at('list-row-device-info')).toBeGreaterThan(at('list-row-perks'));

      const row = listRow(page, 'perks');
      await expect(row).toContainText(copy.PANE_TITLES.perks);
      await expect(row).toContainText(copy.formatRowCount(perks.rowCount));
      await expect(row).toContainText(copy.formatPerksRowSummary(perks.fileCount));
    });

    await test.step('ready: four cards in fixed order with their states, provenance, the caption and the merge note', async () => {
      await openSection(page, 'perks');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

      expect(await testIdsUnder(block, 'perks-card-')).toEqual(
        CARD_ORDER.map((card) => CARD_TEST_IDS[card]),
      );
      for (const card of CARD_ORDER) {
        await expect(block.getByTestId(CARD_TEST_IDS[card]), card).toHaveAttribute(
          'data-status',
          present(card) ? 'ready' : 'not-in-export',
        );
      }

      const provenance = pane(page).getByTestId('provenance');
      await expect(provenance).toContainText(
        copy.formatProvenanceFrom(copy.NEW_DATA_PROVENANCE_LABELS.perks),
      );
      await expect(provenance).toContainText(
        copy.formatImportSummary(perks.fileCount, perks.rowCount),
      );
      await expect(pane(page).getByTestId('combined-caption')).toHaveText(
        copy.formatCombinedCaption(roots.length),
      );
      const note = block.getByTestId('perks-merge-note');
      if (perks.mergedAway > 0) {
        await expect(note).toHaveText(copy.formatMergeNote(perks.mergedAway));
      } else {
        await expect(note).toHaveCount(0);
      }
    });

    await test.step('tags: a merged Subscriptions row carries its oracle tags, an unmerged row a single tag', async () => {
      for (const card of perks.cardsPresent) {
        const expected = perks.cards[card]!;
        const groups = await rowTagGroups(block.getByTestId(CARD_TEST_IDS[card]));
        expect(groups, `${card} displayed rows`).toHaveLength(expected.displayedRows);
        // The pane orders rows by account; the claim here is WHICH tags each row
        // carries, so the two lists are compared sorted.
        expect(groups.map((letters) => letters.join('')).sort(), `${card} tag letters`).toEqual(
          expected.rowLetters.map((letters) => letters.join('')).sort(),
        );
      }
      if (present('subscriptions')) {
        const merged = (await rowTagGroups(block.getByTestId(CARD_TEST_IDS.subscriptions))).filter(
          (letters) => letters.length > 1,
        );
        expect(merged).toHaveLength(
          perks.cards.subscriptions!.rowLetters.filter((letters) => letters.length > 1).length,
        );
      }
      for (const card of perks.cardsPresent.filter((c) => c !== 'subscriptions')) {
        for (const letters of await rowTagGroups(block.getByTestId(CARD_TEST_IDS[card]))) {
          expect(letters, `${card}: an unmerged row has one tag`).toHaveLength(1);
        }
      }
    });

    await test.step('masked by default: no full code or address in text, markup, content or title; the masked forms present', async () => {
      const toggle = page.getByTestId('perks-mask-toggle');
      await expect(toggle).toHaveAttribute('data-masked', 'true');
      await expect(toggle).toHaveText(copy.PERKS_MASK_TOGGLE_SHOW);
      await expect(page.getByTestId('perks-mask-caption')).toHaveText(
        copy.PERKS_MASK_CAPTION_MASKED,
      );

      const clear = [
        ...ATP_CODES,
        ...ATP_CODES.map((code) => code.slice(2)),
        ATP_BONUS_CODE,
        ATP_BONUS_CODE.slice(2),
        ...ATP_ADDRESSES,
      ];
      await expectAbsent(page, clear, 'Perks, masked');
      const { text } = await surfacesOf(page);
      if (present('coupons')) expect(text).toContain(maskCode(ATP_CODE));
      if (present('bonusCodes')) {
        expect(text).toContain(maskCode(ATP_BONUS_CODE));
        for (const address of ATP_ADDRESSES) expect(text).toContain(maskIp(address));
      }

      await expectAbsent(page, ATP_CANARY_EMAILS, 'Perks, emails');
      await expectAbsent(page, ATP_NEVER_TEXT, 'Perks, free text');
      await expectAbsent(page, ATP_NEVER_ADDRESSES, 'Perks, excluded addresses');
      expect(
        await attributeHits(page, [...clear, ...ATP_NEVER_ADDRESSES, ...ATP_CANARY_EMAILS]),
        'no attribute holds a code, an address or an email',
      ).toEqual([]);
    });

    await test.step('reveal: the full codes and address show, the label and status flip, and Login history opens revealed', async () => {
      const toggle = page.getByTestId('perks-mask-toggle');
      await toggle.click();
      await expect(toggle).toHaveAttribute('data-masked', 'false');
      await expect(toggle).toHaveText(copy.PERKS_MASK_TOGGLE_HIDE);
      await expect(page.getByTestId('perks-mask-caption')).toHaveText(
        copy.PERKS_MASK_CAPTION_REVEALED,
      );
      await expect(page.getByTestId('perks-status')).toHaveText(copy.PERKS_MASK_ANNOUNCE_SHOWN);

      const { text } = await surfacesOf(page);
      if (present('coupons')) for (const code of ATP_CODES) expect(text).toContain(code);
      if (present('bonusCodes')) {
        expect(text).toContain(ATP_BONUS_CODE);
        for (const address of ATP_ADDRESSES) expect(text).toContain(address);
      }
      // The reveal shows the allowlisted values only: no email, no excluded value.
      await expectAbsent(page, ATP_CANARY_EMAILS, 'Perks revealed, emails');
      await expectAbsent(page, ATP_NEVER_ADDRESSES, 'Perks revealed, excluded addresses');

      // The other half of the one reveal: the Account timeline has nothing to
      // mask and shows no toggle, and Login history reads the same flag.
      await openSection(page, 'account-timeline');
      await expect(page.getByTestId('account-timeline-block')).toHaveAttribute(
        'data-state',
        'ready',
        { timeout: 30_000 },
      );
      await expect(page.getByTestId('timeline-mask-toggle')).toHaveCount(0);
      await openSection(page, 'login-history');
      await expect(loginHistoryBlock(page)).toHaveAttribute('data-state', 'ready', {
        timeout: 30_000,
      });
      const loginToggle = page.getByTestId('login-mask-toggle');
      await expect(loginToggle).toHaveAttribute('data-masked', 'false');

      // Hiding it there re-masks it here: one reveal, three panes.
      await loginToggle.click();
      await expect(loginToggle).toHaveAttribute('data-masked', 'true');
      await openSection(page, 'perks');
      await expect(page.getByTestId('perks-mask-toggle')).toHaveAttribute('data-masked', 'true');
      await expectAbsent(page, ATP_CODES, 'Perks re-masked');
    });

    await test.step('persistence: a reload restores the dataset and the pane opens masked again', async () => {
      await page.getByTestId('perks-mask-toggle').click();
      await expect(page.getByTestId('perks-mask-toggle')).toHaveAttribute('data-masked', 'false');

      await page.reload();
      await expect(page.locator('main')).toHaveAttribute('data-worker-ready', 'true', {
        timeout: 10_000,
      });
      await expect(page.getByTestId('import-bar')).toHaveAttribute('data-variant', 'slim', {
        timeout: 30_000,
      });
      await openSection(page, 'perks');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expect(page.getByTestId('perks-mask-toggle')).toHaveAttribute('data-masked', 'true');
      await expectAbsent(page, ATP_CODES, 'Perks after a reload');
      await expectAbsent(page, ATP_ADDRESSES, 'Perks after a reload, addresses');
    });

    await test.step('states: an omitted folder reads Not in this export; a drifted Surveys file is skipped without a banner', async () => {
      const omitted = perks.omittedCard;
      await replaceExport(
        page,
        'omitted.zip',
        buildAccountTimelinePerksVariantExport({ omitFolders: [omitted.folder] }),
      );
      await openSection(page, 'perks');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      const omittedCard = block.getByTestId(CARD_TEST_IDS[omitted.card]);
      await expect(omittedCard).toHaveAttribute('data-status', 'not-in-export');
      await expect(omittedCard).toContainText(copy.DEVICE_TABLE_NOT_IN_EXPORT);
      for (const card of perks.cardsPresent.filter((c) => c !== omitted.card)) {
        await expect(block.getByTestId(CARD_TEST_IDS[card]), card).toHaveAttribute(
          'data-status',
          'ready',
        );
      }

      if (present('surveys')) {
        await replaceExport(
          page,
          'drifted.zip',
          buildAccountTimelinePerksVariantExport({ driftSurveys: true }),
        );
        await openSection(page, 'perks');
        await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
        const surveys = block.getByTestId(CARD_TEST_IDS.surveys);
        await expect(surveys).toHaveAttribute('data-status', 'skipped');
        const label = copy.NEW_DATA_FILE_LABELS[pkFileKey('surveys')] ?? pkFileKey('surveys');
        await expect(surveys.getByTestId('new-data-skipped')).toHaveText(
          copy.formatNewDataSkipped(label),
        );
        await expect(page.getByTestId('failure-banner'), 'the import still succeeded').toHaveCount(
          0,
        );
      }
    });

    await test.step('375px: no sideways scroll, the cards stack in one column and the toggle is 44px tall', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await openSection(page, 'perks');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expectNoSidewaysScroll(page, 'the Perks pane at 375px');

      const boxes = await block.locator('[data-testid^="perks-card-"]').evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return { left: Math.round(box.left), width: Math.round(box.width), top: box.top };
        }),
      );
      expect(boxes).toHaveLength(CARD_ORDER.length);
      expect(new Set(boxes.map((box) => box.left)).size, 'one column').toBe(1);
      expect(new Set(boxes.map((box) => box.width)).size, 'full-width cards').toBe(1);
      const tops = boxes.map((box) => box.top);
      expect(
        [...tops].sort((a, b) => a - b),
        'the cards stack in order',
      ).toEqual(tops);

      const toggle = await page.getByTestId('perks-mask-toggle').boundingBox();
      expect(toggle?.height ?? 0).toBeGreaterThanOrEqual(44);
      await page.setViewportSize({ width: 1280, height: 720 });
      await ensureListScreen(page);
    });

    await test.step('windowing: over 500 coupons the drawn rows are the window plus two spacers, whatever the count', async () => {
      await replaceExport(
        page,
        'large.zip',
        buildLargeAccountTimelineExport(ATP_EXPECTED.large.count),
      );
      await openSection(page, 'perks');
      await expect(block).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

      const rows = ATP_EXPECTED.large.couponRows;
      const card = block.getByTestId(CARD_TEST_IDS.coupons);
      await expect(card).toHaveAttribute('data-status', 'ready');
      const scroller = card.getByTestId('new-data-table');
      await expect(card.locator('table')).toHaveAttribute('aria-rowcount', String(rows + 1));

      const top = windowRange(0, SCROLLER_MAX_PX, rows);
      expect(rows, 'the fixture is over the windowing threshold').toBeGreaterThan(500);
      expect(await card.locator('tbody tr').count()).toBe(top.last - top.first + 2);
      await expect(block.locator('svg'), 'nothing is drawn per row').toHaveCount(0);

      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(
        card.locator('tbody tr:not(.spacer)').last(),
        'the last coupon is in the DOM after scrolling',
      ).toHaveAttribute('aria-rowindex', String(rows + 1));
      const middle = windowRange((rows / 2) * 40, SCROLLER_MAX_PX, rows);
      expect(await card.locator('tbody tr').count()).toBeLessThanOrEqual(
        middle.last - middle.first + 2,
      );
      await expect(card.locator('tbody tr:not(.spacer)').first()).not.toHaveAttribute(
        'aria-rowindex',
        '2',
      );
      await expect(page.locator('table svg'), 'no table holds an svg').toHaveCount(0);
      await expectNoSidewaysScroll(page, 'the large Perks pane');
    });

    expect(pageErrors, 'no uncaught page error').toEqual([]);
  });
});
