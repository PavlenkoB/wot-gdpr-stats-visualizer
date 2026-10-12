# Phase 4: Activity Time Dashboards - Pattern Map

**Mapped:** 2026-09-29
**Files analyzed:** 33 new/modified
**Analogs found:** 30 / 33 (all analog paths verified git-tracked via `git ls-files`)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/lib/civil-date.ts` | utility | transform | `src/lib/scroll-spy.ts` (pure-module style) | role-match |
| `src/lib/playtime-shared.ts` | config/constants | transform | `src/lib/dashboard-status.ts` | role-match |
| `src/lib/worker/playtime.ts` | service (pure) | batch/transform | `src/lib/worker/identity.ts` | exact |
| `src/lib/worker/db.ts` (mod) | model | CRUD | itself (`identity` param precedent, lines 37-52, 121-137) | exact |
| `src/lib/worker/ingest.worker.ts` (mod) | controller (worker) | request-response | itself (`handleCheckCache`, `resultFromMeta`, `handleIngest`) | exact |
| `src/lib/types/worker-messages.ts` (mod) | model/types | request-response | itself (lines 82-94) | exact |
| `src/lib/playtime-model.ts` | utility (pure) | transform | `src/lib/scroll-spy.ts` + `src/lib/dashboard-status.ts` | role-match |
| `src/lib/playtime-client.svelte.ts` (or rune-free class) | provider/client | request-response | `src/lib/worker-client.svelte.ts` (`#handle`, lines 450-530) | role-match |
| `src/lib/worker-client.svelte.ts` (mod) | provider | request-response | itself | exact |
| `src/lib/dashboard-status.ts` (mod) | utility | transform | itself (line 91) | exact |
| `src/lib/ui-copy.ts` (mod) | utility (copy) | transform | itself (`formatRowCount`, `formatSkippedRowCount`, lines 52-77) | exact |
| `src/lib/components/Dashboard.svelte` (mod) | component (composition root) | request-response | itself (lines 50-60) | exact |
| `src/lib/components/Playtime.svelte` (+ tiles, split table) | component | request-response | `IdentityHeader.svelte` (variant state, tiles/dl) + `ImportSummary.svelte` (pill/skip tag) | role-match |
| `CalendarHeatmap.svelte`, `HourGrid.svelte` | component (SVG grid) | event-driven | none in repo for SVG/roving focus; `DashboardNav.svelte` for sticky and CSS conventions | partial |
| `DurationList.svelte` | component | transform | `IdentityHeader.svelte` `dl` grid styling | partial |
| `ChartTooltip.svelte` | component | event-driven | none | none |
| `src/app.css` (mod: `--ramp-0..5`) | config | n/a | itself (line 18 `--nav-offset`) | exact |
| `tests/fixtures/sessions-fixtures.ts` | test fixture | batch | `tests/fixtures/export-fixtures.ts` (lines 220-231, 280-306) | role-match |
| `tests/unit/{playtime,playtime-model,civil-date,playtime-client}.test.ts` | test | transform | `tests/unit/identity.test.ts`, `scroll-spy.test.ts`, `ingest-client.test.ts` | role-match |
| `tests/unit/ingest-worker.test.ts` (mod/add) | test | request-response | itself (lines 43-90 harness) | exact |
| `tests/unit/dashboard-status.test.ts`, `ui-copy.test.ts`, `contrast.test.ts` (mod/add ramp test) | test | transform | themselves | exact |
| `tests/e2e/playtime.spec.ts`, `playtime-scale.spec.ts` | test | e2e | `tests/e2e/dashboard.spec.ts` + `helpers.ts` (`dropFiles`) | role-match |
| `tests/e2e/{dashboard,import-flow,persistent-dataset}.spec.ts` (migrate to ready) | test | e2e | themselves | exact |
| `.claude/skills/run-data-export-viewer/driver.mjs`, `SKILL.md` (mod) | tooling | batch | themselves | exact |

## Pattern Assignments

### `src/lib/worker/playtime.ts` (pure worker service, batch/transform)

**Analog:** `src/lib/worker/identity.ts` (pure functions, no worker globals, Node-testable; header comment explains the enforcement point).

**Header-normalisation pattern to copy** (identity.ts lines 75-77, 106-114). Resolve the four columns (`SESSION_START`, `SESSION_END`, `SERVER_NAME`, `CLIENT_PLATFORM`) via `trim().toUpperCase()`, first match wins, and never read `IP`:
```typescript
function normalizeKey(key: string): string {
  return key.trim().toUpperCase();
}
function pick(row: UserInfoRow, column: string): string | null {
  for (const [key, value] of Object.entries(row)) {
    if (normalizeKey(key) !== column) continue;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed !== '') return trimmed;
  }
  return null;
}
```
Deviation: RESEARCH Pitfall 7 says resolve the column names ONCE from the first row's keys (cache by key signature) instead of `Object.entries` per row, since 250k rows would allocate heavily. Keep `normalizeKey`, drop the per-row `Object.entries`.

**Case-insensitive category predicate pattern** (identity.ts lines 67-69), to model `isSessionsRow(category, sourceFile)`:
```typescript
export function isUserInfoCategory(name: string): boolean {
  return name.toLowerCase() === 'user_info';
}
```

**Core algorithms:** take `parseSessionTimestamp`, `aggregateSlice`, `addHourOverlap` and `civil-date.ts` verbatim from 04-RESEARCH.md "Code Examples" (lines ~397-470); no closer real analog exists. Use `Map` for value grouping (never object keys from untrusted strings).

**Header-comment convention:** every pure worker module opens with a "Why this exists" block referencing plan and decision ids (identity.ts lines 3-37).

---

### `src/lib/worker/db.ts` (modify: `DatasetMeta.playtime?`, `writeDataset` sixth param, backfill helper)

**Analog:** itself, the `identity` precedent.

**Meta field pattern** (lines 43-51):
```typescript
identity?: AccountIdentity | null;
```
Add `playtime?: PlaytimeAggregates | null;` the same way. No `version(3)` needed (non-indexed field; keep `version(2)` + upgrader untouched, comment at lines 62-85).

**Write pattern** (lines 121-137), add the optional sixth param and include it in the same `meta.put`:
```typescript
export async function writeDataset(
  hash: string, accountRoot: string, categories: CategoryEntry[], rows: DatasetRow[],
  identity: AccountIdentity | null = null,
): Promise<{ importedAt: string }> {
  const importedAt = new Date().toISOString();
  await db.transaction('rw', db.rows, db.meta, async () => {
    await db.rows.clear();
    for (let i = 0; i < rows.length; i += ROWS_PER_BULKPUT_CHUNK) {
      await db.rows.bulkPut(rows.slice(i, i + ROWS_PER_BULKPUT_CHUNK));
    }
    await db.meta.put({ id: 'active', hash, accountRoot, importedAt, categories, identity });
  });
  return { importedAt };
}
```
**Backfill write** (new): guarded transaction from RESEARCH Pattern 2 (`db.transaction('rw', db.meta, ...)` with `current.importedAt === meta.importedAt` check, then `db.meta.update('active', { playtime })`). Read session rows via `orderBy('sourceFile').uniqueKeys()` then single-key `where('sourceFile').equals(key)`; never `anyOf` (2.2 s in fake-indexeddb).

Rule: db.ts stays imported ONLY by `ingest.worker.ts` (header lines 15-21).

---

### `src/lib/worker/ingest.worker.ts` (modify)

**Analog:** itself.

**Dispatch pattern** (lines 21-42): add a `playtime-query` branch in the same `if (msg.type === ...) { await handleX(...); return; }` shape.

**Handler + error-channel pattern to copy** (`handleCheckCache`, lines 79-96):
```typescript
async function handleCheckCache(jobId: number): Promise<void> {
  try {
    const existing = await checkCache();
    scope.postMessage({ type: 'cache-status', jobId, cached: existing ? resultFromMeta(existing) : null } satisfies IngestResponse);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[ingest.worker] check-cache failed', err);
    scope.postMessage({ type: 'error', jobId, detail: `${e.name}: ${e.message}` } satisfies IngestResponse);
  }
}
```
For `handlePlaytimeQuery` the catch must post `{ type: 'playtime-error', queryId, detail }`, NOT the `error` type (its handlers key on `jobId`). Log without row contents.

**Collecting session rows** in `handleIngest`: in the row loop (lines 193-210) where `allRows.push(...)` happens, also push a compact reference to a `sessionRows` array when `isSessionsRow(entry.name, resolved.sourceFile)`; set `sessionsFileSeen` in the same place. Call `buildPlaytime(...)` between the identity extraction (line 223) and `writeDataset` (line 229), wrapped in try/catch storing `null` on failure (RESEARCH: "Import must not fail because aggregation failed"). Pass as the sixth argument.

**Do not** touch `resultFromMeta` (lines 110-118) or spread `...meta` into any message (aggregates must never ride `ClassifyResult`).

---

### `src/lib/types/worker-messages.ts` (modify)

**Analog:** itself, lines 82-94. Extend the unions with the same `// NEW` comment style:
```typescript
export type IngestRequest =
  | { type: 'ingest'; jobId: number; file: File }
  | { type: 'check-cache'; jobId: number }
  | { type: 'clear-data'; jobId: number }
  | { type: 'playtime-query'; queryId: number; valueIndex: number | null };
export type IngestResponse =
  | ...
  | { type: 'playtime-result'; queryId: number; importedAt: string | null; view: PlaytimeView | null }
  | { type: 'playtime-error'; queryId: number; detail: string };
```
Place `PlaytimeSlice`, `PlaytimeAggregates`, `PlaytimeView` types here (RESEARCH shapes) using the doc-comment style of `AccountIdentity` (lines 52-72): explain what may cross to the main thread. `IP` must not appear in any of these types.

---

### `src/lib/worker-client.svelte.ts` (modify, small) and `src/lib/playtime-client.svelte.ts`

**Analog:** `worker-client.svelte.ts` `#handle` (lines 450-530).

**Delegation point:** `#handle` currently runs `if (msg.type === 'ready') ... else if 'stage' ... ` with `if (msg.jobId !== this.#jobId) return;` gates. Add at the very top:
```typescript
if (msg.type === 'playtime-result' || msg.type === 'playtime-error') { this.playtime.handle(msg); return; }
```
Queries use their own `queryId` counter and never touch `#jobId`, `state`, or the settle timer. Add 2-3 regression tests in `tests/unit/ingest-client.test.ts`.

**Runes shim caveat:** `tests/unit/setup.ts` line 40 only shims `$state`, not `$state.raw`. Prefer a rune-free latest-wins class (no setup change), with the component holding the reactive cell.

---

### `src/lib/dashboard-status.ts` (modify)

**Analog:** itself, line 91:
```typescript
export const BUILT_DASHBOARDS: ReadonlySet<SectionId> = new Set();
```
Change to `new Set(['activity-history'])`. Then fix `tests/unit/dashboard-status.test.ts` (~line 183, loop asserting `pending` with the default set: pass `new Set()` explicitly) and migrate the listed e2e assertions (RESEARCH Pitfall 9) in the same plan.

---

### `src/lib/ui-copy.ts` (modify)

**Analog:** itself, singular/plural + `toLocaleString` helpers (lines 52-77):
```typescript
export function formatRowCount(n: number): string {
  return n === 1 ? '1 row' : `${n.toLocaleString()} rows`;
}
export function formatSkippedRowCount(n: number): string {
  return n === 1 ? '1 row skipped' : `${n.toLocaleString()} rows skipped`;
}
```
All Playtime copy goes here (`formatHours`, `formatExcludedRows`, year-head summary, tooltip lines, duration bin labels, `formatSelectionAnnouncement`, etc.), with tests in `tests/unit/ui-copy.test.ts` (same file layout). Use explicit `toLocaleString('en-US')` for the new helpers (UI-SPEC says en-US; existing helpers use the default locale). Reuse `SECTION_NOTE_PENDING` (line 269) for the Login history placeholder.

---

### `src/lib/components/Dashboard.svelte` (modify)

**Analog:** itself, lines 44-60. The comment says Phases 4-6 pass `ready` content as a children snippet:
```svelte
{#each SECTIONS as section (section.id)}
  <DashboardSection id={section.id} title={SECTION_TITLES[section.id]}
    status={sectionStatus(section.id, result)} counts={sectionCounts(section.folder, result)}
    note={section.id === 'user-info' ? SECTION_NOTE_USER_INFO : SECTION_NOTE_PENDING} />
{/each}
```
Convert to a block form for the `activity-history` id only, e.g. `{#if section.id === 'activity-history'}<DashboardSection ...><Playtime {result} /></DashboardSection>{:else}...{/if}`. `DashboardSection.svelte` is reused unchanged: its `ready` branch renders `{@render children?.()}` then the caption `ImportSummary` (lines 96-103), and the root element must never be swapped (lines 8-25). Do not re-derive ids or order.

---

### `src/lib/components/Playtime.svelte` and child components (state machine, tiles, split table, excluded pill)

**Analog:** `IdentityHeader.svelte`.

**Props/derived-variant pattern** (lines 31-54):
```svelte
interface Props { result: ClassifyResult | null; }
let { result }: Props = $props();
const variant = $derived<'skeleton' | 'fallback' | 'loaded'>(
  result === null ? 'skeleton' : result.identity ? 'loaded' : 'fallback',
);
```
Model `data-state` (loading/ready/updating/no-session-file/no-usable-sessions/error) the same way: a `$derived` state name plus `data-testid="playtime"` `data-state={state}` on a root that is never swapped. Key everything on the primitive `result.importedAt` (not the `result` object). Wrap query dispatch in `untrack`.

**Untrusted-text + CSS conventions** (lines 123-132, 161-184): flex column, `min-width: 0`, `overflow-wrap: anywhere`, plain interpolation (no `{@html}`, banned by lint), `dl` grid for tiles, hex colours in component stylesheets, no inline styles (CSP; `svelte/no-inline-styles` is an error). Tile `dt` = 14/600 `#5f6368`; `dd` numbers Display role 28/600 (see `.nickname`, line 136-145).

**Excluded pill:** copy the amber skip-tag styling from `ImportSummary.svelte` (the `hasSkipped` tag block after line 55; read its `<style>` for exact border `#f9ab00` / bg `#fef7e0` / text `#8a5a00`). Never render "0 excluded".

**Test-id conventions:** `data-testid` values from UI-SPEC section 13; `ImportSummary` derives its testid the same way (lines 42-48).

---

### `CalendarHeatmap.svelte`, `HourGrid.svelte`, `ChartTooltip.svelte`, `DurationList.svelte`

No in-repo SVG/roving-focus analog. Use RESEARCH Pattern 5/6 and UI-SPEC sections 5-8 and 13.

Partial analogs:
- Sticky behaviour and `--nav-offset` (`src/app.css:18` `--nav-offset: 72px;`; `DashboardNav.svelte` is `position: sticky; top: 0; z-index: 1`). Year head: `position: sticky; top: calc(var(--nav-offset) - 16px)`, sibling of the scroller. Measure in Playwright rather than hard-coding 56.
- `DashboardSection.svelte` line 122 `scroll-margin-top: var(--nav-offset);` for scroll clearance styling.
- `Dropzone.svelte:107` uses a targeted `<!-- svelte-ignore ... -->` for an a11y warning: use the same for `a11y_interactive_supports_focus` on the `role="grid"` svg, or set `tabindex="-1"` on it.
- Cell fills as classes `level-0..level-5` reading `--ramp-*` custom properties defined in `src/app.css`. Tooltip position via CSSOM (`el.style.left = ...`) only; `setAttribute('style')`/`cssText` are CSP-blocked. Use delegated `onpointerover`/`onkeydown`/`onfocusin`/`onfocusout`/`onpointerout` (Svelte delegates these); `pointerleave` is not delegated.

Pure decision logic (rank scale, calendar geometry, key navigation, tooltip clamp, date/hour formatting) belongs in `src/lib/playtime-model.ts`, following the `scroll-spy.ts` split: pure decision rule in a `.ts` file with a long "why" header (lines 1-42), `window` access only in the component (Vitest has no jsdom).

---

### `src/lib/civil-date.ts`, `src/lib/playtime-shared.ts`

**Analog:** `src/lib/scroll-spy.ts` / `src/lib/dashboard-status.ts` for style (pure, exported constants and functions, explanatory header). Content from RESEARCH Code Examples (`daysFromCivil`, `civilFromDays`, `weekdayOfDay`; 12 bin edges; `MAX_SPLIT_VALUES = 50`; `SPLIT_COLUMNS = ['SERVER_NAME','CLIENT_PLATFORM']`). Never use `new Date('YYYY-MM-DD HH:mm:ss')` or `toLocaleDateString` for CSV-derived values.

---

### `tests/fixtures/sessions-fixtures.ts`

**Analog:** `tests/fixtures/export-fixtures.ts`.

**Header/row pattern** (lines 220-231):
```typescript
const SESSIONS_HEADER = 'SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP';
const SESSIONS_ROW = ['2020-06-01 12:00:00','2020-06-01 13:30:00','1.0.0','win','eu-1','192.0.2.20'].join(';');
```
**Zip entry pattern** (line 285): `` out[`${root}/Activity_history/Sessions.csv`] = encode(SESSIONS_HEADER + CR + SESSIONS_ROW + CR); `` (bare-CR `CR` convention). Keep the canonical `sampleEntries` set stable (comment lines 277-278); the new large generator is a separate, seeded builder (50k+ rows, 10-15 years, overlaps, midnight crossings, bad rows, 3+ server values, plus a 5,000-session vs 60,000-session pair over identical years for the node-count invariance test). Reuse the existing `buildCustomExport`/`buildLargeExport` wrappers where they fit; use documentation IPs (`192.0.2.x`) only, generated in memory (real exports live in gitignored `tests/fixtures/private/`).

---

### Unit tests

- `tests/unit/playtime.test.ts`: model on `tests/unit/identity.test.ts` (pure functions on hand-built rows). Include the throwing-getter `IP` test (RESEARCH Pitfall 2), padded/lower-case header test, `__proto__` value test, per-second oracle for hour overlap.
- `tests/unit/playtime-model.test.ts`, `civil-date.test.ts`: model on `tests/unit/scroll-spy.test.ts` (pure rule tests).
- Worker-level: extend `tests/unit/ingest-worker.test.ts`, using its harness (header lines 54-79: install `globalThis.self = { postMessage: vi.fn(), onmessage: null }` before dynamic import, `vi.resetModules`, delete IndexedDB) and `waitForTerminal(spy, timeoutMs)` (line 86). Pass an explicit timeout above the 10 s default for 50k rows. Keep backfill tests to a few hundred rows.
- `tests/unit/playtime-client.test.ts` and regressions in `ingest-client.test.ts`.
- Ramp test in the `tests/unit/contrast.test.ts` style: `readFileSync` the spec/components/app.css from `REPO_ROOT` (lines 1-40), use `contrastRatio`/`relativeLuminance` from `tests/helpers/contrast.ts`; assert monotonic ramp, adjacent steps >= 1.25, level 4 >= 4.5, level 5 >= 7, and code ramp equals the UI-SPEC ramp.

### E2E tests

**Analog:** `tests/e2e/dashboard.spec.ts` and `tests/e2e/helpers.ts` (`dropFiles`, `DropFileSpec`). Use `data-testid` hooks; the zero-network guard (`zero-network.spec.ts`) must stay green. A replace requires a confirm click and a different fixture (fflate stamps mtime). Playwright Chromium cannot be downloaded in this sandbox, so verification runs in CI or human-verify. Also re-run `scroll-nav.spec.ts` and 375px specs after the status flip (Activity card becomes much taller).

---

## Shared Patterns

### Worker sole-Dexie-owner and typed messages
**Source:** `src/lib/worker/db.ts` lines 15-21; `src/lib/types/worker-messages.ts` lines 82-108. **Apply to:** all worker/message files. The main thread never scans rows and never imports `db.ts`; new request/response types are added to the shared unions and posted with `satisfies IngestResponse`.

### Single error channel per worker handler
**Source:** `ingest.worker.ts` lines 79-96. **Apply to:** `handlePlaytimeQuery`. try/catch, `console.error('[ingest.worker] ... failed', err)` (no row contents), post a structured error message.

### Pure-module-plus-thin-component split
**Source:** `src/lib/scroll-spy.ts` header (lines 1-42), `dashboard-status.ts`. **Apply to:** `playtime-model.ts`, `civil-date.ts`, `playtime-shared.ts`, worker `playtime.ts`. Logic in `.ts` with no runes; components only wire.

### Untrusted-text rendering and CSP
**Source:** `IdentityHeader.svelte` header (lines 16-30) and styles (lines 123-132). **Apply to:** every new component. Plain interpolation; `min-width: 0` + `overflow-wrap: anywhere`; no inline styles, no `{@html}`; IP never read or rendered anywhere in Phase 4 (attributes, tooltips, aria-labels, test ids).

### Copy centralisation
**Source:** `src/lib/ui-copy.ts` + `tests/unit/ui-copy.test.ts`. **Apply to:** all strings.

### Skipped/excluded counts are shown, never silent
**Source:** `ImportSummary.svelte` skip tag (lines 34-60). **Apply to:** the D-02 excluded-row pill.

### Phase-3 section contract
**Source:** `DashboardSection.svelte` lines 8-25, 96-103. Root element never swapped; children render inside `ready`, then the import caption.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `CalendarHeatmap.svelte` / `HourGrid.svelte` | component | event-driven | No SVG or roving-tabindex grid exists; use RESEARCH Pattern 6 and UI-SPEC sections 5-6 |
| `ChartTooltip.svelte` | component | event-driven | No tooltip or CSSOM-positioned element exists; use UI-SPEC section 8 |
| Percentile `rankLevels`, `clampTooltip`, key-navigation reducers | utility | transform | Pure new logic; use RESEARCH Pitfall 5 and UI-SPEC (put in `playtime-model.ts`) |

## Metadata

**Analog search scope:** `src/lib/**`, `src/app.css`, `tests/unit`, `tests/fixtures`, `tests/e2e/helpers.ts`, `.claude/skills` (via `git ls-files`)
**Files scanned:** ~70 tracked non-planning files listed; ~14 read in full or in relevant ranges
**Note:** RESEARCH.md was read to line 471 of 691 (Code Examples for hour overlap and later pitfalls/assumptions not re-read); planner should consult the remainder for the `addHourOverlap`/`binOf` code and the assumptions log.
**Pattern extraction date:** 2026-09-29
