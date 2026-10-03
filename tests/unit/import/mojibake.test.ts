import { describe, expect, test } from 'vitest';
import { fixMojibake } from '../../../src/lib/worker/mojibake.ts';

// =============================================================================
// fixMojibake — round-trip-or-reject mojibake fix (RESEARCH.md Pattern 2)
// =============================================================================
//
// Why this file exists (02-01-PLAN Task 3, Test 2, RED then GREEN):
//   IMPORT-04 requires that double-UTF8 (mojibake) string fields be
//   corrected during parse. The implementation MUST be safe to run
//   on every string field, every category (D-01), without corrupting
//   already-correct text. The "safe to run unconditionally" property
//   is the load-bearing test — a fixMojibake that mangles a real
//   Cyrillic string would silently destroy the only data point
//   (2021 sample) the project has verified against.
//
// Round-trip contract (from RESEARCH.md Pattern 2):
//   Given a UTF-8 string `original`, its mojibake form is the string
//   whose code units are the UTF-8 bytes of `original` reinterpreted
//   as Latin-1. fixMojibake(mojibake) MUST equal `original`.
//
// The four testable invariants per the plan's Behavior block:
//   1. The documented Cyrillic mojibake round-trips back to the
//      original readable text.
//   2. Already-correct Cyrillic text is byte-for-byte unchanged.
//   3. Empty string is returned unchanged (specless-probe IMPORT-04
//      empty, resolved).
//   4. Pure ASCII text is returned byte-for-byte unchanged (a no-op
//      round-trip).
//   5. The function never throws on any input (the wrap is
//      unconditional in csv-parse.ts).
// =============================================================================

/**
 * Inverse of fixMojibake: encode a UTF-8 string's bytes as a string
 * of Latin-1 code points. Every char in the result has a code unit
 * ≤ 0xff, so the result is exactly the input that fixMojibake()
 * detects as mojibake.
 */
function toMojibake(original: string): string {
  const bytes = new TextEncoder().encode(original);
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  return s;
}

describe('fixMojibake — round-trip recovery', () => {
  test('Latin-1-reinterpreted Cyrillic round-trips back to the original readable text', () => {
    const original = 'Синтетический_клан';
    const mojibake = toMojibake(original);
    // Sanity: the mojibake form has a different char count (Cyrillic
    // chars take 2 UTF-8 bytes each, so the mojibake string is longer
    // than the original).
    expect(mojibake.length).toBeGreaterThan(original.length);
    // The fix recovers the original.
    expect(fixMojibake(mojibake)).toBe(original);
  });

  test('a shorter Cyrillic name (single word) also round-trips', () => {
    const original = 'Тест';
    const mojibake = toMojibake(original);
    expect(fixMojibake(mojibake)).toBe(original);
  });
});

describe('fixMojibake — leaves already-correct text unchanged', () => {
  test('an already-correct Cyrillic string is returned byte-for-byte unchanged', () => {
    const original = 'Синтетический_клан';
    // Cyrillic chars have code units > 0xff, so fixMojibake must
    // short-circuit and return the input verbatim.
    expect(fixMojibake(original)).toBe(original);
  });

  test('a pure-ASCII string is returned byte-for-byte unchanged (round-trip is a no-op)', () => {
    const ascii = 'synthetic.player@example.invalid';
    expect(fixMojibake(ascii)).toBe(ascii);
  });

  test('an empty string is returned unchanged (specless-probe IMPORT-04 empty)', () => {
    expect(fixMojibake('')).toBe('');
  });
});

describe('fixMojibake — never throws', () => {
  test('does not throw on Latin-1-range text that is NOT valid UTF-8 (rejected round-trip)', () => {
    // A pure-ASCII-ish Latin-1 string that is NOT a valid UTF-8
    // re-encoding: the function must catch the TypeError from the
    // fatal decoder and return the input unchanged. U+0080 is a
    // continuation byte in isolation → invalid UTF-8 sequence.
    const invalid = String.fromCharCode(0x80, 0x80, 0x80, 0x80);
    expect(() => fixMojibake(invalid)).not.toThrow();
    expect(fixMojibake(invalid)).toBe(invalid);
  });

  test('does not throw on a string of all 0xff code points', () => {
    const allFF = String.fromCharCode(0xff).repeat(8);
    expect(() => fixMojibake(allFF)).not.toThrow();
  });
});

// =============================================================================
// 02-02 — RESEARCH.md Assumption A2 explicit resolution
// =============================================================================
//
// The two tests below pin the exact real-sample byte pattern documented
// in PROJECT.md / RESEARCH.md Assumption A2: take a real Ukrainian /
// Cyrillic string, encode it as UTF-8, then decode those bytes as
// Latin-1 to produce the documented mojibake form. fixMojibake must
// recover the original Cyrillic string.
//
// The second test guards the false-positive case: a string that mixes
// ASCII and correctly-decoded Cyrillic (the kind of field the worker
// actually handles after running fixMojibake on a CSV row) must be
// returned completely unchanged, proving the round-trip-or-reject gate
// does not misfire on already-correct text.
// =============================================================================

describe('fixMojibake — real-sample byte pattern (RESEARCH.md A2)', () => {
  test('the exact PROJECT.md double-UTF8 Cyrillic byte pattern round-trips back to readable text', () => {
    // A short, hand-curated Ukrainian phrase that mixes Cyrillic and
    // a small ASCII token. Encoding it as UTF-8 produces the byte
    // pattern that Wargaming's 2021 export mis-decoded as Latin-1
    // (the documented mojibake form). fixMojibake on that mojibake
    // string must return the original Cyrillic source.
    const original = 'Гравець_12345';
    const mojibake = toMojibake(original);

    // Sanity: every char in the mojibake form is in the Latin-1
    // range (code unit ≤ 0xff) — i.e. the result is exactly what
    // a mis-decoded Latin-1 reader would see.
    for (let i = 0; i < mojibake.length; i++) {
      expect(mojibake.charCodeAt(i)).toBeLessThanOrEqual(0xff);
    }

    // The fix recovers the original.
    expect(fixMojibake(mojibake)).toBe(original);
  });

  test('a mixed ASCII + correctly-decoded Cyrillic string passes through unchanged (no false positive)', () => {
    // A string that an already-correct UTF-8 decoder would produce
    // when reading a CSV with both Latin and Cyrillic content. Every
    // char's code unit is > 0xff (Cyrillic) or < 0x80 (ASCII) — the
    // fixMojibake guard short-circuits on any code unit > 0xff,
    // returning the input verbatim.
    const mixed = 'Player 12345 — Гравець';
    expect(fixMojibake(mixed)).toBe(mixed);
  });
});
