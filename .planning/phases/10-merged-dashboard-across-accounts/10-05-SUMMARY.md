---
phase: 10-merged-dashboard-across-accounts
plan: 05
subsystem: finance
tags: [multi-account, payments, finance, per-account-split, currency, ui-copy, e2e]
status: complete

requires:
  - phase: 10-merged-dashboard-across-accounts
    plan: 03
    provides: "`AccountTag.svelte`, `accountTagsFor`, `tagLabel` and `expectNicknameTextOnly`"
  - phase: 10-merged-dashboard-across-accounts
    plan: 04
    provides: "the lesson that a STORAGE order and a READING order are different rules (letter order, not root order)"
provides:
  - "`SpendAccount` and `SpendCard.byAccount` (per-root paid count and exact micro-unit sum, code-unit ascending)"
  - "the closed 'Per account' disclosure (`spend-per-account`) inside each Payments currency card, chip-led rows in identity-header order"
  - "`FINANCE_COMBINED_NOTE` rendered once on Finance and once on Payments for two or more accounts (`finance-combined-note`)"
  - "`SPEND_PER_ACCOUNT_SUMMARY`, `HEADER_ACCOUNT`, and `formatCombinedCaption` reading 'All N accounts combined'"
affects: [10-06]

actuals:
  tokens: 52000
  tasks: 2
  commits: 2
plan_head_before: 69078c52124ba09d147753b90ab68e4ded81fe8a
plan_head_after: d22606868095fe531656621a203bf85548fe5a61

tech-stack:
  added: []
  patterns:
    - "The per-account sum is accumulated in the SAME branch that increments the card's paid count and units, so the split adds up to the headline by construction rather than by two readings agreeing."
    - "A Map keyed by the account root (never an object), so a root named `__proto__` is an ordinary account."
    - "The stored `byAccount` order (code-unit by root) is re-sorted on the main thread by walking `accountTagsFor(...).values()`, which is the identity header's own order."
    - "Conditional multi-account nodes sit flush against their neighbours so one account leaves no whitespace text node (single-account DOM stays Phase 9's)."

key-files:
  created: []
  modified:
    - src/lib/features/finance/finance-shared.ts
    - src/lib/features/finance/finance-aggregate.ts
    - src/lib/features/finance/SpendSummary.svelte
    - src/lib/features/finance/FinancialData.svelte
    - src/lib/ui-copy.ts
    - tests/unit/finance/finance.test.ts
    - tests/unit/shell/ui-copy.test.ts
    - tests/unit/import/data-query-worker.test.ts
    - tests/e2e/shell/multi-account.spec.ts

key-decisions:
  - "`byAccount` is a split of the card's own rows and is drawn only in the collapsed disclosure; no per-account headline exists (D-14)."
  - "An account with only FAILED or NEW orders in a currency has no `byAccount` entry: a row of zeros would claim it spent nothing, which differs from 'its rows were not counted' (D-21)."
  - "The aggregated year and game tables carry no account tag (UI-SPEC Recorded Choice 5); the disclosure is the only place a tag appears on Payments."

requirements-completed: [ACCOUNT-04, ACCOUNT-06]

duration: 35min
completed: 2026-10-18
---

# Phase 10 Plan 05: Finance and Payments across accounts Summary

Same-currency amounts add exactly across accounts and are never converted; each Payments currency card gets a closed, chip-led 'Per account' disclosure, and both finance panes say once that currencies are never converted.

## Accomplishments

- **Task 1 (tracer, `1dc0bfc`)**: `SpendCard.byAccount` produced inside the included-paid branch of `buildSpend`; `SpendSummary.svelte` renders the closed `spend-per-account` disclosure only for two or more accounts and only when the card has entries; rows follow identity-header order (B then C on the three-account fixture) with the account phrase visually hidden. A one-account dataset renders none of it.
- **Task 2 (`d226068`)**: `FINANCE_COMBINED_NOTE` on `FinancialData.svelte` and `SpendSummary.svelte` (two or more accounts only, flush so one account leaves no text node, no live region); `formatCombinedCaption` now returns "All {N} accounts combined" and its pin test was updated; Overview card unchanged (D-15).
- Tests: a "Phase 10: per-account split" and a "Phase 10: accounts combine per currency" describe in `finance.test.ts`. They prove exact doubling against `oracleSpend` and `oracleCurrency`, that USD and EUR stay separate cards with no blended figure, that the unit-less card stays last and separate, that an empty second account changes nothing, that a `__proto__` root works, and that fractional amounts stay exact as unit strings. The e2e steps are appended to test (a) of `multi-account.spec.ts`.

## Verification

- `pnpm run test:unit`: 98 files, 3304 tests passed.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: prettier and eslint clean.
- `pnpm exec playwright test --list`: Total 258 tests in 28 files (unchanged).
- `playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/finance/spend.spec.ts`: 12 passed. `playwright test tests/e2e/shell tests/e2e/finance`: 134 passed, 1 failed (the pre-existing `chart-fill.spec.ts` flake below).
- `graphify update .` run after the code changes; `graphify-out/` changes are left uncommitted by design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The worker spend oracle in `data-query-worker.test.ts` no longer matched**
- **Found during:** Task 1
- **Issue:** The test built its expected `SpendView` with the helper's default root (`test-account`), but the worker stamps the real root and `byAccount` now carries it across the boundary, so the equality failed on the one new field.
- **Fix:** Pass the root `'123456789'` to `oneAccount` for the spend oracle, matching the vehicles oracle in the same file.
- **Files modified:** `tests/unit/import/data-query-worker.test.ts` (not listed in the plan's `files_modified`)
- **Commit:** `1dc0bfc`

**2. [Test adjustment] Overview D-15 assertion**
- **Found during:** Task 2
- **Issue:** A whole-card `toHaveText` regex failed because the card text also holds the screen-reader duplicate of the title and the "Open 3 accounts" link.
- **Fix:** Kept the existing verbatim label/summary assertions and asserted the absence of any currency code, amount or "combined" wording on the card, plus no note or split anywhere in the Overview.
- **Commit:** `d226068`

The interrupted run's partial work (all of Task 1 plus the `SPEND_PER_ACCOUNT_SUMMARY`/`HEADER_ACCOUNT` copy) was reviewed against the plan and kept as correct; the rest (Task 2) was completed here.

## Deferred Issues

- `tests/e2e/shell/chart-fill.spec.ts` "finance charts fill the detail pane" fails at 375px (`finance-tooltip right 367.2 > edge 359.0`) when run in a grouped run and passes on its own. It is pre-existing (recorded in 10-02, 10-03 and 10-04 SUMMARYs, `deferred-items.md`, and `.planning/WINDOWS.md` entry 15). It reproduced here with this plan's `FinancialData.svelte` change reverted, so it is not caused by this plan.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access; the disclosure renders text via `AccountTag` and `expectNicknameTextOnly` passes on the Payments pane (T-10-17). T-10-16 and T-10-18 are covered by the unit tests above.

## Self-Check: PASSED

- Files exist: `finance-shared.ts`, `finance-aggregate.ts`, `SpendSummary.svelte`, `FinancialData.svelte`, `ui-copy.ts`, the three test files.
- Commits `1dc0bfc` and `d226068` are ancestors of HEAD.
