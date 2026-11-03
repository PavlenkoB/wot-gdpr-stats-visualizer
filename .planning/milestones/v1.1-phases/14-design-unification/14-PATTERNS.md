# Phase 14: Design unification - Pattern Map

**Mapped:** 2026-10-25
**Files analyzed:** 14 groups (new `src/styles/*`, new guards and helpers, 58 `.svelte` style blocks grouped by pane)
**Analogs found:** 14 / 14 (all analogs are git-tracked source; `src/styles/` does not exist yet, so its files have role analogs in `src/app.css`)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/styles/tokens.css` (new) | config (CSS custom properties) | static declarations | `src/app.css` lines 1-137 (`:root` block with contract comments) | exact |
| `src/styles/type.css` (new) | config (role classes) | static declarations | `src/app.css` lines 10-14 (body role comment) plus `DashboardSection.svelte` `.section-title` | role-match |
| `src/styles/utilities.css` (new) | config (shared classes) | static declarations | `.visually-hidden`, `.scroller`, `.error` copies in components (see Shared Patterns) | role-match |
| `src/app.css` (modified) | config (element resets, shell, phone block) | static declarations | itself, lines 194-300 and 409-455 | exact |
| `src/main.ts` (modified) | entry | import order | `src/main.ts` line 2 `import './app.css';` | exact |
| `tests/helpers/css.ts` (new) | utility (test helper) | transform (text to rules) | `tests/helpers/contrast.ts` (test-only helper, header comment explains why it is not in `src/`) | role-match |
| `tests/helpers/color.ts` (new, or extend `contrast.ts`) | utility (test helper) | transform | `tests/helpers/contrast.ts` `parseHex` and `contrastRatio` | exact |
| `tests/helpers/components.ts` (modified) | utility (test helper) | constants | itself, lines 48-55 (`SCALE_PX`, `OVERVIEW_SCALE_PX`) | exact |
| `tests/unit/guards/design-tokens-guards.test.ts` (new, G1, G3, G4, G5) | test (source guard) | batch (file sweep) | `tests/unit/guards/phase8-ui-review-guards.test.ts` (sweep plus pure-function self-tests) | exact |
| `tests/unit/guards/nesting-guard.test.ts` (new, G6, OI-10 probe) | test (compile probe) | request-response (compile) | `tests/unit/guards/phase5-layout-guards.test.ts` (flat regex plus `describe` self-tests) | role-match |
| `tests/unit/guards/phase8-ui-review-guards.test.ts` (modified) | test | batch | itself | exact |
| `tests/unit/guards/phase5-layout-guards.test.ts` (modified) | test | batch | itself, lines 214-241 (floor sweep) | exact |
| `tests/unit/charts/contrast.test.ts` (modified, heat steps) | test | transform | itself, lines 46-90 (`contrastRatio` tests) and the ramp assertions | exact |
| Pane components: shell, playtime, logins, vehicles, finance, new-data/devices, remaining (`.svelte` style blocks) | component | presentation | see Pattern Assignments (before/after) | exact per group |

## Pattern Assignments

### `src/styles/tokens.css` (config, static declarations)

**Analog:** `src/app.css`

**Contract-comment and `:root` pattern** (`src/app.css` lines 1-24, abridged):
```css
:root {
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
  color: var(--text);
  background: var(--page);
  /* The Body role (14px, 08-UI-SPEC Typography) is the page default, so every
     element that declares no size inherits it ... A component that needs another
     size picks a declared role. */
  font-size: 14px;          /* becomes: font-size: var(--fs-body); */
  line-height: 1.5;

  /* The neutral chrome palette ... A component must read var(--ink) and friends
     rather than restate a hex. */
  --page: #ffffff;
  --list: #f5f5f5;
  --card: #ffffff;
  --border: #dcdcdc;
  --faint: #8c8c8c;
  --ink: #111111;
  --text: #3a3a3a;
  --muted: #5c5c5c;
  ...
}
```
Copy: keep the contract comment style (one block per token family, naming the guard or test that enforces it). Move the neutral palette (lines 25-37) and the `--heat-*` stops (lines 135-137) into `tokens.css` unchanged in value. Add `--fs-*`, `--space-*`, `--layout-*`, `--fw-*`, `--radius-sm` (6px) and `--fs-title` switch (`min-width: 900px` / `max-width: 899px`, per UI-SPEC).

**Derived heat steps** (new, from RESEARCH Pattern 2):
```css
--heat-1: var(--heat-low);
--heat-2: var(--heat-low);      /* fallback */
--heat-3: var(--heat-mid);
--heat-4: var(--heat-mid);      /* fallback */
--heat-5: var(--heat-peak);
--heat-empty: #eef0f2;
@supports (color: color-mix(in srgb, red, blue)) {
  :root {
    --heat-2: color-mix(in srgb, var(--heat-low) 50%, var(--heat-mid));
    --heat-4: color-mix(in srgb, var(--heat-mid) 50%, var(--heat-peak));
  }
}
```

**Remove:** `--ramp-0..5` (`src/app.css` lines 52-68). Do this only in the last plan (D-14).

### `src/styles/type.css` (config, role classes)

**Analog:** the `DashboardSection.svelte` title rule (the only role-shaped rule that exists today). Excerpt, `src/lib/shell/DashboardSection.svelte` lines 204-216:
```css
/* The Display role (26 / 600 / 1.3), collapsing to the 18px Heading role at
   phone width ... */
.section-title {
  margin: 0;                 /* margin stays in the component, not the role */
  font-size: 26px;           /* becomes var(--fs-title) via .t-title */
  font-weight: 600;
  line-height: 1.3;
  color: var(--ink);         /* colour stays in the component */
  min-width: 0;
  overflow-wrap: anywhere;
}
```
Target shape for `src/styles/type.css`: a role sets `font-size`, `font-weight`, `line-height` only (plus `overflow-wrap` for `.t-title`). Role classes: `.t-hero`, `.t-stat`, `.t-title` (`--fs-title`), `.t-display`, `.t-heading`, `.t-body`, `.t-body-strong`, `.t-caption`, `.t-label` (UI-SPEC Role table). Colour goes to the component rule (RESEARCH Pattern 4 option A).

### `src/styles/utilities.css` (config, shared classes)

**Analogs:** the 8 `.visually-hidden`, 12 `.error` box, and 10 `.scroller` local copies. Verbatim:

- `.error` box, `src/lib/features/account-timeline/AccountTimelinePane.svelte` lines 289-292:
  `padding: 8px 12px; border: 1px solid #c5221f; border-radius: 6px;` plus `background: #fce8e6; color: #8a1c17;`. The utility must keep the 1px `var(--danger)` border and `var(--radius-sm)` radius (RESEARCH Pitfall 3). `CityOptIn.svelte:294-297` is a text variant and must NOT join the utility.
- `.scroller`: four meanings (RESEARCH Pitfall 5). Put only `overflow: auto; min-width: 0;` in `utilities.css`. Keep each variant's own rule (`LoginTable.svelte:317-320` `position: relative; isolation: isolate; overflow: auto;`, `MonthlyBarChart.svelte:399-402` `overflow-x: auto; overflow-y: hidden; max-width: 100%;`) in its component.
- `.visually-hidden`: identical in all 8 copies; the only file allowed `margin: -1px` (clip idiom) is `utilities.css`.

### `src/app.css` (modified; element resets, shell layout, phone block)

**Analog:** itself. Keep:
- element resets (`body`, `button`/`input`/`select`/`textarea`, `h1`/`h2`, `p`, `ul`, `a`);
- shell layout;
- the single `@media (max-width: 480px)` block (line 292, guard G7). Its comment (lines 282-291) says the outcome must not depend on source order. Preserve that rule when converting scoped rules to nested form.

Delete the phone-width title overrides at lines 409-410 (`.shell .overview > .section-title`, `.shell section[data-testid^='dashboard-section-'] > .section-title`) and 451-452 (`.shell .pane-detail .phone-title`) once the title role does the switch (UI-SPEC title rules). Pitfall 2 applies: these selectors are `0,3,0` and beat `.t-title`.

### `src/main.ts` (modified; entry)

**Analog:** itself, line 2 `import './app.css';`. New order (UI-SPEC):
```ts
import './styles/tokens.css';
import './styles/type.css';
import './styles/utilities.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
```
Keep `mount(...)` block unchanged. Note: `main.ts` imports `mount` after `app.css` today; keep the CSS imports first.

### `tests/helpers/css.ts` (new; utility, brace-aware scanner)

**Analog:** `tests/helpers/contrast.ts` (test-only, with the rationale header and `throw` on malformed input). Copy its style: a header comment saying why it is not in `src/`, then strict parsing that throws.

Proposed core (RESEARCH "Brace-aware rule scanner"):
```ts
export interface CssRule { selector: string; declarations: string[]; depth: number }
export function scanRules(source: string): CssRule[] { /* stack of open rules; ';' and '}' flush buffer */ }
```
Required unit tests: strings containing braces; `@media` headers; `flex-direction: row` inside a nested `.controls` block (the failing case of `phase5-layout-guards` `ruleDeclarations`).

### `tests/helpers/color.ts` (new, or extend `contrast.ts`)

**Analog:** `tests/helpers/contrast.ts` `parseHex` (lines 27-40) and `contrastRatio` (exported; relative luminance). Add:
```ts
// Mirrors CSS color-mix(in srgb, A p%, B): channel average in gamma-encoded sRGB.
export function mixSrgb(a: [number, number, number], b: [number, number, number], pctA: number) {
  return [0, 1, 2].map((i) => a[i]! * pctA + b[i]! * (1 - pctA)) as [number, number, number];
}
```
Pair with a string assertion on the declared expression so a silent switch to `oklab` fails.

### `tests/helpers/components.ts` (modified)

**Analog:** itself. Current (lines 48, 55):
```ts
export const SCALE_PX: ReadonlySet<number> = new Set([14, 18, 26, 30]);
export const OVERVIEW_SCALE_PX: ReadonlySet<number> = new Set([12, 14, 32, 56]);
```
Target: `SCALE_PX = new Set([12, 14, 18, 26, 32, 56])`; delete `OVERVIEW_SCALE_PX`. Note: `phase8-ui-review-guards` and `overview-components-guard.test.ts:210-218, 290-302, 386-394` import or assert these literals. Update in the same plan.

### `tests/unit/guards/design-tokens-guards.test.ts` (new; G1, G3, G4, G5)

**Analog:** `tests/unit/guards/phase8-ui-review-guards.test.ts`. Pattern to copy:
- Header comment listing what the file pins, and why helpers are copied rather than imported (test files do not import each other).
- Sweep over `src/**/*.{svelte,css}` (read raw, comment-stripped).
- Pure-function self-tests with synthetic entries (phase8 lines 217-254; phase5 lines 287-321).
- Non-vacuous assertion on every sweep: `expect(declarations.length).toBeGreaterThan(0)` (RESEARCH Pitfall 6).

Rules: G1 accepts `var(--fs-*)` by name, rejects any `px`/`em`/`rem`; G3 checks each whitespace token of a shorthand (Pitfall 11) and allows `0`, `auto`, `calc(`, `var(--space-{4,8,12,16,24})`, `var(--layout-*)`; G4 forbids `#`, `rgb(`, `rgba(`, `hsl(` outside `tokens.css`; G5 forbids local `.t-*`, `.visually-hidden`, `.scroller`, `.error`, `.btn`, `.caption`, `.body` definitions outside `src/styles/`.

### `tests/unit/guards/phase8-ui-review-guards.test.ts` and `phase5-layout-guards.test.ts` (modified)

**Analog:** itself. Replace the per-folder font-size exemption:
- `phase8` lines 105-118 (`font-size\s*:\s*([^;}\n]+)` against `SCALE_PX`): the Overview branch and `OVERVIEW_SCALE_PX` import go; `var(--fs-*)` must be accepted.
- `phase5` line 214 ("no font-size below its floor (14px, or 12px under features/overview)"): floor becomes "every resolved `--fs-*` is at least 12" (G2). Lines 134-165 parse `(\d+)(px|rem)?` and must read `tokens.css`.
- `phase5` lines 287-311 (`describe('the Overview font-size floor exemption ...')`): delete with the exemption.
- Temporary allowlist (D-14): keep both green during plans 2-6 by listing unmigrated files; the last plan deletes it.

### `tests/unit/charts/contrast.test.ts` (modified; heat steps)

**Analog:** itself, `contrastRatio` tests (lines 46-90). Keep the existing `describe('contrastRatio')` cases. Replace the `--ramp-N` assertions (line ~156 parse; lines 193-217 adjacency `1.25`; lines 224-225 `>= 7` for level 5) with:
- each data step (`--heat-1..5`) at least 3:1 on white (measured 3.11, 3.56, 3.98, 4.67, 5.33);
- lightness strictly falls across six swatches including `--heat-empty`;
- adjacent data steps at least 1.1:1 (OI-4, measured minimum 1.12);
- `--heat-2` and `--heat-4` recomputed with `mixSrgb` and matched to the declared `color-mix(in srgb, ...)` string.

### Pane components (before/after style-block pattern)

All 58 `.svelte` files use a scoped `<style>` block; no block uses nesting today (RESEARCH measured). Representative migrations, one per pane group:

**Shell** (`src/lib/shell/DashboardSection.svelte`, lines 204-216). Before: flat `.section-title` with `font-size: 26px; font-weight: 600; line-height: 1.3; color: var(--ink);`. After (role plus colour kept local, nested form per D-05 when the block is touched):
```svelte
<h2 class="t-title section-title">...</h2>
<style>
  .section-title {
    margin: 0;
    color: var(--ink);
    min-width: 0;
  }
</style>
```
The 26px, 600, 1.3 triple moves to `.t-title` in `type.css`. Delete the 18px phone-width override here if present.

**Playtime** (`src/lib/features/playtime/CalendarHeatmap.svelte` lines 845-860, `HourGrid.svelte` lines 552-567, `DurationList.svelte` line 177, `PlaytimeSummary.svelte` 30px numeral). Before: `fill: var(--ramp-0)` ... `fill: var(--ramp-5)`. After: `fill: var(--heat-empty)` for level 0, `var(--heat-1)` ... `var(--heat-5)` for levels 1-5. `DurationList` `fill: var(--ramp-4)` becomes `var(--heat-3)` (UI-SPEC, 3.98:1). `PlaytimeSummary` 30px numeral becomes `.t-display` (26px, D-08). Playtime tests to amend: `tests/unit/playtime/playtime-charts.test.ts` lines 186-193, 468-469, 631-643; `tests/e2e/playtime/playtime-ui-review.spec.ts:447-449`.

**Logins** (`src/lib/features/logins/WorldMap.svelte` lines 470-485, `LoginSummary.svelte` 30px numeral, `LoginTable.svelte` lines 317-320 `.scroller` variant). Map fills use the same `--heat-*` mapping as CalendarHeatmap. The `.scroller` variant keeps `position: relative; isolation: isolate; overflow: auto;` locally, with only `overflow: auto; min-width: 0;` from `utilities.css`. `tests/unit/logins/map-model.test.ts` lines 498-509 parses ramp hexes; reword for `--heat-*`.

**Vehicles** (`src/lib/features/vehicles/PlayerStats.svelte`, 3 local `.caption`/`.body`-style definitions and the one `gap: 6px` at line 1402). Before: `gap: 6px;`. After: `gap: var(--space-4);` (UI-SPEC Spacing Scale, the one 6px site that snaps to 4px). Local `.caption` (colour `--muted`) becomes `class="t-caption"` plus a scoped `color: var(--muted)`; local `.body` becomes `t-body` plus a scoped colour. Phase-7 guard `tests/unit/guards/phase7-layout-guards.test.ts:82-87` reads `isolation` from `.scroller` in `LoginTable`, `VehicleTable`, `CityList`, `CountryList`; it must read the variant's own rule plus the `utilities.css` core.

**Finance** (`src/lib/features/finance/SpendSummary.svelte` line ~571 `font-size: 26px` figure, becomes `.t-display`; `ChartLegend` consumer in `src/lib/charts/ChartLegend.svelte` lines 57-103). Before, `ChartLegend` `.row` (lines 61-77):
```css
.row {
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 8px 4px; margin: 0; min-width: 0;
  font-size: 14px; font-weight: 400; line-height: 1.4;
  color: var(--muted);
}
```
After: `font-size: var(--fs-body)`, `gap: var(--space-8) var(--space-4)`, colour unchanged. Swatch fills at lines 88-103 move from `var(--ramp-N)` to `var(--heat-*)`. Finance tests: `tests/unit/finance/currency-blocks.test.ts` lines 21-26, 147 (ramp hexes and `not.toContain('var(--ramp-')`).

**New-data and devices** (`src/lib/features/device-info/DeviceTable.svelte` 4 local defs; `src/lib/features/new-data/*` `NewDataCard` `margin: -4px 0 0` on `.caption`). Each `.caption` with `margin: 0` becomes `t-caption` or `t-body` plus scoped colour. The negative `-4px` margin is an exception to resolve (G3): move it to a scoped rule with a documented exception or to `var(--space-4)` with a negated calc, per the planner. Unit tests to rewrite: `tests/unit/new-data/new-data-blocks.test.ts:349-350, 384` (asserts `<p class="caption">`), `tests/unit/device-info/device-info-blocks.test.ts:142-143` (vacuous; add `length > 0`).

**Overview** (`src/lib/features/overview/OverviewTile.svelte` 4 `font-size` declarations plus `rgba()` shadows at lines 202, 208, 219; `OverviewBento.svelte` `.caption` at 472-474 is 12px). Keep sizes 12/14/32/56 via `--fs-*`; shadows use `color-mix(in srgb, var(--ink) 5%, transparent)` (value-identical, RESEARCH Pattern 3). Overview heat: `src/lib/features/overview/overview-heat.ts` `HEAT_STOPS` must stay in step with `tokens.css`; `tests/unit/overview/overview-heat.test.ts` (lines 35-44) must read `tokens.css` instead of `app.css`.

### Remaining groups (grouped, not listed individually)

Other `.svelte` files with `.caption`, `.body`, `.error`, `.scroller`, `.visually-hidden` duplicates, hex literals (`#c5221f` 15, `#8a1c17` 15, `#fce8e6` 15, `#ffffff` 12, `#fef7e0` 5, `#f9ab00` 5, `#8a5a00` 4, `#f5d4d1` 1) and raw spacing (20/32/40/48/64px gutters, which move to `--layout-*`) follow the same before/after pattern. The e2e locators on the old class names (`tests/e2e/finance/finance.spec.ts` lines 599, 962-963, 1203, 1221, 1547, 1556) change in the same plan as the markup rename.

## Shared Patterns

### Deleting local duplicates (D-02)
**Source:** `src/lib/features/account-timeline/AccountTimelinePane.svelte` lines 289-292 (the `.error` box).
**Apply to:** every component that defines `.caption`, `.body`, `.error`, `.scroller`, `.visually-hidden`.
A scoped selector outranks a global one (0-1-0 scope class), so local copies must be DELETED, not shadowed.

### Non-vacuous guards
**Source:** `tests/unit/guards/phase8-ui-review-guards.test.ts` (sweep plus self-tests).
**Apply to:** every new sweep. Assert `toBeGreaterThan(0)` on the number of declarations visited, so an empty regex match cannot pass (`device-info-blocks`, `new-data-blocks` are the known vacuous cases).

### Nesting shape (D-05)
**Source:** RESEARCH Pattern 1 (verified with Svelte 5.57.1).
**Apply to:** every touched style block. Write `&` on every nested selector; one declaration per line; no top-level `&`.
```css
.card {
  padding: var(--space-8);
  & .label {
    font-size: var(--fs-caption);
  }
  @media (max-width: 480px) {
    & .label { font-size: var(--fs-body); }
  }
}
```

### Breakpoints
**Source:** `src/app.css` line 194 (`min-width: 900px`), line 220 (`max-width: 899px`), line 292 (`max-width: 480px`).
**Apply to:** `--fs-title` switch in `tokens.css` (899px). Phone block stays single in `app.css` (G7, OI-11).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/unit/guards/nesting-guard.test.ts` (compile probe) | test | request-response | No existing test compiles a Svelte component in-process; use `svelte/compiler` directly (RESEARCH OI-10 probe) |
| `color-mix()` in `@supports` (in `tokens.css`) | config | static | No `@supports` block exists in the repo today; RESEARCH Pattern 2 is the reference |

## Metadata

**Analog search scope:** `src/app.css`, `src/main.ts`, `src/lib/shell/`, `src/lib/charts/`, `src/lib/features/{overview,playtime,logins,vehicles,finance,device-info,account-timeline}/`, `tests/helpers/`, `tests/unit/guards/`, `tests/unit/charts/`
**Files scanned:** about 25 (grep-level for the 58 style blocks; full reads for `app.css`, `DashboardSection.svelte`, `ChartLegend.svelte`, `contrast.ts` head, `phase8-ui-review-guards.test.ts` head)
**Pattern extraction date:** 2026-10-25

Note for planner: the `.planning/` and `graphify-out/` directories are not analogs. `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer` still says "keep `--ramp-0..5`" (RESEARCH Pitfall 12); D-10 supersedes it, and the last plan updates the skill.
