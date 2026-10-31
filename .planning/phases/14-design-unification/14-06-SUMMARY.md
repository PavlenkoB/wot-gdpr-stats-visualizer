---
phase: 14-design-unification
plan: 06
subsystem: ui
tags: [css, tokens, app-css, utilities, list-pane, nesting, d16, pixel-gate]

# Dependency graph
requires:
  - phase: 14-design-unification (plan 14-01)
    provides: "the shared token, role and utility stylesheets, and the scratch screenshot harness with its before/after sets"
  - phase: 14-design-unification (plan 14-03)
    provides: "the pure offender functions and the shrinking PENDING_FILES allowlist a migrated file leaves"
  - phase: 14-design-unification (plan 14-04)
    provides: "the nesting compile sweep, the one type scale and the one 12px floor every migrated file now answers to"
  - phase: 14-design-unification (plan 14-05)
    provides: "the title role on every pane title and the D-16 compensation on the Overview title"
provides:
  - "src/app.css as the element resets, the shell layout and the ONE phone block, every value on the shared tokens"
  - ".btn, .btn:hover and .btn.primary in src/styles/utilities.css, its only home (D-02)"
  - "src/lib/shell/ListPane.svelte on the token layer, with its states nested and off the migration allowlist"
  - "the D-16 re-check: the Overview is byte-equal to the baseline outside its masked title box after the phone block was edited"
affects: [14-07, 14-08, 14-09, 14-10, 14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 14-18, 14-19, 14-20, 14-21]

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 4429
  tasks: 2
  commits: 2
plan_head_before: 4b3ddf1e1f0d1fac0d34e18cc60a501f074c1a4e
plan_head_after: 65891a231f960df1bda3286477263f8b115c97b2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nesting with `&` flattens to the SAME selector, so the specificity and the source order of a rule survive the move: `& .import-region` under `.pane-list` is `.pane-list .import-region`, and `&.footer` under a row is the same compound the flat rule had"
    - "A rule the phone block overrides stays a TOP-LEVEL rule: the phone block's selectors carry three classes, so a component rule nested under another parent selector would outrank the phone block and the outcome would depend on source order"
    - "The shared names move as a BLOCK: `.btn` left `app.css` with its `&:hover` and `&.primary` states nested under it, so the one definition of the button exists before the first component reaches for it"

key-files:
  created: []
  modified:
    - "src/app.css"
    - "src/styles/utilities.css"
    - "src/lib/shell/ListPane.svelte"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"
    - "tests/helpers/migration.ts"

key-decisions:
  - "The phone block's four nestable rules were nested rather than left flat: G6b (a rule that extends a sibling is nested under it) is a hard gate, and the plan's own rule - nest where a sibling parent exists - covers the two cases the plan did not name (the nav's last row and the phone bar's back button)"
  - "The plan named two of the four nestings explicitly; the other two were found by the guard sweep and are recorded here, because a reader who diffs the plan against the file needs to know that nothing was missed"
  - "The list pane's `.row` and `.chevron` stay top-level and only their OWN states nest under them: the phone block overrides the row at 480px and below, and a row nested under another parent would outrank it (playbook section 6)"
  - "The sticky import-region test now finds its rule through the brace-aware scanner and the flat selectors, and proves the at-rule through the ANCESTRY rather than the parent: the rule is nested under `.pane-list`, so the at-rule is two levels up"
  - "The `.btn` block keeps its declarations unchanged and only its padding moves to tokens: no component uses the class today, so the move cannot change a pixel, and the block is the shared definition the UI-SPEC names"

patterns-established:
  - "Pattern: the flat-selector proof - a rule that moves under a parent is checked by asking the scanner for its FLAT selector, which is the selector the browser still sees"
  - "Pattern: the ancestry proof - an at-rule that used to be the parent of a rule is now an ANCESTOR of it, and a reader that asks for the parent alone reads the wrong rule"

requirements-completed: [D-01, D-02, D-03, D-05, D-13, D-15, D-16]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "app.css holds the element resets, the shell layout and the ONE phone block, and every raw size, weight, line height, spacing value and colour is gone from it"
    requirement: D-01
    verification:
      - kind: other
        ref: "node /tmp/wg14/offenders.mts src/app.css -> no G1, G3, G4, G5, G6a or G6b offender (the same pure functions the guard suite runs)"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards tests/unit/shell -> 33 files, 1185 passed, and the stale-PENDING_FILES check names neither app.css nor ListPane.svelte"
        status: pass
      - kind: other
        ref: "grep -c '\\.btn' src/app.css -> 0; grep -c '\\.btn' src/styles/utilities.css -> 1; ! grep -nE '^\\s*--[a-z]' src/app.css -> exit 0; grep -c 'max-width: 480px' src/app.css -> 1"
        status: pass
    human_judgment: false
  - id: D2
    description: ".btn, .btn:hover and .btn.primary live in src/styles/utilities.css, the shared names' only home, and no other file defines them"
    requirement: D-02
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts -> G5: the shared names are defined once, and the sweep over the migrated files finds no local definition"
        status: pass
      - kind: other
        ref: "grep -c '\\.btn' src/app.css -> 0; grep -c '\\.btn' src/styles/utilities.css -> 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two phase-8 guards read the new forms: the native-controls rule expects the body TOKEN, and the sticky import region is found through the brace-aware scanner"
    requirement: D-03
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts -> 'native controls get one explicit element-level body size outside the phone block' and 'the list-pane footer is sticky inside the min-width 900px block' -> pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "The list pane is on the token layer, its states nest under their own rules, and it is off the migration allowlist"
    requirement: D-05
    verification:
      - kind: other
        ref: "node /tmp/wg14/offenders.mts src/lib/shell/ListPane.svelte -> no G1, G3, G6a or G6b offender"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/nesting-guard.test.ts -> the compile sweep now compiles ListPane.svelte and reports no css_unused_selector (its `&:focus`, `&:hover`, `&[aria-current='true']` and `&:focus-visible` all match an element)"
        status: pass
      - kind: other
        ref: "grep -c \"src/lib/shell/ListPane.svelte\" tests/helpers/migration.ts -> 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole shell passes every gate: the unit suite, the lint, the type check, the build and the four shell e2e specs"
    requirement: D-03
    verification:
      - kind: unit
        ref: "pnpm run test:unit -> 164 files, 4908 passed, 9 expected fail; pnpm run lint -> exit 0; pnpm run check -> 363 files, 0 errors, 0 warnings; pnpm run build -> exit 0"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/shell/master-detail-nav.spec.ts tests/e2e/shell/mobile-sweep.spec.ts tests/e2e/shell/touch-targets.spec.ts tests/e2e/shell/multi-account.spec.ts -> 26 passed (27.5s), run on port 4174 through a temporary config"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Overview is byte-equal to the baseline outside its masked title box at 1040, 880, 479 and 340px, with equal PNG sizes (D-16 re-check after the phone block was edited)"
    requirement: D-16
    verification:
      - kind: other
        ref: "scratch harness: overview --label after, then compare --strict --mask-title --panes overview -> 1040 BYTE-EQUAL (639x1793 before and after, differing=0, mask h=42), 880 BYTE-EQUAL (800x1739, differing=0, mask h=34), 479 BYTE-EQUAL (447x1959), 340 BYTE-EQUAL (308x2181), 899 BYTE-EQUAL"
        status: pass
    human_judgment: false
  - id: D7
    description: "At 375px every phone-block target computes exactly as before, except the three title sizes plan 14-05 changed"
    requirement: D-12
    verification:
      - kind: other
        ref: "scratch harness: phone --label after, compared with after-14-06-pre/phone-375.json -> 0 differences; compared with the pre-phase before/phone-375.json -> 66 differences, every one a title's font-size (18px -> 26px) or its line-height (23.4px -> 33.8px)"
        status: pass
    human_judgment: false
  - id: D8
    description: "No pane moved: the after-set of every pane at 1280, 900, 899 and 375px is byte-equal to the set plan 14-05 left"
    requirement: D-13
    verification:
      - kind: other
        ref: "scratch harness: the after-set rebuilt from the current build, compared with the 14-05 after-set -> 56/56 pairs BYTE-EQUAL, equal PNG sizes"
        status: pass
    human_judgment: false

# Metrics
duration: 47 min
completed: 2026-10-27
status: complete
---

# Phase 14 Plan 06: app.css on tokens, .btn in the shared utilities and the list pane migrated

**The one stylesheet every pane shares now holds only element resets, the shell layout and the single phone block - every value in it a shared token - the button lives in the shared utilities, and the list pane reads the same token layer as the rest of the shell.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-10-27T07:57:43Z
- **Completed:** 2026-10-27T12:22:00Z
- **Tasks:** 2
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- **`app.css` is tokenised, and it is still the one file with the one phone block.** Every raw value is gone: the page default is `var(--fs-body)` / `var(--lh-body)`, the native-control rule is `var(--fs-body)`, the pane paddings are `--layout-section` / `--layout-page-x` / `--layout-page-bottom` and `--space-16` / `--layout-page-y`, the headings are `--fs-heading` / `--fw-semibold` / `--lh-heading`, and the phone block's chevron, back button and the two tile numerals read `--fs-heading` / `--fs-body` / `--fw-semibold`. The one `margin: -1px` stays, in the rule that declares `clip`. The file still holds no custom property, no role and no utility, and `grep -c "max-width: 480px"` still prints 1.
- **Four rules in `app.css` moved under their own parent, and each one flattens to the selector it had.** The 900px block's import region is `& .import-region` under `.pane-list`; the phone nav's last row is `& > li:last-child`; the phone row's footer is `&.footer`; the phone bar's back button is `& button`. The built CSS proves it: `.pane-list .import-region`, `.shell .pane-list nav>ul>li:last-child`, `.shell .pane-list .row.footer` and `.shell .pane-detail .phone-bar button` are all still there, with the same specificity and (apart from two rules that declare disjoint properties) the same order.
- **`.btn` left `app.css` and is now the shared utilities' block.** Its `&:hover` and `&.primary` are nested under it, so the one definition of the button exists in `src/styles/utilities.css` before the first component reaches for it. No component uses the class today, so the move changed no pixel.
- **The list pane reads the token layer.** The 20px gutter is `--layout-gutter`, the 16px column gap is `--space-16`, and every size, weight and line height is a token. The skip link's focus state and the row's hover, selected and focus-visible states nest under their own rules, and the compiled CSS is unchanged in form: `.row.svelte-1jebk0i:hover`, `.row.svelte-1jebk0i[aria-current=true]`, `.row.svelte-1jebk0i:focus-visible` and `.skip.svelte-1jebk0i:focus` are exactly what the flat rules compiled to.
- **Nothing moved.** The after-set of every pane at 1280, 900, 899 and 375px is byte-equal to the set plan 14-05 left: 56 of 56 pairs BYTE-EQUAL with equal PNG sizes. The Overview element is byte-equal to the pre-phase baseline at 1040, 880, 479 and 340px (equal sizes, 0 differing pixels outside the masked title box), so the D-16 compensation still holds after the phone block was edited. At 375px the phone dump differs from the pre-phase baseline in exactly 66 values, all of them a title's font-size or line-height, which is plan 14-05's change and nothing else.

## Task Commits

Each task was committed atomically:

1. **Task 1: app.css to element resets, layout and the phone block only; .btn to utilities** - `f8561ec` (refactor)
2. **Task 2: ListPane on tokens, and the visual gate for the whole shell** - `65891a2` (refactor)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/app.css` - the element resets, the shell layout and the single phone block, every value on the shared tokens, and the four rules that nest under their own parent.
- `src/styles/utilities.css` - the `.btn` block with its nested hover and primary states, after `.scroller`.
- `src/lib/shell/ListPane.svelte` - the style block on tokens, with the skip link's and the row's states nested under their own rules.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - the native-controls test expects the body token; the sticky import-region test finds its rule through `scanRules`, the flat selectors and the ancestry.
- `tests/helpers/migration.ts` - `src/app.css` and `src/lib/shell/ListPane.svelte` removed from `PENDING_FILES`.

## Decisions Made

- **The two nestings the plan did not name were made anyway, because G6b is a hard gate.** The plan named the import region and the row footer; the sweep also found the phone nav's `> li:last-child` and the phone bar's `button` as rules that extend a sibling. Both are nested under their own parent, which flattens to the same selector, so the plan's own rule - nest where a sibling parent exists - covers them. The plan's list was illustrative, not exhaustive.
- **The list pane's row and chevron stay top-level, and only their own states nest.** The phone block overrides the row at 480px and below, and the phone block's selectors carry three classes; a row nested under another parent selector would outrank it and the outcome would start depending on source order, which the phone block's own comment forbids. The row's `&:hover`, `&[aria-current='true']` and `&:focus-visible]` add no scope class, so each keeps the specificity the flat rule had.
- **The sticky import-region test proves the at-rule through the ancestry, not the parent.** The rule is nested under `.pane-list`, so the `@media (min-width: 900px)` at-rule is two levels up. A reader that asked for the parent would read `.pane-list` and pass vacuously, which is the failure mode the phase-8 reader had before the plan.
- **The `.btn` block's declarations are unchanged and only its padding moved to tokens.** No markup uses the class, so the block is the shared definition rather than a live rule; the smallest possible edit keeps the diff honest.

## Deviations from Plan

None - plan executed exactly as written. The two nestings the plan did not name are covered by the plan's own general rule ("Nest where a sibling parent exists"), and no file, threshold or rule outside the plan's scope changed.

## Issues Encountered

- **The scratch harness caught the Perks pane mid-load, twice.** The harness screenshots as soon as the detail pane carries the pane id, and the Perks pane fills its rows from the worker afterwards, so `1280-perks.png` was written with the pane's "Reading perks..." sentence in place of its content. The first capture of the phone dump had the same problem for the Overview's own duration list and tile summaries. Both are load-timing races in the harness, not regressions: the list pane was byte-equal (0 differing pixels left of x=320) and a re-run of the phone dump came back with 0 differences against plan 14-05's dump. The Perks capture was re-taken with a small scratch script that waits for the loading sentence to go; the scratch script and the PNGs stay in the scratch directory and are not committed.
- **The after-set had to be rebuilt, not refreshed.** The harness's `shots` and `overview` subcommands SKIP a file that already exists, so the set plan 14-05 left would have made every compare pass vacuously. The old set was MOVED ASIDE (`after-14-06-pre`) and the harness wrote a fresh one; nothing was destroyed, and the 14-05 set is still there - it is the reference this plan's "nothing moved" claim is measured against.
- **Port 4173 was free after all.** The note that a stale `vite preview` held it was out of date: the port answered with nothing when this plan started. A preview was started on 4173 for the harness, and the four shell e2e specs ran on 4174 through a temporary Playwright config, because `reuseExistingServer: false` refuses to start against a port that is already taken. The temporary config was deleted after the run and was never committed.

## Known Stubs

None. Every file the plan names exists with a body: the tokenised `app.css`, the `.btn` block in the shared utilities, the tokenised and nested list pane, the two rewritten phase-8 guards, and the shrunken allowlist.

## Requirements

D-01, D-02, D-03, D-05, D-13, D-15 and D-16 are listed in the plan's frontmatter. `REQUIREMENTS.md` carries no `D-*` ids at all - the phase-14 `D-xx` ids are the design-decision ids from `14-CONTEXT.md`, and the file's own requirement list (ACCOUNT-*, INSIGHT-*, PRIV-*, SCALE-*) is unaffected by this plan. No requirement checkbox was changed, and none needed to be.

**Open item carried forward (not this plan's to close).** `app.css` keeps the shell layout and the single phone block next to the element resets, which departs from D-02 as written (D-02 says `app.css` keeps only the element resets). That departure is UI-SPEC OI-11: it keeps the phase-8 guard that reads the phone block stable, and it is NOT yet owner-confirmed. Plan 14-21 lists it as an open item for the owner, whose decision is either to confirm it or to direct a follow-up that moves the layout and the phone block into `src/styles/` and repoints the guard.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 14-07 can start on a clean shell: `app.css` is the element resets, the layout and the one phone block, all on tokens; the shared utilities hold the one definition of every shared name; and the list pane is off the allowlist.
- Every later pane plan can assume the shell is tokenised: a pane that needs a button takes the shared `.btn`, and a pane that needs a scroll region takes the shared `.scroller` plus its own hook.
- The D-16 gate still holds after the phone block was edited, so plans 14-19, 14-20 and 14-21 can re-run it as the phase's pixel proof.
- The tree state today: 52 files pending, the scale and the floor are one, the title is one role, and the stylesheet every pane shares holds no raw value.
- The scratch after-set is current for this build. A later plan that changes anything visible must rebuild it the same way (move the old directory aside, then `shots` and `overview`), because the harness skips existing files.

## Self-Check: PASSED

- Every file the plan declares exists on disk and is committed: `src/app.css`, `src/styles/utilities.css`, `src/lib/shell/ListPane.svelte`, `tests/unit/guards/phase8-ui-review-guards.test.ts` and `tests/helpers/migration.ts` (all modified). The working tree holds no uncommitted change to the plan's files.
- Every task commit is an ancestor of HEAD: `f8561ec` (Task 1) and `65891a2` (Task 2) - 2 commits, 2 tasks, measured from `4b3ddf1` with `git rev-list --count`.
- Every acceptance criterion was run by hand: `grep -c "\.btn" src/app.css` prints 0 (at HEAD: 3) and `grep -c "\.btn" src/styles/utilities.css` prints 1 (at HEAD: 0); `! grep -nE "^\s*--[a-z]" src/app.css` exits 0; `grep -c "max-width: 480px" src/app.css` prints 1; `pnpm exec vitest run tests/unit/guards tests/unit/shell` exits 0 (33 files, 1185 passed) with `src/app.css` and `src/lib/shell/ListPane.svelte` out of `PENDING_FILES`; the four shell e2e specs pass (26 passed).
- The plan-level verification was re-run end to end after the last code commit: `pnpm run test:unit` exits 0 (164 files, 4908 passed, 9 expected fail), `pnpm run lint` exits 0, `pnpm run check` exits 0 (363 files, 0 errors, 0 warnings), `pnpm run build` exits 0, and `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` passes 8 of 8 (273 e2e tests listed, no new one).

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
