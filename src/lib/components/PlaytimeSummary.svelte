<script lang="ts">
  import type { PlaytimeSlice, PlaytimeSplit } from '../types/worker-messages.ts';
  import {
    SPLIT_ALL_OPTION,
    SPLIT_COLUMN_LABELS,
    SPLIT_HOURS_HEADER,
    TILE_LABEL_ACTIVE_DAYS,
    TILE_LABEL_SESSIONS,
    TILE_LABEL_TOTAL_PLAYTIME,
    formatHours,
    formatHoursParts,
    formatNumber,
    formatSplitCaption,
    formatSplitOverlapNote,
    formatSplitOverflowRow,
    formatSplitValue,
  } from '../ui-copy.ts';
  import type { SplitTableRow } from '../playtime-model.ts';
  import { buildSplitTable } from '../playtime-model.ts';
  import { splitColumnOf, splitValue } from '../playtime-state.ts';
  import ExcludedNotice from './ExcludedNotice.svelte';

  /**
   * The totals for the slice on screen, the split table, and the excluded-row
   * notice (ACTIVITY-01, D-06; D-03, D-02).
   *
   * Numbers arrive; words are `ui-copy`'s. This component holds the layout, the
   * test ids, and the one formatting decision that is a layout decision rather
   * than a copy one: the hours tile splits its value into the numeral and the
   * unit so the number can be set in Display and the unit in Label on the same
   * baseline (04-UI-SPEC Typography, the "Tile `dd` number" row). The other two
   * tiles are plain numerals, so they carry the whole Display role themselves.
   *
   * Every figure is for the SELECTED slice, which is what makes the split
   * selector mean anything: `slice.dayIndex.length` IS the active-day count by
   * D-02's construction, and `slice.seconds` is the merged-overlap total
   * computed in the worker, never here.
   *
   * ## Why the table is capped and the selector is not
   *
   * `buildSplitTable` (04-05) shows All plus at most eight values and counts
   * the rest, because 50 values would be 50 rows of a table nobody reads. The
   * `<select>` above still lists every value, so nothing is unreachable — the
   * overflow row says so in the table rather than hiding the fact. A selection
   * past the eighth row therefore flags no row here; the selector is what shows
   * it, and the table never grows to reach it.
   *
   * ## Why the values are plain text
   *
   * A `SERVER_NAME` is untrusted zip content (T-04-15). Every cell interpolates
   * it, the raw-HTML directive is a lint error in this repo, and the first
   * column wraps rather than widening the page — which is why the native
   * control above may truncate and this table may not.
   */
  interface Props {
    /** The slice currently displayed: All, or the value the selector is on. */
    slice: PlaytimeSlice;
    /** The split the worker's aggregate carries, or null when none qualified. */
    split: PlaytimeSplit | null;
    /** The APPLIED value index, or null for All (04-06's contract). */
    selected: number | null;
  }

  let { slice, split, selected }: Props = $props();

  /** The hours tile's two parts, so the unit can be set in the Label role. */
  const hours = $derived(formatHoursParts(slice.seconds));

  /** The column this build can put words to, or null — see `splitColumnOf`. */
  const column = $derived(split === null ? null : splitColumnOf(split.column));

  /** The rows, or an empty model when there is no split to show. */
  const table = $derived(buildSplitTable(split, selected));

  /**
   * A row's first cell.
   *
   * All is a label of its own, and a value goes through the blank-value
   * boundary first, so a server the export did not record reads `(not
   * recorded)` in the table exactly as it does in the selector above it. `row`
   * answers with `''` for the blank value, which `buildSplitTable` carries
   * through untouched (T-04-15); the `?? ''` is unreachable for a value row,
   * whose value is always a string.
   */
  function rowLabel(row: SplitTableRow): string {
    if (row.isAll) return SPLIT_ALL_OPTION;
    return formatSplitValue(splitValue(row.value ?? ''));
  }
</script>

<!--
  One flex column at 8px: the tiles, the table, the arithmetic note and the
  notice are four parts of ONE summary under ONE heading, and the 24px gaps of
  the Playtime block are the gap to the charts that follow it.
-->
<div class="summary">
  <dl data-testid="playtime-tiles">
    <div class="tile">
      <dt>{TILE_LABEL_TOTAL_PLAYTIME}</dt>
      <dd data-testid="playtime-total-hours">
        <span class="number">{hours.value}</span>
        <span class="unit">{hours.unit}</span>
      </dd>
    </div>
    <div class="tile">
      <dt>{TILE_LABEL_SESSIONS}</dt>
      <dd data-testid="playtime-total-sessions">{formatNumber(slice.sessions)}</dd>
    </div>
    <div class="tile">
      <dt>{TILE_LABEL_ACTIVE_DAYS}</dt>
      <dd data-testid="playtime-active-days">{formatNumber(slice.dayIndex.length)}</dd>
    </div>
  </dl>

  {#if split !== null && column !== null}
    <!--
      A real table, not a list of rows: the header cells and the caption are what
      make "1,204" mean hours of a named server rather than a number in a column
      of numbers. `table-layout: fixed` with a 96px hours column is what lets a
      60-character unbroken value wrap in the first column instead of stretching
      the card at 375px.
    -->
    <table data-testid="playtime-split-table">
      <caption>{formatSplitCaption(column)}</caption>
      <thead>
        <tr>
          <th scope="col">{SPLIT_COLUMN_LABELS[column]}</th>
          <th scope="col">{SPLIT_HOURS_HEADER}</th>
        </tr>
      </thead>
      <tbody>
        {#each table.rows as row, index (index)}
          <!--
            `aria-current` marks the row being shown, and the row is also set in
            the Label weight on a distinct surface: selection is never carried by
            colour alone. The rows are not interactive — the selector is the only
            control, so nothing here takes focus.
          -->
          <tr class:selected={row.selected} aria-current={row.selected ? 'true' : undefined}>
            <td>{rowLabel(row)}</td>
            <td>{formatHours(row.seconds)}</td>
          </tr>
        {/each}
        {#if table.moreCount > 0}
          <tr>
            <td>{formatSplitOverflowRow(table.moreCount)}</td>
            <td></td>
          </tr>
        {/if}
      </tbody>
    </table>

    <!--
      D-02's arithmetic is genuinely surprising — splitting on any column makes
      the parts sum to MORE than the All total, because All merges sessions that
      overlap across values and the parts do not — so it is spelled out rather
      than left for a reader to discover.
    -->
    <p class="note">{formatSplitOverlapNote(column)}</p>
  {/if}

  <!--
    Under the table when there is one and under the tiles when there is not: the
    excluded count belongs to the SLICE on screen, so it moves with the selector
    and is not a property of the export as a whole (D-02).
  -->
  <ExcludedNotice count={slice.excluded} />
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  /*
    The grid of three tiles (04-UI-SPEC Page Anatomy 4). `auto-fit` with a
    128px minimum is what makes them wrap to two per row at 375px rather than
    overflow, and `min-width: 0` on the grid lets a long numeral wrap instead
    of widening the card.
  */
  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
    gap: 16px;
    margin: 0;
    min-width: 0;
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    border: 1px solid #dadce0;
    border-radius: 6px;
    background: #f7f7fa;
    min-width: 0;
  }

  dt {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
  }

  /* Display role for the number, with the unit in Label beside it. `baseline`
     alignment is what puts "1,204" and "hours" on one line's baseline rather
     than centring a 14px word against a 28px numeral. */
  dd {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin: 0;
    min-width: 0;
    font-size: 28px;
    font-weight: 600;
    line-height: 1.2;
    color: #08060d;
    overflow-wrap: anywhere;
  }

  .unit {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
  }

  /* The table block, its caption and its note are one flex column at the
     block's 8px rhythm; the 24px gaps are the Playtime block's, one level up,
     so the sub-blocks stay grouped under one heading. */
  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin: 0;
    min-width: 0;
  }

  /* The caption names what the table is before a reader reaches the numbers.
     A table's caption is announced with the table, so it is not a heading and
     not a second copy of the selector's label. */
  caption {
    margin-bottom: 4px;
    text-align: left;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  th,
  td {
    padding: 8px 0;
    text-align: left;
    vertical-align: top;
    min-width: 0;
    /* Untrusted value text wraps rather than widening the page (T-04-15). */
    overflow-wrap: anywhere;
  }

  th {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #5f6368;
  }

  /* Caption role for the numbers, which is what the typography role table
     assigns to body cells. */
  td {
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: #3c4043;
  }

  /* The hours column is fixed, so the value column takes the rest and wraps.
     96px is the duration list's label column width, reused rather than
     invented. */
  th:last-child,
  td:last-child {
    width: 96px;
    padding-left: 16px;
  }

  /* Selection in the Label weight on a distinct surface, so it is legible
     without colour. */
  tr.selected td {
    font-weight: 600;
    background: #f1f3f4;
  }

  .note {
    margin: 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: #5f6368;
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
