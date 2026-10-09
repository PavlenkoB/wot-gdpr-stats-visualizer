---
status: complete
phase: 08-master-detail-ui-redesign
source: [08-VERIFICATION.md]
started: 2026-10-08T00:00:00Z
updated: 2026-10-08T19:27:03.127Z
---

## Current Test

[testing complete]

## Tests

### 1. Run pnpm run build && pnpm run preview, import the sample export at 1280px and compare the list pane with the Main and Color-10-Ink artboards in the design canvas README.
expected: Light grey list pane with an ink nickname, a 3px ink bar on the selected row, hover visibly lighter than selected, import controls at the bottom; blue only on focus rings.
result: pass

### 2. At 375px wide, import the sample export, stay on the list screen and choose Start over.
expected: Confirm panel fully visible on the list screen with its safe button focused; cancelling returns focus to Start over.
result: pass

### 3. Import the sample export at 1280px, then at 375px (list screen, then open Overview from the list).
expected: Cards fill the width on desktop and stack one per row at 375px with no sideways page scroll; hovering a card turns its border ink; a not-in-export card is dashed with no link; chips wrap rather than overflow.
result: pass
prior_issue: "all tabs good except this 2 financial and paletime whide not on whole screen (screenshots: Finance notes row text runs past the right edge; Playtime calendar heatmaps stop at ~60% of the detail pane width)"
note: re-test after gap closure plans 08-20..08-22 (G-08-3)

### 4. At 1280px import the sample export and open Playtime and Login history; repeat at 375px.
expected: Tile numerals are large, ink and bold on a light grey tile with a hairline border; at 375px numerals shrink and nothing wraps mid-number or scrolls sideways.
result: pass

### 5. Run pnpm run build && pnpm run preview, import the sample export and walk it at 1280px, 800px and 375px: Overview first, then every row with mouse and with j, k, Enter and Escape; back button on 375px; Start over and cancel; then a replace.
expected: Two panes at 1280px with a sticky list; stacked at 800px with focus moving to the detail on selection; list screen then detail screen at 375px; Overview cards link to their sections; nothing scrolls sideways; focus always visible and never lost to body; look matches the Day 10 canvas.
result: pass
note: "Same Finance/Playtime width problem as G-08-3 (tracked there, not a new gap)"

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-08-3
  truth: "Detail panes use the full available width; nothing is clipped or overflows the pane"
  status: resolved
  resolved_by: [08-20, 08-21, 08-22]
  resolved_at: 2026-10-08
  reason: "User reported: all tabs good except this 2 financial and paletime whide not on whole screen"
  severity: major
  test: 3
  root_cause: "Charts render at a fixed pixel layout width (no viewBox by design: MonthlyBarChart model.width, CalendarHeatmap CALENDAR_LAYOUT.width), capped by max-width:100%, so they never grow to fill the wider two-pane detail area. Finance ExcludedNotice explanation line also does not wrap inside the pane."
  artifacts:
    - path: "src/lib/charts/MonthlyBarChart.svelte"
      issue: "svg width fixed to model.width; does not scale up to pane width"
    - path: "src/lib/features/playtime/CalendarHeatmap.svelte"
      issue: "svg width fixed to CALENDAR_LAYOUT.width; year blocks stop at ~60% of pane"
    - path: "src/lib/shell/ExcludedNotice.svelte"
      issue: "explanation text runs past pane edge instead of wrapping (verify)"
  missing:
    - "Decide: scale charts to container width (measure pane, recompute layout) vs cap and left-align"
    - "Make ExcludedNotice text wrap (min-width:0 / overflow-wrap)"
  debug_session: ""

