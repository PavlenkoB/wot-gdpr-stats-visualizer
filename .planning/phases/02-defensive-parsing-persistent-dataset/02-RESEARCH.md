# Phase 2: Defensive Parsing & Persistent Dataset - Research

**Researched:** 2026-09-28
**Domain:** Client-side CSV parsing (PapaParse) + IndexedDB persistence (Dexie 4) inside an existing Web Worker pipeline
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Parse scope by tier**
- **D-01:** Every detected category folder — supported, known-deferred, and unknown alike — gets full CSV parsing into IndexedDB in Phase 2, not just the four "supported" folders (Activity_history, Player_statistics, User_Info, Payment_history). — Reversibility: costly — narrowing later means dropping already-written IndexedDB tables/rows; widening later means re-parsing from scratch since raw zip bytes are not retained after import.
- **D-02 (Claude's Discretion, recommended path):** For known-deferred/unknown folders with no locked schema, store full row content in a generic, header-keyed (untyped) shape rather than row-counts-only.
- **D-03:** A CSV row malformed beyond missing/extra columns (unparseable date, garbage bytes, etc.) is skipped individually; the rest of that file/category/export continues importing normally. Skip is logged to `console.error`.
- **D-04:** Skipped-row counts are shown on screen per affected category (not console-only) — e.g. "N rows skipped" alongside that category's badge.
- **D-05:** Category badges show BOTH the Phase 1 file count and the new row count, e.g. `"Activity_history — 3 files, 1,204 rows"` — neither replaces the other.
- **D-06:** No size/row cap on import. Relies on `navigator.storage.persist()` and browser IndexedDB quota; a quota failure surfaces through the existing single worker-error path (no new size-based rejection logic).

**Return-visit experience**
- **D-07:** On page load, if IndexedDB already holds a cached dataset, the app auto-loads straight to the per-category results view (badges + row counts) — no drop, no click required.
- **D-08:** While the IndexedDB existence check resolves, a brief loading spinner covers the gap before swapping to either the results view or the empty dropzone.
- **D-09:** Per-category skipped-row counts (D-04) are persisted in IndexedDB alongside row counts and shown every time the results view renders, not just immediately after the import that produced them.
- **D-10:** The results view shows an "Imported on [date]" timestamp, stored alongside the dataset.

**Import UX for drops**
- **D-11:** Live progress text during import names the current category being parsed, e.g. `"Parsing Player_statistics (3/8)..."` — extends Phase 1's stage-message contract (01-CONTEXT.md D-09) with per-category detail.
- **D-12:** Re-dropping the identical (hash-matched) zip shows a distinct "already loaded" banner (e.g. "This export is already loaded — skipping re-import") before any unzip/parse work starts, then the existing results view is shown/stays shown.
- **D-13:** Dropping a DIFFERENT zip while a dataset is already cached does NOT silently replace it. An in-app inline confirm ("Replace your current dataset with this new import?") is shown first — the drop is paused, not auto-actioned. Supersedes Phase 1's D-14.
- **D-14:** The confirm step for both replace-on-drop and the destructive controls is a styled in-app panel (consistent with `FailureBanner`), never a native browser `confirm()` dialog.
- **D-15:** "Start over" now also clears the cached IndexedDB dataset, not just the view state.
- **D-16:** Because "Start over" is now destructive, clicking it goes through the same in-app inline confirm pattern as the replace-on-drop warning (D-13/D-14).

**Clear-data control**
- **D-17:** "Clear my cached data" (DATA-02) is a SEPARATE, distinct control from "Start over" — not the same button relabeled. Both trigger the identical underlying clear-with-confirm action. — Reversibility: costly — two distinct entry points (placement, event wiring, possibly distinct copy) rather than one.
- **D-18:** The dedicated "Clear my cached data" control is a persistent header/footer element, visible on both the empty dropzone and the results view.
- **D-19:** The persistent control is hidden entirely (not shown-disabled) when there is no cached dataset.
- **D-20:** After confirming a clear (via either button), a brief acknowledgment message is shown (e.g. "Cached data cleared") before/alongside the empty dropzone — not a silent transition.
- **D-21:** The confirm panel's copy spells out the consequence explicitly, e.g. "This will permanently delete your cached export data. You'll need to re-upload the zip to view it again."
- **D-22:** "Start over" and "Clear my cached data" show the exact same confirm copy and use the same confirm component.

### Claude's Discretion
- Row storage shape for known-deferred/unknown folders (D-02): generic header-keyed rows recommended over row-counts-only, per the rationale above.
- Exact IndexedDB/Dexie schema (table-per-known-CSV vs. a more generic shape) — Dexie 4 + bulkPut + zip-hash dedup + `navigator.storage.persist()` are already locked; table/schema layout is an implementation detail for research/planning.
- Whether the zip hash (for duplicate detection) is computed from raw file bytes or from unzipped content — must land before any unzip work per success criterion 3, but the exact hashing approach wasn't discussed.
- Visual styling (icon vs. text-only for the persistent clear-data control, exact spinner/progress-text typography) — no design system referenced yet.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 2 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-01 | Drag-and-drop zip unzipped + parsed entirely client-side (fflate + PapaParse, single long-lived worker) | Architecture Patterns (system diagram, Pattern 1); Standard Stack (PapaParse locked/verified); Don't Hand-Roll |
| IMPORT-03 | CSV parsing tolerates unexpected/missing columns and mixed line terminators (CRLF, bare-CR) | Summary (PapaParse `header:true` behavior); Common Pitfalls (Pitfall 3); Anti-Patterns ("don't treat FieldMismatch as fatal") |
| IMPORT-04 | Double-UTF8-encoded (mojibake) text fields corrected on parse | Architecture Patterns Pattern 2 (`fixMojibake`); Assumptions Log A2; Don't Hand-Roll |
| IMPORT-06 | New zip replaces current dataset; identical re-upload detected via hash and skipped | Architecture Patterns (system diagram, Pattern 1); Open Question 2 (schema indexing) |
| DATA-01 | Parsed data cached in IndexedDB (Dexie 4, bulkPut writes), so re-upload isn't needed on repeat visits | Architecture Patterns Pattern 3 (chunked transactional bulkPut); Standard Stack (Dexie locked/verified); Package Legitimacy Audit (dexie SUS-false-positive) |
| DATA-02 | Discoverable "clear my cached data" control wipes the IndexedDB cache, shipped alongside caching itself | Architectural Responsibility Map (clear-data row); Common Pitfalls Pitfall 1 (single-owner Dexie); Security Domain (unencrypted-at-rest rationale) |

</phase_requirements>

## Summary

Phase 2 extends the Phase 1 worker (hash-free, unzip-list-only, classify-only) into a full pipeline: hash → check-cache → unzip → parse every category's CSVs defensively → correct mojibake → write to IndexedDB as a single active dataset → report done/duplicate. The two libraries this phase adds (PapaParse 5.7.0, Dexie 4.4.6) are already locked in `AGENTS.md`'s Key Decisions table and confirmed current against the npm registry this session. No new runtime dependency is required for hashing (native `crypto.subtle.digest`) or for the mojibake fix (hand-rolled, as AGENTS.md already specifies) — both avoid adding an npm package to a project whose constraint is dependency minimalism.

The riskiest architectural choice this phase makes is **where Dexie lives**. The community-documented failure mode for Dexie is opening the *same* database from *both* a worker and the main thread (module duplication, "database won't open" bugs). This phase's existing constraints already point away from that trap: the worker already owns unzip/parse and SC1 requires "all unzip, parse, and write work" to run there, so the natural, bug-avoiding design is for **the worker to be the sole owner of the Dexie connection** — main-thread reads (cache-check on page load, clear-data) become new worker request/response message types rather than a second Dexie instance. The one documented exception is `navigator.storage.persist()`, which per the WebIDL is `[Exposed=Window]` only and cannot be called from the worker at all — that call has to live on the main thread, decoupled from the per-import critical path.

For the CSV defensive-parsing requirement (IMPORT-03), PapaParse's `header: true` mode already does most of the work: missing trailing fields become `undefined`/`null` keys, extra fields land in a `__parsed_extra` array, and a field-count mismatch is a non-fatal entry in `results.errors` rather than a thrown exception ("mismatched fields won't break parsing" per PapaParse's own docs). For the Dexie schema (Claude's Discretion per CONTEXT.md), this research recommends **one generic, header-keyed row table for every category** — known and unknown alike — rather than a typed table per known CSV, because D-01/D-02 already require every category (not just the four "supported" ones) to store full row content generically, and because IndexedDB itself is schemaless at the object level (Dexie's schema only governs the primary key and declared indexes, not the row shape).

**Primary recommendation:** Keep Dexie exclusively inside `ingest.worker.ts` behind new request/response message types (`check-cache`, `clear-data`, plus a `duplicate` response distinct from `done`); hash the already-in-memory file bytes with `crypto.subtle.digest('SHA-256', ...)` before the existing `listEntryPaths`/`unzipSync` call; store every category's rows in one generic Dexie table keyed by category + source file; and call `navigator.storage.persist()` once from the main thread, not from the worker.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hash-before-unzip dedup check (IMPORT-06) | Browser/Client — Worker | — | Must happen inside the same worker that already reads the file bytes; SC3 requires the skip to happen "before any unzip or parse work starts," which is only checkable where the bytes and the DB connection are both present |
| CSV parsing + defensive tolerance (IMPORT-01, IMPORT-03) | Browser/Client — Worker | — | Already locked: `Papa.parse({ worker: false })` runs inside the existing ingest worker, never a nested worker |
| Mojibake correction (IMPORT-04) | Browser/Client — Worker | — | Applied per-field during/after parse, before the row is written to Dexie — correcting after storage would mean a second full-table rewrite |
| Dexie writes / single active dataset (DATA-01, IMPORT-06) | Browser/Client — Worker | — | Sole owner to avoid the documented Dexie dual-context (worker + main thread) bug class; also required by SC1's "all... write work ran in the worker" |
| Return-visit cache check (D-07/D-08) | Browser/Client — Worker (read), Main thread (render decision) | — | The read must go through the same Dexie connection as writes (see above); the worker answers a new `check-cache` request, main thread only decides what to render |
| "Clear my cached data" / "Start over" (DATA-02) | Browser/Client — Worker (delete), Main thread (confirm UI) | — | Delete must go through the same Dexie connection; confirm panel and acknowledgment message are pure main-thread UI state |
| `navigator.storage.persist()` (D-06 quota mitigation) | Browser/Client — Main thread | — | Per WebIDL, `persist()` is `[Exposed=Window]` only — cannot be called from a Worker at all, unlike `persisted()`/`estimate()` which can |
| Progress reporting per category (D-11) | Browser/Client — Worker (source), Main thread (render) | — | Extends the existing `stage` message Phase 1 already designed as the extension point (01-CONTEXT.md D-09) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PapaParse | ^5.7.0 [VERIFIED: npm registry] | CSV parsing inside the worker, `worker: false` | Already locked in AGENTS.md/PROJECT.md; confirmed current (`npm view papaparse version` → `5.7.0`, published 2026-08-24) |
| @types/papaparse | ^5.5.2 [VERIFIED: npm registry] | TS types (PapaParse ships untyped) | Already locked in AGENTS.md; confirmed current (`npm view @types/papaparse version` → `5.5.2`) |
| Dexie | ^4.4.6 [VERIFIED: npm registry] | IndexedDB wrapper, `bulkPut`, single active dataset | Already locked in AGENTS.md/PROJECT.md; confirmed current (`npm view dexie version` → `4.4.6`) — see Package Legitimacy Audit below for the registry's "very recently published" flag on this exact version and why it is a false positive |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fake-indexeddb | ^6.2.5 [ASSUMED — package name found via WebSearch, not previously locked in AGENTS.md/PROJECT.md] | Pure-JS in-memory IndexedDB implementation for Node-based Vitest unit tests | The project's `vitest.config.ts` runs unit tests under `environment: 'node'` (not jsdom/happy-dom), which has no `indexedDB` global (confirmed this session: `node -e "console.log(typeof indexedDB)"` → `undefined`). Any Wave-0/Wave-1 unit test that exercises the new Dexie schema, hash-dedup logic, or clear-data logic needs this polyfill loaded via `tests/unit/setup.ts` (`import 'fake-indexeddb/auto'`) before Dexie is imported. **Gate this install behind a `checkpoint:human-verify` task per the package-legitimacy protocol** (see audit below) since the name is WebSearch-sourced, not pulled from an authoritative doc. |

### No new dependency needed for:

| Capability | Why no library | Approach |
|------------|-----------------|----------|
| Hashing for dedup (IMPORT-06) | `crypto.subtle.digest()` is native, available inside Worker global scope (`WorkerGlobalScope.crypto.subtle`, per MDN's WebIDL: `SecureContext, Exposed=(Window,Worker)`), and the file's bytes are already fully in memory (`new Uint8Array(await file.arrayBuffer())`) for `unzipSync` to consume — digesting those same bytes costs no extra read. A streaming/incremental hasher (e.g. `hash-wasm`) is unnecessary at this project's scale; `crypto.subtle.digest` is a one-shot, whole-buffer API (no streaming support), which is fine here because the buffer is already fully materialized for other reasons. | `await crypto.subtle.digest('SHA-256', bytes)` on the already-read `Uint8Array`, before calling `listEntryPaths`/`unzipSync` |
| Mojibake correction (IMPORT-04) | AGENTS.md already specifies "a small hand-rolled byte-roundtrip fix... no library needed." JS's built-in `TextDecoder` with `{ fatal: true }` gives a clean, native "detect before convert" implementation (see Code Examples) — no external mojibake-detection package (e.g. Python's `ftfy` has no maintained JS equivalent found in this research) is needed. | Latin-1 byte reinterpretation + `TextDecoder('utf-8', { fatal: true }).decode(...)`, rejecting (keeping original) on a `TypeError` |

**Installation:**
```bash
pnpm add papaparse dexie
pnpm add -D @types/papaparse fake-indexeddb
```

**Version verification:** confirmed this session via `npm view <pkg> version` against the live npm registry (2026-09-28) — all three already-locked packages match AGENTS.md's expectations exactly; no drift.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One generic Dexie row table for every category | A typed Dexie table per known CSV (Sessions, Orders, Account_Info, ...) + a separate generic table for unknown folders | Typed tables give better TS autocomplete for Phase 4/5/6's dashboard code, but duplicate the "handle missing/extra columns defensively" logic per known table, contradict D-01's "every category alike" framing, and add schema-migration surface every time a new known CSV needs adding. Given IMPORT-03 already requires tolerance even on *known* CSVs (format may have drifted since 2021), the generic shape's defensiveness is needed everywhere anyway — recommend the generic shape uniformly and let Phase 4/5/6 do typed projections at *read* time. |
| `crypto.subtle.digest('SHA-256', ...)` on the whole in-memory buffer | An incremental/streaming hasher (`hash-wasm`) reading the file in chunks via `File.slice()` | Streaming avoids holding the whole file in memory twice — but this project's worker already materializes the whole file into one `Uint8Array` before hashing would even start (fflate's `unzipSync` requires the full buffer too), so there is no second read to avoid. Adding a WASM dependency for a problem that doesn't exist here would violate the project's dependency-minimalism constraint. |
| Dexie exclusively inside the worker | Dexie opened on both the worker (writes) and the main thread (cache-check reads) | Documented community bug class: opening the same Dexie database from two separate JS module graphs (worker + main thread have separate module maps) has caused "database won't even show up in DevTools" and "opening an existing database from a worker fails" reports. Single-owner avoids this entirely and matches SC1's "write work ran in the worker" requirement. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| papaparse | npm | created well before 2020 (long-established); latest 5.7.0 published 2026-08-24 | ~18.0M/wk | github.com/mholt/PapaParse | OK | Approved |
| @types/papaparse | npm | DefinitelyTyped-maintained, latest 5.5.2 published 2025-12-13 | ~13.1M/wk | github.com/DefinitelyTyped/DefinitelyTyped | OK | Approved |
| dexie | npm | package created 2014-08-21, 189 published versions; **latest patch (4.4.6) published 2026-09-10 — 18 days before this research, which is what triggers the "too-new" signal** | ~2.6M/wk | github.com/dexie/Dexie.js | SUS (`too-new`, on the registry-check heuristic) | **Approved — flagged verdict is a false positive.** Verified this session via `npm view dexie time --json`: the package's *first* version (0.9.9) was published 2014-08-21; it has shipped 189 versions since; weekly downloads are 2.6M; the repo is the same `dexie/Dexie.js` already named in AGENTS.md/PROJECT.md's Key Decisions table. The "too-new" signal is measuring the latest *patch's* publish date, not the package's age — an actively-maintained, decade-old library will always look "new" by that metric right after any release. Planner should still add a `checkpoint:human-verify` before install per protocol, but the evidence above should make that checkpoint a fast confirm, not a real investigation. |
| fake-indexeddb | npm | package created 2015-05-09; latest 6.2.5 | ~7.9M/wk | github.com/dumbmatter/fakeIndexedDB | OK | Approved — still gate behind `checkpoint:human-verify` per the package-name-provenance rule (name discovered via WebSearch, not previously locked in project docs) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `dexie` — see disposition above; the planner should still insert the standard `checkpoint:human-verify` task before `pnpm add dexie`, but this audit's evidence (10-year-old package, 189 releases, 2.6M weekly downloads, matches the already-locked project decision) should make that checkpoint trivial to clear rather than a real risk investigation.

*`fake-indexeddb` is additionally flagged per the package-name-provenance rule (WebSearch-sourced, not from an authoritative doc) — the planner must gate its install behind `checkpoint:human-verify` regardless of its clean `[OK]` registry verdict.*

## Architecture Patterns

### System Architecture Diagram

```
Main thread (App.svelte / IngestClient)              Worker (ingest.worker.ts)
─────────────────────────────────────              ──────────────────────────

App init
  │
  ▼
IngestClient created ──── postMessage 'check-cache' ──▶  open Dexie db (sole owner)
                                                           │
                                                           ▼
                                              db.meta.get('active') exists?
                                                    │              │
                                                   yes             no
                                                    │              │
                             ◀── 'cache-status' (result) ─────────┘
  │
  ▼ (render ResultsView w/ cached counts   OR   render empty Dropzone)
  D-07 / D-08

User drops zip ─── precheckFiles() (unchanged) ─── postMessage 'ingest' {file}
                                                           │
                                                           ▼
                                              bytes = new Uint8Array(await file.arrayBuffer())
                                                           │
                                                           ▼
                                    stage:'hashing'  hash = crypto.subtle.digest('SHA-256', bytes)
                                                           │
                                                           ▼
                                              db.meta.get('active').hash === hash ?
                                                    │                    │
                                                   yes                   no
                                                    │                    ▼
                                  ◀── 'duplicate' {result} ──┘    stage:'unzipping'
  (D-12 banner, no unzip/parse ran)                                     │
                                                                         ▼
                                                          entries = listEntryPaths(bytes)  [unchanged]
                                                                         │
                                                                         ▼
                                                          stage:'classifying' → analyzeExport(entries)
                                                                         │
                                                                         ▼
                                                    for each category (ALL statuses, D-01):
                                                      stage:'parsing' {category, i, total}  (D-11)
                                                      for each CSV file in category:
                                                        unzipSync-inflate this entry only
                                                        Papa.parse(text, {header:true, worker:false, skipEmptyLines:true})
                                                        for each row: fixMojibake(field) per string field
                                                        malformed row (unparseable beyond ragged columns) → console.error, skip, skippedRowCount++
                                                        rows.push({category, sourceFile, rowIndex, data})
                                                                         │
                                                                         ▼
                                                    stage:'writing'  db.transaction('rw', db.rows, db.meta, async () => {
                                                                        await db.rows.clear()
                                                                        for (chunk of chunks(rows, 1000)) await db.rows.bulkPut(chunk)
                                                                        await db.meta.put({id:'active', hash, importedAt, categories})
                                                                      })
                                                                         │
                                  ◀── 'done' {result} ───────────────────┘
  │
  ▼
navigator.storage.persist()  (main thread ONLY — not callable from Worker, D-06)
```

### Recommended Project Structure

```
src/lib/
├── worker/
│   ├── ingest.worker.ts     # extend: hash → cache-check → unzip → per-category parse → write
│   ├── classify.ts          # unchanged (Phase 1)
│   ├── categories.ts        # unchanged (Phase 1)
│   ├── zip-paths.ts         # unchanged — keep "list without inflate" for the pre-hash path
│   ├── db.ts                 # NEW — Dexie schema + open(), lives ONLY imported by the worker
│   ├── csv-parse.ts          # NEW — Papa.parse wrapper: per-file parse + row error/skip accounting
│   ├── mojibake.ts           # NEW — fixMojibake(field): string helper, pure function, unit-testable
│   └── hash.ts                # NEW — digestFile(bytes): Promise<string> (hex), pure, unit-testable
├── types/worker-messages.ts  # extend: new stages, new request/response types (see Code Examples)
├── worker-client.svelte.ts   # extend: new states (checking-cache, duplicate, confirm-pending), new message handling
└── components/
    ├── ResultsView.svelte     # extend: row counts, skip counts, imported-at timestamp (D-05, D-04, D-10)
    ├── CategoryBadge.svelte   # extend: rowCount + skippedRowCount props
    └── ConfirmPanel.svelte    # NEW — shared confirm UI for D-13/D-16/D-17/D-22
```

### Pattern 1: Hash the already-in-memory buffer before any inflate work

**What:** Compute the SHA-256 digest of the raw zip bytes immediately after `file.arrayBuffer()`, before `listEntryPaths`/`unzipSync` runs, and compare against the stored dataset's hash.
**When to use:** Every `ingest` message — this is the SC3 gate ("skipped before any unzip or parse work starts").
**Example:**
```typescript
// Source: MDN SubtleCrypto.digest() (availability, one-shot API) — synthesized for this codebase
async function digestFile(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// in ingest.worker.ts, BEFORE listEntryPaths(bytes):
const bytes = new Uint8Array(await file.arrayBuffer());
scope.postMessage({ type: 'stage', jobId, stage: 'hashing' });
const hash = await digestFile(bytes);

const existing = await db.meta.get('active');
if (existing && existing.hash === hash) {
  scope.postMessage({ type: 'duplicate', jobId, result: existing.result });
  return; // no listEntryPaths, no unzipSync, no Papa.parse — SC3 satisfied
}
// ... proceed to listEntryPaths(bytes) as today
```

### Pattern 2: Mojibake fix as a round-trip-or-reject, applied per string field

**What:** A pure function that only "corrects" a field when the Latin-1→UTF-8 round trip is actually valid, using `TextDecoder`'s `fatal` option as the built-in detector — never blind reapplication.
**When to use:** Every string field value coming out of PapaParse, before the row is pushed into the write batch (research question 6: D-01 now parses ALL folders, so this must be safe to run on every field, not just known-Cyrillic ones).
**Example:**
```typescript
// Source: synthesized from general "detect-before-convert" mojibake heuristic (WebSearch,
// multiple independent sources) + native TextDecoder `fatal` option (standard Web API) — [ASSUMED]:
// this specific composition was not found pre-written in an official doc; validate against the
// real Cyrillic clan-text sample during execution.
const strictUtf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function fixMojibake(value: string): string {
  if (value.length === 0) return value;
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0xff) return value; // real non-Latin-1 text (e.g. correctly-decoded Cyrillic) — never touch it
    bytes[i] = code;
  }
  try {
    const reDecoded = strictUtf8Decoder.decode(bytes);
    // A pure-ASCII field round-trips to itself (safe no-op); a field that
    // was truly mojibake decodes into different, correct text; a field
    // that merely LOOKS Latin-1-range but isn't valid re-encoded UTF-8
    // throws below and is left untouched.
    return reDecoded;
  } catch {
    return value; // not valid UTF-8 under this reinterpretation — leave as-is, do not corrupt
  }
}
```

### Pattern 3: Chunked bulkPut inside one Dexie transaction, with synchronous progress posts

**What:** Wrap the whole "clear + rewrite + update meta" sequence in one Dexie transaction so a crash mid-import can never leave the active dataset half-old/half-new; chunk `bulkPut` calls to keep any single IndexedDB request bounded; post progress `postMessage` calls synchronously between chunks (not via `setTimeout`) so the transaction's implicit auto-commit timing isn't disturbed.
**When to use:** The `stage: 'writing'` phase, after all rows for the whole export have been parsed in memory.
**Example:**
```typescript
// Source: Dexie official docs on bulkPut/transactions (WebSearch synthesis of dexie.org
// content) + community chunk-size guidance (500-1000/chunk) — [CITED: dexie.org, community]
async function writeDataset(
  db: AppDb,
  hash: string,
  categories: CategoryEntry[],
  rows: RowRecord[],
): Promise<void> {
  const CHUNK = 1000;
  await db.transaction('rw', db.rows, db.meta, async () => {
    await db.rows.clear();
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db.rows.bulkPut(rows.slice(i, i + CHUNK));
      // synchronous postMessage — stays inside the same Dexie promise
      // zone as the transaction; a setTimeout/macrotask here risks the
      // transaction auto-committing early on some browsers. [ASSUMED —
      // verify with a fake-indexeddb unit test during execution.]
    }
    await db.meta.put({ id: 'active', hash, importedAt: new Date().toISOString(), categories });
  });
}
```

### Pattern 4: Extended worker-message contract (types only — no behavior change to Phase 1's existing types)

**What:** New stage values, new request/response variants, extended `CategoryEntry`/`ClassifyResult`.
**When to use:** `src/lib/types/worker-messages.ts`.
**Example:**
```typescript
// Extends src/lib/types/worker-messages.ts (Phase 1, unchanged fields kept)
export type IngestStage = 'hashing' | 'unzipping' | 'classifying' | 'parsing' | 'writing';

export interface ParsingProgress {
  category: string;
  categoryIndex: number; // 1-based
  categoryTotal: number;
}

export interface CategoryEntry {
  name: string;
  status: CategoryStatus;
  fileCount: number;
  rowCount: number;        // NEW — D-05
  skippedRowCount: number; // NEW — D-04, D-09
}

export interface ClassifyResult {
  accountRoot: string;
  categories: CategoryEntry[];
  counts: Record<CategoryStatus, number>;
  importedAt: string; // NEW — D-10, ISO 8601
}

export type IngestRequest =
  | { type: 'ingest'; jobId: number; file: File }
  | { type: 'check-cache'; jobId: number }   // NEW — D-07/D-08, sent once at app init
  | { type: 'clear-data'; jobId: number };   // NEW — D-15/D-17

export type IngestResponse =
  | { type: 'ready' }
  | { type: 'stage'; jobId: number; stage: IngestStage; progress?: ParsingProgress }
  | { type: 'duplicate'; jobId: number; result: ClassifyResult } // NEW — D-12, distinct from 'done'
  | { type: 'done'; jobId: number; result: ClassifyResult }
  | { type: 'cache-status'; jobId: number; cached: ClassifyResult | null } // NEW
  | { type: 'cleared'; jobId: number } // NEW — D-20 ack
  | { type: 'error'; jobId: number; detail: string };
```

### Anti-Patterns to Avoid

- **Opening a second Dexie instance on the main thread "just for reads":** documented Dexie+Worker dual-context bug class (module duplication, database-won't-open reports). Route every read through the worker's message contract instead.
- **Calling `navigator.storage.persist()` from inside `ingest.worker.ts`:** it is `[Exposed=Window]` only per the WebIDL and will not exist as a callable on `self` inside a Worker. `persisted()`/`estimate()` ARE worker-safe if a read-only check is ever needed there.
- **Treating a PapaParse `FieldMismatch` entry in `results.errors` as fatal:** per PapaParse's own docs, "mismatched fields won't break parsing" — the row is still present in `results.data` with missing keys / a `__parsed_extra` array. D-03's "skip individually" behavior should be reserved for rows that fail a *domain-level* check after parsing (unparseable date, garbage bytes in a field expected to be structured), not every ragged-column row — ragged columns are exactly what IMPORT-03 already asks the parser to tolerate.
- **Blindly reapplying the Latin-1/UTF-8 roundtrip to every field unconditionally:** corrupts already-correct text (see Pattern 2). Always gate on the `TextDecoder({fatal:true})` round-trip succeeding.
- **Interleaving a macrotask (`setTimeout`) between chunked `bulkPut` calls inside one Dexie transaction:** risks the IndexedDB transaction auto-committing early, splitting an intended-atomic write into two. Keep progress `postMessage` calls synchronous, or forgo the wrapping transaction and clear+bulkPut chunk-by-chunk outside a transaction (accepting the documented Dexie behavior that successful chunks persist even if a later chunk fails).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing with quoted fields, mixed line endings, defensive column handling | A hand-rolled semicolon-split parser | PapaParse 5.7.0, `header: true, skipEmptyLines: true, worker: false` | Already locked; PapaParse's line-ending auto-detection and `FieldMismatch`/`__parsed_extra` handling cover exactly IMPORT-03's requirements without custom state-machine code |
| IndexedDB transactions, bulk writes, schema versioning | Raw `indexedDB.open()`/`IDBTransaction` calls | Dexie 4.4.6 | Already locked; Dexie's Safari IndexedDB fixes and `bulkPut` batching are the reason it was chosen over vanilla IndexedDB |
| SHA-256 content hashing for dedup | A hand-rolled or npm hash library | Native `crypto.subtle.digest('SHA-256', ...)` | Zero-dependency, available in Worker scope, and the input is already a single in-memory buffer — no streaming need to justify a library |

**Key insight:** every "don't hand-roll" item in this phase is already covered by a previously-locked library except hashing (native API suffices) and mojibake correction (AGENTS.md explicitly wants this hand-rolled, and the `TextDecoder{fatal:true}` trick keeps that hand-rolled code to ~15 lines with a built-in safety check rather than a hand-rolled byte-signature heuristic).

## Common Pitfalls

### Pitfall 1: Dexie opened from both the worker and the main thread
**What goes wrong:** Community reports include a Dexie instance created in a worker for bulk writes failing to open an *existing* database, and a freshly-created-in-worker database not appearing in DevTools at all, when the main thread also imports the same Dexie module/database name.
**Why it happens:** Workers have a separate JS module map from the main thread; two independently-instantiated Dexie objects pointed at the same IndexedDB database name is not the intended usage pattern (the community `dexie-worker` package exists specifically to proxy around this).
**How to avoid:** Route every read (cache-check on init) and every delete (clear-data, start-over) through the worker's message contract. Only `navigator.storage.persist()` — which cannot run in a worker at all — belongs on the main thread, and it does not touch Dexie.
**Warning signs:** A "database not found" or an empty result immediately after a worker write completes, especially in dev/HMR where a stale main-thread Dexie handle could linger.

### Pitfall 2: `QuotaExceededError` detection is inconsistent across browsers
**What goes wrong:** Dexie sometimes wraps the real `QuotaExceededError` inside an `AbortError` (`e.name === 'AbortError'`, `e.inner.name === 'QuotaExceededError'`); multiple GitHub issues report both false positives (thrown even with free disk space) and false negatives (an `AbortError` with no usable `.inner`) across browser versions.
**Why it happens:** Browser-level IndexedDB quota-exceeded signaling is itself inconsistent; Dexie's wrapping is a best-effort normalization, not a guarantee.
**How to avoid:** Per D-06, there's no new size-based rejection logic to build — quota failures should route through the *existing single worker-error path* (`type: 'error'`). Check `e.name === 'QuotaExceededError' || e.inner?.name === 'QuotaExceededError'` when catching the write transaction, but don't rely on this being 100% reliable; any uncaught exception in the transaction already falls through to the worker's existing top-level `try/catch` → `'error'` message.
**Warning signs:** A large synthetic fixture import (SC1's "10x sample size") silently completing with fewer rows than expected, rather than surfacing an error — this would indicate a quota error wasn't being caught cleanly.

### Pitfall 3: Reading `PapaParse`'s per-row `errors` as authoritative for "this row was skipped"
**What goes wrong:** The `row` index reported in `results.errors` has documented off-by-one/inconsistency bugs (a `TooFewFields` error reported as `row: 0` while a `Quotes` error in the same parse is reported as `row: 1`).
**Why it happens:** PapaParse's internal row-counting differs slightly between its streaming/error-reporting paths and its final `results.data` array.
**How to avoid:** For D-04's "N rows skipped" count, count skips at the point the app's *own* domain-level validation rejects a row (after `results.data` is produced), not by counting `results.errors` entries directly — the two can diverge.
**Warning signs:** A skip count that doesn't match a manual count of visibly-bad rows in a small test fixture.

### Pitfall 4: Full inflate reintroduces zip-bomb exposure that Phase 1 deliberately avoided
**What goes wrong:** Phase 1's `listEntryPaths` never inflates (`filter` always returns `false`), which was explicitly designed as zip-bomb-safe. Phase 2 must now actually inflate every category's CSV bytes to parse them, and D-06 explicitly declines any size/row cap.
**Why it happens:** IMPORT-01/IMPORT-03 require actually reading the CSV content, which fflate can only do by inflating.
**How to avoid:** This is an accepted, documented residual risk (D-06's rationale: rely on `navigator.storage.persist()` + browser IndexedDB quota, no new size-based rejection). It's a low-realistic-risk item given the trust model (a user's own self-requested Wargaming GDPR export, not attacker-supplied input) — but the planner should note it explicitly rather than silently drop Phase 1's zip-bomb-safety framing.
**Warning signs:** A synthetic fixture designed to test this (a file with claimed-small compressed size but enormous inflated size) freezing the worker tab.

## Code Examples

Verified/synthesized patterns — see Architecture Patterns above (Patterns 1-4) for the load-bearing code (hash-before-unzip, mojibake fix, chunked transactional bulkPut, extended message contract). Reproduced here as the canonical reference set the planner should point tasks at.

## State of the Art

| Old Approach (Phase 1) | Current Approach (Phase 2) | When Changed | Impact |
|--------------------------|------------------------------|---------------|--------|
| `listEntryPaths` only — never inflate any entry | Full inflate of every category's CSV files via `unzipSync` (targeted per-entry, or full-archive) | This phase | Reintroduces the zip-bomb exposure Phase 1's filter deliberately avoided (see Pitfall 4) — an accepted tradeoff per D-06 |
| `IngestStage = 'unzipping' \| 'classifying'` | `IngestStage` extended with `'hashing' \| 'parsing' \| 'writing'`, plus a `progress` field on `stage` messages | This phase | Was explicitly designed as the extension point in 01-CONTEXT.md D-09 — no redesign needed, additive only |
| No persistence — every reload starts empty | Dexie-backed single active dataset, hash-keyed dedup | This phase | First phase where "your data never leaves your machine" also means "your data survives a reload," changing the return-visit UX entirely (D-07/D-08) |

**Deprecated/outdated:** none — this is the first phase to introduce these capabilities, nothing is being replaced from a prior implementation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fake-indexeddb` (npm, `^6.2.5`) is the correct devDependency for Node-based Dexie unit tests under this project's Vitest config | Standard Stack / Supporting | If wrong package or a version incompatible with Dexie 4.4.6/Node 26, Wave-0 Dexie unit tests fail to even boot; low risk since the package is long-established (created 2015) and widely used for exactly this purpose, but the *name* itself is WebSearch-sourced per provenance rule |
| A2 | The `fixMojibake` round-trip-or-reject pattern (Pattern 2) is safe to apply unconditionally to every string field across every category (D-01's "parse ALL folders") without a data-driven false-positive check against the real 2021 sample's Cyrillic clan text | Architecture Patterns, Pattern 2 | If the real sample's mojibake bytes don't round-trip cleanly through this exact implementation, IMPORT-04 could silently fail on the one real data point the project has already inspected — verify with a targeted unit test against a fixture built from the documented byte pattern before trusting it broadly |
| A3 | Chunked `bulkPut` calls inside one `db.transaction('rw', ...)` block, with only synchronous `postMessage` calls between chunks, will not cause the IndexedDB transaction to auto-commit early | Architecture Patterns, Pattern 3 | If wrong, a large import (SC1's 10x-scale fixture) could partially write, leaving `db.meta`'s hash pointing at a dataset whose `db.rows` table is incomplete — should be caught by a fake-indexeddb-backed unit test asserting the full row count after a chunked write, during Wave 0/1 |
| A4 | A single generic (header-keyed) Dexie row table is the right schema for ALL categories, including the four already-typed "supported" ones, rather than typed tables for known CSVs + a generic table for the rest | Standard Stack / Alternatives Considered | If Phase 4/5/6's dashboards turn out to need stronger type guarantees than a `Record<string,string>` row shape provides, this becomes a schema migration rather than a greenfield choice — the "Claude's Discretion" framing in CONTEXT.md explicitly allows this to be revisited, so risk is contained |
| A5 | Full-archive inflate for parsing (vs. Phase 1's inflate-nothing listing) is an acceptable zip-bomb exposure at v1 scale, per D-06's explicit no-cap decision | Common Pitfalls, Pitfall 4 | Given a malicious/corrupt export (not the expected trust model of a self-requested GDPR export), a crafted zip could freeze the worker tab; D-06 already accepts this risk explicitly, so this assumption just documents that acceptance rather than introducing a new one |

## Open Questions

1. **Exact chunk size for `bulkPut` at this project's realistic scale**
   - What we know: community guidance converges on 500-1000 records/chunk; real-world reports show visible slowdown past ~10k records in a single unbatched operation.
   - What's unclear: whether 1000 is right for THIS schema (rows carry a `Record<string,string>` blob, not small flat objects) — blob size per row varies a lot between, say, `Account_Info.csv` (13 columns, 1 row) and a multi-thousand-row `Sessions.csv`.
   - Recommendation: keep the chunk size as a named constant (e.g. `ROWS_PER_BULKPUT_CHUNK = 1000`) so it's trivially tunable after the 10x-scale synthetic fixture (SC1) is actually measured in Wave 0/1, rather than treating 1000 as load-bearing today.

2. **Whether the "generic table for every category" schema needs `sourceFile` as an indexed field now, for Phase 5's benefit**
   - What we know: Phase 5 (STATS-01) needs per-vehicle stats separated by WoT/WoT Blitz/WoWS/WoWP, which live in *separate CSV files* inside the single `Player_statistics` category.
   - What's unclear: whether Phase 2 should index `sourceFile` now (cheap, since it's already known at parse time) or leave it unindexed and let Phase 5 add the index in a schema migration.
   - Recommendation: store `sourceFile` on every row now (it's free — already available from the per-file parse loop) but let the planner decide whether to declare it as a Dexie *index* now vs. deferring the index declaration to Phase 5's own research, since Dexie schema versions are additive/migratable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (dev/test machine) | Vitest unit tests, `npm view` verification | ✓ | v26.10.0 | — |
| `globalThis.crypto.subtle` (Node) | Unit-testing `digestFile()` without a browser | ✓ (confirmed this session: `typeof crypto.subtle === 'object'`) | Node 26 built-in Web Crypto | — |
| `indexedDB` (Node) | Unit-testing Dexie schema/writes without a browser | ✗ (confirmed this session: `typeof indexedDB === 'undefined'`) | — | `fake-indexeddb/auto`, loaded in `tests/unit/setup.ts` (see A1) |
| pnpm | Package install | ✓ | 12.6.0 | — |
| npm registry reachability | Version/legitimacy verification this session | ✓ | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `indexedDB` in the Node test environment — `fake-indexeddb` (see Standard Stack / Supporting, gated behind `checkpoint:human-verify`).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^5.0.2 (unit, `environment: 'node'`), Playwright ^1.63.0 (e2e, built app only) |
| Config file | `vitest.config.ts` (unit), `playwright.config.ts` (e2e) |
| Quick run command | `pnpm test:unit` |
| Full suite command | `pnpm test:unit && pnpm build && pnpm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-01 | Full unzip + parse of every CSV, all work in worker | unit + e2e | `pnpm test:unit` (parse logic), `pnpm test:e2e` (worker-only assertion, mirrors Phase 1's pattern) | ❌ Wave 0 |
| IMPORT-03 | CRLF/bare-CR, missing/extra columns tolerated | unit | `vitest run tests/unit/csv-parse.test.ts` | ❌ Wave 0 |
| IMPORT-04 | Mojibake correction, no corruption of correct text | unit | `vitest run tests/unit/mojibake.test.ts` | ❌ Wave 0 |
| IMPORT-06 | Hash-dedup skip before unzip; replace on new hash | unit (hash logic) + e2e (re-drop same/different zip) | `vitest run tests/unit/hash.test.ts`, `pnpm test:e2e` | ❌ Wave 0 |
| DATA-01 | Dexie bulkPut cache, survives reload | unit (fake-indexeddb) + e2e (reload assertion) | `vitest run tests/unit/db.test.ts` | ❌ Wave 0 |
| DATA-02 | "Clear my cached data" wipes IndexedDB | unit + e2e | `vitest run tests/unit/db.test.ts`, `pnpm test:e2e` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test:unit`
- **Per wave merge:** `pnpm test:unit && pnpm build && pnpm test:e2e`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/setup.ts` — add `import 'fake-indexeddb/auto'` before any Dexie import, so every Node-based unit test gets a working `indexedDB` global
- [ ] `src/lib/worker/db.ts` — new Dexie schema module (does not exist yet)
- [ ] `src/lib/worker/csv-parse.ts`, `mojibake.ts`, `hash.ts` — new pure-function modules, each needing a dedicated `tests/unit/*.test.ts`
- [ ] `tests/fixtures/export-fixtures.ts` — new fixture builders needed: a mojibake/Cyrillic-content fixture (byte-level, matching PROJECT.md's documented real-sample encoding bug) and a "10x sample size" fixture distinct from `buildLargeExport()`'s 20k-tiny-file responsiveness fixture (SC1 wants realistic row *content* at 10x scale, not just file count)
- [ ] Framework install: `pnpm add -D fake-indexeddb` (gated behind `checkpoint:human-verify` per package-legitimacy protocol)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No backend, no auth — out of scope for this entirely client-side app |
| V3 Session Management | No | No sessions — single-page, no server |
| V4 Access Control | No | No multi-user/multi-tenant boundary — single local dataset |
| V5 Input Validation | Yes | Every field from the untrusted zip is treated as data, never markup — Svelte's default text interpolation (already the pattern in `CategoryBadge.svelte`) escapes it; the `svelte/no-at-html-tags` lint rule (already active) prevents accidental `{@html}` injection of parsed CSV content |
| V6 Cryptography | Yes (non-secret use) | Native `crypto.subtle.digest('SHA-256', ...)` for content-addressing/dedup — never hand-rolled, and not protecting a secret (the hash is a dedup key, not a credential), so this is a light-touch application of V6 rather than a strict requirement |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Zip-bomb / decompression bomb (now that Phase 2 must fully inflate CSV entries, unlike Phase 1's list-only path) | Denial of Service | Accepted residual risk per D-06's explicit no-cap decision — see Common Pitfalls Pitfall 4. Trust model (self-requested GDPR export) makes this low-realistic-risk; not re-litigated here, just flagged for the planner |
| Untrusted zip-entry strings (category names, CSV field values) rendered into the DOM | Tampering / Injection (XSS) | Already mitigated by Svelte's default text-interpolation escaping (established pattern in `CategoryBadge.svelte`, `ui-copy.ts`'s `formatAccountHeading`) — no new control needed, just don't introduce `{@html}` anywhere in Phase 2's new UI (skip counts, timestamps, confirm panels) |
| Unencrypted-at-rest IndexedDB cache (any local user/attacker with disk access can read cached export data) | Information Disclosure | This is the entire reason DATA-02's "clear my cached data" control exists (per PROJECT.md's own framing: "nothing currently wipes the unencrypted-on-disk cache otherwise") — Phase 2 IS the mitigation being built, not a gap to close elsewhere |

## Sources

### Primary (HIGH confidence)
- None this session — `context7`/`ref`/`exa`/`tavily`/`brave`/`firecrawl` are all disabled in `.planning/config.json`, and `WebFetch` returned a tool-level model error every time it was invoked this session (see Metadata). All findings below are WebSearch syntheses of official-documentation content, tagged CITED/MEDIUM rather than VERIFIED/HIGH.

### Secondary (MEDIUM confidence — WebSearch synthesis of official docs)
- dexie.org `Table.bulkPut()` docs (via WebSearch synthesis) — bulkPut semantics, `Dexie.BulkError`, transaction-scope caveat
- dexie.org `Table Schema` docs (via WebSearch synthesis) — schema governs only primary key + indexes, not full row shape
- dexie.org `StorageManager`/`Dexie.QuotaExceededError` docs (via WebSearch synthesis) — quota error wrapping via `AbortError.inner`
- papaparse.com/docs (via WebSearch synthesis) — `header: true` field-count-mismatch behavior, `__parsed_extra`, default config object, `newline` auto-detect
- MDN `SubtleCrypto.digest()` (via WebSearch synthesis) — Worker-scope availability, one-shot (non-streaming) API
- MDN `StorageManager.persist()` / `WorkerGlobalScope.navigator` (via WebSearch synthesis) — `persist()` is `[Exposed=Window]` only, `persisted()`/`estimate()` are worker-available
- npm registry (`npm view`, this session) — papaparse 5.7.0, @types/papaparse 5.5.2, dexie 4.4.6, fake-indexeddb 6.2.5, all current; dexie's full version history (189 versions since 2014-08-21) confirming the package-legitimacy `too-new` flag is a false positive

### Tertiary (LOW confidence — community/GitHub issues, marked for validation)
- Dexie GitHub issues #776, #840, #905, #1427 — QuotaExceededError inconsistency, bulkPut performance at 30k+ records (community reports, not official guidance)
- PapaParse GitHub issues #441, #510, #653, #795, #929 — `results.errors` row-index inconsistency (community bug reports)
- "Dexie DB within a web worker" community thread + `dexie-worker` package README — dual-context Dexie usage bugs (community-documented, not an official Dexie warning)
- ftfy (Python library) documentation — general mojibake-heuristic inspiration only; no JS equivalent found, so the concrete `fixMojibake` implementation in this document is an original synthesis (see A2 in Assumptions Log)

## Metadata

**Confidence breakdown:**
- Standard stack (papaparse/dexie versions): HIGH — directly verified against the live npm registry this session, matching an already-locked project decision
- New devDependency (fake-indexeddb): LOW/ASSUMED — WebSearch-sourced name, gated behind `checkpoint:human-verify`
- Architecture (worker-owns-Dexie, hash-before-unzip, message contract extension): MEDIUM — synthesized from documented community pitfalls + the project's own existing, already-battle-tested Phase 1 message-contract pattern
- Mojibake fix implementation (Pattern 2): LOW/ASSUMED — general heuristic is CITED, but the specific `TextDecoder{fatal:true}` composition is an original synthesis not found pre-written in a source; needs a unit test against real sample byte patterns before being trusted
- Pitfalls (Dexie dual-context, QuotaExceededError wrapping, PapaParse row-index bugs): MEDIUM — cross-referenced across multiple independent community reports, consistent conclusions

**Research date:** 2026-09-28
**Valid until:** ~30 days (2026-10-28) for the locked library versions (stable ecosystem); the ASSUMED items (A1-A5) should be resolved by Wave 0/1 unit tests well before that window matters
