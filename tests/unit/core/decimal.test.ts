// =============================================================================
// Exact decimal arithmetic over bigint micro-units (phase 05, plan 05-04).
//
// WHY THIS FILE EXISTS
// Every money figure in the app is a `bigint` count of micro-units, summed as an
// integer and carried across the message boundary as a decimal string. The one
// place a fraction of a unit is ever created is display, and the one place a
// float is ever allowed is a bar height. This file pins both of those, because
// the failure mode is silent: a total that is a hundredth out looks like a total.
//
// THE ROUNDING TRAP, MADE EXPLICIT
// The hand fixture's USD card is 15.495 units exactly, and the card draws 15.50.
// `(15.495).toFixed(2)` is `'15.49'` — 15.495 is a hair BELOW 15.495 in binary,
// so the float path rounds down where half-away rounds up. Same for 5.005, which
// the float path draws as `5.00` and the exact path draws as `5.01`. Both are
// asserted here against a float so the reason FINANCE-03 forbids float money
// sits next to the numbers it protects (T-05-10, D-24, D-25).
//
// Every format call pins `'en-US'` explicitly. The viewer-locale default is
// plan 05-08's concern, and a test that relies on the machine's locale is a test
// that fails on someone else's laptop (RESEARCH Pitfall 7).
// =============================================================================

import { describe, expect, it } from 'vitest';

// A namespace import on purpose: a function that does not exist yet fails the
// ONE test that calls it rather than crashing the file at module resolution.
import * as decimal from '../../../src/lib/core/decimal';

describe('05-04 exact decimal arithmetic', () => {
  it('parses every amount shape the real export writes, and refuses the rest', () => {
    expect(decimal.parseDecimalUnits('9.99')).toBe(9_990_000n);
    // A LEADING DOT is real PAID data: five orders in the sample are written
    // `.5`. A pattern that insists on digits before the dot drops them from the
    // total and misreports the excluded pill (RESEARCH Pitfall 5).
    expect(decimal.parseDecimalUnits('.5')).toBe(500_000n);
    // A TRAILING DOT is the same family of tolerance: the digits are all there.
    expect(decimal.parseDecimalUnits('5.')).toBe(5_000_000n);
    expect(decimal.parseDecimalUnits('5')).toBe(5_000_000n);
    // Trailing zeros in the fraction are significant for the SCALE, not for the
    // value: 5.250 is 5.25, padded to six digits.
    expect(decimal.parseDecimalUnits('5.250')).toBe(5_250_000n);
    expect(decimal.parseDecimalUnits('-3')).toBe(-3_000_000n);
    expect(decimal.parseDecimalUnits('+2')).toBe(2_000_000n);
    // Whitespace around a cell is the parser's business, not the value's.
    expect(decimal.parseDecimalUnits('  7.5  ')).toBe(7_500_000n);
    expect(decimal.parseDecimalUnits('30435000000')).toBe(30_435_000_000_000_000n);
  });

  it('treats an exponent, a comma, a blank, an over-long cell and too many decimals as non-numeric', () => {
    // An exponent is not written by the export, and accepting one would mean
    // parsing a number the export never claimed to have.
    expect(decimal.parseDecimalUnits('1e3')).toBeNull();
    // A comma is a thousands separator in a locale, not in this file's cells.
    expect(decimal.parseDecimalUnits('1,5')).toBeNull();
    expect(decimal.parseDecimalUnits('')).toBeNull();
    expect(decimal.parseDecimalUnits('   ')).toBeNull();
    expect(decimal.parseDecimalUnits(undefined)).toBeNull();
    expect(decimal.parseDecimalUnits('abc')).toBeNull();
    expect(decimal.parseDecimalUnits('12 34')).toBeNull();
    expect(decimal.parseDecimalUnits('--3')).toBeNull();
    expect(decimal.parseDecimalUnits('3-')).toBeNull();
    // Seven fraction digits cannot be represented at scale 6, so rounding them
    // would invent precision the file does not have.
    expect(decimal.parseDecimalUnits('0.1234567')).toBeNull();
    // The 2026 export pads amounts to nine decimals; padding zeros carry no precision.
    expect(decimal.parseDecimalUnits('230.000000000')).toBe(230000000n);
    expect(decimal.parseDecimalUnits('0.1234560000')).toBe(123456n);
    expect(decimal.parseDecimalUnits('1.0000001')).toBeNull();
    // A 41-digit cell is a denial-of-service vector, not an amount (T-05-07).
    expect(decimal.parseDecimalUnits('1'.repeat(41))).toBeNull();
    // The bound is 40 characters, so exactly 40 is still parsed.
    // The bound is 40 characters, so exactly 40 is still parsed — and the value
    // is that many WHOLE units, each worth a million micro-units.
    const fortyNines = BigInt('9'.repeat(40));
    expect(decimal.parseDecimalUnits('9'.repeat(40))).toBe(fortyNines * 1_000_000n);
  });

  it('rounds money half away from zero exactly once', () => {
    // 1.005 -> 1.01. A float `toFixed(2)` gives '1.00' here, and even
    // `(1.005).toFixed(2)` in this engine is '1.00'; that is the whole reason
    // FINANCE-03 forbids float money.
    expect(decimal.formatMoneyAmount(1_005_000n, 'en-US')).toBe('1.01');
    expect((1.005).toFixed(2)).toBe('1.00');
    // 15.495 -> 15.50, the hand fixture's USD headline, where the float path
    // gives '15.49'.
    expect(decimal.formatMoneyAmount(15_495_000n, 'en-US')).toBe('15.50');
    expect((15.495).toFixed(2)).toBe('15.49');
    // The mirror case: the sign does not change the direction of the rounding.
    expect(decimal.formatMoneyAmount(-1_005_000n, 'en-US')).toBe('-1.01');
    expect(decimal.formatMoneyAmount(0n, 'en-US')).toBe('0.00');
    // A value that rounds to zero FROM BELOW ZERO shows no minus: "-0.00" is a
    // number that does not exist, and a card must not draw one.
    expect(decimal.formatMoneyAmount(-4_000n, 'en-US')).toBe('0.00');
    // Grouping, and the ordinary half-up case at a tenth of a cent.
    expect(decimal.formatMoneyAmount(1_234_565_000n, 'en-US')).toBe('1,234.57');
    expect(decimal.formatMoneyAmount(30_435_000_000_000n, 'en-US')).toBe('30,435,000.00');
  });

  it('renders an exact amount with up to six fraction digits and trimmed zeros', () => {
    // The currency-flow figures are read from the cells exactly, not rounded:
    // 12.5 credits is 12.5, and 30,435,000 is 30,435,000 rather than 30.435M.
    expect(decimal.formatDecimalAmount(30_435_000_000_000n, 'en-US')).toBe('30,435,000');
    expect(decimal.formatDecimalAmount(12_500_000n, 'en-US')).toBe('12.5');
    expect(decimal.formatDecimalAmount(5_005_000n, 'en-US')).toBe('5.005');
    expect(decimal.formatDecimalAmount(1_000_000n, 'en-US')).toBe('1');
    expect(decimal.formatDecimalAmount(0n, 'en-US')).toBe('0');
    expect(decimal.formatDecimalAmount(-1_500_000n, 'en-US')).toBe('-1.5');
    // Six fraction digits is the scale, so nothing is ever lost or invented.
    expect(decimal.formatDecimalAmount(1n, 'en-US')).toBe('0.000001');
  });

  it('converts micro-units to a number for bar heights only', () => {
    expect(decimal.unitsToNumber(12_500_000n)).toBe(12.5);
    expect(decimal.unitsToNumber(0n)).toBe(0);
    expect(decimal.unitsToNumber(30_435_000_000_000n)).toBe(30_435_000);
  });

  it('validates a transported micro-unit string', () => {
    // A sum crosses the message boundary as a decimal string, so the receiving
    // side validates it rather than trusting it: a stored value that is not an
    // integer in range is a corrupted dataset, not a total.
    expect(decimal.parseUnitsString('0')).toBe(0n);
    expect(decimal.parseUnitsString('-12')).toBe(-12n);
    expect(decimal.parseUnitsString('30435000000000')).toBe(30_435_000_000_000n);
    expect(decimal.parseUnitsString('9'.repeat(40))).toBe(BigInt('9'.repeat(40)));
    // A fraction is not a micro-unit count, a plus is not written, and a blank
    // is not zero.
    expect(decimal.parseUnitsString('1.5')).toBeNull();
    expect(decimal.parseUnitsString('+1')).toBeNull();
    expect(decimal.parseUnitsString('')).toBeNull();
    expect(decimal.parseUnitsString(' 1')).toBeNull();
    expect(decimal.parseUnitsString('1 ')).toBeNull();
    expect(decimal.parseUnitsString('-')).toBeNull();
    expect(decimal.parseUnitsString('9'.repeat(41))).toBeNull();
    expect(decimal.parseUnitsString('1e3')).toBeNull();
    expect(decimal.parseUnitsString(undefined)).toBeNull();
  });
});
