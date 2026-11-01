---
phase: 15-tech-debt-cleanup
plan: 03
subsystem: ui
tags: [css, shell, guards, vitest, style-equality]

requires:
  - phase: 15-tech-debt-cleanup
    provides: the style-equality harness and SHARED_STYLE_HOMES (plan 15-01)
provides:
  - "src/styles/shell.css: the master-detail layout and THE one phone block, text unchanged"
  - "src/app.css reduced to element and page-level resets (no media query, no .shell / .pane-*)"
  - "readShellSource() and shellHomeName() in tests/helpers/styles.ts, the one reader for the shell stylesheet"
  - "Guard G5 narrowed from all of src/styles/ to SHARED_STYLE_HOMES (type.css, utilities.css)"
affects: [15-04, 15-13]

actuals:
  tokens: 9500
  tasks: 3
  commits: 3
plan_head_before: 3351c1972b8be66998ff72508d786852301ae485
plan_head_after: a0e9117db535f01ccc12b39ab3035221a7a2b333

tech-stack:
  added: []
  patterns:
    - "Repoint every reader through a transitional helper first (fallback to the old file), move the CSS second, remove the fallback in the move commit: every commit is green"

key-files:
  created:
    - "src/styles/shell.css"
  modified:
    - "src/app.css"
    - "src/main.ts"
    - "tests/helpers/styles.ts"
    - "tests/helpers/token-guards.ts"
    - "tests/unit/guards/phase8-shell-guards.test.ts"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"
    - "tests/unit/guards/phase5-layout-guards.test.ts"
    - "tests/unit/guards/design-tokens-guards.test.ts"
    - "tests/unit/shell/identity-model.test.ts"
    - "tests/unit/playtime/playtime-charts.test.ts"

key-decisions:
  - "The native-controls guard asserts a top-level rule plus 'app.css holds no @media' (not 'no max-width'): app.css legitimately keeps `main { max-width: none }`"
  - "The G5 whole-tree sweep now includes tokens.css as well, so tokens.css is actually held to the rule the plan says it is held to"
  - "Stale comments that named src/app.css as the home of the layout or phone block were repointed to shell.css (comment-only edits)"

patterns-established:
  - "One shared reader (readShellSource) for the shell stylesheet; a guard that reads it asserts non-empty text and that the rule it needs exists"

requirements-completed: []

coverage:
  - id: D1
    description: "Shell layout and the one phone block live in src/styles/shell.css, rule text and order unchanged; app.css holds only resets"
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts#declares exactly one phone-width query under src, and it is in the shell stylesheet"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/phase8-shell-guards.test.ts#has exactly one phone block, and the thresholds equal the selection-state constants"
        status: pass
    human_judgment: false
  - id: D2
    description: "G5 exempts exactly type.css and utilities.css; a shared name in shell.css is rejected"
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts#G5: the shared names are defined once"
        status: pass
    human_judgment: false
  - id: D3
    description: "Computed style, rect and pixels equal the baseline at 1280, 900, 899, 481, 480 and 375"
    verification:
      - kind: other
        ref: "node .planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs check"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 03: Shell stylesheet move Summary

**The master-detail layout and the single phone block moved from `src/app.css` to `src/styles/shell.css` with rule text unchanged; every reader and guard repointed first, G5 narrowed to the two defining files, and the harness shows 120,142 elements and 152 screenshots equal to the baseline at all six widths.**

## Accomplishments

- **Readers first.** `readShellSource()` / `shellHomeName()` (transitional fallback) let the phase8 shell, phase8 UI-review and phase5 font-floor guards, plus the identity and playtime tests, read "the file that holds the layout" before the move. Every repointed reader asserts the text is non-empty and that the rule it needs exists; the font-floor list asserts it still contains `src/app.css` and the shell file; the single-phone-block test counts exactly one query across `src` and names the file.
- **G5 narrowed.** The `src/styles/` prefix exemption is now `SHARED_STYLE_HOMES`. New synthetic cases: a shared name in `shell.css` (and `tokens.css`) is rejected; the two homes are accepted; the list equals exactly the two files.
- **The move.** `shell.css` holds the shell layout (with the 900px and 899px queries and the nested sticky import footer) followed by the phone block with its header comment. `app.css` keeps `:root`, `body`, native controls, `main`, links and focus, `h1, h2`, `p`, `ul`, with a header comment. `main.ts` imports `./styles/shell.css` right after `./app.css` (JS import, no CSS `@import`). The transitional fallback is gone.
- **Built CSS.** Exactly one phone query in the built stylesheet.

## Task Commits

1. **Task 1: repoint the three phase guards** - `dec4aab` (test)
2. **Task 2: narrow G5, repoint two readers** - `1012e39` (test)
3. **Task 3: move the shell layout and phone block** - `a0e9117` (refactor)

## Verification

- `pnpm exec vitest run tests/unit/guards tests/unit/shell tests/unit/playtime tests/unit/overview/overview-components-guard.test.ts tests/unit/charts/contrast.test.ts` - 48 files, 1766 tests pass.
- `pnpm run check` (0 errors, 0 warnings), `pnpm run lint`, `pnpm run build` pass.
- `src/app.css` has no `@media`, `.shell` or `.pane-*`; `src/styles/shell.css` exists.
- `style-equality.mjs check` - EQUAL: 5 archives, 13 panes, widths 375,480,481,899,900,1280; 120,142 elements, 152 screenshots, 0 differences.

## Deviations from Plan

**1. [Rule 1 - Bug] The plan's built-CSS phone-query check cannot match the built output**
- **Found during:** Task 3 verification
- **Issue:** The plan's inline `node -e` counts `max-width:\s*480px` in `dist/assets/*.css`. The CSS minifier rewrites the query to range syntax (`@media (width<=480px)`), so the check counts 0 at HEAD and after the move alike.
- **Fix:** Ran the same check with the pattern `max-width:\s*480px|width\s*<=\s*480px`; it finds exactly one. No source change.

**2. [Rule 1 - Bug] The "app.css has no max-width query" assertion was too broad**
- **Issue:** `app.css` keeps `main { max-width: none }`, so asserting the absence of `max-width` fails. The assertion is on `@media` instead (the intent: no width query at all).
- **Files modified:** `tests/unit/guards/phase8-ui-review-guards.test.ts`
- **Commit:** a0e9117 (the transitional conditional form was in dec4aab)

**3. [Rule 2 - Missing] G5 sweep skipped tokens.css**
- **Issue:** The plan says tokens.css is now held to G5, but the whole-tree sweep filtered `tokens.css` out. The sweep now visits every file.
- **Files modified:** `tests/unit/guards/design-tokens-guards.test.ts`
- **Commit:** 1012e39

**4. [Scope-adjacent] Stale comments**
- Comments in `ListPane`, `Overview`, `IdentityHeader`, `DashboardSection`, `DetailPane`, `DurationList`, `selection-state.ts` and three tests named `src/app.css` as the home of the layout or phone block; repointed to `src/styles/shell.css`. Comment-only, no behavior change.
- **Commit:** a0e9117

**5. Unit suite flake (not a regression)**
- `no-real-data.test.ts` failed once when run in a 48-file batch under load; it passes alone and in the immediate rerun of the same batch.

## Known Stubs

None.

## Threat Flags

None. `shell.css` holds no `url()` or `@import` (the CSS network rule sweeps it), the single-phone-block guard is non-vacuous (T-15-07), the harness found no order-dependent change at 480/481 or 899/900 (T-15-08), and no package was installed (T-15-SC).

## Self-Check: PASSED

- FOUND: `src/styles/shell.css`, `src/app.css`, `src/main.ts`
- FOUND commits: `dec4aab`, `1012e39`, `a0e9117`
