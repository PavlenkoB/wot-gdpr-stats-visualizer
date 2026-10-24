---
phase: 13-overview-personal-insights
fixed_at: 2026-10-24T00:50:00Z
review_path: .planning/phases/13-overview-personal-insights/13-REVIEW.md
iteration: 2
findings_in_scope: 13
fixed: 11
skipped: 2
status: partial
---

# Phase 13: Code Review Fix Report

This report is cumulative. The frontmatter counts cover iteration 1 (WR-01 .. WR-06: 5 fixed, 1 skipped) plus iteration 2 (IN-01 .. IN-07: 6 fixed, 1 skipped). Iteration 1 is kept unchanged below; iteration 2 is the last section.

**Fixed at:** 2026-10-24T00:40:00Z
**Source review:** .planning/phases/13-overview-personal-insights/13-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01 .. WR-06; no Critical findings; Info findings out of scope)
- Fixed: 5
- Skipped: 1 (WR-02, by instruction)

**Verification environment:** all gates ran in the MAIN checkout (`workflow.use_worktrees` is `false`, so no worktree was created). The numbers are reproducible from the working tree.

**Gates:**
- `pnpm run check`: 0 errors, 0 warnings.
- `pnpm run lint`: green (prettier and eslint).
- `pnpm run test:unit`: 4761 passed, 9 expected fail, 1 failed (4771). The one failure is pre-existing and unrelated (see below).
- `pnpm exec playwright test tests/e2e/shell/overview-insights.spec.ts tests/e2e/shell/overview-insights-gaps.spec.ts`: 8 passed.
- Expected-fail count dropped from 12 to 9 in the unit suite. WR-03, WR-05 and WR-06 are now ordinary tests. The remaining 9 are Phase 12's gap-fill markers. The WR-01 `test.fail()` was in the e2e suite and is removed, so the e2e listed-test count is unchanged (no e2e test added).

**Pre-existing failure, not caused by these fixes:** `tests/unit/guards/no-real-data.test.ts` ("no absolute home-directory path other than /Users/you") fails because the committed `.planning/phases/13-overview-personal-insights/13-UI-REVIEW.md` line 80 contains an absolute home-directory path. It fails identically with all fixes stashed. It was introduced by the last commit before this run (`1d0490b docs(13): UI audit review`). It needs a one-line edit to that doc, which is outside this fix scope.

## Fixed Issues

### WR-01: Pin toggle reads stale `pins` while a view transition is pending

**Files modified:** `src/lib/features/overview/OverviewBento.svelte`, `tests/e2e/shell/overview-insights-gaps.spec.ts`
**Commit:** 7a3afc0
**Applied fix:** `togglePinFor` now derives `next = togglePin(pins, id)` inside the `runTransition` update closure, from the latest `pins`, then assigns it, calls `writePins(next)` and announces from that same value. `runTransition` runs the update at most once, so the 600 ms fallback still commits at most once (T-13-29 holds) and the pin store keeps exactly one `writePins` call site. Removed `test.fail()` from the `(gap WR-01)` e2e test with its assertions unchanged. It now passes as a regression test. Status: fixed, requires human verification (logic change in a timing-sensitive handler; the pinned deterministic e2e test passes).

### WR-03: Win rate and "In battle" computed over mismatched account subsets

**Files modified:** `src/lib/features/overview/overview-totals.ts`, `src/lib/features/overview/overview-aggregate.ts`, `tests/unit/overview/phase13-review-findings.test.ts`
**Commit:** 3de2e2b
**Applied fix:** The win rate is now computed only over rows where both battles and wins are non-null, and the 30-battle guard applies to those battles, not to the all-account total. The lifetime battle and win COUNTS stay sums over every readable cell (the pinned test asserts battles 1000). For "In battle" (`battleSecondsOf`), the account-statistics total is used only when EVERY account row carries a readable `battleSeconds`. Otherwise it falls back to the per-vehicle sum, which covers every account. If that is absent too, the figure is absent rather than a partial total under the lifetime label. Removed `it.fails` from the WR-03 test, assertions unchanged; it passes. Status: fixed, requires human verification (the "In battle" rule is my reading of the reviewer's "both values" guidance for a single-valued figure; no pinned test covers a partially readable `battleSeconds` column, and none was added).

### WR-04: "best of N accounts" counted every account folder

**Files modified:** `src/lib/features/overview/overview-shared.ts`, `src/lib/features/overview/overview-records.ts`, `src/lib/features/overview/overview-format.ts`, `src/lib/features/overview/OverviewBento.svelte`, `src/lib/ui-copy.ts` (doc comment only), `tests/unit/import/data-query-worker.test.ts`, `tests/unit/overview/overview-records.test.ts`, `tests/unit/overview/overview-format.test.ts`, `tests/unit/overview/overview-layout.test.ts`
**Commit:** 2933b05
**Applied fix:** The `dmg`, `xp` and `kills` ready tiles now carry `accounts: number`, the count of account rows that held a figure for that record. `formatRecordRule` receives `tile.accounts` instead of the folder count. `TileFaceContext.accountCount` had no other reader, so it is removed and `tileFace`'s context is optional.

**Deliberate wire-vocabulary change:** this adds one key, `accounts` (a count, never text), to the overview reply. The closed-vocabulary literal `OVERVIEW_KEY_VOCABULARY` in `tests/unit/import/data-query-worker.test.ts` was extended on purpose, with a comment. No nickname, e-mail, clan, chat or order amount can ride on it.

**New regression tests** (in `tests/unit/overview/overview-records.test.ts`, new `describe` "how many accounts a record was chosen from (WR-04)"): both accounts with a figure count 2; a record held by one of two accounts (the other's cell is `\N`) reports 1; a dataset of two folders where only one has a statistics file reports 1 while `view.accountCount` stays 2. Existing "best of 2 accounts" assertions are unchanged (the format test's `faceOf` helper now overrides the tile's `accounts`).

### WR-05: Credits pick matched "wot" as a substring

**Files modified:** `src/lib/features/overview/overview-totals.ts`, `tests/unit/overview/phase13-review-findings.test.ts`
**Commit:** f072001
**Applied fix:** Added `isWotCode`, which matches a dot-delimited segment equal to `wot` (case-insensitive), so `ru.wotblitz.credits` no longer joins the World of Tanks pool. The doc comment now states the decision that several WoT credits codes show the dominant one (most operations), not their sum, because the tile mirrors the Finance pane's per-code figure. Removed `it.fails` from the WR-05 test, assertions unchanged; it passes.

### WR-06: Generator trusted the API's `page_total`

**Files modified:** `scripts/vehicles/build-vehicle-table.ts`, `tests/unit/overview/phase13-review-findings.test.ts`
**Commit:** 969b6f3
**Applied fix:** Added `MAX_PAGES = ceil(MAX_ROWS / PAGE_LIMIT) + 1` (with `MAX_ROWS` imported from the lib). `fetchPages` throws as soon as a response claims more than `MAX_PAGES`, so no further key-bearing request is made. Removed `it.fails` from the WR-06 test, assertions unchanged; it passes (the hostile stub now gets one request). Also refreshed the stale "marked it.fails / open findings" header text in that test file. Not applied: the review's optional `if (!response.ok)` check before `response.json()`. The pinned test's fetch stub returns an object with no `ok` property, so the check would make the test pass for the wrong reason (an immediate throw on request one) and was left out.

## Skipped Issues

### WR-02: Unpinning every tile is not persisted; the default pins come back on reload

**File:** `src/lib/features/overview/overview-pins.ts:107-112, 159-160` (written from `OverviewBento.svelte`)
**Reason:** skipped by instruction. The reviewer's fix reverses a rule the approved 13-UI-SPEC states ("if nothing valid remains, the defaults apply"). Plan 13-06's SUMMARY records that behaviour as a deliberate decision, with tests asserting it (`overview-pins.test.ts`, the two expectations at lines 126-130 and 187). Reversing an approved design rule is a user decision, not a code fix. `overview-pins.ts` parsing and those two test expectations were not touched. The alternative the reviewer offered (disallow unpinning the last pin in the UI) is also a design change and was not made.
**Original issue:** The user can unpin the last pin, which stores `"[]"`. On the next load `parsePins([])` returns `null`, so `readPins` falls back to `DEFAULT_PINS` and the explicit choice of "no pins" silently reverts.

---

_Iteration 1 fixed: 2026-10-24T00:40:00Z_
_Fixer: Claude (gsd-code-fixer)_

---

# Iteration 2: Info findings (fix_scope: all)

**Fixed at:** 2026-10-24T00:50:00Z
**Iteration:** 2

**Summary:**
- Findings in scope: 7 (IN-01 .. IN-07; WR-01, WR-03 .. WR-06 already fixed, WR-02 left skipped on purpose)
- Fixed: 6
- Skipped: 1 (IN-05)

**Verification environment:** all gates ran in the MAIN checkout (`workflow.use_worktrees` is `false`, so no worktree was created). Reproducible from the working tree.

**Gates (final tree):**
- `pnpm run check`: 0 errors, 0 warnings.
- `pnpm run lint`: green (prettier and eslint).
- `pnpm run test:unit`: 4770 passed, 9 expected fail (all Phase 12 markers), 0 failed. The no-real-data guard failure noted in iteration 1 is gone now that the UI review doc uses a repo-relative path.
- `pnpm run vehicles:table:check`: exit 0, count=1035.
- `pnpm run build`: built.
- `pnpm exec playwright test tests/e2e/shell/overview-insights.spec.ts tests/e2e/shell/overview-insights-gaps.spec.ts`: 8 passed. `playwright test --list` still reports exactly 273 tests in 33 files (no e2e test added or removed; two assertions were added inside the existing "(privacy and states)" test).

## Fixed Issues

### IN-01: Production-dead `formatLoggedDays` / `formatLoggedHours`

**Files modified:** `src/lib/ui-copy.ts`, `tests/e2e/shell/overview-insights.spec.ts`
**Commit:** 3dfba5e
**Applied fix:** Deleted both functions from `ui-copy.ts`. The e2e spec now imports `formatDays` and `formatHours` from `overview-format.ts` and passes `'en-US'` explicitly (the spec runs in Node under the machine's locale while the browser is pinned to en-US), the same way it already calls `formatDay`. The spec still imports `ui-copy`, so the pin-locale tracer stays satisfied.

### IN-02: English hard-coded in `overview-format.ts`

**Files modified:** `src/lib/ui-copy.ts`, `src/lib/features/overview/overview-format.ts`, `tests/unit/overview/overview-copy.test.ts`
**Commit:** edc01f6
**Applied fix:** Mechanical move, output unchanged. New in `ui-copy.ts`: `OVERVIEW_CREDITS_MILLION`, `OVERVIEW_CREDITS_BILLION`, `formatYearPeakLabel`, `formatYearsChartSummary` (owns the 1 year / N years plural), `formatHourChartSummary`, `formatTanksChartSummary`, `formatClassesChartSummary`. `overview-format.ts` now calls them and holds no English prose of its own. Tests: the new strings are fed into the D-17 banned-measurement copy guard, and a new `describe` pins each exact output, including the plural. No existing test needed changing.

### IN-03: Stale or misplaced comments

**Files modified:** `src/lib/ui-copy.ts`, `src/lib/features/overview/overview-lookup.ts`
**Commit:** 61950a9
**Applied fix:** The attribution constant's comment now says the wording is APPROVED (confirmed as written in 13-15). The "Build a lookup over a table" JSDoc was moved from above `MAX_TIER` to directly above `createVehicleLookup`. Comment-only change, so no test.

### IN-04: Error screen left every skeleton grid `aria-busy`

**Files modified:** `src/lib/features/overview/OverviewBento.svelte`, `tests/e2e/shell/overview-insights.spec.ts`
**Commit:** a6ed318
**Applied fix:** `busy={screen === 'loading'}`. Two assertions added inside the existing "(privacy and states)" e2e test: while loading at least one `.groups [aria-busy="true"]` exists, and in the failed-ask state none does.

### IN-06: `readApplicationId` looser than dotenv

**Files modified:** `scripts/vehicles/lib/vehicle-table-build.ts`, `tests/unit/overview/vehicle-table.test.ts`
**Commit:** e745b8d
**Applied fix:** The LAST `WG_APPLICATION_ID` assignment now wins (an optional `export ` prefix is accepted, as dotenv does). A quoted value runs to its closing quote and anything after it is dropped. An unquoted value ends at the first `#`, so `KEY=abc # note` gives `abc` and `KEY=# note` gives null. The function still only returns the value and logs nothing. Tests added for the inline comment (quoted and unquoted) and for last-assignment-wins with a commented line in between. The existing cases are unchanged and green. Status: fixed, requires human verification (parser semantics; dotenv equivalence was matched from its documented grammar, not run against the dotenv package).

### IN-07: Name validator accepted bidi, zero-width and C1 characters

**Files modified:** `scripts/vehicles/lib/vehicle-table-build.ts`, `tests/unit/overview/vehicle-table.test.ts`
**Commit:** d06deca
**Applied fix:** `forbiddenNameCharacter` (used by both `rowFromEntry` and `validateRows`) now also rejects U+007F to U+009F, U+200B to U+200F, U+2028 to U+202E, U+2066 to U+2069 and U+FEFF, by numeric comparison. Both error messages keep the words "control character" and "angle bracket" so the existing assertions hold, and add "invisible or direction-changing character". Before changing the rule I scanned the committed table: none of its 1035 rows contains any of these characters, so `vehicle-table.generated.ts` was not touched. `pnpm run vehicles:table:check` exits 0 with count=1035 and the committed-table test cases are green and unweakened. Tests added: each class of character is refused on the API path, an accented/dash name is still accepted, and `validateRows` refuses the same characters.

## Skipped Issues

### IN-05: A record's tank reads "vehicle not recorded" even when the export recorded it

**File:** `src/lib/features/overview/overview-records.ts:149`, `src/lib/ui-copy.ts:3826`
**Reason:** skipped by the instruction's own condition. Telling "cell is 0 or \N" apart from "id recorded but absent from the built-in table" needs the tile to carry a second fact (an unresolved-tank flag or the id). `tankName` is the only tank field on the `dmg`, `xp` and `kills` tiles that crosses the wire, so the distinction cannot be encoded without a new key in the overview reply. That changes the closed vocabulary pinned in `tests/unit/import/data-query-worker.test.ts`, which is a privacy-review decision, not a code fix. A wording-only change ("tank unknown") was also not made: the current string comes from the approved D-09 copy, and re-wording it is a copy decision. Nothing was edited for this finding.
**Original issue:** `tankName` is null both when the cell is `0` or `\N` and when the id is valid but absent from the built-in table (for example a retired tank); the second case reads "vehicle not recorded", which contradicts the user's own file.

---

_Fixed: 2026-10-24T00:50:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
