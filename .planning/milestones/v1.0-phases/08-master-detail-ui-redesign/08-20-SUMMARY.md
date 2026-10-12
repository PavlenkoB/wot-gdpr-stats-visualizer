---
phase: 08-master-detail-ui-redesign
plan: 20
subsystem: ui
tags: [svelte5, svg-charts, resize-observer, layout, playwright, vitest]
status: complete
gap_closure: true
gap_ids: [G-08-3]

requires:
  - phase: 05-finance
    provides: buildBarChartModel, MonthlyBarChart, the Premium and Currency blocks
provides:
  - usableChartWidth: the one rule that turns a measured width into a usable width or null (no upper clamp)
  - buildBarChartModel(input, availableWidth?) with a fill layout, plus plotRight and input on BarChartModel
  - MonthlyBarChart that measures its own scroller (bind:contentRect) and re-lays out from model.input
  - chart-fill.spec.ts, the Finance pane overflow guard and resize proof
affects: [08-21 playtime charts (reuses CHART_RING_PAD_PX), 08-22 gate and manual check]

actuals:
  tokens: 12000
  tasks: 3
  commits: 3
plan_head_before: 41ee37f95f3370f5ed02b349108d8edcfff8ed17
plan_head_after: dcc82227fd17627e7aba406810f571333488465d

tech-stack:
  added: []
  patterns:
    - "Measure a block whose width its parent sets (never the svg) with bind:contentRect, floor it, re-lay out a pure model"
    - "Today's geometry is the floor of every width-aware layout, so the no-width call is unchanged"

key-files:
  created:
    - src/lib/charts/chart-width.ts
    - tests/unit/charts/chart-width.test.ts
    - tests/e2e/shell/chart-fill.spec.ts
  modified:
    - src/lib/charts/bar-chart-model.ts
    - src/lib/charts/MonthlyBarChart.svelte
    - src/lib/shell/ExcludedNotice.svelte
    - src/lib/features/finance/PremiumBlock.svelte
    - src/lib/features/finance/CurrencyBlock.svelte
    - tests/unit/charts/bar-chart-model.test.ts
    - tests/unit/charts/bar-chart-components.test.ts
    - tests/e2e/finance/finance.spec.ts

key-decisions:
  - "Fill layout only when the measured plot is STRICTLY greater than today's plot; otherwise the legacy numbers, which keeps phones and 240-month charts unchanged and the boundary continuous (36 months: 640px is the legacy 636px chart, 641px fills)"
  - "Slots divided in whole pixels with the remainder spread (floor(i x plot / months)); the drawn bar is capped at 32px and centred; 8px right pad on the fill path so the last month's ring ends inside the svg"
  - "Label stride stays keyed to today's pitchFor, so the same months are labelled at every width"
  - "No upper width bound: 4000px produces a 4000px svg"

metrics:
  duration: ~45m
  completed: 2026-10-08
---

# Phase 8 Plan 20: Finance charts fill the detail pane Summary

The Premium time and every Virtual currency chart now measure their own scroller with `bind:contentRect` and re-lay out so the svg is exactly as wide as the pane content (878px at 1280, instead of 140px and 540/476px), with bars capped at 32px and centred in whole-pixel slots; dense charts and phones keep today's geometry and scroller.

## What was built

- **chart-width.ts**: `CHART_RING_PAD_PX = 4` and `usableChartWidth(measured)`, which returns null for 0, NaN, negatives, both Infinities, undefined, null and strings, and otherwise the floored width with no upper clamp (T-08-53).
- **bar-chart-model.ts**: `buildBarChartModel(input, availableWidth?)`. With no usable width, or a fill plot that does not beat today's plot, it returns exactly the legacy numbers. Otherwise: svg width equals the usable width, plot = width - 56 - 8, slot edges `floor(i x plot / months)`, 32px max bar centred in its slot, `plotRight` and `input` on the model, label stride unchanged, `scrolls` true exactly when the svg is wider than the width given. `BAR_LAYOUT` gained `fillRightPadPx: 8` and `maxBarWidthPx: 32`.
- **MonthlyBarChart.svelte**: the scroller carries `bind:contentRect`; geometry renders from `laid = buildBarChartModel(model.input, measured)`; the roving-focus reset stays keyed to `initialBarFocus(model)` (the data), so a resize cannot reset it; tick offsets and rings follow each cell's own width.
- **Tests**: `chart-width.test.ts`; a 14-case "measured fill layout (G-08-3)" block in `bar-chart-model.test.ts` (343, 720, 879, 1326, 4000px with exact slot, bar, label and ring numbers); a source-contract check in `bar-chart-components.test.ts`; `chart-fill.spec.ts` (one listed test).
- **Overflow guard** in `chart-fill.spec.ts`: measures every element and every text node of the Finance pane that is not inside an `overflow-x: auto|scroll` scroller against the pane's content edge, plus the page's sideways scroll, at 1280, 800 and 375px, on the sample export and on an export whose premium file carries a 300-character unbroken token (listed with the disclosure open, in a fresh browser context). Charts are also asserted to follow the scroller at 1280, 800 and 2400px.
- **CSS**: `.explanation` and `.pill` (pill also `max-width: 100%`) in ExcludedNotice, `.caption` and `summary` in PremiumBlock and CurrencyBlock now declare `min-width: 0` and `overflow-wrap: anywhere`. No colour, font size, gap or media query changed.

## Guard findings (verify-first)

- Against the **unmodified** CSS the guard found no element or text past the pane edge on the sample export and on the 300-character token export at 1280, 800 and 375px, matching the planner's probe. (The app clamps a listed unrecognised value to 200 characters, so the token that reaches the screen is 200.)
- Sensitivity check: with `.unrecognised` temporarily set to `overflow-wrap: normal` the guard failed with `li. text right 2203.8 > edge 1240.0`; the file was restored. The element-rectangle check alone is blind to this (an unbroken word overflows its box without growing it), which is why the guard also measures text ranges.
- After the explicit wrap declarations the guard is still clean at all three widths. The wrap declarations are therefore belt-and-braces, as the plan intended.

## Spec reconciliation (Task 2)

Only assertions that literally pinned the old fixed geometry changed; none was deleted or weakened, no listed test was added.

| Spec | Was | Now (measured reason) |
| ---- | --- | --------------------- |
| finance.spec `(chart)` | svg width `140` | svg width within 1px of its scroller (878px at 1280, observed) |
| finance.spec `(axis-one-sided)` | width `76` | `expectFillsScroller` (new local helper) |
| finance.spec `(single)` | width `76` | `expectFillsScroller` |
| finance.spec `(pitch-73)` | width `571`, cell x 63, bar 6 | at 1280: fills the scroller, cell 1 at `56 + floor(plot/73)`, same three labels (stride keyed to today's pitch), nothing to scroll. The original 571 / 7px / 6px-bar geometry is kept as an assertion at a 375px viewport (pane 343px < 571px), where it is unchanged and scrolls |

The x-axis label lists in finance.spec and the sparse-tick counts in finance-scale.spec needed no change (all green), and the 240-month spec (1020px legacy) still passes untouched.

## Deviations from Plan

**1. [Rule 1 - Bug in plan] Node budget cannot hold at 1,572 months.**
- **Found during:** Task 2
- **Issue:** the plan asks for `nodeCount <= nodeBudget` at 1, 56, 144, 240 and 1572 months. At 1,572 months the pre-existing label stride already gives 4,853 nodes against a budget of 4,756 with no width at all (66 labels x 2 nodes exceeds the fixed 40 frame allowance). The formulas are unchanged by this plan, so this is pre-existing and not caused by it.
- **Fix:** the budget assertion covers 1, 56, 144 and 240 months at 879 and 4000px, and a separate test asserts the count never grows with width for 1, 56, 144, 240 and 1572 months (within one label pair of the no-width count), which is the T-08-52 property (work depends on months, never pixels). The 1,572-month overshoot is logged below as deferred.
- **Files modified:** tests/unit/charts/bar-chart-model.test.ts
- **Commit:** 7150e8c

**2. [Rule 1 - Bug in the new guard] The first guard version could not see wrapping defects.**
- **Found during:** Task 3 sensitivity check
- **Issue:** measuring only element rectangles passes even with wrapping removed; the second page in the same browser context also opened the cached sample instead of the long-token file.
- **Fix:** the guard also measures text-node ranges, the long-token export is imported in a fresh browser context, and only `overflow-x: auto|scroll` counts as a scroller (a `hidden` ancestor would hide a clipped defect).
- **Files modified:** tests/e2e/shell/chart-fill.spec.ts
- **Commit:** dcc8222

## Deferred Issues

- At 1,572 months `nodeCount` (4,853) exceeds `nodeBudget` (4,756) on the legacy path because the label allowance is a fixed 40. Pre-existing, unreachable at the current 1,572-month window edge only by synthetic data; out of scope here.

## Verification

- `pnpm exec vitest run tests/unit/charts tests/unit/guards tests/unit/finance`: 574 passed
- `pnpm exec playwright test --project=chromium tests/e2e/shell/chart-fill.spec.ts tests/e2e/finance`: 48 passed; mobile-sweep and uat-criteria: 10 passed; touch-tooltips (chromium-mobile): 8 passed
- `pnpm run check`: 0 errors, 0 warnings; `pnpm run lint`: clean
- `pnpm exec playwright test --list`: 253 tests (252 plus the one added here)
- `package.json` and `pnpm-lock.yaml` untouched; no new dependency, no network surface (T-08-54, T-08-SC)

## Known Stubs

None.

## Threat Flags

None. The only new surface is a local ResizeObserver read.

## Self-Check: PASSED

- src/lib/charts/chart-width.ts, tests/unit/charts/chart-width.test.ts, tests/e2e/shell/chart-fill.spec.ts: found
- commits e6e57b3, 7150e8c, dcc8222: found in `git log`
