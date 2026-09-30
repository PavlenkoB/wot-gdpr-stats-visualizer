---
phase: 04-activity-time-dashboards
verified: 2026-10-01T03:05:00Z
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
  - .planning/quick/261001-2qr-add-hover-outline-to-calendar-heatmap-ce/261001-2qr-PLAN.md
  - .planning/quick/261001-2qr-add-hover-outline-to-calendar-heatmap-ce/261001-2qr-SUMMARY.md
  - .planning/quick/261001-36p-add-pointer-hover-outline-to-weekday-x-h/261001-36p-PLAN.md
  - .planning/quick/261001-36p-add-pointer-hover-outline-to-weekday-x-h/261001-36p-SUMMARY.md
  - src/lib/components/CalendarHeatmap.svelte
  - src/lib/components/DurationList.svelte
  - src/lib/components/HourGrid.svelte
  - src/lib/components/Playtime.svelte
  - src/lib/components/PlaytimeCharts.svelte
  - src/lib/components/PlaytimeSummary.svelte
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
  - tests/unit/playtime-charts.test.ts
  - tests/unit/playtime-scale.test.ts
covered_digest: "v1:sha256:cfca7584fa80fda454dbe8cb478e94c4f70a8ff196fcb89e9b96742fe512c298"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "5/5 roadmap criteria (criterion 2 split: computable verified, perceptual unverified)"
  gaps_closed:
    - "Human check 1 (real export populates the block) - FAILED on first real-export UAT (G-04-1), closed by plans 04-14/04-15, re-tested PASS by a human on a real export"
    - "Human check 2 (timestamp shape A2) - the real shape is DD.MM.YYYY HH:MM, now parsed day-first; covered by unit oracle tests and the real-shape e2e"
    - "Human check 3 (calendar shade perception) - UAT test 3 PASS on the synthetic 60k zip"
    - "Human check 4 (year-head clearance at 375px) - UAT test 4 PASS on the synthetic 60k zip"
    - "Human check 5 (WR-1/WR-2) - WR-1/WR-2 fixed in 04-REVIEW-FIX.md; WR-2 two-tab flow re-tested PASS on a real export after G-04-5 (04-16)"
  gaps_remaining: []
  regressions: []
---

# Phase 4: Activity Time Dashboards - Verification Report

**Phase Goal:** User can see how much and when they played: lifetime totals, a year-by-year calendar, a weekly rhythm, and typical session lengths. The charts hold up on a decade-long account.
**Verified:** 2026-10-01T03:05:00Z
**Status:** `passed`
**Re-verification:** Yes. The prior report (2026-09-30T09:05Z, `human_needed`) covered plans 04-01..04-13 only. This pass covers HEAD (6ee66ae) including gap-closure plans 04-14/04-15/04-16 and quick tasks 261001-2qr and 261001-36p.
**Must-haves source:** the five ROADMAP success criteria (the contract), plus the prior report's plan-level truths, plus the two gap-closure gaps (G-04-1, G-04-5) and the hover-ring additions.

---

## Evidence basis (what I ran vs. what I read)

| Kind | Items |
|------|-------|
| **Ran by me, this pass** | `pnpm run lint`, `pnpm run check`, `pnpm run test:unit`, full `pnpm exec playwright test` (Chromium launched normally in this session, so the e2e suite was NOT sandbox-blocked for me), `pnpm exec playwright test tests/e2e/playtime-scale.spec.ts`, source greps for the IP column, debt markers and network APIs, and `verification.fingerprint` |
| **Read, not re-run** | `04-UAT.md` (human, 59/59 passed, 0 issues; tests 1 and 5 on a REAL export, tests 2-4 on the synthetic 60k zip), `04-GAPCLOSURE-VERIFICATION.md` (PASS) and `04-GAPCLOSURE-REVIEW.md` (APPROVE), the two quick-task SUMMARYs |
| **Not done, by instruction** | I did not open `tests/fixtures/private/` and saw no real-export contents. The real-export evidence is the human UAT record only. |

The gap-closure verification's "e2e UNVERIFIED (Chromium cannot launch under the macOS sandbox)" caveat is **superseded by my own run**: 120 Playwright tests passed here.

## Commands run

| Command | Result |
|---------|--------|
| `pnpm run lint` (`prettier --check . && eslint .`) | exit 0, "All matched files use Prettier code style!" The prior report's 153-error `.kilo/worktrees` artefact did not reproduce; `.kilo` exists but `pnpm run lint` is clean now. |
| `pnpm run check` (`tsc -b`) | exit 0 |
| `pnpm run test:unit` | **884 passed, 27 files** (3.60 s). Matches the quick-task SUMMARYs' claim exactly. |
| `pnpm exec playwright test --list` | Total: 120 tests in 12 files |
| `pnpm exec playwright test` | **120 passed (40.6 s)**, 0 failed, 0 flaky |
| `pnpm exec playwright test tests/e2e/playtime-scale.spec.ts` | 5 passed (6.7 s) |

Unit and e2e were run sequentially, never concurrently.

---

## Goal Achievement

### Observable Truths (the 5 ROADMAP success criteria)

| # | Truth (ROADMAP contract) | Verdict | Decisive evidence |
|---|--------------------------|---------|-------------------|
| 1 | A summary shows total hours played, total sessions, and active days derived from Activity_history | VERIFIED | `PlaytimeSummary.svelte` renders the three tiles from the slice; the scale e2e (ran, 5/5 pass) asserts the rendered values equal the fixture's closed-form answer key at 71,843 usable sessions. **Real-export half:** UAT test 1 (human, real export) - populated block from the per-game files, WOT tile 4,960 h / 4,200 sessions / 1,190 active days (UAT test 5 note). This closes the real-export hole the prior report flagged: before 04-14 a real export hit the no-session-file empty state. |
| 2 | Year-by-year calendar heatmap shows per-day activity; colour scale keeps ordinary days distinguishable despite outliers (not linear min-max) | VERIFIED | Computable half: `rankScale` is a nearest-rank percentile scale (20/40/60/80 cuts over non-zero days), heavy-tail property pinned in `tests/unit/playtime-model.test.ts`, ramp monotonic with >=1.25:1 adjacent contrast in `tests/unit/contrast.test.ts`; all in the 884-test green run. Perceptual half, previously unverified: UAT test 3 (human) - Tue Oct 23, 2018 (39.7 h) renders darkest and ordinary days show distinct shades. The hover ring added by 2qr is covered by e2e (see below). |
| 3 | Day-of-week x hour-of-day heatmap with the timezone basis explicitly labeled | VERIFIED | `PlaytimeCharts.svelte` emits `<p class="caption">{HOUR_GRID_BASIS_CAPTION}</p>` (rendered, not just declared); 168 cells from `buildHourGridModel`. Real-shape timestamps are bucketed from `wallClockSeconds` with no `Date`/zone conversion (read in `src/lib/worker/playtime.ts`), so the "as recorded in the export" label is the truthful basis. Hover ring on this grid (36p) passes its 18-test e2e file. |
| 4 | Session-duration distribution shows typical session lengths | VERIFIED | `DurationList.svelte` renders 12 bins; scale test asserts bin counts sum exactly to the Sessions tile at 5,983 and 71,843. |
| 5 | With a 50k+ session / 10-15 year fixture every chart renders without freezing; SVG node count scales with buckets | VERIFIED | Ran: `playtime-scale.spec.ts` 5/5. Node count is measured-vs-measured across two browser contexts (12x the sessions, same DOM), hard ceiling far below one-node-per-session, and no main-thread long task >= 1,000 ms. Unit twin asserts equal `calendar.cellCount` (4,748) at 5k and 60k through the real pipeline. Hover-ring overlays added after the prior report are a single overlay element per chart, not per-cell, and the scale spec still passes against HEAD. |

**Score: 5/5 roadmap criteria verified.** No criterion is split or carried as unverified any more.

### Additional criterion checked on request: the IP column is never rendered in Phase 4

**VERIFIED.** Three independent lines of evidence:

1. **Source.** A case-insensitive grep of `src/` for `\bip\b`, `ip_address`, `ipaddress`, `'IP'`/`"IP"` and dotted-quad literals, excluding comment lines, returns **zero matches**. The only mentions of `IP` in `src/lib/worker/playtime.ts` are the header comment block (lines 15-30) documenting T-04-01 "the IP column is never read".
2. **Code path.** `resolveSessionColumns` (`playtime.ts`) names exactly four targets: `SESSION_START`/`STARTED_AT`, `SESSION_END`/`FINISHED_AT`, `SERVER_NAME`, `CLIENT_PLATFORM`. `IP` is not a target, not a split candidate (`SPLIT_COLUMNS = GAME, SERVER_NAME, CLIENT_PLATFORM`), and the `GAME` value comes from the zip entry file name, never a cell. The gap-closure verification's independent trace agrees and I re-confirmed its structural claims against the current source.
3. **Behavioural tests, all in the green runs.** `tests/e2e/playtime-real-shape.spec.ts:162` and `:287` assert the page HTML does **not** contain the real-shape fixture's IP (both before and after selecting a game); `tests/e2e/playtime-charts.spec.ts:466` asserts the calendar tooltip never shows the address; `tests/e2e/import-flow.spec.ts:474` asserts `192.0.2.10` is absent from the page body; `tests/unit/playtime.test.ts` asserts changing or removing the IP changes nothing. Fixtures use RFC 5737 TEST-NET addresses only.

### Gap-closure goals re-checked against HEAD

| Gap | Check | Verdict |
|-----|-------|---------|
| **G-04-1** real per-game session files | `playtime-shared.ts`: `PLAYTIME_VERSION = 2`, `SplitColumn = 'GAME' | 'SERVER_NAME' | 'CLIENT_PLATFORM'`, `SPLIT_COLUMNS` leads with `GAME`. `playtime.ts`: `STARTED_AT`/`FINISHED_AT` aliases (`:323-324`), `DOTTED_TIMESTAMP_RE` with destructuring `dotted[1]=DD, [2]=MM, [3]=YYYY` (`:164-171`, day-first, no month/day swap), per-source header resolution. `tests/e2e/playtime-real-shape.spec.ts` passes inside the 120. UAT test 1 re-tested PASS by a human on a real export (selector present, populated block). | VERIFIED |
| **G-04-5** cache-cleared notice | `isCacheClearedElsewhere` in `playtime-state.ts:205` (pure), used at `Playtime.svelte:181`, rendered as a `role="alert"` notice (`data-testid="playtime-cache-cleared"`, `:350`). Covered by the e2e suite that passed. UAT test 5 re-tested PASS on a real export: the amber notice appears and the block stays on WOT with no stuck `Updating` state. | VERIFIED |
| **WR-1 / WR-2** (the prior report's open code-review warnings) | `04-REVIEW-FIX.md` status `all_fixed`, each with a proven-failable e2e + unit test; both named e2e tests are in the green 120. | VERIFIED |
| **Quick 2qr / 36p** hover rings | `CalendarHeatmap.svelte` and `HourGrid.svelte` render a `{#if hoverCell !== null}` overlay ring (two-tone, not gated on keyboard focus, pointer-events none). Pinned by e2e lifecycle, keyboard-independence and corner tests in `tests/e2e/playtime-charts.spec.ts` (18 tests) and `tests/unit/playtime-charts.test.ts`; all in the green runs. The 36p SUMMARY's claim of 884 unit / 120 e2e matches my independent counts. | VERIFIED |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/worker/playtime.ts` | VERIFIED | Exists, substantive, wired from `ingest.worker.ts`; per-game sources, dotted day-first timestamps, four-column resolver. |
| `src/lib/worker/db.ts`, `ingest.worker.ts` | VERIFIED | Session-file discovery for `Sessions.csv` and `<GAME>_Game_Sessions.csv`; lazy backfill gated on `PLAYTIME_VERSION`. |
| `src/lib/playtime-model.ts` | VERIFIED | `rankScale`, calendar, hour-grid, duration models; pure. |
| `src/lib/playtime-shared.ts`, `playtime-state.ts`, `playtime-client.ts` | VERIFIED | Version 2, split columns, `isCacheClearedElsewhere`. |
| `Playtime.svelte`, `PlaytimeSummary.svelte`, `PlaytimeCharts.svelte`, `CalendarHeatmap.svelte`, `HourGrid.svelte`, `DurationList.svelte` | VERIFIED | Rendered, wired top-down, data flows from the worker aggregate (Level 4). No static return, hardcoded-empty prop or mock on the production path. |
| `tests/e2e/playtime-real-shape.spec.ts`, `playtime-scale.spec.ts`, `playtime-charts.spec.ts`; `tests/unit/playtime-scale.test.ts`, `playtime-charts.test.ts` | VERIFIED | All executed green by me. |

### Key Links

| From | To | Status |
|------|----|--------|
| `ingest.worker.ts` | `buildPlaytime...` over per-game session sources | WIRED |
| `playtime.ts` | `playtime-model.ts` (stored `dayIndex`/`daySeconds`/`hourOverlap`/`hourStart`/`bins`) | WIRED |
| `Playtime.svelte` | `PlaytimeSummary` / `PlaytimeCharts` via `readyView.slice` | WIRED |
| `Playtime.svelte` | `isCacheClearedElsewhere` -> notice | WIRED (`:181` -> `:350`) |
| `PlaytimeCharts.svelte` | `HOUR_GRID_BASIS_CAPTION` visible caption | WIRED |
| `CalendarHeatmap.svelte` | `scrollClear(node, headHeightFor(node))` | WIRED. The prior report's "no behavioural proof" is now covered by human UAT test 4 at 375px, in addition to the e2e sticky-head tests at two widths. |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ACTIVITY-01 | SATISFIED | Criterion 1 |
| ACTIVITY-02 | SATISFIED | Criteria 2 and 5 |
| ACTIVITY-03 | SATISFIED | Criterion 3 |
| ACTIVITY-04 | SATISFIED | Criterion 4 |

No orphaned requirements: `REQUIREMENTS.md` maps exactly ACTIVITY-01..04 to Phase 4, all claimed by plans. ACTIVITY-05..07 belong to Phase 6.

**Note for the orchestrator:** `REQUIREMENTS.md:30-33` checkboxes and `:97-100` status rows still read `Pending` / `[ ]`. The prior report deferred flipping them until the human checks were done; they are now done, so all four rows can be flipped to `Complete`. I did not edit that file.

### Invariants spot-checked

- **Zero network:** grep of `src/` for `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` returns nothing. The zero-network spec (`zero-network.spec.ts`, 5,000-session import plus every selector value and chart interaction) is green.
- **Debt markers:** no `TBD`/`FIXME`/`XXX` in `src/`, `tests/unit/` or `tests/e2e/`.
- **Working tree:** clean at start (git status empty); this pass edits only this report.

### Probe Execution

None declared; no `scripts/*/tests/probe-*.sh` exists. Not applicable.

---

## Anti-Patterns

No blocker or new warning. The prior report's `IN-1..IN-5` info items remain recorded as UAT gap `G-04-REVIEW-INFO-FINDINGS` (cosmetic, out of the review-fix scope, behaviourally inert). WR-1/WR-2 are fixed.

## Open, non-blocking items (recorded, not phase-goal gaps)

These are tracked in `04-UAT.md` and do not bear on any ROADMAP success criterion:

1. **G-04-TDD-EVIDENCE:** `gsd-tools check tdd-red-evidence` cannot parse vitest 5's TAP, so red evidence is not machine-verifiable; the git-log scope gate finds the RED commits. Tooling limitation.
2. **G-04-CI-TIME-LIMITS:** the 15/17/25-minute limits were derived from a ~630 s projection; the suite measures ~41 s locally. Unvalidated against a real CI run.
3. **G-04-IMPORT-FLOW-FLAKE:** pre-existing `import-flow.spec.ts:102` hand-typed pattern; it did not flake in my full run (120/120).
4. **G-04-HOUR-GRID-BASIS:** overlap-vs-start basis is an undecided one-line constant switch; both are stored.
5. **G-04-SCRATCH-CONFIG:** `playwright.scratch.config.ts` cleanup. I did not look for it or touch it.
6. **Other-tab *replace* case stays silent** (`04-GAPCLOSURE-REVIEW.md` finding 4) - a narrower UX hole accepted by the plan.
7. **Mixed line endings (bare `\r` mid-file)** in PapaParse is unchanged pre-existing code, declared out of scope by 04-14 and untested. The real export's WOTB/WOWS files use bare CR and UAT test 1 shows the real export imported correctly, which is evidence for the real shape but not a general proof for arbitrary mixed files.
8. **Date-oracle cross-check is partial** (`04-GAPCLOSURE-VERIFICATION.md` UNVERIFIED #3): the day-first parse is confirmed by my read of the destructuring and by the human real-export pass, with an independent `Date.UTC` oracle in the unit tests.

## Honest limits of this verification

- I did not see a real export and did not open `tests/fixtures/private/`. Every "real export" claim rests on the human UAT record (tests 1 and 5), which I read and did not re-perform.
- UAT tests 2, 3 and 4 were human-run on the synthetic 60k zip, not on a real one. Criterion 2's perceptual half is therefore verified on synthetic data; that is what the roadmap criterion specifies (a synthetic 50k+ fixture), so this is not a shortfall.
- UAT test 2's expected text is stale (the tooltip shows date/hours/sessions, never a wall-clock time); the pass is correct but the wording needs a follow-up edit.

---

## Verdict

Every ROADMAP Phase 4 success criterion, the IP-never-rendered requirement, and both gap-closure goals are verified by evidence I ran (lint, typecheck, 884 unit tests, 120 Playwright tests including the 60k-session scale spec and the real-shape spec) or read (complete human UAT, 59/59). Nothing is left uncertain, so `passed` is honest.

---

_Verified: 2026-10-01T03:05:00Z_
_Verifier: Claude (gsd-verifier)_
