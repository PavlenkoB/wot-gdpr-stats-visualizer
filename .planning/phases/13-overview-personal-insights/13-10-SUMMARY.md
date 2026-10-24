---
phase: 13-overview-personal-insights
plan: 10
subsystem: ui
tags: [overview, bento, keyboard, view-transitions, layout, pure-modules, d-11, d-15, d-16]

requires:
  - phase: 13-overview-personal-insights
    provides:
      - "13-01: OverviewView, OverviewTile and the closed tile-id tuple"
      - "13-06: the tile catalogue, fillSpans and the pin store"
provides:
  - "overview-nav.ts: TileRect, NavKey, isNavKey, nextTileIndex, rovingIndex"
  - "overview-motion.ts: createExpander, ExpanderEnv, ExpanderTransition, anchorDelta, browserExpanderEnv, TRANSITION_FALLBACK_MS"
  - "overview-layout.ts: layoutGroups, domOrder, isEmptyScreen, LayoutGroup, LayoutTile, LayoutAbsent"
affects: [13-12, 13-13, 13-14, overview]

plan_head_before: 8ff3f46c1ea04da805e24076c5679ae36ef2981f
plan_head_after: 627554c371a5b63725b49cc9fde2497f03cc07bf
commits: 2
actuals:
  tokens: 13000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Keyboard targets are decided from bounding rectangles handed in by the component, so the sketch's measured rule is proved in Node"
    - "Intent first, animation second: the wanted state is recorded synchronously and every commit reads it at execution time"
    - "Browser pieces reach a pure module through an injected environment; importing the module in Node touches no global"

key-files:
  created:
    - "src/lib/features/overview/overview-nav.ts"
    - "src/lib/features/overview/overview-motion.ts"
    - "src/lib/features/overview/overview-layout.ts"
    - "tests/unit/overview/overview-nav.test.ts"
    - "tests/unit/overview/overview-motion.test.ts"
    - "tests/unit/overview/overview-layout.test.ts"
  modified: []

key-decisions:
  - "An absent tile always sits in its own group's absent row, pinned or not, so Pinned holds only ready tiles and Logged in absent is never in Pinned (D-11, OI-3)."
  - "A request commits at most once and reads the wanted state at execution time, so the newest request wins whichever of the transition callback and the 600 ms timer fires first (D-16)."
  - "The vertical-move rule is the sketch's `vertical`, branch for branch, including the one-pixel slack and the strict larger-overlap tie-break."

patterns-established:
  - "Layout order comes from walking the catalogue, never from the pins array, so a shuffled pin list gives an identical layout."

requirements-completed: []

coverage:
  - id: D1
    description: "Arrow, Home and End targets match the sketch's measured rule across groups, with no wrap and earlier-tile tie-breaks"
    requirement: INSIGHT-05
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-nav.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Expand records the wanted state synchronously and commits it once, through a transition only when allowed, with reduced-motion, missing-API, throwing-API, fallback and skipped-transition paths"
    requirement: INSIGHT-04
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-motion.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "One pure function decides Pinned, the groups, the absent rows, the spans, the legend flag and the empty screen"
    requirement: INSIGHT-03
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-layout.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The modules driving a real browser: focus handling, the view transition animating and the scroll anchor"
    requirement: INSIGHT-04
    verification:
      - kind: manual
        ref: "13-12-PLAN.md and 13-14 browser checks (composed page)"
        status: backstop
    human_judgment: true

duration: 15 min
completed: 2026-10-23
status: complete
---

# Phase 13 Plan 10: Navigation, Motion and Layout Summary

**Three pure modules so the bento component is thin glue: rectangle-based keyboard targets ported from the sketch, a synchronous-intent expand controller with its fallbacks, and the layout that decides Pinned, groups, absent rows and spans.**

## Accomplishments

- `nextTileIndex` moves left and right in DOM order without wrapping, Home and End to the ends, and Up and Down by the sketch's `vertical` rule: smaller vertical distance, then strictly larger horizontal overlap, an exact tie going to the earlier tile; a one-pixel slack on the distance and a candidate overlapping by one pixel or less is ignored. `rovingIndex` gives the roving tab stop.
- `createExpander` records `wanted(id)` before anything else. With the API absent or reduced motion on it commits at once. Otherwise it arms a 600 ms timer, starts the view transition, and commits through the injected flush with the wanted state read at execution time. A throwing API commits at once, each request commits at most once, and every transition promise is caught. A click computes `!wanted(id)`, never from the DOM.
- `layoutGroups` walks the catalogue once: ready pinned tiles go to Pinned, other ready tiles to their group, and every absent tile to its group's absent row. Groups come out in the fixed order and an empty one is omitted. Spans come from `fillSpans` per group, and the legend flag is true only for Time and Tanks when a chart tile is present. `domOrder` and `isEmptyScreen` support the keyboard order and the empty state.
- The worked example holds: with the default pins, Time is hour, streak, sess, busy with feature span `[2, 0, 0, 0]`.

## Known limit for 13-12: Pinned spans are solved against dense placement

`fillSpans` simulates `grid-auto-flow: dense`; Pinned renders with sparse flow (13-09, WINDOWS entry 27). Pinned's reading order is safe either way, but the feature widths chosen for it can leave a different number of holes under sparse flow than the solver counted. Pinned is normally a few tiles and usually heroes, which never widen, so this was not worth a second simulator inside this plan, and `overview-grid.ts` was outside its file list. The limit is written into the header of `overview-layout.ts`. If it shows in the browser checks, the fix is a sparse variant of `gridHoles` and a flag on `fillSpans`, used only for the `pinned` group.

## Task Commits

1. **Task 1: keyboard targets from rectangles and the expand controller** - `ca67fff` (feat)
2. **Task 2: Pinned, groups, absent entries, spans and the empty screen** - `627554c` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `ready` and `updateCallbackDone` are caught too**
- **Found during:** Task 1
- **Issue:** the plan types a started transition as `{ finished }` and catches only that. A real `ViewTransition` also has `ready` and `updateCallbackDone`, and each rejects when a newer transition skips it, which is an unhandled rejection in the browser (the sketch catches all three).
- **Fix:** `ExpanderTransition` has `finished` required and `ready` and `updateCallbackDone` optional; all present promises are caught. The real `ViewTransition` is assignable to it. A test covers the two optional promises.
- **Files modified:** src/lib/features/overview/overview-motion.ts, tests/unit/overview/overview-motion.test.ts
- **Commit:** ca67fff

### Choices within the plan

- The fallback timer's commit also goes through `env.flush`, like the callback's, so a transition that never ran still applies to the DOM synchronously.
- `browserExpanderEnv` takes timers from `globalThis` (the same object as `window` in a page) and `matchMedia` as a bare global read at request time, so a Node test can stub both without a `window`.
- A `view` with no tiles at all counts as an empty screen (`every` over an empty array); the worker always sends sixteen, so this only matters for a malformed value.
- My first draft of one layout test expected the Tanks feature to widen. A feature and two metrics already fill four columns, so nothing widens; the test now checks every group against `fillSpans` directly and asserts `[0, 0, 0]` for Tanks.

## Issues Encountered

None.

## Verification

- `pnpm run check`: 0 errors, 0 warnings
- `pnpm run lint`: prettier and eslint clean
- `pnpm run test:unit`: 158 files passed, 4699 passed, 9 expected fail
- `pnpm exec vitest run tests/unit/overview`: 19 files, 490 tests passed
- Nothing was run in a browser; the modules are bound to the DOM in plan 13-12 and checked there and in 13-14.

## Requirements

INSIGHT-03, INSIGHT-04 and INSIGHT-05 are NOT marked complete by this plan. It ships the logic only; the composed bento, the expand in place, the keyboard and the pins arrive in 13-12 and are checked in a browser in 13-14. The requirements are left unticked until then (the same call 13-09 made).

## Known Stubs

None.

## Threat Flags

None. No new network, storage, auth or file surface. T-13-29 is mitigated (600 ms fallback, throwing API commits at once, at-most-once per request, newest wanted state wins, all promises caught) and T-13-30 is mitigated (pins are matched only against the closed definition set; a test feeds `__proto__`, `constructor` and an unknown id and gets no tile selected).

## Self-Check: PASSED

- All created files exist: overview-nav.ts, overview-motion.ts, overview-layout.ts and the three test files.
- Commits ca67fff and 627554c are ancestors of HEAD.
