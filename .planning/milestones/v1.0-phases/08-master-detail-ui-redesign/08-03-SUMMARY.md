---
phase: 08-master-detail-ui-redesign
plan: 03
subsystem: ui
tags: [svelte, keyboard-navigation, focus-management, phone-layout, playwright]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "ListPane, DetailPane and the Dashboard shell from 08-02; stepSelection, resolvePhoneView, PHONE_MEDIA_QUERY and the shell copy from 08-01"
provides:
  - "Nav-scoped j/k/ArrowUp/ArrowDown selection with clamping and focus-follows-selection"
  - "Enter-into-detail, Escape-back-to-list with chart/field/dialog exclusions, keyboard hint and skip link"
  - "Phone list screen and detail screen with a 48px back bar, and detail content that is not mounted while the list screen shows"
  - "SIDE_BY_SIDE_MIN_WIDTH_PX and SIDE_BY_SIDE_MEDIA_QUERY"
  - "ListPane.focusSelected(), DetailPane.focus()"
affects: [08-04, 08-05, 08-06, 08-07]

actuals:
  tokens: 20000
  tasks: 3
  commits: 3
plan_head_before: 3fe0e21ffb838742b47bed48d43b50381aa02372
plan_head_after: fa3af63ad65807c2a5afd40fb47b2acce6cf4234
commits: 3

tech-stack:
  added: []
  patterns:
    - "Each key is heard by the element that owns it (nav, detail root); no document or window key listener"
    - "Component-local focus choreography: Dashboard holds bind:this refs and small async functions (onselect, onenter, back, onescape)"
    - "A pane's content is gated on {#if detailMounted}; the pane root stays in the DOM and CSS hides it"
    - "A chart surface is excluded from the shell's Escape by [data-tooltip-surface], because chart Escape handlers do not call preventDefault"

key-files:
  created: []
  modified:
    - src/lib/shell/ListPane.svelte
    - src/lib/shell/DetailPane.svelte
    - src/lib/shell/Dashboard.svelte
    - src/lib/shell/DashboardSection.svelte
    - src/lib/shell/selection-state.ts
    - tests/unit/shell/selection-state.test.ts
    - tests/e2e/shell/master-detail-nav.spec.ts

key-decisions:
  - "The DetailPane root is kept in the DOM on the phone list screen (hidden by the app.css data-view rule) and only its content is gated, so id=detail and data-pane always exist"
  - "A keyboard (j/k) selection never changes the phone screen or the focus target; only a pointer selection, Enter or the skip link opens the detail screen"
  - "On the phone, Escape in the detail goes back to the list screen (back()), elsewhere it focuses the selected row"
  - "The import-region buttons are raised to 48px with .pane-list :global(button:not(.row)) so the 64px row heights are not overridden by a higher-specificity rule"

patterns-established:
  - "Pointer selection moves focus into the detail pane when the layout is stacked (below 900px) or phone, so the browser scrolls it into view"

requirements-completed: []

coverage:
  - id: D1
    description: "j, k and arrows move the selection only from a focused row, clamp at the ends, move focus with it, and do nothing from the detail pane or with a modifier (D-05)"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(keyboard)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Enter goes into the detail, Escape returns to the selected row, hint shows only while the nav has focus, skip link moves focus without writing a hash"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(enter-escape)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Escape inside a calendar cell is left to the chart"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(escape-in-chart)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A pointer selection on a stacked layout moves focus to the detail pane"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(stacked)"
        status: pass
    human_judgment: false
  - id: D5
    description: "At 375px the list and detail are separate screens, the back button is at least 44px, the detail content is not mounted on the list screen and a reopened table has rows"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(phone-screens)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(phone-empty)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual fidelity of the phone list rows (64px rows, chevron, grouped look) and the back bar against the design canvas"
    human_judgment: true
    rationale: "Heights and mounting are asserted; spacing, chevron weight and the grouped look are a visual judgement the plan does not test"
---

# Phase 8 Plan 03: Keyboard Model and Phone Screens Summary

**Scoped j/k/Enter/Escape keyboard navigation with explicit focus choreography, plus a phone list screen and detail screen joined by a 48px back bar, where the detail content is never mounted inside a hidden pane.**

## Accomplishments

- `ListPane` handles `j`, `k`, `ArrowDown`, `ArrowUp` and `Enter` on its `<nav>` only. Modified keys and non-row targets are ignored, the selection clamps (no wrap), focus follows the selection after a tick, and the arrows and Enter are consumed so the page does not scroll and a button's Enter-click does not select a second time. `focusSelected()` is exported.
- `DetailPane` handles `Escape` on its root and bails on `defaultPrevented`, inputs, selects, textareas, contenteditable, dialogs and `[data-tooltip-surface]`. The source documents why: chart Escape handlers (calendar, hour grid, map, and `ChartTooltip`'s capture listener) do not call `preventDefault`. A mutation check (removing the exclusion) made `(escape-in-chart)` fail.
- `ListPane` renders the "Move with j and k" hint inside the nav (always occupying its space, `visibility` toggled by `nav:focus-within`) and a clip-hidden skip link as the pane's first focusable element; its click is prevented and routed to `onenter()`, so no hash is written.
- `Dashboard` holds the choreography as `onselect(id, how)`, `onenter()`, `back()` and `onescape()` with no document or window key listener. A pointer selection moves focus into the detail on a phone or on any stacked layout (`SIDE_BY_SIDE_MEDIA_QUERY` false); on the side-by-side layout focus stays on the row.
- Phone: `phone` is set from one `matchMedia(PHONE_MEDIA_QUERY)` listener removed on teardown; `viewChoice` and `view = resolvePhoneView(...)` drive `data-view` on `.shell`; `detailMounted = !(phone && view === 'list')` gates the pane content. `DetailPane` renders a 48px, non-sticky, three-column bar with the `‹ Sections` button and the centred title. `DashboardSection` clips its `<h2>` at 480px (kept in the accessibility tree). `ListPane` gets 64px rows with a decorative chevron, a 52px footer row, a grouped look and 48px import buttons.
- `selection-state.ts` gains `SIDE_BY_SIDE_MIN_WIDTH_PX` (900) and `SIDE_BY_SIDE_MEDIA_QUERY`, pinned in the unit test.

## Task Commits

1. Task 1 (tracer): `1c1827c` feat(08-03): j/k keyboard selection scoped to the list nav
2. Task 2: `d66d696` feat(08-03): Enter and Escape focus choreography, key hint and skip link
3. Task 3: `fa3af63` feat(08-03): phone list and detail screens with a back bar

Tracer gate: the Task 1 verify (nav spec 6/6, `pnpm run check`) and `pnpm run lint` were green before Task 2 began.

## Verification

- `playwright test --project=chromium tests/e2e/shell/master-detail-nav.spec.ts`: 11 passed (5 from 08-02, plus keyboard, enter-escape, escape-in-chart, stacked, phone-screens, phone-empty), matching the plan's expected 11.
- `pnpm exec vitest run tests/unit` (whole unit suite): 82 files, 2546 tests passed, including `tests/unit/guards` (14px floor, CI budget) and `tests/unit/shell`.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean.
- `playwright test --list`: 248 tests in 25 files (242 + 6), under the 258 ceiling.
- Acceptance greps: no `svelte:window`/`svelte:document` in `ListPane`/`Dashboard`; no `sticky` in `DetailPane.svelte`; exactly one `max-width: 480px` in `src/app.css`.
- The rest of the Playwright suite was not run: it is expected red until plans 08-08 to 08-18, per the plan.

## Deviations from Plan

### Auto-fixed Issues

None to the plan's behaviour. Two environment notes and small judgement calls:

- **Environment:** The installed Playwright browser build (`chromium-1194`) does not match the revision Playwright 1.63 expects (`1243`), so `pnpm exec playwright test` could not launch a browser as configured. The nav spec was run through a throwaway config kept outside the repo (scratchpad) that re-exports `playwright.config.ts` and sets `launchOptions.executablePath` to the installed Chromium with `--no-sandbox`. No project file was changed. Same specs, same web server.
- **Judgement:** `ListPane` reuses `data-testid^="list-row-"` to recognise a row target (validated against `PANE_IDS`) rather than adding a new attribute.
- **Judgement:** The Overview stub's `<h2 class="pane-title">` in `Dashboard.svelte` is not clipped at phone width, so Overview shows its title in the bar and in the content until plan 08-05 replaces that stub.
- **Judgement:** `(keyboard)` uses `Control+k` at the last row instead of `Control+j`, and also probes (test-side bubble listener) that ArrowDown was default-prevented, because a short page cannot show a scroll change.

**Total deviations:** 0 auto-fixed. **Impact:** none on scope.

## Known Stubs

- `src/lib/shell/Dashboard.svelte` (Overview branch): still the heading and intro paragraph only; plan 08-05 replaces it (carried over from 08-02).

## Threat Flags

None. No network, storage or URL surface added. T-08-09: the key handler is on the nav only and `(keyboard)` asserts j and ArrowDown from the detail pane change nothing. T-08-10: `(escape-in-chart)` proves the shell's Escape leaves a chart alone. T-08-11: the skip link's click is prevented and `(enter-escape)` asserts `location.hash` stays empty. T-08-12: one `matchMedia` listener, removed in the `onMount` cleanup.

## Self-Check: PASSED

- FOUND: src/lib/shell/ListPane.svelte, DetailPane.svelte, Dashboard.svelte, DashboardSection.svelte, selection-state.ts
- FOUND: tests/unit/shell/selection-state.test.ts, tests/e2e/shell/master-detail-nav.spec.ts
- FOUND commits: 1c1827c, d66d696, fa3af63
