# Phase 10: Merged Dashboard Across Accounts - Research

**Researched:** 2026-10-18
**Domain:** Svelte 5 + Web Worker + Dexie, pure aggregation changes over an already multi-account store (no new dependencies)
**Confidence:** HIGH for code paths, contracts and CI arithmetic (all read this session); MEDIUM for scale estimates and the CI allowance (reasoned from recorded measurements, not re-run); ONE decision (sessions count, Open Question 1) needs the user before the playtime plan is final.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Game filter
- **D-01:** One shared game filter for Playtime and Vehicles. Choices: All games, WoT, WoTB, WoWS. State is shell-level component state (no route, no storage), shared by both panes, session-only: reset on reload and on a new import. — **Reversibility:** reversible — **Reversibility rationale:** component state and a chip row; no storage or schema.
- **D-02:** The filter renders as the same chip row inside each pane's header (not in the master/list column), so it does not appear on panes it does not affect (Finance, Logins, Device info).
- **D-03:** On Playtime the filter narrows everything: tiles, calendar heatmap, weekday-by-hour grid, session durations. "All games" keeps the existing `GAME` split view. One game shows that game's own totals. The filter does not replace the `GAME` splitter.
- **D-04:** On Vehicles the shared filter drives the existing WoT / WoTB / WoWS title switcher (no second widget). Vehicles has no "All games" view because stat shapes differ per title: with the filter on All, Vehicles falls back to the existing worker rule (first title that has rows, else WoT); changing the title on Vehicles sets the shared filter.
- **D-05:** Only WoT, WoTB and WoWS are filter choices in Phase 10. HEAT and WOTC sessions count in "All games" only. Build the choice list from the game tokens present in the data so Phase 11 extends it without rework. — **Reversibility:** reversible — **Reversibility rationale:** a list of tokens; Phase 11 adds entries.

### Overlap and double-counting
- **D-06:** Overlap is merged globally across accounts and games: wall-clock time is counted once. Hours are the union of intervals. Under a game filter, only that game's intervals are unioned, so "All" total hours can be less than the sum of per-game totals; this is expected and should be explained in the pane's about text.
- **D-07:** Sessions and active days count merged intervals: a merged interval is one session; active days are distinct civil days of merged intervals. Tiles stay consistent with hours and the durations list.
- **D-08:** No change to the v1.0 merge rules. Reuse the existing merge, and prove it with a hand-computed two-account fixture (overlapping, touching and disjoint sessions) whose expected hours, sessions and active days are written in the test. Planner/research checks the merge is correct when sessions arrive from different accounts (same-start ties, ordering independent of account order).

### Rows, source account, vehicles
- **D-09:** Vehicles with the same id in two accounts stay as two rows, one per account. "Combines the accounts' stats" is delivered by combined tiles and summaries (battle-type summary sums per code across accounts), not by collapsing vehicle rows. The Phase 9 index-keyed `{#each}` blocks stay index-keyed.
- **D-10:** Every listed row (vehicles, logins, payments) shows a short account tag chip: a letter A / B / C assigned in identity-header order (first activity ascending, the Phase 9 D-16 order). The header rows show their letter as the legend. The row detail / accessible name exposes the full account ID and nickname. Tags are hidden entirely on a single-account dataset. Chip must keep the 44px touch floor and the 480px phone block.
- **D-11:** Account is searchable text only: the existing search matches the tag and account ID. No sort-by-account, no account picker, no new session table. Aggregated Playtime buckets stay aggregates.
- **D-12:** The Phase 9 caption is kept and reworded "All N accounts combined"-style (exact copy is Claude's discretion). Hidden for one account.

### Logins and finance
- **D-13:** Logins: one table and one country map across accounts. No per-account record card (the identity header already lists accounts). Each login row carries the account tag. IPs stay masked until the single global reveal; city-level detail stays an explicit opt-in that fetches nothing until asked. Country list counts cover all accounts.
- **D-14:** Finance and Payments: same-currency amounts sum across accounts (exact decimal), never converted or blended. Payments rows carry the account tag; any per-account split of a total lives in detail only, not as extra headline figures.
- **D-15:** Overview card keeps its Phase 9 shape (headline "N accounts"); no combined totals added there.

### Storage and scale
- **D-16:** Stay with the non-indexed `account` field and in-memory filtering, no Dexie bump (Phase 9 D-07). Research may recommend an indexed key plus lossless upgrader only if the large fixture measures a freeze. — **Reversibility:** costly — **Reversibility rationale:** an indexed key needs a `version(3)` Dexie bump and a lossless upgrader; the pinned `db.test.ts` version test encodes version 2.
- **D-17:** SCALE-01 proof: a generated synthetic three-account fixture including a 54,000-row `Virtual_Currencies` file. Unit tests assert aggregation outputs; one browser e2e imports it and asserts rendered DOM node counts stay bounded by buckets or windows (not rows), a generous import-to-first-render time cap, and zero network requests through the merged flows. e2e budget is at 258 of 262 ceiling after Phase 9; new specs must raise or reconcile the three CI limits together.

### Claude's Discretion
- Exact visual treatment of the filter chip row and the account tag chip within the Day 10 master-detail shell and sketch findings.
- Exact caption and about-text wording (including the "All total can be smaller than the sum of games" explanation).
- Fixture design details and node-count thresholds.
- Where the shared filter state lives in the shell (`selection-state.ts` vs a sibling module).

### Deferred Ideas (OUT OF SCOPE)
- Per-account summary cards on Logins and a per-account picker: rejected for v1.1 (merge-only).
- Combined headline totals on the Overview card.
- Sort-by-account control.
- HEAT / WOTC filter choices and panes: Phase 11.
- Cross-account duplicate account-level files (Subscriptions, External_Services_History, Language_And_Country_History): Phase 12.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACCOUNT-04 | The dashboard shows all accounts merged: combined playtime and activity, combined finance totals (per currency, never blended), combined vehicle stats | Finance/Payments already fold per currency across accounts (verified below); Playtime merge is already global; Vehicles needs summed battle-type summary and a combined header rule (Open Question 2); Payments needs a per-account detail split |
| ACCOUNT-06 | A game filter on merged playtime and vehicles separates WoT, WoTB and WoWS; overlapping sessions across accounts are not double-counted, and each row stays traceable to its account | Stored per-game aggregates (Pattern 1) + `playtime-query` `game` field; Vehicles filter = existing `title` ask (no worker change); `account` on VehicleRow and on LoginAddress; AccountTag letters from `result.accounts` order |
| ACCOUNT-07 | Login-IP history merges across accounts, with masking and the city opt-in unchanged | Logins are already one aggregate over all accounts; `LoginAddress` gains `accounts`, nothing else moves (city `placeOf` alignment, caps and country rollups untouched) |
| SCALE-01 | All new panes aggregate or virtualize; the 54k-row Virtual_Currencies file is checked against a synthetic large export | `generateCurrencyOpsCsv` + `oracleCurrency` + `RootSpec.files` override give the fixture; a 50,000-row single-account import was measured at 1,414 ms; CI limits move 30/32/40 -> 31/33/41 |
</phase_requirements>

## Summary

Phase 9 already did the structural work: every stored row carries `account`, every reader groups by account, `result.accounts` is published in D-16 order, and Finance, Payments, Device info, Logins and Playtime already fold ALL accounts into one aggregate. Phase 10 therefore adds four things on top of a store that does not change: (1) a per-game slice of the Playtime aggregate and a `game` field on `playtime-query`, (2) an `account` field on the three row kinds the user can read one by one (vehicle rows, login addresses, a Payments per-account detail) plus main-thread tag letters, (3) summed Vehicles summaries and a combined Vehicles header, and (4) the large three-account fixture, its unit and e2e proof, and the CI limit raise. No Dexie change is needed or useful: no reader queries by account (they walk the `sourceFile` and `category` indexes and filter in memory), so an account index would not make any read cheaper (D-16 stands).

The game filter reaches Playtime by storing a complete per-game aggregate beside the all-games one, built by the same `rankAggregates` code at import and in the lazy rebuild, and selecting it by a new optional `game` on the existing `playtime-query`. It reaches Vehicles with NO worker change: the Vehicles ask already carries `title: VehicleTitleId | null`, and the filter token maps to it (`WOT` to `wot`, `All` to `null`, which is the existing "first title with rows, else WoT" rule). Shared filter state lives in `Dashboard.svelte` as a dataset-stamped choice (the exact pattern of `choice`/`viewChoice`), because exactly one pane is mounted at a time and the filter must survive a pane switch but not a new import.

The merge itself is correct for cross-account input and needs no change: the sweep sorts by start and tracks a covered-until marker, and I checked that every credited second, day, hour cell and bin is independent of the order of tied or interleaved sessions. **One real conflict needs a user decision before the playtime plan is final:** D-07 says "sessions ... count merged intervals" while D-08 says "no change to the v1.0 merge rules", and v1.0 counts every usable session (`sessions: usable.length`), including ones fully contained in another (Open Question 1). The recommendation is to keep v1.0 counting (D-08) and reword D-07's intent as "the tiles come from the same merge".

**Primary recommendation:** Store per-game `PlaytimeAggregates` (`byGame`, `games`, PLAYTIME_VERSION 3), add `game` to `playtime-query`, add `account` to `VehicleRow` and `accounts` to `LoginAddress` (LOGINS_VERSION 3), derive tag letters from `result.accounts`, keep the filter in a dataset-stamped Dashboard cell, and plan the CI raise to 31/33/41 up front.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-game playtime aggregates (hours, days, grids, bins) | Worker (`playtime-aggregate.ts`, built at import and in lazy rebuild) | Dexie meta (stored aggregate) | Dexie and rows are worker-only; main thread receives derived, PII-free views |
| Selecting a game slice | Worker (`handlePlaytimeQuery`) | Main thread (sends token) | The stored aggregate lives behind the worker; the token is validated at the trust boundary |
| Shared game filter value | Browser (`Dashboard.svelte` cell + pure module) | - | Component state only (D-01); survives pane switches, resets on a new `importedAt` |
| Filter chip row, tag chip, captions | Browser (Svelte components + `ui-copy.ts`) | - | Presentation only |
| Vehicles title selection from the filter | Browser maps token to `title`; worker applies it | Worker fallback `pickTitle` | Existing `vehicles` ask already carries `title` |
| Battle-type summary summing, Vehicles header combine | Worker (`vehicle-aggregate.ts`) | - | Rows are read and grouped per account only in the worker |
| Account tag letter / ID / nickname lookup | Browser (`identity-model.ts`, from `result.accounts`) | Worker stamps the root on each row | Letters are derived from the published D-16 order, never stored |
| Login address -> accounts | Worker (`buildLogins`) | - | Needs the source account while rows are in hand |
| Payments per-account split | Worker (`buildSpend`) | Browser renders the disclosure | Only the worker has per-account groups |
| Large-fixture generation | Test code (`tests/fixtures`) | - | Synthetic only; the real zip must never be committed |
| CI budget | `playwright.config.ts`, `.github/workflows/ci.yml`, `tests/unit/guards/ci-budget.test.ts` | - | Three limits that move together |

## Standard Stack

### Core

No new packages. Every capability is an existing module.

| Module | Purpose | Why Used Here |
|--------|---------|---------------|
| `src/lib/features/playtime/playtime-aggregate.ts` | `aggregateSlice`, `rankAggregates`, `buildPlaytimeFromSources`, `viewFromAggregates`, `sessionFileGame` | The one merge/sweep; per-game slices are the same code over a subset |
| `src/lib/worker/ingest.worker.ts` | `handlePlaytimeQuery`, import loop, `answerLogins` | Owns query validation and the import-time build |
| `src/lib/worker/data-queries.ts` | `answerDataQuery`, `groupsOf`, memo | Vehicles/spend answer path; vehicles needs no new channel field |
| `src/lib/features/vehicles/vehicle-aggregate.ts` | `buildVehicleView`, `buildSummary`, `buildHeader`, `mapRow` | Where `account` is stamped and summaries are summed |
| `src/lib/features/logins/login-aggregate.ts` | `buildLogins`, `viewFromLogins` | Where `LoginAddress.accounts` is accumulated |
| `src/lib/features/finance/finance-aggregate.ts` | `buildSpend` | Per-account paid/units split |
| `src/lib/shell/identity-model.ts` | `accountCountOf`, `hasMultipleRoots`, `accountRows` | Home for the tag lookup (letters) |
| `src/lib/core/decimal.ts` (existing) | exact decimal sums | Spend per-account totals stay `bigint` strings |
| `tests/helpers/session-oracle.ts`, `finance-oracle.ts`, `login-oracle.ts`, `row-groups.ts`, `worker-harness.ts` | Independent oracles and the worker harness | Answer keys for the hand and large fixtures |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^5.0.2 (package.json) | unit tests, Node env, no DOM | every pure module and the worker harness |
| @playwright/test | ^1.63.0 (package.json) | e2e, request assertions, node counts | the SCALE-01 spec and tag/filter flows |
| fake-indexeddb | ^6.2.5 (package.json) | Dexie in Node | worker-level multi-account tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stored per-game aggregates | Re-read session rows and recompute on every chip click | No version bump, but pays a full row read per click (veteran exports hold ~71,000 session rows per `db.ts` comments) and needs its own memo |
| Stored per-game aggregates | Reuse `byValue[i]` when `splitColumn === 'GAME'` as the game slice | Zero storage change, but the nested `SERVER_NAME`/`CLIENT_PLATFORM` split inside one game is lost (UI-SPEC says the splitter "follows its existing rule" on the filtered slice). Acceptable ONLY if the planner accepts that the real header has neither column |
| `accounts: string[]` on `LoginAddress` | One row per (address, account) | One tag per row as UI-SPEC draws, but doubles shared-IP rows and breaks country `ips`, city `ips` and the cap semantics (Open Question 3) |
| Indexed `account` key | in-memory filter | Needs `version(3)` + lossless upgrader; nothing reads by account, so no read gets cheaper |

**Installation:** none.

**Version verification:** no package is added, upgraded or pinned. Baseline recorded this session: `pnpm run test:unit` passed 96 files / 3156 tests in ~37 s; `playwright test --list` reports `Total: 258 tests in 28 files`; Node v26.12.0, pnpm 12.6.0.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase, so the gate has no entries and `package-legitimacy check` was not run. **Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
 zip import (worker, unchanged shape)
   per (root, file) sources --+--> buildPlaytimeFromSources --> rankAggregates(all)
                              |                                  + for each game token:
                              |                                    rankAggregates(subset)  [NEW byGame]
                              +--> buildLogins (sources now carry account) --> addresses[].accounts [NEW]
   rows (each stamped `account`) ---------------------------------------------> Dexie rows / meta.playtime / meta.logins

 main thread (one pane mounted at a time)
   Dashboard.svelte
     gameFilter cell {token|null, stamp=importedAt}  <-- chip click (Playtime) / title select (Vehicles)
       |                                   |
       v                                   v
   Playtime.svelte                    PlayerStats.svelte
     client.query(valueIndex, game)     ask {title: filterToTitle(token)|null, battleType}
       |  postMessage playtime-query        |  postMessage data-query {channel:'vehicles', title, battleType}
       v                                   v
   worker handlePlaytimeQuery          worker answerDataQuery -> buildVehicleView (pickTitle if null)
     stored.byGame[token] | all           rows[].account, summary summed, header combined
       -> PlaytimeView {games, game}       -> VehicleView
       |                                   |
       v                                   v
   chips from view.games              AccountTag letters from result.accounts order
   tiles/charts from slice            (hidden when accountCountOf < 2)

 Logins: LoginAddress.accounts -> LoginTable first cell tags; Payments: SpendCard.byAccount -> "Per account" disclosure
```

### Recommended Project Structure (new and changed files)

```
src/lib/
  shell/
    game-filter-state.ts        # NEW pure: tokens, choices, visibility, token<->title, stamped resolve
    identity-model.ts           # + accountTagsOf(accounts) letters/ID/nickname lookup
    AccountTag.svelte           # NEW inert chip (4 placements)
    GameFilter.svelte           # NEW radio chip row (Playtime only)
    Dashboard.svelte            # + stamped gameFilter cell, props to Playtime/PlayerStats
  features/playtime/            # playtime-aggregate (byGame, games), playtime-shared (VERSION 3, token check),
                                # playtime-client/state (game in ask), Playtime.svelte (chips, empty-game, About)
  features/vehicles/            # vehicle-shared (VehicleRow.account), vehicle-aggregate (stamp, sum, header),
                                # vehicle-model (filterRows account search), VehicleTable (tag), PlayerStats (filter wiring)
  features/logins/              # login-shared (LoginAddress.accounts, VERSION 3), login-aggregate, login-model, LoginTable
  features/finance/             # finance-shared/aggregate (SpendCard.byAccount), SpendSummary (disclosure + note)
  worker/ingest.worker.ts       # playtime-query game validation, loginSources carry account
  ui-copy.ts                    # UI-SPEC copy constants
tests/fixtures/multi-account-fixtures.ts   # + hand overlap builder, + large three-account builder
```

### Pattern 1: Per-game aggregates inside the one stored playtime aggregate

**What:** `rankAggregates` already builds an `all` slice plus split slices from the usable sessions and excluded rows. After building the all-games aggregate, group `usable` and `excludedRows` by `game` and run the same function on each non-null group. Store them as `byGame` and list the tokens as `games`. Bump `PLAYTIME_VERSION` to 3 so every v2 cache rebuilds lazily from rows (the existing mechanism).

**Verified facts it rests on:**
- `export const PLAYTIME_VERSION = 2;` [VERIFIED: src/lib/features/playtime/playtime-shared.ts:58]; the lazy path is `if (stored != null && stored.v === PLAYTIME_VERSION)` else `readSessionRowData()` then `buildPlaytimeFromSources(snapshot.sources, snapshot.sources.length > 0)` [VERIFIED: src/lib/worker/ingest.worker.ts:205-229].
- `rankAggregates(usable, excludedRows, sessionsFileSeen)` returns `{ v: PLAYTIME_VERSION, sessionsFileSeen, splitColumn, values, byValue, all }` [VERIFIED: src/lib/features/playtime/playtime-aggregate.ts:680-730].
- Each usable session already carries its file's game: `export interface SplitSession extends UsableSession { game: SessionGame; ...}` [VERIFIED: playtime-aggregate.ts:82-93].
- `const MAX_SPLIT_VALUES = 50` bounds distinct values: `export const MAX_SPLIT_VALUES = 50;` [VERIFIED: playtime-shared.ts:80]. Reuse it to cap `byGame` entries.
- The game token is the upper-cased file-name token matched by `GAME_SESSIONS_FILE_RE = /^([A-Za-z0-9_]{1,24})_game_sessions\.csv$/` [VERIFIED: playtime-aggregate.ts:215], so a valid token is `^[A-Z0-9_]{1,24}$`.

**Why not a recompute per click:** `readSessionRowData` walks `orderBy('sourceFile').uniqueKeys()` and does one `where('sourceFile').equals(key).toArray()` per session file [VERIFIED: src/lib/worker/db.ts:501-535]; that is a full read of every session row per click.

**Cost:** import adds one `aggregateSlice` pass whose total size equals the usable session count (each session lands in exactly one game group), so roughly 2x the existing aggregation. Storage adds one slice per token (day arrays are bounded by active days; the stored `all` slice carries `dayIndex/daySeconds/daySessions` plus 168+168+12 cells [VERIFIED: worker-messages.ts:172-206]). Cap at `MAX_SPLIT_VALUES` tokens. A v2 cache pays one row read on its first playtime query after the upgrade, then writes back through `writePlaytimeIfCurrent` [VERIFIED: db.ts:928-938].

**Example (shape only):**
```typescript
// playtime-aggregate.ts (sketch). Values: SplitSession.game, MAX_SPLIT_VALUES are verified above.
export interface PlaytimeScope {            // today's PlaytimeAggregates minus the new fields
  v: number; sessionsFileSeen: boolean; splitColumn: string | null;
  values: (string | null)[]; all: PlaytimeSlice; byValue: PlaytimeSlice[];
}
// PlaytimeAggregates = PlaytimeScope & { games?: string[]; byGame?: { game: string; scope: PlaytimeScope }[] }
function rankAggregatesWithGames(usable, excludedRows, seen) {
  const top = rankAggregates(usable, excludedRows, seen);
  const tokens = [...new Set(usable.flatMap((s) => (s.game === null ? [] : [s.game])))].sort().slice(0, MAX_SPLIT_VALUES);
  return { ...top, games: tokens, byGame: tokens.map((game) => ({ game, scope: rankAggregates(
    usable.filter((s) => s.game === game), excludedRows.filter((r) => r.game === game), seen) })) };
}
```
Make `games`/`byGame` optional in the TYPE to limit test-literal ripple (52 call sites reference `buildPlaytime*`); the VERSION bump guarantees presence at runtime.

### Pattern 2: `game` on `playtime-query`, and the view carries the chip list

The request type today is `| { type: 'playtime-query'; queryId: number; valueIndex: number | null }` [VERIFIED: worker-messages.ts:345]. Add `game?: string | null` (optional so every existing test message, which omits it, still type-checks and means "All"). The handler `handlePlaytimeQuery(msg.queryId, msg.valueIndex)` [VERIFIED: ingest.worker.ts:132-134] gains the argument and:

1. Validates it as a token (`null` or `^[A-Z0-9_]{1,24}$`); anything else is treated as `null`/unknown, never thrown. `postMessage` is a trust boundary; `isDataQuery` is the precedent for a strict pure predicate [VERIFIED: data-queries.ts:218-236].
2. Picks the scope: `game === null` -> stored all-games scope; a token in `byGame` -> that scope; a token not in `byGame` -> a new `PlaytimeView` status `no-game-sessions` (the UI-SPEC "empty game" body), which must still carry `games` so the chip row stays.
3. Applies `viewFromAggregates(scope, valueIndex)`; extend the `ready` variant with `games: string[]` (always the ALL-games list) and `game: string | null` (the applied token). The current `ready` shape is `{ status: 'ready'; split; selected; slice }` [VERIFIED: worker-messages.ts:266-285].

Main-thread state: `RequestedSlice` and `ShownPlaytime` gain `game: string | null`; `derivePlaytimeState`'s `awaiting` test becomes `requested.valueIndex !== shown.valueIndex || requested.game !== shown.game` [VERIFIED current form: playtime-state.ts:121-125]. A chip click sets `valueIndex: null` (the split value list changes with the game). `PlaytimeClient.query(valueIndex)` [VERIFIED: playtime-client.ts:136] gains `game`. The e2e helpers `failPlaytimeQueryFor` and `delayPlaytimeQueries` match on `type`/`valueIndex` only [VERIFIED: tests/e2e/_support/helpers.ts:571-650], so an extra field does not break them.

`ingest-worker.test.ts:2059-2066` pins `expect(PLAYTIME_VERSION).toBe(2)`; flip it on purpose to 3.

### Pattern 3: Shared filter state = a dataset-stamped cell in Dashboard (pure module for the rules)

Exactly one pane is mounted at a time ("Exactly ONE pane is mounted at a time (D-01)" [VERIFIED: Dashboard.svelte:46-48]), so a cell inside `Playtime.svelte` would die on every pane switch. `Dashboard.svelte` already holds `choice` and `viewChoice` as `{ ..., stamp }` cells reset by a pure `resolve*` read, because "Setting state from a `$derived` would throw `state_unsafe_mutation`" [VERIFIED: Dashboard.svelte:74-83, 116-118]. Do the same:

```typescript
// game-filter-state.ts (pure, no runes, testable in Node)
export const GAME_FILTER_TOKENS = ['WOT', 'WOTB', 'WOWS'] as const;          // D-05; Phase 11 appends
export interface GameFilterChoice { token: string | null; stamp: string | null }
export function resolveGameFilter(c: GameFilterChoice, importedAt: string | null): string | null {
  return importedAt !== null && c.stamp === importedAt ? c.token : null;       // new import => All
}
export function filterToTitle(token: string | null): 'wot' | 'wotb' | 'wows' | null { /* lower-case, only the 3 */ }
export function titleToFilter(title: string): string | null { /* wot|wotb|wows -> token; wowp -> null (not a write) */ }
export function filterChips(games: readonly string[], selected: string | null): string[] | null {
  // UI-SPEC visibility rule: null (no row) unless >=1 filterable token present AND >=1 other token
  // of any kind; the selected token is always kept.
}
```
`datasetStamp(result)` is `result?.importedAt ?? null` [VERIFIED: selection-state.ts:246-248]. The existing guard `phase8-shell-guards.test.ts` "keeps selection as component state: no storage, hash, history or raw HTML in the shell" must keep passing (no `localStorage`, no hash) [CITED: tests/unit/guards/phase8-shell-guards.test.ts:189]. Passing props `gameFilter` and `onGameFilterChange` to `Playtime` and `PlayerStats` is the whole wiring.

**Chip source:** use the Playtime view's `games` (tokens with at least one USABLE session), not `AccountSummary.games`: `accountsOfMeta` returns `games: []` for every v1.0 cache [GREP: src/lib/worker/account-summary.ts accountsOfMeta, `games: [],`; re-Read before relying on it], so the summary list would hide the filter on an old single-account cache. The chips therefore appear only after the first playtime view arrives, which is acceptable because the chip row lives inside Playtime.

### Pattern 4: Vehicles needs no worker contract change for the filter

`DataQuery` vehicles is `{ channel: 'vehicles'; title: VehicleTitleId | null; battleType: string | null }` [VERIFIED: worker-messages.ts:303], and `VEHICLE_TITLES = ['wot', 'wotb', 'wows', 'wowp'] as const` [VERIFIED: vehicle-shared.ts:46]. The builder already implements D-04's fallback: `const title = request.title ?? pickTitle(overview);` with `pickTitle` returning the first title whose `rows > 0`, else `VEHICLE_TITLES[0]` [VERIFIED: vehicle-aggregate.ts:1001-1006, 1023]. So:

- `PlayerStats.svelte` first load: change `const ask: VehicleAsk = { importedAt: wanted, title: null, battleType: null }` [VERIFIED: PlayerStats.svelte:230] to `title: filterToTitle(gameFilter)` (read the prop inside `untrack`; the effect still depends only on `importedAt`).
- `onTitleChange` [VERIFIED: PlayerStats.svelte:247-261]: after issuing the ask, call `onGameFilterChange(titleToFilter(value))` ONLY for `wot|wotb|wows`; `wowp` writes nothing (UI-SPEC Recorded Choice 4). No loop: the filter can only change while Vehicles is mounted through this very handler.
- Applied-vs-asked: the select shows `view.title` (the applied one) already [VERIFIED: PlayerStats.svelte:586], which is the UI-SPEC requirement.
- A filter set to a title the export lacks yields `titleState` `not-in-export`/`no-rows` with the existing suffix lines; no new copy.
- The worker memo key is `${query.channel}:${JSON.stringify(query)}` [VERIFIED: data-queries.ts:355-357], so title-keyed answers memoise per filter value for free.

### Pattern 5: `account` on rows, letters from the published list

- `VehicleRow` today is `{ id; nation; battles; cells }` [GREP: src/lib/features/vehicles/vehicle-shared.ts interface VehicleRow; re-Read before editing]. `mapRow(row, fields, columns)` [VERIFIED: vehicle-aggregate.ts:897-928] is called inside loops that already iterate `byTypeGroups[g]` / `mainGroups[g]` [VERIFIED: vehicle-aggregate.ts:1071-1076, 1097-1099], and `AccountRowGroup.account` is "the account root that owns these rows" [VERIFIED: csv-columns.ts:44-49]. Add a trailing `account: string` argument/field. Payload cost is one short string per row.
- Letters: `result.accounts` is the PUBLISHED list in D-16 order and "a caller that renders the list must use the order it is given, never re-sort by name" [VERIFIED: worker-messages.ts:72-76, 86]. Add to `identity-model.ts`: `accountTagsOf(accounts): Map<string, { letter, id, nickname | null }>` using bijective base-26 (A..Z, AA, AB). The cap is `export const MAX_ACCOUNT_ROOTS = 32;` [VERIFIED: classify.ts:91], so at most `AF`. **Use a `Map` keyed by root**, never an object: a root can be named `__proto__` (the repo's T-09-04 precedent, cited in db.ts comments [VERIFIED: db.ts:504-507]). A row whose root is not in the list (should not occur) renders NO chip rather than throwing.
- Tags show when `accountCountOf(result) >= 2` [VERIFIED: identity-model.ts:106-113], the same predicate as the caption (`accountCount >= 2` in `DashboardSection.svelte:122` [VERIFIED]).
- Vehicles search: `filterRows(rows, query)` matches only `row.id` ("return rows.filter((row) => row.id.toLowerCase().includes(needle));") [GREP: src/lib/features/vehicles/vehicle-model.ts:230-236]. Extend with an optional `accountTextOf(row)` (letter + root) so the tag and ID match (D-11). There is NO search on Logins or Payments (`type="search"` exists only in `PlayerStats.svelte`), so do not add one.

### Pattern 6: Summing, header, per-account spend

- **Battle-type summary:** `buildSummary` pushes one `BattleTypeSummaryRow` per row per group, then sorts by battles; a code two accounts wrote is two rows (the Phase 9 assertion) [VERIFIED: vehicle-aggregate.ts:814-850]. Change to a `Map<code, row>` fold: numeric cells (`t: 'n'`) add; if a code has any numeric cell, specials contribute nothing; if all are specials keep the first special. Keep the existing sort. `BattleTypeSummary.svelte` is already index-keyed [GREP: BattleTypeSummary.svelte:171, `{#each summary as row, index (index)}`].
- **Header:** `buildHeader` returns the FIRST account's file row ("The FIRST account's header ... Phase 10 owns whatever a per-account header should say" [VERIFIED: vehicle-aggregate.ts:943-962]). Recommended rule (Open Question 2): lifetime battles = sum of numeric `battles` cells across the title's account-file rows of all groups; premium expiry = shown only when exactly one account contributed a row, otherwise omitted (the PlayerStats `{#if headerBattles !== null && headerExpires !== null}` already omits the whole `dl` on null [VERIFIED: PlayerStats.svelte:677], so the planner chooses whether to null just the expiry).
- **Finance / Payments sums:** already folded across groups into the same buckets: `buildCurrency` "folding into the SAME buckets ... two accounts' operations of one currency combine (D-11)", `buildSpend` "folding into the SAME cards" [VERIFIED: finance-aggregate.ts:560-563, 841-844]. Sums are `bigint`, emitted as `toString()` [VERIFIED: finance-aggregate.ts:656-658, 930]. Nothing to change for ACCOUNT-04 finance beyond the note and caption.
- **Payments per-account:** `SpendCard` has `byYear`/`byGame` only, no per-payment rows [GREP: finance-shared.ts SpendCard, lines 225-241 list `byYear: SpendYear[]; byGame: SpendGame[];`; SpendSummary.svelte lines 251-350 render `spend-card` with two tables and `(index)` / `(rowIndex)` keys]. So UI-SPEC open item resolved: there is no per-payment listing anywhere; the tag appears only in the "Per account" disclosure. Add `byAccount: { account: string; paid: number; units: string }[]` to the card, accumulated per `group.account` inside the existing group loop (so it is exact and shares the included-paid-orders definition with the headline).

### Pattern 7: Logins carry accounts per address

`LoginAddress` is "one row per distinct full IP" (D-05) [VERIFIED: login-shared.ts:106-112]; `buildLogins` keys `counting` by `parsed.canonical` and adds `entry.games` from `source.game` [VERIFIED: login-aggregate.ts:273-285]. Add `accounts: Set<string>` to `CountingAddress`, add `source.account` per row, emit `accounts: [...].sort()` (code-unit). Three required companion edits:
1. Import loop: `loginSources.push({ game, kind: 'sessions', rows })` and `loginSources.push({ game: null, kind: 'logins', rows })` carry NO account today [CITED: src/lib/worker/ingest.worker.ts ~1030-1050 via sed excerpt; re-Read before editing]. Add `account: resolved.root`. The rebuild reader's `AccountLoginSource` already has `account` [VERIFIED: db.ts:419-421, 685-699].
2. Widen the `buildLogins` parameter type to `readonly (LoginSource & { account?: string })[]`.
3. `LOGINS_VERSION` 2 -> 3 [VERIFIED current: login-shared.ts:30] so old caches rebuild (the rebuild reads `IP` from rows; nothing is lost).

Nothing else moves: city `placeOf` is index-aligned to `addresses` (one entry per address) and country `ips` counts distinct addresses; both stay correct because rows are NOT split per account. The Account record row is already absent for 2+ accounts (`accountCount === 1` gate in `readLoginRowData` [VERIFIED: db.ts:726-748]), which is D-13's "no per-account record card". `buildLoginRows` maps `LoginAddress` -> `LoginRow` [VERIFIED: login-model.ts:414-432]; add `accounts` there and render chips in the existing `columnIndex === 0` cell branch of `LoginTable.svelte` [VERIFIED: LoginTable.svelte `cellView` snippet]. A shared-IP row shows one chip per account (Open Question 3).

### Anti-Patterns to Avoid

- **Counting sessions as merged intervals without a decision.** It changes every single-account number (Open Question 1).
- **Filtering the stored aggregate on the main thread.** The aggregate never crosses to the main thread (comment on `PlaytimeAggregates`: "the aggregate is far too large to clone across `postMessage` on each query" [VERIFIED: worker-messages.ts:208-216]).
- **A `{#each}` keyed by a row/chip/account value.** `multi-account-keys.test.ts` fails on any keyed block not in its `AUDITED` table [VERIFIED: tests/unit/import/multi-account-keys.test.ts:578-590]. Every new keyed block (chips, Payments per-account rows, tag lists) must be added with a `why` of `position`, `fixed-list`, `de-duplicated` or `per-group`.
- **Object-keyed account lookups** (`__proto__` root). Use `Map`.
- **Putting the nickname in any attribute** (`title`, `aria-label`, `data-*`). Text content only (UI-SPEC; v1.0 D-21).
- **Adding a second phone `@media` query.** Exactly one is allowed under `src` (`phase8-ui-review-guards.test.ts` "declares exactly one phone-width query under src, and it is in app.css" [CITED: line 171]).
- **A new `aria-live` attribute.** The page-wide count is asserted; chips use the existing Playtime status line.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interval union / overlap | A second sweep for the filtered view | `aggregateSlice` via `rankAggregates` on a subset | One merge path; the oracle already checks it |
| Exact money sums | `Number` adds | `bigint` as `buildSpend` does | Phase 5 T-05-10 |
| Game token from file name | New filename parser | `sessionFileGame` / `GAME_SESSIONS_FILE_RE` | Bounded, rejects lookalikes |
| Account order | New comparator | `result.accounts` order (D-16) | Already stored in order; re-sorting makes two orders |
| Large CSV fixture | New generator | `generateCurrencyOpsCsv(CurrencyOpsSpec)` + `oracleCurrency` | Seeded, deterministic, independent oracle exists |
| Multi-account zip | New zip writer | `RootSpec` + `assemble` in `multi-account-fixtures.ts` (`files` override) | Already writes per-root overrides |
| Windowed lists | New list component | existing `windowRange` tables | Constant 40px rows; node count bounded by window |
| Node counting / long tasks in e2e | New probe | the `PerformanceObserver('longtask')` + `querySelectorAll('*').length` patterns in `finance-scale.spec.ts` and `login-scale.spec.ts` | Same budgets and phrasing |

**Key insight:** Phase 10 is almost entirely "call the existing function with a subset or add one field"; the risk is in contracts and pinned tests, not algorithms.

## Merge correctness across accounts (item 1, D-06..D-08)

`aggregateSlice` sorts indices by start (`usable.map(...).sort((a, b) => usable[a]!.start - usable[b]!.start)`) and walks with `covered`; `increment = Math.max(0, end - Math.max(start, covered)); covered = Math.max(covered, end);` [VERIFIED: playtime-aggregate.ts:532-549]. Account is never read, and `buildPlaytimeFromSources` flattens all sources into one `usable` list [VERIFIED: playtime-aggregate.ts:607-635]. Order independence, checked by hand and by script (scratch): for equal starts, whichever session is first claims `[start, end1)` and the second claims `[end1, end2)` (or zero), so the multiset of claimed tails always tiles the same union; `hourStart` and the day bucket depend only on the shared start; `bins` use the raw length. Ties are therefore harmless, and account order never matters. JS `sort` is stable, so even the `dayIndex` push order is deterministic.

**Hand-computed two-account fixture (feasible with `RootSpec.sessions`, the existing per-root session rows, real header `STARTED_AT;FINISHED_AT;IP` and `DD.MM.YYYY HH:MM`):**

| Account | File | Session |
|---|---|---|
| A | WOT | 04.03.2024 10:00-11:00; 05.03.2024 20:00-21:00; 08.03.2024 09:00-10:00 |
| A | WOWS | 06.03.2024 18:00-19:00 |
| B | WOT | 04.03.2024 10:30-11:30 (overlaps A); 05.03.2024 21:00-22:00 (TOUCHES A); 10.03.2024 12:00-12:30 (disjoint) |
| B | WOTB | 04.03.2024 10:45-11:15 (inside A and B, other game); 06.03.2024 18:30-19:30 (overlaps A WOWS) |

Expected, computed by hand and re-checked with an independent union script (scratchpad): **All games** 23,400 s = 6.5 h (04.03 10:00-11:30 = 5,400; 05.03 20:00-22:00 = 7,200; 06.03 18:00-19:30 = 5,400; 08.03 = 3,600; 10.03 = 1,800), 5 active days (04, 05, 06, 08, 10 March), sessions = 9 under v1.0 counting. **WOT** 18,000 s = 5 h, 6 sessions, 4 days. **WOTB** 5,400 s = 1.5 h, 2 sessions, 2 days. **WOWS** 3,600 s = 1 h, 1 session, 1 day. Per-game sum 27,000 s > All 23,400 s (the "All can be smaller" case; difference 3,600 = 1,800 contained WOTB + 1,800 WOTB/WOWS overlap). Under a merged-interval session count (Open Question 1b) All would be 5 (touching joined) or 6 (touching separate), WOT 4 or 5. The touching pair (05.03 21:00) is what makes the rule observable. The answer key must go in the test as literals, and the independent `oracleSlice` in `tests/helpers/session-oracle.ts` ("Count of usable sessions, including any that merged to zero seconds" [VERIFIED: session-oracle.ts:66-70]) can cross-check hours/days.

## Runtime State Inventory

This phase changes two stored aggregate shapes (not a rename).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `meta.playtime` at `v: 2` (no `byGame`/`games`) and `meta.logins` at `v: 2` (no `accounts` per address) in every returning user's IndexedDB | Code only: bump `PLAYTIME_VERSION` 2->3 and `LOGINS_VERSION` 2->3; the existing lazy rebuild recomputes from rows. No Dexie bump, no migration. Test with a v2-stamped aggregate |
| Live service config | None (no server) | None |
| OS-registered state | None | None |
| Secrets / env vars | None | None |
| Build artifacts | `dist/` is rebuilt by the Playwright `webServer` (`vite build && vite preview`) | None |

## Common Pitfalls

### Pitfall 1: D-07 vs D-08 silently changing v1.0 numbers
**What goes wrong:** implementing "sessions count merged intervals" changes `sessions`, `daySessions`, `dayIndex` for single-account users; `HAND_ALL` (7 sessions), `HAND_EU` (4), the oracle's contract and e2e text assertions all break.
**Why:** v1.0 counts `sessions: usable.length` [VERIFIED: playtime-aggregate.ts:535] and documents row 2 as "contained in row 1. It adds a SESSION and no seconds" [VERIFIED: tests/fixtures/playtime-hand-fixture.ts:80, quote: "// 2. Contained in row 1. It adds a SESSION and no seconds"], with `HAND_ALL` at 7 sessions and 5 active days (same file).
**Avoid:** resolve Open Question 1 first.

### Pitfall 2: Chip list from `AccountSummary.games`
v1.0 caches normalise to `games: []`; the chips would never show for them. Use the playtime view's `games`.

### Pitfall 3: Forgetting the `game` in the `updating` comparison
Without `requested.game !== shown.game`, a chip click that leaves `valueIndex` at `null` is never `updating`, so no "Updating charts..." status and a stale slice looks final.

### Pitfall 4: Stale `valueIndex` after a game change
The split value list belongs to the game scope; carry `valueIndex: null` on a chip click. `effectiveSelection` already refuses an index past the end [VERIFIED: playtime-model.ts:959-970].

### Pitfall 5: Hidden unit pins that flip
`ingest-worker.test.ts:2059` (`PLAYTIME_VERSION` is 2), `tests/unit/shell/ui-copy.test.ts:2239-2243` (`'2 accounts combined'` and `not.toBe(formatAccountCount(3))`), the `AUDITED` table in `multi-account-keys.test.ts`, and the nickname-once assertions in `multi-account.spec.ts:273-286` (`countOccurrences(...).toBe(1)` in innerText, outerHTML and the aria snapshot) and `identity-privacy.spec.ts:200-201`. Row tags carry the nickname as visually-hidden text on every rendered row, so on a multi-account Vehicles/Logins/Payments pane the nickname appears once in the header plus once per rendered tagged row. Restate the multi-account rule as "in text only, never in an attribute" (assert `outerHTML` count equals `innerText` count, and no attribute contains it) on tagged panes, and keep exactly-once on panes with no tags. The single-account specs are unaffected (no tags).

### Pitfall 6: Count of listed e2e tests
258 now; the guard enforces <= 262 for 30 min (Pattern: CI section). A scale spec priced as a block needs the raise.

### Pitfall 7: Mount-order for table measurement
`VehicleTable`/`LoginTable` measure their scroller once at mount ([CITED: Dashboard.svelte `detailMounted` comment, read this session]); keep new header chips outside the scroller so the windows are not disturbed.

### Pitfall 8: Header vs data account mismatch
Tags derive letters from `result.accounts` (published, `hasData` filtered). A row's `account` root always belongs to an account with stored rows, so it is in the list; still render nothing for an unknown root.

## Code Examples

### Account letters (bijective base-26)
```typescript
// identity-model.ts. Order is the given order (D-16); MAX_ACCOUNT_ROOTS = 32 so at most "AF".
export function letterOf(index: number): string {
  let n = index; let s = '';
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}
```

### Spend per-account fold (inside the existing group loop)
```typescript
// finance-aggregate.ts buildSpend: group.account is AccountRowGroup.account [csv-columns.ts:44-49]
const perAccount = bucket.accounts.get(group.account) ?? { paid: 0, units: 0n };
perAccount.paid += 1; perAccount.units += amount;           // same branch as bucket.paid += 1
bucket.accounts.set(group.account, perAccount);             // Map, never an object
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `all` playtime aggregate | `all` + per-game scopes | this phase | filter without a row read |
| One logins row per address with games only | + accounts per address | this phase | tag without splitting rows |
| Caption "{N} accounts combined" | "All {N} accounts combined" | this phase (UI-SPEC) | update `formatCombinedCaption` and its unit test |

**Deprecated/outdated:** Phase 9's comment that finance totals per currency are "left for Phase 10" is moot: they already combine (verified above); only the note and the per-account detail are new.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The real export has no `SERVER_NAME`/`CLIENT_PLATFORM` columns (so a nested split inside one game never occurs on real data) | Alternatives (derive-from-byValue) | Only matters if the planner chooses the cheap alternative; the recommended path does not depend on it. Source: Phase 9 research header verification, not re-run |
| A2 | Stored `byGame` adds well under 1 MB to the meta record for a decade-long, three-account export | Pattern 1 | If larger, cap tokens lower or store only filterable tokens; the lazy rebuild path is unchanged |
| A3 | A 54,000-row Virtual_Currencies import costs about the 50,000-row figure (1,414 ms) | SCALE-01 | If 2-3x, still far under the 60 s ready budget; the e2e measures it |
| A4 | The Phase 10 e2e block costs about 30 s of CI allowance | CI section | If larger, the computed minutes may need +1; the guard fails loudly and names the number |
| A5 | Vehicles premium-expiry omission when 2+ accounts contribute (Open Question 2) | Pattern 6 | UX choice; user may prefer showing the latest |
| A6 | Rendering one chip per account on a shared-IP row (Open Question 3) | Pattern 7 | UI-SPEC drew a single chip; widths may need a UI-SPEC amendment |

## Open Questions

1. **D-07 versus D-08 (needs the user before the playtime plan is final).**
   - What we know: v1.0 counts every usable session (`sessions: usable.length`, contained sessions count, zero-length counts) and active days by session START day; the hand fixture and oracle encode this. D-07 says merged intervals are the unit; D-08 says no change to v1.0 rules.
   - What's unclear: whether D-07 meant "the numbers come out of the same merge" (a description) or "change the unit" (a behaviour change). If the unit changes, also decide whether touching intervals (end == next start) join.
   - Recommendation: (a) keep v1.0 counting, state in the About text that sessions are recorded sessions and hours are the union; the hand fixture then expects 9/5/6.5 h. Surface as a plan-time checkpoint. If the user insists on (b): change `aggregateSlice` (`sessions`, `daySessions`, `dayIndex`), bump `PLAYTIME_VERSION`, rewrite `HAND_*` (7 -> 5), the oracle, and every e2e text pin, and pick the touching rule.
2. **Vehicles header across accounts.** `buildHeader` returns the first account's lifetime battles and premium expiry. Recommendation: sum numeric lifetime battles across accounts; show the expiry only when exactly one account contributes (omit otherwise); put per-account values in no new headline (D-14 spirit).
3. **Shared IP across accounts.** UI-SPEC draws one chip and a fixed +32px first column. Recommendation: keep one row per address, store `accounts`, render one chip per account inline (nowrap); decide a maximum chip count (3 then rely on the sr-only phrase) and the first-column width for 1..3 chips; amend UI-SPEC accordingly. The per-(address, account) row alternative is rejected because it breaks `ips` counts, the city rollup and `MAX_LOGIN_IPS`.
4. **Nickname as row text (UI-SPEC Recorded Choice 3).** A deliberate relaxation of v1.0 D-21 already flagged for approval; the e2e privacy assertions must be restated (Pitfall 5). Confirm before executing.
5. **UI-SPEC Recorded Choice 1 (no chip row on Vehicles) versus D-02.** Already resolved in the contract in favour of D-04; plan accordingly and keep `player-stats-title-selector`.
6. **e2e budget.** See CI section; plan the raise.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | yes | v26.12.0 | - |
| pnpm | scripts | yes | 12.6.0 | - |
| Playwright Chromium | e2e | yes | chromium-1243 in `~/Library/Caches/ms-playwright` | - |
| vitest suite | unit | yes | 96 files / 3156 tests green, ~37 s | - |
| External services | - | none needed | - | - |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^5.0.2 (Node env, `tests/unit/**/*.test.ts`, 20 s test timeout) + Playwright ^1.63.0 |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `pnpm run test:unit -- tests/unit/playtime tests/unit/vehicles tests/unit/logins tests/unit/finance tests/unit/shell` |
| Full suite command | `pnpm run test:unit && pnpm exec playwright test` (config `test_command` in `.planning/config.json`) |
| Gates | `pnpm run check`, `pnpm run lint` |

Component rendering is not available under Vitest (no Svelte plugin), so every rule lives in a pure module and the DOM is checked in Playwright.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACCOUNT-06 | Merge correct across accounts: hand fixture 6.5 h / 9 sessions / 5 days; per-game 5 h, 1.5 h, 1 h; All < sum | unit (worker harness + pure) | `pnpm run test:unit -- tests/unit/playtime/playtime-multi-account.test.ts` | NEW Wave 0 |
| ACCOUNT-06 | Stored `byGame` equals lazy rebuild; unknown token -> `no-game-sessions`; invalid token ignored | unit | `pnpm run test:unit -- tests/unit/import/ingest-worker.test.ts` (extend) | extend |
| ACCOUNT-06 | `game-filter-state` rules (visibility, token<->title, stamp reset) | unit | `pnpm run test:unit -- tests/unit/shell/game-filter-state.test.ts` | NEW Wave 0 |
| ACCOUNT-06 | Vehicles with filter -> `title`; All -> `pickTitle`; tag search | unit | `pnpm run test:unit -- tests/unit/vehicles` | extend |
| ACCOUNT-06 / ACCOUNT-04 | Chips, Playtime recompute, Vehicles select sync, tags on rows | e2e | `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts` | extend (steps in existing tests, not new listed tests) |
| ACCOUNT-04 | Battle-type summary sums per code; header rule; spend `byAccount`; currency sums across accounts | unit | `pnpm run test:unit -- tests/unit/vehicles tests/unit/finance` | extend |
| ACCOUNT-07 | `LoginAddress.accounts`, shared-IP row, rebuild equals import, city alignment unchanged | unit | `pnpm run test:unit -- tests/unit/logins tests/unit/import/logins-backfill.test.ts` | extend |
| ACCOUNT-07 | Masking and city opt-in unchanged with tags; no fetch until asked | e2e | `pnpm exec playwright test tests/e2e/logins` | extend |
| SCALE-01 | Large 3-account import: aggregates equal oracle sums; bounded rows | unit (harness, fake-indexeddb) | `pnpm run test:unit -- tests/unit/import/multi-account-scale.test.ts` | NEW Wave 0 |
| SCALE-01 | Ready under cap, no long task over 1,000 ms, node counts bounded, zero network | e2e (serial, 2 tests) | `pnpm exec playwright test tests/e2e/shell/multi-account-scale.spec.ts` | NEW Wave 0 |
| D-12 | New caption wording | unit | `pnpm run test:unit -- tests/unit/shell/ui-copy.test.ts` | flip lines 2239-2243 |
| D-16 | `db.verno` stays 2 | unit | `pnpm run test:unit -- tests/unit/import/db.test.ts` | exists |
| Budget | listed count / limits move together | unit | `pnpm run test:unit -- tests/unit/guards/ci-budget.test.ts` | edit pins |
| Keys | new keyed blocks audited | unit | `pnpm run test:unit -- tests/unit/import/multi-account-keys.test.ts` | edit AUDITED |

### Sampling Rate
- **Per task commit:** the touched unit file(s).
- **Per wave merge:** `pnpm run test:unit` (about 37 s) plus `pnpm run check` and `pnpm run lint`.
- **Phase gate:** full unit + `pnpm exec playwright test` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/fixtures/multi-account-fixtures.ts`: add `buildOverlapTwoAccountExport()` (the table above, via `RootSpec.sessions` and `assemble`, which is module-private so the builder lives in this file) and `buildLargeThreeAccountExport()`.
- [ ] `tests/unit/playtime/playtime-multi-account.test.ts` with the literal answer key above.
- [ ] `tests/unit/shell/game-filter-state.test.ts`.
- [ ] `tests/unit/import/multi-account-scale.test.ts` (worker harness, oracle sums).
- [ ] `tests/e2e/shell/multi-account-scale.spec.ts` (2 listed tests).
- [ ] `CURRENCY_54K_SPEC` in `tests/fixtures/finance-fixtures.ts` (seeded, e.g. `rows: 54_000`, reuse `SCALE_CODES`).
- [ ] No framework install needed.

### SCALE-01 plan (item 4)

- **Current cost, evidence:** the recorded measurement for the 50,000-operation single-account import is "submission to `ready`: 1,414 ms" and the 10,000-row replace 947 ms [CITED: tests/unit/guards/ci-budget.test.ts comment on `FINANCE_SCALE_SECONDS`, measured in 05-16]. Import already runs entirely in the worker (parse, `writeDataset` in chunks of `ROWS_PER_BULKPUT_CHUNK = 1000` inside one transaction [VERIFIED: db.ts:277, 376-393]). A freeze is not plausible on that path, and Phase 10 adds only a per-row `account` string (already added by Phase 9) plus small aggregate fields. The risky part is memory, not time: the real `Virtual_Currencies_Operations.csv` is 3,645,592 bytes [CITED: 09-RESEARCH real-sample table], and inflate is capped at 128 MiB per entry / 512 MiB total [CITED: 09-RESEARCH, `inflate-bounds.ts`].
- **`readRowsByFile` at 54,000 rows:** it reads `where('sourceFile').equals(key).toArray()` for the one currency file and groups per account in memory [VERIFIED: db.ts:879-907]. Its documented ceiling test is 3,000 rows < 1,000 ms for twelve files; a 54k single-file read is one index read, not one per key. The unit scale test should assert the aggregate equals the oracle and ALSO time the read with a generous bound, rather than assume.
- **No indexed key (D-16):** no reader queries by account; so no need to recommend `version(3)`. If the large unit test or e2e measures a freeze, the lever is smaller (one aggregate per account computed at import), not an index.
- **Fixture:** extend `multi-account-fixtures.ts`. One account (the oldest by first activity, to mirror the real sample) carries `files: { 'Financial_Data/Virtual_Currencies_Operations.csv': generateCurrencyOpsCsv(CURRENCY_54K_SPEC) }`; the other two carry smaller seeded files (for example 2,000 and 500 rows with different seeds) so same-currency sums combine across accounts. Add 60,000-session style session files per game via `buildSessionsCsv`/seeded real-shape rows to exercise per-game aggregates (the `SCALE_60K_SPEC` preset exists), a vehicle generator (`generateVehicleMainCsv`, 5,000 per account) and a login scale file (`LoginsScaleSpec`, 12,000 rows) so every merged pane sees volume. Each CSV is generated in Node; the zip never touches disk.
- **Answer key:** `oracleCurrency(csv)` per account text, summed (exact thousandths, `Number` is exact below 2^53 for these magnitudes per the oracle header). Compare to the card figures and to `buildCurrency` over three `AccountRowGroup`s (`oneAccountEach`).
- **Unit assertions (worker harness + fake-indexeddb):** stored playtime `byGame` keys; `playtime-query` per game; `vehicles` rows count = sum of accounts; `logins` `addresses.length <= MAX_LOGIN_IPS` and `sum(countries.logins) + unknown.logins === totalLogins` (the documented relationship [CITED: login-shared.ts MAX_LOGIN_IPS comment]); finance currency sums equal oracle; Spend `byAccount` sums equal card totals.
- **e2e (one serial describe, 2 listed tests, import once, then replace-free reads):** test 1: import, `importToReadyMs` under `READY_BUDGET_MS` (60,000, the figure both existing scale specs use), long tasks under `LONG_TASK_LIMIT_MS` (1,000), then open each merged pane and assert node counts: windowed tables bounded by window size (vehicle/login row count in DOM <= a window constant, not rows), Playtime nodes bounded by buckets, Currency card nodes under the existing `3 * cells + 40` / `CARD_CHROME_NODES = 140` style bounds, Payments disclosure rows <= accounts; zero requests after the baseline and one worker (copy `context.on('request')`/`page.on('worker')` from `zero-network.spec.ts:49-50`). Test 2: filter flow (chip click -> Playtime tiles equal the oracle for that game; Vehicles select follows) on the same page. Filter/tag assertions on the SMALL fixtures go inside the already-listed multi-account tests as extra steps (not new tests).

### CI budget (item 4)

Where the limits live: `globalTimeout: 30 * 60 * 1000` [GREP: playwright.config.ts:196], `timeout-minutes: 40` [GREP: .github/workflows/ci.yml:103], `run: pnpm exec timeout 32m playwright test` [GREP: ci.yml:221]; the guard asserts `toBe(1800)`, `toBe(1920)`, `toBe(2400)` and `toBeLessThanOrEqual(262)` [VERIFIED: ci-budget.test.ts:462-479] and the comment sentence `Playwright's own \`globalTimeout\` (N min)` must name the same minutes [VERIFIED: ci-budget.test.ts:504-532]. Measured today: `Total: 258 tests in 28 files`; `projectedE2eSeconds(258)` = 1360 [VERIFIED: ci-budget.test.ts:433]; 1.3 x 1360 = 1768 <= 1800.
- Adding 4 listed tests (262) projects 1360 + 20 = 1380, floor 1794 s: passes at 30/32/40 with 6 s of slack but prices the large import at 5 s.
- Pricing the large three-account block honestly (like `MULTI_ACCOUNT_LONG_SECONDS = 32`, held back from the per-test count with a new gate constant) adds an allowance A: with A = 30 s, E(260) = 1360 + 10 + 30 = 1400, floor 1820 s > 1800, so raise **all three**: G = 31 min, W = 33 min (G + 2), J = 41 min (W + 8) [rule: "G + 2 min, W + 8 min", VERIFIED in ci-budget.test.ts header text and ci.yml comments]. 31 min covers E up to 1430 s.
- Edits that move together: `playwright.config.ts:196` and its comment block (append a dated "Raised from" paragraph, never rewrite), `ci.yml:103`, `ci.yml:221` and the present-tense sentence naming the minutes, `ci-budget.test.ts` constants/pins (`toBe(1860)`, `toBe(1980)`, `toBe(2460)`, the new ceiling number, a new `expect(projectedE2eSeconds(n))` pin, the new allowance constant and its gate). Do it in the plan that adds the scale spec so the suite is never red in between.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts or logins in the app |
| V3 Session Management | no | No server sessions; account ids are data |
| V4 Access Control | no | Single local user |
| V5 Input Validation | yes | Validate the `game` token (`^[A-Z0-9_]{1,24}$`) in the worker like `isDataQuery`; roots are untrusted folder names rendered as text only; `Map` for root-keyed lookups |
| V6 Cryptography | no change | None added |
| V7 Error handling / logging | yes | Worker errors log the error object only; `playtime-error` detail stays name+message of the error, never row cells |
| V8 Data Protection | yes | Nickname only as visually-hidden TEXT content in rows, never an attribute; no email/birth date reaches storage or DOM (per-root canaries already exist: `MA_CANARIES`) |
| V9 Communications | yes | Zero-network assertion extended to the large merged flow; ESLint network ban unchanged; filter uses no storage |
| V14 Configuration | yes | CSP `connect-src 'self'` unchanged |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hostile `game` string in `playtime-query` | Tampering | Strict token check, unknown -> `no-game-sessions`, no echo into a message |
| Root named `__proto__` or very long | Tampering | `Map` lookups; roots already length-bounded by the classifier (`MAX_ACCOUNT_ROOTS = 32`, root-name cap) |
| Nickname in an attribute (tooltip/aria) | Information disclosure | Text content only; e2e asserts markup count equals text count |
| Filter state persisted | Information disclosure | Component state only; shell guard forbids storage/hash |
| Unbounded `byGame` growth | Denial of service | Cap tokens at `MAX_SPLIT_VALUES` |
| Cross-account row attribution error | Tampering | `account` taken from the group (`AccountRowGroup.account`), not from a cell |

## Project Constraints (from CLAUDE.md)

- Privacy is the product: zero network after load (single exception: opt-in same-origin city file); enforced by CI and the ESLint network ban, CSP as defence in depth.
- Svelte 5 runes, Vite, pnpm; TypeScript pinned `^6` (repo has `~6.0.2`); no SvelteKit/router; selection and filter are component state.
- Dependency minimalism: no new package; charts and chips hand-rolled; no new CSS file, one phone `@media (max-width: 480px)` block, 44px floor for interactive controls, no new colour tokens, no inline styles.
- Dexie: `version(2)` and its wiping upgrader stay; non-indexed fields only (06-01 / Phase 9 D-07 precedent); `db.test.ts` pins `verno` 2.
- Worker lifecycle: one long-lived worker; Dexie is worker-only; main thread gets derived, PII-free objects; aggregate per bucket, never one node per raw row; synthetic large fixture required.
- Linting: ESLint + Prettier (not Biome); `pnpm run check` is `tsc -b && svelte-check`.
- Commits: no `Co-Authored-By` trailer in this project (repo and user CLAUDE.md both say so).
- GSD workflow: edits go through a GSD command; after code changes run `graphify update .` (AGENTS.md).
- Real sample zip (`2026-10-14.zip`) must never be committed; fixtures are synthetic.
- Sketch skill: master-detail shell, selection as state, 480px block, 44px floor [CITED: .claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md].

## Sources

### Primary (HIGH confidence, files opened with Read this session)
- `.planning/phases/10-merged-dashboard-across-accounts/10-CONTEXT.md`, `10-UI-SPEC.md`; `09-RESEARCH.md` (lines 1-642); ROADMAP Phase 10 block and Planning Notes; REQUIREMENTS lines for the four IDs (grep)
- `src/lib/features/playtime/playtime-aggregate.ts` (full), `playtime-shared.ts`, `playtime-state.ts`, `playtime-client.ts`, `Playtime.svelte` (1-420)
- `src/lib/core/types/worker-messages.ts` (56-480)
- `src/lib/worker/db.ts` (30-1060), `data-queries.ts` (full), `ingest.worker.ts` (100-420)
- `src/lib/features/vehicles/vehicle-aggregate.ts` (186-286, 690-1117), `vehicle-state.ts`, `PlayerStats.svelte`, `VehicleTable.svelte` (285-420)
- `src/lib/features/finance/finance-aggregate.ts` (330-960), `login-aggregate.ts`, `login-model.ts` (255-554), `login-shared.ts` (26-130), `LoginTable.svelte` (150-330)
- `src/lib/shell/selection-state.ts`, `Dashboard.svelte`, `identity-model.ts`; `src/lib/ui-copy.ts` (562-566, 2902-2908); `src/lib/worker/classify.ts:88-93`
- `tests/fixtures/multi-account-fixtures.ts` (180-679), `finance-fixtures.ts` (1070-1362), `playtime-hand-fixture.ts` (1-200), `tests/helpers/session-oracle.ts` (55-150), `row-groups.ts`
- `tests/unit/guards/ci-budget.test.ts` (260-534), `tests/unit/import/multi-account-keys.test.ts` (555-620), `tests/e2e/shell/multi-account.spec.ts` (60-100, 236-295), `tests/e2e/_support/helpers.ts` (555-650)

### Secondary (grep or sed excerpts; re-Read before quoting into a plan action)
- `ci.yml` lines 103, 221; `playwright.config.ts` line 196; `ci-budget.test.ts` lines 100-260 (measurements 1,414 ms / 947 ms in the FINANCE_SCALE_SECONDS comment); `ingest.worker.ts` 985-1325 (loginSources pushes, `writeDataset` call); `account-summary.ts` (`accountsOfMeta`); `phase8-shell-guards.test.ts` / `phase8-ui-review-guards.test.ts` test names; `package.json`.

### Tertiary
- Baseline runs this session: `pnpm run test:unit` (96 files / 3156 tests passed), `pnpm exec playwright test --list` (258 tests in 28 files), a scratchpad Node script computing interval unions for the hand fixture. No web or Context7 lookup was used: this phase is a codebase investigation with no external library.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; all modules read.
- Architecture (per-game aggregates, filter cell, vehicles mapping, login accounts): HIGH for contracts and code paths; MEDIUM for storage size (A2).
- Pitfalls: HIGH (pins found by reading the tests), with Open Question 1 the one product-level ambiguity.
- CI arithmetic: HIGH for the formula and pins; MEDIUM for the 30 s allowance (A4).

**Research date:** 2026-10-18
**Valid until:** 30 days for code facts; re-check line numbers after any merge to `main`.
