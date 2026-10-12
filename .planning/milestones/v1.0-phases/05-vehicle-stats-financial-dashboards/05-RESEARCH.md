# Phase 5: Vehicle Stats & Financial Dashboards - Research

**Researched:** 2026-10-01
**Domain:** Client-side tabular aggregation (worker-side), windowed native table, hand-rolled SVG bar charts, exact decimal money arithmetic, over the existing Svelte 5 + Dexie 4 + Web Worker pipeline
**Confidence:** HIGH on integration points and real-export shapes (read from this repo and from header lines and shape histograms of the real 2021 sample this session); MEDIUM on browser-behaviour claims (marked `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page structure and categories**
- **D-01:** Financial_data becomes a **new, sixth dashboard section**. `Financial_data` is added to the supported categories and the one-section-per-source-folder rule of Phase 3 D-02 is kept. Section order becomes `Activity_history`, `Player_statistics`, `Financial_data`, `Payment_history`, `User_Info`, then "Not yet supported". The nav grows to six links (Phase 3 D-03 amended). Each folder keeps its own status and empty state. — **Reversibility:** costly — **Reversibility rationale:** the category list, the status derivation, the nav and the section order are all keyed on the folder set; changing it later touches `categories.ts`, `dashboard-status.ts`, `DashboardNav` and the e2e nav tests.
- **D-02:** Within Financial_data, status is **per sub-block**. The section is `ready` if either file has rows. "Premium time" and "Virtual currency" each show their own "not in this export" or "this export contains no rows for X" text (Phase 3 D-10 wording pattern), like Playtime and Login history under Activity_history. The Payment_history spend summary stays in its own section and its own status.

**Test fixtures**
- **D-03:** Add `Financial_data/` to the fixture builders using the **real 2021 headers**, plus a large synthetic generator (10k+ virtual-currency operations over many years, mixed currency codes including a stray `UAH`, all three TYPE values plus an unknown one, both premium formats plus junk strings, unparseable amounts). No real export data is committed, and no anonymised excerpt either.
- **D-04:** **Replace** the invented `Player_statistics` fixtures with real-shaped files (real names and columns for all four titles, including the `by_Type`, `Battle_Types`, `Account_Statistics` and WoWP_19/20 variants), and update the tests that count files and rows. Orders fixtures gain the three extra real columns, and a synthetic multi-currency (2+ codes) set covering PAID, FAILED, NEW, gifts and bad amounts. — **Reversibility:** costly — **Reversibility rationale:** many Phase 1-4 tests and the zero-network e2e spec depend on the exact fixture file set and row counts.

**Vehicle stats (STATS-01)**
- **D-05:** A **title switcher** (WoT / Blitz / Warships / Warplanes) above **one table at a time**, using the Phase 4 selector pattern. Titles absent from the export stay in the control marked "not in this export"; a title whose files parse to zero rows says so. The default on load is the first title that has rows. — **Reversibility:** costly — **Reversibility rationale:** the aggregation shape, the worker message contract and the table component all assume one active title.
- **D-06:** Primary source per title is the **main per-vehicle file**: `WOT_Vehicle_Statistics.csv`, `WOTB_Vehicle_Statistics.csv`, `WOWS_Ship_Statistics.csv`, `WOWP_19_Plane_Statistics.csv`. These reconcile with the account totals and are the "All battles" view.
- **D-07:** A **battle-type filter** sits beside the title switcher: "All battles" (default) or one battle-type code present in that title's `*_by_Type` file. Picking a code swaps the table to that code's `by_Type` rows, with a visible note that battle-type data covers only part of the battles. Codes are labelled "Battle type N", never named. A small **battle-type summary** (battles, wins, damage per code, from `*_Battle_Types_Statistics.csv`) sits above the table. Fallout files and `WOWS_Crews`/`WOWS_Account_Storage` are recognised and counted on import but not displayed.
- **D-08:** **Warships "All battles"** shows battles only: ship, battles, last battle, in garage. Win rate and damage cells read "available per battle type" and fill in once a battle type is chosen. No guessed totals, and per-ship rows are never summed across battle types (each battle sits under two of them).
- **D-09:** **Warplanes** shows the `WOWP_19` table (named planes). `WOWP_20` has no vehicle identifier, so it appears only as "N plane records, no names in the export" with its battle totals. `N/D` and `N/A` display as "not defined" / "not available", never as 0; a win rate over 0 battles shows a dash.
- **D-10:** Default columns are a **common core with derived values**: vehicle, battles, win rate (wins ÷ battles, computed), average damage (damage ÷ battles, computed), frags, XP. Row expand or a small column picker reveals more fields the file has (survival, hit ratio, max damage, ...). Each title maps its own column names to the core, and fields a title lacks show "not in export".
- **D-11:** **Vehicle names** are the cleaned raw ID: the nation prefix (WoT `china:`) is split out into a tag and the rest is shown as written, e.g. "Ch24_Type64" with a "china" tag. No vehicle name lookup and no bundled name map. **Extras:** a name search over the cleaned ID, and the nation tag; no class filter (class codes are undocumented) and no nation filter.
- **D-12:** **Sorting and rows:** default sort is battles descending; **all rows are shown, including zero-battle garage-only vehicles**, with their count visible. Sorting is by clicking column headers. Switching title or battle type resets the sort to battles descending and clears the search (state is not remembered per title).
- **D-13:** A small **per-title header** above each table shows lifetime battles and premium expiry from that title's `*_Account_Statistics.csv` (`BATTLES_COUNT`, `PREMIUM_EXPIRES_AT`/`PREMIUM_EXPIRY_TIME`), as written. Account balances (credits, gold, free XP) stay out. This is the one small addition beyond the roadmap's wording, added at the user's request.
- **D-14:** The vehicle table is a **native `<table>`** with sortable headers and **windowed rendering** (only visible rows in the DOM) so thousands of rows scroll smoothly. Each chart and table has a **one-sentence text summary**, and charts get a collapsible monthly data table, so the numbers are reachable by keyboard and screen reader.

**Virtual-currency timeline (FINANCE-02)**
- **D-15:** **Small multiples**: one chart per currency, each with its own y-scale (credits are in millions, gold in hundreds). Currencies are ordered by row count.
- **D-16:** Only currencies above a small row-count threshold (Claude picks it) get a chart. The rest are listed as **text rows** with total deposited, total withdrawn and date range, so every currency code in the export stays visible and none is dropped. This includes the stray `UAH` code.
- **D-17:** Each chart is **monthly diverging bars**: deposits up, withdrawals down, from the first operation. Month buckets keep a decade-long log near 120 bars, and the node count scales with months, not rows.
- **D-18:** TYPE interpretation: `deposit` and `income` count as up, `withdrawal` as down. Any other TYPE, or a non-numeric `AMOUNT`, excludes the row from the charts, and the excluded count appears on screen next to the other skipped-row counts (Phase 4 D-02 pattern). Timestamps stay **as written, no timezone conversion** (Phase 4 D-01).

**Premium-time timeline (FINANCE-01)**
- **D-19:** **Monthly bars of premium days granted.** Each row's `PREMIUM` is parsed to a number of days (`N day(s)` → N; `... N sec` → N ÷ 86400), bucketed by `CREATED`. The tooltip lists the grant sizes in that month.
- **D-20:** Rows whose `PREMIUM` is not a recognisable duration are excluded from the chart, **counted on screen**, and the distinct unrecognised strings are listed in a short disclosure, so a drifted format is visible instead of silently ignored.

**Real-money spend summary (FINANCE-03)**
- **D-21:** Per currency, show the **PAID total and PAID order count**, with **FAILED and NEW counts shown as separate figures, never added in**. Only `PAY_ORDER_STATUS_CODE = PAID` counts toward a total. **No blended, converted or grand total appears anywhere**, checked against a synthetic multi-currency fixture (roadmap criterion 4).
- **D-22:** Add **per-year and per-`GAME_CODE` breakdowns** (WOT / COMMON / WOWP) inside each currency, expandable. This is a presentation of the same PAID rows, not a new data source.
- **D-23:** **Gift orders** (`IS_GIFT`, exported as `T`/`F`) are **included in the PAID total** and also shown as a **separate gift line** per currency, so the headline stays "what you paid" and matches a bank statement.
- **D-24:** **Currency display:** show the code exactly as written ("USD 1,234.56"), two decimals, **never a symbol and never converted**. Blank or non-3-letter codes group under "Unknown currency". Non-numeric amounts on PAID rows are excluded and counted on screen.

**Formatting and interaction**
- **D-25:** **Numbers:** compact (1.2M, 26.9M) on chart axes and summary tiles; **exact grouped numbers (26,986,204) in tooltips and table cells**, with the exact value also in a title/aria label wherever a compact form is shown. Grouping uses `Intl.NumberFormat` with the browser locale (no new dependency). Win rate to one decimal (55.3%). Money amounts are always exact, two decimals.
- **D-26:** **Dates:** month labels use ISO-style `YYYY-MM` on axes; tooltips show the month and the as-written date, with a note that times are "as recorded in the export" (no timezone claim).
- **D-27:** Charts **reuse the Phase 4 pieces** (`ChartTooltip`, `ChartLegend`, the palette and the contrast checks). Tooltips open on hover and on keyboard focus. Premium and currency charts share **one new hand-rolled SVG bar-chart component**; its node count scales with months, never rows.
- **D-28:** **Selector state** (title, battle type, and any chart currency choices) resets on dataset replace or Clear, so no stale selection survives (Phase 4 requirement), and is not persisted across reloads.

### Claude's Discretion
- Whether per-title, per-battle-type and per-currency aggregates are precomputed in the worker at import (on the dataset meta record) or queried on demand, as long as the worker stays the only Dexie owner and the main thread never scans raw rows (Phase 2 rule, Phase 4 pattern).
- The Dexie schema version bump and any migration for newly supported categories, following the Phase 3 D-19 / Phase 4 pattern.
- The exact row-count threshold for charting a currency (D-16), bar colours within the existing palette, window size for the table, which extra fields the row expand or column picker lists, and the exact wording of the on-screen notes and empty states.
- How the real Orders file's three extra columns (`PAY_AGGREGATOR_DESC`, `PAY_ITEM_TYPE_NAME`, `AA_PACKAGE_LIST`) are stored; they need not be displayed.
- Defensive parsing: the real column names differ per title and may drift in newer exports; parse by header name and tolerate missing columns (PROJECT.md constraint).

### Deferred Ideas (OUT OF SCOPE)
- Naming battle-type codes (needs a Wargaming spec the export does not contain).
- A vehicle name map (readable names) — a possible future build-time asset, needs a data source, licence check and upkeep.
- Account balances (credits, gold, free XP, crystal) from `*_Account_Statistics.csv`.
- Nation or class filters on the vehicle table.
- Fallout, Crews and Account_Storage displays.
- A WoT mode selector with documented mode names.
- Touch-friendly tooltips and phone-width tables — Phase 7.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATS-01 | Per-vehicle battle stats (win rate, damage, battles, etc.) across WoT, WoT Blitz, World of Warships, and World of Warplanes | Verified real headers for all four titles (Real-Export Evidence); on-demand worker query returning mapped view rows; windowed native table (Pattern 3); per-title column maps; Warplanes account-file column gap (Pitfall 9); fixture rewrite (Pitfall 3) |
| FINANCE-01 | Premium-time operations timeline | Verified `PREMIUM` string shapes (incl. trailing space, withdrawal row, `N days HH:MM:SS`); integer-seconds parsing (Pattern 5); shared bar chart (Pattern 4) |
| FINANCE-02 | Virtual-currency flow timeline | Verified columns, TYPE values, integer positive amounts; per-currency monthly BigInt sums; threshold 50 / cap 8 (UI-SPEC); bar chart node bound |
| FINANCE-03 | Real-money spend summary from `Payment_history`, totaled per currency (PAID only), never blended | Verified Orders shape (12 columns, leading-dot and 3-decimal amounts, IS_GIFT 0/1); exact decimal util (Pattern 6); invariants (breakdown sums equal headline); no-blended e2e |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extracted from `./CLAUDE.md` -> `AGENTS.md` and `/Users/you/CLAUDE.md`. The planner must verify every plan against these.

- **Privacy is the product**: zero network requests after load, enforced by Playwright and a meta CSP (`default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`). No backend, no analytics.
- **Stack locked**: Svelte 5 runes (no Svelte 4 patterns), Vite ^8, pnpm, TypeScript `~6.0.2`. **No new runtime dependency** (hard constraint, restated by UI-SPEC). Charts and tables are hand-rolled.
- **No client-side router**; single dashboard page.
- **Worker rules**: one long-lived Worker; the worker is the only Dexie owner; inside the worker use `Papa.parse({ worker: false })` and fflate `unzipSync`.
- **Chart aggregation at scale**: aggregate per bucket (month), never one SVG node per row. Verify against a synthetic large fixture, not the ~4k-row real sample.
- **Dependency minimalism**: `bits-ui` is not installed and not needed here (native `<select>`, `<details>`, `<table>`).
- **No inline `style=` / `style:`**: CSP has no `style-src 'unsafe-inline'`; `svelte/no-inline-styles` is an error. Dynamic sizes go through attributes, classes or CSSOM writes (`element.style.height = ...`) in script.
- **Commits**: do not add a `Co-Authored-By:` trailer or "Generated with Claude Code" line (project rule overrides tool reminders).
- **GSD workflow**: file edits go through a GSD command (this is research only; no source edited).
- **Untrusted text**: zip-derived strings are rendered by plain interpolation only (no `{@html}`).
- **Do not read or quote row contents from any real export**: this research used header lines and aggregate shape histograms only (see Open Question 0 and the disclosure in Sources).

## Summary

Phase 5 is an integration-heavy phase with **zero new dependencies**. Everything needed already exists in the repo: header-keyed rows stored for **every** category (so a cached Phase-4 dataset already holds `Financial_data` and all real `Player_statistics` rows), a worker that owns Dexie, a query-and-supersede client pattern (`PlaytimeClient`), pure-model-plus-thin-component conventions, a shared tooltip, an excluded-row pill and a roving-focus SVG grid (`HourGrid`) to copy. The work is (1) widening the category/section/nav plumbing from five to six sections, (2) three worker-side pure aggregators (vehicle view, premium+currency flow, spend), (3) a generic query client so three new blocks can ask the worker concurrently, (4) a windowed native table, one monthly bar chart component and a spend card list, (5) a real-shape fixture rewrite that ripples through ~8 existing test files, and (6) a CI e2e time-budget raise.

The real 2021 sample (headers and shape histograms only, read this session) surfaced several facts the CONTEXT, UI-SPEC and fixtures do not anticipate and that would each cause a visible bug: **`PREMIUM` values carry a trailing space, include a `withdrawal ... sec` row (a removal, not a grant) and one `N days HH:MM:SS` row**; **5 of the 57 PAID orders have leading-dot amounts (`.5`)** that a naive `^\d+(\.\d+)?$` rejects; **the Warplanes account files have no `BATTLES_COUNT`** (`GAMES_PLAYED` in WOWP_19, `BATTLES` in WOWP_20); **WoT `by_Type` has 9 codes while `Battle_Types` summary has 12**; and **Financial_data, Orders and vehicle files all use ISO `YYYY-MM-DD HH:MM:SS` timestamps while Phase 4 found session files use dotted `DD.MM.YYYY HH:MM`**, so every date reader must accept both shapes. The UI-SPEC's compact-number example `26.9M` is also not what `Intl` produces for 26,986,204 (it renders `27M`).

Two architecture calls need no user input and are prescribed below: **no Dexie version bump** (the `rows` store already indexes `category` and `sourceFile`; a stale `Financial_data` status in old caches is fixed by re-classifying categories when the meta record is replayed, not by wiping the user's cache), and **on-demand worker queries with an in-worker memo keyed by `importedAt`** rather than new stored aggregates (the Phase-4 stored-aggregate machinery would have to be written anyway as a backfill path for existing caches, so storing adds a second path for no first-render benefit at this data scale; the upgrade path is documented).

**Primary recommendation:** Add `Financial_data` to `SUPPORTED`/`SECTIONS`/`NAV_ORDER`/`BUILT_DASHBOARDS`, implement three pure, DOM-free worker modules (vehicle view, finance, spend) over one shared exact-decimal util, expose them through a channel-scoped generic query client (not the supersede-everything `PlaytimeClient`), render with a pure-model + thin-component split, rewrite the fixtures real-shaped with hand-derived oracle numbers, and raise the CI e2e limits in lockstep (`ci-budget.test.ts` caps the suite at 139 tests under today's limits; it is at 120).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSV parse, mojibake, row storage for Financial_data / Player_statistics / Orders | Web Worker | IndexedDB | Already done at import for every category; Phase 5 adds no parse change |
| Vehicle view-row mapping, battle-type summary, per-title header, Warplanes-20 totals | Web Worker | — | Reads raw rows; main thread must never scan raw rows (Phase 2 rule) |
| Premium-seconds parsing, monthly buckets, per-currency flow, spend sums | Web Worker | — | Raw-row scans + exact BigInt arithmetic; returns only buckets |
| Section/nav status for six sections | Main thread (pure module `dashboard-status.ts`) | Worker (category statuses at replay) | One derivation shared by nav and cards (Phase 3 D-08) |
| Sort, search, count line, window range | Main thread (pure model) | — | Operates on the already-mapped few-thousand view rows |
| Windowed table DOM, spacer heights | Browser DOM (component) | — | CSSOM writes only (CSP) |
| Bar chart geometry, roving focus, tooltip | Browser DOM + pure model | — | Node count scales with months; model is unit-testable |
| Money/number formatting, locale | Main thread (`ui-copy.ts`) | — | `Intl` is viewer-locale (D-25) |
| Category re-classification for old caches | Web Worker (`resultFromMeta`) | — | The one replay choke point (`ingest.worker.ts:229-237`) |

## Standard Stack

### Core (all existing; nothing is installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte | ^5.57.0 [VERIFIED: package.json] | UI, runes | Locked |
| Vite | ^8.3.0 [VERIFIED: package.json] | Build, module worker | Locked |
| Dexie | ^4.4.6 [VERIFIED: package.json] | IndexedDB in worker | Locked; `rows: '++id, category, sourceFile'` already serves every Phase 5 read |
| PapaParse | ^5.7.0 [VERIFIED: package.json] | CSV in worker | Locked; real files are quote-all with bare-CR terminators, already handled by Phase 2 |
| fflate | ^0.8.3 [VERIFIED: package.json] | `unzipSync` in worker | Locked |
| TypeScript | ~6.0.2 [VERIFIED: package.json]; `target: es2023` [VERIFIED: tsconfig.app.json] | Types; BigInt literals (`0n`) are legal | Locked |
| Vitest | ^5.0.2, `environment: 'node'`, no Svelte plugin [VERIFIED: vitest.config.ts, package.json] | Unit tests | Locked; components cannot be rendered in unit tests, so logic lives in pure modules |
| Playwright | ^1.63.0, chromium only [VERIFIED: package.json, playwright.config.ts] | e2e | Locked |

### Supporting (built-ins used)

| API | Purpose | Notes |
|-----|---------|-------|
| `BigInt` | Exact money and flow sums | No library; structured-clone-safe but store/transport as decimal strings (Pattern 6) |
| `Intl.NumberFormat` | Grouping, compact axis labels, money display | `format()` accepts a decimal string and uses its exact value [CITED: developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/format] |
| `Map` | All grouping by untrusted keys (currency code, vehicle name, game code) | Never plain objects (`__proto__` keys) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-worker memo + on-demand queries | Stored aggregates on `meta` (Phase 4 precedent) | Instant first paint on return visits; costs a version constant, a stale-aggregate rebuild path and a failed-aggregate path per block. Choose only if the 50k-row e2e budget (Validation Architecture) fails |
| Re-classify categories at replay | `db.version(3)...upgrade(clear)` (Phase 3 D-19 pattern) | Wipes the user's cache and forces a re-import for no data reason; Phase 3 needed the wipe because v1 held an email at rest, which is not true here |
| Sticky `th` cells in one scroller | Two synchronized tables | More DOM, worse a11y; not needed |
| Generic channel-scoped `QueryClient` | Reuse `PlaytimeClient` ×3 | `PlaytimeClient.query` supersedes **every** pending query (see Pitfall 1) |

**Installation:** none. **Version verification:** not applicable (no package is added). **Package legitimacy gate:** not applicable.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Real-Export Evidence (headers and aggregate shapes only)

Source: the local 2021 sample zip named in CONTEXT, read this session. **Only header lines and shape histograms (digits replaced) were examined or are quoted here; no row values are reproduced.** [VERIFIED: header lines and aggregate scripts run this session]

Note on the sample's physical format: data rows are fully double-quoted, header lines are unquoted, rows end in bare CR. Phase 2's parser already handles this; fixtures should reproduce at least one quote-all, bare-CR file per family.

### Headers by file (exact column names; `;` delimited)

| File | Columns used by Phase 5 (verbatim header names) |
|------|-------------------------------------------------|
| `WOT_Vehicle_Statistics.csv` | `VEHICLE_NAME`, `LAST_BATTLE_AT`, `BATTLES_COUNT`, `WINS_COUNT`, `DAMAGE_DEALT`, `FRAGS_COUNT`, `XP_AMOUNT`, `SURVIVED_BATTLES`, `HITS_COUNT`, `SHOTS_COUNT`, `FRAGS_MAX`, `XP_MAX`, `DAMAGE_RECEIVED`, `SPOTTED_COUNT` (47 columns total; `ACHIEVEMENTS` and `FRAGS` are the only columns with blank cells in the sample) |
| `WOT_Vehicle_Statistics_by_Type.csv` | `VEHICLE_NAME`, `TYPE`, `XP_AMOUNT`, `BATTLES_COUNT`, `WINS_COUNT`, `SURVIVED_BATTLES`, `FRAGS_COUNT`, `SHOTS_COUNT`, `HITS_COUNT`, `SPOTTED_COUNT`, `DAMAGE_DEALT`, `DAMAGE_RECEIVED`, `XP_MAX`, `FRAGS_MAX`, `DAMAGE_MAX` |
| `WOT_Battle_Types_Statistics.csv` | `TYPE`, `BATTLES_COUNT`, `WINS_COUNT`, `DAMAGE_DEALT` (plus others) |
| `WOT_Account_Statistics.csv` | `BATTLES_COUNT`, `PREMIUM_EXPIRES_AT` (also has `NAME`, `CREDITS`, `GOLD`, `FREE_XP`, `PREMIUM_PLUS_EXPIRES_AT` — never read) |
| `WOTB_Vehicle_Statistics.csv` | `VEHICLE_NAME`, `BATTLES_COUNT`, `WINS`, `DAMAGE_DEALT`, `FRAGS`, `XP`, `SURVIVED_BATTLES`, `HITS`, `SHOTS`, `MAX_FRAGS`, `MAX_XP`, `DAMAGE_RECEIVED`, `SPOTTED`, `LAST_BATTLE_TIME`, `IN_GARAGE` |
| `WOTB_Vehicle_Statistics_by_Type.csv` | `VEHICLE_NAME`, `TYPE`, `XP`, `BATTLES_COUNT`, `WINS`, `SURVIVED_BATTLES`, `FRAGS`, `SHOTS`, `HITS`, `SPOTTED`, `DAMAGE_DEALT`, `DAMAGE_RECEIVED`, `MAX_XP`, `MAX_FRAGS` |
| `WOTB_Battle_Types_Statistics.csv` | `TYPE`, `BATTLES_COUNT`, `WINS`, `DAMAGE_DEALT` |
| `WOTB_Account_Statistics.csv` | `BATTLES_COUNT`, `PREMIUM_EXPIRY_TIME` |
| `WOWS_Ship_Statistics.csv` | `VEHICLE_NAME`, `IN_GARAGE`, `DISTANCE`, `LAST_BATTLE_TIME`, `BATTLES_COUNT` (9 columns; no wins, no damage) |
| `WOWS_Ship_Statistics_by_Type.csv` | `VEHICLE_NAME`, `TYPE`, `EXP`, `BATTLES_COUNT`, `WINS`, `SURVIVED`, `FRAGS`, `PLANES_KILLED`, `DAMAGE_DEALT`, `MAX_EXP`, `MAX_FRAGS`, `MAX_DAMAGE_DEALT` |
| `WOWS_Battle_Types_Statistics.csv` | `TYPE`, `BATTLES_COUNT`, `WINS`, `DAMAGE_DEALT` |
| `WOWS_Account_Statistics.csv` | `BATTLES_COUNT`, `PREMIUM_EXPIRY_TIME` |
| `WOWP_19_Plane_Statistics.csv` | `VEHICLE_NAME`, `GAMES_PLAYED`, `WINS`, `TOTAL_DAMAGE_DEALT`, `TOTAL_KILLED`, `GAIN_EXPERIENCE`, `SURVIVED`, `TOTAL_HITS`, `TOTAL_SHOTS`, `MAX_DAMAGE_DEALT`, `MAX_GAIN_EXPERIENCE`, `LAST_GAME_TIME`, `IN_GARAGE` |
| `WOWP_19_Account_Statistics.csv` | **`GAMES_PLAYED`** (no `BATTLES_COUNT`), `PREMIUM_EXPIRY_TIME` |
| `WOWP_20_Plane_Statistics.csv` | `BATTLES`, `WINS`, `IN_GARAGE`, ... — **no `VEHICLE_NAME` or any vehicle identifier** (confirmed from the header) |
| `WOWP_20_Account_Statistics.csv` | **`BATTLES`**, `PREMIUM_EXPIRY_TIME` |
| `Operations_with_Premium_Days.csv` | `PREMIUM;CURR_PREMIUM;CREATED;UPDATED` |
| `Virtual_Currencies_Operations.csv` | `CREATED;CURRENCY_CODE;CURRENCY_TITLE;AMOUNT;TYPE;ORDER` |
| `Orders.csv` | `ACTION_DT;GAME_CODE;ITEM_CNT;PAYMENT_CURRENCY;PAYED_IN_CURR_AMT;IS_GIFT;ORDER_UUID;PAY_COUPON_NAME;PAY_ORDER_STATUS_CODE;PAY_AGGREGATOR_DESC;PAY_ITEM_TYPE_NAME;AA_PACKAGE_LIST` (12) |

The UI-SPEC column-mapping table matches these headers everywhere **except** the Warplanes account file (Pitfall 9).

### Aggregate shapes (digits replaced; counts only)

| Column | Shapes found (count of rows) |
|--------|------------------------------|
| `Operations_with_Premium_Days.PREMIUM` (128 rows) | `9 day` ×74, `9 days` ×31, `99 days` ×12, `deposit WOT premium_plus 99999 sec ` ×5 (**trailing space**), `deposit WOT premium_plus 999999 sec ` ×4, **`withdrawal WOT premium_plus 9 sec ` ×1**, **`99 days 99:99:99` ×1** |
| `Operations_with_Premium_Days.CREATED` / `Virtual_Currencies_Operations.CREATED` / `Orders.ACTION_DT` / WoT `LAST_BATTLE_AT` | all rows `YYYY-MM-DD HH:MM:SS` shape (ISO, dashes, colons) |
| `Virtual_Currencies_Operations.AMOUNT` (7,830 rows) | all plain non-negative integers (no sign, no decimals), at most 7 digits; TYPE `deposit` 5,646 / `withdrawal` 2,179 / `income` 5 (withdrawals are positive numbers) |
| `Orders.PAYED_IN_CURR_AMT` (102 rows) | integer ×50, 1 fraction digit ×17, 2 digits ×33, **3 digits ×2**; **7 values start with a bare dot (e.g. `.5`)**, 5 of them on PAID rows |
| `Orders.IS_GIFT` | `0` ×101, `1` ×1 (readme says `T`/`F`) |
| `Orders.GAME_CODE` | `WOT` 87, `COMMON` 14, `WOWP` 1 (upper case; the repo fixture writes lower-case `wot`) |
| `Orders` currency × status | USD PAID 36 / NEW 8 / FAILED 14; RUB PAID 8 / NEW 1; UAH PAID 13 / FAILED 12 / NEW 10 |
| WoT `by_Type` | 60 rows, 9 distinct `TYPE` codes (1,2,3,4,5,6,10,14,18); `Battle_Types` summary lists 12 (adds 11, 13, 19 per CONTEXT) |
| WoT vehicles | 268 rows, every `VEHICLE_NAME` contains `:` (nation prefix), 1 vehicle with 0 battles, no non-integer numeric cell in the whole file |
| WOWP_19 | 6 rows, `TOTAL_DAMAGE_DEALT` is `N/D` in all 6, `IN_GARAGE` is `1` in all 6 |
| Row counts | WOTB vehicles 8, WOTB by_Type 11, WOWS ships 9, WOWS by_Type 32, WOWP_19 6, WOWP_20 6 |

## Architecture Patterns

### System Architecture Diagram

```
zip (drop)                                   (unchanged Phase 1-4 import path)
   |
   v
ingest.worker: unzip -> classify (SUPPORTED now incl. Financial_data) -> parse every CSV
   |                                   -> Dexie: rows(category, sourceFile, data{header-keyed})
   |                                   -> meta{hash, importedAt, categories[], identity, playtime}
   |
   |   <== page load / return visit: check-cache -> resultFromMeta()
   |        (NEW: re-classify meta.categories with classifyFolder so an old cache's
   |         'Financial_data: unknown' becomes 'supported'; no wipe, no version bump)
   v
main thread: IngestClient.result (ClassifyResult)
   |
   +--> dashboard-status.ts: SECTIONS(6) / NAV_ORDER(7) / BUILT_DASHBOARDS -> nav + cards
   |
   +--> PlayerStats block --vehicles-query{queryId,title|null,battleType|null}--> worker
   |        ^                                                                      |
   |        |   acceptOutcome(importedAt, superseded?)                             v
   |        +------ vehicles-result{queryId,importedAt,view} <--- readRowsByFile (1 tx: meta+rows)
   |                                                              -> buildVehicleView (pure)
   |                                                              -> memo[importedAt]
   +--> PremiumBlock / CurrencyBlock / SpendBlock --finance-query{channel,...}--> worker
            (own channel => no cross-supersede)       -> buildPremium / buildCurrency / buildSpend
                                                         (pure, BigInt-exact, try/catch per part)
   |
   v
pure models (no DOM, no words): vehicle-model (sort/search/window/count), bar-chart-model
(months, pitch, geometry, keys) -> thin Svelte components -> shared ChartTooltip (+extra lines)
```

### Recommended Project Structure

```
src/lib/
├── decimal.ts                    # parseDecimalUnits / formatMoney / unitsToNumber (shared: worker + main)
├── vehicle-shared.ts             # title ids, file-name table, constants (no words)
├── finance-shared.ts             # CHART_MIN_OPS=50, CHART_MAX=8, version if ever stored
├── vehicle-model.ts              # PURE: sort, search, count line, windowRange, special-value ordering
├── bar-chart-model.ts            # PURE: month axis, pitch rule, geometry, roving-key reducer
├── vehicle-state.ts, finance-state.ts   # PURE: derive state, acceptOutcome (Phase 4 pattern)
├── query-client.ts               # generic channel-scoped client (PlaytimeClient stays as-is or wraps it)
├── worker/
│   ├── vehicle-stats.ts          # PURE: header-name column maps, buildVehicleView
│   ├── finance.ts                # PURE: parsePremium, buildPremium, buildCurrency, buildSpend
│   └── db.ts                     # + readRowsByFile(match) snapshot reader
└── components/
    ├── PlayerStats.svelte, VehicleTable.svelte, BattleTypeSummary.svelte
    ├── PremiumBlock.svelte, CurrencyBlock.svelte, MonthlyBarChart.svelte, MonthlyDataTable.svelte
    └── SpendSummary.svelte
tests/fixtures/
├── player-stats-fixtures.ts      # real-shape files + hand-derived oracle numbers
└── finance-fixtures.ts           # real-shape Financial_data + Orders + large generator
```

### Pattern 1: Section plumbing for six sections

Files and the discrete values they hold today [VERIFIED: files read this session]:

- `src/lib/worker/categories.ts:11-16` — `SUPPORTED` is `'Activity_history', 'Player_statistics', 'User_Info', 'Payment_history'`. Add `'Financial_data'`.
- `src/lib/dashboard-status.ts:39-44` — `SECTIONS` is `activity-history`, `player-statistics`, `payment-history`, `user-info`. Insert `{ id: 'financial-data', folder: 'Financial_data' }` after `player-statistics` (`SectionId` is derived from it, so the compiler finds the rest).
- `src/lib/dashboard-status.ts:64-70` — `NAV_ORDER` likewise; `src/lib/dashboard-status.ts:94` — `BUILT_DASHBOARDS = new Set<SectionId>(['activity-history'])` becomes `activity-history`, `player-statistics`, `financial-data`, `payment-history` (`user-info` stays `pending`).
- `src/lib/ui-copy.ts:210-216` — `SECTION_TITLES: Record<NavId, string>` needs `'financial-data': 'Financial_data'` (the `Record<NavId,...>` type makes omission a compile error).
- `Dashboard.svelte` renders `{#each SECTIONS}` and has a single `{#if section.id === 'activity-history'}` branch; add branches for the three new ready bodies. The `note` for non-ready sections is unchanged.

`sectionStatus` already yields `ready` when `rowCount > 0` for the folder, which **is** D-02's "ready if either file has rows" for `Financial_data` (the sum of both files). No new status logic is needed for the section; sub-block states are the blocks' own.

### Pattern 2: Query channel, snapshot read, importedAt pairing (copy Phase 4)

Phase 4's contract (read this session): requests carry their own `queryId` namespace, results echo `importedAt`, the client `acceptOutcome` rejects a stale or foreign dataset, and a bug in an aggregate becomes a block `error` state, not a lost import. Reuse all of it. Two changes are required, both because Phase 5 has **several concurrent blocks**:

1. **Generic, channel-scoped client.** `PlaytimeClient.query` calls `#supersedePending()` which resolves *every* pending query as `superseded` (`playtime-client.ts:132-165`). Three blocks mounting in the same tick would supersede each other and two would sit in `loading` forever. Build a small `QueryClient` where supersede is per `channel` (`'vehicles'`, `'premium'`, `'currency'`, `'spend'`) and the `queryId` counter is shared so routing by id alone is unambiguous. Keep `playtime-*` messages untouched (existing tests assert them); add new request/response variants to the `IngestRequest`/`IngestResponse` unions (`worker-messages.ts:205-233`) and one more delegation branch at the top of `IngestClient.#handle` next to the existing one (`worker-client.svelte.ts:527-528`). Also route the new client through `failPending` in the `onerror`/`onmessageerror` handlers (`worker-client.svelte.ts:207`, `:223`).
2. **One snapshot reader in `db.ts`.** Follow `readSessionRowData` (`db.ts:241-281`): one `'r'` transaction over `rows` and `meta`, read `meta.importedAt` and the rows together, answer with *that* `importedAt`. Use the documented index-only walk `orderBy('sourceFile').uniqueKeys()`, match keys by a **lower-cased exact file-name table**, then one single-key `where('sourceFile').equals(key)` per match, then keep rows whose `category` matches case-insensitively. Never use `anyOf`/multi-key (`db.ts:216-224` records 2,243 ms on 3,000 rows). A folder spelled `player_statistics` classifies as supported, so compare categories lower-cased.

Memo: `let memo: { importedAt: string; ... } | null` per query kind in the worker module; hit when `snapshot.importedAt` equals memo's; clear in `handleClearData` and after a successful ingest. Because the key is the snapshot's own `importedAt`, a replace can never serve old numbers.

### Pattern 3: Windowed native table

Pure function (unit-test it in Node; the component only wires it):

```ts
// Source: derived from UI-SPEC section 3 geometry (row 40px, overscan 6); pure, no DOM
export const ROW_PX = 40;
export function windowRange(scrollTop: number, viewportPx: number, total: number, overscan = 6) {
  const first = Math.max(0, Math.floor(scrollTop / ROW_PX) - overscan);
  const last = Math.min(total, Math.ceil((scrollTop + viewportPx) / ROW_PX) + overscan);
  return { first, last, padTopPx: first * ROW_PX, padBottomPx: (total - last) * ROW_PX };
}
```

Component rules: one passive `onscroll` handler coalesced with `requestAnimationFrame` writing `scrollTop` into `$state`; read `clientHeight` on mount, scroll and `window` resize (no `ResizeObserver` needed: max-height is fixed). Spacer `<tr aria-hidden="true">` heights and the table `minWidth` are written in an `$effect` via `el.style.height = ...` (the same CSSOM channel `ChartTooltip` uses at `ChartTooltip.svelte:118-119`). Each rendered row has `aria-rowindex = i + 2` (header is 1) and the table has `aria-rowcount = total + 1`. Use `table-layout: fixed`, `border-collapse: separate; border-spacing: 0` (sticky cells and collapsed borders interact badly `[ASSUMED]`), put `position: sticky` on the `th`/`td` cells, not on `thead`/`tr` `[ASSUMED: broadest browser behaviour]`, and keep every row exactly 40px (`white-space: nowrap`, ellipsis, explicit `height`/`line-height`): a single wrapping cell breaks the fixed-height arithmetic and the window drifts. On sort, search or title change set `scroller.scrollTop = 0` so a shrunken list cannot leave `scrollTop` past the end.

### Pattern 4: One shared monthly bar chart

Model (pure, no words): month index `m = year*12 + (month-1)`; axis from first to last usable month inclusive, empty months drawn; `pitch = [16,12,8,4].find(p => months*p <= 576) ?? 4`; if `months > 144` keep 4 and scroll. Domain `[0, M]`, one linear scale per chart, `max(2px)` for non-zero. Copy `HourGrid`'s interaction skeleton (read this session): one delegated `onpointerover`/`onpointerout` pair on the `<svg>` (not per node; `pointerout` + `relatedTarget` guard to stop flicker), `onfocusin`/`onfocusout`, roving `tabindex` (one stop), `await tick()` before `node.focus()`, instant scroll correction (`scrollClear` from `focus-clear.ts` and the `documentElement.style.scrollBehavior` suspend/restore pattern at `HourGrid.svelte:267-274`), fixed `width`/`height` attributes and **no `viewBox`** (text must stay 14px). Tooltip anchor element is the second `onTip` argument so `ChartTooltip.isStale` works. Node budget `3 × months + 40` (hit rect + at most two bars per month).

`ChartTooltip` change: add `extra?: readonly string[]` to the request type and render `{#each}` Caption lines after `line-two`. `TooltipRequest` is defined in `playtime-model.ts:824-831` (`anchor`, `line1`, `line2`); add the optional field there so the Phase 4 callers compile unchanged. `ChartLegend` is **not** reused (UI-SPEC; it is the Less-to-More ramp legend, `ChartLegend.svelte:1-60`); copy its chrome for the two-swatch flow legend.

### Pattern 5: Premium parsing in integer seconds

Store seconds, not fractional days: `999999 sec` is 11.574... days, and float sums drift. Convert to days only for display.

```ts
// Source: aggregate shapes verified this session; anchored, bounded patterns (no ReDoS)
const DAYS_RE = /^(\d{1,9}) days?$/;
const DAYS_CLOCK_RE = /^(\d{1,9}) days? (\d{1,2}):(\d{2}):(\d{2})$/;
const OP_SEC_RE = /^(deposit|withdrawal) \S{1,32} \S{1,32} (\d{1,12}) sec$/;
export type PremiumParse =
  | { kind: 'grant'; seconds: number }
  | { kind: 'removal' }          // a `withdrawal ... sec` row: not a grant (Open Question 1)
  | { kind: 'unrecognised' };
export function parsePremium(raw: string | undefined): PremiumParse {
  const t = (raw ?? '').trim();               // the sample has trailing spaces
  if (t.length === 0 || t.length > 200) return { kind: 'unrecognised' };
  let m = DAYS_RE.exec(t);
  if (m) return { kind: 'grant', seconds: Number(m[1]) * 86400 };
  m = DAYS_CLOCK_RE.exec(t);
  if (m && Number(m[2]) < 24 && Number(m[3]) < 60 && Number(m[4]) < 60)
    return { kind: 'grant', seconds: Number(m[1]) * 86400 + Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]) };
  m = OP_SEC_RE.exec(t);
  if (m) return m[1] === 'deposit' ? { kind: 'grant', seconds: Number(m[2]) } : { kind: 'removal' };
  return { kind: 'unrecognised' };
}
```

Month from `CREATED`: reuse `parseSessionTimestamp` (`worker/playtime.ts:150-175`; accepts `YYYY-MM-DD HH:MM:SS` **and** dotted day-first, range-checks, builds no `Date`) then `civilFromDays(Math.floor(seconds/86400))` from `civil-date.ts:75-85`. An unparseable `CREATED` cannot be bucketed: exclude and count it (Open Question 2). Per-month tooltip data: a `Map<seconds, count>` per month, shipped as at most 4 `[sizeSeconds,count]` pairs plus `moreSizes`.

### Pattern 6: Exact decimal arithmetic (money and currency flow)

Fixed scale 6 (micro-units) as `bigint`; amounts with more than 6 fraction digits are treated as non-numeric (excluded and counted). Cross the message boundary as decimal **strings** (JSON/IDB-safe, no BigInt serialization question); convert to `Number` only for bar heights.

```ts
// Source: shapes verified this session — note leading-dot amounts like ".5" are real PAID data
export const SCALE = 6;
const DEC_RE = /^([+-]?)(\d+(?:\.\d*)?|\.\d+)$/;
export function parseDecimalUnits(raw: string | undefined): bigint | null {
  const t = (raw ?? '').trim();
  if (t.length === 0 || t.length > 40) return null;
  const m = DEC_RE.exec(t);
  if (m === null) return null;
  const [intPart = '', frac = ''] = m[2]!.split('.');
  if (frac.length > SCALE) return null;
  const units = BigInt((intPart === '' ? '0' : intPart) + frac.padEnd(SCALE, '0'));
  return m[1] === '-' ? -units : units;
}
// Display: round half away from zero ONCE to 2 decimals, then let Intl group it.
export function formatMoneyAmount(units: bigint, locale?: string): string {
  const neg = units < 0n;
  const cents = ((neg ? -units : units) + 5000n) / 10000n;       // 10^SCALE-2 = 10^4 per cent
  const text = `${neg && cents > 0n ? '-' : ''}${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(text as unknown as number);
}
```

(The `as unknown as number` is the TS 6 lib typing gap if `format(string)` is not in the installed lib typings; verify with `pnpm run check`.) Verified in Node 26.10 this session: `format('1234.565')` -> `1,234.57`, `format('-1234.565')` -> `-1,234.57`, `format('0.005')` -> `0.01`. Safari/old-browser behaviour for string input is `[ASSUMED]`; the degradation is a float coercion that is still correct at two decimals for any realistic total.

Currency code groups: `^[A-Za-z]{3}$` else `Unknown currency` (UI-SPEC). Never case-fold. Group with `Map<string, ...>`.

Currency charting rule (UI-SPEC decided): >= 50 usable operations, at most 8 charts, order by operation count descending then code in plain code-unit order; everything else in "Other currencies".

### Pattern 7: Vehicle view builder (on demand, header-name driven)

Anchored, case-insensitive **exact file-name table** (the `sessionFileNameGame` precedent, `worker/playtime.ts:233-238`, exists because a prefix test conflates `WOT_` with `WOTB_` and `WOT_Fallout_`):

| Title | main | by_Type | battle types | account |
|-------|------|---------|--------------|---------|
| WoT | `wot_vehicle_statistics.csv` | `wot_vehicle_statistics_by_type.csv` | `wot_battle_types_statistics.csv` | `wot_account_statistics.csv` |
| Blitz | `wotb_vehicle_statistics.csv` | `wotb_vehicle_statistics_by_type.csv` | `wotb_battle_types_statistics.csv` | `wotb_account_statistics.csv` |
| Warships | `wows_ship_statistics.csv` | `wows_ship_statistics_by_type.csv` | `wows_battle_types_statistics.csv` | `wows_account_statistics.csv` |
| Warplanes | `wowp_19_plane_statistics.csv` | — | — | `wowp_19_account_statistics.csv` (`wowp_20_*` used only for the 20-note) |

Each core/extra field is `{ key, header: string[] }` with accepted spellings matched on `trim().toUpperCase()` (same normalisation as `headerKey`, `worker/playtime.ts:300-302`; resolved from the first row's keys so ragged rows cannot change the mapping). Numeric cell classes: finite integer or decimal -> number; `N/D` -> `nd`; `N/A` -> `na`; blank or unparseable -> `na` (never 0); missing column -> `missing`. The answer carries: an overview of all four titles (present, vehicle-row count) so the Game select can print suffixes, the applied `title` and `battleType` (null in -> worker picks the default; the Phase 4 "applied index" idea), the battle-type code list from by_Type (numeric ascending), the battle-type summary rows, the per-title header cells **as written**, the WoWP_20 record count and battle sum, and the view rows. The account file is read for **named columns only** (`NAME` is the nickname: Phase 3 D-21), enforced by a canary test.

### Anti-Patterns to Avoid

- **Reusing `PlaytimeClient` for concurrent blocks** (Pitfall 1).
- **Plain-object grouping by untrusted keys** (`{}[currencyCode]`): a currency code, vehicle name or game code of `__proto__` corrupts the aggregate. Use `Map`.
- **`startsWith('WOT')` file matching** (conflates `WOTB_`, `WOT_Fallout_`).
- **`Number` accumulation of money** (floats) or `parseFloat` on amounts.
- **Reading all Player_statistics rows for every title switch** when four single-key file reads suffice.
- **A `style` attribute or `style:` directive anywhere** (CSP + lint guard).
- **Putting `NAME`, `ORDER_UUID`, `PAY_COUPON_NAME`, `PAY_AGGREGATOR_DESC` or `AA_PACKAGE_LIST` into any message, DOM string, attribute, `title` or test id.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wall-clock timestamp parsing | A new regex pair | `parseSessionTimestamp` + `civilFromDays` (already range-checking, ISO and dotted) | Phase 4 already fixed the day-first trap (T-04-28); a second parser would drift |
| Grouped / compact / locale numbers | Manual comma insertion | `Intl.NumberFormat` (viewer locale; `format(decimalString)` for exact money) | Locale correctness; no dependency (D-25) |
| Tooltip placement | New tooltip | Existing `ChartTooltip` + `clampTooltip` (`playtime-model.ts`), extended with `extra` lines | One shared element (UI-SPEC section 8) |
| Roving focus + scroll-clear | New key handling | The `HourGrid` skeleton and `scrollClear` (`focus-clear.ts`) | Several subtle fixes already baked in (smooth-scroll suspend, tooltip stale anchor) |
| Excluded-row pill | New pill | `ExcludedNotice` generalised (props: pill text, explanation, `testId`) | Same chrome, never renders at zero |
| Stale-answer rejection | New logic | The `acceptOutcome` / `derive*State` pattern in `playtime-state.ts` | Pure, unit-testable, already covers replaced/cleared datasets |
| Money rounding | `toFixed(2)` on a Number | BigInt units + one half-away rounding (Pattern 6) | `toFixed` rounds the binary double (e.g. `1.005` -> `1.00`) |
| Window virtualisation library | A package | `windowRange` + spacer rows (Pattern 3) | Constraint: no new dependency; fixed 40px rows make it ~10 lines |
| Sticky-table library | A package | CSS `position: sticky` on cells | Same |

**Key insight:** every hard part (stale answers, supersede, day-first dates, roving focus, CSP-safe geometry, excluded counts) was already solved once in Phase 4 and has tests; Phase 5's risk is in the *differences* (concurrency, exact decimals, real-shape quirks), not in new mechanisms.

## Common Pitfalls

### Pitfall 1: Concurrent blocks supersede each other
**What goes wrong:** Three new blocks issue queries on mount through `PlaytimeClient`; each `query()` resolves all earlier pending ones as `superseded`, which `acceptOutcome` drops, so two blocks stay on `loading` forever (no error, no timeout).
**Why:** `#supersedePending()` clears the whole map (`playtime-client.ts:132-165`), by design for one selector. Separate instances would also collide: each starts `queryId` at 1 and `IngestClient.#handle` routes by message type to a single client.
**Avoid:** channel-scoped supersede + shared id counter (Pattern 2); a unit test that issues one query per channel in the same tick and asserts all three resolve `result`.
**Warning signs:** a block stuck in `loading` only when another block is on screen.

### Pitfall 2: Old caches classify `Financial_data` as `unknown`
**What goes wrong:** A user with a Phase-4 cache reloads; `meta.categories` still says `Financial_data: unknown`, so the new section reads "Not in this export" and the folder shows under "Not yet supported", although its rows are stored (`ingest.worker.ts:300-371` parses every category regardless of status).
**Avoid:** in `resultFromMeta` (`ingest.worker.ts:229-237`, the one replay choke point used by `cache-status` and `duplicate`) map `status: classifyFolder(c.name)` and re-sort with the same comparator `analyzeExport` uses (extract it from `classify.ts:371-382`; supported first, lower-case code-unit order, raw tie-break). No Dexie `version(3)`; if one is ever added, **keep** the `version(2)` block with its upgrader (rule 1 in the `db.ts:103-114` comment). Add a worker test that seeds a meta record with the old status and asserts the replay says `supported`. Note `counts` is recomputed from `meta.categories` (`recomputeStatusCounts`), so remap *before* it.

### Pitfall 3: The fixture rewrite ripples
**What goes wrong:** Replacing the four invented Player_statistics files and adding `Financial_data` changes `SAMPLE_FILE_COUNTS`, `SAMPLE_ROW_COUNTS`, `SAMPLE_EXPECTED_COUNTS` (`supported: 4` -> 5), and `SAMPLE_BADGE_ORDER`'s alphabetical position of `Financial_data` (2nd: `Activity_history, Financial_data, Payment_history, Player_statistics, User_Info`).
**Concrete dependants** [VERIFIED: grep this session]:
- `SAMPLE_BADGE_ORDER.slice(4)` is the unsupported list in `tests/e2e/persistent-dataset.spec.ts:75`, and `SAMPLE_BADGE_ORDER[4]..[7]` in `tests/e2e/import-flow.spec.ts:74-77` -> become `slice(5)` and `[5]..[8]`.
- `tests/unit/classify.test.ts:157-172, 451-465` (counts, order), `tests/unit/ingest-worker.test.ts:333-335, 803` (row counts per category, badge length), `tests/unit/dashboard-status.test.ts:69` (`['Player_statistics','supported',3,8123]`) and `:148-202, :249` (built-set and pending assertions).
- `SCALE_ROW_TEMPLATES` (`export-fixtures.ts:811-864`) names the four invented `*_stats.csv` files; the 10x scale export (`buildScaleExport`, 60 files) must be updated with the real file names or it keeps importing invented files.
- `tests/e2e/dashboard.spec.ts`: `SUPPORTED_IDS`/`SECTIONS_BY_ID` (`:79-97`), the `(sections-pending)` test (`:170-215`) — it asserts `data-status` `pending` for Player_statistics and Payment_history, asserts **no `button, details` in any section card** (`:199`), and `.not.toContainText(/world of tanks|\bwot\b/i)` on Player_statistics (`:213`); all three must change. `:793` `toHaveCount(2)` for `[aria-live]` -> 3 (UI-SPEC; only true when Player_statistics is `ready`, which the sample is). `:761` uses `SUPPORTED_IDS.length + 1`.
- `tests/e2e/scroll-nav.spec.ts:111-113` counts nav links from `NAV_ORDER` (auto), and its comments say "five".
**Decision:** add `Financial_data` to the shared sample (it keeps the sample a faithful full export) and re-derive the two slice offsets from a count rather than literals. The Phase 4 session fixtures (`sessions-fixtures.ts`, `playtime-real-shape-fixture.ts`) build their own zips with `zipSync` and are **not** affected (verified: they import only constants from `export-fixtures.ts`).
**Fixture-shape rules:** real header names; quote-all cells and bare-CR in at least one file per family; upper-case `GAME_CODE` and `0`/`1` `IS_GIFT`; leading-dot and 3-decimal amounts; `N/D` damage in WOWP_19; `NAME` in every account file set to a canary (e.g. a distinctive nickname) that tests assert never reaches a message, attribute, tooltip or the page text outside the identity header.

### Pitfall 4: Premium rows that look like grants but are not
**What goes wrong:** D-19 says `... N sec` -> N/86400. The sample has `withdrawal WOT premium_plus 9 sec ` (premium *removed*). Counting it as "granted" overstates the chart; also all `deposit ... sec` strings end in a space, so an untrimmed anchored regex excludes **all nine** deposit rows; and `99 days 99:99:99` is excluded as unrecognised unless parsed.
**Avoid:** `trim()` first; treat only `deposit` and bare `N day(s)` (and `N days HH:MM:SS`) as grants; `withdrawal` rows excluded and counted, listed in the unrecognised disclosure (Open Question 1). Fixture must include all seven shapes plus junk.

### Pitfall 5: Leading-dot amounts
**What goes wrong:** `^\d+(\.\d+)?$` excludes `.5`-style amounts; 5 real PAID orders would be silently dropped from a total (and the "excluded" pill would misreport).
**Avoid:** the Pattern 6 regex. Unit-test `.5`, `5.`, `5`, `5.250`, `-3`, `1e3` (reject), `1,5` (reject), `` (reject), 41-char strings (reject), 7 fraction digits (reject).

### Pitfall 6: Compact-number example is wrong
`Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })` formats 26,986,204 as `27M` in Node 26.10 (verified this session), not `26.9M` as D-25/UI-SPEC show. 26.986 rounds to 27.0. Test expectations must be computed from the formatter (or use a value like 26,100,000 -> `26.1M`), not copied from the spec example; negative gives `-27M` (axis label uses the real minus per UI-SPEC: format the magnitude and prefix `−`).

### Pitfall 7: Moving `formatNumber` to the viewer locale
`formatNumber` is `n.toLocaleString('en-US')` (`ui-copy.ts:549-551`). D-25 and the UI-SPEC decision move it to the viewer locale. Verified this session: with `LC_ALL=de_DE.UTF-8` Vitest picks the OS locale and **1 test already fails today** (`formatImportSummary`, because `formatRowCount`/`formatSkippedRowCount` already use unpinned `toLocaleString()`). After the move, every grouped-number literal becomes locale-sensitive.
**Affected tests** [VERIFIED: grep]: `tests/unit/ui-copy.test.ts` lines 203 (already), 469, 470, 484, 600, 651, 662, 668, 722 (plus the context near 900); e2e `tests/e2e/playtime-scale.spec.ts` imports `formatNumber` and runs it **in Node** against text the **browser** rendered (lines ~386, 394, 597) and `tests/e2e/persistent-dataset.spec.ts:417` compares `toLocaleString()` on both sides.
**Avoid:** `formatNumber(n, locale?)` with a module-level default that is `undefined` (viewer) and is pinned to `'en-US'` for tests via `tests/unit/setup.ts` (the file already runs before every unit test file) — internal composers (`formatHours`, `formatSessionCount`, `formatExcludedPill`, ...) then need no signature change. For e2e set `use: { locale: 'en-US' }` in `playwright.config.ts` (browser side; default is `[ASSUMED]` en-US) and make Node-side expectations call the formatter with `'en-US'` explicitly. Also fold `formatRowCount`/`formatSkippedRowCount` into the same rule.

### Pitfall 8: ExcludedNotice has a hard-coded test id and strings
`ExcludedNotice.svelte` renders `data-testid="playtime-excluded"` and the Phase 4 explanation (`ExcludedNotice.svelte:36-39`); Phase 4 e2e specs target that id (`playtime-real-shape.spec.ts:103,225,243,260`, `uat-criteria.spec.ts:85`, `playtime-scale.spec.ts:397`). Generalise with props `pill`, `explanation`, `testId` **defaulting to the Phase 4 values**, so no Phase 4 call site or spec changes. `formatExcludedPill` stays the Phase 4 string function; add `formatPremiumExcludedPill`, `formatOperationExcludedPill`, `formatPaidExcludedPill` beside it.

### Pitfall 9: Warplanes account header columns (spec gap)
UI-SPEC D-13 names `BATTLES_COUNT` for the lifetime-battles figure. Verified headers: `WOWP_19_Account_Statistics` has **`GAMES_PLAYED`**, `WOWP_20_Account_Statistics` has **`BATTLES`**; both use `PREMIUM_EXPIRY_TIME`. With only `BATTLES_COUNT` the Warplanes header would always read `not in export`. Use a spelling list `['BATTLES_COUNT','BATTLES','GAMES_PLAYED']` for the battle figure and source the Warplanes header from the WOWP_19 account file (the table shown is WOWP_19), falling back to WOWP_20 only when WOWP_19 has none.

### Pitfall 10: Battle-type codes differ between the select and the summary
WoT `by_Type` has 9 codes; `Battle_Types` has 12. The select lists only codes with `by_Type` rows (UI-SPEC); the summary lists all 12. A summary row whose code is not selectable is expected, not a bug; do not add selectable options from the summary.

### Pitfall 11: CI e2e budget will be exceeded
`tests/unit/ci-budget.test.ts` computes `E = 330 + 5 × (L − 91) + 120` (`PRE_PHASE_TEST_COUNT = 86`, `SCALE_SPEC_TEST_COUNT = 5`) and requires `globalTimeout ≥ 1.3 × E`, `wrapper ≥ globalTimeout + 90 s`, `job ≥ wrapper + 300 s`. Today: `playwright test --list` reports **120** tests (run this session); `globalTimeout` is 15 min (900 s); wrapper `timeout 17m` (`ci.yml:116`); job `timeout-minutes: 25` (`ci.yml:34`). Max passing `L` under today's limits is **139** (L=139 -> E=690 -> 897 ≤ 900; L=140 -> 903.5 > 900). Phase 5 will add more than 19 e2e tests unless consolidated. If raised to a 20-minute global (1,200 s): `L ≤ 185`, wrapper must be ≥ 1,290 s (`timeout 22m`), job ≥ 1,620 s (`timeout-minutes: 28`). Change `playwright.config.ts`, `ci.yml` (two places) together, or prefer fewer, serial-describe specs with one shared import (the `playtime-scale.spec.ts` pattern), which also keeps the wall-clock down.

### Pitfall 12: Nav height depends on scrollbar presence
Six links make the nav overflow at the 720px column on desktop (UI-SPEC delta 6). `--nav-offset: 72px` (`app.css`) assumes a stable nav height. A classic (non-overlay) horizontal scrollbar adds roughly its thickness to an `overflow-x: auto` box with auto height `[ASSUMED]`, which would put anchors and the scroll-spy band off by that much on platforms with classic scrollbars; Playwright headless Chromium hides scrollbars, so CI cannot see it. Prefer `scrollbar-width: none` on the nav (still scrollable, current link kept visible by the nav's own `scrollLeft`), or measure `offsetHeight` at both widths in the existing "(phone-375)" test style (`scroll-nav.spec.ts:360-367` already asserts height independence between 375 and 1280).

### Pitfall 13: Untrusted strings
Vehicle IDs, currency codes/titles, game codes, battle-type codes and unrecognised premium strings are all zip-derived. Plain interpolation only; clamp each distinct stored string to 200 characters in the worker; list at most 20 unrecognised strings (UI-SPEC) and track at most ~50 distinct ones; group with `Map`; never concatenate them into selectors or `data-*` that app code reads back.

### Pitfall 14: Different date shapes per file
This sample's Financial_data, Orders and vehicle files are ISO; Phase 4 found session files are dotted day-first in the same export family. Do not assume one shape per export; reuse `parseSessionTimestamp`. A date outside the parser is an excluded-and-counted row (not an exception, not bucket 0).

### Pitfall 15: Hit-test scroll position after list shrinks
When search narrows a 5,000-row list, a stale `scrollTop` beyond the new height renders an empty window. Reset `scrollTop` on every list change (Pattern 3) and clamp in `windowRange` (`first ≤ total`).

## Code Examples

### CSSOM write for a spacer row (CSP-safe)
```svelte
<!-- Source: pattern from ChartTooltip.svelte:118-119 (element.style.left = ...) -->
<script lang="ts">
  let topSpacer = $state<HTMLTableRowElement | null>(null);
  $effect(() => {
    if (topSpacer !== null) topSpacer.style.height = `${range.padTopPx}px`;
  });
</script>
<tr bind:this={topSpacer} aria-hidden="true"><td colspan={columns.length}></td></tr>
```

### Generic channel-scoped client (shape only)
```ts
// Source: adapted from playtime-client.ts; the change is supersede scope + shared ids
export class QueryClient<TReq extends { queryId: number }, TOut> {
  #pending = new Map<number, { channel: string; resolve: (o: Outcome<TOut>) => void }>();
  #next = 0;
  query(channel: string, build: (queryId: number) => TReq): Promise<Outcome<TOut>> {
    const queryId = ++this.#next;
    for (const [id, p] of this.#pending) {
      if (p.channel === channel) { p.resolve({ kind: 'superseded', queryId: id }); this.#pending.delete(id); }
    }
    // post(build(queryId)); fast-fail 'worker unavailable' / 'post failed' exactly like PlaytimeClient
    // ...
  }
}
```

### Category re-classification at replay
```ts
// Source: ingest.worker.ts:229-237 (resultFromMeta) — the one replay path
function resultFromMeta(meta: DatasetMeta): ClassifyResult {
  const categories = sortCategoryEntries(
    meta.categories.map((c) => ({ ...c, status: classifyFolder(c.name) })),
  );
  return { accountRoot: meta.accountRoot, categories,
           counts: recomputeStatusCounts(categories), importedAt: meta.importedAt,
           identity: meta.identity ?? null };
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `Number` parse of numeric strings | `Intl.NumberFormat.format(string)` exact-decimal input (Baseline widely available per MDN) [CITED: MDN NumberFormat.format] | Exact two-decimal display of BigInt-derived strings |
| Table virtualisation libraries | Fixed-row-height window + spacer rows | No dependency; ~10 lines of pure math |
| Wiping a cache to migrate | Re-derive derived fields at replay | No data loss for a status-only change |

**Deprecated/outdated:** none relevant (TypeScript stays `~6.0.2`; TS 7 not adopted per AGENTS.md).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Safari/older browsers coerce `format(string)` to a float (still fine at 2 decimals) | Pattern 6 | Slight rounding differences at >15 significant digits only |
| A2 | Sticky on `th`/`td` cells (not `thead`/`tr`) with `border-collapse: separate` is the broadest-working form | Pattern 3 | Header or first column fails to stick in one browser; Playwright (Chromium) check required, Safari/Firefox are best-effort per AGENTS.md |
| A3 | A classic horizontal scrollbar adds height to the auto-height nav | Pitfall 12 | `--nav-offset` off by scrollbar thickness on Windows; fix is cheap (`scrollbar-width: none`) |
| A4 | Playwright's default context locale is `en-US` | Pitfall 7 | Unpinned dev-machine runs fail grouped-number assertions; fix is to pin `locale` in config (recommended regardless) |
| A5 | Reading 50k-100k small rows from IndexedDB in the worker takes a few hundred ms | Standard Stack / alternatives | If the 50k-row e2e budget fails, switch to stored aggregates (documented path) |
| A6 | `N days HH:MM:SS` is a premium grant of that length | Pattern 5 | One extra row mis-bucketed vs excluded; trivial |
| A7 | `withdrawal ... sec` premium rows must not count as grants | Pitfall 4, Open Question 1 | Chart overstated by that row (needs user confirmation) |
| A8 | Newer or other-region exports keep these header names | Pattern 7 | Mitigated by header-name mapping and `not in export`; cannot be verified from a 2021 sample |
| A9 | Blitz/Warships/Warplanes vehicle IDs may or may not carry a `nation:` prefix (only WoT's was verified) | Pattern 7 | Split only when a `:` exists; no tag otherwise (D-11 rule is generic) |
| A10 | Component-level behaviour (windowing, roving focus) can only be proven in Playwright; unit tests cover the pure models and source contracts | Validation Architecture | Matches the repo's established approach (Phase 4 04-09 decision in STATE.md) |

## Open Questions

0. **Disclosure about real-export reads.** While extracting header lines, one command printed a whole file to my tool output because the sample uses bare CR (no LF), so `head -1` returned everything; that output was vehicle rows (identifiers and counts). Nothing was written to this repo or quoted; the persisted tool-result file was deleted. All values reported above come from subsequent header-only and shape-histogram scripts. The caller may want to note this for the user.

1. **Do `withdrawal ... sec` premium rows count as "premium days granted"?**
   - What we know: the sample has exactly one such row, and D-19 literally says `... N sec` -> N/86400.
   - What's unclear: whether the user wants a signed chart or grants only.
   - Recommendation: grants only (`deposit`, `N day(s)`, `N days HH:MM:SS`); count the withdrawal in the excluded pill and list it in the unrecognised disclosure. Needs a one-line user confirmation (it is a locked-decision refinement).

2. **Rows whose date cannot be parsed (premium `CREATED`, currency `CREATED`).**
   - What we know: they cannot be bucketed; the approved pill explanations name only unknown type, non-numeric amount, or unrecognised duration.
   - Recommendation: exclude and count in the same pill and extend the explanation copy by one clause ("... or an unreadable date"); copy wording is in Claude's discretion per CONTEXT, but the approved UI-SPEC string changes, so flag it for the plan checker.

3. **Compact-number example.** `26.9M` in D-25/UI-SPEC is not what the specified `Intl` options produce (`27M`). Recommendation: keep the specified options, fix examples/tests.

4. **Where `Financial_data` lives in the shared sample** (Pitfall 3 decision: in the sample). If the plan prefers a smaller blast radius, a separate builder via `buildCustomExport` overrides avoids touching the count/order constants but leaves the nav/status tests exercising an export with no Financial_data.

5. **Stored aggregate vs on-demand.** On-demand + memo is prescribed; revisit only if the 50k-row budget fails.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, Vitest | yes | v26.10.0 | — |
| pnpm | scripts | yes | 12.6.0 | — |
| Playwright + Chromium | e2e | yes (browsers present locally) | 1.63.0 (chromium-1243) | CI runner; `playwright test --list` is the sandbox-safe check |
| `fake-indexeddb` | worker unit tests | yes (devDependency) | ^6.2.5 | — |
| Real 2021 sample zip | evidence only | yes (local, never committed) | — | Header facts are recorded in this document |

**Missing dependencies with no fallback:** none. **Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.2 (`environment: 'node'`, no Svelte plugin, `fake-indexeddb`) + Playwright 1.63 (chromium, `vite build && vite preview` web server) |
| Config file | `vitest.config.ts`, `playwright.config.ts`, `tests/unit/setup.ts` |
| Quick run command | `pnpm exec vitest run tests/unit/decimal.test.ts tests/unit/finance.test.ts tests/unit/vehicle-stats.test.ts tests/unit/vehicle-model.test.ts tests/unit/bar-chart-model.test.ts tests/unit/ui-copy.test.ts tests/unit/dashboard-status.test.ts` (baseline for the last two: 141 tests in ~0.15 s) |
| Full suite command | `pnpm run lint && pnpm run check && pnpm run test:unit && pnpm exec playwright test` (config `test_command`: `pnpm run test:unit && pnpm exec playwright test`) |

Components cannot be rendered in unit tests (no jsdom, no Svelte plugin). Logic therefore lives in pure modules; component contracts are asserted as **source contracts** (read the `.svelte` off disk, strip comments, assert roles, test ids, prohibitions such as no `{@html`, no `style=`, no per-node listener, no `viewBox`; assert the file exists first) — the 04-09 technique in `tests/unit/playtime-charts.test.ts` — plus Playwright for behaviour.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATS-01 | Header-name column maps for all four titles; special values (`N/D`,`N/A`, blank, missing) never 0 and sort last; win rate / avg damage derivation and zero-battle dash; WoWS all-view is battles-only; WOWP_20 note totals; exact file-name table (no `WOT_`/`WOTB_` conflation); nation split | unit | `pnpm exec vitest run tests/unit/vehicle-stats.test.ts` | Wave 0 |
| STATS-01 | Sort (default battles desc, plain code-unit tie-break, direction rule), search, count line, `windowRange` bounds incl. empty and shrunken list | unit | `pnpm exec vitest run tests/unit/vehicle-model.test.ts` | Wave 0 |
| STATS-01 | `vehicles-query` round trip through the real worker; stale `importedAt`; clear; absent title; header reads named columns only (NAME canary) | unit | `pnpm exec vitest run tests/unit/ingest-worker.test.ts` | extend |
| STATS-01 | Title switcher, battle-type filter, row bound (<= 30 `vehicle-row` on a 5,000-vehicle fixture, `aria-rowcount` = 5,001), first row after each sort, state reset on replace/Clear, 375px no page h-scroll | e2e | `pnpm exec playwright test tests/e2e/vehicle-stats.spec.ts` | Wave 0 |
| FINANCE-01 | `parsePremium` on all seven shapes + junk; trailing space; months bucketed from ISO and dotted `CREATED`; unrecognised list capped | unit | `pnpm exec vitest run tests/unit/finance.test.ts` | Wave 0 |
| FINANCE-02 | Direction (`deposit`/`income` up, `withdrawal` down), unknown TYPE and non-numeric AMOUNT excluded and counted, per-currency grouping (case-sensitive, `__proto__` code), threshold 50 / cap 8 / ordering, other-currencies list keeps every code, exact sums vs an independent oracle | unit | `pnpm exec vitest run tests/unit/finance.test.ts` | Wave 0 |
| FINANCE-01/02 | Bar-chart model: month axis (empty months drawn), pitch rule at 56/100/144/145/240 months, node bound `3m+40`, key reducer | unit | `pnpm exec vitest run tests/unit/bar-chart-model.test.ts` | Wave 0 |
| FINANCE-01/02 | Charts render; `sum(data-in)`/`sum(data-out)` equal summary figures; tooltips on hover and keyboard; 20-year fixture scrolls last month into view; node count bound | e2e | `pnpm exec playwright test tests/e2e/finance.spec.ts` | Wave 0 |
| FINANCE-03 | PAID-only totals; FAILED/NEW/other counted separately; gifts included and shown; unknown-currency card; leading-dot and 3-decimal amounts; breakdown by year and game code each sum to the headline; `usd` vs `USD` two cards; non-numeric PAID excluded | unit | `pnpm exec vitest run tests/unit/finance.test.ts tests/unit/decimal.test.ts` | Wave 0 |
| FINANCE-03 | Exactly one `spend-total` per currency on a 2+ currency fixture; no text node announcing a grand/blended total (beware: the intro copy contains "total" and "across currencies"; assert on element structure and numbers, not a loose regex) | e2e | `pnpm exec playwright test tests/e2e/spend.spec.ts` | Wave 0 |
| D-01/D-02 | Six sections, `NAV_ORDER`, `BUILT_DASHBOARDS`, `Financial_data` supported; old-cache re-classification | unit | `pnpm exec vitest run tests/unit/dashboard-status.test.ts tests/unit/classify.test.ts tests/unit/ingest-worker.test.ts` | extend |
| D-25 | `formatNumber(n, locale)` default viewer locale; tests pinned via setup; money, compact, win-rate, premium-day formatters | unit | `pnpm exec vitest run tests/unit/ui-copy.test.ts` | extend |
| Colour | `--flow-in` / `--flow-out` declared once in `app.css`, >= 3:1 on `#ffffff` and `#f1f3f4`, not a ramp/accent hex, never restated in a component | unit | `pnpm exec vitest run tests/unit/contrast.test.ts` | extend |
| Zero network | No request after load through the Phase 5 flows (title switch, battle type, sort, search, chart hover, spend breakdown) and no CSP violation | e2e | `pnpm exec playwright test tests/e2e/zero-network.spec.ts` | extend |
| Scale | 10k+ currency ops over many years and a 50k-row variant import through the real worker within a budget; DOM node counts independent of row count | unit + e2e | `pnpm exec vitest run tests/unit/finance.test.ts` ; `playwright test tests/e2e/finance-scale.spec.ts` | Wave 0 |
| Gate | CI e2e limits still ordered after the new test count | unit | `pnpm exec vitest run tests/unit/ci-budget.test.ts` | extend |

### Sampling Rate
- **Per task commit:** the quick run command for the files touched, plus `pnpm run check` when a `.svelte` file or `worker-messages.ts` changed.
- **Per wave merge:** `pnpm run lint && pnpm run check && pnpm run test:unit`.
- **Phase gate:** full suite green (including `playwright test`) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/fixtures/player-stats-fixtures.ts` — real-shape files for all four titles (main, by_Type, Battle_Types, Account, WOWP_19/20), hand-derived oracle numbers, a 5,000-vehicle generator, NAME canary.
- [ ] `tests/fixtures/finance-fixtures.ts` — real-header Financial_data, 12-column Orders, multi-currency set (PAID/FAILED/NEW/gifts/bad amounts/leading-dot/3-decimal/unknown currency/`usd`+`USD`), 10k+ and 50k-row generators, 20-year range; an **independent oracle** for money (integer thousandths via string splitting and `Number`, sharing no code with the BigInt util), mirroring `tests/helpers/session-oracle.ts`.
- [ ] `tests/fixtures/export-fixtures.ts` — replace invented stats files, add Financial_data, update `SAMPLE_FILE_COUNTS` / `SAMPLE_ROW_COUNTS` / `SAMPLE_EXPECTED_COUNTS` / `SAMPLE_BADGE_ORDER`, `SCALE_ROW_TEMPLATES`, `renderCsv`/header constants.
- [ ] New unit files: `decimal`, `finance`, `vehicle-stats`, `vehicle-model`, `bar-chart-model`, `vehicle-state`/`finance-state`, `query-client`, plus source-contract tests for the new components.
- [ ] New e2e specs: `vehicle-stats`, `finance`, `spend`, `finance-scale`; helper additions in `tests/e2e/helpers.ts`.
- [ ] Update `tests/unit/setup.ts` (pin default locale `'en-US'`), `playwright.config.ts` (`use.locale`), CI limits (`ci.yml`, `playwright.config.ts`, expectations in `ci-budget.test.ts` only if the projection constants change).
- [ ] Update existing assertions listed in Pitfall 3 and Pitfall 7.

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high) [VERIFIED: .planning/config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts, no backend |
| V3 Session Management | no | — |
| V4 Access Control | no | Single-user local data |
| V5 Input Validation | yes | Anchored, length-bounded regexes (`ISO`/dotted/premium/decimal patterns); header-name mapping; numeric classes with explicit special values; strings clamped before leaving the worker |
| V6 Cryptography | no (no new use) | Existing SHA digest for dedup unchanged; nothing hand-rolled |
| V7 Error handling / logging | yes | Error details never carry row data; console only (Phase 4 T-04-01 rule); block `error` state shows fixed copy |
| V8 Data protection | yes | Never expose `NAME`, `ORDER_UUID`, `PAY_COUPON_NAME`, `PAY_AGGREGATOR_DESC`, `AA_PACKAGE_LIST`, IPs, email in any message, string, attribute, tooltip, `title`, `aria-label`, test id; canary tests |
| V14 Configuration | yes | CSP meta unchanged; no inline style; no new network API (lint guards `no-restricted-globals`) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted zip: catastrophic-backtracking regex input | Denial of Service | Length cap before every regex; anchored patterns without nested quantifiers (Patterns 5, 6) |
| Untrusted key `__proto__`/`constructor` as currency code, vehicle name, game code | Tampering | `Map` for all grouping; arrays across the message boundary; never `obj[key]` on untrusted keys |
| Untrusted text rendered as HTML | Tampering / XSS | Plain interpolation, no `{@html}` (lint rule `svelte/no-at-html-tags` already an error); the fixture set includes a markup-bearing vehicle ID and currency title |
| Hostile huge cell or 100k distinct strings | Denial of Service (own browser) | Clamp stored strings to 200 chars; cap distinct unrecognised strings (~50); window the table |
| Personal fields reaching the DOM (`NAME` in account files, order UUIDs, coupons) | Information Disclosure | Read named columns only; canary assertions over DOM text, attributes and every worker message |
| Stale dataset rendered under new heading | Information Disclosure / integrity | `importedAt` pairing + `acceptOutcome` on every channel |
| Network call introduced by new code | Information Disclosure | ESLint network ban + Playwright zero-network spec extended to Phase 5 flows |

## Sources

### Primary (HIGH confidence)
- This repository, read this session: `src/lib/worker/categories.ts`, `classify.ts`, `csv-parse.ts`, `db.ts`, `ingest.worker.ts`, `playtime.ts` (timestamp parsing, file-name predicates), `src/lib/dashboard-status.ts`, `types/worker-messages.ts`, `playtime-client.ts`, `playtime-state.ts`, `playtime-model.ts` (tooltip types), `worker-client.svelte.ts` (delegation points), `ui-copy.ts` (section titles, `formatNumber`), `civil-date.ts`, `components/{Dashboard,DashboardNav,DashboardSection,ChartTooltip,ExcludedNotice,ChartLegend,HourGrid,Playtime}.svelte`, `vite.config.ts` (CSP), `eslint.config.js` and `lint-guards.test.ts`, `tests/fixtures/export-fixtures.ts`, `tests/e2e/*.spec.ts` and `helpers.ts`, `tests/unit/ci-budget.test.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `package.json`, `.planning/config.json`.
- Real 2021 sample, header lines and shape histograms only (scripts in the session scratchpad; no values quoted).
- Commands run this session: `playwright test --list` (120 tests); vitest under `LC_ALL=de_DE.UTF-8` (1 existing failure); `Intl.NumberFormat` probes in Node 26.10 (string exactness, half-away rounding, compact `27M`).

### Secondary (MEDIUM confidence)
- MDN `Intl.NumberFormat.prototype.format()` — string input is used as an exact value; BigInt accepted [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/format].

### Tertiary (LOW confidence — `[ASSUMED]`, see Assumptions Log)
- Sticky table-cell cross-browser behaviour, classic-scrollbar nav height, Playwright default locale, IndexedDB read timings.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions read from `package.json`.
- Architecture: HIGH for integration points and the Dexie/replay decision (read from source); MEDIUM for on-demand vs stored (timing assumed, with a documented fallback).
- Pitfalls: HIGH for the real-shape facts and test ripples (verified by reading and running); MEDIUM for browser-behaviour items (`[ASSUMED]`).

**Research date:** 2026-10-01
**Valid until:** 30 days (stable stack; the real-shape facts are about a fixed 2021 sample and should be re-checked if a newer export becomes available)
