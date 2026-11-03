# Phase 5: Vehicle Stats & Financial Dashboards - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill two dashboard sections from the real export layout:

1. **Player_statistics** — per-vehicle battle stats for WoT, WoT Blitz, World of Warships and World of Warplanes (STATS-01), shown as one sortable, windowed table at a time behind a title switcher.
2. **Financial_data** (new section) — a premium-time timeline (FINANCE-01) and a virtual-currency flow timeline (FINANCE-02), plus the real-money spend summary from `Payment_history` (FINANCE-03), shown per currency with no blended or converted total anywhere.

Not in this phase: login-IP history and the world map (Phase 6), phone-width and touch polish (Phase 7), account balances (credits/gold/free XP) from `*_Account_Statistics.csv`, naming battle-type codes or vehicles (no spec or name map in the export).

**Findings from inspecting the real 2021 export (`path/to/export.zip that shape this phase — the roadmap and fixtures did not anticipate them:**

- `Financial_data/` is a real top-level folder with two files: `Operations_with_Premium_Days.csv` (`PREMIUM;CURR_PREMIUM;CREATED;UPDATED`, 128 rows) and `Virtual_Currencies_Operations.csv` (`CREATED;CURRENCY_CODE;CURRENCY_TITLE;AMOUNT;TYPE;ORDER`, 7,830 rows). It is **not** in `SUPPORTED` in `src/lib/worker/categories.ts`, so today it classifies as `unknown`, and Phase 3 D-02's section order has no slot for it. Wargaming's own `Readme_en.pdf` describes it as deposit/withdrawal operations on virtual currencies and "delta premium status and premium balances at the time of the transaction".
- The existing `Player_statistics` fixtures (`WOT_stats.csv`, `WOTB_stats.csv`, `WOWS_stats.csv`, `WOWP_19_stats.csv`, one shared invented header) match no real file. The real files are `WOT_Vehicle_Statistics.csv` (268 vehicles, 47 columns), `WOTB_Vehicle_Statistics.csv`, `WOWS_Ship_Statistics.csv`, `WOWS_Ship_Statistics_by_Type.csv`, `WOWP_19_Plane_Statistics.csv`, `WOWP_20_Plane_Statistics.csv`, plus `*_Vehicle_Statistics_by_Type.csv`, `*_Battle_Types_Statistics.csv`, `*_Account_Statistics.csv`, `WOT_Fallout_*`, `WOWS_Crews.csv`, `WOWS_Account_Storage.csv`.
- **Reconciliation evidence:** `WOT_Vehicle_Statistics.csv` sums exactly to the account totals in `WOT_Account_Statistics.csv` (24,345 battles, 26,986,204 damage dealt). Blitz's main file also matches its account total (30). The main per-vehicle files are the lifetime truth.
- **`by_Type` means by battle type, not vehicle class** (user-confirmed). `TYPE` is a numeric battle-type code (WoT: 1, 2, 3, 4, 5, 6, 10, 11, 13, 14, 18, 19; no document in the export names them). The by_Type files cover only part of the battles (WoT: 1,958 of 24,345). In Warships each battle is counted under two battle types: `WOWS_Battle_Types_Statistics` sums to 66 for 33 real battles, and Tatsuta's by_Type rows add to 14 against a true 7. Per-ship Warships rows therefore cannot be summed across types.
- `WOWS_Ship_Statistics.csv` has battles only (9 ships, 33 battles); wins and damage exist only in `WOWS_Ship_Statistics_by_Type.csv`.
- Warplanes in this account: every plane has 0 battles; `WOWP_20_Plane_Statistics.csv` has no vehicle-name column; `WOWP_19` damage cells are `N/D` ("not defined" per the readme). The readme also defines `N/A` (not available) and `F`/`T` (false/true).
- `Virtual_Currencies_Operations.csv` mixes unlike units: `ru.wot.credits` (3,654 rows, millions), `ru.shared_currency.free_xp` (3,495), `ru.wot.crystal` (455), `ru.shared_currency.gold` (208), `ru.wot.event_coin` (12), `ru.wows.coal` (1), and a stray `UAH` code (5 rows, TYPE `income`). TYPE values: `deposit` 5,646, `withdrawal` 2,179, `income` 5. Range 2017-03 to 2021-10.
- `Operations_with_Premium_Days.csv` `PREMIUM` is mostly a duration (`1 day` 74, `3 days` 20, `30 days` 12, `2 days` 9) but also appears as `deposit WOT premium_plus 86400 sec`. Range from 2013.
- `Payment_history/Orders.csv` has 12 columns in the real file (adds `PAY_AGGREGATOR_DESC;PAY_ITEM_TYPE_NAME;AA_PACKAGE_LIST` to the fixture's 9). In the sample: GAME_CODE `WOT` 87 / `COMMON` 14 / `WOWP` 1; currencies USD 58 / UAH 35 / RUB 9; status PAID 57 / FAILED 26 / NEW 19.

</domain>

<decisions>
## Implementation Decisions

### Page structure and categories
- **D-01:** Financial_data becomes a **new, sixth dashboard section**. `Financial_data` is added to the supported categories and the one-section-per-source-folder rule of Phase 3 D-02 is kept. Section order becomes `Activity_history`, `Player_statistics`, `Financial_data`, `Payment_history`, `User_Info`, then "Not yet supported". The nav grows to six links (Phase 3 D-03 amended). Each folder keeps its own status and empty state. — **Reversibility:** costly — **Reversibility rationale:** the category list, the status derivation, the nav and the section order are all keyed on the folder set; changing it later touches `categories.ts`, `dashboard-status.ts`, `DashboardNav` and the e2e nav tests.
- **D-02:** Within Financial_data, status is **per sub-block**. The section is `ready` if either file has rows. "Premium time" and "Virtual currency" each show their own "not in this export" or "this export contains no rows for X" text (Phase 3 D-10 wording pattern), like Playtime and Login history under Activity_history. The Payment_history spend summary stays in its own section and its own status.

### Test fixtures
- **D-03:** Add `Financial_data/` to the fixture builders using the **real 2021 headers**, plus a large synthetic generator (10k+ virtual-currency operations over many years, mixed currency codes including a stray `UAH`, all three TYPE values plus an unknown one, both premium formats plus junk strings, unparseable amounts). No real export data is committed, and no anonymised excerpt either.
- **D-04:** **Replace** the invented `Player_statistics` fixtures with real-shaped files (real names and columns for all four titles, including the `by_Type`, `Battle_Types`, `Account_Statistics` and WoWP_19/20 variants), and update the tests that count files and rows. Orders fixtures gain the three extra real columns, and a synthetic multi-currency (2+ codes) set covering PAID, FAILED, NEW, gifts and bad amounts. — **Reversibility:** costly — **Reversibility rationale:** many Phase 1-4 tests and the zero-network e2e spec depend on the exact fixture file set and row counts.

### Vehicle stats (STATS-01)
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

### Virtual-currency timeline (FINANCE-02)
- **D-15:** **Small multiples**: one chart per currency, each with its own y-scale (credits are in millions, gold in hundreds). Currencies are ordered by row count.
- **D-16:** Only currencies above a small row-count threshold (Claude picks it) get a chart. The rest are listed as **text rows** with total deposited, total withdrawn and date range, so every currency code in the export stays visible and none is dropped. This includes the stray `UAH` code.
- **D-17:** Each chart is **monthly diverging bars**: deposits up, withdrawals down, from the first operation. Month buckets keep a decade-long log near 120 bars, and the node count scales with months, not rows.
- **D-18:** TYPE interpretation: `deposit` and `income` count as up, `withdrawal` as down. Any other TYPE, or a non-numeric `AMOUNT`, excludes the row from the charts, and the excluded count appears on screen next to the other skipped-row counts (Phase 4 D-02 pattern). Timestamps stay **as written, no timezone conversion** (Phase 4 D-01).

### Premium-time timeline (FINANCE-01)
- **D-19:** **Monthly bars of premium days granted.** Each row's `PREMIUM` is parsed to a number of days (`N day(s)` → N; `... N sec` → N ÷ 86400), bucketed by `CREATED`. The tooltip lists the grant sizes in that month.
  - **Amended 2026-10-02 after UAT gap G-05-3.** Bucketing is by **`CURR_PREMIUM`**, which the real 2021 export fills with the operation datetime — the UAT G-05-3 real-export comparison identified it as the real grant date, and the export readme describes the file only as premium status at the time of the transaction. It is no longer by `CREATED`, which in that export equals `UPDATED` and is a bulk-migration stamp shared by many rows (18 rows on one day and 16 on another across 128 rows). The evidence is that real-export comparison: 32 months with 2014-01 the largest at 58.0 days, against 35 of 94 months with 2013-12 at 137.3 days before the fix (the total, 577.3 days, is the same either way — the durations were never wrong, only their dates). D-19's **intent** — months of premium days *granted* — is unchanged; only the column is. The date column is decided **once per file**: `CURR_PREMIUM` when any row's cell reads as a date, `CREATED` otherwise. Inside a `CURR_PREMIUM`-dated file, a row whose cell cannot be read is excluded and counted per D-20 and is never moved to `CREATED`, because a per-row fallback would quietly re-create this same bug on that row. The original D-19 text above is left in place so the audit trail survives.
- **D-20:** Rows whose `PREMIUM` is not a recognisable duration are excluded from the chart, **counted on screen**, and the distinct unrecognised strings are listed in a short disclosure, so a drifted format is visible instead of silently ignored.

### Real-money spend summary (FINANCE-03)
- **D-21:** Per currency, show the **PAID total and PAID order count**, with **FAILED and NEW counts shown as separate figures, never added in**. Only `PAY_ORDER_STATUS_CODE = PAID` counts toward a total. **No blended, converted or grand total appears anywhere**, checked against a synthetic multi-currency fixture (roadmap criterion 4).
- **D-22:** Add **per-year and per-`GAME_CODE` breakdowns** (WOT / COMMON / WOWP) inside each currency, expandable. This is a presentation of the same PAID rows, not a new data source.
- **D-23:** **Gift orders** (`IS_GIFT`, exported as `T`/`F`) are **included in the PAID total** and also shown as a **separate gift line** per currency, so the headline stays "what you paid" and matches a bank statement.
- **D-24:** **Currency display:** show the code exactly as written ("USD 1,234.56"), two decimals, **never a symbol and never converted**. Blank or non-3-letter codes group under "Unknown currency". Non-numeric amounts on PAID rows are excluded and counted on screen.

### Formatting and interaction
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs
- `.planning/PROJECT.md` — Core Value, the zero-network constraint, the chart-aggregation-at-scale constraint, the Context section on the real export and `Payment_history/Orders.csv` structure
- `.planning/REQUIREMENTS.md` — STATS-01, FINANCE-01, FINANCE-02, FINANCE-03 (this phase's mapped requirements)
- `.planning/ROADMAP.md` §"Phase 5: Vehicle Stats & Financial Dashboards" — goal and the four success criteria
- `AGENTS.md` — locked stack, hand-rolled charts, no router, worker rules
- `.planning/research/PITFALLS.md` — Pitfall 3 and 4 (per-currency totals, no blended number, validate currency codes and show "unknown currency"), outlier-dominated colour scales
- `.planning/research/FEATURES.md` — per-vehicle table and spend-summary feature notes

### Prior phase decisions
- `.planning/phases/03-dashboard-shell-account-identity/03-CONTEXT.md` — D-02 (section order, amended by D-01 here), D-03 (nav links, amended), D-07 (`DashboardSection` `ready` snippet contract), D-08 (pure status derivation), D-09 (import counts stay as a caption), D-10 (absent/empty wording), D-11 (per-title absence is Phase 5)
- `.planning/phases/04-activity-time-dashboards/04-CONTEXT.md` — D-01 (timestamps as written), D-02 (excluded-row counts shown on screen), D-03 (selector pattern and its state reset), D-04 (percentile colour scale, hover and focus tooltips)
- `.planning/phases/02-defensive-parsing-persistent-dataset/02-CONTEXT.md` — D-01/D-02 (rows stored header-keyed), D-03/D-04 (skipped rows visible per category)
- `.planning/phases/02-defensive-parsing-persistent-dataset/02-UI-SPEC.md` and `03-UI-SPEC.md` — spacing scale, typography roles, palette, contrast rules

### Real-export evidence
- `path/to/export.zip — the real 2021 sample inspected for this phase (local only; never commit it or its rows). Its `Readme_en.pdf` documents `Financial_data` and the `N/D` / `N/A` / `F` / `T` abbreviations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/worker/categories.ts` — `SUPPORTED` list and `classifyFolder`; `Financial_data` must be added (D-01).
- `src/lib/dashboard-status.ts` — pure status derivation; extend for Player_statistics, Financial_data sub-blocks and Payment_history to reach `ready`.
- `src/lib/components/Dashboard.svelte`, `DashboardSection.svelte`, `DashboardNav.svelte` — section order and nav contract (Phase 3 D-02/D-03/D-07), to be amended for the sixth section.
- `src/lib/components/CalendarHeatmap.svelte`, `HourGrid.svelte`, `DurationList.svelte`, `ChartTooltip.svelte`, `ChartLegend.svelte`, `ExcludedNotice.svelte`, `PlaytimeSummary.svelte` — Phase 4 chart and notice pieces to reuse (D-27); the selector pattern lives in `Playtime.svelte` / `PlaytimeCharts.svelte`.
- `src/lib/worker/db.ts`, `ingest.worker.ts`, `playtime.ts` and `src/lib/types/worker-messages.ts` — the worker owns Dexie; aggregates and typed messages follow the Phase 4 playtime pattern (`playtime-client.ts`, `playtime-model.ts`, `playtime-shared.ts`, `playtime-state.ts`).
- `src/lib/ui-copy.ts` — all copy, with unit tests in `tests/unit/ui-copy.test.ts`.
- `tests/fixtures/export-fixtures.ts` — synthetic export builders; the Player_statistics and Orders fixtures here are invented or incomplete (D-03, D-04).

### Established Patterns
- Hand-rolled Svelte 5 runes components, no chart library, text-first UI.
- The worker is the only Dexie owner; the main thread talks to it through typed messages only.
- Skipped rows are counted and displayed, never silently dropped.
- Aggregate per bucket (month, day, hour cell), never one SVG node per row.
- e2e tests use `data-testid`; the zero-network Playwright guard and CSP must stay green.

### Integration Points
- Rows live in the `rows` table keyed by category and file; Player_statistics now has ~25 real files across four titles and Financial_data has two.
- `Payment_history` is already a supported category; only its dashboard is new.
- Selector state must reset on dataset replace and Clear (D-28).

</code_context>

<specifics>
## Specific Ideas

- Vehicle cell: nation tag + cleaned ID ("china" tag, "Ch24_Type64").
- Battle-type labels: "Battle type 3" until a real spec exists.
- Warships All view note: "available per battle type".
- Spend row wording: "USD 1,234.56" (code as written, no symbol), separate gift line, FAILED and NEW counts beside it, never in the total.

</specifics>

<deferred>
## Deferred Ideas

- Naming battle-type codes (needs a Wargaming spec the export does not contain).
- A vehicle name map (readable names) — a possible future build-time asset, needs a data source, licence check and upkeep.
- Account balances (credits, gold, free XP, crystal) from `*_Account_Statistics.csv`.
- Nation or class filters on the vehicle table.
- Fallout, Crews and Account_Storage displays.
- A WoT mode selector with documented mode names.
- Touch-friendly tooltips and phone-width tables — Phase 7.

</deferred>

---

*Phase: 5-Vehicle Stats & Financial Dashboards*
*Context gathered: 2026-10-01*
