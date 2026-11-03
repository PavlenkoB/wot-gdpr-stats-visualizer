---
phase: 14-design-unification
plan: 12
subsystem: ui
tags: [css, tokens, shared-names, status-tokens, migration, city-opt-in]

# Dependency graph
requires:
  - phase: 14-design-unification (plan 14-06)
    provides: "the shared .caption/.body/.error utilities in src/styles/utilities.css that carry the text block and the destructive box"
  - phase: 14-design-unification (plan 14-10)
    provides: "the migrated playtime pane, whose button and heading rules are the model for the two files here"
  - phase: 14-design-unification (plan 14-11)
    provides: "the migrated first half of the logins pane and the phase-8 guard that now pins 30px as illegal"
provides:
  - "CityOptIn defines none of .body, .caption or .error: the destructive line is class=\"body error\" and the two neutral lines are class=\"body info\", with a local .info rule that states the neutral chrome only"
  - "CityOptIn holds no hex literal at all, and its script region is byte-identical to the pre-phase baseline"
  - "LoginHistory's local .body, .caption and .error are gone: the shared classes serve the existing markup and the clip block keeps its name, nested under .status"
  - "the logins folder is entirely on the token layer and off PENDING_FILES"

# Actuals (#2632) - pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 3365
  tasks: 1
  commits: 1
plan_head_before: 3c370abe86633383d26575ab94998eb85466dab3
plan_head_after: d902f6a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A box is a SHARED utility plus a local hook: the destructive error is the shared .error, and the neutral info keeps a local .info rule that states only the chrome (padding, border, radius, surface, ink)"
    - "A vendor pseudo-element nests under its element: `progress { &::-webkit-progress-bar { ... } }`, because a pseudo-element rule extends its element's rule and the D-05 guard requires the child to be nested"
    - "The ORDER of two equally specific rules is load-bearing: the bar inside the row has the same specificity as the bare `progress` rule, so the rule that comes last wins - the `progress` rule therefore comes FIRST and the `.bar-row` rule after it"

key-files:
  created: []
  modified:
    - "src/lib/features/logins/CityOptIn.svelte"
    - "src/lib/features/logins/LoginHistory.svelte"
    - "tests/helpers/migration.ts"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"

key-decisions:
  - "The dead .count hook is deleted with its class, not tokenised: the local .caption rule came AFTER it in the same scope, so it won the cascade and the hook had no effect since Phase 6. Deleting the local .caption - which the plan requires - would have made the hook live for the first time and moved the count line from muted 400 to --text 600, a visible change the UI-SPEC's Allowed Visible Changes list does not allow and the plan's <done> forbids"
  - "The same class pair renders differently in two panes: the vehicles pane (PlayerStats.svelte, plan 14-14's file) carries the same class=\"caption count\" markup but its .count rule comes FIRST and is alive, so ITS count line is 600/--text while the logins count line is 400/--muted. The owner may want to decide whether the logins count line should be emphasised too; that is a design decision, not a CSS migration"
  - "CityOptIn's script region is untouched, and that is proved rather than asserted: the region between <script and </script> is byte-identical to the pre-phase baseline commit 901a9e1, and the diff of that region is empty"

patterns-established:
  - "Pattern: a local rule that shadows a shared one is DELETED, and if it was shadowing a hook too, the hook's dead state is resolved in the same commit - the pixels are the contract, not the hook's intent"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-07, D-13]

# Coverage metadata (#1602) - one entry per shipped deliverable.
coverage:
  - id: D1
    description: "CityOptIn's text blocks come from the shared layer: the error line is class=\"body error\", the two neutral lines are class=\"body info\", and the local .info rule states the neutral chrome only"
    requirement: D-01
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/logins tests/unit/charts tests/unit/guards -> 37 files, 976 passed (both files are off PENDING_FILES and the G1, G3, G4, G5, G6a and G6b sweeps are clean)"
        status: pass
      - kind: other
        ref: "grep -c 'class=\"body error\"' src/lib/features/logins/CityOptIn.svelte -> 2; grep -c 'class=\"body info\"' -> 2; grep -n '#[0-9a-fA-F]{3,8}|rgba(|hsl(' -> no hex literal in either file"
        status: pass
    human_judgment: false
  - id: D2
    description: "CityOptIn's script region is untouched: the app's single sanctioned same-origin request is byte-identical to the pre-phase baseline"
    requirement: D-07
    verification:
      - kind: other
        ref: "the region between <script and </script> in CityOptIn.svelte is byte-identical to commit 901a9e1 (217 lines both, string equality true), and the diff of that region against the baseline is empty"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/logins tests/e2e/guards/zero-network.spec.ts -> 40 passed (the zero-network spec walks the Phase 6 flows with the city opt-in never pressed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "LoginHistory's local .body, .caption and .error are gone; the shared classes serve the existing markup, the clip block keeps its name, and every size, weight, line height, gap and padding is a token"
    requirement: D-01
    verification:
      - kind: unit
        ref: "pnpm run test:unit -> 164 files, 4899 passed, 9 expected fail"
        status: pass
      - kind: other
        ref: "built CSS: .status.svelte-1r9dqb3.hidden keeps the (0,3,0) specificity of the old .status.hidden rule, and no .body/.caption/.error/.count rule is emitted for the component"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both files are nested where a parent rule exists and token-based throughout"
    requirement: D-05
    verification:
      - kind: unit
        ref: "the nesting-guard compile sweep compiles both migrated components and reports no unused selector; the direct offender call (fontOffenders, spacingOffenders, colourOffenders, sharedNameOffenders, declarationLineOffenders, nestingOffenders) returns [] for each file"
        status: pass
      - kind: other
        ref: "pnpm run lint && pnpm run check && pnpm run build -> all exit 0 (prettier clean, eslint clean, 0 errors and 0 warnings, built)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The visible result is unchanged: every measured pixel of the pane's text blocks and of the city opt-in's three states is identical before and after"
    requirement: D-13
    verification:
      - kind: other
        ref: "computed-style probe before and after ($TMPDIR/wg-phase14/probe-14-12.mjs, scratch, outside the repository): 13 elements x 11 properties, 0 differences. The count line is 14px/400/19.6px/rgb(92,92,92) in both; the error box is 8px 12px padding, 6px radius, rgb(252,232,230) on rgb(197,34,31) in both; the info box is rgb(245,245,245) on rgb(140,140,140) in both"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test tests/e2e/logins tests/e2e/guards/zero-network.spec.ts -> 40 passed"
        status: pass
    human_judgment: false

# Metrics
duration: 27min
completed: 2026-10-27
status: complete
---

# Phase 14 Plan 12: Login history, second half - the city opt-in and the history blocks

**The login-history pane is entirely on the token layer: the city opt-in's messages are the shared text blocks with the shared destructive box, the history block's own rules are tokens and nested, and not one pixel of either pane moved**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-27T19:45:00+04:00
- **Completed:** 2026-10-27T20:12:00+04:00
- **Tasks:** 1
- **Files modified:** 4 (exactly the plan's `files_modified` list)

## Accomplishments

- `CityOptIn.svelte` defines none of `.body`, `.caption` or `.error` any more. The destructive line is `class="body error"` and the two neutral lines are `class="body info"`; the shared `.error` utility carries the destructive box and a local `.info` rule carries the neutral one, stating only the chrome. The file holds no hex literal at all.
- `CityOptIn.svelte`'s script is untouched, and that is proved rather than asserted: the region between `<script` and `</script>` is byte-identical to the pre-phase baseline commit `901a9e1` (217 lines in both, string equality true), and the diff of that region is empty. The app's single sanctioned same-origin request is exactly where it was.
- `LoginHistory.svelte` loses its local `.body`, `.caption` and `.error`; the shared classes serve the existing `class="body"`, `class="caption"` and `class="body error"` markup, and the clip block keeps its name as `&.hidden` nested under `.status`. Every size, weight, line height, gap, padding and radius is a token.
- Both files are nested per D-05: the three vendor pseudo-element rules nest under `progress`, the bar-inside-the-row rule nests under `.bar-row`, the button's `:hover` and `:focus-visible` nest under `button`, and the clip block nests under `.status`.
- The order of the two equally specific progress rules is preserved on purpose. `.bar-row progress` and the bare `progress` rule have the same specificity, so the one that comes last wins; `progress` therefore comes first and `.bar-row` after it, and the bar inside the row is still `flex: 1 1 160px`, centred, not full width.
- The two files leave `PENDING_FILES`, and the three status-colour entries in the phase-8 guard lose them. The allowlist is shorter by two entries.
- **Not one pixel moved.** A computed-style probe of thirteen elements across the pane and the city opt-in's three states, before and after, measured eleven properties each and found zero differences.

## Task Commits

| Task | Commit | Subject |
|---|---|---|
| Task 1 | `d902f6a` | refactor(14-12): the city opt-in and the history block take the shared text blocks |

## Files Created/Modified

| File | Change |
|---|---|
| `src/lib/features/logins/CityOptIn.svelte` | The grouped `.body, .info, .error` rule and the local `.caption` are deleted; the error line is `class="body error"` and the two neutral lines are `class="body info"`; the local `.info` rule keeps the neutral chrome only; `h4`, `div`, `.bar-row`, `progress` and `button` are tokens; the three vendor pseudo-element rules, the bar-inside-the-row rule and the button's two states are nested; the script region is untouched |
| `src/lib/features/logins/LoginHistory.svelte` | The local `.body`, `.caption` and `.error` are deleted for the shared classes; the clip block keeps its name and nests under `.status`; the dead `.count` hook and its class are deleted; `div`, `h3`, `.status`, `.reveal-row`, `button`, `.table-section`, `.city-section` and `h4` are tokens; the button's two states nest under `button` |
| `tests/helpers/migration.ts` | The two files leave `PENDING_FILES` |
| `tests/unit/guards/phase8-ui-review-guards.test.ts` | The two files leave the three status-colour entries (`#c5221f`, `#fce8e6`, `#8a1c17`); the 30px self-test plan 14-11 added is left as it is |

## Decisions Made

- **The dead `.count` hook is deleted with its class, not tokenised.** The local `.caption` rule came AFTER `.count` in the same scope, so with equal specificity it won the cascade: the count line has rendered as a plain caption - 14px / 400 / muted - since Phase 6, and the hook has had no effect at all. Deleting the local `.caption`, which the plan requires, would have made the hook live for the first time and moved the count line to 600 / `--text`. The UI-SPEC's Allowed Visible Changes list is complete ("any other pixel change is a regression") and the plan's own `<done>` says the only visible changes are the numerals, the heat colours and the title, so the dead hook goes with its class and the count line keeps the pixels it has today. See Deviations.
- **The same class pair renders differently in two panes, and that is a finding, not a change.** `src/lib/features/vehicles/PlayerStats.svelte` - plan 14-14's file - carries the same `class="caption count"` markup, but there the `.count` rule comes FIRST and is alive, so the vehicles count line is 600 / `--text` while the logins count line is 400 / `--muted`. The owner may want to decide whether the logins count line should be emphasised to match; that is a design decision, and it needs the Allowed Visible Changes list to say so first. It is reported, not edited: `PlayerStats.svelte` is in no plan's `files_modified` list, and this plan's scope is the logins folder.
- **The destructive box is the shared `.error` utility, not a local copy.** The deleted local rule's values were `#c5221f` / `#fce8e6` / `#8a1c17` with an 8px 12px padding and a 6px radius; the shared utility carries `--danger` / `--danger-bg` / `--danger-ink` with `var(--space-8) var(--space-12)` and `var(--radius-sm)`, and the tokens hold exactly those three values. The rendered box is identical, which the probe confirms, and there is now one error red in the app instead of two.
- **The `.info` chrome stays local, and states only the chrome.** The neutral box has no shared counterpart, so the rule keeps the padding, border, radius, surface and ink; the text block itself comes from the shared `.body`. The scoped `.info` rule has the higher specificity, but it states no property the shared `.body` states differently, so the two agree.
- **`progress` comes before `.bar-row` in the style block.** The bare `progress` rule and `.bar-row progress` have the same specificity, so the cascade decides by order, and the bar inside the row must win. The old file had them as two sibling rules in that order; nesting the second under `.bar-row` would have moved it earlier and handed the bar back its full width, so the blocks were reordered to keep the emitted order identical. The rule says so in a comment.
- **No pixel compare was run.** The harness's `compare` subcommand reads the shared `before/` and `after/` sets, which are stale for this build, and overwriting them would have changed scratch state a later plan depends on. The computed-style probe below is the targeted substitute: it reads the rendered values of the exact elements this plan moves, which is what the plan's change actually touches.

## Deviations from Plan

**1. [Rule 3 - Interpretation] The dead `.count` hook is deleted with its class, rather than tokenised as the plan's "and the rest" reads.**
- **Found during:** Task 1
- **Issue:** The plan's action says to tokenise "`h3`, `h4`, `button` with its nested states and the rest", and `.count` is one of "the rest". The literal reading keeps the hook and swaps its values for tokens - but the hook is dead: the local `.caption` rule came after it in the same scope, so with equal specificity it won the cascade, and the count line has rendered as a plain caption since Phase 6. The plan's action and the plan's own `<done>` ("the only visible changes are the numerals, the heat colours and the title") therefore contradict each other for this one rule, and the UI-SPEC's Allowed Visible Changes list is complete.
- **Fix:** The hook and the `count` class are deleted together. The count line keeps exactly the pixels it has today and reads from the shared `.caption`, and the trap is gone: nobody can now reorder two rules and silently change the count line.
- **Files modified:** `src/lib/features/logins/LoginHistory.svelte`
- **Commit:** `d902f6a`

## Issues Encountered

- **A stale `vite preview` holds port 4173** and serves a build from before this plan, so the committed Playwright config's `reuseExistingServer: false` cannot start its own server there and Playwright would silently test the stale build. Every e2e run went through a temporary config in the repo root that moved `use.baseURL` and `webServer` to the free port 4174. The temporary file was moved out of the repository after the last run and was never committed; `playwright.config.ts` itself was not touched.
- **`tests/unit/overview/overview-grid.test.ts` did not flake.** The known starvation flake at the repo's 20 s `testTimeout` under full-suite load did not appear: the full unit suite ran 164 files / 4899 passed / 9 expected fail.
- **The plan's file list was complete.** All four files the plan lists were the four files changed; the phase-8 guard that plan 14-11 edited outside its own list is in this plan's list, so it was extended here (two entries removed from each of the three status-colour lists) rather than reverted.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The logins folder is fully migrated.** `LoginSummary`, `LoginMapSection`, `LoginTable`, `CityList`, `CountryList`, `LoginHistory` and `CityOptIn` are all on the token layer and off `PENDING_FILES`; no component in the folder defines `.body`, `.caption`, `.error` or holds a hex literal.
- **The count line's design question is open and belongs to the owner.** See "Decisions Made": the logins count line is muted and the vehicles count line is emphasised, from the same class pair.
- **The next plan in the phase (14-13) owns the vehicles table**, whose `VehicleTable.svelte` still has its own local `.scroller` rule.

## Open Items

- **The logins count line and the vehicles count line look different, from the same markup.** `src/lib/features/logins/LoginHistory.svelte` had a dead `.count` hook (deleted by this plan) and `src/lib/features/vehicles/PlayerStats.svelte` has a live one, so `class="caption count"` renders 400 / `--muted` in the logins pane and 600 / `--text` in the vehicles pane. Whether the logins count line should be emphasised is a design decision the owner should make; if it is, it belongs in the UI-SPEC's Allowed Visible Changes list first. `PlayerStats.svelte` is in no plan's `files_modified` list, so nothing was edited outside this plan's scope.
- **`tests/e2e/_support/helpers.ts:541` - the R10 comment still says the stat tile numerals are 30px on desktop.** False for BOTH panes since 14-10 and 14-11. That file is in neither this plan's nor any other plan's `files_modified` list, so it was carried, not edited - the same treatment 14-09 gave `map-model.ts:36`.
- **`tests/e2e/shell/master-detail-nav.spec.ts:72` - the comment "Every other pane is held to the shared 14 / 18 / 26 / 30px scale alone"** still names the retired 30. The code is correct (`BASE_SCALE` is built from `SCALE_PX`), so this is stale wording only. Not in this plan's `files_modified` list.
- **`tests/unit/device-info/device-info-blocks.test.ts:143` - `expect(['14', '18', '26', '30']).toContain(size)`** is a hard-coded superset of the scale. It passes (it only asserts membership) and `DeviceInfo.svelte` is still pending, but the list should shrink to the six sizes when that file is migrated.
- **`src/lib/features/logins/map-model.ts:36` and `src/lib/charts/FlowLegend.svelte` still say "ramp" in prose.** Neither holds a `--ramp-` token, so no guard is affected; these are stale WORDING. Carried from 14-09 and 14-11; the plan that migrates each file should correct the wording in the same commit.
- **The shared scratch `after/` capture set is stale for this build.** It was last written by plan 14-10 and does not contain this plan's changes. It was deliberately NOT overwritten, because the harness's `compare` subcommand reads the shared `before/` and `after/` directories and a later plan may depend on them. A later plan that compares the logins pane against the phase `before` baseline must read the `before` set as the PRE-PHASE baseline and the `after` set as captured WITH the harness's settle wait - a loading-state difference is an artefact, not a regression.

## Self-Check: PASSED

- Every file the plan declares exists and is committed: `git diff --name-only 3c370ab..d902f6a` lists exactly the plan's four files - `src/lib/features/logins/CityOptIn.svelte`, `src/lib/features/logins/LoginHistory.svelte`, `tests/helpers/migration.ts`, `tests/unit/guards/phase8-ui-review-guards.test.ts`. `git status --porcelain` is empty and the temporary Playwright config is out of the repository.
- The task commit is an ancestor of HEAD: `d902f6a`, measured from `3c370ab`.
- Every acceptance criterion was run by hand: `grep -c 'class="body error"' src/lib/features/logins/CityOptIn.svelte` prints 2 and `grep -c 'class="body info"'` prints 2; the region between `<script` and `</script>` in `CityOptIn.svelte` is byte-identical to commit `901a9e1` and the diff of that region is empty; `grep -n '#[0-9a-fA-F]{3,8}|rgba(|hsl('` over both files returns nothing.
- Both plan verify commands were run by hand against the current tree: `pnpm run test:unit && pnpm run lint && pnpm run check && pnpm run build` -> 164 files / 4899 passed / 9 expected fail, prettier clean, eslint clean, 0 errors and 0 warnings, built; `pnpm exec vitest run tests/unit/guards/fetch-scan.test.ts` -> 1 file, 7 passed; `pnpm exec playwright test tests/e2e/logins tests/e2e/guards/zero-network.spec.ts` -> 40 passed (42.0s).
- The focused suites were run too: `pnpm exec vitest run tests/unit/logins tests/unit/charts tests/unit/guards` -> 37 files, 976 passed. The two files are off `PENDING_FILES` and a direct call to the six offender functions returns `[]` for each of them.
- The value of the change was measured in the browser, not assumed: the computed-style probe (`$TMPDIR/wg-phase14/probe-14-12.mjs`, scratch, outside the repository) read thirteen elements x eleven properties before and after the change and found ZERO differences - the count line is 14px / 400 / 19.6px / rgb(92,92,92) in both, the error box is 8px 12px padding with a 6px radius, rgb(252,232,230) on rgb(197,34,31) in both, and the info box is rgb(245,245,245) on rgb(140,140,140) in both. The only differences are the class attributes the migration is about.

---

*Phase: 14-design-unification*
*Completed: 2026-10-27*
