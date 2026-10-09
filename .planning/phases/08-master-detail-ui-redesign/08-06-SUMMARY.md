---
phase: 08-master-detail-ui-redesign
plan: 06
subsystem: ui
tags: [svelte, disclosure, stat-tiles, design-tokens, playwright, vitest]
status: complete

requires:
  - phase: 08-master-detail-ui-redesign
    provides: "the Day 10 neutral tokens (--ink, --muted, --list, --border, --radius-card) from 08-01, the nav spec from 08-02 to 08-05"
provides:
  - "AboutDisclosure.svelte: the shared native details wrapper with a 44px summary"
  - "formatAboutThis and ABOUT_NAME_CALENDAR / HOUR_GRID / PREMIUM / CURRENCY / MAP in ui-copy.ts"
  - "Keyboard hints of five charts inside 'About this <name>' disclosures, ids kept"
  - "Stat tiles on the Day 10 numeral (30px ink, 18px at phone) and chrome tokens"
  - "tests/unit/charts/about-disclosure.test.ts source-contract guard"
affects: [08-08, 08-09, 08-10, 08-11, 08-12]

actuals:
  tokens: 3600
  tasks: 3
  commits: 3
plan_head_before: 042c24707ea644d1671fab54d1cba41ebfa3b35a
plan_head_after: 33ddb8a38301d3b7dc8f936b46c5f6d34d951a01
commits: 3

tech-stack:
  added: []
  patterns:
    - "A disclosure wraps supplementary copy only; a collapsed native details keeps its content in the DOM, so an aria-describedby target inside it still resolves"
    - "A placement decision made in markup is guarded by a source-contract test that splits a component source into inside-disclosure and outside-disclosure regions"

key-files:
  created:
    - src/lib/charts/AboutDisclosure.svelte
    - tests/unit/charts/about-disclosure.test.ts
  modified:
    - src/lib/ui-copy.ts
    - tests/unit/shell/ui-copy.test.ts
    - src/lib/features/playtime/CalendarHeatmap.svelte
    - src/lib/features/playtime/PlaytimeCharts.svelte
    - src/lib/features/finance/PremiumBlock.svelte
    - src/lib/features/finance/CurrencyBlock.svelte
    - src/lib/features/logins/LoginMapSection.svelte
    - src/lib/features/playtime/PlaytimeSummary.svelte
    - src/lib/features/logins/LoginSummary.svelte
    - tests/e2e/shell/master-detail-nav.spec.ts

key-decisions:
  - "The disclosure wraps only the keyboard-use hints and the conditional hour-grid start-basis note. The calendar and hour-grid basis captions (Phase 4 D-01), the session-length explanation (D-05), the map's DB-IP attribution (CC BY 4.0) and the not-drawn count stay visible, because earlier phases and a licence require them as visible text; the UI-SPEC's 'wraps existing explanatory copy' is read as the narrowest set that satisfies both documents"
  - "Tile phone numerals shrink inside each component's own 480px rule rather than in app.css, so the scoped rule outranks a global one and the pinned 128px/200px tracks are untouched"
  - "The UI-SPEC reference CSS's 3-up phone tile row and uppercase tile label are NOT applied: a 14px uppercase label does not fit the 96px tracks a 3-up row needs, and the pinned 128px tracks give two per row at 375px"

patterns-established:
  - "AboutDisclosure takes a fixed ui-copy name and a children snippet; no prop accepts export data and nothing is rendered as raw HTML"

requirements-completed: []

coverage:
  - id: D1
    description: "The calendar's keyboard hint sits in a collapsed 'About this calendar' disclosure whose summary is at least 44px high, the basis caption stays visible, and the grid's aria-describedby still resolves to the hint text while the details is closed"
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/master-detail-nav.spec.ts#(chart-chrome)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The hour grid, premium, currency and map keyboard hints are inside AboutDisclosure and keep their ids; basis captions, the duration explanation and the map attribution stay outside every disclosure"
    verification:
      - kind: unit
        ref: "tests/unit/charts/about-disclosure.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "AboutDisclosure copy: formatAboutThis and the five chart names are pinned"
    verification:
      - kind: unit
        ref: "tests/unit/shell/ui-copy.test.ts#08-06 About-this disclosure copy"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tile geometry guarantees from Phases 4 and 6 still hold: grid tracks, overflow-wrap and the unit's nowrap"
    verification:
      - kind: unit
        ref: "tests/unit/playtime/playtime-charts.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Tile numerals are 30px ink at 1280px and 18px at 375px, on a --list tile with a 1px border and 8px radius, with no sideways scroll"
    verification:
      - kind: command
        ref: "throwaway Playwright spec (deleted, not committed): computed font-size, colour, background, border and radius of every tile dd on Playtime and Login history at 1280 and 375; scrollWidth equal to clientWidth"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual weight of the numerals and the look of the disclosure summary against the design canvas"
    human_judgment: true
    rationale: "Weight, density and the absence of awkward wraps are judged by eye. Measured values were correct at both widths but no design-canvas comparison was made."
---

# Phase 8 Plan 06: About-this disclosure and stat tiles Summary

**Five charts now tuck their keyboard-use hints into a shared native 'About this <name>' disclosure with a 44px summary while every requirement-bearing caption and the DB-IP licence line stay visible, and the Playtime and Login tiles carry the Day 10 30px ink numerals and token chrome.**

## Accomplishments

- `AboutDisclosure.svelte`: one native `details` with a `summary` built from `formatAboutThis(name)` and a body that renders the children. Summary is 44px min-height, 14px/600, ink, underlined, default marker kept, global focus ring untouched.
- `ui-copy.ts`: `formatAboutThis` and `ABOUT_NAME_CALENDAR` ('calendar'), `ABOUT_NAME_HOUR_GRID` ('hour grid'), `ABOUT_NAME_PREMIUM` ('chart'), `ABOUT_NAME_CURRENCY` ('chart'), `ABOUT_NAME_MAP` ('map'), all pinned in `ui-copy.test.ts`.
- Applied to the calendar (`about-calendar`), the hour grid (`about-hour-grid`, also holding the conditional start-basis note), the premium chart (`about-premium`), each currency chart (`about-currency-<index>`) and the login map (`about-map`). Each hint paragraph is unchanged and keeps its `id`, and each chart's `aria-describedby` / `describedBy` value is identical.
- `about-disclosure.test.ts`: splits each component source into inside-disclosure and outside-disclosure regions and asserts the hints are inside with ids, the two basis captions, the duration explanation and the map attribution, attribution link and not-drawn line are outside, and that the component has a details with a summary, `min-height: 44px`, no font-size under 14px, no inline style, no overflow and no raw-HTML directive.
- Nav spec: `(escape-in-chart)` renamed to `(chart-chrome)` (still 14 tests) and extended: basis caption visible, `about-calendar` visible with the right text, summary at least 44px, hint in the DOM but hidden while closed, the grid's `aria-describedby` resolves to the hint text, clicking the summary reveals it, and the original Escape assertions kept.
- Tiles (`PlaytimeSummary`, `LoginSummary`): `.tile` border `1px solid var(--border)`, radius `var(--radius-card)`, background `var(--list)`; `dt` and the Playtime `.unit` colour `var(--muted)`; `dd` numeral 30px in `var(--ink)`, 18px inside a 480px media rule. `dd.fact` stays 18px.

## Task Commits

1. Task 1 (tracer): `6aba30b` feat(08-06): About this calendar disclosure around the calendar keyboard hint
2. Task 2: `c5fe8e8` feat(08-06): disclosure on the hour grid, premium, currency and map hints
3. Task 3: `33ddb8a` feat(08-06): stat tile numerals and chrome on the Day 10 tokens

Tracer gate: the Task 1 verify (unit shell, playtime-charts and guards; nav spec 14/14; `pnpm run check`; plus `pnpm run lint`) was green before Task 2 began.

## Verification

- `pnpm exec vitest run tests/unit`: 84 files, 2579 tests passed (includes the new guard file). `tests/unit/playtime` is untouched (`git diff --stat -- tests/unit/playtime` prints nothing).
- `playwright test --project=chromium tests/e2e/shell/master-detail-nav.spec.ts`: 14 passed, run through the scratchpad throwaway config (the installed browsers do not match the pinned version); no repo config changed.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: prettier and eslint clean.
- Acceptance: `grep -c AboutDisclosure CurrencyBlock.svelte` prints 3; `font-size: 30px` appears once in each tile stylesheet; the tile diff contains no changed `grid-template-columns`, `overflow-wrap` or `white-space` line.
- Throwaway spec (deleted, never committed), computed styles on the sample export: at 1280px every count `dd` is 30px, `rgb(17,17,17)`, 36px tall (under the 40px bound); tiles are `rgb(245,245,245)` with a 1px border and 8px radius; at 375px count numerals are 18px and 22px tall; `dd.fact` is 18px at both widths; no horizontal overflow in either section at either width.
- Not run, expected red until their migration plans: `tests/e2e/playtime/playtime-ui-review.spec.ts` (its `G-04-UI-2` tile test was tried and fails at `getByTestId('playtime')` before reaching any tile assertion, i.e. the existing master-detail migration gap, not this plan), and the finance, vehicle and login specs, which apply rule R7 for the disclosure content in their own plans.

## Deviations from Plan

None to scope. For the orchestrator to rule on, as the plan asked:

- **Tile phone layout (Task 3):** the UI-SPEC reference CSS's phone 3-up tile row and uppercase tile label are intentionally not applied. A 14px uppercase label does not fit the 96px tracks a 3-up row needs, and the pinned 128px tracks (Phase 4 and 6 unit and browser tests) give two per row at 375px.
- **Disclosure scope (Task 2):** the disclosure wraps only keyboard hints and the conditional start-basis note, not every caption. D-01 (Phase 4) requires the basis statement as visible text under the chart, D-05 the duration explanation, and the DB-IP attribution is a licence obligation.

**Total deviations:** 0 auto-fixed. **Impact:** none on scope.

## Known Stubs

None.

## Threat Flags

None. No network, storage or URL surface added. T-08-20: the summary text is `formatAboutThis` over a fixed constant, no prop accepts export data, and the guard asserts no raw-HTML directive. T-08-21: the attribution link stays outside every disclosure and the guard test asserts it. T-08-22: `(chart-chrome)` proves the grid's `aria-describedby` still resolves to the hint text while the details is closed.

## Self-Check: PASSED

- FOUND: src/lib/charts/AboutDisclosure.svelte, tests/unit/charts/about-disclosure.test.ts
- FOUND: the five edited chart components and the two tile stylesheets
- FOUND commits: 6aba30b, c5fe8e8, 33ddb8a
