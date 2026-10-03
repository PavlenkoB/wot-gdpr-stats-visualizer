/**
 * The monthly bar chart's geometry, as pure functions (05-09).
 *
 * Phase 4's rule, applied here before the component exists: THE MODEL HOLDS NO
 * WORDS AND BUILDS NO COPY. Every user-facing string belongs to the Phase 5
 * copy inventory, and every component formats. A month index crosses this
 * boundary as a plain number, so the caller converts the exact decimal values
 * to numbers first and the model never sees BigInt.
 *
 * Vitest runs with no DOM, which is the reason any of this is here at all: a
 * decision that lived inside a Svelte component could not be tested. Here the
 * pitch rule, the two domains, the label stride, the node bound and the keyboard
 * reducer are all assertable, and 05-11 becomes wiring.
 *
 * Two domains, because the two charts measure different things (D-15). Premium
 * time is a single upward series whose domain is the largest single month.
 * Currency flow is two series over ONE scale — the same number of pixels per
 * unit above the zero line and below it — so a deposit bar and a withdrawal
 * bar of the same amount are the same height and the chart's one promise (the
 * two directions are comparable) is kept.
 *
 * What the currency chart does NOT fix is where the zero line sits. An earlier
 * version gave both sides 80px of the 160px plot, which is only honest when the
 * two sides happen to be equal: a currency that is almost all deposits spent
 * half its plot on an empty band and floated a large negative label far from any
 * bar. So the plot is DIVIDED in proportion to the two sides' extents, where a
 * side's extent is its own largest month, but never less than
 * {@link CURRENCY_MIN_SIDE_DIVISOR}'th of the other side's largest month. That
 * floor is 32px, which is what keeps the 14px zero label and the bottom label
 * from ever touching, and it is why the smaller side can be squashed but never
 * to nothing. One scale, two extents, a floor: the honesty is the scale, the
 * tidiness is the split.
 */

/** Which of the two monthly charts is being built. */
export type BarChartKind = 'premium' | 'currency';

/** The keys the chart's own keydown handler acts on. */
export type BarChartKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/** One rectangle in chart coordinates. */
export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One month of the axis, present whether or not the month has data.
 *
 * `hasData` is what separates "this month is in the export and granted nothing"
 * from "this month is not in the export at all" (D-17): the axis runs from the
 * first usable month to the last inclusive and every month in between is drawn,
 * so a gap in the history is a gap the reader can see rather than a month
 * silently pulled forward.
 */
export interface BarCell {
  /** Position on the axis, 0 for the first month. */
  index: number;
  month: number;
  x: number;
  /** The full pitch, so a hairline bar still has a pointer target. */
  hitWidth: number;
  hasData: boolean;
  up: BarRect | null;
  down: BarRect | null;
}

/** One `YYYY-MM` label on the x axis. The component formats the month. */
export interface AxisLabel {
  index: number;
  month: number;
  x: number;
}

export interface BarChartModel {
  kind: BarChartKind;
  monthCount: number;
  pitch: number;
  barWidth: number;
  width: number;
  height: number;
  /** The premium baseline; for currency it is the zero line between the sides. */
  zeroY: number;
  plotTop: number;
  plotHeight: number;
  domainMax: number;
  /**
   * The extent of the space ABOVE the zero line, in the input's own units.
   *
   * For a currency chart it is the larger of the largest deposit month and a
   * quarter of the largest withdrawal month, so it is not always a month that
   * exists — the y-axis label names the axis value rather than a data point,
   * which is why the label is built from the exact bigint extent beside this
   * float (`currencyChartInput`) and not from this number. For the premium
   * chart it is simply the domain, and `domainDown` is 0.
   */
  domainUp: number;
  /** The extent BELOW the zero line: the same rule with the sides swapped. */
  domainDown: number;
  cells: BarCell[];
  labels: AxisLabel[];
  /** True when the plot is wider than the column and the chart scrolls. */
  scrolls: boolean;
  /** The nodes this chart puts in the DOM if the component draws one node per item. */
  nodeCount: number;
  /** The ceiling `nodeCount` is asserted against (T-05-26). */
  nodeBudget: number;
}

/**
 * The chart's input: a month span and the months that have data.
 *
 * `months` is SPARSE — plan 05-04's views carry only months with an operation —
 * and its values are already plain numbers. Premium uses `up` only.
 */
export interface BarChartInput {
  kind: BarChartKind;
  firstMonth: number;
  lastMonth: number;
  months: readonly { month: number; up: number; down: number }[];
}

/**
 * Every number the chart is built from, each with the UI-SPEC row it comes
 * from. The column is 720px wide at desktop and 375px at phone width; 576px is
 * the plot that fits inside it with the 56px y-axis gutter and the 4px right
 * padding still in view.
 */
export const BAR_LAYOUT = {
  /** UI-SPEC section 6: the y-axis label column, which is also the left padding. */
  gutterPx: 56,
  /** UI-SPEC section 6: a hairline of air so the last bar is not flush to the edge. */
  rightPadPx: 4,
  /** UI-SPEC section 6: air above the plot, where the domain label sits. */
  topPadPx: 8,
  /** UI-SPEC section 6: the band under the plot that holds the x-axis labels. */
  axisBandPx: 24,
  /** UI-SPEC section 6: the premium plot is one direction, so it gets it all. */
  premiumPlotPx: 96,
  /** UI-SPEC section 6: the currency plot, which is DIVIDED by the two extents. */
  currencyPlotPx: 160,
  /** UI-SPEC section 6: the widest plot that fits without scrolling. */
  maxPlotWidthPx: 576,
  /** How much room a `YYYY-MM` label needs, so a label near the right edge can be dropped. */
  labelWidthPx: 56,
  /**
   * UI-SPEC Spacing "Chart bar pitch", as amended by plan 05-22: the widest
   * pitch a month can take. A bar is a mark and not a panel, so a short chart
   * keeps 16px and stays narrow rather than filling the card.
   */
  maxPitchPx: 16,
  /**
   * The same row, and the floor. 4px is the narrowest month a 14px axis label
   * and a 1px gap can live with, and 144 of them is exactly the 576px plot.
   */
  minPitchPx: 4,
  /** UI-SPEC section 6 "X axis (D-26)": two labels are never closer than this. */
  labelMinGapPx: 96,
  /** Above this many months the chart scrolls, because even pitch 4 overflows. */
  scrollThresholdMonths: 144,
} as const;

/**
 * The y-axis carries four compact values — top, both bound hairlines and the
 * zero line. Deliberately a count, not a list: these are the currency chart's
 * axis labels, and the premium chart draws the same frame.
 */
const Y_AXIS_LABEL_COUNT = 4;

/**
 * The label stride in months, and the wider one the narrow pitches fall back to.
 *
 * A label every twelfth month is `LABEL_STRIDE x pitch` pixels from the one
 * before it, so the stride has to follow the pitch: below a pitch of 8 that is
 * under the UI-SPEC's 96px gap and the stride doubles. The floor holds at every
 * pitch the model can produce, because 24 x 4 is exactly 96.
 */
const LABEL_STRIDE = 12;
const WIDE_LABEL_STRIDE = 24;

/**
 * The LARGEST WHOLE PIXEL per month, from 4 to 16, that still fits the column.
 *
 * The rule is `floor(576 / months)` clamped to that range, rather than a ladder
 * of a few named steps. A ladder answers in steps of four, so a chart whose
 * month count happened to land just past a step lost most of its width: 73
 * months drew 292 of 576px, half the plot, while 116 months and 115 months
 * differ by nothing at all. A whole-pixel pitch fills 80.6% to 100% of the plot
 * for 37 to 144 months, and the two ends of the range are unchanged — 36 months
 * at 16px fills it exactly, and 144 months at 4px fills it exactly.
 *
 * This does not make the charts equal in width, and it is not trying to. Each
 * chart still spans ITS OWN months (D-17, locked to "from the first operation")
 * and keeps its own scale (D-15), so equal widths would need a shared month
 * axis or a stretched frame — and a stretched frame draws a flat zero line
 * across months that are not in the data, which reads as "nothing happened".
 * The SVG stays a fixed size and is never scaled, so the axis text stays 14px.
 * Widths become near-equal rather than equal, and the axis keeps meaning what
 * it says.
 */
export function pitchFor(monthCount: number): number {
  const months = Math.floor(monthCount);
  // A count that is not finite has no ratio to take, so it gets the narrowest
  // pitch; a count under 1 has nothing to fit and gets the widest. Neither may
  // return a NaN, which would put the geometry somewhere unrecoverable
  // (T-05-63).
  if (!Number.isFinite(months)) {
    return BAR_LAYOUT.minPitchPx;
  }
  if (months < 1) {
    return BAR_LAYOUT.maxPitchPx;
  }
  return Math.min(
    BAR_LAYOUT.maxPitchPx,
    Math.max(BAR_LAYOUT.minPitchPx, Math.floor(BAR_LAYOUT.maxPlotWidthPx / months)),
  );
}

/**
 * How much of the other side's maximum the smaller side is guaranteed.
 *
 * A currency chart divides its 160px plot between the two directions in
 * proportion to their extents. Without a floor, a currency whose deposits are
 * a thousand times its withdrawals would give the withdrawal side a fraction
 * of a pixel, the 14px `0` label would sit on the `−15K` label, and the axis
 * would be unreadable — so the smaller side is never given less than this
 * fraction of the larger side's own maximum. Four makes the floor 32px, which
 * is two text lines with air.
 *
 * It is exported rather than kept private because `currencyChartInput`
 * computes the EXACT bigint extents for the axis labels under the same rule,
 * and a second copy of "a quarter" in another file is a second thing to forget
 * to change (D-15, D-17, D-25).
 */
export const CURRENCY_MIN_SIDE_DIVISOR = 4;

/**
 * A value the chart is willing to measure, or zero.
 *
 * Amounts arrive from a CSV the app did not write, so an `Infinity`, a `NaN` or
 * a negative amount is a real possibility rather than a hypothetical one. Every
 * one of them reads as zero HERE, before any extent is computed, because a
 * `NaN` height would be the worst of the possible outcomes: a bar in an
 * unrecoverable place, with a count that still claims the month exists (T-05-60).
 */
function usableAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * The currency plot's split: how much of it goes ABOVE the zero line.
 *
 * Rounded, and the down room is the remainder rather than a second rounding —
 * two independently rounded halves would either lose a pixel of plot or
 * overflow it. A span that is zero or not finite has nothing to divide by, so
 * the even split stands in, which is also what an empty chart gets.
 */
function currencyUpRoom(plotHeight: number, domainUp: number, span: number): number {
  if (!(span > 0) || !Number.isFinite(span)) {
    return plotHeight / 2;
  }
  return Math.round(plotHeight * (domainUp / span));
}

/**
 * A bar's height in whole pixels, linear from zero.
 *
 * Zero is zero for a month with no value and for a chart with no domain, so
 * there is no division by zero. A POSITIVE value is never rounded away to
 * nothing: a month that granted a hundredth of a day against a five-year
 * maximum still gets 2px, because the floor is the difference between "a small
 * month" and "no month". The exact figure is always available from the tooltip,
 * the cell's accessible name and the monthly table, so the 2px bar never has to
 * be the only statement of the value.
 *
 * `roomPx` is the pixels one side of the zero line has, and `domainMax` is the
 * span over the WHOLE plot — so on a currency chart both sides are scaled by
 * the same number and the two are comparable.
 */
export function barHeight(value: number, domainMax: number, roomPx: number): number {
  if (!(value > 0) || !(domainMax > 0)) {
    return 0;
  }
  return Math.max(2, Math.round((value / domainMax) * roomPx));
}

/**
 * The node ceiling for a chart of this many months (T-05-26).
 *
 * Three nodes per month — one pointer target, and at most two bars — plus a
 * fixed 40 for the frame. The month span is bounded at 1,572 by the date
 * window, so even the widest possible export is inside this bound; the test
 * asserts it at 1, 56, 144 and 240 months with both bar directions in every
 * month, which is the worst case.
 */
export function nodeBudget(monthCount: number): number {
  return 3 * Math.max(0, Math.floor(monthCount)) + 40;
}

/**
 * Build the whole chart: axis, pitch, geometry, labels, the node count and the
 * keyboard's own bounds.
 *
 * The axis runs from `firstMonth` to `lastMonth` INCLUSIVE and is never
 * shorter than one month, so a chart is never zero-wide (the UI-SPEC
 * zero-one-many consideration: one month is one cell and one label, not an
 * empty axis).
 */
export function buildBarChartModel(input: BarChartInput): BarChartModel {
  const firstMonth = input.firstMonth;
  const monthCount = Math.max(1, Math.floor(input.lastMonth - firstMonth) + 1);
  const pitch = pitchFor(monthCount);
  const barWidth = pitch - 1;
  const plotWidth = monthCount * pitch;
  const width = BAR_LAYOUT.gutterPx + plotWidth + BAR_LAYOUT.rightPadPx;
  const isCurrency = input.kind === 'currency';
  const plotTop = BAR_LAYOUT.topPadPx;
  const plotHeight = isCurrency ? BAR_LAYOUT.currencyPlotPx : BAR_LAYOUT.premiumPlotPx;
  const height = plotTop + plotHeight + BAR_LAYOUT.axisBandPx;

  // The month a sparse entry belongs to, by its INDEX on the axis. An entry
  // outside the span belongs to no cell and is ignored rather than clamped in.
  // Values are sanitized on the way in (T-05-60), so nothing downstream has to
  // ask whether a number is finite.
  const byMonth = new Map<number, { up: number; down: number }>();
  for (const entry of input.months) {
    const index = entry.month - firstMonth;
    if (index < 0 || index >= monthCount) {
      continue;
    }
    byMonth.set(index, { up: usableAmount(entry.up), down: usableAmount(entry.down) });
  }

  // The two sides' own maxima. The premium chart ignores `down` entirely: it is
  // one direction, and a `down` in its input is not a thing it can draw.
  let upMax = 0;
  let downMax = 0;
  for (const entry of byMonth.values()) {
    if (entry.up > upMax) {
      upMax = entry.up;
    }
    if (isCurrency && entry.down > downMax) {
      downMax = entry.down;
    }
  }
  const domainMax = upMax > downMax ? upMax : downMax;

  // The extents the plot is divided by (D-17). Each side's own maximum, floored
  // at a fraction of the other's, so no side can be squeezed out of the chart
  // by the other being large. `domainMax` stays the plain larger-of-the-two
  // figure it has always been, because it is what a reader means by "this
  // chart's maximum" and what the premium axis labels.
  const domainUp = isCurrency ? Math.max(upMax, downMax / CURRENCY_MIN_SIDE_DIVISOR) : domainMax;
  const domainDown = isCurrency ? Math.max(downMax, upMax / CURRENCY_MIN_SIDE_DIVISOR) : 0;

  // ONE scale over the whole plot: `span` is the value of the top of the plot,
  // so `plotHeight / span` is the pixels per unit both sides are drawn with.
  // The premium chart is one direction and always sits on the bottom of its
  // plot, exactly as it did before a currency chart learned to divide its own.
  const span = domainUp + domainDown;
  const upRoom = isCurrency ? currencyUpRoom(plotHeight, domainUp, span) : plotHeight;
  const downRoom = plotHeight - upRoom;
  const zeroY = plotTop + upRoom;

  const cells: BarCell[] = [];
  let barCount = 0;
  for (let index = 0; index < monthCount; index += 1) {
    const entry = byMonth.get(index);
    const x = BAR_LAYOUT.gutterPx + index * pitch;
    // Clamped to its own side's room. The rooms are rounded together, but a bar
    // rounded on its own can land a half pixel over — the 231-and-89 case, where
    // the withdrawal bar rounds to 45 in a 44px room and would cross the bottom
    // hairline. One scale, one clamp per side, no bar leaves the plot.
    const upHeight = entry ? Math.min(barHeight(entry.up, span, plotHeight), upRoom) : 0;
    const downHeight =
      entry && isCurrency ? Math.min(barHeight(entry.down, span, plotHeight), downRoom) : 0;

    // A zero-height bar is not drawn. `hasData` still reports the month, so a
    // month that granted nothing is distinguishable from a month absent.
    const up: BarRect | null =
      upHeight > 0 ? { x, y: zeroY - upHeight, width: barWidth, height: upHeight } : null;
    const down: BarRect | null =
      downHeight > 0 ? { x, y: zeroY, width: barWidth, height: downHeight } : null;
    if (up !== null) {
      barCount += 1;
    }
    if (down !== null) {
      barCount += 1;
    }

    cells.push({
      index,
      month: firstMonth + index,
      x,
      hitWidth: pitch,
      hasData: entry !== undefined,
      up,
      down,
    });
  }

  // The stride follows the pitch rather than sitting at a fixed 12: a label
  // every twelfth month is `12 x pitch` pixels from the last one, so the wider
  // stride is taken exactly when that is under the UI-SPEC's 96px gap. The two
  // cases are a whole-pixel pitch apart — 8 x 12 is exactly 96 and keeps the
  // narrow stride, 7 x 12 is 84 and does not — and 24 x 4 is exactly 96, so
  // the gap holds at every pitch down to the floor.
  const stride = LABEL_STRIDE * pitch < BAR_LAYOUT.labelMinGapPx ? WIDE_LABEL_STRIDE : LABEL_STRIDE;
  const labels: AxisLabel[] = [];
  for (let index = 0; index < monthCount; index += stride) {
    const x = BAR_LAYOUT.gutterPx + index * pitch;
    // The FIRST label is the axis's origin and is never dropped, or a one-month
    // chart would have no label at all. Every later label is dropped when it
    // would run past the right edge, so the last one is never cut in half.
    const isFirst = index === 0;
    if (!isFirst && x + BAR_LAYOUT.labelWidthPx > width) {
      break;
    }
    labels.push({ index, month: firstMonth + index, x });
  }

  // One pointer target per month, every drawn bar, a text and a tick per label,
  // the zero line, the two bound hairlines and the y-axis values.
  const nodeCount = monthCount + barCount + labels.length * 2 + 1 + 2 + Y_AXIS_LABEL_COUNT;

  return {
    kind: input.kind,
    monthCount,
    pitch,
    barWidth,
    width,
    height,
    zeroY,
    plotTop,
    plotHeight,
    domainMax,
    domainUp,
    domainDown,
    cells,
    labels,
    scrolls: plotWidth > BAR_LAYOUT.maxPlotWidthPx,
    nodeCount,
    nodeBudget: nodeBudget(monthCount),
  };
}

/**
 * The chart's keydown reducer: Left, Right, Home, End, clamped at both ends.
 *
 * Clamped rather than wrapping, because wrapping would move a reader who is
 * trying to reach the oldest month to the newest one instead, and the chart
 * would appear to have done nothing.
 */
export function barChartNavigate(index: number, key: BarChartKey, count: number): number {
  const last = Math.max(0, Math.floor(count) - 1);
  const from = Math.min(Math.max(0, Math.floor(index)), last);
  switch (key) {
    case 'ArrowLeft':
      return Math.max(0, from - 1);
    case 'ArrowRight':
      return Math.min(last, from + 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
  }
}

/**
 * Which month the chart takes focus on when it is entered with the keyboard:
 * the LAST one, because the newest month is the one a reader opens a timeline
 * to see. Null when the chart drew no cells at all.
 */
export function initialBarFocus(model: BarChartModel): number | null {
  if (model.cells.length === 0) {
    return null;
  }
  return model.cells[model.cells.length - 1].index;
}
