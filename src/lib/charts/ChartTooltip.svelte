<script lang="ts">
  import { getContext } from 'svelte';
  import type { TooltipRequest } from '../features/playtime/playtime-model.ts';
  import { clampTooltip } from '../features/playtime/playtime-model.ts';
  import {
    CHART_ANNOUNCE_KEY,
    pinOutcome,
    touchTapAction,
    type ChartAnnounce,
  } from './tooltip-pin.ts';

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
   * The page's announcement sink, or a no-op when there is none.
   *
   * It is absent anywhere the tooltip is mounted without a `Dashboard` above
   * it, which is why the default is a function rather than a null check at
   * every call: the component must keep working where it cannot speak, rather
   * than throwing on a context that nobody set.
   */
  const announce: ChartAnnounce =
    getContext<ChartAnnounce | undefined>(CHART_ANNOUNCE_KEY) ?? (() => {});

  /**
   * Whether the tooltip is PINNED — opened by a touch tap and staying until
   * something dismisses it — rather than held open by a hover or a focus.
   *
   * Plain and NOT `$state`, deliberately. It is bookkeeping read by the
   * document handlers and written by one effect, never by a template, so
   * making it reactive would only give that effect a second dependency and
   * the chance to re-run on a value it had just written. The visible result is
   * `request`, which the owner already holds.
   */
  let pinned = false;

  /**
   * Whether the pointer input currently driving this tooltip is a touch tap.
   *
   * This is the flag that keeps mouse and keyboard exactly as they were
   * (D-05): a hover and an arrow-key move clear it, so neither can ever be
   * mistaken for a pin, and only a touch press sets it.
   *
   * It is cleared by INPUT, never by a state change — and that is the whole
   * subtlety. One tap is not one request: the press opens the tooltip and the
   * engine's own focus handling then opens it AGAIN against the same cell a
   * moment later, because every cell is focusable. A flag consumed by the
   * first of those two transitions would leave the second looking like a
   * mouse open, and the tooltip would un-pin itself inside the same gesture
   * that pinned it. So the flag describes the pointer, not the request, and
   * the second open is correctly read as a MOVE — which announces nothing and
   * leaves the pin standing.
   */
  let touchOrigin = false;

  /**
   * A one-shot marker that the dismissal about to happen is SILENT — a scroll
   * or a resize moved the anchor, which is the reader moving the page rather
   * than asking for the tooltip to go (see `isStale`).
   *
   * Silent is the third outcome and not a weaker dismissal: the UI-SPEC says a
   * scroll closes the tooltip quietly, and the region still has to be cleared,
   * because a live region that still holds "Tooltip pinned." will not announce
   * that text a second time.
   */
  let silentDismiss = false;

  /**
   * The nearest ancestor of the anchor that names a chart surface.
   *
   * `data-tooltip-surface` is what makes a touch tap attributable to a chart:
   * a tap inside it is this chart's business, and a tap anywhere else on the
   * page is a dismissal. Reading it from the ANCHOR rather than from the tap
   * target is the point — the target is whatever the finger landed on, and the
   * anchor is the chart the tooltip actually belongs to.
   */
  function ownSurface(): Element | null {
    if (anchor === null || anchor === undefined) return null;
    return anchor.closest('[data-tooltip-surface]');
  }

  /**
   * A touch press, seen before the chart that owns the anchor ever sees it.
   *
   * Registered in the CAPTURE phase (see the `svelte:document` element below)
   * for exactly one reason: `toggle-off` has to stop the press from reaching
   * the chart, or the chart's own handler would reopen the tooltip this tap
   * just closed, in the same gesture. In the bubble phase that is already too
   * late — the chart has run.
   */
  function onDocumentPointerDown(event: PointerEvent): void {
    const isTouch = event.pointerType === 'touch';
    if (isTouch) touchOrigin = true;
    if (!isTouch) return;

    const target = event.target instanceof Element ? event.target : null;
    const mark = anchor ?? null;
    const surface = ownSurface();
    const action = touchTapAction({
      open: request !== null,
      pinned,
      insideOwnSurface: target !== null && surface !== null && surface.contains(target),
      onAnchor: target !== null && mark !== null && mark.contains(target),
    });

    if (action === 'dismiss') {
      onDismiss();
      return;
    }
    if (action === 'toggle-off') {
      onDismiss();
      event.stopPropagation();
    }
  }

  /**
   * A mouse entering the page is a mouse, not a tap.
   *
   * Without this, a finger tap followed by a mouse hover would leave
   * `touchOrigin` set and the next hover would be announced as a pin. It is
   * cleared on a NON-touch pointerover and on any key press, which is the
   * whole of this handler's effect on the mouse and keyboard paths: they
   * behave exactly as they did before this component grew a touch branch.
   */
  function onDocumentPointerOver(event: PointerEvent): void {
    if (event.pointerType !== 'touch') touchOrigin = false;
  }

  function onDocumentKeyDown(event: KeyboardEvent): void {
    touchOrigin = false;
    // Escape dismisses a PINNED tooltip even when focus is not inside the
    // chart — with a finger there is no focus to hold it, so nothing else
    // would ever close it. An unpinned tooltip is left to the chart's own
    // Escape, which is where that behaviour already lives.
    if (event.key === 'Escape' && pinned) onDismiss();
  }

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
    if (!isStale()) return;
    // Marked BEFORE the dismissal, because the effect that reads the mark
    // runs as a consequence of it. A scroll is the reader moving the page, not
    // the reader asking for the tooltip to go, so the UI-SPEC says it closes
    // quietly — but "quietly" still means the region has to be cleared, or the
    // next pin would find the text it wants to announce already sitting there.
    silentDismiss = true;
    onDismiss();
  }

  /**
   * `--nav-offset` from the one declaration in `app.css`, or 72.
   *
   * It is the clearance above content: no sticky chrome sits over the detail
   * pane any more, so it is now the 16px of breathing room, and the tooltip
   * flips below its anchor only within that plus the gap of the viewport top.
   * Read from the document element's computed style rather than imported from
   * CSS, because CSS is the single source of the value (the sticky calendar
   * year head reads it too). `parseFloat` on an unreadable
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

  /**
   * The pin and the announcement, decided once per request.
   *
   * `request` is the only thing this effect READS. Everything else it touches
   * — `pinned`, `touchOrigin`, `silentDismiss` — is plain and not reactive, so
   * writing them here cannot re-enter this effect and cannot be the reason it
   * ran. That is what makes one pass over one transition enough, and it is why
   * the bookkeeping is not `$state`.
   *
   * One tap runs this more than once, and that is correct rather than a
   * double-handling: the press opens the tooltip and the engine's own focus
   * handling opens it again against the same cell. The first pass pins and
   * speaks; the second reads as the move it is, and says nothing. `silentDismiss`
   * IS reset here, because it describes one dismissal and that dismissal has
   * now been decided; `touchOrigin` is not, because it describes the pointer
   * rather than the request — see its own comment.
   */
  $effect(() => {
    const outcome = pinOutcome({
      wasPinned: pinned,
      open: request !== null,
      touchOrigin,
      silent: silentDismiss,
    });
    pinned = outcome.pinned;
    silentDismiss = false;
    if (outcome.announce !== null) announce(outcome.announce);
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

<!--
  The touch branch's three inputs, all at the DOCUMENT and all in the CAPTURE
  phase.

  Capture is not a preference here. A tap on the anchor of an already-pinned
  tooltip has to be able to stop that tap before the chart's own delegated
  press handler runs, or the chart reopens the tooltip the tap just closed
  inside the same gesture. By the bubble phase that decision has already been
  made and there is nothing left to stop.

  These listeners are declared on `svelte:document` rather than added by hand,
  so they are attached with the component and detached with it — there is no
  effect to forget a removal in, and nothing is left observing the page after
  the dashboard goes. They are three functions, and every one of them does
  nothing at all for a mouse or a key press except clear one flag.
-->
<svelte:document
  onpointerdowncapture={onDocumentPointerDown}
  onpointerovercapture={onDocumentPointerOver}
  onkeydowncapture={onDocumentKeyDown}
/>

<div
  bind:this={element}
  class="tooltip"
  data-testid={testId}
  aria-hidden="true"
  hidden={request === null}
>
  <!-- Line 1 is Label role and line 2 is Caption, both white (UI-SPEC
       Typography): the surface is var(--text), so the hierarchy has to come from
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
    padding: var(--space-8) var(--space-12);
    border-radius: var(--radius-sm);
    background: var(--text);
    /* White on the dark `--text` surface: the tooltip's own colour, not a page
       surface, so it reads `--white` and not `--page`. */
    color: var(--white);
    font-size: var(--fs-body);
    line-height: var(--lh-tight);
    pointer-events: none;
    overflow-wrap: anywhere;

    /*
      The `hidden` attribute has to WIN over the chrome above, or the tooltip
      would be an invisible-but-present box in the layout: a UA rule for
      `[hidden]` is `display: none` at the lowest specificity, so the
      `display` declared here would otherwise beat it.

      It is NESTED under `.tooltip` because it extends it, and nesting keeps
      the specificity and the order it had as a sibling (D-05).
    */
    &[hidden] {
      display: none;
    }
  }

  .line-one {
    margin: 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-tight);
    color: var(--white);
  }

  /* The 4px gap is the xs token: the two lines are one fact and its value,
     and a caption line hard against a label line reads as one run-on
     sentence. */
  .line-two {
    margin: var(--space-4) 0 0;
    font-size: var(--fs-body);
    font-weight: var(--fw-regular);
    line-height: var(--lh-tight);
    color: var(--white);
  }
</style>
