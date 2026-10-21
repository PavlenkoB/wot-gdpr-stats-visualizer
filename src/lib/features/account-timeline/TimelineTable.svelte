<script lang="ts">
  import { onMount } from 'svelte';
  import { SCROLLER_MAX_PX, windowRange } from '../../core/windowing.ts';
  import AccountTag from '../../shell/AccountTag.svelte';
  import { tagLabel, type AccountTagModel } from '../../shell/identity-model.ts';
  import {
    DEVICE_NOT_REPORTED,
    PANE_TITLES,
    TIMELINE_COLUMN_LABELS,
    TIMELINE_KIND_LABELS,
    formatAccountOverflow,
    formatDeviceTableLabel,
  } from '../../ui-copy.ts';
  import { accountChipsOf } from '../logins/login-model.ts';
  import { formatNewDataCell } from '../new-data/new-data-cell.ts';
  import { shouldWindow } from '../new-data/new-data-state.ts';
  import type { TimelineEntryView } from './timeline-shared.ts';

  /**
   * The one timeline table (plan 12-12, D-06, D-15): Date, Kind and Entry, one
   * chronology across every kind.
   *
   * ## No decision lives in this file
   *
   * Which entries show and in what order is the worker's and the pane's (the sort
   * happened on the worker, so a plain and a windowed table list the same
   * order); when the table must be windowed is `shouldWindow`'s; which rows a
   * window draws is `windowRange`'s; what a part says is `formatNewDataCell`'s.
   * What is left is geometry and DOM: a scroller, two spacer rows and a sticky
   * first column. It is `NewDataTable`'s treatment, because the two tables must
   * look and behave alike.
   *
   * ## Plain up to 500 entries, windowed above
   *
   * Above `PLAIN_TABLE_MAX_ROWS` only the window is in the DOM, between two spacer
   * rows, at the constant 40px `ROW_PX`. The DOM is bounded by the window whatever
   * the entry count, there is no more-rows line and there is no per-row SVG
   * (SCALE-01, T-12-41).
   *
   * ## Why the geometry is written through the CSSOM
   *
   * The build CSP has no `style-src 'unsafe-inline'` and `svelte/no-inline-styles`
   * is an error, so the two spacer heights and the table's minimum width are
   * `element.style` writes from an effect that reads its derived values into
   * locals first (a read inside `if (el !== null)` is a conditional dependency).
   *
   * ## What may reach the DOM
   *
   * Text only. Every part is drawn through `formatNewDataCell`, so an address part
   * is masked unless `revealed`; there is no raw-HTML directive; no attribute
   * carries a cell, an address, a nickname or an account id (`data-kind` carries
   * only the fixed kind word); and the one account-derived string is the visually
   * hidden phrase inside `AccountTag` (T-12-38, T-12-39).
   */
  interface Props {
    /** The entries to draw, already filtered and in chronological order. */
    entries: readonly TimelineEntryView[];
    /** The account tags, or `null` for a single-account dataset (zero-one-many). */
    tags: ReadonlyMap<string, AccountTagModel> | null;
    /** The single global IP reveal; only an address part reads it. */
    revealed: boolean;
  }

  let { entries, tags, revealed }: Props = $props();

  /** The region's accessible name: a constant formatter over the constant pane title. */
  const regionName = formatDeviceTableLabel(PANE_TITLES['account-timeline']);

  const windowed = $derived(shouldWindow(entries.length));

  let scrollTop = $state(0);
  let frame = 0;

  let scrollerEl: HTMLDivElement | null = $state(null);
  let topSpacerEl: HTMLTableRowElement | null = $state(null);
  let bottomSpacerEl: HTMLTableRowElement | null = $state(null);
  let tableEl: HTMLTableElement | null = $state(null);

  /** The drawn window; a plain table is the whole list with no padding. */
  const drawnRange = $derived(
    windowed
      ? windowRange(scrollTop, SCROLLER_MAX_PX, entries.length)
      : { first: 0, last: entries.length, padTopPx: 0, padBottomPx: 0 },
  );

  /** The drawn entries as `{ entry, index }` so the absolute index is available. */
  const drawn = $derived(
    entries.slice(drawnRange.first, drawnRange.last).map((entry, offset) => ({
      entry,
      index: drawnRange.first + offset,
    })),
  );

  /** The fixed column widths, in pixels; the classes below declare the same numbers. */
  const DATE_PX = 176;
  const KIND_PX = 120;
  const ENTRY_PX = 360;

  /** What the Date column grows by when it may carry several tags: room for two chips. */
  const SEVERAL_TAGS_EXTRA_PX = 64;

  const tagged = $derived(tags !== null);

  /** The sum of the three column widths: the table's minimum width. */
  const minWidthPx = $derived(
    (tagged ? DATE_PX + SEVERAL_TAGS_EXTRA_PX : DATE_PX) + KIND_PX + ENTRY_PX,
  );

  onMount(() => {
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  });

  /** One scroll handler, coalesced through a frame, meaningful only when windowed. */
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

  /** A new entries array (a new dataset or a filter change) returns the scroller to the top. */
  $effect(() => {
    void entries;
    scrollTop = 0;
    if (scrollerEl !== null) scrollerEl.scrollTop = 0;
  });
</script>

<!--
  The scroll region: the one focus stop for the table. `tabindex="0"` on a
  `role="region"` is WCAG 2.1.1 rather than a mistake: a keyboard-scrollable box
  that is not focusable cannot be scrolled with the arrow keys at all.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="scroller"
  bind:this={scrollerEl}
  data-testid="timeline-table"
  role="region"
  tabindex="0"
  aria-label={regionName}
  onscroll={onScroll}
>
  <table bind:this={tableEl} aria-rowcount={windowed ? entries.length + 1 : undefined}>
    <caption class="visually-hidden">{regionName}</caption>
    <thead>
      <tr>
        <th scope="col" class="sticky-first" class:w-date={!tagged} class:w-date-many={tagged}>
          {TIMELINE_COLUMN_LABELS.date}
        </th>
        <th scope="col" class="w-kind">{TIMELINE_COLUMN_LABELS.kind}</th>
        <th scope="col" class="w-entry">{TIMELINE_COLUMN_LABELS.entry}</th>
      </tr>
    </thead>
    <tbody>
      {#if windowed}
        <tr class="spacer" aria-hidden="true" bind:this={topSpacerEl}>
          <td colspan="3"></td>
        </tr>
      {/if}
      <!--
        KEYED BY POSITION: an entry repeats across accounts and kinds, and a keyed
        each cannot render a repeated key. The key is the entry's absolute index in
        the ordered list.
      -->
      {#each drawn as { entry, index: rowIndex } (rowIndex)}
        {@const primary = entry.parts[0]}
        <tr aria-rowindex={windowed ? rowIndex + 2 : undefined}>
          <!--
            The Date cell: the account tags flush before the date text, with no
            whitespace between them (a newline would put a whitespace text node in
            every single-account cell, the zero-one-many rule). Shown tags in the
            identity header's order, the rest as visually hidden phrases, then a
            muted plain-text +N. Chips are keyed by position because the same
            account repeats across rows.
          -->
          <td class="sticky-first" class:w-date={!tagged} class:w-date-many={tagged}
            >{#if tags !== null}{@const chips = accountChipsOf(
                entry.accounts,
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
                >{/if}{/if}{#if entry.date === null || entry.date === ''}<span class="muted"
                >{DEVICE_NOT_REPORTED}</span
              >{:else}{entry.date}{/if}</td
          >
          <td class="w-kind">
            <span class="kind-badge" data-testid="timeline-kind-badge" data-kind={entry.kind}
              >{TIMELINE_KIND_LABELS[entry.kind]}</span
            >
          </td>
          <td class="w-entry">
            {#if primary === undefined}
              <span class="muted">{DEVICE_NOT_REPORTED}</span>
            {:else}
              {@const main = formatNewDataCell(
                primary.cell,
                { id: '', kind: primary.kind },
                { revealed, battleTypeColumnId: null },
              )}
              {#if main.muted}<span class="muted">{main.text}</span>{:else}{main.text}{/if}
              {#each entry.parts.slice(1) as part, partIndex (partIndex)}
                {@const secondary = formatNewDataCell(
                  part.cell,
                  { id: '', kind: part.kind },
                  { revealed, battleTypeColumnId: null },
                )}
                <span class="muted"> · {secondary.text}</span>
              {/each}
            {/if}
          </td>
        </tr>
      {/each}
      {#if windowed}
        <tr class="spacer" aria-hidden="true" bind:this={bottomSpacerEl}>
          <td colspan="3"></td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>

<style>
  /* The scroller: the containing block for the sticky header and first column,
     and the box that clips the visually hidden tag phrase so a 40-character
     nickname cannot widen the page. */
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

  th.sticky-first {
    left: 0;
    z-index: 3;
    border-right: 1px solid var(--border);
  }

  /* Rows are a FIXED 40px, the constant `windowRange` divides by. A cell that
     wrapped would grow the row and the window would drift from the pad that
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

  td.sticky-first {
    position: sticky;
    left: 0;
    z-index: 1;
    border-right: 1px solid var(--border);
  }

  /* The overflow count of a several-tags cell: muted plain text, never a chip. */
  .more {
    margin-right: 4px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.4;
  }

  /* The chip's 4px gap to the text after it; `:global` because the chip is
     another component's markup. */
  .sticky-first :global([data-testid='account-tag']) {
    margin-right: 4px;
  }

  /* The not-reported words and the secondary parts: muted, and the meaning of
     "not reported" is its words, never the colour. */
  .muted {
    color: var(--muted);
  }

  /* The kind badge: inert, neutral and never coloured, so no kind reads as
     severity. 18px line plus the 2px border is 20px, which does not grow a 40px
     row. */
  .kind-badge {
    display: inline-block;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
    white-space: nowrap;
    vertical-align: middle;
  }

  .spacer td {
    height: auto;
    padding: 0;
    border: 0;
  }

  /* Column widths as classes, because the CSP forbids a width in a style
     attribute. The sum is written as the table's minimum width in the script. */
  .w-date {
    width: 176px;
  }
  .w-date-many {
    width: 240px;
  }
  .w-kind {
    width: 120px;
  }
  .w-entry {
    width: 360px;
  }
</style>
