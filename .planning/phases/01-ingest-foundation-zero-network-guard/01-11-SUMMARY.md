---
phase: 01-ingest-foundation-zero-network-guard
plan: 11
subsystem: worker-ingest
tags: [classify, account-root, fail-closed, privacy, tdd, gap-closure, cr-01]

# Dependency graph
requires:
  - phase: 01-ingest-foundation-zero-network-guard
    provides: "01-07 rootless-first resolveAccountRootAndCategories(), whose priority inversion opened the CR-01 / W-1 hole this plan closes"
provides:
  - "CR-01 layer 1 closed: an unknown top-level folder that holds a recognized category within MAX_WRAPPER_DEPTH directory levels makes the importer fail closed with the new reason 'ambiguous-root' instead of filing the real account folder as an unknown category"
  - "The same ambiguity read covers the transparent-wrapper strategy (personal_data_export/...), where the resolved root would be ''"
  - "buildAmbiguousRootExport(): the review's three-path repro as pinned-zip bytes, shared by the worker test and the unit test"
  - "Worker-level proof: the repro posts 'error', leaves zero rows, no active meta record and no email domain in IndexedDB"
affects: [01-13 header-keyed column strip (layer 2), 01-15 real-export check, worker-ingest, classify]

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 4450
  tasks: 2
  commits: 4

plan_head_before: 43d61c6d8ff00d784adb76aa7bdd9d97d29d9d79
plan_head_after: ea86833e5a101452177d57bf4ca3e0397b81efbd
commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed ambiguity read: where the resolver is about to claim 'there is no account folder' (resolved root ''), it first checks whether an unknown sibling folder could itself be the account root, and refuses to guess"
    - "Three-outcome private resolver (resolved | ambiguous | null) so a named reason is truthful for every shape that raises it, instead of being re-derived by the legacy naming chain"

key-files:
  created: []
  modified:
    - src/lib/worker/classify.ts
    - tests/fixtures/export-fixtures.ts
    - tests/unit/import/ingest-worker.test.ts
    - tests/unit/import/classify.test.ts

key-decisions:
  - "The ambiguity predicate is a single linear pass over the prepared path list (prefix, prepared) rather than one pass per unknown top-level name as the plan text sketched. Same semantics, but the cost no longer multiplies by the number of distinct unknown folders (T-01-43 stays a true linear bound for an adversarial archive)."
  - "The ambiguity read is applied only where the resolved root would be '' (Strategy 1, and Strategy 2 when the settled display root is the transparent wrapper). A real account root is never examined, so real exports with nested category-named data are not rejected (T-01-45, pinned as the residual that plan 01-13 closes)."
  - "'ambiguous-root' is a classify.ts-internal reason (additive union member); worker-messages.ts and ingest.worker.ts are untouched. It reaches the UI only as the existing generic banner (D-04/D-05/D-07)."

patterns-established:
  - "Red-then-green is committed as two commits per task: the failing test first (recorded failing line), then the minimal fix"
  - "Invariant tests that must hold before and after sit in the same describe as the fail-first targets"

requirements-completed: [IMPORT-02, IMPORT-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The review's three-path repro (123/User_Info, 123/Activity_history, Clans) fails closed with 'ambiguous-root' and nothing reaches storage through the real worker"
    requirement: "IMPORT-02"
    verification:
      - kind: integration
        ref: "tests/unit/import/ingest-worker.test.ts#01-11 - CR-01: (a) the review repro posts \"error\", persists nothing and leaves no email in IndexedDB"
        status: pass
    human_judgment: false
  - id: D2
    description: "Transparent-wrapper, nested, depth-boundary, directory-entry and case variants fail closed with 'ambiguous-root'"
    requirement: "IMPORT-02"
    verification:
      - kind: unit
        ref: "tests/unit/import/classify.test.ts#analyzeExport - ambiguous root fails closed (CR-01 / W-1, plan 01-11)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plan 01-07's accepted shapes, every pre-existing failure reason, RESEARCH Pitfall 1 and the real-root residual classify exactly as before"
    requirement: "IMPORT-05"
    verification:
      - kind: unit
        ref: "tests/unit/import (17 files, 378 tests) + tests/unit/guards"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-10-10
status: complete
---

# Phase 01 Plan 11: Ambiguous root fails closed (CR-01 layer 1) Summary

**The rootless read in `classify.ts` now refuses to guess when an unknown top-level folder holds a recognized category beneath it, so a real account folder beside a stray `Clans/` returns `ambiguous-root` instead of being filed as an unknown category whose `User_Info` bypasses the LOGIN/birth-date strip.**

## Performance

- **Duration:** about 14 min
- **Tasks:** 2 (Task 1 tracer, Task 2 auto; both TDD)
- **Commits:** 4 (RED, GREEN per task)
- **Files modified:** 4 (1 source, 3 test/fixture)

## Accomplishments

- CR-01 / W-1 reproduced end to end through the real worker (terminal `done`, a row persisted under category `'123'`), then closed: terminal `error`, zero rows, no `active` meta, no email domain in the persisted dump.
- `UnrecognizedReason` gains `'ambiguous-root'`; `resolveAccountRootAndCategories` returns `resolved | ambiguous | null` and `analyzeExport` maps the ambiguity directly, before the legacy `detectRoot` / `categoryFoldersUnder` naming chain.
- The transparent-wrapper case (`personal_data_export/Activity_history/a.csv` + `personal_data_export/123/User_Info/x.csv`) was a second live hole: it classified ok with `accountRoot ''` and `123` as unknown. It now fails closed as well.
- 14-test unit describe pins the fail-closed shapes, the depth-4 / depth-5 boundary, the invariants that must not move and the real-root residual.

## Red-then-green evidence

Task 1 (worker test, `-t "01-11"`):

- RED (unmodified classify.ts), commit `5ca992e`:
  `FAIL ... > 01-11 - CR-01: an ambiguous root fails closed through the real worker > (a) the review repro posts "error", persists nothing and leaves no email in IndexedDB` - `AssertionError: expected 'done' to be 'error'` - `Tests 1 failed | 57 skipped (58)`
- GREEN (after the classify.ts edit), commit `337d8c3`:
  `Test Files 1 passed (1)` - `Tests 1 passed | 57 skipped (58)`

Task 2 (unit matrix):

- RED, commit `ddbd5b6`: `classify.test.ts (67 tests | 7 failed)`. Repro and fixture bytes returned `no-single-root` (reason not yet named); the transparent-wrapper shape returned `ok` with `accountRoot ""` (live hole); the 7 invariant guards passed.
- GREEN, commit `ea86833`: `pnpm exec vitest run tests/unit/import` -> 17 files, 378 tests passed; with `tests/unit/guards` -> 31 files, 632 tests passed.

## Task Commits

1. **Task 1 RED** - `5ca992e` `test(01-11): RED - ambiguous-root repro through the real worker`
2. **Task 1 GREEN** - `337d8c3` `fix(01-11): fail closed when an unknown top-level folder holds a recognized category` (also carries the pre-existing T-01-18 -> T-01-32 comment-only renumber, as intended)
3. **Task 2 RED** - `ddbd5b6` `test(01-11): RED - ambiguous-root unit matrix`
4. **Task 2 GREEN** - `ea86833` `fix(01-11): named ambiguous-root reason, transparent-wrapper case, three-outcome resolver`

## Verification

- `pnpm exec vitest run tests/unit/import tests/unit/guards` - 31 files, 632 tests passed.
- `pnpm run lint` - exit 0 (prettier --check and eslint).
- `pnpm run check` - exit 0 (`tsc -b`, svelte-check 0 errors 0 warnings).
- Task 1 node one-liner printed `ok` (repro rejected; wrapper-around-account `1234567`, rootless `''`, transparent wrapper `''` unchanged).
- `git diff --stat -- src/lib/worker/ingest.worker.ts src/lib/core/types/worker-messages.ts` is empty.
- `grep -c "ambiguous-root"`: classify.ts 5, classify.test.ts 8. Exported signatures of detectRoot, categoryFoldersUnder, analyzeExport, classifyExport, resolveCsvFileCategory and sortCategoryEntries unchanged. `git diff 43d61c6 -- tests/unit/import/classify.test.ts` is additions only (160/0).
- Full-suite and e2e runs are owned by plan 01-15 and were not run.

## Deviations from Plan

### Auto-fixed Issues

None needing a Rule 1-4 fix. Two implementation-level departures, both within the plan's intent:

**1. Single-pass predicate instead of per-name scans**
- **Found during:** Task 1, step 4
- **Issue:** The plan sketched a helper taking `(prefix, name, prepared)` and called "for ANY key of counts0", which is one scan of the path list per unknown top-level name (O(unknown names x paths)).
- **Change:** `unknownFolderHoldsRecognized(prefix, prepared)` walks the path list once and applies the same rule (first segment unknown, recognized within the first `MAX_WRAPPER_DEPTH` directory segments after dropping the filename). Semantics are identical; the T-01-43 linear bound now holds regardless of how many unknown folders an archive contains.
- **Files modified:** src/lib/worker/classify.ts
- **Commit:** 337d8c3

**2. Task 2 literals inline the reason**
- The unit describe initially used a shared `AMBIGUOUS` constant; it was inlined as `{ ok: false, reason: 'ambiguous-root' }` so each shape reads on its own and the plan's `grep -c "ambiguous-root" >= 5` acceptance criterion is met literally. Commit ea86833.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change. T-01-42 (mitigated), T-01-43 (mitigated, single-pass), T-01-44 (accepted, plan 01-15 confirms with the real export), T-01-45 (accepted, residual pinned in a test and carried by plan 01-13).

## Residual (hand-off to plan 01-13)

`123/Activity_history/a.csv` + `123/Weird/User_Info/Account_Info.csv` still classifies ok with `accountRoot '123'` (Weird unknown), and a recognized folder nested deeper than `MAX_WRAPPER_DEPTH` is not examined. In both, the User_Info CSV is parsed under a category whose name is not User_Info, so only the header-keyed strip of plan 01-13 prevents LOGIN / birth columns from persisting. The pin test is `residual (T-01-45)` in classify.test.ts.

## Self-Check: PASSED

- FOUND: src/lib/worker/classify.ts, tests/fixtures/export-fixtures.ts (`buildAmbiguousRootExport`), tests/unit/import/ingest-worker.test.ts, tests/unit/import/classify.test.ts
- FOUND commits (ancestors of HEAD): 5ca992e, 337d8c3, ddbd5b6, ea86833
- STATE.md untouched; ROADMAP.md not updated by this agent (orchestrator owns it).
