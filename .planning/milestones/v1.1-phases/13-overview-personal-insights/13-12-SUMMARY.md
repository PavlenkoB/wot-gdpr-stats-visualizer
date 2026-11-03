---
phase: 13-overview-personal-insights
plan: 12
subsystem: ui
tags: [svelte5, overview, bento, view-transitions, roving-tabindex, pins, playwright]

requires:
  - phase: 13-overview-personal-insights
    provides: layoutGroups, fillSpans, createExpander, nextTileIndex, pins store, OverviewTile/Group/Bars/Rows, the overview channel (13-01 to 13-10)
provides:
  - OverviewBento.svelte, the composed Overview page body with every interaction
  - skeletonGroups, the loading and error frame with the loaded page's shape
  - runTransition, the transition helper for pin moves
  - a sparse-flow variant of the fill rule for the Pinned group
  - the page copy (hint, life list, absent row, provenance, proposed attribution)
  - composition and interaction browser tests on the real worker
affects: [13-13 e2e rewrite, 13-14 privacy and scale proof, 13-15 tank table and attribution checkpoint]

actuals:
  tokens: 19900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Page body = pure layout module + thin binder component; the component holds no layout decision"
    - "Focus restored by tile id after a tile is re-created (runTransition done callback + tick)"
    - "Non-reactive anchor list instead of a Map to satisfy svelte/prefer-svelte-reactivity"

key-files:
  created:
    - src/lib/features/overview/OverviewBento.svelte
  modified:
    - src/lib/shell/Overview.svelte
    - src/lib/features/overview/OverviewTile.svelte
    - src/lib/features/overview/OverviewGroup.svelte
    - src/lib/features/overview/overview-layout.ts
    - src/lib/features/overview/overview-grid.ts
    - src/lib/features/overview/overview-motion.ts
    - src/lib/ui-copy.ts
    - tests/e2e/shell/overview-insights.spec.ts
    - tests/unit/overview/overview-layout.test.ts
    - tests/unit/overview/overview-grid.test.ts
    - tests/unit/overview/overview-motion.test.ts
    - tests/unit/overview/overview-copy.test.ts
    - tests/unit/overview/overview-components-guard.test.ts
    - tests/unit/import/multi-account-keys.test.ts

key-decisions:
  - "Pinned (carried-forward item 1): the fill rule gets a sparse flow (gridHoles/fillSpans take a 'dense' | 'sparse' flag, layout and skeleton pass 'sparse' for pinned only). A measurement over all 65,535 pin subsets showed 13,325 at four columns where the dense-chosen widths left more holes under sparse placement than the optimum; none at two columns. The worked example (two heroes) was hole-free either way."
  - "The legend in the Tanks heading follows layoutGroups (only while the group holds a chart tile): with the oracle archive and default pins Tanks has no chart tile (tank pinned, class absent), so only Time shows low/peak. The plan's wording 'in the Time and Tanks headings' is conditional, not unconditional."
  - "OverviewGroup gained an optional busy prop so the skeleton grids carry aria-busy true."
  - "openIds is a readonly string array replaced on every change (svelte/prefer-svelte-reactivity forbids a mutable Set inside $state); behaviour is the plan's replace-never-mutate."
  - "Scroll anchoring keeps a plain array of {id, top} anchors instead of a Map, for the same lint rule; commit() flushes synchronously before re-measuring."
  - "runTransition takes an optional third argument 'done' (called right after update is applied) so focus can be restored on the re-created node; the plan's two-argument contract is unchanged."
  - "Requirements are NOT marked complete here: WINDOWS entry 29 says INSIGHT-03/04/07 are re-ticked after 13-14's browser check lands."

patterns-established:
  - "Tile identity: wrapper carries data-tile-id, face button too; keyboard code resolves the tile with closest('[data-tile-id]')"
  - "Pins are written in exactly one place (togglePinFor); the component guard asserts one call site across src/"

requirements-completed: []

coverage:
  - id: D1
    description: "The Overview draws provenance, hint, Wargaming life list, five groups, dashed absent rows, legend, attribution footer for the oracle archive on the real worker"
    requirement: "INSIGHT-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/overview-insights.spec.ts#(composition) the oracle archive draws provenance"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loading and error frames have the loaded page's shape (skeletonGroups)"
    requirement: "INSIGHT-05"
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-layout.test.ts#skeletonGroups: the frame has the shape of the loaded page"
        status: pass
    human_judgment: false
  - id: D3
    description: "Expand in place, roving tabindex, arrows, P to pin with focus by id, Escape, announcements through the page-level live region, pins written only on explicit action and restored after reload"
    requirement: "INSIGHT-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/overview-insights.spec.ts#(interaction) expand in place, roving tabindex, arrows, P to pin, Escape and focus by id"
        status: pass
      - kind: unit
        ref: "tests/unit/overview/overview-components-guard.test.ts#OverviewBento: pins and the announcer"
        status: pass
    human_judgment: false
  - id: D4
    description: "Layout feel, motion quality and legibility at 1040, 880, 479 and 340px"
    verification: []
    human_judgment: true
    rationale: "Visual feel and motion are not machine-checkable (13-VALIDATION manual-only row); screenshots were inspected by the executor at all four container widths but motion was not observed"

duration: 17min
completed: 2026-10-23
status: complete
plan_head_before: c4e19a11386fdb53d7e4b29829bece2411d8de9d
plan_head_after: efc3cf5ef209fe5d4edf7586ac6caa1252c954b4
---

# Phase 13 Plan 12: Compose the Overview page and its interactions Summary

**The Overview is now the approved personal-insights screen on the real worker: provenance, hint, life list, five groups with dashed absent rows, skeleton and error frames, and a keyboard-complete tile interaction model (expand in place, roving tabindex, P to pin with focus restored by id, Escape) with pins written in exactly one place.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-23T14:20:02Z
- **Completed:** 2026-10-23T14:37:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `OverviewBento.svelte` binds `layoutGroups` / `skeletonGroups`, `tileFace`, the pins store, the expander and the nav module to markup; `shell/Overview.svelte` is a thin composer (title, single channel ask, bento mount).
- Absent data is never a zero: one dashed row per group naming tiles and needs, with the column for a column-level absence (`needs account statistics (DAMAGE_MAX)` verified in the browser).
- Loading and error draw the real layout as an aria-hidden skeleton (same spans, `aria-busy` grids) so nothing moves when data arrives.
- Interaction: expand keeps the tile element and its x, y, width (measured), arrows/Home/End by DOM order and rectangles, P pins with `Pinned {name}, {n} pinned.` through the page-level live region (still exactly two `[aria-live]` nodes), Escape closes an open tile first and falls through to the pane when nothing is open, pins survive a reload and are written only on an explicit pin.
- Visual check on the built app at container widths 1038 / 779 / 720 / 447 / 308 (and 919 with feature tiles pinned): 4 / 2 / 1 columns as specified, zero horizontal overflow, long record names wrap inside tiles.

## Task Commits

1. **Task 1: composed page** - `6398769` (feat)
2. **Task 2: interaction** - `efc3cf5` (feat)

## Files Created/Modified

See frontmatter. New: `OverviewBento.svelte`. The two new browser tests and the unit extensions are in the listed test files.

## Decisions Made

See `key-decisions`. The carried-forward Pinned question is resolved with a real fix rather than a recorded limit (below).

## Carried-forward items

1. **Pinned sparse flow:** Resolved. With a feature tile pinned (Signature hour and Credits earned next to the two heroes) the browser shows no holes, but enumeration over all pin subsets found 13,325 (of 65,535) four-column cases where dense-chosen widths were worse under sparse placement. Added `GridFlow` (`'dense' | 'sparse'`) to `gridHoles`/`fillSpans`; `layoutGroups` and `skeletonGroups` use `'sparse'` for `pinned` only. New unit tests prove sparse never reorders, never widens heroes or metrics, never leaves more holes than not widening, never more than the dense-chosen widths, and strictly fewer for some subsets. Dense behaviour is unchanged (the sketch differential tests still pass).
2. **OverviewTile wiring:** done (`onopen`, expand motion, roving tabindex, P with focus by id, Escape, announcements via the page context; the Overview adds no live region).
3. **Tracer spec:** extended to three tests; the tracer's invariants are kept; dates use `formatDay(…, 'en-US')` / `formatMonthYear(…, 'en-US')`.
4. **Tank table / attribution:** the committed table has zero rows, so Favourite class is absent and record tanks read "vehicle not recorded"; the attribution wording is the PROPOSED text and 13-15's blocking checkpoint confirms or replaces it.
5. **Six red specs untouched:** account-timeline-perks, dashboard, device-info, master-detail-nav and two multi-account specs fail on the retired `ov-chip-*` / `ov-card-*` hooks, exactly the six 13-13 rewrites. The full e2e run was 262 passed, 6 failed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Keyed-each audit**
- **Found during:** Task 1
- **Issue:** `tests/unit/import/multi-account-keys.test.ts` fails on any unaudited keyed `{#each}`; the bento adds four.
- **Fix:** Added audit rows (index, group.id, entry.tile.id, game.token) with reasons.
- **Files modified:** tests/unit/import/multi-account-keys.test.ts
- **Commit:** 6398769

**2. [Rule 3 - Blocking] Lint rule on Set and Map in component state**
- **Found during:** Tasks 1 and 2
- **Issue:** `svelte/prefer-svelte-reactivity` rejects `new Set` / `new Map` in the bento.
- **Fix:** `openIds` is a replaced array; scroll anchors are a plain array. Same replace-never-mutate behaviour.
- **Commit:** 6398769, efc3cf5

**3. [Rule 2 - Missing functionality] `busy` prop on OverviewGroup**
- **Issue:** the spec requires skeleton grids to carry `aria-busy="true"`; the group owns the grid element.
- **Fix:** optional `busy` prop. **Commit:** 6398769

**4. [Plan wording] Legend in Tanks**
- The e2e asserts the legend is in Time and absent from Pinned, Tanks, Records and Totals for the oracle archive (Tanks has no chart tile there), instead of the plan's "Time and Tanks". The layout unit tests cover the Tanks-with-chart case.

**5. [Scope addition] Sparse fill variant** - see carried-forward item 1. Touches `overview-grid.ts`, which the plan did not list.

**6. [Plan wording] The listed-test budget**
- The tracer header said exactly one test; it now says three. `playwright test --list` goes 266 to 268, under the 273 the CI limits cover; no limit moved.

## Issues Encountered

- One transient unit-suite failure on a full run (not reproducible on rerun, two clean full runs after). Not attributed to this plan.

## Known Stubs

None. The attribution wording is deliberate proposed text, tracked by plan 13-15's checkpoint.

## Threat Flags

None. The only external reference is an anchor with `target="_blank"` and `rel="noreferrer noopener"` (no request until clicked); no dynamic import, no network global; the component guard enforces this and the single `writePins` call site (T-13-33 to T-13-36).

## Next Phase Readiness

- 13-13 can rewrite the six red specs against the new test ids (`ov-tile-*`, `ov-group-*`, `ov-absent-*`, `ov-provenance`, `ov-life-*`).
- INSIGHT-03/04/07 requirement ticks are deferred to after 13-14 per WINDOWS entry 29; INSIGHT-05/08 were also left for the same re-tick.
- Manual check still open: motion feel of expand and pin moves (not observable headless).

## Self-Check: PASSED

- `src/lib/features/overview/OverviewBento.svelte` exists; commits `6398769` and `efc3cf5` are ancestors of HEAD.
- `pnpm run check`, `pnpm run lint`, `pnpm run test:unit` (4772 passed), `pnpm run build` green; overview-insights spec 3 of 3 passed on the real worker.
