<script lang="ts">
  import type { DurationRow } from './playtime-model.ts';
  import {
    DURATION_BIN_LABELS,
    DURATION_LIST_ARIA_LABEL,
    formatDurationRowText,
  } from '../../ui-copy.ts';

  /**
   * The session length list: twelve bins from "Under 1 min" to "16+ hours",
   * each with a bar and its count (D-05).
   *
   * ## Why it is a list and not a second grid
   *
   * The hour grid is an interactive widget with a roving focus stop, a
   * keyboard model and a tooltip, because each cell hides its value behind
   * colour and needs a way to be read precisely. Every row here already says
   * everything it means in text — the range, the count and the share — so a
   * tooltip would repeat text that is already on screen, and a focus stop would
   * be twelve extra stops of announced text for a reader who can read the
   * whole list at once.
   *
   * It is an `<ol>` because the bins are an ordered scale, and the markers are
   * removed (`list-style: none`) because the order is carried by the labels
   * themselves, which run "Under 1 min" to "16+ hours" in reading order. It is
   * named by `DURATION_LIST_ARIA_LABEL` so it is announced as the list of
   * sessions by length rather than as an anonymous set of rows.
   *
   * ## Why twelve rows whatever the data says
   *
   * The bin edges are the same for every export (D-05), so the twelve rows are
   * a property of the scale rather than of the data. A slice with two sessions
   * shows both of them against the same twelve buckets, and an empty bin shows
   * as `0` with no bar — the honest reading, since those sessions did not
   * happen, as against a bin holding sessions under 0.5% of the total, which
   * reads `<1` rather than `0` for the same reason.
   *
   * ## Why the bars are one colour and not the scale
   *
   * The heat scale is a SEQUENTIAL scale, and these bars are not sequential:
   * they are counts of unrelated buckets, so a longer bar is "more sessions in
   * this bucket", not "more of something the reader already has a frame for".
   * Painting them on five steps would imply an ordering the reader has to
   * learn. So every bar is the same mid stop of the heat scale (`--heat-3`)
   * and the LENGTH is the encoding. The number beside it is the precise
   * value, so nothing is carried by colour at all.
   *
   * ## Why the bar's own `viewBox`
   *
   * `row.barWidth` is a percentage of the LARGEST bin, so a session lasting
   * four minutes is still a visible bar beside a twelve-hour one instead of a
   * hairline. The svg is `0 0 100 12` with `preserveAspectRatio="none"`, which
   * lets the rect's width be that number directly and lets the bar span the
   * column at any width. The distortion that stretching implies costs nothing
   * here because the graphic is one solid rectangle — unlike the hour grid,
   * whose 14px axis text and 24px cell pitch are why THAT svg has no
   * `viewBox` at all.
   */
  interface Props {
    /** The twelve rows, from `buildDurationRows`. */
    rows: readonly DurationRow[];
    /** Usable sessions in the slice, the denominator for the share. */
    sessions: number;
  }

  let { rows, sessions }: Props = $props();
</script>

<ol class="rows" data-testid="duration-chart" aria-label={DURATION_LIST_ARIA_LABEL}>
  {#each rows as row (row.bin)}
    <!--
      Three columns — a fixed label, a flexible bar track, a fixed count — so
      all twelve bars share one left edge and all twelve counts share one right
      edge, and the reader compares lengths rather than right-hand ends. The
      16px gap is the sm token.
    -->
    <li class="row" data-testid="duration-bin" data-bin={row.bin} data-count={row.count}>
      <span class="label">{DURATION_BIN_LABELS[row.bin]}</span>

      <!--
        `preserveAspectRatio="none"` so the 0-100 width attribute is stretched
        to the column, and `focusable="false"` because an `aria-hidden` graphic
        is not a stop and the browsers that would still make it one are told
        not to. The bar is not focusable, so a keyboard reader reaches the
        count as text on the same row instead.
      -->
      <svg
        class="bar"
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
        height="12"
      >
        <!--
          Only a bin that holds sessions gets a rect. A zero-width rect is a
          hairline of colour where there is nothing to count, and it reads as
          "a very small amount" rather than as "none".
        -->
        {#if row.count > 0}
          <rect class="bar-rect" x="0" y="0" width={row.barWidth} height="12" />
        {/if}
      </svg>

      <span class="count">{formatDurationRowText(row.count, sessions)}</span>
    </li>
  {/each}
</ol>

<style>
  /*
    The list is a grid with a 4px row gap rather than a margin on each item: a
    gap does not collapse, so the spacing between the last bar of one row and
    the first label of the next is the same 4px as everywhere else. The markers
    are removed because the labels are the order.
  */
  .rows {
    display: grid;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
    min-width: 0;
  }

  /*
    At phone width the row becomes two lines: label and count share the first
    line and the bar takes a full-width line of its own (the rules are in the
    phone block of `src/app.css`, keyed on this list's test id). At 375px a 96px
    label column, a 104px count column and a 16px gap leave the bar about 150px,
    and twelve such bars in a row are twelve hard-to-compare marks. A media query
    rather than a second set of markup: two markups would be two places for the
    copy to diverge.
  */
  .row {
    display: grid;
    grid-template-columns: 96px 1fr 104px;
    align-items: center;
    gap: var(--space-16);
    min-width: 0;
  }

  /* The bin range, and the count beside it, are both Caption role (UI-SPEC
     Typography): the range is a label and the count is the value it belongs
     to, and neither is a heading. */
  .label,
  .count {
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-tight);
    color: var(--text);
    min-width: 0;
  }

  /* The counts are compared down a column, so the digits line up. */
  .count {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* `display: block` keeps the inline svg from adding a line-height gap under
     itself, which would break the 4px rhythm of the grid. */
  .bar {
    display: block;
    width: 100%;
    min-width: 0;
  }

  /*
    One step of the one heat scale, for every bar: the mid stop, which clears
    3:1 on white. The 1px white stroke is the bar's own separator so two
    adjacent bars of the same colour never merge into one block, and with the
    stretched viewBox it is a horizontal hairline rather than a 1px one —
    invisible at these sizes and never thicker than the bar.
  */
  .bar-rect {
    fill: var(--heat-3);
    stroke: var(--white);
    stroke-width: 1;
  }
</style>
