---
phase: 11-new-game-data
plan: 03
subsystem: worker-ingest + vehicles-reader + fixtures
tags: [privacy, allowlist, specs, capture, warplanes, parity, d-08, d-10, d-12, d-15, pitfall-2, t-11-09, t-11-10, t-11-11]
requires:
  - phase: 11-new-game-data
    provides: "11-01's allowlist mechanism and the two session specs; 11-02's committed header capture, CAPTURED_FILES and the 11-HEADERS.md decision table"
provides:
  - NEW_DATA_SPEC_FILES-complete
  - FAMILY_PATTERNS-full
  - WOWP_FILE_HEADER_VOCABULARY
  - NEW_DATA_FIXTURE_FILES
  - buildNewDataFilesExport
  - buildLargeTableCsv
  - new-data-pii-matrix
  - new-data-parity-test
affects: [11-04, 11-05, 11-07, 11-08, 11-09, 11-10, 11-11]
tech-stack:
  added: []
  patterns:
    - three SCOPED evidence sources for a stored column — the capture, the builder vocabulary (WOWP files only), the session-aggregator vocabulary (session files only) — each pinned by its own guard
    - a superset is safer than a subset: a spec that admits what the READER needs cannot blank a shown column, and one that admits what the AGGREGATOR needs cannot change which sessions count
    - an identity-pattern guard with a CLOSED exceptions map that is itself asserted to hold nothing else
    - a parity test rather than a fixture assertion: the worker's answer vs the unprojected builder over the same CSV text
    - fixtures generated FROM the capture (header, delimiter, kinds) rather than from the shape of a legacy file
key-files:
  created:
    - tests/unit/import/new-data-parity.test.ts
  modified:
    - src/lib/worker/new-data-specs.ts
    - src/lib/worker/new-data-allowlist.ts
    - src/lib/features/vehicles/vehicle-aggregate.ts
    - tests/fixtures/new-data-fixtures.ts
    - tests/unit/import/new-data-allowlist.test.ts
decisions:
  - "The spec table admits exactly THREE sources, each scoped: the captured header for every file, the Vehicles builder vocabulary for the four WOWP files only, and the session-aggregator vocabulary for the two session files only. A test asserts the scopes do not cross in either direction."
  - "The Warplanes specs are the UNION of the capture and the builder vocabulary — 40 columns on the 19 plane file where the capture allowed 14. Narrowing a spec to the capture would have emptied a Warplanes table cell the next export revision renames (Pitfall 2)."
  - "The two session specs keep all seven aggregator headers even though the capture carries only three of them for either session file. Narrowing them would change which sessions the Playtime and Login aggregators count (D-08, D-10)."
  - "No requirement is marked complete by this plan: GAMES-01, GAMES-03 and GAMES-04 each read 'are shown' and this plan shows no pane. PRIV-01 was already Complete from 11-01. The 11-01 note that 11-03 would re-run the GAMES-01 mark is answered NO for the reason 11-02 gave."
  - "HEAT_Account_Storage.ASSET_NAME is kept, the one place the decision table's rule (a) is not read literally: an in-game item label is not a person. It carries a documented exception with that reason, and a guard asserts the map holds nothing else."
actuals:
  tokens: 22400
  tasks: 2
  commits: 5
duration: 25min
completed: 2026-10-19
status: complete
commits: 5
plan_head_before: cf3c53fab14478de4409328689b1f229c4d34d74
plan_head_after: a36f780
---

# Phase 11 Plan 03: Every new-game spec, the full family, and PRIV-01 proved per header

The per-file column allowlist stops being a mechanism proved on two files and
becomes the rule for all of them: twelve spec entries transcribed from the user's
own header capture, a file-name family that fails closed at its full extent, one
named PII test per captured file header, and a parity proof that the Warplanes
table reads exactly as it did before the allowlist existed.

## Performance

- **Duration:** 25 min wall clock
- **Tasks:** 2, both TDD (RED then GREEN in each)
- **Files created:** 1, modified: 5
- **Commits:** 5 (`1d101c4`, `7d367d7`, `f44f45a`, `cd30f8e`, `a36f780`)

## What shipped

### `src/lib/worker/new-data-specs.ts` — 12 spec files, 221 stored columns

The two session specs plan 11-01 wrote are untouched. Ten more are appended, one
per pane and Warplanes file in `11-HEADERS.md`, each transcribed from its `allow`
rows in capture order and filed under the category the CAPTURE filed it in:

| Spec file | Category | Columns |
|---|---|---|
| `heat_game_sessions.csv` | `activity_history` | 7 |
| `wotc_game_sessions.csv` | `activity_history` | 7 |
| `heat_session_geolocation.csv` | `activity_history` | 5 |
| `heat_account_statistics.csv` | `player_statistics` | 7 |
| `heat_battle_types_statistics.csv` | `player_statistics` | 20 |
| `heat_account_storage.csv` | `player_statistics` | 4 |
| `wows_crews.csv` | `player_statistics` | 6 |
| `wows_account_storage.csv` | `player_statistics` | 2 |
| `wowp_19_plane_statistics.csv` | `player_statistics` | 40 |
| `wowp_19_account_statistics.csv` | `player_statistics` | 55 |
| `wowp_20_plane_statistics.csv` | `player_statistics` | 4 |
| `wowp_20_account_statistics.csv` | `player_statistics` | 64 |

`heat_device_info.csv` and `heat_surveys.csv` have **no** entry and the file says
so: both are family files, both are counted as present, and neither stores a cell
(D-15, 11-HEADERS.md Open Question 7).

### Where every stored column comes from — three SCOPED sources

A column is named only if one of three sources admits it, and the test asserts
the scopes do not cross in either direction:

1. **The capture.** Every HEAT, WoWS and Warplanes column comes from an `allow`
   row of `11-HEADERS.md`, which plan 11-02 generated from the user's own
   headers. Everything marked `exclude` — `ACCOUNT_ID`, `CITY`, `REGION`,
   `ISP_NAME`, `ASN`, `ASN_NAME`, `CITY_NAME`, both `NAME` columns and the rest —
   is excluded BY OMISSION.
2. **The builder vocabulary**, for the four WOWP files only.
3. **The session-aggregator vocabulary**, for the two session files only.

Sources 2 and 3 are SUPERSETS of the capture, never substitutes for it.

### `src/lib/worker/new-data-allowlist.ts` — the family at its full extent

```ts
/^(?:heat|wotc)_/                    // every HEAT and WoT Console file
/^wowp_/                             // EVERY Warplanes file, wider than two revisions
/^wows_(?:crews|account_storage)\.csv$/  // exactly two Warships names, anchored
```

The `wowp_` pattern is deliberately wider than the two revisions the capture
holds: a `WOWP_21_*.csv` the next export revision ships is in the family, has no
spec, and therefore stores nothing. The WoWS pattern is anchored on the whole
name, so `WOWS_Ship_Statistics.csv`, `WOWS_Account_Statistics.csv` and
`WOWS_Battle_Types_Statistics.csv` stay OUTSIDE the family and keep being stored
column for column as the Vehicles builder has always read them.

### `src/lib/features/vehicles/vehicle-aggregate.ts` — `WOWP_FILE_HEADER_VOCABULARY`

A new export, a projection of the four field constants that already existed:
40 headers for the 19 plane file (the whole `ALL_FIELDS` vocabulary), one for the
20 plane file (`WOWP20_BATTLES_FIELD`), and five each for the two account files
(`BATTLES_FIELD` + `PREMIUM_EXPIRY_FIELD`). `git diff` shows **additions only** —
no builder line changed, and nothing reads the export yet.

Its purpose is to make Pitfall 2 CHECKABLE: the spec test asserts every header in
this map is in the corresponding spec, so renaming a field here fails a test
instead of quietly emptying a table column.

### `tests/fixtures/new-data-fixtures.ts` — the captured-header fixture set

`NEW_DATA_FIXTURE_FILES` holds one synthetic CSV per spec file: the header built
from `headersOf(key)`, three rows whose cells are a function of the column index
and row index, and MIXED line endings (CRLF, bare CR, LF), because the capture
counts all three and prints no terminator. Every captured file is COMMA-delimited
(11-HEADERS.md Notes 4), and a guard asserts each fixture's header column count
matches the capture.

Plus the canary builder (`canaryColumnsFor`, `withCanaries` — fourteen planted
personal columns minus any the file's own header already carries, a duplicated
header and one surplus cell beyond the header), the variant builders
(`bomPaddedLowerCsv`, `driftedCsv`, `headerOnlyCsv`, `hostileHeaderCsv`,
`bareCrQuotedCsv`), `buildLargeTableCsv(key, rowCount)` for plans 11-07, 11-10 and
11-11, and `buildNewDataFilesExport` / `buildMisfiledNewDataFilesExport`, which
write one single-root archive holding every spec file at once.

Addresses in these fixtures are `203.0.113.0/24` (TEST-NET-3), deliberately NOT the
`192.0.2.0/24` the 11-01 session fixtures use, so a later test can tell a HEAT
geolocation address from a login address.

### The tests

**`new-data-allowlist.test.ts`** (47 → 69 tests) — the pure guards: the spec key
list, every spec's category against its captured folder, the id/kind shape, the
three evidence guards and their scoping, the identity-pattern guard with a closed
exceptions map, and the `isNewDataFile` truth table. Then the worker matrix: one
named test per captured file header over one canary-laden archive, plus the
variant suites.

**`new-data-parity.test.ts`** (new, 4 tests) — the Warplanes view the REAL worker
answers, compared by deep equality of `rows`, `columns` and `header` with
`buildVehicleView` over the same CSV text parsed WITHOUT projection, over three
archive shapes: the captured headers, the 2021 shape the sample fixtures still
ship, and the whole shipped sample export.

## The two supersets, and why both are the safe direction

**WOWP.** The capture allowed 14 columns of the 19 plane file. The builder's own
vocabulary for it is 40. The spec is the union, so an older export revision — the
2021 shape `player-stats-fixtures.ts` still ships, which is what the shipped
sample uses — keeps filling the table. A spec narrowed to the capture would have
passed against today's export and emptied a table cell on the next one.

**Sessions.** The capture carries **three** of the seven aggregator headers for
each session file:

| Header | `heat_game_sessions.csv` | `wotc_game_sessions.csv` |
|---|---|---|
| `STARTED_AT` | captured | captured |
| `FINISHED_AT` | captured | captured |
| `IP` | captured | captured |
| `SESSION_START` | **absent** | **absent** |
| `SESSION_END` | **absent** | **absent** |
| `SERVER_NAME` | **absent** | **absent** |
| `CLIENT_PLATFORM` | **absent** | **absent** |

Both specs keep all seven. Narrowing them would change which sessions
`resolveSessionColumns` and the login aggregator count — a behaviour change
masquerading as a privacy tightening (D-08, D-10). A source-text case reads both
aggregator files and finds each of the seven as a quoted literal in the module
that reads it, so the allowance cannot drift from the code it mirrors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `VEHICLE_NAME` was typed `number` in the decision table**
- **Found during:** Task 1, transcribing the `allow` rows
- **Issue:** `11-HEADERS.md` gives `WOWP_19_Plane_Statistics.VEHICLE_NAME` the
  kind `number`. It is the only vehicle identifier in the whole export and its
  value is a name; every other `*_NAME` row in the table is `text`.
- **Fix:** the spec carries `kind: 'text'`. Nothing branches on the kind today
  (the module doc says so), so this is documentation corrected rather than
  behaviour changed. Recorded here because the decision table is what a later
  reviewer reads.
- **Files modified:** `src/lib/worker/new-data-specs.ts`
- **Commit:** 7d367d7

**2. [Rule 3 - Blocking issue] The identity pattern catches two headers rule (a) does not**
- **Found during:** Task 1, the identity-pattern guard
- **Issue:** the plan's exceptions map enumerates three families and says it
  "holds nothing else". Applying the pattern literally also flags
  `FIRST_LOGIN_DT` and `FIRST_LOGIN_PLATFORM` (the word `LOGIN` in an
  account-lifecycle timestamp) and `CREW_SHIP_TRAINED` / `CREW_SHIP` (the letters
  `IP` at the end of `SHIP`).
- **Fix:** all four are in the exceptions map with a reason that names the rule
  that decided them, and the guard's second case asserts the map holds NOTHING
  ELSE — an entry that does not correspond to a column that needs one fails.
  `CREW_ID` was removed from the map: the pattern matches a BARE `ID`, so it never
  flagged it.
- **Files modified:** `tests/unit/import/new-data-allowlist.test.ts`
- **Commit:** 1d101c4, 7d367d7

**3. [Rule 1 - Bug] A matrix assertion checked a no-op string replace**
- **Found during:** Task 2, GREEN
- **Issue:** the "a fixture exists for every spec file" case compared the
  fixture's folder against `folderFor(key).replace(/_/g, '_')` — a replace of `_`
  with `_`. It would have passed whatever folder the fixture claimed, so the one
  case that says "this file is filed where the capture filed it" asserted
  nothing.
- **Fix:** a `capturedFolderOf(key)` helper returns the CAPTURE's own folder
  spelling (`Player_Statistics`, `Activity_History`), which is what the archive
  entry path is built from.
- **Files modified:** `tests/unit/import/new-data-allowlist.test.ts`
- **Commit:** a36f780

### Scope notes (not deviations, recorded for the reader)

- **`new-data-fixtures.ts` imports three modules, not none.** The plan allowed
  `fflate` and `new-data-headers.ts`; the module also imports
  `new-data-specs.ts` (to give every cell the kind the spec assigns it, which is
  what "deterministic by column kind" means) and `pinned-zip.ts` rather than
  `fflate.zipSync` directly, because `tests/unit/guards/sample-export-shape.test.ts`
  forbids a fixture reaching past the pinned wrapper. It still imports no archive
  BUILDER, which is what the leaf-module rule is about.
- **`buildNewDataFilesExport` takes an options bag.** The plan's signature is
  `(files, root)`. The misfiled variant has to change a file's FOLDER, which a
  file-name-to-body map cannot express, so the second parameter carries
  `{ folders, root }`.
- **`canaryColumnsFor` also drops names the CAPTURE already carries.** The plan
  filters against the allowlist; a name the file's own header already carries
  (the geolocation file's `ACCOUNT_ID` and `CITY`) would be planted as a
  duplicate header and the assertion would test PapaParse's duplicate handling
  rather than the allowlist.
- **The identity pattern includes `IP`.** The plan's exceptions map treats the IP
  column as an exception "to the pattern", so the pattern has to match it.
- **`id` equals `header` for every column**, so the "camelCase id" the plan's
  behaviour block asks for is really "a unique, identifier-shaped stored key". The
  camelCase label key in `11-HEADERS.md` is a PANE label map's key and is
  explicitly not a stored key — that table says so above the tables.

## TDD evidence

**Task 1.** RED `1d101c4` — 10 failures, each an assertion naming a missing spec
or a missing vocabulary export, no collection fault. GREEN `7d367d7` — 47/47.

The four WOWP specs and the family patterns were added in the SAME commit, as
11-01 required: a family pattern without its spec is a fail-closed no-op rather
than a leak, but a spec without its pattern would have been silently inert.

**Task 2.** RED `f44f45a` — 22 failures, every one an ordinary assertion naming a
fixture export that does not exist yet (`does not export buildNewDataFilesExport`,
`does not export buildLargeTableCsv`), because the fixture module is read through
a namespace import and a locally-declared interface rather than named imports.
GREEN `cd30f8e` — 69/69, plus the new parity file's 4/4; `a36f780` then
corrected a matrix assertion that had been checking a no-op string replace
rather than the capture's folder spelling.

## Verification

| Gate | Result |
|------|--------|
| `pnpm run test:unit` (whole suite) | 105 files, 3,428 tests, all pass |
| `pnpm run check` (`tsc -b` + `svelte-check`) | 318 files, 0 errors, 0 warnings |
| `pnpm run lint` (`prettier --check .` + `eslint .`) | clean |
| `grep -c "key: '"` on the spec file | 12 spec entries, 221 columns |
| `grep -n "heat_device_info\|heat_surveys"` on the spec file | two comment lines only, no spec entry |
| `grep -nE "header: ['\"](NAME\|NICKNAME\|LOGIN\|EMAIL)['\"]"` | prints nothing |
| `WOWP_FILE_HEADER_VOCABULARY` diff on `vehicle-aggregate.ts` | additions only, no builder line changed |
| `git diff` on `playtime-aggregate.ts` / `login-aggregate.ts` | nothing |
| `db.verno` | still 2, no Dexie bump |
| `new-data-fixtures.ts` imports of an archive builder | none |
| Exact-header gate (`WOWP_FILE_HEADER_VOCABULARY`, `SESSION_AGGREGATOR_VOCABULARY`, `headersOf` in the test) | all present |
| No `Co-Authored-By:` trailer on any of the five commits | confirmed |

**Not run:** `pnpm exec playwright test`. This plan adds no e2e spec and changes
no component. Chromium cannot be launched in this environment, as in 11-01 and
11-02; the e2e specs are unaffected by an allowlist that only narrows which
columns of new-game files are stored.

## Known Stubs

None. No `TODO`, `FIXME`, placeholder copy or unwired data source was introduced;
every stored column is a literal transcribed from a committed decision table, and
every fixture value is a function of its column and row index.

## Threat Flags

All five register entries in the plan's `<threat_model>` are mitigated and pinned
by tests in this plan; no new surface beyond them was introduced.

| Flag | File | Test that holds it |
|------|------|---------------------|
| threat_flag: spec-wider-than-decision-table | `src/lib/worker/new-data-specs.ts` | the three evidence guards plus the closed identity-pattern exceptions map |
| threat_flag: nickname-at-rest-in-a-wowp-account-row | `src/lib/worker/new-data-specs.ts` | `keeps the nickname out of both WOWP account specs`, and the canary matrix plants `NAME` and `NICKNAME` for those files |
| threat_flag: allowlist-narrower-than-the-reader | `src/lib/worker/new-data-specs.ts` | the WOWP superset guard and the three-case parity test |
| threat_flag: hostile-header-dos | `src/lib/worker/new-data-allowlist.ts` | the hostile-header variant: a 100 KB name and `__proto__` import without throwing and store no key longer than 200 chars |
| threat_flag: folder-as-scope-switch | `src/lib/worker/new-data-specs.ts` | the misfiled variant: every file under `Payment_History` stores nothing |

## Self-Check: PASSED

`tests/unit/import/new-data-parity.test.ts` exists; all five commits (`1d101c4`,
`7d367d7`, `f44f45a`, `cd30f8e`, `a36f780`) are ancestors of HEAD; `commits: 5` is
measured from the plan ledger, not narrated.

## Carried to the next plan

- **11-04** needs a presence fact for `HEAT_Session_Geolocation.csv`: it is not a
  session file by name, so without one the card reads "Not in this export" for a
  file that is there (Pitfall 4). The file now STORES, so the fact is reachable.
- **11-07, 11-08, 11-10, 11-11** must write fixtures COMMA-delimited, and can use
  `NEW_DATA_FIXTURE_FILES` / `buildNewDataFilesExport` / `buildLargeTableCsv`
  rather than spelling out a header again.
- **A returning reader's cache still holds pre-allowlist rows** for every
  new-game file in the old shape, including WOWP account rows with `NAME`.
  Nothing in this plan changed data already written at rest; 11-RESEARCH's
  Runtime State Inventory records the narrowing step as open, and 11-04 owns
  making it idempotent on check-cache.
- **The identity map's thirteen entries across seven files are the reviewable
  set.** Every one names the decision-table rule that decided it, so a
  disagreement is resolved by editing a reason and a row rather than by editing
  the pattern — and the guard fails if a new entry does not correspond to a
  column that needs one.