# Phase 2: Defensive Parsing & Persistent Dataset - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The worker moves from Phase 1's path-only classification to actually unzipping and parsing every detected category's CSVs — not just the four "supported" folders that get v1 dashboards, but known-deferred (Chat_history, Clans) and unknown folders too, so row counts are meaningful everywhere the results view reports them. Parsing tolerates CRLF/bare-CR line endings, missing/extra columns, and corrects double-UTF8 mojibake. Parsed rows are written to IndexedDB (Dexie) as a single active dataset via bulkPut, keyed so a hash-identical re-upload is detected and skipped before any unzip/parse work starts, and a different zip replaces the dataset after an explicit in-app confirm. The dataset survives reloads: returning with cached data auto-loads the same results view Phase 1 built (badges, now with row counts), no re-upload needed. Two destructive controls exist — "Start over" and a dedicated, persistent "Clear my cached data" — both wiping IndexedDB via the same confirm+acknowledgment pattern.

The UI here is still the diagnostic/results view from Phase 1, extended (badges gain row counts, skip counts, import timestamp; a persistent clear-data control is added) — Phase 3 replaces it with the real dashboard shell.

</domain>

<decisions>
## Implementation Decisions

### Parse scope by tier
- **D-01:** Every detected category folder — supported, known-deferred, and unknown alike — gets full CSV parsing into IndexedDB in Phase 2, not just the four "supported" folders (Activity_history, Player_statistics, User_Info, Payment_history). — **Reversibility:** costly — **Reversibility rationale:** narrowing this later means dropping already-written IndexedDB tables/rows for categories that turn out unused; widening it later (if a category were excluded now) means re-parsing from scratch, since raw zip bytes are not retained after import.
- **D-02 (Claude's Discretion, recommended path):** For known-deferred/unknown folders with no locked schema, store full row content in a generic, header-keyed (untyped) shape rather than row-counts-only — counts-only would force a full re-upload later if a future phase ever needs that content, since the zip itself isn't kept.
- **D-03:** A CSV row malformed beyond missing/extra columns (unparseable date, garbage bytes, etc.) is skipped individually; the rest of that file, category, and export continue importing normally. The skip is logged to `console.error` per the project's existing defensive-parsing/D-05 pattern.
- **D-04:** Skipped-row counts are shown on screen per affected category (not console-only) — e.g. a visible "N rows skipped" alongside that category's badge.
- **D-05:** Category badges show BOTH the Phase 1 file count and the new row count, e.g. `"Activity_history — 3 files, 1,204 rows"` — neither replaces the other.
- **D-06:** No size/row cap on import. The app relies on `navigator.storage.persist()` and the browser's own IndexedDB quota; a quota failure surfaces through the existing single worker-error path (no new size-based rejection logic).

### Return-visit experience
- **D-07:** On page load, if IndexedDB already holds a cached dataset, the app auto-loads straight to the per-category results view (badges + row counts) — no drop, no click required. This matches Phase 3's already-locked success criterion 4 ("a return visit with cached data opens straight to the dashboard without re-uploading"), so nothing built here needs to be redesigned when Phase 3 replaces the UI.
- **D-08:** While the IndexedDB existence check resolves (should be fast, not instant), a brief loading spinner covers the gap before swapping to either the results view or the empty dropzone — avoids a visible flash of the wrong state.
- **D-09:** Per-category skipped-row counts (D-04) are persisted in IndexedDB alongside row counts and shown every time the results view renders, not just immediately after the import that produced them.
- **D-10:** The results view shows an "Imported on [date]" timestamp, stored alongside the dataset, so a returning user can judge staleness before deciding whether to re-import or clear.

### Import UX for drops
- **D-11:** Live progress text during import names the current category being parsed, e.g. `"Parsing Player_statistics (3/8)..."` — extends Phase 1's stage-message contract (flagged in `01-CONTEXT.md` D-09 as the expected extension point) with per-category detail, directly satisfying Phase 2's success criterion 1 wording ("progress advancing per category").
- **D-12:** Re-dropping the identical (hash-matched) zip shows a distinct "already loaded" banner (e.g. "This export is already loaded — skipping re-import") before any unzip/parse work starts, then the existing results view is shown/stays shown.
- **D-13:** Dropping a DIFFERENT zip while a dataset is already cached does NOT silently replace it. An in-app inline confirm ("Replace your current dataset with this new import?") is shown first — the drop is paused, not auto-actioned. This supersedes Phase 1's D-14 ("no confirmation, nothing to confirm"), which only held because nothing was persisted yet at that point.
- **D-14:** The confirm step for both replace-on-drop and the destructive controls below is a styled in-app panel (consistent with `FailureBanner` and the rest of the app's own UI), never a native browser `confirm()` dialog.
- **D-15:** "Start over" now also clears the cached IndexedDB dataset, not just the view state. (Claude recommended keeping "Start over" as a pure view-reset, separate from data deletion; the user explicitly chose to converge it with data clearing instead.)
- **D-16:** Because "Start over" is now destructive, clicking it goes through the same in-app inline confirm pattern as the replace-on-drop warning (D-13/D-14).

### Clear-data control
- **D-17:** "Clear my cached data" (DATA-02) is a SEPARATE, distinct control from "Start over" — not the same button relabeled. (Claude recommended a single shared control; the user explicitly chose two buttons.) Both trigger the identical underlying clear-with-confirm action. — **Reversibility:** costly — **Reversibility rationale:** planning/implementation will build two distinct entry points (placement, event wiring, possibly distinct copy around the shared confirm) rather than one; collapsing them later means removing a whole UI affordance and re-routing its callers.
- **D-18:** The dedicated "Clear my cached data" control is a persistent header/footer element, visible on both the empty dropzone and the results view — not only alongside results — satisfying DATA-02's "discoverable" requirement across every app state.
- **D-19:** The persistent control is hidden entirely (not shown-disabled) when there is no cached dataset — first visit, or right after a clear.
- **D-20:** After confirming a clear (via either button), a brief acknowledgment message is shown (e.g. "Cached data cleared") before/alongside the empty dropzone — not a silent transition.
- **D-21:** The confirm panel's copy spells out the consequence explicitly, e.g. "This will permanently delete your cached export data. You'll need to re-upload the zip to view it again." rather than a bare "Clear your cached data?" question.
- **D-22:** "Start over" and "Clear my cached data" show the exact same confirm copy and use the same confirm component — one shared confirm panel, not per-button wording variants (D-14/D-16 already establish they share the mechanism; this locks that they also share the exact text).

### Claude's Discretion
- Row storage shape for known-deferred/unknown folders (D-02): generic header-keyed rows recommended over row-counts-only, per the rationale above.
- Exact IndexedDB/Dexie schema (table-per-known-CSV vs. a more generic shape) — the project's Key Decisions table already locks Dexie 4 + bulkPut + zip-hash dedup + `navigator.storage.persist()`; table/schema layout is an implementation detail for research/planning.
- Whether the zip hash (for duplicate detection) is computed from raw file bytes or from unzipped content — a technical choice that must land before any unzip work per success criterion 3 ("skipped before any unzip or parse work starts"), but the exact hashing approach wasn't discussed.
- Visual styling (icon vs. text-only for the persistent clear-data control, exact spinner/progress-text typography) — no design system referenced yet, consistent with Phase 1's same discretion note.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs
- `.planning/PROJECT.md` — Core Value, constraints, and Key Decisions table (Dexie 4 + bulkPut + zip-hash dedup + `navigator.storage.persist()`, worker lifecycle rules, mojibake fix approach)
- `.planning/REQUIREMENTS.md` — IMPORT-01, IMPORT-03, IMPORT-04, IMPORT-06, DATA-01, DATA-02 (this phase's mapped requirements)
- `.planning/ROADMAP.md` §"Phase 2: Defensive Parsing & Persistent Dataset" — goal and the four numbered success criteria this phase must satisfy
- `AGENTS.md` (repo root) — locked tech-stack versions, `Papa.parse({ worker: false })` + fflate `unzipSync` (no nested workers), Dexie schema-as-a-migration-concern note

### Phase 1 (prior phase, direct dependency)
- `.planning/phases/01-ingest-foundation-zero-network-guard/01-CONTEXT.md` — D-09 (stage-message contract explicitly designed for the per-category extension this phase exercises, D-11 above), D-13/D-14 (superseded by this phase's D-13 replace-warning now that data persists), D-05 (console-only error logging pattern this phase's D-03 skip-logging follows)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/worker/ingest.worker.ts` — existing worker entry point (hash → unzip → classify message flow to be extended with: full unzip of every category, PapaParse per CSV, mojibake correction, Dexie writes)
- `src/lib/types/worker-messages.ts` — existing `IngestStage`/`IngestResponse` contract; extend for per-category progress (D-11) and duplicate/already-loaded signaling (D-12)
- `src/lib/worker-client.svelte.ts` (`IngestClient`) — existing main-thread state machine (`idle`/`processing`/`done`/`error`) with a single `#fail` failure path and a `MIN_PROCESSING_MS` floor; needs new states/branches for auto-load-from-cache on init (D-07/D-08), duplicate-skip (D-12), and confirm-pending (D-13/D-16)
- `src/lib/components/ResultsView.svelte`, `src/lib/components/CategoryBadge.svelte` — existing badge display; extend for file+row counts (D-05), skip counts (D-04), and the import timestamp (D-10)
- `src/lib/worker/categories.ts`, `src/lib/worker/classify.ts` — existing classification logic; this phase's per-category parsing plugs in after classification already runs
- `tests/fixtures/export-fixtures.ts` — existing synthetic fixture builders (`buildSampleExport`, `buildLargeExport` at 20k entries via `LARGE_EXPORT_FILES_PER_CATEGORY`); this phase needs new fixtures for mojibake/Cyrillic content and a "10x sample size" scale fixture for success criterion 1 (distinct from the 20k-entry responsiveness fixture built for Phase 1)

### Established Patterns
- Single long-lived Worker with a main-thread busy-guard, no `CANCEL` message (per `.planning/ROADMAP.md` Planning Notes) — this phase's parse work must run inside the same worker instance, never a new one
- One error path (`IngestClient#fail`) for every failure source (pre-check, worker crash, deserialization error, worker error message) — new failure sources this phase introduces (parse errors, Dexie write errors) should route through it too
- `MIN_PROCESSING_MS` visible-processing floor (400ms), already implemented — likely extends naturally to real (longer) imports without needing a redesign

### Integration Points
- `ingest.worker.ts`'s existing `stage: 'unzipping' | 'classifying'` message is the exact extension point Phase 1's `01-CONTEXT.md` flagged as costly-to-redesign-later for per-category progress (D-11) — this is that extension being exercised
- `App.svelte`'s top-level `state === 'done' ? ResultsView : Dropzone` branch needs new cases for: auto-loaded-from-cache on init (D-07), a confirm-pending overlay shared by replace-on-drop and both destructive buttons (D-13/D-16/D-22), and the persistent clear-data control (D-18/D-19)

</code_context>

<specifics>
## Specific Ideas

- Badge text example: `"Activity_history — 3 files, 1,204 rows"`
- Per-category progress text example: `"Parsing Player_statistics (3/8)..."`
- Duplicate-drop banner example: `"This export is already loaded — skipping re-import"`
- Confirm panel copy example: `"This will permanently delete your cached export data. You'll need to re-upload the zip to view it again."`
- Import timestamp example: `"Imported on Sep 28, 2026"`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 2 scope.

</deferred>

---

*Phase: 2-Defensive Parsing & Persistent Dataset*
*Context gathered: 2026-09-28*
