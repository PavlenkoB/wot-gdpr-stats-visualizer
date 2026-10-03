---
phase: 05-vehicle-stats-financial-dashboards
plan: 13
subsystem: ui
tags: [svelte, diverging-bars, small-multiples, tooltip, scroll, keyboard, scale, source-contract]
requires:
  - 05-04
  - 05-08
  - 05-09
  - 05-10
  - 05-11
provides:
  - "currencyChartInput(entry): a CurrencyEntry as one diverging chart's BarChartInput, plus the EXACT bigint domain maximum the axis is labelled with"
  - "CurrencyBlock.svelte: the Virtual currency sub-block — six states, the excluded pill, one chart section per charted currency, the Other currencies list and a closed monthly table per chart"
  - "FlowLegend.svelte: the two-direction legend, two aria-hidden swatches reading var(--flow-in)/var(--flow-out) with both phrases as real text"
  - "FinancialData.svelte renders the Premium block then the Currency block on the ONE shared finance-tooltip"
  - "tests/unit/currency-blocks.test.ts, and nine browser cases in tests/e2e/finance.spec.ts"
actuals:
  tokens: 505
  tasks: 3
  commits: 6
commits: 9
plan_head_before: 45465aa1f1f2cf5bae2619d3364ee1a8703269af
plan_head_after: f78c04a353073f6d6b44d2db1e435dd74d41fa1c
tech-stack:
  added: []
  patterns:
    - "The exact axis maximum crosses the boundary as a bigint beside the chart input, because the model's domainMax is a float and a compact label of it is a number the chart does not have"
    - "One MonthlyBarChart per charted currency, keyed by chart INDEX for the state and carrying the code only in data-currency — nothing concatenates untrusted zip text into a selector"
    - "The other-currency row is the code in one element and the figures in another, so a screen reader reads the code, pauses, and reads the sentence"
    - "A hand-written CSV splitter in the browser spec, so the independent finance oracle is never fed by the app's own PapaParse parser"
key-files:
  created:
    - src/lib/components/CurrencyBlock.svelte
    - src/lib/components/FlowLegend.svelte
    - tests/unit/currency-blocks.test.ts
  modified:
    - src/lib/finance-state.ts
    - src/lib/components/FinancialData.svelte
    - tests/unit/finance-state.test.ts
    - tests/e2e/finance.spec.ts
key-decisions:
  - "currencyChartInput returns `{ input, domainMaxUnits }` rather than a bare BarChartInput. The bar model's own domainMax is right for geometry and wrong for the axis LABEL: a domain of 1,030,000 units prints as `1M`, so the `<title>` beside it would name 1,000,000 as the exact maximum of a chart whose largest month is 1,030,000 (D-25)."
  - "A value the worker stored that does not parse as a plain integer becomes a ZERO bar, not a throw and not a NaN height. The worker already excluded the row it could not read; a NaN would be the worst of the three outcomes, a silently missing bar with no count to show for it."
  - "The title caption is omitted when it is blank OR equal to the code, and the title gets its own class (`p.caption.title`). A chart block holds a title caption, a summary and a keyboard hint, so `p.caption` alone matched two of the three and the test named the wrong one."
  - "The title and the code in an other-currency row are SEPARATE elements, not one sentence. A code that reads `(not recorded)` is then announced as the label it is rather than as the start of a number."
  - "The monthly table's rows come from the model's `cells` reversed, not from the worker's sparse months — so a gap is a row of zeros in the table exactly as it is an empty column in the chart, and the two cannot disagree about how many months there were."
  - "The excluded pill renders in `ready` AND `no-usable`, and nowhere else. The two empty states are claims about a file that was absent or held no rows, and a pill there would report exclusions that cannot have happened."
  - "Each chart's monthly table is its own `bind:open` on a sparse array rather than one shared flag: a reader comparing two months of gold has no reason to have opened the credits table."
patterns-established:
  - "Source-contract tests over comment-stripped Svelte source, with the eight flow/ramp hexes written INTO the test rather than read off app.css — a test that read them from the stylesheet would pass forever against a component that had started using the same hex directly."
  - "A spec that sums a chart's data-in/data-out attributes and compares them to the summary sentence is the only instrument that can catch a bar drawn from a different number than the sentence quotes."
  - "The oracle is fed by a splitter written in the spec file, never by `parseCsvFile`: parsing the fixture with the parser under test makes the independent check agree by construction."
requirements-completed:
  - FINANCE-02
coverage:
  - id: D1
    description: "The Virtual currency sub-block asks the currency channel keyed on importedAt, derives its six states from finance-state, and stays in the DOM in every state so the Financial_data card keeps both h3 headings"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#05-13 virtual currency: a file that is empty and one nothing survives › (states)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(currency-tracer) the card keeps both h3 headings"
        status: pass
    human_judgment: false
  - id: D2
    description: "Small multiples: one diverging monthly chart per charted currency, each with its own symmetric domain and its own caption, ordered by operation count descending, capped at 8 and thresholded at 50"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(cap) ten currencies chart eight and list two"
        status: pass
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(none-charted) every code is listed and no chart is drawn"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every currency code in the export is visible: charted, or listed under Other currencies with its totals, span and operation count — a stray UAH, a __proto__ and a blank code included, and none dropped"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(other) the pill and the four text rows in order, UAH among them"
        status: pass
    human_judgment: false
  - id: D4
    description: "A chart's cells expose data-month, data-in, data-out and data-ops, and the sums across them equal the figures in that chart's summary sentence"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(currency-tracer) the sample charts credits then gold with summed cells equal to the summaries"
        status: pass
    human_judgment: false
  - id: D5
    description: "Excluded operations are counted in the amber pill directly under the block caption with the amended explanation, and rendered in no chart and no total"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(stray-years) the 1969 and 9999 rows are counted and chart nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "A 20-year history draws 240 cells at pitch 4 inside its own scroller with a bounded DOM, and the last month is reachable by keyboard with the tooltip still on screen at both ends"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(240-months) 240 cells at pitch 4, a bounded DOM and its own scroller"
        status: pass
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(keys) one tab stop, and End reaches the last month inside the scroller"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every chart has a closed Monthly data table with the exact grouped figures, newest first, over every drawn month"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(tables) each chart has a closed monthly table that opens newest first"
        status: pass
    human_judgment: false
  - id: D8
    description: "The block and the legend hold no flow or ramp colour literal, no raw-HTML tag, no inline style and no live-region attribute, and every sentence comes from ui-copy"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/currency-blocks.test.ts#05-13 CurrencyBlock & FlowLegend component contracts"
        status: pass
    human_judgment: false
  - id: D9
    description: "How the currency block LOOKS beside the premium chart: diverging bars, the legend, the pill's amber chrome and the monthly table at phone width"
    requirement: FINANCE-02
    verification: []
    human_judgment: true
    rationale: "Every geometric, textual and structural claim in this plan is asserted in a browser or over source. What a reader actually sees — whether the two hues read as two directions at 1.36:1, whether the card reads as two figures rather than a wall, whether the list of small currencies is legible at 375px — is a design judgment no assertion here makes. Phase 7 is the phone-width polish pass that revisits it."
duration: 62min
completed: 2026-10-02
status: complete
---

# Phase 05 Plan 13: Virtual currency flow summary

**Diverging monthly bars per virtual currency, each on its own scale, with every uncharted code still listed as a text row and a 20-year history proven to scroll**

## Performance

- **Duration:** 62 min
- **Started:** 2026-10-02T01:21:55Z
- **Completed:** 2026-10-02T02:24:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- **One chart per charted currency, each with its own axis.** Credits and gold draw as diverging bars — deposits above the zero line in `--flow-in`, withdrawals below in `--flow-out` — and the browser proves the claim that matters: the sum of `data-in` and `data-out` across a chart's cells equals the figures in the summary sentence above it (30,435,000 / 12,000,000 across 60 operations, and 6,500 / 2,600 across 52).
- **No code is dropped.** The sample's four uncharted currencies — `ru.wot.crystal`, a stray `UAH`, a `__proto__` and a blank code the export left out — are listed under Other currencies in the worker's order, with exact totals, and a ten-currency export charts exactly eight and lists exactly two. A five-currency export where nothing clears the threshold draws no chart at all and still shows every code.
- **The y-axis states the real maximum.** The domain crosses into the component as a `bigint` beside the chart input, so a 1,030,000-unit domain is labelled `1M` with `1,029,000` in its `<title>` rather than 1,000,000.
- **Proven at 240 months.** 2,000 rows over 2001-01..2020-12 draw 240 cells at pitch 4 in a 1,020px SVG inside their own scroller, at most 760 nodes, without widening the page; `End` reaches the last month with its rect inside the scroller, and the tooltip stays 8px clear of the viewport at both ends and flips below a cell near the top.

## Task Commits

Each task was committed atomically, with its RED recorded as a separate commit before its GREEN:

1. **Task 1: Tracer, the sample's two charted currencies draw diverging charts** — `5d2eb28` (test, RED) then `7dc1772` (feat)
2. **Task 2: Other currencies, the excluded pill, the no-chart case, the cap, blank codes and the monthly tables** — `3840b4c` (test, RED) then `80ad682` (feat)
3. **Task 3: The 20-year chart, node bound, keyboard and tooltip clipping** — `3a50ecf` (test), then `bd40b28` (fix, the keyboard spec's ordering dependency)

**Plan metadata:** committed with this summary.

_Note: TDD tasks have a RED commit and a GREEN commit, in that order, so `git log -E --grep="^test\((0*5)-(0*13)\):"` finds the intent._

## Files Created/Modified

- `src/lib/components/CurrencyBlock.svelte` (new, 518 lines) — the Virtual currency sub-block: the query effect keyed on `importedAt`, `acceptDataOutcome` + `deriveFinanceState` for the six states, the block caption, the excluded pill, one `<section data-testid="currency-chart">` per charted currency with its h4, title caption, summary, keyboard hint, `MonthlyBarChart` and `FlowLegend`, a closed `monthly-table-disclosure` per chart, and the Other currencies list.
- `src/lib/components/FlowLegend.svelte` (new, 100 lines) — the two-direction legend, copying `ChartLegend`'s chrome with two `aria-hidden` swatches reading the two flow variables and both phrases as real text in a wrapping row.
- `src/lib/finance-state.ts` (modified) — added `currencyChartInput` and its `CurrencyChartInput` return type; the two new imports are `bar-chart-model`'s type and `decimal`'s two functions.
- `src/lib/components/FinancialData.svelte` (modified, +9) — renders `CurrencyBlock` after `PremiumBlock` on the same `onTip`, so the card still holds exactly one tooltip.
- `tests/unit/currency-blocks.test.ts` (new, 178 lines) — five source-contract tests over comment-stripped source.
- `tests/unit/finance-state.test.ts` (modified, +232) — eight `currencyChartInput` cases over the 05-01 hand rows, cross-checked against the independent oracle.
- `tests/e2e/finance.spec.ts` (modified, +901) — nine browser cases.

## Decisions Made

See the frontmatter `key-decisions`. The one with the widest reach for later plans: **`currencyChartInput` returns a pair, not a bare input.** Every future chart that has to LABEL an axis from an exact figure needs the same thing, and 05-16 or a later finance plan should reach for `domainMaxUnits` rather than reading `model.domainMax` and formatting the float.

Two answers to the questions the plan left open:

- **The container/SVG test-id split** (a planner assumption the plan flagged): UI-SPEC section 5 gives `currency-chart` to the chart BLOCK, so the SVG takes `currency-svg` through `MonthlyBarChart`'s existing `chartTestId` prop and the premium and currency charts keep one component. Confirmed against the UI-SPEC's own section 15 list, which names `currency-chart`, `currency-cell` and `monthly-table` but no `currency-svg` — the prop is the right seam.
- **The exact value in the y-axis `<title>`** is `formatFlowAmount(domainMaxUnits)`, the same formatter the summary and the table use, rather than a new one. A currency amount has one renderer, so the axis cannot disagree with the sentence about it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The keyboard spec only passed when another test had already scrolled the page**
- **Found during:** Task 3
- **Issue:** `tests/e2e/finance.spec.ts#(keys)` passed when run after `(240-months)` and failed when run alone. `node.focus()` scrolls the PAGE when the chart is off screen, and the scroll event lands asynchronously AFTER the shared tooltip has already opened against the cell's old rect — so `ChartTooltip`'s `isStale` correctly dismissed it, and the first ArrowRight appeared to do nothing. The test-order dependency was masking it, which is the worse of the two problems: it would have read as a real product bug in a full-suite run and as a flake in a filtered one.
- **Fix:** `await svg.scrollIntoViewIfNeeded()` before the first key press, with a comment naming the stale-anchor rule that made it necessary. No product change — a reader who has scrolled the chart into view does not hit this, and the premium chart's five-cell keyboard spec is unaffected because it never scrolls.
- **Files modified:** `tests/e2e/finance.spec.ts`
- **Verification:** `pnpm exec playwright test tests/e2e/finance.spec.ts -g "keys"` passes alone, and all 159 e2e tests pass in a full run.
- **Committed in:** `bd40b28`

**2. [Rule 1 - Bug] The premium `(table)` spec broke on a strict-mode violation**
- **Found during:** Task 2
- **Issue:** `05-10`'s premium monthly-table spec read `page.getByTestId('monthly-table-disclosure')` unscoped. Once the currency charts shipped the same hook, three elements matched and the spec failed. The hook itself is unchanged and correct — the assertion had been page-wide where it should have been block-scoped.
- **Fix:** the spec now reads through `premiumBlock(page)`. The test id stays as UI-SPEC section 15 fixes it; the other currency-related specs scope the same way.
- **Files modified:** `tests/e2e/finance.spec.ts`
- **Verification:** all 14 pre-existing finance tests and the 9 new ones pass.
- **Committed in:** `80ad682`

**3. [Rule 1 - Bug] `bar-scroller` was also read page-wide in Task 3's own spec**
- **Found during:** Task 3
- **Issue:** the same shape as the previous one, caught by the new spec's own strict-mode violation: two scrollers exist once the card holds two charts. Fixed before the first green run rather than after.
- **Files modified:** `tests/e2e/finance.spec.ts`
- **Committed in:** `3a50ecf`

### Not a deviation, but worth recording

- **Task 3 needed no change to `MonthlyBarChart.svelte` or `CurrencyBlock.svelte`.** The plan authorised touching them to fix what the 240-month and clipping tests expose, and exposed nothing: the pitch ladder, the scroller, the roving tab stop and `ChartTooltip`'s clamping all did the right thing at 240 months on the first run. `git diff --stat -- src` for that task is empty.
- **`p.caption.title` is a new class**, added in Task 1 rather than Task 2, because Task 1's tracer needed to name the title caption and `p.caption` matched the keyboard hint too. Adding it later would have meant re-touching Task 1's test.

**Total deviations:** 3 auto-fixed (all Rule 1, all in test files; zero in product code)
**Impact on plan:** No scope creep and no product change. All three are the same root cause — a test id the UI-SPEC declares once but that a page now holds more than one of — and the fix is always to narrow the SCOPE of the query, never to change the hook.

## Issues Encountered

- **The oracle and the app's parser.** `tests/helpers/finance-oracle.ts` imports nothing from `src/` — that is its hard rule — but a browser spec still needs to turn generated CSV into rows. Feeding it `parseCsvFile` would have made the independent check agree with the app by construction, since both sides would share a parser. Task 3 writes a small `splitFixtureCsv` in the spec instead: bare CR terminator, `;` separator, quote-all cells. It is format-specific on purpose, and the comment says why.
- **Two hand-written month indices in the new specs were wrong** (I wrote 2019-05 as 24,231, which is 2019-04). Both were caught by the assertions before commit rather than by reading: the fixture's `firstMonth` is the authority, and the formatter output disagreed with my literal. Corrected to 24,232. Worth remembering that `monthIndex(2019, 5)` is 24,232, not 24,231 — the arithmetic is `year * 12 + month - 1`, and month is 1-based while the result reads 0-based.
- **The plan's estimate is not on the same scale as its `actuals` guidance.** The plan forecasts 60,000 tokens; the recorded actual is 505, measured as `chars / 4` over the 2,018 lines this plan actually changed, which is the scale `actuals` specifies. These two numbers measure different things and the pair should not be read as a 99% miss. The useful, comparable number is the task and commit count: three tasks, six commits, both as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **FINANCE-02 is complete.** The `Financial_data` card now holds two figures: the Premium time timeline (05-11) and the Virtual currency flow, with one shared tooltip across both.
- **05-15 (spend) has the pattern to copy, not a second one to invent.** `CurrencyBlock` is `PremiumBlock` with three differences: a list instead of a single chart, a per-chart `bind:open` array, and a `formatOtherCurrencyRow` line under a code. The state machine, the query effect, the `acceptDataOutcome` call and the pill are byte-for-byte the premium block's.
- **`monthly-table-disclosure` is now a per-chart hook, not a per-block one.** Any later spec that reads it page-wide will hit the same strict-mode violation 05-10's did; scope it to the block or the chart section.
- **The CI e2e budget did not need raising.** `tests/unit/ci-budget.test.ts` derives its projection from `playwright test --list` and the suite is now 159 tests in 14 files, up from 149; `globalTimeout` still clears the 1.3× floor, so the 18/20/26 minute limits 05-12 set stand. 05-16 still reconciles the budget properly.
- **A design question this plan deliberately leaves open.** `--flow-in` and `--flow-out` sit 1.36:1 apart in luminance, below the 3:1 a non-text graphic needs. Four things carry the distinction here (bars above/below the zero line, the legend's real words, each cell's accessible name, and the monthly table), so the block is usable without colour vision — but whether two hues that close read as a deliberate pair is a judgment for the UI review, not for an assertion. That is the one item in this plan marked `human_judgment: true`.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Completed: 2026-10-02*
