---
phase: 04-activity-time-dashboards
plan: 01
subsystem: database
tags: [dexie, indexeddb, web-worker, postmessage, csv, aggregation, svelte5-runes, tdd]

# Dependency graph
requires:
  - phase: 02-defensive-parsing-persistent-dataset
    provides: the single Dexie connection, the writeDataset transaction and the DatasetMeta record 04-01 follows as its `playtime` precedent
  - phase: 03-dashboard-shell-account-identity
    provides: the normalize-then-upper-case header match discipline (identity.ts) and the `IngestClient` message dispatch 04-01 adds its delegation to
provides:
  - Pure civil-date arithmetic (daysFromCivil, civilFromDays, weekdayOfDay, isLeapYear, daysInMonth, daysInYear) with no Date constructor anywhere
  - The shared playtime contract (PLAYTIME_VERSION, HOUR_CELL_COUNT, DURATION_BIN_COUNT, DURATION_BIN_EDGES_SECONDS, MAX_SPLIT_VALUES, SPLIT_COLUMNS, HOUR_GRID_BASIS)
  - The playtime message contract: PlaytimeSlice, PlaytimeAggregates, PlaytimeSplit, PlaytimeView, playtime-query, playtime-result, playtime-error
  - Merge-aware playtime aggregation over Sessions.csv (parseSessionTimestamp, isSessionsRow, resolveSessionColumns, aggregateSlice, buildPlaytime, viewFromAggregates)
  - Persisted playtime aggregate on DatasetMeta, written in the same meta.put as the rows, with no Dexie version bump
  - A `playtime-query` answered from the stored aggregate by the import worker
  - PlaytimeClient and the top-of-#handle delegation in IngestClient
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12, 04-13]

actuals:
  tokens: 14348
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Aggregate-at-import, query-from-meta: every derived total is computed once in the worker and persisted on the single-key meta record, so no chart ever reads a row and no derived total ever rides the import result"
    - "Own-id-namespace delegation: a message family with its own correlation id is routed by a two-line branch at the top of the shared handler, before any state machine below it can see it"
    - "Versioned derived aggregate: a stored aggregate carries the rule version that produced it and is refused rather than cast when the version does not match"

key-files:
  created:
    - src/lib/civil-date.ts
    - src/lib/playtime-shared.ts
    - src/lib/worker/playtime.ts
    - src/lib/playtime-client.ts
  modified:
    - src/lib/types/worker-messages.ts
    - src/lib/worker/db.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/worker-client.svelte.ts
    - tests/unit/ingest-worker.test.ts

key-decisions:
  - "Hour-grid basis stays ONE constant: HOUR_GRID_BASIS in playtime-shared.ts holds the unresolved overlap-vs-start decision, and both grids are stored so flipping it is a constant change and never a re-import. Not resolved here — the UI-SPEC row is still open."
  - "The aggregate is persisted on the meta record and NOT on ClassifyResult, so IngestClient's deep $state proxy never wraps thousands of numbers and resultFromMeta stays untouched"
  - "The parseSessionTimestamp regex accepts an optional trailing Z but REJECTS a numeric offset, because an offset names an instant and D-01 rules instants out; such a row is excluded rather than converted"
  - "The four Sessions.csv columns are the only evidence in the repo (the synthetic fixture plus a schema note), and they are declared as such in the module header with plan 04-12 named as the real-export check"
  - "A playtime aggregation failure is caught, logged as the error object only, and the import finishes with no stored aggregate, so a playtime bug can never cost the user their import (T-04-03)"
  - "hourOverlap, hourStart and bins are created at their final length and left zero-filled in this plan, so 04-03 adds arithmetic rather than a second shape"

patterns-established:
  - "sessionsFileSeen is set per FILE, before the row loop: a header-only Sessions.csv parses to zero rows, so a flag set inside the loop would report a file that exists as an export that has none"
  - "Column resolution returns the ACTUAL key strings and values are read by direct property access on them, so a padded header works and no column beyond the named ones is ever touched"
  - "A late reply for an unmounted consumer is dropped on the floor, never thrown, which is what lets IngestClient delegate blindly on message type"
  - "RED-first per behaviour block, with every new module imported dynamically inside its test so a missing module is a per-test failure and never a whole-file crash"

requirements-completed: [ACTIVITY-01]

coverage:
  - id: D1
    description: "A Sessions.csv path runs end to end: aggregated in the import worker, persisted on the meta record, and answered by playtime-query with a header-only file told apart from a missing one"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#04-01 tracer: playtime-query round trip through the real worker"
        status: pass
    human_judgment: false
  - id: D2
    description: "The All slice is exact by hand arithmetic and Date.UTC: 3 usable, 2 excluded, 10800 merged seconds, dayIndex [d, d+1], daySeconds [7200, 3600], daySessions [2, 1], and 168/168/12 entries in the three arrays 04-03 fills"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#the All slice is exact: 3 usable, 2 excluded, 10800 merged seconds, two start days"
        status: pass
    human_judgment: false
  - id: D3
    description: "The aggregate is stored on the meta record at PLAYTIME_VERSION, carries no field named for the IP column, and never rides the import result"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#the meta record carries the aggregate at PLAYTIME_VERSION and never the IP (T-04-01)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A query before any import answers importedAt null and view null, so 'nothing imported' is not conflated with 'this export has no Sessions.csv'"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#a playtime-query before any import answers importedAt null and no view"
        status: pass
    human_judgment: false
  - id: D5
    description: "An export with no Sessions.csv answers no-session-file and a header-only Sessions.csv answers no-usable-sessions with excluded 0"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#an export with no Sessions.csv answers no-session-file, not no-usable-sessions"
        status: pass
    human_judgment: false
  - id: D6
    description: "PlaytimeClient resolves a query over the real worker and ignores a reply for an unknown queryId without throwing or settling the live query"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#04-01 client bridge: PlaytimeClient over the real worker"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Sessions.csv column names (SESSION_START, SESSION_END, SERVER_NAME, CLIENT_PLATFORM) are correct for a real WoT export"
    verification: []
    human_judgment: true
    rationale: "The only evidence in the repo is the synthetic fixture in tests/fixtures/export-fixtures.ts and a schema note in 04-RESEARCH.md A1. No real export has ever been read, so a differently-named real column would read as null and exclude every session rather than mis-bucket. A human must confirm this against a real export, which is exactly the review plan 04-12 schedules; 04-06 also chooses the split column against one."
  - id: D8
    description: "The hour-grid basis (overlap versus start) is the intended one"
    verification: []
    human_judgment: true
    rationale: "04-UI-SPEC carries this as an unresolved row and this plan was instructed to keep it a single declared constant rather than resolve it. Both grids are stored, so the decision is a constant change and never a re-import; HOUR_GRID_BASIS in src/lib/playtime-shared.ts holds it and 04-04, 04-05 and 04-09 read the constant instead of hard-coding a basis."

# Metrics
duration: 19min
completed: 2026-09-29
status: complete
---

# Phase 4 Plan 1: Playtime Foundation Summary

**The whole-dataset playtime aggregate now exists and is answered over one
`playtime-query` channel: a Sessions.csv is merged into per-day, per-hour and
per-duration buckets once at import, persisted on the dataset meta record, and
read back by a main-thread client that never touches a row.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-29T20:41Z
- **Completed:** 2026-09-29T20:59Z
- **Tasks:** 2
- **Files modified:** 9 in `src/` and `tests/`, plus one evidence record

## Accomplishments

- **One Sessions.csv path works end to end through the real worker.** A tracer
  export with five Sessions.csv rows — three usable, one end-before-start, one
  empty end, every row carrying the canary IP `192.0.2.99` — ingests, persists
  an aggregate, and answers `playtime-query` with `importedAt` equal to the
  `done` result's own `importedAt`. The numbers are hand arithmetic and
  `Date.UTC`, never the output of the code under test: A∪B merges to 7200 s on
  2020-06-01, C adds 3600 s on 2020-06-02, 10800 s total, 2 excluded.
- **The aggregate is stored once, on the meta record, and read with a
  single-key lookup.** No Dexie version was added and the `version(2)` upgrader
  is byte-identical, so an existing database simply reads the field as absent.
  The aggregate never rides `ClassifyResult`, which keeps it out of
  `IngestClient`'s deep `$state` proxy on every replay.
- **A missing Sessions.csv and a header-only one are two different
  statements.** `sessionsFileSeen` is set per file, BEFORE the row loop, so a
  file that parses to zero rows is reported as `no-usable-sessions` with
  `excluded: 0` rather than as an export with no Sessions.csv at all.
- **A playtime bug can never cost the user their import.** Aggregation runs in
  its own `try`/`catch`; on failure the worker logs the error object alone and
  finishes the import with no stored aggregate, which a later query reports as
  `playtime-error` rather than as zero playtime.
- **The chart-facing client is one small rune-free class plus a two-line
  delegation.** `PlaytimeClient` mints its own `queryId` namespace, so a chart
  query can never move the import state machine; the delegation is the FIRST
  branch of `IngestClient.#handle`, and the diff against `40ac5c2` is the
  import, the field, the constructor line and that branch — nothing else.

## Task Commits

Each task was committed atomically, RED before GREEN:

1. **Task 1: Tracer, one Sessions.csv path from the import worker through Dexie to a playtime-query answer**
   - `f727698` (test) — RED: 1 failed, 24 skipped of 25
   - `6c1d132` (feat) — GREEN
2. **Task 2: PlaytimeClient and the IngestClient delegation seam, proven over the real worker**
   - `3ecf77c` (test) — RED: 2 failed, 25 skipped of 27
   - `098e891` (feat) — GREEN

The `04-01-RED-EVIDENCE.json` record for Task 1 was committed with its RED
state (`f727698`).

### RED → GREEN evidence

| Commit | State |
|--------|-------|
| `f727698` | RED — `pnpm exec vitest run tests/unit/ingest-worker.test.ts -t "answers a playtime-query"` exits 1 with 1 failed, 24 skipped of 25. The named target test fails on the planned behaviour: `waitForMessageOfType('playtime-result'): timed out after 1500 ms. Calls so far: []`, because no playtime-result is ever posted. 25 tests were discovered and the single failure is that assertion — no syntax error, no fixture crash, no unrelated failure. |
| `6c1d132` | GREEN — 6 tracer tests pass, 25 in the file, 336 across 15 files. |
| `3ecf77c` | RED — `pnpm exec vitest run tests/unit/ingest-worker.test.ts -t "04-01 client bridge"` exits 1 with 2 failed, 25 skipped of 27, each failure `Cannot find module '/src/lib/playtime-client.ts'`. The whole file still discovers 27 tests, so the dynamic import kept this a per-test failure instead of a load crash. |
| `098e891` | GREEN — 2 bridge tests pass over the real worker; 98 across the worker and ingest-client files; 338 across 15 files. |

**Machine gate caveat, stated rather than hidden.** `node gsd-tools check
tdd-red-evidence 04-01-RED-EVIDENCE.json` returns `INVALID_RED` with reason
`zero_tests_discovered`. That is a runner-format limitation of the gate, not a
defect in the RED run: `bin/lib/tdd-red-evidence.cjs` parses node:test TAP
output (`# tests N` / `# pass N` / `# fail N` plus unindented `not ok N -
<name>` lines), and vitest 5's own `--reporter=tap` emits neither a `# tests`
summary nor unindented per-test `not ok` lines — every test is nested inside a
file-level `not ok 1 - tests/unit/ingest-worker.test.ts` group, which the
parser reads as a load-time crash. The record holds the real vitest output
verbatim rather than a reshaped one. Every substantive check the gate exists to
enforce is satisfied and independently verifiable: nonzero exit, more than zero
discovered tests, the distinctly-named target test failing, zero unrelated
failures, and a pre-implementation `test(04-01):` commit ahead of the
`feat(04-01):` commit. The git-log gate confirms it:

```
f727698 test(04-01): failing tracer for the playtime query round trip
3ecf77c test(04-01): failing bridge tests for PlaytimeClient over the real worker
```

## Files Created/Modified

- `src/lib/civil-date.ts` (new) — `daysFromCivil`, `civilFromDays`,
  `weekdayOfDay`, `isLeapYear`, `daysInMonth`, `daysInYear`. Hinnant's
  algorithms as pure integers, with a header explaining why no `Date`
  constructor appears (D-01: a zone-sensitive parse buckets the same export
  differently on two machines).
- `src/lib/playtime-shared.ts` (new) — `PLAYTIME_VERSION`, `HOUR_CELL_COUNT`,
  `DURATION_BIN_COUNT`, `DURATION_BIN_EDGES_SECONDS`, `MAX_SPLIT_VALUES`,
  `SPLIT_COLUMNS`, and the `HourGridBasis` type with `HOUR_GRID_BASIS` as the
  single switch for the open decision. Pure, because it is imported from both
  sides of the `postMessage` boundary.
- `src/lib/worker/playtime.ts` (new) — `SessionRow`, `parseSessionTimestamp`,
  `isSessionsRow`, `resolveSessionColumns`, `aggregateSlice`, `buildPlaytime`,
  `viewFromAggregates`. Anchored regex with no nested quantifiers, calendar
  fields range-checked so `2020-02-30` is null rather than rolling over, and a
  covered-until sweep so overlapping sessions sum to their union.
- `src/lib/playtime-client.ts` (new) — `PlaytimeClient`, `PlaytimeOutcome`,
  `PlaytimeResponse`. Rune-free and DOM-free, `post` injected.
- `src/lib/types/worker-messages.ts` — `PlaytimeSlice`, `PlaytimeAggregates`,
  `PlaytimeSplit`, `PlaytimeView`; the `playtime-query` request and the
  `playtime-result` / `playtime-error` replies in the existing NEW-comment
  style. No field in any of them is named for the IP column.
- `src/lib/worker/db.ts` — `DatasetMeta.playtime` with a doc-comment mirroring
  the `identity` one, and a sixth optional `writeDataset` parameter written in
  the same `meta.put`. No `this.version(` call added; the `version(2)` upgrade
  block is untouched.
- `src/lib/worker/ingest.worker.ts` — `handlePlaytimeQuery`, the per-file
  `sessionsFileSeen` flag, the session rows pushed by reference next to
  `allRows`, and the guarded `buildPlaytime` call. `resultFromMeta` and the
  `done` result are unchanged.
- `src/lib/worker-client.svelte.ts` — one `readonly playtime` field and the
  delegation as the first branch of `#handle`.
- `tests/unit/ingest-worker.test.ts` — two describes, eight named tests, all
  through the real worker and the real Dexie database.
- `.planning/phases/04-activity-time-dashboards/04-01-RED-EVIDENCE.json` (new)
  — the RED run record, committed with the RED state. Not in the plan's
  `files_modified`; flagged here because it is the only path this plan touched
  outside that list.

## Decisions Made

1. **`HOUR_GRID_BASIS` is one constant and stays unresolved.** `overlap` is the
   value; the doc-comment states the pending decision and that both grids are
   stored, so flipping it is a constant change and never a re-import. 04-04,
   04-05 and 04-09 read the constant. Resolving it unilaterally would have
   pre-empted the UI-SPEC row the plan explicitly left open.
2. **The aggregate lives on the meta record, not on `ClassifyResult`.** The
   plan prescribed this and the codebase bears it out: `IngestClient.result` is
   a deep `$state` proxy, so a few thousand numbers there would be walked on
   every replay.
3. **A numeric UTC offset in a timestamp is rejected, not converted.** D-01
   rules instants out, so `2020-06-01T12:00:00+02:00` excludes its row rather
   than silently shifting the hour bucket.
4. **The four Sessions.csv column names are declared assumptions, not facts.**
   The module header says so and names 04-12 as the real-export check, so a
   later plan cannot inherit them as though they had been verified.
5. **`hourOverlap`, `hourStart` and `bins` are created at final length and left
   zero-filled.** The plan places their arithmetic in 04-03; creating the shape
   here is what makes the stored aggregate final rather than provisional.
6. **`aggregateSlice` fills the day buckets but not the hour grids.** This
   follows the plan's action item 4, which deliberately differs from the
   `04-RESEARCH.md` "Code Examples" sketch — that sketch fills all three inline.
   The plan is the later, authoritative statement, and keeping the arithmetic in
   04-03 leaves one owner per array. See Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. Plan/research conflict — which arrays `aggregateSlice` fills**
- **Found during:** Task 1 (Tracer)
- **Issue:** `04-RESEARCH.md`'s Code Examples fill `hourOverlap`, `hourStart`
  and `bins` inside `aggregateSlice`, while the plan's action item 4 says
  `aggregateSlice` returns all three "as zero-filled length-168 / length-12
  arrays" and that "plan 04-03 fills those three arrays, so the stored shape is
  already final". Filling them now would have duplicated 04-03's work and left
  two owners for the same arrays.
- **Fix:** Followed the plan. `aggregateSlice` creates the three arrays at final
  length, zero-filled, and sums only `seconds`, `dayIndex`, `daySeconds` and
  `daySessions`. The tracer test pins their lengths so a later plan cannot
  silently reshape them.
- **Files modified:** `src/lib/worker/playtime.ts`,
  `tests/unit/ingest-worker.test.ts`
- **Verification:** the two green commits; `daySeconds`/`daySessions` are
  asserted against hand arithmetic, and the three zero-filled arrays are
  asserted at 168/168/12.
- **Committed in:** `6c1d132`

**2. Tooling — the RED-evidence gate cannot parse vitest output**
- **Found during:** Task 1 (RED)
- **Issue:** `check tdd-red-evidence` classifies a valid vitest RED as
  `INVALID_RED` / `zero_tests_discovered` because it parses node:test TAP only,
  and vitest 5's TAP reporter emits no `# tests` summary and indents every
  per-test line inside a file-level `not ok`.
- **Fix:** The record keeps the real output verbatim and carries a `gateNote`
  explaining the parser mismatch, rather than reshaping the output to make the
  gate pass. Nothing in the source was changed for this.
- **Files modified:** `.planning/phases/04-activity-time-dashboards/04-01-RED-EVIDENCE.json`
- **Verification:** the git-log RED gate
  (`git log -E --grep="^test\((0*4)-(0*1)\):"`) returns both RED commits.
- **Committed in:** `f727698`

**3. Type-only helper needed in the test file**
- **Found during:** Task 2 (GREEN)
- **Issue:** the bridge describe needed the playtime reply type for a helper's
  signature. Importing it from the client module at module scope would have
  broken the RED state that the dynamic import exists to protect.
- **Fix:** a local `type PlaytimeResponse = Extract<IngestResponse, { type:
  'playtime-result' | 'playtime-error' }>` derived from the already-imported
  `IngestResponse`, so it type-checks in the RED commit too.
- **Files modified:** `tests/unit/ingest-worker.test.ts`
- **Verification:** `pnpm run check` exits 0; the RED commit's whole file still
  discovers 27 tests.
- **Committed in:** `098e891`

---

**Total deviations:** 3 auto-fixed (1 plan-vs-research conflict resolved
toward the plan, 1 tooling limitation documented not worked around, 1 test
type-only helper)
**Impact on plan:** No scope creep. The first is a documented conflict inside
the plan's own inputs, resolved toward the plan; the second changes no source;
the third is a three-line type alias. Nothing was added to or dropped from the
plan's `files_modified` except the one evidence record, which is flagged above.

## Issues Encountered

- **`gsd-tools check tdd-red-evidence` returned `INVALID_RED` on a valid
  RED.** Investigated rather than accepted: the gate's parser
  (`bin/lib/tdd-red-evidence.cjs`, via `parseNodeTestSummary` and
  `tapFailedTestNames`) reads node:test TAP, and vitest 5's TAP reporter emits
  neither the `# tests`/`# pass`/`# fail` summary lines nor unindented `not ok`
  lines the regexes need. Resolved by persisting the honest record plus a note,
  and by verifying the same properties through the git-log gate. A follow-up
  worth filing against GSD itself: the evidence gate should understand vitest.
- **Two `svelte-check` errors in the new bridge test** (a `vi.fn()` spy is not
  callable per the type, and a widened `handle` parameter). Fixed by giving the
  spy a routing implementation instead of calling it, and by typing the
  helper's parameter as the derived `PlaytimeResponse`.
- **`eslint` flagged `isLeapYear` as an unused import** in
  `src/lib/worker/playtime.ts` — `daysInMonth` already covers the February case
  that needed it. The import was dropped; the plan asked for `daysInMonth` and
  `daysFromCivil` there, not for the leap helper.

## User Setup Required

None — no external service configuration required. No new dependency, no
environment variable, no schema migration.

## Next Phase Readiness

- **04-02 can wire the section.** `IngestClient.playtime` exists, resolves a
  promise, and never throws. The status flip, the Playtime block and the Phase 3
  test migration are all still 04-02's, as the plan intended.
- **04-03 owns the three zero-filled arrays.** `hourOverlap`, `hourStart` and
  `bins` exist at final length with correct indices, so 04-03 adds arithmetic
  (per RESEARCH Pattern 4 for the grids, `DURATION_BIN_EDGES_SECONDS` for the
  histogram) and nothing reshapes the stored record.
- **04-06 owns the split.** `buildPlaytime` returns `splitColumn: null` with
  empty `values` and `byValue`, `viewFromAggregates` already maps a non-null
  `valueIndex` onto `byValue`, and `SPLIT_COLUMNS` / `MAX_SPLIT_VALUES` are
  declared. `PLAYTIME_VERSION` is the hook the re-aggregate path keys on.
- **Two items a human still has to decide**, both carried deliberately rather
  than resolved here: the Sessions.csv column names (D7) and the hour-grid
  basis (D8). Neither blocks 04-02 through 04-11; both are reviewed against a
  real export in 04-12, which is also where the `HOUR_GRID_BASIS` flip becomes
  a one-line change if the answer differs.
- **Watch item for 04-03:** `hourOverlap` and `hourStart` are both stored but
  only one is read today. A reviewer may reasonably ask why two grids ship
  before a chart needs the second; the answer is in `playtime-shared.ts` and
  should survive into the plan that first reads each of them.

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-09-29*
