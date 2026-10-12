---
phase: 08-master-detail-ui-redesign
plan: 02
subsystem: ui
tags: [svelte, master-detail, snippets, playwright, e2e-helpers, provenance]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "selection-state.ts (PANE_IDS, PANE_SECTION, paneEntries, resolveSelection), shell copy in ui-copy.ts, Day 10 tokens and .shell layout rules in app.css"
provides:
  - "ListPane.svelte: product label, identity header, nav of eight aria-current buttons, import region slot"
  - "DetailPane.svelte: labelled region with id=detail, data-pane and tabindex=-1"
  - "Dashboard.svelte as the shell composition root: choice rune, resolveSelection-derived active pane, exactly one pane mounted"
  - "App.svelte passes the import region down as an importRegion snippet and keeps every import handler"
  - "DashboardSection: folder prop, 26px/18px pane title, provenance line, flat chrome"
  - "tests/e2e/_support/helpers.ts: openSection, ensureListScreen, importAndOpen, listRow, detailPane, expectSelected, rewired waitForImported/replaceExport/startOver, rules R1 to R10"
  - "tests/e2e/shell/master-detail-nav.spec.ts replacing scroll-nav.spec.ts"
affects: [08-03, 08-04, 08-05, 08-06, 08-07, 08-08, 08-09, 08-10, 08-11, 08-12, 08-13, 08-14, 08-15, 08-16, 08-17, 08-18, 08-19]

actuals:
  tokens: 12000
  tasks: 3
  commits: 3
plan_head_before: 10d4e67e372571491c20ab845372e6a92f260ad9
plan_head_after: 24181ad76253be8b2e82ed7853180cc721390fa4
commits: 3

tech-stack:
  added: []
  patterns:
    - "Selection is a $state choice stamped with the dataset; the reset is a pure $derived over (choice, result), never a write"
    - "App owns the import region and passes it to Dashboard as a Snippet prop, so there is exactly one Dropzone and one file input at any time"
    - "Section shell props come from one sectionProps(id, pane) helper over dashboard-status.ts; no second status derivation"
    - "E2E migration rules R1 to R10 live once, as the doc comment above openSection"

key-files:
  created:
    - src/lib/shell/ListPane.svelte
    - src/lib/shell/DetailPane.svelte
    - tests/e2e/shell/master-detail-nav.spec.ts
  modified:
    - src/App.svelte
    - src/lib/shell/Dashboard.svelte
    - src/lib/shell/DashboardSection.svelte
    - src/lib/shell/ImportSummary.svelte
    - tests/e2e/_support/helpers.ts
  deleted:
    - tests/e2e/shell/scroll-nav.spec.ts

key-decisions:
  - "The remaining pane branches (login history, vehicles, finance, payments, account, unsupported) landed in the Task 2 commit rather than Task 3, because the Task 2 (mount) and (lifecycle) tests open Finance"
  - "sectionProps takes the pane as well as the section id, so Playtime and Login history (both Activity_history) get their own heading while sharing one section id"
  - "Populated sections are flat; only the three greyed statuses keep the dashed panel, using --faint and --list"
  - "The provenance line carries the import counts and replaces the below-content caption, so importLine still resolves to exactly one element"

patterns-established:
  - "A pane is a {#if} branch in Dashboard: absent from the DOM, never hidden"
  - "Spec helpers wait on the identity header leaving its skeleton variant plus processing-status count 0, signals that exist on Overview"

requirements-completed: []

coverage:
  - id: D1
    description: "Two-pane shell: eight list rows, Overview landing, only the selected pane's section mounted (D-01, D-06)"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(tracer)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(mount)"
        status: pass
  - id: D2
    description: "Selection is plain component state: empty hash and empty web storage (D-03)"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(tracer)"
        status: pass
  - id: D3
    description: "First import and replace land on Overview; duplicate and failed replace keep the selection (D-03, D-04)"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(lifecycle)"
        status: pass
  - id: D4
    description: "All eight panes render through the one section shell with provenance, 26px titles and the DATA-04 wording"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(panes)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(wording)"
        status: pass
  - id: D5
    description: "Shared e2e helpers rewired and declared once (D-07)"
    verification:
      - kind: typecheck
        ref: "pnpm run check (tsc -b covers every spec importing the helpers)"
        status: pass
  - id: D6
    description: "chart-status live region and its source contract unchanged"
    verification:
      - kind: unit
        ref: "tests/unit/charts/tooltip-pin.test.ts#07-03: the one page-level live region"
        status: pass
---

# Phase 8 Plan 02: Two-Pane Shell, Shared E2E Helpers and Section Header Summary

**The single-scroll dashboard and its anchor nav are replaced by a list pane and a detail pane that mounts exactly one section at a time, with selection held as stamped component state and the e2e helpers rewired once for the whole migration wave.**

## Accomplishments

- `Dashboard.svelte` is the shell composition root. A `choice` rune plus `resolveSelection(choice, result)` decides the pane; `select()` stamps the choice with the dataset and scrolls the window to the top. Each pane is an `{#if}` branch, so an unselected block holds no worker query and no chart.
- `App.svelte` keeps every import handler, the `importBar` binding, the confirm panel and the focus return, and hands the import region to `Dashboard` as an `importRegion` snippet. The region renders in the detail pane while nothing is loaded and at the foot of the list pane afterwards, never both.
- `ListPane.svelte` is a `<nav>` of `<button>` rows (`aria-current="true"` on the selected one, muted class from `paneEntries`). `DetailPane.svelte` is the labelled region with `data-pane`.
- `DashboardSection.svelte` takes a `folder` prop, heads each pane with its title at 26px/600 (18px at phone width, wrapping), puts `From <Folder> · N files, M rows` in a `provenance` line, drops the card chrome from populated sections and keeps the dashed panel for the greyed ones. The caption weight in `ImportSummary` is now 400.
- `helpers.ts` declares `openSection`, `ensureListScreen`, `importAndOpen`, `listRow`, `detailPane` and `expectSelected` once, rewires `waitForImported`, `replaceExport` and `startOver`, and carries rules R1 to R10 above `openSection`. No existing export was removed.
- `scroll-nav.spec.ts` (20 tests) is deleted; `master-detail-nav.spec.ts` has five tests. The listed total is 242, under the 258 ceiling.

## Task Commits

1. Task 1 (tracer): `fe32e59` feat(08-02): two-pane shell tracer - list pane, detail pane, Overview and Playtime
2. Task 2: `ad36165` feat(08-02): shared master-detail e2e helpers and remaining pane branches
3. Task 3: `24181ad` feat(08-02): section header with provenance line, 26px title and flat chrome

Tracer gate: the Task 1 verify command (nav spec, `tooltip-pin` and shell unit tests, `pnpm run check`) was green, and `pnpm run lint` clean, before Task 2 began.

## Verification

- `pnpm exec playwright test --project=chromium tests/e2e/shell/master-detail-nav.spec.ts`: 5 passed.
- `pnpm exec vitest run` (whole unit suite): 82 files, 2545 tests pass, including `tooltip-pin.test.ts` unchanged and the CI budget guard.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean.
- `pnpm exec playwright test --list`: 242 tests in 25 files.
- Exactly one `<main` in `src` (App.svelte); `DashboardNav` is no longer imported by Dashboard; `scroll-margin-top` is gone from `DashboardSection.svelte`.
- The rest of the Playwright suite was not run: it is expected red until plans 08-08 to 08-18, per the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Remaining pane branches landed in the Task 2 commit**
- **Found during:** Task 2
- **Issue:** The Task 2 `(mount)` and `(lifecycle)` tests open Finance and wait for `dashboard-section-financial-data`, but at the end of Task 1 only Overview and Playtime rendered. The Task 2 verify command could not pass.
- **Fix:** Added the login history, vehicles, finance, payments, account and unsupported branches to `Dashboard.svelte` in the Task 2 commit. Task 3 then added the title, `folder` prop, provenance and flat chrome as planned.
- **Files modified:** src/lib/shell/Dashboard.svelte
- **Commit:** ad36165

**2. [Rule 1 - Bug] `openSection` section guard**
- **Found during:** Task 2
- **Issue:** The plan's wording compares `PANE_SECTION[pane]` with `'overview'`, which is not a `NavId`; the comparison would not type-check. Overview maps to `null`.
- **Fix:** Guard on `section !== null` only. 'Not yet supported' maps to its own section id and is waited on like the others.
- **Files modified:** tests/e2e/_support/helpers.ts
- **Commit:** ad36165

### Judgement calls

- `sectionProps(id, pane)` in Dashboard takes the pane so Playtime and Login history, which share the `activity-history` section id, get their own headings.
- The DashboardSection gap is 12px between the title, provenance line and content.
- The `.provenance` colour uses the existing hex (`#5f6368`) like the rest of the file; plan 08-07 migrates the hex colours to tokens.

## Known Stubs

- `src/lib/shell/Dashboard.svelte` (Overview branch): renders only the `Overview` heading and the `OVERVIEW_INTRO` paragraph. Intentional and planned: plan 08-05 replaces it with the Overview component.
- The import region in the detail pane (no export loaded) is the existing full ImportBar; plan 08-04 gives it the large dashed treatment and the privacy sentence.

## Threat Flags

None. No new network, storage or URL surface. T-08-04: all untrusted text goes through Svelte interpolation and the provenance folder is the canonical `SECTIONS` constant; `pnpm run lint` passes with `svelte/no-at-html-tags` on. T-08-05: the tracer test asserts an empty hash and empty `localStorage` and `sessionStorage` after selecting a pane. T-08-06: no fetch, XHR or navigation added; the ESLint network ban passes.

## Self-Check: PASSED

- FOUND: src/lib/shell/ListPane.svelte
- FOUND: src/lib/shell/DetailPane.svelte
- FOUND: tests/e2e/shell/master-detail-nav.spec.ts
- MISSING (intended): tests/e2e/shell/scroll-nav.spec.ts
- FOUND commits: fe32e59, ad36165, 24181ad
