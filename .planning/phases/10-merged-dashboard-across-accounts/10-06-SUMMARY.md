---
phase: 10-merged-dashboard-across-accounts
plan: 06
subsystem: testing
tags: [scale, multi-account, oracle, playwright, ci-budget, zero-network, fixtures]
status: complete

requires:
  - phase: 10-merged-dashboard-across-accounts
    plan: 05
    provides: "the merged Finance and Payments panes and the per-account spend split the scale test reads"
provides:
  - "`CURRENCY_54K_SPEC`, `CURRENCY_2K_SPEC` and `CURRENCY_500_SPEC` (seeds 5_003 / 5_004 / 5_005)"
  - "`buildLargeThreeAccountExport()` returning `{ bytes, expected }`: 54,000 + 2,000 + 500 currency rows, 20,000 sessions, 7,000 vehicle rows, 600 shared documentation addresses; generated in Node, never on disk"
  - "`tests/unit/import/multi-account-scale.test.ts`: the worker-harness proof of every merged aggregation against independent oracles"
  - "`tests/e2e/shell/multi-account-scale.spec.ts`: two serial listed tests, bounds and budget and zero network, then the filter flow"
  - "the three CI limits at 31 / 33 / 41 min with a guard that reproduces the arithmetic (E(260) = 1409 s, ceiling 264 tests)"
affects: [10-verify]

actuals:
  tokens: 15600
  tasks: 3
  commits: 3
plan_head_before: 18874d0f3232034ba66c1481a9d5a99892337f7e
plan_head_after: 110d9febd1e4ae8103b7a804d2d4f06f03ae134a

tech-stack:
  added: []
  patterns:
    - "A scale test computes every expected figure from the generated text and sessions (minute bitmap, `oracleCurrency`), never from the app."
    - "A serial describe imports the large archive once into one context; both tests read the same DOM, so the CI block is priced once."
    - "Gated additions to `projectedE2eSeconds` (from 260 tests) keep every historical pin at the value the phase that measured it recorded."

key-files:
  created:
    - tests/unit/import/multi-account-scale.test.ts
    - tests/e2e/shell/multi-account-scale.spec.ts
  modified:
    - tests/fixtures/finance-fixtures.ts
    - tests/fixtures/multi-account-fixtures.ts
    - playwright.config.ts
    - .github/workflows/ci.yml
    - tests/unit/guards/ci-budget.test.ts

key-decisions:
  - "The Dexie schema is unchanged: `db.verno` stays 2 and the non-indexed `account` field with in-memory grouping handles 54,000 rows in about 0.25 s (D-16). The test asserts the version."
  - "The CI allowance is the MEASURED 49 s, not the research estimate of 30 s; the minutes are still 31 / 33 / 41, but the ceiling is 264 listed tests rather than 268."
  - "The Playtime block bound is the calendar cell count plus a measured overhead of 775 (757 + 18) with 100 of margin, plus `nodes < sessions`; the plan's 'fewer than a tenth of the session count' cannot hold (see Deviations)."

requirements-completed: [SCALE-01, ACCOUNT-04]

duration: 40min
completed: 2026-10-18
---

# Phase 10 Plan 06: Large three-account scale proof and CI budget Summary

A generated three-account export with a 54,000-row currency file imports through the real worker and the real browser with every merged answer equal to an independent oracle, bounded DOM on every pane, no long task and no network request, and the three CI limits move to 31 / 33 / 41 minutes with their guard.

## Accomplishments

- **Task 1 (tracer, `5ab1391`)**: `buildLargeThreeAccountExport()` builds three roots in code-unit order `720000001`, `720000005`, `720000009` (D-16 order A, B, C is the reverse, first activity 2012, 2016, 2019, each pinned by one January session). Per account: a currency file from the 54K / 2K / 500 presets, a `WOT_Vehicle_Statistics.csv` of 5,000 / 1,500 / 500 rows, session files (WOT 12,000, WOTB 6,500, WOWS 1,500 in total) whose IP cells draw from one pool of 600 RFC 5737 addresses, `payment: true`, identity with a distinct nickname. Dates are converted to Unix seconds in the fixture with `Date.UTC`. The worker test imports it once and asserts: three accounts in D-16 order; `meta.playtime.v` 3 with `byGame` WOT/WOTB/WOWS; `meta.logins.v` 3; `db.verno` 2; playtime for All and each game equals a minute-bitmap oracle (seconds, sessions 20,000 / 12,000 / 6,500 / 1,500, active days); vehicles 7,000 rows split 5,000 / 1,500 / 500; logins total 20,000, `sum(countries) + unknown = totalLogins`, `sum(addresses) + other = totalLogins`, distinct address set equals the generator's, every address has sorted accounts and at least one address names several; merged currency charts and others equal `oracleCurrency` over the three concatenated CSVs in micro-units; every Payments card's `byAccount` sums to the card's `paid` and `units` with all three accounts contributing.
- **Task 2 (`a4b5059`)**: the first listed browser test. One context, one page, observers installed before navigation. Asserts import to ready under 60,000 ms, the identity header (`3 accounts`, tags A, B, C), Playtime tiles equal to the bitmap oracle, `aria-rowcount` 7,001 on Vehicles with at most 60 drawn rows each carrying exactly one account tag, `aria-rowcount` of distinct addresses + 1 on Login history with at most 60 drawn rows and several-account chips, one chart per oracle-charted currency in the oracle's order with each at most bars x 3 + 40 and the card at most the sum + 140, at most three rows in every opened Payments split, then no long task of 1,000 ms or more, zero requests after the baseline, one worker on the page origin, zero CSP violations.
- **Task 3 (`110d9fe`)**: the second listed test: the WoT, Warships and WoT Blitz chips read the oracle's seconds, sessions and active days; Vehicles follows the Game select (`wotb` shows the not-in-export line and no table, choosing WoT returns the 7,000-row windowed table, the WoT chip is checked on return, All restores the All figures); the masking toggle runs on the shared table; then the zero-request, one-worker, no-CSP-violation and no-long-task assertions cover the whole file. The CI limits move together.

## Measurements

| Figure | Value | Where |
| --- | --- | --- |
| Archive size | 1,371,455 bytes (zip) | unit test |
| Worker import (fake-indexeddb) | about 1.8 s | unit test |
| Currency query through the worker | 245 ms (bound 30,000 ms) | unit test |
| Whole worker-scale file | under 3 s (no shrink needed; D-17 allows it only past about 90 s) | unit test |
| Browser import to Playtime ready | about 2.2 s (budget 60,000 ms) | e2e |
| Playtime block | 6,254 nodes over 5,479 calendar cells (overhead 775) | e2e |
| New spec, whole file, slowest of 3 | 8.1 s | CI allowance |
| Phase 9 tests (a) / (b), slowest of 3 | 10.1 s / 7.2 s (were 3.6 s / 5.7 s) | CI allowance |

CI arithmetic: (8.1 + 6.5 + 1.5) x 3 = 48.4 s, rounded up to the allowance `MULTI_ACCOUNT_SCALE_SECONDS = 49`. E(260) = 330 + 5 x (260 - 86 - 5 - 5 - 5 - 2 - 2) + 120 + 90 + 13 + 32 + 49 = 1409 s; 1.3 x 1409 = 1831.7 s, past the 1800 s that 30 min gave. G = 31 min (1860 s), W = 33 min (1980 s), J = 41 min (2460 s). 31 min holds up to 264 listed tests.

## Verification

- `pnpm run test:unit`: 99 files, 3310 tests passed.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: prettier and eslint clean.
- `pnpm exec playwright test --list`: Total 260 tests in 29 files.
- `pnpm exec playwright test` (full suite): 259 passed, 1 failed, the known pre-existing `chart-fill.spec.ts` finance-tooltip failure below. `multi-account-scale.spec.ts` (2 tests), `zero-network.spec.ts`, `identity-privacy.spec.ts` and every Phase 4 to 9 spec passed.
- `tests/unit/guards` (ci-budget at 31 / 33 / 41, the 1860 / 1980 / 2460 pins, E(259) = 1365 and E(260) = 1409): passed.
- `git ls-files -- '*2026-10-14.zip'` prints nothing; `db.test.ts` (verno 2) passed.
- `graphify update .` run after the code changes; `graphify-out/` changes are left uncommitted by design.
- Manual-only item (chip row, tags and caption at 480 px): not run here; it stays recorded in `10-VALIDATION.md` for the verifier.

## Deviations from Plan

**1. [Rule 1 - Bug] Playtime block bound: 'fewer than a tenth of the session count' cannot hold**
- **Found during:** Task 2
- **Issue:** The plan asks for the Playtime block to hold fewer nodes than a tenth of the 20,000 sessions (2,000), but the calendar alone draws 5,479 cells for 2012-2026, so no correct implementation can meet it. The bound was impossible, not the app wrong.
- **Fix:** Kept the calendar-cells-plus-measured-overhead ceiling (overhead measured at 775 = 757 + 18, ceiling uses 757 + 118, the 04-12 rule of measured plus 100) and replaced the tenth with `nodes < sessions`, which a node per session would still fail.
- **Files modified:** `tests/e2e/shell/multi-account-scale.spec.ts`
- **Commit:** `a4b5059`

**2. [Estimate replaced by measurement] The CI allowance is 49 s, not the research estimate of 30 s**
- **Found during:** Task 3 Part B
- **Issue:** The plan's worked arithmetic assumed 30 s and gave a ceiling of 268 tests. Measuring (as the plan instructs) gave 49 s.
- **Fix:** `MULTI_ACCOUNT_SCALE_SECONDS = 49`, labelled MEASURED; E(260) = 1409 s. The required minutes are unchanged (31 / 33 / 41) but the ceiling is restated as 264 in the guard, `playwright.config.ts` and `ci.yml`.
- **Files modified:** `tests/unit/guards/ci-budget.test.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`
- **Commit:** `110d9fe`

No sessions or vehicle counts were shrunk: the worker file runs in under 3 s.

## Deferred Issues

- `tests/e2e/shell/chart-fill.spec.ts` "finance charts fill the detail pane" fails at 375px (`finance-tooltip right 367.2 > edge 359.0`) in the grouped full run. Pre-existing and already recorded in `deferred-items.md` and `.planning/WINDOWS.md` entry 15; this plan changes no source file.

## Known Stubs

None.

## Threat Flags

None. Only test, fixture and CI-limit files changed. T-10-19 (no real sample committed) holds: the archive is generated from seeds, every address is RFC 5737, `git ls-files` finds no real export. T-10-20 and T-10-21 are covered by the e2e assertions above. T-10-22: all three limits moved together by the guard's own G + 2 and W + 8 rule from a labelled measured allowance, every historical pin is unchanged, and the ci.yml sentence names 31 min exactly once.

## Self-Check: PASSED

- Files exist: `tests/unit/import/multi-account-scale.test.ts`, `tests/e2e/shell/multi-account-scale.spec.ts`, `tests/fixtures/multi-account-fixtures.ts`, `tests/fixtures/finance-fixtures.ts`, `tests/unit/guards/ci-budget.test.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`.
- Commits `5ab1391`, `a4b5059` and `110d9fe` are ancestors of HEAD.
