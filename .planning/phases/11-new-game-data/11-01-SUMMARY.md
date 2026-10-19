---
phase: 11-new-game-data
plan: 01
subsystem: worker-ingest + shell-filter
tags: [privacy, allowlist, worker, game-filter, copy, d-08, d-13, d-15]
requires: [worker-ingest-choke-point, playtime-per-game-scopes, phase-10-shared-filter]
provides: [new-data-specs-table, new-data-allowlist, buildNewGamesExport, NG_EXPECTED, filter-scope-guard, GAME_NAMES-wotc-heat]
affects: [11-02, 11-03, 11-04, 11-09, 11-11]
tech-stack:
  added: []
  patterns:
    - per-file column allowlist projected at the row choke point, keyed by FILE NAME and never by folder
    - output keys are spec constants resolved through a Map via headerKey, never the file's own header text
    - file-level match decided once per file, so a ragged row cannot drop its siblings
    - a source-shape guard for a wiring decision a unit test cannot render (D-07)
key-files:
  created:
    - src/lib/worker/new-data-specs.ts
    - src/lib/worker/new-data-allowlist.ts
    - tests/fixtures/new-data-fixtures.ts
    - tests/unit/import/new-data-allowlist.test.ts
    - tests/unit/playtime/playtime-new-games.test.ts
    - tests/unit/shell/game-filter-scope.test.ts
  modified:
    - src/lib/worker/ingest.worker.ts
    - src/lib/shell/game-filter-state.ts
    - src/lib/shell/GameFilter.svelte
    - src/lib/features/playtime/Playtime.svelte
    - src/lib/ui-copy.ts
    - tests/fixtures/multi-account-fixtures.ts
    - tests/unit/shell/game-filter-state.test.ts
    - tests/unit/shell/ui-copy.test.ts
    - tests/unit/shell/login-copy.test.ts
    - tests/e2e/shell/multi-account.spec.ts
decisions:
  - "D-13 answered NO: PLAYTIME_VERSION stays 3. The HEAT/WOTC per-game scopes already existed (buildGameScopes groups by session file name), and the worker-level test asking for All/HEAT/WOTC/WOT through the real worker passes against the hand-derived literals. No returning reader is charged a rebuild."
  - "The projection REPLACES reduceBlobRow and sanitizeUserInfoRow for a new-game row rather than running beside them, and the aggregator feed is deliberately NOT gated on storeFile, so a drifted-header file is counted as EXCLUDED rather than vanishing."
  - "The WoT files in the new-games fixture carry NO canaries. WoT is not a family file and is stored as it always was, so a canary there would sit in db.rows by design and would make 'no canary anywhere in db.rows' assert something false."
  - "GAME_ORDER is set to the identity header's WOT/WOTB/WOWS/WOTC/HEAT/WOWP rather than appending to the old four, so one fixed app-wide order exists; Warplanes stays LAST deliberately rather than by sort."
metrics:
  duration: 14min
  completed: 2026-10-19
status: complete
commits: 2
plan_head_before: 4326a1609c51d3ac484e83257aee82ff1d41afb3
plan_head_after: 62668c4fd5ae6a4b6e36fd8853abe645c82d1c65
actuals:
  tokens: 21700
  tasks: 2
  commits: 2
---

# Phase 11 Plan 01: HEAT and WoT Console end to end Summary

One real slice, from the zip's CSV to a chip on the screen: a HEAT or WoT Console
session file now passes through a per-file column allowlist at the worker's row
choke point, lands in the stored per-game Playtime scopes, and is selectable as a
chip labelled from the one name table.

## What shipped

**`src/lib/worker/new-data-specs.ts`** (new, zero imports) — `SpecColumnKind`,
`SpecColumn`, `SpecFile`, and `NEW_DATA_SPEC_FILES` holding exactly two entries:
`heat_game_sessions.csv` and `wotc_game_sessions.csv`, both `activity_history`.
Their columns are the session vocabulary the aggregators already read
(`STARTED_AT`, `FINISHED_AT`, `SESSION_START`, `SESSION_END`, `SERVER_NAME`,
`CLIENT_PLATFORM`, `IP`), each mapping to ITSELF, so a hybrid header behaves
exactly as it did before. This file is the only place a stored column of a
new-game file is named.

**`src/lib/worker/new-data-allowlist.ts`** (new) — `MAX_NEW_DATA_CELL` (200),
`FAMILY_PATTERNS` (one anchored case-insensitive regex over `heat_` / `wotc_`),
`isNewDataFile`, `AllowlistSpec`, `specFor`, `projectRow`, `fileMatchesSpec`.

**`src/lib/worker/ingest.worker.ts`** — the parse loop now computes
`family` / `spec` / `storeFile` before the row loop and branches the row's `data`
through `projectRow` (or `{}` for a spec-less family file) INSTEAD OF the existing
reduce/sanitize expression. `allRows`, `root.storedRows` and the User_Info pools
are gated on `storeFile`; the aggregator `rows.push` is not, so a drifted header
yields excluded rows rather than a vanished file.

**`GAME_FILTER_TOKENS`** — now `['WOT','WOTB','WOWS','WOTC','HEAT']`.
**`GAME_NAMES` / `GAME_ORDER`** — `WOTC: 'WoT Console'`, `HEAT: 'HEAT'`, order
WOT/WOTB/WOWS/WOTC/HEAT/WOWP.

## D-13: the answer is NO

The plan asked for a test-first proof and a version bump only if the test failed.
It did not fail. `tests/unit/playtime/playtime-new-games.test.ts` asks the real
worker for All, HEAT, WOTC and WOT against `buildNewGamesExport()` and compares
with `NG_EXPECTED`, which is typed by hand in the fixture beside the interval
arithmetic that produces it:

| game | seconds | sessions | active days |
|------|---------|----------|-------------|
| HEAT | 9,000 | 3 | 2 |
| WOTC | 3,600 | 1 | 1 |
| WOT | 7,200 | 2 | 2 |
| All | 19,800 | 6 | 5 |

`meta.playtime.v` equals `PLAYTIME_VERSION` (still **3**), `byGame` lists
`['HEAT','WOT','WOTC']`, and setting `meta.playtime` to null then re-querying
rebuilds an aggregate that deep-equals the import-time one. The pinned
`toBe(3)` in `tests/unit/import/ingest-worker.test.ts` was deliberately NOT
flipped. 11-RESEARCH Pattern 11 was right and the suspicion that started D-13
was wrong: `buildGameScopes` has always grouped by session file name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The fixture planted canaries in the WoT files too**
- **Found during:** Task 1, worker-level canary assertion
- **Issue:** `NG_WOT_SESSIONS_A/B` were rendered with the six-column planted
  header, but WoT is NOT a new-game family file, so its rows are stored exactly
  as they always were and the canaries landed in `db.rows` by design. The
  "no canary string anywhere in `db.rows`" assertion — which the plan states
  unqualified — was therefore unsatisfiable by any correct build.
- **Fix:** the two WoT bodies now use the plain three-column real header and no
  canaries, with a comment saying why the omission is load-bearing rather than
  incidental. The HEAT, WOTC and the two spec-less family files keep theirs,
  which is where the negative assertion has teeth.
- **Files modified:** `tests/fixtures/new-data-fixtures.ts`
- **Commit:** aad58d3

**2. [Rule 3 - Blocking issue] `storedRows` keyed on the file name alone mixed the two roots**
- **Found during:** Task 1, worker tests
- **Issue:** `sourceFile` is the bare file name, and BOTH roots carry
  `HEAT_Game_Sessions.csv`. The header-only and drifted assertions were being
  answered partly by the sibling root's legitimate row.
- **Fix:** `storedRows` takes an optional account and the two skip cases name
  `NG_ROOT_A`; the drifted case additionally asserts the sibling row DID land, so
  the skip is proved to be about the file and not about a failed import.
- **Files modified:** `tests/unit/import/new-data-allowlist.test.ts`
- **Commit:** aad58d3

**3. [Rule 1 - Bug] A `Record<string, string>` cast over a heterogeneous hostile row**
- **Found during:** Task 1, `pnpm run check`
- **Issue:** the `__parsed_extra` prototype-tampering case casts
  `{ __parsed_extra: string[]; … }` to `Record<string, string>`, which TS rejects.
- **Fix:** `as unknown as`, matching the intent (the value deliberately violates
  `CsvRow`'s shape, which is the point).
- **Files modified:** `tests/unit/import/new-data-allowlist.test.ts`
- **Commit:** aad58d3

### Scope notes (not deviations, recorded for the reader)

- **Acceptance criterion 3** — `grep -n "projectRow\|isNewDataFile\|specFor"
  ingest.worker.ts` prints four lines, one of which is the module import above
  the loop rather than inside it. The three in-loop lines are the ones the
  criterion is about.
- **`projectRow`'s duplicate rule** — the plan says "first match wins, a repeat
  is dropped". The implementation checks `id in out`, which is what "first wins"
  means; a repeated header under a DIFFERENT spec id would both survive, and no
  such spec exists.
- **`fileMatchesSpec` takes `readonly CsvRow[]`** rather than the parse result, so
  it is a pure function over rows rather than over `parseCsvFile`'s output shape.
  The call site builds a `rowData` reference array once per file.

## Verification

| Gate | Result |
|------|--------|
| `pnpm run test:unit` (whole suite) | 102 files, 3,357 tests, all pass |
| `pnpm run check` (`tsc -b` + `svelte-check`) | 318 files, 0 errors, 0 warnings |
| `pnpm run lint` (`prettier --check .` + `eslint .`) | clean |
| `grep -c '^import' src/lib/worker/new-data-specs.ts` | 0 |
| `grep -n "export function …" src/lib/worker/new-data-allowlist.ts` | four lines |
| `GAME_FILTER_TOKENS` tuple | `['WOT','WOTB','WOWS','WOTC','HEAT']`, one line |
| `export const PLAYTIME_VERSION` | `3` (D-13's condition was not met) |
| `NG_EXPECTED` in the playtime test | 15 occurrences; `9_000` and `19_800` both literal |
| `new-data-fixtures.ts` imports | none (leaf-module rule holds) |
| `game-filter-scope.test.ts` reads `Dashboard.svelte` | yes |

**Not run:** `pnpm exec playwright test`. The two edited e2e specs
(`multi-account.spec.ts`, `multi-account-scale.spec.ts`) need Chromium, which this
sandbox cannot launch. They are covered by `tsc -b`, `svelte-check`, `eslint`
and `prettier`, all of which are green. `multi-account-scale.spec.ts` needed no
change: it clicks `all`/`wot`/`wotb`/`wows` and never enumerates chip ids.

## Known Stubs

None. No `TODO`, `FIXME`, placeholder copy or unwired data source was introduced;
every new pane value is computed from the stored aggregate and asserted against a
hand-written literal.

## Threat Flags

All four register entries in the plan's `<threat_model>` are mitigated and pinned
by tests in this plan; no new surface beyond them was introduced.

| Flag | File | Test that holds it |
|------|------|---------------------|
| threat_flag: untrusted-csv-column | `src/lib/worker/new-data-allowlist.ts` | `projectRow` pure cases + the worker-level canary sweep over `db.rows` and `meta` |
| threat_flag: hostile-header-as-stored-key | `src/lib/worker/new-data-allowlist.ts` | BOM / padding / case / duplicate / `__proto__` / `__parsed_extra` cases |
| threat_flag: folder-as-scope-switch | `src/lib/worker/new-data-specs.ts` | `specFor(…, 'payment_history', 'HEAT_Game_Sessions.csv')` is null; the two spec-less family files in `Device_Info` and `Player_Statistics` store nothing |
| threat_flag: untrusted-token-as-chip-label | `src/lib/shell/game-filter-state.ts` | the hostile-token matrix case, now also covering `WOWP` |

## Self-Check: PASSED

All six created files exist; both commits (`aad58d3`, `62668c4`) are ancestors of
HEAD.

## Deviations from the GSD bookkeeping

**4. [Rule 1 - Bug] GAMES-01 was reverted to Pending after `requirements.mark-complete`**
- **Found during:** state updates
- **Issue:** the plan's frontmatter lists `requirements: [GAMES-01, GAMES-02,
  PRIV-01]`, and marking all three flipped GAMES-01 to Complete. GAMES-01 reads
  "HEAT sessions, battle types, account stats, storage and geolocation are
  shown", and this plan delivers HEAT **sessions** only — battle types, account
  stats, storage and geolocation are plans 11-02 and 11-03. A phase requirement
  marked complete a third of the way through its phase is a false entry in the
  ledger a `/gsd-verify-work` run reads.
- **Fix:** `.planning/REQUIREMENTS.md` was reverted for GAMES-01 only (checkbox
  and traceability row). GAMES-02 ("WoT Console sessions are shown in activity")
  and PRIV-01 ("the same fail-closed PII strip, with unit tests per header") are
  genuinely delivered here and stay Complete. Recorded in `.planning/WINDOWS.md`
  as a `deviation` entry so plan 11-03 re-runs the mark.
- **Files modified:** `.planning/REQUIREMENTS.md`, `.planning/WINDOWS.md`
- **Commit:** the final metadata commit

## Carried to the next plan

- **11-02/11-03** append to `NEW_DATA_SPEC_FILES` and to `FAMILY_PATTERNS` in the
  SAME commit as each other; a family pattern without its spec stores nothing by
  design, so a half-applied change is a fail-closed no-op rather than a leak.
- **11-04** owns `PRESENCE_CATEGORIES`; this plan deliberately did not touch it,
  so a HEAT session file is not yet a presence fact.
- **11-09** adds panes that must stay OUT of `{gameFilter}`;
  `tests/unit/shell/game-filter-scope.test.ts` is what makes them fail if they do.
- A returning reader's cache still holds pre-allowlist rows for HEAT/WOTC in the
  old shape. 11-RESEARCH Runtime State Inventory records the narrowing step as an
  open item; nothing in this plan changed at-rest data already written.