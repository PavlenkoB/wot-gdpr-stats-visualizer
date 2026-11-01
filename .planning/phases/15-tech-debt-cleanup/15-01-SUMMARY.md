---
phase: 15-tech-debt-cleanup
plan: 01
subsystem: ui
tags: [css, design-tokens, type-roles, guards, vitest, playwright, style-equality]

requires:
  - phase: 14-design-unification
    provides: the nine type roles (14-D-07), the shared utilities and the G1-G6 guard functions this plan extends
provides:
  - "src/styles/type.css: ten roles, adding .t-note (14/400/1.4) and .t-note-strong (14/600/1.4)"
  - "The two orphans removed: the unused strong-body role and the unused shared button block"
  - "tests/helpers/token-guards.ts: noteRoleOffenders (guard G7) and SHARED_STYLE_HOMES, with synthetic tests and no whole-tree sweep yet"
  - "The tracer site: the Not-yet-supported folder name renders through .t-note-strong"
  - ".planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs and note-sites.mjs"
  - "15-STYLE-EQUALITY-EVIDENCE.md with the Baseline and Tracer result sections"
affects: [15-03, 15-05, 15-06, 15-07, 15-08, 15-09, 15-10, 15-11, 15-12, 15-13]

actuals:
  tokens: 14500
  tasks: 2
  commits: 2
plan_head_before: c035d752ec7632573b81a584849ae9fa934787fa
plan_head_after: aeb40c975f444fc34dd0589aa4780e705eb5dec0

tech-stack:
  added: []
  patterns:
    - "A guard that cannot go live yet is a pure function with synthetic tests, wired into the whole-tree sweep only when its subject is gone (G7 goes live in plan 15-13)"
    - "A committed equality harness that builds its own baseline from a detached worktree and compares computed style, rect and a screenshot hash, keyed by structure and never by class name"

key-files:
  created:
    - ".planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs"
    - ".planning/phases/15-tech-debt-cleanup/tools/note-sites.mjs"
    - ".planning/phases/15-tech-debt-cleanup/15-STYLE-EQUALITY-EVIDENCE.md"
  modified:
    - "src/styles/type.css"
    - "src/styles/utilities.css"
    - "tests/helpers/token-guards.ts"
    - "tests/unit/guards/design-tokens-guards.test.ts"
    - "src/lib/shell/UnsupportedBlock.svelte"

key-decisions:
  - "Orphans decided REMOVE: the strong-body role and the shared button block are deleted; the 12 button components are untouched"
  - "G7 ignores the weight on purpose: the 14px size with the 1.4 line height is the subject, because a role sets its weight explicitly"
  - "The pair is legitimate only in src/styles/type.css and src/styles/utilities.css (SHARED_STYLE_HOMES); tokens.css and the shell stylesheet are not exempt"
  - "Open-state screenshots are not hashed: they were unstable across identical captures; the open state is compared by computed style and rect only"
  - "The baseline build links the gitignored public/geo-city-data input, so the two builds see the same city manifest"

patterns-established:
  - "Edge archive for the 899/900 and 480/481 widths is the real-shape three-account archive, which renders all eight classic panes"

requirements-completed: []

coverage:
  - id: D1
    description: "type.css holds ten roles including .t-note and .t-note-strong; the two orphans are gone and no list, comment or test names them"
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts#the ten roles"
        status: pass
    human_judgment: false
  - id: D2
    description: "noteRoleOffenders (G7) with synthetic tests and no whole-tree sweep"
    verification:
      - kind: unit
        ref: "tests/unit/guards/design-tokens-guards.test.ts#G7: the 14px/1.4 pair is a role"
        status: pass
    human_judgment: false
  - id: D3
    description: "The folder name in the Not-yet-supported banner takes .t-note-strong with computed style, rect and pixels unchanged"
    verification:
      - kind: other
        ref: "node .planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs check"
        status: pass
    human_judgment: false
  - id: D4
    description: "The style-equality harness is committed, stable (two baseline captures identical) and detects a one-property perturbation"
    verification:
      - kind: other
        ref: "node .planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs selftest"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 01: Tracer for the note roles and the style-equality harness Summary

**`.t-note` / `.t-note-strong` roles, the G7 offender function and a committed computed-style/rect/pixel harness, proven end to end on one real site (the Not-yet-supported folder name) with 120,142 elements and 152 screenshots equal to the pre-phase baseline.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-11-01T07:44:49Z
- **Completed:** 2026-11-01T08:10Z
- **Tasks:** 2
- **Files modified:** 8 (3 created)

## Accomplishments

- **Roles.** `src/styles/type.css` now holds ten roles; the unused strong-body role is deleted. `src/styles/utilities.css` lost the unused shared button block. `ROLE_NAMES` lists ten names, `SHARED_CLASS_NAMES` lost `btn`, and no guard list, comment or test names the removed pieces (grep clean).
- **Guard G7.** `noteRoleOffenders` and the exported `SHARED_STYLE_HOMES` live in `tests/helpers/token-guards.ts`. Eight synthetic tests cover weight 600 / 400 / none, 14px with 1.5, 12px with 1.4, 14px alone, the two exempt files, the non-exempt `tokens.css` / `shell.css` / component, a nested rule, and a check that the two roles resolve to 14px, 400/600, 1.4. No whole-tree sweep (a comment points to plan 15-13).
- **Tracer.** `UnsupportedBlock.svelte` puts `t-note-strong` on the banner folder span and keeps only `overflow-wrap` and `min-width` in its rule.
- **Harness.** `style-equality.mjs` (check, capture, show, selftest, clean, evidence) builds baseline `2cb5359` from a detached worktree, drives five synthetic archives through all 13 panes at six widths (the edge widths 900, 899, 481, 480 for the real-shape archive), in rest and open states, and compares per element. `note-sites.mjs --count src` prints a total of 101 (102 at HEAD minus the tracer).
- **Evidence.** `15-STYLE-EQUALITY-EVIDENCE.md` records the baseline hash, widths, panes, element counts and canonical-JSON hashes per width, the double-capture stability statement, and the tracer result (EQUAL at all six widths).

## Task Commits

1. **Task 1 (tracer): note roles, orphan removal, G7 function, UnsupportedBlock** - `045d729` (refactor)
2. **Task 2: harness, note-sites tool and evidence** - `aeb40c9` (docs)

## Verification

- `pnpm exec vitest run tests/unit/guards` - 22 files, 427 tests pass.
- `pnpm run check` (0 errors, 0 warnings), `pnpm run lint`, `pnpm run build` pass; the built CSS carries both note roles and not the removed role.
- `style-equality.mjs selftest` passes; `style-equality.mjs check` exits 0 (EQUAL, 0 differing elements, 0 differing screenshots).
- `pnpm exec vitest run tests/unit/guards/no-real-data.test.ts` passes; no `Users/` in the tools or the evidence.

Measured harness times: first run with a cold baseline 241 s (build plus two full baseline captures plus the working tree), cached `check` 80-85 s, `selftest` about 30 s. All well under the eight-minute budget, so the matrix was not reduced.

## Decisions Made

See `key-decisions` above. The matrix needed no reduction; the full `check` with a cached baseline stays near 85 s.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Open-state screenshot hashes were unstable**
- **Found during:** Task 2 (first full baseline double capture)
- **Issue:** The plan asked for a screenshot hash in the open state as well; two identical baseline captures differed in four open-state screenshot hashes (dump rows were identical).
- **Fix:** Hash screenshots in the rest state only, which also matches the playbook ("a full-page screenshot hash in the rest state"). The open state is compared by computed style and rect.
- **Files modified:** `tools/style-equality.mjs`
- **Commit:** aeb40c9

**2. [Rule 3 - Blocking] Baseline build lacked the gitignored city dataset**
- **Found during:** Task 2 (first comparison)
- **Issue:** `public/geo-city-data/` is a gitignored local build input whose manifest is baked into the bundle. The baseline worktree did not have it, so the login-history pane differed (city opt-in versus "unavailable") for a reason unrelated to the code under test.
- **Fix:** The harness links `public/geo-city-data` into the baseline worktree when present, and the cached-build stamp records whether it was linked.
- **Files modified:** `tools/style-equality.mjs`
- **Commit:** aeb40c9

**3. [Rule 1 - Bug] `git()` helper crashed on silent commands**
- **Issue:** `git worktree add` with `stdio: 'ignore'` returned null and `.trim()` threw. Fixed in the helper.
- **Commit:** aeb40c9

**4. Unit suite timing flake (not a regression)**
- `tests/unit/overview/overview-grid.test.ts` ("never leaves more sparse holes") timed out at 27 s once under full-suite load; it passes in isolation (19/19). Not touched by this plan, no change made.

## Known Stubs

None.

## Threat Flags

None. The harness takes zip bytes only from `tests/fixtures/` builders (T-15-01), writes only to the scratch directory, and the committed files hold no absolute path (T-15-02, grep and `no-real-data.test.ts`). No `url()` or `@import` was added to any stylesheet (T-15-03). No package was installed or changed (T-15-SC).

## Notes for later plans

- `git worktree list` shows the baseline worktree under the scratch directory until plan 15-13 runs `style-equality.mjs clean`.
- The harness covers all 13 pane ids (account, account-timeline, device-info, finance, heat, login-history, not-yet-supported, overview, payments, perks, playtime, vehicles, warships-storage) and asserts that coverage on every full run.
- Use `style-equality.mjs show --label before --class <name>` to read an inherited weight in the baseline build.

## Self-Check: PASSED

- FOUND: `.planning/phases/15-tech-debt-cleanup/tools/style-equality.mjs`, `tools/note-sites.mjs`, `15-STYLE-EQUALITY-EVIDENCE.md`
- FOUND commits: `045d729`, `aeb40c9`
