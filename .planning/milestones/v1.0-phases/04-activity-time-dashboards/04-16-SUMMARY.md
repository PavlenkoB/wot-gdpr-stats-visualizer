---
phase: 04-activity-time-dashboards
plan: 16
subsystem: ui
tags: [svelte5, indexeddb, dexie, worker, aria-live, role-alert, copywriting-contract, uat-gap-closure]

# Dependency graph
requires:
  - phase: 04-activity-time-dashboards
    provides: "04-14's gated reconcile in Playtime.svelte's load(), which stops the stuck 'Updating charts...' but drops silently; the PLAYTIME_ERROR / PLAYTIME_UPDATING copy rows; the two-tab e2e seam (clearCachedDatasetFromSecondTab)"
  - phase: 04-activity-time-dashboards
    provides: "04-15's GAME split column and the third split label, which put a real two-game export's selector in reach of this flow"
provides:
  - "isCacheClearedElsewhere(outcome, ask, currentImportedAt) in src/lib/playtime-state.ts — the one condition under which the block says its cached data was cleared elsewhere"
  - "PLAYTIME_CACHE_CLEARED in src/lib/ui-copy.ts, with the doc comment saying why it is not PLAYTIME_ERROR"
  - "The cacheCleared flag and the <p data-testid='playtime-cache-cleared' role='alert'> notice in Playtime.svelte, rendered under the status line in any state and cleared on an applied answer and on a new dataset"
  - "The e2e assertions that keep 04-14's WR-2 fix intact while adding the notice, and a second browser test that dropping the export again is the way back"
  - "Four dated amendments to 04-UI-SPEC.md recording the notice (copy row, state-matrix sentence, Section 10 live-region clause, UI Considerations row)"
affects: [04-verification, phase-05, phase-06, phase-07, ui-copy-contract, playtime-state-machine]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 5741
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A user-facing message is gated by a PURE predicate beside the other block decisions, never by a condition inside the component — so 'may this be said?' is a true/false matrix in a unit test (isCacheClearedElsewhere)"
    - "A notice orthogonal to the state machine: rendered outside every state branch, never read by derivePlaytimeState, and never changing data-state"
    - "role='alert' with NO aria-live attribute, so an interrupting message does not become a third live region and the page-wide count of two stays exact"

key-files:
  created: []
  modified:
    - "src/lib/playtime-state.ts — isCacheClearedElsewhere, the decision, with the seven neighbouring cases it is not"
    - "src/lib/ui-copy.ts — PLAYTIME_CACHE_CLEARED"
    - "src/lib/components/Playtime.svelte — the cacheCleared flag, its three writes, the notice paragraph and its amber chrome"
    - "tests/e2e/playtime.spec.ts — the extended WR-2 test and the new G-04-5 re-drop test"
    - "tests/unit/playtime-state.test.ts — the 1-true/7-false matrix"
    - "tests/unit/ui-copy.test.ts — the sentence pin, its distinctness from PLAYTIME_ERROR, and its no-id/no-path/no-markup property"
    - ".planning/phases/04-activity-time-dashboards/04-UI-SPEC.md — four dated amendments"

key-decisions:
  - "The notice is ORTHOGONAL to the state machine. 04-14's reconcile is byte-for-byte unchanged and the flag is inserted before it, so G-04-5 closes by adding a word, not a state."
  - "Only a result stamped importedAt:null AND view:null on a dataset still on screen is this case. A different non-null stamp (another tab replaced the export) and a stamp with no view (no stored aggregate) stay the 04-14 silent drops, because the sentence would be false for them."
  - "The notice is gated on userInitiated, so it never appears for the initial load — the sentence claims a SELECTION could not be applied."
  - "The remedy is the page's own import bar and nothing new: no button, no retry affordance, no new control."
  - "role='alert' and no aria-live attribute, keeping the page's live-region count at exactly two and the UI-SPEC's 'one new live region' claim true."

patterns-established:
  - "A dropped answer reconciles the request AND may explain itself: the two are separate writes in separate places, so a future message never has to touch the WR-2 fix"
  - "Pinning the exact text of a statement in load() with a source-shape regex in tests/unit/playtime-charts.test.ts worked as intended — the whole plan was a pure insertion around it and that file needed no edit"
  - "The UI-SPEC amendment convention: a dated '> **Amended YYYY-MM-DD (plan NN-NN)**' blockquote under the table or section amended, naming the gap that forced it"

patterns-continued:
  - "Per-test Playwright runs under the --single-process scratch config are the only trustworthy browser signal on this machine (04-14, 04-15); a whole-suite run is reported NOT RUN"
  - "A hand-written nine-row fixture with numbers derived BY HAND and proved against an independent oracle, never read from the page and compared with itself"

requirements-completed: [ACTIVITY-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The condition for the notice is one pure function, true only for a result outcome carrying no dataset stamp and no view, on a dataset still on screen, and false for all seven neighbouring shapes"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime-state.test.ts#isCacheClearedElsewhere (04-16, G-04-5)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The fixed sentence is in ui-copy.ts, pinned as a literal, distinct from PLAYTIME_ERROR, and carrying no digit, path separator or angle bracket"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ui-copy.test.ts#04-16: the cache-cleared notice is honest and leaks nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "In the two-tab flow the block still settles on ready with the previous slice's announcement and hours, AND shows the role-alert notice without becoming a third live region"
    requirement: ACTIVITY-01
    verification:
      - kind: e2e
        ref: "playwright: tests/e2e/playtime.spec.ts#WR-2: a dropped selection query settles on ready, not on updating forever (per-test run under the --single-process scratch config)"
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/dashboard.spec.ts#(slim-variant) after the import the same element is the slim bar — asserts page.locator('[aria-live]') has count 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dropping the export again through the page's own import bar removes the notice, returns the selector to All and restores the All tiles — the recovery the notice sentence names"
    requirement: ACTIVITY-01
    verification:
      - kind: e2e
        ref: "playwright: tests/e2e/playtime.spec.ts#G-04-5: dropping the export again removes the cache-cleared notice"
        status: pass
    human_judgment: false
  - id: D5
    description: "The approved contract records the notice in four places, each with a dated amendment note, and no colour value or data-ramp line is touched"
    verification:
      - kind: unit
        ref: "tests/unit/contrast.test.ts — parses the data ramp table out of 04-UI-SPEC.md; 27/27 pass in tests/unit/contrast.test.ts + tests/unit/ci-budget.test.ts"
        status: pass
      - kind: other
        ref: "git diff 5d39ae0 -- .planning/phases/04-activity-time-dashboards/04-UI-SPEC.md — all six hunks start at line 225; the Color section (126-182) is untouched"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-10-01
status: complete
---

# Phase 04 Plan 16 Summary

**A dropped selection now says why: after a second tab clears the cached data, the Playtime block shows a short role-alert notice naming the cause and the way back, while the state machine that un-stuck it stays byte-for-byte as 04-14 left it.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-30T20:53:41Z
- **Completed:** 2026-09-30T21:06:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- **G-04-5 closed with a word, not a state.** `isCacheClearedElsewhere` is the one condition under which the block says anything, and the entire diff inside `load()`'s dropped-answer branch is a three-line insertion *before* the existing gated reconcile. Diffed against the pre-plan file, the branch's only change is `1a2,4` — the pinned statement is identical and in the same place, and the announcement write/clear in the applied-answer path is untouched, so `tests/unit/playtime-charts.test.ts` passes without an edit.
- **The false cases are the substance.** One `true` puts a sentence on a user's screen claiming their data is gone, so the matrix is one true case against seven false ones: superseded, error, another dataset's stamp, a stamp with no view, an inconsistent null stamp *with* a view, no dataset on screen, and an answer whose dataset was replaced mid-flight. The last two fail only because the predicate gates on the *current* dataset as well as the ask — the part a one-condition version gets wrong.
- **No third live region, proven in a browser, not by grep.** `role="alert"` with no `aria-live` attribute. The `(slim-variant)` dashboard test that asserts `page.locator('[aria-live]')` has count 2 passes against the built app; `grep -c 'aria-live=' src/lib/components/Playtime.svelte` prints 1.
- **The recovery is proved, not asserted.** The new `G-04-5` test drops the *same* hand bytes again on purpose — the store is empty, so the worker cannot take the duplicate path — and the notice clears, the selector returns to All and the tiles read the All figures. That is exactly the action the notice tells the user to take, so the sentence is now backed by a test of itself.

## RED evidence (required by the plan)

Recorded per-test, under the `--single-process` scratch config at `/tmp/04-16-pw.config.mts` (outside the repo, never committed), because the project's own `playwright.config.ts` cannot launch Chromium on this machine.

`pnpm exec playwright test --config=/tmp/04-16-pw.config.mts tests/e2e/playtime.spec.ts -g "WR-2"`, run against the UNCHANGED component after adding the copy constant and the assertions:

```
✘  1 [chromium] › tests/e2e/playtime.spec.ts:160:1 › WR-2: a dropped selection query settles on ready, not on updating forever (6.1s)
  Error: expect(locator).toBeVisible() failed
  Locator: getByTestId('playtime-cache-cleared')
  Expected: visible
  Error: element(s) not found
    at /Users/.../tests/e2e/playtime.spec.ts:200:24
```

Exactly as the plan predicted: the three pre-existing assertions (state `ready`, the eu-1 announcement, the eu-1 hours) passed, and the run then failed **only** at the notice locator. The copy constant was added before the assertions, per the plan, so the failure is a missing element rather than an undefined import.

**Task 2 (`tdd="true"`) is pinned on arrival, not RED — and Test 4 was not red either.** The plan anticipated both. Tests 1–3 pin what Task 1 built, so they pass on the first run. Test 4 (the re-drop) was the one that could have been red, and it was green, because the `cacheCleared = false` in the dataset effect — which Task 1's action required — already clears the notice on a new dataset. **No component change belongs in Task 2**, and `Playtime.svelte` appears in no Task 2 commit. Its test-only commit (`28bbfd4`) is nonetheless its own commit ahead of the contract edit, so the test-before-docs ordering holds.

## Task Commits

1. **Task 1: Tracer, the second-tab flow shows a notice that the cached data was cleared** — RED, then implementation
   - `305426d` `test(04-16): RED the cache-cleared notice in the WR-2 two-tab flow` — the copy constant (data, so the test fails at the locator) plus the extended WR-2 assertions
   - `bd8be88` `feat(04-16): tell the user when a dropped selection means the cache was cleared` — `isCacheClearedElsewhere` and the flag, the three writes, the notice element and its chrome
2. **Task 2: The decision and the sentence are pinned, dropping the export again is the way back, and the contract records the notice**
   - `28bbfd4` `test(04-16): pin the notice's condition, its sentence and its way back` — the 1-true/7-false matrix, the sentence pin and its three properties, the new browser test
   - `532da52` `docs(04-16): record the cache-cleared notice in the approved contract` — the four `04-UI-SPEC.md` amendments

**Plan metadata:** this file, with `STATE.md` and `ROADMAP.md`.

## Files Created/Modified

- `src/lib/playtime-state.ts` — `isCacheClearedElsewhere`, the pure decision, with a doc comment naming the five shapes it is not
- `src/lib/ui-copy.ts` — `PLAYTIME_CACHE_CLEARED`, in the 04-04 static-copy section beside `PLAYTIME_UPDATING`
- `src/lib/components/Playtime.svelte` — the `cacheCleared` flag, three writes (set in the dropped-answer branch, cleared on an applied answer, cleared in the dataset effect), the notice paragraph and its amber chrome
- `tests/e2e/playtime.spec.ts` — the extended WR-2 test and the new `G-04-5: dropping the export again removes the cache-cleared notice`
- `tests/unit/playtime-state.test.ts` — the `isCacheClearedElsewhere` matrix
- `tests/unit/ui-copy.test.ts` — the sentence row in `PLAYTIME_COPY_ROWS` plus three property tests
- `.planning/phases/04-activity-time-dashboards/04-UI-SPEC.md` — copy-table row, state-matrix sentence, Section 10 live-region clause, UI Considerations row, corrected resolved-counts line

## Decisions Made

- **The notice is orthogonal to the state machine, and that is a structural choice, not a promise.** The paragraph is rendered *outside* every state branch and the flag is never read by `derivePlaytimeState`, so a complaint about storage never has to be attached to a state. Putting it inside a branch would have meant deciding which state may carry it — the one change to `derivePlaytimeState` this plan is not allowed to make.
- **The flag is cleared in the dataset effect rather than watched.** `cacheCleared = false` sits beside the announcement reset, one line. The alternative — deriving visibility from `importedAt` — would have meant stamping the notice with a dataset and comparing two stamps to answer a boolean.
- **Amber, not red.** The chrome is `ExcludedNotice`'s value for value (`#f9ab00` / `#fef7e0` / `#8a5a00`): a fact about storage the user should notice, not a failure of their import. The query did not fail — it answered truthfully that there was nothing stored to answer from. No ramp colour and no inline style.
- **The remedy is the page's own import bar, and no new control was added.** The notice names an action the page already offers, so there is no button to style, focus, or test at 375px.
- **`toHaveValue('all')` alongside the option's label.** The All option's `value` is the literal `'all'` and its label is `SPLIT_ALL_OPTION` — 04-05's distinction, already documented in this spec's tracer. Asserting both means the test cannot pass on a selector that shows the right word and holds the wrong value.

## Deviations from Plan

### Auto-fixed Issues

**1. Rule (doc truth) — the UI-SPEC's resolved-counts line was already stale, and this plan's own row made it staler**

- **Found during:** Task 2, recording the UI Considerations row
- **Issue:** `Applicable state considerations resolved: 17 covered, 6 backstop, 2 unresolved` did not match the table. Counting the table at `5d39ae0` gives exactly 17/6/2 — so the drift was 04-15's: it moved the `data` row (which session column identifies the title) from ⚠ unresolved to ✅ covered and never recounted. Adding this plan's covered row makes it 19/6/1.
- **Fix:** Corrected to 19/6/1, with a parenthetical naming both causes (04-15's row and this plan's) so the number is not quietly wrong and the next reader can see why it moved twice.
- **Files modified:** `.planning/phases/04-activity-time-dashboards/04-UI-SPEC.md`
- **Verification:** Row-by-row status count over the table's four-column cells; `tests/unit/contrast.test.ts` passes (it parses the ramp table out of the same file).
- **Committed in:** `532da52`

**Impact on plan:** Within scope — this plan owns `04-UI-SPEC.md` and is adding a row to the very table the count describes. Leaving a known-wrong count in the contract being amended would have been worse. No source file touched, no test weakened.

## Issues Encountered

- **A whole-suite Playwright run is NOT RUN, and is not reported as passing.** The project's own `playwright.config.ts` cannot launch Chromium on this machine — `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer...: Permission denied (1100)`, a macOS sandbox restriction already confirmed by the orchestrator and by 04-14 and 04-15 independently. This is not a product defect. The `--single-process` flag this sandbox does allow was applied through a scratch config **outside the repository**, never committed, and under it the browser still dies partway through a multi-test file, so every browser result below is a **per-test** run. Carried forward from 04-15 unchanged; see Verification for the full list.
- **A heredoc cannot be used for a commit message in this sandbox** (`cannot create temp file for here document: Operation not permitted`), so every commit message was written with the Write tool to `/tmp/04-16-msg-*.txt` and passed to `git commit -F`. Worth knowing for any future executor on this machine.
- **`pnpm run lint` is GREEN at this HEAD**, which contradicts the blocker 04-13 recorded. That entry cites 152 problems from `.kilo/worktrees/flashy-bit/` being untracked-but-not-ignored and picked up by eslint's globs. That directory is not producing problems now, so the STATE.md blocker is stale — see Noticed, below.
- **Two Playwright `-g` patterns need care.** A title containing literal parentheses matches nothing and reads as a missing test (04-15's gotcha). The two dashboard tests asserted for the live-region count were found by listing the file rather than by guessing a title.

## Verification

| Command | Result |
|---------|--------|
| `pnpm run test:unit` (final) | **27 files, 880 passed** (868 baseline + 12 new) |
| `pnpm run check` (final) | exit **0** |
| `pnpm run lint` (final, `prettier --check . && eslint .`) | exit **0** |
| `pnpm exec vitest run tests/unit/playtime-charts.test.ts tests/unit/playtime-state.test.ts tests/unit/ui-copy.test.ts` (Task 1) | 3 files, **197 passed** |
| `pnpm exec vitest run tests/unit/playtime-state.test.ts tests/unit/ui-copy.test.ts` (Task 2) | 2 files, **155 passed** |
| `pnpm exec vitest run tests/unit/contrast.test.ts tests/unit/ci-budget.test.ts` (after the UI-SPEC edit) | 2 files, **27 passed** |
| `pnpm exec playwright test tests/e2e/playtime.spec.ts tests/e2e/dashboard.spec.ts` (plan's Task 1 verify) | **NOT RUN as a suite** — see below |
| `pnpm exec playwright test --config=/tmp/04-16-pw.config.mts <spec> -g "<title>"`, one test per run | **1 passed** each, 9 runs |

### Per-test e2e, under the scratch config (the trustworthy unit)

| Test | Result |
|------|--------|
| `playtime.spec.ts#tracer: import, totals, pick a server, announcement` | 1 passed (no regression) |
| `playtime.spec.ts#WR-1: a failed selection query clears the previous slice announcement` | 1 passed (no regression) |
| `playtime.spec.ts#WR-2: a dropped selection query settles on ready, not on updating forever` | 1 passed — **the extended test, with 04-14's three assertions unchanged** |
| `playtime.spec.ts#G-04-5: dropping the export again removes the cache-cleared notice` | 1 passed — **new** |
| `dashboard.spec.ts#(slim-variant) after the import the same element is the slim bar` | 1 passed — **asserts the page-wide `[aria-live]` count is 2** |
| `dashboard.spec.ts#(single-live-region) the notice slot is the page's only aria-live region…` | 1 passed |
| `playtime-real-shape.spec.ts#real shape: a per-game export imports…` | 1 passed (04-15's tracer, no regression) |
| `playtime-real-shape.spec.ts#two games: the Game selector splits every total…` | 1 passed (04-15, no regression) |
| `zero-network.spec.ts` — all three, including the 5,000-session import | 3 passed (zero-network and one-Worker guards still hold) |

### Acceptance criteria, one line each

- Task 1: the extended WR-2 test asserts visible `playtime-cache-cleared`, text equal to `PLAYTIME_CACHE_CLEARED`, `role="alert"`, exactly one `aria-live` element inside the block, `file-input` count 1, and the three pre-existing assertions unchanged — **all present and passing**.
- `pnpm exec vitest run tests/unit/playtime-charts.test.ts` exits 0 **without any edit to that file** — confirmed; `git diff` shows the file untouched across the whole plan.
- `grep -c 'aria-live=' src/lib/components/Playtime.svelte` prints **1**.
- `grep -c "isCacheClearedElsewhere" src/lib/components/Playtime.svelte` prints **3** (≥ 1).
- The unit matrix contains the true case and the seven false cases, **each as its own named assertion** — 8 tests.
- `grep -c "PLAYTIME_CACHE_CLEARED" src/lib/ui-copy.ts` prints **1** (≥ 1), and `ui-copy.test.ts` asserts the typed-out literal.
- `git diff 5d39ae0 -- 04-UI-SPEC.md` shows **no changed line inside the data ramp table** — all six hunks begin at line 225; the Color section is 126-182.
- `git diff --quiet 5d39ae0 -- package.json pnpm-lock.yaml` exits **0** after every task. No dependency was added.
- The state machine's reconciliation is unchanged: `git diff 5d39ae0 -- src/lib/components/Playtime.svelte` removes exactly one line in the whole file, and it is a comment. The dropped-answer branch's only change is the insertion `1a2,4`.

## User Setup Required

None — no external service configuration, and no new dependency.

## Noticed, not changed

- **`.planning/STATE.md`'s lint blocker is stale.** 04-13 recorded `pnpm run lint` as RED with 152 problems from `.kilo/worktrees/flashy-bit/` being untracked-but-not-ignored and swept up by eslint's globs, with the instruction "do not report lint green on this machine until that is done." At this HEAD `pnpm run lint` exits **0** on the whole tree. Either the directory is gone or it is now ignored. The STATE.md entry has been annotated below rather than deleted, because the `.kilo/` → `.gitignore` fix is still the right one and still unowned.
- **`04-UI-SPEC.md`'s UI Considerations table now has 19 covered rows against a `CONTEXT` claim of 17.** Fixed here (see the deviation). The check that would have caught it — a test that recounts the table — does not exist, and it is the same shape of instrument as `contrast.test.ts`, which already parses this file. Out of this plan's scope; worth a follow-up if the table keeps growing.
- **`ROADMAP.md`'s phase-4 counters said 13/13** with 16 plan files on disk. Corrected to 16/16 in the same commit as this summary.
- **The split-table coverage todo is still open.** 04-12 and 04-13 both recorded it as deferred to phase verification: the six-state matrix, the eight-row overflow, the `aria-current` marking and the 375px split-table layout remain 04-08's throwaway-only coverage. This plan does not touch `PlaytimeSummary`, so that todo is unchanged and remains real.
- **An answer stamped with a different non-null dataset is still a silent drop.** Deliberate — the notice's sentence would be false for it, and the plan recorded the choice. But it is the neighbouring case most likely to be reported next, and it would need its own copy: a replace from another tab makes this tab's dataset stale rather than gone, and the remedy is different.
- **The CI e2e budget projection moves by one test.** The suite lists 118 tests in 12 files (was 117). `tests/unit/ci-budget.test.ts` still passes — 118 projects to 585 s against a 900 s `globalTimeout`, well inside the 1.3× floor — but the guard is the instrument that must be re-derived, not deleted, if a later plan grows the suite. The projection's own 330 s baseline remains an ESTIMATE awaiting the first real CI run.

## Next Phase Readiness

- **Phase 4 has all 16 plans executed.** 04-16 was the final gap-closure plan; UAT gap G-04-5 is addressed and both gap-closure gaps from the 04-14 review now have a browser test each (WR-1 and WR-2) plus a recovery test.
- **Ready for `verify-work 04` / phase verification**, with one honest caveat carried forward: the whole-suite Playwright run remains unobserved on this machine (see D8 in 04-15-SUMMARY.md and Issues Encountered here). Verification on a machine that can hold a browser open, or the first CI run, is what closes it.
- **`ACTIVITY-01` is complete in substance** — the totals summary is coherent with the user's selection, including when the app cannot apply one — but `REQUIREMENTS.md` is deliberately left unticked: it has not been touched since Phase 3, and this repo's convention is that requirement checkboxes are set at phase verification, not per plan. Phase 4's `ACTIVITY-02`/`03`/`04` are the same position.

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-10-01*
