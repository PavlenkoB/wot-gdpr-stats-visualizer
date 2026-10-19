---
phase: 11-new-game-data
plan: 04
subsystem: worker-ingest + shell-contract
tags: [presence-facts, allowlist, narrowing, d-09, d-14, d-15, privacy, idempotence, pitfall-4, pitfall-6, t-11-12, t-11-13, t-11-14, t-11-15]
requires:
  - phase: 11-new-game-data
    provides: "11-01's row choke point and projectRow; 11-03's complete spec table, full family patterns and per-header fixtures"
provides:
  - new-data-shared-pane-contract
  - newDataPaneFacts
  - DatasetFile.parsedRowCount
  - narrowStoredNewDataRows
  - ClassifyResult.newDataPanes
affects: [11-05, 11-07, 11-08, 11-10, 11-11]
tech-stack:
  added: []
  patterns:
    - the family/spec/store decision is made ONCE per file, at the top of the parse loop, so the presence fact and the stored rows are written from the same decision
    - one pure derivation feeds all three payloads, the `accountSummariesOf` / `rootCount` precedent extended to the panes
    - a cached classification is never the input to a cleanup step; the row's OWN name and category are
    - write only what changed, so the cleanup is idempotent by construction rather than by a guard
key-files:
  created:
    - src/lib/features/new-data/new-data-shared.ts
    - src/lib/worker/new-data-facts.ts
    - tests/unit/import/new-data-facts.test.ts
    - tests/unit/import/new-data-narrow.test.ts
  modified:
    - src/lib/worker/db.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/core/types/worker-messages.ts
decisions:
  - "Activity_History stays OUT of PRESENCE_CATEGORIES. The family rule records a fact for a family file in a SUPPORTED category instead, so HEAT_Session_Geolocation.csv gets one without every WoT session file starting to (Pitfall 4)."
  - "A family fact's rowCount is the STORED count and parsedRowCount the PARSED count, so `parsedRowCount > 0 && rowCount === 0` is the 'in the export but skipped' state D-09 needs. A non-family fact carries NO parsedRowCount property at all, so the two are distinguishable by shape and not only by number."
  - "narrowStoredNewDataRows groups rows per ACCOUNT as well as per category: two accounts contribute the same family file name (D-12), and one account's drifted header must not delete the other's good rows."
  - "No requirement is marked complete: GAMES-01 and GAMES-04 both read 'are shown' and this plan shows no pane — 11-05 and 11-07 do. PRIV-01 was already Complete from 11-01."
actuals:
  tokens: 19300
  tasks: 3
  commits: 5
metrics:
  duration: 32min
  completed: 2026-10-19
status: complete
commits: 5
plan_head_before: b4827d1077c2f3ae51dcbf4feeddabf1b1c0b78f
plan_head_after: c0122688ad159ef13e2637d0ecf8c7bb0f1938f9
---

# Phase 11 Plan 04: Presence facts, pane facts, and the narrowing step Summary

The three states of a new-game file become facts the shell can read without
asking the worker anything, one pure function publishes the per-pane counts
identically on import and on replay, and a returning reader's cache stops
holding a non-allowlisted column of any new-game file on its next load.

## What shipped

### `src/lib/features/new-data/new-data-shared.ts` (new, ZERO imports)

`NEW_DATA_PANE_IDS` (`'heat'`, `'warships-storage'`), `NewDataPaneId`,
`NEW_DATA_PANE_FILES` (4 HEAT files, 2 WoWS files, lower-cased keys) and
`NewDataPaneFacts` (`{ fileCount; rowCount }`). `grep -c '^import'` prints **0**,
the `device-info-shared.ts` convention. Plan 11-07 extends it with view types.

### `DatasetFile.parsedRowCount`

A non-indexed property of the existing meta record, so **no Dexie version**:
`version(2)` and its upgrader are untouched and `db.verno` stays 2, pinned by
`tests/unit/import/db.test.ts`. The doc comment states the three states and the
rule that readers treat an absent field as "parsed equals stored".

### The presence push

The `family` / `spec` / `storeFile` decision MOVED from below the row loop to
above the presence push — it decides exactly what it decided before (the row
loop is still guarded by `storeFile`, and the aggregator `rows.push` is still
deliberately not gated). What it buys is that a family fact's `rowCount` is the
count the allowlist STORED rather than the count that was parsed. The push
condition is now `PRESENCE_CATEGORIES.has(category) || (family && storeRows)`,
so `Activity_History` never joins the set and no WoT session file gains a fact.
A non-family fact is byte-identical to what Phase 5 recorded: the
`parsedRowCount` property is spread in conditionally.

### `src/lib/worker/new-data-facts.ts` (new)

`newDataPaneFacts(files)` — pure, no Dexie, no DOM, no copy. A fact counts
toward a pane when its lower-cased name is one of that pane's keys AND
`specFor(fact.category, sourceFile)` is non-null; the category test is what stops
a misfiled copy from creating a pane (T-11-14). `rowCount` sums STORED rows only.
`null` / `undefined` / `[]` all return `{}`, which is the honest answer for a
cache that predates presence facts (Pitfall 6).

`ClassifyResult.newDataPanes` is optional and carries two integers per pane.
`finalResult` and `resultFromMeta` — which between them cover `done`,
`duplicate` and `cache-status` — are the only two call sites, each with a
comment to edit the pair together.

### `narrowStoredNewDataRows` in `db.ts`

One `'rw'` transaction over `db.rows` AND `db.meta`, awaited in
`handleCheckCache` immediately after `purgeUnsupportedCategoryRows()` with no
catch of its own.

- The `sourceFile` index is walked with `orderBy().uniqueKeys()` (index-only);
  a key whose name is not a family file is never read at all, and each survivor
  costs ONE single-key query — the list form never appears.
- Rows are grouped per ACCOUNT × category, and each group is judged on its own:
  no spec, or headers matching no allowlist column, deletes the group;
  otherwise every row whose projection DIFFERS is rewritten, keeping its `id`,
  `category`, `sourceFile`, `rowIndex` and `account`.
- The presence facts in `meta.files` and in every `meta.accounts[].files` are
  rewritten to the stored count, and a `parsedRowCount` a legacy fact never had
  is read off the old `rowCount`. The meta record is written ONLY when a fact
  actually changed, so an idempotent run does not even touch its bytes.

The doc comment carries the sections the plan asked for: why the decision is on
the row's own name and category rather than a cached status, why this
transaction opens `meta` when the purge does not, the idempotence argument, and
that no Dexie version is added.

## The narrowing is a DATA operation, not a version bump

The plan asked for an explicit justification. It is the D-21 purge's argument,
one step further: `version(3)` with an `upgrade` callback would cost every
returning user their whole cached dataset — rows, identity, imported-at — to
narrow a subset of their rows, and the `version(2)` upgrader already wipes both
stores. Every record shape here is unchanged, so `db.verno` stays 2 and a row
the step deletes is recoverable by re-importing the archive.

## Deviations from Plan

### Process

**1. [Rule 3 - Process] Task 2's RED was recorded after the implementation existed**
- **Found during:** Task 2, after GREEN
- **Issue:** the tests were authored before the implementation, but the first
  run happened after `new-data-facts.ts` was written, so the failing run was
  captured by temporarily deleting the two publish call sites rather than by
  running the tests against an absent module. The RED is genuine (2 failures,
  each `expected undefined to equal { heat: … }`) but it is weaker evidence than
  Task 1's and Task 3's: the pure cases passed in the recorded run because the
  function under test was present.
- **Fix:** none available after the fact — recorded here so a reader knows which
  of this plan's three RED runs is a collection-level failure (Tasks 1 and 3)
  and which is a behavioural one (Task 2). The GREEN run is 3,489 tests.

**2. [Rule 3 - Tooling] `gsd_run` is not on PATH, so the state verbs ran by hand**
- **Found during:** state updates
- **Issue:** `command -v gsd_run` returns nothing in this environment, so
  `state.advance-plan`, `roadmap update-plan-progress` and
  `requirements mark-complete` could not be invoked.
- **Fix:** STATE.md, ROADMAP.md and REQUIREMENTS.md were edited directly, with
  the same fields the verbs write.

### Auto-fixed Issues

**3. [Rule 1 - Bug] A test expected a delete count where a rewrite count was right**
- **Found during:** Task 3, GREEN
- **Issue:** the per-account drift case seeded root A with a row matching no
  allowlist column and root B with a row that carries a real column plus a
  surplus one. The implementation returns deleted PLUS rewritten, so the case
  asserted 1 where the honest answer is 2 — the sibling's row is narrowed, not
  deleted, and the row assertions below it already proved that.
- **Fix:** the expectation became 2, with a comment saying the return value
  alone would not have made the claim — the surviving row does.
- **Files modified:** `tests/unit/import/new-data-narrow.test.ts`
- **Commit:** c012268

**4. [Rule 1 - Bug] Two test-only type errors `vitest` accepts and `tsc` does not**
- **Found during:** Task 3, `pnpm run check`
- **Issue:** the planted `__parsed_extra` surplus array is deliberately not a
  `string`, and the identity record used for the "meta untouched" case named
  fields `AccountIdentity` does not have.
- **Fix:** `as unknown as string` for the surplus array (the same idiom 11-01
  used for the same reason, with the reason written beside it) and the identity
  spelled `{ nickname, region, createdAt }`.
- **Files modified:** `tests/unit/import/new-data-narrow.test.ts`
- **Commit:** c012268

### Scope notes (not deviations, recorded for the reader)

- **`grep -n "newDataPaneFacts" src/lib/worker/ingest.worker.ts` prints three
  lines**, not two: the module import plus the two call sites. The criterion is
  about call sites, and there are exactly two.
- **A pane file with no spec is unreachable through the contract** — all six
  `NEW_DATA_PANE_FILES` keys have specs in 11-03's table — so the null-spec
  branch is covered by a fact whose CATEGORY carries no spec for that file
  (`Device_Info` / `heat_account_statistics.csv`) rather than by a fabricated
  spec-less pane key.
- **The `heat_device_info.csv` fact is reachable only because of the family
  rule.** It sits in `Player_Statistics` and `Device_Info`, both presence
  categories, and its rows still store nothing: `rowCount: 0`,
  `parsedRowCount: 1`.
- **`narrowStoredNewDataRows` returns early on a database with no meta record**
  before walking the index. There is nothing to narrow and no facts to keep in
  agreement, so the walk would find nothing anyway.

## TDD evidence

**Task 1.** RED `251f8cf` — 5 failures, every one an assertion about a fact that
does not exist or a count that is the parsed one. GREEN `1cfee29` — the whole
suite green.

**Task 2.** RED recorded against the publish wiring removed — 2 failures, both
worker-level (`newDataPanes` undefined on `done`). See deviation 1. GREEN
`e7b78f0`.

**Task 3.** RED `2377a25` — 15 failures, all `TypeError: narrowStoredNewDataRows
is not a function`, i.e. the export does not exist. GREEN `c012268` — the
whole suite green, after deviation 3 corrected one expectation.

## Verification

| Gate | Result |
|------|--------|
| `pnpm run test:unit` (whole suite) | 108 files, 3,508 tests, all pass |
| `pnpm run check` (`tsc -b` + `svelte-check`) | 321 files, 0 errors, 0 warnings |
| `pnpm run lint` (`prettier --check .` + `eslint .`) | clean |
| `grep -c '^import' src/lib/features/new-data/new-data-shared.ts` | 0 |
| `grep -n "parsedRowCount" src/lib/worker/db.ts ingest.worker.ts` | declaration, doc, push |
| `PRESENCE_CATEGORIES` set literal | four categories, unchanged |
| `newDataPaneFacts` call sites in `ingest.worker.ts` | 2 (plus the import) |
| `narrowStoredNewDataRows` in `db.ts` / `ingest.worker.ts` | export + import + 1 call, after the purge |
| `.version(` in `db.ts` | `version(2)` only; `db.verno` asserted 2 in the new test |
| `Co-Authored-By:` on any of the five commits | none |
| Canary sweep over `db.rows` after a seeded legacy cache + `check-cache` | no `CANARY-…` / `…@…example.invalid` |

**Not run:** `pnpm exec playwright test`. This plan adds no e2e spec and renders
nothing; Chromium cannot be launched in this environment, as in 11-01, 11-02 and
11-03. The four e2e specs are covered by `tsc -b`, `svelte-check`, `eslint` and
`prettier`, all green.

## Known Stubs

None. No `TODO`, `FIXME`, placeholder copy or unwired data source was
introduced. Every published number is computed from stored rows and asserted
against a hand-written literal (4/12 and 2/6 for the pane counts, 3/3, 0/3 and
0/0 for the fact states).

## Threat Flags

All five register entries in the plan's `<threat_model>` are mitigated and
pinned by tests in this plan; no new surface beyond them was introduced.

| Flag | File | Test that holds it |
|------|------|---------------------|
| threat_flag: legacy-rows-at-rest | `src/lib/worker/db.ts` | the seeded-legacy suite plus the `check-cache` case: no canary survives in `db.rows` |
| threat_flag: cleanup-touching-what-it-must-not | `src/lib/worker/db.ts` | non-family rows asserted byte-identical, per-account grouping, idempotence, and every other meta field compared |
| threat_flag: pane-object-carries-a-cell | `src/lib/worker/new-data-facts.ts` | the serialised-panes case asserts every string in the object is a pane id from the contract |
| threat_flag: crafted-archive-meta-growth | `src/lib/worker/ingest.worker.ts` | the `MAX_PRESENCE_FILES` case runs the family half through the same cap |
| threat_flag: package-install | — | this plan installs and upgrades nothing |

## Self-Check: PASSED

All four created files exist; all five commits (`251f8cf`, `1cfee29`, `e7b78f0`,
`2377a25`, `c012268`) are ancestors of HEAD; `commits: 5` is measured from the
plan ledger, not narrated.

## Carried to the next plan

- **11-05** reads `ClassifyResult.newDataPanes` for the list, the Overview card
  and the detail headers. It is optional, so a pre-parse or hand-built result
  has to render as "no pane"; `newDataPaneFacts` returns `{}` for a cache with
  no presence list, and that is the shape to handle.
- **11-07** extends `new-data-shared.ts` with view types. It must keep the
  module import-free — `grep -c '^import'` is the check, and it is the reason
  the pane contract could be imported by both the worker and the page.
- **11-08, 11-10, 11-11** can use `buildNewDataFilesExport` and
  `buildLargeTableCsv` rather than spelling out a header, and must keep the
  COMMA delimiter and the MIXED terminators.
- **A family file's fact is now the place D-09's three-state sentence is read
  from.** `parsedRowCount > 0 && rowCount === 0` is "skipped",
  `parsedRowCount === 0` is "no rows", no fact is "not in this export". The
  narrower pane question ("which of the pane's files was skipped?") still needs
  the per-file facts, so a pane detail header must read them, not the pane
  totals.
- **11-RESEARCH's Runtime State Inventory open item is now closed**: a returning
  reader's cache is narrowed on its next load, and the narrowing is idempotent,
  so the second load after that costs one index walk and no writes.