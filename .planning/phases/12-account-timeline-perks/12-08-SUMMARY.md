---
phase: 12-account-timeline-perks
plan: 08
subsystem: worker
tags: [privacy, allowlist, email-guard, specs, labels, identity-pool, legacy-narrowing]
status: complete

requires:
  - phase: 12-01
    provides: "12-HEADERS.md allow rows, the Pane mapping and COLUMN_RISK_ANSWERS the specs and the risk lint transcribe"
  - phase: 12-04
    provides: "the promoted folders and the history-file family pattern whose specs this plan writes"
  - phase: 12-06
    provides: "SpecFile.emailGuard, the code column kind and the masked cell formatter"
  - phase: 12-07
    provides: "the category walk of narrowStoredNewDataRows that routes every new spec through specFor and projectRow"
provides:
  - "Eight new SpecFile entries (name history, external services history, language and country history, bans, authorized third parties, subscriptions, personal coupons, bonus code usage) and the finished heat_surveys.csv entry, all nine with emailGuard"
  - "PERKS_CARD_FILES naming the three captured Perks files (NEW_DATA_PANE_FILES.perks follows by construction)"
  - "File and column labels for every new spec in NEW_DATA_FILE_LABELS and NEW_DATA_COLUMN_LABELS"
  - "Family files excluded from the import identity pool and the lazy rebuild pool (research Finding 4, T-12-25)"
  - "A risk-answer lint, a kind-placement lint, an email-in-every-cell proof and a legacy projection proof for the nine Phase 12 files"
affects: [12-09, 12-10, 12-11, 12-13, new-data-specs, ingest-worker, db-narrowing]

actuals:
  tokens: 12400
  tasks: 3
  commits: 3
commits: 3
plan_head_before: c3df58f267f5c4191695d2726134058b807e6d3a
plan_head_after: b018aebafd4fdb038702f78bd930e41d13bb52c5

tech-stack:
  added: []
  patterns:
    - "Every stored column of a Phase 12 file is a transcribed allow row of 12-HEADERS.md and is mechanically cross-checked against the user's own per-column risk answers"
    - "A file-name family pattern is the second half of the fail-closed rule for a promoted folder: the category covers the folder, the name covers a misfiled copy"
    - "A pool exclusion is mirrored in the import and in the rebuild and proved independently on each path"

key-files:
  created:
    - tests/unit/import/account-timeline-allowlist.test.ts
    - tests/unit/import/account-timeline-identity.test.ts
  modified:
    - src/lib/worker/new-data-specs.ts
    - src/lib/worker/new-data-allowlist.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/worker/db.ts
    - src/lib/features/new-data/new-data-shared.ts
    - src/lib/ui-copy.ts
    - tests/unit/import/new-data-allowlist.test.ts
    - tests/unit/import/new-data-narrow.test.ts
    - tests/unit/import/new-data-facts.test.ts
    - tests/unit/import/perks-worker.test.ts
    - tests/unit/import/account-timeline-legacy.test.ts
    - tests/unit/shell/ui-copy.test.ts

key-decisions:
  - "Specs follow the allow rows of 12-HEADERS.md exactly: no address column in Bans or Authorized_Third_Parties (the capture holds none), USER_IP is the only address, CODE and CODE_KEY the only codes, OLD_NAME and NEW_NAME the only past nicknames. IP and UID in the history files, DESCRIPTION, REASON, PREREQUISITE, SUBSCRIPTION, PROFILE_ID and BATTLE_ID are excluded by omission."
  - "PLAYER_ANSWER is allowed (kind text) because the user stated at the plan 12-01 checkpoint that it is an enumerated rating; PROFILE_ID and BATTLE_ID stay excluded."
  - "QUESTION_ID keeps the kind text plan 12-02 gave it (the table says number): an object id must not render with number formatting, and the kind is documentation only in the worker."
  - "The five promoted-folder file names join FAMILY_PATTERNS as an anchored name pattern, so a copy filed under a supported legacy folder stores nothing instead of being stored raw."
  - "Narrowing leaves a group of already-empty rows alone, so a file the email guard emptied at import is not deleted by the next check-cache."

patterns-established:
  - "COLUMN_RISK_ANSWERS is walked by a pure helper whose failures name file, column and field; the helper is itself tested on hand-built failing columns"

requirements-completed: [TIMELINE-01, TIMELINE-02, PERKS-01, PERKS-02, PERKS-03, PRIV-01]
duration: ~30 min
completed: 2026-10-20
---

# Phase 12 Plan 08: Phase 12 specs, labels and the identity-pool exclusion Summary

**Eight new email-guarded SpecFiles plus the finished Surveys spec (nine in all, each column traced to an allow row of 12-HEADERS.md and checked against the user's own risk answers), real Perks card files, labels, and history files kept out of the identity and Account-record pools on both the import and the rebuild.**

## Accomplishments

- **Specs (T-12-23, T-12-24).** `new-data-specs.ts` holds the nine Phase 12 specs. Columns, in file order: name history `CREATED_AT`, `OLD_NAME`, `NEW_NAME`; external services `CREATED_AT`, `OPERATION`, `NAME`; language and country `CREATED_AT`, `OPERATION`, `NAME`, `VALUE`; bans `STARTED_AT`, `EXPIRED_AT`, `STATUS`; authorized third parties `THIRD_PARTY_SITE`, `CREATED_AT`; subscriptions `SUBSCRIBED`; personal coupons `INSERTED_AT`, `UPDATED_AT`, `EXPIRED_AT`, `STATUS`, `CODE` (kind code); bonus code usage `CREATED_AT`, `CODE_KEY` (code), `USER_IP` (address); surveys `QUESTION_ID`, `PLAYER_ANSWER`, `SKIPPED_BY_PLAYER`, `MESSAGE_TS`. `grep -c "emailGuard: true"` prints 9, equal to the nine rows of the Pane mapping.
- **Risk-answer lint.** A pure helper checks every spec column against `COLUMN_RISK_ANSWERS` (no answer, email or free text yes or unsure, person name outside the name history, IP not of kind address, code not of kind code) and names file, column and field. It is unit-tested on hand-built failing columns. A second describe pins kind placement (codes only in coupons and bonus codes, addresses only in the three admitted files, past nicknames only in the name history) and that no excluded column is named.
- **Perks card map and labels (T-12-27).** `PERKS_CARD_FILES` names `subscriptions.csv`, `personal_coupons.csv`, `bonus_code_usage.csv` and `heat_surveys.csv`; `NEW_DATA_PANE_FILES.perks` lists the four in card order. File labels equal the captured names; every column has a plain-language label from a constant table.
- **Identity-pool exclusion (T-12-25).** `ingest.worker.ts` no longer pushes a family file's row into the root's identity pool, and the lazy rebuild in `db.ts` skips a family file in its user_info walk. `account-timeline-identity.test.ts` proves history files alone give identity null and account null at import and after a rebuild, and that beside Account_Info.csv the identity and Account record come from it alone. Reverting either source change alone fails a test, so each path is proved independently.
- **Email in every cell (T-12-24).** `account-timeline-allowlist.test.ts` plants a distinct `.example.invalid` email as the value of every allowlisted column of row two of each of the nine files: the entry exists (three rows), rows one and three keep their values, and no planted string is in `db.rows` or the meta record. Removing the flag from every spec fails 11 of its 12 tests.
- **Legacy rows.** The extended legacy test seeds a raw row of each of the nine files (history files under User_Info) with extra raw columns, an overflow array and an email in the first allowlisted cell; one check-cache narrows each to its spec keys with the email cell absent, and a second changes nothing.

## Verification

- `pnpm run test:unit`: 126 files, 3,940 tests passed. `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean.
- `git diff c3df58f..HEAD` touches no `.svelte` file.
- RED/GREEN: the risk-lint, allowlist, identity and legacy tests were each shown failing before the change they cover (history rows in the pool; no emailGuard; misfiled copy stored raw; non-idempotent narrowing).

## Task Commits

1. Task 1, five timeline specs, labels, risk-answer lint, name-pattern family rule: `af4fb66`
2. Task 2, Perks specs, PLAYER_ANSWER, real Perks card files, kind-placement lint: `606a7c3`
3. Task 3, identity-pool exclusion, email-in-every-cell proof, legacy projections: `b018aeb`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] A misfiled copy of a promoted-folder file was stored raw**
- **Found during:** Task 1
- **Issue:** The Phase 11 matrix case "a copy filed under Payment_History stores nothing" failed for `Bans.csv` and `Authorized_Third_Parties.csv` (and would for the three Perks files). Plan 12-04 made the promoted folders family by CATEGORY only; a name like `Bans.csv` in a supported legacy folder matched no family pattern, so it was stored column for column. That breaks D-15 (a name in a folder it was never seen in stores nothing).
- **Fix:** one anchored name pattern in `FAMILY_PATTERNS` for the five files (`bans`, `authorized_third_parties`, `subscriptions`, `personal_coupons`, `bonus_code_usage`), with its reasoning in the module comment.
- **Files modified:** `src/lib/worker/new-data-allowlist.ts`
- **Commit:** `af4fb66`

**2. [Rule 1 - Bug] Narrowing was not idempotent for a file the email guard emptied**
- **Found during:** Task 3
- **Issue:** A group whose every row projects to `{}` (the Subscriptions row whose only allowlisted cell was an email) has no header left to match, so the first check-cache kept it and the second deleted it. The narrowing then differed from the import that wrote the rows, and the must-have "a second check-cache changes nothing" failed.
- **Fix:** `narrowGroup` leaves a group alone when every row is already an empty object (it holds nothing). A spec-less group is still deleted.
- **Files modified:** `src/lib/worker/db.ts`
- **Commit:** `b018aeb`

**3. [Rule 1 - Test pins] Phase 11 and 12 tests pinned the old Perks and Surveys shape**
- **Issue:** `new-data-facts.test.ts` pinned the Perks pane to one file, `account-timeline-legacy.test.ts` expected PLAYER_ANSWER to be narrowed away, `new-data-narrow.test.ts` seeded every spec under Player_Statistics, `perks-worker.test.ts` described three allowlisted columns, and `ui-copy.test.ts` limited the labelled files to the pane and Perks files.
- **Fix:** updated each to the new truth (four Perks files, PLAYER_ANSWER kept as a rating, seeds filed in the captured folder, timeline files in the labelled set). None was loosened.
- **Files modified:** `tests/unit/import/new-data-facts.test.ts`, `account-timeline-legacy.test.ts`, `new-data-narrow.test.ts`, `perks-worker.test.ts`, `tests/unit/shell/ui-copy.test.ts`
- **Commits:** `af4fb66`, `606a7c3`

**4. [Ordering] heat_surveys.csv gained emailGuard in Task 1, not Task 2**
- The Task 1 "exactly the Phase 12 keys set the flag" test needed the Surveys spec to carry the flag for the Task 1 commit to be green; PLAYER_ANSWER and the card files still landed in Task 2.

**Total deviations:** 4 (1 missing fail-closed rule, 1 idempotence bug, 1 set of test pins, 1 ordering note). **Impact:** all additive or test-side except the two small worker fixes above.

## Decisions Made

See `key-decisions`. Notably: `QUESTION_ID` keeps kind text although the decision table says number. The kind is documentation in the worker, and a number kind would let the shared cell formatter group an object id like a count.

## Known Stubs

None. The timeline and Perks card columns are labelled but not yet rendered; plans 12-09 to 12-11 consume them.

## Threat Flags

None beyond the plan's register. T-12-23 to T-12-27 are mitigated as planned; no network, auth or file-access surface was added.

## Next Phase Readiness

Plans 12-10 and 12-11 can read the nine specs and the file labels. Note for 12-11: `Bans.EXPIRED_AT` may hold the `\N` null marker as a stored string (it is not an email, so the guard keeps it), to be read as an open ban, and the three timeline files' dates are `YYYY-MM-DD HH:MM:SS.mmm`.

## Self-Check: PASSED

- Created files exist: `account-timeline-allowlist.test.ts`, `account-timeline-identity.test.ts`, this SUMMARY.
- Commits `af4fb66`, `606a7c3`, `b018aeb` are ancestors of HEAD.
- Acceptance greps: `emailGuard: true` appears 9 times in `new-data-specs.ts`; `PROFILE_ID`/`BATTLE_ID` appear only on comment lines; `kind: 'code'` only in the coupon and bonus-code entries; `COLUMN_RISK_ANSWERS` appears in the allowlist test; `isNewDataFile` appears in `db.ts` in the narrowing and the new pool skip; `.example.invalid` appears in the allowlist proof.
