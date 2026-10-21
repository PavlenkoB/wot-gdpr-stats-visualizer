---
phase: 10-merged-dashboard-across-accounts
verified: 2026-10-21T21:55:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/10-merged-dashboard-across-accounts/10-01-PLAN.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-01-SUMMARY.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-02-PLAN.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-02-SUMMARY.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-03-PLAN.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-03-SUMMARY.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-04-PLAN.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-04-SUMMARY.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-05-PLAN.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-05-SUMMARY.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-06-PLAN.md
  - .planning/phases/10-merged-dashboard-across-accounts/10-06-SUMMARY.md
  - playwright.config.ts
  - src/lib/features/finance/finance-aggregate.ts
  - src/lib/features/logins/login-aggregate.ts
  - src/lib/features/playtime/playtime-aggregate.ts
  - src/lib/shell/AccountTag.svelte
  - src/lib/shell/GameFilter.svelte
  - src/lib/worker/ingest.worker.ts
covered_digest: "v3:sha256:1e394aabf73b71fe8735116e10edf744984b6d47158639d735193c6cb91c7518"
behavior_unverified: 0
overrides_applied: 0
deferred: []
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 10: Merged Dashboard Across Accounts Verification Report

**Phase Goal:** With several accounts loaded, the user reads their whole history as one: combined playtime, finance, vehicles and login history, filterable by game, without double-counting and without losing which account a row came from.
**Verified:** 2026-10-21
**Status:** passed
**Re-verification:** Yes. The previous report (2026-10-20, against `main` a81c9e7) went stale because Phases 11 and 12 changed covered files again (`playwright.config.ts`, `src/lib/worker/ingest.worker.ts`). It had no `gaps:` section, no `overrides:` and an empty `deferred:` list, so there was nothing to carry forward. Every truth was re-checked against the current tree: branch `gsd/phase-12-account-timeline-perks`, HEAD 7e405a4.

## What changed since the last verification

`git diff a81c9e7 HEAD` over the covered files shows exactly two changed files:

| Covered file | Change since a81c9e7 | Phase 10 impact |
|--------------|----------------------|-----------------|
| `playwright.config.ts` | Phase 12 plan 12-03 raised `globalTimeout` from 31 to 32 min (comment block carries the arithmetic: 265 listed tests, E = 1434 s, 1.3 E = 1864.2 s) | Supersedes the figures Plan 10-06 wrote (31 / 33 / 41 min). The three limits still move together: G = 32 (config), wrapper `timeout 34m` and job `timeout-minutes: 42` (`.github/workflows/ci.yml:256,120`). The guard test `tests/unit/guards/ci-budget.test.ts` pins the new value (`toBe(1920)` at line 589) and passes, so the Plan 10-06 truth "the three CI limits move together and the sentence in ci.yml names the same minutes as playwright.config.ts" still holds, with the later, larger numbers |
| `src/lib/worker/ingest.worker.ts` | (a) the family test gains a category half, `isNewDataFile(...) \|\| isFamilyCategory(entry.name)`; (b) `if (storeFile && userInfo && !family)` keeps family files out of the identity and Account-record pools | Additive and fail-closed. Both branches act only on new-game or Phase 12 family files. Non-family rows follow the pre-existing storage path, and `account: resolved.root` stamping is unchanged. The identity-pool exclusion protects the Phase 9/10 account nickname that the account tags and the identity header use |

The other covered source files (`playtime-aggregate.ts`, `finance-aggregate.ts`, `login-aggregate.ts`, `AccountTag.svelte`, `GameFilter.svelte`) are byte-identical to a81c9e7 (empty `git diff`). Phase 12 touched `Dashboard.svelte` and `selection-state.ts` to add the Perks and Account timeline panes. The diff was read: the additions are two new `{:else if}` branches and an exhaustive `switch`. The Playtime and Vehicles game-filter wiring and the Phase 10 pane rows are unchanged.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Playtime covers all accounts together; overlap counted once, checked against a hand-computed two-account fixture | VERIFIED | `MA_OVERLAP_EXPECTED` (`tests/fixtures/multi-account-fixtures.ts:1304`) holds literals: all 23,400 s / 9 sessions / 5 days; `sumOfGames` 27,000, deliberately greater than all. `PLAYTIME_VERSION = 3` (`playtime-shared.ts:64`). `tests/unit/playtime/` (incl. `playtime-multi-account.test.ts`) passes in this run |
| 2 | Game filter on Playtime and Vehicles separates WoT / WoTB / WoWS and narrows across all accounts | VERIFIED | `buildGameScopes` (`playtime-aggregate.ts:663`, called at :638), `isGameToken` (`playtime-shared.ts:125`); per-game literals WOT 18,000 s, WOTB 5,400 s, WOWS 3,600 s; `game-filter-state` unit tests pass; the e2e game-filter flow on the large dataset passes (`multi-account-scale.spec.ts:534`) |
| 3 | Finance/Payments per-currency totals, never blended; Vehicles combines accounts; rows show/expose their account; no new session table | VERIFIED | `finance-aggregate.ts` keeps per-currency sums with `byAccount` as a split of the same sum (lines 851, 995). `AccountTag` is used by `VehicleTable.svelte`, `PlayerStats.svelte`, `IdentityHeader.svelte`, `identity-model.ts`. `db.verno` stays 2 (`tests/unit/import/db.test.ts:841,861,963,1177`), so no new table. Finance, vehicle e2e suites pass |
| 4 | Logins from all accounts in one table and one map; IPs masked until the single reveal; city opt-in fetches nothing until asked | VERIFIED | `LOGINS_VERSION = 3` (`login-shared.ts:39`); `accounts: Set<string>` per address (`login-aggregate.ts:212`, filled at :310, emitted sorted at :370). The only `fetch(` in `src` is `src/lib/geo/city-fetch.ts:151`, the sanctioned opt-in. Login e2e (masking, reveal-then-replace, reveal-then-clear, reload comes back masked) and the zero-network guard specs pass |
| 5 | Large three-account export with a 54,000-row `Virtual_Currencies` imports and renders without freezing; nodes scale with buckets/windows; zero network | VERIFIED | `tests/unit/import/multi-account-scale.test.ts` green; both `multi-account-scale.spec.ts` tests pass in this run (import under the 60 s cap, bounded merged panes, nothing leaves the page; game-filter flow on the large dataset). Vehicle window specs confirm at most 30 rows in the DOM at 5,000 vehicles |

**Score:** 5/5 truths verified (0 behavior-unverified, 0 coincidental-reliance)

### Plan-level must-haves

| Item | Status | Evidence |
|------|--------|----------|
| `verify.artifacts`, plans 10-01 to 10-06 | PASSED | 5/5, 4/4, 4/4, 4/4, 4/4, 5/5 |
| `verify.key-links`, plans 10-01 to 10-06 | PASSED | 15 of 16 by tool. The one miss (plan 06, `ci-budget.test.ts` to `playwright.config.ts`) has an empty pattern, so no match was attempted; the pin is asserted by `tests/unit/guards/ci-budget.test.ts`, which passes (now against the 32 / 34 / 42 min figures). Same tool result as the previous run |
| Single-account DOM unchanged | PASSED | Existing single-account Vehicles, Logins, Playtime, Finance specs pass in the same e2e runs |
| No Dexie schema change (D-16) | PASSED | `db.verno` is 2 in the green unit suite |
| Plan 10-06 CI-limit figures (31 / 33 / 41) | SUPERSEDED, not regressed | Phase 12 plan 12-03 deliberately raised them to 32 / 34 / 42 for its own two tests; the guard test enforces the relationship, not Phase 10's numbers. Not a Phase 10 gap |

### Behavioral Spot-Checks (run by the verifier on this tree)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite (evidence supplied by the caller, same tree) | `pnpm exec vitest run` | 135 files, 4149 passed, 9 expected fail, 0 failed | PASS (reported, not re-run in full) |
| Phase unit groups | `vitest run tests/unit/guards/ci-budget.test.ts tests/unit/import/multi-account-scale.test.ts tests/unit/playtime tests/unit/shell/game-filter-state.test.ts` | 15 files, 492 tests passed | PASS |
| Phase e2e areas | `playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/shell/multi-account-scale.spec.ts tests/e2e/logins tests/e2e/playtime tests/e2e/vehicles tests/e2e/finance tests/e2e/guards` | 149 passed (50.2 s) | PASS |
| Whole shell e2e directory (parallel workers) | `playwright test tests/e2e/shell` | 95 passed (44.9 s) | PASS |

Port 4173 was free before each Playwright run (no listener found), so no port conflict affected any result.

### Probe Execution

Step 7c: SKIPPED. Phase 10 declares no `probe-*.sh` scripts.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| ACCOUNT-04 | 10-01, 10-03, 10-05, 10-06 | Merged dashboard: combined playtime, per-currency finance, combined vehicle stats | SATISFIED | Truths 1 and 3 |
| ACCOUNT-06 | 10-01 to 10-05 | Game filter on playtime and vehicles; overlap not double-counted; row traceable to account | SATISFIED | Truths 1 to 3 |
| ACCOUNT-07 | 10-04 | Login-IP history merges across accounts, masking and city opt-in unchanged | SATISFIED | Truth 4 |
| SCALE-01 | 10-06 | New panes aggregate or virtualize; 54k-row `Virtual_Currencies` checked against a synthetic large export | SATISFIED | Truth 5 |

`.planning/REQUIREMENTS.md` lines 14, 16, 17, 42 (checked) and 66, 68, 69, 82 (traceability) map exactly ACCOUNT-04, ACCOUNT-06, ACCOUNT-07 and SCALE-01 to Phase 10, all Complete, and every one is claimed by a plan's `requirements:` field. No orphaned requirements.

### Anti-Patterns Found

None. No `TBD`, `FIXME` or `XXX` in any covered file. No stub or hollow-prop patterns in the merged panes; data flows from worker aggregates through to the views (login `accounts`, finance `byAccount`, playtime `byGame` scopes). The two Phase 11/12 additions to `ingest.worker.ts` are guarded and fail closed.

### Known Deferred / Pre-existing

`tests/e2e/shell/chart-fill.spec.ts:122` (finance tooltip at 375px, `finance-tooltip right 367.2 > edge 359.0`) is a recorded parallel-worker flake (`.planning/WINDOWS.md` entry 15, status open; `deferred-items.md`). It was NOT reproduced on this tree:

- Run alone: `playwright test tests/e2e/shell/chart-fill.spec.ts`, 2 passed (5.7 s), including line 122.
- Run inside the directory group: `playwright test tests/e2e/shell`, 95 passed, 0 failed, so the flake did not fire in the grouped run either (it did not appear in the 149-test phase run, which does not include that spec).

The flake is intermittent and still recorded as open; passing here does not close it. It is not a Phase 10 defect (pre-plan source reproduced it, per `deferred-items.md`) and is not counted as a gap.

### Human Verification

The one manual-only item (480px visual check of the chip row, account letter tags and 'All 3 accounts combined' caption, per `10-VALIDATION.md`) was approved by the user on 2026-10-18 and recorded in the earlier report. `AccountTag.svelte` and `GameFilter.svelte` are unchanged since then and the Phase 12 shell changes only add panes, so that approval is carried forward and no new human item arises.

### Gaps Summary

No gaps. Every roadmap success criterion is backed by current code and by tests run in this verification. Changes to covered files since the previous report are a CI-budget raise made on purpose by Phase 12 (the guard test pins it) and additive, fail-closed worker changes for new-game and Phase 12 family files; neither affects Phase 10 behavior.

---

_Verified: 2026-10-21_
_Verifier: Claude (gsd-verifier)_
