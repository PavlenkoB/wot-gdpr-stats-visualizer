import { describe, expect, test } from 'vitest';
import {
  buildRootMargin,
  isAtPageBottom,
  navScrollLeftFor,
  parseNavOffset,
  pickActiveSection,
} from '../../../src/lib/shell/scroll-spy.ts';

// =============================================================================
// scroll-spy — the pure scroll rule and observer band helpers (03-02 Task 3)
// =============================================================================
//
// The nav's `aria-current="location"` is decided here, not in the component,
// so the rule can be stated once and tested without a DOM. The repo's
// Vitest setup has no jsdom and none is wanted: the observer wiring is thin
// and lives in Plan 03-05, while the DECISION — which link is current — is
// the part that is easy to get subtly wrong (D-05, RESEARCH Q5).
//
// The three findings this encodes, all from Chromium probes in RESEARCH Q5:
//
//   1. An IntersectionObserver callback delivers DELTAS, not the full set.
//      A callback that only reads its own `entries` gets the wrong answer
//      whenever several sections intersect the band, so the caller keeps
//      the full set and this function picks from it.
//   2. The bottom-of-page override needs two guards. On a page too short to
//      scroll, `scrollY + innerHeight >= scrollHeight - 1` is already true
//      at `scrollY = 0`, and the last link would be current on load — which
//      contradicts "initial = first" and shows up on tall screens and in
//      the skeleton state.
//   3. At Phase 3 content heights, middle sections often cannot reach the
//      band before the page bottoms out, so the override legitimately
//      reports the last link. That is the specified behaviour, not a bug.
// =============================================================================

const ORDER = ['a', 'b', 'c', 'd', 'e'] as const;

describe('pickActiveSection', () => {
  test('picks the topmost intersecting section when several intersect', () => {
    // The band can span two or three short sections at once; the topmost
    // one wins, which is why the caller passes the whole set rather than
    // the callback's entries.
    expect(
      pickActiveSection({
        order: ORDER,
        intersecting: new Set(['c', 'a', 'd']),
        previous: 'b',
        atBottom: false,
      }),
    ).toBe('a');
  });

  test('keeps the previous section when nothing intersects the band', () => {
    // A section taller than the band swallows it entirely — the callback
    // then reports no intersection at all, and blanking the nav there
    // would be worse than leaving the last highlight in place.
    expect(
      pickActiveSection({
        order: ORDER,
        intersecting: new Set(),
        previous: 'c',
        atBottom: false,
      }),
    ).toBe('c');
    // Contrast: the set IS consulted, so "c" above is the previous-fallback
    // and not a constant.
    expect(
      pickActiveSection({
        order: ORDER,
        intersecting: new Set(['e']),
        previous: 'c',
        atBottom: false,
      }),
    ).toBe('e');
  });

  test('the bottom of the page wins whatever the set contains', () => {
    expect(
      pickActiveSection({
        order: ORDER,
        intersecting: new Set(['a']),
        previous: 'a',
        atBottom: true,
      }),
    ).toBe('e');
  });

  test('an empty order returns the previous id rather than undefined', () => {
    // Nothing is mounted (the checking-cache state renders no sections), so
    // there is no last id to return and no array index to read.
    expect(
      pickActiveSection({
        order: [],
        intersecting: new Set(['a']),
        previous: 'a',
        atBottom: true,
      }),
    ).toBe('a');
  });

  test('ignores intersecting ids that are not in the order', () => {
    expect(
      pickActiveSection({
        order: ORDER,
        intersecting: new Set(['zzz', 'c']),
        previous: 'a',
        atBottom: false,
      }),
    ).toBe('c');
  });
});

describe('isAtPageBottom', () => {
  // A scrollable page: a 3000px document in an 800px viewport, so the
  // effective threshold is scrollY 2199 (3000 - 1px slack - 800 viewport).
  const page = { scrollY: 2199, innerHeight: 800 };
  const docHeight = 3000;

  test('a document no taller than the viewport is never at the bottom', () => {
    // Without this guard a non-scrollable page would report the last link
    // as current on load, violating "initial = first" — and the skeleton
    // state is exactly such a page. Scrolling it is still not the bottom:
    // there is nowhere left to go.
    expect(isAtPageBottom({ scrollY: 0, innerHeight: 800 }, 800)).toBe(false);
    expect(isAtPageBottom({ scrollY: 0, innerHeight: 800 }, 400)).toBe(false);
    expect(isAtPageBottom({ scrollY: 400, innerHeight: 800 }, 800)).toBe(false);
  });

  test('the top of a scrollable page is never at the bottom', () => {
    // The other guard: at rest, scrollY + innerHeight is still well short
    // of the document height, so the arithmetic alone is not enough — the
    // scrollY > 0 guard is what stops a tall page at load from claiming
    // the last link. The contrast line differs only in scrollY.
    expect(isAtPageBottom({ scrollY: 0, innerHeight: 800 }, 3000)).toBe(false);
    expect(isAtPageBottom(page, 3000)).toBe(true);
  });

  test('is true once the viewport bottom reaches the document bottom', () => {
    expect(isAtPageBottom(page, docHeight)).toBe(true);
  });

  test('the threshold is exact to the pixel, with one pixel of slack', () => {
    // One pixel short of the effective threshold is false; the threshold
    // itself is true; and the true bottom one pixel further on is still
    // true. Sub-pixel scroll positions land between the last two
    // continuously, so the slack is what stops aria-current flickering
    // as the user settles at the bottom.
    expect(isAtPageBottom({ scrollY: 2198, innerHeight: 800 }, docHeight)).toBe(false);
    expect(isAtPageBottom({ scrollY: 2199, innerHeight: 800 }, docHeight)).toBe(true);
    expect(isAtPageBottom({ scrollY: 2200, innerHeight: 800 }, docHeight)).toBe(true);
  });
});

describe('buildRootMargin', () => {
  test('72px produces the UI-SPEC observer band exactly', () => {
    // The string is quoted in 03-UI-SPEC.md and the Playwright spec
    // asserts against it, so this is an exact-equality test rather than a
    // shape check.
    expect(buildRootMargin(72)).toBe('-72px 0px -60% 0px');
  });

  test('a different nav offset changes only the top margin', () => {
    expect(buildRootMargin(80)).toBe('-80px 0px -60% 0px');
  });

  test('the band bottom is a parameter, defaulting to 60% of viewport height', () => {
    expect(buildRootMargin(72, 50)).toBe('-72px 0px -50% 0px');
  });
});

describe('parseNavOffset', () => {
  test('parses the computed custom-property value', () => {
    expect(parseNavOffset(' 72px')).toBe(72);
    expect(parseNavOffset('80px')).toBe(80);
  });

  test('falls back to 72px when the value is unusable', () => {
    // An unset custom property reads as the empty string, so without a
    // fallback the band would be built from NaN and the observer would
    // watch the wrong band with no error. The contrast line proves a
    // parseable value is actually read rather than ignored.
    expect(parseNavOffset('')).toBe(72);
    expect(parseNavOffset('auto')).toBe(72);
    expect(parseNavOffset('abc')).toBe(72);
    expect(parseNavOffset(' 64px')).toBe(64);
  });

  test('honours a custom fallback', () => {
    expect(parseNavOffset('', 64)).toBe(64);
    expect(parseNavOffset('abc', 64)).toBe(64);
    expect(parseNavOffset('96px', 64)).toBe(96);
  });
});

// =============================================================================
// navScrollLeftFor — the nav's OWN scroll position (05-09)
// =============================================================================
//
// Six links no longer fit the 720px column, so the nav scrolls inside itself.
// The scroll-spy says WHICH link is current; this says WHERE the nav must scroll
// so that link is actually visible. The two are separate questions and the
// second one has to be answerable without a DOM, so it is a pure function over
// five numbers the component measures.
//
// It exists rather than a native scroll-into-view because that call scrolls
// EVERY scrollable ancestor, page included: it would move the page to wherever
// the nav happened to be while the reader was trying to stay where they were.
// The rule moves the nav's own `scrollLeft` and nothing else.
// =============================================================================

describe('navScrollLeftFor', () => {
  test('leaves the position alone when the link is already inside the inset', () => {
    expect(
      navScrollLeftFor({
        scrollLeft: 40,
        clientWidth: 300,
        linkLeft: 100,
        linkRight: 180,
        inset: 8,
      }),
    ).toBe(40);
  });

  test('scrolls left just far enough to clear the left inset', () => {
    // The link's left edge is 4px in and the inset is 8, so 4px of scroll.
    expect(
      navScrollLeftFor({
        scrollLeft: 100,
        clientWidth: 300,
        linkLeft: 4,
        linkRight: 84,
        inset: 8,
      }),
    ).toBe(96);
  });

  test('scrolls right just far enough to clear the right inset', () => {
    // 296 is 4px past the 292px right limit, so 4px of scroll.
    expect(
      navScrollLeftFor({
        scrollLeft: 0,
        clientWidth: 300,
        linkLeft: 200,
        linkRight: 296,
        inset: 8,
      }),
    ).toBe(4);
  });

  test('never returns a negative position', () => {
    expect(
      navScrollLeftFor({
        scrollLeft: 2,
        clientWidth: 300,
        linkLeft: 0,
        linkRight: 80,
        inset: 8,
      }),
    ).toBe(0);
    expect(
      navScrollLeftFor({
        scrollLeft: 0,
        clientWidth: 300,
        linkLeft: -50,
        linkRight: 30,
        inset: 8,
      }),
    ).toBe(0);
  });

  test('shows the LEFT edge of a link too wide for the nav', () => {
    // A 300px link in a 100px nav cannot be shown whole, and scrolling to its
    // right edge would leave the reader looking at the middle of a name. The
    // left edge is the useful half: it is the start of the word.
    expect(
      navScrollLeftFor({
        scrollLeft: 0,
        clientWidth: 100,
        linkLeft: 0,
        linkRight: 300,
        inset: 8,
      }),
    ).toBe(0);
    expect(
      navScrollLeftFor({
        scrollLeft: 50,
        clientWidth: 100,
        linkLeft: -50,
        linkRight: 250,
        inset: 8,
      }),
    ).toBe(0);
  });

  test('returns to the very start when the first link becomes current again', () => {
    // The first link sits at the nav's own padding, so as the nav scrolls it
    // goes negative and the rule pulls all the way back.
    expect(
      navScrollLeftFor({
        scrollLeft: 100,
        clientWidth: 300,
        linkLeft: -92,
        linkRight: -12,
        inset: 8,
      }),
    ).toBe(0);
  });

  test('a zero inset means no breathing room, so a flush link is left alone', () => {
    // The same geometry, and only the inset differs: at 8px the link is 8px
    // past the right limit and the nav scrolls; at 0px it ends exactly on the
    // edge and the nav does not move.
    const geometry = { scrollLeft: 0, clientWidth: 100, linkLeft: 10, linkRight: 100 };

    expect(navScrollLeftFor({ ...geometry, inset: 0 })).toBe(0);
    expect(navScrollLeftFor({ ...geometry, inset: 8 })).toBe(8);
  });

  test('survives a non-finite measurement rather than producing NaN', () => {
    // A NaN `scrollLeft` would silently stop the nav scrolling, with no error
    // anywhere — the same failure mode `parseNavOffset`'s fallback exists for.
    expect(
      navScrollLeftFor({
        scrollLeft: Number.NaN,
        clientWidth: 300,
        linkLeft: 100,
        linkRight: 180,
        inset: 8,
      }),
    ).toBe(0);
  });
});
