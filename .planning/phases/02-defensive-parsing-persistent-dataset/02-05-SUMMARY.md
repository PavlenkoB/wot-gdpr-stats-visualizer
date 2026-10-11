---
phase: 02-defensive-parsing-persistent-dataset
plan: 05
subsystem: worker-csv-parsing
tags: [papaparse, csv, privacy, d-18, fail-closed, gap-closure, vitest, tdd]

requires:
  - phase: 02-defensive-parsing-persistent-dataset
    provides: parseCsvFile wrapper, D-03/D-04 skip accounting, malformed-rows fixture (02-01, 02-02)
  - phase: 03-identity-and-account-info
    provides: header-keyed D-18 strip (hasSensitiveColumn, sanitizeUserInfoRow) in identity.ts
provides:
  - header-driven delimiter choice in parseCsvFile (CR-03)
  - hasGluedSensitiveColumn predicate and a fail-closed whole-file withhold (CR-03)
  - exact blank-record row mapping, blank records filtered by the wrapper (CR-02)
  - physical-line quarantine and recover for a stray quote, with a bounded re-parse (CR-01)
  - MAX_QUARANTINED_RECORDS and the `[csv-parse] remainder withheld` log tag
  - malformed-rows fixture restored to the real CRLF / blank-line-interleaved shape
affects: [phase-03-identity, phase-04-playtime, phase-05-finance-vehicles, phase-06-logins, ingest-worker]

actuals:
  tokens: 11800
  tasks: 3
  commits: 2
plan_head_before: ec641720753740f7bc01ddee4836942ca7c2dbbc
plan_head_after: 84eee5c9cdd53a63a15a0e8a452ca50f4759cb77

tech-stack:
  added: []
  patterns:
    - "Guarantee as a property of the parsed KEYS, not of a delimiter heuristic: hasGluedSensitiveColumn shares normalizeKey and DROPPED_COLUMN with the strip so trigger and strip cannot disagree"
    - "Keep blank records in the parse and filter in the wrapper so PapaParse's error.row maps to data[row - 1] exactly"
    - "Quarantine one physical line and re-parse the remainder, with a cap whose remainder is counted rather than dropped"

key-files:
  created: []
  modified:
    - src/lib/worker/csv-parse.ts
    - src/lib/worker/identity.ts
    - tests/unit/import/csv-parse.test.ts
    - tests/unit/import/ingest-worker.test.ts
    - tests/fixtures/export-fixtures.ts

key-decisions:
  - "Delimiter is chosen from the header line only (first of ; , tab | outside quoted spans, default ;) and passed to PapaParse explicitly, so its sniff, the UndetectableDelimiter fallback and the ignored Delimiter error can no longer occur"
  - "A header that hides a deny-listed name inside a longer key, or has a Quotes error in the header record, withholds the whole file (rows [], every non-empty data line counted, one tagged log): a counted withhold keeps the rest of the export importing, a throw would abort it"
  - "skipEmptyLines goes to false and the wrapper filters blank records itself; a whitespace-only value is still a row, a zero-length line still is not"
  - "A Quotes record with no line break in any cell is dropped alone; one whose cell contains the file's line terminator is spanning and only the physical line holding the opening quote is quarantined, the remainder re-parsed"
  - "MAX_QUARANTINED_RECORDS = 1000 bounds the quadratic re-parse; the unread remainder is added to skippedCount and logged under its own tag (D-06 not violated: nothing is rejected by size)"

patterns-established:
  - "Fixture shape is load-bearing for a RED test: a text with a leading CRLF or interleaved blanks is sniffed correctly by PapaParse and makes a delimiter-sniff test vacuous"
  - "Skip logs carry category, sourceFile, a file-relative physical line, reason and a line count, never cell or header text"

requirements-completed: [IMPORT-03, IMPORT-04]

coverage:
  - id: D1
    description: "A two-column semicolon file with one short row in the sniffing window parses under its real header keys with zero skipped rows (CR-03)"
    requirement: "IMPORT-03"
    verification:
      - kind: unit
        ref: "tests/unit/import/csv-parse.test.ts#A (review repro): ID;NAME with seven valid rows and one short row keeps its real header keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "LOGIN;BIRTH_DATE (semicolon, pipe, tab, comma) plus one ragged row persists no email or birth date through the real ingest worker, in User_Info and a misfiled folder (CR-03, D-18)"
    requirement: "IMPORT-03"
    verification:
      - kind: unit
        ref: "tests/unit/import/ingest-worker.test.ts#02-05 -- CR-03: a ragged LOGIN;BIRTH_DATE file persists no sensitive value"
        status: pass
      - kind: unit
        ref: "tests/unit/import/csv-parse.test.ts#B/C: LOGIN;BIRTH_DATE (semicolon|pipe|tab|comma) plus one short row keeps real keys and redacts through the D-18 strip"
        status: pass
    human_judgment: false
  - id: D3
    description: "A quoted or mixed-delimiter glued header withholds the whole file, every data line counted, one tagged log; the real LOGIN_DT header and LOGIN/LOGIN_1 are not withheld (CR-03)"
    requirement: "IMPORT-03"
    verification:
      - kind: unit
        ref: "tests/unit/import/csv-parse.test.ts#D, E, F, G and hasGluedSensitiveColumn predicate tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "Blank lines no longer shift which row is dropped: r2 dropped, r4 kept; a CRLF-led, blank-interleaved file drops only the malformed record (CR-02)"
    requirement: "IMPORT-03"
    verification:
      - kind: unit
        ref: "tests/unit/import/csv-parse.test.ts#R1..R6"
        status: pass
      - kind: unit
        ref: "tests/unit/import/ingest-worker.test.ts#02-05 -- CR-01/CR-02: the real-shape malformed Bans file through the real worker"
        status: pass
    human_judgment: false
  - id: D5
    description: "A stray quote costs only the physical line it corrupts; rows after it are recovered, the cap remainder is counted, mojibake repair and bare-CR tolerance are preserved (CR-01, IMPORT-03, IMPORT-04)"
    requirement: "IMPORT-04"
    verification:
      - kind: unit
        ref: "tests/unit/import/csv-parse.test.ts#Q1..Q6"
        status: pass
      - kind: e2e
        ref: "playwright test tests/e2e/import tests/e2e/shell/dashboard.spec.ts tests/e2e/shell/identity-privacy.spec.ts tests/e2e/guards/zero-network.spec.ts --project=chromium (76 passed)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-10
status: complete
---

# Phase 2 Plan 5: CSV parser gap closure (CR-01, CR-02, CR-03) Summary

**`parseCsvFile` now chooses its delimiter from the header line, withholds any file whose header keys hide LOGIN/BIRTH_DATE inside a longer key, maps `error.row` to the exact record despite blank lines, and quarantines only the physical line holding a stray quote while recovering the rows after it.**

## Performance

- **Duration:** about 6 min of execution after context load
- **Started:** 2026-10-10T19:31:55Z
- **Completed:** 2026-10-10T19:37:47Z
- **Tasks:** 3 (1 tracer, 1 auto TDD, 1 verification gate)
- **Files modified:** 5 (all within the plan's `files_modified`)

## Accomplishments

- CR-03 closed. The delimiter no longer depends on body rows, and the PII guarantee is now a check on the parsed keys: `hasGluedSensitiveColumn` (in `identity.ts`, sharing `normalizeKey` and `DROPPED_COLUMN` with the strip) makes `parseCsvFile` withhold the whole file, counted in `skippedCount`. A real ingest-worker tracer shows no email or birth date persisted for a ragged `LOGIN;BIRTH_DATE` file in a User_Info folder and a misfiled folder.
- CR-02 closed. Blank records stay in the parse and are filtered by the wrapper, so the offending record is `data[row - 1]`. The 02-02 fixture workaround is undone: `buildMalformedRowsExport` has the real leading-CRLF, blank-line-interleaved shape and the malformed record sits between valid ones.
- CR-01 closed. A spanning stray quote quarantines one physical line, the remainder is re-parsed, and `skippedCount` equals what was actually lost. `MAX_QUARANTINED_RECORDS` (1000) bounds the loop; the unread remainder is counted and logged under `[csv-parse] remainder withheld`.
- 26 new tests (14 for Task 2, 12 for Task 1). Each review repro failed on the pre-fix parser for the stated reason before its fix.

## Task Commits

1. **Task 1 (tracer): header-driven delimiter and glued-sensitive-header withhold (CR-03)** - `c707a2d` (fix)
2. **Task 2: exact blank-record mapping and quarantine-and-recover, fixture restored (CR-01, CR-02)** - `84eee5c` (fix)
3. **Task 3: full regression gate** - verification only, no code commit

**Plan metadata:** the commit that carries this file (docs: complete plan).

_TDD note: RED was observed and recorded for each task against the unmodified parser, but RED and GREEN were committed together per task, as the dispatch asked for one commit per task._

## RED evidence (failures seen before each fix)

Task 1, against the pre-fix parser (10 failed, 2 controls passed):

- A: `expected 'ID;NAME' not to contain ';'` (all rows under one glued key).
- B/C semicolon, pipe, tab: `expected [ 'LOGIN;BIRTH_DATE' ] to deeply equal [ 'LOGIN', 'BIRTH_DATE' ]`.
- D: the row was returned carrying `synthetic.player@example.invalid;1990-01-01`.
- E: two rows returned under `LOGIN;BIRTH_DATE`.
- G: `skippedCount` was 0, expected 2.
- H (both): `TypeError: hasGluedSensitiveColumn is not a function`.
- Worker tracer: `expected '{"rows":[...' not to contain 'example.invalid'` (email persisted).
- Controls that passed before the fix: the comma variant of C and the F negative controls.

Task 2, against the Task 1 parser (11 failed, 3 controls passed):

- R1/R2: `expected [ 'r0', 'r2', 'r3' ] to deeply equal [ 'r0', 'r3', 'r4' ]` (valid r4 dropped, malformed r2 kept).
- R3: `expected [ 'r0', 'unterminated;z\r\n' ] to deeply equal [ 'r0' ]` (swallowed row stored, count 0).
- R4: `expected [ '1', '2', '3', '4', '5' ] to deeply equal [ '1', '2', '4', '5' ]`.
- Q1: one row returned instead of three; Q2: two instead of three; Q3: `[ '1' ]` instead of `[ '1', '4', '7' ]`; Q4: Cyrillic row lost; Q5: `[ '1' ]` instead of `[ '1', '4', '6' ]`.
- Q6: `MAX_QUARANTINED_RECORDS` undefined (length NaN).
- Worker level: Bans `rowCount` 2, expected 3.
- Controls that passed before: R5, R6, and the "logs carry no cell text" test.

## Verification results (Task 3)

| Step | Command | Result |
| ---- | ------- | ------ |
| 1 | `pnpm run test:unit` | 87 files, 2734 tests passed |
| 2 | `pnpm run check` (tsc -b and svelte-check) | 306 files, 0 errors, 0 warnings |
| 3 | ESLint and Prettier on the five touched files | clean (the network ban held: no new network call) |
| 4 | Playwright `tests/e2e/import`, `shell/dashboard.spec.ts`, `shell/identity-privacy.spec.ts`, `guards/zero-network.spec.ts`, chromium | 76 passed, no spec edited |

The Task 2 sweep (`tests/unit/import`, `finance`, `vehicles`, `logins`, `playtime`, `shell/identity.test.ts`) was also run on its own: 48 files, 1460 tests passed.

## Files Created/Modified

- `src/lib/worker/csv-parse.ts` - hardened `parseCsvFile`: normalisation, header-only delimiter, header-level withholds, blank-record filter, single-line drop vs physical-line quarantine, cap, file-relative line numbers; new export `MAX_QUARANTINED_RECORDS`; header comment rewritten.
- `src/lib/worker/identity.ts` - new exported `hasGluedSensitiveColumn(keys)`.
- `tests/unit/import/csv-parse.test.ts` - CR-03, CR-02 and CR-01 describe blocks.
- `tests/unit/import/ingest-worker.test.ts` - CR-03 worker tracer and the restored-fixture worker test.
- `tests/fixtures/export-fixtures.ts` - `buildMalformedRowsExport` restored to the real CRLF shape with the malformed record in the middle.

## Decisions Made

See `key-decisions` above. Net effect on locked decisions: D-03 (skip only the offending line, the rest continues) and D-04 (counts equal what was lost) are now true for the stray-quote class; D-18 (Phase 3) is now independent of delimiter detection; D-06 holds (the cap bounds work and counts its remainder, it rejects nothing by size); D-09 is untouched, the `ParsedFile { rows, skippedCount }` shape is unchanged so the worker needs no edit.

## Deviations from Plan

### Auto-fixed Issues

None. No bug, missing-functionality or blocking fix outside the plan was needed.

### Minor departures from the plan text (not rule deviations)

1. **H-negatives were not "already passing" at RED.** The plan expected the negative predicate cases to pass before the fix; they cannot, because the function did not exist (`TypeError`). They are real assertions and pass after the fix.
2. **One extra, defensive reason string.** If a spanning `Quotes` error carries no numeric `index`, the data part is withheld and counted under `[csv-parse] remainder withheld` with reason `quote-position-unknown` (nothing of that parse is trusted or harvested). PapaParse 5.7.0 always supplied an index in every probe, so this is unreachable in practice and untested.
3. **One commit per TDD task** rather than separate RED and GREEN commits, per the dispatch instruction.

**Total deviations:** 0 rule deviations; 3 minor departures above. **Impact:** none on scope or acceptance.

## Known limitations (documented, out of scope)

- The quarantine unit is the physical line holding the opening quote. The continuation lines of an unterminated multi-line field come back as ordinary rows (recorded in a test comment, Q1, and in the file header).
- Atypical shape: a record that has a legitimately multi-line quoted cell EARLIER in the record and then a stray quote on a later line. The lines of that record before the quote's line are cut with the quarantine and are not counted. Real exports do not produce this shape (the probes and the fixture library contain none); fixing it needs the record's start offset, which PapaParse does not expose.
- A header cell containing a literal line break is not specially handled (the data start is taken after the first terminator).
- Out of scope, untouched: WR-01..WR-04, IN-01..IN-06 (including `__parsed_extra` mojibake repair, IN-02).

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or schema change; the zero-network guard spec passed after the parser change. Register status: T-02-14, T-02-15, T-02-16, T-02-17 and T-02-18 mitigated as planned, T-02-19 accepted, T-02-SC not triggered (no dependency added).

## Issues Encountered

None.

## Next Phase Readiness

Plan 02-05 is the gap-closure plan for the Phase 2 review; with it complete the Critical findings CR-01..CR-03 are closed. Warnings WR-01..WR-04 and info items IN-01..IN-06 remain deferred by plan scope. Phase 2 re-verification can run against the review repros.

## Self-Check: PASSED

- FOUND: src/lib/worker/csv-parse.ts
- FOUND: src/lib/worker/identity.ts
- FOUND: tests/unit/import/csv-parse.test.ts
- FOUND: tests/unit/import/ingest-worker.test.ts
- FOUND: tests/fixtures/export-fixtures.ts
- FOUND: c707a2d
- FOUND: 84eee5c
