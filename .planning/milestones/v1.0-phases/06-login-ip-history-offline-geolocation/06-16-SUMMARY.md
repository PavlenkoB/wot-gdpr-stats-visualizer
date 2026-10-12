---
phase: 06-login-ip-history-offline-geolocation
plan: 16
subsystem: typecheck-gate
tags: [svelte-check, ci, typecheck, gap-closure, tdd, wr-05]
status: complete
gap_closure: true
gap_ids: [WR-05]

requires:
  - phase: 06-login-ip-history-offline-geolocation
    provides: "LoginHistory.svelte (06-08), the Phase 5 PlayerStats.svelte, the CI typecheck step"
provides:
  - "svelte-check reports 0 errors and 0 warnings on the real tree, with the three defects fixed in code"
  - "pnpm run check = tsc -b && svelte-check --tsconfig ./tsconfig.app.json --threshold warning"
  - "tests/unit/guards/typecheck-gate.test.ts: a self-tested guard that keeps svelte-check in the script, the devDependencies and the CI typecheck step"
affects: [ACTIVITY-05]

requirements-completed: [ACTIVITY-05]

actuals:
  tokens: 2500
  tasks: 2
  commits: 3

# Measured, never narrated (#3968). Base is HEAD before the first task commit.
plan_head_before: c658a641c14f17bcb6b5f6c4e6187fcf89c5071c
plan_head_after: 1f83ed9502c7aa6b131e2cd25ba6f4b978fa65d4
commits: 3
commits_note: "3 measured by `git rev-list --count c658a64..HEAD` at SUMMARY write time: the Task 1 fix, the Task 2 RED test and the Task 2 GREEN fix. tokens is chars/4 over the added lines (10,008 chars) of src, tests, package.json, ci.yml and README."

tech-stack:
  added: []
  patterns:
    - "a gate guard is a pure function of the file texts, proven on inline bad inputs as well as on the real files"
    - "string-keyed label widening (as Record<string, string>) for a frozen copy object indexed by a plain string key"

key-files:
  created:
    - "tests/unit/guards/typecheck-gate.test.ts"
  modified:
    - "src/lib/features/logins/LoginHistory.svelte"
    - "src/lib/features/vehicles/PlayerStats.svelte"
    - "package.json"
    - ".github/workflows/ci.yml"
    - "README.md"

key-decisions:
  - "svelte-check is inside the check script rather than a second CI step, so the existing single Typecheck step covers it and local pnpm run check cannot disagree with CI."
  - "--threshold warning keeps warnings visible but does not make them fail the gate; a stricter gate is a separate decision."
  - "The PlayerStats roll-back is narrowed with a real null test on wantedImportedAt, and the picker label goes through a columnLabel helper using the widening headerLabel already uses; no suppression, no non-null assertion, ui-copy.ts untouched."

duration: 12min
completed: 2026-10-04
---

# Phase 6 Plan 16: Typecheck gate that can see .svelte files Summary

`pnpm run check` now runs `svelte-check` after `tsc -b`, the three errors that hid behind the old green check are fixed in the code, and a self-tested guard fails if the script, the devDependency or the CI step regresses.

## Baseline (the failing regression)

`pnpm exec svelte-check --tsconfig ./tsconfig.app.json --threshold warning` before any edit: exactly three errors, `COMPLETED 299 FILES 3 ERRORS 0 WARNINGS 2 FILES_WITH_PROBLEMS`:

- `LoginHistory.svelte` 4:33: module `core/types/worker-messages.ts` declares `LoginsView` locally, but it is not exported.
- `PlayerStats.svelte` 156:9: `VehicleAsk | { importedAt: string | null; ... }` not assignable to `VehicleAsk | null` (importedAt `string | null` vs `string`).
- `PlayerStats.svelte` 757:24: a plain `string` cannot index the frozen `VEHICLE_COLUMN_LABELS` object.

After Task 1: `COMPLETED 299 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS`.

## Tasks

1. **Task 1 (tracer), 6846a54 `fix(06-16)`**: `LoginsView` is imported type-only from `./login-shared.ts`; the roll-back branch gains `wantedImportedAt !== null`; the picker prints `columnLabel(column.key)`. Runtime behaviour is unchanged for every dataset `load` can issue.
2. **Task 2 RED, 23e6fb8 `test(06-16)`**: `typecheck-gate.test.ts` with 11 tests. Failing before the script change: `06-16 (WR-05): a .svelte type error cannot hide behind a green check > the real package.json and the real workflow have no problem`. The ten bad-input self-tests passed (they feed inline strings, so they are independent of the real files).
3. **Task 2 GREEN, 1f83ed9 `fix(06-16)`**: script changed to `tsc -b && svelte-check --tsconfig ./tsconfig.app.json --threshold warning`; CI step renamed `Typecheck (tsc -b and svelte-check)` (still `run: pnpm run check`) with a comment explaining why; README line updated.

## Verification

- `pnpm run check`: exit 0 (tsc -b and svelte-check both clean). `pnpm run lint`: clean.
- `pnpm run test:unit`: 77 files, 2331 tests passed. ci-budget, geo-seam and build-scripts guards pass unmodified; vehicle-blocks and login-blocks pass unmodified.
- Local smoke, no test added: `pnpm exec playwright test tests/e2e/vehicles tests/e2e/logins`: 60 passed (1.1 min).
- No suppression directive added in `src` (`@ts-`, `svelte-ignore`, `eslint-disable`); `src/lib/ui-copy.ts` and `src/lib/features/playtime` unchanged; the diff of `ci.yml` touches no `timeout`, `node-version` or `test:unit` line.
- svelte-check wall time on its own: about 8.0 s (11.5 s user, incremental caches warm), well inside the CI five-minute pre-e2e budget.

## Deviations from Plan

None - plan executed exactly as written. The tdd-red-evidence tool was not used (per the plan); the failing test name is recorded above and in the RED commit body. `windows append` was not attempted (the plan states WINDOWS.md rows 8-9 are corrupt).

## Known Stubs

None.

## Threat Flags

None. No new network surface, auth path or file access.

## Self-Check: PASSED

- FOUND: tests/unit/guards/typecheck-gate.test.ts
- FOUND commits: 6846a54, 23e6fb8, 1f83ed9
