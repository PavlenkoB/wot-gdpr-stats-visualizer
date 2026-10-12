---
phase: 08-master-detail-ui-redesign
plan: 11
subsystem: testing
tags: [playwright, e2e, master-detail, playtime, scale]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, openSection/importAndOpen/replaceExport(open)/waitForImported helpers and the R1-R10 rules (08-02 to 08-07), and the migration approach from 08-08 to 08-10"
provides:
  - "tests/e2e/playtime/playtime.spec.ts: 4 listed tests, every one opens the Playtime pane before reading the block"
  - "tests/e2e/playtime/playtime-real-shape.spec.ts: 2 listed tests, both open the Playtime pane after the import"
  - "tests/e2e/playtime/playtime-scale.spec.ts: 5 listed tests, the single serial 60,000-session import opens the Playtime pane before awaiting the block, and the return visit re-opens it"
affects: [08-12, 08-13, 08-14, 08-15, 08-16, 08-17, 08-18]

actuals:
  tokens: 4500
  tasks: 3
  commits: 3
plan_head_before: 037ecfa93095818e5798c407789c2ecf3e1f0cc6
plan_head_after: ce2ac1a89a6fff73e46190e365b1abb2f097f57c
commits: 3

tech-stack:
  added: []
  patterns:
    - "A spec whose import can legitimately exceed the shared helper's fixed 30 s wait keeps a spec-local landed-wait that takes the caller's budget, rather than editing the shared helper"

key-files:
  created: []
  modified:
    - tests/e2e/playtime/playtime.spec.ts
    - tests/e2e/playtime/playtime-real-shape.spec.ts
    - tests/e2e/playtime/playtime-scale.spec.ts

key-decisions:
  - "playtime-scale gets a spec-local waitForImportLanded(page, budgetMs) with the same two signals as waitForImported (identity header leaves skeleton, processing-status gone) but the caller's ceiling, because the 60,000-session import takes longer than the helper's fixed 30 s in this environment"
  - "The return-visit measurement keeps its start point (right after the worker is ready) and now includes landing the cached dataset and opening the pane, which the page must do anyway before the block exists"

requirements-completed: []

coverage:
  - id: D1
    description: "The Playtime block states (ready, selector, announcement, error, dropped query, cache-cleared notice and its removal on re-drop) are proven through the open Playtime pane, with the block's single explicit aria-live unchanged"
    verification:
      - kind: e2e
        ref: "tests/e2e/playtime/playtime.spec.ts#all 4"
        status: pass
    human_judgment: false
  - id: D2
    description: "The real-shape one-game and two-game exports populate the block, the calendar, the hour grid and the bins from the oracle constants, with the login IP absent from the page"
    verification:
      - kind: e2e
        ref: "tests/e2e/playtime/playtime-real-shape.spec.ts#all 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 60,000-session gate still measures submission to ready, node counts follow buckets, the selector sweep, one-worker zero-request claim and return-visit claim all hold, with one serial import and exactly five listed tests"
    verification:
      - kind: e2e
        ref: "tests/e2e/playtime/playtime-scale.spec.ts#all 5"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 11: Migrate the Playtime specs to the master-detail shell Summary

**The three Playtime specs (11 listed tests, none added, no oracle constant or assertion changed) now open the Playtime pane after every import, replace and reload before reading the block, and the 60,000-session scale gate keeps its single serial import, its submission-to-ready measurement and its five tests.**

## Performance

- **Duration:** about 6 min (2026-10-07T22:47Z to 22:53Z)
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files:** 3 modified

## Accomplishments

- **Tracer (Task 1, playtime.spec).** The four `importExport` calls became `importAndOpen(..., 'playtime')` and the G-04-5 replace became `replaceExport(..., 'playtime')`, since a replace lands on Overview. The `aria-live` count of 1 inside the block and the `file-input` count of 1 are unchanged; only the stale comment about a page-wide count of two was reworded (the page now also has the notice slot and the chart announcement region outside the block).
- **Task 2 (playtime-real-shape).** Both tests use `importAndOpen(..., 'playtime')`. The diff touches only the import and the helper import line; no `REAL_SHAPE_*` expectation changed.
- **Task 3 (playtime-scale).** `importAndAwaitReady` takes its start time as before, sets the file, waits for the import to land, opens the Playtime pane, then waits for the block's `ready` and the visible `playtime-charts` and returns the elapsed milliseconds. The pane is opened once in the `beforeAll` path and tests (1) to (4) rely on it; test (2)'s second context goes through the same function. Test (5), the return visit, waits for the cached dataset to land and opens the pane after the reload before reading tiles. Node-count, sweep, one-worker, CSP and long-task claims are untouched.

## Task Commits

1. **Task 1 (tracer): playtime.spec opens the pane** - `9690949` (test)
2. **Task 2: playtime-real-shape opens the pane** - `fd85a38` (test)
3. **Task 3: playtime-scale opens the pane** - `ce2ac1a` (test)

## Deviations from Plan

**1. [Rule 3 - Blocking] Spec-local landed-wait in playtime-scale instead of `waitForImported`**
- **Found during:** Task 3
- **Issue:** The plan says to call `waitForImported(page)` after `setInputFiles`. That helper has a fixed 30 s ceiling on the identity header leaving `skeleton`. The 60,000-session import takes longer than 30 s in this environment, so the `beforeAll` failed on the helper's own timeout (`Received: "skeleton"`, 30000ms) before the spec's 60 s `READY_BUDGET_MS` was reached.
- **Fix:** Added `waitForImportLanded(page, budgetMs)` in the spec, with the same two signals as `waitForImported` and the caller's budget (`READY_BUDGET_MS` for the import, `RETURN_VISIT_BUDGET_MS` for the return visit). `helpers.ts` is untouched.
- **Files modified:** `tests/e2e/playtime/playtime-scale.spec.ts`
- **Verification:** all five scale tests pass; the import still has to land inside `READY_BUDGET_MS` and the measured start point is unchanged.
- **Commit:** `ce2ac1a`

**Total deviations:** 1 auto-fixed (1 blocking). **Impact:** none on assertions or the listed count. Worth knowing for later plans: any other spec importing a very large export through `waitForImported` is capped at 30 s.

## Issues Encountered

None beyond the deviation above. The throwaway Playwright config (outside the repo) was used for every e2e run because the installed browsers do not match the pinned version; the repo's `playwright.config.ts` was not touched.

## Verification

- `pnpm exec playwright test -c <throwaway config> --project=chromium` on playtime-real-shape and playtime specs - 6 passed; on playtime-scale - 5 passed (42.6 s); the three together were first run before the deviation fix (scale failed on the 30 s helper wait), then scale alone passed after it
- `playwright test --project=chromium tests/e2e/playtime/playtime-scale.spec.ts --list` - `Total: 5 tests in 1 file`
- `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` - 6 passed
- `git diff -U0` on playtime-real-shape shows only the helper import and the two import calls changed
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - clean

## Known Stubs

None.

## Threat Flags

None. T-08-33 is mitigated: only locators, waits and `openSection` calls changed, no expectation constant was edited. T-08-34 is mitigated: the scale file lists exactly 5 tests, keeps its measured start point, and `ci-budget.test.ts` passes.

## Next Phase Readiness

Ready for 08-12.

## Self-Check: PASSED

- All three spec files present; commits `9690949`, `fd85a38` and `ce2ac1a` found in `git log`; `git rev-list --count 037ecfa..HEAD` is 3 before the SUMMARY commit.
