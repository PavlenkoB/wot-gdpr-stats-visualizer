// =============================================================================
// focus-clear — the one piece of new ARITHMETIC-ish logic in plan 04-09, and
// the one piece with a sign convention that is easy to get backwards.
// =============================================================================
//
// THE PHYSICS, which 04-09 had backwards.
//
// A cell that sits ABOVE the clear line — under the sticky nav, or under the
// sticky year head — has to move DOWN on screen. Moving content down on screen
// means moving the PAGE up, which is a NEGATIVE `scrollBy` top.
// `focusScrollDelta` already returns that negative number (a cell 36px short
// returns -36) and `scrollClear` passes it through unchanged. That is the
// whole sign convention: the delta IS the scroll to apply, never its opposite.
//
// 04-09 inverted it — the helper negated the delta, so pressing a key that
// landed a cell under the nav scrolled the page DOWN and pushed the cell
// FURTHER under it. The unit tests here pinned the inverted form and their
// comment read "scrolls the page DOWN" as though that moved the cell down.
// Plan 04-17 measured the consequence in a browser against the built app: a
// calendar cell parked under the stuck head and moved with ArrowUp went from
// 68px to 31px below the viewport top at 1280px, and from 69px to 21px at
// 375px. The correction fired, and it buried the cell.
//
// `focus-clear.ts` is the ONLY place that sign is applied, so this suite pins
// it here rather than leaving it to a screenshot: a cell 36px short of the
// clear line moves DOWN by 36, which is the page scrolling UP by 36, and a
// cell that is already clear does not move at all.
//
// Everything else in `focus-clear.ts` is DOM access — two `getBoundingClientRect`
// calls and one `scrollBy` — so the stubs are the whole surface. No jsdom:
// vitest.config.ts deliberately has none (01-04 tried adding it and rejected
// it), which is why the decision being tested is "which number goes where",
// not "does the browser scroll".
// =============================================================================

import { afterEach, describe, expect, test, vi } from 'vitest';

type FocusClear = typeof import('../../src/lib/focus-clear');

let cached: Promise<FocusClear> | null = null;

/**
 * The module under test, loaded lazily so a missing export is a failure IN THE
 * TEST THAT NEEDS IT, naming the symbol, rather than a load-time crash that
 * takes the whole file down.
 */
const load = (): Promise<FocusClear> => {
  cached ??= import('../../src/lib/focus-clear');
  return cached;
};

/** What the helper asked the window to do, in the shape it asks for it. */
interface ScrollRequest {
  top: number;
  behavior: ScrollBehavior;
}

/** The gaps `focusScrollDelta` adds: the nav bottom, the head, then 8px. */
const NAV_BOTTOM = 72;
const GAP = 8;

/**
 * A stand-in for the focused `<rect>`, positioned `top` px down the viewport.
 *
 * A plain object rather than a DOM element: `scrollClear` asks for one method
 * on it and nothing else.
 */
const cell = (top: number) =>
  ({
    getBoundingClientRect: () => ({ top, left: 100, width: 24, height: 24 }),
  }) as unknown as Element;

/**
 * The two globals `scrollClear` reads, and the scrolls it asks for.
 *
 * `navBottom: null` is the "no nav on the page" case, which the helper must
 * treat as 0 rather than throwing — a chart can be rendered in isolation.
 */
function stubDom(navBottom: number | null): { scrolls: Array<ScrollRequest> } {
  const scrolls: ScrollRequest[] = [];
  vi.stubGlobal('window', {
    scrollBy: (options: ScrollRequest) => {
      scrolls.push(options);
    },
  });
  vi.stubGlobal('document', {
    querySelector: (selector: string) =>
      selector === 'nav' && navBottom !== null
        ? { getBoundingClientRect: () => ({ bottom: navBottom }) }
        : null,
  });
  return { scrolls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scrollClear — keep a focused cell out from under the sticky nav', () => {
  test('scrolls the page UP by exactly the shortfall, which moves the cell DOWN', async () => {
    // THE SIGN. The clear line is the nav bottom plus the 8px gap, so 72 + 8
    // = 80; a cell 36px short of it sits at 44. `focusScrollDelta` reports
    // -36, and that IS the scroll to apply: a negative `top` moves the page
    // up, which moves the cell down on screen and out from under the chrome.
    // A helper that negated the delta would scroll the page down and bury the
    // cell further, which is the bug 04-17 fixed.
    const { scrollClear } = await load();
    const { scrolls } = stubDom(NAV_BOTTOM);

    scrollClear(cell(NAV_BOTTOM + GAP - 36), 0);

    expect(scrolls).toEqual([{ top: -36, behavior: 'instant' }]);
  });

  test('does not scroll at all when the cell is already clear', async () => {
    // 0 is the caller's cue to leave the page alone. Scrolling "just in case"
    // would move a perfectly visible cell out from under the reader.
    const { scrollClear } = await load();
    const { scrolls } = stubDom(NAV_BOTTOM);

    scrollClear(cell(400), 0);
    scrollClear(cell(NAV_BOTTOM + GAP), 0);

    expect(scrolls).toEqual([]);
  });

  test('adds the sticky head height to the clear line', async () => {
    // 04-10's calendar year head is 32px of real height that sits between the
    // nav and the grid, and the helper is told its measured height rather than
    // assuming it: 72 + 32 + 8 = 112, so a cell at 76 is 36px short.
    const { scrollClear } = await load();
    const { scrolls } = stubDom(NAV_BOTTOM);

    scrollClear(cell(76), 32);

    expect(scrolls).toEqual([{ top: -36, behavior: 'instant' }]);
  });

  test('treats an absent nav as a zero-height one instead of failing', async () => {
    // A chart rendered without the dashboard's nav is a real state (a future
    // embed, a test harness), and a throw here would take the whole keydown
    // handler down with it.
    const { scrollClear } = await load();
    const { scrolls } = stubDom(null);

    scrollClear(cell(400), 0);
    expect(scrolls).toEqual([]);

    // With no nav the clear line is just the 8px gap, so a cell 12px short of
    // it (at -4) is still short and still moves down.
    scrollClear(cell(GAP - 12), 0);
    expect(scrolls).toEqual([{ top: -12, behavior: 'instant' }]);
  });

  test('asks for a vertical, INSTANT jump and nothing else', async () => {
    // The correction exists because `scroll-margin-top` is not honoured on an
    // SVG `<rect>`. Nothing about it is a horizontal correction, and a
    // non-zero `left` would pan a page that is already correct.
    //
    // `behavior: 'instant'` is load-bearing rather than cosmetic: the tooltip
    // closes on scroll, so a SMOOTH correction would keep firing scroll events
    // for the length of the glide and would dismiss the tooltip the focus that
    // caused the correction had just opened. See the helper's own comment.
    const { scrollClear } = await load();
    const { scrolls } = stubDom(NAV_BOTTOM);

    scrollClear(cell(0), 0);

    expect(scrolls).toEqual([{ top: -(NAV_BOTTOM + GAP), behavior: 'instant' }]);
  });
});
