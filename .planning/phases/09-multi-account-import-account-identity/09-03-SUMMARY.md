---
phase: 09-multi-account-import-account-identity
plan: 03
subsystem: worker-readers
tags: [multi-account, worker, rebuild, lifecycle, privacy, d21, purge]
requires:
  - phase: 09-02
    provides: "row.account stamps, DatasetMeta.accounts, D-18 (no unsupported-category row is stored)"
provides:
  - "AccountSessionSource / AccountLoginSource — readSessionRowData and readLoginRowData return one source per ACCOUNT, category and file, each carrying its owning root (D-07, D-12, RESEARCH Pitfall 3)"
  - "The login Account-record pool is empty for two or more accounts and scoped to the one account otherwise, matching the import's ordered.length === 1 rule"
  - "purgeUnsupportedCategoryRows() — one index delete per unsupported category key in a rows-only transaction (D-21), called by handleCheckCache BEFORE checkCache"
  - "tests/unit/import/multi-account-lifecycle.test.ts (36 tests) — rebuild equality, the reader audit, the one-dataset lifecycle matrix and the D-21 purge at the worker level"
  - "tests/unit/import/db.test.ts — account/accounts round-trip, clearData across accounts, and the purge's casing, stamp-independence, meta-untouched and idempotence matrix"
  - "tests/unit/import/replay-reclassify.test.ts — a two-root duplicate / cache-status twin whose stale-status cases stay unedited"
affects: [09-06, 10]
tech-stack:
  added: []
  patterns:
    - "readers group by account → category → file, each level a Map; never a joined string, never a plain object (a root may be named __proto__, T-09-04)"
    - "the purge decides on the ROW's own category through the current classifier, never on meta.categories[].status, which is a stale cache of a classification by design"
    - "a transaction scoped to the rows store ALONE, so meta's rowCounts and skippedRowCounts survive and the 'Not yet supported' banners keep their numbers"
key-files:
  created: []
  modified:
    - src/lib/worker/db.ts
    - src/lib/worker/ingest.worker.ts
    - tests/unit/import/multi-account-lifecycle.test.ts
    - tests/unit/import/db.test.ts
    - tests/unit/import/replay-reclassify.test.ts
key-decisions:
  - "The ACCOUNT is the outermost level of the rebuild readers' grouping, because each source resolves its columns from its OWN first row — without it the NA root's alias-header WOT file costs a session and the rebuild disagrees with the import"
  - "The Account-record pool is counted by meta.accounts?.length ?? 1, so a v1.0 cache (no accounts field) is exactly one account by D-22 rather than a branch the reader has to take"
  - "D-21 is a delete function called from the check-cache path, NOT a Dexie version bump: a bump would cost every returning user their whole correct cached dataset to delete a subset of it"
  - "The purge opens db.rows and nothing else, so the meta record is byte-identical afterwards — the same banner counts a post-D-18 import and a post-purge v1.0 load show"
  - "readRowsByFile stays MERGED by design (D-11): its doc comment now names the two observable consequences (duplicate battle-type summary rows, OR-folded presence) as correct rather than leaving them to be rediscovered as bugs"
requirements-completed: [ACCOUNT-03, ACCOUNT-08]
coverage:
  - id: D1
    description: "A deleted playtime or logins aggregate is rebuilt on a multi-account dataset to values deep-equal to the import, including the NA root's WOT file whose header differs from the other roots'"
    requirement: ACCOUNT-03
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-lifecycle.test.ts#Phase 9 lifecycle: rebuild equals import"
        status: pass
        human_judgment: false
  - id: D2
    description: "The login Account record exists only for a one-account dataset, and the one-account pool ignores a row stamped with another root"
    requirement: ACCOUNT-03
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-lifecycle.test.ts#Phase 9 lifecycle: readers and the Account record"
        status: pass
        human_judgment: false
  - id: D3
    description: "Every merging channel (vehicles, battle types, finance, payments, device info) answers over all accounts' rows; an absent title stays absent; repeated presence facts fold to the same state"
    requirement: ACCOUNT-03
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-lifecycle.test.ts#Phase 9 lifecycle: readers and the Account record"
        status: pass
        human_judgment: false
  - id: D4
    description: "Reload, hash-dedupe, replace, clear, an empty database and an interrupted write all behave for one, two and three accounts on fake IndexedDB"
    requirement: ACCOUNT-08
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-lifecycle.test.ts#Phase 9 lifecycle: one dataset through reload, duplicate, replace and clear"
        status: pass
        human_judgment: false
  - id: D5
    description: "A v1.0-shaped cache replays as one account through the legacy fields, and both lazy queries answer without a wipe"
    requirement: ACCOUNT-03
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-lifecycle.test.ts#replays a v1.0-shaped cache as ONE account through the legacy fields"
        status: pass
        human_judgment: false
  - id: D6
    description: "A returning v1.0 cache holds no row of an unknown or known-deferred category after it is loaded; the forum EMAIL/IP and chat canaries are gone from a whole-dump scan while supported rows and meta are untouched"
    requirement: ACCOUNT-03
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-lifecycle.test.ts#Phase 9 lifecycle: a returning v1.0 cache is purged on load (D-21)"
        status: pass
        human_judgment: false
  - id: D7
    description: "The purge's own matrix: every supported casing survives, every unsupported spelling goes, rows are judged by category alone, meta deep-equals its earlier value, a second call returns 0, and an empty database is a no-op"
    requirement: ACCOUNT-03
    verification:
      - kind: unit
        ref: "tests/unit/import/db.test.ts#09-03 — purgeUnsupportedCategoryRows (D-21)"
        status: pass
        human_judgment: false
  - id: D8
    description: "The database name, the store definitions and the version-two upgrader are unchanged: db.verno is still 2 and no account was added to package.json"
    requirement: ACCOUNT-03
    verification:
      - kind: unit
        ref: "tests/unit/import/db.test.ts#09-03 — account and accounts round-trip with NO version bump (D-07, D-08)"
        status: pass
        human_judgment: false
actuals:
  tokens: 74000
  tasks: 3
  commits: 3
metrics:
  duration: 62m
  completed: 2026-10-17
  commits: 3
  plan_head_before: 86caaf85c08efa15ddf2b54738fe237d3bcb7f7e
  plan_head_after: d0d8b425f01bc113b3fc20d04791fa17c4d5f8e2
status: complete
---

# Phase 9 Plan 03: Account-aware readers, the one-dataset lifecycle, and the D-21 purge

One-liner: Every reader of stored rows groups by account, so a deleted aggregate rebuilds identical to the import across three accounts; reload, dedupe, replace, clear and an interrupted write are pinned for one, two and three accounts; and a returning v1.0 cache is purged of its unsupported-category rows on load without losing a supported row or touching meta.

## What was built

**`src/lib/worker/db.ts`.** `export interface AccountSessionSource extends SessionSource` and
`AccountLoginSource extends LoginSource`, each adding `readonly account`. `readSessionRowData` and
`readLoginRowData` now group rows per **ACCOUNT → category → file**, each level a `Map` (never a
joined string, never a plain object — a root may be named `__proto__`, T-09-04), flattening in
first-seen order. The account of a row is `row.account ?? meta.accountRoot`, stated once in a private
`accountOf` and documented as the whole of the account-or-legacy rule. Only the grouping changed: the
one-read-transaction rule, the `orderBy().uniqueKeys()` index walk, the one single-key read per
candidate file and the no-multi-key-query rule are exactly what they were, and `PLAYTIME_VERSION`, the
logins version and both aggregators are untouched.

The **Account-record pool** is now counted (`meta.accounts?.length ?? 1`): two or more accounts yield
an empty pool, and one account takes `meta.accounts?.[0]?.root ?? meta.accountRoot` and keeps only
User_Info rows whose own account equals it, keeping the existing Account_Info-over-fallback
preference. The returned `accountRoot` is unchanged.

`purgeUnsupportedCategoryRows()` (D-21) walks `db.rows.orderBy('category').uniqueKeys()` inside one
`db.transaction('rw', db.rows, …)` — the rows store alone — and issues one single-key `equals().delete()`
per key `classifyFolder` does not call `supported`, summing the returned counts.

**`src/lib/worker/ingest.worker.ts`.** One added call: `await purgeUnsupportedCategoryRows()` as the
first statement of the try in `handleCheckCache`, before `checkCache()`, so `cache-status` describes a
dataset whose rows are already clean. It has no catch of its own — a failed purge routes to the
worker's single error channel rather than reporting a clean load while the rows remain. The two data
callers needed no edit: an empty pool already yields a null Account record.

**`readRowsByFile`'s doc comment** now records that merging every account's rows of a file is BY DESIGN
for Phase 9 (D-11), why the session/login readers differ, and the two consequences that will otherwise
be rediscovered as bugs: a code repeated by two accounts yields two summary rows, and presence is an OR
fold so three roots cannot flip a title's state.

## Verification

- `pnpm run test:unit` → **3109 passed, 96 files, 0 failed** (this plan added 36 lifecycle tests and 11
  db tests; before the plan: 2979).
- `pnpm run check` → 313 files, 0 errors, 0 warnings. `pnpm run lint` → clean.
- Task 1 verify (5 files) 56 passed; Task 2 verify (4 files) 46 passed; Task 3 verify (3 files) 86 passed.
- `grep -c "AccountSessionSource\|AccountLoginSource" src/lib/worker/db.ts` → 7 (floor 4).
- `grep -c "accounts?.length" src/lib/worker/db.ts` → 1. `grep -c "purgeUnsupportedCategoryRows"
  src/lib/worker/ingest.worker.ts` → 2 (floor 2); in `db.ts` → 1.
- `grep -c "\.version(" src/lib/worker/db.ts` → **1, unchanged**. `db.verno` → 2.
- `git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml` → 0 (T-09-SC).
  `git diff --quiet b4e7f31 -- src/lib/import` → 0.
  `git diff --quiet b4e7f31 -- src/lib/features/playtime src/lib/features/logins` → 0 — the
  aggregators and their versions are byte-identical, which is what makes the rebuild-equals-import
  equality a real check rather than a widened contract.
- `pnpm exec vitest run tests/unit/import/replay-reclassify.test.ts` → passes with its stale-status
  tests **unedited**; only two new two-root cases were added.
- Grepped `tests/unit` for any other test that seeds an unsupported-category row and then sends
  check-cache: none exist after 09-02's D-18 rewrites, and the only hit is this plan's own file.
- Matrix sizes: rebuild-equals-import 4; readers/Account-record 7 (floor 6); lifecycle 12 (4 flows ×
  3 account counts) + 4 shared cases + 1 v1.0 legacy cache = 17; worker purge describe 7 (floor 5);
  db purge describe 7 (floor 5).

## TDD evidence

RED was demonstrated by actual failing runs, twice.

1. **Task 1** — all 4 tracer tests failed before the implementation. The teeth were exact: the rebuilt
   all-sessions slice carried `sessions: 12, excluded: 1` instead of 13/0, because the NA root's
   alias-header row was excluded after its file was merged into one source; and the logins view carried
   an Account record the import had not stored.
2. **Task 3** — the purge cases failed on rows still being present after a `check-cache`, not on a
   missing export: `expected [] to deeply equal [...]` for the three accounts' WOT sources, and the
   seeded forum/chat canaries still in the dump.

The intermediate failures that were **my** test bugs, not the code's, are recorded below (items 4 and 5)
— the corrections went into the tests, never into the implementation.

## Deviations from Plan

### Planner-choice clarifications (no code change)

**1. The plan's Task 3 acceptance criteria contradict each other on `db.verno`.** The behaviour block
requires the new `purgeUnsupportedCategoryRows` describe to assert `db.verno` is 2; the criteria say
`grep -c "verno" tests/unit/import/db.test.ts` must be *unchanged* from before the plan (2 → 4 with
those additions). Both cannot hold. I kept the assertions, because the plan's own `must_haves` require
`db.verno` to stay pinned and dropping them would weaken the check — a later phase adding `version(3)`
should fail loudly here.

**2. The plan's replace-case assertion is self-defeating for the three-account shape.** It reads "the
removed root has zero stored rows", but the replacement archive the plan supplies
(`buildRealShapeThreeAccountExport({ reversed: true })`) holds the *same three roots*, so nothing is
removed. Restated as the plan's own next clause — "the row count equals the new zip's" — by comparing
the post-replace store against a **baseline**: the replacement imported into an empty database first,
recording its row count, its account list and every row's owner. A replace that merely added the new
rows would leave a larger table and fail.

**3. Task 2's pool-scoping implementation landed in Task 1's commit.** The plan assigns it to Task 2,
but Task 1's own login rebuild-equality test cannot pass without it: the import builds the Account
record only when `ordered.length === 1`, so a rebuild that pooled every account's rows would ADD a
record the import never stored — the exact quiet disagreement Task 1 exists to prevent. I implemented
it in Task 1 rather than leave Task 1 red, and Task 2's commit carries its tests and the
`readRowsByFile` doc.

### Auto-fixed Issues

**4. [Rule 1 - Bug] A test asserted `allBattlesOnly` for the Blitz title.**
- **Found during:** Task 2, the battle-type summary case.
- **Issue:** `allBattlesOnly` is `title === 'wows'` in `vehicle-aggregate.ts` — a Warships-only property.
  My assertion was wrong about the product, not the product wrong about the test.
- **Fix:** the case now asserts what the merge actually produces: one summary row per stored
  battle-type row, every code in the filter list, and the two contributing roots named.
- **Files modified:** `tests/unit/import/multi-account-lifecycle.test.ts`

**5. [Rule 1 - Bug] A second ingest in one test answered with the FIRST import's reply.**
- **Found during:** Task 3, the replace and abort cases.
- **Issue:** `waitForTerminal` scans the whole call history by design, so without a clear the replace
  cases asserted against the previous import's `done`. This is the harness's documented behaviour, not a
  defect in it — `multi-account-import.test.ts` records the same trap for the zip-hash fixture.
- **Fix:** `ingestDone` clears the spy before posting, with the reason in its doc comment.
- **Files modified:** `tests/unit/import/multi-account-lifecycle.test.ts`

### Workflow notes

**6. `deleteAggregate` branches rather than computing its update key.** `db.meta.update('active', { [field]: null } as Record<string, null>)`
does not type-check against Dexie's `UpdateSpec<DatasetMeta>`, and the cast that would silence it erases
the typing that makes a typo in the field name a compile error. Two explicit branches keep both.

**7. No `Co-Authored-By` trailer** (AGENTS.md). One was added to the first commit by mistake and
amended off immediately; all three commits are clean.

## Known Stubs

None. Every symbol the plan's `must_haves.artifacts` list names exists and is exported:
`AccountSessionSource`, `AccountLoginSource`, `purgeUnsupportedCategoryRows`, the account grouping in
both readers, the one-account pool rule, the `handleCheckCache` call, and all three test files.

## Threat Flags

None new beyond the plan's own register. **T-09-12** is the D-21 purge and is implemented and tested as
specified: seeded v1.0 rows carrying the forum `EMAIL`/`IP_ADDRESS` and chat-message canaries are
deleted on load, a whole-dump scan of rows AND meta finds none of the three, no stored row's category
classifies as anything but supported, every supported category keeps its exact earlier count, the meta
record deep-equals itself, and a second load changes nothing. Non-vacuity is asserted — the seeded rows
are counted present immediately before the `check-cache`, and a fresh import followed by a `check-cache`
deletes nothing, because D-18 already skipped those rows. **T-09-13** (the one-account Account record)
is asserted on the three-account dataset at import and on the rebuild. **T-09-14** (a rebuild
mis-resolving a merged file) is the tracer's 13-vs-12 teeth. **T-09-16** (a half-replaced dataset) is
the abort case: `meta.put` rejecting rolls the whole transaction back and the previous rows and meta are
intact. **T-09-17** (a schema bump wiping a returning cache) — `db.verno` is 2, `.version(` count is 1,
and a v1.0-shaped cache replays. **T-09-SC** — no dependency added; `git diff --exit-code b4e7f31 --
package.json pnpm-lock.yaml` exits 0.

## Self-Check: PASSED

- `src/lib/worker/db.ts`, `src/lib/worker/ingest.worker.ts`,
  `tests/unit/import/multi-account-lifecycle.test.ts`, `tests/unit/import/db.test.ts` and
  `tests/unit/import/replay-reclassify.test.ts` — all present in the committed tree.
- Commits `71db112` (Task 1), `f112b21` (Task 2) and `d0d8b42` (Task 3) are ancestors of HEAD, and
  `d0d8b42`'s diff is exactly the five files above (+895 lines).
- `commits: 3` measured from the persisted `gsd-plan-head-before-09-03` ledger
  (`86caaf8..d0d8b42`), counting this plan's own three commits and excluding the 09-04/09-05 commits
  other executors landed in the same range.