# Phase 14: Design unification - Research

**Researched:** 2026-10-25
**Domain:** CSS architecture for a Svelte 5 + Vite 8 single-page app (design tokens, shared classes, native nesting, source-reading guards). No new dependency.
**Confidence:** HIGH for toolchain behaviour (probed locally in this session), HIGH for the inventory (re-measured, several claims corrected), MEDIUM for browser-support floors (sources disagree).

<user_constraints>
## User Constraints (from CONTEXT.md)

**Source:** `.planning/phases/14-design-unification/14-CONTEXT.md` (copied verbatim below. The planner must honour these.)

### Locked Decisions

**Token architecture**
- **D-01:** Phase 14 tokenises type, spacing, shared classes and hex colours together (not fonts only). Today: 209 raw `font-size: Npx` (188 are `14px`) with zero `var()` use, 200+ raw spacing values, 72 hex literals in `.svelte` files, `.caption` redefined 23 times, `.body` 16, `.error` 13, `.scroller` 10, `.visually-hidden` 8. — **Reversibility:** costly — every later style edit and the guards depend on the token names.
- **D-02:** Shared tokens and classes live in split global CSS files under `src/styles/` (tokens, type roles, utilities), imported once from the entry, as plain CSS (Svelte convention: scoped `<style>` for component-specific rules, plain global CSS imported at the entry for shared ones; the Svelte docs prescribe no file layout). `app.css` keeps only what is not token/type/utility (element resets). A guard rejects local re-definitions of the shared class names. Because a scoped selector outranks a global one (the scoping class adds 0-1-0), each local duplicate must be DELETED, not shadowed.
- **D-03:** Guards enforce the tokens after migration: no raw font-size px, no raw spacing px (`0`, `auto` and `calc()` allowed), no hex outside the token files, no local redefinition of the shared class names. Replaces today's per-folder font-size exemption in `phase8-ui-review-guards` and `phase5-layout-guards`.
- **D-04:** Spacing scale is 4 / 8 / 12 / 16 / 24 px. The 6px values (45 uses) snap to 4 or 8 per site, verified in screenshots (the allowed layout nudge).
- **D-05:** Native CSS nesting is REQUIRED for every style block that is touched (restructure migrated blocks into nested form). Guard regexes must keep matching nested declarations (each declaration on its own line).

**Type scale**
- **D-06:** One app-wide scale 12 / 14 / 18 / 26 / 32 / 56 px (union of the old 14/18/26/30 and the Overview 12/14/32/56). Tokens are role-named: `--fs-caption` 12, `--fs-body` 14, `--fs-heading` 18, `--fs-display` 26, `--fs-stat` 32, `--fs-hero` 56.
- **D-07:** Roles bundle size, weight and line-height as utility classes (e.g. `.t-body`, `.t-caption`), so the repeated size/weight/line-height triples collapse to one class. The underlying tokens stay usable directly.
- **D-08:** The two 30px uses outside the Overview snap to `--fs-display` (26).
- **D-09:** The Overview keeps its 12 / 14 / 32 / 56 sizes; it adopts the shared tokens (see D-15).

**Heat scale replaces the ramp**
- **D-10:** `--heat-*` fully replaces `--ramp-0..5` on the calendar heatmap, hour grid, duration list, world map and `ChartLegend`; `--ramp-*` is deleted. One value scale app-wide.
- **D-11:** The six rank levels are derived in CSS from the `--heat-low` / `--heat-mid` / `--heat-peak` stops with `color-mix()` (no hand-picked six literals). Levels stay discrete and rank-based (never interpolated from data). The empty-cell grey stays a neutral token. `contrast.test.ts` must recompute the mixed colours (same colour space as the CSS) and assert each of the six steps >= 3:1 against white and strictly monotonic lightness, including the lightest old step that was chosen under different rules.

**Pane title and shell**
- **D-12:** Pane titles move to `--fs-stat` (32px) from the 26px Display role. Below 900px (today's breakpoint) they drop to `--fs-display` (26), not 18. Roles must be named so "title" does not collide with the display role; the planner picks the class name (e.g. `.t-title` resolving to stat/display).

**Verification**
- **D-13:** Verified by before/after Playwright screenshots of every pane at desktop and 375px using the synthetic fixture, reviewed in UAT (not asserted pixel-exact: the 6px and 30px snaps and the 32px titles change pixels on purpose), plus `contrast.test.ts` on the six heat tokens, the new guards, and the existing zero-network e2e.

**Migration order**
- **D-14:** Foundation plan first (token/type/utility files and the new guards, old guards kept green through a temporary allowlist), then one plan per pane group (shell, playtime, logins, vehicles, finance, new-data/devices and the remaining groups) removing local duplicates and raw values, and a last plan that deletes the allowlist, `--ramp-*` and the folder exemptions. The build and test suite stay green between plans. No single big codemod.

**Overview freeze**
- **D-15:** The Overview must look pixel-identical. It adopts the shared tokens and drops its folder exemption; 12 / 14 / 32 / 56 and all of its spacing resolve to the same px as today. Any Overview spacing that is off the 4/8/12/16/24 scale keeps its pixels (a `--space-*` step or documented exception decided by the planner); the 6px snap (D-04) does not apply inside the Overview. Proven by before/after screenshots.

### Claude's Discretion
- Exact file names inside `src/styles/`, the role class names, and the `--space-*` token names.
- Per-site choice of 4 vs 8 for each 6px, and any alignment nudges, judged in screenshots.
- Exact `color-mix()` stops and colour space, subject to D-11's tests.
- Handling of off-scale Overview spacing (D-15) and of shared-class-name collisions where local definitions differ in meaning.

### Deferred Ideas (OUT OF SCOPE)
- Dark mode and theming beyond tokens.
- Committed pixel-baseline screenshot tests in CI (brittle across OS fonts; reconsider later).
- Svelte wrapper components for text roles (`<Caption>`): rejected for now.

**Scope limits from CONTEXT (also out of scope):** layout or DOM restructuring (small spacing/alignment nudges are allowed), new features or data, dark mode, SCSS/Sass (rejected: native CSS nesting, custom properties and Svelte scoping cover it, and the guard tests read raw CSS), any new network request.

**Phase requirement IDs:** none mapped (roadmap says TBD). The planner derives the work from D-01 to D-15 and from the approved UI-SPEC (`14-UI-SPEC.md`, status approved, Open Items OI-1 to OI-11). No `<phase_requirements>` block is emitted because no IDs were provided.
</user_constraints>

## Summary

The phase is a CSS restructuring with one real risk: the source-reading guards. Three findings change how the planner should sequence the work.

First, native nesting is safe to ship. Svelte 5.57.1 scopes every nested selector (it adds `:where(.svelte-HASH)` to the scoped compound, so the scope class is applied once), it keeps the nested form in its compiled output, and it rejects a top-level `&` with a compile error. Vite 8.3.1's build flattens the nesting into plain selectors and folds a literal `color-mix()` into a static hex. Both were verified by compiling and building a probe project. Nesting does, however, raise specificity: a nested rule carries its parent's scope class, so a converted rule can tie with a phone-block rule in `app.css` that was written to outrank the flat version. The `app.css` comment at lines 282-291 states the rule that makes that matter.

Second, the guards cannot be migrated by regex tweaks alone. Verified breakages: `ruleDeclarations` in `phase5-layout-guards` stops at the first nested `}` (a probe confirmed `flex-direction: row` goes missing from a nested `.controls` block); `fontSizeOffenders` in `phase8-ui-review-guards` reports every `var(--fs-*)` as an offender; `contrast.test.ts` cannot parse `color-mix()` with its hex-only helper and asserts `--ramp-5 >= 7:1`, which the new peak stop (5.33:1) fails. Two unit tests (`device-info-blocks`, `new-data-blocks`) would pass vacuously after migration because they have no non-empty guard. A new brace-aware parser in `tests/helpers/` is the recommended foundation.

Third, the UI-SPEC's inventory is accurate in its headline numbers (209 font-size declarations, 188 at 14px, 22 hex files, 23/17/12/10/8 shared-name definitions, one `gap: 6px`), but it misses several details that change the plan. One `.caption` is 12px (the UI-SPEC says none is). The `.error` utility spec omits the 1px `--danger` border and 6px radius that all 12 local copies carry. The four `.scroller` variants differ in meaning. The `.caption` and `.body` class names appear in 40 markup file entries (22 files use `caption`, 18 use `body`) and in 7 e2e locators, and the UI-SPEC does not say how they are renamed. The heat stops are also duplicated as TypeScript constants in `overview-heat.ts`. The e2e suite sits at exactly 273 listed tests, which is the ceiling `ci-budget.test.ts` allows, so the phase cannot add an e2e test without a budget raise.

**Primary recommendation:** Sequence the work as CONTEXT D-14 requires, but make Plan 1 include (a) a brace-aware CSS test helper, (b) the nesting compile test and the `color-mix` mixing helper, and (c) rewritten guards that accept `var()` values, all before any component is touched. Then migrate panes with the old guards held by a temporary allowlist.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Design tokens (colour, type, spacing, heat) | Browser / Client (CSS custom properties in `src/styles/tokens.css`) | — | Pure presentation; resolved by the browser at computed-value time |
| Shared role and utility classes | Browser / Client (`src/styles/type.css`, `utilities.css`) | — | Global CSS imported once from `src/main.ts` |
| Component-specific layout | Browser / Client (scoped `<style>` in each `.svelte`) | — | Svelte scoping; nested form per D-05 |
| Phone-width layout | Browser / Client (single `@media (max-width: 480px)` block in `app.css`) | — | Kept in `app.css` per OI-11 (owner decision open) |
| Token and style guards | Build-time test tier (Vitest reads source text) | — | Source-level assertions; no runtime effect |
| Colour contrast verification | Build-time test tier (`contrast.test.ts` recomputes ratios) | — | Arithmetic over the declared stops |
| Visual verification | Browser / Client via Playwright screenshots (scratch, not committed) | UAT by the owner | D-13; no committed pixel baselines (deferred) |

No capability in this phase belongs to the server, the worker or the CDN. The zero-network constraint (AGENTS.md) applies to CSS too: no `url()` or `@import` to a remote host may be added (see Security Domain).

## Standard Stack

### Core (already installed, no change)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte | 5.57.1 installed (`svelte: ^5.57.0` in package.json) | Component compiler, scoped CSS | Probed this session: nested CSS compiles and scopes correctly |
| Vite | 8.3.1 installed (`vite: ^8.3.0`) | Build; CSS transform via Lightning CSS (`lightningcss ^1.33.0` is a Vite dependency) | Probed this session: build flattens nesting and folds literal `color-mix()` |
| @sveltejs/vite-plugin-svelte | 7.3.1 installed (`^7.3.0`) | Svelte to Vite integration | Compiles `.svelte` style blocks (probe used the repo's installed copy) |
| Vitest | 5.0.2 installed | Unit and guard tests | Baseline: 159 files, 4777 passing, 9 expected-fail |
| Playwright | `@playwright/test ^1.63.0`; Chromium cache `chromium-1243` present | E2E and scratch screenshots | `playwright test --list` reports 273 tests |
| TypeScript | 6.0.3 installed (`~6.0.2`) | Typing for test helpers | Unchanged |

### Platform features used by the design (no packages)

| Feature | Support | Source |
|---------|---------|--------|
| Native CSS nesting | First unflagged: Chrome 112, Safari 16.5, Firefox 117. Baseline-style minimum cited by some sources: Chrome 120, Safari 17.2, Firefox 117. Sources disagree on full support | [CITED: brycewray.com "Native CSS nesting support arrives in the Big Three browsers"](https://brycewray.com/posts/2023/08/native-css-nesting-support-arrives-big-three-browsers/); [CITED: pawelgrzybek.com "native css nesting landed"](https://pawelgrzybek.com/native-css-nesting-landed/) |
| `color-mix()` | Chrome 111, Edge 111, Firefox 113, Safari 16.2 | [CITED: developer.chrome.com/docs/css-ui/css-color-mix](https://developer.chrome.com/docs/css-ui/css-color-mix) (confirmed by search result; MDN page did not expose its table) |
| `@supports (color: color-mix(...))` fallback | Same as above | Used for the `--heat-2` and `--heat-4` fallback (UI-SPEC) |

**Version verification:** No package is added, so no `npm view` check applies. Installed versions were read from `node_modules/*/package.json` (svelte 5.57.1 via `require('svelte/package.json')`; vite 8.3.1 from `node_modules/vite/package.json`; plugin 7.3.1 from `node_modules/@sveltejs/vite-plugin-svelte/package.json`; vitest 5.0.2 from `vitest --version` output in the baseline run).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain nested CSS | SCSS / Sass | Rejected by CONTEXT. Adds a build dependency and changes what the guard tests read |
| `color-mix(in srgb …)` | `color-mix(in oklab …)` | oklab gives different midpoints (probe: `oklab(0.617692 -0.0923566 0.0785661)` vs srgb `color(srgb 0.34902 0.590196 0.266667)` for the same stops). UI-SPEC chose srgb. Keep srgb |
| Brace-aware parser in `tests/helpers/` | `postcss` (transitive dependency of Vite) | Importing a transitive dependency from tests is fragile and adds an implicit dependency. Write the ~40-line scanner instead |

**Package Legitimacy Audit:** Not applicable. This phase installs no external package (CONTEXT: no new runtime dependency; AGENTS.md dependency minimalism). The gate was not run.

## Architecture Patterns

### Recommended file layout

```
src/
├── main.ts                    # imports tokens.css, type.css, utilities.css, app.css in that order (UI-SPEC)
├── app.css                    # element resets, shell layout, the one 480px phone block (OI-11)
└── styles/
    ├── tokens.css             # every :root custom property; the only file with hex or px font sizes
    ├── type.css               # .t-* role classes: size, weight, line-height only
    └── utilities.css          # .visually-hidden, .scroller (core), .error, .btn — each defined once
tests/
├── helpers/
│   ├── css.ts                 # NEW: brace-aware rule and declaration scanner (zero dependencies)
│   ├── color.ts               # NEW or extend contrast.ts: mixSrgb() for color-mix(in srgb)
│   ├── components.ts          # SCALE_PX becomes {12,14,18,26,32,56}; OVERVIEW_SCALE_PX removed
│   └── contrast.ts            # existing; add rgb-float support for mixed colours
└── unit/guards/
    ├── design-tokens-guards.test.ts   # NEW: G1-G8 (or split by guard)
    └── nesting-guard.test.ts          # NEW: compile probe + G6
```

### Pattern 1: Nested block form (verified by probe)

Svelte 5.57.1 output for a nested block (probe `svelte-nest-probe.mjs`, compiled with `css: 'external'`):

```css
/* Source */
.card {
  padding: var(--space-8);
  & .label {
    font-size: var(--fs-caption);
    &:hover { color: var(--ink); }
  }
  @media (max-width: 480px) {
    & .label { font-size: var(--fs-body); }
  }
}
.card:hover .label { color: var(--ink); }

/* Svelte compiled output (scope hash shortened) */
.card.svelte-47bagk { padding: var(--space-8); }
.card.svelte-47bagk .label:where(.svelte-47bagk) { font-size: var(--fs-caption); }
.card.svelte-47bagk .label:where(.svelte-47bagk):hover { color: var(--ink); }
@media (max-width: 480px) { .card.svelte-47bagk .label:where(.svelte-47bagk) { font-size: var(--fs-body); } }
.card.svelte-47bagk:hover .label:where(.svelte-47bagk) { color: var(--ink); }
```

Observed rules [VERIFIED: probe run this session, Svelte 5.57.1]:
- Svelte does not flatten nested rules in its output; the nested form is kept.
- The scope class appears on the top-level compound and as `:where(.svelte-HASH)` on each nested compound.
- `:global(.x) .label` becomes `.x .label.svelte-HASH` (the scope lands on the last compound).
- `& :is(h1)` becomes `& :is(h1:where(.svelte-HASH))`; `&:not(.skip) .label` scopes only `.label`.
- `& :global(.external)` is emitted unscoped (`& .external`).
- Two-level and nested-`@media` nesting both scope correctly.
- An unprefixed nested selector (`.label { }` inside `.card { }`) is accepted and scoped in 5.57.1 [VERIFIED: probe]. Issue #8587 in the Svelte repo reported otherwise for an earlier version [CITED: github.com/sveltejs/svelte/issues/8587]. Write `&` on every nested selector anyway, so the form matches the MDN rule that a bare nested element selector is a descendant selector.
- A top-level `&` (for example `.card & { }` outside any rule) is a compile error `css_nesting_selector_invalid_placement` [VERIFIED: probe].
- A nested selector that matches no element is dropped from the output and reported as a `css_unused_selector` warning, for example `Unused CSS selector "& .nothere"` [VERIFIED: probe]. The warning does not fail `svelte-check` by default (its `--fail-on-warnings` flag is off by default) [VERIFIED: `npx svelte-check --help` in the repo].

**Specificity change (the main risk):** A nested rule carries its parent's scope class. The flat `.label` scoped rule has specificity (0,2,0) (class plus scope class). The nested `.card .label` form compiles to `.card.svelte-x .label:where(.svelte-x)` with specificity (0,3,0). Any conversion can therefore change which rule wins against a global rule. The phone block in `app.css` is written to outrank scoped rules by prefixing `.shell` and a hook, and its comment says the outcome must never depend on source order (lines 282-291). A nested component rule that reaches the same specificity as one of those phone rules would make source order decide. The planner must add a computed-style check at 375px for each migrated pane (see Validation).

### Pattern 2: The heat scale in CSS

```css
/* tokens.css (values from app.css lines 135-137, UI-SPEC Heat scale) */
:root {
  --heat-low: #47a374;
  --heat-mid: #6b8a14;
  --heat-peak: #8c6400;
  --heat-empty: #eef0f2;
  /* Fallbacks first; the derived steps are overridden inside @supports. */
  --heat-1: var(--heat-low);
  --heat-2: var(--heat-low);
  --heat-3: var(--heat-mid);
  --heat-4: var(--heat-mid);
  --heat-5: var(--heat-peak);
}
@supports (color: color-mix(in srgb, red, blue)) {
  :root {
    --heat-2: color-mix(in srgb, var(--heat-low) 50%, var(--heat-mid));
    --heat-4: color-mix(in srgb, var(--heat-mid) 50%, var(--heat-peak));
  }
}
```

Verified behaviour:
- Vite 8.3.1 build keeps the `@supports` block and leaves `color-mix()` inside custom properties unresolved [VERIFIED: probe build output]. It folds a literal `color-mix()` in an ordinary declaration into a hex value: `color-mix(in srgb, #47a374 50%, #6b8a14)` became `#599744` [VERIFIED: probe build output]. Do not write a literal `color-mix()` in a declaration if a test expects to find that string in the output.
- Chromium 153 resolves `color-mix(in srgb, var(--heat-low) 50%, var(--heat-mid))` to `color(srgb 0.34902 0.590196 0.266667)`, which is (89, 150.5, 68) on the 0-255 scale. `--heat-4` resolves to `color(srgb 0.484314 0.466667 0.0392157)`, which is (123.5, 119, 10) [VERIFIED: probe `cmix-probe.mjs`, headless Chromium 153]. Both equal the plain channel average in gamma-encoded sRGB. That is the arithmetic `contrast.test.ts` must mirror.
- `oklab` would give `oklab(0.617692 -0.0923566 0.0785661)` for the same stops, a different colour. The test must fail if the expression is changed to oklab.
- Chromium serialises `color-mix()` results as `color(srgb …)`, not `rgb(…)`. Any future `toHaveCSS('background-color', 'rgb(…)')` on `--heat-2` or `--heat-4` will fail. Assert `data-level` instead, as `playtime-charts.spec.ts` already does.

### Pattern 3: Transparency without `rgba()`

`color-mix(in srgb, var(--ink) 5%, transparent)` computes to `color(srgb 0.0666667 0.0666667 0.0666667 / 0.05)`, the same channels and alpha as `rgba(17, 17, 17, 0.05)` [VERIFIED: probe `alpha-probe.mjs`]. The same holds for `color-mix(in srgb, var(--focus) 25%, transparent)` against `rgba(26, 115, 232, 0.25)`. Both `rgba()` uses in the Overview shadows and the spinner can therefore move to tokens with no pixel change.

### Pattern 4: Role classes (D-07)

Role classes set size, weight and line-height and never colour (UI-SPEC). The local `.caption` and `.body` definitions set colour, so the colour must move to a carrier. Two options exist; UI-SPEC does not choose:

- **A. Scoped colour in the component:** `class="t-body"` on the element and `.x { color: var(--muted); }` in the component's own `<style>`. This keeps "roles never set colour".
- **B. Colour utilities:** `.c-muted` and `.c-text` in `utilities.css`. Adds two shared classes.

Recommendation: A. It matches the UI-SPEC rule and needs no further shared names. Verified scope of the problem: all 23 `.caption` definitions and 16 `.body` definitions set a colour (`--muted` for `.caption`, `--text` for most `.body`, `--ink` for `OverviewBento`'s `.body`) (inventory below).

### Anti-Patterns to Avoid

- **Shadowing instead of deleting local duplicates.** A scoped selector outranks a global one. Every local `.caption`, `.body`, `.error`, `.scroller` and `.visually-hidden` must be deleted (D-02).
- **A `margin` inside a role.** The local `.caption` rules carry `margin: 0`, `margin: 8px 0 0` and `margin: -4px 0 0` in different components. Margins belong to the component rule, not to the role.
- **Regex parsing of nested CSS.** `[^}]*` stops at the first nested brace. Use the brace-aware scanner.
- **Using `var()` in a guard's regex without teaching it.** `font-size: var(--fs-caption)` must be accepted by name, and `font-size: 12px` must still fail.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing CSS in tests | Another regex per guard | One brace-aware scanner in `tests/helpers/css.ts` | The current `[^}]*` extraction breaks on nesting (verified) |
| Mixing `color-mix()` in tests | A table of hand-picked six literals | `mixSrgb(a, b, weight)` over the three stops, plus string equality with the declared expression | D-11 forbids hand-picked levels; the string check stops a drift to oklab |
| Shared utility classes | Svelte wrapper components (`<Caption>`) | Plain global classes in `src/styles/` | Deferred by CONTEXT |
| Dark-mode or theme switching | A theme engine | Token files only | Deferred |
| Pixel comparison | A pixel-diff dependency (for example pixelmatch) | An in-page canvas comparison in a scratch Playwright script, or byte comparison of two screenshots of the same element | No new dependency (AGENTS.md); committed baselines are deferred |

**Key insight:** The guards are the real product of this phase. The CSS is mechanical once they can read nested, `var()`-based source. Building the scanner first costs one plan step and prevents the vacuous passes described under Pitfalls.

## Runtime State Inventory

This is a rename and refactor phase (class names and token names change). All five categories are answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| **Stored data** | None. The only persisted store is the Dexie IndexedDB holding the parsed export dataset (AGENTS.md). CSS class names, token names and heat levels are not stored | None |
| **Live service config** | None. The app is a static site with no external service configuration, dashboard or UI-held config | None |
| **OS-registered state** | None. No Task Scheduler, launchd, systemd or pm2 entries reference these names | None |
| **Secrets and env vars** | None. The class and token names are not env vars. `.env.local` (present in the repo root) holds the WG API key used by the vehicle table build; this phase does not read or change it | None |
| **Build artifacts** | `dist/` (gitignored, `.gitignore` line 5), `test-results/` (gitignored, line 19), the Vite cache, and `graphify-out/` (committed-state graph, stale after code edits). Project CLAUDE.md requires `graphify update .` after code files change | Rebuild `dist/`; run `graphify update .` after the phase's code edits |

**Canonical question:** After every file in the repo is updated, what runtime systems still have the old string cached? Answer: nothing persisted outside the repo. The only stale state is build output, which is rebuilt.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Vite, probes | yes | v26.12.1 (run skill says 22.12+) | — |
| pnpm | Scripts | yes | 12.6.0 (matches `packageManager`) | — |
| Playwright Chromium | E2E, screenshots, `color-mix` probe | yes | Chrome 153 (`chromium-1243` in `~/Library/Caches/ms-playwright`) | — |
| Vitest | Unit and guards | yes | 5.0.2 | — |
| `svelte/compiler` | Nesting compile test | yes | 5.57.1 | — |
| `playwright test --list` | CI budget guard | yes | 273 tests in 33 files (measured) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Measured Inventory (verified this session)

These are the planner's baseline. Where this inventory corrects the UI-SPEC, the correction is marked.

### Font sizes

| Declaration | Count | Where | Source |
|-------------|-------|-------|--------|
| `font-size: 14px` | 188 in `.svelte` | Across components | [VERIFIED: grep and scripted scan, src/**/*.svelte] |
| `font-size: 12px` | 11 in `.svelte` | All in `features/overview/` (`OverviewBars` 2, `OverviewBento` 2, `OverviewGroup` 2, `OverviewRows` 1, `OverviewTile` 4) | [VERIFIED: scripted scan] |
| `font-size: 26px` | 4 | `SpendSummary.svelte`, `DashboardSection.svelte`, `Overview.svelte` (`lib/shell/`), `IdentityHeader.svelte` | [VERIFIED: scripted scan] |
| `font-size: 30px` | 2 | `PlaytimeSummary.svelte`, `LoginSummary.svelte` | [VERIFIED: scripted scan] |
| `font-size: 18px` | 2 in `.svelte` (`LoginSummary`, `IdentityHeader` phone overrides) plus 7 in `app.css` | | [VERIFIED: scripted scan; app.css lines 381, 402, 411, 424, 453, 492, 502.] |
| `font-size: 32px` / `56px` | 1 each, both in `OverviewTile.svelte` | | [VERIFIED: scripted scan] |
| `font-size: var(` anywhere | 0 | | [VERIFIED: grep] |

**Correction to the UI-SPEC:** The UI-SPEC says "None is 12px" for the `.caption` definitions. The scan found one `.caption` at 12px, in `src/lib/features/overview/OverviewBento.svelte`:

```
  .caption {
    font-size: 12px;
    font-weight: 400;
```
[VERIFIED: grep -n, `OverviewBento.svelte:472-474`]. Its colour is `--muted` (`font-size: 12px; font-weight: 400; line-height: 1.4; color: var(--muted);`). It maps to `.t-caption`. The other 22 definitions are 14px.

### Shared class names defined locally

| Class | Definitions | Distinct bodies | What differs |
|-------|-------------|-----------------|--------------|
| `.caption` | 23 | 8 | Colour is `--muted` in all. Weight 600 in `IdentityHeader`. Margins vary: `margin: 0` (most), `margin: 8px 0 0` (`CityList`), `margin: -4px 0 0` (`NewDataCard`, a negative margin). `line-height: 1.5` in `Playtime.svelte`. One is 12px (OverviewBento) |
| `.body` | 16 (UI-SPEC says 17 files and 18 selectors; the scan counts 16 definitions) | 3 | Colour `--text` in 15, `--ink` in `OverviewBento`. Each sets `font-size: 14px` and weight 400. `margin` varies |
| `.error` | 13 | 2 | 12 copies are one box: `padding: 8px 12px; border: 1px solid #c5221f; border-radius: 6px; background: #fce8e6; color: #8a1c17;`. `CityOptIn.svelte` has a plain text variant (`margin: 0; min-width: 0; font-size: 14px; ... color: var(--text);`), not a box |
| `.scroller` | 10 | 4 | Table scroller (bordered card, `max-height: 480px`, `border-radius: 6px`, `isolation: isolate`), chart scroller (`overflow-x: auto; overflow-y: hidden; padding: 4px 0`), list scroller (`max-height: 320px; margin-top: 8px`), `DeviceTable` (bordered, no `isolation`) |
| `.visually-hidden` | 8 | 1 | Identical. Contains `margin: -1px` and `clip: rect(0, 0, 0, 0)` |

Verbatim definitions read this session: `AccountTimelinePane.svelte:289-292` (`.error { padding: 8px 12px; border: 1px solid #c5221f; border-radius: 6px;`); `CityOptIn.svelte:294-297` (`.error { margin: 0; min-width: 0; font-size: 14px;`); `MonthlyBarChart.svelte:399-402` (`.scroller { overflow-x: auto; overflow-y: hidden; max-width: 100%;`); `LoginTable.svelte:317-320` (`.scroller { position: relative; isolation: isolate; overflow: auto;`).

**Correction to the UI-SPEC's `.error` utility:** UI-SPEC says the utility is "body role, `--danger-ink` text, `--danger-bg` surface, `8px 12px` padding". That omits the `border: 1px solid var(--danger)` and `border-radius` (6px, which the Resolved Conflicts table keeps as `--radius-sm`) that every box-style copy declares. Without them the 12 error boxes lose their border and corner radius, a visible regression not in the Allowed Visible Changes list.

**Gap in UI-SPEC (G5):** The guard list in UI-SPEC names `.t-*`, `.visually-hidden`, `.scroller`, `.error` and `.btn`. It does not name `.caption` or `.body`, yet both must disappear as classes (D-01, D-02). The markup uses them in 22 files (`caption`) and 18 files (`body`). Under Pattern 4 the markup changes to `t-caption`, `t-body` or `t-body` plus a colour in the scoped rule. Seven e2e locators use the old classes (below), and two unit tests assert the literal markup (`new-data-blocks.test.ts:384` asserts `<p class="caption">`; `vehicle-blocks.test.ts:774` asserts `class="body info"`).

### Spacing

| Measure | Count | Source |
|---------|-------|--------|
| Spacing declarations (`padding*`, `margin*`, `gap`, `row-gap`, `column-gap`) | 442 | [VERIFIED: scripted scan] |
| Already G3-clean (`0`, `auto`, `calc()`, `var(--space-4/8/12/16/24)`, `var(--layout-*)`) | 167 | [VERIFIED: scripted scan] |
| Declarations G3 would reject | 275, with 64 distinct values | [VERIFIED: scripted scan] |
| `gap: 6px` | 1, `PlayerStats.svelte:1402` | [VERIFIED: `grep -n "gap: 6px"`] |
| `margin: -1px` | 25 declarations, including `App.svelte:377`, `ListPane.svelte:201`, `app.css:416`, `Dropzone.svelte:209` | [VERIFIED: grep and scan] |
| Multi-value shorthands (for example `padding: 8px 12px`) | 30 for `padding: 8px 12px` alone | [VERIFIED: scan] |

**Gap in G3:** The list `0`, `auto`, `calc()`, `var(--space-N)`, `var(--layout-*)` has no entry for negative offsets (the visually-hidden `margin: -1px`, `margin: -4px 0 0` in `NewDataCard`) and does not say how multi-value shorthands are checked. The planner must decide both. Recommended: check every whitespace-separated token of a shorthand, exempt the one `margin: -1px` in `utilities.css` by file (the clip idiom), and convert `NewDataCard`'s `-4px` to an allowed form or document it as an exception.

### Hex and colour functions

| Measure | Count | Source |
|---------|-------|--------|
| Files with a hex literal in `.svelte` | 22 | [VERIFIED: grep] |
| Lines with a hex literal in `.svelte` | 69 (the UI-SPEC's 72 counts occurrences) | [VERIFIED: grep] |
| `rgba()` / `hsl()` in `.svelte` | 3 files: `App.svelte:391,407` (spinner, `rgba(26,115,232,…)`), `lib/shell/ImportBar.svelte:188,204` (same spinner), `lib/features/overview/OverviewTile.svelte:202,208,219` (shadows, `rgba(17,17,17,…)`) | [VERIFIED: grep -n] |

Both spinner files also match the `rgba(` allow-list entry in `phase8-ui-review-guards.test.ts`. The `rgba()` values convert to `color-mix(in srgb, … transparent)` with no pixel change (Pattern 3).

### Heat-scale consumers and their ramp usages

| File | Ramp use | Source |
|------|----------|--------|
| `CalendarHeatmap.svelte` | `fill: var(--ramp-0)` through `var(--ramp-5)` at lines 845-860 | [VERIFIED: grep] |
| `HourGrid.svelte` | `fill: var(--ramp-0)` … `var(--ramp-5)` at lines 552-567 | [VERIFIED: grep] |
| `WorldMap.svelte` | `fill: var(--ramp-0)` … `var(--ramp-5)` at lines 470-485 | [VERIFIED: grep] |
| `ChartLegend.svelte` | `background: var(--ramp-0)` … `var(--ramp-5)` at lines 88-103 | [VERIFIED: grep] |
| `DurationList.svelte` | `fill: var(--ramp-4);` at line 177 | [VERIFIED: grep] |

Note: `DurationList` uses `--ramp-4` today, which is `#1f7a74`. UI-SPEC maps it to `--heat-3` (`#6b8a14`, 3.98:1). That is a visible colour change for every bar, and it is in Allowed Visible Changes item 1 ("levels 1 to 5 change colour").

**Tests and files that assert ramp tokens or the ramp hexes (the UI-SPEC's "four other unit tests" is correct):**

| File | What it asserts |
|------|-----------------|
| `tests/unit/charts/contrast.test.ts` | Parses `--ramp-N` from app.css (line 156), parses the 04-UI-SPEC table from `.planning/milestones/v1.0-phases/04-*` (line 37-40), `lightness` and `1.25` adjacency (lines 193-217), `4.5 / 7` for levels 4-5 (lines 224-225), the 06-UI-SPEC map table (lines 818-840) |
| `tests/unit/playtime/playtime-charts.test.ts` | `var(--ramp-${level})` in legend and cells (lines 186-193), `var(--ramp-4)` in the duration list (468-469), no `var(--ramp-N)` other than 4 (469), and the cells test (631-643) |
| `tests/unit/charts/bar-chart-components.test.ts` | `not.toMatch(/var\(--ramp-/)` (line 36) |
| `tests/unit/finance/currency-blocks.test.ts` | The six `--ramp-N` hexes as a list (lines 21-26) and `not.toContain('var(--ramp-')` (line 147) |
| `tests/unit/logins/map-model.test.ts` | Parses six `--ramp-N` hexes from app.css (lines 498-509) and asserts length 6 |
| `tests/unit/overview/overview-heat.test.ts` | Reads `--heat-low/mid/peak` from app.css (lines 35-44) and compares to `HEAT_STOPS` |

**Duplicate of the heat stops:** `src/lib/features/overview/overview-heat.ts` holds `HEAT_STOPS` as channel values (its comment says they are "the channel values of the `--heat-low`, `--heat-mid` and `--heat-peak` custom properties in `src/app.css`"). The UI-SPEC does not mention this file. It must stay in step with `tokens.css`, and `overview-heat.test.ts` must read `tokens.css` after the move.

### Files reading `app.css` from disk (the path changes when tokens move)

Eight test files read `src/app.css` with `readFileSync` (verified by grep): `tests/unit/charts/contrast.test.ts`, `tests/unit/guards/phase5-layout-guards.test.ts`, `tests/unit/guards/phase8-shell-guards.test.ts`, `tests/unit/guards/phase8-ui-review-guards.test.ts`, `tests/unit/logins/map-model.test.ts`, `tests/unit/overview/overview-heat.test.ts`, `tests/unit/playtime/playtime-charts.test.ts`, `tests/unit/shell/identity-model.test.ts`. Six of them read tokens (the colour and heat values), so they need the `tokens.css` path. Two read the phone block or the layout, so they stay on `app.css` (OI-11).

### Font-size assertions that will break (verified)

| File | Assertion | Failure mode after `var()` migration |
|------|-----------|---------------------------------------|
| `tests/unit/guards/phase8-ui-review-guards.test.ts:155-161` | Every font-size is on SCALE_PX or OVERVIEW_SCALE_PX | Loud: `var(--fs-*)` is rejected (verified by probe) |
| `tests/unit/guards/phase5-layout-guards.test.ts:134-165` | Floor parsing, `(\d+)(px|rem)?` | Loud: `var()` hits the "not a px or rem value" branch |
| `tests/unit/guards/phase5-layout-guards.test.ts:168-180` | `.controls` declares `flex-direction: row` | Loud after nesting: `[^}]*` truncates (verified by probe) |
| `tests/unit/overview/overview-components-guard.test.ts:210-218, 290-302, 386-394` | `font-size` values in `OVERVIEW_SCALE_PX`, `font-size:\s*32px`, `56px`, `14px` for `.unit` | Loud (literal px asserted) |
| `tests/unit/charts/about-disclosure.test.ts:161-163` | Sizes `>= 14`, `sizes.length > 0` | Loud (length 0) |
| `tests/unit/new-data/new-data-panes.test.ts:167-168` | `sizes.length > 0`, values in `['14','18','26','30']` | Loud (length 0) |
| `tests/unit/device-info/device-info-blocks.test.ts:142-143` | Values in `['14','18','26','30']`, **no length check** | **Vacuous pass** (loop over an empty array) |
| `tests/unit/new-data/new-data-blocks.test.ts:349-350` | Values in `['14','18','26','30']`, **no length check** | **Vacuous pass** |
| `tests/e2e/shell/master-detail-nav.spec.ts:52, 70-99` | Computed sizes on `SCALE_PX` and `OVERVIEW_PAGE_SCALE` | Loud when the scale set changes; see below |
| `tests/e2e/playtime/playtime-ui-review.spec.ts:447-449` | Numeral `30px` at desktop, `18px` at 375 | Loud (D-08 changes desktop to 26px; the test must be amended) |
| `tests/e2e/shell/multi-account.spec.ts:457` | ID-only title `14px` | Stays 14px (see Open Questions) |
| `tests/e2e/shell/multi-account.spec.ts:470-471` | Named multi-row title `18px` | Loud under Allowed Visible Changes item 3 (see Open Questions) |

**Scope change to flag:** Today the phase-8 and e2e checks are per-page scales (the Overview page allows 12/14/32/56, every other page 14/18/26/30). After D-03 the guard is global and the scale is one set. The e2e check `offScaleText` then cannot tell that a 12px caption appears outside the Overview. That is an accepted consequence of D-03; the planner should record it in the plan rather than discover it in review.

### E2E selectors on the old class names (verified)

`tests/e2e/finance/finance.spec.ts` uses `p.body` (lines 599, 963), `p.caption.title` (962), `p.caption` (1203, 1221, 1547, 1556). Renaming the markup classes (Pattern 4 option A) breaks all seven. The amendment is a locator change, not a behaviour change.

`tests/unit/guards/phase7-layout-guards.test.ts:82-87` asserts that `.scroller` in `LoginTable`, `VehicleTable`, `CityList` and `CountryList` declares `isolation: isolate`. Moving `.scroller` to `utilities.css` (G5) makes that component-level read return no rule. The test needs to read the scroller core in `utilities.css` plus the variant's own rule.

### Component style-block sizes

Measured this session, counting lines inside the first `<style>` element: `OverviewTile.svelte` 329, `PlayerStats.svelte` 292, `LoginTable.svelte` 217, `VehicleTable.svelte` 210, `SpendSummary.svelte` 196, `OverviewBento.svelte` 193. CONTEXT's figures (`PlayerStats` 356, `OverviewTile` 340, `VehicleTable` 268) use a different counting method. Use the measured figures for planning; both sets agree on the ranking.

### Nested CSS today

No `.svelte` style block uses nesting. The only `&` characters in `.svelte` files are the `&&` operator in script code (verified by grep). The UI-SPEC claim is correct.

## Guard Redesign

Every guard reads raw source, comment-stripped. The table gives each guard, its current form, what breaks, and the proposed rule.

| Guard (UI-SPEC) | Current implementation | What breaks | Proposed |
|-----------------|----------------------|-------------|----------|
| G1 font-size | `phase8-ui-review-guards.test.ts:105-118`: `font-size\s*:\s*([^;}\n]+)`, px in `SCALE_PX` | Every `var()` is an offender; the per-folder scale must go | Accept `var(--fs-caption|body|heading|display|stat|hero)` and `var(--fs-title)`; reject any px, em, rem, `%`, keyword other than inherit/initial/unset/0. Scope: all `src/**/*.{svelte,css}` except `src/styles/tokens.css` and `type.css` |
| G2 font floor | `phase5-layout-guards.test.ts:134-165`: floor 14 or 12 per folder | Floor is per folder; `var()` hits the non-px branch | Resolve each `--fs-*` from `tokens.css` and assert every value is at least 12 |
| G3 spacing | Not guarded today | 275 declarations to migrate; negative values; shorthands | Check each token of a shorthand; allow `0`, `auto`, `calc(…)`, `var(--space-4|8|12|16|24)`, `var(--layout-*)`; exempt `margin: -1px` only in `utilities.css` |
| G4 colour | `phase8-ui-review-guards.test.ts:67-68, 332-449`: `ALLOWED_COLOUR_LITERALS` allow-list; `TOKEN_DECLARATION` exemption for `app.css` | Exemption is hard-wired to `app.css` (line 461) | Forbid hex, `rgb(`, `rgba(`, `hsl(` in `.svelte` and in `src/styles/*.css` except `tokens.css`. Delete the allow-list (UI-SPEC) and move the token exemption to `tokens.css` |
| G5 shared names | None | Not guarded today | Forbid definitions of `.t-*`, `.visually-hidden`, `.scroller`, `.error`, `.btn` outside `src/styles/`. Add `.caption` and `.body` to the forbidden list after migration |
| G6 nesting | Flat-only regexes | `[^}]*` truncation | Brace-aware scanner; keep one declaration per line (the existing style) |
| G7 breakpoints | `phase8-ui-review-guards.test.ts:267`: `max-width\s*:\s*480px`, exactly one in `app.css` | Unchanged for `app.css`; `tokens.css` 899px switch is not a phone block | Keep as is |
| G8 ramp | `--ramp-` assertions in 6 files | Must reach zero | After the last plan: `grep` finds no `--ramp-` outside `.planning/` and `graphify-out/` |

**Self-test pattern to keep:** The existing `describe` blocks that feed synthetic entries to the pure functions (`phase8-ui-review-guards.test.ts:217-254`, `phase5-layout-guards.test.ts:287-321`) are good practice. Keep them for each new guard.

**Non-vacuous guards:** Each new sweep must assert that it visited files and found declarations: `expect(declarations.length).toBeGreaterThan(0)`. The `device-info` and `new-data-blocks` tests above show why.

## Code Examples

### Brace-aware rule scanner (proposed `tests/helpers/css.ts`)

```typescript
// Zero-dependency scanner. Returns each rule's selector text and its own declarations
// (declarations of nested rules are returned with their own selector, not the parent's).
export interface CssRule { selector: string; declarations: string[]; depth: number }

export function scanRules(source: string): CssRule[] {
  const rules: CssRule[] = [];
  const stack: { selector: string; rule: CssRule }[] = [];
  let buffer = '';
  for (const ch of source) {
    if (ch === '{') {
      const selector = buffer.trim();
      buffer = '';
      const rule: CssRule = { selector, declarations: [], depth: stack.length };
      rules.push(rule);
      stack.push({ selector, rule });
    } else if (ch === '}') {
      const top = stack.pop();
      if (top && buffer.trim() !== '') top.rule.declarations.push(buffer.trim());
      buffer = '';
    } else if (ch === ';') {
      const top = stack[stack.length - 1];
      if (top) top.rule.declarations.push(buffer.trim());
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  return rules;
}
```

This is a sketch. It needs unit tests for strings containing braces and for `@media` headers. It is the foundation for G1, G3, G5 and the rewritten `ruleDeclarations`.

### Mixing in sRGB for the contrast test (proposed)

```typescript
// Mirrors CSS `color-mix(in srgb, A p%, B)`: channel average in gamma-encoded sRGB.
// Verified against headless Chromium 153: (71,163,116) and (107,138,20) at 50%
// give (89, 150.5, 68).
export function mixSrgb(a: [number, number, number], b: [number, number, number], pctA: number): [number, number, number] {
  return [0, 1, 2].map((i) => a[i]! * pctA + b[i]! * (1 - pctA)) as [number, number, number];
}
```

The test must also assert the declaration string. For example, `expect(tokensCss).toContain('color-mix(in srgb, var(--heat-low) 50%, var(--heat-mid))')`. The string check is what stops a silent switch to oklab.

### Heat assertions (replacing the ramp tests)

Per UI-SPEC "Heat assertions", using the verified values: data steps 1 to 5 at least 3:1 on white (3.107, 3.558, 3.984, 4.674, 5.333); lightness strictly falls across all six swatches including the empty grey (0.8691, 0.2879, 0.2451, 0.2135, 0.1746, 0.1469); adjacent data steps at least 1.1:1 (measured minimum 1.120, OI-4).

Remove, because each is false under the new scale: `expect(contrastRatio(appCssRamp().get(5)…)).toBeGreaterThanOrEqual(7)` (the peak is 5.333); `adjacent steps … at least 1.25:1` (minimum is 1.120); "steps 1 to 3 sit below the 3:1 non-text floor" in the map tests (steps 1 to 5 are now at least 3:1); "the Time dot is the ramp's fourth step" (`--ov-time` is `#1f7a74`, which is no longer a token; its value stays the same but the ramp link is gone).

## Common Pitfalls

### Pitfall 1: Nesting changes the cascade winner
**What goes wrong:** A flat scoped rule (specificity 0,2,0) converted to nested form (0,3,0) starts beating a phone-block rule in `app.css`, or ties with it and source order decides.
**Why it happens:** The nested compound carries the parent's scope class. The phone-block rules are written `.shell …` to outrank scoped rules. Their own comment says the outcome must not depend on source order (`app.css:282-291`).
**How to avoid:** Keep the phone rules' specificity above every nested component rule they override, or delete the duplicated phone overrides (UI-SPEC does for titles). Verify by computed style at 375px.
**Warning signs:** A pane's title or a list row changes size or colour only at 375px after a conversion.

### Pitfall 2: The phone overrides beat the new title role
**What goes wrong:** `.t-title` (specificity 0,1,0) is overridden by `app.css` rules such as `.shell .overview > .section-title { font-size: 18px; }` (0,3,0) and `.shell .pane-detail .phone-title { font-size: 18px; }` (0,3,0).
**Why it happens:** Those phone rules are still present after the title moves to 26px below 900px.
**How to avoid:** Delete the phone-width `font-size` overrides for titles (UI-SPEC: "the phone-width overrides that set titles to 18px are deleted"). The title role does the switch through `--fs-title`.
**Warning signs:** Titles still render at 18px at 375px after the role is applied.

### Pitfall 3: `.error` loses its border and corner radius
**What goes wrong:** Twelve error boxes lose their 1px `--danger` border and 6px radius.
**Why it happens:** The UI-SPEC `.error` utility lists only the padding, colours and background.
**How to avoid:** Put `border: 1px solid var(--danger); border-radius: var(--radius-sm);` in the utility (`--radius-sm` is 6px, UI-SPEC OI-6). Keep `CityOptIn`'s text variant out of the utility: rename it or give it a scoped rule.

### Pitfall 4: `.caption` and `.body` markup silently lose their styling
**What goes wrong:** Deleting the local `.caption` rule without renaming the 22 files that use it leaves those `<p class="caption">` elements unstyled. Nothing fails, because no test renders them at the pixel level.
**Why it happens:** The UI-SPEC does not name `.caption` or `.body` in G5, so no guard would catch an unstyled leftover.
**How to avoid:** Add `.caption` and `.body` to the forbidden-definition list (G5) and to the markup check (no `class="caption"` or `class="body"` remains), and update the seven e2e locators and two unit assertions in the same plan.

### Pitfall 5: The `.scroller` variants are not one utility
**What goes wrong:** The shared `.scroller` pulls in the table card style (border, radius, max-height 480, isolation) and changes the chart scrollers and the list scrollers.
**Why it happens:** Four variants share a class name and differ in meaning.
**How to avoid:** Put only the common core (`overflow: auto; min-width: 0;`) in `utilities.css`. Keep each variant's own rule in its component, under a variant name if needed. `phase7-layout-guards` then reads the component rule for `isolation`.

### Pitfall 6: Vacuous passes
**What goes wrong:** A test loops over an empty list of font sizes and passes.
**Why it happens:** `device-info-blocks.test.ts:142` and `new-data-blocks.test.ts:349` have no `length > 0` check. After migration their regex matches nothing.
**How to avoid:** Assert non-empty matches in every sweep, and rewrite these two tests against `var(--fs-*)`.

### Pitfall 7: Stale comments describe the old scale
**What goes wrong:** Comments say the lightest ramp steps sit below 3:1, which is no longer true.
**Why it happens:** Comments in `ChartLegend.svelte:13-21`, `LoginMapSection.svelte:33`, `ui-copy.ts:1190` and `:3232-3236`, and `contrast.test.ts:891-901` describe the old relief rule.
**How to avoid:** Update the comments in the same plan that changes the stops. `ui-copy.ts` copy strings must not change (UI-SPEC copy drift check), so edit only the comment, and re-read the copy-drift table after the edit.

### Pitfall 8: A literal `color-mix()` disappears in the build
**What goes wrong:** A guard or e2e test that searches the built CSS for `color-mix(` finds the folded hex.
**Why it happens:** Vite folds literal `color-mix()` declarations (verified).
**How to avoid:** Keep `color-mix()` only inside custom properties, and test the source string, not the build output.

### Pitfall 9: The e2e ceiling
**What goes wrong:** Adding one e2e test makes the listed count exceed 273. The `ci-budget.test.ts` guard fails and the CI deadline must be raised.
**Why it happens:** The guard states "A listed count above 273 needs all three raised again (G + 2 min, W + 8 min per the rule in this file), never one." The suite is at 273 today.
**How to avoid:** Add no e2e test in this phase. Put the new coverage in unit and guard tests, and do the screenshot review with a scratch script.

### Pitfall 10: Two sources of the heat stops
**What goes wrong:** `overview-heat.ts` `HEAT_STOPS` and `tokens.css` drift apart, and the Overview's eased bars change colour.
**Why it happens:** The Overview paints in TypeScript (`heatColor(t)` returns hex), not from CSS variables.
**How to avoid:** Keep the existing `overview-heat.test.ts` equality check, and point it at `tokens.css`.

### Pitfall 11: Shorthand values slip past a single-value check
**What goes wrong:** `padding: 8px 12px` passes if the guard reads only the first token.
**How to avoid:** Split on whitespace and check every token, as in the scanner sketch.

### Pitfall 12: The sketch skill still says to keep the ramp
**What goes wrong:** The sketch-findings skill, auto-loaded for UI work under project CLAUDE.md, says "Keep `--ramp-0..5` as is", and its design section says "Data keeps the app's existing teal ramp untouched." D-10 deletes the ramp. An executor reading the skill could restore it.
**How to avoid:** Record in the plan that D-10 supersedes the skill's ramp guidance. Update the skill as part of the last plan.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-picked ramp literals (`--ramp-0..5`) | Derived steps with `color-mix()` from stops | Browser support from Chrome 111 / Safari 16.2 / Firefox 113 | Six literals become three stops plus two derived steps (D-11) |
| Flat rules with one selector each | Native nesting | Chrome 112, Safari 16.5, Firefox 117 unflagged; Baseline minimum cited as 120 / 17.2 / 117 | Svelte 5.57.1 scopes it; Vite flattens it for the build |
| SCSS for nesting and variables | Native nesting plus custom properties | Ongoing | SCSS rejected by CONTEXT |
| Per-folder font scales | One app-wide role scale | This phase | Guards become global |

**Deprecated / outdated in this repo:**
- `--ramp-0..5` and the per-folder font-size exemptions: removed by D-10 and D-14's last plan.
- The sketch skill's "keep the ramp" guidance: superseded by D-10 (Pitfall 12).

## Assumptions Log

> Every claim tagged `[ASSUMED]` in this research. Items A1 to A4 need owner or planner confirmation before they become locked decisions.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The owner accepts the browser-support range for nesting (Chrome 112 first unflagged, or 120 as the Baseline floor) given that production CSS is flattened by Vite | Standard Stack | Low for the built app (flattened, verified); a dev-only concern for older browsers |
| A2 | Chromium 153 is representative for the `color-mix()` arithmetic; Safari and Firefox were not tested | Architecture Patterns, Pattern 2 | Low. The srgb average is specified; only rounding could differ, by less than 0.5 of one 8-bit step |
| A3 | The specificity-tie risk in the phone block is real for the planned conversions | Pitfalls 1 and 2 | Medium. Reasoned from the compiled selectors, not yet reproduced in the running app. The computed-style check in Validation is the test |
| A4 | The Overview pixel-identity check can be done with an in-page canvas comparison in a scratch script | Validation | Low. No such harness exists yet; it is a Wave 0 task |
| A5 | Moving `.caption`/`.body` colour into scoped component rules (option A) is preferred over colour utilities | Pattern 4 | Low. A planner choice, not a fact |
| A6 | The brace-aware scanner in Code Examples handles the repo's CSS (no strings containing braces in `content:`) | Code Examples | Low. Verify with unit tests of the scanner before use |

**If this table is empty:** It is not empty. The planner should confirm A1 and A3, since both affect the plan's sequencing.

## Open Questions (RESOLVED)

1. **Where do `.caption` and `.body` markup classes go?**
   - What we know: 22 and 18 files use them. Seven e2e locators and two unit assertions use the literal class names. The UI-SPEC does not name them in G5.
   - What's unclear: whether they become `t-caption`/`t-body` (renamed markup) or keep a neutral marker class.
   - Recommendation: rename to `t-caption` or `t-body` and put the colour in the component's scoped rule (Pattern 4, option A). Update the seven locators and two assertions in the same plan. Owner to confirm if the markup rename is acceptable under "DOM unchanged" (the class is not structure).
   - RESOLVED: the names are kept (lowest churn, no e2e or unit edit): `.caption` and `.body` stay as the two shared text blocks in `src/styles/utilities.css`, a variant takes a hook class beside the shared one, and `.caption` (14px muted note) is not `.t-caption` (12px role). See playbook section 5 and section 10 (item 2); plan 14-01 (decision, tracer) and plans 14-05 to 14-20 (adoption). The naming trap itself goes to the owner at UAT (plan 14-21).

2. **Named multi-account row titles: 18px or the title role?**
   - What we know: `multi-account.spec.ts:470-471` asserts a named row title at 18px (`font-size`, `'18px'`). Allowed Visible Changes item 3 moves "multi and skeleton titles" to 26/32. The UI-SPEC's `.t-title` list also includes "multi titles", but the row title is in a list pane, and `.t-body-strong` is the list-row role.
   - What's unclear: whether `identity-multi-name` (a list row) is a title or a row title.
   - Recommendation: planner reads the element's role in `IdentityMulti` (or the equivalent) and either applies `.t-title` (amend the e2e assertion to 26/32) or `.t-heading` (no change). Owner confirms.
   - RESOLVED: the named row name (`.multi-name`, a row title in a list) takes `.t-heading` (18px, no e2e change); the nickname, fallback, skeleton and multi titles take `.t-title`. See playbook section 2 and section 11 (item 3); plan 14-05.

3. **`.error` text variant in `CityOptIn`.**
   - What we know: one of the 13 `.error` definitions is plain text, not a box (`CityOptIn.svelte:294-297`).
   - Recommendation: give it a scoped rule or a different class name. Do not put it in the utility.
   - RESOLVED: in the source the `CityOptIn` `.error` is a box after all (a grouped body rule gives it the text block, its own rule the danger chrome), so its two error paragraphs become `class="body error"` on the shared box, and its neutral `.info` messages become `class="body info"` with a local chrome-only `.info` rule. See playbook section 5; plan 14-12.

4. **`.scroller` variants.**
   - Recommendation: a core in `utilities.css` (`overflow: auto; min-width: 0;`) and each variant in its component (Pitfall 5). Confirm the `phase7-layout-guards` assertion moves with it.
   - RESOLVED: `utilities.css` holds the focusable region (`min-width: 0`, `overflow: auto`, `isolation: isolate` and the nested focus ring); table and list boxes are local `table-scroll` and `list-scroll` hooks, the three chart scrollers are a local `chart-scroll` hook that gains no isolation, and `DeviceTable` states `isolation: auto`. `phase7-layout-guards` is made tolerant in plan 14-04 and follows the class into the utility. See playbook section 5; plans 14-09, 14-11, 14-13, 14-15, 14-17 and 14-18.

5. **G3 exemption for `margin: -1px`.**
   - Recommendation: allow it only in `utilities.css` (the visually-hidden clip idiom, which is a layout hack, not a spacing value). Owner to confirm, or use `inset`-based alternatives.
   - RESOLVED: `-1px` is allowed in any rule that also declares `clip` (the visually-hidden idiom under any local name such as `.chart-status`), not only in `utilities.css`, because several tests assert those local clip blocks by name. See playbook section 3 and section 5; guard G3 in plan 14-03.

6. **OI-11 (`app.css` keeps the layout and phone block).**
   - Not a research question: it is an owner decision and is listed under `## Owner-open items` below (OWNER-OPEN: UI-SPEC OI-11).

7. **Svelte `css_unused_selector` warnings in the build.** Unused nested selectors are dropped with a warning (verified). The repo has no `onwarn` handler, so the warnings appear in build logs only.
   - Recommendation: a nesting guard test should fail on any `css_unused_selector` warning from a compile of each touched component. This is cheap with `svelte/compiler`.
   - RESOLVED: `nesting-guard.test.ts` compiles every non-pending component and fails on any `css_unused_selector` warning or compile error, after proving the detector live on a fixture. See playbook section 6; plan 14-04 (Task 1).

8. **Sketch skill and the ramp.** Record the supersession in the plan (Pitfall 12); decide whether the skill is updated in the same change or after.
   - RESOLVED: the supersession is recorded in the playbook (section 10, item 6) and the skill is updated in the closing plan, not earlier. See playbook Appendix A (R16); plan 14-21 (Task 2).

## Owner-open items

> These are decisions that belong to the owner, not research questions. They do not block planning. Each is carried to plan 14-21's `Open items for the owner` section and to its UAT checklist.

1. **OI-11: where shared CSS lives.** OWNER-OPEN: UI-SPEC OI-11. D-02 says `app.css` keeps only the element resets. The UI-SPEC and the plans keep the shell layout and the single 480px phone block in `app.css` as well, because the phase-8 guard reads the phone block there. The planner's position, followed by plans 14-04 to 14-06: keep. The owner has NOT confirmed it as of 2026-10-25. The alternative is to move the layout and the phone block into `src/styles/` and repoint the guard.

## Validation Architecture

> Required: `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Unit framework | Vitest 5.0.2 (`vitest.config.ts`) |
| E2E framework | Playwright (`@playwright/test ^1.63.0`, `playwright.config.ts`) |
| Quick run (touched guards and contrast) | `npx vitest run tests/unit/guards/phase5-layout-guards.test.ts tests/unit/guards/phase8-ui-review-guards.test.ts tests/unit/charts/contrast.test.ts tests/unit/guards/ci-budget.test.ts` |
| Full unit suite | `pnpm test:unit` (baseline: 159 files, 4777 passing, 9 expected-fail, about 12 s) |
| Type and Svelte check | `pnpm check` (`tsc -b && svelte-check --tsconfig ./tsconfig.app.json --threshold warning`) |
| Lint and format | `pnpm lint` (`prettier --check . && eslint .`) |
| Build | `pnpm run build` |
| Full e2e | `pnpm test:e2e` (`playwright test`), 273 listed tests, projected about 1474 s by the budget guard's own arithmetic |

### Phase Requirements to Test Map

| Decision | Behaviour | Test type | Automated command | File exists? |
|----------|-----------|-----------|-------------------|--------------|
| D-01 / D-02 | Every token declared once in `src/styles/tokens.css`; shared classes defined only in `src/styles/` | Guard (source) | `npx vitest run tests/unit/guards/design-tokens-guards.test.ts` | No, create in Wave 0 |
| D-03 / G1 | No raw px font size; every size is `var(--fs-*)` or a role | Guard | same | No, create in Wave 0 (rewrite of `phase8-ui-review-guards`) |
| G2 | Every resolved `--fs-*` is at least 12px | Guard | same | No, create in Wave 0 |
| D-03 / G3 | Spacing uses only the scale, `0`, `auto`, `calc()`, `var(--layout-*)`; shorthands checked per token | Guard | same | No, create in Wave 0 |
| D-03 / G4 | No hex, `rgb(`, `rgba(`, `hsl(` outside `tokens.css` | Guard | same | No, create in Wave 0 (rewrite of the colour block in `phase8-ui-review-guards`) |
| G5 | Shared names defined only in `src/styles/`; `.caption` and `.body` not defined locally | Guard | same | No, create in Wave 0 |
| D-05 / G6 | Nested blocks compile with scoped selectors and no `css_unused_selector` warning | Unit (compiler) | `npx vitest run tests/unit/guards/nesting-guard.test.ts` | No, create in Wave 0 |
| G6 | Every declaration sits on its own line in touched blocks | Guard | same | No, create in Wave 0 |
| D-06 / D-07 | Each `.t-*` role sets only size, weight and line-height (plus uppercase and tracking on `.t-label`) | Guard | same | No, create in Wave 0 |
| D-08 | The two 30px numerals become 26px at desktop | E2E amendment and guard | `npx playwright test tests/e2e/playtime/playtime-ui-review.spec.ts` | Yes (amend) |
| D-09 / D-15 | Overview keeps 12/14/32/56 and its spacing; pixels identical except the title | Scratch screenshot compare (see below) | scratch script, not committed | No, create in Wave 0 (scratch) |
| D-10 / G8 | No `--ramp-` remains outside `.planning/` and `graphify-out/` | Guard | `grep -rn -- "--ramp-" src tests` must return nothing | No last plan |
| D-11 | Derived `--heat-2` and `--heat-4` are declared as `color-mix(in srgb, …)` and mirror the mixed colours | Unit | `npx vitest run tests/unit/charts/contrast.test.ts` | Yes (rewrite) |
| D-11 | Five data steps at least 3:1 on white; lightness strictly falling across six swatches; adjacent data steps at least 1.1:1 | Unit | same | Yes (rewrite) |
| D-12 | Pane titles are `.t-title`; no title wraps at 900px or 375px except long nicknames | Screenshot review (UAT) and computed style | scratch script plus UAT | No, create in Wave 0 (scratch) |
| D-13 | Every pane at 1280px and 375px, plus 900 and 899px for the title switch, before and after | Screenshot review (UAT) | `run-data-export-viewer` driver (`.claude/skills/run-data-export-viewer/driver.mjs`) against `pnpm run preview` on port 4173, with the synthetic fixture `tests/fixtures/multi-account-fixtures.ts` | Yes (driver exists; not read this session) |
| Zero-network | No network request after page load | E2E (existing) | `npx playwright test tests/e2e/shell/dashboard.spec.ts tests/e2e/import/import-flow.spec.ts` (among the specs that assert requests) | Yes |
| Zero-network source | No `fetch`, `XMLHttpRequest`, etc. in source | Unit (existing) | `npx vitest run tests/unit/guards/fetch-scan.test.ts` | Yes |
| CSS network | No `url(` or `@import` to a remote host in CSS | Guard | new check in the design-tokens guard | No, create in Wave 0 (not covered by `fetch-scan`, which contains no `url(` or `@import` check) |
| Focal element and copy drift | Focal order unchanged; copy strings verbatim | UAT plus unit | UAT plus existing copy tests | Yes / manual |
| Budget | Listed e2e count stays at or below 273 | Unit (existing) | `npx vitest run tests/unit/guards/ci-budget.test.ts` | Yes |

### Sampling Rate

- **Per task commit:** the quick run above (about 2 s for the nine CSS-relevant unit files, 269 tests as of this baseline).
- **Per plan merge (wave):** `pnpm test:unit`, `pnpm lint`, `pnpm check`, `pnpm run build`.
- **Phase gate:** full unit suite green, `pnpm test:e2e` green (273 listed tests), screenshot UAT signed off, `grep` ramp check at zero.

### Wave 0 Gaps

- [ ] `tests/helpers/css.ts` — brace-aware scanner (Code Examples) with its own unit test (strings, `@media`, nested depth)
- [ ] `tests/helpers/color.ts` (or extend `tests/helpers/contrast.ts`) — `mixSrgb` and an rgb-float luminance, with a test against the Chromium-verified values (89, 150.5, 68) and (123.5, 119, 10)
- [ ] `tests/unit/guards/design-tokens-guards.test.ts` — G1 to G5 and the CSS network check, each with a non-empty-match assertion and a self-test on synthetic input (the pattern in `phase8-ui-review-guards.test.ts:217-254`)
- [ ] `tests/unit/guards/nesting-guard.test.ts` — compiles a nested fixture with `svelte/compiler` and asserts `:where(.svelte-` and no `css_unused_selector` (D-05, OI-10)
- [ ] `tests/helpers/components.ts` — `SCALE_PX` becomes `new Set([12, 14, 18, 26, 32, 56])`; `OVERVIEW_SCALE_PX` removed
- [ ] Scratch screenshot harness, outside the repo (not committed; avoids the e2e ceiling)
- [ ] Scratch Overview pixel-compare, outside the repo

*(If no gaps: not applicable. There are gaps.)*

### Non-vacuity rule

Every sweep test asserts it visited at least one file and matched at least one declaration (`expect(matches.length).toBeGreaterThan(0)`), because `device-info-blocks` and `new-data-blocks` pass with zero matches.

### Overview pixel identity (D-15)

Verify with an in-page comparison, not a pixel-diff dependency: capture the Overview root element as PNG before and after each plan at 1040, 880, 479 and 340px (UI-SPEC widths), decode both in the page with `createImageBitmap` and an offscreen canvas, and compare `ImageData` byte-for-byte. Expected differences: only the title (Allowed Visible Changes item 2), which sits inside the Overview root. Mask the title's bounding box before comparison, or compare the Overview with the title's section excluded. Note: the Overview at 480px and below hides the in-content title visually (UI-SPEC), so the mask is only needed at 880px and above.

### Screenshot review (D-13)

The owner reviews before and after captures in UAT. Captures are not committed (Deferred: committed pixel baselines). The ci-budget constraint means the review harness lives outside the repo or in a script that is not listed by `playwright test --list`.

## Security Domain

> Required: `security_enforcement` is `true` (absent or true means enabled) in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Not touched (no auth surface) |
| V3 Session Management | no | Not touched |
| V4 Access Control | no | Not touched |
| V5 Input Validation | no new input | No user data reaches CSS. Export data is rendered as text, not as style values. Verify no style value is built from data (for example, a computed `width:` is already a number and is outside this phase) |
| V6 Cryptography | no | Not touched |
| V8 Data Protection | yes (privacy, not ASVS storage) | Zero-network constraint: no `url()` or `@import` to a remote host in CSS. A new guard (Validation) closes the gap that `fetch-scan` does not cover CSS |
| V14 Configuration | yes | CSP meta `default-src 'self'` with no `style-src` directive (`vite.config.ts:37-43`). Inline `style=` attributes are blocked. Keep all styles in external files |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Remote resource in CSS (`url(https://…)`, `@import`) causing a network request | Information disclosure | Forbid in CSS and style blocks by guard; keep the CSP `connect-src 'self'` and `default-src 'self'` |
| Inline style attribute added to a component | Tampering (CSP bypass pattern) | CSP blocks it; do not add `style=` attributes; the scanner can forbid `style="` in `.svelte` |
| Style value built from imported data | Tampering | Keep styles static; any dynamic width or height is already a number in a `style:` directive (CSSOM, not an attribute) |

**Scope note:** The phase introduces no new trust boundary. Its security value is in the guards that keep the zero-network promise true for CSS.

## Sources

### Primary (verified this session in the repo, read or probed)

- `.planning/phases/14-design-unification/14-CONTEXT.md` (read in full)
- `.planning/phases/14-design-unification/14-UI-SPEC.md` (read in full)
- `.planning/STATE.md` (read first 171 of 692 lines; the rest is history not needed for this research)
- `src/app.css` (read in full, 515 lines): `:root` tokens at lines 1-137, phone block at 292-494
- `src/main.ts` (read in full): imports `./app.css` at line 2
- `tests/helpers/components.ts` (read in full): `SCALE_PX` at line 48, `OVERVIEW_SCALE_PX` at line 55
- `tests/helpers/contrast.ts` (read in full): hex-only parser (`HEX` regex, line 24)
- `tests/unit/guards/phase8-ui-review-guards.test.ts` (read in full)
- `tests/unit/guards/phase5-layout-guards.test.ts` (read in full)
- `tests/unit/charts/contrast.test.ts` (read lines 1-285, 815-935, 1085-1235)
- `vite.config.ts` (read lines 37-43 for CSP and 95-150 for config)
- `tests/unit/guards/ci-budget.test.ts` (read lines 1-60, 405-440, 560-625)
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md` (read in full)
- `.claude/skills/spike-findings-wot-gdpr-stats-visualizer/SKILL.md` (read in full)
- `.planning/config.json` (read; `nyquist_validation: true`, `security_enforcement: true`)
- Scratch probes (outside the repo, in the session scratchpad): `svelte-nest-probe.mjs`, `nest-invalid.mjs`, `nest-unused.mjs`, `nest-forms.mjs`, `guard-regex-probe.mjs`, `cmix-probe.mjs`, `alpha-probe.mjs`, `heat-math.mjs`, `inventory.mjs`, and a Vite 8.3.1 probe project in `vite-probe/`. The repo was not modified by any probe.

### Secondary (cited)

- [developer.chrome.com: CSS color-mix()](https://developer.chrome.com/docs/css-ui/css-color-mix): support Chrome 111, Edge 111, Firefox 113, Safari 16.2
- [brycewray.com: Native CSS nesting support arrives in the Big Three browsers](https://brycewray.com/posts/2023/08/native-css-nesting-support-arrives-big-three-browsers/): first unflagged versions
- [pawelgrzybek.com: native css nesting landed](https://pawelgrzybek.com/native-css-nesting-landed/)
- [MDN: Using CSS nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting/Using_CSS_nesting): nesting rules (bare element selector is a descendant selector; `&` placement); version table not exposed to the fetch tool
- [MDN: color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix): default interpolation space is oklab when none is given; version table not exposed
- [GitHub: sveltejs/svelte issue #8587](https://github.com/sveltejs/svelte/issues/8587): optional `&` reported unsupported (earlier version; the probe shows 5.57.1 accepts it)
- [GitHub: sveltejs/svelte PR #14193](https://redirect.github.com/sveltejs/svelte/pull/14193): two-level nesting scope fix (Nov 2024)
- [GitHub: sveltejs/svelte PR #14177](https://redirect.github.com/sveltejs/svelte/pull/14177): removed scoping inside `:not()`
- [GitHub: sveltejs/svelte PR #14229](https://redirect.github.com/sveltejs/svelte/pull/14229): a later comment reports nesting with `&` still breaking; status not checked

### Tertiary (LOW confidence)

- None relied on for a decision. Browser-support floors are reported as a range, not a single value.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No packages added; versions read from `node_modules`.
- Nesting behaviour (Svelte and Vite): HIGH for the forms probed. MEDIUM for forms not probed (see Open Questions 7).
- Colour arithmetic: HIGH. Verified against headless Chromium 153 to the float.
- Inventory: HIGH for counts; MEDIUM for the `margin: -1px` total (25 counted by script, not each one read).
- Guard breakage: HIGH. Reproduced with the guards' own regexes.
- Browser-support floors: MEDIUM. Sources disagree on nesting.
- Specificity risk in the phone block: MEDIUM. Reasoned from compiled selectors; not reproduced in the running app.

**Research date:** 2026-10-25
**Valid until:** 2026-11-24 for the platform facts (30 days). The inventory goes stale as soon as any plan lands, so re-measure the counts at the start of each plan that touches them.

**Not done in this research (for the planner's awareness):**
- No `gsd-tools` seam (`research-plan`, `research-store`) was run. The phase needs platform facts and repo inventory, not library documentation, so the Context7 and provider cache did not apply.
- The skill driver `.claude/skills/run-data-export-viewer/driver.mjs` was identified but not read; its screenshot interface must be checked before the harness is written.
- `grep -rn "--ramp-"` for G8 was not re-run after the phase starts. Re-run it at the beginning of planning.
- No source file was modified. The research file is the only repo write. It is not committed (project rule: commit only when asked).
