---
phase: 05-vehicle-stats-financial-dashboards
plan: 11
subsystem: ui
tags: [svelte, svg, monthly-bar-chart, premium, tooltip, table]
requires:
  - 05-09
  - 05-10
provides:
  - MonthlyBarChart component for monthly premium timeline and future currency charts
  - MonthlyDataTable collapsible component for tabular month details
  - ChartTooltip extension supporting testId and extra caption lines
  - FinancialData card body hosting shared finance-tooltip instance
  - PremiumBlock integration displaying interactive timeline and collapsible monthly table
affects:
  - src/lib/components/MonthlyBarChart.svelte
  - src/lib/components/MonthlyDataTable.svelte
  - src/lib/components/ChartTooltip.svelte
  - src/lib/playtime-model.ts
  - src/lib/components/FinancialData.svelte
  - src/lib/components/PremiumBlock.svelte
tech-stack:
  added: []
  patterns:
    - Roving focus keyboard navigation with instant scrollClear positioning
    - Single shared tooltip hosted by section card body
    - Hand-rolled SVG bar chart without viewBox for fixed 14px typography
key-files:
  created:
    - src/lib/components/MonthlyBarChart.svelte
    - src/lib/components/MonthlyDataTable.svelte
    - tests/unit/bar-chart-components.test.ts
  modified:
    - src/lib/components/ChartTooltip.svelte
    - src/lib/playtime-model.ts
    - src/lib/components/FinancialData.svelte
    - src/lib/components/PremiumBlock.svelte
    - tests/unit/playtime-charts.test.ts
    - tests/e2e/finance.spec.ts
key-decisions:
  - "ChartTooltip is extended with optional testId (default chart-tooltip) and extra caption lines; FinancialData hosts the single finance-tooltip instance"
  - "MonthlyBarChart uses fixed SVG width and height without viewBox so 14px axis labels stay unscaled; roving tabindex and key handlers delegate to svg"
  - "MonthlyDataTable renders row nodes only while open inside a 320px maximum height scroller"
requirements-completed:
  - FINANCE-01
duration: 15 min
completed: 2026-10-02
coverage:
  - deliverable: "MonthlyBarChart SVG component"
    verification:
      kind: "vitest"
      ref: "tests/unit/bar-chart-components.test.ts"
      status: "pass"
    human_judgment: false
  - deliverable: "Premium timeline chart interaction and shared tooltip"
    verification:
      kind: "playwright"
      ref: "tests/e2e/finance.spec.ts"
      status: "pass"
    human_judgment: false
  - deliverable: "Collapsible monthly data table"
    verification:
      kind: "playwright"
      ref: "tests/e2e/finance.spec.ts"
      status: "pass"
    human_judgment: false
---

# Phase 05 Plan 11: Premium Timeline Bar Chart & Monthly Data Table Summary

Implemented the interactive monthly bar chart timeline and collapsible data table for premium time operations (`FINANCE-01`).

## Key Accomplishments

1. **Hand-Rolled SVG `MonthlyBarChart.svelte`**:
   - Fixed `width` and `height` without `viewBox` so axis text stays exactly 14px.
   - Grid accessibility (`role="grid"` and `role="gridcell"`).
   - Delegated pointer and keyboard interaction (`ArrowLeft`, `ArrowRight`, `Home`, `End`, `Escape`).
   - Roving `tabindex` (1 tab stop per chart) with `scrollClear` scroll correction.
   - Distinct two-tone focus ring and hover ring overlays.

2. **Shared Tooltip & `MonthlyDataTable.svelte`**:
   - `ChartTooltip` extended with `testId` prop and optional `extra` caption lines.
   - `FinancialData.svelte` hosts a single `finance-tooltip` shared by financial blocks.
   - `MonthlyDataTable.svelte` renders native table rows newest first inside a 320px scroller, rendering zero row nodes while collapsed.

3. **Verification & Tests**:
   - Source-contract tests (`tests/unit/bar-chart-components.test.ts`) enforcing zero `viewBox`, no raw HTML (`{@html}`), no inline style attributes or directives, no unapproved imports.
   - Comprehensive Playwright specs in `tests/e2e/finance.spec.ts` covering chart heights (15, 96, 8, 43), single-month chart, hover/focus rings, tooltip contents (including grant sizes), viewport edge clipping, and collapsible table behavior.

## Self-Check: PASSED
