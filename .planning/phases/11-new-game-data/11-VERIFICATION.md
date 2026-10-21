---
phase: 11-new-game-data
verified: 2026-10-21T17:56:01Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/11-new-game-data/11-01-PLAN.md
  - .planning/phases/11-new-game-data/11-01-SUMMARY.md
  - .planning/phases/11-new-game-data/11-02-PLAN.md
  - .planning/phases/11-new-game-data/11-02-SUMMARY.md
  - .planning/phases/11-new-game-data/11-03-PLAN.md
  - .planning/phases/11-new-game-data/11-03-SUMMARY.md
  - .planning/phases/11-new-game-data/11-04-PLAN.md
  - .planning/phases/11-new-game-data/11-04-SUMMARY.md
  - .planning/phases/11-new-game-data/11-05-PLAN.md
  - .planning/phases/11-new-game-data/11-05-SUMMARY.md
  - .planning/phases/11-new-game-data/11-06-PLAN.md
  - .planning/phases/11-new-game-data/11-06-SUMMARY.md
  - .planning/phases/11-new-game-data/11-07-PLAN.md
  - .planning/phases/11-new-game-data/11-07-SUMMARY.md
  - .planning/phases/11-new-game-data/11-08-PLAN.md
  - .planning/phases/11-new-game-data/11-08-SUMMARY.md
  - .planning/phases/11-new-game-data/11-09-PLAN.md
  - .planning/phases/11-new-game-data/11-09-SUMMARY.md
  - .planning/phases/11-new-game-data/11-10-PLAN.md
  - .planning/phases/11-new-game-data/11-10-SUMMARY.md
  - .planning/phases/11-new-game-data/11-11-PLAN.md
  - .planning/phases/11-new-game-data/11-11-SUMMARY.md
  - src/lib/features/new-data/HeatPane.svelte
  - src/lib/features/new-data/WarshipsStoragePane.svelte
  - src/lib/features/vehicles/PlayerStats.svelte
  - src/lib/shell/Dashboard.svelte
  - src/lib/worker/data-queries.ts
  - src/lib/worker/db.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/worker/new-data-allowlist.ts
  - src/lib/worker/new-data-specs.ts
covered_digest: "v3:sha256:fa4bea7f63d97eb8d43ecf57a27318d035e5a597fa20e8006d959e3110e52b0d"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  previous_verified: 2026-10-19T19:50:00Z
  gaps_closed: []
  gaps_remaining: []
  regressions:
    - "Repository gates on HEAD 40e5ad4 are red: `tsc -b` reports 3 errors and `prettier --check` flags one file, both in tests/unit/account-timeline/phase12-gap-fill.test.ts (added by Phase 12, commit d734a1f). No Phase 11 truth or artifact regressed; the failure sits outside Phase 11 code. See Warnings W1."
    - "tests/e2e/guards/zero-network.spec.ts no longer iterates OPTIONAL_PANE_IDS; Phase 12 (12-13) replaced the loop with an explicit list. Every Phase 11 pane is still covered. See Warnings W2."
  prior_frontmatter_note: "The prior report's frontmatter read status: passed while its body and human_verification list said human_needed. Its five human items are now resolved by 11-UAT.md (5 of 5 pass)."
behavior_unverified_items: []
coincidental_reliance_items: []
deferred: []
advisory: []
---

# Phase 11: New Game Data Verification Report

**Phase Goal:** The user sees the games and records the dashboard used to ignore: HEAT, WoT Console, World of Warplanes account and plane stats, and WoWS crews and storage.
**Verified:** 2026-10-21 (UTC 17:56)
**Status:** passed
**Re-verification:** Yes, after Phase 12 landed on the covered source files (prior report 2026-10-19, commit a81c9e7)
**Tree verified:** branch `gsd/phase-12-account-timeline-perks`, HEAD `40e5ad4`. No product code was edited and no branch was switched.

## Why re-verification ran

The prior report's `covered_digest` no longer matched. Phase 12 changed six of the nine covered source files after a81c9e7: `Dashboard.svelte`, `data-queries.ts`, `db.ts`, `ingest.worker.ts`, `new-data-allowlist.ts` and `new-data-specs.ts`. Each was re-read against its current contents. Phase 12's edits to the allowlist are the ones that could touch a Phase 11 must-have, so they were checked explicitly (see "Phase 12 changes to Phase 11 surfaces" below).

## Gate Runs (executed by the verifier on this tree)

| Gate | Command | Result |
| ---- | ------- | ------ |
| Unit, full suite (supplied by orchestrator, not re-run) | `pnpm exec vitest run` | 135 files, 4149 passed, 9 expected-fail, 0 failed |
| Unit, focused (re-run by verifier) | 23 Phase 11 files: new-data-allowlist, new-data-narrow, new-data-facts, new-data-parity, new-data-three-account, new-data-worker, warplanes-account-worker, playtime-new-games, game-filter-state, game-filter-scope, reveal-state, ui-copy, login-copy, new-data-state, new-data-aggregate, new-data-blocks, new-data-panes, vehicle-blocks, vehicle-state, new-data-headers guard, ci-budget guard, list-pane-optional, selection-state | 23 files, 1013 passed, 0 failed |
| Types | `pnpm run check` | FAILED at `tsc -b`: 3 errors TS2339 (`it.fails.runIf` is not a vitest chain) at `tests/unit/account-timeline/phase12-gap-fill.test.ts` lines 68, 82, 96. `check` stops there, so svelte-check was run on its own: `svelte-check --tsconfig ./tsconfig.app.json --threshold warning` gives 338 files, 0 errors, 0 warnings (exit 0) |
| Lint | `pnpm run lint` | FAILED: `prettier --check .` flags only `tests/unit/account-timeline/phase12-gap-fill.test.ts`. `eslint .` exit 0 |
| E2E, Phase 11 specs | `playwright test tests/e2e/shell/new-data-panes.spec.ts tests/e2e/guards/zero-network.spec.ts tests/e2e/shell/mobile-sweep.spec.ts` | 14 passed (17.0 s), exit 0, 3 local workers. Includes the three new-data-panes tests (HEAT pane; Warships, Warplanes and no-table note; HEAT and WoT Console chips), all five zero-network tests (including Phase 12's stage 13), and six mobile-sweep tests |
| E2E, regression on Phase 11 shell wiring | `playwright test` on dashboard, master-detail-nav, multi-account, playtime-charts, vehicle-stats specs | 101 passed (43.9 s), exit 0 |
| E2E, flake watch | `tests/e2e/shell/chart-fill.spec.ts:122` | Not in either spec set above. Not observed, not run alone |
| Port | `vite preview` on 4173 | Free before the run; Playwright started its own preview on it. No busy-port error |
| Plan artifacts | `query verify.artifacts` on each of the 11 plans | 10 of 11 plans fully pass. Plan 11-11: 2 of 3 pass; `tests/e2e/guards/zero-network.spec.ts` fails pattern `OPTIONAL_PANE_IDS` (see W2) |
| Plan key links | `query verify.key-links` on each of the 11 plans | All links verified in all 11 plans |
| Debt markers | grep `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER`, `console.log` over the 13 covered implementation files | None found. No `{@html}` in `src/lib/features/new-data` or `src/lib/shell` |
| Budget | `tests/unit/guards/ci-budget.test.ts` | Passes on this tree. `playwright test --list` was not re-run |

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | HEAT and WoT Console sessions appear in Playtime and as game-filter choices, and count toward the merged totals | VERIFIED | `GAME_FILTER_TOKENS` is `WOT, WOTB, WOWS, WOTC, HEAT` (`src/lib/shell/game-filter-state.ts:67`). Session specs `heat_game_sessions.csv` and `wotc_game_sessions.csv` are in `src/lib/worker/new-data-specs.ts` (lines 206, 211), keeping the seven session columns. `playtime-new-games.test.ts` passes (per-game scopes through the real worker). `PLAYTIME_VERSION` is `3` (`src/lib/features/playtime/playtime-shared.ts:64`). The e2e chips test passes |
| 2 | The HEAT pane shows battle types, account stats, storage and geolocation; geolocation addresses stay masked until the global reveal | VERIFIED | `HeatPane` is mounted in `Dashboard.svelte` (line 460) on the shell-owned reveal (`revealChoice` and `resolveReveal`, lines 172-178). `data-queries.ts` `case 'heat'` (lines 422-433) feeds `buildHeatView` from four card inputs. Four HEAT specs are present (`heat_account_statistics`, `heat_battle_types_statistics`, `heat_account_storage`, `heat_session_geolocation`). Address cells render only through `displayIp` (`new-data-cell.ts:59`). The e2e HEAT test passes, and the replace-then-re-mask path is covered by the reveal-state unit tests |
| 3 | WOWP 19 and 20 account and plane stats are shown beside the per-vehicle table, and a title absent from an account shows empty, not an error | VERIFIED | `buildWowpAccountBlock` is called only when `title === 'wowp'` (`vehicle-aggregate.ts:1296`). `PlayerStats.svelte` renders `wowpAccount` and its skipped and empty states (lines 548-550, 616). Four `wowp_*` specs exist (`new-data-specs.ts` lines 302, 352, 429, 440). `warplanes-account-worker.test.ts` and `new-data-parity.test.ts` pass. The e2e Warplanes test passes |
| 4 | WoWS crews and account storage are shown, each row traceable to its account | VERIFIED | Specs `wows_crews.csv` (line 280) and `wows_account_storage.csv` (line 293). `WarshipsStoragePane` is mounted at `Dashboard.svelte:469`. `data-queries.ts` `case 'warships-storage'` (lines 434-442). Account tags are asserted per row in the e2e test (`new-data-panes.spec.ts:187`), which passes |
| 5 | Every new category goes through the fail-closed PII strip with a unit test per header, so a planted synthetic email reaches neither IndexedDB nor any rendered pane; folders leave the footer; zero-network covers every new pane; large tables are windowed | VERIFIED (footer clause vacuous, see Notes) | Choke point `ingest.worker.ts` `projectRow(raw, spec)` (line 1243), with the family test (`isNewDataFile` or, from Phase 12, `isFamilyCategory`), per-file `fileMatchesSpec`, and nothing stored for a family file without a spec. Per-header matrix `tests/unit/import/new-data-allowlist.test.ts` (line 1305 onward, one case per spec key, planted canary per file, asserts `db.rows` and `meta` hold no canary) passes. Rendered side: `expectNoCanary` in `new-data-panes.spec.ts` (lines 110-120) checks pane text and markup, and passes. Idempotent narrowing of cached rows: `narrowStoredNewDataRows` (`db.ts`, called `ingest.worker.ts:701`), with `new-data-narrow.test.ts` passing. Zero-network: `zero-network.spec.ts` passes all five tests, including the Phase 11 HEAT and warships-storage stage. Windowing: `NewDataTable` is plain up to 500 rows and windowed above (the e2e windowing assertion passes) |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified).

### Behavior-dependent truths

Reveal reset on replace and clear, idempotent cache narrowing, the remembered Vehicles title and the optional-pane fallback to Overview are state transitions. Each has a unit test that passes on this tree (`reveal-state.test.ts`, `new-data-narrow.test.ts`, `game-filter-state.test.ts`, `selection-state.test.ts`). The replace and re-mask path is also covered by the HEAT e2e test. None is left present-but-unverified.

### Notes

- **Footer clause of criterion 5 (unchanged from prior report).** "Folders that used to sit under 'Not yet supported' now open their own pane and leave that footer" is vacuous for the real export. Every new-game file already lives in a supported folder (`Activity_history`, `Player_statistics`), so no folder is promoted and `unsupportedEntries` is unchanged. This was decided at research time (11-RESEARCH Pattern 8) and is pinned by a test. Read as written, no folder remains stranded. A reader expecting a visible footer change will see none.
- **`heat_device_info.csv` and `heat_surveys.csv` (D-15).** Phase 11 counted both as present with no spec. Phase 12 intentionally gave `heat_surveys.csv` a spec (12-02, D-03; see table below). `heat_device_info.csv` still has no spec, and the guard at `new-data-allowlist.test.ts:511` still asserts it.

## Phase 12 changes to Phase 11 surfaces

Each change was read against the Phase 11 must-have it touches.

| Phase 12 change | File | Still holds for Phase 11? |
| --- | --- | --- |
| Family test gains a CATEGORY half (`FAMILY_CATEGORIES`, `isFamilyCategory`), fail-closed only | `new-data-allowlist.ts`, `ingest.worker.ts` ~1131 | Yes. It widens the family for Phase 12 folders only. The heat_, wotc_, wowp_ and two WoWS names are unchanged. Covered by the family unit tests, which pass |
| New NAME patterns for the three history files, five promoted files | `FAMILY_PATTERNS` | Yes. Anchored on whole names; no Phase 11 name moved |
| `heat_surveys.csv` gets a four-column spec | `new-data-specs.ts:514` | Intentional supersession of the Phase 11 "no spec" wording (D-03). The Phase 11 invariant (named columns only, fail-closed) holds for it |
| `SpecColumnKind` gains `code`; the kind assertion now accepts five kinds | `new-data-specs.ts`, `new-data-allowlist.test.ts:809` | Not a weakening. The assertion still requires id equal to header and a kind from the set |
| Value-level email guard `emailGuard`, set on the nine Phase 12 specs only | `projectRow` | Phase 11 specs are deliberately unset. `phase 11 specs never set the flag` is pinned at `new-data-allowlist.test.ts:708`. Phase 11 relies on the header allowlist, which is what PRIV-01 requires |
| `!family` keeps family files out of the identity pool | `ingest.worker.ts` ~1280 | Phase 11 family files live in HEAT and WoWS and WOWP folders, not `User_Info`, so no effect |
| `OPTIONAL_PANE_IDS` now `heat, warships-storage, perks, account-timeline`; zero-network loop replaced by an explicit list | `selection-state.ts`, `zero-network.spec.ts` | Coverage holds (both Phase 11 panes are in the explicit list). The mechanism drifted; see W2 |
| `db.ts` rebuild path and `narrowStoredNewDataRows` changed | `db.ts` | Yes. `new-data-narrow.test.ts` and `new-data-parity.test.ts` pass |
| `gameFilter` still reaches only Playtime and PlayerStats (Vehicles) | `Dashboard.svelte` lines 399, 425 | Yes, D-07 holds. HeatPane, WarshipsStoragePane, PerksPane and AccountTimelinePane receive no filter |

## Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/worker/new-data-specs.ts` | Spec table for the twelve Phase 11 files | VERIFIED | All twelve Phase 11 keys present; no city, coordinate, postal, ISP or ASN, email, phone or account-id column in the Phase 11 entries |
| `src/lib/worker/new-data-allowlist.ts` | `isNewDataFile`, `specFor`, `projectRow`, `fileMatchesSpec`, `MAX_NEW_DATA_CELL` | VERIFIED | Plan artifact check passes |
| `src/lib/features/new-data/HeatPane.svelte`, `WarshipsStoragePane.svelte` | Substantive panes wired to real worker channels | VERIFIED | Mounted in `Dashboard.svelte`; data from `heat` and `warships-storage` channels |
| `src/lib/features/vehicles/PlayerStats.svelte` | Warplanes account block | VERIFIED | Consumes `wowpAccount` from `vehicle-aggregate.ts` |
| `tests/e2e/shell/new-data-panes.spec.ts` | Three listed tests | VERIFIED | All three pass |
| `tests/e2e/guards/zero-network.spec.ts` | Zero-network extended to every new pane | VERIFIED (mechanism drift, W2) | Passes; the plan's `OPTIONAL_PANE_IDS` pattern no longer appears |
| `tests/fixtures/new-data-fixtures.ts`, `new-data-headers.ts` | Synthetic builders and captured-header constants | VERIFIED | Consumed by the matrix and e2e tests |

## Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `ingest.worker.ts` | `new-data-allowlist.ts` | `projectRow` at the row choke point | WIRED | `ingest.worker.ts:1243` |
| `ingest.worker.ts` | `db.ts` / `new-data-facts.ts` | `narrowStoredNewDataRows`, `newDataPaneFacts` | WIRED | `ingest.worker.ts:701`, `:788`, `:1446` |
| `Dashboard.svelte` | `HeatPane`, `WarshipsStoragePane`, `resolveReveal` | Mount and shared reveal | WIRED | `Dashboard.svelte:460`, `:469`, `:172-178` |
| `data-queries.ts` | `buildHeatView` / `buildWarshipsStorageView` | `case 'heat'`, `case 'warships-storage'` | WIRED | Lines 422-442 |
| `NewDataTable` cells | `displayIp` | Address cells | WIRED | `new-data-cell.ts:59` |
| `vehicle-aggregate.ts` | `PlayerStats.svelte` | `wowpAccount` | WIRED | `vehicle-aggregate.ts:1296`, `PlayerStats.svelte:548-616` |
| `game-filter-state.ts` | `playtime-aggregate.ts` | `GAME_FILTER_TOKENS` as `playtime-query.game` | WIRED | Per-game scopes proved by `playtime-new-games.test.ts` |

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
| -------- | ---- | ------ | ------------------ | ------ |
| `HeatPane.svelte` | Four card inputs | `data-queries.ts` `heat` channel over stored rows | Yes | FLOWING |
| `WarshipsStoragePane.svelte` | Crews and storage rows | `data-queries.ts` `warships-storage` channel | Yes | FLOWING |
| `PlayerStats.svelte` (Warplanes) | `wowpAccount` | `vehicle-aggregate.ts` over stored WOWP rows | Yes | FLOWING |

## Requirements Coverage

Cross-referenced against `.planning/REQUIREMENTS.md`. The traceability table maps exactly GAMES-01 to GAMES-04, PRIV-01 and PRIV-02 to Phase 11. No requirement is orphaned, and each ID appears in at least one plan's `requirements` field.

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| GAMES-01 | 01, 02, 03, 04, 05, 06, 07, 08, 09, 11 | HEAT sessions, battle types, account stats, storage and geolocation are shown | SATISFIED | Truths 1 and 2 |
| GAMES-02 | 01, 06, 11 | WoT Console sessions are shown in activity | SATISFIED | Truth 1 |
| GAMES-03 | 02, 03, 10, 11 | WOWP 19 and 20 account and plane stats are shown | SATISFIED | Truth 3 |
| GAMES-04 | 02, 03, 04, 05, 07, 08, 09, 11 | WoWS crews and account storage are shown | SATISFIED | Truth 4 |
| PRIV-01 | 01 to 11 | Every new category goes through the fail-closed PII strip, with a unit test per header | SATISFIED | Truth 5. Storage half: per-header matrix passes. Rendered half: `expectNoCanary` passes. Value-level email guard is Phase 12 scope and not enabled on Phase 11 specs (see Notes) |
| PRIV-02 | 11 | Zero network after load holds; guard extended to every new pane | SATISFIED, with W2 | Five zero-network tests pass, including the Phase 11 panes and Phase 12's stage 13 |

## Anti-Patterns Found

Scanned the 13 covered implementation files. No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER` or `console.log` markers. No `{@html}` in the new-data or shell trees. No hardcoded-empty stubs in the rendering path: each channel reads stored rows.

## Deferred Items

None. The prior report had no deferred items, and none are identified for this re-verification.

## Advisory (New Scope, Unevidenced)

None. Re-verification ran, and every finding below has deterministic evidence (command output or a file reference), so none is advisory.

## Warnings

- **W1. Repository gates are red on HEAD 40e5ad4 (not a Phase 11 truth).** `tests/unit/account-timeline/phase12-gap-fill.test.ts` (commit d734a1f, Phase 12) has three `it.fails.runIf(...)` calls at lines 68, 82 and 96. That chain does not type-check (TS2339), so `pnpm run check` exits 1. Its `prettier --check` also fails on the same file, so `pnpm run lint` exits 1. CI runs both steps (`.github/workflows/ci.yml` lines 166 and 174) before the e2e step, so CI would fail on this tree. Vitest passes because it does not type-check. Phase 11 product code is clean: `svelte-check` reports 0 errors, and `eslint` passes. **Owner: Phase 12.** Escalating for a decision: the fix is in a test file and must land before this branch ships. Phase 11's status does not depend on it.
- **W2. The zero-network guard no longer iterates the optional-pane tuple.** `tests/e2e/guards/zero-network.spec.ts` loops an explicit `['heat', 'warships-storage']` list (Phase 11 panes), and Phase 12 stage 13 covers `perks` and `account-timeline`. Coverage is complete today. A future optional pane added to `OPTIONAL_PANE_IDS` would not be auto-covered, which is why plan 11-11's `OPTIONAL_PANE_IDS` pattern now fails. Suggested follow-up: derive the list from the tuple and exclude the panes this archive does not hold, so a new pane cannot slip past the guard.
- **W3. CI time budget changed since the human check.** UAT item 5 measured the one-worker run against a 31-minute `globalTimeout`. `playwright.config.ts:250` now sets 32 minutes, and `ci.yml:256` wraps the run in `timeout 34m` (job limit 42 minutes). `tests/unit/guards/ci-budget.test.ts` passes on the current tree. The UAT pass stands as recorded.
- **W4. chart-fill flake not exercised.** `tests/e2e/shell/chart-fill.spec.ts:122` was not in this verification's spec set and was not observed. Not run alone.

## Human Verification

No open items. All five human checks recorded in the prior report are resolved in `11-UAT.md` (status complete, 5 of 5 pass, updated 2026-10-19). Not re-asked.

1. HEAT pane at 375px: pass. Four cards, no sideways scroll, addresses masked until the reveal toggle.
2. Six-chip game filter wraps at 375px: pass. Two lines, no clipped label.
3. Phone list at 375px: pass. With both optional panes the list holds 11 entries including the "Not yet supported" footer row. The prior report's "ten rows" count left out the footer. The 64px-per-row relaxation of the fold check was accepted.
4. 40-character nickname inside an account tag at 375px: pass. Wraps inside the header; no widening.
5. One-worker CI run: pass (reported green by the user). The exact wall time was not recorded. See W3 for the budget change.

## Gaps Summary

No gaps. Every Phase 11 must-have holds on the current tree (5 of 5 truths, 6 of 6 requirement IDs). The allowlist choke point, presence facts, both new panes, the Warplanes block, the shared reveal, the filter chips and the zero-network extension are present, wired to real data, and passing. Phase 12 made intentional changes to the allowlist and the zero-network loop. Each one was checked against the Phase 11 invariant it touches, and none breaks it. Status is `passed`. The warnings above are real and should be decided before the branch ships, especially W1, which turns CI red.

---

_Verified: 2026-10-21 (UTC 17:56)_
_Verifier: Claude (gsd-verifier), re-verification mode_
