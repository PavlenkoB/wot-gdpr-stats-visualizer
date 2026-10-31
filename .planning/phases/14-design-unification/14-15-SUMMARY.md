---
phase: 14-design-unification
plan: 15
subsystem: ui
tags: [svelte, css, design-tokens, chart-scroll, white-token, nesting, spacing-scale]

# Dependency graph
requires:
  - phase: 14-design-unification
    provides: the token scale in `src/styles/tokens.css` (the `--fs-*`, `--fw-*`, `--lh-*`, `--space-*`, `--radius-*` and `--white` custom properties) and the shared blocks in `src/styles/utilities.css`
  - phase: 14-design-unification
    provides: the heat scale (plan 14-09), the playtime pane, the logins pane, the vehicles pane's first half (plan 14-13) and the vehicle statistics block (plan 14-14) - the migration the chart pieces join
provides:
  - The five chart pieces are on the token layer: no hex literal, every size, weight, leading, radius and gap a token
  - `MonthlyBarChart`'s scroller is the LOCAL `chart-scroll` hook and gains no `isolation: isolate` and no focus ring
  - `ChartTooltip`'s white text and `MonthlyBarChart`'s white stroke read `var(--white)`, and the `#ffffff` entry of the phase-8 UI review guard's allow-list is gone
  - `tests/unit/charts/about-disclosure.test.ts` proves the 14px floor through RESOLVED token values and requires a non-empty match, so it can no longer pass vacuously
  - The five files are off `PENDING_FILES`, so the design-token and nesting guards now sweep them
affects: [14-design-unification, charts, ChartTooltip, MonthlyBarChart, about-disclosure, phase-8-ui-review-guards]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 3303
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A CHART scroller and a FOCUSABLE scroll region are different things. The shared `.scroller` carries `isolation: isolate` and a focus ring, and a chart scroller must not gain either, so the chart takes a LOCAL `chart-scroll` hook with its own declarations."
    - "A px assertion over a tokenised stylesheet is a vacuous assertion. The reader resolves the token back to its px value first and then REQUIRES a non-empty match, so the floor is still proven."

key-files:
  created: []
  modified:
    - src/lib/charts/AboutDisclosure.svelte
    - src/lib/charts/ChartTooltip.svelte
    - src/lib/charts/FlowLegend.svelte
    - src/lib/charts/MonthlyBarChart.svelte
    - src/lib/charts/MonthlyDataTable.svelte
    - tests/unit/charts/about-disclosure.test.ts
    - tests/unit/guards/phase8-ui-review-guards.test.ts
    - tests/helpers/migration.ts

key-decisions:
  - "The bar chart's scroller is the LOCAL `chart-scroll` hook, not the shared `.scroller`. It keeps its own declarations - `overflow-x: auto`, `overflow-y: hidden`, `max-width: 100%`, `padding: var(--space-4) 0`, `min-width: 0` - and gains no `isolation: isolate` and no focus ring. The compiled CSS proves it: `.chart-scroll.svelte-1hum4cb{...}` declares neither, and the only `isolation` declarations left in the bundle are the shared `.scroller` utility and its scoped copies in the components that legitimately own one."
  - "`ChartTooltip`'s `.tooltip[hidden]` is NESTED as `&[hidden]` under `.tooltip`. G6b counts `[` as an extension character, so the flat rule was an offence. The compiled CSS is unchanged in selector, specificity and order: `.tooltip.svelte-1c26k00[hidden]{display:none}`, still after the parent's own declarations, so the `hidden` attribute still wins over the chrome."
  - "The tooltip's text and the bar chart's inner ring stroke read `var(--white)` (`#ffffff`), and the `#ffffff` entry of `ALLOWED_COLOUR_LITERALS` is deleted together with its now-dead `WHITE_REASON` constant. The guard's stale-entry check fails on an entry whose files are all migrated, so the deletion was required, not cosmetic."
  - "`AboutDisclosure`'s `summary` keeps `min-height: 44px` as a length. It is a touch floor, not a spacing value, and the UI-SPEC's \"Non-spacing sizes\" section names the 44px hit area explicitly."
  - "`AboutDisclosure` has NO hover or focus states to nest. The focus ring is the global `summary:focus-visible` rule in `src/app.css`, and no local state existed. Writing new ones would be a visible change that the UI-SPEC's Allowed Visible Changes list does not permit, so none was invented."
  - "`MonthlyDataTable`'s `.sr-only` clip block stays local under its own name - the shared name is `visually-hidden`, and a clip block under any other name stays local (D-02). Its `margin: -1px` stays legal because the same rule declares `clip`."
  - "`MonthlyDataTable`'s `.table-container` stays a local rule and does NOT adopt the shared `.scroller`. The plan does not ask for it, the shared rule is the FOCUSABLE region, and adopting it would add an isolation context and a focus ring the table never had."
  - "The about-disclosure reader resolves the tokens before it matches px. The probe shows why this matters: the RAW source matches `font-size: Npx` ZERO times (so the old loop asserted nothing and passed vacuously), while the RESOLVED source matches exactly `[14]` - and the test now requires a non-empty match, so the floor is proven rather than merely un-falsified."
  - "`FlowLegend`'s stale \"ramp\" prose is corrected. The ramp tokens were deleted in plan 14-09 and `ChartLegend` now renders the heat SCALE, so four prose references described something that no longer exists. The words become `scale`/`SCALE` and the \"six-step vocabulary\" becomes the scale's \"six-swatch vocabulary\" (the empty swatch plus five data steps)."
  - "The `.chart-scroll` rule KEEPS its `padding: 4px 0`, tokenised to `var(--space-4) 0`, even though the plan's enumeration of the scroller's kept declarations omitted it. The playbook's `chart-scroll` hook includes the 4px, and dropping it would have moved the chart by 4px against the plan's own \"the charts render as before\" must-have."

patterns-established:
  - "A CHART scroller is renamed to a local hook, and the shared scroll region's isolation is a thing the chart must NOT inherit. Adopting the shared `.scroller` because the element scrolls is the mistake; the two scrollers differ in focusability, and focusability is what the shared rule encodes."

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-07, D-13]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "The five chart pieces are token-based: no hex literal in any of them, and every font-size, font-weight, line-height, radius and gap reads a token; they are off PENDING_FILES and the design-token and nesting guards now sweep them."
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/charts tests/unit/finance tests/unit/guards - 35 files, 812 tests, all pass"
        status: pass
      - kind: unit
        ref: "pnpm run test:unit - 164 files, 4899 passed, 9 expected fail, 0 failed (second run; the first run hit the known pre-existing overview-grid starvation flake, which passes in isolation)"
        status: pass
      - kind: other
        ref: "scratch probe probe-14-15.mjs (outside the repository): the five files hold no colour literal; every token resolves (--fs-body 14px, --fw-semibold 600, --lh-tight 1.4, --space-8 8px, --radius-sm 6px, --white #ffffff)"
        status: pass
    human_judgment: false
  - id: D2
    description: "MonthlyBarChart's scroller is the local `chart-scroll` hook: the markup class and the rule agree, and it carries no `isolation: isolate` and no focus ring."
    verification:
      - kind: other
        ref: "scratch probe probe-14-15.mjs: the .chart-scroll rule's declarations are overflow-x auto, overflow-y hidden, max-width 100%, padding var(--space-4) 0, min-width 0 - no isolation, no outline; grep -c 'chart-scroll' src/lib/charts/MonthlyBarChart.svelte is 3"
        status: pass
      - kind: other
        ref: "compiled bundle dist/assets/index-*.css: .chart-scroll.svelte-1hum4cb{...} declares no isolation; the bundle's only `isolation` declarations are the shared `.scroller` utility and its scoped copies"
        status: pass
    human_judgment: false
  - id: D3
    description: "The phase-8 UI review guard's `#ffffff` allow-list entry is gone, because both of its files are migrated; `ChartTooltip`'s white text and `MonthlyBarChart`'s white stroke read `var(--white)`."
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts passes as part of `pnpm exec vitest run tests/unit/charts tests/unit/finance tests/unit/guards`; the guard fails on a stale allow-list entry"
        status: pass
      - kind: other
        ref: "compiled bundle dist/assets/index-*.css: .tooltip.svelte-1c26k00{...color:var(--white)...}"
        status: pass
    human_judgment: false
  - id: D4
    description: "The about-disclosure reader still proves the summary is at least 44px high and no font size is under 14px, and it can no longer pass vacuously: it reads RESOLVED token values and requires a non-empty match."
    verification:
      - kind: unit
        ref: "tests/unit/charts/about-disclosure.test.ts - 'the summary is at least 44px high' and 'declares no font-size under 14px' pass"
        status: pass
      - kind: other
        ref: "scratch probe probe-14-15.mjs: the RAW source matches `font-size: Npx` ZERO times (the old assertion asserted nothing); the RESOLVED source matches [14] and the non-vacuity check holds"
        status: pass
    human_judgment: false
  - id: D5
    description: "The charts render as before: the tooltip, the bar chart, the flow legend and the monthly table keep every computed size, weight, leading, radius and gap."
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/chart-fill.spec.ts - 2 tests, all pass (the plan's named spec)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/finance/finance.spec.ts - 32 tests, all pass"
        status: pass
      - kind: other
        ref: "compiled bundle dist/assets/index-*.css: .tooltip.svelte-1c26k00 and .tooltip.svelte-1c26k00[hidden] keep their selectors, specificity and order"
        status: pass
    human_judgment: false

# Metrics
duration: 47min
completed: 2026-10-27
status: complete
---

# Phase 14: Design Unification Summary

**The five chart pieces the finance pane shares with the app moved onto the token layer, the bar chart's scroller became the local `chart-scroll` hook instead of inheriting the shared region's isolation, and the about-disclosure reader was hardened so its 14px floor can no longer pass vacuously**

## Performance

- **Duration:** 47 min
- **Started:** 2026-10-27T21:38:00+04:00
- **Completed:** 2026-10-27T22:25:00+04:00
- **Tasks:** 1
- **Files modified:** 9 (8 code + this summary)

## Accomplishments

- `AboutDisclosure.svelte`, `ChartTooltip.svelte`, `FlowLegend.svelte`, `MonthlyBarChart.svelte` and `MonthlyDataTable.svelte` are token-based and off `PENDING_FILES`, so the design-token guard (G1/G3/G4/G5/G6) and the nesting guard now sweep them. No hex literal survives in any of the five.
- The bar chart's scroller is the LOCAL `chart-scroll` hook. It keeps its own declarations and gains NEITHER the shared `.scroller`'s `isolation: isolate` NOR its focus ring — the trap this plan was written around.
- The tooltip's white text and the bar chart's white stroke read `var(--white)`, and the `#ffffff` entry of the phase-8 UI review guard's allow-list is deleted with its now-dead `WHITE_REASON` constant.
- `tests/unit/charts/about-disclosure.test.ts` reads RESOLVED token values and requires a non-empty match, so it can no longer pass vacuously — the raw source matches `font-size: Npx` zero times, the resolved source matches exactly `[14]`.
- `FlowLegend.svelte`'s stale "ramp" prose is corrected: the ramp tokens were deleted in plan 14-09 and `ChartLegend` renders the heat SCALE now.

## Task Commits

Each task was committed atomically:

1. **Task 1: migrate the chart pieces the finance pane shares** - `052b0d7` (refactor)

**Plan metadata:** `14-15-SUMMARY.md` (docs: complete plan)

## Files Created/Modified

- `src/lib/charts/AboutDisclosure.svelte` - the shared "About this" disclosure. Its `summary` rule reads `var(--fs-body)`, `var(--fw-semibold)`, `var(--lh-tight)`; `.about-body`'s `padding-top` reads `var(--space-8)`. `min-height: 44px` stays a length (a touch floor).
- `src/lib/charts/ChartTooltip.svelte` - the chart tooltip. Padding, radius, type and colours are tokens (`var(--space-8) var(--space-12)`, `var(--radius-sm)`, `var(--fs-body)`, `var(--fw-semibold)`/`var(--fw-regular)`, `var(--lh-tight)`, `var(--white)`), and `.tooltip[hidden]` is nested as `&[hidden]` under `.tooltip` for G6b.
- `src/lib/charts/FlowLegend.svelte` - the two-phrase flow legend. Its row's gap and type are tokens, and the four "ramp" prose references became "scale".
- `src/lib/charts/MonthlyBarChart.svelte` - the diverging monthly bar chart. The scroller is renamed to the local `chart-scroll` hook in the markup and the CSS, the axis type is tokenised, and the inner focus/hover ring's stroke reads `var(--white)`.
- `src/lib/charts/MonthlyDataTable.svelte` - the monthly data table. The table, `th` and `td` rules read the type and padding tokens; the `.sr-only` clip block stays local.
- `tests/unit/charts/about-disclosure.test.ts` - the disclosure's reader. It resolves tokens before matching px, looks the summary rule up by selector, and requires a non-empty match.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - the phase-8 UI review guard. The `#ffffff` allow-list entry and its `WHITE_REASON` constant are deleted.
- `tests/helpers/migration.ts` - `PENDING_FILES` no longer lists the five migrated files.

## Decisions Made

- **The bar chart's scroller is LOCAL.** The shared `.scroller` is the FOCUSABLE scroll region - it carries `isolation: isolate` and a focus ring - and a chart scroller is neither. The plan's trap is explicit and the plan body is authoritative: the scroller is renamed to `chart-scroll` and does NOT gain the shared region's isolation. The compiled CSS confirms it: `.chart-scroll.svelte-1hum4cb{...}` declares no `isolation` and no `outline`, and the only `isolation` declarations in the whole bundle are the shared `.scroller` utility and the scoped copies in the components that legitimately own one.
- **`&[hidden]` is nested under `.tooltip`.** G6b counts `[` as an extension character, so the flat `.tooltip[hidden]` was an offence once the file came off the pending list. Nesting preserves the selector, the specificity and the source order exactly - the compiled rule is still `.tooltip.svelte-1c26k00[hidden]{display:none}`, still after the parent's declarations, so `hidden` still beats the chrome.
- **The 44px summary height stays a length.** The UI-SPEC's "Non-spacing sizes" section names the 44px hit area as a non-spacing size, so it is not a token candidate.
- **The about-disclosure reader resolves, then requires.** Reading `font-size: Npx` out of a tokenised stylesheet finds nothing, and a loop over an empty array asserts nothing. The reader now resolves the token back to its px value and requires a non-empty match, so the floor is proven.
- **`var(--white)` for the tooltip's text and the ring's stroke.** Both are white on a dark or coloured data surface, not on a page surface, and `--white` is the token the token stylesheet already declares for exactly that.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `AboutDisclosure`'s `summary` has no hover or focus states to nest**
- **Found during:** Task 1 (migrating `AboutDisclosure.svelte`)
- **Issue:** The plan's action text says to "nest its hover/focus states under `summary` as `&:hover`, `&:focus-visible`". The file has no hover or focus state to nest — the focus ring is the GLOBAL `summary:focus-visible` rule in `src/app.css:126`, and no local state existed.
- **Fix:** Nothing was written. Inventing a hover or focus state would be a visible change that the UI-SPEC's Allowed Visible Changes list does not permit, and the global rule already covers the focus ring.
- **Files modified:** none
- **Verification:** `src/app.css:126-131` carries the global `summary:focus-visible` outline; the migrated file's only rules are `.about`, `summary` and `.about-body`, none of which is a G6b extension of another.
- **Committed in:** n/a - nothing changed

**2. [Rule 1 - Convention] The `.chart-scroll` rule keeps its `padding`, which the plan's enumeration omitted**
- **Found during:** Task 1 (migrating `MonthlyBarChart.svelte`)
- **Issue:** The plan says the scroller keeps "its declarations: overflow-x auto, overflow-y hidden, max-width 100%, min-width 0" — the `padding: 4px 0` is not in that list.
- **Fix:** The padding was KEPT and tokenised to `var(--space-4) 0`. The playbook's `chart-scroll` hook includes it, and dropping it would have moved the chart by 4px against the plan's own "the charts render as before" must-have.
- **Files modified:** `src/lib/charts/MonthlyBarChart.svelte`
- **Verification:** the compiled CSS shows `padding:var(--space-4) 0`; the chart-fill and finance e2e specs pass.
- **Committed in:** `052b0d7` (part of the task commit)

**3. [Rule 3 - Blocking] `FlowLegend.svelte`'s stale "ramp" prose was corrected**
- **Found during:** Task 1 (migrating `FlowLegend.svelte`)
- **Issue:** The plan body did not name the stale prose, but the file still said "ramp" in four places (lines 9, 11, 19, 20) — and the ramp tokens were deleted in plan 14-09, so the comments describe something that no longer exists. The dispatch brief named this as a carried open item in this plan's file list.
- **Fix:** The four references now read "scale"/"SCALE", and "the ramp's six-step vocabulary" became "the scale's six-swatch vocabulary" (the empty swatch plus five data steps).
- **Files modified:** `src/lib/charts/FlowLegend.svelte`
- **Verification:** `grep -i ramp src/lib/charts/FlowLegend.svelte` returns nothing; `tests/unit/finance/currency-blocks.test.ts` (which reads this file) passes.
- **Committed in:** `052b0d7` (part of the task commit)

---

**Total deviations:** 3 (1 no-op, 2 corrections inside the plan's own file list)
**Impact on plan:** All three are inside the plan's `files_modified` set. None broadens the scope, and none changes what the plan asked for; the first is a plan instruction with no target, and the other two follow the plan's own must-haves.

## Issues Encountered

- **A stale `vite preview` holds port 4173.** The committed `playwright.config.ts` sets `reuseExistingServer: false`, so Playwright cannot start its own server there and would have tested the STALE build. A temporary config overriding `use.baseURL` and `webServer` to port 4174 was written to the repo root, used, and then moved back out of the repository to `$TMPDIR/wg-phase14/`. `playwright.config.ts` is untouched (`git diff --stat playwright.config.ts` is empty) and the temporary file is not committed.
- **The known pre-existing starvation flake in `tests/unit/overview/overview-grid.test.ts` DID fire on the first full-suite run** (1 failed, 4898 passed — "Test timed out in 20000ms"). It is not caused by this change: the file passes in isolation (19 passed, 20.25s, against the repo's 20s `testTimeout`) and the full suite passes on a re-run (164 files, 4899 passed, 9 expected fail, 0 failed). Reported, not papered over.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The five chart pieces are swept by the token and nesting guards, so the remaining pending files are the ones the phase has not reached yet.
- Open items this plan did NOT touch (they are outside its file list, so they are reported rather than edited): `tests/e2e/_support/helpers.ts:541` (says the stat tile numerals are 30px), `tests/e2e/shell/master-detail-nav.spec.ts:72` (comment names the retired 30), `tests/unit/device-info/device-info-blocks.test.ts:143` (hard-coded `['14','18','26','30']` superset), `src/lib/features/logins/map-model.ts:36` (still says "ramp" in prose - NOT this plan's file).
- Plan 14-14's flagged judgement call for the owner is unchanged and still open: the neutral `.info` box border was kept at `var(--border)` rather than `var(--faint)`, because the UI-SPEC's Allowed Visible Changes list names only the 4px toggle gap. This plan did not act on it.

---
*Phase: 14-design-unification*
*Completed: 2026-10-27*
