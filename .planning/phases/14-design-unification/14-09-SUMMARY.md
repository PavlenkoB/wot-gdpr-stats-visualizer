---
phase: 14-design-unification
plan: 09
subsystem: ui
tags: [css, tokens, heat-scale, colour-contract, migration, contrast]

# Dependency graph
requires:
  - phase: 14-design-unification (plan 14-02)
    provides: "the heat scale's four hex declarations in the token stylesheet and the contrast describe that owns them"
  - phase: 14-design-unification (plan 14-03)
    provides: "the pure offender functions and the shrinking PENDING_FILES allowlist a migrated file leaves"
  - phase: 14-design-unification (plan 14-08)
    provides: "the shell on the token layer and the scratch after-set this build's pixel gate measures against"
provides:
  - "the heat scale (D-11) is the ONE value scale in the app: the shared legend, the calendar heatmap, the hour grid, the duration bars and the country map all read var(--heat-empty) and var(--heat-1) to var(--heat-5)"
  - "the Activity ramp is DELETED: the six --ramp declarations are gone from src/styles/tokens.css and no --ramp- string survives anywhere in src or tests"
  - "the colour contract is expressed on the heat scale: the ramp describe and its helpers are removed from tests/unit/charts/contrast.test.ts, the flow and login-map blocks compare against the heat swatches, the Day 10 tripwire pins the heat stops and the empty swatch, and the Overview group dots are asserted to collide with no heat swatch"
  - "the four playtime files and the world map are token-based and OFF PENDING_FILES, so the playtime and logins groups are migrated"
  - "the two copy comments that described the old relief rule now describe the scale that ships"
affects: [14-10, 14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 14-18, 14-19, 14-20, 14-21]

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 19440
  tasks: 3
  commits: 3
plan_head_before: c72a632dce674abf53765685856180c00771d0f5
plan_head_after: d6ae79e0e631d831f2c55bdbe2f77e75652c395f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A retiring scale is DELETED, not deprecated: the six --ramp declarations, their contract comment and every assertion that pinned them go in one commit, and the one idea still true - rank-based discrete levels, a step never derived from the data, lightness falling strictly, no step restated as a literal - is folded into the replacement scale's own comment"
    - "The colour contract follows the colours: a describe that compared against a retired scale is rewritten against the scale that ships, so there is exactly one place each colour's meaning is asserted rather than one place per colour"
    - "A file leaves the pending allowlist only when it is token-based on its own terms: the four playtime files and the world map read the shared type, spacing and colour tokens, and the rules that extend a sibling are nested under it"

key-files:
  created: []
  modified:
    - "src/lib/charts/ChartLegend.svelte"
    - "src/lib/features/playtime/CalendarHeatmap.svelte"
    - "src/lib/features/playtime/HourGrid.svelte"
    - "src/lib/features/playtime/DurationList.svelte"
    - "src/lib/features/logins/WorldMap.svelte"
    - "src/styles/tokens.css"
    - "src/lib/ui-copy.ts"
    - "tests/unit/playtime/playtime-charts.test.ts"
    - "tests/unit/logins/map-model.test.ts"
    - "tests/unit/charts/contrast.test.ts"
    - "tests/unit/finance/currency-blocks.test.ts"
    - "tests/unit/charts/bar-chart-components.test.ts"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"
    - "tests/helpers/migration.ts"

key-decisions:
  - "The duration bars keep ONE fill, var(--heat-3), and not a five-step scale: the bars encode length and the number beside each bar carries the value, so five steps would imply an ordering of unrelated buckets the reader has to learn"
  - "The legend's relief rule is DELETED rather than reworded: each of the five data steps clears 3:1 on white, so no step needs the relief the old ramp's low steps required - the swatches stay aria-hidden because the words either side and the note carry the scale in text, not because the colours are too faint to read"
  - "The calendar and the hour grid take a LOCAL chart-scroll hook instead of the shared .scroller: a chart is not a keyboard-scrollable region, so it must not inherit the shared utility's isolation or its focus ring"
  - "The calendar's local .caption rule is DELETED and the shared utility takes over: the shared block states the identical muted 14px/400/1.4 note, so a scoped copy could only ever drift from the global one"
  - "The map's focus state nests under its own block (&:focus): .shape:focus extends .shape, which the D-05 guard forbids as a flat pair, and the nested form flattens to the same compound selector"
  - "The heat scale's two DERIVED steps are compared as the eight-bit hex the browser paints, read back through the stylesheet's own color-mix expression: a hand-written hex for a mixed colour would be a second answer to a question the stylesheet already answers"
  - "The map and the currency tests read their hexes from the token source rather than typing them out: the token stylesheet is the ONE declaration site, so a typed list is a second copy that drifts"

patterns-established:
  - "Pattern: the retiring scale - the old tokens, the old assertions and the old comments go together in one commit, and the replacement scale inherits the contract the old one carried"

requirements-completed: [D-01, D-02, D-03, D-05, D-10, D-11]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The shared legend, the calendar heatmap, the hour grid and the duration list read the heat scale, and all four files are token-based and off PENDING_FILES"
    requirement: D-11
    verification:
      - kind: other
        ref: "grep -c 'var(--heat-' src/lib/charts/ChartLegend.svelte src/lib/features/playtime/CalendarHeatmap.svelte src/lib/features/playtime/HourGrid.svelte -> 7, 6, 6 (at HEAD: 0); grep -c 'var(--heat-3)' src/lib/features/playtime/DurationList.svelte -> 1 (at HEAD: 0); grep -c 'chart-scroll' src/lib/features/playtime/CalendarHeatmap.svelte src/lib/features/playtime/HourGrid.svelte -> 2, 2 (at HEAD: 0)"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/playtime tests/unit/guards -> 35 files, 890 passed; the playtime-charts assertions now read the heat tokens, the .chart-scroll rule through ruleDeclarations + resolveTokens, and the legend's .row rule with the same brace-aware reader"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts -> the four files are in the G1, G3, G4, G5, G6a and G6b sweeps and every one is clean, and 'no pending file is clean' passes with the four removed from PENDING_FILES"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/playtime/playtime-charts.spec.ts tests/e2e/playtime/playtime-ui-review.spec.ts tests/e2e/shell/uat-criteria.spec.ts -> 26 passed (the levels and the geometry are asserted by data-level and by boxes; the 375px duration layout still wins)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The country map paints with the same six swatches as the legend, and the map is token-based and off PENDING_FILES"
    requirement: D-10
    verification:
      - kind: other
        ref: "grep -c 'var(--heat-' src/lib/features/logins/WorldMap.svelte -> 7 (at HEAD: 0); grep -rn -- '--ramp-' src/lib/features/logins/WorldMap.svelte -> no matches"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/logins tests/unit/guards -> 30 files, 747 passed; map-model.test.ts reads the four heat hexes from the token source and asserts the map holds var(--heat-empty) and var(--heat-1) to var(--heat-5)"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/logins/login-map.spec.ts -> 7 passed (the tracer test asserts the right countries at the level the scale rule gives, and the SVG still holds no text)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Activity ramp tokens are deleted and no --ramp- string survives anywhere in src or tests"
    requirement: D-10
    verification:
      - kind: other
        ref: "! grep -rn -- '--ramp-' src tests -> exits 0 with no match (at HEAD it found the token declarations, the five consumers and six test files)"
        status: pass
      - kind: unit
        ref: "grep -c 'D-11 as amended' tests/unit/charts/contrast.test.ts -> 1, and the heat describe still holds its own tests for the 3:1 floor on the five data steps, the strict luminance order across the six swatches and the 1.1:1 adjacent-step floor"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/charts/contrast.test.ts -> 1 file, 79 passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The colour contract is expressed on the heat scale: the ramp describe is gone, the flow and login-map blocks compare against the heat swatches, the Day 10 tripwire pins the heat stops, and the Overview dots collide with no heat swatch"
    requirement: D-11
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/charts tests/unit/finance tests/unit/logins tests/unit/playtime tests/unit/overview tests/unit/shell -> 66 files, 2461 passed"
        status: pass
      - kind: other
        ref: "the flow test 'neither is a data-scale swatch or the accent' compares the two flow hues against the six heat swatches read back from the stylesheet (the empty swatch, the three stops and the two mixed steps) and the accent #1a73e8; the Overview test 'the four catalogue group dots are distinct, and none of them is a heat swatch' holds --ov-time at its recorded value #1f7a74 and asserts no dot equals a heat swatch"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two copy comments that described the old relief rule now describe the scale that ships, and no string literal changed"
    requirement: D-01
    verification:
      - kind: other
        ref: "node -e \"...git diff -U0 901a9e1 -- src/lib/ui-copy.ts...\" -> prints 'ui-copy: comment-only diff'"
        status: pass
    human_judgment: false
  - id: D6
    description: "The whole change passes every gate: the unit suite, the lint, the type check and the build"
    requirement: D-03
    verification:
      - kind: unit
        ref: "pnpm run test:unit -> 164 files, 4897 passed, 9 expected fail (at the repo's 20 s testTimeout ceiling one starvation flake in tests/unit/overview/overview-grid.test.ts timed out in 2 of 3 runs; the same suite with --testTimeout=60000 passes, and that test file and every module it imports are byte-identical to the pre-plan commit c72a632)"
        status: pass
      - kind: other
        ref: "pnpm run lint -> exit 0; pnpm run check -> 0 errors and 0 warnings; pnpm run build -> exit 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "The calendar, hour grid, duration list and map read green to olive to dark gold, and the legend swatches match the marks"
    requirement: D-10
    verification:
      - kind: other
        ref: "the scratch screenshot harness (an out-of-repository artifact of plan 14-01) - NOT AVAILABLE in this environment: no harness.mjs exists outside the repository, so the plan's human-check was not run and the visible result is unverified by picture"
        status: unknown
    human_judgment: true
    rationale: "The scale's colours are the visible change, and only a picture shows that the empty cells are unchanged, that levels 1 to 5 read green to olive to dark gold and darken with value, and that the legend swatches match the marks. The scratch harness lives outside the repository and is not present here, and no committed artefact records the pane screenshots."

# Metrics
duration: 40 min
completed: 2026-10-27
status: complete
---

# Phase 14 Plan 09: the Activity ramp is replaced by the one heat scale

**Five consumers now read the same six swatches, the ramp's six declarations and every assertion that pinned them are gone, and the colour contract is stated once - on the scale that actually ships.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-10-27T17:40:00+04:00
- **Completed:** 2026-10-27T18:20:00+04:00
- **Tasks:** 3
- **Files modified:** 14 (0 created, 14 modified)

## Accomplishments

- **One value scale, five consumers.** The shared legend, the calendar heatmap, the hour grid, the duration bars and the country map read `var(--heat-empty)` and `var(--heat-1)` to `var(--heat-5)`. The scale is five DATA steps plus one neutral empty swatch, and each data step clears 3:1 on white - so the legend's relief rule is gone, not reworded: the swatches stay `aria-hidden` because the words either side and the note carry the scale in text, not because the colours are too faint to read.
- **The ramp is deleted, not deprecated.** The six `--ramp` declarations are out of `src/styles/tokens.css` and no `--ramp-` string survives anywhere in `src` or `tests`. The one idea the ramp's contract comment still carried - the levels are rank-based and discrete, a step is never derived from the data and the scale must not be interpolated, lightness falls strictly from the empty swatch to level 5, and no chart component may restate a step as a literal - is folded into the heat scale's own comment.
- **The colour contract follows the colours.** The ramp describe, the 04-UI-SPEC table parser, the ramp type and the ramp reader are gone from `contrast.test.ts`; the "other chrome" pairs survive as their own describe. The flow block now compares its two hues against the six heat swatches and the accent; the login-map block reads the heat scale and drops the 06-UI-SPEC table parse and the "steps 1 to 3 sit below 3:1" test that is false under the new scale; the Day 10 tripwire pins the three heat stops, the empty swatch and the two flow hues; and the Overview's group dots are asserted to collide with no heat swatch, with the Time dot holding its recorded value `#1f7a74`.
- **The playtime and map files are token-based and off the allowlist.** The four playtime files and the world map leave `PENDING_FILES`, so all six now satisfy the G1, G3, G4, G5, G6a and G6b sweeps. The calendar and the hour grid take a local `chart-scroll` hook - a chart is not a keyboard-scrollable region, so it must not inherit the shared `.scroller`'s isolation or focus ring - the calendar's local `.caption` rule is deleted in favour of the shared utility, and the map's `:focus` state nests under its own block so it no longer extends a sibling.
- **The copy comments describe the scale that ships.** The two `ui-copy.ts` comments that argued for the old relief rule now say what is true: a rank-based, discrete scale whose data steps each clear 3:1 on white, with the note still carrying the meaning in words. No string literal, template or function body changed - the diff is comment-only.

## Task Commits

Each task was committed atomically:

1. **Task 1: Heat on the playtime marks and the shared legend - ChartLegend, CalendarHeatmap, HourGrid, DurationList** - `fbbda95` (refactor)
2. **Task 2: Heat on the login world map - WorldMap** - `fba2df8` (refactor)
3. **Task 3: Delete the Activity ramp and every assertion and comment that described it** - `d6ae79e` (refactor)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/lib/charts/ChartLegend.svelte` - the six swatches read the heat tokens; the script comment states the new relief rule; the row's gap and type on tokens.
- `src/lib/features/playtime/CalendarHeatmap.svelte` - the cells read the heat tokens; the local `.caption` deleted for the shared utility; the scroller renamed to a local `.chart-scroll`; the year head's `h5` nested under its block; the cell separator on `--white`.
- `src/lib/features/playtime/HourGrid.svelte` - the cells read the heat tokens; the scroller renamed to a local `.chart-scroll`; the cell separator on `--white`.
- `src/lib/features/playtime/DurationList.svelte` - every bar filled with `var(--heat-3)`; the bar separator on `--white`; the gaps and the type on tokens; the `.row`, `.label`, `.count` and `.bar` rules stay top-level for the phone block.
- `src/lib/features/logins/WorldMap.svelte` - the five country levels read the heat tokens; the ring's inner stroke on `--white`; the focus state nested under `.shape`.
- `src/styles/tokens.css` - the six ramp declarations and their contract comment deleted; the heat group states the contract they carried.
- `src/lib/ui-copy.ts` - the two comments only; no string changed.
- `tests/unit/playtime/playtime-charts.test.ts` - the ramp assertions rewritten for the heat scale; the local regex reader replaced by `ruleDeclarations` + `resolveTokens`.
- `tests/unit/logins/map-model.test.ts` - the map reads the heat scale; the hexes read from the token source.
- `tests/unit/charts/contrast.test.ts` - the ramp describe and its helpers removed; the flow, login-map, Day 10 and Overview blocks expressed on the heat scale; the "other chrome" pairs kept as their own describe.
- `tests/unit/finance/currency-blocks.test.ts` - the hex list is the flow and heat colours, read from the token source; the prefix assertion is `not.toMatch(/var\(--heat-/)`.
- `tests/unit/charts/bar-chart-components.test.ts` - the same prefix swap.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - the five migrated files leave the `#ffffff` allow-list entry.
- `tests/helpers/migration.ts` - the five files leave `PENDING_FILES`.

## Decisions Made

- **The duration bars keep ONE fill, `--heat-3`.** The bars encode length, and the number beside each bar carries the value, so five steps would imply an ordering of unrelated buckets that the reader has to learn. The mid stop is the one the UI-SPEC names, and it measures 3.98:1 on white.
- **The legend's relief rule is deleted rather than reworded.** Each of the five data steps clears 3:1 on white, so the rule the old ramp's low steps required is no longer true of anything. The swatches stay `aria-hidden` for the reason that always held: the words either side of them and the note carry the scale in text.
- **The chart scrollers take a LOCAL hook, not the shared `.scroller`.** The shared utility is the focusable table region - it brings `isolation: isolate` and a focus ring - and a chart is neither. The local rule keeps `padding: 4px 0`, `overflow-x: auto` and `overflow-y: hidden`, which is the room the focus ring's overhang needs.
- **The calendar's local `.caption` is deleted, not kept as a variant.** The shared utility states the identical muted 14px/400/1.4 note, so a scoped copy could only drift away from the global one.
- **The map's `:focus` nests under `.shape`.** `.shape:focus` extends `.shape`, which the D-05 guard forbids as a flat pair; the nested form flattens to the same compound selector, so the specificity and the source order are unchanged.
- **The heat swatches are compared as the eight-bit hex the browser paints.** The two derived steps are `color-mix(in srgb, ...)`, so their hex is read back through the stylesheet's own expression rather than hand-written - a typed hex would be a second answer to a question the stylesheet already answers.
- **The map and currency tests read their hexes from the token source.** The token stylesheet is the ONE declaration site, so a typed list is a second copy that drifts when the scale moves.
- **The map legend note keeps its "logarithmic" wording.** The colour scale changed; the LEVELS did not - the map's cut points are still logarithmic - so the comment now distinguishes the two: a rank-based, discrete scale whose steps clear 3:1, and a note that says the scale is logarithmic rather than proportional.

## Deviations from Plan

None in scope. Two files outside the plan's `files_modified` carry prose that still says "ramp", and both were left alone deliberately:

- `src/lib/features/logins/LoginMapSection.svelte` (line 33, "The lightest steps of the ramp sit below the 3:1 non-text floor") - the plan assigns this comment to plan 14-11, when that file migrates.
- `src/lib/features/logins/map-model.ts` (line 36, "1 to 5 are the ramp") and `src/lib/charts/FlowLegend.svelte` (lines 11, 19, 20, "the ramp's six-step vocabulary") - neither file is in the plan's `files_modified`, and neither is named in the plan's stale-comment list. Both are prose only, contain no `--ramp-` token and break no guard; they are carried as an open item below rather than edited outside the plan's scope.

## Issues Encountered

- **A stale `vite preview` holds port 4173** and serves a build from BEFORE this plan, so the committed Playwright config's `reuseExistingServer: false` cannot start its own server there. The two e2e verify runs went through a temporary config in the repo root that overrode `use.baseURL` and `webServer` to port 4174, which was free. The temporary file was deleted after the run and was never committed; `playwright.config.ts` itself was not touched.
- **One starvation flake in the unit suite.** `tests/unit/overview/overview-grid.test.ts` ("across every pin subset, never leaves more sparse holes than not widening, and sometimes fewer") timed out at the repo's 20 s `testTimeout` ceiling in 2 of 3 full-suite runs; it enumerates all 2^N pin subsets and took 21.9 s under a 164-worker load. It is NOT a defect of this plan: the test file and every module it imports (`overview-grid.ts`, `overview-shared.ts`, `overview-definitions.ts`) are byte-identical between the pre-plan commit `c72a632` and HEAD (`git diff --stat c72a632..HEAD -- src/lib/features/overview/ tests/unit/overview/` is empty), and `vitest.config.ts` documents the 20 s ceiling as a starvation guard for exactly this class of failure. The suite with `--testTimeout=60000` passes 164 files, 4897 tests, 9 expected fail, exit 0 - so the assertion itself is sound and only the wall-clock ceiling was hit. It was left alone: raising the ceiling again would paper over a slow test becoming slower, which the config's own comment forbids.
- **The plan's human-check could not be run.** The scratch screenshot harness is an out-of-repository artifact of plan 14-01 and does not exist in this environment (no `harness.mjs` outside the repo), so the before/after comparison of the calendar, hour grid, duration list and map was not performed. The visible result of the colour change is therefore unverified by picture and is carried as an open item.

## Known Stubs

None. Every file the plan names exists with a body: the five tokenised components, the token stylesheet, the copy layer and the six test files.

## Requirements

D-01, D-02, D-03, D-05, D-10 and D-11 are listed in the plan's frontmatter. `REQUIREMENTS.md` carries no `D-*` ids at all - the phase-14 `D-xx` ids are the design-decision ids from `14-CONTEXT.md`, and the file's own requirement list (ACCOUNT-*, INSIGHT-*, PRIV-*, SCALE-*) is unaffected by this plan. No requirement checkbox was changed, and none needed to be.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The Activity ramp does not exist.** `grep -rn -- "--ramp-" src tests` finds nothing, so no later plan can read a token that is gone, and the plan that finally deletes the old copy can see there is no old copy left.
- **The playtime and logins groups are migrated.** Five of the six files under `src/lib/features/playtime/` and `src/lib/features/logins/` are off `PENDING_FILES`; `PENDING_FILES` holds 36 files. What is left in those two directories - `LoginHistory.svelte`, `LoginMapSection.svelte`, `LoginSummary.svelte`, `LoginTable.svelte`, `CityList.svelte`, `CityOptIn.svelte`, `CountryList.svelte` and `FinancialData.svelte`'s neighbours - is plan 14-11's and 14-12's.
- **`LoginMapSection.svelte` still carries the old relief-rule comment** (line 33). Plan 14-11 owns that file and should fix the comment in the same commit that migrates it.
- **`map-model.ts` and `FlowLegend.svelte` still say "ramp" in prose** (one comment each, and three lines in `FlowLegend.svelte`). They are outside this plan's file list, so they were left; whichever plan migrates those two files should correct the wording in the same commit.
- **The heat scale is now the app-wide value scale**, so the Overview's own heat stops (`--heat-low`, `--heat-mid`, `--heat-peak`) are the same three stops the playtime charts use. Plans 14-19 and 14-20 that touch the Overview palette must not fork them.
- **The scratch after-set is stale for this build.** The colour change is visible, so the harness's `after` set has to be rebuilt (move the old directory aside, then `shots`, `overview` and `phone`, because the harness skips existing files) before any later plan compares against it.

## Self-Check: PASSED

- Every file the plan declares exists on disk and is committed: the five components, `src/styles/tokens.css`, `src/lib/ui-copy.ts` and the six test files (all modified). `git status --porcelain` holds only the orchestrator's own `.planning/STATE.md` and `.planning/state.json` edits, and the temporary Playwright config is deleted.
- Every task commit is an ancestor of HEAD: `fbbda95` (Task 1), `fba2df8` (Task 2), `d6ae79e` (Task 3) - 3 commits, 3 tasks, measured from `c72a632` with `git rev-list --count`.
- Every acceptance criterion was run by hand: `! grep -rn -- "--ramp-" src tests` exits 0; `grep -c "D-11 as amended" tests/unit/charts/contrast.test.ts` prints 1; the plan's automated verify (`! grep -rn -- "--ramp-" src tests && pnpm run test:unit && pnpm run lint && pnpm run check && pnpm run build`) is green apart from the one documented starvation flake, which passes with a raised timeout; the ui-copy comment-only diff script prints `ui-copy: comment-only diff`.
- The two e2e verify commands were run by hand against a build of the current tree: `pnpm exec playwright test tests/e2e/playtime/playtime-charts.spec.ts tests/e2e/playtime/playtime-ui-review.spec.ts tests/e2e/shell/uat-criteria.spec.ts` -> 26 passed, and `pnpm exec playwright test tests/e2e/logins/login-map.spec.ts` -> 7 passed.

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
