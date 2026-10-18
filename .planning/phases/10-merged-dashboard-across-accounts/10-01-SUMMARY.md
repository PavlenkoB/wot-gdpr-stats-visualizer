---
phase: 10-merged-dashboard-across-accounts
plan: 01
subsystem: worker
tags: [playtime, multi-account, dexie, postmessage, worker, aggregation, overlap]

requires:
  - phase: 09-multi-account-import-account-identity
    provides: account-aware session sources (`AccountSessionSource`), the ordered account list, and the lazy `v`-keyed aggregate rebuild path
  - phase: 04-playtime
    provides: `aggregateSlice` / `rankAggregates`, `viewFromAggregates`, `PLAYTIME_VERSION`, the independent per-second oracle
provides:
  - "PLAYTIME_VERSION 3 and `isGameToken` / `GAME_TOKEN_RE` in playtime-shared.ts"
  - "`PlaytimeScope`, optional `games` / `byGame`, optional `game` on `playtime-query`, and the `no-game-sessions` view"
  - "`buildGameScopes` — one complete scope per game token, capped at MAX_SPLIT_VALUES"
  - "`buildOverlapTwoAccountExport`, `MA_OVERLAP_EXPECTED` and `MA_OVERLAP_ADDRESSES` (also consumed by Plans 10-04 and 10-06)"
  - "`tests/unit/playtime/playtime-multi-account.test.ts` — 16 tests, worker-level and pure"
affects: [10-02, 10-04, 10-06, playtime-client, playtime-state, Playtime.svelte, PlayerStats.svelte]

actuals:
  tokens: 26200
  tasks: 2
  commits: 6
plan_head_before: a82fdf94639ba79da64bcc43012e9799a84dfce1
plan_head_after: 10b6cb8

tech-stack:
  added: []
  patterns:
    - "Wrap `rankAggregates` per group rather than editing it: the all-games and every per-game scope come out of ONE function, so the merge cannot drift between scopes."
    - "One trust-boundary predicate per message field (`isGameToken`, mirroring `isDataQuery`): validated once in the worker, above the branches, and a rejected value is never echoed."

key-files:
  created:
    - tests/unit/playtime/playtime-multi-account.test.ts
  modified:
    - src/lib/features/playtime/playtime-aggregate.ts
    - src/lib/features/playtime/playtime-shared.ts
    - src/lib/core/types/worker-messages.ts
    - src/lib/worker/ingest.worker.ts
    - tests/fixtures/multi-account-fixtures.ts
    - tests/unit/import/ingest-worker.test.ts
    - tests/unit/playtime/playtime.test.ts

key-decisions:
  - "A per-game scope is a COMPLETE scope, not a slice: `PlaytimeScope` is the old `PlaytimeAggregates` minus the game fields, and the all-games aggregate extends it. So one `readyView` builds a `ready` view for either, and a scope can never answer with a `split` taken from a different scope than its `byValue`."
  - "`games` and `byGame` are OPTIONAL on the stored type. Fifty-odd call sites build aggregate literals; the `PLAYTIME_VERSION` bump is what guarantees presence at runtime, so the type stays honest about what the old data says and what the new one does."
  - "A malformed game token degrades to All silently rather than answering an error status. The raw value is never copied into a reply, so a hostile string cannot reach the main thread at all (T-10-01)."
  - "The token list is cut at MAX_SPLIT_VALUES BEFORE any scope is built, so an archive of crafted file names costs the same as one of fifty (T-10-03)."

patterns-established:
  - "Expected values are typed into the fixture module as literals beside the arithmetic that produces them; nothing is read back off the worker, and `oracleSlice` is the only cross-check."
  - "A test asserting a stored record holds no PII asserts the KEY SET, not just the content — so a field added without being thought about is itself the failure."

requirements-completed: [ACCOUNT-04, ACCOUNT-06]

coverage:
  - id: D1
    description: "All games answers the hand-computed cross-account union through the real worker: 23,400 s / 9 sessions / 5 days, with the game token list."
    requirement: ACCOUNT-04
    verification:
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#answers All games with the hand-computed union, once, across both accounts"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#agrees with the independent per-second oracle on All and on each game"
        status: pass
    human_judgment: false
  - id: D2
    description: "A game filter selects only that game's union (WOT 18,000 / 6 / 4, WOTB 5,400 / 2 / 2, WOWS 3,600 / 1 / 1), and the per-game sum is larger than All."
    requirement: ACCOUNT-06
    verification:
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#answers one game with only that game's union, from the stored scope"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#answers every per-game scope, and their sum is LARGER than All"
        status: pass
    human_judgment: false
  - id: D3
    description: "The merge is order-independent: reversed archive, A-then-B and B-then-A source order, reversed rows, and a same-start pair all agree."
    requirement: ACCOUNT-04
    verification:
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#builds deeply equal aggregates whichever account and row order arrives"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#credits a same-start pair once, whichever account is read first"
        status: pass
    human_judgment: false
  - id: D4
    description: "A v2-stamped or deleted aggregate is rebuilt lazily to version 3, and the rebuilt `byGame` equals the import-time one."
    verification:
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#rebuilds a v2-stamped aggregate into a v3 one that still answers a game"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#rebuilds a deleted aggregate to the import-time one and writes it back"
        status: pass
    human_judgment: false
  - id: D5
    description: "The game token is a validated trust boundary: hostile values degrade to All and are never echoed; an unknown valid token answers `no-game-sessions` with the chip list."
    verification:
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#degrades every malformed token to All and never echoes the raw value"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#answers an unknown but VALID game token with no-game-sessions, keeping the chip list"
        status: pass
    human_judgment: false
  - id: D6
    description: "No address reaches the stored aggregate, and an unusable row counts in its own game only."
    verification:
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#stores no IP address anywhere in the aggregate"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime/playtime-multi-account.test.ts#counts an unusable row in its own game only"
        status: pass
    human_judgment: false
  - id: D7
    description: "A game chip row on the playtime card, with the copy explaining that All can be smaller than the sum of games."
    verification: []
    human_judgment: true
    rationale: "Deliberately out of scope for this plan — the UI is Plan 10-02, which wires the chips onto the contract built here. Not a deliverable of 10-01 at all; recorded so the phase verifier does not read its absence as a gap in the filter's usability."

duration: 9 min
completed: 2026-10-18
status: complete
---

# Phase 10 Plan 01: Per-game playtime scopes Summary

**One complete playtime scope per game stored beside the all-games one, selected by a validated `game` on `playtime-query`, with the cross-account overlap merge proved against a hand-computed two-account fixture through the real worker.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-18T12:16:12Z
- **Completed:** 2026-10-18T12:25:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `PLAYTIME_VERSION` 2 → 3 with `GAME_TOKEN_RE` / `isGameToken` in `playtime-shared.ts`, and `handlePlaytimeQuery` validating the incoming `game` ONCE above both branches, so the stored and the lazily rebuilt path cannot answer a game question differently.
- `buildGameScopes` groups usable sessions by the game their FILE named and runs the **existing** `rankAggregates` over each group. `rankAggregates` and `aggregateSlice` are byte-identical — the v1.0 merge and the v1.0 session count are untouched, which is what keeps `HAND_ALL`, the oracle's contract and every e2e text assertion valid (D-07 amended).
- `viewFromAggregates(aggregates, valueIndex, game)` picks a scope, or answers the new `no-game-sessions` view, and every `ready` answer carries the all-games `games` list plus the applied `game`.
- `buildOverlapTwoAccountExport()` — two synthetic accounts whose sessions overlap across accounts and across games — with `MA_OVERLAP_EXPECTED` and `MA_OVERLAP_ADDRESSES` typed in as literals beside the interval arithmetic that produces them.
- 16 tests: 10 through the real worker (`loadWorker` + `ingestExport`), 6 pure. The hand fixture is checkable line by line: 04.03 5,400 + 05.03 7,200 + 06.03 5,400 + 08.03 3,600 + 10.03 1,800 = 23,400 s.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "WOT" slice — overlap fixture, per-game scopes, game on the query, literal totals through the real worker** - `8d69b94` (feat)
2. **Task 2: Prove the merge rule and the storage paths — ties, order, rebuild equals import, hostile tokens** - `a1acffe` (test)

## Files Created/Modified

- `src/lib/features/playtime/playtime-shared.ts` — `PLAYTIME_VERSION` 3 with its "3 -" paragraph; `GAME_TOKEN_RE` and `isGameToken`.
- `src/lib/core/types/worker-messages.ts` — `PlaytimeScope`; `PlaytimeAggregates` extends it with optional `games` / `byGame`; the `no-game-sessions` view variant; optional `game` on `playtime-query`.
- `src/lib/features/playtime/playtime-aggregate.ts` — `buildGameScopes`, the `games` / `byGame` spread on `buildPlaytimeFromSources`, `viewFromAggregates`' third argument and the extracted `readyView`.
- `src/lib/worker/ingest.worker.ts` — the dispatch passes `msg.game`; `handlePlaytimeQuery` takes the argument, computes `wanted` once and passes it to both branches.
- `tests/fixtures/multi-account-fixtures.ts` — `MA_OVERLAP_ROOT_A/B`, the two nicknames, `buildOverlapTwoAccountExport`, `MA_OVERLAP_EXPECTED`, `MA_OVERLAP_ADDRESSES`.
- `tests/unit/playtime/playtime-multi-account.test.ts` — new; the worker harness driver and every proof above.
- `tests/unit/import/ingest-worker.test.ts` — the `PLAYTIME_VERSION is 2` pin flipped to 3 on purpose.
- `tests/unit/playtime/playtime.test.ts` — the stored-key-set pin gained `games` and `byGame`.

## Decisions Made

- **`PlaytimeScope` rather than a slice per game.** A per-game scope is the whole aggregate minus the game fields, so the all-games answer and a per-game answer are built by one `readyView` and a scope can never pair its `split` with another scope's `byValue`. The alternative — storing `PlaytimeSlice` and rebuilding the split on read — puts a second interpretation of `splitColumn` in the reader.
- **`games` / `byGame` optional in the TYPE.** Fifty-odd call sites build aggregate literals. The version bump is what guarantees presence at runtime, so the type can stay honest about what an older record means without touching a reader.
- **`Map` for the token grouping, `sort()` for the order.** Same two reasons `rankAggregates` gives: a file named `__proto__` is a key like any other (T-04-10), and a locale-aware comparison would make the stored chip order differ between two people looking at one export.
- **No Dexie bump.** `games` and `byGame` are optional fields of the existing non-indexed `playtime` record; `db.verno` stays 2 and `tests/unit/import/db.test.ts` still pins it (D-16).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Flipped a second hidden pin the plan did not list**
- **Found during:** Task 1, first `test:unit` run
- **Issue:** `tests/unit/playtime/playtime.test.ts` "stores no string but the split values, and never the IP (T-04-01)" asserts the exact key SET of the stored aggregate — `[all, byValue, sessionsFileSeen, splitColumn, v, values]`. Adding `games` and `byGame` fails it. That file is not in the plan's `files_modified`.
- **Fix:** Added both keys to the expected list, with a comment recording why the KEY SET is the claim: a field added to the stored aggregate without being thought about is a field an IP could travel in. The `no 192.0.2.99` and `no "eu-1"|"na-1" beyond the two split values` assertions are unchanged.
- **Files modified:** `tests/unit/playtime/playtime.test.ts`
- **Verification:** `pnpm run test:unit` green (97 files, 3172 tests).
- **Committed in:** `8d69b94`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** One additional test file, a one-list pin flip of the same kind the plan already scheduled for `ingest-worker.test.ts`. No production behaviour beyond the plan's scope.

## Issues Encountered

- `pnpm run test:unit -- <path>` does not filter in this repo — it runs all 97 files. Convenient, since both `<verify>` commands then cover the whole suite, but the named-file reading in the plan is not what the command does.
- Two type errors surfaced only in `pnpm run check` (the test file is in the app tsconfig, so `vitest`'s transpile-only run did not catch them): a `push` onto a `readonly` row array, and three unused destructured variables in the v2-stamping test. Both fixed; `check` and `lint` are green.
- `graphify update .` was run as the plan's verification asks. It rewrote `graphify-out/{GRAPH_REPORT.md,graph.html,graph.json}` in the working tree; those files are tracked but, by this repo's own history, refreshed at phase-merge commits rather than per plan, so they are left uncommitted here rather than added to a phase-01 commit.

## Self-Check: PASSED

- All six key files exist on disk; both task commits and the metadata commit are ancestors of HEAD.
- `pnpm run test:unit` 97 files / 3172 tests green; `pnpm run check` 0 errors, 0 warnings; `pnpm run lint` clean.
- `PLAYTIME_VERSION` is 3; `buildOverlapTwoAccountExport`, `MA_OVERLAP_EXPECTED` and `MA_OVERLAP_ADDRESSES` are exported; `db.verno` still pins 2 in `db.test.ts`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 10-02 can start.** The contract is in place: `playtime-query.game`, `view.games` / `view.game`, and the `no-game-sessions` view. The main thread side (`playtime-state.ts` `awaiting`, `playtime-client.ts` `query`) is untouched and still works — `game` is optional everywhere, so nothing shipped in 10-01 breaks a caller that never sets it.
- **`MA_OVERLAP_ADDRESSES` is ready for Plans 10-04 and 10-06** (login addresses, accounts and games per address), typed in rather than read off the worker.
- **No blocker.** The only thing 10-02 must not forget from RESEARCH Pitfall 3 is that `awaiting` becomes `requested.game !== shown.game` too, or a chip click leaves a stale slice looking final.

---
*Phase: 10-merged-dashboard-across-accounts*
*Completed: 2026-10-18*