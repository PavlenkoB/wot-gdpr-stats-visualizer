<script lang="ts">
  import { onMount } from 'svelte';
  import { SCROLLER_MAX_PX, windowRange } from '../../core/windowing.ts';
  import AccountTag from '../../shell/AccountTag.svelte';
  import { tagLabel, type AccountTagModel } from '../../shell/identity-model.ts';
  import { formatDeviceTableLabel, formatNewDataColumnLabel } from '../../ui-copy.ts';
  import { formatNewDataCell } from './new-data-cell.ts';
  import type { NewDataColumnKind, NewDataColumnView, NewDataRowView } from './new-data-shared.ts';
  import { shouldWindow } from './new-data-state.ts';

  /**
   * The one table both new-game panes draw their record lists with (plan 11-08,
   * D-11, UI-SPEC "Table treatment").
   *
   * ## No decision lives in this file
   *
   * Which rows the pane shows and in what order is the pane's (`orderRowsByAccount`
   * upstream); when a table must be windowed is `shouldWindow`'s; which rows a
   * window draws is `windowRange`'s; what a cell says is `formatNewDataCell`'s and
   * what a heading says is `formatNewDataColumnLabel`'s. What is left is geometry
   * and DOM: a scroller, two spacer rows and a sticky first column.
   *
   * ## Plain up to 500 rows, windowed above
   *
   * A plain table draws every row. Above `PLAIN_TABLE_MAX_ROWS` only the window
   * `windowRange` names is in the DOM, between two spacer rows that stand in for
   * the rest, at the constant 40px `ROW_PX` row height (the
   * stylesheet below declares the same 40px). Nothing is measured, so the
   * window cannot drift from the geometry that reserved space for it, and a table
   * of tens of thousands of rows costs the same DOM as one of five hundred
   * (T-11-28). No row is ever dropped behind a "more rows" line: each row must
   * stay traceable to its account (D-03).
   *
   * ## Why the geometry is written through the CSSOM
   *
   * The build-time CSP has no `style-src 'unsafe-inline'` and
   * `svelte/no-inline-styles` is an error here, so a `style` attribute is blocked
   * outright. The two spacer heights and the table's minimum width are therefore
   * `element.style` writes from an effect, the channel `VehicleTable` already uses.
   * The derived values are read into locals BEFORE the refs are tested: a read
   * inside `if (el !== null)` is a conditional dependency, and on the one run
   * where the refs are not bound yet the effect would register no dependency on
   * the window at all and never write the geometry when the rows arrive.
   *
   * ## What may reach the DOM
   *
   * Text only. Every value is interpolated, there is no raw-HTML directive, no
   * attribute carries a cell, an address, a nickname or an account id, and the one
   * account-derived string is the visually hidden phrase inside `AccountTag`.
   */
  interface Props {
    /** The columns to draw, in spec order. */
    columns: readonly NewDataColumnView[];
    /** The rows to draw, already ordered by the pane. */
    rows: readonly NewDataRowView[];
    /** The lower-cased record type, keying the column headings. */
    fileKey: string;
    /** The card's title, repeated in the region's accessible name and caption. */
    tableLabel: string;
    /** The account tags, or `null` for a single-account dataset (zero-one-many). */
    tags: ReadonlyMap<string, AccountTagModel> | null;
    /** The single global IP reveal; only an address-kind cell reads it. */
    revealed: boolean;
    /** The id of the column shown as `Battle type {code}`, or null. */
    battleTypeColumnId: string | null;
  }

  let { columns, rows, fileKey, tableLabel, tags, revealed, battleTypeColumnId }: Props = $props();

  const regionName = $derived(formatDeviceTableLabel(tableLabel));
  const windowed = $derived(shouldWindow(rows.length));

  /** The scroll offset, the one piece of DOM state a windowed table reads. */
  let scrollTop = $state(0);
  let frame = 0;

  let scrollerEl: HTMLDivElement | null = $state(null);
  let topSpacerEl: HTMLTableRowElement | null = $state(null);
  let bottomSpacerEl: HTMLTableRowElement | null = $state(null);
  let tableEl: HTMLTableElement | null = $state(null);

  /**
   * The drawn window. Named `drawnRange` and NOT `window`, which would shadow the
   * global (the bug VehicleTable's comment records). A plain table is the whole
   * list with no padding, so one `{#each}` serves both modes.
   */
  const drawnRange = $derived(
    windowed
      ? windowRange(scrollTop, SCROLLER_MAX_PX, rows.length)
      : { first: 0, last: rows.length, padTopPx: 0, padBottomPx: 0 },
  );

  /** The drawn rows, as `{ row, index }` so the absolute index is available. */
  const drawn = $derived(
    rows.slice(drawnRange.first, drawnRange.last).map((row, offset) => ({
      row,
      index: drawnRange.first + offset,
    })),
  );

  /**
   * One column kind's geometry: its pixel width and the CLASS that declares it.
   *
   * The width is a number the table has to ADD UP (its minimum width) and the
   * class is what the stylesheet uses, because the CSP forbids writing a width
   * into a `style` attribute. Keeping both halves in one record is what stops a
   * kind that gets a class from missing the map and falling back to the wrong
   * width. `taggedCls` is the same column one account tag wider.
   */
  const KIND_GEOMETRY: Readonly<
    Record<NewDataColumnKind, { px: number; cls: string; taggedCls: string }>
  > = {
    text: { px: 176, cls: 'w-text', taggedCls: 'w-text-tagged' },
    date: { px: 176, cls: 'w-date', taggedCls: 'w-date-tagged' },
    number: { px: 120, cls: 'w-number', taggedCls: 'w-number-tagged' },
    address: { px: 176, cls: 'w-address', taggedCls: 'w-address-tagged' },
  };

  /** What the first column grows by when it carries an account tag (24px chip, 4px gap, 4px margin). */
  const TAG_EXTRA_PX = 32;

  const tagged = $derived(tags !== null);

  /** One column's pixel width; the first column is wider only when tags exist. */
  function widthOf(column: NewDataColumnView, index: number): number {
    const base = KIND_GEOMETRY[column.kind].px;
    return index === 0 && tagged ? base + TAG_EXTRA_PX : base;
  }

  /** One column's width class, from the same record the width comes from. */
  function widthClass(column: NewDataColumnView, index: number): string {
    const geometry = KIND_GEOMETRY[column.kind];
    return index === 0 && tagged ? geometry.taggedCls : geometry.cls;
  }

  /** The sum of the drawn columns' widths, in pixels. */
  const minWidthPx = $derived(columns.reduce((total, column, i) => total + widthOf(column, i), 0));

  /**
   * The tag for one row, or `null` when there is nothing to draw.
   *
   * `tags === null` is the single-account case and a root the map does not hold
   * is the malformed case; both answer "no chip", so a hostile or stale root can
   * never reach a chip's letter or its hidden phrase.
   */
  function tagOf(row: NewDataRowView): AccountTagModel | null {
    return tags === null ? null : (tags.get(row.account) ?? null);
  }

  onMount(() => {
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  });

  /**
   * One scroll handler on the scroller, coalesced through a frame, and only
   * meaningful in windowed mode. There is no per-row listener.
   */
  function onScroll(): void {
    if (!windowed || frame !== 0) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      scrollTop = scrollerEl?.scrollTop ?? 0;
    });
  }

  /** The two spacer heights and the table's minimum width, through the CSSOM. */
  $effect(() => {
    const padTop = drawnRange.padTopPx;
    const padBottom = drawnRange.padBottomPx;
    const minWidth = minWidthPx;
    if (topSpacerEl !== null) topSpacerEl.style.height = `${padTop}px`;
    if (bottomSpacerEl !== null) bottomSpacerEl.style.height = `${padBottom}px`;
    if (tableEl !== null) tableEl.style.minWidth = `${minWidth}px`;
  });

  /**
   * A new dataset (a new `rows` array) returns the scroller to the top.
   *
   * Reset as the element AND the offset: the browser clamps `scrollTop`
   * asynchronously, so without the state reset the first window after a shrink
   * would be computed from the old, larger offset and could draw an empty strip.
   */
  $effect(() => {
    // The identity is the dependency; reading it is what registers the effect.
    void rows;
    scrollTop = 0;
    if (scrollerEl !== null) scrollerEl.scrollTop = 0;
  });
</script>

<!--
  The scroll region: the one focus stop for the table, and the box the sticky
  header and first column stick WITHIN. `tabindex="0"` on a `role="region"` is
  WCAG 2.1.1 rather than a mistake: a keyboard-scrollable box that is not
  focusable cannot be scrolled with the arrow keys at all, and the UI-SPEC names
  the region as the table's single tab stop for that reason.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="scroller"
  bind:this={scrollerEl}
  data-testid="new-data-table"
  role="region"
  tabindex="0"
  aria-label={regionName}
  onscroll={onScroll}
>
  <table bind:this={tableEl} aria-rowcount={windowed ? rows.length + 1 : undefined}>
    <caption class="visually-hidden">{regionName}</caption>
    <thead>
      <tr>
        {#each columns as column, columnIndex (columnIndex)}
          <th
            scope="col"
            class={widthClass(column, columnIndex)}
            class:sticky-first={columnIndex === 0}
            class:num={column.kind === 'number'}
          >
            {formatNewDataColumnLabel(fileKey, column.id)}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if windowed}
        <!-- A spacer stands in for rows that are not in the DOM; its height is written from the effect above. -->
        <tr class="spacer" aria-hidden="true" bind:this={topSpacerEl}>
          <td colspan={columns.length}></td>
        </tr>
      {/if}
      <!--
        KEYED BY POSITION: a row repeats across accounts (the same record type is
        in every account's folder), and a keyed each cannot render a repeated key.
        The key is the row's absolute index in the ordered list.
      -->
      {#each drawn as { row, index: rowIndex } (rowIndex)}
        <tr aria-rowindex={windowed ? rowIndex + 2 : undefined}>
          {#each columns as column, cellIndex (cellIndex)}
            {@const cell = formatNewDataCell(row.cells[cellIndex], column, {
              revealed,
              battleTypeColumnId,
            })}
            {#if cellIndex === 0}
              <!--
                The account tag, flush before the text. The `{#if}`, the tag and
                the text sit against each other with no whitespace between them:
                a newline would put a whitespace text node inside every
                single-account cell (the zero-one-many rule).
              -->
              <td
                class="{widthClass(column, cellIndex)} sticky-first"
                class:num={column.kind === 'number'}
                >{#if tagOf(row) !== null}<AccountTag
                    letter={tagOf(row)!.letter}
                    label={tagLabel(tagOf(row)!)}
                  />{/if}{#if cell.muted}<span class="not-reported">{cell.text}</span
                  >{:else}{cell.text}{/if}</td
              >
            {:else}
              <td class={widthClass(column, cellIndex)} class:num={column.kind === 'number'}>
                {#if cell.muted}
                  <span class="not-reported">{cell.text}</span>
                {:else}
                  {cell.text}
                {/if}
              </td>
            {/if}
          {/each}
        </tr>
      {/each}
      {#if windowed}
        <tr class="spacer" aria-hidden="true" bind:this={bottomSpacerEl}>
          <td colspan={columns.length}></td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>

<style>
  /* The scroller. `position: relative` is the containing block the sticky header
     and first column resolve against, and it keeps the visually hidden phrase of
     an account tag inside this box's clip instead of laying it out at the far
     right of a wide table and widening the page. `isolation: isolate` makes the
     scroller its own stacking context, so the header cells' z-index is compared
     with the first column's and never with the nav's. */
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

  /* `table-layout: fixed` with `border-collapse: separate` is what lets a column
     width come from a CLASS and a sticky first column paint its own opaque
     background over the cells that scroll under it. */
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
    padding: 0 12px;
    background: var(--list);
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-bottom: 1px solid var(--border);
  }

  /* The corner cell sits above BOTH axes. */
  th.sticky-first {
    left: 0;
    z-index: 3;
    border-right: 1px solid var(--border);
  }

  /* Rows are a FIXED 40px, the same constant `windowRange` divides by. A cell
     that wrapped would grow the row and the window would drift from the pad that
     reserved space for it, so every cell is one line. */
  tbody tr {
    height: 40px;
  }

  td {
    height: 40px;
    padding: 0 12px;
    background: var(--page);
    color: var(--text);
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
    font-variant-numeric: tabular-nums;
    border-bottom: 1px solid var(--border);
  }

  /* The first column, sticky to the scroller's left edge, so the account tag and
     the row name stay visible while the table scrolls sideways. */
  td.sticky-first {
    position: sticky;
    left: 0;
    z-index: 1;
    border-right: 1px solid var(--border);
  }

  th.num,
  td.num {
    text-align: right;
  }

  /* The chip's 4px gap to the text after it. Declared here because the same
     component renders in the identity header, where the gap comes from the row's
     own gap. `:global` because the chip is another component's markup. */
  .sticky-first :global([data-testid='account-tag']) {
    margin-right: 4px;
  }

  /* The not-reported words: muted ink, and they are WORDS, so the meaning never
     rests on the colour alone. */
  .not-reported {
    color: var(--muted);
  }

  .spacer td {
    height: auto;
    padding: 0;
    border: 0;
  }

  /* Column widths from the one geometry record in the script, as classes rather
     than inline styles. The tagged classes are the same width plus 32px. */
  .w-text,
  .w-date,
  .w-address {
    width: 176px;
  }
  .w-number {
    width: 120px;
  }
  .w-text-tagged,
  .w-date-tagged,
  .w-address-tagged {
    width: 208px;
  }
  .w-number-tagged {
    width: 152px;
  }
</style>
