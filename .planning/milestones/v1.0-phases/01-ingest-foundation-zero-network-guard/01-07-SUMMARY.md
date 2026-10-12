---
phase: 01-ingest-foundation-zero-network-guard
plan: 07
subsystem: worker-ingest
tags: [classify, zip-paths, account-root, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 01-ingest-foundation-zero-network-guard
    provides: "01-06 depth-tolerant resolveAccountRootAndCategories() (wrapper-descent retry + rootless fallback) that this plan corrects"
provides:
  - "CR-01 closed — a Wargaming export-wrapper folder is never reported as accountRoot; the wrapper-around-categories shape resolves to accountRoot ''"
  - "WR-06 closed — the rootless read runs before detectRoot() and before any named-reason chain, so it can no longer be pre-empted"
  - "WR-03 closed — categoryFoldersUnder('', paths) delegates to the prefix-agnostic internal read instead of matching the nonexistent '/' prefix"
  - "6-test guard block (2 fail-first targets + 4 regression invariants) added to tests/unit/classify.test.ts"
affects: [01-ingest-foundation-zero-network-guard, worker-ingest, classify, phase-02-parsing]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 3029
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rootless-first root resolution: read the top-level segments before any named-reason chain so a flattened re-zip is never mis-routed (WR-06)"
    - "Transparent-wrapper rule: the account root is reported only when it is a real account id; Wargaming's own export-wrapper folder name is allow-listed as transparent (CR-01)"

key-files:
  created: []
  modified:
    - src/lib/worker/classify.ts
    - tests/unit/classify.test.ts

key-decisions:
  - "CR-01 is closed with a NAME-anchored transparent-wrapper rule, not the plan's path-shape 'priority inversion' alone: the two shapes are structurally identical, so no path predicate can separate them. The allow-list holds only the folder name Wargaming itself emits (the same name tests/fixtures/export-fixtures.ts already pins as WRAPPER_FOLDER_NAME), so WrapperName/1234567/... and renamed-root-2026/... are untouched."
  - "Task 2 (type=tracer) carries the CR-01 production slice and Task 3 (type=auto) the WR-03 hardening, instead of both fixes landing in Task 3 — a task that changes no file has nothing to commit, and Task 2's own <verify> is only satisfiable after the CR-01 fix."
  - "No exported signature changed; the priority inversion and the wrapper rule are private to resolveAccountRootAndCategories()."

patterns-established:
  - "Fail-first target tests are named after the finding they close (CR-01 / WR-06 / WR-03) and sit in one describe block that opens with WHY prose"
  - "A regression-guard invariant test is written alongside every fail-first test and must pass BEFORE the production change, proving it is a guard and not a second RED target"

requirements-completed: []

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "CR-01: analyzeExport(['personal_data_export/Activity_history/foo.csv']) classifies ok with accountRoot '' instead of surfacing the export-wrapper folder name"
    verification:
      - kind: unit
        ref: "tests/unit/classify.test.ts#analyzeExport — priority inversion + empty-root guard (CR-01 / WR-06 / WR-03) > CR-01"
        status: pass
      - kind: other
        ref: "node -e \"import('./src/lib/worker/classify.ts').then(m => console.log(JSON.stringify(m.analyzeExport(['personal_data_export/Activity_history/foo.csv']), null, 2)))\" — accountRoot \"\", exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "WR-06: the rootless read is attempted before any named-reason chain, so a wrapper retry that exhausts can no longer pre-empt it"
    verification:
      - kind: unit
        ref: "tests/unit/classify.test.ts#analyzeExport — priority inversion + empty-root guard (CR-01 / WR-06 / WR-03) > priority-inversion invariant: the rootless shape still resolves accountRoot \"\""
        status: pass
      - kind: other
        ref: "node -e rootless invariant one-liner — prints ok, exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "WR-03: categoryFoldersUnder('', paths) returns the same top-level category Map as the internal prefix-agnostic read instead of an empty Map"
    verification:
      - kind: unit
        ref: "tests/unit/classify.test.ts#analyzeExport — priority inversion + empty-root guard (CR-01 / WR-06 / WR-03) > WR-03"
        status: pass
      - kind: other
        ref: "node -e \"categoryFoldersUnder('', ['Activity_history/a.csv'])\" — size=1 [[\"Activity_history\",1]], exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The priority inversion never guesses between the wrapper-around-account and wrapper-around-categories shapes, and every pre-existing failure fixture keeps its exact reason"
    verification:
      - kind: unit
        ref: "tests/unit/classify.test.ts#analyzeExport — priority inversion + empty-root guard (CR-01 / WR-06 / WR-03) > priority-inversion invariant: the wrapper-around-account shape still resolves accountRoot \"1234567\""
        status: pass
      - kind: unit
        ref: "tests/unit/classify.test.ts#analyzeExport — priority inversion + empty-root guard (CR-01 / WR-06 / WR-03) > every pre-existing failure fixture keeps its exact pre-fix reason (the priority inversion is additive only)"
        status: pass
      - kind: unit
        ref: "pnpm run test:unit — 15/15 files, 336/336 tests, exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Name-anchored transparent-wrapper rule: whether a Wargaming export-wrapper folder should ever be reported as an account root is a domain call the test suite proves from both sides, but the choice of an explicit name allow-list over a broader heuristic is a product decision"
    verification:
      - kind: unit
        ref: "tests/unit/classify.test.ts (CR-01 + wrapper-around-account + renamed-root behaviour all pinned)"
        status: pass
    human_judgment: true
    rationale: "No automated check can decide that allow-listing one Wargaming-emitted folder name is the right product behaviour versus a wider wrapper heuristic. The tests only prove the rule behaves as written; a reviewer must confirm the rule itself is the right call."

# Metrics
duration: 11min
completed: 2026-09-30
status: complete
---

# Phase 01 Plan 07: Transparent export wrapper, rootless-first resolution, empty-root guard

**Wargaming's export-wrapper folder is no longer reported as an account id (`accountRoot: ''` for a wrapper sitting directly above the categories), the rootless read can no longer be pre-empted by a wrapper retry, and `categoryFoldersUnder('', …)` stopped silently returning an empty Map.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-30T15:29:18Z
- **Completed:** 2026-09-30T15:38:57Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **CR-01 (critical) closed.** `analyzeExport(['personal_data_export/Activity_history/foo.csv'])` returns `ok` with `accountRoot: ''`, the exact category set and status counts the plan pinned, instead of `accountRoot: 'personal_data_export'`.
- **WR-06 closed.** The rootless read moved ahead of `detectRoot()` and ahead of every named-reason chain, so a wrapper retry that exhausts can no longer pre-empt it.
- **WR-03 closed.** `categoryFoldersUnder('', paths)` now delegates to the prefix-agnostic internal read; the empty root no longer becomes a `'/'` prefix that matches nothing and returns an empty Map.
- **The ambiguity between the two wrapper shapes is resolved explicitly, not guessed.** `WrapperName/1234567/Activity_history/a.csv` still resolves `1234567`, `renamed-root-2026/…` still resolves `renamed-root-2026`, and the ambiguous-wrapper shape still fails `no-recognized-category`.
- **6 tests added, 0 pre-existing tests modified**, 51/51 green in the classify file and 336/336 across the full unit suite.

## Task Commits

Each task was committed atomically:

1. **Task 1: add RED tests for CR-01 transparent wrapper + WR-03 empty-root guard** - `25c5d0c` (test)
2. **Task 2: rootless-first resolution + never report the export wrapper as accountRoot** - `cb03ea2` (fix)
3. **Task 3: make categoryFoldersUnder("", paths) count the top level** - `7afbaf4` (fix)

**Plan metadata:** this commit (docs: complete plan)

_Note: Task 1 is a TDD task, so the plan's RED state is its own commit, committed before any production change._

## Files Created/Modified

- `src/lib/worker/classify.ts` — resolver reordered rootless-first (WR-06); the settled candidate root is reported only when it is not Wargaming's transparent export-wrapper folder (CR-01, via the new private `EXPORT_WRAPPER_FOLDER` / `isTransparentWrapper`); `categoryFoldersUnder` empty-root delegation (WR-03). No exported signature changed.
- `tests/unit/classify.test.ts` — one new `describe` block (6 tests) appended after the G-01-20 block: 2 fail-first targets (CR-01, WR-03) + 4 regression invariants (wrapper-around-account `1234567`, rootless `''`, ambiguous-wrapper `no-recognized-category`, pre-existing failure-fixture reasons). No pre-existing test touched.

## Decisions Made

- **The name is the only available discriminator, so the wrapper rule is name-anchored.** The wrapper-around-categories shape (`personal_data_export/Activity_history/foo.csv`) and the canonical single-account shape (`123456789/Activity_history/foo.csv`) are structurally identical — one top-level folder whose direct children are recognized categories. A "single folder above recognized categories is a wrapper" rule would return `accountRoot: ''` for an ordinary export and throw away a real account id, breaking the pre-existing `buildSampleExport` test. The rule therefore allow-lists exactly the folder name Wargaming itself emits — the same name `tests/fixtures/export-fixtures.ts` already pins as `WRAPPER_FOLDER_NAME` — and leaves every other name (including `WrapperName` and `renamed-root-2026`) untouched. This satisfies the plan's prohibition on guessing between the two shapes: the shape→answer mapping is pinned by tests on both sides.
- **Task 2 carries the CR-01 slice; Task 3 carries the WR-03 hardening.** The plan put both fixes in Task 3 and left Task 2 (type=tracer) as pure evidence capture, which would have left a tracer task with no file to commit and a `<verify>` that cannot pass at its own task boundary. The two production changes are the same ones the plan lists; only the commit boundary differs.
- **Coverage D5 is flagged for human judgment.** The tests prove the rule behaves as written; whether an explicit one-name allow-list is the right product call is not something a test can decide.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Code doesn't work as intended] The plan's CR-01 mechanism is a no-op for the CR-01 shape; a name-anchored transparent-wrapper rule was required**
- **Found during:** Task 2 (end-to-end tracer of the CR-01 shape)
- **Issue:** The plan specifies the priority inversion as "Strategy A: rootless-first — if the top-level segments themselves are recognized categories, this is the wrapper-around-categories shape (CR-01)". That premise is false for the shape CR-01 is actually about. For `personal_data_export/Activity_history/foo.csv` the rootless read `foldersAt('', prepared)` yields `{personal_data_export: 1}` — the wrapper name, which is `unknown`, not a recognized category — so Strategy A never fires and the wrapper retry returns `accountRoot: 'personal_data_export'` exactly as before the change. Measured before applying anything: the rootless read of that path list is `{"personal_data_export":1}`, and `classifyFolder('personal_data_export') === 'unknown'`. Executed literally, the plan's fix would have left its own critical RED test failing and its own Task 2/3 `<verify>` one-liner exiting 2.
- **Fix:** Kept the plan's rootless-first reordering (it is still load-bearing for WR-06) and added the smallest change that actually closes CR-01: the settled candidate root is reported only if it is not Wargaming's export-wrapper folder, i.e. `return { root: isTransparentWrapper(displayRoot) ? '' : displayRoot, counts }`. One private constant plus one private predicate.
- **Files modified:** `src/lib/worker/classify.ts`
- **Verification:** CR-01 one-liner now prints `"accountRoot": ""` with `{"Activity_history"}` and counts `{supported:1, known-deferred:0, unknown:0}`, exit 0; the fail-first CR-01 test went red→green; `WrapperName/1234567/…` still `1234567` and `renamed-root-2026/…` still `renamed-root-2026`; full suite 336/336.
- **Committed in:** `cb03ea2` (Task 2 commit)
- **Worth a human look:** this substitutes a name allow-list for a path-shape predicate. Both the CR-01 and wrapper-around-account outcomes are pinned by tests, so the behaviour is not a guess, but the choice of a name allow-list as the mechanism is a product call (coverage D5).

---

**Total deviations:** 1 auto-fixed (1 rule-1 correctness)
**Impact on plan:** The plan's stated must_haves are all met; the deviation is confined to HOW CR-01 is closed. No scope creep — no file outside the plan's `files_modified`, no signature change, no frozen-contract file touched.

## Issues Encountered

- **`pnpm run lint` exits 1 — pre-existing, not caused by this plan.** All 119 errors are the same `Parsing error: No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs are present` and they hit every linted file, because a stray sibling checkout at `.kilo/worktrees/flashy-bit` (a registered git worktree at `2ef027c`, created 2026-09-30 10:37, i.e. before this session and owned by another tool) contributes a second `tsconfig.json` candidate. `.kilo/**` is not in the global `ignores` list in `eslint.config.js`. Verified unrelated to this plan: `prettier --check .` exits 0, and `eslint --config <the project's own config, with tsconfigRootDir pinned and `.kilo/**` ignored>` exits 0 with zero findings — same rules, same plugins, only the ambiguous root removed. Not fixed here: the directory is another tool's worktree and removing it is out of scope. Whoever owns it should either remove the worktree or add `.kilo/**` to the `ignores` list in `eslint.config.js:40-49`.
- **One full-suite run aborted with a `SIGKILL` of a Vitest worker fork** running `tests/unit/webserver-teardown.test.ts` while all 336 tests reported as passed. Environmental resource kill, not an assertion failure: the file passes in isolation, and two subsequent full-suite runs were clean (15/15 files, 336/336, exit 0). The plan's own Task 3 verification block anticipates the full suite not being stable in this environment.
- **The machine RED-evidence gate could not be evaluated.** `gsd-tools check tdd-red-evidence` requires `node --test` TAP output (`# tests/# pass/# fail` summary lines plus top-level `not ok` lines); this project runs Vitest, whose `tap` reporter is file-granular, so the classifier would misread it as a fixture/load failure. RED was instead established by the plan's own `<verify>`: the run exits 1 with exactly the two intended tests failing on their target assertions, and zero unrelated failures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three gap-closure findings (CR-01, WR-06, WR-03) are closed and pinned by tests; phase 01's advisory gaps are fully retired.
- `classify.ts` now has one more documented rule a later phase must preserve: `accountRoot` is a real account id, never Wargaming's export-wrapper folder. Extending the allow-list to more wrapper names is a one-line change to `EXPORT_WRAPPER_FOLDER`, but it needs a real sample to justify.
- Two behavior notes for later phases (no pre-existing test covers either): a wrapper nested deeper, e.g. `Downloads/personal_data_export/Activity_history/foo.csv`, also resolves `accountRoot: ''`; and a single top-level recognized category folder, e.g. `User_Info/Account_Info.csv`, now classifies as rootless instead of failing `no-category-folders` — an inherent consequence of the plan's prescribed rootless-first ordering.
- The D-09 worker contract stays frozen: `src/lib/types/worker-messages.ts` and `src/lib/worker/ingest.worker.ts` are untouched by all three task commits.

## Verification

All commands run from the repo root at branch `gsd/phase-01-advisory-gap-closure`, final HEAD `7afbaf4`.

**1. Plan Task 1 `<verify>` — `pnpm exec vitest run tests/unit/classify.test.ts` (RED state, commit `25c5d0c`)**

```
 Test Files  1 failed (1)
      Tests  2 failed | 49 passed (51)
FAIL  tests/unit/classify.test.ts > analyzeExport — priority inversion + empty-root guard (CR-01 / WR-06 / WR-03) > CR-01: [...]
AssertionError: expected 'personal_data_export' to be ''   // Object.is equality
 ❯ tests/unit/classify.test.ts:539:38
FAIL  tests/unit/classify.test.ts > analyzeExport — priority inversion + empty-root guard (CR-01 / WR-06 / WR-03) > WR-03: [...]
AssertionError: expected +0 to be 1 // Object.is equality
 ❯ tests/unit/classify.test.ts:561:20
exit 1
```

Both failures are on the target assertions for the planned behaviour. The four regression invariants passed in this same RED run, as the plan requires: wrapper-around-account `1234567`, rootless `''`, ambiguous-wrapper `no-recognized-category`, and all five pre-existing failure-fixture reasons unchanged.

**2. Plan Task 2 `<verify>` — the four `node -e` one-liners, BEFORE vs AFTER**

| # | one-liner | BEFORE (`25c5d0c`) | AFTER (`7afbaf4`) |
|---|---|---|---|
| 1 | pinned CR-01 reproducer from `01-VERIFICATION.md` | `"accountRoot": "personal_data_export"`, exit 0 | `"accountRoot": ""`, exit 0 |
| 2 | `["WrapperName/1234567/Activity_history/a.csv"].result.accountRoot` | `1234567`, exit 0 | `ok: 1234567`, exit 0 |
| 3 | `["Activity_history/a.csv","Payment_history/b.csv"].result.accountRoot` | `""`, exit 0 | `ok: ""`, exit 0 |
| 4 | `categoryFoldersUnder('', ["Activity_history/a.csv"])` | `size: 0 []`, `WR-03: expected Activity_history -> 1 got undefined`, exit 2 | `ok: size=1 [["Activity_history",1]]`, exit 0 |

Final AFTER output of #1, verbatim:

```json
{
  "ok": true,
  "result": {
    "accountRoot": "",
    "categories": [{ "name": "Activity_history", "status": "supported", "fileCount": 1 }],
    "counts": { "supported": 1, "known-deferred": 0, "unknown": 0 }
  }
}
```

The plan's Task 2 assert-form `<verify>` commands (which exit 2 on the bug) were also run after the fix: CR-01 → `{"accountRoot":"","categories":[...],"counts":{...}}` exit 0; wrapper-around-account → `ok` exit 0; rootless → `ok` exit 0.

**3. Plan Task 3 `<verify>`**

```
$ pnpm exec vitest run tests/unit/classify.test.ts
 Test Files  1 passed (1)
      Tests  51 passed (51)
exit 0

$ pnpm run test:unit
 Test Files  15 passed (15)
      Tests  336 passed (336)
exit 0

$ pnpm run check
svelte-check found 0 errors and 0 warnings
svelte-check found 0 errors and 0 warnings
exit 0

$ pnpm run lint
✖ 119 problems (119 errors, 0 warnings)   <-- all 119 are `No tsconfigRootDir was set`, caused by the stray .kilo/worktrees/flashy-bit checkout; see Issues Encountered
exit 1
```

`pnpm run lint` components, measured separately on the final tree:

```
$ pnpm exec prettier --check .
All matched files use Prettier code style!
exit 0
$ pnpm exec eslint --config <project eslint.config.js + tsconfigRootDir pinned + .kilo/** ignored> .
(no output)
exit 0
```

So the eslint half is clean under the project's own rules; the 119 parse errors are the ambiguous-root artifact of a foreign worktree, not a finding against this change.

**4. Frozen-contract guard**

```
$ git diff --name-only 6c4c548..HEAD
src/lib/worker/classify.ts
tests/unit/classify.test.ts
```

`src/lib/types/worker-messages.ts` and `src/lib/worker/ingest.worker.ts` are untouched. No pre-existing test in `tests/unit/classify.test.ts` was modified — the diff is 93 added lines, all inside the new `describe` block.

## Post-review correction (added by the orchestrator after the phase code review)

The post-execution code review found a **Critical regression introduced by this
plan's CR-01 fix**, which the verification above could not see because every
check it ran read `analyzeExport(...).accountRoot` — the *label* — and never
the only consumer that value feeds.

**The defect.** `ingest.worker.ts` passes `outcome.result.accountRoot` straight
into `resolveCsvFileCategory()` as the prefix deciding which zip entries to
inflate. For the transparent-wrapper shape, CR-01 mandates `accountRoot: ''`.
But `resolveCsvFileCategory` treated `root === ''` as "the categories sit at the
top level" and took path segment 0 as the category — which for this shape is
the wrapper folder itself, not a recognized category. Every entry was therefore
rejected, `unzipSync` inflated nothing, and the worker posted `done`, not
`error`: the user got a **successful import of an entirely empty dashboard**
instead of their data. Before this plan the same export imported fine (with the
wrapper name standing in for the account id), so the "fix" was a net regression.

No test caught it: the repo's `buildWrapperExport` fixture is the
wrapper-**around-account** shape, which still resolves, and no e2e spec uses it.

**The fix (commit `42aeef5`).** `resolveCsvFileCategory` now locates the first
segment that *is* a recognized category and treats everything above it as
transparent prefix when `root === ''`. This restores the invariant its own
docstring already demanded ("the mapping must agree with `analyzeExport`'s own
category resolution") without touching the D-09-frozen worker and without
reverting CR-01's `accountRoot: ''`.

**Regression guard added.** Two tests now pipe the shape through the *verbatim*
`unzipSync` filter rather than asserting the label, so the consumer can never
silently diverge from the resolver again.

```
CR-01 target  personal_data_export/Activity_history/foo.csv      root=""           inflated=1
deep wrapper  Downloads/personal_data_export/Activity_history/a.csv root=""        inflated=1
case variant  Personal_Data_Export/Activity_history/a.csv        root=""           inflated=1
wrapper-around-account WrapperName/1234567/Activity_history/a.csv root="1234567"  inflated=1
canonical     123456789/Activity_history/a.csv                  root="123456789"  inflated=1
rootless      Activity_history/a.csv                            root=""           inflated=1
bare file     foo.csv                                            analyze=FAIL:no-single-root

$ pnpm run test:unit   ->  339 passed (339)
$ pnpm run check       ->  exit 0
$ pnpm run lint        ->  exit 0
$ pnpm run build       ->  exit 0
```

---
*Phase: 01-ingest-foundation-zero-network-guard*
*Completed: 2026-09-30*
