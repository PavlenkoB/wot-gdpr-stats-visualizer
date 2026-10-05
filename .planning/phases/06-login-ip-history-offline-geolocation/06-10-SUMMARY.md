---
phase: 06-login-ip-history-offline-geolocation
plan: 10
subsystem: ui
tags: [svelte-5, runes, windowed-table, sorting, masking, account-record, playwright, source-contracts, tdd]

requires:
  - phase: 06-login-ip-history-offline-geolocation
    provides: "the Login history block, the one mask rune and displayIp (06-08); the frozen Phase 6 copy inventory (06-02); the worker-side logins view with its Account record and cap outcome (06-03, 06-05); countryName (06-06)"
  - phase: 05-player-statistics-vehicle-tables
    provides: "the windowed vehicle table's structure, geometry and CSSOM discipline, which LoginTable.svelte copies value for value (05-12)"
provides:
  - "src/lib/core/windowing.ts: windowRange, WindowRange, ROW_PX, OVERSCAN_ROWS, SCROLLER_MAX_PX, hoisted from vehicle-model.ts and re-exported there so every Phase 5 import and test is unchanged"
  - "src/lib/features/logins/LoginTable.svelte: a windowed, sortable native table with sticky header and first column and a pinned Account record tbody"
  - "src/lib/features/logins/login-model.ts: LOGIN_COLUMNS, visibleLoginColumns, buildLoginRows, nextSort, sortLoginRows, loginCells, accountCells, hasAccountRow, listedFigures, capFigures, excludedCount"
  - "LoginHistory.svelte: the table section (h4, count line, table, hints, excluded pill, cap line, account note) and the sort rune"
  - "a City column DEFINITION that visibleLoginColumns(true) will draw once plans 06-11 and 06-13 wire a cell source"
affects: [06-11, 06-12, 06-13, 06-14, phase-07, ACTIVITY-05]

actuals:
  tokens: 27500
  tasks: 3
  commits: 7
plan_head_before: 062541c88c4592ab0abe4362b72b4ab51cc4e853
plan_head_after: 8dcd51cb63605e9f9490d146259e8b10f14cd6a7
commits: 7
commits_note: "7 measured from plan_head_before: five production commits (feat for the Task 1 tracer, test + feat for Task 2's TDD cycle, test for Task 3, test for the two assertions the new table moved in existing specs), one docs commit (the first SUMMARY, STATE and ROADMAP) and one fix commit that closed the Account record threat flag. plan_head_after is the head at the moment the ledger was measured; the commit that records this ledger is necessarily later than its own hash. tokens is chars/4 over the production and test changes in `git diff plan_head_before..plan_head_after` (about 110,000 chars), the scale the estimate used."

tech-stack:
  added: []
  patterns:
    - "a row view is built ONCE per dataset (parsed bytes, country name, games text) and every sort compares those, so a sort never re-parses 20,000 addresses"
    - "the table's keyed each uses the row INDEX, and no attribute of any row, cell or header holds an address: the privacy invariant is a property of the markup, asserted by walking every attribute"
    - "a cell is a value ({text, muted, hidden, title, tag}) chosen in the model, so a special value, a hidden string or a title is a unit-testable decision rather than a template expression"
    - "five e2e tests, three of them reading ONE already-rendered 12,000-row import (a serial describe with one beforeAll), because the CI budget prices by test count"

key-files:
  created:
    - "src/lib/core/windowing.ts"
    - "src/lib/features/logins/LoginTable.svelte"
    - "tests/unit/logins/login-blocks.test.ts"
    - "tests/e2e/logins/login-table.spec.ts"
  modified:
    - "src/lib/features/vehicles/vehicle-model.ts (windowing removed, re-exported)"
    - "src/lib/features/logins/login-model.ts"
    - "src/lib/features/logins/LoginHistory.svelte"
    - "src/lib/features/logins/login-shared.ts (a stale comment only)"
    - "tests/unit/logins/login-model.test.ts"
    - "tests/e2e/shell/dashboard.spec.ts (one assertion)"
    - "tests/e2e/logins/login-history.spec.ts (one assertion)"

key-decisions:
  - "Windowed ALWAYS, with no threshold branch: about 30 rows plus two spacers whatever the row count, and aria-rowcount carries the true size (listed rows + header + the Account record row when present)."
  - "The IP column is sortable while masked (UI-SPEC section 3 Decision): the order exposes only the relative position of the hidden last part among addresses that already share a visible prefix, and disabling it would reorder the table under the user's hands whenever the mask toggled."
  - "The IP cell's text lives in an inner block element (display:block; max-height:40px), because max-height has no effect on a table cell. That element is what the browser spec measures to prove a 39-character IPv6 address wraps to two lines and is never clipped."
  - "resetKey is `${importedAt}|${sort.key}|${sort.dir}` and never reads the mask, so toggling the mask keeps the scroll position, the sort and the focus."
  - "The Account record row exists for a readable or an unreadable address and not for a blank one or none: a row with nothing to show would be a row of dashes labelled as a fact. An unreadable address reads the fixed words `not readable`; `account.ip` is null for it, so there is nothing to leak."
  - "The recorded country is upper-cased for the NAME LOOKUP only. The account file's text is stored as written, a two-letter lower-case code still names a country, and anything that does not name one (including ZZ) is shown as written."
  - "The excluded pill is shown in the `no-usable` state as well as under the table, because the UI-SPEC's state matrix says so and 06-08 had not rendered it there."

patterns-established:
  - "Hoisting shared arithmetic: move it, then re-export from the old module with `export { ... } from`. The old module needed no local import because nothing left in it used the names, which a grep proved before the move."
  - "Before a sort test claims agreement with a naive reference, assert the fixture is big enough for the claim to mean something (both country buckets populated, more than 500 rows)."
  - "A mutation check on a privacy spec: making displayIp always reveal made the tracer and the Account record specs fail, so they are not vacuous. Restored byte for byte."

requirements-completed: [ACTIVITY-05]

coverage:
  - id: D1
    description: "One row per distinct address, windowed always: at most 30 rows in the DOM, aria-rowcount the listed rows plus the header (plus the Account record row), every rendered row with aria-rowindex"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-table.spec.ts#tracer: windowed, ranked, and no full address or hostile cell anywhere while masked"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-table.spec.ts#past the listing cap the table lists the cap, says how many it did not list, and stays windowed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sorting: first directions, the flip, no unsorted state, numeric IP order with IPv4 before IPv6, code-unit text order, specials last in both directions, the address tie-break, and a scroll back to the top"
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-model.test.ts#nextSort / sortLoginRows / sortLoginRows over the seeded export, against a naive reference (14 key and direction cases)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-table.spec.ts#sorts by every column with the specified first direction, scrolling back to the top, and keeps its state through the mask"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cell values: Unknown country (muted), exact grouped logins, YYYY-MM-DD with a dash and hidden text when unreadable, games in the fixed order or not recorded"
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-model.test.ts#loginCells (06-10, UI-SPEC section 3 Cell values)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pinned Account record row: its own tbody before the windowed body, never sorted or counted, follows the mask, shows the RECORDED country, dashes with hidden text, the tag, and is absent without an account address"
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-model.test.ts#the pinned Account record row (06-10, D-02)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-table.spec.ts#the Account record row is pinned, not counted, follows the mask, and shows what was recorded"
        status: pass
    human_judgment: false
  - id: D5
    description: "While masked, no unmasked address exists in the DOM, any attribute inside the scroller, the document title or the selection; an unparseable IP cell (email, name, markup) is nowhere in the page and appears only as a count in the excluded pill"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-table.spec.ts#tracer: windowed, ranked, and no full address or hostile cell anywhere while masked"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-blocks.test.ts#the table component keeps an address out of every attribute (06-10, T-06-37)"
        status: pass
    human_judgment: true
  - id: D6
    description: "The table scrolls inside login-scroller in both axes with a sticky header and first column, never the page; no inline style, transition or animation in any component"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-table.spec.ts#scrolls inside its own region with sticky axes, by keyboard, and never widens the page at 375px"
        status: pass
      - kind: unit
        ref: "tests/unit/logins/login-blocks.test.ts#no component under src/lib/features/logins styles inline, animates or injects HTML (06-10)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Toggling the mask re-renders text only: the table keeps its scroll position and sort, focus stays on the reveal button, nothing reorders"
    requirement: ACTIVITY-05
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-table.spec.ts#sorts by every column ... and keeps its state through the mask"
        status: pass
    human_judgment: false
  - id: D8
    description: "The count line reads the listed addresses and their logins, so listed rows plus the cap line's addresses equal the tile total and listed logins plus the cap line's logins equal the counted logins"
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/logins/login-blocks.test.ts#the count line reads the listed rows and their logins (06-10)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-table.spec.ts#past the listing cap ..."
        status: pass
    human_judgment: false
  - id: D9
    description: "The windowing helpers are hoisted without a byte of behaviour change: the vehicle unit and e2e suites pass unmodified"
    verification:
      - kind: unit
        ref: "tests/unit/vehicles (all) and tests/unit/guards/phase5-layout-guards.test.ts"
        status: pass
      - kind: e2e
        ref: "tests/e2e/vehicles/vehicle-stats.spec.ts (all 25 cases)"
        status: pass
    human_judgment: false

# Metrics
duration: 32min
started: 2026-10-04T10:34:00+04:00
completed: 2026-10-04T11:06:00+04:00
status: complete
---

# Phase 06 Plan 10: The IP table — windowed, sortable, masked, with a pinned Account record row

**One native table of distinct addresses sits under the tiles and the single reveal control: windowed always, sorted by exact rules, and holding no unmasked address in any attribute, selection or title while masked.**

## Performance

- **Duration:** about 32 min
- **Tasks:** 3 (the tracer, one TDD cycle, the browser specs) plus one follow-up commit for two assertions the new table moved and one fix commit for the Account record threat flag
- **Files:** 4 created, 7 modified

## Accomplishments

- `windowing.ts` holds the four windowing names and the `WindowRange` type, and `vehicle-model.ts` re-exports all five. The vehicle suites (368 unit tests across the vehicle, guard and login folders at that point, all 25 vehicle browser cases) passed with no edit, which is the proof the hoist changed nothing.
- `LoginTable.svelte` is the vehicle table's structure with the login table's decisions: a fixed 40px row, spacers sized through the CSSOM, an rAF-coalesced passive scroll listener, a keyed each on the row index, sticky header and first column, and a pinned Account record `tbody` ahead of the windowed one. No attribute of any row, cell or header holds an address.
- `login-model.ts` carries every decision the table makes as a pure function. Rows are built once per dataset with their parsed bytes, country name and games text, so a sort compares prepared values and never re-parses or re-formats 20,000 addresses. `sortLoginRows` is agreed against a naive reference written in the test (using the fixtures' own text-based `compareCanonicalIp`) for all seven keys in both directions over the seeded 12,000-row export.
- The browser specs read three claims off ONE 12,000-row import (the window and the privacy surfaces, every sort, the 375px layout with Page Down), then the Account record row on a small archive, then the over-cap archive.

## Task Commits

1. **Task 1 (tracer):** `2e28104` (feat). The hoisted windowing helpers drive a real three-column table from the real view.
2. **Task 2 (TDD):** `11af180` (test, RED: 40 failures in `login-model.test.ts` and 10 in `login-blocks.test.ts`) then `ad11ec0` (feat, GREEN).
3. **Task 3:** `9421a2c` (test). Five browser tests.
4. **Follow-up:** `d51211c` (test). The Activity card's button count and the no-usable pill (see Deviations 4 and 5).
5. **Fix:** `8dcd51c` (fix). An address-shaped Account record country or city reads `not readable` (Deviation 8).

No REFACTOR commit: the cleanup was folded into GREEN.

### TDD evidence

The RED run produced 50 failures across the two files and every one is an assertion or a `TypeError: x is not a function` for a symbol that did not exist yet; none is an `ENOENT` or a load error (the source contracts assert the file exists as an expectation, the pattern 06-08 recorded). **`gsd_run check tdd-red-evidence` was not run**: 06-08 found that it cannot classify a valid Vitest RED from either reporter (the unanchored `name="` regex reads `classname`), so its verdict would not have been evidence of anything. The failing counts above are the record.

## Verification

| Command | Result |
|---|---|
| `pnpm exec vitest run tests/unit/vehicles tests/unit/guards tests/unit/logins` | 435 passed |
| `pnpm run test:unit` | **2075 passed** (2074 before the fix commit, which added one case) |
| `pnpm run check` | clean |
| `pnpm run lint` | clean |
| `pnpm exec playwright test` | **218 passed** (19 files), run twice: once with the one failure described in Deviation 4, once clean after the fix |
| `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | 6 passed, **all four limits untouched** |
| `git diff main...HEAD -- src/lib/features/playtime` | 13 lines, ONE comment from 06-08 (not this plan's); `git diff 062541c..HEAD -- src/lib/features/playtime` is empty |

### The CI budget is now fully spent

218 listed tests project to `330 + 5 x (218 - 96) + 120 + 90 = 1150 s`, and `1.3 x 1150 = 1495 s` against a `globalTimeout` of 1500 s. **This plan used all five slots of headroom 06-08 recorded.** The next browser test anywhere in Phase 6 trips the guard, so plans 06-12 and 06-13 each have to raise `globalTimeout`, the `timeout Nm` wrapper and `timeout-minutes` together, with the guard's constants, in the same task. This plan raised nothing because the guard still passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The tracer's "300-address fixture" is the 900-address scale spec, without the sample account**
- **Found during:** Task 1
- **Issue:** `buildLoginsScaleSpec` draws from 600 IPv4 plus 300 IPv6 addresses, and `buildLoginsScaleExport` leaves the sample's `User_Info` in place, whose address becomes the pinned Account record row once Task 2 lands (it would have made `aria-rowcount` listed + 2 and broken the Task 1 assertion).
- **Fix:** the window and sort cases import the spec through `buildCustomExport` with `omitFolders: ['User_Info']` and take the expected count from `spec.distinctAddresses` (900), so `aria-rowcount` is 901 rather than 301. The Account record has its own case on its own archive.
- **Files modified:** `tests/e2e/logins/login-table.spec.ts`
- **Commit:** `2e28104`

**2. [Rule 1 - Bug] The tracer drew six columns with only three cells wired, and the block never left `loading`**
- **Found during:** Task 1 verification
- **Issue:** the first draft of `LoginHistory.svelte` passed `visibleLoginColumns(false)` (six columns) to a table whose `loginCells` returned three. A `TypeError: Cannot read properties of undefined (reading 'muted')` threw inside the render effect, and the block sat at `data-state="loading"` with no console message the spec could see. Twelve existing `login-history.spec.ts` cases failed with it, and a throwaway debug spec with a `pageerror` listener named the error.
- **Fix:** the tracer slice filters the columns to the three it wires; Task 2 replaced the filter with the full set.
- **Commit:** `2e28104` (fixed before the commit; the failing run was never committed)

**3. [Rule 1 - Bug] The "no animation" source scan matched `requestAnimationFrame`**
- **Found during:** Task 2 GREEN
- **Issue:** the RED test's `/animation|@keyframes|animate:/i` matched the scroll handler's `requestAnimationFrame` and `cancelAnimationFrame`, so it failed for a reason that has nothing to do with motion.
- **Fix:** narrowed to the declarations the plan names: `animation:`, `animation-*:`, `@keyframes` and the `animate:` directive.
- **Files modified:** `tests/unit/logins/login-blocks.test.ts`
- **Commit:** `ad11ec0`

**4. [Rule 3 - Blocking] A third existing assertion moved: the Activity card now holds seven buttons**
- **Found during:** the full Playwright run
- **Issue:** `dashboard.spec.ts (sections-pending)` asserted that the `activity-history` card holds exactly one button, the mask toggle (06-08's carve-out). The table adds six sort buttons, which are controls over the DATA exactly as the vehicle table's are.
- **Fix:** the assertion names them: the mask toggle once, the table's six sort buttons, seven in the card, so a future block that adds a control has to come back and own the line.
- **Files modified:** `tests/e2e/shell/dashboard.spec.ts` (outside the plan's `files_modified`)
- **Commit:** `d51211c`

**5. [Rule 2 - Missing critical functionality] The `no-usable` state did not show the excluded pill**
- **Found during:** Task 2
- **Issue:** UI-SPEC section 2's state matrix says `no-usable` shows "the excluded pill when its count is above 0". 06-08's block rendered only the sentence, so a user whose every address was unreadable got no count of why.
- **Fix:** the same `ExcludedNotice` (with `testId="login-excluded"`) now follows the sentence in `no-usable`, fed by `excludedCount(view)`, which reads `unreadable` for that view. `login-history.spec.ts` gained one assertion in its existing `no-usable` test (the pill shows `2 login rows without a readable IP address` and no table exists), so it costs no browser test.
- **Files modified:** `src/lib/features/logins/LoginHistory.svelte`, `tests/e2e/logins/login-history.spec.ts` (outside `files_modified`)
- **Commit:** `ad11ec0`, `d51211c`

**6. [Rule 1 - Bug] A stale comment in `login-shared.ts` (the carry-forward)**
- **Issue:** it said the stored order is "plain code-unit comparison" while `login-aggregate.ts` sorts with `compareIp` (numeric, IPv4 before IPv6).
- **Fix:** the comment now says what the code does, and says why a code-unit comparison would be wrong (`192.0.2.9` precedes `192.0.2.10`). `login-shared.ts` is outside `files_modified`; the carry-forward directed the edit.
- **Commit:** `ad11ec0`

**7. [Rule 3 - Blocking] `login-model.ts`'s header said "no copy"**
- **Issue:** the plan has `loginCells` read the `ui-copy` constants (Unknown country, the dash, the hidden strings), so the module's header claim became false. No test forbids the import; the header was the only contract.
- **Fix:** the header now says the table cells are composed here from `ui-copy`'s exports and that `Intl` remains out (the country NAME is still supplied as `nameOf`).

**8. [Rule 2 - Missing critical functionality] An address-shaped Account record country or city would have shown unmasked**
- **Found during:** writing this SUMMARY's threat scan, and closed on review
- **Issue:** the account file's country and city cells are rendered as written (UI-SPEC section 3: "anything else as written"), and that wording was meant for values like `unknown`. A hostile export that put `192.0.2.10`, an IPv6 address or `home 192.0.2.10` in either cell would have put an unmasked address on screen while masked, contradicting the plan's must-have truth, which has no carve-out. `parseIp` alone would not have caught it, because it only recognises a cell that is exactly an address.
- **Fix:** `accountCells` reads the fixed words `not readable` (the frozen `LOGIN_NOT_READABLE`, the same text an unreadable account IP shows) for a recorded country or city that contains a colon or a dotted run of digits. A country or city name contains neither, so a normal name (`Côte d’Ivoire`, `St. Petersburg`) is still shown as written. The same rule will cover the City column when plans 06-11 and 06-13 draw it, because the check lives in `accountCells`.
- **Files modified:** `src/lib/features/logins/login-model.ts`, `tests/unit/logins/login-model.test.ts` (four hostile shapes, masked and revealed, plus the normal-name case)
- **Commit:** `8dcd51c`
- **Also in that commit:** one assertion in the Account record spec that a new dataset opens on the default sort, covering the sort rune's reset at no browser-test cost.

**Total deviations:** 8, none architectural. Nothing here changes the plan's behaviour.

## Decisions Made

See `key-decisions` above. The two worth repeating: the IP cell's wrapping box is an inner element (`max-height` does nothing on a `<td>`), and `resetKey` never reads the mask.

## Issues Encountered

**A scripted edit duplicated half a file.** The first Task 2 edit script located its end anchor with `str.index("What the live region says, and nothing else.")`, and a shorter prefix of that phrase occurs earlier in the same file, so the slice ran backwards and duplicated a block between the two. `eslint` caught it (`no-useless-assignment` on five variables whose uses had moved). The file was restored from the Task 1 commit with `git checkout -- <that one file>` and the edit redone with the full, unique anchor. No other file was affected.

## Findings for the orchestrator

1. **The CI budget has zero headroom.** See above. 06-12 and 06-13 must each raise the four limits together when they add a browser test. Folding their cases into existing tests is not available (their surfaces are new).
2. **The sort-arrow glyphs are literals in the component.** `LoginTable.svelte` writes `↑` and `↓` inline, following `VehicleTable.svelte`'s precedent, because `ui-copy.ts` is frozen and has no constants for them. The glyphs are `aria-hidden` and the direction is announced by `aria-sort`. If the freeze is lifted they belong in `ui-copy.ts` for both tables.
3. **The `visually-hidden` class is a scoped rule in the component**, like `sr-only` in the vehicle table, because scoped styles cannot be shared. The two are the same rule under two names.
4. **The carried-forward `T-04-01` check is not literally empty.** `git diff main...HEAD -- src/lib/features/playtime` shows 13 lines: one comment in `Playtime.svelte` that 06-08 changed to name the file it replaced. It is comment-only and was not this plan's; `git diff 062541c..HEAD -- src/lib/features/playtime` (this plan's range) is empty.
5. **`gsd_run check tdd-red-evidence` remains unusable for Vitest** (06-08's finding). Not re-investigated.

## Known Stubs

- **The City column's cells are a dash** (`src/lib/features/logins/login-model.ts`, `loginCells(...).city`; the Account record's city already shows the recorded value). The plan says the column is declared here with no cell source wired. It is **unreachable**: `visibleLoginColumns(false)` omits it and `LoginHistory.svelte` passes `false` until city detail is loaded. Plans 06-11 and 06-13 own the wiring, and the `loginCells` city branch is what they replace. **The `.planning/WINDOWS.md` append failed**: `windows append` reported that the ledger's rendered table disagrees with its fenced JSON for rows 8 and 9, which pre-dates this plan, and it says never to hand-edit the table. The ledger is best-effort, so nothing was forced; the stub is recorded here only, and whoever repairs the ledger should add it.

## Threat Flags

None outstanding. The one new surface this plan found, the Account record's country and city cells rendered as written, is closed by Deviation 8.

## Self-Check: PASSED

- All four created files exist: `src/lib/core/windowing.ts`, `src/lib/features/logins/LoginTable.svelte`, `tests/unit/logins/login-blocks.test.ts`, `tests/e2e/logins/login-table.spec.ts`.
- All seven commits exist: `2e28104`, `11af180`, `ad11ec0`, `9421a2c`, `d51211c`, `1166cbf` (docs) and `8dcd51c` (fix). The TDD ordering is RED (`11af180`) before GREEN (`ad11ec0`).
- Every `<acceptance_criteria>` re-run:
  - Task 1: `windowRange`, `ROW_PX`, `OVERSCAN_ROWS` and `SCROLLER_MAX_PX` export from `windowing.ts` and import from `vehicle-model.ts`; the vehicle unit and e2e suites pass unmodified. **PASS.** With 900 listed addresses the page holds at most 30 `login-row` elements and `aria-rowcount` is 901 (the plan's 300/301, scaled; Deviation 1). **PASS.** The first drawn row has the oracle's largest `data-logins` and the cells are masked. **PASS.**
  - Task 2: the sort tests agree with the naive reference for every key in both directions. **PASS.** The Account record presence rule is false for blank and for none, true for readable and unreadable. **PASS.** No component under `src/lib/features/logins` has a `style=` attribute, a `style:` directive, a `transition` or an `animation` declaration. **PASS.**
  - Task 3: all ten cases pass in Chromium, grouped into five tests (the grouping is stated in the spec's header). **PASS.** The hostile cells' text appears nowhere in `document.body.innerHTML` and the excluded pill shows its count. **PASS.** `ci-budget.test.ts` passes with the four limits untouched. **PASS.**
- A mutation check: making `displayIp` return the address unmasked failed the tracer and the Account record specs; the file was restored byte for byte.
- The plan-level `<verification>` re-run: `pnpm run test:unit` (2075 after the fix commit), `pnpm run check`, `pnpm run lint`, `pnpm exec playwright test` (218), `ci-budget.test.ts` (6).

## User Setup Required

None. No package was installed (T-06-SC accepted) and nothing in the table requests anything.

## Next Phase Readiness

- **06-11 and 06-13** wire the City column: replace the `city` branch in `loginCells` and `accountCells`, pass `visibleLoginColumns(true)` from `LoginHistory.svelte` once city detail is loaded, and the table's width, header, sort key (`city`, ascending first) and test hook (`login-sort-city`) already exist. A City sort today degrades to the address order, which is correct while no row has a city.
- **06-12** (the map) is untouched by this plan: no import of `world-map.generated.ts` anywhere.
- **Budget:** see Finding 1.

---
*Phase: 06-login-ip-history-offline-geolocation*
*Plan: 10*
*Completed: 2026-10-04*
