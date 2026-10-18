# Phase 10: Merged Dashboard Across Accounts - Pattern Map

**Mapped:** 2026-10-18
**Files analyzed:** 31 (9 new, 22 modified)
**Analogs found:** 31 / 31 (all tracked; verified with `git ls-files` for the shell, fixture and pane files)

Line numbers below were read this session; 10-RESEARCH.md already holds many verified line cites for the worker/aggregate files, so this map points at those instead of repeating them. Re-Read before quoting into a plan action.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/shell/game-filter-state.ts` (NEW) | utility (pure state rules) | transform | `src/lib/shell/selection-state.ts` (`SelectionChoice`, `resolveSelection`, `datasetStamp`) | exact |
| `src/lib/shell/Dashboard.svelte` (mod) | component (composition root) | event-driven (component state) | itself: `choice` / `viewChoice` stamped cells (lines 74-118) | exact |
| `src/lib/shell/GameFilter.svelte` (NEW) | component | event-driven | `.selector-row` block in `src/lib/features/playtime/Playtime.svelte:364-376, 518-530` (label + control CSS) | role-match (no radio chip exists yet) |
| `src/lib/shell/AccountTag.svelte` (NEW) | component (inert chip) | request-response (props in) | `.tag` + `login-account-tag` in `src/lib/features/logins/LoginTable.svelte:173-175, 405-420` | exact |
| `src/lib/shell/identity-model.ts` (mod: `accountTagsOf`, `letterOf`) | utility | transform | same file `accountRows` (projection, no re-sort) | exact |
| `src/lib/shell/IdentityHeader.svelte` (mod: legend chip) | component | request-response | same file, `multi` variant `{#each rows as row, index (index)}` | exact |
| `src/lib/shell/DashboardSection.svelte` (mod: caption copy) | component | request-response | same file line 122, 162-164 | exact |
| `src/lib/ui-copy.ts` (mod: new constants, `formatCombinedCaption`) | config (copy) | n/a | same file `formatCombinedCaption` (line 564) | exact |
| `src/lib/features/playtime/playtime-aggregate.ts` (mod: `byGame`, `games`) | service (worker aggregate) | batch/transform | same file `rankAggregates` (680-730), `aggregateSlice` (532-549) | exact |
| `src/lib/features/playtime/playtime-shared.ts` (mod: VERSION 3, token regex) | model/config | n/a | same file `PLAYTIME_VERSION`, `MAX_SPLIT_VALUES` | exact |
| `src/lib/core/types/worker-messages.ts` (mod: `playtime-query.game`, view `games`/`game`, `no-game-sessions`) | model (message contract) | request-response | same file lines 266-285, 345 | exact |
| `src/lib/worker/ingest.worker.ts` (mod: `handlePlaytimeQuery`, loginSources account) | controller (worker handler) | request-response | same file `handlePlaytimeQuery` (132-134, 205-229) + `isDataQuery` precedent (`data-queries.ts:218-236`) | exact |
| `src/lib/features/playtime/playtime-state.ts` / `playtime-client.ts` (mod: `game` in ask, `awaiting`) | store/service | request-response | same files (`derivePlaytimeState` 121-125; `query` 136) | exact |
| `src/lib/features/playtime/Playtime.svelte` (mod: chips, empty-game, About) | component | request-response | same file; About via `PlaytimeCharts.svelte:201` `AboutDisclosure` | exact |
| `src/lib/features/vehicles/vehicle-shared.ts` (mod: `VehicleRow.account`) | model | n/a | same file | exact |
| `src/lib/features/vehicles/vehicle-aggregate.ts` (mod: stamp account, `Map` summary fold, header) | service | transform | same file `buildSummary` 814-850, `buildHeader` 943-962, `mapRow` 897-928 | exact |
| `src/lib/features/vehicles/vehicle-model.ts` (mod: `filterRows` account text) | utility | transform | same file `filterRows` 230-236 | exact |
| `src/lib/features/vehicles/PlayerStats.svelte` (mod: filter wiring) | component | request-response | same file `ask` (230), `onTitleChange` (247-261) | exact |
| `src/lib/features/vehicles/VehicleTable.svelte` (mod: tag in first cell) | component | CRUD (windowed read) | `LoginTable.svelte` first-cell `sticky-first` branch | role-match |
| `src/lib/features/logins/login-shared.ts` / `login-aggregate.ts` (mod: `accounts`, VERSION 3) | model/service | transform | same files; `buildLogins` `counting` map (273-285) | exact |
| `src/lib/features/logins/login-model.ts` / `LoginTable.svelte` (mod: tags in col 0) | model/component | CRUD (windowed) | same files (`buildLoginRows` 414-432; `cellView` snippet 160-185) | exact |
| `src/lib/features/finance/finance-aggregate.ts` / `finance-shared.ts` (mod: `SpendCard.byAccount`) | service/model | transform | same file `buildSpend` group loop (841-930) | exact |
| `src/lib/features/finance/SpendSummary.svelte` (mod: "Per account" disclosure) | component | request-response | same file `<details class="breakdown">` (317-360) | exact |
| `tests/fixtures/multi-account-fixtures.ts` (mod: `buildOverlapTwoAccountExport`, `buildLargeThreeAccountExport`) | test fixture | batch | same file `buildRealShapeThreeAccountExport` (661) / `assemble` (575) / `RootSpec.files` (375-425) | exact |
| `tests/fixtures/finance-fixtures.ts` (mod: `CURRENCY_54K_SPEC`) | test fixture | batch | `CURRENCY_50K_SPEC` / `CURRENCY_10K_SPEC` + `generateCurrencyOpsCsv` | exact |
| `tests/unit/shell/game-filter-state.test.ts` (NEW) | test | transform | `tests/unit/shell/selection-state.test.ts` | exact |
| `tests/unit/playtime/playtime-multi-account.test.ts` (NEW) | test | transform | `tests/fixtures/playtime-hand-fixture.ts` + `tests/helpers/session-oracle.ts` consumers | role-match |
| `tests/unit/import/multi-account-scale.test.ts` (NEW) | test (worker harness) | batch | `tests/unit/import/multi-account-import.test.ts` | exact |
| `tests/e2e/shell/multi-account-scale.spec.ts` (NEW) | test (e2e) | batch | `tests/e2e/finance/finance-scale.spec.ts` + `tests/e2e/guards/zero-network.spec.ts` | exact |
| `tests/e2e/shell/multi-account.spec.ts`, `identity-privacy.spec.ts` (mod) | test (e2e) | request-response | themselves | exact |
| `playwright.config.ts`, `.github/workflows/ci.yml`, `tests/unit/guards/ci-budget.test.ts` (mod) | config/test | n/a | themselves (10-RESEARCH CI section) | exact |
| `tests/unit/import/multi-account-keys.test.ts` (mod: `AUDITED`), `ingest-worker.test.ts` (mod: VERSION pin), `tests/unit/shell/ui-copy.test.ts` (mod) | test | n/a | themselves | exact |

## Pattern Assignments

### `src/lib/shell/game-filter-state.ts` (utility, transform) - NEW

**Analog:** `src/lib/shell/selection-state.ts`

**Stamped-choice pattern** (lines 237-262, 294-297 of `selection-state.ts`): a plain interface carrying `stamp`, and a pure resolver that discards the choice when the dataset stamp changed. No runes, no storage, Node-testable.
```typescript
export interface SelectionChoice {
  pane: PaneId;
  stamp: string | null;
}
export function datasetStamp(result: ClassifyResult | null): string | null {
  return result?.importedAt ?? null;
}
export function resolveSelection(choice: SelectionChoice, result: ClassifyResult | null): PaneId {
  if (result === null) return DEFAULT_PANE;
  if (choice.stamp !== datasetStamp(result)) return DEFAULT_PANE;
  return choice.pane;
}
```
Copy as `GameFilterChoice { token: string | null; stamp: string | null }` and `resolveGameFilter(choice, importedAt)`; import `datasetStamp` from `selection-state.ts` rather than re-deriving. Also holds `GAME_FILTER_TOKENS = ['WOT','WOTB','WOWS']`, `filterToTitle`, `titleToFilter`, `filterChips` (visibility rule in UI-SPEC Surface 1). Header comment must say "writes nothing; a `$derived` calls this" (same reason as `resolveSelection`).
**Guard:** `phase8-shell-guards.test.ts` forbids `localStorage`/hash/history in the shell; keep the file free of them.

---

### `src/lib/shell/Dashboard.svelte` (component, composition root) - modified

**Analog:** itself, lines 74-118.
```typescript
let choice = $state<SelectionChoice>({ pane: DEFAULT_PANE, stamp: null });
const active = $derived(resolveSelection(choice, result));
function select(id: PaneId): void {
  choice = { pane: id, stamp: datasetStamp(result) };
  window.scrollTo({ top: 0, behavior: 'instant' });
}
...
let viewChoice = $state<PhoneViewChoice>({ view: 'list', stamp: null });
const view = $derived(resolvePhoneView(viewChoice, result));
```
Add `let gameChoice = $state<GameFilterChoice>({ token: null, stamp: null })`, `const gameFilter = $derived(resolveGameFilter(gameChoice, datasetStamp(result)))`, and `setGameFilter(token)` writing `{ token, stamp: datasetStamp(result) }`. Pass `gameFilter` and `onGameFilterChange` as props to `Playtime` and `PlayerStats` only. Never set state from a `$derived` (`state_unsafe_mutation`, comment lines 74-83).

---

### `src/lib/shell/AccountTag.svelte` (component, inert chip) - NEW

**Analog:** `src/lib/features/logins/LoginTable.svelte` `.tag` (CSS lines 405-420) and markup (173-179).
```svelte
{#if cell.tag === true}
  <span class="tag" data-testid="login-account-tag">{cell.text}</span>
{:else}
  {cell.text}
{/if}
{#if cell.hidden !== null}
  <span class="visually-hidden">{cell.hidden}</span>
{/if}
```
```css
.tag { display: inline-block; max-width: 100%; padding: 0 8px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--chip); color: var(--muted); font-size: 14px;
  line-height: 18px; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```
Add `font-weight: 600; min-width: 24px; text-align: center` (UI-SPEC Surface 5), drop `overflow/ellipsis`. Structure: `<span class="tag" data-testid="account-tag"><span aria-hidden="true">{letter}</span></span><span class="visually-hidden">{phrase}</span>`. No `title`, `aria-label`, `aria-describedby`. `.visually-hidden` is currently defined per component (LoginTable line 293); copy the same rule locally (no new global CSS file, no new media query). Conditional rendering at call sites must adjoin neighbours with no whitespace (see `DashboardSection.svelte:162-164` pattern below). Existing "Account record" `.tag` stays as is (hidden at N>=2).

---

### `src/lib/shell/identity-model.ts` (utility) - modified

**Analog:** same file, `accountCountOf` (lines ~106-113) and `accountRows` (projection, "IN THE ORDER GIVEN", never re-sort).
```typescript
export function accountRows(accounts: readonly AccountSummary[]): AccountRowModel[] {
  return accounts.map((account) => { ... });
}
```
Add `accountTagsOf(accounts): Map<string, {letter,id,nickname|null}>` as another projection of the given order. Use `Map`, not an object (`__proto__` root, T-09-04). Letter fn: bijective base-26 from 10-RESEARCH "Code Examples". Tags visible iff `accountCountOf(result) >= 2`.

---

### `src/lib/shell/IdentityHeader.svelte` (component) - modified

**Analog:** itself, multi variant:
```svelte
{#each rows as row, index (index)}
  <li class="multi-row" data-testid="identity-multi-row" ...>
    <h3 class="multi-name" class:id-only={row.idOnly} data-testid="identity-multi-name">{row.name}</h3>
```
Wrap `[AccountTag][h3]` in a flex row; keep index key (header comment: two accounts may share all fields). Legend phrase is `Account B` only (the visible text already shows ID/nickname; keeps "nickname once per row").

---

### `src/lib/shell/DashboardSection.svelte` (component) - modified

**Analog:** itself, line 122 and 162-164. Only copy changes via `formatCombinedCaption`:
```svelte
const combinedCaption = $derived(accountCount >= 2 ? formatCombinedCaption(accountCount) : null);
{#if combinedCaption !== null}<p class="combined" data-testid="combined-caption">
    {combinedCaption}
  </p>{/if}<span class="from">...
```
Note the load-bearing no-whitespace adjacency (comment ~line 158). Reuse for tag/hint/note nodes so single-account DOM stays byte-identical. In `ui-copy.ts` line 564-566 change body to `All ${count} accounts combined`; flip `tests/unit/shell/ui-copy.test.ts:2239-2243` and grep other tests for the old string.

---

### `src/lib/features/playtime/playtime-aggregate.ts` / `playtime-shared.ts` / `worker-messages.ts` / `ingest.worker.ts` / `playtime-state.ts` / `playtime-client.ts` (per-game aggregates)

**Analog:** the files themselves; exact line cites and the code sketch are in 10-RESEARCH Patterns 1 and 2 (rankAggregates 680-730, `SplitSession.game` 82-93, `MAX_SPLIT_VALUES` playtime-shared:80, `PLAYTIME_VERSION` :58, lazy rebuild ingest.worker:205-229, message types worker-messages:266-285 and :345, `derivePlaytimeState` playtime-state:121-125, `PlaytimeClient.query` :136).

**Validation precedent to copy** (trust boundary): `isDataQuery` in `src/lib/worker/data-queries.ts:218-236` - strict pure predicate, no throw. New `isGameToken(v)` = `null` or `/^[A-Z0-9_]{1,24}$/`; hostile value is treated as All / unknown, never echoed.

**Core delta:** wrap `rankAggregates` (do not change it): group `usable` and `excludedRows` by `game`, run it per group, cap at `MAX_SPLIT_VALUES`, store `games` and `byGame`. Make new type fields optional to limit test-literal ripple. Bump `PLAYTIME_VERSION` 2 to 3 and flip `ingest-worker.test.ts:2059-2066`.

**Main-thread:** `awaiting` becomes `requested.valueIndex !== shown.valueIndex || requested.game !== shown.game`; a chip click sends `valueIndex: null`.

---

### `src/lib/features/playtime/Playtime.svelte` (component) - modified

**Analog:** itself. Chip row goes after the status live region and storage notice, before `.selector-row` (line 364). Label style from:
```css
.selector-row { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.selector-row label { font-size: 14px; font-weight: 600; line-height: 1.4; color: var(--text); }
```
About disclosure analog (`PlaytimeCharts.svelte:201`):
```svelte
<AboutDisclosure name={ABOUT_NAME_HOUR_GRID} testId="about-hour-grid">
  <p class="caption" id={hintId}>{HOUR_GRID_KEYBOARD_HINT}</p>
</AboutDisclosure>
```
Import `AboutDisclosure from '../../charts/AboutDisclosure.svelte'`; use `name={ABOUT_NAME_PLAYTIME_TOTALS}`, `testId="about-playtime-totals"`; render only when filter row shown or accounts >= 2. No new `aria-live`.

---

### `src/lib/shell/GameFilter.svelte` (component) - NEW

**Analog:** none for radio chips (`grep type="radio"` finds none in `src`); use the UI-SPEC Surface 1 anatomy. Borrow label CSS from `.selector-row label` above and the focus ring from `select:focus-visible` in `Playtime.svelte` (line 535 onward). Chip is a `label` so it declares its own `min-height: 44px` (global 44px floor only reaches button/summary/a). No second `@media`; `phase8-ui-review-guards.test.ts` allows exactly one in `app.css`. Every `{#each}` here needs an `AUDITED` entry (see Shared Patterns).

---

### `src/lib/features/vehicles/PlayerStats.svelte` (component) - modified

**Analog:** itself.
```typescript
// first load (line ~230): const ask: VehicleAsk = { importedAt: wanted, title: null, battleType: null };
function onTitleChange(event: Event): void {
  const control = event.currentTarget as HTMLSelectElement;
  if (importedAt === null) return;
  const ask: VehicleAsk = { importedAt, title: control.value as VehicleTitleId, battleType: null };
  requested = ask;
  selection = freshSelection();
  resetKey += 1;
  void load(ask, true);
}
```
Change first ask to `title: filterToTitle(gameFilter)` (read prop inside `untrack`, effect still keyed on `importedAt`). In `onTitleChange` after `void load(...)` call `onGameFilterChange(titleToFilter(value))` only for wot/wotb/wows; `wowp` writes nothing. No worker change (memo key `${channel}:${JSON.stringify(query)}`, data-queries.ts:355-357).

---

### `src/lib/features/vehicles/vehicle-aggregate.ts` (service) - modified

**Analog:** itself (10-RESEARCH Pattern 5/6 cites). `mapRow` (897-928) is called inside loops over `AccountRowGroup` (`csv-columns.ts:44-49`, `account` = owning root); pass `group.account`, never a cell value. `buildSummary` (814-850): replace push-per-row with `Map<code,row>` fold, numeric cells add, keep the existing sort. `buildHeader` (943-962): sum numeric lifetime battles; expiry only when exactly one account contributed (D-20).

---

### `src/lib/features/vehicles/vehicle-model.ts` (utility) - modified

**Analog:** `filterRows` (230-236):
```typescript
return rows.filter((row) => row.id.toLowerCase().includes(needle));
```
Add optional `accountTextOf(row)` (letter + root) joined into the haystack. Hint line linked via `aria-describedby` using the existing `${selectId}-search` id pattern.

---

### `src/lib/features/vehicles/VehicleTable.svelte` / `LoginTable.svelte` (windowed tables) - modified

**Analog:** `LoginTable.svelte` sticky first cell (lines 160-166) and `cellView` snippet:
```svelte
<td class="{column.widthClass} sticky-first">
  <span class="ip" class:muted-cell={cell.muted}>
    {cell.text}
    {#if cell.hidden !== null}<span class="visually-hidden">{cell.hidden}</span>{/if}
  </span>
</td>
```
Prefix `<AccountTag>` inside the sticky first cell; first column geometry grows by +32px (Vehicles 160 to 192) only when N>=2, from the same geometry record that sets table min-width. Logins: one chip per account in `row.accounts` (D-18, nowrap, widen for two chips). Row heights unchanged (constant 40px for `windowRange`). Keep header chips outside the measured scroller (Pitfall 7).
`login-model.ts` `buildLoginRows` (414-432) maps `LoginAddress` to `LoginRow`: add `accounts`.

---

### `src/lib/features/logins/login-aggregate.ts` (service) - modified

**Analog:** itself, `counting` map keyed by canonical IP (273-285): add `accounts: Set<string>`, fill from `source.account`, emit sorted by code unit. Companion edits: `ingest.worker.ts` ~1030-1050 `loginSources.push(...)` must carry `account: resolved.root`; the rebuild reader's `AccountLoginSource` already has `account` (`db.ts:419-421, 685-699`); `LOGINS_VERSION` 2 to 3 (`login-shared.ts:30`). Do not split rows per account (breaks `ips`, city `placeOf`, `MAX_LOGIN_IPS`).

---

### `src/lib/features/finance/finance-aggregate.ts` + `SpendSummary.svelte`

**Analog (aggregate):** `buildSpend` group loop (841-930, comment "folding into the SAME cards"); `bigint` sums emitted via `toString()`. Add per-account `Map` accumulation inside the same branch as the headline `paid += 1` so definitions match (snippet in 10-RESEARCH "Spend per-account fold").

**Analog (UI):** `SpendSummary.svelte` 317-360, copy the whole disclosure shape:
```svelte
<details class="breakdown" data-testid="spend-breakdown">
  <summary>{SPEND_BREAKDOWN_DISCLOSURE}</summary>
  <div class="tables">
    <table>
      <caption>{SPEND_BY_YEAR}</caption>
      <thead><tr><th scope="col">{HEADER_YEAR}</th><th scope="col" class="numeric">{HEADER_PAID}</th>
        <th scope="col" class="numeric">{HEADER_TOTAL}</th></tr></thead>
      <tbody>
        {#each yearRows(card) as row, rowIndex (rowIndex)}
          <tr><td>{row.label}</td><td class="numeric">{row.paid}</td><td class="numeric">{row.total}</td></tr>
        {/each}
```
New: `<details data-testid="spend-per-account">`, summary `SPEND_PER_ACCOUNT_SUMMARY`, closed by default, rendered only N>=2, first cell = `AccountTag`. Index-keyed `{#each}`.

---

### `tests/fixtures/multi-account-fixtures.ts` (fixtures) - modified

**Analog:** same file. Key pieces:
```typescript
function assemble(specs: readonly RootSpec[], options: {prefix?; loose?; reverse?} = {}): Uint8Array { ... }   // 575, module-private
export function buildRealShapeThreeAccountExport(options = {}): Uint8Array {
  const loose: Record<string, string> = {};
  for (const name of MA_README_FILES) loose[name] = '%PDF-1.4\nsynthetic readme\n%%EOF\n';
  return assemble([RU_ROOT, EU_ROOT, NA_ROOT], { loose, reverse: options.reversed === true });
}
```
`SessionFileSpec` (303-310): `{ name: 'WOT_Game_Sessions.csv', rows: [['01.06.2012 19:00','01.06.2012 20:30']] }`, header `STARTED_AT;FINISHED_AT;IP`, `DD.MM.YYYY HH:MM`. `RootSpec.files` (`Folder/File.csv` -> text) is written after standard blocks and replaces same-name bodies, which is how the 54k `Financial_Data/Virtual_Currencies_Operations.csv` is injected per root. New builders live in this file (assemble is private). `buildOverlapTwoAccountExport()` uses the hand table in 10-RESEARCH ("Merge correctness"); expected literals: all 23,400 s / 9 sessions / 5 days; WOT 18,000 s / 6 / 4; WOTB 5,400 s / 2 / 2; WOWS 3,600 s / 1 / 1. `buildLargeThreeAccountExport()`: oldest account carries `generateCurrencyOpsCsv(CURRENCY_54K_SPEC)`, others 2,000 / 500 rows, different seeds. Synthetic only; never commit the real zip.

### `tests/fixtures/finance-fixtures.ts`
**Analog:** `CURRENCY_50K_SPEC` / `CURRENCY_10K_SPEC` (imported by `finance-scale.spec.ts`); add `CURRENCY_54K_SPEC` (`rows: 54_000`, reuse `SCALE_CODES`).

---

### `tests/unit/shell/game-filter-state.test.ts` (NEW)

**Analog:** `tests/unit/shell/selection-state.test.ts` (vitest `describe/expect/test`, named imports from `src/lib/shell/*.ts` with relative `../../../src/...` paths, DOM-free, helpers copied not shared: "test files do not import each other"). Cover visibility rule, token<->title, stamp reset on new `importedAt`.

### `tests/unit/playtime/playtime-multi-account.test.ts` (NEW)
**Analog:** playtime hand fixture + `tests/helpers/session-oracle.ts` (`oracleSlice`). Write answer-key literals in the test; cross-check with oracle; assert tie-order independence and account-order independence.

### `tests/unit/import/multi-account-scale.test.ts` (NEW)
**Analog:** `tests/unit/import/multi-account-import.test.ts` imports:
```typescript
import { installWorkerScope, loadWorker, ingestExport, importWorkerDb, postRequest, waitForMessage,
  deleteActiveDatabase } from '../../helpers/worker-harness.ts';
```
plus `oracleCurrency`, `row-groups.ts` `oneAccountEach`. Assert stored `byGame` keys, per-game `playtime-query`, vehicle row count = sum, `sum(countries.logins)+unknown.logins === totalLogins`, finance sums vs oracle, spend `byAccount` vs card totals; time the 54k `readRowsByFile` with a generous bound. `db.test.ts` keeps `verno` 2 (no Dexie bump).

### `tests/e2e/shell/multi-account-scale.spec.ts` (NEW)
**Analog:** `tests/e2e/finance/finance-scale.spec.ts`:
```typescript
import '../_support/pin-locale';
const READY_BUDGET_MS = 60_000;   const LONG_TASK_LIMIT_MS = 1_000;
test.describe.configure({ mode: 'serial' });
test.describe('...', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext(); page = await context.newPage();
    await installObserver(page);              // addInitScript PerformanceObserver 'longtask' (lines ~250-262)
    await gotoApp(page); await page.waitForLoadState('networkidle');
    importToReadyMs = await importAndAwaitReady(page, bytes);   // setInputFiles + awaitLanded + openSection + data-state ready
  });
```
Node counts via `page.evaluate(... querySelectorAll('*').length)` (lines 310-316), bounded by windows/buckets not rows. Zero-network from `tests/e2e/guards/zero-network.spec.ts:40-60`: `context.on('request', ...)`, `page.on('worker', ...)`, baseline after `data-worker-ready`, `networkidle`. Two listed tests (import+bounds, filter flow). Helpers from `tests/e2e/_support/helpers.ts` (`openSection`, `gotoApp`, `awaitLanded`). Filter/tag assertions on small fixtures go as extra steps in `multi-account.spec.ts` (not new listed tests); restate nickname rule (text only, never attribute) in `multi-account.spec.ts:273-286` and `identity-privacy.spec.ts:200-201`.

### CI budget
Edit together: `playwright.config.ts:196` (`globalTimeout` 30 to 31 min; append dated "Raised from" paragraph), `.github/workflows/ci.yml:103` (40 to 41), `:221` (`timeout 32m` to 33m and the present-tense sentence naming minutes), `tests/unit/guards/ci-budget.test.ts` pins (`toBe(1800/1920/2400)` to `1860/1980/2460`, ceiling `<= 262` raised, `projectedE2eSeconds` pin, new allowance constant).

## Shared Patterns

### Index-keyed `{#each}` and the audit table
**Source:** `src/lib/shell/IdentityHeader.svelte` (`{#each rows as row, index (index)}`), `SpendSummary.svelte` (`(rowIndex)`).
**Apply to:** GameFilter chips, tag lists, Payments per-account rows, Logins multi-chip cells.
Every new keyed block must be added to `AUDITED` in `tests/unit/import/multi-account-keys.test.ts` (~578-590) with `why` of `position | fixed-list | de-duplicated | per-group`, or the test fails.

### Account tag hidden on single-account, no whitespace node
**Source:** `DashboardSection.svelte:122, 162-164`; predicate `accountCountOf(result) >= 2` (`identity-model.ts`).
**Apply to:** AccountTag call sites, Vehicles search hint, finance note, Payments disclosure, caption.

### Untrusted text rendering
**Source:** `IdentityHeader.svelte` header comment: plain interpolation, "no markup-building directive, no tooltip, no `title`, no per-element accessible name". Nickname/ID only as text content (`.visually-hidden` span), never in an attribute (D-19).
**Apply to:** AccountTag, Payments disclosure, all tagged rows.

### Worker trust boundary
**Source:** `data-queries.ts:218-236` `isDataQuery`.
**Apply to:** `playtime-query.game` validation. Lookups keyed by root use `Map`.

### Lazy `v`-keyed aggregate rebuild, no Dexie bump
**Source:** `ingest.worker.ts:205-229` (`stored.v === PLAYTIME_VERSION` else rebuild from rows, `writePlaytimeIfCurrent`).
**Apply to:** `PLAYTIME_VERSION` 3, `LOGINS_VERSION` 3. Import-time and rebuild paths must agree (test both).

### Layout/CSS guards
One `@media (max-width: 480px)` in `src/app.css` only; no inline styles, no new colours, no `aria-live`, no transition. 44px on any new non-button/summary/a control.

### Pinned tests that flip on purpose
`ingest-worker.test.ts:2059` (PLAYTIME_VERSION), `ui-copy.test.ts:2239-2243`, `multi-account-keys.test.ts` AUDITED, `ci-budget.test.ts` pins, `multi-account.spec.ts:273-286`, `identity-privacy.spec.ts:200-201`, `phase8-shell-guards.test.ts` (must keep passing).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/shell/GameFilter.svelte` (radio chip markup/CSS) | component | event-driven | No radio-input chip row in `src`; follow UI-SPEC Surface 1, borrowing label/focus CSS from `Playtime.svelte` |

## Open items for the planner (from RESEARCH, now partly resolved by CONTEXT)
- D-07 amended: keep v1.0 counting (sessions = usable rows); no change to `aggregateSlice` unit.
- D-18/D-19/D-20/D-21 recorded in CONTEXT; UI-SPEC first-column width for two login chips needs the amendment noted in D-18.

## Metadata

**Analog search scope:** `src/lib/shell`, `src/lib/features/{playtime,vehicles,logins,finance}`, `src/lib/worker`, `tests/fixtures`, `tests/unit/{shell,import,guards}`, `tests/e2e/{finance,shell,guards}`
**Files scanned:** ~35 read or grepped (plus 10-RESEARCH verified cites)
**Pattern extraction date:** 2026-10-18
