---
phase: 04-activity-time-dashboards
plan: 03
subsystem: testing
tags: [playtime, aggregation, vitest, fixtures, seeded, oracle, weekday-hour-grid]

requires:
  - phase: 04-activity-time-dashboards
    provides: "04-01/04-02 — PlaytimeSlice shape with zero-filled hour grids, the HOUR_GRID_BASIS constant, the merge sweep, the four column names, parseSessionTimestamp/isSessionsRow/resolveSessionColumns"
  - phase: 02-csv-ingest
    provides: "bare-CR Sessions.csv convention, PapaParse section rows, Sessions.csv path shape"

provides:
  - "aggregateSlice fills hourOverlap, hourStart and bins (04-01's placeholders resolved)"
  - "addHourOverlap / cellOfHour / binOf as the three exported primitives the grids are built from"
  - "tests/helpers/session-oracle.ts — per-second-bitmap oracle plus a seeded hostile generator"
  - "tests/fixtures/sessions-fixtures.ts — seeded Sessions.csv with a closed-form answer key, SCALE_5K_SPEC and SCALE_60K_SPEC"
  - "A characterisation matrix covering parse, exclusion, column resolution, merge shapes, bin edges, bounded time and the IP guarantee"

affects: [04-05, 04-06, 04-07, 04-11, 04-12, activity-time-dashboards]

actuals:
  tokens: 16897
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "The oracle is written from different primitives than the implementation (Uint8Array bitmap vs covered-watermark sweep, Date vs integer arithmetic) and must be able to disagree"
    - "A fixture answer key is computed closed-form from the layout, never by running the code under test"
    - "Seeded generators are asserted to produce the shape they exist for, so a generator change cannot silently make a check trivial"

key-files:
  created:
    - tests/unit/playtime.test.ts
    - tests/helpers/session-oracle.ts
    - tests/fixtures/sessions-fixtures.ts
    - tests/unit/sessions-fixtures.test.ts
  modified:
    - src/lib/worker/playtime.ts

key-decisions:
  - "The oracle imports only mulberry32 (a property of test data) and never the aggregation it checks"
  - "A layout is built for a computable answer key: base sessions laid out with strictly positive gaps so merged playtime is the sum of lengths, contained rows strictly inside a base, hourOverlap accumulated by a naive per-hour walk"
  - "Characterisation values are frozen as the code behaves, not derived — two parse expectations written from assumption were wrong and are now recorded as rejections"
  - "HOUR_GRID_BASIS stays unresolved; both bases remain stored and this plan computes both"

patterns-established:
  - "Closed-form fixture keys: every derived sum in SessionsExpected must satisfy its own identity (sum(hourOverlap) === seconds, sum(bins) === sessions)"
  - "Guard tests on test assets: assert the seeded generator still produces overlap before trusting a cross-check against it"

requirements-completed: []

coverage:
  - id: D1
    description: "aggregateSlice fills hourOverlap with the merged seconds each weekday-hour cell actually occupies, peeled a week at a time"
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#04-03 tracer: overlap, midnight crossing and containment > credits hourOverlap with the hours the merged seconds actually occupy"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime.test.ts#bounded time > handles a 60,000-hour session without a 216-million-iteration loop"
        status: pass
    human_judgment: false
  - id: D2
    description: "aggregateSlice fills hourStart with the merged seconds of the hour each session started in, alongside the unresolved HOUR_GRID_BASIS constant"
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#04-03 tracer: overlap, midnight crossing and containment > credits hourStart with the hour each session started in"
        status: pass
    human_judgment: false
  - id: D3
    description: "aggregateSlice fills the twelve duration bins from each session's raw length, so a fully-overlapped session still counts once"
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#binOf > places each lower bound in its own bucket, inclusively"
        status: pass
    human_judgment: false
  - id: D4
    description: "A seeded Sessions.csv generator whose expected aggregation is computed in closed form from its own layout, not by running the aggregator"
    verification:
      - kind: unit
        ref: "tests/unit/sessions-fixtures.test.ts#sessions fixture generator > matches the independent per-second oracle field for field"
        status: pass
    human_judgment: false
  - id: D5
    description: "An independent oracle that resolves overlap with a per-second bitmap, able to disagree with the implementation's sweep"
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#seeded cross-check against the oracle > matches field for field on seed %i"
        status: pass
    human_judgment: false
  - id: D6
    description: "A characterisation matrix over parse, exclusion, column resolution, merge shapes and the T-04-01 IP guarantee"
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#excluded rows"
        status: pass
    human_judgment: false
  - id: D7
    description: "Whether a real Wargaming export names the Sessions columns SESSION_START/SESSION_END/SERVER_NAME/CLIENT_PLATFORM, and whether its timestamps are bare wall clock"
    verification: []
    human_judgment: true
    rationale: "Requires a real GDPR export, which this project never commits. Plan 04-12 is that check; until it runs, the column names remain a fixture-only assumption and a mismatch excludes every row by design."

# Metrics
duration: 17min
completed: 2026-09-30
status: complete
---

# Phase 04 Plan 03: Hour grids, seeded fixtures and the characterisation matrix

**Weekday-hour grids and the duration histogram filled in `aggregateSlice`, plus the seeded large-fixture generator, the independent per-second oracle, and the parse/exclusion/merge matrix later plans lean on.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-29T21:29:46Z
- **Completed:** 2026-09-29T21:46:52Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `hourOverlap`, `hourStart` and `bins` are no longer zero-filled. `hourOverlap` is credited each session's claimed tail `[end - increment, end)`, with whole weeks added to all 168 cells in one pass so a 60,000-hour session stays instant; `hourStart` is credited the hour the session started in; `bins` take the raw length so a fully-overlapped session still counts.
- `addHourOverlap`, `cellOfHour` and `binOf` are exported next to the 04-01 sweep. The two bases and the `HOUR_GRID_BASIS` constant are untouched — both grids are stored and the choice stays open.
- The independent oracle resolves overlap with a per-second `Uint8Array` bitmap and derives weekday-hour cells through `Date`, so it is written from different primitives than the sweep it checks and can disagree with it. It did: it caught its own cell-indexing bug, and after that fix agreed with the implementation on all five seeded streams.
- The seeded fixture generator lays each year's base sessions out back to back with strictly positive random-weight gaps, so merged playtime is the sum of lengths and the answer key is closed-form. Its small spec is checked field for field against the oracle, so the key is validated by an independent implementation before 04-05, 04-06, 04-11 and 04-12 rely on it.
- The characterisation matrix froze the parse table, `isSessionsRow`, `resolveSessionColumns`, the exclusion contract, the T-04-01 IP guarantee, nine merge shapes, the bin edges and the bounded-time case.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: tracer for hour grids, bins and the merge sweep** - `1df14d3` (test)
2. **Task 1 GREEN: fill the hour grids and the duration histogram in aggregateSlice** - `fbd155f` (feat)
3. **Task 2: seeded Sessions.csv generator with an analytic answer key** - `e766f16` (test)
4. **Task 3: close the playtime file with the characterisation matrix** - `04673cd` (test)

Task 2 and Task 3 are test-only and therefore exempt from the RED cycle. Task 1's RED commit is a separate commit from its GREEN, as the TDD contract requires.

**Plan metadata:** see the docs commit below.

## Files Created/Modified

- `src/lib/worker/playtime.ts` - `addHourOverlap`, `cellOfHour`, `binOf`; `aggregateSlice` now fills `hourOverlap`, `hourStart` and `bins`
- `tests/helpers/session-oracle.ts` - per-second-bitmap oracle and the seeded hostile generator
- `tests/fixtures/sessions-fixtures.ts` - seeded Sessions.csv with a closed-form answer key, `SCALE_5K_SPEC` / `SCALE_60K_SPEC`
- `tests/unit/playtime.test.ts` - tracer plus the parse/exclusion/merge/bin/bounded-time/seeded matrix
- `tests/unit/sessions-fixtures.test.ts` - determinism, shape, key self-consistency and oracle agreement

## Decisions Made

- **The oracle imports only `mulberry32`.** It must not be able to reach the aggregation it checks; the PRNG is a property of the test data, not of the aggregation. `civil-date.ts` and `civilFromDays` are deliberately unused, so a calendar bug cannot cancel out on both sides.
- **The layout is designed for a computable key.** Base sessions with strictly positive gaps never overlap, so merged playtime is the sum of lengths; contained rows add a session and zero seconds; the only non-closed-form part, `hourOverlap`, is accumulated by a naive per-hour walk that does not reuse the implementation's week peel.
- **Characterisation values are frozen, not derived.** Two parse expectations written from assumption were wrong (a stamp without seconds, and a `+00:00` offset). The test failed, and both are now recorded as rejections — for the offset case that is D-01's intent, not a defect.
- **`HOUR_GRID_BASIS` is not resolved here.** Both bases are computed and stored, so flipping the default later remains a one-line constant change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The oracle's cell derivation indexed 168 cells to 3596**
- **Found during:** Task 1 GREEN
- **Issue:** The oracle multiplied the weekday by `SECONDS_PER_HOUR` (3600) where hours-per-day (24) was meant, so `cellOfInstant` returned indices up to 3595 and the grid grew past 168 entries. This was a defect in the new test helper, not in the implementation.
- **Fix:** Introduced `HOURS_PER_DAY` and used it in the cell derivation; dropped the now-unused constant.
- **Files modified:** `tests/helpers/session-oracle.ts`
- **Verification:** The oracle now agrees with the implementation, and the fact that it disagreed first is the point — the two are written from different primitives and were able to catch each other.
- **Committed in:** `fbd155f`

**2. [Rule 1 - Bug] The analytic key's naive per-hour loop credited from the hour boundary**
- **Found during:** Task 2
- **Issue:** For a claimed tail starting mid-hour the loop added `min(3600, end - hourStart)`, over-counting the first partial hour — the 5k key's `hourOverlap` summed to roughly double `seconds`.
- **Fix:** Track the first uncredited second and credit only what falls after it, so a mid-hour start is clipped at the start rather than at the boundary. Still a per-hour walk, still no week peel.
- **Files modified:** `tests/fixtures/sessions-fixtures.ts`
- **Verification:** `sum(hourOverlap) === seconds` on `SCALE_5K_SPEC`, and the small spec matches the per-second oracle field for field.
- **Committed in:** `e766f16`

**3. [Rule 3 - Blocking] `randomSessions`'s `days` parameter was unused**
- **Found during:** Task 3 (ESLint `no-unused-vars`)
- **Issue:** The generator grew without bound, so the parameter the plan's signature specifies had no effect.
- **Fix:** Sessions are laid out inside a `days`-day window and wrap back to its start, so the tail of one lap overlaps the head of the next and the only correct order is by start time. This made the generator hostile in a way the original monotonic version was not.
- **Files modified:** `tests/helpers/session-oracle.ts`
- **Verification:** Each seed now yields 226-251 overlapping sessions out of 300; asserted by a guard test.
- **Committed in:** `04673cd`

---

**Total deviations:** 3 auto-fixed (2 bugs in new test assets, 1 blocking unused parameter)
**Impact on plan:** All three were defects in code this plan introduced. No change to the plan's scope, and `src/lib/worker/playtime.ts` needed no defect fix — the implementation and the oracle agreed on all five seeds.

## Issues Encountered

- Two parse expectations were written from assumption and the suite caught both on the first run. They are now frozen as the code behaves, with the `+00:00` rejection documented as D-01's intent rather than a gap.
- The 60k preset's zipped export is built inside one test. It costs well under a second; the whole `sessions-fixtures` file runs in ~0.6s and the full unit suite in 1.36s, so the large fixture is not a suite-speed problem.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 04-05, 04-06, 04-11 and 04-12 can build on `SCALE_5K_SPEC` / `SCALE_60K_SPEC` and their closed-form keys. The small spec's key is already validated against the independent oracle.
- `SCALE_5K_SPEC` produces 5 usable server values (one blank) and 2 platforms, so `splitColumn` resolves to `SERVER_NAME`; a fixture that forces the `CLIENT_PLATFORM` fallback or a null split is not yet built and will be needed by 04-06.
- Open, unchanged by this plan: the Sessions column names and timestamp shape rest on the synthetic fixture alone until 04-12 reads a real export.

## Self-Check: PASSED

All five created/modified files exist on disk and all four task commits are
present in history. `commits: 4` measured with
`git rev-list --count 6d36510..HEAD` (base `plan_head_before: 6d36510`).

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-09-30*
