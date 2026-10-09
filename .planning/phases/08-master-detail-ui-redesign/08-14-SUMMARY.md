---
phase: 08-master-detail-ui-redesign
plan: 14
subsystem: testing
tags: [playwright, e2e, master-detail, login-history, ip-table, world-map, tooltip]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, the openSection/importAndOpen/replaceExport helpers, the R1-R10 rules and --nav-offset 16px (08-02 to 08-07)"
provides:
  - "tests/e2e/logins/login-table.spec.ts: 5 listed tests on the 12,000-row IP table through the Login history pane"
  - "tests/e2e/logins/login-map.spec.ts: 7 listed tests on the world map through the pane, with a top-clearance tooltip check in place of the sticky-nav one"
affects: [08-15, 08-16, 08-17, 08-18]

actuals:
  tokens: 6000
  tasks: 2
  commits: 2
plan_head_before: a8a2eda46fbc835d1229e164649af16806af331a
plan_head_after: 7df14f57c51097ae1e6c4430c59940133f5609f5
commits: 2

tech-stack:
  added: []
  patterns:
    - "A top-edge tooltip check measures the tooltip's own height, then places the pointer 12px either side of height + 8 + --nav-offset + 8 so the flip threshold is proven from both sides"
    - "A check that needs the page scrolled further than its content allows adds temporary body padding and removes it afterwards"

key-files:
  created: []
  modified:
    - tests/e2e/logins/login-table.spec.ts
    - tests/e2e/logins/login-map.spec.ts

key-decisions:
  - "The topmost-country tooltip is asserted at the 16px + 8px threshold both ways (flips below 12px short, stays above with 24px clearance 12px past) rather than only against the viewport top, so a return of a 72px nav offset would fail it"
  - "The 375px map frame bounds follow the 343px detail pane (the map section sits in the pane with no card padding), 330 < width <= 343.5"

requirements-completed: []

coverage:
  - id: D1
    description: "The 12,000-row IP table windows, sorts every column, scrolls in its own region and keeps sticky header and first column at 375px, with the Account record row and the listing cap, read through the Login history pane"
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-table.spec.ts#all 5"
        status: pass
    human_judgment: false
  - id: D2
    description: "The world map shades by login count, follows the ranked roving tab stop (now through the about-map disclosure), keeps attribution and not-drawn visible, and keeps tooltips inside the viewport at all four edges including a top-clearance check without a sticky nav"
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#all 7"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 14: Migrate the IP table and world map specs Summary

**login-table (5) and login-map (7) now read the Login history block through its pane, and the map's top-edge tooltip check is rewritten from "just under the sticky nav" to a two-sided proof of the 16px + 8px flip threshold.**

## Performance

- **Duration:** about 6 min (2026-10-07T23:10Z to 23:16Z)
- **Tasks:** 2 (1 tracer, 1 auto)
- **Files:** 2 modified

## Accomplishments

- **Tracer (Task 1, login-table).** The serial `beforeAll` imports with `importAndOpen(..., 'login-history')`; the Account record, over-cap and post-`startOver` imports do the same. The 375px step narrows, then calls `openSection` and waits for the block and its first row, because at phone width the list screen shows and the detail content is unmounted (so the scroller is measured at its fresh mount). Every window, sort, scroller, sticky and keyboard assertion is unchanged.
- **Task 2 (login-map).** Import and replace paths open the pane (the replace helper gets `'login-history'` as its fifth argument), and the serial `beforeAll` uses `importAndOpen`. Three changes beyond the call sites, each caused by the new shell: the Tab walk now passes the about-map disclosure summary between the table and the map (and asserts the collapsed hint with `toContainText`, R7); the 375px frame bounds follow the 343px detail pane; the top-edge tooltip check is rewritten (below). Attribution and not-drawn assertions are unchanged and still visible, outside the disclosure.
- **Top-edge tooltip.** The old check placed the map "just under the sticky nav". The new one hovers the topmost country once to read the tooltip height, then scrolls so the pointer is 12px short of `height + 8 + 16 + 8` (the tooltip must sit at or below the pointer) and 12px past it (the tooltip must sit above the pointer with at least 24px of top clearance). Left, right and the 8px top edge are asserted in both cases; the bottom-most and left/right checks for the other extremes are untouched.

## Task Commits

1. **Task 1 (tracer): login-table spec** - `d6d163b` (test)
2. **Task 2: login-map spec** - `7df14f5` (test)

## Deviations from Plan

**1. [Rule 1 - Plan fact wrong] The about-map disclosure sits in the Tab order**
- **Found during:** Task 2
- **Issue:** The plan only mentions the hint assertions. The keyboard test pressed Tab from the table's last sort button and expected the leader country; the disclosure summary is now the next stop, so focus landed on it.
- **Fix:** Tab once to the disclosure summary (asserted focused), once more to the leader. The collapsed hint is asserted with `toContainText`. The remaining key-model assertions (Shift+Tab return, arrows, Home/End, Escape) are unchanged.
- **Commit:** `7df14f5`

**2. [Rule 1 - Plan fact wrong] 375px frame width bounds**
- **Found during:** Task 2
- **Issue:** The map section sits directly in the 343px detail pane, no longer in a padded card, so the frame is 343px and the old 311.5 upper bound failed.
- **Fix:** Bounds are now 330 < width <= 343.5 (the same slack below the width as before). The "fits, not a fraction of it" claim is kept, only the container width changed.
- **Commit:** `7df14f5`

**3. [Rule 3 - Blocking] Page too short to lift the map to the viewport top**
- **Found during:** Task 2
- **Issue:** With the country list collapsed the page cannot scroll far enough to put the topmost country's pointer within the flip threshold of the viewport top.
- **Fix:** The check adds 1200px of body padding for its two placements and removes it afterwards.
- **Commit:** `7df14f5`

**Total deviations:** 3 (all test-side adaptations to the new shell). **Impact:** listed counts stay 5 and 7, no assertion removed or weakened; the top-edge check is stronger (two-sided).

## Issues Encountered

None beyond the deviations. The throwaway Playwright config outside the repo was used for e2e runs (installed browsers do not match the pinned version); `playwright.config.ts` and `helpers.ts` were not touched. No hint assertion existed in the old map spec beyond the Tab walk, so the new `toContainText` is the only hint assertion added.

## Verification

- `playwright test -c <throwaway config> --project=chromium tests/e2e/logins/login-table.spec.ts tests/e2e/logins/login-map.spec.ts` - 12 passed (5 + 7), 21.8 s
- `grep -cE "dashboard-nav|querySelector\('nav'\)" tests/e2e/logins/login-map.spec.ts` - 0
- `vitest run tests/unit/guards/ci-budget.test.ts` - 6 passed
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - clean

## Known Stubs

None.

## Threat Flags

None. T-08-39 is mitigated: the top-clearance assertion replaces the nav-based one and the bottom and side-edge checks stay. T-08-40 is mitigated: the attribution-visible, link and not-drawn assertions are unchanged and outside the disclosure.

## Next Phase Readiness

With 08-13 all five Login history specs are migrated. Ready for 08-15.

## Self-Check: PASSED

- Both spec files present; commits `d6d163b` and `7df14f5` found in `git log`; `git rev-list --count a8a2eda..HEAD` is 2 before the SUMMARY commit.
