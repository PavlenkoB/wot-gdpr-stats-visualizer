<script lang="ts">
  import type { TooltipRequest } from '../features/playtime/playtime-model.ts';
  import { clampTooltip } from '../features/playtime/playtime-model.ts';

  /**
   * The ONE shared tooltip for every chart on the page (04-UI-SPEC section 8).
   *
   * It is one element rather than one per cell, because a cell cannot own a
   * tooltip that has to survive the pointer leaving it, and because 04-10's
   * calendar is a second chart that must feed the same one. The owner holds
   * the "which cell is active" state; this component draws it.
   *
   * ## Why the positioning is a CSSOM write and not markup
   *
   * The build-time CSP is `default-src 'self'` with no `style-src
   * 'unsafe-inline'`, so a `style` attribute and the CSSOM's text setter are
   * both blocked,
   * and `svelte/no-inline-styles` is an error in this repo (RESEARCH Pattern 6,
   * probed). Writing `element.style.left` and `element.style.top` is the one
   * channel that survives both, and it is the only thing this component ever
   * writes: left and top, nothing else. `position: fixed` is in the style
   * block, so no scroller can clip the tooltip.
   *
   * ## Why it measures itself
   *
   * Placement needs the tooltip's own size, and the size depends on the text,
   * which depends on the cell. So the element is written, then measured, then
   * placed — in that order, in one effect, after the DOM has the content.
   *
   * ## Why it is aria-hidden
   *
   * Every cell already carries the same two lines as its accessible name, so
   * exposing the tooltip too would read everything twice. It is a visual
   * convenience for a sighted reader and a magnifier user, and it
   * disappears with the pointer.
   */
  interface Props {
    /** The active cell, or null for "nothing is active". */
    request: TooltipRequest | null;
    /**
     * The element the request was measured from, or null if the owner has
     * none. See `isStale` for why this exists.
     */
    anchor?: Element | null;
    /** Close it — Escape, a scroll, a resize, or a pointer leaving a cell. */
    onDismiss: () => void;
    /** Optional test id override for the tooltip element. Defaults to "chart-tooltip". */
    testId?: string;
  }

  let { request, anchor, onDismiss, testId = 'chart-tooltip' }: Props = $props();

  let element = $state<HTMLDivElement | null>(null);

  /**
   * Whether the request still describes where its cell actually is.
   *
   * The UI-SPEC says the tooltip closes on scroll, and the reason is that a
   * tooltip pointing at a cell that has moved is worse than no tooltip. That
   * reason is narrower than "any scroll", and the difference is load-bearing:
   *
   * A focused cell that lands under the sticky nav is corrected by
   * `scrollClear`, which scrolls the page. A scroll event fires ASYNCHRONOUSLY
   * — after the correction, after the caller has re-opened the tooltip against
   * the cell's new position — and a blanket dismissal would therefore close
   * the tooltip a fraction of a second after the key press that opened it. A
   * keyboard user moving a cell up under the nav would watch the tooltip
   * appear and vanish, repeatedly, which is the one case the tooltip exists
   * for. (The correction is instant for the same reason: a smooth one would
   * keep firing scroll events for the length of the glide.)
   *
   * So the question is not "did something scroll" but "did MY CELL MOVE". If
   * the cell is where it was measured, the tooltip is still correct and stays
   * put; if the reader scrolls the page, the cell moves, and the tooltip goes.
   * One device unit of tolerance absorbs layout rounding below the display's
   * resolution, not a scroll.
   */
  function isStale(): boolean {
    if (request === null || anchor === null || anchor === undefined) return true;
    const now = anchor.getBoundingClientRect();
    return (
      Math.abs(now.left - request.anchor.left) > 1 ||
      Math.abs(now.top - request.anchor.top) > 1 ||
      Math.abs(now.width - request.anchor.width) > 1 ||
      Math.abs(now.height - request.anchor.height) > 1
    );
  }

  /** Dismiss only what a scroll or resize has actually made wrong. */
  function dismissIfStale(): void {
    if (isStale()) onDismiss();
  }

  /**
   * `--nav-offset` from the one declaration in `app.css`, or 72.
   *
   * Read from the document element's computed style rather than imported from
   * CSS, because CSS is the single source of the value (the same reason the
   * scroll-spy and the section anchors read it). `parseFloat` on an unreadable
   * or empty value is NaN, and a NaN nav offset would place the tooltip with
   * NaN coordinates — so the fallback is a real number.
   */
  function navOffset(): number {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--nav-offset');
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 72;
  }

  $effect(() => {
    if (request === null || element === null) return;

    // Measure AFTER the content is in the DOM: the width depends on the text.
    const tip = { width: element.offsetWidth, height: element.offsetHeight };
    const placed = clampTooltip(
      request.anchor,
      tip,
      { width: window.innerWidth, height: window.innerHeight },
      navOffset(),
    );
    element.style.left = `${placed.left}px`;
    element.style.top = `${placed.top}px`;
  });
</script>

<!--
  Capture phase for the scroll, and both are on the window rather than on the
  tooltip: the grid's own horizontal scroller scrolls without the event ever
  reaching the window in the bubble phase, so a bubble-phase listener would
  leave the tooltip pointing at a cell that has moved. A resize moves cells
  too, for the same reason. Both go through `dismissIfStale` rather than
  closing outright — see `isStale` for the case that makes that matter.
-->
<svelte:window onresize={dismissIfStale} onscrollcapture={dismissIfStale} />

<div
  bind:this={element}
  class="tooltip"
  data-testid={testId}
  aria-hidden="true"
  hidden={request === null}
>
  <!-- Line 1 is Label role and line 2 is Caption, both white (UI-SPEC
       Typography): the surface is #3c4043, so the hierarchy has to come from
       weight, not from a second colour. -->
  <p class="line-one">{request?.line1 ?? ''}</p>
  <p class="line-two">{request?.line2 ?? ''}</p>
  {#if request?.extra}
    {#each request.extra as extraLine (extraLine)}
      <p class="line-two">{extraLine}</p>
    {/each}
  {/if}
</div>

<style>
  /*
    The chrome, verbatim from UI-SPEC section 8: no shadow, no arrow, no
    delay, no transition. `pointer-events: none` is load-bearing rather than
    cosmetic — without it the tooltip would swallow the pointer that is
    moving toward the cell, and it would flicker.
  */
  .tooltip {
    position: fixed;
    z-index: 2;
    max-width: 240px;
    padding: 8px 12px;
    border-radius: 6px;
    background: #3c4043;
    color: #ffffff;
    font-size: 14px;
    line-height: 1.4;
    pointer-events: none;
    overflow-wrap: anywhere;
  }

  /*
    The `hidden` attribute has to WIN over the chrome above, or the tooltip
    would be an invisible-but-present box in the layout: a UA rule for
    `[hidden]` is `display: none` at the lowest specificity, so the
    `display` declared here would otherwise beat it.
  */
  .tooltip[hidden] {
    display: none;
  }

  .line-one {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: #ffffff;
  }

  /* The 4px gap is the xs token: the two lines are one fact and its value,
     and a caption line hard against a label line reads as one run-on
     sentence. */
  .line-two {
    margin: 4px 0 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    color: #ffffff;
  }
</style>
