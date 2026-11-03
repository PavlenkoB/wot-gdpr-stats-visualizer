---
phase: "09"
slug: "multi-account-import-account-identity"
status: approved
shadcn_initialized: false
preset: none
created: "2026-10-16"
---

# Phase 9 - UI Design Contract

> Visual and interaction contract for the multi-account identity header, the "N accounts combined" caption, the Overview and Account-row headlines, and their empty and edge states. Every decision in `09-CONTEXT.md` (D-11, D-13..D-17) is treated as locked. Nothing here asks the user a question. Existing tokens, type roles and the 480px phone block are recorded as they are in the code, not re-specified.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (hand-rolled Svelte 5 components; `bits-ui` is not in `package.json`) |
| Icon library | none |
| Font | system-ui stack, unchanged (`src/app.css` `:root`) |

**Source of truth:** the existing Day 10 "ink + teal" palette in `src/app.css`, the sketch findings skill (`.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/`), and `08-UI-SPEC.md`.

**Registry and dependencies:** no third-party component, no new npm dependency, no new CSS file, no new media query. Component Inventory is omitted (`Tool: none`).

---

## Existing Baseline (detected, not re-specified)

Detected from `src/app.css` and `src/lib/shell/IdentityHeader.svelte`, `overview-model.ts`, `selection-state.ts`, `DashboardSection.svelte`:

- Neutral chrome tokens: `--page #ffffff`, `--list #f5f5f5`, `--border #dcdcdc`, `--ink #111111`, `--text #3a3a3a`, `--muted #5c5c5c`, `--faint #8c8c8c` (decoration only), `--focus #1a73e8`. Data tokens `--ramp-0..5`, `--flow-in`, `--flow-out` are untouched and are not used by any new surface.
- Type roles: Body, Label, Heading, Display (see Typography).
- List pane: 320px wide on desktop, sticky and internally scrolling at 900px and up, static and full width below 900px.
- One phone block: `@media (max-width: 480px)` in `src/app.css`. No component may declare its own phone-width query (guard `phase8-ui-review-guards.test.ts`).
- Single-account header DOM and test ids (`identity-nickname`, `identity-region`, `identity-created`, `identity-account-id`) are fixed by v1.0 D-13..D-17 and stay byte-identical.

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Gap between a name, its ID line and its facts block; header section padding (existing) |
| sm | 8px | Account-row vertical padding; gap between account rows |
| md | 16px | Column gap in the facts block (existing `dl` gap) |
| md+ | 20px | Header horizontal padding, equal to the list pane's existing side padding (existing) |

Exceptions: `20px` is the existing list-pane side padding, carried over from the 08-UI-SPEC extended row padding. It is recorded, not changed.

---

## Typography

Four roles, two weights (400, 600). No new size.

| Role | Size | Weight | Line Height | Used for |
|------|------|--------|-------------|----------|
| Body | 14px | 400 | 1.5 | Game list and years values; "Unknown" values |
| Label | 14px | 600 | 1.4 | Caption "As of export", "Games" and "Activity" labels, ID line, "N accounts combined" caption, ID-only row title |
| Heading | 18px | 600 | 1.3 | Per-account name in each row (h3) |
| Display | 26px | 600 | 1.3 | Multi-account title "N accounts" (desktop); collapses to 18px at phone width |

Record, do not normalise: the existing header labels use line-height 1.4 where 08-UI-SPEC says 1.5. The new Label rows follow the code (1.4) so they match the single-account header.

**ID-only row title (amended in plan 09-08, UI review finding 3).** The ID-only row's title is a **Label-role** number in `--muted`, not a Heading — it sits in the same role as the `Account ID:` line, and it shares that line's selector so the two cannot drift apart. The demotion is deliberate: an account with no `User_Info` is an ABSENCE, and an absence must not wear the row's most prominent type, or a 20-digit root reads as a nickname. It is a change of TYPE only. The element stays the same `h3`, the text stays the account root, and the row's accessible name is unchanged, so a rootless account keeps the only identifier it has (D-17, T-09-28). A named account's nickname keeps the Heading role unchanged.

---

## Color

No new hex value. Every colour is read from a `var(--*)` token.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` / `#f5f5f5` | Page and list pane background (`--page` on phone, `--list` on desktop) |
| Secondary (30%) | `#dcdcdc` | Hairline between account rows (`--border`) |
| Accent (10%) | `#111111` | Multi-account title and each account NAME (title role) |
| Text | `#3a3a3a` | Games and years values |
| Muted | `#5c5c5c` | Caption, labels, ID line, combined caption, ID-only row title |
| Destructive | none | This phase adds no destructive action |

**Accent reserved for:** the existing list (section titles, card titles, links, selected bar, the one primary button), plus, in this phase, the multi-account title and the account names inside the header rows. No other new element takes the accent.

**Not every account name is Accent (amended in plan 09-08, UI review finding 3).** A row whose account has no `User_Info` shows the account root instead of a nickname, and that number is **Muted** (`--muted`), not Accent — it is the ID line's colour and its size, because that is what it is. No new colour enters the surface: `--muted` is the token the ID line already uses, so the id-only title and the ID line are the same object typographically and cannot drift.

**Status is never colour alone.** "No activity recorded" and the year range are text. There is no status tint, dot or badge on any account row.

---

## Surfaces

### 1. Identity header, several accounts (ACCOUNT-05, D-13..D-17)

Single account: unchanged (v1.0 DOM, see Existing Baseline). The multi variant renders only when the dataset holds two or more accounts.

**(amended 2026-10-18, plan 09-11)** The multi variant renders when the ARCHIVE held two or more account folders (`ClassifyResult.rootCount`), not when the published account list has two or more entries. The folder count, never the published list, decides the variant, because the legacy `identity` is the first folder's: an archive of two folders of which only one stores data keeps the multi variant, titled `1 account`, with one row. See "Which roots each count describes" in the Copywriting Contract.

Anatomy, in DOM order, inside `section[aria-label="Account identity"][data-testid="identity-header"][data-variant="multi"]`:

1. `h2.multi-title` with text `{N} accounts`, `data-testid="identity-multi-title"`. This is the primary visual anchor of the block. Display role, desktop. Phone uses the 18px rule.
2. `p.caption` with the existing `IDENTITY_CAPTION` ("As of export"). Reused as is (D-12 applies per account, so the caption qualifies the whole list).
3. `ol` with `role="list"` and `aria-label="Accounts in this export"`, `data-testid="identity-multi-list"`. Order is D-16: first activity year ascending, then accounts with no activity, then ties and no-activity accounts by account ID in code-unit order. Styles: `margin: 0; padding: 0; list-style: none`.
4. One `li` per account, `data-testid="identity-multi-row"`, containing:
   - `h3`, `data-testid="identity-multi-name"`. Heading role, `--ink`. Text is the nickname, or `Unknown` when the User_Info row has a blank NAME. When the account has no User_Info, the text is the account ID (the ID-only row, see states), the row carries `data-user-info="absent"`, and the same `h3` takes the **Label role in `--muted`** instead of the Heading role (plan 09-08) — a conditional `class:id-only` on the element, never a second element and never a changed text.
   - `p`, `data-testid="identity-multi-id"`, Label role, `--muted`: the existing `formatAccountId(root)` ("Account ID: {root}"). Omitted on the ID-only row, because the ID is already the title (v1.0 D-16 rule).
   - `dl` (same two-column grid as the single header: `max-content 1fr`, gap `4px 16px`):
     - `dt` "Games" with `dd` `data-testid="identity-multi-games"`: friendly names joined with ", " (see Copywriting). The `dt` and `dd` are omitted when the account has no game token.
     - `dt` "Activity" with `dd` `data-testid="identity-multi-years"`: the year range, or "No activity recorded" when the account has no usable session.

Per-row fields are deliberately limited to name, ID, games and years (D-13). Region ("Location code") and creation date are not shown per row in multi-account mode. They stay in single-account mode only.

Row styling: `border-top: 1px solid var(--border)`, `padding: 8px 0`, no background, no border radius, no hover, no selected state. The rows are not interactive: there is no button, link or focus stop in the header.

### 2. "N accounts combined" caption (D-11)

- Text: `{N} accounts combined`, Label role, `--muted`, one line, `p` with `data-testid="combined-caption"`.
- Placement: inside `DashboardSection`'s provenance block, as the first line above the `ImportSummary` line, so the pane's source line and the caption read together.
- Shown only when N is two or more. For N = 1 no element is rendered (no empty node, no hidden node).
- Panes that carry it: Playtime, Login history, Vehicles, Finance, Payments (merged through `readRowsByFile`), Device info.
- Panes that do not: Overview, Account (the list of accounts itself), and the "Not yet supported" block.
- The caption is static text, not `aria-live`. The import notice slot already announces the change.
- **(amended 2026-10-18, plan 09-11)** The caption's N is the published count, the accounts that hold data (09-10 option-a). An archive of two folders of which one stores data therefore shows no caption: its published count is one, and no element is rendered.

### 3. Overview card and Account list row (N >= 2)

| Surface | Single account (unchanged) | Two or more accounts |
|---------|----------------------------|----------------------|
| Account list row headline | Location code (`identity.region`) | `{N} accounts` |
| Account list row summary | "Location code and creation date" | "Each account's ID, games and activity years" |
| Overview Account card title | "Account" | `{N} accounts` |
| Overview Account card summary | "Account created {date}" | "Earliest account created {date}" |

Rules:
- The per-account region is never shown as the export's region in multi mode, and no single account's creation date is shown as the export's date. The "earliest" summary is a minimum across accounts.
- The earliest date is the minimum `createdAt` among accounts whose value parses as a date. When none parses, the summary reads "Earliest account creation date unknown".
- The nickname is never read into the card or the row (v1.0 D-21 rule, restated below).
- **(amended 2026-10-18, plan 09-11)** The table's second column applies to an archive of two or more FOLDERS, whether or not every folder stores data. The headline and the title use the published count (the accounts that hold data), so an archive of two folders of which one stores data reads `1 account`, and one in which none stores data reads `0 accounts`. The legacy `identity` is read only for an archive that held a single folder, because it is the first folder's.

### 4. Login history, account record

When N is two or more, the single account-record row (`accountCells`) is not shown, because one account cannot stand for several. Any explanatory copy that mentions "the Account record row" must be conditional on N = 1. The caption from Surface 2 is the only account statement on that pane in multi mode.

---

## Layouts & Breakpoints

- **Desktop (900px and up):** the header sits at the top of the 320px list pane. Each account row is a stack of name, ID line and facts. Long values wrap inside the value column.
- **Tablet (480px to 899px):** the list pane is full width above the detail. Layout as desktop.
- **Phone (480px and below):** the list screen is full width. The header title and each name collapse to 18px through the single phone block. Rows keep the 8px vertical rhythm and do not switch to a horizontal layout.
- **Length:** the list grows with N. There is no "show more", no collapse and no pagination. On desktop the list pane already scrolls internally; on phone the list screen scrolls as one page.

Phone rule to add, in the existing `@media (max-width: 480px)` block only:

```
.shell [data-testid='identity-header'] .multi-title { font-size: 18px; }
```

No other new rule goes in a component media query. The name and ID wrap through `overflow-wrap: anywhere` and `min-width: 0`, as the single header does.

---

## Copywriting Contract

All new strings live in `src/lib/ui-copy.ts` as named constants or formatters, with unit tests in `tests/unit/ui-copy.test.ts`.

| Element | Copy | Constant (proposed) |
|---------|------|---------------------|
| Multi-account title, Overview card title, list row headline | `{N} accounts` (N >= 2) | `formatAccountCount(n)` |
| Same, N = 1 **(amended 2026-10-18, plan 09-11)** | `1 account`; reachable when the archive held several folders and only one stores data | `formatAccountCount(1)` |
| Same, N = 0 **(amended 2026-10-18, plan 09-11)** | `0 accounts`; reachable when the archive held several folders and none stores data | `formatAccountCount(0)` |
| List accessible name | "Accounts in this export" | `IDENTITY_MULTI_LIST_LABEL` |
| Facts label, games | "Games" | `IDENTITY_GAMES_LABEL` |
| Facts label, years | "Activity" | `IDENTITY_ACTIVITY_LABEL` |
| No usable session | "No activity recorded" | `IDENTITY_NO_ACTIVITY` |
| Years, two or more distinct years | `{first}–{last}` (en dash, no spaces), e.g. "2014–2026" | `formatActivityYears(first, last)` |
| Years, one year only | `{year}`, e.g. "2021" | `formatActivityYears(first, last)` |
| Combined caption | `{N} accounts combined` | `formatCombinedCaption(n)` |
| Account list row summary (N >= 2) | "Each account's ID, games and activity years" | `ACCOUNT_ROW_MULTI_SUMMARY` |
| Overview card summary (N >= 2, date parses) | "Earliest account created {date}" | `formatEarliestCreated(date)` |
| Overview card summary (N >= 2, no date parses) | "Earliest account creation date unknown" | `formatEarliestCreated(null)` |
| Game long names | WOT "World of Tanks"; WOTB "WoT Blitz"; WOWS "World of Warships"; WOTC "WoT Console"; HEAT "World of Tanks HEAT"; WOWP "World of Warplanes" | `formatGameLongName(token)` |
| Game list separator | ", " | used inside `formatGameLongName` |
| Unknown game token | the token, unchanged | `formatGameLongName(token)` |

Reused as is (no change): `IDENTITY_CAPTION` "As of export", `IDENTITY_ARIA_LABEL` "Account identity", `formatAccountId` "Account ID: {root}", `formatIdentityFallbackTitle`, `UNKNOWN_VALUE` "Unknown".

**Which roots each count describes (amended 2026-10-18, plan 09-11).** Two numbers cross the worker boundary, and they describe different folders.

| Count | Field and reader | Describes | Decides |
|-------|------------------|-----------|---------|
| Root count | `ClassifyResult.rootCount`, read through `rootCountOf` | Every account folder the classifier accepted, including a folder that stored nothing | The header variant, the Account list row wording, the Overview Account card wording, and the worker's Account-record gate |
| Published count | `accounts.length`, read through `accountCountOf` | The accounts that hold data (09-10 option-a) | The title's number, the rows listed, the card title, the row headline and every combined caption |

| Archive folders | Published accounts | What renders |
|-----------------|--------------------|--------------|
| 1 | 1 | The v1.0 single header (`loaded`) |
| 1 | 0 (a sole data-less folder) | The v1.0 `fallback` header |
| 2 or more | 2 or more | The multi variant with a combined caption on the six merged panes |
| 2 or more | 1 | The multi variant titled `1 account`, one row, no region or creation date, no caption |
| 2 or more | 0 | The multi variant titled `0 accounts`, no rows, no caption |

A result with no root count (a hand-built result, a cache written before plan 09-11) falls back to the published count.

Long game names are a separate table from `GAME_NAMES` (short labels "WoT", "WoT Blitz", "Warships", "Warplanes"). Existing panes keep the short labels; only the identity list uses the long names.

Order of game names in a row: fixed order WOT, WOTB, WOWS, WOTC, HEAT, WOWP, then unknown tokens in code-unit order.

**Recorded choice (Claude's Discretion):** WOWP is added to the long-name table even though D-14 lists five names, so a World of Warplanes session shows as a name, not as a raw token. Remove the entry if the user prefers the raw token.

Empty, error and destructive copy: none added. No new CTA, no new error and no new destructive action. The existing clear and replace confirmations ("your cached export data", "Replace your current dataset") already name the whole dataset and are unchanged.

---

## Accessibility

- **Landmark and name:** the header keeps `aria-label="Account identity"`. The account list is a real list (`ol` with `role="list"`) named "Accounts in this export". `role="list"` is explicit because the list-style reset drops list semantics in some engines.
- **Heading order:** `h2` (title) then one `h3` per account. The in-content section title and the header title do not compete (the header is the first heading in the list pane).
- **Accessible names:** a row has no `aria-label`, `title` or `aria-describedby`. Its text content is its name, so the screen reader reads "name, Account ID: …, Games, Activity, years" in order.
- **Nickname restatement (v1.0 D-21):** the nickname appears once per account, in that account's own row, as visible text. It never appears in an attribute, an aria-label, a tooltip or a title. Two accounts may share a nickname, so the rule is "once per row", not "once in the document".
- **Status by text:** "No activity recorded" and the year range carry all state. No colour, icon or badge encodes it.
- **Focus and targets:** the header and its rows are not interactive, so there is no focus stop and the 44px floor does not apply. Any control added later falls under the global 44px floor.
- **Contrast:** names use `--ink` on `--list` and `--page`. Labels and the caption use `--muted` (the measured text colour that already passes 4.5:1 on both surfaces; `tests/unit/charts/contrast.test.ts` covers the pairs). Values use `--text`. The ID-only row's title is `--muted` too, so an id-only row's own contrast is already covered by the same token's proof.
- **Motion:** no animation, transition, scroll or entrance effect is added. Nothing new runs under `prefers-reduced-motion`.
- **Language of ranges:** the en dash in "2014–2026" is read as "to" by common screen readers. No extra label is added.

---

## UI Considerations

Applicable state considerations resolved: 14 covered, 1 backstop, 0 unresolved (amended 2026-10-18, plan 09-11).

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | identity header, Games row | covered | Account with no game token: Games row omitted; Activity shows "No activity recorded" |
| empty | identity header, Activity row | covered | No usable session: "No activity recorded" (`IDENTITY_NO_ACTIVITY`) |
| zero-one-many | identity header | covered | (amended 2026-10-18, plan 09-11) One folder keeps the v1.0 DOM exactly; two or more folders render the multi variant, titled with the published count. That count can be 2 or more, 1 (`1 account`, one row) or 0 (`0 accounts`, no rows) when folders store no data; no export at all is the skeleton |
| zero-one-many | archive of several folders with a data-less folder | covered | (amended 2026-10-18, plan 09-11) Resolved as in the matrix under "Which roots each count describes": the variant follows the root count, the number follows the published count, the first folder's region and creation date are never shown as the export's, and no caption renders |
| zero-one-many | combined caption | covered | (amended 2026-10-18, plan 09-11) Its N is the published count; shown only when that is 2 or more, no node otherwise |
| partial | account with no User_Info | covered | ID-only row: ID is the title, `data-user-info="absent"`, no ID line, Games and Activity still shown; never another account's nickname (per-root identity pool). The title takes the **Label role in `--muted`** (14/600/1.4), not the Heading role a nickname takes, so an absence is visually distinct from an account that happens to be called a number (amended in plan 09-08); the text, the `h3` and the row's accessible name are unchanged |
| partial | User_Info row with blank NAME | covered | Name shows "Unknown"; ID line still shows |
| partial | account with sessions in one game only | covered | Single name in Games; no separator |
| partial | unknown game token | covered | Token shown raw after the known names |
| overflow | long nickname or long account ID at 480px | covered | Wraps through `overflow-wrap: anywhere` and `min-width: 0`; no truncation, no horizontal scroll |
| overflow | many accounts | covered | Every account renders, no "show more"; list grows; desktop list pane scrolls internally; the import-time root cap is the planner's value |
| overflow | very long years run | covered | Only the first and last year render, so the value stays a fixed short string |
| ordering | equal first year, or no activity | covered | Ties and no-activity accounts sort by account ID, code-unit ascending (D-16) |
| long-text | nickname and ID in a row at phone width | backstop | Visual UI-state test at 375px with a 40-character nickname and a 20-digit ID; lifts as `{ statement, verification: backstop }` |
| conditional copy | Login history account-record row | covered | Row and any copy that refers to it are shown only for N = 1 |

---

## Test Hooks (data-testid)

Single-account ids are unchanged and are not reused by the multi variant.

| Test id | Element | Variant |
|---------|---------|---------|
| `identity-header` | header section (existing) | both; `data-variant` = `skeleton` / `fallback` / `loaded` / `multi` |
| `identity-nickname`, `identity-region`, `identity-created`, `identity-account-id` | existing single-account elements | single only |
| `identity-multi-title` | `h2` "{N} accounts" | multi |
| `identity-multi-list` | `ol` | multi |
| `identity-multi-row` | each `li` | multi |
| `identity-multi-name` | each `h3` (name or ID-only title) | multi |
| `identity-multi-id` | each ID line | multi, omitted on ID-only row |
| `identity-multi-games` | each games `dd` | multi, omitted when no game |
| `identity-multi-years` | each activity `dd` | multi |
| `combined-caption` | caption line in the provenance block | N >= 2 |

---

## Checks For The Executor

- Single account: the rendered header (DOM and test ids) and the Overview and list rows for one account are unchanged. Existing `identity-privacy` specs pass without edits.
- Two or three accounts: every account's name, ID, games and years appear once, in D-16 order; no region or creation date appears per row.
- Keyed `{#each}` blocks that repeat values across accounts are keyed by index (already a planner task), so the header list and the pane tables never duplicate a key.
- The phone rule is added only inside the existing single 480px block.
- No `aria-live`, transition, animation or new colour value appears in any new rule.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable (no component library, no third-party block, no new dependency) |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS (omitted: Tool none)

**Approval:** approved 2026-10-16 (checker VERIFIED; FLAGs: accent equals ink by design, 20px is the existing list-pane padding)
