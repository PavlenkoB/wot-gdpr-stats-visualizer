---
phase: 11-new-game-data
plan: 09
subsystem: ui
tags: [heat, warships, svelte5, panes, ip-mask, shared-reveal, provenance, t-11-30, t-11-31, t-11-32]
requires:
  - phase: 11-new-game-data
    provides: "11-06's shell reveal cell, 11-07's heat and warships-storage channels and view contract, 11-08's NewDataCard, NewDataTable and pane copy"
provides:
  - HeatPane
  - WarshipsStoragePane
  - "DashboardSection provenanceLabel"
  - "Dashboard branches for heat and warships-storage"
affects: [11-10, 11-11]
tech-stack:
  added: []
  patterns:
    - "an optional pane is a thin composition: one channel query stamped with importedAt, a fixed card list, rows pre-ordered by account on the main thread"
    - "a pane that reads no single folder names its source through an optional provenanceLabel instead of faking a folder"
    - "one explicit aria-live per pane, always present and visually hidden when empty; the error is a fixed sentence in a role=alert element with no live attribute"
key-files:
  created:
    - src/lib/features/new-data/HeatPane.svelte
    - src/lib/features/new-data/WarshipsStoragePane.svelte
    - tests/unit/new-data/new-data-panes.test.ts
  modified:
    - src/lib/shell/Dashboard.svelte
    - src/lib/shell/DashboardSection.svelte
    - tests/unit/import/multi-account-keys.test.ts
    - tests/unit/guards/phase8-ui-review-guards.test.ts
key-decisions:
  - "Panes are mounted from a local newDataSectionProps(pane) in Dashboard, not from sectionProps: there is no SECTIONS folder for either pane, so counts come from result.newDataPanes and status is ready whenever the facts exist (even at zero rows), no-export otherwise."
  - "provenanceLabel is the first term of source (provenanceLabel ?? folder ?? title); the provenance markup was not touched, a test pins its whitespace-sensitive lines byte for byte."
  - "The HEAT pane clears its mask announcement inside the dataset effect (untrack), so the status line is empty on a new dataset; the Warships pane has no announcement and its status line is hidden outside loading."
  - "The Warships pane passes revealed={false} to its cards and takes no reveal prop: an address column added to those files later would stay masked with no control, the documented safe failure."
patterns-established:
  - "A new Svelte component with the Device info error chrome has to be added to the three status colour entries in phase8-ui-review-guards.test.ts."
requirements-completed: [GAMES-01, GAMES-04, PRIV-01]
actuals:
  tokens: 21000
  tasks: 3
  commits: 3
metrics:
  duration: 20min
  completed: 2026-10-19
status: complete
commits: 3
plan_head_before: a3a9f9ba991f263cd8583b4d3fb8c0edf67e0b54
plan_head_after: 4b3b7a85bba9185d2e8a31c2630e89bfe01ebcfb
---

# Phase 11 Plan 09: HEAT and Warships panes Summary

Selecting the HEAT row or the Warships crews & storage row now mounts a real pane: four stacked HEAT cards (with a geolocation mask toggle that drives the shell's one reveal) and two Warships cards, each asking only its own channel, tagged per account for several accounts, and in words for every state.

## What shipped

- **Section shell (`DashboardSection.svelte`)**: an optional `provenanceLabel` that wins over `folder` and `title` when the provenance line and greyed sentences pick their source name. Nothing else in the file changed, so every existing pane's text and the whitespace-sensitive combined-caption block are byte-identical.
- **Shell wiring (`Dashboard.svelte`)**: `newDataSectionProps(pane)` builds `id`, `title` (`PANE_TITLES`), `provenanceLabel` (`NEW_DATA_PROVENANCE_LABELS`), `counts` (`fileCount`, `rowCount`, `skippedRowCount: 0`) from `result.newDataPanes[pane]` and `accountCount` from `accountCountOf(result)`; status is `ready` with facts, `no-export` without. Two branches between device-info and account mount `HeatPane` (`client`, `revealed`, `onRevealChange={setRevealed}`) and `WarshipsStoragePane` (`client`). Neither receives the game filter; the 11-01 guard still passes unedited.
- **`HeatPane.svelte`**: the Device info pane's twin for the `heat` channel. Root `heat-block` with `data-state` and `aria-busy`; one always-present `role="status"` / `aria-live` line carrying the loading sentence and the mask announcements; a fixed `HEAT_ERROR` in a `role="alert"` element; for ready, `HEAT_INTRO` then four `NewDataCard`s from `HEAT_CARD_IDS` (`heat-card-account-stats` in blocks layout, `heat-card-battle-types` with `HEAT_BATTLE_TYPE_COLUMN_ID`, `heat-card-storage`, `heat-card-geolocation`). Rows go through `orderRowsByAccount` with the `accountTagsFor` map. The geolocation card's header snippet holds `HEAT_GEO_NOTE` and, only for a ready card with an address column and rows, the `heat-mask-toggle` button (`data-masked`, label swap, no `aria-pressed`) plus its caption; the click calls `onRevealChange(!revealed)` and announces the next state in words. The pane imports nothing from the login aggregates.
- **`WarshipsStoragePane.svelte`**: the same structure for `warships-storage` with `wows-card-crews` and `wows-card-storage`, table layout, no reveal prop, no mask control, cards given `revealed={false}`.
- **Guards**: `new-data-panes.test.ts` (shell source shape for both Dashboard and DashboardSection, the shared prohibitions, the shared load/accept/state rules per pane, HEAT-specific and Warships-specific contracts). The two keyed card-id eaches are registered in the keyed-each audit as fixed lists.

## Verification

- `pnpm run test:unit`: 114 files, 3677 tests pass (40 more than after 11-08, all in `new-data-panes.test.ts`).
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean (Prettier and ESLint). `pnpm run build`: succeeds.
- `grep -rn gameFilter src/lib/features/new-data` finds nothing outside comments; each pane file holds exactly one `aria-live`.
- Not covered here, by design: the rendered proofs (masked addresses in the DOM, the Logins totals staying unchanged, 375px layout) and the human reading of both panes belong to plan 11-11, which automates them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Colour guard allow-list did not know the new panes**
- **Found during:** Task 2
- **Issue:** `phase8-ui-review-guards.test.ts` fails any colour literal outside an allow-list of files. The plan told the panes to copy Device info's error chrome (`#c5221f`, `#fce8e6`, `#8a1c17`), and the guard rejected the new files.
- **Fix:** added `HeatPane.svelte` (Task 2) and `WarshipsStoragePane.svelte` (Task 3) to the three status colour entries, the same way Device info is listed, rather than inventing a token.
- **Files modified:** tests/unit/guards/phase8-ui-review-guards.test.ts
- **Commits:** fc5cba7, 4b3b7a8

### Plan-shaped judgement calls

**2. Tasks 2 and 3 share their test assertions.** The shared-rule loops in `new-data-panes.test.ts` covered only the HEAT pane in the Task 2 commit and gained the Warships pane in Task 3, so no committed state has a red test. The Task 1 placeholder panes use a `$props()` void with a `svelte-ignore` so `check` stays at zero warnings until the real panes replace them.

**3. The HEAT status line is not hidden while loading; the Warships one is hidden unless loading.** The HEAT line also carries mask announcements, so it is visible whenever it has text; the Warships line only ever carries the loading sentence.

TDD note: as in 11-08, the tests and the files were written together within each task and committed together, so there is no separate RED commit.

## Known Stubs

None. The Task 1 placeholder components were replaced in full by Tasks 2 and 3; both panes read live worker data.

## Threat Flags

None. No network surface, storage or dependency added. T-11-30 (HEAT addresses masked by default through the shell's flag, no logins import, grep-gated), T-11-31 (fixed error sentences, no live attribute) and T-11-32 (answer stamped with `importedAt`, replace lands as loading) are mitigated and asserted by source-shape tests; the in-browser proofs are plan 11-11's.

## Self-Check: PASSED

- FOUND: src/lib/features/new-data/HeatPane.svelte, WarshipsStoragePane.svelte, tests/unit/new-data/new-data-panes.test.ts
- FOUND commits: 77a3681, fc5cba7, 4b3b7a8
