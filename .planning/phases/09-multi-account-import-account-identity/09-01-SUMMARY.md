---
phase: 09-multi-account-import-account-identity
plan: 01
subsystem: worker-classifier
tags: [classifier, multi-account, fixtures, privacy, fail-closed]
requires: [phase-08-v1.0-ship]
provides:
  - "MAX_ACCOUNT_ROOTS (32) and MAX_ROOT_NAME_LENGTH (128) bounds in classify.ts (D-20)"
  - "resolveCsvFileOwner(rawName, roots, recognized) for per-file root attribution (D-06)"
  - "AccountRootAnalysis + AnalyzeOutcome.roots + ClassifyResult.accounts pre-parse contract"
  - "tests/fixtures/multi-account-fixtures.ts — 16 synthetic builders every later plan builds on"
affects: [09-02, 09-03, 09-04, 09-05, 09-06]
tech-stack:
  added: []
  patterns:
    - "one linear pass over prepared entries before any per-root counting (T-01-43 cost class)"
    - "Map/Set for every per-root structure — a root may be named __proto__ (T-09-04)"
    - "zero roots hand the archive back to the unchanged v1.0 reason chain"
key-files:
  created:
    - tests/fixtures/multi-account-fixtures.ts
  modified:
    - src/lib/worker/classify.ts
    - src/lib/core/types/worker-messages.ts
    - tests/unit/import/classify.test.ts
    - tests/fixtures/export-fixtures.ts
decisions:
  - "D-01 to D-06 implemented as planned: root = unknown-named top-level folder directly holding a recognised category"
  - "D-20 bounds applied to ONE root as well as several, on purpose (a bound restricted to several roots would let a 60 KB name through on a single root)"
  - "The transparent-wrapper shape that sits directly above recognised categories is handed back to the v1.0 chain (accountRoot ''), not read as N roots"
  - "Reason mapping for Task 2's fixes: stray → no-single-root, top-level category / case collision → ambiguous-root"
metrics:
  duration: 18m
  completed: 2026-10-16
  commits: 2
  plan_head_before: 2c4a224772117df34e6fe78c0c37635674ec2329
  plan_head_after: c664e07ca65310960e68a9c6fdccec3ca635f795
actuals:
  tokens: 22677
  tasks: 2
  commits: 2
status: complete
---

# Phase 9 Plan 01: Multi-account classification — Summary

One-liner: The classifier now accepts several account-ID folders in one archive (fail-closed, with a root cap and a name bound), every CSV entry resolves to its own root, and the whole phase shares one set of synthetic multi-account fixtures.

## What was built

**`src/lib/worker/classify.ts`**

- `resolveAccountRoots(prepared)` runs FIRST in `analyzeExport` and makes ONE linear pass:
  it records each top-level folder's direct child folder names, descends one level through
  Wargaming's transparent `personal_data_export/` wrapper when that wrapper is the only
  top-level name, and classifies each candidate as an account root (unknown name + at least
  one recognised child folder, D-01) or not.
- With **zero** roots it returns `null`, so the entire v1.0 chain (rootless read, wrapper
  retry, `empty-archive` / `no-single-root` / `no-category-folders` / `no-recognized-category`
  / `ambiguous-root` / `no-csv-data`) runs untouched.
- With **at least one** root it applies, before any per-root counting: `too-many-roots`
  above 32 roots, `root-name-too-long` above 128 characters, `ambiguous-root` for a
  recognised category at the candidate level (D-04) or a case-insensitive root-name
  collision (T-09-03), and `no-single-root` for any other stray folder (D-02).
- Loose top-level FILES are skipped entirely (D-05) — never a candidate, never counted
  toward the stray rule, never resolved to a category.
- Every per-root structure is a `Map` or a `Set`, so a root literally named `__proto__` or
  `constructor` cannot collide with `Object.prototype` (T-09-04).
- `resolveCsvFileOwner(name, roots, recognized)` returns `{ root, category, sourceFile }`.
  For a one-member root set it DELEGATES to the untouched `resolveCsvFileCategory`, so the
  two can never disagree; for two or more it uses a strict owner rule with the rightmost-root
  fallback switched OFF (D-06).
- `resolveCsvFileCategory`, `detectRoot`, `categoryFoldersUnder`, `foldersAt`,
  `unknownFolderHoldsRecognized`, `classifyExport` and `sortCategoryEntries` keep their
  exact signatures and behaviour.

**`src/lib/core/types/worker-messages.ts`**: `AccountSummary { root, identity, games,
firstYear, lastYear }` and the optional `ClassifyResult.accounts`, documented as pre-parse at
classify time (code-unit order) and D-16-ordered after the worker parses — years cannot exist
before that.

**`tests/fixtures/multi-account-fixtures.ts`** (new, 16 builders): the real-shape
three-account archive with its two loose Readme PDFs and directory entries, one- and two-root
archives, the `personal_data_export`-wrapped pair (with and without a loose file), the
stray-folder, top-level-category, duplicate-nickname, tied-years, no-activity,
case-collision, many-roots, long-root-name, hostile-root-name, case-variant-User_Info and
long-text shapes. Every value is synthetic: made-up numeric ids, `*.example.invalid` e-mail
domains, RFC 5737 addresses. Each root carries its OWN canaries (login, birth date, ragged
overflow cell), and RU's sits in a User_Info-shaped file misfiled under `Activity_History`,
because the real sample's RU account has no `User_Info` folder at all.

## Verification

- `pnpm exec vitest run tests/unit/import/classify.test.ts tests/unit/guards/sample-export-shape.test.ts` → 129 passed.
- `pnpm run test:unit` → **2939 passed, 91 files, 0 failed** (before this plan: 2902 passed with 5 failing multi-root assertions, all now flipped).
- `pnpm run check` → 0 errors, 0 warnings (311 files). `pnpm run lint` → clean.
- `git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml` → no dependency added.
- Matrix sizes: accept 14, reject 14, agreement 4, tracer 6. `grep -c buildMultiRootZip`
  is unchanged at 7 and no use of it asserts a failure any more.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A folder under `personal_data_export/` holding only loose files was invisible as a candidate**
- **Found during:** Task 2, reject matrix (D-02 under the wrapper).
- **Issue:** the resolver seeded a candidate only when a candidate folder had a file
  *beneath a category folder*, so `personal_data_export/Misc/x.csv` beside a root was not
  seen at all and the archive classified `ok` with one root — a stray folder silently
  accepted through the wrapper door, which is the fail-closed gate (T-09-01).
- **Fix:** every second segment under the wrapper is now seeded as a candidate, exactly as
  every first segment already was. The stray rule then fires as it does at the top level.
- **Files modified:** `src/lib/worker/classify.ts`
- **Commit:** c664e07

**2. [Rule 3 - Blocking] Two type errors from reusing `hasRecognizedCategory` for a `Set`**
- **Found during:** Task 1, `pnpm run check`.
- **Issue:** `hasRecognizedCategory(counts: Map<string, number>)` and a copy of it were
  typed for the v1.0 map. The N-root resolver holds child-folder `Set`s.
- **Fix:** added the private `holdsRecognizedFolder(names: ReadonlySet<string>)` instead of
  changing the existing map-shaped helper, so the v1.0 code path is untouched.
- **Files modified:** `src/lib/worker/classify.ts`
- **Commit:** a1faf88

### Planner-choice clarifications (no code change)

- **The wrapper directly above recognised categories** (`personal_data_export/Activity_history/foo.csv`,
  with or without account folders beside it) is handed back to the v1.0 chain rather than read
  as N roots. Reading it as "N roots" would report a wrapper child as an account id and break
  the pinned CR-01 assertions (`accountRoot: ''`, and `ambiguous-root` when an unknown folder
  beside it holds a `User_Info`). The pinned tests demanded it.
- **`MA_EXPECTED_SESSION_COUNT` derivation.** The plan's prose listed RU's per-file split as
  `1+1+1+2` while also saying RU's WOT file holds "2012 and 2021 rows". The pinned TOTAL (13)
  is what later plans assert, so the fixture keeps both stated facts — RU's WOT holds 2 rows,
  the other three hold 1 each — and the comment beside the constant states the real per-file
  split (RU 2+1+1+1 = 5, EU 2+1+2 = 5, NA 2+1 = 3).
- **The tracer has six tests, not five.** The five the plan describes, plus one asserting the
  real-shape archive really does carry the loose PDFs (otherwise D-05 could pass vacuously).

### Workflow step deliberately not taken

**`requirements.mark-complete ACCOUNT-01 ACCOUNT-02 ACCOUNT-08` was reverted.** The plan's
frontmatter names those three, and the workflow says to mark them, but 09-01 delivers only the
CLASSIFICATION half of ACCOUNT-01 (the worker still ignores `accounts`, so a multi-account
archive classifies and then imports as one account until 09-02), none of ACCOUNT-02's
per-account parsing, and the fixture half of ACCOUNT-08 only. Marking them complete would hand
the verifier a claim this plan does not support, so the checkboxes stay pending until the plans
that finish them (09-02, 09-03, 09-06) run.

## Out-of-scope finding

`tests/unit/import/classify.test.ts` contains the folder name `1234567` in v1.0-era
wrapper-fallback tests — one of the three account ids in the user's real export, so phase 9's
prohibition on real account numbers now reads against it. It pre-dates this plan, is pinned by
v1.0 assertions this plan was told to keep, and is recorded in
`deferred-items.md` rather than silently rewritten. The new fixture module is clean.

## Known Stubs

None. Every exported builder produces a complete archive, and every symbol the plan's
`must_haves.artifacts` list names exists: `MAX_ACCOUNT_ROOTS`, `MAX_ROOT_NAME_LENGTH`,
`resolveCsvFileOwner`, `AccountRootAnalysis`, `AccountSummary`, and all sixteen
`build*` fixture functions (plus the two reversible variants of the stray and long-root-name
builders).

## Threat Flags

None new. The plan's register T-09-01 to T-09-05 and T-09-SC is implemented and tested:
stray folders, top-level recognised categories, an arbitrary wrapper, case collisions,
hostile root names, the 32-root cap, the 128-character bound, loose files, and the
3,000-folder cost guard (`too-many-roots` and `no-single-root`, each under a two-second
wall-clock assertion so a per-candidate re-scan would fail).

## Self-Check: PASSED

- `tests/fixtures/multi-account-fixtures.ts`, `src/lib/worker/classify.ts`,
  `src/lib/core/types/worker-messages.ts`, `tests/unit/import/classify.test.ts` — all present.
- Commits a1faf88 and c664e07 are ancestors of HEAD.
- `commits: 2` measured from the persisted `gsd-plan-head-before-09-01` ledger
  (`2c4a224..c664e07`), not narrated.