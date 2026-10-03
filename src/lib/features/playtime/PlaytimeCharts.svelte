<script lang="ts">
  import type { PlaytimeSlice } from '../../core/types/worker-messages.ts';
  import type { TooltipRequest } from './playtime-model.ts';
  import { HOUR_GRID_BASIS } from './playtime-shared.ts';
  import { buildCalendarModel, buildDurationRows, buildHourGridModel } from './playtime-model.ts';
  import {
    CALENDAR_BASIS_CAPTION,
    CHART_TITLE_CALENDAR,
    CHART_TITLE_DURATION,
    CHART_TITLE_HOUR_GRID,
    DURATION_EXPLANATION,
    HOUR_GRID_BASIS_CAPTION,
    HOUR_GRID_KEYBOARD_HINT,
    HOUR_GRID_START_BASIS_NOTE,
    formatHourGridLegendNote,
  } from '../../ui-copy.ts';
  import CalendarHeatmap from './CalendarHeatmap.svelte';
  import ChartLegend from '../../charts/ChartLegend.svelte';
  import ChartTooltip from '../../charts/ChartTooltip.svelte';
  import DurationList from './DurationList.svelte';
  import HourGrid from './HourGrid.svelte';

  /**
   * The charts container: every chart for one slice, in document order, plus
   * the single shared tooltip plan 04-10's calendar will also feed.
   *
   * ## Why this file exists at all
   *
   * 04-08 deliberately created no empty wrapper to hang an `aria-busy` on. This
   * is where the container the UI-SPEC's state matrix describes finally exists:
   * in `updating` the previous slice's charts stay on screen and correct, and
   * `aria-busy` on THIS element is what says they are not the ones being asked
   * about. It goes here, not on the Playtime block's root, because 04-02's root
   * `aria-busy` is true only in `loading` and means the opposite thing.
   *
   * ## Why every section is its own `<section>`
   *
   * A container with a fixed child list is a container plan 04-10 must edit to
   * add a chart. Sibling sections keep the composition honest: the calendar is
   * one more `<section>` with its own h4, caption and graphic, inserted before
   * the weekday-by-hour one, and nothing about the hour grid's placement has to
   * move. The 24px gap is the UI-SPEC's lg token between chart sub-blocks, and
   * it is the reason each section's own children sit at 8px (sm).
   */
  interface Props {
    /** The slice on screen: the applied one, never the requested one. */
    slice: PlaytimeSlice;
    /** True while a newer slice for the same dataset is in flight. */
    updating: boolean;
  }

  let { slice, updating }: Props = $props();

  /**
   * The keyboard hint's id, generated rather than hand-written so a second
   * charts container on one page could not share it — the same reason
   * `Playtime.svelte` takes its `<label for>` from `$props.id()`.
   */
  const hintId = $props.id();

  /**
   * The grid, recomputed whenever the slice changes. A plain `$derived`: there
   * is no `$derived.raw` (only `$state.raw`), and the model is small enough —
   * 168 cells — that proxying it costs nothing measurable.
   */
  const grid = $derived(buildHourGridModel(slice));

  /**
   * The calendar, recomputed on the same slice and for the same reason: one
   * model per chart per slice, and no chart's numbers derived from another's.
   *
   * It is the larger of the two models by size — one rect per DAY of every
   * active year rather than 168 fixed cells — and it is still a plain
   * `$derived`, because its cost is a function of the years drawn and never of
   * the session count (D-04's scale rule, T-04-19).
   */
  const calendar = $derived(buildCalendarModel(slice));

  /**
   * The twelve duration rows, from the same slice and the same denominator the
   * Sessions tile uses.
   *
   * Always twelve, always in bin order, including the bins this slice never
   * lands in: the bin edges are a property of the scale (D-05), so a
   * two-session export and a 50k-session one show the same twelve buckets and
   * an empty one reads `0` with no bar. `sessions` is the usable count, never
   * the raw row count, so a share is never a share of rows the viewer was told
   * were excluded.
   */
  const durations = $derived(buildDurationRows(slice.bins, slice.sessions));

  /**
   * The one active cell, and therefore the one shared tooltip.
   *
   * `$state.raw`, not a deep proxy: a request is four numbers and two short
   * strings that change on every pointer move across 168 cells, and proxying
   * them would be work for a value that is only ever read once per change.
   * `null` means "nothing is active", and the element is hidden rather than
   * absent so no gesture ever has to create a node mid-move.
   *
   * Held HERE and not in the chart because 04-10's calendar is a second chart
   * feeding the same element: one owner, one request, one tooltip.
   */
  let tooltip = $state.raw<TooltipRequest | null>(null);

  /**
   * The element the current request was measured from.
   *
   * Kept beside the request rather than inside it, because `TooltipRequest` is
   * 04-05's and holds numbers by design. It is what lets the tooltip tell the
   * difference between a page scroll that moved the cell out from under it and
   * the one correction that kept the cell in view — see `isStale` in
   * `ChartTooltip`. 04-10's calendar passes its own cells the same way.
   */
  let tipAnchor = $state.raw<Element | null>(null);

  function showTip(request: TooltipRequest | null, anchor: Element | null | undefined): void {
    tooltip = request;
    tipAnchor = anchor ?? null;
  }
</script>

<div class="charts" data-testid="playtime-charts" aria-busy={updating ? 'true' : 'false'}>
  <!--
    The calendar, FIRST, and the reason is order rather than importance: it is
    the chart that answers "when do I play", it is the one a reader looks for
    before the weekly shape, and putting it first means the decade-long stack
    of year grids is what a reader meets at the top of the card. It is a
    SIBLING of the two below, exactly as 04-09's container was built to allow,
    so neither of them had to move to make room for it.
  -->
  <section class="chart">
    <h4>{CHART_TITLE_CALENDAR}</h4>

    <!--
      D-01 for the calendar, and the shorter sentence the UI-SPEC asks for
      here: the DATES are the export's own, so a reader comparing a cell with a
      calendar app must be told the two are not the same frame. Visible text
      under the title, for the same reason the hour grid's basis caption is:
      the reader who would be misled by it is looking at the chart, not tabbing
      through it.
    -->
    <p class="caption">{CALENDAR_BASIS_CAPTION}</p>

    <!--
      `onTip` is the container's own `showTip`, so the calendar feeds the SAME
      tooltip element as the hour grid rather than creating a second one: one
      owner, one request, one live placement for one pointer.
    -->
    <CalendarHeatmap model={calendar} onTip={showTip} />
  </section>

  <section class="chart">
    <h4>{CHART_TITLE_HOUR_GRID}</h4>

    <!--
      D-01, and the roadmap's success criterion 3: the hours are as the export
      records them, so a reader comparing these cells with a calendar app must
      be told the two are not the same frame. It is VISIBLE TEXT directly under
      the title — not a tooltip, not an aria-label — because the reader who is
      misled by a timezone is looking at the chart, not tabbing through it.
    -->
    <p class="caption">{HOUR_GRID_BASIS_CAPTION}</p>

    <!--
      Only under the start basis. 04-08 accepted this wording and left
      `HOUR_GRID_BASIS` at `overlap`, where this sentence would be FALSE: the
      grid splits a session across the hours it spans, so telling the reader it
      is counted in the hour it starts would be a caption that lies. Flipping
      the constant is a one-line change and this branch is what makes it safe.
    -->
    {#if HOUR_GRID_BASIS === 'start'}
      <p class="caption">{HOUR_GRID_START_BASIS_NOTE}</p>
    {/if}

    <!--
      The hint is real text, not a title attribute, and the grid names it
      through `aria-describedby` so a screen-reader user meets the key model
      before the first cell rather than having to go looking for it.
    -->
    <p class="caption" id={hintId}>{HOUR_GRID_KEYBOARD_HINT}</p>

    <HourGrid model={grid} describedBy={hintId} onTip={showTip} />

    <ChartLegend
      levels={grid.legend.levels}
      note={formatHourGridLegendNote(grid.legend.darkestAbove)}
      testId="hour-legend"
    />
  </section>

  <!--
    The second chart, a SIBLING section rather than a nested one. That is the
    whole reason the container is a list of sections: a third chart in 04-10's
    follow-up is one more <section> in this column, with its own heading,
    caption and graphic, and it neither nests inside the hour grid's section
    nor forces this one to move.
  -->
  <section class="chart">
    <h4>{CHART_TITLE_DURATION}</h4>

    <!--
      D-05, and the reason this chart exists: the bins are logarithmic, so a
      bar's length is NOT a linear quantity and a reader who assumes it is will
      misread every comparison. The explanation is visible text under the
      title, for the same reason the D-01 basis caption is.
    -->
    <p class="caption">{DURATION_EXPLANATION}</p>

    <DurationList rows={durations} sessions={slice.sessions} />
  </section>

  <!--
    One tooltip element for every chart in this container, and it comes AFTER
    the sections so `position: fixed` and the stacking order need no z-index
    fight with a chart's own scroller. Its own dismiss clears the request
    rather than any DOM: Escape from the grid, a scroll of the grid's own
    scroller, and a resize all arrive here.
  -->
  <ChartTooltip request={tooltip} anchor={tipAnchor} onDismiss={() => showTip(null, null)} />
</div>

<style>
  /*
    The container, at the UI-SPEC lg gap between chart sub-blocks. `min-width: 0`
    is what lets the scrollers below shrink inside the card instead of the card
    widening to 624px.
  */
  .charts {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
  }

  /*
    One chart: its title, its captions, its graphic and its legend at the sm
    gap. The h4 is a margin-less block with its own spacing below, so the
    caption sits the sm token under the title rather than a collapsed margin.
  */
  .chart {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  /* Chart titles are the Label role (UI-SPEC Typography), `#08060d`, so the
     title reads as a level of its own without introducing a fifth size. */
  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #08060d;
  }

  /* Caption role for every explanatory line: the timezone basis (D-01), the
     start-basis note, the keyboard hint and — via `ChartLegend` — the scale
     note. `#5f6368` is the muted text the role table names. */
  .caption {
    margin: 0;
    min-width: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: #5f6368;
    overflow-wrap: anywhere;
  }
</style>
