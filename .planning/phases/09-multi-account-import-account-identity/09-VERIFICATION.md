---
phase: 09-multi-account-import-account-identity
verified: 2026-10-18T12:10:00Z
status: passed
score: 20/21 must-haves verified
behavior_unverified: 0
overrides_applied: 1
covered_files:
  - .planning/phases/09-multi-account-import-account-identity/09-01-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-01-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-02-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-02-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-03-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-03-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-04-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-04-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-05-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-05-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-06-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-06-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-07-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-07-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-08-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-08-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-09-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-09-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-10-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-10-SUMMARY.md
  - .planning/phases/09-multi-account-import-account-identity/09-11-PLAN.md
  - .planning/phases/09-multi-account-import-account-identity/09-11-SUMMARY.md
  - src/lib/core/types/worker-messages.ts
  - src/lib/shell/IdentityHeader.svelte
  - src/lib/shell/identity-model.ts
  - src/lib/shell/overview-model.ts
  - src/lib/shell/selection-state.ts
  - src/lib/ui-copy.ts
  - src/lib/worker/account-summary.ts
  - src/lib/worker/classify.ts
  - src/lib/worker/csv-columns.ts
  - src/lib/worker/data-queries.ts
  - src/lib/worker/db.ts
  - src/lib/worker/ingest.worker.ts
  - tests/e2e/guards/zero-network.spec.ts
  - tests/e2e/import/import-failure.spec.ts
  - tests/e2e/shell/multi-account.spec.ts
  - tests/fixtures/multi-account-fixtures.ts
  - tests/unit/import/multi-account-import.test.ts
  - tests/unit/shell/identity-model.test.ts
  - tests/unit/shell/overview-model.test.ts
  - tests/unit/shell/ui-copy.test.ts
covered_digest: "v3:sha256:70b0fc8f14725422223942b340590b99a44291433c54ff1275ed6edf3814a727"
re_verification:
  previous_status: gaps_found
  previous_score: 18/21
  gaps_closed:
    - "Truth 21 / UI review fix 1 - the header variant, the Account list row and the Overview Account card now key on the ARCHIVE's folder count (ClassifyResult.rootCount read through rootCountOf / hasMultipleRoots), not the published list. A two-folder archive with one data-less folder renders data-variant=multi titled '1 account', never the first account's REGION/CREATED_AT. Proven in the browser fresh and after reload, and proven to have teeth (reverting the header derivation turns the e2e step red on data-variant=loaded)."
    - "UI review fix 2 - 09-UI-SPEC.md amended in 11 spots tagged 'plan 09-11' (Surface 1, 2, 3, Copywriting Contract incl. singular/zero rows and 'Which roots each count describes' table + 5-row matrix, UI Considerations); the stale 'no account count of zero is reachable' sentence is gone."
    - "Previously closed and re-checked for regression: CR-01 (per-account row groups), WR-01..03, IN-01/04/06, UI review fixes 2 and 3 of the earlier round."
  gaps_remaining: []
  regressions: []
gaps: []
deferred:
  - truth: "Per-account slicing of the merged panes, merging vehicles by id rather than by row, finance totals per currency"
    addressed_in: "Phase 10"
    evidence: "Roadmap Phase 10 goal: 'Playtime, finance, vehicles and login history read as one combined history, with a game filter, no double-counting and a source account on every row' (ACCOUNT-04 / ACCOUNT-06 / ACCOUNT-07); D-11 preserved"
overrides:
  - truth: "375px multi-account header readability (Truth 19, verification: backstop)"
    reason: "Waived by the user on 2026-10-18; e2e proves no overflow and full text present, visual readability not human-checked"
human_verification:
  - test: "Open the three-account fixture in a browser at 375px width and read the multi-account header with a 40-character nickname and a 20-digit account ID"
    expected: "The row wraps inside the list pane, the full nickname and the full ID are legible, and nothing is truncated or scrolled off"
    why_human: "Declared verification: backstop in 09-06; the e2e proves no horizontal overflow and that the full text is present, but readability of the real layout needs a human eye"
---

# Phase 9: Multi-account Import & Account Identity - Verification Report

**Phase Goal:** A user can drop a real export that contains several account-ID folders and see it imported, cached and identified account by account, instead of getting the generic failure banner.
**Verified:** 2026-10-18T12:10:00Z
**Status:** passed (375px readability waived by user)
**Re-verification:** Yes - after gap closure plan 09-11 (commits 1a6a433..fa0ad52)

## Goal Achievement

The goal is achieved and the one open gap from the previous report (Truth 21) is genuinely closed in code, not just in the SUMMARY. The only item left is the pre-existing `verification: backstop` readability check for the 375px header, which cannot be settled by an automated check; it routes to a human, not to a gap.

### How Truth 21 was closed (read from the code, not the SUMMARY)

- `ClassifyResult.rootCount?: number` added (`worker-messages.ts`), documented as the folders the archive held including data-less ones, never persisted.
- Two producers, no more: `ingest.worker.ts` `finalResult` sets `rootCount: ordered.length` and `resultFromMeta` binds `accountsOfMeta(meta)` once and uses that one local for both `accounts` and `rootCount: storedAccounts.length`. `done`, `duplicate` and `cache-status` (all via `resultFromMeta` on replay) therefore agree by construction.
- `identity-model.ts`: `rootCountOf` = max(1, rootCount, published length) with null -> 0; `hasMultipleRoots` = `rootCountOf >= 2`; `accountCountOf` keeps meaning "accounts holding data" and returns 0 (not 1) for an empty list on a multi-folder archive; `isMultiAccount` is deleted (`grep -rn isMultiAccount src tests` -> 0 hits).
- `IdentityHeader.svelte:75` variant switch is `hasMultipleRoots(result)`; the component no longer references `accountCountOf`. Branch order (`skeleton`, `multi`, `fallback|loaded`) unchanged.
- `selection-state.ts` (Account list row) and `overview-model.ts` (Overview card) decide multi wording with `hasMultipleRoots` and count with `accountCountOf`; `formatAccountCount` has a singular branch ('1 account'), zero stays plural.
- All remaining readers of the legacy first-folder `identity` (`IdentityHeader.svelte:77,84`, `selection-state.ts:217`, `overview-model.ts:119`) are on the single-folder path only, behind the root-count predicate. No other pane reads it.

### Observable Truths

| #   | Truth | Status | Evidence |
|-----|-------|--------|----------|
| 1 | Real-shape three-account zip imports without the banner; header lists every account (SC1, ACCOUNT-01/05) | VERIFIED | e2e `multi-account.spec.ts` (a) passed this session (8.4 s) |
| 2 | The no-User_Info account appears, identified by ID only (D-13/17) | VERIFIED | unchanged since previous pass; unit + e2e (a) green |
| 3 | Accept matrix 1..32 roots, wrapper descent, loose files ignored | VERIFIED | classify tests in the 3156-test unit run |
| 4 | Reject matrix: stray folder, ambiguous root, case collisions, unknown wrapper | VERIFIED | `import-failure.spec.ts` passed (15 passed with zero-network) |
| 5 | Bounds fail closed: >32 roots, name >128 chars | VERIFIED | green in unit run |
| 6 | Every CSV entry resolves to exactly one owning root | VERIFIED | green in unit run |
| 7 | Each account is classified and parsed on its own | VERIFIED | lifecycle + e2e (b) green |
| 8 | Rows carry `account`; Dexie stays at version 2; no new dependency; `src/lib/import` untouched | VERIFIED | `grep -c "\.version(" db.ts` -> 1; `git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml src/lib/import` exit 0; `db.ts`/`account-summary.ts` byte-identical to pre-09-11 |
| 9 | Unsupported/deferred rows counted, never stored; D-18 strip | VERIFIED | privacy describe green |
| 10 | Identity is per root, never a sibling's | VERIFIED | green |
| 11 | `meta.accounts` in D-16 order; `done`/`duplicate`/`cache-status` replay through one normaliser | VERIFIED | now additionally pinned for `rootCount` in `multi-account-import.test.ts` (done, check-cache, duplicate) |
| 12 | Account record built only for a one-ROOT dataset (T-09-32) | VERIFIED | `ingest.worker.ts:1209` `ordered.length === 1 ? ordered[0]! : null` untouched; the 09-10 case asserting no account record for a two-root-one-data-less archive is in the green suite |
| 13 | Lifecycle: reload, duplicate, replace, clear, start over | VERIFIED | e2e (b) passed this session (6.8 s) |
| 14 | v1.0 export unchanged; v1.0 cache not wiped; purge | VERIFIED | green; no result-without-`rootCount` path regressed (fallback to published count asserted in `identity-model.test.ts`) |
| 15 | Synthetic 1/2/3-root fixtures; flows pass; zero-network holds | VERIFIED | `playwright test --list` -> `Total: 258 tests in 28 files`; zero-network spec passed |
| 16 | Account row / Overview card / "N accounts combined" caption only where D-11 says | VERIFIED | `Dashboard.svelte` and `DashboardSection.svelte` byte-identical to pre-09-11; captions still use `accountCountOf` (published count) at `Dashboard.svelte:219` |
| 17 | Merging accounts' rows of one file changes no parse (CR-01) | VERIFIED | `db.ts`, `data-queries.ts`, `csv-columns.ts` untouched since the previous pass that proved teeth; device-info worker tracer green in unit run |
| 18 | A vehicle row from an account with a different header carries its own name and numbers | VERIFIED | unchanged; green |
| 19 | The 375px multi-account header keeps a 40-char nickname and 20-digit ID readable (`verification: backstop`) | ? UNCERTAIN | geometry assertions pass in e2e (a); readability needs a human eye |
| 20 | Account count, published list and every pane caption are one number (09-10 option-a) | VERIFIED | `accountSummariesOf` untouched; `accountCountOf` still non-empty-list length; e2e step asserts `combined-caption` count 0 on all six panes for the one-of-two archive |
| 21 | No account is presented as the export when the archive holds more than one root - the header variant follows the ROOT count | VERIFIED | see below |

**Truth 21 evidence.** (1) Code path above. (2) Unit: `multi-account-import.test.ts` imports `buildOneDataLessOfTwoExport()` through the real worker and asserts `rootCount === 2`, `accountsOf(result).length === 1`, `accountCountOf === 1`, `hasMultipleRoots === true`, with the control `identity.region === MA_REGION_EU` (so the case is not vacuous); plus `check-cache` and `duplicate` replays carrying the same `rootCount`; `buildDataLessAccountExport` -> 3 vs 2; three-account -> 3; one-account -> 1 and false. (3) Browser: a step inside the existing lifecycle test (no new `test(...)`; `grep -c "^  test("` -> 2) imports the same archive and asserts, fresh and after `page.reload()`, `data-variant=multi`, no `identity-nickname`/`region`/`created` nodes, title `1 account`, exactly one row, Account row headline `1 account` + `ACCOUNT_ROW_MULTI_SUMMARY`, Overview card `1 account` with the earliest-created summary and no `MA_REGION_EU`, and no combined caption on any captioned pane. Passed this session. (4) **Teeth:** I temporarily changed the header derivation to the published-list test (`(result.accounts?.length ?? 1) >= 2`) and re-ran the lifecycle test: it failed with `Expected: "multi" / Received: "loaded"` on "one of two, fresh import". I restored the file with `git checkout` and `git diff --exit-code -- src` is clean.

**Score:** 20/21 truths verified (0 failed, 1 backstop-uncertain routed to human)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Per-account slicing of merged panes, vehicles merged by id, finance totals per currency | Phase 10 | Roadmap Phase 10 goal (ACCOUNT-04 / ACCOUNT-06 / ACCOUNT-07) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/core/types/worker-messages.ts` | `rootCount?: number` | VERIFIED | one declaration, doc says derived and never persisted |
| `src/lib/shell/identity-model.ts` | `rootCountOf`, `hasMultipleRoots`, `accountCountOf` re-scoped | VERIFIED | previously PARTIAL; now substantive and wired |
| `src/lib/shell/IdentityHeader.svelte` | variant keyed on root count | VERIFIED | line 75 |
| `src/lib/shell/selection-state.ts`, `overview-model.ts` | same predicate | VERIFIED | 2 hits each |
| `src/lib/ui-copy.ts` | singular `formatAccountCount` | VERIFIED | `count === 1 ? '1 account' : ...` |
| `src/lib/worker/ingest.worker.ts` | `rootCount` from both producers, gate untouched | VERIFIED | one pair of sites; gate at :1209 unchanged |
| `tests/e2e/shell/multi-account.spec.ts` | step in lifecycle test | VERIFIED | passed, and red under reverted derivation |
| `09-UI-SPEC.md` | dated amendment | VERIFIED | 11 `plan 09-11` tags; "Which roots each count describes" table + matrix present; stale zero-unreachable sentence absent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ingest.worker.ts` | `worker-messages.ts` | `rootCount` on `done` and `resultFromMeta` | WIRED | same stored list as the account projection |
| `identity-model.ts` | `IdentityHeader.svelte` | `hasMultipleRoots(result)` | WIRED | |
| `identity-model.ts` | `selection-state.ts` | Account row | WIRED | |
| `identity-model.ts` | `overview-model.ts` | Account card | WIRED | |
| `multi-account-fixtures.ts` | `multi-account.spec.ts` | `buildOneDataLessOfTwoExport` | WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Header variant | `rootCount` | `ordered.length` / `accountsOfMeta(meta).length` from the stored list | Yes | FLOWING |
| Single-account REGION/CREATED_AT | `result.identity` | first root's identity, now read only when `hasMultipleRoots` is false | Yes | FLOWING (was MISATTRIBUTED) |
| Title / rows / captions | `accounts` | `accountSummariesOf` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type + Svelte check | `pnpm run check` | 313 files, 0 errors, 0 warnings | PASS |
| Lint + format | `pnpm run lint` | exit 0 | PASS |
| Full unit suite | `pnpm run test:unit` | 96 files / 3156 tests passed | PASS |
| Multi-account e2e | `playwright test tests/e2e/shell/multi-account.spec.ts` | 2 passed (16.6 s) | PASS |
| Banner + zero-network | `playwright test import-failure.spec.ts zero-network.spec.ts` | 15 passed | PASS |
| e2e budget | `playwright test --list` | Total: 258 tests in 28 files | PASS |
| Budget + Dexie guards | `vitest run ci-budget.test.ts db.test.ts` | 45 passed | PASS |
| Teeth (reverted header derivation) | edit line 75 to published-list test, run lifecycle test | failed: Expected "multi", Received "loaded"; tree restored, `git diff --exit-code -- src` clean | PASS (fix proven effective) |
| No dependency / import-module change | `git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml src/lib/import` | exit 0 | PASS |
| Untouched by design | diff 1a6a433..HEAD of `Dashboard.svelte`, `DashboardSection.svelte`, `selection-state.test.ts`, `db.ts`, `account-summary.ts` | no diff | PASS |
| Probes | none declared by this phase | n/a | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ACCOUNT-01 | 09-01, 03, 06, 07 | Several account-ID folders import without the banner | SATISFIED | e2e (a)/(b); reject shapes still banner |
| ACCOUNT-02 | 09-01, 02, 06, 07, 09 | Each folder classified/parsed independently | SATISFIED | per-root state; CR-01 closed and unchanged |
| ACCOUNT-03 | 09-01..04, 06, 09, 10, 11 | One cached dataset, replace-on-upload, dedupe | SATISFIED | lifecycle + e2e (b); no Dexie version/field change in 09-11; `rootCount` derived at publish time so an older cache replays with a correct value |
| ACCOUNT-05 | 09-02, 05, 06, 10, 11 | Header lists every account with ID, games, years | SATISFIED | previously "satisfied with a gap"; the surrounding presentation gap is closed |
| ACCOUNT-08 | 09-01..03, 06, 07, 10, 11 | Clear/Start Over wipe all; 1/2/3-root fixtures | SATISFIED | 258-test budget unmoved across all gap-closure plans |
| ACCOUNT-04 / 06 / 07 | none | Merged dashboard, game filter, merged logins | n/a - Phase 10 | no orphaned Phase-9 requirement |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 09-11 diff | - | `TBD`/`FIXME`/`XXX`/`TODO` in added lines | none found | - |
| `src/lib/shell/overview-model.ts` | ~107 | one docblock line is over-long after the 09-11 edit | Info | prettier/eslint pass; cosmetic |
| `src/lib/shell/identity-model.ts` | 72-91 | previous Blocker (published list decides variant) | resolved | - |

### Human Verification Required

1. **375px multi-account header readability**
   **Test:** Open the three-account fixture at 375px width; read the row with the 40-character nickname and the 20-digit account ID.
   **Expected:** The row wraps inside the list pane; the full nickname and ID are legible, nothing truncated or scrolled off.
   **Why human:** Plan 09-06 declares this truth `verification: backstop`. The e2e measures scroll width, row right edges and untruncated text and passes; readability is a human call.

(The second human item from the previous report - corroborating the Truth 21 gap in a browser - is retired: the browser step now proves the fixed behavior automatically, with teeth.)

### Gaps Summary

None. Truth 21 and both UI-review findings it carried are closed in the code, in the unit and e2e suites, and in the UI-SPEC. No regression found across check, lint, 3156 unit tests, the multi-account/failure/zero-network e2e specs, the 258-test budget, or the Dexie/dependency/main-thread-import invariants. The phase goal is achieved; only the single backstop readability check awaits a human.

---

_Verified: 2026-10-18T12:10:00Z_
_Verifier: Claude (gsd-verifier)_
