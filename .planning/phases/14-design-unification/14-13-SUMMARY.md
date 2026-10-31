---
phase: 14-design-unification
plan: 13
subsystem: ui
tags: [svelte, css, design-tokens, utilities, scroller, caption, nesting]

# Dependency graph
requires:
  - phase: 14-design-unification
    provides: the shared utilities in `src/styles/utilities.css` (`.scroller`, `.caption`) and the token scale in `src/styles/tokens.css`
  - phase: 14-design-unification
    provides: the migrated login-history table (`LoginTable.svelte`), whose `.scroller table-scroll` pair is the pattern this plan copies
provides:
  - The vehicle table is on the shared scroll region: `class="scroller table-scroll"`, the local `.scroller` rule deleted, the table's own box in the `.table-scroll` hook
  - The battle-type summary is on tokens and on the shared `.caption` block, with its `.scroll-box` and `.scrolls` declarations intact and still findable by the phase-5 guard
  - `VehicleTable.svelte` and `BattleTypeSummary.svelte` are off the migration's pending list
affects: [14-design-unification, vehicles, PlayerStats, utilities, nesting-guard]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 3009
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A table scroller is `class=\"scroller table-scroll\"`: the shared utility owns the region (min-width, overflow, isolation, focus ring) and one local hook owns the table's own box (position, max-height, border, radius, background)."
    - "A component's local copy of a shared name is DELETED, not tokenised, when the shared block computes to the same values - a scoped selector outranks the shared one, so a leftover local rule would silently win."
    - "The nesting guard's G6b rule forces a state rule under its single-selector parent: `td:not(.sticky-first)` extends `td` (the next character after `td` is `:`), so it becomes `&:not(.sticky-first)` inside `td`."

key-files:
  created: []
  modified:
    - src/lib/features/vehicles/VehicleTable.svelte
    - src/lib/features/vehicles/BattleTypeSummary.svelte
    - tests/helpers/migration.ts

key-decisions:
  - "The shared `.scroller` owns the region and the local `.table-scroll` hook owns the table's own box, copied from `LoginTable.svelte`: `position: relative` is load-bearing (the containing block the sticky header and first column resolve against, and what makes `overflow: auto` clip the visually-hidden cell text), `isolation: isolate` comes from the shared utility (it is what keeps the header cells off the sticky nav), and the border, radius and background belong to the table rather than to every scroller in the app."
  - "The local `.caption` in `BattleTypeSummary.svelte` is DELETED rather than tokenised: the shared `.caption` declares the same seven values (margin 0, min-width 0, 14/400/1.4 muted, `overflow-wrap: anywhere`), so the rendering is unchanged, and a scoped rule outranks the shared one - a leftover local rule would have kept winning the cascade and the migration would have been a no-op."
  - "The `.note` hook stays local: the shared `.caption` says nothing about the note's own offset from the table, and the scoped `.note` still outranks the shared `.caption` for `margin-top`."
  - "The `.sr-only` clip block stays local. The playbook deletes only the rules named exactly `.visually-hidden`; a clip block under any other local name keeps its name, and its `margin: -1px` stays legal because the same rule declares `clip`."
  - "`td:not(.sticky-first)` moves inside `td` as `&:not(.sticky-first)`, because the nesting guard's G6b rule sees it as extending `td` (the next character after `td` is `:`). Svelte's scoping raises that rule's specificity from (0,1,1) to (0,2,1), and the only rule it now competes with for a property is `tr.muted td` at (0,2,2), which still wins - and both set the same colour."
  - "`.scroll-box` and `.scrolls` keep their declarations exactly. The phase-5 guard still finds them because the nested-aware reader returns the `.scroll-box` rule's OWN declarations (`min-width: 0; overflow-x: auto;`) and the nested `&:focus-visible` is a separate rule."
  - "The scroller's focus ring keeps `outline-offset: 2px`, which is what the shared `.scroller` utility has carried since it was written; the sort button's own ring keeps `-3px`. Neither changed in this plan."

patterns-established:
  - "The scroller pair: `class=\"scroller table-scroll\"` - the shared utility and one local hook that is named for the table, not for the region."
  - "A deleted shared-name rule leaves the element WITHOUT a Svelte scope class when no other local rule matches it; the shared global rule then styles it, and the probe must confirm the computed values rather than the class attribute."

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-13]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "The vehicle table scroller is the shared `.scroller` utility plus a local `.table-scroll` hook, and the table's own box (position, 480px cap, border, radius, background) is unchanged."
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicles/vehicle-stats.spec.ts (25 tests, all pass)"
        status: pass
      - kind: other
        ref: "scratch computed-style probe, before 0256ee5 vs after de38cb0: 25 elements x 23 properties, identical (probe-14-13.mjs, outside the repository)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The battle-type summary is on tokens; its local `.caption` is deleted in favour of the shared `.caption`, and its `.scroll-box` and `.scrolls` declarations are intact."
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase5-layout-guards.test.ts - the `.scroll-box` and `.scrolls` assertions"
        status: pass
      - kind: other
        ref: "scratch computed-style probe: battleType.caption, battleType.note, battleType.scrollBox, battleType.th, battleType.td, battleType.tdLabel all identical before vs after"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both components are off the migration's pending list and pass the design-token, nesting and layout guards."
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts, tests/unit/guards/nesting-guard.test.ts, tests/unit/guards/phase7-layout-guards.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 23min
completed: 2026-10-27
status: complete
---

# Phase 14: Design Unification Summary (Plan 14-13)

**The vehicles pane's first half moved onto the shared tokens: the vehicle table now rides the shared scroll region with a local `table-scroll` hook, and the battle-type summary took the shared caption block with its two scroll declarations left intact.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-10-27T20:14:00+04:00
- **Completed:** 2026-10-27T20:37:00+04:00
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- `VehicleTable.svelte` no longer defines `.scroller`. The region element keeps `class="scroller"` and gains `table-scroll`; the shared utility supplies `min-width: 0`, `overflow: auto`, `isolation: isolate` and the focus ring, and the new `.table-scroll` hook keeps the table's own box - `position: relative`, the 480px cap, the border, `var(--radius-sm)` and the page background.
- `BattleTypeSummary.svelte` lost its local `.caption` entirely and takes the shared block; every remaining literal became a token, and `td.label` moved under `td` while `.scroll-box` and `.scrolls` kept their declarations.
- A computed-style probe of the two builds - the pre-change commit `0256ee5` on port 4175 and this plan's commit `de38cb0` on port 4174 - read 25 elements x 23 properties. Every value is identical; the ONLY two differences in the whole probe are the two class attributes the migration is supposed to change.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate the vehicle table and the battle-type summary** - `de38cb0` (refactor)

**Plan metadata:** `docs(14-13): complete the vehicles pane first-half plan`

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified

- `src/lib/features/vehicles/VehicleTable.svelte` - the table on the shared scroll region; `.table-scroll` added, `.scroller` deleted, every literal tokenised, and `th`/`td`/`button` state rules nested under their parent.
- `src/lib/features/vehicles/BattleTypeSummary.svelte` - the shared `.caption` replaces the local one, the literals become tokens, and `.scroll-box:focus-visible` and `td.label` nest under their parents.
- `tests/helpers/migration.ts` - `VehicleTable.svelte` and `BattleTypeSummary.svelte` off `PENDING_FILES`.

## Decisions Made

- **The shared `.scroller` owns the region, the `.table-scroll` hook owns the table's box.** The split is not cosmetic: `position: relative` is load-bearing twice over (the containing block the sticky header and first column resolve against, and what makes `overflow: auto` clip this component's own visually-hidden cell text), `isolation: isolate` is what keeps the header cells off the sticky nav, and the border, radius and background belong to a bordered table card rather than to every scroller in the app. `LoginTable.svelte` already carries this exact pair; this plan copies it rather than inventing a second shape.
- **The local `.caption` is deleted, not tokenised.** The shared `.caption` declares the same seven values the deleted rule carried, so the rendering is unchanged. Tokenising it instead would have left a scoped rule that still outranks the shared one - the migration would have been a no-op with extra steps. This is the same reasoning plan 14-12 used for the logins pane's dead `.count` hook.
- **The `.note` hook stays local.** The shared block says nothing about the note's own offset from the table, and the scoped `.note` (0,2,0) still outranks the shared `.caption` (0,1,0) for `margin-top`, so the note keeps its 8px gap.
- **The `.sr-only` clip block stays local.** The playbook deletes only the rules named exactly `.visually-hidden`; a clip block under any other local name keeps its name, and `margin: -1px` stays legal because the same rule declares `clip`. The vehicles table's `<caption class="sr-only">` is unchanged.
- **`td:not(.sticky-first)` nests under `td`.** The nesting guard's G6b rule sees it as extending `td` - the next character after `td` is `:`, which is an extension character - so it becomes `&:not(.sticky-first)` inside the `td` rule. Worth recording: Svelte's scoping raises that rule's specificity from (0,1,1) to (0,2,1), because the flat form compiled to `td:where(.svelte-xxx):not(.sticky-first)` and the nested form compiles to `td.svelte-xxx:not(.sticky-first)`. The only rule it now competes with for a property is `tr.muted td` at (0,2,2), which still wins - and both set the same colour, so the pixels do not move. The probe confirms it.
- **The scroller's focus ring keeps its `outline-offset: 2px`.** That is what the shared `.scroller` utility has carried since it was written and what the local rule said before this plan; the sort button's own ring keeps `-3px`. Neither changed here.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **A stale `vite preview` holds port 4173**, and the committed Playwright config sets `reuseExistingServer: false`, so Playwright could not start its own server there. Every e2e run and every probe went through a temporary config in the repo root that moved `use.baseURL` and `webServer` to port 4174. The temporary file was moved out of the repository afterwards and was never committed; `playwright.config.ts` is untouched.
- **The probe's first pass could not reach two of the elements this plan touches.** The battle-type note and the non-sortable `.plain` header label both live only in the Warships view (`isWarships` is `title === 'wows'`, and the two per-type columns are the non-sortable ones), while selecting a battle TYPE filters the vehicle table and removes the muted cells. The probe reads the unfiltered table first and a second pass on the `wows` title fills the gaps.
- The pre-existing `tests/unit/overview/overview-grid.test.ts` starvation flake did not appear: the full unit suite passed in one run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `PlayerStats.svelte` is the last file on the migration's pending list and is plan 14-14's work, alone. Nothing in this plan blocks it.
- **Carried into plan 14-14:** the class pair `class="caption count"` renders muted 400 in the logins pane (its local `.count` hook is dead) but 600/`--text` in the vehicles pane, where the hook is alive. Plan 14-14 faces the same question.
- **Open items reported, not edited** (none is in this plan's file list): `tests/e2e/_support/helpers.ts:541` (says stat tile numerals are 30px), `tests/e2e/shell/master-detail-nav.spec.ts:72` (comment names the retired 30), `tests/unit/device-info/device-info-blocks.test.ts:143` (hard-coded `['14','18','26','30']` superset), `src/lib/features/logins/map-model.ts:36` and `src/lib/charts/FlowLegend.svelte` (still say "ramp" in prose).

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
