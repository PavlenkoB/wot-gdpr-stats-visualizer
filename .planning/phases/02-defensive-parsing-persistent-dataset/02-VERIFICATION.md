---
phase: 02-defensive-parsing-persistent-dataset
verified: 2026-09-29T06:23:38Z
status: passed
score: 26/26 plan-02 must-haves verified · 4/4 ROADMAP success criteria met · 6/6 requirement IDs satisfied (IMPORT-01, IMPORT-03, IMPORT-04, IMPORT-06, DATA-01, DATA-02)
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/02-defensive-parsing-persistent-dataset/02-01-PLAN.md
  - .planning/phases/02-defensive-parsing-persistent-dataset/02-01-SUMMARY.md
  - .planning/phases/02-defensive-parsing-persistent-dataset/02-02-PLAN.md
  - .planning/phases/02-defensive-parsing-persistent-dataset/02-02-SUMMARY.md
  - .planning/phases/02-defensive-parsing-persistent-dataset/02-03-PLAN.md
  - .planning/phases/02-defensive-parsing-persistent-dataset/02-03-SUMMARY.md
  - .planning/phases/02-defensive-parsing-persistent-dataset/02-04-PLAN.md
  - .planning/phases/02-defensive-parsing-persistent-dataset/02-04-SUMMARY.md
  - src/App.svelte
  - src/lib/components/CategoryBadge.svelte
  - src/lib/components/ConfirmPanel.svelte
  - src/lib/components/ResultsView.svelte
  - src/lib/components/Dropzone.svelte
  - src/lib/components/FailureBanner.svelte
  - src/lib/ingest-client.ts
  - src/lib/ui-copy.ts
  - src/lib/worker-client.svelte.ts
  - src/lib/worker/csv-parse.ts
  - src/lib/worker/db.ts
  - src/lib/worker/hash.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/worker/mojibake.ts
  - src/lib/worker/classify.ts
  - src/lib/types/worker-messages.ts
  - tests/e2e/persistent-dataset.spec.ts
  - tests/e2e/import-flow.spec.ts
  - tests/e2e/zero-network.spec.ts
  - tests/fixtures/export-fixtures.ts
  - tests/unit/csv-parse.test.ts
  - tests/unit/db.test.ts
  - tests/unit/hash.test.ts
  - tests/unit/ingest-client.test.ts
  - tests/unit/ingest-worker.test.ts
  - tests/unit/mojibake.test.ts
covered_digest: "v1:sha256:8106cd14f26fbf823376ed3a1e38f9a11e97f48379271db00cf74ee32f35cdac"
behavior_unverified: 0
overrides_applied: 0
re_verification: true — initial gaps closed by 02-04 (commit c62015f)
gaps: []
---

# Phase 0 2 Verification Report (Re-Verification after Gap Closure)

**Phase Goal:** The worker parses every supported CSV in the export defensively and stores the result in IndexedDB as a single active dataset. The dataset survives reloads, identical re-uploads are skipped, and the user can wipe it at any time.

**Verified:** 2026-09-29T06:23:38Z

**Status:** PASSED — 26/26 plan-02 must-haves verified; 4/4 ROADMAP success criteria met; 6/6 requirement IDs satisfied; 8/8 e2e tests pass; 202/202 unit tests pass; lint + check + build all exit 0.

**Re-verification:** Yes — initial verification (`02-VERIFICATION.md` at 2026-09-29T01:10:00Z) flagged 2 gaps: (a) D-13 replace-on-drop UX layer unreachable (no `<Dropzone>` rendered in `done`/`duplicate` state), and (b) SC3 second half (dropping a different zip fully replaces the previous dataset) partially met for the same reason. Both gaps closed by plan 02-04 (commit `c62015f`) by co-rendering `<Dropzone>` alongside `<ResultsView>` in the `done` and `duplicate` branches of `src/App.svelte`, plus a new `{:else if confirm-pending && replace-kind && result}` branch that keeps `<ResultsView>` mounted during the replace-on-drop confirmation overlay (closing a latent 02-03 bug that became reachable once the dropzone was rendered).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every detected category folder (supported, known-deferred, unknown) gets full CSV parsing into IndexedDB. | VERIFIED | `ingest.worker.ts:139-186` — `recognized = new Set(outcome.result.categories.map(c => c.name))`; `unzipSync` filter accepts every CSV across all 3 status groups; `writeDataset(hash, accountRoot, updatedCategories, allRows)` persists the union. `import-flow.spec.ts` test (a) asserts 8 badges render. |
| 2 | SHA-256 hash computed from raw zip bytes before unzip detects identical re-imports (IMPORT-06 mechanism, SC3 first half). | VERIFIED | `ingest.worker.ts:111-126` — `digestFile(bytes)` runs after `file.arrayBuffer()` and BEFORE `listEntryPaths` / `unzipSync`; if `existing.hash === hash`, posts `'duplicate'` and returns. `ingest-worker.test.ts` Test 5(b) proves a second identical-bytes 'ingest' never posts 'stage: unzipping'. |
| 3 | `writeDataset()` atomic transactional clear+bulkPut+meta.put — no stale rows survive a successful re-import. | VERIFIED | `db.ts:73-88` — `db.transaction('rw', db.rows, db.meta, async () => { await db.rows.clear(); …; await db.meta.put(…) })`. `db.test.ts` Test 4 asserts second `writeDataset` with different hash leaves `db.rows.count()` equal to new `rows.length`. |
| 4 | Every string field parsed from CSV is run through `fixMojibake` (IMPORT-04). | VERIFIED | `csv-parse.ts:74-82` — every value in `result.data` is fed through `fixMojibake(v)` before being pushed. |
| 5 | Ragged columns (FieldMismatch/TooFewFields/TooManyFields) do NOT abort parsing. | VERIFIED | `csv-parse.ts:52` — `if (error.type !== 'Quotes') continue;` only Quotes-type errors are tracked; ragged-column errors are non-fatal. `csv-parse.test.ts` asserts both CRLF and bare-CR line endings parse correctly with field-count mismatches surviving. |
| 6 | `fixMojibake` round-trips the real-sample double-UTF8 Cyrillic byte pattern back to readable text. | VERIFIED | `mojibake.test.ts` "real-sample byte pattern (RESEARCH.md A2)" describe block — passes for both the round-trip case and the false-positive guard case. |
| 7 | Skip-count tag is rendered ONLY when `skippedRowCount > 0`. | VERIFIED | `CategoryBadge.svelte:42-45` — `{#if entry.skippedRowCount && entry.skippedRowCount > 0}`; `persistent-dataset.spec.ts` test (a-skip) asserts exactly 1 skip tag across the malformed fixture. |
| 8 | Skip-row counts persist across reloads (D-09). | VERIFIED | `db.ts:85` — `categories` array (with `skippedRowCount`) is stored in `meta`. `persistent-dataset.spec.ts` test (a-skip) reloads and asserts the tag survives. |
| 9 | Per-category parsing progress posts during import (D-11). | VERIFIED | `ingest.worker.ts:149-162` — posts `{type:'stage', stage:'parsing', progress:{category, categoryIndex, categoryTotal}}` between each category. `IngestClient.parsingProgress` captures it; `App.svelte`'s `$derived.by statusTextFor` renders `formatParsingProgress(progress)`. `persistent-dataset.spec.ts` test (c) polls ≥2 distinct progress texts at 25 ms interval. |
| 10 | Returning visitor with cached dataset auto-loads straight to results view (D-07). | VERIFIED | `worker-client.svelte.ts:392-406` — 'ready' handler piggybacks a 'check-cache' request; 'cache-status' handler transitions 'checking-cache' → 'done'. `persistent-dataset.spec.ts` test (a) reloads and asserts results appear with identical badge text + 'Imported on ...' timestamp. |
| 11 | Fresh visitor with no cached dataset shows 'Checking for a saved export...' then settles on empty dropzone (D-08). | VERIFIED | `App.svelte:138-148` — `{#if state === 'checking-cache'}` branch renders the spinner + `CACHE_CHECK_TEXT`. `persistent-dataset.spec.ts` test (b) asserts the brief status appears (soft) and the settled state is the empty dropzone. |
| 12 | 'Imported on [date]' timestamp rendered between summary and badges (D-10). | VERIFIED | `ResultsView.svelte:43` — `<p class="imported-at" data-testid="imported-at">{formatImportedOn(result.importedAt ?? '')}</p>`. `persistent-dataset.spec.ts` test (a) captures and asserts the timestamp text. |
| 13 | Dropping a DIFFERENT zip while cached shows confirm panel; old dataset stays visible behind it (D-13). | VERIFIED (gap closed by 02-04) | `App.svelte:181-186` — `done` branch now renders `<ResultsView>` AND `<Dropzone>` side-by-side. `App.svelte:199-204` — duplicate branch mirrors the same co-render. `App.svelte:205-223` — new `{:else if confirm-pending && pendingAction?.kind === 'replace' && result}` branch keeps `<ResultsView>` mounted behind the `<ConfirmPanel>` overlay. `worker-client.svelte.ts:341-347` (unchanged from 02-03) routes drops in 'done' state through `pendingAction={kind:'replace', file}` → 'confirm-pending'. `persistent-dataset.spec.ts` test (d) passes — Cancel leaves old dataset, Confirm flips `account-heading` to `RENAMED_ACCOUNT_ROOT` and `summary-line` to `formatSummary(RENAMED_EXPECTED_COUNTS)`. |
| 14 | Confirming a replace fully replaces the previous dataset — no stale row from prior import survives (IMPORT-06, SC3 second half). | VERIFIED (gap closed by 02-04) | `db.ts writeDataset()` does fully clear+write atomically — verified end-to-end via `persistent-dataset.spec.ts` test (d) step 4: drop `buildRenamedRootExport()` on cached sample, confirm panel appears, click commit, `account-heading` flips to `RENAMED_ACCOUNT_ROOT`, `summary-line` shows `formatSummary(RENAMED_EXPECTED_COUNTS)`. The full replace path is now end-to-end reachable through the UI. |
| 15 | Start Over now requires confirmation; once confirmed wipes IndexedDB (D-15, D-16). | VERIFIED | `App.svelte:26-37` — `onStartOver` calls `ingestClient.requestStartOver()`; `worker-client.svelte.ts:214-219` transitions to 'confirm-pending' with `pendingAction.kind='start-over'`; confirm posts 'clear-data' and awaits 'cleared'. `persistent-dataset.spec.ts` test (e) passes — confirms wipe, reload shows empty dropzone. |
| 16 | Persistent 'Clear my cached data' control visible on every state with cached dataset and hidden otherwise (D-18, D-19). | VERIFIED | `App.svelte:262-271` — `{#if state === 'done' || state === 'duplicate'}` gates the persistent bar; `persistent-dataset.spec.ts` test (f) asserts hidden when no cache, visible after import. |
| 17 | Confirming a clear shows 'Cached data cleared' acknowledgment before empty dropzone (D-20). | VERIFIED | `App.svelte:241` — `{#if state === 'idle' && justCleared}<p data-testid="cleared-ack">{CLEARED_ACK_MESSAGE}</p>{/if}`; `worker-client.svelte.ts:483-503` — 'cleared' response sets `justCleared = true`. `persistent-dataset.spec.ts` tests (e) and (f) assert the text. |
| 18 | No native browser `confirm()`/`alert()` dialog ever used for destructive confirmations (D-14). | VERIFIED | `ConfirmPanel.svelte` is a styled in-app panel only; no `confirm()` / `alert()` calls in `src/` (grep returns 0 hits). `persistent-dataset.spec.ts` test (g) registers a `page.on('dialog', …)` listener asserting zero dialogs across all three destructive flows (replace, start-over, clear-data) and passes. |
| 19 | Start Over and Clear my cached data show the exact same confirm copy and use the same confirm component (D-22). | VERIFIED | `ui-copy.ts:177-192` — `CONFIRM_CLEAR_MESSAGE` / `KEEP_CACHED_DATA_LABEL` / `DELETE_CACHED_DATA_LABEL` shared. `App.svelte:124-129` — `confirmCopy` `$derived` collapses both 'start-over' and 'clear-data' branches into a single copy. Tests (e) and (f) assert the same panel content for both triggers. |
| 20 | `clearData()` leaves zero rows and no 'active' meta record; safe to call when no dataset exists. | VERIFIED | `db.ts:118-123` — `db.rows.clear() + db.meta.delete('active')` in one transaction. `db.test.ts` "clearData" describe block (2 tests) passes. |
| 21 | IngestClient exposes `requestStartOver`/`requestClearData`/`confirmPending`/`cancelPending` — all three destructive flows route through one `pendingAction`/confirm-pending state shape. | VERIFIED | `worker-client.svelte.ts:24-25` (`PendingAction` discriminated union); `110-125` (`pendingAction` / `#pendingReturnState` / `justCleared`); `214-235` (`requestStartOver`/`requestClearData`); `254-291` (`confirmPending`); `305-311` (`cancelPending`); `ingest-client.test.ts` (10 tests in 02-03) all pass. |
| 22 | All new failure sources (parse exception, Dexie write/quota error) fall through to the same generic failure banner. | VERIFIED | `worker-client.svelte.ts:518-524` — single `#fail()` path; `ingest.worker.ts:202-210` — single try/catch wrapping `handleIngest` posts `{type:'error'}`. No new banner copy was introduced. |
| 23 | Page stays responsive (no 1 s main-thread long task) during a realistic 10x-scale import (SC1's second half). | VERIFIED | `persistent-dataset.spec.ts` test (c) installs a `PerformanceObserver` for 'longtask' before `goto`, drops `buildScaleExport()` (~60k rows across 8 categories), asserts ≥2 distinct per-category progress texts observed AND no task ≥ 1000 ms after submission AND results within 60 s. Test passes. |
| 24 | npm packages added (papaparse 5.7.0, dexie 4.4.6, @types/papaparse 5.5.2, fake-indexeddb 6.2.5) match locked-in versions and are properly wired (fake-indexeddb in `tests/unit/setup.ts` first line). | VERIFIED | `pnpm ls papaparse dexie @types/papaparse fake-indexeddb` returns all 4. `tests/unit/setup.ts:1` `import 'fake-indexeddb/auto';` precedes the `$state` shim. |
| 25 | WORKER-OWNS-DEXIE sole-owner rule: `db.ts` is imported only by `ingest.worker.ts`. | VERIFIED | `grep -rn "from.*worker/db" src/` returns only `src/lib/worker/ingest.worker.ts:16`. Main-thread code routes through worker message types ('check-cache', 'clear-data'). |
| 26 | `navigator.storage.persist()` called from main thread only (D-06). | VERIFIED | `ingest-client.ts:41` — `void navigator.storage?.persist?.();` at module scope, main-thread only (WebIDL `[Exposed=Window]` cannot be reached from worker). |

**Score:** 26/26 truths verified (all previously-verified 24 truths still pass; the 2 previously-failed/partial truths D-13 and SC3 second half are now fully verified by the 02-04 render-tree changes).

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | (none — all roadmap-scoped must-haves for Phase 2 are within this phase's scope) | — | — |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/worker/hash.ts` | SHA-256 of raw zip bytes, lowercase hex. | VERIFIED | Lines 21-28 — `crypto.subtle.digest('SHA-256', bytes)`. |
| `src/lib/worker/mojibake.ts` | Round-trip-or-reject fix for double-UTF8 Cyrillic. | VERIFIED | Lines 26-44 — strict UTF-8 decoder with `fatal: true`; rejects on any code unit > 0xff. |
| `src/lib/worker/csv-parse.ts` | Defensive CSV parse with mojibake fix and Quote-error skip. | VERIFIED | Lines 42-85 — `Papa.parse({header:true, skipEmptyLines:true, worker:false})` + `fixMojibake` on every string value + Quotes-type skip via `error.row - 1` (dataIndex) per RESEARCH Pitfall 3. |
| `src/lib/worker/db.ts` | AppDb + writeDataset + checkCache + clearData. | VERIFIED | All four functions present, transactional, sole-owner (only `ingest.worker.ts` imports this). |
| `src/lib/worker/classify.ts` | `resolveCsvFileCategory` helper for per-CSV routing. | VERIFIED | `src/lib/worker/classify.ts:resolveCsvFileCategory` exposed. |
| `src/lib/worker/ingest.worker.ts` | Hash+parse+write pipeline, check-cache + clear-data handlers. | VERIFIED | Lines 27-41 (message routing); 53-66 (`handleClearData`); 78-102 (`handleCheckCache`); 104-211 (`handleIngest` — hash → unzip → classify → per-category parse → write). |
| `src/lib/types/worker-messages.ts` | Extended message contract (check-cache, clear-data, duplicate, cache-status, cleared; hashing|parsing|writing stages; ParsingProgress; CategoryEntry gains rowCount+skippedRowCount; ClassifyResult gains importedAt). | VERIFIED | Types present and consistent. |
| `src/lib/worker-client.svelte.ts` | IngestViewState extended; pendingAction / #pendingReturnState / justCleared; requestStartOver / requestClearData / confirmPending / cancelPending; parsingProgress carry; check-cache piggyback on 'ready'. | VERIFIED | Lines 12-13 (state union), 24-25 (PendingAction), 96-125 (new fields), 214-291 (4 new methods), 392-503 (#handle covers all new response variants); `submitFiles()` replace-guard unchanged at lines 341-347 (02-04 made no changes here). |
| `src/lib/ingest-client.ts` | Module-scope `ingestClient` + `navigator.storage.persist()` main-thread call. | VERIFIED | Lines 24-29 (worker spawn), 41 (persist). |
| `src/lib/ui-copy.ts` | All new copy (formatParsingProgress, formatRowCount, formatSkippedRowCount, DUPLICATE_BANNER_MESSAGE, CACHE_CHECK_TEXT, formatImportedOn, CONFIRM_REPLACE_MESSAGE, KEEP_CURRENT_DATA_LABEL, REPLACE_DATASET_LABEL, CONFIRM_CLEAR_MESSAGE, KEEP_CACHED_DATA_LABEL, DELETE_CACHED_DATA_LABEL, CLEAR_DATA_LABEL, CLEARED_ACK_MESSAGE). | VERIFIED | All 15 exports present and centralized. |
| `src/lib/components/CategoryBadge.svelte` | File+row counts (D-05); conditional skip-count tag (D-04); neutral palette tints. | VERIFIED | Lines 37-46 (markup), 96-107 (`.badge-skipped` amber palette). |
| `src/lib/components/ResultsView.svelte` | 'Imported on ...' timestamp (D-10); neutral restyled .start-over button (D-15). | VERIFIED | Lines 36-43 (results + account-heading + imported-at), 109-120 (.start-over neutral grey). |
| `src/lib/components/ConfirmPanel.svelte` | Shared in-app destructive confirm panel with Caution/amber chrome and red commit button. | VERIFIED | Lines 32-42 (markup), 52-128 (styling per UI-SPEC Color table). |
| `src/App.svelte` | Co-rendered Dropzone + replace-aware state-conditional. | VERIFIED | Lines 138-148 (checking-cache); 169-186 (done branch with co-rendered ResultsView + Dropzone — D-13 UX layer); 187-204 (duplicate branch — mirror of done); 205-223 (NEW 02-04 branch: confirm-pending + replace-kind + result → ResultsView only, latent 02-03 bug fix); 224-249 (else branch); 262-271 (persistent bar). |
| `tests/fixtures/export-fixtures.ts` | buildMalformedRowsExport, buildScaleExport, buildMojibakeExport. | VERIFIED | All present. |
| `tests/unit/*.test.ts` | hash, mojibake, csv-parse, db, classify, ingest-worker, ingest-client. | VERIFIED | All 11 files pass; 202/202 tests pass. |
| `tests/e2e/persistent-dataset.spec.ts` | 8 tests covering return-visit, fresh, malformed, 10x-scale, replace-on-drop, start-over, clear-data, no-dialog. | VERIFIED | All 8 tests pass: (a), (b), (a-skip), (c), (d), (e), (f), (g). 02-04 did NOT modify test assertions — the fix is exclusively render-tree wiring in App.svelte. |
| `tests/e2e/zero-network.spec.ts`, `tests/e2e/import-flow.spec.ts` | Phase-1 e2e specs. | VERIFIED | Both pass (import-flow's obsolete test (c) "start over has no confirmation" removed in 02-03). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ingest.worker.ts` hash-check | `db.ts` checkCache | Called before `listEntryPaths`/`unzipSync` (`ingest.worker.ts:113`) | WIRED | SC3 first half verified by `ingest-worker.test.ts` Test 5(b). |
| `ingest.worker.ts` clear-data | `db.ts` clearData | Mirrors checkCache error-path shape (`ingest.worker.ts:53-66`) | WIRED | `clearData` unit tests pass. |
| `worker-client.svelte.ts` 'ready' handler | worker 'check-cache' request | Auto-load piggybacks on the ready handshake (`worker-client.svelte.ts:392-406`) | WIRED | `persistent-dataset.spec.ts` test (a) proves the auto-load resolves. |
| `worker-client.svelte.ts` 'done'-state replace-guard | `App.svelte` `<ConfirmPanel>` overlay | `submitFiles()` lines 341-347 → `pendingAction={kind:'replace', file}` → `state='confirm-pending'` → `App.svelte:149-166` renders `<ConfirmPanel>` with `CONFIRM_REPLACE_MESSAGE` / `KEEP_CURRENT_DATA_LABEL` / `REPLACE_DATASET_LABEL` | WIRED | `persistent-dataset.spec.ts` test (d) end-to-end proves the chain (Cancel step 3, Confirm step 4). |
| `App.svelte` new replace-pending branch | `<ResultsView>` behind overlay | `App.svelte:205-223` — keeps ResultsView mounted when `confirm-pending && replace-kind && result` | WIRED | Test (d) step 2 asserts `account-heading` still shows old `SAMPLE_ACCOUNT_ROOT` while panel is visible. |
| `App.svelte` `onStartOver` / `onClearData` | `ingestClient.requestStartOver` / `requestClearData` | D-22's single shared mechanism | WIRED | tests (e) and (f) both pass through the same ConfirmPanel path. |
| `App.svelte` persistent bar | `ingestClient.requestClearData` | Persistent bar visible on `done`/`duplicate` only (`App.svelte:262-271`) | WIRED | test (f) asserts hidden-then-visible-then-cleared. |
| `csv-parse.ts` `skippedCount` | `db.ts` `DatasetMeta.categories[i].skippedRowCount` | Written through `updatedCategories` (`ingest.worker.ts:181-186`) | WIRED | test (a-skip) proves the count survives a write→auto-load round trip. |
| `worker-client.svelte.ts` `parsingProgress` | `App.svelte` `statusTextFor` | Captured in 'stage' handler (`worker-client.svelte.ts:421`), consumed by `$derived.by` (`App.svelte:92-99`) | WIRED | test (c) observes ≥2 distinct progress texts. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/lib/worker/db.ts` `writeDataset` | `rows` | per-category parse loop in `ingest.worker.ts` (every detected category, every status) | Yes — `bulkPut(rows)` writes actual parsed content (generic header-keyed shape) | FLOWING |
| `src/lib/worker/db.ts` `writeDataset` | `categories` | per-category `rowCount` + `skippedRowCount` accumulated in `ingest.worker.ts:163-185` | Yes — real row counts from parsed rows + skipped counts from Quotes errors | FLOWING |
| `src/lib/worker/ingest.worker.ts` checkCache → 'cache-status' | `cached` | `checkCache()` result on reload | Yes — populated `ClassifyResult` or null | FLOWING |
| `src/lib/components/CategoryBadge.svelte` `rowCount` | `entry.rowCount` | from `result.categories` (passed via ResultsView → CategoryBadge props) | Yes — populated by writeDataset's stored categories array | FLOWING |
| `src/lib/components/ResultsView.svelte` `importedAt` | `result.importedAt` | writeDataset's ISO timestamp via the 'done' response | Yes — `new Date(isoDate).toLocaleDateString('en-US', ...)` produces a real formatted date | FLOWING |
| `src/lib/components/ResultsView.svelte` account-heading | `result.accountRoot` | from `analyzeExport`'s detection of zip root | Yes — populated by the actual classify pass (e.g. '123456789' for the sample) | FLOWING |
| `src/App.svelte` `confirmCopy` | `ingestClient.pendingAction.kind` | discriminator of the 'replace' / 'start-over' / 'clear-data' `PendingAction` | Yes — `$derived.by` reads the live state; selected by `if (action.kind === 'replace')` branch | FLOWING |
| `src/App.svelte` replace-pending branch gate | `state === 'confirm-pending' && pendingAction?.kind === 'replace' && result` | `$derived` reads from live IngestClient state | Yes — branch matches exactly when the user has dropped a different zip while in `done`/`duplicate` state and the ConfirmPanel is showing; falls through to `{:else}` for start-over/clear-data kinds (no result to keep visible). | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Persistent-dataset e2e suite | `pnpm exec playwright test tests/e2e/persistent-dataset.spec.ts` | **8 passed (10.3s)** — all 8 tests pass: (a) return-visit auto-load, (b) fresh-visit cache-check, (a-skip) skip-count survives reload, (c) 10x-scale responsiveness, (d) replace-on-drop confirm + replace (previously failing — NOW PASSES), (e) start-over destructive, (f) clear-data persistent control, (g) zero native browser dialogs (previously failing — NOW PASSES). | PASS |
| Full unit suite | `pnpm exec vitest run` | 202/202 passed across 11 test files (1.03s) | PASS |
| Full lint | `pnpm run lint` | Prettier "All matched files use Prettier code style!" + ESLint silent | PASS |
| Typecheck | `pnpm run check` | svelte-check 226 app files 0 errors 0 warnings; tsc -p tsconfig.node.json 0 errors; svelte-check 323 test files 0 errors 0 warnings | PASS |
| Production build | `pnpm run build` | vite v8.3.1 — dist/index.html 0.79 kB, ingest.worker-yPJn4feG.js 127.17 kB, index-BapSVMf6.css 5.53 kB, index-_JeRCDFZ.js 49.03 kB. Built in 101 ms. | PASS |

### Code-State Spot-Checks

| Check | Command | Expected | Actual | Status |
|-------|---------|----------|--------|--------|
| `data-testid="dropzone"` location | `grep -n 'data-testid="dropzone"' src/lib/components/Dropzone.svelte` | line 90, exit 0 | line 90, exit 0 | PASS |
| `<Dropzone>` render sites | `grep -n '<Dropzone' src/App.svelte` | 3 occurrences (one in `done`, one in `duplicate`, one in `{:else}`); none in the new `{:else if confirm-pending && replace-kind && result}` branch which renders `<ResultsView>` only | 3 element tags: line 182 (done), line 200 (duplicate), line 244 (else); plus comment references at 171, 195, 211 | PASS |
| `<ResultsView>` render sites | `grep -n '<ResultsView' src/App.svelte` | 3 occurrences (done, duplicate, new replace-pending branch) | 3 element tags: line 181 (done), line 199 (duplicate), line 223 (new replace-pending branch); plus comment references at 171, 177, 207, 212, 216 | PASS |
| Replace-pending branch | `grep -nE "pendingAction\?\.kind === ['\"]replace['\"]" src/App.svelte` | line 205 must show the new branch | line 205 — `{:else if ingestClient.state === 'confirm-pending' && ingestClient.pendingAction?.kind === 'replace' && ingestClient.result}` | PASS |
| 02-04 commit(s) | `git log --oneline -E --grep="^[a-z]+\(0*2-0*4\):"` | must show 02-04 commit(s) | c62015f feat(02-04): expose dropzone alongside ResultsView for replace-on-drop UX (closes D-13) | PASS |
| Sole-owner Dexie | `grep -rn "worker/db" src/` | only `src/lib/worker/ingest.worker.ts:16` | only `src/lib/worker/ingest.worker.ts:16` (the `db.ts:102` hit is a doc-comment) | PASS |
| No native dialogs | `grep -rEn "confirm\(\|alert\(\|window\.alert\|window\.confirm" src/` | 0 hits | 0 hits | PASS |
| `navigator.storage.persist()` | `grep -nE "navigator\.storage" src/lib/ingest-client.ts` | main thread only | `ingest-client.ts:41: void navigator.storage?.persist?.();` (module scope, main thread) | PASS |

### Adversarial Scenario Audit

| Scenario | Expected behavior | Verified |
|----------|-------------------|----------|
| **A. Replace on 'duplicate' state** — drop a different zip when state is `duplicate` | ConfirmPanel appears with REPLACE_DATASET_LABEL; old ResultsView stays visible behind panel; on confirm, full replace occurs | VERIFIED — `App.svelte:199-204` co-renders Dropzone in `duplicate` branch; `submitFiles()` replace-guard at `worker-client.svelte.ts:341-347` applies to any state transitioning through `done`/`duplicate`. The new `{:else if confirm-pending && replace-kind && result}` branch at `App.svelte:205-223` covers both transitions. Test (d) is structurally identical (replace from `done` state); the same `submitFiles` guard handles `duplicate` state the same way. |
| **B. Start Over with 'replace' pending action** | Should NOT happen — Start Over can only be triggered from `<ResultsView>`, and Start Over sets `pendingAction.kind='start-over'`, never `'replace'` | VERIFIED by structure — `ResultsView.svelte` is the only source of `onstartover` callbacks; `App.svelte`'s Dropzone render site has no Start Over button. The new `{:else if}` branch at `App.svelte:205` requires `pendingAction.kind === 'replace'`, which can only be set by `submitFiles()` replace-guard, which is only reachable via a Dropzone drop (not from Start Over). |
| **C. Cancel pending replace** | Click "Keep current data"; state returns to `done`; `<ResultsView>` + `<Dropzone>` re-render; no data loss | VERIFIED by `cancelPending()` at `worker-client.svelte.ts:305-311` — restores `state = #pendingReturnState ?? 'idle'` (set to 'done' in the replace-guard at line 343), clears `pendingAction` and `#pendingReturnState`. `justCleared` is also cleared (line 310) so a stale ack never persists across a cancel. The `{:else if replace-kind && result}` branch only matches `confirm-pending`, so on cancel the state falls through to `done`/`duplicate` branches which re-render `<ResultsView>` + `<Dropzone>`. |
| **D. Drop on `done` state while busy** | `disabled={ingestClient.busy}` should prevent the drop | VERIFIED — `App.svelte:183, 201, 245` pass `disabled={ingestClient.busy}` to all three Dropzone instances. `Dropzone.svelte` applies `.disabled` class and disables the file input. Even if a drop event reached the input, `submitFiles()` busy-guard at `worker-client.svelte.ts:317-320` returns `false` immediately. |
| **E. Replace-on-drop with invalid zip** | State machine routes to error; dataset unchanged (IMPORT-06 atomicity) | VERIFIED by structure — `confirmPending()` for replace kind (`worker-client.svelte.ts:259-278`) bypasses the in-client pre-check (file already passed it on the original drop OR, in the rare path where the file was set as `pendingAction` while `state==='done'`, the worker-side `handleIngest` single try/catch (`ingest.worker.ts:202-210`) catches any failure and posts `{type:'error'}`, which routes through the single `#fail()` path. `writeDataset()` is transactional — atomic — so partial failures leave the previous dataset intact. |

### 02-04 Scope Audit

The 02-04 commit `c62015f` modified a single source file:

```
git diff --stat c584aaa..c62015f
.planning/ROADMAP.md                               |  10 +-
.planning/STATE.md                                 |  24 +-
.planning/phases/02-defensive-parsing-persistent-dataset/02-04-PLAN.md | 224 +++++++++++++++++++
.planning/phases/02-defensive-parsing-persistent-dataset/02-04-SUMMARY.md |  89 ++++++++
.planning/phases/02-defensive-parsing-persistent-dataset/02-VERIFICATION.md | 242 +++++++++++++++++++++
.planning/state.json                               |   8 +-
src/App.svelte                                     |  44 ++++
7 files changed, 622 insertions(+), 19 deletions(-)
```

Of the 622 insertions, 44 are `src/App.svelte` (3 render-tree changes: 2 `<Dropzone>` co-renders of ~5 lines each + 1 new `{:else if}` branch of ~19 lines with extensive comment). The remaining 578 are planning artifacts (PLAN, ROADMAP, STATE, prior VERIFICATION). No test files were modified. No worker-client, Dropzone, or ConfirmPanel files were modified. This matches the plan's prohibitions exactly.

### 02-04 Latent-Bug Fix Audit (the documented deviation)

The 02-04 plan authorized only 2 changes (Dropzone co-render in done + duplicate branches). 02-04 actually added a 3rd change: a new `{:else if confirm-pending && pendingAction?.kind === 'replace' && result}` branch (`App.svelte:205-223`) that keeps `<ResultsView>` mounted during the replace-on-drop confirmation.

**Why this is required, not a scope expansion:**
- Without it, the `'done' → 'confirm-pending'` transition would fall through to the `{:else}` branch (`App.svelte:224-249`) which renders `<Dropzone>` alone — UNMOUNTING `<ResultsView>` and contradicting the 02-03 plan comment at `App.svelte:150-159` which states "The pending drop's results view (or dropzone) is NOT swapped out — the panel overlays it."
- Before 02-04, this latent bug was unreachable because the Dropzone wasn't rendered in `'done'` state. 02-04's co-render made it reachable, so the bug-fix branch had to land simultaneously to preserve the D-13 "old dataset remains visible behind the panel" guarantee.
- The branch is narrowly scoped: gated on `pendingAction.kind === 'replace' AND result !== null`. `'start-over'` and `'clear-data'` kinds correctly fall through to the `{:else}` branch (D-16/D-22: destructive confirmation before an empty dropzone).

**Verification:**
- `persistent-dataset.spec.ts` test (d) step 2 asserts `await expect(page.getByTestId('account-heading')).toHaveText(`Account: ${SAMPLE_ACCOUNT_ROOT}`)` WHILE the ConfirmPanel is visible. This assertion would fail if `<ResultsView>` were unmounted. Test passes.
- `persistent-dataset.spec.ts` test (e) (start-over) and (f) (clear-data) still assert the empty dropzone appears after confirm — confirming that `'start-over'` and `'clear-data'` kinds correctly fall through to the `{:else}` branch (no result to keep visible).

### Regression Audit

All 24 previously-verified truths (per initial verification) re-confirmed after the 02-04 edit:
- D-04, D-05, D-07, D-10 (per-category parse persistence, badges, auto-load, imported-at): tests (a), (a-skip) pass.
- SHA-256 hash-before-unzip dedup: `worker-client.svelte.ts:341-347` unchanged; `ingest-worker.test.ts` Test 5(b) still passes.
- writeDataset atomic clear+bulkPut+meta.put: `db.ts` unchanged; `db.test.ts` passes.
- Mojibake round-trip: `mojibake.ts` and `csv-parse.ts` unchanged; `mojibake.test.ts` passes.
- Skipped-row counts persisted across reloads: `db.ts:85` unchanged; test (a-skip) passes.
- Per-category parsing progress: `worker-client.svelte.ts` `parsingProgress` field unchanged; `App.svelte:92-99` `$derived.by statusTextFor` unchanged; test (c) passes.
- Auto-load from cache on return visit: `worker-client.svelte.ts:392-406` unchanged; test (a) passes.
- Fresh visitor empty dropzone: `App.svelte:138-148` unchanged; test (b) passes.
- Start Over destructive confirmation: `worker-client.svelte.ts:214-235` and `App.svelte:26-37` unchanged; test (e) passes.
- Persistent Clear-my-cached-data control: `App.svelte:262-271` unchanged; test (f) passes.
- ConfirmPanel copy shared between Start Over and Clear Data (D-22): `App.svelte:124-129` `confirmCopy` `$derived` unchanged; tests (e) and (f) assert the same copy.
- Single-failure-path banner: `worker-client.svelte.ts:518-524` `#fail()` unchanged.
- 10x-scale responsiveness: `worker-client.svelte.ts` unchanged; test (c) passes.
- Locked package versions: no package.json changes in 02-04.
- WORKER-OWNS-DEXIE sole-owner rule: no `db.ts` import changes in 02-04.
- `navigator.storage.persist()` main-thread only: `ingest-client.ts:41` unchanged.

No regressions detected.

### Probe Execution

Phase 2 does not declare or imply probe-based verification — the standard automated checks (vitest / eslint / prettier / svelte-check / vite build / playwright) cover the surface.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IMPORT-01 | 02-01 | Drag-and-drop zip unzipped + parsed entirely client-side (fflate + PapaParse, single long-lived worker). | SATISFIED | `ingest.worker.ts:139-144` (`unzipSync` inside worker); `ingest.worker.ts:165-180` (`parseCsvFile` inside worker, never on main thread). `ingest-client.ts:24-29` — single worker spawned at module init. `grep -rn 'new Worker(' src/` returns exactly 1 hit. `zero-network.spec.ts` asserts `workerUrls.length === 1`. |
| IMPORT-03 | 02-01, 02-02 | CSV parsing tolerates unexpected/missing columns and mixed line terminators. | SATISFIED | `csv-parse.ts:52` — non-Quotes errors are non-fatal. `csv-parse.test.ts` covers CRLF + bare-CR + ragged-column cases. `csv-parse.ts:43-47` — `header: true, skipEmptyLines: true, worker: false` config from RESEARCH Pattern 2. |
| IMPORT-04 | 02-01, 02-02 | Double-UTF8 mojibake fields corrected on parse. | SATISFIED | `mojibake.ts:26-44` — strict UTF-8 round-trip with `fatal: true`; `csv-parse.ts:74-82` — applied to every parsed string value; `mojibake.test.ts` A2 real-sample byte pattern passes. |
| IMPORT-06 | 02-01, 02-03, 02-04 | New zip replaces current dataset (single active); identical re-upload skipped via hash. | SATISFIED (was PARTIAL — gap closed by 02-04) | Hash-dedup path complete and verified (`ingest.worker.ts:111-126`; `ingest-worker.test.ts`). `writeDataset()` clears+bulkPut+meta.put atomically (`db.ts:73-88`; `db.test.ts`). **Replace-on-drop UX layer (D-13) now fully reachable** — `App.svelte:181-186` and `199-204` co-render `<Dropzone>` in `done`/`duplicate` branches; `App.svelte:205-223` keeps `<ResultsView>` mounted during replace-on-drop confirmation; `persistent-dataset.spec.ts` test (d) end-to-end proves the user-facing flow (drop → confirm panel with REPLACE_DATASET_LABEL → cancel leaves old dataset → confirm flips account-heading to `RENAMED_ACCOUNT_ROOT` and summary to `RENAMED_EXPECTED_COUNTS`). |
| DATA-01 | 02-01, 02-02 | Parsed data cached in IndexedDB so re-upload isn't needed on repeat visits. | SATISFIED | `db.ts writeDataset` persists every category's rows + meta; `persistent-dataset.spec.ts` test (a) proves the auto-load round trip with identical row counts and 'Imported on ...' timestamp after reload. |
| DATA-02 | 02-03 | Discoverable 'Clear my cached data' control wipes IndexedDB cache. | SATISFIED | `App.svelte:262-271` — persistent bar with the control, gated on `state in {done, duplicate}` (D-19 hidden). `db.ts:118-123` — `clearData` wipes rows + deletes 'active' meta in one transaction. `persistent-dataset.spec.ts` tests (e) and (f) assert the control's visibility and effect. |

**Coverage:** All 6 phase-2 requirement IDs accounted for. 6/6 fully satisfied (up from 5/6 in the prior verification).

### ROADMAP Success Criteria

| SC | Description | Status | Evidence |
|----|-------------|--------|----------|
| SC1 | After importing the sample export and reloading the browser, per-category row counts are still available without re-uploading, and all unzip, parse, and write work ran in the worker. A synthetic export at least 10x the sample's size imports with progress advancing per category and the page never freezing. | MET | `persistent-dataset.spec.ts` test (a) — return-visit auto-load with unchanged row counts. `persistent-dataset.spec.ts` test (c) — 10x-scale synthetic export, ≥2 distinct per-category progress texts, no long-task ≥1000 ms, results within 60 s. |
| SC2 | CSVs with CRLF or bare-CR-only line endings, missing columns, or unexpected extra columns import without errors. Double-UTF8 mojibake fields (e.g. Cyrillic clan text) come out as correct, readable text. | MET | `csv-parse.ts:52` — non-Quotes errors non-fatal. `csv-parse.test.ts` covers CRLF + bare-CR + ragged-column cases. `mojibake.test.ts` A2 real-sample byte pattern passes. |
| SC3 | Re-dropping the identical zip is reported as already loaded and skipped before any unzip or parse work starts. Dropping a different zip fully replaces the previous dataset, leaving no rows from the old export. | MET (was PARTIAL — gap closed by 02-04) | First half: `ingest.worker.ts:111-126` hash check before unzip; `ingest-worker.test.ts` Test 5(b) proves no 'stage: unzipping' on identical re-upload. Second half: `App.svelte:181-186, 199-204` co-render `<Dropzone>` in `done`/`duplicate` states; `worker-client.svelte.ts:341-347` replace-guard routes drop → `pendingAction={kind:'replace', file}` → `'confirm-pending'`; `App.svelte:205-223` keeps `<ResultsView>` mounted during the confirm panel; `persistent-dataset.spec.ts` test (d) end-to-end confirms the full replace (cancel leaves old dataset, confirm flips `account-heading` to `RENAMED_ACCOUNT_ROOT`). |
| SC4 | A clearly visible "Clear my cached data" control deletes all cached export data. After clearing and reloading, the app is back in its empty upload state and IndexedDB holds no export rows. | MET | `App.svelte:262-271` — persistent bar with clear-data control, visible when `state in {done, duplicate}` and hidden otherwise (D-18/D-19). `db.ts:118-123` — `clearData` wipes rows + deletes meta in one transaction. `persistent-dataset.spec.ts` test (f) asserts hidden-then-visible-then-cleared; test (e) reloads after confirm and asserts empty dropzone + zero IndexedDB rows. `grep -rEn "confirm\(\|alert\(" src/` returns 0 hits — D-14 (no native browser confirm/alert dialogs) verified. |

**Coverage:** 4/4 ROADMAP success criteria met end-to-end.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/worker-client.svelte.ts` | 259-265 | `confirmPending()` for 'replace' kind bypasses `submitFiles()` precheck | Info (known deviation, documented in code comment) | The comment at line 261-265 documents that "the user has already pre-checked the file via the original drop." This is true for the busy-guard-then-drop path but NOT for the `done`-state-drop-then-confirm path: in that path, the file goes from `submitFiles()` line 341-347 (replace-guard, sets pendingAction, returns) WITHOUT reaching `precheckFiles()` at line 354. An invalid zip dropped while state==='done' will reach the worker only after confirm; the worker-side `handleIngest` single try/catch will then route it to error. Dataset atomicity is preserved (writeDataset only fires on success), but the failure surfaces as a generic error banner rather than an immediate pre-check rejection. Future improvement: call `precheckFiles(action.file)` inside `confirmPending()` for the replace branch. Severity: low — the file IS pre-validated by the worker-side `unzipSync` / classify path before any parse work, and the error message is the same generic copy. |
| `src/App.svelte` | 61-70 | window-level `ondragover`/`ondrop` preventDefault() without forwarding the drop | Info (architectural carryover, unchanged by 02-04) | Drops anywhere on the page when state==='done' are silently swallowed. Per the prior verification's advisory, Phase 3 dashboard will likely include its own drop zone. The 02-04 changes do NOT alter this; the replace-on-drop UX layer now flows through the Dropzone, not the window. |

No `TBD` / `FIXME` / `XXX` markers in any phase file. No unused imports detected by lint. No empty-impl stubs in worker modules.

### Human Verification Required

The following items cannot be verified programmatically and are noted for human review:

1. **Visual styling of the ConfirmPanel (D-13/D-22).** The amber/red palette and spacing are exactly per the UI-SPEC Color table, but visual review is the only way to confirm the panel reads as part of the established semantic family.

2. **Imported-on timestamp text rendering.** `formatImportedOn` uses `Date.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})` which produces "Sep 28, 2026" on the verification host, but locale behavior can vary.

3. **10x-scale responsiveness real-world feel.** The 1 s long-task threshold is the conventional "noticeable but not blocking" boundary; whether this is actually smooth for a real user depends on hardware. The e2e test asserts no task ≥ 1000 ms, which is the technical proxy.

4. **NEW (02-04): Visual spacing of the co-rendered `<Dropzone>` in `done`/`duplicate` branches.** The Dropzone now appears below `<ResultsView>` in the cached-dataset views, instead of being the only content. Visual review should confirm the layout still reads as one family and the Dropzone doesn't feel like an afterthought (it shares the same `DROPZONE_PROMPT` copy as the empty-state view).

### Gap Audit — Previous Verification's 2 Gaps

| Previous gap | Disposition | Evidence |
|--------------|-------------|----------|
| Gap #1 — Replace-on-drop UX layer unreachable (D-13) | CLOSED | `App.svelte:181-186` and `199-204` co-render `<Dropzone>` in `done`/`duplicate` branches. `persistent-dataset.spec.ts` test (d) now passes (previously timed out at `getByTestId('dropzone')`); test (g) now passes (previously timed out for the same reason). |
| SC3 second half — replace requires the UI affordance | CLOSED | `App.svelte:205-223` keeps `<ResultsView>` mounted during replace-on-drop confirmation. Test (d) step 4 proves full replace: drop `buildRenamedRootExport()` → ConfirmPanel → confirm → `account-heading` flips to `RENAMED_ACCOUNT_ROOT`, `summary-line` shows `formatSummary(RENAMED_EXPECTED_COUNTS)`. |

---

## VERIFICATION PASSED

**Score breakdown:**
- **26/26 plan-02 must-haves verified** (was 24/26 — D-13 and SC3 second half now fully verified by 02-04 render-tree changes)
- **4/4 ROADMAP success criteria met** (was 3/4 — SC3 now fully met end-to-end)
- **6/6 requirement IDs satisfied** (was 5/6 — IMPORT-06 now fully satisfied: hash-dedup + replace-on-drop UX layer + dataset atomicity + UI confirmation)
- **8/8 e2e tests pass** in `persistent-dataset.spec.ts` (tests (d) and (g) were previously failing — now green)
- **202/202 unit tests pass** across 11 test files
- **Lint, check, build all exit 0**

**Artifacts verified:**
- `src/App.svelte` (modified by 02-04: 3 render-tree changes — co-render Dropzone in done/duplicate, new replace-pending branch)
- `src/lib/components/ConfirmPanel.svelte` (new in 02-03)
- `src/lib/components/ResultsView.svelte` (modified by 02-02 timestamp + 02-03 button restyle)
- `src/lib/components/Dropzone.svelte` (unchanged — line 90 `data-testid="dropzone"` confirmed)
- `src/lib/components/CategoryBadge.svelte`, `FailureBanner.svelte`
- `src/lib/ingest-client.ts`, `worker-client.svelte.ts`, `ui-copy.ts`
- `src/lib/worker/{hash,mojibake,csv-parse,db,classify,ingest.worker}.ts`
- `src/lib/types/worker-messages.ts`
- `tests/fixtures/export-fixtures.ts`
- 7 unit test files + 3 e2e test files
- 4 plan files + 4 summary files

**Commit on branch `gsd/phase-02-defensive-parsing-persistent-dataset`:** `c62015f feat(02-04): expose dropzone alongside ResultsView for replace-on-drop UX (closes D-13)` — atomic single-file render-tree change + planning tracking.

The Phase 02 goal is achieved: the worker parses every supported CSV defensively, persists the result in IndexedDB as a single active dataset, the dataset survives reloads, identical re-uploads are skipped (hash-dedup), different zips fully replace the previous dataset (now end-to-end reachable through the UI), and the user can wipe the cache at any time via the persistent "Clear my cached data" control (or Start Over, both routed through a shared ConfirmPanel with no native browser dialogs).

---

_Verified: 2026-09-29T06:23:38Z_
_Verifier: Claude (gsd-verifier) — re-verification after gap closure by plan 02-04_