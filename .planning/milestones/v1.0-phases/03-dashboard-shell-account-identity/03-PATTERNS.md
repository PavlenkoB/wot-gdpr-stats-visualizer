# Phase 3: Dashboard Shell & Account Identity - Pattern Map

**Mapped:** 2026-09-29
**Files analyzed:** 14
**Analogs found:** 13 / 14 (all paths verified via `git ls-files`)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/App.svelte` (modify) | component (page shell) | request-response / state-branch | itself | exact |
| `src/lib/components/DashboardSection.svelte` (new) | component | request-response | `src/lib/components/FailureBanner.svelte` | role-match |
| `src/lib/components/IdentityHeader.svelte` (new) | component | transform | `src/lib/components/ResultsView.svelte` | role-match |
| `src/lib/components/SectionNav.svelte` (new) | component | event-driven (IntersectionObserver) | none | no analog |
| `src/lib/components/ImportBar.svelte` (new) | component | request-response | `src/App.svelte` persistent-bar + `.cleared-ack` | role-match |
| `src/lib/components/UnsupportedBanner.svelte` (new) | component | transform | `FailureBanner.svelte` | exact style |
| `src/lib/section-status.ts` (new, pure fn) | utility | transform | `src/lib/worker/categories.ts` (+ `recomputeStatusCounts`) | role-match |
| `src/lib/types/worker-messages.ts` (modify) | model/contract | request-response | itself | exact |
| `src/lib/worker/db.ts` (modify) | model/store | CRUD | itself | exact |
| `src/lib/worker/ingest.worker.ts` (modify) | service | batch/transform | itself | exact |
| `src/lib/ui-copy.ts` (modify) | utility | transform | itself | exact |
| `src/lib/components/ResultsView.svelte`, `CategoryBadge.svelte` (delete) | retired | | | |
| `tests/unit/section-status.test.ts`, `ui-copy.test.ts`, `db.test.ts`, `ingest-worker.test.ts` | test | | existing unit tests | exact |
| `tests/e2e/privacy-leak.spec.ts` (new), other e2e updates | test | | `tests/e2e/persistent-dataset.spec.ts` | role-match |
| `tests/fixtures/export-fixtures.ts` (modify) | test fixture | | itself (line 220 area) | exact |

## Pattern Assignments

### `src/App.svelte` (modify)
Keep: window drag/drop guard (lines 53-70, `<svelte:window ondragover ondrop>`), `statusTextFor` `$derived.by` (92-99), `confirmCopy` `$derived.by` with shared start-over/clear-data branch (110-130), `onDropFiles/onStartOver/onClearData` (22-50), `data-worker-ready` on `<main>` (135), spinner CSS + `prefers-reduced-motion` (305-327).
Restructure: state branching at lines 138-271. Only `checking-cache` shows the spinner alone (D-28); `confirm-pending` renders `ConfirmPanel` (160-166) inside the Import bar area while the dashboard stays visible (D-27). Move `.cleared-ack` (line 241, `role="status"`, `data-testid="cleared-ack"`) and `FailureBanner` (226) plus the duplicate notice into the single live-region notice slot in ImportBar.

Imports pattern (lines 1-20): `.ts` extensions on relative imports, `ingestClient` singleton from `./lib/ingest-client.ts`, types via `import type`, components as default imports from `./lib/components/X.svelte`.

### `DashboardSection.svelte`
Analog `FailureBanner.svelte` (lines 1-27): runes props idiom.
```svelte
<script lang="ts">
  interface Props { message: string; }
  let { message }: Props = $props();
</script>
<div role="alert" data-testid="failure-banner" class="failure-banner">{message}</div>
<style> .failure-banner { margin:0 0 16px; padding:12px 16px; border:1px solid #c5221f; border-radius:6px; ... font-size:16px; line-height:1.5; } </style>
```
Use `Snippet` prop for content (Svelte 5 `children`/named snippet, `{@render}`), `id`, `title`, `status`; add `data-testid` per section, `scroll-margin-top`. Scoped `<style>`, hard-coded hex palette from 02-UI-SPEC (muted `#80868b`/`#3c4043`, neutral `#f1f3f4`/`#f7f7fa`, border `#dadce0`, focus `#1a73e8`).

### `UnsupportedBanner.svelte`
Copy `FailureBanner` structure but neutral palette (`.cleared-ack` App.svelte 333-342: `border:1px solid #80868b; background:#f1f3f4; color:#3c4043`). Same style for all three tiers (D-22). Counts via `formatFileCount` (ui-copy.ts 67-69).

### `ImportBar.svelte`
Analog App.svelte persistent-bar (351-378): bar `border:1px solid #dadce0; border-radius:6px; background:#f7f7fa; padding:12px 16px`; button `padding:8px 16px; border:1px solid #80868b; border-radius:6px; background:#fff; font-size:14px; font-weight:600; cursor:pointer`; `:focus-visible { outline:3px solid #1a73e8; outline-offset:2px }`. Keep `data-testid="clear-data-control"`, `start-over`. Embeds `Dropzone` (`disabled`, `statusText`, `onfiles` props as in App.svelte 182-186) and `ConfirmPanel`.

### `section-status.ts` (pure function)
Analog `categories.ts` lines 11-48 (pure, no DOM, readonly consts, `import type` from `../types/worker-messages.ts`) and worker `recomputeStatusCounts` (ingest.worker.ts 219-231). Input `ClassifyResult | null`; lookup `categories.find(c => c.name === X)`; `rowCount ?? 0` (field optional, worker-messages.ts 13). Statuses: `not-loaded | no-export | empty | pending | ready`. Use `SUPPORTED` order? NO - D-02 order differs (Payment_history before User_Info); define own fixed order const. Unsupported block = categories where `status !== 'supported'`.

### `worker-messages.ts` (modify)
Add to `ClassifyResult` (lines 22-33) an optional `identity?: AccountIdentity` (`{ nickname?: string; region?: string; createdAt?: string }`), following the doc-comment style of `importedAt`. `cache-status` (line 53) already carries `ClassifyResult`, so no new message type needed.

### `db.ts` (modify)
```ts
this.version(1).stores({ rows: '++id, category, sourceFile', meta: 'id' });  // lines 53-56
```
D-19: add `this.version(2).stores({...same...}).upgrade(tx => tx.table('rows').clear() && tx.table('meta').clear())` (or delete-and-recreate) so old email-bearing caches are discarded. Add `identity` to `DatasetMeta` (37-43); extend `writeDataset` signature (73-78) and the `db.meta.put({ id:'active', hash, accountRoot, importedAt, categories })` call (85) — keep single-transaction discipline.

### `ingest.worker.ts` (modify)
Strip point: parse loop lines 163-180, where `data: parsed.rows[r]!.data` is pushed. For `entry.name === 'User_Info'` drop keys `LOGIN`, `BIRTH_DATE`, `BIRTH_DATE_SRC` from `data` before push and derive identity (row where `ID === accountRoot`, fallback row 1, D-17) before stripping. Pass identity into `writeDataset` (189-194) and `finalResult` (196-200). Add `identity: existing.identity` in BOTH cached-result constructions (lines 85-90 `handleCheckCache`, 118-123 duplicate). Errors keep the single catch pattern (202-210).

### `ui-copy.ts` (modify)
Pattern: exported `const` strings with doc comments, and pure formatters (e.g. `formatFileCount` 67-69). Remove `formatSummary` (57-59) and badge copy (D-23); add section/banner/skeleton copy and update `tests/unit/ui-copy.test.ts` (imports at lines 1-11, `describe('stable copy')` style with exact-string `toBe`).

### Tests
- Unit: vitest `describe/test/expect` per `tests/unit/ui-copy.test.ts`; DB tests in `tests/unit/db.test.ts`, worker in `tests/unit/ingest-worker.test.ts`.
- E2E privacy test: model on `tests/e2e/persistent-dataset.spec.ts` (imports fixtures + `dropFiles` from `./helpers.ts`, `data-testid` selectors). Update assertions using `SAMPLE_BADGE_ORDER`, `formatSummary`, `account-heading`.
- Fixtures: `export-fixtures.ts` line 220 writes `${root}/User_Info/Account_Info.csv` via `encode(CRLF + ACCOUNT_INFO_HEADER + CRLF + ACCOUNT_INFO_ROW + CRLF)`; add builders for no-User_Info and multi-row variants alongside `buildRenamedRootExport` etc.

## Shared Patterns
- Worker is sole Dexie owner; main thread only via typed messages (db.ts header 15-21).
- Single error path: catch -> `scope.postMessage({type:'error', jobId, detail})`.
- Copy in `ui-copy.ts`; e2e uses `data-testid`; text-only status (never colour alone).
- `prefers-reduced-motion` guard as at App.svelte 322-327 (extend to `scroll-behavior`).

## No Analog Found
| File | Reason |
|---|---|
| `SectionNav.svelte` (sticky anchor nav, IntersectionObserver scroll-spy, `aria-current`) | No observer or nav code exists; use RESEARCH.md patterns. Use Svelte 5 `$effect` with cleanup return. |

## Metadata
**Search scope:** `src/`, `tests/`. **Files read:** App.svelte, db.ts, worker-messages.ts, ingest.worker.ts, categories.ts, ui-copy.ts (partial), FailureBanner.svelte, fixtures/tests (partial). ResultsView/Dropzone/ConfirmPanel not read in full.
