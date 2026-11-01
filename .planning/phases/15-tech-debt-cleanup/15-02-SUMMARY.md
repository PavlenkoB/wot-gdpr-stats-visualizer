---
phase: 15-tech-debt-cleanup
plan: 02
subsystem: ui
status: complete
tags: [privacy-copy, readme, pins, confirm-panel]

requires:
  - phase: 13-overview
    provides: the pin store and decision 13-D-14 (pins survive Clear and Start over by design)
provides:
  - "CONFIRM_CLEAR_MESSAGE with a third sentence saying the pinned Overview tiles stay in this browser and hold no export data"
  - "A unit test pinning the anchor sentences, the three claims of the new sentence, and the store-only-reads-and-writes-its-one-key claim"
  - "A README caveat naming the pinned-tile list as the one other thing the app keeps in the browser"
affects: [15-13]

actuals:
  tokens: 5500
  tasks: 2
  commits: 2
plan_head_before: 63539136c9ecdc609ada146a577ce61d87fdeaf9
plan_head_after: c2967f6

key-files:
  created: []
  modified:
    - "src/lib/ui-copy.ts"
    - "tests/unit/shell/ui-copy.test.ts"
    - "README.md"

key-decisions:
  - "The storage global and the key string stay out of src/ (single-file store guard); the copy says 'this browser' and 'tile ids'"
  - "EMPTY_STATE_PRIVACY ('Your data stays in this tab.') and OVERVIEW_HINT are left unchanged, as the plan directs"

requirements-completed: []

duration: 5min
completed: 2026-11-01
---

# Phase 15 Plan 02: Privacy copy names the pins Summary

**The Start over / Clear confirmation and the README caveat now say the pinned Overview tiles stay in this browser and hold no export data, with a test that pins the wording and proves the store can only read and write its one key.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `CONFIRM_CLEAR_MESSAGE` keeps its first two sentences byte for byte and adds: "Your pinned Overview tiles stay in this browser; they hold no export data." Both entry points (Start over and Clear my cached data) share it, so no component changed.
- `tests/unit/shell/ui-copy.test.ts` gained four tests: the unchanged anchor, exactly one added sentence carrying the three claims by name, a single plain-text line, and a recording-proxy store showing that reading, pinning and unpinning touch only `getItem` and `setItem` on `PINS_KEY`.
- README Caveats gained a bullet after the IndexedDB one: the pinned-tile list, tile names only, in local storage under one key, written only on pin or unpin, survives Clear and Start over, readable by a sibling project on the same github.io origin and harmless because it holds no export data.

## Task Commits

1. **Task 1: confirmation names the pins, with test** - `378a2e0` (feat)
2. **Task 2: README caveat names the pinned-tile list** - `c2967f6` (docs)

## Verification

- `vitest run` on ui-copy, overview-pins, overview-copy and guards: 25 files, 804 tests passed.
- `playwright test` on persistent-dataset and dashboard specs: 49 passed (the confirmation panel renders the longer message without a layout or wrap failure).
- `pnpm run lint` and `pnpm run check`: clean (0 errors, 0 warnings).
- grep for the new sentence in `src/lib/ui-copy.ts`: 1 (baseline 0). grep for "survives" in README.md: 1 (baseline 0).
- `git diff 2cb5359 -- src/lib/ui-copy.ts`: one constant and its doc comment.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Open question for the owner

`EMPTY_STATE_PRIVACY` ("Your data stays in this tab.") and the Overview hint were deliberately left untouched, as the plan directs. The empty-state sentence is pinned by a unit test and an e2e spec; whether it should also mention the pins is the owner's call.

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file or storage surface; the pin behaviour and the pins module are unchanged.

## Self-Check: PASSED

- src/lib/ui-copy.ts, tests/unit/shell/ui-copy.test.ts, README.md: modified and committed.
- Commits 378a2e0 and c2967f6 are ancestors of HEAD.
