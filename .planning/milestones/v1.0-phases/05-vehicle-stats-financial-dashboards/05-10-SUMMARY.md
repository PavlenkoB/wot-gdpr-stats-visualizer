---
phase: 05-vehicle-stats-financial-dashboards
plan: 10
subsystem: ui
tags: [svelte-5-runes, premium, dexie-query-client, aria-live, playwright, data-absence]

# Dependency graph
requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: "05-07 the four-channel QueryClient, the per-channel supersede rule and the presence facts; 05-08 the whole Phase 5 copy inventory in ui-copy.ts; 05-05/05-01 the PremiumView builder and the hand premium fixture"
provides:
  - "src/lib/finance-state.ts — BlockState, ViewStatus, ShownBlock<V>, ViewOf<C>, deriveFinanceState, acceptDataOutcome, premiumFigures; pure, no Svelte, no ui-copy, no DOM"
  - "src/lib/components/PremiumBlock.svelte — the Premium time sub-block: six states, the summary sentence, the excluded pill, the unrecognised-strings disclosure; test ids premium-block, premium-summary, premium-excluded, premium-unrecognised"
  - "src/lib/components/FinancialData.svelte — the Financial_data card body, one 24px column hosting the Premium block (Currency joins it in 05-13)"
  - "ExcludedNotice generalised with optional pill, explanation and testId props, Phase 4 defaults preserved"
  - "BUILT_DASHBOARDS now holds financial-data, and the flip is pinned by its own unit test plus a re-asserted DATA-04 guard"
  - "tests/e2e/helpers.ts — premiumBlock, currencyBlock, spendBlock, playerStatsBlock, financialSection, all five in one commit"
  - "tests/unit/finance-state.test.ts (18 tests), tests/unit/finance-blocks.test.ts (9 source-contract tests), tests/e2e/finance.spec.ts (6 browser tests)"
  - "The generalised patterns 05-11, 05-12, 05-13 and 05-15 extend: the section flip, the per-sub-block state machine, the shared notice, the shared locators, the stale-answer discipline"
affects: [05-vehicle-stats-financial-dashboards, currency-block, vehicle-table, spend-block, uat]

actuals:
  tokens: 26878
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []

key-files:
  created:
    - src/lib/finance-state.ts
    - src/lib/components/PremiumBlock.svelte
    - src/lib/components/FinancialData.svelte
    - tests/unit/finance-state.test.ts
    - tests/unit/finance-blocks.test.ts
    - tests/e2e/finance.spec.ts
  modified:
    - src/lib/dashboard-status.ts
    - src/lib/components/Dashboard.svelte
    - src/lib/components/ExcludedNotice.svelte
    - tests/unit/dashboard-status.test.ts
    - tests/e2e/helpers.ts
    - tests/e2e/dashboard.spec.ts
    - tests/e2e/import-flow.spec.ts

key-decisions:
  - "One key, not two: a Financial sub-block's identity is the primitive importedAt alone. Phase 4's playtime block needs a second key (the requested slice) so a selection change is `updating` rather than a flash of the old slice; a Financial sub-block has no control that asks for a different slice of the same dataset, so `updating` is NOT a state here and a second key would be a key with one possible value. The vehicles block does have a title selector and owns its own `updating` state, which is why ViewOf and deriveFinanceState's constraint admit the three finance channels and not vehicles (VehicleView carries titleState, not status)."
  - "No reset on replace. `shown` is stamped with the dataset it answers for and is deliberately NOT cleared when the dataset changes; deriveFinanceState compares the stamp, so a replace that lands mid-query returns the block to `loading` by construction. A hand-written reset would be a second place for D-28 to live, and the place to forget it."
  - "The effect depends on the primitive importedAt and nothing else, so a duplicate drop that swaps the result OBJECT for an identical one does not re-query at all (T-05-30). The client handle is read inside untrack, or writing `shown` would re-run the query that produced it."
  - "premiumFigures imports no copy. Its return type is declared in finance-state.ts rather than imported from ui-copy, so a decision module cannot reach a wording change and a state test cannot break on one. The two shapes are structurally compatible rather than nominally linked, and the compatibility is PROVEN in the unit test by passing the result to the formatter the component passes it to."
  - "The notice and the disclosure are rendered ONCE in PremiumBlock, gated on the two states that can have exclusions, rather than inside two branches of the state chain. One rendering of the markup is one place for the list to be correct."
  - "The ExcludedNotice generalisation takes optional pill/explanation/testId rather than a `noun` prop. Each block's pill sentence is copy the 05-08 inventory already owns and tests, and a component assembling them would be a second place for that wording to live."
  - "The notice's {#if} tests the RESOLVED pill, not `count`, so a caller passing formatXExcludedPill(0) gets nothing and the zero case is unrepresentable from outside."
  - "The listed strings are unkeyed in the each block. The worker ships distinct strings so a key would work, and would throw on a duplicate the day that stopped being true, inside a block rendering a user's own export. The list never reorders, so a key buys nothing."

patterns-established:
  - "The three-step block wiring: ask in one $effect keyed on the primitive dataset id, decide in a pure module, render in a component. A component holds no decision, so every failure mode of a block is a unit test rather than a browser assertion."
  - "shown/sent pairs stamped with the dataset identity they belong to, where accepting an answer is a pure function over (outcome, channel, askImportedAt, currentImportedAt) and a reject is null, never a throw (D-21)."
  - "The source-contract test for wiring a component that Vitest cannot render: read the source off disk LAZILY (a missing file reads as ''), strip every comment form before asserting a prohibition, and assert the prohibitions as a table so a new component inherits them by adding its name to a list."
  - "All Phase 5 e2e locators land in ONE commit in helpers.ts, so the later plans in the same wave never edit a test helper concurrently."

requirements-completed: [FINANCE-01]

coverage:
  - id: D1
    description: "The Financial_data card is ready and renders a Premium time block that asks the worker for the premium channel through the channel-scoped QueryClient, keyed on the primitive importedAt, so a duplicate drop does not re-query and a replaced dataset never shows the previous dataset's numbers."
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: tests/unit/finance-state.test.ts#describe acceptDataOutcome
        status: pass
      - kind: unit
        ref: tests/unit/finance-state.test.ts#an answer for a dataset that is no longer on screen is dropped
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/finance.spec.ts#05-10 premium time: a file that is absent and a file with no rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "The block is its own state machine with data-state loading, ready, not-in-export, no-rows, no-usable or error, each decided by the pure module; a stale or superseded answer is dropped and the worker's error detail is never rendered."
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: tests/unit/finance-state.test.ts#describe deriveFinanceState
        status: pass
      - kind: unit
        ref: tests/unit/finance-state.test.ts#an error outcome becomes a failed block that carries no detail
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/finance.spec.ts#(states) reads two different sentences, and the replace moves between them"
        status: pass
    human_judgment: false
  - id: D3
    description: "An absent file and a present header-only file read different sentences inside a card that stays ready, and a Financial_data-free export greys the card with no sub-block at all."
    requirement: FINANCE-01
    verification:
      - kind: e2e
        ref: "playwright: tests/e2e/finance.spec.ts#(no-folder) the greyed card and no premium block anywhere on the page"
        status: pass
      - kind: unit
        ref: tests/unit/dashboard-status.test.ts#an empty or absent Financial_data is still empty or no-export, never ready
        status: pass
    human_judgment: false
  - id: D4
    description: "The ready block states the summary sentence from the worker's months — months with grants out of the span, total days, grants, and the largest month — with the day unit keyed on the rendered numeral."
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: tests/unit/finance-state.test.ts#the figures are accepted by the copy formatter unchanged
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/finance.spec.ts#(tracer) the card is ready and the block renders the fixture sentence"
        status: pass
    human_judgment: false
  - id: D5
    description: "Excluded rows are counted in the amber pill, which never renders at zero, and the distinct strings that were not charted are listed in a native disclosure capped at 20 with an and-k-more line; withdrawal rows are excluded, counted and listed, and a row excluded only for an unreadable date is counted and lists nothing."
    requirement: FINANCE-01
    verification:
      - kind: e2e
        ref: "playwright: tests/e2e/finance.spec.ts#(excluded) the sample shows the pill and the two strings that were not charted"
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/finance.spec.ts#(overflow) twenty-five distinct strings list twenty and then \"and 5 more\""
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/finance.spec.ts#(date-only) rows excluded for an impossible date are counted but not listed"
        status: pass
    human_judgment: false
  - id: D6
    description: "ExcludedNotice is shared rather than copied: it takes the pill text, explanation and test id as optional props defaulting to the Phase 4 values, so the playtime caller and every Phase 4 spec are unchanged and it still renders nothing for an empty pill."
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: tests/unit/finance-blocks.test.ts#the Phase 4 callers pass only count and are otherwise untouched
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/uat-criteria.spec.ts#UAT-1 (asserts Phase 4's playtime-excluded notice)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Untrusted premium strings render as plain text only, never as markup and never into an attribute; the block adds no aria-live region, so the page-wide live-region count another spec asserts is unchanged."
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: tests/unit/finance-blocks.test.ts#describe what neither component may contain
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/dashboard.spec.ts#(single-live-region) the notice slot is the page's only aria-live region and nests no status role"
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/dashboard.spec.ts#(slim-variant) (asserts the page carries exactly two [aria-live] elements after import)"
        status: pass
    human_judgment: false

# Metrics
duration: 42min
completed: 2026-10-01
status: complete
---

# Phase 5: Vehicle Stats & Financial Dashboards — Plan 10 Summary

**The Financial_data card turned `ready` with a Premium time sub-block that asks the worker for the `premium` channel, states its own six states, and discloses the seven rows it could not chart and the two strings it could not read.**

## Performance

- **Duration:** 42 min (23:33 → 00:15 EEST, wall clock across the session)
- **Started:** 2026-10-01T23:41:09+04:00
- **Completed:** 2026-10-01T23:59:04+04:00
- **Tasks:** 3
- **Files modified:** 13 (12 of the plan's 12 declared, plus one comment correction)

## Accomplishments

- **The first Financial_data row on the screen, end to end.** A posted `premium` query, an answer admitted only if it belongs to the dataset on screen, and a rendered summary sentence. The sample export reads "Premium time was granted in 4 of 5 months: 53 days in total across 11 operations. The largest month was 2019-05 with 31.5 days." — computed in Node from the 05-01 hand fixture through the same `ui-copy` formatter the component uses, never scraped from the page.
- **D-28 holds by construction rather than by discipline.** `deriveFinanceState` reads one key. A replace that lands mid-query returns the block to `loading` because the answer's stamp no longer matches, and there is no reset to forget. A browser test proves it: the absent-file case reads `not-in-export`, a replace with a header-only file reads `no-rows`, and the exact-text assertion is what distinguishes the two from a stale value.
- **The worker's `detail` can no longer reach the DOM.** `acceptDataOutcome` turns an error outcome into a two-field `failed` block and the unit test asserts it field-for-field, so a later "just pass it through" fails rather than shipping a file path into a paragraph.
- **One excluded notice for four blocks, and Phase 4 untouched.** `ExcludedNotice` takes optional `pill`, `explanation` and `testId`; both playtime callers still pass `count` alone and `git diff` on them is empty. The zero case moved from a rule each caller must remember to a resolved-pill test the notice owns.
- **The truncation is honest.** Twenty-five distinct junk strings list twenty under a heading that counts all twenty-five, then an "and 5 more" line styled apart from the values so it is not copied out as a premium string. A row dropped for an impossible date is counted and lists nothing at all — the disclosure is absent, not empty.
- **The flip is pinned by tests that had to be written to fail.** `BUILT_DASHBOARDS` gained `financial-data` in the same commit as the block, with DATA-04 re-asserted for the new id so an absent or header-only `Financial_data` is still `no-export`/`empty` and never `ready`.

## Task Commits

Each task was committed atomically:

1. **Task 1: the status flip, the pure state module and the block's six states** - `c0a2cb4` (feat)
2. **Task 2: the shared e2e locators, the premium browser specs and the dashboard migration** - `8c994e6` (test)
3. **Task 3: the generalised notice, the excluded pill and the unrecognised-strings list** - `83eb18a` (feat)
4. **follow-up: D-06's no-collapse-control claim, narrowed** - `687b36b` (test) — deviation 1

## Files Created/Modified

- `src/lib/finance-state.ts` - **new.** `BlockState`, `ViewStatus`, `ShownBlock<V>`, `ViewOf<C>`, `deriveFinanceState`, `acceptDataOutcome`, `premiumFigures`. Pure: no Svelte, no `ui-copy`, no DOM, which is the only reason the block's decisions are testable under the repo's jsdom-free Vitest.
- `src/lib/components/PremiumBlock.svelte` - **new.** The Premium time sub-block. Six states, the summary sentence, the excluded pill, the native `details` disclosure. Mirrors `Playtime.svelte`'s rune patterns exactly.
- `src/lib/components/FinancialData.svelte` - **new.** The card body: one 24px column, `min-width: 0`, hosting the Premium block. The Currency block joins it as a SIBLING in 05-13.
- `src/lib/components/ExcludedNotice.svelte` - **modified.** Three optional props, Phase 4 defaults preserved, markup and every style rule unchanged. Its `{#if}` now tests the resolved pill.
- `src/lib/dashboard-status.ts` - **modified.** `BUILT_DASHBOARDS` holds `activity-history` and `financial-data`, with a doc comment naming the plan that added each id and the three that remove theirs.
- `src/lib/components/Dashboard.svelte` - **modified.** The `financial-data` branch, passing `ingestClient.data` — the channel-scoped client, so the currency block joining in 05-13 cannot starve the premium query.
- `tests/unit/finance-state.test.ts` - **new.** 18 tests. The premium view is built through the real parser and the real builder, so the numbers are the ones an import produces.
- `tests/unit/finance-blocks.test.ts` - **new.** 9 source-contract tests: the three props and their defaults, the prohibitions as a table (`{@html`, inline style attribute, `style:`, `aria-live`, `addEventListener`), the two test hooks, the native `details`, and the Phase 4 callers passing only `count`.
- `tests/unit/dashboard-status.test.ts` - **modified.** The built set is named per section, `financial-data` moved out of the pending loop, and DATA-04 re-asserted for the new id.
- `tests/e2e/helpers.ts` - **modified.** `premiumBlock`, `currencyBlock`, `spendBlock`, `playerStatsBlock`, `financialSection` — all five in one commit so plans 05-12 to 05-15 never edit a helper concurrently.
- `tests/e2e/finance.spec.ts` - **new.** 6 browser tests across three describes: the sample (tracer + excluded, one shared import), the two empty states (a replace in between), and the two exclusion counts the sample does not cover.
- `tests/e2e/dashboard.spec.ts` - **modified.** The two tests the flip invalidated, plus D-06's claim (deviation 1).
- `tests/e2e/import-flow.spec.ts` - **modified.** One comment this change made factually wrong. Its `importLine` assertion is status-agnostic and was never broken (deviation 2).

## Decisions Made

Seven, all recorded in the module headers and mirrored below; the load-bearing ones:

- **One key, not two.** See `key-decisions` above. The vehicles block's own `updating` state is 05-12's to derive; `ViewOf` and the `deriveFinanceState` constraint deliberately exclude `VehicleView`.
- **`premiumFigures` declares its own return type.** The structural compatibility is proven in `tests/unit/finance-state.test.ts` by passing its result to `formatPremiumSummary`, so a rename on either side is a compile error there.
- **The two listed strings are compared SORTED in the browser spec.** The worker's disclosure order is count descending then code units — `finance.test.ts:227` already compares sorted for the same reason — while `PREMIUM_HAND_EXPECTED` stores the two in file order. Asserting file order would have asserted a property the builder does not have. The prose in the plan lists them in the builder's order, which agrees.
- **All five e2e locators land now**, not as later plans arrive (the plan's own planner assumption, and it removed a real two-plans-one-file conflict).

## Deviations from Plan

### Auto-fixed Issues

**1. [Task 2 scope — a migration the flip could not make yet] D-06's no-collapse-control assertion**
- **Found during:** the final full-suite run, after all three task commits
- **Issue:** `dashboard.spec.ts` asserted `card.locator('button, details')` has count 0 inside ALL FIVE section cards. The Premium block's disclosure is a `<details>`, so the ready `Financial_data` card has one. It passed in Task 2 because Task 1's block had no `details` yet, and broke in Task 3 when the disclosure arrived — so the per-file run after Task 3 (`finance + playtime + playtime-real-shape + uat-criteria`, 16/16) could not see it. Only the whole suite could.
- **Fix:** split the claim rather than drop it. `button` count 0 still holds for all five cards; `details` count 0 holds for the three PENDING cards only, where a disclosure would control content that does not exist. A `ready` card may hold a `details` that is part of its dashboard. The assertion is now STRONGER than what it replaces — it pins "no button in any card" where the old line only pinned "no button or details in a card that had neither".
- **Files modified:** `tests/e2e/dashboard.spec.ts`
- **Verification:** full Playwright suite 127 passed / 0 failed in 41.1s
- **Committed in:** `687b36b`

The plan DID assign this migration ("the no-button-or-details assertion now applies only to sections that are still pending", RESEARCH Pitfall 3) — to the flip plan. The flip landed in Task 2 and the assertion could not be narrowed until the `<details>` existed in Task 3, so it lands after the task commits rather than inside one.

**2. [Out of declared scope — a comment this change made wrong] `import-flow.spec.ts`'s pending-set comment**
- **Found during:** Task 2, while auditing every e2e reference to the pending set
- **Issue:** the comment said "Activity_history is `ready` since 04-02 and shows these counts as its caption; the other three are `pending`", which the flip made false. The assertion below it uses `importLine`, which reads either variant, so no assertion was broken.
- **Fix:** corrected the comment only. No assertion, title, letter or count changed.
- **Files modified:** `tests/e2e/import-flow.spec.ts`
- **Verification:** the spec passes in the full-suite run; `git diff` is 8 lines, all comment
- **Committed in:** `8c994e6`

This is the one file outside the plan's 12 that was touched. The project has already recorded the rule it follows — "a stale TEST NAME is the same stale contract as a stale comment" (STATE.md, Phase 03/03-07).

---

**Total deviations:** 2 (1 deferred migration now made, 1 out-of-scope comment correction)
**Impact on plan:** Neither changes a product behaviour. No scope creep: the single out-of-scope file is a comment this plan's own flip falsified.

## Issues Encountered

- **The date-only spec caught a bug in its own fixture, not in the app.** The three "impossible" dates were 31 April, 31 June and 31 JULY. July has 31 days, so the third row was a valid grant, the block reported two exclusions and the spec failed on a count of three. Now 31 April, 31 June and 30 February. The claim worked: an impossible date has to be impossible, not merely unusual, and only a real count could tell the difference.
- **`PREMIUM_HAND_EXPECTED` has no `unrecognisedMore` field** and `PremiumHandExpected` does not declare one, so the cross-check for "nothing was held back" is the length of its two-string array plus the absence of an overflow `li` in the DOM, not a number to compare. Stated in the spec.
- **A declaration-order bug I introduced in `finance.spec.ts`**: `EXPECTED_SENTENCE` read a constant declared below it, which is a temporal-dead-zone error at module load. Reordered, with a comment saying why the order is load-bearing.
- **`tsc` cannot narrow `Extract<DataResult, { channel: C }>` after a generic discriminant check.** One documented assertion at that boundary, mirroring the identical assertion and reasoning already in `query-client.ts` — the same claim, made in the same place by the only two functions that hold a `DataOutcome`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 05-11 (the Premium chart), 05-12 (the vehicles table), 05-13 (the currency block) and 05-15 (the spend block).** Concretely, what they inherit:

- `deriveFinanceState`, `acceptDataOutcome` and `premiumFigures` are written for the three finance channels, not just premium. `05-13` adds a `CurrencyBlock` to `FinancialData.svelte` as a sibling at the same 24px gap; `05-15` adds a `SpendBlock` to the Payment_history card.
- `ExcludedNotice` already takes `formatOperationExcludedPill` and `formatPaidExcludedPill`'s words — those two formatters exist in `ui-copy.ts` and the notice is ready for them. Only the three call sites are missing.
- All five e2e locators are in `helpers.ts`; 05-12 to 05-15 must NOT edit that file.
- The `CurrencyBlock`, `SpendBlock` and player-stats locators resolve to test ids that do not exist yet (`currency-block`, `spend-block`, `player-stats`). A locator that matches nothing is a test that fails loudly, not one that passes vacuously.
- `05-11` adds the chart to `PremiumBlock.svelte`'s `ready` branch, after the summary sentence and before or after the notice — the UI-SPEC's document order is its call. The chart reads `readyView`, which is already derived and null-guarded.
- `05-12` owns the vehicles `updating` state. `finance-state.ts` deliberately does NOT have that state and its `ViewOf` constraint excludes `VehicleView`; 05-12 should add its own derivation rather than widen this one, so the `status: ViewStatus` constraint keeps holding for the three finance views.

**Carried forward, not blocking:** a cache written before plan 05-07 has no presence facts, so an absent premium file reads `no-rows` rather than `not-in-export` for a returning user. The e2e specs build fresh imports and see the exact states. This is the plan's own planner assumption, recorded here so a later phase does not mistake it for a regression.

**Not verified here:** layout geometry and colour rendering of the new block. `pnpm run check` runs svelte-check's a11y rules and the browser specs assert DOM and text, but the 14px Label weight and the amber pill's contrast on `#fef7e0` are asserted by `tests/unit/contrast.test.ts` only for the components that file already reads. If `05-UI-SPEC` requires the new surfaces in the colour table, that is a one-line addition to the contrast suite's file list and is worth doing in 05-11 when the chart lands beside it.

---

*Phase: 05-vehicle-stats-financial-dashboards*
*Completed: 2026-10-01*
