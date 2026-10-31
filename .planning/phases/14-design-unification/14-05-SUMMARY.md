---
phase: 14-design-unification
plan: 05
subsystem: ui
tags: [css, svelte, tokens, type-scale, title-role, d16, pixel-gate]

# Dependency graph
requires:
  - phase: 14-design-unification (plan 14-01)
    provides: "the shared token, role and utility stylesheets, and the scratch screenshot harness with its before/after sets"
  - phase: 14-design-unification (plan 14-03)
    provides: "the pure offender functions and the shrinking PENDING_FILES allowlist a migrated file leaves"
  - phase: 14-design-unification (plan 14-04)
    provides: "the nesting compile sweep, the one type scale and the one 12px floor every migrated file now answers to"
provides:
  - "the title role on every pane title, the identity titles and the phone bar's title (D-12)"
  - "the D-16 compensation on the Overview title: margin 0 0 calc((var(--fs-display) - var(--fs-title)) * var(--lh-heading))"
  - "the identity header migrated to the shared tokens, with the row name on the Heading role and the caption on a hook class"
  - "tests/unit/shell/overview-title.test.ts: the role adoption and the compensation arithmetic, read from the token file"
affects: [14-06, 14-07, 14-08, 14-09, 14-10, 14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 14-18, 14-19, 14-20, 14-21]

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 8050
  tasks: 2
  commits: 3
plan_head_before: 60a91669bf0006f72a99ccd727c3a257204b1b8a
plan_head_after: b358cd2403eb05924584d87433389430dc167e48

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A role is applied only because the local rule DELETED its size: the phone block's overrides had specificity (0,3,0) and beat the role of (0,1,0), so they were deleted rather than restated"
    - "The compensation is a MARGIN and nothing else: a title with its own line height, height or overflow stops following the role it takes"
    - "The compensation is written from the tokens, so it follows them: 0 below 900px, where --fs-title IS --fs-display"
    - "A shared utility block keeps its own name and takes a HOOK class for the difference, so a local copy of the shared block can never shadow it"

key-files:
  created:
    - "tests/unit/shell/overview-title.test.ts"
  modified:
    - "src/lib/shell/DashboardSection.svelte"
    - "src/lib/shell/Overview.svelte"
    - "src/lib/shell/DetailPane.svelte"
    - "src/lib/shell/IdentityHeader.svelte"
    - "src/app.css"
    - "tests/unit/shell/identity-model.test.ts"
    - "tests/helpers/migration.ts"

key-decisions:
  - "The Overview title's compensation is a negative BOTTOM margin, and only the Overview carries it: the owner's D-16 scopes the compensation to the Overview alone, so the other panes' title rows grow by about 8px as the Allowed Visible Changes list allows"
  - "The compensation is computed from the token file, not hard-coded: the unit test reads --fs-display, --fs-stat and --lh-heading and computes -7.8px, so a token that moves breaks the test rather than the page"
  - "The identity header's four titles take the role and the row name takes the Heading role; the ID-only demotion stays as TOKEN declarations on the shared .account-id rule, because a rule that only stated the size would leave the weight and the line height to the role"
  - "The identity caption keeps the shared .caption and takes an .identity-caption hook whose single declaration is the weight: a local copy of .caption would shadow the shared one and could drift from it"
  - "The identity header's phone-block override was DELETED, not restated: an override of specificity (0,3,0) beats the role of (0,1,0), and restating it would have kept two answers to 'how big is a title'"
  - "The scratch harness's after-set was rebuilt from scratch rather than refreshed in place, because both the `shots` and the `overview` subcommands SKIP a file that already exists - a stale after-set would have made every later compare pass vacuously"

patterns-established:
  - "Pattern: the deleted override - where a shared role is beaten by a higher-specificity rule, the rule is deleted and the fact is pinned by a test that names the file the rule used to live in"
  - "Pattern: the computed compensation - a layout correction that must equal a difference is written from the tokens and asserted by a test that computes the difference from the same tokens"
  - "Pattern: the hook class - a shared utility block takes a local class that states ONLY the difference, and the shared block's local copy is deleted"

requirements-completed: [D-01, D-02, D-03, D-05, D-07, D-12, D-13, D-15, D-16]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Every pane title, the identity titles and the phone bar's title carry the one title role, and the phone block's overrides that would have beaten it are deleted"
    requirement: D-12
    verification:
      - kind: unit
        ref: "tests/unit/shell/overview-title.test.ts -> the pane title role (14-05, D-12) -> 5 tests pass"
        status: pass
      - kind: other
        ref: "grep -c 't-title' src/lib/shell/DashboardSection.svelte src/lib/shell/Overview.svelte src/lib/shell/DetailPane.svelte -> 1, 1, 1 (at HEAD: 0, 0, 0); awk '/phone-title/,/}/' src/app.css | grep -c 'font-size' -> 0 (at HEAD: 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Overview title compensates its line box: -7.8px at 900px and up, 0 below, so the title row stays 33.8px and nothing below it moves (D-16)"
    requirement: D-16
    verification:
      - kind: unit
        ref: "tests/unit/shell/overview-title.test.ts -> the Overview title compensates its line box (14-05, D-16) -> 4 tests pass"
        status: pass
      - kind: other
        ref: "grep -cF 'calc((var(--fs-display) - var(--fs-title)) * var(--lh-heading))' src/lib/shell/Overview.svelte -> 1 (at HEAD: 0); grep -c 'calc((var(--fs-display)' src/lib/shell/DashboardSection.svelte -> 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Overview is byte-equal to the baseline outside its own title box at 1040, 880, 479 and 340px, with equal PNG sizes"
    requirement: D-15
    verification:
      - kind: other
        ref: "scratch harness: overview --label after, then compare --panes overview --strict --mask-title -> 1040 BYTE-EQUAL (639x1793 before and after, differing=0, mask h=42), 880 BYTE-EQUAL (800x1739, differing=0), 479 BYTE-EQUAL (447x1959), 340 BYTE-EQUAL (308x2181), 899 BYTE-EQUAL"
        status: pass
      - kind: other
        ref: "the same compare WITHOUT the mask at 1040 -> differing=1922, all of it inside the title's own box (x=0..137, y=6..33): the title's glyphs and nothing else"
        status: pass
    human_judgment: false
  - id: D4
    description: "At 375px the phone-block targets compute exactly as before, except the three title sizes"
    requirement: D-12
    verification:
      - kind: other
        ref: "scratch harness: phone --label after, compared with before/phone-375.json -> 66 differences, every one of them a title's font-size (18px -> 26px) or its line-height (23.4px -> 33.8px); no margin, padding, display or weight changed"
        status: pass
    human_judgment: false
  - id: D5
    description: "The identity titles take the title role, the named row name takes the Heading role, and the ID-only row is still demoted to the 14px muted line"
    requirement: D-07
    verification:
      - kind: unit
        ref: "tests/unit/shell/identity-model.test.ts -> the identity titles follow the shared title role, not a phone override + the row name takes the heading role, and an ID-only row is still demoted -> 2 tests pass"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/shell/master-detail-nav.spec.ts -> 17 passed (the ID-only name 14px/600/muted, the named row name 18px/600/ink)"
        status: pass
    human_judgment: false
  - id: D6
    description: "DashboardSection, Overview, DetailPane and IdentityHeader read the shared tokens, nest what they extend and are off the migration allowlist"
    requirement: D-05
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards tests/unit/overview/overview-main-thread-guard.test.ts tests/unit/shell/overview-title.test.ts -> 24 files, 451 passed, and the PENDING_FILES stale-entry check names none of the four"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/shell/identity-model.test.ts tests/unit/guards -> 23 files, 504 passed (the nesting compile sweep now compiles IdentityHeader.svelte and finds no dead selector)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The plan's own verification block is green end to end: unit, lint, type-check and build"
    requirement: D-03
    verification:
      - kind: other
        ref: "pnpm run test:unit -> 164 files, 4908 passed, 9 expected fail; pnpm run lint -> exit 0; pnpm run check -> 363 files, 0 errors, 0 warnings; pnpm run build -> exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 32 min
completed: 2026-10-27
status: complete
---

# Phase 14 Plan 05: The title role, the Overview's line-box compensation and the identity header

**Every pane title, the identity titles and the phone bar's title now carry one role (`.t-title`), the Overview's title compensates the 7.8px its taller line box adds so that nothing below it moves (D-16), and the identity header reads the shared tokens instead of its own copies.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-10-27T06:51:34Z
- **Completed:** 2026-10-27T07:23:02Z
- **Tasks:** 2
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- **One title role, and the overrides that would have beaten it are GONE.** The pane title (`DashboardSection`, `Overview`), the identity titles and the phone bar's title all carry `.t-title`. The trap the research named is real and it was handled the only way it can be: the phone block's rules had specificity (0,3,0) and the role has (0,1,0), so those declarations were **deleted**, not restated - the identity header's `font-size: 18px` rule is gone entirely, the section titles' hide rule keeps every clip declaration and loses only its `font-size`, and the phone bar's rule keeps its layout and loses its size, weight and line height. The heading stays in the accessibility tree: `clip: rect(0 0 0 0)` is still there.
- **The Overview's line box is compensated, and the compensation is pinned by arithmetic rather than by a comment.** The Overview title is 32px at 900px and up like every other pane title, so its 1.3 line box is 41.6px - 7.8px taller than the 26px x 1.3 row the Overview had. The bottom margin `calc((var(--fs-display) - var(--fs-title)) * var(--lh-heading))` is exactly that difference, so the title's outer height stays 33.8px and the flex column puts every tile where it is today. It is written from the tokens, so it is 0 below 900px where `--fs-title` IS `--fs-display`, and the unit test computes -7.8px from `tokens.css` rather than asserting a literal, so a token that moves breaks the test and not the page.
- **The Overview is byte-equal to the baseline, with equal sizes.** The pixel gate at the four widths the plan names: 1040 (639x1793 before and after, 0 differing pixels outside the masked title box), 880 (800x1739, 0), 479 (447x1959, 0) and 340 (308x2181, 0) - and 899 as well. Unmasked at 1040 the only difference is 1922 pixels inside the title's own box (x 0..137, y 6..33), which is the 32px glyphs and nothing else: no tile moved and no tile changed size.
- **At 375px the phone block computes exactly as before, except the three title sizes.** The phone dump (the harness's `phone` subcommand, before and after) differs in 66 values and every one of them is a title's `font-size` (18px -> 26px) or its `line-height` (23.4px -> 33.8px). No margin, padding, display or weight moved. Those are OI-1, OI-2 and OI-3, and they are the only differences.
- **The identity header joined the token layer and kept its demotion.** The four identity titles take `.t-title`, the named row's name takes `.t-heading` (18px, unchanged), and the ID-only row keeps its 14px muted line - because that rule still declares the size, the weight and the line height as tokens, so it outranks the role on specificity. The caption keeps the shared `.caption` and takes an `.identity-caption` hook whose single declaration is the weight; the local `.caption` copy is gone, so the shared block can no longer be shadowed.
- **The four shell files are token-based, nested and off the allowlist.** `DashboardSection.svelte`, `Overview.svelte` and `IdentityHeader.svelte` left `PENDING_FILES` in the same commit that migrated them, so the stale-entry check cannot rot. The nesting compile sweep now compiles all of them and finds no dead selector.

## Task Commits

Each task was committed atomically, in the RED -> GREEN order for the TDD task:

1. **Task 1: The title role on the pane titles and the phone detail-bar title** - `de3bbd6` (test, RED), `ae7f14c` (feat, GREEN)
2. **Task 2: The identity header - title role, row-name heading role, caption variant** - `b358cd2` (feat)

**Plan metadata:** (this commit)

_Note: Task 1 carries `tdd="true"`, so it produced the RED -> GREEN commits. The RED commit landed `tests/unit/shell/overview-title.test.ts` with its assertions in place and the shell files unmigrated; the GREEN commit applied the role, the compensation and the token migration._

## Files Created/Modified

- `tests/unit/shell/overview-title.test.ts` - the new guard: the role adoption on the three title sites, the compensation's exact expression, the arithmetic computed from `tokens.css` (-7.8px, 41.6px, 33.8px) and the absence of a compensation on the other panes.
- `src/lib/shell/Overview.svelte` - the title role on the heading and the D-16 margin, with the arithmetic written out in the rule's comment.
- `src/lib/shell/DashboardSection.svelte` - the title role on the heading; every size, weight, line height and spacing value moved to the shared tokens.
- `src/lib/shell/DetailPane.svelte` - the title role on the phone bar's title.
- `src/lib/shell/IdentityHeader.svelte` - the title role on the four headings, the Heading role on the row name, the caption hook class, and the whole block on the shared tokens.
- `src/app.css` - the title overrides deleted (the identity rule entirely, the section titles' `font-size`, the phone title's size, weight and line height); every clip declaration kept.
- `tests/unit/shell/identity-model.test.ts` - the test that guarded the old phone override now guards the token switch, and a second test guards the row name's role and the ID-only demotion.
- `tests/helpers/migration.ts` - `DashboardSection.svelte`, `Overview.svelte` and `IdentityHeader.svelte` removed from `PENDING_FILES`.

## Decisions Made

- **Only the Overview compensates.** D-16 is the owner's decision and it names one pane: "the Overview title compensates its line box ... The other panes' title rows may grow by about 8px on desktop; only the Overview compensates." So the identity header's title grew to 32px with nothing under it to compensate, and no compensation was invented for it here.
- **The compensation is a margin and nothing else.** The unit test asserts that the Overview's `.section-title` rule declares no `line-height`, no `height` and no `overflow`: a title with its own line box stops following the role, and the whole point of the role is that it does not.
- **The arithmetic is read from the token file, not asserted as a literal.** The test resolves `--fs-display`, `--fs-stat` and `--lh-heading` out of `tokens.css` and computes the margin and the row height from them, so the pin is on the RELATIONSHIP the page depends on rather than on the numbers that happen to hold it today.
- **The ID-only demotion stays as token declarations.** The plan asked for it explicitly and it is the only way the demotion survives the role: a rule that stated only the size would leave the weight and the line height to `.t-heading`.
- **The caption keeps the shared block and takes a hook.** The local `.caption` rule was deleted and the two paragraphs carry `class="caption identity-caption"`, whose hook states only the weight. A local copy of a shared block shadows it silently, and the shared block is the one that is meant to be the single answer.

## Deviations from Plan

None - plan executed exactly as written. The one judgement call (the scratch after-set, below) changed no file, no rule and no threshold in the repository.

## Issues Encountered

- **The scratch after-set was stale, and the harness cannot refresh it in place.** Both the `shots` and the `overview` subcommands SKIP a file that already exists, so the after-set captured on 2026-10-26 (before this plan) would have been compared against the baseline and would have passed VACUOUSLY - the opposite of what a pixel gate is for. Refreshing it meant emptying the directory; a broad `rm` of the scratch set was refused by the sandbox, so the old directory was MOVED ASIDE (`after-stale-14-03`, `after-14-05-task1`) and the harness wrote a fresh one. Nothing was destroyed and the stale sets are still there to compare.
- **The page-level captures carry a date the baseline cannot match.** The list pane's import line reads the wall clock ("Imported on Oct 26" in the baseline set, "Imported on Oct 27" now), so the full-page captures can never be byte-equal across days. That is why the gate is the OVERVIEW ELEMENT (which does not contain the import line) and not the page. The Overview element is byte-equal at every width the plan names.
- **The identity title's growth moves the list pane's rows 1px at 900px and up.** The identity header sits above the pane rows inside the list pane, so a title that grew 7.8px moves the rows below it; the browser's scroll anchoring absorbs most of it and 1px of the residue is visible. This is the direct consequence of OI-3 (the identity titles: 26px -> 32px at 900px and up) and NOT a defect in the compensation: D-16 freezes the OVERVIEW, and the Overview is byte-equal. It is recorded here because it is the one visible difference outside the title's own box in the whole plan, and the owner's UAT is where it belongs.
- **The scratch harness's phone target for the identity title matches nothing.** `PHONE_TARGETS` asks for `.identity-title`, but the markup has no such class (the test ids are `identity-title`), so the identity title is not in the phone dump. The dump therefore covers the three shell titles only, and the identity title's own 18px -> 26px change at 375px is covered by the e2e instead. The harness is scratch and no repository file is affected.

## Known Stubs

None. Every file the plan names exists with a body: the title role on all seven title sites, the compensation rule, the identity hook class, the rewritten identity test and the new overview-title guard.

## Requirements

D-01, D-02, D-03, D-05, D-07, D-12, D-13, D-15 and D-16 are listed in the plan's frontmatter. `REQUIREMENTS.md` carries no `D-*` ids at all - the phase-14 `D-xx` ids are the design-decision ids from `14-CONTEXT.md`, and the file's own requirement list (ACCOUNT-*, INSIGHT-*, PRIV-*, SCALE-*) is unaffected by this plan. No requirement checkbox was changed, and none needed to be.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 14-06 can start on `app.css` with the phone block in a known state: the four title overrides are gone, the section-title hide rule keeps its clip declarations, and the one phone block still holds exactly one `max-width: 480px` query.
- Every later pane plan can assume the title is DONE: a pane that adopts `DashboardSection` inherits `.t-title` for free, and the Overview's compensation is already in place behind a unit test and a byte-equal pixel gate.
- The tree state today: 54 files pending, the scale and the floor are one, the title is one role, and the four shell files that carry the app's chrome are on the shared tokens.
- The scratch after-set is current for this build. A later plan that changes anything visible must rebuild it the same way (move the old directory aside, then `shots` and `overview`), because the harness skips existing files.

## Self-Check: PASSED

- Every file the plan declares exists on disk and is committed: `tests/unit/shell/overview-title.test.ts` (created), `src/lib/shell/DashboardSection.svelte`, `src/lib/shell/Overview.svelte`, `src/lib/shell/DetailPane.svelte`, `src/lib/shell/IdentityHeader.svelte`, `src/app.css`, `tests/unit/shell/identity-model.test.ts` and `tests/helpers/migration.ts` (modified).
- Every task commit is an ancestor of HEAD: `de3bbd6` (test/RED), `ae7f14c` (feat/GREEN), `b358cd2` (feat) - 3 commits, 2 tasks. The working tree holds no uncommitted change to the plan's files.
- Every acceptance criterion was run by hand: the three `grep -c 't-title'` counts print 1, 1, 1 (at HEAD: 0, 0, 0); `awk '/phone-title/,/}/' src/app.css | grep -c 'font-size'` prints 0 (at HEAD: 1); `grep -n "clip: rect" src/app.css` still lists the hide rule; the compensation `grep -cF` prints 1 in `Overview.svelte` and 0 in `DashboardSection.svelte`; the Overview's `.section-title` body has no `line-height`, `height` or `overflow`; `grep -c 't-title' src/lib/shell/IdentityHeader.svelte` prints 4 and `grep -c 't-heading'` prints 2; `grep -c "identity-header'\] .nickname" src/app.css` prints 0; the four shell files are out of `PENDING_FILES`.
- The plan-level verification was re-run end to end after the last code commit: `pnpm run test:unit` exits 0 (164 files, 4908 passed, 9 expected fail), `pnpm run lint` exits 0, `pnpm run check` exits 0 (363 files, 0 errors, 0 warnings), `pnpm run build` exits 0, and `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/shell/master-detail-nav.spec.ts` passes 17 of 17.

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
