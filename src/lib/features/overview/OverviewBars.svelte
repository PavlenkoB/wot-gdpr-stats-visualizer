<script lang="ts">
  import { peakAt } from './overview-dom.ts';
  import { heatColor } from './overview-heat.ts';

  /**
   * A hand-rolled bar chart for the Overview: hours per year, or hours per
   * hour of day (13-09, D-13, D-22).
   *
   * ## What it draws
   *
   * One `rect` per bar, coloured by VALUE with the green-to-gold heat scale and
   * standing on a 1px baseline, with no grey track behind it: the lightest step
   * of the scale only clears 3:1 against white. The peak bar is the maximum
   * (the first one on a tie) and is named in TEXT above the chart, so the
   * colour is a shortcut and never the message.
   *
   * ## Why the root is `aria-hidden`
   *
   * The tile is one button, and its hidden summary sentence already says what
   * the chart shows and where the peak is. Reading the bars and the axis again
   * would be noise, so the whole chart is hidden from the accessibility tree.
   *
   * ## Why the svg has a viewBox and no fixed width
   *
   * The chart fills its tile, whatever the tile's width is. The `viewBox` has
   * ten units per slot and the aspect ratio is not preserved, so the bars
   * stretch sideways with the tile; the height is a fixed pixel count, so the
   * baseline stays one pixel thick. Fewer bars than the minimum slot count
   * stay left-aligned at a sensible width rather than turning into two slabs.
   *
   * ## Degenerate input
   *
   * No bars draws an empty chart, an all-zero input draws no bar height, and a
   * single bar is a single bar. None of them produces a NaN.
   */
  interface Props {
    /** Which chart this is: it sets the height and the axis labels. */
    kind: 'years' | 'hours';
    /** The bars, in order; `value` is in hours. */
    bars: { label: string; value: number }[];
    /** The text above the chart naming the peak bar. */
    peakLabel: string;
  }

  let { kind, bars, peakLabel }: Props = $props();

  /** Pixel height of the chart: years are taller than the hour-of-day strip. */
  const HEIGHT = $derived(kind === 'years' ? 96 : 48);

  /** Width of one slot, in viewBox units; a bar is the slot less a one-unit gap each side. */
  const SLOT = 10;

  /** The fewest slots a chart spans, so two years do not become two slabs. */
  const MIN_SLOTS = 8;

  /** The least height of a bar that has any value, in pixels. */
  const MIN_BAR = 2;

  const slots = $derived(
    kind === 'hours' ? Math.max(bars.length, 1) : Math.max(bars.length, MIN_SLOTS),
  );

  /** The largest value, never below zero, so the divisions below cannot go negative. */
  const max = $derived(bars.reduce((best, bar) => (bar.value > best ? bar.value : best), 0));

  /**
   * Where the peak bar's centre sits across the plot, 0 to 100. The peak is the
   * FIRST bar holding the maximum, the same bar the face names, and a chart
   * with no value anywhere puts its label at the left.
   */
  const peakPercent = $derived.by(() => {
    const at = max > 0 ? bars.findIndex((bar) => bar.value === max) : -1;
    return at < 0 ? 0 : ((at * SLOT + SLOT / 2) / (slots * SLOT)) * 100;
  });

  /** The drawn bars: position, height and colour. */
  const drawn = $derived(
    bars.map((bar, index) => {
      const available = HEIGHT - 1;
      const t = max > 0 ? Math.min(Math.max(bar.value / max, 0), 1) : 0;
      const height = bar.value > 0 && max > 0 ? Math.max(MIN_BAR, t * available) : 0;
      return {
        x: index * SLOT + 1,
        y: available - height,
        height,
        fill: heatColor(t),
        label: bar.label,
      };
    }),
  );

  /** The axis labels: the first and last year, or 00, 06, 12 and 18. */
  const axis = $derived.by(() => {
    if (kind === 'hours') return ['00', '06', '12', '18'];
    const first = bars[0];
    const last = bars[bars.length - 1];
    if (first === undefined || last === undefined) return [];
    return bars.length === 1 ? [first.label] : [first.label, last.label];
  });
</script>

<span class="chart" aria-hidden="true">
  <span class="peak"><span class="peak-text" use:peakAt={peakPercent}>{peakLabel}</span></span>
  <svg
    class="plot"
    width="100%"
    height={HEIGHT}
    viewBox="0 0 {slots * SLOT} {HEIGHT}"
    preserveAspectRatio="none"
    focusable="false"
  >
    {#each drawn as bar, index (index)}
      <rect
        class="bar"
        x={bar.x}
        y={bar.y}
        width={SLOT - 2}
        height={bar.height}
        fill={bar.fill}
        shape-rendering="crispEdges"
      />
    {/each}
    <rect class="baseline" x="0" y={HEIGHT - 1} width={slots * SLOT} height="1" />
  </svg>
  <span class="axis" class:hours={kind === 'hours'} class:spread={bars.length >= MIN_SLOTS}>
    {#each axis as label, at (at)}
      <span class="tick">{label}</span>
    {/each}
  </span>
</span>

<style>
  .chart {
    display: block;
    min-width: 0;
    margin-top: 8px;
  }

  .peak {
    display: block;
    position: relative;
    height: 1.4em;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--muted);
    margin-bottom: 4px;
  }

  /* Over the peak bar: left is the bar's centre, and the same share of the
     label's own width is pulled back, so the label is centred mid-chart, flush
     left at the left edge and flush right at the right edge, and always spans
     the bar's centre. */
  .peak-text {
    position: absolute;
    top: 0;
    left: calc(var(--peak-at, 0) * 1%);
    transform: translateX(calc(var(--peak-at, 0) * -1%));
    white-space: nowrap;
  }

  .plot {
    display: block;
    width: 100%;
    overflow: visible;
  }

  .baseline {
    fill: var(--faint);
  }

  .axis {
    display: flex;
    gap: 8px;
    margin-top: 4px;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--muted);
  }

  /* The year labels sit under the first and the last bar once there are
     enough bars to span the chart. */
  .axis.spread {
    justify-content: space-between;
  }

  /* Hour-of-day: four equal quarters, so each label starts under its hour. */
  .axis.hours {
    gap: 0;
  }

  .axis.hours .tick {
    flex: 1 1 0;
  }

  @media (forced-colors: active) {
    .bar {
      fill: CanvasText;
    }

    .baseline {
      fill: CanvasText;
    }
  }
</style>
