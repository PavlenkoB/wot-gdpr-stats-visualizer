---
phase: 05-vehicle-stats-financial-dashboards
plan: 21
subsystem: ui
tags: [svg, bar-chart, diverging-axis, contrast, wcag-1-4-11, svelte-5, vitest, playwright]

# Dependency graph
requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: "the monthly bar-chart model, the currency block and its exact bigint chart input (05-09, 05-13), the flow-colour contract and its W-03 contrast pins (05-08), the hand currency fixture"
provides:
  - "chart zero line and bound hairlines shipped as the 05-UI-SPEC Color table declares, pinned in source and in the browser"
  - "currency plot divided in proportion to the two sides' extents on ONE shared scale, with a 32px floor for the smaller side"
  - "domainUp / domainDown on the bar model and domainUpUnits / domainDownUnits beside the exact chart input"
  - "y-axis end labels naming the extents, with the exact figure in the SVG title"
  - "a non-finite / negative amount guard on every value before an extent is computed (T-05-60)"
  - "an '## Amendments (plan 05-21)' appendix on 05-UI-SPEC, with its pin in contrast.test.ts"
affects: [05-vehicle-stats-financial-dashboards, 05-22, 05-UI-REVIEW, phase-07-phone-width-polish, bar-chart-model, finance-state, MonthlyBarChart, CurrencyBlock]

# Actuals (#2632)
actuals:
  tokens: 266
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A contract row is parsed off disk and compared with the code that ships it (the W-03 method), now also for SVG strokes"
    - "One geometry rule, exported as a single named constant and consumed by both the float model and the bigint label layer, with a test that the two agree"
    - "A superseding UI-SPEC amendment appendix rather than an edit to the approved prose, pinned by a test"

key-files:
  created: []
  modified:
    - src/lib/bar-chart-model.ts
    - src/lib/finance-state.ts
    - src/lib/components/CurrencyBlock.svelte
    - src/lib/components/MonthlyBarChart.svelte
    - tests/unit/bar-chart-model.test.ts
    - tests/unit/finance-state.test.ts
    - tests/unit/contrast.test.ts
    - tests/e2e/finance.spec.ts
    - .planning/phases/05-vehicle-stats-financial-dashboards/05-UI-SPEC.md

key-decisions:
  - "Keep ONE scale and divide the plot, rather than giving each side its own scale or shrinking the plot: own scales would draw a 10-unit withdrawal as tall as a 1,000,000 deposit, and a per-chart height would make every height assertion move"
  - "Floor each side at a quarter of the OTHER side's maximum, which is 32px of the 160px plot — that is the number that keeps the 14px zero label and the bottom label from ever touching"
  - "Round the up room and take the down room as the remainder, then clamp each bar to its own side's room: two independently rounded halves would either lose or overflow a pixel"
  - "Export CURRENCY_MIN_SIDE_DIVISOR from the model and import it into finance-state, so the bigint label extents and the float geometry cannot drift apart silently"
  - "Leave the pitch ladder and the label stride byte-identical: G-05-9's width clause belongs to plan 05-22"
  - "Change no flow colour: the audit's top fix 2 is about the chart FRAME, and the spec row was already right while the code was wrong"

patterns-established:
  - "Strip CSS comments before reading a component stylesheet for a contract value — the rules now carry a comment naming the spec row, so an unstripped read would assert a comment against itself"
  - "Read a chart's visible label text from its direct text nodes, never `textContent`, because the exact figure lives in a `<title>` child and `textContent` would run the two together"

requirements-completed: [FINANCE-01, FINANCE-02]

coverage:
  - id: D1
    description: "The chart zero line is #5f6368 and both plot-bound hairlines are #dadce0, exactly as the 05-UI-SPEC Color table declares, pinned in source and in the browser"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/contrast.test.ts#chart frame strokes (05-UI-SPEC Color)"
        status: pass
      - kind: e2e
        ref: "playwright tests/e2e/finance.spec.ts -g frame"
        status: pass
    human_judgment: false
  - id: D2
    description: "A currency chart divides its 160px plot between the two directions in proportion to their extents, on one shared scale, so an almost-all-deposit currency no longer wastes half its plot"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/bar-chart-model.test.ts#currency — one shared scale, with the plot split by each side’s extent"
        status: pass
      - kind: e2e
        ref: "playwright tests/e2e/finance.spec.ts -g axis-sample"
        status: pass
    human_judgment: false
  - id: D3
    description: "The y-axis end labels name the two extents with the exact figure in the SVG title, including the quarter-rule case where no month holds that value"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/finance-state.test.ts#05-21 currencyChartInput axis extents"
        status: pass
      - kind: e2e
        ref: "playwright tests/e2e/finance.spec.ts -g axis-one-sided"
        status: pass
    human_judgment: false
  - id: D4
    description: "A non-finite or negative amount reads as zero before any extent is computed, so no coordinate in a model is ever NaN or Infinity (T-05-60)"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/bar-chart-model.test.ts#reads a non-finite or negative amount as zero, and stays finite (T-05-60)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The UI-SPEC carries a dated 'Amendments (plan 05-21)' appendix recording the split, the labels, that the frame needed no spec change, and that plan 05-22 owns the pitch and the stride"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/contrast.test.ts#05-21 amendments appendix"
        status: pass
      - kind: manual_procedural
        ref: "plan 05-21 Task 3 <human-check>: run the viewer skill against the LOCAL real export at 1280px and look at the currency charts"
        status: unknown
    human_judgment: true
    rationale: "Whether an almost-all-deposit currency now reads as a chart that uses its height, and whether the dark zero line reads as a clear line, are visual judgments no assertion makes. The plan's own <human-check> marks this optional and local only, because the real export is personal data that must never be committed or copied into the repository."

# Metrics
duration: 20min
completed: 2026-10-03
status: complete
---

# Phase 05 Plan 21: chart frame colours and the divided currency axis

**The zero line and hairlines now ship the Color table's strokes, and the currency plot divides its 160px between deposits and withdrawals in proportion to each side's extent — on one shared scale, with a 32px floor for the smaller side**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-02T23:58:35+04:00
- **Completed:** 2026-10-03T00:18:00+04:00
- **Tasks:** 3
- **Files modified:** 9

## Gap status

**UAT G-05-9 is PARTIALLY closed by this plan and is NOT resolved.** Two of its
three clauses are done:

- ✅ **colour clause** — the zero line and both bound hairlines match the
  05-UI-SPEC Color table and are pinned in source and in the browser (D1).
- ✅ **empty-axis clause** — the currency plot is divided by extent instead of
  split evenly, without ever giving the two sides different scales (D2, D3).
- ⏳ **width clause** — charts in one card sharing a width. **Open, owned by plan
  05-22** (wave 2). The user chose a finer integer pitch over a shared month
  axis and over leaving it; frame stretching was rejected because it draws a
  flat zero line across months that are not in the data.

**The orchestrator must not mark G-05-9 resolved until 05-22 lands.** The
amendment appendix in 05-UI-SPEC records this in the spec itself, and
`contrast.test.ts` pins the sentence that hands the pitch to 05-22.

## Accomplishments

- The zero line shipped `#dadce0` (1.37:1) and the hairlines an off-palette
  `#e8eaed`, while the Color table declares `#5f6368` and `#dadce0`. Both now
  ship the declared values. A unit test parses the row off the contract text
  (before any Amendments appendix), strips the stylesheet's comments and
  requires the strokes to match; a browser test reads the computed strokes on
  the premium and the first currency chart. Both were confirmed RED first.
- The currency plot is no longer split 80/80. Each side's extent is its own
  largest month, floored at a quarter of the other's, so the zero line moves to
  where the data is: y 123 and y 122 on the sample's two charts, y 136 on a
  one-sided currency, against y 88 everywhere before.
- The honesty property is preserved and asserted: one linear scale, so a deposit
  bar and a withdrawal bar of equal amount are the same height in every chart
  (the 400-up / 400-down case asserts `46` on both sides). Each currency still
  has its own scale (D-15), so the block caption stays true.
- An axis label can now name something no month holds, so the exact bigint
  extents travel beside the chart input and the titles name them. The one-sided
  browser test reads `−15,000` where the chart holds a 10.
- Every amount is read as zero unless it is a finite positive number, before any
  extent is computed, so an `Infinity`, a `NaN` or a negative from an untrusted
  CSV cannot reach a coordinate (T-05-60).
- Plot height, SVG height, the pitch ladder, the label stride, the node budget,
  the hit targets, the keyboard model and the entire premium branch are
  unchanged — verified by the diff and by every pre-existing premium assertion
  still passing untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: chart zero line and hairlines carry the contract colours** — `ed4eb84` (feat)
2. **Task 2: split the currency plot by shared-scale extents** — `718b917` (feat)
3. **Task 3: browser proof of the trimmed axis + the UI-SPEC appendix** — `f069614` (feat)

Hooks were enabled for all three. No `Co-Authored-By` trailer is present on any
of them.

## Files Created/Modified

- `src/lib/bar-chart-model.ts` — `CURRENCY_MIN_SIDE_DIVISOR`, the 160px currency
  plot, `domainUp` / `domainDown`, the proportion split with its 32px floor, the
  per-side bar clamp, and the finite-positive amount guard.
- `src/lib/finance-state.ts` — `domainUpUnits` and `domainDownUnits` computed in
  bigint under the imported divisor, beside the unchanged `domainMaxUnits`.
- `src/lib/components/CurrencyBlock.svelte` — the y-axis top and bottom labels
  built from the two exact extents, with the bottom negated as a bigint so an
  empty side reads `0` and not `-0`.
- `src/lib/components/MonthlyBarChart.svelte` — the two stroke values, each with
  a comment pointing at the Color table row.
- `tests/unit/bar-chart-model.test.ts` — the even-split currency tests replaced
  by eleven hand-derived cases: split by extent, withdrawal-led mirror, one-sided
  both ways, equal sides, the 231/89 half-pixel clamp, equal-amount/equal-height,
  empty, non-finite, hostile-beside-real, the 32–128px sweep, and the layout
  constants.
- `tests/unit/finance-state.test.ts` — a describe for the two new exact extents
  over credits, gold, a one-sided entry, a withdrawal-led entry, a corrupted
  entry, and the model's float extents agreeing with the bigint ones.
- `tests/unit/contrast.test.ts` — the chart-frame stroke pins and the 05-21
  appendix pin, both after the existing describes and without touching them.
- `tests/e2e/finance.spec.ts` — `(frame)`, `(axis-sample)` and `(axis-one-sided)`.
- `.planning/phases/05-vehicle-stats-financial-dashboards/05-UI-SPEC.md` — the
  `## Amendments (plan 05-21)` appendix. Every line above it is untouched.

## Decisions Made

- **Divide the plot rather than scale the sides separately.** Giving each side
  its own scale would draw a 10-unit withdrawal as tall as a 1,000,000 deposit,
  which destroys the one thing the diverging chart is for. Dividing keeps one
  scale and only moves the line.
- **The floor is a quarter of the other side, not a fixed 32px.** A fixed floor
  would be violated by a currency 10,000:1 lopsided; deriving it from the data
  makes the 32px a consequence rather than a constant, which is why a test can
  sweep the bound instead of trusting it.
- **Round one side and derive the other.** `round(160 × up ÷ span)` then
  `160 − upRoom`. Rounding both independently would let the rooms sum to 159 or
  161. The per-side bar clamp exists because a bar rounds on its own and can
  land a half pixel over its room — the 231/89 case, where 45 is clamped to 44.
- **`domainMax` kept its old meaning.** It is still the larger of the two
  maxima, because that is what a reader means by "this chart's maximum" and it
  is what the premium axis labels. The two new fields carry the axis extents, so
  nothing that already read `domainMax` had to change.
- **No flow colour was touched.** `--flow-in` and `--flow-out` are unchanged and
  still sit 1.36:1 apart, still asserted. The audit's top fix 2 is about the
  chart frame, and the Color row for the frame was already correct — the code
  was the thing that had drifted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan constraint — commit hygiene] A `Co-Authored-By` trailer was added to Task 1's commit and removed by amend**
- **Found during:** Task 1 (frame colours)
- **Issue:** The plan states "Do not add a Co-Authored-By trailer to any commit
  (project rule)". The first commit carried a literal `Co-Authored-By: none`
  trailer line, which is still a Co-Authored-By trailer and would read as a
  violation of that rule to any tool scanning trailers.
- **Fix:** `git commit --amend` with the trailer removed, before any further work.
  Task 1's SHA is the amended one (`ed4eb84`); the original object is
  unreferenced and appears in no reflog branch tip.
- **Files modified:** none (commit metadata only)
- **Verification:** `git log -1 --format=%B` shows no trailer on `ed4eb84`,
  `718b917` or `f069614`.
- **Committed in:** `ed4eb84` (amended in place)

---

**Total deviations:** 1 auto-fixed (commit hygiene)
**Impact on plan:** No effect on the code or the plan's scope. Self-corrected
before the next task began; flagged here rather than left silent.

## Issues Encountered

- **A pre-existing e2e failure in `finance.spec.ts`.** The test `(clip) the
  first and last month keep the finance tooltip inside the viewport` fails at
  `await expect(tooltip).toBeVisible()` after a manual `window.scrollTo` plus a
  `hover()`. This plan does not cause it: it reproduces with all three Task 2
  sources stashed, and again with the whole of Task 1 reverted to `ab4fc51`
  (the branch tip before this plan). It looks like a scroll/hover race. It is
  **not fixed here** — `tests/e2e/finance.spec.ts` is in this plan's file set,
  but the failure is outside this plan's scope and its cause is a timing race in
  a test this plan does not own. Reported for a follow-up.
- **A wrong figure in Task 1's commit message.** The body says the two flow hues
  "sit 1.41:1 apart". They sit **1.36:1** apart, and this plan changes no flow
  colour — 1.41 was a figure computed for a colour change that turned out not
  to be in scope. The substance of the sentence (the zero line is the non-colour
  cue for two hues that sit close together) is right; only the number is wrong.
  The commit was left unamended rather than rewritten, because two further
  commits sit on top of it and the audit trail of one commit per task is worth
  more than a corrected digit in a commit body. Flagged here instead.
- **The plan's stated arithmetic for the model and the label can differ by less
  than one unit, by construction.** `finance-state` divides in `bigint` (which
  truncates) while the model divides in floats. For every currency in the
  fixtures the two agree to within 1e-9, which is what
  `the exact extents and the model's float extents follow one rule` asserts. In
  the general case — a withdrawal maximum under a quarter of the deposit maximum,
  where truncation bites — the label can name a value fractionally below the
  axis extent. This is inherent to labelling an axis from exact integers while
  drawing it in floats, and it is bounded by one unit out of the figure on the
  axis. No deviation from the plan: the plan specifies both halves of this.

## User Setup Required

None — no external service configuration required. No dependency was installed;
`git diff --quiet -- package.json pnpm-lock.yaml` exits 0 (T-05-SC).

## Validation run

| Check | Result |
|---|---|
| `pnpm test:unit` (full suite) | **1384 passed**, 47 files |
| `pnpm run check` (`tsc -b`) | clean |
| `pnpm run lint` (`prettier --check . && eslint .`) | clean |
| `playwright tests/e2e/finance.spec.ts -g frame` | 1 passed |
| `playwright … -g "axis-sample\|axis-one-sided"` | 2 passed |
| `playwright tests/e2e/finance.spec.ts -g "currency-tracer\|frame"` | 2 passed — the height-192 assertion still holds |
| `playwright tests/e2e/finance.spec.ts finance-scale.spec.ts zero-network.spec.ts` | **36 passed, 1 failed, 3 did not run** — the failure is the pre-existing `(clip)` above |
| `playwright test --list` | 197 tests in 17 files — under the 218 CI ceiling, no limit raised |
| Mutation check (Task 3) | both new tests restored the pre-Task-2 sources and failed on the zero line's `y` (88, the old even split), not on a build error; `git diff --quiet` confirmed afterwards |

## Next Phase Readiness

- **05-22 is unblocked and owns the rest of G-05-9.** It amends the pitch rule
  and the label stride, and it is the plan that closes the gap. Everything it
  needs is here: the plot is divided rather than fixed, so a pitch change does
  not have to re-derive the split.
- **The premium chart is deliberately untouched**, including its short-axis
  emptiness, which no plan in this phase changes. Recorded in the appendix so it
  is not mistaken for an oversight.
- **The pre-existing `(clip)` tooltip failure is unrelated to this plan** and
  still needs an owner.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Plan: 21*
*Completed: 2026-10-03*
