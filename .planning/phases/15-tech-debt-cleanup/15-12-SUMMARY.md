---
phase: 15-tech-debt-cleanup
plan: 12
subsystem: styles
tags: [css, type-roles, new-data, device-info, account-timeline]

requires:
  - phase: 15-tech-debt-cleanup
    provides: note roles (15-01), effectiveFontSizes and the style-equality harness (15-07), Finance and Payments on the roles (15-11)
provides:
  - "The last 18 sites are on the note roles: the HEAT, Warships and Perks panes (shared card and table, toggles), the Device info pane and the Account timeline (pane, kind filter, table)"
  - "node tools/note-sites.mjs reports 0 for the whole of src/ (total: 0, 63 files scanned), so the whole-tree guard can go live in plan 15-13 with nothing to exempt"
affects: [15-13]

actuals:
  tokens: 9000
  tasks: 3
  commits: 3
plan_head_before: c7981b04ce7c0f46e1458b0d6dea3aa378bfb60e
plan_head_after: 62b7d104e3e5440407fd7450be120c33bd1b4925

key-files:
  modified:
    - "src/lib/features/new-data/HeatPane.svelte"
    - "src/lib/features/new-data/NewDataCard.svelte"
    - "src/lib/features/new-data/NewDataTable.svelte"
    - "src/lib/features/new-data/PerksPane.svelte"
    - "src/lib/features/device-info/DeviceInfo.svelte"
    - "src/lib/features/device-info/DeviceTable.svelte"
    - "src/lib/features/account-timeline/AccountTimelinePane.svelte"
    - "src/lib/features/account-timeline/TimelineKindFilter.svelte"
    - "src/lib/features/account-timeline/TimelineTable.svelte"
    - "tests/unit/new-data/new-data-blocks.test.ts"
    - "tests/unit/new-data/new-data-panes.test.ts"
    - "tests/unit/new-data/perks-pane.test.ts"
    - "tests/unit/device-info/device-info-blocks.test.ts"
    - "tests/unit/account-timeline/timeline-pane.test.ts"

key-decisions:
  - "Both tables (NewDataTable, TimelineTable, DeviceTable) take .t-note on the <table> and the td / .more pair is deleted outright (playbook section 3 table exception); the baseline records weight 400 on the table, thead, tbody and tr, and th keeps its own explicit semibold"
  - "The timeline kind chips are <label> elements, not buttons; they take .t-note-strong like the filter's <span class=label>"
  - "perks-pane.test.ts was not in the plan's files_modified but is a listed reader; it gained one role test"

requirements-completed: []

duration: 25min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 12: Last 18 sites on the note roles Summary

**The HEAT, Warships, Perks, Device info and Account timeline panes no longer hand-write the 14px / 1.4 pair; `note-sites --count src` goes 18 -> 0 and the harness sees zero computed-style, rect or pixel difference.**

## Accomplishments

- `NewDataCard`: `<h3>` and `<dt>` -> `.t-note-strong` (the Warships storage pane renders this card, no rule of its own). `NewDataTable`: `<table>` -> `.t-note`, td / `.more` pair deleted. `HeatPane` and `PerksPane`: the mask toggle `<button>` -> `.t-note-strong`.
- `DeviceInfo`: `<h3>` and `<dt>` -> `.t-note-strong`, `<dd>` -> `.t-note`. `DeviceTable`: `<h3>` -> `.t-note-strong`, `<table>` -> `.t-note` (baseline weight 400).
- `AccountTimelinePane` toggle, `TimelineKindFilter` label and both kinds of chip -> `.t-note-strong`. `TimelineTable`: `<table>` -> `.t-note`, td / `.more` pair deleted.
- Non-type declarations (padding, borders, 44px floor, colours, sticky/windowing styles) kept untouched; no handler, label or `aria-*` touched.
- Readers: the font-size sweeps in `new-data-blocks`, `new-data-panes` and `device-info-blocks` use `effectiveFontSizes` and keep their `length > 0` checks (the device-info sweep would have been empty on `DeviceTable` without it, since its `th` declares no size). The two `font-weight: 600` assertions (card title and term) now assert the strong role on the element. New role tests pin the classes and "no rule restates the type" for the Heat, Perks, Device info and Timeline components; the timeline reader had no sweep, so one non-vacuous size sweep was added. No assertion deleted or weakened.

## Task Commits

1. **Task 1: HEAT, Warships and Perks panes** - `641ffdc` (refactor)
2. **Task 2: Device info** - `668d307` (refactor)
3. **Task 3: Account timeline** - `62b7d10` (refactor)

## Verification

- `note-sites --count src`: 18 (9 files) -> total 0 (63 scanned); exit 0.
- `vitest run tests/unit/account-timeline tests/unit/new-data tests/unit/device-info tests/unit/shell tests/unit/import tests/unit/guards`: all pass. Full `pnpm run test:unit`: 4942 passed; 3 failures (`overview-grid.test.ts` x2, `no-real-data.test.ts`) are the known load-flaky tests, and all 21 tests of those two files pass alone.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean. `pnpm run build`: OK.
- Playwright `new-data-panes.spec.ts`, `device-info.spec.ts`, `account-timeline-perks.spec.ts`: 7 passed.
- `style-equality.mjs check`: 120394 elements and 176 screenshots compared, 0 differing, EQUAL (6 widths; tooltip 60 of 60).
- `package.json` and `pnpm-lock.yaml` unchanged.

## Deviations from Plan

None - plan executed as written. (One extra reader, `perks-pane.test.ts`, got a role test; it was listed in the plan's reader inventory.)

## Deferred Issues

- The harness synthetic archives do not render the Account timeline mask toggle (`timeline-mask-toggle` is absent from the dumps). Its rule is character-for-character the HEAT/Perks `button` rule, which the harness does cover, and the account-timeline-perks e2e spec exercises the toggle. Not a regression risk beyond that equivalence.
- `overview-grid.test.ts` and `no-real-data.test.ts` time out under full-suite load (known flaky); pass alone.

## Known Stubs

None.

## Threat Flags

None. T-15-18 mitigated: only class names and type declarations changed; the new-data, perks, timeline and device-info unit readers and the three e2e specs (planted emails never render, IPs and codes masked until the single reveal) pass unchanged. No package installed (T-15-SC).

## Self-Check: PASSED

- FOUND commits: `641ffdc`, `668d307`, `62b7d10`
- FOUND: `.planning/phases/15-tech-debt-cleanup/15-12-SUMMARY.md`
