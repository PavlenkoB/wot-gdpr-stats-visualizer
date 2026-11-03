---
phase: "10"
slug: "merged-dashboard-across-accounts"
status: approved
shadcn_initialized: false
preset: none
created: "2026-10-18"
reviewed_at: "2026-10-18"
---

# Phase 10 - UI Design Contract

> Visual and interaction contract for the shared game filter (Playtime, Vehicles), the account tag chip (identity header legend, Vehicles, Logins, Payments), the reworded combined caption, and the states around them. Every decision in `10-CONTEXT.md` (D-01..D-17) and the Phase 9 contract (`09-UI-SPEC.md`) is treated as locked. Nothing here asks the user a question. Existing tokens, type roles, the 480px phone block and the sketch-findings "Day 10" palette are recorded as they are in the code, not re-specified.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (hand-rolled Svelte 5 components; no UI library, no new dependency) |
| Icon library | none (a chip carries words or one letter, never an icon) |
| Font | system-ui stack, unchanged (`src/app.css` `:root`) |

**Source of truth:** the Day 10 "ink + teal" palette in `src/app.css`, the sketch findings skill (`.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/`), `08-UI-SPEC.md` and `09-UI-SPEC.md`.

**Registry and dependencies:** no third-party component, no new npm dependency, no new CSS file, no new media query, no new colour or spacing token. Component Inventory is omitted (`Tool: none`).

**New files the contract implies (names are the planner's to confirm):** `AccountTag.svelte` (one inert chip, used by four surfaces), `GameFilter.svelte` (the radio chip row), and a sibling state module for the shared filter (`game-filter-state.ts` or inside `selection-state.ts`, Claude's Discretion in CONTEXT).

---

## Existing Baseline (detected, not re-specified)

Detected from `src/app.css`, `DashboardSection.svelte`, `Playtime.svelte`, `PlayerStats.svelte`, `VehicleTable.svelte`, `LoginTable.svelte`, `SpendSummary.svelte`, `ui-copy.ts`:

- Neutral chrome tokens: `--page #ffffff`, `--list #f5f5f5`, `--border #dcdcdc`, `--faint #8c8c8c` (decoration and borders only), `--ink #111111`, `--text #3a3a3a`, `--muted #5c5c5c`, `--sel #e0e0e0`, `--hover #ececec`, `--chip #ececec`, `--focus #1a73e8`, `--radius-control 8px`. Data tokens `--ramp-0..5`, `--flow-in`, `--flow-out` are not used by any new surface.
- Type roles: Body 14/400/1.5, Label 14/600/1.4, Heading 18/600/1.3, Display 26/600/1.3.
- One phone block: `@media (max-width: 480px)` in `src/app.css`. No component may declare its own phone-width query (guard `phase8-ui-review-guards.test.ts`). The global 44px floor for `button`, `summary` and `a` lives inside that block, so a new interactive control that is not one of those three elements (the filter chips) declares its own 44px.
- Playtime already has a native `<select>` (`data-testid="playtime-selector"`, label from `SPLIT_COLUMN_LABELS`, `GAME` splitter) inside `.selector-row`. Vehicles already has a native `<select>` (`data-testid="player-stats-title-selector"`, label "Game", options WoT / WoT Blitz / Warships / Warplanes with absent/empty suffixes). Both stay.
- Logins already has an inert muted chip, `.tag` / `data-testid="login-account-tag"` ("Account record"), in `LoginTable.svelte`: `padding 0 8px`, `1px solid --border`, radius 6px, `--chip` fill, `--muted` text, 14px / 18px line, `white-space: nowrap`. The new account tag reuses exactly this look. The "Account record" tag is hidden when N is two or more (Phase 9), so the two chips never share a table.
- `.visually-hidden` (clip pattern) is the established way to put text in the accessibility tree without a title or aria-label attribute.
- Windowed tables use constant row heights (Vehicles 40px) computed by `windowRange`; nothing is measured from the DOM.

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Gap between the filter label and its chip row; gap between the tag chip and the text after it; gap between the search input and its hint |
| sm | 8px | Gap between filter chips; chip horizontal padding inside the account tag |
| md | 16px | Chip horizontal padding in the game filter; gap between the filter row and the next control |
| lg | 24px | Existing block gap in Playtime (unchanged) |

Exceptions:
- Game filter chip height is 44px (the touch floor), set on the chip itself because a chip is a `label`, not one of the three elements the global floor reaches.
- The account tag chip is 20px tall (18px line + 2px border) and inert, so the 44px floor does not apply to it (see Accessibility). It must not make any row taller than it is today.
- `12px` (existing section gap) and `20px` (existing list-pane padding) are carried over, not changed.

---

## Typography

Four roles, two weights (400, 600). No new size.

| Role | Size | Weight | Line Height | Used for in this phase |
|------|------|--------|-------------|------------------------|
| Body | 14px | 400 | 1.5 | Empty-game body, search hint, "About these totals" body, per-account split values |
| Label | 14px | 600 | 1.4 | "Filter by game" label, every chip label (selected and unselected, same weight so a selection never shifts width), "All N accounts combined" caption, "Per account" disclosure summary |
| Heading | 18px | 600 | 1.3 | unchanged |
| Display | 26px | 600 | 1.3 | unchanged |

The account tag letter is Label role (14/600) at a fixed 18px line box, matching the existing `.tag` metrics (the `.tag` rule sets only 14px and 18px line height; the 600 weight is the one deliberate difference, so a single capital letter reads at a glance).

---

## Color

No new hex value. Every colour is read from a `var(--*)` token.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` / `#f5f5f5` | Page and list-pane surfaces; unselected chip fill is `--page` |
| Secondary (30%) | `#dcdcdc`, `#ececec` | Account tag border (`--border`) and fill (`--chip`); chip hover (`--hover`) |
| Accent (10%) | `#111111` | Selected chip text, border and 3px bottom bar |
| Selected surface | `#e0e0e0` | Selected chip fill (`--sel`), the same selection surface the list rows use |
| Text | `#3a3a3a` | Unselected chip text |
| Muted | `#5c5c5c` | Tag letter, caption, search hint |
| Focus | `#1a73e8` | 3px focus ring on the chip row (`--focus`) |
| Destructive | none | This phase adds no destructive action |

**Accent reserved for:** the existing list (section titles, card titles, links, selected bar, the one primary button) plus, in this phase, the selected state of the game filter chip (text, border and bar). The ink FILL stays reserved for the one primary button; a selected chip is `--sel` with an ink border and bar, which is the shell's own selection language. The account tag takes no accent: it is muted on `--chip`.

**Status is never colour alone.** A selected chip is also marked by the ink border, the 3px bar and the native radio checked state. Account identity is a letter, never a hue: accounts are not colour-coded, so the data ramp and flow colours are never borrowed for them.

Contrast: `--ink` on `--sel`, `--text` on `--page` and `--muted` on `--chip` are existing pairs covered by `tests/unit/charts/contrast.test.ts`; the executor adds the `--ink` on `--sel` and `--text` on `--hover` pairs to that test if not already present.

---

## Surfaces

### 1. Game filter chip row (D-01..D-05)

**Where it renders:** Playtime only. Vehicles gets no chip row (see Recorded Choices, item 1). Finance, Payments, Logins and Device info render nothing (D-02). It lives in the pane's header zone, never in the master/list column.

**Position in Playtime:** after the single `role="status"` live region and the storage notice, before the existing `GAME` `.selector-row`, so the tab order is filter chips, then the `GAME` select, then the charts. The block's 24px flex gap applies; the filter adds no margin of its own.

**Anatomy:**

```
<div class="game-filter" data-testid="game-filter">
  <span id=... class="label">Filter by game</span>
  <div role="radiogroup" aria-labelledby=... class="chips">
    <label class="chip"><input type="radio" name=... class="visually-hidden" /> <span>All games</span></label>
    <label class="chip">... WoT</label> ... WoT Blitz ... Warships
  </div>
</div>
```

- Native radio inputs, visually hidden, inside labels. This gives roving arrow-key behaviour, a single tab stop and `checked` semantics with no hand-written key handler. Arrow keys move and select immediately (native radio behaviour). No `aria-checked` or `role="radio"` is hand-written.
- Label above the chips: Label role, `--text`, 4px gap, same pattern as `.selector-row label`.
- Chip row: `display: flex; flex-wrap: wrap; gap: 8px; min-width: 0`.
- Chip: `min-height: 44px; box-sizing: border-box; padding: 0 16px; border: 1px solid var(--faint); border-radius: var(--radius-control); background: var(--page); color: var(--text)`; Label role; `display: inline-flex; align-items: center; cursor: pointer; white-space: nowrap`.
- Hover (unselected): `background: var(--hover)`.
- Selected (`:has(input:checked)`): `background: var(--sel); color: var(--ink); border-color: var(--ink); box-shadow: inset 0 -3px 0 var(--ink)`. Hover on a selected chip keeps `--sel`.
- Focus: `:has(input:focus-visible)` takes `outline: 3px solid var(--focus); outline-offset: 2px`. The ring is on the visible chip, never on the hidden input.
- No transition, no animation.

**Choice list (D-05):** `All games` first, then one chip per filterable game token present in the dataset, in fixed order WOT, WOTB, WOWS. Labels come from `formatGameName(token)`: "WoT", "WoT Blitz", "Warships" (the short labels the existing panes use). HEAT, WOTC and WOWP never get a chip in Phase 10. The list is built from a token array, so Phase 11 appends entries with no markup change.

**Visibility rules:**
- Rendered only when at least two chips, counting All games, would show different data. That holds when the dataset has at least one filterable token (WoT, WoTB, WoWS) and at least one other game token of any kind (a second filterable token, or a non-filterable one such as HEAT, because All then differs from the single game). The chips are All games plus each filterable token present.
- Not rendered (no node, no empty wrapper) when All would equal the only view: one game token, no session file, or only non-filterable tokens (HEAT, WOTC). One rule, no per-case exceptions.
- The currently selected token is always rendered even if no session of it exists (it may have been set from Vehicles), so the active state is visible and reversible.

**Behaviour:**
- Selecting a chip writes the shared filter immediately; there is no apply button.
- Selecting writes component state only: no route, no storage, no URL change (D-01). Reset to `All games` on reload and on a new import.
- Playtime recomputes through the existing `updating` path: the previous slice stays on screen, the status line says "Updating charts..." (`PLAYTIME_UPDATING`), the block carries `aria-busy="true"`. Chips stay enabled during an update (latest request wins). The chips never move or disappear while updating.

### 2. Playtime under a filter (D-03, D-06, D-07)

- The filter narrows everything in the block: tiles, calendar heatmap, hour grid, duration list. No new chart, tile or layout.
- `All games` keeps the existing `GAME` splitter exactly. With one game selected the splitter receives the filtered slice and follows its existing rule; the contract adds no hide rule for it.
- A caption does not repeat the filter: the chip row already states it in text.
- **About these totals** (new, D-06): one `AboutDisclosure` (existing component) directly under the tiles, `testId="about-playtime-totals"`, name constant "summary" so the summary reads "About this summary" through `formatAboutThis`. Shown only when the filter row is shown or the dataset has two or more accounts; absent otherwise so the single-account single-game DOM stays byte-identical to v1.0. Body copy is in the Copywriting Contract.

### 3. Vehicles (D-04, D-09, D-11)

- No chip row. The existing `Game` select is the Vehicles face of the shared filter. It keeps its label, test id, option order and absent/empty suffixes.
- The select's displayed value is the APPLIED title (the worker's answer), which is the shared filter when it is WoT, WoT Blitz or Warships, and the existing worker fallback when the filter is `All games`.
- Changing the select writes the shared filter to that title (WoT, WoT Blitz, Warships). Choosing `Warplanes` is Vehicles-local: it does not write the shared filter, which has no Warplanes choice (D-05), and Playtime is left as it was. A later filter change from Playtime replaces it.
- Rows: one per account per vehicle (D-09). The account tag chip is the first thing in the vehicle cell, before the vehicle name (Surface 5). Tags are absent for one account.
- Sort and column picker are unchanged. No sort-by-account (D-11).
- Search: when two or more accounts, a hint line sits under the search input (Copywriting). The search matches the tag letter and the account ID in addition to the vehicle text (D-11).
- Battle-type summary sums per code across accounts; no visual change.

### 4. Combined caption, reworded (D-12)

- Text becomes `All {N} accounts combined` (N is two or more). One line, Label role, `--muted`, `data-testid="combined-caption"`, same position as Phase 9 (first child of the provenance block). Hidden, with no node, for one account.
- Same panes as Phase 9: Playtime, Login history, Vehicles, Finance, Payments, Device info. Same N semantics (published count).
- It is static text, not `aria-live`.

### 5. Account tag chip (D-10)

One inert component, `AccountTag`, four placements.

**Look:** the existing `.tag` chip: `display: inline-block; padding: 0 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--chip); color: var(--muted); font-size: 14px; font-weight: 600; line-height: 18px; min-width: 24px; text-align: center; white-space: nowrap; vertical-align: middle`. Content: one capital letter.

**Letter assignment:** in identity-header order (first activity year ascending, then accounts with no activity, ties by account ID in code-unit order, Phase 9 D-16): A, B, C, then AA, AB and so on past 26. The same account always gets the same letter on every pane in one dataset. Letters are derived, not stored.

**Accessible content:** the letter is `aria-hidden="true"`; a sibling `.visually-hidden` span carries the full phrase. In data rows the phrase is `Account B, ID {id}, nickname {name}` (nickname omitted when the account has none or it is blank). In the identity header legend the phrase is `Account B` only, because the row already shows the ID and nickname as visible text. The tag has no `title`, no `aria-label`, no `aria-describedby` and no tooltip: the ID and nickname are text content only, never an attribute (the v1.0 D-21 rule, see Recorded Choices, item 3).

**Placements:**

| Pane | Where | Notes |
|------|-------|-------|
| Identity header (multi) | A flex row `[chip][h3]` inside each `identity-multi-row`, chip before the name, 8px gap, chip aligned to the first text baseline | The legend (D-10). The `h3` text, ID line and facts are unchanged. Single-account header unchanged |
| Vehicles | Prefix of the sticky first cell, before the name, 4px gap | The first column grows from 160px to 192px (`+32px`) only when two or more accounts; the table minimum width is the sum of the same geometry record. Row stays 40px |
| Logins | Prefix of the sticky first cell (the masked IP), before the address, 4px gap | First column grows by 32px only when two or more accounts. The IP stays masked until the single global reveal; the tag reveals nothing about it. Row height unchanged |
| Payments | In the per-account detail only (see Surface 6) | Aggregated year and game tables carry no tag |

**Hidden entirely on a single-account dataset:** no node, no wrapper, no extra column width, no extra whitespace text node. The conditional tag adjoins its neighbours without whitespace in the template (same load-bearing pattern as the combined caption in `DashboardSection.svelte`).

**Scale:** a tag adds at most one `span` with two children per rendered row of a windowed table. Windowing is unchanged, so the node count stays bounded by the window, not the rows (SCALE-01). No per-row event listener is attached.

### 6. Finance and Payments (D-14)

- Same-currency totals sum across accounts; currencies are never converted or blended. Existing per-currency cards, charts and tables are unchanged and no new headline figure is added.
- When two or more accounts, one body line under each pane's heading (Finance and Payments): the combined note (Copywriting).
- Payments, per-account split: each currency card (`spend-card`) gains one native `details`/`summary` disclosure after its tables, `data-testid="spend-per-account"`, summary "Per account" (Label role). It holds a small table: columns Account (tag chip + sr-only phrase), Paid, Total, one row per account that has amounts in that currency, in header order. Collapsed by default; the summary is the only added tab stop (global 44px floor already covers `summary`). Absent for one account.
- If the planner finds that Payments has a true per-payment row listing anywhere, the tag goes in that row's first cell with the same look; the disclosure is then unnecessary there.

### 7. Logins (D-13)

- One table, one map, one country list across accounts. No per-account card and no new row. The tag prefixes each login row's first cell (Surface 5). Country list counts cover all accounts and look as they do today.
- City-level detail and the global IP reveal are unchanged; nothing new is fetched or revealed by the tag.

---

## Layouts & Breakpoints

- **Desktop (900px and up) and tablet:** chip row sits in the detail pane, wrapping if needed; labels are single line.
- **Phone (480px and below):** the four chips (All games, WoT, WoT Blitz, Warships) fit one line in the 448px content width; if a locale or font makes them overflow they wrap to a second 44px line with an 8px row gap. No horizontal scroll, no truncation. The tag grows the first table column by 32px; those tables already scroll horizontally in their own scroller with sticky first column, so the page does not widen.
- No component media query is added. Chip height is 44px at every width so no phone-only rule is needed.

---

## Copywriting Contract

All strings live in `src/lib/ui-copy.ts` as named constants or formatters, with unit tests in `tests/unit/ui-copy.test.ts`.

| Element | Copy | Constant (proposed) |
|---------|------|---------------------|
| Filter label (and radiogroup name) | "Filter by game" | `GAME_FILTER_LABEL` |
| All option | "All games" | `GAME_FILTER_ALL` |
| Game chips | "WoT", "WoT Blitz", "Warships" | `formatGameName(token)` (existing) |
| Combined caption, N >= 2 | `All {N} accounts combined` | `formatCombinedCaption(n)` (changed) |
| Account tag phrase, data rows | `Account {letter}, ID {id}, nickname {name}`; without `, nickname {name}` when none | `formatAccountTagLabel(letter, id, nickname)` |
| Account tag phrase, header legend | `Account {letter}` | `formatAccountLegendLabel(letter)` |
| Playtime empty game, heading | none: the body line below is the whole message | n/a |
| Playtime empty game, body | `No {game} sessions in this export. Choose All games to see all of your playtime.` | `formatNoGameSessions(token)` |
| About disclosure name | "summary" (reads "About this summary") | `ABOUT_NAME_PLAYTIME_TOTALS` |
| About body | "Playtime is counted once. When sessions overlap, whether on different accounts or in different games, the overlap counts as a single stretch of play. Hours, sessions and active days all come from those stretches. A game's hours are worked out from that game alone, so All games can show fewer hours than the games added together." | `PLAYTIME_MERGE_ABOUT` |
| Vehicles search hint (N >= 2) | "Also matches account letters and account IDs." | `VEHICLE_SEARCH_ACCOUNT_HINT` |
| Finance and Payments note (N >= 2) | "Amounts in the same currency are added across all accounts. Currencies are never converted." | `FINANCE_COMBINED_NOTE` |
| Payments disclosure summary | "Per account" | `SPEND_PER_ACCOUNT_SUMMARY` |
| Payments disclosure column header | "Account" | `HEADER_ACCOUNT` |

Reused as is: `PLAYTIME_UPDATING` "Updating charts...", `PLAYTIME_LOADING` "Calculating playtime...", `PLAYTIME_NO_USABLE_SESSIONS`, `TITLE_CONTROL_LABEL` "Game", `formatTitleOption` suffixes ("(not in this export)", "(no rows in this export)"), `VEHICLE_NO_MATCH`, `formatAccountCount`, `UNKNOWN_VALUE`.

| Element | Copy |
|---------|------|
| Primary CTA | none added. The phase adds no primary button; the filter and the disclosure are controls, not calls to action |
| Empty state heading | none added (the body line carries the message) |
| Empty state body | `No {game} sessions in this export. Choose All games to see all of your playtime.` (Playtime); Vehicles uses the existing per-title state lines |
| Error state | none added. Existing Playtime, Vehicles, Finance and Logins error copy is unchanged; a failed filtered recompute uses the existing fixed `PLAYTIME_ERROR` sentence and keeps the chips usable so the user can pick All games |
| Destructive confirmation | none: no destructive action in this phase. The existing clear and replace confirmations are unchanged |

Rules:
- Account IDs and nicknames are untrusted zip content: rendered as text, never as markup, never in an attribute.
- "All {N} accounts combined" is always plural (N >= 2); no singular variant exists because the caption is not rendered for one account.
- Existing tests that match "{N} accounts combined" exactly must be updated to the new wording; the executor searches for the old string rather than assuming.

---

## Accessibility

- **Filter semantics:** a `radiogroup` named by its visible label "Filter by game"; native radio inputs inside labels. One tab stop for the group, arrows move and select, Space is native. Tab order inside Playtime: filter group, `GAME` select, charts and tables.
- **Chip target:** 44px tall at every width, and at least as wide as its text plus 32px padding. The label wraps the input, so the whole chip is the hit area.
- **Announcements:** the chips add no live region. A filter change is announced by the existing single Playtime `role="status"` line ("Updating charts..."), which already clears when the slice is ready. The block's `aria-busy` is the existing mechanism. The Phase 8/9 page-wide count of explicit `aria-live` attributes is unchanged.
- **Vehicles select:** unchanged native control; the filter change from Playtime changes its value, which is announced when the user next focuses it. No extra announcement.
- **Account tag:** inert text. Letter is `aria-hidden`; the full phrase is `.visually-hidden` text in the same cell, so a screen reader reads "Account B, ID 5012345678, nickname Tanker, {value}". The cell has no `title` or `aria-label`. In a header row the legend reads "Account B" then the visible name.
- **Touch floor (reading of D-10):** the account tag is not interactive, so the 44px floor applies to the interactive things around it: every filter chip is 44px, the Payments `summary` is 44px (global rule on phone), and no tag adds a tap target or shrinks a row's existing one. See Recorded Choices, item 2.
- **Search:** the hint is linked to the search input with `aria-describedby` (existing id pattern `${selectId}-search`).
- **Status by text:** a selected game, an empty game and a hidden filter are each stated in words or by absence; no state relies on colour. Contrast pairs listed under Color.
- **Motion:** no animation, transition, scroll or entrance effect. Nothing new runs under `prefers-reduced-motion`.
- **Privacy:** no nickname or ID enters `document.title`, any attribute, a tooltip, storage, or a log. The Playwright privacy assertion keeps passing: its fixture email and birth date still appear nowhere, and the nickname appears only as text content (header row and sr-only tag text).

---

## UI Considerations

Applicable state considerations resolved: 14 covered, 1 backstop, 1 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| zero-one-many | game filter chip row | covered | Rendered only when at least one filterable token and at least one other game token are present (WoT+WoTB and WoT+HEAT show it; WoT alone, HEAT+WOTC and no sessions render no node); the active choice is always rendered |
| zero-one-many | account tag, combined caption, Vehicles search hint, finance note, Payments disclosure | covered | Rendered only for two or more accounts; one account renders no node, no column width and no whitespace text node, so the v1.0 DOM is byte-identical |
| empty | Playtime with a game that has no sessions | covered | Tiles and charts are replaced by the empty-game body line in Copywriting; chips stay so All games is one tap away |
| empty | Vehicles with the filter on a title that has no rows | covered | Existing `titleState` suffix and info line (`formatTitleNotInExport`, `formatTitleNoRows`); no new copy |
| empty | filter All with only non-filterable games (HEAT, WOTC) | covered | No filterable token (HEAT, WOTC only): chip row hidden; All is the only view. One filterable token plus HEAT: row shown with All games and that token |
| loading | filter change on Playtime | covered | Existing `updating` path: previous slice stays, "Updating charts..." in the one live region, `aria-busy`, chips enabled, latest request wins |
| loading | first import of the large three-account fixture | covered | Existing skeleton and `Calculating playtime...`; no new spinner or progress element |
| partial | account with sessions in one game only | covered | Appears in All games; absent from a game it never played; its tag letter is unchanged |
| partial | account with no nickname or no User_Info | covered | Tag phrase omits `, nickname {name}`; the letter and ID still show |
| partial | overlap across accounts or games | covered | Explained by "About this summary"; tiles stay consistent with each other (merged stretches) |
| ordering | tag letters | covered | Header order (first year, no-activity next, then account ID in code-unit order); stable across panes |
| overflow | many accounts | covered | Letters continue A..Z, AA, AB; the chip is `min-width: 24px` and grows with its text; the first column is fixed at +32px, with horizontal scroll inside the existing scroller |
| overflow | 54,000-row Virtual_Currencies and large vehicle/login lists | covered | Windowed tables keep a constant row height; at most one tag `span` per rendered row; DOM node count bounded by the window, asserted in the SCALE-01 e2e |
| conditional copy | Login account-record row, Phase 9 | covered | Still hidden at N >= 2, so the "Account record" tag and the account tag never coexist |
| long-text | tag phrase with a 40-character nickname | 🧪 backstop | Visual UI-state test at 375px; the phrase is `.visually-hidden`, so it cannot widen a cell; lifts as `{ statement, verification: backstop }` |
| ordering | Vehicles filter on All, the user opens Playtime and sees a different game than Vehicles | ⚠ unresolved | Vehicles falls back to the first title with rows when the filter is All (D-04); no visual cue says which title that is beyond the select. Planner treats as an assumption; a hint line can be added later without a contract change |

---

## Recorded Choices (Claude's Discretion and conflicts between upstream decisions)

1. **No chip row on Vehicles.** D-02 says the filter is "the same chip row inside each pane's header", while D-04 says the filter drives the existing title switcher with "no second widget". The contract follows D-04: the existing `Game` select is the Vehicles control, and a second chip row would be exactly the second widget D-04 forbids. If the user wants the chips on Vehicles as well, they replace the select and the `player-stats-title-selector` test id changes.
2. **Account tag is inert, not a 44px control.** D-10 says the chip "must keep the 44px touch floor". A letter chip inside a 40px windowed row cannot be 44px tall without changing the row-height geometry `windowRange` depends on. It is therefore inert text with the detail in sr-only text, and the 44px floor is held by every interactive control. If a tappable row-detail popover is wanted, it is a new interaction and needs its own decision.
3. **Nickname in row text.** D-10 puts the nickname in the row's accessible name; v1.0 D-21 allowed it in the header only and never in attributes. The contract allows nickname as `.visually-hidden` text content in rows (never an attribute, title, label or tooltip), and the privacy e2e must be extended to assert exactly that. This is a deliberate relaxation of D-21 and the planner should surface it for approval.
4. **Warplanes on Vehicles.** The select keeps its Warplanes option; choosing it does not write the shared filter (no Warplanes choice in D-05).
5. **Payments has aggregated tables, not per-payment rows.** The tag cannot sit on aggregate rows without inventing a split, so the account tag appears only in the "Per account" disclosure (D-14: per-account split lives in detail only).
6. **About text lives in a new "About this summary" disclosure** under the Playtime tiles, because the tiles are where the "All can be smaller than the sum" figures appear.
7. **Selected chip uses `--sel` with an ink border and bar,** not an ink fill, to keep the one filled-ink element the primary button.

---

## Amendments at plan-phase (2026-10-18)

Recorded by the planner from the decisions D-07 (amended), D-18, D-19, D-20 and D-21 in `10-CONTEXT.md`. Each item replaces the wording it names; nothing else in this contract changes.

1. **Login rows carry one chip per account (D-18; amends Surface 5 "Logins" and Surface 7).** A login row is one distinct IP and may carry several accounts. The sticky first cell shows one chip per account in the row's account list, in identity-header order, before the masked address, 4px apart, `flex-shrink: 0`. The first column grows by 64px (160px to 224px, room for three chips and an address) only when two or more accounts exist; with one account it is 160px and the cell is Phase 9's. At most three chips are drawn. Any account beyond the third is summarised by one muted plain-text node `+N` (`formatAccountOverflow`) and still has its full visually-hidden phrase, so no account is lost to assistive technology. The address keeps its two-line wrap in the remaining width; row height stays 40px. The chip never reveals anything about an address.
2. **About wording follows D-07 as amended (amends Surface 2 and the Copywriting row `PLAYTIME_MERGE_ABOUT`).** Sessions and active days keep v1.0 counting (sessions are usable rows; active days are the distinct start days); only hours take the union of intervals. The original sentence "Hours, sessions and active days all come from those stretches" is withdrawn because it would be false. The body copy is: "Playtime is counted once. When sessions overlap, whether on different accounts or in different games, the overlap counts as a single stretch of play, so hours are the time covered by at least one session. Sessions and active days are counted from the sessions recorded. A game's hours are worked out from that game alone, so All games can show fewer hours than the games added together."
3. **Nickname as row text is approved (D-19; closes Recorded Choice 3).** The nickname appears as visually-hidden TEXT content in tagged rows. It is never in an attribute, title, aria-label, aria-describedby, data attribute or tooltip. The privacy assertion is restated: on tagged panes the nickname's occurrences in the markup equal its occurrences in the rendered text, and no attribute of the detail pane or the identity header contains a nickname or an account ID. The Overview and Account panes carry no tagged rows and keep the exactly-once rule; a single-account dataset renders no tag at all, so `identity-privacy.spec.ts` is unchanged.
4. **Vehicles header across accounts (D-20).** The Vehicles header sums the lifetime battles of the accounts that contribute a row. The premium expiry is shown only when exactly one account contributes; with two or more the expiry term and value are omitted (the lifetime-battles term stays). One account renders exactly Phase 9's header.
5. **How the shared filter is written from Vehicles (D-21; clarifies Surface 3).** Choosing WoT, WoT Blitz or Warships in the Vehicles `Game` select sets the shared filter to that title. Choosing Warplanes leaves the shared filter exactly as it was (it is neither cleared nor set). Opening Vehicles with a filter set asks for that title; with All the worker's first-title-with-rows rule applies and the select shows the applied title.
6. **Empty-game recovery (clarifies Surface 1 visibility).** When the active filter token has no usable session in the dataset, the chip row still renders (the active token is always shown), the body line replaces the tiles and charts, and the chips stay enabled so All games is one tap away.

---

## Test Hooks (data-testid)

Existing ids are unchanged. New ones:

| Test id | Element |
|---------|---------|
| `game-filter` | Wrapper of the label and radiogroup (Playtime) |
| `game-filter-chip-all`, `game-filter-chip-wot`, `game-filter-chip-wotb`, `game-filter-chip-wows` | Each chip label (lowercase token) |
| `account-tag` | Each tag chip (header legend, Vehicles, Logins, Payments disclosure) |
| `playtime-game-empty` | Empty-game body line |
| `about-playtime-totals` | The "About this summary" disclosure |
| `vehicle-search-hint` | Search hint line |
| `finance-combined-note` | Finance and Payments note |
| `spend-per-account` | Payments per-currency disclosure |
| `combined-caption` | Existing id, new wording |

---

## Checks For The Executor

- One account: Playtime, Vehicles, Logins, Finance and Payments DOM is byte-identical to Phase 9. No tag, no caption, no hint, no note, no disclosure, no extra column width, no whitespace text node.
- Two or three accounts: every vehicle row, login row and header row shows its tag; the same account gets the same letter everywhere.
- The filter is session state: reload and a new import return it to All games; no route, `localStorage` or IndexedDB write.
- A filter change keeps the previous slice on screen until the new one is ready, and the chips never disappear.
- `{#each}` blocks that repeat values across accounts stay index-keyed (Phase 9 rule).
- The only CSS media query touched is the existing `@media (max-width: 480px)` block, and only if a rule is genuinely needed there; the planned rules need none.
- No `aria-live`, transition, animation or new colour value appears in any new rule.
- The e2e budget of 262 is at 258: new specs must raise or reconcile the three CI limits together (D-17).

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
