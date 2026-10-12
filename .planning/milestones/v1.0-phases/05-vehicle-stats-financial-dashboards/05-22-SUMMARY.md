---
phase: 05-vehicle-stats-financial-dashboards
plan: 22
subsystem: ui
tags: [svg, bar-chart, pitch, axis-labels, uat-gap, G-05-9, svelte-5, vitest, playwright]

# Dependency graph
requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: "the monthly bar-chart model and its four-step pitch ladder (05-09), the currency block with its exact bigint chart input (05-13), the 05-21 currency plot split and colour pins, and the 05-21 Amendments appendix that handed G-05-9's width clause to this plan"
provides:
  - "pitchFor as the largest whole pixel from 4 to 16 that fits 576px — a plot filled 80.6% to 100% for 37 to 144 months instead of 51% to 100%"
  - "a label stride that follows the pitch: 24 months below a pitch of 8px, so labels stay at least 96px apart at every pitch"
  - "BAR_LAYOUT.maxPitchPx, minPitchPx and labelMinGapPx, each carrying the UI-SPEC row it comes from"
  - "a '(pitch-73)' browser proof: a 73-month export renders 571px wide at pitch 7 with three year labels"
  - "an '## Amendments (plan 05-22)' appendix on 05-UI-SPEC, pinned by six tests in contrast.test.ts"
  - "G-05-9 closed in full — this SUMMARY is the one that marks it resolved"
affects: [05-vehicle-stats-financial-dashboards, 05-UI-REVIEW, 05-UAT, phase-07-phone-width-polish, bar-chart-model, MonthlyBarChart, ci-budget]

# Actuals (#2632)
actuals:
  tokens: 6677
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A geometric rule expressed as one clamped division rather than a step list, so a property (the fill floor) becomes provable over the whole input range instead of only at the steps"
    - "Two hand-derived literals that a property test then sweeps: the table says what the rule is at 37, 73 and 116 months, the sweep says it holds everywhere between"
    - "A superseding UI-SPEC amendment appendix, pinned clause by clause — one test per load-bearing sentence, plus a guard that the superseded contract text is still in the contract"

key-files:
  created: []
  modified:
    - src/lib/bar-chart-model.ts
    - tests/unit/bar-chart-model.test.ts
    - tests/e2e/finance.spec.ts
    - tests/unit/contrast.test.ts
    - .planning/phases/05-vehicle-stats-financial-dashboards/05-UI-SPEC.md

key-decisions:
  - "Express the pitch as floor(576 / months) clamped to 4..16 rather than stepping down a list — a list answers in jumps of four, so a month count landing just past a step silently lost most of the plot"
  - "Check non-finite BEFORE the under-1 check, so NaN and Infinity take the 4px floor rather than the 16px cap: a NaN pitch would put the geometry somewhere unrecoverable (T-05-63)"
  - "Derive the stride from the arithmetic (12 x pitch < 96) rather than from pitch === 4, because 5, 6 and 7 are pitches the model can now produce and the old rule is wrong at all three"
  - "Leave the label-drop rule, the width formula, bar width, hit width, the scroll flag and the node count byte-identical, and edit no component: MonthlyBarChart reads pitch, bar width, hit width and label x from the model, and its ring width and tick offset already work at an odd pitch"
  - "Split the plan's single appendix-phrase test into four, one per clause, matching the 05-21 describe's one-clause-per-test convention — a superset of the planned coverage, not a reduction"
  - "Do not raise any e2e limit: the CI budget guard is green at 198 listed tests, so playwright.config.ts and ci.yml are untouched"

patterns-established:
  - "When a rule replaces a list, assert the PROPERTY over the full input range alongside the hand-derived literals — the literals say what the rule is, the sweep says no month count escapes it"
  - "Quote the superseded contract row in a test scoped to the text before the first Amendments heading, so a history that was rewritten in place fails rather than passing against the appendix that replaced it"

requirements-completed: [FINANCE-01, FINANCE-02]

coverage:
  - id: D1
    description: "A bar chart's pitch is the largest whole pixel from 4 to 16 that fits 576px, so the plot is filled 80.6% to 100% for every month count from 37 to 144 (100% where the count divides 576, worst case 116 months at 464px) instead of 50.7% to 100% under the old 16/12/8/4 ladder"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/bar-chart-model.test.ts#pitchFor — the largest whole pixel from 4 to 16 that fits 576px"
        status: pass
      - kind: unit
        ref: "tests/unit/bar-chart-model.test.ts#the SVG width — 56 + months x pitch + 4, at the pitch that fits"
        status: pass
    human_judgment: false
  - id: D2
    description: "A 73-month chart draws at pitch 7, 571px wide, with cell x attributes 56 and 63, 6px bars and the labels 2015-01, 2017-01 and 2019-01 — in a real browser, from a real export"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "playwright tests/e2e/finance.spec.ts -g pitch-73"
        status: pass
    human_judgment: false
  - id: D3
    description: "The x-axis label stride is 12 months while 12 x pitch is at least 96px and 24 months below a pitch of 8px, so at every month count from 1 to 144 the first label is index 0, adjacent labels are at least 96px apart and no later label runs past the SVG's right edge"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/bar-chart-model.test.ts#the label stride follows the pitch, 24 months below pitch 8"
        status: pass
    human_judgment: false
  - id: D4
    description: "pitchFor answers a degenerate month count with a whole pixel in 4..16 and never NaN — 0 and a negative give 16, NaN and Infinity give 4 (T-05-63)"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/bar-chart-model.test.ts#answers a degenerate month count with a whole pixel and never NaN"
        status: pass
    human_judgment: false
  - id: D5
    description: "The UI-SPEC carries a dated 'Amendments (plan 05-22)' appendix superseding the two Spacing rows, the section 6 Pitch rule decision and the X axis stride sentence, and recording that the widths are near-equal rather than equal (D-17, D-15) with the three options weighed"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/contrast.test.ts#05-22 amendments appendix"
        status: pass
      - kind: manual_procedural
        ref: "plan 05-22 Task 2 <human-check>: run the viewer skill against the LOCAL real export at 1280px and look at the currency charts"
        status: unknown
    human_judgment: true
    rationale: "Whether a several-year chart now reads as one that fills most of its plot, with wider bars and year labels that do not touch, is a visual judgment no assertion makes. The plan's own <human-check> marks it optional and local only, because the real export is personal data that must never be committed or copied into the repository."

# Metrics
duration: 21min
completed: 2026-10-03
status: complete
---

# Phase 05 Plan 22: a whole-pixel bar pitch

**The monthly bar chart's pitch is now the largest whole pixel from 4 to 16 that fits 576px rather than one of four steps, so a chart fills 80.6% to 100% of its plot for 37 to 144 months instead of 50.7% to 100% — and G-05-9 is closed in full**

## Performance

- **Duration:** 21 min
- **Started:** 2026-10-03T00:19:20+04:00
- **Completed:** 2026-10-03T00:40:30+04:00
- **Tasks:** 2
- **Files modified:** 5 (plus this SUMMARY)

## Gap status

**UAT G-05-9 is CLOSED IN FULL by plans 05-21 and 05-22 together. This is the
SUMMARY that marks it resolved; 05-21's records it as partial and was not
touched.**

- ✅ **colour clause** — closed by plan 05-21: the zero line and both bound
  hairlines match the 05-UI-SPEC Color table, pinned in source and in the
  browser.
- ✅ **empty-axis clause** — closed by plan 05-21: the currency plot divides by
  each side's extent on ONE shared scale, with a 32px floor.
- ✅ **width clause** — closed by this plan: the pitch is a whole pixel, so every
  chart fills its own column (D1, D2, D3).

The clause is closed as "near-equal widths on an honest axis", not as "equal
widths". Each chart still spans its own months (D-17) and keeps its own scale
(D-15), so the amendment records the three options weighed and why a shared
month axis — which would amend D-17 — and frame stretching — which draws a flat
zero line across months that are not in the data — were not chosen, and why
leaving it was not chosen either.

## Accomplishments

- `pitchFor` no longer walks a list. It is
  `min(16, max(4, floor(576 / months)))`, which spends the plot width the
  column actually has. The change is small; what it fixes is not: under the four
  steps, a 73-month chart drew 292 of 576px — 50.7% — and a 56-month chart 448,
  while 115 and 116 months drew identically. Under the whole-pixel rule the
  plot is 80.6% to 100% full for every month count from 37 to 144, exactly full
  wherever the count divides 576, and the worst case is 116 months at 464px
  where the 4px floor takes over.
- The label stride had to follow, or the new pitches would have broken a
  documented promise: 12 x 7 is 84px, under the UI-SPEC's 96px floor. The stride
  is now derived from that arithmetic rather than from `pitch === 4`, which the
  old rule used and which is wrong at 5, 6 and 7. A property test sweeps 1 to 144
  months and asserts the first label, the 96px gap and the right edge at every
  one. 12 x 8 is exactly 96 and keeps the narrow stride; 24 x 4 is exactly 96,
  so the floor holds at every pitch down to the floor.
- Hand-derived literals fail on the old ladder, which is the point of writing
  them: 37 months gave 12 rather than 15, and the fill invariant tripped at
  444 of 576px against a 460.8px floor. Every band is pinned — 37→15, 49→11,
  56→10, 73→7, 100→5, 116→4 — with the plot each buys written beside it and the
  next pitch up that would not fit.
- A `(pitch-73)` browser test drives the real model through the real component
  from a synthetic 73-month export: width 571, height 192, 73 cells, cell x
  attributes 56 and 63, a 6px in-bar, and the labels 2015-01, 2017-01 and
  2019-01 and no others. It also asserts the scroller does not scroll at 571px,
  which is the whole reason the rule exists — on the old ladder this chart was
  352px wide and drew a quarter of the column.
- Everything else is unchanged, and asserted rather than asserted-in-prose: the
  144-month scroll threshold, the `56 + months x pitch + 4` width, bar width
  `pitch - 1`, hit width `pitch`, the `3 x months + 40` node budget, the premium
  plot height, and the pre-existing finance widths of 140, 76, 540, 476 and
  1020 — which are untouched by construction, because 5, 1, 30, 26 and 240
  months all clamp to a pitch the ladder already chose.
- Plan 05-21's colour and empty-axis work is intact: its `(frame)` and
  `(axis-sample)` and `(axis-one-sided)` browser tests and its contrast pins all
  still pass, and its appendix was not edited.
- A dated `## Amendments (plan 05-22)` appendix supersedes the two Spacing rows,
  the section 6 Pitch rule decision and the X axis stride sentence, and records
  the honesty argument and the options. Six tests pin it — one per clause plus
  a guard that the superseded contract text is still in the contract, so a
  history rewritten in place fails instead of passing against the appendix that
  replaced it.

## Task Commits

Each task was committed atomically:

1. **Task 1: whole-pixel pitch and the 24-month label stride, from model to
   browser** — `bc01eac` (feat)
2. **Task 2: UI-SPEC amendments appendix for the pitch and label stride, pinned
   in a test** — `1ae9d2e` (feat)

Hooks were enabled for both. No `Co-Authored-By` trailer is present on either.

## Files Created/Modified

- `src/lib/bar-chart-model.ts` — the pitch rule, the three new `BAR_LAYOUT`
  constants, the stride derived from the pitch, and the doc comments rewritten
  from "four steps" to the whole-pixel rule and the honesty argument.
  `PITCH_STEPS`, `NARROW_PITCH` and `NARROW_LABEL_STRIDE` are deleted; no
  component was edited, because `MonthlyBarChart.svelte` reads the pitch, the
  bar width, the hit width and the label positions from the model and its ring
  width (`max(pitch, 8)`) and tick offset (`floor(pitch / 2)`) already work at
  an odd pitch.
- `tests/unit/bar-chart-model.test.ts` — the `pitchFor` describe replaced by the
  whole-pixel rule (six bands, the floor past 144, the degenerate counts, the
  scroll assertions kept), a new width describe (seven month counts, `barWidth`
  and `hitWidth` per cell, and the ≥80% fill invariant), and a new stride
  describe (the 56, 72, 73 and 100-month label cases plus the 1-to-144-month
  property sweep). The existing pitch-16 and pitch-4 label tests, the
  node-budget tests and the module-boundary test are untouched. 50 tests, up
  from 35.
- `tests/e2e/finance.spec.ts` — the `(pitch-73)` describe with its own import,
  built from the existing `currencyRow` and `currencyExport` helpers.
- `tests/unit/contrast.test.ts` — the `05-22 amendments appendix` describe,
  added after the 05-21 one with no existing describe modified.
- `.planning/phases/05-vehicle-stats-financial-dashboards/05-UI-SPEC.md` — the
  `## Amendments (plan 05-22)` appendix. Every line above it is untouched, and
  the `## Amendments (plan 05-21)` appendix is intact including its "NOT
  amended here" handoff, which this appendix discharges.

## Decisions Made

- **One clamped division, not a step list.** A list answers in jumps of four, so
  a month count landing just past a step silently lost most of the plot. The
  division makes the fill a provable property of the rule rather than a
  coincidence of which step a chart happened to land on.
- **Non-finite is checked before under-1.** `Math.max(0, Math.floor(NaN))` is
  `NaN`, so testing `months < 1` first would have handed a `NaN` count the 16px
  cap. The finite check comes first and the 4px floor is the fallback, which is
  also what the old code did (T-05-63).
- **The stride is derived, not special-cased.** `12 * pitch < 96` is the rule the
  UI-SPEC's sentence already described; the old `pitch === 4` was an
  approximation of it that happened to be exact only while the pitch could only
  be 4, 8, 12 or 16.
- **No component edit.** The plan expected none and none was needed; the one
  thing that could have broken is the focus ring at `max(pitch, 8)`, which grows
  at pitches below 8 and so only ever becomes more visible.
- **No e2e limit raised.** The guard is green at 198 listed tests (the plan
  predicted 194 from a 187 baseline; the real baseline was 197), projecting
  1,050 s against a 25-minute `globalTimeout`, so `playwright.config.ts` and
  `ci.yml` are untouched.
- **The contract text was not rewritten.** The superseded rows and sentences stay
  above the first Amendments heading exactly as approved, which is the same
  method 05-08 and 05-21 used and the reason a later reader can still tell a
  choice from an inheritance.

## Deviations from Plan

### Auto-fixed Issues

**1. Test spec — the appendix pin is six tests, not three**
- **Found during:** Task 2 (UI-SPEC amendments appendix)
- **Issue:** The plan's `<behavior>` block asked for three tests, with its Test 2
  carrying five distinct clauses (the whole-pixel rule, the stride, D-17, the
  near-equal statement and G-05-9) in one body. A single failure would not say
  which clause went missing.
- **Fix:** Split Test 2 into four clause-level tests, matching the 05-21 describe
  directly above it, and added the appendix's date to the placement test. Every
  phrase the plan listed is asserted; the plan's three tests are a subset of the
  six, and the plan's Test 3 (contract text intact) is present and passing.
- **Files modified:** `tests/unit/contrast.test.ts`
- **Verification:** Confirmed RED first — 5 of the 6 failed with "the 05-22
  appendix is missing, or does not follow the 05-21 one" while the contract
  guard passed, exactly as expected. All 6 pass after the appendix was written.
- **Committed in:** `1ae9d2e`

---

**Total deviations:** 1 auto-fixed (test spec: additive refinement, no coverage lost)
**Impact on plan:** None on scope, files or behaviour. No requirement, no file
outside the plan's `files_modified`, and no assertion the plan asked for was
dropped.

## Issues Encountered

- **The plan's stated RED evidence for the fill invariant is imprecise, and the
  test is stronger than the claim.** The plan says the ≥80% fill invariant
  "fails on the old ladder at 73 months (292)". 73 months is where the old
  ladder's minimum sits — 292 of 576px, 50.7% — but the invariant actually first
  trips at 37 months, where the old ladder drew 444px against a 460.8px floor.
  The invariant as written is correct and was implemented exactly as specified;
  the assertion's first RED failure simply appears earlier in the sweep than the
  plan's parenthetical implies. The test comment states it the accurate way.
- **One pre-existing e2e failure, not caused by this plan.**
  `(clip) the first and last month keep the finance tooltip inside the viewport`
  in `finance.spec.ts` is flaky on this branch and pre-dates this work (the
  briefing records it failing at baseline `c0fe696` as well as at the branch
  tip). It was **passed** by the first full run of `finance.spec.ts` +
  `finance-scale.spec.ts` (37/37) and **failed** on a later run of the same
  tests plus `zero-network.spec.ts`. Because that describe block is
  `mode: 'serial'`, the failure reported 3 further tests as "did not run"; all 3
  were re-run individually and passed. It was not fixed, not weakened, not
  skipped, and it blocked nothing.
- **Two phrases in the appendix were split across line wraps.** The pin asserts
  `below a pitch of 8px` and `flat zero line` as contiguous strings, and the
  first draft wrapped both mid-phrase. Re-wrapped rather than loosened, because
  a pin that tolerates a newline is a pin that stops reading like the spec.

## User Setup Required

None - no external service configuration required.

## Verification

| Check | Result |
|-------|--------|
| `pnpm run test:unit` | 1405 passed / 47 files |
| `pnpm run check` (`tsc -b`) | clean |
| `pnpm run lint` (`prettier --check .` + `eslint .`) | clean |
| `pnpm exec vitest run bar-chart-model bar-chart-components currency-blocks contrast ci-budget` | 103 + 58, all pass |
| `playwright tests/e2e/finance.spec.ts tests/e2e/finance-scale.spec.ts` | **37 passed, 0 failed** (includes the known-flaky `(clip)` test) |
| `playwright finance.spec.ts finance-scale.spec.ts zero-network.spec.ts` | 37 passed, 1 failed (the known-flaky `(clip)` test), 3 did not run |
| the 3 serial-skipped tests, re-run individually | 3 passed (`(stray-years)`, `(income-only)`, `(income-month)`) |
| `playwright tests/e2e/zero-network.spec.ts` | 4 passed |
| `playwright test --list` | 198 tests in 17 files |
| `tests/unit/ci-budget.test.ts` | pass — `globalTimeout` 25 min ≥ 1.3 × 1,050 s (23 min); wrapper 27 m ≥ global + 90 s; job 35 m ≥ wrapper + 300 s |
| `git diff --quiet -- package.json pnpm-lock.yaml` | exits 0 — no dependency touched (T-05-SC) |
| `git status --short` | only this SUMMARY; the untracked `.planning/ui-reviews/04-20261002-synth/` is another agent's Phase 4 artifact and was never staged |
| `.planning/STATE.md`, `.planning/ROADMAP.md` | **not touched** — owned by the orchestrator for this run |
| Real personal data in source, fixtures or output | none — every export in the new test is synthetic (`ru.shared_currency.pitch` / `Pitch Probe`) |

## Next Phase Readiness

- **G-05-9 is ready to mark resolved** in `05-UAT.md` and in the phase state.
  That write belongs to the orchestrator, which owns STATE.md and ROADMAP.md for
  this run; this SUMMARY is the record it should read.
- **No follow-on work is required.** The pitch, the stride, the scroll threshold
  and the node budget are all settled, and the amendment records the three
  options for the width clause so "make the charts the same width" is not
  re-proposed later as an unexamined defect.
- **Phase 7 (phone width) is unaffected in kind.** The pitch rule is
  width-agnostic — it is computed from a fixed 576px desktop plot — and a 375px
  viewport scrolls inside the chart's own box rather than widening the page, as
  the existing scroller assertions already cover.
- **One thing a human still has to eyeball:** the plan's optional local
  `<human-check>` against the real export at 1280px. It is not automated
  because the real export is personal data that must never enter the repository.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Completed: 2026-10-03*
