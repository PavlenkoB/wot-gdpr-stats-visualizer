---
phase: 14-design-unification
plan: 20
subsystem: ui
tags: [svelte, css, design-tokens, type-roles, nesting, pixel-compare, token-aware-tests, overview]

# Dependency graph
requires:
  - phase: 14-design-unification
    provides: the token scale in `src/styles/tokens.css` and the shared type roles in `src/styles/type.css` (`.t-label`, `.t-caption`, `.t-body`), plus the token-aware CSS test helpers (plans 14-01, 14-15)
  - phase: 14-design-unification
    provides: the Overview tile on the same layer, with the guard converted to roles and a local four-size set (plan 14-19)
  - phase: 14-design-unification
    provides: the Baseline section of `14-OVERVIEW-PIXEL-EVIDENCE.md` and the D-16 title compensation (plans 14-01, 14-05)
provides:
  - The last four Overview components (bento, group, rows, bars) read the shared tokens and exact-match roles; `src/lib/features/overview/` is entirely off `PENDING_FILES`, which is now empty
  - OverviewBento defines neither `.caption` nor `.body`: its 12px captions are `t-caption` plus a local `note` hook, its empty statement is `t-body` plus `statement`, its life label is `t-label` plus `label`, and the life entries and the dashed absent row take `t-body`
  - The D-15 proof, retained: the `Result` section of `14-OVERVIEW-PIXEL-EVIDENCE.md` records BYTE-EQUAL at 1040, 880, 479 and 340px, equal PNG sizes, 0 differing pixels outside the masked title box, measured at the committed tree `b440626` with `src/` clean
  - The Overview contract test sweeps all five components by their roles and by any declared size, with a non-empty requirement per component
affects: [14-design-unification, overview, design-tokens-guards, migration-allowlist, pixel-evidence, 14-21]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 5365
  tasks: 2
  commits: 2
plan_head_before: 33641c15d3bbafe708fd544a4ce89215bf1bdd41
plan_head_after: 394fb0c3a9fecfc3b729a5c5b81e41626bc4725c

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A role adopted on a container is inherited by its children: `.game` (a flex row of dt and dd) and `.absent` (the dashed row with a bold prefix span) take `t-body` on the element itself, so the local rule loses its triple and the nested `dt` / `dd` / prefix rules state only colour and weight."
    - "When a local rule's every type declaration moves into a role, the rule stays only for what a role never owns (margin, wrap, colour). The three Bento hooks `.note`, `.statement` and `.label` are exactly that and nothing more."
    - "A pair compared by the pixel harness needs its two sides captured by the same browser on the same day. The harness reads its set names from `WG_BEFORE` and `WG_AFTER` (scratch edit), so a fresh pair never overwrites the shared `before` / `after` sets."

key-files:
  created: []
  modified:
    - src/lib/features/overview/OverviewBento.svelte
    - src/lib/features/overview/OverviewGroup.svelte
    - src/lib/features/overview/OverviewRows.svelte
    - src/lib/features/overview/OverviewBars.svelte
    - tests/unit/overview/overview-components-guard.test.ts
    - tests/unit/guards/design-tokens-guards.test.ts
    - tests/helpers/migration.ts
    - .planning/phases/14-design-unification/14-OVERVIEW-PIXEL-EVIDENCE.md

key-decisions:
  - "Every role was adopted with no fallback needed. All the sites the plan lists are exact matches (`t-label` 12/600/1.4 with uppercase and 0.06em, `t-caption` 12/400/1.4, `t-body` 14/400/1.5), and the pixel compare confirmed 4 of 4 pairs byte-equal on the first run, so no site had to keep its original px through token declarations."
  - "`.game` and `.absent` took `t-body` as well as the plan's named sites. The plan lets `.game` use the role only if the compare is clean, and `.absent` carried the same triple; both are exact matches and the compare is clean."
  - "The Bento joins the type sweep through a separate `STYLED` record, not through `NAMES`. `NAMES` also drives the 'no worker, state, storage or pins import' rule, which the bento breaks on purpose (it owns the pins and reads the state), so adding it there would have failed a test that is not about it."
  - "The old Bento test 'every font-size is 12 or 14px' became a role-based test. The bento now declares no size at all, so the old sweep would have found nothing; the new one resolves each role the bento applies through `type.css` and `tokens.css`, requires `t-caption`, `t-body` and `t-label` to be present, and asserts the resolved style has no `font-size` of its own."
  - "The before column of the retained evidence is a fresh capture of `901a9e1` taken the same day and by the same browser as the after column, not the 2026-10-26 set. Plan 14-19 found that set pre-dates a browser rasterisation change in the tile's shadow. The four PNG sizes equal the Baseline section's, and the Result section says so."

patterns-established:
  - "The migration allowlist reaches empty before the closing plan deletes it. A guard that required it to be non-empty had to relax: the allowlist test now requires an array, not a length, and plan 14-21 deletes the list and that test with it."

requirements-completed: [D-01, D-02, D-03, D-05, D-07, D-09, D-15, D-16]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "OverviewBento, OverviewGroup, OverviewRows and OverviewBars are on the shared tokens and exact-match roles, with no local .caption or .body, and they are off PENDING_FILES."
    verification:
      - kind: unit
        ref: "pnpm run test:unit - 164 files, 4902 passed, 9 expected fail, 0 failed (first run, the overview-grid flake did not trip)"
        status: pass
      - kind: unit
        ref: "pnpm run lint, pnpm run check (0 errors, 0 warnings), pnpm run build - all exit 0"
        status: pass
      - kind: e2e
        ref: "playwright (port 4174 temp config) tests/e2e/shell/overview-insights.spec.ts overview-insights-gaps.spec.ts master-detail-nav.spec.ts - 23 passed, 26.3s"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Overview contract test keeps every fact (gap 16px, container breakpoints 880 and 480, legend swatch 48 by 8, rows grid) and covers all five components through resolved tokens and role classes."
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-components-guard.test.ts - type sweep over the five components, bento role and hook tests; `grep -c OVERVIEW_SCALE_PX` on the file is 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Overview is pixel-identical to the pre-phase build apart from its own title box, and that result is committed."
    verification:
      - kind: other
        ref: "scratch harness `compare --strict --mask-title` over baseline-14-20 and after-14-20 - 4/4 pairs BYTE-EQUAL, equal PNG sizes, 0 differing pixels outside the mask"
        status: pass
      - kind: other
        ref: ".planning/phases/14-design-unification/14-OVERVIEW-PIXEL-EVIDENCE.md `## Result` - four BYTE-EQUAL rows, masked title box at 1040 and 880, `Working tree (src/): clean`, HEAD b440626"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-10-28
status: complete
---

# Phase 14 Plan 20: the remaining Overview components on the shared tokens and roles, and the committed D-15 proof

**The bento, the group, the rows and the bars read the shared tokens and exact-match roles, and the whole Overview is byte-equal to the pre-phase build outside its own title box at all four widths: 4 of 4 pairs, equal PNG sizes, 0 differing pixels.**

## Performance

- **Duration:** about 30 min
- **Completed:** 2026-10-28
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- The four remaining Overview components are on the shared type. `OverviewBento` lost its local `.caption`, `.body` and the grouped `.caption, .body, .label` rule: the provenance, hint and attribution paragraphs are `t-caption note`, the empty statement is `t-body statement`, the life label is `t-label label`, and the life entries and the dashed absent row are `t-body`. `OverviewGroup` takes `t-label` on the heading and `t-caption` on the two legend words, `OverviewRows` takes `t-body` on name and figure and `t-caption` on the sub-line, and `OverviewBars` takes `t-caption` on the peak line and the axis. Every one is an exact match for the triple it replaced, so every local size, weight and line height was deleted.
- The spacing is the shared scale. Every gap, margin and padding in the four files reads `--space-4/8/16/24`, and the nested rules follow G6b: `.game dt` and `dd` under `.game`, `.attribution a` and its focus ring under `.attribution`, `.grid.dense` and `.grid:has(...)` under `.grid`, and `.axis.spread`, `.axis.hours` and `.axis.hours .tick` under `.axis`.
- The D-15 proof is committed, not observed. The `Result` section of `14-OVERVIEW-PIXEL-EVIDENCE.md` records, for 1040, 880, 479 and 340px: before and after sizes (639 x 1793, 800 x 1739, 447 x 1959, 308 x 2181, equal), the masked title box at 1040 (`x=0 y=0 w=639 h=42`) and 880 (`x=0 y=0 w=800 h=34`), 0 differing pixels outside the mask, and `BYTE-EQUAL`, together with the measured commit `b440626` and `Working tree (src/): clean`.
- The contract test sweeps all five components. A `STYLED` record (the four plus the bento) drives the type sweep and the no-12px-gap check; the sweep collects both the declared sizes and the roles the markup applies, resolves each role through `type.css` and `tokens.css`, and requires that every one of the five applies at least one role.

## Task Commits

1. **Task 1: the four components, the contract test, the allowlist** - `b440626` (refactor)
2. **Task 2: the Overview pixel gate and the committed D-15 result** - `394fb0c` (docs)

**Plan metadata:** `14-20-SUMMARY.md` (docs: complete plan)

## Files Created/Modified

- `src/lib/features/overview/OverviewBento.svelte` - roles in the markup, the `note`, `statement` and `label` hooks, tokens and G6b nesting
- `src/lib/features/overview/OverviewGroup.svelte` - `t-label` and `t-caption`, tokens, `.grid` nesting
- `src/lib/features/overview/OverviewRows.svelte` - `t-body` and `t-caption`, tokens
- `src/lib/features/overview/OverviewBars.svelte` - `t-caption`, tokens, `.axis` nesting
- `tests/unit/overview/overview-components-guard.test.ts` - the five-component sweep and the Bento role and hook tests
- `tests/unit/guards/design-tokens-guards.test.ts` - the allowlist test no longer requires a non-empty list
- `tests/helpers/migration.ts` - `PENDING_FILES` is empty
- `.planning/phases/14-design-unification/14-OVERVIEW-PIXEL-EVIDENCE.md` - the `Result` section

## Decisions Made

- **Every role adopted, no fallback.** All sites are exact matches and the compare was clean on the first run.
- **`.game` and `.absent` took `t-body`** (same 14/400/1.5 triple), beyond the plan's named sites, because the plan allows it where the compare stays clean.
- **The Bento joins the sweep through `STYLED`, not `NAMES`,** because `NAMES` also carries the "no state or pins import" rule the bento breaks by design.
- **The before column is a fresh same-day capture** of `901a9e1`, because the stored 2026-10-26 set pre-dates a browser rasterisation change (found in plan 14-19). Its four PNG sizes equal the Baseline section's.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The allowlist guard required a non-empty `PENDING_FILES`**
- **Found during:** Task 1 (after emptying the list)
- **Issue:** `tests/unit/guards/design-tokens-guards.test.ts` line 652 asserted `PENDING_FILES.length > 0`. The plan removes the last four entries, so the list is empty, and the assertion failed. The file is not in the plan's `files_modified`.
- **Fix:** The length requirement became an `Array.isArray` check with a comment saying the list shrinks to nothing and plan 14-21 deletes it. The `not.toContain(AccountTimelinePane)` half of the test stays. The 'no pending file is clean' test is vacuous on an empty list, but its rule is still proved by the neighbouring `pendingListFailures` unit test.
- **Files modified:** `tests/unit/guards/design-tokens-guards.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/guards` passes.
- **Committed in:** `b440626`

**2. [Rule 1 - G6b nesting] `.attribution a:focus-visible` extended `.attribution a`**
- **Found during:** Task 1 (the G6b sweep)
- **Issue:** Nesting both `& a` and `& a:focus-visible` as siblings under `.attribution` left the second extending the first.
- **Fix:** `&:focus-visible` was nested inside `& a`. The flattened selector and specificity are unchanged.
- **Files modified:** `src/lib/features/overview/OverviewBento.svelte`
- **Verification:** the G6b sweep reports no offender; the pixel compare is byte-equal.
- **Committed in:** `b440626`

**3. [Rule 1 - Test form] The type sweep demanded a declared `font-size`**
- **Found during:** Task 1
- **Issue:** The sweep asserted `declared.length > 0`. After this plan no Overview component declares a `font-size` (the tile already did not), so the assertion could only fail, and the old Bento test `every font-size is 12 or 14px` would have found nothing either.
- **Fix:** The sweep requires `declared + roles > 0`, requires `roles > 0`, and requires each of the five components to apply at least one role. The Bento test became a role-based test that also asserts the bento's resolved style declares no `font-size`.
- **Files modified:** `tests/unit/overview/overview-components-guard.test.ts`
- **Committed in:** `b440626`

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 nesting, 1 test form)
**Impact on plan:** None on the pixels. All three are the plan's own rules applied to places its enumeration did not reach.

## Issues Encountered

- **The overview-grid flake did not trip.** `pnpm run test:unit` passed on its first run (164 files, 4902 passed, 9 expected fail); no re-run was needed.
- **The 4173 port stayed held by the scratch preview, as the dispatch said.** The e2e specs ran on 4174 through a temporary config in the repo root, deleted in a separate step; it is not in `git status` and was never committed. The pixel gate served the working-tree build with `vite preview --port 4174 --strictPort` and the baseline's committed `dist` with a read-only `python3 -m http.server` on 4175 (the baseline worktree's `node_modules` is still broken, as plan 14-19 found). Both servers are still running in the background and cannot be killed from this session.
- **Scratch harness edit.** `harness.mjs` now reads `WG_BEFORE` and `WG_AFTER` (a backup is `harness.mjs.bak20`), so a fresh pair is compared and recorded without touching the shared sets. Not in the repository.

## Known Stubs

None.

## Threat Flags

None. T-14-23 (a verdict recorded from a dirty tree, a stale build or a widened mask) is mitigated as the plan says: the source and test changes were committed first and the evidence was measured at `b440626` with `Working tree (src/): clean`; the mask is the union of the before and after title boxes only; PNG sizes are equal at every width; the build was made fresh before the capture.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 14-21 (close-out).

- Every file under `src/lib/features/overview/` is migrated and `PENDING_FILES` is empty. Plan 14-21 deletes `tests/helpers/migration.ts`, the allowlist tests in `design-tokens-guards.test.ts` that read it, and `OVERVIEW_SCALE_PX` in `tests/helpers/components.ts` (still used by `tests/e2e/shell/master-detail-nav.spec.ts`).
- Plan 14-21 owns the `Final re-run` section of the evidence file; the placeholder is intact.
- The graph refresh (`graphify update .`) is still plan 14-21's job and was not run.
- **Open items carried, still open and not edited:** OI-11 (`src/app.css` keeps the shell layout and the phone block), `tests/helpers/components.ts:63` ("Two readers still import it"), `tests/e2e/_support/helpers.ts:541` (30px numeral note), `tests/e2e/shell/master-detail-nav.spec.ts:72` (names the retired 30), `src/lib/features/logins/map-model.ts:36` ("ramp" in prose), and the neutral `.info` box border from 14-14.

---

*Phase: 14-design-unification*
*Completed: 2026-10-28*

## Self-Check: PASSED

- Files: OverviewBento, OverviewGroup, OverviewRows, OverviewBars, the guard test, the allowlist helper and the evidence file all exist and are committed.
- Commits: `b440626` and `394fb0c` are ancestors of HEAD.
- Evidence acceptance greps: four BYTE-EQUAL rows, two masked title boxes, one `Working tree (src/): clean`.
