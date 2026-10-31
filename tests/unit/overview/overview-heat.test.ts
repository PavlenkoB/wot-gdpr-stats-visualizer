import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HEAT_STOPS, heatColor } from '../../../src/lib/features/overview/overview-heat.ts';
import { contrastRatio, relativeLuminance } from '../../helpers/contrast.ts';
import { readTokenSource } from '../../helpers/styles.ts';

// =============================================================================
// The Overview VALUE SCALE (13-04 Task 1, D-13, D-22)
// =============================================================================
//
// Three directions are pinned, for the reason the ramp tests in
// `tests/unit/charts/contrast.test.ts` give: a scale is a SEQUENCE, and a
// drift in one step breaks the guarantee the scale exists to carry without
// any other check noticing.
//
//   1. STYLESHEET -> MODULE: the three `--heat-*` declarations in the token
//      stylesheet are the three stops in `HEAT_STOPS`, channel for
//      channel. The stylesheet is the single place a colour is written down;
//      the module holds numbers so the ramp can be sampled per bar.
//   2. SCALE -> FLOOR: every colour along the eased ramp clears 3:1 against
//      the white tile, and the ramp's luminance falls as the value rises, so
//      the peak is the darkest bar in greyscale too.
//   3. MODULE -> SOURCE: the module holds no colour literal of its own, so
//      the project colour guard needs no allow-list entry for it and a second
//      copy of a hex cannot appear.
//
// The minimum contrast is recorded here as 3.107:1, which is the LIGHTEST
// stop: the ramp gets darker from there, so the lightest stop is the floor
// for the whole scale.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HEAT_MODULE = readFileSync(
  path.join(REPO_ROOT, 'src/lib/features/overview/overview-heat.ts'),
  'utf8',
);

/**
 * The token source: the stylesheet a custom property is declared in.
 *
 * The reader asks for a DECLARATION rather than for a file, so the token's
 * location is not part of the contract this file asserts.
 */
const TOKEN_SOURCE = readTokenSource();

/** The `--name: #hex;` declaration in the token source, lower-cased. */
function tokenValue(name: string): string {
  const match = TOKEN_SOURCE.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-f]{3,6})\\s*;`, 'i'));
  if (match === null) throw new Error(`the token source declares no ${name} token`);
  return (match[1] as string).toLowerCase();
}

/** The channel values of a hex colour. */
function channels(hex: string): readonly [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/** The channel values of the module's own stop, as a hex string. */
function stopHex(index: number): string {
  const stop = HEAT_STOPS[index] as readonly [number, number, number];
  return `#${stop.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** 201 evenly spaced samples of the ramp, from t = 0 to t = 1 inclusive. */
function rampSamples(): number[] {
  return Array.from({ length: 201 }, (_, index) => index / 200);
}

describe('the Overview value scale (13-UI-SPEC Color, D-13, D-22)', () => {
  it('the module stops are the three stylesheet tokens, channel for channel', () => {
    expect(HEAT_STOPS).toHaveLength(3);
    const tokens = ['--heat-low', '--heat-mid', '--heat-peak'];
    tokens.forEach((token, index) => {
      expect([...channels(tokenValue(token))], `${token} against HEAT_STOPS[${index}]`).toEqual([
        ...(HEAT_STOPS[index] as readonly [number, number, number]),
      ]);
    });
  });

  it('the endpoints are the endpoints of the scale', () => {
    expect(heatColor(0)).toBe(tokenValue('--heat-low'));
    expect(heatColor(1)).toBe(tokenValue('--heat-peak'));
  });

  it('the middle stop is returned where the eased position is exactly the middle', () => {
    // u = t^1.5 * 2 is 1 at t = 0.5^(2/3): the low-to-mid segment has just
    // ended, so the colour is the middle stop itself.
    const mid = Math.pow(0.5, 2 / 3);
    expect(heatColor(mid)).toBe(tokenValue('--heat-mid'));
  });

  it('clamps out-of-range and non-finite values to the ends of the scale', () => {
    expect(heatColor(2)).toBe(tokenValue('--heat-peak'));
    expect(heatColor(-1)).toBe(tokenValue('--heat-low'));
    // A NaN or an infinity is a bar with no magnitude, not a bar with a very
    // large one: it is painted as the bottom of the scale, never as the peak.
    expect(heatColor(Number.NaN)).toBe(tokenValue('--heat-low'));
    expect(heatColor(Number.POSITIVE_INFINITY)).toBe(tokenValue('--heat-low'));
    expect(heatColor(Number.NEGATIVE_INFINITY)).toBe(tokenValue('--heat-low'));
  });

  it('every colour along the ramp clears 3:1 against the white tile', () => {
    let minimum = Number.POSITIVE_INFINITY;
    for (const t of rampSamples()) {
      const ratio = contrastRatio(heatColor(t), '#ffffff');
      minimum = Math.min(minimum, ratio);
    }
    // The recorded minimum is 3.107:1, at the lightest stop. The assertion
    // carries a 0.01 tolerance because the contract records two decimals and
    // a guard that demanded the rounding be reproduced would fail on a
    // correct implementation.
    expect(minimum).toBeGreaterThanOrEqual(3);
    expect(minimum).toBeCloseTo(3.107, 2);
  });

  it('the ramp gets darker as the value rises, so the peak reads in greyscale', () => {
    // The scale is monotone BEFORE the channels are rounded: the interpolation
    // itself never brightens. The painted colours are quantised to 8 bits
    // per channel (a hex colour cannot hold a fraction), so a painted sample
    // may sit a hair above its predecessor — never by more than the
    // quantisation step of one channel, which is bounded by the largest
    // channel weight divided by 255.
    const quantisation = 0.005;
    const luminances = rampSamples().map((t) => relativeLuminance(heatColor(t)));
    for (let index = 1; index < luminances.length; index += 1) {
      expect(luminances[index]).toBeLessThanOrEqual(
        (luminances[index - 1] as number) + quantisation,
      );
    }
    // And the claim that matters: the peak is the darkest thing on the scale.
    expect(relativeLuminance(heatColor(1))).toBeLessThan(relativeLuminance(heatColor(0)));
    // The three stops fall strictly, which is the recorded fact (0.288,
    // 0.214, 0.147).
    const stopLuminances = HEAT_STOPS.map((_, index) => relativeLuminance(stopHex(index)));
    for (let index = 1; index < stopLuminances.length; index += 1) {
      expect(stopLuminances[index]).toBeLessThan(stopLuminances[index - 1] as number);
    }
  });

  it('the scale itself falls monotonically, before the channels are rounded', () => {
    // The painted colours are quantised to 8 bits per channel, so a painted
    // sample may sit a hair above its predecessor. The SCALE has no such
    // freedom: the interpolation itself never brightens, and this is the
    // assertion that says so — computed from the stops at FULL PRECISION, so
    // the quantisation cannot hide a real regression.
    //
    // The WCAG channel maths is re-derived here because the shared helper
    // takes a hex, and a fractional channel is the whole point of this
    // measurement.
    const channel = (value: number): number => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminanceOf = (channels: readonly number[]): number =>
      0.2126 * channel(channels[0] as number) +
      0.7152 * channel(channels[1] as number) +
      0.0722 * channel(channels[2] as number);

    let previous = Number.POSITIVE_INFINITY;
    for (const t of rampSamples()) {
      const u = t ** 1.5 * 2;
      const segment = u >= 2 ? 1 : Math.floor(u);
      const fraction = u - segment;
      const from = HEAT_STOPS[segment] as readonly [number, number, number];
      const to = HEAT_STOPS[segment + 1] as readonly [number, number, number];
      const luminance = luminanceOf(
        from.map((channelValue, index) => {
          const end = to[index] as number;
          return channelValue + (end - channelValue) * fraction;
        }),
      );
      expect(luminance).toBeLessThanOrEqual(previous);
      previous = luminance;
    }
  });

  it('the module holds no colour literal, so the project colour guard needs no entry', () => {
    // The guard scans for a hex of three, four, six or eight digits and for
    // the openings of the colour functions. A six-digit colour written here
    // would be a second copy of a value the token stylesheet owns.
    const hexLine = /#[0-9a-fA-F]{3,8}\b/.exec(HEAT_MODULE);
    expect(hexLine, 'overview-heat.ts holds no hex colour').toBeNull();
    expect(HEAT_MODULE).not.toMatch(/\brgba?\(/);
  });
});
