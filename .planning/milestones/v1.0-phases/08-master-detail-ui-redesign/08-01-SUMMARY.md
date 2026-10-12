---
phase: 08-master-detail-ui-redesign
plan: 01
subsystem: ui
tags: [svelte, pure-functions, css-tokens, contrast, master-detail, copy]
status: complete

requires:
  - phase: 03-dashboard-shell-account-identity
    provides: dashboard-status.ts (navEntries, sectionCounts, unsupportedEntries), the single status derivation
provides:
  - "selection-state.ts: PANE_IDS vocabulary, PANE_SECTION, paneEntries, resolveSelection, stepSelection, resolvePhoneView, PHONE_MEDIA_QUERY"
  - "ui-copy.ts: PANE_TITLES, row headline/summary formatters, Overview chip formatters, shell chrome strings"
  - "app.css: fifteen neutral Day 10 tokens and the .shell / .pane-list / .pane-detail layout rules"
  - "contrast.test.ts: token-value agreement with the UI-SPEC and recomputed neutral ratios"
affects: [08-02, 08-03, 08-04, 08-05, 08-06, 08-07, 08-08, 08-19]

actuals:
  tokens: 10400
  tasks: 3
  commits: 4
plan_head_before: 8b2732dd04ffae9a8c89785d529b3e3bb4048807
plan_head_after: ec423976ae66863bcb9144a14e9965a3a36fd427
commits: 4

tech-stack:
  added: []
  patterns:
    - "Pane rows are derived from ClassifyResult alone, through navEntries/sectionCounts/unsupportedEntries; no second status computation and no worker query from the always-mounted list"
    - "Selection and phone view carry a dataset stamp (importedAt); a stale stamp resets to Overview / list, so first import, replace and clear share one rule"
    - "Neutral chrome tokens live once in :root; data colours are untouched and re-pinned by test"

key-files:
  created:
    - src/lib/shell/selection-state.ts
    - tests/unit/shell/selection-state.test.ts
  modified:
    - src/lib/ui-copy.ts
    - tests/unit/shell/ui-copy.test.ts
    - src/app.css
    - tests/unit/charts/contrast.test.ts

key-decisions:
  - "resolveSelection never vetoes a muted pane: a user's own click on a muted row shows the dashed 'Not in this export' panel, and only a dataset-stamp change resets to Overview (reconciles D-03 and D-04)"
  - "Playtime and Login history both map to activity-history, so they are muted or available together"
  - "stepSelection clamps instead of wrapping and reaches muted rows, so a held key cannot loop and a keyboard user can read every detail"
  - "resolvePhoneView returns 'detail' with no export (the drop target lives there) and 'list' on a stale stamp"

patterns-established:
  - "Row strings use the canonical SECTIONS folder constant, never a zip-entry name (T-08-01)"
  - "Copy pins in ui-copy.test.ts type the literal out rather than reading it back from the constant"

requirements-completed: []

coverage:
  - id: D1
    description: "Pure pane model: eight ids in fixed order, one derivation of row headline/summary/muted state from ClassifyResult"
    verification:
      - kind: unit
        ref: "tests/unit/shell/selection-state.test.ts#paneEntries"
        status: pass
  - id: D2
    description: "resolveSelection / resolvePhoneView / stepSelection behaviour including stale-stamp reset and clamps"
    verification:
      - kind: unit
        ref: "tests/unit/shell/selection-state.test.ts#resolveSelection"
        status: pass
  - id: D3
    description: "Shell, Overview and phone-bar copy pinned"
    verification:
      - kind: unit
        ref: "tests/unit/shell/ui-copy.test.ts#08-01"
        status: pass
  - id: D4
    description: "Neutral tokens and shell layout rules in app.css with recorded contrast ratios"
    verification:
      - kind: unit
        ref: "tests/unit/charts/contrast.test.ts#Day 10 neutrals (08-01)"
        status: pass
---

# Phase 8 Plan 01: Pane Model, Shell Copy and Day 10 Stylesheet Summary

**A pure pane model (eight ids, one derivation from ClassifyResult, stamp-based selection reset), the shell's copy constants, and the neutral Day 10 tokens plus master-detail layout rules in `app.css`; nothing is mounted yet.**

## Accomplishments

- `src/lib/shell/selection-state.ts` is a no-DOM, no-runes module. `paneEntries` turns a `ClassifyResult` (or `null`) into eight rows, built only from `navEntries`, `sectionCounts`, `unsupportedEntries` and `SECTIONS`. Absent folders read "Not in this export", present-but-empty folders read "This export contains no rows for <Folder>", and the two never collapse (DATA-04).
- `resolveSelection` and `resolvePhoneView` compare an `importedAt` stamp, so a first import, a replace and a clear all land on Overview (list on phone) while a duplicate drop or failed replace keeps the selection. `stepSelection` clamps over the eight rows.
- `ui-copy.ts` gained the pane titles, row formatters, Overview chips, Open link, back label, keyboard hint, skip link, privacy line, provenance prefix and product label, each pinned in `ui-copy.test.ts`. `SECTION_NOTE_USER_INFO` no longer says "above".
- `app.css` carries the fifteen neutral tokens (values taken from the UI-SPEC Build Notes), the unbounded `main`, `.shell`, `.pane-list` (sticky and internally scrolling from 900px), `.pane-detail` (no overflow declaration), the list-xor-detail rule inside the one 480px block, link and focus rules and `.btn`.
- `contrast.test.ts` parses the Build Notes block, asserts each token matches `:root`, re-pins the ramp and flow values, and recomputes the recorded ratios.

## Task Commits

1. Task 1 (tracer): `0792a44` feat(08-01): pane model and resolved selection as pure module
2. Task 2 RED: `ad247f0` test(08-01): stepSelection, resolvePhoneView and shell copy pins
3. Task 2 GREEN: `b7d7985` feat(08-01): keyboard step, phone view and shell chrome copy
4. Task 3: `ec42397` feat(08-01): neutral Day 10 tokens and shell layout rules in app.css

Tracer gate: the Task 1 verify command (shell unit tests plus `pnpm run check`) was green before Task 2 began.

## Verification

- `pnpm exec vitest run` (whole unit suite): 82 files, 2545 tests pass.
- `pnpm run check`: 0 errors, 0 warnings.
- `pnpm run lint`: clean.
- `git diff --stat -- src/lib/shell/dashboard-status.ts tests/unit/shell/dashboard-status.test.ts package.json pnpm-lock.yaml`: empty.
- `grep -c "max-width: 480px" src/app.css`: 1.
- Playwright was not run, per the plan's execution note (the e2e suite goes red from 08-02 until the migration wave).

## Deviations from Plan

None that change behaviour. Two small judgement calls:

- The below-tablet rule is `@media (max-width: 899px)` rather than `max-width: 900px`, so it cannot overlap the `min-width: 900px` rule at exactly 900px. It also resets `position` and `height` explicitly.
- Task 2 was committed as a separate RED test commit then a GREEN feat commit (the task is `tdd="true"`), so the plan has four commits rather than three.
- An exported `PhoneView` type was added alongside `PhoneViewChoice` so the return type of `resolvePhoneView` has a name.

## Known Stubs

None.

## Threat Flags

None. The module is pure, persists nothing and touches no storage, URL or network. T-08-01 is mitigated: row summaries use the canonical `SECTIONS` folder constant, asserted by a test with a hostile entry name; the identity region is returned as plain text.

## Self-Check: PASSED

- FOUND: src/lib/shell/selection-state.ts
- FOUND: tests/unit/shell/selection-state.test.ts
- FOUND commits: 0792a44, ad247f0, b7d7985, ec42397
