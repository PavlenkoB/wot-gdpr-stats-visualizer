<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { OverviewGroupId } from './overview-shared.ts';

  /**
   * One group of the bento: its heading, its legend and its grid (13-09, D-10,
   * D-15; 13-UI-SPEC Groups and Headings).
   *
   * ## The heading
   *
   * An `h3` in the Label role with the group's dot before the text, a hairline
   * that fills the rest of the row and, for a group that holds a chart, the
   * value-scale legend: a 48px by 8px swatch between the words low and peak.
   * The dot and the swatch are decorative (`aria-hidden`); the words carry the
   * meaning. The legend is a sibling of the heading rather than part of it, so
   * the heading's accessible name is the group's name and nothing else.
   *
   * ## The grid, and why Pinned does not pack
   *
   * Columns follow the Overview ROOT's width (a container), not the viewport:
   * four columns from 880px, two from 480px, one below. The gap is 16px on
   * both axes at every width.
   *
   * The four catalogue groups use `grid-auto-flow: dense`: the fill rule was
   * designed for it, and it rejects every combination that would show a tile
   * before an earlier one, so those groups never reorder.
   *
   * The PINNED group does not. A pin can be ANY subset of the sixteen tiles,
   * and under dense packing a narrow tile is pulled up into a gap beside a hero
   * or a wide feature, ahead of tiles that come before it in the catalogue;
   * 13-06 counted 32,160 of the 65,535 non-empty pin subsets doing exactly
   * that. A metric listed before a hero would then read after it. Pinned uses
   * the default sparse flow instead: every tile is placed after the previous
   * one, so the screen always reads in catalogue order. A gap beside a hero
   * can stay empty, which is a better price than a reordered page, and the
   * feature widths for this group are chosen by a SPARSE simulation
   * (`fillSpans(sizes, 'sparse')`, 13-12) so the fill rule minimises the holes
   * this flow leaves. (Decision recorded in 13-09-SUMMARY.md.)
   *
   * ## An open tile
   *
   * While a tile in the grid is open, the grid aligns its items to the start,
   * so siblings keep their natural height instead of stretching into empty
   * boxes. The `:global` wrapper is needed because the `tile` and `open`
   * classes belong to the child component, and a scoped selector naming a
   * child's class is otherwise dropped as unused.
   */
  interface Props {
    /** The group's key; `pinned` is the derived group of pinned tiles. */
    id: 'pinned' | OverviewGroupId;
    /** The heading text. */
    heading: string;
    /** Whether the group holds a chart, so the legend is shown. */
    legend: boolean;
    /** The word under the low end of the legend. */
    low: string;
    /** The word under the peak end of the legend. */
    peak: string;
    /** The tiles. */
    children: Snippet;
    /** The group's dashed "Not in this export" row, drawn after the grid. */
    absent?: Snippet;
    /** The grid holds loading placeholders: marks it `aria-busy` (13-12). */
    busy?: boolean;
  }

  let { id, heading, legend, low, peak, children, absent, busy = false }: Props = $props();

  const headingId = $derived(`ov-group-heading-${id}`);
</script>

<section class="group" data-testid="ov-group-{id}" aria-labelledby={headingId}>
  <div class="head">
    <h3 class="t-label title" id={headingId}>
      <span class="dot g-{id}" aria-hidden="true"></span>{heading}
    </h3>
    <span class="hair" aria-hidden="true"></span>
    {#if legend}
      <span class="legend">
        <span class="t-caption word">{low}</span>
        <span class="swatch" aria-hidden="true"></span>
        <span class="t-caption word">{peak}</span>
      </span>
    {/if}
  </div>
  <div
    class="grid"
    class:dense={id !== 'pinned'}
    data-testid="ov-grid-{id}"
    aria-busy={busy ? 'true' : undefined}
  >
    {@render children()}
  </div>
  {#if absent}{@render absent()}{/if}
</section>

<style>
  .group {
    min-width: 0;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    margin: 0 0 var(--space-8);
  }

  .title {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--space-4);
    margin: 0;
    color: var(--muted);
  }

  .dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  .g-pinned {
    background: var(--ov-pinned);
  }

  .g-time {
    background: var(--ov-time);
  }

  .g-tanks {
    background: var(--ov-tanks);
  }

  .g-records {
    background: var(--ov-records);
  }

  .g-totals {
    background: var(--ov-totals);
  }

  .hair {
    flex: 1 1 auto;
    min-width: 8px;
    height: 1px;
    background: var(--border);
  }

  .legend {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--space-8);
  }

  .word {
    color: var(--muted);
  }

  .swatch {
    display: block;
    width: 48px;
    height: 8px;
    background-image: linear-gradient(to right, var(--heat-low), var(--heat-mid), var(--heat-peak));
  }

  /* One column, 16px between tiles on both axes. */
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-16);
    grid-auto-flow: row;

    &.dense {
      grid-auto-flow: dense;
    }

    &:has(:global(.tile.open)) {
      align-items: start;
    }
  }

  @container (min-width: 480px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container (min-width: 880px) {
    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (forced-colors: active) {
    .dot,
    .swatch {
      outline: 1px solid CanvasText;
    }
  }
</style>
