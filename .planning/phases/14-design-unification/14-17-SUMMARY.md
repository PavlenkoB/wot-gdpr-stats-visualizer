---
phase: 14-design-unification
plan: 17
subsystem: ui
tags: [svelte, css, design-tokens, shared-blocks, shared-scroller, nesting, token-aware-tests]

# Dependency graph
requires:
  - phase: 14-design-unification
    provides: the token scale in `src/styles/tokens.css` (the `--fs-*`, `--fw-*`, `--lh-*`, `--space-*`, `--radius-*` and `--layout-*` custom properties) and the shared blocks in `src/styles/utilities.css` (`.body`, `.caption`, `.error`, `.scroller`, `.visually-hidden`)
  - phase: 14-design-unification
    provides: the shared `.scroller` scroll region (plan 14-06) and the token-aware CSS test helpers `ruleDeclarations`, `resolveTokens`, `styleText` and `tokenMap` (plan 14-15)
provides:
  - The new-data card and table are on the token layer: no hex literal, every size, weight, leading, radius, padding and gap a token
  - `NewDataTable`'s scroll region is the shared `.scroller` plus a local `table-scroll` hook, so the focus ring and the isolation have ONE home
  - `NewDataCard`'s caption is the shared `.caption` plus a local `under-title` hook whose only declaration is `margin-top: calc(var(--space-4) * -1)`
  - `HeatPane`, `PerksPane` and `WarshipsStoragePane` define none of `.body`, `.caption` or `.error` and hold no status hex
  - The literal-CSS assertions of `new-data-blocks.test.ts` and `new-data-panes.test.ts` read the resolved value, and the font-size sweeps cannot pass on an empty match
  - The five files are off `PENDING_FILES`, so the design-token and nesting guards now sweep them
affects: [14-design-unification, new-data, NewDataCard, NewDataTable, HeatPane, PerksPane, WarshipsStoragePane, phase-8-ui-review-guards]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 8783
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A local copy of a SHARED block is DELETED, not tokenised, when the shared rule already declares the same values. A scoped local copy outranks the global one, so keeping it would make the migration a no-op with extra steps."
    - "A shared scroll region and a local box can share one element: the shared class supplies the region (the overflow, the isolation, the focus ring) and a local hook supplies the box (the position, the cap, the border). The two sets of declarations do not overlap, so nothing competes."

key-files:
  created: []
  modified:
    - src/lib/features/new-data/NewDataCard.svelte
    - src/lib/features/new-data/NewDataTable.svelte
    - src/lib/features/new-data/HeatPane.svelte
    - src/lib/features/new-data/PerksPane.svelte
    - src/lib/features/new-data/WarshipsStoragePane.svelte
    - tests/unit/new-data/new-data-blocks.test.ts
    - tests/unit/new-data/new-data-panes.test.ts
    - tests/unit/guards/phase8-ui-review-guards.test.ts
    - tests/helpers/migration.ts

key-decisions:
  - "The card's caption keeps the shared `.caption` and states only the DIFFERENCE. The original rule was `margin: -4px 0 0`; the shared `.caption` already declares `margin: 0` and the muted ink, so the card's local hook declares `margin-top: calc(var(--space-4) * -1)` and nothing else. The caption element is `<p class=\"caption under-title\">`, and the hook's scoped specificity (0,2,0) outranks the shared rule's (0,1,0), so the rendered margin is the same -4px."
  - "The card's `h3` takes NO role and stays 14px/600/1.4. It is a CARD title, not a pane title: the UI-SPEC's Allowed Visible Changes list names only the pane titles (OI-1, 26px to 32px), and no role's triple is 14/600/1.4 (`.t-body-strong` is 14/600/1.5). The plan's own action says to tokenise `h3`, and it is tokenised."
  - "The table's scroll region is the shared `.scroller` plus a local `table-scroll` hook. The shared rule supplies `min-width: 0`, `overflow: auto`, `isolation: isolate` and the focus ring; the hook keeps the box the table owns (`position: relative`, `max-height: 480px`, the 1px `var(--border)` border, `var(--radius-sm)` and the page background). No declaration is in both, so the compiled element is the same as before."
  - "`th.num, td.num` SPLIT into `&.num` nested under `th` and under `td`, and `td.sticky-first` / `th.sticky-first` nest the same way. G6b counts `.` and `:` as extension characters, so the flat compound selectors were offences once the file came off the pending list. The flat selectors the nesting produces are the same ones the flat rules had, so the compiled CSS is unchanged in selector and specificity."
  - "The panes' `.status.hidden` nests as `&.hidden` under `.status` for the same G6b reason, and the clip block STAYS LOCAL under its own name (D-02): the shared clip name is `visually-hidden`, and a clip block under any other name stays local. Its `margin: -1px` stays legal because the same rule declares `clip`."
  - "The three panes' local `.body`, `.caption` and `.error` are DELETED, not tokenised, for the reason plan 14-16 recorded: the shared rules declare the same values and a scoped local copy would outrank the shared one. The markup keeps `class=\"body\"`, `class=\"caption\"` and `class=\"body error\"`, so the e2e locators on `p.body`, `p.caption` and `p.body.error` resolve exactly as before."
  - "The panes' `button:hover` and `button:focus-visible` nest as `&:hover` and `&:focus-visible` under `button`. G6b counts `:` as an extension character, and the compiled selectors (`button.svelte-XXXX:hover`, `button.svelte-XXXX:focus-visible`) are the ones the flat rules produced."
  - "The font-size sweeps RESOLVE the tokens before they read them and REQUIRE a non-empty match. The raw source of the migrated files matches `font-size: Npx` ZERO times - a raw-source probe confirms it - so a reader that did not resolve would have found nothing and asserted nothing. The sweep now resolves, requires at least one match, and checks each size against `SCALE_PX`."
  - "The focus-ring assertion reads the SHARED utility AND requires the table markup to carry `class=\"scroller\"`. Reading the ring from `src/styles/utilities.css` alone would pass even if the component stopped using the shared class, and asserting the class alone would pass even if the shared rule lost the ring. Both are asserted, so neither regression can hide."
  - "The three status-colour allow-list entries keep `DeviceInfo.svelte` (plan 14-18's file). An entry that loses its last file is deleted whole, and none of the three did - each still names the device-info file that owns the hexes."
  - "`perks-pane.test.ts` needed NO change. Its only CSS assertion - the pane declares no custom property - still holds and was never vacuous: `var(--space-16)` is a USE of a token, not a declaration, and the pattern `--name:` does not match it. The plan's action for that file was \"fix only what the run shows broken\", and the run showed nothing broken."

patterns-established:
  - "A literal-CSS assertion keeps its MEANING when the source changes form by reading the RESOLVED value: `ruleDeclarations` finds the rule by selector (so a nested block does not hide it and a rule that moved does not silently stop answering) and `resolveTokens` turns `var(--space-16)` back into the `16px` it stands for."
  - "A sweep over a tokenised file needs BOTH halves: the resolution, so the match is not empty, and the non-empty check, so the sweep cannot pass on nothing. The first alone is a sweep that measures the migration instead of the size."

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-13]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "The new-data card, table and three panes are token-based and swept: the five files define none of .body, .caption, .error, .scroller or .visually-hidden, hold no hex literal, and are off PENDING_FILES and the status-colour entries of ALLOWED_COLOUR_LITERALS."
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/new-data tests/unit/guards - 30 files, 622 tests, all pass (the plan's Task 1 and Task 2 verify)"
        status: pass
      - kind: unit
        ref: "pnpm run test:unit - 164 files, 4899 passed, 9 expected fail, 0 failed"
        status: pass
      - kind: other
        ref: "the gated rules applied directly to the five files (tests/helpers/token-guards.ts): 0 offenders each for font, spacing, colour, shared-name, declaration-line, nesting and inline-style rules; and the compiled bundle dist/assets/index-BlfJc6F0.css: .caption, .body, .error, .scroller and .visually-hidden each appear once as a GLOBAL rule and in no new-data scope"
        status: pass
    human_judgment: false
  - id: D2
    description: "The card's caption is the shared .caption plus the under-title hook, and the table's scroll region is the shared .scroller plus the table-scroll hook - the two artifacts this plan declares."
    verification:
      - kind: unit
        ref: "grep -c \"under-title\" src/lib/features/new-data/NewDataCard.svelte - 2 and grep -c \"table-scroll\" src/lib/features/new-data/NewDataTable.svelte - 2 (the plan's Task 1 acceptance criterion)"
        status: pass
      - kind: other
        ref: "compiled bundle dist/assets/index-BlfJc6F0.css: .under-title.svelte-1lwebkl{margin-top:calc(var(--space-4) * -1)} and .table-scroll.svelte-d7a66f{border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--page);max-height:480px;position:relative}, beside the single global .scroller{isolation:isolate;min-width:0;overflow:auto}"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every literal-CSS assertion of new-data-blocks.test.ts keeps its meaning after the source changed form: the card chrome, the 40px rows, the focus ring on the shared scroller, the dl grid, the dt weight and colour, the account-tag margin and the caption's muted ink."
    verification:
      - kind: unit
        ref: "tests/unit/new-data/new-data-blocks.test.ts - the 'draws a skipped card with a dashed --faint border on a --list fill', 'sticks the header row and the first column', 'draws every row at a fixed 40px', 'is a named, focusable scroll region', 'shows a From {file} caption' and 'builds the blocks layout' cases all pass, each reading its rule through ruleDeclarations and resolveTokens"
        status: pass
      - kind: other
        ref: "the shared ring is asserted on src/styles/utilities.css AND the table markup is asserted to carry class=\"scroller table-scroll\", so a lost ring and a lost class each fail on their own"
        status: pass
    human_judgment: false
  - id: D4
    description: "The font-size sweep cannot pass on an empty match: it resolves the tokens, requires at least one size, and checks every size against SCALE_PX."
    verification:
      - kind: unit
        ref: "the sweep was pointed at an empty string once and FAILED as required (2 failed: 'NewDataTable.svelte declares at least one font-size: expected 0 to be greater than 0', same for NewDataCard), then reverted; the reverted file is byte-identical to the committed one"
        status: pass
      - kind: other
        ref: "raw-source probe over the migrated files: the OLD raw loop `font-size:\\s*(\\d+(?:\\.\\d+)?)px` matches ZERO times in NewDataCard.svelte and in NewDataTable.svelte, so a reader that did not resolve the tokens would have asserted nothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "The HEAT, Perks, Warships and storage panes render as before: all twelve captured pairs (three panes at 1280, 900, 899 and 375px) are byte-identical, and each pane's table is still its focal element."
    verification:
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/shell/new-data-panes.spec.ts tests/e2e/shell/account-timeline-perks.spec.ts - 5 tests, all pass (27.8s)"
        status: pass
      - kind: other
        ref: "scratch capture sets at $TMPDIR/wg-phase14: before-14-17 (the pre-plan commit 97268d6 build) against after-14-17 - 12 of 12 pairs byte-identical (differing=0, box=none) at 1280, 900, 899 and 375px for the heat, perks and warships-storage panes"
        status: pass
    human_judgment: true
    rationale: "A pixel comparison proves the panes did not move; it cannot prove the reader still reads them as the same information. The screenshots were reviewed by eye for the last part - each pane's table is still the focal element and the card titles still read as titles."

# Metrics
duration: 32min
completed: 2026-10-27
status: complete
---

# Phase 14: Design Unification Summary

**The new-data card and table and the three optional game-data panes moved onto the token layer — the shared `.scroller` now owns the table's scroll region, the shared `.caption` and `.body` and `.error` own the card's and the panes' text blocks, and the literal-CSS assertions read resolved values instead of source text, with all twelve captured panes byte-identical to the pre-plan build**

## Performance

- **Duration:** 32 min
- **Started:** 2026-10-27T23:26:00+04:00
- **Completed:** 2026-10-27T23:58:00+04:00
- **Tasks:** 2
- **Files modified:** 10 (9 code + this summary)

## Accomplishments

- `NewDataCard.svelte`, `NewDataTable.svelte`, `HeatPane.svelte`, `PerksPane.svelte` and `WarshipsStoragePane.svelte` are token-based and off `PENDING_FILES`, so the design-token guard (G1/G3/G4/G5/G6) and the nesting guard now sweep them. No hex literal survives in any of the five, and none of them defines `.body`, `.caption`, `.error`, `.scroller` or `.visually-hidden`.
- The three shared names — `.body`, `.caption` and `.error` — are defined in none of the five files. The shared blocks of `src/styles/utilities.css` serve the existing markup, so the e2e locators on `p.body`, `p.caption` and `p.body.error` need no edit and resolve exactly as before.
- The table's scroll region is the **shared `.scroller`** with a local `table-scroll` hook beside it. The shared rule keeps `min-width: 0`, `overflow: auto`, `isolation: isolate` and the focus ring; the hook keeps the box the table owns. The compiled bundle carries one global `.scroller{isolation:isolate;min-width:0;overflow:auto}` and one `.scroller:focus-visible{outline:3px solid var(--focus);outline-offset:2px}`, and no new-data scope declares either.
- The card's caption is the **shared `.caption`** plus a local `under-title` hook whose only declaration is `margin-top: calc(var(--space-4) * -1)` — the original `-4px 0 0`, with the shared rule's `margin: 0` supplying the rest. The compiled hook is `.under-title.svelte-1lwebkl{margin-top:calc(var(--space-4) * -1)}`.
- The three panes' destructive chrome is gone with the local copies: the shared `.error` reads `--danger`, `--danger-bg` and `--danger-ink`, every 6px radius reads `--radius-sm`, and the panes' `.status` and `.reveal-row` read the type and spacing tokens.
- The literal-CSS assertions of `new-data-blocks.test.ts` now read their rules through `ruleDeclarations` and resolve them through `resolveTokens`, so the card chrome (`padding: 16px`, `gap: 8px`, `border-radius: 8px`), the 40px rows, the `dl` grid (`gap: 4px 16px`), the `dt` weight and colour, the account-tag margin and the caption's muted ink all still state the same fact.
- The **font-size sweep can no longer pass on nothing.** It resolves the tokens, requires at least one match, and checks every size against `SCALE_PX`. The probe is concrete: the OLD raw-source loop matches `font-size: Npx` **zero times** in both migrated files, and pointing the new sweep at an empty string makes it fail.
- The focus ring is asserted on the **shared utility** and the table markup is asserted to **carry the class**, so a ring that disappeared from `utilities.css` and a component that stopped using `.scroller` each fail on their own.
- All twelve captured panes — heat, perks and warships-storage at 1280, 900, 899 and 375px — are **byte-identical** to the pre-plan build. This plan moves no pixel.

## Task Commits

Each task was committed atomically:

1. **Task 1: NewDataCard and NewDataTable, with new-data-blocks.test.ts moved onto the helpers** - `c83a12c` (refactor)
2. **Task 2: HeatPane, PerksPane, WarshipsStoragePane** - `ff73c07` (refactor)

**Plan metadata:** `14-17-SUMMARY.md` (docs: complete plan)

## Files Created/Modified

- `src/lib/features/new-data/NewDataCard.svelte` - the card around every new-data table. Its local `.caption` and `.body` are deleted for the shared ones; the caption element is `<p class="caption under-title">` and the new `.under-title` hook states only the negative top margin. `.card`, `.card.skipped` (nested as `&.skipped`), `h3`, `.block`, `dl`, `dt`, `dd` and `.tag-line` read the type, spacing and radius tokens.
- `src/lib/features/new-data/NewDataTable.svelte` - the shared table. The local `.scroller`, its `:focus-visible` rule and the local `.visually-hidden` are deleted; the new `.table-scroll` hook keeps the box (position, the 480px cap, the border, the radius, the background). `th`, `td`, `tbody tr`, the sticky and number states and the tag margin read the tokens.
- `src/lib/features/new-data/HeatPane.svelte` - the HEAT pane. Its local `.body`, `.caption` and `.error` are deleted for the shared ones; `.block`, `.status` (with the `&.hidden` clip block nested), `.reveal-row` and `button` (with `&:hover` and `&:focus-visible` nested) read the tokens.
- `src/lib/features/new-data/PerksPane.svelte` - the Perks pane. The same three shared names are deleted and the same rules are tokenised and nested.
- `src/lib/features/new-data/WarshipsStoragePane.svelte` - the Warships and storage pane. The same three shared names are deleted; `.block` and `.status` (with the nested clip block) read the tokens.
- `tests/unit/new-data/new-data-blocks.test.ts` - the card and table reader. The local `ruleBody` regex helper is replaced by `ruleDeclarations(styleText(source), selector)` plus `resolveTokens`, and the font-size sweep resolves the tokens, requires a non-empty match and checks `SCALE_PX`.
- `tests/unit/new-data/new-data-panes.test.ts` - the pane reader. Its per-file font-size test resolves the tokens, keeps the non-empty check and checks `SCALE_PX` instead of the literal list of four.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - the phase-8 UI review guard. The three status-colour allow-list entries no longer name the three migrated panes.
- `tests/helpers/migration.ts` - `PENDING_FILES` no longer lists the five migrated files.

## Decisions Made

- **The card's caption states only the difference.** The shared `.caption` already declares `margin: 0` and the muted ink, so the card's local hook declares `margin-top: calc(var(--space-4) * -1)` and nothing else. The hook is scoped, so its specificity (0,2,0) outranks the shared rule's (0,1,0) and the rendered margin is the same -4px.
- **The card's `h3` takes no role.** It is a CARD title, not a pane title, and the UI-SPEC's Allowed Visible Changes list names only the pane titles. No role's triple is 14/600/1.4 either, so the heading is tokenised, not re-roled.
- **The table's scroll region is shared plus a local hook.** The shared `.scroller` supplies the region and the focus ring; `.table-scroll` supplies the box. The two sets of declarations do not overlap, so the compiled element is the same as before.
- **The compound and state selectors are nested.** `th.num, td.num` split into `&.num` under `th` and under `td`; `td.sticky-first` and `th.sticky-first` nest under their element; the panes' `.status.hidden` nests as `&.hidden`; the panes' `button:hover` and `button:focus-visible` nest under `button`. G6b counts `.` and `:` as extension characters, so the flat rules were offences once the files came off the pending list, and the nesting produces the same flat selectors the flat rules had.
- **The shared names are DELETED, not tokenised.** Same reason as plan 14-16: the shared rules declare the same values, and a scoped local copy would outrank the shared one.
- **The clip blocks stay local.** The shared clip name is `visually-hidden`, and a clip block under any other name stays local (D-02). The panes' `margin: -1px` stays legal because the same rule declares `clip`.
- **The focus ring is asserted twice, in two places.** On the shared utility (so the ring cannot vanish) and on the markup's class (so the component cannot stop using it). Either alone would allow the other regression.
- **The font-size sweep resolves AND requires a match.** The resolution keeps the sweep meaningful; the non-empty check keeps it honest.
- **`perks-pane.test.ts` needed no change.** Its only CSS assertion — the pane declares no custom property — still holds and was never vacuous: `var(--space-16)` is a use of a token, not a declaration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Convention] The temporary Playwright config was written outside the repository, with absolute paths**
- **Found during:** Task 2 (the e2e run)
- **Issue:** The established temporary config (`playwright.config.tmp-14-14.ts`, `playwright.config.tmp-14-10.ts`) is a STANDALONE file that resolves `testDir: 'tests/e2e'` and the webServer command against its OWN directory, so it only works from inside the repository — the previous plans wrote it into the repo root and moved it out afterwards. Copying it to `$TMPDIR` verbatim fails: Playwright cannot resolve `@playwright/test` from outside the repo, and `testDir` and the webServer's working directory would point at the scratch folder.
- **Fix:** The temporary config was written to `$TMPDIR/wg-phase14/playwright.tmp-14-17.config.ts` with an ABSOLUTE `@playwright/test` import, an ABSOLUTE `testDir` and an explicit `webServer.cwd` pointing at the repository. Nothing was written into the repository at all.
- **Files modified:** none in the repository — the config is a scratch artifact outside it
- **Verification:** `pnpm exec playwright test --config $TMPDIR/wg-phase14/playwright.tmp-14-17.config.ts tests/e2e/shell/new-data-panes.spec.ts tests/e2e/shell/account-timeline-perks.spec.ts` — 5 tests, all pass; `git diff --stat playwright.config.ts` is empty and no temporary file is committed.
- **Committed in:** n/a — nothing in the repository changed

**2. [Rule 1 - Convention] The screenshot capture went into its own labelled pair**
- **Found during:** Task 2 (the scratch capture step)
- **Issue:** The plan's action says to run the scratch `shots --label after` and compare with `before`, but the dispatch brief states that the shared `before`/`after` capture sets are stale for the current build and must not be clobbered. The harness's own `compare` subcommand reads the fixed `before`/`after` directories, so a labelled pair needs a labelled compare.
- **Fix:** The pre-plan state was captured into `$TMPDIR/wg-phase14/before-14-17/` and the post-plan state into `$TMPDIR/wg-phase14/after-14-17/`, both from the same harness, the same widths and the same panes, and a scratch `compare-labelled-14-17.mjs` (outside the repository, reusing the harness's pixel comparison) compared the two labelled sets. The shared sets were not touched.
- **Files modified:** none — the captures are scratch, outside the repository
- **Verification:** all 12 pairs (1280, 900, 899, 375px × heat, perks, warships-storage) report `differing=0 box=none`.
- **Committed in:** n/a — nothing in the repository changed

---

**Total deviations:** 2 (2 scratch-artifact conventions, both outside the repository)
**Impact on plan:** Neither changes what the plan asked for. The first is where a temporary file is written; the second is the labelling of a scratch capture the brief explicitly redirected. The plan's own acceptance criteria are met by both.

## Issues Encountered

- **A stale `vite preview` holds port 4173.** The committed `playwright.config.ts` sets `reuseExistingServer: false`, so Playwright cannot start its own server there and would have tested the STALE build. The temporary config moved the base URL and the webServer to the free port 4174. `playwright.config.ts` is untouched and no temporary file is committed.
- **The known pre-existing starvation flake in `tests/unit/overview/overview-grid.test.ts` did NOT fire in this plan.** The full suite passed on its first run (164 files, 4899 passed, 9 expected fail, 0 failed), so no re-run and no scratch worktree were needed. The file is in no plan's `files_modified` list and the timeout was not raised.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The new-data group is swept by the token and nesting guards, so the remaining pending files are the ones the phase has not reached yet: the account-timeline pair, the device-info pair and the five Overview files (plans 14-18 to 14-20).
- The two sets of scratch captures (`before-14-17` and `after-14-17`) are kept for UAT. They are the pre-plan and post-plan states of this plan; a later plan comparing against the phase `before` baseline is comparing against a set the brief records as stale.
- The two artifacts this plan declares — the `under-title` class on the card's caption and the `table-scroll` class on the table's box — are now in the codebase and are the shared shape the remaining panes can take.
- Open items this plan did NOT touch (they are outside its file list, so they are reported rather than edited): `tests/e2e/_support/helpers.ts:541` (says the stat tile numerals are 30px), `tests/e2e/shell/master-detail-nav.spec.ts:72` (comment names the retired 30), `tests/unit/device-info/device-info-blocks.test.ts:143` (hard-coded `['14','18','26','30']` superset), `src/lib/features/logins/map-model.ts:36` (still says "ramp" in prose).
- Plan 14-14's flagged judgement call for the owner is unchanged and still open: the neutral `.info` box border was kept at `var(--border)` rather than `var(--faint)`, because the UI-SPEC's Allowed Visible Changes list names only the 4px toggle gap. This plan did not act on it.

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
