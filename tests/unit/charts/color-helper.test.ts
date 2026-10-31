import { describe, expect, it } from 'vitest';
import {
  contrastRatioRgb,
  hexToRgb,
  luminanceRgb,
  mixSrgb,
  parseColorMix,
  resolveMix,
} from '../../helpers/color.ts';
import { contrastRatio } from '../../helpers/contrast.ts';

// =============================================================================
// The sRGB mixer (Phase 14, plan 14-01, R2).
// =============================================================================
//
// WHY THIS EXISTS
// The heat scale has five data steps and two of them are DERIVED: the step
// between the green stop and the olive stop, and the step between the olive
// stop and the gold stop. The stylesheet writes them as
// `color-mix(in srgb, ...)`, and the contract test has to recompute the same
// colours the browser produces - otherwise the test is checking a different
// arithmetic from the one that ships.
//
// The arithmetic is the plain channel average in GAMMA-ENCODED sRGB. Headless
// Chromium 153 resolves
// `color-mix(in srgb, var(--heat-low) 50%, var(--heat-mid))` to
// `color(srgb 0.34902 0.590196 0.266667)`, which is (89, 150.5, 68) on the
// 0-255 scale, and the derived step to (123.5, 119, 10).
//
// The COLOUR SPACE is part of the contract. `oklab` gives a different colour
// for the same two stops, so the parser refuses anything that is not `srgb`
// rather than quietly computing a colour the browser never produces.
// =============================================================================

describe('hexToRgb', () => {
  it('parses the six-digit form', () => {
    expect(hexToRgb('#47a374')).toEqual([71, 163, 116]);
  });

  it('parses the three-digit form', () => {
    expect(hexToRgb('#abc')).toEqual([170, 187, 204]);
  });

  it('throws on anything that is not a hex colour', () => {
    expect(() => hexToRgb('rgb(1, 2, 3)')).toThrow();
    expect(() => hexToRgb('#12345')).toThrow();
  });
});

describe('mixSrgb', () => {
  it('mixes two colours the way Chromium resolves color-mix(in srgb, ...)', () => {
    const mixed = mixSrgb([71, 163, 116], [107, 138, 20], 0.5);
    expect(mixed[0]).toBeCloseTo(89, 9);
    expect(mixed[1]).toBeCloseTo(150.5, 9);
    expect(mixed[2]).toBeCloseTo(68, 9);
  });

  it('mixes the second derived step the same way', () => {
    const mixed = mixSrgb([107, 138, 20], [140, 100, 0], 0.5);
    expect(mixed[0]).toBeCloseTo(123.5, 9);
    expect(mixed[1]).toBeCloseTo(119, 9);
    expect(mixed[2]).toBeCloseTo(10, 9);
  });

  it('throws for a weight outside 0..1', () => {
    expect(() => mixSrgb([0, 0, 0], [255, 255, 255], 1.5)).toThrow();
    expect(() => mixSrgb([0, 0, 0], [255, 255, 255], -0.1)).toThrow();
  });
});

describe('parseColorMix', () => {
  it('reads the colour space and the two inputs', () => {
    const parsed = parseColorMix('color-mix(in srgb, var(--heat-low) 50%, var(--heat-mid))');
    expect(parsed.space).toBe('srgb');
    expect(parsed.first).toEqual({ ref: '--heat-low', pct: 50 });
    expect(parsed.second).toEqual({ ref: '--heat-mid', pct: null });
  });
});

describe('resolveMix', () => {
  const lookup = (name: string): [number, number, number] =>
    name === '--heat-low' ? hexToRgb('#47a374') : hexToRgb('#6b8a14');

  it('resolves the two inputs through the lookup and mixes them', () => {
    const mixed = resolveMix('color-mix(in srgb, var(--heat-low) 50%, var(--heat-mid))', lookup);
    expect(mixed[0]).toBeCloseTo(89, 9);
    expect(mixed[1]).toBeCloseTo(150.5, 9);
    expect(mixed[2]).toBeCloseTo(68, 9);
  });

  it('throws for a colour space other than srgb', () => {
    expect(() =>
      resolveMix('color-mix(in oklab, var(--heat-low) 50%, var(--heat-mid))', lookup),
    ).toThrow(/oklab/);
  });
});

describe('contrastRatioRgb', () => {
  it('agrees with the hex reader in tests/helpers/contrast.ts', () => {
    const pairs: readonly (readonly [string, string])[] = [
      ['#ffffff', '#47a374'],
      ['#ffffff', '#6b8a14'],
      ['#ffffff', '#8c6400'],
      ['#111111', '#3a3a3a'],
      ['#fce8e6', '#8a1c17'],
    ];
    for (const [a, b] of pairs) {
      expect(contrastRatioRgb(hexToRgb(a), hexToRgb(b))).toBeCloseTo(contrastRatio(a, b), 9);
    }
  });

  it('reproduces the UI-SPEC heat ratios on white', () => {
    const white: [number, number, number] = [255, 255, 255];
    const steps: readonly (readonly [[number, number, number], number])[] = [
      [hexToRgb('#47a374'), 3.11],
      [mixSrgb(hexToRgb('#47a374'), hexToRgb('#6b8a14'), 0.5), 3.56],
      [hexToRgb('#6b8a14'), 3.98],
      [mixSrgb(hexToRgb('#6b8a14'), hexToRgb('#8c6400'), 0.5), 4.67],
      [hexToRgb('#8c6400'), 5.33],
    ];
    for (const [rgb, expected] of steps) {
      expect(contrastRatioRgb(rgb, white)).toBeCloseTo(expected, 2);
    }
  });

  it('computes the WCAG relative luminance of white as 1', () => {
    expect(luminanceRgb([255, 255, 255])).toBeCloseTo(1, 9);
  });
});
