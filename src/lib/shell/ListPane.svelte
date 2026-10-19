<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import type { ClassifyResult } from '../core/types/worker-messages.ts';
  import {
    LIST_KEYBOARD_HINT,
    NAV_ARIA_LABEL,
    PANE_TITLES,
    PRODUCT_LABEL,
    SKIP_TO_DETAIL_LABEL,
  } from '../ui-copy.ts';
  import IdentityHeader from './IdentityHeader.svelte';
  import { PANE_ORDER, paneEntries, stepSelection, type PaneId } from './selection-state.ts';

  /**
   * The left pane of the master-detail shell: the product label, the account
   * identity, one row per pane, and (once an export is loaded) the import
   * region.
   *
   * The rows are a `<nav>` of buttons with `aria-current="true"` on the selected
   * one, not a listbox (D-06): a row is a navigation target, not a value being
   * picked, and a plain button keeps every row in the tab order with no roving
   * focus to maintain. Row content comes from `paneEntries`, the one derivation
   * of headline, summary and muted state, so a row cannot word a fact
   * differently from the Overview card or the detail pane.
   *
   * Every string here is interpolated as text. The only untrusted string in a row
   * is the account's location code, which `paneEntries` returns as plain data.
   */
  interface Props {
    /** The last known dataset, or `null` when no export is loaded. */
    result: ClassifyResult | null;
    /** The pane currently shown in the detail pane. */
    selected: PaneId;
    /**
     * Called with the row's pane id when the selection changes. `how` tells the
     * shell whether a pointer or the keyboard did it, because the two move focus
     * differently on a stacked layout.
     */
    onselect: (id: PaneId, how: 'pointer' | 'keyboard') => void;
    /**
     * Called when the user means to go INTO the detail: Enter on a row, or the
     * skip link. The shell moves focus there.
     */
    onenter: () => void;
    /** The import region, shown below the rows only while a dataset is loaded. */
    importRegion?: Snippet;
  }

  let { result, selected, onselect, onenter, importRegion }: Props = $props();

  const entries = $derived(paneEntries(result));

  let navEl = $state<HTMLElement | null>(null);

  /** Focus the current row, for the shell to call when focus comes back to the list. */
  export function focusSelected(): void {
    navEl?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
  }

  /**
   * The pane a row button stands for, or `null` for any other target. Resolved
   * over `PANE_ORDER` (all eleven ids), not the nine-pane tuple, so the two
   * optional rows are panes too when they are rendered.
   */
  function paneOf(target: EventTarget | null): PaneId | null {
    const row = target instanceof Element ? target.closest('[data-testid^="list-row-"]') : null;
    if (row === null || !(navEl?.contains(row) ?? false)) return null;
    const testId = row.getAttribute('data-testid');
    return PANE_ORDER.find((id) => 'list-row-' + id === testId) ?? null;
  }

  /**
   * j, k, the arrows and Enter (D-05).
   *
   * The handler is on the `<nav>` and nowhere else: keys act only while focus is
   * on a row, never page-wide, so they cannot steal a key from a chart, a field
   * or the confirm panel. A modified key is somebody else's shortcut and is
   * ignored. The selection is clamped by `stepSelection`, and focus follows it so
   * the next key always starts from the focused row.
   *
   * The arrows are consumed even when the selection does not change, so a held
   * ArrowDown at the last row does not scroll the page. Enter is consumed too: a
   * button turns Enter into a click on keydown, and that click would select the
   * row a second time as a pointer selection.
   */
  async function onNavKeyDown(event: KeyboardEvent): Promise<void> {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const current = paneOf(event.target);
    if (current === null) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      onselect(current, 'keyboard');
      onenter();
      return;
    }

    let direction: 1 | -1;
    if (event.key === 'j' || event.key === 'ArrowDown') direction = 1;
    else if (event.key === 'k' || event.key === 'ArrowUp') direction = -1;
    else return;

    if (event.key.startsWith('Arrow')) event.preventDefault();

    // Step from the FOCUSED row: with nothing loaded the selection stays pinned to
    // Overview while focus moves, so stepping from `selected` would stall on row 2.
    // The order is the rows ON SCREEN, so an absent optional pane is skipped
    // because it has no row, not because of a special case.
    const next = stepSelection(
      current,
      direction,
      entries.map((entry) => entry.id),
    );
    if (next === current) return;
    onselect(next, 'keyboard');
    await tick();
    navEl?.querySelector<HTMLElement>(`[data-testid="list-row-${next}"]`)?.focus();
  }

  /** The skip link goes straight to the detail and never writes a hash (no router). */
  function onSkip(event: MouseEvent): void {
    event.preventDefault();
    onenter();
  }
</script>

<div class="pane-list" data-testid="list-pane">
  <!--
    The first focusable element of the pane. It is an anchor to the in-page id for
    semantics, but its click is prevented and routed to a focus call, so activating
    it never writes `location.hash`.
  -->
  <a class="skip" href="#detail" data-testid="skip-to-detail" onclick={onSkip}>
    {SKIP_TO_DETAIL_LABEL}
  </a>

  <h1 class="product">{PRODUCT_LABEL}</h1>

  <IdentityHeader {result} />

  <!--
    The key handler is on the nav so it only ever hears keys from a focused row.
    A `<nav>` is not an interactive element, which the a11y rule below objects
    to; the handler adds no role or tab stop, it only listens to its buttons.
  -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <nav
    aria-label={NAV_ARIA_LABEL}
    data-testid="list-nav"
    bind:this={navEl}
    onkeydown={onNavKeyDown}
  >
    <p class="kbd-hint" data-testid="kbd-hint">{LIST_KEYBOARD_HINT}</p>
    <ul>
      {#each entries as entry (entry.id)}
        <li>
          <button
            type="button"
            class="row"
            class:muted={entry.muted}
            class:footer={entry.id === 'not-yet-supported'}
            data-testid="list-row-{entry.id}"
            aria-current={entry.id === selected ? 'true' : undefined}
            onclick={() => onselect(entry.id, 'pointer')}
          >
            <span class="title">{PANE_TITLES[entry.id]}</span>
            <span class="headline">{entry.headline}</span>
            {#if entry.summary !== ''}
              <span class="sub">{entry.summary}</span>
            {/if}
            <span class="chevron" aria-hidden="true">›</span>
          </button>
        </li>
      {/each}
    </ul>
  </nav>

  {#if result !== null}
    <!--
      The import region's home once a dataset is loaded. The pane is a flex
      column, so `margin-top: auto` parks this at the bottom when the list is
      short, and the rule above it separates it from the rows.
    -->
    <div class="import-region">
      {@render importRegion?.()}
    </div>
  {/if}
</div>

<style>
  /* Hidden with the clip pattern (not display: none, which would take it out of
     the tab order) until it has focus, when it becomes an ordinary link. The
     `min-height: 0` is needed because the 480px block in app.css floors every
     anchor at 44px, which would otherwise stop the 1px box. */
  .skip {
    position: absolute;
    width: 1px;
    height: 1px;
    min-height: 0;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .skip:focus {
    position: static;
    width: auto;
    height: auto;
    min-height: 44px;
    padding: 12px 20px 0;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }

  /* Shown only while focus is inside the nav. It always takes its space, so
     showing it moves nothing. */
  .kbd-hint {
    margin: 0;
    padding: 4px 20px 0;
    min-height: 1.4em;
    font-size: 14px;
    line-height: 1.4;
    color: var(--muted);
    visibility: hidden;
  }

  nav:focus-within .kbd-hint {
    visibility: visible;
  }

  .product {
    margin: 0;
    padding: 8px 20px 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--muted);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .import-region {
    margin-top: auto;
    border-top: 1px solid var(--border);
  }

  /* The row pattern from the UI-SPEC. `all: unset` drops the button chrome so
     the grid below is the whole of the row. It also drops the outline, so the
     focus ring is re-stated below with the same values as the global rule in
     `src/app.css`. */
  .row {
    all: unset;
    box-sizing: border-box;
    width: 100%;
    min-height: 56px;
    padding: 8px 20px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 16px;
    align-content: center;
    cursor: pointer;
    border-bottom: 1px solid var(--border);
  }

  .row:hover {
    background: var(--hover);
  }

  .row[aria-current='true'] {
    background: var(--sel);
    box-shadow: inset 3px 0 0 var(--ink);
  }

  .row:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
  }

  .title,
  .headline {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .headline {
    text-align: right;
  }

  .sub {
    grid-column: 1 / -1;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--muted);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .row.muted .title,
  .row.muted .headline {
    color: var(--muted);
  }

  /* The chevron is a phone-only affordance (the row opens the detail screen), so
     it takes no space above phone width. The phone list screen's rules (64px
     rows, the chevron, the 48px import actions) are in the phone block of
     `src/app.css`. */
  .chevron {
    display: none;
  }
</style>
