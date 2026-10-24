---
phase: 13-overview-personal-insights
plan: 11
subsystem: testing
tags: [overview, worker, oracle, privacy, canaries, closed-vocabulary, d-01, d-18, d-21]

requires:
  - phase: 13-overview-personal-insights
    provides:
      - "13-03: the oracle archive, OV_EXPECTED and OV_CANARIES"
      - "13-07, 13-08: the Tanks, Records and Totals builders wired into the overview channel"
provides:
  - "The whole overview data path proved through the real worker against the hand-derived oracle"
  - "A structural privacy fence: canary sweep per fixture variant plus a closed key and string vocabulary"
affects: [13-12, 13-13, 13-14, 13-15, overview]

plan_head_before: 4fdd118458edbfae61cd243436008244560e4545
plan_head_after: 31c9be28d3214d3b9b70548ea34509bea13714de
commits: 2
actuals:
  tokens: 18000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A closed-vocabulary walk over a worker reply: keys and strings are explicit literals, so a new field fails until reviewed"
    - "A negative control proves the walker is not vacuous by planting a violation and requiring it to be flagged"
    - "One import per omit variant via describe.each, with the need vocabulary mapped once in the test"

key-files:
  created: []
  modified:
    - "tests/unit/import/overview-worker.test.ts"
    - "tests/unit/import/data-query-worker.test.ts"
    - "tests/unit/import/query-client.test.ts"

key-decisions:
  - "The oracle's descriptive `needs` strings are not the wire vocabulary, so the omit-to-need mapping is a single reviewed literal in the test; record-column names are still read from the oracle."
  - "The class tile is expected absent in every variant (no invented tag resolves a class in either table state), so assertions hold before and after plan 13-15."
  - "The chat and clan canaries are swept across the import messages as well as the answers, since those rows are never stored."

patterns-established:
  - "Stale-aggregate rebuild is proved by stripping the longest-session fields and setting v to 3, then asserting the write-back at PLAYTIME_VERSION."

requirements-completed: [INSIGHT-01, INSIGHT-02, INSIGHT-07]

coverage:
  - id: D1
    description: "All sixteen tiles, the life strip and the view-level facts match the oracle through the real worker"
    requirement: "INSIGHT-01"
    verification:
      - kind: unit
        ref: "tests/unit/import/overview-worker.test.ts#the oracle archive through the real worker"
        status: pass
  - id: D2
    description: "Each omit option answers the oracle's absent set with the right need and column; memo, replace, clear and stale rebuild behave"
    requirement: "INSIGHT-02"
    verification:
      - kind: unit
        ref: "tests/unit/import/overview-worker.test.ts#with the %s source left out"
        status: pass
  - id: D3
    description: "Per-channel independence of an overview ask in the query client"
    requirement: "INSIGHT-07"
    verification:
      - kind: unit
        ref: "tests/unit/import/query-client.test.ts#an overview query beside a currency query settles both"
        status: pass
  - id: D4
    description: "No canary or free-text value reaches an overview reply; a new field fails the vocabulary walk"
    requirement: "INSIGHT-07"
    verification:
      - kind: unit
        ref: "tests/unit/import/data-query-worker.test.ts#13-11: no personal field reaches any overview reply"
        status: pass

status: complete
---

# Phase 13 Plan 11: Oracle Proof and Privacy Fence Summary

**The overview channel is proved end to end against the hand-derived oracle through the real worker, and fenced by a canary sweep plus a closed key and string vocabulary that fails when any new field or free-text value appears.**

## Performance

- **Tasks:** 2 of 2
- **Files modified:** 3 (tests only)
- **Commits:** 2

## Accomplishments

- A full tile-by-tile proof of the default archive (all sixteen tiles, the life strip, the view dates, the account count, the reply `importedAt` equal to the stored meta).
- Seven omit variants answered with the oracle's absent set, the right need per tile, and the right column name for the record-columns option; the Blitz-only and account-statistics fallback cases are asserted explicitly.
- Memo (one entry, equal views), replace (new view and new date, nothing old survives), clear (null date, null result), a v3 aggregate stripped of the longest-session fields rebuilt and written back, a deleted aggregate rebuilt, and an overview plus currency ask answered back to back.
- Query client: an overview ask beside a currency ask settles both; a second overview ask supersedes only the first overview ask.
- Privacy: `overview` added to the existing five-canary sweep; per-variant sweep of all nine `OV_CANARIES` and the order-id pattern across every overview reply, with the never-stored chat and clan values checked across every posted message including the import's; a closed vocabulary walk over nine variants, a relaxed variant for real-looking tags, and a negative control.

## Task Commits

1. **Task 1: oracle through the real worker, plus channel independence** - `0da39ab` (test)
2. **Task 2: privacy fence** - `31c9be2` (test)

## Deviations from Plan

None - plan executed exactly as written. Two notes on interpretation:

- The legacy hand-sessions export case (Logged in ready, four habits absent) and the first-pass memo/rebuild/clear case were already covered by the 13-01 tracer in the same file, so they were not duplicated; the new cases extend them to the oracle archive.
- The oracle's `needs` strings (for example `currency`, `orders`) are descriptive and differ from the shared `OverviewNeed` vocabulary, so the mapping is a single literal in the test.

## Issues Encountered

None. `pnpm run check`, `pnpm run lint` and `pnpm run test:unit` (4739 passed, 9 expected fail) are green.

## Known Stubs

None.

## Threat Flags

None. The plan adds tests only and no new surface.

## Self-Check: PASSED

- tests/unit/import/overview-worker.test.ts, data-query-worker.test.ts, query-client.test.ts: FOUND
- Commits 0da39ab and 31c9be2: FOUND
