---
name: sketch-findings-wot-gdpr-stats-visualizer
description: Validated design decisions, CSS patterns, and visual direction from sketch experiments. Auto-loaded during UI implementation on wot-gdpr-stats-visualizer.
---

<context>
## Project: wot-gdpr-stats-visualizer

The dashboard looked default and ugly: a 720px column on a wide page, raw folder names (`Activity_history`) as headings, identical gray boxes, browser-default controls, and long explanatory text between charts. Over 30 sketches (about 100 variants) we explored dark HUD, clean light, editorial, bento, Wrapped-style story, tactical, console, brutalist, dossier, pastel, timeline, blueprint, polar clock, receipt, database views, kanban, newspaper, rings, TUI, pixel, Swiss, aurora, sticky notes, streaming shelves, trading cards, spreadsheet, metro map, Bauhaus, night sky and weather-app looks.

Reference points raised: Linear / Vercel (clean light), Mail / Notes (master-detail), Spotify Wrapped and Xbox Year in Review (story), WoT stats sites (HUD).

The user's stated favourite was the **Q2 master-detail family**, narrowed in sketch 021 to the minimal configuration below.

Sketch session wrapped: 2026-10-07. Design pass and palette decision: 2026-10-07 (live canvas https://claude.ai/artifact/XM5a7aV2p2XWze9DFi37G3).
Overview redesign (sketches 022-030, spikes 001-003): 2026-10-22 (live canvas https://claude.ai/artifact/BJc6oZ2QEQkphxoKkq1Pa1).
Design unification (Phase 14): 2026-10-25 to 2026-10-28; shared token layer in `src/styles/`, one type scale, the heat scale replaces the Activity ramp.
</context>

<design_direction>
## Overall Direction

**Q2 master-detail with an Overview landing section, in the "Day 10, ink + teal" palette.**

- **Layout:** two panes. Left: a list of sections (Overview first, then Playtime, Login history, Vehicles, Finance, Payments, Account, and a quiet "Not yet supported" footer row). Right: the selected section. Overview is the default view. **It is now a personal-insights page of grouped, pinnable tiles (see `references/overview-insights.md`), not status chips plus section cards.** Unavailable list rows stay muted; unavailable Overview tiles are dashed "not in this export" tiles. `j`/`k` and arrow keys move the selection. Phone: list screen then detail screen with a back button.
- **Palette:** white page, neutral ink chrome (`#111` titles, links, selected bar, one filled primary button), light grey list pane, hairlines `#dcdcdc`. Selected row `#e0e0e0` with a 3px ink bar; hover `#ececec`. **Data colour: the Activity teal ramp was RETIRED by Phase 14 (D-10) and replaced by the Overview heat scale** (`--heat-empty` and `--heat-1` to `--heat-5`: three stops, green `#47a374` to olive `#6b8a14` to dark gold `#8c6400`, with two `color-mix(in srgb, ...)` midpoints; level 0 is the neutral grey `#eef0f2`). Do not reintroduce `--ramp-*`. Keyboard focus ring stays blue `#1a73e8`.
- **Type:** the app's own system-ui stack (no webfont). Phase 14 scale: 12 / 14 / 18 / 26 / 32 / 56px (`--fs-caption`, `--fs-body`, `--fs-heading`, `--fs-display`, `--fs-stat`, `--fs-hero`), weights 400 / 600, nine `.t-*` roles in `src/styles/type.css`; page titles are 32px from 900px up and 26px below.
- **Notes pattern:** one caption under each chart plus an "About this chart" disclosure. Provenance line ("From Activity_history · 1 file, 311 rows") instead of raw folder names as headings.
- **Empty state:** large dashed drop target and a privacy sentence.

Explicitly not chosen: preview-card and big-type lists, polar clock, properties panel, KPI chips, Prev/Next buttons, row previews, Chart/Table toggle (candidate for later), dark mode, and the other 11 palettes.

Constraints from AGENTS.md that the build must respect:
- Svelte 5 runes, no new dependencies; charts stay hand-rolled SVG/CSS grid.
- No client-side router: selecting a section is component state, never a route.
- One phone-width block at 480px (`src/app.css`), 44px touch-target floor.
- Heatmaps aggregate per bucket (never one node per raw row); keep existing in-chart keyboard navigation.
- Tokens, roles and utilities live in `src/styles/` (`tokens.css`, `type.css`, `utilities.css`, imported by `src/main.ts` in that order); `src/app.css` keeps the element resets, the shell layout and the one phone block. The type scale is 12 / 14 / 18 / 26 / 32 / 56px (`--fs-*`); spacing is 4 / 8 / 12 / 16 / 24 (`--space-*`) with the gutters under `--layout-*`. The guard that enforces all of it, on every file with no exemption, is `tests/unit/guards/design-tokens-guards.test.ts`; the heat scale is pinned by `tests/unit/charts/contrast.test.ts`.
- One-line edits: change a size in `--fs-*`; change a colour in `tokens.css`; change a role in `type.css`; change a shared box in `utilities.css`. Never restate a size, a gap or a colour in a component.
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Layout & navigation | references/layout-and-navigation.md | Two-pane master-detail with Overview first; row-per-section map to real folders; muted unavailable rows; footer "Not yet supported"; j/k + arrows; empty state; phone = list screen then detail screen |
| Visual language | references/visual-language.md | Day 10: white page, neutral ink chrome, selected #e0e0e0 vs hover #ececec, underlined ink links, heat scale (Phase 14 replaced the teal ramp), 8px cards, system-ui, 44px controls, caption + disclosure for notes |
| Overview (personal insights) | references/overview-insights.md | Grouped bento of tiles (Pinned, Time, Tanks, Records, Totals), three sizes, one number + its rule each; click expands DOWN in its own column with no jump (View Transitions, scroll anchor, fallback); pins on top; absent data = dashed tile; colour only group dots + amber pinned stars; lifted shadows with hairlines kept; tank names via build-time WG table |

## Theme

`sources/themes/default.css` holds the chosen Day 10 neutral tokens as sketched. In the app they now live in `src/styles/tokens.css`, and the teal ramp it mentions was retired in Phase 14.

## Source Files

Sketch HTML and the hi-fi design canvas files are preserved in `sources/` (`021-q2-configurator/`, `design-canvas/`, `overview-final/`, `design-canvas-overview/`; read each folder's README first, it says what is authoritative; the Overview artboards in `design-canvas-overview/` supersede the Overview ones in `design-canvas/`). The configurator (`sources/021-q2-configurator/index.html`) contains every option that was tried; the chosen combination is the default-minimal one: `theme=light list=rows props=off chips=off clock=heatmap prevnext=off`.
</findings_index>

<metadata>
## Processed Sketches

Curation choice: winner only, no alternatives. Sketches 001-021 were processed first (only 021 carried); 022-030 (Overview redesign) were added 2026-10-22 (only 030 carried, as `sources/overview-final/`). The others remain in `.planning/sketches/` for history.

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
- 022-overview-insights
- 023-overview-bento-refinements
- 024-overview-alternatives
- 025-overview-grouped-interactive
- 026-overview-fresh-a
- 027-overview-fresh-b
- 028-overview-explain-popover (rejected)
- 029-overview-no-jump-expand (winner R2, down in its column)
- 030-overview-final (final synthesis; carried into this skill)

Overview spikes (feasibility, kept in `.planning/spikes/`): 001 vehicle-lookup-table, 002 time-played-definitions, 003 insight-catalog.
</metadata>
