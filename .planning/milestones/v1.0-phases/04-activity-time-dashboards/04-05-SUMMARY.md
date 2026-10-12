---
phase: 04-activity-time-dashboards
plan: 05
subsystem: ui
tags: [playtime, chart-model, rank-scale, calendar, keyboard-navigation, tooltip, vitest, pure-functions]

requires:
  - phase: 04-activity-time-dashboards
    provides: "04-01 — PlaytimeSlice shape (dayIndex/daySeconds/daySessions, hourOverlap, hourStart, bins), HOUR_GRID_BASIS, DURATION_BIN_COUNT, HOUR_CELL_COUNT, PlaytimeSplit; 04-03 — both hour grids and the twelve bins filled, seeded fixtures and the independent oracle"
  - phase: 01-foundation
    provides: "civil-date.ts integer calendar arithmetic, the node-environment Vitest setup with no jsdom, the CSP that forbids inline styles"
  - phase: 03-dashboard-shell-account-identity
    provides: "the pure-DOM-free-decision precedent (scroll-spy.pickActiveSection) and the long why-header this module follows"

provides:
  - "src/lib/playtime-model.ts — rankScale, legendModel and the D-04 scale rule as one function"
  - "buildCalendarModel with per-year blocks, empty-run collapse, exact column/row/x/y geometry, month labels and per-year totals that reconcile with the Sessions tile"
  - "isDrawnDay, initialCalendarFocus and calendarNavigate — the calendar's roving focus for all eight keys"
  - "buildHourGridModel with the HOUR_GRID_BASIS argument, and hourGridNavigate for six keys"
  - "buildDurationRows, buildSplitTable (All + at most eight values), effectiveSelection"
  - "clampTooltip, focusScrollDelta, hoursAttribute — placement and scrolling as numbers, because the CSP forbids a style attribute"
  - "tests/unit/playtime-model.test.ts — 52 tests whose expected values are hand arithmetic and Date.UTC"

affects: [04-06, 04-08, 04-09, 04-10, 04-11, activity-time-dashboards]

actuals:
  tokens: 20312
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "A chart decision lives in a pure function and the component wires it; the models carry numbers and never words, so ui-copy stays the only place a user-visible string is written"
    - "The test file loads the module through a cached dynamic import, so a missing export fails the test that needs it by name instead of crashing the file and hiding which behaviours exist"
    - "Expected values are hand arithmetic and Date.UTC, never read back from the module, so a calendar bug cannot cancel out on both sides"

key-files:
  created:
    - src/lib/playtime-model.ts
    - tests/unit/playtime-model.test.ts
  modified: []

key-decisions:
  - "HOUR_GRID_BASIS stays unresolved: buildHourGridModel takes the basis as an argument and defaults to the constant, so the midnight-crossing decision is a one-constant change with no model edit and no re-import"
  - "focusScrollDelta returns a NON-POSITIVE number — the negative of the scroll the caller applies — so 0 unambiguously means do not scroll and the caller uses window.scrollBy(0, -delta)"
  - "Effective selection returns All rather than raising, which is what makes D-03's reset rule need no reset hook: a stale selection is simply never applicable"
  - "Up and Down in the calendar are the same WEEK COLUMN rule, not a weekday table; a Sunday cannot go down and a Monday cannot go up because the next cell is in the next column"
  - "Left and Right refuse to enter a collapsed empty run; PageUp and PageDown are the keys that skip runs, which is what the UI-SPEC's own PageUp row describes"
  - "Every navigation boundary is civil arithmetic on the year plus a binary search over the active year list, so a key press never costs anything proportional to the session count"

patterns-established:
  - "A pure model is total where the domain allows it: buildSplitTable(null) and hourGridNavigate on a non-cell index return a harmless answer instead of throwing, so the component carries no defensive branch"
  - "Layout constants carry their arithmetic in comments (626 = 32 + 54 x 11, 97 = 20 + 7 x 11, 624 = 48 + 24 x 24, 192 = 24 + 7 x 24), because those numbers are checked by tests rather than by a designer"
  - "A source-level guard test strips comments before asserting the module imports no framework, no copy module and no Date — the why-header names those constraints in prose"

requirements-completed: []

coverage:
  - id: D1
    description: "The colour scale is rank-based over the non-zero integer seconds (D-04): cut k at index min(n-1, ceil(n*k/5)-1), level 0 unshaded, duplicate cuts collapsing, and a legend that lists level 0 plus the levels in use"
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#04-05 tracer: rank scale and a one-day calendar > puts the four cut points at the 20/40/60/80 percentiles of the non-zero values"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#04-05 tracer: rank scale and a one-day calendar > spreads a two-value slice across the ramp instead of one cut"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#04-05 tracer: rank scale and a one-day calendar > puts a single value in level 1 and a heavy tail in level 5"
        status: pass
    human_judgment: false
  - id: D2
    description: "The calendar draws every day of every active year at the exact UI-SPEC geometry (2020-12-31 at column 52, row 3, x 604, y 53; 2012 at 54 columns; never more), with twelve month labels, per-year totals that reconcile with the slice, and consecutive empty years collapsed into one block so a stray 1970 or 9999 row cannot draw empty grids"
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#04-05 tracer: rank scale and a one-day calendar > draws 366 cells for one active year and puts 2020-12-31 at column 52, row 3"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#calendar layout > gives 2012 the full 54 columns and never asks for a 55th"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#calendar layout > absorbs a stray 1970 and a stray 9999 into two gap blocks and 1095 cells"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#calendar layout > builds a forty-year model in well under 100 ms"
        status: pass
    human_judgment: false
  - id: D3
    description: "A day with sessions but zero merged seconds keeps its session count at level 0 and still counts as an active day, so the tooltip can say '0 min, 1 session' (Pitfall 4)"
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#calendar levels and legend > keeps the session count on a day with zero merged seconds and shades it level 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The calendar's roving focus for all eight keys: week moves that cross into an adjacent drawn year, Up and Down confined to the same week column, Home and End to the year's first and last day on that weekday, and PageUp/PageDown across collapsed runs with the day of month clamped"
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#calendar navigation > skips collapsed empty years on PageUp and PageDown, and refuses to walk into one with an arrow"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#calendar navigation > clamps February 29 to February 28 in a common year"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#calendar navigation > refuses to move up off a Monday and off the first day of the year"
        status: pass
    human_judgment: false
  - id: D5
    description: "The weekday x hour model reads one of the two stored grids through a basis argument defaulting to HOUR_GRID_BASIS, so the open midnight-crossing decision needs no model edit and no re-import"
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#hour grid model and keys > reads the grid the basis argument names, and both grids stay stored"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#hour grid model and keys > lays out 168 fixed cells indexed weekday times 24 plus hour"
        status: pass
    human_judgment: false
  - id: D6
    description: "The hour grid's roving focus stops at all four edges and at Home/End without wrapping, and leaves an index that is not one of the 168 cells alone"
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#hour grid model and keys > moves within the grid and stops at every edge without wrapping"
        status: pass
    human_judgment: false
  - id: D7
    description: "Twelve duration rows with a percent of the slice and a bar scaled by the largest bin, floored at one unit so a lone session is never invisible, and returning zeros rather than NaN for an empty slice"
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#duration rows > never lets a non-empty bin disappear, and never divides by zero"
        status: pass
    human_judgment: false
  - id: D8
    description: "The split table is All plus at most eight values with a count of the remainder, so 50 values cannot grow it, and a selection past the eighth row flags no row"
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#split table > shows All plus eight values and counts the rest"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#split table > carries the split totals and flags exactly the selected row"
        status: pass
    human_judgment: false
  - id: D9
    description: "The selection-reset rule as one pure function: a requested value applies only to the dataset it was requested for and only while its index still exists, so a stale value can never render (D-03)"
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#selection reset > applies a requested value only to the dataset it was requested for"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#selection reset > applies a requested value only while its index still exists"
        status: pass
    human_judgment: false
  - id: D10
    description: "Tooltip placement as numbers — centred with an 8px gap, flipped below when the top edge would sit under the sticky nav, clamped 8px from every viewport edge — plus the focus-scroll correction and an hours figure to four decimals"
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#tooltip placement > flips below when the top edge would sit under the sticky nav"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#tooltip placement > clamps the bottom on a viewport too short to hold the tooltip"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#focus scroll delta and hoursAttribute > reports hours to four decimals with no trailing zeros"
        status: pass
    human_judgment: false
  - id: D11
    description: "Whether a legend whose level list is sparse reads correctly — two values can produce levels [0, 1, 3], leaving a visible gap in the swatch row"
    verification: []
    human_judgment: true
    rationale: "The level list is a faithful consequence of the rank rule and is asserted in isolation, but whether a gapped swatch row communicates correctly to a reader is a visual judgement, and 04-09 owns the legend's rendering. No unit test can settle it."

# Metrics
duration: 18min
completed: 2026-09-30
status: complete
---

# Phase 04 Plan 05: Pure chart models, navigation and placement rules

**Every decision the Phase 4 charts make — the D-04 rank scale, the calendar and weekday-hour geometry, duration rows, the split table, both key tables, tooltip placement and the selection-reset rule — as one DOM-free module with 52 hand-arithmetic tests, so plans 04-08 to 04-10 are wiring rather than decisions.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-29T21:49:50Z
- **Completed:** 2026-09-29T22:08:27Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `rankScale` implements D-04 exactly as the UI-SPEC states it: cut `k` at index `min(n - 1, ceil(n * k / 5) - 1)` over the ascending non-zero values in whole seconds, level 0 unshaded, duplicate cuts collapsing honestly, and a heavy tail (nine ones and a thousand) landing on `[1,1,1,1]` with the outlier alone at level 5. `legendModel` lists level 0 plus the levels in use and names the darkest boundary only when level 5 is in use.
- `buildCalendarModel` draws every day of every active year — 366 cells for 2020, 2020-12-31 at column 52, row 3, x 604, y 53 — with the 54-column bound swept over 1990-2060, twelve month labels at their own first day's column, and per-year totals that reconcile with the Sessions tile. A run of consecutive empty years becomes ONE block, so the stray-1970/9999 case yields three year blocks, two gap blocks and 1095 cells.
- `calendarNavigate` answers all eight keys, and every impossible move returns the origin day unchanged: arrows cross into an adjacent drawn year but refuse to enter a collapsed run, Up and Down stay inside the same week column (so a Sunday cannot go down and a Monday cannot go up), Home and End land on the year's first and last day of that weekday, and PageUp/PageDown skip runs with February 29 clamped to February 28.
- `buildHourGridModel` reads one of the two stored grids through a basis argument defaulting to `HOUR_GRID_BASIS`, proven on a slice whose `hourOverlap` and `hourStart` disagree. The pending midnight-crossing decision is still a one-constant change, and both grids are read and neither is written.
- `buildDurationRows`, `buildSplitTable` (All plus at most eight values), `effectiveSelection`, `clampTooltip`, `focusScrollDelta` and `hoursAttribute` complete the set. `clampTooltip` returns numbers because the CSP has no `style-src 'unsafe-inline'`, and `focusScrollDelta` returns a non-positive number so `0` unambiguously means "do not scroll".
- The module imports only `civil-date`, `playtime-shared` and the worker-messages types — no Svelte, no runes, no `ui-copy`, no `Date` — and a source-level guard test holds all four, stripping comments first so the why-header can name the constraints in prose.

## Task Commits

Each task was committed atomically, RED before GREEN:

1. **Task 1 RED: tracer for the rank scale and a one-day 2020 calendar** - `b2e08e8` (test)
2. **Task 1 GREEN: rank scale and a one-year calendar model** - `3bafcde` (feat)
3. **Task 2 RED: multi-year calendar layout, levels and the key table** - `081ec50` (test)
4. **Task 2 GREEN: empty-run collapse, drawn-day lookup and the calendar key table** - `fabfd94` (feat)
5. **Task 3 RED: hour grid, duration rows, split table and placement rules** - `a1ecf4d` (test)
6. **Task 3 GREEN: hour grid, duration rows, split table, selection and placement** - `bcd0a47` (feat)

TDD RED evidence (`pnpm exec vitest run`, exit 1 each time):

- **Task 1 RED** — `Tests 11 failed (11)`, every test erroring with `Cannot find module '/src/lib/playtime-model'`. The per-test dynamic loader is what keeps this a per-test failure naming the missing module instead of a file-level load crash.
- **Task 2 RED** — `Tests 13 failed | 18 passed (31)`: nine `TypeError: calendarNavigate is not a function`, one `TypeError: isDrawnDay is not a function`, and three assertion failures (no `empty` block in the block list, zero gap blocks for 1970/9999, January's label at column 0 rather than 1). The seven new tests that already passed are the geometry, row-partition, totals and Pitfall-4 cases Task 1's GREEN had already delivered; they stand as regression guards.
- **Task 3 RED** — `Tests 21 failed | 31 passed (52)`, all 21 new tests failing with `<name> is not a function` on the six missing exports.

The git-log RED gate `git log -E --grep="^test\((0*4)-(0*5)\):"` finds all three RED commits, and each is immediately followed by its `feat(04-05):` commit.

## Files Created/Modified

- `src/lib/playtime-model.ts` (new, 904 lines) — layout constants, the rank scale and legend, the calendar model with empty-run collapse and the eight-key reducer, the hour-grid model and six-key reducer, duration rows, the split table, the selection rule, tooltip placement, focus scrolling and `hoursAttribute`.
- `tests/unit/playtime-model.test.ts` (new, 1027 lines, 52 tests) — tracer plus calendar layout, levels and legend, navigation, hour grid and keys, duration rows, split table, selection reset, tooltip placement, focus scroll and `hoursAttribute`.

## Decisions Made

- **`HOUR_GRID_BASIS` is untouched.** `buildHourGridModel(slice, basis = HOUR_GRID_BASIS)` reads one grid and never writes either, so the open UI-SPEC row stays a constant change with no re-import and no model edit. The two parse behaviours 04-03 froze (a timestamp without seconds, and a `+00:00` offset, both rejected) are outside this module and untouched.
- **`focusScrollDelta` returns a non-positive number.** The plan's action block says "the negative scroll needed" and its expected value is `-36`; the natural page-scroll delta for a cell 36px short is `+36`, so the two conventions point opposite ways and only one can be the caller's `scrollBy` argument. The function is implemented as the plan states and the sign is documented at the call site and in its why-comment: a cell 36px short returns `-36` and the caller does `window.scrollBy(0, -delta)`; `0` means do not scroll. **04-09 must not invert this.**
- **`effectiveSelection` returns All rather than raising.** D-03 wants a stale value to be impossible; refusing the request outright is what removes the need for a reset hook to exist and be remembered.
- **Up and Down are one column rule, not a weekday table.** "Inside the same week column" and "a Monday cannot go up, a Sunday cannot go down" are the same rule stated two ways, and the column form also refuses the January-1 cell whose neighbour above is in a different year.
- **Navigation reads the year list, not the cells.** Every boundary is `daysFromCivil`/`daysInYear` on the year plus a binary search over `model.years`, so a key press costs `log(active years)`. This is not literally the O(1) the T-04-09 row claims, but it is the property that row exists to protect — the cost is a function of the years drawn and never of the session count, which a 50,000-session export does not change.
- **The model is total where the domain allows it.** `buildSplitTable(null, null)` returns an empty model and `hourGridNavigate` returns a non-cell index unchanged, so the components carry no defensive branch and a stale focus cannot jump to another cell. Both are supersets of the plan's stated behaviour.
- **The legend's level list can be sparse.** Two values give cuts `[1,1,2,2]`, so the levels in use are 1 and 3 and the legend is `[0, 1, 3]`. That is the faithful consequence of "only the levels in use" and of a rank rule whose middle fifth is empty; whether a gapped swatch row reads correctly is 04-09's call, recorded as a human-judgement item below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A rank-scale expectation was written from assumption**
- **Found during:** Task 1 GREEN
- **Issue:** The test asserted `rankScale([5,5,5]).levelOf(4) === 0`. The plan's behaviour line is "On [5, 5, 5] all four cuts are 5 and every value is level 1", which is about the three values in the set, not about a value below the cut. Level 0 means "no play", and 4 seconds is play.
- **Fix:** The assertion now maps the three scale values to `[1, 1, 1]` and states the consequence explicitly: anything above zero is level 1, only zero is level 0.
- **Files modified:** `tests/unit/playtime-model.test.ts`
- **Verification:** the tracer describe is green; the implementation was already correct.
- **Committed in:** `3bafcde`

**2. [Rule 1 - Bug] The 40-year cell-count expectation ignored ten leap years**
- **Found during:** Task 2 RED
- **Issue:** `cellCount` was asserted as `40 * 365`, but 2000-2039 contains ten leap years, so the correct figure is 14 610.
- **Fix:** The test now derives the count from a local proleptic-Gregorian leap rule over the same year range, so the expectation stays hand-derived rather than a literal.
- **Files modified:** `tests/unit/playtime-model.test.ts`
- **Verification:** green; the 14 610 the model produced is the number the leap rule computes.
- **Committed in:** `081ec50`

**3. [Rule 1 - Bug] January's month label was expected in the wrong column**
- **Found during:** Task 2 GREEN
- **Issue:** The test asserted January 2020's label at column 1. 2020-01-01 was a Wednesday, so the first days of January fill the TOP of week column 0 and the label is column 0. The expectation came from a picture of "the label moves to the next full week", which is not the UI-SPEC rule ("the column of each month's first day").
- **Fix:** The case was rewritten to assert what actually distinguishes the behaviour: January at column 0 in both a Monday-starting year (2018) and a Wednesday-starting one (2020), and February 2020 — whose first day is a Saturday at day-of-year index 31, so `floor((31 + 2) / 7) = 4` — at column 4. The 44px minimum gap between consecutive labels is unchanged.
- **Files modified:** `tests/unit/playtime-model.test.ts`
- **Verification:** green; the implementation matched the UI-SPEC rule as written.
- **Committed in:** `fabfd94`

**4. [Rule 1 - Bug] The selected split row was addressed by position instead of by value index**
- **Found during:** Task 3 GREEN
- **Issue:** The test read `rows[1]` as the row for value index 1, but `rows[0]` is the All row, so every value row is shifted down by one.
- **Fix:** The row is now looked up by its `valueIndex`, and the test says why: the All row shifts every value row, and the selected row is identified by its index into the split's value list.
- **Files modified:** `tests/unit/playtime-model.test.ts`
- **Verification:** green; the "exactly one row is flagged" assertion held throughout.
- **Committed in:** `bcd0a47`

---

**Total deviations:** 4 auto-fixed (all four test expectations written from assumption; no implementation defect)
**Impact on plan:** None. All four were defects in expectations this plan authored, caught by the tests themselves before the implementation was changed to match. `src/lib/playtime-model.ts` needed no defect fix.

### Flagged, not fixed

**5. The 04-VALIDATION quick command names a file that does not exist.** `pnpm exec vitest run tests/unit/playtime.test.ts tests/unit/playtime-model.test.ts tests/unit/civil-date.test.ts` — there is no `tests/unit/civil-date.test.ts` in this repository; civil-date's arithmetic is exercised from `tests/unit/ingest-worker.test.ts` and `tests/fixtures/sessions-fixtures.ts`. Vitest treats a missing positional as a filter, so the command still exits 0 and runs the two files that exist (115 tests, 475 ms). Left alone because `.planning/phases/04-activity-time-dashboards/04-VALIDATION.md` is not in this plan's `files_modified`, and editing a shared validation artefact from a plan that does not own it is how two plans end up disagreeing. **The parent should decide whether to drop the third path or to create the file.**

**6. `rankScale([]).levelOf(v > 0)` returns 5.** With no non-zero values there are no cuts, and the plan's rule ("otherwise the 1-based index of the first cut the value does not exceed, or 5 when it exceeds all") makes a positive value exceed every cut of none. Implemented as specified rather than special-cased; it is unreachable from `buildCalendarModel`, which builds the scale from the very values it then asks about. Documented in the function's why-comment.

---

## Issues Encountered

- Four test expectations were written from assumption and all four failed on their first run. Three were arithmetic or indexing slips and one (the month label) came from a misremembered layout rule; each is recorded above with its cause. The implementation was right in every case, which is the useful outcome: the module's behaviour was decided by the UI-SPEC and the tests were corrected to match it rather than the reverse.
- The Task 2 RED is partial by nature: seven of the twenty new tests pass immediately because Task 1's GREEN already delivered the geometry, row partitioning, per-year totals and the Pitfall-4 zero-second day. They are kept as regression guards for the multi-year work rather than deleted, and the RED evidence above states which ones and why.
- No fixture change was made, so the split table still has no fixture coverage for the `CLIENT_PLATFORM` fallback or a null split, and none for a two-value split (the sparse-legend case). Those belong to 04-06's fixture work; the model paths are covered here by hand-built inputs instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 04-08, 04-09 and 04-10 can import every symbol in `src/lib/playtime-model.ts` and add no chart logic of their own. Each export owns exactly one decision, listed in the module header and in `## Decisions Made` above.
- **04-09 must apply `focusScrollDelta` as `window.scrollBy(0, -delta)`** and must not treat a negative return as a scroll-up. The sign convention is stated in the function's why-comment and in the plan summary.
- 04-09 owns the legend's rendering, including the sparse-level case (a two-value slice gives `[0, 1, 3]`); that is a visual judgement no unit test settles.
- 04-04 owns `ui-copy` and the ramp; the model deliberately holds no strings, so every message the charts show still has to be written there.
- Unchanged and still needing a human: the `HOUR_GRID_BASIS` row in 04-UI-SPEC, and whether a real export names the Sessions columns `SESSION_START`/`SESSION_END`/`SERVER_NAME`/`CLIENT_PLATFORM` (04-12 is that check). This plan reads the basis constant and does not resolve it.
- The split table's `CLIENT_PLATFORM` fallback and null-split paths are implemented and unit-tested from hand-built inputs, but no seeded fixture forces them; 04-06 owns that.

## Self-Check: PASSED

Both created files exist on disk, `git rev-list --count fa817f4..HEAD` is 6, and every `## Accomplishments` bullet maps to a named passing test. `git diff --quiet 40ac5c2 -- package.json pnpm-lock.yaml` exits 0 (T-04-SC).

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-09-30*
