<script lang="ts">
  import { onMount } from 'svelte';
  import { SCROLLER_MAX_PX, windowRange } from '../../core/windowing.ts';
  import AccountTag from '../../shell/AccountTag.svelte';
  import { tagLabel, type AccountTagModel } from '../../shell/identity-model.ts';
  import { formatAccountOverflow } from '../../ui-copy.ts';
  import {
    accountChipsOf,
    loginCells,
    type LoginCell,
    type LoginCells,
    type LoginColumn,
    type LoginRow,
    type LoginSort,
  } from './login-model.ts';

  /**
   * The windowed login table (06-10, D-05), on the vehicle table's structure.
   *
   * ## No decision lives in this file
   *
   * Which rows are drawn is `windowRange`'s, what they are ordered by is the
   * block's (upstream), and what a cell says is `loginCells`'s, which is also
   * where the mask is applied. What is left here is the geometry and the DOM:
   * two spacer rows, a scroll offset and the sticky axes. The geometry is the
   * vehicle table's, value for value, for the reasons that file records at
   * length: a fixed 40px row so nothing is measured, a CSSOM write for every
   * dynamic size because the CSP forbids inline styles, and a native table with
   * `aria-rowcount` / `aria-rowindex` rather than `role="grid"`.
   *
   * ## What never reaches an attribute
   *
   * No row, cell or header attribute holds an address. The keyed each uses the
   * row's INDEX, and the row hooks carry a count (`data-logins`) only, so
   * masking by `displayIp` is not undone by an attribute somebody inspects
   * (D-07, T-06-37).
   */
  interface Props {
    /** The columns to draw, in order. */
    columns: readonly LoginColumn[];
    /** The rows to draw, already sorted by the block. */
    rows: readonly LoginRow[];
    /** The one mask flag: the same rune that governs every other address. */
    revealed: boolean;
    /** The sorted column and direction, for `aria-sort` and the arrow. */
    sort: LoginSort;
    /** Ask the block for the next sort of a column. */
    onSort: (key: string) => void;
    /**
     * The pinned Account record row's cells, or null when the export has none.
     * Built by the block with the same mask flag; never part of the sort, the
     * window or any count (D-02).
     */
    account: LoginCells | null;
    /** The region's accessible name, repeated in the hidden caption. */
    regionName: string;
    /**
     * Bump this to send the scroller back to the top.
     *
     * Keyed on the sort and the dataset and NEVER on the mask, so toggling the
     * mask keeps the scroll position.
     */
    resetKey: unknown;
    /**
     * The account tags, or `null` for a single-account dataset (D-18).
     *
     * `null` is the zero case and it renders the first cell EXACTLY as Phase 9
     * did — no chip, no wrapper, no hidden phrase and no whitespace text node —
     * which is why the conditionals below sit flush against their neighbours
     * rather than inside a wrapper element.
     */
    tags?: ReadonlyMap<string, AccountTagModel> | null;
  }

  let {
    columns,
    rows,
    revealed,
    sort,
    onSort,
    account,
    regionName,
    resetKey,
    tags = null,
  }: Props = $props();

  /** The scroll offset, the one piece of DOM state this table reads. */
  let scrollTop = $state(0);
  let viewportPx = $state(SCROLLER_MAX_PX);
  let frame = 0;

  let scrollerEl: HTMLDivElement | null = $state(null);
  let topSpacerEl: HTMLTableRowElement | null = $state(null);
  let bottomSpacerEl: HTMLTableRowElement | null = $state(null);
  let tableEl: HTMLTableElement | null = $state(null);

  /**
   * The drawn window and its two pads.
   *
   * Named `drawnRange` and never `window`: a `const window` in a component scope
   * shadows the global, and `window.addEventListener` in `onMount` then resolves
   * to the derived value and throws (the bug the vehicle table recorded).
   */
  const drawnRange = $derived(windowRange(scrollTop, viewportPx, rows.length));

  /** The drawn rows with their absolute index. */
  const drawn = $derived(
    rows.slice(drawnRange.first, drawnRange.last).map((row, offset) => ({
      row,
      index: drawnRange.first + offset,
    })),
  );

  /** Rows before the windowed ones: the header, and the Account record row if any. */
  const leadingRows = $derived(account === null ? 1 : 2);

  /** The `aria-sort` value, and the only `th` that carries a non-`none` one. */
  function ariaSort(column: LoginColumn): 'ascending' | 'descending' | 'none' {
    if (sort.key !== column.key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  /** The arrow, `aria-hidden` because the direction is already announced. */
  function sortArrow(column: LoginColumn): string {
    if (sort.key !== column.key) return '';
    return sort.dir === 'asc' ? '↑' : '↓';
  }

  /** The sum of the drawn columns' widths, in pixels. */
  const minWidthPx = $derived(columns.reduce((total, column) => total + column.widthPx, 0));

  onMount(() => {
    const measure = (): void => {
      viewportPx = scrollerEl?.clientHeight ?? SCROLLER_MAX_PX;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  });

  /** One passive scroll handler, coalesced through a frame. */
  function onScroll(): void {
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      scrollTop = scrollerEl?.scrollTop ?? 0;
    });
  }

  /**
   * The two spacer heights and the table's minimum width, through the CSSOM.
   *
   * The derived values are READ FIRST, into locals, and only then written
   * through the element refs: a read inside `if (el !== null)` is a conditional
   * dependency, so on the run where the refs are not bound yet the effect would
   * register no dependency on the window at all and the geometry would never be
   * written when the rows arrive (the lesson the vehicle table recorded).
   */
  $effect(() => {
    const padTop = drawnRange.padTopPx;
    const padBottom = drawnRange.padBottomPx;
    const minWidth = minWidthPx;
    if (topSpacerEl !== null) topSpacerEl.style.height = `${padTop}px`;
    if (bottomSpacerEl !== null) bottomSpacerEl.style.height = `${padBottom}px`;
    if (tableEl !== null) tableEl.style.minWidth = `${minWidth}px`;
  });

  /** A new sort or dataset returns the scroller to the top, element and offset. */
  $effect(() => {
    void resetKey;
    scrollTop = 0;
    if (scrollerEl !== null) scrollerEl.scrollTop = 0;
  });
</script>

{#snippet cellView(
  cell: LoginCell,
  column: LoginColumn,
  columnIndex: number,
  row: LoginRow | null = null,
)}
  {#if columnIndex === 0}
    <!-- The address wraps inside an inner block and is never ellipsised; the
         cell carries no `title`, so an address is never in an attribute.

         D-18's account chips go BEFORE it, and the whole conditional sits flush
         against the `<span class="ip">` with no whitespace between: a newline
         here would put a whitespace text node inside every single-account cell,
         and this cell's text is read by `tests/e2e/logins/login-table.spec.ts`.
         `row` is null for the pinned Account record row, which is never given
         chips — with two or more accounts that row does not exist at all (D-13),
         and with one account there are no tags to draw.
    -->
    <td class="{column.widthClass} sticky-first" class:first-tagged={tags !== null}>
      {#if tags !== null && row !== null}{@const chips = accountChipsOf(
          row.accounts,
          tags,
        )}{#each chips.shown as tag, tagIndex (tagIndex)}<AccountTag
            letter={tag.letter}
            label={tagLabel(tag)}
          />{/each}{#each chips.hiddenTags as tag, tagIndex (tagIndex)}<AccountTag
            letter={tag.letter}
            label={tagLabel(tag)}
            visual={false}
          />{/each}{#if chips.extra > 0}<span class="more"
            >{formatAccountOverflow(chips.extra)}</span
          >{/if}{/if}<span class="ip" class:muted-cell={cell.muted}>
        {cell.text}
        {#if cell.hidden !== null}<span class="visually-hidden">{cell.hidden}</span>{/if}
      </span>
    </td>
  {:else}
    <td
      class={column.widthClass}
      class:right={column.align === 'right'}
      class:muted-cell={cell.muted}
      title={cell.title}
    >
      {#if cell.tag === true}
        <span class="tag" data-testid="login-account-tag">{cell.text}</span>
      {:else}
        {cell.text}
      {/if}
      {#if cell.hidden !== null}
        <span class="visually-hidden">{cell.hidden}</span>
      {/if}
    </td>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="scroller"
  bind:this={scrollerEl}
  data-testid="login-scroller"
  role="region"
  tabindex="0"
  aria-label={regionName}
  onscroll={onScroll}
>
  <table data-testid="login-table" bind:this={tableEl} aria-rowcount={rows.length + leadingRows}>
    <caption class="visually-hidden">{regionName}</caption>
    <thead>
      <tr aria-rowindex="1">
        {#each columns as column, columnIndex (column.key)}
          <th
            scope="col"
            class={column.widthClass}
            class:sorted={sort.key === column.key}
            class:sticky-first={columnIndex === 0}
            aria-sort={ariaSort(column)}
          >
            <button
              type="button"
              data-testid="login-sort-{column.key}"
              onclick={() => onSort(column.key)}
            >
              <span>{column.label}</span>
              <span class="arrow" aria-hidden="true">{sortArrow(column)}</span>
            </button>
          </th>
        {/each}
      </tr>
    </thead>
    {#if account !== null}
      <!--
        The pinned Account record row (D-02): its own tbody BEFORE the windowed
        one, so it is never sorted and never windowed. Not counted anywhere.
      -->
      <tbody data-testid="login-account-row-group">
        <tr class="account" data-testid="login-account-row" aria-rowindex="2">
          {#each columns as column, columnIndex (column.key)}
            {@render cellView(account[column.key], column, columnIndex)}
          {/each}
        </tr>
      </tbody>
    {/if}
    <tbody>
      <tr class="spacer" aria-hidden="true" bind:this={topSpacerEl}>
        <td colspan={columns.length}></td>
      </tr>
      {#each drawn as { row, index } (index)}
        {@const cells = loginCells(row, revealed)}
        <tr
          data-testid="login-row"
          data-logins={row.logins}
          aria-rowindex={index + 1 + leadingRows}
        >
          {#each columns as column, columnIndex (column.key)}
            {@render cellView(cells[column.key], column, columnIndex, row)}
          {/each}
        </tr>
      {/each}
      <tr class="spacer" aria-hidden="true" bind:this={bottomSpacerEl}>
        <td colspan={columns.length}></td>
      </tr>
    </tbody>
  </table>
</div>

<style>
  /* `position: relative` is the containing block the sticky header and first
     column resolve against, and what makes `overflow: auto` clip this
     component's own visually-hidden text (see VehicleTable).

     `isolation: isolate` makes the scroller a stacking context, so the header
     cells' z-index 2, the corner cell's 3 and the first column's 1 are compared
     with each other and never with the nav's z-index 1 in the page's root
     stacking context. Without it the header cells outrank the nav and the
     first-column cells tie it and win on tree order, so a scrolled table paints
     over the sticky nav (G-07-5). The nav's z-index is deliberately NOT raised
     instead: the fixed chart tooltip at z-index 2 relies on stacking being
     z-index-free elsewhere (see the stacking note in PlaytimeCharts.svelte). */
  .scroller {
    position: relative;
    isolation: isolate;
    overflow: auto;
    max-height: 480px;
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
  }

  .scroller:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  table {
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    font-size: 14px;
    line-height: 1.4;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 2;
    height: 40px;
    padding: 0;
    background: var(--list);
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
  }

  th.sticky-first {
    left: 0;
    z-index: 3;
    border-right: 1px solid var(--border);
  }

  /* The sorted header's own surface, so the arrow's column is visible even
     when the reader has scrolled past the corner. */
  th.sorted {
    background: var(--hover);
  }

  /* The sort button fills its cell: Label weight, muted text, transparent
     background, and the 40px height the header declares. */
  button {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 40px;
    padding: 0 8px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    text-align: left;
    cursor: pointer;
  }

  button:hover {
    background: var(--sel);
    color: var(--text);
  }

  button:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
  }

  .arrow {
    font-weight: 400;
  }

  /* Rows are a FIXED 40px, the constant `windowRange` divides by. */
  tbody tr {
    height: 40px;
  }

  td {
    height: 40px;
    padding: 0 8px;
    background: var(--page);
    color: var(--text);
    font-size: 14px;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
    font-variant-numeric: tabular-nums;
  }

  td.sticky-first {
    position: sticky;
    left: 0;
    z-index: 1;
    border-right: 1px solid var(--border);
  }

  td.right {
    text-align: right;
  }

  td.muted-cell,
  .ip.muted-cell {
    color: var(--muted);
  }

  /* The pinned Account record row: the sticky-header surface, with an opaque
     sticky cell so a row scrolled sideways cannot show through it. */
  tr.account td {
    background: var(--list);
  }

  /* The Account record tag: a muted chip that carries its own border and its
     own words, so the information never depends on the colour. */
  .tag {
    display: inline-block;
    max-width: 100%;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--chip);
    color: var(--muted);
    font-size: 14px;
    line-height: 18px;
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .spacer td {
    height: auto;
    padding: 0;
    border: 0;
  }

  /* The address wraps to at most two lines inside the fixed 40px row and is
     never ellipsised, so a revealed IPv6 address is always fully readable.
     `max-height` has no effect on a table cell, so the wrapping box is an
     inner block element. */
  .ip {
    display: block;
    max-height: 40px;
    overflow: hidden;
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 1.4;
  }

  /* The tagged first cell (D-18): one nowrap flex row of chips and then the
     address. `first-tagged` rather than `.w-ip-tagged` because the LAYOUT is a
     separate question from the WIDTH — a cell can be `w-ip` and tagged if the
     geometry records ever disagree, and the two must not be one class.
     `align-items: center` keeps the 18px chip and the 40px row's text on one
     optical line, and the row height stays the 40px `windowRange` divides by. */
  td.first-tagged {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  /* The address takes what the chips left and can shrink to nothing: a long
     IPv6 beside three chips wraps into the remaining width's two lines rather
     than widening the sticky column (which is what would push the page sideways
     at 375px). */
  td.first-tagged .ip {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* The overflow count. Muted, plain text and never a chip: a third chip-shaped
     thing reading `+2` would be read as an account named `+2`. */
  .more {
    flex-shrink: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.4;
  }

  /* Column widths from the UI-SPEC as classes, never inline styles (CSP). */
  .w-ip {
    width: 160px;
  }
  /* D-18: 160 plus 64 for three chips and their gaps. Declared HERE beside
     `.w-ip` because the minimum width the table's `$effect` writes is the sum of
     the same numbers from `visibleLoginColumns` — the stylesheet's half and the
     model's half of one record, which is how a wrong width shipped once. */
  .w-ip-tagged {
    width: 224px;
  }
  .w-country {
    width: 136px;
  }
  .w-logins {
    width: 80px;
  }
  .w-first {
    width: 104px;
  }
  .w-last {
    width: 104px;
  }
  .w-games {
    width: 136px;
  }
  .w-city {
    width: 160px;
  }
</style>
