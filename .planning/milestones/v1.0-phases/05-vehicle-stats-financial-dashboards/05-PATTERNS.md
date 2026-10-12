# Phase 5: Vehicle Stats & Financial Dashboards - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 36 (new and modified)
**Analogs found:** 34 / 36 (all analog paths verified git-tracked via `git ls-files src tests`)

Row contents of any real export were not read or quoted. Only repo source, fixtures and headers.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/lib/worker/categories.ts` (mod: add `Financial_data`) | config | transform | itself, lines 11-16 | exact |
| `src/lib/dashboard-status.ts` (mod: `SECTIONS`, `NAV_ORDER`, `BUILT_DASHBOARDS`) | utility (pure) | transform | itself, lines 39-94 | exact |
| `src/lib/ui-copy.ts` (mod: `SECTION_TITLES`, all new copy) | config | transform | itself + `tests/unit/ui-copy.test.ts` | exact |
| `src/lib/components/Dashboard.svelte` (mod: 3 ready branches) | component | request-response | itself, lines 60-85 (`activity-history` branch) | exact |
| `src/lib/components/DashboardNav.svelte` (mod: sixth link) | component | event-driven | itself | exact |
| `src/lib/types/worker-messages.ts` (mod: new request/response variants) | model (types) | request-response | `playtime-query` / `playtime-result` / `playtime-error`, lines 205-233 | exact |
| `src/lib/query-client.ts` (new, channel-scoped) | service | request-response | `src/lib/playtime-client.ts` | role-match (supersede per channel) |
| `src/lib/worker-client.svelte.ts` (mod: delegate, `failPending`) | service | request-response | itself, lines 169, 207, 223, 527-528 | exact |
| `src/lib/worker/ingest.worker.ts` (mod: new query handlers, memo clear) | controller (worker) | request-response | `handlePlaytimeQuery`, lines 62-161 | exact |
| `src/lib/worker/db.ts` (mod: `readRowsByFile`) | service | CRUD (read snapshot) | `readSessionRowData`, lines 241-281 | exact |
| `src/lib/worker/vehicle-stats.ts` (new, pure builder) | utility | transform | `src/lib/worker/playtime.ts` (header-name resolution, file-name table) | role-match |
| `src/lib/worker/finance.ts` (new, pure builders) | utility | transform/batch | `src/lib/worker/playtime.ts` (`parseSessionTimestamp`, excluded counts) | role-match |
| `src/lib/decimal.ts` (new) | utility | transform | `src/lib/civil-date.ts` (pure, no DOM, shared both sides) | partial |
| `src/lib/vehicle-shared.ts`, `src/lib/finance-shared.ts` (new constants) | config | n/a | `src/lib/playtime-shared.ts` | exact |
| `src/lib/vehicle-state.ts`, `src/lib/finance-state.ts` (new, pure) | utility | request-response | `src/lib/playtime-state.ts` | exact |
| `src/lib/vehicle-model.ts` (new: sort/search/windowRange) | utility | transform | `src/lib/playtime-model.ts` | role-match |
| `src/lib/bar-chart-model.ts` (new) | utility | transform | `src/lib/playtime-model.ts` (HourGrid model, `TooltipRequest`) | role-match |
| `src/lib/components/PlayerStats.svelte` | component | request-response | `src/lib/components/Playtime.svelte` | exact |
| `src/lib/components/VehicleTable.svelte` | component | transform (windowed) | `CalendarHeatmap.svelte`/`HourGrid.svelte` (scroll, tooltip skeleton); no table analog | partial |
| `src/lib/components/BattleTypeSummary.svelte` | component | transform | `PlaytimeSummary.svelte` | role-match |
| `src/lib/components/PremiumBlock.svelte`, `CurrencyBlock.svelte`, `SpendSummary.svelte` | component | request-response | `Playtime.svelte` + `PlaytimeSummary.svelte` | role-match |
| `src/lib/components/MonthlyBarChart.svelte` | component | event-driven | `src/lib/components/HourGrid.svelte` | role-match |
| `src/lib/components/MonthlyDataTable.svelte` | component | transform | `src/lib/components/DurationList.svelte` | role-match |
| `src/lib/components/ChartTooltip.svelte` (mod: `extra` lines) | component | event-driven | itself, lines 118-119 | exact |
| `src/lib/components/ExcludedNotice.svelte` (mod: props for pill/explanation/testId) | component | transform | itself, lines 1-77 | exact |
| `tests/fixtures/export-fixtures.ts` (mod: replace Player_statistics, add Financial_data, Orders cols) | test fixture | batch | itself, `sampleEntries` lines 280-327, `SCALE_ROW_TEMPLATES` ~line 805 | exact |
| `tests/fixtures/player-stats-fixtures.ts`, `finance-fixtures.ts` (new) | test fixture | batch | `tests/fixtures/playtime-real-shape-fixture.ts`, `playtime-hand-fixture.ts` | exact |
| `tests/unit/vehicle-stats.test.ts`, `vehicle-model.test.ts`, `finance.test.ts`, `decimal.test.ts` | test | transform | `tests/unit/playtime.test.ts`, `playtime-model.test.ts` | exact |
| `tests/unit/query-client.test.ts` | test | request-response | `tests/unit/playtime-client.test.ts` | exact |
| `tests/unit/vehicle-state.test.ts`, `finance-state.test.ts` | test | transform | `tests/unit/playtime-state.test.ts` | exact |
| `tests/unit/dashboard-status.test.ts`, `ui-copy.test.ts`, `ingest-worker.test.ts`, `db.test.ts`, `classify.test.ts` (mod: counts, six sections) | test | transform | themselves | exact |
| `tests/e2e/vehicle-stats.spec.ts`, `finance.spec.ts` | test (e2e) | request-response | `tests/e2e/playtime.spec.ts` + `helpers.ts` | exact |
| `tests/e2e/dashboard.spec.ts`, `zero-network.spec.ts`, `import-flow.spec.ts`, `scroll-nav.spec.ts` (mod) | test (e2e) | request-response | themselves | exact |
| Premium/currency/vehicle scale fixtures and spec | test | batch | `playtime-scale.spec.ts`, `tests/unit/playtime-scale.test.ts` | role-match |

## Pattern Assignments

### Section plumbing (categories.ts, dashboard-status.ts, ui-copy.ts, Dashboard.svelte)

**Analog:** the files themselves. All discrete lists are explicit and typed, so the compiler finds omissions.

`src/lib/worker/categories.ts` lines 11-16: add `'Financial_data'` to the array.
```typescript
export const SUPPORTED: readonly string[] = [
  'Activity_history',
  'Player_statistics',
  'User_Info',
  'Payment_history',
];
```
`src/lib/dashboard-status.ts` lines 39-44, 64-70, 94: insert `{ id: 'financial-data', folder: 'Financial_data' }` after `player-statistics`; same in `NAV_ORDER`; `BUILT_DASHBOARDS` gains `player-statistics`, `financial-data`, `payment-history`. Update the "four supported sections" doc comments (they will be wrong).
```typescript
export const SECTIONS = [
  { id: 'activity-history', folder: 'Activity_history' },
  { id: 'player-statistics', folder: 'Player_statistics' },
  { id: 'payment-history', folder: 'Payment_history' },
  { id: 'user-info', folder: 'User_Info' },
] as const;
...
export const BUILT_DASHBOARDS: ReadonlySet<SectionId> = new Set<SectionId>(['activity-history']);
```
`sectionStatus` already yields `ready` when `rowCount > 0`, so Financial_data "ready if either file has rows" (D-02) needs no new status code.

`src/lib/components/Dashboard.svelte` lines ~60-85: copy the `{#if section.id === 'activity-history'}` branch shape; add `else if` branches rendering `<PlayerStats>`, a financial column (`PremiumBlock` + `CurrencyBlock`) and `<SpendSummary>`; the `.activity` flex column (24px gap, `min-width: 0`) is the layout to copy.
```svelte
{#if section.id === 'activity-history'}
  <div class="activity">
    <Playtime {result} client={ingestClient.playtime} />
    <LoginHistorySection />
  </div>
{/if}
```
Re-classify old caches: Research "Category re-classification at replay" (RESEARCH lines 512-523) applies; no Dexie version bump.

---

### `src/lib/types/worker-messages.ts` (mod)

**Analog:** lines 205-233. Add variants to both unions with their own `queryId`, a `channel` field, `importedAt` echo, and an error variant carrying only `detail`.
```typescript
  | { type: 'playtime-query'; queryId: number; valueIndex: number | null };
...
  | {
      type: 'playtime-result';
      queryId: number;
      importedAt: string | null;
      view: PlaytimeView | null;
    }
  | { type: 'playtime-error'; queryId: number; detail: string };
```
Keep `playtime-*` unchanged (existing tests assert them). Views carry decimal STRINGS for money; never `NAME`, `ORDER_UUID`, `PAY_COUPON_NAME`, `PAY_AGGREGATOR_DESC`, `AA_PACKAGE_LIST`.

---

### `src/lib/query-client.ts` (service, request-response)

**Analog:** `src/lib/playtime-client.ts` (lines 1-190). Copy: rune-free and DOM-free; injected `post` and `isAvailable`; outcome union `result | error | superseded` that never rejects; `failPending(detail)` with FIXED strings; fixed details `'worker unavailable'` and `'post failed'`; unknown `queryId` ignored in `handle`; id consumed before the availability check.
```typescript
query(valueIndex: number | null): Promise<PlaytimeOutcome> {
  this.#queryId += 1;
  const queryId = this.#queryId;
  this.#supersedePending();
  if (!this.#isAvailable()) {
    return Promise.resolve({ kind: 'error', queryId, detail: 'worker unavailable' });
  }
  return new Promise<PlaytimeOutcome>((resolve) => {
    this.#pending.set(queryId, resolve);
    try { this.#post({ type: 'playtime-query', queryId, valueIndex }); }
    catch { this.#pending.delete(queryId); resolve({ kind: 'error', queryId, detail: 'post failed' }); }
  });
}
```
Deviation required (RESEARCH Pitfall 1): `#supersedePending` must resolve only pending entries of the SAME `channel` (`'vehicles'|'premium'|'currency'|'spend'`); the `queryId` counter stays shared. Store `{channel, resolve}` in the map.

**Wiring** `src/lib/worker-client.svelte.ts`: construct next to `this.playtime = new PlaytimeClient(...)` (line 169); add `failPending` calls beside lines 207 and 223; add one delegation branch next to line 527-528 (FIRST in `#handle`, before any state-machine branch):
```typescript
if (msg.type === 'playtime-result' || msg.type === 'playtime-error') {
  this.playtime.handle(msg);
```

---

### `src/lib/worker/db.ts` (mod: `readRowsByFile`)

**Analog:** `readSessionRowData`, lines 241-281. One `'r'` transaction over `rows` and `meta`; index-only `orderBy('sourceFile').uniqueKeys()`; screen keys by name; one single-key `where('sourceFile').equals(key)` per match; never `anyOf`/multi-key (comment at lines 216-224 records 2,243 ms on 3,000 rows); answer with the snapshot's own `importedAt`.
```typescript
return db.transaction('r', db.rows, db.meta, async () => {
  const meta = await db.meta.get('active');
  if (meta === undefined) return null;
  const keys = await db.rows.orderBy('sourceFile').uniqueKeys();
  for (const key of keys) {
    if (typeof key !== 'string' || !isSessionFileName(key)) continue;
    const matches = await db.rows.where('sourceFile').equals(key).toArray();
    ...
  }
  return { importedAt: meta.importedAt, sources };
});
```
Change: predicate is a lower-cased exact file-name table (RESEARCH Pattern 7 table); category comparison lower-cased after the read.

---

### `src/lib/worker/ingest.worker.ts` (mod: handlers)

**Analog:** `handlePlaytimeQuery`, lines 62-161. Copy: dispatch branch at lines 62-65 (`await handleXQuery(msg...)`; `return`), the `meta === null` -> `importedAt: null, view: null` answer, the snapshot-then-answer-with-snapshot's-`importedAt` rule, and the catch that `console.error`s the real error and posts `{ type: '...-error', queryId, detail }`.
```typescript
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[ingest.worker] playtime-query failed', err);
    scope.postMessage({ type: 'playtime-error', queryId, detail: `${e.name}: ${e.message}` } satisfies IngestResponse);
  }
```
Differences: Phase 5 answers on demand from `readRowsByFile` and memoises per `importedAt` (clear in `handleClearData` and after a successful ingest); do not store aggregates on meta. Wrap each pure builder (`buildPremium`, `buildCurrency`, `buildSpend`) in try/catch so a bug is a block `error`, not a lost import (the T-04-03 rule at ~line 381-390).

---

### `src/lib/vehicle-state.ts`, `src/lib/finance-state.ts` (utility, pure)

**Analog:** `src/lib/playtime-state.ts`. Copy the three-function core: `derive*State` (order of tests: no dataset -> loading; `shown.importedAt !== importedAt` -> loading; failed -> error; requested differs -> updating; else the view's own status), `acceptOutcome` (drop superseded; drop dataset mismatch; error -> `failed` WITHOUT the worker `detail`; null stamp or mismatch -> null; null view -> null; stamp with the ASK), and `isCacheClearedElsewhere`.
```typescript
export function acceptOutcome(outcome, ask: RequestedSlice, currentImportedAt) : ShownPlaytime | null {
  if (outcome.kind === 'superseded') return null;
  if (currentImportedAt === null || currentImportedAt !== ask.importedAt) return null;
  if (outcome.kind === 'error') return { kind: 'failed', importedAt: ask.importedAt, valueIndex: ask.valueIndex };
  if (outcome.importedAt === null || outcome.importedAt !== ask.importedAt) return null;
  if (outcome.view === null) return null;
  return { kind: 'view', importedAt: ask.importedAt, valueIndex: ask.valueIndex, view: outcome.view };
}
```
Vehicle state replaces `valueIndex` with `{ title, battleType }` (null means "worker picks the default"; applied values come back in the view). Reset on dataset replace/Clear (D-28). `statusLine`/announcement idea (lines 233-257) applies to `player-stats-status`.

---

### `src/lib/vehicle-shared.ts`, `src/lib/finance-shared.ts` (config)

**Analog:** `src/lib/playtime-shared.ts`. Pure, zero imports, importable from both sides of the message boundary; each constant has a "why" doc comment; version constants bumped when stored meaning changes (only if anything is stored).
```typescript
export const MAX_SPLIT_VALUES = 50;
export const SPLIT_COLUMNS: readonly SplitColumn[] = ['GAME', 'SERVER_NAME', 'CLIENT_PLATFORM'];
```
Put in finance-shared: `CHART_MIN_OPS = 50`, `CHART_MAX = 8` (UI-SPEC); in vehicle-shared: title ids, `ROW_PX = 40`, overscan.

---

### `src/lib/worker/vehicle-stats.ts`, `finance.ts` (pure builders)

**Analog:** `src/lib/worker/playtime.ts` (783 lines; use Grep, not a full read). Reuse, do not reimplement: `parseSessionTimestamp` (lines ~150-175; ISO and dotted day-first, range-checked), `civilFromDays` (`civil-date.ts:75-85`), the anchored exact file-name table precedent `sessionFileNameGame` (~233-238), and `headerKey` trim-and-uppercase normalisation (~300-302). Use `Map`, never plain objects keyed by untrusted strings (`__proto__`). Code for `parsePremium`, `parseDecimalUnits`, `formatMoneyAmount`, `windowRange` is in RESEARCH Patterns 3, 5, 6 (lines 295-377); copy those, they are the spec.

---

### `src/lib/components/PlayerStats.svelte` (and PremiumBlock, CurrencyBlock, SpendSummary)

**Analog:** `src/lib/components/Playtime.svelte` (556 lines). Copy:

Imports and props (lines 1-28, 80-87): state/model helpers imported from pure modules; `Props { result: ClassifyResult | null; client: ... }`.

Dataset key and raw state (lines 106-127):
```typescript
const importedAt = $derived(result?.importedAt ?? null);
let shown = $state.raw<ShownPlaytime | null>(null);
let requested = $state.raw<RequestedSlice | null>(null);
let alive = true;
onMount(() => { return () => { alive = false; }; });
```
Load with `acceptOutcome` and reconcile of dropped asks (lines 142-212), dataset effect with `untrack` that resets selection state (lines 214-230):
```typescript
$effect(() => {
  const wanted = importedAt;
  if (wanted === null) return;
  untrack(() => {
    requested = { importedAt: wanted, valueIndex: null };
    announcement = '';
    cacheCleared = false;
    void load(null, false);
  });
});
```
Native `<select>` handler (lines 240-246) with `$props.id()` for label ids (line 94). `data-state` on the block root (e2e reads `playtimeBlock(page)` `data-state`). Premium/currency/spend blocks have no user-initiated change, so no announcement; they use `role="status"`/`role="alert"` without `aria-live` (UI-SPEC section 12).

---

### `src/lib/components/MonthlyBarChart.svelte` (component, event-driven)

**Analog:** `src/lib/components/HourGrid.svelte`. Copy the interaction skeleton: props `{ model, describedBy, onTip }` (line 59-62) with `onTip: (request: TooltipRequest | null, anchor?: Element | null) => void`; one delegated `onpointerover`/`onpointerout` and `onfocusin`/`onfocusout` pair on the `<svg>` (lines 319-321, not per node); roving `tabindex={cell.index === active ? 0 : -1}` (line 385); `await tick()` before `node.focus()` (comment lines 218-227); `scrollClear` from `focus-clear.ts` with the smooth-scroll suspend at lines 267-274; `onTip(null, null)` on leave. Fixed `width`/`height`, no `viewBox` (text stays 14px). Tooltip goes through the shared `ChartTooltip`; node budget `3 x months + 40`. Do not reuse `ChartLegend` (it is the ramp legend); copy its chrome for the two-swatch legend.

`TooltipRequest` (`playtime-model.ts:824-831`) gains `extra?: readonly string[]` so Phase 4 callers compile unchanged:
```typescript
export interface TooltipRequest {
  anchor: Rect;
  line1: string;
  line2: string;
}
```
`ChartTooltip.svelte` renders `{#each extra}` Caption lines after `line-two`; placement stays CSSOM-only (lines 118-119).

---

### `src/lib/components/ExcludedNotice.svelte` (mod)

**Analog:** itself. Today it hard-codes `data-testid="playtime-excluded"` and the playtime explanation (lines 2, 36, 38). Generalise props to `{ count, pill?, explanation, testId }`, keep the render-nothing-at-zero rule through the pill formatter and the amber pill CSS (lines 56-66). Existing playtime callers must pass their old values so Phase 4 tests stay green (RESEARCH Pitfall 8).

---

### `src/lib/components/VehicleTable.svelte` (component, windowed table)

**Partial analog only.** No table analog exists. Use RESEARCH Pattern 3 verbatim (`windowRange`, 40px rows, spacer `<tr aria-hidden>` heights written via `el.style.height` in `$effect`, `aria-rowindex = i + 2`, `aria-rowcount = total + 1`, rAF-coalesced passive scroll, `scrollTop = 0` on sort/search/title change). CSP rule: never a `style` attribute or `style:` directive (lint guard in `tests/unit/lint-guards.test.ts`); CSSOM writes only, as `ChartTooltip` does. Scroll/rAF handling can be modelled on `CalendarHeatmap.svelte` (815 lines; Grep for `onscroll`/`requestAnimationFrame` first). Test ids and structure are in UI-SPEC section 7 (`vehicle-table`, `vehicle-scroller`, `vehicle-sort-{key}`, `vehicle-row`).

---

### `src/lib/vehicle-model.ts`, `src/lib/bar-chart-model.ts` (pure models)

**Analog:** `src/lib/playtime-model.ts` (904 lines): pure, no DOM, no words, unit-tested in Node; `TooltipRequest`/`Rect` and `clampTooltip` live here and are reused, not duplicated. Models return geometry/keys; copy is formatted in components via `ui-copy.ts`.

---

### Fixtures: `tests/fixtures/export-fixtures.ts` (mod), `player-stats-fixtures.ts`, `finance-fixtures.ts` (new)

**Analog (mod):** `sampleEntries` (lines 280-327) writes each file as `CRLF + HEADER + CRLF + ROW + CRLF`:
```typescript
out[`${root}/Player_statistics/WOT_stats.csv`] = encode(
  CRLF + WOT_STATS_HEADER + CRLF + WOT_STATS_ROW + CRLF,
);
```
Replace the four invented `Player_statistics` entries with real-named files (headers from RESEARCH lines 173-198), add `Financial_data/Operations_with_Premium_Days.csv` and `Virtual_Currencies_Operations.csv`, extend `ORDERS_HEADER`/`ORDERS_ROW` by the three real columns. Ripple (RESEARCH Pitfall 3): update `SAMPLE_FILE_COUNTS` and `SAMPLE_ROW_COUNTS` (lines 49-79; currently `Player_statistics: 4`, one row per file), `SAMPLE_EXPECTED_COUNTS`, `RENAMED_EXPECTED_COUNTS`, `SAMPLE_BADGE_ORDER` (line 183), and `SCALE_ROW_TEMPLATES` (~lines 805-860, which names the four old files). Then fix every test that counts files/rows (`db.test.ts`, `ingest-worker.test.ts`, `classify.test.ts`, `import-flow.spec.ts`, `zero-network.spec.ts`, `ci-budget.test.ts`).

**Analog (new):** `tests/fixtures/playtime-real-shape-fixture.ts` (header comment lines 1-40: explains structure mirrored from the real export, no real rows kept, every number derived by hand in a comment beside it) and `playtime-hand-fixture.ts` (exports `HAND_ALL`, `HAND_ROWS` consumed by unit and e2e). Plain module, no Playwright/Vitest import, no side effects. Pair with an independent oracle in `tests/helpers/` like `session-oracle.ts` and a unit test that recomputes every hand number with it (see `tests/unit/playtime-hand-fixture.test.ts`). Large generator model: `tests/fixtures/sessions-fixtures.ts` and `playtime-scale.test.ts`.

---

### Tests

**Client test** (`tests/unit/query-client.test.ts`): copy `tests/unit/playtime-client.test.ts` structure (header comment lines 1-35 listing the five settlements; `recordingPost()` helper lines 38-41; Node environment, asserts the module is rune-free). Add cross-channel non-supersede cases.

**State tests:** copy `tests/unit/playtime-state.test.ts` matrix style.

**e2e** (`tests/e2e/vehicle-stats.spec.ts`, `finance.spec.ts`): copy `tests/e2e/playtime.spec.ts` lines 1-70: imports from `./helpers.ts` (`gotoApp`, `importExport`, `replaceExport`, `SYNTHETIC_ZIP_NAME`, block locators like `playtimeBlock`), literals imported from a fixture module (never read from the page and compared with itself), a header comment recording the test budget (CI runs one Playwright worker; every test costs a full import; RESEARCH Pitfall 11 says the budget will be exceeded, so raise it deliberately in `tests/unit/ci-budget.test.ts` and the CI timeout). Add helpers for the new block locators to `tests/e2e/helpers.ts`. `dashboard.spec.ts` live-region assertion goes from two to three explicit `aria-live` (UI-SPEC section 12).

## Shared Patterns

### Worker owns Dexie, typed messages only
**Source:** `src/lib/worker/ingest.worker.ts:62-65`, `src/lib/playtime-client.ts`
**Apply to:** every new query, handler and block. The main thread never reads `rows`.

### Stale-answer rejection by `importedAt`
**Source:** `src/lib/playtime-state.ts:141-172`
**Apply to:** vehicles, premium, currency, spend blocks. Answer stamped with the ASK; worker `detail` never reaches the DOM.

### Snapshot read (meta + rows in one transaction)
**Source:** `src/lib/worker/db.ts:241-281`
**Apply to:** all Phase 5 row reads.

### Excluded counts shown, never silent
**Source:** `src/lib/components/ExcludedNotice.svelte`
**Apply to:** premium (D-20), currency (D-18), spend non-numeric amounts (D-24), unknown `PREMIUM`/TYPE/AMOUNT.

### Aggregate per bucket, never per row
**Source:** `HourGrid.svelte` / `CalendarHeatmap.svelte`, `tests/unit/playtime-scale.test.ts`
**Apply to:** `MonthlyBarChart` (node budget `3 x months + 40`, asserted in a test).

### Copy lives in `ui-copy.ts` with unit tests
**Source:** `src/lib/ui-copy.ts`, `tests/unit/ui-copy.test.ts`
**Apply to:** every new sentence, label and empty-state wording; `SECTION_TITLES: Record<NavId,string>` forces `'financial-data'`.

### CSP and zero-network
**Source:** `ChartTooltip.svelte:118-119` (CSSOM placement), `tests/unit/lint-guards.test.ts`, `tests/e2e/zero-network.spec.ts`
**Apply to:** no `style` attribute or `style:` directive anywhere; zero-network spec must import the new fixture and stay green.

### Untrusted strings
**Apply to:** vehicle IDs, currency codes, game codes. `Map` grouping; text interpolation only; never `NAME`, `ORDER_UUID`, `PAY_COUPON_NAME`, `PAY_AGGREGATOR_DESC`, `AA_PACKAGE_LIST` in messages, DOM, `title`, or test ids (canary test on the account file, RESEARCH line 390).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/components/VehicleTable.svelte` | component | windowed table | No table or virtualised list exists; use RESEARCH Pattern 3 |
| `src/lib/decimal.ts` | utility | BigInt money math | No decimal/money code exists; use RESEARCH Pattern 6 (`civil-date.ts` only shows the pure-shared-module shape) |

## Metadata

**Analog search scope:** `src/lib`, `src/lib/components`, `src/lib/worker`, `tests/unit`, `tests/e2e`, `tests/fixtures`, `tests/helpers`
**Files scanned:** ~15 read in full or in targeted ranges (git-tracked file list of 85 reviewed)
**Pattern extraction date:** 2026-10-01
