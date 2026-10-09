---
name: sketch-findings-wot-gdpr-stats-visualizer
description: Validated design decisions, CSS patterns, and visual direction from sketch experiments. Auto-loaded during UI implementation on wot-gdpr-stats-visualizer.
---

<context>
## Project: wot-gdpr-stats-visualizer

The dashboard looked default and ugly: a 720px column on a wide page, raw folder names (`Activity_history`) as headings, identical gray boxes, browser-default controls, and long explanatory text between charts. Over 21 sketches (about 65 variants) we explored dark HUD, clean light, editorial, bento, Wrapped-style story, tactical, console, brutalist, dossier, pastel, timeline, blueprint, polar clock, receipt, database views, kanban, newspaper, rings, TUI, pixel, Swiss, aurora, sticky notes, streaming shelves, trading cards, spreadsheet, metro map, Bauhaus, night sky and weather-app looks.

Reference points raised: Linear / Vercel (clean light), Mail / Notes (master-detail), Spotify Wrapped and Xbox Year in Review (story), WoT stats sites (HUD).

The user's stated favourite was the **Q2 master-detail family**, narrowed in sketch 021 to the minimal configuration below.

Sketch session wrapped: 2026-10-07. Design pass and palette decision: 2026-10-07 (live canvas https://claude.ai/artifact/XM5a7aV2p2XWze9DFi37G3).
</context>

<design_direction>
## Overall Direction

**Q2 master-detail with an Overview landing section, in the "Day 10, ink + teal" palette.**

- **Layout:** two panes. Left: a list of sections (Overview first, then Playtime, Login history, Vehicles, Finance, Payments, Account, and a quiet "Not yet supported" footer row). Right: the selected section. Overview is the default view and shows status chips plus one summary card per section; unavailable sections are dashed "not in this export" panels. `j`/`k` and arrow keys move the selection. Phone: list screen then detail screen with a back button.
- **Palette:** white page, neutral ink chrome (`#111` titles, links, selected bar, one filled primary button), light grey list pane, hairlines `#dcdcdc`. Selected row `#e0e0e0` with a 3px ink bar; hover `#ececec`. **Data keeps the app's existing teal ramp untouched.** Keyboard focus ring stays blue `#1a73e8`.
- **Type:** the app's own system-ui stack (no webfont).
- **Notes pattern:** one caption under each chart plus an "About this chart" disclosure. Provenance line ("From Activity_history · 1 file, 287 rows") instead of raw folder names as headings.
- **Empty state:** large dashed drop target and a privacy sentence.

Explicitly not chosen: preview-card and big-type lists, polar clock, properties panel, KPI chips, Prev/Next buttons, row previews, Chart/Table toggle (candidate for later), dark mode, and the other 11 palettes.

Constraints from AGENTS.md that the build must respect:
- Svelte 5 runes, no new dependencies; charts stay hand-rolled SVG/CSS grid.
- No client-side router: selecting a section is component state, never a route.
- One phone-width block at 480px (`src/app.css`), 44px touch-target floor.
- Heatmaps aggregate per bucket (never one node per raw row); keep existing in-chart keyboard navigation.
- Keep `--ramp-0..5` as is; add only the neutral tokens from sources/themes/default.css; re-run and extend the contrast test.
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Layout & navigation | references/layout-and-navigation.md | Two-pane master-detail with Overview first; row-per-section map to real folders; muted unavailable rows; footer "Not yet supported"; j/k + arrows; empty state; phone = list screen then detail screen |
| Visual language | references/visual-language.md | Day 10: white page, neutral ink chrome, selected #e0e0e0 vs hover #ececec, underlined ink links, existing teal ramp kept, 8px cards, system-ui, 44px controls, caption + disclosure for notes |

## Theme

`sources/themes/default.css` holds the chosen Day 10 neutral tokens (the ramp stays the app's own).

## Source Files

Sketch HTML and the hi-fi design canvas files are preserved in `sources/` (`021-q2-configurator/`, `design-canvas/`; read `design-canvas/README.md` first, it says which artboards are authoritative). The configurator (`sources/021-q2-configurator/index.html`) contains every option that was tried; the chosen combination is the default-minimal one: `theme=light list=rows props=off chips=off clock=heatmap prevnext=off`.
</findings_index>

<metadata>
## Processed Sketches

Curation choice: winner only, no alternatives. All 21 sketches were processed; only 021 is carried into this skill. The others remain in `.planning/sketches/` for history.

- 001-dashboard-look
- 002-dashboard-look-round2
- 003-wrapped-navigation
- 004-fresh-directions
- 005-bento-variations
- 006-clean-light-variations
- 007-pastel-bento-variations
- 008-fresh-round3
- 009-fresh-round4
- 010-docs-style-variations
- 011-master-detail-variations
- 012-hybrid-master-polar
- 013-fresh-round5
- 014-master-detail-round2
- 015-fresh-round6
- 016-fresh-round7
- 017-master-detail-round3
- 018-master-detail-round4
- 019-fresh-round8
- 020-fresh-round9
- 021-q2-configurator
</metadata>
