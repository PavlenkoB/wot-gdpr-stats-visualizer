<script lang="ts">
  import { onMount } from 'svelte';
  import type { VehicleColumn, VehicleRow } from './vehicle-shared.ts';
  import { SCROLLER_MAX_PX, windowRange, type SortState } from './vehicle-model.ts';
  import { VEHICLE_BLANK_NAME, VEHICLE_COLUMN_LABELS, formatVehicleCell } from '../../ui-copy.ts';

  /**
   * The windowed vehicle table (05-12).
   *
   * ## No decision lives in this file
   *
   * Which rows are drawn is `windowRange`'s, what they are ordered by is
   * `sortRows`'s (upstream, in the block), and what a cell says is
   * `formatVehicleCell`'s. What is left here is the geometry and the DOM: two
   * spacer rows, a scroll offset, and the sticky axes.
   *
   * ## Why the geometry is written through the CSSOM
   *
   * The build-time CSP has no `style-src 'unsafe-inline'` and
   * `svelte/no-inline-styles` is an error in this repo, so a `style` attribute
   * or a `style:` directive is blocked outright (T-05-38). The two spacer
   * heights and the table's minimum width are therefore `element.style.height`
   * writes from an effect — the one channel `ChartTooltip` already uses and
   * the one the policy allows.
   *
   * ## Why the rows are a constant height
   *
   * `windowRange` is a pure function, which it can only be because the row
   * height is known without asking the DOM. The stylesheet declares the same
   * 40px the model uses and nothing is ever measured, so the window cannot
   * drift from the geometry that reserved space for it (RESEARCH Pitfall 15).
   *
   * ## Why there is no `role="grid"`
   *
   * Windowing a native table and keeping its semantics is the whole point of
   * `aria-rowcount` / `aria-rowindex`: a screen reader is told the true size
   * and the true position of a row that is not in the DOM. `role="grid"` would
   * replace those semantics with ones the table does not implement.
   */
  interface Props {
    /** The columns to draw, already ordered by the block (05-09's `visibleColumns`). */
    columns: readonly VehicleColumn[];
    /** The rows to draw, already sorted and filtered by the block. */
    rows: readonly VehicleRow[];
    /** The sorted column and direction, for `aria-sort` and the arrow. */
    sort: SortState;
    /** Ask the block for the next sort of a column. */
    onSort: (key: string) => void;
    /** The region's accessible name, repeated in the hidden caption. */
    regionName: string;
    /**
     * Bump this to send the scroller back to the top.
     *
     * A value rather than a call, because a `$effect` that ran on a plain
     * `scrollTop = 0` assignment would also fire on the scroller's own
     * scrolling and fight the reader mid-gesture.
     */
    resetKey: unknown;
    /**
     * True while a newer title or battle type is being asked for.
     *
     * The previous table stays on screen and stays correct in that state, so
     * `aria-busy` goes HERE rather than on the block: "busy" is allowed to
     * mean "these numbers are not the ones being asked about" without hiding
     * them (05-UI-SPEC section 2).
     */
    updating?: boolean;
  }

  let { columns, rows, sort, onSort, regionName, resetKey, updating = false }: Props = $props();

  /** The scroll offset, the one piece of DOM state this table reads. */
  let scrollTop = $state(0);
  let viewportPx = $state(SCROLLER_MAX_PX);
  let frame = 0;

  let scrollerEl: HTMLDivElement | null = $state(null);
  let topSpacerEl: HTMLTableRowElement | null = $state(null);
  let bottomSpacerEl: HTMLTableRowElement | null = $state(null);
  let tableEl: HTMLTableElement | null = $state(null);

  /**
   * The drawn window: rows intersecting the scroller plus six rows of overscan
   * each side, and the two pads that stand in for the rows it does not draw.
   *
   * Named `drawnRange` and NOT `window`, which was the first name here and cost
   * a real bug: a `const window` in the component scope SHADOWS the global, so
   * `window.addEventListener('resize', …)` in `onMount` resolved to this
   * derived value and threw. The throw happened inside the mount flush, so the
   * geometry effect below never ran on the first pass, and a 5,000-row table
   * sat there with a scrollbar measuring the eighteen rows it had drawn.
   */
  const drawnRange = $derived(windowRange(scrollTop, viewportPx, rows.length));

  /** The drawn rows, as `{ row, index }` so the absolute index is available. */
  const drawn = $derived(
    rows.slice(drawnRange.first, drawnRange.last).map((row, offset) => ({
      row,
      index: drawnRange.first + offset,
    })),
  );

  /**
   * One column's geometry: the UI-SPEC's pixel width and the CLASS that
   * declares it, keyed by the worker's canonical `VehicleColumn.key`.
   *
   * The width is a number the table has to ADD UP (the minimum width written
   * to the `<table>`), and the class is what the stylesheet can use, because
   * the CSP forbids writing a width into a `style` attribute. Keeping the two
   * in one record is what stops a key that gets a class from missing the map
   * and silently falling back to the wrong width — which is exactly the split
   * this table started with, and exactly the drift 05-12 found in the copy
   * inventory's keys.
   */
  const COLUMN_GEOMETRY: Readonly<Record<string, { px: number; cls: string }>> = {
    vehicle: { px: 160, cls: 'w-vehicle' },
    battles: { px: 88, cls: 'w-battles' },
    winRate: { px: 96, cls: 'w-win-rate' },
    avgDamage: { px: 112, cls: 'w-avg-damage' },
    frags: { px: 80, cls: 'w-frags' },
    xp: { px: 96, cls: 'w-numeric' },
    lastBattle: { px: 160, cls: 'w-date' },
  };
  /** A numeric column the UI-SPEC sizes at 96px, whatever its key. */
  const NUMERIC_WIDTH_PX = 96;
  /** The two Warships per-type columns, which the UI-SPEC widens to 176px. */
  const PER_TYPE_WIDTH_PX = 176;

  /**
   * The per-type columns are the two that read a note in every row (D-08).
   *
   * Decided by the column's OWN `sortable: false` rather than by a list of
   * keys here, because that is the flag the worker already set for exactly
   * this case and a second list would be a second thing to forget.
   */
  function isPerType(column: VehicleColumn): boolean {
    return !column.sortable && (column.key === 'winRate' || column.key === 'avgDamage');
  }

  /** One column's pixel width, from the geometry row. */
  function widthOf(column: VehicleColumn): number {
    const named = COLUMN_GEOMETRY[column.key];
    if (named !== undefined) return named.px;
    if (isPerType(column)) return PER_TYPE_WIDTH_PX;
    return column.kind === 'text' || column.kind === 'date' ? 160 : NUMERIC_WIDTH_PX;
  }

  /** One column's width class, from the same record the width comes from. */
  function widthClass(column: VehicleColumn): string {
    const named = COLUMN_GEOMETRY[column.key];
    if (named !== undefined) return named.cls;
    return column.kind === 'text' || column.kind === 'date' ? 'w-date' : 'w-numeric';
  }

  /**
   * The header label, from the copy inventory keyed by the canonical key.
   *
   * A key the inventory does not know renders the key itself: a column the
   * model invents before the copy names it is still shown, and an empty cell
   * would be a header a reader cannot sort by. `tests/unit/vehicles/vehicle-blocks.test.ts`
   * builds a real view and fails if any of its column keys falls through here,
   * so the fallback is a safety net rather than a place a column can hide.
   */
  function headerLabel(key: string): string {
    return (VEHICLE_COLUMN_LABELS as Record<string, string>)[key] ?? key;
  }

  /** The `aria-sort` value, and the only `th` that carries a non-`none` one. */
  function ariaSort(column: VehicleColumn): 'ascending' | 'descending' | 'none' {
    if (!column.sortable || sort.key !== column.key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  /** The arrow, `aria-hidden` because the direction is already announced. */
  function sortArrow(column: VehicleColumn): string {
    if (sort.key !== column.key) return '';
    return sort.dir === 'asc' ? '↑' : '↓';
  }

  /** The text of a body cell, plus whether it is muted chrome. */
  function cellText(row: VehicleRow, column: VehicleColumn, index: number) {
    return formatVehicleCell(row.cells[index] ?? { t: 'x', v: 'missing' }, column.kind);
  }

  /** A zero-battle row reads as chrome rather than as numbers (UI-SPEC). */
  function isMuted(row: VehicleRow): boolean {
    return row.battles === 0;
  }

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

  /**
   * One passive scroll handler, coalesced through a frame.
   *
   * A scroll event fires far faster than the DOM can be re-windowed, and one
   * write per event would re-render the table once per pixel of scroll — the
   * browser-freeze the windowing exists to prevent. The listener is on the
   * scroller (the only element that scrolls), and it is passive, so it never
   * blocks the scroll it is reading.
   */
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
   * The pads are what the scrollbar measures, so without them a 5,000-row list
   * would have a scrollbar for the thirty rows actually drawn (T-05-36). The
   * minimum width is the sum of the column widths, so the table scrolls
   * horizontally INSIDE the scroller and the page never does.
   *
   * The three derived values are READ FIRST, into locals, and only then
   * written through the element refs. That order is load-bearing: a read
   * inside `if (spacerEl !== null)` is a CONDITIONAL dependency, so on the one
   * run where the refs are not bound yet the effect registers no dependency on
   * the window at all and the geometry is never written when the rows arrive.
   * The 5,000-vehicle spec found exactly that — a table of 5,000 rows whose
   * scrollbar measured eighteen of them, which reads as a list of eighteen
   * vehicles with no way to reach the rest.
   */
  $effect(() => {
    const padTop = drawnRange.padTopPx;
    const padBottom = drawnRange.padBottomPx;
    const minWidth = minWidthPx;
    if (topSpacerEl !== null) topSpacerEl.style.height = `${padTop}px`;
    if (bottomSpacerEl !== null) bottomSpacerEl.style.height = `${padBottom}px`;
    if (tableEl !== null) tableEl.style.minWidth = `${minWidth}px`;
  });

  /** The sum of the drawn columns' widths, in pixels. */
  const minWidthPx = $derived(columns.reduce((total, column) => total + widthOf(column), 0));

  /**
   * A sort, a search or a title change returns the scroller to the top.
   *
   * Written as a reset of the element AND of the offset, because the browser
   * clamps `scrollTop` asynchronously: without the state reset the first
   * window after a shrink would be computed from the old, larger offset and
   * could draw an empty strip (RESEARCH Pitfall 15).
   */
  $effect(() => {
    // The key is the dependency; reading it is what registers the effect.
    void resetKey;
    scrollTop = 0;
    if (scrollerEl !== null) scrollerEl.scrollTop = 0;
  });
</script>

<!--
  The scroll region: the one focus stop for the table, and the box the sticky
  header and first column stick WITHIN (RESEARCH Pitfall 6 — a sticky element
  inside an `overflow` container sticks to that container, not the page).

  `tabindex="0"` on a `role="region"` is WCAG 2.1.1 rather than a mistake: a
  keyboard-scrollable box that is not focusable cannot be scrolled with the
  arrow, Page Up or Page Down keys at all, and the UI-SPEC names the region as
  the table's single tab stop for exactly that reason. The rule fires because
  `region` is not one of the ARIA interactive roles; the alternative it suggests
  (a `group`, a `document`, a `application`) would all change what a screen
  reader announces this box as, which is the thing that is actually right here.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="scroller"
  bind:this={scrollerEl}
  data-testid="vehicle-scroller"
  role="region"
  tabindex="0"
  aria-label={regionName}
  aria-busy={updating ? 'true' : 'false'}
  onscroll={onScroll}
>
  <table data-testid="vehicle-table" bind:this={tableEl} aria-rowcount={rows.length + 1}>
    <!-- Repeats the region's name, so a screen reader entering the table is
         told what it is standing in. The visible title is the h4 above it. -->
    <caption class="sr-only">{regionName}</caption>
    <thead>
      <tr>
        {#each columns as column (column.key)}
          <th
            scope="col"
            class={widthClass(column)}
            class:sorted={sort.key === column.key}
            class:sticky-first={column === columns[0]}
            aria-sort={ariaSort(column)}
          >
            {#if column.sortable}
              <button
                type="button"
                data-testid="vehicle-sort-{column.key}"
                onclick={() => onSort(column.key)}
              >
                <span>{headerLabel(column.key)}</span>
                <span class="arrow" aria-hidden="true">{sortArrow(column)}</span>
              </button>
            {:else}
              <span class="plain">{headerLabel(column.key)}</span>
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      <!--
        The two spacers, `aria-hidden` because they stand in for rows that do
        not exist as content. Their heights are the omitted rows' worth of
        scrollbar, written from the effect above.
      -->
      <tr class="spacer" aria-hidden="true" bind:this={topSpacerEl}>
        <td colspan={columns.length}></td>
      </tr>
      <!--
        KEYED BY POSITION, not by `row.id` (D-12).

        `WOTB_Vehicle_Statistics.csv` exists in EVERY account root, so once the
        worker's merged view holds two or more accounts the same vehicle id
        arrives more than once. A keyed `{#each}` cannot render a repeated key:
        Svelte drops one of the two rows and, in dev, throws. Phase 9 does not
        sum, merge or de-duplicate across accounts — that is Phase 10 — so the
        honest shape here is two separate rows for one vehicle, which only a
        positional key can express.

        The key is the WINDOW's position, not the row's: `drawn` is a slice of
        the sorted view, so re-sorting produces a new window and every row is
        rebuilt, which is what keeps the virtualised scroller honest.
      -->
      {#each drawn as { row, index } (index)}
        <tr
          data-testid="vehicle-row"
          data-battles={row.battles ?? ''}
          class:muted={isMuted(row)}
          aria-rowindex={index + 2}
        >
          {#each columns as column, cellIndex (column.key)}
            {#if cellIndex === 0}
              <td class="{widthClass(column)} sticky-first" title={row.id}>
                {#if row.nation !== null}
                  <span class="nation" data-testid="vehicle-nation-tag">{row.nation}</span>
                {/if}
                <span class="id">{row.id === '' ? VEHICLE_BLANK_NAME : row.id}</span>
              </td>
            {:else}
              {@const cell = cellText(row, column, cellIndex)}
              <td class={widthClass(column)} class:muted-cell={cell.muted}>
                {cell.text}
                {#if cell.hidden !== null}
                  <span class="sr-only">{cell.hidden}</span>
                {/if}
              </td>
            {/if}
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
  /* The scroller. `max-height` is the UI-SPEC's 480px — twelve rows — so the
     table cannot push the rest of the page below the fold.

     `position: relative` is load-bearing twice over: it is the containing
     block the sticky header and first column resolve against, and it is what
     makes `overflow: auto` clip this component's own visually-hidden cell
     text. An absolutely positioned descendant escapes a scroll container's
     clip unless a POSITIONED ancestor sits between them, so without it every
     "no battles" suffix was laid out against the viewport at the far right of
     the 617px table and widened the PAGE — the 375px layout's scrollWidth was
     475 because of it.

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

  /* `table-layout: fixed` with `border-collapse: separate` is what lets a
     column width come from a CLASS and a sticky first column overlap its
     neighbours: collapsed borders cannot paint a cell's own background over
     the row beneath it. */
  table {
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    font-size: 14px;
    line-height: 1.4;
  }

  .sr-only {
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

  /* The header row, sticky to the TOP OF THE SCROLLER. Surface var(--list) and
     muted text, per the UI-SPEC geometry row. */
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

  /* The corner cell sits above BOTH axes: z-index 3 puts it over the sticky
     header row (2) and over the sticky first column (1). */
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

  /* A non-sortable column's label, in the same place, with the same type. */
  .plain {
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 8px;
  }

  .arrow {
    font-weight: 400;
  }

  /* Rows are a FIXED 40px, the same constant `windowRange` divides by. A cell
     that wrapped would grow the row and the window would drift from the pad
     that reserved space for it, so every cell is one line with an ellipsis. */
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
  }

  /* The first column, sticky to the scroller's left edge: a row scrolled
     sideways has lost its vehicle name otherwise. z-index 1 sits under the
     header row (2) and the corner (3). */
  td.sticky-first {
    position: sticky;
    left: 0;
    z-index: 1;
    border-right: 1px solid var(--border);
  }

  /* A zero-battle row is a vehicle the player owns and has not fought, which
     is information and not an error — so it reads as chrome, not as a failure. */
  tr.muted td {
    color: var(--muted);
  }

  td.muted-cell {
    color: var(--muted);
  }

  /* A special value: never shown as a zero, so never styled as a number. */
  .spacer td {
    height: auto;
    padding: 0;
    border: 0;
  }

  /* The nation tag: the text before the first colon, as written. A muted chip
     rather than a separate column, because it is part of the name the export
     wrote (D-11). Caption size — 14px, raised from 12px by 05-20 (G-05-10).

     `max-width: 70px` is KEPT at the new size, and that is a measurement
     rather than an assumption: at 14px the widest nation in the shared sample
     is `germany` at 56px of text (france 57px, china and japan 51px), which
     fits inside 70px, so raising the glyph size did not start ellipsising a
     reader's own vehicle name. `max-width` is a cap rather than a width, so
     the chip still shrinks to the nation it holds. The single-line ellipsis
     stays for a genuinely longer tag.

     The 18px line box is FIXED and is why the larger glyph size is safe: the
     row is a fixed 40px and the tag sits vertically centred in it, so the
     windowing's row height does not move. The `(type-floor)` browser test
     measures every rendered tag's `scrollWidth` against its `clientWidth`,
     so a future nation long enough to truncate fails there. */
  .nation {
    display: inline-block;
    max-width: 70px;
    margin-right: 4px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--chip);
    color: var(--muted);
    font-size: 14px;
    line-height: 18px;
    vertical-align: middle;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .id {
    vertical-align: middle;
  }

  /* Column widths from the UI-SPEC geometry row, as classes rather than inline
     styles (T-05-38). The table's minimum width is their SUM, written from
     script. */
  .w-vehicle {
    width: 160px;
  }
  .w-battles {
    width: 88px;
  }
  .w-win-rate {
    width: 96px;
  }
  .w-avg-damage {
    width: 112px;
  }
  .w-frags {
    width: 80px;
  }
  .w-total-xp {
    width: 96px;
  }
  .w-date {
    width: 160px;
  }
  .w-numeric {
    width: 96px;
  }

  /* Numbers are right-aligned with tabular figures, so digits line up down a
     column and a grouped number can be compared by length (D-25). */
  td:not(.sticky-first) {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
