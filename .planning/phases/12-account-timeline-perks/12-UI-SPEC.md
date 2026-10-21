---
phase: "12"
slug: "account-timeline-perks"
status: approved
reviewed_at: "2026-10-20"
shadcn_initialized: false
preset: none
created: "2026-10-20"
---

# Phase 12 - UI Design Contract

> Visual and interaction contract for the Account timeline pane, the Perks pane, the pane-local kind filter, the cross-account merged-entry display, the code and IP masking inside both panes, and the states around them. Every decision in `12-CONTEXT.md` (D-01..D-15), the Phase 11 contract (`11-UI-SPEC.md`), the Phase 10 contract (`10-UI-SPEC.md`) and the sketch findings (Day 10 "ink + teal", master-detail shell) is treated as locked. Nothing here asks the user a question: gaps are recorded as assumptions at the end. Existing tokens, type roles, the 480px phone block and the 44px floor are recorded as they are in the code, not re-specified.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (hand-rolled Svelte 5 components; no UI library, no new dependency) |
| Icon library | none (no icon is added; badges, chips and rows carry words) |
| Font | system-ui stack, unchanged (`src/app.css` `:root`) |

**Source of truth:** `src/app.css`, the sketch findings skill (`.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/`), `10-UI-SPEC.md`, `11-UI-SPEC.md`, and the Phase 11 new-data components (`src/lib/features/new-data/`: `NewDataCard.svelte`, `NewDataTable.svelte`, `HeatPane.svelte`), which are the template for a promoted folder with allowlist, provenance line, card states and windowed table.

**Registry and dependencies:** no third-party component, no new npm dependency, no new CSS file, no new media query, no new colour, spacing or type token. Component Inventory is omitted (`Tool: none`).

**New files the contract implies (names are the planner's to confirm):** one pane component per list row (`AccountTimeline`, `Perks`), one kind-badge span and one kind-chip row inside the timeline, the two `PaneId`s (`account-timeline`, `perks`), and a code mask formatter beside `maskIp`. The card and table are the Phase 11 `NewDataCard` / `NewDataTable`, extended (not forked) for the multi-chip first cell and the masked-code cell. Nothing else is new UI.

---

## Existing Baseline (detected, not re-specified)

Detected from `src/app.css`, `AccountTag.svelte`, `reveal-state.ts`, `selection-state.ts`, `src/lib/features/new-data/*`, `src/lib/geo/ip.ts`, `ui-copy.ts` and the two prior contracts:

- Neutral tokens: `--page #ffffff`, `--list #f5f5f5`, `--border #dcdcdc`, `--faint #8c8c8c` (borders and decoration only, never text), `--ink #111111`, `--text #3a3a3a`, `--muted #5c5c5c`, `--sel #e0e0e0`, `--hover #ececec`, `--chip #ececec`, `--focus #1a73e8`, `--radius-card 8px`, `--radius-control 8px`. The data ramp `--ramp-0..5` and flow colours are not used (no chart).
- Type roles: Body 14/400/1.5, Label 14/600/1.4, Heading 18/600/1.3, Display 26/600/1.3.
- One phone block (`@media (max-width: 480px)` in `src/app.css`); components declare no media query. The 44px floor for `button`, `summary` and `a` lives in that block; a chip is a `label` and declares its own 44px.
- Panes are a fixed `PANE_ORDER` with `PANE_TITLES`, `PANE_SECTION` and one `paneEntries(result)` derivation shared by the list row, the Overview card and the detail header. Optional panes (`OPTIONAL_PANE_IDS`, today HEAT and Warships) are absent from the list when the export holds none of their files and muted when present with no rows; the list issues no worker query.
- `AccountTag`: one inert letter plus a `.visually-hidden` phrase, no attribute carrying an ID or nickname. A row that belongs to several accounts shows one chip each in identity-header order, at most three, then one muted `+N` node (`formatAccountOverflow`, Phase 10 amendment 1).
- `maskIp` keeps the first three octets or groups and ends in the fixed text `xxx`; anything unparseable answers `xxx` and never echoes its input. The single global reveal is `reveal-state.ts` (stamped to `importedAt`, reset on every new dataset, never persisted). The toggle pattern is `MASK_TOGGLE_SHOW/HIDE`, `MASK_CAPTION_*`, `MASK_ANNOUNCE_*`, `data-masked`.
- `NewDataCard` has four states (`not-in-export`, `no-rows`, `skipped`, `ready`) with `data-status`; `NewDataTable` is a named focusable scroller with sticky header and sticky first column, 40px rows, plain up to 500 rows and windowed above, `not reported` for null cells.
- `AboutDisclosure` (Phase 10) renders `details`/`summary` "About this {name}".
- `GameFilter.svelte` is the radio-chip-row pattern (native radios in labels, 44px chips, selected = `--sel` + ink border + 3px bar).

---

## Spacing Scale

Declared values (multiples of 4); the same scale as Phases 10 and 11, with no new token:

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Gap between an account tag and the text after it; between the tags of a merged row; between a card title and its caption; between the kind filter label and its chips |
| sm | 8px | Gap between chips; vertical gap inside a card; kind badge horizontal padding; cell vertical padding |
| md | 16px | Card padding; gap between stacked cards and between pane zones (header, filter, table); chip horizontal padding |
| lg | 24px | Existing block gap in Playtime (unchanged; not used by a new surface) |

Exceptions:
- Kind-filter chip height is 44px (set on the chip itself).
- Table rows are 40px (the Vehicles, Logins and Phase 11 windowed row height) so a plain table and a windowed table look identical and `windowRange` keeps its one constant.
- Cell horizontal padding `12px` is carried over from `DeviceTable.svelte` and `NewDataTable.svelte`, not introduced.
- The kind badge is 20px tall (18px line + 2px border) and inert, so the 44px floor does not apply to it; it must not make a 40px row taller.
- First-column geometry (one record, as in Vehicles and Logins): a table whose rows carry at most one tag grows the first column by 32px at two or more accounts (Perks tables except Subscriptions); a table whose rows may carry several tags grows it by 64px (Account timeline, Subscriptions). At one account the first column is unchanged.

---

## Typography

Four roles, two weights (400, 600). No new size.

| Role | Size | Weight | Line Height | Used for in this phase |
|------|------|--------|-------------|------------------------|
| Body | 14px | 400 | 1.5 | Pane intro, status/skipped/empty sentences, table cells (date, entry value), masked and revealed codes and addresses, About disclosure body |
| Label | 14px | 600 | 1.4 | Card titles (`h3`, ink), table column headers (muted), kind badge text, kind chip labels (selected and unselected, same weight so a selection never shifts width), "Filter by kind" label, mask toggle, About summary |
| Heading | 18px | 600 | 1.3 | unchanged (not used by a new surface) |
| Display | 26px | 600 | 1.3 | Pane titles in the detail header (existing shell, unchanged) |

Captions (`From {file}`, the timeline showing-count line, the mask caption) are Body size at line-height 1.4 in `--muted`, the existing `.caption` treatment. The muted secondary parts of a timeline entry are Body 400 in `--muted`.

---

## Color

No new hex value. Every colour is read from a `var(--*)` token.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` / `#f5f5f5` | Page, card fill, kind badge fill (`--page`); table header and dashed skipped cards (`--list`) |
| Secondary (30%) | `#dcdcdc`, `#ececec` | Card, scroller and kind badge borders (`--border`); account tag fill (`--chip`); chip hover (`--hover`) |
| Accent (10%) | `#111111` | Card titles, selected kind chip text/border/bar, selected list row bar (all existing shell language) |
| Selected surface | `#e0e0e0` | Selected kind chip fill and selected list row (existing) |
| Text | `#3a3a3a` | Cells, kind badge text, unselected chip text |
| Muted | `#5c5c5c` | Column headers, captions, secondary entry parts, `not reported`, tag letter |
| Focus | `#1a73e8` | 3px focus ring on chips, scrollers, rows, toggle (existing) |
| Destructive / error | `#c5221f` on `#fce8e6`, text `#8a1c17` | The existing fixed-sentence error panel only (`role="alert"`); no destructive action |

**Accent reserved for:** the existing list and shell selection language, card titles in ink, and the selected state of the kind filter chip. The filled-ink fill stays reserved for the one primary button, which this phase does not add to.

**Kinds are words, never hues.** A ban is not red, a name is not blue: the six kind badges are identical in colour and differ only in their word. Account identity is a letter (Phase 10), never a colour. A masked value is stated by its `xxx` form and the caption, not by a colour.

**Status is never colour alone.** Skipped, not-in-export, no-rows, not-reported, masked/revealed and merged-across-accounts are each stated in words; the dashed border on a skipped card only reinforces the sentence.

Contrast: no new pair (`--text` on `--page`, `--muted` on `--page`, `--muted` on `--list`, `--muted` on `--chip`, `--ink` on `--sel` are covered by `tests/unit/charts/contrast.test.ts`). The kind badge uses `--text` on `--page`.

---

## Surfaces

### 1. List rows (D-05, D-09)

Two new rows in the existing `.row` anatomy (title 14/600 left, headline 14/600 right, summary 12.5px muted, 56px minimum, 64px on phone, chevron on phone).

**Order in the list:** Overview, Playtime, Login history, Vehicles, HEAT, Warships crews & storage, Finance, Payments, **Perks**, Device info, **Account timeline**, Account, Not yet supported. Perks sits with the money rows because it lists entitlements and receipts; Account timeline sits directly above Account because it is that account's history. (Recorded Choice 1.)

| Row | Title (`PANE_TITLES`) | Headline | Summary line |
|-----|-----------------------|----------|--------------|
| Account timeline | `Account timeline` | `formatRowCount(rows)` across its five files (stored rows, before merging) | `Names, services, bans, third parties · {n files}` |
| Perks | `Perks` | `formatRowCount(rows)` across its four files | `Subscriptions, coupons, codes, surveys · {n files}` |

- **Presence rule (D-05, same as Phase 11 A2):** a row renders only when the export holds at least one file of that pane (present-but-empty counts as present). Absent means no row, no muted placeholder, no Overview card and no count in "not in this export". Present but no rows (header-only, or every allowlist column drifted in every file) renders the row muted with headline em dash and the existing `formatSectionStatus('empty', ...)` sentence; it stays selectable and its detail explains each file's state.
- **Headline is the stored-row count, not the merged count.** The list derives counts from `ClassifyResult` without a worker query (Phase 11 A3), and merging identical rows happens when the pane model is built (D-12). The pane's merge note (Surface 5) reconciles the two numbers in words.
- **Navigation:** `stepSelection` and `j`/`k`/arrows walk only the rendered rows (clamped, not wrapped). A new dataset that lacks the selected pane falls back to Overview.
- **Test ids:** `list-row-account-timeline`, `list-row-perks`; panes `account-timeline` and `perks`.

### 2. Account timeline pane (D-01, D-06, D-07, D-10, D-11, D-14)

**Pane header zone** (top to bottom, 16px gap between zones, 4px inside a zone):

1. Title `Account timeline` (Display, existing detail header).
2. Provenance line `From account history files · {n files}, {n rows}` (`formatNewDataProvenance`, stored rows), then at N >= 2 the combined caption `All {N} accounts combined` (unchanged component and test id).
3. Intro paragraph (Body, `--text`): `TIMELINE_INTRO`.
4. Merge note, only when at least one entry was merged across accounts (Surface 5).
5. Per-file state lines, only for a file that is skipped or header-only (below).
6. Mask block (toggle + caption), only when at least one rendered entry carries a maskable value (Surface 4).
7. `AboutDisclosure` "About this timeline" (`TIMELINE_ABOUT`), closed by default.

**Per-file state lines (D-03).** The merged list has no per-file card, so a file that cannot contribute is named in a body info line (`.body.info`, neutral, `data-testid="timeline-file-state"`, one per file, canonical file label from `NEW_DATA_FILE_LABELS`, never a zip entry name):
- skipped (file in the export, parsed, none of its columns on the allowlist): `formatNewDataSkipped(file)`; the import succeeded and there is no banner or import-summary warning;
- header-only: `formatDeviceNoRows(file)`;
- absent: no line (the kind chips already show which kinds exist; a missing optional file is not an event).

**Whole-pane empty:** every present file skipped or header-only means no chip row, no table, no toggle: the pane shows the per-file lines only, and the list row is muted with `empty`.

**Kind filter chip row (D-06, pane-local).**
- Same anatomy as `GameFilter` (native radios, visually hidden, in labels; `radiogroup` named by a visible label "Filter by kind"; arrows move and select; one tab stop).
- Chips: `All entries`, then one chip per kind that has at least one entry, in fixed order Name, Service, Language, Country, Ban, Third party.
- **Visibility:** the row renders only when at least two kinds have entries (one kind means All is the only view; no node, no empty wrapper). A chip exists only for a kind with at least one entry, so a filtered view is never empty.
- Chip look and states are the Phase 10 chip verbatim: `min-height: 44px; padding: 0 16px; border: 1px solid var(--faint); radius var(--radius-control); background var(--page); color var(--text)`; hover `--hover`; selected `--sel` + `--ink` text, ink border, `inset 0 -3px 0 var(--ink)`; focus-visible ring 3px `--focus` offset 2px on the chip. No transition.
- **State:** component-local, reset to All entries on every new dataset (keyed to `importedAt` by a pure read, the `reveal-state.ts` rule). Not shared with any other pane, not written to a route, storage or URL.
- **Phone:** seven chips (All entries + six kinds) exceed the 448px content width and wrap to a second 44px line with the existing 8px gap. No horizontal scroll, no truncation; chips keep `white-space: nowrap`.
- **Showing line** directly under the chips (`timeline-showing`, caption role): `Showing {n} of {m} entries` where n is the filtered and m the total merged entry count. This line is the pane's one `role="status"` region: it carries the loading sentence while the model builds and the showing sentence after, so a chip change is announced by the same words the sighted reader sees. It also renders (without chips) when there is no chip row.

**Timeline table (one table, one chronology, D-06).**
- Scroller, header, cell and windowing treatment are the Phase 11 `NewDataTable` treatment: `role="region"`, `tabindex="0"`, `aria-label` `Account timeline table`, hidden `caption`, sticky `--list` header with Label muted `scope="col"`, `max-height: 480px`, 1px `--border`, radius 6px, 3px focus ring offset 2px; 40px rows; nowrap; `tabular-nums`; 1px bottom rule; plain table up to 500 entries, `windowRange` above, DOM bounded by the window, no "more rows" line, no per-row SVG (D-15).
- **Columns (fixed, three):** `Date`, `Kind`, `Entry`. Labels from a constant (`TIMELINE_COLUMN_LABELS`).
  - **Date** (first column, sticky, opaque `--page` fill): the account tag(s) first (Surface 5), 4px gap, then the date text **as the export wrote it** (no timezone claim, no reformatting, same rule as the Vehicles premium expiry). An entry with no usable date shows `not reported` in muted.
  - **Kind**: the kind badge (below).
  - **Entry**: the entry's primary value in Body `--text`, then up to two secondary allowlisted values each introduced by ` · ` in Body `--muted` (for example a service's action, a ban's reason, a third party's scope; the exact columns per kind are fixed after header inspection, assumption A1). A primary value that is null or empty shows `not reported`. Any IP-valued part goes through `maskIp` (Surface 4). No email-valued column exists on any allowlist (D-01), so no cell can hold one.
- **Order (Recorded Choice 2):** newest first by parsed instant; entries with no parseable date come last; ties break by kind order (Name, Service, Language, Country, Ban, Third party), then the file's own order, then identity-header account order. Stable between renders and identical between plain and windowed modes. There is no sort control, column picker or search.
- **Kind badge:** an inert `span`, Label role, `--text` on `--page`, `1px solid var(--border)`, radius 6px, `padding: 0 8px`, 18px line, `white-space: nowrap`, `vertical-align: middle`. It carries the word only (`Name`, `Service`, `Language`, `Country`, `Ban`, `Third party`, from `TIMELINE_KIND_LABELS`). It is visually distinct from the account tag (word vs one letter, `--page` fill with `--text` vs `--chip` fill with `--muted`) and never coloured.
- **Language and Country (A1):** a row of the language/country history that carries both a language and a country value yields one entry per value present, each with that row's date, so each kind chip is honest. A row with neither value yields nothing and is counted only in the stored-row figure.

**Loading, error, privacy:**
- Loading: the status line reads `TIMELINE_LOADING` ("Reading account timeline..."), `aria-busy="true"` on the block, no skeleton or spinner (Device info precedent).
- Error: fixed sentence `TIMELINE_ERROR`, `role="alert"`, never the worker's detail.
- A planted synthetic email in any of the five files reaches neither IndexedDB nor any rendered text or markup (PRIV-01); the pane renders only allowlisted columns by construction (D-01, D-03). The pane asserts zero network requests in Playwright (PRIV-02).

### 3. Perks pane (D-08, D-10, D-13)

**Pane header zone:** title `Perks`; provenance `From perks files · {n files}, {n rows}` (stored rows); the combined caption at N >= 2; intro `PERKS_INTRO`; the merge note when Subscriptions merged rows (Surface 5); the mask block (one toggle for the whole pane, Surface 4) only when at least one rendered coupon or bonus-code row exists; `AboutDisclosure` "About this perks pane" (`PERKS_ABOUT`).

**Body: four stacked cards in fixed order (D-08):** Subscriptions, Personal coupons, Bonus codes, Surveys. Single column at every width, 16px gap between cards. A card never reorders, collapses or disappears when a sibling is empty.

**Card anatomy and states** are exactly the Phase 11 card (`NewDataCard`): border 1px `--border`, radius `--radius-card`, `padding: 16px`, flex column, 8px gap, `min-width: 0`; `h3` title in Label `--ink`; caption `From {file}` under the title, 4px gap, `--muted`; content is exactly one of four states with its `data-status`:
- `not-in-export`: `Not in this export` (`DEVICE_TABLE_NOT_IN_EXPORT`), caption omitted. Never an error (D-08).
- `no-rows`: `formatDeviceNoRows(file)`.
- `skipped` (D-03, allowlist drift): `formatNewDataSkipped(file)` in a dashed card (`border: 1px dashed var(--faint); background: var(--list)`); the file is named in the caption; no banner, no failure wording.
- `ready`: the table.

**Card tables** use the shared table treatment (Surface 2 bullet "Scroller, header, cell and windowing"). Column labels come from a canonical map keyed by allowlisted column id; an id with no label falls back to the allowlisted id string, never an arbitrary header from the zip. The first cell of every row carries the account tag(s) at N >= 2 (D-05, D-08), then the row's first allowlisted value. Per card (record-level, A1; exact columns fixed after header inspection):
- **Subscriptions:** plan or service name, start and end dates as written, status words as written. Rows identical across accounts merge (Surface 5); first column +64px at N >= 2.
- **Personal coupons:** the coupon code is a **masked cell** (Surface 4); other allowlisted columns (reward, issued/expiry dates as written) are plain cells. First column +32px at N >= 2.
- **Bonus codes (usage):** the code is a **masked cell**, the user IP is a **masked address cell** (`maskIp`); redeemed date and reward as written. First column +32px at N >= 2.
- **Surveys:** only the allowlisted non-free-text columns (identifier or title, date, status as written). Free text outside the allowlist is never stored, so it cannot be shown (D-03, Claude's Discretion). If the allowlist keeps only a handful of columns the card is a narrow table; it is not widened with invented columns.

**Loading, error, privacy:** status line `PERKS_LOADING` ("Reading perks..."); fixed sentence `PERKS_ERROR` in a `role="alert"`; the same email canary and zero-network rules as Surface 2.

### 4. Masking and the single global reveal (D-13, D-14)

One reveal governs every IP and every code in the app. This phase adds **no new state and no per-pane reveal**: both panes read the existing `reveal-state.ts` cell through the shell, exactly as HEAT and Login history do.

- **What is masked:** coupon codes, bonus codes, the user IP in bonus-code usage, and every IP in Bans, Authorized_Third_Parties or any other allowlisted column. A column that holds an address or a code goes through a mask formatter or it is not on the allowlist. A maskable column is declared as such in the allowlist spec, so a new column cannot reach the DOM unmasked by omission.
- **IP mask:** `maskIp`, unchanged (`203.0.113.xxx`, or `xxx` for anything non-canonical).
- **Code mask (new formatter, `maskCode`, Claude's Discretion resolved):** for a stored code of 8 or more characters, show the first 2 characters followed by the fixed text `xxx` (`AB7K-QX42` reads `ABxxx`); for a shorter, empty or non-string value show the fixed text `xxx` and nothing else. The mask never echoes more than two characters and never reflects the code's length, so a longer code and a shorter one look alike. It is derived by character count of the stored string, never by splitting on a separator. Never throws.
- **While masked, the clear value is not in the DOM**: not in a text node, attribute, `title`, `aria-label`, test id, `document.title` or log. A Playwright assertion plants a synthetic code and a synthetic IP and requires neither to appear anywhere in the page until the reveal (D-15).
- **Revealed form:** the stored value as plain text in the same cell, same Body role; no monospace, no badge, no highlight. Hiding it again restores the masked form.
- **The control:** one outlined 44px (48px phone block) `button` with the `data-masked` hook, identical to HEAT's. It is rendered in a pane only when that pane has at least one rendered maskable value, and not at all otherwise (a pane with nothing to mask has no toggle). Pressing it reveals or hides every IP and code in every pane, because it is the one global reveal; it re-masks on every new dataset, replace and clear by construction.
  - Account timeline: the toggle and caption are the Login history set verbatim (`MASK_TOGGLE_*`, `MASK_CAPTION_*`, `MASK_ANNOUNCE_*`), because this pane masks IPs only.
  - Perks: because codes now sit under the same reveal, the pane uses the code-aware set (`PERKS_MASK_TOGGLE_SHOW/HIDE`, `PERKS_MASK_CAPTION_*`, `PERKS_MASK_ANNOUNCE_*`). Login history and HEAT keep their IP-only wording; their copy is not changed.
- **Placement:** inside the pane header zone, after the intro and notes, before the kind chips (timeline) or the first card (Perks). One control per pane, never one per card.
- **Announcements:** state words only, never a value, routed through the pane's one `role="status"` region (the timeline's showing line, Perks' loading line). The pane owns exactly one explicit `aria-live`.
- **Merged rows and masking:** a merged row (Surface 5) masks and reveals as one row; the tags reveal nothing about a value.

### 5. Cross-account merged entries (D-10, D-11, D-12)

- **Which files merge:** Subscriptions, External_Services_History and Language_And_Country_History only (the three the real sample shows repeating per account). Name history, bans, authorised third parties, coupons, bonus codes and surveys never merge (Recorded Choice 3).
- **Rule:** two or more rows merge only when **every allowlisted column is equal** (D-11). Any difference in any stored column keeps the rows separate and each row shows its own single tag. No looser key, no fuzzy match, no date tolerance.
- **Display:** a merged row is one row carrying one tag per contributing account in identity-header order, 4px apart, in the sticky first cell before the first value (`flex-shrink: 0`); at most three tags are drawn and any account beyond the third is summarised by one muted plain-text `+N` node (`formatAccountOverflow`), each account still having its full visually hidden phrase. A row from one account carries one tag. At one account there is no tag, no wrapper and no merge.
- **Merge note:** when at least one row merged, one body line in the pane header zone (`timeline-merge-note` / `perks-merge-note`): `formatMergeNote(k)`, where k is the number of rows removed by merging. It reconciles the stored-row figure in the list headline and provenance with the rows on screen. Absent when nothing merged (and always absent at one account).
- **Where it lives (D-12):** a read-time grouping when the pane model is built (reader or model, planner's choice) that preserves the lazy `v`-keyed aggregate rule. Storage stays per account; no schema or Dexie change.
- **Keys:** `{#each}` over rows that can repeat across accounts is index-keyed (Phase 9 rule).
- **Scale:** merging reduces rows, never adds nodes; windowing is unchanged and node count stays bounded by the window (SCALE-01, D-15).

### 6. Overview and the "Not yet supported" footer (D-09)

- **Overview:** each rendered new pane gets one section card in the existing `.ov-card` look: label (`PANE_TITLES`), headline `formatRowCount`, the row's summary line, and an underlined ink `Open Account timeline →` / `Open Perks →` link (`formatOpenSectionLink`). No preview graphic, no hand-written insight sentence. Absent panes have no card. A pane with rows counts under "N sections with data"; an absent pane is not counted under "not in this export".
- **Footer:** the "Not yet supported" row, its headline (`formatFolderCount`), its detail list and the Overview chip all derive from the one `unsupportedEntries(result)`. When a folder gains a pane here (the nine Phase 12 folders) it leaves all four at once, including after a cache replay (status is re-derived from the stored name, no Dexie bump). `Game_Forums` stays listed as not shown (D-09); the list never describes why, because the forum folder carries an email (D-02).

---

## Layouts & Breakpoints

- **Desktop (900px and up) and tablet:** two-pane shell unchanged. Both panes use the detail pane's inner width; cards are single column; the timeline table and card tables scroll inside their own scroller. The kind chip row wraps if needed.
- **Phone (480px and below):** list screen then detail screen; the two new rows are 64px rows with the chevron; the kind chips wrap to two 44px lines; cards stack full width with 16px padding; tables scroll horizontally inside their scroller with the sticky first column; the mask toggle is 48px in the phone block. The page never scrolls sideways.
- **No component media query is added.** Everything above is flex wrap, `min-width: 0` and the existing global phone block.

---

## Copywriting Contract

All strings live in `src/lib/ui-copy.ts` as named constants or formatters, pinned in `tests/unit/shell/ui-copy.test.ts`. Names are proposed.

| Element | Copy | Constant (proposed) |
|---------|------|---------------------|
| Timeline list/pane title | "Account timeline" | `PANE_TITLES['account-timeline']` |
| Perks list/pane title | "Perks" | `PANE_TITLES.perks` |
| Timeline row summary | `Names, services, bans, third parties · {n files}` | `formatTimelineRowSummary(n)` |
| Perks row summary | `Subscriptions, coupons, codes, surveys · {n files}` | `formatPerksRowSummary(n)` |
| Timeline provenance | `From account history files · {n files}, {n rows}` | `formatNewDataProvenance(label, counts)` |
| Perks provenance | `From perks files · {n files}, {n rows}` | same formatter |
| Timeline intro | "What your accounts were called, which services were linked, which language and country they were registered under, what was enforced against them and which third parties were authorised. Newest first." | `TIMELINE_INTRO` |
| Perks intro | "The subscriptions, personal coupons, bonus codes and surveys your export lists." | `PERKS_INTRO` |
| Kind filter label (and radiogroup name) | "Filter by kind" | `TIMELINE_KIND_FILTER_LABEL` |
| Kind filter all option | "All entries" | `TIMELINE_KIND_ALL` |
| Kind labels (badge and chip) | "Name", "Service", "Language", "Country", "Ban", "Third party" | `TIMELINE_KIND_LABELS` |
| Timeline column headers | "Date", "Kind", "Entry" | `TIMELINE_COLUMN_LABELS` |
| Showing line | `Showing {n} of {m} entries` (when n equals m: `Showing all {m} entries`) | `formatTimelineShowing(n, m)` |
| Merge note | `{k} entries are identical on more than one account and are shown once, with a tag for each account.` (k = 1: `1 entry is identical on more than one account and is shown once, with a tag for each account.`) | `formatMergeNote(k)` |
| Perks card titles | "Subscriptions", "Personal coupons", "Bonus codes", "Surveys" | `PERKS_CARD_TITLES` |
| Card file caption | `From {file}` | `formatDeviceFromFile` (reused) |
| Card not in export | "Not in this export" | `DEVICE_TABLE_NOT_IN_EXPORT` (reused) |
| File/card header-only | `{file} is in this export but holds no rows` | `formatDeviceNoRows` (reused) |
| File/card skipped (D-03) | `{file} is in this export, but none of its columns are ones this viewer reads, so it was skipped.` | `formatNewDataSkipped(file)` (reused) |
| Null cell / undated entry | "not reported" | `DEVICE_NOT_REPORTED` (reused) |
| Account timeline mask set | reused verbatim: "Show full IP addresses", "Hide full IP addresses", captions, announcements | `MASK_TOGGLE_*`, `MASK_CAPTION_*`, `MASK_ANNOUNCE_*` |
| Perks mask toggle | "Show full codes and IP addresses" / "Hide full codes and IP addresses" | `PERKS_MASK_TOGGLE_SHOW`, `PERKS_MASK_TOGGLE_HIDE` |
| Perks mask caption, masked | "Codes and IP addresses are masked: most of each code and the last part of each address are hidden." | `PERKS_MASK_CAPTION_MASKED` |
| Perks mask caption, revealed | "Full codes and IP addresses are shown. Hide them again before sharing your screen." | `PERKS_MASK_CAPTION_REVEALED` |
| Perks mask announcements | "Full codes and IP addresses are now shown." / "Codes and IP addresses are now masked." (state words only) | `PERKS_MASK_ANNOUNCE_SHOWN`, `PERKS_MASK_ANNOUNCE_MASKED` |
| Timeline About name / body | name "timeline" (reads "About this timeline"); body: "Entries from your name, service, language and country, ban and authorised-third-party files are listed together, newest first; entries without a usable date come last. Email addresses in these files are never read, stored or shown. IP addresses stay masked until you choose to show them. When accounts hold an identical service, language or country entry, it is shown once with a tag for each account." | `ABOUT_NAME_TIMELINE`, `TIMELINE_ABOUT` |
| Perks About name / body | name "perks pane" (reads "About this perks pane"); body: "Coupon codes, bonus codes and the IP address used to redeem a bonus code stay masked until you choose to show them. Only the fields this viewer reads are listed. When accounts hold an identical subscription, it is shown once with a tag for each account." | `ABOUT_NAME_PERKS`, `PERKS_ABOUT` |
| Loading | "Reading account timeline..." / "Reading perks..." | `TIMELINE_LOADING`, `PERKS_LOADING` |
| Combined caption (N >= 2) | `All {N} accounts combined` | `formatCombinedCaption` (reused) |
| Open link | `Open Account timeline →`, `Open Perks →` | `formatOpenSectionLink` (reused) |
| Table accessible name | `{table title} table` | `formatDeviceTableLabel` (reused) |
| Account tag phrases / overflow | reused | `formatAccountTagLabel`, `formatAccountLegendLabel`, `formatAccountOverflow` |

| Element | Copy |
|---------|------|
| Primary CTA | none. The phase adds no primary button; the mask toggle is an outlined control and the kind chips are filters, not calls to action |
| Empty state heading | none added. The body sentence carries the message (the shell's pattern) |
| Empty state body | Per file or card: "Not in this export", `{file} is in this export but holds no rows`, or the skipped sentence above. Whole-pane empty (every present file header-only or skipped) is those sentences, one per file, and the row is muted with the existing `This export contains no rows for ...` status |
| Error state | Timeline: "Account timeline could not be read from this export. Your imported data is unchanged. Drop the export again to retry." Perks: "Perks could not be read from this export. Your imported data is unchanged. Drop the export again to retry." (`TIMELINE_ERROR`, `PERKS_ERROR`; fixed sentences, never the worker's detail) |
| Destructive confirmation | none. No destructive action is added; the existing clear/replace confirmations are unchanged |

Rules:
- File labels (`From {file}`, per-file state lines, provenance) come from the canonical constant table `NEW_DATA_FILE_LABELS`, extended with the nine Phase 12 record types. A zip entry name that is not in the table is never printed (T-08-01 pattern).
- Account IDs, nicknames and every cell value are untrusted zip content: text only, never markup, never in an attribute.
- No hand-written insight sentence ("your account was banned in...") is added; only computed values and the fixed sentences above.
- The word "email" appears only in the About body (a fixed sentence); no cell, state line or tooltip ever refers to a specific address.

---

## Accessibility

- **Kind chips:** native radio group named by its visible label, one tab stop, arrows select; each chip 44px tall; whole chip is the hit area (Phase 10 pattern).
- **List rows:** real `<button>`s with `aria-current="true"` on the selected one; the two new rows join the existing `<ul>`; a muted row keeps the visually hidden reason suffix in its accessible name.
- **Tables:** named focusable scroller regions (`role="region"`, `tabindex="0"`), hidden `caption`, `scope="col"`. Sticky first column keeps the tags visible; each tag letter is `aria-hidden` and its full phrase is `.visually-hidden` text in the same cell, so a merged row is heard as "Account A, ID ..., Account B, ID ..., {date}".
- **Kind badge:** plain text in the cell, so the kind is read as a word in column order; it is not an image and carries no role.
- **Mask toggle:** a label swap with `data-masked`, not `aria-pressed`; announcements are state words only, never a value. A masked value is announced as its masked text (`ABxxx`, `203.0.113.xxx`), which is also what is on screen.
- **Live regions:** each pane owns exactly one explicit `aria-live` (its `role="status"` line); errors are `role="alert"`; the kind chips, the merge note and the per-file state lines add none. The page-wide assertion counting explicit `aria-live` attributes is per mounted pane and unchanged.
- **Touch floor:** every interactive element is 44px (48px phone block): kind chips, row buttons, the mask toggle, `summary`, links. Tags and the kind badge are inert and add no tap target.
- **Status by text:** skipped, not in export, no rows, not reported, masked/revealed and merged are each stated in words; no state relies on colour.
- **Motion:** none. No transition, animation, scroll effect or entrance.
- **Privacy:** only allowlisted columns reach the DOM; no email column can exist (D-01); no nickname, account ID, code or address in `document.title`, attributes, tooltips or logs while masked; the nickname appears only as `.visually-hidden` text in tagged rows (Phase 10 D-19).

---

## UI Considerations

Applicable state considerations resolved: 22 covered, 3 backstop, 3 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| zero-one-many | Account timeline and Perks list rows, Overview cards | covered | Rendered only when the export holds a file of that pane; absent means no row, no card and no "not in this export" count |
| zero-one-many | account tags, combined caption, merge note | covered | Two or more accounts only; one account renders no tag node, no wrapper, no extra width and no whitespace text node (v1.0 DOM identical) |
| zero-one-many | kind chip row | covered | Rendered only when at least two kinds have entries; a chip exists only for a kind with entries, so a filtered view is never empty |
| zero-one-many | merged entry with one, two, three or more accounts | covered | One tag per account in header order; at most three drawn, then one muted `+N`; every account keeps its sr-only phrase |
| empty | Perks card with the file absent | covered | "Not in this export" (`DEVICE_TABLE_NOT_IN_EXPORT`), never an error (D-08) |
| empty | file present with no data rows | covered | `formatDeviceNoRows(file)` in the card or per-file line; the pane row is muted with the existing `empty` status only if every present file is empty |
| empty | file present, no allowlisted column matched (D-03) | covered | `formatNewDataSkipped(file)` (dashed card, or per-file info line in the timeline); import succeeded; file named; no banner or summary warning |
| empty | Account timeline where every present file is skipped or header-only | covered | No chips, no table, no toggle; per-file sentences only; list row muted `empty` |
| empty | Account timeline with only one file present | covered | Pane shows that file's entries; chips appear only if two kinds exist; absent files produce no line |
| loading | both panes | covered | One `role="status"` line plus `aria-busy`; no skeleton or spinner |
| loading | kind filter change | covered | Local filter over an in-memory model: no worker query, no loading state; the showing line updates through the one live region |
| error | both pane queries | covered | Fixed sentence, `role="alert"`, never the worker's detail |
| partial | Perks with some cards present and others not | covered | Each card states its own state; cards never reorder or disappear |
| partial | timeline entry with no date | covered | `not reported` in the Date cell, sorted after all dated entries, still filterable and tagged |
| partial | entry whose primary value is null | covered | `not reported` in muted; the kind badge and date still render |
| partial | account holding the record while another does not | covered | Tags only for accounts that hold the row; tag letters stable across panes |
| ordering | timeline chronology | covered | Newest first, undated last, ties by kind order then file order then account order; stable and identical in plain and windowed modes |
| ordering | tag order inside a merged row | covered | Identity-header order, stable across panes |
| overflow | tables over 500 rows | covered | Windowed at the constant 40px row height; DOM bounded by the window; never truncated with a "more" line; no per-row SVG (D-15, SCALE-01) |
| overflow | seven kind chips at phone width | covered | Wraps to a second 44px line; no horizontal scroll, no truncation |
| privacy | codes and every IP | covered | Masked through `maskCode` / `maskIp` until the single global reveal; the clear value is not in the DOM while masked; no per-pane reveal |
| privacy | emails in any of the nine files | covered | No email column is on any allowlist, so nothing can render one; per-header unit test plus a rendered-pane canary assertion (PRIV-01) |
| conditional copy | Perks mask wording vs Login history wording | covered | Two sets of copy over one reveal state: Perks says "codes and IP addresses", Timeline, Login history and HEAT say "IP addresses" |
| long-text | a 40-character nickname in a tag phrase; a long service or third-party name in the Entry cell | 🧪 backstop | Cells are nowrap in a scroller and cannot widen the page; the tag phrase is `.visually-hidden`; visual state test at 375px; lifts as `{ statement, verification: backstop }` |
| privacy | a planted synthetic email in every allowlisted file | 🧪 backstop | Per-header unit test and a rendered-text-and-markup assertion on both panes (PRIV-01); lifts as `{ statement, verification: backstop }` |
| overflow | very large synthetic export through both panes | 🧪 backstop | Large-fixture e2e counts DOM nodes against the window (SCALE-01); lifts as `{ statement, verification: backstop }` |
| layout | pane order in the list (Perks beside the money rows, Timeline above Account) | unresolved | See Recorded Choice 1; reordering is a `PANE_ORDER` edit |
| unknown columns | all Entry values, Perks columns, Surveys columns | unresolved | Real headers unverified (D-04); the contract is written at record-type level and the column labels, per-kind Entry composition and masked-column declarations are fixed after the Wave 0 header capture |
| ordering | undated entries sort last vs a date format the parser cannot read | unresolved | Display is the export's own text; ordering uses a tolerant parse; a format the parser rejects makes an entry "undated", which is visible as `not reported` only if the date cell is empty, so the planner should render the original text and sort it last |

---

## Recorded Choices and Assumptions

Open items the planner treats as assumptions (nothing here was asked of the user).

**Choices**
1. **List order:** Perks follows Payments (it lists entitlements and receipts); Account timeline sits directly above Account (it is that account's history). The alternative, both adjacent after Device info, is a tuple edit.
2. **Newest first.** CONTEXT says "date-ordered" without a direction. A history that is read back from the present puts the most recent change first; the intro says "Newest first" so the direction is never implicit.
3. **Merging is limited to the three files D-10 names** (Subscriptions, External_Services_History, Language_And_Country_History). D-10's rule is worded generally, but only these three are evidenced as repeating per account; merging coupons, bonus codes, bans or names could hide a real per-account fact. Extending it is a one-line list change in the model.
4. **Timeline is one table, not cards.** D-06 requires one chronology across kinds, so per-file cards would split it. Per-file state is carried by info lines instead (Surface 2).
5. **One toggle per pane, shared state.** D-13 forbids a new control; the toggle in each pane is the existing global reveal, as HEAT's is. Perks has its own wording because it also masks codes.
6. **Code mask shows two characters of codes of 8 or more, otherwise `xxx`.** Closest to the IP pattern ("enough to recognise, not enough to be one") without leaking length. If the user prefers nothing visible, the formatter returns `xxx` always.
7. **Headline and provenance count stored rows**, because the list cannot query the worker; the merge note makes the difference explicit.
8. **No stat tiles, charts or previews.** Headers are unverified and a headline figure would be invented.
9. **Kind badge is neutral and bordered, not tinted**, so no kind reads as severity and the one accent system is preserved.

**Assumptions**
- **A1 (headers, D-04):** the nine record types exist as CONTEXT describes but real column names, per-kind Entry composition, date formats and which columns are codes or addresses are unverified. The planner's Wave 0 human-action (header names only) fixes the file-label table, the column-label map, the per-kind primary and secondary Entry columns, the maskable-column declarations and the Language/Country row-to-entry rule. If a record type turns out not to exist, its kind chip or card disappears and nothing else changes.
- **A2 (presence):** both rows are absent, not muted, when none of their files are present; present-but-empty is muted.
- **A3 (list derivation):** list rows, headlines and Overview cards read presence and counts from `ClassifyResult`; the worker publishes per-pane file and row counts for the two new panes (Phase 11 A3 pattern). The list issues no query.
- **A4 (combined caption and tags):** follow the dataset's account count (N >= 2) like every other pane, even if only one account holds the pane's data.
- **A5 (footer):** the nine promoted folders leave "Not yet supported"; `Game_Forums` remains; if a folder is promoted only in part the footer follows `unsupportedEntries`.
- **A6 (e2e budget):** Phase 11 closed at 263 tests in 30 files against a 264 ceiling and limits of 31 / 33 / 41 min. Two new panes need specs (list rows, each pane's states, merge, reveal, zero-network, large fixture), so the three CI limits are raised or reconciled together, never one alone.

---

## Test Hooks (data-testid)

Existing ids are unchanged. New ones:

| Test id | Element |
|---------|---------|
| `list-row-account-timeline`, `list-row-perks` | The two list rows |
| `account-timeline-block`, `perks-block` | Pane root (carries `data-state`, `aria-busy`) |
| `timeline-kind-filter` | Wrapper of the label and radiogroup |
| `timeline-kind-chip-all`, `timeline-kind-chip-name`, `-service`, `-language`, `-country`, `-ban`, `-third-party` | Each chip label |
| `timeline-showing` | The showing line (the pane's `role="status"`) |
| `timeline-table` | The timeline scroller region |
| `timeline-kind-badge` | Each kind badge (carries `data-kind`) |
| `timeline-file-state` | Each per-file skipped or header-only line (carries `data-status`) |
| `timeline-merge-note`, `perks-merge-note` | The merge notes |
| `perks-card-subscriptions`, `perks-card-coupons`, `perks-card-bonus-codes`, `perks-card-surveys` | Perks cards (carry `data-status`: `ready`, `not-in-export`, `no-rows`, `skipped`) |
| `new-data-table`, `new-data-skipped` | Existing shared table and skipped sentence, now also in Perks |
| `about-account-timeline`, `about-perks` | The two `AboutDisclosure`s |
| `timeline-mask-toggle`, `perks-mask-toggle` | The two mask toggles (carry `data-masked`) |
| `account-tag`, `combined-caption` | Existing ids, now also inside the new panes |

---

## Checks For The Executor

- One account: both panes render no tag, no caption, no merge note, no extra column width, no whitespace text node. Existing panes' DOM is byte-identical to Phase 11.
- Two or three accounts: every row in both panes carries its tag(s); the same account gets the same letter everywhere; a merged row carries one tag per contributing account, at most three then `+N`.
- Merge happens only on equality of every allowlisted column and only for the three named files; a one-column difference keeps rows separate. The merge note count equals stored rows minus displayed rows.
- Timeline order is newest first, undated last, stable between plain and windowed modes; the kind chip row appears only with two kinds present and resets to All entries on a new dataset; no route, `localStorage` or IndexedDB write.
- Each Perks card and each timeline file state renders its sentence and `data-status`; a drifted file shows the skipped sentence with its canonical name, the import succeeds, and no import-summary warning appears; an absent Perks file is an empty state, never an error.
- Codes and IPs are masked in both panes until the single reveal; a planted synthetic code and IP appear nowhere in text or markup until revealed, and after reveal reappear nowhere else; the toggle in either pane changes Login history's addresses too; a new dataset re-masks.
- A planted synthetic email in each allowlisted file (and in a `Game_Forums` fixture) is absent from IndexedDB and from the rendered text and markup of every pane.
- Zero network requests while opening each new pane (Playwright, PRIV-02). Tables over 500 rows are windowed; the large-fixture proof counts DOM nodes against the window.
- No new colour, token, media query, transition, animation or dependency; `{#each}` over rows that repeat across accounts is index-keyed (Phase 9 rule); exactly one explicit `aria-live` per pane.
- e2e budget: new specs raise or reconcile the three CI limits together (Assumption A6).

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

**Approval:** approved 2026-10-20 (3 non-blocking flags: add per-pane focal point, list the 12.5px list-row size in Typography, declare badge as flat 20px height)
