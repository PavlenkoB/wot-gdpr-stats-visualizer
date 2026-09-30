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
 * `focusScrollDelta` returns the NEGATIVE of the scroll to apply: a cell 36px
 * short returns -36, and this helper turns it into a 36px downward scroll.
 * The value is never positive, because a focused cell is always in view when
 * it takes focus — there is no case where the page needs scrolling back UP.
 * (Plan 04-09's Task 2 action text says `window.scrollBy(0, delta)`, which is
 * the opposite sign and would bury the cell further under the nav; the
 * deviation is recorded in the plan's SUMMARY.)
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
  if (delta !== 0) window.scrollBy({ top: -delta, behavior: 'instant' });
}
