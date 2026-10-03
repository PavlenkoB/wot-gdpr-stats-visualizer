---
phase: 05-vehicle-stats-financial-dashboards
plan: 14
subsystem: ui
tags: [svelte-5, runes, playwright, vitest, csv, table, disclosure, accessibility]

# Dependency graph
requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: "05-05's buildVehicleView (battleTypes, summary, header, wowp20, allBattlesOnly, columns), 05-09's vehicle-model (sortRows, filterRows, visibleColumns, windowRange), 05-10's ui-copy inventory, 05-12's PlayerStats + VehicleTable + vehicle-state + the windowed table"
provides:
  - "BattleTypeSummary.svelte — a native table in an OPEN details, one row per code of the export's own Battle_Types file"
  - "selectionAfterBattleType(previous) — resets the sort and the search, keeps the picked extras"
  - "PlayerStats.svelte: battle-type select, per-title header, Warplanes 20 note, Warships all-battles note, column picker"
  - "11 new browser specs and 15 new source-contract tests"
affects: [05-15, 05-16, vehicle-stats, ui-copy, ci-budget]

actuals:
  tokens: 83240
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A control is ABSENT rather than disabled when the export offers nothing to choose (battle type, picker extras)"
    - "The picker/select LIST is derived from the view, never hand-maintained beside it"
    - "One cell formatter for every cell in the phase, so a special means the same thing in every table"

key-files:
  created:
    - "src/lib/components/BattleTypeSummary.svelte"
  modified:
    - "src/lib/components/PlayerStats.svelte"
    - "src/lib/vehicle-state.ts"
    - "src/lib/ui-copy.ts"
    - "src/lib/vehicle-shared.ts"
    - "tests/unit/vehicle-blocks.test.ts"
    - "tests/unit/vehicle-state.test.ts"
    - "tests/unit/ui-copy.test.ts"
    - "tests/e2e/vehicle-stats.spec.ts"
    - "tests/e2e/dashboard.spec.ts"
    - "playwright.config.ts"
    - ".github/workflows/ci.yml"

key-decisions:
  - "A battle-type change KEEPS the picked extras, and a pick the new view cannot show is RETAINED rather than dropped — `visibleColumns` ignores it while the view lacks the column. The plan's behaviour list says 'drops any the new view lacks'; the plan's own planner assumption says 'a key left over from a previous view is neither shown nor counted'. The second is both the implemented behaviour and the better one: a column that vanished for the length of a battle-type change is the churn the keep rule exists to avoid. The test now asserts the retention, and the plan's phrasing should be read that way."
  - "A non-sortable header keeps `aria-sort=\"none\"` rather than losing the attribute. 05-14's prose says 'carry no aria-sort'; the UI-SPEC (the approved contract) says every `th` carries `ascending|descending|none` and 05-12's source contract pins the attribute on every column. A non-sortable column is identified by the ABSENCE OF THE BUTTON, and the test asserts that."
  - "A battle-type summary's `<details>` is `open` and the column picker's is not. The UI-SPEC prescribes `open` for the summary and says nothing for the picker; a picker is a control the reader goes to, reference is what they came to read."

patterns-established:
  - "Absent, not disabled: a control with nothing to choose between is not rendered. E3's empty state, and the same silence Phase 4 used for an absent split."
  - "A reset must NAME every field it resets. `{ ...selection, ...selectionAfterTitle() }` copies every key the returned object does not mention, so a key added after the reset was written silently survives it. The title reset now writes `pickedExtraKeys: []` at the call site."
  - "A percent CELL is a percentage, not a ratio: the builder scales once and the formatter formats. Two scales is how a Warplanes plane with 2 wins in 4 games read `5,000.0%`."

requirements-completed: [STATS-01]

coverage:
  - id: D1
    description: "A native Battle type select beside the Game select, rendered only when the applied view's by_Type file has codes, with All battles then one option per code in numeric order and never a code the by_Type file lacks; choosing a code swaps the table to that code's rows and shows the partial-coverage note."
    requirement: STATS-01
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicle-stats.spec.ts — (battle-type) WoT code 1 swaps the table and shows the note, All returns the six rows, Warplanes has no control"
        status: pass
      - kind: unit
        ref: "tests/unit/vehicle-state.test.ts — selectionAfterBattleType resets the sort and the search but KEEPS the picked extras"
        status: pass
    human_judgment: false
  - id: D2
    description: "A battle-type summary table in an open details above the table, listing every code of the Battle_Types file including the two the select does not offer, with the Warships double-count note."
    requirement: STATS-01
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicle-stats.spec.ts — (summary) the WoT summary lists five codes in battles order while the select offers three"
        status: pass
      - kind: unit
        ref: "tests/unit/vehicle-blocks.test.ts — 05-14 Task 2, the battle-type summary: a native table in an OPEN details (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A per-title header showing lifetime battles and premium expiry as written, never the account name and never a balance; omitted without an account row and shown for a no-rows title."
    requirement: STATS-01
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicle-stats.spec.ts — (header) lifetime battles and premium expiry as written, per title; (header) no account row omits the header, and a missing column reads not in export"
        status: pass
    human_judgment: false
  - id: D4
    description: "Warships All battles shows battles, last battle and in-garage with every win-rate and average-damage cell reading Available per battle type, non-sortable headers and a note saying why; code 1 swaps to the numeric columns."
    requirement: STATS-01
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicle-stats.spec.ts — (warships) all-battles reads per-battle-type, has plain headers, and code 1 swaps to numbers"
        status: pass
    human_judgment: false
  - id: D5
    description: "Warplanes shows its three named planes with N/D damage as not defined and never 0, a zero-game win rate as a dash with hidden text, and the WOWP_20 record/battle sentence as a note rather than a table."
    requirement: STATS-01
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicle-stats.spec.ts — (warplanes) named planes, not defined, dashes and the WOWP_20 note"
        status: pass
    human_judgment: false
  - id: D6
    description: "A column picker offering the current view's extras only, appending at the end in pick order, cleared by a title change and kept across a battle-type change; absent for a view with no extras."
    requirement: STATS-01
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicle-stats.spec.ts — (picker) extras are listed per view, appended at the end, cleared by a title change and kept by a battle-type change"
        status: pass
      - kind: unit
        ref: "tests/unit/vehicle-blocks.test.ts — 05-14 Task 3, the column picker is a native details of native checkboxes (4 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A core column whose header is absent from the file reads not in export in every cell, muted, with no 0 and no error, and sorts last through the cleaned-id tie-break in both directions."
    requirement: STATS-01
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicle-stats.spec.ts — (drift) a core column whose header is missing reads not in export, never 0"
        status: pass
    human_judgment: false
  - id: D8
    description: "At 375px with every extra picked the page's scrollWidth does not exceed the viewport, the scroller scrolls in both axes and the sticky header and first column hold their edges, with the corner above both."
    requirement: STATS-01
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicle-stats.spec.ts — (phone-375) with extras the page never scrolls sideways and the scroller keeps its sticky axes"
        status: pass
    human_judgment: false
  - id: D9
    description: "After a title, a battle type, extras, a sort and a search, a replace and a clear-plus-reimport both return every control to its default with no stale value."
    requirement: STATS-01
    verification:
      - kind: e2e
        ref: "tests/e2e/vehicle-stats.spec.ts — (reset) a replace and a clear both put every control back to its default"
        status: pass
    human_judgment: false
  - id: D10
    description: "The rendered figures are CORRECT, not merely present: win rate, average damage, survival and hit ratio are the ratio the export's numbers give. Found and fixed in this plan."
    requirement: STATS-01
    verification:
      - kind: unit
        ref: "tests/unit/ui-copy.test.ts — a percent cell is NOT scaled again on the way out (05-14)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/vehicle-stats.spec.ts — (warships) 57.1% and 50.0% for two wins in 7 and 1 in 2"
        status: pass
    human_judgment: true
    rationale: "The double-scale was found by reading the BUILT page, not by any test: 05-12's sort test only ever compared ORDERS, so a table that was 100x wrong in every percentage passed the whole phase unnoticed. The percentages are now asserted in three places, but only a human comparing a figure against a real export can say the RATIO itself is the right one."

# Metrics
duration: 96min
started: 2026-10-02T10:20:00Z
completed: 2026-10-02T11:58:00Z
commits: 3
plan_head_before: 406a73f98f348123d0acbb76617bcfc141cf4743
plan_head_after: a12b641d3fc15e6054b8e6a4dcb337ffc35cfe1a
status: complete
---

# Phase 05 Plan 14: The Vehicle statistics block, finished

**The battle-type filter and its open summary, the per-title header, Warships' battles-only all-view, Warplanes' undefined damage and its 20-file note, and a per-view column picker — all four titles' views rendered, with no special value shown as a number and nothing summed across battle types.**

## Performance

- **Duration:** 96 min
- **Tasks:** 3
- **Files modified:** 12
- **Commits:** 3

## Accomplishments

- **Four titles, four genuinely different tables.** WoT and Blitz and Warplanes get the six core columns; Warships' All-battles view gets battles, last battle and in-garage with both computed columns reading `Available per battle type` in every cell and neither header carrying a sort button. Nothing is summed across battle types, because nothing is summed at all.
- **The summary lists FIVE codes and the select offers THREE, and that gap is the point.** Codes 11 and 13 are the export's own summary of itself with no by_Type rows to switch to. The gap was previously invisible; it is now the assertion.
- **No special value is ever a number.** `N/D` is `not defined`, `N/A` is `not available`, a missing column is `not in export`, a zero-game ratio is a dash with its reason beside it for a screen reader, and a Warships per-type cell is the per-type note. A column of zeros would be a claim the export never made.
- **A battle-type change keeps the reader's columns; a title change does not.** A pick the new view cannot show is retained rather than dropped, so narrowing the table and coming back does not cost the reader their choices.
- **A percent cell is a percentage, and the plan found it was being scaled twice.**

## Task Commits

1. **Task 1: Tracer — choosing Battle type 1 swaps the WoT table** — `d1bbfbd` (feat)
2. **Task 2: Per-title header, summary, Warships all-battles and the Warplanes 20 note** — `4391ce5` (feat)
3. **Task 3: The column picker, header drift, 375px with extras, and the reset** — `a12b641` (feat)

All three TDD, RED recorded before GREEN. Task 1's unit RED was
`TypeError: selectionAfterBattleType is not a function`; Task 2's was 12
failing source contracts naming a `BattleTypeSummary.svelte` that did not
exist; Task 3's was 3 failing picker contracts plus a browser spec that could
not find `column-picker`.

## Files Created/Modified

- `src/lib/components/BattleTypeSummary.svelte` — **new.** A native table in
  an `open` `<details>`, one row per code, cells through the same
  `formatVehicleCell` the vehicle table uses, a Warships-only note, and a
  `max-height: 320px` scroll box above 12 rows. Renders nothing for a title
  with no summary.
- `src/lib/components/PlayerStats.svelte` — the battle-type select, the
  per-title `<dl>`, the Warplanes 20 note, the summary, the Warships
  all-battles note and the column picker. Two Rule 1 fixes: the percent
  double-scale's other half and the title reset that inherited the extras.
- `src/lib/vehicle-state.ts` — `selectionAfterBattleType(previous)`, which
  returns an empty search, the default sort and **the same picked array it was
  given**.
- `src/lib/ui-copy.ts` — the percent branch of `formatVehicleCell`, and the
  doc comment that says why there is no second multiply.
- `src/lib/vehicle-shared.ts` — one sentence correcting the `ColumnKind`
  doc's "percent is a ratio", which is what made the double scale look right.
- `tests/unit/vehicle-blocks.test.ts` — 15 new source contracts (the summary
  component, the header, the Warplanes and Warships notes, the picker, the
  copy rule extended to the third component).
- `tests/unit/vehicle-state.test.ts` — the `selectionAfterBattleType` cases.
- `tests/unit/ui-copy.test.ts` — the percent branch, plus a test that pins the
  no-second-scale rule with the figure that exposed it.
- `tests/e2e/vehicle-stats.spec.ts` — 11 new browser specs.
- `tests/e2e/dashboard.spec.ts` — the Player_statistics card joins the two
  cards that may hold a `details`, with both its disclosures named.
- `playwright.config.ts` / `.github/workflows/ci.yml` — the three CI limits,
  raised together.

## Decisions Made

1. **A pick the new view lacks is retained, not dropped.** The plan's
   behaviour list and its planner assumption disagree. The assumption wins,
   and it is the better behaviour: dropping a pick because the reader narrowed
   the table and then widened it again is churn, which is the exact thing D-12
   says the keep rule exists to prevent.
2. **A non-sortable header keeps `aria-sort="none"`.** The plan's prose says
   "carry no aria-sort"; the UI-SPEC says every `th` carries one of three
   values, and 05-12's source contract pins the attribute. The absence of the
   BUTTON is what identifies a non-sortable column, and that is asserted.
3. **The summary's disclosure is `open` and the picker's is not.** The UI-SPEC
   prescribes `open` for the summary and is silent for the picker. Reference
   is what the reader came for; a picker is somewhere they go.
4. **`BattleTypeSummary` is its own component rather than a block inside
   `PlayerStats`.** `PlayerStats.svelte` is already 900 lines; the summary's
   table, its geometry and its Warships note are a self-contained thing, and a
   separate file is also what makes a source contract possible at all
   (`vitest.config.ts` has no Svelte plugin, so a component is tested by
   reading it off disk).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] A percent cell was scaled twice**
- **Found during:** Task 2, while enumerating the Warplanes and Warships
  figures the e2e specs would assert.
- **Issue:** The worker's `derived` spec multiplies a ratio by 100 when it
  builds the cell (`scale: kind === 'percent' ? 100 : 1`), and
  `formatVehicleCell` multiplied by 100 again on the way out. A Warplanes
  plane with 2 wins in 4 games read **`5,000.0%`**; a Warships ship with 4 of 7
  read `5,714.3%`. Every percentage in the phase was 100x wrong.
- **Why nothing caught it:** 05-12's sort test only ever compared ORDERS, and
  the unit tests pinned the WORKER's value (55.00000000000001) and the
  FORMATTER's input (0.5533) separately — each half was right and together
  they were wrong by 100.
- **Fix:** The second multiply is gone. `formatPercent` is named for the value
  it is given and now receives it directly. The `ColumnKind` doc's "percent
  is a ratio" is corrected, because that sentence is what made the double
  scale look intentional.
- **Files modified:** `src/lib/ui-copy.ts`, `src/lib/vehicle-shared.ts`,
  `tests/unit/ui-copy.test.ts`
- **Verification:** a new unit test naming the exposed figure, plus e2e
  assertions of 55.0%, 50.0% and 57.1% against the fixture's own wins/battles
- **Committed in:** `4391ce5`

**2. [Rule 1 — Bug] A title change did not clear the picked extra columns**
- **Found during:** Task 3, by the picker's title-change assertion.
- **Issue:** 05-12 wrote `selection = { ...selection, ...selectionAfterTitle() }`.
  A spread copies every key the returned object does not mention, so
  `pickedExtraKeys` — a key that did not exist when that line was written —
  survived every game switch. The spread was correct for the two fields 05-12
  owned and silently wrong for the third.
- **Fix:** `selection = { ...selectionAfterTitle(), pickedExtraKeys: [] }`.
  `selectionAfterTitle()` is left byte-identical and its 05-12 unit test still
  passes; the third field is written at the call site, with a comment saying
  why, because "a reset must name every field it resets" is the general rule
  and a merge is the shape that hides when it is broken.
- **Files modified:** `src/lib/components/PlayerStats.svelte`
- **Verification:** the picker's title-change assertion and the extended
  `(reset)` spec
- **Committed in:** `a12b641`

**3. [Rule 2 — Missing critical functionality] `dashboard.spec.ts` treated a
data disclosure as a section collapse control**
- **Found during:** Task 2, the first full-suite run.
- **Issue:** The spec asserted `card.locator('details')` count 0 for every
  section except two, on D-06's rule that nothing inside a card may control
  the SECTION's own visibility. 05-14's battle-type summary is a `details`
  inside that card, and the assertion failed.
- **Fix:** Player_statistics joins the two exempted cards, and the exemption
  is not a hole: BOTH its disclosures are named and the count is pinned at 2,
  so a disclosure over the section's own content still fails.
- **Files modified:** `tests/e2e/dashboard.spec.ts`
- **Verification:** the full e2e suite, twice
- **Committed in:** `4391ce5`

**4. [Rule 2 — Missing critical functionality] The CI budget's three limits
were left red by this plan's own specs**
- **Found during:** Task 3, the full unit suite.
- **Issue:** 168 listed tests project to 835 s and the 1.3x floor wants
  1085.5 s, so `globalTimeout: 18 * 60 * 1000` (1080 s) stopped passing and
  `tests/unit/ci-budget.test.ts` failed.
- **Fix:** All three limits moved together — 18/20/26 to **19/21/27** — with
  the derivation recorded at each site. Raising one alone would only move
  which of them fires first, which is the failure the guard exists to prevent.
- **Files modified:** `playwright.config.ts`, `.github/workflows/ci.yml`
- **Verification:** `tests/unit/ci-budget.test.ts`, 6 tests
- **Committed in:** `a12b641`

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 2 Rule 2 missing-functionality)
**Impact on plan:** Two were real correctness bugs in code the plan inherited
and one was a test that encoded an assumption 05-14 invalidated. None added
scope. The one file the plan did not list and this plan had to touch is
`src/lib/ui-copy.ts` — Rule 1 on a formatter the plan depends on.

## Issues Encountered

- **Three of my own test assertions were wrong, and the implementation was
  right in each case.** (a) The picker test asserted a checkbox was checked
  after a step that had unchecked it. (b) It then asserted that a retained
  pick came back unchecked — but retention is the whole point of the keep rule,
  and the plan's own planner assumption says the key is retained. (c) The
  drift test asserted the row order was UNCHANGED after sorting an all-special
  column; `sortRows` documents that an all-unorderable column falls through to
  the cleaned-id tie-break, so the order becomes total-by-id and the assertion
  now pins that. Worth recording because the failure mode was "the test
  described a model that does not exist" rather than "the model was wrong",
  and the instinct to change the implementation instead of the assertion would
  have made all three worse.
- **The picker `<details>` is closed by default, so `check()` cannot see the
  boxes.** The specs now open it through its summary, exactly as a reader
  would, through one named helper.
- **A hand-built "WoT with no XP column" export was wrong twice.** The fixture
  quotes every data cell, so re-splitting its bytes and handing the cells back
  to `renderStatsCsv` double-quoted them and every number became text. The
  positive half is now asserted: the row is sixteen cells wide before the
  slice, and the surviving `BATTLES_COUNT` is the string `100`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **05-15 (Payment_history)** copies `CurrencyBlock`'s pattern. The two things
  it must not copy from this plan: the per-chart test id `monthly-table-
  disclosure` is now on a page more than once because the vehicle table's
  picker and summary add two more `details` — narrow the QUERY, never the hook.
  And `dashboard.spec.ts` now pins the Player_statistics card at exactly two
  `details`, so a new disclosure in a Phase 5 card has to go there on purpose.
- **05-16 (reconcile the CI budget)** has a real measurement to work from:
  168 listed tests, 42 s locally at CI's worker count, projecting 835 s with
  the 330 s baseline still an ESTIMATE. The first CI run replaces it.
- **STATS-01 is complete.** Every view plan 05-05's builder returns is now
  rendered, with D-07, D-08, D-09, D-10, D-12, D-13 and D-28 implemented and
  proven in a browser.
- **One open item for whoever owns the copy inventory:** the phase CONTEXT
  already records that the income-currency wording needs 05-08/05-09/UI-SPEC
  section 5 reconciled. Nothing from this plan adds to it.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Plan: 14*
*Completed: 2026-10-02*
