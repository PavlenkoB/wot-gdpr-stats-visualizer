---
phase: 12-account-timeline-perks
plan: 13
subsystem: testing
tags: [playwright, e2e, fixtures, zero-network, windowing, privacy, account-timeline, perks]
status: complete

requires:
  - phase: 12-03
    provides: "the CI budget (limits 32 / 34 / 42 min, 273-test ceiling) this plan stays inside"
  - phase: 12-10
    provides: "perks-fixtures.ts (PK_* roots, canaries, PK_EXPECTED) and the Perks channel"
  - phase: 12-11
    provides: "timeline-fixtures.ts (TL_* roots, canaries, TL_EXPECTED) and the account-timeline channel"
  - phase: 12-12
    provides: "the Account timeline pane mounted in the shell"
provides:
  - "tests/fixtures/account-timeline-perks-export.ts: the composed three-account archive, the variant and large builders and the ATP_EXPECTED oracle"
  - "a Node proof that the archive imports through the real worker to the oracle figures"
  - "two listed e2e tests (Account timeline, Perks) covering rows, order, chips, tags, merge notes, masking, the single reveal, reload and replace re-mask, 375px and windowed 3000-row tables"
  - "zero-network stage 13 (both panes opened, Perks toggle pressed, one kind chip chosen)"
affects: [phase-12-verification]

actuals:
  tokens: 20900
  tasks: 3
  commits: 3
commits: 3
plan_head_before: b26a992f7cd7b15cea4ff49f9c23d2236fd16bfc
plan_head_after: 9bee7885f0d358ec0e98f281d0cda16057a3fde9

tech-stack:
  added: []
  patterns:
    - "An overlay fixture: unzip a base archive, re-root two other fixture archives onto its roots by position, and re-zip with the pinned helper, so the source oracles' tag letters carry over unchanged"
    - "Node-first oracle: every figure a browser test asserts is first proved against the real worker in a unit test"

key-files:
  created:
    - tests/fixtures/account-timeline-perks-export.ts
    - tests/unit/import/account-timeline-perks-export.test.ts
    - tests/e2e/shell/account-timeline-perks.spec.ts
  modified:
    - tests/e2e/guards/zero-network.spec.ts
    - tests/e2e/shell/dashboard.spec.ts
    - tests/e2e/shell/master-detail-nav.spec.ts
    - tests/e2e/import/import-flow.spec.ts

key-decisions:
  - "The Account timeline has no mask toggle and the browser test proves its absence: the capture admits no address column in the five history files, so there is nothing for the single reveal to govern there. Planted bans / third-party addresses sit in excluded columns and are asserted absent masked or not"
  - "ATP_ADDRESSES holds only the allowlisted Bonus codes USER_IP (192.0.2.50, masked to 192.0.2.xxx); the excluded planted addresses are ATP_NEVER_ADDRESSES"
  - "The 'email in an allowlisted cell of a second row of every Phase 12 file' is satisfied by the two source fixtures, which already plant one per file; this module adds the forum and unlisted-Bans values and collects all of them in ATP_CANARY_EMAILS"

patterns-established:
  - "A reveal shared across panes is proved through the panes that have a toggle (Perks, Login history) plus the absence of a toggle where nothing is maskable"

requirements-completed: [TIMELINE-01, TIMELINE-02, PERKS-01, PERKS-02, PERKS-03, PRIV-01, PRIV-02, SCALE-01]

duration: 24min
completed: 2026-10-20
---

# Phase 12 Plan 13: Browser proofs and final gate Summary

**One composed three-account Phase 12 archive proved in Node against the real worker, two listed browser tests for the Account timeline and Perks panes, and a zero-network stage 13, with the full 265-test e2e suite green on Chromium.**

## Performance

- **Duration:** 24 min
- **Tasks:** 3
- **Files:** 7 (3 created, 4 modified)

## Accomplishments

- **The composed archive.** `buildAccountTimelinePerksExport()` unzips the real-shape three-account export, overlays the timeline and Perks fixtures re-rooted by position onto the same roots (so the oracle tag letters A, B, C are what the browser draws), drops the overlay identity file, and adds a Game_Forums file (email and address) and an unlisted file in the Bans folder (email in header-and-cell). `buildAccountTimelinePerksVariantExport({ omitFolders, driftSurveys })` and `buildLargeAccountTimelineExport(count)` complete the set. `ATP_EXPECTED` re-states the two source oracles; nothing hard-codes six kinds, five files or four cards, because both source oracles are limited to what PANE_MAPPING marks mapped.
- **The Node proof.** 22 tests import the archive through the real worker: pane facts, the two list rows, the chronology (kind, date, parts, tag letters), merge counts, the four Perks cards and their tag letters, no canary in rows, meta or either posted view, both variants and the large builder (3000 entries, 3000 coupon rows, single account, newest first). It passed on the first run.
- **The browser tests.** Exactly two listed tests, all further claims `test.step`s: Overview cards and the open link; list order and headlines; ready states, provenance, combined caption, merge notes; entry order, dates, tags and text against the oracle; kind chips (order, filter, arrow key, restore, no URL or storage change); masked-by-default scans of text, markup, `page.content()` and `document.title` for emails, free text, excluded addresses, codes and the allowlisted address; the attribute scan (no attribute holds a past nickname, address or email); the one reveal across Perks and Login history; reload and replace re-mask; per-card states (omitted folder reads Not in this export, drifted Surveys is skipped with no banner); 375px layout; windowed 3000-row tables (drawn rows equal the `windowRange` window plus two spacers, `aria-rowcount` is the full count plus the header, no svg, bounded node count, scrolling changes the first drawn row).
- **Zero network.** Stage 12 now opens an explicit list of the two panes its archive holds; stage 13 replaces the dataset with the Phase 12 archive, opens both new panes, presses the Perks toggle and chooses a kind chip. The unchanged final assertions (zero requests after the baseline, one worker on the page's origin, no CSP violation) pass.
- **List-order fixes.** `dashboard.spec.ts`, `master-detail-nav.spec.ts` and `import-flow.spec.ts` exclude `heat`, `perks` and `account-timeline` from the PANE_ORDER comparison (the sample export holds none of those files). Perks was already excluded by plan 12-09; this adds Account timeline.

## Task Commits

1. **Task 1: The composed Phase 12 archive, its Node proof and the three list-order fixes** - `b853fd5` (test)
2. **Task 2: The two listed browser tests** - `7ae57d5` (test)
3. **Task 3: The zero-network stage** - `9bee788` (test)

## Gate results (actual outputs)

| Gate | Result |
|------|--------|
| `pnpm run test:unit` | 134 files, 4146 tests, all passed |
| `pnpm run check` | 338 files, 0 errors, 0 warnings |
| `pnpm run lint` | prettier clean, eslint clean |
| `pnpm run build` | built (vite 8.3.1) |
| `pnpm exec playwright test --list` | `Total: 265 tests in 31 files` (263 plus the two new listed tests) |
| `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | 8 passed (265 is inside the 273 ceiling and the 32 / 34 / 42 limits; no limit changed) |
| `pnpm exec playwright test` (CI=1, one worker, Chromium) | **265 passed (6.0m)** |
| `grep -c "^  test(" tests/e2e/guards/zero-network.spec.ts` | 5, unchanged from before this plan |

Chromium launched in this environment, so the e2e run is real, not deferred. The two new listed tests measured 3.7 to 3.9 s (Account timeline) and 4.3 to 4.4 s (Perks), about 8 s together in a single-worker run, against the 5 s each the budget credits (12-RESEARCH assumption A12): slightly above the credit per test, well inside the raised limits (the whole suite took 6.0 minutes against a 32-minute limit). To confirm the assertions bite, the merge-note expectation was temporarily changed by one and the test failed with the expected-versus-received message; the change was reverted.

## Decisions Made

- The Account timeline pane has no mask toggle (see Deviations), so the "one reveal" claim is proved through the Perks toggle, the Login history toggle and the absence of a timeline toggle, rather than through a timeline toggle.
- Past nicknames in the Name entries are page text only and never an attribute (asserted with a whole-document attribute scan). This deliberately relaxes the v1.0 nickname-exactly-once rule for that one pane; `identity-privacy.spec.ts` is unchanged (`git diff --stat` empty) because it scans the nine always-present panes and its fixtures hold no history file.

## Deviations from Plan

### Plan items that cannot be exercised literally

**1. [Rule 1 - Plan mismatch with the capture] The Account timeline renders no mask toggle**
- **Found during:** Task 1 (composing the archive) and Task 2 (writing the pane steps)
- **Issue:** The plan has the timeline test plant TEST-NET addresses in bans and third parties, expect them masked, press `timeline-mask-toggle`, and measure the toggle at 375px. Plan 12-11 recorded that the capture admits no address column in the name, service, language, ban or third-party files, so `hasMaskableEntries` is false and the pane renders no toggle and no caption.
- **Fix:** The fixture plants those addresses in the EXCLUDED `IP` columns (as the timeline fixture already did) and the test asserts they appear nowhere, masked or revealed, in text, markup, `page.content()` or the title; asserts `timeline-mask-toggle` and `timeline-mask-caption` have count 0; and proves the shared reveal through the Perks toggle and Login history. The 44px toggle check at 375px is made on the Perks toggle. The allowlisted address is the Bonus codes `USER_IP` (`ATP_ADDRESSES`); excluded ones are `ATP_NEVER_ADDRESSES`.
- **Files modified:** tests/fixtures/account-timeline-perks-export.ts, tests/e2e/shell/account-timeline-perks.spec.ts
- **Commits:** b853fd5, 7ae57d5

**2. [Process] TDD ordering.** Task 1 is marked `tdd="true"`; the fixture and its proof were written together and committed once, and the proof passed on the first run (same note as plans 12-10 and 12-11).

**3. [Interpretation] "An email in an allowlisted cell of a second row of every Phase 12 file."** The two source fixtures already plant one in every Phase 12 file; the composed archive reuses them rather than adding a second set, and `ATP_CANARY_EMAILS` collects them all plus the forum email, the unlisted-file email and the three per-root login canaries.

**4. [Interpretation] Game_Forums.** The real-shape EU root already holds a `Game_Forums` file with the same email and address canaries; the plan's `Game_Forums` file is added under the first root (RU) as well, so the canaries exist in two roots.

**Total deviations:** 1 plan mismatch (documented above), 3 notes. **Impact:** none on coverage of PRIV-01, PRIV-02 or SCALE-01; the timeline's absence of a toggle is now an asserted fact instead of an assumed feature.

## Issues Encountered

None. Chromium launched and every e2e test passed on the first full run.

## Residual risks and manual checks

- The Language/Country discriminator match in the 12-11 builder is tolerant (`lang` / `countr`) and still unconfirmed against a real export; the fixture writes `language` and `country`. A real export would be the only place this shows.
- Open bans store `EXPIRED_AT` as `\N`; it is not a timeline column, so the pane never draws it.
- The plan's `<human-check>` (read both panes once at 375px and 480px on a real browser; legibility is not machine-checkable, 12-VALIDATION Manual-Only) has not been done and remains for verification. The machine checks (no sideways scroll, chip wrap, 44px floors) pass.
- No real export was read. No `.zip` is in the tree (`git status --short` was clean after the run).

## Known Stubs

None. No placeholder data reaches the UI.

## Threat Flags

None. The plan adds only test files; no endpoint, auth path, file access or schema change. T-12-42 (zero requests, one worker, no CSP violation across both panes) is covered by stage 13; T-12-43 (no email in text, markup, title or content) and T-12-44 (code and address masked until the single reveal, re-masked by reload and replace) by both listed tests; T-12-45 (windowed tables) by the 3000-row steps.

## Self-Check: PASSED

- FOUND: tests/fixtures/account-timeline-perks-export.ts
- FOUND: tests/unit/import/account-timeline-perks-export.test.ts
- FOUND: tests/e2e/shell/account-timeline-perks.spec.ts
- FOUND: b853fd5, 7ae57d5, 9bee788 (ancestors of HEAD)
