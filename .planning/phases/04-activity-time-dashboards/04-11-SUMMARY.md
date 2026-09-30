---
phase: 04-activity-time-dashboards
plan: 11
subsystem: testing
tags: [playwright, vitest, oracle, fixture, e2e, svelte, chromium, a11y]

requires:
  - phase: 04-activity-time-dashboards
    provides: >-
      04-03's independent oracle (tests/helpers/session-oracle.ts) and the
      seeded generator with its analytic key, 04-05's pure model layer,
      04-09's weekday-by-hour grid, duration list and charts container,
      04-10's calendar heatmap, the shared ChartTooltip and the measured
      scroll clearance, and the 04-01..04-10 summaries that are the
      authoritative record of all of it.
provides:
  - >-
    tests/fixtures/playtime-hand-fixture.ts: the nine-row hand fixture, small
    enough that every number in it can be totalled with a pencil, holding BOTH
    hour bases so the open HOUR_GRID_BASIS decision needs no spec edit.
  - >-
    tests/unit/playtime-hand-fixture.test.ts: 28 tests that recompute the whole
    hand fixture with the INDEPENDENT oracle — both hour bases index by index,
    the twelve bins, four per-day figures, three per-value slices, and the
    guard that the parts sum to MORE than the All total.
  - >-
    tests/fixtures/playtime-mixed-fixture.ts and
    tests/unit/playtime-mixed-fixture.test.ts: the 18-row shape fixture (three
    servers, two years, three cross-server overlap pairs, one midnight crosser
    that is also the year crosser) with 21 tests proving the shapes a browser
    test depends on actually exist in the data.
  - >-
    tests/e2e/playtime-charts.spec.ts: sixteen named browser tests over the
    three charts — calendar, tooltip, keyboard, hour grid, duration, 375px
    overflow, sticky head at two widths, tooltip clipping, selector effect and
    no motion.
  - >-
    A recorded negative result on the measured year head: no behavioural
    browser proof of the focus correction exists, and the reason is measured
    rather than assumed.
affects: [04-12, 04-13, phase-05, verify-work]

actuals:
  tokens: 61000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Hand fixture proved by an independent oracle in Node, so a wrong hand
      number fails in seconds rather than in a CI browser run hours later."
    - "One shared fixture module read by both the Playwright specs and the
      Node cross-check, because Playwright refuses to load a spec that
      imports another spec."
    - "Hour-cell expectations imported as an index-addressed function of
      HOUR_GRID_BASIS, never as a per-basis list inside a spec."

key-files:
  created:
    - tests/fixtures/playtime-hand-fixture.ts
    - tests/fixtures/playtime-mixed-fixture.ts
    - tests/unit/playtime-hand-fixture.test.ts
    - tests/unit/playtime-mixed-fixture.test.ts
    - tests/e2e/playtime.spec.ts
    - tests/e2e/playtime-charts.spec.ts
  modified:
    - tests/e2e/helpers.ts

key-decisions:
  - "The oracle's 400-day bitmap guard is a MEMORY bound, not a correctness
    statement, and 04-11's fixture is 1,399 days wide on purpose. Sessions
    are clustered at gaps wider than the guard and the per-cluster results
    summed; the disjointness and the one-day separation are ASSERTED rather
    than assumed, and one test proves the multi-cluster path really runs."
  - "The import helpers wait on the Activity_history section's data-status
    leaving not-loaded, NOT on the identity nickname. The hand export is
    built from Sessions.csv alone, so it has no User_Info row and the header
    renders the D-16 fallback with no nickname element at all."
  - "No test was written that passes against the unexercised head-height
    path. The sticky-head test is structural and says so in the file."

patterns-established:
  - "A browser spec's expected values are literals imported from a fixture
    that a Node test has already proved equal to an independent
    implementation — never read from the page and compared with itself."
  - "A test that would pass vacuously carries a guard assertion on its own
    SETUP (the head actually stuck, the block still in view, the multi-cluster
    path actually taken)."
  - "The grid's weekday is Monday (0), not Date's Sunday (0). Cell maths
    goes through the app's own cellOfHour rather than a locally written copy."

requirements-completed: [ACTIVITY-02, ACTIVITY-03, ACTIVITY-04]

coverage:
  - id: D1
    description: "The nine-row hand fixture and the independent-oracle
      cross-check that proves every number in it, under both hour bases"
    requirement: ACTIVITY-02
    verification:
      - kind: unit
        ref: tests/unit/playtime-hand-fixture.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "The 18-row mixed fixture and the 21 tests proving the
      shapes the browser geometry specs depend on"
    requirement: ACTIVITY-03
    verification:
      - kind: unit
        ref: tests/unit/playtime-mixed-fixture.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "Sixteen named browser tests over the calendar, the
      weekday-by-hour grid and the duration list, including the sticky head
      at two widths, 375px overflow and tooltip clipping"
    requirement: ACTIVITY-04
    verification:
      - kind: e2e
        ref: tests/e2e/playtime-charts.spec.ts
        status: pass
    human_judgment: false
  - id: D4
    description: "A behavioural browser proof that the focus correction
      consumes the MEASURED year-head height rather than a hard-coded 32"
    verification: []
    human_judgment: true
    rationale: >-
      No such proof exists and none is claimed. Across twenty key sequences
      in a real Chromium the browser's own focus() lands the cell about
      355px below the top of the viewport, far below the 56px sticky top
      plus the 41px head, so focusScrollDelta returns 0 every time and the
      measured value is never used. A mutant replacing the measurement with
      the plan's literal 32 survives every assertion in the suite. The value
      is correct by construction (it reads offsetHeight of the head the cell
      actually sits under, after the focus settles) and unit-tested; only
      construction and unit tests cover it.
  - id: D5
    description: "A human confirming the charts read correctly on a real
      screen — density ramp legibility, colour contrast of the six teal
      steps against white, and whether a 1,095-cell grid is a useful thing
      to put in front of someone"
    verification: []
    human_judgment: true
    rationale: >-
      A DOM test can prove a cell carries data-seconds 5400 and a non-zero
      level. It cannot prove the resulting colour is distinguishable from
      its neighbour, or that the chart is comprehensible. That is a
      judgement about the design, not about the data.

# Metrics
duration: 62min
completed: 2026-09-30
status: complete
---

# Phase 4 Plan 11: Hand Fixtures and the Chart Browser Suite

**The nine-row hand fixture proved against the independent oracle in Node, an 18-row shape fixture, and sixteen real-Chromium tests over the three charts — with the measured-head-height question answered as a measured negative**

## Performance

- **Duration:** 62 min
- **Started:** 2026-09-30T05:29:00+04:00
- **Completed:** 2026-09-30T10:30:00+04:00
- **Tasks:** 3
- **Files modified:** 6 created, 1 modified

## Accomplishments

- **The hand numbers are proved before CI ever sees them.** The nine rows are
  small enough to total with a pencil, and 28 Node tests recompute the whole
  fixture with 04-03's independent oracle: both hour bases index by index, the
  twelve duration bins, four per-day figures, three per-value slices, and the
  arithmetic that the parts of a split sum to 31,800 against All's 29,400
  because a session overlapping another server's session cannot be in both
  parts. The oracle shares no primitive with the aggregator it checks.
- **The 400-day bitmap guard was solved rather than worked around.** 04-11's
  fixture spans 1,399 days, which `oracleSlice` refuses. Rather than shrink the
  fixture and lose the collapsed-empty-year case that makes 1,095 cells
  meaningful, sessions are clustered at gaps wider than the guard and the
  per-cluster results summed — with the two properties that make that exact
  (no session straddles a boundary; consecutive clusters are a day apart)
  ASSERTED, and a test that proves the multi-cluster path actually executes.
- **Sixteen browser tests over the three charts, run for real in Chromium**,
  all hand numbers read from the shared fixture and the hour cells compared
  index by index against `expectedHourSeconds()` selected by `HOUR_GRID_BASIS`.
- **The measured-head-height question is answered as a measured negative**, with
  the number that settles it, and no test was written that passes against the
  unexercised path.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: the hand-fixture cross-check** - `1518d57` (test)
2. **Task 1: the hand fixture and its first browser tracer** - `3a5052f` (feat)
3. **Task 2: the mixed-points fixture and its shapes** - `e4cc6e1` (test)
4. **Task 3: the three charts in a real browser, sixteen named tests** - `94c94a8` (test)

Task 3's deliverable is a test file, so it is exempt from the RED-commit
requirement and no fake RED was manufactured for it. Tasks 1 and 2 both
demonstrated a genuine RED before the implementation and committed it.

## Files Created/Modified

- `tests/fixtures/playtime-hand-fixture.ts` — the nine rows and every number
  derived from them, holding BOTH hour bases
- `tests/unit/playtime-hand-fixture.test.ts` — 28 tests recomputing all of it
  with the independent oracle
- `tests/fixtures/playtime-mixed-fixture.ts` — the 18-row shape fixture
- `tests/unit/playtime-mixed-fixture.test.ts` — 21 tests proving the shapes and
  the arithmetic the browser geometry specs depend on
- `tests/e2e/playtime.spec.ts` — one tracer: import, totals, pick a server,
  announcement
- `tests/e2e/playtime-charts.spec.ts` — the sixteen chart tests
- `tests/e2e/helpers.ts` — `gotoApp`, `openActivity`, `playtimeBlock`,
  `waitForImported`, `importExport`, `replaceExport`, `startOver`,
  `delayPlaytimeQueries`

## Decisions Made

- **Composing the oracle across a span it refuses, with the exactness proved
  rather than assumed.** The guard exists so a test does not allocate a
  gigabyte-scale `Uint8Array`; it says nothing about whether a wider span is
  harder to check. Splitting at 400-day gaps and summing is exact provided no
  session straddles a boundary and no two clusters share a second or a day —
  and both are asserted, because without the second a boundary through a
  midnight would silently double-count an overlapping second while still
  passing every index-by-index comparison against a hand table written under
  the same wrong assumption.
- **The import helpers wait on section status, not on the identity nickname.**
  The hand export is Sessions.csv alone, so it has no `User_Info` row and the
  header renders the D-16 fallback with no `identity-nickname` element. Adding
  a `User_Info` folder to reach the plan's suggested wait would have put an
  unrelated claim into every chart test.
- **The sticky-head test is structural and says so.** It proves the head is a
  SIBLING of its scroller and that its measured height already exceeds its
  declared `min-height: 32px`, which is the observable part. It does not claim
  the correction fires, because it does not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - correctness] The oracle's 400-day guard blocked the plan's own fixture**
- **Found during:** Task 1 (running the new cross-check)
- **Issue:** `oracleSlice` throws above a 400-day span. 04-11's mandated fixture
  runs 2018-03-05 to 2021-12-31 — 1,399 days — because three active years with
  a collapsed empty one between two of them is what makes the empty-year run
  line and the 1,095-cell count meaningful at all.
- **Fix:** Cluster the sessions at gaps wider than the guard, run each cluster
  through the UNMODIFIED oracle, and sum. The two exactness preconditions are
  asserted inside the helper, and a dedicated test proves the span really does
  exceed the guard and really does produce more than one cluster.
- **Files modified:** `tests/unit/playtime-hand-fixture.test.ts`
- **Verification:** 28/28 pass; mutating the span so it fits one cluster fails
  the guard test.
- **Committed in:** `3a5052f`

**2. [Rule 2 - correctness] The plan's suggested import wait cannot fire on the plan's own fixture**
- **Found during:** Task 1 (first browser run of the tracer)
- **Issue:** The plan has `importExport` wait for `identity-nickname`. The hand
  export contains no `User_Info` row, so the header renders the D-16 fallback
  and the element does not exist.
- **Fix:** Wait on the Activity_history section's `data-status` leaving
  `not-loaded` — the only status a page with no dataset can show, and the state
  every completed import leaves. Specs that want the numbers still wait on
  `playtime[data-state]`, a strictly later moment.
- **Files modified:** `tests/e2e/helpers.ts`
- **Verification:** 17/17 playtime tests, 103/103 e2e.
- **Committed in:** `3a5052f`

**3. [Rule 2 - correctness] The CSV line count is 19 lines but 20 split chunks**
- **Found during:** Task 2 (proving the mixed fixture's shapes)
- **Issue:** The plan's `MIXED_CSV.split('\r').length === 19` is off by one: the
  builder ends the file with a separator, so the split has a trailing empty
  string.
- **Fix:** Assert 19 NON-EMPTY lines, assert the file ends with CR, and assert
  it contains no LF at all. The naive count would have "passed" only after
  deleting the trailing CR the real export ships.
- **Files modified:** `tests/unit/playtime-mixed-fixture.test.ts`
- **Verification:** 21/21 pass.
- **Committed in:** `e4cc6e1`

**4. [Rule 2 - correctness] Four spec errors the browser run caught**
- **Found during:** Task 3 (the Chromium run)
- **Issue:** (a) `[data-testid^="calendar-year-"]` also matches the nested
  `calendar-year-head-`, so the document-order assertion was reading the heads;
  (b) the calendar's ArrowRight moves a WEEK in the same weekday column while
  ArrowDown moves a weekday, and the spec assumed both move a day; (c) the
  calendar's Home and End move along the weekday COLUMN to the year's first
  and last day in it, a different rule from the hour grid's row-relative one;
  (d) the head's sticky `top` is 56px and the nav measures 56.09px, so the head
  sits 0.09px inside it.
- **Fix:** Each corrected to the app's real contract, with a comment saying
  which rule it is and why the distinction matters. (d) now asserts no VISIBLE
  overlap with a stated one-pixel tolerance and records the 0.09px figure,
  rather than pretending two fractional edges coincide.
- **Files modified:** `tests/e2e/playtime-charts.spec.ts`
- **Verification:** 16/16 charts, 17/17 both playtime specs, 103/103 e2e.
- **Committed in:** `94c94a8`

---

**Total deviations:** 4 auto-fixed (4 correctness)
**Impact on plan:** All four were cases where the plan's literal text could not
hold against the code as it actually is. No scope creep; the deliverable
structure, the file list and the test budget are unchanged.

## Issues Encountered

- **The plan assumed Chromium could not be downloaded in its sandbox, so the
  browser specs were to be written and left for CI.** Chromium IS installed on
  this machine and the suite was run for real — 103 e2e, all green. The
  instrument earned its keep: it found four defects in Task 3, all in the spec,
  and Task 1's tracer found a fifth (the worker orders split values by merged
  seconds DESCENDING, so eu-1 is option index 0, not 1 — selecting index 1 read
  na-1's numbers and looked like a wrong total until `compareSplitEntries` was
  read). 04-09 and 04-10 reported four and two respectively; this plan's charts
  spec found four.
- **Two of my own errors were caught by the cross-checks rather than by the
  browser.** The hour grid numbers Monday as weekday 0, so a locally written
  `cellOf` on `Date.getUTCDay()` was off by one on every cell; and the mixed
  fixture's hour cells differ in six places for a reason I had backwards — only
  a session that CROSSES an hour boundary separates the bases, and all three of
  the fixture's overlap pairs start in the same cell, so they contribute
  nothing.
- **`check tdd-red-evidence` remains `INVALID_RED` / `zero_tests_discovered`** for
  this plan, as it was for 04-01, 04-09 and 04-10: it parses node:test TAP
  while vitest 5's TAP reporter nests every test under a file-level group. The
  actual RED state was demonstrated by running each test file against a missing
  module and, for Task 2, against three deliberate fixture mutations, and the
  git-log scope gate passes. No test was weakened to satisfy the check.

## The measured head height — the honest answer

**No behavioural browser proof of the measured head height exists, and this
plan did not find one.**

The measurement itself is right and I can show why: the head is a wrapping
flex row that declares `min-height: 32px` and measures 41px on a wide screen
and taller at 375px, and `headHeightFor` reads `offsetHeight` off the head the
cell actually sits under, after the focus has settled. The sticky-head test
proves both halves of that structurally.

The correction itself never runs. In a real Chromium, across twenty key
sequences — Tab into the grid, every arrow, Home, End, PageUp, PageDown, at
1280px and at 375px, at a 720px and a 1400px viewport, after scrolling the
focused cell far above the viewport — the browser's own `focus()` leaves the
cell about 355px below the top of the viewport. The clearance line is the
nav's bottom (56.09px) plus the head (41px) = 97.6px, so
`focusScrollDelta` returns 0 on every one of them and the value passed in is
never read. A mutant replacing the measurement with the plan's literal `32`
passes every assertion in the suite.

So the value is **correct by construction and unit-tested, and that is all
that covers it.** The structural test in `playtime-charts.spec.ts` says this
in the file, next to the code, so nobody later reads the passing test as a
proof of something it is not.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **04-12 (the 60k-session scale criterion) can run.** It reads
  `data-seconds` and `data-hours` off the hour cells and `data-seconds` off the
  calendar cells, and both are asserted to be exactly what the model produced
  by the two fixtures, so a scale failure cannot be blamed on a wrong expected
  value.
- **For 04-13 (CI), the two `--list` totals are 16 for
  `playtime-charts.spec.ts` and 17 for both playtime specs together**, inside
  the plan's 16-per-task and 36-both-files caps.
- **`git diff --quiet 40ac5c2 -- package.json pnpm-lock.yaml` exits 0.** This
  plan installed no package.
- **Carried forward:** the head-height negative result above is a standing
  limitation, not a closed question. If a future change makes the correction
  reachable — a shorter viewport, a taller head, a different focus strategy — it
  becomes testable, and that is where to look first.

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-09-30*
