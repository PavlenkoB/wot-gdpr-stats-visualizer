---
phase: 261001-2qr-add-hover-outline-to-calendar-heatmap-ce
plan: 261001-2qr
subsystem: ui
tags: [svelte, svg, calendar-heatmap, hover, playwright]
requires: []
provides:
  - pointer-driven hover outline on the calendar heatmap cell under the pointer
affects: [src/lib/components/CalendarHeatmap.svelte]
tech-stack:
  added: []
  patterns: [state-driven SVG overlay ring shared with the keyboard focus ring through one selector list]
key-files:
  created: []
  modified:
    - src/lib/components/CalendarHeatmap.svelte
    - tests/e2e/playtime-charts.spec.ts
    - tests/unit/playtime-charts.test.ts
    - .planning/phases/04-activity-time-dashboards/04-UI-SPEC.md
decisions:
  - "Hover outline is an SVG overlay pair driven by pointer state, not a CSS :hover stroke on the cell"
  - "No forced-colors rule added; parity with the focus ring asserted instead"
metrics:
  duration: ~25 min
  completed: 2026-10-01
status: complete
commits: 4
plan_head_before: 78d038a00f80c940608ec0852d8d9c20adb5547c
actuals:
  tokens: 5300
  tasks: 3
  commits: 4
---

# Phase 261001-2qr Plan 261001-2qr: Calendar hover outline Summary

Hovering a calendar heatmap cell now draws the keyboard focus ring's own two-tone outline (3px `#1a73e8` over 1px `#ffffff`) on that cell only, as a pointer-driven SVG overlay that leaves fill, layout, the tooltip and keyboard focus untouched.

## Decision: overlay, not CSS `:hover`

The orchestrator asked for a CSS-only `:hover` stroke if the existing focus styling was CSS-based. It is not: the keyboard ring is a state-driven two-rect SVG overlay drawn last in each year svg, and `.cell` sets `outline: none`. A stroke on a cell rect is covered on its right and bottom by later sibling cells (there is no z-index for SVG children), which gives a lopsided ring. So the hover ring uses the same overlay construction, driven by `hoverDay` (set in `onPointerOver`, cleared in `onPointerOut` beside `onTip(null, null)`), resolved through `cellsByDay` into `hoverCell`, and rendered before the keyboard ring so the keyboard ring stays on top. The ring CSS is shared with the focus ring via one selector list per rule (`.focus-ring, .hover-ring` and `.focus-ring-inner, .hover-ring-inner`), so the two cannot drift. No transition, no `style`, no `data-*` on the ring rects.

## Tasks

| Task | Commit | Notes |
| ---- | ------ | ----- |
| 1 RED: failing e2e | 1f4459d | Failed on `toHaveCount(2)` received 0 (behavioural, not a selector or fixture error) |
| 1 GREEN: component | ef8a887 | State, derived cell, handlers, overlay markup, shared CSS |
| 2 Expand tests | 2e751a0 | e2e phases (a) to (e) in the same test; one unit source-contract test |
| 3 UI-SPEC | 651ec9f | Two hunks: one new table row, one appended clause on accent item 2 |

## Mutation run (Task 2, Part 3)

Deleting `pointer-events: none` from the shared ring rule made the test fail.

- First run, unmodified test: failed earlier than phase (b), at the computed-style check: `pointerEvents: "none"` expected, received `"auto"`.
- To show phase (b) itself has teeth, the paint check was also temporarily relaxed (not committed). The test then failed at the follow-the-pointer poll: `Error: Timeout 5000ms exceeded while waiting on the predicate` at the `expect.poll(...).toBe(true)` that waits for the ring to centre on `2021-12-30` after moving into the old ring's band. So the ring band intercepted the pointer.
- Both the component and the spec were restored from copies and `git status -- src` was clean before committing.

## Forced-colors finding

There is no `forced-colors` rule anywhere in `src/`, `tests/` or `index.html`, so none was added. The e2e test sets `emulateMedia({ forcedColors: 'active' })` with both rings on screen and asserts the hover outer and inner rects resolve to the same `fill`, `stroke`, `stroke-width` and `pointer-events` as the focus outer and inner rects, and that the hover outer `fill` is `none`. It passed, so there is no pre-existing fill defect in the keyboard ring to report.

## Deviations from Plan

**1. [Rule 3 - Blocking] Port 4173 already held by a preview server this run did not start**
- **Found during:** Task 1 RED run (`http://localhost:4173 is already used`; PID 76177, a `vite preview` in another terminal).
- **Fix:** did not kill it. Used a temporary untracked `playwright.local.config.ts` (spreads the repo config, port 4199) for all e2e runs, including the full suite, and deleted it before lint and before any commit. It was never staged.

**2. [Rule 1 - Bug in own test] Bounding-box comparisons**
- **Found during:** Task 1 GREEN and Task 2.
- **Issue:** `getBoundingClientRect` on an SVG rect includes stroke, so "width is cell + 3" failed (16 vs 14); cell snapshots in viewport coordinates differed after `hover()` scrolled the page.
- **Fix:** ring widths are read from the `width` attribute; the cell snapshot uses document coordinates. Centre comparisons still use bounding boxes (strokes are symmetric). These fixes went in the feat commit with the component.

**3. [Minor] `focusRings` helper added in Task 2, not Task 1**
- Unused in Task 1, and the repo's ESLint rejects unused functions, so it was introduced where it is first used.

## Results

- New e2e test: `calendar: (hover ring) ...`; the section header now says "four tests". The file has 15 top-level `test(` calls (the plan's acceptance count).
- Full gate, all green: `pnpm run lint`, `pnpm run check`, `pnpm run test:unit` (27 files, 883 tests), full Playwright (119 passed, run via the port-4199 config).
- `package.json` and `pnpm-lock.yaml` untouched; `src` diff is only `CalendarHeatmap.svelte`.
- No commit carries a `Co-Authored-By` trailer or a "Generated with" line.

## Known Stubs

None.

## Threat Flags

None. The ring rects carry no `data-*`, `aria-*`, text or inline style; no network surface added.

## Follow-up (out of scope)

`HourGrid.svelte` has the same gap (no hover outline on the weekday by hour cells). The request named the year calendar only, so it was not touched. The same overlay pattern would apply.

## Self-Check: PASSED

- `src/lib/components/CalendarHeatmap.svelte`, `tests/e2e/playtime-charts.spec.ts`, `tests/unit/playtime-charts.test.ts`, `04-UI-SPEC.md` exist and are modified.
- Commits 1f4459d, ef8a887, 2e751a0, 651ec9f are present in `git log`.
