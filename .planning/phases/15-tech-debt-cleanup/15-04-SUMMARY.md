---
phase: 15-tech-debt-cleanup
plan: 04
subsystem: docs
tags: [comments, stale-references, skills, scanner]

requires:
  - phase: 15-tech-debt-cleanup
    provides: src/styles/shell.css and the repointed readers (plan 15-03)
provides:
  - "tools/stale-ref-scan.mjs: stale app.css pointer scanner and comment-only diff checker"
  - "No comment, test header or skill document places the phone block, the layout or the custom properties in src/app.css"
affects: [15-13]

actuals:
  tokens: 1500
  tasks: 3
  commits: 3
plan_head_before: 9177822f4a26866041b502800eacb5d5ce6fde39
plan_head_after: 964dde2a4439b57a7ecfb9310c57e65f717abd4a

tech-stack:
  added: []
  patterns:
    - "Prove a comment-only edit by comparing comment-stripped text against a base commit with one function on both sides"

key-files:
  created:
    - ".planning/phases/15-tech-debt-cleanup/tools/stale-ref-scan.mjs"
  modified:
    - "src/App.svelte"
    - "src/lib/features/logins/LoginSummary.svelte"
    - "src/lib/features/overview/overview-heat.ts"
    - "src/lib/charts/ChartTooltip.svelte"
    - "src/styles/shell.css"
    - "tests/e2e/shell/touch-targets.spec.ts"
    - ".claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md"
    - ".claude/skills/sketch-findings-wot-gdpr-stats-visualizer/references/layout-and-navigation.md"

key-decisions:
  - "App.svelte keeps naming src/app.css for the global main rule (it still lives there) and adds the shell.css pointer for the layout, rather than blindly repointing"

requirements-completed: []

duration: 8min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 04: Stale reference sweep Summary

**A scanner now proves no comment or document places the shell layout or the phone block in `src/app.css`, a comment-only checker proves 14 touched files kept their code byte-equivalent to commit 2cb5359, and the sketch-findings skill tells a future UI task that `src/styles/shell.css` owns both.**

## Accomplishments

- `stale-ref-scan.mjs`: default mode scans `git ls-files src tests .claude/skills` (minus images and `/sources/`) for `app.css` windows of 400 characters that mention phone/layout/`.shell`/pane/480px without `shell.css`; `--comment-only <base> <files>` compares comment-stripped text on both sides.
- Plan 15-03 had already repointed `ListPane`, `Overview`, `DashboardSection`, `DetailPane`, `IdentityHeader`, `selection-state.ts`, `DurationList`, `selection-state.test.ts` and the guard-test message in `overview-components-guard.test.ts`, so this plan did not redo them; the scanner found only the remainder.
- Remaining edits: `LoginSummary.svelte` and `touch-targets.spec.ts` now say `src/styles/shell.css`; `overview-heat.ts` (two) and `ChartTooltip.svelte` (one) say the custom properties are in `src/styles/tokens.css`; the skill's phone-block line, import-order line and `layout-and-navigation.md` floor line say `shell.css` (import order: tokens, type, utilities, app, shell).

## Task Commits

1. **Task 1: scanner and checker** - `17d3bfc` (chore)
2. **Task 2: remaining source comments** - `fa7ca06` (docs)
3. **Task 3: touch-target test header, skill documents, shell.css header** - `964dde2` (docs)

## Verification

- `stale-ref-scan.mjs` exits 0 over `src`, `tests` and the skills.
- `--comment-only 2cb5359` over the 13 code files edited by 15-03/15-04 exits 0; `overview-components-guard.test.ts` differs only by the assertion's message string (`app.css` -> `shell.css`, changed in 15-03 commit a0e9117; confirmed by reading `git diff 2cb5359`).
- `grep app.css` over the four shell components, `overview-heat.ts` and `ChartTooltip.svelte`: no hits.
- `pnpm run check` (0 errors, 0 warnings), `pnpm run lint`, and `vitest run` over `tests/unit/guards`, `selection-state.test.ts`, `overview-components-guard.test.ts` (24 files, 540 tests) pass.

## Deviations from Plan

**1. [Rule 1 - Bug] App.svelte comment about `main` must not be blindly repointed**
- **Issue:** The plan lists `App.svelte` (~342) as a phone-block/layout pointer to move to `shell.css`, but that comment is about the global `main` rule, which is still in `src/app.css`.
- **Fix:** Kept the true `src/app.css` reference (the element resets) and added "the shell layout is in `src/styles/shell.css`".

**2. [Rule 3 - Blocking] The scanner flagged the shell.css header itself**
- **Issue:** `src/styles/shell.css` line 5 says "`src/app.css` keeps only the element ... resets" next to "layout" without naming `shell.css`, so the scanner could not exit 0.
- **Fix:** The header now reads "This file, `src/styles/shell.css`, holds the shell". Comment-only.

**3. Most listed files were already done**
- The shell components, `IdentityHeader`, `selection-state.ts`, `DurationList`, `selection-state.test.ts` and the guard-test message were fixed in 15-03 (its deviation 4); Task 1 therefore committed only the scanner, and the component edits are not in this plan's commits.

## Known Stubs

None.

## Threat Flags

None. T-15-09 is mitigated by the `--comment-only` checker; no package was installed (T-15-SC).

## Self-Check: PASSED

- FOUND: `.planning/phases/15-tech-debt-cleanup/tools/stale-ref-scan.mjs`
- FOUND commits: `17d3bfc`, `fa7ca06`, `964dde2`
