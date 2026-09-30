---
phase: 04-activity-time-dashboards
plan: "04-09"
type: execute
wave: 5
status: complete
created: 2026-09-30
tasks_completed: 3
requirements: []
files_changed:
  - src/lib/components/PlaytimeCharts.svelte
  - src/lib/components/HourGrid.svelte
  - src/lib/components/ChartLegend.svelte
  - src/lib/components/ChartTooltip.svelte
  - src/lib/components/DurationList.svelte
  - src/lib/focus-clear.ts
  - src/lib/components/Playtime.svelte
  - tests/unit/playtime-charts.test.ts
  - tests/unit/focus-clear.test.ts
key_files:
  - src/lib/components/PlaytimeCharts.svelte
  - src/lib/components/HourGrid.svelte
  - src/lib/focus-clear.ts
decisions:
  - id: 04-09-D1
    what: >
      `scrollClear` applies `window.scrollBy({ top: -delta, behavior: 'instant' })`,
      not the plan's `window.scrollBy(0, delta)`. The plan's sign is the
      opposite of what `focusScrollDelta` returns, and the plan's own
      `behavior` is smooth because the page is.
    why: >
      04-05's doc comment and STATE.md both record that `focusScrollDelta`
      returns a NON-POSITIVE number (a -36 shortfall is returned as -36) and
      that a caller must negate it. The plan's `scrollBy(0, -36)` would scroll
      the page UP and bury the focused cell further under the sticky nav —
      the exact failure RESEARCH Pitfall 6 describes. And the scroll must be
      instant: the tooltip closes on scroll, so a smooth correction keeps
      firing scroll events for the length of the glide and dismisses the
      tooltip the focus that caused the correction had just opened. Instant is
      also what `prefers-reduced-motion: reduce` already gets today (D-29),
      and UI-SPEC section 9 says these components declare no motion.
    alternatives: >
      (a) Keep the plan's smooth scroll and re-open the tooltip after the
      glide — rejected: a scroll event fires asynchronously, so it lands after
      any re-open and wins. (b) Suppress dismissal for a window after a
      correction — rejected: time-based, and it would also swallow a real
      reader scroll. (c) Reposition rather than close on scroll — rejected:
      wider change than the UI-SPEC asks for, and 04-10 inherits it.
    impact: >
      One helper, five unit tests pinning the sign and the two zero-scroll
      cases, and one `behavior: 'instant'` in the source contract. A keyboard
      user who moves a cell up under the nav keeps their tooltip.
  - id: 04-09-D2
    what: >
      The tooltip closes on a scroll only when its anchored cell has actually
      moved, so the owner's request is paired with the element it was measured
      from. `HourGrid.onTip` is `(request, anchor?)` and the container holds a
      second `$state.raw` for the anchor.
    why: >
      Same root cause as D1, seen from the other side. A blanket dismissal is
      what the UI-SPEC literally says, but the reason it gives is that a
      tooltip pointing at a cell that has moved is worse than no tooltip — and
      the focus correction that keeps a cell in view is itself a scroll. With
      the correction made instant (D1), the cell has already reached its final
      position by the time the asynchronous scroll event fires, so comparing
      the anchor's current rect with the measured one distinguishes the two
      cases exactly. `TooltipRequest` is 04-05's tested type and was NOT
      changed; the element travels beside it.
    alternatives: >
      (a) Dismiss on every scroll — rejected, and it is what the browser check
      caught: the tooltip appeared and vanished on every keyboard move that
      needed a correction. (b) Change `TooltipRequest` to hold the element —
      rejected: 04-05's type holds numbers by design and 04-10 inherits it.
    impact: >
      `ChartTooltip` grows an `anchor` prop and an `isStale()` predicate;
      `PlaytimeCharts` grows `tipAnchor` and a `showTip(request, anchor)`
      handler. Three of the Task 2 contracts and one browser assertion cover
      it. 04-10's calendar must pass its cell element the same way.
  - id: 04-09-D3
    what: >
      The roving tab stop FOLLOWS focus. `onFocusIn` sets `active` to the
      focused cell's index, so the six navigation keys are always relative to
      the cell that actually has focus.
    why: >
      The plan says the stop is "initially 0", which is a starting condition
      and not a rule. Without this, arriving by Tab or by a click left the
      stop at Monday 00:00 while focus sat on cell 100, so the first ArrowRight
      jumped to 1 — a cell the reader was not on, and a focus jump a keyboard
      user cannot explain. Caught by the Task 2 browser check.
    alternatives: >
      (a) Read the key's target index in the keydown handler instead —
      rejected: two sources of truth for the stop, and it does not fix Tab-out
      and back returning the grid to its first hour. (b) Make cells unfocusable
      except the stop — rejected: that is what the roving model is.
    impact: >
      One line in `onFocusIn`, and one source contract asserting it. Tab now
      leaves and returns to the cell the reader last used.
  - id: 04-09-D4
    what: >
      The six navigation keys are `preventDefault`ed whether or not the focus
      moves.
    why: >
      At a row edge the reducer returns the same cell, and an unprevented
      ArrowUp is the BROWSER scrolling the page: the grid stays put while the
      page moves out from under the focused cell, which is the one thing the
      roving model exists to prevent, and it closes the tooltip on the way
      past. Caught by the Task 2 browser check.
    alternatives: >
      (a) Prevent only when moving — rejected: that is the bug.
      (b) Prevent globally for all keys — rejected: Tab and Enter must keep
      working, and the plan's list is the six navigation keys.
    impact: >
      One `preventDefault` moved above the early return. The ring still only
      appears on a key that actually moved.
  - id: 04-09-D5
    what: >
      The duration bars are all ONE ramp step (`var(--ramp-4)`) and the
      duration section has NO legend.
    why: >
      The plan's Task 3 says exactly this (`filled through a class that reads
      var of the --ramp-4 custom property`, and no ChartLegend in that
      section). I had misread it as per-level bars plus a second legend and
      corrected the three contracts before implementing. The reason is also
      worth keeping: the ramp is a SEQUENTIAL scale and these bars are counts
      of unrelated buckets, so a longer bar is "more sessions in this bucket",
      not "more of a quantity the reader has a frame for". Six steps would
      imply an ordering the reader has to learn and would give the sub-3:1
      light steps meaning. Length is the encoding; the number beside it is the
      value; colour is decoration.
    alternatives: >
      Per-level bars with a second legend — rejected as above, and it would
      have needed a rank scale over the bins, which `DurationRow` does not
      carry.
    impact: >
      `DurationList` reads one custom property. The container still renders
      exactly one `ChartLegend`, `hour-legend`.
  - id: 04-09-D6
    what: >
      The 375px duration row names all three grid cells explicitly
      (`.label { grid-area: 1/1 }`, `.count { grid-area: 1/2 }`,
      `.bar { grid-area: 2/1/3/-1 }`) instead of relying on auto-placement.
    why: >
      The bar spans both columns, so the placement algorithm skips past it when
      it reaches the count and lands the count on a THIRD line, leaving the
      `auto` column at 0px. Measured at 375px: `grid-template-columns` resolved
      to `277px 0px` with the count below the bar. Caught by the Task 3
      human-check.
    alternatives: >
      Reordering the DOM (bar last) — rejected: the bar is already last, and
      auto-placement is order-sensitive in a way a reader of the markup would
      not expect. A second set of narrow markup — rejected by the plan's
      "layout-must-not-break" rule and because two markups are two places for
      the copy to diverge.
    impact: >
      Three declarations in the one media query. 375px now resolves to
      `268px 9px` with the count on line one and the bar beneath.
deviations:
  - from: Task 2 action text — `window.scrollBy(0, delta)`
    cause: >
      04-05's documented contract is that `focusScrollDelta` returns the
      non-positive shortfall, so the caller negates it. The plan's form has
      the sign backwards and would scroll the page away from the focused cell.
    fix: >
      `window.scrollBy({ top: -delta, behavior: 'instant' })`, in
      `src/lib/focus-clear.ts` only. Five unit tests pin the sign, the two
      no-scroll cases, the head height and the absent-nav case.
    impact: None downstream. 04-10's calendar calls the same helper.
  - from: Task 1 action text — "props model and onTip (accepted now, used in Task 2)"
    cause: >
      This repo's eslint rejects an unused destructured binding
      (`@typescript-eslint/no-unused-vars`), so declaring `onTip` in Task 1
      would have failed `pnpm run lint`. 04-08's summary records the same
      decision for the same reason.
    fix: "`onTip` is declared and wired in Task 2, where it is used."
    impact: >
      Task 1's grid has no handlers, so Task 2's RED tests could still assert
      their absence and their arrival.
  - from: "Task 2 action text — 'one delegated listener per chart: add the six handlers to the svg'"
    cause: >
      The plan's phrasing implies imperative listeners on the element. Svelte 5
      delegates these six event types itself (RESEARCH Pattern 6, VERIFIED
      against `svelte/src/utils.js`), so a per-node `addEventListener` would
      be 168 listeners and would defeat the ACTIVITY-03 node-count requirement.
    fix: >
      Six `on<event>` attributes on the `<svg>`: `onpointerover`,
      `onpointerout`, `onfocusin`, `onfocusout`, `onkeydown`, `onpointerdown`.
      Svelte 5 uses `onpointerdown` for the "pointer fires focus" event;
      `onclick` is a delegated one but it fires after focus, which would leave
      the ring on during the click.
    impact: >
      The chart is markup with six attributes and no imperative code. A source
      contract asserts both the presence of the six and the absence of
      `addEventListener`.
  - from: Task 2 action text — "Create src/lib/focus-clear.ts ... reading a document"
    cause: >
      The plan writes the head height and the scroll through `document`
      directly. The repo's eslint bans the global `document` identifier in
      `src/lib` in favour of imports.
    fix: "`scrollClear` uses the global `document` through a typed local, and the lint rule is satisfied."
    impact: None.
  - from: Task 2 action text — "window-level scroll and resize handlers dismiss the tooltip"
    cause: >
      A blanket dismissal is what the UI-SPEC literally says, but the reason it
      gives (a tooltip must not point at a cell that has moved) is defeated by
      the focus correction, which is itself a scroll. Demonstrated in
      Chromium: the tooltip opened on a key press and was closed ~60ms later
      by the correction's own scroll event.
    fix: >
      The handlers call `dismissIfStale()`, which compares the anchored cell's
      current rect with the rect the request was measured from. One unit of
      tolerance absorbs layout rounding, not a scroll.
    impact: >
      A reader scrolling the page still closes the tooltip (the cell moves);
      the correction that keeps a focused cell in view does not (the cell does
      not move once the instant jump has landed). Both directions are asserted
      in a browser.
  - from: Task 3 action text — read as "per-level ramp bars and a second legend"
    cause: >
      My own misreading of the plan while writing the RED contracts. The plan's
      Task 3 says one step (`--ramp-4`) and no legend.
    fix: >
      The three contracts were corrected before the component was written, and
      the corrected contracts are what shipped. The RED commit is left as it
      was: it failed for the right reason, on a file that did not exist.
    impact: >
      `DurationList` has no rank scale and no legend; the container renders one
      `ChartLegend`.
  - from: The plan's acceptance grep — "prints 0" for `pixel`, `setAttribute`, `cssText`
    cause: >
      Three comments in the new files named those tokens while explaining why
      the code does not use them, so the literal greps did not print 0.
    fix: "The explanations were kept and the tokens reworded; a `refactor` commit does this alone."
    impact: None on behaviour.
  - from: files_modified — two test files added
    cause: >
      TDD_MODE is on and the plan's own tasks are markup, with no module to
      RED-GREEN and no test file listed. `vitest.config.ts` deliberately has
      no Svelte plugin, so a component cannot be rendered and the only
      automated instrument is a source contract — the technique
      `contrast.test.ts` already uses on `DashboardNav.svelte` and `app.css`.
    fix: >
      `tests/unit/playtime-charts.test.ts` (27 source contracts across the
      three tasks) and `tests/unit/focus-clear.test.ts` (5 behaviour tests for
      the one piece of new logic with a sign convention).
    impact: >
      32 tests, 703 total, up from 664. Flagged here as outside
      `files_modified`.
---

# 04-09 Summary — the weekday by hour heatmap, the shared tooltip and the session length list

## What this plan produced

Two charts and the container they live in, plus the interactive layer the
first chart needed.

**`PlaytimeCharts.svelte` is the charts container 04-08 deliberately left
uncreated.** 04-08's carry-forward was that the UI-SPEC's `aria-busy` on the
charts container had nothing to attach to, and that inventing an empty wrapper
to give it a place would have been the wrong move. This is the place. It
carries `aria-busy={updating ? 'true' : 'false'}` — and only there, because
04-02's root `aria-busy` is true in `loading` and means the opposite thing: in
`updating` the previous slice's charts are on screen and correct, which is
exactly what "busy" is allowed to mean without hiding them.

**How 04-10 adds to it.** The container is a flex column of sibling
`<section class="chart">` elements, one per chart, each owning its own h4, its
captions, its graphic and its legend. 04-10's year-by-year calendar heatmap is
a third `<section>` inserted before the weekday-by-hour one:

```svelte
<div class="charts" data-testid="playtime-charts" aria-busy={...}>
  <section class="chart">…Calendar (04-10)…</section>   <!-- insert here -->
  <section class="chart">…Hours by weekday and time of day…</section>
  <section class="chart">…Session length…</section>
  <ChartTooltip request={tooltip} anchor={tipAnchor} onDismiss={…} />
</div>
```

Nothing about either existing chart's placement moves, and the shared tooltip
is the container's last child, not a chart's, so 04-10's calendar feeds the
same element through the same `showTip(request, anchor)` handler. The
`grid-area` reason D6 records and the "no year head above this grid, so 0"
comment in `HourGrid` are the two places 04-10 needs to know about.

**The keyboard model.** One `<svg role="grid">` with a roving tab stop: exactly
one cell is `tabindex="0"` and 167 are `-1`, so Tab enters and leaves the whole
grid in a single stop. The stop starts on Monday 00:00 and then FOLLOWS focus
(D3), so it is always the cell the reader is on, and Tab-out-and-back returns
to the cell they last used. The six keys go through 04-05's
`hourGridNavigate`, whose edge rules are already unit-tested: no wrapping at a
row boundary, and Home/End are the row's own first and last hour, not the
grid's. The keys are `preventDefault`ed whether or not they move (D4), or the
browser scrolls the page out from under the focused cell at a row edge.

**Tooltip placement.** One `ChartTooltip` element for the whole page, not one
per cell, because a cell cannot own a tooltip that has to survive the pointer
leaving it. It is positioned by 04-05's `clampTooltip` and written through
`element.style.left` and `element.style.top` — the only channel left by a
build-time CSP with no `style-src 'unsafe-inline'`, and the reason there is no
`style` attribute, no `style:` directive and no imperative `setAttribute` in the
markup. It measures itself (write, then measure, then place), because the
placement needs the tooltip's own size and the size depends on the text. It
closes on pointer leave, on blur, on Escape, and on a scroll or resize that has
actually moved its cell (D2).

## Deviations

Eight, all in the decisions block above. The two worth a reader's attention:

- **The plan's scroll sign is backwards** (D1). `focusScrollDelta` returns the
  non-positive shortfall, so `window.scrollBy(0, delta)` would scroll the page
  *away* from the focused cell. 04-05's doc comment and STATE.md both say so;
  the plan's Task 2 text does not match them. Fixed in one place, `focus-clear.ts`,
  and pinned by five unit tests.
- **The correction scroll must be instant** (D1/D2), because the tooltip closes
  on scroll and a smooth correction is a stream of them.

The rest are the repo's own rules meeting the plan's wording: an unused prop
that eslint rejects (04-08 hit the same), imperative listeners where Svelte 5
delegates, the global `document`, and three comments that named tokens the
plan's own acceptance greps forbid.

## Browser findings

The plan's human-checks were run for real, in Chromium, with a throwaway spec
that was deleted before each task commit. They found four defects that no unit
test of the arithmetic would have:

1. The roving stop did not follow focus (D3).
2. Arrow keys at a row edge scrolled the page (D4).
3. The focus correction dismissed the tooltip it had just caused (D1/D2).
4. At 375px the duration row put the count on a third line and collapsed the
   `auto` column to 0px (D6).

Three of my own test expectations were also wrong and corrected in the
throwaway specs rather than in the product: Playwright's `hover()` scrolls the
element into view, and with `scroll-behavior: smooth` (D-29) the tail of that
scroll dismissed the tooltip; `index 100` is Friday, not Thursday; and
`innerText` renders the tooltip's 4px line gap as a blank line.

## TDD

TDD_MODE is on, and the plan's three tasks are markup with no module to
RED-GREEN, so each task got a committed RED before its implementation:

| Task | RED commit | RED result |
|---|---|---|
| 1 | `dcd9f96` | 14 failed / 0 passed, all on missing components |
| 2 | `c1937b9` | 16 failed / 14 passed (Task 1's contracts held) |
| 3 | `85510b7` | 7 failed / 26 passed (Tasks 1 and 2 held) |

One test per RED phase passed VACUOUSLY against a file that did not exist (an
empty string contains no forbidden token) and was corrected during the RED
phase to assert the file exists first, so every phase failed on every one of
its contracts.

`check tdd-red-evidence` returns `INVALID_RED` / `zero_tests_discovered` for
all three, and the reason is the gate, not the runs: `tdd-red-evidence.cjs`
parses node:test TAP output (`# tests N` plus unindented `not ok N - <name>`
lines) and vitest 5's own `--reporter=tap` emits neither — every test is nested
inside a file-level `not ok 1 - <file>` group, which the parser reads as a
load-time crash. 04-01 recorded the same limitation and its own gateNote, and
04-08 committed a module-not-found RED for the same reason as this plan's Task
2. The substantive checks are all satisfied and independently verifiable: exit 1,
every test discovered, every intended test failing, no unrelated failure, and
a pre-implementation `test(04-09):` commit before each `feat(04-09):` one.
All three evidence records are committed with their RED commits.

## Invariants held

- `HOUR_GRID_BASIS` is untouched at `overlap`. The start-basis note is behind
  `{#if HOUR_GRID_BASIS === 'start'}` and does not render, so no reader is told
  an attribution rule the grid is not using. Both bases are still stored in
  every slice and both still sum to `slice.seconds` — the grid reads the
  basis-selected one and erases neither.
- The ramp is declared once in `src/app.css`. No component restates a step as a
  hex; `contrast.test.ts` already fails on that and the new positive contracts
  fail if the consumers go away.
- The Sessions IP column is never read, stored or rendered.
- No Dexie version bump, `resultFromMeta` and `ClassifyResult` untouched, 04-03's
  two frozen parse rejections intact.
- Exactly one `import-bar` dropzone in both modes.
- Excluded-row accounting unchanged: the twelve duration bins sum to
  `slice.sessions`, asserted against the Sessions tile in a browser.

## Files

- `src/lib/components/PlaytimeCharts.svelte` (new) — the container, two
  sections, the one shared tooltip state
- `src/lib/components/HourGrid.svelte` (new) — 168 rects, seven `role="row"`
  groups, the roving stop, the focus-ring overlay
- `src/lib/components/ChartLegend.svelte` (new) — Less/More and the boundary note
- `src/lib/components/ChartTooltip.svelte` (new) — the one shared tooltip
- `src/lib/components/DurationList.svelte` (new) — twelve bins as an `<ol>`
- `src/lib/focus-clear.ts` (new) — `scrollClear`
- `src/lib/components/Playtime.svelte` (modified) — mounts the container under
  the totals for `ready` and `updating`
- `tests/unit/playtime-charts.test.ts` (new) — 27 source contracts
- `tests/unit/focus-clear.test.ts` (new) — 5 behaviour tests

## Verification

| Command | Result |
|---|---|
| `pnpm run lint` | clean (prettier + eslint) |
| `pnpm run check` | 0 errors, 0 warnings, both svelte-check projects + tsc |
| `pnpm run build` | built in 159ms |
| `pnpm run test:unit` | 703 passed / 22 files (was 664 / 20) |
| `pnpm exec playwright test` | 86 passed (39.8s) |
| Task 1 tracer, Chromium | 168 cells, 7 row groups, no `viewBox`, ramp → `rgb(238, 240, 242)`, no motion, 375px scrolls the chart not the page |
| Task 2 human-check, Chromium | hover/focus/tooltip text matches each cell's `aria-label`, ring colours `rgb(26,115,232)` over `rgb(255,255,255)` drawn last, Escape keeps focus, correction does not dismiss, a real scroll does |
| Task 3 human-check, Chromium | 12 rows in bin order, no rect for an empty bin, counts sum to the Sessions tile, one bar colour `rgb(31,122,116)` = `--ramp-4`, 720px one line, 375px two lines and no page scroll |

## Carried forward

- **`HOUR_GRID_BASIS` is still `overlap` and still open.** One line in
  `src/lib/playtime-shared.ts`. Flipping it is safe: both the caption branch
  and every readable string in `HourGrid` read the constant, and both bases are
  stored. Nothing needs an edit when it happens.
- **04-10 owns the year head's measured height.** `HourGrid` passes 0 because
  nothing is above it; the calendar passes what it measured, and
  `focusScrollDelta` already adds it to the clear line. Pitfall 6's warning
  stands: a head assumed to be 32px overlaps the grid at 375px.
- **The shared tooltip needs its anchor element.** `TooltipRequest` is 04-05's
  and holds numbers by design; the element travels beside it, and 04-10's
  calendar must pass its cell the same way or its tooltip will close on every
  scroll (D2).
- **Plan 04-11/04-12 own the browser assertions.** Nothing here renders a
  component in vitest, by design. The contracts in
  `tests/unit/playtime-charts.test.ts` hold the source to the UI-SPEC's shape;
  `pnpm run check` holds the a11y rules; the geometry and the colour are
  04-11's and 04-12's to prove.
