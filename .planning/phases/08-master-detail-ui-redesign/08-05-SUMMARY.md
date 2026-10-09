---
phase: 08-master-detail-ui-redesign
plan: 05
subsystem: ui
tags: [svelte, overview, status-chips, summary-cards, playwright, vitest]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "paneEntries and the pane vocabulary from 08-01, the shell and detail focus from 08-02/08-03, the empty state from 08-04"
provides:
  - "overview-model.ts: pure overviewChips and overviewCards, both filters over paneEntries"
  - "Overview.svelte: heading, intro, three status chips and six summary cards with a 300px auto-fit grid"
  - "Dashboard openPane(id): select, open the detail screen, focus the detail pane"
  - "Nav spec (overview) test"
affects: [08-06, 08-07, 08-08, 08-10]

actuals:
  tokens: 6600
  tasks: 2
  commits: 2
plan_head_before: 5ff3df5c62b8368de698ce6d7478e4078dbc259a
plan_head_after: 27175621e3a7e4b2c65e9d5c4af0e13df9aa6b32
commits: 2

tech-stack:
  added: []
  patterns:
    - "Overview chips and cards are filters over paneEntries, so a chip, a card and a list row share one derivation"
    - "A surface with no worker query imports no worker client (asserted by grep), so it cannot supersede a section's channel"

key-files:
  created:
    - src/lib/shell/overview-model.ts
    - src/lib/shell/Overview.svelte
    - tests/unit/shell/overview-model.test.ts
  modified:
    - src/lib/shell/Dashboard.svelte
    - tests/e2e/shell/master-detail-nav.spec.ts

key-decisions:
  - "Absent and empty are counted apart: the 'not in this export' chip counts only reason 'no-export'; a present zero-row pane is in no chip and its card carries the 'no rows' wording (DATA-04)"
  - "The Overview is counts-based: the sketch's sparkline, stacked bar and data-backed headlines are not part of this plan because they would need worker queries from a surface mounted beside no other section"
  - "The Account card's summary is 'Account created <date>' built from identity.createdAt; the nickname is never read, so it still appears once in the document"
  - "Activity_history absent counts as 2 in the absent chip, because the chip counts card panes (Playtime and Login history) rather than folders"

patterns-established:
  - "An unavailable card is a div with class na and no control; an available card's only interactive child is its ov-open-<id> button"

requirements-completed: []

coverage:
  - id: D1
    description: "Overview is the landing view after an import: three chips computed from the fixture counts, six cards each with an open control, the account card showing region and created date but not the nickname"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(overview)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Activating a card's control selects that pane, mounts its section and moves focus into the detail pane"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(overview)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A missing Payment_history renders a dashed na card with no link reading 'Not in this export', and the chips read 5 with data and 1 absent; a zero-row one is counted in neither chip"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(overview)"
        status: pass
      - kind: unit
        ref: "tests/unit/shell/overview-model.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Overview issues no worker query: neither new file imports a worker client"
    verification:
      - kind: command
        ref: "grep -En \"^\\s*import .*(ingest-client|query-client|worker-client)\" src/lib/shell/overview-model.ts src/lib/shell/Overview.svelte (prints nothing)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No font-size under 14px and no legacy colour literal in Overview.svelte"
    verification:
      - kind: unit
        ref: "tests/unit/guards (phase5-layout-guards 14px floor)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual fidelity of the grid, card, chip and na-panel look against the design (density, hover affordance)"
    human_judgment: true
    rationale: "Hover affordance and density are judged by eye. A 1280px screenshot read correctly (two columns, ink headline, underlined links, chips on one row) and metrics at 375px showed one column, no sideways scroll and 18px heading and numerals, but neither is a design-canvas comparison, and hover was not exercised."
---

# Phase 8 Plan 05: Overview Summary

**After every import the page lands on a real Overview: three status chips ('6 sections with data', '0 not in this export', '4 folders not yet supported') and six summary cards, all filters over the one paneEntries derivation the list rows read, with an 'Open <Section> →' control that selects the pane and puts focus in the detail.**

## Accomplishments

- `overview-model.ts` (pure, no copy literals, no worker client): `OVERVIEW_CARD_IDS` (playtime, login-history, vehicles, finance, payments, account), `overviewChips` and `overviewCards`. `withData` counts card panes that are not muted, `absent` counts reason `no-export`, `unsupported` is `unsupportedEntries(result).length`. A pane that is present with zero rows is in neither chip; a unit invariant asserts `withData + absent + (cards with reason 'empty') = 6` across five export shapes.
- `Overview.svelte`: `data-testid="overview"`, an `h2#overview-heading` carrying the section-title look, the intro sentence, three chip `li`s (`ov-chip-with-data`, `ov-chip-absent`, `ov-chip-unsupported`) and the grid of `ov-card-<id>` cards. An available card has an `ov-open-<id>` button; an unavailable one is a dashed `var(--faint)` panel on `var(--list)` with an em-dash headline and no control.
- `Dashboard.svelte`: new `openPane(id)` (select, `openDetail`, tick, focus the detail pane) replaces the inline heading and intro; the Overview branch sits inside the existing `detailMounted` guard. The now-unused `.pane-title` and `.pane-intro` rules and the `OVERVIEW_INTRO` import were removed.
- Presentation: grid `repeat(auto-fit, minmax(min(300px, 100%), 1fr))` with a 16px gap (one column at 375px with no media query), 20px card padding, ink border on hover (not on the na panel), 44px underlined ink open control, 14px/600 pill chips on `var(--chip)`, 30px headline collapsing to 18px and the heading clipped visually (still in the accessibility tree) inside the 480px rule, `min-width: 0` and `overflow-wrap: anywhere` on text.
- Nav spec grew from 13 to 14 tests: `(overview)`.

## Task Commits

1. Task 1 (tracer): `fa24fcf` feat(08-05): Overview with status chips and one summary card per section
2. Task 2: `2717562` feat(08-05): Overview presentation for desktop and phone

Tracer gate: the Task 1 verify (unit shell tests, nav spec 14/14, `pnpm run check`, plus `pnpm run lint` and `tests/unit/guards`) was green before Task 2 began.

## Verification

- `pnpm exec vitest run tests/unit/shell`: 7 files, 467 tests passed. Whole unit suite: 83 files, 2559 tests passed (includes `tests/unit/guards`: 12 files, 223 tests).
- `playwright test --project=chromium tests/e2e/shell/master-detail-nav.spec.ts`: 14 passed, after each task. `--list` prints `Total: 14 tests in 1 file`.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: prettier and eslint clean.
- Acceptance: the worker-client import grep prints nothing; the nav spec lists 14 tests; `Overview.svelte` declares `minmax(min(300px, 100%), 1fr)`; the nickname is asserted absent from `overview`.
- Throwaway spec (deleted, never committed): at 1280px two card columns, heading 26px, headline 30px, no horizontal scroll; at 375px one column, heading and headline 18px, `scrollWidth` equal to `clientWidth`. A 1280px screenshot read correctly.
- The rest of the Playwright suite was not run: it is expected red until plans 08-08 to 08-18, per the plan. Playwright ran through the throwaway config in the scratchpad (the installed browser build does not match the pinned version); no repo config changed.

## Deviations from Plan

None to scope. Judgement calls:

- **`ov-chip-with-data` figure:** the e2e test computes the expected count from `OVERVIEW_CARD_IDS.length` and the unsupported count from `SAMPLE_EXPECTED_COUNTS` (known-deferred plus unknown), rather than from literals, as the plan asks.
- **Absent chip counts panes, not folders:** a missing `Activity_history` gives 2 absent (Playtime and Login history), because the plan defines absent as card panes whose reason is `no-export`. A unit test pins it.
- **Task 1 stylesheet:** the functional stylesheet already covered most of the final look, so Task 2's diff is the hover rules, the 44px control, the overflow guards and the 480px rule.

**Total deviations:** 0 auto-fixed. **Impact:** none on scope.

## Known Stubs

None. The previous Overview placeholder (heading and intro only) is replaced. The sketch's sparkline, stacked bar and per-section data headlines are intentionally not built (see key-decisions); a follow-up can add them without changing the model's shape.

## Threat Flags

None. No network, storage or URL surface added. T-08-17: the Account card prints only the region and the created date; `(overview)` asserts the nickname is absent from `overview` and from `ov-card-account`. T-08-18: all text is Svelte-interpolated, no raw-HTML directive. T-08-19: neither new file imports a worker client (grep prints nothing).

## Self-Check: PASSED

- FOUND: src/lib/shell/overview-model.ts, src/lib/shell/Overview.svelte, tests/unit/shell/overview-model.test.ts
- FOUND: src/lib/shell/Dashboard.svelte, tests/e2e/shell/master-detail-nav.spec.ts
- FOUND commits: fa24fcf, 2717562
