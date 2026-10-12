# Phase 4: Activity Time Dashboards - Research

**Researched:** 2026-09-29
**Domain:** Worker-side time-series aggregation of `Sessions.csv` + hand-rolled Svelte 5 SVG heatmaps at 50k+ sessions
**Confidence:** HIGH on architecture, algorithms and test approach (all measured or read in this session); MEDIUM on real-export format assumptions (only a synthetic Sessions.csv exists in the repo)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Time basis**
- **D-01:** Timestamps are shown and bucketed exactly as written in `Sessions.csv`, with no timezone conversion and no toggle in v1. The day × hour heatmap carries an explicit label along the lines of "as recorded in the export (likely UTC or server time)". The same basis decides which calendar day a session lands on and what counts as an active day. Sessions.csv timestamps carry no timezone, so any conversion would assert a zone the data does not contain. — **Reversibility:** costly — **Reversibility rationale:** the per-day and per-hour aggregates are built on this basis, so adding a local-time mode later means re-aggregating and reworking the chart labels.

**What counts as hours played**
- **D-02:** The hours total merges overlapping sessions so simultaneous play is not double-counted. Each session is attributed to the calendar day it starts on, even when it crosses midnight. Rows whose end is before their start, or that have no end time, are excluded from the totals, and the count of excluded rows is shown on screen alongside the other skipped-row counts (Phase 2 D-04 pattern). Merging happens within the selected slice: under a filter value, overlaps are merged among that value's sessions only. Consequence to explain in copy: the per-value hours listed in the summary can add up to more than the "All" total, because "All" also merges overlaps across values. — **Reversibility:** reversible

**Split by session column**
- **D-03:** A selector above the Playtime charts lets the user pick "All" (default) or one value of the session column that identifies the title. Picking a value filters every chart and every total. The summary also lists each value's hours next to the "All" figures so the split is visible without clicking. Sessions.csv has no game column, only `CLIENT_PLATFORM` and `SERVER_NAME` (the synthetic fixture uses `win` and `eu-1`, which look like platform and server, not game). Research must inspect the real 2021 sample to decide which column identifies the title; if neither does, the selector is labelled with the column's true name and never claims "game". This covers Sessions only. Per-title breakdowns of Player_statistics remain Phase 5 (Phase 3 D-11). — **Reversibility:** costly — **Reversibility rationale:** the aggregation shape (per-slice buckets), the worker/message contract and every chart's input depend on the selector existing, so retrofitting or removing it touches all four charts.

**Calendar heatmap**
- **D-04:** Each cell shows hours played for that day. All years are stacked on one page, each with a year label that stays readable while scrolling (no year picker), so a decade-long account is visible at a glance. The colour scale is percentile- or log-based, never linear min-max, so ordinary days stay distinguishable from outlier days. The tooltip shows date, hours and session count, and opens on hover and on keyboard focus (touch support is Phase 7). Rendered SVG node count scales with days, not sessions. — **Reversibility:** reversible

**Session-duration distribution**
- **D-05:** Log-scaled bins, so seconds-long and multi-hour sessions both stay readable. Bin edges and labels are Claude's discretion, but the bin count is bounded and labels are human-readable durations (for example "5-10 min"), not raw log values. No separate outlier bucket is required, since the log scale absorbs long sessions. — **Reversibility:** reversible

**Totals summary (ACTIVITY-01)**
- **D-06:** The summary shows total hours, total sessions and active days for the selected slice (D-03), with the excluded-row count (D-02) visible near it.

### Claude's Discretion
- Whether the split's aggregates are precomputed per slice in the worker at import and stored on the dataset meta record, or queried on demand from the rows table. Either way the worker stays the only Dexie owner (Phase 2 rule) and the main thread never scans raw rows.
- Extra statistics such as median or percentile text under the duration chart. The user chose log-scaled bins only, so add nothing unless it is cheap and clearly useful.
- Exact colour palette (within the Phase 2 palette and the contrast checks already in `tests/unit/contrast.test.ts`), cell size, tooltip styling, bin edges and labels.
- Data-table or text fallback for the charts, and ARIA labelling beyond keyboard-focus tooltips.

### Deferred Ideas (OUT OF SCOPE)
- A local-timezone toggle for the heatmaps — revisit if real exports show a reliable timezone basis.
- Median and percentile statistics for session length — optional, see Claude's Discretion.
- Touch-friendly tooltips and phone-width chart layout — Phase 7.
- Per-title Player_statistics breakdown — Phase 5.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACTIVITY-01 | Total hours / sessions / active days summary | Merge-aware sweep gives `seconds`, `sessions`, `activeDays` per slice in one pass; excluded count per slice; `formatHours` boundary cases listed in Pitfalls |
| ACTIVITY-02 | Calendar heatmap, year-by-year, aggregated per-day (not one SVG node per session) | Per-day arrays (`dayIndex`/`daySeconds`/`daySessions`) are the only calendar input; geometry, 54-column bound and rank scale verified; node-count scaling test designed |
| ACTIVITY-03 | Day-of-week × hour-of-day heatmap, aggregated per-bucket | Two 168-cell grids stored (`hourOverlap`, `hourStart`) so the pending attribution decision is a one-constant swap; O(168) week-peeling algorithm verified against a per-second oracle |
| ACTIVITY-04 | Session-duration distribution | 12 fixed bins over raw session length; bin counts sum to the Sessions tile by construction |
</phase_requirements>

## Summary

Phase 4 turns rows already sitting in Dexie into four views. The load-bearing decision is where aggregation runs. I built a throw-away prototype of the exact algorithm and measured it in Node (V8, the same engine as Chrome): parsing 50,000 timestamp pairs takes about 50-70 ms, and the merge-aware sweep for the All slice plus five split slices takes about 40-50 ms in total; 250,000 sessions take under 0.6 s and 1,000,000 take about 4 s. Aggregation is therefore cheap next to the CSV parse and the Dexie write the import already performs, and at import time the rows are already in memory (`allRows` in `ingest.worker.ts`), so computing there costs no extra I/O. **Recommendation: precompute every slice inside the import worker and persist the result on the existing `DatasetMeta` record in the same `writeDataset` transaction (the D-20 identity precedent), keep aggregates out of `ClassifyResult` entirely, and serve one slice per request over a new `playtime-query` message.** No Dexie schema change is needed, so **no `version(3)`**: `meta` is declared as `'id'` only, non-indexed fields ride along for free (the Phase 3 `identity` field is the in-repo proof), and Dexie's docs say only indexed properties need listing. A lazy "recompute from the `rows` table" path is still required for caches written before this phase (they have no `playtime` field) and doubles as the version-bump mechanism for the aggregate shape.

The second decision is how the UI-SPEC's two undecided points are made cheap. The weekday × hour attribution question is resolved by storing both grids (overlap basis and start-hour basis, 336 numbers per slice); the UI picks one through a single constant. The "which column is the title" question cannot be answered from the repo: `tests/fixtures/private/` does not exist (verified), so the planner must implement the UI-SPEC rule (`SERVER_NAME`, then `CLIENT_PLATFORM`, 2-50 distinct values) as a pure function and unit-test it on hand-built distributions, plus schedule a human check against a real export.

The third decision is testability under a jsdom-free Vitest. All logic (timestamp parsing, sweep, percentile scale, calendar geometry, keyboard navigation, tooltip clamping, date formatting, request bookkeeping) goes into pure `.ts` modules with no runes; the Svelte components stay thin and are covered by Playwright. The large-fixture scale criterion is proven twice: at model level in Vitest (cell counts are a function of active years only) and at DOM level in Playwright by comparing the SVG node count of a 5,000-session export with a 60,000-session export over the same years (the counts must be equal). Playwright's Chromium cannot be downloaded in this sandbox, so e2e verification has to run in CI or as a human-verify step.

**Primary recommendation:** Compute all slices in the worker at import from in-memory rows, store them on `DatasetMeta.playtime` (no Dexie version bump, no `ClassifyResult` change), fetch one slice at a time via `playtime-query`/`playtime-result` keyed by the dataset's `importedAt`, and backfill lazily from `rows` for older caches.

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` is a one-line `@AGENTS.md` include. Directives the planner must honour (same authority as locked decisions):

- Zero network requests after load; CSP `connect-src 'none'`; no analytics. Enforced by the Playwright guard and lint bans on `fetch`/`XMLHttpRequest`/`WebSocket`/etc. under `src/` (including `src/lib/worker/`).
- Svelte 5 runes only (no Svelte 4 patterns); Vite; **pnpm**; TypeScript `^6`; no SvelteKit/router; **no chart library and no bits-ui** (charts hand-rolled deliberately); dependency minimalism (this phase adds **no packages**).
- **The worker is the sole Dexie owner**; the main thread talks to it only through typed messages. One long-lived worker; `Papa.parse({ worker: false })` and fflate `unzipSync` inside it.
- Chart aggregation at scale: aggregate per bucket, never one SVG node per session/row; verify against a synthetic large fixture.
- CSP forbids inline styles; `svelte/no-inline-styles` and `svelte/no-at-html-tags` are **errors** in this repo. Cell fills are classes, geometry is attributes, tooltip position is set through the CSSOM.
- `IP` is never read, rendered, or put in any attribute in this phase (Phase 6 owns IP display).
- All copy in `src/lib/ui-copy.ts` with tests in `tests/unit/ui-copy.test.ts`.
- Chrome-first; phone width must not break (polish is Phase 7).
- Commits: **no `Co-Authored-By:` trailer** (project rule overrides tool defaults). Research phase itself does not commit.
- Real exports are PII: `tests/fixtures/private/` (gitignored, currently absent) is the only place a real sample may live; synthetic fixtures are generated in memory.
- Project skill `run-data-export-viewer` (`.claude/skills/run-data-export-viewer/`): its `driver.mjs` builds its own zip whose Sessions.csv is `SESSION_ID;START_AT` (see Pitfall 12); it must be updated in this phase and gain a Playtime screenshot.
- `workflow.tdd_mode: true`, `nyquist_validation: true`, `security_enforcement: true` (ASVS 1) in `.planning/config.json`.

## Architectural Responsibility Map

This app has no server; the tiers are the import worker, IndexedDB, and the main thread.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Timestamp parsing, interval merge, per-day / per-hour / per-bin aggregation, split-column choice | Import worker (`src/lib/worker/`) | — | Touches every raw row; main thread must never scan rows; pure so it is Node-testable |
| Persisting aggregates | IndexedDB (worker-owned, `DatasetMeta.playtime`) | — | Same atomic transaction as the rows (identity precedent); return visits need no row scan |
| Serving one slice | Import worker (`playtime-query` handler) | Main thread (`PlaytimeClient`) | Worker is the only Dexie reader; main thread keeps latest-wins bookkeeping |
| Percentile colour scale, calendar geometry, year summaries, keyboard navigation, tooltip clamp, date/hours formatting | Main thread, pure modules (no runes) | — | Works on ≤ ~5.5k day entries + 168 cells; must be unit-testable without a DOM |
| Rendering (tiles, table, SVG heatmaps, duration list, tooltip, live region) | Main thread, Svelte components | — | Thin glue over the pure models; verified by Playwright |
| Selector state and dataset-change reset | Main thread component, keyed by `importedAt` | — | Derived rather than stored, so a stale value can never render |
| Status `ready` for Activity_history | `dashboard-status.ts` (`BUILT_DASHBOARDS`) | — | The one derivation the nav and cards share (Phase 3 D-08) |

## Standard Stack

### Core
No new runtime or dev dependencies. The phase uses what is installed.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | `^5.57.0` (installed 5.57.1) | Runes components | Locked stack. `$state.raw` and `untrack` exist in the installed types [VERIFIED: node_modules/svelte/types/index.d.ts, `$state.raw`, `export function untrack<T>(fn: () => T): T;`] |
| dexie | `^4.4.6` | `meta` record holds `playtime`; worker-only | Locked; non-indexed fields need no schema entry |
| papaparse | `^5.7.0` | Already parses Sessions.csv in the worker | No change |
| vitest | `^5.0.2` | Unit tests, Node environment | Locked |
| @playwright/test | `^1.63.0` | e2e and node-count assertions | Locked |
| fake-indexeddb | `^6.2.5` | Worker-level unit tests | Already in `tests/unit/setup.ts` |

[VERIFIED: package.json dependencies and devDependencies; installed versions from `pnpm install --frozen-lockfile` output this session: svelte 5.57.1, vite 8.3.1, vitest 5.0.2, typescript 6.0.3, fake-indexeddb 6.2.5]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Precompute at import, store on meta | On-demand query over `rows` per selection | On-demand re-reads ~50k rows through IndexedDB on every selector change and every return visit. Same compute, plus I/O (fake-indexeddb: 338 ms to read 50k rows; real Chrome cost unmeasured, [ASSUMED] 0.1-0.5 s). Keep it only as the backfill path |
| Separate `playtime` table | Field on `meta` | A table needs `version(3)` and re-declaring stores; buys nothing at ~1-2 MB |
| Store compact session columns, aggregate per query | Store per-slice aggregates | Columns would make a future local-time toggle cheap, but the required backfill-from-rows path already provides re-aggregation; not worth the extra stored shape |
| `d3-scale` / a percentile library | ~15-line pure function | Project forbids runtime chart libs; the rank rule is 10 lines and must match the UI-SPEC exactly |

**Installation:** none.

**Version verification:** not applicable, no packages are added. Baseline before any change: `pnpm run test:unit` = 15 files, 330 tests passing in 4.9 s [VERIFIED: run this session].

## Package Legitimacy Audit

No external packages are installed or upgraded by this phase, so the legitimacy seam was not run. If a plan ever adds one, the Phase 1 package-gate applies and it must be tagged `[ASSUMED]` until verified.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                       IMPORT (once per dataset)
 zip bytes ─▶ unzipSync ─▶ Papa.parse per CSV ─▶ allRows[] (in memory, already exists)
                                                    │
              rows where category = Activity_history│and sourceFile = Sessions.csv
                                                    ▼
                    ┌──────────── buildPlaytime(rows) ── src/lib/worker/playtime.ts (pure) ───────────┐
                    │ 1. per row: read SESSION_START / SESSION_END / SERVER_NAME / CLIENT_PLATFORM     │
                    │    only (never IP). parse "YYYY-MM-DD HH:mm:ss" as wall clock, no zone           │
                    │ 2. invalid start/end or end<start  ─▶ excluded++ (per value, and All)            │
                    │ 3. choose split column: SERVER_NAME then CLIENT_PLATFORM, 2..50 distinct values  │
                    │ 4. for All and for each value: sort by start, sweep {covered-until}:             │
                    │      inc = max(0, end - max(start, covered))   ── merged seconds                 │
                    │      day[startDay] += inc, sessions++ ; hourOverlap += inc segment by hour       │
                    │      hourStart[startHourCell] += inc ; bins[len bucket]++ (raw length)           │
                    └───────────────────────────────┬──────────────────────────────────────────────────┘
                                                    ▼
   writeDataset(hash, root, categories, rows, identity, playtime)  ── ONE Dexie tx ──▶ meta.playtime
                                                    │
        ClassifyResult (unchanged, small; importedAt = dataset key) ──▶ done/duplicate/cache-status
                                                    │
                          MAIN THREAD              ▼
   Playtime block ($effect keyed on result.importedAt) ─ playtime-query{queryId,valueIndex} ─▶ worker
                                                                                                   │
   PlaytimeClient (latest-wins by queryId, drops importedAt mismatches) ◀─ playtime-result ◀───────┘
        │      {importedAt, view: no-session-file | no-usable-sessions | ready{split, slice}}
        ▼                              worker: checkCache() ─ meta.playtime? ─ else recompute from rows,
  pure models (playtime-model.ts): rank scale, calendar geometry, hour grid, duration rows,          write back guarded by importedAt
  year summaries, key navigation, tooltip clamp, date/hours formatting
        ▼
  thin Svelte components: tiles, split table, calendar (≤366 rects/active year), 168-cell grid, 12 bins
```

### Recommended Project Structure
```
src/lib/
├── civil-date.ts              # NEW pure: daysFromCivil, civilFromDays, weekdayOfDay (used by worker AND UI)
├── playtime-shared.ts         # NEW pure constants: DURATION_BIN_EDGES_SECONDS, MAX_SPLIT_VALUES=50, SPLIT_COLUMNS
├── playtime-model.ts          # NEW pure, main thread: rank scale, calendar/hour/duration models, key nav, tooltip clamp
├── playtime-client.svelte.ts  # NEW: request/latest-wins bookkeeping (see setup.ts shim note)
├── worker/
│   ├── playtime.ts            # NEW pure: parse, buildPlaytime, viewFromAggregates, isSessionsRow
│   ├── db.ts                  # MODIFY: DatasetMeta.playtime?, writeDataset 6th optional param, backfill write
│   └── ingest.worker.ts       # MODIFY: collect sessions rows, call buildPlaytime, handle playtime-query
├── types/worker-messages.ts   # MODIFY: PlaytimeSlice/View types + 3 message variants
├── worker-client.svelte.ts    # MODIFY (small): own a PlaytimeClient, delegate playtime-* responses
├── dashboard-status.ts        # MODIFY: BUILT_DASHBOARDS = new Set(['activity-history'])
├── ui-copy.ts                 # MODIFY: all Playtime copy + formatHours etc.
└── components/
    ├── Dashboard.svelte       # MODIFY: pass <Playtime> as the activity-history children snippet
    └── Playtime*.svelte / Calendar / HourGrid / DurationList / ChartTooltip   # NEW, names at planner discretion
src/app.css                    # MODIFY: --ramp-0..--ramp-5 custom properties (single source of the ramp)
tests/fixtures/sessions-fixtures.ts   # NEW: seeded generator + zip builder + expected values
tests/unit/{playtime,playtime-model,civil-date,playtime-client}.test.ts   # NEW
tests/e2e/playtime.spec.ts, playtime-scale.spec.ts                        # NEW
```

### Pattern 1: Aggregates on the meta record, served one slice at a time (recommendation for Focus 1 and 2)

**What:** `writeDataset` gains an optional sixth parameter `playtime`, written in the same `meta.put` as the rows, exactly like `identity`. The main thread never receives the stored object.

**Why this shape, from the real code:**
- `DatasetMeta` and the schema [VERIFIED: src/lib/worker/db.ts:37-52, 90-98]:
  - `export interface DatasetMeta { id: 'active'; hash: string; accountRoot: string; importedAt: string; categories: CategoryEntry[];` … `identity?: AccountIdentity | null; }`
  - `rows: '++id, category, sourceFile',` and `meta: 'id',`
  A new non-indexed field on `meta` needs no schema change. Dexie states "Unlike SQL, you don't need to specify all properties but only the one you wish to index." [CITED: https://dexie.org/docs/Version/Version.stores()]. The statement in the phase brief that this "needs Dexie `version(3)`" does not hold for the meta-field design. `version(3)` is only needed if a new table or index is introduced. If a plan does add one, the comment at db.ts:75-77 applies: keep `version(2)` with its upgrader.
- The write is atomic with the rows [VERIFIED: src/lib/worker/db.ts:129-135]: `await db.transaction('rw', db.rows, db.meta, async () => {` … `await db.meta.put({ id: 'active', hash, accountRoot, importedAt, categories, identity });`.
- The identity precedent [VERIFIED: src/lib/worker/ingest.worker.ts:110-118]: `resultFromMeta` is the one replay helper and lists fields explicitly (`accountRoot`, `categories`, `counts`, `importedAt`, `identity`). Do **not** add aggregates here and never spread `...meta` into a message: `IngestClient.result` is a deep `$state` proxy and would wrap 17k+ numbers on every replay. The only thing the main thread needs from the dataset is `importedAt`, which `ClassifyResult` already carries (`importedAt?: string`, worker-messages.ts:26-32).
- Payload per response is bounded: at most one slice = ≤ ~5,500 day entries for 15 years (3 numbers each) + 336 grid cells + 12 bins, plus a ≤ 50-entry values list.

**Stored shape (proposed; arrays only, so untrusted value strings are never object keys):**
```ts
export interface PlaytimeSlice {
  seconds: number;        // merged seconds (D-02)
  sessions: number;       // usable sessions
  excluded: number;       // rows with missing/invalid start or end, or end < start
  dayIndex: number[];     // ascending days since 1970-01-01 of the as-recorded start day
  daySeconds: number[];   // merge-aware seconds attributed to that start day
  daySessions: number[];  // usable sessions starting that day
  hourOverlap: number[];  // 168 = weekday(Mon=0)*24 + hour, seconds overlapping the cell
  hourStart: number[];    // 168, same cells, attributed to the session's START hour
  bins: number[];         // 12, raw session length bins
}                          // activeDays = dayIndex.length (derive, do not store)
export interface PlaytimeAggregates {
  v: 1;                                   // bump => treated as absent => recomputed from rows
  sessionsFileSeen: boolean;              // false => no-session-file
  splitColumn: 'SERVER_NAME' | 'CLIENT_PLATFORM' | null;
  values: (string | null)[];              // index -> value; null = blank ("(not recorded)"); seconds-desc, ties asc
  all: PlaytimeSlice;
  byValue: PlaytimeSlice[];               // parallel to `values`
}
```

**Messages (Focus 2):**
```ts
// IngestRequest += 
{ type: 'playtime-query'; queryId: number; valueIndex: number | null }   // null = All
// IngestResponse +=
{ type: 'playtime-result'; queryId: number; importedAt: string | null; view: PlaytimeView | null }
{ type: 'playtime-error'; queryId: number; detail: string }
type PlaytimeView =
  | { status: 'no-session-file' }
  | { status: 'no-usable-sessions'; excluded: number }
  | { status: 'ready'; split: { column: 'SERVER_NAME' | 'CLIENT_PLATFORM';
                                values: { value: string | null; seconds: number }[];
                                allSeconds: number } | null;
      selected: number | null; slice: PlaytimeSlice };
```
- **Own id namespace.** `IngestClient` gates terminal messages on `msg.jobId !== this.#jobId` [VERIFIED: src/lib/worker-client.svelte.ts:485-486: `if (this.state !== 'processing') return;` / `if (msg.jobId !== this.#jobId) return;`]. If a query bumped `#jobId`, a selector change during a replace would make the in-flight `done` be ignored and hang the page in `processing`. Queries therefore use their own `queryId` counter and their own message types. Do **not** reuse the `error` type: its branches key on `jobId` and would mishandle it.
- **Delegation.** `WorkerLike.onmessage` has one owner, `IngestClient`. Add a `PlaytimeClient` field to it and, at the top of `#handle`, route `playtime-result`/`playtime-error` to it. `#handle` currently falls through silently for unknown types, so this is a two-line change and cannot disturb the Phase 3 state machine (add 2-3 regression tests in `ingest-client.test.ts`: a `playtime-result` during `processing` leaves `state`, `result` and the settle timer untouched).
- **Dataset identity is structural.** The component keys everything on `result.importedAt` (a primitive, so a `duplicate` reply that swaps the `result` object for an equal one does not re-fire the effect or reset the selection). `PlaytimeClient` stores `{ importedAt, view }`; the block renders `loading` whenever the stored `importedAt` differs from the current one, and the selected index is stored with its `importedAt` and treated as All when they differ. That satisfies "resets whenever the dataset id changes, on clear, and never shows a stale value" with no reset hooks. A response is accepted only if `queryId` is the latest **and** `importedAt` equals the current dataset's.
- **Behaviour matrix (Phase 3 D-26/D-27/D-28):**

| Event | Result | Playtime |
|-------|--------|----------|
| Replace in flight | old `result` stays (D-27) | old slice stays interactive. A query answered after the new commit but before the 400 ms settle floor returns the new dataset's `importedAt`, is dropped by the mismatch guard, and the effect re-queries when `result` changes (selection resets to All) |
| Failed import | `result` unchanged | nothing changes; no effect re-run |
| Duplicate drop | new object, same `importedAt` | no re-query, selection kept |
| Clear / Start over | `result = null` → sections `not-loaded` → block unmounts | any late response is dropped (`importedAt` no longer matches / no dataset) |
| Return visit | `cache-status` sets `result` | effect issues one query; brief `loading` (UI-SPEC state) |
| Query fails | — | `playtime-error` → `error` state; dataset untouched |

- **Worker query handler.** `checkCache()` → if `meta === null` reply `{ importedAt: null, view: null }`; else use `meta.playtime` when `v` matches, otherwise recompute from `rows` (Pattern 2), then `viewFromAggregates(agg, valueIndex)` (an out-of-range `valueIndex` falls back to All). Read `meta` per query (about a 1-2 MB structured clone; fake-indexeddb read 300k numbers in 38 ms) and keep **no worker-side cache**: a cache would need invalidation on ingest and clear, and forgetting one is exactly the stale-data bug this design otherwise makes impossible.
- **Import must not fail because aggregation failed.** Wrap `buildPlaytime` in try/catch in `handleIngest`; on failure log to `console.error` (no row contents) and store `playtime: null`, so the first query recomputes and, if it fails again, reaches the UI's `error` state ("Your imported data is unchanged").

### Pattern 2: Lazy backfill from `rows` for caches written before this phase

Caches created under Phase 3 have `meta` without `playtime` (and the site is not deployed until Phase 7, so this mostly protects developer machines and the `v` bump path). On the first query: read Sessions rows, run the same `buildPlaytime`, then write back **only if the dataset is still the same** inside one transaction:
```ts
await db.transaction('rw', db.meta, async () => {
  const current = await db.meta.get('active');
  if (current && current.importedAt === meta.importedAt) await db.meta.update('active', { playtime });
});
```
The guard matters: `writeDataset` replaces the whole record with `meta.put`, and a stale `update` landing after a replace would attach the old dataset's aggregates to the new one.

**Reading the rows: avoid `anyOf`.** Probed with the repo's fake-indexeddb (3,000 rows, 2,700 matching): `where('sourceFile').equals('Sessions.csv')` 27 ms, `db.rows.filter(pred)` 46 ms, `where('category')` 28 ms, but `where('sourceFile').anyOf([...two keys])` **2,243 ms** [VERIFIED: local probe this session]. Use `db.rows.orderBy('sourceFile').uniqueKeys()` (index-only, 9 ms), keep the keys whose lower-case is `sessions.csv`, then one single-key `where('sourceFile').equals(key)` per key, and filter `category.toLowerCase() === 'activity_history'` in JS. Category names keep their raw case (`classifyFolder` is case-insensitive and the entry keeps the name), so an equality on the `category` index alone would miss a `activity_history` folder. Define one shared predicate `isSessionsRow(category, sourceFile)` (case-insensitive `activity_history` category and `sourceFile.toLowerCase() === 'sessions.csv'`) and use it on both the import path and the backfill path so they cannot diverge. `resolveCsvFileCategory` returns `{ category, sourceFile: rest }` where `rest` is the path under the category [VERIFIED: src/lib/worker/classify.ts:442-444], so nested paths are possible in principle; the exact-equality predicate deliberately ignores them on both paths.

A legacy cache cannot distinguish "no Sessions.csv" from "header-only Sessions.csv" (zero rows either way); on a backfill with zero session rows report `no-session-file`. New imports set `sessionsFileSeen` from the parse loop, so they are exact.

### Pattern 3: The merge-aware sweep (one pass gives every number)

For a slice, sort usable sessions by start, keep `covered` (latest end so far). For each session: `inc = max(0, end - max(start, covered))`, then `covered = max(covered, end)`.

- merged seconds = Σ `inc` (D-02 overlap merge, per slice).
- calendar: `daySeconds[startDay] += inc`, `daySessions[startDay] += 1` (D-02 start-day rule). Because this attributes only the *new* seconds, Σ `daySeconds` equals the total exactly, so year-head totals reconcile with the tile. This is my interpretation of D-02 + D-04 (tagged in the Assumptions Log): the alternative (raw length per day) would let the calendar exceed the tile whenever sessions overlap.
- weekday × hour, overlap basis: add the segment `[end - inc, end)` to the 168 grid by hour; start basis: add `inc` to the cell of the session's start hour. Both sum to the same total.
- duration bins use the **raw** length `end - start` (a fully-contained session still counts as a session of its own length), so Σ bins = sessions.
- Days come out ascending for free (sessions are processed in start order): document that as an invariant and test it.

Measured with the prototype (Node 22, this sandbox; the prototype is not committed):

| Sessions | Years | timestamp parse | All-slice sweep | 5 split slices | distinct days |
|---------:|------:|----------------:|----------------:|---------------:|--------------:|
| 4,200 | 1 | 11.7 ms | 8.5 ms | 7.7 ms | 365 |
| 50,000 | 12 | 70.3 ms | 29.5 ms | 17.3 ms | 4,380 |
| 50,000 | 15 | 52.4 ms | 21.8 ms | 20.1 ms | 5,475 |
| 250,000 | 15 | 320.6 ms | 148.0 ms | 103.2 ms | 5,475 |
| 1,000,000 | 15 | 2,525.6 ms | 982.9 ms | 859.8 ms | 5,475 |

Import-time cost at 50k sessions is therefore ~0.1 s on top of a pipeline that already parses CSV and writes to IndexedDB. [VERIFIED: local benchmark this session]

### Pattern 4: Hour-grid overlap in O(168) regardless of session length

A naive loop over hours is unbounded for a corrupt row (a start in 2010 and an end in year 9999 is ~70M hours). Peel the partial head hour, the partial tail hour, and whole weeks of interior hours, then loop over fewer than 168 leftover hours. Verified against a per-second oracle on 300 random spans (including pre-1970 starts and spans up to ~35 days): 0 mismatches; an 8,000-year span takes 0.04 ms and still sums exactly. [VERIFIED: scratch test this session]

### Pattern 5: Pure model modules + thin components (Focus 6)

The repo's Vitest has no DOM and no Svelte compiler on purpose (see the header comment of `vitest.config.ts`), and `tests/unit/setup.ts` shims **only** `$state` [VERIFIED: tests/unit/setup.ts:40: `(globalThis as unknown as { $state: <T>(value: T) => T }).$state = <T>(value: T): T => value;`]. Consequences:
- Every decision goes in `.ts` modules with no runes and is imported by both the component and the test (the `dashboard-status.ts` / `scroll-spy.ts` pattern).
- `PlaytimeClient` uses `$state.raw` (avoids deep-proxying arrays). That is **not** shimmed, so either add one line to `setup.ts` (`$state.raw = <T>(v: T): T => v`) or keep the latest-wins logic in a rune-free class and let the component hold the reactive cell. Prefer the rune-free class; it needs no setup change.
- Do not write to reactive state in an `$effect` that also reads it; wrap the query dispatch in `untrack`.

### Pattern 6: SVG grids under this repo's lint and CSP (probed this session)

- A probe `<svg role="grid" onkeydown=… >` with `role="row"` groups and `role="gridcell"` `<rect tabindex="-1|0">` children: `eslint` exit 0 (no findings), `svelte-check` 0 errors and 1 warning `a11y_interactive_supports_focus` ("Elements with the 'grid' interactive role must have a tabindex value"). Warnings do not fail `pnpm run check` (script has no `--fail-on-warnings`), but keep the tree clean: put `tabindex="-1"` on the `<svg>` (or the outer wrapper that owns the key handler) or add a targeted `<!-- svelte-ignore a11y_interactive_supports_focus -->` like `Dropzone.svelte:107` does for another rule. `prettier --check` failed on the unformatted probe, so run `pnpm run format` on new `.svelte` files. [VERIFIED: probe run and removed this session]
- Svelte 5 delegates these events at the root: `focusin`, `focusout`, `keydown`, `pointerout`, `pointerover`, … [VERIFIED: node_modules/svelte/src/utils.js:110-134, entries `'focusin'`, `'focusout'`, `'keydown'`, `'pointerout'`, `'pointerover'`]. So `onpointerover`/`onkeydown` on the per-cell elements cost one root listener, satisfying UI-SPEC "one delegated listener, never one per node". `pointerleave`/`mouseleave` are **not** delegated; use `pointerout` + `focusout` for hide.
- CSP: `style.left = …` on an element is allowed without `'unsafe-inline'`; `setAttribute('style', …)` and `style.cssText` are blocked. [CITED: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src] The build policy is `"default-src 'self'"`, `"connect-src 'none'"`, … [VERIFIED: vite.config.ts:17-23], so the UI-SPEC tooltip approach (CSSOM) is valid. `svelte/no-inline-styles` (eslint.config.js:192) only inspects markup.
- Focus ring: an SVG stroke on a cell is painted under later siblings. Use one extra overlay `<rect>` drawn last, positioned by attributes from the "active cell" state; suppress the browser outline on cells. Show it only for keyboard focus (a flag set on `keydown`, cleared on `pointerdown`), not on every mouse-click focus.
- Roving `tabindex`: one `0`, the rest `-1`, on up to ~5.5k rects is fine.

### Anti-Patterns to Avoid
- **Aggregates inside `ClassifyResult`/`resultFromMeta`:** deep-proxied by `$state`, re-shipped on every replay, and it couples the Phase 3 contract to Phase 4.
- **`new Date('YYYY-MM-DD HH:mm:ss')` or `toLocaleDateString` for anything derived from the CSV:** the space-separated form is not an ISO string; engines parse it as local time, which is precisely the conversion D-01 forbids, and local midnights do not exist on DST gaps. Use the civil-date functions.
- **Per-session or per-node listeners, per-session SVG nodes:** the scale criterion.
- **Reusing `jobId` or the `error` message type for queries:** breaks the ingest state machine.
- **`anyOf` on the `sourceFile` index** (see Pattern 2).
- **Object keys from untrusted strings** (`SERVER_NAME` = `__proto__`): use arrays/`Map`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic from `YYYY-MM-DD` | `Date` parsing in local time, or a month-length lookup per call | Hinnant `daysFromCivil` / `civilFromDays` (18 lines each, in `civil-date.ts`) | Verified identical to `Date` over every 7th day from years 1000 to 9999 (0 mismatches), no timezone, no DST, no `Date.UTC` two-digit-year (`0-99` → 1900+) trap |
| Weekday of a day index | `Date#getDay` | `((day + 3) % 7 + 7) % 7`, Monday = 0 | 1970-01-01 was a Thursday; verified against `Date` |
| Interval union | Pairwise overlap checks | Sort + `covered` sweep (Pattern 3) | O(n log n), gives per-day and per-hour attribution as a by-product |
| Hour distribution of long spans | Per-hour loop | Head/tail/whole-week peel (Pattern 4) | Bounded work on corrupt rows |
| Percentile colour levels | A charting library | `rankLevels(values)` (Code Examples) | Must match the UI-SPEC's exact tie/collapse rule |
| Tooltip placement | A popover library | Pure `clampTooltip(rect, tip, viewport, navOffset)` returning left/top | UI-SPEC rule is 4 lines; testable |
| Rows → CSV for the fixture | A CSV library | String join with the fixture's `CR` convention | Existing fixtures already do this |

**Key insight:** every hard part of this phase is small integer arithmetic on seconds. Keeping it in pure functions over integer seconds (no floats until formatting) makes ties exact, lets the same `civil-date.ts` serve the worker and the UI, and makes the whole phase testable without a DOM.

## Common Pitfalls

### Pitfall 1: Timestamps parsed as local time
**What goes wrong:** `new Date('2020-06-01 12:00:00')` is interpreted in the viewer's zone; a session lands on a different day or hour for different viewers, and D-01's label becomes false.
**How to avoid:** regex + `daysFromCivil`, treating the digits as wall-clock seconds. Validate month 1-12, day within the month (leap-aware), hour ≤ 23, minute/second ≤ 59; reject anything else as invalid (counted in `excluded`). Accept an optional fractional part and a trailing `Z`; treat any other suffix (`+03:00`) as invalid rather than silently ignoring an offset (Open Question 3).
**Warning signs:** the unit test that cross-checks against `Date.UTC` digits passes only when the generator formats via `Date` while the code under test uses civil arithmetic; a failing cross-check shows a parse bug.

### Pitfall 2: Header keys are not normalised
**What goes wrong:** PapaParse does not trim or upper-case headers (see `identity.ts` `normalizeKey`, `key.trim().toUpperCase()`). A padded ` SESSION_END` finds nothing and the whole file is "excluded".
**How to avoid:** resolve the four needed columns through a trim + upper-case match, first match wins, and read **only** those four values. A unit test passes a row whose `IP` property is a throwing getter to prove the value is never read.

### Pitfall 3: Split column value collisions and untrusted strings
**What goes wrong:** a real value literally equal to `(not recorded)` collides with the blank label; a value `__proto__` corrupts an object map.
**How to avoid:** store blank as `null` in `values`, label it in `ui-copy.ts`; identify the slice by **index** into `values` (the selection is `number | null`, where `null` means All); group with a `Map`.

### Pitfall 4: Zero-second days and contained sessions
**What goes wrong:** a zero-length session, or one fully inside an earlier session, adds a session and an active day but 0 seconds. The cell is level 0 ("never given a shade") yet `sessions > 0`.
**How to avoid:** the tooltip/aria text must key off `sessions`, not off the level (`0 min · 1 session`, `formatHours(0)` = `0 min`). Test it explicitly. Active days = days with ≥ 1 usable session, which can exceed the number of shaded cells.

### Pitfall 5: Percentile ties and the legend
**What goes wrong:** many identical days make the cut points equal; naive level assignment leaves unused shades or divides by zero.
**How to avoid:** on **integer seconds** of the non-zero values, sorted ascending with count `n`: `cut_k = v[min(n-1, ceil(n*k/5) - 1)]` for k = 1..4; level = first `k` with `v <= cut_k`, else 5; zero is level 0. Levels keep their ramp colour and simply go unused (the legend prints only levels in use). Print "Darkest: more than {cut_4}" only when level 5 is in use (a lone level omits it, per the UI-SPEC). Unit-test n = 0, 1, 2, all-identical, and a heavy-tail case.

### Pitfall 6: Sticky year head, scroll margin and the nav
**What goes wrong:** the head sits inside the scroller (sticks to the wrong container), its summary wraps at narrow widths so its real height is not 32 px, and `scroll-margin-top` on an SVG `<rect>` may not be honoured [ASSUMED for SVG children].
**How to avoid:** head is a **sibling** of the scroller (UI-SPEC). Expose one custom property for the head height and give it two fixed values (single line / wrapped) via a width media query, or force one line with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and keep the full text in the year's accessible name. The nav is `position: sticky; top: 0; z-index: 1` and is a single non-wrapping row [VERIFIED: src/lib/components/DashboardNav.svelte `position: sticky;` `top: 0;` `z-index: 1;` `flex-wrap: nowrap;`], and `--nav-offset` is `72px` [VERIFIED: src/app.css:18 `--nav-offset: 72px;`], so the sticky top of `calc(var(--nav-offset) - 16px)` is 56 px. Do not hard-code 56; measure in Playwright at 375 and 720 px that the head's top equals the nav's bottom. For focus scrolling, do not rely on `scroll-margin-top` on the `<rect>`: after `.focus()`, compare the rect's bounding top with `navBottom + headHeight` and `window.scrollBy` the difference if needed; a Playwright test must fail if the focused cell ends up under the head.

### Pitfall 7: `Object.entries` per row and per-row allocations at 250k rows
**What goes wrong:** resolving columns with `Object.entries(row)` for every row allocates ~6 arrays per row.
**How to avoid:** resolve the four column names once from the first row's keys (rows of one file share keys), cache by key signature, then index directly.

### Pitfall 8: Legacy cache and the version marker
**What goes wrong:** an old cache without `playtime`, or a cache from an older aggregate shape, produces `undefined` reads.
**How to avoid:** `v` field; `meta.playtime?.v === PLAYTIME_VERSION` else recompute (Pattern 2). Test with a meta record written without the field.

### Pitfall 9: Phase 3 tests that encode "Activity_history is pending"
**What goes wrong:** flipping `BUILT_DASHBOARDS` breaks existing unit and e2e assertions in the same phase.
**What changes** (all paths verified this session):
- `src/lib/dashboard-status.ts:91` `export const BUILT_DASHBOARDS: ReadonlySet<SectionId> = new Set();` becomes `new Set(['activity-history'])`.
- `tests/unit/dashboard-status.test.ts:183` `expect(sectionStatus(id, result)).toBe('pending');` iterates every section with the default set; pass `new Set()` explicitly or assert per section. The `ready`-only-when-built test (line ~152) already passes an explicit set.
- In `ready`, `DashboardSection` renders the counts as `ImportSummary variant="caption"` (test id `section-caption`) instead of the pending `section-summary`. Existing e2e that will break for `activity-history`: `tests/e2e/dashboard.spec.ts` (~170-205 `(sections-pending)` loop asserting `data-status` `pending` and `section-summary`, and the `SECTION_NOTE_PENDING` loop at line 201; ~252 loop over `['activity-history', 'player-statistics', 'user-info']` expecting `pending`; line 1004 a generic `section-summary` locator), `tests/e2e/import-flow.spec.ts:178` and `:431`, `tests/e2e/persistent-dataset.spec.ts:119,125,151,155,414`. Migrate them to be status-aware (Activity_history → `ready` + `section-caption`) in the same plan as the flip.
- The Activity card becomes much taller; re-run `scroll-nav.spec.ts` (390 lines) and the 375 px specs after the flip.

### Pitfall 10: Fake-indexeddb makes some Dexie shapes pathological in tests
Worker-level unit tests at 50,000 sessions are feasible (in one transaction, bulkPut 50k rows 593 ms, single-key read 338 ms, linear scaling from 5k/20k). Use `equals`, `uniqueKeys` and `filter`, never `anyOf`, and pass an explicit timeout to `waitForTerminal` (its default is 10,000 ms, too tight with unzip + Papa at that size). Keep the *backfill* tests to a few hundred rows.

### Pitfall 11: Existing e2e helper assumptions
`tests/e2e/helpers.ts` `dropFiles` and `setInputFiles` both work; but a replace confirm precedes any second import (Phase 3), and identical bytes only reach the duplicate path after confirming. When a test needs a second import, use a different fixture, and remember fflate stamps an mtime so two builds of the "same" export a second apart are different files.

### Pitfall 12: The project skill's driver fixture is not a real Sessions.csv
`.claude/skills/run-data-export-viewer/driver.mjs` builds `` [`${root}/Activity_history/Sessions.csv`]: strToU8('SESSION_ID;START_AT\n1;2024-01-01\n2;2024-01-02\n') ``. Under Phase 4 that file yields `no-usable-sessions` with 2 excluded rows. Update it to the real columns (`SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP`), add 20-50 rows over a few weeks and 2-3 servers, add a `03b-playtime.png` screenshot, and update the screenshot list in `SKILL.md`.

## Code Examples

The values used below (`SESSION_START`, `SESSION_END`, `SERVER_NAME`, `CLIENT_PLATFORM`, the two file/category names) come from these in-repo quotes [VERIFIED: tests/fixtures/export-fixtures.ts:220] `const SESSIONS_HEADER = 'SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP';` [VERIFIED: tests/fixtures/export-fixtures.ts:285] ``out[`${root}/Activity_history/Sessions.csv`] = encode(SESSIONS_HEADER + CR + SESSIONS_ROW + CR);`` [VERIFIED: src/lib/dashboard-status.ts:40] `{ id: 'activity-history', folder: 'Activity_history' },`. The 12 bin edges come from UI-SPEC §7 (lower inclusive, upper exclusive): `Under 1 min`, `1-2 min`, `2-5 min`, `5-10 min`, `10-20 min`, `20-30 min`, `30-60 min`, `1-2 hours`, `2-4 hours`, `4-8 hours`, `8-16 hours`, `16+ hours`. The code is a proposal and its numeric algorithms were run in scratch tests this session.

### Civil date arithmetic (`src/lib/civil-date.ts`; verified identical to `Date` for years 1000-9999)
```ts
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
export function civilFromDays(z: number): { y: number; m: number; d: number } {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? y + 1 : y, m, d };
}
/** Monday = 0. 1970-01-01 was a Thursday. */
export const weekdayOfDay = (day: number): number => (((day + 3) % 7) + 7) % 7;
```

### Timestamp parse (worker; returns wall-clock seconds since 1970-01-01T00:00:00 "as recorded", or null)
```ts
const TS = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/;
const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function parseSessionTimestamp(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const m = TS.exec(raw.trim());
  if (m === null) return null;
  const y = +m[1]!, mo = +m[2]!, d = +m[3]!, h = +m[4]!, mi = +m[5]!, s = +m[6]!;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (mo < 1 || mo > 12 || d < 1 || d > (mo === 2 && leap ? 29 : DIM[mo - 1]!)) return null;
  if (h > 23 || mi > 59 || s > 59) return null;
  return daysFromCivil(y, mo, d) * 86400 + h * 3600 + mi * 60 + s;
}
```
The regex is anchored with no nested quantifiers (no catastrophic backtracking on hostile cells).

### Merge-aware sweep for one slice
```ts
interface Usable { start: number; end: number }
export function aggregateSlice(usable: readonly Usable[], excluded: number): PlaytimeSlice {
  const order = usable.map((_, i) => i).sort((a, b) => usable[a]!.start - usable[b]!.start);
  const slice: PlaytimeSlice = { seconds: 0, sessions: usable.length, excluded, dayIndex: [], daySeconds: [],
    daySessions: [], hourOverlap: new Array(168).fill(0), hourStart: new Array(168).fill(0), bins: new Array(12).fill(0) };
  let covered = -Infinity;
  for (const i of order) {
    const { start, end } = usable[i]!;
    const from = Math.max(start, covered);
    const inc = Math.max(0, end - from);
    if (end > covered) covered = end;
    const day = Math.floor(start / 86400);
    const last = slice.dayIndex.length - 1;
    if (last >= 0 && slice.dayIndex[last] === day) { slice.daySeconds[last]! += inc; slice.daySessions[last]! += 1; }
    else { slice.dayIndex.push(day); slice.daySeconds.push(inc); slice.daySessions.push(1); }
    slice.seconds += inc;
    if (inc > 0) addHourOverlap(slice.hourOverlap, end - inc, end);   // Pattern 4
    slice.hourStart[cellOfHour(Math.floor(start / 3600))]! += inc;
    slice.bins[binOf(end - start)]! += 1;                              // edges: UI-SPEC §7
  }
  return slice;
}
```
`day` is non-decreasing because sessions are processed in start order, so the last-entry check replaces a `Map`.

### Hour overlap (verified: 0 mismatches vs a per-second oracle; 8,000-year span in 0.04 ms)
```ts
const cellOfHour = (absHour: number): number => {
  const day = Math.floor(absHour / 24);
  return weekdayOfDay(day) * 24 + (absHour - day * 24);
};
export function addHourOverlap(grid: number[], from: number, to: number): void {
  if (to <= from) return;
  const first = Math.floor(from / 3600), last = Math.floor((to - 1) / 3600);
  if (first === last) { grid[cellOfHour(first)]! += to - from; return; }
  grid[cellOfHour(first)]! += (first + 1) * 3600 - from;      // partial head
  grid[cellOfHour(last)]! += to - last * 3600;                 // partial tail
  const interior = last - first - 1;                           // whole hours strictly between
  const weeks = Math.floor(interior / 168);
  if (weeks > 0) for (let i = 0; i < 168; i++) grid[i]! += weeks * 3600;
  for (let h = first + 1 + weeks * 168; h <= last - 1; h++) grid[cellOfHour(h)]! += 3600;
}
```

### Rank scale (Pitfall 5)
```ts
export function rankScale(nonZero: readonly number[]): { cuts: number[]; levelOf: (v: number) => number } {
  const v = [...nonZero].sort((a, b) => a - b), n = v.length;
  const cuts = n === 0 ? [] : [1, 2, 3, 4].map((k) => v[Math.min(n - 1, Math.ceil((n * k) / 5) - 1)]!);
  return { cuts, levelOf: (x) => (x <= 0 ? 0 : (cuts.findIndex((c) => x <= c) + 1 || 5)) };
}
```
`findIndex` returns -1 when `x` exceeds every cut, so `-1 + 1 = 0` falls through `|| 5`. Use integer seconds so ties are exact. Compute it once per chart across all years.

### Calendar geometry (verified: 2012 needs 54 columns; 2020-12-31 is column 52, row 3 = Thursday)
```ts
// dayOfYear0 from jan1 = daysFromCivil(year, 1, 1); wd = weekdayOfDay(jan1)   (Mon = 0)
const col = Math.floor((dayOfYear0 + wd) / 7);
const row = (dayOfYear0 + wd) % 7;
const x = 32 + col * 11, y = 20 + row * 11;   // UI-SPEC section 5
```
The maximum over 1990-2060 is 54 columns (year 2012), matching the UI-SPEC's 626 px width derivation. [VERIFIED: scratch test]

### Split-column rule (pure; Focus 4)
```ts
export function chooseSplit(usable: readonly { server: string | null; platform: string | null }[]) {
  for (const column of ['SERVER_NAME', 'CLIENT_PLATFORM'] as const) {
    const distinct = new Set(usable.map((s) => (column === 'SERVER_NAME' ? s.server : s.platform)));
    if (distinct.size >= 2 && distinct.size <= 50) return column;   // null counts as one value
  }
  return null;
}
```
Values are trimmed strings, blank/whitespace → `null`, compared exactly after trimming (no case folding). Both column choices go through the same normalised-header lookup, and no other column may ever be offered (this also keeps `IP` and `CLIENT_BUILD` out).

### Fixture generator (Focus 5; seeded so a failure reproduces)
```ts
// tests/fixtures/sessions-fixtures.ts
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const fmt = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 19).replace('T', ' ');  // UTC digits via Date
export function buildSessionsExport(spec: SessionsFixtureSpec): { bytes: Uint8Array; expected: SessionsExpected } {
  // Sessions.csv joined with '\r' (bare CR, as the sample) and written through
  // buildCustomExport({ overrides: { 'Activity_history/Sessions.csv': csv } }); Logins.csv is kept.
}
```
`buildCustomExport` takes `overrides?: Record<string, string | Uint8Array>` keyed relative to the root [VERIFIED: tests/fixtures/export-fixtures.ts:930]. The generator formats timestamps with `Date` (UTC digits) while the code under test uses civil arithmetic, so the two independent paths cross-check each other.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-event SVG nodes in heatmaps | Pre-aggregated buckets, one node per bucket | Documented in `.planning/research/PITFALLS.md` Pitfall 5 | Node count is a function of days/cells/bins |
| Linear min-max colour scale | Rank/percentile scale | Locked by D-04 | Ordinary days stay distinguishable |
| `$state` deep proxies for big payloads | `$state.raw` (Svelte 5) | Svelte 5.0 | Avoids proxying 17k+ numbers |

**Deprecated/outdated:** none relevant; no new libraries.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The real export's `Sessions.csv` uses `SESSION_START`/`SESSION_END`/`CLIENT_PLATFORM`/`SERVER_NAME`. The only evidence in the repo is the synthetic fixture; PROJECT.md does not list the Sessions columns and the UI-SPEC says the real sample was unavailable | Summary, Pitfall 1-2 | If headers differ the whole Playtime block shows `no-usable-sessions` with every row excluded. Needs a human check against a real export (Open Question 1) |
| A2 | Timestamps look like `YYYY-MM-DD HH:mm:ss`, with no offset suffix | Code Examples | An offset or another format makes rows "excluded"; visible via the excluded pill, not silent |
| A3 | A real-Chrome IndexedDB read of ~50k rows costs 0.1-0.5 s (only used to justify not doing this per selection) | Alternatives | Low: the recommendation does not depend on it; on-demand is used only for backfill |
| A4 | `scroll-margin-top` may be ignored for SVG child elements in Chrome | Pitfall 6 | Low: mitigated by a manual `scrollBy` correction and a Playwright check |
| A5 | Per-day calendar hours use the merge-aware increment attributed to the start day (so year/day sums reconcile with the tile); alternative is raw length per start day | Pattern 3 | Cells differ slightly from a naive per-session sum on overlapping days; user may prefer raw. Reversible (re-derive from `rows`) |
| A6 | Split candidate values and per-value excluded counts are taken from usable sessions; excluded rows whose value has no usable session count only under All | Pattern 1 / Code Examples | A value that appears only on excluded rows is not selectable; the UI-SPEC wording "rows it can bucket" is ambiguous |
| A7 | Level-collapse rule: levels keep their ramp colour and unused levels are omitted from the legend; "Darkest" is printed only when level 5 is used | Pitfall 5 | Cosmetic; UI-SPEC says only "duplicate levels collapse" |
| A8 | The Sessions file is identified by `sourceFile.toLowerCase() === 'sessions.csv'` in an `activity_history` category (case-insensitive) | Pattern 2 | A renamed file (`Session_history.csv`) would read as `no-session-file` |
| A9 | The nav is one non-wrapping row, so its height is stable (≈56 px); UI-SPEC checker flagged it as an assumption | Pitfall 6 | Sticky year head overlaps the nav; caught by the 375/720 px Playwright measurement |
| A10 | No cap on session length: D-02 lists the exclusion rules exhaustively; an absurd end date (year 9999) is counted, and its calendar cell shows an outlier | Open Question 4 | A corrupt row skews one cell and the total; visible, and the rank scale absorbs it |

## Open Questions (RESOLVED)

Each question below is closed for planning. Q1 and Q2 are resolved by a stated default plus a scheduled human step or a pending owner decision; the other three are decided and adopted by the plans named. This edit changes only this section; nothing above or below it was altered.

1. **Real Sessions.csv columns and which column identifies the title.** RESOLVED by default: the UI-SPEC rule is adopted (SERVER_NAME first, then CLIENT_PLATFORM, whichever has 2 to 50 distinct usable values), implemented in plan 04-06 and unit-tested on constructed distributions; plus a scheduled human check, plan 04-12 Task 3, where the owner drops a real export and records the chosen column, the value list and the excluded count in the 04-12 SUMMARY (originally scheduled as the last plan's check; the plans were renumbered when the foundation plan was split, so the check now lives in plan 04-12).
   - What we know: `tests/fixtures/private/` does not exist [VERIFIED: `ls` "No such file or directory"]; the header in the fixture is `SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP` [VERIFIED: tests/fixtures/export-fixtures.ts:220].
   - What stays open until the human check: whether the real sample matches, and what `SERVER_NAME` looks like in it (D-03 asks research to inspect the real 2021 sample). The UI never claims "game", so a wrong guess stays truthful, and a header mismatch shows as the `no-usable-sessions` state with an excluded pill, never as silent wrong numbers.
2. **Weekday x hour attribution (user decision pending).** RESOLVED by default: `HOUR_GRID_BASIS = overlap` (the UI-SPEC default) is adopted; both grids (`hourOverlap` and `hourStart`) are stored in every slice, so the owner's decision, still pending, is a one-constant switch in `src/lib/playtime-shared.ts` (plan 04-01) that changes the caption note and tooltip line 2 (`{hours} played in sessions starting this hour` for `start`) with no re-import. Plans 04-03, 04-04, 04-05, 04-09 and 04-11 test or specify both bases, so either final choice is already covered (plan 04-11 holds hand-derived tables for both, in which six weekday-hour cells differ).
3. **Timestamp offsets.** RESOLVED: a trailing `Z` is accepted; any other offset makes the row invalid and counted in the excluded pill, never silently dropped or shifted (D-01). Adopted by plan 04-01 (`parseSessionTimestamp`, threat T-04-02) and pinned by the parse table in plan 04-03 Task 3. The real-export human check in plan 04-12 confirms the shape assumption A2.
4. **Absurdly long sessions.** RESOLVED: no session-length cap in v1 (assumption A10). Work is bounded by the O(168) hour-overlap peel, proven by plan 04-03's bounded-time test (a session from 2010 to year 9999 in well under a second, sums exact). A cap would be a new exclusion rule needing a D-02 amendment and copy, so it is not added.
5. **Excluded-row wording under a split.** RESOLVED: excluded rows with a blank or unknown split value count only under All (assumption A6). Adopted by plan 04-06 (per-value excluded counts come from excluded rows whose value exists among usable sessions; a value that appears only on excluded rows is not selectable) and asserted in its tests.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | ✓ | v22.22.2 | — |
| pnpm | install/scripts | ✓ | 12.6.0 | — |
| Installed deps (`pnpm install --frozen-lockfile`) | everything | ✓ (installed this session; `node_modules` is gitignored) | — | — |
| Vitest unit suite | TDD, Nyquist | ✓ | 330/330 pass, 4.9 s | — |
| Playwright Chromium | e2e, scale, tooltip, sticky checks | ✗ | `pnpm exec playwright install chromium` failed: "Failed to download Chrome for Testing 153.0.8010.12 (playwright chromium v1243)" | Run e2e in CI (`.github/workflows/ci.yml` runs `pnpm exec playwright install --with-deps chromium` then `pnpm exec timeout 10m playwright test`) or on the owner's machine; mark e2e-only criteria as `checkpoint:human-verify` |
| Real Wargaming export | Open Question 1 | ✗ (must stay outside the repo / under gitignored `tests/fixtures/private/`) | — | Synthetic fixtures + human-verify |

**Missing dependencies with no fallback:** none for planning. **Missing with fallback:** Chromium in this sandbox (CI/human verify).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^5.0.2` (Node environment, jsdom-free) + Playwright `^1.63.0` (Chromium) |
| Config file | `vitest.config.ts` (`include: ['tests/unit/**/*.test.ts']`, `environment: 'node'`, `setupFiles: ['tests/unit/setup.ts']`), `playwright.config.ts` |
| Quick run command | `pnpm exec vitest run tests/unit/playtime.test.ts tests/unit/playtime-model.test.ts tests/unit/civil-date.test.ts` |
| Full suite command | `pnpm run lint && pnpm run check && pnpm run test:unit && pnpm exec playwright test` (the CI order: lint, check, unit, e2e) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACTIVITY-01 | seconds/sessions/activeDays per slice; overlaps merged; midnight crossing attributed to start day; excluded counted (missing end, end<start, garbage, impossible date); usable + excluded = stored Sessions rows | unit (pure) | `pnpm exec vitest run tests/unit/playtime.test.ts` | ❌ Wave 0 |
| ACTIVITY-01 | oracle cross-check: small fixture vs per-second bitmap for merged seconds, day totals, both hour grids | unit | same | ❌ Wave 0 |
| ACTIVITY-01 | tiles/pill render `formatHours` values, excluded pill only when > 0 | e2e | `pnpm exec playwright test tests/e2e/playtime.spec.ts` | ❌ Wave 0 |
| ACTIVITY-02 | calendar model: cells = Σ days in active years, ≤ 54 columns, 2012/2020 geometry, empty-year run collapse (incl. stray 1970 row), Σ year totals = tile | unit | `pnpm exec vitest run tests/unit/playtime-model.test.ts` | ❌ Wave 0 |
| ACTIVITY-02 | rank scale: ties, n = 0/1/2, level 0 never shaded, legend levels in use | unit | same | ❌ Wave 0 |
| ACTIVITY-02 | `calendar-cell` count, data attributes, tooltip on hover and focus, arrow-key roving, focused cell clear of nav and head | e2e | `pnpm exec playwright test tests/e2e/playtime.spec.ts` | ❌ Wave 0 |
| ACTIVITY-03 | both grids sum to the total; week-peel matches oracle; weekday index (Mon = 0) | unit | `pnpm exec vitest run tests/unit/playtime.test.ts` | ❌ Wave 0 |
| ACTIVITY-03 | 168 `hour-cell`, timezone caption visible (not only in a tooltip), keys | e2e | `pnpm exec playwright test tests/e2e/playtime.spec.ts` | ❌ Wave 0 |
| ACTIVITY-04 | 12 bins, edges inclusive/exclusive, zero-length in "Under 1 min", Σ bins = sessions | unit | `pnpm exec vitest run tests/unit/playtime.test.ts` | ❌ Wave 0 |
| ACTIVITY-04 | 12 `duration-bin`, Σ `data-count` = `playtime-total-sessions` | e2e | `pnpm exec playwright test tests/e2e/playtime-scale.spec.ts` | ❌ Wave 0 |
| Split (D-03) | column rule on constructed distributions; blank → `null`; `__proto__` value; per-value ≥ All total | unit | `pnpm exec vitest run tests/unit/playtime.test.ts` | ❌ Wave 0 |
| Split (D-03) | selector resets on replace and on clear→re-import; no stale value | e2e | `pnpm exec playwright test tests/e2e/playtime.spec.ts` | ❌ Wave 0 |
| Contract | worker `playtime-query` after ingest; legacy meta backfill (few hundred rows) writes back only when `importedAt` matches; query after clear replies `importedAt: null`; `IngestClient` ignores `playtime-*` for its own state | unit | `pnpm exec vitest run tests/unit/ingest-worker.test.ts tests/unit/ingest-client.test.ts tests/unit/playtime-client.test.ts` | partial (extend existing files) |
| Scale (SC5) | 50k+ sessions, 12-15 years: model sizes independent of session count; aggregation under a generous time bound | unit | `pnpm exec vitest run tests/unit/playtime.test.ts` | ❌ Wave 0 |
| Scale (SC5) | DOM node count of the chart region for a 5,000-session export equals that of a 60,000-session export over the same years; no long task ≥ 1000 ms during import-to-ready and a selector change | e2e | `pnpm exec playwright test tests/e2e/playtime-scale.spec.ts` | ❌ Wave 0 |
| Contrast | ramp in `app.css` equals ramp in `04-UI-SPEC.md`; luminance strictly decreasing; adjacent ratio ≥ 1.25; level 4 ≥ 4.5:1 and level 5 ≥ 7:1 on `#ffffff` | unit | `pnpm exec vitest run tests/unit/contrast.test.ts` | extend existing |
| Privacy | no IP substring in `meta.playtime`, in `page.content()`, in any tooltip/aria/data attribute; aggregator never reads the IP value | unit + e2e | `pnpm exec vitest run tests/unit/playtime.test.ts`; `pnpm exec playwright test tests/e2e/playtime.spec.ts` | ❌ Wave 0 |
| Zero network | request count after baseline unchanged through import + selector changes on the large fixture | e2e | `pnpm exec playwright test tests/e2e/playtime-scale.spec.ts tests/e2e/zero-network.spec.ts` | extend zero-network |
| Phone | at 375 px `document.documentElement.scrollWidth <= 375`; far-right cell focus scrolls inside its scroller | e2e | `pnpm exec playwright test tests/e2e/playtime.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the quick command above (< 10 s), plus `pnpm run check` when a `.svelte` or `worker-messages.ts` file changed.
- **Per wave merge:** `pnpm run lint && pnpm run check && pnpm run test:unit`.
- **Phase gate:** the full suite including Playwright green (in CI; Chromium is not installable in this sandbox) before `/gsd-verify-work`, plus the human-verify against a real export.

### Wave 0 Gaps
- [ ] `tests/fixtures/sessions-fixtures.ts`: seeded generator (mulberry32) with knobs `sessions`, `startYear`, `years`, `servers` (3+ plus blanks), `overlapRate`, `crossMidnightRate`, `zeroLengthRate`, bad-row counts (empty end, end < start, garbage, `2020-02-30`, missing start, one 1970 row), returning `{ bytes, csv, expected }`. Independent per-second oracle (`tests/helpers/`) for fixtures ≤ ~300 sessions over ≤ 30 days.
- [ ] `tests/unit/playtime.test.ts`, `playtime-model.test.ts`, `civil-date.test.ts` (cross-check `daysFromCivil`/`civilFromDays`/`weekdayOfDay` against `Date` over a range), `playtime-client.test.ts`.
- [ ] Extensions: `ui-copy.test.ts` (every new string; `formatHours` boundaries below), `contrast.test.ts` (ramp), `dashboard-status.test.ts` (built set), `ingest-worker.test.ts` (query, backfill, clear), `ingest-client.test.ts` (delegation regression), `zero-network.spec.ts`.
- [ ] `tests/e2e/playtime.spec.ts` (small fixtures: states, selector, keyboard, tooltip, 375 px, privacy) and `tests/e2e/playtime-scale.spec.ts` (large fixtures).
- [ ] Framework install: none.

`formatHours` boundary cases to pin (UI-SPEC rule, one function): 0 → `0 min`; 59 s → `<1 min`; 60 s → `1 min`; 3,599 s → `59 min` (use floor for minutes so it never reads `60 min`); 3,600 s → `1 hour`; 3,600 × 3.5 → `3.5 hours`; 99.96 h → `100 hours`; 100 h and above → integer with `en-US` separators (`1,204 hours`); unit is `hour` only when the numeral is exactly `1`. Hours formatted from seconds, never floats accumulated across cells.

### How to assert "SVG node count scales with buckets, not sessions"
- **Model level (Vitest, no DOM):** build the calendar/hour/duration models from a 60,000-session aggregate; assert `calendarCells === Σ daysInYear(activeYear)`, `hourCells === 168`, `bins === 12`, and that the same values result from a 5,000-session aggregate over the same years.
- **DOM level (Playwright):** import fixture A (5,000 sessions) and B (60,000 sessions), both covering the same 12 years and the same servers. For each, count `document.querySelectorAll('[data-testid="calendar-chart"] *').length`, the `hour-cell` count and the `duration-bin` count. Assert the counts are equal (12× the sessions, zero extra nodes), that `calendar-cell` equals the days in the active years computed independently from the fixture's `expected.years`, and that an absolute ceiling holds (for example `< years * 400 + 200`). Add an invariant check: Σ `data-count` over `duration-bin` equals the `playtime-total-sessions` value (format with `en-US`, strip commas), and Σ `data-seconds` over `hour-cell` equals the tile's seconds. The hook list in UI-SPEC §13 stays authoritative; adding `data-seconds` (exact integer) to `calendar-cell` and `hour-cell` is additive and avoids rounding error in those sums.
- **Bounded time:** wait for `playtime[data-state="ready"]` with a 60 s timeout after `setInputFiles`, and for a selector change to return to `ready` within a few seconds; reuse the `PerformanceObserver` `longtask` pattern from `import-flow.spec.ts` (threshold 1000 ms, the repo's convention).

## Security Domain

### Applicable ASVS Categories (level 1, `security_enforcement: true`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no accounts) |
| V3 Session Management | no | — |
| V4 Access Control | no | — (single local user) |
| V5 Input Validation | **yes** | Untrusted CSV cells: strict anchored timestamp regex + range checks; `SERVER_NAME`/`CLIENT_PLATFORM` values rendered by plain Svelte interpolation only (no `{@html}`, lint-enforced), wrapped with `overflow-wrap: anywhere`; value cardinality capped at 50; `Map`/arrays instead of object keys |
| V6 Cryptography | no | — |
| V7 Error handling / logging | yes | `console.error` carries no row contents (Phase 3 D-21 convention); query failure surfaces the fixed error copy, dataset untouched |
| V8 Data protection | **yes** | The Sessions `IP` column is never read, stored in aggregates, or rendered; no network (CSP + lint bans) |
| V12 Files/resources | yes | Bounded work on hostile rows (Pattern 4), bounded slice count, bounded payload per response |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IP leakage through a tooltip, `aria-label`, `title`, `data-*` or test id | Information disclosure | Aggregator reads four columns only; unit test with a throwing `IP` getter; leak assertions on `JSON.stringify(meta.playtime)` and on `page.content()` for the fixture IP `192.0.2.20` (same pattern as `identity-privacy.spec.ts`) |
| Markup/script injection through a crafted `SERVER_NAME` in `<select>`, split table, live region | Tampering / XSS | Text interpolation only; e2e with a value like `<b>x</b>` and a 60+ char unbroken value asserts no element is created |
| Prototype pollution via `__proto__` value | Tampering | `Map`/arrays; unit test with that value |
| CPU/memory DoS from timestamps in year 9999 or 10-year spans | Denial of service | Week-peeling hour overlap (O(168)), empty-year runs collapsed to one line, ≤ 50 slices; test a year-9999 row |
| Stale-dataset data shown after replace/clear | Information disclosure (of the previous export) | `importedAt`-keyed state and response guard |
| Network exfiltration | Information disclosure | Unchanged: `connect-src 'none'`, lint bans, zero-network Playwright guard (extend to the large-fixture flow) |

## Suggested Plan Decomposition (input for the planner, TDD order)

1. **Pure foundation (Wave 1, parallelisable):** `civil-date.ts` + tests; `playtime-shared.ts`; `worker/playtime.ts` (parse, `isSessionsRow`, `chooseSplit`, `aggregateSlice`, `buildPlaytime`, `viewFromAggregates`) with unit tests written first, using the new `sessions-fixtures.ts` and the oracle; `ui-copy.ts` formatters + tests; ramp custom properties in `app.css` + the contrast test extension.
2. **Contract (Wave 2):** `worker-messages.ts` types; `db.ts` (`DatasetMeta.playtime`, `writeDataset` sixth parameter, guarded write-back); `ingest.worker.ts` (collect Sessions rows during the existing loop, try/catch `buildPlaytime`, `handlePlaytimeQuery`, backfill); `PlaytimeClient` + `IngestClient` delegation and regression tests; `playtime-model.ts` pure models + tests.
3. **UI (Wave 3):** `BUILT_DASHBOARDS`, the existing-test migration of Pitfall 9, `Dashboard.svelte` children snippet, Playtime block + tiles + split table + notice, then calendar, hour grid, duration list, tooltip. Login-history placeholder `h3` per UI-SPEC.
4. **Verification (Wave 4):** e2e specs, zero-network extension, skill driver/`SKILL.md` update, full suite in CI, human-verify against a real export (Open Question 1) and the two pending UI decisions.

## Sources

### Primary (HIGH confidence)
- In-repo files read this session (paths and line ranges cited inline): `src/lib/worker/db.ts`, `src/lib/worker/ingest.worker.ts`, `src/lib/worker/csv-parse.ts`, `src/lib/worker/identity.ts`, `src/lib/worker/classify.ts`, `src/lib/types/worker-messages.ts`, `src/lib/worker-client.svelte.ts`, `src/lib/ingest-client.ts`, `src/lib/dashboard-status.ts`, `src/lib/components/{Dashboard,DashboardSection,DashboardNav,ImportSummary}.svelte`, `src/app.css`, `vite.config.ts`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`, `tests/unit/{setup,contrast,db,ingest-worker,dashboard-status}.test.ts`, `tests/helpers/contrast.ts`, `tests/fixtures/export-fixtures.ts`, `tests/e2e/*.ts`, `.github/workflows/ci.yml`, `.claude/skills/run-data-export-viewer/*`, `04-CONTEXT.md`, `04-UI-SPEC.md`.
- Local measurements this session: aggregation benchmark (Node 22), fake-indexeddb write/read/`anyOf` probes, hour-overlap oracle test, civil-date vs `Date` test, contrast recomputation of every ratio in the UI-SPEC with `tests/helpers/contrast.ts` (all matched: ramp 1.14/1.49/1.95/2.87/5.13/9.38 on white, steps 1.31/1.31/1.47/1.79/1.83, tooltip 10.47, amber 5.53, error 7.89, accent 4.51), Svelte lint/`svelte-check` probe on an SVG grid.
- [Dexie Version.stores()](https://dexie.org/docs/Version/Version.stores()): only indexed properties need to be listed.
- [MDN CSP style-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src): CSSOM property assignment is not blocked; `setAttribute('style')` and `cssText` are.

### Secondary (MEDIUM confidence)
- [Dexie Dexie.version()](https://dexie.org/docs/Dexie/Dexie.version()): does not itself state when a bump is required for non-indexed fields; the conclusion rests on the Version.stores() statement plus the in-repo `identity` precedent (db.ts:51, 134).
- [Dexie equalsIgnoreCase()](https://dexie.org/docs/WhereClause/WhereClause.equalsIgnoreCase()): implemented by a custom algorithm; performance characteristics not documented, which is why this research avoids it and `anyOf`.

### Tertiary (LOW confidence)
- None used for recommendations. A1-A10 in the Assumptions Log are the unverified items.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no additions; versions read from `package.json` and the install output.
- Architecture (where to compute, contract, replay semantics): HIGH, reasoned from the actual code paths and measured costs.
- Algorithms: HIGH, each was run against an oracle or `Date`.
- Real-export format assumptions: MEDIUM-LOW (A1, A2), no real sample available.
- Pitfalls: HIGH for repo-specific ones (verified by probes and greps); MEDIUM for browser-behaviour ones that Chromium could not confirm here (A4, sticky head).

**Research date:** 2026-09-29
**Valid until:** 2026-10-29 (stable stack; revisit if the real export shows a different Sessions.csv shape)
