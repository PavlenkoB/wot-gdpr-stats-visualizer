// =============================================================================
// The finance oracle (phase 05, plan 05-01, Task 2).
//
// WHY THIS FILE EXISTS
// The finance dashboards (plans 05-04 to 05-09) are checked against hand
// fixtures. Hand fixtures checked only against the implementation that reads
// them prove nothing, because both sides can be wrong in the same direction. So
// this module recomputes every answer from the RAW rows with logic of its own,
// and `tests/unit/finance-fixtures.test.ts` compares the fixture to THIS, never
// to itself.
//
// ORACLE INDEPENDENCE — the hard rule
// This file imports NOTHING from `src/`. It shares no date parser, no money
// parser, no duration parser and no month key with the code it checks. The two
// sides are deliberately written in different shapes:
//
//   date     here: two hand-written regexes, a hand-rolled leap-year table, and
//            a month index that is `year * 12 + month - 1`.
//            the app: `src/lib/finance-shared.ts`'s civil-date helpers.
//   money    here: string splitting into integer THOUSANDTHS, no float parse of
//            the whole literal, no `BigInt`, no `Intl`, and NO two-decimal
//            rendering at all — display formatting belongs to the app's
//            ui-copy (plan 05-08), so an answer key that formatted its own
//            numbers would be asserting the wrong thing.
//   duration here: whitespace TOKEN inspection, not one anchored regex.
//   value    here: plain `Number`. Exact for every magnitude in this phase: the
//            largest generated total is 50,000 rows x 5,000,000 units x 1000
//            thousandths = 2.5e14, and `Number` is exact below 2^53 = 9.007e15.
//
// The fixtures never carry more than three decimal places, so thousandths lose
// nothing; `parseThousandths` REFUSES anything longer rather than rounding it
// silently.
//
// Months are the integer `year * 12 + month - 1` throughout, which is the key
// the app buckets on, so a month in the answer key can be read straight out of
// the export timestamp.
//
// Decisions: D-03 (excluded rows are counted, never guessed at), D-15..D-18,
// D-19..D-20, D-21..D-24.
// =============================================================================

/**
 * One raw row of a payments-era export file, as a header-keyed map of cells.
 *
 * A `Record` rather than a tuple, because the three files have different
 * headers. A cell may be missing entirely — a ragged row is a real export quirk
 * — and every read here treats a missing cell as the empty string, the same
 * defensive stance `parseCsvFile` takes.
 */
export type OracleRow = Readonly<Record<string, string | undefined>>;

/** A cell read defensively: a missing key and an empty cell are one thing. */
function cell(row: OracleRow, name: string): string {
  return row[name] ?? '';
}

// ---------------------------------------------------------------------------
// Dates. String splitting, not `Date`.
// ---------------------------------------------------------------------------

/** A calendar date that survived shape AND calendar validation. */
interface OracleDate {
  year: number;
  month: number;
  day: number;
}

/**
 * The plausible-date window, a planner decision flagged in the plan: a
 * timestamp is readable only when it parses AND its year is between 1970 and
 * 2100 inclusive. The bounds stop one crafted cell from becoming a
 * hundred-thousand-month axis (T-05-08, owned by plan 05-04).
 */
const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

/** Month lengths, with the leap rule written out rather than borrowed. */
function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * Read `YYYY-MM-DD HH:MM[:SS]` or the dotted `DD.MM.YYYY HH:MM[:SS]`, the two
 * shapes the export uses.
 *
 * Returns null — "this row's date is not usable" — for a bad shape, a
 * non-calendar day such as 2019-04-31, a year outside the window, or a time
 * that is not a clock.
 *
 * The caller counts the row as excluded and lists NO duration string for it: a
 * row dropped because of its DATE has nothing to say about its PREMIUM text,
 * which is why the hand fixture's `2019-04-31` row and its `not a date` row
 * are counted but never listed.
 */
function readDate(raw: string): OracleDate | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), iso[4]!, iso[5]!);
  // Day first, month second: 15.07.2019 is 15 July, not 7 March.
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (dotted) {
    return calendarDate(
      Number(dotted[3]),
      Number(dotted[2]),
      Number(dotted[1]),
      dotted[4]!,
      dotted[5]!,
    );
  }
  return null;
}

/** Validate a year/month/day/clock quadruple that already matched a shape. */
function calendarDate(
  year: number,
  month: number,
  day: number,
  hourText: string,
  minuteText: string,
): OracleDate | null {
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (Number(hourText) > 23 || Number(minuteText) > 59) return null;
  return { year, month, day };
}

/**
 * The month bucket key: `year * 12 + month - 1`.
 *
 * Plain integer arithmetic, deliberately not a `Date` millisecond divide, so
 * this file shares no path with whatever the app does to build the same key.
 */
function monthKeyOf(date: OracleDate): number {
  return date.year * 12 + date.month - 1;
}

// ---------------------------------------------------------------------------
// Money. Integer thousandths, by string splitting.
// ---------------------------------------------------------------------------

/**
 * Parse a decimal cell into integer THOUSANDTHS, or null when the cell is not a
 * usable amount.
 *
 *   '1000000' -> 1000000000     '.5' -> 500 (the export writes a leading dot)
 *   '12.5'    -> 12500          'abc' -> null (unparseable)
 *   ''        -> null           '-5'  -> null (see below)
 *
 * A negative amount is null on purpose. An amount that reads as a negative
 * deposit is a data-integrity problem in the export, not money flowing the
 * wrong way, and a chart with an "up" deposit drawn downwards would be worse
 * than a counted exclusion (D-03).
 *
 * More than three decimals is null rather than rounded: no fixture produces
 * one, so a rounding rule here would be untested arithmetic.
 */
function parseThousandths(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const dot = trimmed.indexOf('.');
  const whole = dot === -1 ? trimmed : trimmed.slice(0, dot);
  const fraction = dot === -1 ? '' : trimmed.slice(dot + 1);
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) return null;
  if (whole === '' && fraction === '') return null;
  if (fraction.length > 3) return null;
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
}

// ---------------------------------------------------------------------------
// Premium durations. Token inspection, not one anchored regex.
// ---------------------------------------------------------------------------

/** One second is what every premium duration is ultimately measured in. */
const DAY_SECONDS = 86_400;

/** The tooltip shows three sizes and then counts what it dropped. */
const TOOLTIP_MAX_SIZES = 3;

/** What one `PREMIUM` cell says, once read. */
type OracleGrant =
  | { verdict: 'grant'; seconds: number }
  | { verdict: 'removal' }
  | { verdict: 'unrecognised' }
  | { verdict: 'blank' };

/** A positive whole number of days, as the export writes it: `1 day`, `30 days`. */
function isDayCount(text: string): boolean {
  return /^\d+$/.test(text) && Number(text) > 0;
}

/** `day` or `days`; anything else is not a duration word. */
function isDayWord(text: string): boolean {
  return text === 'day' || text === 'days';
}

/** A clock the export writes after a day count: `12:00:00` or `12:00`. */
function clockSeconds(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) return null;
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (minutes > 59 || seconds > 59) return null;
  return Number(match[1]) * 3600 + minutes * 60 + seconds;
}

/**
 * Read one `PREMIUM` cell.
 *
 * The shapes the research records, each split on whitespace and read as tokens:
 *
 *   `1 day`                                        -> grant 86,400 s
 *   `30 days`                                      -> grant 2,592,000 s
 *   `2 days 12:00:00`                              -> grant 216,000 s
 *   `deposit WOT premium_plus 86400 sec ` (trimmed)-> grant 86,400 s
 *   `withdrawal WOT premium_plus 86400 sec `       -> REMOVAL, excluded
 *   `premium forever`                              -> unrecognised
 *   `` (empty)                                     -> blank, excluded, lists nothing
 *
 * A removal is excluded rather than SUBTRACTED: a withdrawal row records that
 * premium left, and subtracting it from a grant month would make a chart claim
 * a month lost time the account never gained (the user's answer 1, refining
 * D-19). It is counted in the excluded pill and listed with the unrecognised
 * strings, which is what RESEARCH Pitfall 4 requires.
 */
function readGrant(raw: string): OracleGrant {
  const trimmed = raw.trim();
  if (trimmed === '') return { verdict: 'blank' };
  const tokens = trimmed.split(/\s+/);

  if (tokens.length === 2 && isDayCount(tokens[0]!) && isDayWord(tokens[1]!)) {
    return { verdict: 'grant', seconds: Number(tokens[0]) * DAY_SECONDS };
  }
  if (tokens.length === 3 && isDayCount(tokens[0]!) && isDayWord(tokens[1]!)) {
    const clock = clockSeconds(tokens[2]!);
    if (clock !== null) {
      return { verdict: 'grant', seconds: Number(tokens[0]) * DAY_SECONDS + clock };
    }
  }
  if (tokens.length === 5 && /^\d+$/.test(tokens[3]!) && tokens[4] === 'sec') {
    if (tokens[0] === 'deposit') return { verdict: 'grant', seconds: Number(tokens[3]) };
    if (tokens[0] === 'withdrawal') return { verdict: 'removal' };
  }
  return { verdict: 'unrecognised' };
}

// ---------------------------------------------------------------------------
// oraclePremium
// ---------------------------------------------------------------------------

/** One distinct grant size in a month, with how many grants used it. */
export interface OraclePremiumSize {
  seconds: number;
  count: number;
}

/** One usable month of premium time. */
export interface OraclePremiumMonth {
  /** `year * 12 + month - 1`. */
  month: number;
  grants: number;
  seconds: number;
  /** `seconds / 86_400`, so a half day reads 2.5 and not 2.4999999. */
  days: number;
  /**
   * The three sizes the tooltip ships, most frequent first and ties by size
   * ASCENDING — so a month with four one-off sizes drops the largest.
   */
  sizes: OraclePremiumSize[];
  /** How many distinct sizes did not fit, drawn as `+{k} more sizes`. */
  moreSizes: number;
}

/** Everything FINANCE-01 needs, recomputed from raw rows. */
export interface OraclePremium {
  grants: number;
  excluded: number;
  totalSeconds: number;
  totalDays: number;
  /** First and last USABLE month; null when nothing was usable. */
  firstMonth: number | null;
  lastMonth: number | null;
  /** Every month from first to last inclusive, gaps included. */
  axisMonths: number[];
  /** Only the months carrying at least one grant, ascending. */
  months: OraclePremiumMonth[];
  /**
   * Distinct excluded duration strings as written, trimmed, in first-seen
   * order. A blank cell and a row dropped for its DATE contribute nothing.
   */
  unrecognised: string[];
}

/**
 * The column that dates a WHOLE premium file, decided once.
 *
 * `CURR_PREMIUM` when at least one row's cell there reads as a date through
 * {@link readDate}, and `CREATED` otherwise. A file whose header has no
 * `CURR_PREMIUM` at all falls back too, because a missing cell reads as blank
 * and blank is not a date.
 *
 * The rule is per FILE and never per row, on purpose (D-20, UAT G-05-3): a
 * per-row fallback would quietly bucket a row whose premium timestamp is
 * unreadable onto the bulk-migration stamp in `CREATED`, which is precisely the
 * failure the gap reports — a chart of one meaningless month.
 */
function premiumDateColumn(rows: readonly OracleRow[]): string {
  for (const row of rows) {
    if (readDate(cell(row, 'CURR_PREMIUM')) !== null) return 'CURR_PREMIUM';
  }
  return 'CREATED';
}

/**
 * Recompute the premium-time figures from raw
 * `Operations_with_Premium_Days.csv` rows.
 *
 * Month bucketing is by the local-naive timestamp AS RECORDED, with no zone
 * shift (D-01): the export writes none, and converting would invent a month the
 * account was never in.
 *
 * WHICH column carries that timestamp is decided once for the whole file by
 * {@link premiumDateColumn} — `CURR_PREMIUM` in a real export, `CREATED`
 * otherwise (D-19 as amended by UAT G-05-3). Inside a file dated by
 * `CURR_PREMIUM`, a row whose cell cannot be read is excluded and counted and
 * lists nothing; it is NEVER quietly moved onto its `CREATED` (D-20).
 */
export function oraclePremium(rows: readonly OracleRow[]): OraclePremium {
  const byMonth = new Map<
    number,
    { grants: number; seconds: number; sizes: Map<number, number> }
  >();
  const listed = new Set<string>();
  const unrecognised: string[] = [];
  const dateColumn = premiumDateColumn(rows);
  let grants = 0;
  let excluded = 0;

  for (const row of rows) {
    const date = readDate(cell(row, dateColumn));
    if (date === null) {
      excluded += 1;
      continue;
    }
    const grant = readGrant(cell(row, 'PREMIUM'));
    if (grant.verdict !== 'grant') {
      excluded += 1;
      // A removal is excluded because of its VALUE, so its text is listed; a
      // blank cell has no text to list.
      const text = cell(row, 'PREMIUM').trim();
      if (grant.verdict !== 'blank' && text !== '' && !listed.has(text)) {
        listed.add(text);
        unrecognised.push(text);
      }
      continue;
    }
    grants += 1;
    const key = monthKeyOf(date);
    const bucket = byMonth.get(key) ?? { grants: 0, seconds: 0, sizes: new Map<number, number>() };
    bucket.grants += 1;
    bucket.seconds += grant.seconds;
    bucket.sizes.set(grant.seconds, (bucket.sizes.get(grant.seconds) ?? 0) + 1);
    byMonth.set(key, bucket);
  }

  const keys = [...byMonth.keys()].sort((a, b) => a - b);
  const months: OraclePremiumMonth[] = keys.map((key) => {
    const bucket = byMonth.get(key)!;
    const sizes = [...bucket.sizes.entries()]
      .map(([seconds, count]) => ({ seconds, count }))
      .sort((a, b) => b.count - a.count || a.seconds - b.seconds);
    return {
      month: key,
      grants: bucket.grants,
      seconds: bucket.seconds,
      days: bucket.seconds / DAY_SECONDS,
      sizes: sizes.slice(0, TOOLTIP_MAX_SIZES),
      moreSizes: Math.max(0, sizes.length - TOOLTIP_MAX_SIZES),
    };
  });

  const totalSeconds = months.reduce((sum, month) => sum + month.seconds, 0);
  const axisMonths: number[] = [];
  if (keys.length > 0) {
    for (let key = keys[0]!; key <= keys[keys.length - 1]!; key++) axisMonths.push(key);
  }

  return {
    grants,
    excluded,
    totalSeconds,
    totalDays: totalSeconds / DAY_SECONDS,
    firstMonth: keys.length === 0 ? null : keys[0]!,
    lastMonth: keys.length === 0 ? null : keys[keys.length - 1]!,
    axisMonths,
    months,
    unrecognised,
  };
}

// ---------------------------------------------------------------------------
// oracleCurrency
// ---------------------------------------------------------------------------

/** A currency's usable flow, recomputed. */
export interface OracleCurrencyGroup {
  /** The code exactly as written; `''` when the export left it blank. */
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
export interface OracleCurrency {
  usable: number;
  excluded: number;
  charted: OracleCurrencyGroup[];
  others: OracleCurrencyGroup[];
}

/** UI-SPEC section 4: chart a currency from 50 usable operations, at most 8. */
const CHART_MIN_OPERATIONS = 50;
const CHART_MAX = 8;

/**
 * The three `TYPE` values the export writes. Anything else is excluded.
 * `deposit` and `income` are both money coming UP; `withdrawal` is money going
 * down (D-18), so the set is not three peers and the totalling below is not a
 * three-way split either.
 */
const FLOW_TYPES = new Set(['deposit', 'withdrawal', 'income']);

/**
 * Recompute the currency-flow figures from raw `Virtual_Currencies_Operations
 * .csv` rows.
 *
 * A row is usable when its TYPE is one of the three, its AMOUNT is a usable
 * number (see `parseThousandths`) and its CREATED is a usable date. Anything
 * else is counted as excluded and contributes to nothing (D-03).
 *
 * An `income` is money counted UP: it is totalled into the DEPOSITED side
 * exactly as a deposit is (D-18), so a currency whose rows are all incomes
 * reports its whole inflow rather than "Deposited 0".
 *
 * Ordering is operations descending, then code ascending in plain code-unit
 * order with a BLANK CODE LAST — an unrecorded code is listed after recorded
 * ones, the same reason an unknown currency goes last on the spend cards. The
 * blank code still gets an axis and a caption of its own; it is only its place
 * in the LIST that moves.
 */
export function oracleCurrency(rows: readonly OracleRow[]): OracleCurrency {
  const groups = new Map<
    string,
    { operations: number; deposited: number; withdrawn: number; monthKeys: number[] }
  >();
  let usable = 0;
  let excluded = 0;

  for (const row of rows) {
    const date = readDate(cell(row, 'CREATED'));
    const type = cell(row, 'TYPE').trim();
    const amount = parseThousandths(cell(row, 'AMOUNT'));
    if (date === null || amount === null || !FLOW_TYPES.has(type)) {
      excluded += 1;
      continue;
    }
    usable += 1;
    const code = cell(row, 'CURRENCY_CODE');
    const group = groups.get(code) ?? {
      operations: 0,
      deposited: 0,
      withdrawn: 0,
      monthKeys: [],
    };
    group.operations += 1;
    // An income is up, so it adds to the deposited side with a deposit (D-18).
    if (type === 'income') group.deposited += amount;
    if (type === 'deposit') group.deposited += amount;
    if (type === 'withdrawal') group.withdrawn += amount;
    group.monthKeys.push(monthKeyOf(date));
    groups.set(code, group);
  }

  const ordered = [...groups.entries()]
    .map(([code, group]): OracleCurrencyGroup => {
      const keys = [...group.monthKeys].sort((a, b) => a - b);
      return {
        code,
        operations: group.operations,
        depositedThousandths: group.deposited,
        withdrawnThousandths: group.withdrawn,
        months: keys.length === 0 ? 0 : keys[keys.length - 1]! - keys[0]! + 1,
        firstMonth: keys.length === 0 ? null : keys[0]!,
        lastMonth: keys.length === 0 ? null : keys[keys.length - 1]!,
      };
    })
    .sort(compareCurrencyGroups);

  return {
    usable,
    excluded,
    charted: ordered
      .filter((group) => group.operations >= CHART_MIN_OPERATIONS)
      .slice(0, CHART_MAX),
    others: ordered.filter((group) => group.operations < CHART_MIN_OPERATIONS),
  };
}

/**
 * Operations descending, then code ascending in plain code-unit order, with a
 * blank code last. `'RUB' < 'usd'` because code units are not case-folded, and
 * that is the point: the order never depends on a locale.
 */
function compareCurrencyGroups(a: OracleCurrencyGroup, b: OracleCurrencyGroup): number {
  if (a.operations !== b.operations) return b.operations - a.operations;
  if (a.code === '' || b.code === '') {
    if (a.code === b.code) return 0;
    return a.code === '' ? 1 : -1;
  }
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

// ---------------------------------------------------------------------------
// oracleSpend
// ---------------------------------------------------------------------------

/** One year of paid orders, newest first. */
export interface OracleSpendYear {
  year: string;
  paid: number;
  totalThousandths: number;
}

/** One game of paid orders. A blank `GAME_CODE` reads `(not recorded)`. */
export interface OracleSpendGame {
  game: string;
  paid: number;
  totalThousandths: number;
}

/** One currency's spend card, recomputed. */
export interface OracleSpendCard {
  /** The code exactly as written; `''` for the unknown-currency card. */
  code: string;
  /** True for the card that collects every non three-letter code. */
  unknownCurrency: boolean;
  /** Included paid orders. */
  paid: number;
  totalThousandths: number;
  failed: number;
  newOrders: number;
  /** A status that is neither PAID, FAILED nor NEW. */
  other: number;
  /** Paid gift orders, and what they were worth. */
  gifts: number;
  giftThousandths: number;
  /** PAID rows excluded because their amount is unusable (D-03). */
  excluded: number;
  byYear: OracleSpendYear[];
  byGame: OracleSpendGame[];
}

/** Every currency's card, in card order, plus the whole-export exclusions. */
export interface OracleSpend {
  cards: OracleSpendCard[];
  excluded: number;
}

/** Statuses the export writes, and the one that means "some other state". */
const STATUS_PAID = 'PAID';
const STATUS_FAILED = 'FAILED';
const STATUS_NEW = 'NEW';

/** `IS_GIFT` values that mean a gift, in every shape the export writes. */
const GIFT_VALUES = new Set(['1', 'T', 'TRUE']);

/** The label a blank `GAME_CODE` is drawn with. */
const UNKNOWN_GAME = '(not recorded)';

/** The label a year that cannot be read is grouped under. */
const UNKNOWN_YEAR = 'Unknown year';

/** Three ASCII letters is a currency code; anything else is unknown. */
function isCurrencyCode(code: string): boolean {
  return /^[A-Za-z]{3}$/.test(code);
}

/** The year an `ACTION_DT` claims, by its first four characters. */
function readYear(raw: string): string {
  return /^\d{4}$/.test(raw.slice(0, 4)) ? raw.slice(0, 4) : UNKNOWN_YEAR;
}

/**
 * Recompute the real-money spend figures from raw `Orders.csv` rows.
 *
 * Rules, all from FINANCE-03:
 *   - the currency is `PAYMENT_CURRENCY`, blank included; the twelve-column
 *     header has no other currency column, which is why a blank and a
 *     two-letter code both land on the unit-less card;
 *   - a row counts toward money only when `PAY_ORDER_STATUS_CODE` is exactly
 *     `PAID`; `FAILED`, `NEW` and anything else are counted in their own
 *     buckets and never added in;
 *   - a PAID row whose amount is unusable is counted as excluded, never guessed
 *     at, and never in a total;
 *   - `IS_GIFT` is a gift on `1`, `T` and `TRUE` in any case; anything else,
 *     including `F`, `false` and a blank, is not;
 *   - the gift line is derived from the INCLUDED paid rows, so its total is
 *     always a subset of the headline and can never disagree with it;
 *   - `ACTION_DT` is per-row valid (D-21), so a year is its first four
 *     characters; a row whose date cannot be read is still counted and lands
 *     under `Unknown year`, which sorts last.
 *
 * Card order is paid orders descending, then code ascending in plain code-unit
 * order, with the unit-less card LAST (D-24).
 */
export function oracleSpend(rows: readonly OracleRow[]): OracleSpend {
  const cards = new Map<
    string,
    {
      unknownCurrency: boolean;
      paid: number;
      total: number;
      failed: number;
      newOrders: number;
      other: number;
      gifts: number;
      giftTotal: number;
      excluded: number;
      years: Map<string, { paid: number; total: number }>;
      games: Map<string, { paid: number; total: number }>;
    }
  >();
  let excluded = 0;

  for (const row of rows) {
    const rawCode = cell(row, 'PAYMENT_CURRENCY');
    const unknownCurrency = !isCurrencyCode(rawCode);
    const code = unknownCurrency ? '' : rawCode;
    const card = cards.get(code) ?? {
      unknownCurrency,
      paid: 0,
      total: 0,
      failed: 0,
      newOrders: 0,
      other: 0,
      gifts: 0,
      giftTotal: 0,
      excluded: 0,
      years: new Map(),
      games: new Map(),
    };
    cards.set(code, card);

    const status = cell(row, 'PAY_ORDER_STATUS_CODE').trim();
    if (status === STATUS_FAILED) {
      card.failed += 1;
      continue;
    }
    if (status === STATUS_NEW) {
      card.newOrders += 1;
      continue;
    }
    if (status !== STATUS_PAID) {
      card.other += 1;
      continue;
    }

    const amount = parseThousandths(cell(row, 'PAYED_IN_CURR_AMT'));
    if (amount === null) {
      card.excluded += 1;
      excluded += 1;
      continue;
    }

    card.paid += 1;
    card.total += amount;
    if (GIFT_VALUES.has(cell(row, 'IS_GIFT').trim().toUpperCase())) {
      card.gifts += 1;
      card.giftTotal += amount;
    }

    const year = readYear(cell(row, 'ACTION_DT'));
    const yearBucket = card.years.get(year) ?? { paid: 0, total: 0 };
    yearBucket.paid += 1;
    yearBucket.total += amount;
    card.years.set(year, yearBucket);

    const rawGame = cell(row, 'GAME_CODE').trim();
    const game = rawGame === '' ? UNKNOWN_GAME : rawGame;
    const gameBucket = card.games.get(game) ?? { paid: 0, total: 0 };
    gameBucket.paid += 1;
    gameBucket.total += amount;
    card.games.set(game, gameBucket);
  }

  const ordered = [...cards.entries()].map(([code, card]): OracleSpendCard => ({
    code,
    unknownCurrency: card.unknownCurrency,
    paid: card.paid,
    totalThousandths: card.total,
    failed: card.failed,
    newOrders: card.newOrders,
    other: card.other,
    gifts: card.gifts,
    giftThousandths: card.giftTotal,
    excluded: card.excluded,
    byYear: [...card.years.entries()]
      .map(([year, bucket]) => ({
        year,
        paid: bucket.paid,
        totalThousandths: bucket.total,
      }))
      .sort((a, b) => compareYears(a.year, b.year)),
    byGame: [...card.games.entries()]
      .map(([game, bucket]) => ({
        game,
        paid: bucket.paid,
        totalThousandths: bucket.total,
      }))
      .sort((a, b) => b.paid - a.paid || compareCodes(a.game, b.game)),
  }));

  return {
    cards: ordered.sort((a, b) => compareSpendCards(a, b)),
    excluded,
  };
}

/** Years newest first, with the unreadable one last. */
function compareYears(a: string, b: string): number {
  if (a === UNKNOWN_YEAR || b === UNKNOWN_YEAR) {
    if (a === b) return 0;
    return a === UNKNOWN_YEAR ? 1 : -1;
  }
  return a < b ? 1 : a > b ? -1 : 0;
}

/** Plain code-unit order. Case-sensitive, and locale-independent. */
function compareCodes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The unit-less card LAST, always; then paid orders descending; then plain
 * code-unit order.
 *
 * "Always" is the part that matters, and it differs from the currency list on
 * purpose. The unit-less group is explicitly NOT a currency (FINANCE-03), so it
 * must not sit in the middle of the currency cards where a reader would read it
 * as one — even when it has more paid orders than a real currency does. On the
 * currency list a blank CODE still earns its place by its operation count, so
 * there the blank-last rule only breaks ties.
 */
function compareSpendCards(a: OracleSpendCard, b: OracleSpendCard): number {
  if (a.unknownCurrency !== b.unknownCurrency) return a.unknownCurrency ? 1 : -1;
  if (a.paid !== b.paid) return b.paid - a.paid;
  return compareCodes(a.code, b.code);
}
