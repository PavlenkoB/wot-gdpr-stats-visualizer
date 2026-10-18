---
phase: 10-merged-dashboard-across-accounts
plan: 02
subsystem: shell
tags: [game-filter, playtime, vehicles, radiogroup, stamped-choice, multi-account, shell]

requires:
  - phase: 10-merged-dashboard-across-accounts
    plan: 01
    provides: "`playtime-query.game`, the per-game scopes, the `games`/`game` fields on a `ready` view and the `no-game-sessions` view"
  - phase: 08
    provides: "the stamped-choice pattern (`datasetStamp`, `resolveSelection`) and the shell guards that scan for storage, hash and history APIs"
provides:
  - "`game-filter-state.ts` — `GAME_FILTER_TOKENS`, `GameFilterChoice`, `resolveGameFilter`, `filterToTitle`, `filterAfterTitleChange`, `filterChips`"
  - "`GameFilter.svelte` — the radio chip row with `game-filter` and `game-filter-chip-*`"
  - "the stamped `gameChoice` cell in `Dashboard.svelte`, read by Playtime and Vehicles"
  - "a `game` dimension through `playtime-client.ts` and `playtime-state.ts`, and the `no-game-sessions` state"
  - "`formatNoGameSessions`, `PLAYTIME_MERGE_ABOUT`, `ABOUT_NAME_PLAYTIME_TOTALS`, `GAME_FILTER_LABEL`, `GAME_FILTER_ALL`"
  - "`MA_EXPECTED_PLAYTIME` — the three-account playtime figures as hand-derived literals"
affects: [10-04, 10-05, 10-06, Playtime.svelte, PlayerStats.svelte, Dashboard.svelte]

actuals:
  tokens: 28500
  tasks: 3
  commits: 4
plan_head_before: dac615d3d50365cecd04bd4a8593b3be55d2321e
plan_head_after: a1d3789196d68e2ff7ffd322ce6f4e989ee60e41

tech-stack:
  added: []
  patterns:
    - "A slice is the PAIR (index, game): every comparison that decides `updating`, stamps a surviving answer or rolls a dropped one back compares both halves, because a chip click carries `valueIndex: null` and compares equal to the All slice on its index alone."
    - "The chip list is built by walking a module constant, never the data: `filterChips` returns tokens from `GAME_FILTER_TOKENS` or it returns nothing, so an untrusted zip file name cannot decide either the membership or the order of a control."

key-files:
  created:
    - src/lib/shell/game-filter-state.ts
    - src/lib/shell/GameFilter.svelte
    - tests/unit/shell/game-filter-state.test.ts
  modified:
    - src/lib/shell/Dashboard.svelte
    - src/lib/features/playtime/Playtime.svelte
    - src/lib/features/playtime/playtime-state.ts
    - src/lib/features/playtime/playtime-client.ts
    - src/lib/features/vehicles/PlayerStats.svelte
    - src/lib/ui-copy.ts
    - tests/fixtures/multi-account-fixtures.ts
    - tests/e2e/shell/multi-account.spec.ts
    - tests/unit/playtime/playtime-state.test.ts
    - tests/unit/playtime/playtime-client.test.ts
    - tests/unit/playtime/playtime-charts.test.ts
    - tests/unit/vehicles/vehicle-blocks.test.ts
    - tests/unit/import/multi-account-keys.test.ts
    - tests/unit/shell/ui-copy.test.ts

key-decisions:
  - "The filter is one cell in `Dashboard.svelte`, stamped with `datasetStamp(result)` and reset by a pure read — the same shape as `choice` and `viewChoice`, so the first import, the replace and the clear return it to All games with no reset effect that could be forgotten."
  - "`game` travels on the query ONLY when it is non-null. The message type declares unused fields as absent rather than null (T-05-18), so a caller that never sets a game keeps posting byte-identical messages and every 04-07 pin holds unchanged."
  - "The empty-game body is decided from the VIEW, not from the derived state: while a chip click is in flight the state is `updating` but the empty game is still what is on screen, and a body that vanished mid-click would leave the block blank with no explanation."
  - "Vehicles writes the filter AFTER its own load, so a title the worker then declines cannot leave the filter claiming a game the select is not showing — the select always renders the APPLIED title."
  - "`titleToFilter`-style mapping is a `switch` on the TITLE inside `filterAfterTitleChange`, not `filterToTitle`'s inverse: the two directions have different fallbacks (All maps to no title; an unknown title maps to the CURRENT filter), and one helper could not express both."

requirements-completed: [ACCOUNT-06]

coverage:
  - id: D1
    description: "One shell-level cell stamped with the import time: it survives a pane switch, returns to All games on reload and on a new import, and writes nothing to storage, the URL or IndexedDB."
    requirement: ACCOUNT-06
    verification:
      - kind: unit
        ref: "tests/unit/shell/game-filter-state.test.ts#resolveGameFilter"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the reload replays the same header and still leaks nothing"
        status: pass
    human_judgment: false
  - id: D2
    description: "The chip row renders only inside Playtime; Finance, Payments, Logins and Device info never show it."
    requirement: ACCOUNT-06
    verification:
      - kind: unit
        ref: "tests/unit/shell/game-filter-state.test.ts#filterChips: when the row exists at all"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#no page error and no console error across the whole flow"
        status: pass
    human_judgment: false
  - id: D3
    description: "Choosing a chip narrows the tiles, heatmap, hour grid and durations to that game across all accounts, and a game with no sessions shows one body line with the chips intact."
    requirement: ACCOUNT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the game filter narrows Playtime to one game across all accounts"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#a game with no sessions shows the empty line and the chips recover"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime/playtime-state.test.ts#derivePlaytimeState: 'no-game-sessions'"
        status: pass
    human_judgment: false
  - id: D4
    description: "On Vehicles the existing Game select is the filter's face: opening it asks for the filter's title, choosing a title sets the filter, Warplanes writes nothing, and with All the worker's first-title-with-rows rule applies."
    requirement: ACCOUNT-06
    verification:
      - kind: unit
        ref: "tests/unit/shell/game-filter-state.test.ts#the token and the Vehicles title"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#Vehicles follows the shared filter through its own Game select"
        status: pass
    human_judgment: false
  - id: D5
    description: "The choice list is built from the fixed token order WOT, WOTB, WOWS, so a hostile token can never become a chip and Phase 11 appends without a markup change."
    requirement: ACCOUNT-06
    verification:
      - kind: unit
        ref: "tests/unit/shell/game-filter-state.test.ts#a hostile token never becomes a chip, whatever else is in the list"
        status: pass
      - kind: unit
        ref: "tests/unit/shell/game-filter-state.test.ts#the fixed order holds whatever order the export arrived in"
        status: pass
    human_judgment: false
  - id: D6
    description: "An 'About this summary' disclosure explains the once-counted overlap and that All can read smaller than the games added together, and states the amended counting rule truthfully."
    requirement: ACCOUNT-06
    verification:
      - kind: unit
        ref: "tests/unit/shell/ui-copy.test.ts#it claims nothing the counting rule does not support (D-07 as amended)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#a game with no sessions shows the empty line and the chips recover"
        status: pass
    human_judgment: false
  - id: D7
    description: "The chips are a native radiogroup named by the visible label, one tab stop, 44px tall at every width, with no new live region, media query, colour or transition."
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-shell-guards.test.ts"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts"
        status: pass
    human_judgment: true
    rationale: "The geometry and semantics are asserted in source and by the guards, but only a reader can say whether four chips read clearly above the split selector at 375px. No visual test was run for this plan (no new listed test, by D-17)."
  - id: D8
    description: "Vehicles with the filter on All may show a different game than Playtime, and the select shows the applied title with no extra cue."
    verification: []
    human_judgment: true
    rationale: "Recorded as an assumption by the plan (UI-SPEC, unresolved ordering row). The e2e asserts only that the select shows SOME title, because which one is the worker's answer rather than a contract."

duration: 28 min
completed: 2026-10-18
status: complete
---

# Phase 10 Plan 02: The shared game filter Summary

**A chip row in the Playtime pane and the existing Game select on Vehicles reading and writing one stamped, session-only filter cell, with the worker answering each game across all accounts through Plan 10-01's `game` contract.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-10-18T12:29:30Z
- **Completed:** 2026-10-18T12:58:00Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- `game-filter-state.ts`: the whole rule set as pure functions — the fixed `GAME_FILTER_TOKENS`, the stamped `GameFilterChoice` with its pure-read reset, and `filterChips`' one visibility rule ("at least two chips would show different data, OR the active choice must stay visible"). Twenty unit tests carry the matrix, including a hostile token that never becomes a chip.
- `GameFilter.svelte`: native radios inside labels, one tab stop, named by its own visible label through `aria-labelledby`, 44px at every width with no media query, and only existing colour tokens.
- `playtime-state.ts`: `awaiting` now compares the PAIR `(valueIndex, game)` — the trap 10-01 handed over. A chip click carries `valueIndex: null`, so on the index alone it compared equal to the All slice on screen and the previous game's numbers would have looked final.
- `no-game-sessions` is a seventh state with its own body line; the chips above it stay, and the body is decided from the VIEW so it survives a click in flight.
- `PLAYTIME_MERGE_ABOUT` uses the plan-phase-corrected wording (hours union, sessions and days as recorded) and a ui-copy test now fails if "merged stretches" or "all come from those stretches" ever come back.
- `MA_EXPECTED_PLAYTIME`: the three-account figures typed out from the fixture's session rows (ALL 52,200 s / 13 / 13; WOT 22,500 / 5 / 5; WOTB 14,400 / 4 / 4; WOWS 4,500 / 1 / 1; HEAT and WOTC counted only under All), so the e2e asserts literals rather than reading numbers back off the page.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "WoT" chip — filter rules, the chip row, the `game` dimension, literal totals through the browser** - `9cdd072` (feat)
2. **Task 2: The empty game, the applied-game announcement, the About disclosure and its corrected wording** - `ff159e5` (feat)
3. **Task 3: Vehicles follows the shared filter through its existing Game select** - `6c65499` (feat)

## Files Created/Modified

- `src/lib/shell/game-filter-state.ts` — new; the pure rules, with the header comment on why a `$derived` calls it and never writes.
- `src/lib/shell/GameFilter.svelte` — new; the radiogroup, its test ids and its geometry.
- `src/lib/shell/Dashboard.svelte` — the `gameChoice` cell, `gameFilter` derived, `setGameFilter`, and the two prop sets.
- `src/lib/features/playtime/Playtime.svelte` — `game` threaded through `load`, `untrack` read in the dataset effect, `onGameChange`, the chip row, the empty-game body and the About disclosure.
- `src/lib/features/playtime/playtime-state.ts` — the optional `game` on the ask and both shown variants, the `awaiting` pair, the seventh state, and the game in the announcement.
- `src/lib/features/playtime/playtime-client.ts` — `query(valueIndex, game = null)`, the key added only for a non-null token.
- `src/lib/features/vehicles/PlayerStats.svelte` — the two props, the first ask's title, and the write after the load.
- `src/lib/ui-copy.ts` — `GAME_FILTER_LABEL`, `GAME_FILTER_ALL`, `formatNoGameSessions`, `PLAYTIME_MERGE_ABOUT`, `ABOUT_NAME_PLAYTIME_TOTALS`.
- `tests/unit/shell/game-filter-state.test.ts` — new; the visibility matrix, the stamp reset and the token/title mapping.
- `tests/fixtures/multi-account-fixtures.ts`, `tests/e2e/shell/multi-account.spec.ts` — the literals and three new steps.
- `tests/unit/playtime/{playtime-state,playtime-client,playtime-charts}.test.ts`, `tests/unit/vehicles/vehicle-blocks.test.ts`, `tests/unit/import/multi-account-keys.test.ts`, `tests/unit/shell/ui-copy.test.ts` — the new proofs and the pins that had to move (see deviations).

## Decisions Made

- **`no-game-sessions` decided from the view, not the state.** The plan said "so the body stays up while an update is in flight"; the only way to get that is to ask the VIEW. The state is `updating` for the whole flight, so a state-based branch would have blanked the block for a frame on every chip click out of an empty game.
- **`filterAfterTitleChange` is a switch on the title, not `filterToTitle` inverted.** The two directions have genuinely different fallbacks: `filterToTitle(null)` is `null` because "All games" means "ask the worker", while `filterAfterTitleChange('wowp', current)` is `current` because Warplanes means "leave it alone". Expressing the second as `filterToTitle(title) === null ? current : title.toUpperCase()` looked tempting and is wrong — it would return the title for any unknown value that upper-cased into a filter token.
- **`onTitleChange` writes the filter AFTER `void load(...)`.** Not for tidiness: the select renders `view.title`, the APPLIED title, so a write before the answer could leave the filter on a game the control is not showing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Flipped three source pins the plan did not list**
- **Found during:** Task 1's first `test:unit` run
- **Issue:**
  - `playtime-charts.test.ts` "a dropped answer reconciles the request, unless the ask itself is stale" is a REGEX over `Playtime.svelte`'s `load`, and adding the game to the roll-back guard changes both the condition and the assignment it matches.
  - `playtime-state.test.ts` "an error outcome becomes a failed shown…" and "a matching result becomes a shown view…" use `toEqual` on the whole surviving record, and stamping `game: ask.game ?? null` adds a key.
  - `playtime-state.test.ts` "every one of the six states is reachable, and only those six" enumerates the state set.
- **Fix:** The roll-back regex now carries the third gate and the `game` in the assignment, with a comment saying the gate is Phase 10's. The two `toEqual` pins gained `game: null`, with a comment recording why the key is written even when the ask carries none. The state test is now "every state is reachable, and only those" and names all seven.
- **Files modified:** `tests/unit/playtime/playtime-charts.test.ts`, `tests/unit/playtime/playtime-state.test.ts`
- **Verification:** `pnpm run test:unit` green (98 files, 3219 tests).
- **Committed in:** `9cdd072`

---

**2. [Rule 3 - Blocking] `vehicle-blocks.test.ts` copy guard failed on the `Game` label, not on a sentence**
- **Found during:** Task 3's first `test:unit` run
- **Issue:** "NO UI-SPEC sentence is typed into either component" asserts that `PlayerStats.svelte` does not contain `TITLE_CONTROL_LABEL`'s value, which is the single word `Game`. The plan mandates a prop named `onGameFilterChange` on this very component, so the assertion now fails on an IDENTIFIER. The test file already made exactly this exclusion for `PLAYER_STATS_HEADING` ('Vehicles' is a substring of `ShownVehicles`) with a comment saying so.
- **Fix:** `TITLE_CONTROL_LABEL` moved out of the verbatim sentence list for the same documented reason, and the guard's positive half gained a check that the template renders `{TITLE_CONTROL_LABEL}` and contains no bare `>Game<`.
- **Files modified:** `tests/unit/vehicles/vehicle-blocks.test.ts`
- **Verification:** `pnpm run test:unit` green; `pnpm run lint` green.
- **Committed in:** `6c65499`

---

**3. [Rule 2 - Missing critical] One real bug the plan's own signature would have shipped**
- **Found during:** Task 1's first `test:unit` run
- **Issue:** `filterAfterTitleChange` was first written as `filterToTitle(title) === null ? current : title` — passing a TITLE into a function that takes a TOKEN. It answered `null` for `'wot'`, so choosing WoT on Vehicles would have silently left the filter alone (D-21 broken) while the unit test that named the case caught it.
- **Fix:** A `switch` on the title returning the token, with Warplanes and anything unknown falling through to `current`.
- **Files modified:** `src/lib/shell/game-filter-state.ts`
- **Verification:** `tests/unit/shell/game-filter-state.test.ts` — 20 tests green.
- **Committed in:** `9cdd072`

---

**4. [Rule 3 - Blocking] Task 2's e2e step cannot pass before Task 3 exists**
- **Found during:** Task 2's `playwright` verify
- **Issue:** The plan puts the empty-game e2e step in Task 2, and that step reaches the empty game by choosing Warships on VEHICLES and then opening Playtime — which is exactly the cross-pane write Task 3 implements. With Task 2 alone the step failed with `data-state` `ready` instead of `no-game-sessions`.
- **Fix:** Not "fixed" — sequenced. Task 2 was committed with its unit verification green and the recorded single e2e failure, and Task 3 made it green. The full spec is 27/27 at HEAD.
- **Files modified:** none
- **Verification:** `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/vehicles` — 27 passed.

---

**Total deviations:** 4 auto-fixed (2 blocking pin flips, 1 missing-critical bug, 1 sequencing)

**Impact on plan:** No production behaviour outside the plan's scope. Two source pins and one identifier-substring guard moved, exactly the class of flip 10-01 already recorded for `PLAYTIME_VERSION`, and one implementation bug the plan's own unit test caught on the first run.

## Issues Encountered

- **`tests/e2e/shell/chart-fill.spec.ts` fails under parallel workers, and did so before this plan.** "finance charts fill the detail pane" fails at the 375px sample with `finance-tooltip right 367.2 > edge 359.0` when run inside a directory group, and passes on its own. Restoring every source file this plan touched to the pre-plan commit `dac615d` and re-running the group reproduces the same failure, so it is not 10-02's defect and is out of scope: recorded in `.planning/WINDOWS.md` (entry 15, `lint-warning`, open) and in this phase's `deferred-items.md`. Everything else is green: `tests/e2e/shell` + `playtime` + `vehicles` 145 passed / 1 pre-existing failure, `tests/e2e/guards` 5 passed (including zero-network), `tests/e2e/finance` + `import` + `logins` 107 passed, `--list` still 258 tests in 28 files.
- **Two of Task 1's own acceptance greps do not describe what they were written to describe.** `grep -c 'type="radio"' src/lib/shell/GameFilter.svelte` returns 2, not the 1 the criterion states: the All chip and the `{#each}` chip are both radio inputs, which is what "a native radiogroup" means. And `grep -v '…' src/lib/features/vehicles/PlayerStats.svelte | grep -c -E 'GameFilter|game-filter-chip'` returns 3, not 0, because the criterion's own prop name `onGameFilterChange` contains the substring `GameFilter`. The criterion's stated intent — no second widget on Vehicles, no chip row — holds: `PlayerStats.svelte` imports `filterAfterTitleChange` and `filterToTitle` from the pure module, never `GameFilter.svelte`, and its `player-stats-title-selector` count is unchanged at 1.
- **`pnpm run test:unit -- <path>` does not filter in this repo** (unchanged from 10-01): it runs all 98 files, so every named command is in fact a full-suite run.

## Self-Check: PASSED

- All five created/modified key files exist on disk; the three task commits and the metadata commit are ancestors of HEAD, and `git rev-list --count dac615d..HEAD` is 4 — three task commits plus this plan's metadata commit, which is what the `actuals.commits` above records.
- `pnpm run test:unit` 98 files / 3219 tests green; `pnpm run check` 0 errors 0 warnings; `pnpm run lint` clean.
- `pnpm exec playwright test --list` reports 258 tests in 28 files — no new listed test.
- `src/lib/shell/game-filter-state.ts` exports all six rules; `GameFilter.svelte` carries `game-filter-chip-*`; `Playtime.svelte` renders `playtime-game-empty` and `about-playtime-totals`; the explicit `aria-live` count in `Playtime.svelte` is unchanged at 4; `GameFilter.svelte` has zero `aria-live` and zero `@media`.

## Known Stubs

None. Every rule this plan added is reached: the chip row by two games, the empty-game body by a carried-over filter, the About disclosure by either. Nothing is wired to an empty or placeholder value.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 10-04 can start.** It needs `MA_EXPECTED_PLAYTIME` (three-account playtime) and `MA_OVERLAP_ADDRESSES` (from 10-01) from `tests/fixtures/multi-account-fixtures.ts`; both are hand-derived literals, so a consumer asserts rather than measures.
- **Plan 10-05 (Vehicles across accounts) inherits the filter.** `PlayerStats.svelte` now takes `gameFilter`/`onGameFilterChange`, and the account tag belongs in the same sticky first cell — the select stays the filter's face, so nothing there needs to change to accommodate it.
- **Plan 10-06 (the zero-network extension) has its seam.** The chip path is a postMessage only; the guards and the privacy walks already pass with the filter in place, and `about-playtime-totals` introduces no network surface to allow-list.
- **One caution for the next plan:** `tests/e2e/shell/chart-fill.spec.ts` is flaky under parallel workers and will show up in any grouped e2e run. It is not this phase's regression; see `deferred-items.md`.

---
*Phase: 10-merged-dashboard-across-accounts*
*Completed: 2026-10-18*