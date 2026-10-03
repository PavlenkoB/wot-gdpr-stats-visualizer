// =============================================================================
// The finance fixture module (phase 05, plan 05-01, Task 1 — the tracer).
//
// WHY THIS FILE EXISTS
// `tests/fixtures/finance-fixtures.ts` is the answer key every finance
// dashboard is later checked against, so the KEY ITSELF has to be verified
// before any dashboard exists. This describe proves the two facts the whole
// phase rests on:
//
//   1. The three real 2021 header lists are the export's names, verbatim and
//      in the export's column order. A renamed or transposed column would
//      silently mis-bucket every row of the phase, and a header list is
//      exactly the kind of string array that rots unnoticed.
//   2. A real-header premium file and a real-header Orders file survive the
//      PRODUCTION parser `parseCsvFile` with the real column names, the cells
//      untouched, and the trailing space the export's premium-plus cells carry
//      still on the end.
//
// The physical format is part of that: the header line is bare, every data cell
// is double-quoted, and every line ends with a bare CR because that is what the
// payments-era files in a real export are written with.
//
// The fixture symbols arrive through a NAMESPACE import on purpose: a symbol
// that does not exist yet then fails ONE test with a clear message instead of
// crashing the whole file at module resolution, which is what makes a RED run
// readable.
//
// Decisions: D-03 (defensive parsing, real headers), D-04 (Orders columns).
// =============================================================================

import { describe, expect, it } from 'vitest';
import * as fixtures from '../../fixtures/finance-fixtures.ts';
import {
  oracleCurrency,
  oraclePremium,
  oracleSpend,
  type OracleRow,
} from '../../helpers/finance-oracle.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';

/**
 * The all-zero UUID pattern every order reference must match, spelled out here
 * rather than imported, so the T-05-01 assertion stands even before
 * `FINANCE_CANARIES` exists.
 */
const FINANCE_CANARIES_ORDER_PATTERN = /^0{8}-0{4}-0{4}-0{4}-0{12}$/;

describe('05-01 tracer: real-header Financial_data and Orders fixtures through the production parser', () => {
  it('names the three real headers verbatim, in the export column order', () => {
    expect(fixtures.PREMIUM_HEADER).toEqual(['PREMIUM', 'CURR_PREMIUM', 'CREATED', 'UPDATED']);
    expect(fixtures.CURRENCY_OPS_HEADER).toEqual([
      'CREATED',
      'CURRENCY_CODE',
      'CURRENCY_TITLE',
      'AMOUNT',
      'TYPE',
      'ORDER',
    ]);
    expect(fixtures.ORDERS_HEADER_12).toEqual([
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
    ]);
  });

  it('keys a parsed premium row PREMIUM, CURR_PREMIUM, CREATED, UPDATED in that order', () => {
    const text = fixtures.renderQuoteAllCsv(fixtures.PREMIUM_HEADER, [
      [
        'deposit WOT premium_plus 86400 sec ',
        'ru.wot.credits',
        '2019-05-15 08:00:00',
        '2019-05-15 08:00:00',
      ],
    ]);

    const parsed = parseCsvFile(text, 'premium', 'Operations_with_Premium_Days.csv');

    expect(parsed.skippedCount).toBe(0);
    expect(parsed.rows).toHaveLength(1);
    expect(Object.keys(parsed.rows[0]!.data)).toEqual([
      'PREMIUM',
      'CURR_PREMIUM',
      'CREATED',
      'UPDATED',
    ]);
  });

  it('keeps the trailing space on a premium-plus cell, because trimming is the builder job', () => {
    const text = fixtures.renderQuoteAllCsv(fixtures.PREMIUM_HEADER, [
      [
        'deposit WOT premium_plus 86400 sec ',
        'ru.wot.credits',
        '2019-05-15 08:00:00',
        '2019-05-15 08:00:00',
      ],
    ]);

    const parsed = parseCsvFile(text, 'premium', 'Operations_with_Premium_Days.csv');

    expect(parsed.rows[0]!.data['PREMIUM']).toBe('deposit WOT premium_plus 86400 sec ');
  });

  it('keys a parsed Orders row with twelve columns ending in the package list', () => {
    // The id and the three canary strings are spelled out here rather than
    // imported: `FINANCE_CANARIES` does not exist until Task 2, and this
    // describe has to be able to pass on its own.
    const row = [
      '2020-07-15 08:20:00',
      'WOT',
      '1',
      'USD',
      '9.99',
      '0',
      '00000000-0000-0000-0000-000000000000',
      'CANARY-COUPON',
      'PAID',
      'CANARY-AGGREGATOR',
      'premium',
      'CANARY-PACKAGE',
    ];
    const text = fixtures.renderQuoteAllCsv(fixtures.ORDERS_HEADER_12, [row]);

    const parsed = parseCsvFile(text, 'orders', 'Orders.csv');

    expect(parsed.skippedCount).toBe(0);
    expect(parsed.rows).toHaveLength(1);
    const keys = Object.keys(parsed.rows[0]!.data);
    expect(keys).toHaveLength(12);
    expect(keys.slice(-3)).toEqual([
      'PAY_AGGREGATOR_DESC',
      'PAY_ITEM_TYPE_NAME',
      'AA_PACKAGE_LIST',
    ]);
    // The two columns every spend figure is built from.
    expect(parsed.rows[0]!.data['PAYMENT_CURRENCY']).toBe('USD');
    expect(parsed.rows[0]!.data['PAYED_IN_CURR_AMT']).toBe('9.99');
  });

  it('writes the header bare and every data cell quoted, with bare-CR terminators', () => {
    const text = fixtures.renderQuoteAllCsv(
      ['A', 'B'],
      [
        ['one', 'two'],
        ['three', 'four'],
      ],
    );

    expect(text).toBe('A;B\r"one";"two"\r"three";"four"\r');
    expect(text).not.toContain('\n');
    // A bare CR must not have been doubled into CRLF.
    expect(text).not.toContain('\r\n');
  });

  it('doubles an embedded quote so a cell cannot end the field early', () => {
    const text = fixtures.renderQuoteAllCsv(['A'], [['say "hi"']]);

    expect(text).toBe('A\r"say ""hi"""\r');
  });

  it('pads a short row with empty cells instead of writing a ragged line', () => {
    const text = fixtures.renderQuoteAllCsv(['A', 'B', 'C'], [['only']]);

    expect(text).toBe('A;B;C\r"only";"";""\r');
  });

  it('reads a bare-CR file with no trailing terminator on the last line', () => {
    // The renderer terminates the last line, but a real export may not, and
    // parseCsvFile must not need that terminator to find the last row.
    const text = 'PREMIUM;CREATED\r"1 day";"2019-03-05 10:00:00"';

    const parsed = parseCsvFile(text, 'premium', 'Operations_with_Premium_Days.csv');

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.data['PREMIUM']).toBe('1 day');
  });

  it('keeps a blank quoted cell as an empty string rather than dropping the row', () => {
    // RESEARCH Pitfall 4: a blank PREMIUM cell is an EXCLUDED row that must
    // still be counted, so the row has to survive the parser.
    const text = fixtures.renderQuoteAllCsv(fixtures.PREMIUM_HEADER, [
      ['', 'ru.wot.credits', '2019-06-12 00:00:00', '2019-06-12 00:00:00'],
    ]);

    const parsed = parseCsvFile(text, 'premium', 'Operations_with_Premium_Days.csv');

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.data['PREMIUM']).toBe('');
  });
});

// =============================================================================
// THE HAND FIXTURES (Task 2)
//
// Every number in the three expected objects is recomputed here with the
// INDEPENDENT oracle, which shares no date parser, no money parser and no
// duration parser with anything it checks. A wrong hand number fails here, in
// Node, in seconds — and it cannot be made to pass by changing the code it
// describes, because that code does not exist yet.
//
// The fixture symbols stay behind the namespace import: at RED time the
// expected objects do not exist, and a missing property must fail ONE
// comparison with a readable message rather than crash the file.
// =============================================================================

/**
 * Re-key tuple rows by the header, which is the only shape the oracle takes.
 *
 * `Object.fromEntries` rather than a hand-built literal, so no cell VALUE can
 * become a key: one currency fixture has `__proto__` as a `CURRENCY_CODE`
 * value, and an object literal could not hold it as one.
 */
function headerKeyed(rows: readonly (readonly string[])[], header: readonly string[]): OracleRow[] {
  return rows.map((row) => Object.fromEntries(header.map((name, i) => [name, row[i] ?? ''])));
}

/** Read a fixture CSV back through the production parser. */
function parseFixture(csv: string, category: string): OracleRow[] {
  const parsed = parseCsvFile(csv, category, `${category}.csv`);
  expect(parsed.skippedCount).toBe(0);
  return parsed.rows.map((row) => row.data);
}

/**
 * Render integer thousandths as the two-decimal string a spend card draws:
 * half AWAY from zero, on integer arithmetic only.
 *
 * Written HERE rather than in the oracle, because rounding is the app's job
 * (`ui-copy`, plan 05-08): an answer key that formatted its own money would be
 * asserting its own formatter against itself.
 */
function halfAwayTwo(thousandths: number): string {
  const sign = thousandths < 0 ? '-' : '';
  const cents = Math.floor((Math.abs(thousandths) + 5) / 10);
  const units = Math.floor(cents / 100);
  return `${sign}${units}.${String(cents - units * 100).padStart(2, '0')}`;
}

describe('premium hand fixture', () => {
  const { PREMIUM_HAND_CSV, PREMIUM_HAND_EXPECTED, PREMIUM_HAND_ROWS } = fixtures;

  it('recomputes every figure with the independent oracle', () => {
    const oracle = oraclePremium(headerKeyed(PREMIUM_HAND_ROWS, fixtures.PREMIUM_HEADER));

    // 11 grants, 7 excluded, 4,579,200 seconds = 53 days exactly.
    expect(oracle.grants).toBe(11);
    expect(oracle.excluded).toBe(7);
    expect(oracle.totalSeconds).toBe(4_579_200);
    expect(oracle.totalDays).toBe(53);
    expect(oracle).toEqual(PREMIUM_HAND_EXPECTED);
  });

  it('draws April 2019 empty rather than skipping it', () => {
    const oracle = oraclePremium(headerKeyed(PREMIUM_HAND_ROWS, fixtures.PREMIUM_HEADER));

    // 2019-03 is 2019 * 12 + 3 - 1 = 24230, so April is 24231.
    expect(oracle.firstMonth).toBe(24_230);
    expect(oracle.lastMonth).toBe(24_234);
    expect(oracle.axisMonths).toEqual([24_230, 24_231, 24_232, 24_233, 24_234]);
    // Five months on the axis, four of them carrying a grant.
    expect(oracle.months).toHaveLength(4);
    expect(oracle.months.map((month) => month.month)).not.toContain(24_231);
  });

  it('counts a withdrawal as excluded, lists its string and never a grant', () => {
    const oracle = oraclePremium(headerKeyed(PREMIUM_HAND_ROWS, fixtures.PREMIUM_HEADER));

    expect(oracle.unrecognised).toEqual([
      'withdrawal WOT premium_plus 86400 sec',
      'premium forever',
    ]);
  });

  it('ships three sizes for July and reports the fourth', () => {
    const oracle = oraclePremium(headerKeyed(PREMIUM_HAND_ROWS, fixtures.PREMIUM_HEADER));
    const july = oracle.months[3]!;

    expect(july.month).toBe(24_234);
    expect(july.sizes).toEqual([
      { seconds: 86_400, count: 1 },
      { seconds: 172_800, count: 1 },
      { seconds: 345_600, count: 1 },
    ]);
    expect(july.moreSizes).toBe(1);
  });

  it('reads back from the rendered CSV to the same answer', () => {
    // The tuples and the CSV are two artifacts of one fixture. Only this
    // comparison can notice the renderer losing the trailing space or the blank
    // cell, because the oracle sees whichever one the test hands it.
    const rows = parseFixture(PREMIUM_HAND_CSV, 'premium');

    expect(rows).toHaveLength(18);
    expect(oraclePremium(rows)).toEqual(PREMIUM_HAND_EXPECTED);
  });

  it('keeps the trailing space on all three premium-plus cells', () => {
    const rows = parseFixture(PREMIUM_HAND_CSV, 'premium');
    const plus = rows.map((row) => row['PREMIUM'] ?? '').filter((c) => c.includes('premium_plus'));

    expect(plus).toHaveLength(3);
    for (const value of plus) expect(value.endsWith('sec ')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // The real export's SHAPE (plan 05-18, UAT G-05-3)
  // -------------------------------------------------------------------------

  it('stamps CREATED and UPDATED alike on every premium row, in both sets', () => {
    // The real file carries one bulk-migration moment in both columns, shared by
    // every row — which is why a builder that dates by `CREATED` collapses a
    // real export onto one meaningless month. Asserted on the ROWS as written
    // and on the parsed CSV, so the renderer cannot quietly fill them in.
    for (const rows of [PREMIUM_HAND_ROWS, fixtures.PREMIUM_REAL_SHAPE_ROWS]) {
      for (const row of rows) {
        expect(row[2]).toBe(fixtures.PREMIUM_BULK_STAMP);
        expect(row[3]).toBe(fixtures.PREMIUM_BULK_STAMP);
      }
      const parsed = parseFixture(
        fixtures.renderQuoteAllCsv(fixtures.PREMIUM_HEADER, rows),
        'premium',
      );
      for (const row of parsed) {
        expect(row['CREATED']).toBe(fixtures.PREMIUM_BULK_STAMP);
        expect(row['UPDATED']).toBe(fixtures.PREMIUM_BULK_STAMP);
      }
    }
    // And no grant is written in the bulk column: every real date sits in
    // `CURR_PREMIUM`, which is the column the chart buckets on.
    for (const row of fixtures.PREMIUM_REAL_SHAPE_ROWS) {
      expect(row[1]).not.toBe(fixtures.PREMIUM_BULK_STAMP);
    }
  });

  it('buckets the real-shaped set by CURR_PREMIUM and never by the bulk stamp', () => {
    const recomputed = oraclePremium(
      headerKeyed(fixtures.PREMIUM_REAL_SHAPE_ROWS, fixtures.PREMIUM_HEADER),
    );

    expect(recomputed).toEqual(fixtures.PREMIUM_REAL_SHAPE_EXPECTED);
    // The assertion that fails for the bug this plan closes: dating by the
    // bulk stamp would report one month, 24,197, holding everything.
    expect(recomputed.months.map((month) => month.month)).not.toContain(24_197);
    expect(recomputed.months.map((month) => month.month)).toEqual([24_167, 24_168, 24_169, 24_170]);
    expect(recomputed.firstMonth).toBe(24_167);
    expect(recomputed.lastMonth).toBe(24_170);
    expect(recomputed.axisMonths).toEqual([24_167, 24_168, 24_169, 24_170]);
  });

  it('keeps the real-shaped answer through the rendered CSV', () => {
    // The tuples and the CSV are two artifacts of one fixture; only this
    // comparison notices the renderer losing a trailing space or a value.
    const rows = parseFixture(fixtures.PREMIUM_REAL_SHAPE_CSV, 'premium');

    expect(rows).toHaveLength(7);
    expect(oraclePremium(rows)).toEqual(fixtures.PREMIUM_REAL_SHAPE_EXPECTED);
    // The zero-second removal is excluded, counted, and listed with its text
    // trimmed — a `0 sec` withdrawal moves no time, and it is still disclosed.
    expect(
      rows.map((row) => row['PREMIUM']).filter((c) => (c ?? '').includes('premium_plus')),
    ).toHaveLength(2);
    expect(oraclePremium(rows).unrecognised).toEqual(['withdrawal WOT premium_plus 0 sec']);
  });

  it('falls back to CREATED for a file with no readable CURR_PREMIUM date', () => {
    // The fallback is a FILE-level rule, so it is exercised here with a header
    // that has no CURR_PREMIUM column at all: a missing cell reads as blank,
    // and blank is not a date, so the file is dated by CREATED (D-19 amended).
    const rows: OracleRow[] = [
      { PREMIUM: '1 day', CREATED: '2018-05-04 10:00:00' },
      { PREMIUM: '2 days', CREATED: '2018-06-04 10:00:00' },
    ];

    const recomputed = oraclePremium(rows);

    expect(recomputed.grants).toBe(2);
    expect(recomputed.firstMonth).toBe(24_220);
    expect(recomputed.months.map((month) => month.month)).toEqual([24_220, 24_221]);
  });
});

describe('currency hand fixture', () => {
  const { CURRENCY_HAND_CSV, CURRENCY_HAND_EXPECTED, CURRENCY_HAND_ROWS } = fixtures;

  it('recomputes every figure with the independent oracle', () => {
    const oracle = oracleCurrency(headerKeyed(CURRENCY_HAND_ROWS, fixtures.CURRENCY_OPS_HEADER));

    // 60 + 52 + 3 + 2 + 1 + 1 usable, and six excluded rows.
    expect(oracle.usable).toBe(119);
    expect(oracle.excluded).toBe(6);
    expect(oracle).toEqual(CURRENCY_HAND_EXPECTED);
  });

  it('charts credits before gold and lists the other four in tie-break order', () => {
    const oracle = oracleCurrency(headerKeyed(CURRENCY_HAND_ROWS, fixtures.CURRENCY_OPS_HEADER));

    expect(oracle.charted.map((group) => group.code)).toEqual([
      'ru.wot.credits',
      'ru.shared_currency.gold',
    ]);
    // Two one-operation codes tie on operations, and a blank code sorts last.
    expect(oracle.others.map((group) => group.code)).toEqual([
      'ru.wot.crystal',
      'UAH',
      '__proto__',
      '',
    ]);
  });

  it('totals an income as a deposit beside the deposit itself (D-18)', () => {
    const oracle = oracleCurrency(headerKeyed(CURRENCY_HAND_ROWS, fixtures.CURRENCY_OPS_HEADER));
    const crystal = oracle.others[0]!;

    expect(crystal.operations).toBe(3);
    // Deposit 100 + income 50 = 150 deposited; the withdrawal of 30 is the only
    // money that leaves the balance.
    expect(crystal.depositedThousandths).toBe(150_000);
    expect(crystal.withdrawnThousandths).toBe(30_000);
  });

  it('reads back from the rendered CSV to the same answer, canary code included', () => {
    const rows = parseFixture(CURRENCY_HAND_CSV, 'currency_ops');

    expect(rows).toHaveLength(CURRENCY_HAND_ROWS.length);
    expect(oracleCurrency(rows)).toEqual(CURRENCY_HAND_EXPECTED);
    // `__proto__` is a CURRENCY_CODE VALUE here, so the parser has to keep it as
    // one rather than lose the row or the code.
    expect(rows.filter((row) => row['CURRENCY_CODE'] === '__proto__')).toHaveLength(1);
    expect(rows.filter((row) => row['CURRENCY_CODE'] === '')).toHaveLength(1);
  });

  it('excludes the two refunds, the three bad amounts and the unreadable date', () => {
    const rows = parseFixture(CURRENCY_HAND_CSV, 'currency_ops');

    expect(rows.filter((row) => row['TYPE'] === 'refund')).toHaveLength(2);
    expect(rows.filter((row) => row['CREATED'] === 'not a date')).toHaveLength(1);
    expect(oracleCurrency(rows).excluded).toBe(6);
  });

  it('gives every row the all-zero ORDER reference (T-05-01)', () => {
    const rows = parseFixture(CURRENCY_HAND_CSV, 'currency_ops');

    for (const row of rows) expect(row['ORDER']).toMatch(FINANCE_CANARIES_ORDER_PATTERN);
  });
});

describe('income-only currency fixture', () => {
  const { CURRENCY_INCOME_ONLY_CSV, CURRENCY_INCOME_ONLY_EXPECTED, CURRENCY_INCOME_ONLY_ROWS } =
    fixtures;

  it('agrees with the independent oracle on every figure', () => {
    const oracle = oracleCurrency(
      headerKeyed(CURRENCY_INCOME_ONLY_ROWS, fixtures.CURRENCY_OPS_HEADER),
    );

    expect(oracle).toEqual(CURRENCY_INCOME_ONLY_EXPECTED);
  });

  it('reads back from the rendered CSV to the same answer', () => {
    const rows = parseFixture(CURRENCY_INCOME_ONLY_CSV, 'currency_ops');

    expect(rows).toHaveLength(5);
    expect(oracleCurrency(rows)).toEqual(CURRENCY_INCOME_ONLY_EXPECTED);
  });

  it('is the real shape: five income rows, a blank title and a zero-uuid ORDER', () => {
    const rows = parseFixture(CURRENCY_INCOME_ONLY_CSV, 'currency_ops');

    expect(rows.every((row) => row['TYPE'] === 'income')).toBe(true);
    expect(rows.every((row) => row['CURRENCY_TITLE'] === '')).toBe(true);
    expect(rows.every((row) => row['CURRENCY_CODE'] === 'UAH')).toBe(true);
    for (const row of rows) expect(row['ORDER']).toMatch(FINANCE_CANARIES_ORDER_PATTERN);
  });

  it('sums the five amounts to 600 whole units', () => {
    // The hand key states 600,000 thousandths. Deriving it from the cells
    // rather than copying the expected object is what makes the key a KEY.
    const rows = parseFixture(CURRENCY_INCOME_ONLY_CSV, 'currency_ops');
    const total = rows.reduce((sum, row) => sum + Number(row['AMOUNT']), 0);

    expect(total).toBe(600);
    expect(total * 1_000).toBe(CURRENCY_INCOME_ONLY_EXPECTED.others[0]!.depositedThousandths);
  });
});

describe('orders hand fixture', () => {
  const { ORDERS_HAND_CSV, ORDERS_HAND_EXPECTED, ORDERS_HAND_ROWS } = fixtures;

  /** The oracle's cards minus the two display strings, which are not its job. */
  function comparableCards(): unknown[] {
    const oracle = oracleSpend(headerKeyed(ORDERS_HAND_ROWS, fixtures.ORDERS_HEADER_12));
    return oracle.cards.map((card) => {
      const copy: Record<string, unknown> = { ...card };
      delete copy['displayTotal'];
      delete copy['displayGifts'];
      return copy;
    });
  }

  /** The expected cards with the same two strings removed. */
  function comparableExpected(): unknown[] {
    return ORDERS_HAND_EXPECTED.cards.map((card) => {
      const copy: Record<string, unknown> = { ...card };
      delete copy['displayTotal'];
      delete copy['displayGifts'];
      return copy;
    });
  }

  it('recomputes every card with the independent oracle', () => {
    const oracle = oracleSpend(headerKeyed(ORDERS_HAND_ROWS, fixtures.ORDERS_HEADER_12));

    expect(oracle.excluded).toBe(1);
    expect(oracle.cards).toHaveLength(5);
    expect(comparableCards()).toEqual(comparableExpected());
  });

  it('reports the USD total as 15495 thousandths', () => {
    const oracle = oracleSpend(headerKeyed(ORDERS_HAND_ROWS, fixtures.ORDERS_HEADER_12));
    const usd = oracle.cards[0]!;

    expect(usd.code).toBe('USD');
    // 9.99 + 0.5 + 1.005 + 4.00 = 15.495 exactly.
    expect(usd.totalThousandths).toBe(15_495);
    expect(usd.paid).toBe(4);
    expect(usd.gifts).toBe(2);
    expect(usd.giftThousandths).toBe(5_005);
    expect(usd.excluded).toBe(1);
    expect(usd.failed).toBe(1);
    expect(usd.newOrders).toBe(1);
    expect(usd.other).toBe(1);
  });

  it('orders the cards by paid orders and puts the unit-less one last', () => {
    const oracle = oracleSpend(headerKeyed(ORDERS_HAND_ROWS, fixtures.ORDERS_HEADER_12));

    expect(oracle.cards.map((card) => card.code)).toEqual(['USD', 'UAH', 'RUB', 'usd', '']);
    const unitless = oracle.cards[4]!;
    expect(unitless.unknownCurrency).toBe(true);
    expect(unitless.totalThousandths).toBe(13_340);
  });

  it('sums the by-year and by-game breakdowns back to the headline', () => {
    const oracle = oracleSpend(headerKeyed(ORDERS_HAND_ROWS, fixtures.ORDERS_HEADER_12));

    for (const card of oracle.cards) {
      const byYear = card.byYear.reduce((sum, row) => sum + row.totalThousandths, 0);
      const byGame = card.byGame.reduce((sum, row) => sum + row.totalThousandths, 0);
      expect(byYear).toBe(card.totalThousandths);
      expect(byGame).toBe(card.totalThousandths);
    }
  });

  it('draws 15.50 and 5.01 by half-away rounding, where a float toFixed disagrees', () => {
    // The float trap, in the test, so the reason for integer thousandths is
    // visible rather than folklore: 15.495 in binary is a hair BELOW 15.495.
    expect((15_495 / 1000).toFixed(2)).toBe('15.49');
    expect((5_005 / 1000).toFixed(2)).toBe('5.00');
    expect(halfAwayTwo(15_495)).toBe('15.50');
    expect(halfAwayTwo(5_005)).toBe('5.01');
  });

  it('renders every card total and gift line by half-away rounding', () => {
    const oracle = oracleSpend(headerKeyed(ORDERS_HAND_ROWS, fixtures.ORDERS_HEADER_12));

    for (const [index, expected] of ORDERS_HAND_EXPECTED.cards.entries()) {
      const card = oracle.cards[index]!;
      expect(halfAwayTwo(card.totalThousandths)).toBe(expected.displayTotal);
      expect(halfAwayTwo(card.giftThousandths)).toBe(expected.displayGifts);
    }
  });

  it('reads back from the rendered CSV to the same answer', () => {
    const rows = parseFixture(ORDERS_HAND_CSV, 'orders');

    expect(rows).toHaveLength(16);
    const oracle = oracleSpend(rows);
    expect(
      oracle.cards.map((card) => {
        const copy: Record<string, unknown> = { ...card };
        delete copy['displayTotal'];
        delete copy['displayGifts'];
        return copy;
      }),
    ).toEqual(comparableExpected());
  });

  it('fabricates every order id and canary cell (T-05-01)', () => {
    const rows = parseFixture(ORDERS_HAND_CSV, 'orders');

    for (const row of rows) {
      // The id column, on every row, including the excluded one.
      expect(row['ORDER_UUID']).toMatch(FINANCE_CANARIES_ORDER_PATTERN);
      expect(row['PAY_COUPON_NAME']).toBe(fixtures.FINANCE_CANARIES.coupon);
      expect(row['PAY_AGGREGATOR_DESC']).toBe(fixtures.FINANCE_CANARIES.aggregator);
      expect(row['AA_PACKAGE_LIST']).toBe(fixtures.FINANCE_CANARIES.package);
    }
  });
});

// =============================================================================
// THE SEEDED SCALE GENERATORS (Task 3)
//
// A random draw has no closed form, so the answer key for every generated file
// IS the oracle's output — the same independent recomputation the hand fixtures
// use. Determinism is what makes that legitimate: one seed always produces the
// same text, so the scale specs of plan 05-16 and this unit test are looking at
// the same bytes and can share one answer key.
//
// Day of month is 1 to 28, so every generated date is a real calendar date and
// the calendar check in the oracle is never the thing being exercised.
// =============================================================================

describe('seeded currency generators', () => {
  const {
    CURRENCY_10K_SPEC,
    CURRENCY_20Y_SPEC,
    CURRENCY_50K_SPEC,
    CURRENCY_STRAY_YEAR_SPEC,
    generateCurrencyOpsCsv,
  } = fixtures;

  /** The generated CSV as header-keyed rows, through the production parser. */
  function generatedRows(spec: Parameters<typeof generateCurrencyOpsCsv>[0]): OracleRow[] {
    return parseFixture(generateCurrencyOpsCsv(spec), 'currency_ops');
  }

  it('is byte-identical for the same spec and different for another seed', () => {
    const first = generateCurrencyOpsCsv(CURRENCY_10K_SPEC);
    const second = generateCurrencyOpsCsv(CURRENCY_10K_SPEC);

    expect(second).toBe(first);
    expect(
      generateCurrencyOpsCsv({ ...CURRENCY_10K_SPEC, seed: CURRENCY_10K_SPEC.seed + 1 }),
    ).not.toBe(first);
  });

  it('writes 10,000 parseable rows over six codes, including the stray UAH', () => {
    const rows = generatedRows(CURRENCY_10K_SPEC);
    const codes = new Set(rows.map((row) => row['CURRENCY_CODE']));

    expect(rows).toHaveLength(10_000);
    expect(codes.size).toBe(6);
    expect(codes.has('UAH')).toBe(true);
    expect(codes.has('ru.wot.credits')).toBe(true);
    expect(codes.has('ru.shared_currency.free_xp')).toBe(true);
  });

  it('draws all three types plus an unknown one, and some unparseable amounts', () => {
    const rows = generatedRows(CURRENCY_10K_SPEC);
    const types = new Set(rows.map((row) => row['TYPE']));

    expect(types.has('deposit')).toBe(true);
    expect(types.has('withdrawal')).toBe(true);
    expect(types.has('income')).toBe(true);
    // An unknown TYPE, and amounts that are not numbers at all.
    expect(types.has('refund')).toBe(true);
    expect(rows.filter((row) => row['AMOUNT'] === 'abc').length).toBeGreaterThan(0);
  });

  it('stays inside the stated span, 2013-01 to 2021-10', () => {
    const oracle = oracleCurrency(generatedRows(CURRENCY_10K_SPEC));
    const charted = oracle.charted[0]!;

    // 2013 * 12 + 1 - 1 = 24,156 and 2021 * 12 + 10 - 1 = 24,261, which is 106
    // months inclusive.
    expect(charted.firstMonth).toBe(24_156);
    expect(charted.lastMonth).toBe(24_261);
  });

  it('excludes the unknown types and bad amounts, and charts at least three currencies', () => {
    const oracle = oracleCurrency(generatedRows(CURRENCY_10K_SPEC));

    // 40 unknown-type rows plus 25 unparseable amounts.
    expect(oracle.excluded).toBe(65);
    expect(oracle.usable).toBe(10_000 - 65);
    expect(oracle.charted.length).toBeGreaterThanOrEqual(3);
  });

  it('covers every one of the 240 months of the 20-year spec', () => {
    const oracle = oracleCurrency(generatedRows(CURRENCY_20Y_SPEC));

    expect(oracle.others).toHaveLength(0);
    expect(oracle.charted).toHaveLength(1);
    // 240 months is past the 144-month threshold the scale specs care about.
    expect(oracle.charted[0]!.months).toBeGreaterThanOrEqual(240);
    expect(oracle.charted[0]!.operations).toBe(2_000);
  });

  it('excludes the four out-of-window rows of the stray-year spec', () => {
    const rows = generatedRows(CURRENCY_STRAY_YEAR_SPEC);
    const years = rows.map((row) => (row['CREATED'] ?? '').slice(0, 4));

    expect(years.filter((year) => year === '9999')).toHaveLength(2);
    expect(years.filter((year) => year === '1969')).toHaveLength(2);
    expect(oracleCurrency(rows).excluded).toBe(4);
  });

  it('writes 50,000 rows for the 50k spec', () => {
    const text = generateCurrencyOpsCsv(CURRENCY_50K_SPEC);

    // Counted by line rather than parsed: 50,000 PapaParse rows buys nothing
    // here that the 10,000-row parse above has not already proven. A trailing
    // CR makes the last split element empty, hence rows + header + 1.
    expect(text.split('\r')).toHaveLength(50_002);
  });

  it('stamps every generated row with the all-zero order reference (T-05-01)', () => {
    for (const row of generatedRows(CURRENCY_STRAY_YEAR_SPEC)) {
      expect(row['ORDER']).toMatch(FINANCE_CANARIES_ORDER_PATTERN);
    }
  });
});
