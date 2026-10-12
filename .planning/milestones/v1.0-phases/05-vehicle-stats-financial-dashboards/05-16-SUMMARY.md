---
phase: 05-vehicle-stats-financial-dashboards
plan: 16
subsystem: testing
tags: [playwright, vitest, scale, oracle, dom-bound, long-task, csp, zero-network, ci-budget]

# Dependency graph
requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: "05-01's CURRENCY_50K_SPEC/CURRENCY_10K_SPEC generators and the independent money oracle, 05-04's CHART_MIN_OPS/CHART_MAX, 05-08's currency copy inventory, 05-10's CurrencyBlock and the generalised ExcludedNotice, 05-11's MonthlyBarChart, 05-13's per-chart small multiples, 05-15's spend breakdowns"
provides:
  - "finance-scale.spec.ts — five browser claims about the 50,000-operation finance path, every expectation taken from the oracle, the 50,000-operation export imported EXACTLY once in the whole suite"
  - "A zero-network/CSP guard that now covers all ten Phase 5 flows, not just Phase 4's activity ones"
  - "The three CI e2e limits at 25/27/35 min, raised together by the plan's stated rule from a MEASURED 184-test list, with a second scale block priced in the projection"
  - "05-VALIDATION.md reconciled: all 48 rows green, every Wave 0 item ticked, both frontmatter flags set"
affects: [phase-06, phase-07, ci-budget, finance-scale, zero-network]

actuals:
  tokens: 24375
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A scale spec is ONE serial describe over ONE context and ONE page: the expensive import happens once and every other claim reads the same DOM."
    - "Both measurements a budget needs are REPORTED from the test, not only compared, so the CI arithmetic has a measured input."

key-files:
  created:
    - "tests/e2e/finance-scale.spec.ts — the 50,000-operation finance path in a real browser"
  modified:
    - "tests/e2e/zero-network.spec.ts — added the ten-flow Phase 5 guard"
    - "tests/unit/ci-budget.test.ts — FINANCE_SCALE_TEST_COUNT, FINANCE_SCALE_SECONDS, two priced blocks, re-pinned arithmetic"
    - "playwright.config.ts — globalTimeout 20 → 25 min with the L/E/G arithmetic in the comment"
    - ".github/workflows/ci.yml — wrapper 22 → 27 min, timeout-minutes 28 → 35, no other step touched"
    - ".planning/phases/05-vehicle-stats-financial-dashboards/05-VALIDATION.md — reconciled"

key-decisions:
  - "The plan's domFlat equality ('the replace-time element count equals the 50,000 import's') cannot hold and was replaced by three tighter TRUE claims: the axis is exactly the smaller file's oracle month count, a fifth of the rows never spans a wider range, and the node count never grows."
  - "`data-ops` is NOT compared with the oracle's `operations`: the cell counts deposit and withdrawal rows, the oracle also counts `income`, and no per-type split bridges them. The axis endpoints are checked instead and the complete count stays decided by test 1's summary sentence."
  - "`in-bar` is not the month count — a bar is drawn only for a month that received that flow. The pairing (one bar per non-zero cell) is asserted instead."
  - "The replace is detected by waiting on a VALUE only the new dataset can produce, because the card's `data-state` is already `ready` and cannot detect it."
  - "FINANCE_SCALE_SECONDS is 90 s, and the plan's floor is what binds: the measured import (1,414 ms) plus the measured replace (947 ms) is 3 s, and the two timings exclude the browser context, the first module graph and the Node-side fixture build."
  - "CARD_CHROME_NODES is pinned at the measured overhead (40) plus 100, the rule plan 04-12 set for the activity charts."

patterns-established:
  - "Expect the ORACLE, never the page's own numbers: `oracleCurrency` re-reads the generated CSV text without the worker's aggregation or the DOM, so a card wrong in every figure cannot pass."
  - "A DOM-bound test is a claim about the RENDERED QUANTITY — assert the quantity the oracle decides (months drawn) and let the other counts be bounds."
  - "A 'the DOM does not grow with X' or 'the state did not change' wait must be keyed on something that CHANGED, or it passes on the data already in memory."
  - "When a state attribute is already in the target state, it cannot detect a replace; wait for a value only the new dataset can produce."
  - "The three CI e2e limits move together or tests/unit/ci-budget.test.ts refuses — raise all three in one commit with L, E, G, W, J written into the comments beside them."

requirements-completed: [STATS-01, FINANCE-01, FINANCE-02, FINANCE-03]

coverage:
  - id: D1
    description: "The 50,000-operation finance path renders the oracle's charts, in the oracle's order, with each summary equal to the oracle's totals, an excluded pill of the oracle's count and the Other currencies list equal to the oracle's"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance-scale.spec.ts#(1) the oracle decides which currencies get a chart, in what order, and what each says"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every chart draws the oracle's month count, a bar exactly for each non-zero cell, cell amounts that sum to the oracle's totals within a thousandth per cell, and an axis from the oracle's first to its last month"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance-scale.spec.ts#(2) every chart draws the oracle's months and their figures add up to its totals"
        status: pass
    human_judgment: false
  - id: D3
    description: "The currency card's DOM is bounded by the months drawn: 1,974 nodes over 1,142 drawn bars, every chart inside three bars plus forty, the whole card inside the sum of those ceilings plus the measured chrome"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance-scale.spec.ts#(3) the card's DOM is bounded by the months drawn, not by the rows read"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 50,000-operation import reaches ready in 1,414 ms and no main-thread task reaches 1,000 ms, so all parse and aggregation work really is off the main thread"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance-scale.spec.ts#(4) no main-thread task of a second or more runs while the import is processed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Replacing with a fifth of the rows does not grow the DOM: each axis is exactly the smaller file's oracle month count, no axis is wider, no chart's node count grows, and the whole card shrinks from 1,974 to 1,653 nodes"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance-scale.spec.ts#(5) replacing with a fifth of the rows does not grow the DOM"
        status: pass
    human_judgment: false
  - id: D6
    description: "The zero-network and CSP guard covers all ten Phase 5 flows — both selectors value by value, a sort, a search, a column-picker change, the premium and currency charts by pointer and keyboard, every monthly table, a spend breakdown and the confirmed replace — with one worker and zero violations"
    verification:
      - kind: e2e
        ref: "tests/e2e/zero-network.spec.ts#no network request, no second worker and no CSP violation through every Phase 5 flow"
        status: pass
    human_judgment: false
  - id: D7
    description: "The three CI e2e limits are raised together to 25/27/35 min by the plan's stated rule from a measured 184-test list, with a second scale block priced in the projection and the guard asserting the ORDER"
    verification:
      - kind: unit
        ref: "tests/unit/ci-budget.test.ts — 6/6 pass, including 'the projection is the arithmetic the plan derived' and the three ordering tests"
        status: pass
    human_judgment: false
  - id: D8
    description: "The whole Playwright suite is green at the new globalTimeout: 184/184 in 3.0 min at CI-like 1 worker"
    verification:
      - kind: e2e
        ref: "CI=1 pnpm exec playwright test — 184 passed (3.0m)"
        status: pass
    human_judgment: false
  - id: D9
    description: "05-VALIDATION.md reconciled: all 48 rows green against re-run evidence, every Wave 0 item confirmed to exist, the sign-off ticked, and both frontmatter flags set"
    verification:
      - kind: other
        ref: "grep -c '✅ green' 05-VALIDATION.md = 49 (48 rows + legend); no '- [ ]' remains"
        status: pass
    human_judgment: false
  - id: D10
    description: "Visual quality of the flow bars, small multiples and vehicle table at phone and desktop width"
    requirement: FINANCE-01
    verification: []
    human_judgment: true
    rationale: "Layout polish is not asserted by DOM checks; this is 05-VALIDATION.md's standing manual-only row and no automated evidence can substitute for a human looking at 375px and 1280px."

# Metrics
duration: 24min
completed: 2026-10-02
status: complete
---

# Phase 05 Plan 16: Scale, Zero-Network and CI Budget Summary

**The 50,000-operation finance path proven in a real browser against the independent oracle, the zero-network guard extended to all ten Phase 5 flows, and the three CI e2e limits raised together to 25/27/35 min from a measured 184-test list**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-10-02T13:28:02+04:00
- **Completed:** 2026-10-02T13:52:00+04:00
- **Tasks:** 3
- **Files modified:** 7 (1 created, 6 modified) — **no file under `src/`**

## Accomplishments

- **`tests/e2e/finance-scale.spec.ts`** — five claims about the 50,000-operation path, every expectation taken from `oracleCurrency`, which re-reads the generated CSV text without the worker's aggregation or the DOM. The 50,000-operation export is imported **exactly once in the whole suite**: a serial describe owns one context and one page, and the DOM-flatness test replaces it in that same context, so the confirm-before-replace path is exercised rather than bypassed.
- **Measured, not projected:** 50,000 operations reach `ready` in **1,414 ms** (budget 60,000); the card holds **1,974 nodes** — 1,934 across six chart sections and 40 of chrome — over 1,142 drawn bars on 636 chart months; **no main-thread task reached 1,000 ms**. The 10,000-operation replace reaches `ready` in **947 ms** and the card shrinks to **1,653 nodes** over five charts.
- **The zero-network guard now covers Phase 5.** One sample import (all four Phase 5 sources), then ten flows — both selectors value by value, a sort both ways, a search through match/no-match/clear, a column-picker toggle on and off, the premium and currency charts by pointer and keyboard, **every** monthly table, a spend breakdown, and the confirmed replace — with one worker, zero requests and zero `securitypolicyviolation` events across all of it.
- **The budget raise, with the arithmetic in the code.** L = 184 tests in 16 files (MEASURED). E = 330 + 5×(184−86−5−5) + 120 + 90 = **980 s**. G = ceil(1.3×980/60)+3 = 22+3 = **25 min**. W = G+2 = **27 min**. J = W+8 = **35 min**. Both orderings hold with room: 1,620 s against 1,590 s, and 2,100 s against 1,920 s.
- **05-VALIDATION.md reconciled** against evidence re-run at this head, not against any earlier summary's word: all 48 rows green, every Wave 0 path confirmed present, the sign-off ticked, `nyquist_compliant: true` and `wave_0_complete: true`.

## Task Commits

1. **Task 1: 50,000-operation finance path in a real browser** — `21ce6e4` (test)
2. **Task 2: zero-network and CSP guard over every Phase 5 flow** — `5868090` (test)
3. **Task 3: CI budget raise and validation-map reconciliation** — this commit

## Files Created/Modified

- `tests/e2e/finance-scale.spec.ts` — **created.** Five serial-describe claims: oracle agreement, per-cell figures, the DOM bound, the long-task ceiling, and the replace-time DOM. Lazy memoised exports and oracles so `playwright test --list` does not pay for 50,000 CSV rows.
- `tests/e2e/zero-network.spec.ts` — added the ten-flow Phase 5 test. Identical baseline, observer and assertions to the existing playtime test.
- `tests/unit/ci-budget.test.ts` — `FINANCE_SCALE_TEST_COUNT` (5, MEASURED) and `FINANCE_SCALE_SECONDS` (90, ESTIMATE, floor-bound); `projectedE2eSeconds` now prices **two** blocks; the arithmetic test re-pinned to `projectedE2eSeconds(184) === 980`.
- `playwright.config.ts` — `globalTimeout` 20 → 25 min, comment rewritten to record L, E, G and the rule.
- `.github/workflows/ci.yml` — wrapper 22 → 27 min, `timeout-minutes` 28 → 35, both comments rewritten. No other step touched; every action still pinned by its existing SHA.
- `.planning/phases/05-vehicle-stats-financial-dashboards/05-VALIDATION.md` — reconciled.
- `.planning/STATE.md`, `.planning/ROADMAP.md` — position, decisions and plan progress.

## Verification

Every command re-run against this plan's own head:

| Command | Result |
|---------|--------|
| `pnpm exec playwright test --list` | **Total: 184 tests in 16 files** (178 before this plan) — the measured L |
| `pnpm exec playwright test tests/e2e/finance-scale.spec.ts` | **5 passed** (5.0 s) |
| `pnpm exec playwright test tests/e2e/zero-network.spec.ts` | **4 passed** (11.2 s) — the 3 pre-existing plus the new Phase 5 flow |
| `pnpm exec vitest run tests/unit/ci-budget.test.ts` | **6 passed** (0.9 s) |
| `pnpm run test:unit` | **1333 passed / 1333**, 46 files |
| `pnpm run check` | **exit 0** (`tsc -b`) |
| `pnpm run lint` | **exit 0** — `prettier --check .` and `eslint .` both clean |
| `pnpm run build` | **exit 0**, built in 242 ms |
| `CI=1 pnpm exec playwright test --reporter=line` | **184 passed / 0 failed, 3.0 min**, wall clock **181 s**, 1 worker |
| `LC_ALL=de_DE.UTF-8 … vitest run ui-copy playtime playtime-state` | **353 passed** (the 05-08 rows a plain run does not cover) |
| `LC_ALL=de_DE.UTF-8 … vitest run ui-copy` | **176 passed** under both locales |
| `git diff --stat -- src` | **empty** — this plan touches no runtime source |
| `git diff --quiet -- package.json pnpm-lock.yaml` | **exit 0** (T-05-SC: no package installed) |
| `git diff --quiet -- vite.config.ts` | **exit 0** (CSP meta tag unchanged) |
| `grep -v '^\s*#' ci.yml \| grep -c 'timeout-minutes:'` | **1** active job timeout |
| `grep -v '^\s*#' ci.yml \| grep -c 'playwright test'` | **1** active wrapper |

### On the git assertions

`git diff --quiet` compares against HEAD, so committing the work makes those checks trivially true. What actually matters is that **no such edit was made**: the plan's file list contains no `src/`, `package.json`, `pnpm-lock.yaml` or `vite.config.ts` entry, and the diffs above were taken before Task 3's commit so they were not vacuous.

### On the measured wall clock

**181 s measured against a 980 s projection — 5.4× under.** That is the projection working as designed, not evidence that it is right: `PRE_PHASE_SECONDS = 330` is deliberately ~3× the local cost to cover an unmeasured self-hosted runner, and it remains, in 05-15's words and now 05-16's, **the input most likely to be wrong**. The first real CI run replaces it.

## Decisions Made

1. **The plan's `domFlat` equality is arithmetically impossible, and three tighter claims replaced it.** The 50,000-row file charts SIX codes; the 10,000-row file charts FIVE and lists the stray `UAH` as a text row, because 156 operations clear `CHART_MIN_OPS` (50) at one size and 36 do not at the other. Even per chart, a cell is drawn per month of the currency's OWN first-to-last range, so `crystal` covers 212 cells on 6,032 operations and 207 on 1,263 — and credits drops from 349 nodes to 344 because a sparser file has fewer non-empty months. Asserting the plan's equality would have been a **false** test. What is asserted instead: the axis is exactly the smaller file's oracle month count, a fifth of the rows never spans a wider range, and no chart's node count grows.
2. **`data-ops` is not compared with the oracle's `operations`.** A cell's `data-ops` is its deposit and withdrawal operations; the oracle counts every USABLE row, which also includes `income` — a usable operation FINANCE-02 deliberately does not total. On this fixture credits draws ~12,600 deposits, ~5,100 withdrawals and ~2,400 income rows, so the two can never be equal and the oracle exposes no per-type split. The complete count is still decided against the oracle, by test 1's summary sentence, which is built from it verbatim. The test says so at the point of omission.
3. **A bar exists exactly for a non-zero cell**, which is what replaced `in-bar === months`. That pairing is also the stronger claim: it proves each bar is drawn from its own cell's figure.
4. **The replace is detected by value, not by state.** The card is already `data-state="ready"` from the import being replaced, so waiting on it resolved instantly and the first run of test 5 compared the 50,000-row card with itself. The wait is now on the first chart's summary sentence built from the smaller file's own oracle.
5. **`FINANCE_SCALE_SECONDS = 90`, and the floor is what binds.** The plan defines the value as the measured import plus the measured replace, never below 90: 1,414 ms → 2 s, plus 947 ms → 1 s, so the computed value is **3 s**. Those two timings are the whole cost of the expensive part and leave out the browser context, the preview server's first module graph, rendering six charts and building a 5.5 MB CSV in Node. 90 is deliberately below the 60,000-session block's 120 s, because this block imports a 5.5 MB export where that one imports a 60,000-session export.
6. **`CARD_CHROME_NODES = 140`**, the measured overhead (40) plus 100 — the rule plan 04-12 set for the activity charts, with the measurement (1,974 total, 1,934 in charts) written into the comment.
7. **The battle-type sweep runs before the title sweep**, because the battle types are the current title's and a title change invalidates the list; and **the column toggle is read from the DOM rather than named**, because the extra columns are the current title's own and a hardcoded key would couple a network guard to one title's column set.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule — plan wording not satisfiable as written] `domFlat` compared element counts the two fixtures cannot produce equal**
- **Found during:** Task 1 (finance-scale spec)
- **Issue:** The plan's "the replace-time element count equals the 50,000 import's element count" is false for the whole card (6 charts vs 5 charts + 1 text row) and false per chart (a sparser sample spans a narrower month range and draws fewer bars).
- **Fix:** Replaced with the three tight, true claims listed in Decisions 1. The per-chart ceiling from `domBound` is re-asserted after the replace so the bound is checked on both datasets.
- **Files modified:** `tests/e2e/finance-scale.spec.ts`
- **Verification:** `5 passed`; the comment records the measured 212/207 and 349/344 numbers.
- **Committed in:** `21ce6e4`

**2. [Rule — plan wording not satisfiable as written] `data-ops` vs the oracle's `operations`**
- **Found during:** Task 1, first real run (17,723 vs 20,132)
- **Issue:** `data-ops` counts deposit and withdrawal rows; the oracle counts every usable row including `income`. The two are different numbers by construction.
- **Fix:** Dropped that comparison and replaced it with the axis-endpoint check, which the oracle can decide. A comment at the point of omission states the arithmetic so the next reader does not re-add it.
- **Files modified:** `tests/e2e/finance-scale.spec.ts`
- **Verification:** `5 passed`; the split was confirmed independently by tallying TYPE per code in Node.
- **Committed in:** `21ce6e4`

**3. [Rule — blocking] `in-bar` count is not the month count**
- **Found during:** Task 1 (59 bars against 106 months on the UAH chart)
- **Issue:** A bar is drawn only for a month that received that flow.
- **Fix:** Asserted the pairing — one `in-bar` per cell whose `data-in` is non-zero, one `out-bar` per non-zero `data-out` — which is the stronger claim anyway.
- **Files modified:** `tests/e2e/finance-scale.spec.ts`
- **Verification:** `5 passed`
- **Committed in:** `21ce6e4`

**4. [Rule — blocking] The replace was not observable, so test 5 measured the dataset it already had**
- **Found during:** Task 1 (test 5 saw all 6 charts and identical node counts after the replace)
- **Issue:** `data-state` was already `ready`, so the wait resolved instantly. This is the same shape `tests/e2e/helpers.ts` `replaceExport` documents.
- **Fix:** Added `waitForDataset`, which waits for a value only the new dataset can produce.
- **Files modified:** `tests/e2e/finance-scale.spec.ts`
- **Verification:** `5 passed`; the 10,000-row card's 5 charts and 1 Other-currencies row are now asserted.
- **Committed in:** `21ce6e4`

**5. [Rule — test could not fail] `expect(locator.first()).toHaveCount(1)` is vacuous**
- **Found during:** Task 2, self-review
- **Issue:** That assertion is true for any locator that resolves at all, so an empty column picker would have passed the flow.
- **Fix:** Asserted the toggle COUNT is greater than zero before taking `.first()`.
- **Files modified:** `tests/e2e/zero-network.spec.ts`
- **Verification:** `4 passed`
- **Committed in:** `5868090`

---

**Total deviations:** 5 auto-fixed (2 unsatisfiable plan wordings, 2 blocking test defects, 1 vacuous assertion)
**Impact on plan:** No scope creep and no new files beyond the plan's list. Three of the five are cases where the plan's own wording could not have passed against the data it names; in each the replacement asserts something the oracle can actually decide, and the plan's intent — prove the DOM is a function of the months drawn — is preserved and stated in the code.

## Issues Encountered

- **A scratch probe produced empty output and looked like a hang.** The cause was my own probe: the generated CSV quotes every field (`"deposit"`), and I had not stripped the quotes the way `splitFixtureCsv` does. The test was never affected; the lesson is that a fixture's quoting is part of its contract and the splitter in `tests/e2e/finance.spec.ts` is the reference for it.
- **`imports` had to come from two fixture modules.** `buildCustomExport` lives in `tests/fixtures/export-fixtures.ts`, not in `finance-fixtures.ts`; the first `tsc -b` caught it.

## Open Items

1. **Plan 05-15's recorded e2e flake did not reproduce here but is not closed by this plan.** 05-15's close-out recorded a currency-tooltip test that failed 5 of 6 whole-suite runs and passed 5 of 5 in isolation. This run was 184/184 green, but "the whole suite is green" is a statement about this run. The row is 05-15's to close.
2. **The one manual-only validation row is untouched**: visual quality of the flow bars, small multiples and the vehicle table at 375px and 1280px. No automated evidence substitutes for it, and the sign-off above says so rather than ticking it.
3. **`PRE_PHASE_SECONDS = 330` is still unmeasured on a CI runner.** Every limit in this plan is a projection from that one estimate. The first real CI run of the 25/27/35 trio is what replaces it, and 05-15's standing note carries forward unchanged.

## User Setup Required

None — no external service configuration, no new dependency, and no environment variable. Chromium was already installed in this sandbox and every browser test ran for real; the plan's `--list` fallback was not needed.

## Next Phase Readiness

- **Phase 5 is complete**: 16 of 16 plans executed, all 48 validation rows green, both validation frontmatter flags set.
- **Phase 6 (Login-IP History & Offline Geolocation)** can start. It inherits the three e2e limits at 25/27/35 min, so its own browser tests will need the guard re-run and all three moved together again if it adds enough to breach the 1.3× floor.
- **Phase 7 (Mobile Layout & Public Deploy)** inherits the standing 375px and 1280px manual check and the untouched visual-quality row.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Plan: 16*
*Completed: 2026-10-02*
