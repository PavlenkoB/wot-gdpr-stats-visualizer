<script lang="ts">
  import type { Snippet } from 'svelte';
  import { BACK_TO_SECTIONS_LABEL } from '../ui-copy.ts';
  import type { PaneId } from './selection-state.ts';

  /**
   * The right pane of the master-detail shell: one labelled region that hosts
   * whichever pane is selected.
   *
   * `id="detail"` is the target of the list pane's skip link, and
   * `tabindex="-1"` lets a selection move focus here programmatically without
   * adding the region to the tab order. The default focus ring is kept on that
   * programmatic focus: removing it would leave a keyboard user with no sign of
   * where focus went.
   *
   * No overflow is declared (see `.pane-detail` in app.css): the page stays the
   * one vertical scroller.
   */
  interface Props {
    /** Which pane is mounted inside, exposed as `data-pane` for tests. */
    pane: PaneId;
    /** The accessible name of the region: the pane's title. */
    title: string;
    /** Escape was pressed inside the detail: the shell returns focus to the list. */
    onescape?: () => void;
    /** Show the phone's top bar with the back button. Hidden above phone width. */
    showBack?: boolean;
    /** The back button was activated. */
    onback?: () => void;
    children: Snippet;
  }

  let { pane, title, onescape, showBack = false, onback, children }: Props = $props();

  let root = $state<HTMLElement | null>(null);

  /** Move focus to the region, for the shell to call after a selection or an Enter. */
  export function focus(): void {
    root?.focus();
  }

  /** Places where Escape already means something else. */
  const OWN_ESCAPE =
    'input, textarea, select, [contenteditable="true"], [data-tooltip-surface], [role="dialog"], [role="alertdialog"]';

  /**
   * Escape returns focus to the list (D-05), except where Escape belongs to
   * something inside the pane.
   *
   * The chart surfaces are excluded by `[data-tooltip-surface]`, and that is
   * not redundant with the `defaultPrevented` test: a chart's own Escape
   * dismisses its tooltip and does NOT call `preventDefault`, and
   * `ChartTooltip` dismisses a pinned tooltip from a document-level capture
   * listener that does not call it either. So `defaultPrevented` alone cannot
   * protect a chart. Fields and dialogs own Escape too. D-05's "Escape returns
   * it to the list" applies to the rest of the detail pane.
   */
  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest(OWN_ESCAPE) !== null) return;
    onescape?.();
  }
</script>

<!-- A region is not an interactive role, which the rule below objects to. The
     handler adds no role or tab stop: it only hears keys from inside the pane. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={root}
  class="pane-detail"
  id="detail"
  data-testid="detail-pane"
  data-pane={pane}
  role="region"
  aria-label={title}
  tabindex="-1"
  onkeydown={onKeyDown}
>
  {#if showBack && title !== ''}
    <!--
      The phone's top bar: a 48px row with the back button at the left and the
      title centred. It does not stick and declares no position, so nothing floats
      over the content at any width. The title is decorative here (the region and
      the section heading already carry it), and it carries the shared Title
      role (D-12): 26px below 900px, where the phone block hides the in-content
      heading and leaves this one visible.
    -->
    <div class="phone-bar">
      <button type="button" data-testid="back-button-sections" onclick={onback}>
        {BACK_TO_SECTIONS_LABEL}
      </button>
      <span class="t-heading phone-title" aria-hidden="true">{title}</span>
    </div>
  {/if}

  {@render children()}
</div>

<style>
  .phone-bar {
    display: none;
  }
</style>
