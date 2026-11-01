---
phase: 15-tech-debt-cleanup
plan: 07
subsystem: styles
tags: [css, type-roles, charts, test-helpers, harness]

requires:
  - phase: 15-tech-debt-cleanup
    provides: note roles (15-01), shell chrome on the roles (15-06), style-equality harness
provides:
  - "The six shared chart pieces (AboutDisclosure, ChartLegend, FlowLegend, ChartTooltip, MonthlyBarChart, MonthlyDataTable) carry no local 14px/1.4 pair"
  - "roleClassesIn and effectiveFontSizes in tests/helpers/css.ts, with tests; plan 15-12 reuses them"
  - "A tooltip state in the style-equality harness (version 2)"
affects: [15-08, 15-12, 15-13]

actuals:
  tokens: 14000
  tasks: 3
  commits: 3
plan_head_before: c0ed1b4b1630cfabd9b77d6a276d27a347a867b0
plan_head_after: 2f530993c5d440402420781ef02aff2288420655

tech-stack:
  added: []
  patterns:
    - "effectiveFontSizes(source, tokens, typeCss): declared sizes of the style block plus the size of every role class the markup uses, so a 'declares a font-size' sweep stays non-vacuous"
    - "A rule that keeps only paint after the move (fill, colour) stays; the type comes from the role class"

key-files:
  created: []
  modified:
    - "tests/helpers/css.ts"
    - "tests/unit/guards/css-helper.test.ts"
    - "src/lib/charts/AboutDisclosure.svelte"
    - "tests/unit/charts/about-disclosure.test.ts"
    - "src/lib/charts/ChartLegend.svelte"
    - "src/lib/charts/FlowLegend.svelte"
    - "src/lib/charts/ChartTooltip.svelte"
    - "src/lib/charts/MonthlyBarChart.svelte"
    - "src/lib/charts/MonthlyDataTable.svelte"
    - "tests/unit/finance/currency-blocks.test.ts"
    - "tests/unit/playtime/playtime-charts.test.ts"
    - "tests/unit/charts/bar-chart-components.test.ts"
    - ".planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs"

key-decisions:
  - "ChartTooltip root takes .t-note: the baseline records font-weight 400 for all 60 recorded tooltip rows in every pane and width (finance, playtime)"
  - "MonthlyDataTable table takes .t-note-strong: the baseline records 600 for all 36 recorded table rows (the table inherited 600 in context); th and td keep their own weights"
  - "The tooltip state opens the details that wrap a chart surface before focusing its first mark (the finance charts sit in closed disclosures)"

requirements-completed: []

duration: 45min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 07: shared chart pieces on the note roles Summary

**The six shared chart pieces no longer hand-write the 14px / 1.4 pair (8 rules gone); `effectiveFontSizes` keeps the font-size sweeps non-vacuous; the harness now compares the chart tooltip, and reports 0 differing elements and 0 differing screenshots at all six widths in the rest, tooltip and open states.**

## Accomplishments

- `note-sites`: 0 for `src/lib/charts`; `--count src`: 85 -> 77 (28 files).
- `tests/helpers/css.ts`: `roleClassesIn(source)` (whole `t-` tokens in static class attributes, interpolations of them, `class={...}` expressions and `class:` directives; comments and the style block ignored; `row-t-note` is not a use) and `effectiveFontSizes(source, tokens, typeCss)`. 15 new tests in `css-helper.test.ts`, including the real role file.
- `AboutDisclosure`: `<summary class="t-note-strong">`; `min-height: 44px` kept. The 14px-floor sweep in `about-disclosure.test.ts` now uses `effectiveFontSizes`, keeps its `length > 0` check, and a new test pins the role and the absence of local type.
- `ChartLegend` and `FlowLegend`: `.row` -> `.t-note`, colour kept. `ChartTooltip`: root and `.line-two` -> `.t-note`, `.line-one` -> `.t-note-strong`; margins, colours and positioning kept.
- `MonthlyBarChart`: the four `<text class="axis ...">` take `.t-note`; `.axis` keeps `fill`. `MonthlyDataTable`: the table takes `.t-note-strong`, its rule keeps width and border-collapse.
- Harness (version 2): per chart surface in a pane, the first mark is focused so the shared tooltip renders; the tooltip subtree (computed style and rect) and a viewport screenshot hash are recorded, then focus is cleared. The cached baseline was rebuilt from `2cb5359`, captured twice, identical.

## Task Commits

1. **Task 1: effective-size helper, AboutDisclosure summary** - `415f36b` (refactor)
2. **Task 2: legends, tooltip, harness tooltip state** - `50161f5` (refactor)
3. **Task 3: monthly bar chart axis, monthly data table** - `2f53099` (refactor)

## Verification

- `note-sites src/lib/charts`: 0 offenders; `--count src`: total 77.
- `vitest run tests/unit/guards`: 22 files / 444 passed. `tests/unit/charts tests/unit/finance tests/unit/playtime`: 26 files / 837 passed.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean. `pnpm run build`: OK.
- `style-equality.mjs selftest`: PASSED. `check`: 120394 elements and 176 screenshots compared, 0 differing, EQUAL (archives 5, panes 13, widths 375/480/481/899/900/1280). Tooltip state: 60 of 60 chart surfaces recorded, 0 skipped.
- Full `pnpm run test:unit`: 4918 passed, 1 failed (see Deferred Issues).
- `package.json` and `pnpm-lock.yaml` unchanged.

## Deviations from Plan

**1. [Rule 1 - Bug] The tooltip is always mounted, not "in the DOM only while shown"**
- **Found during:** Task 2
- **Issue:** The plan's inventory said the tooltip exists only while shown; `ChartTooltip` is always in the DOM with `hidden` while `request === null`, so the rest state does record its (display: none) computed style.
- **Fix:** none needed for the migration; the weight read in both rest and tooltip states agrees (400).
- **Commit:** 50161f5

**2. [Rule 3 - Blocking] Tooltip state needed the finance tooltip id and open disclosures**
- **Found during:** Task 2
- **Issue:** The finance charts use `data-testid="finance-tooltip"` and sit in closed disclosures; a first harness version recorded 24 of 60 surfaces.
- **Fix:** the harness records `chart-tooltip`, `map-tooltip` and `finance-tooltip`, and opens the details that wrap a surface before focusing its mark. The baseline was recaptured (twice, identical).
- **Commit:** 50161f5

**3. Reader additions went to the files that already read these components**
- The plan listed `tooltip-pin.test.ts`; nothing there reads the tooltip's type, so the tooltip role assertions were added to `playtime-charts.test.ts` (which already reads the tooltip and legend rules). `currency-blocks.test.ts` gained the FlowLegend assertions, `bar-chart-components.test.ts` the axis and table ones. No existing assertion needed to change besides the disclosure sweep and the `<summary>` opening-tag regex in `about-disclosure.test.ts`.

## Deferred Issues

- `tests/unit/overview/overview-grid.test.ts` ("sparse flow ... every pin subset") timed out in the full `pnpm run test:unit` run; the same known load-sensitive test as in 15-05 and 15-06. `tests/unit/guards/no-real-data.test.ts` also failed once while run concurrently with other guard files and passes alone (known flaky under load).
- The login-history world map does not render in any synthetic archive (no geo data), so its tooltip is not compared by the harness. Its component (`WorldMap.svelte`) is not touched by this plan; its group's plan should check it by other means.

## Known Stubs

None.

## Threat Flags

None. T-15-13 mitigated (tooltip state added, baseline recaptured, harness EQUAL); no package installed (T-15-SC).

## Self-Check: PASSED

- FOUND commits: `415f36b`, `50161f5`, `2f53099`
- FOUND: `effectiveFontSizes` in `tests/helpers/css.ts`
