---
phase: 02-defensive-parsing-persistent-dataset
plan: 01
subsystem: ingest
tags: [dexie, papaparse, hash, mojibake, csv-parse, defensive-parsing, persistent-dataset, worker]
dependency_graph:
  requires: [phase-01-ingest-foundation]
  provides: [parse-every-category, mojibake-fix, hash-dedup, dexie-persistence, row-count-badges]
  affects: [ingest-pipeline, results-view, worker-message-contract]
tech-stack:
  added:
    - papaparse ^5.7.0
    - dexie ^4.4.6
    - '@types/papaparse ^5.5.2'
    - fake-indexeddb ^6.2.5
  patterns:
    - sole-owner-dexie-in-worker
    - round-trip-or-reject-mojibake-fix
    - chunked-bulkPut-in-transaction
    - hash-before-unzip-dedup
key-files:
  created:
    - src/lib/worker/hash.ts
    - src/lib/worker/mojibake.ts
    - src/lib/worker/csv-parse.ts
    - src/lib/worker/db.ts
    - tests/unit/hash.test.ts
    - tests/unit/mojibake.test.ts
    - tests/unit/csv-parse.test.ts
    - tests/unit/db.test.ts
    - tests/unit/ingest-worker.test.ts
  modified:
    - src/lib/worker/classify.ts
    - src/lib/types/worker-messages.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/worker-client.svelte.ts
    - src/lib/ingest-client.ts
    - src/lib/ui-copy.ts
    - src/lib/components/CategoryBadge.svelte
    - tests/fixtures/export-fixtures.ts
    - tests/unit/classify.test.ts
    - tests/e2e/import-flow.spec.ts
decisions:
  - "D-01: every detected category (supported, known-deferred, unknown) gets full CSV parsing into IndexedDB"
  - "D-02: generic header-keyed (untyped) row shape — no typed columns per known CSV"
  - "D-03: PapaParse 'Quotes'-type errors skip a single row; ragged columns are non-fatal"
  - "D-05: badges display both file count AND row count (', ' separator, both always present)"
  - "D-06: no size/row cap; navigator.storage.persist() called from main thread; quota failures route through existing generic failure banner"
  - "D-11: per-category parsing progress posts during import"
  - "D-12: hash-identical re-import posts 'duplicate' response (without unzip or parse work) and worker-client transitions to 'duplicate' state"
  - "SC3: hash check happens BEFORE listEntryPaths/unzipSync — duplicate is detected and reported before any zip work"
  - "Worker-owns-Dexie sole-owner pattern: db.ts is imported only by ingest.worker.ts; main-thread reads/deletes go through new worker message types (check-cache, clear-data) — landing in 02-02/02-03"
metrics:
  duration: ~45min
  completed_date: 2026-09-28
  tokens: 18596
  tasks: 3
  commits: 3
  plan_head_before: 200dcbe6e3f81d673eb05794b812a7a498a91ff9
status: complete
actuals:
  tokens: 18596
  tasks: 3
  commits: 3
---

# Phase 2 Plan 1: Defensive Parsing & Persistent Dataset — Summary

The Phase 1 path-only worker is now a defensive CSV-parsing, mojibake-correcting, IndexedDB-persisting pipeline. Every detected category folder (supported, known-deferred, and unknown alike, D-01) is fully unzipped and parsed inside the ingest worker, with mojibake fields corrected (IMPORT-04) and the result written to a single active Dexie dataset in one transaction (DATA-01). A SHA-256 hash computed from the raw zip bytes, before any unzip work, detects an identical re-upload and skips it (IMPORT-06 / SC3 / D-12).

## What was built

- **Hash-before-unzip dedup (SC3)**: `crypto.subtle.digest('SHA-256', bytes)` runs immediately after `file.arrayBuffer()`, before `listEntryPaths` is ever called. On a hash match against the cached 'active' meta record, the worker posts `'duplicate'` and returns — no unzip, no parse, no Dexie write.
- **Defensive CSV parse (D-03)**: `Papa.parse(text, { header: true, skipEmptyLines: true, worker: false })` with `fixMojibake` applied to every string value. Ragged columns are non-fatal (the row stays in the result). Only `'Quotes'`-type errors at a specific row index trigger a per-row skip, counted into `skippedCount` and logged with the same `[bracket-tag] short-message, detail` shape the existing catch uses.
- **Mojibake fix (IMPORT-04)**: round-trip-or-reject via `TextDecoder('utf-8', { fatal: true })` over a Latin-1 reinterpretation. Safe to run on every field — any code unit > 0xff short-circuits, so already-correct Cyrillic / empty / pure-ASCII text is returned byte-for-byte unchanged.
- **Single-owner Dexie (DATA-01)**: `AppDb` with `rows` (generic header-keyed) and `meta` (single `'active'` record) tables. `writeDataset(hash, accountRoot, categories, rows)` wraps `clear → bulkPut chunks → meta.put` in one transaction (RESEARCH Pattern 3). `db.ts` is imported ONLY by `ingest.worker.ts`; main-thread reads/deletes will route through the new `'check-cache'` / `'clear-data'` request types in 02-02 / 02-03.
- **Per-category parse progress (D-11)**: between every category, the worker posts `{ type: 'stage', stage: 'parsing', progress: { category, categoryIndex, categoryTotal } }`. The dropzone's status text is driven by the new `formatParsingProgress` helper.
- **Row counts on every badge (D-05)**: `CategoryBadge.svelte` now renders `"${formatFileCount(fileCount)}, ${formatRowCount(rowCount)}"` — comma-joined inside the existing em-dash layout. `formatRowCount` uses locale-aware thousands separators matching the CONTEXT.md "1,204 rows" example.
- **Duplicate-drop state (D-12)**: `IngestViewState` gains `'duplicate'`. The `'duplicate'` `#handle` branch mirrors the `'done'` branch (state guard, jobId guard, settle-floor via `#scheduleSettle`) so the existing `ResultsView` can render underneath the `"This export is already loaded — skipping re-import"` banner without any new component.
- **Best-effort persistent storage (D-06)**: `void navigator.storage?.persist?.();` at module scope in `ingest-client.ts`. This is the one main-thread-only IndexedDB-adjacent call (the API is `[Exposed=Window]` per WebIDL and cannot run in the worker). Failure is silent; quota errors fall through the existing single worker-error path.
- **Extended message contract**: `IngestStage` adds `'hashing' | 'parsing' | 'writing'`; new `ParsingProgress`; `CategoryEntry` gains `rowCount` / `skippedRowCount` (optional — `analyzeExport` does not parse); `ClassifyResult` gains `importedAt` (optional); `IngestRequest` is a union adding `'check-cache' | 'clear-data'`; `IngestResponse` is a union adding `'duplicate' | 'cache-status' | 'cleared'`. Behavior for the new request types is a no-op in this plan; their wire shape is declared so 02-02 and 02-03 can land their behavior without re-touching the contract.

## Test results

- **180 / 180 unit tests pass** (`pnpm run test:unit`) — 11 test files, including 5 new files for this plan (`hash.test.ts`, `mojibake.test.ts`, `csv-parse.test.ts`, `db.test.ts`, `ingest-worker.test.ts`).
- **10 / 10 e2e tests pass** (`pnpm exec playwright test tests/e2e/import-flow.spec.ts tests/e2e/zero-network.spec.ts`) — including the updated test (a) that asserts `"Activity_history — 2 files, 2 rows"` (D-05) and the unchanged zero-network guard (PLATFORM-02).
- **`pnpm run lint` passes** (prettier + eslint, no errors).
- **`pnpm run check` passes** (svelte-check × 2 + tsc, 0 errors / 0 warnings).
- **`pnpm run build` passes** (Vite production build, ~126 KB worker chunk).

## Deviations from plan

### Auto-fixed issues

**1. [Rule 1 — Test/Implementation mismatch] PapaParse drops missing trailing-column keys, not undefined**
- **Found during:** Task 3 GREEN — first run of `csv-parse.test.ts` after the test was written RED.
- **Issue:** The plan's research claimed PapaParse's `header: true` "represents missing trailing fields as `undefined`/`null` keys" and the plan's action block said to preserve them. Empirically, PapaParse 5.7.0's actual behavior is to **drop** the missing key from the row object entirely (the row stays in the result, but `row.C` is `undefined`-by-absence, not `undefined`-by-value).
- **Fix:** Updated `csv-parse.test.ts` to assert the row stays in the result and the surviving fields have correct values, without asserting anything about the missing key. The contract (D-03: never abort on ragged columns) is unchanged — both behaviors preserve the row.
- **Files modified:** `tests/unit/csv-parse.test.ts`
- **Commit:** e761cb2 (RED), reflowed by prettier in d10d751 (GREEN)

**2. [Rule 1 — TypeScript type narrowing] `crypto.subtle.digest` rejects `Uint8Array<ArrayBufferLike>`**
- **Found during:** Task 3 GREEN — `pnpm run check` reported a TS error.
- **Issue:** TypeScript 6's `Uint8Array` is generic over `ArrayBufferLike`, and the WebIDL `BufferSource` type requires `ArrayBuffer` (not `SharedArrayBuffer`). The diagnostic shows the union not narrowing correctly.
- **Fix:** Cast `bytes` to `BufferSource` at the call site in `digestFile`. The bytes are owned by the caller (they came from `file.arrayBuffer()`), so the cast is sound.
- **Files modified:** `src/lib/worker/hash.ts`
- **Commit:** d10d751

**3. [Rule 1 — TypeScript type narrowing] `File` constructor's `BlobPart` rejects `Uint8Array<ArrayBufferLike>`**
- **Found during:** Task 3 GREEN — `pnpm run check` on the test config.
- **Issue:** Same root cause as #2 — the `File` constructor's `BlobPart` type wants `ArrayBuffer`.
- **Fix:** Cast `bytes` to `BlobPart` in the test helper. The bytes are owned by the caller (synthetic fixture built in memory), so the cast is sound.
- **Files modified:** `tests/unit/ingest-worker.test.ts`
- **Commit:** d10d751

**4. [Rule 1 — TypeScript vitest mock type] `vi.fn()` not assignable to `WorkerScopeLike['postMessage']`**
- **Found during:** Task 3 GREEN — `pnpm run check` on the test config.
- **Issue:** Vitest's `vi.fn()` returns a `Mock<...>` type, not the function signature the `WorkerScopeLike` slot requires.
- **Fix:** Cast the `postMessage` slot at the test's `self` assignment (`postSpy as unknown as (message: IngestResponse) => void`). Keeps the test's call sites free of casts.
- **Files modified:** `tests/unit/ingest-worker.test.ts`
- **Commit:** d10d751

**5. [Rule 1 — Vitest test contract] e2e test (a) STAGE_PATTERN did not include the new 'hashing' stage**
- **Found during:** Task 3 GREEN — `pnpm exec playwright test` reported a regex mismatch.
- **Issue:** The Phase 1 test (a) snapshot-catches the busy-state processing text and matches it against `/^\s*(Unzipping|Classifying folders)\.\.\.\s*$/`. After the worker gained the `'hashing'` stage (which runs before `'unzipping'`), the snapshot caught `"Checking for a duplicate..."` and the regex failed.
- **Fix:** Extended `STAGE_PATTERN` to include all five stage strings (matching `STAGE_TEXT`'s full key set).
- **Files modified:** `tests/e2e/import-flow.spec.ts`
- **Commit:** d10d751

### Plan choices revisited

**6. [Plan refinement] `rowCount` / `skippedRowCount` / `importedAt` are optional on the type, not required**
- **Found during:** Task 3 GREEN — TypeScript type-checking the new `CategoryEntry` and `ClassifyResult` against the existing `classify.test.ts` and `ingest-client.test.ts`.
- **Issue:** The plan's text describes `rowCount: number` and `importedAt: string` as required fields. But `analyzeExport` itself does NOT parse — only the worker fills in the row counts and the timestamp. Marking them required would force `analyzeExport` to default them to `0` / `''`, AND it would force every existing test that uses `toEqual` on a `ClassifyResult` / `CategoryEntry` literal to add the new fields to its expected object.
- **Fix:** Marked the new fields as optional on the type with a doc comment explaining when they are present. The worker fills them in; pre-parse / synthetic `ClassifyResult` objects (e.g. inline literals in `ingest-client.test.ts` building failure fixtures) remain valid. The new tests that DO check the values use the specific values they expect.
- **Files modified:** `src/lib/types/worker-messages.ts`
- **Commit:** d10d751

## Known Stubs (intentional, to be resolved in later plans)

- **Worker 'check-cache' / 'clear-data' request handlers are no-ops** in `ingest.worker.ts` — the request types are accepted in the message contract but the worker simply `return`s without posting a response. Behavior lands in **02-02** (check-cache → return `cache-status` with the existing active dataset) and **02-03** (clear-data → `db.rows.clear() + db.meta.delete()` → post `cleared` ack). The wire shape is declared here so those plans don't have to re-touch the contract.

## Auth gates

None.

## Notes for the next plan (02-02)

- The `'check-cache'` request type is already accepted by the worker's `onmessage` switch. Implementing it is a one-message-type extension: receive `{ type: 'check-cache', jobId }`, await `checkCache()`, post `{ type: 'cache-status', jobId, cached: result }`. The `cache-status` response variant is already in the type union.
- The new `duplicate` / `'duplicate'` state in `IngestClient` is the template for the new `cache-status` handler — the same `if (state !== 'processing') return; if (msg.jobId !== this.#jobId) return; #scheduleSettle(...)` pattern, but transitioned to `'done'` (NOT a new state) so the existing `ResultsView` renders the auto-loaded cached dataset.
- The D-08 loading-spinner state (a brief spinner while `check-cache` resolves) is a separate UI-state concern that lives in `App.svelte`, not in the worker-client. The new state `'checking-cache'` on `IngestViewState` (mentioned in PATTERNS.md) is the right place for it.
