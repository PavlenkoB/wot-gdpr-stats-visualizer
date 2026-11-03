---
phase: 14-design-unification
plan: 03
subsystem: testing
tags: [css, design-tokens, guard, vitest, svelte, tokens, allowlist]

# Dependency graph
requires:
  - phase: 14-design-unification (plan 14-01)
    provides: "the brace-aware CSS scanner, the source reader, and the three shared stylesheets the guards read"
  - phase: 14-design-unification (plan 14-02)
    provides: "one token file for the whole app, and readTokenSource() narrowed to it"
provides:
  - "tests/helpers/token-guards.ts: the PURE offender functions for G1, G3, G4, G5, G6a, G6b, the CSS-network rule and the inline-style rule, plus the token-scale, the role and the declared-once rules"
  - "tests/helpers/migration.ts: PENDING_FILES - the 57 files that are still to migrate, sorted and self-policing"
  - "tests/unit/guards/design-tokens-guards.test.ts: 51 tests, a synthetic pass AND a synthetic fail for every rule family, and a sweep per family that asserts it visited files and declarations"
affects: [14-04, 14-05, 14-06, 14-07, 14-08, 14-09, 14-10, 14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 14-18, 14-19, 14-20, 14-21]

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 13756
  tasks: 1
  commits: 3
plan_head_before: b666b8059afbfcadffcc64895a300c262988cf0f
plan_head_after: 15e8413e819af5a4bf495a420bd1e27f348e3ef3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The offender logic is a PURE function over a source string, in a helper: a rule can be fed synthetic input and proved on a passing and on a failing case, and a scratch script can ask the same question without running a test"
    - "The allowlist is DATA in a helper, not code in the test: a pane plan edits the array and nothing else in the guard, so two pane plans never touch the same lines"
    - "A guard that reads nested source needs a scanner that is comment-aware: the comments go before the scan, or a comment in front of a selector becomes part of the selector"

key-files:
  created:
    - "tests/helpers/token-guards.ts"
    - "tests/helpers/migration.ts"
    - "tests/unit/guards/design-tokens-guards.test.ts"
  modified: []

key-decisions:
  - "The RED is a MUTATION-FREE stub state: the offender functions exist with their signatures and return nothing, so 26 of the 51 tests fail on their assertion - the guard sees nothing - rather than on a missing module"
  - "The allowlist is the set of files WITH an offender, computed by running the guards over the tree with an empty allowlist: a file is listed because it has something to migrate, never because someone remembered it"
  - "The 'sorted' contract of the allowlist is code-unit order, not locale order, so the list reads the same on every machine"
  - "The declared-once rule counts the DECLARATIONS, not the NAMES: --fs-title, --heat-2 and --heat-4 are declared twice by design and every other token may be declared once"

patterns-established:
  - "Pattern: the pure-offender helper - one function per rule family, each taking a source entry and returning '<name>: <rule> - <detail>' strings, so a failure names the file, the rule and the declaration"
  - "Pattern: the exemption lives with the rule it exempts - the token file is exempt from G1, G3 and G4 inside those three functions, so a reader of one function sees its whole contract"
  - "Pattern: the non-vacuous sweep - a sweep asserts the file count AND the declaration count it visited, so a guard that matches nothing fails instead of passing"

requirements-completed: [D-02, D-03, D-04, D-05, D-06, D-07, D-14]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The gated rules exist and bite: a migrated file with a raw size, weight or line height, a raw spacing value, a colour literal, a local definition of a shared name, two declarations on one line, or a rule that extends a sibling without nesting under it, fails a named test"
    requirement: D-03
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts -> 51 tests pass (G1, G3, G4, G5, G6a, G6b: a synthetic pass and a synthetic fail each)"
        status: pass
      - kind: other
        ref: "node .claude/gsd-core/bin/gsd-tools.cjs check tdd-red-evidence node_modules/.tmp/14-03-red-record.json --raw -> RED_EVIDENCE_OK, reason target_test_failed, 51 tests / 25 pass / 26 fail"
        status: pass
    human_judgment: false
  - id: D2
    description: "The ungated rules run on every file, pending or not: no url() and no @import in any stylesheet, no inline style attribute, every custom property declared in the token file and only there, the six-size type scale with its 12px floor, and exactly the nine roles in the role file"
    requirement: D-02
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts -> the network, the inline-style, the declared-once, the token-scale and the role sweeps pass"
        status: pass
      - kind: unit
        ref: "pnpm run test:unit -> 162 files, 4886 passed, 9 expected fail"
        status: pass
    human_judgment: false
  - id: D3
    description: "The allowlist is explicit, sorted, duplicate-free and self-policing: a pending file that has become clean fails the suite with the instruction to remove it, and a file that is not pending fails on any offender"
    requirement: D-14
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts#the PENDING_FILES allowlist -> the hygiene, the stale-entry and the no-clean-file tests pass"
        status: pass
      - kind: other
        ref: "the stale-entry check, run by hand: AccountTimelinePane added to the list -> the stale-pending test FAILS naming that file (reverted)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The allowlist is honest: it holds exactly the 57 files that have at least one offender, and the two files that are already clean are absent"
    requirement: D-14
    verification:
      - kind: other
        ref: "the list computed by running offendersByFile over every .svelte file under src/ plus the app stylesheet with an empty allowlist -> 57 entries"
        status: pass
      - kind: other
        ref: "grep -c AccountTimelinePane tests/helpers/migration.ts -> 0; grep -c src/app.css tests/helpers/migration.ts -> 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "The guards bite on the real tree: with the allowlist emptied the suite fails with offenders that name the unmigrated files and the rule each of them broke"
    requirement: D-05
    verification:
      - kind: other
        ref: "the empty-allowlist check, run by hand: PENDING_FILES = [] -> 6 sweep failures naming src/app.css, src/App.svelte and 55 more (reverted)"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards/design-tokens-guards.test.ts tests/unit/guards/css-helper.test.ts -> 2 files, 79 passed"
        status: pass
    human_judgment: false
  - id: D6
    description: "The plan's own verification block is green end to end: unit, lint, type-check, build, and the quick guard run"
    requirement: D-06
    verification:
      - kind: other
        ref: "pnpm run lint && pnpm run check && pnpm run build -> all exit 0; svelte-check: 363 files, 0 errors, 0 warnings"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards/design-tokens-guards.test.ts tests/unit/guards/phase5-layout-guards.test.ts tests/unit/guards/phase8-ui-review-guards.test.ts tests/unit/charts/contrast.test.ts tests/unit/guards/ci-budget.test.ts -> 5 files, 179 passed"
        status: pass
    human_judgment: false

# Metrics
duration: 16 min
completed: 2026-10-26
status: complete
---

# Phase 14 Plan 03: The design-token guards, and the allowlist that shrinks

**Every gated rule reads nested, token-based source and refuses everything else - and the 57 files that are still to migrate sit on an explicit, sorted, self-policing allowlist that cannot rot: a pending file that has become clean fails the suite with the instruction to remove it.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-26T21:24:00Z
- **Completed:** 2026-10-26T21:40:00Z
- **Tasks:** 1
- **Files modified:** 3 (all created)

## Accomplishments

- The six gated rules exist BEFORE a single pane is migrated, and they bite: a raw size, weight or line height, a raw spacing value, a colour literal, a local definition of a shared name, two declarations on one line, or a rule that extends a sibling without nesting under it - each fails a named test.
- The offender logic is PURE and lives in one helper (`tests/helpers/token-guards.ts`), so every rule has a synthetic passing case AND a synthetic failing case, and a one-off scratch script can ask the same question without running a test.
- The ungated rules run on EVERY file, pending or not: no `url()` and no `@import` in any stylesheet, no inline `style=` attribute, every custom property declared in `src/styles/tokens.css` and only there, the six-size type scale with its 12px floor, and exactly the nine `.t-*` roles in the role file.
- `PENDING_FILES` holds the 57 files that still have something to migrate, computed by running the guards over the tree with an empty allowlist - not by remembering. The two files that are already clean are absent: the one plan 14-01 migrated and the one that never held anything.
- The list cannot rot: a pending file with zero offenders fails the suite naming the file to remove, so a pane plan is green only after it edits the list.
- The RED is a real one: the offender functions existed with their signatures and returned nothing, and 26 of the 51 tests failed on their assertion - the guard sees nothing - rather than on a missing module. The classifier returns `RED_EVIDENCE_OK`.

## Task Commits

Each task was committed atomically, in the RED -> GREEN -> REFACTOR order:

1. **Task 1: Token, shared-name, nesting-shape, network and role guards, with the shrinking PENDING_FILES allowlist** - `b245308` (test, RED), `d58e4e3` (feat, GREEN), `15e8413` (refactor)

**Plan metadata:** (this commit)

_Note: Task 1 carries `tdd="true"`, so it produced the three TDD commits. The RED was a stub state rather than a missing implementation: the module loaded and every failure was an `AssertionError`._

## Files Created/Modified

- `tests/helpers/token-guards.ts` - the pure offender functions: `cssOf`, `fontOffenders`, `spacingOffenders`, `colourOffenders`, `sharedNameOffenders`, `declarationLineOffenders`, `nestingOffenders`, `networkOffenders`, `styleAttributeOffenders`, `roleOffenders`, `tokenScaleOffenders`, `declaredOnceOffenders`, `offendersByFile` and `pendingListFailures`. Every offender reads `<name>: <rule> - <detail>`.
- `tests/helpers/migration.ts` - `PENDING_FILES`: the 57 files that are still to migrate, sorted, with the contract in the header.
- `tests/unit/guards/design-tokens-guards.test.ts` - 51 tests: a describe per rule family with a synthetic pass and a synthetic fail, then the sweep over the real tree.

## Decisions Made

- **The RED is a stub state, not a missing module.** The plan's research had already found that a guard written against an invisible rule is a guard that passes vacuously; a RED that failed on a missing import would have proved nothing about the behaviour. The RED commit therefore ships the API with empty bodies, and 26 of the 51 tests fail on their assertion. The evidence was captured with the JUnit reporter and classified `RED_EVIDENCE_OK` (`reason: target_test_failed`, 51 tests / 25 pass / 26 fail).
- **The allowlist is the set of files WITH an offender, not a remembered list.** It was computed by running `offendersByFile` over every `.svelte` file under `src/` plus the app stylesheet with an empty allowlist. A file is on the list because the guards found something in it.
- **"Sorted" means code-unit order.** The default `Array.prototype.sort` compares UTF-16 code units and is the same on every machine; `localeCompare` is not, and the list is read by a test on every machine.
- **The declared-once rule counts the DECLARATIONS, not the NAMES.** `--fs-title` is the default plus the 900px switch, and `--heat-2` and `--heat-4` are the plain fallback plus the `color-mix()` override. Those three names may appear twice in the token file and nowhere else; every other token may appear once in the token file and nowhere else.
- **The exemptions live with the rule they exempt.** The token file is exempt from G1, G3 and G4 inside those three functions; `src/styles/*.css` is exempt from G5 inside that one; `margin: -1px` is allowed only in a rule that also declares `clip`, which is checked per rule. A reader of one function sees its whole contract, and every exemption has a self-test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The brace-aware scanner is not comment-aware, so the two shared stylesheets were misread**
- **Found during:** Task 1, GREEN - the role-file and token-file sweeps failed with "all nine roles are missing" and "--fs-title is missing at 900px"
- **Issue:** `scanRules` walks the text as it is. `src/styles/type.css` and `src/styles/tokens.css` both OPEN with a block comment, so the comment became part of the first rule's selector, and - worse - the comment in front of `@media (min-width: 900px)` swallowed the `@` that marks it as an at-rule, so the title switch was invisible to the reader. The plan's research named the `[^}]*` truncation as the reader defect; it did not name this one.
- **Fix:** `roleOffenders` and `mediaTokenValue` now strip the comments before they scan. The two functions that take a raw stylesheet were the only ones affected: `cssOf` already stripped them.
- **Files modified:** `tests/helpers/token-guards.ts`
- **Verification:** the role sweep and the token-scale sweep pass; the whole guard file is 51/51.
- **Committed in:** `d58e4e3`

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The fix is inside the plan's own file and changes no rule, no threshold and no file list. No product decision changed.

## Issues Encountered

- The RED commit's placeholder bodies tripped the project's `no-unused-vars` rule, because an empty function does not read its parameter. The placeholders now read the parameter explicitly (`void entry;`). The RED commit was made only after ESLint was green, so the commit history holds no lint error.
- The role self-test asserted "exactly one offender" for a role that sets `color`, but the function also reports the eight roles that are missing from a one-rule stylesheet. The assertion now asks that the message NAME the offending property, which is what the rule is actually about; the count of missing roles has its own test.
- The G1 and G3 sweeps read "migrated files PLUS type.css" and "migrated files PLUS utilities.css", as the plan asks. Both shared stylesheets are already migrated files, so the extra term is redundant today - but it is kept, because a stylesheet must not be swept only by luck.

## Known Stubs

None. Every function the plan lists exists with a body, every rule family has a passing and a failing self-test, and `PENDING_FILES` holds only files that really have something to migrate. The allowlist itself is not a stub: it is D-14's designed temporary exemption, it is self-policing, and plan 14-21 deletes it.

## Requirements

D-02, D-03, D-04, D-05, D-06, D-07 and D-14 are listed in the plan's frontmatter, and NONE of them is marked complete in `REQUIREMENTS.md`: the shared-ID gate blocks all seven, because a sibling plan declares each of them and has no summary yet. `requirements.ready-ids` returns an empty ready set. The ids become ready when the LAST declaring plan finishes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 14-04 can retire the old per-folder font-size exemption and the three regex readers of the older guards: the new guard reads nested source and holds the tree to one scale.
- Every pane plan from 14-05 to 14-20 now has its gate: migrate the file, remove it from `PENDING_FILES` in the same commit, and the suite stays green. A file left behind after it is clean fails the suite by name.
- The tree state today: 57 files pending, 5 clean (the two already-clean components and the three shared stylesheets), and no file under `src/` carrying a `url()`, an `@import`, an inline `style=` or a custom property outside the token file.

## Self-Check: PASSED

- Every file the plan declares exists on disk and is committed: `tests/helpers/token-guards.ts`, `tests/helpers/migration.ts`, `tests/unit/guards/design-tokens-guards.test.ts` - 3 files, 1375 insertions.
- Every task commit is an ancestor of HEAD: `b245308` (test), `d58e4e3` (feat), `15e8413` (refactor) - 3 commits, 1 task. The working tree holds no uncommitted change to the plan's files.
- The plan's acceptance criteria were each run by hand: emptying `PENDING_FILES` makes the suite fail with offenders that name the unmigrated files (6 sweep failures; reverted); adding the already-migrated pane to the list makes the stale-pending test fail naming that file (reverted); `grep -c AccountTimelinePane tests/helpers/migration.ts` prints 0; `grep -c src/app.css tests/helpers/migration.ts` prints 1; `pnpm exec vitest run tests/unit/guards/css-helper.test.ts` exits 0.
- The plan-level verification was re-run end to end after the last code commit: `pnpm run test:unit` exits 0 (162 files, 4886 passed, 9 expected fail), `pnpm run lint` exits 0, `pnpm run check` exits 0 (363 files, 0 errors, 0 warnings), `pnpm run build` exits 0, and the quick guard run passes (5 files, 179 tests).

---
*Phase: 14-design-unification*
*Completed: 2026-10-26*
