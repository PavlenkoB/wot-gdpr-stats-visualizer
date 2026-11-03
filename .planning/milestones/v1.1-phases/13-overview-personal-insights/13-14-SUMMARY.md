---
phase: 13-overview-personal-insights
plan: 14
subsystem: testing
tags: [playwright, vitest, overview, layout, privacy, zero-network, ci-budget]
status: complete

requires:
  - phase: 13-overview-personal-insights
    provides: the composed Overview page and its interaction (13-12), the oracle fixture (13-03), the old page retired (13-13)
provides:
  - three more listed Overview browser tests (layout, modes, privacy and states) on the real worker
  - generic failChannelQuery and delayChannelQueries helpers for any data channel
  - a 'hostile' tanks option with OV_HOSTILE_NAME, plus OV_NICKNAME_A and OV_NICKNAME_B
  - an Overview stage (stage 0) inside the long zero-network test
  - the CI budget reconciled with the measured count (no limit moved)
affects: [13-15]

actuals:
  tokens: 26000
  tasks: 2
  commits: 3
plan_head_before: 2a2ea26e8567d64d64c8d69d3fe856eb6a1ecae7
plan_head_after: b49f0490b47510161ac0db9903ec1c19cb7b8b2f

tech-stack:
  added: []
  patterns:
    - "failChannelQuery(page, channel, times) / delayChannelQueries(page, channel, ms): patch Worker.prototype.postMessage in an init script and act on data-query messages of one channel; Infinity travels to the page as null"
    - "Isolated states (pending, failing, hostile name) each get a fresh browser.newContext() so the cached dataset of the first page cannot short-circuit the import"

key-files:
  created: []
  modified:
    - tests/e2e/shell/overview-insights.spec.ts
    - tests/e2e/_support/helpers.ts
    - tests/e2e/guards/zero-network.spec.ts
    - tests/fixtures/overview-fixtures.ts
    - tests/helpers/overview-oracle.ts
    - tests/unit/overview/overview-fixtures.test.ts
    - tests/unit/guards/ci-budget.test.ts

key-decisions:
  - "No CI limit moved: 271 listed tests now and 272 after plan 13-15 sit inside the 273-test ceiling of the 32 / 34 / 42 min limits (E(272) = 1469 s, 1.3 * E = 1909.7 s against 1920 s)."
  - "The sibling-height assertion in the layout test is 'none grows, the tallest is unchanged', not 'all keep their height': align-items start deliberately lets a stretched sibling fall to its natural height."
  - "The hostile fallback name is '<b>bold</b>_Four' (only the nation prefix and one leading index token are removed), not the plan's 'bold</b>_Four'."

requirements-completed: [INSIGHT-03, INSIGHT-04, INSIGHT-07]

duration: 35min
completed: 2026-10-23
---

# Phase 13 Plan 14: Overview browser proofs and CI budget Summary

**The Overview is now proved in a real browser beyond composition: columns at 4 / 2 / 1 by pane width, no overlap, expand-in-place, reduced motion and forced colours, a canary sweep of the document, a pending skeleton, a failed ask with retry, a markup-bearing tank name rendered as text, and the zero-network flow driving expand, pin, unpin, Escape and Open; the full suite is green at 271 listed tests with the CI limits untouched.**

## Accomplishments

- **Layout test.** At viewports 1440 / 1100 / 800 / 375 the Overview root measured 1038.5 / 698.9 / 720 / 343 px and every one of the five grids had 4 / 2 / 2 / 1 computed tracks, a 16px column and row gap, no overlapping pair of tiles (0.5px tolerance) and (top, left) order equal to DOM order. At 1440 the Signature hour tile is as wide as the Time grid (four columns, the worked example); expanding it changes neither x, y nor width and sets `align-items: start`. At 375 the star is at least 44 by 44 and the page does not scroll sideways.
- **Modes test.** `document.startViewTransition` is wrapped to count calls: the normal expand calls it, an expand under `reducedMotion: 'reduce'` is applied with a zero-timeout expectation and does not call it. Under `forcedColors: 'active'` the Time group dot, the legend swatch and the star have a computed outline width above 0.
- **Privacy and states test.** The document HTML contains none of `OV_CANARIES`, the overview element contains neither identity nickname; with the overview channel delayed 1500 ms the root is `aria-busy`, skeleton tiles are drawn, the provenance line reads the loading sentence, no `ov-tile-*` exists and the page keeps exactly two `[aria-live]` nodes; with the first overview ask failing, one `failure-banner` with the `OVERVIEW_ERROR` text sits above the skeleton frame, and Playtime then Overview retries and shows the tiles with no banner; with the hostile tank tag the Most-played tank tile shows `<b>bold</b>_Four` as text, `overview.locator('b')` is 0 and the tile HTML holds no `<b>`.
- **Zero-network.** Stage 0 of the long Phase 5 test expands the first tile, closes it with Escape, unpins by the star, pins again by P, expands and follows its Open link, returns to the Overview and waits for a tile. No new `test(...)`; the end-of-test no-request, one-worker and no-CSP-violation assertions are unchanged and pass.
- **CI budget.** `playwright test --list` printed `Total: 268 tests in 32 files` before and `Total: 271 tests in 32 files` after Task 1; Task 2 adds no listed test (271). With plan 13-15's one test N_final = 272, E = 330 + 5 * (272 - 105) + 304 = 1469 s, 1.3 * E = 1909.7 s <= 1920 s (32 min). So no limit moved (32 / 34 / 42 min stay, headroom of one test to the 273 ceiling after 13-15); the Phase 13 worked example is recorded in the header of `ci-budget.test.ts`.

## Task Commits

1. Task 1 (layout, modes, privacy and states; helpers; hostile fixture option): `7cdf019`
2. Task 2 (Overview stage in the zero-network flow; CI budget record): `7c33afa`
3. Header wording fix (one test of headroom, not two): `b49f049`

## Verification

- `pnpm exec playwright test tests/e2e/shell/overview-insights.spec.ts`: 6 passed.
- `pnpm exec playwright test tests/e2e/guards/zero-network.spec.ts`: 5 passed.
- FULL `pnpm exec playwright test`: 271 passed, 0 failed (1.4 min on this machine; the 32 min global limit is nowhere near).
- `pnpm run test:unit`: 157 files, 4,734 passed, 9 expected fail. `pnpm run check`, `pnpm run lint` and `pnpm run build` exit 0.

## Human check carried forward

The MOTION FEEL of expand and pin (the 0.26 s view transition, the anchored scroll, the pin move) cannot be judged headless. The tests prove the API is called on the normal path, skipped under reduced motion, and that nothing moves in x, y or width; whether the animation looks right is for a person at a real screen. Recorded in the WINDOWS ledger as an unrun verification.

## Deviations from Plan

**1. [Rule 1 - Plan wording] The hostile fallback name.** The plan expected `bold</b>_Four`. The application's `tagFallbackName` removes the nation prefix and one index token matched by `^[A-Za-z]*[0-9]+_`, so `ussr:R99_<b>bold</b>_Four` reads `<b>bold</b>_Four`. `OV_HOSTILE_NAME` states that value by hand in the import-free oracle, and the fixture unit test pins it to what `tagFallbackName` computes.

**2. [Rule 1 - Plan wording] The sibling-height assertion.** The plan said sibling tiles keep their height when a tile opens. Measured: with `align-items: start` a sibling that was stretched to its row falls to its natural height (Busiest day 135 px to 118 px), which is the designed behaviour. The test asserts what is actually promised: no sibling grows and the tallest sibling is unchanged.

**3. [Plan wording] Fresh contexts for the pending, failing and hostile states.** The plan said "a new page in the same context". A second page in the same context would find the first page's cached dataset in IndexedDB and skip the import, so each state uses `browser.newContext()`; the playwright config's baseURL and locale still apply.

**4. [Plan wording] Nicknames.** The two identity nicknames were literals inside the fixture; they are now exported as `OV_NICKNAME_A` and `OV_NICKNAME_B` so the spec asserts against the same strings the archive writes.

**5. [Plan wording] Stage 0 uses the first drawn tile.** The plan named the Logged in tile; the stage reads the first `ov-tile-button-*` and its id so it does not depend on the sample export carrying sessions.

## Known Stubs

None.

## Threat Flags

None. T-13-39 mitigated by the canary sweep, the hostile-name test and stage 0 inside the zero-network flow; T-13-40 mitigated by the measured count and the ci-budget guard (limits unchanged, arithmetic above).

## Self-Check: PASSED

- `tests/e2e/shell/overview-insights.spec.ts`, `tests/e2e/_support/helpers.ts`, `tests/e2e/guards/zero-network.spec.ts`, `tests/unit/guards/ci-budget.test.ts`, `tests/fixtures/overview-fixtures.ts`, `tests/helpers/overview-oracle.ts`: present
- commits 7cdf019, 7c33afa and b49f049 are ancestors of HEAD
