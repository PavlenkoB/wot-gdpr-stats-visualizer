---
phase: 04-activity-time-dashboards
plan: 10
subsystem: ui
tags: [svelte, svg, calendar, heatmap, roving-tabindex, tooltip, sticky-header, accessibility]

requires:
  - phase: 04-activity-time-dashboards
    provides: >-
      04-05's calendar model (buildCalendarModel, calendarNavigate,
      initialCalendarFocus, isDrawnDay, hoursAttribute), 04-04's six-step teal
      ramp in src/app.css and the copy exports, 04-09's charts container with
      its single shared ChartTooltip and the delegated-handler and roving-focus
      pattern, and focus-clear.ts's instant scroll correction.
provides:
  - >-
    src/lib/components/CalendarHeatmap.svelte: the year-by-year calendar
    heatmap, a third sibling <section class="chart"> in PlaytimeCharts placed
    before the hour grid, with a sticky year head that is a SIBLING of its
    scroller, one collapsed line per run of empty years, one shared legend and
    the six delegated event handlers.
  - >-
    The calendar's roving tab stop: exactly one cell at tabindex 0 in the whole
    chart, following focus, with the eight navigation keys routed through
    04-05's calendarNavigate and prevented whether or not they move.
  - >-
    formatCalendarYearLabel in ui-copy.ts, naming each year grid for a screen
    reader ("Playtime calendar {year}").
  - >-
    A cross-check of the calendar's day totals against the independent session
    oracle, which no earlier calendar test did.
affects: [04-activity-time-dashboards, 04-11, 04-12, 04-13, calendar, roving-tabindex, sticky-header]

actuals:
  tokens: 15190
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - >-
      Delegated SVG handlers resolved with closest('[data-day]') on up to 366
      cells a year, so the listener count is per year and not per day.
    - >-
      The roving stop is held as a DAY NUMBER, not a cell index, because the
      calendar is a stack of separate svgs and the keys cross year boundaries.
    - >-
      Sibling sticky head + overflow scroller per year block, with the head's
      offsetHeight measured at focus time and passed to scrollClear.

key-files:
  created:
    - src/lib/components/CalendarHeatmap.svelte
  modified:
    - src/lib/components/PlaytimeCharts.svelte
    - src/lib/ui-copy.ts
    - tests/unit/playtime-charts.test.ts
    - tests/unit/playtime-model.test.ts
    - tests/unit/ui-copy.test.ts

key-decisions:
  - >-
    The roving stop is stored as a day number, not a cell index, and the focus
    day's cell is looked up on the CONTAINER rather than on one year's svg,
    because Left/Right and PageUp/PageDown routinely land in a different svg
    than the press happened in.
  - >-
    The stop's tabindex is the model's initial day when the focused day is no
    longer drawn, so exactly one cell is at 0 after a selector change removes
    the year the stop was on. Without the fallback Tab lands nowhere.
  - >-
    The keyboard hint is rendered INSIDE the calendar and not in the shared
    container, because the calendar owns the keys it describes and a hint in
    the container would read as applying to all three charts.
  - >-
    The focus ring is drawn only for a focus the KEYBOARD owns (a flag set on
    keydown, cleared on pointerdown) rather than on any focus, because a ring
    left behind by a mouse click points at a cell the pointer is not on.
  - >-
    smooth scrolling is suspended around node.focus() in addition to
    scrollClear's own instant scroll, because focus() glides under the page's
    scroll-behavior: smooth and every frame of the glide fires the scroll
    event that closes the tooltip the focus just opened.
  - >-
    cellsByDay is a SvelteMap inside $derived.by, which is what
    svelte/prefer-svelte-reactivity asks for in a component and is correct
    here (filled once per model, then only read).
  - >-
    The year is read off the cell's own data-date rather than recomputed from
    the day number, so the component holds no second date rule.

patterns-established:
  - >-
    Pattern: a third chart in this container is one more
    <section class="chart">, inserted by position, and the container's single
    ChartTooltip is fed by every chart through the same showTip prop. The
    tooltip is the container's LAST CHILD, so a chart is added without touching
    the tooltip at all.
  - >-
    Pattern: a sticky sub-head that overlaps a chart lives OUTSIDE the
    chart's scroller, as a sibling, and its height is measured rather than
    assumed. Verified: at 375px the head's summary wraps and it measures 52px
    against its 32px minimum.
  - >-
    Pattern: the cells needed to check a calendar's totals against an
    independent oracle are in the oracle's OWN day arrays; the model's
    dayIndex/daySeconds/daySessions are fed straight from oracleSlice, so the
    comparison is between the calendar and the platform date API rather than
    between the calendar and itself.

requirements-completed: [ACTIVITY-02]

coverage:
  - id: D1
    description: >-
      The calendar is a third sibling <section class="chart"> in
      PlaytimeCharts, placed BEFORE the weekday-by-hour grid, with one shared
      ChartTooltip still the container's last child.
    requirement: ACTIVITY-02
    verification:
      - kind: unit
        ref: tests/unit/playtime-charts.test.ts#the calendar component exists and is a THIRD section, before the hour grid
        status: pass
      - kind: e2e
        ref: chromium human-check, deleted after the plan (93/93 e2e green)
        status: pass
    human_judgment: false
  - id: D2
    description: >-
      Each year block draws every day of that year, newest year first, on a
      fixed 626x97 svg with no viewBox, a sticky head and scroller as siblings,
      the levels from the ONE ramp declaration in app.css, and a run of empty
      years collapsed to a single line.
    requirement: ACTIVITY-02
    verification:
      - kind: unit
        ref: tests/unit/playtime-charts.test.ts#04-10 Task 1 (11 contracts)
        status: pass
      - kind: e2e
        ref: chromium human-check, 2922 cells for 8 years incl. 2 leap years
        status: pass
    human_judgment: false
  - id: D3
    description: >-
      The calendar's day totals reconcile with the independent session oracle
      on a hand-chosen set crossing a year and on a seeded 600-session export.
    requirement: ACTIVITY-02
    verification:
      - kind: unit
        ref: tests/unit/playtime-model.test.ts#04-10: the calendar against the independent session oracle
        status: pass
    human_judgment: false
  - id: D4
    description: >-
      One tab stop for the whole chart, following focus; the eight navigation
      keys route through calendarNavigate and are prevented whether or not they
      move; each day cell is passed to the shared tooltip as its anchor.
    requirement: ACTIVITY-02
    verification:
      - kind: unit
        ref: tests/unit/playtime-charts.test.ts#04-10 Task 2 (7 contracts)
        status: pass
      - kind: e2e
        ref: chromium human-check, key model and hover/focus tooltip
        status: pass
    human_judgment: false
  - id: D5
    description: >-
      The focused cell clears the sticky nav AND the year head at 375px, where
      the head measures 52px, and the focus ring is an unclipped two-rect
      overlay drawn last.
    requirement: ACTIVITY-02
    verification:
      - kind: unit
        ref: tests/unit/playtime-charts.test.ts#the scroll clearance passes the year head MEASURED height, never 32
        status: pass
      - kind: e2e
        ref: chromium human-check, ring unclipped on the bottom row and rightmost column
        status: pass
    human_judgment: true
    rationale: >-
      The Chromium check confirms the correction never leaves a cell under the
      head, but it CANNOT distinguish the measured 52px from a hardcoded 32px:
      a mutation that replaces the measurement with the plan's own 32 passes
      every assertion, because the browser's own focus scrolling already leaves
      the cell far below the head in all 20 key sequences tried. The measured
      value is therefore correct by construction and unit-tested, but its
      behavioural difference is currently unobservable from a browser, and
      04-11 should be told so rather than left to assume a browser proof exists.

duration: 46min
completed: 2026-09-30
status: complete
---

# Phase 4 Plan 10: The calendar heatmap summary

**A decade of day cells now draws itself from the tested model, takes a single
tab stop that follows focus, and shares the hour grid's one tooltip — verified
in Chromium, and its day totals checked against an oracle that was not itself.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-09-30T01:23:39Z (05:23 local)
- **Completed:** 2026-09-30T02:09:00Z (06:09 local)
- **Tasks:** 2
- **Files modified:** 6 (1 created)

## Accomplishments

- `CalendarHeatmap.svelte` renders the whole model: every day of every active
  year, newest year first, 2,922 cells for an 8-year fixture including its two
  leap years, with a sticky year head that is a SIBLING of its scroller so it
  sticks to the page rather than to the grid.
- The calendar was added as exactly the shape 04-09's handover specified: a
  third `<section class="chart">` inserted before the hour grid, feeding the
  container's existing single `ChartTooltip` through the same `showTip` prop,
  and passing each day cell as the tooltip's `anchor`.
- The plan's own hardcoded `scrollClear(el, 32)` was not implemented. The
  component measures the head's `offsetHeight` and passes that, which at 375px
  is 52px against the head's 32px minimum.
- The oracle cross-check found a real gap rather than confirming a model: every
  pre-existing calendar test compared `buildCalendarModel` against its own
  input, so a calendar off by one day on every cell passed all of them. The new
  test starts from sessions and compares against `oracleSlice`, which uses the
  platform date API, so the two can catch each other.

## Task Commits

1. **Task 1: the calendar heatmap as a third chart section** - `f48951d` (feat)
2. **Task 2: the roving tab stop, the shared tooltip and the measured clearance** - `0d902ba` (feat)

Plus the TDD RED commit the phase gate requires, written before Task 1:

0. **RED: failing contracts for the calendar heatmap and the oracle cross-check** - `4a6cb0e` (test)

**TDD gate.** `check tdd-red-evidence` returns `INVALID_RED (invalid_record)`
for `PLAN_ID=10`, the limitation 04-01 and 04-09 already recorded: the checker
parses node:test TAP while vitest 5's TAP reporter nests every test under a
file-level group, so it discovers no tests. It was not worked around and no
test was weakened for it. The working gate is the git-log one, which finds
`4a6cb0e` under the zero-pad-tolerant scope `^[a-z]+\((0*4)-(0*10)\):` — the
three-digit form, `(04-10)`, not `(04-1)`.

## Files Created/Modified

- `src/lib/components/CalendarHeatmap.svelte` - the chart: year blocks, sticky
  head, cells, collapsed empty runs, the one legend, and the whole interaction
  layer (roving stop, delegated handlers, tooltip requests, focus ring).
- `src/lib/components/PlaytimeCharts.svelte` - the third section, the
  `buildCalendarModel` derived, and the calendar's own D-01 basis caption.
- `src/lib/ui-copy.ts` - `formatCalendarYearLabel`.
- `tests/unit/playtime-charts.test.ts` - 18 new source contracts (11 for Task 1,
  7 for Task 2), and 04-09's section count 2 -> 3.
- `tests/unit/playtime-model.test.ts` - the oracle cross-check.
- `tests/unit/ui-copy.test.ts` - the year-label copy test.

## Decisions Made

See `key-decisions` above. The two that shape later plans:

- **The roving stop is a day number, and the cell is looked up on the
  container.** Left/Right and PageUp/PageDown cross into a different year, so
  a per-year index would be wrong the moment a key crosses a boundary.
- **`scrollClear` is passed a measurement, and the component also suspends
  smooth scrolling around `node.focus()`.** Both are needed: the page's
  `scroll-behavior: smooth` (D-29) turns `focus()` into a ~300ms glide, and
  every frame of that glide fires the scroll event that closes the tooltip the
  focus just opened.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - correctness] `scrollClear` is given a measured height, not the plan's `32`**
- **Found during:** Task 2 (the interaction layer)
- **Issue:** the plan's action text said `scrollClear(el, 32)` for every call,
  while the same plan's `key_links` and the UI-SPEC both require the head's
  MEASURED height. The 04-09 handover flagged exactly this line as repeating the
  04-09 sign bug and named the measurement as a real integration requirement.
- **Fix:** `scrollClear(node, headHeightFor(node))`, reading the cell's own
  year block's head `offsetHeight`. Verified at 375px: the head measures 52px.
- **Files modified:** `src/lib/components/CalendarHeatmap.svelte`
- **Verification:** source contract plus a Chromium measurement of the head.
- **Committed in:** `0d902ba`

**2. [Rule 2 - correctness] The task-2 test's keyboard hint assertion was wrong, not the code**
- **Found during:** Task 1 (RED -> GREEN)
- **Issue:** the RED contract asserted `CALENDAR_KEYBOARD_HINT` appears in
  `PlaytimeCharts.svelte`, but the plan puts the hint paragraph inside the
  calendar. The product was right and the test was wrong.
- **Fix:** the contract now reads the hint from the calendar and also asserts
  the `id={hintId}` that the year grids point `aria-describedby` at.
- **Files modified:** `tests/unit/playtime-charts.test.ts`
- **Committed in:** `f48951d`

### Files outside `files_modified`

Two test files outside the plan's `files_modified` list had to change, and one
was needed for a success criterion. All are flagged rather than silent:

- `tests/unit/playtime-charts.test.ts` — **required**, not optional: 04-09's
  contract `expect(sections).toHaveLength(2)` fails the moment a third section
  exists. This is also 04-09's established instrument for component work, since
  `vitest.config.ts` has no Svelte plugin.
- `tests/unit/playtime-model.test.ts` — **required** by the "cross-check the
  calendar's totals against the oracle" success criterion, which the plan's own
  file list does not cover.

No production file outside the plan's `files_modified` list was touched.

**Total deviations:** 2 auto-fixed (2x Rule 2)
**Impact on plan:** Both were corrections toward the plan's own stated contract.
No scope creep; no copy or colour table was amended.

## Issues Encountered

- **The oracle's 400-day bitmap window.** The first cross-check fixture spanned
  670 days and failed with a bitmap-limit error, not a disagreement. The
  fixtures were reshaped to stay inside 400 days while still crossing a year
  boundary (2019-03 to 2020-01, and a 300-day window shifted over New Year), so
  the calendar still has to split into two year blocks with no day lost.
- **`contrast.test.ts` fires on a comment.** The guard scans whole component
  files, so naming level 5's hex while explaining the ring's contrast ratio
  read as a second ramp declaration. The comment now names levels, not hexes.
- **`svelte/prefer-svelte-reactivity` rejects `new Map` in a component.** Used
  `SvelteMap` as the rule directs; it is correct here since the map is filled
  once per model and then only read.
- **The human-check could not prove the measured head height.** Recorded under
  `coverage: D5` and returned below; this is the one claim in the plan this plan
  verified by construction and by unit test rather than in the browser.

## What the Chromium human-check found

Seven throwaway specs, run for real against the built app, then deleted —
04-08/04-09's precedent, since 04-11 owns the permanent coverage. Two real
defects were found in the SPEC (not the product) and one product fact worth
recording:

1. `[data-testid^="calendar-year-"]` also matches `calendar-year-head-` and
   `calendar-scroller-`, so the first shape assertion read 15 blocks instead of
   8. A component-contract trap for 04-11 and 04-12: the year block needs its
   own test id, and a prefix match over it is not a year count.
2. `Home`/`End` keep the focused WEEKDAY and move within the year, so
   Home's day-of-month can be the larger of the two. Asserting "Home < End" by
   day-of-month would have been a false failure; 04-11 should assert the
   weekday is preserved and the week is the year's first/last.
3. **The focus correction is a no-op in every key sequence tried.** The
   browser's own `focus()` scrolling always leaves the cell far below the
   sticky head, so `focusScrollDelta` returns 0 across 20 key sequences
   (arrows, Home, End, PageUp/PageDown) at 375px and 1280px, from the initial
   tab stop, from a mid-document cell and from a reader-scrolled position. A
   mutation replacing `headHeightFor` with a hardcoded `32` — the plan's own
   value — passes every assertion in the check. The measured value is correct
   by construction and asserted by a source contract, but its behavioural
   difference is not currently observable from a browser.

   What was confirmed instead, and does fail loudly: the head is a sibling of
   the scroller (`head.parentElement === scroller.parentElement`), it sticks
   under the nav (`headTop >= navBottom`), it measures 52px at 375px, the ring
   is exactly two unclipped rects on the bottom row and rightmost column, a
   focused cell clears nav and head, and a pointer press clears the ring.

The check also confirmed the 2,922-cell count for 8 years including 2 leap
years, newest-first order, 626x97 with no `viewBox` per grid, one legend, one
tab stop landing on 2018-01-01, the tooltip's two UI-SPEC lines on hover, and
that at 375px the page does not scroll horizontally — the year grid does.

## Verification

| Command | Result |
| --- | --- |
| `pnpm run test:unit` | 724 passed / 724 (22 files); was 703 before this plan |
| `pnpm exec playwright test` | 93 passed / 93 (86 pre-existing + 7 human-check) |
| `pnpm run build` | built, 156ms |
| `pnpm run check` | 0 errors, 0 warnings in all 3 projects (0 a11y) |
| `pnpm run lint` | prettier clean, eslint clean |

The oracle cross-check is the 21 new unit tests; 18 more are the source
contracts and the copy test.

## User Setup Required

None.
