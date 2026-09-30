---
phase: 04-activity-time-dashboards
plan: 06
subsystem: database
tags: [dexie, indexeddb, web-worker, aggregation, d03, d02, backfill, vitest]

# Dependency graph
requires:
  - phase: 04-activity-time-dashboards
    provides: "04-01 the aggregate on the meta record and the playtime query seam; 04-03 aggregateSlice plus the seeded fixtures and independent oracle; 04-05 buildSplitTable and effectiveSelection; 04-07 the never-rejecting request seam"
provides:
  - "chooseSplit(sessions) — the first of SERVER_NAME then CLIENT_PLATFORM with 2 to 50 distinct usable values, or null"
  - "buildPlaytime fills splitColumn, values and byValue: one merged slice per split value, ranked by seconds"
  - "viewFromAggregates returns the slice it is showing and the index it actually applied"
  - "readSessionRowData() — one Dexie read transaction over meta and the Sessions rows together"
  - "writePlaytimeIfCurrent(importedAt, playtime) — a guarded single-field write-back"
  - "handlePlaytimeQuery rebuilds a legacy, stale or failed aggregate instead of refusing"
  - "PLATFORM_FALLBACK_SPEC and NO_SPLIT_SPEC — the two seeded fixtures that reach the fallback column and the null split"
affects: [04-08, 04-09, 04-10, 04-11, 04-12, 04-13, activity-time-dashboards]

# Actuals (#2632)
actuals:
  tokens: 18606
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One Map per split value, values and byValue as parallel arrays, selection by index (T-04-10)"
    - "A stale derived value is recomputed from its source, never cast (T-04-11, T-04-03)"
    - "The answer and the data it describes come from ONE Dexie snapshot"

key-files:
  created: []
  modified:
    - src/lib/worker/playtime.ts
    - src/lib/worker/db.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/types/worker-messages.ts
    - tests/fixtures/sessions-fixtures.ts
    - tests/unit/playtime.test.ts
    - tests/unit/db.test.ts
    - tests/unit/ingest-worker.test.ts

key-decisions:
  - "A blank split value is a real, selectable value that renders as (not recorded): it is stored as null, counted in chooseSplit as one value, and sorted last among ties"
  - "Per-value excluded counts come from the excluded rows CARRYING that value, so a value seen only on excluded rows is not a value and its rows count under All alone (RESEARCH A6)"
  - "view.selected is the APPLIED index rather than the requested one, so the UI cannot mark a value the view is not holding"
  - "A legacy cache with zero Sessions rows reports no-session-file; the exact answer comes only from a stored sessionsFileSeen"
  - "A refused write-back costs one recomputation; a mis-attached aggregate would cost the user their numbers, so the guard is the importedAt equality and the answer uses the snapshot's date"

patterns-established:
  - "Pattern: split values are trimmed to a string or null, never case-folded — folding would merge values the export never claimed were one"
  - "Pattern: order by seconds descending, then plain code-unit ascending, blank last — never localeCompare, whose result depends on the viewer's locale"

requirements-completed: [ACTIVITY-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A two-server Sessions.csv travels through the real worker to a per-value slice with merged seconds, session counts and per-value excluded counts"
    requirement: ACTIVITY-01
    verification:
      - kind: integration
        ref: "tests/unit/ingest-worker.test.ts#04-06 tracer: split by SERVER_NAME through the real worker"
        status: pass
    human_judgment: false
  - id: D2
    description: "The column-choice rule, value normalisation, ordering, cross-value non-additivity and the view's invalid-index fallback are pinned by a matrix with hostile values"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#chooseSplit rule matrix"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime.test.ts#split value handling"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime.test.ts#split slices and ordering"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime.test.ts#viewFromAggregates selection"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fixtures exist that force the CLIENT_PLATFORM fallback and the null split, and buildSplitTable and effectiveSelection get their first fixture-built coverage on both"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#04-06: a one-server, two-platform fixture forces the CLIENT_PLATFORM fallback"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime.test.ts#04-06: a one-server, one-platform fixture forces the null split"
        status: pass
    human_judgment: false
  - id: D4
    description: "Legacy, version-mismatched, null and failed aggregates are rebuilt from the stored rows in one atomic snapshot, written back only while the dataset is unchanged, and a failure reaches the playtime-error channel without touching the dataset"
    requirement: ACTIVITY-01
    verification:
      - kind: integration
        ref: "tests/unit/ingest-worker.test.ts#04-06 backfill: legacy, stale and failed playtime aggregates"
        status: pass
      - kind: unit
        ref: "tests/unit/db.test.ts#04-06 — readSessionRowData"
        status: pass
      - kind: unit
        ref: "tests/unit/db.test.ts#04-06 — writePlaytimeIfCurrent"
        status: pass
    human_judgment: false
  - id: D5
    description: "Whether the rule picks a sensible column on a REAL Wargaming export — the UI-SPEC's unresolved column-choice row, which this plan implements and unit-tests on constructed distributions only"
    verification: []
    human_judgment: true
    rationale: "The plan records this as a planner assumption: the real 2021 sample was not available to the research, and a synthetic fixture cannot say whether SERVER_NAME or CLIENT_PLATFORM is the column a user would call a game. The real-export check belongs to plan 04-12 and needs a human reading an actual export."

# Metrics
duration: 24min
completed: 2026-09-30
status: complete
---

# Phase 4 Plan 06: Split column rule, per-value slices, lazy backfill

**A two-server Sessions.csv now answers a per-value slice through the real worker, and every cache this app ever wrote — legacy, stale or failed — is rebuilt from its own rows without ever mis-attaching a dataset.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-30T06:48:41+04:00
- **Completed:** 2026-09-30T07:13:00+04:00
- **Tasks:** 3
- **Files modified:** 8 (6 in `files_modified`, 2 flagged below)

## Accomplishments

- `chooseSplit` implements the UI-SPEC rule: `SERVER_NAME` then `CLIENT_PLATFORM`, the first with 2 to `MAX_SPLIT_VALUES` distinct values among USABLE sessions, counting stopped the moment the cap is exceeded so a million-value column costs the same memory as a 51-value one.
- Every split value gets its own slice, merged among its own sessions (D-02), so per-value hours can add to more than All — asserted on a cross-value overlap case and cross-checked against the independent per-second oracle.
- A stale, null or absent aggregate is recomputed from the stored rows in one Dexie snapshot, written back only while the dataset is unchanged, and any failure reaches the `playtime-error` channel with the dataset untouched.
- The two seeded fixtures 04-03 and 04-05 both handed on — one server with two platforms, one server with one platform — now reach the `CLIENT_PLATFORM` fallback and the null split, giving `buildSplitTable` and `effectiveSelection` their first fixture-built coverage on both paths.

## Task Commits

1. **Task 1: Tracer, one two-server Sessions.csv through the real worker to a per-value slice** — `bedba21` (test, RED) then `b4c685a` (feat, GREEN)
2. **Task 2: Column-choice matrix, value handling, ordering, cross-value overlap and view fallback** — `9c4610c` (test only — see Deviations 3)
3. **Task 3: Lazy backfill with atomic snapshot, guarded write-back and the playtime-error channel** — `18920da` (test, RED) then `42e856f` (feat, GREEN)

**Plan metadata:** recorded in the commit below this file

## TDD Evidence

| Task | RED | GREEN |
|------|-----|-------|
| 1 | `4 failed / 9 passed / 21 skipped` — `view.split` null and `view.selected` null for every index, because 04-01's `buildPlaytime` stores no split | `13 passed` |
| 2 | `4 failed / 91 passed` — all four in the NEW tests, not in the shipped code (see Deviations) | `95 passed` |
| 3 | `15 failed / 48 passed` — eight `readSessionRowData is not a function` / `writePlaytimeIfCurrent is not a function`, six `waitForMessageOfType('playtime-result'): timed out after 1500 ms. Calls so far: ["playtime-error"]` | `158 passed` across the three files |

## Files Created/Modified

- `src/lib/worker/playtime.ts` — `SplitSession`, `chooseSplit`, `splitValue`, `compareSplitEntries`; `buildPlaytime` groups by value in a `Map` and ranks; `viewFromAggregates` validates and reports the applied index
- `src/lib/worker/db.ts` — `readSessionRowData` and `writePlaytimeIfCurrent`; no Dexie version added
- `src/lib/worker/ingest.worker.ts` — `handlePlaytimeQuery` backfills instead of refusing
- `src/lib/types/worker-messages.ts` — `PlaytimeView.selected` narrowed to `number | null` (deviation 1)
- `tests/fixtures/sessions-fixtures.ts` — `PLATFORM_FALLBACK_SPEC`, `NO_SPLIT_SPEC` (deviation 2)
- `tests/unit/playtime.test.ts` — the four matrix describes and the two fixture-driven describes
- `tests/unit/db.test.ts` — the backfill seam
- `tests/unit/ingest-worker.test.ts` — the split tracer and the backfill describe

## The column-choice rule as implemented

```
for column of ['SERVER_NAME', 'CLIENT_PLATFORM']:
    distinct = Set of that column's value over USABLE sessions,
               counting stopped once the size exceeds 50
    if 2 <= distinct.size <= 50: return column
return null
```

A value is a cell trimmed to a string, or null when the column is absent, the cell is missing, or the cell is whitespace. No case folding. `null` counts as one value, so "every row blank" is not a split and "one blank plus one server" is.

## How stale and failed aggregates rebuild, and how the tear is proven impossible

1. `checkCache` reads the meta record. A record whose `playtime` is present and at `PLAYTIME_VERSION` is answered straight off it — unchanged from 04-01.
2. Otherwise `readSessionRowData` runs ONE `db.transaction('r', db.rows, db.meta)`. Meta and rows are read inside it, so a replace cannot hand the backfill a new dataset's `importedAt` with the old dataset's rows. Rows are found by `orderBy('sourceFile').uniqueKeys()` plus one single-key `equals` per surviving key — never Dexie's multi-key form, which RESEARCH measured at 2,243 ms against 9 ms for the key listing — and then filtered through the same `isSessionsRow` the import path uses, so a nested `sub/Sessions.csv` and a `Logins.csv` are refused on both paths.
3. The answer carries the SNAPSHOT's `importedAt`, never the one `checkCache` read a moment earlier. That is the tear assertion: an answer whose date and numbers come from different reads cannot be constructed.
4. `writePlaytimeIfCurrent(snapshot.importedAt, rebuilt)` updates only the playtime field, and only while the stored record still carries that `importedAt` — asserted directly with a stale `importedAt` in `db.test.ts` (returns false, stored value untouched) and with a different `importedAt` in the worker suite's implicit path.
5. Any throw anywhere — a corrupt row, a failed read, a failed write — reaches the single catch and posts `playtime-error` with the request's own `queryId`. The test corrupts one row's stored `data` to `null`, then asserts: `playtime-error` posted, no message of type `error`, the row still there, and the meta record still carrying NO playtime at all. A partially written aggregate is worse than none, so there is none.
6. `sessionsFileSeen` on the backfill path is "did any row come back", which is why a legacy cache with zero Sessions rows reports `no-session-file` while a NEW header-only import still reports `no-usable-sessions`. Both directions are asserted, because the asymmetry is real and would otherwise look like a bug.

## The fixtures added for the two paths 04-03 handed over

`SCALE_5K_SPEC` has five server values and two platforms, so `splitColumn` always resolved to `SERVER_NAME` and neither other branch was ever driven by a seeded fixture — 04-05's split-table tests were built from hand-written inputs, which is the weaker kind of coverage because the numbers sit next to the code that produced them.

- `PLATFORM_FALLBACK_SPEC` — one server, two platforms, 240 sessions. `expected.splitColumn` is `CLIENT_PLATFORM`, and the test asserts the aggregator's `splitColumn`, `values`, per-value seconds, per-value sessions, per-value excluded counts and the All slice against that closed-form key. The same fixture then drives `buildSplitTable(split, selected)` on a real view and `effectiveSelection` against the fixture's real value count, including a replaced dataset and an index one past the end.
- `NO_SPLIT_SPEC` — one server, one platform. `splitColumn` is null, `values` and `byValue` are empty, and the All slice is still real. The view answers ready with `split: null` and `selected: null` for every index including `null`, and `buildSplitTable(null, …)` and `effectiveSelection(…, 0)` get their first fixture-built null-path coverage.

## Decisions Made

- **Values are trimmed, never case-folded.** `EU-1` and `eu-1` are two servers. Folding them would merge values the export never claimed were one, and the resulting order would depend on a rule no user can see.
- **A blank value is a real, selectable value.** It is stored as `null`, shown as `(not recorded)`, counted in `chooseSplit` as one value, and sorted last among ties so it never outranks a named server on equal playtime. A value that literally reads `(not recorded)` stays a different value from blank; `ui-copy` accepts that display collision and the stored values do not create it.
- **The stored order is a plain code-unit compare, never `localeCompare`.** A locale-aware comparison depends on the viewer's locale and would give two people different selector orders, different split tables and different index meanings for one export.
- **Selection is by index into a `Map`-grouped array.** A server genuinely named `__proto__` or `constructor` is a value like any other and writes nothing onto a prototype. Note the honest form of that test: `({}).__proto__` IS `Object.prototype` in plain JavaScript, so the assertion is that aggregating those values ADDED nothing to any prototype or object, and each of the three still gets its own correct 1,800-second slice.
- **A stale aggregate is recomputed, never cast.** A cache from before this build has no split in it and a cache whose aggregation threw has `playtime: null`; the rows are the dataset and the aggregate is a derived convenience over them, so refusing would show the user an error for data the app still holds.
- **Both hour bases survive the split.** `aggregateSlice` fills `hourOverlap` and `hourStart` for every slice, split or not, and `HOUR_GRID_BASIS` stays one unresolved constant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Contract conflict — required] `PlaytimeView.selected` narrowed from `PlaytimeSlice | null` to `number | null`**
- **Found during:** Task 1
- **Issue:** The plan's must-have says `viewFromAggregates` "reports the applied index in `selected`", Task 1's behaviour says "valueIndex 1 answers selected 1", and 04-08's plan reads `selected 1` and indexes `split.values[1]` to name the value. But plan 04-01 shipped the type as `selected: PlaytimeSlice | null`, and it predates 04-05, whose `buildSplitTable(split, selected: number | null)` also takes an index. Keeping the slice form would have made the selected value unnameable, so 04-08 could not have read it.
- **Fix:** Changed the field's type in `src/lib/types/worker-messages.ts`. No field was added, removed or renamed, and nothing in `src/` or `tests/` read the old form — the only reference was `playtime-client.test.ts`'s stub `selected: null`, which satisfies both.
- **Files modified:** `src/lib/types/worker-messages.ts` — **outside the plan's `files_modified`**, flagged here and in the return report
- **Verification:** `pnpm run check` clean; the 04-01 tracer, the 04-05 model tests and the whole suite pass
- **Committed in:** `b4c685a`

**2. [Scope handed on by 04-03 and 04-05] Two fixture specs added to `tests/fixtures/sessions-fixtures.ts`**
- **Found during:** Task 2
- **Issue:** The plan's `files_modified` does not list the fixture file, and its Task 2 says to build session inputs "through a small local helper". 04-03's summary and 04-05's both record a gap they explicitly handed to this plan: no seeded fixture forces the `CLIENT_PLATFORM` fallback or a null split, which is why `buildSplitTable` and `effectiveSelection` had only hand-built coverage.
- **Fix:** Added `PLATFORM_FALLBACK_SPEC` and `NO_SPLIT_SPEC` and used them. The hand-built matrix in Task 2 is still there, because the 50-versus-51 boundary, `__proto__` and cross-value overlap are properties no fixture can be asked to produce.
- **Files modified:** `tests/fixtures/sessions-fixtures.ts` — **outside the plan's `files_modified`**, flagged here and in the return report
- **Verification:** both specs' `expected` keys are asserted against the aggregator field for field
- **Committed in:** `9c4610c`

**3. [Expectation defects in the new tests] Task 2's RED produced no implementation gap**
- **Found during:** Task 2
- **Issue:** The plan predicted this RED phase would expose gaps such as the 50/51 boundary, trimming, null ordering or the invalid-index fallback. It did not: Task 1's tracer path had already implemented the whole rule. The first run was `4 failed / 91 passed` and every failure was a defect in the newly written test — `allSeconds` written as 9,000 when the two sessions do not overlap and All is 8,100; a VALID index listed among the invalid ones in an `it.each`; the impossible `({}).__proto__ === undefined` assertion described above; and a JSON match count of 4 where the answer is 2.
- **Fix:** Corrected the four expectations. **No source file changed in Task 2**, which makes it a test-only commit under the tdd.md exemption rather than a RED/GREEN pair.
- **Files modified:** `tests/unit/playtime.test.ts`
- **Committed in:** `9c4610c`

**4. [Acceptance criterion impossible as written] `grep -c "anyOf" src/lib/worker/db.ts` counts prose**
- **Found during:** Task 3
- **Issue:** The criterion requires the count to print 0, and my explanatory comment named the Dexie method it warns against, so it printed 2.
- **Fix:** Reworded the comment to "Dexie's multi-key `where('sourceFile')` form — the one that takes a LIST of keys in a single call". The measured figure and the reason are kept; the token is not. The criterion now prints 0, as written.
- **Files modified:** `src/lib/worker/db.ts`
- **Committed in:** `42e856f`

**5. [Stale reference] The plan's diff checks name base commit `40ac5c2`**
- **Found during:** Task 3
- **Issue:** `40ac5c2` predates the plans 04-04, 04-05 and 04-07 that this wave executed, so diffing against it would sweep their commits in.
- **Fix:** Ran the same checks against the actual pre-plan HEAD, `95d7680`. Results: no added line calling `this.version(` in `db.ts`; the `version(2)` upgrade block byte-identical; `resultFromMeta` holds no playtime reference; `git diff --quiet 95d7680 -- package.json pnpm-lock.yaml` exits 0.
- **Committed in:** n/a (no code change)

---

**6. [Commit hygiene] The Task 3 GREEN commit was first committed with one test still red**
- **Found during:** final verification
- **Issue:** the legacy-cache test read the view BEFORE the backfill with `valueIndex: null` and AFTER it with `0`, so it compared an All view against an eu-1 view. The suite was green at HEAD, but `42e856f`'s own tree was not, and a RED tree under a `feat(04-06):` scope is exactly what a reviewer scanning commit-by-commit would read as a lie.
- **Fix:** `git commit --fixup=893610a` plus `git rebase --autosquash 95d7680`, with normal hooks throughout. Every commit in the plan now passes `pnpm run test:unit` at its own tree except the two intentional RED commits: `bedba21` (4 failed | 581 passed) and `18920da` (15 failed | 618 passed). The shas below are post-rebase.
- **Files modified:** `tests/unit/ingest-worker.test.ts`
- **Committed in:** `42e856f` (amended)
**Impact on plan:** No scope creep. Two files outside `files_modified` were required — one by a direct type conflict between this plan and 04-05/04-08, one by the gap 04-03 and 04-05 both handed over. No behaviour was dropped or deferred.

## Open Question Flagged for 04-08 — the blank value in the view

`PlaytimeSplit.values[].value` is declared `string`, and 04-01's `viewFromAggregates` maps a stored `null` to `''`. This plan kept that mapping, because the plan's own "Artifacts" section says the viewed shape is exactly what 04-01 declared and that this plan adds no field. But `ui-copy`'s `formatSplitValue(value: string | null)` returns `(not recorded)` only for `null`, and 04-08's plan says each selector option is "labelled by formatSplitValue" and that a null value "reads Showing (not recorded)". **If 04-08 passes `entry.value` straight to `formatSplitValue`, a blank server name will render as an empty cell, not as `(not recorded)`.** 04-08 must either map `''` to `null` at the boundary or this plan's mapping must change. Flagged, not decided here — changing `PlaytimeSplit.values[].value` to `string | null` is a second field-type change in the same file as deviation 1 and belongs to whoever renders the value.

## Issues Encountered

- Two acceptance-criterion greps needed scoped equivalents and are recorded above (`anyOf`, `localeCompare` — the latter prints 0 as written because the comment never used the token).
- The 04-06 tracer fixture is built with `buildSessionsExportFromCsv`, which zips a Sessions.csv into an otherwise EMPTY export rather than the 04-01 `buildCustomExport` overlay. That is what the plan asked for and it works end to end: the classifier finds the account root and the Activity_history folder, and the identity extraction simply yields nothing.

## User Setup Required

None — no external service configuration required.

## Verification

```
pnpm run test:unit                                          633 passed (19 files, 1.4s)
pnpm run check                                              0 errors, 0 warnings (3 projects)
pnpm run lint                                               clean
pnpm run build                                              built
pnpm exec playwright test                                    86 passed (39.8s)
grep -c "anyOf" src/lib/worker/db.ts                        0
grep -v '^\s*\(//\|\*\|/\*\)' … | grep -c "localeCompare"    0
added lines calling this.version( in db.ts since 95d7680     0
playtime references inside resultFromMeta                   0
git diff --quiet 95d7680 -- package.json pnpm-lock.yaml     0
```

## Next Phase Readiness

- 04-08 has everything it reads: `view.split` with the column, the ordered `{ value, seconds }` list and `allSeconds`; `view.selected` as the applied index; `view.slice` as the slice to render. The one thing it must decide is the blank-value rendering described above.
- 04-11, 04-12 and 04-13 can drive the same fixtures. `PLATFORM_FALLBACK_SPEC` and `NO_SPLIT_SPEC` are single-year and 240 sessions, so they are cheap in a browser test and their answer keys are already asserted.
- The backfill means an aggregate-shape change is now a `PLAYTIME_VERSION` bump plus nothing else: no Dexie version, no re-import, no migration. That was the point of the path.
- 04-12's human real-export check is still open — the rule is implemented and unit-tested, and whether it picks a sensible column on a real Wargaming export is unverified (coverage D5).

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-09-30*
