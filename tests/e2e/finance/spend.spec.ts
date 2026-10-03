import '../_support/pin-locale';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SYNTHETIC_ZIP_NAME, gotoApp, importExport, spendBlock } from '../_support/helpers.ts';
import {
  buildCustomExport,
  buildSampleExport,
  buildZeroRowPaymentExport,
} from '../../fixtures/export-fixtures.ts';
import {
  FINANCE_CANARIES,
  ORDERS_HAND_EXPECTED,
  ORDERS_HEADER_12,
  renderQuoteAllCsv,
} from '../../fixtures/finance-fixtures.ts';
import { MICRO_SCALE, formatMoneyAmount } from '../../../src/lib/core/decimal.ts';
import {
  SPEND_BREAKDOWN_DISCLOSURE,
  SPEND_BY_GAME,
  SPEND_BY_YEAR,
  SPEND_BLANK_GAME,
  SPEND_EXCLUDED_EXPLANATION,
  SPEND_HEADING,
  SPEND_INTRO,
  SPEND_LABEL_FAILED,
  SPEND_LABEL_NEW,
  SPEND_LABEL_OTHER,
  SPEND_LOADING,
  SPEND_NO_USABLE,
  SPEND_UNKNOWN_YEAR,
  UNKNOWN_CURRENCY_CAPTION,
  UNKNOWN_CURRENCY_HEADING,
  formatGiftLine,
  formatMoney,
  formatNumber,
  formatPaidExcludedPill,
  formatPaidOrders,
} from '../../../src/lib/ui-copy.ts';

// =============================================================================
// Phase 05, plan 05-15 — the Real-money spend block, in a real browser
// =============================================================================
//
// WHY A BROWSER SPEC
// `tests/unit/finance/finance-state.test.ts` proves which state is on screen for a
// hand-built view, and the component-source contract test in
// `tests/unit/finance/spend-blocks.test.ts` proves which hooks the component renders.
// Neither can prove that the block ASKS, that the worker answers, and that the
// five currency cards reach the screen in the order D-21 fixes — which exist
// only once a component renders. Vitest has no DOM, so the instrument is a
// browser.
//
// WHY EVERY EXPECTATION IS COMPUTED IN NODE
// From `ORDERS_HAND_EXPECTED`, the 05-01 hand fixture's answer key, through
// the same `ui-copy` formatters and the same `decimal` module the component
// uses, and NEVER by reading a value out of the page. A spec that scraped the
// headline and compared it with itself would pass against a block rendering a
// fixed string. `pin-locale` is imported for the reason `finance.spec.ts`
// does: Node's number grouping must match the browser's.
//
// WHY THE EXPECTED STRINGS CROSS THE EXACT BOUNDARY
// The fixture states its sums in THOUSANDTHS (`totalThousandths: 15_495` for
// 15.495 units) because that is how the answer key was written by hand. The
// worker transports MICRO-UNITS, at scale 6. So the spec converts thousandths
// to micro-units in the test and then formats through `formatMoney`, which is
// the SAME path the component takes. That is deliberate: the rounding that
// turns 15.495 into `15.50` and a float would turn into `15.49` is a
// boundary the spec has to cross END TO END, because 05-14 shipped a bug
// exactly there — two halves, each correct in its own unit test, 100x wrong
// together (STATE.md, "A percent CELL is a percentage"). Pinning the worker
// value and the formatter input separately would have missed it again.
//
// THE TEST BUDGET
// CI runs one Playwright worker and every import costs a full unzip, parse and
// ingest, so the read-only assertions below share ONE import through the serial
// describe. The states and long-text tests need their own exports by nature and
// pay for their own page.
//
// Decisions: D-21 (per-currency PAID total and count, no blended figure),
// D-22 (per-year and per-game breakdowns), D-23 (gifts included and shown),
// D-24 (code as written, two decimals, unknown currency, non-numeric
// excluded and counted).
// =============================================================================

/** Micro-units in one thousandth — the unit the hand fixture states sums in. */
const UNITS_PER_THOUSANDTH = 10n ** BigInt(MICRO_SCALE - 3);

/**
 * The expected headline and paid count for every card, in the fixture's own
 * card order.
 *
 * Read off `ORDERS_HAND_EXPECTED` — paid-order count descending, the
 * unit-less group last — and formatted through the app's own formatters, so a
 * figure that reaches a human is asserted once, at the end, rather than at each
 * stage of the pipeline that produced it.
 */
const EXPECTED_CARDS = ORDERS_HAND_EXPECTED.cards.map((card) => ({
  /** The code as the export writes it; `''` for the unit-less group. */
  dataCurrency: card.unknownCurrency ? '' : card.code,
  /** The `h4` text: the code, or the explicit unknown-currency heading. */
  heading: card.unknownCurrency ? UNKNOWN_CURRENCY_HEADING : card.code,
  /** `{CODE} {amount}`, or the bare amount with no code at all. */
  headline: formatMoney(
    card.unknownCurrency ? null : card.code,
    BigInt(card.totalThousandths) * UNITS_PER_THOUSANDTH,
    'en-US',
  ),
  paidCount: formatPaidOrders(card.paid, 'en-US'),
  /** The separate failed, new and other-status counts, which are NEVER added
   *  into the headline (D-21). */
  failed: formatNumber(card.failed, 'en-US'),
  newOrders: formatNumber(card.newOrders, 'en-US'),
  other: formatNumber(card.other, 'en-US'),
  /** The gift line, or null when the card holds no gift orders. */
  gift:
    card.gifts > 0
      ? formatGiftLine(
          card.gifts,
          formatMoney(
            card.unknownCurrency ? null : card.code,
            BigInt(card.giftThousandths) * UNITS_PER_THOUSANDTH,
            'en-US',
          ),
        )
      : null,
  /** The amber pill, or null when nothing was excluded. */
  excluded: card.excluded > 0 ? formatPaidExcludedPill(card.excluded, 'en-US') : null,
  byYear: card.byYear.map((row) => ({
    label: row.year === '' ? SPEND_UNKNOWN_YEAR : row.year,
    paid: formatPaidOrders(row.paid, 'en-US'),
    total: formatMoney(
      card.unknownCurrency ? null : card.code,
      BigInt(row.totalThousandths) * UNITS_PER_THOUSANDTH,
      'en-US',
    ),
  })),
  byGame: card.byGame.map((row) => ({
    label: row.game,
    paid: formatPaidOrders(row.paid, 'en-US'),
    total: formatMoney(
      card.unknownCurrency ? null : card.code,
      BigInt(row.totalThousandths) * UNITS_PER_THOUSANDTH,
      'en-US',
    ),
  })),
}));

/** The USD card, the one with a figure of every kind on it. */
const USD_CARD = EXPECTED_CARDS[0]!;

test.describe.configure({ mode: 'serial' });

test.describe('05-15 real-money spend: the sample export', () => {
  let context: BrowserContext;
  let page: Page;

  // One unzip for the whole read-only block. The card is identical across
  // these tests, and every import costs a full parse and ingest.
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('(tracer) five cards with exact headlines and paid counts', async () => {
    // The cross-checks first, and they are literals on purpose: if the
    // fixture's own answer key were wrong, every expectation below would be
    // wrong in the same direction and the suite would pass.
    //
    // 16 hand rows over five currency groups; 1 PAID row excluded for a
    // non-numeric amount; USD's 9.99 + 0.5 + 1.005 + 4.00 = 15.495 units, which
    // draws `15.50` under half-away-from-zero and `15.49` under a float.
    expect(ORDERS_HAND_EXPECTED.excluded).toBe(1);
    expect(ORDERS_HAND_EXPECTED.cards).toHaveLength(5);
    expect(EXPECTED_CARDS.map((card) => card.dataCurrency)).toEqual([
      'USD',
      'UAH',
      'RUB',
      'usd',
      '',
    ]);
    expect(EXPECTED_CARDS.map((card) => card.headline)).toEqual([
      'USD 15.50',
      'UAH 350.50',
      'RUB 1,000.00',
      'usd 3.00',
      // No code: the unit-less card's headline is the bare amount, because an
      // amount with no unit must not be given one (D-24).
      '13.34',
    ]);
    expect(EXPECTED_CARDS.map((card) => card.paidCount)).toEqual([
      '4 paid orders',
      '2 paid orders',
      '1 paid order',
      '1 paid order',
      '2 paid orders',
    ]);

    // The card and the block are two different claims. The card is `ready`
    // because the export was imported; the block is `ready` because the
    // worker has answered. A spec that asserted only the card would pass
    // before any spend number existed.
    await expect(page.getByTestId('dashboard-section-payment-history')).toHaveAttribute(
      'data-status',
      'ready',
    );
    await expect(spendBlock(page)).toHaveAttribute('data-state', 'ready');

    // `loading` is a real state and a TRANSIENT one, so the spec that pins
    // the figures must also prove the block is not parked in it.
    await expect(spendBlock(page)).not.toContainText(SPEND_LOADING);
    await expect(spendBlock(page)).toHaveAttribute('aria-busy', 'false');

    // The sub-heading and the intro, both from the Phase 5 copy inventory. The
    // intro appears exactly once: it is a statement about the whole block, and
    // a second copy under a second card would read as a second scope.
    await expect(spendBlock(page).locator('h3')).toHaveText(SPEND_HEADING);
    await expect(page.getByText(SPEND_INTRO, { exact: true })).toHaveCount(1);

    // The cards themselves, in the order the fixture states, each with its
    // heading, its headline and its paid count.
    const cards = page.getByTestId('spend-card');
    await expect(cards).toHaveCount(EXPECTED_CARDS.length);
    for (const [index, expected] of EXPECTED_CARDS.entries()) {
      const card = cards.nth(index);
      await expect(card).toHaveAttribute('data-currency', expected.dataCurrency);
      await expect(card.locator('h4')).toHaveText(expected.heading);
      await expect(card.getByTestId('spend-total')).toHaveText(expected.headline);
      await expect(card.getByTestId('spend-paid-count')).toHaveText(expected.paidCount);
    }

    // Exactly one total per card and none outside one. D-21's headline claim
    // is a per-currency claim, and a total that had escaped its card would be
    // a figure belonging to no currency at all.
    await expect(page.getByTestId('spend-total')).toHaveCount(EXPECTED_CARDS.length);
    await expect(
      page.locator('[data-testid="spend-total"]:not([data-testid="spend-card"] *)'),
    ).toHaveCount(0);
  });

  test('(figures) failed, new and other counts, the gift lines and the excluded pill per card', async () => {
    // The cross-checks, again as literals: USD is the only card holding a
    // figure of every kind, and UAH's `other` is zero — which is what makes
    // "only when the other count is above zero" assertable rather than a claim
    // about a row that happens to be there.
    expect(USD_CARD.failed).toBe('1');
    expect(USD_CARD.newOrders).toBe('1');
    expect(USD_CARD.other).toBe('1');
    expect(USD_CARD.gift).toBe('Includes 2 gift orders worth USD 5.01.');
    expect(USD_CARD.excluded).toBe('1 paid order excluded');
    const uah = EXPECTED_CARDS[1]!;
    expect(uah.other).toBe('0');
    expect(uah.gift).toBe('Includes 1 gift order worth UAH 250.50.');
    expect(uah.excluded).toBeNull();

    const cards = page.getByTestId('spend-card');
    for (const [index, expected] of EXPECTED_CARDS.entries()) {
      const card = cards.nth(index);

      // The separate status counts, as a definition list so a screen reader
      // pairs each number with the word it belongs to. `Failed` and `New` are
      // always present — a zero is a true statement — while `Other status`
      // appears only above zero, because "no order had an unfamiliar status"
      // is noise rather than information.
      const list = card.locator('dl');
      await expect(list.locator('dt', { hasText: SPEND_LABEL_FAILED })).toHaveCount(1);
      await expect(list.locator('dd').nth(0)).toHaveText(expected.failed);
      await expect(list.locator('dt', { hasText: SPEND_LABEL_NEW })).toHaveCount(1);
      await expect(list.locator('dd').nth(1)).toHaveText(expected.newOrders);
      if (Number(expected.other.replace(/,/g, '')) > 0) {
        await expect(card.getByTestId('spend-other')).toHaveCount(1);
        await expect(card.getByTestId('spend-other')).toHaveText(expected.other);
        await expect(list.locator('dt', { hasText: SPEND_LABEL_OTHER })).toHaveCount(1);
      } else {
        await expect(card.getByTestId('spend-other')).toHaveCount(0);
        await expect(list.locator('dt', { hasText: SPEND_LABEL_OTHER })).toHaveCount(0);
      }

      // The gift line is a VIEW of the paid rows, not an addition to them, so
      // it is present exactly when the card holds gift orders and absent
      // otherwise. D-23: the gifts are already inside the headline, because a
      // headline that excluded them would not match a bank statement.
      if (expected.gift === null) {
        await expect(card.getByTestId('spend-gift')).toHaveCount(0);
      } else {
        await expect(card.getByTestId('spend-gift')).toHaveText(expected.gift);
      }

      // The excluded pill, the same amber notice the other three blocks use.
      // Exactly one card in this fixture holds an excluded row, and the other
      // four render no notice at all — the shared component makes a zero pill
      // unrepresentable rather than trusting each caller.
      if (expected.excluded === null) {
        await expect(card.getByTestId('spend-excluded')).toHaveCount(0);
      } else {
        const pill = card.getByTestId('spend-excluded');
        await expect(pill).toHaveCount(1);
        await expect(pill).toContainText(expected.excluded);
        await expect(pill).toContainText(SPEND_EXCLUDED_EXPLANATION);
      }
    }

    // One pill across the whole block, and it is the card that has the
    // excluded row. Asserted as a count as well as per card, because a pill
    // rendered at the block level instead of inside a card would be a figure
    // about the WHOLE export, which is the one thing this block never says.
    await expect(page.getByTestId('spend-excluded')).toHaveCount(1);
  });

  test('(breakdown) closed by default, the two tables open with the fixture-derived rows', async () => {
    // The cross-checks, as literals. USD's two years split 5.005 (the two
    // gifts) and 10.49; its two games split three orders at 14.49 and one at
    // 1.005. The exact micro-unit sums add up to the 15.495 headline, which is
    // D-22's claim that the breakdown is a VIEW of the same paid rows rather
    // than a second, differently-computed total.
    expect(USD_CARD.byYear.map((row) => [row.label, row.paid, row.total])).toEqual([
      ['2021', '2 paid orders', 'USD 5.01'],
      ['2020', '2 paid orders', 'USD 10.49'],
    ]);
    expect(USD_CARD.byGame.map((row) => [row.label, row.paid, row.total])).toEqual([
      ['WOT', '3 paid orders', 'USD 14.49'],
      ['COMMON', '1 paid order', 'USD 1.01'],
    ]);

    // Closed by default, on EVERY card: a reader who wants the headline should
    // not have to dismiss five disclosures to get to the next one.
    //
    // The claim is VISIBILITY, not absence. A native closed `<details>` keeps
    // its children in the DOM and hides them, so a count of zero would be
    // asserting a rendering strategy this component deliberately does not use
    // — the currency block's `{#if open}` is a per-chart flag, and five cards
    // would need five of them for rows that are already in memory.
    const cards = page.getByTestId('spend-card');
    for (let index = 0; index < EXPECTED_CARDS.length; index += 1) {
      const disclosure = cards.nth(index).getByTestId('spend-breakdown');
      await expect(disclosure).toHaveCount(1);
      await expect(disclosure).not.toHaveAttribute('open', /.*/);
      await expect(disclosure.locator('summary')).toHaveText(SPEND_BREAKDOWN_DISCLOSURE);
      await expect(disclosure.locator('table').first()).toBeHidden();
    }

    // Open the USD card's disclosure and read both tables.
    const usdDisclosure = cards.nth(0).getByTestId('spend-breakdown');
    await usdDisclosure.locator('summary').click();
    await expect(usdDisclosure.locator('table')).toHaveCount(2);

    // Native semantics: each table announces its own caption, and each
    // column header is scoped to its column.
    const tables = usdDisclosure.locator('table');
    const byYear = tables.nth(0);
    await expect(byYear.locator('caption')).toHaveText(SPEND_BY_YEAR);
    const byGame = tables.nth(1);
    await expect(byGame.locator('caption')).toHaveText(SPEND_BY_GAME);
    for (const table of [byYear, byGame]) {
      const headers = table.locator('th');
      await expect(headers).toHaveCount(3);
      for (let h = 0; h < 3; h += 1) {
        await expect(headers.nth(h)).toHaveAttribute('scope', 'col');
      }
    }

    // The rows themselves, in the order the worker returned them, with the
    // year descending and the games by paid count then code units.
    for (const [tableIndex, rows] of [USD_CARD.byYear, USD_CARD.byGame].entries()) {
      const body = tables.nth(tableIndex).locator('tbody tr');
      await expect(body).toHaveCount(rows.length);
      for (const [rowIndex, row] of rows.entries()) {
        const cells = body.nth(rowIndex).locator('td');
        await expect(cells).toHaveCount(3);
        await expect(cells.nth(0)).toHaveText(row.label);
        await expect(cells.nth(1)).toHaveText(row.paid);
        await expect(cells.nth(2)).toHaveText(row.total);
      }
    }

    // The unit-less card's rows, where the totals carry NO code — the same
    // rule as its headline, one level down. Its two games tie on one order
    // each and break on code units, so `(not recorded)` precedes `WOT`.
    const unitlessDisclosure = cards.nth(4).getByTestId('spend-breakdown');
    await unitlessDisclosure.locator('summary').click();
    const unitless = unitlessDisclosure.locator('table');
    await expect(unitless.nth(0).locator('tbody tr')).toHaveCount(1);
    await expect(unitless.nth(0).locator('tbody tr td').nth(2)).toHaveText('13.34');
    await expect(unitless.nth(1).locator('tbody tr')).toHaveCount(2);
    await expect(unitless.nth(1).locator('tbody tr').nth(0).locator('td').nth(0)).toHaveText(
      SPEND_BLANK_GAME,
    );
  });

  test('(unit-less) the caption and the bare headline', async () => {
    // The cross-check, as a literal: an amount with no unit must not be given
    // one, and the caption is what says so in words rather than leaving the
    // reader to notice a missing code.
    expect(UNKNOWN_CURRENCY_HEADING).toBe('Unknown currency');

    const unitless = page.getByTestId('spend-card').nth(4);
    await expect(unitless.locator('h4')).toHaveText(UNKNOWN_CURRENCY_HEADING);
    // The bare amount — no code, no symbol, no invented unit.
    await expect(unitless.getByTestId('spend-total')).toHaveText('13.34');
    await expect(unitless.getByTestId('spend-total')).not.toContainText('USD');
    await expect(unitless).toContainText(UNKNOWN_CURRENCY_CAPTION);

    // …and the caption belongs to the unit-less card ALONE. The other four
    // have a real code and need no warning; a card repeating it would read as
    // doubt about its own currency.
    await expect(page.getByText(UNKNOWN_CURRENCY_CAPTION, { exact: true })).toHaveCount(1);

    // `usd` and `USD` are two cards, each shown as written. Case is data the
    // user recognises from their own statement, and folding it would merge two
    // groups the export never claimed were one (D-24).
    const cards = page.getByTestId('spend-card');
    await expect(cards.nth(0).getByTestId('spend-total')).toHaveText('USD 15.50');
    await expect(cards.nth(3).getByTestId('spend-total')).toHaveText('usd 3.00');
    await expect(cards.nth(0).locator('h4')).toHaveText('USD');
    await expect(cards.nth(3).locator('h4')).toHaveText('usd');
  });
});

// -----------------------------------------------------------------------------
// The roadmap criterion, and the states — each on its own export
// -----------------------------------------------------------------------------

/**
 * The five paid totals, and the figures a blended implementation would have
 * computed from them.
 *
 * A grand total across five currencies is a number that means nothing, and
 * this is the whole of the reason FINANCE-03 exists. The test below asserts
 * that none of these strings appears anywhere on the page — under BOTH
 * roundings, because a float sum and an exact sum of the same displayed
 * figures can differ by a cent and a test that pinned only one of them would
 * pass against the other.
 *
 * The exact sum is taken in MICRO-UNITS from the fixture and rendered by the
 * app's own money formatter, which is the path any real implementation would
 * take. The float sum is taken from the DISPLAYED figures instead, because
 * that is the subtler mistake: adding what the user can read rather than what
 * the worker summed. Both are formatted the same way, so a difference between
 * them shows up as a difference between the two strings this returns.
 *
 * Computed in Node from the fixture, never read out of the page.
 */
const BLENDED_FIGURES = (() => {
  const exactUnits = ORDERS_HAND_EXPECTED.cards.reduce(
    (sum, card) => sum + BigInt(card.totalThousandths) * UNITS_PER_THOUSANDTH,
    0n,
  );
  const exactText = formatMoneyAmount(exactUnits, 'en-US');
  // The same five figures as a reader would add them off the screen, in float.
  const floatUnits = BigInt(
    Math.round(
      EXPECTED_CARDS.reduce(
        (sum, card) => sum + Number(card.headline.split(' ').pop()!.replace(/,/g, '')),
        0,
      ) * 1e6,
    ),
  );
  const floatText = formatMoneyAmount(floatUnits, 'en-US');
  return {
    exactText,
    floatText,
    /** Any two cards' headlines added together, with and without a code. */
    pairwise: EXPECTED_CARDS.flatMap((card, index) => {
      const other = EXPECTED_CARDS[index + 1];
      if (other === undefined) return [];
      const a = Number(card.headline.split(' ').pop()!.replace(/,/g, ''));
      const b = Number(other.headline.split(' ').pop()!.replace(/,/g, ''));
      const grouped = formatMoneyAmount(BigInt(Math.round((a + b) * 1e6)), 'en-US');
      return [
        grouped,
        grouped.replace(/,/g, ''),
        `USD ${grouped}`,
        `USD ${grouped.replace(/,/g, '')}`,
      ];
    }),
  };
})();

/**
 * One Orders file whose every row carries a status the export does not
 * document, over a real three-letter currency — so the file is PRESENT and
 * POPULATED, and the block still has nothing to total.
 */
const NO_USABLE_ORDERS = renderQuoteAllCsv(ORDERS_HEADER_12, [
  ['2020-01-05 10:00:00', 'WOT', '1', 'USD', '9.99', '0', '', 'C', 'SETTLED', '', 'premium', ''],
  ['2020-02-06 11:00:00', 'WOT', '1', 'USD', '4.00', '0', '', 'C', 'CANCELLED', '', 'premium', ''],
  ['2020-03-07 12:00:00', 'WOT', '1', 'USD', '2.50', '0', '', 'C', 'REFUNDED', '', 'premium', ''],
]);

/** An Orders file with a real PAID row and an unbroken 80-character game code. */
const LONG_GAME_CODE = 'G'.repeat(80);

/** An Orders file whose unit-less amount is 60 unbroken characters of digits. */
const LONG_UNITLESS_AMOUNT = '1'.repeat(60);

const LONG_TEXT_ORDERS = renderQuoteAllCsv(ORDERS_HEADER_12, [
  [
    '2020-01-05 10:00:00',
    LONG_GAME_CODE,
    '1',
    'USD',
    '9.99',
    '0',
    '',
    'C',
    'PAID',
    '',
    'premium',
    '',
  ],
  [
    '2020-02-06 11:00:00',
    'WOT',
    '1',
    LONG_UNITLESS_AMOUNT,
    '1.00',
    '0',
    '',
    'C',
    'PAID',
    '',
    'premium',
    '',
  ],
]);

test.describe('05-15 real-money spend: the no-blended criterion and the states', () => {
  test('(no-blended) nothing anywhere on the page is a figure across currencies', async ({
    page,
  }) => {
    // The cross-check, first: 15.50 + 350.50 + 1000.00 + 3.00 + 13.34 = 1382.34.
    // If this literal and the computed form below ever disagree, one of them
    // is wrong and the assertions that follow are testing nothing.
    expect(BLENDED_FIGURES.exactText).toBe('1,382.34');
    expect(BLENDED_FIGURES.floatText).toBe('1,382.34');

    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());

    // STRUCTURE first, because it is the half that cannot be argued with: one
    // total per card, every total inside a card, and no total anywhere else on
    // the page. A blended figure is easiest to prove by where it ISN'T.
    const totals = page.getByTestId('spend-total');
    await expect(totals).toHaveCount(EXPECTED_CARDS.length);
    const orphanTotals = page.locator(
      '[data-testid="spend-total"]:not([data-testid="spend-card"] [data-testid="spend-total"])',
    );
    await expect(orphanTotals).toHaveCount(0);
    await expect(page.getByTestId('spend-card')).toHaveCount(EXPECTED_CARDS.length);

    // The intro is where a blended figure would most plausibly hide, because
    // it is the one sentence that talks about all five cards at once. It must
    // carry no digit: `1` appears in neither its copy nor a class name the
    // textContent could pick up.
    const intro = page.getByText(SPEND_INTRO, { exact: true });
    await expect(intro).toHaveCount(1);
    expect(await intro.textContent()).toMatch(/\D/);

    // Every word a reader can see, in the block and on the page: the text
    // content, the document title, and every `title` and `aria-label`
    // attribute inside the block. A tooltip or a `title` is exactly where a
    // "convenient" grand total would be added without touching the layout.
    const blockText = (await spendBlock(page).textContent()) ?? '';
    const pageText = (await page.locator('body').textContent()) ?? '';
    const attributes = await spendBlock(page).evaluate((node) =>
      Array.from(node.querySelectorAll('[title], [aria-label]'))
        .map((el) => `${el.getAttribute('title') ?? ''} ${el.getAttribute('aria-label') ?? ''}`)
        .join(' '),
    );
    const surface = `${blockText} ${pageText} ${await page.title()} ${attributes}`;

    // The five-currency sum, under both roundings, and each with a code in
    // front of it.
    for (const figure of [
      BLENDED_FIGURES.exactText,
      BLENDED_FIGURES.floatText,
      `USD ${BLENDED_FIGURES.exactText}`,
      `USD ${BLENDED_FIGURES.floatText}`,
      String(BLENDED_FIGURES.exactText).replace(/,/g, ''),
    ]) {
      expect(surface).not.toContain(figure);
    }
    // …and any two cards' headlines added together, which is the subtler
    // version of the same mistake: one card's total quietly including another's
    // rows.
    for (const figure of BLENDED_FIGURES.pairwise) {
      expect(surface).not.toContain(figure);
    }

    // The headline figures themselves ARE on the page, one per card — so the
    // assertions above are not passing because no money renders at all.
    for (const card of EXPECTED_CARDS) {
      expect(blockText).toContain(card.headline);
    }
    // …and the unit-less card's headline is the bare amount, so the absence of
    // a code there is a rule rather than an accident of a missing string.
    const unitlessTotal = page.getByTestId('spend-card').nth(4).getByTestId('spend-total');
    expect((await unitlessTotal.textContent()) ?? '').not.toMatch(/[A-Za-z]{3}\s/);
  });

  test('(states) unrecognised statuses give the no-usable message; a header-only Orders file gives an empty card and no block', async ({
    page,
  }) => {
    // E7: orders are present and populated, but none carries a status the
    // export documents, so there is no PAID order to total. The message is
    // `no-usable` rather than `ready` with zero cards, because "these orders
    // exist and none of them is one I can read" and "there is nothing here"
    // are different facts.
    await gotoApp(page);
    await importExport(
      page,
      SYNTHETIC_ZIP_NAME,
      buildCustomExport({ overrides: { 'Payment_history/Orders.csv': NO_USABLE_ORDERS } }),
    );

    const card = page.getByTestId('dashboard-section-payment-history');
    await expect(card).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
    await expect(spendBlock(page)).toHaveAttribute('data-state', 'no-usable');
    await expect(spendBlock(page)).toContainText(SPEND_NO_USABLE);
    // The section status and the block state are two different claims and the
    // spec proves both: a reader whose card says `ready` must still be told
    // inside it that no order could be totalled.
    await expect(page.getByTestId('spend-card')).toHaveCount(0);
    await expect(page.getByTestId('spend-total')).toHaveCount(0);
    // No loading park, and no stale card from a previous dataset.
    await expect(spendBlock(page)).not.toContainText(SPEND_LOADING);
  });

  test('(empty) a header-only Orders file leaves the section empty and renders no block at all', async ({
    page,
  }) => {
    // DATA-04: a Payment_history folder holding a header and no rows is an
    // EMPTY section, and the section's own message is the honest one. The
    // block must not appear, because a block saying "no orders with a
    // recognisable status" would blame the export for holding no orders at
    // all — two different facts (05-12/05-13's rule, D-09's ladder).
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildZeroRowPaymentExport());

    const card = page.getByTestId('dashboard-section-payment-history');
    await expect(card).toHaveAttribute('data-status', 'empty', { timeout: 30_000 });
    await expect(card).toContainText('This export contains no rows for Payment_history');
    await expect(spendBlock(page)).toHaveCount(0);
    await expect(page.getByTestId('spend-card')).toHaveCount(0);
  });

  test('(privacy) no order id, coupon, aggregator or package canary reaches the page', async ({
    page,
  }) => {
    await gotoApp(page);
    await importExport(page, SYNTHETIC_ZIP_NAME, buildSampleExport());
    await expect(spendBlock(page)).toHaveAttribute('data-state', 'ready');

    // T-05-47. The canaries are in the sample's EVERY order row, so this is a
    // claim about the columns the builder never reads — a widened column list
    // would put them on screen without changing any figure this suite asserts.
    //
    // Searched in the page CONTENT and in every attribute, because a value can
    // reach a reader through a `title` or an `aria-label` with no text change
    // at all.
    const content = (await page.locator('body').textContent()) ?? '';
    const attributes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*'))
        .flatMap((el) => Array.from(el.attributes))
        .map((attr) => `${attr.name}=${attr.value}`)
        .join(' '),
    );
    const surface = `${content} ${attributes}`;

    // The four STRING canaries, named rather than taken from `Object.values`:
    // the fixture also carries `orderIdPattern`, a RegExp, and `toContain` on a
    // RegExp throws a type error rather than making the assertion — so a loop
    // over the whole object would fail for a reason that has nothing to do with
    // privacy. Every field name listed here is named in the UI-SPEC's own
    // "never displayed" sentence.
    for (const canary of [
      FINANCE_CANARIES.orderId,
      FINANCE_CANARIES.coupon,
      FINANCE_CANARIES.aggregator,
      FINANCE_CANARIES.package,
    ]) {
      expect(surface).not.toContain(canary);
    }
    // The column NAMES are asserted too: a builder that resolved a column and
    // rendered its header would satisfy the canary half while still telling a
    // reader the export has a coupon column, which is the same disclosure in
    // a different costume.
    expect(surface).not.toMatch(/ORDER_UUID|PAY_COUPON_NAME|PAY_AGGREGATOR_DESC|AA_PACKAGE_LIST/);
  });

  for (const width of [375, 720]) {
    test(`(long-text) an 80-character game code and a 60-character unit-less value stay inside the viewport at ${width}px`, async ({
      page,
    }) => {
      // T-05-46, extending 05-12's backstop. Both strings are UNBROKEN, which
      // is the whole point: a wrapping line is what keeps them inside, and a
      // value with spaces would pass whether or not `overflow-wrap: anywhere`
      // is present.
      await page.setViewportSize({ width, height: 900 });
      await gotoApp(page);
      await importExport(
        page,
        SYNTHETIC_ZIP_NAME,
        buildCustomExport({ overrides: { 'Payment_history/Orders.csv': LONG_TEXT_ORDERS } }),
      );
      await expect(spendBlock(page)).toHaveAttribute('data-state', 'ready');

      // The long game code reached the page as TEXT, whole, inside the opened
      // breakdown. If it had been clipped or truncated the width assertions
      // below would be measuring the wrong string, so the premise is pinned
      // first — and it is the string that actually stresses the layout, since
      // it is 80 unbroken characters in a table cell at 375px.
      //
      // It is the SECOND table: the disclosure opens with `By year`, whose
      // cells are four digits, and the game code is in `By game code` after it.
      const usdCard = page.getByTestId('spend-card').nth(0);
      const breakdown = usdCard.getByTestId('spend-breakdown');
      await breakdown.locator('summary').click();
      const byGame = breakdown.locator('table').nth(1);
      await expect(byGame.locator('caption')).toHaveText(SPEND_BY_GAME);
      await expect(byGame.locator('tbody td').first()).toHaveText(LONG_GAME_CODE);

      // The 60-character CURRENCY cell is a different case and the OPPOSITE
      // one: sixty characters is not three letters, so it lands in the unit-less
      // group and the code is never rendered as a heading or a headline at all.
      // The card therefore carries the bare amount and the unknown-currency
      // caption — which is D-24 working, and is asserted here so the width
      // measurement below is not quietly taken over a card that is not the one
      // carrying the long value.
      const unitless = page.getByTestId('spend-card').nth(1);
      await expect(unitless).toHaveAttribute('data-currency', '');
      await expect(unitless.locator('h4')).toHaveText(UNKNOWN_CURRENCY_HEADING);
      await expect(unitless.getByTestId('spend-total')).toHaveText('1.00');
      // The unbroken cell itself is nowhere on the page — asserted positively,
      // because "it happens to be absent" is also what a truncated render
      // looks like, and only the reason above tells the two apart.
      expect(await page.locator('body').textContent()).not.toContain(LONG_UNITLESS_AMOUNT);

      // No page-level horizontal scroll — the UI-SPEC's phone-width rule.
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(width);

      // …and no CARD overflows its own list, which is the narrower claim and
      // the one that fails first when a single element refuses to wrap.
      const overflow = await page.evaluate(() => {
        const list = document.querySelector('[data-testid="spend-card"]')?.parentElement;
        if (list === null || list === undefined) return -1;
        const limit = list.getBoundingClientRect().width;
        return Math.max(
          ...Array.from(document.querySelectorAll('[data-testid="spend-card"]')).map(
            (card) => card.getBoundingClientRect().width - limit,
          ),
        );
      });
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
