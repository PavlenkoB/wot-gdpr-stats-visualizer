---
phase: 14-design-unification
plan: 01
subsystem: ui
tags: [css, design-tokens, design-system, svelte, vitest, playwright, accessibility]

# Dependency graph
requires:
  - phase: 13-overview-insights
    provides: the Overview's own type scale (12/14/32/56) and its --ov-* and --heat-* tokens - the first of the two design generations this phase unifies
provides:
  - "src/styles/tokens.css: the type scale, the weights, the line heights, the spacing scale, the layout values, the radius, the status colours and the derived heat steps"
  - "src/styles/type.css: the nine .t-* role classes, size, weight and line height only"
  - "src/styles/utilities.css: the shared .caption, .body, .error, .visually-hidden and .scroller classes, each defined once"
  - "tests/helpers/css.ts: the brace-aware CSS scanner, the rule lookup and the token reader"
  - "tests/helpers/color.ts: the sRGB mixer and the color-mix parser"
  - "tests/helpers/styles.ts: the stylesheet paths and the source reader"
  - "A migrated real consumer (AccountTimelinePane) that defines none of the shared names and holds no hex"
  - "A scratch screenshot harness and the retained Overview 'before' set (D-15)"
affects: [14-02, 14-03, 14-04, 14-05, 14-06, 14-07, 14-08, 14-09, 14-10, 14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 14-18, 14-19, 14-20, 14-21]

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 17409
  tasks: 3
  commits: 4
plan_head_before: cd19c9706fa9056c98113a2b28d07ff1687fcd14
plan_head_after: 69a3ef9caa5a722c1ea4ca464bdb9986a0074f47

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The token / role / utility split: src/styles/tokens.css holds every custom property, src/styles/type.css the nine .t-* roles, src/styles/utilities.css the shared classes, and src/app.css keeps the element resets, the shell layout and the one phone block"
    - "A rule sets size, weight and line height only; a variant adds a hook class beside the shared one rather than redefining it"
    - "A brace-aware CSS scanner: a character walk with a stack of open rules, aware of quotes and parentheses, so a nested rule is visible to a reader"
    - "The colour arithmetic mirrors the browser: the plain channel average in gamma-encoded sRGB, with the colour space checked rather than assumed"
    - "A pixel compare with no pixel-diff dependency: both PNGs decoded in the page with createImageBitmap and an offscreen canvas, compared byte for byte"

key-files:
  created:
    - "src/styles/tokens.css"
    - "src/styles/type.css"
    - "src/styles/utilities.css"
    - "tests/helpers/css.ts"
    - "tests/helpers/color.ts"
    - "tests/helpers/styles.ts"
    - "tests/unit/guards/css-helper.test.ts"
    - "tests/unit/charts/color-helper.test.ts"
    - ".planning/phases/14-design-unification/14-OVERVIEW-PIXEL-EVIDENCE.md"
  modified:
    - "src/main.ts"
    - "src/lib/features/account-timeline/AccountTimelinePane.svelte"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"
    - "tests/unit/guards/phase5-layout-guards.test.ts"
    - "tests/unit/account-timeline/timeline-pane.test.ts"

key-decisions:
  - "The shared layer lands as THREE files with THREE jobs, imported once from the entry in the order tokens, type, utilities, app: the order is the contract, because `.error` must outrank `.body` and `.visually-hidden` must outrank `.caption`"
  - "The derived heat steps live inside @supports and fall back to the stop below them, so a browser without color-mix() shows three bands rather than a hand-picked second scale (D-11)"
  - "The colour space of a mix is CHECKED, not assumed: parseColorMix refuses anything that is not srgb, because an oklab expression is a different colour for the same two stops"
  - "A shared class is defined ONCE and a component that needs a different look adds a hook class beside it; the Account timeline pane was migrated by DELETING its four local copies, not by shadowing them"
  - "The pixel identity of the tracer was proved against the pre-phase build (commit 901a9e1) in a scratch worktree, not against the previous commit: the layer had to be proved invisible to the reader, not only to the test suite"

patterns-established:
  - "Pattern: the shared layer - tokens, roles, utilities - reaches the page through one entry import, in that order, and every consumer reads it instead of restating it"
  - "Pattern: the nested-aware reader - ruleDeclarations(css, selector) finds a rule by its own selector, by its selector with a leading '& ' removed, or by its flat selector, so a nested rule is never invisible to a guard"
  - "Pattern: the scratch harness - one mjs file outside the repository, five subcommands (shots, overview, phone, compare, evidence), synthetic fixtures only, and one committed evidence file that holds widths, sizes, counts, hashes and commit ids"

requirements-completed: [D-01, D-02, D-05, D-06, D-07, D-11, D-12, D-13, D-15, D-16]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The three global stylesheets exist under src/styles/ and reach the page through src/main.ts in the order tokens, type, utilities, app"
    requirement: D-01
    verification:
      - kind: unit
        ref: "pnpm run build && node -e (built CSS carries --fs-title, --danger-ink, --heat-5, .t-title, .t-label, .visually-hidden, .scroller:focus-visible, .error, .caption, .body)"
        status: pass
      - kind: other
        ref: "grep -nE \"^import './(styles/(tokens|type|utilities)|app)\\.css';\" src/main.ts -> four lines in the required order"
        status: pass
    human_judgment: false
  - id: D2
    description: "The nine .t-* role classes exist, each one rule per line, and the shared .caption/.body/.error/.visually-hidden/.scroller classes are each defined once in utilities.css"
    requirement: D-07
    verification:
      - kind: unit
        ref: "tests/unit/guards/css-helper.test.ts (the reader the later guards use)"
        status: pass
      - kind: other
        ref: "grep -cE '^\\.t-(hero|stat|title|display|heading|body|body-strong|caption|label)\\s*\\{' src/styles/type.css -> 9"
        status: pass
    human_judgment: false
  - id: D3
    description: "AccountTimelinePane is a real consumer: it defines none of the shared class names, holds no colour literal, and renders pixel-identically to the pre-phase build"
    requirement: D-02
    verification:
      - kind: unit
        ref: "tests/unit/account-timeline/timeline-pane.test.ts#AccountTimelinePane: the shared layer"
        status: pass
      - kind: other
        ref: "node <scratch>/harness.mjs compare --strict --panes account-timeline -> 4/4 pairs BYTE-EQUAL at 1280, 900, 899 and 375"
        status: pass
    human_judgment: false
  - id: D4
    description: "The brace-aware CSS scanner finds a nested rule the old [^}]* extraction loses, and the sRGB mixer reproduces the Chromium-verified color-mix results"
    requirement: D-01
    verification:
      - kind: unit
        ref: "tests/unit/guards/css-helper.test.ts#the rule lookup: the case the old regex loses"
        status: pass
      - kind: unit
        ref: "tests/unit/charts/color-helper.test.ts#mixSrgb"
        status: pass
    human_judgment: false
  - id: D5
    description: "The existing phase-8 and phase-5 font guards accept the token layer without losing their rules, and the phase-8 colour guard treats src/styles/tokens.css as a token file"
    requirement: D-03
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts#the font-size token layer (14-01, D-01)"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/phase5-layout-guards.test.ts#the font-size token layer (14-01, D-01)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Overview 'before' set is retained as evidence rather than as scratch PNGs: the committed 14-OVERVIEW-PIXEL-EVIDENCE.md names the baseline commit and, for each of the four Overview widths, the PNG pixel size and its sha-256"
    requirement: D-15
    verification:
      - kind: other
        ref: "grep -cE '^\\| (1040|880|479|340) \\|.*\\| [0-9a-f]{64} \\|$' .planning/phases/14-design-unification/14-OVERVIEW-PIXEL-EVIDENCE.md -> 4"
        status: pass
    human_judgment: false
  - id: D7
    description: "The scratch harness with its full before set exists for every later plan: 13 panes at 1280, 900, 899 and 375 plus the Overview element captures at 1040, 880, 479 and 340"
    requirement: D-13
    verification:
      - kind: other
        ref: "node <scratch>/harness.mjs compare -> 56/56 pairs BYTE-EQUAL across every pane and width"
        status: pass
    human_judgment: true
    rationale: "The harness lives outside the repository and is never committed, so the verifier has to trust the scratch directory rather than read the artefact from the tree. The committed part - the evidence file - is checked by the automated criterion; the PNG set itself cannot be."

# Metrics
duration: 54 min
completed: 2026-10-26
status: complete
---

# Phase 14 Plan 01: Tokens, roles, utilities and the helpers that read them

**The shared design layer lands as three global stylesheets - tokens, nine type roles and the shared classes - with one real consumer (the Account timeline pane) migrated onto it and proven pixel-identical, plus the brace-aware CSS reader, the sRGB mixer and the scratch pixel harness every later plan needs.**

## Performance

- **Duration:** 54 min
- **Started:** 2026-10-26T07:19:00Z
- **Completed:** 2026-10-26T07:14:00Z
- **Tasks:** 3
- **Files modified:** 14 committed, plus one scratch harness (never committed)

## Accomplishments

- `src/styles/tokens.css`, `src/styles/type.css` and `src/styles/utilities.css` reach the page through one entry import in the order tokens, type, utilities, app - and the built CSS carries the whole layer.
- `AccountTimelinePane` is the first real consumer: its four local copies of the shared class names and its three hex literals are DELETED, not shadowed, and it renders byte-identically to the pre-phase build at 1280, 900, 899 and 375.
- The brace-aware CSS scanner finds a nested rule the old `[^}]*` extraction could not see, and the sRGB mixer reproduces Chromium's `color-mix(in srgb)` arithmetic to nine decimals.
- The scratch harness and the complete "before" set exist: 13 panes at four widths and the Overview element captures at 1040, 880, 479 and 340 - and the Overview baseline is committed as evidence (D-15), not left in scratch.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer - tokens, roles and utilities reach the page through the entry import and carry AccountTimelinePane** - `68915eb` (feat)
2. **Task 2: Helpers - brace-aware CSS scanner, sRGB mixer and source reader, with their own tests** - `c6d855d` (test, RED), `58ee296` (feat, GREEN)
3. **Task 3: Keep the existing guards green around the tracer, and build the scratch harness with its "before" set** - `69a3ef9` (feat)

**Plan metadata:** (this commit)

_Note: Task 2 is a TDD task and produced two commits - the failing test, then the implementation._

## Files Created/Modified

- `src/styles/tokens.css` - the only file allowed to hold a hex, a px font size or a px spacing value: the type scale, the weights, the line heights, the spacing scale, the layout values, the radius, the status colours and the derived heat steps.
- `src/styles/type.css` - the nine `.t-*` roles; each sets size, weight and line height only, plus the overflow-wrap, uppercase and tracking the role table lists.
- `src/styles/utilities.css` - `.caption`, `.body`, `.error`, `.visually-hidden` and `.scroller`, each defined once, in the order that makes `.error` outrank `.body` and `.visually-hidden` outrank `.caption`.
- `src/main.ts` - the four stylesheet imports, in order, before the `mount` import.
- `src/lib/features/account-timeline/AccountTimelinePane.svelte` - the migrated consumer: the local `.body`, `.error`, `.caption`, `.caption.hidden` and `.visually-hidden` rules are deleted, the hidden showing line takes the shared clip class, and the remaining rules read tokens and nest `button:hover` and `button:focus-visible`.
- `tests/helpers/css.ts` - `stripCssComments`, `styleText`, `scanRules`, `ancestry`, `flatSelectors`, `ruleDeclarations`, `splitValueTokens`, `tokenMap`, `resolveTokens`.
- `tests/helpers/color.ts` - `hexToRgb`, `mixSrgb`, `luminanceRgb`, `contrastRatioRgb`, `parseColorMix`, `resolveMix`.
- `tests/helpers/styles.ts` - `REPO_ROOT`, `SRC_DIR`, `TOKENS_CSS`, `TYPE_CSS`, `UTILITIES_CSS`, `APP_CSS`, `readTokenSource`, `readSrcFiles`.
- `tests/unit/guards/css-helper.test.ts` - 28 assertions on the scanner, the rule lookup, the value splitter and the token reader.
- `tests/unit/charts/color-helper.test.ts` - 12 assertions on the mixer, the parser and the heat ratios.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - the scale accepts a `var(--fs-*)` value, the token file is exempt from the literal sweep, and AccountTimelinePane leaves the status-colour allow-list.
- `tests/unit/guards/phase5-layout-guards.test.ts` - the floor resolves a `var(--fs-*)` through the token map and judges it against the file's own floor.
- `tests/unit/account-timeline/timeline-pane.test.ts` - the pane's own proof: it defines none of the shared names and holds no colour literal.
- `.planning/phases/14-design-unification/14-OVERVIEW-PIXEL-EVIDENCE.md` - the committed D-15 evidence, with the Baseline section filled.

## Decisions Made

- **The shared layer is three files with three jobs, not one file.** The plan fixes it that way, and the split is what makes the layer checkable: a reader can ask "is this a token, a role or a shared class?" of a single file instead of of the whole tree.
- **The import order is part of the contract, not a style choice.** `.error` sets `color` and `.body` sets `color` too, so the two rules tie on specificity and the LATER one wins. Putting `.error` after `.body` and `.visually-hidden` after `.caption` is what makes `class="body error"` show the danger colour and what makes the hidden showing line actually hide.
- **The derived heat steps fall back to the stop below them, and the mix is checked rather than assumed.** A browser without `color-mix()` shows three bands instead of five levels, which the UI-SPEC accepts; the alternative - a second hand-picked scale - is what D-11 forbids. The parser refuses any colour space other than `srgb`, because `oklab` is a different colour for the same two stops and a test that computes the wrong one is worse than a test that fails.
- **The pixel identity was proved against the PRE-PHASE build, not against the previous commit.** Commit 901a9e1 in a scratch worktree is the honest baseline: the layer had to be invisible to a reader, not only to a test suite. Every one of the 56 captured pairs - not only the tracer pane - is byte-equal, which is a stronger result than the plan asked for and says the global classes changed nothing for the components that have not been migrated yet.
- **The scanner's rule lookup matches three ways, because a nested rule has three names.** Its own selector, its own selector with a leading `& ` removed, and its flat selector. The first two find `& .controls`; the third finds `&.footer` as `.row.footer`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The harness needs TWO synthetic archives, not one**
- **Found during:** Task 3 (the scratch harness)
- **Issue:** The plan names one fixture. No single archive renders every optional pane: the new-games archive carries HEAT and the Warships crews, and the account-timeline archive carries the Perks and the Account timeline - and the Account timeline is the pane this plan must prove pixel-identical. With one archive the acceptance criterion `compare --strict --panes account-timeline` had nothing to compare.
- **Fix:** The harness drives BOTH synthetic archives, each in its OWN fresh browser context (a fresh context starts with an empty IndexedDB, so neither archive has to replace the other), and writes both pane sets into ONE folder. A pane the first archive renders is not captured again from the second.
- **Files modified:** none in the repository - the harness is scratch
- **Verification:** the before set holds 13 panes at 4 widths (52 PNGs) plus the 4 Overview element captures, and `compare` reports 56/56 byte-equal
- **Committed in:** `69a3ef9` (the evidence file; the harness itself stays scratch)

**2. [Rule 3 - Blocking] The RED evidence had to be captured with the JUnit reporter, not TAP**
- **Found during:** Task 2 (the RED phase)
- **Issue:** The canonical RED gate parses the reporter output through a TAP adapter, and Vitest's TAP reporter writes multi-line YAML diagnostics that the adapter reads as non-TAP data - so the verdict was `INVALID_RED` (reason `invalid_record`) even though the target test had genuinely failed on its assertion.
- **Fix:** Re-ran the same command with `--reporter=junit --outputFile=...` and persisted THAT report in the record. The gate's own rule allows it: "If the reporter is incompatible, rerun the planned target with a supported reporter through the project's test command, capture that real command and result, then submit the rerun's record to the classifier." The verdict became `RED_EVIDENCE_OK` with the target test matched by name.
- **Files modified:** none in the repository - the record is scratch (`node_modules/.tmp/`), deliberately not committed
- **Verification:** `gsd_run check tdd-red-evidence` returns `RED_EVIDENCE_OK`, reason `target_test_failed`, 40 tests / 35 failing / 5 passing, and the matched target is the nested-`.controls` case
- **Committed in:** `c6d855d`

**3. [Rule 2 - Missing Critical] The RED commit carries placeholder helper bodies**
- **Found during:** Task 2 (the RED phase)
- **Issue:** The tests import the helpers, and a module that does not exist is a LINK failure - an invalid RED that proves nothing about the behaviour. Writing the tests against a module that does not load would have made the RED a syntax error, not a behavioural one.
- **Fix:** The RED commit adds the three helper files with their API shape settled and their bodies returning empty values, so 35 of the 40 assertions fail on an assertion rather than on a load. The GREEN commit fills the bodies in.
- **Files modified:** `tests/helpers/css.ts`, `tests/helpers/color.ts`
- **Verification:** the RED run's report shows every failure as an `AssertionError`, with no collection or load error
- **Committed in:** `c6d855d`

**4. [Rule 1 - Bug] The harness launches Chromium WITHOUT `--no-sandbox`**
- **Found during:** Task 3 (the scratch harness)
- **Issue:** The project's own driver launches Chromium with `--no-sandbox` because it runs inside a sandboxed agent runtime. Here that flag requires explicit human authorisation, and Chromium launches and drives the page correctly without it.
- **Fix:** The harness calls `chromium.launch()` with no arguments.
- **Files modified:** none in the repository - the harness is scratch
- **Verification:** every capture and every compare ran with the plain launch
- **Committed in:** `69a3ef9` (the harness itself stays scratch)

### Documented, not fixed

**5. [Rule 3 - Blocking] The unit suite is red between the Task 1 commit and the Task 3 commit**
- **Found during:** Task 1 -> Task 3
- **Issue:** Task 1 puts the shared layer and a migrated consumer into the tree, and Task 3 amends the three guard readers that read them. Between those two commits the suite is red: the phase-8 colour guard sees the token file's hex declarations, and its allow-list names a file that no longer carries the literals.
- **Why it was not "fixed":** The plan's own decomposition causes it - the playbook's note that "the three existing guard readers it amends must change in the same commit as the first consumer" is an argument for keeping 14-01 as ONE plan, and the plan splits it into three tasks with atomic per-task commits. The red window is the plan's, not a defect in the work, and closing it would mean either reverting Task 1 or amending the guards before the layer they read exists.
- **Evidence:** the Task 1 verification (the built CSS carries the layer) passed at that commit; the full suite is green at the Task 3 commit (161 files, 4826 passing, 9 expected fail).

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug) plus 1 documented.
**Impact on plan:** The three fixes are all in the SCRATCH layer or in the test-side helpers; none changed a product decision, a token name or a class name. The committed product surface is exactly the plan's.

## Issues Encountered

- The readiness signal for the import is NOT the identity nickname: a multi-account dataset shows an account COUNT there instead, so the harness waits for the detail pane and then for the optional pane rows, which arrive with the new-data facts after the dataset lands. Reading the pane list too early finds nine panes instead of eleven.
- The plan's `pnpm --dir <worktree> install --frozen-lockfile` step resolves entirely from the local pnpm store and adds nothing to the lockfile - no package was installed and no dependency was added anywhere in this phase.
- The scratch worktree of the baseline commit is LEFT IN PLACE at `${TMPDIR}/wg-phase14/baseline`, because plans 14-20 and 14-21 need the same baseline to re-run the Overview compare against.

## Known Stubs

None. Every function the plan lists exists with a body, and every deliverable it names is proved by a passing test or a passing command.

## Next Phase Readiness

- Plans 14-02 to 14-21 can read the token layer with `tokenMap`, look a rule up with `ruleDeclarations` (nested rules included) and mix a colour with `mixSrgb` - the three helpers those plans need are in place and tested against the cases that break the old regexes.
- The scratch harness and the complete "before" set are ready for every later plan, and the Overview baseline is committed, so plan 14-20's D-15 result has a retained "before" to refer to.
- The next plan moves the legacy custom properties out of `src/app.css` into `src/styles/tokens.css` and narrows `readTokenSource()` to the token file alone; `readTokenSource` is deliberately location-agnostic until then.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- Every created file exists on disk: the three stylesheets, the three helpers, the two helper test files and the evidence file.
- Every task commit is an ancestor of HEAD: `68915eb`, `c6d855d`, `58ee296`, `69a3ef9` (4 commits, 3 tasks).
- The evaluation scope resolves: 4 commits, all on this branch.
- The plan-level verification was re-run at the end of the plan: `pnpm run build` and the built-CSS check pass, `pnpm exec vitest run tests/unit/guards tests/unit/charts tests/unit/account-timeline` passes (33 files, 710 passing, 9 expected fail), `pnpm run test:unit` passes (161 files, 4826 passing, 9 expected fail), `pnpm run lint` and `pnpm run check` pass, `pnpm exec playwright test tests/e2e/shell/account-timeline-perks.spec.ts` passes (2 passed), and the scratch `compare --strict --panes account-timeline` exits 0 with 4/4 pairs byte-equal.

---
*Phase: 14-design-unification*
*Completed: 2026-10-26*
