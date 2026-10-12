---
phase: 08-master-detail-ui-redesign
plan: 17
subsystem: testing
tags: [playwright, e2e, master-detail, vehicles, windowing, sticky]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, the openSection/importAndOpen helpers and the R1-R10 rules (08-02 to 08-07)"
provides:
  - "tests/e2e/vehicles/vehicle-stats.spec.ts: 25 listed tests on the Vehicle statistics block, read through the Vehicles pane"
affects: [08-18]

actuals:
  tokens: 9000
  tasks: 3
  commits: 3
plan_head_before: ea549b97a48bb4626377b727fbadcbd8667e1f83
plan_head_after: 7efd31000ef84afb9979e798bfb814ca17d5fdab
commits: 3

tech-stack:
  added: []
  patterns:
    - "A sticky-nav overlap poll is replaced by an elementFromPoint check at the stuck header's centre; a point outside the viewport reads as false, so it cannot pass vacuously"
    - "A page-wide absence claim is made pane by pane with one scan function taking a root selector (body on Vehicles, body on Overview, the list pane's own subtree)"

key-files:
  created: []
  modified:
    - tests/e2e/vehicles/vehicle-stats.spec.ts

key-decisions:
  - "The 5,000-vehicle scale describe lands with its own SCALE_READY_BUDGET_MS (the helper's two signals, spec-local) instead of waitForImported's fixed 30 s, then opens the Vehicles pane before the first-row wait; helpers.ts is untouched"
  - "(sticky) reopens the Vehicles pane after each setViewportSize so the table is measured with its screen showing at both widths"

requirements-completed: []

coverage:
  - id: D1
    description: "The main describe (tracer, controls-row, type-floor, sort, search, titles, battle-type, header, summary, warships, warplanes, picker, drift) reads the block through the Vehicles pane opened once in beforeAll; the drift import uses importAndOpen; every fixture-derived expectation is unchanged"
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicles/vehicle-stats.spec.ts#the Vehicle statistics block (05-12)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The column picker and battle-type summary 375px describes open the pane through the phone list-to-detail flow before the table is measured; overflow, sticky-axis, spill and picker assertions are unchanged"
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicles/vehicle-stats.spec.ts#the column picker at 375px, the battle-type summary at 375px"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 5,000-row window (at most 30 rows, aria-rowcount 5,001, end of list, sort/search return to top) and the sticky header and first column (within 2px at 1280 and 375) hold, with a real elementFromPoint no-overlay check replacing the retired nav poll"
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicles/vehicle-stats.spec.ts#the Vehicle statistics block at 5,000 vehicles"
        status: pass
    human_judgment: false
  - id: D4
    description: "States, privacy (Vehicles pane, Overview, list pane), long-text at 720 and 375, header and reset (replace and clear, pane reopened after each) pass on the new shell"
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicles/vehicle-stats.spec.ts#the states and the privacy rule"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 17: Migrate the Vehicle statistics spec Summary

**vehicle-stats.spec.ts (25 listed tests, 2,200 lines) now reads the windowed 5,000-row table, column picker and battle-type summary through the Vehicles pane, with the retired nav-overlap poll replaced by an elementFromPoint no-overlay check on the stuck header and the privacy scan widened to three surfaces.**

## Performance

- **Duration:** about 12 min
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files:** 1 modified

## Accomplishments

- **Tracer (Task 1).** The main describe's `beforeAll` calls `openSection(page, 'vehicles')` after the single shared import and before `waitForTable`. `(tracer)`, `(controls-row)` and `(type-floor)` pass with no other change; the 14px floor and the nation-tag truncation check still walk the open pane.
- **Task 2.** The ten remaining main-describe tests passed unmodified on the shared page. `(drift)` imports through `importAndOpen(..., 'vehicles')`. Both 375px describes open the pane after the import (the list screen is showing, so the helper clicks the row to reach the detail screen) before any measurement. All 15 tests in the three named describes pass.
- **Task 3.** The scale `beforeAll` submits the 5,000-vehicle zip, waits for the landing with the describe's own 60 s budget, opens the Vehicles pane, then waits for the first row. `(sticky)` keeps the header-top and first-column-left polls (2px) at 1280 and 375 unchanged, reopens the pane after each resize, and replaces the `dashboard-nav` poll with a polled `elementFromPoint` assertion at the header cell's centre (the topmost element must be the cell or a descendant). `(privacy)` scans the Vehicles pane, Overview and the list pane subtree for the stats-file canary (text content and every attribute). `(states)` x2, `(long-text)` (reopened at 720 and 375), `(header)` (replace re-opens the pane) and `(reset)` (pane re-opened after the replace and after the clear plus fresh import) all open the pane before reading controls.

## Task Commits

1. **Task 1 (tracer): open the Vehicles pane in the shared import** - `f3fefe1` (test)
2. **Task 2: drift and 375px describes** - `3ee55f5` (test)
3. **Task 3: scale, sticky, privacy, states, reset** - `7efd310` (test)

## Deviations from Plan

**1. [Rule 3 - Blocking risk] Spec-local landing wait in the scale describe**
- **Found during:** Task 3
- **Issue:** `importExport` ends in `waitForImported`, whose fixed 30 s ceiling is too close to a 5,000-vehicle import; the describe already budgets 60 s (`SCALE_READY_BUDGET_MS`). The dispatch directed a spec-local wait here rather than editing helpers.ts.
- **Fix:** The scale `beforeAll` calls `setInputFiles` itself and applies the helper's identical two signals (identity header out of `skeleton`, `processing-status` gone) with the 60 s budget. `importToFirstRowMs` still starts at submission.
- **Files modified:** `tests/e2e/vehicles/vehicle-stats.spec.ts`
- **Commit:** `7efd310`

**Total deviations:** 1 (test-side adaptation). **Impact:** none on assertions; the `importToFirstRowMs` now includes the pane open, which is part of reaching the first row.

## Issues Encountered

None. The throwaway Playwright config outside the repo was used (installed browsers do not match the pinned version); `playwright.config.ts` and `helpers.ts` were not touched.

## Verification

- `playwright test -c <throwaway config> --project=chromium tests/e2e/vehicles` - 25 passed, 32.7 s
- Task 1 named tests: 3 passed; Task 2 named describes: 15 passed
- `--list`: `Total: 25 tests in 1 file`
- `grep -c dashboard-nav` on the spec: 0; `grep -c openSection`: 7; `(sticky)` contains an `elementFromPoint` assertion
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - clean

## Known Stubs

None.

## Threat Flags

None. T-08-45 is mitigated: `(privacy)` scans the Vehicles pane, Overview and the list pane. T-08-46 is mitigated: the nav-overlap poll is replaced by a real `elementFromPoint` assertion on the stuck header at both widths, not removed.

## Self-Check: PASSED

- Spec file exists; commits `f3fefe1`, `3ee55f5`, `7efd310` exist; plan acceptance criteria re-run and pass.
