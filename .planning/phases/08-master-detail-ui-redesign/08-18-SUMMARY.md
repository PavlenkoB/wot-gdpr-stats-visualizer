---
phase: 08-master-detail-ui-redesign
plan: 18
subsystem: testing
tags: [playwright, e2e, master-detail, phone, touch, tooltips, uat]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, the openSection/importAndOpen/ensureListScreen helpers and the R1-R10 rules (08-02 to 08-07)"
provides:
  - "tests/e2e/shell/mobile-sweep.spec.ts: 6 tests, the D-04 no-sideways-scroll sweep on the list screen and all eight panes"
  - "tests/e2e/shell/touch-targets.spec.ts: 3 tests, the 44px floor on list rows, the back button and every disclosure in its own pane"
  - "tests/e2e/shell/touch-tooltips.spec.ts: 8 tests, the touch tooltip specs through the Playtime, Finance and Login history panes"
  - "tests/e2e/shell/uat-criteria.spec.ts: 4 tests, the Phase 4 UAT criteria with UAT-4 re-measured against the year head and viewport"
affects: [08-19]

actuals:
  tokens: 10000
  tasks: 3
  commits: 4
plan_head_before: 8587686
plan_head_after: c16f81a268919e201f3c8070b2d8bfa302d054d5
commits: 4

tech-stack:
  added: []
  patterns:
    - "A pane-by-pane sweep keyed on PANE_IDS, with a per-pane expectation table naming the section root, the named blocks and the blocks to wait out of loading"
    - "A touch tap point taken from the interior of a small shape (all four neighbours at a margin also hit the shape), falling back to an edge only when no interior exists"

key-files:
  created: []
  modified:
    - tests/e2e/shell/mobile-sweep.spec.ts
    - tests/e2e/shell/touch-targets.spec.ts
    - tests/e2e/shell/touch-tooltips.spec.ts
    - tests/e2e/shell/uat-criteria.spec.ts

key-decisions:
  - "expectPresent in the sweep polls the locator count instead of reading it once, because a block inside an open pane mounts when its worker answer lands; a surface that never appears still fails after the poll budget"
  - "UAT-3 lands its 60,000-row import with the spec's own 90 s budget (helper's two signals, spec-local) instead of waitForImported's fixed 30 s; helpers.ts is untouched"

requirements-completed: []

coverage:
  - id: D1
    description: "The phone sweep proves nothing scrolls the page sideways at 375px on the list screen, then each of the eight panes, every disclosure in each pane opened one at a time, the confirm panel open and cancelled, and the identity header and list fully above the 812px fold; the padding test reads the detail pane (16px at 375, 40px at 481)"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/mobile-sweep.spec.ts (6 tests, project chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 44px floor holds on every list row, the back button (48px bar), Start over, Clear data, both confirm buttons, the vehicle sort headers, the column picker, the battle-type summary, the monthly-table and spend-breakdown summaries, every about-* summary in the Playtime and Finance panes and the login controls; Start over only opens the panel"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-targets.spec.ts (3 tests, project chromium-mobile)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every tap, pin, move, dismiss and announce assertion of the touch tooltip specs is kept; each test opens the pane that owns its chart first"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-tooltips.spec.ts (8 tests, project chromium-mobile)"
        status: pass
    human_judgment: false
  - id: D4
    description: "UAT-1 to UAT-4 hold on the new shell; UAT-4 asserts the focused cell is at or below the year head's bottom and its bottom is within the viewport, with no nav term"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/uat-criteria.spec.ts (4 tests, project chromium)"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 18: Migrate the phone, touch and UAT specs Summary

**The phone overflow sweep, the 44px touch floor, the touch tooltip specs and the Phase 4 UAT criteria now run on the two-screen master-detail shell: the sweep walks the list screen plus all eight panes (PANE_IDS), the floor measures list rows and the back button instead of a nav, and UAT-4 is measured against the sticky year head and the viewport bottom.**

## Performance

- **Duration:** about 40 min
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files:** 4 modified, 0 created
- **Listed tests:** 6 + 3 + 8 + 4 = 21, unchanged from before the plan (the touch project lists 11)

## Accomplishments

- **Tracer (Task 1, mobile-sweep).** The padding test reads the computed horizontal padding of `detail-pane` (16px at 375px, 40px at 481px) on the empty first visit, with no sideways page overflow at either width, then imports at 375px and expects the list screen. The full-dashboard test asserts the identity header and the list nav end above the 812px fold, then loops over `PANE_IDS` (guarded by an equality check against its expectation table so a ninth pane would fail the sweep): `openSection`, the pane's section root (or `overview`) and named blocks (`player-stats` and `vehicle-scroller` in vehicles, `premium-block` and `currency-block` in finance, `spend-block` in payments) are asserted present, blocks are waited out of `loading`, overflow is measured, and every closed `details > summary` in the detail pane (the about-* disclosures included) is opened one at a time with overflow measured after each. It ends on the list screen with the confirm panel opened and cancelled. The activity, banners, city opt-in and tables tests open the owning pane (`importAndOpen`, `replaceExport(..., pane)`, `openSection`), and the long nickname is read on the list screen where the identity header lives. All 6 pass.
- **Task 2, touch-targets.** Test 1 is renamed for what it now proves: all eight list rows, Start over, Clear data and both confirm buttons are at least 44px, a tap on Start over only opens the confirm panel and the nickname stays on screen (T-07-17 kept), and after `openSection(vehicles)` `back-button-sections` is at least 44px high (it is 48). The `--nav-offset` fit, the focus ring inside the nav and the nav-height comparison are deleted with the `navOffset` and `navHeight` helpers. Test 2 opens vehicles (sort headers, column picker, battle-type summary), finance (monthly tables and every about-* summary), payments (spend breakdown) and playtime (about-* summaries). Test 3 uses `importAndOpen(..., 'login-history')`. The `grep -cE "dashboard-nav|nav-link-|navOffset"` count is 0.
- **Task 2, touch-tooltips.** `openPlaytime`, `openFinance` and the map test open their owning pane through `importAndOpen`; all 8 tests keep their assertions.
- **Task 3, uat-criteria.** UAT-1 to UAT-3 use `importAndOpen(..., 'playtime')`. UAT-4 (375px context) drops the nav measurement and asserts `cellTop >= headBottom`, `cellBottom <= viewport height`, and that a year head exists to measure against. The comments naming the nav are updated. `grep -c dashboard-nav` is 0.

## Task Commits

1. **Task 1 (tracer): mobile-sweep on the two-screen layout** - `7205719` (test)
2. **Task 2: touch-targets and touch-tooltips** - `d1d291f` (test)
3. **Task 3: uat-criteria** - `ad19817` (test)
4. **Task 3 follow-up: UAT-3 own landing wait** - `c16f81a` (test)

## Deviations from Plan

**1. [Rule 1 - Bug] Scroll-dismissal test re-opened by a synthetic mouse move**
- **Found during:** Task 2 (touch-tooltips, "a scroll dismisses it SILENTLY")
- **Issue:** After `window.scrollBy(0, 200)` the tooltip stayed visible. Instrumenting the page showed Chrome's synthetic mouse move after a scroll landed at (187.5, 215.6), exactly where the scrolled hour grid now sits in the new pane geometry, so a `pointerover` re-opened the tooltip against the cell's new position (a fresh open is not stale). The shell, `ChartTooltip` and the charts are unchanged; this is a test-geometry coincidence.
- **Fix:** The test parks the mouse on the page corner (`page.mouse.move(1, 1)`) before the scroll, with a comment, so the assertion is about the scroll dismissal (hidden, region cleared to empty) and not about where the emulated mouse rests. The assertions are unchanged.
- **Files modified:** `tests/e2e/shell/touch-tooltips.spec.ts`
- **Commit:** `d1d291f`

**2. [Rule 1 - Bug] Map tap point on the edge of a 7x8 px country**
- **Found during:** Task 2 (touch-tooltips, the map test)
- **Issue:** The map now renders 341px wide, so Germany is about 7 x 8 px. `tapPointFor` returned the first point (top-left corner) where `elementFromPoint` said Germany, but a real touch press at that point was dispatched to the `svg`, so no tooltip opened.
- **Fix:** `tapPointFor` now requires the point and its four neighbours at a margin (2px, then 1px, then 0) to hit the same country, so the tap lands in the shape's interior; the edge point remains the last resort. The "a press really lands on this country" claim is unchanged.
- **Files modified:** `tests/e2e/shell/touch-tooltips.spec.ts`
- **Commit:** `d1d291f`

**3. [Rule 3 - Blocking risk] UAT-3 spec-local landing wait**
- **Found during:** Task 3 verification (the multi-spec run under load)
- **Issue:** The 60,000-row import in UAT-3 took about 30 s and failed once on `waitForImported`'s fixed 30 s ceiling ("identity-header not skeleton" timeout). The dispatch directed a spec-local wait rather than editing `helpers.ts`.
- **Fix:** UAT-3 sets the file input itself and applies the helper's two landing signals with a 90 s budget, then opens the Playtime pane (test timeout is 120 s). Passed afterwards in the isolated run and in the combined run.
- **Files modified:** `tests/e2e/shell/uat-criteria.spec.ts`
- **Commit:** `c16f81a`

**4. [Design choice] expectPresent polls**
- The sweep's `expectPresent` now polls `locator.count()` (default 5 s) instead of reading it once, because blocks inside an open pane mount when the worker answers. It still fails with the same message when a surface never appears; the existence-first guarantee is unchanged. Panes with a `data-state` block are also waited out of `loading` before their disclosures are enumerated, so none is missed.

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3) plus 1 design choice. **Impact:** test-side only; no assertion was weakened or removed, no test added or removed, `helpers.ts`, `playwright.config.ts` and `src/` untouched.

## Issues Encountered

- The first multi-spec verification run failed UAT-3 on the 30 s helper ceiling (deviation 3). The initial `uat-criteria.spec.ts` edit also left `openSection` out of the import after a Prettier reflow; svelte-check/`tsc` was not run until the end, the isolated run caught it as a `ReferenceError`, and it was fixed before the final commit.
- UAT-3 remains the slowest spec (about 30 s) because of the 60k import itself.
- The throwaway Playwright config outside the repo (`pw.config.ts` in the scratchpad) was used for every e2e run; it is not committed.

## Verification

- `playwright test -c <throwaway config> --project=chromium tests/e2e/shell/uat-criteria.spec.ts tests/e2e/shell/mobile-sweep.spec.ts tests/e2e/shell/master-detail-nav.spec.ts` - 25 passed (4 + 6 + 15), 1.0 min
- `playwright test -c <throwaway config> --project=chromium-mobile` - 11 passed (3 touch-targets + 8 touch-tooltips), 18.4 s
- `--list` on the touch project: `Total: 11 tests in 2 files`
- `grep -c dashboard-nav` on mobile-sweep and uat-criteria: 0; `grep -cE "dashboard-nav|nav-link-|navOffset"` on touch-targets: 0
- `pnpm run check` - 0 errors, 0 warnings (304 files); `pnpm run lint` (prettier and eslint) - clean

## Known Stubs

None.

## Threat Flags

None. T-08-47 is mitigated: touch-targets measures Start over, Clear data and both confirm buttons at 44px or more and keeps the assertion that a tap only opens the panel. T-08-48 is mitigated: the sweep walks all eight panes and every disclosure in each, `expectPresent` still fails on a missing surface, and an equality guard fails if `PANE_IDS` and the expectation table drift apart.

## Self-Check: PASSED

- All four spec files exist and are modified; commits `7205719`, `d1d291f`, `ad19817`, `c16f81a` exist; plan acceptance criteria re-run and pass.
