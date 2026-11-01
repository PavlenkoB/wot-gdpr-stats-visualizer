<script lang="ts">
  import { FLOW_LEGEND_DEPOSITED, FLOW_LEGEND_WITHDRAWN } from '../ui-copy.ts';

  /**
   * The two-direction legend every currency chart shares (05-13, D-27).
   *
   * ## Why this copies ChartLegend's chrome rather than extending it
   *
   * `ChartLegend` renders an ordinal heat SCALE: it takes the levels in use,
   * prints one swatch per level, and its two words are `Less` and `More`. A
   * flow legend has no scale and no ordinal — it names two CATEGORIES,
   * deposits and withdrawals, which is why the words are the whole point of
   * it.
   *
   * The two share their chrome exactly: the same wrapping row, the same 12px
   * square swatch, the same caption type on the words, and the same rule that
   * the swatches are `aria-hidden` because they carry nothing a screen reader
   * needs. That is why this file is a copy and not a prop on `ChartLegend`: a
   * shared component would have taken a "no words, just swatches" branch and a
   * per-swatch colour, and the scale's six-swatch vocabulary would then be
   * present in a component that never draws a scale.
   *
   * ## Why colour is never the only cue
   *
   * `--flow-in` and `--flow-out` sit 1.36:1 apart in luminance — far below the
   * 3:1 a non-text graphic needs (T-05-41). Four things carry the distinction
   * instead, and this legend is the third: the deposit bar is ABOVE the zero
   * line and the withdrawal bar BELOW it, both words here are real text, and
   * every cell carries the figures in its accessible name, its tooltip and its
   * monthly table row. A reader who cannot separate the two hues still knows
   * which is which; a reader who cannot see the chart at all still has the
   * numbers.
   */
  interface Props {
    /** The `data-testid` the owner gives this legend. */
    testId?: string;
  }

  let { testId = 'flow-legend' }: Props = $props();
</script>

<div class="legend" data-testid={testId}>
  <!--
    Real text inside the wrapping row, not a tooltip and not a title. At 375px
    the two phrases and both swatches do not fit on one line, and a legend that
    scrolls horizontally to be read is not a legend — the same reason
    `ChartLegend`'s note is real text.
  -->
  <p class="row t-note">
    <span class="swatch swatch-in" aria-hidden="true"></span>
    <span class="word">{FLOW_LEGEND_DEPOSITED}</span>
    <span class="swatch swatch-out" aria-hidden="true"></span>
    <span class="word">{FLOW_LEGEND_WITHDRAWN}</span>
  </p>
</div>

<style>
  .legend {
    min-width: 0;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4) var(--space-8);
    margin: 0;
    min-width: 0;
    /* The note role (`.t-note`, in the markup), exactly as `ChartLegend`'s row:
       the whole legend is explanatory text, so the words and the swatches are
       all metadata. */
    color: var(--muted);
  }

  /* A swatch, not a border: the mark is the fill, and the fill is read from
     the same two tokens the bars are — so a theme change moves the legend and
     the chart together rather than leaving one of them behind. */
  .swatch {
    width: 12px;
    height: 12px;
    flex: none;
  }

  .swatch-in {
    background: var(--flow-in);
  }

  .swatch-out {
    background: var(--flow-out);
  }

  /* The words wrap within themselves rather than widening the card: a
     currency's name is not in them, but at phone width two phrases and two
     swatches are 100px wider than the column they sit in. */
  .word {
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
