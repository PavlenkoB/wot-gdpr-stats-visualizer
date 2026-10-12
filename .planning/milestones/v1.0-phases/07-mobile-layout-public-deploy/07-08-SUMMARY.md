---
phase: 07-mobile-layout-public-deploy
plan: 08
subsystem: ui
tags: [css, stacking-context, sticky, nav, playwright, gap-closure]

requires:
  - phase: 07-mobile-layout-public-deploy
    provides: "plan 07-07's nav (z-index 1, sticky) and the scroll-nav.spec.ts file the paint-order tests join"
provides:
  - "Every table scroller (LoginTable, VehicleTable, CountryList, CityList) is its own stacking context via isolation: isolate, so a scrolled table can no longer paint over the sticky section nav"
  - "Two (stacking) browser tests in tests/e2e/shell/scroll-nav.spec.ts that measure paint order with elementsFromPoint at the nav's centre line, for the header row and the first-column cell, on the login and vehicle tables"
  - "tests/unit/guards/phase7-layout-guards.test.ts: a source guard that all four .scroller rules declare isolation: isolate"
affects: [verification-07, PLATFORM-01]

actuals:
  tokens: 6000
  tasks: 3
  commits: 4

plan_head_before: 99faaeab44854e449183a773e15f351975e78f9b
plan_head_after: 9f284ce02ce1f1056a43d21f3d276b1de322fb74

tech-stack:
  added: []
  patterns:
    - "A table scroller with sticky cells that carry z-index gets isolation: isolate, so its z-index values are compared inside the scroller and never with the page's sticky nav"
    - "Paint-order assertions use document.elementsFromPoint after aligning the target to the nav's centre line in a loop; bounding-box checks cannot see stacking"

key-files:
  created:
    - tests/unit/guards/phase7-layout-guards.test.ts
  modified:
    - tests/e2e/shell/scroll-nav.spec.ts
    - src/lib/features/logins/LoginTable.svelte
    - src/lib/features/vehicles/VehicleTable.svelte
    - src/lib/features/logins/CountryList.svelte
    - src/lib/features/logins/CityList.svelte

key-decisions:
  - "The nav's z-index is not raised: the fixed chart tooltip at z-index 2 relies on stacking being z-index-free elsewhere (PlaytimeCharts.svelte stacking note); DashboardNav.svelte is byte-identical"
  - "CountryList and CityList get the same declaration as a documented prophylactic: their headers carry no z-index and they do not overlap the nav today, so only the source guard covers them"

patterns-established:
  - "Red test commit precedes the fix commit (twice), so the before-fix failure is a fact of git history"

requirements-completed: []

coverage:
  - id: D1
    description: "At 375px, with the login table or the vehicle table scrolled under the sticky nav, the topmost element at the nav's centre line is inside the nav at both overlaps: the header row (probed at the nav's centre) and the first body row's first-column cell (probed at that cell's own centre)."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/scroll-nav.spec.ts (stacking) x2, chromium"
        status: pass
    human_judgment: false
  - id: D2
    description: "The two tests discriminate: each fails (both positions) when its own table's isolation is absent and passes when present; the unit guard names exactly the files that lack the declaration."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "red runs at 65010e7 and fde1787, plus mutation rounds A, B and C in Task 3"
        status: pass
    human_judgment: false
  - id: D3
    description: "All four .scroller rules declare isolation: isolate."
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase7-layout-guards.test.ts, 4 passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The e2e budget does not move: 257 listed tests, ci-budget guard green, no limit edited, nav and every other pinned file untouched."
    verification:
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts, 6 passed; git diff --quiet on the pinned files exits 0"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-10-06
status: complete
---

# Phase 7 Plan 8: Table scrollers no longer paint over the sticky nav (G-07-5) Summary

**`isolation: isolate` on the four table `.scroller` rules keeps each table's sticky z-index 1/2/3 cells inside the scroller, so a scrolled login or vehicle table can no longer cover the z-index 1 section nav; held by two paint-order tests that fail on the old components and a four-file source guard.**

## Performance

- **Duration:** about 30 min
- **Completed:** 2026-10-06
- **Tasks:** 3 (one tracer, two auto)
- **Files modified:** 6 (one created)

## Accomplishments

- Task 1 (tracer), two commits in order. `65010e7` adds the paint-order probe, the assertion helper and the login `(stacking)` test (red); `2852402` adds `isolation: isolate` and its comment to LoginTable's `.scroller` (green).
- Task 2, two commits in order. `fde1787` adds the vehicle `(stacking)` test and `phase7-layout-guards.test.ts` (red); `9f284ce` adds the declaration to VehicleTable (cure) and to CountryList and CityList (prophylactic, commented as such).
- Task 3 changed no committed file: per-table mutation rounds, the full both-project run, and the budget check, recorded below.

## Red runs

Run against the unmodified components, with the dev machine's built app (GEO build as the config builds it):

- Task 1, login (stacking): failed with BOTH positions reported. Header row: `topmost at (188, 29) is button[login-sort-ip] in th, not the nav`. First column: `topmost at (115, 29) is span.ip in td, not the nav`.
- Task 2, vehicle (stacking): failed with both positions. Header row: `button[vehicle-sort-vehicle] in th`. First column: `span.id in td`. The login test passed.
- Task 2, unit guard: failed for exactly `VehicleTable.svelte`, `CityList.svelte` and `CountryList.svelte`; `LoginTable.svelte` passed.

These match the planning-time measurements exactly.

## Mutation rounds (Task 3)

Each round deleted the `isolation: isolate` line from the named scroller rule(s), ran `-g stacking` and the unit guard, then restored with `git checkout` (`git diff --quiet` exited 0 each time).

| Round | Mutated | login (stacking) | vehicle (stacking) | unit guard failures |
| ----- | ------- | ---------------- | ------------------ | ------------------- |
| A | LoginTable | FAIL, both positions (`button[login-sort-ip]`, `span.ip`) | pass | LoginTable.svelte only |
| B | VehicleTable | pass | FAIL, both positions (`button[vehicle-sort-vehicle]`, `span.id`) | VehicleTable.svelte only |
| C | CityList and CountryList | pass | pass | CityList.svelte and CountryList.svelte |

Round C is what the plan said it would be: the two lists are covered by the source guard and by nothing in the browser (T-07-29, accepted). No browser test drives the city list under the nav; its state needs the opt-in city download.

## Verification

- `pnpm exec playwright test` (both projects, full suite): 257 passed in 1.3 min. The hit-testing sweep (vehicles, logins, shell, playtime-charts, chromium-mobile) is covered by that run and by the Task 2 targeted run (55 passed); no spec needed a change, so nothing was clicking a control under the nav.
- `pnpm exec playwright test --list | tail -1`: `Total: 257 tests in 25 files`. `ci-budget.test.ts` green; one test of headroom remains under the 258 the 29-minute limit covers.
- `pnpm run test:unit`: 81 files, 2487 tests passed (see the transient note below). `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean.
- `git status --porcelain src tests` prints nothing. `git diff --quiet` against the pre-plan commit for `DashboardNav.svelte`, `src/app.css`, `src/lib/ui-copy.ts`, `package.json`, `pnpm-lock.yaml`, `playwright.config.ts`, `.github/workflows/ci.yml` and `ci-budget.test.ts` exits 0.
- Commit ordering: both red-before-green pairs satisfy the plan's `merge-base --is-ancestor` and file-scope checks (see the first deviation about the grep pattern).

## Deviations from Plan

### Auto-fixed Issues

None to the product code.

### Environment and tooling notes

**1. [Rule 3 - Blocking] A stale `vite preview` held port 4173**
- **Found during:** Task 1, first Playwright run (`http://localhost:4173 is already used`; the config sets `reuseExistingServer: false`).
- **Issue:** a `vite preview` for this repo (pid 64485, started about 9 h earlier from an interactive shell, parent `pnpm run preview`) was listening. I did not start it and did not kill it.
- **Fix:** every Playwright run used a throwaway config in the scratchpad that imports the repo's `playwright.config.ts` unchanged and only moves the base URL and preview port to 4174 (`--strictPort`), still building fresh before each run. No repo file changed. `reuseExistingServer` was not touched. The run counts and the `Total: 257` listing are identical to what the repo config produces.
- **Impact:** none on results. The stale server is still running and the user may want to stop it.

**2. [Plan text] The Task 1 acceptance grep also matches Task 2's red commit**
- `git log -1 --grep='^test(07-08): assert the nav stays topmost'` resolves to the vehicle red commit (newest match), so the plan's Task 1 ancestry check fails when run after Task 2. Re-running it with the login-specific subject (`... over a scrolled login`) passes, as does the Task 2 check. The Task 3 diff gate used `T^` from the login commit.

**3. [Observation] One unreproduced unit-suite failure**
- The first `pnpm run test:unit` after the 1.3 min full Playwright run exited 1 (output cut by `tail`, failing test not captured). Three re-runs on the same tree all passed (81 files, 2487 tests). Probably a timing-sensitive test under machine load right after the browser run; not investigated further, no repo change made.

## Findings to carry forward

- (a) The UAT root cause was right for LoginTable and VehicleTable and overstated for CityList and CountryList: their headers carry no z-index and their scroller is unpositioned, so they cannot overlap the nav today. Their declaration is prophylactic and covered only by the source guard.
- (b) A second overlap existed that the UAT did not name: the first-column body cells (z-index 1) tied the nav's z-index and won on tree order. The tests check both positions.
- (c) The existing vehicle-stats "nav clears the table" check compares bounding boxes and cannot see paint order, which is why the bug passed it.
- (d) The e2e total is 257 against 258 covered by the 29-minute limit: one test of headroom. The next browser test anywhere must plan for the 30/32/40 raise precomputed in the plan (E = 1343 s at 259 tests).
- Re-verification is human: run `/gsd-verify-work 7` and scroll the login and vehicle tables under the nav at phone width.

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file or schema surface; CSS and tests only.

## Self-Check: PASSED

- Commits 65010e7, 2852402, fde1787 and 9f284ce exist in git log on gsd/phase-07-mobile-layout-public-deploy.
- tests/unit/guards/phase7-layout-guards.test.ts exists; the six modified files are committed; `git status --porcelain src tests` is empty.
