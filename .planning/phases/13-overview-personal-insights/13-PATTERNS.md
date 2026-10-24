# Phase 13: Overview personal insights - Pattern Map

**Mapped:** 2026-10-23
**Files analyzed:** 22 (new and modified)
**Analogs found:** 19 / 22

Sources read: `13-CONTEXT.md` (D-01..D-23), `13-RESEARCH.md` (Focus 1-4 in full, Architecture, Pitfalls headings; Focus 5-6 sections not re-read in this pass, so the planner should consult them directly), `13-UI-SPEC.md` (full). Analog paths below were checked with `git ls-files` and are all git-tracked source (no gitignored mirrors).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/core/types/worker-messages.ts` (modify) | model (message types) | request-response | same file, existing `playtime`/`logins` DataQuery + DataResult variants | exact |
| `src/lib/features/overview/overview-shared.ts` (new) | model (shared view types) | transform | `src/lib/features/playtime/playtime-shared.ts` | role-match |
| `src/lib/worker/data-queries.ts` (modify) | service (channel table, validator, answer switch) | request-response | same file: `DATA_FILES`, `isDataQuery`, `answerDataQuery` | exact |
| `src/lib/worker/ingest.worker.ts` (modify) | service (worker dispatch) | request-response | same file: `handleDataQuery` `logins` branch (lines ~336-339), `handlePlaytimeQuery` (lines ~224-285) | exact |
| `src/lib/worker/db.ts` (modify) | service (Dexie snapshot reader) | CRUD | same file: `readRowsByFile` (~920-968), `writePlaytimeIfCurrent` (~987-997) | exact |
| `src/lib/features/overview/overview-aggregate.ts` (new, worker-only) | service (pure builder) | transform | `src/lib/features/vehicles/vehicle-aggregate.ts`, `src/lib/features/playtime/playtime-aggregate.ts` (`aggregateSlice` ~533) | role-match |
| `src/lib/features/overview/vehicle-table.generated.ts` (new, worker-only, committed) | config (generated data) | batch | `src/lib/geo/world-map.generated.ts`, `src/lib/geo/country-table*` | exact |
| `scripts/vehicles/build-vehicle-table.ts` (new, Node build script) | utility (build script) | batch | `scripts/geo/build-world-map.ts`, `scripts/geo/build-country-table.ts` | exact |
| `src/lib/features/playtime/playtime-aggregate.ts` (modify: `longestSeconds`, version 4) | service | transform | same file `aggregateSlice` and `PLAYTIME_VERSION` in `playtime-shared.ts` (line ~64) | exact |
| `src/lib/features/overview/overview-definitions.ts` (new) | config (tile metadata) | transform | `src/lib/features/logins/login-shared.ts` | role-match |
| `src/lib/features/overview/overview-client.ts` (new, optional wrapper) | service (main-thread client) | request-response | `src/lib/features/playtime/playtime-client.ts` | exact |
| `src/lib/features/overview/overview-state.ts` (new) | store (state) | event-driven | `src/lib/features/finance/finance-state.ts` (`acceptDataOutcome` line ~164) | role-match |
| `src/lib/features/overview/overview-model.ts` (new, page-side pure fill) | utility | transform | `src/lib/shell/overview-model.ts` (to be deleted; keep only the file name) plus sketch `_shared/model.js` (`fillSpans`, `gridHoles`) | role-match |
| `src/lib/features/overview/overview-pins.ts` (new) | utility (localStorage, guarded) | CRUD | no localStorage analog in shell (banned there); pattern from the research Pins section | no-analog |
| `src/lib/features/overview/OverviewTile.svelte` (new) | component | request-response | `src/lib/features/playtime/PlaytimeSummary.svelte` (runes, props) and `src/lib/shell/FailureBanner.svelte` | role-match |
| `src/lib/features/overview/OverviewGroup.svelte` (new) | component | transform | `src/lib/features/playtime/PlaytimeCharts.svelte` | role-match |
| `src/lib/features/overview/OverviewBars.svelte` (new, hand-rolled SVG bars) | component | transform | `src/lib/features/playtime/HourGrid.svelte`, `src/lib/features/logins/CountryList.svelte` | role-match |
| `src/lib/shell/Overview.svelte` (rewrite) | component (composer) | request-response | same file (201 lines) for the root `data-testid="overview"` and `openPane` wiring | exact |
| `src/lib/shell/Dashboard.svelte` (modify line ~387) | component | event-driven | same file, existing `<Overview {result} onopen={openPane} />` | exact |
| `src/lib/shell/ui-copy.ts` (modify) | config (copy) | transform | same file, `formatOpenSectionLink` (keep) and chip formatters (delete, ~3513-3541) | exact |
| `eslint.config.js` (modify) | config | — | same file, `no-restricted-imports` block (~273-313, `login-aggregate.ts` ignore precedent) | exact |
| `package.json` (modify: `vehicles:table`, `vehicles:table:check`) | config | — | same file, `geo:country`, `geo:map`, `geo:map:check` scripts | exact |
| `tests/unit/guards/lint-guards.test.ts` (modify) | test | — | same file, probes at lines ~286-288 and ~316-318 | exact |
| `tests/unit/features/overview/*.test.ts` (new) | test | — | `tests/unit/features/playtime/*` (sibling layout) and the fixture pattern in `tests/fixtures/player-stats-fixtures.ts` | role-match |
| `tests/e2e/shell/overview.spec.ts` or rewrite in `master-detail-nav.spec.ts` (lines ~783-846) | test | — | same file, "three chips and six cards" test | role-match |

## Pattern Assignments

### `src/lib/worker/data-queries.ts` (service, request-response) — the `overview` channel

**Analog:** same file.

**Channel table pattern** (lines ~109-127, verified):
```typescript
export const DATA_FILES: Readonly<Record<Exclude<DataQuery['channel'], 'logins'>, ChannelFiles>> = {
  // ...
  vehicles: { names: VEHICLE_FILE_NAMES, categories: [CATEGORY_PLAYER_STATS] },
  // ...
};
```
Add `overview` as a file-reading channel. Its file names are the WoT player-statistics, sessions and financial files the aggregate needs. Overview is NOT field-less in the file table sense, but the validator must be field-less (see below). Update the header comment's channel count (lines ~356-358, "nine channels" becomes ten).

**Field-less validator pattern** (lines ~325-341):
```typescript
export function isDataQuery(x: unknown): x is DataQuery {
  // ...
  if (query.channel !== 'vehicles') {
    // A field-less channel accepts EXACTLY one own field: `channel`.
    const keys = Object.keys(x);
    return keys.length === 1 && keys[0] === 'channel';
  }
}
```
`DATA_CHANNELS` (line ~290) is `new Set([...Object.keys(DATA_FILES), 'logins'])`, so registering `overview` in `DATA_FILES` is enough for membership. Tests: bare query true; plus `title`, `battleType` or `game` false; `Object.create({ channel: 'overview' })` false.

**Answer switch pattern** (line ~370-393): an exhaustive switch with `default: throw new Error('unreachable channel')`. Add an `overview` case that returns `{ channel: 'overview', view: buildOverviewView(...) }`. Without it the default throws.

### `src/lib/worker/ingest.worker.ts` (service, request-response)

**Analog:** same file, `handleDataQuery` (lines ~312-401). The `logins` channel is answered BEFORE the memo and the `DATA_FILES` lookup (lines ~336-339). The `overview` branch must take the same shape: validate, branch to `answerOverview` before memo lookup, read meta and rows in one transaction, memoise per `importedAt` (memo key `channel:JSON(query)`, `MAX_MEMO_ENTRIES = 16`, lines ~508-553).

Stale-aggregate rule (copy from `handlePlaytimeQuery`, lines ~245-270): if `meta.playtime.v !== PLAYTIME_VERSION`, rebuild from session rows and write back only via `writePlaytimeIfCurrent`.

### `src/lib/worker/db.ts` (service, CRUD)

**Analog:** `readRowsByFile` (lines ~920-968) already reads `meta` inside its transaction. Extend `RowsSnapshot` additively with the meta's `playtime` so the answer is one snapshot. Keep `writePlaytimeIfCurrent` (lines ~987-997) for the rebuild write-back.

### `src/lib/features/playtime/playtime-aggregate.ts` and `playtime-shared.ts` (service, transform) — longest session

**Analog:** same files. Add `longestSeconds: number` to `PlaytimeSlice`, computed in `aggregateSlice` (line ~533) as the max of `end - start` over usable raw sessions. Bump `PLAYTIME_VERSION` from `3` to `4` (`playtime-shared.ts` line ~64). Tests pinned to 3 must move: `tests/unit/import/ingest-worker.test.ts` line ~2063 and line ~2074. Option B (compute in the overview branch) avoids the bump but reads all session rows per first answer (Research Focus 2).

### `src/lib/features/overview/overview-aggregate.ts` (service, pure builder, worker-only)

**Analogs:** `src/lib/features/vehicles/vehicle-aggregate.ts` (per-account row builder; `resolvedByGroup` lines ~241-246, rows stay PER ACCOUNT lines ~824-840) and `src/lib/features/playtime/playtime-aggregate.ts` (`aggregateSlice` lines ~533-571; `buildPlaytimeFromSources` ~608).

Rules to copy:
- Keys resolved per account group from that group's own first row (CR-01 rule, `AccountRowGroup` in `src/lib/worker/csv-columns.ts`; read with `cell` and `headerKey`). Never read one account's cells through another's keys.
- "Logged in": `playtime.all.seconds` (already merged, reuse; do not reimplement D-05).
- Per-game strip: `playtime.byGame[].scope.all.seconds`.
- Habits (streak via `dayIndex`, busiest via `daySeconds`, signature hour via `hourOverlap` with `cell % 24`): WoT scope only (D-20).
- Records (`DAMAGE_MAX`, `XP_MAX`, `FRAGS_MAX`, series): MAX across groups, tank from the group holding the max (D-19). Counts and totals SUM (D-04).
- Credits: `buildCurrency` in `src/lib/features/finance/finance-aggregate.ts` (lines ~502, ~552), deposits plus income (D-21). Money stays bigint micro-units (`src/lib/core/decimal.ts`, `MICRO_SCALE`).
- Orders: count rows only; no order field may enter the view type.
- Small-sample guards: 100 battles per tank for per-tank rates, 30 battles for plain rates (UI-SPEC Absent Data).
- Tank lookup: `nation:tag` for vehicle stats, numeric `tank_id` for records. Missing tank: tag-derived name and "class unknown"; missing record id: "vehicle not recorded".

### `src/lib/features/overview/vehicle-table.generated.ts` and `scripts/vehicles/build-vehicle-table.ts` (config and utility, build-time)

**Analogs:** `scripts/geo/build-world-map.ts` (writes `src/lib/geo/world-map.generated.ts`; `--check` mode at line ~130; in-memory regeneration ~340; compare to committed file ~352) and `scripts/geo/build-country-table.ts` (plain Node `.ts`, native type stripping, `erasableSyntaxOnly`: no enums, namespaces, parameter properties or decorators).

Generated header: copy the `GENERATED FILE - do not edit by hand` style from `src/lib/geo/world-map.generated.ts`.

Shape: `export const VEHICLE_TABLE = [[tank_id, 'nation:tag', 'short name', 'type', tier], ...] as const;` plus `VEHICLE_TABLE_META = { count, sha256, generatedAt (date only), host }`. Never write the key, the application id or a keyed URL into the file.

Fail-closed rules (Research Focus 4): non-`ok` status aborts; non-positive or non-numeric `tank_id` rejected; duplicate `nation:tag` rejected; `type` outside `mediumTank`, `AT-SPG`, `heavyTank`, `lightTank`, `SPG`, `unknown` rejected; tier outside 1 to 10 rejected; size capped.

Key: read `WG_APPLICATION_ID` from the process env or the local env file, never printed or logged. Do not read `.env*` in research or planning. The Terms of Use gate (Research Focus 4, D-07, D-23) is a blocking human-verify task that must come BEFORE the commit task. Attribution footer copy is pending that checkpoint (UI-SPEC OI-4).

Runtime: static import only, inlined into the worker chunk. No dynamic `import()`, no fetch (zero-network spec counts worker requests).

### `eslint.config.js` (config)

**Analog:** same file, `no-restricted-imports` block (~273-313) with `group: ['**/geo/country-table*', ...]`. Add `**/vehicle-table*` to the worker-only group. Add `src/lib/features/overview/overview-aggregate.ts` to that block's `ignores` (the `src/lib/features/logins/login-aggregate.ts` entry is the precedent). Probe in `tests/unit/guards/lint-guards.test.ts` lines ~286-288 and ~316-318.

### `src/lib/features/playtime/playtime-client.ts` (service, request-response) — analog for `overview-client.ts`

**Analog excerpt** (verified, lines 1-60):
```typescript
export type PlaytimeOutcome =
  | { kind: 'result'; queryId: number; importedAt: string | null; view: PlaytimeView | null }
  | { kind: 'error'; queryId: number; detail: string }
  | { kind: 'superseded'; queryId: number };

export type PlaytimePost = (message: IngestRequest) => void;
export type PlaytimeAvailability = () => boolean;
```
Copy: the three-way settlement (result, error, superseded), never rejecting, own `queryId` namespace. For Overview, prefer reusing the existing `QueryClient` (`src/lib/core/query-client.ts`, per-channel supersede) with `ingestClient.data` (worker-client.svelte.ts ~line 214). Only write a thin `overview-client.ts` if typing is needed. No new client class.

Error state: `FailureBanner.svelte` (`src/lib/shell/FailureBanner.svelte`) styling and copy pattern. Do NOT reuse `GENERIC_FAILURE_MESSAGE` (UI-SPEC Copywriting).

### `src/lib/shell/Overview.svelte` (component, composer) — rewrite

**Analog:** same file (201 lines). Keep:
- Root `data-testid="overview"` (mobile-sweep, zero-network, identity and vehicle e2e use it).
- `openPane` callback prop for "Open <Section>" links.
- Mount inside `{#if active === 'overview'}` in `Dashboard.svelte` (~386): leaving unmounts, returning reads the memo.

Remove: chips (`ov-chip-*`, lines ~46-52), cards (`ov-card-*`, lines ~54-74), `ov-open-*`.

Phase-8 guard (`tests/unit/guards/phase8-shell-guards.test.ts` ~189-210): the file must not contain `localStorage`, `sessionStorage`, `location.hash`, `pushState`, `replaceState`, `{@html`, `innerHTML`, and must not contain `<b>`. Pins live in `overview-pins.ts`.

Container breakpoints: root `container-type: inline-size`; columns at 880 and 480 (`@container` rules, allowed by the guard). Exactly one `@media (max-width: 480px)` block exists in `src/app.css`; do not add another.

### `src/lib/features/overview/overview-model.ts` (utility, page-side fill)

**Analog:** sketch `sources/overview-final/030-overview-final/_shared/model.js` (`fillSpans`, `gridHoles`), verified against 309,247 cases. Port, do not redesign. Pure, no DOM. Name clash: `src/lib/shell/overview-model.ts` is DELETED by this phase; the new file lives in the feature folder.

Test: exhaustive enumeration of pin subsets in node; assert no hero or metric is widened and no result has more holes than leaving the group alone (UI-SPEC Verification Hooks).

Spans are written through CSSOM only (`--span4`, `--rows4`, `--span2`), recomputed on render, pin and unpin only.

### `src/lib/features/overview/overview-pins.ts` (utility, localStorage) — no shell analog

Single key `wg-overview-pins`, JSON array of tile ids. Read and write in try/catch. On read: drop non-array, non-string and unknown ids, drop duplicates, fall back to defaults `['logged', 'tank']` when nothing valid remains. Max 17 entries. Written only on explicit pin or unpin, never on load. Storage is the only persistence; no Dexie change (D-14).

### `src/lib/features/overview/OverviewTile.svelte`, `OverviewGroup.svelte`, `OverviewBars.svelte` (components, runes)

**Analogs:** `src/lib/features/playtime/PlaytimeSummary.svelte` (runes and props style), `src/lib/features/playtime/HourGrid.svelte` (hand-rolled SVG cells, aria-hidden chart with a visually hidden text summary), `src/lib/features/logins/CountryList.svelte` (list rows).

Tile anatomy from UI-SPEC: `<button aria-expanded>` with phrasing content only (`span display:block`), star as a SIBLING `<button>` over the wrapper's top-right corner (never nested), `aria-keyshortcuts="p"`, star label fixed "Pin {name}", `aria-pressed`. Roving tabindex with one tabbable tile.

Bars: hand-rolled SVG, heat scale `#47a374 -> #6b8a14 -> #8c6400` with `u = t^1.5`, peak labelled in text, baseline `#8c8c8c`, max 24 hour bars and one bar per year. No `<b>`.

Announcements go through the page-level live region (`CHART_ANNOUNCE_KEY` context from `Dashboard.svelte`). Do not add an `aria-live` node (e2e counts exactly two).

### `src/lib/shell/ui-copy.ts` (config, copy)

**Analog:** same file, lines ~3513-3541. Delete `formatChipWithData`, `formatChipAbsent`, `formatChipUnsupported`, `OVERVIEW_INTRO`. Keep `formatOpenSectionLink` (tile links) and `ROW_HEADLINE_NONE`. Check `formatEarliestCreated` and `IDENTITY_CREATED_LABEL` before deleting (only the old Overview card uses them).

### Shared patterns

**Worker channel plumbing (apply to the `overview` channel):**
- Source: `src/lib/worker/data-queries.ts`, `handleDataQuery` in `ingest.worker.ts`.
- Apply to: `worker-messages.ts`, `data-queries.ts`, `ingest.worker.ts`, `db.ts`.
- One Dexie snapshot per answer; supersede per channel; memo keyed on `importedAt`; `clearDataQueryMemo()` on every ingest and clear.

**Zero-network and no-real-data guards:**
- Source: `tests/unit/guards/no-real-data.test.ts` (leak guard: new fixtures use synthetic ids and figures only).
- Source: `tests/unit/guards/fetch-scan.test.ts` (scans `src/`; `scripts/**` is exempt).
- Apply to: all new fixtures and the generated table. Add a guard that `application_id` and the key-name literal are absent from `src/`.

**Fixtures for new columns:**
- Source: `tests/fixtures/player-stats-fixtures.ts` (`WOT_MAIN_HEADER`, sixteen columns).
- The repository has no fixture with `BATTLE_LIFE_TIME_SEC`, `DAMAGE_BLOCKED_BY_ARMOR`, `TREES_CUT_COUNT`, `MAX_*_VEHICLE` or `*_SERIES_MAX`. Add a NEW synthetic fixture with those headers, using invented ids and figures only.

**Names in CSV rows:** every multi-account read uses `AccountRowGroup` and `cell`/`headerKey` from `src/lib/worker/csv-columns.ts` (CR-01).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/features/overview/overview-pins.ts` | utility | CRUD (localStorage) | No localStorage use exists in the shell (banned there by the phase-8 guard). Use RESEARCH.md Pins section and UI-SPEC Pins. |
| Bento fill and CSS-grid expand with View Transitions | component | event-driven | No existing View Transitions usage. Use UI-SPEC Layout, Expand and motion, and sketch 030 `fillSpans` port. |

## Metadata

**Analog search scope:** `src/lib/worker/`, `src/lib/features/{playtime,vehicles,logins,finance}/`, `src/lib/core/`, `src/lib/shell/`, `src/lib/geo/`, `scripts/geo/`, `tests/fixtures/`.
**Files scanned:** about 20 source files (targeted reads and line ranges only).
**Pattern extraction date:** 2026-10-23

## Notes for the planner

- Blocking checkpoints: the Wargaming Terms of Use gate (D-07, D-23) must precede the commit of `vehicle-table.generated.ts`. RESEARCH.md states the gate is NOT cleared.
- Open decisions: UI-SPEC OI-1 to OI-6. Logged-in absent handling (OI-3) and pinned order (OI-2) affect the fill result only.
- The e2e budget moves with the three CI limits (`tests/unit/guards/ci-budget.test.ts`) if new specs push past the ceiling.
- Synthetic figures only in any excerpt you write; the leak guard rejects real ids.
