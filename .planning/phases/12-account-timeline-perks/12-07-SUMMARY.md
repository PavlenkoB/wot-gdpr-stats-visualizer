---
phase: 12-account-timeline-perks
plan: 07
subsystem: worker
tags: [privacy, narrowing, legacy-cache, indexeddb, regression-guard]
status: complete

requires:
  - phase: 12-04
    provides: "SUPPORTED and FAMILY_CATEGORIES with the six Phase 12 folders, which is what makes the D-21 purge stop deleting their legacy rows"
  - phase: 11-new-game-data
    provides: "narrowStoredNewDataRows, the allowlist projection and the presence facts this plan extends"
provides:
  - "narrowStoredNewDataRows with a second walk over the category index for FAMILY_CATEGORIES, sharing one per-group function with the name walk"
  - "The fact rewrite widened to family categories as well as family names"
  - "tests/unit/import/account-timeline-legacy.test.ts: the v1.0-shaped seed through the real check-cache path (narrowed, deleted, idempotent, account-safe, no-meta)"
  - "tests/unit/import/game-forums-guard.test.ts: the D-02 regression guard"
affects: [12-08, 12-13, db-narrowing]

actuals:
  tokens: 8900
  tasks: 2
  commits: 2
commits: 2
plan_head_before: ef41cfa724ed50d8f3098b8f6d6983d9bf1eac13
plan_head_after: e412fdff37b9978582577c789f999fa724c4f45d

tech-stack:
  added: []
  patterns:
    - "One local per-group function serves every walk of a narrowing step, so an import and a narrowing of the same rows cannot disagree"
    - "A promotion that stops the purge covering a category is paired with a category-index walk, index-only (uniqueKeys), never the list form of the query"

key-files:
  created:
    - tests/unit/import/account-timeline-legacy.test.ts
    - tests/unit/import/game-forums-guard.test.ts
  modified:
    - src/lib/worker/db.ts

key-decisions:
  - "No Dexie version bump: db.verno stays 2 and the test asserts it. The step is a data operation on records whose shape is unchanged."
  - "Game_Forums stays unpromoted. D-02 is delivered as a regression guard (Phase 11 D-15 and the code supersede the Phase 9 sentence that unknown folders were stored raw)."
  - "The category walk skips groups the name walk already visited, but does not add its own groups to the visited set, so two category spellings that differ only in case are each still narrowed."
  - "Per-group stored counts are summed rather than overwritten, so two index keys differing only in letter case report one truthful count in the presence fact."

requirements-completed: [PRIV-01]
duration: ~15 min
completed: 2026-10-20
---

# Phase 12 Plan 07: Legacy narrowing of promoted folders and the Game_Forums guard Summary

**`narrowStoredNewDataRows` now walks the category index for the six promoted folders, deleting or projecting the raw rows a v1.0 cache holds at rest, and a guard test fails the build if Game_Forums is ever promoted, specced, paned or stored.**

## Accomplishments

- **Category walk (T-12-20, T-12-21).** After the existing name walk, the step reads `orderBy('category').uniqueKeys()`, and for each `isFamilyCategory` key loads that category's rows, groups them by account, file and category, skips groups already decided, and runs the same per-group function the name walk uses. A group with no spec or no matching header is deleted; a group with a spec is rewritten to its projection. The presence facts of every visited group are rewritten in the same transaction, now for family categories as well as family names. A legacy row with no account field is attributed by the existing account-or-legacy rule.
- **Legacy proof through the real worker.** The seed writes v1.0-shaped rows (no `account`) for Bans, Subscriptions, Bonus_Codes, Personal_Coupons, Authorized_Third_Parties, an unlisted Surveys file, `HEAT_Surveys.csv` with `PROFILE_ID` and `PLAYER_ANSWER` canaries, a Game_Forums row and a Payment_history control. After one `check-cache`: the five categories and the unlisted file are gone, `HEAT_Surveys.csv` holds exactly `QUESTION_ID`, `SKIPPED_BY_PLAYER`, `MESSAGE_TS` with the values intact, no canary remains in rows or meta, the Payment_history row is byte-identical, and a second run changes no row and no fact. A drifted second account loses only its own rows, and a database with no meta record narrows nothing and returns 0.
- **Facts agree with rows.** The narrowed Surveys group reads `rowCount` 3 and `parsedRowCount` 3; a deleted group's fact reads `rowCount` 0 with its parsed count kept, in both `meta.files` and `accounts[].files`.
- **D-02 guard (T-12-22).** `game-forums-guard.test.ts` pins that `Game_Forums` classifies unknown in every letter case, is in no list, family pattern, spec, spec column id (`EMAIL`, `IP_ADDRESS`, `BDAY*`) or pane file table, that an imported forum file with email, IP and birthday canaries stores no row and leaks nothing into meta or the whole published result, that the category is reported unknown with its parsed row count and named by `unsupportedEntries`, and that a seeded legacy forum row is purged by `check-cache`. The render-level half is plan 12-13's.

## Verification

- `pnpm exec vitest run tests/unit/import`: 35 files, 898 tests passed. The four-file plan command (legacy, narrow, db, lifecycle): 104 passed. The guard plus `multi-account-import`: 46 passed.
- RED confirmed: with `db.ts` reverted to its previous version, three of the ten legacy tests fail (categories not deleted, canaries remain, facts not rewritten); they pass with the change.
- `pnpm run lint` and `pnpm run check`: clean. `db.verno` is still 2 (asserted in the legacy test and by `db.test.ts`).
- Acceptance greps: `isFamilyCategory` appears in `db.ts` (import and uses); `orderBy('category').uniqueKeys()` appears in the purge, the new walk and the existing session reader; no new `.version(` declaration; `Game_Forums` appears 15 times in the guard test; the only `forum` hit in the spec and allowlist files is a comment.

## Task Commits

1. Task 1, category walk, widened fact rewrite and legacy-seed proof: `de2eaee`
2. Task 2, D-02 regression guard: `e412fdf`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, latent] Per-group stored count was overwritten instead of summed**
- **Found during:** Task 1
- **Issue:** `stored.set(groupKey, n)` overwrote an earlier count when two index keys differing only in letter case mapped to one lower-cased group key, so the presence fact could have reported only one spelling's rows.
- **Fix:** counts are accumulated (`(stored.get(groupKey) ?? 0) + n`). No visible change for a single-spelling group, which is every group in the existing suite.
- **Files modified:** `src/lib/worker/db.ts`
- **Commit:** `de2eaee`

**Total deviations:** 1 (latent bug hardened inside the refactor). **Impact:** none on existing behaviour; all prior narrowing tests pass unchanged.

## Issues Encountered

The interactive shell's `grep` is a broken wrapper function (it returned nothing and mishandled `--include`); `/usr/bin/grep` and `rg` were used for searches. No project impact.

## Known Stubs

None.

## Threat Flags

None. No network, auth or file-access surface was added; T-12-20, T-12-21 and T-12-22 are mitigated as planned and each has a named failing-if-broken test.

## Next Phase Readiness

Plan 12-08 adds the eight other family specs and extends `account-timeline-legacy.test.ts` with their projections; the category walk already routes any category in `FAMILY_CATEGORIES` through `specFor` and `projectRow`, so a new spec needs no change in `db.ts`.

## Self-Check: PASSED

- Created files exist: `account-timeline-legacy.test.ts`, `game-forums-guard.test.ts`, this SUMMARY.
- Commits `de2eaee` and `e412fdf` are ancestors of HEAD.
- Plan verification re-run after the last commit: `tests/unit/import` green, lint and check clean, `db.verno` 2.
