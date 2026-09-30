---
phase: 04-activity-time-dashboards
plan: 08
subsystem: ui
tags: [svelte5, aria-live, select, state-machine, live-region, vitest, playwright, accessibility]

# Dependency graph
requires:
  - phase: 04-activity-time-dashboards (04-01)
    provides: "the playtime query/result/error message types, the `PlaytimeView` union, and the deliberate `values[].value: string` declaration whose blank-value convention this plan was asked to rule on"
  - phase: 04-activity-time-dashboards (04-02)
    provides: "the tracer block whose state derivation routes a null view to `error`, its three cells of state, the `playtime-status` live region and the three test ids this plan had to keep"
  - phase: 04-activity-time-dashboards (04-04)
    provides: "the copy table, `formatSplitValue` returning `(not recorded)` only for `null`, `formatSelectionAnnouncement`, and the planner-authored `HOUR_GRID_START_BASIS_NOTE` left for this plan to word"
  - phase: 04-activity-time-dashboards (04-05)
    provides: "`buildSplitTable` with its eight-row cap and `selected` flag, `effectiveSelection`'s three refusals, and the model layer the selector and table both read"
  - phase: 04-activity-time-dashboards (04-06)
    provides: "the split core, the lazy rebuild, and the unrouted question of what a blank server name reaching the view as `''` should become"
  - phase: 04-activity-time-dashboards (04-07)
    provides: "`PlaytimeOutcome` as `result | error | superseded` with supersede ON ISSUE, which is what makes the `updating` state a real interval rather than a theoretical one"
  - phase: 03-dashboard-shell-account-identity
    provides: "the accessibility rules this plan reuses: live regions rendered unconditionally with only their child conditional, the 1px clip pattern, and the 3px #1a73e8 focus ring every control wears"
provides:
  - "playtime-state.ts: the six-state machine, the answer-admission rule, the selection announcement and the status line, as pure functions with 31 unit tests"
  - "A split selector that never shows a selection from another dataset or past the end of the value list, and announces the slice it switched to"
  - "PlaytimeSummary: the three totals, the capped split table with `aria-current` on the applied row, and the excluded-row notice"
  - "ExcludedNotice: a component that cannot render `0 rows excluded`"
  - "The second Activity_history sub-heading, so the card matches D-02's document order and the pending note is asserted for a ready section again"
affects: [04-09, 04-10, 04-11, 04-12, activity-time-dashboards, playtime-state]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 18084
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The decision is a function, the component is the wiring: any rule that can be wrong while a query is in flight lives in a pure module Vitest can reach, because `environment: 'node'` with no jsdom means a component cannot be rendered at all"
    - "A stamp travels with the data it describes: `ShownPlaytime` and `RequestedSlice` both carry `importedAt`, so a replace is handled by comparing two strings rather than by a hand-written reset that can be forgotten"
    - "A `loaded` flag is a class in the admin list, not a state in the render: the block renders its loaded value or a `loading` line, and never both"
    - "A live region that says nothing takes no space: the status paragraph is always in the DOM and is clip-hidden when empty, because a region created with its content is not announced and `display: none` is not in the tree at all"

key-files:
  created:
    - src/lib/playtime-state.ts
    - src/lib/components/PlaytimeSummary.svelte
    - src/lib/components/ExcludedNotice.svelte
    - src/lib/components/LoginHistorySection.svelte
    - tests/unit/playtime-state.test.ts
  modified:
    - src/lib/components/Playtime.svelte
    - src/lib/components/Dashboard.svelte
    - tests/e2e/dashboard.spec.ts

key-decisions:
  - "THE `''` QUESTION 04-06 ROUTED HERE, DECIDED: map `''` back to `null` at the display boundary (`splitValue`) rather than widening `PlaytimeSplit.values[].value` to `string | null`. The worker stores a blank value as `null` and `viewFromAggregates` publishes it as `''` because 04-01 declared the field `string`; translating it back at the edge is lossless, because a whitespace-only cell is stored `null` and trimmed, so `''` can only ever BE the blank value. The alternative would have touched `worker-messages.ts`, the worker and the stored aggregate shape for no gain in truthfulness. Consequence: a real server literally named `(not recorded)` is unaffected — the two are told apart by index, which is the only thing the export distinguishes (04-06's accepted collision)."
  - "A companion boundary for the same reason: `splitColumnOf` narrows the stored `string` column name to a `SplitColumn` or null. The aggregate is JSON in IndexedDB, so the main thread receives a bare string where the worker knows a union member, and an unrecognised name must never reach the exhaustive `SPLIT_COLUMN_LABELS` — it would answer `undefined` and the caption would throw inside a render. Such a name renders no selector, no table and no overlap note, which is the same silence the UI-SPEC requires of an export where no column qualifies."
  - "HOUR_GRID_START_BASIS_NOTE: the wording is ACCEPTED as it stands, and `HOUR_GRID_BASIS` stays `overlap`. The note is unreachable today and stays a constant rendered only under the start basis; what 04-04 left open was the sentence, and 'Each session is counted in the weekday and hour it starts.' already says the only thing that differs between the bases. Flipping the basis is not justified either: the UI-SPEC's hour-grid contract is written for overlap attribution, and both bases sum to the same total, so there is no correctness pressure. The consequence worth stating is that the WHOLE-LENGTH attribution is not in the note — and it does not need to be, because 04-04's `formatHourCellLine2` already swaps the tooltip suffix to 'in sessions starting this hour' under the start basis, which is where a reader meets that fact. If a future plan flips the constant, the caption gains a clause and the existing literal in `ui-copy.test.ts` must change with it."
  - "The `updating` state is defined as a COMPARISON, not a flag: `requested.valueIndex !== shown.valueIndex`, both stamped with the same dataset. Comparing a boolean would have been shorter and would have put a healthy dashboard into a permanent 'Updating' after a replace, because the request for the old dataset outlives it (D-03)."
  - "`aria-busy` is on the block's root and true only in `loading`, exactly as 04-02 shipped it. The UI-SPEC also asks for `aria-busy` on the charts container while `updating`; there is no charts container until 04-09 adds one, so that half of the rule is 04-09's to place, and it is recorded as a carry-forward rather than invented as an empty wrapper here."
  - "The block's children are the heading, the status line, the selector row, `PlaytimeSummary` and — from 04-09 — the charts. The 24px gaps stay the block's, and the 8px grouping gaps inside `PlaytimeSummary` keep the tiles, the table, the note and the notice as ONE summary under ONE heading."

patterns-established:
  - "Two keys, one per clock: `importedAt` identifies the dataset, `valueIndex` identifies a slice of it, and every record that has to survive a replace carries both. Nothing in this block resets on a replace, so nothing in it can forget to."
  - "Admit-or-drop, never throw: `acceptOutcome` returns `null` for a superseded answer, a foreign dataset, a null stamp and a null view. An answer that must not be shown is not an error condition, and the worker's `detail` never reaches the DOM (T-04-24, D-21)."
  - "Announce the full set once: the status line repeats hours, sessions and active days rather than saying 'updated', because that is the only feedback a screen-reader user gets and the only place the three are stated together (D-03). It is written only for user-initiated changes, never on the initial load or a replace."
  - "A component that cannot express a bad state: `ExcludedNotice` has no way to render `0 rows excluded`, so the rule survives the next caller that forgets it."

requirements-completed: [ACTIVITY-01]

coverage:
  - id: D1
    description: "The six-state machine resolves `result`, `error`, `superseded` and every empty state consistently, and a request can only produce `updating` for the dataset on screen."
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime-state.test.ts#derivePlaytimeState"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-state.test.ts#every one of the six states is reachable, and only those six"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-state.test.ts#acceptOutcome"
        status: pass
    human_judgment: false
  - id: D2
    description: "A blank server name reaches the selector, the table cell and the live region as `(not recorded)`, and a real value that reads like that label stays a real value."
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime-state.test.ts#splitValue — the blank value crossing back into the display layer"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-state.test.ts#a blank value announces the blank value's label, not an empty name"
        status: pass
      - kind: other
        ref: "pnpm exec playwright test (throwaway 5k-fixture tracer, 2026-09-30): options and cells read `(not recorded)`"
        status: pass
    human_judgment: false
  - id: D3
    description: "Choosing a value puts a query out, applies only a current answer, moves the tiles and announces the new slice once in the status line."
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime-state.test.ts#acceptOutcome > a matching result becomes a shown view carrying the ask and the view"
        status: pass
      - kind: other
        ref: "pnpm exec playwright test (throwaway 5k-fixture tracer, 2026-09-30): `ru` -> 509 hours / 1,226 sessions, 'Showing ru: 509 hours, 1,226 sessions, 965 active days.'"
        status: pass
    human_judgment: true
    rationale: "The real browser path was verified by hand, not by a committed spec. Plan 04-11 owns the permanent Playwright coverage for the selector, the live region and the six states; committing a spec here would put the same file outside this plan's files_modified and duplicate 04-11's work."
  - id: D4
    description: "The split table shows All plus at most eight values with an overflow row, marks the applied row with `aria-current` and a weight change, and wraps a 60-character value without widening the page."
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime-model.test.ts#buildSplitTable (04-05, the cap and the selected flag this plan renders)"
        status: pass
      - kind: other
        ref: "pnpm exec playwright test (throwaway 12-value fixture tracer, 2026-09-30): 10 rows, 13 options, index 10 marks no row"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/dashboard.spec.ts (41 specs; the migrated 04-02 playtime-status and aria-live-count assertions)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The status live region is in the DOM in every state, empty and clip-hidden when it has nothing to say, and names the slice when it does."
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime-state.test.ts#statusLine"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-state.test.ts#selectionAnnouncement"
        status: pass
      - kind: e2e
        ref: "tests/e2e/dashboard.spec.ts#playtime-status renders and the page has exactly two live regions (04-02, still passing)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Activity_history card shows both of D-02's sub-headings in one 24px column, the section shell is unchanged, and the pending note is asserted for activity-history again."
    requirement: ACTIVITY-01
    verification:
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/dashboard.spec.ts tests/e2e/scroll-nav.spec.ts (54 passed)"
        status: pass
      - kind: other
        ref: "git diff 40ac5c2 -- src/lib/components/DashboardSection.svelte (empty)"
        status: pass
    human_judgment: false

# Metrics
duration: 24min
completed: 2026-09-30
status: complete
---

# Phase 04 Plan 08: The Playtime block's states, selector and totals

**The Playtime block can now answer a question: a server selector moves the totals, the split table and the hour grid's subject together, only a current answer is ever applied, and the choice is announced once in the block's single live region.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-09-30T03:16:34+04:00
- **Completed:** 2026-09-30T03:41:00+04:00
- **Tasks:** 3 (plus a verification-only task with no code change)
- **Files modified:** 8

## Accomplishments

- **The six-state machine is real and testable.** 31 unit tests cover every state, every empty state, and every way an answer can be wrong: superseded, a dataset that moved on, a result stamped with no dataset or another one, and a result carrying no view. Nothing in `Playtime.svelte` decides anything any more — it holds three cells of state, one effect and one handler.
- **The `''` question is decided, implemented and proven in a browser.** A blank server name reads `(not recorded)` in the selector, in the table and in the announcement. See Decisions Made.
- **The selection path works end to end.** Choosing a value puts a query out, the tiles move to that slice, the table marks that row, and the live region reads the three numbers. Verified in Chromium on the 5k seeded fixture: `ru` → 509 hours / 1,226 sessions / 965 active days, announced in full.
- **The block renders nothing it cannot fill in.** A zero excluded count renders no notice; a column this build has no words for renders no selector and no table; and the status line is in the DOM in every state but says nothing until a slice change gives it something to say.
- **The card matches D-02.** Both sub-headings are present in one 24px column, the section shell is untouched, and the `(sections-pending)` assertion covers `activity-history` again.

## Task Commits

1. **Task 1: the state module, the totals, the split selector** - `76dbfa3` (test, RED: 31 failed with the module-not-found message), `6e22aa2` (feat, GREEN)
2. **Task 2: the split table, the overlap note, the excluded notice** - `e31df4a` (feat)
3. **Task 3: the Login history sub-heading and the activity column** - `8103f02` (feat)
4. **Task 4: full verification** - no commit; nothing needed fixing

**Plan metadata:** in the commit that records this summary.

## Files Created/Modified

- `src/lib/playtime-state.ts` - NEW. `derivePlaytimeState`, `acceptOutcome`, `selectionAnnouncement`, `statusLine`, and the two boundary rules `splitValue` and `splitColumnOf`.
- `src/lib/components/PlaytimeSummary.svelte` - NEW. The three totals, the capped split table with `aria-current` on the applied row, the D-02 overlap note, and the excluded-row notice, in one 8px column.
- `src/lib/components/ExcludedNotice.svelte` - NEW. The amber pill plus its explanation; returns nothing for zero.
- `src/lib/components/LoginHistorySection.svelte` - NEW. The second sub-heading and the pending note, with the h3 rule repeated from `Playtime.svelte` and a comment saying which file to keep in step.
- `src/lib/components/Playtime.svelte` - REWRITTEN. The selector, the derived states, the always-present live region, the four non-ready states. Test ids, `data-state` and the 04-02 derivation are unchanged.
- `src/lib/components/Dashboard.svelte` - The activity-history branch now renders one 24px column holding the Playtime block and the Login history block.
- `tests/unit/playtime-state.test.ts` - NEW. 31 tests, written and committed RED before the module existed.
- `tests/e2e/dashboard.spec.ts` - `activity-history` restored to the pending-note loop; 04-02's temporary comment naming this plan deleted.

## Decisions Made

**1. The `''` → `null` question, routed here by 04-06.**

`PlaytimeSplit.values[].value` is declared `string` (04-01). The worker stores a blank value as `null` and `viewFromAggregates` publishes it as `''`, so the view receives the blank value as an empty string — and `formatSplitValue` returns `(not recorded)` only for `null`. Passing the value straight through renders an empty cell.

**Chosen: translate at the display boundary, not in the type.** `splitValue(raw: string): string | null` returns `null` for `''` and the string unchanged otherwise; every call site composes it with `formatSplitValue`.

- *Why this and not a type change:* a whitespace-only cell is trimmed and stored as `null` by 04-06, so `''` can only ever be the blank value — the round trip through the message is lossless and the translation is exact. Widening the field to `string | null` would have meant changing `worker-messages.ts`, the worker and the stored aggregate's meaning, across files this plan does not own, to describe a distinction the export cannot actually support.
- *Consequences:* a real server literally named `(not recorded)` is untouched — the two render identically, which the UI-SPEC accepted and 04-06 documented; they are told apart by index, which is the only thing the export distinguishes. Every future display of a split value must go through `splitValue`, and the rule is stated in exactly one place with a unit test beside it. Ordering is unaffected: selection is by index, and a blank value is stored `null` and ranked last either way.

**2. `HOUR_GRID_START_BASIS_NOTE` — accepted as written, basis stays `overlap`.**

04-04 left one planner-authored sentence and said the wording was this plan's to decide. It does not need changing: 'Each session is counted in the weekday and hour it starts.' says the only thing that differs between the two bases, and the part it omits — that the session's WHOLE length lands in that one cell — is already said where a reader meets it, in 04-04's `formatHourCellLine2`, whose suffix under the start basis is 'in sessions starting this hour'. So the note stays a constant rendered only under `start`, and `HOUR_GRID_BASIS` stays `overlap`: the UI-SPEC's hour-grid contract is written for overlap attribution, and both bases sum to the same total, so there is no correctness reason to flip it. The cost of the decision is stated plainly: if a later plan flips the constant, the caption needs a clause about whole-length attribution and the literal pinned in `ui-copy.test.ts:827` has to change with it.

**3. `splitColumnOf` — an unrecognised column name renders no split UI.**

The aggregate is JSON in IndexedDB, so the column arrives as a bare `string` where the worker knows a `SplitColumn`. The label table is exhaustive, so passing an unknown name through would answer `undefined` and throw inside a render — a crash in the render path for a case that cannot currently occur. The helper narrows to a union member or `null`, and a `null` renders no selector, no table and no overlap note: the same silence the UI-SPEC requires of an export where no column qualifies, and D-03's rule that the selector never claims a column it cannot name.

**4. `updating` is a comparison, and `aria-busy` stays where 04-02 put it.**

`updating` means a request for the same dataset at a different index — not a boolean. The difference is a replace: a request stamped with the old dataset outlives it, and a flag would have held the block in 'Updating' forever. `aria-busy` is on the root and true only in `loading`; the UI-SPEC's `aria-busy` on the charts container belongs to 04-09, which is where the container comes into existence. Recorded as a carry-forward, not invented as an empty wrapper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — blocking — test drove a real design correction] The blank value would have been announced as "all sessions"**
- **Found during:** Task 1, first GREEN run after the RED commit
- **Issue:** `formatSelectionAnnouncement` uses `null` for BOTH All and "no name", so passing the blank value through as `null` — the obvious composition of `splitValue` with the formatter — produced "Showing all sessions: 3.5 hours…". The RED test for a blank selection caught it on the first run, which is the reason the test asserts an exact sentence rather than a prefix.
- **Fix:** the subject is `null` for All and a STRING for a value, so the blank goes through `splitValue` and then `formatSplitValue` and arrives as `(not recorded)`. One line, no new copy.
- **Files modified:** `src/lib/playtime-state.ts`
- **Verification:** `tests/unit/playtime-state.test.ts` 31/31; the announcement confirmed in Chromium ("Showing (not recorded): 474 hours, 1,210 sessions, 935 active days.")
- **Committed in:** `6e22aa2`

**2. [Rule 5 — name collision] `const state` collides with the `$state` rune**
- **Found during:** Task 1, `pnpm run check`
- **Issue:** Svelte compiles `$state` to a local binding, so a variable named `state` in the same scope produced three cascading type errors.
- **Fix:** renamed to `playtimeState`, which is also what 04-02 used, so the diff reads as an extension rather than a rename.
- **Files modified:** `src/lib/components/Playtime.svelte`
- **Verification:** `pnpm run check` 0 errors 0 warnings
- **Committed in:** `6e22aa2`

---

**Total deviations:** 2 auto-fixed (1 blocking defect found by the RED test, 1 mechanical name collision)
**Impact on plan:** Both were corrections inside the plan's own scope. No new files, no new copy, no change to any file outside `files_modified`.

### Deliberate, recorded, and not deviations

- **`PlaytimeSummary`'s prop list grew in two steps.** Task 1 shipped it with `slice` only, and Task 2 added `split` and `selected` when the table arrived. Declaring them in Task 1 would have left two unused destructured bindings, which this repo's eslint rejects — a red commit that is not the plan's red commit. The plan's Task 2 text is what specifies those props, so this follows it.
- **Task 2 has no RED commit.** The plan marks Task 2 `type="auto"` and `Task 1` alone as `tdd="true"`, and its behaviours are already covered by unit tests on the pure functions it renders (`buildSplitTable` in `playtime-model.test.ts`, `formatExcludedPill` / `formatSplitOverflowRow` / `formatSplitOverlapNote` in `ui-copy.test.ts`). What Task 2 adds is markup, which this repo verifies with `pnpm run check` (svelte-check's a11y rules included), `lint`, `build` and the browser, because `vitest.config.ts` has no Svelte plugin and cannot render a component at all.

## Issues Encountered

- **The plan's human-check assumed no Chromium.** Every `human-check` in this plan says the browser step "cannot be downloaded in the cloud sandbox" and that CI is the equivalent. Chromium was available here, so each human-check was actually run: three throwaway Playwright specs exercised the selection path, the table, the overflow row, the focus ring, the 24px column and 375px. All three passed and were deleted before their task commits, so the tree carries no file outside the plan's eight. Plan 04-11 turns that work into permanent specs.
- **`updating` was not observable in a browser run.** With aggregates precomputed the worker answers inside a frame, so Playwright never saw the intermediate state. The state itself is pinned by unit tests (`a same-dataset request for a DIFFERENT index is updating`), which is also where it belongs: 04-07's supersede-on-issue is what makes the interval real, and the block holds the previous slice through it by construction.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **04-09 and 04-10 have the container they expect.** The block's children are the heading, the status line, the selector row and `PlaytimeSummary`; the charts go inside `PlaytimeSummary`'s 8px column or the block's 24px column, and the block already publishes `data-state` and an `aria-busy` root for them to branch on. Every model they need (`buildCalendarModel`, `buildHourGridModel`, `buildDurationRows`, `rankScale`, `legendModel`, `clampTooltip`) is already in `playtime-model.ts` with its own tests.
- **One carry-forward for 04-09:** the UI-SPEC's `aria-busy="true"` on the charts container while `updating` is not placed, because the container does not exist yet. 04-09 owns placing it and should keep the status line's "Updating charts..." as the sentence that accompanies it.
- **One carry-forward for 04-11:** the permanent Playwright coverage for the selector, the announcement, the six states and the 375px table. The throwaway tracers described above are the specification for it.
- **`HOUR_GRID_BASIS` is untouched** and remains the single unresolved constant with both bases stored, exactly as 04-01 left it. This plan wrote no part of `playtime-shared.ts`.

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-09-30*
