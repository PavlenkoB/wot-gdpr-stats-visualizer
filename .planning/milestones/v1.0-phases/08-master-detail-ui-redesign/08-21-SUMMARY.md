---
phase: 08-master-detail-ui-redesign
plan: 21
subsystem: ui
tags: [svelte5, svg-heatmaps, resize-observer, layout, playwright, vitest]
status: complete
gap_closure: true
gap_ids: [G-08-3]

requires:
  - phase: 08-master-detail-ui-redesign
    provides: chart-width.ts (usableChartWidth, CHART_RING_PAD_PX) and chart-fill.spec.ts from plan 08-20
provides:
  - calendarLayoutFor and hourGridLayoutFor: pure exact-fill layouts from a measured width, today's geometry as the floor
  - buildCalendarModel(slice, layout?) and buildHourGridModel(slice, basis?, layout?) carrying model.layout and a width on every cell
  - PlaytimeCharts: one bind:contentRect measurement feeding both heatmaps
  - CalendarHeatmap and HourGrid reading every size from model.layout and the cell
affects: [08-22 gate and manual 1280/800/375 check]

actuals:
  tokens: 26000
  tasks: 3
  commits: 3
plan_head_before: 3a950baa3f5fae105a1f959232c758512662becf
plan_head_after: cfb26de09a693aef8470cd0ae834d1457fe7f7de

tech-stack:
  added: []
  patterns:
    - "Measure a block whose width its parent sets (never the svg) with bind:contentRect, floor it, re-lay out a pure model"
    - "Exact-fill columns: edges floor(c x plot / n), so columns differ by at most 1px and sum to the plot"
    - "Today's geometry is the floor of every width-aware layout; the no-layout call is unchanged"

key-files:
  created: []
  modified:
    - src/lib/features/playtime/playtime-model.ts
    - src/lib/features/playtime/PlaytimeCharts.svelte
    - src/lib/features/playtime/CalendarHeatmap.svelte
    - src/lib/features/playtime/HourGrid.svelte
    - tests/unit/playtime/playtime-model.test.ts
    - tests/unit/playtime/playtime-charts.test.ts
    - tests/e2e/shell/chart-fill.spec.ts
    - tests/e2e/playtime/playtime-ui-review.spec.ts
    - tests/e2e/playtime/playtime-charts.spec.ts

key-decisions:
  - "Fill only when the plot (width - gutter - 4) is STRICTLY greater than today's plot (calendar 594, hour grid 576); at or below it the legacy 634 / 624 layout is returned, so phones keep their scrollers (calendar floor 638, hour grid 628)"
  - "Row pitch is the narrowest column width, capped at 24 (calendar) and 48 (hour grid); only the cell height is capped, columns always fill the pane, so very wide panes give cells wider than tall"
  - "Calendar cell height is rowPitch - 1 (the 1px separator), hour-grid cell height is rowPitch, matching today's 10/11 and 24/24"
  - "No upper width bound: 4000px produces a 4000px svg; the 4px reserve keeps the 3.5px ring overhang inside the svg"

metrics:
  duration: ~25m
  completed: 2026-10-08
---

# Phase 8 Plan 21: Playtime heatmaps fill the detail pane Summary

The calendar year svgs and the weekday-by-hour svg now measure the Playtime pane once (`bind:contentRect` on the charts root) and lay out to exactly that width: 879px at 1280 instead of 634 and 624, with no upper bound, while 375px keeps today's 634/624 geometry and horizontal scrollers.

## What was built

- **playtime-model.ts**: `CalendarLayout` / `calendarLayoutFor` and `HourGridLayout` / `hourGridLayoutFor` (with `CALENDAR_MAX_ROW_PITCH_PX = 24`, `HOUR_GRID_MAX_ROW_PITCH_PX = 48`). Both return today's layout for unusable input or a fill plot that does not beat today's; otherwise `colEdges = floor(c x plot / columns)`, svg width = measured width, height = `band + 7 x rowPitch`. `CALENDAR_LAYOUT` and `HOUR_GRID_LAYOUT` are untouched. `CalendarCell` and `HourCell` gained `width`; both models carry `layout`; the builders take an optional layout and default to today's, so every pre-existing model test passes unmodified. Cell x/y, month labels, hour labels and weekday rows follow the layout. Navigation, scale, legend, cell counts and test ids do not depend on width.
- **PlaytimeCharts.svelte**: one `chartsRect` bound on the root `div.charts`, `chartsWidth = floor(width)`, feeding `calendarLayoutFor` and `hourGridLayoutFor`. `buildCalendarModel(` stays here and out of the calendar component.
- **CalendarHeatmap.svelte / HourGrid.svelte**: svg width/height, cell rects, hover and keyboard rings (outer `+3`, inner `+7`) and weekday label positions all read `model.layout` and the cell's own width. Weekday label y is `band + row x rowPitch + round(cellHeight / 2) + 2` (calendar) and `row.y + round(rowPitch / 2) + 4` (hour grid), equal to the old `row x 11 + 27` and `row.y + 16` on today's layout.
- **Tests**: 15 new unit tests (floor members for invalid input and 343/638 and 343/628, first fill widths 639 and 629, 720/879/1326/1500/4000 numbers, models at 879 moving geometry only, and the fill property over every integer width 300 to 4000 for both layouts); source-scan updates in `playtime-charts.test.ts`; one new listed e2e test, `playtime charts fill the detail pane`, appended to `chart-fill.spec.ts` (calendar and hour grid equal their scrollers within 1px at 1280 and 2400, cells at least 14 / 34 wide at 1280, heights at most 23 / 48 at 2400).

## Spec reconciliation (no assertion deleted or weakened)

| Spec | Was | Now (measured reason) |
| ---- | --- | --------------------- |
| playtime-charts.test.ts (calendar scan) | `width={CALENDAR_LAYOUT.width}`, `height={CALENDAR_LAYOUT.height}` | `width={model.layout.width}`, `height={model.layout.height}`; no-viewBox, role and tabindex assertions kept |
| playtime-charts.test.ts (hour grid scan) | `width={HOUR_GRID_LAYOUT.width}`, `height=...` | `model.layout.width` / `.height`; no-viewBox kept; contract added that PlaytimeCharts binds the rect and feeds both layout functions |
| playtime-ui-review.spec.ts | each calendar svg at most 640px wide | svg is 634 (floor, scrolling) or equals its scroller's clientWidth within 1px, measured in the same page evaluation; every label-clip assertion kept and still green at 1280 and 375 |
| playtime-charts.spec.ts (hour grid hover ring) | hover ring width equals keyboard ring width | The two rings sit on neighbouring cells 20 and 21, which can differ by 1px on a filled grid (measured: 37 vs 38 at 1280). Now each ring is compared with its own cell: cell width + 3 and + 7. Identical statement on the fixed 24px layout, and it also pins the ring-follows-its-cell rule |

## Deviations from Plan

**1. [Rule 1 - Bug in existing spec] Hover/keyboard ring parity pinned equal widths of different cells.**
- **Found during:** Task 2 (playtime-charts.spec.ts, hour grid hover ring test)
- **Issue:** the assertion compared the hover ring (cell 20) with the keyboard ring (cell 21); with distributed columns of 34 and 35px these differ by 1, so `Expected "38", Received "37"`.
- **Fix:** compare each ring with its own cell's width (+3 and +7), as in the table above. The plan lists this file for Task 3; it was changed in Task 2 because the Task 2 verify command runs it.
- **Files modified:** tests/e2e/playtime/playtime-charts.spec.ts
- **Commit:** 664d149

No other deviations.

## Verification

- `pnpm exec vitest run tests/unit/playtime tests/unit/charts tests/unit/guards`: 836 passed
- `pnpm exec playwright test --project=chromium tests/e2e/playtime tests/e2e/shell/chart-fill.spec.ts`: 35 passed; `--project=chromium-mobile tests/e2e/shell/touch-tooltips.spec.ts`: 8 passed
- `pnpm run check`: 0 errors, 0 warnings; `pnpm run lint`: clean
- `pnpm exec playwright test --list`: 254 tests (253 plus the one added here)
- `package.json` and `pnpm-lock.yaml` untouched; no new dependency, no network surface (T-08-55, T-08-56, T-08-SC)

## Known Stubs

None.

## Threat Flags

None. The only new surface is a local ResizeObserver read.

## Self-Check: PASSED

- src/lib/features/playtime/playtime-model.ts, PlaytimeCharts.svelte, CalendarHeatmap.svelte, HourGrid.svelte, tests/e2e/shell/chart-fill.spec.ts: found
- commits e1fdd59, 664d149, cfb26de: found in `git log`
