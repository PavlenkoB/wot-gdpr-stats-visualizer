---
phase: 13-overview-personal-insights
plan: 08
subsystem: ui
tags: [overview, insights, playtime, finance, worker, d-05, d-17, d-18, d-20, d-21]

requires:
  - phase: 13-overview-personal-insights
    provides:
      - "13-01: the sixteen-tile wire contract and the pure builder"
      - "13-03: the hand-derived oracle and the synthetic two-account archive"
      - "13-05: longestSeconds / longestStart on the stored playtime slices"
      - "13-07: readAccountStats, sumVehicleBattleSeconds and the Map-by-id tile merge"
provides:
  - "overview-time.ts: buildTimeTiles (Logged in, Signature hour, Longest streak, Longest session, Busiest day), buildLife, dayRange, WOT_GAME"
  - "overview-totals.ts: buildTotalsTiles (Credits earned, Battles, Orders)"
  - "tests/helpers/overview-inputs.ts: overviewInputsFromArchive / overviewPlaytimeFromArchive, an archive read through the production parser"
  - "All sixteen tiles hold real oracle values in the channel answer (only the class tile stays absent while the tank table is empty)"
affects: [13-09, 13-11, 13-15, overview, insights, worker]

plan_head_before: 842e09a981d794c15919cde36b4e7f67d1806600
plan_head_after: c8fa0d0
commits: 3
actuals:
  tokens: 112000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Habit tiles read the WOT per-game scope only; Logged in reads the cross-game union"
    - "Money crosses the wire as the Finance builder's exact micro-unit string, never a number"
    - "A count tile reads rows.length and no cell of any row"

key-files:
  created:
    - "src/lib/features/overview/overview-time.ts"
    - "src/lib/features/overview/overview-totals.ts"
    - "tests/helpers/overview-inputs.ts"
    - "tests/unit/overview/overview-time.test.ts"
    - "tests/unit/overview/overview-totals.test.ts"
  modified:
    - "src/lib/features/overview/overview-aggregate.ts"
    - "tests/unit/import/overview-worker.test.ts"
    - "tests/unit/overview/overview-records.test.ts"

key-decisions:
  - "A legacy Sessions.csv names no game, so Logged in stays ready while the four WoT habit tiles are absent (T-13-25)"
  - "Credits reuse buildCurrency so the Overview and the Finance pane cannot disagree; the value is an exact micro-unit string (D-21, T-13-24)"
  - "The win rate waits for 30 battles (MIN_BATTLES_PLAIN_RATE); the battle and win counts themselves are never guarded (D-17)"
  - "Orders is a row count: a seen file with zero rows is a true zero, an unseen file is absent; no cell is read (D-18, T-13-23)"

patterns-established:
  - "Test inputs built from a fixture archive through the production parser and aggregator, so unit tests speak the worker's language"

requirements-completed: [INSIGHT-02, INSIGHT-07, INSIGHT-08]

coverage:
  - id: D1
    description: "The Time group and the Wargaming life list derived from the stored playtime aggregate, with legacy and partial datasets answered as named absences"
    requirement: INSIGHT-02
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-time.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Totals group: credits as Finance defines them, battles with the 30-battle rate guard, an order count that reads no cell"
    requirement: INSIGHT-07
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-totals.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "All sixteen tiles carry the oracle's figures through the real worker channel"
    requirement: INSIGHT-08
    verification:
      - kind: integration
        ref: "tests/unit/import/overview-worker.test.ts"
        status: pass
    human_judgment: false

duration: 70 min (including a mid-plan resume)
completed: 2026-10-23
status: complete
---

# Phase 13 Plan 08: Time and Totals Tiles Summary

**The Time group, the Wargaming life strip and the Totals group, so all sixteen Overview tiles hold real oracle values: habits from WoT sessions only, credits as the Finance pane's own bigint-backed in-flow string, and a win rate that waits for thirty battles.**

## Mid-plan resume

The first executor was killed by a provider 429 after committing both tasks. This run did not redo them. It verified the two commits (`c4735ba`, `f8fb473`), confirmed the working tree was clean, and re-ran `pnpm run check`, `pnpm run lint` and `pnpm run test:unit`. All three passed, so no type errors remained. The one gap was a worker-level assertion that every tile holds an oracle value through the real channel. Only the Totals tiles had one. This run added it in `c8fa0d0`.

## Accomplishments

- Logged in is the Phase 10 union across all accounts and games. It carries the per-year split and a separate "In battle" lifetime figure that falls back to the per-vehicle rows (D-05, D-20).
- Signature hour, Longest streak, Longest session and Busiest day read the WoT per-game scope only, with earliest-wins tie rules and the project's `HOUR_GRID_BASIS`.
- The life strip lists every game's own merged seconds. The parts may exceed Logged in, as documented (D-06).
- Credits reuse `buildCurrency`, Battles sum across account folders with the 30-battle rate guard, and Orders counts `rows.length` only.
- `overviewInputsFromArchive` reads a fixture archive through the production parser and aggregator.
- The worker test now asserts all sixteen tiles through the real channel. Only `cls` is absent, because the committed tank table is empty until plan 13-15 (D-09).

## Task Commits

1. **Task 1: Time group, life list and archive-to-inputs helper** - `c4735ba` (feat)
2. **Task 2: Totals group** - `f8fb473` (feat)
3. **Resume gap: all sixteen tiles through the worker** - `c8fa0d0` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical test coverage] Worker-level proof of all sixteen tiles**
- **Found during:** resume audit of acceptance criteria
- **Issue:** the worker test asserted only the Totals, Tanks and Records tiles. The Time group and the life strip were proven only at unit level.
- **Fix:** added a case that ingests the oracle archive and asserts the five Time tiles, the life strip, firstDay and lastDay, with `cls` as the only absent tile.
- **Files modified:** tests/unit/import/overview-worker.test.ts
- **Commit:** c8fa0d0

Otherwise the plan was executed as written.

## Issues Encountered

The previous executor's last words suggested type errors. None were present in the committed tree: `pnpm run check` reports 0 errors, 0 warnings.

## Verification

- `pnpm run check`: 0 errors, 0 warnings
- `pnpm run lint`: prettier and eslint clean
- `pnpm run test:unit`: 152 files, 4544 passed, 9 expected fail (before the new case; the worker file then ran 11/11)

## Known Stubs

None. The class tile is absent while the tank table is empty. That is the planned D-09 behavior, to be resolved by plan 13-15.

## Threat Flags

None. No new network, auth or file surface was added.

## Self-Check: PASSED

- overview-time.ts, overview-totals.ts, overview-inputs.ts and both unit test files exist.
- Commits c4735ba, f8fb473 and c8fa0d0 are ancestors of HEAD.
