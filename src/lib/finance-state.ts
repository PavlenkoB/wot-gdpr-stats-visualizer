import type { CurrencyEntry, PremiumView } from './finance-shared.ts';
import type { DataOutcome } from './query-client.ts';
import type { DataQuery, DataResult } from './types/worker-messages.ts';
import type { BarChartInput } from './bar-chart-model.ts';
import { CURRENCY_MIN_SIDE_DIVISOR } from './bar-chart-model.ts';
import { parseUnitsString, unitsToNumber } from './decimal.ts';

// =============================================================================
// The Financial sub-blocks' decisions, as pure functions (05-10).
//
// ## Why this module exists at all
//
// Three blocks render from three worker channels — premium, currency and
// spend — and each of them can be wrong in the same three ways while a query
// is in flight. Those failures are not visual: they are a previous export's
// money under a new export's heading, a file that was never there described as
// a file that held no rows, or a worker's internal detail printed under a
// heading that promises the user their data is fine.
//
// So every one of the six states of the 05-UI-SPEC state matrix is decided by
// `deriveFinanceState`, every answer is admitted or dropped by
// `acceptDataOutcome`, and the premium summary's figures are read out of the
// view by `premiumFigures` — all ordinary functions over ordinary data, which
// is the only reason they can be tested at all (Vitest runs with no DOM; see
// vitest.config.ts).
//
// ## The one key, and why one is enough
//
// `importedAt` is the dataset identity, a primitive string. A replace changes
// it, a clear removes it, and an answer that carries a different one belongs
// to a dashboard that is no longer on screen. `shown` therefore holds the
// `importedAt` it answers for TOGETHER WITH the view, and a mismatch is "no
// answer" rather than a value to display.
//
// Phase 4's playtime block needs a second key — the requested slice, so that
// a selection change is an `updating` state rather than a flash of the old
// slice. A Financial sub-block has no control that asks for a different slice
// of the same dataset: each block asks one question of the worker and renders
// the answer. `updating` is therefore NOT a state here, and adding a key for
// it would be a key with exactly one possible value. The vehicles block (plan
// 05-12) does have a title selector and owns its own `updating` state, which
// is why `ViewOf` below and `deriveFinanceState`'s constraint admit the three
// finance channels and not that one.
//
// ## T-05-29, T-05-30, T-05-31
//
// `acceptDataOutcome` is the trust boundary. It drops a superseded answer, an
// answer for a dataset other than the one on screen, a result stamped with no
// dataset or another one, a result with no view, and a result carrying another
// channel's view. What survives is stamped with the ASK, not with anything the
// reply said about itself, so a block can never hold a view it did not request.
//
// The worker's `detail` is deliberately NOT carried into the failed block: it
// can name a file path, and the fixed sentence is the only one that is true
// whether the worker has no aggregate or the query failed. The block therefore
// cannot render it even by accident — there is nowhere for it to be read from.
//
// ## Why this module imports no copy
//
// `premiumFigures` returns the figures `formatPremiumSummary` needs, and its
// return type is declared HERE rather than imported from `ui-copy`. The reason
// is the same one that keeps this module free of Svelte: a decision module
// that also carried the sentences would let a wording change reach a state
// test, and a state test is not where wording is verified. The two shapes are
// therefore structurally compatible and NOT nominally linked, and
// `tests/unit/finance-state.test.ts` proves the compatibility by passing the
// result to the formatter the component passes it to — a rename on either side
// becomes a compile error there.
// =============================================================================

/** The six states of the 05-UI-SPEC Financial sub-block matrix, plus nothing. */
export type BlockState = 'loading' | 'ready' | 'not-in-export' | 'no-rows' | 'no-usable' | 'error';

/**
 * The statuses a view may carry, which are the states a block is in once it
 * has an answer for the dataset on screen.
 *
 * The four are the export's own facts and are taken at face value. `error` is
 * not among them because a failure is not something a view reports — it is
 * something the transport reports, and `ShownBlock`'s `failed` variant is how
 * that reaches here. `loading` is not among them for the mirror reason: no
 * view and no answer is what produces it.
 */
export type ViewStatus = Exclude<BlockState, 'loading' | 'error'>;

/**
 * One applied answer, stamped with the ask that produced it.
 *
 * Two variants and no third: a view that can be rendered, or a failure that
 * cannot. A `view` holds the whole view including every field the block's
 * branches read, so the component never re-derives what it is showing from
 * the question it happens to still be holding.
 */
export type ShownBlock<V> =
  { kind: 'view'; importedAt: string; view: V } | { kind: 'failed'; importedAt: string };

/** Everything the state derivation reads, and nothing it has to compute. */
export interface FinanceStateInput<V> {
  /** The dataset on screen now, or null when none is. */
  importedAt: string | null;
  /** The last applied answer, or null when there is none. */
  shown: ShownBlock<V> | null;
}

/**
 * The one state the block renders (05-UI-SPEC section 2).
 *
 * The order of the tests IS the order of the questions, cheapest and most
 * disqualifying first:
 *
 *   1. Is there a dataset, and is what we are showing an answer for THAT
 *      dataset? A replace that lands mid-query therefore returns the block to
 *      `loading` by construction rather than through a hand-written reset, and
 *      a `failed` answer for a replaced dataset never becomes an error about
 *      the export now on screen.
 *   2. Did the answer fail? `error`.
 *   3. Otherwise the view's own status, which is a claim about the export.
 *
 * The three empty states are NOT collapsed, and D-02 is the reason: a file
 * that was absent and a file that was present with no rows are different
 * problems for the reader, because only the first is fixed by a wider export
 * range and only the second means the game granted nothing. The presence
 * facts that tell them apart were computed by the worker in 05-07; this
 * function's only job is to pass the answer through without flattening it.
 */
export function deriveFinanceState<V extends { status: ViewStatus }>({
  importedAt,
  shown,
}: FinanceStateInput<V>): BlockState {
  if (importedAt === null) return 'loading';
  if (shown === null || shown.importedAt !== importedAt) return 'loading';
  if (shown.kind === 'failed') return 'error';
  return shown.view.status;
}

/** The view one channel's result carries, resolved from the union. */
export type ViewOf<C extends DataQuery['channel']> =
  Extract<DataResult, { channel: C }> extends { view: infer V } ? V : never;

/**
 * Admit one outcome, or drop it.
 *
 * Every rejection is a `null`, never an exception: a block awaiting a query
 * has to keep rendering, and an answer it must not show is not an error
 * condition (D-21's rule that nothing on this path ever rejects).
 *
 * The dataset check runs against the dataset CURRENTLY on screen as well as
 * against the ask, because the two can differ: a replace can land while the
 * worker is reading, and then the answer is for a dataset nobody is looking at
 * any more. The surviving record is stamped with the ASK rather than with the
 * reply, so `shown` can only ever describe a question this block actually put.
 *
 * The order of the checks is the order of the disqualifications. `superseded`
 * is first because it is not an answer at all. The two dataset gates come
 * next because a wrong-dataset answer is wrong however it is stamped. The
 * error outcome becomes a `failed` block HERE, with the detail dropped, so
 * the one place a worker string could enter a block is the one place that
 * does not take it. A null result is dropped rather than rendered: it means
 * the worker holds no stored dataset for this channel, which is a fact about
 * its storage and not one of the export's empty states, and dropping it leaves
 * the block loading instead of painting an error about numbers the app may
 * still hold.
 */
export function acceptDataOutcome<C extends DataQuery['channel']>(
  outcome: DataOutcome<C>,
  channel: C,
  askImportedAt: string,
  currentImportedAt: string | null,
): ShownBlock<ViewOf<C>> | null {
  // A newer query was issued, so this one is answered to nobody. Its numbers
  // are not wrong, they are simply not what is on screen.
  if (outcome.kind === 'superseded') return null;
  if (currentImportedAt === null || currentImportedAt !== askImportedAt) return null;

  if (outcome.kind === 'error') {
    // The worker's `detail` is deliberately not carried: it names worker
    // internals and belongs in the console, never in the DOM (T-05-31, D-21).
    return { kind: 'failed', importedAt: askImportedAt };
  }

  if (outcome.importedAt === null || outcome.importedAt !== askImportedAt) return null;
  if (outcome.result === null) return null;
  // A reply for another channel cannot be applied: handing a `currency` view
  // to the premium block would paint one section's numbers under another's
  // heading. `QueryClient.handle` settles this as an error before it arrives,
  // so this is the second gate rather than the first — and the one that does
  // not depend on that client keeping its check.
  if (outcome.result.channel !== channel) return null;

  // The assertion is what the check above just proved, and it is the same
  // assertion `QueryClient.handle` makes for the same reason: `ResultOf<C>` is
  // a deferred conditional, so TypeScript widens the view back to the whole
  // `DataResult` union and cannot see that the discriminant matched. A call
  // that reaches the return has already proved its result's channel IS the
  // channel that asked.
  return { kind: 'view', importedAt: askImportedAt, view: outcome.result.view as ViewOf<C> };
}

/**
 * The figures a premium summary sentence is built from.
 *
 * Structurally the argument of `formatPremiumSummary`; see the header comment
 * for why the type is declared here rather than imported from `ui-copy`.
 */
export interface PremiumFigures {
  /** How many drawn months had at least one grant. */
  monthsWithGrants: number;
  /** How many months the chart draws in total, gaps included. */
  spanMonths: number;
  /** Total granted time in whole seconds — an integer, never a rounded float. */
  totalSeconds: number;
  /** How many operations contributed. */
  grants: number;
  /** Month index of the largest month. */
  peakMonth: number;
  /** The largest month's granted time in whole seconds. */
  peakSeconds: number;
}

/**
 * The premium view's summary figures (D-19, D-14).
 *
 * Four of the six are read straight off the view. The two that are not are
 * both about the SPAN rather than the totals, and both are the gaps:
 *
 *   - `spanMonths` is `lastMonth - firstMonth + 1`, NOT `months.length`. The
 *     view's `months` is sparse — only a month with a grant is present — so
 *     its length counts the months that were busy, and using it as the span
 *     would report "granted in 4 of 4 months" for an export that granted
 *     nothing in April. The chart fills that gap, and the sentence has to name
 *     it, because "4 of 5 months" and "4 months' worth of time" are different
 *     facts and only the first says the history is sparse (UI-SPEC section 4).
 *   - the peak is read from `months` rather than from the view's own totals,
 *     because the view has no peak field: it is a figure the sentence needs
 *     and the workers do not compute it.
 *
 * A tie for the largest month takes the EARLIER one, and the loop's strict `>`
 * over an ascending array is what fixes that without a second comparison. The
 * peak is a month a reader will want next, so naming the later of two equal
 * months would be an arbitrary choice presented as a finding.
 */
export function premiumFigures(view: Extract<PremiumView, { status: 'ready' }>): PremiumFigures {
  let peak = view.months[0] ?? null;
  for (const month of view.months) {
    if (peak === null || month.seconds > peak.seconds) peak = month;
  }
  return {
    monthsWithGrants: view.months.length,
    spanMonths: view.lastMonth - view.firstMonth + 1,
    totalSeconds: view.totalSeconds,
    grants: view.grants,
    // A `ready` view has at least one month — it exists because at least one
    // row was usable — so the fallbacks are unreachable in practice. They are
    // here so a hand-built view cannot make this function throw inside a
    // render, which is the failure mode 05-07's `no throwing on this path`
    // rule exists to prevent.
    peakMonth: peak?.month ?? view.firstMonth,
    peakSeconds: peak?.seconds ?? 0,
  };
}

/**
 * One chart's geometry input and the EXACT maximum its axis is scaled to.
 *
 * Two values rather than one, and the second is the reason this function
 * exists at all. `BarChartInput` carries plain numbers because a bar height is
 * measured in pixels, so the model's `domainMax` is a float — and the y-axis
 * top label is that float in COMPACT form. A domain of 1,030,000 prints as
 * `1M`, so a `<title>` built from the float would name 1,000,000 as the exact
 * maximum of a chart whose largest month is 1,030,000 (D-25). Carrying the
 * exact micro-unit `bigint` beside the input is what lets the axis state the
 * real figure, and it costs one comparison per month.
 */
export interface CurrencyChartInput {
  /** The bar model's own input: the span, and the SPARSE months that have flow. */
  input: BarChartInput;
  /** The larger of the largest deposit month and the largest withdrawal month. */
  domainMaxUnits: bigint;
  /** The axis's TOP extent, exactly: the room the plot gives the deposits. */
  domainUpUnits: bigint;
  /** The axis's BOTTOM extent, exactly: the room the plot gives the withdrawals. */
  domainDownUnits: bigint;
}

/**
 * A currency entry as one diverging monthly chart's input (D-15, D-17).
 *
 * ## Why the exact extents rather than the model's
 * `buildBarChartModel` already computes `domainUp` and `domainDown`, and they
 * are right for GEOMETRY. They are wrong for the axis LABELS, which need the
 * exact figure: they are floats, and the label is that float in COMPACT form.
 * So this function computes the extents again in `bigint` — from the same
 * maxima, under the same `CURRENCY_MIN_SIDE_DIVISOR` the model divides its plot
 * by — and the component LABELS the axis from these while the model draws from
 * its own.
 *
 * ## Why a month with no operations still carries a zero
 * The worker's month list is SPARSE and holds every month the currency had a
 * USABLE operation in. Since an `income` is money up (D-18), a month appears
 * in the input with `up: 0, down: 0` only when all of its operations carry a
 * ZERO amount; the bar model then draws a hairline cell for it rather than
 * treating it as a gap. The distinction is the one D-17 draws: "in this month,
 * nothing moved" and "this month is not in the export" are different facts, and
 * only the first can be told from the second on a bar chart.
 *
 * ## Why a value that will not parse reads as zero
 * `parseUnitsString` is the trust boundary at the DISPLAY edge. The worker
 * already excluded a row it could not read, so a sum that does not parse here
 * is a corrupted stored value rather than a missing one — and the honest answer
 * is a zero bar in a chart whose other months are real, not an exception thrown
 * inside a render. A `NaN` height would be the worst of the three outcomes: a
 * silently missing bar with no count to show for it.
 */
export function currencyChartInput(entry: CurrencyEntry): CurrencyChartInput {
  const months: { month: number; up: number; down: number }[] = [];
  let maxIn = 0n;
  let maxOut = 0n;

  for (const month of entry.months) {
    const inUnits = parseUnitsString(month.inUnits) ?? 0n;
    const outUnits = parseUnitsString(month.outUnits) ?? 0n;
    if (inUnits > maxIn) maxIn = inUnits;
    if (outUnits > maxOut) maxOut = outUnits;
    months.push({
      month: month.month,
      up: unitsToNumber(inUnits),
      down: unitsToNumber(outUnits),
    });
  }

  return {
    input: {
      kind: 'currency',
      firstMonth: entry.firstMonth,
      lastMonth: entry.lastMonth,
      months,
    },
    // `domainMaxUnits` is the larger of the two sides' own maxima — what a
    // reader means by "this chart's maximum", and the premium axis label.
    domainMaxUnits: maxIn > maxOut ? maxIn : maxOut,
    // The two AXIS extents, under the model's own quarter rule (D-15, D-17).
    // These are the top and bottom the y-axis is labelled against, so they are
    // not always a month that exists: a deposits-only currency's bottom extent
    // is a quarter of its deposit maximum, and the label names that axis value.
    // Bigint division truncates, so the exact figure is an integer and the
    // model's float extents can differ from it by less than one unit — which is
    // the point of carrying both: the geometry rounds to whole pixels and the
    // label does not round at all.
    domainUpUnits:
      maxIn > maxOut / BigInt(CURRENCY_MIN_SIDE_DIVISOR)
        ? maxIn
        : maxOut / BigInt(CURRENCY_MIN_SIDE_DIVISOR),
    domainDownUnits:
      maxOut > maxIn / BigInt(CURRENCY_MIN_SIDE_DIVISOR)
        ? maxOut
        : maxIn / BigInt(CURRENCY_MIN_SIDE_DIVISOR),
  };
}
