---
phase: 13-overview-personal-insights
plan: 05
subsystem: data
tags: [playtime, aggregation, longest-session, version-bump, lazy-rebuild, dexie, vitest]

# Dependency graph
requires:
  - phase: 13-overview-personal-insights
    provides: "plan 13-01's overview channel and withCurrentPlaytime rebuild path; the merged playtime aggregate in playtime-aggregate.ts"
provides:
  - "PlaytimeSlice.longestSeconds and PlaytimeSlice.longestStart: the longest RAW session in a slice and the wall-clock start of that session"
  - "aggregateSlice computes both fields for every slice it builds — the all-games one, each split value's and each per-game scope's — with ties resolved to the earliest start"
  - "PLAYTIME_VERSION = 4, with the lazy rebuild as the repair path for a stored v3 aggregate (no re-import, no Dexie bump)"
  - "tests/unit/playtime/playtime-longest.test.ts: hand-derived longest-session cases across slices, scopes, ties, containment, midnight crossings, zero-length sessions and excluded rows"
  - "a worker-level proof that a stored v3 aggregate without the two fields rebuilds into a v4 one, every slice included, with no playtime number changed"
affects: [13-06, 13-07, 13-08, overview, playtime, longest-session, habit-tiles]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 7900
  tasks: 2
  commits: 2
plan_head_before: 7a6b14fc480a32893836f2189d2582be899ea619
plan_head_after: 6f59db5218caf5bdb453a53c6ddbe383989ee875

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A derived aggregate figure that cannot be recovered from the stored arrays is added as an OPTIONAL field and paired with a version bump, so a hand-built literal keeps compiling while the runtime presence is guaranteed"
    - "The longest session is the RAW length while every other slice figure is merged; the two are asserted side by side in the same test, so a change that silently merged the longest figure would fail"

key-files:
  created:
    - "tests/unit/playtime/playtime-longest.test.ts"
  modified:
    - "src/lib/core/types/worker-messages.ts"
    - "src/lib/features/playtime/playtime-aggregate.ts"
    - "src/lib/features/playtime/playtime-shared.ts"
    - "src/lib/shell/game-filter-state.ts"
    - "tests/unit/import/ingest-worker.test.ts"
    - "tests/unit/import/multi-account-scale.test.ts"
    - "tests/unit/playtime/playtime-multi-account.test.ts"

key-decisions:
  - "The longest session is the RAW length (`end - start` of one session), never the merged increment: the merge sweep credits a fully-overlapped session zero seconds, which is right for a playtime total and wrong for 'how long was the longest sitting'"
  - "A tie is resolved to the EARLIEST start, and the rule falls out of the walk order rather than out of a comparison: the sweep already walks the sessions in start order, so an equal length keeps the first one seen"
  - "Both fields are OPTIONAL on the type, for the same reason `games` and `byGame` are: the version bump guarantees runtime presence, a hand-built literal stays valid, and a reader must treat an absent value as 'not available' rather than as zero"
  - "The two fields are written at the END of aggregateSlice, so an empty slice reports 0 and 0 — there is no session, so there is no longest one, and 0 is the honest 'none'"
  - "The session-oracle was NOT extended: the plan makes that conditional on a whole-object comparison needing it, and no such comparison exists — every oracle assertion in the suite is field by field, so the new field is covered by the dedicated hand-derived file instead"

patterns-established:
  - "A version bump moves EVERY literal pin of the constant, not only the one the plan names: the constant is pinned in three files, and a pin left at the old value fails loudly rather than reading as a stale cache"

requirements-completed: [INSIGHT-01, INSIGHT-02]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Every PlaytimeSlice carries longestSeconds and longestStart: the longest raw session of that slice and the wall-clock start of that session, with ties resolved to the earliest start"
    requirement: INSIGHT-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime/playtime-longest.test.ts#13-05: the longest raw session"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/playtime"
        status: pass
    human_judgment: false
  - id: D2
    description: "The longest session is the raw session and never the merged interval: two overlapping sessions contribute their own lengths, and the figure is never the union or the sum"
    requirement: INSIGHT-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime/playtime-longest.test.ts#reports a CONTAINED session by its own raw length, never by the merged total"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime/playtime-longest.test.ts#never reports the merged union when the union exceeds every raw length"
        status: pass
    human_judgment: false
  - id: D3
    description: "PLAYTIME_VERSION is 4, and a stored v3 aggregate is rebuilt lazily from its own stored session rows on the next playtime query and written back, with no re-import and no Dexie version change"
    requirement: INSIGHT-02
    verification:
      - kind: unit
        ref: "tests/unit/import/ingest-worker.test.ts#a v3 aggregate without the longest-session fields is rebuilt into a v4 one"
        status: pass
      - kind: unit
        ref: "tests/unit/import/ingest-worker.test.ts#PLAYTIME_VERSION is 4, so an aggregate from the previous build is stale"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/import"
        status: pass
    human_judgment: false
  - id: D4
    description: "No existing playtime behaviour changed: the field-by-field equality against the session oracle still holds, the Playtime pane shows the same numbers, and only the pinned version assertions moved"
    requirement: INSIGHT-01
    verification:
      - kind: unit
        ref: "pnpm run test:unit"
        status: pass
      - kind: unit
        ref: "pnpm run check"
        status: pass
      - kind: unit
        ref: "pnpm run lint"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-10-23
status: complete
---

# Phase 13 Plan 05: The longest raw session on every playtime slice

**`PlaytimeSlice` now carries the longest RAW session and its start — the one habit figure the duration bins could not answer — computed for every slice by the aggregation that already walks them, with `PLAYTIME_VERSION` at 4 so a stored v3 cache repairs itself on the next query.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-23T11:19:36Z
- **Completed:** 2026-10-23T11:27:38Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `PlaytimeSlice` gained two optional fields. `longestSeconds` is `end - start` of ONE session and `longestStart` is that session's wall-clock start, so `floor(longestStart / 86400)` is its day number. Both are optional for the same reason `games` and `byGame` are: the version bump guarantees runtime presence, a hand-built literal keeps compiling, and an absent value means "not available", never zero.
- `aggregateSlice` computes both while it sweeps, and because `rankAggregates` and `buildGameScopes` build EVERY slice through it, the all-games slice, each split value's slice and each per-game scope's slice carry them with no other edit. The tie rule falls out of the walk order rather than out of a comparison: the sweep already walks the sessions by start, so an equal length keeps the first one seen, which is the earlier start.
- The figure is RAW while every other slice figure is merged, and that is the whole point: the merge sweep credits a fully-overlapped session ZERO seconds, which is right for a playtime total and wrong for "how long was the longest sitting". A contained session still has its own length.
- `PLAYTIME_VERSION` is 4. A stored v3 aggregate has no room for the two fields, and the existing lazy rebuild is the repair: the aggregate is recomputed from its own stored session rows on the next playtime or overview query and written back through `writePlaytimeIfCurrent`, with no re-import and no Dexie version change.
- The Overview's "Longest session" tile (D-20, WoT sessions only) can now read the WoT per-game scope's `longestSeconds` and `longestStart`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Compute the longest raw session in every slice and bump the version** - `2ec913e` (feat)
2. **Task 2: Move the pinned version assertions and prove the lazy v3 rebuild through the real worker** - `6f59db5` (test)

**Plan metadata:** committed with this summary.

## Files Created/Modified

- `src/lib/core/types/worker-messages.ts` - `PlaytimeSlice.longestSeconds` and `PlaytimeSlice.longestStart`, optional, with the doc comments that say why the length is raw and what an absent value means.
- `src/lib/features/playtime/playtime-aggregate.ts` - `aggregateSlice` tracks the raw maximum and its start, and its doc comment gained the paragraph saying why the raw length is used where the merged increment is not.
- `src/lib/features/playtime/playtime-shared.ts` - `PLAYTIME_VERSION = 4` and the "4 - 13-05" history entry.
- `src/lib/shell/game-filter-state.ts` - the comment that named the version as current now says it was 3 when the HEAT/WOTC shape was proved and is 4 since 13-05 for an unrelated reason.
- `tests/unit/playtime/playtime-longest.test.ts` - thirteen hand-derived cases: the longest of three sessions, a tie resolved to the earlier start, order independence, a contained session, a union that exceeds every raw length, a midnight crossing, zero-length sessions, no usable session, two per-game scopes, a split column, and excluded rows.
- `tests/unit/import/ingest-worker.test.ts` - the pinned version assertion reads 4 with the 3 to 4 history, and a new worker test downgrades a stored aggregate to v3 without the two fields and proves the next query rebuilds it.
- `tests/unit/import/multi-account-scale.test.ts` - the playtime version pin moves with the constant; the logins pin is a separate constant and stays at 3.
- `tests/unit/playtime/playtime-multi-account.test.ts` - the two playtime version pins move with the constant.

## Decisions Made

- **The raw length, not the merged increment.** The plan asked for it and the reason survives scrutiny: the merge sweep pays a fully-overlapped session nothing, so the merged figure would answer "how long was the union of my logins" rather than "how long was the longest sitting". The two are asserted side by side in the same test so a change that quietly merged the longest figure fails.
- **The tie rule is a consequence of the walk order, not a second comparison.** The sweep already sorts by start, so "an equal length keeps the first one seen" IS "the earliest start wins". Writing a separate tie comparison would be a second way to say the same thing, and the two could disagree.
- **The fields are written at the end of the sweep.** An empty slice then reports 0 and 0 — the honest "there is no session" — instead of a field that was never assigned.
- **The session-oracle was not extended.** The plan makes that conditional on a whole-object comparison needing it, and none exists: every oracle assertion in the suite compares field by field, and `toMatchObject` is a subset match. Extending the oracle would also have required teaching the wide-span merge helper in `playtime-hand-fixture.test.ts` to carry the two fields, which is a second thing to get right for no gain in coverage the new file does not already provide.
- **Every literal pin of the constant moved.** The constant is pinned in three files, not one. The plan named only the `ingest-worker.test.ts` pin, but the plan's own must-have says "only the pinned version assertions move from 3 to 4" — and a pin left at 3 in a file the plan did not name is the same stale contract the moved pin is.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two more files pin the playtime version as the literal 3**
- **Found during:** Task 1 (the playtime suite's own acceptance gate) and Task 2 (the import suite)
- **Issue:** The plan's Task 2 named only `tests/unit/import/ingest-worker.test.ts` as holding the pinned version. `tests/unit/playtime/playtime-multi-account.test.ts` pins it twice (once on the stored aggregate, once on a per-game scope) and `tests/unit/import/multi-account-scale.test.ts` pins it once more. Task 1's own acceptance criterion is `pnpm exec vitest run tests/unit/playtime` exiting 0, so the playtime pin had to move for the task to be allowed to finish at all, and the import suite failed on the scale pin.
- **Fix:** All three literals moved to 4, and the two test titles that named the old version moved with them. The `logins` version pin in the same scale test is a DIFFERENT constant and stays at 3; the title now says which is which.
- **Files modified:** `tests/unit/playtime/playtime-multi-account.test.ts`, `tests/unit/import/multi-account-scale.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/playtime` - 455 passed; `pnpm exec vitest run tests/unit/import` - 1021 passed; `pnpm run test:unit` - 4311 passed.
- **Committed in:** `2ec913e` (the playtime pins) and `6f59db5` (the scale pin).

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The only deviation is the version literal in two files the plan did not name. It is required by the plan's own acceptance gate and by its own must-have, adds no behaviour, and no file outside the plan's set was touched.

## Issues Encountered

- The plan's case (c) asked for "the contained session's own raw length when it is the longest of the pair's raw lengths", which is geometrically impossible: a session contained in another cannot have a strictly longer raw length than its container. The file therefore exercises the RULE rather than the impossible instance — a contained session that keeps its own length available, a pair whose union exceeds every raw length (so the figure cannot be the union), and a case where the contained session's own length IS a longest of its pair (two sessions over the same span).
- Prettier reformatted `tests/unit/import/ingest-worker.test.ts` after the new test was written. It was formatted before the commit rather than as a separate `style` commit, so the task commit is lint-clean on its own.

## Known Stubs

None. Both fields are computed for every slice the aggregator builds, and every slice the worker stores carries them at runtime because the version bump rebuilds any older cache.

## Threat Flags

None. The plan's threat register owns T-13-14 (a stale v3 aggregate read with v4 rules) and T-13-15 (the one-time rebuild cost); this plan adds no new network endpoint, auth path, file access or schema change. T-13-14 is mitigated by the mechanism this plan implements, and the new worker test is its proof.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Overview's "Longest session" tile can read `longestSeconds` and `longestStart` from the WoT per-game scope's slice (D-20), and `floor(longestStart / 86400)` is the day number it needs for the date in the tile's rule line.
- Every stored aggregate is at version 4, and a cache written by an earlier build repairs itself on the next playtime or overview query with no re-import and no Dexie change.
- The duration bins remain the histogram and are unchanged; the longest session is a separate figure beside them, not a bin.

---
## Self-Check: PASSED

- Created files exist: `tests/unit/playtime/playtime-longest.test.ts` (confirmed on disk).
- Commits exist: `2ec913e`, `6f59db5` (both confirmed as ancestors of HEAD).
- Task 1 acceptance criteria: `pnpm exec vitest run tests/unit/playtime` exits 0 (455 passed); `PLAYTIME_VERSION` evaluates to 4 (asserted by the moved pin in `ingest-worker.test.ts`); `git diff src/lib/features/playtime/playtime-aggregate.ts` shows additions inside `aggregateSlice` and its doc comment only, no other function changed; `pnpm run check` exits 0 (346 files, 0 errors, 0 warnings).
- Task 2 acceptance criteria: `pnpm exec vitest run tests/unit/import/ingest-worker.test.ts tests/unit/playtime` exits 0 (527 passed, the new rebuild test listed as passed); `pnpm exec vitest run tests/unit/import` exits 0 (1021 passed); the file contains `expect(PLAYTIME_VERSION).toBe(4)` and no remaining assertion of 3 for it (read and confirmed).
- Plan-level verification: `pnpm exec vitest run tests/unit/playtime tests/unit/import` - all passed; `pnpm run check` - 346 files, 0 errors, 0 warnings; `pnpm run lint` - Prettier clean, ESLint clean. The whole unit suite (`pnpm run test:unit`) - 143 files, 4311 passed, 9 expected fail.
- Measured commits: 2 (`git rev-list --count 7a6b14f..HEAD`).

---
*Phase: 13-overview-personal-insights*
*Completed: 2026-10-23*
