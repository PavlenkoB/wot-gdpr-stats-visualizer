/**
 * Premium, virtual-currency and real-money spend aggregation over the parsed
 * rows of a payments-era export (phase 05, plan 05-04).
 *
 * ## Why this module exists
 *
 * Every number the Financial_data section draws is produced here, by pure
 * functions over header-keyed rows. Nothing in this file touches a worker
 * global, the DOM, a clock or the network: the same functions run under Node in
 * a unit test against a hand-derived answer key and inside the ingest worker
 * against a real export, so an answer that is wrong is wrong in one place and
 * fails in seconds rather than in a browser run hours later.
 *
 * ## The three rules that shape every builder here
 *
 * 1. **A row is excluded, never guessed at** (D-03). A cell that cannot be read
 *    — a duration this module does not recognise, a date with no calendar day, an
 *    amount that is not a number, a status that is neither PAID, FAILED nor NEW
 *    — leaves every total and every chart, and lands in a COUNT the card shows
 *    in an amber pill. Silently dropping such a row would make a broken export
 *    look like a small one.
 *
 * 2. **Money is exact.** Amounts are parsed to `bigint` micro-units at scale 6
 *    and summed as integers; the sums cross the message boundary as decimal
 *    strings (see `finance-shared.ts`). No binary floating point ever holds a
 *    money value here, and the single half-away rounding happens once, at
 *    display, in `decimal.ts` (D-24, D-25, T-05-10).
 *
 * 3. **A builder reads the columns it names, and no others** (T-05-11). Each
 *    builder resolves its columns BY NAME from the first row's keys and then
 *    reads values through those keys, so `ORDER_UUID`, `PAY_COUPON_NAME`,
 *    `PAY_AGGREGATOR_DESC`, `AA_PACKAGE_LIST`, the currency `ORDER` column and
 *    the premium `UPDATED` column cannot reach a view even by accident. The
 *    premium `CURR_PREMIUM` column is the one name that IS read for a
 *    decision rather than a figure: a real export writes the premium
 *    operation's datetime there, and only the MONTH INTEGER derived from it is
 *    kept — its raw text never crosses into a view (T-05-54). There is
 *    deliberately no "pass the whole row" helper here for an identifying value
 *    to slip through, and the unit test proves it with rows that record every
 *    key read.
 *
 * ## Dates
 *
 * `monthOfTimestamp` reuses `parseSessionTimestamp` and `civilFromDays` rather
 * than parsing a third time, so both export shapes (ISO, and the dotted
 * day-first session shape of the same export family) are range-checked by the
 * one calendar check the app already has, and no value here is ever routed
 * through an instant (D-01, RESEARCH Pitfall 14). A year outside
 * [MIN_MONTH_YEAR, MAX_MONTH_YEAR] is null, which bounds a chart's month axis
 * at 1,572 months no matter what one cell claims (T-05-08).
 *
 * ## Hostile input
 *
 * Every pattern below is anchored with no nested quantifier, and every string
 * read out of a cell is length-checked before a pattern runs, so a 5,000-byte
 * cell costs a length comparison and not a backtracking stall (T-05-07). Every
 * grouping is a `Map`, so a currency code or game code of `__proto__` is an
 * ordinary group and writes nothing onto `Object.prototype` (T-05-09).
 *
 * ## Nothing here combines currencies
 *
 * No function in this file returns a figure that spans two currencies (FINANCE-03,
 * D-24). The unit-less group — orders whose `PAYMENT_CURRENCY` is not exactly
 * three letters — is explicitly NOT a currency: it is its own card, it sorts
 * last, and it carries a caption saying its amount has no unit. A blended total
 * would be a number that means nothing.
 *
 * Decisions: D-15..D-18 (currency flow), D-19/D-20 (premium time), D-21..D-24
 * (real-money spend), D-25 (formatting), D-17 (monthly buckets).
 * Threats: T-05-07..T-05-11.
 */

import { cell, headerKey } from './csv-columns.ts';
import { civilFromDays } from '../civil-date';
import { parseDecimalUnits } from '../decimal';
import { parseSessionTimestamp } from './playtime';
import {
  CHART_MAX,
  CHART_MIN_OPS,
  MAX_LISTED_UNRECOGNISED,
  MAX_MONTH_YEAR,
  MAX_STORED_STRING,
  MAX_TOOLTIP_SIZES,
  MIN_MONTH_YEAR,
  monthIndex,
  type CurrencyEntry,
  type CurrencyView,
  type FinanceRow,
  type OtherCurrency,
  type PremiumMonth,
  type SpendCard,
  type SpendGame,
  type SpendView,
  type SpendYear,
  type PremiumView,
  type PremiumSize,
  SECONDS_PER_DAY,
} from '../finance-shared';

/**
 * The most DISTINCT unrecognised strings are tracked; past that, occurrences are
 * counted and nothing more is kept (a planner assumption, and the bound that
 * stops a corrupt premium column from filling memory with one string per row).
 */
const MAX_TRACKED_UNRECOGNISED = 1_000;

// ---------------------------------------------------------------------------
// Premium durations
// ---------------------------------------------------------------------------

/**
 * A whole number of days, with the word the export writes: `1 day`, `9 days`.
 *
 * `\d{1,9}` bounds the digits so a hostile cell cannot reach a huge multiplier,
 * and a COUNT OF ZERO IS REFUSED: `0 days` is a premium grant of no time, and
 * bucketing it would draw a month whose only "grant" is nothing. The
 * independent oracle reads the same rule, so the two agree on it.
 */
const DAYS_RE = /^([1-9]\d{0,8}) days?$/;

/**
 * A day count followed by a clock: `2 days 12:00:00`.
 *
 * The clock is range-checked at the call site, because a pattern cannot say
 * "under 24" without a quantifier the anchored form would rather not have.
 */
const DAYS_CLOCK_RE = /^([1-9]\d{0,8}) days? (\d{1,2}):(\d{2}):(\d{2})$/;

/**
 * A machine-written operation row: the word `deposit` or `withdrawal`, two
 * single tokens naming the product and the pack, a count and the word `sec`.
 *
 * The two middle tokens are bounded and single-token on purpose — they are
 * names we do not interpret, and a string with a space in it is not this shape.
 */
const OP_SEC_RE = /^(deposit|withdrawal) \S{1,32} \S{1,32} (\d{1,12}) sec$/;

/** What one `PREMIUM` cell says, once read. */
export type PremiumParse =
  { kind: 'grant'; seconds: number } | { kind: 'removal' } | { kind: 'unrecognised' };

/**
 * Read one `PREMIUM` duration cell as a grant, a removal, or nothing usable.
 *
 * The accepted shapes are exactly the ones the real sample carries:
 *
 *   `1 day`                                        -> grant 86,400 s
 *   `30 days`                                      -> grant 2,592,000 s
 *   `2 days 12:00:00`                              -> grant 216,000 s
 *   `deposit WOT premium_plus 86400 sec ` (trimmed)-> grant 86,400 s
 *   `withdrawal WOT premium_plus 86400 sec `       -> REMOVAL
 *   `premium forever`, a blank, anything else       -> unrecognised
 *
 * Seconds, never days: `999999 sec` is 11.574... days, and a float sum of such
 * values drifts. The conversion to days happens once, for display.
 *
 * A REMOVAL is neither a grant nor a subtraction. `withdrawal` records that
 * premium left the account, and subtracting it from the month it left would
 * make a chart claim a month lost time the account never gained (the user's
 * answer 1, refining D-19). It is excluded, counted, and its text listed with
 * the unrecognised strings, which is what the disclosure in UI-SPEC section 4
 * is for.
 *
 * The length check runs BEFORE any pattern, so a 5,000-byte cell is rejected
 * by a comparison rather than by three regexes (T-05-07).
 */
export function parsePremium(raw: string | undefined): PremiumParse {
  const text = (raw ?? '').trim();
  if (text.length === 0 || text.length > MAX_STORED_STRING) return { kind: 'unrecognised' };

  const days = DAYS_RE.exec(text);
  if (days !== null) return { kind: 'grant', seconds: Number(days[1]) * SECONDS_PER_DAY };

  const withClock = DAYS_CLOCK_RE.exec(text);
  if (withClock !== null) {
    const hours = Number(withClock[2]);
    const minutes = Number(withClock[3]);
    const seconds = Number(withClock[4]);
    if (hours < 24 && minutes < 60 && seconds < 60) {
      return {
        kind: 'grant',
        seconds: Number(withClock[1]) * SECONDS_PER_DAY + hours * 3_600 + minutes * 60 + seconds,
      };
    }
    return { kind: 'unrecognised' };
  }

  const operation = OP_SEC_RE.exec(text);
  if (operation !== null) {
    // The `sec` shape is a machine-written counter, so zero is read as written
    // rather than refused: it moves no time, and the oracle reads it the same
    // way, so the two agree on the fixture sets.
    return operation[1] === 'deposit'
      ? { kind: 'grant', seconds: Number(operation[2]) }
      : { kind: 'removal' };
  }

  return { kind: 'unrecognised' };
}

/**
 * The month key a premium operation's timestamp falls in, or null when it
 * cannot be read.
 *
 * Null covers all four ways a row can fail to be bucketed: a missing cell, a
 * shape the parser does not know, a date with no calendar day such as
 * `2019-04-31`, and a year outside the plausible-date window. The caller counts
 * such a row as excluded and does not list its premium text, because a row
 * dropped for its DATE says nothing about its duration (the user's answer 2).
 *
 * The day number is floored before the civil conversion, so a timestamp in the
 * evening of the last day of a month belongs to THAT month rather than to the
 * next one, and no value is ever routed through an instant (D-01).
 */
export function monthOfTimestamp(raw: string | undefined): number | null {
  const seconds = parseSessionTimestamp(raw);
  if (seconds === null) return null;
  const { y, m } = civilFromDays(Math.floor(seconds / SECONDS_PER_DAY));
  if (y < MIN_MONTH_YEAR || y > MAX_MONTH_YEAR) return null;
  return monthIndex(y, m);
}

// ---------------------------------------------------------------------------
// Column resolution
// ---------------------------------------------------------------------------

/**
 * Resolve column names against the KEYS of one row, first match wins.
 *
 * The key list is walked ONCE for the whole set, which is both the cheaper shape
 * and the one the privacy canary checks: a builder that enumerated a row's keys
 * per column would enumerate them once per column, and a builder that enumerated
 * them per ROW would be doing work a 50,000-row file should not do (T-05-11).
 *
 * Only the first row of a file is ever inspected, so a ragged later row — a real
 * export quirk, and `parseCsvFile` preserves it — cannot change which column is
 * which. Each returned value is the ACTUAL key string, not the normalised one, so
 * values are read by direct property access on the key the file really wrote and
 * a padded or oddly-cased header works (the same rule as
 * `resolveSessionColumns` in `playtime.ts`).
 */
function resolveColumns<const N extends readonly string[]>(
  row: FinanceRow,
  names: N,
): { [K in N[number]]: string | null } {
  const resolved = Object.fromEntries(names.map((name) => [name, null])) as Record<
    string,
    string | null
  >;
  for (const key of Object.keys(row)) {
    const normalized = headerKey(key);
    for (const name of names) {
      if (resolved[name] === null && normalized === name) resolved[name] = key;
    }
  }
  return resolved as { [K in N[number]]: string | null };
}

/** Plain code-unit order: case-sensitive, and independent of any locale. */
function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// buildPremium
// ---------------------------------------------------------------------------

/** One month's accumulating grant totals. */
interface PremiumBucket {
  seconds: number;
  grants: number;
  /** Distinct grant size to how many grants used it. */
  sizes: Map<number, number>;
}

/**
 * Rank the distinct grant sizes of one month for its tooltip: most frequent
 * first, ties by size ASCENDING, at most {@link MAX_TOOLTIP_SIZES}, with the
 * rest counted rather than dropped.
 *
 * Ties break on the smaller size because a month of four one-off sizes should
 * lead with the everyday ones; a month of one single size is unaffected either
 * way, and no locale is involved.
 */
function rankSizes(sizes: ReadonlyMap<number, number>): {
  sizes: PremiumSize[];
  moreSizes: number;
} {
  const ranked = [...sizes.entries()]
    .map(([seconds, count]): PremiumSize => [seconds, count])
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return {
    sizes: ranked.slice(0, MAX_TOOLTIP_SIZES),
    moreSizes: Math.max(0, ranked.length - MAX_TOOLTIP_SIZES),
  };
}

/**
 * The column that dates a WHOLE premium file: the premium operation's own
 * timestamp when at least one row carries a readable one there, and `CREATED`
 * otherwise.
 *
 * In a real export the two are not interchangeable. `CURR_PREMIUM` holds the
 * moment the premium was granted, while `CREATED` and `UPDATED` are equal to
 * each other and carry one bulk-migration stamp shared by many rows — 18 rows on
 * one day and 16 on another across the user's 128-row file. Dating by `CREATED`
 * therefore collapsed a whole history onto a single meaningless month
 * (UAT G-05-3), which is what D-19 as amended corrects: the INTENT — a month of
 * premium days GRANTED — is unchanged, and only the column is.
 *
 * **The choice is per FILE, never per row.** A per-row fallback would quietly
 * bucket a row whose premium timestamp is unreadable onto its perfectly valid
 * bulk `CREATED`, inventing a grant month out of a migration stamp — the exact
 * failure the gap reports, in a smaller disguise. So the rule is decided once,
 * and inside a `CURR_PREMIUM`-dated file an unreadable cell excludes and counts
 * its row exactly as an unreadable `CREATED` always has (D-20).
 */
function premiumDateColumn(
  rows: readonly FinanceRow[],
  columns: {
    CURR_PREMIUM: string | null;
    CREATED: string | null;
  },
): string | null {
  if (columns.CURR_PREMIUM !== null) {
    for (const row of rows) {
      // Stop at the FIRST readable row: the answer is a property of the file,
      // and one pass over a file that has one is cheaper than reading every
      // cell of a file that has none.
      if (monthOfTimestamp(cell(row, columns.CURR_PREMIUM)) !== null) return columns.CURR_PREMIUM;
    }
  }
  return columns.CREATED;
}

/**
 * Aggregate the premium-time view from one import's
 * `Operations_with_Premium_Days.csv` rows.
 *
 * `seen` is whether the FILE was in the export, which is a different question
 * from whether it held any rows: a missing file is `not-in-export` and a header-
 * only one is `no-rows`, and the two draw different copy.
 *
 * `PREMIUM` and one date column are read — see {@link premiumDateColumn} for
 * which date, and why it is decided per file (D-19 as amended by UAT G-05-3,
 * D-20). `CURR_PREMIUM` is read only through `monthOfTimestamp` and only the
 * month integer survives; `UPDATED` is never read at all (T-05-11, T-05-54).
 *
 * A row is excluded when its date cannot be bucketed, when its value is a
 * removal, or when its value is an unrecognised non-blank string. A blank value
 * is excluded and lists nothing, because a blank cell has no text to disclose.
 * Every excluded value's string is clamped and tracked, so the disclosure in
 * UI-SPEC section 4 can name what could not be read.
 */
export function buildPremium(rows: readonly FinanceRow[], seen: boolean): PremiumView {
  if (!seen) return { status: 'not-in-export' };
  if (rows.length === 0) return { status: 'no-rows' };

  // Resolved ONCE, from the first row: a later row's keys cannot remap a
  // column, and the key list is read for this row only.
  const first = rows[0]!;
  const columns = resolveColumns(first, ['PREMIUM', 'CURR_PREMIUM', 'CREATED']);
  const dateKey = premiumDateColumn(rows, columns);

  const buckets = new Map<number, PremiumBucket>();
  // T-05-09: a `Map`, so a premium value of `__proto__` is an ordinary entry.
  const unrecognised = new Map<string, number>();
  let unrecognisedTotal = 0;
  let grants = 0;
  let excluded = 0;
  let totalSeconds = 0;

  for (const row of rows) {
    // The DATE is read first: a row that cannot be bucketed contributes nothing
    // to any chart, and saying so is the whole of its exclusion — its premium
    // text is perfectly fine and is not the thing that went wrong. It is read
    // from the ONE date column chosen for this file, so an unreadable grant
    // timestamp is never quietly replaced by the bulk `CREATED` stamp.
    const month = monthOfTimestamp(cell(row, dateKey));
    if (month === null) {
      excluded += 1;
      continue;
    }

    const raw = cell(row, columns.PREMIUM);
    const parsed = parsePremium(raw);
    if (parsed.kind !== 'grant') {
      excluded += 1;
      const text = (raw ?? '').trim();
      if (text !== '') {
        unrecognisedTotal += 1;
        if (unrecognised.size < MAX_TRACKED_UNRECOGNISED) {
          const clamped = text.slice(0, MAX_STORED_STRING);
          unrecognised.set(clamped, (unrecognised.get(clamped) ?? 0) + 1);
        }
      }
      continue;
    }

    grants += 1;
    totalSeconds += parsed.seconds;
    const bucket = buckets.get(month) ?? {
      seconds: 0,
      grants: 0,
      sizes: new Map<number, number>(),
    };
    bucket.seconds += parsed.seconds;
    bucket.grants += 1;
    bucket.sizes.set(parsed.seconds, (bucket.sizes.get(parsed.seconds) ?? 0) + 1);
    buckets.set(month, bucket);
  }

  // The disclosure order: most frequent first, ties by code units, at most
  // MAX_LISTED_UNRECOGNISED, with the number of occurrences the list does NOT
  // account for beside it. Counting OCCURRENCES rather than distinct strings is
  // what makes the figure honest past the tracking cap, where the distinct
  // count is a lower bound.
  const listed = [...unrecognised.entries()]
    .map(([value, count]): [string, number] => [value, count])
    .sort((a, b) => b[1] - a[1] || compareCodeUnits(a[0], b[0]));
  const unrecognisedStrings = listed.slice(0, MAX_LISTED_UNRECOGNISED).map(([value]) => value);
  const unrecognisedMore =
    unrecognisedTotal -
    listed.slice(0, MAX_LISTED_UNRECOGNISED).reduce((sum, [, count]) => sum + count, 0);

  if (grants === 0) {
    return { status: 'no-usable', excluded, unrecognised: unrecognisedStrings, unrecognisedMore };
  }

  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const months: PremiumMonth[] = keys.map((key) => {
    const bucket = buckets.get(key)!;
    const { sizes, moreSizes } = rankSizes(bucket.sizes);
    return { month: key, seconds: bucket.seconds, grants: bucket.grants, sizes, moreSizes };
  });

  return {
    status: 'ready',
    firstMonth: keys[0]!,
    lastMonth: keys[keys.length - 1]!,
    months,
    totalSeconds,
    grants,
    excluded,
    unrecognised: unrecognisedStrings,
    unrecognisedMore,
  };
}

// ---------------------------------------------------------------------------
// buildCurrency
// ---------------------------------------------------------------------------

/** A currency's accumulating flow. Every sum is a `bigint` in micro-units. */
interface CurrencyBucket {
  ops: number;
  inUnits: bigint;
  outUnits: bigint;
  firstMonth: number;
  lastMonth: number;
  /** The first non-blank title seen; the export leaves some codes untitled. */
  title: string | null;
  /** Month to that month's two sums and two operation counts. */
  months: Map<number, { inUnits: bigint; outUnits: bigint; inOps: number; outOps: number }>;
}

/**
 * The `CURRENCY_CODE` a row carries, exactly as written, or null for a blank.
 *
 * **No case folding, ever** (D-15, D-21). A currency code is an opaque
 * identifier the export chose, and folding it would merge two codes the export
 * never claimed were one — `USD` and `usd` are two groups with two totals. The
 * ordering rules downstream therefore compare code UNITS and never a
 * locale-aware collation, so two people looking at one export see one order.
 *
 * Clamped to {@link MAX_STORED_STRING}: a code is a label, and a corrupt cell
 * is truncated where it is read rather than carried into a DOM (RESEARCH
 * Pitfall 13).
 */
export function currencyCodeOf(raw: string | undefined): string | null {
  const text = (raw ?? '').trim();
  return text === '' ? null : text.slice(0, MAX_STORED_STRING);
}

/**
 * Rank currency groups: operation count descending, then code ascending in
 * plain code-unit order, with a BLANK code last among ties.
 *
 * The blank-last rule is a tie-break only, and deliberately weaker than the
 * spend card's: a blank code still earns its place by how much it moved, so it
 * is listed after a recorded code of the same size and before one with fewer
 * operations. (The unit-less SPEND group is last unconditionally — see
 * `buildSpend` — because a group that is explicitly not a currency must never
 * sit among currency cards.)
 */
function compareCurrencyBuckets(
  a: { code: string | null; ops: number },
  b: { code: string | null; ops: number },
): number {
  if (a.ops !== b.ops) return b.ops - a.ops;
  if (a.code === null || b.code === null) {
    if (a.code === b.code) return 0;
    return a.code === null ? 1 : -1;
  }
  return compareCodeUnits(a.code, b.code);
}

/**
 * Aggregate the virtual-currency flow view from one import's
 * `Virtual_Currencies_Operations.csv` rows.
 *
 * Direction comes from `TYPE` alone (D-18): `deposit` and `income` are both up
 * and are totalled together, `withdrawal` is down, and any other value — the
 * sample contains `refund` rows, which are neither a direction the export
 * documents nor money the account spent on the store — excludes the row from
 * every chart and every total. Every usable operation therefore lands in
 * exactly one of the two sums: an income is money the account received, so
 * leaving it out of both would report "Deposited 0" for a currency whose rows
 * are all incomes (UAT G-05-4).
 *
 * An `AMOUNT` that will not parse, is negative, or sits on a `CREATED` that
 * cannot be bucketed excludes the row too, and each exclusion is counted for
 * the amber pill rather than dropped (D-03).
 *
 * The `ORDER` column is a per-operation order reference — a personal identifier
 * — and is never resolved here, so it cannot reach a view even by accident
 * (T-05-11). Neither is `CURRENCY_TITLE` a total: it is the first non-blank
 * title seen, used as a label, and never as a key.
 */
export function buildCurrency(rows: readonly FinanceRow[], seen: boolean): CurrencyView {
  if (!seen) return { status: 'not-in-export' };
  if (rows.length === 0) return { status: 'no-rows' };

  // Resolved ONCE, from the first row: a later row's keys cannot remap a
  // column, and the key list is read for this row only (T-05-11).
  const first = rows[0]!;
  const columns = resolveColumns(first, [
    'CREATED',
    'CURRENCY_CODE',
    'CURRENCY_TITLE',
    'AMOUNT',
    'TYPE',
  ]);

  // T-05-09: a `Map`, so a code of `__proto__` is an ordinary group and writes
  // nothing onto `Object.prototype`.
  const groups = new Map<string | null, CurrencyBucket>();
  let excluded = 0;

  for (const row of rows) {
    const direction = (cell(row, columns.TYPE) ?? '').trim().toLowerCase();
    if (direction !== 'deposit' && direction !== 'income' && direction !== 'withdrawal') {
      excluded += 1;
      continue;
    }
    const amount = parseDecimalUnits(cell(row, columns.AMOUNT));
    // A negative amount contradicts its own TYPE: direction comes from TYPE, so
    // a negative is an export integrity problem rather than money moving the
    // other way, and a chart that drew a negative deposit downwards would be
    // worse than a counted exclusion.
    if (amount === null || amount < 0n) {
      excluded += 1;
      continue;
    }
    const month = monthOfTimestamp(cell(row, columns.CREATED));
    if (month === null) {
      excluded += 1;
      continue;
    }

    const code = currencyCodeOf(cell(row, columns.CURRENCY_CODE));
    const bucket = groups.get(code) ?? {
      ops: 0,
      inUnits: 0n,
      outUnits: 0n,
      firstMonth: month,
      lastMonth: month,
      title: null,
      months: new Map(),
    };
    bucket.ops += 1;
    if (month < bucket.firstMonth) bucket.firstMonth = month;
    if (month > bucket.lastMonth) bucket.lastMonth = month;
    if (bucket.title === null) {
      // A title is a LABEL: the export leaves some codes untitled, so the first
      // non-blank one wins and no code is left without a caption it can carry.
      const title = (cell(row, columns.CURRENCY_TITLE) ?? '').trim();
      if (title !== '') bucket.title = title.slice(0, MAX_STORED_STRING);
    }
    const monthBucket = bucket.months.get(month) ?? {
      inUnits: 0n,
      outUnits: 0n,
      inOps: 0,
      outOps: 0,
    };
    if (direction === 'withdrawal') {
      bucket.outUnits += amount;
      monthBucket.outUnits += amount;
      monthBucket.outOps += 1;
    } else {
      // `deposit` AND `income` are both up (D-18). The type test above already
      // refused every other value, so this arm can only ever be one of the two.
      bucket.inUnits += amount;
      monthBucket.inUnits += amount;
      monthBucket.inOps += 1;
    }
    // Every usable operation therefore sits in EXACTLY ONE direction, so a
    // month's `inOps + outOps` adds back to the month's operation count and a
    // currency's months add back to `ops`. That is what lets a month of nothing
    // but incomes read as a month with operations rather than an empty one.
    bucket.months.set(month, monthBucket);
    groups.set(code, bucket);
  }

  if (groups.size === 0) return { status: 'no-usable', excluded };

  const ranked = [...groups.entries()]
    .map(([code, bucket]): { code: string | null; ops: number; bucket: CurrencyBucket } => ({
      code,
      ops: bucket.ops,
      bucket,
    }))
    .sort(compareCurrencyBuckets);

  const charts: CurrencyEntry[] = [];
  const others: OtherCurrency[] = [];
  for (const { code, bucket } of ranked) {
    if (charts.length < CHART_MAX && bucket.ops >= CHART_MIN_OPS) {
      charts.push({
        code,
        title: bucket.title,
        ops: bucket.ops,
        // `toString`, never a number: the sum crosses the message boundary as
        // an exact decimal string (T-05-10).
        inUnits: bucket.inUnits.toString(),
        outUnits: bucket.outUnits.toString(),
        firstMonth: bucket.firstMonth,
        lastMonth: bucket.lastMonth,
        // SPARSE and ascending, so the chart walks it in order and fills the
        // gaps itself — a gap in a history is a gap the reader can see.
        months: [...bucket.months.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([month, values]) => ({
            month,
            inUnits: values.inUnits.toString(),
            outUnits: values.outUnits.toString(),
            inOps: values.inOps,
            outOps: values.outOps,
          })),
      });
      continue;
    }
    // Everything else is LISTED, including a code beyond the cap and a code
    // below the threshold: the cap hides a bar chart, never a currency (D-16).
    others.push({
      code,
      ops: bucket.ops,
      inUnits: bucket.inUnits.toString(),
      outUnits: bucket.outUnits.toString(),
      firstMonth: bucket.firstMonth,
      lastMonth: bucket.lastMonth,
    });
  }

  return { status: 'ready', excluded, charts, others };
}

// ---------------------------------------------------------------------------
// buildSpend
// ---------------------------------------------------------------------------

/** The three status values the export writes, and the one that means "other". */
const STATUS_PAID = 'PAID';
const STATUS_FAILED = 'FAILED';
const STATUS_NEW = 'NEW';

/** The `IS_GIFT` spellings that mean a gift, in every case (D-22). */
const GIFT_VALUES = new Set(['1', 'T', 'TRUE']);

/**
 * The game code a blank `GAME_CODE` is ranked and drawn as.
 *
 * The label lives here rather than in the copy layer because it is also the
 * ORDER key: a breakdown table the reader sees as `(not recorded), WOT` must be
 * the table that was sorted that way, and ranking on `null` instead would put
 * the unreadable row last while the card draws it first. It is a comparison
 * value only — grouping stays keyed on `null`, so a file whose `GAME_CODE`
 * literally reads `(not recorded)` is still its own row and cannot collide.
 */
const UNKNOWN_GAME_LABEL = '(not recorded)';

/**
 * The Map key for the unit-less group.
 *
 * A `symbol`, not a sentinel string: a code is either exactly three letters or
 * it is not a code, so any string sentinel would do — but a symbol cannot
 * collide with anything a cell can hold, and the plan for the unit-less group
 * is that it stays distinguishable from every currency for good (T-05-09).
 */
const UNIT_LESS = Symbol('unit-less-currency');

/** One currency's accumulating spend totals. Every sum is a `bigint`. */
interface SpendBucket {
  code: string | null;
  paid: number;
  units: bigint;
  failed: number;
  new: number;
  other: number;
  gifts: number;
  giftUnits: bigint;
  excluded: number;
  years: Map<string | null, { paid: number; units: bigint }>;
  games: Map<string | null, { paid: number; units: bigint }>;
}

/**
 * The currency an order belongs to, or null for the unit-less group.
 *
 * Exactly three ASCII letters, upper or lower, or nothing (D-21). The
 * twelve-column header has no other currency column, so a blank cell and a
 * two-letter code both land here — and a group that is not a currency must not
 * be drawn among currency cards, so it gets its own card, its own caption and
 * the last position in the list.
 *
 * **Case is never folded.** `usd` and `USD` are two cards, each shown as
 * written, because the export never claimed they are one currency and this
 * viewer never converts between them (FINANCE-03).
 */
export function spendCurrencyOf(raw: string | undefined): string | null {
  const text = (raw ?? '').trim();
  return /^[A-Za-z]{3}$/.test(text) ? text : null;
}

/**
 * Whether an order was a gift, in every spelling the export and its own readme
 * disagree on (D-22).
 *
 * The readme says `T`/`F`, the real sample writes `1`/`0`, and a drifted export
 * could write the word. All of `1`, `T` and `TRUE` in any case are a gift, and
 * everything else — including `F`, `false`, a blank and anything this function
 * has never seen — is not. A drifted spelling must not crash the card and must
 * not quietly flip a gift into a purchase, so the default is `false`.
 */
export function parseGiftFlag(raw: string | undefined): boolean {
  return GIFT_VALUES.has((raw ?? '').trim().toUpperCase());
}

/** The year an `ACTION_DT` claims, or null when its first four characters are not digits. */
function yearOfActionDt(raw: string | undefined): string | null {
  const head = (raw ?? '').trim().slice(0, 4);
  return /^\d{4}$/.test(head) ? head : null;
}

/** Years newest first, with the unreadable one last. */
function compareYears(a: string | null, b: string | null): number {
  if (a === null || b === null) {
    if (a === b) return 0;
    return a === null ? 1 : -1;
  }
  return compareCodeUnits(b, a);
}

/** The unit-less card LAST, always; then paid orders descending; then code units. */
function compareSpendCards(
  a: { code: string | null; paid: number },
  b: { code: string | null; paid: number },
): number {
  // "Always" is the part that matters, and it is deliberately STRONGER than the
  // currency list's blank-code rule. A blank CURRENCY_CODE still earns its place
  // by how much it moved, so there the blank-last rule only breaks ties; a group
  // that is explicitly NOT a currency must never sit in the middle of the
  // currency cards where a reader would read it as one (D-24).
  if (a.code === null || b.code === null) {
    if (a.code === b.code) return 0;
    return a.code === null ? 1 : -1;
  }
  if (a.paid !== b.paid) return b.paid - a.paid;
  return compareCodeUnits(a.code, b.code);
}

/**
 * Aggregate the real-money spend view from one import's `Orders.csv` rows.
 *
 * **Nothing in here may combine two currencies** (FINANCE-03, D-24). Every
 * figure is a sum over the rows of ONE currency group, and the unit-less group
 * is explicitly not a currency: it is its own card, it sorts last, and the
 * caption above it says the amount has no unit and may mix currencies. A
 * "total spend" across currencies would be a number that means nothing, and it
 * is the one thing this block must never draw.
 *
 * A row counts toward money only when `PAY_ORDER_STATUS_CODE` is exactly `PAID`.
 * `FAILED`, `NEW` and every other value are counted in their own buckets and
 * never added in — a failed order is money the account did not spend, and
 * counting it would make the card disagree with a bank statement (D-21). A PAID
 * row whose amount will not parse is counted as excluded and never estimated
 * (D-03, D-24).
 *
 * The gift line is derived from the INCLUDED paid rows, so its total is a subset
 * of the headline by construction and the two can never disagree.
 *
 * `ACTION_DT` is per-row valid (D-21), so a year is its first four characters
 * and a row whose date cannot be read still counts, under a null year that
 * sorts last. Both breakdowns are VIEWS of the same included paid rows, which
 * is why their exact sums add up to the headline; the tests assert that sum in
 * micro-units rather than in displayed text, because each displayed figure is
 * rounded once for display and two rounded figures can differ from a rounded
 * total by a cent.
 *
 * `ORDER_UUID`, `PAY_COUPON_NAME`, `PAY_AGGREGATOR_DESC`, `PAY_ITEM_TYPE_NAME`
 * and `AA_PACKAGE_LIST` are personal identifiers and are never resolved here, so
 * they cannot reach a view even by accident (T-05-11).
 */
export function buildSpend(rows: readonly FinanceRow[]): SpendView {
  // Resolved ONCE, from the first row (T-05-11).
  const first = rows[0];
  const columns =
    first === undefined
      ? resolveColumns({}, [
          'ACTION_DT',
          'GAME_CODE',
          'PAYMENT_CURRENCY',
          'PAYED_IN_CURR_AMT',
          'IS_GIFT',
          'PAY_ORDER_STATUS_CODE',
        ])
      : resolveColumns(first, [
          'ACTION_DT',
          'GAME_CODE',
          'PAYMENT_CURRENCY',
          'PAYED_IN_CURR_AMT',
          'IS_GIFT',
          'PAY_ORDER_STATUS_CODE',
        ]);

  const cards = new Map<string | typeof UNIT_LESS, SpendBucket>();
  let recognisedStatuses = 0;

  for (const row of rows) {
    const code = spendCurrencyOf(cell(row, columns.PAYMENT_CURRENCY));
    const key = code === null ? UNIT_LESS : code;
    const bucket = cards.get(key) ?? {
      code,
      paid: 0,
      units: 0n,
      failed: 0,
      new: 0,
      other: 0,
      gifts: 0,
      giftUnits: 0n,
      excluded: 0,
      years: new Map(),
      games: new Map(),
    };
    cards.set(key, bucket);

    // Matched exactly as written after trimming: a status the export does not
    // document is a fact the reader is owed, so it is counted rather than
    // dropped or folded into "paid".
    const status = (cell(row, columns.PAY_ORDER_STATUS_CODE) ?? '').trim();
    if (status === STATUS_FAILED) {
      recognisedStatuses += 1;
      bucket.failed += 1;
      continue;
    }
    if (status === STATUS_NEW) {
      recognisedStatuses += 1;
      bucket.new += 1;
      continue;
    }
    if (status !== STATUS_PAID) {
      bucket.other += 1;
      continue;
    }
    recognisedStatuses += 1;

    const amount = parseDecimalUnits(cell(row, columns.PAYED_IN_CURR_AMT));
    if (amount === null || amount < 0n) {
      bucket.excluded += 1;
      continue;
    }

    bucket.paid += 1;
    bucket.units += amount;
    if (parseGiftFlag(cell(row, columns.IS_GIFT))) {
      bucket.gifts += 1;
      bucket.giftUnits += amount;
    }

    const year = yearOfActionDt(cell(row, columns.ACTION_DT));
    const yearBucket = bucket.years.get(year) ?? { paid: 0, units: 0n };
    yearBucket.paid += 1;
    yearBucket.units += amount;
    bucket.years.set(year, yearBucket);

    const gameText = (cell(row, columns.GAME_CODE) ?? '').trim();
    const game = gameText === '' ? null : gameText.slice(0, MAX_STORED_STRING);
    const gameBucket = bucket.games.get(game) ?? { paid: 0, units: 0n };
    gameBucket.paid += 1;
    gameBucket.units += amount;
    bucket.games.set(game, gameBucket);
  }

  if (recognisedStatuses === 0) return { status: 'no-usable' };

  const ranked = [...cards.values()].sort(compareSpendCards);
  return {
    status: 'ready',
    cards: ranked.map((bucket): SpendCard => ({
      code: bucket.code,
      paid: bucket.paid,
      // `toString`, never a number: an exact decimal string crosses the message
      // boundary, so a sum is never a float in transit (T-05-10).
      units: bucket.units.toString(),
      failed: bucket.failed,
      new: bucket.new,
      other: bucket.other,
      gifts: bucket.gifts,
      giftUnits: bucket.giftUnits.toString(),
      excluded: bucket.excluded,
      byYear: [...bucket.years.entries()]
        .map(([year, values]): SpendYear => ({
          year,
          paid: values.paid,
          units: values.units.toString(),
        }))
        .sort((a, b) => compareYears(a.year, b.year)),
      byGame: [...bucket.games.entries()]
        .map(([code, values]): SpendGame => ({
          code,
          paid: values.paid,
          units: values.units.toString(),
        }))
        // Most orders first, then the code the card DRAWS in plain code units —
        // never a locale-aware collation, so two people looking at one export
        // see one table.
        .sort(
          (a, b) =>
            b.paid - a.paid ||
            compareCodeUnits(a.code ?? UNKNOWN_GAME_LABEL, b.code ?? UNKNOWN_GAME_LABEL),
        ),
    })),
  };
}
