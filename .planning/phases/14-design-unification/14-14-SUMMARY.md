---
phase: 14-design-unification
plan: 14
subsystem: ui
tags: [svelte, css, design-tokens, utilities, caption, error, nesting, spacing-scale]

# Dependency graph
requires:
  - phase: 14-design-unification
    provides: the shared text blocks in `src/styles/utilities.css` (`.body`, `.caption`, `.error`) and the token scale in `src/styles/tokens.css`
  - phase: 14-design-unification
    provides: the migrated vehicle table and battle-type summary (plan 14-13), the vehicles pane's first half
provides:
  - The vehicle statistics block is on the token layer: no local `.body`, `.caption` or `.error`, no hex literal, every size, weight, leading, radius and gap a token
  - `PlayerStats.svelte` is off the migration's pending list and out of the three status-colour entries of the phase-8 UI review guard
  - The phase's one spacing snap lives here and nowhere else: `.toggle`'s checkbox-to-label gap is `var(--space-4)` (D-04)
affects: [14-design-unification, vehicles, PlayerStats, utilities, nesting-guard, phase-8-ui-review-guards]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 4337
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A shared-name rule is DELETED, not tokenised, when the shared block computes to the same values - a scoped selector outranks the shared one, so a leftover local rule would silently keep winning the cascade."
    - "A hook that is ALIVE stays a local rule even when the shared block it sits on is deleted: the shared `.caption` (0,1,0) loses to a scoped `.count` (0,2,0), so the count line keeps its weight and its colour without the local caption rule."
    - "Svelte's CSS pruning understands `class:` directives: `&.hidden` nested under `.status` is still a used selector, so the nesting guard's no-unused-selector sweep stays green."

key-files:
  created: []
  modified:
    - src/lib/features/vehicles/PlayerStats.svelte
    - tests/unit/guards/phase8-ui-review-guards.test.ts
    - tests/helpers/migration.ts

key-decisions:
  - "The local `.body`, `.caption` and `.error` rules are DELETED, not tokenised. The shared rules in `src/styles/utilities.css` declare exactly the same values - `.body` is margin 0, min-width 0, 14/400/1.5, `--text`, `overflow-wrap: anywhere`; `.caption` is margin 0, min-width 0, 14/400/1.4, `--muted`, `overflow-wrap: anywhere`; `.error` is 8px/12px padding, a 1px `--danger` border, `var(--radius-sm)`, `--danger-bg` and `--danger-ink` - and a scoped local copy would outrank the shared one, so the migration would have been a no-op with extra steps."
  - "The `.count` hook stays LOCAL and alive. The trap plan 14-12 hit in the logins pane does not recur here: there the local `.count` was DEAD (a later local `.caption` of equal specificity won the cascade, so the count line rendered muted 400), and deleting the local `.caption` would have made it live and moved the line. In the vehicles pane the local `.count` is ALIVE - it comes after the local `.caption` in source order, so it already wins font-size, font-weight and colour - and deleting the local `.caption` does not change that: the shared `.caption` at (0,1,0) is outranked by the scoped `.count` at (0,2,0). The count line renders 14px/600/1.4/`--text` before and after. The probe confirms it."
  - "The `.info` border stays `var(--border)`. The plan says the box keeps its neutral chrome 'with the radius on `var(--radius-sm)` and the faint border'; the radius is named with a token and the border is named in prose, and this box's border is the LIGHT one (`--border`, #dcdcdc) that every other neutral box in the app uses (`PlaytimeSummary`'s tile, `SpendSummary`'s card). `--faint` (#8c8c8c) is the darker decoration line the logins pane's `.info` uses - and that box already had it before plan 14-12 touched it. Switching this one would darken the border, and the UI-SPEC's Allowed Visible Changes list is complete and names only the 4px gap. The reading is recorded here for the owner: if `var(--faint)` was meant, it is a one-line change AND a second visible change the list does not permit yet."
  - "The `.search-hint` hook keeps only `line-height: var(--lh-body)`. Its `margin: 0` was removed because the shared `.caption` supplies it, and the scoped `.search-hint` (0,2,0) still outranks the shared `.caption` (0,1,0) for the leading - so the hint renders muted 14px at 1.5 with a zero margin, exactly as before."
  - "The G6b nestings preserve specificity exactly, so no pixel moved because of them. `.status.hidden` as `&.hidden` compiles to `.status.svelte-xxx.hidden` (0,3,0), the same as the flat `.status.hidden.svelte-xxx`; `.control label` as `& label` compiles to `.control.svelte-xxx label:where(.svelte-xxx)` (0,2,1), the same as the flat `.control label.svelte-xxx`; the same holds for `& dt`, `& dd`, `& > summary`, `& fieldset`, `& legend`, `& input:focus-visible` and the four `&:hover`/`&:focus-visible` states. The probe reads the rendered values, not the source."
  - "`.controls` stays a TOP-LEVEL rule with `flex-direction: row` and `flex-wrap: wrap`. It is the one rule in this file the phase-5 layout guard asserts on, through the nested-aware reader `ruleDeclarations`; nesting it would have been legal under G6b but would have moved the rule's own declarations behind a parent, and there is no parent to nest it under."
  - "The `.sr-only` clip block stays local under its own name. The playbook deletes only the rules named exactly `.visually-hidden`, and `margin: -1px` stays legal because the same rule declares `clip`."
  - "The four pane screenshots are byte-equal before and after, because the column picker is CLOSED in a pane capture and a closed `<details>` renders no checkboxes. The one visible change is only visible with the picker open, where the measured distance between a checkbox and its label text goes from 6px to 4px."

patterns-established:
  - "A hook that is alive in one pane and dead in another is a per-pane fact, not a per-class one: `class=\"caption count\"` renders 600/`--text` in the vehicles pane and muted 400 in the logins pane, and a migration must re-read the cascade in the pane it is migrating rather than carry the other pane's answer across."
  - "A deleted shared-name rule leaves the element WITHOUT a Svelte scope class when no other local rule matches it (here `p.caption.note` and `p.caption.hint`); the shared global rule then styles it, and the probe must confirm the computed values rather than the class attribute."

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-13]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "The vehicle statistics block is on the token layer: it defines none of `.body`, `.caption` or `.error`, carries no hex literal, and every size, weight, leading, radius and gap is a token; the one 6px spacing site, the `.toggle` checkbox-to-label gap, is `var(--space-4)`."
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts, tests/unit/guards/nesting-guard.test.ts, tests/unit/guards/phase5-layout-guards.test.ts - the `.controls` assertions still resolve through the nested-aware reader"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/vehicles tests/unit/guards - 27 files, 634 tests, all pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "The vehicles pane renders as before, except the one change the plan names: the 4px toggle gap. Every other computed style in the block is identical to the pre-change build."
    verification:
      - kind: other
        ref: "scratch computed-style probe (probe-14-14.mjs, outside the repository): 25 live elements + 3 synthetic, 697 properties identical, the only difference the `.toggle` gap 6px -> 4px"
        status: pass
      - kind: e2e
        ref: "tests/e2e/vehicles/vehicle-stats.spec.ts (25 tests, all pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`PlayerStats.svelte` is off `PENDING_FILES` and out of the three status-colour entries of `ALLOWED_COLOUR_LITERALS`; the vehicles pane has no pending file left."
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts, tests/helpers/migration.ts - and the pending-list guard, which fails a pending file that has become clean"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 4px checkbox-to-label gap reads well next to the native checkbox, and the picker still wraps correctly at 375px."
    verification:
      - kind: automated_ui
        ref: "scratch picker-open captures at 1280 and 375 (picker-after-14-14/), with the measured text gap 4px"
        status: pass
    human_judgment: true
    rationale: "The plan's own human-check asks a person to confirm the 4px gap reads well; the probe proves the value moved and by how much, but not that it reads well."

# Metrics
duration: 36min
completed: 2026-10-27
status: complete
---

# Phase 14: Design Unification Summary (Plan 14-14)

**The vehicles pane's second half moved onto the token layer: the vehicle statistics block takes the shared `.body`, `.caption` and `.error` blocks, every literal became a token, and the phase's one spacing snap - the checkbox-to-label gap - is 4px.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-10-27T20:41:00+04:00
- **Completed:** 2026-10-27T21:17:00+04:00
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- `PlayerStats.svelte` no longer defines `.body`, `.caption` or `.error`. The markup keeps `class="body"`, `class="body error"`, `class="body info"`, `class="caption"` and `class="caption search-hint"`; the shared rules in `src/styles/utilities.css` now style them, and the local copies are gone because a scoped copy would have kept winning the cascade.
- The count line did NOT move. The `.count` hook stays local and stays alive - it was already winning the cascade here, the way plan 14-12's logins hook was not - so `class="caption count"` still renders 14px/600/1.4/`--text`, and the probe reads exactly that before and after.
- The one visible change is the owner's: `.toggle`'s gap is `var(--space-4)`. A computed-style probe of the pre-change build against this plan's build read 25 live elements and 3 synthetic ones, 700 properties in all: 697 are identical and the only difference is the toggle's gap, 6px -> 4px.
- The allowlists shorten with it: `PlayerStats.svelte` leaves `PENDING_FILES` and the three status-colour entries of the phase-8 UI review guard, and the vehicles pane has no pending file left.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate the vehicle statistics block** - `38b6d4b` (refactor)

**Plan metadata:** `docs(14-14): complete the vehicle statistics block plan`

## Files Created/Modified

- `src/lib/features/vehicles/PlayerStats.svelte` - the largest style block in the app, on tokens: the shared text blocks replace the local copies, every literal tokenised, and the G6b state and child rules nested under their parents.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - `PlayerStats.svelte` removed from the `#c5221f`, `#fce8e6` and `#8a1c17` entries; the three literals it allowed are gone from the file.
- `tests/helpers/migration.ts` - `PlayerStats.svelte` off `PENDING_FILES`.

## Decisions Made

- **The shared `.body`, `.caption` and `.error` are DELETED, not tokenised.** Each shared rule declares exactly the values the deleted local rule carried, so the rendering is unchanged; and a scoped local rule outranks the shared global one, so tokenising instead would have left the local copy winning the cascade and the migration would have been a no-op. This is the same reasoning plan 14-13 used for the battle-type summary's local `.caption`.
- **The `.count` hook stays local, and the count line does not move.** The trap plan 14-12 found does not recur here, and the difference is worth stating plainly: in the logins pane the local `.count` was DEAD - a later local `.caption` of equal specificity won the cascade, so the count line rendered muted 400, and deleting that local `.caption` would have made the hook live and moved the line. In the vehicles pane the local `.count` is ALIVE, because it comes after the local `.caption` in source order. Deleting the local `.caption` does not change that: the shared `.caption` at (0,1,0) loses to the scoped `.count` at (0,2,0), so the line still resolves to 14px/600/`--text` and still takes its 1.4 leading from the caption. The probe reads 14px/600/19.6px/`rgb(58, 58, 58)` on both builds.
- **The `.info` border stays `var(--border)`.** The plan says the box keeps its neutral chrome "with the radius on `var(--radius-sm)` and the faint border". The radius is named with a token and the border in prose; this box's border is the light `--border` (#dcdcdc) that the app's other neutral boxes use, while `--faint` (#8c8c8c) is the darker decoration line the logins pane's `.info` happens to carry. Switching it would darken the border, and the UI-SPEC's Allowed Visible Changes list is complete and names only the 4px gap. **Flagged for the owner:** if `var(--faint)` was meant, it is a one-line change, and it needs the Allowed Visible Changes list to say so first.
- **The `.search-hint` hook keeps only its leading.** Its `margin: 0` is gone because the shared `.caption` supplies it; the scoped `.search-hint` still outranks the shared `.caption` for `line-height`, so the hint renders muted 14px at 1.5 with a zero margin, exactly as before.
- **The G6b nestings preserve specificity exactly.** Worth recording for the next plan: Svelte scopes a nested rule by putting the class on the TOP compound and wrapping the nested compound in `:where()`, so `.status.hidden` as `&.hidden` compiles to `.status.svelte-xxx.hidden` (0,3,0) - the same as the flat `.status.hidden.svelte-xxx` - and `.control label` as `& label` compiles to `.control.svelte-xxx label:where(.svelte-xxx)` (0,2,1) - the same as the flat `.control label.svelte-xxx`. The same holds for `& dt`, `& dd`, `& > summary`, `& fieldset`, `& legend`, `& input:focus-visible` and the four `&:hover`/`&:focus-visible` states. No pixel moved because of the nesting; the probe confirms it rather than the source arguing for it.
- **`.controls` stays a top-level rule.** It is the one rule in this file the phase-5 layout guard asserts on, through the nested-aware reader `ruleDeclarations`; it stays top-level so the guard reads its OWN declarations - `flex-direction: row`, `flex-wrap: wrap` - directly.
- **The `.sr-only` clip block stays local under its own name.** The playbook deletes only the rules named exactly `.visually-hidden`, and `margin: -1px` stays legal because the same rule declares `clip`.
- **The `&.hidden` nesting is safe under Svelte's CSS pruning.** `hidden` is applied by a `class:` directive, not a literal class, so it was worth checking rather than assuming: compiling the component produces zero warnings, and the `&.hidden` rule is not reported as an unused selector.

## Deviations from Plan

### Auto-fixed Issues

**1. [Verification artefact] The shared before/after screenshot sets were not used or overwritten**
- **Found during:** Task 1 (the plan's screenshot step)
- **Issue:** The plan asks for `shots --label after` and a `compare` with `before`. The harness's `compare` reads the hard-coded `before/` and `after/` directories, and the shared sets in the scratch directory are stale for the current build.
- **Fix:** The sets were captured into labelled directories of their own (`before-14-14/`, `after-14-14/`) and compared through the harness's own `compare` subcommand run under a separate `TMPDIR` root, so the shared sets were neither used nor clobbered. The `before` set was built from this plan's parent commit and the `after` set from this plan's commit.
- **Files modified:** none - scratch only, outside the repository.
- **Verification:** 4/4 pane pairs byte-equal at 1280, 900, 899 and 375px.
- **Committed in:** n/a - no repository file changed.

**2. [Verification artefact] The error box, the title-state note and the search hint were measured with synthetic elements**
- **Found during:** Task 1 (the probe)
- **Issue:** The synthetic sample export never renders the error box, the neutral title-state note, the per-account search hint, the Warplanes header or the skipped-files lines - not in any of the four titles. Three of the four elements the plan names ("its error box, neutral info message, count line and search hint") were therefore unmeasurable on the live DOM.
- **Fix:** The probe inserts three elements carrying the component's own scope class and the exact class list the real elements have - `body error`, `body info`, `caption search-hint` - into the block, reads their computed styles, and removes them. This is faithful in BOTH builds: today the local rules match the synthetic element, and after the migration the global rules do, while the scope class is inert either way.
- **Files modified:** none - scratch only, outside the repository.
- **Verification:** the error box reads 1px solid `rgb(197, 34, 31)` on `#fce8e6` with `rgb(138, 28, 23)` text and a 6px radius on both builds; the info box reads a 1px `rgb(220, 220, 220)` border on `#f5f5f5`; the search hint reads 14px/400 at 21px leading in `rgb(92, 92, 92)`.
- **Committed in:** n/a - no repository file changed.

---

**Total deviations:** 2 auto-fixed (both in the verification apparatus, no repository file changed)
**Impact on plan:** No scope change. Both deviations replace a step the plan could not have run as written with an equivalent that measures the same thing more precisely; the plan's code changes are exactly as written.

## Issues Encountered

- **A stale `vite preview` holds port 4173**, and the committed Playwright config sets `reuseExistingServer: false`, so Playwright could not start its own server there. Every e2e run and every preview went through a temporary config in the repo root that moved `use.baseURL` and `webServer` to port 4174. The temporary file was moved out of the repository afterwards and was never committed; `playwright.config.ts` is untouched.
- **The plan's screenshot comparison could not show the one change it names.** The four pane captures are byte-equal before and after, because the column picker is CLOSED in a pane capture and a closed `<details>` renders no checkboxes - and the 4px gap lives inside the picker. A separate picker-open capture measures it: the CSS gap goes 6px -> 4px, and the distance from a checkbox's right margin edge to its label text goes from 6px to 4px. Both picker captures (1280 and 375) were kept for the human check; at 375px the fieldset still wraps correctly.
- **Two elements lose their Svelte scope class.** `p.caption.note` and `p.caption.hint` match no local rule any more, so Svelte no longer puts a scope class on them; the shared global `.caption` styles them instead. Their computed styles are identical - the probe reads 14px/400 at 19.6px in `rgb(92, 92, 92)` on both builds. This is the pattern plan 14-13 recorded for the same reason.
- The pre-existing `tests/unit/overview/overview-grid.test.ts` starvation flake did not appear: the full unit suite passed in one run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The vehicles pane is fully on the token layer.** `PlayerStats.svelte` was the last vehicles entry on `PENDING_FILES`, and 23 files remain on that list in the other panes.
- **Open item for the owner:** the `.info` border reading. This plan kept `var(--border)` and recorded why; changing it to `var(--faint)` is one line but is a second visible change, and the UI-SPEC's Allowed Visible Changes list would have to name it first.
- **Open items carried forward, reported and deliberately not edited** (none is in this plan's file list): `tests/e2e/_support/helpers.ts:541` (says stat tile numerals are 30px), `tests/e2e/shell/master-detail-nav.spec.ts:72` (comment names the retired 30), `tests/unit/device-info/device-info-blocks.test.ts:143` (hard-coded `['14','18','26','30']` superset), `src/lib/features/logins/map-model.ts:36` and `src/lib/charts/FlowLegend.svelte` (still say "ramp" in prose).
- **Carried from plan 14-12, still open for the owner:** the logins pane's `class="caption count"` still renders muted 400 while the vehicles pane's renders 600/`--text`. This plan did not change either, and the asymmetry is now measured rather than assumed.

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
