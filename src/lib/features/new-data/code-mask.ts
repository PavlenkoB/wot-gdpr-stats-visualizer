/**
 * The pure mask for a coupon or bonus code (plan 12-06, D-13).
 *
 * ## What the mask is for
 *
 * A code is stored in clear in the user's own IndexedDB, because the single
 * global reveal has to be able to show it. On the way to the screen it passes
 * through here, so a column declared kind `code` cannot reach the DOM unmasked
 * by omission. The mask is "enough to recognise, not enough to be one": the
 * first two characters of a code of eight or more, then the fixed text `xxx`.
 *
 * ## What it deliberately does not do
 *
 *   - It reflects NO length. A 1,000-character code and an 8-character code both
 *     answer five characters, and a code shorter than eight answers the fixed
 *     text alone, so the output never tells a reader how long the code was.
 *   - It never echoes more than two characters, and never splits on a separator
 *     (`AB7K-QX42` is one code, not two halves).
 *   - It counts CODE POINTS, not UTF-16 units, so a surrogate pair is never cut
 *     in half and an emoji-laden string cannot be made to mask differently from
 *     an ASCII one of the same length.
 *   - It never throws: a non-string answers the fixed text.
 *
 * `ip.ts` is the IP twin of this module, kept as a sibling because that file
 * documents itself as IP parsing. This module has no imports on purpose.
 */

/** The fixed mask text, shown alone for a short, empty or non-string code. */
const CODE_MASK = 'xxx';

/** A code must have at least this many code points before any of it is shown. */
const MIN_CODE_POINTS_TO_SHOW = 8;

/** How many leading code points a long enough code shows. */
const SHOWN_CODE_POINTS = 2;

/**
 * The masked form of one stored code.
 *
 * `maskCode('AB7K-QX42')` is `ABxxx`; a code of seven characters, an empty
 * string or anything that is not a string is `xxx`.
 */
export function maskCode(value: unknown): string {
  if (typeof value !== 'string') return CODE_MASK;
  // Walk the string by code point and stop as soon as eight are counted, so a
  // very long code costs the same as an eight-character one.
  let count = 0;
  let head = '';
  for (const point of value) {
    if (count < SHOWN_CODE_POINTS) head += point;
    count += 1;
    if (count >= MIN_CODE_POINTS_TO_SHOW) return `${head}${CODE_MASK}`;
  }
  return CODE_MASK;
}
