---
phase: 09-multi-account-import-account-identity
plan: 06
subsystem: testing
tags: [multi-account, lifecycle, indexeddb, zero-network, ci-budget, d-23, t-09-23, t-09-24, t-09-25]

requires:
  - phase: 09-03
    provides: "the one-dataset lifecycle in a fake IndexedDB (import, reload, duplicate, replace, clear, Start Over for 1/2/3 accounts) and the D-21 load-time purge"
  - phase: 09-04
    provides: "the multi-account identity header, `accountRows` and `tests/e2e/shell/multi-account.spec.ts`"
  - phase: 09-05
    provides: "the combined caption, the positional keyed-each fix and the pane walk inside that same spec"
provides:
  - "tests/e2e/shell/multi-account.spec.ts test (b) — the one-dataset lifecycle with eight raw-store snapshots, plus the 375px long-text step"
  - "tests/e2e/guards/zero-network.spec.ts stage 11 — a three-account replace and a walk of every PANE_ID, under the file's existing request/worker/CSP assertions"
  - "tests/unit/guards/ci-budget.test.ts — MULTI_ACCOUNT_LONG_TESTS_FROM / _TEST_COUNT / _SECONDS, the 258 pin, and the 30 / 32 / 40 min limits"
  - "playwright.config.ts and .github/workflows/ci.yml — the three e2e limits raised together, with the arithmetic in comments"
  - "tests/fixtures/multi-account-fixtures.ts — buildLongTextAccountsExport now actually applies MA_LONG_NICKNAME"
affects: [10, verify-work]

actuals:
  tokens: 13118
  tasks: 3
  commits: 4
plan_head_before: 7673c757e84499bd9e3990104e7945dab2ed94a1
plan_head_after: 3bfbe41

tech-stack:
  added: []
  patterns:
    - "A raw-store snapshot helper is local to the one spec that needs it, not added to `_support/helpers.ts`, because that file is read by every spec"
    - "The per-test credit is 5 s, so any test that runs far longer than that is HELD BACK and priced as one allowance — the same shape as the three scale specs"
    - "A held-back block is subtracted unconditionally only when its file has existed since its own phase; a block whose tests arrived in THIS phase is gated on the count at which they appeared, so every historical pin keeps the value it recorded"
    - "The store-level account assertion sorts; the DOM order (D-16) is asserted separately, so the two orders cannot be confused for one another"

key-files:
  created: []
  modified:
    - tests/e2e/shell/multi-account.spec.ts
    - tests/e2e/guards/zero-network.spec.ts
    - tests/fixtures/multi-account-fixtures.ts
    - tests/unit/guards/ci-budget.test.ts
    - playwright.config.ts
    - .github/workflows/ci.yml
    - .planning/ROADMAP.md
    - .planning/phases/09-multi-account-import-account-identity/09-VALIDATION.md

key-decisions:
  - "The Phase 9 hold-back is gated on `listedTests >= 258` rather than unconditional. Below that count the two long tests are not in the suite, so there is nothing to hold back — and the gate is what keeps every pre-existing `projectedE2eSeconds` pin (184 / 234 / 239 / 242 / 251 / 252) at exactly the value the phase that measured it recorded. An unconditional subtraction would have silently rewritten all of them, which the plan's acceptance criteria forbid and which would destroy the pins' only purpose."
  - "The measured prices are the SLOWEST run of each test, not the average: an allowance that understates its block raises all three limits later anyway, and the 1.3x margin is the only thing absorbing an estimate until a CI run measures it"
  - "No floor on the Phase 9 allowance, unlike the finance block's 90 s. These tests pay for a second and a third import, not for a multi-megabyte archive built in Node and a second browser context — a floor that overstated the block would raise all three limits further than the evidence supports"
  - "The long-text fixture was fixed rather than the phone step relaxed. The step asserted `MA_LONG_NICKNAME` because the fixture's own JSDoc and the classify test's own NAME both claim the twenty-digit root carries it; it did not, so the honest fix was the fixture"
  - "The long row is matched by VALUE, not by index: neither of the two long-text roots has any session file, so their D-16 order is a tie the test has no reason to know"
  - "Reload is deliberately absent from the zero-network stage: a reload starts a new document and a new worker, which the file's single-worker assertion would read as a second one (Planner choice 5)"
  - "The zero-network test's TITLE changed with its scope ('through every Phase 5 flow and the Phase 9 multi-account import'). A title that stops describing what the test does is the same stale contract as a stale comment — 03-07's recorded rule"

requirements-completed: [ACCOUNT-01, ACCOUNT-03, ACCOUNT-05, ACCOUNT-08]

coverage:
  - id: D1
    description: "One cached dataset survives reload, duplicate, replace, Clear and Start Over with three, two and one accounts, and the raw IndexedDB store holds exactly the current dataset's accounts after every step and nothing at all after Clear or Start Over"
    requirement: ACCOUNT-03
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#(b) one cached dataset survives reload, duplicate, replace, clear and start over with three, two and one accounts"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts (unrelated); the 1/2/3-account unit matrix is tests/unit/import/multi-account-lifecycle.test.ts, run green by `pnpm run test:unit` (3109 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A multi-account replace followed by a visit to every pane makes no network request, spawns no second worker and raises no CSP violation"
    requirement: ACCOUNT-01
    verification:
      - kind: e2e
        ref: "tests/e2e/guards/zero-network.spec.ts#no network request, no second worker and no CSP violation through every Phase 5 flow and the Phase 9 multi-account import"
        status: pass
    human_judgment: false
  - id: D3
    description: "At 375px the account rows hold a 40-character nickname and a 20-digit account id with no horizontal overflow, every row inside the viewport and the full text present in the rendered DOM"
    requirement: ACCOUNT-05
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#at 375px a 40-character nickname and a 20-digit id stay readable"
        status: pass
    human_judgment: false
  - id: D4
    description: "Whether the wrapped long text READS well next to its labels on a real phone-width render"
    verification: []
    human_judgment: true
    rationale: "The measured half is automated (no overflow, every row inside 375px, full nickname and full 20-digit id in the DOM), but legibility of a wrapped nickname is a property of the rendered page at a real device, which no assertion in this plan can establish. The 09-VALIDATION manual row 'Account rows at 480px with long nickname/ID' is the open one."
  - id: D5
    description: "The e2e count, its ceiling and the three CI limits are reconciled on one measured baseline: 258 listed tests in 28 files, priced as a block at E = 1360 s with a 1768 s floor, so G / W / J moved together to 30 / 32 / 40 min"
    requirement: ACCOUNT-08
    verification:
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts (7 tests, incl. the projection pin for 258 and the raised-limits test)"
        status: pass
      - kind: other
        ref: "pnpm exec playwright test --list -> Total: 258 tests in 28 files"
        status: pass
    human_judgment: false
  - id: D6
    description: "The whole suite is green at the phase gate — unit, every Playwright spec, the type and Svelte check, lint, the production build — with no dependency and no lockfile change and src/lib/import untouched"
    requirement: ACCOUNT-01
    verification:
      - kind: other
        ref: "pnpm run test:unit && pnpm exec playwright test && pnpm run check && pnpm run lint && pnpm run build && git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml (exit 0; 3109 unit passed, 258 e2e passed, 313 files 0 errors)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The user's real three-account export classifies as three roots against the shipped code"
    verification: []
    human_judgment: true
    rationale: "NOT RUN. The optional read-only check of the private archive (09-RESEARCH.md Sources) was denied by the environment's data-handling permission, so the claim is neither made nor disproved. The real-shape claim rests on 09-RESEARCH.md's zip listing; the VALIDATION manual row covers the full visual check."

duration: 12 min
completed: 2026-10-17
status: complete
---

# Phase 9 Plan 06: One dataset, one worker, one phone Summary

**A browser chain proves the one-dataset lifecycle against the raw IndexedDB store for three, two and one accounts, a three-account replace opens all nine panes with zero requests, the 375px layout holds long untrusted text — and the e2e budget is repriced and its three CI limits raised together to 30 / 32 / 40 min.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-17T17:19:49Z
- **Completed:** 2026-10-17T17:32:16Z
- **Tasks:** 3
- **Files modified:** 8 (0 created, 8 modified)

## Accomplishments

- **The lifecycle chain is proven where a fake IndexedDB cannot reach it.** Test (b) imports the three-account archive, reloads, re-drops the identical bytes, replaces with two accounts, clears, imports three again, replaces with one and starts over — and after each of those eight steps reads the raw `rows` and `meta` stores through the browser `indexedDB` API and asserts the sorted distinct set of row `account` values, the row count and the meta count. After Clear and after Start Over both stores are empty, and a reload after each finds nothing cached.
- **The Phase 5 zero-network test gained a multi-account stage.** After its sample-export replace it now confirms a three-account replace and walks every entry of `PANE_IDS`; the file's existing end assertions (no request after the baseline, one worker, same origin, no CSP violation) cover the stage unchanged. Its timeout moved 180 s to 300 s and its title and flow-count comments were updated with it.
- **The 375px step measures the phone layout.** `document.documentElement.scrollWidth` never exceeds `window.innerWidth`, every `identity-multi-row` bounding box ends inside 375px, and the full 40-character nickname and the full 20-digit account id are in the rendered DOM. The component needed no style change — 09-04 had already given the multi branch `min-width: 0` and `overflow-wrap: anywhere`, and that is now measured rather than assumed.
- **The budget is priced honestly and the three limits moved together.** Measured slowest-run times of 3.6 s (three-account test), 5.7 s (lifecycle test) and +1.3 s for the stage the Phase 5 zero-network test gained; × the ~3x runner factor the guard already uses, rounded up, is a 32 s allowance. 258 listed tests in 28 files then project E = 1360 s against a 1768 s floor, so G, W and J move from 29 / 31 / 39 to **30 / 32 / 40** min with a 262-test ceiling.
- **The stale baseline is gone and D-23 is corrected by measurement.** The suite measured **258 tests in 28 files**. D-23's planning-time "256 in 27 files" turned out to predate plan 09-04's spec file (the 28th file, and one of its two tests), so the count this phase actually started from is 257 in 28 files. All three places that carried a stale figure — the guard's header, the ROADMAP Planning Notes bullet and 09-VALIDATION.md — now agree, and the ROADMAP bullet no longer carries the 254.
- **The full phase gate is green:** 3109 unit tests in 96 files, all 258 Playwright tests, `tsc -b && svelte-check` (313 files, 0 errors, 0 warnings), prettier + eslint, and the production build. `git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml` exits 0 and `git diff --quiet b4e7f31 -- src/lib/import` exits 0.

## Task Commits

1. **Task 1: Tracer — the same cached dataset survives a reload, a duplicate, a replace, a Clear and a Start Over with one, two and three accounts** — `539b5c3` (test)
2. **Task 2: Zero network through a three-account replace and every pane, and the 375px long-text step** — `cc81b56` (fix)
3. **Task 3: Reconcile the CI budget and run the phase gate** — `2e4ce16` (chore)
4. **Graph refresh** — `3bfbe41` (chore) — not a task; `graphify update .` after the code changes, per AGENTS.md. It also picks up the Phase 9 worker, cache and header changes left unrefreshed since 09-02.

## Files Created/Modified

- `tests/e2e/shell/multi-account.spec.ts` — the file-local `readStoreSnapshot` / `sortedRoots`, test (b) with its eight `test.step` stages, and the 375px long-text step as its last one
- `tests/e2e/guards/zero-network.spec.ts` — stage 11 (three-account replace + every pane), timeout 180 s → 300 s, title and flow counts updated
- `tests/fixtures/multi-account-fixtures.ts` — `buildLongTextAccountsExport` now passes `nickname: MA_LONG_NICKNAME`, with the reason written into its JSDoc
- `tests/unit/guards/ci-budget.test.ts` — the Phase 9 header paragraph, the Phase 8 correction sentence, three new constants, the gated hold-back in `projectedE2eSeconds`, the 258 pin and the raised-limits test
- `playwright.config.ts` — `globalTimeout` 29 → 30 min with the Phase 9 arithmetic in the comment block above it
- `.github/workflows/ci.yml` — `timeout-minutes` 39 → 40 and the wrapper `31m` → `32m`, in the same change, each with the Phase 9 note
- `.planning/ROADMAP.md` — the Planning Notes e2e budget bullet restated (one scoped edit)
- `.planning/phases/09-multi-account-import-account-identity/09-VALIDATION.md` — all 16 task rows green, both flags set, the Wave 0 checklist ticked, and the two cells that carried the stale 256 corrected

## Decisions Made

- **D-23's planning figure was itself stale, and saying so was cheaper than reproducing it.** The plan expected 258 = "256 listed before this phase plus two", and 258 is exactly what `--list` prints — but the arithmetic does not hold: this plan added ONE listed test, so the suite stood at 257 when it started. 09-05's SUMMARY independently recorded 257, which is the cross-check. D-23's "256 in 27 files" matches the count before 09-04 created the 28th file. The recorded truth is 258 now, 257 before, and both stale figures are labelled as such rather than restated.
- **The hold-back is gated, not unconditional** (see key-decisions above). This is the one place where the plan's action text and its acceptance criteria pull against each other; the resolution is recorded as a deviation below.
- **The slowest run of each test is the measurement.** Averaging would make the allowance smaller and the raise look more marginal than it is. An allowance that understates its block raises all three limits later anyway.
- **The long-text fixture was the defect, not the component.** The RED failed with `rows: Synthetic EU Captain,Synthetic EU Captain` — the fixture left the nickname to the default, so both roots carried the same name and `MA_LONG_NICKNAME` was an unused export in the whole repository. Its JSDoc and a classify test's own test name both claimed otherwise.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `buildLongTextAccountsExport` never applied the long nickname it documents**
- **Found during:** Task 2 — the 375px step's RED run
- **Issue:** the long-text shape passes `{ root: MA_LONG_ROOT, identity: true }` and no `nickname`, so `accountInfoCsv` fell back to `MA_NICKNAME_EU` for BOTH roots. The shape carried no long text at all: `MA_LONG_NICKNAME` was an export nothing imported, the fixture's JSDoc ("the twenty-digit root carrying the forty-character nickname") was false, and `classify.test.ts`'s test named "a twenty-digit root carrying a forty-character nickname" passed only because it reads root NAMES.
- **Fix:** `{ root: MA_LONG_ROOT, identity: true, nickname: MA_LONG_NICKNAME }`, with the reason and the catching test written into the builder's JSDoc so it is not tidied back.
- **Files modified:** `tests/fixtures/multi-account-fixtures.ts`
- **Verification:** the RED failed on exactly this assertion with both rows reading `Synthetic EU Captain`; after the fix the two specs are 7 passed and `classify.test.ts` (133 tests with the two guard files) is green.
- **Committed in:** `cc81b56`

### Plan-text corrections (executor judgement, no implementation deviation)

- **The plan's Task 3 action and its acceptance criteria contradict each other on the pins.** The action says to subtract the held-back count in `projectedE2eSeconds` "exactly as the other held-back counts are subtracted" and to "re-derive every existing pin"; the acceptance criterion says the diff must show "no changed expected value in any pre-existing `projectedE2eSeconds` pin". An unconditional subtraction rewrites all six historical pins by +21 s each, which fails the criterion; refusing to price the two tests at all understates E by 32 s and hides the raise the plan itself predicts. **Resolution:** the hold-back is gated on `listedTests >= MULTI_ACCOUNT_LONG_TESTS_FROM` (258), which is semantically correct — below that count the two tests are not in the suite, so there is nothing to hold back and no allowance to add — and it leaves every pre-existing pin byte-identical. The only expected values that moved are the three CI limits in the raised-limits test, which the plan authorises explicitly.
- **The phone step runs at 375px, not the 480px of the VALIDATION manual row.** The plan specifies 375 x 812 and the must-have is written at 375px, so the automated step uses 375. The 480px manual row is left untouched and still open; it is a different width, not a contradiction.
- **The real-export check was not run.** The plan makes it optional ("if the user's private real export exists at the path recorded in 09-RESEARCH.md"). The environment's data-handling permission denied reading the archive, so nothing was claimed about it. No account ID, no archive copy, no repository file was involved.
- **The zero-network test's title was extended rather than left stale.** The plan authorised updating the comments that count the flows; the same reasoning 03-07 recorded ("a stale TEST NAME is the same stale contract as a stale comment") covers the title now that the test covers Phase 9 as well.

---

**Total deviations:** 1 auto-fixed (1 bug: a long-text fixture that carried no long text).
**Impact on plan:** The fix is one field in one fixture builder plus its JSDoc. No product behaviour changed, no assertion was weakened, and the 375px layout needed no style change at all.

## Issues Encountered

- **The plan's expected e2e count (258) and its expected arithmetic (256 + 2) disagree by one.** `pnpm exec playwright test --list` prints `Total: 258 tests in 28 files`, which matches the plan's ceiling but not its decomposition; this plan added exactly one listed test, and 09-05 recorded 257 as the count it left behind. The difference was found and explained rather than reconciled by assertion (see Decisions Made).
- **The measured wall times are small enough that the runner factor does all the work.** 3.6 s and 5.7 s on a development machine are 10.8 s and 17.1 s of CI cost before any browser-start variance, and the 1768 s floor sits 32 s under a 1800 s globalTimeout. The 1.3x margin is still the only absorber of the unmeasured parts (the baseline 330 s and the three scale blocks), which is unchanged from Phase 4 and named as such in the guard's header.

## Known Stubs

None. The lifecycle test reads the real store rather than a stub, the phone step reads the real rendered DOM, and the budget guard computes the projection from the live `--list` count.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 10 starts with the phase's whole e2e surface green and priced.** The next listed test in the repository — 259 — fails `ci-budget.test.ts` and forces all three limits together (G + 2 min, W + 8 min), exactly as 07-03, 07-04, 07-05 and 09-06 each did. Phase 10 should expect to raise them rather than to squeeze under them.
- **Two seams Phase 10 inherits:** the two keyed `{#each}` blocks now key by position, so merging rows across accounts is a change to the row BUILDERS (`buildVehicleView`, `buildSummary`) with no keyed-each work left; and `combinedCaption` in `DashboardSection.svelte` is the one place the caption is decided, so per-account filtering or a source-account column is a single `{#if}`.
- **One consequence to carry forward from 09-03 (D-21), recorded here so it is not lost:** returning a v1.0 cache purges unsupported-category rows on load, so a category a LATER phase promotes to supported needs a re-import before it is populated again. `purgeUnsupportedCategoryRows` is in `src/lib/worker/db.ts` and its unit matrix is `tests/unit/import/db.test.ts`.
- **The 09-02 D-18 test rewrites** the plan asked this SUMMARY to record: the deferred/unsupported category specs were rewritten during 09-02 to assert counts rather than stored rows, and `tests/unit/import/ingest-worker.test.ts` plus `tests/unit/import/multi-account-import.test.ts` now carry the per-root canary matrix. Nothing in 09-06 changed them; the phase gate ran them green.
- **Still open for a human:** the 480px long-text manual row in 09-VALIDATION.md, and the real three-account export import (denied in this environment).

## Self-Check: PASSED

- Files exist: all eight modified files verified on disk; no file was created by this plan.
- Commits exist and are ancestors of HEAD: `539b5c3`, `cc81b56`, `2e4ce16`, `3bfbe41` — measured `git rev-list --count 7673c75..HEAD` = 4, matching the ledger written before the first commit.
- Every task acceptance criterion re-run: Task 1 (`multi-account.spec.ts` exits 0 and lists exactly two tests; eight snapshot stages; `persistent-dataset.spec.ts` 8 passed), Task 2 (both specs exit 0, `zero-network.spec.ts` still lists 5, `multi-account.spec.ts` exactly 2; `phase8-ui-review-guards` + `fetch-scan` + `classify` = 133 passed), Task 3 (`ci-budget.test.ts` 7 passed; `--list` = 258 in 28 files; the three ROADMAP greps print 1 / 0 / 3; the pin diff shows only the new 258 pin and the three authorised limit values; the full gate exits 0).
- Plan-level `<verification>`: the full gate command exits 0; `git diff --quiet b4e7f31 -- src/lib/import` exits 0; `--list` reports exactly 258.

---
*Phase: 09-multi-account-import-account-identity*
*Completed: 2026-10-17*