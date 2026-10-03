---
phase: 05-vehicle-stats-financial-dashboards
plan: 07
subsystem: infra
tags: [web-worker, dexie, indexeddb, message-contract, svelte-runes, vitest]

# Dependency graph
requires:
  - phase: 04-activity-time-dashboards
    provides: "PlaytimeClient (own id namespace, three settlements, failPending), the #handle delegation seam, and the importedAt-pairing rule reused here per channel"
  - phase: 05-04
    provides: "buildVehicleView, VehicleFiles, VEHICLE_FILE_NAMES and the seen/rows presence split"
  - phase: 05-05
    provides: "buildPremium, buildCurrency, buildSpend and their four-shape view types"
  - phase: 05-03
    provides: "Financial_data as a supported category and the real-shaped fixtures this plan queries"
provides:
  - "data-query / data-result / data-error carrying all four channels, plus DataChannel, DataQuery and DataResult"
  - "QueryClient: a rune-free, channel-scoped query client that supersedes only its own channel"
  - "IngestClient.data, its delegation branch and both failPending wirings"
  - "readRowsByFile: one read transaction over rows and meta, index-only key walk, lower-cased name and category matching"
  - "meta.files: per-file presence facts recorded at import, capped at 500, no Dexie version bump"
  - "isDataQuery, a strict pure validator, and a bounded sixteen-entry memo keyed by the snapshot's importedAt"
affects: [05-10, 05-11, 05-12, 05-13, 05-14, 05-15, 05-16, 05-08]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 26539
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A generic channel-scoped QueryClient beside the untouched PlaytimeClient: supersede narrows to the channel, the id counter stays shared"
    - "One snapshot reader per query family, answering with the importedAt read inside the same read transaction as its rows"
    - "Per-file presence facts recorded at import, so an absent file and a header-only file are different sentences"
    - "Strict pure validation at the postMessage boundary; rejection is a fixed-detail answer, never a coerced query"
    - "Bounded memo keyed by channel plus canonical query JSON, storing the snapshot importedAt with every entry"

key-files:
  created:
    - src/lib/query-client.ts
    - src/lib/worker/data-queries.ts
    - tests/unit/query-client.test.ts
    - tests/unit/db-rows-by-file.test.ts
    - tests/unit/data-query-worker.test.ts
  modified:
    - src/lib/types/worker-messages.ts
    - src/lib/worker/db.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/worker-client.svelte.ts

key-decisions:
  - "Supersede is per channel but the query id counter stays shared, so a reply is routed by id alone and three blocks mounting in one tick all settle with a result rather than starving each other"
  - "PlaytimeClient is left byte-identical: its global supersede is correct for its single selector and existing tests assert it"
  - "meta.files is a non-indexed field of the existing record, so no Dexie version bump and no migration; the version(2) upgrader is untouched"
  - "Presence facts are collected BEFORE each file's row loop, because a header-only file parses to zero rows and a fact set inside the loop would never be recorded for exactly the file it exists to prove"
  - "A reply whose channel is not the one asked for settles as a fixed channel mismatch rather than being applied"
  - "Worker error details are the error NAME only, never its message, because a builder message can echo a cell"
  - "The validator rejects a title or battleType smuggled into a finance channel rather than ignoring it, so a future field cannot start being trusted by accident"
  - "The memo is consulted against the current meta's importedAt, so correctness rests on that equality check and not on the clears; the clears keep the bound meaningful"

patterns-established:
  - "Snapshot pairing: read meta.importedAt and the rows in ONE read transaction, and answer with THAT string, so a replace can never produce old numbers under a new date"
  - "Index-only distinct-key walk plus one single-key read per matching file; the form taking a list of keys measured 2,243 ms on 3,000 rows in Phase 4 and is never used"
  - "Lower-cased exact file-name table, then a lower-cased category compare, because a folder spelled player_statistics classifies as the same supported category"
  - "A builder's throw is one block's error and never the import's: its own try/catch, the error object to the console, name-only detail out"
  - "Legacy-cache asymmetry stated in the type: a null files list is 'pre-05-07', not 'nothing was present', and the answer falls back to the sentence true of both cases"

requirements-completed: [STATS-01, FINANCE-01, FINANCE-02, FINANCE-03]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "A posted premium data-query travels through the real worker and one Dexie snapshot to a data-result carrying the hand-derived buildPremium view and the done result's importedAt"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/data-query-worker.test.ts#05-07 tracer: premium through the real worker and Dexie snapshot"
        status: pass
    human_judgment: false
  - id: D2
    description: "An absent premium folder answers not-in-export and a header-only premium file answers no-rows, told apart by presence facts recorded at import"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/data-query-worker.test.ts#tells an absent premium folder from a header-only premium file"
        status: pass
    human_judgment: false
  - id: D3
    description: "The stored meta record carries one presence entry per Player_statistics, Financial_data and Payment_history file, capped, and none from another category"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/data-query-worker.test.ts#records one presence entry per file of the three categories and none from another"
        status: pass
    human_judgment: false
  - id: D4
    description: "readRowsByFile returns only requested names and categories, case-insensitively, in stored order, with the snapshot importedAt and files list, and null with no dataset, inside a 1,000 ms ceiling on 3,000 rows over twelve files"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/db-rows-by-file.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Four channels querying in the same tick all settle with their own result, and a second query supersedes only its own channel"
    requirement: STATS-01
    verification:
      - kind: unit
        ref: "tests/unit/query-client.test.ts#four channels asking in the same tick"
        status: pass
    human_judgment: false
  - id: D6
    description: "QueryClient never rejects: an unavailable worker, a throwing post, a channel mismatch and failPending all resolve with a fixed detail, and the module is rune-free and Svelte-free"
    requirement: STATS-01
    verification:
      - kind: unit
        ref: "tests/unit/query-client.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "IngestClient exposes data, delegates data-result and data-error before every state-machine branch, and releases pending data queries with fixed details on both worker error events"
    requirement: STATS-01
    verification:
      - kind: unit
        ref: "tests/unit/query-client.test.ts#IngestClient exposes and delegates the data channel"
        status: pass
    human_judgment: false
  - id: D8
    description: "The currency, spend and vehicles channels equal the pure builders over rows parsed from the same fixture text, for each title, a battle type and a null default title"
    requirement: FINANCE-03
    verification:
      - kind: unit
        ref: "tests/unit/data-query-worker.test.ts#05-07: the currency, spend and vehicles channels"
        status: pass
    human_judgment: false
  - id: D9
    description: "Every malformed data-query shape is rejected with the fixed detail invalid query and never reaches a builder, and a 64-character battleType is the inclusive boundary"
    requirement: STATS-01
    verification:
      - kind: unit
        ref: "tests/unit/data-query-worker.test.ts#05-07: query validation"
        status: pass
    human_judgment: false
  - id: D10
    description: "A builder forced to throw yields data-error with the error name only, the message text appears in no posted message, the import is unaffected and a following query still works"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/data-query-worker.test.ts#05-07: a builder that throws"
        status: pass
    human_judgment: false
  - id: D11
    description: "No reply across all four channels, every title and a battle type contains the account-name, order-id, coupon, aggregator or package canary"
    requirement: FINANCE-03
    verification:
      - kind: unit
        ref: "tests/unit/data-query-worker.test.ts#05-07: no personal field reaches any reply"
        status: pass
    human_judgment: false
  - id: D12
    description: "A replaced dataset answers the new numbers and the new importedAt, a clear answers importedAt null, identical queries leave one memo entry, twenty distinct queries leave at most sixteen, and an ingest or clear brings the size to zero"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/data-query-worker.test.ts#05-07: replace, clear and the memo"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-10-01
status: complete
---

# Phase 05 Plan 07: Vehicle Stats & Financial Dashboards — data path

**One typed data-query contract carrying four channels, answered on demand from a single Dexie snapshot, with file presence recorded at import and a channel-scoped client so four blocks can ask at once without starving each other.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-01T18:22:20Z
- **Completed:** 2026-10-01T18:40:19Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- The four pure builders from 05-04 and 05-05 are wired to the page's data path: a posted `data-query` reaches the real worker, which answers from one read transaction and hands each channel's rows to its own builder. The main thread never scans a row and the worker stays the only Dexie owner.
- File presence is now a stored fact. `meta.files` records category, name and row count per file at import, so D-02's "not in this export" and D-05's "no rows" are different sentences — a distinction the rows table cannot make, because a header-only file leaves no row behind. No Dexie version bump was needed and the `version(2)` upgrader is byte-identical.
- Several blocks can now ask at once. `QueryClient` scopes supersede to a channel while keeping the id counter shared, so the three-block starvation RESEARCH Pitfall 1 describes cannot happen; `PlaytimeClient` is untouched because its global rule is correct for its one caller.
- Worker input is validated at the `postMessage` boundary, a builder's throw is contained to its own block with a name-only error detail, and a canary scan proves no personal column reaches any reply.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer, a premium query travels from a posted data-query through the real worker and Dexie snapshot to a data-result** - `31f57a0` (feat)
2. **Task 2: The channel-scoped QueryClient and its IngestClient wiring** - `46f090a` (feat)
3. **Task 3: All four channels through the real worker, the memo, query validation, error detail and the privacy canaries** - `a9f8e97` (feat)

TDD held throughout: each task recorded a RED before its GREEN. Task 1 RED was 4 failed / 4 (the worker ignored an unknown request and meta had no files list), Task 2 RED was the module not existing, Task 3 RED was 7 failed / 21 (the validator accepted malformed input, the memo did not exist, the error detail carried the message).

**Tracer feedback gate:** Task 1 is a tracer, and auto mode is off with the verify carrying only `<automated>`, so its `<verify>` was re-run after the commit and passed. Expanded without a checkpoint, as the gate directs.

## Files Created/Modified

- `src/lib/query-client.ts` (new) - the channel-scoped generic query client, rune-free and Svelte-free, with the three settlements, per-channel supersede, both fast-fail paths and `failPending`
- `src/lib/worker/data-queries.ts` (new) - `DATA_FILES` per channel, `isDataQuery`, `answerDataQuery`, and the bounded memo with `clearDataQueryMemo` / `dataQueryMemoSize`
- `src/lib/types/worker-messages.ts` - `DataChannel`, `DataQuery`, `DataResult` and the `data-query` / `data-result` / `data-error` variants; every playtime variant unchanged
- `src/lib/worker/db.ts` - `DatasetFile`, the optional non-indexed `meta.files`, `MAX_PRESENCE_FILES`, a seventh optional `writeDataset` parameter, and `readRowsByFile`
- `src/lib/worker/ingest.worker.ts` - presence collection in the parse loop, the `data-query` dispatch branch, `handleDataQuery` with validation and memo, and the two memo clears
- `src/lib/worker-client.svelte.ts` - `IngestClient.data`, the delegation branch and the two `data.failPending` calls
- `tests/unit/data-query-worker.test.ts` (new) - the tracer plus Task 3's channels, legacy cache, validation, thrown builder, canary scan and memo
- `tests/unit/db-rows-by-file.test.ts` (new) - the reader's matching, ordering, legacy null and the 3,000-row ceiling
- `tests/unit/query-client.test.ts` (new) - the client seam and the `IngestClient` delegation, including a source-level rune/import check

## Decisions Made

- **Per-channel supersede, shared id counter.** A block asking again releases only its own older question, but ids stay global so a reply routes by id alone. The alternative — one client instance per channel — was rejected in the research because each would start its id at 1 and `#handle` routes by message type to a single client.
- **A null `files` list means "pre-05-07", not "nothing was present".** The type says so explicitly and the fallback is the sentence true of both cases ("no rows"), matching the asymmetry Phase 4 made explicit for sessions.
- **Presence facts collected before the row loop.** The session flag sets its precedent: a header-only file parses to zero rows, so a fact set inside the loop would never be recorded for the one file whose presence it exists to prove.
- **The validator rejects rather than coerces, including stray fields.** A `title` smuggled into a finance channel is a rejection, not an ignored key, so a future field cannot start being trusted by accident.
- **Memo correctness rests on the importedAt equality check, not on the clears.** The clears are still done on every ingest and clear, but they keep the bound meaningful rather than being load-bearing for safety.

## Deviations from Plan

None - plan executed exactly as written. The nine files changed across the three commits are exactly the plan's nine declared `files_modified`, with nothing outside that scope.

## Issues Encountered

- **A test helper could not see its own subject.** The first `ask` helper waited specifically for a `data-result`, so the thrown-builder test — whose subject is the `data-error` — timed out instead of asserting, and the timeout skipped the `doUnmock` and poisoned five later tests in the same file. Fixed by adding `askEither`, which polls for either reply, and by moving the `vi.doUnmock` into a `finally` so a failing assertion cannot leak the mock forward. This was a test-harness defect, not a product one.
- **A memo-clear assertion contradicted the dedup gate.** The "a successful ingest empties the memo" case re-ingested a byte-identical archive, which the worker correctly answered `duplicate` without ever reaching the write, so the clear never ran and the memo legitimately stayed populated. Fixed by ingesting genuinely different bytes and asserting the reply is `done` — the original expectation was the wrong one, and the product behaviour was right.
- **One vitest pool SIGKILL on `webserver-teardown.test.ts`** during a full-suite run. Re-running gave 35/35 files and 1049/1049 tests, and every later full-suite run was clean, so this was infrastructure rather than a change in the code.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 05-10 to 05-15 can each render one block by calling `IngestClient.data.query({ channel })` and dropping a reply whose `importedAt` is not the one on screen. No component work is blocked on this plan.
- The client never rejects and every failure is a renderable state, so a block needs three cases only: result, error, superseded.
- The documented fallback is still available and unplanned: if plan 05-16's 50,000-row browser budget fails, stored aggregates on the meta record (the Phase 4 pattern) is the next step. This plan stores no aggregate, only presence facts and a bounded in-worker memo.
- The `meta.files` cap of 500 is a degradation boundary, not a silent truncation to watch for: a file past the cap still answers from its rows, only its absence claim is lost.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Completed: 2026-10-01*
