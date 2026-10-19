---
phase: 11-new-game-data
plan: 07
subsystem: worker-data-channels
tags: [heat, warships, data-channel, card-views, four-state, allowlist, d-09, t-11-21, t-11-22, t-11-23]
requires:
  - phase: 11-new-game-data
    provides: "11-03's allowlisted rows and fixtures, 11-04's stored-vs-parsed presence facts and NEW_DATA_PANE_FILES"
provides:
  - HeatView
  - WarshipsStorageView
  - NewDataCardView
  - HEAT_CARD_IDS
  - WOWS_CARD_IDS
  - HEAT_CARD_FILES
  - WOWS_CARD_FILES
  - buildNewDataCard
  - buildHeatView
  - buildWarshipsStorageView
  - orderRowsByAccount
  - firstRowPerAccount
  - shouldWindow
  - PLAIN_TABLE_MAX_ROWS
  - cardSummary
  - viewSummary
  - "data channels heat and warships-storage"
  - buildNewDataTwoAccountExport
affects: [11-08, 11-09, 11-10, 11-11]
tech-stack:
  added: []
  patterns:
    - "cells are read by a direct own-property read through the spec's constant header; the builder never walks a row's own keys"
    - "a channel's file table is built from the shared pane contract, so the reader and the builder cannot drift"
    - "an address-kind cell is the canonical parseIp string or null, so the reveal can only ever show an address"
key-files:
  created:
    - src/lib/features/new-data/new-data-aggregate.ts
    - src/lib/features/new-data/new-data-state.ts
    - tests/unit/new-data/new-data-aggregate.test.ts
    - tests/unit/new-data/new-data-state.test.ts
    - tests/unit/import/new-data-worker.test.ts
  modified:
    - src/lib/features/new-data/new-data-shared.ts
    - src/lib/worker/data-queries.ts
    - src/lib/core/types/worker-messages.ts
    - tests/fixtures/new-data-fixtures.ts
    - tests/unit/import/data-query-worker.test.ts
decisions:
  - "A pane view is { status: 'ready', cards: Record<cardId, NewDataCardView> }. The plan said 'plus one NewDataCardView per card id'; a cards record keeps viewSummary generic over both panes and leaves the top level free for the shared finance state functions."
  - "A card with zero stored rows is skipped only when the summed parsed count is above zero; an unknown count (legacy cache, no matching fact) is no-rows, the one sentence true of both cases."
  - "A number-kind cell becomes a JS number only for a plain signed decimal of at most 40 characters, an integer only when it is a safe integer; anything else stays the trimmed string."
  - "A column is listed when at least one stored row carries its header as an own property (hasOwn on the spec constant), never by walking row keys, so the grep gate on Object.keys/entries/for-in stays clean."
  - "orderRowsByAccount returns the input array itself when tags is null, and a new array otherwise."
  - "GAMES-01 and GAMES-04 are NOT marked complete: both read 'are shown' and this plan delivers the data half only (plan 11-09 renders the panes). PRIV-01 is already complete."
actuals:
  tokens: 13000
  tasks: 3
  commits: 3
metrics:
  duration: 35min
  completed: 2026-10-19
status: complete
commits: 3
plan_head_before: 6388725fbf32a7e5621df3ba094d6795c6032190
plan_head_after: 868c5d77f6b831a242346a6f461115a37c9587aa
---

# Phase 11 Plan 07: Pane data channels Summary

The `heat` and `warships-storage` worker channels now answer four-state, account-stamped, spec-only card views (HEAT: four cards, Warships: two) from one Dexie snapshot each, with the pure builders and the page-side state helpers the 11-08 and 11-09 components will use.

## What shipped

- **View contract (`new-data-shared.ts`, still import-free)**: `NewDataCardView` as a union on `status` (`not-in-export`, `no-rows`, `skipped`, `ready` with `columns`, `rows`, `rowCount`), `HEAT_CARD_IDS`, `WOWS_CARD_IDS`, the card-to-file maps, `HeatView` and `WarshipsStorageView`. The views have no file-name field at all (T-11-23). The cell bound is 200 characters.
- **Builders (`new-data-aggregate.ts`)**: `buildNewDataCard(spec, { groups, seen, parsed })` decides the state, lists the spec columns some row carries in spec order, and reads each cell through the spec's constant header. Missing, blank and N/A or N/D are null; numbers, text, dates and addresses follow the plan's cell rules; an address cell is `parseIp(...).canonical` or null. `buildHeatView` and `buildWarshipsStorageView` wrap it with the fixed card order and a top-level status that is always ready. Nothing is sorted, filtered or truncated.
- **Channels (`data-queries.ts`, `worker-messages.ts`)**: `DATA_FILES.heat` (activity_history plus player_statistics) and `DATA_FILES['warships-storage']` are built from `NEW_DATA_PANE_FILES`; a `factsOf` helper returns presence and the summed `parsedRowCount ?? rowCount` (null for a legacy cache or no matching fact). Both cases join the exhaustive `answerDataQuery` switch; `isDataQuery` and `DATA_CHANNELS` needed no edit because they derive from the table, and a test proves a smuggled `title`/`battleType` is refused with `invalid query`.
- **State helpers (`new-data-state.ts`, type imports only)**: `PLAIN_TABLE_MAX_ROWS = 500` with `shouldWindow`, a stable `Map`-keyed `orderRowsByAccount`, `firstRowPerAccount`, `cardSummary` and `viewSummary`.
- **Fixture**: `buildNewDataTwoAccountExport()` (root A: Warships files with three rows; root B: Warships files with two rows plus the four HEAT files) and the `NG_*_PANE_KEYS` lists.

## Verification

- `pnpm run test:unit`: 112 files, 3588 tests pass (28 new unit tests in `tests/unit/new-data`, 18 new worker-level tests).
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean.
- `grep -c '^import' new-data-shared.ts` is 0; the aggregate has no `Object.keys`, `Object.entries` or `for ... in`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened the view union in `data-query-worker.test.ts`**
- **Found during:** Task 2 (`pnpm run check`)
- **Issue:** the test's `viewOf` helper returned a hand-listed union of view types, which no longer covered `DataResult['view']` once the two channels existed (TS2322).
- **Fix:** added `HeatView | WarshipsStorageView` to the return type, the same edit `LoginsView` and `DeviceInfoView` received before.
- **Files modified:** tests/unit/import/data-query-worker.test.ts
- **Commit:** d313e9c

**2. [Test data] The "no files" worker case uses a HEAT-only archive for Warships**
- **Found during:** Task 2
- **Issue:** the shared sample export already carries a legacy `WOWS_Crews.csv`, so a Warships `not-in-export` assertion against it was wrong.
- **Fix:** the sample export is used for the four HEAT `not-in-export` cards; a HEAT-only archive built in the test proves the two Warships ones.
- **Commit:** d313e9c

TDD note: the builders and tests were written together and committed per task rather than as separate RED commits; every behaviour bullet has a test that fails against a broken implementation (the canary, truncation and state tests).

## Known Stubs

None.

## Threat Flags

None. The new channels add no network surface, and the views carry only spec cells, account roots and counts (T-11-21, T-11-22, T-11-23 mitigated and tested; T-11-24 accepted as planned).

## Self-Check: PASSED

- FOUND: src/lib/features/new-data/new-data-aggregate.ts, new-data-state.ts, tests/unit/import/new-data-worker.test.ts, tests/unit/new-data/*.test.ts
- FOUND commits: 0df17e6, d313e9c, 868c5d7
