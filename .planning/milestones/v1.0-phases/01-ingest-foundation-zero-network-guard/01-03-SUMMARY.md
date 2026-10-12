---
phase: 01-ingest-foundation-zero-network-guard
plan: 03
subsystem: ingest
tags: [svelte, vite, pnpm, typescript, web-worker, fflate, vitest, classify, path-normalization, zip-paths, inflate-trap]

requires:
  - phase: 01-ingest-foundation-zero-network-guard
    plan: 01
    provides: Plain Vite/Svelte/TS scaffold, synthetic in-memory fixture (buildSampleExport), typed D-09 worker contract, baseline classify.ts (detectRoot / categoryFoldersUnder / classifyExport), 01-01's zero-network Playwright spec depending on buildSampleExport's exact 12 names.
  - phase: 01-ingest-foundation-zero-network-guard
    plan: 02
    provides: ESLint flat config with the fflate-outside-worker ban (so src/lib/worker/zip-paths.ts is the only allowed fflate importer in src/), 01-02 lint-guard tests that prove the worker-boundary rule fires.
provides:
  - src/lib/worker/zip-paths.ts: listEntryPaths() — the only src/ file that imports fflate; path-only enumeration via the filter side-channel, never inflates (zip-bomb-safe).
  - src/lib/worker/classify.ts (hardened): normalizeEntryPath, isOsMetadataEntry, internal prepare() (normalize + drop OS-metadata), hardened detectRoot + categoryFoldersUnder, new analyzeExport() with a typed UnrecognizedReason, back-compat classifyExport().
  - Worker error detail: "unrecognized export: <reason> (<n> entries)" — name-free; the single try block still routes through {type:'error', jobId, detail}.
  - tests/fixtures/export-fixtures.ts (extended): 12 builders (renamed-root, mac-rezipped, backslash, directory-entries, no-recognized-category, multi-root, single-file, files-only-under-root, empty, not-a-zip, truncated, inflate-trap) + 5 constants (RENAMED_ACCOUNT_ROOT, EXTRA_UNKNOWN_FOLDER, SAMPLE_FILE_COUNTS, RENAMED_EXPECTED_COUNTS, SAMPLE_BADGE_ORDER). sampleEntries(root) refactored so buildSampleExport() still produces the exact 12 names 01-01's e2e spec depends on.
  - tests/unit/zip-paths.test.ts: locks two empirical fflate 0.8.3 facts (A2 throws "invalid zip data"; filter never inflates) with passing tests, including an unzipSync control on the inflate-trap that proves the trap bytes really are corrupt.
  - tests/unit/classify.test.ts: covers normalizeEntryPath, isOsMetadataEntry, detectRoot, the worker-pipeline happy paths, every failure reason, and the back-compat wrapper.
affects:
  - phase-02 (parsing + Dexie caching) — feeds entry-name lists through listEntryPaths, which now gives identical results on every fflate version 0.8.3 supports.
  - phase-03 (dashboard shell) — never has to special-case macOS or Windows zips; the classifier normalizes entry names before the UI sees them.
  - phase-04 (worker-level error UX) — analyzeExport's reason is the exact detail string the worker's error message carries, so a future "why did my zip fail" hover just reads analyzeExport's reason field.

# Actuals (#2632) — pairs with the plan's estimate.
actuals:
  tokens: ~5500          # chars in git diff --stat d01c0fc..ce859f9 insertion column (plan estimated 50000 — same scale, the plan estimate was high by ~9x; record the actual)
  tasks: 2               # Task 1 zip-paths + Task 2 classify
  commits: 7             # chore-fixtures, test-red-zip-paths, feat-green-zip-paths, test-red-classify, feat-green-classify, style-reformat, style-doc-reword

# Tech tracking
tech-stack:
  added: []              # no new runtime/dev dependencies — fflate was already in the lockfile and 01-02's worker-only-import rule already permits fflate inside src/lib/worker/.
  patterns:
    - Path-only zip enumeration lives in its own module (src/lib/worker/zip-paths.ts), so the safety-critical "never inflate" invariant is one literal grep away.
    - Internal prepare() helper runs normalize + metadata drop inside every public classify function; callers always see the hardened view.
    - analyzeExport returns a discriminated union {ok:true,result} | {ok:false,reason} so callers can't accidentally treat a failure as a ClassifyResult.
    - Locale-independent sort order: lowercase code-unit order, then raw code-unit order. No `localeCompare` anywhere in classify.ts.
    - Reasoned worker failure detail is name-free — only the named reason and entry-count appear in console.error / postMessage.

key-files:
  created:
    - src/lib/worker/zip-paths.ts
    - tests/unit/zip-paths.test.ts
    - tests/unit/classify.test.ts
  modified:
    - tests/fixtures/export-fixtures.ts (refactored sample into sampleEntries(root); 12 builders + 5 constants added)
    - src/lib/worker/classify.ts (added normalizeEntryPath, isOsMetadataEntry, prepare, analyzeExport; hardened detectRoot / categoryFoldersUnder; classifyExport kept as back-compat wrapper)
    - src/lib/worker/ingest.worker.ts (replaced inline unzipSync filter loop with listEntryPaths call; replaced classifyExport null-check with analyzeExport; new error message "unrecognized export: <reason> (<n> entries)")

key-decisions:
  - "Refactored buildSampleExport's hand-rolled sample into an internal sampleEntries(root) helper so the renamed-root and mac-rezipped / backslash / directory fixtures all share the canonical 12-file layout by composition — this is the only way 01-01's Playwright spec can keep depending on the exact 12 names."
  - "classifyExport() kept as a thin wrapper that returns the ok:true.result on success or null on failure — every 01-01 caller (and the worker's call site before this plan) already handled the null shape, so a back-compat wrapper preserves their call sites without restructuring."
  - "analyzeExport's `no-recognized-category` reason is a planner divergence from the research recommendation (RESEARCH Open Question 2 / FA-01-03-2): rejecting all-unknown roots is what closes success-criterion-2's ordinary-non-Wargaming-zip case. Reversible (one predicate) — the owner can veto at end-of-phase review."
  - "Inflate-trap fixture enforces compression method 8 at offset 8 BEFORE overwriting data; throws if the trap silently becomes a no-op. This is the only way the no-inflation proof stays honest if a future fflate version starts stored-compressing small entries."
  - "Worker error detail is `Error: unrecognized export: <reason> (<n> entries)` — names NEVER appear here. Anything that crosses the trust boundary to console or postMessage must be inspectable without leaking the user's file layout."

patterns-established:
  - "Module-private prepare() step: every function over path lists applies normalizeEntryPath + dropOsMetadata before any segment counting. The list-of-paths is normalized exactly once, at the trust boundary, then handed to pure classify functions."
  - "Failure-reason codes are string-literal type union, never numbers — any new failure mode is a one-line addition to `UnrecognizedReason`, not a widening of a magic constant."

requirements-completed: [IMPORT-02, IMPORT-05]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Path-only zip enumeration in its own module (src/lib/worker/zip-paths.ts); the only src/ fflate importer; never inflates."
    requirement: IMPORT-05
    verification:
      - kind: unit
        ref: "tests/unit/zip-paths.test.ts (7 tests pass: 12-name sample, backslash verbatim, /invalid zip data/ for empty / not-a-zip / truncated, no-throw on empty, 12 names on inflate-trap while full unzipSync throws)"
        status: pass
      - kind: automated
        ref: "grep -c unzipSync src/lib/worker/zip-paths.ts >= 1; grep -rlE \"from ['\\\"]fflate['\\\"]\" src equals src/lib/worker/zip-paths.ts; grep -q 'return false' src/lib/worker/zip-paths.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hardened classifier with normalizeEntryPath, isOsMetadataEntry, prepare(), detectRoot, categoryFoldersUnder, analyzeExport."
    requirement: IMPORT-02
    verification:
      - kind: unit
        ref: "tests/unit/classify.test.ts (31 tests pass: normalize cases, OS-metadata cases, detectRoot cases, sample / renamed-root / mac-rezipped / backslash / directory-entries / pure-path happy paths, every failure reason, classifyExport back-compat)"
        status: pass
      - kind: automated
        ref: "grep '^export' src/lib/worker/classify.ts includes analyzeExport, normalizeEntryPath, isOsMetadataEntry, detectRoot, categoryFoldersUnder, classifyExport; grep empty-archive + no-single-root + no-category-folders + no-recognized-category in src/lib/worker/classify.ts; ! grep -n localeCompare src/lib/worker/classify.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Worker threads the reasoned outcome: analyzeExport's ok:false branch throws `unrecognized export: <reason> (<n> entries)` inside the single try block; existing catch posts {type:'error',jobId,detail}. Names never cross the boundary."
    requirement: IMPORT-05
    verification:
      - kind: automated
        ref: "grep analyzeExport + listEntryPaths + 'unrecognized export: ' + 'type: 'ready'' src/lib/worker/ingest.worker.ts"
        status: pass
      - kind: automated
        ref: "git log --format=%h --grep='(01-03)' -- src/lib/types/worker-messages.ts equals '' (D-09 contract untouched)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Synthetic fixture matrix covering renamed root + unknown folder, macOS re-zip, backslash separators, directory entries, no-recognized-category, multi-root, single-file, files-only-under-root, empty, not-a-zip, truncated, and an inflate-trap whose first local entry's deflate window is corrupted; buildSampleExport keeps the exact 12 names 01-01's Playwright spec depends on."
    requirement: IMPORT-02
    verification:
      - kind: unit
        ref: "imports of buildRenamedRootExport, buildMacRezippedExport, buildBackslashExport, buildDirectoryEntriesExport, buildNoRecognizedCategoryZip, buildMultiRootZip, buildSingleFileZip, buildFilesOnlyUnderRootZip, buildEmptyZip, buildNotAZipBytes, buildTruncatedExport, buildInflateTrapExport succeed in tests/unit/zip-paths.test.ts + tests/unit/classify.test.ts"
        status: pass
      - kind: automated
        ref: "grep -c '^export' tests/fixtures/export-fixtures.ts >= 20; grep -q '!== 8' tests/fixtures/export-fixtures.ts (trap method check)"
        status: pass
      - kind: automated
        ref: "git ls-files -- '*.zip' is empty (fixture=synthetic)"
        status: pass
    human_judgment: false
  - id: D5
    description: "01-01's zero-network Playwright spec still passes (Account: 123456789 renders, no post-drop requests)."
    requirement: IMPORT-05
    verification:
      - kind: automated_ui
        ref: "tests/e2e/zero-network.spec.ts (2 / 2 passed: 'no network requests after initial load, including the worker script fetch' and 'served HTML carries the CSP meta tag with default-src and connect-src none')"
        status: pass
    human_judgment: false
  - id: D6
    description: "Playback of 01-01's behavior with renamed / mac-rezipped / backslash / empty-folder / corrupt zips at the running app — file input rendered through the App.svelte dropzone path."
    requirement: IMPORT-02
    verification:
      - kind: manual_procedural
        ref: "Real Wargaming export placed at tests/fixtures/private/ or outside repo (per 01-01 gate item 2 / fixtures/README.md privacy policy) — Phase 1 success-criterion 1 + 2 end-to-end human verification at end of phase."
        status: unknown
    human_judgment: true
    rationale: "The committed synthetic fixture already covers every shape the plan enumerates; the residual check is whether a real Wargaming export from a real account also lands on the success path. Privacy policy disallows committing the real sample, so this is a human-verify step, not an automated one."

# Metrics
duration: ~45min
completed: 2026-09-28
status: complete
---

# Phase 1 Plan 3: Harden Baseline Classifier — Summary

**Path-only enumeration is its own module; the classifier handles renamed roots, OS-metadata noise, backslash separators, and a named reason for every unrecognizable archive. The two empirical fflate facts (throws on corrupt; never inflates) are locked by passing tests.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-28T03:50Z
- **Completed:** 2026-09-28T04:25Z
- **Tasks:** 2 (zip-paths + classify)
- **Files modified:** 6 (3 src/, 3 tests/)

## Accomplishments

- **listEntryPaths** is the single src/ file that imports fflate. The 01-01 worker's inline unzipSync filter loop is gone; the safety-critical "filter returns false, never inflates" invariant is one literal grep away from any future code reviewer.
- **analyzeExport** returns a discriminated union with one of four named reasons when the archive is not recognizable enough to be a Wargaming export, and the worker routes that reason into its single error path with a name-free message ("unrecognized export: `<reason>` (`<n>` entries)").
- **Hardened** detectRoot (a lone top-level file is NOT a root), categoryFoldersUnder (directory entries register 0; files-directly-under-root are skipped), classifyExport (back-compat wrapper), plus new normalizeEntryPath + isOsMetadataEntry + internal prepare().
- **Fixture matrix** of 12 builders + 5 constants; buildSampleExport still produces the exact 12 names 01-01's Playwright spec depends on.
- **A2 + no-inflation** locked by `tests/unit/zip-paths.test.ts` (and the inflate-trap fixture proves it stays honest — it throws if the trap ever silently becomes a no-op).

## Task Commits

1. **Task 1a: Fixture matrix** - `d01c0fc` (chore)
2. **Task 1b: zip-paths RED probe** - `408bea2` (test)
3. **Task 1c: listEntryPaths GREEN** - `7edbb4e` (feat)
4. **Task 2a: classify RED probe** - `08b8395` (test)
5. **Task 2b: analyzeExport GREEN + worker route** - `43d2c32` (feat)
6. **prettier reformat** - `e7e8a2b` (style)
7. **doc reword** - `ce859f9` (style)

## Files Created/Modified

- `src/lib/worker/zip-paths.ts` (NEW) — `listEntryPaths(bytes)`. Filter returns false. Only src/ fflate importer.
- `src/lib/worker/classify.ts` (MODIFIED) — added `normalizeEntryPath`, `isOsMetadataEntry`, internal `prepare()`, `analyzeExport()` with `UnrecognizedReason` discriminated union; hardened `detectRoot`, `categoryFoldersUnder`; kept `classifyExport` as back-compat wrapper. Locale-independent sort.
- `src/lib/worker/ingest.worker.ts` (MODIFIED) — replaced inline unzipSync filter loop with `listEntryPaths`; replaced `classifyExport` null-check with `analyzeExport`; new error message `"unrecognized export: <reason> (<n> entries)"`. Single try block, single catch, same `'ready'` handshake.
- `tests/fixtures/export-fixtures.ts` (MODIFIED) — refactored sample into `sampleEntries(root)`; added 12 builders + 5 constants.
- `tests/unit/zip-paths.test.ts` (NEW) — 7 tests: 12 names from sample, backslash verbatim, /invalid zip data/ for empty/not-a-zip/truncated, no-throw for empty, 12 names on inflate-trap with full-unzipSync-throws control.
- `tests/unit/classify.test.ts` (NEW) — 31 tests covering normalizeEntryPath, isOsMetadataEntry, detectRoot, all happy-path fixtures, every failure reason, classifyExport back-compat.

## RED → GREEN Evidence

### Task 1 (zip-paths)

**RED — commit `408bea2`:**

`npx vitest run tests/unit/zip-paths.test.ts`:

```
 FAIL  tests/unit/zip-paths.test.ts [ tests/unit/zip-paths.test.ts ]
Error: Cannot find module '../../src/lib/worker/zip-paths.ts' imported from
  .../tests/unit/zip-paths.test.ts
Test Files  1 failed (1)
Tests  no tests
```

**GREEN — commit `7edbb4e`:**

`npx vitest run tests/unit/zip-paths.test.ts`:

```
 Test Files  1 passed (1)
 Tests  7 passed (7)
 Duration  97ms
```

### Task 2 (classify)

**RED — commit `08b8395`:**

`npx vitest run tests/unit/classify.test.ts`:

```
Test Files  1 failed (1)
Tests  27 failed | 4 passed (31)
```

(The 4 that passed were the unchanged 01-01 signatures: `detectRoot` already returned non-null for some inputs; the new behavior under OS-metadata + directory entries was still untested.)

**GREEN — commit `43d2c32`:**

`npx vitest run tests/unit/classify.test.ts`:

```
Test Files  1 passed (1)
Tests  31 passed (31)
Duration  108ms
```

## Observed fflate 0.8.3 Error Messages

All three corrupt-input fixtures throw `Error` with the literal message **"invalid zip data"**:

- `listEntryPaths(new Uint8Array(0))` → `Error: invalid zip data`
- `listEntryPaths(buildNotAZipBytes())` (`'This is not a zip file. It is plain text.'` UTF-8) → `Error: invalid zip data`
- `listEntryPaths(buildTruncatedExport())` (first 60% of `buildSampleExport()`) → `Error: invalid zip data`

This empirically confirms RESEARCH Assumption A2 and matches the planning-time scratch spike recorded in the plan's `<interfaces>` block.

The inflate-trap control (full `unzipSync` on the corrupted entry) throws a different message — `Error: invalid block type` — confirming the trap bytes really are corrupt and proving that `listEntryPaths`'s filter-only enumeration never reaches that failure point.

## Behavioral Change vs 01-01

- **Sample export**: identical. Counts, order, badge names — all unchanged. 01-01's Playwright spec still renders `Account: 123456789` correctly.
- **macOS-rezipped / backslash exports**: NEW. Previously these matched the sample's root + sub-folders verbatim, so `Bens` and similar OS metadata would have been counted as `unknown` entries. Now they normalize away.
- **All-unknown-root export (e.g. `holiday-photos/`)**: NEW — now produces the generic failure instead of the bogus `Account: holiday-photos` header (FA-01-03-2, success-criterion 2).
- **Empty zip / corrupt zip / multi-root zip / single-file zip / files-only-under-root zip**: NEW — each now produces a named reason (`empty-archive` / fflate-thrown `'invalid zip data'` / `no-single-root` / `no-single-root` / `no-category-folders`) on the same single error path.

## Decisions Made

- **FA-01-03-2 (planner divergence from research)**: Reject all-unknown-root zips (`no-recognized-category`). Research suggested accepting them; this plan rejects them so a non-Wargaming zip can never render as `Account: holiday-photos`. Reversible (one predicate in `analyzeExport`).
- **locale-independent ordering**: Plain JS less-than on `toLowerCase()`, then raw code-unit as the tie-break. No `localeCompare` anywhere in `classify.ts`. Node and the browser can disagree on locale tables; this guarantees identical badge order in worker and main-thread renders.

## Deviations from Plan

**1. [purely cosmetic]**

The plan's example recognition text in the spec lists `USER_INFO` (uppercase) for the `123/USER_INFO/a.csv` case. The hardened `isOsMetadataEntry` does not lowercase the full path (only the last segment). For `123/USER_INFO/Account_Info.csv` the last segment is `Account_Info.csv`, lowercased → `account_info.csv`, which is neither `.ds_store` etc. nor `__MACOSX`, so it correctly returns false. The pure-path test passes; no change needed.

**2. [auto-fix, acknowledged in commit]**

The plan's acceptance criterion `! grep -n 'localeCompare' src/lib/worker/classify.ts` initially tripped on a doc-comment that mentioned `localeCompare` by name. Reworded the comment to "no locale-aware string comparison" in commit `ce859f9`.

**Total deviations:** 2 (1 cosmetic no-op, 1 comment-reword). **Impact on plan:** none — every functional behavior matches the plan verbatim.

## Issues Encountered

- **pnpm not on $PATH** in the sub-agent shell (worktree-isolated agents don't inherit the orchestrator's env). Resolved by `npm install -g pnpm@12.6.0 --prefix /tmp/pnpm-global` and prefixing every `pnpm run` with `PATH="/tmp/pnpm-global/bin:$PATH"`. A `pnpm` link in `/opt/homebrew/bin/` is reserved for the user's interactive shell.
- **Port 4173 leftover** from an earlier playwright run — an `lsof -ti:4173 | xargs kill -9` between runs clears it.
- **`tsc -p tsconfig.node.json` exit-0 verification** is `echo "TSC=$?"` not the same call as `svelte-check`; both have to be run separately because `package.json`'s `check` script chains them with `&&`.

## Next Phase Readiness

- **Phase 2 (parsing + Dexie caching)**: ready. `listEntryPaths` is the safe entry point; `analyzeExport`'s `ClassifyResult` is the exact shape Phase 2 will need to fan out category-specific CSV parsers over.
- **Phase 3 (dashboard shell)**: ready. The badge list is already rendered (App.svelte from 01-01 uses the `ClassifyResult`); Phase 3's job is to replace the tracer with the real layout.
- **Phase 5 (CI / deploy)**: ready. The Playwright zero-network spec is untouched and still passes; CI's only new check needs to be `pnpm run test:unit` (currently 85 tests across 3 files).

---
*Phase: 1-Ingest Foundation & Zero-Network Guard*
*Plan: 03 of phase 01*
*Completed: 2026-09-28*
