---
phase: 15-tech-debt-cleanup
plan: 10
subsystem: styles
tags: [css, type-roles, vehicles, native-controls]

requires:
  - phase: 15-tech-debt-cleanup
    provides: note roles (15-01), style-equality harness (15-07), login history on the roles (15-09)
provides:
  - "The Vehicles pane (battle-type summary, vehicle table, statistics block with filters, picker and toggle) carries no local 14px/1.4 pair"
affects: [15-11, 15-13]

actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: f2d888d61164cd2e5a2edb44143217018e18a227
plan_head_after: 6aefcd3644f2c8321852a35df139d7a6a1672218

key-files:
  modified:
    - "src/lib/features/vehicles/BattleTypeSummary.svelte"
    - "src/lib/features/vehicles/VehicleTable.svelte"
    - "src/lib/features/vehicles/PlayerStats.svelte"
    - "tests/unit/vehicles/vehicle-blocks.test.ts"

key-decisions:
  - "Battle-type summary: h4, details and table take .t-note-strong (the baseline records 600 on the table, inherited from the details rule); td keeps its own explicit size/weight (it never declared the line height, so it was never a G7 site)"
  - "Vehicle table: the table takes .t-note (baseline 400) and the td pair is deleted outright (table exception); each sort button takes .t-note-strong"
  - "Statistics block: h3, h4, .control labels, both selects, .header dt, picker summary and legend take .t-note-strong; the search input, every checkbox, the .toggle label and .wowp-tag (inherits 400 from the player-stats root) take .t-note"

requirements-completed: []

duration: 25min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 10: Vehicles pane on the note roles Summary

**The Vehicles pane no longer hand-writes the 14px / 1.4 pair (16 rules, 3 files); native controls (select, search input, checkboxes, sort buttons, picker summary) keep their computed style because the role went on every element the old element-selector rule matched.**

## Accomplishments

- `note-sites` for `src/lib/features/vehicles`: 16 -> 0. `--count src`: 48 -> 32 (12 files), the plan's target.
- `BattleTypeSummary`: `<h4>`, `<details>`, `<table>` -> `.t-note-strong`; the three rules keep margin, colour, min-width, width and border-collapse.
- `VehicleTable`: `<table>` -> `.t-note`; `td` pair deleted (cells inherit); the dynamic-branch sort `<button>` -> `.t-note-strong`; 40px floors, sticky header and the other declarations kept.
- `PlayerStats` (10 rules): `<h3>`, both `<h4>`, the three `.control` labels, both `<select>`, the three `<dt>` (header, premium expiry, WoWP columns), picker `<summary>` and `<legend>` -> `.t-note-strong`; the search `<input>`, the checkbox `<input>` inside `{#each}`, `.toggle` label and `.wowp-tag` -> `.t-note`. The search-input comment that quoted the old "16/400 vs 14/600" now names the roles.
- `vehicle-blocks.test.ts`: two existing assertions on the markup (`<label for=...>`, `<h4>{WOWP...}`) follow the new class; two new describe blocks pin every role class by count (non-vacuous) and assert each touched rule exists, declares no type, and keeps its chrome.

## Task Commits

1. **Task 1: battle-type summary and vehicle table** - `6ed621d` (refactor)
2. **Task 2: statistics block** - `6aefcd3` (refactor)

## Verification

- `note-sites src/lib/features/vehicles`: 0 offenders; `--count src`: total 32.
- `vitest run tests/unit/vehicles tests/unit/shell tests/unit/import`: 56 files / 2024 passed. `tests/unit/guards` (alone): 22 files / 444 passed.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean. `pnpm run build`: OK.
- Playwright `vehicle-stats.spec.ts` (25) and `new-data-panes.spec.ts` (3): passed.
- `style-equality.mjs check`: 120394 elements and 176 screenshots compared, 0 differing, EQUAL (6 widths; tooltip state 60 of 60). The dump covers the summary, the table and sort buttons, the open picker (legend, 188 checkbox rows), both selects, the search input and the headings.
- `package.json` and `pnpm-lock.yaml` unchanged.

## Deviations from Plan

None - plan executed as written.

## Deferred Issues

- Not rendered by the synthetic archives, so not compared by the harness: the WoWP account block (`.wowp-tag`, its `<h4>` and its `<dt>`). They were checked by reading: the `dt` and `h4` rules declared 14px/600/1.4 which equals `.t-note-strong`; `.wowp-tag` declared 14px/1.4 and inherits 400 (the `player-stats` root computes 400, nothing between sets a weight), which equals `.t-note`. The Warplanes e2e spec passes.
- `tests/unit/guards/no-real-data.test.ts` timed out once when run concurrently with other files (known flaky under load); passes alone.

## Known Stubs

None.

## Threat Flags

None. T-15-16 mitigated: the class went on every element each bare `select`, `input` and `button` rule matched (both selects, the search box, every checkbox, every sort button), and the harness sees zero computed-style or rect difference. No package installed (T-15-SC).

## Self-Check: PASSED

- FOUND commits: `6ed621d`, `6aefcd3`
- FOUND: `.planning/phases/15-tech-debt-cleanup/15-10-SUMMARY.md`
