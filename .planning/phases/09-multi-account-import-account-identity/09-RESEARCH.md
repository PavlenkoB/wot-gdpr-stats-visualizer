# Phase 9: Multi-account Import & Account Identity - Research

**Researched:** 2026-10-16
**Domain:** Client-side zip classification, Web Worker ingest, Dexie cache, Svelte 5 identity header (no new dependencies)
**Confidence:** HIGH for the code paths and the real-sample shape; MEDIUM for the Svelte runtime behaviour and the scale estimates (not run); the privacy residual in Open Question 1 needs a user decision

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** A top-level folder is an account root when it directly holds at least one recognised category. The name is NOT checked (no digits-only rule). `accountRoot` generalises to a list of roots. — **Reversibility:** costly — **Reversibility rationale:** the root rule is the fail-closed gate that keeps a `User_Info` folder under an unknown parent from skipping the LOGIN/BIRTH_DATE strip; every classifier test and fixture encodes it.
- **D-02:** A stray unknown FOLDER beside account roots (`123/...`, `456/...`, `Misc/x.csv`) fails the whole import with the one generic failure banner, as v1.0 did for one root. Roadmap SC4 stands unchanged.
- **D-03:** Multiple roots under Wargaming's own `personal_data_export/` wrapper are accepted; the wrapper stays transparent. The existing allow-list rule is unchanged: any other wrapper holding recognised categories stays rejected (`ambiguous-root`).
- **D-04:** A recognised category at the top level beside account roots (`Activity_history/x.csv` + `123/User_Info/...`) is rejected with the generic banner. Rootless categories cannot be attributed to an account and are exactly the shape that could dodge the strip.
- **D-05:** Loose FILES at the zip top level (the real `Readme_en.pdf`, `Readme_ru.pdf`) are ignored entirely: never read, never counted toward the stray-folder rule, never stored. Only folders count. This is required for the real sample to import, and it is a change from today where a lone top-level file still counted toward `detectRoot`'s single-segment test. — **Reversibility:** reversible — **Reversibility rationale:** a classifier rule with unit tests; tightening to a `Readme_*.pdf` allow-list later is a one-line change.
- **D-06:** `resolveCsvFileCategory` must agree with `analyzeExport` for N roots (the existing invariant: the inflate filter and the per-category row counts must never diverge). It returns the owning account root with the category and source file.
- **D-07:** Every stored `DatasetRow` carries a non-indexed `account` field (the account root). NO Dexie version bump: v1.0 caches survive, and readers keep querying by the existing `category` index and filter in memory. A row with no `account` reads as the dataset's legacy single account. This follows the 06-01 precedent and the pinned `version(2)`-only test in `tests/unit/import/db.test.ts`. — **Reversibility:** costly — **Reversibility rationale:** the field is read by every reader and by Phase 10's source-account column; moving to an indexed key later needs a Dexie bump and a lossless upgrader.
- **D-08:** `DatasetMeta` gains `accounts[]`, one entry per account (root, its categories, its identity, its file-presence facts). The existing top-level `accountRoot`, `identity`, `categories` and `files` stay as legacy fields so a v1.0 cache still reads as a one-account dataset. Still ONE cached dataset and ONE zip hash.
- **D-09:** `playtime` and `logins` stay single aggregates over all accounts, computed at import by feeding every account's sessions/logins to the existing aggregators (playtime already merges overlapping sessions). Their `v`-keyed lazy rebuild is unchanged. Per-account slicing is Phase 10's if it needs it.
- **D-10:** Lifecycle is as v1.0 with N accounts: hash-dedupe reports "already loaded" for an identical zip; a different zip replaces every account and leaves no old rows; "Clear my cached data" and "Start over" remove every account. `writeDataset` stays one transaction.
- **D-11:** On a multi-account dataset the existing panes (Playtime, Vehicles, Finance, Logins, Device info) read ALL accounts' rows. Each shows a one-line "N accounts combined" caption so no pane presents one account as the whole. Dedupe, game filter and per-row source account are Phase 10. A single-account dataset shows no caption and behaves exactly as v1.0. — **Reversibility:** reversible — **Reversibility rationale:** a caption and a reader scope; Phase 10 replaces it.
- **D-12:** Because readers now see rows with the same `sourceFile`/`rowIndex` from different accounts, any reader that keys, sorts or de-duplicates on those alone must be checked. Research should list each one (e.g. vehicle rows keyed by vehicle id appearing in two accounts) and note what Phase 9 leaves for Phase 10.
- **D-13:** The header is a stacked list of compact account rows, all visible with no interaction: nickname (or the ID when there is no `User_Info`), games covered, first-to-last activity years. One account renders exactly as v1.0 (nickname title, location code, created date, ID line). Fits the 480px phone block and the 44px touch floor.
- **D-14:** Games covered per account are the game tokens of that account's `*_Game_Sessions.csv` files that hold at least one row (the way playtime already names games via `sessionFileGame`). Friendly names: WOT = World of Tanks, WOTB = WoT Blitz, WOWS = World of Warships, WOTC = WoT Console, HEAT = World of Tanks HEAT; an unknown token is shown raw. Games with no pane yet (HEAT, WOTC) are still listed. `Game_Active_Sessions.csv` has no game token and is not a game source.
- **D-15:** First-to-last activity years per account come from the min and max session start across that account's game session files. An account with no usable sessions shows "no activity recorded".
- **D-16:** Accounts are ordered by first activity year ascending, so the list reads as a migration timeline; ties and no-activity accounts come last, ordered by account ID.
- **D-17:** An account with no `User_Info` still appears, identified by its ID. Missing identity fields keep the v1.0 "Unknown" wording (v1.0 D-16). The numeric ID stays visible on every row. No email or birth date reaches storage or any page, whichever root its `User_Info` sits under (v1.0 D-18 applies per root).

### Claude's Discretion

- Exact visual styling of the stacked account rows, within the Day 10 master-detail shell and the sketch findings skill.
- Exact wording of the "N accounts combined" caption and "no activity recorded".
- Fixture design for 1, 2 and 3 account roots (a synthetic copy of the real shape, not the real data), and where the per-account parse loop lives in `ingest.worker.ts`.
- How `AccountIdentity`/`ClassifyResult` carry the account list across the worker message contract.

### Deferred Ideas (OUT OF SCOPE)

- Merged correctness, game filter, overlap counting, source-account column: Phase 10.
- Cross-account duplicate account-level files (Subscriptions, External_Services_History, Language_And_Country_History repeated per account): Phase 12 must decide whether to show once or per account.
- HEAT and WOTC panes, WOWP/WOWS statistics: Phase 11.

None of the above is new scope for this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACCOUNT-01 | Import a zip with several account-ID folders without the generic failure banner | N-root resolver in `classify.ts` (D-01..D-05); real sample rejected today as `no-single-root` (see Real Sample Shape) |
| ACCOUNT-02 | Each account folder classified and parsed independently; an account with missing categories still imports | Per-root parse loop and per-root identity pool (ingest.worker.ts 793-945, identity.ts 368-381); real account 1234567 has no `User_Info` and no `Financial_Data` |
| ACCOUNT-03 | One cached dataset holds all accounts; replace and hash-dedupe as before | Non-indexed `account` on rows, `accounts[]` on meta, no Dexie bump (db.ts 199-207, 245-274); `resultFromMeta` normaliser |
| ACCOUNT-05 | Identity header lists every account with ID, games, first-to-last years | Worker-computed per-account summary stored on meta; stacked list in `IdentityHeader.svelte`; D-16 ordering |
| ACCOUNT-08 | Clear and Start Over wipe all accounts; fixtures and tests cover 1, 2 and 3 roots | `clearData` already empties all rows (db.ts 701-706); new `tests/fixtures/multi-account-fixtures.ts` plus twins of existing specs |
</phase_requirements>

## Summary

Phase 9 changes one assumption that the whole pipeline shares: that an export has exactly one account root. That assumption is written into the classifier (`resolveAccountRootAndCategories`, `detectRoot`, `resolveCsvFileCategory`), the parse loop (one `accountRoot` threaded through the inflate filter, the identity pick and `writeDataset`), the cache (`DatasetMeta.accountRoot`, `identity`, `files`), the readers (`readLoginRowData`'s account pool, `readSessionRowData` and `readLoginRowData` grouping by category and file only), and the UI (`IdentityHeader`, `overview-model`, `selection-state`). None of this is hard to generalise, but four of the consumers fail in ways that are not obvious from the requirements, and the planner needs them stated.

First, the identity pick falls back to the first User_Info row when no row matches the root (`identity.ts` 372-375). If the User_Info pool is built across all roots, the account with no `User_Info` (1234567 in the real sample) silently displays another account's nickname. The pool must be scoped per root, in both the import and the lazy login rebuild.

Second, two Svelte keyed each blocks use values that repeat once accounts are merged. `VehicleTable.svelte:327` keys by `row.id` and `BattleTypeSummary.svelte:162` keys by `row.code`, and the battle-type summary is built from every file row without deduplication (`vehicle-aggregate.ts` 752-762). The real sample has `WOTB_Vehicle_Statistics.csv` in three accounts and `WOTB_Battle_Types_Statistics.csv` in two, so Phase 9 must change those keys or Success Criterion 2 ("every existing pane opens without an error") fails on the real shape.

Third, the session and login readers group by (category, file) and not by account. Import builds one source per (account, file), because each file has its own header and columns are resolved from the first row of each source. A rebuild that merges three accounts' `WOT_Game_Sessions.csv` into one source can resolve columns differently from the import and disagree with it. Adding an account level to the grouping keeps the rebuild equal to the import without a version bump.

Fourth, the privacy strip is per row and root-agnostic, which is correct, but the real sample contains an unknown category, `Game_Forums/WOT_Forum_User_Info.csv`, whose header includes `EMAIL`. Unknown categories are parsed and stored raw today. Success Criterion 4 says no email reaches storage. This is a user decision, not a planning detail (Open Question 1).

**Primary recommendation:** Replace the single-root resolver with an explicit N-root resolver whose failure rules are exactly D-01..D-05, keep every pinned v1.0 failure reason, stamp an `account` on every stored row, persist a per-account summary (identity, games, years, presence) in meta with the legacy fields derived from it, scope the identity pool and the reader groupings per account, change the two keyed-each sites, and add one caption per combined pane. Keep the Dexie version at 2.

## Provenance and Method

- **Tags.** `[VERIFIED: path:lines]` marks a value or behaviour taken from a file opened with the Read tool this session, with the quoted text in the surrounding prose. `[GREP: path:line]` marks an excerpt taken with grep or sed. The text was confirmed but the file was not opened with Read, so the planner must Read the lines before quoting them into a plan action. `[CITED: source]` marks a project document. `[ASSUMED]` marks knowledge not confirmed in this session.
- **Real sample.** The user's zip was inspected with `python3 -I` `zipfile` only. Nothing was extracted into the repository and no archive was written to disk. Entry names and sizes were listed in full. CSV header lines were read for the files named below. For the `Activity_History` and `User_Info` files of each account I also counted non-empty lines with a line count, so I could report which game tokens hold at least one row. This is a disclosed deviation from "headers only": counts were taken, but no cell content was printed or inspected. The timestamp format is therefore taken from the code comment in `playtime-aggregate.ts` (lines 31-34 `[GREP]`), not from the file.
- **Graph.** `graphify-out/GRAPH_REPORT.md` was read for orientation. It was built from commit `264d202f`, which is older than the current HEAD `a1a43ea`, so it was used only for navigation and not to answer any value question.
- **Commit.** No file other than this RESEARCH.md was created or modified, and nothing was committed (the tool guidance is to commit only when asked). The orchestrator decides whether to commit `09-RESEARCH.md`. The pre-existing modification to `.planning/state.json` was not touched.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Root and category classification (N roots, D-01..D-05) | Worker (pure `classify.ts`) | — | Fail-closed gate must run before any row is read; pure functions are unit-testable under Node |
| Per-file root attribution (D-06) | Worker (`resolveCsvFileCategory`) | — | Must agree with the inflate filter, so it lives beside `analyzeExport` |
| Per-account identity and account record | Worker (`identity.ts`) | — | Strip and pick run in the worker so the raw User_Info never leaves it (D-18, D-20) |
| Per-account games, years and ordering | Worker (computed once at import) | Main thread (render only) | Timestamps and tokens come from rows; storing the summary on meta avoids a row scan on every return visit (same precedent as `identity`) |
| Stored shape (`account` on rows, `accounts[]` on meta) | Worker / Dexie | — | Dexie is worker-only (`db.ts` comment); no version bump |
| Combined aggregates (playtime, logins) | Worker | — | Aggregators already accept sources; D-09 keeps them merged |
| Identity header (stacked list) | Browser (`IdentityHeader.svelte`) | — | Pure presentation of the derived `AccountIdentity` objects |
| "N accounts combined" caption | Browser (`Dashboard.svelte` → `DashboardSection.svelte`) | — | Presentation only; the count comes from the result object |
| Zero-network guarantee through multi-account import | CI (Playwright request assertions) | Browser | Existing guard, extended by one flow |

## Standard Stack

### Core

No new packages. Every capability is an existing module of this repository.

| Module | Purpose | Why Used Here |
|--------|---------|---------------|
| `src/lib/worker/classify.ts` | Root and category resolution, `resolveCsvFileCategory` | The single place that decides what an account root is; D-01..D-06 extend it |
| `src/lib/worker/categories.ts` | `classifyFolder`, `SUPPORTED`, `KNOWN_DEFERRED` | Case-insensitive folder classification; `[VERIFIED: src/lib/worker/categories.ts:22-61]` |
| `src/lib/worker/identity.ts` | `extractIdentity`, `extractAccountRecord`, `sanitizeUserInfoRow` | Already run per dataset; becomes per root |
| `src/lib/features/playtime/playtime-aggregate.ts` | `sessionFileGame`, `sessionFileNameGame`, `isSessionsRow`, `parseSessionTimestamp` | The game-token source for D-14 and the timestamp source for D-15 |
| `src/lib/core/civil-date.ts` | `civilFromDays` (imported by `finance-aggregate.ts`) | Year extraction from a parsed timestamp without constructing a `Date` `[GREP: src/lib/features/finance/finance-aggregate.ts:44,76]` |
| `src/lib/worker/db.ts` | Dexie `version(2)`, `writeDataset`, readers | Adds non-indexed fields only |
| `fflate`, `papaparse` (existing) | `unzipSync` filter, CSV parse with `worker: false` | Unchanged; `inflate-bounds.ts` caps are 128 MiB per entry and 512 MiB total `[GREP: src/lib/worker/inflate-bounds.ts:55,58]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Non-indexed `account` on rows | Indexed `account` key, `version(3)` | Indexed key makes account reads cheap, but needs a Dexie bump and a lossless upgrader; D-07 rules it out for Phase 9 and Phase 10 can revisit |
| Persist per-account summary on meta | Compute games and years on every page load from rows | Row scan on every return visit; the identity precedent says derived header facts are stored |
| Per-(account, file) sources | Merge sources by file name | Merge is cheaper but can mis-resolve columns and breaks rebuild equality (see Pitfall 3) |

**Installation:** none.

**Version verification:** not applicable; no package is added, upgraded or pinned in this phase.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase, so the gate has no entries. The phase is restricted to existing modules and the existing `fflate` and `papaparse` dependencies. Nothing discovered via web search or training data is used.

## Current-State Map: Where the Single-Root Assumption Lives

| Consumer | File and lines | What it assumes | Phase 9 change |
|----------|----------------|-----------------|----------------|
| Root detection | `classify.ts` 107-124 (`detectRoot`) | One distinct first segment; a loose top-level file counts toward it | Keep for the zero-root fallback only; loose files must not count (D-05) |
| Root resolution | `classify.ts` 349-402 (`resolveAccountRootAndCategories`) | Returns one root or `ambiguous` | Replaced by the N-root resolver (see Architecture Patterns) |
| Ambiguity check | `classify.ts` 232-252 (`unknownFolderHoldsRecognized`) | Used to refuse guessing between rootless and root readings | Must NOT be reused as the multi-root rule (Pitfall 4) |
| Analysis | `classify.ts` 496-548 (`analyzeExport`) | `ok` with one `accountRoot` | Returns `accounts` list and merged categories |
| Per-file mapping | `classify.ts` 602-675 (`resolveCsvFileCategory`) | Takes one root; wrapper fallback uses `lastIndexOf` | Returns the owning root (D-06) |
| Inflate filter | `ingest.worker.ts` 745-749 | `resolveCsvFileCategory(name, outcome.result.accountRoot, recognized)` | Uses the N-root mapping |
| Parse loop | `ingest.worker.ts` 793-945 | One `accountInfoRows` / `otherUserInfoRows` pool, one `sessionSources`, one `presenceFiles` | Partitioned by owning root; `rowIndex` is per category (safe, see D-12) |
| Identity | `ingest.worker.ts` 949-952; `identity.ts` 368-381 | One pool; falls back to `rows[0]` when no ID matches | One pool per root; fallback never crosses roots |
| Account record | `ingest.worker.ts` 960-963; `identity.ts` 441-460 | One account record for logins | Open Question 2 |
| Write | `ingest.worker.ts` 989-1004; `db.ts` 245-274 (`writeDataset`) | One `accountRoot` argument | Trailing optional `accounts` argument; `writeDataset` stays one transaction |
| Replay | `ingest.worker.ts` 696-707 (`resultFromMeta`) | `accountRoot`, `identity` from meta | Normalises legacy meta into the `accounts` list |
| Login rebuild | `ingest.worker.ts` 455-486 (`readLoginsSnapshot`); `db.ts` 458-530 (`readLoginRowData`) | `accountRoot` from meta; pool is global User_Info | Pool scoped per root; grouping gains account (Pitfall 3) |
| Playtime rebuild | `db.ts` 335-375 (`readSessionRowData`) | Groups by category and file | Groups by account, category and file |
| Vehicle/finance/device readers | `db.ts` 586-622 (`readRowsByFile`); `data-queries.ts` (`vehicleFilesOf`, `isPresent`) | Keyed by lower-cased file name only; merged | Unchanged for Phase 9 (merged by design); presence is an OR fold `[GREP: src/lib/worker/data-queries.ts:125-136]` |
| Header | `IdentityHeader.svelte` 47-54, 67, 86-88, 107-114 | One nickname (`identity-nickname`), one ID line | Stacked list for N > 1; N = 1 keeps the DOM |
| Account card | `overview-model.ts` 98-116 | `result?.identity?.createdAt` | N > 1 rule (Open Question 3) |
| Account row | `selection-state.ts` 180-185 `[GREP]` | `result?.identity?.region` as headline | N > 1 rule |
| Caption host | `Dashboard.svelte` 275-316 (`sectionProps` → `DashboardSection`); `DashboardSection.svelte` 95-107 `[GREP]` | Provenance line per section | Add an optional account count to `sectionProps` |

## Classifier Test Inventory (N-root Rule)

Every existing assertion that encodes the single-root rule is listed below. "Flip" means the Phase 9 rule changes the outcome and the test must be rewritten on purpose. "Keep" means the Phase 9 rule must produce the pinned result unchanged. Line numbers are from `tests/unit/import/classify.test.ts` (`[GREP]`), and the fixture names are from `tests/fixtures/export-fixtures.ts` (`[GREP]`).

| # | Input (fixture or literal paths) | Test lines | v1.0 outcome | Phase 9 outcome | Action |
|---|----------------------------------|-----------|--------------|-----------------|--------|
| 1 | `buildMultiRootZip`: `123456789/User_Info/Account_Info.csv` + `987654321/User_Info/Account_Info.csv` | 273-275; 543-546; 686-689; 849-852 | `no-single-root` | `ok`, 2 roots | **Flip in four places.** The fixture's own doc comment says "Triggers no-single-root", which must be rewritten |
| 2 | `buildSingleFileZip`: `document.pdf` (lone top-level file) | 278-281; 547-550; 690-693 | `no-single-root` | `no-single-root` (zero roots; loose file ignored, v1.0 chain) | Keep. Do not drop loose files in `prepare()`, or this reason changes |
| 3 | `buildFilesOnlyUnderRootZip`: `123456789/readme.txt` | 283-286; 551-554; 694-697 | `no-category-folders` | `no-category-folders` | Keep |
| 4 | `buildNoRecognizedCategoryZip` | 288-291; 555-558; 698-701 | `no-recognized-category` | same | Keep |
| 5 | `buildEmptyZip` | 263-266; 539-542; 681-685 | `empty-archive` | same | Keep |
| 6 | `buildWrapperExport`: `WrapperName/123456789/...` | 478-505 | `ok`, root `123456789` | same (single wrapper descent) | Keep |
| 7 | `WrapperName/1234567/Activity_history/a.csv` | 508-513; 655-660; 817-822 | `ok`, root `1234567` | same | Keep |
| 8 | `buildRootlessExport` / `['Activity_history/a.csv','Payment_history/b.csv']` | 499-504; 518-523; 665-670; 824-828 | `ok`, root `''` | same (zero roots) | Keep |
| 9 | `['w/x/Activity_history/a.csv','w/y/Payment_history/b.csv']` (one unknown wrapper, two unknown children) | 533-536; 676-679; 834-837 | `no-recognized-category` | `no-recognized-category` | **Keep. Regression for D-03.** An arbitrary wrapper must never become a container of N roots (see Open Question 6) |
| 10 | `['personal_data_export/Activity_history/foo.csv']` | 588-593; 611-621; 635-645; 829-831 | `ok`, root `''` | same; with roots, D-03 accepts `personal_data_export/<id>/...` | Keep; add N-root twin under the wrapper |
| 11 | `buildAmbiguousRootExport`: `123/User_Info/...` + `123/Activity_history/a.csv` + `Clans/b.csv` | 723-731; 733-737 | `ambiguous-root` | `ambiguous-root` (D-04: `Clans` is a top-level recognised category beside a root) | Keep |
| 12 | `['Activity_history/a.csv','Wrapper/123/User_Info/Account_Info.csv']` | 749-753 | `ambiguous-root` | `ambiguous-root` (D-04) | Keep |
| 13 | `['Activity_history/a.csv','T/a/b/c/Clans/x.csv']` | 755-762 | `ambiguous-root` | `ambiguous-root` | Keep |
| 14 | `['Activity_history/a.csv','T/a/b/c/d/Clans/x.csv']` | 765-770 | `ok`, root `''` | `ok`, root `''` (zero roots; v1.0 chain) | Keep |
| 15 | `['Activity_history/a.csv','Wrapper/123/User_Info/']` | 776-780 | `ambiguous-root` | `ambiguous-root` | Keep |
| 16 | `['Activity_history/a.csv','Wrapper/123/user_info/Account_Info.csv']` | 783-787 | `ambiguous-root` | `ambiguous-root` | Keep |
| 17 | `['Activity_history/a.csv','Misc/x.csv']` | 789-794 | `ok`, root `''`, `Misc` is an unknown entry | same (zero roots) | Keep. D-02 applies only when at least one root exists |
| 18 | `['123/User_Info/...', 'unknown/User_Info/...']` (residual, T-01-45) | 800-811 | `ok`, root `'123'` | `ok`, two roots if the second holds a recognised category | Re-read 800-811 before editing; the assertion is about the root `123` only |
| 19 | `analyzeExport` on `buildSampleExport`, `buildWrapperExport`, `buildRootlessExport` | 841-844 | `ok` | `ok` | Keep |
| 20 | `buildCustomExport` / `buildMultiRowAccountInfoExport` / `buildAccountInfoVariantExport` (single root) | ingest-worker.test.ts 591-810 `[GREP]` | `ok` | `ok`, one root | Keep; assertions are per dataset and must hold for one root |

**New cases to add (no v1.0 equivalent):** two roots each with categories; three roots (real shape); a stray unknown folder beside a root, `123/User_Info/...` + `Misc/x.csv` (D-02, must fail); a top-level recognised category beside two roots (D-04, must fail); two roots under `personal_data_export/` (D-03, must pass); roots plus loose `Readme_*.pdf` files (D-05, must pass, real shape); duplicate root names after normalisation (must fail); a root whose `User_Info` is absent (must pass with an ID-only identity).

## Architecture Patterns

### Recommended N-root resolver (prescriptive)

Input is the existing `prepare()` output: normalised paths, OS metadata already removed. The resolver does the following, in order.

1. **Ignore loose top-level files.** A path with no `/` after its first segment is not a folder entry and is excluded from every folder count (D-05). Do this inside the resolver, not in `prepare()`, so the `no-single-root` reason for `buildSingleFileZip` is still produced by the v1.0 chain when there are zero roots.
2. **Collect top-level folders.** The distinct first segments of entries that have a `/` after them.
3. **Transparent Wargaming wrapper.** If the only top-level folder is `personal_data_export` (case-insensitive, `isTransparentWrapper`), replace the candidate list with the folders beneath it (D-03). Its children may be several account roots.
4. **Single unknown wrapper.** If there is exactly one top-level folder and it holds no recognised category directly, apply the v1.0 wrapper descent unchanged (`MAX_WRAPPER_DEPTH`, single child only). This never produces more than one root, so the `w/x` + `w/y` shape (pinned case 9) keeps its reason.
5. **Account root.** A candidate folder is an account root when it directly holds at least one child folder whose `classifyFolder` is not `unknown`. The folder's name is not checked (D-01).
6. **Failure rules, applied only when at least one root exists.**
   - (a) Any candidate folder that is not a root is a stray folder and fails the import (D-02). This includes a folder that holds recognised categories only deeper down (the `Wrapper/123/User_Info` shape), which is the fail-closed case the v1.0 check existed for.
   - (b) Any recognised category folder at the top level fails the import (D-04). Report it as `ambiguous-root`, the reason pinned by case 11.
   - (c) Two roots whose names are equal after normalisation fail the import.
7. **Zero roots.** Fall through to the unchanged v1.0 chain (rootless read, wrapper retry, named reasons). This preserves cases 2-5, 8, 14 and 17 exactly, including the rule that an unknown folder with no recognised category is ordinary data when no account root exists (RESEARCH Pitfall 1 in `classify.ts`).
8. **Bound the root count.** Set a maximum number of account roots and fail beyond it (Security Domain). The value is a discretion choice and is not in the phase context.

The output is a list of roots, each with its own category counts, plus the merged category list (counts summed by category name). `accountRoot` is kept as the first root in D-16 order, or `''` when there are zero roots, so v1.0 consumers still compile.

### Per-file attribution (`resolveCsvFileCategory`, D-06)

Given a raw entry name and the set of roots, the owner is the first path segment, after dropping the transparent wrapper, that is a root. The category is the next segment, and the source file is the rest, which must end in `.csv`. The v1.0 `lastIndexOf('/' + root + '/')` fallback exists for the single-root arbitrary-wrapper shape (`WrapperName/123456789/...`, pinned by the wrapper test at `classify.test.ts` 397-416). It may be used only when the root set has exactly one member. With two or more roots it would attribute a nested folder of one account to another, so it must be disabled. The inflate filter and the parse loop must call the same function with the same root set, which is what keeps the per-category counts equal to the stored rows.

### Stored shape (no Dexie bump)

- **Rows.** Each `DatasetRow` gains a non-indexed `account` string: the owning root, or `''` for a rootless dataset. The `rows` store stays `'++id, category, sourceFile'` (`db.ts` 199-201). A row with no `account` (every v1.0 row) is read as the legacy single account, which is `meta.accountRoot`.
- **Meta.** `DatasetMeta` gains a non-indexed `accounts` list. Each entry holds the root, the per-account category entries with their row counts, the per-account identity, the per-account file-presence facts, and the per-account summary (games, first and last activity year, ordering key). The top-level `accountRoot`, `identity`, `categories` and `files` stay as legacy fields, derived from the list: `accountRoot` and `identity` from the first account in D-16 order, `categories` merged, `files` concatenated with an `account` tag on each entry.
- **One normaliser.** A single function turns any stored meta into the `accounts` list, with legacy meta becoming a one-entry list built from the top-level fields. `resultFromMeta` and every reader use it, so a v1.0 cache and a Phase 9 cache answer through one path.
- **Why no bump is safe.** The precedents are `playtime` (Phase 4, D-02), `files` (Phase 5, 05-07) and `logins` (Phase 6, 06-01). Each added a non-indexed field to `meta`, and `tests/unit/import/db.test.ts` pins `db.verno` to 2 (lines 839 and 859 `[GREP]`) with the `version(2)` upgrader (`db.ts` 199-207 `[VERIFIED: src/lib/worker/db.ts:199-207]`) unchanged.
- **Writes.** `writeDataset` stays one transaction (clear, chunked `bulkPut`, `meta.put`, `db.ts` 256-271). The new `accounts` argument is a trailing optional parameter defaulting to `null`, the same convention the existing optional arguments use, so the existing four- and five-argument callers keep compiling.

### Parse loop (`ingest.worker.ts` 709-1025)

- Keep the loop over categories so `ParsingProgress` and the regex-pinned progress text (`persistent-dataset.spec.ts` line 444 `[GREP]`, `^Parsing \S+ \(\d+\/\d+\)\.\.\.$`) are unchanged.
- For each resolved file, take the owning root and stamp `account` on every row pushed to `allRows`. The sanitisation choke point (`ingest.worker.ts` 908-914) is root-agnostic and needs no change.
- Partition `accountInfoRows` and `otherUserInfoRows` by root (a map from root to the two arrays). Build the identity and the account record per root, each from that root's pool only. The `Account_Info.csv` preference (D-17's "prefer the account row") applies inside each root.
- Keep one `SessionSource` and one `LoginSource` per (root, file) pair, with the root recorded beside the source. Playtime and logins are built from all sources together (D-09).
- Keep `presenceFiles` per root for `accounts[].files`. Presence is an OR fold on read, so the flattened list is safe for the top-level field. The cap `MAX_PRESENCE_FILES` (500, `db.ts` 161) is per dataset; with N accounts it should be applied per account, or the flattened list will hit it sooner.
- Compute the per-account summary here, once: games from `sessionFileGame` over that root's session files with at least one row (D-14); first and last year from the minimum and maximum of `parseSessionTimestamp` values over the same files (D-15), using `civilFromDays` for the year; the ordering key from D-16.

### Reader scoping (D-11, D-12)

| Reader | Keys or dedupes on | Problem with N accounts | Phase 9 action | Left for Phase 10 |
|--------|-------------------|--------------------------|----------------|-------------------|
| `readSessionRowData` (`db.ts` 335-375) | category, then `sourceFile` | Three accounts' `WOT_Game_Sessions.csv` collapse into one source; columns resolved from the first row only; rebuild differs from import | Add `account` as the outer grouping key, keep `account ?? legacy` | Overlap counting, game filter |
| `readLoginRowData` (`db.ts` 458-530) | category, `sourceFile`; account pool from all User_Info | Same grouping problem; pool is global, so the identity of an account with no User_Info is borrowed from another account (identity.ts 372-375) | Account level in grouping; pool scoped per root | Source-account column on logins |
| `readRowsByFile` (`db.ts` 586-622) | lower-cased file name only | Rows of the same file from three accounts merge; `resolveFields` uses the first row's header for all of them | Unchanged (merged by design); add a test that a multi-account snapshot answers each title | Per-account slicing, vehicle merge by id, finance totals per currency |
| `vehicleFilesOf` and `isPresent` (`data-queries.ts`) | file name; presence | Presence is an OR fold over `snapshot.files` (`some`), so duplicate entries are harmless and cannot flip a title state; the title state uses merged row counts | None | Per-account title state |
| `VehicleTable.svelte:327` | `{#each drawn as { row, index } (row.id)}` | Same vehicle id in two accounts repeats the key. The sample has `WOTB_Vehicle_Statistics.csv` in three accounts | Key by `index` (the value is already available as `index`) | Source-account column; dedupe |
| `BattleTypeSummary.svelte:162` | `{#each summary as row (row.code)}` fed by `buildSummary` (`vehicle-aggregate.ts` 760-762, no dedupe) | Repeated battle-type codes repeat the key. The sample has `WOTB_Battle_Types_Statistics.csv` in two accounts | Key by `index`; do not change `buildSummary`'s row content | Summing battles per code across accounts |
| `PlayerStats.svelte:631` | `{#each view.battleTypes as code (code)}` | `battleTypeCodes` deduplicates through a `Set` (`vehicle-aggregate.ts` 723-735), so codes are unique | None | — |
| `finance-aggregate.ts` maps (547, 713-714, 836) | Map keys (currency, year, game, card) | Keys are unique by construction; totals merge across accounts | None (Phase 10 reviews blended totals) | Per-currency totals across accounts |
| `DeviceTable.svelte:90`, `HourGrid`, `CalendarHeatmap`, `DurationList` | index or bucket | Not keyed by a per-account value | None | — |
| `rowIndex` (`ingest.worker.ts` 918) | nothing | No reader reads `rowIndex`; grep finds it only in the import loop and in the `DatasetRow` type | Restarting it per account is safe; it is not a key | — |

Not traced in this session: the keys of `SpendSummary.svelte` `(figure.hook)` and the `LoginTable`/`CountryList` rows. The planner should confirm them before the caption work, using the same test as above.

### Identity header (D-13..D-17)

- **Single account.** Keep the current DOM and test ids exactly. The nine or more existing identity assertions (`identity-privacy.spec.ts` 284-312, 359-360 `[GREP]`) depend on `identity-nickname`, and a single account must keep rendering "exactly as v1.0" (D-13).
- **Several accounts.** Render a list in the stored order. Each row shows nickname (or the ID when the account has no `User_Info`), the games covered, and the first-to-last years or "no activity recorded". The ID stays visible on every row (D-17). `IdentityHeader.svelte` today asserts that the nickname appears exactly once in the document (lines 28-29, the D-21 comment); that rule has to be restated for several accounts (Open Question 5).
- **Games.** Derive from the stored per-account summary, which holds only tokens whose files had at least one row (D-14). The friendly names must come from one token table. The existing `GAME_NAMES` map in `ui-copy.ts` 2741-2746 `[GREP]` gives WOT "WoT", WOTB "WoT Blitz", WOWS "Warships", WOWP "Warplanes", and has no WOTC or HEAT. D-14 asks for "World of Tanks" and "World of Warships". Reuse the token list, add WOTC and HEAT, and keep the existing short labels for the existing panes so v1.0 labels do not change (Open Question 7).
- **Years.** Computed in the worker from `parseSessionTimestamp` (`playtime-aggregate.ts` 155-180 `[VERIFIED: src/lib/features/playtime/playtime-aggregate.ts:150-180]`), then the year is extracted with `civilFromDays`. The real sample's timestamp shape is the dotted day-first form (`DD.MM.YYYY HH:MM`) according to the module's own comment (lines 31-34 `[GREP]`); this is cited, not verified against the file, and the parser already handles it.
- **Ordering.** First activity year ascending, then accounts with no activity, then ties by account ID in plain code-unit order. The stored ordering key makes return visits order identically, the same way `sortCategoryEntries` does for categories.
- **Overview and account row.** `overview-model.ts` 98-106 builds the Account card's summary from `identity.createdAt`, and `selection-state.ts` 180-185 builds the account row's headline from `identity.region` `[GREP]`. For several accounts these need a rule (Open Question 3).

### Caption (D-11)

Thread an optional account count through `sectionProps` (`Dashboard.svelte` 275-316 `[GREP]`) into `DashboardSection`'s provenance block, which already holds the per-section status line and `ImportSummary` (`DashboardSection.svelte` 95-107 `[GREP]`). Show the caption only when the count is greater than one. The five panes named in D-11 are the Playtime, Login history, Vehicles, Finance and Device info sections. The Payments section (`payment-history`) also reads merged rows through `readRowsByFile`, so it should carry the caption too (Open Question 8). The Account section is the identity list and does not get a caption.

### Anti-patterns to avoid

- **A global User_Info pool.** Any identity or account-record read that does not filter by root reproduces the wrong-nickname bug (Pitfall 1).
- **Reusing the rootless ambiguity check as the multi-root rule.** `unknownFolderHoldsRecognized` answers "does an unknown top-level folder hold a recognised category beneath it", which is true for every root in a multi-root zip (Pitfall 4).
- **Dropping loose files in `prepare()`.** That changes the reason for `buildSingleFileZip` and the `detectRoot` lone-file test (`classify.test.ts` 114-118).
- **A shared email across roots in fixtures.** `SAMPLE_LOGIN` (`export-fixtures.ts` 149) reused across roots proves only that one root was stripped. Each root needs its own canary (Pitfall 7).
- **An index on `account`.** Violates D-07 and would need a bump. Filter in memory.
- **Bumping `PLAYTIME_VERSION` or the logins version.** Single-account output is unchanged, and the rebuild is equal to the import once the grouping has the account level (Pitfall 3). A bump would make every returning user recompute for no gain.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Folder category classification | A second folder list or a regex | `classifyFolder` in `categories.ts` | Case-insensitive, already the single source |
| Game token from a file name | A new filename parser | `sessionFileNameGame` / `sessionFileGame` | Bounded regex, rejects lookalikes, and is the playtime rule |
| Session timestamps and years | `new Date(...)` on the timestamp | `parseSessionTimestamp` plus `civilFromDays` | Wall-clock arithmetic, no timezone shift (D-01 comment in `playtime-aggregate.ts`) |
| PII strip per root | A per-root strip function | The existing header-keyed choke point (`ingest.worker.ts` 908-914) | Root-agnostic by design; a second copy would drift |
| Identity pick and account record | New row choosers | `extractIdentity` and `extractAccountRecord` called with a per-root pool | The `pick` and `parseIp` logic stays in one place |
| Dataset hash | A new hash | `digestFile` in `hash.ts` | Unchanged behaviour is required by ACCOUNT-03 |
| Category ordering | A new comparator | `sortCategoryEntries` | The replay path must order the same as the import |
| Virtualised or keyed lists | A new list component | Existing `{#each}` with an index key | Keyed each is only safe with unique keys |
| Test zips | A new zip writer | `zipSync` in `tests/fixtures/pinned-zip.ts` (line 50 `[GREP]`) | Already used by every builder |

**Key insight:** every identity and strip rule already exists as a function. The Phase 9 risk is calling those functions with a value that spans several roots, not a missing algorithm.

## Runtime State Inventory

This phase changes the stored data model, so the five categories are answered. It is not a rename.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Every v1.0 cache: `rows` records with no `account` field; `meta.id === 'active'` with `accountRoot`, `identity`, `files`, `playtime`, `logins` and no `accounts` field | Code change only. The legacy normaliser builds a one-account list from the top-level fields. No data migration. Test with a v1.0 fixture written before the change |
| Live service config | None. The app has no server, no hosted state and no external service | None |
| OS-registered state | None | None |
| Secrets and env vars | None touched. The CSP and the zero-network guard are unchanged | None |
| Build artifacts | None. No package is added. The `geo:*` build assets are not touched | None |

**Canonical question:** after every file is updated, what still holds the old single-root shape? Only persisted v1.0 caches, which the normaliser handles. No other runtime system caches the root.

## Common Pitfalls

### Pitfall 1: Global User_Info pool borrows another account's identity
**What goes wrong:** the account with no `User_Info` shows another account's nickname, region and creation date.
**Why it happens:** `extractIdentity` returns `rows[0]` when no row's `ID` equals the root (`identity.ts` 372-375 `[VERIFIED: src/lib/worker/identity.ts:368-381]`). A pool built across all roots is never empty once any root has `User_Info`.
**How to avoid:** build one pool per root in the import, and filter the login-rebuild pool by `row.account` in `readLoginRowData`. An empty per-root pool must return `null` (D-16 fallback), never another root's row.
**Warning signs:** a fixture where only one root has `User_Info` shows that root's nickname under the other root's ID. The real sample is this case: 1234567 has no `User_Info`, while 234567890 and 345678901 do.

### Pitfall 2: Keyed each with repeated values
**What goes wrong:** Svelte 5 reports a duplicate-key error on the Vehicles pane and the page stops rendering that pane. Success Criterion 2 fails.
**Why it happens:** `VehicleTable.svelte` 327 keys by `row.id`; `BattleTypeSummary.svelte` 162 keys by `row.code`, and `buildSummary` does not deduplicate (`vehicle-aggregate.ts` 760-762). The real sample repeats `WOTB_Vehicle_Statistics.csv` in three accounts and `WOTB_Battle_Types_Statistics.csv` in two (zip listing `[VERIFIED: python zipfile listing this session]`).
**How to avoid:** key by `index` in both blocks. Do not deduplicate `buildSummary`'s rows, because Phase 10 owns summing.
**Warning signs:** an e2e run that selects the WOTB title with a two-account fixture. The exact runtime failure is `[ASSUMED]` (see the Assumptions Log); the planner should write the test first and confirm the failure.

### Pitfall 3: Rebuild differs from import
**What goes wrong:** a stored aggregate computed at import disagrees with the aggregate rebuilt later from the same rows, which breaks the "deleted aggregate is rebuilt identically" guarantee.
**Why it happens:** the import builds one source per (account, file) and resolves columns from the first row of each source, but `readSessionRowData` groups by (category, file) and merges accounts. A header that differs between accounts changes which columns resolve.
**How to avoid:** group by (account, category, file) in both readers and feed the same per-source objects to the same aggregator. Keep `PLAYTIME_VERSION` and the logins version unchanged, because single-account output is unchanged.
**Warning signs:** the existing "stored aggregate deleted is rebuilt identically" test (`ingest-worker.test.ts` around 2012-2030 `[GREP]`) passes for one root and fails for two. Add the multi-account twin.

### Pitfall 4: The rootless ambiguity check rejects every multi-root zip
**What goes wrong:** every multi-root import is reported `ambiguous-root`.
**Why it happens:** `unknownFolderHoldsRecognized` is true when an unknown top-level folder holds a recognised category within four directory levels, which is always the case for an account root. Reusing it as the multi-root failure rule rejects all of them.
**How to avoid:** use the rules in the N-root resolver. Apply the stray-folder rule only to folders that are not roots, and the top-level-category rule only to recognised top-level folders.
**Warning signs:** pinned case 11 still passes while the new two-root fixture fails.

### Pitfall 5: Loose files change the v1.0 reasons
**What goes wrong:** a zip with only `document.pdf` changes reason, or the real sample's loose PDFs make the wrapper retry fail.
**Why it happens:** `detectRoot` counts every first segment, including loose files (`classify.ts` 107-124).
**How to avoid:** ignore loose files inside the new resolver (Architecture Patterns step 1), and leave `detectRoot` unchanged for the zero-root fallback.

### Pitfall 6: Strict locators on the nickname test id
**What goes wrong:** the existing identity specs fail on a multi-account fixture with a strict-mode violation, because `getByTestId('identity-nickname')` matches several elements.
**Why it happens:** `identity-privacy.spec.ts` 284-312 and 359-360 `[GREP]` locate the nickname by test id, and a stacked list gives each account a nickname element.
**How to avoid:** keep the single-account DOM and test ids. Give multi-account rows their own test ids (per account), and write the multi-account assertions against those.

### Pitfall 7: Shared canaries prove too little
**What goes wrong:** a leak from one root goes unnoticed.
**Why it happens:** `SAMPLE_LOGIN`, `SAMPLE_BIRTH_DATE` and `VARIANT_OVERFLOW_CANARY` are single values (`export-fixtures.ts` 149-161). Reusing them across roots means a stripped copy in one root and a leaked copy in another look identical in a value search.
**How to avoid:** give every root its own canary email (distinct domain or local part), birth date and overflow cell. Assert each canary is absent from IndexedDB and from the rendered DOM.

### Pitfall 8: Dexie version and index drift
**What goes wrong:** a bump or a new index wipes returning users' caches, or the pinned `verno` test fails.
**Why it happens:** the `version(2)` upgrader clears both stores on any database that has a v1 schema (`db.ts` 199-207). Any `version(3)` would need its own upgrader.
**How to avoid:** no `stores()` change. `account` and `accounts` are non-indexed. `db.test.ts` 839 and 859 and `replay-reclassify.test.ts` 326 must keep passing.

### Pitfall 9: v1.0 caches have no years
**What goes wrong:** a returning user with a v1.0 cache sees the identity header without first-to-last years, or with a wrong one.
**Why it happens:** v1.0 meta holds no per-account summary, and the years need timestamps from session rows.
**How to avoid:** Open Question 4. The recommended path is a lazy rebuild keyed by a new summary version constant, written with the same `importedAt`-guarded write pattern as `writeLoginsIfCurrent` (`db.ts` 671-681).

### Pitfall 10: Account card and account row read one identity
**What goes wrong:** the Account card and the Account row show one account's creation date or region as if it described the export.
**How to avoid:** Open Question 3. Whatever rule is chosen, the header list and the card must not disagree.

### Pitfall 11: Scale and the single transaction
**What goes wrong:** a large multi-account import holds every row and the inflated bytes at once.
**Why it happens:** `unzipSync` inflates all selected entries into one object, `allRows` holds every row, and `writeDataset` writes everything in one transaction.
**How to avoid:** the caps (`inflate-bounds.ts` 55-58) already bound inflation. Keep one transaction (D-10), because a per-account transaction would break the replace guarantee. Size the synthetic fixture modestly and leave the 54,000-row check to Phase 10 (SCALE-01). The transaction size for a three-account real export is `[ASSUMED]` to be safe (Assumptions Log).

### Pitfall 12: The e2e budget
**What goes wrong:** the CI e2e step is killed by a limit, or the limits fall out of order.
**Why it happens:** the budget guard pins the listed-test count and the three limits together (`ci-budget.test.ts`, the constants block near lines 118-215 and the assertions at 355-372 `[GREP]`).
**How to avoid:** see the e2e budget section. Parametrised tests count once each, so a loop over variants adds one listed test per variant.

### Pitfall 13: Real-sample loose PDFs and the stray rule
**What goes wrong:** the stray-folder rule fires on something that is not a folder.
**How to avoid:** D-05 is applied before D-02. The real sample has exactly two loose files and no stray folder.

### Pitfall 14: Two roots with case-variant names
**What goes wrong:** two roots whose names differ only in case are treated as two accounts, and the per-root pools blur.
**How to avoid:** rule 8(c). Fail on normalised-name collision (case-insensitive). The real sample uses numeric IDs, so this is defensive.

## Real Sample Shape

Source: the user's `2026-10-14.zip`, 117 entries, inspected with `python3 -I` `zipfile`, entry names and CSV header lines only (plus the disclosed line counts). Nothing was extracted.

**Top level:** three numeric account folders (`234567890/`, `345678901/`, `1234567/`), each with directory entries, and two loose files, `Readme_en.pdf` and `Readme_ru.pdf` (122,583 and 131,898 bytes). No `personal_data_export/` wrapper. `[VERIFIED: python zipfile listing this session]`

| Root | Categories (folder, as written in the zip) | Notable files | Has User_Info | Game tokens with at least one data line (line count) |
|------|---------------------------------------------|---------------|---------------|-------------------------------------------------------|
| 234567890 | Activity_History, Authorized_Third_Parties, Bans, Bonus_Codes, Chat_History, Clans, Device_Info, Financial_Data, Game_Forums, Payment_History, Personal_Coupons, Player_Statistics, Subscriptions, Surveys, User_Info | `Virtual_Currencies_Operations.csv` 3,645,592 bytes; `WOT_Game_Sessions.csv` 178,419 bytes; `Game_Forums/WOT_Forum_User_Info.csv` (header includes EMAIL) | Yes (`Account_Info.csv`, `Account_Name_History.csv`, `External_Services_History.csv`, `Language_And_Country_History.csv`) | WOT (2,559), WOTB (77), HEAT (5) |
| 345678901 | Activity_History, Chat_History, Device_Info, Financial_Data, Payment_History, Player_Statistics, Subscriptions, User_Info | `WOT_Game_Sessions.csv` 104 bytes (one data line); `Game_Active_Sessions.csv` (no game token) | Yes (`Account_Info.csv`, `External_Services_History.csv`, `Language_And_Country_History.csv`) | WOTB (96), WOT (1) |
| 1234567 | Activity_History, Bonus_Codes, Chat_History, Device_Info, Payment_History, Player_Statistics | `WOTC_Game_Sessions.csv`, `WOWS_Game_Sessions.csv`; WOWP and WOWS statistics | **No** | WOT (4,224), WOTB (64), WOTC (3), WOWS (10) |

**Headers verified (names only):**
- `*_Game_Sessions.csv` (all accounts): `"STARTED_AT","FINISHED_AT","IP"` `[VERIFIED: zip header read this session]`
- `Game_Active_Sessions.csv`: `"GAME_NAME","CREATED_AT","UPDATED_AT","STATE","IP"`, no game token `[VERIFIED: zip header read this session]`
- `User_Info/Account_Info.csv`: `"ID","NAME","CREATED_AT","ACTIVATED_AT","IP","COUNTRY_CODE","REGION","CITY","LOGIN","USER_LANGUAGE","USER_STATED_COUNTRY","BIRTH_DATE","BIRTH_DATE_SRC"` `[VERIFIED: zip header read this session]`. The `LOGIN`, `BIRTH_DATE` and `BIRTH_DATE_SRC` columns are the three the strip removes.
- `Game_Forums/WOT_Forum_User_Info.csv`: header begins `"NAME","BDAY_DAY","BDAY_MONTH","BDAY_YEAR","LAST_VISIT","JOINED","POSTS","LAST_POST","EMAIL","IP_ADDRESS",...` `[VERIFIED: zip header read this session, first 260 characters]`

**Folder casing:** the zip spells `Activity_History`, `Chat_History`, `Device_Info`, `Financial_Data`, `Payment_History`, `Player_Statistics`, `User_Info`. `classifyFolder` is case-insensitive, so these classify as supported or known-deferred as they should. `Chat_History` is known-deferred (`categories.ts` 35 `[VERIFIED: src/lib/worker/categories.ts:35]`). `Authorized_Third_Parties`, `Bans`, `Bonus_Codes`, `Game_Forums`, `Personal_Coupons`, `Subscriptions` and `Surveys` are unknown and stored raw.

**Duplicates across accounts (file names only):**
- `WOTB_Account_Statistics.csv`, `WOTB_Vehicle_Statistics.csv`, `WOTB_Vehicle_Statistics_By_Type.csv`: three accounts each.
- `WOT_Account_Statistics.csv`: two accounts (234567890, 345678901).
- `WOTB_Battle_Types_Statistics.csv`: two accounts (234567890, 345678901).
- `Subscriptions.csv`, `External_Services_History.csv`, `Language_And_Country_History.csv`: the same byte size in the two accounts that have them, consistent with the CONTEXT note. Deferred to Phase 12.
- `Operations_With_Premium_Days.csv`: two accounts (234567890, 345678901).

**What D-14 yields:** 234567890 covers WoT, WoT Blitz and HEAT (HEAT is listed, with no pane yet). 345678901 covers WoT and WoT Blitz. 1234567 covers WoT, WoT Blitz, WoT Console and WoWS. `Game_Active_Sessions.csv` is excluded in every account. These are based on row presence from line counts, not on content.

**Behaviour today:** `analyzeExport` returns `no-single-root` for this zip, because the top-level has four distinct first segments (`classify.ts` 107-124 and 543-544). This matches the CONTEXT description.

**What is not known:** the timestamp values, the presence of values in `EMAIL` and the other columns, and whether the non-identical headers of the same file name across accounts differ. The planner must not assume any of these without a test against the synthetic copy.

## Test and Fixture Surface

### Fixtures

- `tests/fixtures/export-fixtures.ts` holds the shared single-root builders (`buildSampleExport`, `buildWrapperExport`, `buildRootlessExport`, `buildCustomExport`) and the failure builders. `buildMultiRootZip` (line 510 `[GREP]`) is the two-root fixture that Phase 9 must flip, and its doc comment must change.
- `tests/fixtures/sample-account.ts` line 29: `SAMPLE_ACCOUNT_ROOT = '123456789'` `[GREP]`.
- `tests/fixtures/pinned-zip.ts` line 50: `zipSync` `[GREP]`.
- **Recommended new file:** `tests/fixtures/multi-account-fixtures.ts`, exporting the one-, two- and three-root builders, the stray-folder builder (D-02), the top-level-category-beside-roots builder (D-04), the `personal_data_export`-wrapped two-root builder (D-03), the real-shape builder with loose `Readme_*.pdf` (D-05), a root-without-User_Info builder, and a builder for the real-shape three-account copy. Each root gets its own canary values. All values are synthetic, and no real account number or name appears.

### Existing specs that need a multi-account twin

| Spec | What it asserts today | Phase 9 change | Budget cost |
|------|------------------------|----------------|-------------|
| `tests/unit/import/classify.test.ts` | Single-root rules; `buildMultiRootZip` fails | Flip rows 1, add the new cases from the inventory | Unit only |
| `tests/unit/import/ingest-worker.test.ts` | Identity, no-leak, replay, rebuild for one root (lines 451-530, 591-810, 1004-2120 `[GREP]`) | Add per-root identity, per-root no-leak with per-root canaries, N-root replay, multi-account rebuild equality | Unit only (fake IndexedDB) |
| `tests/unit/import/replay-reclassify.test.ts` | Duplicate re-drop and status replay (lines 275-325) | Add a two-root duplicate case | Unit only |
| `tests/unit/import/db.test.ts` | `verno` is 2; upgrader behaviour (lines 268-330, 839, 859) | Add `account` and `accounts` round-trip; keep `verno` 2 | Unit only |
| `tests/unit/import/data-query-worker.test.ts` | Query answers | Add one multi-account snapshot case per channel that merges (vehicles, finance, device info) | Unit only |
| `tests/e2e/import/import-failure.spec.ts` (d), lines 158-186 `[GREP]` | Multi-root zip shows the banner | Flip: the two-root zip now imports; add the stray-folder zip in its place so SC4 stays covered | Modify existing (no new listed test) |
| `tests/e2e/import/import-flow.spec.ts` (a) | Summary and badges for one export | Add a two-root summary test | 1 listed test |
| `tests/e2e/import/persistent-dataset.spec.ts` (a), (d), (e), (f) | Reload, replace-on-drop, start over, clear | Add one two-root and one three-root flow covering reload, replace, clear | 1-2 listed tests |
| `tests/e2e/shell/identity-privacy.spec.ts` (a), (b), (c) | Nickname and no leak, one root | Add a multi-account twin; (c) is parametrised by variant, so each variant is a listed test | 1 listed test if written as one test |
| `tests/e2e/guards/zero-network.spec.ts` | Zero requests through several flows | Add one multi-account import flow to the request assertion | 1 listed test |

### E2E budget (verified against the guard)

- `playwright.config.ts` line 180: `globalTimeout: 29 * 60 * 1000` `[GREP]`.
- `.github/workflows/ci.yml` line 196: `pnpm exec timeout 31m playwright test` `[GREP]`; line 94: `timeout-minutes: 39` `[GREP]`.
- `ci-budget.test.ts` 355-372 `[GREP]`: Phase 8 held G = 1740 s, W = 1860 s and J = 2340 s, and the listed count must be at most 258. The guard's own measured count is 252 (`projectedE2eSeconds(252)` = 1308 s, near line 325 `[GREP]`). ROADMAP's "254 of 258" is stale; the guard is the authority.
- **Headroom:** six listed tests. Above 258, all three limits must be raised together, by the rule the guard file states (G + 2 min, W + 8 min). Put the bulk of the Phase 9 matrix in unit tests against fake IndexedDB, and keep the new e2e tests to about five.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (unit, `pnpm run test:unit` → `vitest run`) and Playwright (e2e, `pnpm run test:e2e` → `playwright test`) `[VERIFIED: package.json scripts, read via python listing this session]` |
| Config file | `vitest` config in the repo root; `playwright.config.ts` |
| Quick run command | `pnpm run test:unit -- tests/unit/import/classify.test.ts tests/unit/import/ingest-worker.test.ts` |
| Full suite command | `pnpm run test:unit && pnpm exec playwright test` |
| Gates | `pnpm run check` (tsc and svelte-check) and `pnpm run lint` (prettier and eslint) |

### Phase Requirements to Test Map

| Req ID | Behaviour | Test type | Automated command | File exists? |
|--------|-----------|-----------|-------------------|--------------|
| ACCOUNT-01 | Two- and three-root zips classify as accounts; real-shape zip with loose PDFs classifies | unit | `pnpm run test:unit -- tests/unit/import/classify.test.ts` | Flip + new cases (Wave 0) |
| ACCOUNT-01 | Multi-account import posts `done` without the banner | e2e | `pnpm exec playwright test tests/e2e/import/import-flow.spec.ts` | Add twin |
| ACCOUNT-02 | Root without User_Info gets an ID-only identity; no other root's row used | unit | `pnpm run test:unit -- tests/unit/import/ingest-worker.test.ts` | Add (Wave 0) |
| ACCOUNT-02 | Every existing pane opens on a multi-account dataset (keyed-each fix) | e2e and unit | `pnpm exec playwright test tests/e2e/shell/dashboard.spec.ts` plus a unit test on the keyed key values | Add twin |
| ACCOUNT-03 | Reload returns the same accounts; identical zip is `duplicate`; different zip replaces all; no old rows | unit and e2e | `pnpm run test:unit -- tests/unit/import/replay-reclassify.test.ts tests/unit/import/db.test.ts`; `pnpm exec playwright test tests/e2e/import/persistent-dataset.spec.ts` | Add twins |
| ACCOUNT-03 | No Dexie version change | unit | `pnpm run test:unit -- tests/unit/import/db.test.ts` (`verno` 2) | Exists |
| ACCOUNT-05 | Header lists every account with ID, games and years; ordering by D-16 | unit and e2e | `pnpm run test:unit -- tests/unit/import/ingest-worker.test.ts`; `pnpm exec playwright test tests/e2e/shell/identity-privacy.spec.ts` | Add (Wave 0) |
| ACCOUNT-05 | Years from min and max session start; "no activity recorded" when none | unit | `pnpm run test:unit -- tests/unit/import/ingest-worker.test.ts` | Add (Wave 0) |
| ACCOUNT-08 | Clear and Start Over remove every account's rows | e2e and unit | `pnpm exec playwright test tests/e2e/import/persistent-dataset.spec.ts`; `clearData` unit test in `db.test.ts` | Add twin |
| ACCOUNT-08 | Fixtures for 1, 2 and 3 roots pass import, reload, replace and clear | unit | `pnpm run test:unit -- tests/unit/import` | Wave 0 fixtures |
| D-02, D-04 | Stray folder and top-level category beside roots fail with the banner | unit and e2e | `pnpm run test:unit -- tests/unit/import/classify.test.ts`; `pnpm exec playwright test tests/e2e/import/import-failure.spec.ts` | Add (Wave 0) |
| D-03 | Two roots under `personal_data_export/` import | unit | `pnpm run test:unit -- tests/unit/import/classify.test.ts` | Add (Wave 0) |
| Privacy (SC4) | No email or birth date in IndexedDB or the DOM for any root | unit and e2e | `pnpm run test:unit -- tests/unit/import/ingest-worker.test.ts`; `pnpm exec playwright test tests/e2e/shell/identity-privacy.spec.ts` | Add per-root canaries |
| Zero network (SC5) | No request after load through a multi-account import | e2e | `pnpm exec playwright test tests/e2e/guards/zero-network.spec.ts` | Add twin |
| Budget | Listed-test count stays at or below 258, or all three limits move together | unit | `pnpm run test:unit -- tests/unit/guards/ci-budget.test.ts` | Exists |
| Rebuild equality | Deleted aggregate rebuilt identically for two roots | unit | `pnpm run test:unit -- tests/unit/import/ingest-worker.test.ts` | Add (Wave 0) |

### Sampling Rate

- **Per task commit:** the touched unit file, for example `pnpm run test:unit -- tests/unit/import/classify.test.ts`.
- **Per wave merge:** `pnpm run test:unit`.
- **Phase gate:** `pnpm run test:unit && pnpm exec playwright test`, plus `pnpm run check` and `pnpm run lint`. The full suite must be green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/fixtures/multi-account-fixtures.ts` covers REQ ACCOUNT-08 (one-, two-, three-root builders; stray; top-level category; wrapper; real-shape with loose PDFs; root without User_Info; per-root canaries)
- [ ] `tests/unit/import/classify.test.ts` flips rows 1 and the new cases from the inventory
- [ ] `tests/unit/import/ingest-worker.test.ts` gains per-root identity, no-leak, replay, and rebuild equality for N roots
- [ ] `tests/unit/import/db.test.ts` gains the `account` and `accounts` round-trip
- [ ] A unit test that calls each merged reader (`readRowsByFile`, the battle-type summary, the vehicle rows) with duplicate keys and asserts the keys are unique (the keyed-each regression)
- [ ] Framework install: none; both frameworks are already present

*(If the planner judges the Wave 0 list too large for one plan, split the classifier from the storage and the header.)*

## Security Domain

Required: `security_enforcement` is not set to false, so the section applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts or logins in the app |
| V3 Session Management | no | No server sessions; the account IDs are data, not sessions |
| V4 Access Control | no | Single local user; no authorisation model |
| V5 Input Validation | yes | Fail-closed zip and folder classification; length-bounded text (`cutText`, `MAX_ACCOUNT_TEXT_LENGTH` in `identity.ts`) |
| V6 Cryptography | no change | Existing `digestFile` (`hash.ts`); not hand-rolled |
| V7 Error handling and logging | yes | Log the error object only, never a cell (`ingest.worker.ts` 1017-1018; T-04-03 and T-06-01 discipline) |
| V8 Data Protection | yes | Per-row header strip at the single choke point; no email or birth date at rest or in the DOM |
| V9 Communications | yes | Zero-network guard, extended to a multi-account import |
| V14 Configuration | yes | CSP `connect-src 'self'` unchanged; no config change |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Root confusion lets a `User_Info` file skip the strip | Information disclosure | D-01 to D-05; ambiguity fails closed; strip is header-keyed at the choke point |
| Cross-account misattribution of a row or identity | Tampering, Repudiation | `account` stamped per row; per-root pool and per-root identity |
| Unbounded number of roots or rows exhausts memory | Denial of service | Root-count cap (Architecture Patterns step 8); existing inflate caps |
| Untrusted folder name rendered as markup | Tampering | Svelte text interpolation; length bound on the folder-derived ID |
| Email stored in an unknown category's raw CSV | Information disclosure | Open Question 1 (user decision) |
| Chat content stored raw in a known-deferred category | Information disclosure | Existing v1.0 behaviour; out of Phase 9 scope, recorded in Open Question 10 |

## Open Questions

1. **Email in an unknown category is stored raw (decision needed before planning).**
   - *What we know:* unknown categories are parsed and stored. The parse loop covers every category and the `recognized` set includes unknown ones (`ingest.worker.ts` 739, 745-749, 793-827 `[VERIFIED: src/lib/worker/ingest.worker.ts:739]`, with the rest `[GREP]`). The deny-list is `LOGIN`, `BIRTH_DATE`, `BIRTH_DATE_SRC` (`identity.ts` 101 `[GREP]`), and `identity.ts` documents that a renamed column such as `EMAIL` is not caught, accepted as T-03-03 (`identity.ts` 41-43 `[GREP]`). The real sample's `Game_Forums/WOT_Forum_User_Info.csv` has an `EMAIL` column in its header, with `IP_ADDRESS` and `BDAY_*` alongside it. The header is verified; whether the cells are populated is not verified.
   - *What's unclear:* whether SC4's "no account's email or birth date reaches storage" applies to unknown categories, given the documented residual.
   - *Options:* (a) extend the header deny-list to `EMAIL` and `BDAY_*` for every category; (b) do not store rows of unknown categories at all; (c) accept the residual and record it again.
   - *Recommendation:* raise with the user before planning. Option (b) is the strongest and is the smallest code change, but it changes what v1.0 shows for unknown folders. Do not widen the strip silently.
2. **Account record for logins with several accounts.** `buildLogins` takes one `account` (`login-aggregate.ts` 237, 364, 399 `[GREP]`), and `accountCells` renders one account row (`login-model.ts` 663-684 `[GREP]`). Options: the first account in D-16 order, labelled with its ID; or no account record when there are several accounts. Recommendation: no account record when there are several accounts, with the caption; per-account records are Phase 10's if needed. The import and the rebuild must apply the same rule.
3. **Single identity for the Account card and the account row.** `overview-model.ts` 99-106 and `selection-state.ts` 180-185 read one identity. Recommendation: headline "N accounts" and a summary of the earliest creation date, both derived from the stored list.
4. **Years for v1.0 caches.** v1.0 meta holds no per-account summary, so first-to-last years cannot be shown for an old cache without a row scan. Recommendation: a lazy rebuild keyed by a summary version constant, written with the `importedAt` guard used by `writeLoginsIfCurrent` (`db.ts` 671-681). That is a non-indexed field, so no bump. The alternative is "re-import to see the years", which the user would have to accept.
5. **The D-21 "nickname exactly once" rule.** `IdentityHeader.svelte` 28-29 states it. Recommendation: the rule holds per account row for several accounts, and the single-account DOM is unchanged. The planner should record this as a restatement, not a silent change.
6. **Reason name for an arbitrary wrapper.** D-03 says "any other wrapper holding recognised categories stays rejected (`ambiguous-root`)". The pinned test for the same shape (case 9) expects `no-recognized-category`. The reason is not shown to the user (one generic banner), so keep the pinned reason and do not rename it.
7. **Game names.** D-14 asks for long names, and `GAME_NAMES` (`ui-copy.ts` 2741-2746 `[GREP]`) holds short names used by existing panes. Recommendation: one token table; long names only in the identity list; add WOTC and HEAT there; existing labels unchanged. Confirm the consumers of `formatGameName` (`ui-copy.ts` 2761-2778) before reuse, because they were not traced.
8. **Caption on the Payments pane.** D-11 names five panes. Payments also merges rows (`readRowsByFile`). Recommendation: caption it too.
9. **Legacy `Sessions.csv` in the years.** The synthetic fixture's `Sessions.csv` has no game token but is a session file (`isSessionsRow`, `playtime-aggregate.ts` 276-292 `[VERIFIED: src/lib/features/playtime/playtime-aggregate.ts:276-292]`). Recommendation: include it in years and exclude it from games.
10. **Chat content stored raw (out of Phase 9 scope).** The real sample's `Chat_History` files are known-deferred but still parsed and stored. Recorded for the user; Phase 11 and 12's PRIV requirements are the place to decide.
11. **Root-count cap value.** Not specified by the phase. Recommendation: choose a small bound with a unit test and document it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Svelte 5 reports a duplicate-key error (or otherwise breaks) when a keyed each block repeats a key, so Pitfall 2 is a real failure | Reader scoping; Pitfall 2 | If Svelte tolerates duplicates silently, the fix is still correct but the regression test must assert the key values directly, not the rendered output |
| A2 | A single Dexie transaction for a three-account real export (about tens of thousands of rows plus the 3.6 MB finance file) completes within browser limits | Pitfall 11 | Could require chunked writes, which would break the one-transaction replace guarantee (D-10); test with the synthetic large fixture |
| A3 | The real sample's timestamps use the dotted day-first form | Identity header | If wrong, the parser already handles the ISO shape; years would still be computed, but the real-shape test must confirm it |
| A4 | The `EMAIL` column in `Game_Forums/WOT_Forum_User_Info.csv` has populated cells | Open Question 1 | If the cells are empty, the privacy risk is theoretical; the decision is still needed for the column |
| A5 | The same file name carries the same header across the three accounts | Real Sample Shape; Pitfall 3 | If not, merged readers (`readRowsByFile`) silently drop columns for the second account; the planner should check headers in the synthetic copy |
| A6 | The real sample's total data rows are large enough that the Virtual_Currencies file dominates memory | Pitfall 11 | Only the Phase 10 scale check (SCALE-01) depends on the exact figure |
| A7 | Expected budget arithmetic: 252 listed tests projects to 1308 s, which is inside 1740 s globalTimeout | E2E budget | Taken from the guard's own assertion; if the guard changes, use its value |
| A8 | A root-count cap around a few dozen is adequate | Architecture Patterns step 8 | Too low rejects a real large export; too high weakens the bound. The planner chooses and tests it |

**If this table is non-empty:** A1, A2, A4 and A5 need either a test in the plan or a user decision before execution. A3, A6, A7 and A8 are checks, not decisions.

## Project Constraints (from CLAUDE.md)

Directives from `/Users/you/CLAUDE.md`, `/Users/you/src/github/wot-gdpr-stats-visualizer/CLAUDE.md`, `AGENTS.md` and the user's global CLAUDE.md. The planner must verify each plan against these.

- **Privacy is the product.** No backend, no API calls, no analytics; zero network requests after load, except the single opt-in same-origin city file. Enforced by CI and the ESLint network ban, with the CSP as defence in depth.
- **Tech stack.** Svelte 5 with runes (not legacy patterns), Vite, pnpm (not npm).
- **No client-side router.** Selection is component state.
- **Dependency minimalism.** No new library; charts and the dropzone are hand-rolled.
- **Dexie.** The `version(2)` upgrader stays; no version bump for a non-indexed field (06-01 precedent).
- **Worker lifecycle.** One long-lived worker; `Papa.parse({ worker: false })` and fflate's `unzipSync` inside the pipeline.
- **Chart aggregation.** Aggregate per bucket; never one SVG node per raw row. The keyed-each fix in Pitfall 2 keeps this, because the rows are not charted.
- **Scale.** Designed for large exports; verify against a synthetic large-export fixture.
- **Mobile.** Responsive at phone width (480 px block, 44 px touch floor).
- **TypeScript** pinned to `^6`.
- **Linting.** ESLint and Prettier, not Biome.
- **Commits.** No `Co-Authored-By` trailer on commits in this project (the user's global and project CLAUDE.md both state it).
- **graphify.** After modifying code files, run `graphify update .`. This phase modifies no code, so no update is due from the research step.
- **GSD workflow.** Edits go through a GSD command. The research step writes only this planning artifact.
- **Sketch skill.** UI conventions for panes and header rows come from `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md`: master-detail shell, 480 px phone block, selection as state, the provenance line in place of raw folder headings (read this session, lines 1-80 `[VERIFIED]`).
- **Sample data.** The user's real zip must not be committed. Fixtures are synthetic copies of its shape.

## Sources

### Primary (verified in this session)
- `.planning/phases/09-multi-account-import-account-identity/09-CONTEXT.md` (read in full)
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 9 and Planning Notes), `.planning/STATE.md` (first 152 lines)
- `src/lib/worker/classify.ts` (read in full)
- `src/lib/worker/categories.ts` (read in full; lines 22-61 `[VERIFIED]`)
- `src/lib/worker/db.ts` lines 40-305 and 330-706 (read; `[VERIFIED: src/lib/worker/db.ts:44-150, 199-207, 245-274, 335-375, 458-530, 586-622, 640-706]`)
- `src/lib/worker/ingest.worker.ts` lines 696-1035 (read; `[VERIFIED: src/lib/worker/ingest.worker.ts:696-1035]`)
- `src/lib/worker/identity.ts` lines 326-460 (read; `[VERIFIED: src/lib/worker/identity.ts:326-460]`)
- `src/lib/core/types/worker-messages.ts` lines 14-96 (read; `[VERIFIED]`)
- `src/lib/features/playtime/playtime-aggregate.ts` lines 150-310 (read; `[VERIFIED]`)
- `src/lib/shell/IdentityHeader.svelte` (read in full; `[VERIFIED: src/lib/shell/IdentityHeader.svelte:1-203]`)
- `src/lib/shell/overview-model.ts` lines 60-116 (read; `[VERIFIED]`)
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md` lines 1-80 (read; `[VERIFIED]`)
- Zip entry listing and CSV header lines of `/Users/you/Downloads/path/to/export.zip` (`python3 -I` `zipfile`, no extraction; `[VERIFIED: zip listing this session]`)

### Grep or sed excerpts (confirmed text, not opened with Read; re-Read before quoting)
- `src/lib/worker/data-queries.ts` (`isPresent`, `vehicleFilesOf`) `[GREP: lines 125-160]`
- `src/lib/features/vehicles/vehicle-aggregate.ts` (`battleTypeCodes` 723-735, `buildSummary` 752-762, `buildVehicleView` 940-1025) `[GREP]`
- `src/lib/features/vehicles/VehicleTable.svelte:327`, `BattleTypeSummary.svelte:162`, `PlayerStats.svelte:631` `[GREP]`
- `src/lib/ui-copy.ts` 2741-2778 `[GREP]`; `src/lib/shell/Dashboard.svelte` 245-319 `[GREP]`; `DashboardSection.svelte` 87-107 `[GREP]`
- `src/lib/shell/selection-state.ts` 118-190 `[GREP]`; `src/lib/features/logins/login-model.ts` 618-684 `[GREP]`; `login-aggregate.ts` 227-400 `[GREP]`
- `src/lib/worker/inflate-bounds.ts` 55-58 `[GREP]`
- `tests/unit/import/classify.test.ts` test lines and fixture calls `[GREP]`
- `tests/fixtures/export-fixtures.ts` 149-161, 510-545, 615-628, 1077-1196 `[GREP]`; `sample-account.ts` 29 `[GREP]`; `pinned-zip.ts` 50 `[GREP]`
- `tests/unit/guards/ci-budget.test.ts` 60-120, 132-216, 300-372 `[GREP]`; `playwright.config.ts` 176-182 `[GREP]`; `.github/workflows/ci.yml` 90-96, 186-197 `[GREP]`
- `tests/e2e/shell/identity-privacy.spec.ts` 276-360, `tests/e2e/import/persistent-dataset.spec.ts` 165-766, `tests/e2e/import/import-failure.spec.ts` 78-304, `tests/e2e/import/import-flow.spec.ts` 168-600, `tests/e2e/guards/zero-network.spec.ts` 40-471 `[GREP]`
- `tests/unit/import/db.test.ts` 268-310, 839, 859 `[GREP]`; `replay-reclassify.test.ts` 138-325 `[GREP]`
- `package.json` scripts `[VERIFIED: package.json, python listing this session]`

### Project documents
- `/Users/you/CLAUDE.md`, `AGENTS.md`, `CLAUDE.md` (project and user), `graphify-out/GRAPH_REPORT.md` (head only; built from commit `264d202f`)

### Secondary and tertiary
- None. No web search was used, because this phase is a codebase investigation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new packages; all modules read or confirmed.
- Architecture (N-root resolver, stored shape, reader scoping): HIGH for the code paths and the test inventory; MEDIUM for the exact resolver wording, which the planner refines against the inventory.
- Pitfalls: HIGH for 1, 3, 4, 5, 6, 7, 8, 9, 12, 13 (verified in code or the zip); MEDIUM for 2 (the Svelte runtime is `[ASSUMED]`); MEDIUM for 11 (scale not tested).
- Privacy residual (Open Question 1): HIGH that the column is present in the header; the consequence depends on values that were not read, by rule.

**Research date:** 2026-10-16
**Valid until:** 30 days for the code facts (the phase is in progress, so re-check line numbers after any merge to `main`); the real-sample shape stays valid while the user's zip is unchanged.

## RESEARCH COMPLETE

**Phase:** 9 - Multi-account Import & Account Identity
**Confidence:** HIGH for the code and the real-sample shape; MEDIUM for the Svelte runtime and scale

### Key Findings
- The identity pick falls back to the first User_Info row of the whole dataset (`identity.ts` 372-375). Scope the pool per root, in import and in the login rebuild, or the account with no User_Info shows another account's identity. The real sample has this case (1234567).
- Two keyed-each blocks break on repeated values once accounts are merged (`VehicleTable.svelte` 327 by `row.id`; `BattleTypeSummary.svelte` 162 by `row.code`). The real sample repeats `WOTB_Vehicle_Statistics.csv` in three accounts. Key by index.
- The readers group by (category, file) only. Add the account level so the rebuild equals the import, without a Dexie bump.
- The real sample's `Game_Forums` file has an `EMAIL` column in an unknown category, which is stored raw today. SC4 needs a user decision (Open Question 1).
- The e2e budget has six listed tests of headroom at the guard's measured count (252 of 258). Put the matrix in unit tests against fake IndexedDB.

### File Created
`/Users/you/src/github/wot-gdpr-stats-visualizer/.planning/phases/09-multi-account-import-account-identity/09-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new packages; existing modules confirmed |
| Architecture | HIGH / MEDIUM | Code paths and test inventory verified; resolver wording to be refined by the planner |
| Pitfalls | HIGH / MEDIUM | Most verified in code or the zip; Svelte duplicate-key runtime and scale are assumed |

### Open Questions
1. Email in unknown categories (Game_Forums `EMAIL`) is stored raw: user decision needed before planning.
2. Account record for logins with several accounts.
3. Single identity for the Account card and account row.
4. Years for v1.0 caches (no stored summary).
5. D-21 "nickname exactly once" restatement.
6. Reason name for an arbitrary wrapper (keep the pinned `no-recognized-category`).
7. Game names: one token table, long names only in the identity list.
8. Payments pane caption.
9. Legacy `Sessions.csv` in years.
10. Chat content stored raw (out of scope; recorded).
11. Root-count cap value.

### Ready for Planning
Research complete. The planner can create PLAN.md files. Open Question 1 should be resolved with the user first, because it changes what the stored shape must exclude.
