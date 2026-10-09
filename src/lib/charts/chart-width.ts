/**
 * The one rule that turns a MEASURED container width into a usable chart width
 * (plan 08-20, gap G-08-3).
 *
 * A chart's svg is a fixed size and is never scaled (no viewBox), so the 14px
 * axis text stays 14px. To use the whole detail pane the component measures the
 * block its parent sizes (never the svg itself, which would feed back) and
 * re-lays the chart out at that width. This module decides whether a measured
 * number is believable.
 *
 * Today's geometry is the FLOOR of every layout: a model asked for a width it
 * cannot beat, or given no usable width at all, returns exactly the geometry it
 * always did. That is what keeps the phone and the very long spans unchanged.
 *
 * Pure and DOM-free so Vitest can pin it.
 */

/**
 * The room the 3px focus ring and its 1px outer stroke overhang on the right of
 * a chart that fills its box. Plan 08-21 uses it for the heatmaps.
 */
export const CHART_RING_PAD_PX = 4;

/**
 * A measured width the layout may use, or null for "not measured".
 *
 * Null for zero (the width before the first observation), NaN, a negative,
 * either Infinity, and anything that is not a number (T-08-53). The result is
 * floored, so a filled chart can never be wider than its box (a fractional
 * content width would otherwise grow a stray scrollbar). There is deliberately
 * NO upper clamp: charts fill the pane at any width, and the browser itself
 * bounds a layout width.
 */
export function usableChartWidth(measured: unknown): number | null {
  if (typeof measured !== 'number' || !Number.isFinite(measured) || measured <= 0) {
    return null;
  }
  const floored = Math.floor(measured);
  return floored >= 1 ? floored : null;
}
