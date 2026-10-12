---
phase: 261012-bog-add-device-info-supported-category-pane
plan: 261012-bog
subsystem: worker, ui
tags: [device-info, import-strip, privacy, master-detail, data-query-channel, e2e]
requires: [phase-05 finance state functions, phase-08 master-detail shell]
provides:
  - Device_info as a SUPPORTED category on import and on cache replay
  - import-time reduction of the Assistant POST blob to four fields (or an unreadable marker)
  - a device-info data-query channel answered by a pure builder
  - the Device info pane (counts summary and three per-source tables)
affects: [categories, ingest worker, data-queries, dashboard-status, selection-state, overview-model, ui-copy, sample export fixtures, e2e enumerations]
tech-stack:
  added: []
  patterns: [import-choke-point reduction keyed on folder and header, canary tests across stored rows / posted view / DOM, source-contract component tests]
key-files:
  created:
    - src/lib/features/device-info/device-info-shared.ts
    - src/lib/features/device-info/device-info-aggregate.ts
    - src/lib/features/device-info/device-info-state.ts
    - src/lib/features/device-info/DeviceInfo.svelte
    - src/lib/features/device-info/DeviceTable.svelte
    - tests/fixtures/device-info-fixtures.ts
    - tests/unit/device-info/device-info-aggregate.test.ts
    - tests/unit/device-info/device-info-state.test.ts
    - tests/unit/device-info/device-info-blocks.test.ts
    - tests/unit/import/device-info-worker.test.ts
    - tests/e2e/shell/device-info.spec.ts
  modified:
    - src/lib/worker/categories.ts
    - src/lib/worker/data-queries.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/core/types/worker-messages.ts
    - src/lib/shell/dashboard-status.ts
    - src/lib/shell/selection-state.ts
    - src/lib/shell/overview-model.ts
    - src/lib/shell/Dashboard.svelte
    - src/lib/ui-copy.ts
    - tests/fixtures/export-fixtures.ts
    - tests/fixtures/README.md
    - tests/helpers/components.ts
    - .planning/PROJECT.md
    - AGENTS.md
key-decisions:
  - "Planner decisions PD-01 to PD-12 were all built as written; the one refinement is PD-08 (see Deviations 2)"
  - "The Assistant blob is reduced at the row choke point; stored shapes are new-readable, new-unreadable marker and legacy-raw"
  - "No Dexie version bump: a stale cache is repaired at read time and a legacy POST row is re-read through the same extractor"
requirements-completed: []
duration: ~30 min (approximate, no start time was recorded)
completed: 2026-10-12
status: complete
commits: 5
plan_head_before: 4be75ddf8787beedfdcb82947e12cfd8ff78c835
plan_head_after: 6522b3d44dcf02f2a3ae30779c92798e1adf12ee
actuals:
  tokens: 36600
  tasks: 3
  commits: 5
---

# Quick 261012-bog: Device_info supported category and Device info pane Summary

`Device_info` is now a supported category with a read-only Device info pane (a list row, an Overview card and a detail with a counts summary over PC hardware, Blitz devices and Assistant app devices tables), and the Assistant file's account-id-bearing `POST` blob is reduced to four allow-listed fields at the import row choke point so it is never stored, posted or drawn.

## Commits

| Commit | Message |
| ------ | ------- |
| b21de95 | feat(quick-261012-bog): support Device_info, reduce the Assistant blob at import and answer a device-info query |
| 264d202 | feat(quick-261012-bog): add the Device info pane to the master-detail shell |
| 553b93b | feat(quick-261012-bog): cover Device info in the e2e enumerations and update the docs |
| 4f23127 | chore(quick-261012-bog): refresh graphify output after the Device info change |
| 6522b3d | fix(quick-261012-bog): show the blob-specific unreadable reason for the Assistant source only |

`actuals.tokens` is chars/4 over the added lines of the source, test and doc files only (146,363 characters); `graphify-out` is excluded because its roughly 68k-line regenerated diff would make the number meaningless. `commits: 5` is measured from the plan ledger at SUMMARY time; the docs commit that carries this file comes after.

## Gate results (as they actually ran)

| Gate | Result |
| ---- | ------ |
| `pnpm exec prettier --check src tests` and `pnpm run lint` (prettier --check . and eslint .) | clean |
| `pnpm run check` (tsc -b and svelte-check) | 311 files, 0 errors, 0 warnings |
| `pnpm run test:unit` | **exit non-zero**: 2826 passed, 1 failed, plus 1 suite that fails to load (see below) |
| `pnpm exec playwright test --workers=2`, run 1 | 255 passed, **1 failed**: `shell/chart-fill.spec.ts:122` "finance charts fill the detail pane", `finance-tooltip right 367.2 > edge 359.0` at 375px |
| same spec, isolated, twice | 2 passed both times (4.5 s) |
| `pnpm exec playwright test --workers=2`, run 2 | 256 passed (2.6 min) |
| `pnpm exec playwright test tests/e2e/shell/device-info.spec.ts` after the fix commit | 2 passed; the full suite was NOT re-run after the fix commit (it only changes the no-usable rendering of a PC or Blitz table, which no e2e test reaches) |
| `pnpm exec playwright test --list` | 256 tests in 27 files (ceiling 258) |
| `git diff --stat 4be75dd HEAD -- package.json pnpm-lock.yaml src/lib/worker/db.ts` | prints nothing |
| `grep -c '^import' src/lib/features/device-info/device-info-shared.ts` | 0 |
| Manual privacy spot check (DevTools IndexedDB, Network) and manual 1280/375 visual check from the plan's verification list | NOT RUN by hand; covered by automation instead: the unit canary tests read every stored row from Dexie, the e2e spec sweeps the page text and every attribute, and `mobile-sweep.spec.ts` measures the pane at 375px |

The two unit failures are **pre-existing** and unrelated: `tests/unit/charts/contrast.test.ts` fails to load (ENOENT on `.planning/phases/04-activity-time-dashboards/04-UI-SPEC.md`) and `tests/unit/geo/source-decision.test.ts` fails one test (ENOENT on `.planning/REQUIREMENTS.md`). Both files were archived or removed by the v1.0 milestone commits. They failed identically in a baseline run at 4be75dd before any edit of this task, and are logged in `261012-bog-deferred-items.md`. Because of them, the Task 3 `<verify>` chain, which joins its steps with `&&`, would stop at `test:unit`; the steps after it were run individually.

The intermittent Playwright failure was seen once, under two-worker load, in a finance chart at phone width that this task does not touch; it did not reproduce in two isolated runs or in the second full run.

## Planner decisions, as built

| ID | Result |
| -- | ------ |
| PD-01 | Built. `device-info` is the fifth file channel; the view is built in `answerDataQuery` from stored rows. No aggregate on the meta record, Dexie version still 2 (`db.test.ts` pins both and passes). |
| PD-02 | Built. In the row loop, a Device_info-family row with a `POST` header is replaced by `reduceBlobRow(raw)` before the User_Info strip in the same expression. |
| PD-03 | Built. `buildDeviceInfo` runs the same extractor over a row that still holds `POST`; tested on a hand-rewritten legacy snapshot (no presence list, raw POST rows). |
| PD-04 | Built. `sampleEntries()` carries the three real-named files; `SAMPLE_FILE_COUNTS` and `SAMPLE_ROW_COUNTS` derive Device_info from `DEVICE_INFO_COUNTS`. `Devices.csv`, `DEVICES_HEADER` and `DEVICES_ROW` remain only in `SCALE_ROW_TEMPLATES`. |
| PD-05 | Built. `device-info` sits after `payments` and before `account`; seven Overview cards. |
| PD-06 | Built. null for absent, blank or `N/D` in any case; clamped to 200 characters; rendered as the muted word "not reported". |
| PD-07 | Built. All-digit cell of at most nine digits is a number of MB; `formatMemoryFromMb` goes through `formatNumber`. 3000 MB reads `2.9 GB`, 4096 reads `4 GB`, 1023 reads `1,023 MB`. |
| PD-08 | Built, with one refinement. A PC or Blitz file with no resolvable column is `no-usable` and its `unreadable` equals its row count (as the plan's last sentence says). The blob-specific explanation ("held no device type, app, platform or version...") was initially shown under the PC heading too; commit 6522b3d now shows it for the Assistant source only. |
| PD-09 | Built. 200 rows per table with `more`, 200-character clamp pinned equal to `MAX_STORED_STRING` by a test, 8,192-character blob bound checked before any parse. |
| PD-10 | Built. The ten PC, eight Blitz and four Assistant columns, file order kept, no de-duplication. |
| PD-11 | Built. Two new tests in one new spec file, none added to `master-detail-nav.spec.ts`; the listed total went 254 to 256. |
| PD-12 | Built. `DeviceInfo.svelte` was added to the three existing status-colour entries of the allow-list; no new literal or token. |

## The three stored Assistant row shapes

1. **new-readable**: an object with only the non-null keys among `DEVICE_TYPE`, `APP`, `PLATFORM`, `VERSION`.
2. **new-unreadable marker**: `{ ROW_STATE: 'unreadable' }`.
3. **legacy-raw**: a row from a cache written before this change, still holding the raw `POST` cell. It is never rewritten; the builder re-reads it through `extractAssistantFields` and only the four fields reach the view.

## Accepted legacy residual (T-bog-02)

A cache written before this change keeps the raw blob at rest in IndexedDB until the user imports again or clears the cache. Reasons it was accepted, from the plan: the account id is already in `meta.accountRoot` and in the sanitised User_Info rows, and a version bump would cost every returning user the cached dataset. The blob is not exposed on screen on that path (tested). T-bog-07 (a copy of the file misfiled outside Device_info keeps its cells at rest, never reaching a view) is accepted as the plan states.

## Changed expectations, by file

Unit (each corrected to the new truth, none loosened):
- `tests/fixtures/export-fixtures.ts`: `SAMPLE_EXPECTED_COUNTS` 6/2/1, `RENAMED_EXPECTED_COUNTS` 6/2/2, `SAMPLE_BADGE_ORDER` moves Device_info to second, `buildOnlySupportedExport` no longer omits Device_info, counts and doc comments derived or reworded.
- `tests/unit/import/replay-reclassify.test.ts`: `REPAIRED_ORDER`, counts 6/2/1, Device_info now `supported` in the byName block, sort examples keep Device_info in the supported group, lockstep file name; one new test seeds a stale Device_info as unknown.
- `tests/unit/import/ingest-worker.test.ts`: supported-only export counts 6.
- `tests/unit/import/data-query-worker.test.ts`: the presence-list test allows Device_info and asserts it is present; `viewOf` return type widened.
- `tests/unit/import/classify.test.ts`: four new Device_info classification tests.
- `tests/unit/guards/sample-export-shape.test.ts`: `Device_info/Devices.csv` dropped from the CRLF control list; four new tests (exact three files, physical shape, LF inside Assistant cells, canaries confined to their own file).
- `tests/unit/guards/phase8-ui-review-guards.test.ts`: `DeviceInfo.svelte` in the three status-colour entries.
- `tests/unit/shell/selection-state.test.ts`, `dashboard-status.test.ts`, `overview-model.test.ts`, `ui-copy.test.ts`: nine panes, seven nav links and cards, `device-info` in the section order, `BUILT_DASHBOARDS`, new pinned copy.
- `tests/helpers/components.ts`: `features/device-info` added to `COMPONENT_DIRS`.

E2E (enumerations corrected, not loosened):
- `shell/dashboard.spec.ts`: `SUPPORTED_IDS`, `SECTIONS_BY_ID`, `DATA_PANES` gain device-info; `SAMPLE_UNSUPPORTED_ORDER` becomes Chat_history, Clans, Bans and every banner count derives from it (the case-variants export shows four, Device_info removed); eight rows become nine; sections-pending names five ready sections.
- `shell/master-detail-nav.spec.ts`: all row-count assertions 8 to 9, device-info in `folderOf` and `panes`; no test added (guard at 19).
- `shell/mobile-sweep.spec.ts` (edited in Task 2, see Deviations 1), `shell/touch-targets.spec.ts` (eight rows to nine), `import/import-flow.spec.ts` and `import/persistent-dataset.spec.ts` (data pane lists, `PANE_COUNT` 9, banner counts derived from the unsupported list).
- `shell/identity-privacy.spec.ts` derives its pane list from `PANE_IDS`, so it needed no change.

## Deviations from Plan

**1. [Rule 3 - Blocking] `tests/e2e/shell/mobile-sweep.spec.ts` edited in Task 2.** The plan said not to edit e2e specs until Task 3, but `PANE_EXPECTATIONS` there is a `Record<PaneId, ...>`, so adding the ninth pane id broke `tsc -b` inside `pnpm run check`, which Task 2's verify requires. One entry was added (commit 264d202).

**2. [Rule 1 - Bug] Blob-specific explanation under the PC heading.** A PC or Blitz table in the `no-usable` state rendered the unreadable notice with the Assistant-specific reason. Fixed in 6522b3d (the notice is now Assistant-only; the contract test pins it). The view's `unreadable` for those two sources still equals their row count, per PD-08's last sentence; the requester may prefer 0 there.

**3. Partial RED evidence for Task 2.** Observed red before source edits: the shell-list tests (five failures in `tests/unit/shell`). Not observed red: the new `ui-copy` pinned-copy block and `device-info-state.test.ts` (written in the same step as their implementation with no test run in between) and `device-info-blocks.test.ts` (written after both components existed). Task 1's RED was observed and was the stated one (module not found; Device_info still classified `unknown`).

**4. Extra commit.** `4f23127` refreshes the tracked `graphify-out/` output after the code change (the optional hygiene step in the plan, because `graphify-out` is tracked). The plan implied three commits; this is a fourth, plus the fix commit (deviation 2).

**5. E2E files outside the plan's `files_modified`.** `touch-targets.spec.ts`, `import-flow.spec.ts` and `persistent-dataset.spec.ts` also hardcoded eight panes or four unsupported folders; the plan's Step A (find every enumeration) covers them.

**6. A silently missed edit, caught by the tests.** The first scripted edit of the row choke point in `ingest.worker.ts` did not match and was not noticed until the canary test failed on a stored `POST` key; it was then applied directly (before commit b21de95). The other scripted replacements were verified by grep and by the tests.

**7. STATE.md had no "Quick Tasks Completed" section** (the v1.0 close-out reset it), so it was created after Blockers/Concerns with the canonical non-validate columns.

## Auth gates

None.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, network API, auth path or schema change; neither `package.json` nor the lockfile changed, and `db.ts` is untouched.

## Real export data

The real export under `/Users/you/Downloads/export` was never read, copied or referenced. Every fixture value is `Synth`-prefixed or an unmistakable synthetic number; the two canaries are fabricated strings.

## Self-Check: PASSED

- Created files exist: all eleven files listed under `key-files.created` were confirmed present.
- Commits b21de95, 264d202, 553b93b, 4f23127 and 6522b3d are ancestors of HEAD.
