---
phase: 05-vehicle-stats-financial-dashboards
plan: 20
subsystem: ui
tags: [css, svelte, typography, responsive, accessibility, playwright, vitest]

# Dependency graph
requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: the Vehicle statistics block, its BattleTypeSummary and VehicleTable components, and the shared sample fixture both browser tests import
  - phase: 03-dashboard-shell-account-identity
    provides: the DashboardNav `.screen-reader-only` rule whose `font-size: 0` the 14px floor scan deliberately allows (plan 03-05)
provides:
  - The Vehicle statistics controls render as one wrapping flex row at desktop and phone width (UAT G-05-8)
  - No text below 14px anywhere in the dashboard, guarded by a source scan of every component stylesheet plus app.css (UAT G-05-10)
  - The battle-type summary table scrolls inside a named, keyboard-focusable region and no longer widens its card at 375px
  - A new source-contract guard file, tests/unit/phase5-layout-guards.test.ts, that fails on the CSS regressions this plan fixed
affects: [07-polish-and-touch, phase-5 UAT re-run, any future component stylesheet author]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 10155
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-contract guards: a cheap vitest file reads component stylesheets off disk and pins the declarations that decide a layout outcome, so a regression fails there instead of in an expensive browser test"
    - "Two halves of one rule: a source scan catches a declaration the browser never applies (the 13px phone media query), a rendered walk catches the result of a declaration that survives"

key-files:
  created:
    - tests/unit/phase5-layout-guards.test.ts
  modified:
    - src/lib/components/PlayerStats.svelte
    - src/lib/components/BattleTypeSummary.svelte
    - src/lib/components/VehicleTable.svelte
    - tests/e2e/vehicle-stats.spec.ts

key-decisions:
  - "Keep `flex-wrap: wrap` on the controls row rather than fixing the column with `nowrap`. The row must still stack at 375px, so a fix that removed the wrap would pass the desktop test and break the phone one; the unit guard pins both declarations together for that reason."
  - "Keep the nation tag's `max-width` at 70px. The plan expected raising the tag to 14px might truncate `germany`; measurement said otherwise (56px of text at 14px, inside the 70px cap), so the smaller change was made and the measurement recorded in the component comment."
  - "Put the containment wrapper inside BattleTypeSummary, not PlayerStats. PlayerStats' bare `div` rule makes every div in it a flex column with a 24px gap, so a wrapper added there would change the card's layout rather than contain the table."
  - "Name the new scroll region with the existing `BATTLE_TYPE_SUMMARY_HEADING` constant rather than a new string, so the fix adds no copy and `tests/unit/ui-copy.test.ts` is untouched."
  - "Drop one existing assertion to an exact match (`getByLabel('Battle type', { exact: true })`) rather than renaming the region. The region's name contains the control's label, and the assertion's intent is that the CONTROL has one label."

patterns-established:
  - "A rule whose value is inherited from a broader rule states it explicitly: the controls row names its `flex-direction` because a bare `div` rule above it makes every div a column"
  - "A horizontal scroll container is focusable: `role=\"region\"` plus `tabindex=\"0\"` plus an accent `:focus-visible` ring, so a keyboard reader can reach content that scrolled out of view (WCAG 2.1.1)"

requirements-completed: [STATS-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The Game, Battle type and Search controls render as ONE wrapping flex row at 1280px, under 100px tall, with the three bottom edges within 2px of each other"
    requirement: STATS-01
    verification:
      - kind: unit
        ref: "tests/unit/phase5-layout-guards.test.ts#declares the Vehicle statistics controls row as a wrapping flex ROW"
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/vehicle-stats.spec.ts#(controls-row) the Game, Battle type and Search controls share ONE row at 1280"
        status: pass
    human_judgment: false
  - id: D2
    description: "No text anywhere in the dashboard renders below 14px at 1280px or at 375px, and no component lowers a size inside a media query"
    requirement: STATS-01
    verification:
      - kind: unit
        ref: "tests/unit/phase5-layout-guards.test.ts#declares no font-size below 14px in any component stylesheet or app.css"
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/vehicle-stats.spec.ts#(type-floor) no visible text is under 14px and no nation tag is truncated"
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/vehicle-stats.spec.ts#(phone-375) the battle-type table scrolls inside its card and nothing under main spills"
        status: pass
    human_judgment: false
  - id: D3
    description: "At 375px the battle-type summary table scrolls inside a keyboard-focusable region named by the existing h4, and neither the card nor the page is widened by it"
    requirement: STATS-01
    verification:
      - kind: unit
        ref: "tests/unit/phase5-layout-guards.test.ts#wraps the battle-type table in a named, focusable horizontal scroll region"
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/vehicle-stats.spec.ts#(phone-375) the battle-type table scrolls inside its card and nothing under main spills"
        status: pass
    human_judgment: false
  - id: D4
    description: "No nation tag is truncated by the 14px floor in the shared sample (germany is the widest)"
    requirement: STATS-01
    verification:
      - kind: e2e
        ref: "playwright: tests/e2e/vehicle-stats.spec.ts#(type-floor) no visible text is under 14px and no nation tag is truncated"
        status: pass
    human_judgment: false
  - id: D5
    description: "No new dependency, no inline style attribute, no copy-contract change and no new user-visible string; the real export is never used"
    requirement: STATS-01
    verification:
      - kind: other
        ref: "git diff --quiet -- package.json pnpm-lock.yaml (exit 0) and pnpm run test:unit (1361 passed, including tests/unit/ui-copy.test.ts)"
        status: pass
    human_judgment: false

# Metrics
duration: 22min
completed: 2026-10-02
status: complete
---

# Phase 05, Plan 20: Layout and Typography Gap Closure Summary

**The Vehicle statistics controls became a real flex row instead of an inherited column, six sub-14px text sizes were raised to the Caption role and guarded by a source scan, and the battle-type table now scrolls inside a named, keyboard-focusable region rather than widening its card at 375px**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-02T23:35:36+04:00
- **Completed:** 2026-10-02T23:57:04+04:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- **G-05-8 closed.** `PlayerStats.svelte` opens its stylesheet with a bare `div` rule that sets `flex-direction: column`, and the controls rule set only `display: flex` — so the Game, Battle type and Search controls inherited the column and stacked at 215px tall at every width. `.controls` now declares `flex-direction: row` beside the `flex-wrap: wrap` it must keep for 375px.
- **G-05-10 closed, sizes.** Six declarations were under the 14px Typography floor: the Caption rule and the picker's toggle labels in `PlayerStats`, the Caption rule and the table cells in `BattleTypeSummary`, the nation tag in `VehicleTable`, and a `13px` `@media (max-width: 480px)` block. All are at the Caption role (14/400/1.4) or deleted; the media query was removed because it was dead in the browser, which is why only a source scan could see it.
- **G-05-10 closed, containment.** The battle-type table is four `nowrap` columns and was 316px inside a 293px box at 375px, pushing the card's `scrollWidth` to 332 against 325. It now sits in a `role="region" tabindex="0"` box named with the existing `BATTLE_TYPE_SUMMARY_HEADING` constant, so no copy was added.
- **A guard that fails on the old code.** `tests/unit/phase5-layout-guards.test.ts` reads every component stylesheet and `app.css` off disk, strips comments, and pins the three properties that decide these outcomes. Its font scan parses each `font-size` VALUE rather than matching `px`, so `0.75rem` would fail rather than pass unread.

## Task Commits

Each task was committed atomically:

1. **Task 1: Controls render as a row, proven in source and in the browser (G-05-8)** - `0c5e399` (feat)
2. **Task 2: Bring every text size to the 14px floor and guard it (G-05-10)** - `85bc959` (feat)
3. **Task 3: Contain the battle-type table inside its card at 375px (G-05-10, D-07)** - `4d3b526` (feat)

## Files Created/Modified

- `tests/unit/phase5-layout-guards.test.ts` — NEW. Three source-contract guards: the controls rule's direction and wrap, the 14px floor across every stylesheet and `app.css`, and the battle-type scroll region's role, tab stop, name and overflow rules. Copies the comment-stripping pattern from `bar-chart-components.test.ts` and the rule-body-by-selector pattern from `contrast.test.ts` rather than importing across test files.
- `src/lib/components/PlayerStats.svelte` — `flex-direction: row` plus the `player-stats-controls` test id on the controls row; Caption and toggle-label rules at 14/400/1.4.
- `src/lib/components/BattleTypeSummary.svelte` — the `scroll-box` wrapper (`role="region"`, `tabindex="0"`, `aria-label={BATTLE_TYPE_SUMMARY_HEADING}`, `battle-type-scroller` test id) with its focus ring; Caption and cell rules at 14px. The existing `.scrolls` vertical bound is retained.
- `src/lib/components/VehicleTable.svelte` — nation tag at 14px with its fixed 18px line box; the dead `13px` phone media query deleted.
- `tests/e2e/vehicle-stats.spec.ts` — the `textUnderFloor` page-walk helper and three tests: `(controls-row)`, `(type-floor)` and a new 375px `(phone-375)` describe with its own context and one import. One existing `getByLabel` lookup made exact.

## Decisions Made

- Kept `flex-wrap: wrap` on the controls row. The bug was a column, and `nowrap` would also remove the column — but it would break 375px. The unit guard asserts both declarations so the two cannot drift apart.
- Kept the nation tag's `max-width` at 70px after measuring, rather than raising it as the plan anticipated. At 14px `germany` needs 56px of text (france 57, china and japan 51), so the existing cap still fits and the smaller change is correct. The measurement is in the component comment.
- Put the containment wrapper in `BattleTypeSummary`, not `PlayerStats`, whose bare `div` rule would have turned any wrapper there into a flex column with a 24px gap.
- Kept the `.scrolls` modifier for the vertical `max-height: 320px` bound rather than folding it into the new class, because that bound is a separate UI-SPEC requirement for exports with more than twelve codes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan assumption wrong - measured] The nation tag does not truncate at 14px, so `max-width` was not raised**
- **Found during:** Task 2 (14px floor)
- **Issue:** The plan stated that raising the tag to 14px "can truncate the widest nation" and directed raising `max-width` to the next multiple of 4 that stops truncating. Measured in Chromium with the exact `.nation` declarations, `germany` at 14px is 56px of text inside the existing 70px cap, so nothing truncates.
- **Fix:** Kept `max-width: 70px` and wrote the measurement into the component comment. An earlier draft of that comment claimed 88px as "measured rather than guessed"; it was not, and was corrected before committing.
- **Files modified:** `src/lib/components/VehicleTable.svelte`
- **Verification:** `(type-floor)` measures every rendered tag's `scrollWidth` against its `clientWidth` and fails on any offender — so the claim is enforced, not asserted.
- **Committed in:** `85bc959` (part of task commit)

**2. [Plan assumption wrong - measured] `min-width: 0` is not what fixes the spill**
- **Found during:** Task 3 (containment)
- **Issue:** The plan described `min-width: 0` on the wrapper as part of the fix. Mutation-tested it: deleting the declaration while keeping `overflow-x: auto` leaves the 375px containment test green, because the box is a block inside `<details>` and is already constrained by its parent's content box.
- **Fix:** Kept the declaration, because it is what preserves containment if the box ever becomes a flex or grid item, but both the component comment and the unit guard now say plainly that it is not what fixes today's bug.
- **Files modified:** `src/lib/components/BattleTypeSummary.svelte`, `tests/unit/phase5-layout-guards.test.ts`
- **Verification:** Deleting `overflow-x: auto` fails the 375px test at the ArrowRight assertion, so the containment assertions are load-bearing.
- **Committed in:** `4d3b526` (part of task commit)

**3. [Test-state leakage] `(type-floor)` restored the battle-type filter it changed**
- **Found during:** Task 2 (14px floor)
- **Issue:** The serial describe shares one page, and choosing a battle type is a FILTER. Leaving it selected made the following `(sort)` test read the wrong row set and fail on `data-battles`.
- **Fix:** The test now returns the select to the All option (`''`) and asserts it, matching the convention the `(warships)` test already used.
- **Files modified:** `tests/e2e/vehicle-stats.spec.ts`
- **Verification:** The full 24-test vehicle-stats spec passes.
- **Committed in:** `85bc959` (part of task commit)

**4. [Name collision] `getByLabel('Battle type')` matched the new region**
- **Found during:** Task 3 (containment)
- **Issue:** The region's accessible name is `BATTLE_TYPE_SUMMARY_HEADING`, "Battles by battle type", which CONTAINS the control's label. Playwright's substring matching made the existing `(battle-type)` assertion see two labels and fail.
- **Fix:** Made that one lookup exact. The assertion's intent is "this control has one label", which only an exact match states once an overlapping region name exists in the same block. No copy was changed and no assertion was weakened.
- **Files modified:** `tests/e2e/vehicle-stats.spec.ts`
- **Verification:** `vehicle-stats`, `dashboard` and `zero-network` specs all pass (70 tests).
- **Committed in:** `4d3b526` (part of task commit)

---

**Total deviations:** 4 auto-fixed (2 plan assumptions corrected by measurement, 1 test-state leak, 1 name collision)
**Impact on plan:** All four were correctness fixes inside the plan's declared files. No scope was added: the two measured items made the change SMALLER than planned rather than larger.

## Issues Encountered

- A standalone Chromium harness used to measure the tag widths produced inconsistent results because styles accumulated across loop iterations inside one document; the first two measurements were discarded and re-run with a fresh document or fresh inline style per candidate. The numbers recorded in the component comment come from the corrected run.
- The `(phone-375)` describe opens its own 375x667 context rather than resizing the shared page, because the default `page` fixture is sized by the Playwright config and resizing it would leak into every later test in the file.

## User Setup Required

None - no external service configuration required. The plan's `<human-check>` (dropping a real export to confirm visually) is local-only by design and was not run: the real archive is personal data.

## Next Phase Readiness

- UAT G-05-8 and G-05-10 both have a failing-on-old-code test for each part, so the gaps can be closed in `05-UAT.md` without a re-measurement.
- The deliberate omissions recorded in the plan's objective remain open and unchanged: the touch scroll cue for the three phone-width scrollers (with Phase 7, because a wording cue would change copy that `ui-copy.test.ts` pins verbatim), and the audit's further-recommended items — count-line weight, h4 colour, nation-tag colour, the off-scale 6px and 20px values, 44px touch targets, and the Playtime calendar stack.
- The e2e budget guard still passes with no raise: the listed total went 191 to 194, against the guard's ceiling of 218. `playwright.config.ts` and `ci.yml` were not touched.
- `tests/unit/phase5-layout-guards.test.ts` is a new file future component authors should extend rather than duplicate: a 12px caption anywhere under `src/` now fails there.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Completed: 2026-10-02*
