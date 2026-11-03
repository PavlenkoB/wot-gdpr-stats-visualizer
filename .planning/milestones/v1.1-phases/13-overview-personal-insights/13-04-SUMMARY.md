---
phase: 13-overview-personal-insights
plan: 04
subsystem: ui
tags: [design-tokens, contrast, css-custom-properties, type-scale, guards, vitest]

# Dependency graph
requires:
  - phase: 13-overview-personal-insights
    provides: "plan 13-01's Overview folder and tracer tile; the 13-UI-SPEC design contract (Color, Typography)"
provides:
  - "ten Overview colour tokens in src/app.css: the four catalogue group dots, the Pinned dot, the pinned star's fill and stroke, and the three value-scale stops"
  - "src/lib/features/overview/overview-heat.ts: HEAT_STOPS and heatColor(t), a pure clamped interpolation over the eased value scale"
  - "the 'Overview colours' contrast contract in tests/unit/charts/contrast.test.ts, with every recorded ratio recomputed from the shipped tokens"
  - "a per-file font-size scale and floor: 12 / 14 / 32 / 56px under src/lib/features/overview/, the project's own scale and 14px floor everywhere else"
  - "features/overview in the shared component sweep, so every Overview component is inside every existing guard"
affects: [13-05, 13-06, 13-09, 13-10, 13-12, 13-13, 13-14, contrast, type-scale, overview]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 10200
  tasks: 2
  commits: 4
plan_head_before: 9d8a27143e197942c6653a7ef6d6a6b4d90d8ac1
plan_head_after: 0955cb9750f31deec36b6cc057c09813df29c91c

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A design token is declared once in src/app.css and recomputed from the shipped declaration in a test; the stylesheet is the place a colour is written down"
    - "A module that needs a colour at runtime holds the token's CHANNEL VALUES, not a colour string, so the project colour guard needs no allow-list entry"
    - "A project-wide guard that must be relaxed for one feature resolves its rule PER FILE PATH, and the relaxation is covered by self-tests with synthetic entries"

key-files:
  created:
    - "src/lib/features/overview/overview-heat.ts"
    - "tests/unit/overview/overview-heat.test.ts"
  modified:
    - "src/app.css"
    - "src/lib/features/overview/OverviewTile.svelte"
    - "tests/unit/charts/contrast.test.ts"
    - "tests/helpers/components.ts"
    - "tests/unit/guards/phase8-ui-review-guards.test.ts"
    - "tests/unit/guards/phase5-layout-guards.test.ts"

key-decisions:
  - "The value scale's lightest step is #47a374 (3.11:1 on white), darkened from the sketch's #4fb27f (2.62:1), and the old value is asserted in the contrast test so the darkening cannot be undone as a 'taste' edit"
  - "The Overview draws its bars on the white tile and never on a grey track: the track grey takes the lightest step back to 2.63:1, and that number is recorded in the test"
  - "The font-size scale exemption is an EXACT set (12 / 14 / 32 / 56px), not a superset of the project's 14 / 18 / 26 / 30px, so 18px and 26px stay illegal inside the Overview"
  - "The exemption is chosen by repo-relative path with a trailing slash, so a sibling folder cannot inherit it by name"
  - "The floor exemption lowers the floor to 12px under the Overview folder only; 11px still fails there"

patterns-established:
  - "Per-file guard rules: a sweeping guard resolves its rule from the file's path, and the resolution is a pure function that self-tests exercise with synthetic entries"
  - "A colour contract is recorded in the test as a NUMBER to two decimals, recomputed from the shipped declaration, with the tolerance the recording's own rounding implies"

requirements-completed: [INSIGHT-03]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The Overview palette is declared once, as ten custom properties in src/app.css, and every ratio the 13-UI-SPEC records is recomputed from the shipped declarations"
    requirement: INSIGHT-03
    verification:
      - kind: unit
        ref: "tests/unit/charts/contrast.test.ts#Overview colours (13-UI-SPEC Color)"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/charts/contrast.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The value scale is a pure, clamped function whose every sample clears 3:1 on white and whose luminance falls as the value rises, with the stops held in parity with the stylesheet"
    requirement: INSIGHT-03
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-heat.test.ts#the Overview value scale (13-UI-SPEC Color, D-13, D-22)"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/overview/overview-heat.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 12 / 14 / 32 / 56px type scale is legal under features/overview and illegal everywhere else, with self-tests proving the exemption cannot leak"
    requirement: INSIGHT-03
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase8-ui-review-guards.test.ts#the Overview font-size exemption (13-UI-SPEC Typography)"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards/phase8-ui-review-guards.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 14px floor is lowered to 12px under features/overview only, with a self-test proving the lowering is scoped and still a floor"
    requirement: INSIGHT-03
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase5-layout-guards.test.ts#the Overview font-size floor exemption (13-UI-SPEC Typography)"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/guards/phase5-layout-guards.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Overview folder is inside the shared component sweep, so every present and future Overview component is covered by the existing guards"
    requirement: INSIGHT-03
    verification:
      - kind: unit
        ref: "tests/unit/guards/phase5-layout-guards.test.ts#the Overview components are inside the sweep this floor is measured over"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-10-23
status: complete
---

# Phase 13 Plan 04: Overview palette, value scale and scoped type-scale guards

**Ten Overview colour tokens declared once in `src/app.css`, a pure `heatColor(t)` value scale whose every sample clears 3:1 on white, and the project's font-size scale and 14px floor relaxed to one scoped folder with self-tests that prove the exemption cannot leak.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-23T06:55:20Z
- **Completed:** 2026-10-23T07:05:06Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- The Overview palette is now ONE declaration site: `--ov-time`, `--ov-tanks`, `--ov-records`, `--ov-totals`, `--ov-pinned`, `--ov-star-fill`, `--ov-star-stroke`, `--heat-low`, `--heat-mid` and `--heat-peak` sit in `:root` in `src/app.css`, each with a comment saying what it paints and what it is not allowed to mean. `--ramp-0..5` and the flow colours are byte-identical to before — the diff to `src/app.css` is forty-three added lines and no removed line.
- `src/lib/features/overview/overview-heat.ts` computes the bar colour: the value is clamped into [0, 1], eased with `u = t^1.5`, and interpolated across the three stops. The module holds the stops as channel NUMBERS and assembles the colour from them at call time, so it carries no hex literal and the project colour guard needs no allow-list entry for it.
- The contract is now recomputed rather than stated. `tests/unit/charts/contrast.test.ts` recomputes every ratio the 13-UI-SPEC records for the group dots, the star colours, the value-scale stops and the neutral text pairs from the shipped declarations, and records the two numbers that justify the design: the sketch's green measured 2.62:1 on white and failed, and the grey track takes the shipped green back to 2.63:1, which is why the Overview draws no track.
- The two sweeping guards that would have rejected the approved Overview now resolve their rule per file path, and each resolution is a pure function exercised by self-tests: a 12px caption is legal under `features/overview` and illegal in the shell; 18px is illegal in the Overview because the new scale is an exact set rather than a superset; a 56px numeral is legal only under the Overview; a sibling folder cannot inherit the exemption by name; and an 11px size still fails even under the Overview label.
- `features/overview` is in the shared component sweep, so every present and future Overview component is inside the floor, the contrast and the layout guards from now on.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tokens, the value-scale function and the contrast contract** - `6a28eb4` (feat)
2. **Task 2: Scope the Overview type scale in the sweeping guards and add the folder to the component sweep** - `cf722f4` (test)

Two follow-up commits keep the tree lint-clean and the contract complete:

3. **style: apply the project's Prettier formatting to the new tests** - `056f2e0` (style)
4. **test: assert the value scale falls monotonically before quantisation** - `0955cb9` (test)

**Plan metadata:** committed with this summary.

## Files Created/Modified

- `src/app.css` - the ten Overview tokens, in `:root`, after the flow colours.
- `src/lib/features/overview/overview-heat.ts` - `HEAT_STOPS` and `heatColor(t)`: the Overview value scale, pure and free of colour literals.
- `tests/unit/overview/overview-heat.test.ts` - token parity with the stylesheet, the endpoints, the clamps, the 3:1 floor on white, the falling luminance, and the source's freedom from colour literals.
- `tests/unit/charts/contrast.test.ts` - the `Overview colours (13-UI-SPEC Color)` describe: every recorded ratio recomputed from the shipped tokens.
- `tests/helpers/components.ts` - `features/overview` added to `COMPONENT_DIRS`.
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - the per-file font-size scale, `fontSizeOffenders`, and the exemption's self-tests.
- `tests/unit/guards/phase5-layout-guards.test.ts` - the per-file font-size floor, `fontSizeFloorOffenders`, and the exemption's self-tests.
- `src/lib/features/overview/OverviewTile.svelte` - the numeral moved from the retired 30px to the declared 32px Display role.

## Decisions Made

- **The lightest heat step is darkened, and the old value is pinned.** `#4fb27f` measured 2.62:1 on white and failed the 3:1 a non-text mark needs; `#47a374` measures 3.11:1. The old value is asserted in the contrast test next to its failure, so a later edit that "tidies" the green back cannot pass silently.
- **The track is forbidden by a number, not by a comment.** The lightest step on the track grey measures 2.63:1. That figure is in the test, so the Overview's "bars on white" rule has a floor under it.
- **The Overview scale is an exact set.** A superset of the project scale would have let the Overview drift back towards 18px and 26px unnoticed; the exact set makes both illegal there, and the self-test says so.
- **The exemption is matched on a path with a trailing slash.** `src/lib/features/overview-extra/` is not the Overview, and the self-test proves it.
- **The floor is lowered, not removed.** 12px is legal under the Overview; 11px is not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's "luminance never increases" assertion is unsatisfiable for a painted 8-bit colour**
- **Found during:** Task 1 (the value-scale test)
- **Issue:** The plan asks for "the relative luminance never increases" across 201 samples of the ramp, and for the function to ROUND each channel before writing the hex. Rounding to 8 bits per channel moves a colour by up to half a step, and 41 of the 201 painted samples land a hair (at most 0.00042) above their predecessor. The literal assertion fails against a correct implementation.
- **Fix:** Two assertions, one for each thing the plan was actually protecting. The painted colours may never increase by more than the 8-bit quantisation step (0.005, the bound of the largest channel weight over 255), and the SCALE itself is asserted monotone at full precision — the interpolation is measured from `HEAT_STOPS` before rounding, with the WCAG channel maths re-derived in the test because the shared helper only reads a hex. The peak-is-darkest claim and the three stops' strict fall are asserted outright, as the plan asked.
- **Files modified:** `tests/unit/overview/overview-heat.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/overview/overview-heat.test.ts` - 8 passed.
- **Committed in:** `0955cb9` (the painted-quantisation assertion landed in Task 1's commit; the full-precision monotonicity assertion in this one).

**2. [Rule 3 - Blocking] The plan 13-01 tile declared a 30px numeral, which is on the retired scale**
- **Found during:** Task 2 (the Overview scale exemption)
- **Issue:** `OverviewTile.svelte` declared `font-size: 30px` for its value, because plan 13-01 was written before the 13-UI-SPEC declared the Overview scale. 30px is on the project's old 14 / 18 / 26 / 30px scale and on no Overview scale, so the tile would have failed the guard the moment the exemption was scoped.
- **Fix:** Moved to 32px, the declared Display role, which the plan's own fallback clause prescribes for a numeral. Plan 13-09 replaces the component with the final anatomy.
- **Files modified:** `src/lib/features/overview/OverviewTile.svelte`
- **Verification:** `pnpm exec vitest run tests/unit/guards` - 339 passed.
- **Committed in:** `cf722f4` (part of task commit).

**3. [Rule 3 - Blocking] The phase-5 floor test's name asserted a rule that is no longer true**
- **Found during:** Task 2 (the floor exemption)
- **Issue:** The test was named "declares no font-size below 14px in any component stylesheet or app.css". After the exemption, 12px under the Overview folder is legal, so the name stated a falsehood in the suite's readable output.
- **Fix:** Renamed to "declares no font-size below its floor (14px, or 12px under features/overview) in any component stylesheet or app.css". The only reference to the old name is in the Phase 5 summary's coverage block, which already points at a since-moved path.
- **Files modified:** `tests/unit/guards/phase5-layout-guards.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/guards/phase5-layout-guards.test.ts` - passed.
- **Committed in:** `cf722f4` (part of task commit).

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All three are in the plan's own acceptance path — a test assertion that a correct implementation cannot satisfy, a component the new guard would have rejected, and a test name that became untrue. No scope was added and nothing outside the plan's files was touched.

## Issues Encountered

- The plan's Task 1 acceptance criterion named the contrast suite's new describe as a place where "the new Overview colours describe lists its cases as passed". The suite reports the describe and its seven cases as passed, so the criterion holds; the wording was read as the describe's contents, not as a literal list in the output.
- Prettier reformatted two of the new test files after Task 1 was committed. Rather than amend a task commit, the formatting landed as its own `style` commit, so each task commit still says what it said when it was made.

## Known Stubs

None. The new module is a complete implementation and the tokens are complete declarations; no placeholder value, empty list or unwired component was introduced.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access and no schema change; it declares CSS custom properties, adds a pure function and amends two test guards.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Overview's palette and type scale are enforceable now, so plans 13-05 onward can write components that use a 12px caption, a 32px numeral, a 56px hero or a heat-coloured bar without a guard rejecting them.
- The value scale is available to every Overview component as `heatColor(t)`, and the stylesheet holds the three stops a legend swatch and a CSS gradient can read.
- The `features/overview` folder is inside every component sweep, so a component added later is covered by the floor, the contrast and the layout guards without a further change here.

---

## Self-Check: PASSED

- Created files exist: `src/lib/features/overview/overview-heat.ts`, `tests/unit/overview/overview-heat.test.ts` (both confirmed on disk).
- Commits exist: `6a28eb4`, `cf722f4`, `056f2e0`, `0955cb9` (all confirmed as ancestors of HEAD).
- Task 1 acceptance criteria: `pnpm exec vitest run tests/unit/overview/overview-heat.test.ts tests/unit/charts/contrast.test.ts` exits 0 (88 passed at the time of the task); `git diff src/app.css` shows only added lines, so `--ramp-0..5` is byte-identical to HEAD~; `pnpm exec vitest run tests/unit/guards/phase8-ui-review-guards.test.ts` exits 0.
- Task 2 acceptance criteria: `pnpm exec vitest run tests/unit/guards/phase8-ui-review-guards.test.ts tests/unit/guards/phase5-layout-guards.test.ts tests/unit/guards/phase6-guards.test.ts tests/unit/guards/phase7-layout-guards.test.ts` exits 0; `pnpm exec vitest run tests/unit/charts` exits 0 (218 passed); `features/overview` is asserted to be in the sweep by a new self-test.
- Plan-level verification: `pnpm exec vitest run tests/unit/overview tests/unit/charts tests/unit/guards` - 29 files, 662 tests, all passed. `pnpm run check` - 346 files, 0 errors, 0 warnings. `pnpm run lint` - Prettier clean, ESLint clean.
- Measured commits: 4 (`git rev-list --count 9d8a271..HEAD`).

---
*Phase: 13-overview-personal-insights*
*Completed: 2026-10-23*
