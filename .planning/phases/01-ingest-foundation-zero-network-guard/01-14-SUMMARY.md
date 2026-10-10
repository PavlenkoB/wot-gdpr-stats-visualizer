---
phase: 01-ingest-foundation-zero-network-guard
plan: 14
subsystem: worker-ingest
tags: [zip-bomb, inflate-bound, declared-size-cap, security, tdd, gap-closure, wr-03]

# Dependency graph
requires:
  - phase: 01-ingest-foundation-zero-network-guard
    provides: "01-13 header-keyed strip at the row choke point; the worker's single try/catch error path (D-04, D-05, D-07)"
provides:
  - "WR-03 / W-2 closed: unzipSync in handleIngest can no longer be asked to allocate more than 128 MiB for one entry or 512 MiB for the selected entries together, decided from the central directory's declared sizes before fflate allocates"
  - "src/lib/worker/inflate-bounds.ts: MAX_ENTRY_BYTES, MAX_TOTAL_BYTES and the pure, injectable createInflateFilter(accepts, limits?)"
  - "buildOversizedEntryExport(claimedBytes) test fixture: the sample with one stored entry whose central-directory size is patched"
  - "zip-paths.ts documentation that states only what the code does"
affects: [01-15 real-export check and e2e privacy spec, worker-ingest]

# Actuals (#2632) - pairs with the plan's `estimate`; chars/4 over the realized diff (18,925 chars of added and removed lines under src and tests).
actuals:
  tokens: 4731
  tasks: 2
  commits: 3

plan_head_before: 4360cc6e22a1769387870b2944d9cedacdd77b9a
plan_head_after: 081a8b108e6c9c2de52b3f03807a49550c2c8174
commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Refuse in the filter: the declared size is read from the same central-directory record fflate allocates from, and the filter runs first, so a throw there refuses the allocation itself"
    - "Pure cap logic with injected limits, wiring proved by one patched-header archive instead of a large fixture"

key-files:
  created:
    - src/lib/worker/inflate-bounds.ts
    - tests/unit/import/inflate-bounds.test.ts
  modified:
    - src/lib/worker/ingest.worker.ts
    - src/lib/worker/zip-paths.ts
    - tests/fixtures/export-fixtures.ts
    - tests/unit/import/ingest-worker.test.ts

key-decisions:
  - "Limits are 128 MiB per entry and 512 MiB in total (plan's discretionary choice, review sketched 256 MiB / 1 GiB): about 28x the largest legitimate entry measured (the 60,000-session CSV, 4,712,563 B) and about 89x the largest legitimate export (6,011,300 B). Both live in one module; reversible by editing two constants."
  - "The cap is on the DECLARED size only. A stream that declares small and inflates large cannot outgrow its claim: unzipSync hands the inflater a buffer of exactly the declared size and fflate does not resize a caller-supplied buffer (probed, see Deviations note)."
  - "The two thrown messages are fixed strings; the worker's existing catch turns them into the detail 'Error: entry too large' / 'Error: archive too large'. No name, path or size reaches the boundary (T-01-53)."

patterns-established:
  - "Mutation checks recorded as evidence for a unit matrix written after its implementation"

requirements-completed: [IMPORT-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "An archive whose central directory declares one stored CSV entry above MAX_ENTRY_BYTES is rejected through the real worker: terminal 'error', detail contains 'entry too large' and not the entry name, zero rows and no active meta"
    requirement: "IMPORT-05"
    verification:
      - kind: integration
        ref: "tests/unit/import/ingest-worker.test.ts#01-14 - WR-03: (a) an entry declaring more than MAX_ENTRY_BYTES posts 'error' with a fixed detail and persists nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "createInflateFilter: per-entry cap, running total cap, rejected names neither inflated nor counted, NaN / Infinity / negative sizes rejected, fixed messages with no name or digit, independent totals per instance, default limits sit far above the scale fixtures"
    requirement: "IMPORT-05"
    verification:
      - kind: unit
        ref: "tests/unit/import/inflate-bounds.test.ts (15 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Existing imports (sample, scale, 60,000-session, logins, playtime) pass through the new filter unchanged; lint and typecheck green"
    requirement: "IMPORT-05"
    verification:
      - kind: unit
        ref: "pnpm run test:unit (87 files, 2704 tests), pnpm run lint, pnpm run check"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-10-10
status: complete
---

# Phase 01 Plan 14: Bounded inflate for selected entries (WR-03) Summary

**`handleIngest` now passes `unzipSync` a stateful filter that throws a fixed-message error when a selected entry declares more than 128 MiB, or the selected entries together declare more than 512 MiB, so a few kilobytes of crafted central directory can no longer make the worker allocate gigabytes.**

## Performance

- **Duration:** about 15 min
- **Tasks:** 2 (Task 1 tracer, Task 2 auto; both TDD)
- **Commits:** 3 (RED, GREEN, tests plus documentation)
- **Files:** 6 (1 new source module, 2 edited source files, 1 new test file, 2 edited test/fixture files)

## Accomplishments

- `inflate-bounds.ts`: `MAX_ENTRY_BYTES` (128 MiB), `MAX_TOTAL_BYTES` (512 MiB) and `createInflateFilter(accepts, limits?)`. A name `accepts` rejects returns `false` with no accounting; an accepted name throws `entry too large` for a declared size that is over the limit, negative, `NaN` or infinite, adds to a closure total, and throws `archive too large` when the total passes its limit. No fflate import, no worker global.
- `ingest.worker.ts`: the inline `resolveCsvFileCategory` filter is replaced by `createInflateFilter` wrapping the same test with the same arguments. One filter is created per `handleIngest` call, so totals never leak between imports. The catch block, message shapes and stage messages are untouched; `worker-messages.ts` is not modified (`git diff --stat 4360cc6 HEAD -- src/lib/core/types/worker-messages.ts` is empty), so D-09 holds.
- `buildOversizedEntryExport(claimedBytes)`: the sample archive with `Activity_history/Sessions.csv` stored (`level: 0`) and the central-directory uncompressed-size u32 patched. It throws loudly if the entry, its header or the stored method is missing, or if the patched value does not read back. Built through the pinned `zipSync`.
- `zip-paths.ts`: the docblock sentence that claimed zip-bomb immunity for the pipeline is replaced by a statement that the enumeration never inflates and that inflation of the selected entries is bounded by `createInflateFilter`. Comment lines only; the function body and the always-false filter are unchanged.

## Red-then-green evidence (TDD)

Task 1 (worker test, `pnpm exec vitest run tests/unit/import/ingest-worker.test.ts -t "01-14"`):

- RED (worker without a cap), commit `e73a642`:
  `AssertionError: expected 'done' to be 'error'` - `Tests  1 failed | 61 skipped (62)`.
  Semantic assessment: the terminal was `done`, so the failure is the planned premise ("the stored entry is accepted because nothing checks its declared size"), not an import, fixture or setup fault. The patched entry is stored, so the red run allocated nothing.
- GREEN (after `createInflateFilter` and the call-site change), commit `5598ad8`:
  `Test Files  1 passed (1)` - `Tests  1 passed | 61 skipped (62)`.
  Companion run: `pnpm exec vitest run tests/unit/guards tests/unit/import/zip-paths.test.ts` -> `Test Files  15 passed (15)`, `Tests  261 passed (261)` (lint guards, fixture pin and zip-paths all green).
- Tracer gate: `AUTO_CFG` false, `<verify>` automated-only, so both verify commands were re-run end to end after GREEN and passed before Task 2 began.

Task 2 (commit `081a8b1`): the unit matrix exercises `createInflateFilter`, which the Task 1 GREEN commit had already shipped, so it passes on first run by construction (the same situation 01-13 recorded). No RED was manufactured; non-vacuity is instead evidenced by two mutation checks, each reverted with a single-file `git checkout`:

1. Count rejected names toward the total (`total += info.originalSize` before `return false`): `a rejected name adds nothing to the total` fails; `Tests  1 failed | 14 passed (15)`.
2. Drop the finite / non-negative guard (keep only `size > maxEntryBytes`): the `NaN` and negative-size cases fail; `Tests  2 failed | 13 passed (15)`.

After both, `git status` showed no change to `inflate-bounds.ts`.

## Test counts

- Before this plan (HEAD `4360cc6`, per the 01-13 SUMMARY): 86 files, 2688 tests.
- After: `pnpm run test:unit` -> 87 files, 2704 tests (+16: 1 worker-level, 15 pure-function cases).

## Task Commits

1. **Task 1 RED** - `e73a642` `test(01-14): RED - an over-declared stored entry is accepted by the worker with no size cap`
2. **Task 1 GREEN** - `5598ad8` `fix(01-14): bound inflation by the central directory's declared sizes (WR-03)`
3. **Task 2** - `081a8b1` `test(01-14): pin the declared-size caps with a pure matrix and correct the zip-paths docblock`

## Verification

- `pnpm run test:unit` - exit 0, 87 files, 2704 tests passed (includes the 60,000-session scale import, the logins and playtime paths and the existing import tests, unchanged).
- `pnpm run lint` - exit 0 (prettier --check and eslint).
- `pnpm run check` - exit 0 (`tsc -b`, svelte-check 0 errors 0 warnings).
- `grep -c "createInflateFilter" src/lib/worker/ingest.worker.ts` = 2 (import and call); the inline `filter(info)` block is gone.
- `grep -c "from 'fflate'" src/lib/worker/inflate-bounds.ts` = 0.
- `grep -n "bounded by the archive's central directory" src/lib/worker/zip-paths.ts` prints nothing; the `zip-paths.ts` diff is comment lines only.
- `git diff --stat 4360cc6 HEAD -- src/lib/core/types/worker-messages.ts` is empty.
- No Playwright spec added or changed.

## Deviations from Plan

### Auto-fixed Issues

None needing a Rule 1-4 fix.

### Process notes

**1. RED commit carries the constants-only `inflate-bounds.ts`.** The plan has the Task 1 test import `MAX_ENTRY_BYTES` from `inflate-bounds.ts` (action 2) but creates that module after the red run (action 4). Run in that order the test file cannot be loaded, which would be a collection error and not the planned `'done'` terminal. The RED commit therefore contains the two constants only; `createInflateFilter` and the worker wiring arrive in the GREEN commit. The plan's required red result (`terminal 'done'`) was observed as written.

**2. Task 2 tests had no RED phase** (see the TDD evidence above; mutation checks in its place).

**3. A claim in the plan's rationale was checked rather than assumed.** The doc comment in `inflate-bounds.ts` initially described the "declares small, inflates large" direction as something fflate rejects. A probe against the pinned fflate (a deflated 100,000-byte entry with its central-directory size patched to 10) showed fflate silently returns the first 10 bytes: it neither throws nor grows the buffer. The comment was corrected to say the output is cut off at the declared size, which is what makes a declared-size cap a sufficient allocation bound. The silent truncation itself is pre-existing fflate behaviour outside WR-03 and is not changed here.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change. T-01-52 mitigated (declared-size caps in the filter, proven through the real worker from zip bytes to an empty database); T-01-53 mitigated (fixed messages, asserted to contain neither the entry name nor any digit); T-01-54 accepted (caps are about 28x and 89x the largest legitimate sizes, pinned by a defaults-versus-fixture assertion); T-01-SC no packages installed.

## Deferred

A limit on the number of entries or on decoded row counts is not in WR-03; `MAX_PRESENCE_FILES` already bounds the stored per-file facts, and the declared-size caps are the allocation bound the review asked for.

## Self-Check: PASSED

- FOUND: src/lib/worker/inflate-bounds.ts, src/lib/worker/ingest.worker.ts, src/lib/worker/zip-paths.ts, tests/fixtures/export-fixtures.ts (`buildOversizedEntryExport`), tests/unit/import/inflate-bounds.test.ts, tests/unit/import/ingest-worker.test.ts
- FOUND commits (ancestors of HEAD): e73a642, 5598ad8, 081a8b1
- STATE.md and ROADMAP.md untouched; `roadmap update-plan-progress` and `requirements mark-complete` not run (orchestrator owns tracking).
