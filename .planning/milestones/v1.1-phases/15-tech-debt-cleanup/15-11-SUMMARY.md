---
phase: 15-tech-debt-cleanup
plan: 11
subsystem: styles
tags: [css, type-roles, finance, payments]

requires:
  - phase: 15-tech-debt-cleanup
    provides: note roles (15-01), style-equality harness (15-07), Vehicles pane on the roles (15-10)
provides:
  - "The Finance and Payments panes (currency block, premium block, spend summary and its tables) carry no local 14px/1.4 pair"
affects: [15-12, 15-13]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: a330e7ae66f4ab9e868012b8cc3fc43154c47e2e
plan_head_after: 8c18a8df767d76ccf7de4d7e082db98a8a415aa0

key-files:
  modified:
    - "src/lib/features/finance/CurrencyBlock.svelte"
    - "src/lib/features/finance/PremiumBlock.svelte"
    - "src/lib/features/finance/SpendSummary.svelte"
    - "tests/unit/finance/currency-blocks.test.ts"
    - "tests/unit/finance/spend-blocks.test.ts"

key-decisions:
  - "Spend tables take .t-note-strong, not the plan's expected .t-note: every table sits inside a details.breakdown (600), and the baseline dump records font-weight 600 on the table, tbody, thead and tr; th/td/caption keep or take their own explicit weight"
  - "The sr-only per-account <caption> takes the role too (the caption element rule matched it); .sr-only declares no type, so the class composes"

requirements-completed: []

duration: 20min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 11: Finance and Payments on the note roles Summary

**The currency block, premium block and spend summary no longer hand-write the 14px / 1.4 pair (14 rules, 3 files); every element a rule matched took the role class, and the harness sees zero computed-style or rect difference.**

## Accomplishments

- `note-sites` for `src/lib/features/finance`: 14 -> 0. `--count src`: 32 -> 18 (9 files), the plan's target.
- `CurrencyBlock`: `<h3>`, both `<h4>`, `<p class="code">` and the monthly-table `<details>` -> `.t-note-strong`.
- `PremiumBlock`: `<h3>`, `<h4 class="chart-title">` and both `<details>` (monthly table, unrecognised list) -> `.t-note-strong`.
- `SpendSummary`: `<h3>`, `<h4>`, every `<dt>`, both `.breakdown` `<details>`, all three `<table>` and all three `<caption>` (two visible, one `sr-only`) -> `.t-note-strong`; `<dd>` -> `.t-note`. The captions stay `<caption>` elements. Grid, spacing, borders, alignment, colours kept.
- `currency-blocks.test.ts` and `spend-blocks.test.ts`: no existing assertion read a removed declaration (the `<caption` assertion still holds), so two new describe blocks pin every role class by count (non-vacuous, each element kind asserted to exist) and assert each of the 14 rules exists, declares no type and keeps its chrome.

## Task Commits

1. **Task 1: currency block and premium block** - `b88439c` (refactor)
2. **Task 2: spend summary** - `8c18a8d` (refactor)

## Verification

- `note-sites src/lib/features/finance`: 0 offenders; `--count src`: total 18.
- `vitest run tests/unit/finance tests/unit/shell tests/unit/charts tests/unit/guards`: all pass except `no-real-data.test.ts`, which timed out under load and passes alone (known flaky).
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean. `pnpm run build`: OK.
- Playwright `spend.spec.ts` and `finance.spec.ts`: 42 passed.
- `style-equality.mjs check`: 120394 elements and 176 screenshots compared, 0 differing, EQUAL (6 widths; tooltip state 60 of 60). The dump covers the spend breakdown, per-account split (captions, tables, dd) and the currency/premium blocks.
- `package.json` and `pnpm-lock.yaml` unchanged.

## Deviations from Plan

- The plan expected `.t-note` for the spend `<table>`; the baseline records weight 600 (inherited from the enclosing `details.breakdown`), so it takes `.t-note-strong` (playbook rule 2). Not a visible change.

## Deferred Issues

- `tests/unit/guards/no-real-data.test.ts` timed out once when run alongside other files (known flaky under load); passes alone.

## Known Stubs

None.

## Threat Flags

None. T-15-17 mitigated: the class went on every element each element-selector rule matched (including the sr-only caption and the `{#each}` dt/dd), no element was renamed or moved, and the harness plus the finance and spend e2e specs show no difference. No package installed (T-15-SC).

## Self-Check: PASSED

- FOUND commits: `b88439c`, `8c18a8d`
- FOUND: `.planning/phases/15-tech-debt-cleanup/15-11-SUMMARY.md`
