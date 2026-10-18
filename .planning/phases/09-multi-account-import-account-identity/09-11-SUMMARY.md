---
phase: 09-multi-account-import-account-identity
plan: 11
subsystem: ui
tags: [multi-account, root-count, identity-header, worker-messages, ui-spec, gap-closure]

# Dependency graph
requires:
  - phase: 09-multi-account-import-account-identity
    provides: "09-06's header variants and long-text step, 09-10's published account list (accounts that hold data) and the data-less fixtures"
provides:
  - "ClassifyResult.rootCount - the account folders the archive held, distinct from accounts.length, set by the import and by resultFromMeta, never persisted"
  - "rootCountOf and hasMultipleRoots - the one predicate every variant decision asks; accountCountOf keeps meaning 'accounts that hold data'"
  - "formatAccountCount singular branch ('1 account'); zero stays plural"
  - "A browser step inside the existing lifecycle test for the one-data-less-of-two archive, fresh and after reload"
  - "A dated 09-UI-SPEC amendment: which roots each count describes"
affects: [10-per-account, phase-9-reverification]

actuals:
  tokens: 7740
  tasks: 3
  commits: 6
plan_head_before: 1a6a433156e1afaaf358e11665ed40099a99f58d
plan_head_after: c0f88031bfafc306a104cd38936ba30b8713a8cb

tech-stack:
  added: []
  patterns:
    - "Two numbers with two names: the folder count decides a variant, the published count decides a title or caption"
    - "A derived integer rides beside a published list from every producer (import, duplicate, cache-status) and is never stored"
    - "A browser proof folded into an existing priced test as a test.step, so the listed e2e count cannot move"

key-files:
  created: []
  modified:
    - src/lib/core/types/worker-messages.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/shell/identity-model.ts
    - src/lib/shell/IdentityHeader.svelte
    - src/lib/shell/selection-state.ts
    - src/lib/shell/overview-model.ts
    - src/lib/ui-copy.ts
    - tests/unit/import/multi-account-import.test.ts
    - tests/unit/shell/identity-model.test.ts
    - tests/unit/shell/overview-model.test.ts
    - tests/unit/shell/ui-copy.test.ts
    - tests/e2e/shell/multi-account.spec.ts
    - .planning/phases/09-multi-account-import-account-identity/09-UI-SPEC.md

key-decisions:
  - "rootCount is derived at publish time from the stored account list at both producers; no Dexie version, stored field or upgrader change (ACCOUNT-03)"
  - "An absent rootCount falls back to the published count (the greatest of 1, rootCount, accounts.length), so a pre-09-11 cache and every hand-built fixture render as before (D-22)"
  - "accountCountOf answers 0 (not 1) for an empty published list only when the archive held several folders"
  - "The Account-record gate (ordered.length === 1) and hasData were not edited; the gate still counts every root (T-09-32/T-09-35)"

patterns-established:
  - "hasMultipleRoots decides wording and variant; accountCountOf decides every number shown"

requirements-completed: [ACCOUNT-03, ACCOUNT-05, ACCOUNT-08]

duration: ~10min
completed: 2026-10-18
status: complete
---

# Phase 9 Plan 11: Root count for the multi header Summary

**`ClassifyResult.rootCount` plus one `hasMultipleRoots` predicate: an archive of two folders with one data-less folder keeps the multi header ('1 account', one row, no region or creation date) in the header, the Account list row and the Overview card, fresh and after reload.**

## Performance

- **Tasks:** 3 of 3
- **Files modified:** 13 (no new file, no new fixture, no dependency)

## Accomplishments

- Closed VERIFICATION Truth 21: the header, the Account list row and the Overview Account card decide their variant from the archive's folder count, so the first folder's legacy `identity` is never presented as the export's.
- Title, rows and captions still count only the accounts that hold data (09-10 option-a): that archive titles '1 account', lists one row and shows no combined caption.
- `done`, `duplicate` and `cache-status` publish the same `rootCount` (worker-boundary cases for one-of-two, three-with-a-data-less-folder, all-hold-data and one-folder archives).
- UI-SPEC amended (11 spots tagged 'plan 09-11'): Surface 1, 2, 3, the Copywriting Contract (singular and zero rows plus 'Which roots each count describes' with the two-row table and five-row matrix) and the UI Considerations table; the stale zero-count assertion is gone.

## Task Commits

1. Task 1 RED: `1bef065` test(09-11) - root count and header-wiring cases
2. Task 1 GREEN: `3418b98` fix(09-11) - rootCount on both producers, predicate, header switch
3. Task 2 RED: `762a6c8` test(09-11) - row, card and singular title cases
4. Task 2 GREEN: `7b81999` fix(09-11) - row and card follow the folder count; '1 account'
5. Task 3 browser step: `076b54c` test(09-11) - step inside the lifecycle test
6. Task 3 spec amendment: `c0f8803` docs(09-11) - UI-SPEC amendment

## Verification

| Check | Result |
|-------|--------|
| `pnpm run check` | 0 errors, 0 warnings |
| `pnpm run lint` | clean (prettier + eslint) |
| `pnpm run test:unit` | 96 files, 3156 tests passed |
| `playwright test tests/e2e/shell/multi-account.spec.ts` | 2 passed |
| `playwright test --list` | Total: 258 tests in 28 files |
| `ci-budget.test.ts`, `db.test.ts` | pass (Dexie `version(2)` pinned) |
| `git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml src/lib/import` | exit 0 |
| `grep isMultiAccount src tests` | no match |
| `ordered.length === 1` gate (non-comment lines) | 1, unchanged |
| `selection-state.test.ts`, `Dashboard.svelte`, `DashboardSection.svelte` vs 27a7f20 | unchanged |

**Teeth check:** with the header's variant derivation temporarily switched back to the published count (`(result.accounts?.length ?? 1) >= 2`), the lifecycle test failed on the new step: `one of two, fresh import: the multi variant` expected `multi`, received `loaded`. The file was restored with `git checkout -- src/lib/shell/IdentityHeader.svelte` and `git diff --exit-code -- src` was clean afterwards.

## Deviations from Plan

None - plan executed as written. Notes that are not deviations: the `duplicate` replay case needs `post.mockClear()` before the re-drop (the shared harness otherwise returns the first import's `done`), the same harness behaviour 09-10 recorded; the `test:unit` full run was used in place of the per-task vitest invocations where noted by the plan.

## Known Stubs

None.

## Threat Flags

None. `rootCount` is an integer; no row cell, identity or folder name rides on it (T-09-34). The Account-record gate is untouched (T-09-35). No package, Dexie version or stored field added (T-09-SC).

## Issues Encountered

- Running `graphify update .` rewrites tracked `graphify-out/` files; the changes were discarded so the tree holds only this plan's work.
- The full e2e suite was not run in this plan (the multi-account spec, the listed count and the budget guard were, per the plan's verify blocks).

## Self-Check: PASSED

Verified: all 13 modified files exist; commits 1bef065, 3418b98, 762a6c8, 7b81999, 076b54c and c0f8803 are ancestors of HEAD; `git rev-list --count 1a6a433..c0f8803` is 6.
