---
phase: 12-account-timeline-perks
plan: 02
subsystem: worker-data-channels
tags: [surveys, perks, allowlist, family-category, data-channel, pane-order, d-01, d-03, d-08, t-12-04, t-12-06, t-12-07]
requires:
  - phase: 11-new-game-data
    provides: "the per-file column allowlist (specFor/projectRow/fileMatchesSpec), the presence facts (stored vs parsed), the new-data pane contract and the four-state card view"
provides:
  - FAMILY_CATEGORIES
  - isFamilyCategory
  - "the heat_surveys.csv spec (QUESTION_ID, SKIPPED_BY_PLAYER, MESSAGE_TS)"
  - "the Surveys folder promoted to SUPPORTED"
  - PERKS_CARD_IDS
  - PERKS_CARD_FILES
  - PerksCardId
  - PerksView
  - buildPerksView
  - "the perks data channel"
  - "the perks pane id in the shell model"
  - "an explicit PANE_ORDER tuple"
  - formatPerksRowSummary
affects: [12-01, 12-03, 12-04, 12-08, 12-09, 12-10, 12-11]
tech-stack:
  added: []
  patterns:
    - "a family test has two halves: the file NAME and the CATEGORY. A folder that opts in makes EVERY file in it fail closed, so a freshly promoted folder can never store an unknown file raw."
    - "a field-less data channel accepts EXACTLY the one own field `channel`; every other field is rejected rather than ignored, so a smuggled field can never start being trusted by accident."
    - "an optional pane's row summary is chosen by a switch with a never-typed default, so a fifth optional pane is a type error rather than a borrowed sentence."
    - "an optional pane's file list is COMPUTED from its card contract, so the pane table and the card map cannot drift apart."
key-files:
  created:
    - tests/unit/import/perks-worker.test.ts
  modified:
    - src/lib/worker/categories.ts
    - src/lib/worker/new-data-allowlist.ts
    - src/lib/worker/new-data-specs.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/worker/data-queries.ts
    - src/lib/core/types/worker-messages.ts
    - src/lib/features/new-data/new-data-shared.ts
    - src/lib/features/new-data/new-data-aggregate.ts
    - src/lib/shell/selection-state.ts
    - src/lib/ui-copy.ts
decisions:
  - "The Perks card contract sits ABOVE the pane tables in new-data-shared.ts, because NEW_DATA_PANE_FILES.perks is COMPUTED from PERKS_CARD_FILES. One table (the card map) is then the only place a later plan edits when the Wave 0 capture names the other three files, and the two cannot drift."
  - "A field-less channel now accepts EXACTLY the one own field `channel`. The plan said `isDataQuery` needed no change, believing the generic predicate already rejected every extra field; it rejected only `title` and `battleType`. The must-have and the T-12-06 mitigation both say 'any other field is rejected', so the predicate was tightened to match. It is a fail-closed change and no caller sends an extra field."
  - "PERKS-03 is NOT marked complete: it reads 'Surveys are shown' and this plan shows no pane - the Dashboard has no Perks branch until plan 12-09. PRIV-01 was already Complete from phase 11. This follows the 11-02/11-03/11-07 precedent."
  - "The plan's must-have calls Perks 'the fourth optional pane' while its own action and acceptance criteria say OPTIONAL_PANE_IDS equals heat, warships-storage, perks. The action was followed (three optional panes); the fourth is the Account timeline pane, which plan 12-11 adds."
  - "The ui-copy label table's completeness pins are keyed on the PANE file set, so the Surveys file and column labels were added in Task 1 together with a LABELLED_FILES union (pane files + Perks card files) in the ui-copy test. The union is the same set before and after plan 12-11's Account timeline pane, so it does not need a second edit."
requirements-completed: []
actuals:
  tokens: 22097
  tasks: 2
  commits: 3
coverage:
  - id: D1
    description: "A category-scoped family rule: every file in the Surveys folder is a family file, and a family file with no spec, with a spec of another category, or with no matching header stores NOTHING."
    requirement: PERKS-03
    verification:
      - kind: unit
        ref: "tests/unit/import/new-data-allowlist.test.ts#isFamilyCategory: the CATEGORY half of the family test (12-02, T-12-04)"
        status: pass
      - kind: unit
        ref: "tests/unit/import/perks-worker.test.ts#the worker: every file in the Surveys folder fails closed"
        status: pass
    human_judgment: false
  - id: D2
    description: "The heat_surveys.csv spec stores exactly QUESTION_ID, SKIPPED_BY_PLAYER and MESSAGE_TS; PROFILE_ID, BATTLE_ID and PLAYER_ANSWER are excluded by omission, and no canary reaches IndexedDB or the stored meta."
    requirement: PRIV-01
    verification:
      - kind: unit
        ref: "tests/unit/import/perks-worker.test.ts#the worker: a Surveys file is stored through the allowlist only"
        status: pass
      - kind: unit
        ref: "tests/unit/import/new-data-allowlist.test.ts#the spec table: every stored column is evidence-backed"
        status: pass
    human_judgment: false
  - id: D3
    description: "The perks data channel answers four cards in the fixed order Subscriptions, Personal coupons, Bonus codes, Surveys; a field-less query accepts a bare query and rejects every smuggled field with the fixed `invalid query` detail."
    requirement: PERKS-03
    verification:
      - kind: unit
        ref: "tests/unit/import/perks-worker.test.ts#the perks channel is a strict field-less query (T-12-06)"
        status: pass
      - kind: unit
        ref: "tests/unit/import/perks-worker.test.ts#the worker: the perks channel answers four ordered cards"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Perks list row: it exists only when result.newDataPanes names it, it sits between Payments and Device info in an EXPLICIT PANE_ORDER tuple, and its summary is its own."
    requirement: PERKS-03
    verification:
      - kind: unit
        ref: "tests/unit/shell/selection-state.test.ts#a Perks pane renders between Payments and Device info, with its OWN summary"
        status: pass
      - kind: unit
        ref: "tests/unit/shell/selection-state.test.ts#each optional pane produces its OWN summary, and never another pane's"
        status: pass
      - kind: unit
        ref: "tests/unit/import/perks-worker.test.ts#the worker: the Perks pane fact reaches the list"
        status: pass
    human_judgment: false
  - id: D5
    description: "The published pane facts carry two integers per pane and nothing else, so no file name, category, account root or cell crosses the worker boundary."
    requirement: PRIV-01
    verification:
      - kind: unit
        ref: "tests/unit/import/new-data-facts.test.ts#12-02 - newDataPaneFacts, the one pane derivation"
        status: pass
    human_judgment: false
metrics:
  duration: 25min
  completed: 2026-10-20
status: complete
commits: 3
plan_head_before: 155b495b7b094fe0998313c766c501d57fcf539c
plan_head_after: 7146585c0eea4f9ffa929e2c9bf7d783b9aae6c1
---

# Phase 12 Plan 02: The Surveys slice Summary

The `Surveys` folder is promoted and gated behind a category-scoped fail-closed family rule: a `HEAT_Surveys.csv` reaches IndexedDB under three spec keys only, a file the folder does not know stores nothing, and the new `perks` channel answers four ordered cards from one Dexie snapshot.

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-20T06:28:42Z
- **Completed:** 2026-10-20T06:58:00Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments

- **`Surveys` promoted with a category-scoped family rule.** `FAMILY_CATEGORIES` and `isFamilyCategory` are the SECOND half of the family test: the first half is the file NAME, and a freshly promoted folder is a container whose contents the app has not seen, so a name-only rule left a hole in it. A file in a family category is a family file whatever its name, and a family file with no spec, with a spec of another category, or with no matching header stores NOTHING (T-12-04, 12-RESEARCH Finding 2).
- **One verified spec, three columns.** `heat_surveys.csv` stores `QUESTION_ID`, `SKIPPED_BY_PLAYER` and `MESSAGE_TS` and nothing else. `PROFILE_ID`, `BATTLE_ID` and `PLAYER_ANSWER` are excluded by omission, and `PLAYER_ANSWER` is excluded by DEFAULT because names alone cannot show whether it is an enumerated rating or free text (D-01, D-03, PRIV-01).
- **The `perks` channel, answered from the same snapshot as every other channel.** Four cards in the fixed order Subscriptions, Personal coupons, Bonus codes, Surveys (D-08). Three of them name no file yet - their names come from the Wave 0 capture (plan 12-01) and are written into the contract by plan 12-08 - so they answer `not-in-export`, which is the honest answer for an export that holds no such file.
- **The shell leg, with the two structural traps closed.** `PANE_ORDER` is an explicit twelve-entry tuple (Perks between Payments and Device info), and `optionalPaneEntry` chooses its summary with a `never`-exhaustive switch, so a fifth optional pane is a type error rather than a pane that silently borrows the Warships sentence (12-RESEARCH Pitfalls 5 and 6).
- **One end-to-end proof.** `tests/unit/import/perks-worker.test.ts` builds its own archive with a canary in each excluded column and drives the real worker, the real Dexie and the real channel, asserting the four card states and that no canary is at rest.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "Surveys" slice - promoted folder, category-scoped fail-closed family, allowlisted rows, perks channel proved through the real worker** - `60ad8a5` (feat)
2. **Task 2: The shell leg - perks becomes the fourth optional pane, explicit PANE_ORDER, exhaustive row summary, pane facts and list row** - `df76f61` (feat)
3. **Task 2 follow-up: the three e2e pane-order pins the new tuple makes false** - `7146585` (test)

## Files Created/Modified

- `src/lib/worker/new-data-allowlist.ts` - `FAMILY_CATEGORIES` and `isFamilyCategory`: the category half of the family test
- `src/lib/worker/new-data-specs.ts` - the `heat_surveys.csv` spec, and the two header comments that said the file had no entry
- `src/lib/worker/categories.ts` - `Surveys` in `SUPPORTED`, with the paragraph that says what a promotion does and does not change
- `src/lib/worker/ingest.worker.ts` - the choke point decides `family` from the NAME or the CATEGORY
- `src/lib/worker/data-queries.ts` - the `perks` channel entry and case; the generic validator tightened
- `src/lib/core/types/worker-messages.ts` - the `perks` `DataQuery` and `DataResult` members
- `src/lib/features/new-data/new-data-shared.ts` - `PERKS_CARD_IDS`, `PERKS_CARD_FILES`, `PerksView`, and the `perks` pane id
- `src/lib/features/new-data/new-data-aggregate.ts` - `buildPerksView`
- `src/lib/shell/selection-state.ts` - the explicit `PANE_ORDER`, `PANE_SECTION.perks` and the exhaustive summary switch
- `src/lib/ui-copy.ts` - `PANE_TITLES.perks`, `formatPerksRowSummary`, `NEW_DATA_PROVENANCE_LABELS.perks`, the Surveys file and column labels
- `tests/unit/import/perks-worker.test.ts` - the end-to-end proof (new)
- `tests/unit/import/new-data-allowlist.test.ts`, `new-data-narrow.test.ts`, `new-data-facts.test.ts`, `data-query-worker.test.ts` - the pins this makes false
- `tests/unit/shell/selection-state.test.ts`, `list-pane-optional.test.ts`, `overview-model.test.ts`, `ui-copy.test.ts` - the pane vocabulary and the copy
- `tests/e2e/guards/zero-network.spec.ts`, `import/import-flow.spec.ts`, `shell/dashboard.spec.ts`, `shell/master-detail-nav.spec.ts` - the walked list is one row shorter than `PANE_ORDER` while no fixture holds a Surveys file

## Decisions Made

- **The Perks card contract sits above the pane tables.** `NEW_DATA_PANE_FILES.perks` is COMPUTED from `PERKS_CARD_FILES`, so the pane's files and the cards' files cannot drift and one table is the only place plan 12-08 edits. The computation is a module-level `const`, so the contract block has to be declared before the pane tables - which is why it sits at the top of `new-data-shared.ts` rather than beside the other card tables.
- **`isDataQuery` was tightened rather than left as it was.** See deviation 1 below.
- **PERKS-03 is not marked complete.** See "Issues Encountered".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The generic query validator did not reject every extra field**
- **Found during:** Task 1 (the perks channel)
- **Issue:** The plan's must-have and its T-12-06 mitigation both say a field-less channel "rejects every extra field", and the plan asserted that `isDataQuery` already did. It did not: the non-vehicles branch was `!('title' in query) && !('battleType' in query)`, so `{ channel: 'perks', rows: 3 }` was ACCEPTED. The plan's Task 1 action said "`isDataQuery` needs no change (it is generic)" - the planner's belief about the code was wrong, and the must-have it contradicted is the contract.
- **Fix:** The non-vehicles branch now accepts a query with EXACTLY one own key, `channel`. Every other field - a `title`, a `battleType` or anything at all - is rejected, and the worker answers the fixed `invalid query` detail. It is a fail-closed change: no caller sends an extra field (every page-side query in `src/lib` is a bare `{ channel }`).
- **Files modified:** `src/lib/worker/data-queries.ts`
- **Verification:** `tests/unit/import/perks-worker.test.ts` pins the accept case and five reject cases; the whole unit suite and the whole e2e suite stay green.
- **Committed in:** `60ad8a5` (Task 1 commit)

**2. [Rule 1 - Bug] The narrowing step's own test helper filed every spec's legacy row in the wrong folder**
- **Found during:** Task 1 (the `heat_surveys.csv` spec)
- **Issue:** `tests/unit/import/new-data-narrow.test.ts`'s `legacySpecRow` helper filed a spec's legacy row under `Activity_History` or `Player_Statistics`, never under the spec's own category. Adding the `surveys` spec made the helper file the Surveys row under `Player_Statistics`, where `specFor` finds no spec - so the narrowing step DELETED the row instead of narrowing it, and the "narrows EVERY entry of the spec table" case failed.
- **Fix:** The helper now maps the spec's own category to the folder the capture filed it in (`activity_history` -> `Activity_History`, `surveys` -> `Surveys`, else `Player_Statistics`). The test's claim is unchanged and still true: every spec entry is narrowed.
- **Files modified:** `tests/unit/import/new-data-narrow.test.ts`
- **Verification:** `pnpm run test:unit` - 3745 passed.
- **Committed in:** `60ad8a5` (Task 1 commit)

**3. [Rule 3 - Blocking] The broken-windows ledger was malformed and would not accept an entry**
- **Found during:** the SUMMARY step (recording this plan's known stub)
- **Issue:** `.planning/WINDOWS.md`'s fenced JSON block was never closed, so `gsd_run windows append` failed with "Ledger JSON code block not terminated"; and once the fence was restored, the rendered table row 18 disagreed with the JSON entry 18 (a hand-edit of one of the two).
- **Fix:** The missing closing fence was restored, and the rendered table row 18 was regenerated from the JSON block, which the tool names as the sole source of truth.
- **Files modified:** `.planning/WINDOWS.md`
- **Verification:** `gsd_run windows append` now writes (entries 19 and 20) and re-renders the table from the JSON.
- **Committed in:** the plan metadata commit

**4. [Rule 1 - Bug] Three e2e specs walked a list that is one row shorter than `PANE_ORDER`**
- **Found during:** Task 2 (the explicit `PANE_ORDER`)
- **Issue:** The e2e suite walked `PANE_ORDER.filter((id) => id !== 'heat')` and iterated `OPTIONAL_PANE_IDS` to open every optional pane. Neither fixture holds a Surveys file, so the worker publishes no Perks pane and there is no Perks row: the walked list is one row shorter than `PANE_ORDER`, and the zero-network guard tried to click a row that is not on screen.
- **Fix:** The three walks and the one guard now exclude `perks`, each with a comment saying why (the Perks pane arrives with plan 12-09).
- **Files modified:** `tests/e2e/shell/master-detail-nav.spec.ts`, `tests/e2e/shell/dashboard.spec.ts`, `tests/e2e/import/import-flow.spec.ts`, `tests/e2e/guards/zero-network.spec.ts`
- **Verification:** the whole e2e suite - 263 passed.
- **Committed in:** `7146585`

---

**Total deviations:** 4 auto-fixed (1 missing critical, 2 bugs, 1 blocking)
**Impact on plan:** All four auto-fixes were necessary to reach the plan's own stated must-haves and to keep the suite green. No scope creep: the validator tightening is the plan's T-12-06 mitigation made true, the narrowing-test fix is a helper, and the ledger and e2e fixes are maintenance of artifacts the plan's own change invalidates.

## Issues Encountered

- **The plan's must-have and its own action step disagreed about the validator.** Resolved in favour of the must-have (deviation 1): the must-have and the T-12-06 mitigation both name "any other field", and the action step's premise about the existing code was wrong.
- **The plan's must-have calls Perks "the fourth optional pane" while its action and acceptance criteria say `OPTIONAL_PANE_IDS` equals `heat, warships-storage, perks`.** The action and the acceptance criteria were followed - three optional panes. The fourth is the Account timeline pane, which plan 12-11 adds; the wording is a planner slip and is recorded here rather than silently resolved.
- **PERKS-03 is NOT marked complete.** It reads "Surveys are shown" and this plan shows no pane: the Dashboard has no Perks branch until plan 12-09, and the three unknown card files are still `null`. PRIV-01 was already Complete from phase 11. This follows the 11-02/11-03/11-07 precedent, and the decision is recorded in the windows ledger (entry 20) so the ship gate sees it.
- **The plan's Task 1 action put the Surveys file and column labels in `ui-copy.ts`, but that table's completeness pins are keyed on the PANE file set** - and `heat_surveys.csv` is not a pane file until Task 2. The labels were added in Task 1 as planned, and the `ui-copy` test now derives the labelled set as the union of the pane files and the Perks card files, which is the same set before and after Task 2. No test is red at any commit.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `PERKS_CARD_FILES.subscriptions` is `null` | `src/lib/features/new-data/new-data-shared.ts` | 61 | The file name comes from the Wave 0 header capture (plan 12-01) and is written into the contract by plan 12-08. The card answers `not-in-export`, which is true of an export that holds no such file. |
| `PERKS_CARD_FILES.coupons` is `null` | `src/lib/features/new-data/new-data-shared.ts` | 62 | As above - `Personal_Coupons.csv`. |
| `PERKS_CARD_FILES.bonusCodes` is `null` | `src/lib/features/new-data/new-data-shared.ts` | 63 | As above - `Bonus_Codes.csv`. |

The three are intentional, are named in `12-02-PLAN.md` Task 1, and are recorded in `.planning/WINDOWS.md` (entry 19). Plan 12-08 replaces them with the captured names; the three cards then answer from real data.

## Threat Flags

None. The new surface is the `perks` channel, the `FAMILY_CATEGORIES` rule and the Perks pane id - all three are named in the plan's own threat register (T-12-04, T-12-05, T-12-06, T-12-07) and are mitigated as it describes. The one change to an existing boundary (the tighter `isDataQuery`) narrows it rather than widening it, and is recorded as deviation 1.

## Self-Check: PASSED

- FOUND: `tests/unit/import/perks-worker.test.ts`, `src/lib/worker/new-data-allowlist.ts`, `src/lib/worker/new-data-specs.ts`, `src/lib/features/new-data/new-data-shared.ts`, `src/lib/features/new-data/new-data-aggregate.ts`, `src/lib/shell/selection-state.ts`, `src/lib/ui-copy.ts`
- FOUND commits: `60ad8a5` (Task 1), `df76f61` (Task 2), `7146585` (the e2e pin flips)
- `pnpm run test:unit` - 3745 passed; `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` - clean; `pnpm exec playwright test` - 263 passed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The three card files are the only thing standing between this slice and a full Perks pane.** Plan 12-01 captures the real headers; plan 12-08 writes the three names into `PERKS_CARD_FILES`, and the pane's file list and the channel's table follow automatically because both are computed from it.
- **The Perks detail pane is not rendered.** The Dashboard has no Perks branch until plan 12-09, so a Perks row selected before that falls through to the Not yet supported block. This is a transitional state inside one unreleased phase branch, and plan 12-09 closes it.
- **The Account timeline pane is the fourth optional pane** and joins the list directly above `account` in plan 12-11 - a `PANE_ORDER` edit plus one more case in the `optionalPaneEntry` switch, which is now exhaustive by construction.
- **The `PLAYER_ANSWER` decision is still open.** It is excluded by default (fail-closed, and free to narrow); widening it costs a cache rebuild, so the Wave 0 answer decides it.

---

*Phase: 12-account-timeline-perks*
*Completed: 2026-10-20*
