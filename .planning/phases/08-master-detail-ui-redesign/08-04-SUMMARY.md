---
phase: 08-master-detail-ui-redesign
plan: 04
subsystem: ui
tags: [svelte, empty-state, dropzone, import-region, identity-header, playwright]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "ListPane, DetailPane, the Dashboard shell and the importRegion snippet from 08-02; keyboard model and phone screens from 08-03"
provides:
  - "Empty state: one large dashed drop target (dropzone-main) with the privacy sentence, centred in the detail pane"
  - "Identity header without card chrome, 26px/600 ink nickname collapsing to 18px at phone width"
  - "Import region restyled for the list pane: outlined Start over, underlined ink Clear link, compact dashed 44px target, parked at the bottom under a top rule"
  - "Nav spec (empty-state) and (stability) tests covering the empty, replace, cancel and failed-replace matrix"
affects: [08-05, 08-06, 08-07, 08-10]

actuals:
  tokens: 5150
  tasks: 3
  commits: 3
plan_head_before: 46b001710d68ef3292e8428006f38e9750055906
plan_head_after: ae6e8f806ef811b058de308bb1745decff654556
commits: 3

tech-stack:
  added: []
  patterns:
    - "One import region snippet renders in exactly one home: the empty detail (wrapped in empty-state / dropzone-main) or the list pane's .import-region, never both"
    - "A control is restyled by its data-testid attribute selector when the markup must stay byte-identical for the specs (the Clear link)"
    - "Page-side MutationObserver sampling to assert a transient state (processing) without racing it from the test runner"

key-files:
  created: []
  modified:
    - src/lib/shell/Dashboard.svelte
    - src/lib/shell/Dropzone.svelte
    - src/lib/shell/IdentityHeader.svelte
    - src/lib/shell/ImportBar.svelte
    - src/lib/shell/ListPane.svelte
    - tests/e2e/shell/master-detail-nav.spec.ts

key-decisions:
  - "The empty-state wrapper is a plain div with no role, so the Dropzone keeps its own test id, aria-label and single instance"
  - "The top rule above the list-pane import region lives on a ListPane wrapper (.import-region, margin-top auto), not inside ImportBar, so ImportBar stays container-agnostic"
  - "Clear my cached data is restyled through [data-testid='clear-data-control'] rather than a new class, so no markup line in ImportBar changed"
  - "Focus rings use var(--focus) (the same #1a73e8); the spinner keeps its literal blue"

patterns-established:
  - "Smooth scrolling (html scroll-behavior) means a focus-driven scroll is animated: geometry assertions on a just-focused element must poll or wait for the scroll to settle"

requirements-completed: []

coverage:
  - id: D1
    description: "First visit: muted list rows with the empty wording, 'No export loaded' nickname slot, one large dashed drop target with 'Your data stays in this tab.'; exactly one dropzone and file input in every state; the slim region moves into the list pane after an import and back to the detail, with focus on the dropzone, after a confirmed clear"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(empty-state)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A replace keeps the list and the old section on screen while processing; cancel returns focus to the dropzone and keeps the selection; a failed replace shows the failure banner in the notice slot and leaves the slim region, rows, nickname and selection alone; the confirm panel sits in the list pane inside the viewport"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(stability)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No legacy #3c4043 / #5f6368 literal in IdentityHeader, ImportBar or Dropzone; no font-size under 14px; contract test ids intact"
    verification:
      - kind: unit
        ref: "tests/unit/guards (phase5-layout-guards 14px floor) and tests/unit/charts/contrast.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual fidelity of the list pane and import region against the Main and Color-10-Ink artboards (hierarchy, selected-row bar versus hover tint, blue only on focus rings)"
    human_judgment: true
    rationale: "Hierarchy and tint distinctness cannot be asserted by a selector. Desktop screenshots (empty, loaded, confirm open) and a 375px confirm-panel check were looked at during execution and read correctly, but they are not a design-canvas comparison."
---

# Phase 8 Plan 04: Empty State and Import Region Summary

**The first visit is now a muted list beside one large dashed drop target with a privacy sentence; the same single import region moves to the foot of the list pane after an import and back after a clear, restyled for the Day 10 palette (26px ink nickname, outlined Start over, underlined Clear link, compact dashed target), with loading, cancel and failed-replace stability proven in the nav spec.**

## Accomplishments

- `Dashboard` wraps the import region in `empty-state` > `dropzone-main` when nothing is loaded, followed by the `EMPTY_STATE_PRIVACY` sentence, centred (min-height 60vh, max-width 640px). The wrapper is a plain div; the Dropzone keeps its own test id, aria-label and single instance.
- `Dropzone` full variant: 2px dashed `var(--faint)`, `var(--list)` fill, `var(--radius-card)`, 240px minimum, ink prompt. Compact variant: 1px dashed `var(--faint)`, transparent, `var(--radius-control)`, 44px minimum, 14px `var(--text)` prompt. The drag highlight and focus ring keep their blue; no attribute, prop or test id changed.
- `IdentityHeader` lost its card chrome (border, radius, white and dashed skeleton fills). The nickname, skeleton title and fallback title are 26px/600/1.3 `var(--ink)`, 18px under the project's 480px query, wrapping with `overflow-wrap: anywhere`. Captions and labels use `var(--muted)`, values `var(--text)`.
- `ImportBar`: the slim variant has no frame (16px/20px padding). Start over is the outlined 44px control, Clear my cached data is the underlined ink link-style button (styled via its test-id attribute selector, markup untouched), notices use `var(--text)` and `var(--border)`, `imported-at` is `var(--text)`. The failure banner and the spinner blue are unchanged.
- `ListPane` wraps the import region in `.import-region` (`margin-top: auto`, top rule `var(--border)`) so it sits at the bottom of the flex-column pane.
- Nav spec grew from 11 to 13 tests: `(empty-state)` and `(stability)`.

## Task Commits

1. Task 1 (tracer): `5ee8a97` feat(08-04): empty state with a large dashed drop target and the privacy sentence
2. Task 2: `e6d1137` feat(08-04): restyle the identity header and import region for the list pane
3. Task 3: `ae6e8f8` test(08-04): prove replace, cancel and failed replace keep the shell stable

Tracer gate: the Task 1 verify (nav spec 12/12, `tests/unit/guards`, `pnpm run check`, plus `pnpm run lint`) was green before Task 2 began.

## Verification

- `playwright test --project=chromium tests/e2e/shell/master-detail-nav.spec.ts`: 13 passed; `--list` prints `Total: 13 tests in 1 file`. Whole suite lists 250 tests in 25 files (248 + 2), under the 258 ceiling.
- `pnpm exec vitest run tests/unit` (whole unit suite): 82 files, 2546 tests passed (includes `tests/unit/guards` and `tests/unit/charts/contrast.test.ts`).
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean.
- Acceptance: `grep -cE "#3c4043|#5f6368"` prints 0 for IdentityHeader, ImportBar and Dropzone; `dropzone-main` appears once in `Dashboard.svelte`; the diff of `Dropzone.svelte` adds or removes no `data-testid`, `aria-label` or prop; the diff of `ImportBar.svelte` and `IdentityHeader.svelte` removes no `data-testid` line.
- Extra: `identity-privacy.spec.ts` 5/5 passed. A throwaway spec (deleted, never committed) confirmed at 375px that the confirm panel lands fully inside the 812px viewport with its cancel button focused and focus returns to Start over on cancel, and screenshots at 1280px (empty, loaded, confirm open) looked right.
- The rest of the Playwright suite was not run: it is expected red until plans 08-08 to 08-18, per the plan.
- Playwright was run through the throwaway config in the scratchpad (the installed browser build does not match the pinned version); no repo config changed.

## Deviations from Plan

None to scope. Judgement calls:

- **(stability) fixture:** the plan says a second `buildSampleExport()` is a different archive. The `(lifecycle)` test records that two builder calls within one second can produce identical bytes, so `(stability)` offers `buildRenamedRootExport()` as the "different valid export" instead, which cannot hit the duplicate path.
- **(stability) processing check:** the old section and rows are asserted through a page-side `MutationObserver` that samples at every DOM change while `processing-status` exists, then the test asserts at least one sample and that every sample had eight rows and the finance section. A runner-side `expect` could race a processing window of a few hundred milliseconds.
- **ListPane fix not needed:** the plan allowed a `scroll-margin` fix if the confirm panel were clipped. It was not (the pane scrolls it into view when its cancel button takes focus), so `ListPane.svelte` changed only for the `.import-region` wrapper. The page's smooth scrolling animates that focus scroll, so the viewport assertion polls.
- **Top rule placement:** put on a `ListPane` wrapper rather than on `ImportBar`, as the plan's ListPane paragraph describes.

**Total deviations:** 0 auto-fixed. **Impact:** none on scope.

## Known Stubs

- `src/lib/shell/Dashboard.svelte` (Overview branch): still the heading and intro paragraph only; plan 08-05 replaces it (carried over from 08-02 and 08-03).

## Threat Flags

None. No network, storage or URL surface added. T-08-13: header values remain Svelte-interpolated text and `identity-privacy.spec.ts` still passes. T-08-14: `(empty-state)` asserts one dropzone and one file input on the first visit, after an import and after a clear. T-08-16: `(stability)` asserts the confirm panel is inside the list pane and the viewport.

## Self-Check: PASSED

- FOUND: src/lib/shell/Dashboard.svelte, Dropzone.svelte, IdentityHeader.svelte, ImportBar.svelte, ListPane.svelte
- FOUND: tests/e2e/shell/master-detail-nav.spec.ts
- FOUND commits: 5ee8a97, e6d1137, ae6e8f8
