---
phase: 08-master-detail-ui-redesign
plan: 19
subsystem: testing
tags: [ci-budget, playwright, guards, phase-gate]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the migrated e2e suite (08-08 to 08-18) and the phase8-shell-guards file (08-07)"
provides:
  - "tests/unit/guards/ci-budget.test.ts: the Phase 8 end-of-phase count (252), its projection (1308 s) and a 'phase 8 holds all three limits' pin (1740 / 1860 / 2340 s, ceiling 258)"
  - "tests/unit/guards/phase8-shell-guards.test.ts: a spec-tree describe (retired hooks, skip/only/fixme, unopened sections, nav spec size)"
affects: []

actuals:
  tokens: 6000
  tasks: 2
  commits: 2
plan_head_before: 8d13cef
plan_head_after: 83aa5abad17929c9f01f8048d2e4294bc231b899
commits: 2

tech-stack:
  added: []
  patterns:
    - "A recursive node:fs walk over tests/e2e with comment stripping, so a guard covers files added later without a list to maintain"

key-files:
  created: []
  modified:
    - tests/unit/guards/ci-budget.test.ts
    - tests/unit/guards/phase8-shell-guards.test.ts

key-decisions:
  - "All three CI limits HELD (globalTimeout 29 min, wrapper 31 min, job 39 min): the phase ends at 252 listed tests, below the 257 it started at and the 258 ceiling"
  - "The spec-tree section tripwire keys on the dashboard-section-* test ids and on the named imports from _support/helpers; only helpers.ts (which defines the openers) is exempt"

requirements-completed: []

coverage:
  - id: D1
    description: "The CI budget is reconciled: 252 listed tests in 25 files, E = 1308 s, floor 1700.4 s, 39.6 s of slack against the held 1740 s globalTimeout; a later raise of any limit or a count above 258 fails with the arithmetic in the message"
    verification:
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts#phase 8 holds all three limits"
        status: pass
    human_judgment: false
  - id: D2
    description: "The spec tree carries no retired nav hook, no skip/only/fixme marker, no section-reading spec without an opening helper, and a nav spec of at most 19 tests"
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-shell-guards.test.ts (phase 8 e2e spec-tree guards, 5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The complete suite is green: unit, both Playwright projects, svelte-check, lint, build, and no dependency change"
    verification:
      - kind: command
        ref: "pnpm run test:unit; playwright test (252); pnpm run check; pnpm run lint; pnpm run build; git diff --exit-code a3f91c9 -- package.json pnpm-lock.yaml"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual fidelity to the Day 10 canvas, focus feel and tablet stacking at 1280 / 800 / 375px (the plan's human-check)"
    human_judgment: true
    rationale: "Judged by eye in a real browser; not performed by this executor, left for /gsd-verify-work"
---

# Phase 8 Plan 19: CI budget reconciliation and the full-suite gate Summary

**The three CI e2e limits are held (29 / 31 / 39 min) because the phase ends at 252 listed tests, pinned by a new ci-budget test; a spec-tree guard bans retired nav hooks and silent skips; and the whole suite is green: 2,566 unit tests, 252 Playwright tests under both projects, svelte-check, lint and build.**

## Performance

- **Duration:** about 20 min of execution, dominated by one 5.5 min full Playwright run
- **Tasks:** 2 of 2
- **Files modified:** 2 (both unit guard files)

## Accomplishments

- `ci-budget.test.ts`: header paragraph recording the Phase 8 outcome with its arithmetic (L = 252, E = 330 + 5 x (252 - 101) + 223 = 1308 s, 1.3 x E = 1700.4 s, ceil = 29 min), a `projectedE2eSeconds(252)` = 1308 line, and the new 'phase 8 holds all three limits' test (globalTimeout 1740, wrapper 1860, job 2340, listed count at most 258, with the G + 2 / W + 8 raise rule in the message). `playwright.config.ts` and `ci.yml` are untouched.
- `phase8-shell-guards.test.ts`: a recursive walk of `tests/e2e` (helpers included) asserting, outside comments, no `dashboard-nav`, `nav-link-` or nav tag query; no `.only(` / `.skip(` / `.fixme(`; every section-reading spec in the named folders imports `openSection`, `importAndOpen` or `replaceExport` from `_support/helpers`; and `master-detail-nav.spec.ts` has at most 19 tests (it has 15).

## Phase gate results

| Gate | Result |
| --- | --- |
| `pnpm run test:unit` | 84 files, 2,566 tests passed |
| `playwright test` (both projects, 252 tests) | 252 passed in 5.5 min, 0 failed, 0 skipped; `zero-network.spec.ts` (5 tests) green |
| `pnpm run check` | tsc -b clean; svelte-check 304 files, 0 errors, 0 warnings |
| `pnpm run lint` | prettier and eslint clean |
| `pnpm run build` | succeeded |
| `git diff --exit-code a3f91c9 -- package.json pnpm-lock.yaml playwright.config.ts .github/workflows/ci.yml` | exit 0 (no dependency added, no limit moved) |
| skip/only/fixme markers in `tests/e2e` | 0 |
| `playwright test --list` | Total: 252 tests in 25 files |

E2E runs used a throwaway config outside the repo (`pw.config.ts` in the session scratchpad: the installed Chromium does not match the pinned Playwright, so it sets `executablePath` and `--no-sandbox`). Nothing in the repo was changed for it.

## Task Commits

1. **Task 1: Reconcile the CI budget** - `4d79cbe` (test)
2. **Task 2: Spec-tree guards and the full-suite gate** - `83aa5ab` (test)

## Deviations from Plan

None in the code. The gate surfaced nothing to fix, so no spec or source was edited under Task 2.

### Process note (not a deviation in the product)

My first full-suite attempt ran `pnpm run test:unit` while the background Playwright run was in flight. `webserver-teardown.test.ts` starts the real `webServer.command` and its `afterEach` SIGKILLs whatever holds port 4173, so it killed the Playwright preview server; every test after that point failed (login-history, login-map and later) and one unit worker was SIGKILLed. That was my own collision, not a product failure. I aborted the run, confirmed nothing was left on port 4173, and reran everything sequentially. The reported numbers are all from the clean sequential runs. Anyone running the gate locally should not run the unit suite concurrently with Playwright.

## Known Stubs

None.

## Threat Flags

None. T-08-49 (CI timeout drift), T-08-50 (silent skips), T-08-51 (zero-network, 5 tests green) and T-08-SC (manifest diff exit 0) are mitigated as planned.

## Issues Encountered

The plan's human-check (walk the built app at 1280 / 800 / 375px with mouse and keyboard) was not performed by this executor. It is judged by eye and is left for `/gsd-verify-work` (coverage entry D4).

## Next Phase Readiness

Plan 08-19 is the last plan of Phase 8. Ready for phase verification.

## Self-Check: PASSED

- FOUND: tests/unit/guards/ci-budget.test.ts, tests/unit/guards/phase8-shell-guards.test.ts
- FOUND commits: 4d79cbe, 83aa5ab
- All acceptance criteria re-run: listed total 252 (at most 258); config and ci.yml diff exit 0; skip/only/fixme count 0; package.json and lockfile diff exit 0; both unit guard files pass.
