---
phase: 14-design-unification
plan: 04
subsystem: testing
tags: [css, svelte, guard, vitest, nesting, type-scale, tokens]

# Dependency graph
requires:
  - phase: 14-design-unification (plan 14-01)
    provides: "the brace-aware CSS scanner, the nested-aware rule reader and the shared stylesheets the guards read"
  - phase: 14-design-unification (plan 14-03)
    provides: "the pure offender functions, the shrinking PENDING_FILES allowlist and the token-scale rule"
provides:
  - "tests/unit/guards/nesting-guard.test.ts: the compile probe (the Svelte scoping of nested rules, the unused-selector warning, the top-level & error) and the per-component compile sweep"
  - "tests/helpers/components.ts: SCALE_PX widened to the ONE type scale - 12, 14, 18, 26, 30 (temporary), 32, 56px - with OVERVIEW_SCALE_PX kept until 14-21"
  - "the three older guards (phase 5, phase 7, phase 8) read rules with the shared nested-aware reader and hold every pane to one scale and one 12px floor"
affects: [14-05, 14-06, 14-07, 14-08, 14-09, 14-10, 14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 14-18, 14-19, 14-20, 14-21]

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 12806
  tasks: 2
  commits: 5
plan_head_before: d2d1bdb8c7c45b120c18d117a31401ed397384f8
plan_head_after: 251b5236bc6f8dc8e997e6d35578f52ccab19a04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A compiler contract is proved on a FIXTURE, in the same file as the sweep that depends on it: the fixture that proves the detector is live fails first when the detector stops firing"
    - "A guard that reads source reads it through ONE shared reader: a second copy of the reader is a second answer to the same question, and the copy was the blind one"
    - "A guard whose scope is loosened is only safe if the loosening is pinned by self-tests that state which sizes are legal and which are illegal"
    - "A guard that must survive a migration accepts both worlds - the state before and the state after - and fails only the state that is actually broken"

key-files:
  created:
    - "tests/unit/guards/nesting-guard.test.ts"
  modified:
    - "tests/helpers/components.ts"
    - "tests/helpers/css.ts"
    - "tests/unit/guards/css-helper.test.ts"
    - "tests/unit/guards/phase5-layout-guards.test.ts"
    - "tests/unit/guards/phase7-layout-guards.test.ts"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"

key-decisions:
  - "ONE type scale for the whole app (12, 14, 18, 26, 30, 32, 56px): the Overview's own scale is retired as a per-folder EXEMPTION, not as a set of sizes - 12px and 56px stay legal in every folder, and 18px and 26px stay legal in the Overview"
  - "ONE 12px font-size floor everywhere: the floor was a property of the SIZE, not of the file, and a per-file floor is a folder that can be exempt from a rule by where it lives"
  - "30px is in the scale TEMPORARILY and the comment says so: two numerals still declare it, plan 14-10 converts the playtime one and plan 14-11 the logins one, and plan 14-11 removes 30 from the set"
  - "The shared rule reader strips the COMMENTS before it scans: the scanner is not comment-aware, and an apostrophe in a comment (there are 116 such comments in the style blocks) swallowed the rest of the file and made a present rule look absent"
  - "The scroller guard accepts BOTH worlds - a local `.scroller` rule or the shared utility - so it holds before and after plans 14-11 and 14-13, and fails only a component that has neither"
  - "The sweep compiles with `generate: false` (analysis only, no output, no source map) and that option set is PROVED by a fixture in the same file, not asserted in a comment"
  - "OVERVIEW_SCALE_PX is kept exported and unchanged until plan 14-21: two readers still need it (the Overview component guard and the e2e spec's union of the two scales)"

patterns-established:
  - "Pattern: the compile probe - a fixture string, compiled with the SAME option set as the sweep, proves that the compiler reports what the sweep reads; the sweep then compiles every migrated component on every run"
  - "Pattern: the narrowing reader - the local `[^}]*` regex copies are replaced by the brace-aware helper, so a rule that nests is visible to the guard that asserts on it"
  - "Pattern: the single-scale self-test - a retired exemption is replaced by tests that state the legal sizes and the illegal ones, in the folders that used to differ, so a rule that still chose a scale by path would fail them"

requirements-completed: [D-03, D-05, D-06, D-14]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The Svelte scoping of nested rules is proven on a fixture: the top compound carries the scope class, every nested compound carries :where(.svelte-...), and the compiler drops a dead nested selector with the warning css_unused_selector"
    requirement: D-05
    verification:
      - kind: unit
        ref: "tests/unit/guards/nesting-guard.test.ts -> the Svelte scoping of nested rules (OI-10) -> 3 tests pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "The unused-selector detector is proven live in the SAME option set the sweep uses, so a sweep whose compiler mode went quiet would fail the fixture first"
    requirement: D-05
    verification:
      - kind: unit
        ref: "tests/unit/guards/nesting-guard.test.ts -> reports it in the analysis-only mode the sweep uses -> passes"
        status: pass
    human_judgment: false
  - id: D3
    description: "The sweep compiles every migrated component on every run and fails naming the file, the warning code and the selector"
    requirement: D-05
    verification:
      - kind: unit
        ref: "tests/unit/guards/nesting-guard.test.ts -> the nesting sweep over the migrated components (D-05) -> passes"
        status: pass
      - kind: other
        ref: "the by-hand check: a nested `& .nothere` added to AccountTimelinePane.svelte -> the sweep FAILS with 'src/lib/features/account-timeline/AccountTimelinePane.svelte: css_unused_selector - \"& .nothere\" matches no element and was dropped from the output' (reverted)"
        status: pass
    human_judgment: false
  - id: D4
    description: "One type scale for every pane: 12, 14, 18, 26, 30 (temporary), 32 and 56px, with the Overview folder no longer exempt and the self-tests stating which sizes are legal and which are illegal"
    requirement: D-03
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts -> the one type scale (14-04, D-03) -> 4 self-tests pass"
        status: pass
      - kind: other
        ref: "grep -c OVERVIEW_DIR tests/unit/guards/phase8-ui-review-guards.test.ts tests/unit/guards/phase5-layout-guards.test.ts -> 0 and 0 (at HEAD: 2 and 3)"
        status: pass
    human_judgment: false
  - id: D5
    description: "One 12px font-size floor everywhere, and the three regex copies of the rule reader replaced by the nested-aware helper in phase5 and phase7"
    requirement: D-06
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase5-layout-guards.test.ts -> the one font-size floor (14-04, D-06) -> 4 self-tests pass"
        status: pass
      - kind: other
        ref: "grep -c 'function ruleDeclarations' tests/unit/guards/phase5-layout-guards.test.ts -> 0 (at HEAD: 1); grep -c 'helpers/css.ts' -> 2 (at HEAD: 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The scroller guard follows the class into the shared utility and holds in both worlds - the local rule and the migrated one"
    requirement: D-06
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase7-layout-guards.test.ts -> the scroller verdict, on both worlds (14-04) -> 4 self-tests pass"
        status: pass
    human_judgment: false
  - id: D7
    description: "The plan's own verification block is green end to end: unit, lint, type-check, build, and the quick guard run every later plan repeats"
    requirement: D-06
    verification:
      - kind: other
        ref: "pnpm run test:unit -> 163 files, 4897 passed, 9 expected fail; pnpm run lint -> exit 0; pnpm run check -> 363 files, 0 errors, 0 warnings; pnpm run build -> exit 0"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards/design-tokens-guards.test.ts tests/unit/guards/nesting-guard.test.ts tests/unit/guards/phase5-layout-guards.test.ts tests/unit/guards/phase8-ui-review-guards.test.ts tests/unit/charts/contrast.test.ts tests/unit/guards/ci-budget.test.ts -> 6 files, 185 passed"
        status: pass
    human_judgment: false

# Metrics
duration: 8h 21m
completed: 2026-10-27
status: complete
---

# Phase 14 Plan 04: The nesting contract and the single type scale

**The nesting contract is proved against the Svelte compiler itself - a fixture shows the scope on every nested compound, a dead nested selector is reported as `css_unused_selector`, and every migrated component is compiled on every run - and the three older guards stop exempting the Overview, so one scale (12/14/18/26/30/32/56px) and one 12px floor now hold the whole app.**

## Performance

- **Duration:** 8h 21m elapsed (two executor sessions were lost to an API rate limit in the middle of the plan; the code was committed before each loss)
- **Started:** 2026-10-26T22:18:17Z (the plan's first commit)
- **Completed:** 2026-10-27T06:39:30Z
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- The nesting contract is PROVEN, not assumed: a fixture compiles a card with a nested `& .label`, a nested `&:hover` and a nested `@media`, and the compiled CSS carries the scope class on the top compound and `:where(.svelte-...)` on every nested compound. A second fixture proves the detector is live - a nested selector that matches no element is dropped from the output with the warning `css_unused_selector` - and it is compiled in the SAME mode (`generate: false`) the sweep uses, so the sweep's detector is proved by a test rather than claimed in a comment. A third fixture proves a top-level `&` is a compile error (`css_nesting_selector_invalid_placement`).
- Every migrated component is now compiled on every test run: the sweep reads the WARNINGS, not the compiled CSS, because a dead nested rule is not an error - the compiler removes it and says so in a warning `svelte-check` does not fail on. Verified by hand: a nested `& .nothere` added to `AccountTimelinePane.svelte` makes the sweep fail naming the file, the warning code and the selector (reverted).
- The Overview is no longer a folder with its own design generation: `SCALE_PX` is one set for every pane (12, 14, 18, 26, 30, 32, 56px), the phase-8 guard holds every file to that set, and the phase-5 guard's font-size floor is a single 12px everywhere. Both retirements are pinned by self-tests that state which sizes are legal and which are illegal, in the folders that used to differ - so a rule that still chose a scale by path would fail them.
- The three regex copies of the rule reader are gone from phase5 and phase7: both now use the brace-aware helper, so a rule that NESTS (`.card { & .controls { ... } }`) is visible to a guard that asserts on it. The old `[^}]*` body stopped at the first closing brace, and a guard written against an invisible rule passes vacuously.
- The shared reader itself was found to be comment-blind and was fixed: the scanner is not comment-aware, and an apostrophe in a comment (there are 116 such comments in the style blocks under `src/`) opened a quote the scanner never closed, so the rest of the file was read as one string and a PRESENT rule looked absent.
- The phase-7 scroller guard survives the migration: it accepts a component with its own `.scroller` rule (which must declare `isolation: isolate`) AND a component that has none but carries the shared `scroller` class (which the shared utility in `src/styles/utilities.css` must back), and fails only a component with neither.

## Task Commits

Each task was committed atomically, in the RED -> GREEN -> REFACTOR order for the TDD task:

1. **Task 1: The nesting compile probe and the per-component compile sweep** - `161580c` (test, RED), `27003be` (feat, GREEN), `d01ddaa` (refactor), `98901a5` (test - the sweep's compiler mode is proved by a fixture, not by a comment)
2. **Task 2: Retire the per-folder font exemption and the regex readers in the older guards** - `251b523` (test)

**Plan metadata:** (this commit)

_Note: Task 1 carries `tdd="true"`, so it produced the RED -> GREEN -> REFACTOR commits. The RED commit landed the guard with its assertions in place and the fixtures unimplemented; the GREEN commit made the compiler probe and the sweep real._

## Files Created/Modified

- `tests/unit/guards/nesting-guard.test.ts` - the compile probe and the per-component sweep: three fixtures (scoped nested output, the unused-selector warning, the top-level `&` error) and the sweep over every non-pending `.svelte` file with a `<style>` element.
- `tests/helpers/components.ts` - `SCALE_PX` widened to the one scale with a comment naming the plans that remove the temporary 30px; `OVERVIEW_SCALE_PX` kept, unchanged, with the reason it is still needed.
- `tests/helpers/css.ts` - the shared `ruleDeclarations` strips the comments before it scans.
- `tests/unit/guards/css-helper.test.ts` - the self-test for the comment-blind reader: a header comment holding an apostrophe no longer hides the rule behind it.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - one scale for every file, the folder exemption and its describe replaced by self-tests of the single scale.
- `tests/unit/guards/phase5-layout-guards.test.ts` - one 12px floor, the local reader replaced by the shared one at its three call sites, the per-file floor and its describe replaced by self-tests of the one floor.
- `tests/unit/guards/phase7-layout-guards.test.ts` - the local reader replaced by the shared one, and the scroller verdict split into the two worlds the migration will pass through.

## Decisions Made

- **The Overview's scale is retired as an EXEMPTION, not as a set of sizes.** 12px and 56px are now legal in every folder and 18px and 26px are legal in the Overview. A superset union would have left the Overview able to drift back towards the old scale without anybody noticing, which is exactly what the old exact-set rule existed to prevent - so the new rule is a single set everywhere, and the self-tests say so.
- **The floor is a property of the SIZE, not of the file.** 12px is the smallest size on the shared scale, so it is the floor everywhere; there is no per-folder floor to be exempt from.
- **30px is in the scale TEMPORARILY, and the comment says which plans remove it.** Two numerals still declare it; plan 14-10 converts the playtime one and plan 14-11 the logins one, and plan 14-11 removes 30 from the set. A scale that names its own temporary members is a scale that cannot be mistaken for a settled one.
- **The shared reader strips comments; the scanner does not.** This is the same lesson plan 14-03 learned for the role file and the token file, applied to the reader the older guards now share: the guard that reads the file must be the one that strips what the scanner cannot read.
- **The scroller guard accepts both worlds.** Plans 14-11 and 14-13 migrate the four components to the shared utility; a verdict that only knew the local rule would have to be rewritten mid-phase, and a verdict that only knew the shared class would have been blind today. Both branches are proved by self-tests, because a branch that never runs is a branch that has never been checked.
- **The sweep's compiler mode is proved, not assumed.** The plan asks for the option set that reports the unused-selector fixture to be established first; `generate: false` (analysis only, no output, no source map) reports it, so the sweep uses it, and a fixture compiles the same dead selector in that mode to keep the proof live.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The shared rule reader was comment-blind, so a present rule could look absent**
- **Found during:** Task 2, while replacing the phase-5 and phase-7 regex readers with the shared one
- **Issue:** `ruleDeclarations` in `tests/helpers/css.ts` scanned the raw stylesheet, and `scanRules` is not comment-aware. A stylesheet whose comment holds an apostrophe ("`caption`'s") opens a quote the scanner never closes: the rest of the file is read as one quoted string, NO rule is found, and the reader answers with the empty string - which a guard reads as "this component declares no such rule". There are 116 such comments in the style blocks under `src/`, so this was not a hypothetical.
- **Fix:** `ruleDeclarations` now strips the comments before it scans, exactly as `tokenMap` does. A self-test was added to `tests/unit/guards/css-helper.test.ts` that reproduces the case.
- **Files modified:** `tests/helpers/css.ts`, `tests/unit/guards/css-helper.test.ts`
- **Verification:** the css-helper self-test passes; the phase-5 and phase-7 guards find the rules they assert on.
- **Committed in:** `251b523`

**2. [Rule 1 - Bug] The sweep's compiler mode was claimed in a comment but not proved**
- **Found during:** Task 1, re-reading the landed file against the plan
- **Issue:** The plan asks for the option set that reports the unused-selector fixture to be established BEFORE the sweep uses it, and the file's header comment asserted that the fixture "is compiled with `generate: false` and the warning IS reported" - but the fixture test compiled it with `generate: 'client'`. The sweep itself uses `generate: false`, so the detector the sweep depends on was not the detector any test had proved. The threat register's T-14-17 names exactly this failure: a sweep whose detector never fires.
- **Fix:** a fourth test compiles the unused-selector fixture in the sweep's own mode and asserts the warning is still reported. The header comment's claim is now true.
- **Files modified:** `tests/unit/guards/nesting-guard.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/guards/nesting-guard.test.ts` -> 5 tests pass; the compiler reports `css_unused_selector` in BOTH modes (checked directly against `svelte/compiler`).
- **Committed in:** `98901a5`

---

**Total deviations:** 2 auto-fixed (2 bugs).
**Impact on plan:** Both fixes are inside the guards the plan already touches, and neither changes a rule, a threshold or a file list. Deviation 1 added two files outside the plan's `files_modified` (`tests/helpers/css.ts` and `tests/unit/guards/css-helper.test.ts`); deviation 2 added a test to a file the plan owns. No product decision changed.

## Issues Encountered

- **Two executor sessions were lost to an API rate limit (HTTP 429) mid-plan.** The first died after Task 1 had landed its three commits and while working on Task 2; the second died after the Task 2 work was staged but before it was committed. The resumed executor re-read the plan, checked the landed work against every acceptance criterion rather than trusting it, and found the phase-7 guard complete. Everything that survived is committed, and the two fixes above are the product of that re-reading.
- The `30px` size in `SCALE_PX` is a temporary member of the scale, and the plan's own text says so; the comment in `tests/helpers/components.ts` names plans 14-10 and 14-11 so a later reader can tell the difference between a settled scale and a transitional one.

## Known Stubs

None. Every file the plan names exists with a body: the compile probe, the sweep, the single scale, the single floor, the nested-aware readers and the two-world scroller verdict. `OVERVIEW_SCALE_PX` is a deliberate temporary export (D-14's designed exemption), not a stub: it has two live readers and plan 14-21 removes it.

## Requirements

D-03, D-05, D-06 and D-14 are listed in the plan's frontmatter. `requirements.ready-ids` returns **D-06** as the only ready id (the other three are blocked by the shared-ID gate: a sibling plan declares each of them and has no summary yet). `requirements.mark-complete D-06` was run and reported `not_found`: `REQUIREMENTS.md` carries no `D-*` ids at all - the phase-14 `D-xx` ids are the design-decision ids from `14-CONTEXT.md`, and the file's own requirement list (ACCOUNT-*, INSIGHT-*, PRIV-*, SCALE-*) is unaffected by this plan. No requirement checkbox was changed, and none needed to be.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 14-05 can migrate a pane: the scale it must land on (12/14/18/26/30/32/56px) and the floor it must respect (12px) are both in place, and the compile sweep will catch a dead nested selector in the first migrated style block.
- Every pane plan from 14-05 to 14-20 has its gate: migrate the file, remove it from `PENDING_FILES` in the same commit, and the suite stays green. A file left behind after it is clean fails the suite by name.
- The quick guard run every later plan repeats is the six-file command in the plan's verification block: it now includes the nesting sweep, so a migration that breaks the nesting contract fails in two seconds rather than in a pane's own suite.
- The tree state today: 57 files pending, the scale and the floor are one, the three regex readers are gone, and the four scroller components still carry their own rule until plans 14-11 and 14-13.

## Self-Check: PASSED

- Every file the plan declares exists on disk and is committed: `tests/unit/guards/nesting-guard.test.ts` (created), `tests/helpers/components.ts`, `tests/unit/guards/phase5-layout-guards.test.ts`, `tests/unit/guards/phase7-layout-guards.test.ts`, `tests/unit/guards/phase8-ui-review-guards.test.ts` (modified), plus `tests/helpers/css.ts` and `tests/unit/guards/css-helper.test.ts` (the deviation).
- Every task commit is an ancestor of HEAD: `161580c` (test/RED), `27003be` (feat/GREEN), `d01ddaa` (refactor), `98901a5` (test), `251b523` (test) - 5 commits, 2 tasks. The working tree holds no uncommitted change to the plan's files.
- The plan's acceptance criteria were each run by hand: the nesting sweep fails naming the file when a dead nested selector is injected into `AccountTimelinePane.svelte` (reverted); `grep -c OVERVIEW_DIR` prints 0 for both older guards (at HEAD: 2 and 3); `grep -c 'function ruleDeclarations'` prints 0 for phase5 (at HEAD: 1) and `grep -c 'helpers/css.ts'` prints 2 (at HEAD: 0); `pnpm exec playwright test --list` reports 273 tests in 33 files, and the ci-budget test passes.
- The plan-level verification was re-run end to end after the last code commit: `pnpm run test:unit` exits 0 (163 files, 4897 passed, 9 expected fail), `pnpm run lint` exits 0 (Prettier clean, ESLint clean), `pnpm run check` exits 0 (363 files, 0 errors, 0 warnings), `pnpm run build` exits 0, and the quick guard run passes (6 files, 185 tests).

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
