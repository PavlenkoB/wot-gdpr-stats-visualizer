---
phase: 02-defensive-parsing-persistent-dataset
plan: 06
subsystem: worker-csv-parsing
tags: [papaparse, csv, privacy, d-18, unicode, nfkc, confusables, fail-closed, gap-closure, vitest, tdd]

requires:
  - phase: 02-defensive-parsing-persistent-dataset
    provides: parseCsvFile wrapper, quarantine-and-recover, hasGluedSensitiveColumn (02-05)
  - phase: 03-identity-and-account-info
    provides: header-keyed D-18 strip (hasSensitiveColumn, sanitizeUserInfoRow) in identity.ts
provides:
  - one shared header-key normaliser in identity.ts (NFKC, trim, upper-case, bounded Cyrillic/Greek/Turkish-I fold) used by the strip, the glued check and the identity pick (W-1)
  - additive hasGluedSensitiveColumn: folded-glue, invisible-character and pre-fold resemblance rules OR-ed with the verbatim 02-05 raw-key split (W-1)
  - terminator-aware parseCsvFile: CRLF and bare CR become LF and newline LF is passed to PapaParse when two or more terminator kinds occur (W-2)
affects: [phase-03-identity, phase-06-logins, ingest-worker]

actuals:
  tokens: 10051
  tasks: 3
  commits: 2
plan_head_before: df6814565eb11c7a3fe475a72aeb2ba4f515ccfc
plan_head_after: 541dbe2e42ba2b08a67b9e7b125243d0f779cfc3

tech-stack:
  added: []
  patterns:
    - "One normaliser for the strip, the check and the pick: the predicate reads the pre-fold form through the same private helper the normaliser uses, so no second folding table can drift"
    - "A fail-closed predicate may only ADD withholds: the prior rule runs verbatim on the raw key and is OR-ed with the new rules, pinned by preservation controls that pass before and after"
    - "Resemblance walk as a bit mask over target positions (non-ASCII = an unknown standing for zero or one character), never a RegExp built from key text"

key-files:
  created: []
  modified:
    - src/lib/worker/identity.ts
    - src/lib/worker/csv-parse.ts
    - tests/unit/import/csv-parse.test.ts
    - tests/unit/import/ingest-worker.test.ts

key-decisions:
  - "normalizeKey is NFKC, trim, upper-case, then a bounded fold of UTS #39 v18.0.0 twins (A B C D E G H I N O S T); no Cyrillic or Greek capital is a twin of L or R, so native-script names are neither stripped nor withheld"
  - "The resemblance rule reads the PRE-fold key, so an I/l-ambiguous letter (U+0399, U+0406, U+04C0, U+04CF) cannot hide the L of a lower-case login while the same letter standing for the I of LOGIN still folds to an exact name and is stripped"
  - "Terminator canonicalisation runs only when two or more kinds occur in the whole text; uniform files, including the Excel-style CRLF file with an in-cell LF, keep their cell bytes (a CR or CRLF inside a quoted cell of a MIXED file becomes LF, stated in the file header)"
  - "Accepted residual T-02-22: a key written entirely in a script outside the fold table, and translated names, are neither stripped nor withheld (same class as T-03-03)"

patterns-established:
  - "Tests that need a lookalike character write it as a u-escape so the code point is visible in review and survives tooling; tests tagged (control) are expected to pass before the change"

requirements-completed: [IMPORT-03, IMPORT-04]

coverage:
  - id: D1
    description: "A LOGIN / BIRTH_DATE / BIRTH_DATE_SRC header spelled with fullwidth letters or a Cyrillic / Greek / Turkish-I lookalike is stripped like the ASCII name, the other columns are kept and skippedCount is 0, including the verifier's two repros (W-1)"
    requirement: "IMPORT-03"
    verification:
      - kind: unit
        ref: "tests/unit/import/csv-parse.test.ts#parseCsvFile -- W-1: the verifier repros (verbatim), foldable lookalikes are stripped like the ASCII name"
        status: pass
    human_judgment: false
  - id: D2
    description: "Through the real ingest worker a foldable lookalike header persists neither the e-mail nor the birth date in User_Info or a misfiled folder, and every persisted row has the exact key list [ID, NAME] (W-1, D-18)"
    requirement: "IMPORT-03"
    verification:
      - kind: unit
        ref: "tests/unit/import/ingest-worker.test.ts#02-06 -- W-1: a lookalike LOGIN / BIRTH_DATE header persists no sensitive value"
        status: pass
    human_judgment: false
  - id: D3
    description: "A key mixing ASCII letters with a letter or invisible character the fold cannot resolve and that reads as a deny-listed name withholds the whole file with every data line counted and a log carrying no text; every key 02-05 withheld stays withheld; real and native-script headers are untouched (W-1)"
    requirement: "IMPORT-03"
    verification:
      - kind: unit
        ref: "tests/unit/import/csv-parse.test.ts#an unfoldable disguised name withholds the whole file, preservation controls, negative controls, hasGluedSensitiveColumn -- W-1 lookalikes"
        status: pass
    human_judgment: false
  - id: D4
    description: "A file mixing CRLF, bare CR and LF splits every record on its own terminator with skippedCount 0; a stray quote costs exactly its own physical line (count 1, valid neighbours kept, line 3 logged); the quarantine cap accounts identically under alternating terminators (W-2)"
    requirement: "IMPORT-03"
    verification:
      - kind: unit
        ref: "tests/unit/import/csv-parse.test.ts#parseCsvFile -- W-2 (M1 to M9, M5b and M5c controls)"
        status: pass
      - kind: unit
        ref: "tests/unit/import/ingest-worker.test.ts#02-06 -- W-2: mixed terminators through the real worker"
        status: pass
    human_judgment: false
  - id: D5
    description: "No regression in the import, dashboard skip-tag, identity-privacy and zero-network end-to-end flows"
    requirement: "IMPORT-04"
    verification:
      - kind: e2e
        ref: "playwright test tests/e2e/import tests/e2e/shell/dashboard.spec.ts tests/e2e/shell/identity-privacy.spec.ts tests/e2e/guards/zero-network.spec.ts --project=chromium"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-11
status: complete
---

# Phase 2 Plan 06: Lookalike header keys and mixed terminators Summary

**One shared NFKC-plus-bounded-fold header-key normaliser makes the D-18 strip and the fail-closed withhold hold for fullwidth, Cyrillic and Greek lookalike LOGIN / BIRTH_DATE names, and a terminator-aware parse splits mixed CRLF / CR / LF files on each record's own terminator.**

## Performance

- **Duration:** 8 min (2026-10-11T10:41 to 10:49 local)
- **Tasks:** 3 (two code tasks, one verification gate)
- **Files modified:** 4

## Accomplishments

- **W-1 (privacy):** `normalizeKey` in `identity.ts` is now NFKC, trim, upper-case, then a bounded confusable fold built from explicit code points (UTS #39 v18.0.0), with an exact fast path for ASCII keys. The strip, the glued check and the identity pick all use it, so the withhold trigger and the strip cannot disagree. The verifier's `ID;<fullwidth LOGIN>` and `ID;L<Cyrillic O>GIN` repros now return `[{"ID":"1"}]`.
- **W-1 fail closed:** `hasGluedSensitiveColumn` keeps the 02-05 raw-key split verbatim and ORs in three rules: a name glued only after folding, a name exposed by removing invisible characters, and a resemblance walk on the pre-fold form that reads a token with an ASCII anchor plus unresolved non-ASCII letters as a deny-listed name. Armenian Oh, Coptic O, accented O, a zero-width space or soft hyphen inside the name, and `LOGIN_` plus a non-ASCII digit withhold the whole file with every data line counted.
- **W-2 (parser correctness):** `parseCsvFile` rewrites every CRLF and bare CR to LF and passes `newline: '\n'` when two or more terminator kinds occur anywhere in the text. The verifier's three probes now give one row per line with `skippedCount` 0, and with a stray quote the valid neighbour survives and the count is exactly 1 at line 3. Uniform files are untouched.
- **Additivity checked beyond the planned cases:** a 300,000-key fuzz (insertions of zero-width, accented, fullwidth, Cyrillic, Greek, Armenian and Arabic-Indic characters into the three names, plus random strings) found 11,482 keys the 02-05 rule flagged and zero that the new predicate releases.

## Task Commits

1. **Task 1 (tracer): W-1 end to end, shared fold and fail-closed resemblance rule** - `297b647` (fix)
2. **Task 2: W-2 terminator-aware splitting** - `541dbe2` (fix)
3. **Task 3: full regression gate** - verification only, no commit

Each code task landed as one commit holding tests and implementation (the 02-05 convention); the RED runs below were taken on the unmodified tree before each implementation was written.

## RED evidence (taken before each implementation)

- **Task 1, `-t "W-1"` on the unmodified tree:** 47 tests, 32 failed, 15 passed. The 15 passes are exactly the tagged controls: dotless-i / long-s strip, the 8 preservation `hasGluedSensitiveColumn` shapes, the 2 preservation header runs, the 2 negative controls (real and native-script headers, duplicated LOGIN), and the 2 predicate controls (foldable keys not withheld, native-script names not withheld). All other cases failed for the stated reason (value persisted under the lookalike key, or rowCount 8 instead of 0).
- **After the normaliser and predicate:** 47 of 47 W-1 tests green, and the 487 tests of the four suites in the task verify green.
- **Task 2, `-t "W-2"` on the Task 1 tree:** 13 tests, 11 failed (M1 to M4, M5, M6 to M9 and both worker cases, with the glued-cell and lost-record shapes the plan describes), 2 passed (the M5b uniform-CRLF and M5c Excel-style controls). After the change 13 of 13 green.

## Gate results (Task 3)

| Step | Result |
|------|--------|
| `pnpm run test:unit` | 87 files, 2794 tests, all passed |
| `pnpm run check` | tsc -b clean; svelte-check 306 files, 0 errors, 0 warnings |
| ESLint + Prettier on the four touched files | clean |
| Playwright (import, dashboard, identity-privacy, zero-network; chromium) | 76 passed |
| Consumer sweep (`tests/unit/import finance vehicles logins playtime shell/identity`) | 48 files, 1520 tests passed |

## Files Modified

- `src/lib/worker/identity.ts` - shared normaliser, fold table, additive predicate, resemblance walk, rewritten header rule 1 and JSDoc policy
- `src/lib/worker/csv-parse.ts` - `hasMixedTerminators`, terminator canonicalisation, `newline` threaded through every parse, header item 8
- `tests/unit/import/csv-parse.test.ts` - W-1 and W-2 describe blocks (`const LF` added)
- `tests/unit/import/ingest-worker.test.ts` - W-1 worker tracer and W-2 worker block

No UI, Phase 8, `ingest.worker.ts`, `db.ts`, fixture, dependency or Playwright-spec file was touched.

## Deviations from Plan

None - plan executed exactly as written. No existing test expectation, fixture or console tag was changed.

Notes on execution that are not deviations:

- The fast path in `prefoldKey` is "no non-ASCII character" (`\P{ASCII}`) rather than "printable ASCII". NFKC is the identity on all of ASCII, so the result is the same trim and upper-case for every ASCII key including ones with tab or other control characters.
- The resemblance walk keeps the reached target positions as a bit mask instead of a `Set` (allowed by "a walk over a set of target positions"), which keeps the work allocation-free for a very long hostile key.
- The first draft of the new test blocks contained literal lookalike characters because the shell tool decoded the u-escapes in the command text. They were converted back to u-escapes (94 and 21 occurrences) before the RED run was recorded and before any commit, so no literal lookalike character exists in the committed test source.

## Threat Flags

None. No new endpoint, auth path, file access or schema surface was added. Threat register T-02-20, T-02-21, T-02-24 and T-02-26/27 are mitigated as planned; T-02-22, T-02-23 and T-02-25 are accepted and recorded in the `identity.ts` JSDoc and the `csv-parse.ts` header.

## Known Stubs

None.

## Issues Encountered

None.

## Self-Check: PASSED

- `src/lib/worker/identity.ts`, `src/lib/worker/csv-parse.ts`, `tests/unit/import/csv-parse.test.ts`, `tests/unit/import/ingest-worker.test.ts` exist and carry the changes above.
- Commits `297b647` and `541dbe2` are ancestors of HEAD; `git rev-list --count df68145..HEAD` was 2 at SUMMARY time.
