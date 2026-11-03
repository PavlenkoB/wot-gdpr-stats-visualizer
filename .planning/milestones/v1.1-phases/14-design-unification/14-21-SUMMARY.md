---
phase: 14-design-unification
plan: 21
subsystem: testing
tags: [design-tokens, guards, vitest, playwright, pixel-compare, skills, phase-gate]
status: complete

requires:
  - phase: 14-design-unification
    provides: the whole-tree token, type, colour, shared-name and nesting guards, an empty PENDING_FILES, the Overview on the shared layer, and the Baseline and Result sections of the pixel evidence (plans 14-01 to 14-20)
provides:
  - The migration allowlist, the Overview-only scale and the superseded per-folder and colour-literal guards are deleted; every rule applies to every file with no exemption list
  - The sketch-findings skill records the heat scale and `src/styles/` in place of the retired Activity ramp, with the one-line-edit list
  - The phase gate run in full and recorded below
  - The Final re-run section of `14-OVERVIEW-PIXEL-EVIDENCE.md`: four widths against the baseline commit, 0 differing pixels outside the masked title box
  - The `Open items for the owner` section (below)
affects: [14-design-unification, design-tokens-guards, sketch-findings skill, pixel-evidence]

actuals:
  tokens: 15571
  tasks: 2
  commits: 4
plan_head_before: 995cabf4074353d8d633d7bde6753c6cea24e648
plan_head_after: 442f1a575d9b3387186a6dd2c692f90b0ed86f0f

tech-stack:
  added: []
  patterns:
    - "A guard with no exemption list: the whole-tree sweep asserts it visited `src/app.css`, every `.svelte` file with a style block and at least 50 files, so an empty or shrunken sweep fails instead of passing vacuously."

key-files:
  created: []
  modified:
    - tests/helpers/components.ts
    - tests/unit/guards/design-tokens-guards.test.ts
    - tests/unit/guards/nesting-guard.test.ts
    - tests/unit/guards/phase8-ui-review-guards.test.ts
    - tests/e2e/shell/master-detail-nav.spec.ts
    - tests/helpers/token-guards.ts
    - tests/unit/account-timeline/timeline-pane.test.ts
    - .claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md
    - .claude/skills/sketch-findings-wot-gdpr-stats-visualizer/references/visual-language.md
    - .claude/skills/sketch-findings-wot-gdpr-stats-visualizer/references/layout-and-navigation.md
    - .claude/skills/sketch-findings-wot-gdpr-stats-visualizer/sources/themes/default.css
    - .planning/phases/14-design-unification/14-OVERVIEW-PIXEL-EVIDENCE.md
    - graphify-out/ (own commit)

key-decisions:
  - "The Final re-run was measured with a replacement script, because the scratch harness no longer existed (see Deviations). It is accepted as the same instrument because it reproduces all four baseline PNG sizes."

requirements-completed: [D-02, D-03, D-04, D-07, D-10, D-11, D-13, D-14, D-15, D-16]

duration: this continuation run only (an earlier executor landed the first three commits)
completed: 2026-10-28
---

# Phase 14 Plan 21: Close the phase, delete the allowlist, run the gate Summary

**The migration allowlist and every folder exemption are gone so the token, type, colour, nesting and network rules apply to the whole tree for good; the full gate is green (4884 unit tests, lint, svelte-check, build, 273 Playwright tests) and the Overview is byte-equal to the baseline at 880, 479 and 340px, with only the masked title box differing at 1040px.**

## Accomplishments

- Task 1 (`adf196e`, landed by the previous executor, re-verified here). `tests/helpers/migration.ts` and the stale `tests/helpers/token-guards.ts` helper are deleted; `PENDING_FILES`, `OVERVIEW_SCALE_PX`, `ALLOWED_COLOUR_LITERALS` and `--ramp-` appear nowhere in `src` or `tests` (grep exits clean). The design-tokens guard now asserts its sweep visited `src/app.css`, every `.svelte` file with a style block and at least 50 files; the nesting guard asserts the compile sweep compiled at least 40 components. The phase-8 guards kept the legacy-grey, blue-literal, tooltip-contrast, native-control, sticky-import, single-phone-block and stale-comment tests. `SCALE_PX` is exactly 12, 14, 18, 26, 32, 56 and the e2e off-scale sweep uses it for the Overview too. The test count went from 4902 to 4884 passed, the difference being the deleted guard tests.
- Task 2, skill (`40ccea1`, re-verified here): `SKILL.md` says Phase 14 (D-10) replaced the teal ramp with the heat scale, names `src/styles/` and lists the one-line edits; `grep -c heat-1` prints 1, `grep -c "src/styles"` prints 4, and the line "Keep `--ramp-0..5` as is" is gone. The three other skill files carry dated "superseded by Phase 14" notes; the sketch HTML under `sources/` is untouched.
- Task 2, graph (`9c69955`, its own revertable commit): 3 files changed, 99,416 insertions and 68,330 deletions, all under `graphify-out/` (`graph.json` 166,810 lines of that churn, `GRAPH_REPORT.md` 928, `graph.html` 8). The churn is mixed, not all substantive: nodes went from 11,301 to 12,342 (+1,099 new, 58 gone), which is the phase-14 planning documents and the `src/styles/` files, and 165 communities were relabelled by their hub, which is graphify-side relabelling noise. The graph was built from commit `40ccea17`; the two later commits of this plan touch only `.planning/`, so it describes the code as it is now, but I have not claimed more than that.
- Task 2, gate and evidence (`442f1a5`): see the next two sections.

## The phase gate (real output, this run)

| Step | Command | Result |
| --- | --- | --- |
| Heat contract (D-11 as amended) | `pnpm exec vitest run tests/unit/charts/contrast.test.ts` | 1 file, 79 tests passed; `grep -c "D-11 as amended"` prints 1. No heat token changed in this plan. |
| Unit | `pnpm run test:unit` | exit 0, 164 files, 4884 passed, 9 expected fail (4893). First run, no re-run needed; the overview-grid load flake did not trip. |
| Lint | `pnpm run lint` | exit 0 (prettier "All matched files use Prettier code style!", then eslint clean) |
| Check | `pnpm run check` | exit 0, `COMPLETED 363 FILES 0 ERRORS 0 WARNINGS` |
| Build | `pnpm run build` | exit 0 (built in 548 ms; assets `index-DxkOl1C0.js`, `index-BFzhEviO.css`) |
| Playwright | full suite incl. the zero-network specs, through a temporary config on port 4177 | `Total: 273 tests in 33 files` listed; `273 passed (1.5m)` |
| Copy drift | `git diff -U0 901a9e1 -- src/lib/ui-copy.ts`, non-comment lines | `ui-copy: comment-only diff` |
| Dependencies | `git diff --stat 901a9e1 -- package.json pnpm-lock.yaml` | empty |

The temporary Playwright config was deleted in a separate step before lint ran and was never committed; the working tree was clean afterwards. The Playwright run rebuilds `dist/` with `GEO_FIXTURE=1`, so `dist/` was rebuilt with `pnpm run build` afterwards; the evidence build has the same asset names as the gate's build.

## The Overview pixel compare (D-15, D-16)

The `## Final re-run` section of `14-OVERVIEW-PIXEL-EVIDENCE.md` is written and committed (`442f1a5`). It was measured against a build I proved current: the asset names served on port 4176 equal those in `dist/index.html` (`index-DxkOl1C0.js`, `index-BFzhEviO.css`), not the stale servers left on 4173 and 4174. The before column is the baseline commit `901a9e1` built in a fresh scratch worktree and served on 4181.

| width | before size | after size | masked title box | differing pixels outside the mask | verdict |
| --- | --- | --- | --- | --- | --- |
| 1040 | 639 x 1793 | 639 x 1793 | x=0 y=0 w=639 h=42 | 0 | BYTE-EQUAL |
| 880 | 800 x 1739 | 800 x 1739 | x=0 y=0 w=800 h=34 | 0 | BYTE-EQUAL |
| 479 | 447 x 1959 | 447 x 1959 | none | 0 | BYTE-EQUAL |
| 340 | 308 x 2181 | 308 x 2181 | none | 0 | BYTE-EQUAL |

At 880, 479 and 340 the two PNG files are byte-identical. At 1040 they differ in 1,923 pixels, all in rows 6 to 32 inside the title box (the title is 32px from 900px up), none below row 42. The evidence acceptance greps print 8 (BYTE-EQUAL rows) and 2 (`Working tree (src/): clean`).

The baseline worktree and both preview servers are removed (see Background servers). The `before-final`, `after-final`, `before-panes` and `after-panes` PNG folders stay in the scratch directory, see Deviations for what that directory now holds.

## Open items for the owner

These are not resolved by this phase and were not resolved by this plan. Nothing was added, moved or narrowed to settle them.

1. **D-07 is only partly delivered (the 14px sites at line height 1.4).** The type roles are adopted wherever a site's computed size, weight and line height equal a role's. 105 of the 188 sites at 14px use line height 1.4 (67 at weight 600, 38 at weight 400), no UI-SPEC role covers that, and mapping them onto the 1.5 roles would change pixels, so they keep token declarations. Decision: owner decides: add `.t-note` (14/400/1.4) and `.t-note-strong` (14/600/1.4) roles in a follow-up (about 105 markup sites, no visible change), or accept the token declarations as the final state.
2. **The `.caption` versus `.t-caption` naming.** `.caption` is the 14px muted note and `.t-caption` is the 12px role; the trap is documented in `src/styles/utilities.css`. Decision: owner decides: rename in a follow-up, or accept.
3. **D-02 / UI-SPEC OI-11 (what `app.css` keeps).** `app.css` keeps the shell layout and the single phone block next to the element resets, instead of only the element resets as D-02 is written, so that the phase-8 guard that reads the phone block stays stable. Decision: owner decides: confirm this, or direct a follow-up that moves the layout and the phone block into `src/styles/` and repoints the guard.
4. **D-04 / UI-SPEC OI-6 (the 6px radius), recorded for the record, not a question.** CONFIRMED by the owner in chat on 2026-10-25: the 44 sites of `border-radius: 6px` keep 6px as `--radius-sm`; D-04's snap to 4 or 8 applies to spacing, and the one `gap: 6px` became 4px.

UAT checklist for the owner (from the plan; the Overview items are covered by the committed evidence): titles are 32px at 900px and up and 26px below, none wraps at 900 or 375px except a long identity nickname, and "Not yet supported" and "Login history" stay on one line in the 375px phone bar; the Overview is pixel-identical apart from its title box; the calendar, hour grid, duration bars and world map read green to olive to dark gold on the heat scale (five data levels plus empty); the two tile numerals are 26px on desktop and 18px on a phone; the vehicles checkbox-to-label gap reads well at 4px; each pane's focal element is the first data element after the title (confirm the Payments pane's: the first chart of FinancialData); no copy changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The scratch harness and the before/after sets were gone**
- **Found during:** the Final re-run step of Task 2.
- **Issue:** the machine had been restarted about 14 minutes before this run started (uptime 14 min, all of 4173 to 4175 free, the stale servers gone too). The temp directory `wg-phase14` with `harness.mjs`, the baseline worktree, the baseline `dist` and every earlier `before` / `after` PNG was wiped. The plan's `evidence --section final` subcommand did not exist any more.
- **Fix:** I wrote a smaller replacement script in the session scratchpad (not committed) and measured the Final re-run with it. To prove it is the same instrument, I first checked its before capture against the Baseline section: it chose the Account-timeline-and-perks synthetic archive and the `[data-testid="overview"]` element by trying the fixture builders until the four widths gave 639 x 1793, 800 x 1739, 447 x 1959 and 308 x 2181, which are exactly the four sizes recorded in the Baseline section. The evidence file says all of this in its own text. I wrote the section by hand in the existing format instead of with the subcommand.
- **Consequence for the owner's UAT:** the old UAT set no longer exists. I regenerated an equivalent one in `wg-phase14/before-panes` and `after-panes` (every list pane of two synthetic archives at 1280, 900, 899 and 375px, 44 full-page PNGs per side, both sides captured now, same keys on each side). The same-key hash compare shows 8 equal and 36 different, which is expected: the page-level capture includes the title growth at 900px and up, the phone bar changes and the pane focal changes the phase makes on purpose, and the Overview page-level capture also reads the import line. These page-level sets are for the owner's eye, not a gate; the gate is the Overview element above. The `.png` files are in the session scratchpad at `/tmp/scratch` and, like any temp directory, can be wiped.
- **Files modified:** none in the repository besides the evidence file.
- **Commit:** `442f1a5`.

**2. [Order] The stale baseline worktree was pruned before the Final re-run**
- **Found during:** the start of this run.
- **Issue:** the plan removes the baseline worktree only after the Final re-run is recorded. Its directory was already gone, so `git worktree prune` at the start only dropped the dangling registration; I then created a new baseline worktree for the compare and removed it with `git worktree remove --force` plus `git worktree prune` after the evidence commit. `git worktree list` now shows only the main checkout.

No other deviation: Task 1 and the skill and graph commits were verified against the plan's acceptance criteria and needed no change.

## Stale comments reported, not fixed (out of this plan's scope)

Four stale comments recorded by plan 14-20 are still present and were not widened into this plan: `tests/helpers/components.ts:63`, `tests/e2e/_support/helpers.ts:541`, `tests/e2e/shell/master-detail-nav.spec.ts:72` and `src/lib/features/logins/map-model.ts:36`, plus the plan 14-14 `.info` border item. Known accepted difference (plan 14-05): the identity title growing from 26 to 32px at 900px and up moves the list pane's rows 1px lower; D-16 freezes the Overview only.

## Background servers

I started two `vite preview` servers for the compare, recorded their pids and killed both when done: pid 6572 on port 4176 (the current build) and pid 6574 on port 4181 (the baseline build); `lsof` on both ports is empty. The Playwright run started and stopped its own server on 4177 and it is gone. I did not start anything on 4173, 4174 or 4175; those servers no longer exist either (the restart).

## Known Stubs

None. This plan adds no UI code.

## Threat Flags

None. No network endpoint, auth path or file-access surface was added; T-14-16 is mitigated by the whole-tree guards now having no exemption list and by the full Playwright suite, zero-network specs included, passing (273 of 273). No package was added (`package.json` and `pnpm-lock.yaml` are unchanged since `901a9e1`).

## Self-Check: PASSED

Found: the four commits `adf196e`, `40ccea1`, `9c69955` and `442f1a5` are ancestors of HEAD; the evidence file and the skill file exist; `tests/helpers/migration.ts` is gone. The Open items section carries "owner decides" 3 times, "OI-11" once and "CONFIRMED" once.
