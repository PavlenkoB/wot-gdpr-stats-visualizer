---
phase: 14-design-unification
plan: 16
subsystem: ui
tags: [svelte, css, design-tokens, shared-blocks, display-role, nesting, status-tokens]

# Dependency graph
requires:
  - phase: 14-design-unification
    provides: the token scale in `src/styles/tokens.css` (the `--fs-*`, `--fw-*`, `--lh-*`, `--space-*`, `--radius-*` and `--layout-*` custom properties) and the shared blocks in `src/styles/utilities.css`
  - phase: 14-design-unification
    provides: the shared chart pieces the finance pane uses (plan 14-15) - the migration this plan joins
provides:
  - The finance pane's four own blocks are on the token layer: no hex literal, every size, weight, leading, radius and gap a token
  - `SpendSummary`'s spend headline takes the Display role: the markup carries `t-display` and the local rule states only the ink, the min-width and the wrap
  - `CurrencyBlock`, `PremiumBlock`, `FinancialData` and `SpendSummary` define none of `.body`, `.caption` or `.error` - the shared blocks of `src/styles/utilities.css` serve the existing markup
  - The four files are off `PENDING_FILES`, so the design-token and nesting guards now sweep them
affects: [14-design-unification, finance, CurrencyBlock, PremiumBlock, FinancialData, SpendSummary, phase-8-ui-review-guards]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 96000
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A shared block is DELETED, not tokenised, when the shared rule already declares the same values. A scoped local copy outranks the global one, so keeping it would make the migration a no-op with extra steps."
    - "A role is taken only when the site's computed triple EQUALS the role's triple. The spend headline's 26px/600/1.3 is exactly `.t-display`, so the role is Display and not Heading."

key-files:
  created: []
  modified:
    - src/lib/features/finance/CurrencyBlock.svelte
    - src/lib/features/finance/PremiumBlock.svelte
    - src/lib/features/finance/FinancialData.svelte
    - src/lib/features/finance/SpendSummary.svelte
    - tests/unit/guards/phase8-ui-review-guards.test.ts
    - tests/helpers/migration.ts

key-decisions:
  - "The four files' local `.body`, `.caption` and `.error` rules are DELETED, not tokenised. The shared rules in `src/styles/utilities.css` declare the same values (`.body` margin 0, min-width 0, 14/400/1.5 in `--text`, wrap anywhere; `.caption` the same at 1.4 in `--muted`; `.error` the danger border, the 6px radius and the danger background), and a scoped local copy would outrank the shared one. The markup keeps `class=\"body\"`, `class=\"body error\"` and `class=\"caption\"`, so the seven e2e locators on `p.body`, `p.caption` and `p.caption.title` resolve exactly as before."
  - "The spend headline takes the DISPLAY role. The element carries `t-display` next to its own `headline` hook, and the local rule DROPS the size, the weight and the leading so no local declaration competes with the role. The role's triple is 26px/600/1.3 - exactly what the rule declared - so the figure renders as before. The UI-SPEC calls the headline a FIGURE, not a title, which is why the role is Display and not Heading."
  - "`summary:focus-visible` is NESTED as `&:focus-visible` under `summary` in `CurrencyBlock` and `PremiumBlock`, which have a `summary` rule. G6b counts `:` as an extension character, so the flat rule was an offence once the files came off the pending list. The compiled CSS is unchanged in selector, specificity and order: `summary.svelte-1beoxzk:focus-visible` and `summary.svelte-gdw9he:focus-visible`."
  - "`SpendSummary`'s `summary:focus-visible` STAYS top-level. That file has no `summary` rule to nest it under, and G6b's nesting needs a parent; inventing one would be a rule describing nothing. `details > table` stays top-level for the same reason - there is no `details` rule."
  - "`PremiumBlock`'s `.unrecognised` padding-left moves from 20px to `var(--layout-gutter)`. 20px is off the spacing scale, and `--layout-gutter` is exactly 20px, so the rendered padding is unchanged."
  - "The three status hexes are gone from all three files that held them (`#c5221f`, `#fce8e6`, `#8a1c17` - nine declarations). The shared `.error` utility reads `--danger`, `--danger-bg` and `--danger-ink`, and every 6px radius reads `--radius-sm`."
  - "The `caption.sr-only` element rule and the local `.sr-only` clip block STAY. The shared clip name is `visually-hidden`, and a clip block under any other name stays local (D-02). Its `margin: -1px` stays legal because the same rule declares `clip`."

patterns-established:
  - "A role is taken only on an EXACT triple match, and the local rule then states only what the role does not. The spend headline kept its ink, its min-width and its wrap and dropped the three declarations the role now owns."

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-07, D-13]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "The four finance blocks are token-based and swept: CurrencyBlock, PremiumBlock, FinancialData and SpendSummary define none of .body, .caption or .error, hold no status hex, and are off PENDING_FILES and the status-colour entries of ALLOWED_COLOUR_LITERALS."
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/finance tests/unit/charts tests/unit/guards - 35 files, 812 tests, all pass (the plan's Task 1 verify)"
        status: pass
      - kind: unit
        ref: "pnpm run test:unit - 164 files, 4899 passed, 9 expected fail, 0 failed (fourth run; the first three hit the known pre-existing overview-grid starvation flake under a load average of 11-12)"
        status: pass
      - kind: other
        ref: "compiled bundle dist/assets/index-*.css: no finance scope declares .body, .caption or .error, and the only raw status hexes left in the bundle are the :root token declarations and the four still-pending files' .error rules"
        status: pass
    human_judgment: false
  - id: D2
    description: "The spend headline figure takes .t-display: the markup carries the role and the local rule no longer declares a size, a weight or a leading."
    verification:
      - kind: unit
        ref: "grep -c \"t-display\" src/lib/features/finance/SpendSummary.svelte - 1 (the plan's Task 2 acceptance criterion)"
        status: pass
      - kind: other
        ref: "compiled bundle dist/assets/index-*.css: .t-display{font-size:var(--fs-display);font-weight:var(--fw-semibold);line-height:var(--lh-heading)} and .headline.svelte-ashesq{color:var(--ink);overflow-wrap:anywhere;min-width:0;margin:0} - the role's triple is 26px/600/1.3, exactly what the deleted rule declared"
        status: pass
    human_judgment: false
  - id: D3
    description: "The seven e2e locators on p.body, p.caption and p.caption.title still resolve, because the shared classes keep their names and the markup is unchanged."
    verification:
      - kind: e2e
        ref: "tests/e2e/finance/finance.spec.ts - 32 tests, all pass; tests/e2e/finance/spend.spec.ts - 10 tests, all pass; tests/e2e/finance/finance-scale.spec.ts - 5 tests, all pass (49 e2e in 1.1m with the temporary port-4174 config)"
        status: pass
      - kind: unit
        ref: "grep -c 'class=\"body error\"' src/lib/features/finance/CurrencyBlock.svelte src/lib/features/finance/PremiumBlock.svelte - 2 each (the plan's Task 1 acceptance criterion)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The four files are nested where a parent rule exists: the two chart blocks nest summary:focus-visible under summary, and the spend summary's state rule and details > table stay top-level because no parent rule exists."
    verification:
      - kind: unit
        ref: "tests/unit/guards/nesting-guard.test.ts and tests/unit/guards/design-tokens-guards.test.ts pass as part of `pnpm exec vitest run tests/unit/finance tests/unit/charts tests/unit/guards`"
        status: pass
      - kind: other
        ref: "compiled bundle dist/assets/index-*.css: summary.svelte-1beoxzk:focus-visible and summary.svelte-gdw9he:focus-visible are the same selectors the flat rules produced, and summary.svelte-ashesq:focus-visible is unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "The finance pane renders as before: the spend headline, the charts and the tooltip keep every computed size, weight, leading, radius and gap, and this plan adds no visible change of its own."
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/chart-fill.spec.ts - 2 tests, all pass (the plan's named spec)"
        status: pass
      - kind: other
        ref: "scratch capture sets at $TMPDIR/wg-phase14: before-14-16 (the pre-plan commit f1a5150, built in a scratch worktree) against after-14-16 - 8 of 8 pairs byte-identical at 1280, 900, 899 and 375px for the finance and payments panes"
        status: pass
    human_judgment: true

# Metrics
duration: 52min
completed: 2026-10-27
status: complete
---

# Phase 14: Design Unification Summary

**The finance pane's own four blocks moved onto the token layer, the spend headline took the Display role, and the nine status hexes and the four 6px radii the pane owned are gone — with every one of the eight captured panes byte-identical to the pre-plan build**

## Performance

- **Duration:** 52 min
- **Started:** 2026-10-27T22:27:00+04:00
- **Completed:** 2026-10-27T23:19:00+04:00
- **Tasks:** 2
- **Files modified:** 7 (6 code + this summary)

## Accomplishments

- `CurrencyBlock.svelte`, `PremiumBlock.svelte`, `FinancialData.svelte` and `SpendSummary.svelte` are token-based and off `PENDING_FILES`, so the design-token guard (G1/G3/G4/G5/G6) and the nesting guard now sweep them. No hex literal survives in any of the four.
- The three shared names — `.body`, `.caption` and `.error` — are defined in none of the four files. The shared blocks of `src/styles/utilities.css` serve the existing markup, so the seven e2e locators on `p.body`, `p.caption` and `p.caption.title` need no edit and resolve exactly as before.
- The spend headline takes the **Display role**. The markup carries `t-display` next to its own `headline` hook, and the local rule drops the size, the weight and the leading so nothing competes with the role. The role's triple is 26px/600/1.3 — exactly what the rule declared — so the figure renders as before.
- The nine status hex declarations (`#c5221f`, `#fce8e6`, `#8a1c17` — three each in `CurrencyBlock`, `PremiumBlock` and `SpendSummary`) are gone: the shared `.error` utility reads `--danger`, `--danger-bg` and `--danger-ink`. All four 6px radii read `--radius-sm`, and `PremiumBlock`'s off-scale 20px left padding reads `--layout-gutter` (still 20px). The plan's objective counted six hexes and two radii; the measurement at the pre-plan commit found nine and four, and all of them went.
- `summary:focus-visible` is nested as `&:focus-visible` under `summary` in the two chart blocks, which have a `summary` rule. The compiled selectors are identical to the flat ones they replaced.
- The three status-colour entries of the phase-8 UI review guard's allow-list and the `PENDING_FILES` list both shrank by the four files. No entry was left stale.

## Task Commits

Each task was committed atomically:

1. **Task 1: migrate the currency, premium and financial-data blocks** - `10e9e9f` (refactor)
2. **Task 2: migrate the spend summary and take the Display role** - `cc50e85` (refactor)

**Plan metadata:** `14-16-SUMMARY.md` (docs: complete plan)

## Files Created/Modified

- `src/lib/features/finance/CurrencyBlock.svelte` - the virtual-currency block. Its local `.body`, `.caption` and `.error` are deleted for the shared ones; `h3`, `h4`, `details`, `summary` and `ul` read the type, spacing and colour tokens; `summary:focus-visible` is nested under `summary` for G6b.
- `src/lib/features/finance/PremiumBlock.svelte` - the premium-time block. The same three shared names are deleted; `h4.chart-title` reads the type tokens; `.unrecognised`'s left padding reads `var(--layout-gutter)`; `summary:focus-visible` is nested under `summary`.
- `src/lib/features/finance/FinancialData.svelte` - the pane's wrapper. Its local `.body` is deleted for the shared one, and the 24px stack gap reads `var(--space-24)`.
- `src/lib/features/finance/SpendSummary.svelte` - the spend summary. The three shared names are deleted; the headline takes `t-display` and keeps only its ink, min-width and wrap; the table, `th` and `td` rules read the type and padding tokens; the `caption.sr-only` element rule and the local `.sr-only` clip block stay.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - the phase-8 UI review guard. The three status-colour allow-list entries no longer name the four migrated files.
- `tests/helpers/migration.ts` - `PENDING_FILES` no longer lists the four migrated files.

## Decisions Made

- **The shared names are DELETED, not tokenised.** The shared rules declare the same values, and a scoped local copy outranks the global one, so keeping it would have made the migration a no-op with extra steps. The markup keeps `class="body"`, `class="body error"` and `class="caption"`.
- **The headline's role is Display, not Heading.** A role is taken only when the site's computed triple equals the role's triple. The headline's 26px/600/1.3 is exactly `.t-display`; `.t-heading` is 18px/600/1.3, so it does not apply. The UI-SPEC calls the headline a FIGURE, not a title.
- **`summary:focus-visible` is nested in the two chart blocks and left alone in the spend summary.** The chart blocks have a `summary` rule, so the flat state rule was a G6b offence and is now `&:focus-visible` under it. The spend summary has no `summary` rule, and nesting needs a parent — inventing one would be a rule describing nothing.
- **`details > table` stays top-level.** There is no `details` rule in the spend summary, and the selector matches a table that is a direct child of a `details` element; nesting it under `.breakdown` would be a different rule with the same match set and no gain.
- **`PremiumBlock`'s 20px padding reads `--layout-gutter`.** The spacing scale has no 20px step, and `--layout-gutter` is exactly 20px, so the rendered padding is unchanged.
- **The `caption.sr-only` element rule and the local `.sr-only` clip block stay.** The shared clip name is `visually-hidden`, and a clip block under any other name stays local (D-02). Its `margin: -1px` stays legal because the same rule declares `clip`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The phase-8 guard rejected the first wording of the shared-blocks comment**
- **Found during:** Task 1 (migrating `CurrencyBlock.svelte`)
- **Issue:** The comment explaining why the local copies are deleted read "a scoped rule outranks a global one". `tests/unit/guards/phase8-ui-review-guards.test.ts:352` forbids that exact phrase in any file under `src/` — it is the wording of a comment retired in plan 14-06, and the guard fails on it.
- **Fix:** The comment was reworded to the house style already used by `PlayerStats.svelte` and `BattleTypeSummary.svelte`: "a scoped local copy would outrank the shared one". The same comment in all three files was reworded with it.
- **Files modified:** `src/lib/features/finance/CurrencyBlock.svelte`, `src/lib/features/finance/PremiumBlock.svelte`, `src/lib/features/finance/FinancialData.svelte`
- **Verification:** `pnpm exec vitest run tests/unit/guards/phase8-ui-review-guards.test.ts` passes; the guard's stale-prose case lists no finance file.
- **Committed in:** `10e9e9f` (part of the task commit)

**2. [Rule 1 - Convention] The screenshot capture went into its own labelled set, not the shared `after`**
- **Found during:** Task 2 (the scratch capture step)
- **Issue:** The plan's action says to run the scratch `shots --label after` and compare with `before`. The dispatch brief states that the shared `before/`/`after/` capture sets are stale for the current build and must not be clobbered, and the baseline `before/` set turns out to be stale in a way that matters here: it captures the finance pane MID-LOAD ("Calculating financial data…"), because it predates the harness's settle wait for `data-state="ready"`.
- **Fix:** The capture went into `$TMPDIR/wg-phase14/after-14-16/`, and the pre-plan state was captured into `$TMPDIR/wg-phase14/before-14-16/` from the same harness, the same widths and the same panes, using a scratch worktree build of the pre-plan commit `f1a5150`. The shared sets were not touched.
- **Files modified:** none — the captures are scratch, outside the repository
- **Verification:** all 8 pairs (1280, 900, 899, 375px × finance, payments) are byte-identical between `before-14-16` and `after-14-16`.
- **Committed in:** n/a — nothing in the repository changed

---

**Total deviations:** 2 (1 correction inside the plan's own file list, 1 scratch-artifact labelling)
**Impact on plan:** Both are inside the plan's scope and neither changes what the plan asked for. The first is a comment wording a guard forbids; the second is the labelling of a scratch capture the brief explicitly redirected.

## Issues Encountered

- **A stale `vite preview` holds port 4173.** The committed `playwright.config.ts` sets `reuseExistingServer: false`, so Playwright cannot start its own server there and would have tested the STALE build. A temporary config overriding `use.baseURL` and `webServer` to port 4174 was written to the repo root, used, and then moved back out of the repository to `$TMPDIR/wg-phase14/`. `playwright.config.ts` is untouched (`git diff --stat playwright.config.ts` is empty) and the temporary file is not committed.
- **The known pre-existing starvation flake in `tests/unit/overview/overview-grid.test.ts` fired on the first THREE full-suite runs** (1 failed / 4898 passed each time — "Test timed out in 20000ms", on "across every pin subset"). It is not caused by this change, and this was proved rather than asserted: a scratch worktree built at the pre-plan commit `f1a5150` fails on the SAME test with the SAME 20000ms timeout on this machine (load average 11-12 at the time), the file passes in isolation (19 tests in 21.4s), and the file is in no plan's `files_modified` list. The suite passes in full once the machine's load dropped to 3.85 (164 files, 4899 passed, 9 expected fail, 0 failed). Reported, not papered over; the timeout was not raised.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The finance pane's four own blocks are swept by the token and nesting guards, so the remaining pending files are the ones the phase has not reached yet: the account-timeline pair, the device-info pair, the new-data card, table and three panes, and the five Overview files (plans 14-17 to 14-19).
- The two sets of scratch captures (`before-14-16` and `after-14-16`) are kept for UAT. They are the pre-plan and post-plan states of this plan; a later plan comparing against the phase `before` baseline is comparing against a set that captures the finance pane mid-load.
- Open items this plan did NOT touch (they are outside its file list, so they are reported rather than edited): `tests/e2e/_support/helpers.ts:541` (says the stat tile numerals are 30px), `tests/e2e/shell/master-detail-nav.spec.ts:72` (comment names the retired 30), `tests/unit/device-info/device-info-blocks.test.ts:143` (hard-coded `['14','18','26','30']` superset), `src/lib/features/logins/map-model.ts:36` (still says "ramp" in prose).
- Plan 14-14's flagged judgement call for the owner is unchanged and still open: the neutral `.info` box border was kept at `var(--border)` rather than `var(--faint)`, because the UI-SPEC's Allowed Visible Changes list names only the 4px toggle gap. This plan did not act on it.

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
