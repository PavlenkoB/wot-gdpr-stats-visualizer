# Phase 5: Vehicle Stats & Financial Dashboards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 5-Vehicle Stats & Financial Dashboards
**Areas discussed:** Where Financial_data lives, Vehicle table design, Virtual-currency timeline, Premium & spend presentation, Per-title source files, WoWP schemas, Chart interaction & fallback, Account-level stats, Number and date formatting, Selector defaults and state, Vehicle table extras

---

## Where Financial_data lives

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Financial_data' section | One section per source folder; six nav links | ✓ |
| Fold into Payment_history section | One "money" section, five nav links | |
| You decide | | |

**User's choice:** New 'Financial_data' section.

Follow-ups:
- Partial files: **per-sub-block status** chosen over all-or-nothing.
- Test coverage: **synthetic fixtures modelled on the real headers** chosen over also committing an anonymised excerpt.
- Existing invented Player_statistics fixtures: **replace with real-shaped files** chosen over keeping them alongside.

**Notes:** Inspection of the real export showed Financial_data is a real folder, currently classified `unknown`, with no slot in the Phase 3 section order.

---

## Vehicle table design

| Option | Description | Selected |
|--------|-------------|----------|
| Title switcher, one table at a time | Tabs or segmented control above one windowed table | ✓ |
| Four stacked tables | | |
| One merged table with a Title column | | |

**User's choice:** Title switcher, one table at a time.

Follow-ups:
- Columns: **common core with derived win rate** (over core plus a full picker, or fixed set).
- Names: **cleaned raw ID, no name lookup** (over verbatim or a bundled WoT name map).
- Sort and zero-battle rows: user chose **sort by battles desc, show everything** (over hiding zero-battle rows by default with a toggle, which was the recommended option).

---

## Virtual-currency timeline

| Option | Description | Selected |
|--------|-------------|----------|
| Currency picker, one chart at a time (recommended) | | |
| Small multiples, one chart per currency | | ✓ |
| Single chart, normalised per currency | | |

**User's choice:** Small multiples, one chart per currency (over the recommended picker).

Follow-ups:
- Rare currencies: **chart top currencies, list the rest as text rows**.
- Plot and resolution: **monthly diverging bars** (deposits up, withdrawals down).
- TYPE handling: **deposit and income up, withdrawal down, anything else excluded and counted**.

---

## Premium & spend presentation

**Premium:**
- Shape: **monthly bars of premium days granted** (over event timeline or cumulative line).
- Unparseable rows: **excluded, counted on screen, raw strings listed**.

**Spend:**
- Summary content: user chose **add per-year and per-game breakdowns** (over the recommended per-currency totals plus status counts only).
- Gifts: **count in the PAID total, show a separate gift line**.
- Currency and amount validation: **code as written, never a symbol, unknown flagged**.

---

## Per-title source files

First question (WoT main file vs by_Type) was answered with a request to **investigate more deeply and repeat the questions**. Investigation: WoT main file reconciles exactly with account totals; by_Type is a different, partial cut with undocumented numeric codes; Warships by_Type counts each battle under two types (Battle_Types sums to 66 for 33 battles). The Wargaming `Readme_en.pdf` does not document the files.

| Option (second ask) | Description | Selected |
|--------|-------------|----------|
| Main file only (recommended) | | |
| Main file plus separate raw by_Type table | | picked first, then user asked to go back |
| Main file plus by_Type as a mode filter | | |

The user then asked to return to the previous question and clarified: **by_Type means by battle type**, and the main per-vehicle table stays the primary view. Question repeated with that reading:

| Option (final ask) | Description | Selected |
|--------|-------------|----------|
| Vehicle table plus a battle-type filter | "All battles" from the main file; a code switches to by_Type rows; summary from Battle_Types | ✓ |
| Vehicle table plus separate battle-type summary table | | |
| Vehicle table only | | |

**User's choice:** Vehicle table plus a battle-type filter.

Follow-up — Warships "All battles": **battles only; win rate and damage "available per battle type"** (over estimating from the largest type or hiding the columns).

---

## WoWP schemas

| Option | Description | Selected |
|--------|-------------|----------|
| Show WOWP_19 table; WOWP_20 as a count with a note | `N/D` shown as "not defined" | ✓ |
| Two sub-tables, one per schema | | |
| Treat WoWP as empty if all battles are 0 | | |

**User's choice:** Show WOWP_19 table; WOWP_20 as a count with a note.

---

## Chart interaction & fallback

- Reuse: **reuse tooltip, legend and palette; one new hand-rolled bar-chart component**.
- Accessibility and scale: **native sortable table, windowed rows, text summary under each chart** with a collapsible monthly data table.

---

## Account-level stats

| Option | Description | Selected |
|--------|-------------|----------|
| Defer; recognised but not displayed (recommended) | | |
| Show a small per-title header with battles and premium expiry | | ✓ |

**User's choice:** Show a small per-title header with battles and premium expiry. Balances (credits, gold, free XP) remain deferred.

---

## Number and date formatting

- Numbers: user answered "compact, but with exact number"; clarified as **compact on chart axes and tiles, exact in tooltips and tables**.
- Dates: **ISO-style `YYYY-MM` on axes, as-written date in tooltips**.

---

## Selector defaults and state

- Defaults: **first title with data, "All battles"; reset on replace or clear**.
- Sort and search across title switches: **sort resets to battles desc, search clears**.

---

## Vehicle table extras

| Option | Description | Selected |
|--------|-------------|----------|
| Name search and nation tag; no class filter | | ✓ |
| Search only | | |
| Search, nation tag and a nation filter | | |

**User's choice:** Name search and nation tag; no class filter.

---

## Claude's Discretion

- Worker precompute versus on-demand aggregates, and the Dexie schema bump for new categories.
- Row-count threshold for charting a currency, bar colours, table window size, row-expand fields, exact on-screen wording.
- How the real Orders file's extra columns are stored.

## Deferred Ideas

- Naming battle-type codes; a vehicle name map; account balances; nation or class filters; Fallout, Crews and Account_Storage displays; a WoT mode selector with documented names; touch and phone-width polish (Phase 7).
