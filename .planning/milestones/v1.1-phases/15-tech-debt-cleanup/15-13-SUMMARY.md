---
phase: 15-tech-debt-cleanup
plan: 13
subsystem: styles
tags: [guards, type-roles, design-skill, style-equality, gate]

requires:
  - phase: 15-tech-debt-cleanup
    provides: note-sites total 0 (15-12), noteRoleOffenders and the harness (15-01)
provides:
  - "Guard G7 live over every file under src/ with no exemption and no allowlist (non-vacuous: at least 50 files, shell.css and at least 40 styled components visited)"
  - "roleConsumerOffenders: a role-consumer guard so none of the ten roles can ship unused, with synthetic tests"
  - "The design skill describes the final shape (ten roles, .t-note and .t-note-strong, .muted-note utility, shell.css layout, app.css resets only)"
  - "The full gate recorded green on the final tree and the Final result of the style-equality harness (all six widths EQUAL)"
affects: []

actuals:
  tokens: 14000
  tasks: 3
  commits: 4
plan_head_before: 3578ddfe211e0f2a1236dd56ddff7345437e2c9e
plan_head_after: 679a888734f7ba905b3f1a814c646e260caa80e4

key-files:
  modified:
    - "tests/helpers/token-guards.ts"
    - "tests/unit/guards/design-tokens-guards.test.ts"
    - ".claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md"
    - ".planning/phases/15-tech-debt-cleanup/15-STYLE-EQUALITY-EVIDENCE.md"
    - ".planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs"
    - "graphify-out/"

key-decisions:
  - "The whole-tree G7 sweep and the consumer guard have no exemption list: the real tree passed first time, so nothing had to be migrated or exempted"
  - "style-equality.mjs gained an evidence --section final branch (same table as tracer plus the note-sites total) because the plan calls it but the tool only knew baseline and tracer"

requirements-completed: []

duration: 85min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 13: Guards on, gate green, evidence closed Summary

**G7 and a new role-consumer guard now run over the whole of src/ with no allowlist, the full gate (unit, lint, check, build, 273 Playwright tests incl. zero-network) is green, and the harness records all six widths EQUAL with a note-sites total of 0.**

## Accomplishments

- `roleConsumerOffenders(roleNames, entries)` in `tests/helpers/token-guards.ts`, built on `roleClassesIn`: one offender per role no `.svelte` markup uses as a class (static attribute, `class:` directive, string literal in an expression); a comment or a style-block selector does not count. Five synthetic tests plus a real-tree test over all ten roles (both note roles asserted present).
- `describe('G7: the sweep over every file')`: asserts at least 50 files, `src/styles/shell.css` visited and at least 40 styled components, then `SRC_FILES.flatMap(noteRoleOffenders)` equals `[]`. The plan-15-01 comment saying the sweep would arrive later is replaced; the header's guard list now names G7 and the consumer guard.
- `SKILL.md`: ten roles with `.t-note` (14/400/1.4) and `.t-note-strong` (14/600/1.4) named; the note roles are changed in `type.css` and the `.muted-note` utility (muted colour, zero margin, wrap) is in `utilities.css`; one Phase 15 history line added. The constraints list (shell.css layout and phone block, app.css resets only, import order) already held the correct text from plan 15-04.
- Gate and Final result recorded in `15-STYLE-EQUALITY-EVIDENCE.md`; baseline worktree and scratch directory removed; `git worktree list` shows only the main checkout; graph refreshed in its own commit.

## Task Commits

1. **Task 1: G7 sweep, role-consumer guard, design skill** - `2c91676` (test)
2. **Task 2: Gate section** - `7df547b` (docs)
3. **Task 3: Final result and harness `final` section** - `a2926bf` (docs)
4. **Task 3: graph refresh** - `679a888` (chore)

## Gate (final tree)

| command | result | counts |
|---|---|---|
| `vitest run tests/unit/guards` | pass | 22 files, 450 tests |
| `pnpm run test:unit` | pass (with `--maxWorkers=4`) | 165 files, 4951 passed, 9 expected fail |
| `pnpm run lint` | pass | clean |
| `pnpm run check` | pass | 363 files, 0 errors, 0 warnings |
| `pnpm run build` | pass | built |
| `git diff --exit-code 2cb5359 -- package.json pnpm-lock.yaml` | pass | empty |
| `pnpm exec playwright test` | pass | 273 passed (limit 273), zero-network spec included |
| `style-equality.mjs check` | EQUAL | 120394 elements, 176 screenshots, 0 differing, tooltip 60 of 60 |
| `note-sites.mjs src`, `stale-ref-scan.mjs` | exit 0, no output lines of offenders | total 0 |

`src/lib/ui-copy.ts` since `2cb5359`: the only non-comment change is the `CONFIRM_CLEAR_MESSAGE` constant (a new last sentence about pinned Overview tiles) plus its comment.

## Closed audit items

- Roles and the 102 measured sites: 15-01 (roles, function), 15-06 to 15-12 (migration), 15-13 (whole-tree guard). 102 versus the "about 105" of the Phase 14 audit: that count was per selector at the time; the 102 is measured rules (one rule with several selectors counts once).
- Layout and phone block out of `app.css`: 15-03, 15-04.
- `.caption` / `.t-caption` naming collision: 15-05.
- Orphan roles: 15-01 (removed), and 15-13 adds the consumer guard so a new one cannot appear.
- Phase 13 pins privacy note: 15-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `style-equality.mjs evidence` had no `final` section**
- **Found during:** Task 3
- **Issue:** the plan runs `evidence --section final`, but the tool only accepted `baseline` and `tracer`.
- **Fix:** added a `final` branch writing `## Final result` (same table as the tracer section, the note-sites total read by running `note-sites.mjs --count src`).
- **Files modified:** `.planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs`
- **Commit:** `a2926bf`

## Deferred Issues

- Under host load (load average above 11) the first full `test:unit` run timed out `no-real-data.test.ts` (20 s) and one `overview-grid.test.ts` case; both pass alone and the full suite is clean at `--maxWorkers=4`. Known flaky, not changed.

## Open questions for the owner

- The `.muted-note` name (renamed from the Phase 14 utility).
- The new confirmation sentence in `CONFIRM_CLEAR_MESSAGE`.
- The empty-state sentence "Your data stays in this tab." was left unchanged.
- The harness is committed under `.planning/phases/15-tech-debt-cleanup/tools/` instead of being kept as a scratch file.

## Known Stubs

None.

## Threat Flags

None. T-15-19 mitigated (sweeps assert file counts and the shell stylesheet; synthetic tests prove both guards fail on a violation). T-15-20 mitigated (the evidence sections hold widths, counts, hashes and commit ids; `no-real-data` passes). T-15-SC: `package.json` and `pnpm-lock.yaml` byte-equal to `2cb5359`.

## Self-Check: PASSED

- FOUND commits: `2c91676`, `7df547b`, `a2926bf`, `679a888`
- FOUND: evidence file has `## Gate` and `## Final result`; `git worktree list` shows one entry
