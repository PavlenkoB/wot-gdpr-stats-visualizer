// =============================================================================
// finance-state — the Financial sub-blocks' decisions (05-10)
// =============================================================================
//
// WHY THIS FILE EXISTS
// The three Financial sub-blocks each own their own state, and the three
// states a reader must never confuse are not visual differences:
//
//   - a block whose FILE IS ABSENT (`not-in-export`) versus one whose file is
//     present but held no rows (`no-rows`) is the presence-fact distinction
//     D-02 builds on, and it is decided by the worker, not by a component;
//   - a block showing an answer for a dataset that is no longer on screen is
//     not a block with stale numbers, it is a block with no answer at all
//     (D-28, T-05-30);
//   - a block whose query failed is a block with a message, and that message
//     is the fixed sentence — never the worker's `detail`, which can name a
//     file path (T-05-31).
//
// All three are ordinary functions over ordinary data, which is the only
// reason they can be tested at all: this repo's Vitest runs with no DOM.
//
// The premium figures are checked against `buildPremium` over the 05-01 HAND
// rows rather than against a hand-written view literal, so the numbers here
// are the ones a real import produces. The literals beside them are the
// fixture's own, derived by hand in `tests/fixtures/finance-fixtures.ts`.
//
// Decisions: D-01, D-02, D-19, D-20, D-28. Threats: T-05-29..T-05-31.
// =============================================================================

import { describe, expect, test } from 'vitest';

import {
  acceptDataOutcome,
  deriveFinanceState,
  premiumFigures,
  type ShownBlock,
} from '../../../src/lib/features/finance/finance-state';
import { buildPremium } from '../../../src/lib/features/finance/finance-aggregate';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse';
import { formatPremiumSummary } from '../../../src/lib/ui-copy';
import type { DataOutcome } from '../../../src/lib/core/query-client';
import type {
  CurrencyView,
  PremiumView,
  SpendView,
} from '../../../src/lib/features/finance/finance-shared';
import type { DataQuery } from '../../../src/lib/core/types/worker-messages';
import { PREMIUM_HAND_CSV, PREMIUM_HAND_EXPECTED } from '../../fixtures/finance-fixtures';

// -----------------------------------------------------------------------------
// The hand view, built through the real parser and the real builder
// -----------------------------------------------------------------------------

/**
 * The 05-01 hand fixture's premium view, parsed the way the worker parses it
 * and aggregated the way the worker aggregates it.
 *
 * The two steps are the IMPORT PATH's own, not re-implementations: quote-all
 * cells unwrapped, the export's trailing space intact, a bare-CR terminator on
 * every line. A view built any other way would be a second answer to a
 * question the worker already answers.
 */
const HAND_VIEW: PremiumView = buildPremium(
  parseCsvFile(PREMIUM_HAND_CSV, 'Financial_data', 'Operations_with_Premium_Days.csv').rows.map(
    (row) => row.data,
  ),
  true,
);

/** The `ready` branch of the hand view, for the tests that need real months. */
const HAND_READY = (() => {
  if (HAND_VIEW.status !== 'ready') throw new Error(`hand view is ${HAND_VIEW.status}, not ready`);
  return HAND_VIEW;
})();

/** The dataset identity two tests are about: an import and its successor. */
const FIRST = '2021-10-12T00:00:00.000Z';
const SECOND = '2021-10-13T00:00:00.000Z';

/** A `DataOutcome<'premium'>` carrying a result. */
function premiumResult(
  importedAt: string | null,
  view: PremiumView | null,
): DataOutcome<'premium'> {
  return {
    kind: 'result',
    queryId: 1,
    importedAt,
    result: view === null ? null : { channel: 'premium', view },
  };
}

/** A `DataOutcome<'premium'>` for the two settlements that are not results. */
function premiumSettled(
  kind: 'error' | 'superseded',
  detail = 'worker detail',
): DataOutcome<'premium'> {
  return kind === 'error'
    ? { kind: 'error', queryId: 1, detail }
    : { kind: 'superseded', queryId: 1 };
}

/** A shown block stamped for `FIRST`, wrapping the hand view. */
const HAND_SHOWN: ShownBlock<PremiumView> = { kind: 'view', importedAt: FIRST, view: HAND_VIEW };

// -----------------------------------------------------------------------------
// deriveFinanceState
// -----------------------------------------------------------------------------

describe('05-10 tracer: finance block state', () => {
  describe('deriveFinanceState', () => {
    test('no dataset on screen is loading, and so is no answer at all', () => {
      expect(deriveFinanceState({ importedAt: null, shown: HAND_SHOWN })).toBe('loading');
      expect(deriveFinanceState({ importedAt: FIRST, shown: null })).toBe('loading');
    });

    test("an answer stamped with another dataset is no answer, not that dataset's state", () => {
      // D-28 / T-05-30. A replace that lands mid-query returns the block to
      // `loading` BY CONSTRUCTION rather than through a hand-written reset, and
      // a `failed` answer for a replaced dataset can never become an error
      // about the export now on screen.
      expect(
        deriveFinanceState({ importedAt: FIRST, shown: { ...HAND_SHOWN, importedAt: SECOND } }),
      ).toBe('loading');
      expect(
        deriveFinanceState({
          importedAt: FIRST,
          shown: { kind: 'failed', importedAt: SECOND },
        }),
      ).toBe('loading');
    });

    test('a failed answer is error', () => {
      expect(
        deriveFinanceState({ importedAt: FIRST, shown: { kind: 'failed', importedAt: FIRST } }),
      ).toBe('error');
    });

    test("each of the view's own statuses is passed through", () => {
      // The four view statuses are claims about the EXPORT and are taken at
      // face value. `not-in-export` and `no-rows` are the pair D-02 requires to
      // stay apart, so both are asserted rather than one standing for the other.
      const views: readonly PremiumView[] = [
        { status: 'not-in-export' },
        { status: 'no-rows' },
        { status: 'no-usable', excluded: 0, unrecognised: [], unrecognisedMore: 0 },
        HAND_VIEW,
      ];
      for (const view of views) {
        expect(
          deriveFinanceState({
            importedAt: FIRST,
            shown: { kind: 'view', importedAt: FIRST, view },
          }),
        ).toBe(view.status);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // acceptDataOutcome — the trust boundary
  // ---------------------------------------------------------------------------

  describe('acceptDataOutcome', () => {
    test('a result for the ask is admitted, stamped with the ASK', () => {
      const accepted = acceptDataOutcome(premiumResult(FIRST, HAND_VIEW), 'premium', FIRST, FIRST);
      expect(accepted).toEqual({ kind: 'view', importedAt: FIRST, view: HAND_VIEW });
    });

    test('a superseded outcome is dropped', () => {
      // Not an error: the block asked a newer question of this channel and has
      // a newer answer on the way. Nothing to render, nothing to report.
      expect(acceptDataOutcome(premiumSettled('superseded'), 'premium', FIRST, FIRST)).toBeNull();
    });

    test('an error outcome becomes a failed block that carries no detail', () => {
      // T-05-31. The worker's `detail` can name a file path, so it is dropped
      // here rather than at the render site, and the returned object is
      // asserted field-for-field so a later "just pass it through" fails.
      const accepted = acceptDataOutcome(
        premiumSettled('error', '/Users/someone/secret-path.csv'),
        'premium',
        FIRST,
        FIRST,
      );
      expect(accepted).toEqual({ kind: 'failed', importedAt: FIRST });
      expect(Object.keys(accepted!)).toEqual(['kind', 'importedAt']);
    });

    test('an answer for a dataset that is no longer on screen is dropped', () => {
      // The three rejections that are not about the reply at all: nothing
      // loaded, a different dataset on screen, and a different dataset asked.
      // A replace can land while the worker is reading, and then the answer is
      // for a dashboard nobody is looking at any more.
      expect(acceptDataOutcome(premiumResult(FIRST, HAND_VIEW), 'premium', FIRST, null)).toBeNull();
      expect(
        acceptDataOutcome(premiumResult(FIRST, HAND_VIEW), 'premium', FIRST, SECOND),
      ).toBeNull();
    });

    test('a result stamped with no dataset, or another one, is dropped', () => {
      expect(acceptDataOutcome(premiumResult(null, HAND_VIEW), 'premium', FIRST, FIRST)).toBeNull();
      expect(
        acceptDataOutcome(premiumResult(SECOND, HAND_VIEW), 'premium', FIRST, FIRST),
      ).toBeNull();
    });

    test('a null result is dropped, leaving the block loading rather than erroring', () => {
      // A legitimate answer — the worker holds no stored dataset for this
      // channel. It is a fact about the worker's storage, not a failure of the
      // user's export, so it is not one of the export's states.
      expect(acceptDataOutcome(premiumResult(FIRST, null), 'premium', FIRST, FIRST)).toBeNull();
    });

    test("a result for another channel is dropped, even with this block's own stamp", () => {
      // `QueryClient.handle` settles a wrong-channel reply as an ERROR before
      // it gets here, so this is the second gate rather than the first. It is
      // tested with the broad `DataOutcome` a block would hold if the
      // narrowing were ever lost, because handing a currency view to the
      // premium block is the same class of tear the `importedAt` pairing
      // defends against, reached by a different route.
      const wrongChannel: DataOutcome = {
        kind: 'result',
        queryId: 1,
        importedAt: FIRST,
        result: { channel: 'currency', view: { status: 'no-usable', excluded: 0 } },
      };
      expect(acceptDataOutcome(wrongChannel, 'premium', FIRST, FIRST)).toBeNull();
    });

    test('a null result for another channel is dropped rather than typed as this one', () => {
      // A null result carries no channel, so the channel check cannot read one
      // off it; it is dropped for carrying no view at all, which is the rule
      // that covers it.
      const empty: DataOutcome = { kind: 'result', queryId: 1, importedAt: FIRST, result: null };
      expect(acceptDataOutcome(empty, 'premium', FIRST, FIRST)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // premiumFigures
  // ---------------------------------------------------------------------------

  describe('premiumFigures over the hand premium view', () => {
    test('reports the four months of grants in a five-month span', () => {
      // The gaps are the finding (D-14): the hand fixture grants in March,
      // May, June and July 2019 and NOTHING in April, so the axis runs five
      // months and four of them carry a grant.
      const figures = premiumFigures(HAND_READY);
      expect(figures.monthsWithGrants).toBe(4);
      expect(figures.spanMonths).toBe(5);
    });

    test('reports the totals the hand fixture derived by arithmetic', () => {
      // 432,000 + 2,721,600 + 216,000 + 1,209,600 = 4,579,200 s = 53 days.
      // The numbers are the FIXTURE's, so this test fails if the builder and
      // the hand derivation ever disagree — which is the whole point of
      // checking one against the other.
      const figures = premiumFigures(HAND_READY);
      expect(figures.totalSeconds).toBe(PREMIUM_HAND_EXPECTED.totalSeconds);
      expect(figures.totalSeconds).toBe(4_579_200);
      expect(figures.grants).toBe(PREMIUM_HAND_EXPECTED.grants);
      expect(figures.grants).toBe(11);
    });

    test('names the largest month and its seconds', () => {
      // May 2019 = 2019 * 12 + 5 - 1 = 24,232, and it is the largest of the
      // four: 2,721,600 s against July's 1,209,600 s.
      const figures = premiumFigures(HAND_READY);
      expect(figures.peakMonth).toBe(24_232);
      expect(figures.peakMonth).toBe(PREMIUM_HAND_EXPECTED.months[1]!.month);
      expect(figures.peakSeconds).toBe(2_721_600);
      expect(figures.peakSeconds).toBe(PREMIUM_HAND_EXPECTED.months[1]!.seconds);
    });

    test('a tie for the largest month picks the EARLIER one', () => {
      // The peak is a month a reader will want next, and naming the later of two
      // equal months would be an arbitrary choice presented as a finding. The
      // months array is already ascending, so `>` is what fixes the tie.
      const tied: Extract<PremiumView, { status: 'ready' }> = {
        status: 'ready',
        firstMonth: 100,
        lastMonth: 101,
        months: [
          { month: 100, seconds: 500, grants: 1, sizes: [], moreSizes: 0 },
          { month: 101, seconds: 500, grants: 1, sizes: [], moreSizes: 0 },
        ],
        totalSeconds: 1_000,
        grants: 2,
        excluded: 0,
        unrecognised: [],
        unrecognisedMore: 0,
      };
      expect(premiumFigures(tied)).toMatchObject({ peakMonth: 100, peakSeconds: 500 });
    });

    test('the figures are accepted by the copy formatter unchanged', () => {
      // The type here is declared in this module rather than imported from
      // `ui-copy`, which this module does not import (it is pure, with no copy
      // dependency). Structural compatibility is therefore proven HERE, by
      // passing the result to the formatter the component passes it to — a
      // rename on either side becomes a compile error in this file.
      const sentence = formatPremiumSummary(premiumFigures(HAND_READY), 'en-US');
      expect(sentence).toBe(
        'Premium time was granted in 4 of 5 months: 53 days in total across 11 operations. ' +
          'The largest month was 2019-05 with 31.5 days.',
      );
    });
  });
});

// -----------------------------------------------------------------------------
// Compile-time only: the channel argument is what a block actually passes
// -----------------------------------------------------------------------------

/** The three channels this state machine serves, in `DataQuery` order. */
const FINANCE_QUESTIONS: readonly DataQuery[] = [
  { channel: 'premium' },
  { channel: 'currency' },
  { channel: 'spend' },
];

describe('05-10 tracer: the three finance channels share one state machine', () => {
  test('a premium, a currency and a spend view all derive through the same function', () => {
    // `deriveFinanceState` is generic over the view rather than written three
    // times, and that is only sound because all three finance views carry a
    // `status` drawn from the same four. This asserts the other two shapes
    // really do fit, so a future view that renames or drops its status fails
    // here rather than inside a block's render.
    //
    // The vehicles channel is deliberately NOT in the list: `VehicleView`
    // carries `titleState` rather than `status` and its block owns an
    // `updating` state of its own, which is plan 05-12's to derive.
    const views: readonly { channel: string; view: CurrencyView | PremiumView | SpendView }[] = [
      { channel: 'premium', view: HAND_VIEW },
      { channel: 'currency', view: { status: 'no-usable', excluded: 0 } },
      { channel: 'spend', view: { status: 'no-usable' } },
    ];
    for (const { view } of views) {
      expect(
        deriveFinanceState({ importedAt: FIRST, shown: { kind: 'view', importedAt: FIRST, view } }),
      ).toBe(view.status);
    }
    expect(views.map((entry) => entry.channel)).toEqual(
      FINANCE_QUESTIONS.map((query) => query.channel),
    );
  });
});

// =============================================================================
// 05-13 currencyChartInput — the per-currency chart input
// =============================================================================
//
// WHY THIS IS A PURE FUNCTION AND NOT COMPONENT CODE
// A currency chart is small multiples: one `BarChartInput` PER CHARTED
// CURRENCY, each with its own symmetric domain (D-15). Two decisions therefore
// exist outside any component: how a `CurrencyEntry`'s exact micro-unit strings
// become the two plain-number series the bar model needs, and what the chart's
// domain maximum is in EXACT units rather than the rounded pixels it becomes.
//
// The second is the one worth a test. The bar model's `domainMax` is a float
// derived from `unitsToNumber`, and the y-axis top label is that float in
// COMPACT form — so a domain rounded to 1.03M would print `1M` and the `<title>`
// would name 1,030,000 as if that were the figure. Carrying the exact `bigint`
// beside the input is what lets the axis label's `<title>` state the real
// maximum, and it is why this function returns a pair rather than a bare input.
//
// The figures below are checked against BOTH answer keys: the worker's own
// `buildCurrency` over the parsed 05-01 hand rows, and the independent
// `oracleCurrency`, which never reaches the aggregator. A vocabulary mismatch
// between a label layer and the data layer is the hazard 05-12 had to rekey, so
// every field name this function reads is asserted against the built view.
//
// Decisions: D-15, D-16, D-17, D-25. Threats: T-05-10, T-05-40.
// =============================================================================

import { currencyChartInput } from '../../../src/lib/features/finance/finance-state';
import { buildCurrency } from '../../../src/lib/features/finance/finance-aggregate';
import { CURRENCY_HAND_CSV, CURRENCY_HAND_EXPECTED } from '../../fixtures/finance-fixtures';
import { oracleCurrency, type OracleRow } from '../../helpers/finance-oracle';

/** Micro-units in one whole unit, spelled out so a fixture figure is readable. */
const MICRO = 1_000_000n;

/**
 * The hand currency view, through the real parser and the real builder — the
 * same two steps the import path takes, not a re-implementation.
 */
const HAND_CURRENCY_VIEW: CurrencyView = buildCurrency(
  parseCsvFile(CURRENCY_HAND_CSV, 'Financial_data', 'Virtual_Currencies_Operations.csv').rows.map(
    (row) => row.data,
  ),
  true,
);

const HAND_CURRENCY_READY = (() => {
  if (HAND_CURRENCY_VIEW.status !== 'ready') {
    throw new Error(`hand currency view is ${HAND_CURRENCY_VIEW.status}, not ready`);
  }
  return HAND_CURRENCY_VIEW;
})();

/** The hand rows as the oracle wants them, for the independent cross-check. */
const HAND_ORACLE = oracleCurrency(
  parseCsvFile(CURRENCY_HAND_CSV, 'Financial_data', 'Virtual_Currencies_Operations.csv').rows.map(
    (row) => row.data as OracleRow,
  ),
);

describe('05-13 currencyChartInput over the hand currency view', () => {
  test('the hand view has two charts in count order and four listed currencies', () => {
    // The whole reason this file exists: the label layer and the data layer
    // agreed about the vocabulary ONCE in 05-12 and had to be rekeyed. The
    // independent oracle is asked first, and the view is then asserted against
    // it, so a field rename cannot reach the component silently.
    expect(HAND_ORACLE.usable).toBe(CURRENCY_HAND_EXPECTED.usable);
    expect(HAND_ORACLE.excluded).toBe(CURRENCY_HAND_EXPECTED.excluded);
    expect(HAND_ORACLE.charted.map((group) => group.code)).toEqual(
      CURRENCY_HAND_EXPECTED.charted.map((group) => group.code),
    );
    expect(HAND_ORACLE.others.map((group) => group.code)).toEqual(
      CURRENCY_HAND_EXPECTED.others.map((group) => group.code),
    );
    expect(HAND_CURRENCY_READY.charts.map((entry) => entry.code)).toEqual(
      CURRENCY_HAND_EXPECTED.charted.map((group) => group.code),
    );
  });

  test('the credits entry is a currency chart from 2018-01 to 2020-06', () => {
    const credits = HAND_CURRENCY_READY.charts[0]!;
    const { input } = currencyChartInput(credits);

    expect(input.kind).toBe('currency');
    // 2018 * 12 + 1 - 1 = 24,216 and 2020 * 12 + 6 - 1 = 24,245.
    expect(input.firstMonth).toBe(24_216);
    expect(input.lastMonth).toBe(24_245);
    expect(input.firstMonth).toBe(CURRENCY_HAND_EXPECTED.charted[0]!.firstMonth);
    expect(input.lastMonth).toBe(CURRENCY_HAND_EXPECTED.charted[0]!.lastMonth);
  });

  test('thirty sparse months, each a deposit above and a withdrawal below', () => {
    const credits = HAND_CURRENCY_READY.charts[0]!;
    const { input } = currencyChartInput(credits);

    // SPARSE, and every month in the span is present because the fixture walks
    // it with no gap — so 30 months on the input is 30 months drawn. The bar
    // model fills the gaps itself; a test that counted `input.months.length`
    // against a fixture WITH a gap would be reading the wrong number.
    expect(credits.months).toHaveLength(30);
    expect(input.months).toHaveLength(30);

    input.months.forEach((month, offset) => {
      expect(month.month).toBe(24_216 + offset);
      // A deposit of `1,000,000 + 1,000 × offset` units, and a withdrawal of
      // 400,000 in the SAME month — the fixture's reason for pairing them.
      expect(month.up).toBe(1_000_000 + 1_000 * offset);
      expect(month.down).toBe(400_000);
    });
  });

  test('the exact domain maximum is the largest deposit month in micro-units', () => {
    const credits = HAND_CURRENCY_READY.charts[0]!;
    const { input, domainMaxUnits } = currencyChartInput(credits);

    // The deposit series rises by 1,000 a month, so the LAST month is the
    // largest: 1,000,000 + 1,000 × 29 = 1,029,000 units. The withdrawal side
    // is flat at 400,000, so the deposit side always sets the domain — which
    // is the "larger of the two sides" rule (D-17) with a real answer.
    const largestUp = Math.max(...input.months.map((month) => month.up));
    const largestDown = Math.max(...input.months.map((month) => month.down));
    expect(largestUp).toBe(1_029_000);
    expect(domainMaxUnits).toBe(BigInt(largestUp) * MICRO);
    expect(domainMaxUnits).toBe(1_029_000_000_000n);
    expect(domainMaxUnits).toBeGreaterThan(BigInt(largestDown) * MICRO);
  });

  test('a withdrawal-led month sets the domain when it is the larger side', () => {
    // The symmetric rule is only proven if the two directions can win, and
    // the hand fixture's second currency cannot do it: gold deposits 250 and
    // withdraws 100 in every month. This hand-built entry is the other half.
    const withdrawalLed = {
      code: 'ru.test.withdrawal_led',
      title: 'Withdrawal led',
      ops: 60,
      inUnits: '10000000',
      outUnits: '90000000',
      firstMonth: 100,
      lastMonth: 100,
      months: [{ month: 100, inUnits: '10000000', outUnits: '90000000', inOps: 1, outOps: 1 }],
    };
    const { input, domainMaxUnits } = currencyChartInput(withdrawalLed);
    expect(input.months[0]).toEqual({ month: 100, up: 10, down: 90 });
    expect(domainMaxUnits).toBe(90_000_000n);
  });

  test("gold's figures match the fixture's arithmetic", () => {
    // The last twenty-six of the credits months, 250 in and 100 out each:
    // 6,500 and 2,600 units, 52 operations, 2018-05 through 2020-06.
    const gold = HAND_CURRENCY_READY.charts[1]!;
    const expected = CURRENCY_HAND_EXPECTED.charted[1]!;
    const { input, domainMaxUnits } = currencyChartInput(gold);

    expect(gold.ops).toBe(expected.operations);
    expect(input.months).toHaveLength(26);
    expect(input.firstMonth).toBe(expected.firstMonth);
    expect(input.lastMonth).toBe(expected.lastMonth);
    expect(input.months.reduce((sum, month) => sum + month.up, 0)).toBe(6_500);
    expect(input.months.reduce((sum, month) => sum + month.down, 0)).toBe(2_600);
    expect(domainMaxUnits).toBe(250n * MICRO);
  });

  test('a month the worker reports with no deposits carries a zero, not a gap', () => {
    // A currency that earned and spent in DIFFERENT months is the real shape of
    // the sparse list, and a month that was present with zeros must not be
    // confused with a month that is absent. Both produce `up: 0` here; what
    // distinguishes them is that the reported month is on the input at all.
    const split = {
      code: 'ru.test.split',
      title: 'Split',
      ops: 60,
      inUnits: '5000000',
      outUnits: '7000000',
      firstMonth: 200,
      lastMonth: 201,
      months: [
        { month: 200, inUnits: '5000000', outUnits: '0', inOps: 1, outOps: 0 },
        { month: 201, inUnits: '0', outUnits: '7000000', inOps: 0, outOps: 1 },
      ],
    };
    const { input } = currencyChartInput(split);
    expect(input.months).toEqual([
      { month: 200, up: 5, down: 0 },
      { month: 201, up: 0, down: 7 },
    ]);
  });

  test('a stored sum this app did not write reads as zero rather than throwing', () => {
    // `parseUnitsString` is the trust boundary at the display edge: a stored
    // value that is not the plain integer this app transports is a corrupted
    // dataset, and the answer is a zero bar (the row is already counted as
    // excluded upstream) rather than a `NaN` height inside a render.
    const corrupted = {
      code: 'ru.test.corrupt',
      title: 'Corrupt',
      ops: 60,
      inUnits: '1,000',
      outUnits: 'nonsense',
      firstMonth: 300,
      lastMonth: 300,
      months: [{ month: 300, inUnits: '1,000', outUnits: 'nonsense', inOps: 1, outOps: 1 }],
    };
    const { input, domainMaxUnits } = currencyChartInput(corrupted);
    expect(input.months[0]).toEqual({ month: 300, up: 0, down: 0 });
    expect(domainMaxUnits).toBe(0n);
  });

  test('an entry with no months at all still yields a chart input', () => {
    // A `ready` entry always has at least one month, so this shape is
    // unreachable through the worker — and an unreachable shape that throws
    // inside a render is exactly the failure the fallbacks exist to prevent
    // (the same rule `premiumFigures` follows above).
    const { input, domainMaxUnits } = currencyChartInput({
      code: null,
      title: null,
      ops: 0,
      inUnits: '0',
      outUnits: '0',
      firstMonth: 400,
      lastMonth: 400,
      months: [],
    });
    expect(input).toEqual({
      kind: 'currency',
      firstMonth: 400,
      lastMonth: 400,
      months: [],
    });
    expect(domainMaxUnits).toBe(0n);
  });
});

// =============================================================================
// The two axis extents, and the model's float extents beside them (05-21)
// =============================================================================
//
// The currency plot is DIVIDED between the two directions rather than split
// evenly, so the axis has two extents and each one is labelled. Which means a
// label can now name something that is not a month: a deposits-only currency's
// bottom extent is a quarter of its deposit maximum, and the bottom label reads
// that axis value, because it has to agree with the hairline it sits against
// (D-25). So the exact figures are computed twice on purpose — once here in
// `bigint` for the label, once in the model as floats for the pixels — and the
// test below is what stops the two copies of the rule from drifting apart.
// =============================================================================

import {
  buildBarChartModel,
  CURRENCY_MIN_SIDE_DIVISOR,
} from '../../../src/lib/charts/bar-chart-model';
import { unitsToNumber } from '../../../src/lib/core/decimal';

describe('05-21 currencyChartInput axis extents', () => {
  test("credits: the deposit maximum, and the withdrawal's own maximum below it", () => {
    const credits = HAND_CURRENCY_READY.charts[0]!;
    const { input, domainUpUnits, domainDownUnits } = currencyChartInput(credits);

    // Deposits rise 1,000 a month, so the last month is 1,000,000 + 1,000 × 29
    // = 1,029,000 units, and withdrawals are flat at 400,000. A quarter of
    // 400,000 is 100,000, which is below the withdrawal maximum, so BOTH
    // extents are their own maxima and the quarter rule does not fire here.
    expect(domainUpUnits).toBe(BigInt(1_029_000) * MICRO);
    expect(domainDownUnits).toBe(BigInt(400_000) * MICRO);
    // And the largest month still names the chart's maximum.
    expect(Math.max(...input.months.map((month) => month.up))).toBe(1_029_000);
  });

  test('gold: 250 up and 100 down, neither of which triggers the quarter rule', () => {
    const gold = HAND_CURRENCY_READY.charts[1]!;
    const { domainUpUnits, domainDownUnits } = currencyChartInput(gold);

    // A quarter of 100 is 25, below 250; a quarter of 250 is 62, below 100.
    expect(domainUpUnits).toBe(250n * MICRO);
    expect(domainDownUnits).toBe(100n * MICRO);
  });

  test('a one-sided entry gives the empty side a quarter of the full side', () => {
    // The whole point of the rule: this currency has nothing below the line, so
    // the axis still has to say where the line's room ends rather than naming a
    // zero the plot does not have.
    const depositsOnly = {
      code: 'ru.test.deposits_only',
      title: 'Deposits only',
      ops: 60,
      inUnits: '10000000',
      outUnits: '0',
      firstMonth: 500,
      lastMonth: 500,
      months: [{ month: 500, inUnits: '10000000', outUnits: '0', inOps: 1, outOps: 0 }],
    };
    const { domainUpUnits, domainDownUnits } = currencyChartInput(depositsOnly);

    expect(domainUpUnits).toBe(10n * MICRO);
    // A quarter, in EXACT integer division: 10,000,000 / 4 is 2,500,000 units.
    expect(domainDownUnits).toBe(BigInt(10_000_000 / CURRENCY_MIN_SIDE_DIVISOR) * 1n);
    expect(domainDownUnits).toBe(2_500_000n);
  });

  test('a withdrawal-led entry mirrors the same rule', () => {
    const { domainUpUnits, domainDownUnits } = currencyChartInput({
      code: 'ru.test.withdrawal_led',
      title: 'Withdrawal led',
      ops: 60,
      inUnits: '10000000',
      outUnits: '90000000',
      firstMonth: 100,
      lastMonth: 100,
      months: [{ month: 100, inUnits: '10000000', outUnits: '90000000', inOps: 1, outOps: 1 }],
    });

    expect(domainUpUnits).toBe(22_500_000n); // 90,000,000 / 4
    expect(domainDownUnits).toBe(90_000_000n);
  });

  test('an entry with nothing usable in it has no extent on either side', () => {
    // A zero extent must read as `0` and not as a hair's breadth of a unit: the
    // label is the honest statement that the axis goes nowhere.
    const corrupted = {
      code: 'ru.test.corrupt',
      title: 'Corrupt',
      ops: 60,
      inUnits: '1,000',
      outUnits: 'nonsense',
      firstMonth: 300,
      lastMonth: 300,
      months: [{ month: 300, inUnits: '1,000', outUnits: 'nonsense', inOps: 1, outOps: 1 }],
    };
    const { domainUpUnits, domainDownUnits } = currencyChartInput(corrupted);

    expect(domainUpUnits).toBe(0n);
    expect(domainDownUnits).toBe(0n);
  });

  test('the exact extents and the model’s float extents follow one rule', () => {
    // The two copies of the divisor are the hazard: `finance-state` works in
    // bigint and `bar-chart-model` in floats, and nothing about either makes
    // them agree. This is the assertion that keeps the label and the hairline
    // it sits against describing the same axis.
    const entries = [HAND_CURRENCY_READY.charts[0]!, HAND_CURRENCY_READY.charts[1]!];

    for (const entry of entries) {
      const { input, domainMaxUnits, domainUpUnits, domainDownUnits } = currencyChartInput(entry);
      const model = buildBarChartModel(input);

      expect(model.domainUp).toBeCloseTo(unitsToNumber(domainUpUnits), 6);
      expect(model.domainDown).toBeCloseTo(unitsToNumber(domainDownUnits), 6);
      expect(model.domainMax).toBeCloseTo(unitsToNumber(domainMaxUnits), 6);
    }
  });
});
