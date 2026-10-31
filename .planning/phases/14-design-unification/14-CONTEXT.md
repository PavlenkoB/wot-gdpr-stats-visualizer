# Phase 14: Design unification - Context

**Gathered:** 2026-10-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Every pane reads as one product. The Overview's design system (type scale, `--ov-*` group colours, `--heat-*` value scale) becomes the app-wide system, and styling is restructured so a later style change is a one-line edit instead of dozens of scattered edits.

In scope: one app-wide type scale with role tokens, a spacing scale, shared global classes defined once, hex literals moved onto tokens, the six-step `--heat-*` scale replacing `--ramp-*` on the playtime calendar, hour grid, duration list, login world map and chart legend, native CSS nesting in every touched style block, new guards replacing the per-folder exemptions, a contrast review of the new heat steps, before/after screenshot review.

Out of scope: layout or DOM restructuring (small spacing/alignment nudges forced by unifying the system are allowed, see Boundary below), new features or data, dark mode, adopting SCSS/Sass (rejected: native CSS nesting, custom properties and Svelte scoping cover it, and the guard tests read raw CSS), any new network request.

</domain>

<decisions>
## Implementation Decisions

### Token architecture
- **D-01:** Phase 14 tokenises type, spacing, shared classes and hex colours together (not fonts only). Today: 209 raw `font-size: Npx` (188 are `14px`) with zero `var()` use, 200+ raw spacing values, 72 hex literals in `.svelte` files, `.caption` redefined 23 times, `.body` 16, `.error` 13, `.scroller` 10, `.visually-hidden` 8. — **Reversibility:** costly — every later style edit and the guards depend on the token names.
- **D-02:** Shared tokens and classes live in split global CSS files under `src/styles/` (tokens, type roles, utilities), imported once from the entry, as plain CSS (Svelte convention: scoped `<style>` for component-specific rules, plain global CSS imported at the entry for shared ones; the Svelte docs prescribe no file layout). `app.css` keeps only what is not token/type/utility (element resets). A guard rejects local re-definitions of the shared class names. Because a scoped selector outranks a global one (the scoping class adds 0-1-0), each local duplicate must be DELETED, not shadowed.
- **D-03:** Guards enforce the tokens after migration: no raw font-size px, no raw spacing px (`0`, `auto` and `calc()` allowed), no hex outside the token files, no local redefinition of the shared class names. Replaces today's per-folder font-size exemption in `phase8-ui-review-guards` and `phase5-layout-guards`.
- **D-04:** Spacing scale is 4 / 8 / 12 / 16 / 24 px. The 6px values (45 uses) snap to 4 or 8 per site, verified in screenshots (the allowed layout nudge). **Amended 2026-10-25 (owner-confirmed in chat, UI-SPEC OI-6):** 44 of the 45 are `border-radius: 6px`, which is a radius and not spacing, so those 44 sites keep 6px through `--radius-sm`; the snap applies to the one spacing site (`gap: 6px` in `PlayerStats`, which becomes 4px).
- **D-05:** Native CSS nesting is REQUIRED for every style block that is touched (restructure migrated blocks into nested form). Guard regexes must keep matching nested declarations (each declaration on its own line).

### Type scale
- **D-06:** One app-wide scale 12 / 14 / 18 / 26 / 32 / 56 px (union of the old 14/18/26/30 and the Overview 12/14/32/56). Tokens are role-named: `--fs-caption` 12, `--fs-body` 14, `--fs-heading` 18, `--fs-display` 26, `--fs-stat` 32, `--fs-hero` 56.
- **D-07:** Roles bundle size, weight and line-height as utility classes (e.g. `.t-body`, `.t-caption`), so the repeated size/weight/line-height triples collapse to one class. The underlying tokens stay usable directly.
- **D-08:** The two 30px uses outside the Overview snap to `--fs-display` (26).
- **D-09:** The Overview keeps its 12 / 14 / 32 / 56 sizes; it adopts the shared tokens (see D-15).

### Heat scale replaces the ramp
- **D-10:** `--heat-*` fully replaces `--ramp-0..5` on the calendar heatmap, hour grid, duration list, world map and `ChartLegend`; `--ramp-*` is deleted. One value scale app-wide.
- **D-11:** The six rank levels are derived in CSS from the `--heat-low` / `--heat-mid` / `--heat-peak` stops with `color-mix()` (no hand-picked six literals). Levels stay discrete and rank-based (never interpolated from data). The empty-cell grey stays a neutral token. `contrast.test.ts` must recompute the mixed colours (same colour space as the CSS) and assert each of the six steps >= 3:1 against white and strictly monotonic lightness, including the lightest old step that was chosen under different rules. **Amended 2026-10-25 (owner-confirmed, UI-SPEC OI-4 and OI-5):** the scale is five data levels (`--heat-1` to `--heat-5`) plus a neutral `--heat-empty`, because `levelOf` yields zero plus five non-zero levels. The 3:1 floor applies to the five data steps (the empty cell is exempt at 1.14:1), lightness is strictly monotonic across all six swatches, and the adjacent-step floor is 1.1:1 (was 1.25:1).

### Pane title and shell
- **D-12:** Pane titles move to `--fs-stat` (32px) from the 26px Display role. Below 900px (today's breakpoint) they drop to `--fs-display` (26), not 18. Roles must be named so "title" does not collide with the display role; the planner picks the class name (e.g. `.t-title` resolving to stat/display).

### Verification
- **D-13:** Verified by before/after Playwright screenshots of every pane at desktop and 375px using the synthetic fixture, reviewed in UAT (not asserted pixel-exact: the 6px and 30px snaps and the 32px titles change pixels on purpose), plus `contrast.test.ts` on the six heat tokens, the new guards, and the existing zero-network e2e.

### Migration order
- **D-14:** Foundation plan first (token/type/utility files and the new guards, old guards kept green through a temporary allowlist), then one plan per pane group (shell, playtime, logins, vehicles, finance, new-data/devices and the remaining groups) removing local duplicates and raw values, and a last plan that deletes the allowlist, `--ramp-*` and the folder exemptions. The build and test suite stay green between plans. No single big codemod.

### Overview freeze
- **D-15:** The Overview must look pixel-identical. It adopts the shared tokens and drops its folder exemption; 12 / 14 / 32 / 56 and all of its spacing resolve to the same px as today. Any Overview spacing that is off the 4/8/12/16/24 scale keeps its pixels (a `--space-*` step or documented exception decided by the planner); the 6px snap (D-04) does not apply inside the Overview. Proven by before/after screenshots. (Refined by D-16: the only difference is inside the Overview title's own box.)
- **D-16:** The Overview title is 32px like every other pane title (D-12, UI-SPEC OI-1), but the Overview compensates its line box so that its title block keeps today's row height: content below the title keeps its position and every Overview element keeps its size (**owner-confirmed 2026-10-25**). The other panes' title rows may grow by about 8px on desktop; only the Overview compensates. The pixel gate (D-15) therefore masks exactly the title's own box and requires equal element sizes. The mechanism is a planner choice (Claude's Discretion): a local margin rule on the Overview title that cancels the taller 32px line box, written from tokens so it follows them; the Overview title is never taken back to 26px. — **Reversibility:** reversible — one rule in `Overview.svelte`.

### Claude's Discretion
- Exact file names inside `src/styles/`, the role class names, and the `--space-*` token names.
- Per-site choice of 4 vs 8 for each 6px, and any alignment nudges, judged in screenshots.
- Exact `color-mix()` stops and colour space, subject to D-11's tests.
- Handling of off-scale Overview spacing (D-15) and of shared-class-name collisions where local definitions differ in meaning.
- The exact mechanism of the Overview title compensation (D-16), as long as it keeps the title block's row height and is token-driven.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contracts
- `.planning/phases/13-overview-personal-insights/13-UI-SPEC.md` — Overview typography (12/14/32/56), colour tokens, heat scale and its contrast rules (D-13, D-22 there).
- `.planning/phases/13-overview-personal-insights/13-CONTEXT.md` — Phase 13 decisions the Overview freeze (D-15) must preserve.
- `.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md`, `references/visual-language.md` — Day 10 shell tokens and visual direction.
- `.planning/ROADMAP.md` Phase 14 entry — goal, scope and original open decisions.

### Code and tests that change
- `src/app.css` — current `:root` tokens (`--ramp-*`, `--ov-*`, `--heat-*`, palette, `--radius-*`) and element resets.
- `tests/unit/guards/phase8-ui-review-guards.test.ts`, `tests/unit/guards/phase5-layout-guards.test.ts` — per-folder font-size exemption to replace.
- `tests/unit/charts/contrast.test.ts` — recomputes recorded ratios from the token declarations; must cover the six derived heat steps.
- `tests/helpers/components.ts` — `SCALE_PX`, `OVERVIEW_SCALE_PX`.
- `src/lib/features/playtime/CalendarHeatmap.svelte`, `HourGrid.svelte`, `DurationList.svelte`, `src/lib/features/logins/WorldMap.svelte`, `src/lib/charts/ChartLegend.svelte` — consumers of `--ramp-*`.
- `src/lib/shell/DashboardSection.svelte` — the pane title (26px Display, 18px on phone).
- `AGENTS.md` — dependency minimalism (no new runtime dependency; no SCSS), privacy and zero-network constraints.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `--ov-*` and `--heat-*` declarations in `app.css`: the starting point for the shared token file.
- `tests/unit/charts/contrast.test.ts` and the `contrastRatio` helper: extend rather than add a parallel contrast check.

### Established Patterns
- Guards read raw source with comment-stripped regexes, which is why SCSS was rejected and why nested rules must keep one declaration per line.
- Tokens are declared once in `:root` with a contract comment and a test that recomputes the recorded ratios.
- 58 Svelte components all use scoped `<style>` blocks; largest style blocks are `PlayerStats` (356 lines), `OverviewTile` (340), `VehicleTable` (268).

### Integration Points
- Entry import of the new `src/styles/*.css` files.
- Every `.svelte` style block (58 files) for the removal of local duplicates and raw values.

</code_context>

<specifics>
## Specific Ideas

- Motivation (user): "if we need to change some style thing we need to change a lot of places"; the goal is one-line edits through tokens and shared classes.
- SCSS/Sass was considered and rejected; the user later asked for Svelte-official guidance, which supports plain global CSS imported at the entry plus scoped component styles.

</specifics>

<deferred>
## Deferred Ideas

- Dark mode and theming beyond tokens.
- Committed pixel-baseline screenshot tests in CI (brittle across OS fonts; reconsider later).
- Svelte wrapper components for text roles (`<Caption>`): rejected for now.

### Open items for the planner (surfaced, not resolved here)
- D-04 (snap 6px) vs D-15 (Overview pixel-identical): resolved by exempting the Overview from the snap; the planner must confirm how many off-scale values the Overview actually has.
- D-12 moves titles from 26 to 32 although the roadmap said layouts are not meant to change; allowed under the small-nudge boundary, but verify no title wraps or overflows at 375px and 900px. (The Overview is the one pane that compensates the taller title row, D-16.)
- D-05 (nesting required) interacts with D-03 regexes; confirm guards before the first migration plan.

</deferred>

---

*Phase: 14-Design unification*
*Context gathered: 2026-10-25*
