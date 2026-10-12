---
phase: 02-defensive-parsing-persistent-dataset
plan: 03
subsystem: destructive-actions
tags: [confirm-panel, clear-data, data-02, import-06, d-13, d-15, d-16, d-17, d-18, d-19, d-20, d-21, d-22, persistent-dataset]
dependency-graph:
  requires: [02-01, 02-02]
  provides: [destructive-controls-ui, persistent-cache-mitigation]
  affects: [data-02, import-06]
tech-stack:
  added: []
  patterns:
    - confirm-pending-state-discriminator
    - shared-copy-via-ui-copy
    - one-shot-acknowledgment-flag
key-files:
  created:
    - src/lib/components/ConfirmPanel.svelte
  modified:
    - src/lib/worker/db.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/ui-copy.ts
    - src/lib/worker-client.svelte.ts
    - src/lib/components/ResultsView.svelte
    - src/App.svelte
    - tests/unit/db.test.ts
    - tests/unit/ingest-client.test.ts
    - tests/e2e/persistent-dataset.spec.ts
    - tests/e2e/import-flow.spec.ts
decisions:
  - "D-22 implemented as ONE confirm-pending state with a PendingAction kind discriminator ('replace' | 'start-over' | 'clear-data') rather than three separate states — collapses the App.svelte switch into one ConfirmPanel render with one copy-pair selection block."
  - "Destructive-trigger design rule (UI-SPEC): the Start Over and Clear my cached data trigger buttons themselves stay neutral grey; only the ConfirmPanel's commit button uses the destructive red palette. The existing .start-over accent-blue styling is restyled to neutral in this plan."
  - "D-20 acknowledgment is a one-shot boolean (justCleared) cleared by the next submitFiles() or reset() call, never by a timer — matches the project's existing 'nothing auto-dismisses' contract."
  - "D-13 replaces Phase 1's silent drop-ignore behavior: a drop on 'done' now stashes the file as a 'replace' pendingAction and transitions to 'confirm-pending' (no worker message posted until confirmed)."
  - "Tests use a fresh Playwright context per test (existing 02-02 pattern), so IndexedDB starts empty for every test in the new destructive-controls describe block — no cross-test cache contamination."
metrics:
  duration: "~7 min wall, plan commit count = 3 (one per task)"
  completed: 2026-09-29
status: complete
actuals:
  tokens: 17072
  tasks: 3
  commits: 3
  plan_head_before: 860182395b9b6c04c50e7ababf253bb2641ba233
---

# Phase 2 Plan 3: Destructive Confirmation Controls Summary

**One-liner:** Shared in-app ConfirmPanel + persistent "Clear my cached data" control closing DATA-02 (Information Disclosure mitigation) and the IMPORT-06 UX layer; all three destructive flows (replace-on-drop, Start Over, Clear my cached data) route through one confirm mechanism with one copy pair.

## What was built

### Worker side (Task 1)

- **`src/lib/worker/db.ts`** — new exported `clearData(): Promise<void>` that atomically wipes `db.rows` and deletes the 'active' record from `db.meta` inside one Dexie `rw` transaction. Safe to call when no dataset was ever written (Dexie's `clear()` on empty / `delete(key)` on missing are both no-ops).
- **`src/lib/worker/ingest.worker.ts`** — `'clear-data'` request branch wired into a new `handleClearData(jobId)` handler that mirrors `handleCheckCache`'s single-catch convention: clears via `clearData()`, posts `{ type: 'cleared', jobId }` on success, routes Dexie errors through the existing structured `'error'` channel.

### Shared copy (Task 1)

- **`src/lib/ui-copy.ts`** — eight new exports verbatim from the 02-UI-SPEC Copywriting Contract: `CONFIRM_REPLACE_MESSAGE`, `KEEP_CURRENT_DATA_LABEL`, `REPLACE_DATASET_LABEL`, `CONFIRM_CLEAR_MESSAGE`, `KEEP_CACHED_DATA_LABEL`, `DELETE_CACHED_DATA_LABEL`, `CLEAR_DATA_LABEL`, `CLEARED_ACK_MESSAGE`. Every destructive confirm string lives in one file.

### State machine (Task 2)

- **`src/lib/worker-client.svelte.ts`** — added:
  - `'confirm-pending'` to `IngestViewState` (one new state, not three)
  - `PendingAction` discriminated union `{ kind: 'replace', file } | { kind: 'start-over' } | { kind: 'clear-data' }`
  - `pendingAction`, `#pendingReturnState`, `justCleared` reactive fields
  - Four public methods: `requestStartOver()`, `requestClearData()`, `confirmPending()`, `cancelPending()`
  - `submitFiles()` replace-guard replaced: drop on `'done'` stashes the file as a `'replace'` pendingAction (D-13) instead of being silently ignored (Phase 1 behavior)
  - `reset()` clears all three confirm-related fields
  - `'cleared'` `IngestResponse` handler transitions out of `'confirm-pending'` to `'idle'` with `justCleared = true`

### Component (Task 2)

- **`src/lib/components/ConfirmPanel.svelte`** — new shared destructive-confirm component:
  - `role="alertdialog"`, `aria-modal="true"`, `data-testid="confirm-panel"`
  - Caution/amber chrome (UI-SPEC Color table: `#f9ab00` border, `#fef7e0` background)
  - Neutral dismiss button (UI-SPEC destructive-trigger design rule: destructive color reserved for the COMMIT only)
  - Destructive red commit button (matches existing `FailureBanner` hex values)
  - All copy and labels passed via props — no inline strings

### UI wiring (Task 3)

- **`src/App.svelte`** — added:
  - `ConfirmPanel` overlay rendered when `state === 'confirm-pending'`, copy/labels selected by `pendingAction.kind` (the `'start-over'` and `'clear-data'` kinds share the EXACT same copy pair per D-22)
  - Persistent "Clear my cached data" bar rendered outside the state branch, gated on `state in { 'done', 'duplicate' }` (D-17/D-18 visible, D-19 hidden otherwise)
  - One-shot "Cached data cleared" banner above the dropzone, gated on `state === 'idle' && justCleared` (D-20)
  - `onStartOver` and `onClearData` handlers route through `ingestClient.requestStartOver()` / `requestClearData()` — the buttons no longer call `reset()` directly
- **`src/lib/components/ResultsView.svelte`** — restyled `.start-over` from accent blue to neutral grey (D-15 + UI-SPEC destructive-trigger design rule: the button is no longer harmless)

### Tests

- **`tests/unit/db.test.ts`** — two new `clearData` tests (TDD RED→GREEN): transactional wipe leaves zero rows and no `'active'` meta record; calling when no dataset exists does not throw.
- **`tests/unit/ingest-client.test.ts`** — ten new tests covering: replace-on-drop transitions to `'confirm-pending'` without posting; `confirmPending()` replace flow posts the stashed file; `confirmPending()` start-over posts `'clear-data'` and waits for `'cleared'`; `confirmPending()` clear-data follows identical flow (D-22); `confirmPending()` outside confirm-pending is a no-op; `cancelPending()` after replace restores `'done'` with original result; `cancelPending()` after start-over restores `'done'`; `cancelPending()` outside confirm-pending is a no-op; `'cleared'` for non-pending state is ignored; subsequent `submitFiles()` clears `justCleared`. The pre-existing "drop ignored" test was rewritten to assert the new replace-confirm transition.
- **`tests/e2e/persistent-dataset.spec.ts`** — four new tests in a new `persistent-dataset destructive controls` describe block:
  - (d) D-13 replace-on-drop shows confirm panel with D-13 copy; canceling leaves old dataset untouched; confirming fully replaces
  - (e) D-15/D-16 Start Over requires confirmation; canceling leaves dataset; confirming wipes IndexedDB; reload confirms persistence-wipe, not view-only
  - (f) D-17/D-18/D-19 persistent Clear my cached data hidden with no cache, visible after import, follows identical confirm + wipe flow
  - (g) D-14 zero native browser dialogs across all three flows (registered `page.on('dialog', ...)` listener mirroring the import-flow (c) pattern)
- **`tests/e2e/import-flow.spec.ts`** — removed obsolete test (c) "start over is one click with no confirmation" (Phase 1 behavior superseded by D-15/D-16); the replacement test lives in persistent-dataset (e). Removed the now-unused `START_OVER_LABEL` import.

## Deviations from Plan

None — plan executed exactly as written. One environment-level note: the pre-existing `tests/unit/webserver-teardown.test.ts` is parallel-flaky (signal SIGKILL during started state when run in parallel with other tests); running it in isolation or with `--no-file-parallelism` passes cleanly. This predates this plan and was not introduced by these changes.

## Verification

- `pnpm exec vitest run` (non-parallel): 11 files, 202 tests, all passing (up from 192 in 02-02)
- `pnpm run lint`: prettier + eslint clean
- `pnpm run check`: svelte-check + tsc clean (226 files app, 323 files test, 0 errors / 0 warnings)
- `pnpm run build`: production build succeeds; `dist/assets/ingest.worker-yPJn4feG.js` 127 KB, `dist/assets/index-BapSVMf6.css` 5.5 KB, `dist/assets/index-BcQHnMq_.js` 48 KB
- E2E tests (Playwright) were NOT executed in this worker's environment — the orchestrator runs the cross-phase e2e gate after merging this branch back to `gsd/phase-02-defensive-parsing-persistent-dataset`

## Self-Check

- [x] All three tasks committed individually (`bb2abbe`, `57d69ff`, `afb4aeb`)
- [x] `clearData` unit tests exist and pass
- [x] ConfirmPanel state-machine unit tests exist and pass (10 new)
- [x] Persistent-dataset destructive-controls e2e tests exist (4 new)
- [x] obsolete import-flow (c) test removed; `START_OVER_LABEL` import removed from import-flow.spec.ts
- [x] No `STATE.md` / `ROADMAP.md` modifications (orchestrator owns those)
- [x] Threat surface unchanged from plan (T-02-03 closed by `clearData()` + persistent control; T-02-07/T-02-08 accepted per plan)