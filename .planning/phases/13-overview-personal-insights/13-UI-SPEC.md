---
phase: "13"
slug: "overview-personal-insights"
status: draft
shadcn_initialized: false
preset: none
created: "2026-10-23"
---

# Phase 13 - UI Design Contract

> Visual and interaction contract for the Overview personal-insights page: the grouped bento of tiles (Pinned, Time, Tanks, Records, Totals), tile sizes and the fill rule, expand in place, pins, absent-data rows, the "Wargaming life" strip, the Overview states and their copy. Locked inputs: `13-CONTEXT.md` (D-01 to D-23), sketch 030 and the Overview canvas as summarised in `sketch-findings-wot-gdpr-stats-visualizer` (`references/overview-insights.md` supersedes the Overview parts of `layout-and-navigation.md`; `visual-language.md` still governs the rest of the page). Where those sources disagree, the resolution is recorded in "Resolved conflicts". Nothing here asks the user a question. Open items are listed at the end.
>
> All example figures in this document are synthetic placeholders. No real export value appears here (leak guard).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable (the project is Svelte, not React; the shadcn gate does not apply) |
| Component library | none (hand-rolled Svelte 5 components with runes; hand-rolled SVG and CSS grid) |
| Icon library | none. The pin star is one inline `<svg>` path; fill and stroke are set by classes, never by `style=""` |
| Font | system-ui stack, unchanged (`src/app.css` `:root`) |

**Registry and dependencies:** no third-party registry, no new npm dependency, no new runtime library. Motion uses the platform View Transitions API (feature-detected) and CSSOM property writes. The Component Inventory section is omitted because `Tool: none`.

---

## Existing Baseline (detected, not re-specified)

Detected from `src/app.css`, `src/lib/shell/Overview.svelte`, `overview-model.ts`, `selection-state.ts`, `Dashboard.svelte`, `ui-copy.ts` and `tests/unit/guards/phase8-shell-guards.test.ts`:

- Neutral tokens: `--page #ffffff`, `--list #f5f5f5`, `--border #dcdcdc`, `--faint #8c8c8c` (borders and decoration only, never text), `--ink #111111`, `--text #3a3a3a`, `--muted #5c5c5c`, `--sel #e0e0e0`, `--hover #ececec`, `--focus #1a73e8`. Data ramp `--ramp-0..5` is untouched and is not used by any Overview chart (D-13 replaces it on this page).
- Shell: two panes (list pane, detail pane). The Overview row stays first and selected by default; its list summary "What your export contains" is unchanged (`OVERVIEW_ROW_SUMMARY`). Panes are component state, never a route.
- Phone: exactly one `@media (max-width: 480px)` block in `src/app.css`, which also carries the 44px floor for `button`, `summary` and `a`. The phase-8 guard counts only `max-width` media blocks, so `@container` rules and `@media (prefers-reduced-motion)` / `@media (forced-colors: active)` inside the Overview component stylesheet are allowed (`ImportBar.svelte` already uses reduced-motion this way).
- Phase-8 guard, `Overview.svelte` may not contain `localStorage`, `sessionStorage`, `location.hash`, `pushState`, `replaceState`, `{@html` or `innerHTML`. Pin persistence therefore lives in its own module (`overview-pins.ts`). The `overview` test id is kept on the root.
- Live region: the page-level chart announcer (`CHART_ANNOUNCE_KEY`, `Dashboard.svelte`) is reused for pin and unpin. The Overview adds no `aria-live` region; the Overview keeps exactly the two existing `[aria-live]` nodes its e2e assertion counts.
- Kept helpers: `formatOpenSectionLink` (tile "Open <Section>" links) and `ROW_HEADLINE_NONE`. Deleted: `OVERVIEW_INTRO`, `formatChipWithData`, `formatChipAbsent`, `formatChipUnsupported`, `overview-model.ts`, `OVERVIEW_CARD_IDS`.
- Section names used in links and absent rows are the list-row names: Playtime, Vehicles, Finance, Payments.
- Failure copy: `GENERIC_FAILURE_MESSAGE` is an import-failure sentence and must not be reused for an overview compute failure (see Copywriting).

---

## Resolved Conflicts

The sources disagree in places. Each row states the value this contract uses and why. The planner follows this table, not the sketch, where they differ.

| Topic | Sketch or earlier source says | This contract uses | Basis |
|-------|-------------------------------|--------------------|-------|
| Default pins | Logged in, Most-played tank, Most damage (sketch 030) | **Logged in, Most-played tank** | D-11 (locked) |
| Pinned group order | Original order (030 README, overview-insights.md) vs sorted hero, feature, metric (Main.dc.html note) | **Catalogue order** (Time, Tanks, Records, Totals; within a group the list order below) | overview-insights.md "original order"; the canvas note is the open item OI-2 |
| Absent tiles | Dashed "Not in this export" tile per missing tile (030 behaviour) | **One dashed row per group**, never a tile, never a zero | D-03 (locked) and the 030 review fix "absent tiles collapse into one dashed row per group" |
| Game switcher | Header switcher (WoT active, Blitz and Warships stubbed) | **Read-only "Wargaming life" strip** listing logged-in time per game present; no buttons | D-06; the switcher is a deferred item |
| Records across accounts | Sum (D-04) | **Maximum**, record tank from the account holding the maximum | D-19 (amends D-04) |
| "Logged in" scope | WoT sessions only (sketch copy) | **All games**, copy says "across all games" | D-05 as amended by D-20 |
| Habit tiles scope | Not stated | **WoT sessions only** (streak, busiest day, signature hour, longest session) | D-20 |
| Credits earned | Deposits only (spike and sketch 030 definition) | **Deposits plus income**, matching the Finance pane | D-21 |
| Tile value weight | 650 (overview-insights.md) | **600** (the page declares two weights, 400 and 600) | Two-weight rule of this contract |
| Tile numeral size | 30px (visual-language.md, general tiles); 56px hero numeral (sketch 030) | **32px** on feature and metric tiles; **56px** on a hero whose value has 9 characters or fewer. Both are declared sizes (four-size set below) | Overview spec supersedes visual-language.md for this page; 56px hero numeral kept (D-15) |
| Long-value rule | Sketch `.v.long` drops a long metric value to 22px | **Wrap at 32px**, `overflow-wrap: anywhere`; no 22px size exists in this contract | Four-size limit (Dimension 4), owner decision. This row supersedes the sketch rule; the sketch files are not edited by this contract |
| Rule line role | Label role (12px / 600 / uppercase) in the earlier draft | **Caption role** (12px / 400, sentence case, `#5c5c5c`) | Rule lines are sentences; Label is reserved for group headings and tile labels |
| Tile gap | 12px (sketch 030) | **16px on both axes** (the `md` token) | Owner decision; multiple of 4 on the standard set |
| Rule line size | 12.5px (sketch) | **12px** (declared scale) | Type scale below |
| Tile padding | 14px 16px (visual-language.md) | **16px** on all sides | Spacing must be multiples of 4 |
| Phone two-up | Optional toggle (030) | **Dropped; one column below 480px** | D-10 (locked) |
| Heat scale lightest step | `#4fb27f` (2.62:1 on white) | **`#47a374`** (3.11:1 on white) | D-22 |

---

## Spacing Scale

Declared spacing tokens (all multiples of 4):

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Gap between a value and its unit; gap between the group dot and its label |
| sm | 8px | Heading to grid; label to value; rule line to chart; row gap in top-5 and class rows |
| md | 16px | Tile padding (all sides); **gap between tiles on both axes** (column gap and row gap); gap inside a tile between chart and rule |
| lg | 24px | Gap between groups; gap between the provenance block and the first group |
| xl | 32px | Gap before the attribution footer |

**Tile gap is 16px on both axes**, the same `md` token as tile padding. The sketch's 12px gap is not used. The gap is the same at every width (four columns, two columns and one column).

**Declared non-spacing exceptions.** These sizes are not spacing tokens and are never used for padding, gap or margin:

| Value | Element | Reason |
|-------|---------|--------|
| 44px minimum target | Star button (44x44), tile and link targets | A hit-area size, not a spacing value. The star sits in the tile's top-right corner |
| 7px dot (9px in group headings) | Group dot | Optical marker matched to the 12px label; decorative (`aria-hidden`) |
| 18px star glyph | Inline SVG inside the 44x44 star button | Icon glyph, centred inside the 44px target |
| 1px, 1.5px, 3px | Borders, star strokes, focus ring, chart baseline | Line widths, not spacing |

---

## Typography

Declared scale: four text sizes, **12, 14, 32 and 56px**, shared across five roles. Two weights only: 400 and 600. The 56px hero numeral is one of the four declared sizes; no exception is recorded.

| Role | Size | Weight | Line Height | Used for |
|------|------|--------|-------------|----------|
| Label | 12px | 600, uppercase, letter-spacing 0.06em | 1.4 | Group headings, tile labels and the "Wargaming life" strip label only |
| Caption | 12px | 400, sentence case | 1.4 | Rule lines (`#5c5c5c`), hint line, chart axis labels, legend words, provenance line, attribution footer, file names in "Reads" |
| Body | 14px | 400 | 1.5 | Units ("days", "h"), class and nation names in rows, top-5 names, "Open <Section> →" link, expanded "How it is computed" text, absent-row sentence, strip game values, empty-state line |
| Display | 32px | 600 | 1.2 | Tile values on feature and metric tiles; any text value longer than 9 characters on any tile (wraps, see Long text values) |
| Hero numeral | 56px | 600 | 1.1 | Value of a hero tile whose value has 9 characters or fewer (Logged in; Most-played tank when its name is short) |

Existing shell titles are not re-specified: the pane title (`section-title`, 26px / 600) and the list-row titles (14px / 600) keep their current rules. They live in the shell, outside the Overview component stylesheet.

`font-variant-numeric: tabular-nums` on the whole Overview root.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` | Detail pane, tile surfaces |
| Secondary (30%) | `#f5f5f5` | List pane (unchanged), dashed "Not in this export" row, skeleton tiles |
| Accent (10%) | `#111111` ink | Tile values, group headings, "Open <Section> →" links, open-tile edge, selected list row bar |
| Destructive | none | The Overview has no destructive action |

**Colour is limited to these, and nothing else on the Overview is coloured:**

| Use | Value | Notes |
|-----|-------|-------|
| Group dot, Time | `#1f7a74` | 7px dot (9px in group headings), decorative (`aria-hidden`); the group name is text |
| Group dot, Tanks | `#c26a1b` | same |
| Group dot, Records | `#8f4a80` | same |
| Group dot, Totals | `#3a6aa8` | same |
| Group dot, Pinned | `#e0a020` | same |
| Group dot, absent row | `#8c8c8c` | same |
| Pinned star fill | `#e0a020` | Fill only; the stroke carries the contrast (below) |
| Pinned star stroke | `#a8710a` | 1.5px stroke |
| Unpinned star stroke | `#8c8c8c` | 1.5px stroke |
| Value scale, lowest step (bars and legend start) | `#47a374` | Darkened from `#4fb27f` (D-22) |
| Value scale, middle step | `#6b8a14` | Unchanged from sketch 030 |
| Value scale, peak step | `#8c6400` | Unchanged from sketch 030 |
| Chart baseline | `#8c8c8c` | 1px |
| Focus ring | `#1a73e8` | 3px solid, unchanged |

**Group dots carry identity only.** A dot tells the eye which group a tile belongs to. The group name beside it is the text meaning. No meaning is carried by colour alone, and the dots are `aria-hidden`.

**Value scale (D-13, D-22).** Bars are coloured by value: `t` is the value divided by the group's maximum; `u = t^1.5`; the colour is interpolated `#47a374 -> #6b8a14` for `u` in [0, 0.5] and `#6b8a14 -> #8c6400` for `u` in (0.5, 1]. Lightness falls as the value rises, so the peak is the darkest bar in greyscale too. The peak bar is labelled in text right above it (for example `42 days · 2014` or `20:00`), in Caption role.

**Heat-scale contrast, computed against white (`#ffffff`), WCAG relative luminance:**

| Colour | Ratio on white | Result |
|--------|----------------|--------|
| `#4fb27f` (previous lightest step, sketch) | 2.62 : 1 | Fails 3 : 1 |
| `#47a374` (lightest step, this contract) | **3.11 : 1** | Passes 3 : 1 |
| `#6b8a14` (middle) | 3.98 : 1 | Passes |
| `#8c6400` (peak) | 5.33 : 1 | Passes |

Sampled along the full eased ramp (201 points, `t` from 0 to 1, both segments), the minimum ratio is 3.107 : 1 at the lightest stop; every interpolated colour is at least 3 : 1 against white. Relative luminance falls monotonically along the ramp (0.288, 0.214, 0.147).

**Bars sit on white, never on a grey track.** A `#ececec` track would drop the lightest step to 2.63 : 1 and is therefore not used on the Overview. Against `#ececec` the middle and peak steps pass (3.37 and 4.51), the lightest does not, so the track is forbidden here.

**Other contrast facts (against white unless stated):**

| Pair | Ratio | Use |
|------|-------|-----|
| `#111111` on `#ffffff` | 18.88 : 1 | Values, headings, links |
| `#111111` on `#f5f5f5` | 17.32 : 1 | Values on secondary surfaces |
| `#5c5c5c` on `#ffffff` | 6.69 : 1 | Labels, rule lines, captions (muted text) |
| `#5c5c5c` on `#f5f5f5` | 6.13 : 1 | Muted text in the absent row |
| `#3a3a3a` on `#ffffff` | 11.37 : 1 | Body text |
| `#ffffff` on `#111111` | 18.88 : 1 | Filled primary text, if any |
| `#1a73e8` on `#ffffff` | 4.51 : 1 | Focus ring (non-text, passes 3 : 1) |
| `#1a73e8` on `#f5f5f5` | 4.13 : 1 | Focus ring on the absent row |
| `#8c8c8c` on `#ffffff` | 3.36 : 1 | Chart baseline, unpinned star, absent dot (graphics only, never text) |
| `#a8710a` on `#ffffff` | 4.17 : 1 | Pinned star stroke (carries the star's contrast) |
| `#e0a020` on `#ffffff` | 2.28 : 1 | Pinned star fill and Pinned group dot: decorative fill, the stroke and the text label carry meaning |
| `#1f7a74` on `#ffffff` | 5.13 : 1 | Time dot |
| `#c26a1b` on `#ffffff` | 3.91 : 1 | Tanks dot |
| `#8f4a80` on `#ffffff` | 6.07 : 1 | Records dot |
| `#3a6aa8` on `#ffffff` | 5.52 : 1 | Totals dot |

No text is set in `#8c8c8c`. Every text colour on the Overview is `#111111`, `#3a3a3a` or `#5c5c5c`.

**Elevation (lifted, D-16):** tile at rest `box-shadow: 0 1px 2px rgba(17,17,17,.05)`; hover, only under `@media (hover: hover)`, `0 4px 12px rgba(17,17,17,.08)` with the border unchanged; open tile `0 8px 24px rgba(17,17,17,.10)` plus a 2px ink edge drawn as `border: 1px solid #111111` and `outline: 1px solid #111111; outline-offset: -2px`, so layout does not change. Hairline `1px solid #dcdcdc` border on every tile in every mode. Phone: soft rest shadow only. No shadow on the list pane, the Pinned strip, the "Wargaming life" strip or the dashed absent row.

---

## Layout and Grid

**Columns follow the pane, not the viewport.** The Overview root is the container (`container-type: inline-size`). Its width is the detail pane's content box.

| Overview root width | Columns | Hero | Feature | Metric |
|---------------------|---------|------|---------|--------|
| 880px and up | 4 | 2 cols x 2 rows | 2 cols x 1 row (widened by the fill rule) | 1 x 1 |
| 480 to 879px | 2 | 2 cols x 2 rows (full row) | 2 cols (full row) | 1 x 1 |
| under 480px | 1 | full width, auto rows | full width, auto rows | full width, auto rows |

Below 480px every span and row span resets to `auto`. Hero stays first in DOM order in every layout so it leads on a phone.

**Gaps.** 16px between tiles on both axes (`md`); 24px between groups (`lg`). These gaps apply at every width in the table above.

**Tile sizes (D-15):** hero 2x2, feature 2x1, metric 1x1. Only feature tiles widen to fill leftover cells. Heroes and metrics never stretch. Holes that no feature can fill are accepted.

**Fill rule (port of `fillSpans`).** A pure function in `overview-model.ts` (no DOM), applied to the ordered visible tiles of one group. It simulates `grid-auto-flow: dense`, tries every width from 2 to the column count for each feature tile, rejects any width that would show a tile before an earlier one (visual order must equal DOM order), and keeps the combination with the fewest empty cells, then the least widening. The result is written per tile through CSSOM as `--span4`, `--rows4` and `--span2`. Rules in the component stylesheet: `grid-column: span calc(2 + var(--span4, 0))` for a 4-column hero and feature, `span calc(1 + var(--span4, 0))` for a metric, and the same with `--span2` at 2 columns. Recomputed on render, on pin and on unpin only. Expanding a tile never recomputes it.

**Group order:** Pinned (only when at least one pinned tile has data), Time, Tanks, Records, Totals. Within a group the order is the catalogue order below.

**Primary visual anchor.** The Logged in hero is the Overview's primary visual anchor. In the default layout (both default pins) it is the first tile in DOM order and the top-left tile at 880px and up. When it is unpinned it is the first tile of the Time group. No other tile carries anchor styling.

**Worked example with the default pins (Logged in, Most-played tank), 4 columns:**

| Group | Tiles | Result |
|-------|-------|--------|
| Pinned | Logged in (hero), Most-played tank (hero) | Two 2x2 heroes side by side; no holes |
| Time | Signature hour (feature), Longest streak, Longest session, Busiest day | Signature hour 4 wide, then three metrics; one empty cell in the last row |
| Tanks | Favourite class (feature), Tanks played, Favourite nation | Favourite class 2 wide, then two metrics; no holes |
| Records | Most damage, Most XP, Most kills, Sniper series | Four metrics; no holes |
| Totals | Credits earned (feature), Battles, Orders | Credits 2 wide, then two metrics; no holes |

**Expanded tile.** Expands downward inside its own column: its x position, y position and width do not change; the page scroll is adjusted so the tile stays under the pointer. While a tile is open its grid sets `align-items: start` (`.overview-grid:has(.tile.open)`), so siblings keep their natural height and only the content below moves.

---

## Tile Anatomy

Each tile is one `<button aria-expanded>` (phrasing content only: `span` with `display: block`; no `div`, no `role="img"` inside a button) inside a wrapper `div`. The star is a sibling `<button>` positioned over the wrapper's top-right corner, never nested.

| Part | Spec |
|------|------|
| Padding | 16px all sides; surface `#ffffff`; border `1px solid #dcdcdc`; radius 8px |
| Label row | Group dot (7px, decorative) + label, Label role (12px / 600 / uppercase / 0.06em, `#5c5c5c`) |
| Value | Display (32px / 600 / `#111111`) on feature and metric tiles. Hero numeral (56px / 600 / `#111111`) on a hero whose value has 9 characters or fewer; a longer hero value uses Display. Unit in Body (14px / 400 / `#5c5c5c`), 4px gap |
| Top-5 rows (Most-played tank only) | Grid `minmax(72px, 1fr) clamp(60px, 30%, 152px) auto`: name (Body, wraps), bar (12px high, no track, heat scale, peak labelled), battle count |
| Class split (Favourite class only) | Five rows, one per class (Body name, bar, percentage of battles); the "Unknown" class is a text row with no bar (D-09) |
| Chart (Time group) | Years bars (Logged in) and 24 hour bars (Signature hour): bars on white, heat scale, baseline 1px `#8c8c8c`, peak labelled in Caption text, axis labels in Caption role |
| Rule line | Caption role (12px / 400 / `#5c5c5c`), 8px above it; states the rule inline (D-17) |
| Star | 44x44 button, top-right, inline SVG 18px (non-spacing glyph size, see Spacing Scale); `aria-pressed`; fixed label "Pin <tile name>" |
| Hidden summary | Visually hidden one-line text per chart, for example "Chart: hours logged per year, 14 years, peak 2014 with 600 hours." Charts are `aria-hidden` |

**Chart dimensions (build choices, not sketch measurements):** Logged in year bars 96px tall at the bar maximum, one bar per year. Signature hour bars 48px tall at the maximum; x labels at 00, 06, 12, 18. Top-5 and class rows: 28px per row. Chart height never depends on the row count of the export.

**Long text values (D-17, sketch rule, revised).** A text value longer than 9 characters is set at 32px (Display role) on every tile size and wraps onto as many lines as it needs (`overflow-wrap: anywhere`). No value is shrunk and no value is truncated. A metric tile that wraps grows taller and sets the height of its grid row; the grid's row height follows it. Numeric values never wrap. Example: a long nation name on a metric tile wraps to two lines at 32px.

**Value formatting.** Use `Intl` with the browser locale (`numberFormatter` in `src/lib/core/decimal.ts`). The worker output is locale-free. Credits: 1,000,000 and above shown as whole millions ("880 million"); 1,000,000,000 and above as "N.NN billion"; below one million the full figure with separators. The rule line of Credits says "exact figure in Finance". Money is never a float.

---

## Tile Catalogue

Seventeen tiles in four groups. Order below is catalogue order (used for every group, Pinned included). "Absent" means the tile's source is missing; absent tiles collapse into the group's dashed row (see Absent Data).

| Id | Group | Size | Label | Value | Rule line (copy template) | Needs (absent-row wording) | "Open" target |
|----|-------|------|-------|-------|---------------------------|----------------------------|---------------|
| logged | Time | hero | Logged in | days | "{H} h across all games (24-hour days) since {first date}. In battle: {B} days." | session history | Playtime |
| hour | Time | feature | Signature hour | HH:00 | "Logged hours by hour of day, wall clock as recorded." | session history | Playtime |
| streak | Time | metric | Longest streak | N days | "{start date} to {end date}, WoT sessions." | session history | Playtime |
| sess | Time | metric | Longest session | N h | "{date}, WoT sessions. One login to logout." | session history | Playtime |
| busy | Time | metric | Busiest day | N h | "{date}, WoT sessions." | session history | Playtime |
| tank | Tanks | hero | Most-played tank | tank name; top-5 rows | "{battles} battles, {pct} of all battles." | vehicle statistics | Vehicles |
| cls | Tanks | feature | Favourite class | class name | "{pct} of battles. Class known for {N}% of battles." | vehicle statistics | Vehicles |
| fleet | Tanks | metric | Tanks played | N | "Different tanks with battles." | vehicle statistics | Vehicles |
| nat | Tanks | metric | Favourite nation | nation name | "{pct} of battles." | vehicle statistics | Vehicles |
| dmg | Records | metric | Most damage, one battle | N | "{tank name}, best of {accounts} accounts." (tank line: "vehicle not recorded" when the numeric id is absent) | account statistics | Vehicles |
| xp | Records | metric | Most XP, one battle | N | "{tank name}, best of {accounts} accounts." | account statistics | Vehicles |
| kills | Records | metric | Most kills, one battle | N | "{tank name}, best of {accounts} accounts." | account statistics | Vehicles |
| snip | Records | metric | Sniper series | N | "Longest run recorded." | account statistics | Vehicles |
| cred | Totals | feature | Credits earned | formatted (see Anatomy) | "Deposits plus income, as in Finance. Exact figure in Finance." | currency operations | Finance |
| bat | Totals | metric | Battles | N | "{win rate} wins." | account statistics | Vehicles |
| ord | Totals | metric | Orders | N | "Count only. Amounts are never shown here." | payment history | Payments |

"Best of {accounts} accounts" is shown only when the dataset has more than one account folder (D-19: maximum across accounts, record tank from the account that holds the maximum). With one account the line reads the tank name only.

**Definitions on expand (short form; full text in the component):**

| Id | "How it is computed" text (summary) |
|----|------------------------------------|
| logged | Union of session intervals across all games and all account folders, so overlapping sessions count once. Counted in 24-hour days. "In battle" is the separate lifetime battle-time figure, not logged-in time. |
| hour | Logged hours summed per hour of day across the WoT sessions, wall clock as recorded. |
| streak | Most consecutive calendar days with at least one WoT session. |
| sess | Longest single WoT session, login to logout. Disconnects or idle time can inflate it. |
| busy | Most logged WoT hours on one calendar day, by session start. |
| tank | Battles per tank from the vehicle statistics, summed across account folders. Tank names come from the built-in tank table. |
| cls | Battles grouped by class via the built-in tank table. Tanks missing from the table are counted as unknown and not guessed; the rule line states the class coverage. |
| fleet | Tanks with a row in the vehicle statistics, across account folders. |
| nat | Nation from the vehicle id prefix, summed across account folders. |
| dmg, xp, kills | Best single-battle value across account folders. The tank named is from the account that holds the maximum. |
| snip | Longest run recorded in the account statistics. Series definitions differ by mode, so this is not a medal. |
| cred | Deposits plus income in the currency operations log, as the Finance pane defines it. |
| bat | Lifetime battles and wins from the account statistics, summed across account folders. Win rate depends on teammates. |
| ord | Number of payment orders. No amount, product or order detail is shown. |

Every expanded tile also shows "Reads" (the source in friendly words, with its file name in Caption role, 12px muted text) and an underlined "Open <Section> →" link (Body role, 44px target) that routes to the existing pane through the shell's `openPane`.

---

## Groups and Headings

| Group | Heading text | Dot | Legend in heading | Charts |
|-------|--------------|-----|-------------------|--------|
| Pinned | "Pinned" | `#e0a020` | no | none (pinned tiles keep their own charts) |
| Time | "Time" | `#1f7a74` | yes (chart present) | Logged in years, Signature hour |
| Tanks | "Tanks" | `#c26a1b` | yes (chart present) | Most-played tank top-5, Favourite class split |
| Records | "Records" | `#8f4a80` | no | none |
| Totals | "Totals" | `#3a6aa8` | no | none |

Heading markup: `h3`, Label role, `#5c5c5c`, dot before the text, 1px `#dcdcdc` hairline filling the rest of the row, 8px below. A group heading never shows a count. The dot is group identity only; the heading text is the meaning.

**Legend.** A 48px by 8px gradient swatch (`#47a374` -> `#6b8a14` -> `#8c6400`, the same three stops as the bars) in the heading of each group that contains a chart, with the text "low" at the left end and "peak" at the right end (Caption role, `#5c5c5c`). The swatch is `aria-hidden`; the words carry the meaning.

**Wargaming life strip.** Directly below the provenance line, above the Pinned group, a read-only `dl`: label "Wargaming life" (Label role) and one `dt`/`dd` per game present in the dataset: game name, then logged days (Body role). Example shape: "WoT 42 days", "WoTB 3 days". It is not a control, has no buttons, and does not change with the shared game filter (D-06). A game present with no sessions shows its game name and "no sessions in this export". It is never pinned.

**Provenance line.** Under the page title, Caption role (12px / 400) in `#5c5c5c`: "Computed on this device from {N} account folder(s) · {games present} · {first month year} to {last month year}". Singular and plural per count.

**Hint line.** Under the provenance line, Caption role (12px / 400) in `#5c5c5c`: "Click a tile to see how it is computed. Star a tile to pin it to the top. Arrow keys move between tiles, P pins the focused tile, Esc closes."

---

## Absent Data

- Never a zero. An absent tile is not drawn.
- Each group that has at least one absent tile shows exactly one dashed row, placed after that group's grid, in the form "Not in this export: {tile names, comma separated} · needs {source names, comma separated}". Example source wording: "session history", "vehicle statistics", "account statistics", "currency operations", "payment history".
- Dashed row: `border: 1px dashed #8c8c8c`, `background: #f5f5f5`, radius 8px, padding 8px 16px, Body role for the sentence, "Not in this export:" in ink weight 600, names in ink. No shadow. Not focusable (text only).
- A pinned tile whose source is absent is not in Pinned. Its own group shows it in that group's absent row.
- Logged in always shows: when the export has no session history, Logged in is absent (rule above) and the Time group carries the absent row. The Pinned group is omitted when it would be empty.
- Column-level absence (for example an older export without a record column) is absent for that tile only, with the column named in the absent row. It is never a zero.
- Small-sample guard (D-17): any per-tank rate needs at least 100 battles in that tank; any plain rate (for example the win rate on Battles) needs at least 30 battles. Below that the rule line states "too few battles for a rate" instead of a value. Counts and totals are not guarded.

---

## Pins

- Star toggles the pin. A pinned tile moves to the Pinned group, in catalogue order; unpinned, it returns to its group.
- Default pins: Logged in and Most-played tank (D-11).
- Storage: `localStorage` under one key, `wg-overview-pins`, value a JSON array of tile ids. Read and written in `try/catch`. On read: non-array, non-string or unknown ids are dropped; duplicates dropped; if nothing valid remains, the defaults apply. Maximum 17 entries (one per tile). Written only on an explicit pin or unpin action, never on load, never on import. No data values are stored. Pins survive replacing the dataset. If storage is unavailable, pins work for the session and the page works without them.
- The module that reads and writes the key is `overview-pins.ts`, outside `Overview.svelte` (phase-8 guard).

---

## Interaction Contract

**Pointer.** Click or tap a tile: expands in place, collapses on second click. Click the star: pin or unpin; it does not expand the tile.

**Keyboard (roving tabindex).**

| Key | Action |
|-----|--------|
| Tab | Moves into the grid on the single tabbable tile (the last focused one; first in DOM order initially). One Tab stop for the whole grid. |
| ArrowLeft / ArrowRight | Previous / next tile in DOM order across groups (Pinned first). |
| ArrowUp / ArrowDown | The tile visually above / below, from bounding rectangles: nearest tile whose horizontal extent overlaps, in the adjacent row. For a hero below-neighbour, the largest overlap wins; ties go left. |
| Home / End | First / last tile. |
| Enter / Space | Expand or collapse (native button). |
| Esc | Collapse and return focus to the tile, also when focus is on its "Open <Section>" link. |
| P | Pin or unpin the focused tile. Focus stays on the tile. Announced. |

- Tile button carries `aria-keyshortcuts="p"`. Star is `tabindex="-1"`; P is the keyboard path to pinning.
- Ctrl+P and Cmd+P are not handled.
- When a pinned tile moves in the DOM, focus is restored to the same tile by id after the move.
- Browsers do not fire focus events in an unfocused document, so the roving stop is set explicitly when keys move focus.

**Star.** `<button aria-pressed="true|false">`, label fixed as "Pin {tile name}" (a changing label with `aria-pressed` reads as "Unpin X, pressed"). Inline SVG; fill `#e0a020` and stroke `#a8710a` when pinned, stroke `#8c8c8c` when not.

**Announcements.** Through the page-level live region only, never a new one, spoken text carries no data values:
- Pin: "Pinned {tile name}, {n} pinned."
- Unpin: "Unpinned {tile name}, {n} pinned."

**Expand and motion.**
- Expand and collapse apply through the View Transitions API with CSSOM-set `view-transition-name` values when `document.startViewTransition` exists and `prefers-reduced-motion` is not `reduce` (checked in JavaScript with `matchMedia`).
- State never depends on the animation: intent is recorded synchronously (two quick clicks mean open then close); a 600ms fallback applies the change if the transition callback does not run; transition promises are caught (a skipped transition is not an error).
- Under `prefers-reduced-motion: reduce` the change applies at once; CSS `@media (prefers-reduced-motion: reduce)` sets transitions to none.
- Scroll is adjusted so the changed tile stays under the pointer.

**Focus ring.** `:focus-visible` on a tile or star: `outline: 3px solid #1a73e8; outline-offset: -3px`. On an open tile that is focused, the focus ring replaces the ink outline for as long as focus is on it.

**Forced colours.** `@media (forced-colors: active)`: bars, dots, the legend swatch and the star use system colours and a 1px outline so they remain visible; tile border is the fallback for shadows, which are dropped.

**Supersede and return.** Leaving the Overview unmounts it; returning remounts it and reads the memo instantly (D-02). Pins and the open tile are not preserved across an unmount (expansion is transient state).

---

## States

| State | What the user sees |
|-------|--------------------|
| Loading | Provenance line reads "Computing on this device." Grid shows skeleton tiles in the real layout (same spans, `#f5f5f5` fill, no text, `aria-hidden`), group headings visible, grid `aria-busy="true"`. No live region. |
| Ready | Full bento as specified. |
| Partial | Groups with absent tiles show their dashed row. Groups with no absent tiles show no row. |
| Every tile absent | Groups still render their headings and dashed rows; the provenance line stays. Copy below. |
| Compute error | One banner above the grid (existing failure banner styling), copy below. The grid is replaced by the skeleton frame with no values. Re-opening the Overview retries. |
| No export loaded | Unchanged from the shell's empty state (the Overview is not rendered). |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | None on the Overview. The actions on this page are "Open {Section} →" links (underlined ink) and the star. |
| Page title | "Overview" (existing) |
| Hint line | "Click a tile to see how it is computed. Star a tile to pin it to the top. Arrow keys move between tiles, P pins the focused tile, Esc closes." |
| Provenance line | "Computed on this device from {N} account folder(s) · {games} · {first month year} to {last month year}" |
| Loading line | "Computing on this device." |
| Group headings | "Pinned", "Time", "Tanks", "Records", "Totals" |
| Absent row | "Not in this export: {tile names} · needs {source names}" |
| Star label (fixed) | "Pin {tile name}" |
| Pin announcement | "Pinned {tile name}, {n} pinned." / "Unpinned {tile name}, {n} pinned." |
| Open link | "Open {Section} →" (Playtime, Vehicles, Finance, Payments) |
| Wargaming life label | "Wargaming life" |
| Empty state (every tile absent) | Body line under the provenance line: "None of these tiles has data in this export. Each group says what it needs." |
| Error state | Banner: "The overview could not be worked out from this export. Your data is still loaded. Open another section and come back to try again." |
| Destructive confirmation | None (no destructive action on this page). |
| Attribution footer | "Tank names, nations and classes: Wargaming.net API data. Copyright and link wording pending the Terms of Use checkpoint (D-07, D-23)." Shown at the bottom of the Overview in Caption role, `#5c5c5c`. The final text and link are supplied by that checkpoint before the generated table is committed. |

Copy marked "new" above (empty state line, error banner, loading line, wording of the strip) is proposed copy for this phase and is checked by the checker against this table. The `GENERIC_FAILURE_MESSAGE` import sentence is not reused.

---

## Privacy Rules For This Page

- Output carries counts, resolved names and dates only. Order amounts, product names, chat text, clan names, bans, IP addresses, emails and codes never reach a tile, a rule line, an expanded definition, an announcement or the DOM.
- The tank table is inlined in the worker chunk; no request is made at runtime; no key is shipped.
- Record tank names come from the numeric id through the table; an absent id reads "vehicle not recorded".
- The attribution link (footer) is an ordinary outbound link, activated only by a click; it causes no request on load.
- Zero-network: the Overview adds no fetch, no dynamic import and no worker-side network call.

---

## UI Considerations

Applicable state considerations resolved: 10 covered, 1 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Overview with no session history | ✅ covered | Logged in is absent; Time group shows its dashed row; Pinned omitted when empty |
| empty | Group with every tile absent | ✅ covered | Heading plus one dashed row; no zeros |
| loading | Overview while the single channel answer is pending | ✅ covered | Skeleton frame in the real layout, `aria-busy`, loading line in the provenance block |
| error | Overview compute failure | ✅ covered | Banner copy in Copywriting Contract; retry on re-open |
| populated | Full export, default pins | ✅ covered | Worked example in Layout and Grid |
| partial | Export missing a record column | ✅ covered | That tile is absent; the absent row names the column |
| zero-one-many | Zero pins | ✅ covered | Pinned group omitted; hint line says how to pin |
| zero-one-many | One pinned tile with data | ✅ covered | Pinned group holds one full tile; fill rule applies |
| zero-one-many | All tiles pinned | ✅ covered | Pinned group lists all with data, in catalogue order; groups keep only absent rows |
| overflow | Long nation or tank name on metric | ✅ covered | Display role (32px), wraps, `overflow-wrap: anywhere` (Long text values) |
| long-text | Long tank name on hero | 🧪 backstop | Display role (32px) and wrap; verified by a visual test at 480, 880 and 1040px pane widths |

---

## Verification Hooks

For the checker and the executor. These are binding acceptance points, not test code.

- Contrast: add the heat-scale stops (`#47a374`, `#6b8a14`, `#8c6400`), the group dots and the star colours to `tests/unit/charts/contrast.test.ts` with the ratios in Color; assert the lightest stop is at least 3 : 1 on white.
- Fill rule: `fillSpans` is unit-tested in node against an exhaustive enumeration of pin subsets for the catalogue, asserting no hero or metric is widened and no result has more holes than leaving the group alone.
- Phase-8 guard: `Overview.svelte` contains none of the banned tokens; the `overview` test id is present on the root; the phone block count stays one.
- Sizes: the Typography table is the only font-size set in the Overview component stylesheet (12, 14, 32, 56). No 22px size exists.
- Spacing: the tile gap is 16px on both axes at every width; no 12px gap exists in the Overview stylesheet.
- Zero-network: the Playwright guard covers the Overview, including opening, expanding, pinning and returning.
- PII: a planted synthetic sensitive value (order amount, chat line, clan name, email) in the source data never appears in the DOM or in a worker reply.
- Pins: the storage key is read and written only from `overview-pins.ts`; a corrupt value falls back to the defaults.
- Labels: the Overview has no `<b>` elements (existing dashboard assertion); the page-level live region count stays at two.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable |

No third-party registry or block is declared.

---

## Open Items

| Id | Item | Position in this contract | Who decides |
|----|------|---------------------------|-------------|
| OI-1 | Sketch 030 seeds Most damage as a third default pin; D-11 says two. | Two defaults (D-11). | Owner, if the third default is wanted |
| OI-2 | Pinned order: catalogue order here; the Main canvas note says sorted hero, feature, metric. | Catalogue order (overview-insights.md). | Owner; a sorted order changes the fill result only |
| OI-3 | Logged in when absent: whether the Pinned group should show an absent row instead of being omitted. | Omitted from Pinned; absent row in Time. | Owner |
| OI-4 | Attribution wording and link for tank names (Wargaming Terms of Use). | Placeholder in the footer; the checkpoint supplies the text before the table is committed. | Maintainer, after reading the Terms (D-07, D-23) |
| OI-5 | Copy marked "new" in Copywriting Contract (loading line, empty line, error banner, strip wording). | Proposed here. | Owner |
| OI-6 | Chart and row dimensions (96px year bars, 48px hour bars, 28px rows). | Build choices. | Executor, verified in the browser at 1040, 880, 479 and 340px |

---

## Checker Sign-Off

Verdicts are recorded by `gsd-ui-checker`, not pre-filled here. Boxes stay unticked until the checker reviews each dimension.

- [ ] Dimension 1 Copywriting
- [ ] Dimension 2 Visuals
- [ ] Dimension 3 Color
- [ ] Dimension 4 Typography
- [ ] Dimension 5 Spacing
- [ ] Dimension 6 Registry Safety
- [ ] Dimension 7 Inventory Provenance (not applicable: `Tool: none`)

**Approval:** pending
