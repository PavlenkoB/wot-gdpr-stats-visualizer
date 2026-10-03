// =============================================================================
// The finance fixture module (phase 05, plan 05-01, Task 1).
//
// WHY THIS IS A MODULE AND NOT A SPEC
// The three hand fixtures and the seeded generators below are read by Node unit
// tests, by the worker round-trip specs of later plans, and by the browser
// specs of plans 05-16 and later. So the rows, the headers and every number
// derived from them live here, once, in a plain leaf module with no Vitest and
// no Playwright import and no side effect at load — the same contract
// `playtime-hand-fixture.ts` and `sessions-fixtures.ts` already satisfy. It
// deliberately does not import the shared sample builder, so that builder is
// free to import THIS file without a cycle.
//
// WHY THE ANSWERS LIVE HERE AT ALL
// Each hand fixture's expected object is DERIVED BY HAND from the rows, with
// the derivation in the comment beside the number, and
// `tests/unit/finance-fixtures.test.ts` recomputes every one of them with the
// INDEPENDENT oracle in `tests/helpers/finance-oracle.ts`, which shares no
// primitive with any implementation: dates are parsed by string splitting and
// money by integer thousandths. A wrong hand number therefore fails in Node in
// seconds, not in a browser run hours later. Plans 05-04 (the builders), 05-07
// (the worker round trip) and the scale specs import these SAME names and must
// not rename them.
//
// DATA POLICY (see tests/fixtures/README.md, T-05-01)
// Everything below is FABRICATED. No real export row is committed here, and
// nothing is anonymised — nothing real was ever read. Account-shaped values
// use reserved space (RFC 5737 for addresses, RFC 6761 for hostnames) and every
// order id is the literal all-zero UUID, because a real one is a personal
// identifier. A real sample must never be opened by this module.
//
// Decisions: D-03 (defensive parsing, fixtures with the real headers), D-04
// (orders gain the three real columns), D-15..D-18 (currency flow), D-19..D-20
// (premium time), D-21..D-24 (real-money spend).
// =============================================================================

import { mulberry32 } from './sessions-fixtures.ts';

/**
 * `Financial_data/Operations_with_Premium_Days.csv`'s header, verbatim and in
 * the export's own column order.
 *
 * FOUR columns, and the shape matters: there is no seconds column. `PREMIUM`
 * carries the duration or operation text — `1 day`, `2 days 12:00:00`, or a
 * premium-plus deposit — which is the whole reason the phase has to parse
 * durations at all.
 *
 * The other two columns are NOT what the 05-01 fixture first assumed, and the
 * correction is the point of plan 05-18 (UAT G-05-3):
 *
 *   `CURR_PREMIUM`  is where the real export records the OPERATION DATETIME —
 *                   the moment the premium was granted. The export's own readme
 *                   describes the file only as premium status at the time of
 *                   the transaction, so the column's meaning came from a
 *                   real-export comparison, not from documentation.
 *   `CREATED` and   are equal to EACH OTHER and carry one bulk-migration
 *   `UPDATED`      stamp shared by many rows — in the user's 2021 export,
 *                   128 rows collapsing onto two days (18 rows on one day and
 *                   16 on another).
 *
 * So the month a grant is drawn in comes from `CURR_PREMIUM`, and `CREATED` is
 * only the fallback for a file that carries no readable `CURR_PREMIUM` date
 * (D-19 as amended). `UPDATED` is never read at all.
 */
export const PREMIUM_HEADER: readonly string[] = ['PREMIUM', 'CURR_PREMIUM', 'CREATED', 'UPDATED'];

/**
 * `Payment_history/Virtual_Currencies_Operations.csv`'s header, verbatim and in
 * order — `CREATED` FIRST, and `ORDER` LAST.
 *
 * `ORDER` is an order reference, not a status, and no aggregation reads it.
 * `CURRENCY_TITLE` is absent for some codes in a real export (the hand fixture
 * has a blank one for `UAH`), so FINANCE-02 has to resolve a label rather than
 * assume one exists.
 */
export const CURRENCY_OPS_HEADER: readonly string[] = [
  'CREATED',
  'CURRENCY_CODE',
  'CURRENCY_TITLE',
  'AMOUNT',
  'TYPE',
  'ORDER',
];

/**
 * `Payment_history/Orders.csv`'s header, verbatim and in order — all TWELVE
 * columns, ending with the three that D-04 added coverage for.
 *
 * The two columns every spend figure comes from are `PAYMENT_CURRENCY` and
 * `PAYED_IN_CURR_AMT`, and the status is `PAY_ORDER_STATUS_CODE`. `ITEM_CNT` is
 * a count of items, not money, and nothing in this phase reads it; it is listed
 * because the header has to be complete.
 */
export const ORDERS_HEADER_12: readonly string[] = [
  'ACTION_DT',
  'GAME_CODE',
  'ITEM_CNT',
  'PAYMENT_CURRENCY',
  'PAYED_IN_CURR_AMT',
  'IS_GIFT',
  'ORDER_UUID',
  'PAY_COUPON_NAME',
  'PAY_ORDER_STATUS_CODE',
  'PAY_AGGREGATOR_DESC',
  'PAY_ITEM_TYPE_NAME',
  'AA_PACKAGE_LIST',
];

/**
 * One data cell: double-quoted, with any embedded `"` doubled.
 *
 * D-03 makes the reader defensive rather than the writer clever, so the only
 * escaping needed is the CSV-standard doubling, and a cell that cannot be
 * represented cannot corrupt the row that follows it.
 */
function quoteCell(cell: string): string {
  return `"${cell.replaceAll('"', '""')}"`;
}

/**
 * Write a fixture CSV in the export's own physical format.
 *
 *   - the header line is bare, NOT quoted;
 *   - every data cell is wrapped in `"` and cells are joined with `;`;
 *   - EVERY line, including the last, ends with a BARE CR — the terminator is
 *     present on the last line too.
 *
 * Why the bare CR matters: the payments-era files in a real export are written
 * with `\r` line endings, and PapaParse's default auto-detection handles them.
 * A fixture written with `\n` would pass while proving nothing about the file
 * it stands in for.
 *
 * A row with FEWER cells than the header is padded with empty cells rather than
 * written ragged, so a header-keyed read never sees a column vanish. A row with
 * MORE cells is written as given: ragged rows are a real export quirk the
 * parser tolerates, and a fixture that hid the quirk would not be testing it.
 */
export function renderQuoteAllCsv(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const lines: string[] = [header.join(';')];
  for (const row of rows) {
    const cells: string[] = [];
    for (let i = 0; i < header.length; i++) cells.push(quoteCell(row[i] ?? ''));
    lines.push(cells.join(';'));
  }
  return lines.map((line) => `${line}\r`).join('');
}

// =============================================================================
// THE HAND FIXTURES
//
// Each block is small enough to be checked with arithmetic instead of a rerun:
// the premium rows are eighteen, the currency rows are a stated formula, and
// the orders rows are sixteen one-line facts. Every expected object states its
// derivation in the comment beside it, and `tests/unit/finance-fixtures.test
// .ts` recomputes all of it with `tests/helpers/finance-oracle.ts`.
//
// MONTHS ARE INTEGERS
// Every month in the expected objects is `year * 12 + month - 1`, the key the
// app buckets on: 2019-03 is 24,230, 2019-04 is 24,231 and 2019-07 is 24,234.
//
// CANARIES AND IDS
// Every order row carries three literal canary strings and the literal all-zero
// UUID, because a real coupon name, aggregator description, package list or
// order id is a personal identifier. Uniqueness is deliberately NOT modelled:
// nothing in this phase groups or de-duplicates by order id, and a per-row
// varying id would break the "all-zero pattern" assertion T-05-01 asks for.
// =============================================================================

/** The canary strings and the id pattern every finance fixture must carry. */
export const FINANCE_CANARIES = {
  /** `PAY_COUPON_NAME` on every order row. */
  coupon: 'CANARY-COUPON',
  /** `PAY_AGGREGATOR_DESC` on every order row. */
  aggregator: 'CANARY-AGGREGATOR',
  /** `AA_PACKAGE_LIST` on every order row. */
  package: 'CANARY-PACKAGE',
  /** `ORDER_UUID` on every order row and `ORDER` on every currency row. */
  orderId: '00000000-0000-0000-0000-000000000000',
  /** The pattern that id has to match, for the T-05-01 assertion. */
  orderIdPattern: /^0{8}-0{4}-0{4}-0{4}-0{12}$/,
} as const;

/**
 * The invented bulk-migration stamp every premium row carries in its `CREATED`
 * and `UPDATED` cells.
 *
 * It stands in for the shape the user's real 2021 export has: those two columns
 * are equal to each other and hold one migration moment shared by many rows
 * (UAT G-05-3). Month `2016 * 12 + 6 - 1` is 24,197, which is OUTSIDE every
 * grant month in either premium fixture below — so a builder that regressed to
 * dating by `CREATED` would collapse the whole chart onto a single month, and
 * an assertion that no returned month is 24,197 catches that (T-05-55).
 *
 * INVENTED (T-05-56). No stamp, date or duration from the user's real premium
 * file is committed anywhere in this repository.
 */
export const PREMIUM_BULK_STAMP = '2016-06-15 03:00:00';

/**
 * One premium row in the export's own column order
 * (`PREMIUM;CURR_PREMIUM;CREATED;UPDATED`), shaped like a REAL one.
 *
 * The grant datetime goes in `CURR_PREMIUM`, where the real export records the
 * operation time, and `CREATED` and `UPDATED` both carry
 * {@link PREMIUM_BULK_STAMP}. Building every row through this one function is
 * what makes "no row is dated by its own `CREATED`" true by construction rather
 * than by eighteen repetitions that could drift.
 */
export function premiumRow(premium: string, grantedAt: string): readonly string[] {
  return [premium, grantedAt, PREMIUM_BULK_STAMP, PREMIUM_BULK_STAMP];
}

// ---------------------------------------------------------------------------
// Operations_with_Premium_Days.csv — eighteen rows, 11 grants, 7 excluded.
// ---------------------------------------------------------------------------

/**
 * Eighteen rows in the export's own column order, each built by
 * {@link premiumRow} so the GRANT DATE is in `CURR_PREMIUM` and the shared
 * {@link PREMIUM_BULK_STAMP} is in `CREATED` and `UPDATED` — the real export's
 * shape (UAT G-05-3).
 *
 * The rows, and what each one is FOR. Every date below is the row's GRANT date,
 * and it is the value the chart buckets on:
 *
 *   2019-03  three grants: 1 day, 3 days, 1 day -> 432,000 s = 5 days, with
 *            sizes 86,400 twice and 259,200 once, so the tooltip's
 *            most-frequent-first order has something to order.
 *   2019-05  30 days, a premium-plus 86,400 s and a premium-plus 43,200 s ->
 *            2,721,600 s = 31.5 days, three distinct sizes once each, which is
 *            exactly the all-one-count tie that size-ascending order exists for.
 *   2019-06  one grant of `2 days 12:00:00` -> 216,000 s = 2.5 days, so a
 *            days-plus-clock duration is covered, plus the two excluded rows
 *            that carry strings: a withdrawal and `premium forever`.
 *   2019-07  7 days, 1 day, 2 days, 4 days -> 1,209,600 s = 14 days. Four
 *            distinct sizes all with count 1, so the tooltip must ship the
 *            three SMALLEST and report one more.
 *   (April)  NOTHING usable. The axis has to draw an empty month between two
 *            busy ones, and a fixture whose months are all populated cannot
 *            fail on a builder that skips gaps.
 *
 *   exclusions, seven in all: the withdrawal (excluded, string LISTED), the
 *   unknown text (excluded, string LISTED), the blank PREMIUM cell (excluded,
 *   nothing to list), 31 April (no such date), an unreadable date, and the two
 *   ends of the accepted year window, 1969 and 9999. Those last four keep their
 *   bad value in the GRANT-DATE column, so the file-level rule excludes them
 *   exactly as before.
 *
 * Two rows carry the TRAILING SPACE the export's premium-plus cells carry, and
 * one carries the dotted `15.07.2019 18:00` timestamp, which is day first.
 *
 * `PREMIUM_HAND_EXPECTED` does not change: the reshape MOVES each date one
 * column to the left rather than changing its value, so every month, size and
 * total is the same figure as before.
 */
export const PREMIUM_HAND_ROWS: readonly (readonly string[])[] = [
  premiumRow('1 day', '2019-03-05 10:00:00'),
  premiumRow('3 days', '2019-03-20 11:00:00'),
  premiumRow('1 day', '2019-03-28 09:30:00'),
  premiumRow('30 days', '2019-05-02 12:00:00'),
  premiumRow('deposit WOT premium_plus 86400 sec ', '2019-05-15 08:00:00'),
  premiumRow('deposit WOT premium_plus 43200 sec ', '2019-05-16 08:00:00'),
  premiumRow('2 days 12:00:00', '2019-06-01 00:00:00'),
  premiumRow('withdrawal WOT premium_plus 86400 sec ', '2019-06-10 00:00:00'),
  premiumRow('premium forever', '2019-06-11 00:00:00'),
  premiumRow('', '2019-06-12 00:00:00'),
  premiumRow('5 days', '2019-04-31 10:00:00'),
  premiumRow('5 days', 'not a date'),
  premiumRow('7 days', '15.07.2019 18:00'),
  premiumRow('1 day', '2019-07-16 00:00:00'),
  premiumRow('2 days', '2019-07-17 00:00:00'),
  premiumRow('4 days', '2019-07-18 00:00:00'),
  premiumRow('1 day', '9999-01-01 00:00:00'),
  premiumRow('1 day', '1969-12-31 23:59:59'),
];

/** The eighteen rows written out, for the parser round trip. */
export const PREMIUM_HAND_CSV = renderQuoteAllCsv(PREMIUM_HEADER, PREMIUM_HAND_ROWS);

/** One distinct grant size in a month. */
export interface PremiumSizeExpected {
  seconds: number;
  count: number;
}

/** One usable month of premium time. */
export interface PremiumMonthExpected {
  /** `year * 12 + month - 1`. */
  month: number;
  grants: number;
  seconds: number;
  days: number;
  sizes: readonly PremiumSizeExpected[];
  moreSizes: number;
}

/** Every FINANCE-01 figure, derived from `PREMIUM_HAND_ROWS` by hand. */
export interface PremiumHandExpected {
  grants: number;
  excluded: number;
  totalSeconds: number;
  totalDays: number;
  firstMonth: number | null;
  lastMonth: number | null;
  axisMonths: readonly number[];
  months: readonly PremiumMonthExpected[];
  unrecognised: readonly string[];
}

/**
 * 11 grants, 7 excluded rows, 4,579,200 seconds — 53 days exactly.
 *
 *   432,000 + 2,721,600 + 216,000 + 1,209,600 = 4,579,200 s
 *   4,579,200 / 86,400 = 53 days
 *
 * The half months are why the month figures are written as 31.5 and 2.5 rather
 * than as seconds twice. The axis runs 2019-03 (24,230) to 2019-07 (24,234)
 * with 24,231 — April — drawn but empty.
 *
 * The listed strings are exactly two, in first-seen order: the withdrawal,
 * excluded because of its VALUE, and `premium forever`. The blank PREMIUM cell
 * and the four rows dropped for their DATE are counted and list nothing.
 */
export const PREMIUM_HAND_EXPECTED: PremiumHandExpected = {
  grants: 11,
  excluded: 7,
  totalSeconds: 4_579_200,
  totalDays: 53,
  firstMonth: 24_230,
  lastMonth: 24_234,
  axisMonths: [24_230, 24_231, 24_232, 24_233, 24_234],
  months: [
    {
      month: 24_230,
      grants: 3,
      seconds: 432_000,
      days: 5,
      // 86,400 used twice, so it leads; then the single 259,200.
      sizes: [
        { seconds: 86_400, count: 2 },
        { seconds: 259_200, count: 1 },
      ],
      moreSizes: 0,
    },
    {
      month: 24_232,
      grants: 3,
      seconds: 2_721_600,
      days: 31.5,
      // Three sizes, each once, so the tie breaks by size ASCENDING:
      // 43,200 < 86,400 < 2,592,000.
      sizes: [
        { seconds: 43_200, count: 1 },
        { seconds: 86_400, count: 1 },
        { seconds: 2_592_000, count: 1 },
      ],
      moreSizes: 0,
    },
    {
      month: 24_233,
      grants: 1,
      seconds: 216_000,
      days: 2.5,
      sizes: [{ seconds: 216_000, count: 1 }],
      moreSizes: 0,
    },
    {
      month: 24_234,
      grants: 4,
      seconds: 1_209_600,
      days: 14,
      // Four distinct sizes, all count 1: ship the three smallest and report
      // the 604,800 s (7 days) one as the fourth.
      sizes: [
        { seconds: 86_400, count: 1 },
        { seconds: 172_800, count: 1 },
        { seconds: 345_600, count: 1 },
      ],
      moreSizes: 1,
    },
  ],
  unrecognised: ['withdrawal WOT premium_plus 86400 sec', 'premium forever'],
};

// ---------------------------------------------------------------------------
// Operations_with_Premium_Days.csv — the REAL shape, seven rows.
// ---------------------------------------------------------------------------

/**
 * Seven rows shaped like the user's real premium file, built with
 * {@link premiumRow}: the grant datetime in `CURR_PREMIUM`, and the invented
 * bulk-migration stamp in both `CREATED` and `UPDATED`.
 *
 * The eighteen-row hand fixture was reshaped to the real column semantics, but
 * it was never able to prove the fix on its own: its dates are all in 2019 and
 * its `CREATED` was itself a plausible month. This set exists to pin the two
 * facts that only a REAL-SHAPED file can:
 *
 *   1. the months come from `CURR_PREMIUM`, so they are the grant months and
 *      NOT the bulk stamp's 24,197;
 *   2. the value shapes the hand set lacks are all read — a seconds-bearing
 *      clock, a machine-written zero-second removal, a grant on the LAST SECOND
 *      of a month (which must stay in that month, D-01), and grants in a year
 *      the bulk stamp is not in.
 *
 * Every date, duration and total here is INVENTED (T-05-56): the arithmetic in
 * the answer key below is the only place these figures exist, and nothing from
 * the user's real export is committed.
 */
export const PREMIUM_REAL_SHAPE_ROWS: readonly (readonly string[])[] = [
  // The last second of 2013: belongs to 2013-12, NOT to 2014-01.
  premiumRow('1 day', '2013-12-31 23:59:59'),
  premiumRow('1 day', '2014-01-03 08:15:00'),
  premiumRow('30 days', '2014-01-20 19:40:12'),
  premiumRow('29 days 07:08:31', '2014-02-14 05:04:03'),
  premiumRow('3 days', '2014-03-09 22:10:00'),
  // The machine-written shapes carry the export's TRAILING SPACE.
  premiumRow('deposit WOT premium_plus 86400 sec ', '2014-03-30 01:00:00'),
  premiumRow('withdrawal WOT premium_plus 0 sec ', '2014-03-31 02:00:00'),
];

/** The real-shaped rows written out, for the parser round trip. */
export const PREMIUM_REAL_SHAPE_CSV = renderQuoteAllCsv(PREMIUM_HEADER, PREMIUM_REAL_SHAPE_ROWS);

/**
 * The real-shaped set's answer, derived BY HAND from the seven rows above.
 *
 *   24,167  2013-12   1 day                  86,400 s   -> 1 grant
 *   24,168  2014-01   1 day + 30 days        86,400 + 2,592,000 = 2,678,400 s
 *                                                   -> 2 grants
 *   24,169  2014-02   29 days 07:08:31       29 x 86,400 = 2,505,600
 *                                                   + 7 x 3,600  =    25,200
 *                                                   + 8 x 60     =       480
 *                                                   + 31         =        31
 *                                                   = 2,531,311 s
 *                                                   -> 1 grant
 *   24,170  2014-03   3 days + a deposit     259,200 + 86,400 = 345,600 s
 *                                                   -> 2 grants
 *
 *   total  86,400 + 2,678,400 + 2,531,311 + 345,600 = 5,641,711 s
 *   grants 6, excluded 1 (the zero-second withdrawal)
 *
 * The axis runs 24,167 to 24,170 with NO gap, because the set is designed so
 * every month in the span carries a grant — that is what lets the browser test
 * assert one bar per month without an empty-month exception.
 *
 * The PEAK is 24,168 at 2,678,400 s, which is exactly 31 days. That mirrors the
 * real finding behind UAT G-05-3: correcting the date column moved which month
 * is largest, so a builder that had silently kept the old column would be
 * caught by the peak as well as by the months.
 *
 * `days` is written as the division rather than as a hand-rounded numeral
 * because the oracle computes it the same way and a literal would be a second,
 * subtly different derivation.
 */
export const PREMIUM_REAL_SHAPE_EXPECTED: PremiumHandExpected = {
  grants: 6,
  excluded: 1,
  totalSeconds: 5_641_711,
  totalDays: 5_641_711 / 86_400,
  firstMonth: 24_167,
  lastMonth: 24_170,
  axisMonths: [24_167, 24_168, 24_169, 24_170],
  months: [
    {
      month: 24_167,
      grants: 1,
      seconds: 86_400,
      days: 86_400 / 86_400,
      sizes: [{ seconds: 86_400, count: 1 }],
      moreSizes: 0,
    },
    {
      month: 24_168,
      grants: 2,
      seconds: 2_678_400,
      days: 2_678_400 / 86_400,
      // Two sizes, each once: the tie breaks by size ASCENDING.
      sizes: [
        { seconds: 86_400, count: 1 },
        { seconds: 2_592_000, count: 1 },
      ],
      moreSizes: 0,
    },
    {
      month: 24_169,
      grants: 1,
      seconds: 2_531_311,
      days: 2_531_311 / 86_400,
      sizes: [{ seconds: 2_531_311, count: 1 }],
      moreSizes: 0,
    },
    {
      month: 24_170,
      grants: 2,
      seconds: 345_600,
      days: 345_600 / 86_400,
      // 3 days then a one-day deposit, ascending, both count 1.
      sizes: [
        { seconds: 86_400, count: 1 },
        { seconds: 259_200, count: 1 },
      ],
      moreSizes: 0,
    },
  ],
  unrecognised: ['withdrawal WOT premium_plus 0 sec'],
};

// ---------------------------------------------------------------------------
// Virtual_Currencies_Operations.csv — 119 usable operations, 6 excluded.
// ---------------------------------------------------------------------------

/**
 * The thirty consecutive months `ru.wot.credits` trades in, 2018-01 to 2020-06,
 * written out so the span can be checked by eye.
 *
 * `k` in the credits formula below is the index in THIS list, which is what
 * makes the deposits 1,000,000 then 1,001,000 then 1,002,000 and lets the
 * total be summed as 30 x 1,000,000 + 1,000 x (0 + 1 + ... + 29).
 */
const CREDITS_MONTHS: readonly string[] = [
  '2018-01',
  '2018-02',
  '2018-03',
  '2018-04',
  '2018-05',
  '2018-06',
  '2018-07',
  '2018-08',
  '2018-09',
  '2018-10',
  '2018-11',
  '2018-12',
  '2019-01',
  '2019-02',
  '2019-03',
  '2019-04',
  '2019-05',
  '2019-06',
  '2019-07',
  '2019-08',
  '2019-09',
  '2019-10',
  '2019-11',
  '2019-12',
  '2020-01',
  '2020-02',
  '2020-03',
  '2020-04',
  '2020-05',
  '2020-06',
];

/**
 * The rows, in the export's own column order
 * (`CREATED;CURRENCY_CODE;CURRENCY_TITLE;AMOUNT;TYPE;ORDER`). Every row's
 * `ORDER` is the all-zero UUID, including the excluded ones.
 *
 * `ru.wot.credits`, 60 operations: for each of the thirty months a deposit on
 * the 5th of `1,000,000 + 1,000k` and a withdrawal on the 15th of `400,000`, so
 * the month is walked twice and the axis has no gap at all.
 *
 *   deposited  30 x 1,000,000 + 1,000 x (0 + 1 + ... + 29)
 *              = 30,000,000 + 1,000 x 435 = 30,435,000
 *   withdrawn  30 x 400,000 = 12,000,000
 *
 * `ru.shared_currency.gold`, 52 operations: the last twenty-six of those months
 * (`CREDITS_MONTHS.slice(4)` is 2018-05 through 2020-06), a deposit of 250 and
 * a withdrawal of 100 each -> 6,500 in, 2,600 out.
 *
 * The four single-operation currencies exist to make the OTHER-CURRENCIES list
 * and the unit-less spend card real:
 *
 *   `ru.wot.crystal` three operations, one of them an `income` — an income is
 *     money counted UP (D-18), so it sits in the deposited total beside the
 *     deposit rather than in neither;
 *   `UAH` two operations and a BLANK `CURRENCY_TITLE`, so a label has to be
 *     resolved rather than read, and its deposit of 12.5 makes this the only
 *     non-integer amount in the fixture;
 *   a BLANK `CURRENCY_CODE` with one deposit, and `__proto__` with one deposit,
 *     because both are things a real export contains and a naive object-keyed
 *     grouping gets wrong. The two tie on one operation each, which also pins
 *     the tie-break order.
 *
 * The six excluded rows all carry `ru.wot.credits` on purpose: they have to be
 * counted BEFORE the grouping, or credits would report 66 operations and the
 * two refund amounts would leak into its total.
 */
export const CURRENCY_HAND_ROWS: readonly (readonly string[])[] = [
  ...CREDITS_MONTHS.map((month, k) => [
    `${month}-05 10:00:00`,
    'ru.wot.credits',
    'Credits',
    String(1_000_000 + 1_000 * k),
    'deposit',
    FINANCE_CANARIES.orderId,
  ]),
  ...CREDITS_MONTHS.map((month) => [
    `${month}-15 12:30:00`,
    'ru.wot.credits',
    'Credits',
    '400000',
    'withdrawal',
    FINANCE_CANARIES.orderId,
  ]),
  ...CREDITS_MONTHS.slice(4).map((month) => [
    `${month}-03 09:15:00`,
    'ru.shared_currency.gold',
    'Gold',
    '250',
    'deposit',
    FINANCE_CANARIES.orderId,
  ]),
  ...CREDITS_MONTHS.slice(4).map((month) => [
    `${month}-22 18:45:00`,
    'ru.shared_currency.gold',
    'Gold',
    '100',
    'withdrawal',
    FINANCE_CANARIES.orderId,
  ]),
  ['2019-04-01 09:00:00', 'ru.wot.crystal', 'Crystal', '100', 'deposit', FINANCE_CANARIES.orderId],
  ['2019-08-14 21:00:00', 'ru.wot.crystal', 'Crystal', '50', 'income', FINANCE_CANARIES.orderId],
  [
    '2020-01-09 12:00:00',
    'ru.wot.crystal',
    'Crystal',
    '30',
    'withdrawal',
    FINANCE_CANARIES.orderId,
  ],
  ['2019-01-11 07:00:00', 'UAH', '', '500', 'income', FINANCE_CANARIES.orderId],
  ['2019-06-02 16:00:00', 'UAH', '', '12.5', 'deposit', FINANCE_CANARIES.orderId],
  ['2019-02-13 08:30:00', '', '', '7', 'deposit', FINANCE_CANARIES.orderId],
  ['2019-03-17 19:45:00', '__proto__', '', '1', 'deposit', FINANCE_CANARIES.orderId],
  ['2019-09-01 10:00:00', 'ru.wot.credits', 'Credits', '100', 'refund', FINANCE_CANARIES.orderId],
  ['2019-09-02 10:00:00', 'ru.wot.credits', 'Credits', '250', 'refund', FINANCE_CANARIES.orderId],
  ['2019-09-03 10:00:00', 'ru.wot.credits', 'Credits', 'abc', 'deposit', FINANCE_CANARIES.orderId],
  ['2019-09-04 10:00:00', 'ru.wot.credits', 'Credits', '', 'deposit', FINANCE_CANARIES.orderId],
  ['not a date', 'ru.wot.credits', 'Credits', '999', 'deposit', FINANCE_CANARIES.orderId],
  ['2019-09-06 10:00:00', 'ru.wot.credits', 'Credits', '-5', 'deposit', FINANCE_CANARIES.orderId],
];

/** The rows written out, for the parser round trip. */
export const CURRENCY_HAND_CSV = renderQuoteAllCsv(CURRENCY_OPS_HEADER, CURRENCY_HAND_ROWS);

/**
 * The shape a REAL export carries and the hand fixture above does not: a
 * currency whose every row is an `income`, on the stray `UAH` code, with a
 * BLANK `CURRENCY_TITLE`. It is the only shape in the repository that can
 * expose an income being counted as an operation while being left out of both
 * sums — the hand fixture's `UAH` and `crystal` groups each have a deposit
 * beside the income, so their totals are wrong by an amount rather than zero.
 *
 * The amounts and stamps here are INVENTED (T-05-53). No row, amount or total
 * from a real export is committed; the user's real UAH figures appear only in
 * a local human check, never in a file. Every `ORDER` cell is the all-zero
 * uuid, so the block carries no personal identifier.
 */
export const CURRENCY_INCOME_ONLY_ROWS: readonly (readonly string[])[] = [
  ['2019-01-11 07:00:00', 'UAH', '', '112', 'income', FINANCE_CANARIES.orderId],
  ['2019-01-29 18:20:00', 'UAH', '', '87', 'income', FINANCE_CANARIES.orderId],
  ['2019-02-14 09:05:00', 'UAH', '', '240', 'income', FINANCE_CANARIES.orderId],
  ['2019-04-03 12:00:00', 'UAH', '', '95', 'income', FINANCE_CANARIES.orderId],
  ['2019-04-17 21:40:00', 'UAH', '', '66', 'income', FINANCE_CANARIES.orderId],
];

/** The income-only rows written out, for the parser round trip. */
export const CURRENCY_INCOME_ONLY_CSV = renderQuoteAllCsv(
  CURRENCY_OPS_HEADER,
  CURRENCY_INCOME_ONLY_ROWS,
);

/** One currency's usable flow. */
export interface CurrencyGroupExpected {
  code: string;
  operations: number;
  /** In integer THOUSANDTHS, so 12.5 is 12,500 and 1,000,000 is 1e9. */
  depositedThousandths: number;
  withdrawnThousandths: number;
  /** Months drawn on this currency's axis, gaps included. */
  months: number;
  firstMonth: number | null;
  lastMonth: number | null;
}

/** Which currencies get a chart, and which get one line each. */
export interface CurrencyHandExpected {
  usable: number;
  excluded: number;
  charted: readonly CurrencyGroupExpected[];
  others: readonly CurrencyGroupExpected[];
}

/**
 * 119 usable operations, 6 excluded, two charts and four other currencies.
 *
 *   usable    60 + 52 + 3 + 2 + 1 + 1 = 119
 *   excluded  two `refund` rows, `abc`, a blank AMOUNT, an unreadated CREATED
 *             and a NEGATIVE amount, all on credits
 *   charted   credits at 60 and gold at 52 both clear the 50-operation
 *             threshold, and the ordering rule puts the bigger one first
 *   others    crystal 3, UAH 2, then the two one-operation codes. They tie on
 *             operations and a BLANK code sorts last, so `__proto__` comes
 *             before the blank one.
 *
 * Amounts in thousandths, from the formula above. An `income` is money
 * counted UP, so it is added to the deposited total (D-18) — which is why
 * crystal carries its 50 and UAH its 500 beside their deposits:
 *   credits deposited 30,435,000 units = 30,435,000,000 thousandths
 *   credits withdrawn 12,000,000 units = 12,000,000,000 thousandths
 *   gold    deposited      6,500 units =          6,500,000 thousandths
 *   gold    withdrawn      2,600 units =          2,600,000 thousandths
 *   crystal deposited 100 + 50, withdrawn 30 = 150,000/30,000 thousandths
 *   UAH     deposited 500 + 12.5 units =           512,500 thousandths
 *   blank   deposited 7 units =                     7,000 thousandths
 *   proto   deposited 1 unit =                      1,000 thousandths
 *
 * Axis widths, from `year * 12 + month - 1`: credits 30 months
 * (24,216 to 24,245), gold 26 (24,220 to 24,245), crystal 10 (24,231 to
 * 24,240, with two empty months in between), UAH 6 (24,228 to 24,233, its two
 * rows five months apart), and 1 for each of the last two.
 */
export const CURRENCY_HAND_EXPECTED: CurrencyHandExpected = {
  usable: 119,
  excluded: 6,
  charted: [
    {
      code: 'ru.wot.credits',
      operations: 60,
      depositedThousandths: 30_435_000_000,
      withdrawnThousandths: 12_000_000_000,
      months: 30,
      firstMonth: 24_216,
      lastMonth: 24_245,
    },
    {
      code: 'ru.shared_currency.gold',
      operations: 52,
      depositedThousandths: 6_500_000,
      withdrawnThousandths: 2_600_000,
      months: 26,
      firstMonth: 24_220,
      lastMonth: 24_245,
    },
  ],
  others: [
    {
      code: 'ru.wot.crystal',
      operations: 3,
      depositedThousandths: 150_000,
      withdrawnThousandths: 30_000,
      months: 10,
      firstMonth: 24_231,
      lastMonth: 24_240,
    },
    {
      code: 'UAH',
      operations: 2,
      depositedThousandths: 512_500,
      withdrawnThousandths: 0,
      months: 6,
      firstMonth: 24_228,
      lastMonth: 24_233,
    },
    {
      code: '__proto__',
      operations: 1,
      depositedThousandths: 1_000,
      withdrawnThousandths: 0,
      months: 1,
      firstMonth: 24_230,
      lastMonth: 24_230,
    },
    {
      code: '',
      operations: 1,
      depositedThousandths: 7_000,
      withdrawnThousandths: 0,
      months: 1,
      firstMonth: 24_229,
      lastMonth: 24_229,
    },
  ],
};

/**
 * The income-only fixture's answer, by hand.
 *
 *   usable    5, all `income`, and 0 excluded — every row has a readable
 *             amount and a readable CREATED
 *   charted   nothing: five operations is far below the 50-operation threshold
 *             (D-16), so UAH is one Other-currencies line
 *   others    UAH alone, 5 operations
 *
 * Amounts in thousandths. An income is money counted UP (D-18), so all five
 * rows land in the deposited total:
 *   deposited  112 + 87 + 240 + 95 + 66 = 600 whole units = 600,000 thousandths
 *   withdrawn  0
 *
 * Axis width: months are `year * 12 + month - 1`, so 2019-01 is 24,228, 2019-02
 * is 24,229 and 2019-04 is 24,231. First 24,228 to last 24,231 is therefore a
 * FOUR-month axis with March empty — which is the gap the sparse month list has
 * to carry, and the reason a drawn axis is never `months.length`.
 */
export const CURRENCY_INCOME_ONLY_EXPECTED: CurrencyHandExpected = {
  usable: 5,
  excluded: 0,
  charted: [],
  others: [
    {
      code: 'UAH',
      operations: 5,
      depositedThousandths: 600_000,
      withdrawnThousandths: 0,
      months: 4,
      firstMonth: 24_228,
      lastMonth: 24_231,
    },
  ],
};

// ---------------------------------------------------------------------------
// Orders.csv — sixteen rows, fifteen usable, one excluded.
// ---------------------------------------------------------------------------

/**
 * One order row, in the export's own column order, with every column that is
 * not under test fixed to a fabricated value.
 *
 * The builder exists so the canary cells CANNOT be forgotten on one row: the
 * coupon, the aggregator description, the package list and the order id are the
 * same on all sixteen rows, and `tests/unit/finance-fixtures.test.ts` asserts
 * that over the PARSED CSV rather than over this source.
 */
function orderRow(
  actionDt: string,
  gameCode: string,
  currency: string,
  amount: string,
  isGift: string,
  status: string,
): readonly string[] {
  return [
    actionDt,
    gameCode,
    '1',
    currency,
    amount,
    isGift,
    FINANCE_CANARIES.orderId,
    FINANCE_CANARIES.coupon,
    status,
    FINANCE_CANARIES.aggregator,
    'premium',
    FINANCE_CANARIES.package,
  ];
}

/**
 * Sixteen rows, in the export's own column order.
 *
 *   USD, four PAID: 9.99, `.5` (the export writes a leading dot), 1.005 (three
 *     decimals) and 4.00. The last two are gifts, written `1` and `T`.
 *   USD, one PAID whose amount is `abc` -> EXCLUDED, never estimated.
 *   USD, one FAILED, one NEW and one REFUNDED — a status that is neither PAID,
 *     FAILED nor NEW has to be counted somewhere or not at all.
 *   UAH, two PAID (100 and 250.5) whose gifts are written `F` and `true`, so
 *     both non-gift spellings are covered too; plus one FAILED and one NEW.
 *   RUB, one PAID for the game `WOWP`, which is a different game from WOT.
 *   `usd`, one PAID: a lower-case code is its own card, and `'RUB' < 'usd'`
 *     because card ties break on plain code units, not on a locale.
 *   a blank currency with a blank `GAME_CODE`, and a TWO-LETTER currency `US`:
 *     neither is three letters, so both land on the unit-less card, which is
 *     last.
 */
export const ORDERS_HAND_ROWS: readonly (readonly string[])[] = [
  orderRow('2020-07-15 08:20:00', 'WOT', 'USD', '9.99', '0', 'PAID'),
  orderRow('2020-08-01 09:05:00', 'WOT', 'USD', '.5', '0', 'PAID'),
  orderRow('2021-01-10 10:30:00', 'COMMON', 'USD', '1.005', '1', 'PAID'),
  orderRow('2021-03-03 11:45:00', 'WOT', 'USD', '4.00', 'T', 'PAID'),
  orderRow('2021-04-04 12:15:00', 'WOT', 'USD', '50', '0', 'FAILED'),
  orderRow('2021-05-05 13:00:00', 'WOT', 'USD', '7.77', '0', 'NEW'),
  orderRow('2021-06-06 14:20:00', 'WOT', 'USD', 'abc', '0', 'PAID'),
  orderRow('2021-07-07 15:10:00', 'WOT', 'USD', '5', '0', 'REFUNDED'),
  orderRow('2020-02-02 16:00:00', 'WOT', 'UAH', '100', 'F', 'PAID'),
  orderRow('2019-12-12 17:25:00', 'WOT', 'UAH', '250.5', 'true', 'PAID'),
  orderRow('2020-03-03 18:05:00', 'WOT', 'UAH', '10', '0', 'FAILED'),
  orderRow('2020-04-04 19:40:00', 'WOT', 'UAH', '5', '0', 'NEW'),
  orderRow('2021-02-02 20:15:00', 'WOWP', 'RUB', '1000', '0', 'PAID'),
  orderRow('2021-08-08 21:30:00', 'WOT', 'usd', '3', '0', 'PAID'),
  orderRow('2021-09-09 22:00:00', '', '', '12.34', '0', 'PAID'),
  orderRow('2021-10-10 23:15:00', 'WOT', 'US', '1.00', '0', 'PAID'),
];

/** The sixteen rows written out, for the parser round trip. */
export const ORDERS_HAND_CSV = renderQuoteAllCsv(ORDERS_HEADER_12, ORDERS_HAND_ROWS);

/** One year of paid orders, newest first. */
export interface SpendYearExpected {
  year: string;
  paid: number;
  totalThousandths: number;
}

/** One game of paid orders. */
export interface SpendGameExpected {
  game: string;
  paid: number;
  totalThousandths: number;
}

/**
 * One currency's spend card.
 *
 * `displayTotal` and `displayGifts` are the two-decimal strings the card draws,
 * derived by hand from the thousandths. They live here rather than in the
 * oracle on purpose: the oracle does NO formatting, so a rounding rule cannot
 * be satisfied by the same code that reads the money.
 */
export interface SpendCardExpected {
  code: string;
  unknownCurrency: boolean;
  paid: number;
  totalThousandths: number;
  displayTotal: string;
  failed: number;
  newOrders: number;
  other: number;
  gifts: number;
  giftThousandths: number;
  displayGifts: string;
  excluded: number;
  byYear: readonly SpendYearExpected[];
  byGame: readonly SpendGameExpected[];
}

/** Every currency's card, in card order. */
export interface OrdersHandExpected {
  /** Whole-export PAID rows excluded for an unusable amount. */
  excluded: number;
  cards: readonly SpendCardExpected[];
}

/**
 * Five cards: USD, UAH, RUB, `usd`, then the unit-less one last.
 *
 *   USD  9.99 + 0.5 + 1.005 + 4.00 = 15.495 units = 15,495 thousandths, so the
 *        headline is 15.495 EXACTLY and the card draws 15.50 under half-away
 *        rounding. A float `toFixed(2)` would draw 15.49, because 15.495 in
 *        binary is a hair below 15.495 — which is the whole reason FINANCE-03
 *        forbids float money.
 *        gifts 1.005 + 4.00 = 5.005 units = 5,005 thousandths -> 5.01, which
 *        `(5.005).toFixed(2)` also gets wrong, drawing 5.00.
 *        by year, newest first: 2021 has the two gifts (5,005) and 2020 has
 *        9.99 and 0.5 (10,490).
 *        by game, most orders first: WOT three orders 14,490, then COMMON 1.005.
 *   UAH  100 + 250.5 = 350.5 units = 350,500 thousandths -> 350.50, one gift
 *        (the `true` row, 250.5 -> 250,500 thousandths, drawn 250.50) and one
 *        non-gift (`F`), plus 2019 older than 2020 so it comes second.
 *   RUB  1000 units = 1,000,000 thousandths -> 1000.00, all of it WOWP.
 *   usd  3 units -> 3.00; its own card because a code is not case-folded.
 *   blank + US, one card: 12.34 + 1.00 = 13.34 units = 13,340 thousandths ->
 *        13.34. Its two games tie on one order each, so they break on plain
 *        code units and `(not recorded)` comes before `WOT`.
 *
 * Card order is paid orders descending — USD 4, then UAH 2 and the unit-less
 * card 2, with the unit-less card pushed last — then RUB 1 before `usd` 1.
 */ export const ORDERS_HAND_EXPECTED: OrdersHandExpected = {
  excluded: 1,
  cards: [
    {
      code: 'USD',
      unknownCurrency: false,
      paid: 4,
      totalThousandths: 15_495,
      displayTotal: '15.50',
      failed: 1,
      newOrders: 1,
      other: 1,
      gifts: 2,
      giftThousandths: 5_005,
      displayGifts: '5.01',
      excluded: 1,
      byYear: [
        { year: '2021', paid: 2, totalThousandths: 5_005 },
        { year: '2020', paid: 2, totalThousandths: 10_490 },
      ],
      byGame: [
        { game: 'WOT', paid: 3, totalThousandths: 14_490 },
        { game: 'COMMON', paid: 1, totalThousandths: 1_005 },
      ],
    },
    {
      code: 'UAH',
      unknownCurrency: false,
      paid: 2,
      totalThousandths: 350_500,
      displayTotal: '350.50',
      failed: 1,
      newOrders: 1,
      other: 0,
      // `true` IS a gift spelling (D-22), so the 250.5 order is one: 1 gift
      // worth 250,500 thousandths. Only the `F` row is not a gift.
      gifts: 1,
      giftThousandths: 250_500,
      displayGifts: '250.50',
      excluded: 0,
      byYear: [
        { year: '2020', paid: 1, totalThousandths: 100_000 },
        { year: '2019', paid: 1, totalThousandths: 250_500 },
      ],
      byGame: [{ game: 'WOT', paid: 2, totalThousandths: 350_500 }],
    },
    {
      code: 'RUB',
      unknownCurrency: false,
      paid: 1,
      totalThousandths: 1_000_000,
      displayTotal: '1000.00',
      failed: 0,
      newOrders: 0,
      other: 0,
      gifts: 0,
      giftThousandths: 0,
      displayGifts: '0.00',
      excluded: 0,
      byYear: [{ year: '2021', paid: 1, totalThousandths: 1_000_000 }],
      byGame: [{ game: 'WOWP', paid: 1, totalThousandths: 1_000_000 }],
    },
    {
      code: 'usd',
      unknownCurrency: false,
      paid: 1,
      totalThousandths: 3_000,
      displayTotal: '3.00',
      failed: 0,
      newOrders: 0,
      other: 0,
      gifts: 0,
      giftThousandths: 0,
      displayGifts: '0.00',
      excluded: 0,
      byYear: [{ year: '2021', paid: 1, totalThousandths: 3_000 }],
      byGame: [{ game: 'WOT', paid: 1, totalThousandths: 3_000 }],
    },
    {
      code: '',
      unknownCurrency: true,
      paid: 2,
      totalThousandths: 13_340,
      displayTotal: '13.34',
      failed: 0,
      newOrders: 0,
      other: 0,
      gifts: 0,
      giftThousandths: 0,
      displayGifts: '0.00',
      excluded: 0,
      byYear: [{ year: '2021', paid: 2, totalThousandths: 13_340 }],
      byGame: [
        { game: '(not recorded)', paid: 1, totalThousandths: 12_340 },
        { game: 'WOT', paid: 1, totalThousandths: 1_000 },
      ],
    },
  ],
};

// =============================================================================
// THE SEEDED SCALE GENERATORS
//
// A random draw has no closed form, so THE ANSWER KEY FOR A GENERATED FILE IS
// THE ORACLE'S OUTPUT — the same independent recomputation the hand fixtures
// use. That is only legitimate because the generator is deterministic: one seed
// always produces the same text, so this unit test and the scale specs of plan
// 05-16 look at the same bytes and can share one answer key.
//
// The PRNG is `mulberry32` from `sessions-fixtures.ts`, imported rather than
// copied, so every seeded fixture in the suite draws from one generator.
//
// Day of month is 1 to 28, so every generated date is a real calendar date and
// the oracle's calendar check is never the thing under test.
// =============================================================================

/** One currency in a generated file, with the weight it is drawn with. */
export interface CurrencyCodeSpec {
  code: string;
  /** The label the export writes; `''` for a code the export leaves untitled. */
  title: string;
  /** Relative frequency. Integer, and the only thing that sets row counts. */
  weight: number;
}

/** How a generated row's month is chosen. */
export type MonthAssignment = 'uniform' | 'roundRobin';

/** Everything `generateCurrencyOpsCsv` needs, and nothing it has to invent. */
export interface CurrencyOpsSpec {
  seed: number;
  /** TOTAL data rows, bad rows included. */
  rows: number;
  /** First and last month, as `year * 12 + month - 1`, inclusive. */
  firstMonth: number;
  lastMonth: number;
  /**
   * `uniform` spreads a month over the span by draw, which leaves sparse
   * months. `roundRobin` walks the span in order, which GUARANTEES every month
   * in the span is covered — the only way to build a 240-month history for one
   * currency without a special case.
   */
  monthAssignment: MonthAssignment;
  codes: readonly CurrencyCodeSpec[];
  /** Rows whose TYPE is not one of the three the export writes. */
  unknownTypeRows: number;
  /** Rows whose AMOUNT is not a number. */
  nonNumericAmountRows: number;
  /** Rows dated outside the plausible-date window (year 9999, year 1969). */
  outOfWindowDateRows: number;
}

/** `year * 12 + month - 1`, the month key the app buckets on. */
function monthIndexOf(year: number, month: number): number {
  return year * 12 + month - 1;
}

/** The inverse, for writing a timestamp. */
function partsOfMonth(index: number): { year: number; month: number } {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Two digits, so a month or day is never written as `3`. */
function twoDigits(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** The timestamp the export writes, from a month key and a day and a clock. */
function stampOf(index: number, day: number, hour: number, minute: number, second: number): string {
  const { year, month } = partsOfMonth(index);
  return (
    `${year}-${twoDigits(month)}-${twoDigits(day)} ` +
    `${twoDigits(hour)}:${twoDigits(minute)}:${twoDigits(second)}`
  );
}

/** The two dates outside the plausible-date window, used in turn. */
const OUT_OF_WINDOW_DATES = ['9999-01-01 00:00:00', '1969-12-31 23:59:59'] as const;

/** The TYPE a bad row carries instead: a status the export does not write. */
const UNKNOWN_TYPE = 'refund';

/** The AMOUNT a bad row carries instead: not a number at all. */
const UNPARSEABLE_AMOUNT = 'abc';

/** Amount ceiling for a credit-like code, and for everything else. */
const CREDIT_AMOUNT_MAX = 5_000_000;
const ORDINARY_AMOUNT_MAX = 5_000;

/**
 * A code is credit-like when its name says so.
 *
 * Credits are denominated in millions and everything else in thousands, so one
 * range cannot serve both without making the small currencies look like noise.
 * Keyed on the code rather than on a spec flag, because no currency in a real
 * export carries such a flag.
 */
function isCreditLike(code: string): boolean {
  return code.toLowerCase().includes('credits');
}

/**
 * Choose `count` distinct row indices in `[0, rows)` from the stream.
 *
 * Drawn before any row is built, so the three bad kinds can never land on the
 * same row — a row that is both an unknown TYPE and an unparseable amount would
 * make the excluded count unknowable from the spec alone.
 */
function pickBadRows(
  rand: () => number,
  rows: number,
  count: number,
  taken: Set<number>,
): Set<number> {
  const chosen = new Set<number>();
  let guard = count * 1000;
  while (chosen.size < count && guard > 0) {
    const index = Math.floor(rand() * rows);
    guard -= 1;
    if (taken.has(index)) continue;
    taken.add(index);
    chosen.add(index);
  }
  return chosen;
}

/**
 * Draw a whole file of currency operations, deterministically.
 *
 * Everything comes from one `mulberry32` stream seeded by `spec.seed`, in a
 * fixed order — bad rows first, then code, month, day, clock, type and amount —
 * so the same spec always yields byte-identical text and a changed seed yields
 * different text.
 *
 * The bad-row counts are part of `rows`, not added to it: a spec that says 10,000
 * rows writes 10,000 rows, of which the stated number are unusable. That is
 * what lets the oracle's excluded count be derived from the spec at all.
 *
 * Returns the rendered CSV text, so the caller can parse it with the production
 * `parseCsvFile` rather than trusting the rows it was built from.
 */
export function generateCurrencyOpsCsv(spec: CurrencyOpsSpec): string {
  const rand = mulberry32(spec.seed);
  const span = spec.lastMonth - spec.firstMonth + 1;
  const totalWeight = spec.codes.reduce((sum, code) => sum + code.weight, 0);

  const taken = new Set<number>();
  const badType = pickBadRows(rand, spec.rows, spec.unknownTypeRows, taken);
  const badAmount = pickBadRows(rand, spec.rows, spec.nonNumericAmountRows, taken);
  const badDate = pickBadRows(rand, spec.rows, spec.outOfWindowDateRows, taken);

  const rows: string[][] = [];
  let outOfWindowUsed = 0;

  for (let i = 0; i < spec.rows; i++) {
    // The code: one weighted draw.
    const target = rand() * totalWeight;
    let running = 0;
    let chosen = spec.codes[spec.codes.length - 1]!;
    for (const code of spec.codes) {
      running += code.weight;
      if (target < running) {
        chosen = code;
        break;
      }
    }

    // The month: a uniform draw, or a walk that cannot skip a month.
    const month =
      spec.monthAssignment === 'roundRobin'
        ? spec.firstMonth + (i % span)
        : spec.firstMonth + Math.floor(rand() * span);
    const day = 1 + Math.floor(rand() * 28);
    const hour = Math.floor(rand() * 24);
    const minute = Math.floor(rand() * 60);
    const second = Math.floor(rand() * 60);

    // The type: weights 5, 2 and 1 over deposit, withdrawal and income.
    const typeTarget = rand() * 8;
    const type = typeTarget < 5 ? 'deposit' : typeTarget < 7 ? 'withdrawal' : 'income';

    // The amount: a whole number in the range the currency is denominated in.
    const ceiling = isCreditLike(chosen.code) ? CREDIT_AMOUNT_MAX : ORDINARY_AMOUNT_MAX;
    const amount = 1 + Math.floor(rand() * ceiling);

    rows.push([
      badDate.has(i)
        ? OUT_OF_WINDOW_DATES[outOfWindowUsed++ % OUT_OF_WINDOW_DATES.length]!
        : stampOf(month, day, hour, minute, second),
      chosen.code,
      chosen.title,
      badAmount.has(i) ? UNPARSEABLE_AMOUNT : String(amount),
      badType.has(i) ? UNKNOWN_TYPE : type,
      FINANCE_CANARIES.orderId,
    ]);
  }

  return renderQuoteAllCsv(CURRENCY_OPS_HEADER, rows);
}

/** The six codes the scale specs share, and the weights that size them. */
const SCALE_CODES: readonly CurrencyCodeSpec[] = [
  { code: 'ru.wot.credits', title: 'Credits', weight: 400 },
  { code: 'ru.shared_currency.free_xp', title: 'Free XP', weight: 380 },
  { code: 'ru.wot.crystal', title: 'Crystal', weight: 120 },
  { code: 'ru.shared_currency.gold', title: 'Gold', weight: 70 },
  { code: 'ru.wot.event_coin', title: 'Event Coin', weight: 25 },
  // A stray currency with a BLANK title and a handful of rows, so a label has
  // to be resolved at scale and so a six-code file is not a five-code file with
  // a long name.
  { code: 'UAH', title: '', weight: 3 },
];

/**
 * 10,000 rows from 2013-01 to 2021-10 (106 months), the six codes above, plus
 * 40 unknown-type rows and 25 unparseable amounts.
 *
 * So the oracle over this file reports 65 excluded rows, 9,935 usable ones and
 * five charted currencies. D-03's "10k+ operations over many years, mixed
 * codes, all three types plus an unknown one, unparseable amounts".
 */
export const CURRENCY_10K_SPEC: CurrencyOpsSpec = {
  seed: 5_001,
  rows: 10_000,
  firstMonth: monthIndexOf(2013, 1),
  lastMonth: monthIndexOf(2021, 10),
  monthAssignment: 'uniform',
  codes: SCALE_CODES,
  unknownTypeRows: 40,
  nonNumericAmountRows: 25,
  outOfWindowDateRows: 0,
};

/**
 * The same six codes over the same span, five times the rows: 50,000 rows.
 *
 * This is the file that makes an O(n) and an O(n squared) aggregation
 * distinguishable, so its determinism matters more than its contents.
 */
export const CURRENCY_50K_SPEC: CurrencyOpsSpec = {
  seed: 5_002,
  rows: 50_000,
  firstMonth: monthIndexOf(2013, 1),
  lastMonth: monthIndexOf(2021, 10),
  monthAssignment: 'uniform',
  codes: SCALE_CODES,
  unknownTypeRows: 40,
  nonNumericAmountRows: 25,
  outOfWindowDateRows: 0,
};

/**
 * 2,000 rows of ONE code across all 240 months from 2001-01 to 2020-12.
 *
 * The round-robin month assignment guarantees every one of the 240 months has
 * at least one row — 2000 / 240 is 8.3 — so this is the file that pushes a
 * chart past the 144-month scale-spec threshold and gives a bar chart more
 * nodes than a monthly bar chart is supposed to draw.
 */
export const CURRENCY_20Y_SPEC: CurrencyOpsSpec = {
  seed: 5_003,
  rows: 2_000,
  firstMonth: monthIndexOf(2001, 1),
  lastMonth: monthIndexOf(2020, 12),
  monthAssignment: 'roundRobin',
  codes: [{ code: 'ru.shared_currency.gold', title: 'Gold', weight: 1 }],
  unknownTypeRows: 0,
  nonNumericAmountRows: 0,
  outOfWindowDateRows: 0,
};

/**
 * A small file with the two ends of the plausible-date window in it: 20 ordinary
 * rows in 2019 plus 2 dated 9999 and 2 dated 1969, which the oracle has to
 * exclude as unreadable.
 *
 * The excluded total is therefore exactly 4, which is the assertion that proves
 * a stray year is a dropped ROW and not a dropped FILE.
 */
export const CURRENCY_STRAY_YEAR_SPEC: CurrencyOpsSpec = {
  seed: 5_004,
  rows: 20,
  firstMonth: monthIndexOf(2019, 1),
  lastMonth: monthIndexOf(2019, 12),
  monthAssignment: 'uniform',
  codes: [{ code: 'ru.wot.credits', title: 'Credits', weight: 1 }],
  unknownTypeRows: 0,
  nonNumericAmountRows: 0,
  outOfWindowDateRows: 4,
};
