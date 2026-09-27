# Architecture Research

**Domain:** Browser-only, zero-backend data-visualization SPA (Svelte 5) with a Worker-based ingest pipeline
**Researched:** 2026-09-27
**Confidence:** MEDIUM-HIGH (component design is synthesis over PROJECT.md's locked decisions + verified library constraints; library-specific claims are sourced and marked HIGH)

This document does **not** relitigate the locked architecture (Web Worker pipeline: fflate → PapaParse → Dexie; no router; single active dataset; hand-rolled SVG; offline geo-IP on a bundled map). It defines the concrete component boundaries, message contracts, and build order that implement it, and flags what PROJECT.md leaves implicit.

## Standard Architecture

### System Overview

```
┌───────────────────────────── MAIN THREAD (Svelte 5 SPA, single page, no router) ─────────────────────────────┐
│                                                                                                                 │
│  ┌────────────┐   File    ┌───────────────────┐  postMessage   ┌─────────────────────────────────────────┐   │
│  │  Dropzone   │ ────────▶ │  Pipeline Client   │ ─────────────▶ │        pipeline.worker.ts (below)        │   │
│  │ (hand-rolled│           │ (worker.ts wrapper,│                └─────────────────────────────────────────┘   │
│  │  drag/drop) │           │  owns 1 Worker     │ ◀───────────── progress / duplicate / done / error messages  │
│  └────────────┘           │  instance)         │                                                              │
│                            └─────────┬──────────┘                                                              │
│                                      │ writes                                                                  │
│                                      ▼                                                                         │
│                            ┌───────────────────┐                                                               │
│                            │  App State (runes)│  ← src/lib/state/dataset.svelte.ts ($state, no store lib)     │
│                            │  status/progress/  │                                                               │
│                            │  categoriesPresent │                                                               │
│                            └─────────┬──────────┘                                                               │
│                                      │ read by                                                                 │
│                    ┌─────────────────┼──────────────────────┬───────────────────────┐                         │
│                    ▼                 ▼                      ▼                       ▼                         │
│           ┌────────────────┐ ┌────────────────┐   ┌──────────────────┐   ┌────────────────────┐              │
│           │ Activity        │ │ Vehicle Stats  │   │ Financial          │   │ Login-IP + Geo Map  │              │
│           │ dashboards      │ │ dashboards      │   │ dashboards         │   │ (uses geo lookup)    │              │
│           │ (SVG heatmaps)  │ │ (SVG bars)      │   │ (SVG timeline)     │   │ (SVG world-atlas)    │              │
│           └───────┬────────┘ └───────┬────────┘   └─────────┬──────────┘   └─────────┬───────────┘              │
│                   │                 │                       │                        │                         │
│                   └─────────────────┴───────────┬───────────┴────────────────────────┘                         │
│                                                   ▼                                                             │
│                                       ┌───────────────────────────┐                                            │
│                                       │  Dexie Query Layer (main) │  ← reads only; writes happen in worker      │
│                                       │  imports shared db/schema │                                            │
│                                       └─────────────┬─────────────┘                                            │
└─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┘
                                                        │ same IndexedDB (Dexie 4, shared schema module)
┌───────────────────────────────────────────────────────┼──────────────────────────── WEB WORKER (1 dedicated) ───┐
│                                                        ▼                                                        │
│  ┌───────────┐   ┌──────────────┐   ┌──────────────────────┐   ┌──────────────┐   ┌─────────────────────────┐ │
│  │ Hash stage │──▶│ Unzip stage  │──▶│ Category classifier  │──▶│ Parse stage   │──▶│ Dexie write stage        │ │
│  │ (dedup     │   │ (fflate,     │   │ (auto-detect root +  │   │ (PapaParse,   │   │ (bulkPut per table,      │ │
│  │  check)    │   │  unzipSync)  │   │  category folders;   │   │  worker-less  │   │  clear-then-replace for  │ │
│  │            │   │              │   │  supported / deferred │   │  mode, defen- │   │  single-active-dataset)  │ │
│  │            │   │              │   │  / unknown)           │   │  sive schema) │   │                          │ │
│  └───────────┘   └──────────────┘   └──────────────────────┘   └──────────────┘   └─────────────────────────┘ │
│                                                                                                                  │
│  imports: src/lib/db/schema.ts (SHARED with main thread — the one module NOT owned by either side exclusively)  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

BUILD-TIME (separate from both of the above — runs once, in Node, before `vite build`, not at runtime):
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  scripts/build-geo-table.mjs :  DB-IP Lite CSV  →  sorted binary IP-range table  →  src/assets/geo-ranges.bin   │
│  This is NOT the Worker pipeline. Do not conflate "the pipeline" (runtime, per-upload) with this (build-time,   │
│  one-shot, produces a static asset the main thread reads synchronously at render time).                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Dropzone | Accept a single `.zip` File via drag/drop or file input; hand off raw bytes; disable itself while a job is in flight | Hand-rolled Svelte 5 component; `file.arrayBuffer()`, no library |
| Pipeline Client | Owns the single long-lived `Worker` instance; sends `PROCESS_FILE`; receives `PROGRESS`/`DUPLICATE`/`CATEGORY_DETECTED`/`DONE`/`ERROR`; is the only module that touches `postMessage` on the main side | `src/lib/worker/pipelineClient.ts`, typed message contract imported from a shared `.d.ts`/`.ts` types module |
| App State | Single source of truth for dataset status (`idle/processing/ready/duplicate/error`), progress %, `categoriesPresent`/`categoriesDeferred`/`categoriesUnknown` | Svelte 5 runes in a `.svelte.ts` module (`$state`), no external store library needed |
| Worker entry | Sequences hash → unzip → classify → parse → write; the only place PapaParse and Dexie writes execute | `src/workers/pipeline.worker.ts`, loaded via `new Worker(new URL(...), { type: 'module' })` |
| Category classifier | Cross-references detected zip folder names against three static lists (supported-v1, known-deferred, and falls back to "unknown" for anything else) | Plain function over a shared constants module (`src/lib/categories.ts`) — imported by worker (to classify) and main thread (to render the three UI buckets) |
| Dexie write stage | Enforces single-active-dataset invariant (clear-then-replace), `bulkPut`, writes a `meta` row (hash, timestamp, categoriesPresent) | Runs inside the worker; IndexedDB is available in Worker global scope, Dexie works there unmodified |
| Dexie Query Layer | Main-thread reads only; never writes | Plain Dexie queries or `liveQuery`, scoped per dashboard section |
| Geo lookup | Pure, synchronous binary-search over the pre-built range table to map an IP → country code | `src/lib/geo/lookup.ts`; table loaded once as a static asset, kept in memory |
| Dashboard sections | One per category (Activity, Vehicle Stats, Financial, Login-IP+Map); each independently renders empty/greyed state when its Dexie table has 0 rows | Hand-rolled SVG, one `.svelte` component + one data-shaping module per section |

## Recommended Project Structure

```
src/
├── workers/
│   └── pipeline.worker.ts      # entry point; sequences the 5 stages, only file that runs off-main-thread
├── lib/
│   ├── worker/
│   │   ├── pipelineClient.ts   # main-thread wrapper: owns the Worker, exposes typed send/receive
│   │   └── messages.ts         # shared message-contract types, imported by BOTH worker and client
│   ├── pipeline/                # stage implementations, imported only by pipeline.worker.ts
│   │   ├── hash.ts
│   │   ├── unzip.ts             # fflate unzipSync wrapper + entry-path walking
│   │   ├── classify.ts          # folder-name → supported/deferred/unknown
│   │   ├── parse/
│   │   │   ├── activityHistory.ts
│   │   │   ├── playerStatistics.ts
│   │   │   ├── financialData.ts
│   │   │   └── shared.ts        # mojibake byte-roundtrip fix, defensive-column helpers
│   │   └── write.ts             # Dexie bulkPut + replace-on-new-upload logic
│   ├── db/
│   │   └── schema.ts            # Dexie schema/version — SHARED, imported by worker AND main thread
│   ├── categories.ts            # the 3 static classification lists — SHARED
│   ├── state/
│   │   └── dataset.svelte.ts    # runes-based app state, main-thread only
│   └── geo/
│       ├── lookup.ts            # binary-search over the bundled range table, main-thread only
│       └── worldAtlas.ts        # SVG map data + rendering helpers
├── components/
│   ├── Dropzone.svelte
│   ├── dashboards/
│   │   ├── ActivityHeatmaps.svelte
│   │   ├── VehicleStats.svelte
│   │   ├── FinancialTimeline.svelte
│   │   └── LoginIpMap.svelte
│   └── UnsupportedCategories.svelte
└── App.svelte                    # single page, no router

scripts/
└── build-geo-table.mjs           # BUILD-TIME only; emits src/assets/geo-ranges.bin; not part of src/workers/
```

### Structure Rationale

- **`lib/worker/messages.ts` is the load-bearing file.** It's imported by both `pipeline.worker.ts` and `pipelineClient.ts` so the contract can never drift between the two sides — treat changes to this file as an API change with corresponding test updates on both ends.
- **`lib/db/schema.ts` is the other shared file.** Both the worker (writes) and main thread (reads) instantiate their own `Dexie` connection against the *same* schema module — never duplicate the schema definition inline in two places, or a version mismatch will silently corrupt reads.
- **`lib/pipeline/` is worker-only code**, kept separate from `lib/state/` and `lib/geo/` (main-thread-only) so it's obvious at a glance which code is allowed to touch DOM/Svelte reactivity (none of `lib/pipeline/*` should ever import from `components/` or use `$state`).
- **`scripts/build-geo-table.mjs` lives outside `src/`** deliberately — it's a Node build step, not app code, and must never be bundled into the worker or main thread by accident.

## Architectural Patterns

### Pattern 1: Single long-lived dedicated Worker, not a worker-per-upload

**What:** One `Worker` instance is created once (e.g. on app init, lazily on first drop) and reused for every subsequent upload, rather than spawning a fresh worker per file.
**When to use:** Whenever the "replace on new upload" invariant matters — a fresh worker per upload risks a race where an old in-flight write from a superseded worker completes after the new one starts, partially corrupting the "single active dataset."
**Trade-offs:** Simpler lifecycle, no teardown/respawn bugs; con is the worker module holds implicit sequencing state (must fully finish or explicitly abort stage N before it can safely start a new job) — mitigate with a simple busy-guard on the main thread (disable the dropzone while `status !== 'idle'|'ready'`) rather than building a cancel/interrupt protocol into the worker for v1.

**Example:**
```typescript
// pipelineClient.ts — created once, reused
let worker: Worker | undefined;
function getWorker(): Worker {
  worker ??= new Worker(new URL('../../workers/pipeline.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}
```

### Pattern 2: Run PapaParse worker-less, inside our own worker

**What:** Call `Papa.parse(buffer, { worker: false, ... })` (or omit `worker` — it defaults to false) inside `pipeline.worker.ts`, never set `worker: true`.
**When to use:** Always, in this architecture. PapaParse's own `worker: true` mode spawns *its own* internal Worker to keep the *main* thread responsive — that's solved differently here, because parsing already happens off the main thread in our pipeline worker. Nesting a second worker inside a worker is unnecessary and has documented friction (script-path resolution failures when loaded via a bundler, `transformHeader` can't be serialized across the nested worker boundary, and IPC between the two workers can itself stall). PapaParse's own maintainers' guidance for "parsing inside your own worker" is explicitly to run it in worker-less/streaming mode.
**Trade-offs:** None meaningful at this data scale (a multi-MB export) — the whole point of `worker: true` (keep main thread responsive) is already achieved by being inside our dedicated worker.

**Example:**
```typescript
// lib/pipeline/parse/shared.ts — runs inside pipeline.worker.ts
Papa.parse(csvText, {
  worker: false,          // explicit — never true, we're already off-main-thread
  header: true,
  delimiter: ';',
  skipEmptyLines: true,
  transformHeader: (h) => h.trim(), // safe here since there's no nested-worker serialization
});
```

### Pattern 3: fflate `unzipSync`, not the async worker-pool variant

**What:** Use `unzipSync` (synchronous, blocks the calling thread) rather than `unzip` (async, internally parallelizes across its own worker pool) — called from inside `pipeline.worker.ts`.
**When to use:** Whenever the calling context is already off the main thread. `unzip`'s async/parallel path exists specifically to avoid blocking the *main* thread; blocking our *own* dedicated worker thread is harmless (nothing else needs that thread), and avoids spinning up fflate's internal worker pool nested inside our worker — one less moving part, smaller effective surface, consistent with the PapaParse decision above.
**Trade-offs:** Loses fflate's internal parallelism (up to ~3x faster on large archives per fflate's own docs) — acceptable given the known sample is ~2.2MB and even a "large veteran export" is unlikely to be large enough that decompression time (not parse/write time) is the bottleneck. Revisit only if profiling on a real large export shows unzip itself is the slow stage.

**Example:**
```typescript
// lib/pipeline/unzip.ts
import { unzipSync } from 'fflate';
const entries = unzipSync(new Uint8Array(zipBuffer)); // { [path]: Uint8Array }
```

## Data Flow

### Upload-to-render Flow

```
User drops .zip
    ↓
Dropzone reads File → ArrayBuffer, disables itself
    ↓ (postMessage, transfer: [buffer])
pipelineClient.send({ type: 'PROCESS_FILE', payload: { buffer, fileName } })
    ↓                                              [worker now owns the buffer; main thread's reference is neutered]
pipeline.worker.ts:
  1. hash(buffer) → contentHash
  2. read Dexie `meta` table (still in worker) → compare hash
       ├─ match → postMessage DUPLICATE { hash } → worker stops here, no unzip/parse/write
       └─ no match → continue
  3. unzipSync(buffer) → { path: bytes } entries
  4. walk entry paths → detect root folder → group remaining paths by first-level category folder name
  5. classify each category name against categories.ts → { supported[], deferred[], unknown[] }
       → postMessage CATEGORY_DETECTED { supported, deferred, unknown }   (UI can render section skeletons early)
  6. clear existing per-category Dexie tables (single-active-dataset replace)
  7. for each supported category folder:
       for each CSV file in it:
         parse (worker-less PapaParse) → defensive column mapping → mojibake fix where applicable
         → postMessage PROGRESS { phase: 'parse', category, pct }
         → bulkPut normalized rows into that category's Dexie table
         → postMessage PROGRESS { phase: 'write', category, pct }
  8. write `meta` row: { hash, uploadedAt, categoriesPresent: supported, categoriesDeferred: deferred+unknown }
  9. postMessage DONE { hash, categoriesPresent, categoriesDeferred, rowCounts }
    ↓
pipelineClient receives DONE/DUPLICATE → updates App State (status: 'ready')
    ↓
Dashboard components (already mounted, subscribed to Dexie liveQuery or triggered by status change) re-query Dexie
    ↓
Each dashboard section:
  - table has rows → render hand-rolled SVG chart
  - table has 0 rows because category was absent from the export → render empty/greyed-out section (per PROJECT.md)
  - category was in `categoriesDeferred` → render "detected but not yet supported" banner, not hidden
    ↓
Login-IP rows specifically: country_code was already attached at write time (worker calls geo lookup during
normalization, so main thread never redoes the binary-search per render) → table + world-atlas SVG map render
directly off the stored country_code column
```

### Duplicate-upload short-circuit

```
Same zip re-uploaded
    ↓
worker hashes buffer → matches existing `meta.hash`
    ↓
DUPLICATE message (no unzip/parse/write cost paid beyond the hash itself)
    ↓
App State → 'ready' directly; dashboards query the Dexie data that's already there
```

### Corrupt / unrecognized zip

```
unzipSync throws, OR no recognizable root/category structure found in step 4
    ↓
worker catches, postMessage ERROR { phase, message, recoverable: false }
    ↓
App State → 'error'; UI shows the generic failure state (per PROJECT.md — not a category-specific error)
```

### Message contract (concrete shapes)

```typescript
// lib/worker/messages.ts — imported by both sides, single source of truth

// Main → Worker
type ToWorker =
  | { type: 'PROCESS_FILE'; payload: { buffer: ArrayBuffer; fileName: string } };

// Worker → Main
type FromWorker =
  | { type: 'PROGRESS'; payload: { phase: 'hash' | 'unzip' | 'parse' | 'write'; category?: string; pct: number } }
  | { type: 'CATEGORY_DETECTED'; payload: { supported: string[]; deferred: string[]; unknown: string[] } }
  | { type: 'DUPLICATE'; payload: { hash: string } }
  | { type: 'DONE'; payload: {
        hash: string;
        categoriesPresent: string[];
        categoriesDeferred: string[];
        rowCounts: Record<string, number>;
      } }
  | { type: 'ERROR'; payload: { phase: string; message: string; recoverable: boolean } };
```

No `CANCEL` message type for v1 — see Anti-Patterns / risk notes below on why this is a deliberate omission, not a gap.

## Scaling Considerations

This app has no server tier to scale — "scale" here means "size of one user's export in one browser tab," not concurrent users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| The verified sample (~2.2MB, ~4.2k rows) | Everything above works with no tuning; unzipSync/worker-less-PapaParse/bulkPut are all comfortably fast at this size |
| An unverified "large veteran" export (assume 10-100x rows, still likely low tens of MB given it's still just CSVs) | Chunk parse+write per-file (already the design above) so progress is granular and the worker never appears to hang; consider `Papa.parse`'s streaming `step` callback instead of parsing a whole CSV into memory at once if any single category file turns out to be unexpectedly large |
| A hypothetical pathological export (hundreds of MB) | Not designed for and not worth designing for pre-emptively — PROJECT.md itself flags this size as an assumption, not a verified requirement; revisit only if real user reports show it |

### Scaling Priorities

1. **First likely bottleneck: single-CSV parse-then-bulkPut-all-at-once for one very large category file.** Fix by streaming PapaParse's `step` callback and batching `bulkPut` calls (e.g. every 500-1000 rows) instead of collecting the entire table in memory before one giant `bulkPut`.
2. **Second: main-thread render cost for large row counts (e.g. a multi-year calendar heatmap or a login-IP table with thousands of rows).** Not a Worker-pipeline concern — this is where PROJECT.md's "table/chart virtualization" constraint applies; keep it in mind when component-boundary planning reaches the dashboard phases, but it's outside this document's scope (ingest pipeline).

## Anti-Patterns

### Anti-Pattern 1: Letting PapaParse or fflate spawn their own nested workers inside `pipeline.worker.ts`

**What people do:** Reach for the library's "keep main thread responsive" flag (`Papa.parse({ worker: true })`, fflate's async `unzip`) by habit, without noticing it's redundant once you're already inside a dedicated worker.
**Why it's wrong:** Nested workers add real, documented friction (PapaParse script-path resolution under bundlers, `transformHeader` serialization failures, IPC stalls between the two workers) for zero benefit — the main thread was never going to be blocked either way.
**Do this instead:** `worker: false` for PapaParse, `unzipSync` for fflate, both called synchronously in sequence inside `pipeline.worker.ts`.

### Anti-Pattern 2: Duplicating the Dexie schema definition between worker and main-thread code

**What people do:** Define the Dexie table/version schema inline wherever it's first needed (once in the worker's write stage, once again in a main-thread query helper) because it's "just a few lines."
**Why it's wrong:** Dexie is version-sensitive; two independently-maintained schema definitions will drift the moment one side adds a column or index, causing confusing runtime errors on whichever side opens the connection second.
**Do this instead:** One `lib/db/schema.ts` module, imported by both sides, exporting the `Dexie` instance factory (or the schema object each side wraps in its own connection).

### Anti-Pattern 3: Treating "categories detected but out of v1 scope" as a worker-side hardcoded list

**What people do:** Hardcode the "10 unscoped categories" list (Bans, Bonus_codes, etc.) directly inside the worker's classifier, separately from whatever list the UI uses to render the "detected but not supported" banner.
**Why it's wrong:** If the export format drifts (PROJECT.md flags this as a real risk — the inspected sample is 5 years old) and a brand-new, never-seen category folder shows up, a worker-only hardcoded list has no "unknown" bucket to fall into — it either crashes the classifier or silently gets dropped, which PROJECT.md explicitly says must not happen ("not hidden and not silently dropped").
**Do this instead:** One shared `categories.ts` with three lists (`SUPPORTED_V1`, `KNOWN_DEFERRED`) and a classifier function that buckets anything matching neither into `unknown` — treated identically to `deferred` in the UI (shown, not hidden), giving the system a defensive fallback for format drift by construction rather than by exhaustive enumeration.

## Integration Points

### External Services

None. Zero network requests after page load is a hard constraint enforced by CI + CSP — there is no "external service" integration point in this architecture, which is itself the point. The one "external data" dependency (DB-IP Lite geo data) is fully resolved at build time into a static bundled asset, not a runtime integration.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Dropzone ↔ Pipeline Client | Direct function call (`pipelineClient.processFile(file)`) | Main-thread-only; no postMessage yet at this hop |
| Pipeline Client ↔ pipeline.worker.ts | `postMessage` / `onmessage`, typed via shared `messages.ts` | The only actual thread boundary in the app; ArrayBuffer sent with a transfer list, ownership moves to the worker |
| pipeline.worker.ts ↔ Dexie (write side) | Direct Dexie API calls from worker code | IndexedDB is available in Worker global scope; no proxying needed |
| Dashboard components ↔ Dexie (read side) | Direct Dexie queries / `liveQuery` from main-thread code | Reads only; never write from main thread — keeps "who mutates the single active dataset" unambiguous (only the worker does) |
| App State ↔ Dashboard components | Svelte 5 runes reactivity (`$state`/`$derived`), no message passing | Ordinary same-thread reactivity once `DONE`/`ERROR`/`DUPLICATE` land in App State |
| Login-IP rows ↔ Geo lookup | Country code attached once, in the worker, at write time | Deliberately not recomputed per render — the binary-search table is loaded once but the per-row cost is paid once, not on every dashboard re-render |
| Build-time geo script ↔ Runtime app | Static asset (`geo-ranges.bin`) produced once, checked into the build output | No runtime relationship at all; do not model this as part of "the pipeline" |

## Risks and Gaps (structurally risky or missing, beyond what PROJECT.md already locked)

1. **Worker lifecycle is undecided in PROJECT.md and must be locked before Phase 1.** A single long-lived worker (Pattern 1 above) is recommended specifically because it's the only option compatible with the "single active dataset, replace on new upload" invariant without extra interrupt/teardown machinery. If left implicit, a worker-per-upload implementation could ship and only reveal its race condition under a fast double-upload — worth an explicit decision + a plan-level note, not just an assumption.

2. **PapaParse `worker:true` and fflate's async `unzip` are easy accidental regressions.** Both libraries default their examples/docs toward "use my worker mode" — a future contributor unfamiliar with this document's reasoning could "helpfully" flip `worker: false` to `worker: true` for "better main-thread responsiveness" without realizing the whole module is already inside a worker. Recommend a code comment at each call site (shown above) plus a note in whatever PITFALLS/lint-rule mechanism the project uses.

3. **Ordering of hash-check vs. unzip is not free in PROJECT.md's decision table and must be fixed:** hash → Dexie meta lookup → early-exit on match, *before* paying the unzip/parse/write cost. Get this ordering wrong (e.g. unzip first, hash-check after) and the "hash-dedup skips re-parsing" requirement silently degrades to "hash-dedup skips re-writing," which still burns CPU on every re-upload.

4. **The three-way category classification (supported / known-deferred / unknown) is not explicit in PROJECT.md** — it currently only names "unscoped categories" as a fixed list. Given the explicit format-drift risk PROJECT.md itself calls out, an `unknown` bucket (Anti-Pattern 3) is structurally necessary, not optional polish — recommend surfacing this as a roadmap-level requirement, not an implementation detail.

5. **No CANCEL/supersede message is defined, and that's a deliberate scope call this document is making, not an oversight** — a simple main-thread busy-guard (disable dropzone during processing) avoids needing one for v1. Flag for roadmap: if UX testing shows users expect to interrupt a long parse, this is the one place the message contract would need to grow (`{ type: 'CANCEL' }` + worker-side abort checks between stages).

6. **Progress granularity depends on chunked parse/write, which is not automatic from "just calling PapaParse/Dexie."** A naive first implementation (parse whole category → one giant bulkPut) will produce a progress bar that jumps 0%→100% per category rather than smoothly — worth calling out at the phase-planning stage as a specific implementation requirement, not just "add a progress bar."

7. **Build-time geo-table generation and the runtime Worker pipeline are two unrelated "pipelines" that share the word "pipeline" — conflating them in phase/plan naming is a real risk.** Recommend distinct terminology in the roadmap (e.g. "ingest pipeline" for the runtime Worker, "geo build step" for the Node script) to avoid a plan accidentally scheduling the geo table generation as if it were a stage of the upload flow, or vice versa.

## Suggested Build Order (dependency-driven — shapes roadmap phase ordering)

1. **Worker contract skeleton.** `messages.ts` + a no-op `pipeline.worker.ts` (echoes PROGRESS/DONE with fake data) + `pipelineClient.ts` + Vite worker import wiring. Proves the postMessage/transferable-ArrayBuffer round trip end-to-end before any real parsing logic exists. Everything else in the pipeline depends on this contract being stable, so instability here is maximally expensive to discover late.
2. **Unzip + category auto-detection.** Real `unzipSync`, real entry-path walking, real classification against `categories.ts`, tested against the actual sample export. Corrupt-zip → generic failure state belongs here.
3. **Defensive CSV parsing.** Worker-less PapaParse per category, mojibake fix, tolerant column mapping. Can be validated in-memory (log parsed rows) before Dexie exists yet.
4. **Dexie schema + write stage.** `db/schema.ts` (shared), `meta` table, per-category tables, clear-then-replace logic, hash-dedup early-exit, chunked `bulkPut`. This is the phase every dashboard phase depends on — nothing downstream can be built against real data until this lands.
5. **App State + page shell.** Runes-based state wired to the four worker message types; single-page layout with placeholder sections for supported/deferred/unknown categories (no real charts yet — just presence/absence + empty/greyed states). This is where the "detected but not yet supported" and "missing category shows empty/greyed" requirements get their first real UI test.
6. **Feature dashboards, parallelizable against each other once step 4 lands.** Activity heatmaps, vehicle stats, financial timeline are independent (different Dexie tables, different SVG components, no shared state beyond App State) — safe to plan/build as separate phases or parallel plans within a phase.
7. **Geo build step + Login-IP/map dashboard.** The `scripts/build-geo-table.mjs` Node script has zero dependency on steps 1-6 and can actually be built earlier/in parallel (even alongside step 1) since it only needs fixture IP data to test the lookup + SVG map rendering. The Login-IP dashboard itself still depends on step 4 (real login-IP rows in Dexie) and on the country_code-at-write-time decision (worker calls the geo lookup during normalization in step 3/4, not at render time).
8. **Cross-cutting polish.** Responsive/mobile layout, Bits UI wiring for tabs/tooltip/popover, table/chart virtualization for large row counts.
9. **Zero-network CI enforcement + deploy.** The Playwright zero-network-requests assertion and CSP can technically be stubbed as early as step 1 (assert no requests happen even in the skeleton state) and then left running throughout, rather than bolted on at the end — recommend treating this as a standing check introduced early, not a final phase.

## Sources

- [fflate README / npm](https://www.npmjs.com/package/fflate) — sync vs. async/worker-parallel `unzip` behavior (HIGH confidence — official docs)
- [fflate GitHub repo](https://github.com/101arrowz/fflate) — async `unzip` parallelizes internally via workers; no `consume` option on async `unzip` (HIGH confidence — official docs)
- [PapaParse Issue #1011 — progress/complete callback discussion](https://github.com/mholt/PapaParse/issues/1011) — explicit maintainer/community guidance: build your own worker and run PapaParse worker-less/streaming inside it, rather than nesting PapaParse's own worker mode (HIGH confidence — project issue tracker, corroborates documented `worker:true` limitations)
- [PapaParse Issue #563 — Papa.SCRIPT_PATH and bundler lazy-loading](https://github.com/mholt/PapaParse/issues/563) — script-path resolution failures under bundlers when using `worker:true` (HIGH confidence — reproducible, widely reported)
- [PapaParse Issue #585 — "window is not defined" using worker](https://github.com/mholt/PapaParse/issues/585) — corroborates worker-mode fragility outside plain browser globals (MEDIUM confidence — one reported case, consistent with pattern)
- General web-platform fact used with MEDIUM-HIGH confidence from broad knowledge, not a single authoritative citation: IndexedDB (and therefore Dexie) is available and functions normally inside dedicated Worker global scope — this is a stable, long-standing Web API guarantee, not something under active dispute; the project's own PROJECT.md already assumes Dexie writes happen in the worker, so this document treats it as a given rather than re-verifying from first principles.
- All component-boundary, message-contract, and build-order recommendations in this document are original synthesis derived from PROJECT.md's locked decisions, not sourced from a third-party architecture reference — flagged as such rather than presented as an external authority's design.

---
*Architecture research for: WG Data Export Viewer (wot-gdpr-stats-visualizer)*
*Researched: 2026-09-27*
