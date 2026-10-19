---
phase: 11-new-game-data
plan: 10
subsystem: ui
tags: [warplanes, vehicles, account-statistics, allowlist, svelte5, t-11-33, t-11-34, t-11-35]
requires:
  - phase: 11-new-game-data
    provides: "11-03's Warplanes account specs, 11-05's formatNewDataSkipped, 11-07's presence facts with parsed counts, 11-08's pane copy"
provides:
  - "VehicleView.wowpAccount and WowpAccountBlock"
  - buildWowpAccountBlock
  - wowpAccountColumns
  - "Account statistics block in PlayerStats (test id wowp-account-stats)"
  - "WOWP_ACCOUNT_STATS_HEADING, WOWP_FILE_LABELS, WOWP_ACCOUNT_COLUMN_LABELS"
affects: [11-11]
tech-stack:
  added: []
  patterns:
    - "an optional block of a view is built beside the table from a different file and gated by one field on the view, so other titles stay byte-identical"
    - "a skipped file travels as a lower-cased KEY from a closed set and the page prints a label from a constant table, never an archive name"
    - "cells of an allowlisted file are direct reads through constant spec headers, with Object.hasOwn deciding present versus missing"
key-files:
  created:
    - tests/unit/import/warplanes-account-worker.test.ts
  modified:
    - src/lib/features/vehicles/vehicle-shared.ts
    - src/lib/features/vehicles/vehicle-aggregate.ts
    - src/lib/features/vehicles/PlayerStats.svelte
    - src/lib/features/new-data/new-data-state.ts
    - src/lib/worker/data-queries.ts
    - src/lib/ui-copy.ts
    - tests/unit/vehicles/vehicle-stats.test.ts
    - tests/unit/vehicles/vehicle-blocks.test.ts
    - tests/unit/vehicles/vehicle-state.test.ts
    - tests/unit/new-data/new-data-state.test.ts
    - tests/unit/shell/ui-copy.test.ts
    - tests/unit/import/multi-account-keys.test.ts
key-decisions:
  - "The account block is built once, before the no-rows branch of buildVehicleView, so a Warplanes export whose plane file is empty (or absent while an account file is present) still shows its account statistics, like it still shows its header."
  - "Only block columns that at least one contributing account row actually carries are listed; a column the other file revision lacks is the existing missing special for the account that has no such key."
  - "Column kinds come from the spec (number to count, date to date, text and address to text); the allowlist marks most Warplanes account columns as text, so those values show as written rather than grouped."
  - "Prefixed Warplanes columns (B_, D_, G_, P_, AT_, DB_) keep their prefix letters in their labels; the export does not state the meaning, so no plane type is named."
patterns-established:
  - "A keyed each in a component that reads a builder-deduplicated list is registered in the keyed-each audit with its reason."
requirements-completed: [GAMES-03, PRIV-01]
actuals:
  tokens: 36000
  tasks: 2
  commits: 2
metrics:
  duration: 20min
  completed: 2026-10-19
status: complete
commits: 2
plan_head_before: 4fdfedaececb0d0c8efc0e41acd6cbd621f552c4
plan_head_after: f80429db6cb2cf7e050dc099483498bea6b071f6
---

# Phase 11 Plan 10: Warplanes account statistics in Vehicles Summary

Choosing Warplanes in Vehicles now shows an Account statistics block per account that holds the WOWP account record, tagged by letter for two or more accounts, with the allowlisted non-identifying columns the header does not already show, and names a drifted file in words; WoT, WoT Blitz and Warships render exactly as before.

## What shipped

- **View and builder**: `VehicleView.wowpAccount` (`WowpAccountBlock`: `columns`, `accounts`, `skipped`) and `buildWowpAccountBlock`, called only for the Warplanes title. Accounts follow `buildHeader`'s rule exactly (account files walked in preference order, a `seen` set, each group's FIRST row), so each account contributes once, through WOWP_19 when it has a row there and WOWP_20 otherwise. Columns are `wowpAccountColumns()`: the two account specs merged by header (19 first) minus the headers the existing header owns (`BATTLES_FIELD` and `PREMIUM_EXPIRY_FIELD`). Cells are `directCell` reads through the spec header, so no other key of a row is read. `buildHeader`, `buildWowp20Note` and the plane table are untouched; the diff is additions plus the `wowpAccount` literal entries.
- **Skipped files**: `VehicleFileFacts.parsed` (optional, absent means unknown) is set for all sixteen names in `vehicleFilesOf` from the 11-07 presence facts. A WOWP file that is seen, has parsed rows and stores none lands in `skipped` by key.
- **Page**: in `PlayerStats.svelte`, after the header `dl` and before the title-state line, one `{#if view.wowpAccount !== null}` holds the `h4` heading, a `div` per account in identity-header order (`orderRowsByAccount` over the tag map) with an optional tag line flush against a `dl.header[data-testid=wowp-account-stats]`, and a `p.body.info[data-testid=wowp-skipped]` per skipped file from `formatNewDataSkipped(WOWP_FILE_LABELS[key])`. No live region, icon, token or media query was added.
- **Copy**: `WOWP_ACCOUNT_STATS_HEADING`, `WOWP_FILE_LABELS` (separate from `NEW_DATA_FILE_LABELS`, so the pane-file pin stays true) and `WOWP_ACCOUNT_COLUMN_LABELS` with a label for every block column, cross-checked against `wowpAccountColumns()`.
- **State helper**: `orderRowsByAccount` is now generic over `{ account: string }`.

## Verification

- `pnpm run test:unit`: 115 files, 3704 tests pass (including the existing Warplanes table parity test, unchanged).
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean. `pnpm run build`: succeeds.
- `git diff -U0` of `PlayerStats.svelte` adds no line containing `aria-live`; the grep order of `player-stats-header`, `wowp-account-stats`, `player-stats-title-state` is as required.
- Not covered here: the rendered proof in Chromium (one block per account with the record, no nickname, WoT unchanged) is plan 11-11's e2e, as the plan states.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Other `VehicleView` literal and the keyed-each audit**
- **Found during:** Tasks 1 and 2
- **Issue:** `vehicle-state.test.ts` builds a `VehicleView` literal that now needs `wowpAccount`, and `multi-account-keys.test.ts` fails any keyed `each` it has not audited.
- **Fix:** added `wowpAccount: null` to the literal, and three audit entries (`entry.account` and `column.id` as de-duplicated by the builder, `file` as a fixed list of the four-key label table).
- **Files modified:** tests/unit/vehicles/vehicle-state.test.ts, tests/unit/import/multi-account-keys.test.ts
- **Commits:** 05f11f8, f80429d

**2. [Rule 2 - Missing functionality] Account block also built for the no-rows state**
- **Found during:** Task 1
- **Issue:** the plan sets `wowpAccount: null` in the no-rows literal, which would hide the account statistics (and a skipped account file) of a Warplanes export whose plane file is empty or missing, although the header still shows there.
- **Fix:** `buildWowpAccountBlock` is called once, under `title === 'wowp'`, before the no-rows branch, and its result is used in the no-rows and ready literals. A title absent from the export still yields null because nothing is seen.
- **Files modified:** src/lib/features/vehicles/vehicle-aggregate.ts
- **Commit:** 05f11f8

**3. [Rule 2 - Missing functionality] Columns limited to ones a contributing row carries**
- **Found during:** Task 1
- **Issue:** listing every spec column of both revisions would print a wall of "not in export" cells for the revision an account does not have.
- **Fix:** a column is listed when at least one contributing row has its key. With complete fixture rows the list equals the spec columns, as the plan describes.
- **Commit:** 05f11f8

### Plan-shaped judgement calls

**4.** `orderRowsByAccount` was already generic over `Pick<NewDataRowView, 'account'>`; step 4 became loosening it to `{ account: string }` with a test over a non-row shape.

**5.** TDD: the pure builder tests and the source-shape tests were written first and seen red; the worker test was written after the builder and passes first run. No separate RED commits (each task committed once).

## Known Stubs

None. Every value in the block is read from live worker data.

## Threat Flags

None. No network surface, storage or dependency added. T-11-33 (no nickname: not on the WOWP specs, no field on the type, worker test searches the posted view for planted canaries), T-11-34 (direct reads through spec headers, a pure test feeds a row with canary columns) and T-11-35 (skipped holds keys, the page prints from `WOWP_FILE_LABELS` and drops an unknown key) are mitigated and asserted.

## Self-Check: PASSED

- FOUND: tests/unit/import/warplanes-account-worker.test.ts, src/lib/features/vehicles/vehicle-aggregate.ts (buildWowpAccountBlock), src/lib/features/vehicles/PlayerStats.svelte (wowp-account-stats)
- FOUND commits: 05f11f8, f80429d
