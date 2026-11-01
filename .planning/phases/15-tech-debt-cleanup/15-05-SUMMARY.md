---
phase: 15-tech-debt-cleanup
plan: 05
subsystem: styles
tags: [css, rename, utility, scanner, naming]

requires:
  - phase: 15-tech-debt-cleanup
    provides: shell.css, stale-reference sweep, style-equality harness (plans 15-01 to 15-04)
provides:
  - "tools/class-token-scan.mjs: class-token scanner for markup, component CSS and test selectors, with a self-test"
  - "The shared muted 14px note is .muted-note; .caption no longer exists under src/ or tests/"
affects: [15-06, 15-13]

actuals:
  tokens: 9000
  tasks: 3
  commits: 3
plan_head_before: a002cf818100a8c36a0295d57d3f99c61988b0d7
plan_head_after: 99816c9175368a6d4522bbb9e289e2c0c8891783

tech-stack:
  added: []
  patterns:
    - "Rename a class with a scanner list and a transitional alias, so every commit stays green"
    - "A dynamic class decouples a prop variant from its style hook through an explicit map"

key-files:
  created:
    - ".planning/phases/15-tech-debt-cleanup/tools/class-token-scan.mjs"
  modified:
    - "src/styles/utilities.css"
    - "tests/helpers/token-guards.ts"
    - "src/lib/shell/ImportSummary.svelte"
    - "src/lib/shell/IdentityHeader.svelte"
    - "21 further components under src/lib/features (class tokens and the comments that named the class)"
    - "tests/unit/new-data/new-data-blocks.test.ts"
    - "tests/unit/account-timeline/timeline-pane.test.ts"
    - "tests/unit/overview/overview-components-guard.test.ts"
    - "tests/unit/guards/design-tokens-guards.test.ts"
    - "tests/unit/guards/css-helper.test.ts"
    - "tests/e2e/finance/finance.spec.ts"
    - "tests/e2e/finance/finance-scale.spec.ts"

key-decisions:
  - "The utility is the one renamed (.muted-note); the 12px role .t-caption and --fs-caption keep their names"
  - "ImportSummary keeps the variant value 'caption' and maps it to muted-note through VARIANT_CLASS"

requirements-completed: []

duration: 25min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 05: muted-note rename Summary

**The shared muted 14px note is now `.muted-note` in 22 components, the guard list, 3 unit tests, 2 finance specs and the utility stylesheet; a scanner proves the old class name is gone from `src/` and `tests/`, and the style-equality harness reports 0 differing elements and 0 differing screenshots at all six widths.**

## Accomplishments

- `class-token-scan.mjs <token> [paths]`: reads `.svelte` markup (static `class="..."`, `class:` directives, string literals and object keys in `class={...}`), `<style>` blocks and `.css` files (selectors), and `.ts/.mjs/.js` (selectors and `class="..."` fragments inside string, template and regex literals). It skips comments, `<script>` blocks, `<caption>` elements, `locator('caption')`, `t-caption`, `--fs-caption`, test ids and identifiers. `--selftest` proves one positive per kind and one per exclusion over in-memory samples.
- Baseline at HEAD: 84 uses in 28 files (64 markup classes in 21 components, 1 stylesheet rule, 19 in tests). The planner's "69" counted 4-5 comment mentions of `class="caption"`, which the scanner correctly ignores.
- Task 1 added a temporary `.caption, .muted-note` selector list so the two names answered together while the markup moved; Task 3 reduced it to `.muted-note` and replaced the naming-trap comment with a plain description of the utility against `.t-note`.
- `ImportSummary.svelte`: `variant` keeps its three values and still derives the test id; a `VARIANT_CLASS` map and `variantClass` derived value give `caption` the class `muted-note`.
- Comments that named the deleted class (`.caption`, `p.caption`, `class="caption"`) in 8 components and 3 tests now name `.muted-note`.

## Task Commits

1. **Task 1: scanner and transitional alias** - `9e2f2b4` (refactor)
2. **Task 2: components and the unit tests that pin their markup** - `7abba59` (refactor)
3. **Task 3: alias removed, guards, synthetic tests, finance locators** - `99816c9` (refactor)

## Verification

- `class-token-scan.mjs caption src tests`: 0 uses in 398 files (exit 0); `--selftest` OK.
- `vitest run tests/unit/guards tests/unit/new-data tests/unit/account-timeline`: 36 files, 722 passed (9 expected fail, unchanged).
- `pnpm run check` 0 errors 0 warnings; `pnpm run lint` clean; `pnpm run build` OK.
- `playwright test tests/e2e/finance/finance.spec.ts finance-scale.spec.ts`: 37 passed.
- `style-equality.mjs check`: 120142 elements and 152 screenshots compared, 0 differing, EQUAL (archives 5, panes 13, widths 375/480/481/899/900/1280).
- `package.json` and `pnpm-lock.yaml` unchanged.
- Full `pnpm run test:unit`: 4898 passed; see Deferred Issues for one load-sensitive failure.

## Deviations from Plan

**1. [Rule 1 - Bug] The shell-bento guard regex named the old class**
- **Found during:** Task 2
- **Issue:** `overview-components-guard.test.ts` held `expect(css).not.toMatch(/...\.(?:caption|body)\b/)`, a regex literal, not only a comment. Leaving it would have asserted nothing about the new shared name.
- **Fix:** The regex now reads `\.(?:muted-note|body)\b` and the comment names `.muted-note`. The assertion is not weakened (same shape, new name). The plan listed this file as comment-only.
- **Commit:** 7abba59

**2. [Rule 2 - Missing] Stale comments naming the deleted class**
- **Issue:** Playbook section 3 rule 8 forbids a comment naming a deleted class, but the scanner (comment-blind by design) does not list them.
- **Fix:** A targeted replace of `.caption` / `class="caption` in `src/**/*.svelte` and the three unit tests turned 20 comment mentions into `.muted-note`. Comment-only; reviewed in `git diff`.
- **Commit:** 7abba59, 99816c9

## Deferred Issues

- `tests/unit/overview/overview-grid.test.ts` ("sparse flow ... every pin subset") and, once, `no-real-data.test.ts` failed during a full `pnpm run test:unit` run while the style-equality harness or lint ran alongside; both pass alone and the overview grid is a pure function this plan does not touch. Load-induced timeouts, not caused by this plan. A second full run (harness finished) still showed the overview-grid one at the default timeout.

## Known Stubs

None.

## Threat Flags

None. T-15-10 and T-15-11 are mitigated (scanner, alias, finance specs, harness EQUAL); no package was installed (T-15-SC).

## Self-Check: PASSED

- FOUND: `.planning/phases/15-tech-debt-cleanup/tools/class-token-scan.mjs`
- FOUND commits: `9e2f2b4`, `7abba59`, `99816c9`
