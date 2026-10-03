---
phase: 05-vehicle-stats-financial-dashboards
plan: 12
subsystem: ui
tags: [svelte, windowed-table, sticky, search, sort, state-machine, live-region, scale]
requires:
  - 05-05
  - 05-07
  - 05-08
  - 05-09
  - 05-10
provides:
  - "vehicle-state.ts: the Vehicle block's pure state derivation, outcome acceptance, applied-ask reconcile, selection resets and status line"
  - "PlayerStats.svelte: the Vehicle statistics block — state machine, one live region, Game select, search, count line, title state lines, derived-value note, hints"
  - "VehicleTable.svelte: a native windowed table with a sticky header and first column, sort buttons, aria row semantics and CSSOM geometry"
  - "BUILT_DASHBOARDS holds activity-history, player-statistics and financial-data"
  - "tests/unit/vehicle-blocks.test.ts, tests/e2e/vehicle-stats.spec.ts"
affects:
  - src/lib/components/Dashboard.svelte
  - src/lib/dashboard-status.ts
  - src/lib/ui-copy.ts
  - tests/fixtures/player-stats-fixtures.ts
  - tests/fixtures/export-fixtures.ts
  - playwright.config.ts
  - .github/workflows/ci.yml
tech-stack:
  added: []
  patterns:
    - Windowed native table: two aria-hidden spacer rows write the omitted rows' height and the table's minimum width through element.style, never a style attribute (CSP)
    - Applied-ask reconcile: the worker answers with the values it APPLIED, so `requested` is rewritten from the view after every applied answer
    - Source-contract tests over hand-rolled Svelte components, which a vitest run with no Svelte plugin cannot render
    - A poll per layout assertion, because sticky offsets are resolved at paint and boundingBox forces layout without forcing one
requires-completed:
  - STATS-01
key-files:
  created:
    - src/lib/vehicle-state.ts
    - src/lib/components/PlayerStats.svelte
    - src/lib/components/VehicleTable.svelte
    - tests/unit/vehicle-state.test.ts
    - tests/unit/vehicle-blocks.test.ts
    - tests/e2e/vehicle-stats.spec.ts
  modified:
    - src/lib/dashboard-status.ts
    - src/lib/components/Dashboard.svelte
    - src/lib/ui-copy.ts
    - tests/unit/dashboard-status.test.ts
    - tests/unit/ui-copy.test.ts
    - tests/e2e/dashboard.spec.ts
    - tests/fixtures/player-stats-fixtures.ts
    - tests/fixtures/export-fixtures.ts
    - playwright.config.ts
    - .github/workflows/ci.yml
key-decisions:
  - "VEHICLE_COLUMN_LABELS is keyed on the worker's own VehicleColumn.key values (winRate, avgDamage, xp) rather than on a second vocabulary; 05-12 found the difference as a column headed `winRate`, and a contract test that builds a real view now fails on any key the inventory does not name"
  - "acceptVehicleOutcome takes the channel-scoped DataOutcome, not a raw worker response, so a superseded answer, a wrong dataset and a null result are all dropped at one boundary and the worker's detail is never carried into a failed block"
  - "The scroller keeps `position: relative` so the clip pattern's absolutely-positioned cell text is clipped by it; without it an 80-character cell's hidden suffix widened the PAGE at 375px"
  - "The windowed range is named `drawnRange`, never `window`: a `const window` shadowed the global and made the resize registration throw inside the mount flush"
  - "The three CI e2e limits move together (15/17/25 min to 18/20/26), because tests/unit/ci-budget.test.ts refuses a set where raising one of them would change which fires first"
requirements-completed:
  - STATS-01
actuals:
  tokens: 128000
  tasks: 3
  commits: 3
duration: 55 min
completed: 2026-10-02
coverage:
  - deliverable: "vehicle-state.ts: the four states, outcome acceptance, the applied-ask reconcile and the selection resets"
    verification:
      kind: "vitest"
      ref: "tests/unit/vehicle-state.test.ts"
      status: "pass"
    human_judgment: false
  - deliverable: "VehicleTable.svelte: native semantics, the two CSSOM spacers, sticky header and first column"
    verification:
      kind: "vitest"
      ref: "tests/unit/vehicle-blocks.test.ts"
      status: "pass"
    human_judgment: false
  - deliverable: "PlayerStats.svelte: the state machine, one explicit live region, the Game select, search, count line and hints"
    verification:
      kind: "vitest"
      ref: "tests/unit/vehicle-blocks.test.ts"
      status: "pass"
    human_judgment: false
  - deliverable: "The block in a browser: order, flips, aria-sort, specials last, counts, the no-match message, the announcement, the resets"
    verification:
      kind: "playwright"
      ref: "tests/e2e/vehicle-stats.spec.ts"
      status: "pass"
    human_judgment: false
  - deliverable: "5,000 vehicles: at most 30 rows, aria-rowcount 5,001, the end of the list, the scroll resets, sticky at two widths"
    verification:
      kind: "playwright"
      ref: "tests/e2e/vehicle-stats.spec.ts"
      status: "pass"
    human_judgment: false
  - deliverable: "The three-identifier page-wide live-region count, with the pending set down to payment-history"
    verification:
      kind: "playwright"
      ref: "tests/e2e/dashboard.spec.ts"
      status: "pass"
    human_judgment: false
---

# Phase 05 Plan 12: The Vehicle Statistics Block and Its Windowed Table Summary

Made the `Player_statistics` card live (`STATS-01`): a Vehicle statistics block
with a Game switcher and one sortable, searchable, windowed native table at a
time, its own state machine, its own live region, and selector state that resets
on a replace and on a Clear.

## Key Accomplishments

1. **`vehicle-state.ts` — the decisions, as pure functions.** Four states
   (`loading` / `ready` / `updating` / `error`) and the title state, one trust
   boundary (`acceptVehicleOutcome`), and one reconcile (`appliedAsk`) that is
   not optional: the worker answers with the values it APPLIED, so a `null` title
   comes back as the first title with rows, and without the rewrite the block
   would compare an ask the worker deliberately declined against a view that
   never intended to honour it and sit at "Updating table..." for ever.

2. **`VehicleTable.svelte` — a windowed NATIVE table.** Two `aria-hidden` spacer
   rows carry the omitted rows' height, `aria-rowcount` and `aria-rowindex` keep
   the position honest for a screen reader, the header sticks to the top of the
   scroller and the first column to its left edge, and every dynamic size is an
   `element.style` write from script because the CSP has no
   `style-src 'unsafe-inline'`. No `role="grid"`: replacing the native semantics
   is the one thing windowing must not do.

3. **`PlayerStats.svelte` — the composition.** The Game select with D-05's
   `(not in this export)` and `(no rows in this export)` suffixes in the option
   text and never disabled, the search over the cleaned id, the two count lines,
   the derived-value note, the two hints, and exactly one explicit live region
   present and empty in every state.

4. **A 5,000-vehicle browser proof.** At most 30 rows in the DOM against
   `aria-rowcount` 5,001, the oracle's first row, the end of the list, the scroll
   reset on every sort and a search, the sticky axes at 1280×720 and 375×667, an
   80-character unbroken id, both title states, the nickname canary's absence,
   and the reset after a replace and after a Clear.

5. **The card turns `ready` with the block.** `BUILT_DASHBOARDS` holds three
   identifiers, `payment-history` is the only pending section left that a phase
   will build, and `dashboard.spec.ts`'s page-wide explicit live-region count
   moves from two to three.

## Two bugs the 5,000-vehicle test found

Both made a 5,000-row table behave like an eighteen-row one, and neither was
visible at six rows:

- **`const window = $derived(...)` shadowed the global.** `window.addEventListener('resize', …)`
  in `onMount` resolved to the derived value and threw inside the mount flush, so
  the geometry effect below it never ran on the first pass: the spacer heights
  were never written and the scrollbar measured the drawn rows rather than the
  list. The range is now `drawnRange`, and the reason is in the comment.
- **A conditional dependency in the geometry effect.** Reading
  `window.padTopPx` inside `if (spacerEl !== null)` registers no dependency on
  the run where the refs are not bound, so the effect had nothing to re-run on
  when the rows arrived. The three derived values are now read into locals first
  and written after — a rule worth keeping in any effect that writes to an
  element ref.

A third, found in the same spec and fixed in Task 2's commit, is in the
"Deviations" list below: the copy inventory's column keys.

## TDD record

**Task 1 (tracer).** RED: `tests/unit/vehicle-state.test.ts` written first and
run against the pre-existing partial `vehicle-state.ts`, whose `acceptVehicleOutcome`
was typed against a `DataQueryOutcome` that does not exist in the repository —
`tsc` would never have compiled it, and the unit suite had never been run
against it. The three `dashboard-status` assertions failed on the two-identifier
built set. GREEN: the module was rewritten against the channel-scoped
`DataOutcome`, the two components were written, and `dashboard.spec.ts` was
migrated (three ready sections, the live-region count from two to three, and the
Player_statistics no-game-named assertion retired with a comment saying why).

**Task 2.** RED: `tests/unit/vehicle-blocks.test.ts` reported 7 failures naming
the search input, the count line, the hints, the derived values, `filterRows` /
`nextSort` / `zeroBattleCount` / `visibleColumns`, the selection reset, and the
`sorted` arrow. GREEN: the wiring, the notes and the source contracts.

**Task 3.** No unit RED: the 5,000-vehicle claims are all about geometry and
timing, which a vitest run with no DOM cannot reach. The RED is the browser spec
itself, and it is what found the two windowing bugs above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `VEHICLE_COLUMN_LABELS` was keyed on a vocabulary the worker
does not use**
- **Found during:** Task 2, by the tracer e2e spec
- **Issue:** `ui-copy.ts` (05-08) keyed the seventeen header labels on hyphenated
  slugs (`win-rate`, `avg-damage`, `total-xp`). The worker (05-05) emits
  camelCase `VehicleColumn.key` values (`winRate`, `avgDamage`, `xp`), and those
  are the values that reach the DOM in `data-testid="vehicle-sort-{key}"`. The
  table is the first place the two meet, and a key the inventory does not know
  falls through to printing itself: a column headed `winRate` where the UI-SPEC
  specifies `Win rate`.
- **Fix:** Rekeyed the inventory on the worker's keys, and added a contract test
  that builds a REAL view from the 05-01 hand fixture and fails if any of its
  column keys has no label of its own — so 05-14 adding a column cannot reach a
  reader as an identifier either.
- **Files modified:** `src/lib/ui-copy.ts`, `tests/unit/ui-copy.test.ts`,
  `src/lib/components/VehicleTable.svelte`, `tests/unit/vehicle-blocks.test.ts`
- **Commit:** c12ca27

**2. [Rule 1 - Bug] The 375px layout regression the new table introduced**
- **Found during:** Task 1, by the Phase 3 `(phone-375)` spec
- **Issue:** The visually-hidden cell text (a `no battles` suffix beside a dash)
  is `position: absolute`, and an absolutely positioned descendant escapes a
  scroll container's clip unless a POSITIONED ancestor sits between them. With
  no `position: relative` on the scroller, each suffix was laid out against the
  viewport at the far right of the 617px table, and the page's `scrollWidth` at
  375px was 475.
- **Fix:** `position: relative` on `.scroller`, documented as load-bearing for
  both the clip and the sticky axes.
- **Files modified:** `src/lib/components/VehicleTable.svelte`
- **Commit:** 5f63b04

**3. [Rule 1 - Bug] D-06's "no `button` in a section" assertion could not hold
with a sortable table**
- **Found during:** Task 1, by the Phase 3 `(sections-pending)` spec
- **Issue:** The assertion asserted zero `button` elements in every section card.
  The Vehicle table's six sort buttons are controls over the DATA, and 05-14 adds
  a column picker that is too; a `ready` section may hold those, and what it may
  not hold is a control over ITS OWN visibility.
- **Fix:** Narrowed the claim to the four cards where it is true, and asserted
  by name for Player_statistics that the six buttons that exist are the table's
  sort buttons and nothing else in the card is one.
- **Files modified:** `tests/e2e/dashboard.spec.ts`
- **Commit:** 5f63b04

**4. [Rule 1 - Bug] The 5,000-row table behaved like an 18-row table**
- **Found during:** Task 3, by the `(window-end)` spec
- **Issue:** The two windowing bugs described above: the shadowed `window` and
  the conditional dependency in the geometry effect.
- **Fix:** The range is `drawnRange`, and the effect reads its derived values
  before it writes them.
- **Files modified:** `src/lib/components/VehicleTable.svelte`
- **Commit:** ca265ec

**5. [Rule 2 - Missing critical functionality] The CI e2e budget guard failed**
- **Found during:** Task 3, by `tests/unit/ci-budget.test.ts`
- **Issue:** The guard pins `globalTimeout`, the shell wrapper and the job
  timeout against a projection of the suite's duration. Thirteen new browser
  tests took the projection from 665 s to 730 s, and the 1.3× floor on a 15-minute
  `globalTimeout` needs 949 s. The guard was right: the deadlines no longer
  covered the suite, and raising only one of the three would have changed which
  one fires first — the exact failure the guard exists to prevent.
- **Fix:** All three moved together, 15/17/25 min to 18/20/26, with the
  arithmetic written into the comments beside them.
- **Files modified:** `playwright.config.ts`, `.github/workflows/ci.yml`
- **Commit:** ca265ec

### Scope additions

- **`tests/fixtures/export-fixtures.ts` gained `omitFiles`.** D-05's
  `not-in-export` and `no-rows` are two different facts about the same folder,
  and the only way to reach the first for a title is for that title's files to be
  ABSENT while its siblings are not. `omitFolders` cannot express that, and
  overriding a file with a header-only CSV only reaches the second — so the two
  states would have been tested by one builder that proves one of them. Applied
  before `overrides`, so an override of an omitted file puts it back.
- **`tests/fixtures/player-stats-fixtures.ts` gained `firstRowCleanId`.** The
  oracle's `firstRowId` breaks ties on the raw `nation:Name`; D-12 says the table
  breaks them on the CLEANED id, and with 5,000 rows the top battle count is a
  tie. The same zero-import oracle is asked a second time over a `CLEAN_ID`
  column it can order by; the only line written here is the colon split.
- **`playwright.config.ts` and `.github/workflows/ci.yml`** — see Rule 2 above.

## Known Stubs

None. The block has no battle-type control, no per-title header, no battle-type
summary, no Warships or Warplanes notes and no column picker — those are
plan 05-14's, on these same component files, and their absence is a scope
boundary rather than a stub: every control 05-12 owns is present and wired.

## Requirements

`STATS-01` — the `Player_statistics` card is `ready` with a title switcher and
one sortable, searchable, windowed native table; a 5,000-vehicle list scrolls
with a bounded DOM; selector state resets on a replace and on Clear; the
page-wide explicit live-region count is three; the nickname never appears.

## Self-Check: PASSED

- `src/lib/vehicle-state.ts`, `src/lib/components/PlayerStats.svelte`,
  `src/lib/components/VehicleTable.svelte`,
  `tests/unit/vehicle-state.test.ts`, `tests/unit/vehicle-blocks.test.ts`,
  `tests/e2e/vehicle-stats.spec.ts` — all created and committed.
- `git diff --quiet -- package.json pnpm-lock.yaml src/lib/components/DashboardSection.svelte src/lib/components/Playtime.svelte` exits 0: no dependency was added and no
  Phase 3 or Phase 4 component was touched.
- `pnpm run test:unit` — 1297 passed, 44 files.
- `pnpm run check`, `pnpm run lint`, `pnpm run build` — exit 0.
- `pnpm exec playwright test` — 147 passed.
