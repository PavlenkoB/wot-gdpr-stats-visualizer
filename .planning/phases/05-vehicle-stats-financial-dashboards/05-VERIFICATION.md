---
phase: "05"
slug: vehicle-stats-financial-dashboards
verified: 2026-10-02T21:23:34Z
status: passed
verdict: PASSED
head: 255dab1
branch: gsd/phase-05-vehicle-stats-financial-dashboards
score: 4/4 must-haves verified
covered_files:
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-01-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-01-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-02-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-02-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-03-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-03-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-04-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-04-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-05-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-05-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-06-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-06-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-07-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-07-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-08-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-08-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-09-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-09-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-10-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-10-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-11-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-11-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-12-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-12-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-13-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-13-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-14-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-14-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-15-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-15-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-16-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-16-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-17-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-17-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-18-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-18-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-19-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-19-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-20-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-20-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-21-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-21-SUMMARY.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-22-PLAN.md
  - .planning/phases/05-vehicle-stats-financial-dashboards/05-22-SUMMARY.md
  - src/lib/bar-chart-model.ts
  - src/lib/components/BattleTypeSummary.svelte
  - src/lib/components/CurrencyBlock.svelte
  - src/lib/components/IdentityHeader.svelte
  - src/lib/components/MonthlyBarChart.svelte
  - src/lib/components/PlayerStats.svelte
  - src/lib/components/VehicleTable.svelte
  - src/lib/finance-state.ts
  - src/lib/focus-clear.ts
  - src/lib/ui-copy.ts
  - src/lib/worker/finance.ts
  - src/lib/worker/vehicle-stats.ts
covered_digest: "v2:sha256:5239ce767e414e3bfde65a9301868f4362002a375150f9dd6bc2b7668f4d5583"
behavior_unverified: 0
overrides_applied: 0
requirements_checked: [STATS-01, FINANCE-01, FINANCE-02, FINANCE-03]
criteria_met: 4
criteria_total: 4
re_verification:
  previous_status: passed
  previous_score: 4/4
  previous_head: 2c2336d
  gaps_closed:
    - "G-05-8 controls row (05-20), UAT test 8 pass"
    - "G-05-9 chart frame colours, one-scale split currency axis, whole-pixel bar pitch (05-21, 05-22), UAT test 8 pass"
    - "G-05-10 14px text floor and battle-type table scroller (05-20), UAT test 8 pass"
  gaps_remaining: []
  regressions: []
human_verification_disposition:
  - item: "UI review findings G-05-8, G-05-9, G-05-10 on a real export (UAT test 8)"
    disposition: "satisfied by 05-UAT.md test 8 (result: pass; headless drive of the rebuilt app against a real export kept outside the repo)"
advisory:
  - finding: "INC-17-19-WR-01: oracleCurrency routes by threshold only, so a 9th charted currency would land in the app's others list and in no oracle list. Unreachable today (CHART_MAX 8, SCALE_CODES 6)."
    category: other
    reason: "Test-oracle fidelity only; recorded open in 05-REVIEW-DISPOSITION.md. Would resolve by capping the oracle at CHART_MAX."
    evidence_status: "none provided"
  - finding: "INC-17-19-WR-02: ISO_TIMESTAMP_RE requires seconds while the oracle's readDate does not, so a CURR_PREMIUM written without seconds would fall back to bulk CREATED with CI green. UAT tests 3 and 8 on the real export produced the expected premium chart, so the current export parses; the residual is hypothetical drift in a future export."
    category: other
    reason: "Recorded open in 05-REVIEW-DISPOSITION.md. Cheap hardening: make the builder accept the no-seconds form or make the oracle reject it."
    evidence_status: "none provided (real-export UAT pass is evidence the current export parses)"
  - finding: "No code review was recorded for the 05-20, 05-21 and 05-22 diff. 05-REVIEW.md covers 05-01..05-16 and 05-REVIEW-INCREMENTAL-17-19.md covers 05-17..05-19; the UI gap-closure plans (bar-chart-model.ts pitch and split rewrite, finance-state.ts extents, CurrencyBlock.svelte labels) have been exercised by the expanded bar-chart-model unit tests (about 480 changed lines), finance-state and contrast unit tests, and new browser specs, but not by a review pass."
    category: other
    reason: "Process gap, not a defect: no failing test or reproducible defect backs it. A /gsd-code-review run over 05-20..05-22 would close it."
    evidence_status: "none provided"
  - finding: "05-UI-REVIEW.md still records the pre-fix audit (15/24 at head ff7b636). It was not re-scored after 05-20..05-22; the post-fix evidence is UAT test 8 (headless measurement on a real export) and the new browser/unit guards."
    category: other
    reason: "A re-run of /gsd-ui-review would refresh the score; not a goal-achievement gap."
    evidence_status: "none provided"
  - finding: "Phone-width internal scroll containers (vehicle table, hours-per-day chart, currency charts) have no touch scroll affordance."
    category: other
    reason: "Deferred by the UI-SPEC and recorded in 05-UAT.md Deferred Follow-Ups for Phase 7 phone polish."
    evidence_status: "none provided"
  - finding: "finance.spec.ts tooltip-hover test at line 1568 is a known intermittent test (flaked once at plan 05-21 and reproduced with that plan's changes stashed)."
    category: other
    reason: "Did not flake in this session's full e2e run (198 passed); no isolated re-run was needed. Pre-existing, not caused by 05-20..05-22."
    evidence_status: "passed in this session; intermittency recorded in 05-21-SUMMARY.md"
---

# Phase 5 - Verification (re-verification after UI-review gap closure 05-20, 05-21, 05-22)

**Goal:** User can review per-vehicle battle performance across all four Wargaming titles and see where their premium time, virtual currency, and real money went.

**Head verified:** `255dab1` on `gsd/phase-05-vehicle-stats-financial-dashboards`. The prior report ran at `2c2336d`, passed, and went stale because covered source changed: plans 05-20 (controls row, 14px floor, battle-type scroller), 05-21 (chart frame colours, one-scale split currency axis), 05-22 (whole-pixel bar pitch), plus Phase 4's 04-17 correction to the shared `src/lib/focus-clear.ts`, which `MonthlyBarChart.svelte` imports. Untracked working-tree content is only `.planning/ui-reviews/04-20261002-synth/` (a Phase 4 review capture, not part of this phase).

**Status: `passed`.** All four roadmap success criteria hold in the code; the data-bearing source the first-pass report verified (`worker/vehicle-stats.ts`, `worker/finance.ts`, `ui-copy.ts`, `IdentityHeader.svelte`) is unchanged since `2c2336d`; every re-run command is green; the one new human-verification item (UI review, UAT test 8) is covered by a `pass` in `05-UAT.md`. No real-export figure appears in this report on purpose.

## What was executed in this session

Run sequentially, once each, at `255dab1`, with port 4173 confirmed free first.

| Command | Result |
|---|---|
| `pnpm run check` (`tsc -b`) | exit 0 |
| `pnpm run lint` (Prettier + ESLint) | clean, exit 0 |
| `pnpm run test:unit` | 47 files / 1405 tests passed, exit 0 |
| `pnpm run build` | built, exit 0 |
| `pnpm run test:e2e` | 198 passed (55.4s), exit 0; the known-intermittent `finance.spec.ts:1568` tooltip-hover test did not flake, so no isolated re-run was needed |
| `git diff 2c2336d..HEAD -- src` added lines grep for `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `new Worker` | no additions |
| grep `TBD\|FIXME\|XXX` in the seven Phase 5 `src/` files changed by 05-20..22 and `focus-clear.ts` | none |
| grep for `font-size` under 14px (px 10-13 or sub-0.9rem) across `src/` | none |
| grep for `.skip`, `.todo`, `xit(`, `.fixme` in the Phase 5 unit and e2e specs touched by 05-20..22 | none |

## Observable truths (ROADMAP Phase 5 success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Per-vehicle stats for WoT, Blitz, Warships and Warplanes; an absent title is empty not an error; thousands of rows scroll | VERIFIED | `src/lib/worker/vehicle-stats.ts` has no diff since `2c2336d`. The vehicle-stats e2e spec (24+ tests: windowing, states, title switcher, reset, plus the new `(controls-row)`, `(type-floor)` and 375px `(phone-375)` tests) passes in the 198-test run. 05-20 changed only presentation: `.controls` now declares `flex-direction: row` with `flex-wrap: wrap` (`PlayerStats.svelte:941`, test id `player-stats-controls`), the battle-type table sits in a `role="region" tabindex="0"` scroller named from `BATTLE_TYPE_SUMMARY_HEADING` (`BattleTypeSummary.svelte:130-136`, `overflow-x: auto` at `:247`). UAT tests 2 and 8 pass on the real export |
| 2 | A timeline shows premium-time operations over the account's history | VERIFIED | `worker/finance.ts` (premium date column rule) unchanged since `2c2336d`. The premium chart's presentation changed in 05-21/05-22: `MonthlyBarChart.svelte:337-355` ships zero line and hairlines at the Color table's `#5f6368` / `#dadce0`; `pitchFor` is now `min(16, max(4, floor(576 / months)))` with a NaN and sub-1 guard (`bar-chart-model.ts`), the label stride derived from the pitch. Pre-existing premium widths (140, 76, 540, 476, 1020) are asserted unchanged by the 05-22 browser tests, and the premium plot height (96) is untouched. UAT tests 3 and 8 pass |
| 3 | A timeline shows virtual-currency flow with income and spending over time | VERIFIED | `buildCurrency` unchanged. The chart model now divides the 160px plot by each side's extent on one shared scale, with a quarter-of-the-other-side floor (`CURRENCY_MIN_SIDE_DIVISOR = 4`), a per-side clamp, and a finite-positive guard on untrusted amounts (T-05-60). `finance-state.ts` `currencyChartInput` computes the exact bigint `domainUpUnits` / `domainDownUnits` under the same divisor, and `CurrencyBlock.svelte` labels the y axis from them (`yTop` / `yBottom`), so axis text names the real extents. Hand-derived unit cases (split by extent, mirror, one-sided, equal sides, 231/89 half-pixel clamp, equal-amount equal-height, empty, non-finite, 32-128px sweep) and the browser `(frame)`, `(axis-sample)`, `(axis-one-sided)`, `(pitch-73)` specs pass. D-15 (own scale per currency) and D-17 (deposits up, withdrawals down) still hold; the "equal room either side" wording that was dropped was an implementation detail of the earlier model, not a locked decision, and 05-UI-SPEC.md carries dated `Amendments (plan 05-21)` and `(plan 05-22)` appendices with the original text left intact. UAT tests 4 and 8 pass |
| 4 | Real-money spend per currency, PAID orders only, no blended or converted grand total | VERIFIED | `buildSpend` and the spend cards are outside every `src/` diff hunk since `2c2336d`; `spend.spec.ts` (figures, zero-blend assertions) passes in the 198-test run. UAT test 6 pass |

**Score: 4/4.** The 05-20..22 work is presentation and geometry; the one invariant-style claim it adds (bars never leave their side of the plot, every label gap is at least 96px) is exercised by tests rather than by presence: the 1-to-144-month label-gap property sweep, the 32-128px sweep, and the 231/89 clamp case run in `bar-chart-model.test.ts`, and the containment and floor claims are measured in a real browser. So `behavior_unverified` is 0. Reliance check: the new colour, pitch and extent behaviours are established by constants and arithmetic in code, not by fixture setup; none flagged.

## Required artifacts and wiring

| Artifact | Status | Details |
|---|---|---|
| `src/lib/bar-chart-model.ts` | VERIFIED | Substantive (pitch rule, extent split, clamp, stride). Imported by `finance-state.ts` (`CURRENCY_MIN_SIDE_DIVISOR`) and consumed by `MonthlyBarChart.svelte` |
| `src/lib/finance-state.ts` | VERIFIED | `currencyChartInput` emits `domainUpUnits` / `domainDownUnits`, consumed by `CurrencyBlock.svelte` |
| `src/lib/components/CurrencyBlock.svelte` | VERIFIED | Axis labels built from the exact extents; empty side negated as bigint so it reads `0` not `-0` |
| `src/lib/components/MonthlyBarChart.svelte` | VERIFIED | Frame strokes at contract values; imports `scrollClear` from `focus-clear.ts` |
| `src/lib/focus-clear.ts` | VERIFIED | 04-17 sign correction (`top: delta`, not `-delta`) is wired into `MonthlyBarChart`, `HourGrid` and `CalendarHeatmap`; its unit test pins the corrected sign |
| `src/lib/components/PlayerStats.svelte` | VERIFIED | Controls row, 14px caption and toggle rules |
| `src/lib/components/BattleTypeSummary.svelte` | VERIFIED | Named, focusable, horizontally scrolling region; cells at 14px |
| `src/lib/components/VehicleTable.svelte` | VERIFIED | Nation tag at 14px; the dead 13px phone media query is gone (guard scan finds no sub-14px declaration anywhere under `src/`) |
| `src/lib/worker/{finance,vehicle-stats}.ts`, `ui-copy.ts`, `components/IdentityHeader.svelte` | VERIFIED (regression check) | No diff since `2c2336d` |
| `tests/unit/phase5-layout-guards.test.ts` | VERIFIED | New source-contract guard (controls direction and wrap, 14px floor across every stylesheet and `app.css`, scroll-region role, tab stop, name, overflow) |

Key links: `finance-state.ts` to `bar-chart-model.ts` (`CURRENCY_MIN_SIDE_DIVISOR`, one source for the quarter rule) WIRED; `currencyChartInput` extents to `CurrencyBlock.svelte` axis labels WIRED; `buildBarChartModel` pitch/stride/extents to `MonthlyBarChart.svelte` WIRED; `BATTLE_TYPE_SUMMARY_HEADING` to the scroller's `aria-label` WIRED.

## Data-flow trace (Level 4)

| Artifact | Value | Source | Status |
|---|---|---|---|
| Currency y-axis labels | `yTop` / `yBottom` | bigint extents from the worker's sparse monthly in/out units via `currencyChartInput` | FLOWING |
| Currency / premium bars | `cells`, `zeroY` | `buildBarChartModel` over the same monthly series | FLOWING |
| Battle-type table, vehicle table | rows | parsed `Player_statistics` per title | FLOWING, unchanged data path |
| Premium chart, spend cards, identity header | as in the prior report | unchanged | FLOWING; confirmed on a real export by UAT 3, 6, 7 and 8 |

No hollow props, static returns or hardcoded-empty fallbacks in the changed code.

## Requirements coverage

| Requirement | REQUIREMENTS.md | Evidence | Status |
|---|---|---|---|
| STATS-01 | Phase 5, Complete | truth 1, UAT 1, 2, 8 | SATISFIED |
| FINANCE-01 | Phase 5, Complete | truth 2, UAT 3, 8 | SATISFIED |
| FINANCE-02 | Phase 5, Complete | truth 3, UAT 4, 8 | SATISFIED |
| FINANCE-03 | Phase 5, Complete | truth 4, UAT 6 | SATISFIED |

All four IDs are claimed by plans 05-01..05-22; no orphaned requirement.

## Human verification disposition

The one new human-checkable item since the prior report was the UI review. `05-UAT.md` (frontmatter `status: complete`; 8 passed, 0 issues, 0 pending) records test 8 as `pass`, re-verified by a headless drive of the rebuilt app against a real export kept outside the repo: controls in a row at 1280 and wrapped at 375, zero text nodes under 14px, the battle-type table in its own scroller with no page overflow at 375, zero line `#5f6368` and hairline `#dadce0`, near-equal currency chart widths. G-05-8, G-05-9 and G-05-10 are `resolved` in the UAT gap list. This verifier did not re-drive any real export. The human-verification section is therefore empty and the status is not `human_needed`.

## Anti-patterns

| File | Finding | Severity |
|---|---|---|
| Phase 5 `src/` files changed by 05-20..22, `focus-clear.ts` | no `TBD`/`FIXME`/`XXX`, no stub, no sub-14px text, no network primitive | none |
| `tests/helpers/finance-oracle.ts` | oracle date reader accepts optional seconds where the builder requires them (INC-17-19-WR-02) | advisory, test fidelity |
| `tests/helpers/finance-oracle.ts` | oracle `others` has no `CHART_MAX` cap (INC-17-19-WR-01) | advisory, unreachable today |

Open items in `05-REVIEW-DISPOSITION.md` (WR-01..03, INC-17-19-WR-01/02, IN-01/02) remain `open`; none contradicts a success criterion, none is backed by a failing test, none is a carried-forward gap. WR-01 (bar-chart node budget as a bound for currency charts) concerns code in `bar-chart-model.ts`, which 05-21/05-22 changed; the node budget (`3 x months + 40`) is asserted unchanged by the 05-22 tests and no test is red, so it stays an open warning, not a gap.

## Privacy

No network primitive was added in the `src/` diff since the prior report. The zero-network e2e spec (including its Phase 5 flows) passes in the 198-test run.

## Housekeeping notes for the owner

- `05-UAT.md` notes for tests 1, 2 and 6 were already scrubbed of figures, but the `expected:` lines of tests 3 and 4 still quote real-export figures (month count, largest month and days, UAH row count and total) from an earlier round. They predate this run and I did not edit them; the project rule is that real-export data never enters the repository, so consider scrubbing those two lines.
- The `.planning/ui-reviews/04-20261002-synth/` directory is untracked and unrelated to Phase 5.

## Gaps summary

None. Phase goal achieved: per-vehicle stats for four titles, a premium-time timeline, a virtual-currency flow timeline with income and spending on an honest one-scale axis, and per-currency PAID-only spend with no blended total, each confirmed in code, by the full automated suites, and by the user's real-export UAT.

---

_Verified: 2026-10-02T21:23:34Z at `255dab1`_
_Verifier: Claude (gsd-verifier), force stance, re-verification mode_
