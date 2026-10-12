---
phase: 08-master-detail-ui-redesign
plan: 15
subsystem: testing
tags: [playwright, e2e, master-detail, finance, premium-time, virtual-currency, tooltip]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, the openSection/importAndOpen/replaceExport helpers, the R1-R10 rules and --nav-offset 16px (08-02 to 08-07)"
provides:
  - "tests/e2e/finance/finance.spec.ts: 32 listed tests on the premium time and virtual currency blocks, all read through the Finance pane"
affects: [08-16, 08-17, 08-18]

actuals:
  tokens: 4000
  tasks: 3
  commits: 3
plan_head_before: 29d95f27e1dad143b9523adeb4a5737cb2109cad
plan_head_after: 020a2812f793e5540baa31019b8be6febcdbc392
commits: 3

tech-stack:
  added: []
  patterns:
    - "A top-edge tooltip flip is stated against the measured tooltip height: anchor.top - height - 8 < --nav-offset (16px) + 8, with the page given temporary body padding so it can scroll far enough"

key-files:
  created: []
  modified:
    - tests/e2e/finance/finance.spec.ts

key-decisions:
  - "The tooltip clip test no longer reads a nav: both ends keep 8px from the left, right and top of the viewport, and the flip is asserted as the condition 'anchor.top - tooltip height - 8 < 16 + 8' plus 'tooltip placed at or below the anchor bottom'"
  - "Half a pixel of slack on the right-edge check only: the clamp measures the tooltip by its integer offsetWidth, the box it is compared with is the fractional rendered width (1272.17 vs 1272)"

requirements-completed: []

coverage:
  - id: D1
    description: "The premium time sample export, the single-month timeline and the CURR_PREMIUM-dated real-shape export are proven through the Finance pane with every hand-derived figure, sentence and bar height unchanged"
    verification:
      - kind: e2e
        ref: "tests/e2e/finance/finance.spec.ts#05-10 sample export, 05-11, 05-18"
        status: pass
    human_judgment: false
  - id: D2
    description: "The premium absent, header-only, junk, date-excluded and no-Financial_data-folder states are proven through the Finance pane, including the greyed 'Not in this export' section status"
    verification:
      - kind: e2e
        ref: "tests/e2e/finance/finance.spec.ts#05-10 absent, excluded rows, no Financial_data folder"
        status: pass
    human_judgment: false
  - id: D3
    description: "The virtual currency charts, tables, other-currency rows, one-sided axis, whole-pixel pitch, cap of eight, twenty-year history, stray dates and income-as-up are proven through the Finance pane, and the tooltip stays inside the viewport at both ends and flips below near the top without a nav"
    verification:
      - kind: e2e
        ref: "tests/e2e/finance/finance.spec.ts#05-13, 05-17, 05-21, 05-22"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 15: Migrate the finance spec Summary

**finance.spec.ts (32 listed tests, about 2,000 lines) now reads the Premium time and Virtual currency blocks through the Finance pane, with no oracle figure touched and the tooltip clip test rewritten from "under the sticky nav" to the 16px + 8px flip condition.**

## Performance

- **Duration:** about 12 min
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files:** 1 modified

## Accomplishments

- **Tracer (Task 1).** The two `beforeAll` imports of the sample export (05-10 premium, 05-13 currency, and the second 05-13 describe) and the 05-11 and 05-18 tests use `importAndOpen(..., 'finance')`. The card `data-status` through `financialSection(page)` and the block `data-state` stay two separate assertions. 10 tests green.
- **Task 2.** The absent-file/header-only replace test, the junk and date-excluded exports and the no-folder test all open the pane; the replace passes `'finance'` as its fifth argument. The no-folder test needed no assertion change: with the section absent the pane renders `dashboard-section-financial-data` with `data-status="no-export"` and `section-status` "Not in this export", exactly what it already asserted (`premium-block` count 0). 4 tests green.
- **Task 3.** The currency describes (one-sided axis, whole-pixel pitch, none charted, cap of eight, singular forms, empty files, twenty-year `beforeAll`, stray years, income counts as up) open the pane; the second `replaceExport` passes `'finance'`. `importExport` is no longer imported. The clip test lost its `dashboard-nav` lookup and 72px fallback.
- **Clip test.** Both ends (index 0 and 239) now assert left >= 8, right <= viewport - 8, top >= 8 and bottom <= viewport height. The flip block adds temporary body padding (the Finance pane is too short for the chart to reach the viewport top), scrolls the chart to 6px below the top, then asserts the stated condition against the measured tooltip height (`cell.top - height - 8 < 16 + 8`), that the tooltip sits at or below the cell's bottom, and that it keeps 8px from the top.
- **Hints.** The plan expected `BAR_CHART_KEYBOARD_HINT` / `currency-keyboard-hint-<index>` assertions; the spec has none (grep finds no hint reference), so no `toContainText` conversion was needed. Basis captions, the block caption, summaries and excluded notices were already asserted visible and still are.

## Task Commits

1. **Task 1 (tracer): premium sample-export describes** - `6764d6d` (test)
2. **Task 2: premium absent, empty, excluded and no-folder describes** - `75798e0` (test)
3. **Task 3: virtual currency describes and tooltip clip test** - `020a281` (test)

## Deviations from Plan

**1. [Rule 1 - Plan fact wrong] No keyboard-hint assertions exist in this spec**
- **Found during:** Task 1
- **Issue:** The plan lists hint assertions to convert to `toContainText`; the spec contains none.
- **Fix:** Nothing to convert. Recorded so the next reader does not look for them.

**2. [Rule 1 - Bug] Sub-pixel right-edge overshoot on the last-month tooltip**
- **Found during:** Task 3
- **Issue:** With the new layout the tooltip for month 239 ends at x = 1272.17 against a limit of 1272. `ChartTooltip` clamps with the integer `offsetWidth`; `boundingBox()` reports the fractional width.
- **Fix:** The right-edge check in the twenty-year clip test allows 0.5px. The left, top and bottom checks and the 8px margin itself are unchanged. The first-describe clip test (premium chart) did not need it.
- **Commit:** `020a281`

**3. [Rule 3 - Blocking] Page too short to lift the chart to the viewport top**
- **Found during:** Task 3
- **Issue:** With the nav gone the Finance pane is shorter than viewport + chart offset, so the old `scrollTo` clamps and the near-top flip is unreachable.
- **Fix:** The flip check adds 1200px of body padding and removes it afterwards (the approach 08-14 used for the map).
- **Commit:** `020a281`

**Total deviations:** 3 (all test-side adaptations). **Impact:** listed total stays 32; no oracle constant, sentence, tooltip line, axis, pitch or table row changed (`git diff` over the plan shows only imports, pane opens, the clip test and its comments).

## Issues Encountered

None beyond the deviations. The throwaway Playwright config outside the repo was used (installed browsers do not match the pinned version); `playwright.config.ts` and `helpers.ts` were not touched.

## Verification

- `playwright test -c <throwaway config> --project=chromium tests/e2e/finance/finance.spec.ts` - 32 passed, 32.7 s
- `--list` total: 32 tests in 1 file (at or below 32)
- `grep -c "dashboard-nav" tests/e2e/finance/finance.spec.ts` - 0
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - clean

## Known Stubs

None.

## Threat Flags

None. T-08-41 is mitigated: no oracle expectation changed. T-08-42 is mitigated: the clip test keeps both horizontal edges, gains an explicit 8px top check and states the flip condition.

## Self-Check: PASSED

- `tests/e2e/finance/finance.spec.ts` exists; commits `6764d6d`, `75798e0`, `020a281` exist; all plan acceptance criteria re-run and pass.
