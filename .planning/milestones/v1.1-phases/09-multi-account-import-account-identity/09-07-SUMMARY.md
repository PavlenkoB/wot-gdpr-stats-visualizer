---
phase: 09-multi-account-import-account-identity
plan: 07
subsystem: worker-readers
tags: [multi-account, worker, csv, headers, cr-01, privacy, d11, d12]
requires:
  - phase: 09-03
    provides: "readSessionRowData / readLoginRowData group per account because each source resolves its OWN columns from its own first row"
  - phase: 09-02
    provides: "row.account stamps and DatasetMeta.accounts, so a stored row knows which root owns it"
provides:
  - "AccountRowGroup (src/lib/worker/csv-columns.ts) — the shared 'one account's rows of one file' type every aggregator and the reader agree on"
  - "readRowsByFile grouped per ACCOUNT and per file, in first-seen account order, reusing accountOf; the reader now reads row.account"
  - "data-queries.ts is the ONE seam: groupsOf hands per-account groups to all five channel builders; isPresent sums the groups' lengths"
  - "headerKeyedTable resolves columns PER GROUP and reads each row through its own group's keys; no-usable only when EVERY group resolves nothing; MAX_DEVICE_ROWS caps the flattened concatenation"
  - "vehicle-aggregate: per-group resolution for the by-type, all-battles, summary, header and WOWP20 paths; a union column list in spec order; a de-duplicated battle-type code union still sorted by compareCodes"
  - "finance-aggregate: buildPremium / buildCurrency / buildSpend iterate the groups and fold into the SAME accumulators, so totals still combine accounts"
  - "tests/helpers/row-groups.ts — oneAccount / oneAccountEach, so 'this file belongs to one account' is a named fact rather than a shape spelled at forty call sites"
  - "buildDivergentHeaderTwoAccountExport — two roots whose same-named device, vehicle and currency files disagree on a column spelling, with MA_DIVERGENT_* canaries"
  - "device-info-worker.test.ts — the CR-01 tracer through import, Dexie, all three channels and the posted view, plus the reader's own grouping"
  - "db-rows-by-file.test.ts re-expressed in the grouped shape: 8 cases (was 6), none dropped"
actuals:
  tokens: 31800
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns:
    - "the reader groups per ACCOUNT and per file in first-seen order, as a Map keyed by root and reusing accountOf — never a joined account-and-file string (T-09-27)"
    - "column keys are resolved per group and every row is read through its OWN group's keys; a UNION is legitimate for a column LIST (which only asks 'did anyone resolve it') and never for a cell"
    - "a renamed column with NO accepted spelling is honestly null/excluded on that account's own rows; what the merged reader cost was the OTHER account's value"
key-files:
  created:
    - tests/helpers/row-groups.ts
  modified:
    - src/lib/worker/csv-columns.ts
    - src/lib/worker/db.ts
    - src/lib/worker/data-queries.ts
    - src/lib/features/device-info/device-info-aggregate.ts
    - src/lib/features/vehicles/vehicle-aggregate.ts
    - src/lib/features/finance/finance-aggregate.ts
    - tests/fixtures/multi-account-fixtures.ts
    - tests/unit/import/device-info-worker.test.ts
    - tests/unit/import/db-rows-by-file.test.ts
    - tests/unit/import/data-query-worker.test.ts
    - tests/unit/import/multi-account-keys.test.ts
    - tests/unit/finance/finance.test.ts
    - tests/unit/finance/finance-state.test.ts
    - tests/unit/vehicles/vehicle-stats.test.ts
    - tests/unit/vehicles/vehicle-model.test.ts
    - tests/unit/vehicles/vehicle-blocks.test.ts
    - tests/unit/device-info/device-info-aggregate.test.ts
key-decisions:
  - "The ACCOUNT is the outermost level of readRowsByFile's grouping, for the reason readSessionRowData already carries: a key is never taken across an account boundary. The reader now reads row.account."
  - "A union of the per-group resolved fields is the right shape for a COLUMN LIST (listColumns only asks 'did anyone resolve it') and the wrong one for a cell — which is why mapRow always takes the group's own map"
  - "The battle-type code list is the accounts' de-duplicated union, then sorted by the EXISTING compareCodes comparator, rather than the plan's 'first appearance' order: the plan also requires a same-header fixture to render byte-identically, and today's order is numeric-then-code-unit, pinned by existing tests"
  - "The vehicle empty-name regression is proven where it belongs — a group whose header declares NO vehicle column — because VEHICLE_NAME has one accepted spelling, so renaming it would blank that account's own row under ANY resolution and prove nothing"
  - "Grouping is not slicing: D-11 is untouched. Every pane still shows all accounts' rows, repeated summary codes stay asserted (D-12), and Phase 10 still owns per-account slicing, merging vehicles by id and per-currency totals"
requirements-completed: [ACCOUNT-02, ACCOUNT-08]
coverage:
  - id: D1
    description: "A divergent-header archive's second account's device values reach the posted DeviceInfoView, and its rows are not blanked by the first account's keys"
    requirement: ACCOUNT-02
    verification:
      - kind: unit
        ref: "tests/unit/import/device-info-worker.test.ts#09-07 CR-01: two accounts whose same-named files disagree on a header"
        status: pass
        human_judgment: false
  - id: D2
    description: "readRowsByFile returns TWO groups for one file name, in first-seen account order, each carrying its own first-row keys, and a legacy row falls back to the dataset account root"
    requirement: ACCOUNT-02
    verification:
      - kind: unit
        ref: "tests/unit/import/db-rows-by-file.test.ts#groups per account in first-seen order, rows in stored order inside each"
        status: pass
        human_judgment: false
  - id: D3
    description: "The same archive's vehicle rows both carry their own name and battle count, and no row of a present file renders the empty-name shape"
    requirement: ACCOUNT-02
    verification:
      - kind: unit
        ref: "tests/unit/vehicles/vehicle-stats.test.ts#09-07 CR-01: a file two accounts contribute under different headers"
        status: pass
        human_judgment: false
  - id: D4
    description: "The same archive's currency keeps the canonical account's amount, and the two accounts' operations still fold into ONE currency entry (D-11 intact)"
    requirement: ACCOUNT-02
    verification:
      - kind: unit
        ref: "tests/unit/finance/finance.test.ts#09-07 CR-01: two accounts whose same-named currency file disagrees on a header"
        status: pass
        human_judgment: false
  - id: D5
    description: "The defect is proven at the WORKER-HARNESS boundary, not only at the builder: with the product change stashed, the worker-level vehicles/currency case for the divergent archive fails"
    requirement: ACCOUNT-02
    verification:
      - kind: unit
        ref: "tests/unit/import/device-info-worker.test.ts#carries the second account vehicles and currency through the real channels too"
        status: pass
        human_judgment: false
  - id: D6
    description: "A single-account v1.0 dataset is unchanged: 3109 → 3117 unit tests with no existing assertion edited to accommodate the new input shape, db.verno still 2, and no dependency or src/lib/import change"
    requirement: ACCOUNT-08
    verification:
      - kind: unit
        ref: "tests/unit/import/db.test.ts#account and accounts round-trip with NO version bump"
        status: pass
        human_judgment: false
  - id: D7
    description: "The reader's doc comment states the per-account rule, keeps the one-transaction and no-multi-key rules, and names Phase 10's remainder; the false 'MERGES every account' invariant is gone"
    requirement: ACCOUNT-02
    verification:
      - kind: other
        ref: "grep -c \"MERGES every account\" src/lib/worker/db.ts → 0"
        status: pass
        human_judgment: false
  - id: D8
    description: "The phase gate is green and the e2e budget is unmoved: 258 tests in 28 files, no new Playwright test"
    requirement: ACCOUNT-08
    verification:
      - kind: other
        ref: "pnpm exec playwright test --list → Total: 258 tests in 28 files"
        status: pass
        human_judgment: false
metrics:
  duration: 19m
  completed: 2026-10-17
  commits: 4
  plan_head_before: 783e8b69a5d39aa17d31a848f019f15725222cf0
  plan_head_after: 622d92434ea701b8bbd4f8661f90aa7922671c43
status: complete
---

# Phase 9 Plan 07: Per-account column resolution in the merged readers (CR-01)

One-liner: The one gap the phase's verification scored as failed — a merged read bucket whose consumers resolved column keys off one account's header, so a second account's values were reported as absent while its file was plainly in the archive — is closed by grouping `readRowsByFile` per account and resolving every cell through the keys its own account's header declares.

## What was built

**`src/lib/worker/csv-columns.ts`** gains one exported type, `AccountRowGroup<T>`, holding an
account root and that account's rows of one file. It lives here because this is already the
one worker-side module every aggregator imports for `headerKey`/`cell`, and because a builder
must not reach into `src/lib/worker/db.ts` — the persistence layer — for a type describing rows.

**`src/lib/worker/db.ts`.** `RowsSnapshot.rows` is now a map from the lower-cased file name to
that file's `AccountRowGroup[]`, in first-seen account order, each group's rows in stored order.
The grouping is a `Map` keyed by the root inside the existing per-file loop, and the owning
account is `accountOf(row, meta)` — the *same* helper `readSessionRowData` and `readLoginRowData`
call, so the account-or-legacy rule is stated once. The index walk, the name screen, the category
screen and the one-transaction rule are byte-for-byte what they were; only what a bucket
contains changed.

**`src/lib/worker/data-queries.ts`** is the single seam. The flat `rowsOf` helper is gone,
replaced by `groupsOf`, which returns the groups for a file name; `isPresent`'s row-count
fallback sums the groups' lengths. No builder reaches the map itself.

**`device-info-aggregate.ts`.** `DeviceSourceInput` carries groups. `headerKeyedTable` resolves
each group's columns from that group's own first row and reads every row through the keys
resolved for the row's own group. `no-usable` is answered only when *every* group resolves no
usable column, so one account whose header this app can read makes the table `ready` and the
account that renamed every column is reported on its own rows as `null` cells rather than hiding
the table. `rowCount` sums every group's rows and `MAX_DEVICE_ROWS` caps the *flattened*
concatenation — groups in order, rows in stored order within a group — never a per-group cap and
never an interleaving. The Assistant path reads per row already, so grouping only fixes its
order and its count. The `__proto__`-safe `Map`, the personal-field column list and the blob
extractor are untouched.

**`vehicle-aggregate.ts`.** `VehicleFileFacts` carries groups. Every place that resolved against
one array's first element — the by-type resolution, the all-battles resolution, the summary
builder, the WOWP20 note, the header and the row counts — now resolves per group and maps that
group's rows through that group's own keys. The **column list is the union** of what the accounts
resolved (a field is listed when *any* group resolved it), so a column only the second account's
header carries is still shown. The **battle-type code list** is the accounts' de-duplicated
union, sorted by the existing `compareCodes` comparator. Row counts sum the groups.

**`finance-aggregate.ts`.** `buildPremium`, `buildCurrency` and `buildSpend` iterate the groups,
resolve their columns — `premiumDateColumn` included — from each group's own first row, and fold
into the **same** `Map` accumulators the single-account path uses. The personal-identifier
columns stay unresolvable (T-05-11), and the micro-unit arithmetic and its test pins are
unchanged.

**Tests.** `tests/helpers/row-groups.ts` gives every test that stands for a single-account export
one named way to say so. `buildDivergentHeaderTwoAccountExport` writes three same-named files
under two roots whose headers disagree on `OS`/`OPERATING_SYSTEM`, `BATTLES_COUNT`/`GAMES_PLAYED`
and `AMOUNT`/`AMOUNT_VALUE`, with each root's own `MA_DIVERGENT_*` canaries.

## TDD evidence

RED was demonstrated by actual failing runs, at both boundaries.

1. **Before any product change** — the device-info tracer failed with
   `AssertionError: expected [ null, null ] to include 'SynthDivergentOS-Canonical'`. Both
   accounts' `os` cells read `null` because both rows were read through the renamed root's keys,
   and the reader case failed with `expected [ undefined, undefined ] to deeply equal
   [ '1000000004', '500000002' ]` — the merged bucket carries no account at all.
2. **The vehicles and finance REDs** failed on the missing value, not on a type error: the
   merged vehicle view had no row under the canonical account's name, and the merged currency view
   answered `no-usable` — both operations excluded — because `AMOUNT` resolved to null off the
   renamed root's first row.
3. **At the worker-harness boundary**, with the four product files stashed and the tests in place,
   `carries the second account vehicles and currency through the real channels too` fails. That
   is the point of the tracer: a builder handed one account's rows was always correct; the defect
   lived at the seam.

## The subtlety this plan's fixture shape had to be honest about

A renamed column with **no** accepted spelling is legitimately unreadable on that account's own
rows, under any resolution. What the merged reader actually cost was the *other* account: with
`OS`→`OPERATING_SYSTEM`, resolving off the renamed row made the canonical account's `OS` null; with
`AMOUNT`→`AMOUNT_VALUE`, it excluded both operations so the shared currency answered `no-usable`
outright. The fixtures and the assertions are written to that truth, and the vehicle empty-name
case is proven where it can be — a group whose header declares *no* vehicle column at all — rather
than by renaming `VEHICLE_NAME`, which would have blanked that account's own row under any
resolution and proved nothing.

## Deviations from Plan

### Planner-choice clarifications

**1. The battle-type code list keeps `compareCodes` order, not "first appearance".**
The plan's Task 2 behaviour block asks for the union "de-duplicated, ordered by first
appearance". Its own `must_haves` also require that "with identical headers (every existing
fixture) the list is byte-identical to today's" — and today's order is numeric-then-code-unit,
deliberately chosen and pinned by existing tests. The two cannot both hold for a single account.
I kept the existing comparator: the union is the new part, and a same-header fixture is
byte-identical, which is the stronger of the two requirements.

**2. The divergent archive's vehicle header renames `BATTLES_COUNT`, not `VEHICLE_NAME`.** See
the section above: renaming the vehicle column has one accepted spelling, so it cannot demonstrate
a *recovered* value, only an honest blank on that account's own row. The empty-name regression is
proven by a purpose-built two-group case in `vehicle-stats.test.ts` instead.

**3. One extra test helper file.** The plan anticipated editing only two hand-built facts in the
import tests. The input shape change reaches every test that *constructs* one, so
`tests/helpers/row-groups.ts` exists to keep that mechanical: `oneAccount(rows)` is the one way a
test says "this file belongs to one account", rather than a group literal at ~50 call sites. No
assertion was weakened — see below.

### Auto-fixed Issues

**4. [Rule 1 - Bug] `unionResolved` omitted null-valued field ids.**
- **Found during:** Task 2, first full vehicle run.
- **Issue:** it copied only the non-null entries, so an id left ABSENT read as resolved through
  `listColumns`' `fields.get(id) !== null` test, and `maxDamage` / `inGarage` appeared in the WoT
  All-battles column list.
- **Fix:** seeded from the first group's map, nulls included — `resolveFields` gives every field
  an entry, and the column list is about presence, not about a key.
- **Files modified:** `src/lib/features/vehicles/vehicle-aggregate.ts`
- **Verification:** the 155 vehicle tests, including `not.toContain('maxDamage')`, are green.

### Workflow notes

**5. No `Co-Authored-By` trailer** (AGENTS.md), on any of the four commits.

**6. The reader's doc comment was rewritten once, in Task 3**, as the plan asked. Task 1 left a
one-line marker naming Task 3 in its place, so the intermediate state could not be mistaken for
the finished one; the marker is gone.

## Verification

- `pnpm run check` → 313 files, **0 errors, 0 warnings**.
- `pnpm run lint` → clean.
- `pnpm run test:unit` → **3117 passed, 96 files, 0 failed** (3109 before this plan; +8).
- `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/import/persistent-dataset.spec.ts`
  → **10 passed (12.0 s)**.
- `pnpm exec playwright test --list` → **`Total: 258 tests in 28 files`** — the budget is unmoved
  and `tests/unit/guards/ci-budget.test.ts` stays satisfied.
- `grep -c "MERGES every account" src/lib/worker/db.ts` → **0**. The comment now names Phase 10's
  per-account slicing, merging vehicles by id, and per-currency totals.
- `grep -n "AccountRowGroup" src/lib/worker/{csv-columns,db,data-queries}.ts` → all three.
- `grep -c "rowsOf" src/lib/worker/data-queries.ts` → **0**.
- `grep -c "\.version(" src/lib/worker/db.ts` → **1**; `pnpm exec vitest run tests/unit/import/db.test.ts`
  → 37 passed. `db.verno` is still 2.
- `git diff --exit-code -- package.json pnpm-lock.yaml src/lib/import` → **0** (T-09-SC). No
  dependency added, no `.svelte` file touched, no network request.
- **The surviving `rows[0]` hits, and why each is per-account** (Task 2's acceptance criterion):
  eight of them, and every one reads `group.rows[0]` inside a loop over that file's groups or
  inside a helper handed one group's rows — `device-info-aggregate.ts:300` (`resolveKeysOf`),
  `vehicle-aggregate.ts:235` (`resolvedByGroup`), `:829` (`buildSummary`), `:869`
  (`buildWowp20Note`), `:951` (`buildHeader`), and `finance-aggregate.ts:390`, `:564`, `:845`
  (the three builders' per-group resolution). There is no read of a *merged* array's first
  element left in the three aggregators.
- **No existing assertion was edited to accommodate the new shape.** The 3117 - 3109 = +8 tests
  are all new: the device-info tracer's three cases, the vehicle CR-01 pair, the finance CR-01
  case, and the two reader grouping cases. The 49 finance and 155 vehicle call sites that had to
  change were *inputs*, wrapped by `oneAccount`/`oneAccountEach`, and every `expect` in them is
  byte-identical.

## Known Stubs

None. Every symbol the plan's `must_haves.artifacts` list names exists: `AccountRowGroup`,
`buildDivergentHeaderTwoAccountExport` and its `MA_DIVERGENT_*` canaries, `groupsOf`, the account
grouping in the reader, the per-group resolution in all three aggregators, and the re-expressed
reader suite.

## Threat Flags

None new beyond the plan's own register, and both of its new threats are implemented as specified.

**T-09-26** (a value read through another account's key) is closed by the per-group resolution, and
its teeth are the RED runs above plus the worker-harness case: the device tracer failed with both
`os` cells `null`, the vehicle view lost the canonical account's row entirely, and the currency
view answered `no-usable` — with the product change stashed, the worker-level case still fails.

**T-09-27** (the grouping key) is a `Map` keyed by the root inside the existing per-file loop,
reusing `accountOf`; there is no joined account-and-file string anywhere in the reader.
`buildHostileRootNamesExport` is re-run by the existing multi-account suite, which is green, and
`tests/unit/import/multi-account-keys.test.ts`'s two and three-account cases still assert the
REPEATED ids and REPEATED summary codes D-12 requires — each copy is now its own group rather
than a concatenation, which is what that file's own comment said it meant to do.

**T-09-SC** — no dependency added; `git diff --exit-code -- package.json pnpm-lock.yaml` exits 0.

## Self-Check: PASSED

- Every file in `key-files.created` / `key-files.modified` is present in the committed tree.
- Commits `8e74501` (RED), `e62f47c` (Task 1), `991e475` (Task 2) and `622d924` (Task 3) are
  ancestors of HEAD, and `622d924`'s diff is exactly `src/lib/worker/db.ts` and
  `tests/unit/import/db-rows-by-file.test.ts`.
- `commits: 4` measured from the persisted `gsd-plan-head-before-09-07` ledger
  (`783e8b6..622d924`), not narrated.