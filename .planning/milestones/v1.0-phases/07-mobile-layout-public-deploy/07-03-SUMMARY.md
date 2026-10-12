---
phase: 07-mobile-layout-public-deploy
plan: 03
subsystem: ui
tags: [svelte, touch, aria-live, playwright, mobile, tooltip]

requires:
  - phase: 04-activity-charts
    provides: the one shared ChartTooltip, the 168-cell HourGrid, the `data-tooltip-surface` seam and the Phase 4 chart source-contract suite
  - phase: 03-dashboard
    provides: the page's live-region budget and the Dashboard as the composition root every chart sits under
provides:
  - A second Playwright project, `chromium-mobile` (Desktop Chrome at 375x812, isMobile + hasTouch), and the `**/touch-*.spec.ts` routing between it and `chromium`
  - `src/lib/charts/tooltip-pin.ts` — the touch tap decision, the pin bookkeeping and the two announcement strings, as pure functions
  - Document-level CAPTURE-phase touch, pointer and key handling in the shared ChartTooltip: tap pins, another tap moves, tap-again / tap-outside / Escape dismiss loudly, scroll dismisses silently
  - One page-level polite live region in Dashboard (`data-testid="chart-status"`), rendered only with a dataset and reached through Svelte context
  - Five touch specs on the hour grid covering every pin, move and dismissal path
affects: [07-04-touch-other-charts, 07-mobile, dashboard-live-region-budget, ci-budget]

actuals:
  tokens: 14635
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A component decision that no unit test can reach is extracted as a pure function over plain values, and the component only wires it (04-08's Playtime rule, extended to the charts)"
    - "Document-level handlers that must be able to stop a chart's own handler are registered on `svelte:document` with capture-suffixed attributes, so they are attached and detached with the component"

key-files:
  created:
    - src/lib/charts/tooltip-pin.ts
    - tests/unit/charts/tooltip-pin.test.ts
    - tests/e2e/shell/touch-tooltips.spec.ts
  modified:
    - src/lib/charts/ChartTooltip.svelte
    - src/lib/shell/Dashboard.svelte
    - src/lib/features/playtime/HourGrid.svelte
    - playwright.config.ts
    - .github/workflows/ci.yml
    - tests/unit/guards/ci-budget.test.ts
    - tests/unit/playtime/playtime-charts.test.ts
    - tests/e2e/shell/dashboard.spec.ts

key-decisions:
  - "The touch project is Desktop Chrome at 375x812 with isMobile and hasTouch, NOT one of Playwright's phone descriptors: those carry a WebKit default browser, WebKit is not installed in CI, and this project is Chrome-first (D-04)."
  - "The touch-origin flag is cleared by INPUT, never by a state change. One tap is not one request — the press opens the tooltip and the engine's focus handling opens it again against the same focusable cell — so a flag consumed by the first transition made the tooltip un-pin itself inside the gesture that pinned it."
  - "The silent dismissal announces the EMPTY STRING, which is a third outcome distinct from null. A live region that still holds 'Tooltip pinned.' will not announce that text a second time, so a scroll dismissal that said nothing would make every later pin silent."
  - "The announcement region is page-level, not per-block: the three chart owners sit in three sections and a region inside any one of them would break the Playtime block's own contract of exactly one aria-live inside itself."
  - "No CI limit moved. `playwright test --list` counts both projects, so the five touch specs are five new listed tests: L = 239, E = 1243 s, floor 1615.9 s, G = 27 / W = 29 / J = 37 unchanged. 239 is the LAST count 27 min covers."

patterns-established:
  - "A flag that describes the POINTER survives a state change; a flag that describes ONE dismissal is consumed by it. Mixing the two is what produced the un-pinning bug."
  - "The `touch-` filename prefix is the whole routing contract: `testMatch` on the touch project and `testIgnore` on the desktop one, so every spec still runs exactly once and a misfiled touch spec cannot pass on a mouse-capable browser."

requirements-completed: [PLATFORM-01]

coverage:
  - id: D1
    description: "A second Playwright project, chromium-mobile, exists and only touch-*.spec.ts runs on it; every other spec still runs once on chromium."
    requirement: PLATFORM-01
    verification:
      - kind: integration
        ref: "pnpm exec playwright test --list --project=chromium-mobile (Total: 5 tests in 1 file) and --project=chromium (grep for touch-tooltips exits 1)"
        status: pass
      - kind: other
        ref: "grep -n \"devices\\['iPhone\" playwright.config.ts prints nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "A touch tap on an hour-grid cell opens the shared tooltip and it is still open after the finger lifts, with no timer."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-tooltips.spec.ts#a tap on an hour cell opens the shared tooltip, and it is still open after the finger lifts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The tap decision and the pin bookkeeping are pure, table-tested functions and ChartTooltip only wires them."
    requirement: PLATFORM-01
    verification:
      - kind: unit
        ref: "tests/unit/charts/tooltip-pin.test.ts (29 cases: 8 tap rows, 7 transition rows, 4 string/key cases, 10 source-contract cases)"
        status: pass
      - kind: other
        ref: "grep -c \"setTimeout\\|setInterval\\|requestAnimationFrame\" src/lib/charts/ChartTooltip.svelte prints 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tapping a second cell moves the pinned tooltip; tap-again, tap-outside and Escape dismiss it with 'Tooltip dismissed.'"
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-tooltips.spec.ts#a second tap MOVES the pinned tooltip, changes its text and its place, and announces nothing new"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/touch-tooltips.spec.ts#tapping the pinned cell again, tapping outside the chart, and Escape each dismiss it loudly"
        status: pass
    human_judgment: false
  - id: D5
    description: "A scroll dismissal is silent, clears the region, and the next pin announces again."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-tooltips.spec.ts#a scroll dismisses it SILENTLY, and clearing the region is what lets the next pin speak"
        status: pass
    human_judgment: false
  - id: D6
    description: "The two fixed announcements reach exactly ONE page-level polite live region, rendered only with a dataset; the page-wide aria-live count is 5 after an import and 1 before one."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/dashboard.spec.ts#import region (03-06 Task 1) › (slim-variant) after the import the same element is the slim bar"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/touch-tooltips.spec.ts#a tap announces \"Tooltip pinned.\" in the one page-level live region"
        status: pass
      - kind: unit
        ref: "tests/unit/charts/tooltip-pin.test.ts#the one page-level live region (5 source-contract cases)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Mouse and keyboard behaviour of the hour grid is unchanged: the existing playtime browser specs pass unmodified."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/playtime/playtime-charts.spec.ts + tests/e2e/playtime/playtime.spec.ts — 22 passed, git diff --quiet HEAD -- tests/e2e/playtime"
        status: pass
    human_judgment: false
  - id: D8
    description: "The CI e2e budget is consistent with the listed test count, and the three limits were not moved unnecessarily."
    requirement: PLATFORM-01
    verification:
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts (6 passed at L = 239, E = 1243)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Whether the pinned tooltip is readable and reachable on a real 375px phone — its size against the card, whether the announcement is spoken in practice by a real screen reader, and whether a pin survives a reader switching apps and returning."
    requirement: PLATFORM-01
    verification: []
    human_judgment: true
    rationale: "The touch geometry, the spoken output on a real assistive technology and any multi-session behaviour are all outside what a DOM assertion or a Chromium emulation can prove; plan 07-04 and the phase's own UAT own this."

duration: 62 min
completed: 2026-10-05
status: complete
---

# Phase 07 Plan 03: Touch Tooltip Pinning Summary

**A touch tap on any chart cell opens and pins the one shared tooltip, a second tap moves it, tap-again / tap-outside / Escape dismiss it with a spoken "Tooltip dismissed.", a scroll dismisses it silently, and all of it reaches a single page-level live region — with a Chrome touch Playwright project that only touch specs may use**

## Performance

- **Duration:** 62 min
- **Started:** 2026-10-05T18:45:00Z
- **Completed:** 2026-10-05T19:47:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- **A second Playwright project, `chromium-mobile`** — Desktop Chrome at 375x812 with `isMobile` and `hasTouch`, deliberately NOT one of Playwright's phone descriptors (those carry a WebKit default browser, WebKit is not installed in CI, and this project is Chrome-first). `**/touch-*.spec.ts` runs only there through `testMatch`, and `chromium` ignores it, so every spec in the repository still runs exactly once and a misfiled touch spec cannot quietly pass on a mouse-capable browser.
- **The tap opens the tooltip on PRESS, not on over** — the hour grid's `onPointerOver` and `onPointerOut` return immediately for a touch pointer, because a tap fires over, down, up and out in that order and the `out` half was closing what the `over` half had opened. The press handler became a named function (an inline arrow had no way to read `pointerType`) and resolves the cell itself, so a tap opens the tooltip whether or not the engine moves focus.
- **The tap decision and the pin bookkeeping are pure** in `src/lib/charts/tooltip-pin.ts`, with 29 unit cases covering all eight rows of `touchTapAction` and all seven rows of `pinOutcome`, plus source-contract tests for the wiring no pure test can see.
- **Four dismissals, two of them loud and one deliberately not** — tap-again, tap-outside and Escape announce `Tooltip dismissed.`; a scroll announces nothing but still CLEARS the region, which is the half that lets the next pin speak.
- **One page-level live region** in `Dashboard`, rendered only with a dataset and reached by context, so none of the three chart owners needed a new prop and the Playtime block keeps exactly one `aria-live` of its own.
- **Five touch specs** on a real 375x812 Chrome touch project, and **no CI limit moved** — 239 listed tests projects 1243 s against the same 27 min, which is the last count 27 min covers.

**Plan verification, all run at the end of the plan:** `pnpm run test:unit` 2426 passed across 79 files; `pnpm exec playwright test` (BOTH projects) **239 passed in 1.5 min**, well inside the 27 min `globalTimeout`; `pnpm run check` 0 errors / 0 warnings; `pnpm run lint` clean; `git diff --quiet HEAD -- package.json pnpm-lock.yaml src/lib/ui-copy.ts` exits 0 and `grep -rn "bits-ui" src/` prints nothing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — a touch tap opens the shared tooltip and it stays open** - `5039c63` (feat)
2. **Task 2 RED: failing tests for the touch pin decisions and announcements** - `68a6090` (test)
3. **Task 2 GREEN: pin, four dismissals, and the two announcements through one page-level live region** - `8bba995` (feat)
4. **Task 3: every pin, move and dismissal path, plus the CI budget bookkeeping** - `1bdf2f0` (test)

**Plan metadata:** this commit (docs: complete plan)

_Note: Task 2 is a TDD task and produced the two commits TDD requires — RED, then GREEN._

## Files Created/Modified

- `src/lib/charts/tooltip-pin.ts` - **NEW.** `TOOLTIP_PINNED_ANNOUNCEMENT`, `TOOLTIP_DISMISSED_ANNOUNCEMENT`, `CHART_ANNOUNCE_KEY`, `ChartAnnounce`, `touchTapAction`, `pinOutcome`. No Svelte, no DOM, no runes.
- `tests/unit/charts/tooltip-pin.test.ts` - **NEW.** 29 cases: the decision tables row by row, the two strings exactly, and the wiring contracts for both components.
- `tests/e2e/shell/touch-tooltips.spec.ts` - **NEW.** Five touch specs on the hour grid: open-and-stay, pin announcement, move, the three loud dismissals, the silent scroll.
- `src/lib/charts/ChartTooltip.svelte` - the context read, three plain bookkeeping flags, the three document capture listeners, the silent flag in `dismissIfStale`, and the one effect that decides the pin and the announcement. Placement, `aria-hidden`, `pointer-events: none` and the stylesheet are untouched.
- `src/lib/shell/Dashboard.svelte` - the announcement rune, `setContext`, the `chart-status` region and its clip-pattern stylesheet.
- `src/lib/features/playtime/HourGrid.svelte` - the two touch guards, the named `onPointerDown`, and `data-tooltip-surface` on the scroller.
- `playwright.config.ts` - the second project, the routing comment, and this plan's budget line.
- `.github/workflows/ci.yml` - comment only; no limit moved.
- `tests/unit/guards/ci-budget.test.ts` - this plan's arithmetic in the header and one new pinned projection.
- `tests/unit/playtime/playtime-charts.test.ts` - the pointer-down assertion now reads the named handler through the file's own `handler()` helper.
- `tests/e2e/shell/dashboard.spec.ts` - the page-wide count is 5, with a `chart-status` assertion and a rewritten comment.

## Decisions Made

1. **Desktop Chrome at 375x812, not a Playwright phone descriptor.** The plan fixed this (D-04) and the reason survived contact with the code: a device descriptor sets `defaultBrowserType: 'webkit'`, and a Chromium project with a WebKit default does not do what the name says. `grep -n "devices\['iPhone" playwright.config.ts` prints nothing.

2. **The touch-origin flag is cleared by INPUT, never by a state change.** This is the one real bug the plan's tests found, and it is worth stating as a decision rather than a fix. One tap is not one request: the press opens the tooltip, and because every cell is focusable the engine's own focus handling opens it AGAIN against the same cell a moment later. The first implementation consumed the flag on the first of those two transitions, so the second read as a mouse open and the tooltip un-pinned itself inside the gesture that pinned it — tap-again did nothing, and the silent scroll dismissal left the region holding its old text instead of clearing it. The flag now describes the POINTER, and the second open is correctly read as the move it is: it announces nothing and leaves the pin standing.

3. **The silent dismissal announces `''`, which is a third outcome and not a weaker `null`.** A live region that still reads "Tooltip pinned." after the tooltip is gone will not announce that same text a second time. Announcing nothing at all on a scroll would therefore make every later pin silent, which is the one failure a live region cannot recover from on its own.

4. **The announcement region is page-level, outside every block.** The three chart owners sit in three different sections, and a region inside any one of them would be a region that only exists when that block's data is on screen — and would break the Playtime block's own contract of exactly one `aria-live` inside itself, which `tests/e2e/playtime/playtime.spec.ts` asserts unmodified.

5. **The tap-outside test asserts its target is in the viewport before tapping.** A tap Playwright had to scroll for would first dismiss the tooltip as a silent scroll dismissal, so the test would be asserting a dismissal that would also pass if the tap-outside rule were broken entirely. The assertion turns a silently-different test into a failing one.

6. **No CI limit moved, and that is recorded as a number rather than a silence.** L = 239 tests in 23 files (both projects counted), E = 1243 s, floor 1615.9 s, so G = 27, W = 29 and J = 37 stay where 06-14 left them. 239 is the LAST count 27 min covers: 240 projects a 1622.4 s floor against a 1620 s `globalTimeout`. All three comment blocks now say so, and the guard pins `projectedE2eSeconds(239) === 1243`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The pin un-pinned itself inside the gesture that set it**
- **Found during:** Task 3 (the loud-dismissal and silent-scroll specs)
- **Issue:** The effect over `request` reset the touch-origin flag on every run. A tap is two transitions, not one — the press opens the tooltip and the engine's focus handling opens it again against the same focusable cell — so the second transition read as a MOUSE open and set `pinned` back to false. Tap-again then did nothing, and the silent scroll dismissal never cleared the region.
- **Fix:** The flag is cleared by input (a non-touch `pointerover`, any `keydown`) and never by a state change; only the one-shot `silentDismiss` flag is consumed by the effect. Both comments at the flag and at the effect say why, and the move test now covers the case the bug lived in.
- **Files modified:** `src/lib/charts/ChartTooltip.svelte`, `tests/e2e/shell/touch-tooltips.spec.ts`
- **Verification:** all five touch specs pass; the two that failed before the fix (tap-again, silent scroll) are the two that prove it.
- **Committed in:** `1bdf2f0` (Task 3 commit)

**2. [Rule 1 - Bug] A live region declared for the "first visit" count did not match where the region renders**
- **Found during:** Task 2 (the `chart-status` source-contract test)
- **Issue:** None — recorded here because it is the sort of thing a reader of the plan would assume was checked. The Playtime block's own `[aria-live]` count of 1 lives in `tests/e2e/playtime/playtime.spec.ts` and was deliberately left unmodified; the plan makes that Task 3's regression check, and it passed there.
- **Fix:** None needed.
- **Files modified:** none
- **Verification:** `tests/e2e/playtime/playtime.spec.ts` passes unmodified in Task 3's verify.
- **Committed in:** n/a

---

**Total deviations:** 1 auto-fixed (1 bug, found by the plan's own tests)
**Impact on plan:** The single fix is in the pin bookkeeping the plan specified; it changes no decision, no contract and no test expectation — it makes the implemented behaviour match the behaviour list the plan's Task 2 already pinned in a unit test. No scope creep.

## Issues Encountered

- **The RED run is a load-level RED, and this repository's TDD tooling cannot classify it.** `tests/unit/charts/tooltip-pin.test.ts` imports the module that does not exist yet, so the file fails at import and vitest reports `Tests  no tests` rather than 29 named failures. The plan's Task 2 step 1 prescribes exactly this shape and its acceptance criterion names it, so it was followed. STATE.md already records (04-01) that `gsd-tools check tdd-red-evidence` returns `INVALID_RED` for every vitest RED in this repository, so the git-log subject is the machine check that works here; the failing evidence is in the `test(07-03)` commit body.
- **The scroll-dismissal test needed a scroll back to the top before its second tap.** The first tap leaves the page scrolled to wherever Playwright put the cell, and a 200px further scroll is what moves the cell enough to make it stale. The test scrolls back with `window.scrollTo(0, 0)` before re-pinning, which is a second scroll but NOT a second dismissal under test: the tooltip is already closed and `pinned` is already false, so the second scroll produces no announcement at all. The assertion that matters — the region reads `''` and then `Tooltip pinned.` again — is unchanged by it.
- **Three `ChartTooltip` instances are mounted at once on a loaded dashboard** (the hour grid, the financial charts, the map), so three sets of document listeners are live. This is harmless by construction rather than by accident: an instance whose `request` is null answers `'ignore'` to every tap and announces nothing, which is exactly the first row of the `touchTapAction` table. Noted because it is not obvious from the markup, and the plan's own account of the wiring does not mention it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 07-04 can extend the same mechanism to the calendar, the bar charts and the map with no new decision.** `touchTapAction` and `pinOutcome` are general over any anchor; what 07-04 adds is `data-tooltip-surface` on three more roots and the same five assertions. The two Chrome-only ownership details to carry over: the move test must read the tooltip's CSSOM `left`/`top` and not its text alone, and the tap-outside target must be asserted in the viewport first.
- **The e2e budget is at its ceiling.** 239 listed tests is the last count 27 min covers. Plan 07-04's own specs will cross 240 and MUST raise all three limits together using the rule in `tests/unit/guards/ci-budget.test.ts`, and the guard will fail until they do.
- **`bitmap`-free, no new dependency, `ui-copy.ts` untouched** — `git diff --quiet HEAD -- package.json pnpm-lock.yaml src/lib/ui-copy.ts` exits 0, and `grep -rn "bits-ui" src/` prints nothing.
- **Untested by automation:** whether a pinned tooltip is readable and reachable on a real 375px phone, and whether a real screen reader speaks both announcements. That is human UAT, and it is the reason D9 is classified `human_judgment: true`.

---
*Phase: 07-mobile-layout-public-deploy*
*Completed: 2026-10-05*
