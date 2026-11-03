---
phase: 15-tech-debt-cleanup
plan: 08
subsystem: styles
tags: [css, type-roles, playtime, charts]

requires:
  - phase: 15-tech-debt-cleanup
    provides: note roles (15-01), style-equality harness with tooltip state (15-07)
provides:
  - "The Playtime pane (calendar heatmap, hour grid, duration list, controls, chart headings, summary, split table) carries no local 14px/1.4 pair"
affects: [15-09, 15-13]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: 6bd66a574ec52f869eea5bfba64f49221e374bee
plan_head_after: b1c60a426be971852b30c9578c066bc921a9aa6f

key-files:
  modified:
    - "src/lib/features/playtime/CalendarHeatmap.svelte"
    - "src/lib/features/playtime/HourGrid.svelte"
    - "src/lib/features/playtime/DurationList.svelte"
    - "src/lib/features/playtime/Playtime.svelte"
    - "src/lib/features/playtime/PlaytimeCharts.svelte"
    - "src/lib/features/playtime/PlaytimeSummary.svelte"
    - "tests/unit/playtime/playtime-charts.test.ts"

key-decisions:
  - "Table cells each take .t-note (the table rule states no type pair, so the playbook table exception does not apply); th and caption take .t-note-strong explicitly"
  - "tr.selected td keeps its own weight 600 over the role (scoped rule outranks the role); pinned by a reader assertion"

requirements-completed: []

duration: 20min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 08: Playtime pane on the note roles Summary

**The Playtime pane no longer hand-writes the 14px / 1.4 pair (14 rules, 6 files); the style-equality harness reports 0 differing elements and 0 differing screenshots at all six widths.**

## Accomplishments

- `note-sites` for `src/lib/features/playtime`: 14 -> 0. `--count src`: 77 -> 63 (22 files).
- `CalendarHeatmap`: year-head `h5` -> `.t-note-strong`; both axis `<text>` kinds (month, weekday) -> `.t-note`; `.axis` keeps `fill`, `& h5` keeps margin and colour.
- `HourGrid`: both axis `<text>` kinds -> `.t-note`. `DurationList`: `.label` and `.count` spans -> `.t-note`; rule keeps colour, `min-width`, right alignment and tabular numerals. The phone-block rules in `src/styles/shell.css` are untouched (they set grid areas, not type).
- `Playtime`: `h3`, selector `label` and `select` -> `.t-note-strong`; the select keeps border, padding, background, min-height. `PlaytimeCharts`: three `h4` -> `.t-note-strong`.
- `PlaytimeSummary`: three `dt`, `.unit`, `caption`, two `th` -> `.t-note-strong`; four `td` (including the empty overflow cell) and `p.note` -> `.t-note`. The `dd` numeral stays `.t-display`; the phone block's 18px is not touched.
- Reader: two new tests in `tests/unit/playtime/playtime-charts.test.ts` pin every role class by count and assert that the 14 rules declare no font-size, font-weight or line-height (each with an "exists" check, non-vacuous), plus `tr.selected td` still declaring weight 600.

## Task Commits

1. **Task 1: calendar heatmap, hour grid, duration list** - `bc0ad45` (refactor)
2. **Task 2: controls, chart headings, summary, split table** - `b1c60a4` (refactor)

## Verification

- `note-sites src/lib/features/playtime`: 0 offenders; `--count src`: total 63.
- `vitest run tests/unit/playtime tests/unit/finance tests/unit/charts tests/unit/shell`: 37 files / 1593 passed. `tests/unit/guards`: 22 files / 444 passed (run alone).
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean. `pnpm run build`: OK.
- Playwright `playtime-ui-review.spec.ts` + `playtime-charts.spec.ts`: 22 passed.
- `style-equality.mjs check`: 120394 elements and 176 screenshots compared, 0 differing, EQUAL (archives 5, panes 13, widths 375/480/481/899/900/1280); tooltip state 60 of 60 surfaces recorded.
- `package.json` and `pnpm-lock.yaml` unchanged.

## Deviations from Plan

None - plan executed as written. No existing reader assertion read a removed declaration (the rules were previously unread by type), so tests were added rather than changed.

## Deferred Issues

- `tests/unit/guards/no-real-data.test.ts` timed out once when run concurrently with 41 other test files (known flaky under load); passes alone and in the guards-only run.
- Login-history `WorldMap` is still not compared by the harness (no geo data in synthetic archives); not touched by this plan.

## Known Stubs

None.

## Threat Flags

None. T-15-14 mitigated (harness EQUAL on table cells, caption, axis text and select; playtime e2e computed-style specs pass); no package installed (T-15-SC).

## Self-Check: PASSED

- FOUND commits: `bc0ad45`, `b1c60a4`
