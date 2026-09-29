---
phase: 03-dashboard-shell-account-identity
plan: 05
status: complete
wave: 2
requirements: [NAV-01, NAV-02, NAV-03, NAV-04, A11Y-01, A11Y-02]
---

# Plan 03-05 — the sticky anchor nav, the scroll-spy, and the observer band

## What was built

**`DashboardNav.svelte`** is the nav the whole phase was waiting for: five
native `<a href="#id">` links in `NAV_ORDER`, above the sections and stuck to
the top of the viewport. The root element IS the `<nav>` — not a wrapper
around one, because `position: sticky` is scoped to the element it is set on
and a wrapper would confine the nav to the wrapper's own non-scrolling box
(RESEARCH Pitfall 11). It is a direct child of `Dashboard.svelte`'s flex
column, between the identity header and the sections wrapper, and it is the
only sticky element on the page.

**The scroll-spy is the only writer of `aria-current`** (D-05). One
`$effect` arms, after mount: it looks up all five section roots, bails out if
any is missing, reads `--nav-offset` from the page root, and creates one
`IntersectionObserver` whose `rootMargin` is `buildRootMargin(navOffset)` —
so the band and every anchor's `scroll-margin-top` read the same token and
cannot disagree. An `IntersectionObserver` callback reports CHANGES, not
states, so the effect keeps the full set of currently intersecting ids in a
plain `Set` and mutates it from the callback; `pickActiveSection` then decides
from that set, the previous pick, and `isAtPageBottom`. Passive `scroll` and
`resize` listeners, throttled to one `requestAnimationFrame`, cover the
bottom-of-page rule, which no intersection can announce. Teardown disconnects
the observer, cancels the pending frame and removes both listeners.

The effect **reads no reactive value**, only writes `activeId`. Reading it
would make the effect depend on the value it writes and re-arm the observer on
every scroll — the failure the comment in the file warns about.

**Nothing reacts to a click** (D-04). The links are native anchors, so the
browser does the scrolling and the hash appears and disappears on its own.
There is no `aria-label` anywhere, no `hashchange` listener, and nothing
restored from the URL on load.

**Muted links carry their reason in the accessible name** (D-03), as visible
text styled at weight 400 and a lighter tint, with the reason present in the
DOM for a screen reader. Unmuted links are weight 600 and carry no suffix.
The current-link styling hangs off `a[aria-current='location']` itself rather
than off a class, so the style cannot drift from the state the spy maintains;
current wins over muted for weight and underline, so a muted current link
reads "lighter text, blue underline, weight 600".

`src/app.css` gains `html { scroll-behavior: smooth }` inside
`@media (prefers-reduced-motion: no-preference)`, so anchor jumps glide and
`reduce` keeps the UA default of `auto`.

**`tests/e2e/scroll-nav.spec.ts`** (13 tests) drives the page and reads the
result, never the other way round: it scrolls and clicks, and asserts
`aria-current`. The band-mirror test mirrors the RULE rather than restating
it — for each of the five sections it scrolls that section into view and
accepts either "this section" or "the page is at its bottom and the last link
is current", which is the only honest assertion at Phase 3 content heights
(RESEARCH Q5 finding 5). Exactly one link is current in every state, checked
after each of the five scrolls and at both extremes.

## Files changed

| File | Change |
|------|--------|
| `src/lib/components/DashboardNav.svelte` | new — the sticky nav, the scroll-spy effect, the status suffixes |
| `src/lib/components/Dashboard.svelte` | renders `<DashboardNav {result} />` between the identity header and the sections wrapper |
| `src/app.css` | `html { scroll-behavior: smooth }` under `prefers-reduced-motion: no-preference` |
| `tests/e2e/scroll-nav.spec.ts` | new — 13 tests: tracer, sticky, band mirror, muted names, anchors, motion, phone, long text |

`package.json` and `pnpm-lock.yaml` untouched (T-03-SC). `--nav-offset` was
already in `src/app.css` from 03-04 and was not re-added.

## Tests

**Task 1 — the tracer.** One test walks the spy top → bottom → top at a
1280x400 viewport under reduced motion, asserting the first link is current
on load, the last is current at the bottom, the first is current again, and
exactly one link is current at every step.

**Task 2 — depth (12 tests).** `(sticky)` scrolls past the nav's own natural
position and asserts its box is within a pixel of 0. `(band-mirror)` covers
the two extremes and then all five sections. Four `(muted-names)` tests
assert the exact strings for the skeleton, an absent category, a zero-row
category and an export with no unsupported folders, plus the 400-vs-600
weight pair. `(anchors)` asserts the hrefs, that clicking Payment_history
sets `#payment-history`, and that the section lands within 2px of
`--nav-offset`. `(reduced-motion)` asserts `smooth` under `no-preference`
and `auto` under `reduce`. `(phone-375)` asserts no page-level horizontal
scroll, that focusing the last link scrolls it fully into the nav's visible
box, and that the nav's height does not change between 375 and 1280. Two
`(long-text)` tests at 375 and 720 assert no overflow and that the nickname
and an unsupported banner stay inside the viewport.

Every expected string is composed from `NAV_ORDER`, `SECTION_TITLES` and
`NAV_STATUS_SUFFIX` imported from `src/`, so the spec cannot drift from the
copy contract.

### RED → GREEN evidence

| Commit | State |
|--------|-------|
| `4a302a4` | RED — 1 discovered, 1 failed: `getByTestId('nav-link-activity-history')` resolved to 0 elements because `dashboard-nav` did not exist. A real assertion failure on the target test, confirmed `RED_EVIDENCE_OK` by `gsd-tools check tdd-red-evidence` |
| `2e1c57a` | GREEN — 3 passed (tracer + zero-network), lint/check/build clean, 325 unit |
| `cf90a13` | RED then GREEN — first run of the extended spec: 8 passed, 2 failed on `(sticky)` and `(muted-names)`; both defects fixed in the same commit, then 13 passed |

The Task 2 RED and GREEN are one commit. See Deviations.

## Verification

| Command | Result |
|---------|--------|
| `pnpm run lint` | exit 0 — prettier clean, eslint clean |
| `pnpm run check` | exit 0 — svelte-check 0 errors / 0 warnings on both tsconfigs |
| `pnpm run test:unit` | 325 passed across 14 files |
| `pnpm exec vitest run` | 325 passed (Task 2 acceptance criterion) |
| `pnpm run build` | built, no warnings |
| `pnpm exec playwright test tests/e2e/scroll-nav.spec.ts` | 13 passed, 0 failed |
| `pnpm exec playwright test scroll-nav dashboard zero-network identity-privacy` | 39 passed, 0 failed |
| `pnpm exec playwright test` (full) | 44 passed, 20 failed — see below |
| `grep -c "IntersectionObserver" src/lib/components/DashboardNav.svelte` | `1` |
| `grep -c '^<nav' src/lib/components/DashboardNav.svelte` | `1` |
| `grep -nE "transition\|@keyframes\|animation" src/lib/components/DashboardNav.svelte` | no match (D-29) |
| `git diff --quiet 9558a26 -- package.json pnpm-lock.yaml` | exit 0 |

The full gate was run after each task, not the per-task subset.

The **full** Playwright suite is `44 passed, 20 failed`. The pre-existing
baseline was 31/20; the 13 new tests account for the difference exactly, and
all 20 failures remain in the three legacy specs — `import-failure` (6),
`import-flow` (7), `persistent-dataset` (7) — each asserting retired markup
(`results`, `account-heading`, `summary-line`, `category-badge`, level-2
heading counts). Plan 03-07 owns that migration. No new failure appeared.

## Deviations

- **The suffix is hidden in flow, not with the clip pattern.** UI-SPEC and
  the Task 1 action both call for the 1px `position: absolute` clip pattern
  that `Dropzone.svelte` uses, and for the accessible name to read exactly
  `Payment_history, not in this export`. Those two cannot both hold in
  Chromium: computing a name from content, it inserts a separator before an
  OUT-OF-FLOW descendant, so any absolutely positioned (or inline-block)
  suffix announces `Payment_history , not in this export`. Verified in one
  page against absolute, inline-block, in-flow inline and `font-size: 0`
  spans. The suffix is now `display: inline; position: static; font-size: 0;
  line-height: 0` — still zero advance width, so the row's layout is
  unchanged at every viewport (the phone-width test measures that) and the
  name concatenates exactly. The task's own remediation clause lists
  "whitespace inside the accessible name" as a defect to fix in the
  component, so the component was fixed rather than the test relaxed. The
  stylesheet comment records why, so the class is not tidied back into the
  clip pattern. Residual risk: a user stylesheet that forces a minimum font
  size could make the suffix faintly visible; the Firefox/Safari human checks
  should look at it.
- **The spy names the first section at `scrollY 0` itself.** UI-SPEC says an
  empty band keeps the previous pick, and `pickActiveSection` implements
  exactly that. But the identity header plus the nav are taller than the
  band, so at the top of the document no section intersects it and the
  previous pick is kept — scrolling back up from the bottom left the LAST
  link marked while the reader was looking at the header. The Task 1
  behaviour block and the Task 2 band-mirror test both require "top gives
  the first link" twice, so `recompute` short-circuits at `scrollY <= 0`
  before delegating. `pickActiveSection` itself is untouched.
- **`aria-current` is the styling hook, not a class.** The plan prescribes a
  `muted` class and says nothing about how "current" is expressed. A
  `current` class would be a second piece of state the spy and the stylesheet
  could disagree about; the attribute is the state. The muted class is kept
  because it is prescribed.
- **The muted-names coverage is four tests, not one.** The plan describes one
  test walking four exports. A second import into a live page restores the
  cached dataset first and then raises the replace-confirmation (D-13), so a
  chain of imports tests that flow rather than the nav. One test per export
  gives each a clean browser context. Every required exact string is still
  asserted.
- **Task 2's RED and GREEN share one commit** (`cf90a13`). The RED run was
  observed and both failures were real assertion failures on the two target
  tests, but the fixes were made in the same working tree before the
  intermediate state was committed, so there is no separate RED commit to
  point at. Recorded rather than reconstructed.
- **One eslint suppression.** `svelte/prefer-svelte-reactivity` errors on
  the `Set` of intersecting ids. It is a closure local of the effect, not
  reactive state, and making it a `SvelteSet` would add a dependency nothing
  reads; the line carries a disable with that reason.

## Notes for the next plans

- `DashboardNav.svelte` is now on the page in every non-loading state, so
  `identity-privacy.spec.ts` (03-04) and the dashboard specs all run against
  a page that has the nav. Its five link labels come from `SECTION_TITLES`
  and `NAV_STATUS_SUFFIX` only — no account data reaches them (T-03-21).
- The nav's own test id is `dashboard-nav` and its links are
  `nav-link-{id}`. 03-07 will meet these when it re-points the three legacy
  specs.
- The current-link CSS is selected by `a[aria-current='location']`. Svelte
  does not prune it (verified in the built CSS), but a future refactor that
  moves `aria-current` behind a helper should re-check that.
- Phases 4 to 6 add content into these five anchors. Content height changes
  the band outcomes, which is exactly what the band-mirror test is written
  to tolerate.
- The two Firefox/Safari human checks in the plan are still open: the
  cross-engine band (RESEARCH assumption A1, where the rootMargin percentage
  axis may be width rather than height) and the 375px clipping of the 3px
  underline and focus ring under always-visible scrollbars.

## Plan file

`03-05-PLAN.md` — 2 tasks, both complete.
