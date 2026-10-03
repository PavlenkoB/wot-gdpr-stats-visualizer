---
phase: 05-vehicle-stats-financial-dashboards
plan: 02
subsystem: testing
tags: [csv, fixtures, oracle, papaparse, deterministic, seeded, proto, hostile-input, special-values]

requires:
  - phase: 04-activity-time-dashboards
    provides: >-
      the independent-oracle method from 04-03 (a helper that recomputes an
      answer from raw rows with logic of its own) and the hand-fixture layout
      from 04-11, both extended here for vehicle rows.
  - phase: 05-vehicle-stats-financial-dashboards
    provides: >-
      plan 05-01, which built the finance side of the same fixture/oracle pair
      this plan mirrors: the zero-import oracle discipline, the namespace-import
      RED technique, and the single shared `mulberry32` PRNG.
  - phase: 02-defensive-parsing-persistent-dataset
    provides: >-
      `parseCsvFile`, which these fixtures have to survive unchanged.

provides:
  - >-
    tests/fixtures/player-stats-fixtures.ts: `WOT_MAIN_HEADER` (the export's
    own sixteen of the real 47 columns, verbatim and in order),
    `renderStatsCsv` writing the export's physical shape (bare unquoted header,
    quote-all data cells, `;` separators, bare CR on every line including the
    last), `STATS_NAME_CANARY`, and `PLAYER_STATS_SAMPLE_FILES`.
  - >-
    Nineteen real-named files for four titles, 47 rows in total:
    `WOT_Vehicle_Statistics` (6), `WOT_Vehicle_Statistics_by_Type` (5),
    `WOT_Battle_Types_Statistics` (5), `WOT_Account_Statistics` (1),
    the four `WOTB_` files (3/2/2/1), the four `WOWS_` files (3/4/2/1), the four
    `WOWP_19`/`WOWP_20` files (3/1/4/1), plus `WOT_Fallout_Vehicle_Statistics`,
    `WOWS_Crews` and `WOWS_Account_Storage` recognised and counted but never
    displayed (D-07).
  - >-
    Every shape that breaks naive code: WoT by_Type carries codes 1, 2, 10
    while Battle_Types lists 1, 2, 10, 11, 13, so a summary row can have no
    selectable option; Warships by_Type adds to 18 against 9 real battles, so
    per-ship rows cannot be summed across types; `N/D` in every WOWP_19 damage
    cell; `N/A` in the Blitz premium expiry and `1970-01-01 00:00:00` in the WoT
    one; WOWP_20 with no vehicle identifier at all.
  - >-
    Hand-derived answer key in `PLAYER_STATS_EXPECTED`: per-file row counts,
    per-title totals and battle sums (WoT 162, Blitz 28, Warships 9, Warplanes
    4), zero-battle counts (1/1/1/2), selectable and summary battle-type codes,
    the Warplanes 20 note figures (4 records, 8 battles), and the WoT win rates,
    average damages and default order — each with its arithmetic in the comment
    beside it.
  - >-
    tests/helpers/vehicle-oracle.ts: `oracleRatio`, `oracleDefaultOrder` and
    `oracleBattleTypeCodes`, with ZERO import statements — not even of a type.
    No `localeCompare` anywhere, no formatting, and an absent column, `N/D`,
    `N/A`, a blank and a zero denominator are five distinct results.
  - >-
    `generateVehicleMainCsv`, `VEHICLE_SCALE_5K_SPEC` (seed 987654321, 5000
    rows) and `vehicleScaleExpected`. Real key: 5000 rows, 250 zero-battle,
    largest battles 3000, first row `sweden:V4655Tank` then `ussr:V1467Tank`
    and `china:V1192Tank`; 642,708 bytes, byte-identical across generations.
  - >-
    tests/unit/player-stats-fixtures.test.ts: 33 tests — the tracer round trip,
    the nineteen-file set, the code lists, the special values and the canary,
    the oracle agreement, and generator determinism.

affects: [phase-05, vehicle-stats, 05-05, 05-07, 05-12, 05-16, test-suite-growth]

actuals:
  tokens: 22805
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - >-
      An answer key that must hold a hostile identifier is built with
      `Object.fromEntries`, never an object literal. `{'__proto__': 500}` assigns
      the prototype instead of creating a property, so the key silently loses the
      very row it exists to protect — and the failure looks like a missing test
      rather than a missing key.
    - >-
      A percent-shaped derived value records the oracle's PRODUCT, not the
      mathematical value, and a test states why: `(55 / 100) * 100` is
      `55.00000000000001`. A key that recorded `55` would disagree with the
      implementation for a reason that has nothing to do with the export.
    - >-
      A generated fixture's answer key comes from the independent oracle and is
      then recomputed a third time in the test from the rows as the PRODUCTION
      parser reads them. Three derivations catch a renderer/reader disagreement
      that two would cancel out.

key-files:
  created:
    - tests/fixtures/player-stats-fixtures.ts
    - tests/helpers/vehicle-oracle.ts
    - tests/unit/player-stats-fixtures.test.ts
  modified: []

key-decisions:
  - >-
    Headers come from the plan's verbatim strings, which agree with the
    05-RESEARCH evidence table. Every per-title spelling of the same idea is
    reproduced as it is: `WINS_COUNT` (WoT) vs `WINS` (Blitz, Warplanes),
    `BATTLES_COUNT` (WoT, Blitz, Warships) vs `GAMES_PLAYED` (Warplanes 19) vs
    `BATTLES` (Warplanes 20), and `PREMIUM_EXPIRES_AT` (WoT) vs
    `PREMIUM_EXPIRY_TIME` (the rest). RESEARCH Pitfall 9's spelling list is not
    optional for Warplanes.
  - >-
    Only SIXTEEN of the real file's 47 WoT columns are reproduced, plus
    `ACHIEVEMENTS` and `FRAGS` (the two columns the real sample leaves blank,
    blank on every row here). The research recorded the names Phase 5 READS, not
    all 47, so the fixture is not a byte copy of a real file and a plan needing
    one of the other 31 must add it rather than guess it.
  - >-
    `oracleRatio` returns the ratio times 100, because its callers are
    percentages, and an average is that divided by 100 again. The rule is stated
    in the oracle header, the halving happens once in a named `unscaled` helper
    in the test, and the float artefact it introduces is a test of its own.
  - >-
    The four ratio outcomes are decided by STRING EQUALITY before any parse, in
    a fixed order: absent column, then `N/D`, then `N/A`/blank/unparseable, then
    a zero denominator, then the quotient. Absent column comes first so it
    reports itself rather than borrowing the absent cell's spelling, and `N/D`
    over zero battles is `nd` rather than `dash`.
  - >-
    `oracleDefaultOrder` takes the id and battle column names as defaulted
    PARAMETERS rather than growing a per-title column map. Naming them keeps the
    oracle from duplicating the implementation's mapping, which is the whole
    point of having an oracle.
  - >-
    `WOWP_19.MAX_DAMAGE_DEALT` carries `N/D` as well. The plan specifies `N/D` for
    `TOTAL_DAMAGE_DEALT` only; writing a number in the max column would imply the
    export defines damage at all, which the row's own total denies. A reader that
    special-cased only the total would be right on this data and wrong on a newer
    export.
  - >-
    The three never-displayed files are counted in `PLAYER_STATS_SAMPLE_ROW_COUNT`
    (47) but in NO title's `totalRows`. A Fallout vehicle is not a WoT vehicle,
    so folding it into the WoT table's row total would be a wrong claim about the
    WoT table.
  - >-
    `Warplanes.battlesSum` is 4 (the WOWP_19 `GAMES_PLAYED` total) while
    `warplanes20.battles` is 8. They describe different planes in different
    files and are deliberately never reconciled or added.
  - >-
    The generator draws its nation token from the eight-token list on an INDEX
    CYCLE rather than a random draw, so the RNG stream is untouched by id
    construction and the ids stay evenly spread. Uniqueness comes from the index
    alone.

patterns-established:
  - >-
    Fixture symbols are reached through a namespace import, and a RED is produced
    against a PLACEHOLDER module that exports the right names with empty bodies.
    A missing module is a resolution crash that takes the whole file with it; a
    placeholder yields one assertion failure per behaviour, which is what makes a
    RED readable. 05-01 used the same shape against a pre-correction module state.
  - >-
    The oracle is written BEFORE the fixtures that consume it, inverting the
    plan's GREEN step order, because the test file imports it and the plan
    requires a RED that fails on missing expectations rather than on a crash.
  - >-
    A special-value fixture cell is asserted over the PARSED rows, never over the
    fixture source, so the assertion proves the value survived the production
    parser rather than that the source contains a string.

requirements-completed: [STATS-01]

coverage:
  - id: D1
    description: >-
      The WoT main vehicle file with the real sixteen-column header, the
      export's quote-all/bare-CR physical format and six fabricated rows survives
      `parseCsvFile` with every vehicle id byte for byte, including the markup
      opener and `__proto__`.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/player-stats-fixtures.test.ts#05-02 tracer: WoT main vehicle file through the production parser'
        status: pass
    human_judgment: false
  - id: D2
    description: >-
      Nineteen real-named files for four titles parse to exactly the row counts
      the answer key records, summing to 47, and every header is the export's own
      per-title spelling.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/player-stats-fixtures.test.ts#05-02 file set: nineteen real-named Player_statistics files'
        status: pass
    human_judgment: false
  - id: D3
    description: >-
      WoT by_Type offers codes 1, 2, 10 in numeric order (plain string order would
      give 1, 10, 2) while the Battle_Types summary lists 1, 2, 10, 11, 13, so a
      summary row can exist with no selectable option; Blitz offers 1 and 3,
      Warships 1 and 2, Warplanes none.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/player-stats-fixtures.test.ts#05-02 battle-type codes: by_Type selects, Battle_Types summarises'
        status: pass
    human_judgment: false
  - id: D4
    description: >-
      The NAME canary is in exactly the five account files and asserted absent
      from the other fourteen; `N/A` in the Blitz premium expiry, `1970-01-01` in
      the WoT one, `N/D` in every WOWP_19 damage cell, no vehicle identifier in
      WOWP_20, and Warships by_Type adding to exactly twice the ship file.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/player-stats-fixtures.test.ts#05-02 special values and the NAME canary'
        status: pass
    human_judgment: false
  - id: D5
    description: >-
      The independent oracle reproduces every hand-derived WoT figure — win rates
      55.00000000000001 / 37.5 / 42.857142857142854 / dash / 50 /
      33.33333333333333, average damages 1200 / 750 / 714.2857142857143 / dash /
      750 / 500, and the six-id default order — with zero import statements and
      no locale collation.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/player-stats-fixtures.test.ts#05-02 vehicle oracle agrees with the hand-derived WoT numbers'
        status: pass
    human_judgment: false
  - id: D6
    description: >-
      The seeded 5,000-vehicle generator is byte-identical for a seed, parses to
      5,000 rows with 250 positional zero-battle vehicles and 5,000 distinct ids,
      and its answer key is the oracle's, recomputed a third time from the parsed
      rows.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/player-stats-fixtures.test.ts#05-02 seeded 5,000-vehicle generator'
        status: pass
    human_judgment: false
  - id: D7
    description: >-
      Whether the real 2021 export really uses these header lists, these file
      names and this quote-all/bare-CR physical shape. This plan encoded the
      researched evidence faithfully and no real sample was opened, because
      doing so is outside it.
    verification: []
    human_judgment: true
    rationale: >-
      Only a human with access to a real export can confirm the physical shape and
      the exact column names. 05-RESEARCH recorded header lines and shape
      histograms with digits replaced; this plan is faithful to that evidence and
      the tracer tests prove the fixture matches it.

duration: 25min
completed: 2026-10-01
status: complete
---

# Phase 05-02: Player_statistics fixtures, answer keys and the independent oracle

**Nineteen real-named, real-column vehicle CSV files for four titles with hand-derived answers, an oracle that imports nothing at all, and a seeded 5,000-vehicle generator — 33 tests, 955 in the suite**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-01T10:45:11Z
- **Completed:** 2026-10-01T11:10:00Z
- **Tasks:** 3
- **Files modified:** 3 (all created, 2,151 lines)

## Accomplishments

- **The answer key caught a bug in itself, and it was the `__proto__` bug.**
  Two of the Task 2 tests failed on `expected['__proto__']` returning
  `[Object: null prototype] {}` instead of `500`. An object literal cannot
  express that key at all: `{'__proto__': 500}` assigns the prototype rather than
  creating a property, and a primitive there is silently ignored, so the row
  **vanished from the map meant to protect it**. Both hand-derived maps are now
  built with `Object.fromEntries`, which defines own data properties, and a test
  pins the behaviour by asserting the trap (`Object.keys({'__proto__': 500})` is
  `[]`) beside the fix. This is the same collision 05-01 flagged at
  `src/lib/worker/csv-parse.ts:79`, met from the other side — and it is a
  concrete reason plan 05-05 must group vehicles with `Map`.
- **The oracle has zero import statements.** Not "no import from `src/lib`" — no
  imports at all, not even of a type; `grep -cE '^\s*import '` prints 0. It
  re-keys rows through `Record`, decides special values by string equality
  before any parse, compares strings with `<` so no `localeCompare` can creep in,
  and returns numbers and four special strings without rendering anything.
- **The percent scaling is a test, not folklore.** `(55 / 100) * 100` is
  `55.00000000000001`, so the answer key records the oracle's **product**, not the
  mathematical value, and a dedicated test shows the artefact next to the numbers
  it protects — the same treatment 05-01 gave `(15.495).toFixed(2)`.
- **Every shape that breaks naive code is present.** WoT by_Type offers codes
  1, 2, 10 while the summary lists five (so a summary row has no selectable
  option), Warships by_Type adds to 18 against 9 real battles (so per-ship rows
  cannot be summed across types), `N/D` is in every WOWP_19 damage cell, Blitz
  writes `N/A` for its premium expiry, and WOWP_20 has no vehicle identifier at
  all.
- **One PRNG, and a key derived three times.** `mulberry32` is imported from
  `sessions-fixtures.ts` rather than copied, the scale key comes from the oracle,
  and the test then recomputes it from the rows as the **production parser** reads
  them — so a renderer/reader disagreement cannot cancel itself out.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — real-header WoT vehicle file through the production parser** — `748b163` (test)
2. **Task 2: Nineteen real-named files with an independent vehicle oracle** — `4bcddaf` (test)
3. **Task 3: Seeded 5,000-vehicle generator with an oracle-derived answer key** — `bfe25bc` (test)
4. **Plan metadata** — this SUMMARY

### RED and GREEN evidence, as recorded

| Task | RED | GREEN |
|------|-----|-------|
| 1 | `Tests 5 failed (5)`, exit 1 — `AssertionError: expected [ 'WOT_Vehicle_Statistics.csv' ] to deeply equal [ Array(19) ]` on the header constant and `expected [] to deeply equal [ 'china:Ch24_Type64', …(5) ]` on the ids | `Tests 5 passed (5)`, exit 0 |
| 2 | `Tests 16 failed \| 9 passed (25)`, exit 1 — all on missing exports and missing rows (`TypeError: Cannot read properties of undefined (reading 'rowCountsByFile')`, `expected [] to deeply equal [ '1', '2', '10' ]`); no module crash | `Tests 26 passed (26)`, exit 0 |
| 3 | `Tests 7 failed \| 26 passed (33)`, exit 1 — all `TypeError: generateVehicleMainCsv is not a function` | `Tests 33 passed (33)`, exit 0 |

Between RED and GREEN, Tasks 2 and 3 each had one intermediate run with real
failures (2 and 1 respectively). The Task 2 pair was the `__proto__` key bug
above. The Task 3 one was my own test asserting the ISO timestamp regex BEFORE
checking for the blank zero-battle case, so 250 correct rows failed a test that
was wrong, not the generator; the guard now comes first.

## Files Created/Modified

- `tests/fixtures/player-stats-fixtures.ts` — `STATS_NAME_CANARY`,
  `renderStatsCsv`, `WOT_MAIN_HEADER`, `PLAYER_STATS_SAMPLE_FILES` (19 files),
  `PLAYER_STATS_SAMPLE_ROW_COUNT`, `PLAYER_STATS_EXPECTED`,
  `generateVehicleMainCsv`, `VEHICLE_SCALE_5K_SPEC`, `vehicleScaleExpected`.
- `tests/helpers/vehicle-oracle.ts` — `oracleRatio`, `oracleDefaultOrder`,
  `oracleBattleTypeCodes`, and the three types they take and return. Imports
  nothing.
- `tests/unit/player-stats-fixtures.test.ts` — 33 tests across five describes:
  the tracer, the file set, the code lists, the special values and the canary,
  the oracle agreement, and the generator.

## Decisions Made

- **Headers come from the plan's verbatim strings**, character by character,
  because 05-01 lost a commit to a research table that was transcribed from
  memory. They agree with the 05-RESEARCH evidence table everywhere, including
  the Warplanes account columns that RESEARCH Pitfall 9 flags.
- **`oracleRatio` scales by 100 and the caller scales back** for an average. The
  halving lives in one named `unscaled` helper in the test rather than inline at
  four call sites, and the helper's doc says why.
- **An absent column is not a blank cell.** `undefined` reports `missing`, `''`
  reports `na`. A file that lacks a field and a file that has the field with
  nothing in it are different facts (D-10's "not in export" vs D-09's "not
  available").
- **An unreadable battle count sorts below a real zero**, not above it. D-09 says
  a special value never counts as 0 in a sort, so `N/D` sits under the
  zero-battle vehicle rather than competing with it.
- **`WOWP_19.MAX_DAMAGE_DEALT` is `N/D` too**, though the plan names only the
  total column. See Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Correctness - Data] The answer key's `__proto__` entries vanished into the prototype**
- **Found during:** Task 2, on the first GREEN attempt
- **Issue:** one of the six WoT hand-derived keys is `__proto__`. Written as an
  object literal, `{'__proto__': 500}` assigns the prototype rather than creating
  a property, and a primitive there is silently ignored — so the key disappeared
  and a lookup returned `Object.prototype`. Two tests failed with
  `expected 500 to deeply equal { …(12) }` and `expected {} to deeply equal
  [Object: null prototype]`.
- **Fix:** both maps are built with `Object.fromEntries`, which defines own data
  properties. A new test asserts the trap and the fix side by side.
- **Files modified:** `tests/fixtures/player-stats-fixtures.ts`,
  `tests/unit/player-stats-fixtures.test.ts`
- **Verification:** the `__proto__` key test and the full 33-test file, exit 0
- **Committed in:** `4bcddaf`

**2. [Task 3 - Test bug] The ISO timestamp assertion ran before the blank-row guard**
- **Found during:** Task 3, first GREEN attempt
- **Issue:** my test asserted `LAST_BATTLE_AT` matches an ISO regex before
  checking that the 250 zero-battle vehicles legitimately carry a blank there.
  250 correct rows failed a test that was wrong.
- **Fix:** the blank case is now checked first and keyed on `battles === 0`.
- **Files modified:** `tests/unit/player-stats-fixtures.test.ts`
- **Verification:** the generator describe, 7 tests, exit 0
- **Committed in:** `bfe25bc`

### Planned deviations, made deliberately

**3. Task 1 exports `PLAYER_STATS_SAMPLE_FILES` with one key rather than none.**
The plan says the six WoT rows are a module-private constant in Task 1 "which
Task 2 exposes through `PLAYER_STATS_SAMPLE_FILES`", and also says not to add any
other export in that task. Taken literally, the tracer has no way to reach the
file it is meant to prove travels through the parser — a module-private constant
is unreachable from a test. Exposing the map with the single WoT key keeps the
tracer honest (the CSV text comes from the module, not from literals duplicated
in the test) and leaves the plan's final export surface unchanged. The six ids
are still spelled out by literal in the test, so a writer mistake still fails.

**4. The oracle is written before the fixtures that consume it.** The plan's Task 2
GREEN order puts the oracle last, but the test file imports it, so a missing
module would crash every test in the file — and the plan's own Task 2 acceptance
criterion requires a RED "on missing hand expectations, not on a crash". Same
inversion as 05-01. Files and dependency order are unaffected: the oracle is a
leaf.

**5. `VehicleScaleExpected` is exported alongside `VehicleScaleSpec`.** The plan
names only `VehicleScaleSpec`, but `vehicleScaleExpected` returns that shape, so a
declaration is required for the annotation to be checkable. Nothing else was
added to the export surface; the three oracle functions and the nine fixture
symbols are exactly the plan's list.

**6. `WOWP_19.MAX_DAMAGE_DEALT` carries `N/D`.** The plan specifies `N/D` for
`TOTAL_DAMAGE_DEALT` only. Writing a number in the max column would imply the
export defines damage at all, which the row's own total denies, and a later plan
reading the max would then display a damage figure for a game whose damage is
undefined. Both cells now read `N/D` and the reasoning is at the row.

**7. The Blitz by_Type/battles and the WoT account balances are fabricated where
the plan left them open.** The plan fixes the battle counts and codes for
`WOTB_Vehicle_Statistics_by_Type` (15 and 2 battles) and says the rest are
"fabricated plausible integers"; it names no values for `CREDITS`, `GOLD`,
`FREE_XP` or `PREMIUM_PLUS_EXPIRES_AT`. Those carry invented numbers rather than
blanks, because a blank in a real column no aggregation reads would wrongly
suggest the export never writes it — the reasoning 05-01 recorded for
`CURR_PREMIUM` and `UPDATED`.

---

**Total deviations:** 2 auto-fixed (1 wrong-data, 1 wrong-test), 5 planned
**Impact on plan:** both auto-fixes were necessary for correctness. No scope
creep; all five planned deviations are documented contracts that later plans must
honour or explicitly change.

## Issues Encountered

- **Every order row would have collapsed onto one card** — the failure mode 05-01
  hit. Caught by transcribing every header from the plan text rather than the
  research table, and by asserting `Object.keys(parsed.rows[0].data)` against the
  real sixteen names in the tracer.
- **`prefer-const` and `as const` narrowing noise.** The oracle's two-step parse
  needed `const` bindings, and the fixture's `as const` answer key made the test's
  dynamic lookups and arithmetic un-typeable. The test widens the row-count map to
  `Readonly<Record<string, number>>` for the lookup, deliberately: the file-name
  list stays `readonly string[]` so a name the fixture lacks is an assertion
  failure rather than a compile error, which keeps the test able to fail.
- **A 5,000-row generated file is 642,708 bytes** and is generated ten times
  across the file's tests. The whole file costs about 0.5 s, so it is parsed with
  the production parser rather than counted by line — at this size parsing proves
  something counting does not.

## Not changed, but noticed

- `src/lib/worker/csv-parse.ts:79` — `fixed[k] = v` assigns through a plain
  object, so a header cell literally named `__proto__` would still be dropped.
  This plan's fixture uses `__proto__` only as a **value**, which survives
  (asserted in the tracer), so nothing here is affected. Out of scope
  (`src/` is untouched, as the plan requires) but it is now demonstrated from two
  directions: a hostile column name and a hostile key in an answer map.
- `tests/fixtures/sessions-fixtures.ts` — `mulberry32` is now imported by a third
  fixture module, so it is a shared fixture primitive rather than a sessions
  detail.
- `tests/unit/player-stats-fixtures.test.ts` spells the nineteen file names and
  the six WoT ids out by literal. That duplication is the point (it is what makes
  a drifted fixture fail), but it means a D-04 rename needs this file edited in
  the same commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **05-05 (the vehicle builder)** can import `WOT_MAIN_HEADER`,
  `PLAYER_STATS_SAMPLE_FILES`, `PLAYER_STATS_EXPECTED` and
  `STATS_NAME_CANARY`, and must implement four rules the key now pins:
  battle-type codes ordered NUMERICALLY (`1, 2, 10`, never `1, 10, 2`); ties in
  the default sort broken by cleaned id in **code-unit** order, never
  `localeCompare`; `N/D` and `N/A` never displayed or sorted as 0; and a missing
  column distinct from a blank cell. Group vehicles with `Map`, not a plain
  object — see the `__proto__` finding above.
- **05-07 (the worker round trip)** can assert the canary never appears in any
  message, and that all nineteen files import and count correctly.
- **05-12 (the windowed table)** can assert `{n} vehicles · {z} with no battles`
  against `titles.wot.vehicleRows` and `zeroBattleCount`, and that the default
  order equals `wotHandDerived.defaultOrderIds`.
- **05-16 (the scale spec)** has `VEHICLE_SCALE_5K_SPEC` and a key whose
  `largestBattles` (3000) and `firstRowId` (`sweden:V4655Tank`) satisfy UI-SPEC
  section 15's "the first row has the largest battle count". Editing any draw in
  the generator regenerates every byte and invalidates the key, so such a change
  must be one atomic commit covering generator, key and tests.

---

*Phase: 05-vehicle-stats-financial-dashboards*
*Completed: 2026-10-01*
