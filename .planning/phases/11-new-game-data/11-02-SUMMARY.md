---
phase: 11-new-game-data
plan: 02
subsystem: fixtures + allowlist-data
tags: [privacy, allowlist, headers, capture, d-08, d-10, d-12, d-15, fixtures]
requires:
  - phase: 11-new-game-data
    provides: "11-01's allowlist mechanism, FAMILY_PATTERNS and the two verified session specs this plan's decisions feed"
provides:
  - header_capture.py
  - 11-HEADERS.txt
  - 11-HEADERS.md
  - new-data-headers-fixture
  - CAPTURED_FILES
  - headersOf
  - new-data-headers-guard
affects: [11-03, 11-04, 11-07, 11-08, 11-09, 11-10, 11-11]
tech-stack:
  added: []
  patterns:
    - a values-free capture script whose leak guard is the identifier-only token rule, proven by a test over a synthetic archive with planted canaries
    - the real header capture committed as names-only data, transcribed into a zero-import leaf fixture that every later spec reads
    - a per-file allow/exclude decision table with eight ordered rules, so the allowlist is reproducible rather than a matter of taste
    - a guard that lints the properties of every token rather than snapshotting one expected list
key-files:
  created:
    - .planning/phases/11-new-game-data/header_capture.py
    - .planning/phases/11-new-game-data/11-HEADERS.txt
    - .planning/phases/11-new-game-data/11-HEADERS.md
    - tests/fixtures/new-data-headers.ts
    - tests/unit/guards/header-capture-script.test.ts
    - tests/unit/guards/new-data-headers.test.ts
  modified: []
key-decisions:
  - "D-12 is discharged: the real headers exist as committed, names-only data. Nothing downstream in this phase guesses a header from a legacy file's shape any more."
  - "Every one of the eighteen captured files is COMMA-delimited, contradicting the Phase 5 semicolon evidence. Synthetic fixtures for these files must be comma-delimited or the allowlist matches nothing and the file silently stores nothing."
  - "WOWP_20_Plane_Statistics.csv carries NO vehicle identifier (no VEHICLE_NAME, no ID, in either account), so plan 11-10's note-not-table rule stands unchanged. The vehicle identifier is real and lives in WOWP_19_Plane_Statistics.csv as VEHICLE_NAME."
  - "HEAT_Session_Geolocation.csv is not the country-level file its name suggests: it carries ACCOUNT_ID, CITY, REGION, ISP_NAME, ASN and ASN_NAME. It has no latitude/longitude at all, so the Pitfall 8 coordinate hazard does not materialise — the hazard that does is identity and sub-city location. Only COUNTRY_CODE_ALPHA_3, the masked IP, CONNECTION_SPEED and the two session stamps survive."
  - "CITY_NAME also appears in HEAT_Game_Sessions.csv, not only in the geolocation file, and is excluded there too. A reader who checked only the file named Geolocation would have missed it."
  - "No captured file's headers differ between accounts. All four dual-account files agree token for token; only their sizes and row counts differ."
  - "ASSET_NAME in HEAT_Account_Storage.csv is allowed even though rule (a)'s keyword test would exclude it, because rule (a)'s stated intent is a column that suggests a PERSON and this is an in-game item label — the same reasoning that allows WOWS ITEM_DESC. Recorded in 11-HEADERS.md Notes 7 as the first row a reviewer should check."
  - "No requirement is marked complete by this plan. GAMES-01, GAMES-03 and GAMES-04 all read 'are shown', and no pane is shown by this plan; PRIV-01 was already Complete from 11-01."
patterns-established:
  - "Probed-import guards: when a guard's subject module is the artifact a task creates, probe the import rather than importing it statically, so the missing module is an ordinary failing assertion instead of a collection fault."
  - "Decision tables over prose: a per-column allow/exclude row with a rule tag and a one-line reason makes an allowlist reviewable and reproducible, and lets a later plan widen one row by editing a table."
actuals:
  tokens: 26795
  tasks: 3
  commits: 5
requirements-completed: []
coverage:
  - id: D1
    description: "A values-free capture script exists and a test proves over a synthetic archive that it prints column names and counts and never a cell, an email, a digit string or a real account number."
    verification:
      - kind: unit
        ref: "tests/unit/guards/header-capture-script.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The real export's headers exist as committed, names-only data (18 FILE groups) and as a zero-import leaf fixture, CAPTURED_FILES, guarded on every test run."
    verification:
      - kind: unit
        ref: "tests/unit/guards/new-data-headers.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A per-file column decision table exists with an allow/exclude row, a kind, an id and a one-line reason for every header of every file that has a pane, under eight ordered rules."
    verification:
      - kind: other
        ref: ".planning/phases/11-new-game-data/11-HEADERS.md (183 allow rows, 88 exclude rows, 12 tables, Notes section)"
        status: pass
    human_judgment: true
    rationale: "The allowlist is Claude's discretion under CONTEXT, so automation can prove the table is complete against the capture but cannot prove a judgement is right. The plan makes this a review, not a gate: a disagreement is resolved by editing the table, which every later plan reads."
  - id: D4
    description: "The four evidence-dependent questions are answered from the captured headers rather than by analogy."
    verification:
      - kind: other
        ref: ".planning/phases/11-new-game-data/11-HEADERS.md Notes 1-5"
        status: pass
    human_judgment: false
duration: 85min
completed: 2026-10-19
status: complete
commits: 5
plan_head_before: 6d5ed06e03c1f61951d7e0994c12cd4dcfe49ee4
plan_head_after: a58cb963ecda44ca8bba72d6e47d0e10f5af78e8
---

# Phase 11 Plan 02: Real export headers, captured values-free Summary

The real column headers of the HEAT, WoT Console, Warplanes 19/20 and Warships
crews/storage files, read by nobody but the user's own machine, committed as
names-only data, and turned into an allow/exclude decision for every one of the
271 columns that have a pane.

## Performance

- **Duration:** 85 min wall clock, including the human checkpoint wait; ~25 min of
  agent work across three task sessions
- **Tasks:** 3 (1 complete, 1 human action, 1 complete)
- **Files created:** 6, modified: 0
- **Commits:** 5 (test → feat → test → feat → refactor, both auto tasks in RED/GREEN/REFACTOR)

## Accomplishments

- **The research blocker is gone.** 11-RESEARCH's Open Question 1 was a BLOCKER:
  every HEAT, WoWS-crews/storage and Warplanes header was unverified, and the
  allowlists downstream could only be as good as the names they listed. All
  eighteen captured files now have their real column names committed.
- **Every captured file is comma-delimited, not semicolon.** This contradicts the
  Phase 5 evidence and it is the single most load-bearing fact in the capture: a
  semicolon-delimited synthetic fixture would parse to one column per row, the
  allowlist would match nothing, and the file would store nothing — a silent
  fail-closed wrong answer with no visible failure.
- **Four evidence questions answered, none by analogy.** `WOWP_20_Plane_Statistics.csv`
  carries no vehicle identifier, so 11-10's note-not-table rule stands and does
  *not* need revisiting. The geolocation file is country-level *plus* an account
  id, a city, a region and three network-identity columns. All seven HEAT files
  sit in one account only. No file's headers differ between accounts.
- **The city hazard was in the wrong file.** `CITY_NAME` appears in
  `HEAT_Game_Sessions.csv`, not only in `HEAT_Session_Geolocation.csv`. It is
  excluded in both, and 11-HEADERS.md says so explicitly so a later reader who
  checked only the file named "Geolocation" does not reintroduce it.
- **The only contact with real personal data was the user's own run of a script a
  test proved safe.** The zip was never copied, committed or opened by anything
  else, and the committed artifacts hold names, sizes and counts only.

## Task Commits

1. **Task 1: values-free capture script and its guard** — `6735ad2` (test/RED),
   `eef4e9c` (feat/GREEN)
2. **Task 2: run the script on the real export** — human action, no commit; the
   artifact it produced is committed in `466307c`
3. **Task 3: transcribe the capture and decide every column** — `b32b911`
   (test/RED), `466307c` (feat/GREEN), `a58cb96` (refactor)

### TDD evidence

**RED (Task 3, `b32b911`).** The first attempt imported the fixture statically and
the whole file failed at load with `Cannot find module` — a collection fault, which
is INVALID RED because it proves nothing about the lint. The import was changed to
a probe (`await import(...).catch(() => null)`) so the missing module becomes an
ordinary assertion failure. `gsd_run check tdd-red-evidence` returned
`RED_EVIDENCE_OK` (`target_test_failed`).

*Honest limit on the RED evidence:* the eight token-shape lint tests report `ok` in
RED, because they iterate an empty list and are vacuously true. What RED actually
carries is the module's existence and its key set, not the at-sign or digit-run
lint. Those gain their teeth in GREEN, where the list holds 271 real tokens. This
is recorded in the evidence record's `semanticAssessment` rather than glossed.

**GREEN (`466307c`).** `tests/fixtures/new-data-headers.ts` — the transcription,
18/18 guard assertions pass.

**REFACTOR (`a58cb96`).** The guard's fallback helper typed itself by inferring
through the nullable probed module; it now names the exported `CapturedHeaders`
interface. Behaviour unchanged.

### A transcription that is checked, not trusted

The 271 columns were generated from the capture rather than typed by hand, then
verified round-trip: a throwaway test compared all eighteen entries field for
field against `11-HEADERS.txt` (account, folder, file name, bytes, non-empty
lines, delimiter, header tokens in order) and passed. The throwaway test was
deleted, not committed — the committed guard is forbidden from reading
`.planning/`, which is the point of it.

## Files Created

- `.planning/phases/11-new-game-data/header_capture.py` — the values-free capture
  script the user runs; standard library only, prints names and counts, relabels
  account folders ACCT-A/B/C, prints `[suppressed]` for a first line that is not
  identifier-only
- `.planning/phases/11-new-game-data/11-HEADERS.txt` — the user's capture, 18 FILE
  groups, names only
- `.planning/phases/11-new-game-data/11-HEADERS.md` — the decision table: 12 file
  tables, 183 allow rows, 88 exclude rows, and the Notes that answer the four
  evidence questions
- `tests/fixtures/new-data-headers.ts` — `CAPTURED_FILES` (18 entries) and
  `headersOf(key)` with a divergence flag; zero imports, a leaf module
- `tests/unit/guards/header-capture-script.test.ts` — the script guard (Task 1)
- `tests/unit/guards/new-data-headers.test.ts` — the constants guard (Task 3)

## Decisions Made

Carried from the prior executor of Task 1, unchanged:

- **No token-count ceiling in the script.** The plan's ">80 tokens per HDR line" is
  asserted by the guard over the synthetic archive's output and deliberately NOT
  used to suppress a header line. The widest real target (`WOWS_Account_Storage.csv`,
  4.295 KB) could legitimately exceed 80 columns, and suppression would fail closed
  with no safety gain — the identifier-only rule is the actual leak guard, because
  no data cell is identifier-like. The rationale lives in the script's docstring.
- **One test-only fix during GREEN:** the bounds assertion skips the
  `HDR [suppressed]` marker, and python stderr is folded to one line so TAP
  diagnostics stay a single YAML scalar.

Made in Task 3:

- **Rule (g) is scoped as written.** For the two WOWP *plane* files the allowlist
  is exactly the Vehicles builder's vocabulary present in the capture (14 columns
  for the 19 file, 4 for the 20). For the two WOWP *account* files rule (g)'s
  second clause also admits every non-identifying numeric and date column. That
  excludes, for example, `WOWP_19_Plane_Statistics.CREATED_AT` — a date, but a
  column the builder does not read, and rule (g) scopes the wider allowance to the
  account files. Applying the rules exactly is what makes the table reproducible;
  widening a row later costs a cache rebuild (D-08), so the conservative reading is
  the right one to ship and an obvious one to relax.
- **`ASN` is excluded under rule (d), not rule (a).** It identifies a network, not
  a person or an account, so rule (a) does not reach it; rule (d) refuses it
  because it is ID-like without being a game object. Flagged in Notes 7 because the
  rule does not read that way at a glance.
- **No requirement marked complete.** GAMES-01, GAMES-03 and GAMES-04 each read
  "are shown", and this plan shows nothing; PRIV-01 was already Complete from
  11-01. Same reasoning as 11-01's deviation 4 — a phase requirement flipped
  early is a false entry in the ledger `/gsd-verify-work` reads. Recorded in
  `.planning/WINDOWS.md` as a `deviation` entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] A static import made the guard's RED evidence invalid**
- **Found during:** Task 3, RED
- **Issue:** the guard imported `tests/fixtures/new-data-headers.ts` statically,
  which is the artifact the task creates. Before it existed, vitest failed the whole
  FILE at load with `Cannot find module` — a collection fault, not a test failure,
  and INVALID RED under the gate's own rule.
- **Fix:** the import is probed (`await import(...).catch(() => null)`) and the
  missing module is asserted by name as the first test. Every shape test then runs
  against an empty list and fails on its own terms. Once the module exists the probe
  is a plain import and the two paths are identical, so GREEN is not special-cased.
- **Files modified:** `tests/unit/guards/new-data-headers.test.ts`
- **Verification:** `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`
- **Committed in:** b32b911

**2. [Rule 1 - Bug] The divergence pass wrote through a `ReadonlyMap`**
- **Found during:** Task 3, `pnpm run check`
- **Issue:** `BY_KEY` was annotated `ReadonlyMap<string, CapturedHeaders>`, so the
  second pass that marks a divergent key failed to compile with
  `TS2339: Property 'set' does not exist on type 'ReadonlyMap'`.
- **Fix:** the map is built mutable under a local name and exposed as a
  `ReadonlyMap` only after the divergence pass has run, which is the actual
  contract: callers read it, only the builder writes it.
- **Files modified:** `tests/fixtures/new-data-headers.ts`
- **Verification:** `pnpm run check` → 318 files, 0 errors
- **Committed in:** 466307c

**3. [Rule 1 - Bug] A `Co-Authored-By` trailer was written into the RED commit**
- **Found during:** Task 3, immediately after committing RED
- **Issue:** the project's `CLAUDE.md` forbids co-author attribution on commits,
  but the first commit message carried the trailer from the harness default.
- **Fix:** the commit was amended to drop the trailer. Recorded here because
  project rules override tool defaults and the first attempt did not follow them.
- **Files modified:** none (commit message only)
- **Committed in:** b32b911 (amended)

### Scope notes (not deviations, recorded for the reader)

- **The plan's "ten expected file keys" is thirteen.** Its interface block names
  fourteen target files; `HEAT_Surveys.csv` is optional (it sits in the unknown
  `Surveys` folder and belongs to Phase 12), so thirteen are required. The guard
  asserts all thirteen, and separately requires `HEAT_Device_Info.csv` — a target
  file with a deliberate "no spec, stores nothing (D-15)" decision, so its absence
  would mean a missed file rather than an out-of-scope one.
- **The guard's `headers` for a dual-account key is the first account's list.** The
  four dual-account files agree exactly, and the guard asserts
  `divergent === false` for every key. `divergent` is reported rather than assumed
  so a future capture that disagrees surfaces as one flag instead of as a silently
  borrowed allowlist.
- **The decision table's `id` column is not the stored key.** 11-01 maps every spec
  column to itself, so the stored header stays the header as captured; the camelCase
  is the label-map key. 11-HEADERS.md says this above the tables so a reader does
  not read it as an alias rewrite.
- **`11-HEADERS.txt` is committed with the Task 3 GREEN commit**, not with Task 1.
  It is the user's artifact and it is the source the transcription was generated
  from, so it belongs with the file derived from it.

## Verification

| Gate | Result |
|------|--------|
| `pnpm run test:unit` (whole suite) | 104 files, 3,383 tests, all pass |
| `pnpm run check` (`tsc -b` + `svelte-check`) | 318 files, 0 errors, 0 warnings |
| `pnpm run lint` (`prettier --check .` + `eslint .`) | clean |
| `tests/unit/guards/header-capture-script.test.ts` | 8/8 pass |
| `tests/unit/guards/new-data-headers.test.ts` | 18/18 pass |
| `grep -c '^FILE '` on the capture | 18 (≥ 10 required) |
| `grep -c '^HDR '` vs `^FILE ` on the capture | 18 vs 18 — every file got a header line, none suppressed |
| `grep -c '^import' tests/fixtures/new-data-headers.ts` | 0 (leaf-module rule holds) |
| `grep -c '\| allow \|'` in `11-HEADERS.md` | 183 |
| Transcription round-trip vs the capture | 18/18 entries identical, field for field |
| `git status --short` | no `.zip`, no `tests/fixtures/private/` |
| Privacy scan of the committed artifacts | no at-sign, no 4-digit run outside file sizes |

**Not run:** `pnpm exec playwright test`. This plan adds no e2e spec and touches no
component; the two e2e specs are unaffected. Chromium cannot be launched in this
sandbox in any case.

## Known Stubs

None. `CAPTURED_FILES` holds all eighteen captured entries with real header lists
(zero suppressed), `headersOf` resolves every key, and the decision table has a row
for every header of every file that has a pane.

## Threat Flags

Both register entries this plan owns are mitigated and pinned. No new surface
beyond them: the capture script reads a user-supplied zip read-only and writes
nothing to disk, and the committed artifacts are names, sizes and counts.

| Flag | File | Test that holds it |
|------|------|---------------------|
| threat_flag: information-disclosure-via-header | `.planning/phases/11-new-game-data/header_capture.py` | `header-capture-script.test.ts` plants a headerless file whose first line is an email canary and a digit canary, and asserts neither appears in stdout |
| threat_flag: real-identifiers-in-committed-data | `tests/fixtures/new-data-headers.ts`, `.planning/phases/11-new-game-data/11-HEADERS.md` | `new-data-headers.test.ts` rejects at-signs, all-digit tokens, four-digit runs, non-identifier tokens, the `[suppressed]` marker as a token, and any account label that is not `ACCT-X` |

## Self-Check: PASSED

All six created files exist on disk. All five commits (`6735ad2`, `eef4e9c`,
`b32b911`, `466307c`, `a58cb96`) are ancestors of HEAD.

## Carried to the next plan

- **11-03 appends to `NEW_DATA_SPEC_FILES` and to `FAMILY_PATTERNS` in the SAME
  commit as each other** (11-01's rule). The table's per-file column lists are the
  input; `id === header` for every column here, so no spec needs an alias.
- **11-04** needs a presence fact for `HEAT_Session_Geolocation.csv`: it is not a
  session file by name, so without one the card reads "Not in this export" for a
  file that is there (Pitfall 4).
- **11-07, 11-08, 11-10, 11-11** must write the new fixtures COMMA-delimited, and
  should keep mixing CRLF/LF/bare CR — the capture counts all three and prints no
  terminator, so the mixed-ending half of the Phase 5 note is still unverified for
  these files (Pitfall 10).
- **11-10** does not need to revisit the note-not-table rule for Warplanes 20; the
  capture settles it. The vehicle identifier it needs is `WOWP_19_Plane_Statistics.VEHICLE_NAME`.
- **A returning reader's cache still holds pre-allowlist rows** for these files in
  the old shape, including WOWP account rows with `NAME`. Nothing in this plan
  changed data already written at rest; 11-RESEARCH's Runtime State Inventory
  records the narrowing step as open.
- **`REGION` and `CONNECTION_SPEED`** are the two judgement calls most likely to
  be revisited by a user with product opinions; both are one row in
  `11-HEADERS.md`, and widening either costs a cache rebuild (D-08).
