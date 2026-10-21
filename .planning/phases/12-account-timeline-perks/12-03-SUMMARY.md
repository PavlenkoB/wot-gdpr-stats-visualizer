---
phase: 12-account-timeline-perks
plan: 03
subsystem: infra
tags: [ci, playwright, budget-guard, github-actions, e2e-timeout]

requires:
  - phase: 11
    provides: "263 listed e2e tests in 30 files (MEASURED), the last of them closing Phase 11"
  - phase: 10-06
    provides: "the 31 / 33 / 41 min raise and its 264-test ceiling, the arithmetic this plan extends"
provides:
  - "G = 32 min (1920 s) globalTimeout, W = 34 min (2040 s) shell wrapper, J = 42 min (2520 s) job"
  - "A 273-test ceiling, the largest listed count the new G admits"
  - "Worked projection cases for 264, 265, 273 and 274 plus the two margin assertions that fix 273 as the ceiling"
affects: [12-13, ci-budget-guard, phase-13, future e2e budgets]

actuals:
  tokens: 2968
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Raise G / W / J together, one append-only dated paragraph per raise per file, with the arithmetic recomputed by the guard's own projectedE2eSeconds before any number reaches prose."

key-files:
  created: []
  modified:
    - playwright.config.ts
    - .github/workflows/ci.yml
    - tests/unit/guards/ci-budget.test.ts

key-decisions:
  - "Raise all three e2e limits NOW, before the two listed tests plan 12-13 adds exist: the limits only get looser, so nothing built before that point can be cut short, and the decision, its arithmetic and its pins stay in one reviewable change."
  - "32 / 34 / 42 min with a 273-test ceiling, derived from the guard's own formula (E(N) = 330 + 5 * (N - 105) + 304) rather than chosen by round number: 265 tests project 1434 s and a 1864.2 s floor, which 31 min no longer covers; 32 min clears 1864.2 s and admits 273 (floor 1916.2 s) but not 274 (floor 1922.7 s)."

patterns-established:
  - "Closed form for large counts: from N >= 260 every block is held back, so E(N) = 330 + 5 * (N - 105) + 304. The four new worked cases are hand-derived from that one line."

requirements-completed: []
# The plan's `requirements` field names PRIV-02 because this plan touches the CI
# budget the zero-network guard runs inside (T-12-08), but PRIV-02 was already
# marked complete by Phase 11 — `requirements mark-complete PRIV-02` reported
# `applied: false` because there was nothing left to check off. This plan
# therefore completes no requirement; it only keeps the limits its assertions run
# within large enough to be reached.

coverage:
  - id: D1
    description: "The three CI e2e limits agree at 32 / 34 / 42 min and the guard pins them with a 273-test ceiling, so no single limit can move alone and a count past the ceiling fails the build."
    requirement: PRIV-02
    verification:
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts#CI e2e budget > phase 12 raised all three limits together to 32 / 34 / 42 min"
        status: pass
      - kind: other
        ref: "pnpm run lint"
        status: pass
    human_judgment: false
  - id: D2
    description: "The dated narrative logs stay append-only: the new paragraphs are added and only the present-tense summary sentences change, so the historical record of every earlier raise survives intact."
    requirement: PRIV-02
    verification:
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts#CI e2e budget > the CI comment names the SAME globalTimeout the workflow is configured with"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
started: 2026-10-20T07:04:18Z
completed: 2026-10-20T07:07:28Z
status: complete
commits: 1
plan_head_before: df78236efc709c0ae16eedd98e972cdb1e156f81
plan_head_after: dc015dd7da726debe0847411d6ad12eb8b8805b9
---

# Phase 12 Plan 03: CI e2e budget raise to 32 / 34 / 42 min Summary

**All three CI e2e limits raised together to 32 / 34 / 42 min with a 273-test ceiling, computed from the guard's own projection function before the two Phase 12 e2e tests exist.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-20T07:04:18Z
- **Completed:** 2026-10-20T07:07:28Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- `globalTimeout` moved 31 -> 32 min (1920 s), the shell wrapper 33 -> 34 min (2040 s), the job `timeout-minutes` 41 -> 42 (2520 s) — the same G + 2 and W + 8 relationship every raise before this one used, so none of the three moved alone.
- The arithmetic is derived, not picked: from N >= 260 every block is already held back, so E(N) = 330 + 5 * (N - 105) + 304. 265 tests project 1434 s and a 1.3x floor of 1864.2 s, past the 1860 s that 31 min gave; 32 min is the smallest whole number that clears it.
- The ceiling is 273 and is pinned as such: 273 project 1474 s (floor 1916.2 s, clears 1920), 274 project 1479 s (floor 1922.7 s, fails). Both are now hand-derived literals in the guard, so 273 cannot quietly become 280 later.
- The prose guard still holds: `Playwright's own \`globalTimeout\` (32 min)` appears exactly once in ci.yml and equals the configured value.
- No listed test was added — the suite still lists 263 tests in 30 files, so nothing here depends on Chromium and the limits are in force before plan 12-13 writes the two tests that need them.

## Task Commits

Each task was committed atomically:

1. **Task 1: Raise G, W and J together to 32 / 34 / 42 min and pin the 273-test ceiling with the guard's own arithmetic** - `dc015dd` (chore)

## Files Created/Modified

- `playwright.config.ts` — `globalTimeout: 32 * 60 * 1000`, with an appended dated "Raised from 31 to 32 in plan 12-03" paragraph carrying the worked formula, the 1.3x floor and the 273/274 ceiling pair.
- `.github/workflows/ci.yml` — `timeout-minutes: 42`, an appended "Raised from 41 to 42" paragraph above it, `timeout 34m playwright test`, the present-tense `(32 min)` sentence, and the corrected present-tense arithmetic (`34 min = 1920 + 120 s` against the rule's `1920 + 90 s` floor, 265 tests), plus an appended "Raised from 33 to 34" paragraph.
- `tests/unit/guards/ci-budget.test.ts` — the Phase 10 pin test replaced by the Phase 12 one (1920 / 2040 / 2520, ceiling 273), worked projection cases for 264 / 265 / 273 / 274 with the closed form spelled out, the two margin assertions, `smallestPassingMinutes(1434) === 32`, and a Phase 12 header paragraph.

## Decisions Made

- **Raise before the tests exist.** The limits only ever get looser, so nothing Phase 12 builds up to plan 12-13 can be cut short by them, and the decision, its arithmetic and its pins stay in one reviewable change instead of being split across the plan that adds the tests. Phase 11 set the precedent for the opposite (raise at the plan that crosses the ceiling); the difference here is that the research already named the exact two tests Phase 12 would add, so the arithmetic is settled before the specs exist.
- **Ceiling 273, not 268 or 280.** The research estimate for the large-import block (30 s) would have held up to 268; the MEASURED allowance is 49 s, so the same 32 min holds fewer tests. The measurement wins, as it did at 10-06.
- **Extend the long zero-network test rather than adding listed tests for it.** The two new panes (Account Timeline, Perks) are added to the existing zero-network test as steps, which adds zero listed tests, exactly as Phase 11 did — so the whole of Phase 12's e2e cost is two tests.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first pass of the `playwright.config.ts` paragraph led with "32 min is 12-03's raise", following the file's own prior style ("31 min is 10-06's raise"), which does not contain the literal string the acceptance criterion requires. Caught by running the acceptance greps before committing; the paragraph now leads with "Raised from 31 to 32 in plan 12-03" and the local style phrase is kept on the same line, so both readings are satisfied.
- TDD ordering: the guard was edited first and run RED (the Phase 12 pin failed with `expected 1860 to be 1920`) before either configuration file was touched. Every worked projection case passed on the RED run, which is the evidence that the hand-derived literals (1429 / 1434 / 1474 / 1479 and the two margins) are the function's own output rather than a parallel guess.

## Known Stubs

None. No stub, skipped test, or unrun `<verify>` was left behind; both automated verifications ran and passed.

## Threat Flags

None. This plan edits no trust boundary. Its own register entry, T-12-08 (the e2e job timing out and cancelling the run before the privacy assertions of plan 12-13 execute), is mitigated by the three limits moving together under the guard's ordering rules and by the ceiling pin: a listed count above 273 now fails the build rather than quietly running out of time.

## Next Phase Readiness

- Plan 12-13 can add its two listed tests (the Account timeline test and the Perks test) with no further budget change: 265 <= 273, and 265 is the count the new arithmetic was computed against.
- The wrapper and job orderings still hold with room: 2040 s >= 1920 + 90 s and 2520 s >= 2040 + 300 s, both enforced by the two ordering tests that passed.
- The `PRE_PHASE_SECONDS = 330` baseline remains an ESTIMATE and is still the input most likely to be wrong; it is what the first real CI run of the phase-12 suite should replace.

## Self-Check: PASSED

- All three modified files exist on disk.
- Commit `dc015dd` is an ancestor of HEAD (`git merge-base --is-ancestor` confirmed).
- `commits: 1` measured from the ledger `gsd-plan-head-before-12-03` (`df78236`), not narrated.

---
*Phase: 12-account-timeline-perks*
*Completed: 2026-10-20*
