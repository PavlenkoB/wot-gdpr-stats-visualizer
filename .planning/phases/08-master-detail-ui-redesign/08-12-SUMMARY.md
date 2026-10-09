---
phase: 08-master-detail-ui-redesign
plan: 12
subsystem: testing
tags: [playwright, e2e, master-detail, playtime, sticky-head, focus-correction]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, --nav-offset 16px, the year head sticking at 0, scrollClear measuring only [data-sticky-chrome] (08-07), and the openSection/importAndOpen helpers and R1-R10 rules (08-02 to 08-07)"
provides:
  - "tests/e2e/playtime/playtime-charts.spec.ts: 18 listed tests on the new shell, the sticky-head contract rewritten against a head that sticks at the viewport top"
  - "tests/e2e/playtime/playtime-ui-review.spec.ts: 4 listed tests, the focus-correction sign test re-parked against the viewport top and the tile numerals read at 30px and 18px"
affects: [08-13, 08-14, 08-15, 08-16, 08-17, 08-18]

actuals:
  tokens: 5200
  tasks: 3
  commits: 3
plan_head_before: e5923c7403c373867f0720cbb3988a0b290fdc41
plan_head_after: f9e6b62eea9cd754816f007b5ca6bd827873a68f
commits: 3

tech-stack:
  added: []
  patterns:
    - "A geometry test that must park an element where the page cannot scroll far enough extends the scrollable height with test-only body padding instead of changing the app"

key-files:
  created: []
  modified:
    - tests/e2e/playtime/playtime-charts.spec.ts
    - tests/e2e/playtime/playtime-ui-review.spec.ts

key-decisions:
  - "The stuck year head is asserted at computed position sticky, computed top 0px and a bounding-box top within 1px of 0, because the shell has no sticky chrome over the content"
  - "The parked-cell test keeps its three setup guards (head stuck at 0, cell behind the head, cell on screen) and its real ArrowUp key press; only the parking line changed, from the nav bottom plus 12 to 12 below the viewport top"
  - "The 375px-head-taller-than-1280px claim is replaced by head taller than the declared 32px at both widths, because the detail pane is 343px wide at 375px and the summary now fits on one line"

requirements-completed: []

coverage:
  - id: D1
    description: "The sticky year head is a sibling of its scroller, taller than 32px, computed top 0px and at the viewport top once stuck, and a focused cell is never left under it at 1280px and 375px"
    verification:
      - kind: e2e
        ref: "tests/e2e/playtime/playtime-charts.spec.ts#sticky head"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every chart claim (cell counts, per-cell seconds, tooltip lines, keyboard model, duration bins, 375px overflow, motion) holds with the Playtime pane open; the calendar Tab order passes the about-calendar disclosure first"
    verification:
      - kind: e2e
        ref: "tests/e2e/playtime/playtime-charts.spec.ts#all 18"
        status: pass
    human_judgment: false
  - id: D3
    description: "The focus correction scrolls the page UP so a cell parked under the head ends at or below the head bottom, and an hour-grid cell ends at least 8px from the viewport top; tile numerals are 30px (desktop) and 18px (375px), one line each, unit one whole word"
    verification:
      - kind: e2e
        ref: "tests/e2e/playtime/playtime-ui-review.spec.ts#all 4"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 12: Migrate the chart-geometry Playtime specs Summary

**The two chart-geometry Playtime specs (22 listed tests, none added, no hand-table value changed) now open the Playtime pane and prove the sticky head, the focus-correction sign and the tile numerals against the new no-sticky-chrome geometry: head stuck at computed top 0px, cell parked 12px below the viewport top, numerals 30px on desktop and 18px at 375px.**

## Performance

- **Duration:** about 9 min (2026-10-07T22:53Z to 23:02Z)
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files:** 2 modified

## Accomplishments

- **Tracer (Task 1, sticky head).** `withHandFixture` now uses `importAndOpen(..., 'playtime')`. The `(sticky head)` test keeps its sibling-of-scroller and taller-than-32px half and replaces the nav lookup with computed `position: sticky`, computed `top: 0px`, a bounding-box top within 1px of 0 after scrolling, and the block still in view. The width loop is renamed (the stuck head sits at the viewport top and never hides the focused cell), keeps both widths, and now actually focuses Tuesday 2021-01-05, parks the Monday 12px below the viewport top, presses ArrowUp and asserts the cell ends at or below the head's bottom, with three setup guards so it cannot pass vacuously.
- **Task 2 (rest of playtime-charts).** One real failure: the calendar keyboard test Tabbed from the selector straight to a cell, but the `about-calendar` disclosure summary is now the first stop (R7). The test asserts that stop, checks the hint text with `toContainText(CALENDAR_KEYBOARD_HINT)`, then Tabs to 2021-01-01. The tooltip edge test's vertical assertion became "at least 8px from the viewport top". The motion test now also asserts the document's computed `scroll-behavior` is not `smooth`. No expected count, second, tooltip line or key-model value was edited.
- **Task 3 (playtime-ui-review).** `withScaleFixture` opens the pane. The G-04-UI-3 sign test parks the Monday 12px below the viewport top, guards `headTop` within 1px of 0, `cellTop < headBottom` and `cellTop >= 0`, and keeps the real ArrowUp press and the scroll-up assertion. The hour-grid half parks the cell 2px from the top and asserts it ends at least 7.5px down. The tile test reads the computed numeral font size (30px desktop, 18px at 375px) and keeps one numeral line, a whole unit word, the thousands-separator precondition and `hours dd < 40` at 1280px.

## Task Commits

1. **Task 1 (tracer): sticky head against the no-nav geometry** - `022a123` (test)
2. **Task 2: keyboard hint disclosure, tooltip clearance, scroll-behavior** - `32c77f8` (test)
3. **Task 3: re-park the focus-correction test and update tile numerals** - `f9e6b62` (test)

## Deviations from Plan

**1. [Rule 1 - Plan fact wrong] The year head no longer wraps at 375px**
- **Found during:** Task 3
- **Issue:** The plan says the head measures "41px at 1280 and larger at 375". In the master-detail shell the detail pane is 343px wide at 375px (the old card was 293px), so the 2022 summary (about 328px with the year) fits on one line and the head is 41px at both widths. The existing `expect(headHeights[0]).toBeGreaterThan(headHeights[1])` therefore failed (`Expected: > 41, Received: 41`).
- **Fix:** Replaced it with "each measured head is taller than the declared 32px" plus `headHeights[0] >= headHeights[1]`, and explained why in the comment. The mutation sensitivity is unchanged: a correction hard-coding 32 still leaves the cell about 9px under a 41px head, which the clear-of-head assertion catches. No clearance or sign assertion was loosened.
- **Files modified:** `tests/e2e/playtime/playtime-ui-review.spec.ts`
- **Commit:** `f9e6b62`

**2. [Rule 3 - Blocking] The hour grid cannot be parked 2px from the viewport top without extra scroll room**
- **Found during:** Task 3
- **Issue:** The hour grid is near the end of the page. The old test parked the cell at the nav's bottom plus 2 (58px), which the page could reach; 2px needs 56px more scroll, and `cellTop` stayed at 70.45px.
- **Fix:** The test sets `document.body.style.paddingBottom = '1200px'` inside its `page.evaluate` before scrolling. It is test-only space below the content and changes nothing above the cell; the setup guards (`cellTop >= 0` and `< 7.5`) still hold the test honest.
- **Files modified:** `tests/e2e/playtime/playtime-ui-review.spec.ts`
- **Commit:** `f9e6b62`

**3. [Rule 1 - Plan fact wrong] `ArrowUp` in the charts sticky-head loop**
- **Found during:** Task 1
- **Issue:** The old loop never pressed a key (it only measured the head against the nav). The plan asks for "after focusing a cell and pressing ArrowUp". I implemented that by mirroring the ui-review parking technique (focus Tuesday, park the Monday, press ArrowUp) so the assertion is a real one.
- **Impact:** None on the listed count; the test count stayed at 2 for the loop.

**Total deviations:** 3 (2 plan-fact corrections, 1 blocking). **Impact:** no listed test added, no hand-table value changed, no assertion weakened beyond the corrected head-height inequality described above.

## Issues Encountered

None beyond the deviations. The throwaway Playwright config (outside the repo) was used for every e2e run because the installed browsers do not match the pinned version; the repo's `playwright.config.ts` and `helpers.ts` were not touched.

## Verification

- `playwright test -c <throwaway config> --project=chromium tests/e2e/playtime/playtime-charts.spec.ts tests/e2e/playtime/playtime-ui-review.spec.ts` - 22 passed (18 + 4), 34.1 s
- `grep -nE "querySelector\('nav'\)|toBeCloseTo\(56" tests/e2e/playtime/playtime-charts.spec.ts` and `grep -nE "querySelector\('nav'\)" tests/e2e/playtime/playtime-ui-review.spec.ts` - no output
- `git diff -U0` on playtime-charts: no hand-table expected value changed (reviewed)
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - exit 0

## Known Stubs

None.

## Threat Flags

None. T-08-35 is mitigated: the parked-cell test keeps its three setup guards (head stuck, cell behind head, cell on screen) and the real key press and scroll-up assertion. T-08-36 is mitigated: only the synthetic builders already used by these specs are imported.

## Next Phase Readiness

Ready for 08-13.

## Self-Check: PASSED

- Both spec files present; commits `022a123`, `32c77f8` and `f9e6b62` found in `git log`; `git rev-list --count e5923c7..HEAD` is 3 before the SUMMARY commit.
