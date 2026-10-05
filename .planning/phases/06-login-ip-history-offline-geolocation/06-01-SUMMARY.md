---
phase: 06-login-ip-history-offline-geolocation
plan: 01
subsystem: database
tags: [web-worker, dexie, indexeddb, svelte, ip-addresses, aggregation, gdpr]

requires:
  - phase: 04
    provides: "SessionRow/SessionSource types, parseSessionTimestamp, readSessionRowData's one-snapshot reader, writePlaytimeIfCurrent's replace guard, the lazy-backfill pattern"
  - phase: 05
    provides: "the field-less data-query channel contract, DATA_FILES/DATA_CHANNELS, the memo, isDataQuery's strict shape rejection, the four-channel answer test"
  - phase: 03
    provides: "the version(2) Dexie upgrader that wipes the emailed Phase 2 cache (D-19)"

provides:
  - "src/lib/geo/ip.ts — strict IPv4 parse (ParsedIp, parseIp, maskIp, MAX_IP_TEXT_LENGTH = 64)"
  - "src/lib/geo/country-lookup.ts — the CountryLookup seam: lookupCountry answers null, geoTableId answers 'none'"
  - "src/lib/features/logins/login-shared.ts — LOGINS_VERSION, LoginAddress, LoginAggregates, LoginsView"
  - "src/lib/features/logins/login-aggregate.ts — pure buildLogins / viewFromLogins over session sources with an INJECTED lookup"
  - "the `logins` channel on DataQuery and DataResult, answered from the meta record in the worker"
  - "DatasetMeta.logins, the eighth writeDataset parameter, and writeLoginsIfCurrent"
  - "the lazy rebuild: a missing, wrong-version or wrong-geo aggregate is re-derived from the stored rows"
  - "the recorded Dexie decision (option-a) and the pin that holds it"
affects: [06-03, 06-04, 06-05, 06-06, 06-08, 06-09, 06-10]

actuals:
  tokens: 31900
  tasks: 3
  commits: 3
commits: 3
plan_head_before: 9a2f34142899a22ff730c9f18782b9e8733889a2
plan_head_after: bbbcc1f9de00dd5d9253855aa5d257cdb399c5f1

tech-stack:
  added: []
  patterns:
    - "A derived aggregate rides on the existing `meta` record as a NON-INDEXED field — no Dexie version bump, and a rebuild from the stored rows when it is missing or stale"
    - "A stored aggregate is invalidated by EITHER a `v` mismatch or a `geo` table-id mismatch, so a build that ships a new geo table never answers from the old one's numbers"
    - "The rebuild answers with the SNAPSHOT's importedAt and the write-back is guarded by importedAt inside one transaction"

key-files:
  created:
    - "src/lib/geo/ip.ts"
    - "src/lib/geo/country-lookup.ts"
    - "src/lib/features/logins/login-shared.ts"
    - "src/lib/features/logins/login-aggregate.ts"
    - "tests/fixtures/logins-fixtures.ts"
    - "tests/unit/geo/ip.test.ts"
    - "tests/unit/logins/login-aggregate.test.ts"
    - "tests/unit/import/logins-worker.test.ts"
    - "tests/unit/import/logins-backfill.test.ts"
  modified:
    - "src/lib/core/types/worker-messages.ts"
    - "src/lib/worker/data-queries.ts"
    - "src/lib/worker/ingest.worker.ts"
    - "src/lib/worker/db.ts"
    - "tests/unit/import/db.test.ts"
    - "tests/fixtures/playtime-real-shape-fixture.ts"

key-decisions:
  - "CHECKPOINT ANSWER — option-a: NO Dexie version bump for the `logins` field. D-12 read 'schema bump per Phase 3 D-19 pattern', and the version(2) upgrader CLEARS both stores, so that pattern applied to a purely derived field would cost every returning user their cached dataset to recompute something their rows already answer. The rows still carry the IP column, so the rebuild is lossless and the worker performs it. Pinned in tests/unit/import/db.test.ts: verno is 2, a dataset with a logins field re-opens with that field and its rows, and a seeded v1 database is still wiped."
  - "A login is ONE SESSION ROW (D-01), built from every *_Game_Sessions.csv merged; each address keeps the SET of game tokens of the files it appeared in, and the legacy Sessions.csv contributes rows with no token."
  - "The country lookup is a PARAMETER of buildLogins, never imported by it — so the aggregator cannot decide which table it runs against, and a test can prove one call per DISTINCT ADDRESS rather than one per row."
  - "readSessionRowData's sources are re-typed as LoginSource of kind 'sessions' in the rebuild branch rather than stored as that type by the reader, because the reader is a playtime-module function this plan does not edit (T-04-01). 06-05 owns the Logins.csv merge."
  - "A rebuild that throws answers data-error with the error NAME only, and writes nothing — a half-derived aggregate must never reach the record."

patterns-established:
  - "A derived field on the meta record is invalidated by (v, geo) and rebuilt on read, so no schema version is ever needed for one"
  - "The answer and the rows behind it come from ONE read transaction; the answer carries the SNAPSHOT's importedAt, never an earlier one"
  - "A backfill write returns a boolean the caller IGNORES: a refused write costs one recomputation, never correctness"

requirements-completed: []
requirements-progress: "The plan's frontmatter names ACTIVITY-05 and ACTIVITY-06; NEITHER is complete and both stay Pending in REQUIREMENTS.md after this plan. 06-01 delivers the WORKER half — the `logins` channel, the stored aggregate, the rebuild and the pinned Dexie decision. ACTIVITY-05 still needs the masked table with its click-to-reveal toggle (06-09/06-10) and ACTIVITY-06 still needs a real country lookup and a world map (06-06, 06-07). Marking either here would be a claim the plan's own scope excludes."

coverage:
  - id: D1
    description: "A real-shaped export's session rows reach a typed logins answer through the real worker: import stores a versioned aggregate on the meta record and a data-query for the logins channel answers a LoginsView equal to the closed-form hand key."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/import/logins-worker.test.ts#06-01 tracer: the logins channel through the real worker"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-aggregate.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The IP column is read defensively: blank, over-64-character and non-dotted-quad cells are counted in unreadableRows and never stored, logged or echoed."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/geo/ip.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A missing, wrong-version or wrong-geo aggregate is rebuilt from the stored rows, answered with the snapshot's own importedAt, and written back only while that dataset is still the active one."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/import/logins-backfill.test.ts#06-01 — a missing or stale aggregate is rebuilt from the stored rows"
        status: pass
      - kind: unit
        ref: "tests/unit/import/logins-backfill.test.ts#06-01 — a replace can never receive the previous dataset aggregate (T-06-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Dexie schema decision is recorded and pinned: no version(3), the version(2) wiping upgrader untouched, and no returning user loses a cached dataset."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/import/db.test.ts#06-01 — the logins field added NO Dexie version (checkpoint option-a)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A bug in the logins aggregation never costs the user their import: the import finishes with logins null and the logins query answers a data-error carrying only the error name."
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/import/logins-worker.test.ts#06-01: an aggregation that throws costs the import nothing (T-04-03)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The four Phase 5 channels still answer after a logins query, so branching before DATA_FILES and before the memo narrowed nothing else."
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/import/logins-worker.test.ts#leaves the four Phase 5 channels answering after a logins query"
        status: pass
    human_judgment: false
  - id: D7
    description: "A rendered login-history block the user can look at: a masked table, its country column, the world map and the reveal control."
    verification: []
    human_judgment: true
    rationale: "This plan is the WORKER half by design and carries no UI: the block that renders the view is 06-08/06-09/06-10, and the table-backed country lookup that gives the country column real values is 06-06. Nothing a user can see exists yet, and every country reads as unknown until then."

# Metrics
duration: 28min
completed: 2026-10-03
status: complete
---

# Phase 6 Plan 01: Worker tracer — the `logins` channel from session rows to a stored, versioned aggregate

**One session row now travels from the CSV parse loop to a typed `LoginsView` through the real worker: canonical-IP grouping over an injected country lookup, a versioned aggregate on the dataset meta record, a new field-less `logins` data-query channel, a lazy rebuild for any cache that lacks a current aggregate — and no Dexie version bump, so no returning user loses their dataset.**

## Performance

- **Duration:** 28 min (Task 2 and Task 3; Task 1 was executed before the checkpoint and is counted in the commits below)
- **Started:** 2026-10-03T13:21:51Z
- **Completed:** 2026-10-03T13:49:00Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- **`ip.ts` reads the IP column defensively.** `parseIp` bounds the cell at 64 characters *before* any pattern runs, then accepts only a strict dotted quad with no leading zeros (a zero-padded octet is what `inet_aton` would read as octal, so it is rejected rather than normalised), through one anchored pattern with no nested quantifiers. Every other input — including a 100 KB hostile cell and every IPv6 form — answers `null`, and `maskIp` masks an IPv4 to `a.b.c.xxx` while answering the fixed text `xxx` for anything else, so no cell is ever echoed.
- **The aggregate is stored where nothing can tear it from its rows.** `buildLogins` runs in the worker at import over the SAME `rows` array the playtime source holds (a second pass, never a second copy) and lands in the same `meta.put` as the rows. It is never on `ClassifyResult`, because `IngestClient` holds that as a deep `$state` proxy and would walk every address on every replay. A thrown aggregation costs the import nothing: its own `try/catch` logs the error object and the import finishes with `logins: null`.
- **A stale aggregate is rebuilt, not refused and not cast.** `answerLogins` re-derives a missing, wrong-`LOGINS_VERSION` or wrong-`geoTableId()` aggregate from the stored rows through the same `buildLogins`, answers with the SNAPSHOT's `importedAt`, and writes back only through `writeLoginsIfCurrent`. A replace landing in between costs one recomputation and never a mis-attached aggregate.
- **The Dexie question is settled and pinned.** See the decision below.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — one session row to a logins answer, end to end in the worker** — `2973732` (feat)
2. **Task 2: Dexie schema decision (checkpoint option-a), recorded and pinned** — `c2ea097` (test)
3. **Task 3: Rebuild a stale or missing aggregate from stored rows** — `bbbcc1f` (feat)

## The Dexie decision, in full (checkpoint: option-a)

D-12 reads *"Dexie schema bump per Phase 3 D-19 pattern"*, and the Phase 3 D-19 `version(2)` upgrader calls `rows.clear()` and `meta.clear()`. Applied to `logins`, that pattern would cost every returning user their cached dataset — their rows, their identity, their imported-at — to recompute a value that is DERIVED from rows they already hold. The rows still carry the `IP` column, so the rebuild is lossless, and `ingest.worker.ts` performs it.

**Outcome: no `version(3)`, `version(2)` and its upgrader untouched.** This is the same discipline Phase 4's `playtime` and Phase 5's `files` followed for the same kind of field, and the plan's `db.ts` rule 1 ("if a phase declares `version(3)`, KEEP the `version(2)` block WITH its upgrader") is untouched because no phase declared one.

**Pinned in `tests/unit/import/db.test.ts`**, so a later phase cannot quietly add a `version(3)` for the next derived field:

- `db.verno` is `2`;
- a dataset written with a `logins` field re-opens with that field AND its rows intact (it is read back as an ordinary property of the unchanged `meta` store);
- a v1 database seeded with a meta record that ALREADY carries a `logins` field is wiped on open — the upgrader is still armed, and it costs nothing here because the wipe is unconditional.

## Files Created/Modified

- `src/lib/geo/ip.ts` — strict IPv4 parse and mask, no imports, never throws
- `src/lib/geo/country-lookup.ts` — the `CountryLookup` seam; `lookupCountry` answers null, `geoTableId` answers `none`
- `src/lib/features/logins/login-shared.ts` — the worker/main-thread shared contract, including the three-status `LoginsView`
- `src/lib/features/logins/login-aggregate.ts` — pure `buildLogins` / `viewFromLogins` over the same parsed rows playtime reads
- `src/lib/worker/db.ts` — `DatasetMeta.logins`, the eighth `writeDataset` parameter, `writeLoginsIfCurrent`
- `src/lib/worker/ingest.worker.ts` — `loginSources` beside `sessionSources`, the aggregation `try/catch`, `answerLogins` and its rebuild
- `src/lib/worker/data-queries.ts` — `DATA_FILES` narrowed to the file-reading channels, `logins` added to `DATA_CHANNELS`
- `src/lib/core/types/worker-messages.ts` — the two union members
- `tests/fixtures/logins-fixtures.ts` — the hand fixture and its closed-form answer key
- `tests/unit/geo/ip.test.ts`, `tests/unit/logins/login-aggregate.test.ts`, `tests/unit/import/logins-worker.test.ts`, `tests/unit/import/logins-backfill.test.ts`, `tests/unit/import/db.test.ts` — the tests

## Decisions Made

- **Option-a on the Dexie question** (above). Recorded in the `DatasetMeta.logins` doc comment, in `db.test.ts` as a pin, and here.
- **The lookup is injected, and the aggregator never imports it.** `buildLogins(sources, lookup)` takes it as a parameter, so a test can prove one call per DISTINCT ADDRESS rather than one per row — the difference between one comparison and 71,000 on a real export. `geoTableId()` is read by the WORKER, which is what decides staleness; the aggregator cannot know the id of a table it does not own.
- **A `geo` field, not just `v`.** The aggregate records the table it was resolved against, so a build that ships the DB-IP table (06-06) cannot serve `unknown` for every address from a cache the `none`-table build wrote. This is why the staleness test is `(v, geo)`, not `v` alone.
- **The `logins` channel branches BEFORE `checkCache` and before the memo** and carries the meta record's own `importedAt`. Two reasons, not one: `DATA_FILES` has no `logins` entry by design (`answerDataQuery` throws for it), and an answer read off the meta record is already a function of the dataset it names, so there is nothing for the memo to save. The branch is covered by a test asserting the four Phase 5 channels still answer.
- **`readSessionRowData` was NOT widened.** It still skips `Logins.csv`; 06-05 owns that merge, and widening the playtime reader here would put a file screen in a plan that does not own it.
- **`MAX_LOGIN_IPS` was deliberately NOT exported.** The `other` cap is `{ addresses: 0, logins: 0 }` in this plan and arrives with the table-backed lookup in 06-06; an exported constant nothing reads is dead code, and the `other` field is on the STORED type so adding the cap later is not a `LOGINS_VERSION` bump.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] `viewOf` in `data-query-worker.test.ts` widened to include `LoginsView`**
- **Found during:** Task 1 (tracer)
- **Issue:** the Phase 5 tracer's helper types the view the worker answers with; a new channel returning a different view type made the helper's return union incomplete.
- **Fix:** `LoginsView` added to the union, so a Phase 5 assertion that reads a logins answer through the shared helper is typed rather than cast.
- **Files modified:** `tests/unit/import/data-query-worker.test.ts`
- **Verification:** `pnpm run check` clean.
- **Committed in:** `2973732`

**2. [Rule 2 - Reuse] `RealShapeRow` extended to an optional third column**
- **Found during:** Task 1 (tracer)
- **Issue:** the Phase 4 real-shape fixture renderer is shared, and the login fixture is the first caller that needs to write an `IP` cell.
- **Fix:** `RealShapeRow` is now `readonly [string, string, string?]`, and `buildRealShapeCsv` writes `ip ?? REAL_SHAPE_IP` — so every Phase 4 fixture renders byte-identically and its hash is unchanged.
- **Files modified:** `tests/fixtures/playtime-real-shape-fixture.ts`
- **Verification:** the Phase 4 playtime suites pass unchanged, including the byte-shape and hash assertions.
- **Committed in:** `2973732`

**3. [Rule 1 - Bug] Two test premises corrected rather than worked around**
- **Found during:** Task 1 (tracer)
- **Issue:** `maskIp(maskIp(x)) === 'xxx'` was written as an expectation about the masked output's shape; and a hand-key address row omitted `cc`, which the table column needs.
- **Fix:** the mask assertion is restated as the SAFETY property it actually is (masking an already-masked address is still `xxx`, never a prefix leak), and the hand key's address rows carry `cc: null` explicitly.
- **Files modified:** `tests/unit/geo/ip.test.ts`, `tests/fixtures/logins-fixtures.ts`
- **Verification:** the ip and aggregate suites pass with the properties asserted in their true form.
- **Committed in:** `2973732`

**4. [Rule 1 - Bug] The "aggregation that throws" test premise updated when the rebuild landed**
- **Found during:** Task 3
- **Issue:** with Task 1's error branch replaced by the rebuild, the mocked `buildLogins` now throws from the REBUILD path rather than only at import, so the test's stated premise ("a missing aggregate is an error") no longer described what it proved.
- **Fix:** the comment names the rebuild, and the test additionally asserts that a rebuild which throws wrote NOTHING — a half-derived aggregate must never reach the record. The `data-error` / `Error`-name expectations were already correct and unchanged.
- **Files modified:** `tests/unit/import/logins-worker.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/import/logins-worker.test.ts` passes.
- **Committed in:** `bbbcc1f`

---

**Total deviations:** 4 auto-fixed (2 missing critical, 2 bug)
**Impact on plan:** None changed the design. Three are test-typing and test-premise corrections inside the files the plan already listed; the fourth is the premise update the plan itself anticipated ("That test will need updating when the rebuild lands"). No scope creep.

## Issues Encountered

- **Two imports inside one millisecond are indistinguishable to the replace guard.** `writeDataset` stamps `importedAt` from `Date.now()`, so the first backfill's guard cannot tell two datasets apart if they landed in the same millisecond. This is a bound of the millisecond stamp itself — shared with the Phase 4 playtime backfill, not introduced here, and unreachable for a real re-import, which parses a whole archive first. It is recorded in the test rather than papered over, and the test waits across the millisecond boundary deliberately.
- **The harness's `waitForTerminal` scans the spy's whole history, so a second `ingestExport` in one test answered with the FIRST import's `done`.** Fixed by clearing the spy between the two imports, and worth knowing for any later test that ingests twice.

## Known Stubs

None that affect this plan's goal. Two fields are declared at their FINAL shape with a zero or null value on purpose, and both are documented in place and owned by a later plan:

- `LoginAggregates.other` is `{ addresses: 0, logins: 0 }` — the cap arrives with the table-backed lookup in 06-06.
- `LoginAggregates.account` is `null` — 06-06 is where the sanitised `User_Info` row is read.

The country lookup itself answers `null` for every address, so every address is counted as unknown country. That is the plan's stated design (D-12's seam, table body in 06-06), not a gap: the worker contract is what this plan proves, and it is proven.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: untrusted-cell-read | `src/lib/geo/ip.ts` | The IP column can hold ANY text, including an email or a name. The 64-character bound runs before any pattern, one anchored pattern has no nested quantifiers, leading zeros are rejected rather than normalised, and a 100 KB hostile cell is a test case. |
| threat_flag: derived-data-attach | `src/lib/worker/db.ts` | `writeLoginsIfCurrent` is the only path by which a rebuild reaches storage. It compares `importedAt` inside one transaction and updates nothing but the `logins` field, so a hash, identity, category list or date can never be rewritten by a backfill. |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **06-02** (copy inventory) can start: nothing in this plan touches `ui-copy.ts`.
- **06-03** can start on the `ip.ts` seam: `parseIp` answers null for every IPv6 form and its insertion point is documented in place.
- **06-05** (the `Logins.csv` merge) must extend `readSessionRowData`'s file screen, which this plan deliberately did NOT widen, and will add a second source kind to the rebuild branch that currently re-types every stored source as `kind: 'sessions'`.
- **06-06** replaces `lookupCountry`'s body and `geoTableId`'s constant; the `geo` field is already on the stored type, so shipping a different table is a rebuild, not a migration.
- **Blocking for every UI plan:** no country column has real values and there is no rendered block. ACTIVITY-05's user-facing half is 06-08/06-09/06-10.

---
*Phase: 06-login-ip-history-offline-geolocation*
*Completed: 2026-10-03*

## Self-Check: PASSED

Every file this plan created is on disk (the four new `src/lib` modules, the fixture, and the four test files), every commit named above exists in the branch history, and the full unit suite is green: **51 files / 1500 tests pass**, `pnpm run check` (tsc -b) is clean, and `pnpm run lint` (prettier --check + eslint) is clean. The two structural acceptance criteria are verified against the diff rather than by eye: `git diff -U0 main...HEAD -- src/lib/worker/db.ts` has no deleted line, so the `version(2)` block is untouched, and `git diff --stat main...HEAD -- src/lib/features/playtime/playtime-aggregate.ts` prints nothing.
