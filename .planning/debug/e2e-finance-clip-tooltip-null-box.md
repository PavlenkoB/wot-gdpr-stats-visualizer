---
status: awaiting_human_verify
trigger: "running `playwright test` fails (failure output unavailable to reporter; reproduce first)"
created: 2026-10-03T00:00:00Z
updated: 2026-10-03T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. finance.spec.ts (clip) calls a bare `window.scrollTo(0, y)`; app.css sets `html { scroll-behavior: smooth }` under prefers-reduced-motion: no-preference (Playwright's default), so the scroll is a glide. hover() lands mid-glide, the tooltip opens against a mid-glide cell rect, the next glide frame moves the cell >1px, ChartTooltip.isStale() dismisses it, and boundingBox() is null (or toBeVisible never sees it)
test: A/B: baseline --repeat-each 20 = 15 failed; same run after switching the test's scrollTo to behavior 'instant'
expecting: 0 failures after the fix
next_action: user confirms `playwright test` is green in their own shell; then archive to resolved/ and append to knowledge-base.md

reasoning_checkpoint:
  hypothesis: "A smooth (non-instant) page scroll started by the test's own window.scrollTo is still gliding when hover() opens the tooltip, so the cell moves after the tooltip anchored to it, and the shared tooltip correctly dismisses it as stale"
  confirming_evidence:
    - "Probe inside the test: getComputedStyle(documentElement).scrollBehavior === 'smooth'; immediately after window.scrollTo the chart top was still 264px from the viewport top (target 6px), i.e. the scroll had not landed"
    - "15 of 20 isolated repeats failed at the same site (14x null boundingBox at finance.spec.ts:1881, 1x toBeVisible at :1877); the error is a null box, not a wrong coordinate"
    - "ChartTooltip.isStale() dismisses on any scroll that moves the anchor by more than 1px (by design)"
    - "Same-class race already documented and fixed elsewhere: playtime-charts.spec.ts uses reducedMotion 'reduce' ('scroll-behavior: smooth would make every scroll a race'), scroll-nav.spec.ts uses behavior 'instant'"
  falsification_test: "If the test's scrollTo is made instant and the 20x isolation run still fails, the hypothesis is wrong"
  fix_rationale: "The test, not the product, is wrong: smooth scrolling is intended product behaviour (D-29) and the tooltip dismissing a moved cell is intended. The test needs the page at a known position before it hovers, so its scroll must be instant. Waiting or retrying would only hide the race."
  blind_spots: "Not directly observed which glide frame dismissed the tooltip in a failing run (the probe's extra round trip made the race pass); the A/B is the proof"
  candidate_causes:
    - "code(test): bare window.scrollTo under global smooth scroll (confirmed)"
    - "config: Playwright config does not pin reducedMotion globally, so every spec must pin it itself; this spec does not (contributing)"
    - "environment: timing/load - 75% fail under default parallel workers, 4/4 pass with an extra round trip (modulates probability only)"
  and_gate: "yes: both conditions are needed (product smooth-scroll default AND a test scroll that is not instant); neither alone fails. The product behaviour is intended, so the fix is on the test side."

## Symptoms

expected: `playwright test` exits 0 with all 198 tests passing
actual: `pnpm run test:e2e` exited 1: 1 failed, 3 did not run, 194 passed (bare `pnpm exec playwright test` run immediately before passed 198/198, so intermittent)
errors: |
  1) [chromium] tests/e2e/finance.spec.ts:1841:3 05-13 virtual currency: a twenty-year history (clip) the first and last month keep the finance tooltip inside the viewport
  TypeError: Cannot read properties of null (reading 'y')   at finance.spec.ts:1881:20  (flipped = tooltip.boundingBox() was null)
reproduction: `pnpm run test:e2e` (full suite, default workers); passed on one run, failed on the next
started: unknown; Phase 4/5 UI gap-closure commits are recent

## Eliminated

## Evidence

- timestamp: 2026-10-03
  checked: bare `pnpm exec playwright test`, then `pnpm run test:e2e`; port 4173 free; bare `playwright` is not on PATH; chromium-1243 installed
  found: bare run 198 passed exit 0; script run exit 1 with the failure above; the 3 "did not run" tests are the remaining tests of the serial describe block
  implication: not environmental (browser/port/dist all fine); intermittent failure inside one spec

## Resolution

root_cause: finance.spec.ts (clip) scrolled the page with a bare `window.scrollTo(0, y)`. app.css sets `html { scroll-behavior: smooth }` under `prefers-reduced-motion: no-preference` (Playwright Chromium's default), so the scroll is a glide that has not landed when hover() runs (probe: chart top 264px vs target 6px right after the call). The tooltip opens against a cell still in motion, the next glide frame moves it more than 1px, and ChartTooltip.isStale() dismisses it by design, so tooltip.boundingBox() is null (finance.spec.ts:1881) or toBeVisible never holds (:1877). Test-side defect; the product behaviour (smooth scroll, dismiss-on-move) is intended. This is the "known intermittent finance tooltip-hover race" (it was finance.spec.ts:1568 at e232684, :1841 now).
fix: the test's window.scrollTo now passes `{ top, left: 0, behavior: 'instant' }`, with a comment explaining why (same approach as scroll-nav.spec.ts).
verification:
  target_test: { result: pass }   # (clip) 0 failures in 20 + 40 + 15 + 20 isolated repeats after the fix
  mutation_check: { result: skipped, reason_if_skipped: "no Stryker configured in this repo, and the fix is test-only (no product line to mutate)", mutant_killed: n/a }
  no_op_deletion: { result: pass, deletion_justified_by_rca: n/a }   # diff swaps a bare window.scrollTo for scrollTo({top, left: 0, behavior: 'instant'}) plus a comment; no assertion removed or weakened
  adjacent_tests: { result: pass, suites_run: [ "pnpm run test:unit 47 files / 1405 tests (incl. ci-budget, webserver-teardown)", "pnpm run test:e2e x3 = 198/198", "pnpm exec playwright test = 198/198", "CI=1 pnpm exec playwright test = 198/198 (3.2 min, 1 worker)" ] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }   # git revert -n 202c032 then 20x: 4 failed of 20 (an earlier unfixed 20x run: 15 failed of 20; the rate is timing dependent); fix restored then 20x: 0 failed of 60 tests
  guardrail_verdict: accepted
history_check: the three ingredients all predate the Phase 4/5 gap-closure commits: bare window.scrollTo(0, chart...) added in 3a50ecf (05-13, 2026-10-02), `html { scroll-behavior: smooth }` in 2ef027c (Phase 3, 2026-09-29), ChartTooltip.isStale in 349ec8f (Phase 4, 2026-10-01). The "known flaky ~line 1568" at e232684 is this same test (now :1841). Whether 05-20..22 changed the odds was not measured; the fix removes the race at its source either way.
files_changed: [tests/e2e/finance.spec.ts]
