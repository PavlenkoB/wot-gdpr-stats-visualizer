---
phase: 14-design-unification
reviewed: 2026-10-28T00:00:00Z
depth: standard
files_reviewed: 97
files_reviewed_list:
  - .claude/skills/sketch-findings-wot-gdpr-stats-visualizer/SKILL.md
  - .claude/skills/sketch-findings-wot-gdpr-stats-visualizer/references/layout-and-navigation.md
  - .claude/skills/sketch-findings-wot-gdpr-stats-visualizer/references/visual-language.md
  - .claude/skills/sketch-findings-wot-gdpr-stats-visualizer/sources/themes/default.css
  - src/App.svelte
  - src/app.css
  - src/lib/charts/AboutDisclosure.svelte
  - src/lib/charts/ChartLegend.svelte
  - src/lib/charts/ChartTooltip.svelte
  - src/lib/charts/FlowLegend.svelte
  - src/lib/charts/MonthlyBarChart.svelte
  - src/lib/charts/MonthlyDataTable.svelte
  - src/lib/features/account-timeline/AccountTimelinePane.svelte
  - src/lib/features/account-timeline/TimelineKindFilter.svelte
  - src/lib/features/account-timeline/TimelineTable.svelte
  - src/lib/features/device-info/DeviceInfo.svelte
  - src/lib/features/device-info/DeviceTable.svelte
  - src/lib/features/finance/CurrencyBlock.svelte
  - src/lib/features/finance/FinancialData.svelte
  - src/lib/features/finance/PremiumBlock.svelte
  - src/lib/features/finance/SpendSummary.svelte
  - src/lib/features/logins/CityList.svelte
  - src/lib/features/logins/CityOptIn.svelte
  - src/lib/features/logins/CountryList.svelte
  - src/lib/features/logins/LoginHistory.svelte
  - src/lib/features/logins/LoginMapSection.svelte
  - src/lib/features/logins/LoginSummary.svelte
  - src/lib/features/logins/LoginTable.svelte
  - src/lib/features/logins/WorldMap.svelte
  - src/lib/features/new-data/HeatPane.svelte
  - src/lib/features/new-data/NewDataCard.svelte
  - src/lib/features/new-data/NewDataTable.svelte
  - src/lib/features/new-data/PerksPane.svelte
  - src/lib/features/new-data/WarshipsStoragePane.svelte
  - src/lib/features/overview/OverviewBars.svelte
  - src/lib/features/overview/OverviewBento.svelte
  - src/lib/features/overview/OverviewGroup.svelte
  - src/lib/features/overview/OverviewRows.svelte
  - src/lib/features/overview/OverviewTile.svelte
  - src/lib/features/playtime/CalendarHeatmap.svelte
  - src/lib/features/playtime/DurationList.svelte
  - src/lib/features/playtime/HourGrid.svelte
  - src/lib/features/playtime/Playtime.svelte
  - src/lib/features/playtime/PlaytimeCharts.svelte
  - src/lib/features/playtime/PlaytimeSummary.svelte
  - src/lib/features/vehicles/BattleTypeSummary.svelte
  - src/lib/features/vehicles/PlayerStats.svelte
  - src/lib/features/vehicles/VehicleTable.svelte
  - src/lib/shell/AccountTag.svelte
  - src/lib/shell/ConfirmPanel.svelte
  - src/lib/shell/Dashboard.svelte
  - src/lib/shell/DashboardSection.svelte
  - src/lib/shell/DetailPane.svelte
  - src/lib/shell/Dropzone.svelte
  - src/lib/shell/ExcludedNotice.svelte
  - src/lib/shell/FailureBanner.svelte
  - src/lib/shell/GameFilter.svelte
  - src/lib/shell/IdentityHeader.svelte
  - src/lib/shell/ImportBar.svelte
  - src/lib/shell/ImportSummary.svelte
  - src/lib/shell/ListPane.svelte
  - src/lib/shell/Overview.svelte
  - src/lib/shell/UnsupportedBlock.svelte
  - src/lib/ui-copy.ts
  - src/main.ts
  - src/styles/tokens.css
  - src/styles/type.css
  - src/styles/utilities.css
  - tests/e2e/playtime/playtime-ui-review.spec.ts
  - tests/e2e/shell/master-detail-nav.spec.ts
  - tests/helpers/color.ts
  - tests/helpers/components.ts
  - tests/helpers/css.ts
  - tests/helpers/styles.ts
  - tests/helpers/token-guards.ts
  - tests/unit/account-timeline/timeline-pane.test.ts
  - tests/unit/charts/about-disclosure.test.ts
  - tests/unit/charts/bar-chart-components.test.ts
  - tests/unit/charts/color-helper.test.ts
  - tests/unit/charts/contrast.test.ts
  - tests/unit/device-info/device-info-blocks.test.ts
  - tests/unit/finance/currency-blocks.test.ts
  - tests/unit/guards/css-helper.test.ts
  - tests/unit/guards/design-tokens-guards.test.ts
  - tests/unit/guards/nesting-guard.test.ts
  - tests/unit/guards/phase5-layout-guards.test.ts
  - tests/unit/guards/phase7-layout-guards.test.ts
  - tests/unit/guards/phase8-shell-guards.test.ts
  - tests/unit/guards/phase8-ui-review-guards.test.ts
  - tests/unit/logins/map-model.test.ts
  - tests/unit/new-data/new-data-blocks.test.ts
  - tests/unit/new-data/new-data-panes.test.ts
  - tests/unit/overview/overview-components-guard.test.ts
  - tests/unit/overview/overview-heat.test.ts
  - tests/unit/playtime/playtime-charts.test.ts
  - tests/unit/shell/identity-model.test.ts
  - tests/unit/shell/overview-title.test.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-10-28
**Depth:** standard
**Files Reviewed:** 97
**Status:** issues_found

## Summary

Phase 14 is a restyle, and the restyle is in good shape. I looked for the failures a pixel set cannot show and found none that break behaviour.

How I checked, so the clean result carries weight:

- **Nesting equivalence.** I compiled the pre-phase and current version of all 58 changed Svelte files with the project's own Svelte compiler. I flattened the nesting with the repo's lightningcss and compared every (selector, property) pair, with the scope hash normalised. Nesting added no specificity change and no property lost its declaration, apart from the intended role and shared-class moves. No declaration follows a nested rule inside its parent. No nested parent is a selector list. Every nested selector uses `&`.
- **Deleted local classes.** I extracted every deleted `.body`, `.caption`, `.error`, `.visually-hidden` and `.scroller` block from the baseline and compared it with its shared replacement and the surviving hook class. Every difference is carried by a hook (`.table-scroll`, `.list-scroll`, `.under-title`, `.identity-caption`, `.about-summary`, `.search-hint`). `DeviceTable` keeps `isolation: auto` deliberately. The old `.count` rule in `LoginHistory` was dead before the phase, because `.caption` followed it at equal specificity and won, so deleting it changes nothing.
- **Shared class beaten by a scoped element rule.** I scanned every component that applies a shared class and found no scoped type selector that overrides it. The one apparent hit, `PlaytimeSummary dd`, sets no font property.
- **States.** I compared the counts of hover, focus, disabled, outline, forced-colors and reduced-motion rules per file, before and after. The only drops are the five `.scroller` focus rings that moved into `utilities.css`. Every consumer carries `class="scroller ..."` plus `tabindex="0"` and `role="region"`.
- **Tokens.** Every `var(--x)` in `src/` resolves to a declared token. The only undeclared names are the JS-set `--span2`, `--span4`, `--rows4` and `--peak-at`. The contrast pairs I recomputed for the new status tokens all pass (`--warn-ink` on `--warn-bg` 5.53:1, `--danger-ink` on `--danger-bg` 7.89:1, `--danger-ink` on `--danger-bg-strong` 6.74:1).
- **`<script>` logic.** No script logic changed. The non-style diff is class attributes, comments and the three CSS imports in `main.ts`. The imports come before `app.css`, so the cascade order is preserved.

One user-visible regression is not covered by the recorded pixel evidence, and it is a consequence of an already-decided change (the title role at 26px in the phone bar). Three smaller items concern guards that cannot see what they claim to enforce. Details follow.

## Warnings

### WR-01: The phone-bar title is truncated for the longest pane title after the 18px to 26px change

**File:** `src/app.css:325-334`, `src/lib/shell/DetailPane.svelte:92`

**Issue:** The phone-bar title now takes `.t-title` (26px), where it was 18px. The bar keeps `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. The in-content heading is clipped away at phone width, and the bar span is `aria-hidden`. So the bar is the only place a sighted user reads the pane name, and for one pane it no longer fits.

I measured this in headless Chromium with the real `tokens.css`, `type.css`, `utilities.css` and `app.css`, and the real phone-bar markup, over all 13 `PANE_TITLES` (a harness page, not the full app):

| Viewport | At 26px (current) | At 18px (baseline) |
|---|---|---|
| 375px | "Warships crews & storage" truncated (scrollWidth 306 > clientWidth 276) | none truncated |
| 320px | "Warships crews & storage" truncated (306 > 221) | none truncated |

The 14-UI-SPEC overflow row (line 375) accepts ellipsis only as "the last resort" and says verification "records any ellipsis that appears". The recorded UAT list names only "Not yet supported" and "Login history", and no ellipsis is recorded. The WoWS pane title is therefore silently cut to "Warships crews & st...", with no `title` attribute and no other visible full name.

**Fix:** Either record it as an accepted outcome in the UAT list, or let the bar's title wrap instead of clipping. For example, replace `height: 48px` with `min-height: 48px`, and give `.phone-title` `white-space: normal` plus `overflow-wrap: anywhere` (the role already sets this), so a long title takes two lines instead of an ellipsis. A smaller option is to shorten the `PANE_TITLES['warships-storage']` copy for the bar.

### WR-02: "Defined once" for the clip pattern holds only by name; 17 copies of the visually-hidden block remain and the guard cannot see them

**File:** `src/lib/charts/MonthlyDataTable.svelte:51-62` (and 15 other files, see below), `tests/helpers/token-guards.ts:301-320`, `tests/helpers/token-guards.ts:277-279`

**Issue:** The phase's rule (D-02, utilities.css header) is that a shared declaration block is defined once, because a scoped copy outranks the global one and the two drift apart. The G5 guard enforces that by class name only (`SHARED_CLASS_NAMES`). The same clip block (`position: absolute; clip: rect(...); margin: -1px ...`) still exists under other names in `MonthlyDataTable` (`.sr-only`, which the comment openly says is kept local because of its name), `Playtime`, `LoginHistory`, `HeatPane`, `PerksPane`, `WarshipsStoragePane`, `PlayerStats` (two), `SpendSummary` (`.status.hidden`), `LoginSummary`, `VehicleTable`, `Dashboard`, `Dropzone`, `ListPane` (`.skip`), `OverviewTile` (`.sr`), `App.svelte` and `app.css`. Most of these are literally the shared block. The G3 `-1px` exemption ("a rule that declares `clip`") then lets every one of them through.

This is the exact drift risk the phase set out to remove. If the shared block is ever fixed or changed, 16 other copies silently keep the old behaviour. A comment that says "a clip block under any other name stays local (D-02)" reads the rule backwards.

**Fix:** For the elements that are only ever hidden (`MonthlyDataTable` caption, the `.status.hidden` lines, `LoginSummary .hidden`), add `class="visually-hidden"` and delete the local block. Then extend G5 to flag any rule outside `src/styles/` whose declarations include `clip: rect(`. The legitimate focus-reveal cases (`.skip`, the dropzone input) can then be listed explicitly with a reason instead of being exempt by name.

### WR-03: `overview-title.test.ts` asserts arithmetic on its own constants rather than the compiled behaviour

**File:** `tests/unit/shell/overview-title.test.ts:193-201`, `tests/unit/shell/overview-title.test.ts:170-191`

**Issue:** The "below 900px the compensation is 0" test computes `(display - display) * lineHeight` and expects `toBeCloseTo(0)`. That expression is 0 for any inputs, so the test cannot fail. The "-7.8px at 900px and up" test recomputes `(display - stat) * lineHeight` from token values it reads itself, and never evaluates the `calc()` that `Overview.svelte` declares. The only real assertion is the string equality of the margin declaration (line 160). The 14-OVERVIEW-PIXEL-EVIDENCE run covers the rendered result once, but nothing in the suite fails if `--fs-title`, the 900px query and the margin expression drift apart.

**Fix:** Replace the two arithmetic tests with an e2e computed-style check (`getComputedStyle(title).marginBottom` is `-7.8px` at 1280 and `0px` at 800 on the Overview). If it has to stay a unit test, evaluate the `calc()` expression found in the stylesheet against the token map at each width, instead of re-deriving the expected number from the same tokens.

### WR-04: The token guards have blind spots that the "no colour literal / no unknown token" claim depends on

**File:** `tests/helpers/token-guards.ts:138-141`, `tests/helpers/token-guards.ts:287-299`, `tests/helpers/css.ts:52-57`

**Issue:** Three gaps, none currently exploited by `src/`:

1. **G4** matches only hex and `rgb[a]()` / `hsl[a]()`. A named colour (`color: white`), `oklch()`, `lab()`, `lch()`, `hwb()` or `color(srgb ...)` passes. The test even documents `color-mix(in srgb, red, blue)` as accepted. The grep I ran found only `transparent`, which is fine. The guard's stated contract is "no colour literal outside tokens.css".
2. **Nothing checks that a `var(--x)` resolves.** G1 and G3 check the name only for `--fs-*` and `--space-*`. A typo such as `color: var(--mutted)` is a valid declaration that computes to the inherited colour, and no guard or test would fail.
3. **`stripCssComments` runs over the whole Svelte/TS source** in `colourOffenders` and `styleAttributeOffenders`, not only the style block. A string such as a glob `'src/**/*.svelte'` contains `/*`, which opens a "comment" that runs to the next `*/` anywhere later in the file, and hides everything between from the colour and inline-`style=` scans.

**Fix:** Add a guard that every `var(--name)` in `src/` is declared in `tokens.css` or is on an explicit JS-set list (`--span2`, `--span4`, `--rows4`, `--peak-at`). Make G4 also reject a bare named colour and the modern colour functions. Scan `colourOffenders` over `cssOf(entry)` plus the markup attribute values, not the raw file text, or strip comments with a string-aware scanner.

## Info

### IN-01: Stale comments (one new, plus the four already listed)

**File:** `src/app.css:358`, `src/styles/tokens.css:15-16`

**Issue:** `app.css:358` still says the tile numeral "drops from 30px to 18px". The desktop numeral is now 26px, and the 30px size no longer exists (D-08). `tokens.css:15-16` says the two guards "arrive in this phase" in the future tense, although both exist. The four already-listed stale comments (`tests/helpers/components.ts:63`, `tests/e2e/_support/helpers.ts:541`, `tests/e2e/shell/master-detail-nav.spec.ts:72`, `src/lib/features/logins/map-model.ts:36`) remain.

**Fix:** Change `app.css:358` to "from 26px to 18px" and the `tokens.css` sentence to the present tense.

### IN-02: A new comment in `CityOptIn.svelte` states a specificity fact that is false

**File:** `src/lib/features/logins/CityOptIn.svelte:332-338`

**Issue:** The comment says the bar inside the row "has the SAME specificity as the bare `progress` rule, so the one that comes last is the one that wins", and that the rule "comes AFTER the `progress` rule on purpose". I compiled the file: the bare rule is `progress.svelte-x` (0,1,1) and the nested one is `.bar-row.svelte-x progress:where(.svelte-x)` (0,2,1). The nested rule wins on specificity whatever the order, so the stated reason for the order is wrong and would mislead a later reader into keeping an order that does not matter.

**Fix:** Drop the "SAME specificity / comes AFTER" explanation. Say that the `.bar-row progress` compound outranks the bare rule.

### IN-03: Dead CSS: `.btn`, `.t-body-strong` and the `numeral` hook

**File:** `src/styles/utilities.css:92-110`, `src/styles/type.css:61-66`, `src/lib/features/overview/OverviewTile.svelte:150`

**Issue:** `.btn` is applied nowhere (its own comment says so). `.t-body-strong` is applied nowhere in `src/`. It is kept only because the role guard requires exactly nine roles. `class:numeral` on the tile numeral has no rule left behind it (`.v.numeral` was removed when `t-hero` took over) and nothing in `src` or `tests` selects it.

**Fix:** Remove `class:numeral` from the tile markup. Decide whether the `.btn` and `.t-body-strong` stubs ship or wait for their first consumer. If they stay, note in `ROLE_NAMES` that a role may be unused.

### IN-04: `OverviewTile` hard-codes the label line height that the token layer owns

**File:** `src/lib/features/overview/OverviewTile.svelte` (`.met .k { min-height: calc(2 * 1.4em) }`)

**Issue:** The two-line reservation uses the literal `1.4`, which is `--lh-tight`, the line height `.t-label` gives `.k`. If the token ever moves, the reserved height and the real two-line height diverge and the figures in a row stop aligning. This is a leftover raw value that the guards do not look at, since G3 covers spacing properties only.

**Fix:** `min-height: calc(2 * var(--lh-tight) * 1em);`

### IN-05: Adjacent heat steps sit 1.13 to 1.17 apart in contrast

**File:** `src/styles/tokens.css` (`--heat-1` to `--heat-5`), `tests/unit/charts/contrast.test.ts:1295`

**Issue:** The floor between adjacent data steps was lowered from 1.25:1 to 1.1:1 (OI-4). I computed the shipped steps: 1 to 2 is 1.139, 2 to 3 is 1.126, 3 to 4 is 1.171 and 4 to 5 is 1.143, so a level is hard to tell from its neighbour by lightness alone. This was a recorded decision and every surface also states the value in text, so it is not a defect. I list it because the floor was lowered to match the data rather than the other way round.

**Fix:** None required. If it is revisited, the cheapest lever is widening the lightness gap between `--heat-low` and `--heat-mid`, which moves both derived steps.

---

_Reviewed: 2026-10-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
