---
phase: 12-account-timeline-perks
plan: 11
subsystem: data
tags: [account-timeline, builder, worker-channel, shell-model, merge, sort, fixtures]
status: complete

requires:
  - phase: 12-05
    provides: "timeline-shared.ts contract (kinds, files, TimelineView) and the tolerant instant parse with its total comparator"
  - phase: 12-06
    provides: "the exported cellOf with the address and code kinds"
  - phase: 12-08
    provides: "the five timeline specs, the real file keys and the email guard"
  - phase: 12-10
    provides: "mergeIdenticalAcrossAccounts / flattenGroups in use, and the perks fixture and worker test as the model"
provides:
  - "TIMELINE_ENTRY_MAP: per-file date, date shape, primary, secondary, language, country and discriminator columns, transcribed from the capture"
  - "buildTimelineView: kind mapping, language/country split, cross-account merge of services and language/country, newest-first total order, per-file four-state"
  - "the field-less account-timeline channel and RowsSnapshot.accounts (the stored account order)"
  - "account-timeline as the fourth NEW_DATA_PANE_ID / fifth optional pane: PANE_ORDER above Account, title, row summary, provenance label"
  - "tests/fixtures/timeline-fixtures.ts: a three-account archive and the hand-derived TL_EXPECTED oracle"
affects: [12-12, 12-13]

actuals:
  tokens: 25300
  tasks: 3
  commits: 3
commits: 3
plan_head_before: ad27fca8ad8c5b169cb8735dd3e61abc8f9d3d6b
plan_head_after: cd0c827b7d57efe5ce66d093ddfaf8c672aa6cd4

tech-stack:
  added: []
  patterns:
    - "A pure builder takes an injectable entry map (default TIMELINE_ENTRY_MAP) so a shape the capture does not have is testable without a second spec"
    - "An oracle built by filtering hand-typed literal entries by mapped file, so a removed kind shrinks every list, count and chip total by construction"

key-files:
  created:
    - src/lib/features/account-timeline/timeline-aggregate.ts
    - tests/fixtures/timeline-fixtures.ts
    - tests/unit/account-timeline/timeline-aggregate.test.ts
    - tests/unit/account-timeline/timeline-mapping.test.ts
    - tests/unit/import/account-timeline-worker.test.ts
  modified:
    - src/lib/features/account-timeline/timeline-shared.ts
    - src/lib/features/account-timeline/timeline-instant.ts
    - src/lib/features/new-data/new-data-shared.ts
    - src/lib/worker/data-queries.ts
    - src/lib/worker/db.ts
    - src/lib/core/types/worker-messages.ts
    - src/lib/shell/selection-state.ts
    - src/lib/ui-copy.ts
    - tests/unit/import/data-query-worker.test.ts
    - tests/unit/import/new-data-facts.test.ts
    - tests/unit/shell/selection-state.test.ts
    - tests/unit/shell/list-pane-optional.test.ts
    - tests/unit/shell/overview-model.test.ts
    - tests/unit/shell/ui-copy.test.ts

key-decisions:
  - "Language_And_Country_History is read through its discriminator: NAME says whether VALUE is a language or a country, so a row yields one entry (the VALUE as the primary part, the OPERATION as the secondary). The builder also supports two separate columns (one entry per value present) behind the injectable map"
  - "The NAME discriminator is matched tolerantly (text containing lang or countr, not both); a value it cannot place yields no entry rather than a guess"
  - "No instant widening: every timeline date column is YYYY-MM-DD HH:MM:SS.mmm, the parser's shape 1; a mapping test fails by file, column and shape if a future capture records another"
  - "A date cell equal to the export's null marker (backslash N) is read as no date, so it can never display as a date string"
  - "The merged-away count is rows removed by the merge (Map pass over the whole spec column list), never entries"

patterns-established:
  - "Sorting and merging live in the worker builder once; the pane draws the posted order, which is identical for plain and windowed tables"
  - "accountOrder is an argument of the builder, read from RowsSnapshot.accounts, so the tie-break by identity-header position needs no second read"

requirements-completed: [TIMELINE-01, TIMELINE-02, PRIV-01, SCALE-01]

duration: 24min
completed: 2026-10-20
---

# Phase 12 Plan 11: Account timeline builder, channel and shell registration Summary

**One merged, newest-first chronology across the five history files (name, services, language and country, bans, third parties) is built on the worker behind a strict field-less `account-timeline` channel, and the pane exists in the shell model as the fifth optional pane directly above Account, proved through the real worker on a three-account archive with a hand-derived oracle.**

## Performance

- **Duration:** 24 min
- **Tasks:** 3
- **Files:** 19 (5 created, 14 modified)

## Accomplishments

- `timeline-shared.ts`: `TIMELINE_ENTRY_MAP` transcribed from the Pane mapping of 12-HEADERS.md (spec column ids, with the recorded date shape beside each date column).
- `timeline-aggregate.ts`: `buildTimelineView(inputs, fileKeys, accountOrder, entryMap?)`. Reads every cell through the spec's constant column ids with `cellOf` and the spec column's kind (never a row's own keys), merges services and language/country across accounts with `mergeIdenticalAcrossAccounts` over the whole spec column list, flattens the other three files, sorts once with `compareTimelineKeys`, and reports ready / not-in-export / no-rows / skipped per file. No `console.` call, no `new Date`.
- The `account-timeline` channel: `TIMELINE_FILE_KEYS` in the import-free shared contract, an entry in `DATA_FILES` (user_info, bans, authorized_third_parties), `DataQuery` / `DataResult` members, the `answerDataQuery` case, and `RowsSnapshot.accounts` filled from `accountsOfMeta`. `isDataQuery` rejects any extra field with the fixed `invalid query` detail. `db.verno` is unchanged (read-time field).
- Shell registration: `NEW_DATA_PANE_IDS` gains `account-timeline`, its file list is computed from `TIMELINE_FILE_KEYS`, `PANE_ORDER` is the thirteen-entry tuple with the timeline between `device-info` and `account`, `PANE_SECTION` is null for it, the `optionalPaneEntry` switch has its own case, and `ui-copy.ts` has the title, `formatTimelineRowSummary` and the provenance label ("account history files").
- Proofs: 60 unit cases for the mapping, instant and builder (including 5,000 rows built and sorted inside a one-second bound), 22 worker cases through the real worker, plus the flipped shell, facts and copy pins and new Overview cases for the two Phase 12 cards.

## Task Commits

1. **Task 1: Entry mapping and the pure builder** - `4091bfd` (feat)
2. **Task 2: The channel and the rows snapshot's account order** - `0b1ab6a` (feat)
3. **Task 3: The shell leg** - `cd0c827` (feat)

## Date shapes: widening per file and column

None needed. Every timeline date column (`account_name_history.csv` CREATED_AT, `external_services_history.csv` CREATED_AT, `language_and_country_history.csv` CREATED_AT, `bans.csv` STARTED_AT, `authorized_third_parties.csv` CREATED_AT) is recorded as `YYYY-MM-DD HH:MM:SS.mmm`, which `parseTimelineInstant` already reads as shape 1. `timeline-instant.ts` got a documentation update only. `Bans.EXPIRED_AT` is not an entry date and is not read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Mismatch with the capture] Language and country is discriminated, not two columns**
- **Found during:** Task 1 (reading 12-HEADERS.md)
- **Issue:** The plan's Behavior assumed a row can carry a language column and a country column and yield two entries. The capture has one `VALUE` column that is both, with `NAME` discriminating; a row is one setting.
- **Fix:** `TIMELINE_ENTRY_MAP.languageCountry` carries `languageColumn` and `countryColumn` (both `VALUE`) plus `discriminatorColumn: 'NAME'`. One entry per row by the discriminator; the two-column behaviour is kept and tested through the injectable map. The `NAME` token values are not recorded in the capture, so the match is tolerant (see key-decisions) and the fixture writes `language` / `country`; this is the one guess a real export would confirm.
- **Files modified:** timeline-shared.ts, timeline-aggregate.ts, timeline-fixtures.ts
- **Commit:** 4091bfd

**2. [Rule 2 - Missing critical functionality] The export's null marker must not display as a date**
- **Found during:** Task 1
- **Issue:** An open ban's end is stored as backslash N; a date cell holding it would be shown as a date string.
- **Fix:** A date cell equal to the null marker is read as no date (undated, "not reported"). Tested.
- **Files modified:** timeline-aggregate.ts
- **Commit:** 4091bfd

**3. [Rule 3 - Blocking] A view union in an existing test**
- **Found during:** Task 2
- **Issue:** `data-query-worker.test.ts` types `viewOf` by an explicit union of views; `TimelineView` joining `DataResult` broke `pnpm run check`.
- **Fix:** Added `TimelineView` to that union (not in the plan's file list).
- **Files modified:** tests/unit/import/data-query-worker.test.ts
- **Commit:** 0b1ab6a

### Plan items that cannot be exercised literally

- **Address part in a ban or third-party entry.** The plan asks for a planted TEST-NET address in a ban or third-party address column to arrive as a canonical address cell. The capture admits no address column in the history, ban or third-party files (rule d keeps `IP` in Bans, Authorized_Third_Parties and Bonus_Codes only, and the user's answers left no allowlisted `IP` in the first two; the timeline specs have none). The test instead plants the address in the excluded `IP` columns and asserts it is at rest nowhere and in the view nowhere, and that no part of any entry has the address kind. The builder still reads every part with the spec column's kind, so an address column added later is canonical-or-null by construction.
- **TDD ordering.** Tasks 1 and 2 are marked `tdd="true"`; implementation and tests were written together and committed once per task rather than as separate RED and GREEN commits (the same note as plan 12-10).
- **e2e specs.** Three existing specs filter `PANE_ORDER` by id (`heat`, `perks`) and the zero-network spec filters `OPTIONAL_PANE_IDS`; adding an id to the tuples means those walks would include `account-timeline` until a Dashboard branch and fixture exist. Plan 12-13 owns those one-line list-order fixes, so they were left alone.

**Total deviations:** 3 auto-fixed (Rule 1 capture mismatch, Rule 2 null marker, Rule 3 test type), 3 process notes. **Impact:** none on scope; the contract the pane reads (`TimelineView`) is unchanged.

## Issues Encountered

None. The Perks colour-literal item logged in `deferred-items.md` by 12-10 was already resolved by commit `ad27fca` before this plan started, and the full unit suite is green.

## Known Stubs

None. Until plan 12-12 the Dashboard has no `account-timeline` branch, so a selected timeline row falls through to the Not yet supported block. That is the transitional state the plan names inside one unreleased phase branch, not a data stub.

## Threat Flags

None. No new endpoint, auth path or storage schema; the new channel is a worker read of already-allowlisted rows through the existing strict query validator (T-12-34, T-12-35, T-12-36 and T-12-37 are mitigated and tested as the plan states).

## Verification

- `pnpm run test:unit`: 131 files, 4083 tests, all green.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean.
- Acceptance: `TIMELINE_ENTRY_MAP` is declared once and `timeline-shared.ts` has no runtime import; `dateShape` appears in the map; `SHAPE_EXAMPLES` is used in the mapping test; `buildTimelineView` is exported and the module has no `console.` or `new Date`; `new-data-shared.ts` has 0 import lines; `RowsSnapshot.accounts` and its assignment are present; `'account-timeline'` is in `data-queries.ts` and `worker-messages.ts`; `TL_EXPECTED` appears 21 times in the worker test; `NEW_DATA_PANE_IDS` is `['heat', 'warships-storage', 'perks', 'account-timeline']`; `formatTimelineRowSummary` is exported; `db.verno` stays 2.

## Self-Check: PASSED

- FOUND: src/lib/features/account-timeline/timeline-aggregate.ts
- FOUND: tests/fixtures/timeline-fixtures.ts
- FOUND: tests/unit/account-timeline/timeline-aggregate.test.ts
- FOUND: tests/unit/account-timeline/timeline-mapping.test.ts
- FOUND: tests/unit/import/account-timeline-worker.test.ts
- FOUND: 4091bfd
- FOUND: 0b1ab6a
- FOUND: cd0c827
