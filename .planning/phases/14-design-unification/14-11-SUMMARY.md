---
phase: 14-design-unification
plan: 11
subsystem: ui
tags: [css, tokens, typography, display-role, shared-names, scroller, migration]

# Dependency graph
requires:
  - phase: 14-design-unification (plan 14-03)
    provides: "the pure offender functions and the shrinking PENDING_FILES allowlist a migrated file leaves"
  - phase: 14-design-unification (plan 14-04)
    provides: "the single type scale and the phase-7 isolation guard that accepts BOTH a local .scroller rule and the shared class"
  - phase: 14-design-unification (plan 14-06)
    provides: "the shared .caption/.body utilities in src/styles/utilities.css and the phone block in app.css that sets the tile numeral to 18px"
  - phase: 14-design-unification (plan 14-09)
    provides: "the heat scale the map already reads, and the corrected contrast contract this plan's comment now describes"
  - phase: 14-design-unification (plan 14-10)
    provides: "the playtime numeral that took the Display role, so the 30px size had one consumer left"
provides:
  - "the login tile numerals take the shared Display role (D-08): 26px at desktop width, 18px at 375px through the phone block, and the local dd rule declares no size, weight or line height of its own"
  - "SCALE_PX is exactly the six sizes of D-06 (12 / 14 / 18 / 26 / 32 / 56): the temporary 30 is gone from the app and the phase-8 guard now asserts that 30px is ILLEGAL everywhere"
  - "the login table and the two country/city lists use the shared .scroller region plus a local table-scroll or list-scroll hook for their own box, and none of the three defines .scroller itself"
  - "the phase-7 isolation guard reads the isolation out of src/styles/utilities.css for these three components, with no edit to the guard"
  - "the five components are on the token layer and OFF PENDING_FILES"

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 7980
  tasks: 2
  commits: 3
plan_head_before: f16b351959ac34d9dde37b4d559ffb80b4aab791a
plan_head_after: 52c7e0f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A role OWNS its three properties: the numeral's element carries .t-display in the markup and the local rule sheds the size, the weight and the line height, so the phone block's (0,2,1) rule still wins at 375px"
    - "A shared REGION is one class and a hook: the shared .scroller supplies min-width, overflow, isolation and the focus ring, and each file states only its own box under a hook class"
    - "A retired size is retired in the GUARD too: removing 30px from the scale means the self-test that pinned 30px as legal has to become a self-test that pins it as illegal"

key-files:
  created: []
  modified:
    - "src/lib/features/logins/LoginSummary.svelte"
    - "src/lib/features/logins/LoginMapSection.svelte"
    - "src/lib/features/logins/LoginTable.svelte"
    - "src/lib/features/logins/CityList.svelte"
    - "src/lib/features/logins/CountryList.svelte"
    - "tests/helpers/components.ts"
    - "tests/helpers/migration.ts"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"

key-decisions:
  - "The three COUNT tiles take .t-display and the three FACT tiles take .t-heading, not .t-display: the file's own documentation says the count tiles carry a Display-size numeral and the fact tiles a Heading-size value, because a revealed IPv6 address is 39 characters and a Display numeral would wrap it mid-token at tile width. The plan's action text says 'every tile dd', but only the count tiles were ever 30px; giving the fact values the Display role would have moved three values from 18px to 26px, a change the UI-SPEC's Allowed Visible Changes list does not allow, and it would have wrapped a 39-character address"
  - "The fact values' triple is unchanged and is carried by the ROLE: 18 / 600 / 1.3 is exactly .t-heading, so the local rule states only the difference it owns (`overflow-wrap: anywhere`) and the plan's requirement that the dd rule lose its size, weight and line height holds"
  - "The phase-8 guard's own self-test is edited even though that file is not in the plan's files_modified: plan 14-04 recorded the 30px size as 'temporary, until 14-11', and the plan's action (SCALE_PX loses 30) and its acceptance criterion (the guards suite exits 0) cannot both hold while a self-test asserts 30px is legal. The self-test now asserts the opposite"
  - "A comma-list rule stays TOP-LEVEL: `td.muted-cell, .ip.muted-cell` and `th.name, td.name` are lists, and a list can neither extend a sibling nor be extended by one under the D-05 guard - the rule plan 14-10 settled for the playtime summary's `th:last-child, td:last-child`"
  - "The hook states only the difference: CityList's two captions carried a local `.caption` whose only difference from the shared one was margin-top 8px, so they now carry the shared class plus `after-list`, whose single declaration is `margin-top: var(--space-8)`"

patterns-established:
  - "Pattern: the role owns the triple, the hook owns the difference - an element that matches a role exactly takes the class and its local rule keeps only what the role does not state"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-07, D-08, D-13]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The three login tile numerals take the Display role: 26px at desktop width (was 30px, D-08), 18px at 375px through the phone block, and the local dd rule declares no size, weight or line height"
    requirement: D-08
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/logins tests/unit/charts tests/unit/guards -> 37 files, 976 passed (the two components are off PENDING_FILES and satisfy the G1, G3, G4, G5, G6a and G6b sweeps)"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/logins/login-map.spec.ts tests/e2e/shell/master-detail-nav.spec.ts -> 22 passed (the off-scale-text sweep passes with no 30px anywhere in any pane)"
        status: pass
      - kind: other
        ref: "computed-style probe of the six tiles at 1280px and 375px -> the three count dd are 26px/600/33.8px at 1280 and 18px/600/23.4px at 375; the three fact dd are 18px/600/23.4px at BOTH widths"
        status: pass
    human_judgment: false
  - id: D2
    description: "The type scale is exactly the six sizes of D-06: SCALE_PX is 12 / 14 / 18 / 26 / 32 / 56, no 30px size remains in src, and the phase-8 guard now pins 30px as illegal"
    requirement: D-03
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards -> 30 files, 748 passed; grep -c 'font-size: 30px' src/ returns nothing"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/shell/master-detail-nav.spec.ts -> the off-scale-text sweep of every pane returns [] against BASE_SCALE"
        status: pass
    human_judgment: false
  - id: D3
    description: "The login table and the two lists use the shared focusable scroll region with their own box under a hook, and the isolation guard follows the class into the utility"
    requirement: D-02
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards tests/unit/logins -> 30 files, 748 passed (phase7-layout-guards judges the three through src/styles/utilities.css and needs no edit)"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/logins/login-table.spec.ts tests/e2e/logins/login-history.spec.ts -> 20 passed (sticky axes, the keyboard focus stop, and no page overflow at 375px)"
        status: pass
      - kind: other
        ref: "built CSS: .scroller{isolation:isolate;min-width:0;overflow:auto} with .table-scroll{max-height:480px} and two .list-scroll{max-height:320px;margin-top:var(--space-8)}; computed style of the rendered table scroller: isolation isolate, overflow auto, min-width 0px, max-height 480px"
        status: pass
    human_judgment: false
  - id: D4
    description: "The five components are token-based, nested where a parent rule exists, and off PENDING_FILES"
    requirement: D-01
    verification:
      - kind: unit
        ref: "pnpm run test:unit -> 164 files, 4899 passed, 9 expected fail; the five files are off PENDING_FILES and the G1/G3/G4/G5/G6a/G6b sweeps are clean"
        status: pass
      - kind: other
        ref: "pnpm run lint && pnpm run check && pnpm run build -> all exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "The map section's comment describes the heat scale as it is: every data step clears 3:1 on white and the empty shade is the neutral one"
    requirement: D-13
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/charts -> contrast.test.ts reads the shipped heat stops and the lightest measures 3.11:1 on white"
        status: pass
    human_judgment: false

# Metrics
duration: 33min
completed: 2026-10-27
status: complete
---

# Phase 14 Plan 11: Login history, first half - the second numeral, the map section, the shared scroll regions

**The last 30px in the app is gone: the login tile numerals take the Display role, the type scale is exactly the six sizes of D-06, and the login table and the two lists share one focusable scroll region with their own box under a hook**

## Performance

- **Duration:** 33 min
- **Started:** 2026-10-27T19:09:00+04:00
- **Completed:** 2026-10-27T19:42:00+04:00
- **Tasks:** 2
- **Files modified:** 8 (the plan's 7 plus the phase-8 guard - see Deviations)

## Accomplishments

- The last 30px in the app is gone. `SCALE_PX` is exactly the six sizes of D-06, the phase-8 guard now asserts that 30px is illegal everywhere, and the off-scale-text sweep in the shell spec passes with no 30px in any pane.
- The three login tile numerals take the Display role as a class in the markup, so the `dd` rule keeps only its layout, margin, min-width and colour. The three fact values keep the Heading role the file's own comment already named, so their triple is unchanged (18 / 600 / 1.3).
- `LoginMapSection` drops its local `.body` and `.caption` for the shared classes and its comment now describes the heat scale as it is: every data step clears 3:1 on white, the empty shade is neutral, and a shade is never the only carrier of a value.
- The three scrollers of the pane are one shared region. The shared class supplies `min-width: 0`, `overflow: auto`, `isolation: isolate` and the focus ring; the table's 480px bordered card is `table-scroll` and the two lists' 320px cap and 8px gap are `list-scroll`. None of the three defines `.scroller` any more, and the phase-7 isolation guard now reads the isolation out of `src/styles/utilities.css` with no edit to the guard.
- The five files are off `PENDING_FILES`; the allowlist is shorter by five entries.

## Task Commits

| Task | Commit | Subject |
|---|---|---|
| Task 1 | `df84cc9` | refactor(14-11): the login summary takes the Display role and the scale loses its 30 |
| Task 2 | `52c7e0f` | refactor(14-11): the three login scrollers share one focusable region |

## Files Created/Modified

| File | Change |
|---|---|
| `src/lib/features/logins/LoginSummary.svelte` | The three count `dd` take `t-display`, the three fact `dd` take `t-heading`; the `dd` rule loses size/weight/line-height; the local `.caption` is deleted; every size, weight, line height and gap is a token; `dl[data-testid]` and `dd.fact` are nested under their parents |
| `src/lib/features/logins/LoginMapSection.svelte` | The local `.body` and `.caption` are deleted for the shared classes; `h4`, the spacing and the frame's radius are tokens; `a:focus-visible` nests under `a`; the script comment describes the heat scale |
| `src/lib/features/logins/LoginTable.svelte` | `class="scroller table-scroll"`; the local `.scroller` and `.scroller:focus-visible` are deleted and the box moves to the hook; the local `.visually-hidden` is deleted for the shared utility; every size, weight, line height, padding and radius is a token; `th`/`td` states and `button` states nest under their parents |
| `src/lib/features/logins/CityList.svelte` | `class="scroller list-scroll"`; the two captions carry `after-list` beside the shared `caption`; the local `.caption` is deleted; the local `.scroller` is deleted for the shared class; everything is a token; the `summary` states nest under `summary` |
| `src/lib/features/logins/CountryList.svelte` | The same migration as CityList, without the caption hook |
| `tests/helpers/components.ts` | `SCALE_PX` is exactly 12 / 14 / 18 / 26 / 32 / 56 and the comment about the temporary 30 is deleted |
| `tests/helpers/migration.ts` | The five files leave `PENDING_FILES` |
| `tests/unit/guards/phase8-ui-review-guards.test.ts` | **Deviation - not in the plan's `files_modified`.** The self-test that pinned 30px as legal now pins it as illegal, and the two comments that enumerated the scale drop the 30 |

## Decisions Made

- **The count tiles take `.t-display`; the fact tiles take `.t-heading`.** The plan's action says "add `class="t-display"` to every tile `dd`", but only the three count tiles were ever 30px: the fact tiles were 18 / 600 / 1.3, and the file's own documentation says why ("the fact tiles carry a Heading-size value, because a revealed IPv6 address is 39 characters and a Display numeral would wrap it mid-token at tile width"). The plan's acceptance criterion says the markup applies the role to "every tile NUMERAL", and the UI-SPEC's Allowed Visible Changes list allows only the numerals to move. Giving the fact values the Display role would have moved three values from 18px to 26px - a change outside the allowed list - and would have wrapped a 39-character IPv6 inside a 168px tile.
- **The fact values' triple is carried by the role, not by tokens.** 18 / 600 / 1.3 is exactly `.t-heading`, so `dd.fact` states only `overflow-wrap: anywhere` and the plan's requirement that the `dd` rule lose its size, weight and line height holds for both kinds of tile.
- **A comma-list rule stays top-level.** `td.muted-cell, .ip.muted-cell` and `th.name, td.name` are lists; a list can neither extend a sibling nor be extended by one under the D-05 guard. This is the rule plan 14-10 settled for the playtime summary.
- **The phase-7 isolation guard needed no edit.** Plan 14-04 built it to accept both worlds - a component with its own `.scroller` rule, or a component with no local rule that carries the shared class - and proved both branches with self-tests. The three migrated components now take the second branch.
- **No pixel compare was run.** The plan does not ask for one, and the harness's `compare` subcommand reads the shared `before/` and `after/` sets, which plan 14-10 rebuilt. Overwriting them would have changed scratch state a later plan depends on. The computed-style probe below is the targeted substitute: it reads the rendered values and the rendered scroller, which is what the plan's change actually moves.

## Deviations from Plan

**1. [Rule 1 - Bug] The phase-8 guard's own self-test was edited, and that file is not in the plan's `files_modified`.**
- **Found during:** Task 1
- **Issue:** The plan's action sets `SCALE_PX` to exactly 12 / 14 / 18 / 26 / 32 / 56, and `fontSizeOffenders` in `tests/unit/guards/phase8-ui-review-guards.test.ts` reads that set. Its self-test asserted that a 30px size is LEGAL in a shell file, so the plan's own action and its own acceptance criterion ("`pnpm exec vitest run tests/unit/logins tests/unit/charts tests/unit/guards` exits 0") could not both hold. Plan 14-04's own commit message records the 30px size as "temporary, until 14-11", and the playbook's shared-file table lists this file as edited by every plan from 14-01 to 14-21, so this plan is where the retirement was meant to land.
- **Fix:** The self-test now asserts 30px is illegal everywhere, the sweep test's title and message enumerate the six sizes, and the two comments that listed the scale drop the 30. The legal-sizes self-test keeps 12px, 26px and 56px.
- **Files modified:** `tests/unit/guards/phase8-ui-review-guards.test.ts`
- **Commit:** `df84cc9`

**2. [Rule 3 - Interpretation] The fact tiles take `.t-heading` rather than `.t-display`.** See "Decisions Made". The plan's action says "every tile `dd`"; the plan's acceptance criterion says "every tile numeral"; the UI-SPEC's Allowed Visible Changes list allows only the numerals to move; and the file's own documentation states the fact tiles carry a Heading-size value. The literal reading would have changed three visible values that the plan does not allow to change.

## Issues Encountered

- **A stale `vite preview` holds port 4173** and serves a build from before this plan, so the committed Playwright config's `reuseExistingServer: false` cannot start its own server there. Every e2e run went through a temporary config in the repo root that moved `use.baseURL` and `webServer` to the free port 4174. The temporary file was moved out of the repository after the last run and was never committed; `playwright.config.ts` itself was not touched.
- **The plan's file list is incomplete in one place** (the phase-8 guard, above). It was fixed rather than worked around, because the plan's acceptance criterion requires the suite to be green.
- **The two lists do not render in the default fixture.** The country list needs a geo fixture and the city list needs the opt-in download, so the computed-style probe only saw the table scroller in the logins pane. The city list was covered by `tests/e2e/logins/login-city.spec.ts` (3 passed) and the country list by `tests/e2e/logins/login-map.spec.ts` (7 passed, re-run after the Task 2 change). The shared `.scroller` is one global rule, and the browser confirms it on the table scroller.
- **`tests/unit/overview/overview-grid.test.ts` did not flake.** The known starvation flake at the repo's 20 s `testTimeout` under full-suite load did not appear: the full unit suite ran 164 files / 4899 passed / 9 expected fail.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The logins group is half-migrated.** `LoginSummary`, `LoginMapSection`, `LoginTable`, `CityList` and `CountryList` are on the token layer and off `PENDING_FILES`. `LoginHistory.svelte` and `CityOptIn.svelte` are still pending and are the next plan's work.
- **The type scale is settled: six sizes.** Nothing in `src` declares 30px any more, and the guard says so.
- **The four table scrollers are now three.** `LoginTable`, `CityList` and `CountryList` share the region; `VehicleTable` still has its own local `.scroller` rule and is migrated by plan 14-13, after which no component defines `.scroller` itself.

## Open Items

- **`tests/e2e/_support/helpers.ts:541` - the R10 comment still says the stat tile numerals are 30px on desktop.** It is now false for BOTH panes: the playtime numeral became 26px in 14-10 and the login numeral became 26px in this plan. The file is in neither this plan's nor the next plan's `files_modified` list, so it was carried, not edited - the same treatment 14-09 gave `map-model.ts:36` and 14-10 gave this line. Whoever owns the shared e2e helpers should correct it.
- **`tests/e2e/shell/master-detail-nav.spec.ts:72` - the comment "Every other pane is held to the shared 14 / 18 / 26 / 30px scale alone"** still names the retired 30. The code itself is correct (`BASE_SCALE` is built from `SCALE_PX`), so this is stale wording only. That file is not in this plan's `files_modified` list either.
- **`tests/unit/device-info/device-info-blocks.test.ts:143` - `expect(['14', '18', '26', '30']).toContain(size)`** is a hard-coded superset of the scale. It passes (it only asserts membership) and `DeviceInfo.svelte` is still pending, but the list should shrink to the six sizes when that file is migrated.
- **The shared scratch `after/` capture set is stale for this build.** It was last written by plan 14-10 and does not contain this plan's 26px numerals. A later plan that compares the logins pane against the phase `before` baseline must read the `before` set as the PRE-PHASE baseline (captured WITHOUT the harness's settle wait) and the `after` set as captured WITH it - the loading-state difference is an artefact, not a regression - and the differences will be the title row (14-05), the heat colours (14-09) and the numerals (14-10 and 14-11), the three the playbook's allowed-changes list names.

## Self-Check: PASSED

- Every file the plan declares exists and is committed, plus the one deviation file: `git diff --name-only f16b351..52c7e0f` lists 8 files, the plan's 7 plus `tests/unit/guards/phase8-ui-review-guards.test.ts`. `git status --porcelain` is empty and the temporary Playwright config is out of the repository.
- Every task commit is an ancestor of HEAD: `df84cc9` (Task 1) and `52c7e0f` (Task 2), measured from `f16b351`.
- Every acceptance criterion was run by hand: `grep -c "t-display" src/lib/features/logins/LoginSummary.svelte` prints 3; `grep -n "new Set" tests/helpers/components.ts` shows `SCALE_PX` as `new Set([12, 14, 18, 26, 32, 56])`; `grep -c "table-scroll" src/lib/features/logins/LoginTable.svelte` prints 2; `grep -c "list-scroll" src/lib/features/logins/CityList.svelte src/lib/features/logins/CountryList.svelte` prints 2 for each; `grep -rn "font-size: 30px" src/` returns nothing.
- Both plan verify commands were run by hand against a build of the current tree: `pnpm exec vitest run tests/unit/logins tests/unit/charts tests/unit/guards` -> 37 files, 976 passed; `pnpm exec vitest run tests/unit/guards tests/unit/logins` -> 30 files, 748 passed; `pnpm exec playwright test tests/e2e/logins/login-map.spec.ts tests/e2e/shell/master-detail-nav.spec.ts` -> 22 passed; `pnpm exec playwright test tests/e2e/logins/login-table.spec.ts tests/e2e/logins/login-history.spec.ts` -> 20 passed. Both extra e2e specs that cover the two lists were also run: `login-city.spec.ts` -> 3 passed and `login-map.spec.ts` -> 7 passed.
- The standing checks pass on the committed tree: `pnpm run test:unit` -> 164 files, 4899 passed, 9 expected fail; `pnpm run lint` -> clean; `pnpm run check` -> 0 errors, 0 warnings; `pnpm run build` -> built.
- The value of the change was measured in the browser, not assumed: at 1280px the three count numerals compute 26px / 600 / 33.8px and the three fact values 18px / 600 / 23.4px; at 375px all six compute 18px / 600 / 23.4px; and the rendered table scroller computes `isolation: isolate`, `overflow: auto`, `min-width: 0px`, `max-height: 480px`, `border-radius: 6px`, `position: relative`.

---

*Phase: 14-design-unification*
*Completed: 2026-10-27*
