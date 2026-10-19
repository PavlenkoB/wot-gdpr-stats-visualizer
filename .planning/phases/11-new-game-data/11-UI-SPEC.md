---
phase: "11"
slug: "new-game-data"
status: draft
shadcn_initialized: false
preset: none
created: "2026-10-19"
---

# Phase 11 - UI Design Contract

> Visual and interaction contract for the HEAT pane, the Warships crews and storage pane, the Warplanes account statistics inside Vehicles, the two new game-filter chips (HEAT, WoT Console), the Vehicles "no vehicle table" note, and the states around them. Every decision in `11-CONTEXT.md` (D-01..D-11), the Phase 10 contract (`10-UI-SPEC.md`) and the sketch findings (Day 10 "ink + teal", master-detail shell) is treated as locked. Nothing here asks the user a question: gaps are recorded as assumptions at the end. Existing tokens, type roles, the 480px phone block and the 44px floor are recorded as they are in the code, not re-specified.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (hand-rolled Svelte 5 components; no UI library, no new dependency) |
| Icon library | none (no icon is added; chips and rows carry words) |
| Font | system-ui stack, unchanged (`src/app.css` `:root`) |

**Source of truth:** `src/app.css`, the sketch findings skill (`.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/`), `08-UI-SPEC.md`, `09-UI-SPEC.md`, `10-UI-SPEC.md`, and the Device info pane (`src/lib/features/device-info/`, quick task 261012-bog), which is the template for promoting data to a pane.

**Registry and dependencies:** no third-party component, no new npm dependency, no new CSS file, no new media query, no new colour, spacing or type token. Component Inventory is omitted (`Tool: none`).

**New files the contract implies (names are the planner's to confirm):** one pane component per new list row (HEAT, Warships crews and storage), one shared card-with-table component used by both, a Warplanes account-statistics block inside `PlayerStats.svelte`, and the two `PaneId`s (`heat`, `warships-storage`). Nothing else is new UI.

---

## Existing Baseline (detected, not re-specified)

Detected from `src/app.css`, `GameFilter.svelte`, `game-filter-state.ts`, `AccountTag.svelte`, `DeviceInfo.svelte`, `DeviceTable.svelte`, `selection-state.ts`, `dashboard-status.ts`, `PlayerStats.svelte`, `UnsupportedBlock.svelte`, `ui-copy.ts`:

- Neutral tokens: `--page #ffffff`, `--list #f5f5f5`, `--border #dcdcdc`, `--faint #8c8c8c` (borders and decoration only, never text), `--ink #111111`, `--text #3a3a3a`, `--muted #5c5c5c`, `--sel #e0e0e0`, `--hover #ececec`, `--chip #ececec`, `--focus #1a73e8`, `--radius-card 8px`, `--radius-control 8px`. Data ramp `--ramp-0..5` is not used by any new surface (no new chart).
- Type roles: Body 14/400/1.5, Label 14/600/1.4, Heading 18/600/1.3, Display 26/600/1.3.
- One phone block (`@media (max-width: 480px)` in `src/app.css`); components declare no media query of their own. The 44px floor for `button`, `summary` and `a` lives in that block; a chip is a `label` and declares its own 44px.
- Panes are a fixed `PANE_IDS` tuple (nine today) with `PANE_TITLES`, `PANE_SECTION`, one `paneEntries(result)` derivation shared by the list row, the Overview card and the detail header; the list never issues a worker query (selection-state rule: supersede is per channel).
- Device info is the template: per-source `section` (`h3`, `From {file}` caption, then one of four states: not in this export, no rows, no usable columns, ready), a `dl` counts summary, a focusable named scroller table with sticky header, a muted "not reported" word for `null`, a single `role="status"` loading line and a fixed-sentence `role="alert"` error.
- `AccountTag` is inert: one letter, sr-only phrase, no attribute carrying an ID or nickname. `formatBattleTypeLabel(code)` renders `Battle type {code}`: battle types are never named.
- Login history owns the IP mask: `MASK_TOGGLE_SHOW/HIDE`, `MASK_CAPTION_MASKED/REVEALED`, `MASK_ANNOUNCE_*`, `data-masked`. No pane renders an IP outside that formatter.

---

## Spacing Scale

Declared values (multiples of 4); the same scale as Phase 10, with no new token:

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Gap between an account tag and the text after it; gap between a card title and its caption |
| sm | 8px | Gap between chips; vertical gap inside a card; cell padding (vertical) |
| md | 16px | Card padding; gap between stacked cards; chip horizontal padding; cell padding (horizontal 12px is carried over from Device info) |
| lg | 24px | Existing block gap in Playtime (unchanged) |

Exceptions:
- Filter chip height stays 44px (set on the chip itself).
- Table rows in the new panes are 40px tall (the Vehicles/Logins windowed row height), so a plain table and a windowed table look identical and `windowRange` has one constant.
- `12px` cell horizontal padding is carried over from `DeviceTable.svelte`, not introduced.

---

## Typography

Four roles, two weights (400, 600). No new size.

| Role | Size | Weight | Line Height | Used for in this phase |
|------|------|--------|-------------|------------------------|
| Body | 14px | 400 | 1.5 | Pane intro, empty/skipped sentences, Vehicles "no vehicle table" note, table cells, `dd` values |
| Label | 14px | 600 | 1.4 | Card titles (`h3`, ink), table column headers (muted), `dt` terms, chip labels (selected and unselected, same weight), mask toggle |
| Heading | 18px | 600 | 1.3 | unchanged (not used by a new surface) |
| Display | 26px | 600 | 1.3 | Pane titles in the detail header (existing shell, unchanged) |

Captions (`From {file}`, mask caption, geolocation note) are Body size at line-height 1.4 in `--muted`, the existing `.caption` treatment.

---

## Color

No new hex value. Every colour is read from a `var(--*)` token.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` / `#f5f5f5` | Page, card fill (`--page`), table header and dashed panels (`--list`) |
| Secondary (30%) | `#dcdcdc`, `#ececec` | Card and scroller borders (`--border`), account tag fill (`--chip`), chip hover (`--hover`) |
| Accent (10%) | `#111111` | Card titles, selected chip text/border/bar, selected list row bar (all existing shell language) |
| Selected surface | `#e0e0e0` | Selected chip fill and selected list row (existing) |
| Muted | `#5c5c5c` | Column headers, captions, "not reported", tag letter |
| Focus | `#1a73e8` | 3px focus ring on chips, scrollers, rows (existing) |
| Destructive / error | `#c5221f` on `#fce8e6`, text `#8a1c17` | The existing fixed-sentence error panel only (`role="alert"`, as in Device info); no destructive action |

**Accent reserved for:** the existing list and shell selection language, card titles in ink, and the selected state of the game filter chip. The filled-ink fill stays reserved for the one primary button, which this phase does not add to. HEAT and WoT Console are never given a hue: games are words, not colours, and the data ramp is not borrowed for them.

**Status is never colour alone.** Skipped, not-in-export, no-rows and not-reported are each stated in words; the dashed border on an unavailable panel only reinforces the sentence.

Contrast: no new pair (ink on white, text on white, muted on `--list`, muted on `--chip`, ink on `--sel` are already covered by `tests/unit/charts/contrast.test.ts`).

---

## Surfaces

### 1. Game filter extension (D-05, D-07)

`GameFilter.svelte` and `filterChips` are unchanged in markup, look and behaviour. `GAME_FILTER_TOKENS` becomes `['WOT', 'WOTB', 'WOWS', 'WOTC', 'HEAT']`.

- **Order** follows the existing display order of the identity header's Games row (`GAME_LONG_ORDER`: WoT, WoT Blitz, Warships, WoT Console, HEAT), so the chip row and the header never order games two ways. WOWP stays out (Warplanes is Vehicles-local, Phase 10 Recorded Choice 4).
- **Labels** come from `formatGameName`: `GAME_NAMES` gains `WOTC: 'WoT Console'` and `HEAT: 'HEAT'` (short labels; the long names stay in `GAME_LONG_NAMES`).
- **Visibility** is Phase 10's single rule, unchanged: the row renders when at least one filterable token exists and at least two distinct game tokens exist (a non-filterable token such as WOWP counts as "other"); a chip exists only for a token that has sessions in the data, plus the active token. Consequences now that HEAT and WOTC are filterable: a HEAT-only or WOTC-only export renders no row (All games is the only view); HEAT with WoT shows All games, WoT, HEAT; HEAT with WOTC shows All games, WoT Console, HEAT. This supersedes the two Phase 10 UI Considerations rows that listed HEAT and WOTC as non-filterable.
- **Phone:** up to six chips (All games, WoT, WoT Blitz, Warships, WoT Console, HEAT) exceed the 448px content width, so the row wraps to a second 44px line with the existing 8px row gap. This is the expected state, not an overflow: no horizontal scroll, no truncation, no new rule. Chips keep `white-space: nowrap`.
- **Scope (D-07):** the filter stays on Playtime (chip row) and Vehicles (see Surface 5). Finance, Payments, Logins, Device info, HEAT and Warships crews and storage render no chip row and do not react to it.
- **Playtime under HEAT or WoT Console:** everything Phase 10 specified applies (tiles, calendar, hour grid, duration list narrow; "Updating charts..." through the one live region; the previous slice stays on screen; empty-game body line if the active token has no usable sessions). The `GAME` splitter follows its existing rule on the filtered slice. The "About this summary" disclosure is unchanged.

### 2. List rows (D-01, D-03)

Two new rows, rendered in the existing `.row` anatomy (title 14/600 left, headline 14/600 right, summary 12.5px muted, 56px minimum, 64px on phone).

**Order in the list:** Overview, Playtime, Login history, Vehicles, **HEAT**, **Warships crews & storage**, Finance, Payments, Device info, Account, Not yet supported. The two game-data rows sit together directly after Vehicles, the other game-data row; money and device rows keep their order.

| Row | Title (`PANE_TITLES`) | Headline | Summary line |
|-----|-----------------------|----------|--------------|
| HEAT | `HEAT` | `formatRowCount(rows)` across its files | `Battle types, stats, storage · {n files}` |
| Warships crews & storage | `Warships crews & storage` | `formatRowCount(rows)` across its files | `Crews and account storage · {n files}` |

- **Presence rule (assumption A2):** each row is rendered only when the export holds at least one file of that pane (present-but-empty counts as present). When absent there is no row, no muted placeholder, no Overview card and no "not in this export" count: most exports are not HEAT or Warships exports, and a permanent muted row would be noise for them. This is the one place the shell does not use the muted "not in this export" row, and it follows D-01's wording ("shown only when the export holds HEAT data").
- **Present but no rows** (header-only file, or every allowlist column drifted) renders the row muted with headline em dash and the existing `formatSectionStatus('empty', ...)` sentence, so the existing status ladder applies unchanged. Its detail is the pane with the per-card states in Surface 3.
- **Navigation:** `stepSelection` and `j`/`k`/arrows walk only the rendered rows (clamped, not wrapped). Selection is component state keyed to the dataset stamp, as today; a new dataset that lacks the selected pane falls back to Overview (D-04 of Phase 8).
- **Phone:** the two rows are ordinary 64px rows in the first group, with the chevron.
- **Derivation:** presence, counts and the headline come from the same `ClassifyResult` that feeds the list; the list issues no worker query (assumption A3).
- **Test ids:** `list-row-heat`, `list-row-warships-storage`; panes `heat` and `warships-storage`.

### 3. HEAT pane (D-01, D-04, D-08..D-11)

**Pane header:** title `HEAT` (26/600), then the existing provenance line `From HEAT data · {n files}, {n rows}`, then (N >= 2 accounts) the combined caption `All {N} accounts combined` from Phase 10, unchanged component and test id. Then one intro paragraph (Body, `--text`): `HEAT_INTRO`. No stat tiles, no chart, no Overview-style preview (record types are unverified; a headline figure would be invented).

**Body: four stacked cards**, in this order, single column at every width, 16px gap:

1. **Account statistics** - one block per account that has the record, in identity-header order. Each block is a `dl` (grid `auto 1fr`, 4px/16px gap, `dt` Label muted, `dd` Body right-aligned tabular numerals), preceded when N >= 2 by the account tag with its sr-only phrase on its own line (4px gap above the `dl`). One account: no tag, no wrapper line.
2. **Battle types** - a table, one row per account per battle type. First cell: account tag (N >= 2) then `formatBattleTypeLabel(code)`; remaining columns are the allowlisted measures.
3. **Storage** - a table of the storage records, first cell tagged for N >= 2.
4. **Geolocation** - a table of the geolocation records. Any address column is rendered only through the shared mask formatter (see below). A one-line `HEAT_GEO_NOTE` caption sits under the card title: the addresses here are not added to the Login history map or country list (D-04, deferred idea).

**Card anatomy** (all four, and both Warships cards):

- Container: `border: 1px solid var(--border); border-radius: var(--radius-card); background: var(--page); padding: 16px; display: flex; flex-direction: column; gap: 8px; min-width: 0`.
- Title: `h3`, Label role, `--ink`, no bottom rule (the card border already separates). Caption under it: `From {file}` (`formatDeviceFromFile`), `--muted`, 4px gap.
- Content is exactly one of four states, never implied (Device info vocabulary):
  - `not-in-export`: Body sentence `Not in this export` (`DEVICE_TABLE_NOT_IN_EXPORT`, reused). The caption is omitted because there is no file.
  - `no-rows`: `formatDeviceNoRows(file)` (reused).
  - `skipped` (D-09, allowlist drift): `formatNewDataSkipped(file)` - the file is in the export, parsed, and none of its columns are on the allowlist. Same dashed look as the shell's unavailable panels: `border: 1px dashed var(--faint); background: var(--list)` on the card. The import still succeeded; there is no banner, no import-summary warning and no failure copy. The caption (`From {file}`) names the file, which is the provenance D-09 requires.
  - `ready`: the table (or `dl`).
- Unreadable-row pill: the existing `ExcludedNotice` is reused only if the worker reports rows it could not parse; otherwise absent.

**Table treatment (one shared component, both panes):**

- Scroller: `role="region"`, `tabindex="0"`, `aria-label` `formatDeviceTableLabel(title)`, `overflow: auto`, `max-height: 480px`, `border: 1px solid var(--border)`, radius 6px, focus ring 3px `--focus` offset 2px, exactly as `DeviceTable.svelte`. A visually hidden `caption` repeats the name.
- Header: sticky, `--list` fill, Label role `--muted`, `padding: 8px 12px`, nowrap, `scope="col"`. Column labels come from a canonical map keyed by allowlisted column id (the `DEVICE_COLUMN_LABELS` pattern). A column id with no label in the map falls back to its allowlisted id string, never to an arbitrary header from the zip.
- Cells: Body, `--text`, `padding: 0 12px`, 40px row, nowrap, `tabular-nums`, 1px bottom rule `--border`. `null` or empty renders the muted words `not reported` (`DEVICE_NOT_REPORTED`, reused), never a blank and never a dash. Numbers group through `formatNumber`; sums use `decimal.ts`; dates and timestamps are shown as the export wrote them (no timezone claim), the same rule as the Vehicles premium expiry.
- First column is sticky (opaque `--page` fill) so the account tag and row name stay visible while the table scrolls sideways. With N >= 2 the first column grows by 32px for the tag (`min-width` from one geometry record, as in Vehicles); with one account it is unchanged and no tag node, wrapper or whitespace text node exists.
- Rows: all rows render as a plain table up to 500; above 500 the table is windowed by `windowRange` at the constant 40px row height (no DOM measurement, no per-row listener, DOM bounded by the window). No table in these panes ever truncates with a "more rows not listed" line: that Device-info pattern loses rows, and these rows must stay traceable to their account (D-03). Nothing is drawn as per-row SVG (D-11).
- Sorting, column picker and search are not added. The order is the worker's, stable: identity-header account order, then the file's own order.

**Geolocation and IP masking (D-04):**

- One reveal state governs every address in the app. The HEAT geolocation card shows the same toggle (`MASK_TOGGLE_SHOW`/`MASK_TOGGLE_HIDE`, outlined 44px button, `data-masked`) and caption (`MASK_CAPTION_MASKED`/`MASK_CAPTION_REVEALED`) as Login history, inside the card under the note, only when the card has an address column and rows. Pressing it reveals or hides Login history's addresses too, because it is the same single global reveal; the reveal resets on a new dataset exactly as it does today.
- The pane owns exactly one explicit `aria-live` region (its `role="status"` line, empty when idle), which also carries `MASK_ANNOUNCE_SHOWN`/`MASK_ANNOUNCE_MASKED`; the loading line and these announcements share it. The error panel is `role="alert"` without `aria-live`.
- Masked is the default on first render of every dataset. No address appears in an attribute, `title`, `aria-label`, test id, `document.title` or log.
- If the global reveal state is not yet shared outside Login history, lifting it to the shell is a planner task (assumption A4); if it cannot be shared, the card falls back to its own toggle that starts masked on every dataset change. Either way no address is clear until the reader asks.
- Any other column the allowlist keeps that holds an IP, in any new pane, follows the same rule: it goes through the mask formatter or it is not on the allowlist.

**Loading, error, privacy:**

- Loading: one `role="status"` line `HEAT_LOADING` ("Reading HEAT data...") in the block, `aria-busy="true"` on the block, no skeleton or spinner (Device info precedent).
- Error: fixed sentence `HEAT_ERROR`, `role="alert"`, never the worker's detail.
- A planted synthetic email from any allowlisted file must appear in neither IndexedDB nor any rendered pane (PRIV-01); the pane renders only allowlisted columns by construction. The pane asserts zero network requests in Playwright (PRIV-02).

### 4. Warships crews & storage pane (D-03)

Same shell, header, card anatomy, table treatment, states, loading/error and privacy rules as Surface 3. Differences only:

- Title `Warships crews & storage`; provenance `From Warships crews and storage files · {n files}, {n rows}`; intro `WOWS_STORAGE_INTRO`, which also points to Vehicles for Warships vehicle statistics.
- Two cards, in this order: **Crews** and **Account storage**.
- **Every data row carries the account tag when N >= 2** (D-03, GAMES-04: "each row traceable to its account"), as the first thing in the first cell, 4px before the text. One account: no tag.
- No address column is expected; the mask rule above still binds if the allowlist ever keeps one.
- Crews can be numerous (hundreds); storage can be larger. Both use the windowing threshold in Surface 3 (plain up to 500, windowed above).

### 5. Vehicles: Warplanes account statistics and the no-table note (D-02, D-06)

**Warplanes account statistics (D-02, GAMES-03).** Inside the existing Vehicles block, for the Warplanes title only, a new `Account statistics` block (`h4`, Label role, matching `VEHICLE_TABLE_TITLE`) sits after the existing `dl.header` and before the title-state line, the Warplanes 20 note and the battle-type summary.

- Content: per account, a `dl` in the same `.header` look as Vehicles already uses (`dt` Label muted, `dd` Body); preceded when N >= 2 by the account tag line (as in Surface 3 block 1). Accounts that lack the record are simply absent.
- The plane statistics are the existing per-vehicle table (WOWP 19 rows; WOWP 20 keeps its note). Its rows already carry the account tag at N >= 2 (Phase 10). No change to sort, search, column picker or the 40px rows.
- Not an error anywhere: Warplanes absent from the whole export keeps the existing `Warplanes (not in this export)` option suffix and the `formatTitleNotInExport` info line; Warplanes present in some accounts shows only those accounts' data; the account block with no record is not rendered and no sentence replaces it. A title absent from one account never shows an error or a placeholder for that account.
- If the Warplanes account file is on the export but drifted (no allowlisted columns), the block shows `formatNewDataSkipped(file)` as an info line (`.body.info`) instead of the `dl`, so the file is named (D-09).
- The Warplanes `Account statistics` block never shows the nickname; Phase 3 D-21 and the existing header rule stand.

**Vehicles under HEAT or WoT Console (D-06).** When the shared filter is HEAT or WOTC, Vehicles keeps showing the title it would show (the applied title: the last Vehicles choice, else the worker's first-title-with-rows) and adds one neutral-info line, `.body.info`, `data-testid="vehicles-no-table-note"`, directly under the controls row and above the title-state line: `formatNoVehicleTable(game, title)`. The `Game` select shows the applied title and stays fully usable; the shared filter is not cleared by opening Vehicles, and choosing a title in the select writes the filter exactly as Phase 10 specified (the user's own choice replaces HEAT/WOTC). The note has no `aria-live`: Vehicles and Playtime are never mounted together, so the filter cannot change while it is on screen.

### 6. Overview and the "Not yet supported" footer

- **Overview:** each rendered new pane gets one section card in the existing `.ov-card` look: label (`PANE_TITLES`), headline `formatRowCount`, the row's summary line, an underlined ink `Open HEAT →` / `Open Warships crews & storage →` link (`formatOpenSectionLink`). No preview graphic. Absent panes have no card (Surface 2). The Overview chips count a new pane under "N sections with data" when it has rows; absent panes are not counted in "N not in this export".
- **Footer:** the "Not yet supported" row, its headline (`formatFolderCount`), its detail list and the Overview chip all derive from the one `unsupportedEntries(result)`. A folder that gains a pane in this phase leaves all four at once, including after a cache replay (status is re-derived from the stored name, no Dexie bump). If no folder is promoted (assumption A5) the footer is unchanged, which is correct.

---

## Layouts & Breakpoints

- **Desktop (900px and up) and tablet:** two-pane shell unchanged. New panes use the detail pane's inner width; cards are single column; table scrollers scroll inside their own box. The chip row wraps if needed.
- **Phone (480px and below):** list screen then detail screen; the two new rows are 64px rows; cards stack full width with 16px padding; tables scroll horizontally inside their scroller with the first column sticky; the mask toggle is a 44px (48px phone block) outlined button; the chip row wraps to two lines. The page never scrolls sideways.
- **No component media query is added.** Everything above is flex wrap, `min-width: 0` and the existing global phone block.

---

## Copywriting Contract

All strings live in `src/lib/ui-copy.ts` as named constants or formatters, pinned in `tests/unit/shell/ui-copy.test.ts`. Names are proposed.

| Element | Copy | Constant (proposed) |
|---------|------|---------------------|
| HEAT list/pane title | "HEAT" | `PANE_TITLES.heat` |
| Warships list/pane title | "Warships crews & storage" | `PANE_TITLES['warships-storage']` |
| HEAT row summary | `Battle types, stats, storage · {n files}` | `formatHeatRowSummary(n)` |
| Warships row summary | `Crews and account storage · {n files}` | `formatWowsStorageRowSummary(n)` |
| HEAT provenance | `From HEAT data · {n files}, {n rows}` | `formatNewDataProvenance(label, counts)` |
| Warships provenance | `From Warships crews and storage files · {n files}, {n rows}` | same formatter |
| Filter chips | "WoT Console", "HEAT" | `GAME_NAMES` additions via `formatGameName` |
| HEAT intro | "Your HEAT account statistics, battle types, storage and geolocation records. HEAT play sessions are counted in Playtime." | `HEAT_INTRO` |
| Warships intro | "The crews and account storage your export lists for Warships. Warships vehicle statistics are in Vehicles." | `WOWS_STORAGE_INTRO` |
| HEAT card titles | "Account statistics", "Battle types", "Storage", "Geolocation" | `HEAT_CARD_TITLES` |
| Warships card titles | "Crews", "Account storage" | `WOWS_STORAGE_CARD_TITLES` |
| Card file caption | `From {file}` | `formatDeviceFromFile` (reused) |
| Card not in export | "Not in this export" | `DEVICE_TABLE_NOT_IN_EXPORT` (reused) |
| Card header-only file | `{file} is in this export but holds no rows` | `formatDeviceNoRows` (reused) |
| Card skipped (D-09) | `{file} is in this export, but none of its columns are ones this viewer reads, so it was skipped.` | `formatNewDataSkipped(file)` |
| Null cell | "not reported" | `DEVICE_NOT_REPORTED` (reused) |
| Geolocation note | "These addresses are not added to the Login history map or country list." | `HEAT_GEO_NOTE` |
| Mask toggle / captions / announcements | reused verbatim | `MASK_TOGGLE_*`, `MASK_CAPTION_*`, `MASK_ANNOUNCE_*` |
| Warplanes block title | "Account statistics" | `WOWP_ACCOUNT_STATS_HEADING` |
| Vehicles no-table note | `{game} has no vehicle table. Showing {title} instead.` e.g. "WoT Console has no vehicle table. Showing WoT instead." | `formatNoVehicleTable(game, title)` |
| Loading | "Reading HEAT data..." / "Reading Warships crews and storage..." | `HEAT_LOADING`, `WOWS_STORAGE_LOADING` |
| Combined caption (N >= 2) | `All {N} accounts combined` | `formatCombinedCaption` (reused) |
| Open link | `Open HEAT →`, `Open Warships crews & storage →` | `formatOpenSectionLink` (reused) |
| Table accessible name | `{card title} table` | `formatDeviceTableLabel` (reused) |
| Account tag phrases | reused | `formatAccountTagLabel`, `formatAccountLegendLabel` |

| Element | Copy |
|---------|------|
| Primary CTA | none. The phase adds no primary button; the mask toggle is an outlined control, not a call to action |
| Empty state heading | none added. The body sentence carries the message (the shell's pattern) |
| Empty state body | Per card: "Not in this export", `{file} is in this export but holds no rows`, or the skipped sentence above. Whole-pane empty (every file header-only or skipped) is the same sentences, one per card, and the row is muted with the existing `This export contains no rows for ...` status. Playtime empty game: Phase 10's `formatNoGameSessions(token)` (now reachable for HEAT and WoT Console) |
| Error state | HEAT: "HEAT data could not be read from this export. Your imported data is unchanged. Drop the export again to retry." Warships: "Warships crews and storage could not be read from this export. Your imported data is unchanged. Drop the export again to retry." (`HEAT_ERROR`, `WOWS_STORAGE_ERROR`; fixed sentences, never the worker's detail) |
| Destructive confirmation | none. No destructive action is added; the existing clear/replace confirmations are unchanged |

Rules:
- File labels (`From {file}`) come from a canonical constant table keyed by record type and filled at research time from header inspection (D-10). A zip entry name that is not in the table is never printed, so an untrusted file name cannot reach a card caption (T-08-01 pattern).
- Game names always go through `formatGameName`; account IDs and nicknames are text only, never attributes.
- No hand-written insight sentence ("you played HEAT most on...") is added; only computed values and the fixed sentences above.

---

## Accessibility

- **Chips:** native radio group, one tab stop, arrows select (Phase 10, unchanged). Two more chips change nothing structurally; each is 44px tall.
- **List rows:** real `<button>`s with `aria-current="true"` on the selected one; the two new rows join the existing `<ul>`. A muted row (present, no rows) keeps the visually hidden reason suffix in its accessible name, as today.
- **Tables:** named focusable scroller regions (`role="region"`, `tabindex="0"`), hidden `caption`, `scope="col"`. Sticky first column keeps the tag visible; the tag letter is `aria-hidden`, the full phrase `.visually-hidden` text in the same cell, so a screen reader hears "Account B, ID ..., nickname ..., {row name}".
- **Mask toggle:** a label swap with `data-masked`, not `aria-pressed`; announcements are state words only, never an address (Login history precedent).
- **Live regions:** HEAT and Warships panes each own one explicit `aria-live` (their `role="status"` line); the errors are `role="alert"`; the Vehicles note and the chips add none. The page-wide assertion that counts explicit `aria-live` attributes is per mounted pane and is unchanged.
- **Touch floor:** every interactive element is 44px (48px phone block): chips, row buttons, the mask toggle (`button`), `summary`, links. Tags and table cells are inert and do not add tap targets.
- **Status by text:** skipped, not in export, no rows, not reported, masked/revealed and "no vehicle table" are each stated in words.
- **Motion:** none. No transition, animation, scroll effect or entrance.
- **Privacy:** only allowlisted columns reach the DOM; no nickname, account ID or address in `document.title`, attributes, tooltips or logs; the nickname appears as `.visually-hidden` text in tagged rows only (Phase 10 D-19).

---

## UI Considerations

Applicable state considerations resolved: 18 covered, 2 backstop, 3 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| zero-one-many | HEAT and Warships list rows, Overview cards | covered | Rendered only when the export holds a file of that pane; absent means no row, no card and no "not in this export" count |
| zero-one-many | account tag, combined caption | covered | Two or more accounts only; one account renders no node, no width, no whitespace text node (v1.0 DOM identical) |
| zero-one-many | filter chip row with HEAT and WOTC | covered | Phase 10 rule unchanged: HEAT-only or WOTC-only exports render no row; two tokens show All games plus both; the active token is always rendered |
| empty | HEAT or Warships card with the file absent | covered | "Not in this export" (`DEVICE_TABLE_NOT_IN_EXPORT`) |
| empty | file present with no data rows | covered | `formatDeviceNoRows(file)`; the row is muted with the existing `empty` status |
| empty | file present, no allowlisted column matched (drift, D-09) | covered | `formatNewDataSkipped(file)` in a dashed card; import succeeded; file named in the card caption; no banner or summary warning |
| empty | Playtime with HEAT or WoT Console chip and no usable sessions | covered | Phase 10 empty-game body line; chips stay enabled |
| empty | Warplanes title in Vehicles for an account lacking it | covered | Account simply absent from the block and table; no error and no placeholder; whole-title absence keeps the existing `formatTitleNotInExport` line |
| empty | Vehicles under HEAT or WoT Console | covered | `vehicles-no-table-note` over the last/applied title; the table is the title's, not empty |
| loading | HEAT and Warships panes | covered | One `role="status"` line plus `aria-busy`; no skeleton or spinner |
| loading | filter change on Playtime with the new tokens | covered | Existing `updating` path: previous slice stays, "Updating charts..." |
| error | HEAT and Warships queries | covered | Fixed sentence, `role="alert"`, never the worker's detail |
| partial | HEAT with some cards present and others not | covered | Each card states its own state; cards never reorder or disappear |
| partial | account with the record in one of several accounts | covered | Tagged rows/blocks only for accounts that have the record; tag letters stable across panes |
| ordering | rows and account blocks | covered | Identity-header account order, then the file's own order; stable between renders |
| overflow | tables over 500 rows | covered | Windowed at a constant 40px row height; DOM bounded by the window; never truncated with a "more" line; no per-row SVG (D-11) |
| overflow | six filter chips at phone width | covered | Wraps to a second 44px line; no horizontal scroll, no truncation |
| privacy | geolocation addresses | covered | Masked through the shared formatter until the single global reveal; not fed to the Logins map or country list |
| privacy | planted synthetic email in any new file | 🧪 backstop | Per-header unit test plus a rendered-pane assertion that the canary appears nowhere (PRIV-01); lifts as `{ statement, verification: backstop }` |
| long-text | cell values and a 40-character nickname in a tag phrase | 🧪 backstop | Cells are nowrap in a scroller (cannot widen the page); the phrase is `.visually-hidden`; visual state test at 375px |
| ordering | HEAT/WOTC chip order vs the Games row | unresolved | Contract orders chips like the identity header (WoT Console before HEAT); D-05 wrote "HEAT, WOTC". Planner treats as an assumption; swapping is a tuple edit |
| layout | HEAT/Warships row presence vs muted-row convention | unresolved | See assumption A2; if the user prefers permanent muted rows, only the presence rule and the Overview "not in this export" count change |
| unknown columns | all card contents | unresolved | Real headers unverified (D-10); the cards are record-type blocks, and column labels, number kinds and the HEAT/WOWS file-label table are fixed after header inspection |

---

## Recorded Choices and Assumptions

Open items the planner treats as assumptions (nothing here was asked of the user).

**Choices**
1. **Stacked cards, not tabs or a second master-detail**, for HEAT (D-04 default). Four record types in one scroll keeps the shell's single-column detail pane and needs no new interaction.
2. **Chip order follows the identity header's Games row** (WoT Console, then HEAT), not D-05's prose order, so one fixed order exists in the app.
3. **Warplanes account statistics get no card.** Vehicles is not a card-based pane; the block reuses Vehicles' own `dl` look and `h4` so the title does not look pasted in.
4. **No row cap with a "more rows" line** in the new tables (unlike Device info): windowing keeps every row reachable, which GAMES-04's per-row traceability requires.
5. **Table rows are 40px** (Vehicles/Logins height), not Device info's content-sized rows, so plain and windowed modes match and `windowRange` has one constant.
6. **No stat tiles** on HEAT: a tile needs a verified headline figure, and the headers are unverified.

**Assumptions**
- **A1 (headers, D-10):** HEAT and Warships record types exist as the CONTEXT describes (HEAT: account stats, battle types, storage, geolocation; Warships: crews, account storage) but real columns, file names and numeric kinds are unverified. The contract is written at the level of record types; the planner fills the file-label table, column-label map and per-file allowlists after header inspection. If a record type turns out not to exist, its card is removed from the order above and nothing else changes.
- **A2 (presence):** both new rows are absent, not muted, when their files are absent; present-but-empty is muted (see Surface 2). D-03 does not state the Warships rule explicitly; it follows D-01's.
- **A3 (list derivation):** list rows, headlines and Overview cards read presence and counts from `ClassifyResult`, so the worker must publish per-pane file and row counts on it; the list issues no query. HEAT and Warships files may live inside folders already classed as supported, so counts are per file or per record type, not per folder.
- **A4 (global reveal):** the "single global reveal" is shared by Login history and the HEAT geolocation card. If the reveal state is currently local to Login history, lifting it to the shell is a planner task; the fallback is a per-pane toggle that starts masked, with no address ever clear by default.
- **A5 (footer):** the real sample's unsupported folders (Authorized_Third_Parties, Bans, Bonus_Codes, Game_Forums, Personal_Coupons, Subscriptions, Surveys, Chat_History, Clans) are Phase 12 or deferred, so this phase may promote no folder; the footer then stays as it is, and the derivation rule in Surface 6 is what is binding.
- **A6 (combined caption on new panes):** the caption and tags follow the dataset's account count (N >= 2), like every other pane, even if only one account holds the pane's data; the tags then say which one.

---

## Test Hooks (data-testid)

Existing ids are unchanged. New ones:

| Test id | Element |
|---------|---------|
| `list-row-heat`, `list-row-warships-storage` | The two list rows |
| `game-filter-chip-wotc`, `game-filter-chip-heat` | The two new chips (lowercase token) |
| `heat-block`, `warships-storage-block` | Pane root (carries `data-state`, `aria-busy`) |
| `heat-card-account-stats`, `heat-card-battle-types`, `heat-card-storage`, `heat-card-geolocation` | HEAT cards (carry `data-status`: `ready`, `not-in-export`, `no-rows`, `skipped`) |
| `wows-card-crews`, `wows-card-storage` | Warships cards (same `data-status`) |
| `new-data-table` | The shared table (scroller region) |
| `new-data-skipped` | The skipped sentence in a card |
| `heat-mask-toggle` | The geolocation card's mask toggle (`data-masked`) |
| `wowp-account-stats` | The Warplanes account-statistics block in Vehicles |
| `vehicles-no-table-note` | The Vehicles note under HEAT or WoT Console |
| `account-tag`, `combined-caption` | Existing ids, now also inside the new panes |

---

## Checks For The Executor

- One account: the new panes render no tag, no caption, no extra column width, no whitespace text node. Existing panes' DOM is byte-identical to Phase 10.
- Filter chips: a HEAT-only export and a WOTC-only export render no chip node; HEAT with WoT renders All games, WoT, HEAT in that order; the active chip is always rendered; the filter resets on a new import; no route, `localStorage` or IndexedDB write.
- HEAT/WOTC under the filter: Playtime narrows with the version-bumped aggregates and the lazy rebuild equals the import-time aggregate (the pinned `PLAYTIME_VERSION` test is updated with the number).
- Each of the six card/file states renders its sentence and `data-status`; a drifted file shows the skipped sentence with its name, the import succeeds, and no import-summary warning appears.
- Every address in any new pane is masked until the single reveal, and the HEAT geolocation addresses do not appear in the Logins map, country list or tile counts.
- A planted synthetic email in each allowlisted file is absent from IndexedDB and from the rendered text and markup of every new pane.
- Zero network requests while opening each new pane (Playwright, PRIV-02). Tables over 500 rows are windowed; the large-fixture proof counts DOM nodes against the window.
- No new colour, token, media query, transition, animation or dependency; `{#each}` over rows that repeat across accounts is index-keyed (Phase 9 rule).
- e2e budget: 258 of 262 listed specs. New panes need specs (list row, each pane's states, zero-network, chips), so the three CI limits are raised together by the budget guard's rule rather than one at a time.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable (no component library, no third-party block, no new dependency) |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS (omitted: Tool none)

**Approval:** pending
