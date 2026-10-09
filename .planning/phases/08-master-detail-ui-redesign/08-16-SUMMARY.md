---
phase: 08-master-detail-ui-redesign
plan: 16
subsystem: testing
tags: [playwright, e2e, master-detail, finance, payments, spend, scale]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the master-detail shell, the openSection/importAndOpen helpers and the R1-R10 rules (08-02 to 08-07)"
provides:
  - "tests/e2e/finance/spend.spec.ts: 10 listed tests on the Real-money spend block, read through the Payments pane"
  - "tests/e2e/finance/finance-scale.spec.ts: 5 listed tests on the 50,000-operation finance import, read through the Finance pane"
affects: [08-17, 08-18]

actuals:
  tokens: 6000
  tasks: 3
  commits: 3
plan_head_before: ef4ad4bb3daaa43512c0ef360759e0711ef32654
plan_head_after: acd8aa27374b2bdb41c33b4eb9abdab0afa32164
commits: 3

tech-stack:
  added: []
  patterns:
    - "A page-wide absence claim is made pane by pane: one surface-building helper is run on Overview, Finance and Payments and the same refusals are applied to each"
    - "A scale spec whose import can approach the shared 30 s ceiling waits for the landing with its own budget instead of waitForImported"

key-files:
  created: []
  modified:
    - tests/e2e/finance/spend.spec.ts
    - tests/e2e/finance/finance-scale.spec.ts

key-decisions:
  - "finance-scale uses a spec-local awaitLanded (identity header out of skeleton, processing notice gone) with READY_BUDGET_MS rather than waitForImported: the 50,000-operation import measured 25.1 s and 26.6 s to ready, too close to the helper's fixed 30 s"
  - "(no-blended) widens its attribute scan from the spend block to every title and aria-label on the page, on each of three panes"

requirements-completed: []

coverage:
  - id: D1
    description: "The spend sample-export figures, counts, gift lines, excluded pill and breakdown tables are proven through the Payments pane with every fixture-derived value unchanged"
    verification:
      - kind: e2e
        ref: "tests/e2e/finance/spend.spec.ts#05-15 real-money spend: the sample export"
        status: pass
    human_judgment: false
  - id: D2
    description: "No figure across currencies appears on Overview, Finance or Payments; the empty and no-usable states and the long-text widths hold; no canary reaches Payments, Overview or the list pane"
    verification:
      - kind: e2e
        ref: "tests/e2e/finance/spend.spec.ts#no-blended, states, empty, privacy, long-text"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 50,000-operation import and the 10,000-operation replace are proven through the Finance pane with the single serial import, five tests and the original submission-to-ready timing start"
    verification:
      - kind: e2e
        ref: "tests/e2e/finance/finance-scale.spec.ts#(1) to (5)"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 16: Migrate the spend and finance-scale specs Summary

**spend.spec.ts (10 listed tests) now reads the Real-money spend block through the Payments pane, with the no-blended scan widened to Overview, Finance and Payments, and finance-scale.spec.ts (5 listed tests) keeps its single 50,000-operation serial import and re-opens the Finance pane after the import and after the replace.**

## Performance

- **Duration:** about 10 min
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files:** 2 modified

## Accomplishments

- **Tracer (Task 1).** The serial sample-export describe opens `payments` in `beforeAll` after the single import. The card `data-status` and the block `data-state` remain two separate assertions; no fixture-derived figure, count, gift line, pill or breakdown row was touched. 4 tests green.
- **Task 2.** `(states)`, `(empty)`, `(privacy)` and both `(long-text)` widths use `importAndOpen(..., 'payments')`. `(empty)` keeps both assertions (section `empty` with the 'This export contains no rows for Payment_history' wording, no spend block). `(no-blended)` builds one surface (body text, document title, every `title` and `aria-label` on the page) on Overview, on Finance (after the premium and currency blocks are `ready`) and on Payments (after the spend block is `ready`), and refuses the exact, float and pairwise blended figures on each. The structural claims (one total per card, none outside a card) and the positive headline checks run in the Payments pane. `(privacy)` reads the canary surface on Payments, on Overview and, separately, the list pane's own text. 10 tests green.
- **Task 3.** `importAndAwaitReady` and `replaceAndAwaitReady` wait for the landing, open `finance`, then wait for `currency-block` ready with `READY_BUDGET_MS`. The elapsed time still starts at submission. The replace helper still waits for the new oracle's own sentence. All oracle, chart, other-row, pitch and caption assertions are untouched; the listed total is 5 and the serial import is a single one.

## Task Commits

1. **Task 1 (tracer): spend sample-export describe** - `4718e90` (test)
2. **Task 2: no-blended, states, empty, privacy, long-text** - `570c750` (test)
3. **Task 3: finance-scale** - `acd8aa2` (test)

## Deviations from Plan

**1. [Rule 3 - Blocking risk] Spec-local landing wait instead of `waitForImported` in finance-scale**
- **Found during:** Task 3
- **Issue:** The plan says to call `waitForImported(page)`, which has a fixed 30 s ceiling. The 50,000-operation import reached ready in 25.1 s and 26.6 s on this machine, leaving almost no margin on a slower runner (the spec's own budget is 60 s).
- **Fix:** A spec-local `awaitLanded` applies the helper's identical two signals (identity header out of `skeleton`, `processing-status` gone) with `READY_BUDGET_MS`. `helpers.ts` is untouched, as the dispatch instructed.
- **Files modified:** `tests/e2e/finance/finance-scale.spec.ts`
- **Commit:** `acd8aa2`

**Total deviations:** 1 (a test-side adaptation). **Impact:** none on assertions. The measured import-to-ready now includes the pane open, which is part of "reach the block", and the start point is unchanged.

## Issues Encountered

None. The throwaway Playwright config outside the repo was used because the installed browsers do not match the pinned version; `playwright.config.ts` and `helpers.ts` were not touched.

## Verification

- `playwright test -c <throwaway config> --project=chromium tests/e2e/finance/spend.spec.ts tests/e2e/finance/finance-scale.spec.ts` - 15 passed, 44.2 s
- `--list`: spend.spec 10 tests in 1 file; finance-scale.spec `Total: 5 tests in 1 file`
- `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` - 6 passed
- `pnpm run check` - 0 errors, 0 warnings; `pnpm run lint` (prettier and eslint) - clean
- `grep -c openSection tests/e2e/finance/spend.spec.ts` - 7; `(no-blended)` opens overview, finance and payments

## Known Stubs

None.

## Threat Flags

None. T-08-43 is mitigated: `(no-blended)` scans three panes and `(privacy)` scans Payments, Overview and the list pane. T-08-44 is mitigated: the scale timing still starts at submission.

## Self-Check: PASSED

- Both spec files exist; commits `4718e90`, `570c750`, `acd8aa2` exist; plan acceptance criteria re-run and pass.
