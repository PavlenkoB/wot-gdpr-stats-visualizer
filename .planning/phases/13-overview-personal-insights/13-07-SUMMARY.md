---
phase: 13-overview-personal-insights
plan: 07
subsystem: ui
tags: [overview, insights, csv, worker, tank-table, records, d-04, d-09, d-19]

requires:
  - phase: 13-overview-personal-insights
    provides:
      - "13-01: the sixteen-tile wire contract (overview-shared.ts) and the pure builder (overview-aggregate.ts)"
      - "13-02: the key-free vehicle lookup and the worker-only table module (overview-lookup.ts, vehicle-table.ts)"
      - "13-03: the hand-derived oracle and the synthetic two-account archive (tests/helpers/overview-oracle.ts, tests/fixtures/overview-fixtures.ts)"
provides:
  - "overview-columns.ts: the shared column readers (resolveFields, readCount, readTankId, clampName)"
  - "overview-account-stats.ts: the per-account account-statistics reader (readAccountStats)"
  - "overview-tanks.ts: the four Tanks tiles (buildTankTiles) and the per-vehicle battle-time fallback (sumVehicleBattleSeconds)"
  - "overview-records.ts: the four Records tiles (buildRecordTiles)"
  - "buildOverviewView(inputs, lookup): the Tanks and Records groups are live in the channel answer"
  - "A worker-level proof that the eight tiles answer through the real channel"
affects: [13-08, 13-09, 13-11, 13-15, overview, insights, worker]

actuals:
  tokens: 24368
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One column vocabulary per module, resolved in ONE pass over each account group's own first row (CR-01)"
    - "A lookup arrives as an ARGUMENT, never as an import, so a worker-only table stays worker-only"

key-files:
  created:
    - "src/lib/features/overview/overview-columns.ts"
    - "src/lib/features/overview/overview-account-stats.ts"
    - "src/lib/features/overview/overview-tanks.ts"
    - "src/lib/features/overview/overview-records.ts"
    - "tests/unit/overview/overview-account-stats.test.ts"
    - "tests/unit/overview/overview-tanks.test.ts"
    - "tests/unit/overview/overview-records.test.ts"
  modified:
    - "src/lib/features/overview/overview-aggregate.ts"
    - "src/lib/worker/data-queries.ts"
    - "tests/unit/import/overview-worker.test.ts"

key-decisions:
  - "A record is the MAXIMUM across accounts and its tank is the one the HOLDING account names; a tie keeps the earlier account (D-19)"
  - "A missing column and an unreadable value are DIFFERENT absences: the first names the column, the second names the source only"
  - "The 'column resolved but every value is null' case is absent with NO column, because the column IS in the export and nothing is missing from it"
  - "The lookup is a PARAMETER of buildOverviewView, so overview-aggregate never imports the worker-only table"
  - "The eight Tanks and Records tiles are collected into a map by id and laid out by mapping OVERVIEW_TILE_IDS, so a group that contributes nothing cannot shift the order"

patterns-established:
  - "resolveFields: one walk of the row's keys, the key that appears FIRST wins, an unresolved field is null and never zero"
  - "readCount / readTankId: a cell that is not a plain number reads as null; a record id is only /^[1-9][0-9]{0,9}$/"
  - "Per-account reading: every group resolves its own columns from its own first row, and only that group's first row is read"

requirements-completed: [INSIGHT-02, INSIGHT-06, INSIGHT-07]

coverage:
  - id: D1
    description: "The shared column readers and the per-account account-statistics reader: each account reads through its own header, the specials are never zeros, and the nickname column is provably never read"
    requirement: INSIGHT-02
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-account-stats.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Tanks group: the most-played tank with its top five, the favourite class with its coverage, the fleet and the favourite nation, summed per account folder with the garage-only rows excluded"
    requirement: INSIGHT-02
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-tanks.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Records group: the maximum across accounts with the record tank from the account that holds it, a missing column named, an unrecorded tank reading as no tank"
    requirement: INSIGHT-02
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-records.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The eight tiles are live in the channel answer: the worker passes the worker-only lookup into buildOverviewView and the answer carries the oracle's figures"
    requirement: INSIGHT-06
    verification:
      - kind: integration
        ref: "tests/unit/import/overview-worker.test.ts"
        status: pass
    human_judgment: false

plan_head_before: db532156f4c5dac65df45986a9b559aae003fd10
plan_head_after: e1a8b5cbe2cefad166894974108b641d9b924c78
commits: 3

duration: 11 min
completed: 2026-10-23
status: complete
---

# Phase 13: Plan 07 Summary

**The Tanks and Records tiles, computed per account through each account's own header and live in the channel answer**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-23T11:55:53Z
- **Completed:** 2026-10-23T12:06:36Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Four pure modules — the shared column readers, the account-statistics reader, the Tanks reducers and the Records reducers — that read the two statistics files without ever applying one account's header to another account's cells (CR-01).
- The eight tiles the Overview owed are real: the most-played tank with its top five, the favourite class with an honest coverage, the fleet, the favourite nation, and the four records taken as a MAXIMUM with the tank from the account that holds it (D-19).
- A tank the table does not have keeps its tag-derived name and the class `unknown`, the class tile is absent rather than zero when no battle resolves a class, and a record whose id is missing reads as no tank (D-09).
- The account-statistics NICKNAME is never read at all: a Proxy-wrapped row records every property the reader touches and `NAME` is not among them (D-18, T-13-19).
- The channel answer is proven end to end through the REAL worker: an import of the synthetic archive answers with the eight tiles carrying the oracle's figures.

## Task Commits

Each task was committed atomically:

1. **Task 1: The shared column readers and the per-account account-statistics reader** - `728d347` (feat)
2. **Task 2: The Tanks group - most-played tank, class split with coverage, fleet, nation** - `0ce8dbc` (feat)
3. **Task 3: The Records group - maximum across accounts, then wire both groups into the answer** - `e1a8b5c` (feat)

**Plan metadata:** committed separately as the docs commit for this plan.

## Files Created/Modified

- `src/lib/features/overview/overview-columns.ts` - The shared readers: `resolveFields` (one walk of a row's keys, the first matching key wins), `readCount`, `readTankId`, `clampName`. Imports only the worker's row type and its two helpers.
- `src/lib/features/overview/overview-account-stats.ts` - `readAccountStats`: one row per account, each resolved from that account's own first row, plus the flags that say which columns the export carried.
- `src/lib/features/overview/overview-tanks.ts` - `buildTankTiles` (the four Tanks tiles) and `sumVehicleBattleSeconds` (the per-vehicle battle-time fallback plan 13-08 uses).
- `src/lib/features/overview/overview-records.ts` - `buildRecordTiles`: the maximum across accounts for the three per-battle records and the series.
- `src/lib/features/overview/overview-aggregate.ts` - `buildOverviewView(inputs, lookup)` now collects the built tiles by id and lays them out by the catalogue.
- `src/lib/worker/data-queries.ts` - The `overview` case passes the worker-only `defaultVehicleLookup`.
- `tests/unit/overview/overview-account-stats.test.ts` - The per-account reader, the specials, the id pattern, the Proxy canary.
- `tests/unit/overview/overview-tanks.test.ts` - The oracle in both table worlds, the garage-only row, the hostile names, the absent states.
- `tests/unit/overview/overview-records.test.ts` - The maximum across accounts, the tie, the missing column, the aggregate-level view.
- `tests/unit/import/overview-worker.test.ts` - The explicit absent-tile list for the tracer, and a new case that proves the eight tiles through the real worker.

## Decisions Made

- **A record is a maximum, and its tank belongs to the holder (D-19).** The fold keeps the row with the largest non-null figure and takes that row's tank id. A strict `>` keeps the EARLIER account when two hold the same figure, because two accounts with the same best battle recorded the same best battle.
- **"The column is missing" and "the value is missing" are different absences.** The first names the column (`DAMAGE_MAX`, `XP_MAX`, `FRAGS_MAX`, `SNIPER_SERIES_MAX`), because the export revision does not carry it. The second names the source only, because the column IS in the export and there is nothing to add.
- **A zero is a real record.** An account that never scored a kill has `FRAGS_MAX` 0, and that is shown as 0; an absent record is a missing one, never a zero.
- **The lookup is a parameter of `buildOverviewView`.** The tank table is worker-only (D-08), so `overview-aggregate.ts` imports the lookup's TYPE and never the table; the worker passes `defaultVehicleLookup` in.
- **The tiles are collected by id and then laid out.** Each group hands over an array; the builder puts them in a map and maps the catalogue. The order cannot drift, and a group that contributes nothing cannot shift the others.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Map.get` answers `undefined`, not `null`, for a key the map does not hold**
- **Found during:** Task 1 (`readAccountStats`)
- **Issue:** `resolveFields` returns a `Map<string, string | null>`, and `Map.get` answers `string | null | undefined`. The plan's `cell(row, key)` takes `string | null`, so every read was a type error.
- **Fix:** One `keyOf(keys, id)` helper per module turns "not a key" into "no column" - the difference between an absence and a zero (D-09).
- **Files modified:** `src/lib/features/overview/overview-account-stats.ts`, `src/lib/features/overview/overview-tanks.ts`
- **Verification:** `pnpm run check` exits 0
- **Committed in:** `728d347` (Task 1 commit)

**2. [Rule 1 - Bug] The favourite class was typed as any class, including `unknown`**
- **Found during:** Task 2 (`buildTankTiles`)
- **Issue:** The shared contract declares the favourite class as `Exclude<OverviewClassKey, 'unknown'>` - a tile whose favourite is "unknown" would name no class at all. The filter that removes `unknown` from the candidates did not narrow the type, so `tsc` refused the tile.
- **Fix:** The filter is a type predicate, so the favourite is a KNOWN class by construction, and the tile is absent when no known class resolves a battle.
- **Files modified:** `src/lib/features/overview/overview-tanks.ts`
- **Verification:** `pnpm run check` exits 0; `tests/unit/overview/overview-tanks.test.ts` passes
- **Committed in:** `0ce8dbc` (Task 2 commit)

### Informational

**The tracer's absent-tile assertion did not shrink the way the plan predicted.** Plan 13-07's Task 3 said the tracer test's assertion that "the other fifteen tiles are absent" would be updated to the tiles that remain absent - "time-group tiles other than Logged in, cred, bat, ord" - which implies the eight Tanks and Records tiles would be real in that test. They are not, and cannot be: the tracer imports a legacy `Sessions.csv`, which carries NEITHER statistics file, so both groups have no source at all and all fifteen tiles stay absent with a null column. The assertion was updated to the truth rather than to the prediction - an explicit list of the fifteen ids, plus the count - which is a STRONGER claim than the loop it replaces, because a tile that grew a source without the export growing one now fails loudly.

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), plus 1 informational plan-assumption correction.

**Impact on plan:** Both fixes are type-level and change no behaviour. No scope creep; every symbol the plan named exists and every acceptance criterion is met.

## Issues Encountered

- The committed tank table holds ZERO rows until plan 13-15 runs the generator behind the Terms-of-Use checkpoint, so the world the worker-level test sees is the "no table" world: the tag-derived names, no class anywhere and no record tank. That is the designed second world (D-09), and it is why every unit suite injects a synthetic table instead of reading the committed one - so the suites pass whether the table is empty or full.
- `vitest` runs in Node with no Svelte plugin, so the tile assertions are plain-object assertions on the built tiles rather than rendered markup. The page's rendering is a later plan's job.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The eight tiles are live in the channel answer, so plan 13-08 (Time and Totals) can add its own tiles the same way: build an array, hand it to `buildOverviewView`, and the catalogue order holds.
- `sumVehicleBattleSeconds` is ready for plan 13-08's "In battle" fallback: it reads the per-vehicle `BATTLE_LIFE_TIME_SEC` column per account group and answers null when no account carries it.
- The small-sample guards (`MIN_BATTLES_PLAIN_RATE`, `MIN_BATTLES_TANK_RATE`) are declared in the shared contract and are NOT yet applied by this plan - the tiles here show counts and shares, and plan 13-08's Totals group is where a plain rate first appears.
- The class tile is absent while the committed table is empty; plan 13-15 (the generator) turns it into a real tile, and the unit suites already cover both worlds.
- The three requirement ids this plan declares are all BLOCKED by the shared-id gate, so none is marked complete here: INSIGHT-02 is declared by five plans, INSIGHT-06 by three and INSIGHT-07 by nine. The gate re-evaluates them as the last declaring plan of each lands; the entry is in `.planning/WINDOWS.md`.

---
*Phase: 13-overview-personal-insights*
*Completed: 2026-10-23*

## Self-Check: PASSED

- Every key file named in `key-files.created` exists on disk (7/7 found).
- Every task commit is an ancestor of HEAD: `728d347`, `0ce8dbc`, `e1a8b5c` (3/3 found).
- The plan-level verification passes: `pnpm exec vitest run tests/unit/overview tests/unit/import/overview-worker.test.ts tests/unit/guards` (14 files, 417 tests), the full unit suite (150 files, 4511 passed, 9 pre-existing expected fails), `pnpm run check` (0 errors, 0 warnings) and `pnpm run lint` (clean).
- The measured commit count is 3 (`git rev-list --count db53215..e1a8b5c`), matching the frontmatter.
