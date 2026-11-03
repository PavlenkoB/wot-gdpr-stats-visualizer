---
phase: 11-new-game-data
plan: 06
subsystem: ui
tags: [svelte5, runes, stamped-cell, game-filter, ip-mask, privacy]

requires:
  - phase: 11-new-game-data
    provides: "11-01's filter chips for HEAT and WOTC, and the D-07 scope guard on Dashboard.svelte"
  - phase: 10-shared-game-filter
    provides: "GAME_FILTER_TOKENS, filterToTitle, filterAfterTitleChange, and the stamped-cell pattern in Dashboard.svelte"
  - phase: 06-login-history
    provides: "maskStateFor (D-07), the reveal row's markup and its two announcements"
provides:
  - "reveal-state.ts: RevealChoice and resolveReveal, the pure stamped read of the app's single IP reveal"
  - "Dashboard.svelte owns revealChoice; LoginHistory reads `revealed` / calls `onRevealChange` instead of holding its own boolean"
  - "game-filter-state.ts: hasNoVehicleTable, vehicleTitleForAsk, resolveVehicleTitle, AnyVehicleTitle, VehicleTitleChoice, NoVehicleTableToken"
  - "Dashboard.svelte owns vehicleTitleChoice; PlayerStats takes lastTitle / onTitleApplied"
  - "formatNoVehicleTable in ui-copy.ts and the vehicles-no-table-note line in PlayerStats"
affects: [11-09, 11-11, game-filter-state, Dashboard.svelte, LoginHistory.svelte, PlayerStats.svelte]

actuals:
  tokens: 219
  tasks: 2
  commits: 2
plan_head_before: 81749861c8ac2615666a75b539bdcf2216492bbe
plan_head_after: 5f41c18a680dc135b18be7ddfcf4640ff573d9f2

tech-stack:
  added: []
  patterns:
    - "Stamped shell cell + pure read: a `$state` choice carries the dataset it was made under, and the reset is a `$derived` calling a pure resolver (never an effect writing state)"
    - "Cross-pane fact lives at the composition root: a value two panes read or write cannot be a cell inside either one"

key-files:
  created:
    - src/lib/shell/reveal-state.ts
    - tests/unit/shell/reveal-state.test.ts
  modified:
    - src/lib/shell/Dashboard.svelte
    - src/lib/shell/game-filter-state.ts
    - src/lib/features/logins/LoginHistory.svelte
    - src/lib/features/vehicles/PlayerStats.svelte
    - src/lib/ui-copy.ts
    - tests/unit/shell/game-filter-state.test.ts
    - tests/unit/shell/ui-copy.test.ts
    - tests/unit/vehicles/vehicle-blocks.test.ts

key-decisions:
  - "resolveReveal delegates to login-state's maskStateFor rather than re-implementing the comparison, so D-07 keeps exactly one definition"
  - "LoginHistory keeps its maskStamp rune after the lift, but only to drive the sort and city-view resets; the boolean left for good"
  - "hasNoVehicleTable is equality against two literals (and a type guard), not a complement of GAME_FILTER_TOKENS, so appending a chip cannot silently start claiming the note"
  - "vehicleTitleForAsk takes lastTitle as string | null and narrows it through a fixed VEHICLE_TITLE_IDS vocabulary; the props boundary stays narrow (AnyVehicleTitle) and the helper is the gate"
  - "The remembered title records the APPLIED view title, never the requested ask, so a title the worker declined is never remembered"
  - "No GAMES-* requirement is marked complete: this plan ships the mechanism the new panes need, not a pane"

patterns-established:
  - "Source-shape guards read code with comments stripped, so an assertion about behaviour is not satisfied by prose"
  - "A lifted boolean keeps its read-side test ids, copy constants and attributes byte-identical; only the owner changes"

requirements-completed: []

coverage:
  - id: D1
    description: "One reveal boolean in the application, owned by the shell, stamped and reset with the dataset"
    requirement: PRIV-01
    verification:
      - kind: unit
        ref: "tests/unit/shell/reveal-state.test.ts (all describes)"
        status: pass
      - kind: unit
        ref: "tests/unit/logins (unedited toggle, caption and announcement assertions)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Vehicles under HEAT or WoT Console is a table plus one honest sentence, never an error and never a cleared filter"
    requirement: GAMES-01
    verification:
      - kind: unit
        ref: "tests/unit/shell/game-filter-state.test.ts (hasNoVehicleTable / vehicleTitleForAsk / resolveVehicleTitle)"
        status: pass
      - kind: unit
        ref: "tests/unit/shell/ui-copy.test.ts (the no-vehicle-table note)"
        status: pass
      - kind: unit
        ref: "tests/unit/vehicles/vehicle-blocks.test.ts (11-06 describes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The reader sees the same addresses after a pane switch, and masked again after a replace"
    verification: []
    human_judgment: true
    rationale: "Only a browser can show that. The unit suite proves the wiring and the stamped read; plan 11-11 automates the pane-switch and replace flow across the HEAT pane as well."

duration: 11min
completed: 2026-10-19
status: complete
---

# Phase 11 Plan 06: One reveal, one remembered title

**The IP reveal lifted out of Login history into a stamped shell cell, plus the remembered Vehicles title and the `vehicles-no-table-note` that makes HEAT and WoT Console an explanation rather than an empty state.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-19T15:12:00Z (local harness clock)
- **Completed:** 2026-10-19T11:25:38Z
- **Tasks:** 2
- **Files modified:** 10 (1 source file and 1 test file created, 8 modified)

## Accomplishments

- The mask is now ONE rune for the whole app. `reveal-state.ts` exports `RevealChoice` and `resolveReveal`, a pure stamped read that delegates to Phase 6's `maskStateFor` so D-07 keeps a single definition; `Dashboard.svelte` owns the cell and `LoginHistory.svelte` reads it as a prop. Login history's visible behaviour is unchanged — every toggle-markup, caption, announcement and `data-masked` assertion passes unedited.
- `game-filter-state.ts` gains `hasNoVehicleTable`, `vehicleTitleForAsk` and `resolveVehicleTitle`. With HEAT or WoT Console applied, Vehicles asks for the title the reader last saw in this dataset and says so in one sentence; with All, WoT, WoT Blitz or Warships the first ask is byte-identical to Phase 10, so D-21 stands as written.
- The remembered title records the APPLIED view title, never the requested ask, so a title the worker declined is never remembered and the worker's own first-title-with-rows choice becomes the remembered one.
- The filter is never cleared by Vehicles: `filterAfterTitleChange` remains the only writer, asserted at exactly one call site.

## Task Commits

Each task was committed atomically:

1. **Task 1: One shell-owned reveal for every address** - `fb619ab` (feat)
2. **Task 2: Vehicles under HEAT and WoT Console** - `5f41c18` (feat)

## Files Created/Modified

- `src/lib/shell/reveal-state.ts` (new) - `RevealChoice`, `resolveReveal`; delegates to `maskStateFor`
- `tests/unit/shell/reveal-state.test.ts` (new) - the stamped read, the lift's wiring, and a shell-wide scan for storage/cookie/URL/history APIs
- `src/lib/shell/Dashboard.svelte` - the `revealChoice` and `vehicleTitleChoice` cells, their derived reads and setters, and the new props on `LoginHistory` and `PlayerStats`
- `src/lib/features/logins/LoginHistory.svelte` - `revealed` / `onRevealChange` props; local boolean and the `maskStateFor` call gone
- `src/lib/shell/game-filter-state.ts` - `hasNoVehicleTable`, `vehicleTitleForAsk`, `resolveVehicleTitle`, `AnyVehicleTitle`, `VehicleTitleChoice`, `NoVehicleTableToken`
- `src/lib/features/vehicles/PlayerStats.svelte` - `lastTitle` / `onTitleApplied` props, `vehicleTitleForAsk` in the dataset effect, `onTitleApplied(accepted.view.title)` in `load()`, and the `vehicles-no-table-note` paragraph
- `src/lib/ui-copy.ts` - `formatNoVehicleTable(gameLabel, titleLabel)`
- `tests/unit/shell/game-filter-state.test.ts` - four new describes for the three helpers
- `tests/unit/shell/ui-copy.test.ts` - the no-vehicle-table note's wording contract
- `tests/unit/vehicles/vehicle-blocks.test.ts` - two new describes pinning the props, the helper call, the note's test id, its absence of `aria-live`, and the single `onGameFilterChange` call site

## Decisions Made

- **`resolveReveal` delegates rather than re-decides.** Phase 6's `maskStateFor` is still D-07; this plan changes who holds the value, not what it means. Calling it makes it impossible for the shell's lifecycle and the block's tests to drift apart.
- **`maskStamp` stays in LoginHistory.** It is now documented as the TABLE's stamp, not the mask's: it still drives the sort and city-view resets in the same effect on the same primitive. Renaming it was possible but buys nothing and would have touched lines the plan asked to leave alone.
- **`hasNoVehicleTable` is equality against two literals, and a type guard.** A complement of `GAME_FILTER_TOKENS` would mean that appending a chip in a later phase silently starts producing the "has no vehicle table" sentence. The guard also narrows `gameFilter` so `formatGameName` cannot receive the `null` that All is spelled as — that was a real `svelte-check` error before the guard was made one.
- **`vehicleTitleForAsk`'s second parameter is `string | null`, not the title union.** The cell behind it holds `string | null`, so the helper is the gate that turns that into a `VehicleAsk`; the prop boundary stays narrow. This keeps the hostile-value case testable rather than unreachable-by-types.
- **The note sits directly under the `.controls` row**, above the title-state line, reusing the existing `.body.info` rule — no new CSS, no icon, no `aria-live`.

## Deviations from Plan

### Auto-fixed Issues

None. Two things the plan did not anticipate were resolved within the plan's own constraints rather than by changing scope:

- **`vehicleTitleForAsk` could not be typed as the plan wrote it.** The plan's behaviour list requires `vehicleTitleForAsk('HEAT', 'junk')` to be `null`, which does not typecheck against a `VehicleTitleId | null` parameter. The parameter was widened to `string | null` with the fixed `VEHICLE_TITLE_IDS` vocabulary as the gate, and the doc comment says why. Rule 1: a signature that cannot express the behaviour the plan specifies.
- **The note's gate could not live in the `{#if}`.** `formatGameName` takes a `string`, so gating on `hasNoVehicleTable(gameFilter)` in the markup passed `null` through; `svelte-check` rejected it. The gate moved into a `noTableNote` derived, which is what "directly under the controls and above the title-state line" wanted anyway.

---

**Total deviations:** 0 auto-fixed (2 in-plan signature adjustments, neither scope change)
**Impact on plan:** Both tasks executed exactly as written. No scope creep, no behaviour added beyond D-04 and D-06.

## Issues Encountered

- Two source-shape assertions written during RED did not match the implementation's actual (better) shape — the toggle announcing from the NEXT value rather than the flipped prop, and `onTitleApplied` sitting behind its explaining comment. Both assertions were corrected to describe the behaviour rather than the layout, and both are documented in the test file.

## Known Stubs

None. Every function this plan adds is called by a rendered path, and every rendered path it adds has a copy string and a test id. No `TODO`, no placeholder, no unrun verify.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **11-09** can mount the HEAT pane with its geolocation card on `revealed` / `onRevealChange` — the wiring it needs is in place, and the prop pair is the same one Login history takes.
- **11-11** can automate the pane-switch and replace flow; the unit suite proves the wiring and the stamped read but not the browser behaviour.
- The `game-filter-scope.test.ts` guard from 11-01 still passes: `{gameFilter}` reaches exactly `Playtime` and `PlayerStats`, and nothing was widened.

---

*Phase: 11-new-game-data*
*Completed: 2026-10-19*

## Self-Check: PASSED

- `src/lib/shell/reveal-state.ts` — FOUND
- `tests/unit/shell/reveal-state.test.ts` — FOUND
- `.planning/phases/11-new-game-data/11-06-SUMMARY.md` — FOUND
- `fb619ab` (Task 1) — FOUND, is an ancestor of HEAD
- `5f41c18` (Task 2) — FOUND, is an ancestor of HEAD

`pnpm run test:unit` (106 files, 3461 tests), `pnpm run check` (0 errors, 0 warnings) and
`pnpm run lint` all green; no `Co-Authored-By:` trailer in either commit.
