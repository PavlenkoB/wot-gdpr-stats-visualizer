---
phase: 14-design-unification
plan: 18
subsystem: ui
tags: [svelte, css, design-tokens, shared-blocks, shared-scroller, nesting, token-aware-tests, isolation]

# Dependency graph
requires:
  - phase: 14-design-unification
    provides: the token scale in `src/styles/tokens.css` (the `--fs-*`, `--fw-*`, `--lh-*`, `--space-*`, `--radius-*` and `--layout-*` custom properties) and the shared blocks in `src/styles/utilities.css` (`.body`, `.caption`, `.error`, `.scroller`, `.visually-hidden`)
  - phase: 14-design-unification
    provides: the shared `.scroller` scroll region (plan 14-06), the `table-scroll` box hook (plan 14-17) and the token-aware CSS test helpers `ruleDeclarations`, `resolveTokens`, `styleText` and `tokenMap` (plan 14-15)
provides:
  - The device-info pane and the rest of the account-timeline folder are on the token layer: no hex literal, every size, weight, leading, radius, padding and gap a token
  - `DeviceTable`'s scroll region is the shared `.scroller` plus a local `table-scroll` hook that states `isolation: auto`, so the table's stacking is exactly what the pre-phase build had
  - `TimelineTable`'s scroll region is the shared `.scroller` plus the same `table-scroll` hook, and it keeps the isolation it always had
  - `DeviceInfo` defines none of `.body`, `.caption` or `.error` and holds no status hex; `TimelineKindFilter` defines no `.visually-hidden`
  - The device pane's font-size sweep resolves the tokens, requires a non-empty match and checks every size against `SCALE_PX`, so it can no longer pass on an empty match
  - The four files are off `PENDING_FILES`, so the design-token and nesting guards now sweep them; with `AccountTimelinePane` (plan 14-01) the whole `account-timeline` folder is migrated
affects: [14-design-unification, device-info, account-timeline, DeviceInfo, DeviceTable, TimelineKindFilter, TimelineTable, phase-8-ui-review-guards]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 78352
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A local rule that OMITS a property does not RESET it. `DeviceTable`'s own `.scroller` rule never declared `isolation`, but the element carried `class=\"scroller\"` and the shared utility declares `isolation: isolate`, so the COMPUTED value had been `isolate` since plan 14-01. The new hook states `isolation: auto` explicitly, which is what restores the pre-phase value."
    - "A shared scroll region and a local box can share one element, and the local hook can also state the ONE property the shared rule would otherwise change. The two sets of declarations need not overlap, and where they DO overlap the hook must say so - here it says `isolation: auto` and why."

key-files:
  created: []
  modified:
    - src/lib/features/device-info/DeviceInfo.svelte
    - src/lib/features/device-info/DeviceTable.svelte
    - src/lib/features/account-timeline/TimelineKindFilter.svelte
    - src/lib/features/account-timeline/TimelineTable.svelte
    - tests/unit/device-info/device-info-blocks.test.ts
    - tests/unit/account-timeline/timeline-pane.test.ts
    - tests/unit/guards/phase8-ui-review-guards.test.ts
    - tests/helpers/migration.ts

key-decisions:
  - "`DeviceTable`'s `table-scroll` hook states `isolation: auto`, with a comment saying why: the table's header is sticky and carries NO z-index, and the table never isolated its own stacking, so the shared region's isolation would be a stacking change this phase must not make. A browser probe over three builds measures the computed value: `auto` at the pre-phase baseline `901a9e1`, `isolate` at the plan's starting commit `0bb70e3` (the shared `.scroller` utility has declared `isolation: isolate` since plan 14-01), and `auto` again after this plan - so the phase's NET effect on the stacking is nil."
  - "`TimelineTable`'s `table-scroll` hook does NOT state `isolation`, because that table always isolated: the shared rule supplies `isolation: isolate` and the hook supplies only the box. The two tables therefore differ deliberately, and the difference is in the hook, not in the markup."
  - "The device pane's status hexes are gone with the local `.error`: the shared `.error` reads `--danger` (`#c5221f`), `--danger-bg` (`#fce8e6`) and `--danger-ink` (`#8a1c17`), which are exactly the three literals the pane used to carry. The phase-8 guard's three allow-list entries named `DeviceInfo.svelte` and nothing else, so they were deleted WHOLE, and the `STATUS_REASON` constant that only they used went with them."
  - "The device pane's colour-literal reader was tightened to 'no colour literal at all', not left as an allow-list of three literals that no longer occur. The plan's action text named only the font-size sweep, but the phase-8 guard had just stopped permitting those three literals anywhere, and a reader that still allowed them would contradict the guard AND would assert nothing on an empty list - the same vacuity the plan set out to remove."
  - "The font-size sweep RESOLVES the tokens before it reads them and REQUIRES a non-empty match. The raw source of the migrated files matches `font-size: Npx` ZERO times, so a reader that did not resolve would have found nothing and asserted nothing. The sweep now resolves, requires at least one match, and checks every size against `SCALE_PX` - the canonical six, in place of the hard-coded `['14','18','26','30']` superset the carried open item named."
  - "The chip states are NESTED under `.chip` (`&:hover`, `&:has(input:checked)` with its own nested `&:hover`, `&:has(input:focus-visible)`), and the timeline table's `th.sticky-first` / `td.sticky-first` nest as `&.sticky-first` under their element. G6b counts `.` and `:` as extension characters, so the flat rules were offences once the files came off the pending list, and the nesting produces the same flat selectors the flat rules had."
  - "`timeline-pane.test.ts` needed NO change. Its assertions read the pane's own CSS, not the migrated children's; the run showed nothing broken, and the plan's action for that file was 'fix only what the run shows broken'."

patterns-established:
  - "When a local copy of a shared name is deleted, MEASURE the computed value before and after - not the source text. 'The local rule never said it' is not the same claim as 'the page never had it': the shared rule says it to every element that carries the class."

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-13]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "The device-info pane and the rest of the account-timeline folder are token-based and swept: the four files define none of .body, .caption, .error, .scroller or .visually-hidden, hold no hex literal, and are off PENDING_FILES and the status-colour entries of ALLOWED_COLOUR_LITERALS."
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/device-info tests/unit/guards - 25 files, 492 tests, all pass (the plan's Task 1 verify)"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/account-timeline tests/unit/guards - 28 files, 543 passed + 9 expected fail, all pass (the plan's Task 2 verify)"
        status: pass
      - kind: unit
        ref: "pnpm run test:unit - 164 files, 4899 passed, 9 expected fail, 0 failed"
        status: pass
      - kind: other
        ref: "the gated rules applied directly to the four files (tests/helpers/token-guards.ts): 0 offenders each for font, spacing, colour, shared-name, declaration-line, nesting and inline-style rules; and the compiled bundle dist/assets/index-Ixoal7UK.css carries .scroller, .visually-hidden, .body, .caption and .error each exactly ONCE as a GLOBAL rule and in no component scope"
        status: pass
    human_judgment: false
  - id: D2
    description: "DeviceTable's scroll region is the shared .scroller plus a local table-scroll hook that states isolation: auto, so its stacking behaviour is exactly what it was; TimelineTable uses the same shape and keeps the isolation it always had."
    verification:
      - kind: unit
        ref: "grep -c \"isolation: auto\" src/lib/features/device-info/DeviceTable.svelte - 2 (the plan's Task 1 acceptance criterion)"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test --config $TMPDIR/wg-phase14/playwright.tmp-14-18.config.ts tests/e2e/shell/device-info.spec.ts - 2 tests, all pass (10.7s)"
        status: pass
      - kind: other
        ref: "a browser probe of the computed style over three builds ($TMPDIR/wg-phase14/probe-detail-14-18.mjs): the device scroller's computed isolation is `auto` at the pre-phase baseline 901a9e1, `isolate` at the plan's starting commit 0bb70e3 and `auto` after this plan - so the phase's net effect on the stacking is nil and the hook is what restores it. The timeline scroller computes `isolate` in all three."
        status: pass
      - kind: other
        ref: "the compiled bundle dist/assets/index-Ixoal7UK.css: .table-scroll.svelte-ex8gg7{border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--page);isolation:auto;max-height:480px;position:relative} for the device table, and .table-scroll.svelte-1o3f1fa{border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--page);max-height:480px;position:relative} for the timeline table, beside the single global .scroller{isolation:isolate;min-width:0;overflow:auto}"
        status: pass
    human_judgment: false
  - id: D3
    description: "The device pane's font-size sweep cannot pass on an empty match: it resolves the tokens, requires at least one size, and checks every size against SCALE_PX."
    verification:
      - kind: unit
        ref: "the sweep was pointed at an empty input once and FAILED as required ('expected 0 to be greater than 0'), then reverted; the reverted file is byte-identical to the committed one"
        status: pass
      - kind: other
        ref: "raw-source probe over the migrated files ($TMPDIR/wg-phase14/prove-font-sweep-14-18.mjs): the OLD raw loop `font-size:\\s*(\\d+(?:\\.\\d+)?)px` matches ZERO times in DeviceInfo.svelte and in DeviceTable.svelte, so a reader that did not resolve the tokens would have asserted nothing; the NEW resolved sweep matches 3 and 2 sizes, and the same empty input makes the old sweep PASS (0 assertions) where the new one FAILS"
        status: pass
    human_judgment: false
  - id: D4
    description: "The device pane and the account timeline render as before: all eight captured pairs (two panes at 1280, 900, 899 and 375px) are byte-identical, and no computed style on any migrated element changed across the phase."
    verification:
      - kind: e2e
        ref: "pnpm exec playwright test --config $TMPDIR/wg-phase14/playwright.tmp-14-18.config.ts tests/e2e/shell/account-timeline-perks.spec.ts - 2 tests, all pass (21.1s)"
        status: pass
      - kind: other
        ref: "scratch capture sets at $TMPDIR/wg-phase14: before-14-18 (the plan's starting commit 0bb70e3 build) against after-14-18 - 8 of 8 pairs byte-identical (differing=0, box=none) at 1280, 900, 899 and 375px for the device-info and account-timeline panes"
        status: pass
      - kind: other
        ref: "the computed-style probe over three builds ($TMPDIR/wg-phase14/probe-detail-14-18.mjs): from the PRE-PHASE baseline 901a9e1 to this plan's result, the ONLY differences on the migrated elements are class names - the scroller gained the `table-scroll` hook and the two caption elements lost the Svelte scope class because their local copies were deleted. Not one font-size, weight, line height, colour, padding, margin, border, radius, background, position, z-index, isolation, overflow, width or height changed."
        status: pass
    human_judgment: true
    rationale: "A pixel comparison proves the panes did not move; it cannot prove the reader still reads them as the same information. The screenshots were reviewed by eye for the last part - the device table and the timeline table are still their panes' focal elements, the chip row still reads as a filter, and the kind badges still read as badges."
  - id: D5
    description: "The whole account-timeline folder is migrated and swept: AccountTimelinePane (plan 14-01) plus this plan's TimelineKindFilter and TimelineTable are off PENDING_FILES, and the device-info pair is with them."
    verification:
      - kind: unit
        ref: "tests/helpers/migration.ts - PENDING_FILES now holds only the five Overview files (OverviewBars, OverviewBento, OverviewGroup, OverviewRows, OverviewTile); the guard's own 'no pending file is clean' rule passes, so the list did not rot"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards/phase7-layout-guards.test.ts - 8 tests, all pass (the plan's Task 2 acceptance criterion)"
        status: pass
    human_judgment: false

# Metrics
duration: 36min
completed: 2026-10-28
status: complete
---

# Phase 14: Design Unification Summary

**The device-info pane and the rest of the account-timeline folder moved onto the token layer — the shared `.scroller` now owns both tables' scroll regions, the shared `.caption`, `.body` and `.error` own the device pane's text blocks, the device table's stacking is provably unchanged, the font-size sweep can no longer pass on an empty match, and all eight captured panes are byte-identical to the pre-plan build**

## Performance

- **Duration:** 36 min
- **Started:** 2026-10-28T00:01:00+04:00
- **Completed:** 2026-10-28T00:37:00+04:00
- **Tasks:** 2
- **Files modified:** 11 (8 code/test + this summary + STATE.md + ROADMAP.md)

## Accomplishments

- `DeviceInfo.svelte`, `DeviceTable.svelte`, `TimelineKindFilter.svelte` and `TimelineTable.svelte` are token-based and off `PENDING_FILES`, so the design-token guard (G1/G3/G4/G5/G6) and the nesting guard now sweep them. **Zero offenders** each, measured directly against `tests/helpers/token-guards.ts`.
- The three shared names — `.body`, `.caption` and `.error` — are defined in none of the four files. The shared blocks of `src/styles/utilities.css` serve the existing markup, so the e2e locators on `p.body`, `p.caption` and `p.body.error` need no edit. The device pane's three status hexes are gone with the local `.error`: the shared rule reads `--danger`, `--danger-bg` and `--danger-ink`, which hold exactly the three literals the pane used to carry.
- Both tables' scroll regions are the **shared `.scroller`** with a local `table-scroll` hook beside it. The shared rule keeps `min-width: 0`, `overflow: auto`, `isolation: isolate` and the focus ring; the hook keeps the box the table owns.
- **The device table's stacking is unchanged, and that is measured, not asserted.** Its hook states `isolation: auto` because the table's header is sticky with no z-index and the table never isolated itself. A browser probe over three builds reads the computed value: `auto` at the pre-phase baseline `901a9e1`, `isolate` at the plan's starting commit `0bb70e3`, `auto` again after this plan. The phase's net effect on this table's stacking is **nil**.
- The **font-size sweep can no longer pass on nothing.** It resolves the tokens, requires at least one match, and checks every size against `SCALE_PX`. The probe is concrete: the OLD raw-source loop matches `font-size: Npx` **zero times** in both migrated files, and pointing the new sweep at an empty input makes it fail where the old one passed.
- The chip states and the timeline table's sticky column are **nested**, so the compiled selectors are the ones the flat rules had.
- All eight captured panes — device info and account timeline at 1280, 900, 899 and 375px — are **byte-identical** to the pre-plan build. This plan moves no pixel.
- Across the **whole phase**, not one computed style on any migrated element changed: from the pre-phase baseline to this plan's result the only differences are class names (the scroller gained the hook; the two caption elements lost the Svelte scope class because their local copies were deleted).

## Task Commits

Each task was committed atomically:

1. **Task 1: the device info pane** — `7f8981b` (refactor)
2. **Task 2: the account-timeline folder** — `923f05b` (refactor)

**Plan metadata:** `14-18-SUMMARY.md` (docs: complete plan)

## Files Created/Modified

- `src/lib/features/device-info/DeviceInfo.svelte` — the device pane. Its local `.body`, `.caption` and `.error` are deleted for the shared ones; the markup keeps `class="body"`, `class="body error"` and `class="caption"`. `.block`, `h3`, `dl`, `dt` and `dd` read the type and spacing tokens.
- `src/lib/features/device-info/DeviceTable.svelte` — the per-source device table. The local `.scroller`, its `:focus-visible` and the local `.visually-hidden`, `.body` and `.caption` are deleted; the scroller element keeps `class="scroller"` and gains `table-scroll`, whose rule keeps the box (position, the 480px cap, the border, the radius, the background) **and states `isolation: auto` with a comment saying why**. The sticky header's declarations are unchanged; `table`, `th` and `td` read the tokens.
- `src/lib/features/account-timeline/TimelineKindFilter.svelte` — the chip row. The local `.visually-hidden` is deleted (the markup keeps the class); `.kind-filter`, `.label`, `.chips` and `.chip` read the tokens, and the chip's states nest as `&:hover`, `&:has(input:checked)` (with its own nested `&:hover`) and `&:has(input:focus-visible)` under `.chip`.
- `src/lib/features/account-timeline/TimelineTable.svelte` — the timeline table. The local `.scroller`, its `:focus-visible` and the local `.visually-hidden` are deleted; the scroller element keeps `class="scroller"` and gains `table-scroll`. The sticky header and first-column rules and their `z-index` 2, 3 and 1 are unchanged; `th.sticky-first` and `td.sticky-first` nest as `&.sticky-first`. The font sizes, weights, line heights, cell paddings and the 6px radii read the tokens.
- `tests/unit/device-info/device-info-blocks.test.ts` — the device pane reader. The font-size sweep now resolves the tokens, requires a non-empty match and checks `SCALE_PX`; the colour-literal reader is tightened to "no colour literal at all".
- `tests/unit/account-timeline/timeline-pane.test.ts` — **unchanged.** The plan's action for this file was "fix only what the run shows broken", and the run showed nothing broken.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` — the phase-8 UI review guard. The three status-colour allow-list entries named `DeviceInfo.svelte` and nothing else, so they are deleted WHOLE, and the `STATUS_REASON` constant that only they used goes with them.
- `tests/helpers/migration.ts` — `PENDING_FILES` no longer lists the four migrated files; only the five Overview files remain.

## Decisions Made

- **The device table's hook states `isolation: auto`, and the reason is measured.** The plan's premise — that this table never isolated — is true of its LOCAL rule and of the pre-phase build, but not of the plan's starting commit: the element carries `class="scroller"`, and the shared utility has declared `isolation: isolate` since plan 14-01, so the computed value had been `isolate`. The hook restores the pre-phase value, which is exactly what "this phase must not change stacking behaviour" asks for. The rule to carry forward: **a local rule that omits a property does not reset it** — measure the computed value, not the source text.
- **The timeline table's hook does not state `isolation`,** because that table always isolated. The two tables differ deliberately and the difference lives in the hook.
- **The shared names are DELETED, not tokenised.** The shared rules declare the same values and a scoped local copy would outrank the shared one.
- **The phase-8 guard's allow-list entries go WHOLE.** An entry that loses its last file is deleted, not edited down to an empty list, and the constant that only it used goes with it.
- **The device pane's colour reader is tightened.** The plan's action named only the font-size sweep, but the phase-8 guard had just stopped permitting the three status literals anywhere, and a reader that still allowed them would contradict the guard and would assert nothing on an empty list.
- **The compound and state selectors are nested.** G6b counts `.` and `:` as extension characters, so the flat rules were offences once the files came off the pending list, and the nesting produces the same flat selectors the flat rules had.
- **The font-size sweep resolves AND requires a match.** The resolution keeps the sweep meaningful; the non-empty check keeps it honest.
- **`timeline-pane.test.ts` needed no change.** Its assertions read the pane's own CSS, not the migrated children's.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Correctness] The device pane's colour-literal reader was tightened beyond the plan's action text**
- **Found during:** Task 1 (the reader update)
- **Issue:** The plan's action for `device-info-blocks.test.ts` named only the font-size sweep. The file's colour test allowed exactly the three status literals (`#c5221f`, `#fce8e6`, `#8a1c17`) that `DeviceInfo.svelte` used to carry — and the same plan deletes the phase-8 guard's allow-list entries for that file. Left as it was, the reader would allow the very literals the phase-8 guard had just stopped permitting anywhere, and its loop over the literals would assert nothing once the file was hex-free — the same vacuity the plan set out to remove.
- **Fix:** The reader now asserts "no colour literal at all" for both files, which is true and is what the phase-8 guard now enforces for them.
- **Files modified:** `tests/unit/device-info/device-info-blocks.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/device-info tests/unit/guards` — 25 files, 492 tests, all pass; the guard's own stale-entry check passes with the three entries deleted.
- **Committed in:** `7f8981b`

**2. [Rule 1 - Convention] The temporary Playwright config was written outside the repository, with absolute paths**
- **Found during:** Task 1 and Task 2 (the e2e runs)
- **Issue:** The established temporary config resolves `testDir` and the webServer against its OWN directory, so it only works from inside the repository. Copying it to `$TMPDIR` verbatim fails: Playwright cannot resolve `@playwright/test` from outside the repo, and the paths would point at the scratch folder.
- **Fix:** The temporary config was written to `$TMPDIR/wg-phase14/playwright.tmp-14-18.config.ts` with an ABSOLUTE `@playwright/test` import, an ABSOLUTE `testDir` and an explicit `webServer.cwd` pointing at the repository. Nothing was written into the repository.
- **Files modified:** none in the repository — the config is a scratch artifact outside it
- **Verification:** both e2e runs passed against it; `git diff --stat playwright.config.ts` is empty and no temporary file is committed.
- **Committed in:** n/a — nothing in the repository changed

**3. [Rule 1 - Convention] The screenshot capture went into its own labelled pair, and the before state was captured from a scratch worktree**
- **Found during:** Task 2 (the scratch capture step)
- **Issue:** The plan's action says to run the scratch `shots --label after` and compare with `before`, but the dispatch brief states that the shared `before`/`after` capture sets are stale for the current build and must not be clobbered. The harness's own `compare` subcommand reads the fixed `before`/`after` directories, so a labelled pair needs a labelled compare. The plan's starting commit had also to be built to capture the "before".
- **Fix:** The pre-plan state was captured into `$TMPDIR/wg-phase14/before-14-18/` from a scratch worktree build of the plan's starting commit `0bb70e3`, and the post-plan state into `$TMPDIR/wg-phase14/after-14-18/`, both from the same harness, the same widths and the same panes. A scratch `compare-labelled-14-18.mjs` (outside the repository) compared the two labelled sets. The shared sets were not touched, and the pre-existing `baseline` worktree (which plan 14-20 needs) was left exactly as it was found.
- **Files modified:** none — the captures and the worktree are scratch, outside the repository
- **Verification:** all 8 pairs (1280, 900, 899, 375px × device-info, account-timeline) report `differing=0 box=none`; `git worktree list` shows only the repository and the pre-existing `baseline` worktree.
- **Committed in:** n/a — nothing in the repository changed

---

**Total deviations:** 3 (one correctness tightening inside the plan's own file list, two scratch-artifact conventions outside the repository)
**Impact on plan:** The first tightens a reader the plan did not name, but in the direction the plan itself requires (the phase-8 guard's allow-list for this file is deleted in the same commit, and the reader would otherwise contradict it and pass vacuously). The second and third are where scratch files are written and how a stale shared capture set is avoided. None changes the plan's scope, and all the plan's own acceptance criteria are met.

## Issues Encountered

- **The device table's computed `isolation` was `isolate` at the plan's starting commit, not `auto`.** The plan's premise ("it never had `isolation: isolate`") is true of the table's LOCAL rule and of the pre-phase build, but the element carries `class="scroller"` and the shared `.scroller` utility has declared `isolation: isolate` since plan 14-01, so the computed value had been `isolate` since then. This was found by a browser probe, not by reading the source. The plan's mandated `isolation: auto` hook restores the pre-phase value, so the phase's net effect on the stacking is nil — but the intermediate state was a real stacking change made by an earlier plan, and that is worth the next plan knowing. **Recorded in STATE.md's accumulated context.**
- **A stale `vite preview` holds port 4173.** The committed `playwright.config.ts` sets `reuseExistingServer: false`, so Playwright cannot start its own server there and would have tested the STALE build. The temporary config moved the base URL and the webServer to the free port 4174. `playwright.config.ts` is untouched and no temporary file is committed. The plan's own probe servers ran on 4175, 4176 and 4177 and were stopped afterwards.
- **The known pre-existing starvation flake in `tests/unit/overview/overview-grid.test.ts` did NOT fire in this plan.** The full suite passed on its first run (164 files, 4899 passed, 9 expected fail, 0 failed), so no re-run and no scratch worktree were needed. The file is in no plan's `files_modified` list and the timeout was not raised.
- **The pre-existing `baseline` worktree's `node_modules` is stale** (its pnpm store predates the current `rolldown`), so `vite build` fails inside it. This was NOT changed: it is shared scratch state that plan 14-20 needs, and this plan used its own fresh worktree at the same commit instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The account-timeline folder is entirely migrated (`AccountTimelinePane` in 14-01, `TimelineKindFilter` and `TimelineTable` here) and the device-info pair is with it. `PENDING_FILES` now holds only the five Overview files (plans 14-19 and 14-20), so the design-token and nesting guards now sweep everything else.
- The scratch captures (`before-14-18` and `after-14-18`) are kept for UAT, together with the probes `probe-14-18.mjs`, `probe-detail-14-18.mjs`, `prove-font-sweep-14-18.mjs` and `gate-check-14-18.mts` at `$TMPDIR/wg-phase14/`. They are the pre-plan and post-plan states of this plan; a later plan comparing against the phase `before` baseline is comparing against a set the brief records as stale.
- The two artifacts this plan declares — the `table-scroll` hook on both tables' scroller, and the `isolation: auto` that keeps the device table's stacking as it was — are now in the codebase.
- **Open items this plan did NOT touch** (they are outside its file list, so they are reported rather than edited): `tests/e2e/_support/helpers.ts:541` (says the stat tile numerals are 30px), `tests/e2e/shell/master-detail-nav.spec.ts:72` (comment names the retired 30), `src/lib/features/logins/map-model.ts:36` (still says "ramp" in prose).
- **Closed in this plan:** the carried open item at `tests/unit/device-info/device-info-blocks.test.ts:143` (the hard-coded `['14','18','26','30']` superset). The sweep now resolves the tokens and checks the canonical `SCALE_PX`.
- **New for the owner, and carried to 14-21:** the shared `.scroller` utility's `isolation: isolate` reaches EVERY element that carries `class="scroller"`, including the device table, whose own rule never asked for it. This plan corrects it with an explicit `isolation: auto`, but a later plan that adds a `class="scroller"` to a component that must not isolate has to make the same declaration.
- Plan 14-14's flagged judgement call for the owner is unchanged and still open: the neutral `.info` box border was kept at `var(--border)` rather than `var(--faint)`, because the UI-SPEC's Allowed Visible Changes list names only the 4px toggle gap. This plan did not act on it.

---
*Phase: 14-design-unification*
*Completed: 2026-10-28*
