# Layout & Navigation

Final decisions as of 2026-10-07: Q2 master-detail, **with an Overview landing section** (chosen from the alternatives round), rendered in the Day 10 palette (see visual-language.md).

## Design Decisions
- **Master-detail, two panes.** Left: list of sections (320px). Right: the selected section's detail, filling the rest (inner max-width about 1000-1100px). Chosen over the long scroll with anchor nav (today's `DashboardNav.svelte` + scroll-spy), accordion, tabs, bento, story panels.
- **Why it won:** it fixes the endless page without losing structure; each section gets full width for its charts; no scroll-spy to keep in sync.
- **Overview first (new).** The first row is **Overview** and it is selected by default after an import. It answers "what do I see before choosing?" and avoids landing on an arbitrary section. Research basis: a purposeful nothing-selected state and headline-first progressive disclosure.

### The list rows
`Activity_history` is split into two rows because it already holds two blocks. Raw folder names stop being headings and become a muted provenance line in the detail header.

| Row | Folder it reads | Headline | Summary line |
|---|---|---|---|
| Overview | all | none | "What your export contains" |
| Playtime | Activity_history | total hours | sessions · active days |
| Login history | Activity_history | IP count | logins · countries matched |
| Vehicles | Player_statistics | count or "—" | "WoT is not in this export" |
| Finance | Financial_data | "—" | "Not in this export" |
| Payments | Payment_history | per-currency total | paid orders |
| Account | User_Info | location code | "Location code and creation date" |
| Not yet supported (footer row) | everything else | "N folders" badge | none |

- **Unavailable sections** (Vehicles, Finance when absent) stay in the list with muted title and headline. Their detail shows a dashed "Not in this export" panel. Keep ONE derivation (`navEntries(result)` in `dashboard-status.ts`) for row, Overview card and detail so they cannot disagree; the absent vs present-but-empty distinction (DATA-04) still applies to the wording.
- **"Not yet supported"** is a quieter footer row with a "4 folders" badge. Its detail lists the folders with their file and row counts, one list, one style, no per-status styling (as today).
- **Row anatomy:** title (14px/600) left, headline right (14px/600), one summary line under (12.5px muted). Min height 56px. Rows are real `<button>`s inside a `<ul>` with `aria-current="true"` on the selected one.
- **Selected row:** `#e0e0e0` background, 3px inset ink bar on the left edge, title in ink. **Hover:** `#ececec`, no bar. The two must be clearly different.
- **List pane top:** product label, nickname (22px/600), "Account ID … · Location code …", "Account created … · Imported …".
- **List pane bottom:** compact dashed drop target ("Drop a new export (.zip) here, or click to choose it"), outlined "Start over", underlined-ink "Clear my cached data". Show the "Move with j and k" hint only while the list has focus (a visible permanent hint was tried and judged noisy).
- **Keyboard:** `j` / `k` and ArrowUp / ArrowDown move the selection when focus is in the list (handled on the list, not on `document`, so it never fights inputs or chart arrow keys). Enter moves focus to the detail. Provide a "Skip to section detail" link first in the list pane.
- **Selection is component state**, not a route. (Optional later: mirror it in `location.hash` so a refresh keeps the section; this keeps the no-router rule and avoids the GitHub Pages refresh-404. Not decided.)

### Overview content
> **Superseded 2026-10-22** by the personal-insights Overview in `overview-insights.md` (grouped tiles, pins, expand-in-place, no status chips, no per-section cards). The list-row model above (including the "Overview" row, its default selection and the unavailable-row treatment) still applies. What follows is kept as history.
- Heading "Overview" and one line: "What your export contains. Open a section for the full charts."
- Three status chips: "N sections with data", "N not in this export", "N folders not yet supported" (all computed from the same status derivation).
- A responsive grid (`repeat(auto-fit, minmax(min(300px,100%),1fr))`, 16px gap) of **section cards**: label (13px/600 muted), headline (30px/600 ink), one summary line, a tiny preview where meaningful, and an underlined "Open <Section> →" link.
  - Playtime: 12-bar monthly sparkline in ramp-3 (sketch only; the app now uses the heat scale since Phase 14).
  - Login history: stacked bar of logins per address (ramp 4/3/2 in the sketch; the app now uses the heat scale since Phase 14) plus "addresses masked".
  - Payments: per-currency total plus "Each currency has its own total; nothing is converted."
  - Account: location code and creation date.
- **Unavailable sections** appear as dashed `#f5f5f5` panels, not as links ("WoT is not in this export.", "Not in this export.").
- Cards are real `<button>`/links with a visible focus ring; activating one selects that section in the list and moves focus to its detail.
- Every number on the Overview must come from the existing aggregates; the sketch's invented values (412.8 h etc.) are mock data.

### Detail pane
- Header: title 26px/600 and the provenance line. No breadcrumb, no Prev/Next buttons.
- Charts: caption line under each chart, extra copy in an "About this chart" disclosure (see visual-language.md).

### Empty state (no export)
List rows are muted with "Drop an export to see this section"; the detail area is one large dashed drop target plus a short privacy statement ("Your data stays in this tab"). The nickname slot reads "No export loaded". There is no Overview content yet.

### Fluid layout
The app shell is a wrapping flex row: list `flex: 1 0 320px`, detail `flex: 999 1 560px; min-width: 0`. At >= 900px the list is `position: sticky; top: 0; height: 100vh; overflow: auto`; below that the list stacks above the detail.

### Phone (<= 480px)
- Two screens, no router: **list screen** then **detail screen**, selection held as component state. The list screen's first row is Overview.
- **List screen:** identity header on white, then a grouped white list with 64px rows (title and summary left, headline right, chevron), a second group with the "Not yet supported" row (52px), then replace / start-over / clear actions at 48px.
- **Detail screen:** top bar with a 48px-high back button "‹ Sections" at the left and the section title centred. Overview cards stack in one column. Stat tiles become a compact 3-up row (22px numerals). Calendar and hour grids sit in horizontally scrolling boxes; "About this chart" has a 44px summary.
- All touch targets >= 44px (48px on phone), matching the existing floor in `src/styles/shell.css`.

## CSS Patterns
```css
.shell{display:flex;flex-wrap:wrap;min-height:100vh}
.pane-list{flex:1 0 320px;background:var(--list);border-right:1px solid var(--border);display:flex;flex-direction:column;align-self:flex-start}
.pane-detail{flex:999 1 560px;min-width:0;padding:32px 40px 64px}
@media (min-width:900px){.pane-list{position:sticky;top:0;height:100vh;overflow:auto}}
.row{all:unset;box-sizing:border-box;width:100%;min-height:56px;padding:10px 20px;display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;cursor:pointer;border-bottom:1px solid var(--border)}
.row:hover{background:var(--hover)}
.row[aria-current="true"]{background:var(--sel);box-shadow:inset 3px 0 0 var(--ink)}
.row .title,.row .headline{font-size:14px;font-weight:600;color:var(--ink)}
.row .sub{grid-column:1/-1;font-size:12.5px;color:var(--muted)}
.row.muted .title,.row.muted .headline{color:var(--muted)}
.ov-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:16px}
.ov-card{border:1px solid var(--border);border-radius:8px;padding:18px;display:flex;flex-direction:column;gap:10px;background:var(--card)}
.ov-card:hover{border-color:var(--ink)}
.ov-card.na{border:1px dashed var(--faint);background:var(--list)}
```

## HTML Structure
```html
<div class="shell">
  <aside class="pane-list">
    <a href="#detail">Skip to section detail</a>
    <div><!-- label, nickname, account meta --></div>
    <nav aria-label="Sections"><ul>
      <li><button class="row" aria-current="true"><span class="title">Overview</span><span class="headline"></span><span class="sub">What your export contains</span></button></li>
      <li><button class="row"><span class="title">Playtime</span><span class="headline">412.8 h</span><span class="sub">286 sessions · 143 active days</span></button></li>
      <!-- Login history, Vehicles (muted), Finance (muted), Payments, Account -->
    </ul>
    <button class="row"><!-- Not yet supported + "4 folders" badge --></button></nav>
    <div><!-- drop target, Start over, Clear my cached data --></div>
  </aside>
  <main id="detail" tabindex="-1" class="pane-detail"><h2>Overview</h2><!-- status chips + .ov-grid --></main>
</div>
```
Accessibility for the build: decide listbox vs a list of buttons with `aria-current`; the detail is a labelled region; keep in-chart keyboard navigation.

## Considered and not chosen (candidates for later)
- **Row previews on every list row** (alt A, e.g. sparkline in the Playtime row): the Overview now covers triage; revisit if the list needs more at-a-glance info.
- **Chart | Table toggle per chart** (alt C): good for accessibility and data-literate users; needs a table design per chart and an a11y review. Strong candidate for a follow-up phase.
- **"In short" summary sentence and Busiest-hour / Typical-session tiles** (alts A and C): new derived statistics that the app does not compute today; only add if they are specified and tested.
- **Hash deep link / "Copy link"** (alt A): see the optional note above.
- Properties panel, KPI chips, Prev/Next, preview-card and big-type lists, polar clock, dark and Swiss themes (earlier rounds).

## Open for the build (not design questions)
- Exact ARIA pattern for the list.
- Reconciling the e2e specs and the CI budget (specs that locate sections by scroll position).
- Final copy for the drop target and the empty-state privacy line.
- Whether Overview is the default after import or only after the first section is chosen (design assumes default).

## Origin
Sketches 008, 011, 012, 014, 017, 018, 021 and the design canvas https://claude.ai/artifact/XM5a7aV2p2XWze9DFi37G3 (Main, Empty, Phone-List, Phone-Detail, Alt-B Overview, Color 10 Ink). Sources in `sources/design-canvas/`.
