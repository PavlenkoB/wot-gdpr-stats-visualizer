---
phase: 04-activity-time-dashboards
verified: 2026-10-02T21:12:00Z
supersedes_verified: 2026-10-02T22:29:00Z  # the prior pass stamped local time (+04:00) as Z; the true UTC instant is about 18:29Z (commit f1dc6e8)
status: passed
score: 5/5 roadmap success criteria verified
covered_files:
  - .planning/phases/04-activity-time-dashboards/04-01-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-01-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-02-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-02-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-03-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-03-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-04-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-04-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-05-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-05-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-06-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-06-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-07-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-07-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-08-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-08-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-09-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-09-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-10-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-10-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-11-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-11-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-12-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-12-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-13-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-13-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-14-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-14-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-15-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-15-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-16-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-16-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-17-18-GAPCLOSURE-REVIEW.md
  - .planning/phases/04-activity-time-dashboards/04-17-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-17-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-18-PLAN.md
  - .planning/phases/04-activity-time-dashboards/04-18-SUMMARY.md
  - .planning/phases/04-activity-time-dashboards/04-UAT.md
  - .planning/phases/04-activity-time-dashboards/04-UI-REVIEW.md
  - .planning/phases/04-activity-time-dashboards/04-UI-SPEC.md
  - .planning/quick/261001-2qr-add-hover-outline-to-calendar-heatmap-ce/261001-2qr-PLAN.md
  - .planning/quick/261001-2qr-add-hover-outline-to-calendar-heatmap-ce/261001-2qr-SUMMARY.md
  - .planning/quick/261001-36p-add-pointer-hover-outline-to-weekday-x-h/261001-36p-PLAN.md
  - .planning/quick/261001-36p-add-pointer-hover-outline-to-weekday-x-h/261001-36p-SUMMARY.md
  - src/lib/components/CalendarHeatmap.svelte
  - src/lib/components/ChartLegend.svelte
  - src/lib/components/DurationList.svelte
  - src/lib/components/HourGrid.svelte
  - src/lib/components/MonthlyBarChart.svelte
  - src/lib/components/Playtime.svelte
  - src/lib/components/PlaytimeCharts.svelte
  - src/lib/components/PlaytimeSummary.svelte
  - src/lib/focus-clear.ts
  - src/lib/playtime-client.ts
  - src/lib/playtime-model.ts
  - src/lib/playtime-shared.ts
  - src/lib/playtime-state.ts
  - src/lib/ui-copy.ts
  - src/lib/worker/db.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/worker/playtime.ts
  - tests/e2e/playtime-charts.spec.ts
  - tests/e2e/playtime-real-shape.spec.ts
  - tests/e2e/playtime-scale.spec.ts
  - tests/e2e/playtime-ui-review.spec.ts
  - tests/fixtures/export-fixtures.ts
  - tests/fixtures/pinned-zip.ts
  - tests/fixtures/playtime-real-shape-fixture.ts
  - tests/fixtures/sessions-fixtures.ts
  - tests/unit/contrast.test.ts
  - tests/unit/focus-clear.test.ts
  - tests/unit/playtime-charts.test.ts
  - tests/unit/playtime-model.test.ts
  - tests/unit/playtime-scale.test.ts
  - tests/unit/sample-export-shape.test.ts
  - vitest.config.ts
covered_digest: "v2:sha256:c08eddeffe103759eaade86180e99826908b65c9b862d81f300604e2e173b09a"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: "5/5 roadmap criteria"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 4: Activity Time Dashboards - Verification Report

**Phase Goal:** User can see how much and when they played: lifetime totals, a year-by-year calendar, a weekly rhythm, and typical session lengths. The charts hold up on a decade-long account.
**Verified:** 2026-10-02T21:12:00Z (01:12 on 2026-10-03 local, UTC+04:00), post gap-closure plans 04-17 and 04-18 and post UAT 60/60
**Status:** passed
**Re-verification:** Yes. The prior report (2026-10-02, `passed`) went stale after the covered tree changed (the UAT file was re-run to 60/60 and the Phase 5 tree moved on). This pass re-ran every gate against the current HEAD (`93a604e`) and re-read the code the gap closures touched.
**Branch:** `gsd/phase-05-vehicle-stats-financial-dashboards`

## Evidence basis

Every gate below was run by this verifier, sequentially, with nothing on port 4173 beforehand (`lsof -ti:4173` printed nothing before the e2e run). SUMMARY.md claims were used only as pointers; each was re-derived from source.

| Command | Exit | Result |
|---|---|---|
| `pnpm run check` (`tsc -b`) | 0 | clean, no output |
| `pnpm run lint` (`prettier --check . && eslint .`) | 0 | "All matched files use Prettier code style!", eslint silent |
| `pnpm run test:unit` (`vitest run`) | 0 | **47 files, 1405/1405 tests**, 5.43s |
| `pnpm run build` (`vite build`) | 0 | built; worker bundle 154.58 kB, main JS 158.03 kB, CSS 30.65 kB |
| `pnpm run test:e2e` (`playwright test`, full suite, chromium) | 0 | **198 passed (54.4s)**, 0 failed, 0 flaky. `playwright test --list` reports `Total: 198 tests in 17 files` |
| `gsd-tools query verification.fingerprint` | 0 | `v2:sha256:c08eddef...b09a` over 76 covered files (see frontmatter) |

Notes on those results:

- The 1405 / 198 totals are higher than the 1358 / 191 in the prior pass because Phase 5 plans 05-20..05-22 landed in between (7 new e2e tests, 47 unit files). None of them touches a Phase 4 contract, and all pass.
- `tests/e2e/finance.spec.ts:1568`, which the prior pass recorded as a ~83%-fail tooltip-hover race owned by Phase 5, **passed** in this full run. It is still unfixed in the test file, so treat it as intermittent, not as resolved. It is Phase 5's, not Phase 4's.
- The working tree was clean of tracked changes before and after. The one untracked entry (`.planning/ui-reviews/04-20261002-synth/`) was already present before this run and was neither opened nor touched.
- No real export, no `tests/fixtures/private/`, and no real figure was opened or reproduced here.

## Goal Achievement

### Observable Truths (ROADMAP success criteria, the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A summary shows total hours played, total sessions, and active days derived from Activity_history | VERIFIED | `PlaytimeSummary.svelte` renders the three tiles from the slice; `tests/e2e/playtime-scale.spec.ts` (in the 198-pass run) asserts the rendered values equal the fixture's closed-form answer key. UAT test 1 (human, real export) confirms the populated block. Gap-closure 04-18 changed only the tile's CSS (`flex-wrap: wrap`, `overflow-wrap: normal`, unit `white-space: nowrap`, `PlaytimeSummary.svelte:228-249`); the `dl` grid is unchanged at `repeat(auto-fit, minmax(128px, 1fr))` (`:187`). |
| 2 | Year-by-year calendar heatmap shows per-day activity; colour scale keeps ordinary days distinguishable (not linear min-max) | VERIFIED | `rankScale` is the nearest-rank percentile scale in `playtime-model.ts`; the heavy-tail and ramp-contrast guards (`playtime-model.test.ts`, `contrast.test.ts`) are inside the 1405-pass run. Perceptual half: UAT test 3 (human) PASS. Calendar geometry after 04-17: `CALENDAR_LAYOUT` is `cell 10, pitch 11, gutter 40, labelPad 4, width 634` (`playtime-model.ts:77-97`), and the weekday label is drawn at `x = gutter - labelPad = 36` (`CalendarHeatmap.svelte:509`). |
| 3 | Day-of-week x hour-of-day heatmap with the timezone basis explicitly labeled | VERIFIED | `PlaytimeCharts.svelte` renders `HOUR_GRID_BASIS_CAPTION`; 168 cells from `buildHourGridModel`. Legend note layout after 04-18: `ChartLegend.svelte` row `gap: 8px 4px` (`:68`), note `flex-basis: 100%` (`:113`); pinned by e2e `playtime-ui-review.spec.ts:460` (passed). |
| 4 | Session-duration distribution shows typical session lengths | VERIFIED | `DurationList.svelte` renders 12 bins; scale e2e asserts bin counts sum to the Sessions tile. Unchanged by 04-17/04-18. |
| 5 | With a 50k+ session / 10-15 year fixture every chart renders without freezing; SVG node count scales with buckets | VERIFIED | `playtime-scale.spec.ts` passed in the full run (60,000-session preset, node counts follow buckets, no long task). 04-17/04-18 added no DOM nodes (CSS, constants and one scroll-sign change only). |

**Score: 5/5.** No truth is behavior-unverified: the two behavior-dependent invariants this closure added (focus correction direction, tile wrap) each have a passing browser test that measures the behavior, not just the symbol (see below).

### Gap-closure truths re-derived from source (04-17, 04-18)

| Truth | Status | Evidence |
|---|---|---|
| Weekday labels fit the calendar gutter at 1280px and 375px | VERIFIED | Room is `gutter - labelPad = 36px` against a widest label of about 29px, so the label's left edge is near x = 7. Source: `playtime-model.ts:83,93`. Browser guard `playtime-ui-review.spec.ts:68` measures real `getBoundingClientRect()` for every year at both widths: passed. |
| 54-column fit is preserved | VERIFIED | Recomputed from the shipped constants: `40 + 54 x 11 = 634`, the declared `width`; 634 is inside the 640px card content width with **6px to spare**. |
| Focus correction scrolls the page up (cell moves down, out from under sticky chrome) | VERIFIED | `focusScrollDelta` returns `Math.min(0, rect.top - requiredTop)` (`playtime-model.ts:~906`), never positive; `scrollClear` passes it through unchanged: `window.scrollBy({ top: delta, behavior: 'instant' })` (`focus-clear.ts:66`). No `-delta` remains. Behavioral evidence: e2e `playtime-ui-review.spec.ts:202` (cell clears the sticky head at 375px) and `tests/unit/focus-clear.test.ts` passed. |
| Sticky year-head height is measured, not a 32px literal | VERIFIED | `headHeightFor` returns `head.offsetHeight` (`CalendarHeatmap.svelte:383-388`) and is the argument at `:355`. |
| Shared helper still serves Phase 5 | VERIFIED | `scrollClear` has exactly three consumers: `CalendarHeatmap.svelte:355`, `HourGrid.svelte:278`, `MonthlyBarChart.svelte:144` (Phase 5, passes `0`). The full 198-test e2e run, which includes `finance.spec.ts`, passed. `MonthlyBarChart.svelte` is added to `covered_files` for that reason. |
| Tile numeral and unit never break mid-word at 375px | VERIFIED | e2e `playtime-ui-review.spec.ts:364` (Range-measured line counts) passed; the `dd` rule no longer declares `overflow-wrap: anywhere` (remaining `anywhere` occurrences are at `:274`, `:284`, `:326`, the untrusted-text cells and notes). |
| Legend note is on its own line, 8px under the swatch row | VERIFIED | `ChartLegend.svelte:68,113`; e2e `:460` passed (both legends, both widths). |

Mutation evidence (revert the fix, watch the guard fail) for each of these is recorded in the prior pass's report, which this file replaces: see `git show f1dc6e8:.planning/phases/04-activity-time-dashboards/04-VERIFICATION.md` (its MUST-HAVES and TEST INTEGRITY sections, mutations M1-M6) and in `04-17-18-GAPCLOSURE-REVIEW.md`. That prior report also holds the IP-never-rendered evidence (three independent lines), summarized in Anti-Patterns below and re-checked by grep in this pass. I did not repeat the mutations in this pass; I re-confirmed the fixes are still present in source and that the guards pass against them.

### Corrections to the prior report

The prior report's gap-closure table and its 54-column paragraph contained wrong numbers. They did not change any verdict, but they must not be carried forward:

- It stated `labelPad: 11` and a label drawn at `x = 29`. The source says `labelPad: 4`, so the label's right edge is at `x = 36` (`playtime-model.ts:93`, `CalendarHeatmap.svelte:509`; `04-17-SUMMARY.md` and UI-SPEC A-1 agree with the source).
- It stated "1px to spare" and wrote the arithmetic as `40 + 10 x 54`. The pitch is 11, so the fit is `40 + 54 x 11 = 634` inside 640, with **6px** to spare.
- It reported the e2e total as 191 and unit total as 1358; the current totals are 198 and 1405 (Phase 5 growth).

### Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `src/lib/playtime-model.ts` | VERIFIED | Substantive (`rankScale`, calendar/hour-grid/duration models, `CALENDAR_LAYOUT`, `focusScrollDelta`); consumed by the components and worker. |
| `src/lib/focus-clear.ts` | VERIFIED | Wired from 3 components; correct sign (see above). |
| `src/lib/components/CalendarHeatmap.svelte`, `HourGrid.svelte`, `PlaytimeSummary.svelte`, `ChartLegend.svelte`, `PlaytimeCharts.svelte`, `DurationList.svelte`, `Playtime.svelte` | VERIFIED | Rendered, wired top-down; data flows from the worker aggregate (`playtime-scale.spec.ts` asserts rendered values equal the closed-form key). |
| `src/lib/worker/playtime.ts`, `db.ts`, `ingest.worker.ts`, `playtime-shared.ts`, `playtime-state.ts`, `playtime-client.ts` | VERIFIED | Unchanged since the 2026-10-01 pass; covered by unit and e2e suites that passed. |
| `tests/e2e/playtime-ui-review.spec.ts` (4 tests), `tests/unit/focus-clear.test.ts`, `tests/unit/playtime-charts.test.ts`, `tests/unit/playtime-model.test.ts`, `tests/unit/contrast.test.ts`, `tests/fixtures/pinned-zip.ts`, `vitest.config.ts` | VERIFIED | All four ui-review tests are listed by `playwright test --list` and passed. The fixture builders `export-fixtures.ts`, `sessions-fixtures.ts` and `playtime-real-shape-fixture.ts`, changed by the flake-fix commits (`f512f56`, `0d937f6`, `1c6dad6`) to route through `pinned-zip.ts`, are now in `covered_files`; every Phase 4 browser test builds its archive through them. |

### Key Links

| From | To | Status |
|---|---|---|
| `CalendarHeatmap.svelte:355` | `scrollClear(node, headHeightFor(node))` -> `focusScrollDelta` -> `window.scrollBy` | WIRED |
| `CalendarHeatmap.svelte:509` | `CALENDAR_LAYOUT.gutter - CALENDAR_LAYOUT.labelPad` | WIRED |
| `MonthlyBarChart.svelte:144` | `scrollClear(node, 0)` (Phase 5 shared consumer) | WIRED |
| `Playtime.svelte` | `PlaytimeSummary` / `PlaytimeCharts` via the ready slice | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Real data | Status |
|---|---|---|---|---|
| `PlaytimeSummary.svelte` | tile values | worker aggregate over Sessions files | yes (scale e2e compares against the closed-form key) | FLOWING |
| `CalendarHeatmap.svelte` | day cells | `buildCalendarModel` over the stored `dayIndex/daySeconds` | yes (cell counts asserted by scale spec) | FLOWING |
| `HourGrid.svelte`, `DurationList.svelte` | 168 cells / 12 bins | stored `hourOverlap` / `bins` | yes (bin sum equals Sessions tile) | FLOWING |

### Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| ACTIVITY-01 (totals summary) | SATISFIED | Truth 1 |
| ACTIVITY-02 (calendar heatmap, per-day aggregation) | SATISFIED | Truths 2 and 5 |
| ACTIVITY-03 (day x hour heatmap, per-bucket) | SATISFIED | Truth 3 |
| ACTIVITY-04 (session-duration distribution) | SATISFIED | Truth 4 |

`REQUIREMENTS.md` marks ACTIVITY-01..04 `[x]` and `Complete` for Phase 4. ACTIVITY-05..07 belong to Phase 6; none is orphaned here. (The re-verification request named ACTIVITY-01..03; the ROADMAP and the plans claim 01..04, so all four were checked.)

### Anti-Patterns

- `TBD` / `FIXME` / `XXX` in the phase's changed source and test files: none (grep over `focus-clear.ts`, the four components, `playtime-model.ts`, `playtime-ui-review.spec.ts`, `focus-clear.test.ts`; also none in the prior sweep over `src/`).
- Network APIs (`fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`) in `src/`: none. The zero-network e2e spec passed in the full run.
- No dependency change: `git diff 349ec8f..HEAD -- package.json pnpm-lock.yaml index.html` is empty.
- No IP column reference in `src/` outside comments (grep for `ip_address`, `ipaddress`, `'IP'`, `"IP"` returned nothing).
- No stubs: every changed component renders from real data; no hardcoded-empty props on the production path.

### Probe Execution

None declared; no `scripts/*/tests/probe-*.sh` exists. Not applicable.

### Human Verification

No items remain open. The earlier human checks were satisfied by `04-UAT.md` (`status: complete`, 60 total: 6 human + 54 auto-passed, 60 passed, 0 issues, 0 pending). Specifically:

- UAT test 6 (UI review findings) was `issue` and is now `pass`. Its note records a headless drive of the rebuilt app with a real export kept outside the repo: weekday labels unclipped in every year grid at 1280 and 375, tile numeral on one line with the unit stacked below at 375, no page overflow. I read the note; I did not re-perform that drive and did not see the export. It is corroborated by the four passing `playtime-ui-review` browser tests, which measure the same properties on the synthetic fixture.
- UAT tests 1 and 5 (real export, cache-cleared notice) were human PASS on a real export in the earlier passes and are unaffected by CSS/constant changes.

## Open, non-blocking items (not Phase 4 goal gaps)

1. `finance.spec.ts:1568` (Phase 5 tooltip-hover race) is still intermittent by the Phase 5 owner's own record; it passed this run.
2. `vitest.config.ts` `testTimeout: 20_000` masks CPU starvation rather than removing it; the full unit suite here ran in 5.4s, well inside it.
3. `04-17-SUMMARY.md` and `04-18-SUMMARY.md` quote point-in-time totals (1352/1356 unit, 189/191 e2e); the totals above are current. The 6px-to-spare figure in 04-17-SUMMARY is correct; only the prior verification report's 1px was wrong.
4. Two UAT follow-ups were deferred in `04-UAT.md` (2026-09-30): the calendar-cell hover outline, which has since shipped as quick tasks 261001-2qr and 261001-36p and is pinned by passing e2e; and rewording test 2's expected text (the calendar tooltip never shows a wall-clock time), which remains deferred. Neither bears on a success criterion.

## Honest limits

- Visual quality beyond measured geometry was not judged by this pass; the human evidence is UAT, which I read but did not repeat.
- Everything ran in Chromium (the project's only configured browser); WebKit and Firefox are not exercised.
- I did not re-run the mutation tests of the prior pass; I re-confirmed source state and that guards pass.

## Verdict

All five ROADMAP success criteria and ACTIVITY-01..04 are verified against the current tree with fresh gate runs (check, lint, 1405 unit, build, 198 e2e, all exit 0). The three UI-review gaps closed by 04-17/04-18 are present in source and held by passing browser tests, UAT is 60/60, and no human item remains. Status `passed`.

---

_Verified: 2026-10-02T21:12:00Z_
_Verifier: Claude (gsd-verifier)_
