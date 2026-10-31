---
phase: 14-design-unification
plan: 02
subsystem: ui
tags: [css, design-tokens, color-mix, contrast, srgb, vitest, guard]

# Dependency graph
requires:
  - phase: 14-design-unification (plan 14-01)
    provides: "src/styles/tokens.css with the new families, the brace-aware CSS scanner and the sRGB mixer, and a readTokenSource() that returned tokens.css PLUS app.css so a declaration was found in either file"
provides:
  - "src/styles/tokens.css: EVERY custom property of the app - the legacy chrome palette, --nav-offset, the Activity ramp, the flow colours and the Overview palette with the heat stops - moved verbatim with their contract comments"
  - "src/app.css: no custom property at all; the element resets, the shell layout and the one phone block, and nothing else"
  - "tests/helpers/styles.ts: readTokenSource() narrowed to src/styles/tokens.css alone"
  - "Five repointed token readers that ask for a DECLARATION, not for a file: contrast, the phase-8 colour and font guards, the phase-8 shell guards, map-model and overview-heat"
  - "tests/unit/charts/contrast.test.ts: the describe block 'heat scale (14-UI-SPEC Color, D-10/D-11)' - nine tests that pin the stops, the derived expressions, the mixed colours, the 3:1 floor, the strict lightness order and the 1.1:1 adjacent floor"
  - "The phase-8 colour guard's token-file exemption narrowed to src/styles/tokens.css alone"
affects: [14-03, 14-09, 14-19, 14-20, 14-21]

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 15570
  tasks: 3
  commits: 6
plan_head_before: 08ba62fa2d011a5cae953ed50d7b91a35c57e826
plan_head_after: 7dec0f7389e5a1291d15399d5369ac50469264da

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The token readers ask for a DECLARATION, never for a FILE: a helper that returns the token source lets a relocation be a pure move with no test edit"
    - "A relocation is checked against the BASELINE COMMIT, not against the previous commit: every custom property of app.css at 901a9e1 must be present in tokens.css with the same value"
    - "A derived colour is asserted in the space the CSS uses: the test parses the color-mix() expression, refuses any space but srgb, and mixes the channels the way the browser does"
    - "A colour-space drift and a dropped @supports fallback are proved by MUTATION, not by absence: the contract is a failing-first one against a contract that already ships"

key-files:
  created: []
  modified:
    - "src/app.css"
    - "src/styles/tokens.css"
    - "tests/helpers/styles.ts"
    - "tests/unit/charts/contrast.test.ts"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"
    - "tests/unit/guards/phase8-shell-guards.test.ts"
    - "tests/unit/logins/map-model.test.ts"
    - "tests/unit/overview/overview-heat.test.ts"

key-decisions:
  - "The readers were made location-agnostic BEFORE the move, in a separate commit, so the relocation needed no test edit at all - a test that changed in the same commit as the relocation would have hidden the move"
  - "appCssRootTokens() was rebuilt from tokenMap() rather than from a :root regex, because a token file holds more than one :root block once the @supports override is in it"
  - "The derived heat steps are declared TWICE on purpose: a plain fallback in the main :root and the color-mix() override in the @supports block. A 'declared once' guard (plan 14-03) must therefore count the fallback and the override, not the name"
  - "app.css came OFF the colour guard's token-file exemption once the move was done: it declares no custom property any more, so a stray --name: #hex there is a literal the guard must catch"
  - "The heat contract is proved by MUTATION rather than by a missing implementation: the scale already shipped in plan 14-01, so the plan's own acceptance criterion - break the colour space, break the fallback, see a named test fail - is the honest RED"

patterns-established:
  - "Pattern: readTokenSource() is the ONLY way a test reads a token, and it returns the ONE file a token is declared in - a reader that names a file is a reader that has to be edited when the token moves"
  - "Pattern: the value-preserving relocation - the moved declarations are checked against the baseline commit with a node one-liner, so 'moved verbatim' is a fact and not a claim"
  - "Pattern: the failing-first colour contract - the derived expression's STRING is asserted, the space is parsed and refused if it is not srgb, and the mixed channels are recomputed with mixSrgb, so a drift in any of the three fails a named test"

requirements-completed: [D-01, D-02, D-10, D-11]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "One file holds every custom property of the app: src/styles/tokens.css carries the legacy chrome palette, --nav-offset, the Activity ramp, the flow colours and the Overview palette with the heat stops, and src/app.css declares no custom property any more"
    requirement: D-02
    verification:
      - kind: other
        ref: "grep -nE \"^\\s*--[a-z]\" src/app.css -> no match (exit 1)"
        status: pass
      - kind: other
        ref: "grep -n \"nav-offset\" src/styles/tokens.css -> 134:  --nav-offset: var(--space-16);"
        status: pass
    human_judgment: false
  - id: D2
    description: "The relocation was value-preserving: every custom property src/app.css declared at the baseline commit 901a9e1 is declared in tokens.css with the same value, --nav-offset excepted"
    requirement: D-01
    verification:
      - kind: other
        ref: "node -e (the plan's moved-verbatim check) -> 'legacy tokens moved verbatim: 34', exit 0"
        status: pass
      - kind: unit
        ref: "pnpm run test:unit -> 161 files, 4835 passed, 9 expected fail, exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The five token readers find a declaration wherever it lives, so the relocation was a pure move: no reader names the file a token sits in"
    requirement: D-02
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards/phase8-ui-review-guards.test.ts tests/unit/guards/phase8-shell-guards.test.ts tests/unit/charts/contrast.test.ts tests/unit/overview/overview-heat.test.ts tests/unit/logins/map-model.test.ts -> 5 files, 179 passed"
        status: pass
      - kind: other
        ref: "grep -c readTokenSource (the five readers) -> 3, 3, 2, 2, 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "The heat scale contract exists as a named describe block and fails on a colour-space drift, a stop change or a dropped @supports fallback"
    requirement: D-11
    verification:
      - kind: unit
        ref: "tests/unit/charts/contrast.test.ts#heat scale (14-UI-SPEC Color, D-10/D-11) -> 9 tests pass"
        status: pass
      - kind: unit
        ref: "mutation: --heat-2 changed to color-mix(in oklab, ...) -> 'the derived steps are mixed in srgb, and the space is checked rather than assumed' FAILS (6 failed)"
        status: pass
      - kind: unit
        ref: "mutation: the @supports override emptied -> 'the derived steps are mixed in srgb, and the space is checked rather than assumed' FAILS (5 failed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-11 as amended is asserted rule by rule: the five data steps clear 3:1 on white with the empty swatch exempt at 1.14:1, lightness falls strictly across all six swatches, and adjacent data steps stay at least 1.1:1 apart"
    requirement: D-11
    verification:
      - kind: unit
        ref: "tests/unit/charts/contrast.test.ts#every data step clears 3:1 on white, and the empty swatch is exempt"
        status: pass
      - kind: unit
        ref: "tests/unit/charts/contrast.test.ts#lightness falls strictly from the empty swatch to level 5"
        status: pass
      - kind: unit
        ref: "tests/unit/charts/contrast.test.ts#adjacent data steps are at least 1.1:1 apart"
        status: pass
    human_judgment: false
  - id: D6
    description: "The colour guard asks where a hex may live, and it now has ONE answer: src/styles/tokens.css. src/app.css holds no declaration, so a stray --name: #hex there fails the guard"
    requirement: D-03
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts#no colour literal exists under src outside the token stylesheet and the allow-list"
        status: pass
    human_judgment: false
  - id: D7
    description: "The plan's own verification block is green end to end: unit, lint, type-check, build, the moved-verbatim check and the CI budget guard"
    requirement: D-01
    verification:
      - kind: other
        ref: "pnpm run lint && pnpm run check && pnpm run build -> all exit 0; the built CSS carries --ov-time"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards/ci-budget.test.ts -> 8 passed"
        status: pass
    human_judgment: false
  - id: D8
    description: "The webserver teardown guard cleans up only the processes it spawned, so the unit suite runs to completion instead of losing its worker to a self-inflicted SIGKILL"
    requirement: D-01
    verification:
      - kind: unit
        ref: "tests/unit/guards/webserver-teardown.test.ts -> 1 passed, and the orphan regression it guards is still asserted"
        status: pass
      - kind: other
        ref: "pnpm run test:unit -> 161 files, 4835 passing, twice in a row (it failed four times in a row before the fix)"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 36m
completed: 2026-10-26
status: complete
---

# Phase 14 Plan 02: One home for every token, and the heat contract

**Every custom property of the app now lives in `src/styles/tokens.css` and `src/app.css` declares none - the relocation is proved value-preserving against the baseline commit - and the heat scale has a failing-first contract that breaks on a colour-space drift, a swapped stop or a dropped `@supports` fallback.**

## Performance

- **Duration:** 1h 36m (two sessions: 84 min before the API interruption, 12 min after)
- **Started:** 2026-10-26T07:19:00Z
- **Completed:** 2026-10-26T20:12:00Z
- **Tasks:** 3
- **Files modified:** 9 (the plan's eight, plus the guard the close-out fix had to repair)

## Accomplishments

- `src/styles/tokens.css` holds EVERY custom property of the app - the legacy chrome palette, `--nav-offset`, the Activity ramp, the flow colours and the Overview palette with the heat stops - moved verbatim with their contract comments, and `src/app.css` declares no custom property at all.
- The relocation is proved, not claimed: the plan's node check compares every declaration of `src/app.css` at commit `901a9e1` with the token file and prints `legacy tokens moved verbatim: 34`, with `--nav-offset` the single spelling change (`16px` -> `var(--space-16)`).
- The five token readers now ask for a DECLARATION rather than for a FILE, so the move was a pure relocation: no reader names the file a token sits in, and the colour, font, shell, map-model and Overview tests pass on both sides of it.
- The heat scale has a failing-first contract: nine tests pin the three stops and the empty swatch, the two derived `color-mix(in srgb, ...)` expressions and their plain fallbacks, the channel averages, the 3:1 floor on the five data steps (the empty swatch exempt at 1.14:1), the strictly falling lightness across all six swatches and the 1.1:1 adjacent-step floor - and a colour-space drift or a dropped `@supports` fallback fails a named test.
- The colour guard now has one answer to "where may a hex live": `src/styles/tokens.css`. `src/app.css` came off the exemption list, so a stray `--name: #hex` there fails the guard instead of passing.
- The unit suite runs to completion: the pre-existing webserver teardown guard was killing its own runner with a SIGKILL, and it now cleans up only the processes it spawned - a fix proved necessary by reproducing the failure with the plan's files reverted, and proved effective by two consecutive green runs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make the six token readers location-agnostic** - `8b3feb7` (test)
2. **Task 2: Move the legacy custom properties from app.css to tokens.css, verbatim** - `235200a` (feat)
3. **Task 3: Pin the heat scale contract in contrast.test.ts** - `4bdefaf` (test)

Two follow-up commits closed what the move left behind, and a third fixed a pre-existing guard that killed its own runner:

4. **Drop `app.css` from the colour guard's token-file exemption** - `270cc83` (test)
5. **Correct the comments that still described the pre-move token source** - `4358836` (docs)
6. **Stop the webserver teardown guard from killing its own runner** - `7dec0f7` (fix)

**Plan metadata:** (this commit)

_Note: Task 3 is a TDD task over a contract that already shipped, so its RED is a MUTATION rather than a missing implementation - the plan's own acceptance criterion asks for exactly that (break the colour space, break the fallback, see a named test fail). Both mutations were run and both were reverted; the tree holds neither._

## Files Created/Modified

- `src/styles/tokens.css` - every custom property of the app: the plan 14-01 families, then the moved legacy chrome palette, `--nav-offset`, the Activity ramp, the flow colours and the Overview palette with the heat stops, in the original order inside the one `:root` block, each with the contract comment that explains it.
- `src/app.css` - no custom property; the `:root` element rule (font family, colour, background, size, line height), the element resets, the shell layout and the one phone block.
- `tests/helpers/styles.ts` - `readTokenSource()` narrowed to the raw text of `src/styles/tokens.css` alone; the transitional note is gone.
- `tests/unit/charts/contrast.test.ts` - the token readers repointed at `TOKEN_CSS`, `appCssRootTokens()` rebuilt from `tokenMap()`, `APP_CSS` kept for the one test that asserts the `:root` ELEMENT rule, and the new `heat scale (14-UI-SPEC Color, D-10/D-11)` describe block.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - the `--focus` and `--text` checks read the token source; the colour guard's `TOKEN_FILES` set narrowed to `src/styles/tokens.css`.
- `tests/unit/guards/phase8-shell-guards.test.ts` - the `--focus` declaration read from the token source, both token files excluded from the blue scan, and the app.css blue check kept as the last assertion.
- `tests/unit/logins/map-model.test.ts` - the ramp-hex parse reads the token source instead of `src/app.css`.
- `tests/unit/overview/overview-heat.test.ts` - `appCssToken` became `tokenValue` over the token source, and its error message names the token source rather than a file.
- `tests/unit/guards/webserver-teardown.test.ts` - the orphan-cleanup helper no longer scans the port and kills everything it finds; it names the processes the test spawned and nothing else.

## Decisions Made

- **The readers were made location-agnostic BEFORE the move, in their own commit.** A test that changed in the same commit as the relocation would have hidden the move: the suite would be green for a reason nobody could name. The two-commit order is what makes "the relocation needed no test edit" a checkable claim - and the check is that `8b3feb7` touched no file under `src/`.
- **`appCssRootTokens()` was rebuilt from `tokenMap()`, not from a `:root` regex.** The old helper extracted the FIRST `:root` block of the file it was given. A token file holds more than one `:root` block once the `@supports` override is in it, so a regex would have seen the fallbacks and missed the derived steps. `tokenMap()` sees every declaration, first wins, values lower-cased - which is the same shape the reader had before the move, whatever file it was pointed at.
- **The derived heat steps are declared twice on purpose.** `--heat-2` and `--heat-4` are declared once as a plain fallback (`var(--heat-low)`, `var(--heat-mid)`) and again inside `@supports (color: color-mix(in srgb, red, blue))` as the mix. That is what lets a browser without `color-mix()` show three bands instead of five levels. The consequence for the next plan: a "each token is declared once" guard must count the fallback and the override, not the NAME - the name appears twice by design.
- **`app.css` came off the colour guard's token-file exemption.** It was on the list so that the relocation would be a pure move; once the move was done it was a hole, because a file that may no longer hold a declaration must not be one where a declaration passes unnoticed. The exemption is now one file, and the comment above it says why.
- **The heat contract's RED is a mutation.** The scale already shipped in plan 14-01, so there was no missing implementation to fail against. The plan asks for the honest equivalent - change `in srgb` to `in oklab`, drop the `@supports` fallback, and watch a named test fail - and that is what was run and recorded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The colour guard still exempted `src/app.css` after the move**
- **Found during:** the close-out of the plan, after Task 3
- **Issue:** Task 1 put `src/app.css` on the colour guard's `TOKEN_FILES` set on purpose, so that the relocation would be a pure move ("this guard asks WHERE a hex may live, and plan 14-03's design-tokens guard is what pins the tokens to one file"). Once Task 2 had moved the legacy palette out, that exemption became a hole: `src/app.css` declares no custom property at all, yet a stray `--name: #hex;` in it would still have passed the guard as a "token declaration".
- **Fix:** `TOKEN_FILES` now names `src/styles/tokens.css` alone, and the comment above it explains the single-file exemption and why `app.css` is no longer on the list.
- **Files modified:** `tests/unit/guards/phase8-ui-review-guards.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/guards/phase8-ui-review-guards.test.ts` passes; the full unit suite (161 files, 4835 passed) and `pnpm run lint` are green with the change.
- **Committed in:** `270cc83`

**2. [Rule 1 - Bug] Three comments still described the pre-move token source**
- **Found during:** the close-out of the plan, after the guard fix
- **Issue:** after `readTokenSource()` was narrowed to one file, the comments above `TOKEN_CSS` (contrast), `TOKEN_SOURCE` (overview-heat) and `TOKEN_STRIPPED` (phase-8 colour guard) still said it returned "every stylesheet a custom property may live in", and the shell guard's comment still spoke of "the token stylesheets" in the plural. A stale comment is the same stale contract as a stale test name - this repo has already recorded that rule once (Phase 03): a comment that describes a state the code no longer has is a defect, not a harmless leftover.
- **Fix:** the three comments now name the file the declaration actually comes from and keep the durable part of the reasoning (the reader asks for a DECLARATION, not for a FILE); the shell guard's comment explains why `app.css` is still excluded from the blue scan - it holds no declaration, and its own blue check is the last assertion of that test.
- **Files modified:** `tests/unit/charts/contrast.test.ts`, `tests/unit/guards/phase8-shell-guards.test.ts`, `tests/unit/guards/phase8-ui-review-guards.test.ts`, `tests/unit/overview/overview-heat.test.ts`
- **Verification:** the five reader test files still pass (5 files, 179 tests) and `prettier --check` is clean on all four files.
- **Committed in:** `4358836`

**3. [Rule 3 - Blocking] The webserver teardown guard killed the vitest worker that ran it**
- **Found during:** the close-out verification - the plan's own `pnpm run test:unit` stopped exiting 0
- **Issue:** `tests/unit/guards/webserver-teardown.test.ts` cleaned up the orphan it is designed to catch by scanning `lsof -ti :4173` and SIGKILLing every pid that scan listed. That match is a socket on the port in EITHER direction, and the guard had just fetched the preview server, so the runner's OWN client socket was in the list: the guard killed the vitest worker running it, and the run ended with "Worker exited unexpectedly with signal SIGKILL during started state" instead of a test result. The same scan also killed whatever else held port 4173 - which, in this repository, took down a concurrent e2e run's processes.
- **Why it was fixed here:** the plan's acceptance criterion is `pnpm run test:unit` exits 0, and the failure made that unprovable. The bug is pre-existing and NOT caused by this plan: it was reproduced with all eight of the plan's files reverted to their pre-plan state (`08ba62f`), where it failed in exactly the same way.
- **Fix:** the cleanup now names the processes the test spawned and nothing else. The process tree is captured while it is alive (`descendantPids`), because the group kill re-parents the surviving server to launchd and the link back to the shell that started it is then gone; the captured pids are killed individually afterwards.
- **Files modified:** `tests/unit/guards/webserver-teardown.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/guards` goes from 19 passed + 1 SIGKILL to 20 files / 373 tests passed; `pnpm run test:unit` passes twice in a row (161 files, 4835 passing) where it had failed four times in a row before the fix, and the regression it guards is still asserted.
- **Committed in:** `7dec0f7`

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 bug, 1 blocking).
**Impact on plan:** The first two are consequences of the plan's own move, caught in the close-out. The third is a pre-existing bug in an unrelated guard that the plan's verification depends on; it was proved pre-existing by reverting the plan's files, and the fix touches no assertion of that guard - only which processes it is allowed to kill. No token name, token value or product decision changed.

## Issues Encountered

- `pnpm run test:unit` went red at the close of the plan and the fault was NOT this plan's. The failure was a vitest worker SIGKILLed while running `tests/unit/guards/webserver-teardown.test.ts`; it reproduced with the plan's eight files reverted to `08ba62f`, and it passed in isolation but failed inside the suite - the shape of a test that kills something it should not. The root cause (deviation 3 above) was found by reproducing the helper's scan by hand: a node process that has merely CONNECTED to port 4173 is listed by `lsof -ti :4173`, and the helper then killed it.
- The plan's own acceptance criterion for Task 1 says the reader count is "at least 1 for each of the five files" and names SIX readers (the phase-8 colour AND font guards live in one file). The landed counts are 3, 3, 2, 2, 2 - the criterion is met, and the discrepancy is in the plan's counting, not in the work.
- `readTokenSource()` returned "tokens.css plus app.css" in plan 14-01 so a declaration was found in either file. Between the two commits the five readers were repointed and the helper was narrowed, which is why the plan's Task 1 and Task 2 are two commits and not one: the intermediate state is the one where a reader can still find a declaration in either file.
- The plan's own node check counts 34 declarations, while the plan's prose says the `:root` block held "60-odd of them". The prose counted the whole file's custom properties loosely; the check counts the 34 declarations that were actually moved (the 35th line matching `--name:` in the old file is a contract COMMENT that names `--ov-star-fill`).

## Known Stubs

None. Every function the plan lists exists with a body, every token it names is declared exactly once with its original value (except the one spelling change the plan prescribes), and every deliverable is proved by a passing test or a passing command.

## Next Phase Readiness

- Plan 14-03 (the design-tokens guard) can now write "every custom property is declared in `src/styles/tokens.css` and nowhere else" as a fact rather than as a target: the file holds them all, and `src/app.css` holds none.
- Plan 14-09 (the heat consumers) has a contract to assert against - the stops, the derived expressions, the 3:1 floor on the five data steps, the strict lightness order and the 1.1:1 adjacent floor - and it will fail if a consumer's colour drifts from it. The `--ramp-*` tokens are still declared here and are deleted by 14-09 with their last consumer.
- The readers that read LAYOUT stay on `src/app.css` on purpose (the phase-5 layout guards, the shell guards' phone block, the identity model and the playtime charts); only the token reads moved.
- D-10 and D-01/D-02 are NOT marked complete in `REQUIREMENTS.md`: the shared-ID gate blocks them because sibling plans (14-09, 14-21 and the pane plans) declare the same ids and have no summary yet. They become ready when the last declaring plan finishes.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- Every file the plan declares is touched and committed: `src/app.css`, `src/styles/tokens.css`, `tests/helpers/styles.ts`, `tests/unit/charts/contrast.test.ts`, `tests/unit/guards/phase8-ui-review-guards.test.ts`, `tests/unit/guards/phase8-shell-guards.test.ts`, `tests/unit/logins/map-model.test.ts`, `tests/unit/overview/overview-heat.test.ts` - 8 files, 559 insertions, 210 deletions - plus the ninth file the close-out fix touched, `tests/unit/guards/webserver-teardown.test.ts` (9 files, 617 insertions, 227 deletions over the plan's range).
- Every task commit is an ancestor of HEAD: `8b3feb7`, `235200a`, `4bdefaf`, `270cc83`, `4358836`, `7dec0f7` (6 commits, 3 tasks). The working tree is clean.
- The plan-level verification was re-run end to end at the close of the plan: `pnpm run test:unit` exits 0 (161 files, 4835 passing and 9 the suite marks as expected), `pnpm run lint` exits 0, `pnpm run check` exits 0 (363 files, 0 errors, 0 warnings), `pnpm run build` exits 0 and the built CSS carries `--ov-time`, the moved-verbatim node check prints `legacy tokens moved verbatim: 34` and exits 0, and `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` passes (8 tests). The unit suite was run twice in a row after the last code commit, and both runs are green.
- Task acceptance criteria were re-checked against the landed work: `src/app.css` declares no custom property (grep exit 1), `--nav-offset` reads `var(--space-16)`, all five readers call `readTokenSource()` (3, 3, 2, 2, 2), `mixSrgb` appears 4 times in the contrast test, `D-11 as amended` appears, and the nine `heat scale` tests pass with the existing ramp, flow, Day 10 and Overview describes unchanged.

---
*Phase: 14-design-unification*
*Completed: 2026-10-26*
