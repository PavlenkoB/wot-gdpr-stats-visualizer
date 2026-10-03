import { focusScrollDelta, type Rect } from './playtime-model.ts';

/**
 * Keep a focused heatmap cell clear of the sticky nav and the sticky year head
 * (RESEARCH Pitfall 6, 04-UI-SPEC section 5 and 6).
 *
 * ## Why this is a measured scroll and not `scroll-margin-top`
 *
 * `scroll-margin-top` is not reliably honoured on an SVG `<rect>`, and the
 * hour grid is 168 `<rect>` elements. So the caller focuses the cell, this
 * helper measures where it actually ended up, and scrolls the page by the
 * difference if it is short. The horizontal half needs nothing: the browser's
 * own focus scrolling already brings a far-right cell into view inside the
 * grid's scroller.
 *
 * ## Why `headHeight` is measured by the caller and not assumed
 *
 * 04-10's calendar year head is 32px of declared height whose real height
 * grows when its summary wraps at narrow widths, and RESEARCH Pitfall 6 is
 * explicit that a head assumed to be 32px is a head that overlaps the grid at
 * 375px. So the height is an argument, and the calendar passes what it
 * measured.
 *
 * ## The sign, and why the scroll is instant
 *
 * `focusScrollDelta` returns the scroll TO APPLY, with its own sign: a cell
 * 36px short of the clear line returns -36, and a negative `top` scrolls the
 * PAGE up, which moves the cell DOWN on screen and out from under the chrome.
 * The value is never positive, so this helper passes it through unchanged and
 * never has to think about direction.
 *
 * 04-09 had this inverted — it negated the delta — and the unit tests pinned
 * the inverted form, so the mistake survived four plans. Plan 04-17 measured
 * what it cost in a browser against the built app: a calendar cell parked
 * under the stuck head and moved with ArrowUp went from 68px to 31px below
 * the viewport top at 1280px, and from 69px to 21px at 375px. The correction
 * fired, and it pushed the cell FURTHER under the nav it was meant to clear.
 * (04-11 read this path as unreachable, because the browser's own `focus()`
 * centres a cell that is off screen; it is reachable exactly when the cell is
 * on screen and under the chrome.)
 *
 * The scroll opts out of the page's `scroll-behavior: smooth`, and it has to.
 * The tooltip closes on scroll (UI-SPEC section 8), so a SMOOTH correction
 * would keep firing scroll events for the ~300ms the glide takes and would
 * dismiss the tooltip the focus that caused the correction had just opened —
 * a keyboard user moving a cell up under the nav would see no tooltip at all.
 * An instant correction is one jump, one scroll event, and the caller re-opens
 * the tooltip against the cell's new position. It is also what
 * `prefers-reduced-motion: reduce` already gets today (D-29), and this chart
 * declares no motion of its own (UI-SPEC section 9), so nothing is lost.
 *
 * DOM-only and deliberately tiny: two rects, one optional nav lookup, one
 * scroll. The arithmetic is `focusScrollDelta`'s and is unit-tested there.
 */
export function scrollClear(element: Element, headHeight: number): void {
  // A plain tag query, not a test id: the nav is a page landmark, and a
  // chart rendered without the dashboard's nav (an embed, a harness) must
  // measure a zero-height one rather than throw.
  const nav = document.querySelector('nav');
  const navBottom = nav === null ? 0 : nav.getBoundingClientRect().bottom;

  const rect: Rect = element.getBoundingClientRect();
  // 0 is the caller's cue to leave the page alone, so a cell that is already
  // clear is not scrolled "just in case".
  const delta = focusScrollDelta(rect, navBottom, headHeight);
  if (delta !== 0) window.scrollBy({ top: delta, behavior: 'instant' });
}
