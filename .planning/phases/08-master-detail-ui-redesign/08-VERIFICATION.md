---
phase: 08-master-detail-ui-redesign
verified: 2026-10-09T18:48:50Z
status: passed
score: 117/117 must-haves verified
covered_files: [".planning/phases/08-master-detail-ui-redesign/08-01-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-01-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-02-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-02-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-03-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-03-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-04-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-04-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-05-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-05-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-06-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-06-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-07-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-07-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-08-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-08-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-09-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-09-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-10-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-10-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-11-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-11-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-12-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-12-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-13-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-13-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-14-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-14-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-15-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-15-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-16-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-16-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-17-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-17-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-18-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-18-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-19-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-19-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-20-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-20-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-21-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-21-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-22-PLAN.md", ".planning/phases/08-master-detail-ui-redesign/08-22-SUMMARY.md", ".planning/phases/08-master-detail-ui-redesign/08-REVIEW-DISPOSITION.md", ".planning/phases/08-master-detail-ui-redesign/08-UAT.md", ".planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md", ".planning/quick/261008-x40-fix-top-3-phase-08-ui-review-issues/261008-x40-SUMMARY.md", ".planning/quick/261009-0qw-fix-top-3-phase-08-ui-re-review-issues/261009-0qw-SUMMARY.md", ".planning/quick/261009-qbo-fix-top-3-phase-08-ui-pass-3-review-issu/261009-qbo-SUMMARY.md", "src/App.svelte", "src/app.css", "src/lib/charts/ChartLegend.svelte", "src/lib/charts/ChartTooltip.svelte", "src/lib/charts/FlowLegend.svelte", "src/lib/charts/MonthlyBarChart.svelte", "src/lib/charts/MonthlyDataTable.svelte", "src/lib/charts/bar-chart-model.ts", "src/lib/charts/chart-width.ts", "src/lib/features/finance/CurrencyBlock.svelte", "src/lib/features/finance/PremiumBlock.svelte", "src/lib/features/finance/SpendSummary.svelte", "src/lib/features/logins/CityList.svelte", "src/lib/features/logins/CityOptIn.svelte", "src/lib/features/logins/CountryList.svelte", "src/lib/features/logins/LoginHistory.svelte", "src/lib/features/logins/LoginMapSection.svelte", "src/lib/features/logins/LoginSummary.svelte", "src/lib/features/logins/LoginTable.svelte", "src/lib/features/logins/WorldMap.svelte", "src/lib/features/playtime/CalendarHeatmap.svelte", "src/lib/features/playtime/DurationList.svelte", "src/lib/features/playtime/HourGrid.svelte", "src/lib/features/playtime/Playtime.svelte", "src/lib/features/playtime/PlaytimeCharts.svelte", "src/lib/features/playtime/PlaytimeSummary.svelte", "src/lib/features/playtime/playtime-model.ts", "src/lib/features/vehicles/BattleTypeSummary.svelte", "src/lib/features/vehicles/PlayerStats.svelte", "src/lib/features/vehicles/VehicleTable.svelte", "src/lib/shell/ConfirmPanel.svelte", "src/lib/shell/Dashboard.svelte", "src/lib/shell/DashboardSection.svelte", "src/lib/shell/DetailPane.svelte", "src/lib/shell/Dropzone.svelte", "src/lib/shell/ExcludedNotice.svelte", "src/lib/shell/FailureBanner.svelte", "src/lib/shell/IdentityHeader.svelte", "src/lib/shell/ImportBar.svelte", "src/lib/shell/ImportSummary.svelte", "src/lib/shell/ListPane.svelte", "src/lib/shell/Overview.svelte", "src/lib/shell/UnsupportedBlock.svelte", "src/lib/ui-copy.ts", "tests/e2e/_support/helpers.ts", "tests/e2e/finance/finance.spec.ts", "tests/e2e/logins/login-city.spec.ts", "tests/e2e/logins/login-history.spec.ts", "tests/e2e/logins/login-map.spec.ts", "tests/e2e/logins/login-table.spec.ts", "tests/e2e/playtime/playtime-charts.spec.ts", "tests/e2e/playtime/playtime-ui-review.spec.ts", "tests/e2e/shell/chart-fill.spec.ts", "tests/e2e/shell/dashboard.spec.ts", "tests/e2e/shell/master-detail-nav.spec.ts", "tests/unit/charts/about-disclosure.test.ts", "tests/unit/charts/bar-chart-components.test.ts", "tests/unit/charts/bar-chart-model.test.ts", "tests/unit/charts/chart-width.test.ts", "tests/unit/charts/contrast.test.ts", "tests/unit/guards/phase5-layout-guards.test.ts", "tests/unit/guards/phase8-shell-guards.test.ts", "tests/unit/guards/phase8-ui-review-guards.test.ts", "tests/unit/logins/login-blocks.test.ts", "tests/unit/playtime/playtime-charts.test.ts", "tests/unit/playtime/playtime-model.test.ts", "tests/unit/shell/ui-copy.test.ts"]
covered_digest: "v3:sha256:858a195d18185ced337aab9218647570b82117b5c3e088da6efd958e7b209daf"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 117/117
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  notes: "Third pass. Re-checks the phase after three quick tasks (261008-x40, 261009-0qw, 261009-qbo) that changed covered source after the 2026-10-08 pass at HEAD 10795cb. No gap was found. Status moves from passed to human_needed because those quick tasks changed the visual surface after the last human sign-off (see human_verification)."
advisory:
  - finding: "HOUR_GRID_START_BASIS_NOTE sits inside the collapsed 'About this hour grid' disclosure (PlaytimeCharts.svelte). It is inert while HOUR_GRID_BASIS is 'overlap'."
    category: other
    reason: "Carried from the 2026-10-08 pass. If HOUR_GRID_BASIS is ever set to 'start', the note would be collapsed by default. Keep a start-basis note outside the disclosure at that point, to respect Phase 4 D-01."
    evidence_status: "none provided (inert in the shipped build)"
human_verification:
  - test: "Serve the build (pnpm run build && pnpm run preview). Import the sample export and walk it at 1280x800, 1280x600 and 375x812: Overview, then each pane, then Start over with cancel, then a replace. Check the Login history pane with its Account record note and closed 'About this table' disclosure."
    expected: "Two panes at 1280 with the list footer (Start over, Clear my cached data, dropzone) still visible at 1280x600. Body and control text reads as the 14px scale with no clipping. Confirm panel: Escape cancels and returns focus to Start over. At 375, list screen then detail screen with the back button, nothing scrolls sideways, and no control boundary looks lost. Palette reads as white page, ink chrome, selected row darker than hover, data ramp unchanged."
    why_human: "Visual fidelity and perceived readability (type scale, grey-token shifts, sticky footer feel) cannot be read from computed CSS. The last approved walkthrough (08-22 Task 3, and UAT 2026-10-08) predates the three 2026-10-09 quick tasks that changed the visual surface."
---

# Phase 8: Master-detail UI redesign Verification Report

**Phase Goal:** Replace the single-scroll dashboard and its anchor nav with a two-pane master-detail layout, without changing what any section computes or shows. A list of sections on the left (Overview first, then Playtime, Login history, Vehicles, Finance, Payments, Account, and a "Not yet supported" footer row; unavailable sections muted) and one section's detail on the right; Overview is the default landing view (status chips plus one summary card per section). `j`/`k` and arrow keys move the selection; on phone, list screen then detail screen with a back control. Selection is component state, never a route. Palette "Day 10, ink + teal": white page, neutral ink chrome, selected row distinct from hover, data keeps the existing teal `--ramp-*` unchanged.
**Phase Requirement IDs:** none declared (all 22 PLAN files carry `requirements: []`; REQUIREMENTS.md has no Phase 8 rows).
**Verified:** 2026-10-09T18:48:50Z
**Status:** human_needed
**Re-verification:** Yes. Third pass, after the 2026-10-08 pass (`passed`, HEAD 10795cb) went stale. Covered source changed in three quick tasks since then.
**HEAD at verification:** cb78400 (branch gsd/phase-08-master-detail-ui-redesign)

## Verdict

The phase goal is achieved in the codebase. Every observable truth in the goal is present and wired, and the post-verification quick tasks did not regress it: each of their claims was checked against the code, not against their SUMMARY files. No BLOCKER and no FAILED must-have. Status is `human_needed` for one reason: the three quick tasks changed the visual surface (type scale, grey tokens, sticky footer, disclosure, confirm-panel focus) after the last human walkthrough, so one scoped visual re-check is requested. If the user accepts the automated evidence for those visual changes, the status can be set to `passed`.

One WARNING: a browser test (`finance charts fill the detail pane`) failed once in two targeted runs at 375px. It is intermittent, and the offender is a floating tooltip overlay, not pane layout (see Warnings).

## Scope of this pass

- Read all 22 PLAN files for intent and must-haves; read the three quick-task PLAN and SUMMARY files; read 08-UAT.md, 08-UI-SPEC.md (Amendments A-1 to A-4), 08-REVIEW-DISPOSITION.md and the prior 08-VERIFICATION.md.
- Re-derived the phase-goal truths and the quick-task claims from source (grep and file reads), not from SUMMARY claims.
- Ran this pass: `pnpm run test:unit` (86 files, 2646 tests, pass); `pnpm run check` (305 files, 0 errors, 0 warnings); `pnpm run lint` (Prettier and ESLint clean); Playwright `chart-fill.spec.ts`, `master-detail-nav.spec.ts` and `login-history.spec.ts` on chromium, workers=2 (run 1: 31 of 32 pass, 1 intermittent failure; run 2: 32 of 32 pass); `chart-fill.spec.ts` finance test alone, 3 repeats (3 of 3 pass).
- Not re-run in this pass: the full Playwright suite. The 254-of-254 result reported by the three quick tasks is cited as supplied evidence, not re-observed here.
- The 113 must-haves from the 2026-10-08 pass were carried forward and regression-checked through the test results and the code areas the quick tasks touched. They were not re-derived line by line. This is stated plainly so the 117/117 count is not read as a fresh line-by-line proof.

## Goal Achievement

### Observable Truths (phase goal)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Two-pane master-detail replaces the single-scroll dashboard and its anchor nav | VERIFIED | `Dashboard.svelte` renders one section per `{#if active === ...}` branch (lines 265 to 302+). The only in-page link is the skip link `href="#detail"` in `ListPane.svelte:123`, whose click is `preventDefault`ed and routed to a focus call (`onSkip`). No `href="#section"` nav links remain. |
| 2 | List order: Overview, Playtime, Login history, Vehicles, Finance, Payments, Account, then "Not yet supported" | VERIFIED | `selection-state.ts` `PANE_IDS` (lines 56 to 65) is exactly that order, with `not-yet-supported` last. `paneEntries` maps over `PANE_IDS` in that order. |
| 3 | Unavailable sections are muted | VERIFIED | `paneEntries` sets `muted` from the dashboard-status folder state (`muted = state?.muted ?? true`). `ListPane.svelte` applies `class:muted={entry.muted}` (line 150), and `.row.muted .title` and `.row.muted .headline` use `var(--muted)` (lines 302 to 304). |
| 4 | Overview is the default landing view, with status chips and one summary card per section | VERIFIED | `DEFAULT_PANE = 'overview'` (`selection-state.ts:71`). `Overview.svelte` renders three chips (`ov-chip-with-data`, `ov-chip-absent`, `ov-chip-unsupported`) and one `ov-card-{id}` per entry from `overviewCards`. |
| 5 | `j`/`k` and arrow keys move the selection | VERIFIED | `ListPane.svelte:95-96` maps `j`/`ArrowDown` to +1 and `k`/`ArrowUp` to -1. `stepSelection` steps from the focused row (lines 105 to 111). Keys act only on a row, and modified keys are ignored. `master-detail-nav.spec.ts` (keyboard, lifecycle tests) passed in both targeted runs. |
| 6 | Phone: list screen, then detail screen with a back control | VERIFIED | `DetailPane.svelte` renders a phone top bar with `data-testid="back-button-sections"` when `showBack` is set. `Dashboard.svelte:246-247` sets `showBack={result !== null}` and `onback={back}`. UAT tests 2 and 5 (phone list/detail, back, Start over) passed on 2026-10-08. |
| 7 | Selection is component state, never a route | VERIFIED | `package.json` has no router dependency. No `pushState`, `replaceState`, `location.hash` write or `hashchange` listener in `src`. `ListPane.svelte` states it never writes `location.hash`. `selection-state.ts` is a pure module. |
| 8 | Palette: white page, neutral ink chrome, selected row distinct from hover | VERIFIED | `app.css`: `--page: #ffffff`, `--ink: #111111`, `--sel: #e0e0e0` (selected row), `--hover: #ececec` (hover). The selected and hover values differ, and the selected row uses `--sel` while hover uses `--hover`. |
| 9 | Data keeps the teal `--ramp-*` unchanged | VERIFIED | `app.css` `--ramp-0` to `--ramp-5` present and unchanged (`git diff 10795cb HEAD -- src/app.css` shows no `ramp` line). |
| 10 | Sections compute and show what they did before ("without changing what any section computes or shows") | VERIFIED | Unit suite 2646 pass, including `playtime-model`, `login-blocks`, `contrast` and the guard suites. The quick tasks moved and styled presentation only (login note placement, disclosure wrapper with unchanged text, colour tokens, footer). No model or worker change in `git diff 10795cb HEAD -- src` beyond presentation and the listed behaviour fixes. |
| 11 | G-08-3 (carried from the prior pass): charts fill the detail pane, Finance notes wrap | VERIFIED | `MonthlyBarChart.svelte` and `PlaytimeCharts.svelte` measure with `bind:contentRect`. `chart-fill.spec.ts` asserts the calendar and hour-grid scrollers equal their svg within 1px at 1280 and 2400 (lines 203 and 210). Finance test passed 3 of 3 alone and in one of two targeted runs (see Warning 1). |

**Score:** 117/117 must-haves verified (113 carried and regression-checked, 4 G-08-3 truths). Behavior-unverified: 0. The quick-task claims are checked separately below and are not counted in the score.

## Quick-task claims (checked against code)

| Quick task | Claim | Check | Status |
| ---------- | ----- | ----- | ------ |
| 261008-x40 | Off-token greys and blue removed | Remaining hex literals in `src` are the status set (`#c5221f`, `#fce8e6`, `#8a1c17`, `#f5d4d1`, `#f9ab00`, `#fef7e0`, `#8a5a00`), white SVG strokes and tooltip text (`#ffffff`), and spinner `rgba(26,115,232,...)`. These are the allow-listed categories in A-4. `#1a73e8` appears only as the `--focus` declaration in `app.css`. | VERIFIED |
| 261008-x40 | Type scale 14/18/26/30 | `font-size` values under `src` are only 14px (141), 18px (8), 26px (4), 30px (3). Root is 14px (`app.css:13`). Control rule `button, input, select, textarea { font-size: 14px }` at `app.css:109-112`. | VERIFIED |
| 261008-x40 | Sticky list-pane footer at 900px and up | `app.css` `@media (min-width: 900px)` block: `.pane-list .import-region { position: sticky; bottom: 0; background: var(--list) }`. | VERIFIED |
| 261009-0qw | One phone-width block | `@media (max-width: 480px)` appears once under `src`, at `app.css:249`. The other breakpoints (`min-width: 900px` at 151, `max-width: 899px` at 177) are the layout split, not phone rules. Only other `@media` hits are `prefers-reduced-motion`. | VERIFIED |
| 261009-0qw | Account record note above the Login history table | `LoginHistory.svelte:423` renders `login-account-note`, then `LoginTable` at line 425. The note precedes the table. | VERIFIED |
| 261009-0qw | Empty-state heading in ink | `IdentityHeader.svelte` `.skeleton-title` uses `color: var(--ink)` (rule at line 136 to 142, shared with `.nickname`). | VERIFIED |
| 261009-0qw | Keyboard selection equals focus per key | `ListPane.svelte` steps from `current` (focused row). `master-detail-nav.spec.ts` passed in both targeted runs. | VERIFIED |
| 261009-qbo | "About this table" disclosure with the table hints | `ABOUT_NAME_LOGIN_TABLE = 'table'` (`ui-copy.ts:3094`). `LoginHistory.svelte:435` wraps the hints in `AboutDisclosure name={ABOUT_NAME_LOGIN_TABLE} testId="about-login-table"`, after the table. | VERIFIED |
| 261009-qbo | City opt-in intro stays visible | `CityOptIn.svelte:269` renders `city-intro` as a caption. No `details` element in that file. | VERIFIED |
| 261009-qbo | One persistent polite announcer, mounted once before every branch | `App.svelte:266-270`: `<p class="notice-announcer" role="status" aria-live="polite" aria-atomic="true" data-testid="notice-announcer">`, placed before the conditional blocks. Only one announcer in `App.svelte`. | VERIFIED |
| 261009-qbo | Confirm panel: Escape cancels, Tab wraps, focus returns | `ConfirmPanel.svelte` `onKeydown` on the panel root: Escape calls `oncancel()`, Tab/Shift+Tab wrap between the two buttons. `App.svelte` `onCancelConfirm` returns focus to `confirmTrigger` (or the dropzone); `onConfirmPending` focuses the dropzone after a confirmed replace. | VERIFIED |
| 261009-qbo | Colour-literal guard across all of `src` | Guard test `phase8-ui-review-guards.test.ts` passes in the 2646-test unit run. The remaining literals are the allow-listed categories above. | VERIFIED |

## UAT and UI-SPEC consistency

- **08-UAT.md**: `status: complete`, 5 of 5 pass, 0 issues, 0 pending. The G-08-3 gap is `resolved` with `resolved_by: [08-20, 08-21, 08-22]`. The chart-width and overflow behaviour it describes matches the code (A-1 measured width, the 4px ring pad, the 1px fill edge).
- UAT predates the quick tasks (`updated 2026-10-08T19:27`). Its test 1 (list pane look), test 3 (cards and phone stacking) and test 5 (walkthrough) describe surfaces the 2026-10-09 quick tasks restyled. Those surfaces are now checked by source and by the targeted specs above, not by a human. See human_verification.
- **UI-SPEC amendments** (08-UI-SPEC.md, lines 425 to 510): A-1 (measured chart width) matches `chart-width.ts` (`CHART_RING_PAD_PX = 4`), the 32px bar cap (`bar-chart-model.ts:162`) and the heatmap pitch caps (`CALENDAR_MAX_ROW_PITCH_PX = 24`). A-2 (type base, tokens, sticky footer) matches the root font, control rule, token use and sticky footer above. A-3 (login note placement, one phone block, keyboard, empty-state ink) matches LoginHistory, `app.css` and IdentityHeader. A-4 (disclosure, city intro, announcer, confirm panel, colour guard) matches the code above.

## Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/shell/selection-state.ts` | Pane order, default Overview, muted state | VERIFIED | `PANE_IDS`, `DEFAULT_PANE`, `paneEntries` |
| `src/lib/shell/ListPane.svelte` | List with keys, muted rows, skip link without hash | VERIFIED | Keys at lines 87 to 111, `class:muted` at 150 |
| `src/lib/shell/DetailPane.svelte` | Phone top bar with back control | VERIFIED | `back-button-sections` at line 87 |
| `src/lib/shell/Overview.svelte` | Chips and one card per section | VERIFIED | Chips at 46 to 50, cards at 55 to 67 |
| `src/App.svelte` | One persistent announcer, confirm focus handling | VERIFIED | Announcer at 266 to 270; focus handling at 208 to 255 |
| `src/lib/shell/ConfirmPanel.svelte` | Escape, Tab wrap, safe button focused on open | VERIFIED | `onKeydown` at 34 to 53; `onMount` focuses cancel |
| `src/lib/features/logins/LoginHistory.svelte` | Note above table, About disclosure after table | VERIFIED | Lines 423, 425, 435 |
| `src/app.css` | Tokens, root 14px, one phone block, sticky footer | VERIFIED | Lines 13, 25 to 37, 63 to 68, 109 to 112, 151 to 175, 249 |
| `tests/e2e/shell/chart-fill.spec.ts` | Fill and overflow proof, hour grid included | VERIFIED | Calendar (lines 203, 210 for hour grid) and finance tests; finance test intermittent (Warning 1) |

## Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `ListPane` keydown | `onselect` / `openSection` | `onNavKeyDown` steps and calls `onselect` | WIRED | `ListPane.svelte:84-111` |
| `App` announcer | `notice` derived state | `announcement` derived from `notice` | WIRED | `App.svelte:188-266` |
| `ConfirmPanel` Escape | `App.onCancelConfirm` | `oncancel` prop | WIRED | Trigger focus restored |
| `Dashboard` phone back | `back()` | `onback` prop on `DetailPane` | WIRED | `Dashboard.svelte:246-247` |
| `PlaytimeCharts` root | `calendarLayoutFor`, `hourGridLayoutFor` | `chartsRect` then `chartsWidth` | WIRED | Carried from 2026-10-08 pass; unchanged |

## Data-Flow Trace (Level 4)

Not re-run for this pass. The quick tasks changed presentation, placement and focus behaviour only. The data each section computes is covered by the unit suite (2646 pass) and by `tests/unit/playtime/*`, `tests/unit/logins/*` and the regression suites.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Unit suite (all) | `pnpm run test:unit` | 86 files, 2646 tests passed | PASS |
| Type check | `pnpm run check` | 305 files, 0 errors, 0 warnings | PASS |
| Format and lint | `pnpm run lint` (Prettier check, ESLint) | Clean | PASS |
| Fill, keyboard, nav, login specs | `pnpm exec playwright test tests/e2e/shell/chart-fill.spec.ts tests/e2e/shell/master-detail-nav.spec.ts tests/e2e/logins/login-history.spec.ts --project=chromium --workers=2` | Run 1: 31 of 32 passed (finance overflow flake). Run 2: 32 of 32 passed. | PASS (with WARNING) |
| Finance fill test in isolation | `... chart-fill.spec.ts -g "finance charts fill" --repeat-each=3 --workers=1` | 3 of 3 passed | PASS |
| Manifests unchanged since prior pass | `git diff --name-only 10795cb HEAD -- package.json pnpm-lock.yaml playwright.config.ts` | No output (not in the changed-file list) | PASS |
| Debt markers in changed files | grep TODO, FIXME, XXX, HACK, PLACEHOLDER | No debt markers (only the word "placeholder" in comments) | PASS |
| Network surface | grep `fetch(`, XHR, WebSocket, sendBeacon in `src` | One `fetch` in `src/lib/geo/city-fetch.ts`, the sanctioned opt-in city file. Nothing else. | PASS |

## Probe Execution

No probes declared for this phase.

## Requirements Coverage

No requirement IDs are declared. All 22 PLAN files have `requirements: []`. REQUIREMENTS.md has no Phase 8 rows, so there are no orphaned IDs.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `tests/e2e/shell/chart-fill.spec.ts` | 40-108 | `paneOverflow` counts a floating `finance-tooltip` overlay as pane-content overflow | Warning | Intermittent failure (Warning 1). Test-design issue, not layout. |
| `src/lib/shell/ListPane.svelte` | 123 | `href="#detail"` skip link | Info | Click is `preventDefault`ed and routed to a focus call. No hash is written, so it is not a route. |
| `src/lib/charts/bar-chart-model.ts` | - | Fixed 40-node frame allowance | Info | Carried from the prior pass. Legacy path only, not reachable by the shipped data window. |

## Warnings

**Warning 1. Intermittent failure of `finance charts fill the detail pane` (chart-fill.spec.ts:122).** In the first targeted run at 375px it reported `finance-tooltip right 367.2 > edge 359.0`. The tooltip is a `ChartTooltip` overlay rendered only while open. It follows the pointer and sits inside the 375px viewport (right edge 367.2 is under 375). `paneOverflow` does not exclude overlays, so a tooltip left open by a pointer over a bar after a resize can trip it. The same run passed 32 of 32 on repeat. The test passed 3 of 3 alone. The same signature was logged as load-sensitive in the 261009-qbo summary. Not a layout regression, but a flaky must-have check. Suggested test-only fix (not made here, since source and tests were out of scope): exclude `[data-testid$="tooltip"]` from `paneOverflow`, or move the pointer off the charts before measuring.

**Warning 2. Visual surface changed after the last human sign-off.** Addressed by the human_verification item below.

**Resolved since the prior pass.** The prior Warning 1 (no browser assertion for the hour-grid fill) is closed: `chart-fill.spec.ts` now asserts the hour-scroller gap at lines 203 and 210 (added by commit 6e9bfb5).

## Human Verification Required

### 1. Post-quick-task visual re-check at 1280, 800 and 375

**Test:** Run `pnpm run build && pnpm run preview`. Import the sample export and walk it at 1280x800, 1280x600 and 375x812: Overview, then each pane, then Start over with cancel, then a replace. Open Login history and check the Account record note and the closed "About this table" disclosure.
**Expected:** At 1280 the two panes show, and the list footer (Start over, Clear my cached data, dropzone) stays visible at 1280x600. Body and control text reads at the 14px scale with no clipping. Start over: Escape cancels and returns focus to Start over. At 375 the list screen then the detail screen with a back button, nothing scrolls sideways, and no control boundary looks lost. The palette reads as white page, ink chrome, a selected row darker than hover, and a data ramp unchanged from the approved look.
**Why human:** Visual fidelity and perceived readability (type scale, grey-token shifts, sticky footer feel) cannot be read from computed CSS. The last approved walkthrough (08-22 Task 3, and UAT 2026-10-08) predates the 2026-10-09 quick tasks.

### Prior human-verification items (preserved, status)

| # | Prior item (2026-10-08 pass) | Status |
| - | ---------------------------- | ------ |
| 1 | List pane visual fidelity at 1280 (08-04 check 1) | Closed: UAT test 1 pass (2026-10-08). Re-check requested under item 1 above. |
| 2 | Phone focus geometry, Start over confirm at 375 (08-04 check 2) | Closed: UAT test 2 pass. Re-check requested under item 1 above. |
| 3 | Overview card density and hover at 1280 and 375 (08-05) | Closed: UAT test 3 pass. Re-check requested under item 1 above. |
| 4 | Tile numerals at 1280 and 375 (08-06) | Closed: UAT test 4 pass. |
| 5 | Full walkthrough at 1280, 800, 375 with focus and replace (08-19) | Closed: UAT test 5 pass. Re-check requested under item 1 above. |
| G-08-3 | Finance and Playtime charts fill the pane; notes wrap (UAT test 3) | Closed: plans 08-20 to 08-22, user-approved manual walkthrough (08-22 Task 3). |

## Carried Advisory (Code Review, Not Gaps)

Per `08-REVIEW-DISPOSITION.md`. None of these is a plan must-have, and none changes the status alone.

- Fixed since the prior pass: CR-01 (commit f850682, from the earlier pass); WR-01 (persistent announcer, checked); WR-04 (A-2 sticky footer, pinned at 1280x600); WR-05 (Escape, focus trap and focus return, checked); IN-02 (colour guard over all of `src`, checked).
- Still open: WR-02 (chart key handlers ignore modifier keys, which swallows browser Back and Forward), WR-03 (list routing keys off `data-testid`), IN-01 (dead smooth-scroll suspension and stale nav comments), IN-03 to IN-08 (guard-scope gaps and minor cleanups, including the duplicate region names on the phone detail screen).

## Regression Check

The 113 prior must-haves are carried forward. The quick-task changes touched the shell (ListPane, DetailPane, ConfirmPanel, App announcer), Login history, the tokens and the phone block. These are covered by the unit suite (2646 pass), the targeted specs (31 to 32 of 32 pass), and the direct checks in the quick-task table. Changed-file grep found no debt markers and no new network surface.

## Gaps Summary

No gaps. No must-have is FAILED, and no BLOCKER was found. Status is `human_needed` because of the single visual re-check item. The Finance tooltip flake is a WARNING on test design and does not block.

---

_Verified: 2026-10-09T18:48:50Z_
_Verifier: Claude (gsd-verifier)_

## Acknowledged Gaps

- 2026-10-09: the visual re-check after quick tasks 261008-x40, 261009-0qw and 261009-qbo (sticky footer at 1280x600, 14px type, 375px flow) was not walked by a human. The user accepted the automated evidence (2646 unit tests, 254 Playwright tests, targeted specs) and set status to passed. A lighter visual check is deferred.
