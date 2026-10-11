---
phase: 04-activity-time-dashboards
verified: 2026-10-11T12:47:57Z
status: passed
score: 5/5 roadmap success criteria verified in code and gates; 0 failed; 2 superseded 04-17 gap-closure claims accepted as overrides; HOUR_GRID_BASIS decided as 'overlap' by owner 2026-10-11; 7 human verification items remain
covered_files: [".planning/phases/04-activity-time-dashboards/04-01-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-01-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-02-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-02-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-03-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-03-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-04-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-04-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-05-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-05-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-06-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-06-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-07-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-07-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-08-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-08-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-09-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-09-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-10-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-10-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-11-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-11-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-12-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-12-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-13-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-13-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-14-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-14-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-15-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-15-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-16-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-16-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-17-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-17-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-18-PLAN.md", ".planning/phases/04-activity-time-dashboards/04-18-SUMMARY.md", ".planning/phases/04-activity-time-dashboards/04-UAT.md", "src/lib/charts/ChartLegend.svelte", "src/lib/charts/MonthlyBarChart.svelte", "src/lib/charts/chart-width.ts", "src/lib/core/focus-clear.ts", "src/lib/features/playtime/CalendarHeatmap.svelte", "src/lib/features/playtime/DurationList.svelte", "src/lib/features/playtime/HourGrid.svelte", "src/lib/features/playtime/Playtime.svelte", "src/lib/features/playtime/PlaytimeCharts.svelte", "src/lib/features/playtime/PlaytimeSummary.svelte", "src/lib/features/playtime/playtime-aggregate.ts", "src/lib/features/playtime/playtime-client.ts", "src/lib/features/playtime/playtime-model.ts", "src/lib/features/playtime/playtime-shared.ts", "src/lib/features/playtime/playtime-state.ts", "src/lib/shell/Dashboard.svelte", "src/lib/shell/selection-state.ts", "src/lib/ui-copy.ts", "src/lib/worker/db.ts", "src/lib/worker/ingest.worker.ts", "tests/e2e/playtime/playtime-charts.spec.ts", "tests/e2e/playtime/playtime-real-shape.spec.ts", "tests/e2e/playtime/playtime-scale.spec.ts", "tests/e2e/playtime/playtime-ui-review.spec.ts", "tests/e2e/playtime/playtime.spec.ts", "tests/unit/charts/chart-width.test.ts", "tests/unit/charts/contrast.test.ts", "tests/unit/core/focus-clear.test.ts", "tests/unit/playtime/playtime-charts.test.ts", "tests/unit/playtime/playtime-client.test.ts", "tests/unit/playtime/playtime-model.test.ts", "tests/unit/playtime/playtime-scale.test.ts", "tests/unit/playtime/playtime.test.ts"]
covered_digest: "v3:sha256:5d1d3e0dcb044f3dfa20e498bb9ccb2f548bb4b9efe3193aaaed232cf4ea9792"
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "54-column calendar fits the 640px card (634px fixed width, 6px spare) (04-17 truth)"
    reason: "Superseded by Phase 8 plans 08-20 and 08-21: chart width is now measured and the calendar layout comes from calendarLayoutFor(chartsWidth) (PlaytimeCharts.svelte:94), with CALENDAR_LAYOUT.width = 634 as the floor. The 640px card is no longer the constraint; the 54-column no-clip property still holds at the floor."
    accepted_by: "Bohdan_Pavlenko"
    accepted_at: "2026-10-11T13:52:49Z"
  - must_have: "Focus correction clears the sticky nav (04-17 truth)"
    reason: "Superseded by Phase 8 plans 08-01, 08-02, 08-03, 08-07 and later (08-12, 08-14, 08-15, 08-17, 08-18): the sticky anchor nav was removed, STICKY_CHROME_SELECTOR matches nothing so navBottom = 0 (core/focus-clear.ts), and the clear line is the measured year head only."
    accepted_by: "Bohdan_Pavlenko"
    accepted_at: "2026-10-11T13:52:49Z"
re_verification:
  previous_status: passed
  previous_score: "5/5 roadmap criteria"
  previous_verified: 2026-10-02T21:12:00Z
  reason: "Covered tree changed after the last verifier run. Phase 8 (plans 08-01..08-22, commit 5ab3af2) moved every Phase 4 module out of src/lib/components/ and src/lib/*.ts into src/lib/features/playtime/, src/lib/charts/ and src/lib/core/, removed the sticky anchor nav, and made chart width measured. 04-UAT.md listed six unresolved entries at verification time; one (G-04-HOUR-GRID-BASIS) was decided 'overlap' by the owner on 2026-10-11, five remain."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  owner_decisions:
    - "2026-10-11 (Bohdan_Pavlenko, answered in chat): HOUR_GRID_BASIS = 'overlap'. Keeps current behaviour; HOUR_GRID_BASIS_CAPTION already says so. Resolves human item 'Decide HOUR_GRID_BASIS' and UAT gap G-04-HOUR-GRID-BASIS as DECIDED: overlap. No code change."
  superseded_by_phase_8:
    - "04-17 truth: 54-column calendar fits the 640px card (634px fixed width). Now the floor of a measured width (08-20, 08-21). Accepted as override 2026-10-11."
    - "04-17 truth: focus correction clears the sticky nav. The nav is gone and the clear line is the year head only (08-01, 08-02, 08-03 and later plans per their SUMMARY files). Accepted as override 2026-10-11."
human_verification:
  - test: "Open a real or realistic export, select the Playtime section in the Phase 8 master-detail layout, and confirm the populated block: three summary tiles, calendar, hour grid, duration bins, split selector, excluded count."
    expected: "All blocks populated. The calendar and hour grid fill the detail pane. Nothing reads the old single-scroll layout."
    why_human: "UAT test 1 passed before Phase 8 moved the block into the detail pane. Only a person can confirm the populated state in the new layout."
    partial_evidence: "2026-10-11 walkthrough (Bohdan_Pavlenko approved): synthetic export, Playtime pane at 1280x800, 1280x600 and 375x812 rendered with no page-level horizontal scroll and 0 loose overflow elements (265 past the right edge on phone, all inside scroll containers). Layout fill only; populated tile/calendar/hour-grid/bins content was not checked on a real export. NOT resolved."
  - test: "Confirm one real SESSION_START/STARTED_AT cell appears verbatim in its calendar day tooltip, with the hours and session count."
    expected: "The tooltip date, hours and sessions match the source row. No wall-clock time is shown."
    why_human: "UAT test 2 passed pre-Phase 8, and the real per-game header now uses STARTED_AT. Matching a real row needs a person."
  - test: "Check calendar shading across a decade-long export: ordinary days are distinguishable, and the outlier day is darkest."
    expected: "Perceptual contrast holds at the new measured width."
    why_human: "UAT test 3 (perceptual) passed pre-Phase 8. Colour perception is not testable by grep or by the contrast unit tests."
  - test: "At 375px, use PageUp/PageDown and the arrow keys on the calendar. Confirm the focused cell stays visible and clear of the sticky year head."
    expected: "The cell is not hidden under the year head. The tooltip stays open across the correction."
    why_human: "UAT test 4 was recorded against the nav that Phase 8 removed. Keyboard scrolling in the new layout needs a person to confirm."
  - test: "Open the app in two tabs. Clear the cache in tab 2, then change the region selector in tab 1."
    expected: "Tab 1 shows the 'cleared in another tab' notice (Playtime.svelte:114) and a way back to import. It does not sit on 'Updating charts...'."
    why_human: "UAT test 5 passed pre-Phase 8. The notice and recovery path are part of the new section UI."
  - test: "Walk the 04-UI-REVIEW.md priorities (15 of 24 were reported as issues in UAT test 6) against the Phase 8 layout at 375px and 1280px."
    expected: "Weekday labels visible, tile numerals not broken, legend note on its own line, year head offset correct for the new layout."
    why_human: "UAT test 6 was recorded pre-Phase 8. Phase 8 changed the layout these findings were measured on."
    partial_evidence: "2026-10-11 walkthrough (Bohdan_Pavlenko approved) covered 375px and 1280px layout containment for the Playtime pane (no page-level horizontal scroll, 0 loose overflow elements, 0 console errors). It did not walk the specific UI-REVIEW priorities (weekday labels, tile numerals, legend note, year head offset). NOT resolved."
  - test: "Resolve or accept the five unresolved UAT entries: G-04-TDD-EVIDENCE, G-04-CI-TIME-LIMITS, G-04-IMPORT-FLOW-FLAKE, G-04-REVIEW-INFO-FINDINGS, G-04-SCRATCH-CONFIG."
    expected: "Each entry is closed by a person, or explicitly accepted as a known limitation. Nothing is marked resolved by the verifier."
    why_human: "Each is recorded as failed or open in 04-UAT.md. Resolution is a human decision."
---

# Phase 4: Activity Time Dashboards - Verification Report

**Phase Goal:** User can see how much and when they played: lifetime totals, a year-by-year calendar, a weekly rhythm, and typical session lengths. The charts hold up on a decade-long account.
**Verified:** 2026-10-11T12:47:57Z
**Status:** passed
**Re-verification:** Yes. The 2026-10-02 `passed` report is stale: the covered source moved under Phase 8 and the UAT file gained open entries. This pass re-derived every truth from the current tree. It did not copy the old verdict.

## Evidence basis

| Gate or check | Result | Notes |
|---|---|---|
| Orchestrator unit gate (`g-unit.log`) | `UNIT_EXIT=0`, 87 files, 2794 passed | Final exit line present. Regression evidence only. |
| Orchestrator check gate (`g-check.log`) | `CHECK_EXIT=0`, 306 files, 0 errors, 0 warnings | Final exit line present. Regression evidence only. |
| Orchestrator e2e gate (`g-e2e.log`) | `E2E_EXIT=0`, 254 passed, 0 failed | Final exit line present. 33 log lines cover `tests/e2e/playtime/`, all passing, including `playtime-scale.spec.ts` (60,000 sessions). Regression evidence only. |
| Named unit run by this verifier | `pnpm exec vitest run` over 9 files: `playtime-model`, `playtime-charts`, `playtime-scale`, `playtime`, `playtime-client`, `focus-clear`, `contrast`, `chart-width`, `ingest-worker` | 9 files, 449 tests, all passed (exit 0). Log: `scratchpad/v4-named.log`. |
| Fingerprint | `gsd-tools query verification.fingerprint`, 76 covered files | Values copied verbatim into the frontmatter. |
| Playwright / full suite | Not run by this verifier, per instruction | Gate results above are the evidence. |

Mismatch: the prior report cited branch `gsd/phase-05-...` and HEAD `93a604e`. Neither is in the current history (HEAD is `ecf3440`). That report's evidence is void for this pass.

## Goal Achievement

### Observable Truths (ROADMAP success criteria, the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Summary shows total hours, total sessions, active days derived from Activity_history | VERIFIED | `src/lib/features/playtime/PlaytimeSummary.svelte` renders `data-testid="playtime-total-hours"` (line 100), `playtime-total-sessions` (107), and `playtime-active-days` (111) from `slice.dayIndex.length`. Unit tests in the named run pass. Phase 8 mounts the block from `Dashboard.svelte:274-275` (`active === 'playtime'`). Layout check is in human items. |
| 2 | Year-by-year calendar heatmap shows per-day activity, with a non-linear colour scale | VERIFIED | `rankScale` (`playtime-model.ts:287`) is the nearest-rank percentile scale, not min-max. Rendered by `CalendarHeatmap` (mounted at `PlaytimeCharts.svelte:172`) with one `<rect>` per day, which is per-bucket. Heavy-tail and contrast guards pass in the named run. Perceptual half is a human item. |
| 3 | Day-of-week x hour-of-day heatmap, timezone basis labelled | VERIFIED | `HourGrid` mounted at `PlaytimeCharts.svelte:208`, 168 cells from `buildHourGridModel` (`playtime-model.ts:745`). Caption `HOUR_GRID_BASIS_CAPTION` (`ui-copy.ts:805-806`) says the hours are "as recorded in the export (likely UTC or server time), not converted to your local time". `HOUR_GRID_BASIS` is `'overlap'`, decided by the owner on 2026-10-11 (see Warnings). |
| 4 | Session-duration distribution shows typical lengths | VERIFIED | `DurationList` mounted at `PlaytimeCharts.svelte:235`. `DURATION_BIN_COUNT = 12` (`playtime-shared.ts:64`), `buildDurationRows` (`playtime-model.ts:851`). Named unit tests pass. |
| 5 | 50k+ session / 10-15 year fixture renders without freezing; SVG node count scales with buckets | VERIFIED | `tests/unit/playtime/playtime-scale.test.ts` passes in the named run. E2E `playtime-scale.spec.ts` (60,000-session preset, node counts follow buckets, 12x sessions gives the same DOM) passed in `g-e2e.log`. No per-session SVG node exists: the only `{#each}` loops over data are per day (`CalendarHeatmap.svelte:559-561`), per hour cell (`HourGrid.svelte:401`), and per 12 bins (`DurationList.svelte:71`). This meets the AGENTS.md per-bucket rule. |

**Score: 5/5 roadmap criteria verified in code and gates. 0 FAILED. No behavior-unverified truths.**

### Requirements coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| ACTIVITY-01 (totals, sessions, active days) | 04-01, 04-02, 04-03, 04-04, 04-06, 04-08 and others | SATISFIED | Truth 1 above. REQUIREMENTS.md marks it Complete. |
| ACTIVITY-02 (calendar heatmap, per-day) | 04-05, 04-06, 04-10 and others | SATISFIED | Truth 2 above. |
| ACTIVITY-03 (day x hour heatmap, per-bucket) | 04-05, 04-09, 04-11 and others | SATISFIED | Truth 3 above. |
| ACTIVITY-04 (session-duration distribution) | 04-05, 04-09, 04-13 and others | SATISFIED | Truth 4 above. |

No orphaned requirements: the Phase 4 rows in REQUIREMENTS.md are exactly these four IDs, and each appears in a PLAN `requirements:` field.

### Gap-closure truths (04-17, 04-18) re-derived from current source

| Truth | Status | Evidence |
|---|---|---|
| Weekday labels fit the calendar gutter at 1280px and 375px | VERIFIED | `CALENDAR_LAYOUT` keeps `gutter: 40`, `labelPad: 4` (`playtime-model.ts:84-97`). The browser guard in `playtime-ui-review.spec.ts` passed in `g-e2e.log`. |
| 54-column calendar fits the 640px card (634px fixed width, 6px spare) | PASSED (override), superseded by Phase 8 (08-20, 08-21) | Phase 8 made chart width measured: `calendarLayoutFor(chartsWidth)` (`PlaytimeCharts.svelte:94`), with `CALENDAR_LAYOUT.width = 634` now the floor. The 640px card is no longer the constraint. The underlying 54-column no-clip property still holds at the floor. Accepted as an override by Bohdan_Pavlenko on 2026-10-11T13:52:49Z. |
| Focus correction scrolls the page up (cell moves down, out from under chrome) | VERIFIED (sign) | `focusScrollDelta` returns `Math.min(0, rect.top - requiredTop)` (`playtime-model.ts:1065`). `scrollClear` passes it through unchanged to `window.scrollBy` (`core/focus-clear.ts`). Behavioural tests: `tests/unit/core/focus-clear.test.ts` (named run, passed) and `playtime-ui-review.spec.ts` (gate, passed). |
| Focus correction clears the sticky nav | PASSED (override), superseded by Phase 8 | Phase 8 removed the sticky anchor nav. `STICKY_CHROME_SELECTOR` now matches nothing, so `navBottom = 0` (`core/focus-clear.ts`). `CalendarHeatmap.svelte:485-486` and `app.css:44` record "no sticky chrome over the content". The year-head clearance is still measured. Plan ids touching sticky/nav in their SUMMARY files: 08-01, 08-02, 08-03, 08-07, 08-12, 08-14, 08-15, 08-17, 08-18. Accepted as an override by Bohdan_Pavlenko on 2026-10-11T13:52:49Z. |
| Sticky year head height is measured, not a 32px literal | VERIFIED | `headHeightFor` returns `head.offsetHeight` (`CalendarHeatmap.svelte:394-399`) and is passed to `scrollClear`. |
| Tile numeral and unit never break mid-word at 375px | VERIFIED | `PlaytimeSummary.svelte`: `overflow-wrap: normal` on the value (line 238), `white-space: nowrap` on the unit (line 249). The `overflow-wrap: anywhere` occurrences left (274, 284, 326) are on untrusted-text cells. The e2e tile check passed in the gate. |
| Legend note on its own line, 8px under the swatch row | VERIFIED | `src/lib/charts/ChartLegend.svelte:68` (`gap: 8px 4px`) and `:113` (`flex-basis: 100%`). Moved from `src/lib/components/`. |

### Phase 8 supersession (per instruction, no new overrides)

The prior report carried `overrides_applied: 0`. On 2026-10-11T13:52:49Z the repo owner (Bohdan_Pavlenko) accepted both superseded 04-17 claims as overrides (frontmatter `overrides:`). Both rows above are PASSED (override).

## Required artifacts (current paths)

The prior report's `covered_files` used paths that no longer exist. Current locations, all present:

| Former path | Current path | Status |
|---|---|---|
| `src/lib/components/CalendarHeatmap.svelte` | `src/lib/features/playtime/CalendarHeatmap.svelte` | VERIFIED, mounted |
| `src/lib/components/ChartLegend.svelte` | `src/lib/charts/ChartLegend.svelte` | VERIFIED, used |
| `src/lib/components/DurationList.svelte` | `src/lib/features/playtime/DurationList.svelte` | VERIFIED, mounted |
| `src/lib/components/HourGrid.svelte` | `src/lib/features/playtime/HourGrid.svelte` | VERIFIED, mounted |
| `src/lib/components/MonthlyBarChart.svelte` | `src/lib/charts/MonthlyBarChart.svelte` | VERIFIED (Phase 5 consumer of `scrollClear`) |
| `src/lib/components/Playtime.svelte`, `PlaytimeCharts.svelte`, `PlaytimeSummary.svelte` | `src/lib/features/playtime/` | VERIFIED, mounted via `Dashboard.svelte:275` |
| `src/lib/focus-clear.ts` | `src/lib/core/focus-clear.ts` | VERIFIED |
| `src/lib/playtime-client.ts`, `playtime-model.ts`, `playtime-shared.ts`, `playtime-state.ts` | `src/lib/features/playtime/` | VERIFIED |
| `src/lib/worker/playtime.ts` | `src/lib/features/playtime/playtime-aggregate.ts` | VERIFIED. `ingest.worker.ts:32` imports `buildPlaytimeFromSources` from it. |
| `src/lib/ui-copy.ts`, `worker/db.ts`, `worker/ingest.worker.ts` | unchanged | VERIFIED |

Real-export fix (UAT G-04-1, resolved in plans 04-14/04-15): `playtime-aggregate.ts` accepts `{GAME}_Game_Sessions.csv` (game from the file name, basename matched). `STARTED_AT`/`FINISHED_AT` are aliases for `SESSION_START`/`SESSION_END` (lines 315-324). The `.xlsx` duplicate is ignored. This is present in source.

## Key link verification

| From | To | Via | Status |
|---|---|---|---|
| `Dashboard.svelte` | `features/playtime/Playtime.svelte` | import + `active === 'playtime'` (lines 20, 267-275) | WIRED |
| `Playtime.svelte` | `PlaytimeCharts.svelte` | mounted from the block | WIRED |
| `PlaytimeCharts.svelte` | `CalendarHeatmap`, `HourGrid`, `DurationList` | imports at lines 25, 28, 29 and render at 172, 208, 235 | WIRED |
| Charts | worker aggregate | `playtime-query` to `ingest.worker.ts:116` / `handlePlaytimeQuery` (line 176) | WIRED |
| `scrollClear` | `CalendarHeatmap`, `HourGrid`, `MonthlyBarChart` | three call sites | WIRED |

## Anti-patterns and debt markers

- Debt-marker gate: no `TBD`, `FIXME` or `XXX` in the Phase 4 source or tests. No `TODO`, `HACK` or `placeholder` in `features/playtime/` or `charts/`. Gate passes.
- Stub check: no empty-return or hardcoded-empty data on any rendered Phase 4 path. Summary tiles, calendar, hour grid and bins all derive from the worker slice.
- Scratch file: `playwright.scratch.config.ts` is absent from the repo root and `git status` is clean. UAT G-04-SCRATCH-CONFIG still records it as failed. Not marked resolved here.

## Warnings (not blocking)

1. **Superseded 04-17 claims** (two sub-items above). Accepted as overrides on 2026-10-11; no longer open.
2. **HOUR_GRID_BASIS decided: `'overlap'` (owner decision 2026-10-11, Bohdan_Pavlenko, answered in chat).** `playtime-shared.ts:41` is `'overlap'` and stays. Both bases are stored. No code change. `HOUR_GRID_BASIS_CAPTION` already describes the overlap basis. `HOUR_GRID_START_BASIS_NOTE` stays inert in the collapsed disclosure, so the Phase 8 review concern (moving it out under `'start'`) does not apply. No longer open.
3. **UAT file is internally inconsistent.** Frontmatter says `status: complete`, and the summary block says `passed: 60, issues: 0, pending: 0`. But the Gaps section has five entries that are not resolved (table below) plus G-04-HOUR-GRID-BASIS, now decided by the owner (its `status:` field in the UAT file is unchanged). The file was last updated 2026-10-02, before Phase 8 (`5ab3af2`). Its six human UAT passes were recorded against the pre-Phase 8 layout.
4. **UAT auto-passes** (54 entries) are derived from SUMMARY.md and are not behavioural evidence. They were not counted in this verdict.

## Unresolved UAT items (read from 04-UAT.md, not marked resolved; five remain)

| Gap ID | Recorded status | Summary |
|---|---|---|
| G-04-TDD-EVIDENCE | failed | `check tdd-red-evidence` parses node:test TAP and cannot read vitest 5 output. The git log shows the RED commits. |
| G-04-CI-TIME-LIMITS | failed | CI time limits (15/17/25 min) not validated against a real CI run. Local suite is about 41s. |
| G-04-IMPORT-FLOW-FLAKE | failed | `tests/e2e/import/import-flow.spec.ts:102` matches a hand-typed five-string pattern and misses a sixth form. Pre-existing, not Phase 4. |
| G-04-REVIEW-INFO-FINDINGS | open | 04-REVIEW.md info findings IN-1..IN-5 acknowledged or resolved. Out of scope for `critical_warning` fix scope. |
| G-04-SCRATCH-CONFIG | failed (file now absent) | UAT says `playwright.scratch.config.ts` should be deleted. It is not in the tree now. Left for a human to close. |

Decided (not in the table above): G-04-HOUR-GRID-BASIS, DECIDED: overlap, by owner Bohdan_Pavlenko on 2026-10-11 (see Warnings 2). Recorded here as an owner decision, not a verifier resolution.

Deferred follow-ups recorded in UAT (informational, not verified here): (a) hover outline on the calendar cell under the pointer (quick tasks 261001-2qr and 261001-36p exist; not checked against the Phase 8 layout), (b) reword test 2 expected text to forbid wall-clock time.

Resolved UAT gaps (recorded as resolved; re-checked against source above, not re-marked): G-04-1 (real-export Game_Sessions support, verified in source), G-04-5 (cleared-in-another-tab notice, `Playtime.svelte:114`), G-04-UI-1, G-04-UI-2, G-04-UI-3 (see the 04-17/04-18 table above).

## Human Verification Required

The `human_verification` frontmatter lists seven items (the HOUR_GRID_BASIS item was decided on 2026-10-11 and removed). Summary:
1. Populated Playtime block in the Phase 8 detail pane (UAT 1, pre-Phase 8).
2. Real session cell verbatim in its calendar tooltip (UAT 2, pre-Phase 8).
3. Calendar shading perception on a decade-long export (UAT 3).
4. 375px keyboard focus and year-head clearance in the new layout (UAT 4).
5. Second-tab cache clear and the notice (UAT 5).
6. UI-REVIEW findings re-walked on the Phase 8 layout (UAT 6).
7. Disposition of the five unresolved UAT entries.

### Visual walkthrough note (2026-10-11, partial coverage, nothing resolved)

Visual walkthrough accepted 2026-10-11 (accepted_by Bohdan_Pavlenko, approved in chat as "approved"): an agent drove the built app (preview build, headless Chromium) with a synthetic export (sessions, logins, all four player-stats titles, premium, currency, orders) at 1280x800, 1280x600 and 375x812 across all 8 panes. No page-level horizontal scroll at any size; elements past the right edge on phone (Playtime 265, Login history 40, Vehicles 42, Finance 65) all sit inside intentional scroll containers (0 loose); j/k moved Overview -> Playtime -> Overview on desktop at both heights; phone list -> detail with the Sections back control works on every pane; 0 console/page errors; 4 requests after load (page, JS, CSS, worker), 0 beyond baseline. Relevance to this phase: Playtime pane at all three sizes had no page-level horizontal scroll and no loose overflow (265 elements past the right edge on phone, all inside scroll containers).

- Partially informs item 1 (populated block in the detail pane) and item 6 (UI-REVIEW priorities at 375px and 1280px): layout containment only. Both stay open.
- Does NOT cover item 4: PageUp/PageDown and arrow keys on the calendar were not exercised, so focus-clear at 375px is unconfirmed.
- Does NOT cover items 2, 3 (real session cell, decade-long shading, synthetic data only), 5 (two-tab cache clear) or 7 (UAT entries). The former item 7, the HOUR_GRID_BASIS decision, was made by the owner on 2026-10-11 and is closed.

## Gaps Summary

No FAILED truth and no blocker. The phase goal (totals, calendar, weekday-hour rhythm, duration distribution, decade-scale rendering) is present in the current code, wired into the Phase 8 shell, and backed by passing unit and e2e gates.

Status is `human_needed`, not `passed`, for two reasons:
- The six human UAT passes predate the Phase 8 redesign, and the layout they tested no longer exists.
- Five UAT entries remain unresolved (HOUR_GRID_BASIS was decided 'overlap' by the owner on 2026-10-11). The two 04-17 claims superseded by Phase 8 were accepted as overrides on 2026-10-11 and are no longer open.

No `gaps:` list is emitted, because nothing is FAILED. Nothing in the UAT was marked resolved by the verifier.

---

_Verified: 2026-10-11T12:47:57Z_
_Verifier: Claude (gsd-verifier)_

Human validation (2026-10-12): owner confirmed all outstanding human items in chat ("All good"); status set to passed.
