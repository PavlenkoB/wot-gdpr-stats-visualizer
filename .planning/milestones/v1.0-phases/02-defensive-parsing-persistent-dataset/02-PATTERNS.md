# Phase 2: Defensive Parsing & Persistent Dataset - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 14 (7 new, 7 modified)
**Analogs found:** 14 / 14 (all in-repo; no external-library-only files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/worker/hash.ts` (NEW) | utility | transform | `src/lib/worker/zip-paths.ts` | role-match (pure worker utility, single exported fn) |
| `src/lib/worker/mojibake.ts` (NEW) | utility | transform | `src/lib/worker/zip-paths.ts` | role-match (pure, unit-testable, worker-local) |
| `src/lib/worker/csv-parse.ts` (NEW) | utility/service | transform, CRUD-adjacent | `src/lib/worker/classify.ts` | role-match (pure functions over untrusted string input, defensive normalization) |
| `src/lib/worker/db.ts` (NEW) | model/store | CRUD | `src/lib/worker/categories.ts` (data-shape module) + Dexie docs (no in-repo Dexie precedent) | partial — no existing Dexie analog in repo; structural precedent only |
| `src/lib/worker/ingest.worker.ts` (MODIFIED) | controller (worker entry) | event-driven, request-response | itself (existing file) | exact — extend, do not replace |
| `src/lib/types/worker-messages.ts` (MODIFIED) | config/contract | request-response | itself (existing file) | exact |
| `src/lib/worker-client.svelte.ts` (MODIFIED) | store/state-machine | event-driven, request-response | itself (existing file) | exact |
| `src/lib/ingest-client.ts` (MODIFIED, singleton wiring) | provider | request-response | itself (existing file) | exact |
| `src/lib/ui-copy.ts` (MODIFIED) | utility | transform | itself (existing file) | exact |
| `src/lib/components/ResultsView.svelte` (MODIFIED) | component | request-response (props render) | itself (existing file) | exact |
| `src/lib/components/CategoryBadge.svelte` (MODIFIED) | component | request-response (props render) | itself (existing file) | exact |
| `src/lib/components/ConfirmPanel.svelte` (NEW) | component | request-response | `src/lib/components/FailureBanner.svelte` | exact (same family: single-purpose alert-style panel, `role`, `data-testid`, scoped style block, no off-device links) |
| `tests/fixtures/export-fixtures.ts` (MODIFIED — new builders) | test fixture/utility | batch | itself (existing file) | exact |
| `tests/unit/{hash,mojibake,csv-parse,db}.test.ts` (NEW) | test | transform/CRUD | `tests/unit/classify.test.ts`, `tests/unit/zip-paths.test.ts` | exact (pure-function unit test style) |

## Pattern Assignments

### `src/lib/worker/hash.ts` (utility, transform)

**Analog:** `src/lib/worker/zip-paths.ts` (full file already read above)

**Imports pattern** (zip-paths.ts lines 1-1):
```typescript
import { unzipSync } from 'fflate';
```
For `hash.ts`, no import is needed — `crypto.subtle` is a Worker-global. Follow the same "no import, pure function, single exported symbol" shape.

**Core pattern** (zip-paths.ts lines 25-34 — the shape to mirror):
```typescript
export function listEntryPaths(bytes: Uint8Array): string[] {
  const names: string[] = [];
  unzipSync(bytes, {
    filter(info) {
      names.push(info.name);
      return false; // never inflate — path-only enumeration (zip-bomb safe)
    },
  });
  return names;
}
```
Apply the same "one exported pure async function, heavily commented on WHY, operates on the already-in-memory `Uint8Array`" shape:
```typescript
export async function digestFile(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
```
(Exact implementation already given in RESEARCH.md Pattern 1 — copy verbatim, only the doc-comment needs rewriting to this file's convention.)

**Error handling pattern:** None needed inside the function — like `listEntryPaths`, any throw (e.g. unsupported `SubtleCrypto`) is expected to propagate up into the worker's single top-level `try/catch` in `ingest.worker.ts` (see below). Do not add a local try/catch here — matches the project's single-owner-of-error-handling convention.

**Testing pattern (`tests/unit/hash.test.ts`):** Mirror `tests/unit/zip-paths.test.ts` — plain Vitest `describe`/`it`, feed small `Uint8Array` fixtures, assert exact hex output and that identical bytes produce identical hashes / different bytes produce different hashes.

---

### `src/lib/worker/mojibake.ts` (utility, transform)

**Analog:** `src/lib/worker/zip-paths.ts` (structure) + `src/lib/worker/classify.ts` (defensive-normalization doc-comment style, lines 4-21)

**Core pattern to copy** — RESEARCH.md's Pattern 2 gives the exact implementation; follow `classify.ts`'s heavy-comment convention (see `normalizeEntryPath`, lines 37-53) for documenting the "never touch already-correct text" invariant:
```typescript
const strictUtf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function fixMojibake(value: string): string {
  if (value.length === 0) return value;
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0xff) return value;
    bytes[i] = code;
  }
  try {
    return strictUtf8Decoder.decode(bytes);
  } catch {
    return value;
  }
}
```

**Testing pattern:** Mirror `tests/unit/classify.test.ts`'s style of pure-function table-driven assertions (normalize/roundtrip cases, including the "leave already-correct Cyrillic untouched" case flagged as Assumption A2 in RESEARCH.md).

---

### `src/lib/worker/csv-parse.ts` (utility/service, transform)

**Analog:** `src/lib/worker/classify.ts` — same shape: pure functions over untrusted string/array input, with an internal `prepare()`-style normalization helper and a public function returning a structured outcome type.

**Pattern to copy — the "outcome type, not exceptions" convention** (classify.ts lines 27-31):
```typescript
export type UnrecognizedReason = 'empty-archive' | 'no-single-root' | ...;
export type AnalyzeOutcome = { ok: true; result: ClassifyResult } | { ok: false; reason: UnrecognizedReason };
```
For `csv-parse.ts`, follow the same discriminated-result convention for per-row skip accounting instead of throwing — e.g. a `ParsedFile { rows: RowRecord[]; skippedCount: number }` return shape, with `console.error` for the skip log (matching D-03 and the project's existing `console.error` convention seen in `ingest.worker.ts` line 42 and `worker-client.svelte.ts` line 103).

**Import pattern to add:**
```typescript
import Papa from 'papaparse';
import { fixMojibake } from './mojibake.ts';
```

**Error handling / skip pattern** — per RESEARCH.md Anti-Patterns and Pitfall 3: do NOT treat PapaParse's `results.errors` (ragged columns) as fatal; only count/skip a row after the app's own domain-level validation rejects it post-parse. Route the per-row `console.error` through the same style as `ingest.worker.ts`'s existing catch block (line 42: `console.error('[ingest.worker] ingest failed', err);`) — use a similarly bracket-tagged prefix, e.g. `console.error('[csv-parse] skipped row', ...)`.

**Testing pattern:** Mirror `tests/unit/classify.test.ts` (pure function, fixture strings in, structured result out) — new file `tests/unit/csv-parse.test.ts` should test CRLF/bare-CR tolerance, missing/extra columns, and skip-count accounting per RESEARCH.md's Validation Architecture table.

---

### `src/lib/worker/db.ts` (model/store, CRUD)

**Analog:** No in-repo Dexie precedent exists (this is the first phase introducing persistence). Structural analog is `src/lib/worker/categories.ts` for "small, declarative, single-purpose data-shape module with named exported constants," but the actual Dexie API usage must come from RESEARCH.md's Pattern 3 (chunked transactional bulkPut) and Architecture Patterns' recommended structure — copy those verbatim as the load-bearing code:

```typescript
// Source: RESEARCH.md Architecture Patterns, Pattern 3
async function writeDataset(db: AppDb, hash: string, categories: CategoryEntry[], rows: RowRecord[]): Promise<void> {
  const CHUNK = 1000;
  await db.transaction('rw', db.rows, db.meta, async () => {
    await db.rows.clear();
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db.rows.bulkPut(rows.slice(i, i + CHUNK));
    }
    await db.meta.put({ id: 'active', hash, importedAt: new Date().toISOString(), categories });
  });
}
```

**Critical constraint (from RESEARCH.md Common Pitfalls / Anti-Patterns):** `db.ts` must be imported ONLY from `ingest.worker.ts` — never from any main-thread file (`App.svelte`, `ingest-client.ts`, `worker-client.svelte.ts`). All main-thread reads/deletes go through new worker message types (`check-cache`, `clear-data`), not a second Dexie instance. This is the single most important convention to enforce when planning this file's consumers.

**Testing pattern:** New `tests/unit/db.test.ts` needs `import 'fake-indexeddb/auto'` before any Dexie import (see `tests/unit/setup.ts` for where the project's existing global test setup lives — extend it, matching its existing convention of established Node-environment shims).

---

### `src/lib/worker/ingest.worker.ts` (controller, event-driven/request-response — MODIFY, not replace)

**Analog:** itself. Full current file already in context (54 lines). Extend the existing linear `try { ... } catch { ... }` shape — do not restructure it.

**Existing message-dispatch pattern to preserve** (lines 8-11):
```typescript
scope.onmessage = async (event: MessageEvent<IngestRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== 'ingest') return;
  const { jobId, file } = msg;
```
New request types (`check-cache`, `clear-data`) must be added as additional `if (msg.type === '...')` branches (or a switch) at the top of this handler, each with its own try/catch posting `{ type: 'error', jobId, detail }` on failure — mirroring the existing single-catch convention (lines 40-48).

**Existing stage-progression pattern to extend** (lines 16-28):
```typescript
scope.postMessage({ type: 'stage', jobId, stage: 'unzipping' } satisfies IngestResponse);
const entryNames = listEntryPaths(bytes);
scope.postMessage({ type: 'stage', jobId, stage: 'classifying' } satisfies IngestResponse);
```
Insert a `'hashing'` stage before this block (before `listEntryPaths` is ever called — this is the SC3 gate) and a `'parsing'`/`'writing'` stage after `classifying`, using the identical `scope.postMessage({...} satisfies IngestResponse)` idiom throughout — every message must keep the `satisfies IngestResponse` type-check.

**Error handling pattern to preserve exactly** (lines 40-48):
```typescript
} catch (err) {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error('[ingest.worker] ingest failed', err);
  scope.postMessage({ type: 'error', jobId, detail: `${e.name}: ${e.message}` } satisfies IngestResponse);
}
```
This is the ONE error path for the worker side — new failure sources (Dexie write errors, quota errors per RESEARCH.md Pitfall 2) must funnel into this same catch, not a new parallel error path.

---

### `src/lib/types/worker-messages.ts` (config/contract — MODIFY)

**Analog:** itself. Full current file already in context (42 lines).

**Pattern to copy:** RESEARCH.md's Architecture Patterns Pattern 4 gives the exact extended contract — copy verbatim, preserving every existing field name/shape (additive only, per RESEARCH.md's "no behavior change to Phase 1's existing types" note):
```typescript
export type IngestStage = 'hashing' | 'unzipping' | 'classifying' | 'parsing' | 'writing';
export interface ParsingProgress { category: string; categoryIndex: number; categoryTotal: number; }
export interface CategoryEntry { name: string; status: CategoryStatus; fileCount: number; rowCount: number; skippedRowCount: number; }
export interface ClassifyResult { accountRoot: string; categories: CategoryEntry[]; counts: Record<CategoryStatus, number>; importedAt: string; }
export type IngestRequest =
  | { type: 'ingest'; jobId: number; file: File }
  | { type: 'check-cache'; jobId: number }
  | { type: 'clear-data'; jobId: number };
export type IngestResponse =
  | { type: 'ready' }
  | { type: 'stage'; jobId: number; stage: IngestStage; progress?: ParsingProgress }
  | { type: 'duplicate'; jobId: number; result: ClassifyResult }
  | { type: 'done'; jobId: number; result: ClassifyResult }
  | { type: 'cache-status'; jobId: number; cached: ClassifyResult | null }
  | { type: 'cleared'; jobId: number }
  | { type: 'error'; jobId: number; detail: string };
```
Keep `WorkerLike`/`WorkerScopeLike` interfaces (existing lines 30-41) unchanged in shape — they already reference `IngestRequest`/`IngestResponse` generically so no edit needed there.

---

### `src/lib/worker-client.svelte.ts` (store/state-machine — MODIFY)

**Analog:** itself. Full current file already in context (311 lines) — this is the richest analog in the repo for the confirm-pending / duplicate / auto-load-from-cache states this phase adds.

**Single-failure-path convention to preserve** (`#fail`, lines 259-265):
```typescript
#fail(detail: string): void {
  console.error('[ingest] import failed:', detail);
  this.state = 'error';
  this.stage = null;
  this.result = null;
  this.errorMessage = GENERIC_FAILURE_MESSAGE;
}
```
New failure sources this phase introduces (parse errors, Dexie write/quota errors, arriving as `{type:'error'}` messages) already route through this unchanged — no new error path needed, confirming RESEARCH.md's "single worker-error path" recommendation (D-06).

**State machine extension pattern** — `IngestViewState` (line 11) is `'idle' | 'processing' | 'done' | 'error'`; extend to add `'checking-cache' | 'duplicate' | 'confirm-pending'` following the exact same flat-union style. The `#handle()` method's per-message-type `if` blocks (lines 207-245) are the template for adding `cache-status`, `duplicate`, and `cleared` handlers — each existing branch already follows the "state guard + jobId guard + mutate state" shape:
```typescript
if (msg.type === 'done') {
  if (this.state !== 'processing') return;
  if (msg.jobId !== this.#jobId) return;
  const captured = msg.result;
  this.#scheduleSettle(() => { this.state = 'done'; this.stage = null; this.result = captured; this.errorMessage = null; });
  return;
}
```

**Settle-floor pattern to reuse unmodified:** `#scheduleSettle`/`MIN_PROCESSING_MS` (lines 26, 285-302) — the "visible processing floor" should also gate the new `'duplicate'` terminal outcome (D-12's banner) the same way `'done'` and `'error'` are gated today; do not invent a second timing mechanism.

**Busy-guard convention to extend for confirm-pending:** `submitFiles()`'s numbered guard sequence (lines 148-190, especially guard 2 at lines 157-163: `if (this.state === 'done') { ...; return false; }`) is the template for the new D-13 guard: a drop while `state === 'done'` (cached dataset present) must transition to `'confirm-pending'` instead of being silently ignored — same guard-list style, new branch.

---

### `src/lib/ingest-client.ts` (provider — MODIFY, likely minimal)

**Analog:** itself (singleton wiring file, not fully read but referenced by App.svelte's `import { ingestClient } from './lib/ingest-client.ts'`). Follow existing module-singleton pattern; add a `checkCache()` / `clearData()` public method that posts the new request types, mirroring `submitFiles()`'s `postMessage` call shape in `worker-client.svelte.ts` line 203: `this.#worker.postMessage(message);`.

---

### `src/lib/ui-copy.ts` (utility — MODIFY)

**Analog:** itself. Full current file already in context (78 lines) — this is the single source of truth for all UI strings; every new D-11/D-12/D-20/D-21 copy string MUST be added here, not inline in components.

**Pattern to copy — `STAGE_TEXT` extension** (lines 27-30):
```typescript
export const STAGE_TEXT: Record<IngestStage, string> = {
  unzipping: 'Unzipping...',
  classifying: 'Classifying folders...',
};
```
Extend with `hashing`, `parsing`, `writing` keys — TypeScript's exhaustiveness check on `Record<IngestStage, string>` will force this (as the file's own comment at line 22-25 notes: "TypeScript catches a missing key at the call site"). For the per-category parsing text (D-11, `"Parsing Player_statistics (3/8)..."`), add a new function (not a static map entry, since it's parameterized) following the `formatSummary`/`formatFileCount` convention (lines 44-56) — small pure formatter, JSDoc explaining the exact literal format Playwright will assert against.

**Pattern to copy — new label constants** (`START_OVER_LABEL`, line 78):
```typescript
export const START_OVER_LABEL = 'Start over';
```
Add `CLEAR_DATA_LABEL`, `CONFIRM_REPLACE_MESSAGE`, `CONFIRM_CLEAR_MESSAGE`, `DUPLICATE_BANNER_MESSAGE`, `CLEARED_ACK_MESSAGE`, `IMPORTED_ON_LABEL` (formatter, since it embeds a date) as siblings, each with the same one-line JSDoc-with-D-reference convention seen throughout this file (e.g. lines 74-77 referencing D-13).

**Row-count badge formatter (D-05)** — extend/add a sibling to `formatFileCount` (lines 54-56):
```typescript
export function formatFileCount(n: number): string {
  return n === 1 ? '1 file' : `${n} files`;
}
```
New `formatRowCount(n: number): string` follows identically; combine both into the badge text per the exact example in CONTEXT.md: `"Activity_history — 3 files, 1,204 rows"`.

---

### `src/lib/components/ResultsView.svelte` (component — MODIFY)

**Analog:** itself. Full current file already in context (105 lines).

**Pattern to copy — the ordered-list-of-badges + summary-line shape** (lines 30-46) stays structurally identical; add the imported-at timestamp as a new line between the summary (`data-testid="summary-line"`) and the badge list, following the same `<p>` + `data-testid` + `ui-copy.ts` formatter convention as the summary line (line 35: `<p class="summary" data-testid="summary-line">{formatSummary(result.counts)}</p>`).

**Document-order comment convention** (lines 14-28) — this file explicitly documents WHY element order matters for Playwright bounding-box assertions; when inserting the new timestamp line and the persistent clear-data control, update this comment block to keep the numbered list accurate — this is a load-bearing convention specific to this file, not optional.

---

### `src/lib/components/CategoryBadge.svelte` (component — MODIFY)

**Analog:** itself. Full current file already in context (73 lines).

**Props/rendering pattern to extend** (lines 5-9, 23-27):
```typescript
interface Props { entry: CategoryEntry; }
...
<li data-testid="category-badge" data-status={entry.status} class="badge badge-{entry.status}">
  <span class="badge-name">{entry.name}</span>
  <span class="badge-sep"> — </span>
  <span class="badge-count">{formatFileCount(entry.fileCount)}</span>
</li>
```
Since `CategoryEntry` now carries `rowCount`/`skippedRowCount` (per the extended contract above), extend the badge markup with additional `<span>` elements following the identical `badge-sep` + `ui-copy.ts`-formatter pattern — e.g. a `badge-rows` span using a new `formatRowCount`, and conditionally (only when `skippedRowCount > 0`, per D-04 "shown per affected category") a `badge-skipped` span. Preserve the "reusable, free of app-state coupling" doc comment (lines 18-22) — do not import `worker-client`/`ingest-client` here.

---

### `src/lib/components/ConfirmPanel.svelte` (component — NEW)

**Analog:** `src/lib/components/FailureBanner.svelte` (full file already in context, 28 lines) — closest existing single-purpose alert-style panel in the same component family.

**Pattern to copy — the whole file shape:**
```svelte
<script lang="ts">
  interface Props {
    message: string;
  }
  let { message }: Props = $props();
</script>

<div role="alert" data-testid="failure-banner" class="failure-banner">{message}</div>

<style>
  .failure-banner {
    margin: 0 0 16px;
    padding: 12px 16px;
    border: 1px solid #c5221f;
    border-radius: 6px;
    background: #fce8e6;
    color: #8a1c17;
    font-size: 16px;
    line-height: 1.5;
  }
</style>
```
`ConfirmPanel.svelte` should follow this exact shape but with `role="alertdialog"` (semantically correct for a confirm/cancel panel, vs. `FailureBanner`'s pure `role="alert"`), a `data-testid="confirm-panel"`, and two buttons (confirm/cancel) styled after `ResultsView.svelte`'s existing `.start-over` button (lines 81-104: border/background/hover/focus-visible pattern) — reuse that button styling verbatim for consistency (D-14 explicitly requires visual consistency with `FailureBanner`). Props: `message: string`, `onconfirm: () => void`, `oncancel: () => void` — mirroring `ResultsView`'s `onstartover: () => void` callback-prop convention (line 8).

**Shared-copy convention (D-22):** Both "Start over" and "Clear my cached data" confirms must pass the identical `message` string sourced from a single `ui-copy.ts` constant (e.g. `CONFIRM_CLEAR_MESSAGE`) — do not let `App.svelte` construct different strings per caller.

---

### `tests/fixtures/export-fixtures.ts` (test fixture/utility — MODIFY, add builders)

**Analog:** itself (existing `buildSampleExport`, `buildLargeExport` builders referenced in RESEARCH.md's Reusable Assets and Wave 0 Gaps sections). Follow the existing builder-function naming/shape convention (`buildXExport(...)` returning zip bytes or entry lists) when adding the new mojibake/Cyrillic-content fixture and the "10x sample size with realistic row content" fixture — read the file directly during planning/execution to copy the exact builder signature (not reproduced here since it was not in required-reading scope; planner should have an execution-time task read it before writing new builders).

---

### `tests/unit/*.test.ts` (test — NEW: hash, mojibake, csv-parse, db)

**Analog:** `tests/unit/classify.test.ts` and `tests/unit/zip-paths.test.ts` — both exist as pure-function, fixture-driven Vitest suites for worker-local pure modules. Copy their `describe`/`it` structure and assertion style (table-driven where the function is a pure transform, e.g. `mojibake.test.ts`, `hash.test.ts`); `db.test.ts` additionally needs the `fake-indexeddb/auto` import ordering constraint noted above.

## Shared Patterns

### Single worker-error path
**Source:** `src/lib/worker/ingest.worker.ts` lines 40-48 (worker-side) and `src/lib/worker-client.svelte.ts` `#fail()` lines 259-265 (main-thread side)
**Apply to:** `db.ts` (Dexie/quota errors), `csv-parse.ts` (unexpected parse exceptions, not row-level skips), `hash.ts` — every new failure source funnels into the existing single catch/`#fail` pair. Do not add a second error-reporting mechanism.

### `satisfies IngestResponse` / `satisfies IngestRequest` type discipline
**Source:** `src/lib/worker/ingest.worker.ts` lines 16-20, 24-28, 35-39
**Apply to:** every new `postMessage` call added to `ingest.worker.ts` for the new stages/response types — keeps the discriminated union exhaustive and catches drift between `worker-messages.ts` and the worker implementation at compile time.

### `ui-copy.ts` as sole string source
**Source:** `src/lib/ui-copy.ts` (whole file)
**Apply to:** `ResultsView.svelte`, `CategoryBadge.svelte`, `ConfirmPanel.svelte`, `App.svelte` — no new UI string should be written inline in a `.svelte` file; add a constant or formatter function to `ui-copy.ts` and import it, matching every existing component's pattern.

### `data-testid` + Playwright document-order discipline
**Source:** `src/lib/components/ResultsView.svelte` lines 14-28 (doc comment), `FailureBanner.svelte` line 14 (`data-testid="failure-banner"`), `CategoryBadge.svelte` line 23 (`data-testid="category-badge"`)
**Apply to:** every new element in `ResultsView.svelte` (timestamp, skip counts) and the new `ConfirmPanel.svelte` — add a `data-testid` and, if it affects layout order, update the file's own document-order comment block.

### Console-only defensive-skip logging (D-03/D-05)
**Source:** `src/lib/worker/ingest.worker.ts` line 42 (`console.error('[ingest.worker] ingest failed', err)`); `src/lib/worker-client.svelte.ts` line 103 (`console.error('[ingest] worker error:', ...)`) and line 260 (`console.error('[ingest] import failed:', detail)`)
**Apply to:** `csv-parse.ts`'s per-row skip logging — use the same `[bracket-tag] short-message, detail` console.error shape, e.g. `console.error('[csv-parse] skipped row', { category, sourceFile, rowIndex, reason });`.

### Sole-owner module boundary (new convention this phase introduces)
**Source:** RESEARCH.md Common Pitfalls Pitfall 1 + Architectural Responsibility Map — no in-repo precedent, but the project's existing worker/main-thread split (worker owns unzip/classify; main thread owns UI state) is the precedent to extend, not violate.
**Apply to:** `db.ts` must only ever be imported from `ingest.worker.ts`. Enforce via the same discipline `zip-paths.ts`/`classify.ts` already show (pure, worker-local, no DOM/App imports) — consider a lint-guard test similar to `tests/unit/lint-guards.test.ts` (existing file) to assert `db.ts` has no main-thread importers.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/worker/db.ts` (Dexie schema/query logic itself) | model/store | CRUD | No Dexie usage exists anywhere in the repo yet — RESEARCH.md's Pattern 3 code block is the only available concrete reference; planner should treat RESEARCH.md as primary source for this file's core logic, and this PATTERNS.md's structural/boundary guidance (sole-owner rule, chunking) as the supplementary convention layer. |

## Metadata

**Analog search scope:** `src/lib/**`, `src/App.svelte`, `tests/unit/**`, `tests/fixtures/**` (full repo `src/` and `tests/` tree — small enough to read in full rather than sample)
**Files scanned:** 14 source files + 7 test files (all files in the repo's `src/` and `tests/` trees as of this phase)
**Pattern extraction date:** 2026-09-28
