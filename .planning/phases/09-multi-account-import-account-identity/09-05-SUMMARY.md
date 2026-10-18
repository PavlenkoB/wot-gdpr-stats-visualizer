---
phase: 09-multi-account-import-account-identity
plan: 05
subsystem: ui
tags: [multi-account, combined-caption, keyed-each, ui-copy, identity, d12, t-09-22]

requires:
  - phase: 09-04
    provides: "formatAccountCount, formatCombinedCaption, ACCOUNT_ROW_MULTI_SUMMARY, formatEarliestCreated, accountCountOf and earliestCreated in identity-model.ts, and the multi-account browser spec to extend"
provides:
  - "src/lib/shell/DashboardSection.svelte — optional accountCount prop and the combined-caption paragraph as the provenance block's first child"
  - "src/lib/shell/Dashboard.svelte — sectionProps passes accountCountOf(result), fixed at one for the Account section"
  - "VehicleTable.svelte and BattleTypeSummary.svelte — the two repeated-value keyed each blocks now key by position (D-12)"
  - "overview-model.ts and selection-state.ts — the Account card title/summary and the Account row headline/summary for two or more accounts"
  - "tests/unit/import/multi-account-keys.test.ts (new) — the source guard, the non-vacuity data test and the 48-row keyed-each audit"
  - "tests/e2e/shell/multi-account.spec.ts — the pane walk, the caption checks, the repeated-value checks, the one-account replace and the page-error assertion"
affects: [09-06, 10]

actuals:
  tokens: 328
  tasks: 3
  commits: 4
plan_head_before: 98417992598fd400390bb2a36e954ebfb410c7cf
plan_head_after: 02078eb65ede6204bcf60113c3c441cf8e4f920e

tech-stack:
  added: []
  patterns:
    - "The caption's threshold lives in one `$derived` in `DashboardSection`, not in two `{#if}` conditions in the template, for the same reason `statusLine` is computed there"
    - "The caption's `{#if}` tag is written FLUSH against the `<div>` and the `from` span: a newline there becomes a whitespace text node, which changes `provenance`'s own text content"
    - "`keyExpressions` returns every each key in a component rather than the first, because a component may carry several blocks keyed on different principles and only one of them is the one under test"
    - "A source guard is paired with a DATA test: the guard alone would pass just as well on a fixture whose ids never repeat, so the repeated values are proved to exist in the merged view"

key-files:
  created:
    - tests/unit/import/multi-account-keys.test.ts
  modified:
    - src/lib/shell/DashboardSection.svelte
    - src/lib/shell/Dashboard.svelte
    - src/lib/shell/overview-model.ts
    - src/lib/shell/selection-state.ts
    - src/lib/features/vehicles/VehicleTable.svelte
    - src/lib/features/vehicles/BattleTypeSummary.svelte
    - tests/e2e/shell/multi-account.spec.ts
    - tests/unit/shell/overview-model.test.ts
    - tests/unit/shell/selection-state.test.ts

key-decisions:
  - "`accountCount` defaults to ONE in `DashboardSection`, so every pre-Phase-9 caller and the single-account path render no caption node at all — the absence is a default, not a branch someone has to remember"
  - "The Account section is the one section that gets a FIXED count of one rather than the real one: it is the list of accounts, so '3 accounts combined' there would repeat the header instead of qualifying anything"
  - "Both repeated-value keys became POSITIONAL rather than becoming a composite key: Phase 9 must not sum or de-duplicate across accounts (Phase 10's work), and a composite key would hide the two rows behind one identity"
  - "The Overview Account card's TITLE becomes the count for N >= 2 while the headline stays the row's — the card's label is what says 'Account' as a category, and on a multi dataset that label is the count"
  - "`earliestCreated` is reused as 09-04 wrote it rather than recomputed here, so the date shown is the export's own spelling and one function owns the minimum"

requirements-completed: [ACCOUNT-02, ACCOUNT-05]

coverage:
  - id: D1
    description: "Every existing pane opens on the three-account dataset with no page error and no console error"
    requirement: ACCOUNT-02
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#(a) — the pane walk opens all nine PANE_IDS, plus the final 'no page error and no console error' step"
        status: pass
    human_judgment: false
  - id: D2
    description: "The six panes that read merged rows carry '{N} accounts combined' as the provenance block's first child; Overview, Account and Not yet supported carry none"
    requirement: ACCOUNT-02
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#expectCombinedCaption — count, text and first-child position, per pane"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Blitz vehicle table and the battle-type summary render the repeated ids and codes as separate rows, with no duplicate-key console message"
    requirement: ACCOUNT-02
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the Vehicles pane renders the repeated ids and codes — distinct < total on both"
        status: pass
      - kind: unit
        ref: "tests/unit/import/multi-account-keys.test.ts#keyed each: repeated values are real (2 accounts, 3 accounts, and the 1-account control)"
        status: pass
    human_judgment: false
  - id: D4
    description: "With two or more accounts the Account row and the Overview card name the accounts and the earliest creation date; with one they are byte-identical to v1.0"
    requirement: ACCOUNT-02
    verification:
      - kind: unit
        ref: "tests/unit/shell/selection-state.test.ts (7 new) and tests/unit/shell/overview-model.test.ts (7 new)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the Account row and the Overview card name the accounts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Replacing the three-account dataset with a one-account export removes every caption, restores the v1.0 header, the Account row and the single-account card"
    requirement: ACCOUNT-02
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#a one-account replace removes every caption and restores v1.0"
        status: pass
    human_judgment: false
  - id: D6
    description: "No root's login domain, birth date, overflow cell, forum email, forum IP or chat text reaches any of the nine panes after a three-account import"
    requirement: ACCOUNT-02
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#expectNoPaneLeak — 12 needles over the detail pane's outerHTML and innerText, per pane"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every keyed each in src/lib is audited to one of four stated reasons, and an unaudited or stale block fails the test by name"
    requirement: ACCOUNT-02
    verification:
      - kind: unit
        ref: "tests/unit/import/multi-account-keys.test.ts#keyed each: audited list — 48 blocks, a non-empty scan, no unaudited and no stale row"
        status: pass
    human_judgment: false
  - id: D8
    description: "The caption's visual weight at desktop and at 375px: it reads as the Label role above the source line rather than as an alert, and the provenance block does not widen the page"
    verification: []
    human_judgment: true
    rationale: "Type, colour and spacing were taken verbatim from UI-SPEC Surface 2 (Label role, `--muted`, 14/600/1.4, `flex-basis: 100%`) and the page-width question is answered by the existing 375px sweep in `master-detail-nav.spec.ts`, which passed unedited — but how the line READS next to the source line is a property of a rendered page, which no source contract can prove"

duration: 18 min
completed: 2026-10-17
status: complete
---

# Phase 9 Plan 05: Every pane opens on a multi-account dataset, and says it is combined Summary

**Six panes gained a "{N} accounts combined" caption, the two keyed each blocks whose keys repeat across accounts now key by position, the Account row and Overview card name the accounts, and one three-account browser test proves all of it — panes, captions, replacements and leaks — in a single import.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-17T03:15:59Z
- **Completed:** 2026-10-17T03:27:19Z
- **Tasks:** 3
- **Files modified:** 10 (1 created, 9 modified)

## Accomplishments

- **`DashboardSection.svelte` took an optional `accountCount` prop** defaulting to one, and renders the `combined-caption` paragraph as the first child of the provenance block whenever the count is two or more. The caption is absent — not empty, not hidden — for one account, and a pane with no provenance block has no caption either, because there is nothing on screen for it to qualify.
- **`Dashboard.svelte` passes `accountCountOf(result)` to every section** and a fixed one to the Account section, which is the list of accounts.
- **The Vehicles pane stopped erroring.** `WOTB_Vehicle_Statistics.csv` exists in all three fixture roots and `WOTB_Battle_Types_Statistics.csv` in two, so `row.id` and `row.code` were repeated keys. Both blocks now key by position; no row builder, aggregate or column changed.
- **The Account list row and the Overview Account card name the accounts** for two or more: the headline and card title become "3 accounts", the row summary becomes `ACCOUNT_ROW_MULTI_SUMMARY`, and the card summary becomes the minimum creation date across accounts (or the unknown-date sentence). One account — and an empty `accounts` list — is byte-identical to v1.0.
- **A 48-row keyed-each audit** pins every keyed `{#each}` in `src/lib` to one of four stated reasons (position, fixed list, de-duplicated upstream, unique within its group), with a data test proving the two values that made the old keys wrong really do repeat.

## Task Commits

1. **Task 1: Tracer, the three-account dataset opens every pane with its caption, and a one-account replace removes it** — `9f6e4b7` (feat)
2. **Task 2: The Account row and the Overview card for two or more accounts, with one account unchanged** — `c2924b7` (feat)
3. **Task 3: Keyed each audit, a source guard, and the data that proves the old keys repeat** — `0d70443` (test)
4. **Fix: keep the caption's conditional flush so the provenance text is unchanged** — `02078eb` (fix)

The fourth commit is a deviation, not a fourth task: see below.

## Files Created/Modified

- `src/lib/shell/DashboardSection.svelte` — the `accountCount` prop, the `combinedCaption` derived, the caption paragraph and its `.combined` rule (14/600/1.4, `--muted`, `flex-basis: 100%`, no new colour, no media query, no `aria-live`), and the header comment recording the D-11 rules
- `src/lib/shell/Dashboard.svelte` — `sectionProps` gains `accountCount`
- `src/lib/features/vehicles/VehicleTable.svelte` — `{#each drawn as { row, index } (index)}` plus the D-12 comment
- `src/lib/features/vehicles/BattleTypeSummary.svelte` — `{#each summary as row, index (index)}` plus the D-12 comment
- `src/lib/shell/selection-state.ts` — the multi branch of the `account` entry, the `identity-model` import and the Phase 9 header note on what the row may read
- `src/lib/shell/overview-model.ts` — the multi title and the `formatEarliestCreated(earliestCreated(...))` summary, with the one-account branch left intact on purpose
- `tests/unit/import/multi-account-keys.test.ts` (new) — three describes: source guard, repeated values are real, audited list
- `tests/e2e/shell/multi-account.spec.ts` — five new `test.step` blocks appended to plan 09-04's single test, plus `collectPageErrors`, `expectCombinedCaption`, `expectNoPaneLeak` and `readAccountRow`
- `tests/unit/shell/selection-state.test.ts` — a 7-test describe on the multi Account row
- `tests/unit/shell/overview-model.test.ts` — an 8-test describe on the multi Account card

## Decisions Made

- **`accountCount` defaults to one, so "no caption for a single account" is a DEFAULT rather than a branch.** Every caller that predates this prop, every muted section, and the `user-info` pane get the v1.0 DOM without anyone deciding to exclude them.
- **The caption is inside the provenance block, not beside it.** UI-SPEC Surface 2 puts it there, and it is the only place where the pane already says "where these numbers came from" — so the two statements read as one thing. `flex-basis: 100%` gives it its own line within the existing wrapping flex row.
- **Both keys became positional rather than composite.** A composite key (`row.id + ':' + index`) would let two rows share one identity in a keyed each, which is what Svelte's map then collapses; a positional key says plainly "these are two rows" — which is the truth until Phase 10 decides they should be one.
- **The Overview card's title became the count, not its headline.** The card's `title` is what reads "Account" as a category label; on a multi dataset that label is the count. The `headline` is left to the row, so both surfaces still say the same thing (D-08).
- **The one-account branch in `overviewCards` was kept, not collapsed into the multi one.** `earliestCreated` over a one-account list would answer the same day in the same spelling, so the two could share a line — but keeping them separate makes "one account renders v1.0" a structural fact rather than a coincidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The caption's conditional introduced a whitespace text node that changed `provenance`'s text content**
- **Found during:** the plan-level `<verification>`, after Task 3 — `tests/e2e/shell/master-detail-nav.spec.ts#(panes) each pane mounts exactly its own section, with a provenance line` failed on `toHaveText(/^From Player_statistics · 19 files, 47 rows/)` with the received string `" From Player_statistics · 19 files, 47 rows "`.
- **Issue:** the `{#if}` around the caption was written on its own line inside the `.provenance` div. Svelte preserves that newline as a whitespace TEXT NODE between the div and its first element, so for a ONE-account dataset — where the caption renders nothing — the provenance's own text now starts with a space. That is invisible on screen and completely invisible to `innerText`-style reads, but it is a change to a v1.0 DOM that a pre-existing test rightly guards.
- **Fix:** the `{#if}` tag and its `<p>` are now written flush against the `<div>` and the `from` span, so no whitespace node can exist between them. The reason is written into the component's comment block above the div, explicitly naming the assertion that catches it, so a future formatter run does not silently undo it.
- **Files modified:** `src/lib/shell/DashboardSection.svelte`
- **Verification:** `master-detail-nav.spec.ts` 15 passed unedited; the full three-spec run is 41 passed.
- **Committed in:** `02078eb`

### Plan-text corrections (executor judgement, no implementation deviation)

- **The Account row / Overview card step was moved after the pane walk in the browser spec.** The plan's `<behavior>` lists it first, but its wording comes from Task 2's model. Written in the plan's order, Task 1's own proof (the pane walk, the captions and the Vehicles pane) would sit behind a step that fails until Task 2 lands, so a Task 1 failure could not be distinguished from a Task 2 one. The assertions are unchanged and in the same test; only their position moved, and the step says why.
- **Task 3's audit needed the `by_Type` file as well as the vehicle and battle-types files.** `buildVehicleView` derives the selectable battle-type codes from `by_Type`, and a title with no codes renders NO battle-type summary at all — so a two-file fixture returned an empty `summary` and the data test failed for a reason that had nothing to do with duplicate keys. `blitzFiles()` now builds the three-file set a real Blitz root carries.
- **`keyExpression` became `keyExpressions`.** The single-return helper read the FIRST `{#each}` in a file, which in `VehicleTable.svelte` is the column list (`column.key`), not the data rows D-12 is about. The plural returns every key so a test can assert on the one it means and on the absence of the one it forbids.

---

**Total deviations:** 1 auto-fixed (1 bug: a whitespace text node that changed a v1.0 DOM's text content, caught by an unedited pre-existing spec).
**Impact on plan:** The fix is a formatting constraint in one component's markup plus a comment explaining it. No behaviour changed, and the caption's placement, styles and threshold are exactly as the plan specified.

## Issues Encountered

- The Vehicles pane did NOT error on the duplicate keys in a production build — Svelte silently drops a repeated keyed row rather than throwing, which is precisely why the plan asked for a source guard plus a data test rather than a render check. The browser step therefore asserts the repeated ids and codes are DRAWN (distinct < total), which is the property that a dropped row would have broken.
- A stray NUL byte in the new test file (from a scripted in-place edit) broke the audit map lookup in a way that read as "every block is unaudited". Found by dumping the map's keys to disk and diffing them against the scan; the scan itself was correct throughout.

## Known Stubs

None. The caption renders a formatter's output for a count it was given, the multi row and card render constants and a real minimum, and every test asserts on real values rather than a placeholder.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **09-06** appends to the SAME test in `tests/e2e/shell/multi-account.spec.ts`, which is now at `test.setTimeout(240_000)` with five further steps and two reusable helpers it can call per pane: `expectNoPaneLeak(page, where)` and `expectCombinedCaption(page, pane)`. The test currently takes about 12 seconds.
- The suite is now at 257 listed tests, unchanged from 09-04: this plan added `test.step` blocks, not a second test (Planner choice 6). 09-06's second and last test therefore brings it to 258, exactly the D-23 ceiling.
- **Phase 10** inherits two named seams: the two keyed blocks now key by position, so merging rows across accounts is a change to the row BUILDERS (`buildVehicleView`, `buildSummary`) with no keyed-each work left; and `combinedCaption` in `DashboardSection` is the one place the caption is decided, so replacing it with per-account filtering or a source-account column is a single `{#if}`.
- `earliestCreated` and `accountCountOf` stayed in `identity-model.ts` (09-04's file) rather than moving into either model this plan touched, which keeps one owner for "how many accounts" and "what is the earliest".

## Self-Check: PASSED

- Created files exist: `tests/unit/import/multi-account-keys.test.ts` — confirmed on disk.
- Commits exist and are ancestors of HEAD: `9f6e4b7`, `c2924b7`, `0d70443`, `02078eb` (measured `git rev-list --count 9841799..HEAD` = 4, matching the ledger written before the first commit).
- Every task acceptance criterion re-run and green: the three e2e specs (41 passed), `pnpm exec vitest run` on the three Task 2 files (91 passed) and on the two Task 3 files (45 passed), the three guard files (25 passed), `pnpm run test:unit` (3109 passed), `pnpm run check` (313 files, 0 errors, 0 warnings), `pnpm run lint` (clean), `grep -c` on all four named criteria (combined-caption 1, accountCount 2, `(index)` 1 and 1, ACCOUNT_ROW_MULTI_SUMMARY 2, earliestCreated 4), `playwright test --list` on `multi-account.spec.ts` = exactly 1 test, and `git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml` exits 0.
- Plan 09-03's five files remain staged and uncommitted: `src/lib/worker/db.ts`, `src/lib/worker/ingest.worker.ts`, `tests/unit/import/db.test.ts`, `tests/unit/import/multi-account-lifecycle.test.ts`, `tests/unit/import/replay-reclassify.test.ts`.

---
*Phase: 09-multi-account-import-account-identity*
*Completed: 2026-10-17*