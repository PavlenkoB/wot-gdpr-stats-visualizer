---
phase: 13-overview-personal-insights
plan: 09
subsystem: ui
tags: [overview, tile, svg-charts, bento, csp, cssom, d-10, d-13, d-15, d-16, d-17, d-21]

requires:
  - phase: 13-overview-personal-insights
    provides:
      - "13-01: the sixteen-tile wire contract (OverviewReadyTile) and the tracer tile"
      - "13-04: heatColor and the heat tokens"
      - "13-06: the tile catalogue, fillSpans and the rule/copy formatters"
provides:
  - "overview-format.ts: tileFace, TileFace, ChartSpec, formatDays/Hours/Count/Percent/Day/MonthYear/HourOfDay and the bigint formatCredits"
  - "overview-dom.ts: the spans action and setViewTransitionName (CSSOM writes)"
  - "OverviewTile.svelte (rewritten), OverviewBars.svelte, OverviewRows.svelte, OverviewGroup.svelte"
  - "overview-components-guard.test.ts: a source-level guard for the rules a Node test cannot render"
affects: [13-10, 13-11, 13-12, 13-13, 13-14, overview]

plan_head_before: 2b246123641baaf095a017d7a42a841734de72a7
plan_head_after: a239fac4c9123a3ecf3bd2ea02d4ae5a8c7dbc0a
commits: 2
actuals:
  tokens: 34000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "One pure function (tileFace) owns every printed string, so the words and chart data are tested in Node"
    - "Spans and view-transition names reach the DOM only through style.setProperty in a Svelte action"
    - "A source-level guard stands in for a render test where Svelte cannot be mounted"

key-files:
  created:
    - "src/lib/features/overview/overview-format.ts"
    - "src/lib/features/overview/overview-dom.ts"
    - "src/lib/features/overview/OverviewBars.svelte"
    - "src/lib/features/overview/OverviewRows.svelte"
    - "src/lib/features/overview/OverviewGroup.svelte"
    - "tests/unit/overview/overview-format.test.ts"
    - "tests/unit/overview/overview-dom.test.ts"
    - "tests/unit/overview/overview-components-guard.test.ts"
  modified:
    - "src/lib/features/overview/OverviewTile.svelte"
    - "src/lib/shell/Overview.svelte"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"
    - "tests/unit/import/multi-account-keys.test.ts"

key-decisions:
  - "Pinned group uses sparse grid flow (grid-auto-flow: row); the four catalogue groups keep dense. This closes WINDOWS entry 27."
  - "The face button carries the 16px padding and the wrapper carries the border, radius and shadow, so the focus ring sits inside the tile edge."
  - "Credits truncate the fraction below one million and round half up in integers from one million, so no step passes through a float."

patterns-established:
  - "A component prop that shares its name with an imported action is destructured under another name (spans: fill) so use:spans stays literal."
  - "A chart root is aria-hidden; the tile's hidden summary sentence carries the same facts once."

requirements-completed: [INSIGHT-07]

coverage:
  - id: D1
    description: "Every tile face (value, unit, rule, hidden summary, chart data) comes from one pure function, and money is formatted exactly from the micro-unit string"
    requirement: INSIGHT-07
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-format.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Spans and transition names reach the DOM only through the CSSOM, never a style attribute"
    requirement: INSIGHT-03
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-dom.test.ts"
        status: pass
      - kind: unit
        ref: "tests/unit/overview/overview-components-guard.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The tile anatomy, type scale, breakpoints, colour rules and the Pinned flow decision are pinned at source level"
    requirement: INSIGHT-04
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-components-guard.test.ts"
        status: pass
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The rendered look at 480, 880 and 1040px pane widths, including a long tank name on a hero"
    requirement: INSIGHT-04
    verification:
      - kind: manual
        ref: "13-12-PLAN.md human-check block (composed page)"
        status: backstop
    human_judgment: true

duration: 25 min
completed: 2026-10-23
status: complete
---

# Phase 13 Plan 09: Tile, Charts and Group Summary

**The static visual layer of the bento: a pure `tileFace` that owns every printed string, a CSP-safe `spans` action, and the tile, the hand-rolled heat-scale charts and the group, with a source guard for the rules a Node test cannot render.**

## Accomplishments

- `tileFace` produces the value, unit, rule line, hidden chart summary and chart spec for all sixteen tiles. The tests build each tile from the plan 13-03 answer key and check the figures, the rule wording, the chart kinds, bar counts and the peak labels.
- `formatCredits` is bigint end to end: below one million the full figure, from one million whole millions rounded half up, from one billion `N.NN billion` rounded half up. A value above 2^53 micro-units (9,014,999,999.999999 credits) reads `9.01 billion`; a float would round it to 9.02.
- `OverviewTile` is one phrasing-only face button (`aria-expanded`, `aria-keyshortcuts="p"`) with a SIBLING 44x44 star (`aria-pressed`, fixed `Pin {name}` label, `tabindex="-1"`, 18px glyph) and an expanded panel with How, Reads and the Open link.
- `OverviewBars` and `OverviewRows` draw hand-rolled SVG on white with a 1px baseline, coloured by `heatColor(value / max)`, with the peak named in text. Roots are `aria-hidden`; the hidden summary carries the same facts.
- `OverviewGroup` has the heading (dot, text, hairline, legend swatch between "low" and "peak") and a 16px-gap grid with 1, 2 and 4 columns by container width.
- `Overview.svelte` (the shell page) now draws the Logged in tile with the new anatomy until plan 13-12 composes the whole bento.

## Decision: Pinned does not use dense flow (closes WINDOWS entry 27)

13-06 found that `grid-auto-flow: dense` reorders the derived Pinned group for 32,160 of 65,535 non-empty pin subsets, while the four catalogue groups never reorder. A narrow tile is pulled up into a gap beside a hero or wide feature, ahead of earlier tiles, so a metric listed before a hero would read after it.

`OverviewGroup.svelte` therefore applies `grid-auto-flow: dense` only through a `.dense` modifier that every group gets EXCEPT `pinned`; Pinned keeps the default sparse flow, which places each tile after the previous one. The screen always reads in catalogue order. The cost is that a gap beside a hero can stay empty, and that was judged better than a reordered page.

The guard test pins this: `dense` is declared exactly once, on `.grid.dense`, and the markup is `class:dense={id !== 'pinned'}`. The ledger entry is marked fixed.

**Follow-up for plan 13-12:** `fillSpans` simulates dense placement. For Pinned it can therefore pick feature widths that were optimal under dense packing and leave a different number of holes under sparse flow. Order is safe either way. If the composer wants the minimum holes under sparse flow too, it needs a sparse variant of the simulation for that one group.

## Task Commits

1. **Task 1: face formatter, money and date formatting, CSSOM action** - `813d8d3` (feat)
2. **Task 2: tile, charts and group with the source guard** - `a239fac` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The shell page still used the tracer tile's old props**
- **Found during:** Task 2
- **Issue:** `src/lib/shell/Overview.svelte` rendered `<OverviewTile tile={logged} />`; the rewritten tile needs the definition, face and callbacks, so `pnpm run check` would have failed.
- **Fix:** the page builds `tileFace`, passes `tileDef('logged')`, local open and pinned state, and `onopen` for the Open link. Plan 13-12 replaces this with the composed bento.
- **Files modified:** src/lib/shell/Overview.svelte
- **Commit:** a239fac

**2. [Rule 3 - Blocking] Two repository guards needed entries for the new files**
- **Found during:** Task 2, full `pnpm run test:unit`
- **Issue:** the keyed-each audit in `multi-account-keys.test.ts` rejected three keyed blocks, while `svelte/require-each-key` rejects unkeyed ones.
- **Fix:** keyed the blocks by position and added three audited rows with reasons. The `rgba(` colour allow-list entry was extended with the tile file (as the plan specified).
- **Files modified:** tests/unit/import/multi-account-keys.test.ts, tests/unit/guards/phase8-ui-review-guards.test.ts
- **Commit:** a239fac

**3. [Rule 1 - Bug] The requirements verb ticked two requirements this plan does not finish**
- **Found during:** state updates
- **Issue:** `requirements.mark-complete INSIGHT-03 INSIGHT-04 INSIGHT-07` checked INSIGHT-03 and INSIGHT-04. This plan ships only the static layer; expand in place, the keyboard, pins and the composed grid are plan 13-12, and the browser check is 13-14.
- **Fix:** reverted REQUIREMENTS.md by hand and logged WINDOWS entry 30 to re-run the mark after 13-14 lands. INSIGHT-07 was already complete.
- **Files modified:** .planning/REQUIREMENTS.md (left unchanged)

### Choices within the plan

- The 16px padding sits on the face button, and the wrapper carries the 1px border, 8px radius and shadow. The tile looks as specified, and the focus ring (offset -3px) lands inside the edge rather than over the content.
- `OverviewTile` takes the prop `spans` as specified, but destructures it as `fill` so that `use:spans` still names the imported action.
- A chart tile's summary is the empty string for the tiles with no chart, and the component renders the hidden span only when it is non-empty.

## Issues Encountered

None beyond the deviations above.

## Verification

- `pnpm run check`: 0 errors, 0 warnings
- `pnpm run lint`: prettier and eslint clean
- `pnpm run test:unit`: 155 files passed, 4625 passed, 9 expected fail
- `pnpm run build`: succeeds
- The compiled CSS was inspected for the container-query rules and for `:has(.tile.open)` surviving Svelte's scoping in the group.
- The rendered look was NOT checked in a browser in this plan, as the plan states: it is verified with the composed page in plan 13-12. That item is recorded as a backstop in the coverage block.

## Known Stubs

None. The tile, charts and group are wired to real tile data through `tileFace`; the shell page uses only the Logged in tile until plan 13-12.

## Threat Flags

None. No new network, auth, storage or file surface. T-13-26, T-13-27 and T-13-28 are mitigated: every string is a text interpolation (guarded), spans use `style.setProperty` (guarded, and `svelte/no-inline-styles` is clean), and `tileFace` builds the only strings with a hostile-name test.

## Self-Check: PASSED

- All created files exist: overview-format.ts, overview-dom.ts, OverviewBars.svelte, OverviewRows.svelte, OverviewGroup.svelte and the three test files.
- Commits 813d8d3 and a239fac are ancestors of HEAD.
