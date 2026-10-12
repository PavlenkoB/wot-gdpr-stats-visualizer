---
phase: 06-login-ip-history-offline-geolocation
plan: 08
subsystem: ui
tags: [svelte-5, runes, masking, live-region, query-client, playwright, source-contracts, tdd]

requires:
  - phase: 06-login-ip-history-offline-geolocation
    provides: "the frozen Phase 6 copy inventory in src/lib/ui-copy.ts (06-02), the worker-side logins view and the one-snapshot reader (06-05), and countryName plus the committed geo seam (06-06)"
  - phase: 04-activity-time-dashboards
    provides: "the Phase 4 tile chrome, the h3 sub-heading rule and the always-present polite live region this block copies value for value"
provides:
  - "src/lib/features/logins/LoginHistory.svelte — the block: five states from one derivation, the reveal control, the one polite live region, the mask rune"
  - "src/lib/features/logins/login-state.ts — deriveLoginState, acceptLoginsOutcome, maskStateFor"
  - "src/lib/features/logins/login-model.ts — displayIp, the ONE function that chooses which address string is displayed, and loginTiles with every tie-break"
  - "src/lib/features/logins/LoginSummary.svelte — six tiles on the Phase 4 chrome plus D-01's multi-file note"
  - "all six Phase 6 e2e locators AND failLoginsQuery, declared once in tests/e2e/_support/helpers.ts, so plans 06-10, 06-12 and 06-13 never edit that file"
  - "a source-contract technique for Svelte components: assert the file EXISTS, then strip comments before any prohibition (04-09's, extended)"
affects: [06-10, 06-12, 06-13, phase-07, ACTIVITY-05]

actuals:
  tokens: 30861
  tasks: 3
  commits: 4
plan_head_before: ba8b52ecdd1d17dbe086b24905f8fc903c44332b
plan_head_after: 1cf43a638f0be469a48883fdd15da58aa3026849
commits: 4
commits_note: "4 measured from plan_head_before, all production: feat (Task 1 tracer), test + feat (Task 2's TDD cycle), test (Task 3). No refactor commit — the cleanup was folded into the GREEN commit. plan_head_after is the head at the moment the ledger was measured; the commit that records the ledger is necessarily one commit later than its own hash."

tech-stack:
  added: []
  patterns:
    - "the answer is stored TOGETHER WITH the importedAt it describes, so a replace returns the block to loading BY CONSTRUCTION rather than through a reset hook somebody has to remember"
    - "the mask reset is a pure function of (previous stamp, new importedAt) evaluated in the same effect that starts the query, so there is no second thing to keep in step"
    - "one displayIp(address, revealed) is the only place a displayed address is chosen; the DOM holds the string being displayed and no second copy behind a CSS rule"
    - "a conditional the UI needs goes into the pure model as a FIGURE, because no unit test in this repository can render a component"

key-files:
  created:
    - "src/lib/features/logins/LoginHistory.svelte"
    - "src/lib/features/logins/LoginSummary.svelte"
    - "src/lib/features/logins/login-state.ts"
    - "src/lib/features/logins/login-model.ts"
    - "tests/unit/logins/login-state.test.ts"
    - "tests/unit/logins/login-model.test.ts"
    - "tests/e2e/logins/login-history.spec.ts"
  modified:
    - "src/lib/shell/Dashboard.svelte"
    - "src/lib/features/playtime/Playtime.svelte (one comment naming the file this plan deleted)"
    - "tests/e2e/_support/helpers.ts"
    - "tests/e2e/shell/dashboard.spec.ts"
  deleted:
    - "src/lib/shell/LoginHistorySection.svelte"

key-decisions:
  - "The shares are NOT computed in the model. `loginTiles` returns the COUNT and the DENOMINATOR and the component formats the pair through `formatLoginShareLine`, because the under-half-percent rule is ONE rule for the whole app and a second implementation is exactly how a page ends up with 0% in one tile and <1% in another. `formatSharePercent` is private to the frozen ui-copy.ts, so exporting it was not available either."
  - "D-01's multi-file note is a `multiFile` BOOLEAN on the tile model, not a `filesWithRows >= 2` in a template. Vitest cannot render a component, so a condition written in markup is a condition nothing in this repository can test; a condition in the model is a value with a case on both sides."
  - "The note lives in LoginSummary.svelte BETWEEN the two grids, not in LoginHistory.svelte after them, because the UI-SPEC's document order puts it under the COUNT tiles — a reader meets the number and the reason for it before the prose tiles below."
  - "The Most-used tile's null branch is UNREACHABLE and carries no hidden text. A `ready` view exists because a row was readable, and every readable row created an address entry, so `topIp` cannot be null there; a dash with a hidden explanation of a case that cannot happen would be a sentence about nothing."
  - "The top-country tie-break is by English NAME, not by the two-letter code, and the model does not inherit the stored code-unit order. `CH` sorts before `CL` and `Switzerland` does not, so a code tie-break would order two countries the reader sees the other way round — and the name is the string the tile displays."
  - "The mask is announced through the block's EXISTING polite live region and cleared by the dataset effect, so a replace never reads out the previous export's mask (T-04-24's rule, restated for this channel)."

patterns-established:
  - "A source-contract test asserts the file EXISTS before it asserts anything about its contents, through an `expect(existsSync(path))` rather than a bare read. A missing component then fails as 'this file does not exist' instead of surfacing as an ENOENT from readFileSync, which is a load error rather than a statement about behaviour. 04-09 recorded the existence guard; 06-08 records that it should be an ASSERTION."
  - "A source-contract test that checks DOCUMENT ORDER indexes the test id, not the imported symbol: the symbol also appears in the import block, above the elements being ordered, and would make an ordering assertion true for the wrong reason."

requirements-completed: [ACTIVITY-05]

coverage:
  - id: D1
    description: "The Activity_history card carries a real Login history block in place of the pending note, and the card no longer promises a dashboard"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#the Activity card no longer promises a dashboard, and the block is its reason"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/dashboard.spec.ts#(sections-pending) four sections ready and only User_Info pending"
        status: pass
    human_judgment: false
  - id: D2
    description: "Six summary tiles render the answer key's values with the specified roles, groups and dash-with-hidden-text cases"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#the six tiles show the answer key values, with the note under the counts"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-model.test.ts#the six tile values for the hand fixture, as rendered"
        status: pass
    human_judgment: false
  - id: D3
    description: "All five block states render their own sentence, the error in destructive chrome with role=alert and no aria-live"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#loading / no-source / no-usable / error (four cases)"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-state.test.ts#deriveLoginState"
        status: pass
    human_judgment: false
  - id: D4
    description: "While masked, no unmasked address exists anywhere: not in the DOM text, any attribute, the document title, the selection, the live region or the clipboard"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#while masked, no full address exists anywhere on the page (D-07, T-06-28)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#while masked, the selection carries no address either"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#pressing the toggle keeps focus and announces the new state, with no address"
        status: pass
    human_judgment: false
  - id: D5
    description: "The mask is one rune, masked on every load, reset on a replace and on a Clear, and never persisted"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#reveal then replace / reveal then clear / a reload after a reveal (three cases)"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-state.test.ts#maskStateFor"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-model.test.ts#the mask is never persisted (D-07, T-06-29)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A stale answer is never rendered: a superseded outcome, another dataset's, a view-less one and another channel's view are all dropped, and a replace landing mid-query returns the block to loading"
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-state.test.ts#acceptLoginsOutcome (five rejection cases)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#reveal, then replace: the block is masked again and never shows the old tiles"
        status: pass
    human_judgment: false
  - id: D7
    description: "The page-wide explicit aria-live count is four and login-history-status exists exactly once"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/dashboard.spec.ts#(slim-variant) after the import the same element is the slim bar"
        status: pass
    human_judgment: false
  - id: D8
    description: "D-01's multi-file note appears only when more than one file contributed login rows"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#one session file raises no multi-file note (D-01)"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-model.test.ts#says the export lists logins in more than one file / does not raise it for a single-file export"
        status: pass
    human_judgment: false
  - id: D9
    description: "At 375px the count tiles lay out two per row, the fact tiles one per row, and the page has no horizontal scroll"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-history.spec.ts#at 375px the block wraps and the page does not scroll sideways"
        status: pass
    human_judgment: false
  - id: D10
    description: "All Phase 6 e2e locators and the failing-query helper are declared once in tests/e2e/_support/helpers.ts by this plan"
    verification:
      - kind: other
        ref: "git diff ba8b52e..1cf43a6 -- tests/e2e/_support/helpers.ts (97 added lines, all Phase 6, in one commit)"
        status: pass
    human_judgment: false

# Metrics
duration: 34min
started: 2026-10-04T00:31:00+04:00
completed: 2026-10-04T01:06:00+04:00
status: complete
---

# Phase 06 Plan 08: Login history block — summary tiles under one reveal control

**The Activity_history card's placeholder is a real block: six summary tiles whose one IP address is masked until the user asks, with the masking invariant established and tested at every surface the plan creates.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-10-04T00:31+04:00
- **Completed:** 2026-10-04T01:06+04:00
- **Tasks:** 3
- **Files modified:** 12 (7 created, 4 modified, 1 deleted)

## Accomplishments

- `LoginHistory.svelte` replaces `LoginHistorySection.svelte`. The block renders five states from one pure derivation, holds the mask in **one** rune, and answers `logins` queries through the same channel-scoped `QueryClient` the other Phase 5 blocks use — so it cannot supersede them and they cannot starve it (05-07's per-channel rule).
- `displayIp(address, revealed)` is the only function in the app that chooses a displayed address, and it is proven to be so: an e2e test walks **every attribute of every element** in the block and finds no fixture address in either state, and a unit test covers the case `displayIp` exists to protect — a non-address answers `xxx` masked and is returned unchanged revealed, so a cell holding an email cannot put it on the screen by being masked.
- The answer is stored **together with the `importedAt` it describes**, so a replace that lands mid-query returns the block to `loading` by construction. The e2e case proves the race: a reveal, then a replace with the logins query delayed 12 s, shows `loading` with **no** tile on screen, and settles on the new dataset's figures, masked.
- All six Phase 6 e2e locators and `failLoginsQuery` are declared in `tests/e2e/_support/helpers.ts` **once, in this plan's first commit**. Plans 06-10, 06-12 and 06-13 will not edit that file.
- The page-wide explicit `aria-live` count is four, and `login-history-status` exists exactly once — the two assertions the plan required, in the same plan.

## Task Commits

1. **Task 1 (tracer): the block, masked by construction** — `6ffbe6e` (feat)
2. **Task 2 (TDD): the six tiles, the multi-file note, the announcement** — `e22122e` (test, RED) then `d68f586` (feat, GREEN)
3. **Task 3: browser specs for the states, resets and masked surfaces** — `1cf43a6` (test)

No REFACTOR commit: the cleanup the cycle would have made (moving the note into the summary component, moving the tile CSS with it) was folded into the GREEN commit rather than left as a third pass.

## Verification

| Command | Result |
|---|---|
| `pnpm exec vitest run tests/unit/logins` | 128 passed |
| `pnpm run test:unit` | **1970 passed** (65 files) |
| `pnpm run check` | clean |
| `pnpm run lint` | clean |
| `pnpm exec playwright test` | **213 passed** (18 files) |
| `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | 6 passed, **all four limits untouched** |

The CI budget guard passes with **all four limits untouched**, and the margin is now thin. The guard's rule is `globalTimeout >= 1.3 x projectedE2eSeconds`, and the projection for 213 listed tests is `330 + 5 x (213 - 86 - 5 - 5) + 120 + 90 = 1125 s`, so `1.3 x 1125 = 1462.5 s` against a `globalTimeout` of 1500 s — **37.5 s of headroom, or five more browser tests**. Six more and the guard fails, at which point `globalTimeout`, the `timeout Nm` wrapper and `timeout-minutes` in `.github/workflows/ci.yml` must be raised together with the constants in the guard, in whichever plan trips it. Plan 06-14 reconciles the final numbers.

## Files Created/Modified

- `src/lib/features/logins/LoginHistory.svelte` — **new.** The block: five states, the reveal control, the one always-present polite live region, the mask rune and its reset.
- `src/lib/features/logins/LoginSummary.svelte` — **new.** Six tiles on the Phase 4 chrome, plus D-01's multi-file note between the two grids.
- `src/lib/features/logins/login-state.ts` — **new.** `deriveLoginState`, `acceptLoginsOutcome`, `maskStateFor`. No Svelte, no copy.
- `src/lib/features/logins/login-model.ts` — **new.** `displayIp` and `loginTiles`. No `Intl`, no copy, no storage.
- `src/lib/shell/Dashboard.svelte` — mounts `<LoginHistory {result} client={ingestClient.data} />` where the placeholder stood.
- `src/lib/shell/LoginHistorySection.svelte` — **deleted.** Its `h3` rule moved into `LoginHistory.svelte` value for value.
- `src/lib/features/playtime/Playtime.svelte` — one comment, to name the file that now holds the sibling `h3` rule.
- `tests/e2e/_support/helpers.ts` — six Phase 6 locators and `failLoginsQuery`, declared once.
- `tests/e2e/shell/dashboard.spec.ts` — three assertions (see deviation 1) and the `aria-live` count.
- `tests/unit/logins/login-state.test.ts`, `tests/unit/logins/login-model.test.ts`, `tests/e2e/logins/login-history.spec.ts` — **new.**

## Decisions Made

- **The shares are computed at the display edge, not in the model.** The plan's behaviour list says `loginTiles` returns a top address "with its login count and share". It returns the count and the **denominator** instead, and the component formats the pair with `formatLoginShareLine`. The reason is the one the under-half-percent rule exists for: it is one rule for the whole app, and a second implementation is exactly how a page ends up with `0%` beside a non-zero count in one tile and `<1%` in another. `formatSharePercent` is private to the **frozen** `ui-copy.ts`, so importing it was not available either. The denominator is still proven to be all counted logins — `tests/unit/logins/login-model.test.ts` asserts the rendered share is `3 logins (43%)` over seven logins, and that both share tiles read the same number.
- **D-01's note condition is a figure, not a template expression.** `loginTiles` returns `multiFile`, and the component asks "does the note belong here" rather than "how many files were there". This repository cannot render a component under Vitest, so a condition written in markup is a condition nothing can test; a condition in the model has a case on both sides of the boundary.
- **The note renders in `LoginSummary.svelte`, between the two grids.** The plan's action text puts the note in `LoginHistory.svelte`, but the UI-SPEC's document order puts it **under the count tiles** — and the two grids are both inside the summary component. Rendering it after `<LoginSummary>` would put it under the fact tiles instead, which is a different sentence in a different place. The source-contract assertion moved with it (see Issues Encountered).
- **The top-country tie-break is by English name.** The plan says so explicitly, and it is the right rule for a reason the stored order does not cover: `CH` sorts before `CL` in code-unit order and `Switzerland` does not, so a code tie-break would order two countries the reader sees the other way round. The model implements the name rule rather than inheriting the aggregator's code rule.
- **The top-IP tie-break is numeric (IPv4 before IPv6), stated in `login-model.ts`.** `login-aggregate.ts` already ranks its stored array that way, so the tile and the table (plan 06-10) cannot name different addresses for one dataset. The comparison is spelled out rather than reading `addresses[0]` so the tile's winner is decided by a rule this file states and a hand-built view can be given an arbitrary order and still produce the documented answer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A third dashboard assertion had to change, not the two the plan named**
- **Found during:** Task 1
- **Issue:** `dashboard.spec.ts`'s `(sections-pending)` test asserts that a `ready` card holds **no** `<button>` — D-06's rule that nothing inside a card is a control over the section's own visibility. 05-12 had already carved Player_statistics out of that blanket claim. The new reveal control is the same kind of exception: a control over the **data** (whether the addresses are masked), governing nothing about the section. The test failed with `Expected: 0, Received: 1`.
- **Fix:** Extended the existing carve-out in the file's own shape — an `else` branch that **names** the button (`login-mask-toggle`) and asserts the card holds exactly one, so a future block that adds a control to this card has to come back and own the line rather than inheriting a silent exemption.
- **Files modified:** `tests/e2e/shell/dashboard.spec.ts`
- **Verification:** `pnpm exec playwright test tests/e2e/shell/dashboard.spec.ts` — 41 passed.
- **Committed in:** `6ffbe6e`
- **Impact on the plan:** the acceptance criterion "existing dashboard e2e tests other than the two flipped assertions pass unmodified" could not hold as written. The change is the same one 05-12 made, in the same place, for the same reason, and it is a test's claim about the product rather than a change to the product.

**2. [Rule 1 - Bug] A source-contract test surfaced as ENOENT instead of a missing component**
- **Found during:** Task 2 (RED phase)
- **Issue:** The RED run reported four `ENOENT: no such file or directory` failures from `readFileSync` against a component that does not exist yet. An ENOENT is a load error, and `tdd.md` classifies a load error as `INVALID_RED` — the test would have been saying "the reader broke", not "the component is missing".
- **Fix:** A `codeOfRequired` helper asserts `existsSync(path)` **as an expectation** before reading. A missing component now fails as `<path> does not exist`, which is a statement about the behaviour under test.
- **Files modified:** `tests/unit/logins/login-model.test.ts`
- **Verification:** the RED run's 10 failures are all assertion failures; the 4 that previously read ENOENT now read `expected true to be true`.
- **Committed in:** `e22122e`
- **Impact on the plan:** none to the product; the RED evidence is now the kind the gate asks for.

**3. [Rule 1 - Bug] The 375px fact-tile assertion asserted the opposite of the specification**
- **Found during:** Task 3
- **Issue:** The first run of the phone-width test failed with `Expected: 3503, Received: 3382`. A geometry probe over the built page showed the layout was **correct** — the counts render `138.5px 138.5px` (two per row) and the facts render one `293px` column (one per row) at `scrollWidth` 375 — and the assertion was written as if the fact tiles shared a row. The test was wrong, not the component.
- **Fix:** The fact-tile assertion now asserts the **opposite shape** to the counts: same `x`, rising `y`. The probe was a throwaway file and was deleted rather than committed.
- **Files modified:** `tests/e2e/logins/login-history.spec.ts`
- **Verification:** `pnpm exec playwright test tests/e2e/logins/login-history.spec.ts` — 15 passed.
- **Committed in:** `1cf43a6`

**4. [Rule 3 - Blocking] The `loading` e2e case flaked at a 3 s delay**
- **Found during:** Task 3
- **Issue:** The case passed alone and failed in the full 213-test run: the 3 s window expired between the assertion that observed `loading` and the one that observed the absence of the reveal control, so the suite failed on a timing accident rather than on a missing state.
- **Fix:** Delay raised to 10 s (12 s for the replace race) and the settle assertion given a 30 s timeout so it cannot measure the patch rather than the block. The reasoning is recorded at the call site, because a delay that is shortened "to make the suite faster" is exactly how this comes back.
- **Files modified:** `tests/e2e/logins/login-history.spec.ts`
- **Verification:** `pnpm exec playwright test` — 213 passed, including the case that had flaked.
- **Committed in:** `1cf43a6`

**Total deviations:** 4 auto-fixed (3 × Rule 1, 1 × Rule 3). **Impact on plan:** all four are corrections to tests this plan wrote or to a test the plan under-counted; none changes the product, and none widens the scope. No architectural decision was taken.

## Issues Encountered

**A GSD defect: `check tdd-red-evidence` cannot classify a JUnit RED from any runner**

The RED phase produced a valid record — 10 failing tests, all named, all failing on an assertion for the planned behaviour, exit 1 — and the checker returned `INVALID_RED / no_target_test_failure`. The reason is a bug in `.claude/gsd-core/bin/lib/tdd-red-evidence.cjs`, not in the RED:

```js
const name = /name="([^"]*)"/.exec(tagText)?.[1] ?? '';
```

`name="` matches the tail of `classname="`, so on any Surefire/JUnit-shaped report the extracted "test name" is the **classname**, every failing test reports as `classname#classname`, and a distinctly-named target test can never match. The fix is a word-boundary anchor — `/\bname="([^"]*)"/` — which is the same class of defect the `#4724` comment in that file is about, applied to the attribute extraction rather than to the tag scan. **Reported, not fixed here**: the file is GSD's, not this repository's.

STATE.md already records the sibling limitation from 04-01 (vitest's own TAP nests every test inside a file-level `not ok`, so the TAP path reads it as a load crash). The JUnit path (`vitest --reporter=junit`) parses correctly in every other respect — it found all 38 tests and all 10 failures with their messages — so fixing the one regex would make the JUnit path the usable one for Vitest.

**A test assertion was moved during GREEN, and the move is recorded here rather than buried in the diff**

The RED suite asserted that `LoginHistory.svelte` contains `LOGIN_MULTI_FILE_NOTE`. On writing the component, placing the note there put it **after** the fact tiles, which is not where the UI-SPEC puts it. The note moved into `LoginSummary.svelte` and the assertion moved with it, together with a stronger one: the test now indexes the note's **test id** and asserts the order is counts → note → facts, so the placement is checked rather than merely present. Moving an assertion to match an implementation is the one thing TDD forbids, so it is called out here: the placement changed on the specification's grounds, and the replacement assertion is **stronger** than the one it replaced, not weaker.

**A stale doc comment in a file this plan does not own**

`src/lib/features/logins/login-shared.ts` says `LoginsViewData.addresses` is ordered "logins DESCENDING then address ASCENDING by plain code-unit comparison". `login-aggregate.ts` sorts with `compareIp`, which is **numeric** with IPv4 before IPv6 — so the comment is wrong. `login-model.ts` implements the numeric rule (matching the code) and says so. The wrong comment is not this plan's file and was **not** edited: plan 06-10 builds the table and inherits that comment through `login-shared.ts`, so it should be corrected there, by the plan that owns the file, rather than silently fixed from a neighbouring one. **Flagged for the parent.**

## Findings for the orchestrator

1. **The RED gate is unusable for Vitest.** Two independent paths (TAP, JUnit) both fail to classify a valid Vitest RED, for the two reasons above. Every `tdd="true"` task in this repository will report `INVALID_RED` for a genuinely valid RED until the `#4724` regex is anchored.
2. **`login-shared.ts`'s stored-order comment is wrong** (code-unit vs numeric). Correct it in 06-10 or 06-12, which own that file.
3. **`LOGIN_MULTI_FILE_NOTE` uses a typographic apostrophe** (`file’s`) where the UI-SPEC's copy table writes ASCII (`file's`). `ui-copy.ts` is frozen and authoritative, the e2e imports the constant rather than a literal, and nothing depends on the ASCII form — noted so the next reader of the UI-SPEC does not "fix" the constant to match the document.
4. **The CI e2e budget has room for FIVE more browser tests, total, across the rest of Phase 6.** This plan added 15 and the guard still passes, but with 37.5 s of headroom. Plans 06-10, 06-12 and 06-13 together have three times that. Whoever writes the sixth test after this must raise `globalTimeout` in `playwright.config.ts`, the `timeout Nm` wrapper and `timeout-minutes` in `.github/workflows/ci.yml` **together**, in the same task — the guard names the value rather than the plan, and 05-14, 05-15 and 05-16 each did exactly that.
5. **The map is untouched, as required.** No import of `world-map.generated.ts` was added anywhere, so plan 06-12 still owns it and still has to import it **statically** (a dynamic `import()` emits a lazy chunk the zero-network guard counts as a request after load).

## Self-Check: PASSED

- All 7 created files exist on disk; `src/lib/shell/LoginHistorySection.svelte` is gone and no file imports it (`grep -rn LoginHistorySection src tests` returns only two prose references, both updated).
- All 4 commits exist and carry the plan's task structure: `6ffbe6e` (feat, Task 1), `e22122e` (test, Task 2 RED), `d68f586` (feat, Task 2 GREEN), `1cf43a6` (test, Task 3). The TDD gate's RED-then-GREEN ordering is present and in the right order.
- Every `<acceptance_criteria>` re-run:
  - Task 1: block reaches `ready`, the tile shows `maskIp(LOGINS_IP_HOME)`, one click flips `data-masked` to `false` and the label to `Hide full IP addresses` and the tile to the full address — **PASS** (`login-history.spec.ts` tracer).
  - Task 1: while masked, `innerHTML` holds no fixture address, `document.title` is unchanged, and no attribute of any element carries one — **PASS**.
  - Task 1: `[aria-live]` count 4 and `login-history-status` count 1 — **PASS** (`dashboard.spec.ts`).
  - Task 1: `LoginHistorySection.svelte` no longer exists and nothing imports it — **PASS**.
  - Task 1: the other dashboard e2e tests pass — **PASS** (41 passed; one needed the deviation above).
  - Task 2: each of the six tile values equals the answer key's — **PASS**, asserted both at the model level and as rendered text through the real formatters.
  - Task 2: the 12,000-row model test agrees with the oracle on distinct addresses, distinct countries, unknown-country addresses and the top address — **PASS**.
  - Task 2: the storage-API scan reports no occurrence under `src/lib/features/logins` — **PASS** (and a second test asserts the scan has files to scan, so it is not vacuous).
  - Task 3: all eight case groups pass in Chromium — **PASS** (15 tests).
  - Task 3: the ci-budget guard passes with the four limits untouched — **PASS**.
  - Task 3: the full Playwright suite passes and no existing spec changed other than the three assertions in `dashboard.spec.ts` — **PASS** (213 passed).
- The plan-level `<verification>` re-run: `pnpm run test:unit` (1970), `pnpm run check` (clean), `pnpm run lint` (clean), `pnpm exec playwright test` (213, including the zero-network spec with the new block on screen), `tests/unit/guards/ci-budget.test.ts` (6 passed).

## Known Stubs

None. The block has no placeholder, no empty branch that can be reached, and no value read from anywhere but `loginTiles` and the exports of `ui-copy.ts`.

## User Setup Required

None — no external service configuration required. No package was installed (T-06-SC accepted), and nothing in the block requests anything.

## Next Phase Readiness

- **06-10 (the IP table)** reads `LoginHistory.svelte`'s block root, the reveal row and the mask rune, and adds the table under the fact tiles. It should import `displayIp` for its IP cells and the account row and **must not** introduce a second mask. `helpers.ts` already carries `loginTable` and `loginScroller`; the file needs no edit.
- **06-12 (the map)** owns the map and must import `world-map.generated.ts` **statically** — a dynamic `import()` emits a lazy chunk requested after load, and the zero-network guard counts that. Its node-count assertion reads **235** shapes, not the UI-SPEC's 238 ceiling.
- **06-13 (the city opt-in)** needs `cityOptIn` from `helpers.ts` and must not reach for `role="alert"` on a cancel: `CITY_CANCELLED_TONE` is `'neutral'` and the recorded Delta 10 says so.
- Nothing in this plan blocks any of them, and nothing in it needs a decision carried back.

---
*Phase: 06-login-ip-history-offline-geolocation*
*Plan: 08*
*Completed: 2026-10-04*
