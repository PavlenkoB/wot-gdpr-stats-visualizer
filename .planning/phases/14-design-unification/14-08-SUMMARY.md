---
phase: 14-design-unification
plan: 08
subsystem: ui
tags: [css, tokens, shared-utility, nesting, migration, pixel-gate]

# Dependency graph
requires:
  - phase: 14-design-unification (plan 14-01)
    provides: "the shared token, role and utility stylesheets and the scratch screenshot harness with its before/after sets"
  - phase: 14-design-unification (plan 14-03)
    provides: "the pure offender functions and the shrinking PENDING_FILES allowlist a migrated file leaves"
  - phase: 14-design-unification (plan 14-07)
    provides: "App.svelte, the import bar and the four status surfaces on the token layer, and the current after-set the pixel gate measures against"
provides:
  - "src/lib/shell/Dashboard.svelte, Dropzone.svelte, GameFilter.svelte, AccountTag.svelte and UnsupportedBlock.svelte on the token layer: type, spacing and radius tokens, with no raw px value and no local shared-class copy"
  - "the shared .visually-hidden in src/styles/utilities.css now serves the game filter's radios and the account tag's phrase: both local copies are deleted"
  - "the dropzone's four states and the game filter's three chip states nested under the rule they extend"
  - "the shell group CLOSED: every file under src/lib/shell/ and src/App.svelte is off PENDING_FILES"
affects: [14-09, 14-10, 14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 14-18, 14-19, 14-20, 14-21]

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 3669
  tasks: 1
  commits: 1
plan_head_before: 733414cf44501e69ae40a238611e60e7f41a9d75
plan_head_after: 162bcbee16ebc6763071437a8f246f521185c4b5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A shared utility is used by DELETING the local copy: the two clip blocks in GameFilter and AccountTag stated the same eight declarations as `src/styles/utilities.css`, so the local copies went and the global class takes over with an unchanged computed style"
    - "Nesting a rule's OWN state under it flattens to the same compound selector, so the specificity and the source order survive the move: `&:has(input:checked)` under `.chip` is the compound the flat rule had, and the selected chip's own hover nests under the selected rule because it extends THAT rule"

key-files:
  created: []
  modified:
    - "src/lib/shell/Dashboard.svelte"
    - "src/lib/shell/Dropzone.svelte"
    - "src/lib/shell/GameFilter.svelte"
    - "src/lib/shell/AccountTag.svelte"
    - "src/lib/shell/UnsupportedBlock.svelte"
    - "tests/helpers/migration.ts"

key-decisions:
  - "The two local .visually-hidden copies are DELETED, not kept as variants: the shared utility states the identical clip block, so the scoped copy could only ever drift away from the global one, and the markup already carries the class name"
  - "The chip's selected hover nests under the SELECTED rule rather than beside it: `&:has(input:checked):hover` extends `&:has(input:checked)`, which the G6b guard forbids as a flat pair, and nesting it there flattens to the same compound the flat rule had"
  - "The nested states keep their source order inside the parent block, so the compact dropzone still precedes the highlight and the disabled states and the plain chip hover still precedes the selected one"
  - "Descendant element rules stay TOP-LEVEL, exactly as plan 14-07's ConfirmPanel did with `.confirm-message` and `.confirm-actions`: only a rule that extends a sibling nests under it, which is what the D-05 guard enforces"
  - "The account tag's 18px line box stays a px value: no line-height token equals 18px, and the guard allows a px line height"

patterns-established:
  - "Pattern: the shared-utility deletion - a local copy of a shared class is deleted, and the shared block's declarations are the proof that the computed style did not move"

requirements-completed: [D-01, D-02, D-03, D-04, D-05]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The five shell files are token-based: no raw font size, no raw spacing value and no 6px radius survives in any of them, and all five leave PENDING_FILES"
    requirement: D-01
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts -> G1, G3, G4, G5, G6a and G6b sweeps over the migrated files: every one of the five is now in the sweep and every one is clean"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts -> 'no pending file is clean: every one of them still has something to migrate' passes, and 'the PENDING_FILES allowlist' names only files that exist"
        status: pass
      - kind: other
        ref: "grep -c 'src/lib/shell/' tests/helpers/migration.ts -> 0 (at HEAD: 5); grep -nE '[0-9]+px' over the five files -> only min-height, width, height, border-width, min-width, the 44px touch floor, the 18px line box and the clip blocks' -1px"
        status: pass
    human_judgment: false
  - id: D2
    description: "GameFilter and AccountTag use the shared .visually-hidden; their local copies are deleted and the markup class is unchanged"
    requirement: D-02
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts -> G5 shared names: no migrated file defines .visually-hidden, and the sweep finds no local definition of it in GameFilter or AccountTag"
        status: pass
      - kind: other
        ref: "grep -c 'visually-hidden' src/lib/shell/GameFilter.svelte -> 3 (the two markup classes and the doc comment; at HEAD: 5); grep -c 'visually-hidden' src/lib/shell/AccountTag.svelte -> 2 (the markup class and the doc comment; at HEAD: 3)"
        status: pass
      - kind: other
        ref: "the browser measurement against the pre-phase baseline: the radio's computed position/width/height/clip/overflow/margin/white-space/border and the account tag's phrase are the same eight declarations as before"
        status: pass
    human_judgment: false
  - id: D3
    description: "The dropzone's four states and the game filter's chip states nest under the rule they extend, and the migrated components compile without an unused selector"
    requirement: D-05
    verification:
      - kind: unit
        ref: "tests/unit/guards/nesting-guard.test.ts -> the compile sweep now compiles Dashboard.svelte, Dropzone.svelte, GameFilter.svelte, AccountTag.svelte and UnsupportedBlock.svelte and reports no css_unused_selector and no compile error"
        status: pass
      - kind: other
        ref: "the compiled CSS of GameFilter.svelte: `.chip.svelte-x:has(input:where(.svelte-x):checked)` and `.chip.svelte-x:has(input:where(.svelte-x):checked):hover` - the same compounds the flat rules had"
        status: pass
      - kind: other
        ref: "the browser measurement: a checked chip keeps --sel under the pointer (rgb(224,224,224) resting and hovered) and an unchecked chip takes --hover (rgb(255,255,255) to rgb(236,236,236)), which is what the flat rules did"
        status: pass
    human_judgment: false
  - id: D4
    description: "The shell renders pixel-identically to plan 14-07's output"
    requirement: D-13
    verification:
      - kind: other
        ref: "scratch harness: the after-set rebuilt from the current build and compared with the 14-07 after-set -> 56/56 pairs BYTE-EQUAL, at 1280, 900, 899 and 375px over every pane and the Overview element"
        status: pass
      - kind: other
        ref: "scratch harness: the phone dump at 375px compared with the 14-07 dump -> identical, entry for entry"
        status: pass
      - kind: other
        ref: "scratch: the empty state (the drop target, the prompt and the privacy sentence) captured at 1280 and 375px before and after the migration -> BYTE-EQUAL at both widths, and the computed geometry of every piece is unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole shell passes every gate: the unit suite, the lint, the type check, the build and the named e2e specs"
    requirement: D-03
    verification:
      - kind: unit
        ref: "pnpm run test:unit -> 164 files, 4908 passed, 9 expected fail; pnpm run lint -> exit 0; pnpm run check -> 363 files, 0 errors, 0 warnings; pnpm run build -> exit 0"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/shell/dashboard.spec.ts tests/e2e/shell/touch-targets.spec.ts tests/e2e/shell/mobile-sweep.spec.ts tests/e2e/import/import-flow.spec.ts -> 57 passed. The run went through a temporary Playwright config on port 4174, because a stale preview holds 4173; the temporary file was deleted and never committed"
        status: pass
    human_judgment: false

# Metrics
duration: 30 min
completed: 2026-10-27
status: complete
---

# Phase 14 Plan 08: the shell pieces finish the token layer

**The empty-state dashboard, the dropzone and the three small shared pieces read the shared type, spacing and radius tokens, the two local `.visually-hidden` copies give way to the shared utility, and not one pixel moved.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-10-27T10:45:00Z
- **Completed:** 2026-10-27T11:15:00Z
- **Tasks:** 1
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments

- **The five shell files are token-based.** The empty state's 16px gap is `var(--space-16)`; the privacy sentence's 14px/1.5 is `var(--fs-body)`/`var(--lh-body)`; the dropzone's 20px padding is `var(--layout-gutter)` and its 8px/12px compact padding is the space scale; the account tag's 6px radius is `var(--radius-sm)`; and the unsupported block's banner padding, gap and radius are the shared values. Every raw font size, weight and line height in the five files is a token now, and the only px left is a measurement: a height, a width, a border, the 44px touch floor and the account tag's fixed 18px line box.
- **The two local `.visually-hidden` copies are gone.** GameFilter's radios and AccountTag's phrase now take the shared utility in `src/styles/utilities.css`, which states the same eight declarations the two local blocks carried. The markup class name is unchanged, so the computed style is unchanged - and a scoped copy can no longer drift away from the global one.
- **The states nest under the rule they extend.** The dropzone's compact, focus-within, highlighted and disabled rules and the game filter's hover, selected and focus-visible rules are nested under their block, and the nested rules keep their source order inside it: the compact dropzone still precedes the drag highlight, and the plain chip hover still precedes the selected rule. The selected chip's own hover nests under the SELECTED rule, because it extends that rule and not the chip.
- **The shell group is closed.** The five files leave `PENDING_FILES`, so with plans 14-05 to 14-07 every file under `src/lib/shell/` and `src/App.svelte` is on the token layer.
- **Not one pixel moved.** The after-set of every pane at 1280, 900, 899 and 375px is byte-equal to the set plan 14-07 left: 56 of 56 pairs BYTE-EQUAL. The phone dump at 375px is identical entry for entry. The empty state - the drop target, the prompt and the privacy sentence - is byte-equal at 1280 and at 375px, and the game filter's five chips and the account tag measure identically against the pre-phase baseline, resting and hovered.

## Task Commits

Each task was committed atomically:

1. **Task 1: The remaining shell pieces - Dashboard, Dropzone, GameFilter, AccountTag, UnsupportedBlock** - `162bcbe` (refactor)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/lib/shell/Dashboard.svelte` - the empty state's gap and the privacy sentence on tokens; the `.chart-status` clip block untouched, because the tooltip-pin test asserts it by name.
- `src/lib/shell/Dropzone.svelte` - the padding, the type and the four states on tokens, with the states nested under `.dropzone`; the file input's clip block stays local.
- `src/lib/shell/GameFilter.svelte` - the gaps, the type and the chip states on tokens, with the states nested under `.chip`; the local `.visually-hidden` deleted.
- `src/lib/shell/AccountTag.svelte` - the padding, the type and the 6px radius on tokens; the local `.visually-hidden` deleted.
- `src/lib/shell/UnsupportedBlock.svelte` - the intro, the banner list, the banner and its two text spans on tokens.
- `tests/helpers/migration.ts` - the five files leave `PENDING_FILES`.

## Decisions Made

- **The local `.visually-hidden` copies are deleted, not kept as variants.** The shared utility states the identical clip block, so a local copy could only ever be a second answer to a question the project already answers in one place - and a scoped selector outranks the global one, so the two would drift without anybody noticing. The markup already carries the class name, so nothing in the markup changed.
- **The selected chip's hover nests under the SELECTED rule.** `&:has(input:checked):hover` extends `&:has(input:checked)`, and the D-05 guard forbids that flat pair. Nesting it under the selected rule flattens to the same compound selector the flat rule had, and the specificity is unchanged: the plain `:hover` still outranks the selected rule, which is exactly why the override exists.
- **The nested states keep their order inside the parent block.** The compact dropzone precedes the drag highlight and the disabled state, and the plain chip hover precedes the selected rule, because the order decides which of two equally specific rules wins.
- **Descendant element rules stay top-level.** The plan's phrase "nested where a parent rule exists" is the D-05 rule the guard enforces - a rule that EXTENDS a sibling nests under it - and plan 14-07's `ConfirmPanel` is the precedent: its `.confirm-message` and `.confirm-actions` are children of the panel and stayed top-level. `UnsupportedBlock`'s banners have no state rule and no extending sibling, so nothing there nests.
- **The account tag keeps its 18px line box.** No line-height token equals 18px, and the guard allows a px line height; the chip's fixed line box is what keeps it from making a 40px row taller.

## Deviations from Plan

None - the plan executed exactly as written. The nesting the G6b guard found in GameFilter's chip states (the plan's bullet did not name it) is covered by the plan's own general rule, and no file, threshold or rule outside the plan's scope changed.

## Issues Encountered

- **A stale `vite preview` holds port 4173**, so `pnpm exec playwright test` refuses to start ("http://localhost:4173 is already used"). The e2e run went through a temporary Playwright config in the repo root that overrode `use.baseURL` and `webServer` to port 4174. The temporary file was deleted after the run and was never committed; `playwright.config.ts` itself was not touched.
- **The baseline worktree's own `vite preview` cannot start.** Its `node_modules` is stale (a missing `rolldown/parseAst` module), so the pre-phase baseline was served on port 4174 with `python3 -m http.server` over its committed `dist/` instead. That server was stopped again before the Playwright run needed the port.
- **The after-set had to be rebuilt, not refreshed.** The harness's `shots`, `overview` and `phone` subcommands skip a file that already exists, so the set plan 14-07 left would have made every compare pass vacuously. The old set was MOVED ASIDE (`after-14-08-pre`) and the harness wrote a fresh one; nothing was destroyed, and the old set is the reference this plan's "not one pixel moved" claim is measured against.
- **The knowledge graph was NOT refreshed.** `AGENTS.md` asks for `graphify update .` after a code change, but the phase playbook assigns the graph refresh to plan 14-21 (R18), once, after the last code edit: a prior executor's run produced a ~98 000-line diff of graphify-side relabelling and was reverted. The graph is exactly as current as it was when this plan started, and the phase still owns the refresh.

## Known Stubs

None. Every file the plan names exists with a body: the five tokenised components and the shrunken migration allowlist.

## Requirements

D-01, D-02, D-03, D-04 and D-05 are listed in the plan's frontmatter. `REQUIREMENTS.md` carries no `D-*` ids at all - the phase-14 `D-xx` ids are the design-decision ids from `14-CONTEXT.md`, and the file's own requirement list (ACCOUNT-*, INSIGHT-*, PRIV-*, SCALE-*) is unaffected by this plan. No requirement checkbox was changed, and none needed to be.

**Open item carried forward (not this plan's to close).** `app.css` keeps the shell layout and the single phone block next to the element resets, which departs from D-02 as written (UI-SPEC OI-11). It is NOT yet owner-confirmed, and plan 14-21 carries it for the owner.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The shell group is closed.** Every file under `src/lib/shell/` and `src/App.svelte` is on the token layer, and `PENDING_FILES` holds 41 files, none of them in the shell.
- **Plan 14-09 (the heat scale) can start clean**: the Activity ramp's last consumers are the legend, the calendar, the hour grid, the duration list and the world map, and the ramp is still declared in `src/styles/tokens.css` for them alone.
- **The shared `.visually-hidden` now has four consumers** outside the shell (the device table, the new-data table, the timeline table and the timeline kind filter), all of which still carry their own local copies - the same deletion, in the same direction, in plans 14-11, 14-17 and 14-18.
- **The scratch after-set is current for this build.** A later plan that changes anything visible must rebuild it the same way (move the old directory aside, then `shots`, `overview` and `phone`), because the harness skips existing files.

## Self-Check: PASSED

- Every file the plan declares exists on disk and is committed: `src/lib/shell/Dashboard.svelte`, `src/lib/shell/Dropzone.svelte`, `src/lib/shell/GameFilter.svelte`, `src/lib/shell/AccountTag.svelte`, `src/lib/shell/UnsupportedBlock.svelte` and `tests/helpers/migration.ts` (all modified). The working tree holds no uncommitted change to the plan's files, and the temporary Playwright config is deleted.
- Every task commit is an ancestor of HEAD: `162bcbe` (Task 1) - 1 commit, 1 task, measured from `733414c` with `git rev-list --count`.
- Every acceptance criterion was run by hand: `pnpm exec vitest run tests/unit` exits 0 (164 files, 4908 passed, 9 expected fail) with the five files out of `PENDING_FILES`; `pnpm exec vitest run tests/unit/charts/tooltip-pin.test.ts` exits 0 with the `.chart-status` clip rule still local; `pnpm run lint` exits 0; `pnpm run check` exits 0 (363 files, 0 errors, 0 warnings); `pnpm run build` exits 0; and the four named e2e specs pass (57).
- The plan-level verification was re-run end to end after the last code commit: the unit suite, the lint, the type check, the build and the four e2e specs all exit 0, and the scratch compare reports 56/56 byte-equal panes plus a byte-equal empty state at 1280 and 375px.

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
