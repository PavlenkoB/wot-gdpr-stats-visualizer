// =============================================================================
// The scroll-spy decision rule and observer band helpers (D-05)
// =============================================================================
//
// Which nav link is `aria-current="location"` is decided here, as a pure
// function over data the caller collects. The component in Plan 03-05 owns
// only the plumbing: creating the observer, maintaining the set, listening
// for scroll, and tearing both down.
//
// The split is deliberate. The plumbing is thin and the rule is subtle, and
// this repo's Vitest setup has no jsdom — so a rule that lived in a Svelte
// component would be untestable, and a rule that is subtle and untestable
// is a rule that gets guessed at. Every judgement call worth locking down
// is below; every `window` access is in the component.
//
// Three findings from the Chromium probes in RESEARCH Q5 shape this file:
//
//   1. An IntersectionObserver callback receives DELTAS — one entry per
//      threshold crossing — not the full picture. Reading only the current
//      callback's entries gives the wrong answer the moment two or three
//      short sections intersect the band at once, which is the normal case
//      at Phase 3 content heights. So the CALLER keeps a Set of everything
//      currently intersecting, and `pickActiveSection` reads that.
//
//   2. The bottom-of-page override needs two guards. On a page too short to
//      scroll, `scrollY + innerHeight >= scrollHeight - 1` is already true
//      at `scrollY = 0`, so without `docHeight > innerHeight` the last
//      link would be current on load — which contradicts "initial = first"
//      and shows up on tall screens and in the skeleton state, where there
//      is nothing to scroll. `scrollY > 0` closes the same hole for a tall
//      page that is merely at the top.
//
//   3. The band's bottom margin is a percentage. The W3C text resolves
//      percentages "relative to the width of the undilated rectangle", but
//      Chromium resolves top/bottom margins against HEIGHT, which is what
//      makes the UI-SPEC's `-60%` mean "40% of the viewport height". That
//      is verified in Chromium; in Firefox and Safari it is unverified
//      (RESEARCH assumption A1). The project is Chrome-first with
//      Safari/Firefox best-effort (AGENTS.md), so the spec string stands —
//      but if cross-browser drift ever matters, the fix is to compute the
//      bottom margin in pixels from `innerHeight` and rebuild the observer
//      on resize, not to special-case a browser here.

/**
 * The id of the section that should be current.
 *
 * Precedence, in order:
 *   1. the LAST id, when the page is scrolled to its bottom — otherwise
 *      the short final block is unreachable, because the band sits above
 *      it and can never be intersected;
 *   2. the first id in DOM order that is currently intersecting the band,
 *      so the TOPMOST of several candidates wins;
 *   3. the previous id, when nothing intersects — a section taller than
 *      the band swallows it whole, and keeping the last highlight beats
 *      clearing the nav.
 *
 * Clicking a link does NOT set the current id: the observer is the single
 * source of truth (D-05), so a click that jumps past a section does not
 * leave a highlight pointing somewhere the user never went.
 *
 * `order` is empty only when no section is mounted (the checking-cache
 * state renders none), in which case there is no last id to index and
 * `previous` is returned rather than `undefined`.
 */
export function pickActiveSection(args: {
  /** Section ids in document order. */
  order: readonly string[];
  /** Every id currently intersecting the band, not just this callback's. */
  intersecting: ReadonlySet<string>;
  /** The last id this function returned. */
  previous: string;
  /** Whether the page is scrolled to its bottom. */
  atBottom: boolean;
}): string {
  if (args.atBottom) return args.order[args.order.length - 1] ?? args.previous;
  return args.order.find((id) => args.intersecting.has(id)) ?? args.previous;
}

/**
 * Whether the page is scrolled to its bottom, given the numbers only.
 *
 * The 1px slack absorbs sub-pixel viewport heights and fractional scroll
 * positions, which sit continuously between the last two integers; without
 * it `aria-current` would flicker as the user settles at the bottom.
 *
 * The two guards are load-bearing, not defensive padding — see finding 2
 * above.
 */
export function isAtPageBottom(
  viewport: { scrollY: number; innerHeight: number },
  docHeight: number,
): boolean {
  return (
    docHeight > viewport.innerHeight &&
    viewport.scrollY > 0 &&
    viewport.scrollY + viewport.innerHeight >= docHeight - 1
  );
}

/**
 * The `rootMargin` for the section observer: a band starting just below
 * the sticky nav and ending 40% down the viewport.
 *
 * The top margin is the nav offset so the band begins under the nav rather
 * than behind it, and the bottom margin keeps a section from counting as
 * current while it is still mostly below the fold. With the defaults this
 * is exactly the string quoted in 03-UI-SPEC.md and asserted by the
 * Playwright spec, so it is built here rather than inlined in a component
 * where nobody would notice it changing.
 */
export function buildRootMargin(navOffsetPx: number, bandBottomPercent = 60): string {
  return `-${navOffsetPx}px 0px -${bandBottomPercent}% 0px`;
}

/**
 * Read `--nav-offset` out of computed styles as a number of pixels.
 *
 * `getComputedStyle(...).getPropertyValue('--nav-offset')` returns the raw
 * token (' 72px'), and an unset custom property returns ''. Leading
 * whitespace is normal, so it is tolerated; anything unparseable falls back
 * to the documented default rather than to NaN, because a NaN offset would
 * build a band the observer silently ignores — a wrong nav with no error
 * anywhere.
 */
export function parseNavOffset(raw: string, fallback = 72): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// =============================================================================
// navScrollLeftFor — the nav's own scroll position (05-09, D-01)
// =============================================================================
//
// Six nav links no longer fit the 720px column, so the nav scrolls inside itself.
// `pickActiveSection` above says WHICH link is current; this says WHERE the nav
// has to be scrolled for that link to be visible. They are separate questions:
// the first is a rule about the page, the second is arithmetic over five numbers,
// and the second is the one that has to be testable without a DOM.
//
// WHY NOT THE NATIVE CALL
// The obvious implementation — ask the browser to scroll the current link into
// view — scrolls EVERY scrollable ancestor, the page included. With a sticky nav
// that means moving the page to wherever the nav happened to sit, while the
// reader was trying to stay where they were, and a page whose vertical position
// is owned by a horizontal convenience. Writing the nav's own `scrollLeft` moves
// the nav and nothing else.
//
// The inset is the nav's own padding rather than zero, because a link flush
// against the edge has its 3px underline and its focus ring clipped, and the
// ring is exactly what a keyboard reader needs to see.
//
// The write is INSTANT: `scroll-behavior` is not an inherited property, the page
// sets it on the root element only, and the nav declares none of its own, so
// assigning `scrollLeft` here never animates.

/**
 * Where the nav should be scrolled to keep one link fully inside its box.
 *
 * All edges are in the nav's own coordinate space: `linkLeft` and `linkRight`
 * are measured from the nav's left BORDER edge, which is the origin
 * `scrollLeft` and `clientWidth` share. Returns the unchanged `scrollLeft` when
 * the link is already inside the inset, and never a negative one.
 *
 * A link too wide for the nav cannot be shown whole; its LEFT edge wins, because
 * the start of a name is the useful half of it.
 */
export function navScrollLeftFor(geometry: {
  /** The nav's current horizontal scroll position. */
  scrollLeft: number;
  /** The nav's visible content width. */
  clientWidth: number;
  /** The link's left edge, from the nav's left border edge. */
  linkLeft: number;
  /** The link's right edge, from the nav's left border edge. */
  linkRight: number;
  /** How much breathing room to keep at each end — the nav's own padding. */
  inset: number;
}): number {
  const from = Number.isFinite(geometry.scrollLeft) ? geometry.scrollLeft : 0;
  const inset = Number.isFinite(geometry.inset) ? Math.max(0, geometry.inset) : 0;
  const rightLimit = geometry.clientWidth - inset;

  // Already inside both insets: the nav does not move. This is the common case
  // and the reason the component can compare the result and skip the write.
  if (geometry.linkLeft >= inset && geometry.linkRight <= rightLimit) {
    return from;
  }

  // Past the left inset. Checked FIRST, so an over-wide link shows its start.
  if (geometry.linkLeft < inset) {
    return Math.max(0, from - (inset - geometry.linkLeft));
  }

  return Math.max(0, from + (geometry.linkRight - rightLimit));
}
