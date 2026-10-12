---
phase: 06-login-ip-history-offline-geolocation
plan: 12
subsystem: ui
tags: [svelte-5, svg, choropleth, log-scale, roving-focus, a11y, playwright, offline-geo]

requires:
  - phase: 06-login-ip-history-offline-geolocation
    provides: "the generated world map (235 shapes, 14 undrawable codes) from 06-07, the per-country tallies in LoginsView from 06-03, the login block and the table it sits under from 06-08 and 06-10, the frozen map copy from 06-02, countryName from 06-06"
  - phase: 04-activity-time-dashboards
    provides: "the six --ramp tokens, ChartLegend, ChartTooltip and the clampTooltip placement the map reuses"
provides:
  - "src/lib/features/logins/map-model.ts: mapLevel (exact integer log scale), legendSteps, levelsInUse, rankCountries, mapNavigate, mapSummaryArgs"
  - "WorldMap.svelte: one static SVG, one path per generated shape, a third ChartTooltip, one tab stop with roving focus, one overlay ring, tiny-country markers"
  - "CountryList.svelte: a closed-by-default native details with a 320px scroller carrying every number as text"
  - "LoginMapSection.svelte: heading, summary sentence, hint, frame, the reused ChartLegend, the always-visible DB-IP attribution, the not-drawn line and the list, keyed on the dataset"
  - "the Phase 6 ramp pairs pinned in contrast.test.ts, and seven browser tests in tests/e2e/logins/login-map.spec.ts"
affects: [06-13, 06-14, phase-07, ACTIVITY-06]

actuals:
  tokens: 26270
  tasks: 3
  commits: 8
plan_head_before: 211470ced3a14f2a05eeba6d053c014529ce49af
plan_head_after: c0404a0904fdd50b8a288a6a6675e1989ac7463f
commits_note: "8 measured from plan_head_before: seven code and test commits (feat x2: the tracer and GREEN; test x4: RED, the browser specs, the replace timeouts and the 235 pin; fix x1: scrollend) plus the first docs commit `0fd748e`. plan_head_after is the head at the moment the ledger was measured; the docs commit that records this correction is necessarily one commit later than its own hash. tokens is chars/4 over the changed lines of the diff, not the file sizes (the files total about 43,600 by that measure)."

tech-stack:
  added: []
  patterns:
    - "A log scale is decided in INTEGERS: level L starts at the smallest count with count^4 >= max^(L-1), compared in BigInt, so the shade a country is painted with and the step the legend prints share one definition and cannot disagree at an exact boundary"
    - "A keyboard tooltip anchors to a zero-size SVG circle moved to the centroid and MEASURED, so the browser's own transform does the viewBox-to-viewport conversion and the shared tooltip's stale check has a real element to compare"
    - "A tooltip that a scroll closes is reopened on `scrollend`, only after a Tab into the control and never after Escape"
    - "Expected countries in a browser spec come from a naive BigInt range scan over the fixture CSV, sharing no code with the lookup under test"

key-files:
  created:
    - "src/lib/features/logins/map-model.ts"
    - "src/lib/features/logins/WorldMap.svelte"
    - "src/lib/features/logins/CountryList.svelte"
    - "src/lib/features/logins/LoginMapSection.svelte"
    - "tests/unit/logins/map-model.test.ts"
    - "tests/e2e/logins/login-map.spec.ts"
  modified:
    - "src/lib/features/logins/LoginHistory.svelte"
    - "tests/unit/charts/contrast.test.ts"
    - "playwright.config.ts"
    - ".github/workflows/ci.yml"

key-decisions:
  - "The log-scale level is an exact integer comparison, not Math.log. The UI-SPEC formula is the definition; the implementation evaluates it without floating point, and the unit test compares the two everywhere that is not on a boundary."
  - "The summary sentence's leader is the first country WITH an English name, which is the Top country tile's own rule, so the sentence and the tile can never name different countries. CountryRow carries `named` for it."
  - "Hover and keyboard share ONE overlay ring (hover first), so the ring is two sibling paths and the node bound is shapes + 2 per tiny country + 3, not the UI-SPEC's literal `+ tiny + 3`."
  - "The legend shows the levels the DRAWN countries use, and the scale's maximum includes countries with no shape: the scale is the logins' and the legend explains what is painted."
  - "The CI e2e budget moves to globalTimeout 26 min, wrapper 28 min and job 36 min, raised in Task 1 (the 219th test tripped the guard) and sized for the seven tests this plan ends with."

patterns-established:
  - "Group browser cases by what they share: seven tests carry the plan's twelve cases, three of them reading one rendered import."
  - "A replace helper returns while the old dataset is still on screen; a spec waits on a value only the new dataset has before it reads anything else."

requirements-completed: [ACTIVITY-06]

coverage:
  - id: D1
    description: "The world map is one static SVG with one path per generated shape and nothing per login: the node count is the same at 100 and at 10,000 logins over the same countries and is within the bound, and the SVG holds no text or title"
    requirement: ACTIVITY-06
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#the node count is the same at 100 and at 10,000 logins, within the bound, and the sums hold"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#tracer: a real import shades the right countries at the level the scale rule gives, and the SVG holds no text"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shading is logarithmic over countries only, level 0 for none, level 1 for a count of 1 and level 5 at the maximum; the legend shows level 0 and the levels in use and states each step's first count in words"
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/logins/map-model.test.ts#mapLevel (UI-SPEC \"Scale rule\") and #legendSteps"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#the map on one rendered import > states every number in words"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shading is never the only carrier of a value: the tooltip, the accessible name, the summary sentence, the legend note and the country list give every number as text, and the six ramp pairs against white are pinned"
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/charts/contrast.test.ts#the login map ramp pairs (06-UI-SPEC Color, Map shading)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#the map on one rendered import > states every number in words"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tooltip, keyboard and focus: the map is ONE tab stop entering on the highest-ranked country with a shape, arrows follow the ranked order and stop at the ends, Home and End jump, Escape hides the tooltip without moving focus, and the overlay ring is the only focus mark"
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/logins/map-model.test.ts#mapNavigate"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#the map on one rendered import > is one tab stop that enters on the leader, follows the ranked order and stops at both ends"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#the map on one rendered import > hovering a country shows the two specified lines and a ring, never an address, and leaving hides both"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ranking is by logins descending then English name then code in code-unit order, and the same order drives the arrow keys, the list and the summary sentence's leader, which is the Top country tile's leader"
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/logins/map-model.test.ts#rankCountries and #the leader the sentence names is the leader the Top country tile names"
        status: pass
    human_judgment: false
  - id: D6
    description: "Empty and single cases: no country shows the heading and the no-country sentence only, one country takes the singular form, one country holding every login takes the all-logins form, and an all-unknown export still shows the unknown-country tile"
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/logins/map-model.test.ts#mapSummaryArgs"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#the summary takes the one, all-logins and many forms, the legend its single-login note, and no country shows only the heading"
        status: pass
    human_judgment: false
  - id: D7
    description: "A country with logins and no polygon has no map element, is listed with the not-drawn suffix and counted in the not-drawn line, and drawn plus not-drawn plus unknown logins equal the counted logins"
    requirement: ACTIVITY-06
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#the node count is the same at 100 and at 10,000 logins, within the bound, and the sums hold"
        status: pass
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#the map on one rendered import > states every number in words"
        status: pass
    human_judgment: false
  - id: D8
    description: "The DB-IP attribution is always visible with the map, with a link to db-ip.com carrying rel noreferrer noopener, and the not-drawn line appears only above zero"
    requirement: ACTIVITY-06
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#the map on one rendered import > states every number in words"
        status: pass
    human_judgment: false
  - id: D9
    description: "The country list is a native details closed by default holding a 320px scroller table with Country, Logins and IP addresses, one row per country in ranked order, and a final muted Unknown country row"
    requirement: ACTIVITY-06
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#the map on one rendered import > states every number in words"
        status: pass
    human_judgment: false
  - id: D10
    description: "No animation, transition or inline style on the map, the shading, the ring or the tooltip, the generated map is imported statically and joins the main chunk with no extra chunk, and the ramp is read as var(--ramp-N) only"
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/logins/map-model.test.ts#the map components are plain, scoped and still"
        status: pass
      - kind: other
        ref: "pnpm run build: dist/assets holds index-*.js, ingest.worker-*.js and one css file; the main chunk contains the generated path data; no d3-geo, topojson or world-atlas string in it"
        status: pass
    human_judgment: false
  - id: D11
    description: "At 375px the map frame fits the 295px card inner width with no horizontal page scroll and the ranked list is reachable by keyboard; the visual impression of the scaled overview needs a human eye"
    requirement: ACTIVITY-06
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#at 375px the frame fits the card, the page does not scroll sideways, tooltips at the four edges stay on screen and the list is reachable by keyboard"
        status: pass
    human_judgment: true
    rationale: "A DOM measurement proves the frame fits and nothing scrolls sideways; it cannot prove that a 295px overview of 235 shapes is legible, which is the end-of-phase human check the plan names."
  - id: D12
    description: "A tooltip opened for the countries at the map's four extremes stays inside the viewport with the 8px edge margin, pointer-anchored"
    requirement: ACTIVITY-06
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-map.spec.ts#at 375px the frame fits the card ... tooltips at the four edges stay on screen"
        status: pass
    human_judgment: true
    rationale: "The backstop check places the pointer at a computed point over each extreme country; it cannot see the path a real pointer takes across an irregular coastline."

# Metrics
duration: 38min
started: 2026-10-04T11:18:00+04:00
completed: 2026-10-04T11:56:00+04:00
status: complete
---

# Phase 06 Plan 12: The country map, its log-scale legend, one-stop keyboard model and ranked list

**A hand-rolled SVG world map shades each country by a logarithmic level computed in exact integers, with a tooltip, one tab stop, an always-visible DB-IP attribution and a ranked list that carries every number as text; its 235 paths and the generated map join the main chunk, and its node count does not move between 100 and 10,000 logins.**

## Performance

- **Duration:** about 38 min
- **Tasks:** 3 (the tracer, one TDD cycle, the browser specs) plus one fix commit and two follow-up commits
- **Files:** 6 created, 4 modified

## Accomplishments

- `mapLevel` evaluates the UI-SPEC's `1 + min(4, floor(4 ln(count) / ln(max)))` as `count^4 >= max^(L-1)` in BigInt. `Math.log` is not exact at a count that sits on a boundary (2 of 16, 10 of 10,000), so a floating-point level could shade a country one step too light while the legend printed the boundary one step higher. The legend's step starts come from the same function, and a unit test checks that every start maps back to its own level for maxima 2, 10, 16, 81, 1000, 10^4, 10^6 and 10^8.
- The map is one `<svg>` with a path per generated shape, a marker and a hit circle per tiny country WITH logins, an overlay ring of two paths, and one anchor circle. Nothing is per login, no `<text>` or `<title>` exists, and every country with logins carries its figures as its accessible name.
- Interaction is six handlers delegated to the `<svg>`: one tab stop (the highest-ranked country with a shape, then the last focused), arrows in ranked order, Home and End, Escape. Hover and keyboard share one ring, and the keyboard tooltip is anchored by measuring a zero-size circle moved to the centroid.
- `LoginMapSection` composes the heading, the sentence, the hint, the frame, the reused `ChartLegend`, the attribution, the not-drawn line and the list, and `LoginHistory` keys it on `importedAt` so a replace starts it from nothing.
- The Phase 6 ramp table is parsed out of the UI-SPEC and recomputed against `src/app.css` in `contrast.test.ts`.
- **Main-chunk proof (`pnpm run build`, no `GEO_FIXTURE`):** `dist/assets` holds `index-*.js` (325 kB), `ingest.worker-*.js` and one stylesheet, and nothing else. The generated path data (`M484.1,118.5`, the first shape) is in `index-*.js`. No lazy chunk appeared, and `d3-geo`, `topojson` and `world-atlas` do not occur in it. The `world-map.test.ts` guard that asserts this against `dist/` passes.

## Task Commits

1. **Task 1 (tracer):** `fce6421` (feat). `mapLevel`, `rankCountries`, a thin `WorldMap`, the section and the block wiring, with a browser tracer against the 12,000-row scale export. It also carries the CI budget raise (Deviation 1).
2. **Task 2 (TDD):** `b05f2dd` (test, RED: 22 of 44 failing) then `2d2073f` (feat, GREEN: 44 of 44).
3. **Fix found in Task 3:** `3c93555` (fix). The keyboard tooltip is reopened on `scrollend` (Deviation 2).
4. **Task 3:** `30918e2` (test). Six browser tests beside the tracer.
5. **Follow-up:** `1328863` (test). The first assertion after each replace gets 30 s (Deviation 3).
6. **Follow-up:** `c0404a0` (test). The node-count bound reads a literal 235 and the test first asserts the generated module holds 235 shapes, so a regenerated map cannot move the bound silently.

No REFACTOR commit: the cleanup was folded into GREEN.

### TDD evidence

The RED run failed 22 of 44 tests and every one is an assertion on the planned behaviour: the exports existed as lint-clean stubs (`void`-referenced parameters) returning `[]`, the unchanged index, `{ form: 'none' }`, so no failure is a missing function, a load error or an `ENOENT`. The component source scans for the three map components assert the file exists as an expectation, the pattern 06-08 recorded, so `CountryList.svelte` failed as "does not exist". **`gsd_run check tdd-red-evidence` was not run**: this plan is `type: execute`, so the plan-level gate does not apply, and 06-10 recorded that the checker cannot classify a Vitest RED. The failing count is the record.

## Verification

| Command | Result |
|---|---|
| `pnpm exec vitest run tests/unit/logins tests/unit/charts` | 353 passed |
| `pnpm run test:unit` | **2229 passed** (73 files) |
| `pnpm run check` | clean |
| `pnpm run lint` | clean |
| `pnpm exec playwright test tests/e2e/logins/login-map.spec.ts` | 7 passed in isolation after the GREEN and scrollend commits (twice in a row), and again after the 235 pin (the last isolated run). The replace-timeout follow-up was exercised by the second full run |
| `pnpm exec playwright test` (full) | **225 passed** (225 listed, 20 files, 4.5 min on 8 workers). The first full run had 224 passed and 1 failed (Deviation 3); the second, after the fix, is clean |
| `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | 6 passed |
| `pnpm exec vitest run tests/unit/geo/world-map.test.ts tests/unit/guards` | 135 passed against a fresh `dist/` |

### The CI budget, and what is left

218 listed tests were the whole budget (1150 s projected, floor 1495 s against 1500 s). This plan ends at **225 listed tests in 20 files**: `330 + 5 x (225 - 96) + 120 + 90 = 1185 s`, a floor of `1.3 x 1185 = 1540.5 s`, and `ceil(1540.5 / 60) = 26` min. `globalTimeout` is now **26 min**, the `timeout` wrapper **28 min** and the job **36 min**, the same G, G + 2, W + 8 relationship as before. 26 min holds up to **228 tests**, so plan 06-13 has three browser tests of headroom before it must raise all three again. The constants in `tests/unit/guards/ci-budget.test.ts` did not change: the guard counts the tests with `playwright test --list` and compares the projection with the live config, so a new test moves its input without moving a constant. Only the explanatory comments in `playwright.config.ts` and `ci.yml` were extended.

## Decisions Made

- **Exact integers for the scale.** See Accomplishments; the unit test keeps the float formula as an independent instrument away from boundaries and pins the boundaries by hand.
- **The legend explains what is painted.** `levelsInUse` reads drawn countries only, while the scale's maximum includes a leader with no shape (Gibraltar can set the top of the scale and paint nothing).
- **One ring, two paths, no group.** The UI-SPEC's `+ 3` is the ring (two paths) plus the keyboard anchor circle, so the wrapper `<g>` the plan imagined was dropped.
- **`LoginMapSection` takes `unknown` and `totalLogins` as well as the countries.** The plan said "the view's countries and the name function"; the summary sentence's `{t}` and the list's final row need the other two, and both are counts.
- **The attribution link is a plain anchor with `rel="noreferrer noopener"` and `target="_blank"`.** Following it is a user navigation, not a request the page makes. Its `href` (`https://db-ip.com`) is a literal in `LoginMapSection.svelte`: `ui-copy.ts` is frozen and holds no URL constant for it, and the UI-SPEC section 4 attribution row is the source of the literal. A missing constant is a finding, not a constant to add, so it is recorded here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The CI budget was raised in Task 1, not Task 3**
- **Found during:** Task 1 (the first full `pnpm run test:unit`)
- **Issue:** 06-10 had spent all five slots of headroom, so the tracer's browser test was the 219th and failed `ci-budget.test.ts` (1.3 x 1155 = 1501.5 s against 1500 s). The plan scheduled the raise for Task 3, but a red guard between commits is a broken commit.
- **Fix:** `globalTimeout` 25 to 26 min, the wrapper 27 to 28 min, `timeout-minutes` 35 to 36, sized for the seven tests the plan ends with (see above). The guard's constants did not need to change.
- **Files modified:** `playwright.config.ts`, `.github/workflows/ci.yml`
- **Commit:** `fce6421`

**2. [Rule 1 - Bug] Tabbing into an off-screen map showed no tooltip**
- **Found during:** Task 3 (the keyboard case read a `null` tooltip box right after `toBeVisible` had passed)
- **Issue:** the browser scrolls a focused element into view, and under the page's smooth scrolling that is a glide. The shared tooltip closes when its anchor has moved, which is correct for a reader scrolling away and wrong for a focus that is the cause of the scroll, so the tooltip opened and was closed again a few frames later.
- **Fix:** `WorldMap` reopens the tooltip on `scrollend`, only after a Tab into the map (arrow moves use `preventScroll` and never need it) and never after Escape. An arrow pressed during the glide does not forget the pending reopen.
- **Files modified:** `src/lib/features/logins/WorldMap.svelte`
- **Commit:** `3c93555`

**3. [Rule 1 - Bug] The node-count spec failed in the full suite and passed alone**
- **Found during:** the first full Playwright run (224 passed, 1 failed)
- **Issue:** `replaceExport` returns once the confirm panel is gone, while the new export is still importing. Alone, a 10,000-row replace lands inside the default five seconds; with eight workers contending it did not, so Germany still read 40 and not 4,000. A test problem, not a product one.
- **Fix:** the first assertion after each replace carries a 30 s timeout. Every later assertion reads the new dataset.
- **Files modified:** `tests/e2e/logins/login-map.spec.ts`
- **Commit:** `1328863`

**4. [Rule 2 - Missing critical functionality] `CountryRow` gained a `named` field**
- **Issue:** the plan's `rankCountries` returns `{ cc, name, logins, ips, drawn }`. `loginTiles` skips a country `nameOf` cannot name, so a sentence that led with the first row could name a different country from the Top country tile, which the plan forbids.
- **Fix:** `named` is false when `name` is the code standing in, and `mapSummaryArgs` leads with the first named row. A unit test builds a view with an unnameable code and asserts the sentence and the tile agree.
- **Files modified:** `src/lib/features/logins/map-model.ts`, `tests/unit/logins/map-model.test.ts`
- **Commit:** `2d2073f`

### Recorded departures from the plan's text

- **Node bound.** The plan and UI-SPEC say `shapes + tiny + 3`. The UI-SPEC also specifies a marker circle AND a hit circle per tiny country, which is two nodes, so the bound the spec asserts is `235 + 2 x (tiny countries with logins) + 3`. The ring (two paths) plus the keyboard anchor circle are the three. 235 is the shipped shape count, not the UI-SPEC's 238 ceiling.
- **Twelve cases, seven tests.** The CI budget prices by test count, so the plan's twelve browser cases are grouped: (1) and (2) and (12) in the node-count test, (3), (5), (6), (8), (9) and (11) in the one-import describe, (4) and (10) in the 375px test, (6)'s other forms and (7) in the forms test. No case was dropped.
- **Task 3's keyboard sequence starts at the table's last sort button, not its scroller.** Tab from the scroller enters the table's sort buttons first, which are tab stops inside it; the map is the next stop after `login-sort-games`. The stop after the map is the DB-IP link, which is the document order UI-SPEC section 9 states, not the list's summary.
- **`WINDOWS.md`** was not touched: rows 8-9 are corrupt (pre-existing), so `windows append` fails, as directed.

### Deferred, out of scope

- `svelte-check` reports three errors that were already there: `LoginsView` is not exported from `worker-messages.ts` (line 4 of `LoginHistory.svelte`, a line this plan did not write) and two in `PlayerStats.svelte`. `tsc -b`, which is the project's `check`, is clean; `svelte-check` is not a project script. None is in a file this plan created.

## Known Stubs

None. The City column is declared and unwired, as directed; wiring it is 06-13's.

## Threat Flags

None beyond the plan's register. The one new external surface is the DB-IP attribution link (T-06-47), and its `rel` and `target` are asserted in the browser. T-06-46 is covered by the masked check over the section, the tooltip and the list; T-06-48 by the 100-versus-10,000 node count; T-06-49 by interpolating names as text.

## Self-Check: PASSED

All six created files exist, all six task commits (`fce6421`, `b05f2dd`, `2d2073f`, `3c93555`, `30918e2`, `1328863`) are in the log, and `git status` showed only this SUMMARY untracked before it was committed.
