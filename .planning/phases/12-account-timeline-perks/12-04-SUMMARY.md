---
phase: 12-account-timeline-perks
plan: 04
subsystem: worker
tags: [allowlist, categories, privacy, fixtures, e2e]

requires:
  - phase: 12-02
    provides: "the category-scoped family rule (`FAMILY_CATEGORIES` = surveys) and the Surveys promotion this plan extends"
  - phase: 11-new-game-data
    provides: "the per-file column allowlist, the choke point and the presence facts every promoted folder now inherits"
provides:
  - "SUPPORTED with all six Phase 12 folders (Surveys plus the five promoted here)"
  - "FAMILY_CATEGORIES with the same six categories, so every file of a promoted folder stores nothing until a spec names it"
  - "FAMILY_PATTERNS entry for the three User_Info history files, anchored on the whole name so Account_Info.csv is untouched"
  - "Two exported stand-in folder names replacing `Bans` as the suite's unknown-folder example"
  - "tests/unit/import/promoted-folders.test.ts: the status, fail-closed and footer proofs, including the cache replay"
affects: [12-07, 12-08, 12-09, new-data-allowlist, db-narrowing]

actuals:
  tokens: 18652
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Promotion is a one-line list edit whose consequence is asserted by name (status table, footer list, replay list)"
    - "The stand-in rule: a fixture that used a real folder as its example of an unknown folder exports the replacement name, so a later promotion cannot silently invert an assertion"

key-files:
  created:
    - tests/unit/import/promoted-folders.test.ts
  modified:
    - src/lib/worker/categories.ts
    - src/lib/worker/new-data-allowlist.ts
    - tests/fixtures/export-fixtures.ts
    - tests/fixtures/multi-account-fixtures.ts
    - tests/unit/import/new-data-allowlist.test.ts
    - tests/unit/import/classify.test.ts
    - tests/unit/import/ingest-worker.test.ts
    - tests/unit/import/replay-reclassify.test.ts
    - tests/unit/import/db.test.ts
    - tests/unit/import/device-info-worker.test.ts
    - tests/unit/import/data-query-worker.test.ts
    - tests/unit/import/multi-account-import.test.ts
    - tests/unit/import/multi-account-lifecycle.test.ts
    - tests/unit/guards/sample-export-shape.test.ts
    - tests/unit/shell/dashboard-status.test.ts
    - tests/unit/shell/overview-model.test.ts
    - tests/unit/shell/selection-state.test.ts
    - tests/e2e/shell/dashboard.spec.ts
    - tests/e2e/import/persistent-dataset.spec.ts

key-decisions:
  - "The stand-in is `Unmapped_Folder` (plus `Unmapped_Folder_Two` for the empty-directory fixture and `MA_UNKNOWN_FOLDERS` of three for the multi-account fixtures), not `Game_Forums`: `Game_Forums` stays unknown for good (D-02/D-09) but it is ONE folder and the multi-account fixtures needed three distinct unknown folders. The stand-in names are exported from the fixture module that owns the archive and imported by the tests."
  - "Fixture CONTENT is untouched: the `BAN_DT;BAN_REASON;BAN_EXPIRES_AT` header, the rows and the malformed body that exercises skip counting all stay. Only the folder and file names carrying the stand-in moved, so no assertion lost the shape it was written to prove."
  - "`Account_Name_History.csv` joins the family by an anchored whole-name pattern, not a prefix: `Account_Info.csv` sits beside it in the same SUPPORTED folder and feeds the identity pick, and a prefix rule would have stopped the account header storing at all."
  - "No Dexie version bump. A category's status is re-derived from the stored folder name on every replay, which `promoted-folders.test.ts` asserts by running `check-cache` and comparing the footer list."

patterns-established:
  - "An assertion that depends on a name's POSITION inside a status-sorted list is a claim about the spelling, not about the code: locate the entry by name instead (`classify.test.ts`, `dashboard.spec.ts`)."

requirements-completed: []

coverage:
  - id: D1
    description: "Bans, Authorized_Third_Parties, Bonus_Codes, Personal_Coupons and Subscriptions classify as supported, in any letter case; Game_Forums, the stand-ins and the known-deferred pair are unchanged"
    verification:
      - kind: unit
        ref: "tests/unit/import/promoted-folders.test.ts#classifyFolder after 12-04"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every file of a promoted folder fails closed through the real worker: counted, named in the presence facts with rowCount 0 and parsedRowCount 1, and nothing stored; the User_Info Account_Info rows still store and the three history files store nothing"
    verification:
      - kind: unit
        ref: "tests/unit/import/promoted-folders.test.ts#12-04: the promoted folders through the real worker"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Not yet supported footer, the Overview unsupported chip and the cache replay all agree, listing only Game_Forums of the folders this archive carries"
    verification:
      - kind: unit
        ref: "tests/unit/import/promoted-folders.test.ts#drops the five folders from the footer and keeps Game_Forums listed"
        status: pass
      - kind: unit
        ref: "tests/unit/import/promoted-folders.test.ts#gives the same footer after a cache replay, with no Dexie version bump"
        status: pass
      - kind: unit
        ref: "tests/unit/import/db.test.ts (db.verno still pinned at 2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The three User_Info history file names are family files and Account_Info.csv and its near-miss names are not"
    verification:
      - kind: unit
        ref: "tests/unit/import/new-data-allowlist.test.ts#isNewDataFile: the three User_Info history files join the family (12-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No test, fixture or e2e spec depends on a promoted folder being unknown any more"
    verification:
      - kind: unit
        ref: "pnpm run test:unit (3767 tests, 119 files)"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test --project=chromium (252 passed)"
        status: pass
      - kind: other
        ref: "pnpm run check && pnpm run lint"
        status: pass
    human_judgment: false

# Metrics
duration: 33min
completed: 2026-10-20
status: complete
---

# Phase 12 Plan 04: Promote the remaining Phase 12 folders Summary

**The five remaining Phase 12 folders are now supported and every file in them fails closed, the three `User_Info` history files became family files by an anchored whole-name pattern, and the "Not yet supported" footer shrank to `Game_Forums` alone.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-10-20T07:12:41Z
- **Completed:** 2026-10-20T07:44:41Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments

- Every test, fixture and e2e spec that used `Bans`, `Bonus_codes`, `Subscriptions` or `Authorized_Third_Parties` as THE example of an unknown folder now names a synthetic stand-in that no phase will promote — migrated FIRST, while those folders were still unknown, so every commit of this plan is green.
- `SUPPORTED` gained the five folders and `FAMILY_CATEGORIES` gained the same five categories. A file an archive puts in any of them — a future revision, a second file, a file an attacker added — is counted, named in the presence facts with `rowCount 0`, and stores nothing.
- The three `User_Info` history files joined the family through ONE anchored whole-name pattern. This is a narrowing of data already at rest (Finding 1), and with no spec until plan 12-08 each of the three now stores nothing while `Account_Info.csv` beside them keeps feeding the identity pick.
- `Game_Forums` stayed out of both lists, with the reason written where the next reader will find it, and its planted email is proven never to reach IndexedDB.
- The footer, the Overview chip and a `check-cache` replay all agree on the same list, with `db.verno` still 2.

## Task Commits

1. **Task 1: Migrate every unknown-folder stand-in off the five folders** - `481fe13` (test)
2. **Task 2: Promote the five folders, close the family and the history names** - `a235d3d` (feat)
3. **Follow-up fix: the added unknown folder's banner, located by name** - `320ef3c` (test)

## Files Created/Modified

- `src/lib/worker/categories.ts` - the five promoted folder names, and the doc comment that says why `Game_Forums` is absent and why no Dexie version is bumped
- `src/lib/worker/new-data-allowlist.ts` - `FAMILY_CATEGORIES` at six categories; one anchored whole-name pattern for the three history files, with the fourth bullet in the pattern's doc comment (T-12-11's accepted residual)
- `tests/fixtures/export-fixtures.ts` - `SAMPLE_UNKNOWN_FOLDER`, `SAMPLE_UNKNOWN_FILE`, `SAMPLE_UNKNOWN_FOLDER_TWO`, exported once and used everywhere the sample's unknown folder is named
- `tests/fixtures/multi-account-fixtures.ts` - `MA_UNKNOWN_FOLDERS`, the three stand-ins that replaced `Bans`/`Subscriptions`/`Bonus_Codes`
- `tests/unit/import/promoted-folders.test.ts` - the `classifyFolder` table, the real-worker fail-closed case, the presence facts, the footer/chip/replay agreement and the canary dump
- `tests/unit/import/new-data-allowlist.test.ts` - the `isFamilyCategory` and `isNewDataFile` cases for the six categories and the three history names
- 14 further test files - stand-in names swapped at every site; see the Task 1 commit for the full list

## Decisions Made

1. **`Unmapped_Folder` over `Game_Forums` as the primary stand-in.** `Game_Forums` is real and stays unknown for good (D-02, D-09), so it is the ideal stand-in where a test already counts or plants it — and several still do (`multi-account-fixtures` keeps it). But the multi-account fixtures needed THREE distinct unknown folders and there is only one such real folder, so the suite's synthetic names carry the rest. Both are unknown for different, documented reasons.
2. **Fixture content untouched.** The `BAN_DT`-shaped header, its rows and the malformed body are the fixtures that exercise skip counting and the CR-01/CR-02 recovery; only the names carrying the stand-in moved.
3. **`isNewDataFile` for the history files is a whole-name pattern, not a prefix.** `Account_Info.csv` is in the same SUPPORTED folder and is what the identity pick and the Account record read; the asymmetry (those three fail closed, this one does not) is the whole content of the decision, so it is asserted on both sides.
4. **No narrowing work in this plan.** Research Finding 2 notes that promotion also stops the D-21 purge from deleting v1.0-era raw rows of these folders. The plan scoped the narrowing to plan 12-07, which owns the in-place narrowing step; this plan does not touch `db.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `classify.test.ts`'s renamed-root case asserted the added unknown folder sorts LAST**
- **Found during:** Task 1 verification (`pnpm run test:unit`)
- **Issue:** The case read `categories.at(-1)` and expected `EXTRA_UNKNOWN_FOLDER`. That held only because the sample's own unknown folder was `Bans`, and `bans` < `future_category_2026`. The rename to `Unmapped_Folder` moved it behind, so the test failed on an ordering fact it never claimed to test.
- **Fix:** Look the entry up BY NAME and assert the sort separately. The name/status/fileCount assertion is unchanged; what went is the incidental position.
- **Files modified:** `tests/unit/import/classify.test.ts`
- **Verification:** full unit suite green at the Task 1 commit
- **Committed in:** `481fe13`

**2. [Rule 1 - Bug] `dashboard.spec.ts`'s `(banners-renamed)` case made the same positional assumption**
- **Found during:** Task 2 verification (running the e2e suite, which does launch Chromium in this environment)
- **Issue:** `banners.getByTestId('banner-folder').last()` was expected to read `EXTRA_UNKNOWN_FOLDER`, for the same reason and with the same consequence.
- **Fix:** Filter the banners by folder name — the pattern `import-flow.spec.ts` already uses — and keep the styling comparison identical.
- **Files modified:** `tests/e2e/shell/dashboard.spec.ts`
- **Verification:** `pnpm exec playwright test --project=chromium` — 252 passed
- **Committed in:** `320ef3c`

**3. [Rule 1 - Bug] `csv-parse.test.ts` names `Bans` as a parser argument**
- **Found during:** Task 1 survey of every hit
- **Issue:** None — the plan classes this site as a category-INDEPENDENT label, and `parseCsvFile` never classifies.
- **Fix:** Left the strings alone and added a comment saying why, so the next reader does not migrate it or read a status claim into it.
- **Files modified:** `tests/unit/import/csv-parse.test.ts`
- **Committed in:** `481fe13`

---

**Total deviations:** 3 auto-fixed (2 latent ordering bugs, 1 documented no-change)
**Impact on plan:** Both bugs were the same root cause — an assertion pinned to a position inside a status-sorted list — and both are now pinned to the name instead, which is what they meant. No scope change; the promotion itself landed exactly as specified.

## Issues Encountered

- **The plan expected the e2e specs to be unverifiable here** (STATE assumption A11: Chromium cannot launch in the agent sandbox). It launches fine in this environment, so both edited specs and the whole chromium project were RUN rather than only type-checked and linted — which is how deviation 2 surfaced. The plan's fallback (type-check + lint only) would have shipped it.
- **`promoted-folders.test.ts` initially asserted a presence fact for `Account_Info.csv`.** There is none: the presence list covers `PRESENCE_CATEGORIES` plus family files, and `Account_Info.csv` is neither. The test now asserts the fact is ABSENT, which is the sharper statement — it is not a family file — and its row reaching storage is the control that proves it.

## Requirements

`TIMELINE-02`, `PERKS-01` and `PERKS-02` are **not** marked complete. This plan makes the folders readable and safe; the panes that satisfy those requirements arrive with plan 12-08 (specs) and 12-09 (panes). `PRIV-01` was already Complete from phase 11. The same deviation 12-02 recorded is recorded again in `.planning/WINDOWS.md` so the ship gate can see it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 12-07 (in-place narrowing) can start from a clean base: `FAMILY_CATEGORIES` now names every folder whose legacy v1.0 rows need walking by category rather than by file name.
- Plan 12-08 (specs) has a fail-closed substrate: any file it does not spec stores nothing, so specs can land one family at a time with no intermediate exposure.
- `Game_Forums` remains unpromoted and unlisted-in-`FAMILY_CATEGORIES`, with `promoted-folders.test.ts` asserting both, so a later "empty allowlist entry" for it has to edit that test on purpose.

## Verification Evidence

| Gate | Result |
|------|--------|
| `pnpm run test:unit` (after Task 1) | 3756 passed / 118 files |
| `pnpm run test:unit` (after Task 2) | 3767 passed / 119 files |
| `pnpm exec vitest run` (plan's targeted set: promoted-folders, new-data-allowlist, replay-reclassify, dashboard-status, db) | 168 passed / 5 files |
| `pnpm run check` (tsc -b + svelte-check, includes `tests/**/*.ts`) | 0 errors, 0 warnings, 328 files |
| `pnpm run lint` (prettier + eslint) | clean |
| `pnpm exec playwright test --project=chromium` | 252 passed (1.4 min) |

TDD: Task 2's RED was 8 failing tests across the two files (all six status/fail-closed/footer cases and both new pure-function describes), each failing on the un-implemented promotion or pattern, none on a broken import.

## Self-Check: PASSED

- All 21 changed/created files exist on disk.
- Commits `481fe13`, `a235d3d`, `320ef3c` are all ancestors of HEAD (`git rev-list --count c46d9e9..HEAD` = 3, matching the frontmatter).
- No commit in this plan deletes a tracked file (`--diff-filter=D` is empty for all three).
- No stub, skipped test or unrun verification was produced by this plan, so no `Known Stubs` section applies.

---
*Phase: 12-account-timeline-perks*
*Completed: 2026-10-20*
