---
phase: 15-tech-debt-cleanup
plan: 09
subsystem: styles
tags: [css, type-roles, login-history, privacy]

requires:
  - phase: 15-tech-debt-cleanup
    provides: note roles (15-01), style-equality harness (15-07), playtime pane on the roles (15-08)
provides:
  - "The Login history pane (city list, country list, city opt-in, history heading and reveal, map heading, summary labels, login table) carries no local 14px/1.4 pair"
affects: [15-10, 15-13]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: 0050b779f06064db2d3baf6191fa5787f34fece6
plan_head_after: 6994cb0dde1d9cf0244b3bdbdd53b081bcf0890d

key-files:
  created:
    - "tests/unit/logins/login-note-roles.test.ts"
  modified:
    - "src/lib/features/logins/CityList.svelte"
    - "src/lib/features/logins/CountryList.svelte"
    - "src/lib/features/logins/CityOptIn.svelte"
    - "src/lib/features/logins/LoginHistory.svelte"
    - "src/lib/features/logins/LoginMapSection.svelte"
    - "src/lib/features/logins/LoginSummary.svelte"
    - "src/lib/features/logins/LoginTable.svelte"

key-decisions:
  - "Tables take .t-note (baseline weight read as 400 for the login table); th, summary, headings, dt and buttons take .t-note-strong; td and .more inherit the table's role (table exception)"
  - "The city and country list headers each carry .t-note-strong explicitly (a th never inherits the table role); their td rules lose the size and weight they restated"

requirements-completed: []

duration: 25min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 09: Login history pane on the note roles Summary

**The Login history pane no longer hand-writes the 14px / 1.4 pair (15 rules, 7 files); class names and type declarations are the only change, and masking, the single global reveal and the opt-in request are untouched.**

## Accomplishments

- `note-sites` for `src/lib/features/logins`: 15 -> 0. `--count src`: 63 -> 48 (15 files).
- `CityList` / `CountryList`: `<summary>` and every `<th>` -> `.t-note-strong`; `<table>` -> `.t-note`; the `td` rule drops the size and weight it restated (cells inherit).
- `CityOptIn`: the `<h4>` and both buttons (the shared Load snippet and Cancel) -> `.t-note-strong`; border, padding and state selectors kept.
- `LoginHistory`: `<h3>`, the table `<h4>` and the single global reveal button -> `.t-note-strong`; handler, labels, `aria-*` and state untouched.
- `LoginMapSection` `<h4>` and the six `LoginSummary` `<dt>` -> `.t-note-strong`.
- `LoginTable`: `<table>` -> `.t-note`; `<th>` (dynamic `class="{column.widthClass} t-note-strong"`) and sort buttons -> `.t-note-strong`; `td` and `.more` pairs deleted (they inherit); 40px geometry kept.
- New reader `tests/unit/logins/login-note-roles.test.ts` (6 tests) pins every role class by count and asserts each touched rule exists and declares no type, plus the kept chrome (reveal and opt-in borders, 40px cell and sort-button height). No existing reader asserted a removed declaration, so none changed.

## Task Commits

1. **Task 1: city list, country list, city opt-in** - `7b1f9dd` (refactor)
2. **Task 2: history heading and reveal, map heading, summary labels, login table** - `6994cb0` (refactor)

## Verification

- `note-sites src/lib/features/logins`: 0 offenders; `--count src`: total 48.
- `vitest run tests/unit/logins tests/unit/shell tests/unit/charts`: 27 files / 1303 passed. `tests/unit/guards`: 22 files / 444 passed (run alone).
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean. `pnpm run build`: OK.
- Playwright `login-table.spec.ts` + `login-history.spec.ts`: 20 passed.
- `style-equality.mjs check`: 120394 elements and 176 screenshots compared, 0 differing, EQUAL (6 widths; tooltip state 60 of 60).
- The harness does not render the country list, city list or map (no geo data in the synthetic archives). Checked separately with a throwaway Playwright spec (not committed, removed) that loaded the geo fixture, opened the country list, loaded city detail, and dumped font size, weight, line height and rect of every element under the country list, city list, city opt-in and summary at 1280 and 375 px in the baseline worktree and in the working tree: 432 elements each, identical.
- `package.json` and `pnpm-lock.yaml` unchanged.

## Deviations from Plan

None - plan executed as written.

## Deferred Issues

- `tests/unit/guards/no-real-data.test.ts` timed out once when run concurrently with other files (known flaky under load); passes alone.

## Known Stubs

None.

## Threat Flags

None. T-15-15 mitigated: only class names and type declarations changed; phase6-guards, login-model, reveal-state and city-state tests, and the login e2e specs pass unchanged. No package installed (T-15-SC).

## Self-Check: PASSED

- FOUND commits: `7b1f9dd`, `6994cb0`
- FOUND: `tests/unit/logins/login-note-roles.test.ts`
