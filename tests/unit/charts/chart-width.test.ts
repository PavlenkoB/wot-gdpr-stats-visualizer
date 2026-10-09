/**
 * 08-20: the rule that decides whether a measured width is usable (T-08-53).
 */
import { describe, expect, it } from 'vitest';
import { CHART_RING_PAD_PX, usableChartWidth } from '../../../src/lib/charts/chart-width';

describe('chart-width', () => {
  it('reserves 4px for the ring overhang', () => {
    expect(CHART_RING_PAD_PX).toBe(4);
  });

  it.each([0, -5, Number.NaN, Infinity, -Infinity, undefined, null, '800', 0.4])(
    'treats %s as not measured',
    (value) => {
      expect(usableChartWidth(value)).toBeNull();
    },
  );

  it('floors a fractional width', () => {
    expect(usableChartWidth(879.9)).toBe(879);
  });

  it('passes whole widths through with no upper clamp', () => {
    expect(usableChartWidth(879)).toBe(879);
    expect(usableChartWidth(1500)).toBe(1500);
    expect(usableChartWidth(4000)).toBe(4000);
    expect(usableChartWidth(1)).toBe(1);
  });
});
