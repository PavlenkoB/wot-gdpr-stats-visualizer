---
phase: 11-new-game-data
verified: 2026-10-19T19:50:00Z
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
covered_digest: "v3:sha256:e84ea2258aa00c9e03e6f18f58eefbd65d7e8d78547da315407425aa68bbe582"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the HEAT pane at 375px in a real browser and read the four cards (Account statistics, Battle types, Storage, Geolocation) by eye"
    expected: "Nothing relies on colour alone, nothing overflows sideways, no IP address is visible until the reveal toggle is pressed, and the toggle re-masks it"
    why_human: "Visual layout and readability at phone width; the measurable half (document scrollWidth never exceeds the viewport, masked until reveal) is asserted by e2e, the visual reading is not"
  - test: "At 375px read the six-chip game filter (All games, WoT, WoT Blitz, Warships, WoT Console, HEAT) on the three-account new-games export"
    expected: "Chips wrap onto exactly two lines of at least 44px each with no sideways scroll and no clipped label"
    why_human: "Wrap aesthetics; e2e asserts two lines and 44px, not that the result reads well"
  - test: "At 375px read the phone list screen with ten rows (Overview, Playtime, Login history, Vehicles, HEAT, Warships crews and storage, Finance, Payments, Device info, Account, Not yet supported footer)"
    expected: "The list is usable and the header ends above the fold; the list may end up to 64px per optional row below the fold (11-11 deviation 3 weakened mobile-sweep.spec.ts for exports holding the optional rows)"
    why_human: "The automated fold check was deliberately loosened by exactly the optional rows' height, so only a human read confirms the phone list is acceptable"
  - test: "Read a 40-character nickname inside an account-tag phrase at 375px"
    expected: "The visually hidden phrase and any long cell value cannot widen or visibly break the page"
    why_human: "Visual reading; the measurable half is asserted in e2e"
  - test: "Run the full e2e suite on CI at one worker (CI=1) once and compare wall time with the 31 minute globalTimeout (33 minute wrapper, 41 minute job)"
    expected: "Wall time comfortably under 31 minutes for 263 listed tests"
    why_human: "Only a CI-runner measurement can settle this. The local 12-core run (about 1.4 minutes) and the 8-test subset I ran (16 s, 2 workers) are not CI evidence. The ci-budget guard (a unit test, green) checks arithmetic against the listed count, not measured time"
---

# Phase 11: New Game Data Verification Report

**Phase Goal:** The user sees the games and records the dashboard used to ignore: HEAT, WoT Console, World of Warplanes account and plane stats, and WoWS crews and storage.
**Verified:** 2026-10-19
**Status:** human_needed (all automated checks pass; five visual and CI-timing items remain)
**Re-verification:** No, initial verification

## Gate Runs (executed by the verifier, not read from SUMMARYs)

| Gate | Command | Result |
| ---- | ------- | ------ |
| Unit | `pnpm run test:unit` | 116 files, 3714 tests passed, exit 0 |
| Types | `pnpm run check` | `tsc -b` plus svelte-check: 328 files, 0 errors, 0 warnings, exit 0 |
| Lint | `pnpm run lint` | prettier clean, eslint clean, exit 0 |
| E2E subset | `playwright test tests/e2e/shell/new-data-panes.spec.ts tests/e2e/guards/zero-network.spec.ts` | 8 of 8 passed (16 s); includes the 3 new listed tests and the extended zero-network test |
| Budget | `playwright test --list` | 263 tests in 30 files, below the 264 ceiling of the 31 / 33 / 41 min limits (`playwright.config.ts` `globalTimeout: 31 * 60 * 1000`, `ci.yml` `timeout-minutes: 41`) |

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | HEAT and WOTC sessions appear in Playtime and as game-filter choices, and count toward the merged totals | VERIFIED | `heat_game_sessions.csv` and `wotc_game_sessions.csv` specs exist in `new-data-specs.ts` (session vocabulary the aggregators read); `GAME_FILTER_TOKENS` extended; `playtime-new-games.test.ts` proves per-game scopes with hand-derived literals through the real worker (passes in the 3714); e2e chips test passes (order, narrowing to `MA_EXPECTED_PLAYTIME`, no chip row for HEAT-only) |
| 2 | HEAT pane shows battle types, account stats, storage and geolocation; geolocation addresses stay masked until the global reveal | VERIFIED | `HeatPane.svelte` queries channel `heat` (line 102); `data-queries.ts` `case 'heat'` calls `buildHeatView`; four specs (`heat_account_statistics`, `heat_battle_types_statistics`, `heat_account_storage`, `heat_session_geolocation`); address cells only via `displayIp` in `new-data-cell.ts`; one shell-owned `revealChoice` in `Dashboard.svelte` (lines 170-176) passed to HeatPane and LoginHistory; e2e HEAT test passes |
| 3 | WOWP 19 and 20 account and plane stats are shown alongside the per-vehicle table; a title absent from an account shows empty, not an error | VERIFIED | Four `wowp_*` specs; `buildWowpAccountBlock` called only for `title === 'wowp'` (`vehicle-aggregate.ts:1296`); `PlayerStats.svelte` renders `wowpAccount` per account in tag order; `warplanes-account-worker.test.ts` and `new-data-parity.test.ts` pass; e2e shows one block for the one account holding the record and none for the others |
| 4 | WoWS crews and account storage are shown, each row traceable to its account | VERIFIED | `wows_crews.csv` and `wows_account_storage.csv` specs; `WarshipsStoragePane.svelte` mounted for `active === 'warships-storage'`; `warships-storage` channel in `data-queries.ts`; account stamped from the group root, never a cell; e2e asserts tags A and C on crew rows and the 3,003-row table windowed |
| 5 | Every new category goes through the fail-closed PII strip with a unit test per header; folders leave the footer; zero-network extended to every new pane; large tables windowed | VERIFIED (footer clause vacuous, see note) | Choke point `ingest.worker.ts:1119-1230`: `family` by file NAME, `spec === null` stores nothing, `fileMatchesSpec` per file, `projectRow` writes only spec ids (a hostile `__proto__` key cannot be stored); `FAMILY_PATTERNS` cover heat_, wotc_, every wowp_, and exactly the two WoWS names; `narrowStoredNewDataRows` idempotently narrows stored rows on check-cache (`db.ts:1211`, called `ingest.worker.ts:695`); real-capture decision table (`11-HEADERS.md`) excludes CITY_NAME, ACCOUNT_ID, REGION, ISP/ASN; `new-data-allowlist.test.ts` per-header PII matrix passes; `zero-network.spec.ts` loops `OPTIONAL_PANE_IDS` and passes; `NewDataTable` windows above 500 rows (e2e: at most 40 `tbody tr` of 3,004). No `{@html}` in `new-data` or `shell` |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified).

### Note on the footer clause of criterion 5

The roadmap sentence "Folders that used to sit under 'Not yet supported' now open their own pane and leave that footer" is vacuous for the real export: every new-game file already lives in a supported folder (`Activity_history`, `Player_statistics`; `categories.ts` `SUPPORTED`), so no folder is promoted and `unsupportedEntries` is unchanged. This was decided at research time (11-RESEARCH Pattern 8) and is pinned by a test that a result carrying both new panes yields the same unsupported list. `HEAT_Device_Info.csv` and `HEAT_Surveys.csv` are deliberately counted as present but store nothing (D-15). I consider the clause satisfied as written (no folder remains stranded), but a reader expecting a visible footer change will see none.

### Required Artifacts (spot-checked at all levels)

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `src/lib/worker/new-data-specs.ts` (471 lines) | VERIFIED | Ten spec files, columns from the committed capture; no email, phone, coordinates, city or account-id columns; `IP` is `address` kind only on session and geolocation specs |
| `src/lib/worker/new-data-allowlist.ts` | VERIFIED | `isNewDataFile`, `specFor`, `projectRow`, `fileMatchesSpec`, 200-char cell clamp; Map-based lookup |
| `src/lib/worker/new-data-facts.ts` | VERIFIED | `newDataPaneFacts` used by `finalResult` and `resultFromMeta` (`ingest.worker.ts:782, 1420`) |
| `src/lib/features/new-data/{HeatPane,WarshipsStoragePane,NewDataCard,NewDataTable}.svelte` | VERIFIED | Substantive (234-427 lines), wired from `Dashboard.svelte`, data from real worker channels (FLOWING) |
| `src/lib/features/new-data/{new-data-aggregate,new-data-state,new-data-cell,new-data-shared}.ts` | VERIFIED | Pure builders; cells read only through spec constants |
| `tests/e2e/shell/new-data-panes.spec.ts` | VERIFIED | Three listed tests, all pass |
| `tests/fixtures/multi-account-fixtures.ts`, `new-data-fixtures.ts` | VERIFIED | `buildNewGamesThreeAccountExport`, `buildHeatOnlyExport` present and consumed |

### Key Links

| From | To | Status |
| ---- | -- | ------ |
| `ingest.worker.ts` | `new-data-allowlist.ts` (`projectRow`) | WIRED (line 1225) |
| `ingest.worker.ts` | `new-data-facts.ts` / `db.ts` `narrowStoredNewDataRows` | WIRED (lines 782, 1420, 695) |
| `Dashboard.svelte` | `HeatPane`, `WarshipsStoragePane`, `resolveReveal` | WIRED (lines 458-467, 172) |
| `data-queries.ts` | `buildHeatView` / `buildWarshipsStorageView` | WIRED (cases `heat`, `warships-storage`) |
| `NewDataTable` cells | `displayIp` | WIRED via `new-data-cell.ts:56` |
| `vehicle-aggregate.ts` | `PlayerStats.svelte` (`wowpAccount`) | WIRED |

### Requirements Coverage

| Requirement | Status | Evidence |
| ----------- | ------ | -------- |
| GAMES-01 (HEAT sessions, battle types, account stats, storage, geolocation) | SATISFIED | Truths 1, 2 |
| GAMES-02 (WOTC sessions in activity) | SATISFIED | Truth 1 |
| GAMES-03 (WOWP 19 and 20 account and plane stats) | SATISFIED | Truth 3 |
| GAMES-04 (WoWS crews and account storage) | SATISFIED | Truth 4 |
| PRIV-01 (fail-closed PII strip, unit test per header) | SATISFIED | Truth 5; per-header matrix in `new-data-allowlist.test.ts`, `new-data-headers.test.ts` guard over the names-only capture |
| PRIV-02 (zero network, guard extended to new panes) | SATISFIED | `zero-network.spec.ts` extended and passing (ran it) |

No orphaned requirements: REQUIREMENTS.md maps exactly GAMES-01..04 and PRIV-01/02 to Phase 11, and all appear in plan frontmatter.

### Anti-Patterns

Scanned the 71 `src`/`tests` TS and Svelte files touched in the phase for `TBD|FIXME|XXX` (unreferenced), `TODO|HACK`, "not yet implemented" and `console.log`: none found. No stubs: all new components render real view data.

### Behavior-dependent truths

Reveal reset on replace/clear, idempotent cache narrowing, stamped remembered Vehicles title and optional-pane fallback to Overview are state-transition invariants. Each is exercised by a unit test in the 3714-test green run (`reveal-state`, `new-data-narrow`, `game-filter-state`, `selection-state`) and the replace/re-mask path by the e2e HEAT test, so none is left present-but-unverified.

### Human Verification Required

See frontmatter `human_verification` (5 items): HEAT pane at 375px by eye, six-chip wrap, ten-row phone list (the automated fold check was deliberately weakened in 11-11 deviation 3), the 40-character-nickname visual read, and a one-worker CI run against the 31-minute `globalTimeout`. These are the open checks recorded in 11-11-SUMMARY "Human checks remaining"; nothing in the repository shows any of them has been done.

### Gaps Summary

No gaps. The goal is achieved in the code: the allowlist choke point, presence facts, both new panes, the Warplanes block, the shared reveal, the filter chips and the zero-network extension all exist, are wired to real data, and pass the unit, type, lint and relevant e2e gates. Status is `human_needed` solely because of the visual and CI-timing items above.

---

_Verified: 2026-10-19_
_Verifier: Claude (gsd-verifier)_
