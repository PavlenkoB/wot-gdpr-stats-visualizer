---
phase: 08-master-detail-ui-redesign
plan: 07
subsystem: ui
tags: [svelte, focus, scroll, design-tokens, vitest, playwright, guards]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell and its nav spec (08-02 to 08-06), the Day 10 tokens and contrast rows (08-01)"
provides:
  - "scrollClear measuring only [data-sticky-chrome] (STICKY_CHROME_SELECTOR exported)"
  - "--nav-offset at 16px, so the calendar year head sticks at top 0"
  - "the anchor nav, scroll-spy and the smooth-scroll rule retired"
  - "legacy dark-text and grey-text hex gone from the shell"
  - "tests/unit/guards/phase8-shell-guards.test.ts: eight source-contract guards for the shell"
affects: [08-08, 08-09, 08-10, 08-11, 08-12, 08-13, 08-14, 08-15, 08-16, 08-17, 08-18]

actuals:
  tokens: 19800
  tasks: 3
  commits: 3
plan_head_before: df21228a45d589932a6eaace18e5d7bb63750a2a
plan_head_after: d2c4921f05825e7af2468ca5cb8646865eda82a8
commits: 3

tech-stack:
  added: []
  patterns:
    - "A focus-clear helper measures an explicit marker attribute, not a landmark tag, so a layout change cannot silently turn it into a page-scrolling bug"
    - "A source-level guard file holds a phase's structural promises (no overflow on the detail pane, one phone breakpoint, no storage or hash, retired files stay gone)"

key-files:
  created:
    - tests/unit/guards/phase8-shell-guards.test.ts
  modified:
    - src/lib/core/focus-clear.ts
    - tests/unit/core/focus-clear.test.ts
    - src/app.css
    - tests/e2e/shell/master-detail-nav.spec.ts
    - tests/unit/charts/contrast.test.ts
    - tests/unit/guards/phase7-layout-guards.test.ts
    - src/lib/shell/ConfirmPanel.svelte
    - src/lib/shell/DashboardSection.svelte
    - src/lib/shell/ExcludedNotice.svelte
    - src/lib/shell/ImportSummary.svelte
    - src/lib/shell/UnsupportedBlock.svelte
    - src/lib/features/playtime/CalendarHeatmap.svelte
    - src/lib/charts/ChartTooltip.svelte
  deleted:
    - src/lib/shell/DashboardNav.svelte
    - src/lib/shell/scroll-spy.ts
    - tests/unit/shell/scroll-spy.test.ts

key-decisions:
  - "scrollClear looks up STICKY_CHROME_SELECTOR ([data-sticky-chrome]) instead of the tag nav; no element carries the marker, so the clear line is the year head plus the 8px gap. The new list nav is a 100vh sticky column on desktop and would otherwise scroll the page on every arrow key in a chart (proven: with the selector temporarily set back to nav the regression test fails, scrollY 707 to 313)"
  - "--nav-offset is 16px (zero sticky chrome plus one md); the year head's sticky top resolves to 0 and the source pins on CalendarHeatmap and ChartTooltip are untouched"
  - "ConfirmPanel's two blue focus rings were tokenised to var(--focus) (same #1a73e8) rather than allow-listed, so the phase 8 guard's blue allowlist is just ImportBar, Dropzone and App.svelte as the plan states"

patterns-established:
  - "Retire a behaviour together with its tests; port only the coverage whose subject still exists (footer wording, long-text overflow)"

requirements-completed: []

coverage:
  - id: D1
    description: "A keyboard move inside the calendar leaves window.scrollY unchanged, --nav-offset computes to 16px and the sticky year head's computed top is 0px"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(chart-chrome)"
        status: pass
      - kind: unit
        ref: "tests/unit/core/focus-clear.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The anchor nav, scroll-spy, their unit test and the smooth-scroll rule are gone and nothing imports them; the ported footer wording and the long-text no-overflow coverage live in the new nav spec"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(wording)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(long-text)"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/phase8-shell-guards.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "contrast.test.ts no longer reads DashboardNav.svelte; the Day 10 selected, hover and muted pairs are the row contract"
    verification:
      - kind: unit
        ref: "tests/unit/charts/contrast.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "No shell file carries the legacy dark-text or grey-text hex, and blue survives only in the allowed focus ring token, spinner and drag highlight"
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-shell-guards.test.ts"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 07: Retire the anchor nav, retarget scrollClear, finish the hex migration Summary

**scrollClear now measures only `[data-sticky-chrome]` and `--nav-offset` is 16px, so a keyboard move in a chart no longer scrolls the page beside the new 100vh sticky list; the anchor nav, scroll-spy and smooth-scroll rule are gone, the shell is free of the legacy text hex, and a guard file pins the shell's structure.**

## Performance

- **Duration:** about 7 min of tool time (started 2026-10-07T22:17Z, finished 22:26Z)
- **Tasks:** 3
- **Files:** 17 changed (13 modified, 1 created, 3 deleted), 418 insertions and 1095 deletions

## Accomplishments

- **Tracer.** `focus-clear.ts` exports `STICKY_CHROME_SELECTOR` and measures it instead of `nav`; its unit test answers only the exported constant and gained a case proving a plain `nav` reporting a 900px bottom is ignored. `app.css` declares `--nav-offset: 16px` with an honest comment and no longer declares `scroll-behavior`. The `(chart-chrome)` e2e test focuses a calendar cell 200 to 450px down, presses ArrowRight, and asserts scrollY is unchanged, `--nav-offset` is `16px` and the year head's computed `top` is `0px`. Setting the selector back to `nav` made this test fail (`scrollY moved from 707 to 313`), so it bites.
- **Retirement.** Deleted `DashboardNav.svelte`, `scroll-spy.ts` and `scroll-spy.test.ts` (the old nav spec went in 08-02). Ported into `master-detail-nav.spec.ts`: the no-unsupported-folders wording (row muted, row text and opened panel show `UNSUPPORTED_NONE_DETECTED`) and a new `(long-text)` test (`buildLongTextExport`, 375 and 720px, list screen plus every pane id, `scrollWidth` at most the viewport). The nav spec lists 15 tests.
- **contrast.test.ts** lost `NAV_SOURCE`, `UI_SPEC`, `MIN_HOVER_CONTRAST`, `cssBackground`, `specTableValue` and the `nav hover surface (W-03)` describe; its header was rewritten; the Day 10 block is the new row contract.
- **Hex sweep.** `#3c4043` became `var(--text)` and `#5f6368` became `var(--muted)` in ConfirmPanel, DashboardSection, ExcludedNotice, ImportSummary and UnsupportedBlock. Stale year-head and `navOffset` comments were rewritten (comment-only, the pinned expressions are unchanged).
- **Guards.** `phase8-shell-guards.test.ts` has eight cases: no legacy hex, blue allowlist, no `overflow` on `.pane-detail`, one 480px block plus the 899/900 complement matching `selection-state.ts`, no storage/hash/history/raw HTML in five shell sources, retired files gone, the seven contract test ids present, and `focus-clear.ts` not querying `nav`.

## Task Commits

1. **Task 1 (tracer): scrollClear and --nav-offset** - `7fdd84e` (feat)
2. **Task 2: retire the anchor nav, port coverage, rewrite the contrast nav block** - `c93cc62` (refactor)
3. **Task 3: hex sweep, comment refresh, shell guards** - `d2c4921` (feat)

## Verification

- `pnpm exec vitest run tests/unit` - 84 files, 2560 tests, all pass
- `pnpm exec playwright test -c <throwaway config> --project=chromium tests/e2e/shell/master-detail-nav.spec.ts` - 15 passed (run on the pinned-config re-export with the local Chromium executable)
- `pnpm exec playwright test --list` - `Total: 252 tests in 25 files`, as the plan predicted
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - clean
- `playtime-charts.test.ts` and `tooltip-pin.test.ts` source pins pass unchanged
- `grep -rEn "^\s*import .*(scroll-spy|DashboardNav)" src tests` - nothing; `grep -cE "#3c4043|#5f6368" src/lib/shell/*.svelte` - 0 everywhere
- The broader Playwright suite was not run (it stays red until plans 08-08 to 08-18, per the dispatch note); only the plan's named spec was.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Consistency] ConfirmPanel's blue focus rings tokenised to `var(--focus)`**
- **Found during:** Task 3
- **Issue:** The plan's must-have and guard assertion (2) allow `#1a73e8` only in App.svelte, ImportBar.svelte and Dropzone.svelte, but ConfirmPanel.svelte also carried two literal `#1a73e8` focus rings, so the guard as written would fail on it.
- **Fix:** Replaced the two literals with `var(--focus)`, which is `#1a73e8`; the rendered colour is identical, and ImportBar and ListPane already use the token.
- **Files modified:** src/lib/shell/ConfirmPanel.svelte
- **Commit:** d2c4921

**Total deviations:** 1 auto-fixed. **Impact:** none visually; the guard allowlist matches the plan text.

## Issues Encountered

None blocking. Out-of-scope observations, left untouched: `src/App.svelte` line 222 and several other file comments still mention the scroll-spy or `DashboardNav` by name (comment-only, outside this plan's file list), and `CalendarHeatmap.svelte` still sets `root.style.scrollBehavior = 'auto'` around focus, now a harmless no-op since the page declares no smooth scrolling. Plans 08-12 onward own the e2e pins of the old 56px or nav geometry.

## Known Stubs

None.

## Threat Flags

None. No new network, auth or storage surface; guard assertion (5) now enforces T-08-24 and T-08-25.

## Next Phase Readiness

Ready for 08-08. `STICKY_CHROME_SELECTOR` is the hook any future element that sticks over content must use.

## Self-Check: PASSED

- Created and deleted files verified on disk (`phase8-shell-guards.test.ts` present; `DashboardNav.svelte`, `scroll-spy.ts`, `scroll-spy.test.ts`, `scroll-nav.spec.ts` absent).
- Commits `7fdd84e`, `c93cc62`, `d2c4921` found in `git log`; `git rev-list --count df21228..HEAD` is 3 before the SUMMARY commit.
