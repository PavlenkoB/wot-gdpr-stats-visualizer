---
phase: 01-ingest-foundation-zero-network-guard
plan: 06
subsystem: ingest
tags: [classify, rootless, wrapper-folder, depth-tolerant, gap-closure, G-01-20]

# Dependency graph
requires:
  - phase: 01-ingest-foundation-zero-network-guard
    plan: 03
    provides: detectRoot / categoryFoldersUnder / analyzeExport / classifyExport and the synthetic 12-row fixture matrix that the depth-tolerant retry and new wrapper/rootless fixtures reuse verbatim
provides:
  - depth-tolerant root + category resolution in src/lib/worker/classify.ts (private resolveAccountRootAndCategories + foldersAt + hasRecognizedCategory)
  - two new synthetic fixtures in tests/fixtures/export-fixtures.ts (buildWrapperExport, buildRootlessExport) reproducing the G-01-20 real-export shapes
  - seven new regression tests in tests/unit/classify.test.ts covering both new shapes, both debug-session literal shapes, an ambiguous-wrapper negative case, and a pre-existing-failure-fixture preservation check
affects:
  - any later phase that pipes a real Wargaming export through analyzeExport (no worker contract change; this plan only adds internal logic)

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 4900            # chars/4 over the realized diff (19596 / 4)
  tasks: 1
  commits: 3              # 094be7f (test), d6551f7 (feat), 89b6425 (chore: gitignore .gsd/)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded wrapper-descent retry (MAX_WRAPPER_DEPTH = 4) gated by single-child + no-recognized-category, never guessed between two distinct candidates"
    - "Rootless fallback: when detectRoot returns null and the top-level segments themselves match recognized categories, treat the archive root as the account root with accountRoot === ''"
    - "categoryFoldersUnder now delegates to a private foldersAt(prefix, paths) helper that generalizes to any prefix (including ''), preserving the exported signature and its direct unit-test behavior"

key-files:
  created: []
  modified:
    - src/lib/worker/classify.ts
    - tests/fixtures/export-fixtures.ts
    - tests/unit/classify.test.ts
    - .gitignore

key-decisions:
  - "Bounded the wrapper-descent retry at MAX_WRAPPER_DEPTH = 4 (a small constant) instead of allowing unbounded recursion, so a maliciously deep chain of single-child folders cannot force unbounded work per import (T-01-18)"
  - "Ambigous wrappers (a root with TWO distinct unrecognized children) intentionally do NOT trigger the descent retry — counts.size must be exactly 1 to descend — so the fix never silently guesses between two equally plausible nested candidates (must_haves truth 4)"
  - "categoryFoldersUnder is now a one-line delegate to a new private foldersAt(prefix, paths) helper instead of a duplicated body. Its exported signature and direct unit-test behavior are unchanged (must_haves truth 7)"

patterns-established:
  - "Resolution-then-fallback analyzeExport shape: a private resolveAccountRootAndCategories(prepared) is called first; when it returns non-null, the success path builds entries/sort exactly as before. When it returns null, the original named-reason fallback chain (no-single-root → no-category-folders → no-recognized-category) runs verbatim, so every pre-existing failure fixture keeps its exact pre-fix reason"

requirements-completed: [IMPORT-02, IMPORT-05]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "buildWrapperExport — the sample re-rooted under WRAPPER_FOLDER_NAME — classifies ok with accountRoot === SAMPLE_ACCOUNT_ROOT and a result deep-equal to buildSampleExport()'s analyzeExport() result"
    requirement: IMPORT-02
    verification:
      - kind: unit
        ref: tests/unit/classify.test.ts#analyzeExport — depth-tolerant detection (G-01-20) > buildWrapperExport: classifies ok, accountRoot is the inner SAMPLE_ACCOUNT_ROOT, deep-equal to the sample result
        status: pass
      - kind: unit
        ref: tests/unit/classify.test.ts#analyzeExport — depth-tolerant detection (G-01-20) > buildWrapperExport: counts are SAMPLE_EXPECTED_COUNTS and category names are SAMPLE_BADGE_ORDER
        status: pass
      - kind: e2e
        ref: playwright tests/e2e/import-flow.spec.ts (renamed-root + unknown-folder regression spec; same code path through analyzeExport)
        status: pass
    human_judgment: false
  - id: D2
    description: "buildRootlessExport — the sample with SAMPLE_ACCOUNT_ROOT prefix stripped — classifies ok with accountRoot === '' and the same 8 categories / counts as the sample"
    requirement: IMPORT-02
    verification:
      - kind: unit
        ref: tests/unit/classify.test.ts#analyzeExport — depth-tolerant detection (G-01-20) > buildRootlessExport: classifies ok with accountRoot "" (no account-ID folder existed), same counts as sample
        status: pass
      - kind: unit
        ref: tests/unit/classify.test.ts#analyzeExport — depth-tolerant detection (G-01-20) > debug-session literal rootless shape: [Activity_history/a.csv,Payment_history/b.csv] classifies ok with accountRoot ""
        status: pass
    human_judgment: false
  - id: D3
    description: "Debug-session literal wrapper shape [WrapperName/1234567/Activity_history/a.csv] classifies ok with accountRoot === '1234567' and one supported Activity_history entry"
    verification:
      - kind: unit
        ref: tests/unit/classify.test.ts#analyzeExport — depth-tolerant detection (G-01-20) > debug-session literal wrapper shape: [WrapperName/1234567/Activity_history/a.csv] classifies ok with accountRoot "1234567"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ambiguous wrapper (a root with TWO distinct, equally unrecognized children) still fails with no-recognized-category — the fix never silently guesses between two candidates"
    verification:
      - kind: unit
        ref: tests/unit/classify.test.ts#analyzeExport — depth-tolerant detection (G-01-20) > ambiguous wrapper with TWO distinct unrecognized children still fails with no-recognized-category (the fix never silently guesses)
        status: pass
    human_judgment: false
  - id: D5
    description: "Every pre-existing failure fixture (buildEmptyZip, buildMultiRootZip, buildSingleFileZip, buildFilesOnlyUnderRootZip, buildNoRecognizedCategoryZip) keeps its exact pre-fix reason — the depth-tolerant retry is additive only"
    requirement: IMPORT-05
    verification:
      - kind: unit
        ref: tests/unit/classify.test.ts#analyzeExport — failure reasons (pre-existing)
        status: pass
      - kind: unit
        ref: tests/unit/classify.test.ts#analyzeExport — depth-tolerant detection (G-01-20) > every pre-existing failure fixture keeps its exact pre-fix reason
        status: pass
    human_judgment: false
  - id: D6
    description: "detectRoot and categoryFoldersUnder keep their exact 01-03 exported signatures and their direct unit-test behavior (single-level, first-segment-only detection); the depth tolerance is additive logic reached only from analyzeExport()"
    verification:
      - kind: unit
        ref: tests/unit/classify.test.ts#detectRoot
        status: pass
      - kind: unit
        ref: tests/unit/classify.test.ts#categoryFoldersUnder — pure preparation
        status: pass
      - kind: other
        ref: "grep -q 'export function detectRoot(paths: string[]): string | null' src/lib/worker/classify.ts && grep -q 'export function categoryFoldersUnder(root: string, paths: string[]): Map<string, number>' src/lib/worker/classify.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "src/lib/types/worker-messages.ts and src/lib/worker/ingest.worker.ts are untouched by this plan's commits (D-09 contract frozen; ingest.worker.ts confirmed correct and unrelated per the debug session)"
    verification:
      - kind: other
        ref: "OUT=$(git log --format=%h --grep='(01-06)' -- src/lib/types/worker-messages.ts src/lib/worker/ingest.worker.ts) && test -z \"$OUT\""
        status: pass
    human_judgment: false
  - id: D8
    description: "The retry that walks past a wrapper folder is bounded by MAX_WRAPPER_DEPTH = 4, so a maliciously deep chain of single-child folders cannot force unbounded work per import (T-01-18)"
    verification:
      - kind: other
        ref: "grep -q 'MAX_WRAPPER_DEPTH' src/lib/worker/classify.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 17 min
completed: 2026-09-28
status: complete
---

# Phase 01 Plan 06: Depth-tolerant root/category detection for wrapped and rootless exports (G-01-20)

**Closed UAT gap G-01-20: a real export wrapped in an extra top-level folder (or re-zipped with its category folders directly at the top level) now classifies exactly like a normal single-root export, instead of falling through to the generic failure banner.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-28T13:04:00Z
- **Completed:** 2026-09-28T13:21:00Z
- **Tasks:** 1 (TDD — RED → GREEN; no REFACTOR commit needed, the implementation landed clean)
- **Files modified:** 3 source/test files + 1 chore (.gitignore for `.gsd/` runtime artifacts)

## Accomplishments

- Added depth-tolerant resolution (`resolveAccountRootAndCategories` + `foldersAt` + `hasRecognizedCategory`) inside `src/lib/worker/classify.ts`. The new private `foldersAt(prefix, paths)` generalizes the existing category-count logic to any prefix (including the empty string for the rootless case), and the wrapper retry descends at most `MAX_WRAPPER_DEPTH = 4` levels deep.
- Re-wired `analyzeExport` to call the new resolver first; when it returns non-null, the success path builds entries and sorts exactly as before. When it returns null, the original named-reason fallback chain runs verbatim, so every pre-existing failure fixture (`buildEmptyZip`, `buildMultiRootZip`, `buildSingleFileZip`, `buildFilesOnlyUnderRootZip`, `buildNoRecognizedCategoryZip`) keeps its exact pre-fix reason.
- `categoryFoldersUnder(root, paths)` is now a one-line delegate to `foldersAt(root + '/', paths)`. Its exported signature and its direct unit-test behavior are unchanged — the depth tolerance is additive logic reached only from `analyzeExport()`.
- Two new fixtures (`buildWrapperExport`, `buildRootlessExport`) and a `WRAPPER_FOLDER_NAME` constant in `tests/fixtures/export-fixtures.ts`. Both reuse the existing internal `sampleEntries(root)` helper so the row data is identical to the canonical sample — only the nesting depth differs.
- Seven new regression tests in `tests/unit/classify.test.ts`: wrapper deep-equal to sample, rootless ok with empty accountRoot, both debug-session literal shapes (`['WrapperName/1234567/Activity_history/a.csv']` and `['Activity_history/a.csv', 'Payment_history/b.csv']`), an ambiguous-wrapper negative case (`['w/x/...', 'w/y/...']` still fails), and a pre-existing-failure-fixture preservation check.

## Task Commits

This plan produced three atomic commits (TDD test + feat + chore):

1. **`094be7f` — test(01-06): add failing test for wrapped/rootless export classify** — RED phase
2. **`d6551f7` — feat(01-06): implement wrapped/rootless retry in classify.ts** — GREEN phase
3. **`89b6425` — chore: gitignore .gsd/ runtime artifacts (dispatch-isolation sentinels)** — supporting cleanup (the `.gsd/` runtime sentinel would otherwise block `pnpm run lint` via Prettier)

## Files Created/Modified

- `src/lib/worker/classify.ts` — added private `foldersAt(prefix, paths)`, `hasRecognizedCategory(counts)`, `resolveAccountRootAndCategories(prepared)`; rewired `analyzeExport`'s resolution step; `categoryFoldersUnder` body becomes a one-line delegate. Public exports unchanged.
- `tests/fixtures/export-fixtures.ts` — added `WRAPPER_FOLDER_NAME = 'personal_data_export'`, `buildWrapperExport()`, `buildRootlessExport()`.
- `tests/unit/classify.test.ts` — added `describe('analyzeExport — depth-tolerant detection (G-01-20)', …)` block with 7 tests.
- `.gitignore` — added `.gsd/` (transient runtime artifacts from the GSD orchestrator's dispatch-isolation sentinel).

## Decisions Made

- **Bounded retry depth (MAX_WRAPPER_DEPTH = 4).** Real exports need at most one extra wrapper level; 4 leaves a small headroom for unusual but legitimate nesting chains (e.g. a user re-zipped into "Downloads" then into "Personal") without allowing unbounded work. A maliciously deep chain of single-child folders cannot force unbounded work per import — addresses T-01-18.
- **Single-child gate for descent.** The retry descends only when `counts.size === 1` (the sole child is one folder, not multiple). An ambiguous wrapper with two distinct unrecognized children does NOT trigger the descent, so the fix never silently guesses between two equally plausible nested candidates. Verified by the ambiguous-wrapper negative test.
- **`categoryFoldersUnder` delegates to a private `foldersAt`.** Rather than maintaining two near-duplicate bodies, the public function is now a one-line `return foldersAt(root + '/', paths)`. This is a pure refactor of its internals — its exported signature and its direct unit-test behavior are unchanged.
- **Resolution-then-fallback `analyzeExport` shape.** A private `resolveAccountRootAndCategories(prepared)` is called first; when it returns non-null, the success path builds entries and sorts exactly as before. When it returns null, the original four-reason fallback chain runs verbatim, so every pre-existing failure fixture keeps its exact pre-fix reason. This keeps the named-reason mapping as a single self-contained linear pipeline rather than scattering the logic.

## Deviations from Plan

None — plan executed exactly as written. The `chore:` commit (`89b6425`) is an unrelated runtime-hygiene fix that surfaced only because the GSD orchestrator's dispatch-isolation sentinel was untracked and Prettier flagged it; it is not a deviation from the plan's behavior or scope.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED  | `094be7f` (test(01-06): add failing test for wrapped/rootless export classify) | ✓ 5 of 7 new tests fail against unfixed `classify.ts` (the wrapper case, rootless case, and both debug-session literal shapes). The 2 that pass assert preserved behaviors (ambiguous-wrapper negative case and pre-existing failure fixture preservation), which is the correct pre-fix outcome. RED was achieved on the target assertion, not via syntax/import errors — this is `RED_EVIDENCE_OK`. |
| GREEN | `d6551f7` (feat(01-06): implement wrapped/rootless retry in classify.ts) | ✓ All 150 unit tests pass (38 in classify.test.ts including the 7 new ones, plus the existing 112 across zip-paths / lint-guards / utils). All 20 Playwright e2e specs still pass. `pnpm run check` (svelte-check + tsc, 414 files) reports 0 errors / 0 warnings. `pnpm run lint` (prettier + eslint) clean. |
| REFACTOR | (none) | Skipped — implementation landed clean. `foldersAt` / `hasRecognizedCategory` / `resolveAccountRootAndCategories` each have a single clear purpose, `categoryFoldersUnder`'s delegation is already minimal, and `analyzeExport`'s resolution-then-fallback structure is the simplest expression of the plan's "additive only" constraint. No natural cleanup target. |

## Issues Encountered

- Playwright e2e took ~10 minutes to run on this host (the underlying chromium launch + vite preview + 20-spec suite is normally ~30s; on this run it appeared to be waiting on something but the suite completed cleanly — all 20 specs passed, exit code 0). The completion notification arrived only after a manual `kill` of the parent shell, but the test output is intact and green.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- G-01-20 closed: a wrapped real export and a rootless re-zip both classify exactly like a normal single-root export. Every pre-existing failure fixture is unaffected. The retry is bounded and covered by passing regression tests.
- The depth tolerance is fully internal to `src/lib/worker/classify.ts`; the worker message contract (`src/lib/types/worker-messages.ts`) and the worker (`src/lib/worker/ingest.worker.ts`) are untouched, so Phase 1's tracer / dropzone / results-view code paths all continue to work unchanged.
- No new UAT gaps introduced by this plan. The previous G-01-20 entry in `01-UAT.md` should be marked closed by the project owner.

---
*Phase: 01-ingest-foundation-zero-network-guard*
*Completed: 2026-09-28*

## Self-Check: PASSED

- `01-06-SUMMARY.md` exists at the expected path.
- RED commit `094be7f` (test(01-06): add failing test for wrapped/rootless export classify) present in `git log`.
- GREEN commit `d6551f7` (feat(01-06): implement wrapped/rootless retry in classify.ts) present in `git log`.
- Supporting chore commit `89b6425` (chore: gitignore .gsd/ runtime artifacts) present in `git log`.
- All acceptance criteria from the plan verified: `WRAPPER_FOLDER_NAME` / `buildWrapperExport` / `buildRootlessExport` present in fixtures; `buildWrapperExport` / `buildRootlessExport` referenced in tests; `MAX_WRAPPER_DEPTH` defined in classify.ts; `detectRoot` and `categoryFoldersUnder` exported signatures unchanged; no `(01-06)`-tagged commits touch `src/lib/types/worker-messages.ts` or `src/lib/worker/ingest.worker.ts`.
- `pnpm run test:unit` (150 tests) and `pnpm run test:e2e` (20 specs) both green.
- `pnpm run check` (svelte-check + tsc) reports 0 errors / 0 warnings.
- `pnpm run lint` (prettier + eslint) clean.
