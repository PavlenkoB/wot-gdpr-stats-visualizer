---
phase: 02-defensive-parsing-persistent-dataset
verified: 2026-10-11T06:53:19Z
status: passed
score: 57/61 must-haves verified (1 via accepted override for D-05, 4 UNCERTAIN routed to human) · 02-06 gap closure: 11/11 truths and 7/7 prohibitions verified · W-1 closed · W-2 closed · 4/4 ROADMAP success criteria met in code · 6/6 requirement IDs satisfied (IMPORT-01, IMPORT-03, IMPORT-04, IMPORT-06, DATA-01, DATA-02)
covered_files: [".planning/phases/02-defensive-parsing-persistent-dataset/02-01-PLAN.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-01-SUMMARY.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-02-PLAN.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-02-SUMMARY.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-03-PLAN.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-03-SUMMARY.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-04-PLAN.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-04-SUMMARY.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-05-PLAN.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-05-SUMMARY.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-06-PLAN.md", ".planning/phases/02-defensive-parsing-persistent-dataset/02-06-SUMMARY.md", "src/App.svelte", "src/lib/core/types/worker-messages.ts", "src/lib/import/ingest-client.ts", "src/lib/import/precheck.ts", "src/lib/import/worker-client.svelte.ts", "src/lib/shell/ConfirmPanel.svelte", "src/lib/shell/Dashboard.svelte", "src/lib/shell/DashboardSection.svelte", "src/lib/shell/Dropzone.svelte", "src/lib/shell/FailureBanner.svelte", "src/lib/shell/ImportBar.svelte", "src/lib/shell/ImportSummary.svelte", "src/lib/ui-copy.ts", "src/lib/worker/classify.ts", "src/lib/worker/csv-parse.ts", "src/lib/worker/db.ts", "src/lib/worker/hash.ts", "src/lib/worker/identity.ts", "src/lib/worker/ingest.worker.ts", "src/lib/worker/mojibake.ts", "tests/e2e/import/import-flow.spec.ts", "tests/e2e/import/persistent-dataset.spec.ts", "tests/e2e/shell/dashboard.spec.ts", "tests/fixtures/export-fixtures.ts", "tests/unit/import/csv-parse.test.ts", "tests/unit/import/db.test.ts", "tests/unit/import/hash.test.ts", "tests/unit/import/ingest-client.test.ts", "tests/unit/import/ingest-worker.test.ts", "tests/unit/import/mojibake.test.ts", "tests/unit/shell/identity.test.ts"]
covered_digest: "v3:sha256:7e77e52b957190a7e3542212287e10bb63e1d8c190d0b8ef5cf7948ce1d0c4ce"
behavior_unverified: 0
overrides_applied: 1
re_verification:
  previous_status: human_needed
  previous_score: 46/50 truths (1 via override, 4 UNCERTAIN) after 02-05
  gaps_closed:
    - "W-1: non-ASCII lookalike header keys (fullwidth, Cyrillic, Greek, Turkish dotted I) bypassed the glued withhold and the D-18 strip, so the e-mail and birth date persisted under the lookalike key (02-06 Task 1: one shared NFKC, trim, upper-case, bounded fold normaliser; additive predicate; pre-fold resemblance rule that withholds unresolvable disguised names)"
    - "W-2: terminators mixed inside one file glued records with skippedCount 0, and with a stray quote one valid record was lost while the count said 1 (02-06 Task 2: when two or more terminator kinds occur, CRLF and bare CR become LF and PapaParse is told newline LF)"
  gaps_remaining: []
  regressions: []
gaps: []

overrides:
  - must_have: "A category badge always shows its row count, including \"0 rows\", never blank or omitted (D-05)"
    reason: "Superseded by Phase 8 (master-detail redesign, 08-01/08-05): a present zero-row folder reads 'This export contains no rows for <Folder>' and the two empty-state wordings never collapse. The row count for non-empty folders is unchanged."
    accepted_by: "Bohdan_Pavlenko"
    accepted_at: "2026-10-10T18:15:20Z"

deferred: []

behavior_unverified_items: []

human_verification:
  - test: "Long category name at phone width (truth 14)"
    expected: "The 'From <folder> · N files, M rows' provenance line wraps cleanly with no clipping and no horizontal page scroll at 375px."
    why_human: "Visual wrapping cannot be judged from source."
  - test: "Mojibake edge cases beyond the documented pattern (truth 13)"
    expected: "A human decision that the documented Cyrillic pattern plus the listed cases is enough, or new held-out or property-based tests."
    why_human: "The fix is not proven exhaustively for every encoding edge case."
  - test: "Skip tag and progress text at 10x scale on a phone (truths 20, 21)"
    expected: "No mid-word wrap and no horizontal overflow from the skip tag at 375px while 'Parsing <Cat> (i/n)...' and '<N> rows skipped' are shown."
    why_human: "The e2e asserts text, not wrap or overflow of the tag specifically."
---

# Phase 2: Defensive Parsing & Persistent Dataset Verification Report

**Phase Goal:** The worker parses every supported CSV in the export defensively and stores the result in IndexedDB as a single active dataset. The dataset survives reloads, identical re-uploads are skipped, and the user can wipe it at any time.
**Verified:** 2026-10-11T06:53:19Z
**Status:** human_needed (override accepted for D-05; 4 UNCERTAIN items remain for human check; no FAILED truth, no BLOCKER)
**Re-verification:** Yes. Third pass, after gap-closure plan 02-06 (commits 297b647 for W-1 and 541dbe2 for W-2). The prior report (02-05, 2026-10-10T19:43:07Z) was stale against the changed `identity.ts` and `csv-parse.ts`. The 02-06 truths were re-derived from current code. Prior truths were re-checked where 02-06 touched their code path, and carried otherwise (see Observable Truths).

## Goal Achievement

The phase goal holds in code. Parsing is defensive per file, the single active dataset is written in one IndexedDB transaction, reloads restore it, identical re-uploads are skipped before unzip, and clear wipes the store. Plan 02-06 closes both open warnings: lookalike header keys no longer persist the e-mail or birth date, and a file that mixes CRLF, bare CR and LF splits every record on its own terminator.

### Roadmap Success Criteria (ROADMAP.md, Phase 2)

| SC | Criterion (abridged) | Covering truths | Status |
|----|----------------------|-----------------|--------|
| 1 | Reload keeps per-category counts without re-upload; unzip, parse and write in the worker; a 10x export imports with progress per category and no freeze | 1, 7, 9, 15, 19 | VERIFIED (truth 19 by the reported e2e run, not re-executed here) |
| 2 | CRLF or bare-CR-only files, missing and extra columns import without errors; double-UTF8 Cyrillic reads correctly | 4, 5, 10, 18, 51-60 | VERIFIED (W-2 mixed-terminator case now also verified) |
| 3 | Identical re-drop is reported as already loaded and skipped before unzip or parse; a different zip fully replaces the dataset | 2, 3, 24, 30 | VERIFIED |
| 4 | "Clear my cached data" deletes all cached rows; after reload the app is in the empty upload state | 26, 27, 31 | VERIFIED |

### Observable Truths

Truths 1-50 are carried from the 02-01 to 02-05 passes. Truths 51-61 are the 02-06 must-haves, added in this pass.

Carry-forward basis: 02-06 changed only `src/lib/worker/csv-parse.ts`, `src/lib/worker/identity.ts` and two unit test files (diff `9482778..HEAD`). `ingest.worker.ts`, `db.ts`, `mojibake.ts`, `hash.ts`, all Svelte components and all Playwright specs are unchanged. Truths whose code path 02-06 did not touch are carried from the 02-05 report, and the 245 named unit tests of this pass (which include `db.test.ts` and `ingest-worker.test.ts`) still pass.

Re-checked directly in this pass because 02-06 touched their path:

- **Truth 4 (mojibake on every kept row):** `csv-parse.ts` `keep()` still applies `fixMojibake` to every string value of every kept record. VERIFIED.
- **Truth 5 and truth 10 (ragged rows never abort):** only `Quotes` errors are handled structurally. A CR-03-style short row (`99`) is kept with skippedCount 0, and the ID and NAME keys are kept. VERIFIED.
- **PII strip not bypassed:** the choke point `ingest.worker.ts` (sanitise when `hasSensitiveColumn(raw)`) is unchanged. Probes of 16 lookalike keys (fullwidth, Cyrillic, Greek, Turkish dotted I, combining marks, invisible characters) persist neither the e-mail nor the birth date under User_Info or a misfiled folder. VERIFIED.
- **02-05 CR-01, CR-02, CR-03 still fixed:** CR-01 (uniform stray quote keeps 1, 5, 7, skip 1), CR-02 (blank-line shift keeps r0, r3, r4, skip 1), CR-03 (two-column short row keeps ID and NAME, skip 0; `LOGIN;BIRTH_DATE` glued header withheld). VERIFIED.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sample export writes every detected category to one IndexedDB dataset in one worker transaction | VERIFIED | `ingest.worker.ts` unchanged. `db.test.ts` passed in this run. |
| 2 | Hash-identical re-import is reported `duplicate` before any unzip or classify work | VERIFIED | Named test "(b) a second ingest of identical bytes posts duplicate..." passed in `ingest-worker.test.ts` this run. |
| 3 | `writeDataset` clears every row from the previous import | VERIFIED | Named test in `db.test.ts` passed this run. |
| 4 | Every CSV string field goes through round-trip-or-reject mojibake fix | VERIFIED | Re-checked above. `mojibake.test.ts` passed this run. |
| 5 | A ragged (missing or extra column) row never aborts the file | VERIFIED | Re-checked above. Only `Quotes` is structural. |
| 6 | A category badge always shows its row count, including "0 rows" | PASSED (override) | Override accepted by Bohdan_Pavlenko (see `overrides`). Badges no longer exist; Phase 8 superseded the wording. |
| 7 | Per-category progress text while importing | VERIFIED | Worker posts `stage: 'parsing'` per category. Unchanged by 02-06. |
| 8 | Every new failure source uses the existing generic banner | VERIFIED | `worker-client.svelte.ts` `#fail` unchanged. |
| 9 | Papa.parse and the Dexie write never run on the main thread | VERIFIED | Single `new Worker` site. `csv-parse.ts` keeps `worker: false` (lines 222-230). |
| 10 | A field-count mismatch in one row does not abort parsing of the rest | VERIFIED | Re-checked above. |
| 11 | `fixMojibake('')` returns `''` and never throws | VERIFIED | `mojibake.ts` unchanged; named tests passed. |
| 12 | `bulkPut` and the meta record update share one transaction | VERIFIED | `db.ts` unchanged; `db.test.ts` passed. |
| 13 | (backstop) Mojibake round-trip is proven for every encoding edge case | UNCERTAIN | Only the documented real-sample pattern and listed edge cases are tested. Routed to human (item 2). |
| 14 | (backstop) Long category name fits at phone width without truncation | UNCERTAIN | Visual check not performed. Routed to human (item 1). |
| 15 | Reload shows results view with unchanged counts and an import timestamp, with zero new `ingest` messages | VERIFIED | `check-cache` on `ready`; `resultFromMeta` rebuilds from meta. Unchanged. |
| 16 | Fresh browser shows "Checking for a saved export..." then the empty dropzone | VERIFIED | `App.svelte` `checking-cache` branch. Unchanged. |
| 17 | Per-category skip tag shows only when skipped > 0, both right after import and on return visit | VERIFIED | `ImportSummary.svelte` `hasSkipped` gate; `skippedRowCount` persisted in meta. Unchanged. |
| 18 | Real-sample double-UTF8 Cyrillic comes out readable | VERIFIED | Named test "exact PROJECT.md double-UTF8" passed. |
| 19 | 10x-scale import advances progress without a main-thread long task of 1 s or more | VERIFIED (by reported e2e run) | e2e (c) in `persistent-dataset.spec.ts`. Not re-executed here (orchestrator runs Playwright). |
| 20 | Skip-count tags stay inside the list flex container and cause no horizontal overflow at narrow width | UNCERTAIN | Routed to human (item 3). |
| 21 | (backstop) Progress and skip text at 10x scale fit on one line at phone width | UNCERTAIN | Routed to human (item 3). |
| 22 | A skip-count of 0 never renders a skip tag | VERIFIED | `ImportSummary.svelte` and `DashboardSection` gate on `> 0`. |
| 23 | The cache check never shows the dropzone or results before it resolves | VERIFIED | `App.svelte` `checking-cache` branch. |
| 24 | Dropping a different zip while cached shows a confirm; old dataset stays until confirmed | VERIFIED | `submitFiles` replace guard. |
| 25 | Start Over requires confirmation and wipes IndexedDB | VERIFIED | `confirmPending` posts `clear-data`; worker `clearData()`. |
| 26 | "Clear my cached data" is visible only when a dataset is cached | VERIFIED | `ImportBar.svelte` `persistent-bar` only in `slim` variant. |
| 27 | Confirmed clear shows "Cached data cleared" before the empty dropzone | VERIFIED | `cleared` handler; `CLEARED_ACK_MESSAGE`. |
| 28 | No native `confirm()` or `alert()` in any destructive flow | VERIFIED | Grep of `src` finds no `confirm(` or `alert(` call. |
| 29 | Start Over and Clear share one confirm component and copy | VERIFIED | `App.svelte` `confirmCopy`; one `ConfirmPanel`. |
| 30 | Replace-on-drop fully replaces the previous dataset with no old rows | VERIFIED | Named test "a second writeDataset with a DIFFERENT hash clears every row" passed. |
| 31 | Confirmed "Clear my cached data" removes every row and the meta record | VERIFIED | Named test "clearData() leaves zero rows and removes the 'active' meta record" passed. |
| 32 | Confirmed-clear acknowledgment is shown before the empty dropzone | VERIFIED | Same as truth 27. |
| 33 | ConfirmPanel uses amber chrome, neutral dismiss, red commit for all three flows | VERIFIED | `ConfirmPanel.svelte` unchanged. |
| 34 | A file dropped while a dataset is cached is never ingested without a confirm | VERIFIED | Same guard as truth 24. |
| 35 | Cancelled confirm never changes the cached dataset or view | VERIFIED | Carried from the 02-03 named test (`ingest-client.test.ts`, not re-run in this pass's five-file set). |
| 36 | (02-04) Dropzone is reachable while a dataset is displayed and replace-on-drop confirms | VERIFIED (behavior) | Literal `ResultsView` co-render superseded by Phase 8. Covered by e2e (d), (g). |
| 37-41 | (02-04) Remaining literal clauses | VERIFIED (behavior) | Same reason as 36. |
| 42 | (02-05, CR-03) Two-column semicolon file with one short row parses under real keys ID, NAME with zero skipped rows | VERIFIED | Re-checked above. Delimiter from the header line only (`chooseDelimiter`). |
| 43 | (02-05, CR-03, D-18) LOGIN;BIRTH_DATE plus ragged row through the real worker persists no LOGIN or BIRTH_DATE value | VERIFIED | Named test "02-05 -- CR-03: a ragged LOGIN;BIRTH_DATE file persists no sensitive value" passed. |
| 44 | (02-05, CR-03 fail-closed) A quoted or mixed-delimiter glued header withholds the whole file | VERIFIED | Probes: `"LOGIN;BIRTH_DATE"` and `ID,LOGIN;BIRTH_DATE` give rows [] with the value absent. Named tests D to G passed. |
| 45 | (02-05, CR-03 negative control) LOGIN_DT;IP;COUNTRY_CODE;USER_AGENT and LOGIN_1 are NOT withheld | VERIFIED | Probe: the real Logins header is kept verbatim with skippedCount 0 and no log. |
| 46 | (02-05, CR-02) Blank lines before a malformed row drop exactly that row | VERIFIED | Re-checked above (r0, r3, r4). |
| 47 | (02-05, CR-02) CRLF-led, blank-interleaved export shape imports with only the malformed record dropped | VERIFIED | Named worker test "CR-01/CR-02: the real-shape malformed Bans file" passed. |
| 48 | (02-05, CR-01) A single unbalanced quote does not swallow the remainder | VERIFIED | Re-checked above. |
| 49 | (02-05, CR-01, D-04) Beyond MAX_QUARANTINED_RECORDS the remainder is withheld AND counted | VERIFIED | Cap probe: 1,000 quarantines plus a remainder log; every line counted. `MAX_QUARANTINED_RECORDS = 1000` unchanged. |
| 50 | (02-05, privacy) Skip and withhold logs carry structure only, never cell or header text | VERIFIED | Every `console.error` in `csv-parse.ts` logs category, sourceFile, line, reason, lines only. The withhold dump in probes contains no value. |
| 51 | (02-06, W-1) A foldable lookalike LOGIN, BIRTH_DATE or BIRTH_DATE_SRC header is stripped like the ASCII name, the other columns are kept, and skippedCount is 0 | VERIFIED | Probes: `ID;<fullwidth LOGIN>` and `ID;L<U+041E>GIN` give sanitised rows [{"ID":"1"}] and skippedCount 0. Named tests "W-1: the verifier repros (verbatim)" and "W-1: foldable lookalikes are stripped" passed (`csv-parse.test.ts`). |
| 52 | (02-06, W-1, worker) Through the real worker a foldable lookalike header persists no e-mail or birth date in User_Info or a misfiled folder; persisted key list is exactly [ID, NAME] | VERIFIED | Named block "02-06 -- W-1: a lookalike LOGIN / BIRTH_DATE header persists no sensitive value" passed (`ingest-worker.test.ts`). Probe of 16 hunt keys on both persistence paths: no value persisted. |
| 53 | (02-06, W-1) An unresolvable disguised name withholds the whole file: rows [], every data line counted, one tagged log, no text | VERIFIED | Probes: Armenian Oh U+0555, Coptic O U+2C9E, accented O U+00D3, palochka + "ogin", Greek iota + "ogin" each give rows [], skippedCount equal to the data lines, one `file withheld` log, no value in the log. Named unfoldable group passed. |
| 54 | (02-06, W-1 negative controls) Real and native-script headers are neither stripped nor withheld; a duplicated LOGIN (LOGIN_1) is not withheld and is stripped by the existing rule | VERIFIED | Probes: Logins header kept verbatim; `ID;LOGIN_1;X` kept, persisted as {ID, X}; Cyrillic name header kept; `L` + U+00C9 + `GION` kept (not withheld). |
| 55 | (02-06, W-1) The predicate is additive: nothing 02-05 withheld is released | VERIFIED | Fuzz: 300,000 random keys over the name and lookalike alphabet, comparing the pre-02-06 predicate (commit 9482778) with the current one: 0 withholds released, 897 new-only withholds, 0 strip regressions. Preservation probes (ID + U+200B + LOGIN, LOGIN + U+00E9 + BIRTH_DATE, LOGIN + en dash + DT, LOGIN + fullwidth A, LOGIN + U+FF3F + 1, LOGIN + U+200B, glued header) all withheld. |
| 56 | (02-06, W-1) An I/l-ambiguous letter standing for the L of a lower-case login cannot hide the L; the same letter standing for the I of LOGIN is stripped | VERIFIED | Probe: palochka + "ogin" withheld. Named foldable tests (Ukrainian I and palochka standing for I) passed and strip. Resemblance reads the pre-fold form (`identity.ts` 301-302). |
| 57 | (02-06, W-1) One shared key normaliser for the strip, the withhold and the identity pick | VERIFIED | Code read: `normalizeKey` (`identity.ts` 161) is used by `hasSensitiveColumn` (191), `sanitizeUserInfoRow` (328) and `pick` (342). The predicate reads `prefoldKey` (302) through the same helper. The FOLD table (115-132) matches the plan's code points exactly (A, B, C, D, E, G, H, I, N, O, S, T). `normalizeKey` is not exported and does not strip ignorable characters. |
| 58 | (02-06, W-2) In a file mixing CRLF, bare CR and LF, every record splits on its own terminator with skippedCount 0 and no `__parsed_extra` | VERIFIED | Probe 1 (`A;B` CRLF `1;2` LF `3;4` CRLF `5;6` CRLF) gives 3 clean rows, skippedCount 0. Probe 2 (bare CR inside a CRLF file) gives 4 rows, skippedCount 0. Named "02-06 -- W-2" worker block and parser W-2 blocks passed. |
| 59 | (02-06, W-2, D-03/D-04) In a mixed file with one stray quote only the physical line holding the opening quote is quarantined and counted | VERIFIED | Probe 3 (`A;B` CRLF `1;2` LF `3;"abc` CRLF `4;5` CRLF `6;7` CRLF) gives 1, 4, 6 kept, skippedCount 1, one log with line 3. Bare-CR plus stray-quote variant gives 1, 4, 6 kept, skip 1. |
| 60 | (02-06, W-2) Line breaks inside quoted cells stay in the cell; uniform files keep their cell bytes; the common Excel-style file keeps its exact LF | VERIFIED | Uniform LF cell `x\ny` and uniform CRLF cell `x\r\ny` are byte-identical. Excel-style CRLF file with in-cell LF keeps `x\ny` and 3 rows. Fuzz: 4,000 random uniform-terminator files give output identical to the pre-02-06 parser (0 differences); 3,000 random Excel-style files give output identical to the pre-02-06 parser (0 differences). The stated cost (a CR or CRLF inside a quoted cell of a MIXED file becomes LF) is confirmed by probe and is documented in the `csv-parse.ts` header item 8. |
| 61 | (02-06, preservation of 02-05) Every 02-05 behaviour, including the CR-01/CR-02/CR-03 tests and the cap accounting under alternating terminators, is preserved | VERIFIED | CR-01, CR-02, CR-03 re-checked above. Cap under alternating CRLF/LF/CR terminators: 1,000 quarantines, remainder withheld and tagged, every line counted (rows 1,001, skippedCount 1,003). `git diff` of both test files shows zero deleted lines: no existing expectation changed. |

**Score:** 57/61 truths verified (1 via accepted override, truth 6) · 4 UNCERTAIN (truths 13, 14, 20, 21, routed to human) · 0 FAILED · 0 PRESENT_BEHAVIOR_UNVERIFIED.

### Warnings

- **W-1 (non-ASCII lookalike header keys): CLOSED.** Probes of the verifier's two repros (`ID;ＬＯＧＩＮ` and `ID;LОGIN`) now persist no e-mail and give the sanitised row `[{"ID":"1"}]`. Verified through the persistence rule (User_Info and misfiled), 16 hunt keys and the 300,000-key additivity fuzz. The unresolvable residual is withheld, not persisted.
- **W-2 (terminators mixed inside one file): CLOSED.** Probes 1, 2 and 3 of the verifier now give one row per line with skippedCount 0, and with a stray quote the valid neighbours survive and the count is exactly 1 at line 3. Uniform files are byte-identical to the pre-02-06 parser (4,000 generated files). The scope question from decision item 5 is answered by the implementation (records split on their own terminator). The cost, a CR or CRLF inside a quoted cell of a mixed file becoming LF, is stated in code and in T-02-25; it is informational, not a gate.
- **New warnings: none.**

### Deferred Items

None. The Phase 2 review warnings WR-01..WR-04 and info items IN-01..IN-06 are out of scope by plan prohibition and remain open. They are not phase-2 must-haves.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/worker/identity.ts` | Shared normaliser (NFKC, trim, upper-case, bounded fold), additive `hasGluedSensitiveColumn`, unchanged strip | VERIFIED | 460 lines, substantive. Imported by `csv-parse.ts` (line 2) and `identity` callers. Strip and pick use the same `normalizeKey`. |
| `src/lib/worker/csv-parse.ts` | Header-line delimiter, fail-closed withhold, blank mapping, physical-line quarantine, cap, terminator canonicalisation | VERIFIED | 399 lines, substantive. `hasMixedTerminators` (103-110), canonicalisation (254-256), `newline` threaded through `parseOnce` (221-231). Wired: `ingest.worker.ts` line 818 calls `parseCsvFile`. |
| `tests/unit/import/csv-parse.test.ts` | W-1 and W-2 describe blocks | VERIFIED | Blocks at lines 661-1013+. Named run: 245 tests passed across five files. |
| `tests/unit/import/ingest-worker.test.ts` | "02-06 -- W-1" and "02-06 -- W-2" worker blocks | VERIFIED | Blocks at lines 2857 and 2966. Passed. |
| `src/lib/worker/ingest.worker.ts`, `db.ts`, `mojibake.ts`, `hash.ts` | Unchanged by 02-06 | VERIFIED | `git diff 9482778 HEAD` lists only the four 02-06 files. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `csv-parse.ts parseCsvFile` | `identity.ts hasGluedSensitiveColumn` | import line 2; called at line 268 on `meta.fields` | WIRED | Signature and boolean result unchanged; withhold runs before any row is read. |
| `identity.ts normalizeKey` | `hasSensitiveColumn`, `sanitizeUserInfoRow`, `pick` | direct calls at lines 191, 328, 342 | WIRED | One normaliser. The predicate uses `prefoldKey` through the same helper (line 302). |
| `csv-parse.ts` | `ingest.worker.ts` line 818 | `ParsedFile { rows, skippedCount }` shape unchanged | WIRED | No worker edit in 02-06. |
| `ingest.worker.ts` row choke point | `sanitizeUserInfoRow` | `hasSensitiveColumn(raw)` on each row | WIRED | Unchanged. Lookalike keys are caught by the shared normaliser. |
| `ingest-worker.test.ts` 02-06 blocks | real ingest worker | same mocked-self harness as 02-05 | WIRED | Named blocks pass. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Parsed rows | `parsed.rows` | `parseCsvFile` harvest (`keep`) with `fixMojibake` | Yes | FLOWING |
| Persisted User_Info rows | sanitised `data` | `sanitizeUserInfoRow` at choke point | Yes; no lookalike e-mail or birth date reaches the write | FLOWING, PII-safe |
| Skip tag | `skippedCount` | `parseCsvFile` | Yes | FLOWING |

### Behavioral Spot-Checks

Named tests run by this verifier (one command, five files):

`pnpm exec vitest run tests/unit/import/csv-parse.test.ts tests/unit/import/ingest-worker.test.ts tests/unit/import/mojibake.test.ts tests/unit/import/db.test.ts tests/unit/shell/identity.test.ts`

Result: 5 files, 245 tests passed, exit 0.

Direct probes (scratch scripts in the session scratchpad, outside the repo; Node 26 with `--experimental-strip-types`; nothing added to the repo):

| Behavior | Method | Result | Status |
|----------|--------|--------|--------|
| W-1 verifier repros, persisted view | `parseCsvFile` then the worker persistence rule | `[{"ID":"1"}]`, skippedCount 0, no e-mail | PASS |
| 16 hunt keys (lookalikes, invisibles, combining marks) | both persistence paths | no e-mail or birth date persisted | PASS |
| 7 glued preservation shapes and 2 glued header forms | `parseCsvFile` | rows [], every data line counted | PASS |
| Unresolvable disguised names (5 shapes) | `parseCsvFile` | rows [], one log, no value | PASS |
| Native-script, real and duplicate-LOGIN negative controls | `parseCsvFile` | kept, not withheld | PASS |
| W-2 probes 1, 2, 3 and bare-CR plus stray quote | `parseCsvFile` | 3 rows / 4 rows / 1,4,6 with skip 1 at line 3 | PASS |
| CR-01, CR-02, CR-03 repros | `parseCsvFile` | recovered rows and counts as in 02-05 | PASS |
| Cap under alternating terminators (1,000 quarantines) | `parseCsvFile` | remainder withheld and tagged; all lines counted | PASS |
| Predicate additivity vs commit 9482778 | 300,000 random keys | 0 released, 0 strip regressions | PASS |
| Uniform-terminator files vs commit 9482778 | 4,000 random files | 0 differences | PASS |
| Excel-style CRLF with in-cell LF vs commit 9482778 | 3,000 random files | 0 differences | PASS |

Note on the probe method: the raw parser output keeps lookalike keys by design, because stripping happens in the worker (`ingest.worker.ts` line 883). Persistence was therefore checked on the sanitised view, which is the rule the worker applies. A first probe pass that compared raw output was discarded as a probe artifact, not a parser fault.

Probe execution: no probes declared for this phase (`scripts/*/tests/probe-*.sh`). Skipped with reason "no probe declared".

Not re-run by this verifier, per the request: the full unit suite and the Playwright run. The orchestrator's background run is the source for them. The 02-06 SUMMARY reports 2,794 unit tests and 76 Playwright tests passing; this report does not claim those numbers.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| IMPORT-01 | 02-01, 02-02 | Drop a zip, unzip and parse client-side in one long-lived Worker | SATISFIED | One `new Worker` site. Truth 9. |
| IMPORT-03 | 02-01, 02-02, 02-05, 02-06 | CSV tolerant of unexpected or missing columns and mixed terminators | SATISFIED (strengthened by 02-06) | Truths 5, 10, 42-47, 51-61. Mixed terminators within one file now split on their own terminator (truths 58-60). |
| IMPORT-04 | 02-01, 02-02, 02-05, 02-06 | Double-UTF8 mojibake corrected on parse | SATISFIED | Truths 4, 18, 60. Edge-case proof routed to human (item 2). |
| IMPORT-06 | 02-01, 02-03 | New zip replaces the dataset; identical zip detected by hash and skipped | SATISFIED | Truths 2, 3, 24. |
| DATA-01 | 02-01, 02-02 | Parsed data cached in IndexedDB (Dexie 4, bulkPut); survives reloads | SATISFIED | Truths 12, 15. |
| DATA-02 | 02-03 | "Clear my cached data" control wipes the cache | SATISFIED | Truths 26, 27, 31. |

Orphaned requirements: none. REQUIREMENTS.md maps IMPORT-01, 03, 04, 06, DATA-01 and DATA-02 to Phase 2; all six appear in plan frontmatter.

### Prohibitions

| Prohibition | Status | Evidence |
|-------------|--------|----------|
| (02-06) Do not address WR-01..04 or IN-01..06; do not touch Svelte, `App.svelte`, `src/lib/shell/**`, `src/lib/import/**`, Phase 8 files, `ingest.worker.ts`, `db.ts` or fixtures | VERIFIED | `git diff --name-only 9482778 HEAD` lists exactly `csv-parse.ts`, `identity.ts`, `csv-parse.test.ts`, `ingest-worker.test.ts`. |
| (02-06) Do not add or edit a Playwright spec | VERIFIED | No `tests/e2e/**` file in the diff. |
| (02-06) No PapaParse worker mode, no dependency, no network call, no runtime Unicode fetch | VERIFIED | `worker: false` (csv-parse.ts 222-230); `package.json` and lockfile untouched; no `fetch`, XHR or WebSocket in either source file; fold table is numeric code points. |
| (02-06) Do not rename `hasGluedSensitiveColumn`, change its boolean result, export `normalizeKey`, or strip ignorables inside `normalizeKey` | VERIFIED | `normalizeKey` (161) has no `export` and no ignorable strip; the predicate (281) returns boolean. |
| (02-06) Do not narrow the 02-05 per-key split; run it on the raw key | VERIFIED | Raw-key rule verbatim at `identity.ts` 284-285; OR-ed with the new rules. Fuzz: 0 released. |
| (02-06) Do not canonicalise uniform files | VERIFIED | Canonicalisation gated on `hasMixedTerminators` (254-256). Fuzz: 4,000 uniform files identical. |
| (02-06) Do not adjust an existing test expectation, fixture or console tag | VERIFIED | `git diff` of both test files shows zero deleted lines. Source deletions are comments and the two signatures changed to thread `newline`. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `csv-parse.ts`, `identity.ts`, both 02-06 test files | - | `TBD`, `FIXME`, `XXX` | None | Debt-marker grep on the four 02-06 files: no matches. Gate passes. |
| `src/lib/worker/csv-parse.ts` | header item 8 | In a MIXED file, a CR or CRLF inside a quoted cell becomes LF | Info | Stated cost, T-02-25 accepted. The record is never split and uniform files are unaffected. Excel-style files with an in-cell LF only are unchanged (3,000 generated files). |
| `src/lib/worker/identity.ts` | 254-277 | A key written entirely in a script outside the fold table, or a translated name, is neither stripped nor withheld | Info | Accepted residual T-02-22 (same class as T-03-03). A key mixing an ASCII anchor with unresolved letters is withheld (probes). |
| `src/lib/import/worker-client.svelte.ts` | 686-704 | Check-cache read failure goes to idle with a console log | Info | Deliberate (D-19). Unchanged. |
| `src/lib/worker/ingest.worker.ts` | 941-957 | Playtime and login aggregation failures caught and logged | Info | Deliberate (T-04-03). Unchanged. |

### Human Verification Required

1. **Long category name at phone width (truth 14)**
   - Test: Load an export with a long folder name, or a synthetic one. View at 375px. Open the section that shows its provenance line.
   - Expected: The provenance line wraps cleanly with no clipping and no horizontal page scroll.
   - Why human: Visual wrapping cannot be judged from source.

2. **Mojibake edge cases beyond the documented pattern (truth 13)**
   - Test: Decide whether the documented Cyrillic pattern plus the listed cases is enough. If not, supply a property-based or held-out test set.
   - Expected: A human decision on acceptance, or new tests.
   - Why human: The fix is not proven exhaustively for every encoding edge case.

3. **Skip tag and progress text at 10x scale on a phone (truths 20, 21)**
   - Test: Import the 10x synthetic export at 375px. Watch "Parsing Player_statistics (37/812)..." and a "12,345 rows skipped" tag.
   - Expected: No mid-word wrap and no horizontal overflow from the tag.
   - Why human: The e2e asserts text, not wrap or overflow of the tag specifically.

### Gaps Summary

No BLOCKER. No must-have is FAILED. All 11 02-06 truths and all 7 02-06 prohibitions are VERIFIED with named tests, direct probes, and differential fuzzing against the pre-02-06 commit. Both W-1 and W-2 are closed in code. The D-05 override stays in place.

Status is `human_needed`, not `passed`, because four UNCERTAIN truths (13, 14, 20, 21) remain. They are visual and encoding-proof questions that source inspection cannot settle. No warning is open from 02-06.

**Phase goal assessment:** The goal is met in code. The worker parses every category defensively, the dataset is a single active IndexedDB dataset, reloads restore it, identical re-uploads are skipped before unzip, clear wipes the store, and the W-1 and W-2 hardening holds.

**Advisory (New Scope, Unevidenced):** None.

---

_Verified: 2026-10-11T06:53:19Z_
_Verifier: Claude (gsd-verifier)_
