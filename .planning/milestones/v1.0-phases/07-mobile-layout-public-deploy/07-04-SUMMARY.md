---
phase: 07-mobile-layout-public-deploy
plan: 04
subsystem: ui
tags: [svelte, touch, svg, tooltip, playwright, ci-budget, map]

requires:
  - phase: 07-mobile-layout-public-deploy
    provides: "plan 07-03's touch mechanism — the pure `touchTapAction`/`pinOutcome` decisions, the document-capture touch handling in `ChartTooltip`, the `chromium-mobile` project and the `data-tooltip-surface` seam"
provides:
  - "Touch pin, move and dismissal on the two Financial bar charts, the year calendar and the world map — all four chart surfaces now share one touch behaviour"
  - "A named `onPointerDown(event: PointerEvent)` in `MonthlyBarChart.svelte` and `WorldMap.svelte`, replacing the bar chart's inline arrow"
  - "`data-tooltip-surface` on the bar chart's scroller, the calendar's root div and the map's svg"
  - "Three more touch specs on the shared tooltip file (bars, calendar, map), bringing the touch project to eight"
  - "The CI e2e budget raised one step: L = 242, E = 1258 s, floor 1635.4 s, G = 28 / W = 30 / J = 38"
affects: [07-05-mobile-uat, ci-budget, dashboard-live-region-budget, map-tooltip, finance-tooltip]

actuals:
  tokens: 21000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A touch surface is declared by ONE attribute on the chart's whole addressable box, and the shared tooltip reads it from the ANCHOR — so a chart gets the behaviour without owning any of it"
    - "Where a chart's readable position is a pointer rather than a cell (the map), the request is anchored at the pointer AND the anchor ELEMENT is the mark the finger landed on: the first is where the tooltip is drawn, the second is everything the staleness, surface and toggle decisions need"

key-files:
  created: []
  modified:
    - src/lib/charts/MonthlyBarChart.svelte
    - src/lib/features/playtime/CalendarHeatmap.svelte
    - src/lib/features/logins/WorldMap.svelte
    - tests/e2e/shell/touch-tooltips.spec.ts
    - playwright.config.ts
    - .github/workflows/ci.yml
    - tests/unit/guards/ci-budget.test.ts

key-decisions:
  - "The bar charts' cross-chart move is a DISMISS FOLLOWED BY A RE-PIN inside one tap, and the test asserts the END state. A tap in the second chart is outside the surface the tooltip is anchored to, so the document handler dismisses it and the chart's own press then pins it there — both announcements fire, in that order, and `toHaveText` retries onto the state the tap produced rather than onto the one it passed through."
  - "The map's touch anchor is the tapped country's OWN element, not the anchor circle the keyboard path uses. The keyboard opens at a centroid because a keyboard user is not pointing at anything; a finger is, so the request is measured at the finger, and the element is kept only so the shared tooltip's surface lookup, staleness check and toggle-off all have a real element to work from."
  - "`tipAnchor` is set AFTER `showAtPointer`, because that function nulls it. The order is the whole subtlety and a reader of the two lines cannot see it."

patterns-established:
  - "A swipe is a DIFFERENT input from a tap on the same widget: the map guards over, move AND out for a touch pointer, because a finger dragging across it emits touch moves that would otherwise re-open a tooltip at every country the drag crossed."
  - "A test that taps a point on a SHAPE finds the point with `document.elementFromPoint` rather than using the bounding box's centre — a shape is not its box, and a fixed point in a concave country's box misses."

requirements-completed: [PLATFORM-01]

coverage:
  - id: D1
    description: "A tap on a Premium or Virtual currency bar pins the Financial card's one shared tooltip, and a tap in the other chart moves that same element there."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-tooltips.spec.ts#a tap pins the Financial card’s ONE shared tooltip, a tap in the other chart MOVES it, and a tap outside dismisses it"
        status: pass
      - kind: e2e
        ref: "tests/e2e/finance/finance.spec.ts — 32 passed, git diff --quiet HEAD -- tests/e2e/finance"
        status: pass
    human_judgment: false
  - id: D2
    description: "The year calendar pins on a tap, moves to the next day, and dismisses on a tap outside and on Escape, through the same page-level live region."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-tooltips.spec.ts#a tap pins the calendar’s tooltip, a tap on the next day MOVES it, and a tap outside and Escape each dismiss it"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime/playtime-charts.test.ts — 386 passed, git diff --quiet HEAD -- tests/unit/playtime"
        status: pass
    human_judgment: false
  - id: D3
    description: "The map pins at the finger, moves to another country, toggles off on a second tap on the same one, and dismisses on a tap outside and on Escape — with no zoom, pinch or minimum width added."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-tooltips.spec.ts#a tap pins the map’s tooltip at the finger, a tap elsewhere MOVES it, and tap-again, a tap outside and Escape dismiss it"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts — 7 passed, git diff --quiet HEAD -- tests/e2e/logins"
        status: pass
      - kind: unit
        ref: "tests/unit/logins (289) and tests/unit/guards (219) — the no-motion scan and the ramp/source contracts on WorldMap.svelte"
        status: pass
      - kind: other
        ref: "the plan's own diff criterion: no added line in WorldMap.svelte contains zoom, pinch, wheel or min-width"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mouse and keyboard behaviour of all three charts is unchanged: the existing finance, playtime-charts and login-map browser specs pass unmodified, and the hover ring, focus ring and arrow-key model are untouched."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "pnpm exec playwright test — 242 passed (both projects), with tests/e2e/finance, tests/e2e/playtime and tests/e2e/logins unmodified"
        status: pass
      - kind: unit
        ref: "tests/unit/charts (bar-chart-components.test.ts prohibitions) and tests/unit/playtime (the calendar handler() extraction) — git diff --quiet HEAD -- tests/unit/playtime tests/e2e/playtime"
        status: pass
    human_judgment: false
  - id: D5
    description: "The touch specs run on the chromium-mobile project only, and the CI e2e limits match the new listed count — 28/30/38 minutes with the guard pinned to the new projection."
    requirement: PLATFORM-01
    verification:
      - kind: other
        ref: "pnpm exec playwright test --list: Total: 242 tests in 23 files; --project=chromium-mobile lists 8 (5 from 07-03, 3 from this plan)"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts — 6 passed, including projectedE2eSeconds(242) === 1258"
        status: pass
    human_judgment: false
  - id: D6
    description: "Whether the four charts' pinned tooltips are readable and reachable on a real 375px phone — the map's tap targets especially, since a country can be two pixels across — and whether a real screen reader speaks both announcements."
    requirement: PLATFORM-01
    verification: []
    human_judgment: true
    rationale: "The touch geometry against a real thumb, the spoken output on a real assistive technology, and the map's hit circles on a real device are all outside what a DOM assertion or Chromium emulation can prove. The phase's own UAT owns this, and 07-03 recorded the same gap."

duration: 21 min
completed: 2026-10-05
status: complete
---

# Phase 07 Plan 04: Touch On The Other Three Charts Summary

**All four chart surfaces now pin the shared tooltip on a touch tap — including the two Financial bar charts that share one owner and the map, which anchors at the finger — and the CI e2e budget moved one step for the three new specs**

## Performance

- **Duration:** 21 min
- **Started:** 2026-10-05T20:05:00Z
- **Completed:** 2026-10-05T20:26:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- **The two bar charts pin, move ACROSS charts, and dismiss** — the Financial card's one `finance-tooltip` is the element both charts write to, so a tap in Premium and a tap in Currency land on the same element rather than opening two.
- **The year calendar joins the hour grid** on the Playtime charts' tooltip, with the same three moves and the same two announcements, and with its `onPointerDown` still saying nothing about `hoverDay` (the Phase 4 source-contract test reads that handler by name and keeps the assertion meaningful).
- **The world map pins at the finger, moves between countries, and toggles off on a second tap on the same country** — the touch anchor is the country's own element, which is what gives the shared mechanism a surface, a staleness reference and a toggle target on a chart whose marks are shapes.
- **No zoom, no pan, no per-country listener** (D-02): the map still draws one svg with six delegated handlers.
- **The CI e2e budget moved one step, all three limits together** — L = 242 tests in 23 files, E = 1258 s, floor 1635.4 s, so `globalTimeout` 27 → 28 min, the wrapper 29 → 30 and the job 37 → 38, with the arithmetic written into the three files that hold it and pinned by `projectedE2eSeconds(242) === 1258`.

**Plan verification, all run at the end of the plan:** `pnpm run test:unit` **2483 passed across 80 files**; `pnpm exec playwright test` (BOTH projects) **242 passed in 4.5 min**, inside the new 28 min `globalTimeout`; `pnpm run check` 0 errors / 0 warnings over 300 files; `pnpm run lint` clean; and `git diff --quiet HEAD -- package.json pnpm-lock.yaml src/lib/ui-copy.ts src/lib/charts/ChartTooltip.svelte src/lib/charts/tooltip-pin.ts src/lib/shell/Dashboard.svelte` exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — tapping a bar pins the Financial card's shared tooltip and a tap in the other chart moves it** - `db3a6a6` (feat)
2. **Task 2: the year calendar joins the touch mechanism** - `9fc5429` (feat)
3. **Task 3: the world map joins it, and the CI budget is raised** - `32677bb` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `src/lib/charts/MonthlyBarChart.svelte` - the two touch guards, the named `onPointerDown` replacing the inline arrow, `data-tooltip-surface` on the scroller. The key handler, the focus handlers, the rings and the cell markup are untouched.
- `src/lib/features/playtime/CalendarHeatmap.svelte` - the two touch guards, the touch branch inside the existing `onPointerDown`, `data-tooltip-surface` on the root.
- `src/lib/features/logins/WorldMap.svelte` - the three touch guards, a named `onPointerDown` that anchors at the finger and then at the country's own element, `data-tooltip-surface` on the svg.
- `tests/e2e/shell/touch-tooltips.spec.ts` - three tests (bars, calendar, map) and the two helpers they needed: a `financeTooltip` scoped under the Financial section and a `tapPointFor` that finds a point `document.elementFromPoint` agrees belongs to a country.
- `playwright.config.ts` - `globalTimeout` 28 min and 07-04's budget comment.
- `.github/workflows/ci.yml` - `timeout-minutes: 38`, `timeout 30m playwright test`, and the comment blocks.
- `tests/unit/guards/ci-budget.test.ts` - 07-04's arithmetic in the header and one new pinned projection.

## Decisions Made

1. **The cross-chart move is a dismiss followed by a re-pin inside one tap, and the test asserts the end state.** A tap in the Currency chart is *outside* the surface the tooltip is currently anchored to (the Premium scroller), so the document capture handler reads it as a tap outside and dismisses — and then the chart's own press handler runs and pins it on the Currency bar. Both announcements fire, in that order, which is why the plan said to assert with an auto-retrying text assertion rather than a snapshot between the two: the intermediate state is real and is not the state the reader ends in.

2. **The map's touch anchor is the tapped country's own element, and it is set after `showAtPointer`.** The keyboard path already had an anchor element — a 1px circle moved to a centroid and measured — and reusing it would have been wrong: a keyboard user is not pointing at anything, so a centroid is right for them, while a finger is pointing at a place and the tooltip belongs there. So the request is anchored at the finger (as the mouse path already did) and the country's own element is what `tipAnchor` holds, because that element is the only thing the shared mechanism can ask questions of: it carries the surface for a tap, it is what a later scroll is compared against, and it is what a second tap is compared against to toggle the pin off. `showAtPointer` sets `tipAnchor = null` at its end, so the assignment has to come after the call — the order is the whole subtlety and neither line says so.

3. **A swipe is a different input from a tap on the same widget, and the map guards three handlers rather than one.** `onPointerMove` exists to follow the pointer inside a large country; under a touch pointer it would re-open the tooltip at every country a drag crossed, and `onPointerOut` at the end of a drag would close what the drag started. Both now return for touch, which is the whole of T-07-16's mitigation and is why the map's guard count is four rather than the three the other charts need.

4. **The map's test finds its tap points with `document.elementFromPoint` rather than using a bounding-box centre.** A country's readable place is its shape: the centre of a box drawn around a concave country is in the sea, and at 375px the whole map is ~190px tall, so a single fixed offset would have been a guess. The test sweeps the box and keeps the first point the browser itself resolves to that country's own path (or to its hit circle, which for a country a few pixels across is the only thing a finger can reach). Nothing in the product changed to make the test easier, and the sweep is capped by a step that coarsens with the box so a large country does not cost a thousand hit tests.

5. **The budget went up exactly one step, and the margin went with it.** 242 tests project 1258 s against a 1.3x floor of 1635.4 s, so 28 min is the smallest whole number that clears it; the wrapper is 30 and the job 38, the same G + 2 and W + 8 relationship as every raise since 05-14. 28 min holds up to 248 listed tests, so the next plan that adds six or more browser tests will have to do this again.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **The two bar charts sit far apart on the page, and the second tap has to scroll.** That is a real scroll dismissal, not a silent one — the tap is deliberate, so it closes the pin loudly and the new pin announces after it. It is why the move assertion is an end-state `toHaveText` and why the first line is captured before the second tap rather than asserted between them. Worth recording because a reader of the test might otherwise read the "still pinned" assertion as evidence that no dismissal happened.
- **The cross-chart tap-outside target is the Currency chart's own `h4`.** It had to be in the viewport before it is tapped (asserted, per 07-03's carry-forward) because a tap Playwright had to scroll for would dismiss silently first and the test would then pass with the tap-outside rule broken entirely. It is in the viewport at 375px without a manual scroll, and the assertion turns a future layout change into a failure rather than a quieter test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The touch mechanism is now complete for all four chart surfaces**, and the three remaining surfaces needed no new decision: three `data-tooltip-surface` attributes, three named or extended press handlers, and the same five assertions. `tooltip-pin.ts` and `ChartTooltip.svelte` were not edited by this plan, and neither was `Dashboard.svelte` or `ui-copy.ts`.
- **The e2e budget has headroom again but is finite**: 28 min covers up to 248 listed tests, and the guard will fail the next plan that crosses it. The raise is mechanical — one number in `playwright.config.ts`, one wrapper, one job timeout, and one pinned projection in the guard.
- **Untouched by this plan, and still to come:** 07-05 (mobile UAT) and 07-06 (the real deploy dispatch). Nothing here depends on either.
- **Untested by automation:** whether the map's country targets are reachable with a real thumb at 375px, and whether a real screen reader speaks both announcements. The DOM assertions cannot answer either, which is why D6 is `human_judgment: true`.

---
*Phase: 07-mobile-layout-public-deploy*
*Completed: 2026-10-05*
