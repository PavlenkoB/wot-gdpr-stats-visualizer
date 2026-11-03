---
phase: 12-account-timeline-perks
plan: 05
subsystem: features
tags: [dedupe, timeline, chronology, copy, privacy, unit-tests]

requires:
  - phase: 12-02
    provides: "the new-data view contract (`NewDataCell`, `NewDataColumnKind`, `PerksCardId`) this plan's timeline contract and card titles are keyed by"
  - phase: 11-new-game-data
    provides: "the HEAT/Warships pane copy block, the IP-only `MASK_*` set and the `AccountRowGroup` grouping every builder resolves within"
  - phase: 04-playtime
    provides: "`parseSessionTimestamp` and its range-checked wall-clock conversion, reused rather than reimplemented"
provides:
  - "account-merge.ts: mergeIdenticalAcrossAccounts / flattenGroups — the read-time cross-account merge, keyed on a JSON column signature plus an occurrence index, in a Map"
  - "timeline-shared.ts: TIMELINE_KINDS, kindRank, TIMELINE_FILE_IDS, TimelineFileState, TimelinePart, TimelineEntryView, TimelineView, TIMELINE_MERGED_FILES, MAX_TIMELINE_SECONDARY_PARTS — the type-only view contract"
  - "timeline-instant.ts: parseTimelineInstant (four date shapes, no Date) and compareTimelineKeys (newest first, undated last, total order)"
  - "The Phase 12 copy block in ui-copy.ts: intros, kind/column labels, showing line, merge note, Perks card titles, the Perks mask set, both About bodies, loading and error sentences"
  - "tests/unit/new-data/account-merge.test.ts, tests/unit/account-timeline/timeline-instant.test.ts and the 12-05 describe block in tests/unit/shell/ui-copy.test.ts"
affects: [12-09, 12-11, 12-12, new-data-aggregate, ui-copy, account-timeline-pane]

actuals:
  tokens: 14700
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A contract module whose imports are TYPE-ONLY, so a worker-side builder and a page-side pane can agree without depending on each other (`grep -v '^import type' … | grep -c '^import'` prints 0)"
    - "The signature is JSON text over the caller's whole column list, so absence (null) stays distinct from an empty string and a separator-join collision is impossible"
    - "Occurrence index inside the row's OWN account, so a repeated row in one account is never collapsed with the first"
    - "One shared date reader (`parseSessionTimestamp`) for both the session files and the timeline, so one range check serves every date in the app"
    - "Copy interpolation is limited to `formatNumber`: no formatter in the Phase 12 block takes a string, which is how T-12-15 is enforced mechanically rather than by review"

key-files:
  created:
    - src/lib/features/new-data/account-merge.ts
    - src/lib/features/account-timeline/timeline-shared.ts
    - src/lib/features/account-timeline/timeline-instant.ts
    - tests/unit/new-data/account-merge.test.ts
    - tests/unit/account-timeline/timeline-instant.test.ts
  modified:
    - src/lib/ui-copy.ts
    - tests/unit/shell/ui-copy.test.ts

key-decisions:
  - "The merge key is a JSON signature plus an occurrence index counted PER GROUP, not per account name: with a per-account counter a root that appears in two groups can never repeat a tag, and with a per-group counter the duplicate-account guard is a branch a test can actually reach"
  - "flattenGroups returns the SAME MergeResult shape as the merge rather than a bare row list, so a file that never merges is a substitution in the builder and still reports mergedAway: 0 truthfully (which is what keeps the merge note off the screen)"
  - "Merged rows come back in first-seen order and in first-seen account order, not identity-header order: this module has no header, and accountChipsOf already orders tags by letter in the view layer"
  - "The third merge-eligible file is Subscriptions, which the Perks pane reads, not a timeline file; TIMELINE_MERGED_FILES is therefore service and languageCountry only (UI-SPEC Recorded Choice 3)"
  - "TIMELINE_MERGED_FILES is a ReadonlySet so a builder's membership test is O(1) and cannot be satisfied by a partial string comparison"
  - "The instant parser takes `string | null | undefined`, not just `string`, because a CSV cell is legitimately absent and a caller should not have to guard before asking whether an entry is dated"
  - "formatMergeNote routes its count through formatNumber like every other count in the module; the singular variant is a literal, which is why 1 can never print as '1 entries'"

patterns-established:
  - "TDD RED commits are `test(12-0N):` and fail on a missing module; the GSD tdd-red-evidence checker cannot classify a vitest RED (11-04 recorded this), so `git log -E --grep=\"^test\\(12-05\\):\"` is the machine check"
  - "A source-shape test reads the module off disk and strips comments first, so a comment about a rule cannot satisfy the rule (the reveal-state precedent)"

requirements-completed: []

coverage:
  - id: D1
    description: "Identical rows merge across accounts only when every listed column is equal, and a same-account repeat stays its own row"
    requirement: TIMELINE-01
    verification:
      - kind: unit
        ref: tests/unit/new-data/account-merge.test.ts#mergeIdenticalAcrossAccounts
        status: pass
    human_judgment: false
  - id: D2
    description: "The merge is keyed in a Map, so an account root named __proto__ is an ordinary key, and it reports how many stored rows it removed"
    requirement: TIMELINE-01
    verification:
      - kind: unit
        ref: tests/unit/new-data/account-merge.test.ts#treats an account root named __proto__ as an ordinary key (T-09-27)
        status: pass
    human_judgment: false
  - id: D3
    description: "The timeline view contract (kinds, file ids, entry and view shapes, merged files) exists in one type-only module"
    requirement: TIMELINE-02
    verification:
      - kind: unit
        ref: tests/unit/account-timeline/timeline-instant.test.ts#the view contract imports no runtime module at all
        status: pass
    human_judgment: false
  - id: D4
    description: "Timeline order is newest first by a tolerant wall-clock instant, undated last, with a deterministic tie-break chain"
    requirement: TIMELINE-02
    verification:
      - kind: unit
        ref: tests/unit/account-timeline/timeline-instant.test.ts#orders a mixed-format, mixed-dated list the way the pane shows it
        status: pass
    human_judgment: false
  - id: D5
    description: "A date the parser rejects makes the entry undated but keeps the export's own text for display; the parser never throws and never constructs a Date"
    requirement: TIMELINE-02
    verification:
      - kind: unit
        ref: tests/unit/account-timeline/timeline-instant.test.ts#returns null for blank, absent and hostile input without throwing
        status: pass
    human_judgment: false
  - id: D6
    description: "Every UI-SPEC string for the two panes exists as a named constant or formatter and is pinned by a unit test"
    requirement: PERKS-01
    verification:
      - kind: unit
        ref: tests/unit/shell/ui-copy.test.ts#12-05 Account timeline and Perks copy
        status: pass
    human_judgment: false
  - id: D7
    description: "Perks says codes and IP addresses while Account timeline, Login history and HEAT keep their IP-only wording unchanged"
    requirement: PERKS-01
    verification:
      - kind: unit
        ref: tests/unit/shell/ui-copy.test.ts#the Perks mask set says codes AND addresses, and the IP-only set is untouched
        status: pass
    human_judgment: false
  - id: D8
    description: "No copy formatter in this plan takes an arbitrary zip entry name (T-12-15)"
    requirement: PERKS-01
    verification:
      - kind: unit
        ref: tests/unit/shell/ui-copy.test.ts#the Phase 12 block interpolates a NUMBER and nothing else (T-12-15)
        status: pass
    human_judgment: false
  - id: D9
    description: "The pane itself renders, and the builder wires the primitives to real columns and rows"
    verification: []
    human_judgment: true
    rationale: "Not built by this plan. It arrives with 12-11 (the worker builder) and 12-12 (the pane); this plan ships primitives only, so there is nothing yet to look at."

commits: 4
plan_head_before: 99ec8ecdfe749312c8211dd60e6cd8d50eab11bf
plan_head_after: 46a7c70be811890c6b3ad215b6d49d38096aea95

duration: 13min
completed: 2026-10-20
status: complete
---

# Phase 12 Plan 05: Account timeline primitives and pane copy Summary

**A pure cross-account merge keyed on the whole allowlisted column list, a tolerant four-shape date reader with a total newest-first comparator, a type-only timeline view contract, and every UI-SPEC string for the two panes pinned as a constant**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-20T07:49:42Z
- **Completed:** 2026-10-20T08:03:00Z
- **Tasks:** 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `mergeIdenticalAcrossAccounts` collapses rows only on full equality of the caller's column list and never collapses a repeat inside one account; the count it returns (`storedRows - rows.length`) is what the merge note will reconcile the stored-row headline against (D-10, D-11, D-12).
- `parseTimelineInstant` reads exactly the four shapes this plan owns — through the Playtime reader, so one range check serves every date in the app — and `compareTimelineKeys` makes the order total: newest first, undated last, then kind, file, account and input position. No `Date` is constructed anywhere in the module.
- `timeline-shared.ts` fixes the kinds, the file ids, the merged-file set and the entry/view shapes in one module with type-only imports, so plan 12-11's worker builder and plan 12-12's pane agree without depending on each other.
- The Phase 12 copy block lands with a Perks mask set that names codes as well as addresses, beside an untouched IP-only set, and a mechanical rule that no formatter in the block interpolates anything but a count.

## Task Commits

Each task was committed atomically (RED then GREEN):

1. **Task 1 RED: the merge, the contract and the comparator** - `d0011b1` (test)
2. **Task 1 GREEN: the cross-account merge, the timeline contract and the instant comparator** - `1e7470f` (feat)
3. **Task 2 RED: the Phase 12 pane copy block** - `b39fb20` (test)
4. **Task 2 GREEN: the Phase 12 pane copy, pinned** - `46a7c70` (feat)

**Plan metadata:** (see the final docs commit)

_Note: both tasks are `tdd="true"`, so each has a test commit followed by a feat commit. The vitest RED is a module-resolution failure, which `gsd-tools check tdd-red-evidence` cannot classify (`INVALID_RED` / `zero_tests_discovered`, the vitest limitation 04-01 recorded); the machine check that works here is `git log -E --grep="^test\\((0*12)-(0*05)\\):"`, which prints two commits._

## Files Created/Modified

- `src/lib/features/new-data/account-merge.ts` - the read-time cross-account merge and the no-merge path
- `src/lib/features/account-timeline/timeline-shared.ts` - the timeline view contract (type-only imports)
- `src/lib/features/account-timeline/timeline-instant.ts` - the four-shape instant parse and the newest-first comparator
- `src/lib/ui-copy.ts` - the Phase 12 pane copy block appended after the Phase 11 one
- `tests/unit/new-data/account-merge.test.ts` - 15 cases over the Behaviour block
- `tests/unit/account-timeline/timeline-instant.test.ts` - 18 cases, including a mixed-format chronology
- `tests/unit/shell/ui-copy.test.ts` - the 12-05 describe block (27 cases)

## Decisions Made

Recorded in the frontmatter; the two worth repeating:

- **The occurrence index is counted per group, not per account name.** With a per-account counter, a root that appears in two groups can never produce a repeated tag, so the "never list an account twice" guard would be unreachable code. Counting per group makes the guard a branch the `__proto__` and duplicate-account tests actually exercise.
- **`flattenGroups` returns the same `MergeResult` as the merge.** A builder for a file that never merges becomes a substitution rather than a second code path, and it reports `mergedAway: 0` truthfully, which is what keeps the merge note off the screen for a file with nothing to merge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two test expectations were wrong, not the implementation**
- **Found during:** Task 1 GREEN
- **Issue:** Two hand-written expectations contradicted `parseSessionTimestamp` and the comparator's own contract. The first asserted that a fractional second adds 250 to the instant, when the shared Playtime reader accepts a fraction and truncates to the second (a pre-existing rule, and the right one — a fraction moves neither the day nor the hour either timestamp is bucketed by). The second asserted that two keys differing only in `sequence` compare equal, which is the opposite of what "returns 0 only for the same key" requires.
- **Fix:** Corrected both expectations and documented the fraction truncation in the test, so the rule is written down rather than merely satisfied.
- **Files modified:** tests/unit/account-timeline/timeline-instant.test.ts
- **Verification:** `pnpm exec vitest run tests/unit/new-data/account-merge.test.ts tests/unit/account-timeline/timeline-instant.test.ts` — 33 passed
- **Committed in:** `1e7470f`

**2. [Rule 3 - Blocking] A literal NUL byte was written into the source**
- **Found during:** Task 1 GREEN
- **Issue:** The merge key separator was written as a raw control character. `grep` then treated the whole module as binary and every future source scan, diff and review tool over it would misbehave silently.
- **Fix:** Rewritten as the `'\u0000'` escape, which is the same byte with the same guarantee (JSON text can never contain it, so no cell can forge the boundary between a signature and its occurrence index).
- **Files modified:** src/lib/features/new-data/account-merge.ts
- **Verification:** `grep -n KEY_SEPARATOR src/lib/features/new-data/account-merge.ts` matches; the module is plain text again
- **Committed in:** `1e7470f`

---

**Total deviations:** 2 auto-fixed (1 bug in my own test expectations, 1 blocking source-encoding issue)
**Impact on plan:** Neither changed scope or behaviour. Both were caught inside the plan's own verify step, before the task commit.

## Issues Encountered

- **The TDD source-shape scan initially passed vacuously.** The test stripped comments from the whole file and *then* searched for the block header — which is itself a comment, so `indexOf` returned `-1` and the scan read the last character of the file, finding zero template literals. The assertion `templates.length > 0` caught it. Fixed by slicing the block out first and stripping comments inside it, which is also the order the reveal-state precedent uses.
- **`gsd-tools check tdd-red-evidence` cannot classify a vitest RED**, as 04-01 recorded. Both REDs are genuine (module-not-found, and 27 failing copy pins) and are visible in the two `test(12-05):` commits.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. `TIMELINE_MERGED_FILES` names the two timeline files that merge; the third merge-eligible file D-10 names (Subscriptions) belongs to the Perks pane and is not this pane's business. `timeline-shared.ts` deliberately carries no column names and no date parsing — those arrive from the Wave 0 capture with plan 12-11.

## Requirements

**No requirement was marked complete.** The plan frontmatter lists `TIMELINE-01, TIMELINE-02, PERKS-01, SCALE-01`; all four read "is shown", and this plan shows no pane. It ships the primitives those panes will be built from. This is the same call 12-02, 12-03 and 12-04 made, and for the same reason: a ledger entry that claims a user-visible pane exists would be false. Re-run `requirements.mark-complete` for all four after 12-09 (Perks) and 12-12 (Account timeline) land. Recorded in `.planning/WINDOWS.md`.

## Next Phase Readiness

- **12-11** (worker builder) can `import` the merge, the contract and the comparator without redefining any of them. It owns the file-to-column mapping from the capture, and it owns widening `parseTimelineInstant` for any per-file date shape the capture records that none of this plan's four covers.
- **12-12** (the pane) can render `TimelineEntryView` and read every string from `ui-copy.ts`.
- **12-09** (the Perks pane) reads `formatMergeNote`, `PERKS_CARD_TITLES` and the `PERKS_MASK_*` set; `formatNewDataCard`'s builder is the one consumer of `flattenGroups` in the Subscriptions path.
- **Blocker for 12-11:** the four date shapes are this plan's whole vocabulary. If the header capture records a shape outside them (no seconds on an ISO stamp, a numeric offset, another field order), the user reports one shape per timeline date column at that plan's checkpoint and the parser is widened there — not silently here.

---
*Phase: 12-account-timeline-perks*
*Completed: 2026-10-20*

## Self-Check: PASSED

- All six created/modified source and test files exist on disk.
- All four task commits (`d0011b1`, `1e7470f`, `b39fb20`, `46a7c70`) are ancestors of HEAD.
