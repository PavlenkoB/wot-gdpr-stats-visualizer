---
phase: 07-mobile-layout-public-deploy
plan: 05
subsystem: ui
tags: [css, mobile, touch-targets, playwright, sweep, ci-budget, nav-offset]

requires:
  - phase: 07-mobile-layout-public-deploy
    provides: "plan 07-04's touch tooltips on all four chart surfaces, the `chromium-mobile` project and the CI e2e budget at L = 242 / G = 28"
provides:
  - "The one phone-width block in `src/app.css`: 16px page padding and a global 44px `min-height` floor (with `box-sizing: border-box`) for button, summary and a"
  - "The nav paying for its own taller links: a phone-width rule in `DashboardNav.svelte` trims the block padding to 5.5px, so the nav is 57px against 56.59px and `--nav-offset` stays 72px"
  - "`tests/e2e/shell/mobile-sweep.spec.ts`: six 375x812 tests proving no section, banner, opt-in state or wide table scrolls the PAGE sideways, with every surface asserted present before it is measured"
  - "`tests/e2e/shell/touch-targets.spec.ts`: three touch-project tests measuring every enumerated control at 44x44, the Start over mis-tap guard and the nav-offset contract"
  - "The CI e2e budget raised one step: L = 251, E = 1303 s, floor 1693.9 s, G = 29 / W = 31 / J = 39"
affects: [07-06-public-deploy, ci-budget, nav-offset, login-map-spec]

actuals:
  tokens: 9300
  tasks: 3
  commits: 6

plan_head_before: e07efb1048f7866fcb37b91dad2548f67835996d
plan_head_after: 8371f7118102b232ab90ce29e1c138056838e1bd

tech-stack:
  added: []
  patterns:
    - "A touch-target floor is ONE global rule in the one phone-width block, not a per-component rule; the spec that proves it enumerates the controls that exist today, so a later control whose own rule defeats the floor fails by name and size"
    - "When a global floor would change a number many things read (`--nav-offset`), the one component that grows pays for it locally (trims its own padding) instead of moving the number"
    - "A sweep that measures the DOCUMENT, not the scrollers, and asserts every surface PRESENT before measuring it, so a deleted section fails instead of turning the file into a green no-op"

key-files:
  created:
    - tests/e2e/shell/mobile-sweep.spec.ts
    - tests/e2e/shell/touch-targets.spec.ts
  modified:
    - src/app.css
    - src/App.svelte
    - src/lib/shell/DashboardNav.svelte
    - tests/e2e/logins/login-map.spec.ts
    - playwright.config.ts
    - .github/workflows/ci.yml
    - tests/unit/guards/ci-budget.test.ts

key-decisions:
  - "The nav's block (vertical) padding is 5.5px at phone width, the one documented off-scale value; the 8px horizontal inset is untouched. The alternatives were a link under 44px or moving an offset four components and ten specs read; 5.5px is also the tightest value that keeps the 3px focus ring (2px offset) inside the nav's `overflow-y: hidden` clip."
  - "The 480px block's `min-height: 44px` carries `box-sizing: border-box` with it rather than as a global reset, because the project has no border-box reset and a content-box 44px would stack padding and border on top (the city Load button would measure about 60px)."
  - "The page padding lives in `App.svelte`'s scoped block as well as in `app.css`: a Svelte scoped rule outranks a bare type selector, so the global `main { padding: 16px }` alone is dead at every width (measured in Task 1)."
  - "D-08's coarse-pointer wording is implemented as phone width in the single block, because the UI-SPEC allows exactly one media block; the touch project's 375px viewport is the proof."

patterns-established:
  - "Nav height contract: nav height + 16 <= `--nav-offset` + 1, and phone height within 1px of desktop height, asserted on the touch project"
  - "Touch spec routing: a `touch-` file prefix runs only on `chromium-mobile`; `mobile-sweep.spec.ts` deliberately does NOT use the prefix because a mobile-emulated context can report `scrollWidth` through different layout metrics"

requirements-completed: [PLATFORM-01]

coverage:
  - id: D1
    description: "At 375px the page padding drops to 16px exactly at 480px (24px at 481px), and the empty page and an imported dashboard do not scroll the page sideways."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/mobile-sweep.spec.ts#padding: 16px at 375px and 24px at 481px, and neither state scrolls the page sideways"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every button, summary and link in the enumerated list (nav links, Start over, Clear data, both confirm buttons, every vehicle and login sort header, column picker, battle-type, monthly-table, spend-breakdown and country-list summaries, the reveal toggle, the city Load button and the attribution link) is at least 44x44 at 375px on the touch project."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-targets.spec.ts (three tests, chromium-mobile)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The nav is 57px at 375px against 56.59px before the floor, `--nav-offset` stays 72px, and the eight existing 375px specs pass unmodified."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-targets.spec.ts#the nav links and the persistent bar are 44px targets, Start over opens the confirm panel and clears nothing, and the nav still fits --nav-offset"
        status: pass
      - kind: e2e
        ref: "scroll-nav, uat-criteria, dashboard, playtime-ui-review, playtime-charts, vehicles, login-table, login-history — 126 passed, playtime-charts.spec.ts and scroll-nav.spec.ts byte-identical"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tapping Start over opens the confirm panel and clears nothing (T-07-17)."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/touch-targets.spec.ts#the nav links and the persistent bar are 44px targets, Start over opens the confirm panel and clears nothing, and the nav still fits --nav-offset"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full 375px sweep: full dashboard with every disclosure open, activity and logins, banners and long text, the city opt-in in idle/downloading/cancelled/error/ready, and the tables-and-map box. No state scrolls the page sideways; the tables keep their own scroll box with a held first column; the map only scales; the opt-in states its size and adds no copy."
    requirement: PLATFORM-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/mobile-sweep.spec.ts (six tests, chromium)"
        status: pass
      - kind: other
        ref: "mutation check: a 600px min-width on main in the 480px block failed all six sweep tests with the measured overflow, then was reverted"
        status: pass
    human_judgment: false
  - id: D6
    description: "The UI-SPEC focal-point sentence that places the count tiles, the beginning of the login table or heatmap, and the world map inside the first 812px at 375px is not testable as written (the map sits below the Playtime block in document order); it is carried as a manual check on the first live deploy."
    verification: []
    human_judgment: true
    rationale: "The map is below the Playtime block in document order, so the sentence cannot be asserted as written; only the identity header and nav above the fold are asserted, and the rest is a manual look at the first live deploy (07-06)."
  - id: D7
    description: "The CI e2e limits match the final listed count of 251 tests."
    verification:
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts — pins projectedE2eSeconds(251) === 1303; 6 passed"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test, both projects: 251 passed in 2.6 min locally"
        status: pass
    human_judgment: false

duration: 100min
completed: 2026-10-05
status: complete
---

# Phase 7 Plan 5: Phone-width layout, 44px touch targets and the 375px sweep Summary

**One 480px block gives the page 16px padding and every button, summary and link a 44px floor, the nav absorbs its taller links by trimming its own padding so `--nav-offset` stays 72px, and a six-test 375px sweep plus a three-test touch-target spec prove no state scrolls the page sideways and every control is a real target.**

## Performance

- **Duration:** about 100 min across two agents (the first died on an API 429 after Task 1 and a partial Task 2; this continuation took about 35 min)
- **Started:** 2026-10-05 (first agent, Task 1 committed 20:47 +0400)
- **Completed:** 2026-10-05T17:23Z
- **Tasks:** 3 (one tracer, two auto)
- **Files modified:** 9 (2 created)

## Accomplishments

- **The 480px block.** `src/app.css` has exactly one phone-width block (`grep -c` prints 1) holding the 16px page padding and the floor `button, summary, a { box-sizing: border-box; min-height: 44px }` with `a { display: inline-flex; align-items: center }`. No rule above 480px, no font-size, no second block.
- **The nav-offset contract held without moving the offset.** Measured at 375px with a real browser:

  | State | Nav height | Link height | `--nav-offset` |
  | --- | --- | --- | --- |
  | H0, before the floor | 56.59px | 38.59px | 72px |
  | H1, floor added, nav untouched | 62px | 44px | 72px |
  | Final, nav block padding 8px to 5.5px | 57px | 44px | 72px |
  | Desktop (1280px) | 56.59px | | 72px |

  The final nav is 0.41px from H0, so the calendar's sticky year head, every anchor's `scroll-margin-top`, the scroll-spy band and the tooltip placement keep the offset they were designed against. `playtime-charts.spec.ts` and `scroll-nav.spec.ts` are byte-identical (`git diff --quiet` exits 0): the preferred path held and the fallback was not used. The focus ring (3px outline, 2px offset, 5px reach) fits inside the nav's `overflow-y: hidden` clip at 5.5px of padding, which is the tightest value that does; this is MEASURED, not arithmetic: the first touch test focuses a nav link and asserts the ring clears the nav's padding box top and bottom (a 4px padding made it fail on the top edge, then was reverted).
- **The one off-scale value.** 5.5px of nav padding at phone width is the documented exception to the spacing scale; the alternatives were a target under 44px or a moved offset that four components and ten specs read.
- **The sweep.** `mobile-sweep.spec.ts` runs on `chromium` at 375x812 and measures the document, with `expectPresent` before every measurement (`grep -c expectPresent` is 40; the plan asked for 12). Six tests: the padding boundary at 375/481px; the full dashboard from the sample export with every disclosure opened one at a time, the confirm panel open and cancelled, and the identity header and nav above the 812px fold; activity plus logins from one export (calendar, hour grid, duration chart, map, table, reveal, sort, country list); banners and long text (failure, duplicate, excluded rows, a 60-character unknown folder, the 70-character nickname, the cleared acknowledgement); the city opt-in in idle, downloading, cancelled, error and ready; and the tables-and-map box.
- **D-01 and D-02 at phone width.** Both table scrollers overflow internally while the page does not, a far-edge scroll leaves the first column within 1.5px of the scroller's left edge, the login table keeps all six sort columns, the map svg is at most 343px wide and has no `auto`/`scroll` ancestor.
- **D-16.** The idle intro matches `/about [\d,]+ MB/` and the Load button `/\(~[\d,]+ MB\)/`; `git diff --quiet HEAD -- src/lib/ui-copy.ts` exits 0.
- **The touch-target spec.** Three tests on `chromium-mobile`: every `nav-link-*`, Start over, Clear data, both confirm buttons; every vehicle sort header and the four disclosure kinds; the reveal toggle, all six login sort headers, the city Load button, the country list summary and the attribution link. A mutation check (floor lowered to 20px) failed all three with the offenders named by index and size (nav links 38.59px, sort headers 40px), then was reverted.
- **T-07-17.** The touch spec taps Start over, asserts the confirm panel is open and `identity-nickname` still visible, measures both panel buttons, then cancels and asserts the dataset is still there.
- **CI budget.** `playwright test --list` reports 251 tests in 25 files. L = 251, E = 330 + 5 * (251 - 101) + 223 = 1303 s, floor 1.3 * E = 1693.9 s, so G = 29 min, W = 31 min, J = 39 min, moved together in `playwright.config.ts`, `ci.yml` and `ci-budget.test.ts` (which now pins `projectedE2eSeconds(251) === 1303`). 29 min holds up to 258 tests. 28 min still covered L = 243 and L = 246 after Tasks 1 and 2, so Task 3 is where the ceiling was crossed. `ci.yml` changed only on `timeout-minutes`, the wrapper's `timeout <N>m`, and comment lines.

## Task Commits

Each task was committed atomically:

1. **Task 1: tracer, the 480px padding block and the first sweep test** - `08900b3` (feat), by the first agent
2. **Task 2: the 44px floor, the nav re-measured, the touch-target spec** - `cfaecef` (feat)
3. **Task 3: the complete sweep and the CI budget bookkeeping** - `e00ad2a` (feat)

Plus two fix commits: `ecd5e0d` (the login-map spec's 375px card width) and `8371f71` (the nav trims only its block padding, and the focus ring is measured).

4. **Plan docs commit (SUMMARY, STATE, ROADMAP)** - `ea2ad2a` (docs)

**Plan metadata:** recorded in the docs commit that follows this file.

## Files Created/Modified

- `src/app.css` - the single 480px block: page padding, the 44px floor and border-box, inline-flex links
- `src/App.svelte` - the same 16px padding in its scoped block at the same breakpoint (Task 1)
- `src/lib/shell/DashboardNav.svelte` - phone-width rule: 5.5px nav block padding and flex-centred links (only adds lines against the plan's start)
- `tests/e2e/shell/mobile-sweep.spec.ts` - the six-test 375px sweep (new)
- `tests/e2e/shell/touch-targets.spec.ts` - the three-test 44px spec, including the focus-ring measurement (new)
- `tests/e2e/logins/login-map.spec.ts` - the 375px frame bounds follow the 16px padding (see deviation 2)
- `playwright.config.ts`, `.github/workflows/ci.yml`, `tests/unit/guards/ci-budget.test.ts` - the budget move to 29 / 31 / 39 with the pinned 251 projection

## Decisions Made

See `key-decisions` above. The two worth repeating: the nav pays for its own links (offset unmoved), and the floor carries `box-sizing: border-box` with it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scoped `main` padding outranks the global rule**
- **Found during:** Task 1 (the first agent; recorded here from its commit)
- **Issue:** `App.svelte` declares `main { padding: 24px }` in a Svelte scoped block, which carries an attribute selector and so beats a bare `main` in `src/app.css` at every width. The global `padding: 16px` the plan asks for was silently dead.
- **Fix:** The same 16px rule at the same 480px breakpoint in `App.svelte`'s scoped block (the plan's own precedent: fix the one element locally on the same breakpoint, no new breakpoint). The `app.css` block keeps its `padding: 16px` as the plan's acceptance criteria require.
- **Files modified:** `src/App.svelte`
- **Verification:** the sweep's 16px/24px/481px assertions
- **Committed in:** `08900b3`

**2. [Rule 1 - Bug] The map spec's 375px card width encoded the 24px desktop padding**
- **Found during:** Task 3 (full-suite run; `login-map.spec.ts` is not in the plan's `files_modified` and was not among the specs the tasks re-ran)
- **Issue:** `at 375px the frame fits the card...` asserted the frame at most 295.5px and over 280px. With 16px page padding the card's inner width is 309px (375 - 32 - 2 * 17), so the assertion failed on the intended consequence of D-03.
- **Fix:** Both bounds moved by the 16px the page gave back (311.5 and 296), with a comment deriving 309. No product code changed.
- **Files modified:** `tests/e2e/logins/login-map.spec.ts`
- **Verification:** the file passes (7 tests); the full suite passes (251)
- **Committed in:** `ecd5e0d`

**3. [Rule 1 - Bug] The nav rule trimmed all four sides, not just the vertical padding**
- **Found during:** close-out review of Task 2's partial work inherited from the dead agent
- **Issue:** the inherited rule was the shorthand `nav { padding: 5.5px }` against an original uniform `8px`, so the horizontal inset also shrank by 2.5px. The plan trims the VERTICAL padding only, and `DashboardNav.svelte` reads `paddingLeft` back for its scroll inset. The focus-ring fit had also been argued by arithmetic only.
- **Fix:** `padding-block: 5.5px`, with a comment saying why only the block axis moves; the touch spec now measures the focused link's ring against the nav's padding box.
- **Files modified:** `src/lib/shell/DashboardNav.svelte`, `tests/e2e/shell/touch-targets.spec.ts`
- **Verification:** the touch project passes (11 tests), the full suite passes (251), and a 4px padding fails the new ring assertion
- **Committed in:** `8371f71`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All three are direct consequences of the padding change, none widened scope. The plan's "existing 375px specs unmodified" held for the eight it names; `playtime-charts.spec.ts` and `scroll-nav.spec.ts` are byte-identical.

## Issues Encountered

- The first agent died on an API 429 after Task 1 and a partial Task 2. Its uncommitted diff was re-measured rather than trusted (H0, H1 and final above, taken by reverting and re-applying the two files) and kept as it was; its scratch measuring spec was deleted and never committed.
- Every new async notice in the banners test (duplicate, cleared acknowledgement, unsupported banner, excluded notice) needed an explicit visibility wait before `expectPresent`, which counts at the instant it runs.

## Self-Check: PASSED

- Files exist: `mobile-sweep.spec.ts`, `touch-targets.spec.ts` (checked below).
- Commits `08900b3`, `cfaecef`, `ecd5e0d`, `e00ad2a`, `ea2ad2a`, `8371f71` exist in `git log`.
- Acceptance criteria re-run: `grep -c "@media (max-width: 480px)" src/app.css` prints 1; Task 1's app.css diff only adds lines; the sweep lists under `chromium` and not `chromium-mobile` (6 and 0); the touch project lists 11 tests; the title attributes, `windowing.ts`, `ui-copy.ts`, `package.json` and `pnpm-lock.yaml` are untouched; `DashboardNav.svelte` only gains lines against the plan's start; the budget guard is green.
- Plan-level verification: `pnpm run check` 0 errors, `pnpm run lint` clean, `pnpm run test:unit` 2,483 passed in 80 files, `pnpm exec playwright test` (both projects) 251 passed locally (2.6 min on the first run, 5.2 min on the last, the machine being busier).

## Next Phase Readiness

- Ready for 07-06. PLATFORM-01 stays Pending via the shared-ID gate until 07-06 finishes, which is correct.
- The manual focal-point check (count tiles, start of the login table or heatmap, and the map inside the first 812px at 375px) is carried to the first live deploy.
- The 29-minute CI ceiling holds up to 258 listed tests; the next plan adding more than 7 e2e tests must raise all three limits again.

---
*Phase: 07-mobile-layout-public-deploy*
*Completed: 2026-10-05*
