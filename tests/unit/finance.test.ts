// =============================================================================
// The finance builders (phase 05, plan 05-04).
//
// WHAT THIS FILE IS FOR
// Every number on the Financial_data cards and the spend summary is produced by
// `src/lib/worker/finance.ts` and `src/lib/decimal.ts`. Those are pure
// functions with no worker, no Dexie and no DOM, so they run under Node and a
// wrong answer fails in seconds here rather than in a browser run hours later.
//
// The answers come from two independent places, and a number has to agree with
// BOTH before it is believed:
//   - the hand fixtures in `tests/fixtures/finance-fixtures.ts`, whose expected
//     objects carry the arithmetic in the comment beside each figure, and
//   - `tests/helpers/finance-oracle.ts`, which recomputes everything from the
//     raw rows with no import from `src/` at all — dates by string splitting,
//     money by integer thousandths.
//
// The two are written on purpose in different shapes, so a misreading of the
// export cannot hide in both at once.
//
// THE MONEY SCALE IS NOT THE SAME ON BOTH SIDES
// The fixture answer keys and the oracle both work in integer THOUSANDTHS,
// because no finance fixture carries more than three decimals. The application
// works in integer MICRO-UNITS (scale 6) as `bigint`, because a real PAID
// amount may carry six and because a fixed scale is what keeps the sums exact.
// Every comparison below therefore goes through `units(thousandths)`, which is
// the ONE conversion between the two scales and is applied to the FIXTURE
// side, never to the production side.
//
// Decisions: D-15..D-18, D-19 (withdrawals excluded, per the user's answer 1),
// D-20..D-24, D-25. Threats: T-05-07..T-05-11.
// =============================================================================

import { describe, expect, it } from 'vitest';

import * as fixtures from '../fixtures/finance-fixtures';
import * as oracle from '../helpers/finance-oracle';
import { parseCsvFile } from '../../src/lib/worker/csv-parse';
// A namespace import on purpose: a builder that does not exist yet fails the
// ONE test that calls it instead of crashing the whole file at module
// resolution, which is what makes the RED run below readable.
import * as finance from '../../src/lib/worker/finance';
import { formatMoneyAmount } from '../../src/lib/decimal';
import type { FinanceRow, PremiumMonth, SpendCard } from '../../src/lib/finance-shared';
import { mulberry32 } from '../fixtures/sessions-fixtures';

/**
 * Parse a fixture CSV with the IMPORT PATH's own parser, so the rows the
 * builders see are the rows the worker will see: quote-all cells unwrapped,
 * the export's trailing space intact, a bare-CR terminator on every line.
 */
function rowsFrom(csv: string, sourceFile: string): readonly FinanceRow[] {
  return parseCsvFile(csv, 'Financial_data', sourceFile).rows.map((row) => row.data);
}

/** The hand fixture's eighteen premium rows, parsed. */
function premiumHandRows(): readonly FinanceRow[] {
  return rowsFrom(fixtures.PREMIUM_HAND_CSV, 'Operations_with_Premium_Days.csv');
}

/**
 * The seven REAL-SHAPED premium rows, parsed: the grant datetime in
 * `CURR_PREMIUM` and the invented bulk-migration stamp in `CREATED` and
 * `UPDATED`, which is what the user's real premium file looks like.
 */
function premiumRealShapeRows(): readonly FinanceRow[] {
  return rowsFrom(fixtures.PREMIUM_REAL_SHAPE_CSV, 'Operations_with_Premium_Days.csv');
}

/**
 * A premium row whose date is the GRANT date, in `CURR_PREMIUM`, with the bulk
 * stamp in `CREATED` and `UPDATED`. Every inline premium row in this file is
 * built through it so no test can quietly re-create the invented shape (the
 * shape that let the real-export bug pass, UAT G-05-3).
 */
function premiumRowIn(premium: string, grantedAt: string): FinanceRow {
  const [cell0, cell1, cell2, cell3] = fixtures.premiumRow(premium, grantedAt);
  return {
    PREMIUM: cell0!,
    CURR_PREMIUM: cell1!,
    CREATED: cell2!,
    UPDATED: cell3!,
  };
}

/** The hand fixture's 125 currency-operation rows, parsed. */
function currencyHandRows(): readonly FinanceRow[] {
  return rowsFrom(fixtures.CURRENCY_HAND_CSV, 'Virtual_Currencies_Operations.csv');
}

/**
 * Thousandths (the fixture and oracle scale) to micro-units (the application
 * scale). The ONE conversion between the two, and it is applied to the FIXTURE
 * side of every comparison, never to a production value.
 */
function units(thousandths: number): string {
  return `${BigInt(thousandths) * 1000n}`;
}

/** One currency-operation row in the export's own column order. */
function currencyRow(
  code: string,
  type: string,
  amount: string,
  month: number,
  title = '',
): FinanceRow {
  const year = Math.floor(month / 12);
  const number = (month % 12) + 1;
  return {
    CREATED: `${year}-${String(number).padStart(2, '0')}-05 10:00:00`,
    CURRENCY_CODE: code,
    CURRENCY_TITLE: title,
    AMOUNT: amount,
    TYPE: type,
    // The all-zero order reference, present because the real column exists and
    // absent from every view because no builder reads it (T-05-11).
    ORDER: fixtures.FINANCE_CANARIES.orderId,
  };
}

/** A charted currency, in the fixture's field names and the fixture's scale. */
function chartGroup(entry: {
  code: string | null;
  ops: number;
  inUnits: string;
  outUnits: string;
  firstMonth: number;
  lastMonth: number;
}): unknown {
  return {
    code: entry.code ?? '',
    operations: entry.ops,
    depositedThousandths: Number(BigInt(entry.inUnits) / 1000n),
    withdrawnThousandths: Number(BigInt(entry.outUnits) / 1000n),
    // The fixture's `months` is the width of the DRAWN axis, gaps included,
    // which is what a sparse month list plus a first/last pair describes.
    months: entry.lastMonth - entry.firstMonth + 1,
    firstMonth: entry.firstMonth,
    lastMonth: entry.lastMonth,
  };
}

/** The view's month shape in the fixture's field names, with `days` derived. */
function monthOfView(month: PremiumMonth): unknown {
  return {
    month: month.month,
    grants: month.grants,
    seconds: month.seconds,
    days: month.seconds / 86_400,
    sizes: month.sizes.map((size) => ({ seconds: size[0], count: size[1] })),
    moreSizes: month.moreSizes,
  };
}

/** The fixture's month shape in the same field names, so the two compare. */
function monthOfExpected(month: fixtures.PremiumMonthExpected): unknown {
  return {
    month: month.month,
    grants: month.grants,
    seconds: month.seconds,
    days: month.days,
    sizes: month.sizes.map((size) => ({ seconds: size.seconds, count: size.count })),
    moreSizes: month.moreSizes,
  };
}

/**
 * The oracle's month shape in the same field names. The oracle's sizes are
 * objects where the view's are `[seconds, count]` tuples, so the two are
 * normalised here rather than in either module.
 */
function monthOfOracle(month: oracle.OraclePremiumMonth): unknown {
  return {
    month: month.month,
    grants: month.grants,
    seconds: month.seconds,
    days: month.days,
    sizes: month.sizes.map((size) => ({ seconds: size.seconds, count: size.count })),
    moreSizes: month.moreSizes,
  };
}

describe('05-04 tracer: premium through the production parser to the hand-derived answer', () => {
  it('reads every premium shape the real export writes, and refuses the rest', () => {
    // Trimmed first: every premium-plus cell in the sample ends in a space, so
    // an untrimmed anchored pattern would exclude all nine deposit rows
    // (RESEARCH Pitfall 4).
    expect(finance.parsePremium('1 day')).toEqual({ kind: 'grant', seconds: 86_400 });
    expect(finance.parsePremium('9 days')).toEqual({ kind: 'grant', seconds: 777_600 });
    // A days-plus-clock duration: 2 x 86400 + 12 x 3600 = 216,000.
    expect(finance.parsePremium('2 days 12:00:00')).toEqual({ kind: 'grant', seconds: 216_000 });
    expect(finance.parsePremium('deposit WOT premium_plus 86400 sec ')).toEqual({
      kind: 'grant',
      seconds: 86_400,
    });
    // A withdrawal is premium LEAVING the account. It is not a grant, not a
    // subtraction from a grant month, and not a silent drop: the user's answer
    // 1 excludes it, counts it, and lists its text with the unrecognised ones.
    expect(finance.parsePremium('withdrawal WOT premium_plus 86400 sec ')).toEqual({
      kind: 'removal',
    });

    // A clock out of range, an unknown phrase, a blank cell, a missing cell and
    // a cell longer than the store cap are all unrecognised.
    expect(finance.parsePremium('2 days 24:00:00')).toEqual({ kind: 'unrecognised' });
    expect(finance.parsePremium('2 days 12:60:00')).toEqual({ kind: 'unrecognised' });
    expect(finance.parsePremium('2 days 12:00:60')).toEqual({ kind: 'unrecognised' });
    expect(finance.parsePremium('premium forever')).toEqual({ kind: 'unrecognised' });
    expect(finance.parsePremium('')).toEqual({ kind: 'unrecognised' });
    expect(finance.parsePremium(undefined)).toEqual({ kind: 'unrecognised' });
    expect(finance.parsePremium('x'.repeat(5_000))).toEqual({ kind: 'unrecognised' });
  });

  it('buckets a readable date into its month and refuses every other shape', () => {
    // ISO and dotted day-first, both as written in the same export family
    // (RESEARCH Pitfall 14). 15.07.2019 is 15 JULY, not 7 March.
    expect(finance.monthOfTimestamp('2019-03-05 10:00:00')).toBe(24_230);
    expect(finance.monthOfTimestamp('15.07.2019 18:00')).toBe(24_234);
    // Missing, unparseable, an impossible calendar day, and both ends of the
    // plausible-date window: all null, so the row is excluded and counted
    // rather than bucketed into month 0 or a five-thousand-year axis (T-05-08).
    expect(finance.monthOfTimestamp(undefined)).toBeNull();
    expect(finance.monthOfTimestamp('')).toBeNull();
    expect(finance.monthOfTimestamp('not a date')).toBeNull();
    expect(finance.monthOfTimestamp('2019-04-31 10:00:00')).toBeNull();
    expect(finance.monthOfTimestamp('9999-01-01 00:00:00')).toBeNull();
    expect(finance.monthOfTimestamp('1969-12-31 23:59:59')).toBeNull();
  });

  it('reproduces the hand-derived premium answer and agrees with the oracle', () => {
    const rows = premiumHandRows();
    const expected = fixtures.PREMIUM_HAND_EXPECTED;
    const recomputed = oracle.oraclePremium(rows);
    const view = finance.buildPremium(rows, true);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    expect(view.grants).toBe(expected.grants);
    expect(view.excluded).toBe(expected.excluded);
    expect(view.totalSeconds).toBe(expected.totalSeconds);
    expect(view.totalSeconds / 86_400).toBe(expected.totalDays);
    expect(view.firstMonth).toBe(expected.firstMonth);
    expect(view.lastMonth).toBe(expected.lastMonth);
    // April 2019 is drawn but empty, so the axis is five months wide while only
    // four carry a grant — the property a sparse `months` list exists to keep.
    expect(view.lastMonth - view.firstMonth + 1).toBe(expected.axisMonths.length);
    expect(view.months.map(monthOfView)).toEqual(expected.months.map(monthOfExpected));
    // The two strings are listed, and the blank PREMIUM cell and the four rows
    // dropped for their DATE are counted without listing anything.
    expect([...view.unrecognised].sort()).toEqual([...expected.unrecognised].sort());
    expect(view.unrecognisedMore).toBe(0);

    // The independent recomputation, field for field.
    expect(view.grants).toBe(recomputed.grants);
    expect(view.excluded).toBe(recomputed.excluded);
    expect(view.totalSeconds).toBe(recomputed.totalSeconds);
    expect(view.firstMonth).toBe(recomputed.firstMonth);
    expect(view.lastMonth).toBe(recomputed.lastMonth);
    expect(view.months.map(monthOfView)).toEqual(recomputed.months.map(monthOfOracle));
    expect([...view.unrecognised].sort()).toEqual([...recomputed.unrecognised].sort());
  });

  it('orders the listed unrecognised strings by count, then by code units', () => {
    // The listed order is the DISCLOSURE order, not the file order: a string
    // that appears three times earns its line before one that appears once, and
    // equal counts break on plain code units so the order never depends on a
    // locale.
    const at = (premium: string): FinanceRow => premiumRowIn(premium, '2019-05-05 10:00:00');
    // One grant, so the view is `ready` and the disclosure has a card to sit
    // on; the five unrecognised values are the ones being ranked.
    const view = finance.buildPremium(
      [at('zebra'), at('zebra'), at('zebra'), at('mango'), at('apple'), at('1 day')],
      true,
    );
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.unrecognised).toEqual(['zebra', 'apple', 'mango']);
    expect(view.unrecognisedMore).toBe(0);
    expect(view.excluded).toBe(5);
    expect(view.grants).toBe(1);
  });

  it('separates a missing file, an empty file and nothing usable', () => {
    expect(finance.buildPremium([], false).status).toBe('not-in-export');
    expect(finance.buildPremium([], true).status).toBe('no-rows');

    // Every row unusable: the card still has to say how many rows it dropped
    // and which strings it could not read, because a card that simply shows
    // nothing is indistinguishable from a broken one (D-03, D-20).
    const unusable = finance.buildPremium(
      [
        premiumRowIn('premium forever', '2019-05-05 10:00:00'),
        premiumRowIn('', '2019-05-06 10:00:00'),
      ],
      true,
    );
    expect(unusable.status).toBe('no-usable');
    if (unusable.status !== 'no-usable') return;
    expect(unusable.excluded).toBe(2);
    // The blank cell is counted and lists nothing; only the phrase is a string.
    expect(unusable.unrecognised).toEqual(['premium forever']);
    expect(unusable.unrecognisedMore).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 05-18, UAT G-05-3: the real export's column semantics
  // -------------------------------------------------------------------------

  it('buckets a real-shaped premium file by CURR_PREMIUM, not by CREATED', () => {
    // D-19 as amended. The seven-row set is parsed with the PRODUCTION parser,
    // so the rows the builder sees are the rows a real import would hand it:
    // `CURR_PREMIUM` carries the grant datetime and `CREATED`/`UPDATED` carry
    // one shared bulk-migration stamp. The answer is the hand-derived key, and
    // the independent oracle — which picks the column with its own date reader —
    // has to agree with it field for field.
    const rows = premiumRealShapeRows();
    const expected = fixtures.PREMIUM_REAL_SHAPE_EXPECTED;
    const recomputed = oracle.oraclePremium(rows);
    const view = finance.buildPremium(rows, true);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    expect(view.grants).toBe(expected.grants);
    expect(view.excluded).toBe(expected.excluded);
    expect(view.totalSeconds).toBe(expected.totalSeconds);
    expect(view.totalSeconds / 86_400).toBe(expected.totalDays);
    expect(view.firstMonth).toBe(expected.firstMonth);
    expect(view.lastMonth).toBe(expected.lastMonth);
    expect(view.lastMonth - view.firstMonth + 1).toBe(expected.axisMonths.length);
    expect(view.months.map(monthOfView)).toEqual(expected.months.map(monthOfExpected));
    expect([...view.unrecognised].sort()).toEqual([...expected.unrecognised].sort());
    expect(view.unrecognisedMore).toBe(0);

    expect(view.grants).toBe(recomputed.grants);
    expect(view.excluded).toBe(recomputed.excluded);
    expect(view.totalSeconds).toBe(recomputed.totalSeconds);
    expect(view.months.map(monthOfView)).toEqual(recomputed.months.map(monthOfOracle));
    expect([...view.unrecognised].sort()).toEqual([...recomputed.unrecognised].sort());
  });

  it('never draws the bulk-migration month, in either fixture', () => {
    // The whole failure in one assertion: dating a real-shaped file by `CREATED`
    // puts every grant into the stamp's month, 24,197, and the chart becomes a
    // single meaningless bar. Both fixtures are checked, because the eighteen
    // were reshaped too and a reshape that kept the old behaviour would be just
    // as wrong as a builder that never changed.
    for (const rows of [premiumHandRows(), premiumRealShapeRows()]) {
      const view = finance.buildPremium(rows, true);

      expect(view.status).toBe('ready');
      if (view.status !== 'ready') return;
      expect(view.months.map((month) => month.month)).not.toContain(24_197);
      expect(view.firstMonth).not.toBe(24_197);
      expect(view.lastMonth).not.toBe(24_197);
    }
  });

  it('still gives the reshaped eighteen-row hand fixture its original answer', () => {
    // The reshape MOVED each date one column left rather than changing it, so
    // the 05-01 key is untouched: 11 grants, 7 excluded, 53 days, and the same
    // two listed strings. If this number moved, the fixture stop being a proof
    // that the fix preserved everything it was already right about.
    const view = finance.buildPremium(premiumHandRows(), true);
    const expected = fixtures.PREMIUM_HAND_EXPECTED;

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.grants).toBe(expected.grants);
    expect(view.excluded).toBe(expected.excluded);
    expect(view.totalSeconds).toBe(expected.totalSeconds);
    expect(view.months.map(monthOfView)).toEqual(expected.months.map(monthOfExpected));
    expect([...view.unrecognised].sort()).toEqual([...expected.unrecognised].sort());
  });

  it('decides the date column once per file, and never guesses at an unreadable cell', () => {
    // (a) No CURR_PREMIUM column at all: the header simply has none, so the
    // file is dated by CREATED — the behaviour before the UAT finding.
    const withoutColumn = finance.buildPremium(
      [
        { PREMIUM: '1 day', CREATED: '2019-05-02 12:00:00', UPDATED: '2019-05-02 12:00:00' },
        { PREMIUM: '1 day', CREATED: '2019-06-02 12:00:00', UPDATED: '2019-06-02 12:00:00' },
      ],
      true,
    );
    expect(withoutColumn.status).toBe('ready');
    if (withoutColumn.status !== 'ready') return;
    expect(withoutColumn.months.map((month) => month.month)).toEqual([24_232, 24_233]);

    // (b) The column exists but NO cell in it reads as a date, so the whole
    // file falls back to CREATED rather than dropping every row.
    const unreadableThroughout: FinanceRow = {
      PREMIUM: '1 day',
      CURR_PREMIUM: 'not a timestamp',
      CREATED: '2019-05-02 12:00:00',
      UPDATED: fixtures.PREMIUM_BULK_STAMP,
    };
    const allUnreadable = finance.buildPremium(
      [unreadableThroughout, { ...unreadableThroughout, CREATED: '2019-06-02 12:00:00' }],
      true,
    );
    expect(allUnreadable.status).toBe('ready');
    if (allUnreadable.status !== 'ready') return;
    expect(allUnreadable.months.map((month) => month.month)).toEqual([24_232, 24_233]);
    expect(allUnreadable.grants).toBe(2);
    expect(allUnreadable.excluded).toBe(0);

    // (c) The file IS dated by CURR_PREMIUM, and one row's cell cannot be read.
    // A per-row fallback would bucket that row on its perfectly valid bulk
    // CREATED and quietly invent a grant month; instead it is excluded, counted,
    // lists nothing, and the bulk stamp's month stays off the axis (D-20).
    const mixed = finance.buildPremium(
      [
        premiumRowIn('1 day', '2019-05-02 12:00:00'),
        {
          PREMIUM: '5 days',
          CURR_PREMIUM: 'not a timestamp',
          CREATED: '2019-08-02 12:00:00',
          UPDATED: fixtures.PREMIUM_BULK_STAMP,
        },
      ],
      true,
    );
    expect(mixed.status).toBe('ready');
    if (mixed.status !== 'ready') return;
    expect(mixed.grants).toBe(1);
    expect(mixed.excluded).toBe(1);
    // Its premium text is fine — the DATE is what failed — so it is not listed.
    expect(mixed.unrecognised).toEqual([]);
    expect(mixed.months.map((month) => month.month)).toEqual([24_232]);
  });
});

describe('05-04 exact decimals and the virtual-currency flow builder', () => {
  it('reproduces the hand-derived currency answer and agrees with the oracle', () => {
    const rows = currencyHandRows();
    const expected = fixtures.CURRENCY_HAND_EXPECTED;
    const recomputed = oracle.oracleCurrency(rows);
    const view = finance.buildCurrency(rows, true);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    expect(view.excluded).toBe(expected.excluded);
    // 119 usable operations is the sum of the six groups' operation counts, and
    // is what the block caption's "{n} operations" is measured against.
    const usable =
      view.charts.reduce((sum, entry) => sum + entry.ops, 0) +
      view.others.reduce((sum, entry) => sum + entry.ops, 0);
    expect(usable).toBe(expected.usable);

    // Two charts, biggest first: credits at 60 operations then gold at 52.
    expect(view.charts.map((entry) => chartGroup(entry))).toEqual(expected.charted);
    // Four others, and the two one-operation codes tie on count, so a BLANK
    // code sorts last while `__proto__` keeps its plain code-unit place.
    expect(view.others.map((entry) => chartGroup(entry))).toEqual(expected.others);

    // The whole usable and excluded count, recomputed independently.
    expect(recomputed.usable).toBe(expected.usable);
    expect(recomputed.excluded).toBe(expected.excluded);
    expect(view.charts.map((entry) => chartGroup(entry))).toEqual(recomputed.charted);
    expect(view.others.map((entry) => chartGroup(entry))).toEqual(recomputed.others);

    // The per-month sums add back to the headline exactly, in the exact scale:
    // a chart whose bars do not sum to its own caption is a chart that lies.
    for (const entry of view.charts) {
      const inSum = entry.months.reduce((sum, month) => sum + BigInt(month.inUnits), 0n);
      const outSum = entry.months.reduce((sum, month) => sum + BigInt(month.outUnits), 0n);
      expect(inSum).toBe(BigInt(entry.inUnits));
      expect(outSum).toBe(BigInt(entry.outUnits));
      // Sparse and ascending, so a chart can walk it and fill its own gaps.
      const months = entry.months.map((month) => month.month);
      expect([...months].sort((a, b) => a - b)).toEqual(months);
      expect(months.every((month) => month >= entry.firstMonth && month <= entry.lastMonth)).toBe(
        true,
      );
    }

    // The one non-integer amount in the whole file, read exactly — inside a
    // total that also carries the income of 500, because an income is money
    // counted up (D-18).
    expect(view.others.find((entry) => entry.code === 'UAH')?.inUnits).toBe(units(512_500));
  });

  it('totals an income-only currency as its deposits instead of reporting zero', () => {
    // The shape of a real export's stray `UAH`: five `income` rows and nothing
    // else. Read end to end — the production parser, then the builder — and
    // checked against the independent oracle and the hand key together, so a
    // builder that leaves an income out of both sums cannot pass this by
    // agreeing with an answer key that agrees with it (D-18, UAT G-05-4).
    const rows = rowsFrom(fixtures.CURRENCY_INCOME_ONLY_CSV, 'Virtual_Currencies_Operations.csv');
    const expected = fixtures.CURRENCY_INCOME_ONLY_EXPECTED;
    const view = finance.buildCurrency(rows, true);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.excluded).toBe(expected.excluded);
    // Five usable operations, which is far below the charting threshold, so the
    // currency is one Other-currencies line and not a chart.
    expect(view.charts).toHaveLength(0);
    expect(view.others).toHaveLength(1);
    const uah = view.others[0]!;
    expect(uah.code).toBe('UAH');
    expect(uah.ops).toBe(5);
    expect(uah.inUnits).toBe(units(600_000));
    expect(uah.outUnits).toBe('0');
    // The drawn axis is FIRST-to-LAST, so a month with no operations is a gap
    // in a four-month axis rather than a shorter one.
    expect(uah.firstMonth).toBe(24_228);
    expect(uah.lastMonth).toBe(24_231);

    const recomputed = oracle.oracleCurrency(rows);
    expect(recomputed).toEqual(expected);
    expect(view.others.map((entry) => chartGroup(entry))).toEqual(recomputed.others);
  });

  it('reads a currency code exactly as written, with no case folding', () => {
    expect(finance.currencyCodeOf('ru.wot.credits')).toBe('ru.wot.credits');
    expect(finance.currencyCodeOf('  ru.wot.credits  ')).toBe('ru.wot.credits');
    // A blank code is the null group, not a group named by an empty string.
    expect(finance.currencyCodeOf('')).toBeNull();
    expect(finance.currencyCodeOf('   ')).toBeNull();
    expect(finance.currencyCodeOf(undefined)).toBeNull();
    // Codes are opaque identifiers: `USD` and `usd` are two groups, and a code
    // of `__proto__` is a group like any other.
    expect(finance.currencyCodeOf('usd')).toBe('usd');
    expect(finance.currencyCodeOf('__proto__')).toBe('__proto__');
    // Clamped at the store cap, because a title is a label and not a payload.
    expect(finance.currencyCodeOf('x'.repeat(5_000))).toHaveLength(200);
  });

  it('excludes a row dated outside the plausible-date window without dropping the file', () => {
    const rows = rowsFrom(
      fixtures.generateCurrencyOpsCsv(fixtures.CURRENCY_STRAY_YEAR_SPEC),
      'Virtual_Currencies_Operations.csv',
    );
    const recomputed = oracle.oracleCurrency(rows);
    const view = finance.buildCurrency(rows, true);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    // Twenty rows, four of them dated 9999 or 1969. The excluded total is
    // therefore exactly four, which is the assertion that proves a stray year
    // is a dropped ROW and not a dropped FILE.
    expect(view.excluded).toBe(4);
    expect(recomputed.excluded).toBe(4);
    // Sixteen ordinary rows survive, and the file as a whole is still a file:
    // the sixteen land on the OTHER list because twenty rows over one code is
    // not fifty operations, and a dropped file would report zero of both.
    const usable =
      view.charts.reduce((sum, entry) => sum + entry.ops, 0) +
      view.others.reduce((sum, entry) => sum + entry.ops, 0);
    expect(usable).toBe(16);
  });

  it('draws a twenty-year history past the twelve-year scale threshold', () => {
    const rows = rowsFrom(
      fixtures.generateCurrencyOpsCsv(fixtures.CURRENCY_20Y_SPEC),
      'Virtual_Currencies_Operations.csv',
    );
    const recomputed = oracle.oracleCurrency(rows);
    const view = finance.buildCurrency(rows, true);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    // One code in the file, so one chart, and the round-robin month assignment
    // guarantees every month of 2001..2020 is covered: a chart longer than the
    // 144-month scale threshold has to be buildable before it is drawable.
    expect(view.charts).toHaveLength(1);
    expect(view.charts[0]!.months.length).toBeGreaterThanOrEqual(240);
    expect(view.charts.map((entry) => chartGroup(entry))).toEqual(recomputed.charted);
  });

  it('charts at most eight currencies and lists every code it did not chart', () => {
    // Ten currencies, each with 60 usable operations: every one clears the
    // 50-operation threshold, so the CAP is what decides, and the two that do
    // not fit are the two lowest in code order. A cap that hid a currency
    // instead of listing it would lose code D-16 says must never be lost.
    const rows: FinanceRow[] = [];
    const codes = ['c09', 'c08', 'c07', 'c06', 'c05', 'c04', 'c03', 'c02', 'c01', 'c00'];
    codes.forEach((code, index) => {
      for (let op = 0; op < 60; op++) {
        rows.push(currencyRow(code, 'deposit', '10', 24_000 + ((op + index) % 12)));
      }
    });
    const view = finance.buildCurrency(rows, true);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.charts).toHaveLength(8);
    // All eight tie on 60 operations, so plain code-unit order decides.
    expect(view.charts.map((entry) => entry.code)).toEqual([
      'c00',
      'c01',
      'c02',
      'c03',
      'c04',
      'c05',
      'c06',
      'c07',
    ]);
    expect(view.others.map((entry) => entry.code)).toEqual(['c08', 'c09']);
    for (const entry of view.others) {
      expect(entry.ops).toBe(60);
      expect(entry.inUnits).toBe(units(600_000));
      expect(entry.outUnits).toBe('0');
    }
  });

  it('excludes a currency below the threshold and orders ties by code with a blank last', () => {
    const rows: FinanceRow[] = [
      ...Array.from({ length: 49 }, () => currencyRow('ru.wot.credits', 'deposit', '10', 24_200)),
      // Four one-operation codes, so every ordering rule at once: 49 is one
      // short of the threshold; `B` and `a` tie and break on code units with
      // the UPPER-CASE code first; a blank code ties with them and goes last.
      currencyRow('a', 'deposit', '1', 24_200),
      currencyRow('B', 'deposit', '1', 24_200),
      currencyRow('', 'deposit', '1', 24_200),
      currencyRow('Z', 'deposit', '1', 24_200),
    ];
    const view = finance.buildCurrency(rows, true);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.charts).toHaveLength(0);
    // Credits lead on 49 operations; the four one-operation codes tie, and
    // 'B' < 'Z' < 'a' in code units because code units are not case-folded and
    // the order must not depend on a locale. The blank code ties with them and
    // goes last.
    expect(view.others.map((entry) => entry.code)).toEqual(['ru.wot.credits', 'B', 'Z', 'a', null]);
  });

  it('groups by a code of __proto__ without touching Object.prototype', () => {
    const rows = [
      currencyRow('__proto__', 'deposit', '7', 24_200, 'Sneaky'),
      currencyRow('__proto__', 'withdrawal', '2', 24_200),
      currencyRow('constructor', 'deposit', '3', 24_200),
    ];
    const view = finance.buildCurrency(rows, true);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    // Every code is a group, and neither of those two names reaches a prototype.
    expect(view.others.map((entry) => entry.code)).toEqual(['__proto__', 'constructor']);
    expect(view.others[0]!.inUnits).toBe(units(7_000));
    expect(view.others[0]!.outUnits).toBe(units(2_000));
    expect(view.others[0]!.ops).toBe(2);
    expect(({} as Record<string, unknown>)['ops']).toBeUndefined();
    expect(({} as Record<string, unknown>)['inUnits']).toBeUndefined();
  });

  it('excludes an unusable amount, a negative amount and an unknown TYPE', () => {
    const rows = [
      currencyRow('ru.wot.credits', 'deposit', '10', 24_200),
      // An amount the file does not contain as a number: counted, never
      // estimated (D-03).
      currencyRow('ru.wot.credits', 'deposit', 'abc', 24_200),
      currencyRow('ru.wot.credits', 'deposit', '', 24_200),
      currencyRow('ru.wot.credits', 'deposit', '1.2345678', 24_200),
      // A NEGATIVE amount is an export integrity problem, not money flowing the
      // other way: direction comes from TYPE, and a chart that drew a negative
      // deposit downwards would be worse than a counted exclusion.
      currencyRow('ru.wot.credits', 'deposit', '-5', 24_200),
      // A TYPE the export does not write.
      currencyRow('ru.wot.credits', 'refund', '100', 24_200),
      // `income` is a USABLE operation and money counted UP, so it adds to the
      // deposited total exactly as a deposit does (D-18).
      currencyRow('ru.wot.credits', 'income', '100', 24_200),
      // A row whose date cannot be bucketed: 31 April is not a day.
      {
        ...currencyRow('ru.wot.credits', 'deposit', '100', 24_200),
        CREATED: '2019-04-31 10:00:00',
      },
    ];
    const view = finance.buildCurrency(rows, true);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    // `abc`, a blank, seven fraction digits, a negative, an unknown TYPE and an
    // impossible date: six rows, all counted, none in a total.
    expect(view.excluded).toBe(6);
    expect(view.charts).toHaveLength(0);
    // No chart, so the totals are read off the other-currency line: the deposit
    // of 10 plus the income of 100 is 110 in, 0 out, across two operations.
    expect(view.others).toHaveLength(1);
    expect(view.others[0]!.ops).toBe(2);
    expect(view.others[0]!.inUnits).toBe(units(110_000));
    expect(view.others[0]!.outUnits).toBe('0');
  });

  it('counts an income as an operation and as money up (D-18)', () => {
    // `deposit` and `income` are both UP and `withdrawal` is DOWN, so this
    // currency holds 150 deposited and 30 withdrawn over three operations. An
    // income that were left out of both sums would report 100 in — and an
    // income-only currency would report "Deposited 0" over N operations, which
    // is exactly what UAT G-05-4 found in the real export.
    const view = finance.buildCurrency(
      [
        currencyRow('ru.wot.crystal', 'deposit', '100', 24_200),
        currencyRow('ru.wot.crystal', 'income', '50', 24_210),
        currencyRow('ru.wot.crystal', 'withdrawal', '30', 24_220),
      ],
      true,
    );
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.others[0]!.ops).toBe(3);
    expect(view.others[0]!.inUnits).toBe(units(150_000));
    expect(view.others[0]!.outUnits).toBe(units(30_000));
  });

  it('gives an income-only month its deposit-side operations and sum', () => {
    // The per-MONTH view of the same rule. A month whose only operations are
    // incomes is a month with operations: its bars, its `inOps` and its axis
    // all have to say so, or a reader sees an empty cell for a month the export
    // actually reported activity in.
    const view = finance.buildCurrency(
      Array.from({ length: 50 }, () => currencyRow('inc.only', 'income', '10', 24_230)),
      true,
    );
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.charts).toHaveLength(1);
    const entry = view.charts[0]!;
    expect(entry.ops).toBe(50);
    expect(entry.inUnits).toBe(units(500_000));
    expect(entry.outUnits).toBe('0');
    expect(entry.months).toHaveLength(1);
    expect(entry.months[0]!.inOps).toBe(50);
    expect(entry.months[0]!.outOps).toBe(0);
    expect(entry.months[0]!.inUnits).toBe(units(500_000));
  });

  it('gives every usable operation exactly one direction, in every month', () => {
    // The invariant D-18 makes true: because an income is up, the two
    // per-month operation counts add back to the currency's own operation
    // count. It is the one assertion a reader's own arithmetic rests on — a
    // month that silently swallows an operation would make "over N operations"
    // disagree with the bars beside it. Only CHARTED entries carry months; an
    // Other-currencies line has no per-month figures to check, and the 10k
    // generated spec supplies five charted ones.
    const hand = finance.buildCurrency(currencyHandRows(), true);
    const generated = rowsFrom(
      fixtures.generateCurrencyOpsCsv(fixtures.CURRENCY_10K_SPEC),
      'Virtual_Currencies_Operations.csv',
    );
    const big = finance.buildCurrency(generated, true);

    let charted = 0;
    for (const view of [hand, big]) {
      expect(view.status).toBe('ready');
      if (view.status !== 'ready') return;
      charted += view.charts.length;
      for (const entry of view.charts) {
        const counted = entry.months.reduce((sum, month) => sum + month.inOps + month.outOps, 0);
        expect(counted).toBe(entry.ops);
      }
    }
    // The generated spec is what makes this more than the two hand charts.
    expect(charted).toBeGreaterThanOrEqual(7);
  });

  it('separates a missing file, an empty file and nothing usable', () => {
    expect(finance.buildCurrency([], false).status).toBe('not-in-export');
    expect(finance.buildCurrency([], true).status).toBe('no-rows');
    const unusable = finance.buildCurrency(
      [currencyRow('ru.wot.credits', 'refund', '1', 24_200)],
      true,
    );
    expect(unusable.status).toBe('no-usable');
    if (unusable.status !== 'no-usable') return;
    expect(unusable.excluded).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The spend builder, the privacy canary and the scale ceiling.
// ---------------------------------------------------------------------------

/** The hand fixture's sixteen order rows, parsed. */
function ordersHandRows(): readonly FinanceRow[] {
  return rowsFrom(fixtures.ORDERS_HAND_CSV, 'Orders.csv');
}

/** Strip a locale's grouping separators, so an ungrouped literal can be compared. */
function ungroup(text: string): string {
  return text.replaceAll(',', '');
}

/** A spend card in the fixture's field names and the fixture's scale. */
function cardOf(card: SpendCard): unknown {
  return {
    code: card.code ?? '',
    unknownCurrency: card.code === null,
    paid: card.paid,
    totalThousandths: Number(BigInt(card.units) / 1000n),
    // The two strings the card DRAWS, produced by the one half-away rounding,
    // so the hand fixture's display expectations are checked here rather than
    // only written in a comment (D-24, D-25). The fixture writes its display
    // strings ungrouped and the card groups them (UI-SPEC section 9: money is
    // `Intl.NumberFormat` grouping with exactly two decimals), so the grouping
    // separators are stripped from the fixture side before the comparison.
    displayTotal: ungroup(formatMoneyAmount(BigInt(card.units), 'en-US')),
    failed: card.failed,
    newOrders: card.new,
    other: card.other,
    gifts: card.gifts,
    giftThousandths: Number(BigInt(card.giftUnits) / 1000n),
    displayGifts: ungroup(formatMoneyAmount(BigInt(card.giftUnits), 'en-US')),
    excluded: card.excluded,
    byYear: card.byYear.map((year) => ({
      year: year.year,
      paid: year.paid,
      totalThousandths: Number(BigInt(year.units) / 1000n),
    })),
    byGame: card.byGame.map((game) => ({
      game: game.code === null ? '(not recorded)' : game.code,
      paid: game.paid,
      totalThousandths: Number(BigInt(game.units) / 1000n),
    })),
  };
}

/**
 * The two-decimal string for a whole-UNIT amount, derived here with integer
 * arithmetic from the oracle's thousandths.
 *
 * The oracle deliberately formats NOTHING, so the rounding rule cannot be
 * satisfied by the same code that reads the money. Deriving it here, in the
 * test, from the oracle's own integer total is what makes the two display
 * expectations in the answer key an independent check of the app's rounding
 * rather than a restatement of it.
 */
function halfAwayFromThousandths(thousandths: number): string {
  const negative = thousandths < 0;
  const cents = Math.floor((Math.abs(thousandths) + 5) / 10);
  const sign = negative && cents > 0 ? '-' : '';
  return `${sign}${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** The oracle's spend card in its own field names, for the second answer key. */
function cardOfOracle(card: oracle.OracleSpendCard): unknown {
  return {
    code: card.code,
    unknownCurrency: card.unknownCurrency,
    paid: card.paid,
    totalThousandths: card.totalThousandths,
    displayTotal: halfAwayFromThousandths(card.totalThousandths),
    failed: card.failed,
    newOrders: card.newOrders,
    other: card.other,
    gifts: card.gifts,
    giftThousandths: card.giftThousandths,
    displayGifts: halfAwayFromThousandths(card.giftThousandths),
    excluded: card.excluded,
    byYear: card.byYear,
    byGame: card.byGame.map((game) => ({
      game: game.game,
      paid: game.paid,
      totalThousandths: game.totalThousandths,
    })),
  };
}

/**
 * One order row in the export's own twelve-column order, with every column that
 * is not under test carrying the fixture's canary value — so the privacy canary
 * has an identifying column to catch if a builder ever reaches for one.
 */
function orderRow(
  actionDt: string,
  gameCode: string,
  currency: string,
  amount: string,
  isGift: string,
  status: string,
): FinanceRow {
  return {
    ACTION_DT: actionDt,
    GAME_CODE: gameCode,
    ITEM_CNT: '1',
    PAYMENT_CURRENCY: currency,
    PAYED_IN_CURR_AMT: amount,
    IS_GIFT: isGift,
    ORDER_UUID: fixtures.FINANCE_CANARIES.orderId,
    PAY_COUPON_NAME: fixtures.FINANCE_CANARIES.coupon,
    PAY_ORDER_STATUS_CODE: status,
    PAY_AGGREGATOR_DESC: fixtures.FINANCE_CANARIES.aggregator,
    PAY_ITEM_TYPE_NAME: 'premium',
    AA_PACKAGE_LIST: fixtures.FINANCE_CANARIES.package,
  };
}

/**
 * Every column name a builder must NEVER read, for any of the three files.
 *
 * `CURR_PREMIUM` is deliberately NOT on this list as of plan 05-18: the real
 * export writes the premium operation's datetime there, and the month bucket
 * cannot be derived without reading it (UAT G-05-3). It is a TIMESTAMP, not an
 * identifier, and it is read only through `monthOfTimestamp`, so only the month
 * integer is kept — which is what the test below asserts, against the serialised
 * view itself rather than against a list of names. T-05-11 as amended, with
 * T-05-54 raised in its place.
 */
const IDENTIFYING_COLUMNS = [
  'ORDER_UUID',
  'PAY_COUPON_NAME',
  'PAY_AGGREGATOR_DESC',
  'AA_PACKAGE_LIST',
  'PAY_ITEM_TYPE_NAME',
  'ORDER',
  'UPDATED',
  'NAME',
  'IP',
] as const;

/** Rows wrapped so every value read, and every key listing, is recorded. */
function watchRows(rows: readonly FinanceRow[]): {
  rows: readonly FinanceRow[];
  reads: Set<string>;
  keyListings: () => number;
} {
  const reads = new Set<string>();
  let keyListings = 0;
  const wrapped = rows.map(
    (row) =>
      new Proxy(row, {
        get(target, property, receiver) {
          if (typeof property === 'string') reads.add(property);
          return Reflect.get(target, property, receiver);
        },
        ownKeys(target) {
          keyListings += 1;
          return Reflect.ownKeys(target);
        },
      }),
  );
  return { rows: wrapped, reads, keyListings: () => keyListings };
}

describe('05-04 the real-money spend builder', () => {
  it('reads a currency code only when it is exactly three letters', () => {
    // The twelve-column header has no other currency column, so `US` and a
    // blank both land on the unit-less group — and the unit-less group is not a
    // currency, so its amount has no unit (D-21).
    expect(finance.spendCurrencyOf('USD')).toBe('USD');
    expect(finance.spendCurrencyOf(' usd ')).toBe('usd');
    expect(finance.spendCurrencyOf('US')).toBeNull();
    expect(finance.spendCurrencyOf('')).toBeNull();
    expect(finance.spendCurrencyOf('   ')).toBeNull();
    expect(finance.spendCurrencyOf('U5D')).toBeNull();
    expect(finance.spendCurrencyOf('EURO')).toBeNull();
    expect(finance.spendCurrencyOf(undefined)).toBeNull();
    // Case is never folded: `usd` and `USD` are two cards, each shown as
    // written, because the export never claimed they are one currency.
    expect(finance.spendCurrencyOf('usd')).not.toBe(finance.spendCurrencyOf('USD'));
  });

  it('reads a gift flag in every spelling the export and its readme disagree on', () => {
    // The readme says T/F, the real sample writes 1/0, and a drifted export
    // could write either or the word (D-22).
    for (const gift of ['1', 't', 'T', 'true', 'TRUE', 'True', ' true ']) {
      expect(finance.parseGiftFlag(gift)).toBe(true);
    }
    for (const notGift of ['0', 'f', 'F', 'false', 'FALSE', '', '  ', 'yes', '2', undefined]) {
      expect(finance.parseGiftFlag(notGift)).toBe(false);
    }
  });

  it('reproduces the hand-derived spend answer and agrees with the oracle', () => {
    const rows = ordersHandRows();
    const expected = fixtures.ORDERS_HAND_EXPECTED;
    const recomputed = oracle.oracleSpend(rows);
    const view = finance.buildSpend(rows);

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.cards.map(cardOf)).toEqual(expected.cards);

    // The same answer, recomputed with no import from `src/` at all. The
    // oracle's card carries `newOrders` and a `game` LABEL where the view
    // carries `new` and a nullable code, so the two are normalised separately
    // rather than pretending one module defined the other's shape.
    expect(view.cards.map(cardOf)).toEqual(recomputed.cards.map(cardOfOracle));
    // One PAID order across the whole export had an amount that is not a number,
    // and it is counted rather than guessed at (D-24).
    expect(view.cards.reduce((sum, card) => sum + card.excluded, 0)).toBe(expected.excluded);
  });

  it('orders the cards by paid orders, then by code, with the unit-less card last', () => {
    const view = finance.buildSpend(ordersHandRows());
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    // USD has four paid orders, UAH and the unit-less group two each, RUB and
    // `usd` one each. The unit-less card is last UNCONDITIONALLY, even though it
    // ties on count with UAH and outranks RUB and `usd` on count alone: a group
    // that is not a currency must never sit among the currency cards.
    expect(view.cards.map((card) => card.code)).toEqual(['USD', 'UAH', 'RUB', 'usd', null]);
    // And the USD card draws 15.50 from 15.495 units, where a float draws 15.49.
    const usd = view.cards[0]!;
    expect(usd.units).toBe(units(15_495));
    expect(usd.gifts).toBe(2);
    expect(usd.giftUnits).toBe(units(5_005));
    expect(formatMoneyAmount(BigInt(usd.units), 'en-US')).toBe('15.50');
    expect((15.495).toFixed(2)).toBe('15.49');
  });

  it('makes every breakdown a view of the same included paid rows', () => {
    const view = finance.buildSpend(ordersHandRows());
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    for (const card of view.cards) {
      const sum = (rows: readonly { units: string }[]): bigint =>
        rows.reduce((total, row) => total + BigInt(row.units), 0n);
      // The exact micro-unit sums add up. A breakdown that did not sum to its
      // own headline would be a table of numbers that do not describe the card.
      expect(sum(card.byYear)).toBe(BigInt(card.units));
      expect(sum(card.byGame)).toBe(BigInt(card.units));
      // And so do the counts, so a row can be in a year but not in a game.
      expect(card.byYear.reduce((total, year) => total + year.paid, 0)).toBe(card.paid);
      expect(card.byGame.reduce((total, game) => total + game.paid, 0)).toBe(card.paid);
      // The gift line is a SUBSET of the headline by construction, so a card
      // can never claim it gave away more than it took in.
      expect(BigInt(card.giftUnits)).toBeLessThanOrEqual(BigInt(card.units));
      expect(card.gifts).toBeLessThanOrEqual(card.paid);
    }
  });

  it('orders a breakdown by year descending and by game by paid orders', () => {
    const view = finance.buildSpend(ordersHandRows());
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    const usd = view.cards[0]!;
    // By year, newest first, four digits as written.
    expect(usd.byYear.map((year) => year.year)).toEqual(['2021', '2020']);
    expect(usd.byYear.map((year) => year.paid)).toEqual([2, 2]);
    // By game, most orders first.
    expect(usd.byGame.map((game) => game.code)).toEqual(['WOT', 'COMMON']);
    expect(usd.byGame.map((game) => game.paid)).toEqual([3, 1]);
    // A blank GAME_CODE is its own group and reads as `null`; a unit-less card
    // whose two games tie breaks on plain code units, and null goes last, so
    // `(not recorded)` leads here.
    const unitless = view.cards[view.cards.length - 1]!;
    expect(unitless.byGame.map((game) => game.code)).toEqual([null, 'WOT']);
  });

  it('never lets a non-paid row move a units figure', () => {
    const base = [
      orderRow('2021-01-05 10:00:00', 'WOT', 'USD', '10.00', '0', 'PAID'),
      orderRow('2021-02-05 10:00:00', 'WOT', 'USD', '5.00', '0', 'PAID'),
    ];
    const withNoise = [
      ...base,
      // One of each status that is not PAID. None of them may reach a total,
      // and none of them may make the card's breakdowns disagree with it.
      orderRow('2021-03-05 10:00:00', 'WOT', 'USD', '999.99', '0', 'FAILED'),
      orderRow('2021-04-05 10:00:00', 'WOT', 'USD', '888.88', '0', 'NEW'),
      orderRow('2021-05-05 10:00:00', 'WOT', 'USD', '777.77', '0', 'REFUNDED'),
      // A PAID order whose amount is not a number: excluded and counted,
      // never estimated (D-24).
      orderRow('2021-06-05 10:00:00', 'WOT', 'USD', 'not a number', '0', 'PAID'),
    ];
    const before = finance.buildSpend(base);
    const after = finance.buildSpend(withNoise);
    expect(before.status).toBe('ready');
    expect(after.status).toBe('ready');
    if (before.status !== 'ready' || after.status !== 'ready') return;

    const moneyOf = (card: SpendCard): unknown => ({
      units: card.units,
      giftUnits: card.giftUnits,
      byYear: card.byYear.map((year) => year.units),
      byGame: card.byGame.map((game) => game.units),
    });
    expect(moneyOf(after.cards[0]!)).toEqual(moneyOf(before.cards[0]!));
    // Their COUNTS differ, because they are facts, and the fourth row was
    // excluded rather than added in.
    expect(after.cards[0]!.units).toBe(units(15_000));
    expect(after.cards[0]!.paid).toBe(2);
    expect(after.cards[0]!.failed).toBe(1);
    expect(after.cards[0]!.new).toBe(1);
    expect(after.cards[0]!.other).toBe(1);
    expect(after.cards[0]!.excluded).toBe(1);
  });

  it('never blends two currencies into one figure', () => {
    // The whole of FINANCE-03 in one assertion: two currencies, two cards, and
    // no figure anywhere that is their sum. A blended total would be a number
    // that means nothing, and it is the one thing the spend block must never
    // draw.
    const view = finance.buildSpend([
      orderRow('2021-01-05 10:00:00', 'WOT', 'USD', '10.00', '0', 'PAID'),
      orderRow('2021-01-06 10:00:00', 'WOT', 'RUB', '20.00', '0', 'PAID'),
    ]);
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.cards).toHaveLength(2);
    // Looked up by code rather than by position: the two tie on paid orders, so
    // the order is RUB then USD by code units, which is a detail this test is
    // not about.
    const usd = view.cards.find((card) => card.code === 'USD')!;
    const rub = view.cards.find((card) => card.code === 'RUB')!;
    expect(usd.units).toBe(units(10_000));
    expect(rub.units).toBe(units(20_000));
    // 30.00 units is the sum of the two cards, and it must appear in no field
    // of either one.
    expect(JSON.stringify(view.cards)).not.toContain('30000000');
  });

  it('reports no usable spend when no row has a status it recognises', () => {
    // An absent Orders file and a file of nothing but unrecognised statuses are
    // the same answer: there is no spend to show. UI-SPEC section 2 has no
    // `not-in-export` state for this block, so `no-usable` IS the empty case.
    expect(finance.buildSpend([]).status).toBe('no-usable');
    expect(
      finance.buildSpend([orderRow('2021-01-05 10:00:00', 'WOT', 'USD', '1', '0', 'REFUNDED')])
        .status,
    ).toBe('no-usable');
    // A group whose rows are ALL an unrecognised status is still listed, because
    // its other count is a fact the reader is owed.
    const onlyOther = finance.buildSpend([
      orderRow('2021-01-05 10:00:00', 'WOT', 'USD', '1', '0', 'REFUNDED'),
      orderRow('2021-01-06 10:00:00', 'WOT', 'USD', '9', '0', 'PAID'),
    ]);
    expect(onlyOther.status).toBe('ready');
    if (onlyOther.status !== 'ready') return;
    expect(onlyOther.cards[0]!.other).toBe(1);
    expect(onlyOther.cards[0]!.paid).toBe(1);
  });
});

describe('05-04 the privacy canary: a builder reads the columns it names and no others', () => {
  it('proves the instrument is live by reading an identifying column on purpose', () => {
    // Without this control, "no forbidden column was read" would be a test that
    // passes because the rows were empty. A deliberate read of the coupon column
    // has to turn the canary red, or every assertion below is vacuous.
    const watched = watchRows([orderRow('2021-01-05 10:00:00', 'WOT', 'USD', '1', '0', 'PAID')]);
    const coupons = watched.rows.map((row) => row['PAY_COUPON_NAME']);
    expect(coupons).toEqual([fixtures.FINANCE_CANARIES.coupon]);
    expect(watched.reads.has('PAY_COUPON_NAME')).toBe(true);
  });

  it('sees no identifying column in the premium, currency or spend path', () => {
    const premium = watchRows(premiumHandRows());
    finance.buildPremium(premium.rows, true);
    const currency = watchRows(currencyHandRows());
    finance.buildCurrency(currency.rows, true);
    const spend = watchRows(ordersHandRows());
    finance.buildSpend(spend.rows);

    for (const [name, watched] of [
      ['premium', premium],
      ['currency', currency],
      ['spend', spend],
    ] as const) {
      for (const column of IDENTIFYING_COLUMNS) {
        expect(`${name}:${watched.reads.has(column)}`).toBe(`${name}:false`);
      }
    }
  });

  it('reads CURR_PREMIUM to derive a month and keeps its text out of the view', () => {
    // 05-18 / T-05-54. Reading CURR_PREMIUM is now REQUIRED and correct, so the
    // privacy rule changed shape: instead of "this column is never read", it is
    // "this column is read, and nothing of its text survives". The canary is the
    // serialised view itself, checked against every grant date the fixture wrote
    // — a stronger claim than a column-name list, because it holds whatever the
    // view's shape grows to be.
    const watched = watchRows(premiumRealShapeRows());
    const view = finance.buildPremium(watched.rows, true);

    // Positive control: the column really IS read, or the assertions below would
    // pass on an empty string.
    expect(watched.reads.has('CURR_PREMIUM')).toBe(true);
    // `UPDATED` stays on the forbidden list — it is the row's own timestamp and
    // nothing needs it, so it is still never opened.
    expect(watched.reads.has('UPDATED')).toBe(false);

    const serialised = JSON.stringify(view);
    for (const row of fixtures.PREMIUM_REAL_SHAPE_ROWS) {
      expect(serialised).not.toContain(row[1]!);
    }
    // The month INTEGERS do cross into the view — that is the whole point of the
    // read — while the timestamp text that produced them does not.
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(serialised).toContain('"month":24167');
  });

  it('reads the key list of the first row only, so a ragged row cannot remap a column', () => {
    const cases: {
      name: string;
      rows: readonly FinanceRow[];
      build: (rows: readonly FinanceRow[]) => void;
    }[] = [
      {
        name: 'premium',
        rows: premiumHandRows(),
        build: (rows) => {
          finance.buildPremium(rows, true);
        },
      },
      {
        name: 'currency',
        rows: currencyHandRows(),
        build: (rows) => {
          finance.buildCurrency(rows, true);
        },
      },
      { name: 'spend', rows: ordersHandRows(), build: (rows) => void finance.buildSpend(rows) },
    ];
    for (const testCase of cases) {
      const watched = watchRows(testCase.rows);
      testCase.build(watched.rows);
      // Column resolution happens once, against the FIRST row. A later row with
      // different keys cannot change which column is which, and enumerating
      // every row's keys is work a 50,000-row file should not do.
      expect(`${testCase.name}:${watched.keyListings()}`).toBe(`${testCase.name}:1`);
    }
  });
});

describe('05-04 the scale ceiling and the seeded random-order invariants', () => {
  it('aggregates fifty thousand operations inside a five-second ceiling', () => {
    // The file is parsed OUTSIDE the timed region: this is the aggregation's
    // cost, not PapaParse's. 50,000 rows is the case that makes an O(n) and an
    // O(n squared) aggregation distinguishable.
    const rows = rowsFrom(
      fixtures.generateCurrencyOpsCsv(fixtures.CURRENCY_50K_SPEC),
      'Virtual_Currencies_Operations.csv',
    );
    const recomputed = oracle.oracleCurrency(rows);
    const started = performance.now();
    const view = finance.buildCurrency(rows, true);
    const elapsed = performance.now() - started;

    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(elapsed).toBeLessThan(5_000);
    // 40 unknown-type rows plus 25 unparseable amounts, both drawn from the
    // spec rather than hard-coded, so a changed spec changes this number.
    expect(view.excluded).toBe(65);
    expect(view.charts.map(chartGroup)).toEqual(recomputed.charted);
    expect(view.others.map(chartGroup)).toEqual(recomputed.others);
  });

  it('keeps the spend sum invariants over ten thousand seeded random orders', () => {
    // A random draw has no closed form, so the invariants are the assertion:
    // every breakdown sums to its own headline, every card is one currency, and
    // the whole answer equals the independent oracle. Seeded, so a failure is
    // reproducible and the same bytes are checked every run.
    const rand = mulberry32(5_004);
    const codes = ['USD', 'EUR', 'RUB', 'BYN', 'UAH'];
    const statuses = ['PAID', 'PAID', 'PAID', 'FAILED', 'NEW', 'REFUNDED'];
    const rows: FinanceRow[] = [];
    for (let i = 0; i < 10_000; i++) {
      const code = codes[Math.floor(rand() * codes.length)]!;
      const status = statuses[Math.floor(rand() * statuses.length)]!;
      const whole = 1 + Math.floor(rand() * 5_000);
      const thousandths = Math.floor(rand() * 1_000);
      // A tenth of the rows carries a leading dot or three decimals, so the
      // parser's tolerance is exercised at scale rather than only in the hand
      // fixture.
      const amount =
        thousandths === 0
          ? String(whole)
          : rand() < 0.5
            ? `.${thousandths}`
            : `${whole}.${String(thousandths).padStart(3, '0')}`;
      rows.push(
        orderRow(
          `20${String(10 + Math.floor(rand() * 12)).padStart(2, '0')}-15 12:00:00`,
          rand() < 0.2 ? '' : 'WOT',
          rand() < 0.02 ? '' : code,
          amount,
          rand() < 0.25 ? 'T' : '0',
          status,
        ),
      );
    }

    const view = finance.buildSpend(rows);
    const recomputed = oracle.oracleSpend(rows);
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;

    for (const card of view.cards) {
      const total = card.byYear.reduce((sum, year) => sum + BigInt(year.units), 0n);
      const games = card.byGame.reduce((sum, game) => sum + BigInt(game.units), 0n);
      expect(total).toBe(BigInt(card.units));
      expect(games).toBe(BigInt(card.units));
      expect(card.byYear.reduce((sum, year) => sum + year.paid, 0)).toBe(card.paid);
      expect(card.byGame.reduce((sum, game) => sum + game.paid, 0)).toBe(card.paid);
      expect(BigInt(card.giftUnits)).toBeLessThanOrEqual(BigInt(card.units));
    }
    expect(view.cards.map(cardOf)).toEqual(recomputed.cards.map(cardOfOracle));
  });
});
