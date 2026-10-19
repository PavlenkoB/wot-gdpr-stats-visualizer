---
phase: 11-new-game-data
plan: 05
subsystem: shell
tags: [pane-model, optional-panes, overview, keyboard-stepping, d-01, d-03, pitfall-7, pattern-5, t-11-16]
requires:
  - phase: 11-new-game-data
    provides: "11-04's ClassifyResult.newDataPanes and the shared NEW_DATA_PANE_IDS contract"
provides:
  - OPTIONAL_PANE_IDS
  - PANE_ORDER
  - optional-aware paneEntries
  - three-argument stepSelection
  - optional Overview cards and chips
  - formatHeatRowSummary
  - formatWowsStorageRowSummary
  - NEW_DATA_PROVENANCE_LABELS
  - formatNewDataSkipped
affects: [11-08, 11-09, 11-10, 11-11]
tech-stack:
  added: []
  patterns:
    - the vocabulary is widened around the nine-member tuple instead of into it, so every loop over PANE_IDS keeps its meaning
    - a pane that is absent has no entry at all, so "not in this export" counts and Overview cards need no special case for it
    - the keyboard walks the rendered entries, not the vocabulary
key-files:
  created:
    - tests/unit/shell/list-pane-optional.test.ts
  modified:
    - src/lib/shell/selection-state.ts
    - src/lib/shell/overview-model.ts
    - src/lib/shell/ListPane.svelte
    - src/lib/ui-copy.ts
    - tests/unit/shell/selection-state.test.ts
    - tests/unit/shell/overview-model.test.ts
    - tests/unit/shell/dashboard-status.test.ts
    - tests/unit/shell/ui-copy.test.ts
    - tests/e2e/shell/mobile-sweep.spec.ts
decisions:
  - "PANE_IDS stays the nine always-present panes; PaneId widens to the union and PANE_ORDER (eleven) is the list order. The e2e specs that loop PANE_IDS are untouched in meaning."
  - "Assumption A2 held: an absent optional pane has no row, no card and no count anywhere; a present-but-empty one is a muted 'empty' row and card, in neither the withData nor the absent chip."
  - "Overview.svelte needed no edit: it renders whatever overviewCards returns and contains no id list, so the two optional cards arrive through the model alone."
  - "The footer derivation (unsupportedEntries and friends) is not edited and does not read newDataPanes; a test pins it equal with and without the pane facts."
  - "GAMES-01 and GAMES-04 are NOT marked complete: both read 'are shown' and this plan shows rows and cards, not the pane contents (plan 11-09)."
actuals:
  tokens: 21000
  tasks: 2
  commits: 6
metrics:
  duration: 25min
  completed: 2026-10-19
status: complete
commits: 6
plan_head_before: 8ef59bc70a53ace81855dbb501c57185da45b64f
plan_head_after: 1c3b1e08c3a070895120cda5e8d34025e8be771d
---

# Phase 11 Plan 05: Optional panes in the shell Summary

HEAT and "Warships crews & storage" now get a list row and an Overview card only when the worker reports them, with the nine v1.0 panes, their order and their text unchanged for every export that holds neither.

## What shipped

- **Pane model (`selection-state.ts`, `ui-copy.ts`)**: `OPTIONAL_PANE_IDS` re-exports the shared contract, `PANE_ORDER` holds the eleven ids with the two directly after Vehicles, `paneEntries` walks it and drops a pane the worker did not report. A present pane shows its stored row count and the fixed summary sentence with the file count; a present pane with zero stored rows is muted with reason `empty`, the em-dash headline and the existing empty-status sentence. `stepSelection(current, direction, order = PANE_IDS)` stays clamped and unwrapped and leaves an id absent from the order unchanged. `ui-copy.ts` gained the two titles, the two row-summary formatters, the provenance labels and `formatNewDataSkipped`.
- **List and Overview (`ListPane.svelte`, `overview-model.ts`)**: a row click resolves over `PANE_ORDER`, and j/k/arrows step over the ids of the rendered entries, so an absent row is skipped by being absent. The Overview card list is a filter of `paneEntries` over the seven card ids plus the two optional ids; `OVERVIEW_CARD_IDS` is still exactly seven.
- **Tests**: new cases in `selection-state`, `ui-copy`, `overview-model` and `dashboard-status`, plus a source-shape guard `list-pane-optional.test.ts` (components cannot be rendered in this repo's Node-only vitest). No pre-existing assertion was edited except re-keying an expectation table by the nine always-present ids (see Deviations).

## Verification

- `pnpm run test:unit`: 109 files, 3541 tests pass.
- `pnpm run check`: 0 errors, 0 warnings.
- `pnpm run lint`: clean (prettier and eslint).
- `OVERVIEW_CARD_IDS` lists seven ids; `stepSelection` in `ListPane.svelte` takes three arguments; `dashboard-status.ts` has no non-comment reference to `newDataPanes`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `PaneId` widening broke two `Record<PaneId, ...>` expectation tables**
- **Found during:** Task 1 (`pnpm run check`)
- **Issue:** `tests/e2e/shell/mobile-sweep.spec.ts` and `tests/unit/shell/selection-state.test.ts` keyed a table by `PaneId` while looping the nine `PANE_IDS`; the wider type demanded entries for the two optional ids.
- **Fix:** keyed both tables by the always-present pane ids, leaving the loops and the expectations unchanged.
- **Files modified:** tests/e2e/shell/mobile-sweep.spec.ts, tests/unit/shell/selection-state.test.ts
- **Commits:** 912309a, e78b062

**2. [Rule 1 - Style] Prettier failures in three files**
- **Found during:** Task 2 (`pnpm run lint`)
- **Fix:** ran Prettier on `overview-model.ts` and the two test files committed earlier.
- **Commits:** 0bebedb, 1c3b1e0

### Notes

- The plan's request to confirm the muted-`empty` row carries the visually hidden reason suffix: the row markup is generic and, in this repository, muted rows carry no extra suffix element for any reason, so the optional rows behave exactly like the existing muted ones. No markup was added.
- The plan's `git diff main...HEAD` additions-only check on `selection-state.test.ts` does not apply across the whole branch (earlier plans on the branch touch it); within this plan the only edit to existing lines is the table re-keying above.
- `Overview.svelte` was listed in `files_modified` but needed no change.
- The e2e specs were not run (the plan asks for unit, check and lint only; plan 11-11 automates the browser part).

## Known Stubs

None. The optional rows and cards are fully derived from `newDataPanes`; the panes they open are delivered by plan 11-09.

## Self-Check: PASSED

- Commits bcdef70, 912309a, e78b062, 0490e58, 0bebedb, 1c3b1e0 are ancestors of HEAD.
- `src/lib/shell/selection-state.ts`, `overview-model.ts`, `ListPane.svelte`, `ui-copy.ts` and `tests/unit/shell/list-pane-optional.test.ts` exist.
