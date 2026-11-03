---
phase: 09-multi-account-import-account-identity
verified: 2026-10-21T18:25:23Z
status: passed
score: 21/21 must-haves verified
behavior_unverified: 0
overrides_applied: 1
covered_files:
  - .planning/phases/09-multi-account-import-account-identity/09-01-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-01-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-02-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-02-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-03-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-03-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-04-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-04-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-05-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-05-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-06-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-06-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-07-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-07-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-08-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-08-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-09-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-09-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-10-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-10-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-11-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-11-SUMMARY.md
  - src/lib/core/types/worker-messages.ts
  - src/lib/shell/IdentityHeader.svelte
  - src/lib/shell/identity-model.ts
  - src/lib/shell/overview-model.ts
  - src/lib/shell/selection-state.ts
  - src/lib/ui-copy.ts
  - src/lib/worker/account-summary.ts
  - src/lib/worker/classify.ts
  - src/lib/worker/csv-columns.ts
  - src/lib/worker/data-queries.ts
  - src/lib/worker/db.ts
  - src/lib/worker/ingest.worker.ts
  - tests/e2e/guards/zero-network.spec.ts
  - tests/e2e/import/import-failure.spec.ts
  - tests/e2e/shell/multi-account.spec.ts
  - tests/fixtures/multi-account-fixtures.ts
  - tests/unit/import/multi-account-import.test.ts
  - tests/unit/shell/identity-model.test.ts
  - tests/unit/shell/overview-model.test.ts
  - tests/unit/shell/ui-copy.test.ts
covered_digest: "v3:sha256:f0e348aa0eb73809d2f834b92be424fd0e371c73d84a047d3809fb76c5da1fef"
overrides:
  - must_have: "The 375px multi-account header keeps a 40-char nickname and 20-digit ID readable (verification: backstop)"
    reason: "Waived by the user on 2026-10-18; e2e proves no overflow and full text present. Subsequently human-checked and passed in 09-UAT.md test 4 (6/6 passed, 2026-10-21)."
    accepted_by: "user"
    accepted_at: "2026-10-18T00:00:00Z"
re_verification:
  previous_status: passed
  previous_score: 21/21
  gaps_closed: []
  gaps_remaining: []
  regressions: []
gaps: []
deferred:
  - truth: "Per-account slicing of the merged panes, merging vehicles by id rather than by row, finance totals per currency"
    addressed_in: "Phase 10"
    evidence: "Roadmap Phase 10 goal: 'Playtime, finance, vehicles and login history read as one combined history, with a game filter, no double-counting and a source account on every row' (ACCOUNT-04 / ACCOUNT-06 / ACCOUNT-07). Phase 10 is marked Complete in ROADMAP.md and REQUIREMENTS.md."
---

# Phase 9: Multi-account Import & Account Identity - Verification Report

**Phase Goal:** A user can drop a real export that contains several account-ID folders and see it imported, cached and identified account by account, instead of getting the generic failure banner.
**Verified:** 2026-10-21T18:25:23Z
**Status:** passed
**Re-verification:** Yes - re-run against the current tree (branch `gsd/phase-12-account-timeline-perks`, HEAD `882a818`). The prior verified state is commit `11a332e` (report at `8ad167d` content, ancestor of `11a332e`). The only covered implementation file that changed since then is `src/lib/worker/classify.ts`, changed by commit `3ebfd46` in one doc-comment line. No product code changed in this pass.

## Re-verification Scope

- `git diff 11a332e HEAD` over every covered path: the single covered-file change is `src/lib/worker/classify.ts` (commit `3ebfd46`, 1 insertion / 1 deletion). The diff is inside the JSDoc block that ends at `classify.ts:340` (`*/`): line 337 changes the example in prose from `WrapperName/1234567/...` to `WrapperName/1234567/...`. No code, export, constant, or branch changed. The classify logic is byte-identical in its executable lines.
- Same commit also changed `tests/unit/import/classify.test.ts` (the literal account folder `1234567` replaced by synthetic `1234567`, 113 tests still pass) and `tests/e2e/shell/chart-fill.spec.ts` (poll until layout settles). Neither is in this phase's covered set: the classify test is a test file for a covered source and is re-run below (113 pass), and the chart-fill spec is a Phase 5/6 shell spec. Both are reported here for transparency; the covered set is unchanged.
- Real account id check: `git grep -c 1234567 -- src tests` returns no output and exit status 1 (no matches) on this tree.
- Other covered paths (`zero-network.spec.ts`, `multi-account.spec.ts`, `import-failure.spec.ts`, fixtures, shell models, worker files) have no diff since `11a332e`.
- Line anchors below are checked against the current tree. The classify.ts edit is one line inside a comment, so code line numbers are unchanged from the prior pass.

## Goal Achievement

The goal holds on the current tree. Evidence read from the code this pass:

- Dexie has exactly one executable `this.version(2)` block at `src/lib/worker/db.ts:352`; no `version(3)` exists.
- `src/lib/worker/classify.ts`: `MAX_ACCOUNT_ROOTS = 32` at `:91`; `MAX_ROOT_NAME_LENGTH = 128` at `:108`; bound checks `too-many` / `name-too-long` at `:622-624`; mapped reasons `too-many-roots`, `root-name-too-long`, `ambiguous-root` at `:827-829` (and `ambiguous-root` again at `:868`).
- The one-ROOT account-record gate `const singleRoot = ordered.length === 1 ? ordered[0]! : null` is intact at `src/lib/worker/ingest.worker.ts:1362`.
- Header, Account row and Overview card branch on the same `hasMultipleRoots` predicate: `IdentityHeader.svelte:77`, `selection-state.ts:358`, `overview-model.ts:133`; defined at `identity-model.ts:91`.
- `isMultiAccount` has zero hits across `src` and `tests`.
- `package.json`, `pnpm-lock.yaml` and `src/lib/import` have no diff since the prior baseline (no new dependency; the `src/lib/import` module is untouched).

### Observable Truths

| #   | Truth | Status | Evidence |
|-----|-------|--------|----------|
| 1 | Real-shape three-account zip imports without the banner; header lists every account with ID, games, years (SC1, ACCOUNT-01/05) | VERIFIED | `multi-account.spec.ts` (a) passed this pass (10.1 s); `import-failure.spec.ts` banner specs green this pass; UAT test 1 pass |
| 2 | The no-User_Info account appears, identified by ID only (D-13/17) | VERIFIED | `identity-model` / `multi-account-import` unit tests green this pass (import group); e2e (a) green; UAT test 1 |
| 3 | Accept matrix 1..32 roots, wrapper descent, loose files ignored | VERIFIED | `classify.ts` executable code unchanged since `11a332e` (only a doc-comment line changed, `3ebfd46`); `MAX_ACCOUNT_ROOTS = 32` at `:91`; `tests/unit/import/classify.test.ts` 113 passed this pass |
| 4 | Reject matrix: stray folder, ambiguous root, case collisions, unknown wrapper still show the one banner | VERIFIED | `classify.ts` returns `ambiguous-root` (`:829`, `:868`); `import-failure.spec.ts` (d) photos zip / stray folder / top-level category beside roots passed this pass; classify tests 113 green; UAT test 6 |
| 5 | Bounds fail closed: >32 roots, name >128 chars | VERIFIED | `classify.ts:622-624` (checks), `:827-828` (reasons), constants `:91`, `:108`; classify tests 113 green this pass |
| 6 | Every CSV entry resolves to exactly one owning root | VERIFIED | `multi-account-keys` and classify tests green this pass (113 classify; 1013 across `tests/unit/import`) |
| 7 | Each account is classified and parsed on its own; an account lacking categories does not fail the import | VERIFIED | per-root state in `ingest.worker.ts`; lifecycle unit tests green this pass; e2e (b) passed this pass (7.2 s) |
| 8 | Rows carry `account`; Dexie stays at version 2; no new dependency; `src/lib/import` untouched | VERIFIED | `db.ts:76` `account?: string` on `DatasetRow`; `db.ts:352` sole `this.version(2)`, no `version(3)`; empty diff on `package.json`, `pnpm-lock.yaml`, `src/lib/import` since the prior baseline |
| 9 | Unsupported/deferred rows counted, never stored; D-18 strip applied under every root (SC4 privacy) | VERIFIED | strip references intact in `ingest.worker.ts` (4) and `db.ts`; privacy unit tests green this pass; e2e (a) leak assertions and zero-network green this pass |
| 10 | Identity is per root, never a sibling's | VERIFIED | `identity-model.test.ts`, `multi-account-import.test.ts` green this pass (import group) |
| 11 | `meta.accounts` in D-16 order; `done`/`duplicate`/`cache-status` replay through one normaliser | VERIFIED | `rootCount` produced at `ingest.worker.ts:784` (replay) and `:1441` (fresh) only; replay pinned in `multi-account-import.test.ts` (green this pass) |
| 12 | Account record is built only for a one-ROOT dataset (T-09-32) | VERIFIED | gate at `ingest.worker.ts:1362` |
| 13 | Lifecycle: reload, duplicate (skipped), replace (no old rows), clear, start over | VERIFIED | `multi-account.spec.ts` (b) passed this pass (7.2 s) over 3, 2 and 1 account archives; UAT test 3 |
| 14 | v1.0 export unchanged; v1.0 cache not wiped; purge of unknown/deferred rows on load | VERIFIED | lifecycle and `db` unit tests green this pass (import group); `db.ts:352` is the only `this.version(` call |
| 15 | Synthetic 1/2/3-root fixtures exist; flows pass; zero-network holds through the multi-account import | VERIFIED | `tests/fixtures/multi-account-fixtures.ts`; `zero-network.spec.ts:239` ("...Phase 5 flow and the Phase 9 multi-account import") passed this pass (7.3 s), including the `STAGE_12_PANES`/`STAGE_13_PANES` union assertion at `:504` against `OPTIONAL_PANE_IDS` (exported `selection-state.ts:114`); 5 of 5 zero-network specs passed |
| 16 | Account row / Overview card / combined caption only where D-11 says | VERIFIED | `selection-state.ts:358`, `overview-model.ts:133`; e2e (b) caption assertions passed this pass; UAT test 2 |
| 17 | Merging accounts' rows of one file changes no parse (CR-01 per-account row groups) | VERIFIED | `csv-columns.ts` `AccountRowGroup` consumed by `db.ts:26`; unit tests green this pass |
| 18 | A vehicle row from an account with a different header carries its own name and numbers | VERIFIED | unit tests green this pass (import group) |
| 19 | The 375px multi-account header keeps a 40-char nickname and 20-digit ID readable (`verification: backstop`) | PASSED (override) | Override waived by user 2026-10-18; human-checked and passed in `09-UAT.md` test 4 (6/6 passed, 2026-10-21): full text, no horizontal scroll, no clipping. E2E geometry assertions in (a) also pass this pass |
| 20 | Account count, published list and every pane caption are one number (09-10 option-a) | VERIFIED | `accountCountOf` (`identity-model.ts:107`) equals the published list length when non-empty; e2e one-of-two step passed this pass; UAT test 5 |
| 21 | No account is presented as the export when the archive holds more than one root; header variant follows ROOT count | VERIFIED | `identity-model.ts:91` `hasMultipleRoots`; `IdentityHeader.svelte:77`; unit + e2e fresh/reload steps green this pass; UAT test 5 |

**Score:** 21/21 truths verified (20 VERIFIED, 1 PASSED by override), 0 failed, 0 behavior-unverified

Behavior-dependent truths (state transitions / cleanup): Truth 13 (replace, clear, start over) and Truth 7 (per-root lifecycle) rest on the named e2e lifecycle test `multi-account.spec.ts` (b), which passed this pass. Truths 3-6 (classify accept/reject, bounds, ownership) are re-confirmed by the 113-test `classify.test.ts` run this pass, not by presence.

### Roadmap Success Criteria Cross-check

| SC | Status | Evidence |
|----|--------|----------|
| SC1 three-account sample imports, header lists every account (ID, games, years), no-User_Info account appears by ID | VERIFIED | Truths 1, 2; e2e (a); UAT 1 |
| SC2 each folder classified/parsed on its own; panes open; every stored row carries its account | VERIFIED | Truths 7, 8, 17; e2e (a)/(b) |
| SC3 reload restores, identical zip skipped, different zip replaces, Clear/Start over wipe all | VERIFIED | Truth 13; e2e (b); UAT 3 |
| SC4 v1.0 export unchanged; rejected shapes still show the one banner; no email/birth date reaches storage or page | VERIFIED | Truths 4, 9, 14; `import-failure.spec.ts` green this pass; UAT 6 |
| SC5 1/2/3-root fixtures, flows pass, zero-network holds | VERIFIED | Truth 15; `zero-network.spec.ts` 5/5 green this pass |

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Per-account slicing of merged panes, vehicles merged by id, finance totals per currency | Phase 10 | Roadmap Phase 10 goal (ACCOUNT-04 / 06 / 07); Phase 10 Complete |

### Advisory (New Scope, Unevidenced)

None. The one covered-file change is a comment-only edit with no behavioral effect, and the re-run of its dependent tests is green.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/core/types/worker-messages.ts` | `ClassifyResult.rootCount?`, `accounts?` | VERIFIED | substantive, consumed by worker and shell |
| `src/lib/shell/identity-model.ts` | `rootCountOf`, `hasMultipleRoots`, `accountCountOf` | VERIFIED | `hasMultipleRoots` :91, `accountCountOf` :107; imported by header, selection-state (:39), overview-model (:3) |
| `src/lib/shell/IdentityHeader.svelte` | variant keyed on root count | VERIFIED | import :3, use :77 |
| `src/lib/shell/selection-state.ts`, `overview-model.ts` | same predicate for Account row / card | VERIFIED | :358 / :133 |
| `src/lib/worker/classify.ts` | N-root classifier, bounds, fail-closed | VERIFIED | constants :91, :108; checks :622-624, :827-829; only doc-comment line 337 changed since prior pass |
| `src/lib/worker/account-summary.ts` | `accountsOfMeta`, per-account summaries | VERIFIED | imported by `db.ts:27` |
| `src/lib/worker/db.ts` | Dexie v2, per-account row groups, `DatasetRow.account` | VERIFIED | single `this.version(2)` at :352; `account?` at :76 |
| `src/lib/worker/ingest.worker.ts` | per-root parse, `rootCount`, one-root account gate | VERIFIED | :784, :1362, :1441 |
| `tests/fixtures/multi-account-fixtures.ts` | 1/2/3-root builders incl. data-less folder | VERIFIED | used by e2e and unit |
| `tests/e2e/shell/multi-account.spec.ts` | identity + lifecycle specs | VERIFIED | 2 Phase 9 tests pass this pass (a at :781, b at :1938) |
| `tests/e2e/guards/zero-network.spec.ts` | zero-network through the Phase 9 import | VERIFIED | 5/5 pass this pass; union assertion at :504; `OPTIONAL_PANE_IDS` import at :19 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ingest.worker.ts` | `worker-messages.ts` | `rootCount`/`accounts` on `done`, `duplicate`, `cache-status` | WIRED | two producers, one normaliser |
| `identity-model.ts` | `IdentityHeader.svelte` | `hasMultipleRoots`, `accountRows` | WIRED | import :3, use :77 |
| `identity-model.ts` | `selection-state.ts` / `overview-model.ts` | `hasMultipleRoots`, `accountCountOf` | WIRED | imports :39 / :3, uses :358 / :133 |
| `account-summary.ts` | `db.ts` | `accountsOfMeta` | WIRED | import :27 |
| `multi-account-fixtures.ts` | `multi-account.spec.ts`, `zero-network.spec.ts` | fixture builders | WIRED | specs pass this pass |
| `selection-state.ts` | `zero-network.spec.ts` | `OPTIONAL_PANE_IDS` (exported :114) | WIRED | spec import line 19; assertion at :504 passes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Header variant | `rootCount` | `ordered.length` (fresh) / `storedAccounts.length` (replay) | Yes | FLOWING |
| Header rows | `accounts` | per-root summaries from the stored parse | Yes | FLOWING |
| Single-account REGION/CREATED_AT | `result.identity` | first root, read only when `hasMultipleRoots` is false | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Classify accept/reject, bounds, ownership (truths 3-6) | `pnpm exec vitest run tests/unit/import/classify.test.ts` | 1 file, 113 passed, exit 0 | PASS |
| Unit group for phase 9 import | `pnpm exec vitest run tests/unit/import` | 39 files, 1013 passed, exit 0 | PASS |
| Focused e2e (multi-account, import-failure, zero-network) | `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/import/import-failure.spec.ts tests/e2e/guards/zero-network.spec.ts` | 17 passed (18.5 s), exit 0; port 4173 was free, no run skipped | PASS |
| Type check | `pnpm run check` (`tsc -b && svelte-check`) | 0 errors, 0 warnings across 338 files, exit 0 | PASS |
| Lint | `pnpm run lint` (`prettier --check . && eslint .`) | exit 0 | PASS |
| Real account id absent | `git grep -c 1234567 -- src tests` | no output, exit 1 (no matches) | PASS |
| Full unit suite | not re-run this pass | Carried from prior full run: 135 files, 4149 passed, 9 expected-fail, 0 failed. Only the phase 9 import group and classify tests were re-run; the other changed test files since the baseline (`chart-fill.spec.ts`, a Phase 5/6 e2e spec) are outside the covered set | PASS (carried) |
| Dexie / deps / import module | `this.version(` scan; empty diff on `package.json`, `pnpm-lock.yaml`, `src/lib/import` | one `this.version(2)` at `db.ts:352`, no `version(3)`; no dependency change | PASS |
| Legacy predicate removed | grep `isMultiAccount` in `src`, `tests` | 0 hits | PASS |
| Probes | none declared by this phase | n/a | N/A |

### Requirements Coverage

Every ID declared in the 11 PLAN frontmatters (ACCOUNT-01, 02, 03, 05, 08) is in the ROADMAP Phase 9 requirement list and in REQUIREMENTS.md traceability (`Phase 9 | Complete`, checkbox ticked). No requirement mapped to Phase 9 is unclaimed.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ACCOUNT-01 | 09-01, 09-06 | Several account-ID folders import without the generic banner | SATISFIED | Truths 1, 3, 4; e2e (a), banner specs; UAT 1, 6 |
| ACCOUNT-02 | 09-01, 09-02, 09-05, 09-07, 09-09 | Each folder classified/parsed independently; missing categories still import | SATISFIED | Truths 2, 7, 17, 18 |
| ACCOUNT-03 | 09-02, 09-03, 09-06, 09-09, 09-11 | One cached dataset, replace-on-upload, hash-dedupe | SATISFIED | Truths 8, 11, 13, 14; Dexie still v2 |
| ACCOUNT-05 | 09-02, 09-04, 09-05, 09-06, 09-08, 09-10, 09-11 | Header lists every account with ID, games, years | SATISFIED | Truths 1, 10, 19, 20, 21; e2e (a); UAT 1, 4, 5 |
| ACCOUNT-08 | 09-01, 09-02, 09-03, 09-06, 09-07, 09-10, 09-11 | Clear/Start Over wipe all; 1/2/3-root fixtures | SATISFIED | Truths 13, 15; e2e (b); zero-network e2e; UAT 3 |
| ACCOUNT-04 / 06 / 07 | none (Phase 10) | Merged dashboard, game filter, merged logins | n/a | belong to Phase 10; not orphaned from Phase 9 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| phase source files | - | `TBD`/`FIXME`/`XXX` | none found | - |
| phase source files | - | stub / empty-implementation returns on a rendering path | none found | per-root data flows from the real parse to the header |
| `src/lib/worker/classify.ts` | 337 | example id in a doc comment (changed `1234567` to `1234567`) | none | comment-only; removes a real account id from source |
| `tests/unit/import/classify.test.ts` | - | literal account folder renamed to synthetic `1234567` (not in covered set) | none | test-only rename; 113 tests pass |

### Human Verification Required

None outstanding. The only backstop item (375px header readability) was waived on 2026-10-18 and has since been human-checked and passed in `09-UAT.md` (test 4; 6/6 passed on 2026-10-21). The override is retained in frontmatter.

### Gaps Summary

None. The only covered-file change since the prior verified baseline is a comment-only edit in `src/lib/worker/classify.ts` (commit `3ebfd46`), which removes a real account id from a doc comment and does not change behavior. Truths 3-6 were re-proved by the 113-test classify run and the 1013-test import group on this tree. The focused e2e run (17 tests) and the type/lint gates are green. The phase goal is achieved.

---

_Verified: 2026-10-21T18:25:23Z_
_Verifier: Claude (gsd-verifier)_
