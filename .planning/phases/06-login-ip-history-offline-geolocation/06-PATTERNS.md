# Phase 6: Login-IP History & Offline Geolocation - Pattern Map

**Mapped:** 2026-10-03
**Files analyzed:** 33 new/modified
**Analogs found:** 29 / 33 (all analog paths verified git-tracked via `git ls-files`)

Line numbers are from the working tree on branch `gsd/phase-06-login-ip-history-offline-geolocation`. Planner: prefer these real analogs over RESEARCH.md code examples. Open decisions 1-4 in 06-RESEARCH.md (geo source, fixture seam, city fetch location/CSP, no Dexie bump) still gate the plan; this map is written for the recommended defaults.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/lib/features/logins/login-shared.ts` | shared types/consts | transform | `src/lib/features/playtime/playtime-shared.ts` | exact |
| `src/lib/features/logins/login-aggregate.ts` | service (pure aggregator) | batch/transform | `src/lib/features/playtime/playtime-aggregate.ts` (`SessionSource`, `buildPlaytimeFromSources`) | exact |
| `src/lib/features/logins/login-model.ts` | utility (pure view model) | transform | `src/lib/features/vehicles/vehicle-model.ts` | role-match |
| `src/lib/features/logins/login-state.ts` | utility (state derivation) | request-response | `src/lib/features/playtime/playtime-state.ts` | exact |
| `src/lib/features/logins/login-client.ts` (query client, if dedicated pair) | service | request-response | `src/lib/features/playtime/playtime-client.ts` | exact |
| `src/lib/features/logins/LoginHistory.svelte` | component (block) | request-response | `src/lib/features/playtime/Playtime.svelte` | exact |
| `src/lib/features/logins/LoginSummary.svelte` (tiles) | component | transform | `src/lib/features/playtime/PlaytimeSummary.svelte` | role-match |
| `src/lib/features/logins/LoginTable.svelte` | component | windowed render | `src/lib/features/vehicles/VehicleTable.svelte` | exact |
| `src/lib/features/logins/WorldMap.svelte` | component | transform | `src/lib/features/playtime/CalendarHeatmap.svelte` (level-N classes, tooltip) | role-match |
| `src/lib/features/logins/CountryList.svelte` | component | transform | `src/lib/features/playtime/DurationList.svelte` | role-match |
| `src/lib/features/logins/CityOptIn.svelte` | component | event-driven | `src/lib/shell/ConfirmPanel.svelte` / `Dropzone.svelte` (button + progress/cancel) | partial |
| `src/lib/shell/LoginHistorySection.svelte` (modify: placeholder to real) | component | request-response | itself + `Playtime.svelte` (h3 style must stay value-for-value) | exact |
| `src/lib/shell/Dashboard.svelte` (modify, line ~86) | component | request-response | itself | exact |
| `src/lib/geo/ip.ts` | utility (pure parse/mask) | transform | `src/lib/worker/identity.ts` (anchored regexes, never-throw sanitiser) | role-match |
| `src/lib/geo/range-table.ts` | utility (pure binary container + lookup) | transform | none (RESEARCH Pattern 1); style: `src/lib/core/decimal.ts` pure module | no analog |
| `src/lib/geo/country-table.ts` (worker-only decode, `?inline`) | utility | transform | none | no analog |
| `src/lib/geo/country-names.ts` | utility | transform | `src/lib/ui-copy.ts` formatters | partial |
| `src/lib/geo/city-fetch.ts` (the ONE fetch) | service | streaming | none (only exempt `fetch` in repo) | no analog |
| `src/lib/geo/world-map.generated.ts` | generated config | build-time | none | no analog |
| `scripts/geo/build-country-table.ts`, `build-world-map.ts`, `build-city-dataset.ts` | build scripts | batch/file-I/O | `vite.config.ts` (Node-side TS config) | partial |
| `src/lib/worker/ingest.worker.ts` (modify: collect login sources, `handleLoginsQuery`, city messages) | worker handler | request-response | `handlePlaytimeQuery` in same file | exact |
| `src/lib/worker/data-queries.ts` (modify: channel `logins` branch, `isDataQuery`) | service | request-response | itself (`DATA_FILES`, `isDataQuery`, `answerDataQuery`) | exact |
| `src/lib/worker/db.ts` (modify: `meta.logins` field, `writeLoginsIfCurrent`, reader generalisation) | model/persistence | CRUD | `writePlaytimeIfCurrent`, `readSessionRowData` | exact |
| `src/lib/worker/identity.ts` (modify: Account-record IP/country/city sibling of `pick`) | utility | transform | itself | exact |
| `src/lib/core/types/worker-messages.ts` (modify) | model (contract) | request-response | itself (`DataQuery`/`DataResult`, `playtime-*`) | exact |
| `src/lib/ui-copy.ts` (modify: login copy, `LOGIN_HISTORY_HEADING` exists) | config/copy | n/a | itself | exact |
| `src/lib/features/vehicles/vehicle-model.ts` -> shared windowing module (hoist `windowRange`, `ROW_PX`, `OVERSCAN_ROWS`, `SCROLLER_MAX_PX`; re-export) | utility | transform | itself | exact |
| `eslint.config.js` (modify: scoped fetch exemption) | config | n/a | block 7 lines 127-170 | exact |
| `tests/unit/guards/lint-guards.test.ts` (extend probes) | test | n/a | itself | exact |
| `vite.config.ts`, `vitest.config.ts`, `tsconfig.node.json`, `playwright.config.ts` (modify: alias, `assetsInclude`, `GEO_FIXTURE`, scripts include) | config | n/a | themselves | exact |
| `tests/fixtures/logins-fixtures.ts`, `tests/helpers/login-oracle.ts` | test fixture/oracle | transform | `tests/fixtures/sessions-fixtures.ts`, `tests/helpers/session-oracle.ts` | exact |
| `tests/e2e/logins/*.spec.ts`; `tests/e2e/guards/zero-network.spec.ts` (modify line ~83 CSP assert) | test | e2e | `tests/e2e/playtime/playtime-scale.spec.ts`, `tests/e2e/guards/zero-network.spec.ts` | exact |

## Pattern Assignments

### `login-shared.ts` (shared types, versioned constant)

**Analog:** `src/lib/features/playtime/playtime-shared.ts`. Pure, no imports, imported from both sides of `postMessage` (lines 1-9).

**Version constant + rationale comment pattern** (lines 43-58):
```typescript
export const PLAYTIME_VERSION = 2;
```
Copy as `export const LOGINS_VERSION = 1;` with a comment that records what changes meaning. Also add `MAX_LOGIN_IPS = 20_000`, modelled on the cap constant (lines 75-80):
```typescript
export const MAX_SPLIT_VALUES = 50;
```
The geo table id/month goes next to the version so a table swap triggers rebuild (RESEARCH Pattern 3).

---

### `login-aggregate.ts` (pure aggregator, SEPARATE from playtime)

**Analog:** `src/lib/features/playtime/playtime-aggregate.ts`. Do NOT edit that file: its "IP column never read" guarantee (T-04-01) is asserted by `tests/unit/playtime/` tests.

**Reuse these exports, do not reimplement:** `SessionRow` (l.67), `parseSessionTimestamp` (l.155), `sessionFileGame` (l.259), `isSessionsRow` (l.276), `resolveSessionColumns` (l.312), `SessionSource` (l.575-580):
```typescript
export interface SessionSource {
  game: SessionGame;          // string | null
  rows: readonly SessionRow[];
}
```
Column resolution is explicit (no generic row helper): resolve the IP column and time column from the first row's keys, as `resolveSessionColumns` does; time column candidates `STARTED_AT`, `SESSION_START`, `LOGIN_DT`.

**Collection point at import** (`src/lib/worker/ingest.worker.ts` lines 503-522): the same loop that builds `sessionSources` should push the same `rows` array into a second collection `loginSources`, plus a `Logins.csv` branch (not matched by `isSessions`):
```typescript
const game = sessionFileGame(entry.name, resolved.sourceFile);
const isSessions = game !== null || isSessionsRow(entry.name, resolved.sourceFile);
const rows: SessionRow[] = [];
const source: SessionSource = { game, rows };
if (isSessions) {
  sessionsFileSeen = true;
  sessionSources.push(source);
}
```
Aggregation call site mirrors line 585: `playtime = buildPlaytimeFromSources(sessionSources, sessionsFileSeen);` so add `logins = buildLogins(loginSources, lookupCountry)` right after, with the lookup injected (pure function taking the table as an argument, RESEARCH Pattern 1 / Decision 2).

---

### `login-state.ts` and `LoginHistory.svelte` (block state + wiring)

**Analog:** `src/lib/features/playtime/playtime-state.ts` and `Playtime.svelte`.

**Key discipline to copy** (playtime-state.ts lines 25-45, 108-120): `importedAt` is dataset identity; a `shown` answer stamped with another `importedAt` is "no answer" (state `loading`); `acceptOutcome` drops superseded / wrong-dataset / view-less results and stamps with the ASK.
```typescript
export function derivePlaytimeState({ importedAt, shown, requested }: PlaytimeStateInput): PlaytimeState {
  if (importedAt === null) return 'loading';
  if (shown === null || shown.importedAt !== importedAt) return 'loading';
  if (shown.kind === 'failed') return 'error';
  ...
```
Mask state (D-07) is one `$state` boolean that resets when `importedAt` changes (same key as above); the same pure-function-plus-thin-component split applies so Vitest (no DOM) can test it. Types for a three-variant outcome (`result | error | superseded`) come from `playtime-client.ts` lines 22-33.

---

### `login-client.ts` / worker contract for the `logins` channel

**Analogs:** `src/lib/features/playtime/playtime-client.ts` (queryId namespace, resolver map, injected `post` and availability, never rejects) and `src/lib/core/types/worker-messages.ts`.

**Two integration options (RESEARCH Pattern 4):**
- Extend `DataQuery`/`DataResult` (`worker-messages.ts` lines 222-236):
```typescript
export type DataQuery =
  | { channel: 'vehicles'; title: VehicleTitleId | null; battleType: string | null }
  | { channel: 'premium' } | { channel: 'currency' } | { channel: 'spend' };
```
  then add `| { channel: 'logins' }`. Required knock-ons in `data-queries.ts`: `DATA_FILES` is `Record<DataQuery['channel'], ChannelFiles>` (line 69), narrow to `Exclude<..., 'logins'>`; `DATA_CHANNELS` (line 141) derives from `Object.keys(DATA_FILES)`, so add `'logins'` explicitly; `isDataQuery` (lines 166-184) rejects stray fields for non-vehicle channels, which already suits a field-less `logins` query. The logins branch must run BEFORE `readRowsByFile`.
- OR a dedicated `login-query`/`login-result`/`login-error` triple modelled on `playtime-query` (`worker-messages.ts` lines 251, 271-278) and `playtime-client.ts`. Less coupling to the `DATA_FILES` table.

Keep the aggregate off `ClassifyResult`; echo `importedAt`; error detail fixed string (do not copy `${e.name}: ${e.message}` from `ingest.worker.ts` line 192 for this channel, per RESEARCH Pattern 4).

---

### `ingest.worker.ts` `handleLoginsQuery` (worker handler, meta-first with lazy backfill)

**Analog:** `handlePlaytimeQuery`, `src/lib/worker/ingest.worker.ts` lines 141-195 (copy structure exactly):
```typescript
const meta = await checkCache();
if (meta === null) { /* postMessage result {importedAt: null, view: null} */ return; }
const stored = meta.playtime;
if (stored != null && stored.v === PLAYTIME_VERSION) { /* answer from meta */ return; }
const snapshot = await readSessionRowData();
if (snapshot === null) { /* same as nothing imported */ return; }
const rebuilt = buildPlaytimeFromSources(snapshot.sources, snapshot.sources.length > 0);
await writePlaytimeIfCurrent(snapshot.importedAt, rebuilt);
```
Substitutions: `meta.logins`, `LOGINS_VERSION` + geo table id compare, a generalised reader (see db.ts below), `writeLoginsIfCurrent`. Answer with the SNAPSHOT's `importedAt`, not the `checkCache` one (comment lines 124-128).

---

### `db.ts` (meta field + guarded write + reader)

**Analog:** `writePlaytimeIfCurrent`, `src/lib/worker/db.ts` lines 464-474:
```typescript
export async function writePlaytimeIfCurrent(importedAt: string, playtime: PlaytimeAggregates): Promise<boolean> {
  return db.transaction('rw', db.meta, async () => {
    const current = await db.meta.get('active');
    if (current === undefined || current.importedAt !== importedAt) return false;
    await db.meta.update('active', { playtime });
    return true;
  });
}
```
Copy as `writeLoginsIfCurrent` updating only `{ logins }`. Add an optional `logins?` property to `DatasetMeta` (interface at line 65; `playtime` is declared the same way, see comments at lines ~93 and ~113). **No `version(3)`**: the `version(2)` block (line 166) is a wiping upgrader and must stay untouched (db.ts rule at line ~152). `clearData` (lines 494-498) deletes `meta 'active'`, so a field on that record is wiped for free.

**Pitfall to copy around:** `readSessionRowData` (line 296) screens by `isSessionFileName`, so it skips `Logins.csv`; add a sibling reader or widen the predicate and test rebuild-equals-import.

---

### `LoginTable.svelte` (windowed sortable native table)

**Analog:** `src/lib/features/vehicles/VehicleTable.svelte` (603 lines; read fully above). Copy:

**Imports/props shape** (lines 2-5, 40-70): `windowRange`, `SCROLLER_MAX_PX` from the (hoisted) windowing module; props `columns/rows/sort/onSort/regionName/resetKey/updating`; the rows come pre-sorted from the block.

**Core windowing** (lines 93-101):
```typescript
const drawnRange = $derived(windowRange(scrollTop, viewportPx, rows.length));
const drawn = $derived(rows.slice(drawnRange.first, drawnRange.last).map((row, offset) => ({ row, index: drawnRange.first + offset })));
```
Never name the derived `window` (lines 82-92).

**CSSOM geometry (CSP-safe, no inline styles)** (lines 236-243): read derived values into locals FIRST, then write `element.style.height`:
```typescript
$effect(() => {
  const padTop = drawnRange.padTopPx; const padBottom = drawnRange.padBottomPx; const minWidth = minWidthPx;
  if (topSpacerEl !== null) topSpacerEl.style.height = `${padTop}px`;
  ...
```
**Scroll/resize/reset** (lines 190-217, 256-261): rAF-coalesced passive scroll; `resetKey` effect zeroes `scrollTop`.

**Markup** (lines 277-327): `role="region" tabindex="0"` with the `svelte-ignore a11y_no_noninteractive_tabindex` comment, `aria-rowcount={rows.length + 1}`, `aria-sort` on `<th>`, two `aria-hidden` spacer rows, `data-testid` hooks. Phase 6 additions: the IP cell renders `maskIp(canonical)` unless revealed; never put the full IP in `title`/`aria-label`/`data-*` (RESEARCH Pitfall 15). Row key must not be the full IP when masked if it lands in the DOM as an attribute; use the row index id.

**Hoist:** `ROW_PX=40` (vehicle-model.ts line 45), `OVERSCAN_ROWS=6` (54), `SCROLLER_MAX_PX=480` (63), `windowRange` (310) move to a shared module and are re-exported from `vehicle-model.ts` so existing vehicle tests stay green.

---

### `WorldMap.svelte`, `CountryList.svelte`, tooltip

**Analog:** `src/lib/features/playtime/CalendarHeatmap.svelte` for the level-N pattern and `ChartTooltip` hookup.

**Level classes from the shared ramp** (CalendarHeatmap line 539 and 803-810):
```svelte
class="cell level-{cell.level}"
```
```css
.level-0 { fill: var(--ramp-0); }
.level-1 { fill: var(--ramp-1); }
```
Tokens `--ramp-0..5` are declared once in `src/app.css` lines 31-36 (`#eef0f2` through `#0d4f4c`); never restate hex. Pin contrast pairs in the style of `tests/unit/charts/contrast.test.ts` + `tests/helpers/contrast.ts`.

**Tooltip:** `src/lib/charts/ChartTooltip.svelte` props (lines 34-46): `request: TooltipRequest | null`, `anchor?`, `onDismiss`, `testId?`. It writes left/top through the CSSOM and is `aria-hidden` (each focusable country carries its own accessible name). Mask any IP shown in tooltip text. Use `ChartLegend.svelte` for the log-scale legend; state bin edges as text.

**Aggregate-per-country only**: one `<path>` per country from `world-map.generated.ts`; log level function per RESEARCH Pattern 5 (`1 + min(4, floor(4*ln(count)/ln(max)))`), put it in `login-model.ts` as a pure function with unit tests.

---

### `login-model.ts` (pure sort/tiles/ranked lists)

**Analog:** `src/lib/features/vehicles/vehicle-model.ts` (sort comparators `SortState`, `sortRows`; imports of `windowRange` live here today) and `src/lib/charts/bar-chart-model.ts` for pure chart-model style. Keep every decision pure and DOM-free so it runs under Vitest's Node environment.

---

### `src/lib/geo/ip.ts` (parse / canonicalise / mask, never throws)

**Analog (style only):** `src/lib/worker/identity.ts`: anchored regex with no nested quantifiers, normalise-then-match, and "never echo untrusted text".
```typescript
const DROPPED_COLUMN = /^(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)(_\d+)?$/;
```
Plus the Account record (D-02): add a sibling to the private `pick` in `identity.ts` that reads `IP`, `COUNTRY_CODE`, `CITY` from the already-sanitised row (note `LOGIN`, `BIRTH_DATE` are dropped at write time per D-18; the new sibling must not widen that). The identity header remains 3 fields.

---

### `eslint.config.js` + `lint-guards.test.ts` (one scoped `fetch` exemption)

**Analog:** `eslint.config.js` lines 127-170: block 7 for `src/**/*.ts|svelte` lists `no-restricted-globals` (fetch, fetchLater, XMLHttpRequest, WebSocket, WebTransport, EventSource, RTCPeerConnection, importScripts) and `no-restricted-properties` (window/self/globalThis `.fetch` etc.).
Add a later override scoped to exactly `src/lib/geo/city-fetch.ts` that re-declares BOTH rule option lists minus `fetch` (an override replaces, it does not merge). Also remove `window.fetch`/`self.fetch`/`globalThis.fetch` ban only if needed; prefer the bare `fetch` call.

**Probe pattern** (`tests/unit/guards/lint-guards.test.ts` lines 1-40): `new ESLint` Node API with `filePath` containing `__lint_probe__`, asserting rule ids from `GUARD_RULE_IDS`. Add probes: `fetch` fires in `src/lib/__lint_probe__.ts` and in a worker path, does not fire in the exempt path, `XMLHttpRequest`/`WebSocket` still fire in it; plus a source-scan test that `fetch(` appears in exactly one `src/` file.

---

### Tests: fixtures, oracle, e2e

- `tests/fixtures/logins-fixtures.ts` follows `tests/fixtures/sessions-fixtures.ts` (seeded `mulberry32` PRNG exported from there; real-shaped `*_Game_Sessions.csv` text) and `tests/fixtures/playtime-real-shape-fixture.ts`. Use RFC 5737/3849 ranges only.
- `tests/helpers/login-oracle.ts` follows `tests/helpers/session-oracle.ts` header contract: recompute naively, **import nothing from the implementation** (only the PRNG).
- E2E request accounting: `tests/e2e/guards/zero-network.spec.ts` lines 60-70 (baseline vs post-submit count) and lines 73-83 (CSP asserts; line 83 `connect-src 'none'` changes only if Decision 3 picks Option A). CSP-violation collector via `page.addInitScript` (lines ~86-99) must remain. Scale spec: copy `tests/e2e/playtime/playtime-scale.spec.ts` shape. Raise `ci-budget` constants together (`tests/unit/guards/ci-budget.test.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`).

---

### `LoginHistorySection.svelte` and `Dashboard.svelte` (modify)

`Dashboard.svelte` line 85-86 mounts `<Playtime {result} client={ingestClient.playtime} />` then `<LoginHistorySection />` inside the `activity-history` section. The placeholder (lines 1-63 above) takes no props by design and its comment says a later plan must widen the signature. Keep: `LOGIN_HISTORY_HEADING` constant from `ui-copy.ts` and the `h3` rule value-for-value with `Playtime.svelte`:
```css
h3 { margin: 0; padding-bottom: 8px; border-bottom: 1px solid #dadce0; font-size: 14px; font-weight: 600; line-height: 1.4; color: #08060d; }
```
Replace `data-testid="login-history-placeholder"` consumers (the `(sections-pending)` e2e asserts the pending note per section) in the same plan.

---

## Shared Patterns

### Worker-owned data, versioned aggregate on `meta`, lazy backfill
**Source:** `src/lib/worker/ingest.worker.ts` 141-195; `src/lib/worker/db.ts` 464-474.
**Apply to:** `login-aggregate`, `handleLoginsQuery`, `db.ts` additions. The main thread never scans raw rows or loads the range table.

### Dataset-identity stamping (`importedAt`)
**Source:** `src/lib/features/playtime/playtime-state.ts` 25-45, 108-120.
**Apply to:** `login-state.ts`, mask reset, city view reset.

### CSP-safe styling (no inline styles, geometry via CSSOM)
**Source:** `VehicleTable.svelte` 17-24, 236-243; `ChartTooltip.svelte` header comment; ESLint `svelte/no-inline-styles` (`eslint.config.js` lines ~163-167).
**Apply to:** `LoginTable`, `WorldMap`, `CityOptIn` progress bar.

### Palette tokens
**Source:** `src/app.css` lines 31-36. **Apply to:** `WorldMap`, legend, contrast tests.

### Network-ban lint + zero-request e2e
**Source:** `eslint.config.js` 127-170; `zero-network.spec.ts`. **Apply to:** every new `src/` file; only `src/lib/geo/city-fetch.ts` may fetch.

### Fixed-string errors, no dataset text on screen
**Source:** `identity.ts` header (sanitise/never echo); RESEARCH Pattern 2 ("Unrecognised address" bucket). **Apply to:** `ip.ts`, worker error details, all tooltips/attributes (masked IP only).

### Pure modules importable from both sides of `postMessage`
**Source:** `playtime-shared.ts` header lines 1-9. **Apply to:** `login-shared.ts`, `range-table.ts`, `ip.ts`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/geo/range-table.ts` | utility | binary encode/decode + lookup | No binary container or typed-array code exists; use RESEARCH Pattern 1 |
| `src/lib/geo/country-table.ts` | utility | transform | No `?inline` asset import exists; needs `assetsInclude: ['**/*.bin']` and alias in both `vite.config.ts` and `vitest.config.ts` (RESEARCH Pattern 8) |
| `src/lib/geo/city-fetch.ts` | service | streaming | The repo bans `fetch` everywhere; this is the first and only exemption (RESEARCH Pattern 7) |
| `src/lib/geo/world-map.generated.ts`, `scripts/geo/*` | generated / build | batch | No `scripts/` directory or generator exists. Only `vite.config.ts` is Node-side TS (`tsconfig.node.json` `include` is just `["vite.config.ts"]`; add `scripts/**`); scripts run as native Node `.ts` with explicit `.ts` import extensions and `erasableSyntaxOnly` |
| `CityOptIn.svelte` | component | event-driven (download progress/cancel) | No download/progress/cancel component; nearest UI-state analogs are `ConfirmPanel.svelte`/`FailureBanner.svelte` for button and error text; state machine from RESEARCH Pattern 7 |

## Metadata

**Analog search scope:** `src/lib/{features,worker,core,shell,charts}`, `tests/{unit,e2e,fixtures,helpers}`, `eslint.config.js`, `vitest.config.ts`, `tsconfig.node.json`, `.gitignore` (already ignores `**/geo-city-data/`, line 38).
**Files scanned:** ~120 tracked files listed, 14 read (several in part).
**Pattern extraction date:** 2026-10-03
**Not read:** RESEARCH.md lines 443-758 (validation architecture) and UI-SPEC.md body beyond its section index; planner should consult those for copy strings and test-map details.
