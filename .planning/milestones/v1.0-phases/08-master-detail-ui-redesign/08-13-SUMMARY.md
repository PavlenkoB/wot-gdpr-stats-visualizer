---
phase: 08-master-detail-ui-redesign
plan: 13
subsystem: testing
tags: [playwright, e2e, master-detail, login-history, masking, city-optin]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, the openSection/importAndOpen/replaceExport helpers and the R1-R10 rules (08-02 to 08-07)"
provides:
  - "tests/e2e/logins/login-history.spec.ts: 15 listed tests on the Login history pane, masking walk widened to the list pane, detail pane and header"
  - "tests/e2e/logins/login-city.spec.ts: 3 listed tests, the opt-in and its one sanctioned request proven through the pane"
  - "tests/e2e/logins/login-scale.spec.ts: 5 listed tests, one serial 12,000-row import and a single openSection"
affects: [08-14, 08-15, 08-16, 08-17, 08-18]

actuals:
  tokens: 9000
  tasks: 3
  commits: 3
plan_head_before: 767d3857ce3d71710db1a9aabb8b45e426ccf68f
plan_head_after: 4a796aa24768d7d3836a8365f9c3a9a4b8f1a88e
commits: 3

tech-stack:
  added: []
  patterns:
    - "A test that must keep a block's in-flight state across a resize starts at the narrow width and opens the pane there, because the phone list screen unmounts the detail content"
    - "A masking attribute walk covers every shell region around the block and asserts each root is present before walking it"

key-files:
  created: []
  modified:
    - tests/e2e/logins/login-history.spec.ts
    - tests/e2e/logins/login-city.spec.ts
    - tests/e2e/logins/login-scale.spec.ts

key-decisions:
  - "The attribute walk for masked addresses is one helper (attributeHitsAround) over four roots: the block, detail-pane, list-pane and identity-header, each asserted present first and walked including its own attributes"
  - "The city progress-row phone-width measurement happens with the download started at 375px, then the viewport is widened, rather than narrowing mid-download"

requirements-completed: []

coverage:
  - id: D1
    description: "The Login history block states, tiles, masking (attributes, body text, selection, title, live region) and 375px tile geometry hold with the Login history pane open, after replace, start-over and reload"
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#all 15"
        status: pass
    human_judgment: false
  - id: D2
    description: "The city opt-in is idle until pressed, makes exactly one same-origin request on the press, and its list, cancel, failure, replace and start-over behaviours are unchanged"
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-city.spec.ts#all 3"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 12,000-row Login history keeps its single serial import and five tests, with the table window, sorts, tiles, map and masking proven through the pane"
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-scale.spec.ts#all 5"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 13: Migrate the first three Login history specs Summary

**login-history (15), login-city (3) and login-scale (5) now read the Login history block through its pane; the masking attribute walk gained the list pane, detail pane and header as roots, and every request-counting assertion in login-city is kept.**

## Performance

- **Duration:** about 12 min (2026-10-07T22:58Z to 23:10Z)
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files:** 3 modified

## Accomplishments

- **Tracer (Task 1, login-history).** Every `importExport` became `importAndOpen(..., 'login-history')`; the one `replaceExport` passes the pane as its fifth argument; the start-over test re-imports with `importAndOpen`; the reload test calls `openSection` before reading (a reload lands on Overview). A new file-local helper `attributeHitsAround` replaces the two block-only attribute walks: it asserts the block, `detail-pane`, `list-pane` and `identity-header` each exist once, then walks every attribute of every element of each (and the root's own) for any fixture address. The whole-body innerHTML check, the whole-body selection check and the title check were already page-wide and are unchanged. The error test opens the Playtime pane to keep its "other blocks are unaffected" claim, since only the open pane's section is in the DOM (R4).
- **Task 2 (login-city).** Imports use `importAndOpen`, the two `replaceExport` calls pass the pane, the post-`startOver` import re-opens it, and the reload in the list test re-opens it. The phone-width progress-row measurement now runs with the download started at 375px (see Deviations). No request-count assertion, same-origin check, state name or sort assertion was changed or removed.
- **Task 3 (login-scale).** One `openSection(page, 'login-history')` in `beforeAll` after the single import. The five serial tests, the scroller assertions and the listed count (5) are untouched.

## Task Commits

1. **Task 1 (tracer): login-history spec** - `2ff2dfd` (test)
2. **Task 2: login-city spec** - `609c22e` (test)
3. **Task 3: login-scale spec** - `4a796aa` (test)

## Deviations from Plan

**1. [Rule 1 - Plan fact wrong] The city resize step cannot narrow mid-download**
- **Found during:** Task 2
- **Issue:** The plan says to measure at 375 after `openSection`, then resize back. On a phone the detail content is unmounted while the list screen shows (`detailMounted` in Dashboard.svelte), and a desktop selection does not set the phone's chosen screen. Narrowing mid-download and calling `openSection` remounted the block idle, so `city-progress-line` never appeared and the test timed out.
- **Fix:** The viewport is set to 375px, the pane opened and the block confirmed idle BEFORE the Load press; the downloading assertions, the one-press-one-request poll and the stacking measurement run at 375px, then the viewport returns to 1280 (the block stays mounted on widening) and the cancel step onward runs as before. The request baseline (`before`) is taken after the remount. No assertion was removed or loosened; the downloading-state checks are width-independent and now run at the phone width.
- **Files modified:** `tests/e2e/logins/login-city.spec.ts`
- **Commit:** `609c22e`

**2. [Rule 1 - Plan fact wrong] Stale card-width comment**
- **Found during:** Task 1
- **Issue:** A comment in the 375px test said the card is 295px; the detail pane is 343px. Comment only, no number asserted changed (three fact tiles still need 632px).
- **Commit:** `2ff2dfd`

**Total deviations:** 2 (both plan-fact corrections). **Impact:** none on listed counts (15, 3, 5), no hand-table or request-count value changed, no assertion weakened.

## Issues Encountered

None beyond the deviation. The throwaway Playwright config (outside the repo) was used for every e2e run because the installed browsers do not match the pinned version; the repo's `playwright.config.ts` and `helpers.ts` were not touched. The scale spec's 12,000-row import fit inside the shared `waitForImported` 30s ceiling, so no spec-local wait was needed.

## Verification

- `playwright test -c <throwaway config> --project=chromium` on the three specs together - 23 passed (15 + 3 + 5), 48.7 s
- `playwright ... login-scale.spec.ts --list` ends `Total: 5 tests in 1 file`; login-history and login-city list `Total: 18 tests in 2 files`
- `grep -c "importAndOpen\|openSection" tests/e2e/logins/login-history.spec.ts` - 20 (at least 10)
- `git diff -U0` on login-city removes no request-count assertion (only import lines, the replaced resize lines and the replace/import calls)
- `vitest run tests/unit/guards/ci-budget.test.ts` - 6 passed
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - clean

## Known Stubs

None.

## Threat Flags

None. T-08-37 is mitigated: the attribute walk keeps its full strength, gains the list pane, detail pane and header as roots, and fails if any root is absent. T-08-38 is mitigated: every request-counting assertion in login-city is kept.

## Next Phase Readiness

Ready for 08-14.

## Self-Check: PASSED

- All three spec files present; commits `2ff2dfd`, `609c22e` and `4a796aa` found in `git log`; `git rev-list --count 767d385..HEAD` is 3 before the SUMMARY commit.
