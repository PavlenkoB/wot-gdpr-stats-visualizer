---
phase: 06-login-ip-history-offline-geolocation
plan: 05
subsystem: worker/ingest
tags: [dexie, worker, csv, privacy, ip, aggregation, tdd]

requires:
  - phase: 04-activity-time-dashboards
    provides: "the per-game session-file predicates (sessionFileGame, isSessionsRow, isLegacySessionsFileName) and the one-transaction readSessionRowData the login reader is a sibling of"
  - phase: 06-login-ip-history-offline-geolocation (06-01)
    provides: "buildLogins with its LoginSource.kind union, the stored `logins` aggregate on the meta record, writeLoginsIfCurrent, and the version+geo staleness rule"
  - phase: 03-dashboard-shell-account-identity
    provides: "sanitizeUserInfoRow's D-18 drop list, extractIdentity's row choice, and the three-field identity header 06-05 must not widen"
provides:
  - "isLoginsRow / isLoginsFileName — the screen that keeps an invented Logins.csv out of the playtime path and inside the login one"
  - "extractAccountRecord — the D-02 Account record read from the already-sanitised pool, with readable / unreadable / blank as three facts"
  - "readLoginRowData — the one-transaction reader that returns every login source, the account pool and the account root"
  - "a rebuild that is deep-equal to the import-time aggregate, for an export holding session files, a Logins.csv and an Account_Info row"
  - "the merged-source fixtures (buildLoginsMergedExport, buildLoginsCsvOnlyExport, buildHeaderOnlyLoginsExport, buildLoginsMinimalColumnsExport)"
affects: [06-06, 06-07, 06-10, playtime, db]

actuals:
  tokens: 20093
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "A reader whose NAME-ONLY index screen cannot know a folder is a SIBLING of the playtime reader, not a widening of it: three screens and two return shapes are not yet a shared abstraction."
    - "A row choice stated twice on purpose: the identity pick and the account-record pick are the same rule in two functions, so neither privacy guarantee can reach the other through a refactor."

key-files:
  created:
    - tests/unit/import/logins-sources.test.ts
  modified:
    - src/lib/features/logins/login-aggregate.ts
    - src/lib/worker/identity.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/worker/db.ts
    - tests/fixtures/logins-fixtures.ts
    - tests/unit/import/logins-backfill.test.ts
    - tests/unit/import/logins-worker.test.ts
    - tests/unit/shell/identity.test.ts

key-decisions:
  - "The `Logins.csv` is a THIRD source kind with its own predicate, not a third shape `isSessionsRow` accepts — the playtime module states that the IP column is never read and its tests assert it (T-04-01), so one predicate cannot answer for both aggregators."
  - "The row choice in `extractAccountRecord` is re-stated rather than extracted, leaving `extractIdentity` byte-identical. The plan's own acceptance criterion (`git diff -U0` shows no deleted line in identity.ts) is the machine form of the reason: a shared chooser would let a change to one privacy guarantee reach the other."
  - "`readLoginRowData` is a SIBLING of `readSessionRowData`, not a generalisation of it. Widening the playtime screen would hand every playtime rebuild a file it has no rule for."
  - "The reader returns the account pool RAW and the worker builds the record with the same `extractAccountRecord` the import used, so the row choice and the three address states are computed by one function rather than two."
  - "The shared rows array is filled for `isSessions || isLoginsFile`; the push into each COLLECTION is what decides who may read it. Filling it only for session files hands the login aggregator an empty source that still reports itself as seen."

patterns-established:
  - "A missing PUSH is invisible to a unit test of the thing being pushed to: `buildLogins` already accepted kind `logins` and 06-01's tests proved it, so the merge needed a tracer through the real worker, a real zip and the real Dexie."
  - "A rebuild's test is an EQUALITY between the import-time answer and the rebuilt one, not a spot check — a reader that silently drops a source is otherwise invisible, because both answers are `ready`."

requirements-completed: [ACTIVITY-05]

coverage:
  - id: D1
    description: "A Logins.csv merges into the login history beside the per-game session files: its rows are counted, its address carries no game token, and a shared address has its logins added and its games unioned (D-01)"
    requirement: ACTIVITY-05
    verification:
      - kind: integration
        ref: "tests/unit/import/logins-sources.test.ts#06-05: a Logins.csv merges into the login history beside the session files (D-01)"
        status: pass
      - kind: unit
        ref: "tests/unit/import/logins-backfill.test.ts#06-05: a rebuild reads every source the import used (RESEARCH Pitfall 10)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Account_Info row becomes one labelled Account record read from the sanitised pool, counted in no total, no country figure and no address row (D-02)"
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/shell/identity.test.ts#extractAccountRecord — the three address states"
        status: pass
      - kind: integration
        ref: "tests/unit/import/logins-sources.test.ts#06-05: the Account_Info row is one labelled record and never a login (D-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The lazy backfill reads every source the import used from ONE snapshot, so a rebuilt aggregate is deep-equal to the import-time one and can never receive a replaced dataset's rows (T-06-21)"
    requirement: ACTIVITY-05
    verification:
      - kind: integration
        ref: "tests/unit/import/logins-backfill.test.ts#answers the import-time view exactly, for a three-source export"
        status: pass
      - kind: integration
        ref: "tests/unit/import/logins-backfill.test.ts#answers with the SNAPSHOT’s importedAt, not the one read a moment earlier (T-06-21)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The privacy boundary holds by value: no LOGIN email, birth date or Papa-overflow canary reaches the stored record, the stored rows or any posted message, and a Logins.csv's USER_AGENT and COUNTRY_CODE are never read (T-06-19, T-06-20)"
    requirement: ACTIVITY-05
    verification:
      - kind: integration
        ref: "tests/unit/import/logins-sources.test.ts#06-05: nothing but the Account record escapes from User_Info"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two emptiness sentences stay two: a header-only session file and a header-only Logins.csv give filesSeen both true and status no-usable, never no-source"
    requirement: ACTIVITY-05
    verification:
      - kind: integration
        ref: "tests/unit/import/logins-sources.test.ts#a header-only session file and a header-only Logins.csv are `no-usable`, not `no-source`"
        status: pass
    human_judgment: false
  - id: D6
    description: "A hash-identical re-drop answers duplicate, parses nothing a second time and leaves the stored aggregate untouched"
    requirement: ACTIVITY-05
    verification:
      - kind: integration
        ref: "tests/unit/import/logins-sources.test.ts#a hash-identical re-drop answers duplicate and parses nothing twice"
        status: pass
    human_judgment: false
  - id: D7
    description: "The playtime path is untouched: readSessionRowData is byte-identical, the playtime module is not edited, and the playtime suite passes unmodified"
    verification:
      - kind: other
        ref: "git diff main...HEAD -- src/lib/features/playtime (empty) and git diff -U0 7c36262..HEAD -- src/lib/worker/db.ts (no deleted line)"
        status: pass
    human_judgment: false

# Metrics
duration: 23min
started: 2026-10-03T16:46:50Z
completed: 2026-10-03T17:10:08Z
commits: 5
plan_head_before: 7c36262ad6d92f963c9181e83e1b6839730a14e7
plan_head_after: b150c5dfc9dcafee2bfce7c8b474c843fe6c762e
status: complete
---

# Phase 06 Plan 05: Worker-side source merge and rebuild equality

**A `Logins.csv` merges into the login history beside the per-game session files, `Account_Info.csv` becomes one labelled Account record read from the already-sanitised pool, and a lazy rebuild from stored rows is deep-equal to the import-time aggregate for the first time.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-10-03T16:46:50Z
- **Completed:** 2026-10-03T17:10:08Z
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files modified:** 9 (+1451 / -16)
- **Unit suite:** 1849 passed / 58 files, from 1837 at plan start (+12 net after the fixtures moved between files)

## Accomplishments

- **`isLoginsRow` / `isLoginsFileName`** screen the invented `Logins.csv` out of the playtime path and into the login one, on the same two comparisons `isSessionsRow` uses (folder case-insensitive, basename only). The parse loop pushes it as a third `LoginSource` kind before its row loop, sharing the same `rows` array, with `game: null` so it contributes no title token.
- **`extractAccountRecord`** reads `IP`, `COUNTRY_CODE` and `CITY` from the same already-sanitised pool and with the same row choice `extractIdentity` uses, canonicalises the address through `parseIp`, and keeps `readable` / `unreadable` / `blank` as three distinct facts. `extractIdentity`, `sanitizeUserInfoRow` and `DROPPED_COLUMN` are byte-identical.
- **`readLoginRowData`** returns every login source, the account pool and the account root from ONE read transaction with the meta record's `importedAt`, so `answerLogins` rebuilds an aggregate equal to the import-time one instead of one missing a whole source.
- **The privacy boundary is now asserted by value on both sides** — the canaries absent, the Account record's own three cells present — over the stored meta record, every stored row and every posted message.

## Task Commits

1. **Task 1: Tracer — a Logins.csv row and an Account_Info record reach the logins view** — `81ad97f` (feat)
2. **Task 2: One-snapshot reader for every source, and rebuild equals import (RED)** — `46e601e` (test)
3. **Task 2: One-snapshot reader for every source, and rebuild equals import (GREEN)** — `b73be72` (feat)
4. **Task 3: Privacy and counting-rule regression across sources** — `b150c5d` (test)

**Plan metadata:** the docs commit that follows `b150c5d` (docs: complete plan)

_`plan_head_after` is the head of the plan's IMPLEMENTATION work. It cannot be the head including this commit without being self-referential, so `commits: 5` is the MEASURED count over `plan_head_before..HEAD` — four task commits plus this one — and `git rev-list --count 7c36262..HEAD` is the instrument to re-derive it._

## Files Created/Modified

- `src/lib/features/logins/login-aggregate.ts` — `isLoginsRow` and its name-only sibling `isLoginsFileName`, plus the two constants the file name and folder are spelled in
- `src/lib/worker/identity.ts` — `extractAccountRecord`, `cutText`; nothing else touched
- `src/lib/worker/ingest.worker.ts` — the `Logins.csv` push, the shared `rows` fill, the Account record, and `answerLogins` rebuilding through `readLoginRowData`
- `src/lib/worker/db.ts` — `readLoginRowData` beside `readSessionRowData`
- `tests/fixtures/logins-fixtures.ts` — the merged-source archive family and its canaries
- `tests/unit/import/logins-sources.test.ts` — new; 15 cases over the merge, the column boundary, the Account record, the privacy sweep, the counting rules and the duplicate re-drop
- `tests/unit/import/logins-backfill.test.ts` — 6 new cases; the reader is compared against the playtime reader
- `tests/unit/import/logins-worker.test.ts` — one expected value extended with the Account record (deviation 2)
- `tests/unit/shell/identity.test.ts` — 13 new cases for `extractAccountRecord`

## Decisions Made

1. **The `Logins.csv` gets its own predicate rather than a third shape `isSessionsRow` accepts.** `playtime-aggregate.ts` states that the `IP` column is never read and three `playtime.test.ts` cases assert it; one predicate answering for both aggregators would put a login file into every playtime rebuild.
2. **The row choice is stated twice, deliberately.** The plan's acceptance criterion — `git diff -U0` on `identity.ts` shows no deleted line — is the machine form of the reason. A shared private chooser would have been tidier and would have let a change to the identity pick reach the account record.
3. **`readLoginRowData` is a sibling, not a generalisation.** Three screens and two return shapes are not yet a shared abstraction, and a helper both readers call would exist only to have two callers whose rules have to differ. The shared machinery (index walk, single-key reads, per-category-and-file grouping) is re-used by construction.
4. **The account pool travels RAW.** The reader does not build the record, so the row choice and the three address states are computed by `extractAccountRecord` in both paths rather than by two functions that could disagree — and there is no second filter here that could drift from the D-18 strip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The shared `rows` array was filled only for session files, so the `Logins.csv` source was pushed empty**
- **Found during:** Task 1 (tracer)
- **Issue:** The parse loop did `if (isSessions) rows.push(data)`, so a `Logins.csv` source was pushed BEFORE the loop and then never received a row. The failure is quiet in the worst way: `filesSeen.logins` was true, so the export answered `no-usable` with zero unreadable rows — a sentence that is true of neither shape.
- **Fix:** `if (isSessions || isLoginsFile) rows.push(data)`. Which collector a source is pushed into is what decides who may read the array, not whether the array is filled.
- **Files modified:** `src/lib/worker/ingest.worker.ts`
- **Verification:** the tracer's `filesWithRows === 3` and `totalLogins === 9` assertions, and the Logins.csv-only `ready` case
- **Committed in:** `81ad97f`

**2. [Rule 1 - Bug] `logins-worker.test.ts` built its expected aggregate without the Account record**
- **Found during:** Task 1 (tracer), full-suite run
- **Issue:** 06-01's last case calls `buildLogins` with two arguments over the hand export, which still contains the sample's `Account_Info.csv`. The stored aggregate now carries the record, so the two stopped matching. The file is not in the plan's `files_modified`; the case asserts the WORKER's wiring, and the wiring now passes a third argument.
- **Fix:** the expected call passes the record the same sanitised pool produces, with a comment naming why the record is part of the expected value rather than excluded from the comparison.
- **Files modified:** `tests/unit/import/logins-worker.test.ts`
- **Verification:** the case passes; the assertion is unchanged in strength (it still compares the whole stored aggregate against a production-built one)
- **Committed in:** `81ad97f`

**3. [Rule 1 - Bug] `logins-backfill.test.ts` was red between Task 1 and Task 2**
- **Found during:** Task 1, full-suite run
- **Issue:** 06-01's rebuild path re-typed every stored source as `kind: 'sessions'` and passed no account, so a rebuild answered a smaller aggregate than the import did. That is precisely the plan's own idempotency must-have, and it is a real property — not a test artefact.
- **Fix:** Task 2's `readLoginRowData` and `answerLogins` rewire. Recorded here because the Task 1 commit is transiently red on one case, and a reader bisecting the branch will meet it.
- **Files modified:** `src/lib/worker/db.ts`, `src/lib/worker/ingest.worker.ts`
- **Verification:** the case is green from `b73be72` onward
- **Committed in:** `b73be72`

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs; 0 Rule 2, 0 Rule 3, 0 Rule 4)
**Impact on plan:** All three are the same class — a wiring gap between a new producer and an existing consumer. No scope creep; no product decision was made or revisited.

## Issues Encountered

- **TDD RED for Task 3 had to be demonstrated by mutation, not by an empty implementation.** Task 3's subject is regression coverage for behaviour Tasks 1 and 2 had already built, so there was no state in which the tests could fail for the right reason. Two mutations were applied and reverted, and both produced named REDs:
  - `extractAccountRecord` storing the raw unreadable cell instead of `null` → **3 failures** (`a non-blank cell that does not parse is UNREADABLE and is never stored as text`, `an unreadable address leaves the country and city readable`, `an unreadable Account address is a fact, not text, and changes no total`).
  - `resolveLoginColumns` resolving `COUNTRY_CODE` as a third login column and preferring it over the lookup → **4 failures**, including both T-06-20 cases.

  This is the plan's own framing ("tests that fail loudly when any change widens what is read"), and the mutations are exactly the two widenings the threat register names. The commit message records the counts.
- **`gsd-tools check tdd-red-evidence` still cannot classify a vitest RED** (recorded in STATE.md from 04-01): it parses node:test TAP. The machine check that works here is the git-log RED gate, and Task 2's RED is a separate `test(06-05):` commit ahead of its `feat(06-05):`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **06-06 (the country table)** can wire `lookupCountry` as planned: the `(v, geo)` invalidation pair 06-01 built is what will trigger a rebuild, and the rebuild now reads every source, so the rebuilt aggregate will be equal to a fresh import.
- **06-07+ (the UI)** has an `account` field on the ready view to render, with `ip` non-null exactly when `ipState === 'readable'`, and an address it must follow the D-06 mask with. `import-flow.spec.ts:533`'s `not.toContain('192.0.2.10')` is unaffected here because nothing in this plan renders.
- **The multi-file note** the block needs has its input: `filesWithRows` is 3 for two session files plus a `Logins.csv`, and `filesSeen` is stored per kind.
- **Unchanged and worth stating once:** `git diff main...HEAD -- src/lib/features/playtime` is empty and `git diff -U0 7c36262..HEAD -- src/lib/worker/db.ts` shows no deleted line, so the playtime backfill is byte-identical.

## Self-Check: PASSED

- Every file named in the plan's Artifacts table exists on disk, and each of the three promised exports (`isLoginsRow`, `extractAccountRecord`, `readLoginRowData`) is present in the file the table names.
- All five commits (`81ad97f`, `46e601e`, `b73be72`, `b150c5d`, `1585ff9`) are reachable from `--all`.
- Measured, not narrated: `pnpm run test:unit` 1849 passed / 58 files; `pnpm run check` clean; `pnpm run lint` clean.
- `git diff main...HEAD -- src/lib/features/playtime` is empty; `git diff -U0 7c36262..HEAD -- src/lib/worker/identity.ts` and the same for `db.ts` contain no deleted line, which is the machine form of "extractIdentity and readSessionRowData are unchanged".
- No stubs, skipped tests or unrun verifies were introduced. The broken-windows ledger could not be appended to — `.planning/WINDOWS.md` rows 8 and 9 still disagree with the fenced JSON, the pre-existing Phase 5 corruption already recorded in STATE.md — so nothing is lost: this plan introduced nothing that needed recording there.

---
*Phase: 06-login-ip-history-offline-geolocation*
*Completed: 2026-10-03*
