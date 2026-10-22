# Phase 4: Activity Time Dashboards - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill the "Playtime" sub-section of the Activity_history dashboard section (Phase 3 D-02) with four things derived from `Activity_history/Sessions.csv`: lifetime totals (hours, sessions, active days), a year-by-year calendar heatmap, a day-of-week × hour-of-day heatmap, and a session-duration distribution. A selector splits all four by a session column (see D-03). Every chart aggregates per bucket (day, hour cell, duration bin), never per session, and must hold up on a synthetic 50k+ session, 10-15 year fixture.

Not in this phase: login-IP history, geolocation and the world map (Phase 6), per-vehicle stats (Phase 5), phone-width and touch polish (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Time basis
- **D-01:** Timestamps are shown and bucketed exactly as written in `Sessions.csv`, with no timezone conversion and no toggle in v1. The day × hour heatmap carries an explicit label along the lines of "as recorded in the export (likely UTC or server time)". The same basis decides which calendar day a session lands on and what counts as an active day. Sessions.csv timestamps carry no timezone, so any conversion would assert a zone the data does not contain. — **Reversibility:** costly — **Reversibility rationale:** the per-day and per-hour aggregates are built on this basis, so adding a local-time mode later means re-aggregating and reworking the chart labels.

### What counts as hours played
- **D-02:** The hours total merges overlapping sessions so simultaneous play is not double-counted. Each session is attributed to the calendar day it starts on, even when it crosses midnight. Rows whose end is before their start, or that have no end time, are excluded from the totals, and the count of excluded rows is shown on screen alongside the other skipped-row counts (Phase 2 D-04 pattern). Merging happens within the selected slice: under a filter value, overlaps are merged among that value's sessions only. Consequence to explain in copy: the per-value hours listed in the summary can add up to more than the "All" total, because "All" also merges overlaps across values. — **Reversibility:** reversible

### Split by session column
- **D-03:** A selector above the Playtime charts lets the user pick "All" (default) or one value of the session column that identifies the title. Picking a value filters every chart and every total. The summary also lists each value's hours next to the "All" figures so the split is visible without clicking. Sessions.csv has no game column, only `CLIENT_PLATFORM` and `SERVER_NAME` (the synthetic fixture uses `win` and `eu-1`, which look like platform and server, not game). Research must inspect the real 2021 sample to decide which column identifies the title; if neither does, the selector is labelled with the column's true name and never claims "game". This covers Sessions only. Per-title breakdowns of Player_statistics remain Phase 5 (Phase 3 D-11). — **Reversibility:** costly — **Reversibility rationale:** the aggregation shape (per-slice buckets), the worker/message contract and every chart's input depend on the selector existing, so retrofitting or removing it touches all four charts.

### Calendar heatmap
- **D-04:** Each cell shows hours played for that day. All years are stacked on one page, each with a year label that stays readable while scrolling (no year picker), so a decade-long account is visible at a glance. The colour scale is percentile- or log-based, never linear min-max, so ordinary days stay distinguishable from outlier days. The tooltip shows date, hours and session count, and opens on hover and on keyboard focus (touch support is Phase 7). Rendered SVG node count scales with days, not sessions. — **Reversibility:** reversible

### Session-duration distribution
- **D-05:** Log-scaled bins, so seconds-long and multi-hour sessions both stay readable. Bin edges and labels are Claude's discretion, but the bin count is bounded and labels are human-readable durations (for example "5-10 min"), not raw log values. No separate outlier bucket is required, since the log scale absorbs long sessions. — **Reversibility:** reversible

### Totals summary (ACTIVITY-01)
- **D-06:** The summary shows total hours, total sessions and active days for the selected slice (D-03), with the excluded-row count (D-02) visible near it.

### Claude's Discretion
- Whether the split's aggregates are precomputed per slice in the worker at import and stored on the dataset meta record, or queried on demand from the rows table. Either way the worker stays the only Dexie owner (Phase 2 rule) and the main thread never scans raw rows.
- Extra statistics such as median or percentile text under the duration chart. The user chose log-scaled bins only, so add nothing unless it is cheap and clearly useful.
- Exact colour palette (within the Phase 2 palette and the contrast checks already in `tests/unit/contrast.test.ts`), cell size, tooltip styling, bin edges and labels.
- Data-table or text fallback for the charts, and ARIA labelling beyond keyboard-focus tooltips.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs
- `.planning/PROJECT.md` — Core Value, chart-aggregation-at-scale constraint, the note that only a ~3,870-row 2021 sample has been inspected
- `.planning/REQUIREMENTS.md` — ACTIVITY-01 to ACTIVITY-04 (this phase's mapped requirements)
- `.planning/ROADMAP.md` §"Phase 4: Activity Time Dashboards" — goal and the five success criteria (including the 50k+ session, 10-15 year fixture)
- `AGENTS.md` — locked stack, hand-rolled charts, no router, worker rules
- `.planning/research/PITFALLS.md` — outlier-dominated colour scales and the timezone-disclosure pitfall (both addressed by D-01 and D-04)
- `.planning/research/FEATURES.md` — Activity heatmap feature notes; all three charts derive from one shared Sessions parse

### Prior phase decisions
- `.planning/phases/03-dashboard-shell-account-identity/03-CONTEXT.md` — D-02 (Activity_history holds "Playtime" and "Login history" sub-headings), D-07 (`DashboardSection` `ready` snippet contract), D-09 (import counts stay as a caption), D-11 (per-title work is Phase 5)
- `.planning/phases/02-defensive-parsing-persistent-dataset/02-CONTEXT.md` — D-01/D-02 (rows stored header-keyed), D-03/D-04 (skipped rows are visible per category)
- `.planning/phases/02-defensive-parsing-persistent-dataset/02-UI-SPEC.md` and `03-UI-SPEC.md` — spacing scale, typography roles, palette, contrast rules

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/components/Dashboard.svelte` — the comment there says Phases 4 to 6 extend this file and pass `ready` content to the matching `DashboardSection`; the section ids and order are the anchor and nav contract.
- `src/lib/components/DashboardSection.svelte` — takes `id`, `title`, `status`, counts and a children snippet.
- `src/lib/dashboard-status.ts` — pure status derivation; the Activity_history status must move to `ready` once the charts exist.
- `src/lib/worker/db.ts` — Dexie schema (`rows`, `meta`) at version 2 with the v1 wipe upgrader (keep it if a `version(3)` is added); `DatasetMeta` is where precomputed aggregates could live.
- `src/lib/worker/ingest.worker.ts` and `src/lib/types/worker-messages.ts` — the typed message contract; any new query or aggregate message goes here.
- `src/lib/ui-copy.ts` — all copy, with unit tests in `tests/unit/ui-copy.test.ts`.
- `tests/fixtures/export-fixtures.ts` — synthetic export builders; `Sessions.csv` header is `SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP`. A large synthetic Sessions generator (50k+ rows, 10-15 years, overlaps, midnight crossings, bad rows) is new work.

### Established Patterns
- Hand-rolled Svelte 5 runes components, no chart library and no bits-ui installed; text-first UI.
- The worker owns Dexie; the main thread talks to it only through typed messages.
- Skipped rows are counted and displayed, never silently dropped.
- e2e tests use `data-testid`; the zero-network Playwright guard and CSP must stay green.

### Integration Points
- Sessions rows are stored in the `rows` table under category `Activity_history`; the login IP column lives in the same rows, so never render it in Phase 4 (Phase 6 owns IP display and masking).
- The selector state must survive dataset replacement and clear without leaving a stale value.

</code_context>

<specifics>
## Specific Ideas

- Timezone label wording: "as recorded in the export (likely UTC or server time)".
- Summary lists each selector value's hours beside the "All" figures.

</specifics>

<deferred>
## Deferred Ideas

- A local-timezone toggle for the heatmaps — revisit if real exports show a reliable timezone basis.
- Median and percentile statistics for session length — optional, see Claude's Discretion.
- Touch-friendly tooltips and phone-width chart layout — Phase 7.
- Per-title Player_statistics breakdown — Phase 5.

</deferred>

---

*Phase: 4-Activity Time Dashboards*
*Context gathered: 2026-09-29*
