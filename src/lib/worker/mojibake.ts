/**
 * Round-trip-or-reject mojibake fix (RESEARCH.md Pattern 2).
 *
 * Why this exists (02-01-PLAN Task 3, IMPORT-04, D-01):
 *   Wargaming's 2021 GDPR exports were written by a tool that
 *   double-encoded non-ASCII strings: a real Cyrillic character
 *   became two Latin-1 code points whose UTF-8 re-encoding was
 *   garbage on screen. The fix is to reinterpret every code unit
 *   ≤ 0xff as a Latin-1 byte, then re-decode those bytes as
 *   strict UTF-8. If the round-trip is valid UTF-8, the original
 *   double-encoding is recovered; if not, the input is left
 *   untouched (already-correct text contains code units > 0xff
 *   and short-circuits at the first one).
 *
 * The "safe to run on every field" invariant (D-01: parse every
 * category, not just the four "supported" ones) hinges on this
 * function being a no-op on already-correct text. The `if (code >
 * 0xff) return value` guard ensures the function never corrupts
 * real UTF-16 strings — it only operates on inputs that are
 * entirely within the Latin-1 range.
 *
 * The strict decoder (with `{ fatal: true }`) makes the round-trip
 * testable: invalid UTF-8 throws `TypeError`, which we catch and
 * return the input unchanged.
 */
const strictUtf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function fixMojibake(value: string): string {
  if (value.length === 0) return value;
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0xff) return value; // real non-Latin-1 text — never touch
    bytes[i] = code;
  }
  try {
    return strictUtf8Decoder.decode(bytes);
  } catch {
    // The bytes don't round-trip to valid UTF-8 — this was already-
    // correct text that happened to fit in the Latin-1 range, or a
    // genuinely-corrupted field. Either way, leave it alone.
    return value;
  }
}
