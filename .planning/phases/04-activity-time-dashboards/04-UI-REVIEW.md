# Phase 4 — UI Review

**Audited:** 2026-10-02
**Baseline:** 04-UI-SPEC.md (approved, amended 2026-10-01)
**Screenshots:** captured (orchestrator real-archive captures at 1280px and 375px viewed out-of-repo; earlier synthetic set in .planning/ui-reviews/04-20261002-synth/ not recaptured). No figures from the real archive are recorded here.
**Interaction captures:** off (workflow.ui_interaction_capture is false). Hover, focus, tooltip and keyboard findings are code-derived only.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Strings match the contract; legend note collides with legend row visually; no empty-bin affordance issues |
| 2. Visuals | 2/4 | Calendar weekday labels clipped at the SVG left edge; tile numeral/unit breaks mid-word at 375px |
| 3. Color | 3/4 | Ramp and accent discipline hold; level-0 cells nearly vanish on white, so empty vs. edge of grid is weak |
| 4. Typography | 3/4 | Only 14/16/28px roles and 400/600 weights; 14px floor met everywhere; hour-grid legend text runs together |
| 5. Spacing | 2/4 | Legend row and its note have no gap; tile wraps badly; phone view has 11 stacked scrollers with large dead area |
| 6. Experience Design | 2/4 | Phone scrollers give no scroll affordance and hide most of each chart; Phase 7 defers touch polish |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **BLOCKER-class visual defect: calendar weekday labels ("Mon", "Wed", "Fri") are clipped at the left edge of every year grid** — in the real captures at both widths the first letter is cut off, on all 11 year blocks. Labels are `text-anchor: end` at x = 24 (gutter 32 minus 8) and "Mon" at 14px is wider than 24px, so it starts at a negative x inside an SVG whose overflow is clipped by the scroller. Fix: set the label x to gutter - 4 (28) and widen the gutter, or reduce the label pad. A wider gutter changes the 626px geometry, so re-derive widths (record it as an amendment to the Spacing exceptions) and keep the 54-column fit.
2. **Phone: tile numeral and unit break mid-word** — at 375px the Total playtime tile renders the number split across lines and the unit "hours" broken as "hour / s" (`overflow-wrap: anywhere` on `dd` in `src/lib/components/PlaytimeSummary.svelte` line ~223 lets a flex child shrink and break). The headline figure of the section is unreadable as a single value. Fix: make the unit `white-space: nowrap`, let `dd` wrap as a block (numeral on one line, unit below) or raise the tile `minmax` so three tiles do not squeeze into two columns with a half-width tile; apply `overflow-wrap: normal` to numerals and keep `anywhere` only for untrusted text.
3. **Phone: charts are mostly hidden behind 12 independent scrollers with no affordance** — at 375px each year shows about 4.5 months of a 626px grid (visible to roughly June) and the hour grid stops at about 09:00. There is no fade, scrollbar styling, hint text or "scroll for more" cue, and 11 stacked scrollers make vertical page scrolling vulnerable to getting caught on the grids. The contract defers touch polish to Phase 7, so this is a WARNING, but add a minimal affordance now (right-edge fade or a Caption hint "Scroll sideways to see the rest of the year") and consider auto-scrolling the busiest part into view.

Additional issues worth fixing (beyond the top 3):

4. The legend row and its note read as one run-on line on desktop ("Less [swatches] More Shades rank the busiest hours of the week...") for the hour grid, because the note follows "More" with no gap or wrap boundary. Put the note on its own line with the 8px gap the spec assigns, as the calendar legend already effectively does.
5. Level 0 (`#eef0f2`, 1.14:1 on white) is nearly invisible on the white card in the hour grid, so a quiet hour looks like a missing cell next to the 1px white separators; the contract accepts this by design, but with the real-data weekday-by-hour view roughly a quarter of cells in the early hours are level 0 and the grid silhouette is lost. Consider a 1px `#dadce0` hairline around level-0 cells (still a class, no inline style).
6. The sticky year head on phone wraps its summary below the year (about 48px tall versus the 32px the sticky offset assumes). This was a carried checker flag; confirm that scroll-margin and sticky offsets derive from the real height (CSS uses min-height 32px, so the offset can undershoot).
7. Hour-grid and calendar chart widths on desktop: the hour grid (624px) and calendar (626px) fit the card, but the card at 1280px is wider than the charts, leaving the chart left-aligned with empty space on the right while the split table and duration rows span the full card width. Visually inconsistent column widths; acceptable per the fixed-size contract but note it.
8. The nav scrolls internally (730px inside 325px phone, 730 inside 718px at 1280px) with no affordance; this is a Phase 3 item, but the link "Not yet supported" is cut at the screenshot edge on both widths.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- All contract strings render as specified in the captures: selector label "Game", split caption "Hours by game", overlap note referencing "different games", chart titles, basis captions (calendar and weekday-by-hour), keyboard hints, year-head summaries, legend words and duration bin labels, `{n} · {p}%` rows with `0` for the empty top bin.
- The Display unit uses plural "hours" (consistent with `formatHours`).
- No generic labels ("Submit", "OK") exist; the phase adds no buttons.
- Deduction: the legend note copy is joined to "More" without separation in the hour grid (see fix 4), which harms readability of otherwise correct copy. Not verified in this review: the empty, error, loading and cache-cleared states (not capturable from the real archive; unit/E2E coverage exists per summaries).

### Pillar 2: Visuals (2/4)
- Clear focal point: three Display-size tiles at the top, then the calendar. Hierarchy through weight and size works (Label headings, Caption notes).
- DEFECT: weekday labels clipped in every year grid (fix 1). This is the most repeated visual flaw: 11 grids by 3 labels.
- DEFECT: phone tile numeral and unit broken (fix 2).
- Real-data behaviour is otherwise good: 11 years stack legibly newest first, the ramp reads clearly, the hour grid shows a strong evening pattern, the duration bars are proportional with a visible short bar for a tiny bin and no bar for the empty bin.
- Month labels with no activity in a year still render, and some early-year labels overlap the clipped weekday labels region ("Jan" sits close to the label gutter).
- No icon-only controls exist; the select has a visible label.

### Pillar 3: Color (3/4)
- Accent `#1a73e8` is reserved for focus rings (code: `outline: 3px solid #1a73e8` on the select, SVG ring strokes in both heatmaps); no data mark uses it. The teal ramp is single hue and monotonic in the captures. Tiles use `#f7f7fa` per the 30% role; hardcoded hex values are all contract tokens.
- Duration bars use `#1f7a74` only, as specified.
- Deduction: level 0 against white (1.14:1) and levels 1 (1.49:1) and 2 (1.95:1) are weak for distinguishing cells in the hour grid and sparse years, which is accepted by the contract (relief rule) but means colour alone cannot show structure without tooltips; on phones, where no tooltip exists (touch deferred), the relief is only the year-head totals.
- Selected split-table row uses `#f1f3f4` plus weight, per the contract.

### Pillar 4: Typography (3/4)
- Sizes found in the audited components: 14px, 16px and 28px only; weights 400 and 600 only. No chart text under 14px, SVG text unscaled. This matches the four-role contract and passes the 14px floor.
- Deduction: the Display numeral unit pairing breaks at narrow widths (fix 2); legend text runs together (fix 4); the year-head summary on phone wraps to its own line, which is acceptable.

### Pillar 5: Spacing (2/4)
- Block rhythm (24px between sub-blocks, 16px tile gap, 8px caption/chart gap) is consistent in the desktop capture and matches the scale; chart geometry uses only declared exceptions.
- Deductions: legend and note adjacency (fix 4); tile squeezing at 375px produces a lone tile on a second row with a half-width first row (two tiles plus one orphan), per the contract's two-per-row intent, but the first tile is too narrow for its content; label gutter too narrow for its text (fix 1); on phone the 11 year blocks with 4.5 months visible create about 1,000px of repeated mostly-empty scroller area.
- Page-level overflow: none at either width (scrollWidth 375 = clientWidth, as measured by the orchestrator), meeting the contract's phone requirement. Internal scrollers: calendar x11 (626 inside 293), hour grid (624 inside 293), nav (730 inside 325).

### Pillar 6: Experience Design (2/4)
- State coverage is strong in code per the contract (loading, updating, no-session-file, no-usable-sessions, error, cache-cleared notice) with a polite live region and roving-focus grids; this review could not exercise them visually (interaction capture off), so these are code- and summary-derived.
- Large-data behaviour: 4,000+ sessions over 11 years render without visible breakage; node counts are bounded by active years, 168 cells and 12 bins; the duration list stays readable at 375px with the two-line row layout and a full-width bar.
- Deductions: no scroll affordance on 12 phone scrollers (fix 3, WARNING since Phase 7 owns touch); the tooltip is hover/focus only so phone users get no per-cell values in the grids (Phase 7 deferred, WARNING); the nav's own internal scroller has no affordance (carried from Phase 3).
- Registry audit: not applicable (no shadcn, no third-party registries).

---

## Files Audited
- /Users/you/src/github/wot-gdpr-stats-visualizer/.planning/phases/04-activity-time-dashboards/04-UI-SPEC.md
- /Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/components/Playtime.svelte
- /Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/components/PlaytimeSummary.svelte
- /Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/components/PlaytimeCharts.svelte
- /Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/components/CalendarHeatmap.svelte
- /Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/components/HourGrid.svelte
- /Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/components/DurationList.svelte
- /Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/components/ChartLegend.svelte
- /Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/components/ChartTooltip.svelte
- /Users/you/src/github/wot-gdpr-stats-visualizer/src/lib/playtime-model.ts
- Real-archive captures (outside the repo, not copied): p4-desktop-playtime, p4-phone-playtime, p4-desktop-hour-chart, p4-phone-duration-chart
