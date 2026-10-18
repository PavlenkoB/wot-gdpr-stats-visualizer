---
phase: 09-multi-account-import-account-identity
plan: 02
subsystem: ingest-worker
tags: [multi-account, worker, per-account-identity, privacy, d18, replay]
requires: [09-01]
provides:
  - "src/lib/worker/account-summary.ts — summarizeSessionSources (D-14, D-15), compareAccounts / sortAccounts (D-16), toAccountSummary and accountsOfMeta (D-08, D-22)"
  - "DatasetRow.account, DatasetFile.account, AccountMeta, DatasetMeta.accounts and writeDataset's ninth parameter, all non-indexed; Dexie stays at version 2"
  - "ingest.worker.ts resolves every inflated entry ONCE, groups by category, keeps per-root state in Maps, stamps every row with its owning root (D-07)"
  - "D-18: rows of unknown and known-deferred categories are parsed for counts and never stored"
  - "tests/unit/import/account-summary.test.ts (17 tests) and tests/unit/import/multi-account-import.test.ts (23 tests)"
affects: [09-03, 09-04, 09-05, 09-06, 10]
tech-stack:
  added: []
  patterns:
    - "every inflated entry resolved once, then grouped by category — the inflate filter and the counts read one resolution (D-06)"
    - "per-root state behind a Map keyed by the root name; never a plain object (T-09-04)"
    - "rowIndex restarts per account AND category, so (sourceFile, rowIndex) is not a key (D-12)"
    - "MAX_PRESENCE_FILES applied per account, so one noisy root cannot starve a sibling's facts (T-09-09)"
    - "accountsOfMeta is the ONE normaliser behind done, duplicate and cache-status (D-08, D-22)"
key-files:
  created:
    - src/lib/worker/account-summary.ts
    - tests/unit/import/account-summary.test.ts
    - tests/unit/import/multi-account-import.test.ts
  modified:
    - src/lib/worker/ingest.worker.ts
    - src/lib/worker/db.ts
    - tests/fixtures/export-fixtures.ts
    - tests/unit/import/ingest-worker.test.ts
    - tests/e2e/import/import-failure.spec.ts
requirements-completed: [ACCOUNT-02, ACCOUNT-03, ACCOUNT-05, ACCOUNT-08]
decisions:
  - "The D-18 skip is decided from the CATEGORY STATUS, not from the file's folder name, so the classifier's answer is the single thing both the counts and the skip read"
  - "The Account record is built ONLY for a one-account dataset (null for two or more), so the login pane can never present one account as the whole (UI-SPEC Surface 4)"
  - "accountsOfMeta computes NOTHING for a v1.0 cache: games empty, years null (D-22), because a one-account dataset renders exactly as v1.0 with no games and no activity years"
  - "MALFORMED_BANS_CSV is exported so the Bans per-row assertions can call parseCsvFile on the SAME bytes the archive carries, rather than re-typing the fixture in the test"
coverage:
  - deliverable: "Three-account zip imports through the worker with per-row account stamps, per-root identity and an ordered account list"
    kind: unit-test
    ref: "tests/unit/import/multi-account-import.test.ts#Phase 9 tracer: the worker imports every account"
    status: pass
    human_judgment: false
  - deliverable: "Replay (check-cache and duplicate) equals the import's published accounts"
    kind: unit-test
    ref: "tests/unit/import/multi-account-import.test.ts#replays through check-cache and duplicate exactly as the import published it"
    status: pass
    human_judgment: false
  - deliverable: "Per-account games, activity years and the D-16 order"
    kind: unit-test
    ref: "tests/unit/import/account-summary.test.ts"
    status: pass
    human_judgment: false
  - deliverable: "No unsupported-category cell and no sensitive column of any root reaches IndexedDB, while the counts survive"
    kind: unit-test
    ref: "tests/unit/import/multi-account-import.test.ts#Phase 9 privacy"
    status: pass
    human_judgment: false
  - deliverable: "Adjacency, empty, ordering, hostile-name, presence-cap and rootless shapes on the import path"
    kind: unit-test
    ref: "tests/unit/import/multi-account-import.test.ts#Phase 9 edge matrix"
    status: pass
    human_judgment: false
  - deliverable: "The browser banner still covers the fail-closed shapes (photos zip, stray folder, top-level category)"
    kind: e2e-test
    ref: "tests/e2e/import/import-failure.spec.ts#(d) a photos zip, a stray folder beside roots and a top-level category beside roots each show the banner"
    status: pass
    human_judgment: false
metrics:
  duration: 41m
  completed: 2026-10-17
  commits: 3
  plan_head_before: c925eb2a9aa2fa1e578215be1d53635e8d759366
  plan_head_after: ba8251823a324c3a82b225f19ae15611b60bed2e
actuals:
  tokens: 88681
  tasks: 3
  commits: 3
status: complete
---

# Phase 9 Plan 02: Multi-account import — Summary

One-liner: The ingest worker now parses each account root on its own, stamps every stored row with its owning account, publishes one D-16-ordered account list that replays identically, and stores no row of an unsupported category.

## What was built

**`src/lib/worker/account-summary.ts`** (new, pure — no worker globals, `import type` only
from `db.ts`). Five functions, each one Phase 9 decision:

- `summarizeSessionSources(sources)` → `{ games, firstYear, lastYear }`. Games are the
  tokens of sources holding **at least one row** (a header-only `WOWS_Game_Sessions.csv`
  contributes nothing, which is what the NA fixture's third line pins), upper-cased and
  code-unit sorted. Years are the min and max of the **start** cell of every row whose start
  parses, resolved **per source** through `resolveSessionColumns` (each file has its own
  header), converted with `civilFromDays` and never `Date`. A legacy no-game source
  contributes years and no game; an empty source contributes neither.
- `compareAccounts` / `sortAccounts` — D-16: first activity year ascending, no-activity
  accounts after all others, ties broken by root in **plain code-unit** order
  (`'1000000003' < '2000002' < '500000001'`, which is neither the numeric nor a locale
  order). `sortAccounts` returns a new array.
- `toAccountSummary(meta)` — root, identity, games, years and nothing else.
- `accountsOfMeta(meta)` — the stored list when it is non-empty, otherwise a one-entry list
  built from the legacy fields with empty `games` and `null` years (D-22: a v1.0 cache is one
  account and renders exactly as v1.0, so nothing would read them).

**`src/lib/worker/db.ts`**. `DatasetRow.account` and `DatasetFile.account` (the owning root,
**non-indexed**, absent on rows a v1.0 build wrote), `export interface AccountMeta`,
`DatasetMeta.accounts?: AccountMeta[] | null`, and a ninth optional `writeDataset` parameter
written in the same `meta.put` inside the same transaction. `MAX_PRESENCE_FILES` stays 500
with its doc comment rewritten to say the cap is **per account** since Phase 9. The
`stores` definition, the `version(2)` upgrader and every other schema line are byte-identical.

**`src/lib/worker/ingest.worker.ts`**. `resolveCsvFileOwner(name, rootNames, recognized)`
replaces `resolveCsvFileCategory` in the inflate filter, and every inflated entry is resolved
**exactly once** into a `Map<category, OwnedFile[]>` the category loop then reads — so the
filter and the per-category counts are two consumers of one resolution and cannot disagree
(D-06). Per-root state (`RootState`: the two sanitised identity pools, presence facts,
session sources, per-category counts) lives in a `Map` keyed by the root, never a plain
object, so a root named `__proto__` cannot collide with `Object.prototype` (T-09-04). Inside
the file loop every pushed row carries `account: resolved.root` and a `rowIndex` taken from
**that root's** running count for that category; session sources go to the global aggregate
(D-09, unchanged) **and** to the owning root's own list (D-14/D-15); presence facts are
pushed to the owning root's capped list. After the loop each root gets its own identity
(its own pool only — an account with no `User_Info` never inherits a sibling's nickname,
D-17), its own `AccountMeta` with its own counts, and its games/years. `sortAccounts` puts
the list in D-16 order; `writeDataset` stores it, and `resultFromMeta` publishes it through
`accountsOfMeta`, so `done`, `duplicate` and `cache-status` share one builder.

**D-18 (Task 2)**. `const storeRows = entry.status === 'supported'` short-circuits the
per-row loop: an unknown or known-deferred category's rows are neither sanitised nor pushed,
while `rowCount` and `skippedRowCount` still accumulate from the parse result. The
header-keyed strip, `hasSensitiveColumn`, `sanitizeUserInfoRow` and the Assistant blob
reduction are untouched.

## Verification

- `pnpm exec vitest run tests/unit/import/multi-account-import.test.ts tests/unit/import/account-summary.test.ts tests/unit/import/db.test.ts` → 50 passed at the Task 1 commit; **23 passed** in the tracer file and **17** in the pure file after Task 3.
- `pnpm run test:unit` → **2979 passed, 93 files, 0 failed** (before this plan: 2939).
- `pnpm run check` → 312 files, 0 errors, 0 warnings. `pnpm run lint` → clean.
- `pnpm exec playwright test tests/e2e/import/import-failure.spec.ts` → **10 passed**; `--list` prints **the same count as before** (10 in 1 file).
- `git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml` → 0. `git diff --quiet b4e7f31 -- src/lib/import` → 0.
- `db.verno` is asserted to be 2 by the tracer and by `tests/unit/import/db.test.ts`.
- Matrix sizes: tracer 7, privacy 8, edge matrix 8 (plan floor: 6 and 8).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `finalResult.accountRoot` was the classifier's code-unit-first root, not the D-16 first account**
- **Found during:** Task 1, the tracer's "posts done with the accounts in D-16 order".
- **Issue:** `finalResult` spread `...outcome.result` and overrode `categories`, `importedAt`
  and `identity` but not `accountRoot`, so the legacy single-account field named whichever
  root sorted first by code unit (`1000000003`) while the legacy `identity` named the D-16
  first account's. A v1.0 reader would have seen a nickname and an account ID from two
  different accounts.
- **Fix:** `accountRoot: primary?.root ?? ''` alongside `identity`, both from the first
  account in D-16 order.
- **Files modified:** `src/lib/worker/ingest.worker.ts`
- **Commit:** 34055ca

**2. [Rule 1 - Bug] The plan's adjacency assertion ("the first row of `WOT_Game_Sessions.csv` has the same `rowIndex` in every account") is false for the real-shape fixture**
- **Found during:** Task 1, then again in Task 3.
- **Issue:** `rowIndex` restarts per **account and category**, not per file. In the
  real-shape archive the NA root's `Activity_History` folder lists `WOTB_Game_Sessions.csv`
  before `WOT_Game_Sessions.csv`, so NA's WOT rows carry index 2 while RU's and EU's carry
  0 and 1. The plan's sentence only holds for a root whose copy happens to be its first
  file, so the fixture cannot demonstrate it.
- **Fix:** the test asserts the property that actually holds and that D-12 is about — each
  account's indexes for one category form a contiguous run from 0 (the counter restarts),
  and at least one `(sourceFile, rowIndex)` pair belongs to **more than one** account, so
  nothing may key on that pair alone. Every account's rows are present.
- **Files modified:** `tests/unit/import/multi-account-import.test.ts`
- **Commit:** 34055ca (restated in ba82518)

### Planner-choice clarifications (no code change)

- **`buildRootlessExport` lives in `export-fixtures.ts`, not `multi-account-fixtures.ts`.**
  The plan's Task 3 names it as if the latter; it is the pre-existing v1.0 fixture and was
  reused rather than duplicated. Importing it from where it actually lives is the only
  change.
- **The 02-06 W-1 `withheld` loop does not fail without D-18**, and that is correct rather
  than vacuous: those two headers are withheld by the 02-05 rule, so the supported
  `User_Info` copy stored zero rows before Phase 9 too. The rewrite therefore ADDED the
  `User_Info` assertions (rowCount 0, skipped 8, zero stored) so the test now pins the
  withhold in a file that IS supported — the one place the withhold is the only possible
  reason.
- **`MALFORMED_BANS_CSV` is now exported from `export-fixtures.ts`.** The plan moved the
  Bans per-row assertions to "a direct `parseCsvFile('Bans', 'Bans.csv', text)` on the same
  text", but `buildMalformedRowsExport` built that text inline. Re-typing four records in
  the test would be a second copy of the fixture that could drift; exporting the constant
  makes the builder and the assertion read one string.

### TDD evidence

RED was demonstrated twice, both times by an actual failing run:

1. **Task 1** — 17 of 21 tests failed before the implementation (the pure file failed on a
   missing module; the worker file failed on `accounts`, `account` stamps and per-root
   counts).
2. **Task 2** — the D-18 guard was temporarily set to `const storeRows = true` and the two
   files re-run: **13 named tests failed** — the three Phase 9 privacy tests, 01-13 (a),
   (b) and (c), the CR-03 misfiled-copy test, the Bans CR-01/CR-02 test, all three W-1
   `stripped` cases and both W-2 cases — and passed again with the guard restored. The two
   `withheld` cases did not fail, which is the point noted above.

## Out-of-scope finding

`buildMultiRootZip` in `tests/fixtures/export-fixtures.ts` is no longer used by the e2e
suite (its test (d) now drops the two shapes that still fail closed) but it is still used by
seven assertions in `tests/unit/import/classify.test.ts`, so the builder is not dead. The
e2e test count is unchanged at 10 in this file and 256 across the suite, so D-23's ceiling is
untouched.

## Known Stubs

None. Every symbol the plan's `must_haves.artifacts` list names exists and is exported:
`summarizeSessionSources`, `compareAccounts`, `sortAccounts`, `toAccountSummary`,
`accountsOfMeta`, `AccountMeta`, `DatasetRow.account`, `DatasetFile.account`,
`DatasetMeta.accounts`, `writeDataset`'s ninth parameter, `resolveCsvFileOwner` in
`ingest.worker.ts`, and both new test files.

## Threat Flags

None new. The plan's T-09-06 to T-09-11 and T-09-SC are implemented and tested: the
root-agnostic header-keyed choke point (per-root login / birth-date / overflow canaries
scanned over the whole dump, including RU's misfiled copy under a root that has no
`User_Info`), D-18 (forum email, forum IP and chat canaries absent while the counts remain;
every stored row asserted `supported`), per-root identity pools (RU's identity stays `null`),
the per-account presence cap (501-file test), the single-transaction write with `accounts`
riding the same `meta.put`, no new logging, and no dependency added.

## Self-Check: PASSED

- `src/lib/worker/account-summary.ts`, `tests/unit/import/account-summary.test.ts`,
  `tests/unit/import/multi-account-import.test.ts` — all present.
- Commits 34055ca, 8499650 and ba82518 are ancestors of HEAD.
- `commits: 3` measured from the persisted `gsd-plan-head-before-09-02` ledger
  (`c925eb2..ba82518`), not narrated.