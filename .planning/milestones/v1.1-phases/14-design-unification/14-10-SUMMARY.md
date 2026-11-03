---
phase: 14-design-unification
plan: 10
subsystem: ui
tags: [css, tokens, typography, display-role, shared-names, status-tokens, migration]

# Dependency graph
requires:
  - phase: 14-design-unification (plan 14-02)
    provides: "the token stylesheet whose --fs-*, --fw-*, --lh-*, --space-* and --warn-* families the playtime files now read"
  - phase: 14-design-unification (plan 14-03)
    provides: "the pure offender functions and the shrinking PENDING_FILES allowlist a migrated file leaves"
  - phase: 14-design-unification (plan 14-06)
    provides: "the shared .caption/.body/.error utilities in src/styles/utilities.css and the phone block in app.css that sets the tile numeral to 18px"
  - phase: 14-design-unification (plan 14-09)
    provides: "the heat scale the pane's charts already read and the scratch capture set this plan's pixel gate measures against"
provides:
  - "the three playtime tile numerals take the shared Display role (D-08): 26px at desktop width, 18px at 375px through the phone block, and the local dd rule declares no size, weight or line height of its own"
  - "the Playtime block and the charts container are on the token layer and OFF PENDING_FILES: every size, weight, line height, spacing and radius is a token and every state that extends a rule is nested under it"
  - "the local .body, .caption and .error rules are DELETED rather than shadowed: the shared classes in src/styles/utilities.css state the same blocks, and the one caption that differed (1.5 line height) keeps the difference through the about-summary hook"
  - "the cache-cleared notice reads --warn-line, --warn-bg and --warn-ink instead of the three status hexes it restated, and the three colour allow-list entries that named only this file are deleted whole"
  - "the e2e states the new desktop numeral size and the unit reader states what the dd rule no longer decides"
affects: [14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 14-18, 14-19, 14-20, 14-21]

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 5012
  tasks: 2
  commits: 3
plan_head_before: 6e22a7acd098c913fd967ece38fcb85cf33e8b9e
plan_head_after: 8007293

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A role OWNS its three properties: when an element takes a shared type role, the local rule deletes the size, the weight and the line height, because a scoped rule that keeps a font-size outranks the global role and the migration silently does nothing"
    - "A shared name is DELETED, never shadowed: the local .body/.caption/.error rules go and the shared utility takes over, and the ONE element whose local rule differed keeps the difference through a hook class that states only that difference"
    - "A status colour moves to the token layer with its allow-list entry: the hexes leave the component, the --warn-*/--danger-* tokens take their place, and the colour allow-list entry loses the file or is deleted whole"

key-files:
  created: []
  modified:
    - "src/lib/features/playtime/PlaytimeSummary.svelte"
    - "src/lib/features/playtime/Playtime.svelte"
    - "src/lib/features/playtime/PlaytimeCharts.svelte"
    - "tests/unit/playtime/playtime-charts.test.ts"
    - "tests/e2e/playtime/playtime-ui-review.spec.ts"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"
    - "tests/helpers/migration.ts"

key-decisions:
  - "The three tile numerals take the .t-display CLASS in the markup rather than a local rule that restates the role: the class is one declaration site, and the phone block's `.shell .playtime-summary dd` rule still outranks it at 375px because the scoped role rule cannot compete with a (0,2,1) selector"
  - "The dd rule keeps every layout property and loses only the three the role owns: display, the flex alignment, the gaps, the margin, the minimum width, the colour and `overflow-wrap: normal` all stay, so the wrapping contract the comment describes is unchanged"
  - "The about paragraph's 1.5 line height is kept by the about-summary hook, not by restoring the local .caption rule: the shared .caption is 1.4, and the hook states the single difference the shared class does not"
  - "The status clip block stays a LOCAL .status.hidden rather than becoming the shared .visually-hidden: it is not named .visually-hidden, its margin: -1px is allowed because the rule declares clip, and a unit test asserts the local rule by name"
  - "The `th:last-child, td:last-child` and `tr.selected td` rules in the summary stay TOP-LEVEL: a rule with a comma is a list and can neither extend a sibling nor be extended by one under the D-05 guard, and no single-selector sibling exists for `tr`"
  - "The stale parenthetical in the dd rule's comment is replaced with the MEASURED geometry rather than carried forward: the old '118.9px inside a 105px tile' had been false since Phase 8's phone rule, and the new figures (92px inside a 130px dd at 375px, 113px inside a 248px one at 1280px) were read out of the browser"

patterns-established:
  - "Pattern: the role adoption - the element carries the shared class, the local rule sheds the three properties the role owns, and the reader asserts both halves (the class is present, the local rule is silent)"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-07, D-08, D-13]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The three playtime tile numerals take the Display role: 26px at desktop width, 18px at 375px, one line each, and the hours dd under 40px at 1280"
    requirement: D-08
    verification:
      - kind: unit
        ref: "tests/unit/playtime/playtime-charts.test.ts -> the three tile numerals take the Display role, and the local rule lets it win (3 dd openings carry class=\"t-display\"; the dd rule declares no font-size, font-weight or line-height)"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/playtime/playtime-ui-review.spec.ts -> 4 passed (G-04-UI-2 asserts the numeral is 26px at 1280 and 18px at 375, one line each, and the hours dd under 40px at 1280)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Playtime block and the charts container are on the token layer: the shared .body/.caption/.error take over, the about-summary hook keeps the one difference, and the cache-cleared notice reads the status tokens"
    requirement: D-02
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/playtime tests/unit/finance tests/unit/guards -> 41 files, 1039 passed (the four playtime files are off PENDING_FILES and satisfy the G1, G3, G4, G5, G6a and G6b sweeps)"
        status: pass
      - kind: other
        ref: "scratch capture compare, before-14-10 vs after-14-10 at 1280, 900, 899 and 375px -> 0 differing pixels at every width; the migration is value-preserving"
        status: pass
    human_judgment: false
  - id: D3
    description: "The colour allow-list loses Playtime.svelte, and the three entries that named only this file are deleted whole"
    requirement: D-01
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts -> no colour literal exists under src outside the token stylesheet and the allow-list; every allow-list entry matches something in each of its files (no stale entry)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The about paragraph, the error box and the cache-cleared notice look as before, and the calendar is still the pane's focal element"
    verification:
      - kind: automated_ui
        ref: "scratch after-set at 1280, 900, 899 and 375px in $TMPDIR/wg-phase14/after (reviewed by hand: the tiles read 14.5 hours / 13 / 13 at 26px on desktop and 18px on a phone, the filter chips, the game selector, the hours table and the calendar are unchanged)"
        status: pass
    human_judgment: true
    rationale: "The plan's own human-check asks for a look at the rendered pane; a pixel count cannot say whether the calendar is still the focal element or whether the notice reads as a notice"

# Metrics
duration: 40min
completed: 2026-10-27
status: complete
---

# Phase 14 Plan 10: Playtime pane on the token layer

**The playtime tile numerals take the shared Display role (26px at desktop width, 18px on a phone), and the Playtime block and the charts container move onto the shared text blocks and the status tokens with no visible change of their own**

## Performance

- **Duration:** 40 min
- **Started:** 2026-10-27T18:23:00+04:00
- **Completed:** 2026-10-27T19:03:00+04:00
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- **The tile numerals are the Display role, not a local size.** The three `dd` elements carry `class="t-display"`, so the numeral is 26px at desktop width (18px at 375px, where the phone block's `.shell .playtime-summary dd` rule still outranks the role), and the local `dd` rule no longer declares a size, a weight or a line height - a scoped rule that kept a `font-size` would have outranked the global role and the numeral would not have moved at all. The rule keeps every layout property it had, so the wrapping contract the comment describes is unchanged.
- **The Playtime block reads the shared text blocks.** The local `.body`, `.caption` and `.error` rules are deleted rather than shadowed: the shared classes in `src/styles/utilities.css` state the same three blocks, and `.error` follows `.body` there so `class="body error"` shows the danger colour. The one caption that was not the shared caption - the about paragraph at 1.5 line height - keeps the difference through the `about-summary` hook, whose single declaration is `line-height: var(--lh-body)`.
- **The cache-cleared notice reads the status tokens.** The three status hexes it restated (`#f9ab00` / `#fef7e0` / `#8a5a00`) become `--warn-line` / `--warn-bg` / `--warn-ink`, the radius goes through `var(--radius-sm)`, and the notice keeps the Body block through the shared class. The three colour allow-list entries that named this file lose it, and the three that named only this file are deleted whole.
- **Task 2 changed nothing on screen, and that is measured.** The scratch captures of the pane at 1280, 900, 899 and 375px are byte-identical before and after it (0 differing pixels at every width). Task 1's difference is the numerals alone: 30px to 26px, with the ~2px reflow below the tiles that a 2.2px shorter line box causes.

## Task Commits

Each task was committed atomically:

1. **Task 1: PlaytimeSummary - the tile numerals take the Display role** - `39dc264` (refactor)
2. **Task 2: Playtime and PlaytimeCharts - shared names, hook variants, status tokens** - `8007293` (refactor)

**Plan metadata:** see the plan's own commit (docs: complete plan)

_Note: TDD tasks may have multiple commits (test -> feat -> refactor)_

## Files Created/Modified

- `src/lib/features/playtime/PlaytimeSummary.svelte` - the three tile numerals take `t-display`; the `dd` rule sheds the three properties the role owns; every size, weight, line height and spacing value is a token
- `src/lib/features/playtime/Playtime.svelte` - the local `.body`/`.caption`/`.error` rules are deleted; the `about-summary` hook keeps the about paragraph's 1.5 line height; the notice reads the status tokens; the states are nested
- `src/lib/features/playtime/PlaytimeCharts.svelte` - the local `.caption` is deleted (identical to the shared one); the `h4` and the gaps are tokens
- `tests/unit/playtime/playtime-charts.test.ts` - one new test: the three numerals take the role, and the local rule declares none of the three properties the role owns
- `tests/e2e/playtime/playtime-ui-review.spec.ts` - the desktop numeral size is 26px, and the two comments that said 30px say 26px
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - `Playtime.svelte` leaves the six status-colour entries; the three entries that lost their last file are deleted whole
- `tests/helpers/migration.ts` - the three playtime files leave `PENDING_FILES`

## Decisions Made

- **The role is a class in the markup, not a restated rule.** The alternative - keeping the `dd` rule and writing `font-size: var(--fs-display)` into it - would have left two places that decide the numeral's size, and the phone block's `.shell .playtime-summary dd` rule outranks the scoped rule, so the phone width would have been decided by the phone block while the desktop width was decided by the component. One class, one decision.
- **The `dd` rule keeps its layout properties and loses only the three the role owns.** `display`, the flex alignment, `row-gap`/`column-gap`, `margin`, `min-width`, `color` and `overflow-wrap: normal` all stay, because they are the wrapping contract that the comment explains and the e2e asserts.
- **The status clip block stays a local `.status.hidden`.** It is not named `.visually-hidden`, so the shared utility does not apply to it; its `margin: -1px` is allowed because the rule declares `clip`; and the plan does not ask for the shared block here.
- **`th:last-child, td:last-child` and `tr.selected td` stay top-level in the summary.** A rule with a comma is a list and can neither extend a sibling nor be extended by one under the D-05 guard, and no single-selector sibling exists for `tr` - so the plan's "only where a single-selector sibling exists" condition is not met for either.
- **The stale comment was corrected, not carried.** The dd rule's comment claimed "the pair needs 118.9px inside a 105px tile", which had been false since Phase 8's phone rule (the tile is 163.5px wide today and the phone block sets the numeral to 18px). The parenthetical was replaced with the geometry read out of the browser at both widths.

## Deviations from Plan

None - the plan was executed as written. The one edit that was not literally spelled out in the plan - the measured geometry in the `dd` rule's comment - is the plan's own instruction to "update the comment's sizes".

## Issues Encountered

- **A stale `vite preview` holds port 4173** and serves a build from BEFORE this plan, so the committed Playwright config's `reuseExistingServer: false` cannot start its own server there and Playwright would have tested the stale build. Every e2e run went through a temporary config in the repo root that moved `use.baseURL` and `webServer` to the free port 4174. The temporary file was moved out of the repository after the last run and was never committed; `playwright.config.ts` itself was not touched.
- **The scratch harness can capture a pane mid-load.** `openPane` waits for the detail pane to become visible but not for the block's own `data-state="ready"`, so one capture caught the pane's "Calculating playtime..." state and compared a loading screen against a loaded one. The scratch harness (outside the repository) was given a settle wait - it waits for the block's ready state and then 500ms - and the playtime captures were taken again. The original is kept beside it as `harness.mjs.orig`. **This is a phase-level scratch-tool finding, not a repository change**: the `after` set is now captured with the wait and the `before` baseline set was not, so a later plan that compares the playtime pane against the baseline must read the difference as a loading-state artefact and not as a regression.
- **The `after` capture set was stale.** It was last written at 15:07, before plan 14-09's commits (17:52-18:08), so it did not contain the heat scale. It was moved aside as `after-14-09-stale` and the whole set was re-captured (`shots`, `overview` and `phone`) against the current build.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The playtime group is migrated.** All three playtime files are on the token layer and off `PENDING_FILES`; the next plan (14-11) starts the logins group and does not depend on anything left here.
- **The temporary 30px is still in `SCALE_PX`,** and plan 14-11 removes it once `LoginSummary` is done - as its own plan says.
- **Open item for a later plan: `tests/e2e/_support/helpers.ts:541`** still reads "R10 Stat tile numerals are 30px on desktop and 18px at 375px". It is now wrong for the playtime numeral, and plan 14-11 will make it wrong for the login numeral too. That file is in neither plan's `files_modified`, so it was not edited here; it is carried as an open item the way plan 14-09 carried `map-model.ts:36` and `FlowLegend.svelte`.

## Open Items

- `tests/e2e/_support/helpers.ts:541` - the R10 comment still says the stat tile numerals are 30px on desktop. Not in this plan's `files_modified`, and plan 14-11 (which owns the login numeral) does not list it either. Carried, not edited.
- The scratch harness's settle wait is a change to a shared scratch artifact made outside the repository. It is recorded here so the next plan knows the `after` set and the `before` baseline set were captured by different methods.

## Self-Check: PASSED

- Every file the plan declares exists and is committed: the three components, the three test files and the helper (`git diff --name-only 6e22a7a..HEAD` is exactly the plan's `files_modified` list, 7 files). `git status --porcelain` is empty and the temporary Playwright config is out of the repository.
- Every task commit is an ancestor of HEAD: `39dc264` (Task 1), `8007293` (Task 2) - 2 commits, 2 tasks, measured from `6e22a7a`.
- Every acceptance criterion was run by hand: `grep -c "t-display" src/lib/features/playtime/PlaytimeSummary.svelte` prints 3; `grep -c "about-summary" src/lib/features/playtime/Playtime.svelte` prints 2; `pnpm exec vitest run tests/unit/playtime tests/unit/finance tests/unit/guards` exits 0 with the three files out of `PENDING_FILES`; `pnpm run test:unit && pnpm run lint && pnpm run check && pnpm run build` exits 0.
- Both e2e verify commands were run by hand against a build of the current tree: `pnpm exec playwright test tests/e2e/playtime/playtime-ui-review.spec.ts` -> 4 passed, and `pnpm exec playwright test tests/e2e/playtime/playtime.spec.ts tests/e2e/playtime/playtime-charts.spec.ts tests/e2e/shell/mobile-sweep.spec.ts` -> 28 passed (and the whole `tests/e2e/playtime` directory -> 33 passed).
- The pixel gate was run by hand: the scratch captures of the playtime pane at 1280, 900, 899 and 375px were compared before and after Task 2 (0 differing pixels at every width) and before and after Task 1 (the numerals alone, confirmed by a side-by-side crop of the tile row and by a -2px vertical offset that aligns the whole region below the tiles at 899px).

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
