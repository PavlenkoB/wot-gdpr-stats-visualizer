/**
 * The finance view contract, shared by the aggregation worker and the page.
 *
 * ## Why this module exists
 *
 * `src/lib/features/finance/finance-aggregate.ts` builds these views inside a Web Worker and
 * `src/lib/` reads them back on the main thread. Anything both sides have to
 * agree on — the shape of a view, the chart threshold, the date window, the
 * month key — therefore has to live in ONE module that both can import.
 *
 * This module has **no imports at all**, and that is load-bearing rather than
 * stylistic: it is what makes it legal for a worker-side module and a
 * page-side module to agree on a number without either of them depending on the
 * other. `grep -c '^import' src/lib/features/finance/finance-shared.ts` printing 0 is the check
 * that keeps it true.
 *
 * ## Why money crosses the boundary as strings
 *
 * Every sum here is an integer count of MICRO-UNITS, carried as a decimal
 * string. A `bigint` cannot be put through `postMessage` structured clone by
 * every engine we care about, and a JSON round trip would turn it into a string
 * anyway; storing the string keeps the exact value and removes the question.
 * Nothing converts to a float until a bar height or a display string is built
 * (see `decimal.ts`).
 *
 * Decisions: D-15..D-18 (currency flow), D-19..D-20 (premium time),
 * D-21..D-24 (real-money spend), D-17 (the monthly buckets).
 */

/** Whole seconds in a day — the unit premium time is summed in (D-19). */
export const SECONDS_PER_DAY = 86_400;

/** One parsed data row of a payments-era export file, keyed by header as written. */
export type FinanceRow = Readonly<Record<string, string | undefined>>;

/**
 * A currency needs at least this many usable operations before it earns a
 * chart (D-16, UI-SPEC section 5).
 *
 * Chosen from the real sample's mix, where the real histories hold thousands of
 * operations and the strays hold one or two: a threshold low enough to keep
 * every real history and high enough that a one-off currency does not get a
 * chart of its own.
 */
export const CHART_MIN_OPS = 50;

/**
 * At most this many currency charts, however many currencies clear the
 * threshold (D-16).
 *
 * A cap rather than a rule about "how many is too many", because it bounds the
 * node count on the page: each chart is `3 × months + 40` SVG nodes over a
 * 20-year history, and a veteran account can hold a dozen real currencies. The
 * codes that do not fit are still listed under Other currencies, so the cap
 * hides a bar chart and never a currency.
 */
export const CHART_MAX = 8;

/**
 * The first year a timestamp may claim (a planner decision, flagged for the
 * user in plan 05-01 and applied in the approved copy by 05-08).
 *
 * Day 0 of the app's calendar is 1970-01-01, so a year before it cannot name a
 * month on the axis at all, and a timestamp that reads as one is a corrupt cell
 * rather than history. Together with {@link MAX_MONTH_YEAR} it bounds the month
 * axis at 1,572 months, which is what stops one crafted cell from becoming a
 * 1,572-column chart (T-05-08).
 */
export const MIN_MONTH_YEAR = 1970;

/** The last year a timestamp may claim. See {@link MIN_MONTH_YEAR} and T-05-08. */
export const MAX_MONTH_YEAR = 2100;

/**
 * Every string lifted out of a zip cell is clamped to this many characters
 * before it is stored, counted or listed (RESEARCH Pitfall 13).
 *
 * The clamp is a bound on what can reach the DOM, not a guess about what a
 * currency title "should" look like: a hostile or corrupt cell is truncated
 * where it is read, and a later plan that needs the rest of the text has to say
 * so explicitly rather than inheriting a megabyte of cell content.
 */
export const MAX_STORED_STRING = 200;

/**
 * At most this many unrecognised premium strings are LISTED, with a count of
 * the rest beside them (D-20, UI-SPEC section 4).
 *
 * A list is a disclosure, not a data dump: a file whose premium column is
 * corrupt in twenty-one different ways should still render a card the width of
 * a card.
 */
export const MAX_LISTED_UNRECOGNISED = 20;

/**
 * How many distinct grant sizes one month's tooltip ships before it counts the
 * rest as `+{k} more sizes` (D-20, UI-SPEC section 4).
 *
 * Three, because that is how many lines the tooltip has room for under the
 * other two it already draws.
 */
export const MAX_TOOLTIP_SIZES = 3;

/**
 * The month bucket key: `year * 12 + month - 1`.
 *
 * Plain integer arithmetic, so a month sorts, ranges and indexes like a number
 * and a chart's axis is a subtraction. Every timestamp is read as the wall clock
 * the export recorded (D-01), so this key never moves with the viewer's zone.
 */
export function monthIndex(year: number, month: number): number {
  return year * 12 + month - 1;
}

/** The exact inverse of {@link monthIndex}: `month` is 1 to 12. */
export function monthParts(index: number): { year: number; month: number } {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** One distinct grant size in a month and how many grants used it. */
export type PremiumSize = readonly [seconds: number, count: number];

/**
 * One usable month of premium time.
 *
 * `months` is SPARSE — only a month with at least one grant is present — and
 * the axis between `firstMonth` and `lastMonth` is filled in by the chart, so
 * a gap in the history is a gap the reader can see (UI-SPEC section 4) rather
 * than a month silently pulled forward.
 */
export interface PremiumMonth {
  month: number;
  /** Premium SECONDS granted, summed in integers (D-19). */
  seconds: number;
  grants: number;
  /** Most frequent first, ties by size ascending, at most three. */
  sizes: readonly PremiumSize[];
  /** How many distinct sizes did not fit, drawn as `+{k} more sizes`. */
  moreSizes: number;
}

/** The premium-time view, one of four shapes. */
export type PremiumView =
  | { status: 'not-in-export' }
  | { status: 'no-rows' }
  | { status: 'no-usable'; excluded: number; unrecognised: string[]; unrecognisedMore: number }
  | {
      status: 'ready';
      firstMonth: number;
      lastMonth: number;
      months: PremiumMonth[];
      totalSeconds: number;
      grants: number;
      excluded: number;
      unrecognised: string[];
      unrecognisedMore: number;
    };

/** One month of a currency's flow. Only months with an operation are present. */
export interface CurrencyMonth {
  month: number;
  /** Micro-unit sums as decimal strings (D-15, D-25). */
  inUnits: string;
  outUnits: string;
  inOps: number;
  outOps: number;
}

/** One charted currency: its own scale, its own axis, its own totals. */
export interface CurrencyEntry {
  /** The code exactly as written; null is the blank-code group. */
  code: string | null;
  /** The first non-blank `CURRENCY_TITLE` seen, or null when the file has none. */
  title: string | null;
  ops: number;
  inUnits: string;
  outUnits: string;
  firstMonth: number;
  lastMonth: number;
  months: CurrencyMonth[];
}

/** One currency that did not earn a chart, listed so no code is dropped (D-16). */
export interface OtherCurrency {
  code: string | null;
  ops: number;
  inUnits: string;
  outUnits: string;
  firstMonth: number;
  lastMonth: number;
}

/** The virtual-currency flow view, one of four shapes. */
export type CurrencyView =
  | { status: 'not-in-export' }
  | { status: 'no-rows' }
  | { status: 'no-usable'; excluded: number }
  | { status: 'ready'; excluded: number; charts: CurrencyEntry[]; others: OtherCurrency[] };

/** One year of paid orders, as a views of the card's included paid rows (D-22). */
export interface SpendYear {
  /** The four digits of `ACTION_DT` as written; null when they are not four digits. */
  year: string | null;
  paid: number;
  units: string;
}

/** One game code of paid orders, as a view of the same included paid rows. */
export interface SpendGame {
  /** The code as written; null is a blank `GAME_CODE`. */
  code: string | null;
  paid: number;
  units: string;
}

/**
 * One currency's spend card.
 *
 * **No field here may ever combine two currencies** (FINANCE-03, D-24). Every
 * figure is a sum over rows of ONE currency group, and the unit-less group is
 * explicitly not a currency at all — it is drawn with a caption saying the
 * amount has no unit, because a code that is not three letters does not name
 * one.
 */
export interface SpendCard {
  /** The code exactly as written; null is the unit-less group. */
  code: string | null;
  /** Included paid orders — the ones that went into `units`. */
  paid: number;
  units: string;
  failed: number;
  new: number;
  /** A status that is neither PAID, FAILED nor NEW. */
  other: number;
  gifts: number;
  giftUnits: string;
  /** PAID orders whose amount could not be read (D-24). */
  excluded: number;
  byYear: SpendYear[];
  byGame: SpendGame[];
}

/** The spend view. There is no `not-in-export`: a missing Orders file is `no-usable`. */
export type SpendView = { status: 'no-usable' } | { status: 'ready'; cards: SpendCard[] };
