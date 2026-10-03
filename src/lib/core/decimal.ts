/**
 * Exact decimal arithmetic over `bigint` micro-units (phase 05, plan 05-04).
 *
 * ## Why this module exists
 *
 * A money total that is a hundredth out looks exactly like a money total. The
 * failure is silent, it compounds across thousands of rows, and in a viewer
 * whose entire claim is that it shows you YOUR data it is the one that matters.
 * So money is never a binary floating point number in this app:
 *
 *   - an amount is parsed to a `bigint` count of MICRO-UNITS at a FIXED scale
 *     of {@link MICRO_SCALE}, and summed as an integer;
 *   - a sum crosses the worker boundary as a decimal STRING, so nothing has to
 *     survive a structured clone or a JSON round trip as a `bigint`;
 *   - a fraction of a unit is created exactly ONCE, at display, by a single
 *     half-away-from-zero rounding;
 *   - a `number` is produced in exactly one place, {@link unitsToNumber}, for a
 *     bar HEIGHT, where a hundredth of a pixel cannot be seen.
 *
 * ## Why scale 6
 *
 * The export writes amounts with up to three decimals (`.5`, `1.005`,
 * `250.50`), and a currency's internal balances run to whole units and
 * millions. Six fraction digits is more than the sample needs and small enough
 * that a 40-character cell still fits in a `bigint` comfortably, and it means a
 * cell with more precision than the file can hold is EXCLUDED rather than
 * silently rounded — a rounding rule the app cannot test is a rounding rule it
 * should not have.
 *
 * ## The amount shapes
 *
 * Accepted, after trimming:
 *
 *   `9.99` `0` -> 9,990,000        a leading dot:  `.5` -> 500,000
 *   `5.`       -> 5,000,000        a leading plus: `+2` -> 2,000,000
 *   `5`        -> 5,000,000        a leading minus: `-3` -> -3,000,000
 *   `5.250`    -> 5,250,000
 *
 * **A leading dot is real PAID data** — five orders in the sample are written
 * `.5` — and a pattern that insists on digits before the dot drops them from a
 * total and understates the excluded pill at the same time (RESEARCH Pitfall 5).
 *
 * Rejected as non-numeric, which means the row is excluded and COUNTED rather
 * than guessed at (D-03):
 *
 *   `1e3`            an exponent the export never writes
 *   `1,5`            a thousands separator this file's cells do not carry
 *   `` (blank)       a missing value is not a zero
 *   `abc`            not a number at all
 *   `0.1234567`      seven fraction digits: more precision than the scale holds
 *   41+ characters   a denial-of-service vector, not an amount (T-05-07)
 *
 * ## The rounding trap, once
 *
 * 1.005 units must draw as `1.01` and 15.495 as `15.50`. Both are exact in
 * decimal and both are WRONG in binary: the shortest-round-trip string renderer
 * on a double produces `'1.00'` for 1.005 and `'15.49'` for 15.495, because each
 * literal sits a hair below the value it names. The fix is not a better float,
 * it is not using a float: the magnitude is rounded in `bigint` to whole cents with
 * `(magnitude + 5000) / 10000`, and the resulting DECIMAL TEXT is what the
 * formatter is handed. The text is exact; the formatter only groups it.
 *
 * Decisions: D-21, D-24, D-25. Threats: T-05-07 (bounded cells), T-05-10 (no
 * float drift, no double rounding).
 */

/** Fraction digits one micro-unit amount carries: the fixed scale of all money. */
export const MICRO_SCALE = 6;

/** Micro-units in one whole unit — the divisor a display string is built from. */
const UNITS_PER_WHOLE = 10n ** BigInt(MICRO_SCALE);

/** Micro-units in one cent — four decimal places are below the fixed scale. */
const UNITS_PER_CENT = 10n ** BigInt(MICRO_SCALE - 2);

/** Half of a cent, added before the integer division that rounds a magnitude. */
const HALF_A_CENT = UNITS_PER_CENT / 2n;

/**
 * A cell longer than this is a denial-of-service vector rather than an amount
 * (T-05-07). Forty characters is far longer than any real cell and short enough
 * that the `bigint` it produces is comfortable.
 */
const MAX_AMOUNT_LENGTH = 40;

/**
 * An optional sign, then digits with at most one dot, where at least one digit
 * exists on each side of nothing — so a leading dot and a trailing dot both
 * parse, and a lone `.` does not.
 *
 * The fraction group is `\d*` rather than `\d+` precisely so a trailing dot
 * parses; the "at least one digit somewhere" rule is the separate check below.
 */
const DECIMAL_RE = /^([+-]?)(\d*(?:\.\d*)?)$/;

/** Digits and an optional leading minus, and nothing else: a transported sum. */
const UNITS_STRING_RE = /^-?\d{1,40}$/;

/**
 * Parse one amount cell into micro-units, or null when the cell is not a usable
 * number.
 *
 * Null — not zero, not a guess — for every rejected shape listed at the top of
 * this file, because a caller that receives a number has no way to tell a real
 * zero from an unreadable cell, and would draw a bar for it.
 *
 * A NEGATIVE amount parses successfully here. Whether a negative is usable is
 * the caller's decision and differs by file: a currency operation that reads as
 * a negative deposit is an export integrity problem, while nothing in the spend
 * path accepts one either. Deciding that here would put one file's rule in the
 * other file's way.
 */
export function parseDecimalUnits(raw: string | undefined): bigint | null {
  const text = (raw ?? '').trim();
  if (text.length === 0 || text.length > MAX_AMOUNT_LENGTH) return null;
  const match = DECIMAL_RE.exec(text);
  if (match === null) return null;

  const sign = match[1] ?? '';
  const body = match[2] ?? '';
  const dot = body.indexOf('.');
  const whole = dot === -1 ? body : body.slice(0, dot);
  const fraction = dot === -1 ? '' : body.slice(dot + 1);
  // A lone `.` has no digits on either side and is not a number.
  if (whole === '' && fraction === '') return null;
  // More precision than the scale holds is excluded rather than rounded: a
  // rounding rule the fixtures cannot exercise is a rule that could be wrong.
  if (fraction.length > MICRO_SCALE) return null;

  const digits = `${whole === '' ? '0' : whole}${fraction.padEnd(MICRO_SCALE, '0')}`;
  const units = BigInt(digits);
  return sign === '-' ? -units : units;
}

/**
 * Validate a micro-unit count that crossed the message boundary as a string.
 *
 * A sum is stored and transported as text so that nothing has to survive a
 * structured clone as a `bigint`; the receiving side therefore CHECKS the text
 * rather than trusting it. A stored value that is not a plain integer in range
 * is a corrupted dataset, and the right answer to that is to say so, not to
 * coerce it to zero.
 */
export function parseUnitsString(text: string | undefined): bigint | null {
  if (text === undefined) return null;
  // NOT trimmed, unlike a cell: a transported sum is written by this app, so
  // whitespace in it means the stored value is not what this app wrote.
  if (text.length === 0) return null;
  return UNITS_STRING_RE.test(text) ? BigInt(text) : null;
}

/**
 * Micro-units as a `number`, for a bar height and nothing else.
 *
 * The one place a money value becomes binary floating point. A bar is measured
 * in pixels, so a hundredth of a unit is far below anything the reader can see,
 * and a chart that drew from this number can never be the source of a figure the
 * reader copies. Every NUMBER the reader reads comes from the exact string
 * instead.
 */
export function unitsToNumber(units: bigint): number {
  return Number(units) / Number(UNITS_PER_WHOLE);
}

/**
 * Render micro-units as money: grouped, with exactly two decimals, rounded half
 * away from zero ONCE.
 *
 * The rounding is integer arithmetic on the magnitude — `(m + 5000) / 10000` in
 * micro-units — so it is exact at every magnitude and rounds the same way in
 * both directions. A sign is written only when the ROUNDED value is non-zero,
 * because "-0.00" is a number that does not exist and a card must not draw one.
 *
 * The decimal text is handed to the formatter as a string, which is why
 * 15.495 groups to `15,495.00` correctly rather than becoming 15495.004999… in
 * binary on the way there.
 */
export function formatMoneyAmount(units: bigint, locale?: string): string {
  const negative = units < 0n;
  const magnitude = negative ? -units : units;
  const cents = (magnitude + HALF_A_CENT) / UNITS_PER_CENT;
  const sign = negative && cents > 0n ? '-' : '';
  const text = `${sign}${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
  return groupDecimalText(text, locale, 2, 2);
}

/**
 * Render micro-units exactly: grouped, with up to {@link MICRO_SCALE} fraction
 * digits and trailing zeros trimmed.
 *
 * This is the currency-flow form, where 12.5 credits is 12.5 and 30,435,000 is
 * 30,435,000. Nothing is rounded here at all, because a currency total is read
 * off cells that are exact at the scale and rounding them would be inventing a
 * different number.
 */
export function formatDecimalAmount(units: bigint, locale?: string): string {
  const negative = units < 0n;
  const magnitude = negative ? -units : units;
  const whole = magnitude / UNITS_PER_WHOLE;
  const fraction = (magnitude % UNITS_PER_WHOLE)
    .toString()
    .padStart(MICRO_SCALE, '0')
    .replace(/0+$/, '');
  const sign = negative ? '-' : '';
  const text = fraction === '' ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
  // A MINIMUM of zero, not of six: 1 credit is drawn `1` and 12.5 is drawn
  // `12.5`, and a currency total is a currency total rather than a fixed-point
  // field. The maximum is the scale, so nothing is ever invented.
  return groupDecimalText(text, locale, 0, MICRO_SCALE);
}

// Unbounded on purpose: the key space is the handful of locale and option pairs
// the app formats with, not user data, so it cannot grow with the export.
const formatterCache = new Map<string, Intl.NumberFormat>();

/**
 * A shared `Intl.NumberFormat` for one locale and option set.
 *
 * Constructing a formatter resolves locale data, which costs far more than
 * calling `format`, and a chart or table formats one value per cell. The key
 * is the locale plus the options (a handful of small flat objects), so the
 * cache stays as small as the set of distinct formats the app uses.
 */
export function numberFormatter(
  locale: string | undefined,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale ?? ''}|${options === undefined ? '' : JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Group an EXACT decimal string for a locale.
 *
 * The value goes in as text, never as a number: the formatter is being asked to
 * insert thousands separators and nothing else, and a value that has already
 * been through a binary float cannot be grouped back to the number it came
 * from. The cast is the one place the installed lib typings and the platform
 * disagree — `Intl.NumberFormat.prototype.format` accepts a string at runtime
 * (ECMA-402 `format` takes `number | bigint`, and the string form is what
 * `formatToParts` and every engine since ES2020 accept for a decimal literal) —
 * so the call is narrowed here and nowhere else.
 */
function groupDecimalText(
  text: string,
  locale: string | undefined,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
): string {
  const formatter = numberFormatter(locale, { minimumFractionDigits, maximumFractionDigits });
  return formatter.format(text as unknown as number);
}
