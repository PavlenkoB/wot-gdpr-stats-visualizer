import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { maskCode } from '../../../src/lib/features/new-data/code-mask.ts';

// =============================================================================
// Plan 12-06 Task 2 - maskCode: first two characters then xxx, or xxx alone
// =============================================================================

describe('maskCode', () => {
  it('shows two characters and xxx for a code of eight or more', () => {
    expect(maskCode('AB7K-QX42')).toBe('ABxxx');
    expect(maskCode('ABCDEFGH')).toBe('ABxxx');
  });

  it('answers the fixed text alone for a shorter, empty or non-string value, and never throws', () => {
    expect(maskCode('ABCDEFG')).toBe('xxx');
    expect(maskCode('')).toBe('xxx');
    for (const value of [null, undefined, 12345678, {}, [], true, Symbol('x')]) {
      expect(maskCode(value)).toBe('xxx');
    }
  });

  it('reflects no length: a 1,000-character code and an 8-character code both give five characters', () => {
    const long = maskCode('Q1' + 'z'.repeat(998));
    expect(long).toBe('Q1xxx');
    expect(long).toHaveLength(5);
    expect(maskCode('Q1zzzzzz')).toHaveLength(5);
  });

  it('never contains the third or later characters of the input', () => {
    const out = maskCode('AB7K-QX42');
    expect(out).not.toContain('7');
    expect(out).not.toContain('K');
    expect(out).not.toContain('-');
  });

  it('does not split on a separator', () => {
    expect(maskCode('A-B-C-D-E')).toBe('A-xxx');
    expect(maskCode('--------')).toBe('--xxx');
  });

  it('counts code points, never splitting a surrogate pair', () => {
    // Eight code points, the first two outside the BMP: ten UTF-16 units.
    const eight = '\u{1F600}\u{1F601}abcdef';
    expect(maskCode(eight)).toBe('\u{1F600}\u{1F601}xxx');
    // Seven code points but nine units: still too short.
    expect(maskCode('\u{1F600}\u{1F601}abcde')).toBe('xxx');
    // A lone high surrogate is one code point and never throws.
    expect(() => maskCode('\uD83D' + 'abcdefg')).not.toThrow();
  });

  it('is an import-free module', () => {
    const source = readFileSync(
      new URL('../../../src/lib/features/new-data/code-mask.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/^import\s/m);
  });
});
