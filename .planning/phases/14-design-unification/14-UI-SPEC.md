---
phase: "14"
slug: "design-unification"
status: approved
shadcn_initialized: false
preset: none
created: "2026-10-25"
---

# Phase 14 - UI Design Contract

> Visual and interaction contract for the app-wide design system. The Overview's type scale, heat scale and colour tokens become the system every pane uses. Shared styling moves into `src/styles/`, and the `--ramp-*` scale is replaced by `--heat-*` on the calendar heatmap, hour grid, duration list, login world map and chart legend. Locked inputs: `14-CONTEXT.md` (D-01 to D-15), `13-UI-SPEC.md` (the Overview contract this phase generalises) and the Day 10 section of `sketch-findings-wot-gdpr-stats-visualizer` (treated as locked). Nothing here asks the user a question. Where those sources disagree, "Resolved Conflicts" records the value this contract uses. Figures marked *measured* were counted in the working tree on 2026-10-25. Contrast ratios were computed with WCAG relative luminance.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable (Svelte 5 project, no shadcn) |
| Component library | none (hand-rolled Svelte 5 components with scoped `<style>` blocks) |
| Icon library | none (the only glyphs are inline SVG: the pin star and the list chevron) |
| Font | system-ui stack, unchanged (`:root` in `src/app.css`) |

**Registry and dependencies:** no third-party registry, no new npm package, no runtime dependency, no SCSS or Sass. Native CSS nesting, custom properties and Svelte scoping cover the need (rejected alternative in CONTEXT). The Component Inventory section is omitted because `Tool: none`.

---

## Baseline (measured)

- **Raw font sizes.** 209 declarations in `.svelte` files: 188 at 14px, 11 at 12px (all in `features/overview/`), 4 at 26px, 2 at 30px, 2 at 18px, one each at 32px and 56px. Ten more in `src/app.css`: 7 at 18px, 3 at 14px. No `font-size` uses a `var()`.
- **Font weights.** Only 400 (93 declarations) and 600 (103). Two weights already; nothing to add.
- **Line heights.** 1.4 (135), 1.5 (48), 1.3 (8), 1.2 (3), 1.1 (1), plus four `line-height: 18px` in table cells.
- **Spacing px outside the scale.** 6px appears in 47 matches. 44 are `border-radius`, 2 are comments and 1 is a spacing value (`gap: 6px`, `PlayerStats.svelte:1402`). Other off-scale spacing values: 20px (10 sites), 32px (2), 40px (1), 48px (2), 64px (1). All are shell or page gutters.
- **Hex literals.** 72 in 22 `.svelte` files, 8 distinct values: `#c5221f` (15), `#8a1c17` (15), `#fce8e6` (15), `#ffffff` (12), `#fef7e0` (5), `#f9ab00` (5), `#8a5a00` (4), `#f5d4d1` (1). Three files also use `rgba()` or `hsl()`.
- **Ramp consumers.** `--ramp-0..5` is read by `CalendarHeatmap`, `HourGrid`, `DurationList`, `WorldMap` and `ChartLegend`. It is asserted by `tests/unit/charts/contrast.test.ts` and four other unit tests.
- **Shared class names redefined locally.** `.caption` in 23 files, `.body` in 17 files (18 selectors), `.error` in 12 files (13 selectors), `.scroller` in 10, `.visually-hidden` in 8. The `.caption` definitions read in this scan are 14px muted text. None is 12px.
- **Native nesting.** No `.svelte` style block uses it today. Every touched block changes form (D-05).
- **Svelte.** 5.57.1 installed.

---

## Resolved Conflicts

Each row states the value this contract uses and why. The planner follows this table where the sources differ.

| Topic | Source says | This contract uses | Basis |
|-------|-------------|--------------------|-------|
| Heat levels | D-11: "six rank levels", and the contrast test asserts each of the six steps is at least 3:1 on white | Five data levels (`--heat-1` to `--heat-5`), each at least 3:1 on white, plus `--heat-empty` for zero cells. Zero cells are not data, so the floor does not apply to them | `levelOf` returns 0 for no data and 1 to 5 for non-zero values (`playtime-model.ts:297`). Six data levels would change the quantisation and the playtime and map logic. The empty grey already measures 1.14:1 |
| Adjacent-step separation | `contrast.test.ts:206` asserts at least 1.25:1 between adjacent steps | At least 1.1:1 between adjacent data steps (measured minimum 1.12:1), plus strict monotonic lightness (OI-4) | Five steps must fit between 3.11:1 (the lightest step) and 5.33:1 (the peak stop, fixed by D-15). A 1.25:1 chain would need a peak of about 7.6:1 |
| Pane title size | D-12: 32px on desktop, 26px below 900px | As D-12 | Locked |
| Overview title | D-15: the Overview is pixel-identical. D-12: pane titles move to 32px | The Overview's own `.section-title` (26px, hidden at phone width) takes the title role and moves to 32px at 900px and up. The Overview compensates its line box (D-16, owner-confirmed 2026-10-25): its title block keeps today's row height, so content below the title keeps its position and every Overview element keeps its size. Only the title's own box differs (OI-1) | D-13 already expects "the 32px titles change pixels on purpose"; the owner chose to compensate rather than let the whole Overview shift by about 8px |
| Phone pane title | D-12: "below 900px they drop to 26, not 18" | On a phone the visible pane title is the detail bar's `.phone-title`, which is 18px today. It takes the title role, so it is 26px at 480px and below as well (OI-2) | The in-content title is visually hidden at 480px and below (phone block in `app.css`) |
| Identity nickname | Not named in D-12 | Treated as the title role (32px at 900px and up, 26px below), because `app.css` already calls the nickname the dashboard's visual title (OI-3) | `IdentityHeader.svelte:269` is 26px today |
| Radius 6px | D-04: the 6px values (45 uses) snap to 4 or 8 | Radii are not spacing. The 44 `border-radius: 6px` sites keep 6px as `--radius-sm`. Only `gap: 6px` (one site) snaps to 4px (Spacing Scale) | Measured: 44 of the 47 matches are radii |
| Off-scale layout values | D-04: scale is 4 / 8 / 12 / 16 / 24 | Scale tokens are for component spacing only. Shell and page gutters (20, 32, 40, 48, 64 px) keep their pixels and move to named `--layout-*` tokens (OI-7) | D-15 keeps the Overview's own 32px. The 20px gutter is used in six components |
| Where shared CSS lives | D-02: `app.css` keeps only element resets | `app.css` keeps the element resets, the shell layout and the single phone block, because the phase-8 guard reads the phone block there. Tokens, roles and utilities move to `src/styles/`. The planner may move the layout too if that guard is updated. This deviates from D-02 as written and needs owner confirmation (OI-11) | Keeps the phone-block guard stable |
| Type size count | Checker Dimension 4: at most four font sizes | Six sizes (12, 14, 18, 26, 32, 56 px) under D-06 | Owner waiver, dated 2026-10-25. The Overview needs 12, 32 and 56. The other panes need 18 and 26. D-15 keeps the Overview pixel-identical. The scale is not changed |
| Type name "Display" | 13-UI-SPEC: "Display" is 32px | In the new system `display` is 26px (`--fs-display`, D-06). The 13-UI-SPEC "Display 32" is `--fs-stat`, and its "Hero numeral 56" is `--fs-hero` | D-06 is the locked name |
| "Caption" collision | 13-UI-SPEC "Caption" is 12px. Local `.caption` classes are 14px | `.t-caption` is 12px. A local `.caption` at 14px becomes `.t-body` and keeps its colour. The 12px sites are all in the Overview (11 of 11) | Every visible size stays where it is |
| Dangling decision IDs | D-09 cites "D-24" and the domain section cites "D-27" | Neither ID exists in `14-CONTEXT.md`. This contract reads "D-24" as D-15 (the Overview adopts the shared tokens) and "D-27" as the layout-nudge allowance under D-04. The CONTEXT file should be corrected before planning (OI-9) | Dangling references |

---

## Token Architecture (D-01 to D-03)

| File | Holds | Rule |
|------|-------|------|
| `src/styles/tokens.css` | Every `:root` custom property: colours, heat scale, spacing, radii, the `--fs-*` sizes, the `--fs-title` switch, the font weights | The only file that may hold a hex value, a px font size or a px spacing value |
| `src/styles/type.css` | The `.t-*` role classes | Sets font-size, font-weight and line-height (plus uppercase and tracking on `.t-label`). Never colour, margin, display or position |
| `src/styles/utilities.css` | `.visually-hidden`, `.scroller`, `.error`, `.btn` | Each defined once. No component redefines them |
| `src/app.css` | Element resets (`body`, the `button`/`input`/`select`/`textarea` font, `h1`/`h2`, `p`, `ul`, `a`), the shell layout, the single 480px phone block | No token, role or utility definitions |

Import once, from the app entry, in this order: `tokens.css`, `type.css`, `utilities.css`, `app.css`.

---

## Spacing Scale

**Component spacing (D-04).** Every component padding, margin and gap uses one of these values:

| Token | Value | Use |
|-------|-------|-----|
| `--space-4` | 4px | Icon and inline gaps, value-to-unit gap |
| `--space-8` | 8px | Compact element spacing, label to value, heading to grid |
| `--space-12` | 12px | Row gaps in dense lists |
| `--space-16` | 16px | Default element spacing, tile padding, tile gap |
| `--space-24` | 24px | Group and section spacing |

Component CSS may use only these five values, plus `0`, `auto`, `calc()` and `var(--layout-*)`. The `--nav-offset: 16px` declaration in `:root` becomes `var(--space-16)`, value unchanged.

**Declared layout values (not scale members; pixels kept, OI-7):**

| Value | Measured sites | Token family | Use |
|-------|----------------|--------------|-----|
| 20px | 10: four `ListPane` gutters, `IdentityHeader`, `ImportBar`, `Dropzone`, `DashboardSection`, `PremiumBlock` left padding, the list indent in `app.css` | `--layout-gutter` | Horizontal gutters |
| 32px | 2: `.pane-detail` top padding (`app.css`), and the Overview's own 32px gap before the attribution footer | `--layout-section` | Section top, Overview footer gap |
| 40px | 1: `.pane-detail` side padding | `--layout-page-x` | Detail pane side gutter |
| 48px | 2: `App.svelte` main top padding, phone detail bottom padding | `--layout-page-y` | Page top and phone bottom |
| 64px | 1: `.pane-detail` bottom padding | `--layout-page-bottom` | Detail pane bottom |

The planner chooses the final `--layout-*` names. Each keeps its pixel value.

**The one 6px spacing site.** `src/lib/features/vehicles/PlayerStats.svelte:1402` (the `.toggle` rule) sets `gap: 6px` between a native checkbox and its label. It becomes `var(--space-4)` (4px). This contract names 4px so the executor does not choose. The reason is that the token table gives `--space-4` to icon and inline gaps, and a checkbox-to-label gap is one. The screenshot review (D-13) confirms the value and does not reopen it.

**Overview spacing (D-15).** Every Overview spacing value is already on the scale (4, 8, 12, 16, 24) except its one 32px footer gap, which maps to `--layout-section`. The Overview has no 6px value. Its pixels do not change.

**Non-spacing sizes.** These are not spacing and are never used for padding, margin or gap: 44px hit areas (touch floor and tile star), 1px, 1.5px and 3px borders, strokes and focus rings, and the 18px inline SVG glyph size.

---

## Typography

**Owner waiver, dated 2026-10-25: the four-size limit is waived for this phase.** The checker's Dimension 4 allows at most four font sizes. This contract declares six (12, 14, 18, 26, 32 and 56 px). The owner ruled to keep D-06 as locked. Reason: the Overview needs 12, 32 and 56 px, the other panes need 18 and 26 px, and the Overview must stay pixel-identical (D-15). The waiver does not change the scale. The two-weight limit still applies and is met (400 and 600).

**Size tokens (D-06).**

| Token | Size | Role |
|-------|------|------|
| `--fs-caption` | 12px | Caption; the floor for any text in the app |
| `--fs-body` | 14px | Body; the page default (`:root`) and the `button`/`input`/`select`/`textarea` reset |
| `--fs-heading` | 18px | Heading; `h1`/`h2`, phone-width summaries |
| `--fs-display` | 26px | Display; tile numerals and figures |
| `--fs-stat` | 32px | Stat; Overview tile values |
| `--fs-hero` | 56px | Hero; Overview hero numeral |
| `--fs-title` | derived | `var(--fs-stat)` at `min-width: 900px`; `var(--fs-display)` at `max-width: 899px`. The switch lives in `tokens.css` |

**Weights.** `--fw-regular` 400 and `--fw-semibold` 600. Only these two.

**Role classes (D-07).** A role sets size, weight and line-height. It never sets colour; colour comes from the context that uses it.

| Class | Size | Weight | Line height | Other | Used for |
|-------|------|--------|-------------|-------|----------|
| `.t-hero` | 56 (`--fs-hero`) | 600 | 1.1 | none | Overview hero numeral |
| `.t-stat` | 32 (`--fs-stat`) | 600 | 1.2 | none | Overview tile values |
| `.t-title` | `--fs-title` (32 at 900px and up, 26 below) | 600 | 1.3 | `overflow-wrap: anywhere` | Pane titles, identity nickname and its fallback, multi and skeleton titles, the phone detail-bar title |
| `.t-display` | 26 (`--fs-display`) | 600 | 1.3 | none | Tile numerals, figures |
| `.t-heading` | 18 (`--fs-heading`) | 600 | 1.3 | none | `h1`/`h2`, phone-width summaries, Overview phone headline, list chevron glyph |
| `.t-body` | 14 (`--fs-body`) | 400 | 1.5 | none | Default text, class and nation names, units, provenance and status lines |
| `.t-body-strong` | 14 | 600 | 1.5 | none | List-row titles, phone back button |
| `.t-caption` | 12 (`--fs-caption`) | 400 | 1.4 | none | Rule lines, axis labels, hint lines (Overview today) |
| `.t-label` | 12 | 600 | 1.4 | uppercase, letter-spacing 0.06em | Group headings, tile labels |

**Title role rules.**
- `.t-title` applies to the pane title (`section-title` in `DashboardSection` and in `Overview`), the identity header nickname and its variants, and the phone detail-bar `.phone-title`.
- The phone-width overrides that set titles to 18px are deleted. The title role does the switch.
- The Overview's in-content title stays visually hidden at 480px and below. The phone detail-bar title is the one visible title there.
- The Overview's `.section-title` adds one local declaration to the role, a bottom margin that cancels the taller line box (D-16, see Layout and Shell). The role itself is unchanged and no other pane carries the margin.

**Current size to role map (measured sites).**

| Current declaration | Sites | Role |
|---------------------|-------|------|
| 14px | 188 `.svelte` plus 3 in `app.css` | `.t-body` or `--fs-body`. Local `.caption` and `.body` at 14px map here |
| 12px | 11, all in `features/overview/` | `.t-caption` and `.t-label`. Overview values unchanged |
| 18px | 2 `.svelte` phone overrides plus 7 in `app.css` (phone block, `h1`/`h2`, chevron) | `.t-heading`. The phone title overrides are deleted (see title role rules) |
| 26px | 4 | `DashboardSection` and `Overview` titles, `IdentityHeader` nickname: `.t-title`. `SpendSummary.svelte:571`: `.t-display` (the planner confirms the element is a figure, not a title) |
| 30px | 2 (`PlaytimeSummary`, `LoginSummary` tile numerals) | `.t-display` (26px), per D-08. The phone override to 18px stays as heading |
| 32px | 1 (Overview tile value) | `.t-stat` |
| 56px | 1 (Overview hero) | `.t-hero` |

**Line heights** are owned by the role. The four `line-height: 18px` cells keep their pixels unless the planner converts them to a role.

**Tabular numerals** on the Overview root stay as the 13-UI-SPEC declares.

---

## Color

**60 / 30 / 10 split (unchanged):**

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--page` `#ffffff` | Detail pane, tile surfaces |
| Secondary (30%) | `--list` `#f5f5f5` | List pane, dashed "Not in this export" row, skeleton tiles |
| Accent (10%) | `--ink` `#111111` | See the reserved list below |
| Destructive | `--danger` `#c5221f` | Destructive-action text and outline only |

**Accent reserved for:** pane titles and the identity nickname; link text (underlined ink); the 3px selected list-row bar; the single filled primary button (`.btn.primary`, when present); Overview tile values and group headings. Nothing else takes the accent. Hover uses `--hover`. Focus uses `--focus`.

**Neutral tokens (values unchanged, now in `tokens.css`):** `--page #ffffff`, `--card #ffffff`, `--list #f5f5f5`, `--border #dcdcdc`, `--faint #8c8c8c` (decoration only, never text), `--ink #111111`, `--text #3a3a3a`, `--muted #5c5c5c`, `--sel #e0e0e0`, `--hover #ececec`, `--chip #ececec`, `--track #ececec`, `--focus #1a73e8`.

**Flow tokens (values unchanged):** `--flow-in #4c3fa6`, `--flow-out #a14a00`. Marks only, never text.

**Overview tokens (values unchanged):** `--ov-time #1f7a74`, `--ov-tanks #c26a1b`, `--ov-records #8f4a80`, `--ov-totals #3a6aa8`, `--ov-pinned #e0a020`, `--ov-star-fill #e0a020`, `--ov-star-stroke #a8710a`. The group dots carry identity only; the group name is the text meaning.

**Status tokens (replace the 72 literals; values unchanged):**

| Token | Value | Use | Contrast |
|-------|-------|-----|----------|
| `--danger` | `#c5221f` | Destructive text and outline | 5.80:1 on white |
| `--danger-ink` | `#8a1c17` | Error text | 9.30:1 on white; 7.89:1 on `--danger-bg` |
| `--danger-bg` | `#fce8e6` | Error surface | n/a (surface) |
| `--danger-bg-strong` | `#f5d4d1` | The one confirmation surface (`ConfirmPanel`) | n/a (surface) |
| `--warn-line` | `#f9ab00` | 1px warning border only | 1.93:1 on white; non-text, so the text carries the meaning (OI-8) |
| `--warn-bg` | `#fef7e0` | Warning surface | n/a (surface) |
| `--warn-ink` | `#8a5a00` | Warning text | 5.53:1 on `--warn-bg`; 5.93:1 on white |
| `--white` | `#ffffff` | The 12 white literals that are not page surfaces (dark tooltip text, the separator under the focus ring); the rest use `--page` | n/a |

The `.error` utility has one definition: body role, `--danger-ink` text, `--danger-bg` surface, `8px 12px` padding (the value most local copies share).

**Heat scale (D-10, D-11).** The Overview value scale (`--heat-low`, `--heat-mid`, `--heat-peak`) becomes the one value scale app-wide.

| Token | Value | Derivation | Ratio on white | Level |
|-------|-------|------------|----------------|-------|
| `--heat-empty` | `#eef0f2` | Neutral. The old `--ramp-0` value | 1.14:1 (not data, exempt) | 0 (no data) |
| `--heat-1` | `#47a374` | `--heat-low` stop | 3.11:1 | 1 |
| `--heat-2` | `color-mix(in srgb, var(--heat-low) 50%, var(--heat-mid))`, about rgb(89, 150.5, 68) | Derived | 3.56:1 | 2 |
| `--heat-3` | `#6b8a14` (`--heat-mid`) | Stop | 3.98:1 | 3 |
| `--heat-4` | `color-mix(in srgb, var(--heat-mid) 50%, var(--heat-peak))`, about rgb(123.5, 119, 10) | Derived | 4.67:1 | 4 |
| `--heat-5` | `#8c6400` (`--heat-peak`) | Stop | 5.33:1 | 5 |

Stops: `--heat-low #47a374`, `--heat-mid #6b8a14`, `--heat-peak #8c6400`. The Overview's channel-interpolated value scale reads the same stops, so both scales stay in step.

Rules:
- Level assignment is the existing `levelOf` (0 for zero, 1 to 5 by rank). No colour is interpolated from data. Each level is a discrete step.
- Derived levels sit inside `@supports (color: color-mix(in srgb, red, blue))`. Without support, `--heat-2` falls back to `var(--heat-low)` and `--heat-4` to `var(--heat-mid)`.
- **Accepted degradation without `color-mix()`.** Browsers without support (before Chrome 111, Safari 16.2 and Firefox 113) show the five data levels as three bands. Level 1 and level 2 render the same green, and level 3 and level 4 render the same olive. Level 5 and the empty grey are unaffected. The fallback is not a second set of hand-picked literals, because D-11 forbids hand-picked levels. The target is Chrome-first (AGENTS.md), so this is accepted and is not tested.
- Relative luminance falls strictly from the empty swatch to level 5: 0.869, 0.288, 0.245, 0.214, 0.175, 0.147.
- Adjacent data steps differ by 1.15, 1.12, 1.17 and 1.14 in luminance ratio. The steps also differ in hue (green, olive, gold), so they are not told apart by lightness alone.
- Level 0 keeps the grey `#eef0f2`. The world map's level 0 reads `--heat-empty` too.
- Heat cells sit on `--page`. No grey track sits under them.

**Consumer mapping.** Calendar cells map level N to `--heat-N`, with level 0 to `--heat-empty`. Hour grid bins and `ChartLegend` use the same levels. The world map uses the same five data levels plus empty. `DurationList` is a single-fill bar; its fill becomes `--heat-3` (the mid stop, 3.98:1 on white). The planner may choose another level if the screenshots show it reads better, provided it stays at or above 3:1.

**Hex sweep.** The 72 literals map to the status tokens above and to `--white` or `--page`. The three `rgba()`/`hsl()` files become token-based values. The phase-8 colour allow-list is deleted, because its reasons (`STATUS_REASON`, `WHITE_REASON`) are obsolete once the tokens exist.

---

## Layout and Shell

- Structure, DOM and breakpoints are unchanged: the 900px and 480px blocks in `app.css` stay where they are. The 899px title switch lives in `tokens.css`.
- Pane title: `.t-title` as specified above. The title row of every pane except the Overview grows by about 8px on desktop (32px against 26px at a 1.3 line height is 41.6px against 33.8px), which is the only layout change. The Overview compensates (D-16, owner-confirmed 2026-10-25): its `.section-title` declares a bottom margin of `calc((var(--fs-display) - var(--fs-title)) * var(--lh-heading))`, which is -7.8px at 900px and up and 0 below, so its title block keeps today's 33.8px row, content below the title keeps its position and element sizes are equal.
- Phone detail bar: 48px high. A 26px title with a 1.3 line height is 34px, so it fits.
- The phone detail-bar title keeps `nowrap` and ellipsis as the last resort for width. Verification records any ellipsis that appears.

---

## Visual Focal Points

Hierarchy in a pane is set by size and position only. The pane title (`.t-title`, 32px at 900px and up, 26px below) comes first for orientation. Each pane then has exactly one focal element: the first data element after the title, which carries the pane's meaning. This phase adds no new emphasis (colour, weight or motion) to a focal element. The Overview's anchor is set by 13-UI-SPEC and is restated here only so the table is complete.

| Pane | Focal element (one) | Supporting elements | Basis |
|------|---------------------|---------------------|-------|
| Overview | "Logged in" hero numeral (`.t-hero`, 56px). It is the first tile in DOM order and the top-left tile at 880px and up | Tile values (`.t-stat`, 32px), group headings | 13-UI-SPEC, Primary visual anchor |
| Playtime | `CalendarHeatmap` | `PlaytimeSummary` figures (`.t-display`, 26px), `HourGrid`, `DurationList` | Component structure |
| Login history | `WorldMap` in `LoginMapSection` | `LoginSummary` figures (26px), `CountryList`, `LoginTable` | Component structure |
| Vehicles | `VehicleTable` | `BattleTypeSummary` disclosure, `PlayerStats` header figures | Component structure |
| Finance | `SpendSummary` headline figure (`.t-display`, 26px) | `PremiumBlock` and `CurrencyBlock` charts, monthly table disclosure | Component structure |
| Payments | The first chart in `FinancialData` | The payment table | Component structure. Confirm in UAT that this is the payments pane |
| Device info | `DeviceTable` | None | Component structure |
| Account | Identity nickname (`IdentityHeader`, `.t-title`) | Account details | OI-3 |
| Heat, Perks, Warships and storage | `NewDataTable` | The pane's `NewDataCard` figures (`.t-display`, 26px) | Component structure |
| Account timeline | `TimelineTable` | `TimelineKindFilter` (a control, not a focal element) | Component structure |
| Not yet supported | None: the list of `UnsupportedBlock` banners | None | No data to focus |

Rules:
- A pane never has two focal elements. Where the table above names a chart and a table, the chart is the focal element and the table is supporting.
- The focal element is not given accent colour beyond the reserved list in Color.
- The table is declared from component structure and is checked in UAT, not pixel-measured. A change of focal element is a visible change and must be recorded in Allowed Visible Changes.

## Allowed Visible Changes

This list is complete. Any other pixel change is a regression.

1. The calendar heatmap, hour grid, duration bars, login world map and chart legend move from `--ramp-*` to `--heat-*`. Levels 1 to 5 change colour; level 0 keeps `#eef0f2`.
2. Pane titles, including the Overview title (OI-1): 26px to 32px at 900px and up; 26px below 900px. On a phone the detail-bar title goes from 18px to 26px (OI-2). The Overview title compensates its line box (D-16), so only its own glyph box changes there.
3. The identity nickname and its fallback, multi and skeleton titles: 26px to 32px at 900px and up; 18px to 26px below 900px (OI-3).
4. Two tile numerals (`PlaytimeSummary`, `LoginSummary`): 30px to 26px at desktop width (D-08).
5. One `gap: 6px` (`PlayerStats.svelte:1402`) to 4px (`var(--space-4)`, see Spacing Scale; D-04).
6. Title rows of the panes other than the Overview grow by the height of the taller title, about 8px on desktop. The Overview's title row does not: it compensates its line box (D-16, owner-confirmed 2026-10-25), so content below the Overview title keeps its position and every Overview element keeps its size. Nothing else reflows.

Everything else keeps its pixels: the status colours (tokenised, same values), the 44px touch floor, the focus ring, the Overview's values and spacing (except item 2), and every caption and body size.

---

## Interaction Contract

Unchanged. The focus ring stays `3px solid var(--focus)` with `outline-offset: -3px`. The 44px touch floor on `button`, `summary` and `a` at 480px and below stays as it is. Hover uses `--hover`. The Overview's keyboard, pointer, pin and expand behaviour is the 13-UI-SPEC contract and is not restated here. This phase adds no interaction, animation or transition.

---

## States

Unchanged. Empty, loading, error and partial states keep their copy and layout. The empty heat cell keeps `#eef0f2`. The only state-visible change is the title size in Allowed Visible Changes.

---

## Copywriting Contract

**No user-facing copy changes in this phase.** No new string, label or message is introduced, and `src/lib/ui-copy.ts` does not change. Copy proposed in 13-UI-SPEC is not affected.

**Drift check.** Each string below is quoted verbatim from the source named in its row. The executor compares every row before and after each migration plan. Any difference is a regression, not a style change.

| Element | Exact current copy | Source |
|---------|--------------------|--------|
| Primary CTA | None added. The existing "Start over" is unchanged | `START_OVER_LABEL` = `Start over` |
| Import idle prompt (dropzone) | Drop your Wargaming data export (.zip) here, or click to choose it. | `DROPZONE_PROMPT` |
| Empty: no session file (playtime) | This export has no session file, so there is no playtime to show. | `PLAYTIME_NO_SESSION_FILE` |
| Empty: no usable sessions (playtime) | No usable sessions were found in this export. | `PLAYTIME_NO_USABLE_SESSIONS` |
| Empty: premium | No premium operations with a recognisable duration were found in this export. | `PREMIUM_NO_USABLE` |
| Empty: virtual currency | No virtual-currency operations with a known type and a numeric amount were found in this export. | `CURRENCY_NO_USABLE` |
| Empty: vehicle search | No vehicles match your search. | `VEHICLE_NO_MATCH` |
| Greyed section, nothing loaded | Drop an export to see this section | `formatSectionStatus('not-loaded')` |
| Greyed section, not in export | Not in this export | `formatSectionStatus('no-export')`, `FINANCIAL_NOT_IN_EXPORT` |
| Greyed section, no rows | This export contains no rows for {folder} | `formatSectionStatus('empty', folder)` |
| Identity empty | No export loaded (title); Drop an export to see the account details (prompt) | `IDENTITY_SKELETON_TITLE`, `IDENTITY_SKELETON_PROMPT` |
| Overview empty (every tile absent) | None of these tiles has data in this export. Each group says what it needs. | `OVERVIEW_EMPTY` |
| Overview loading | Computing on this device. | `OVERVIEW_LOADING` |
| Overview hint | Click a tile to see how it is computed. Star a tile to pin it to the top. Arrow keys move between tiles, P pins the focused tile, Esc closes. | `OVERVIEW_HINT` |
| Overview absent row prefix | Not in this export: {tile names} · needs {source names} | `OVERVIEW_ABSENT_PREFIX` = `Not in this export:` |
| Overview Wargaming life label | Wargaming life | `OVERVIEW_LIFE_LABEL` |
| Overview attribution | Tank names, nations and classes: Wargaming.net API data. The final link and copyright wording stay pending the Terms of Use checkpoint (13-UI-SPEC, D-07, D-23) | `OVERVIEW_ATTRIBUTION_TEXT` |
| Error: import failure | This doesn't look like a Wargaming data export. Drop the .zip file you received from Wargaming's GDPR export request. Import failures only | `GENERIC_FAILURE_MESSAGE` |
| Error: playtime | Playtime could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry. | `PLAYTIME_ERROR` |
| Error: vehicle statistics | Vehicle statistics could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry. | `PLAYER_STATS_ERROR` |
| Error: financial data | Financial data could not be calculated from this export. Your imported data is unchanged. Drop the export again to retry. | `FINANCIAL_ERROR` |
| Error: Overview | The overview could not be worked out from this export. Your data is still loaded. Open another section and come back to try again. | `OVERVIEW_ERROR` |
| Confirm: replace on drop | Body: Replace your current dataset with this new import? Commit: Replace dataset. Dismiss: Keep current data | `CONFIRM_REPLACE_MESSAGE`, `REPLACE_DATASET_LABEL`, `KEEP_CURRENT_DATA_LABEL` |
| Confirm: clear cached data | Body: This will permanently delete your cached export data. You'll need to re-upload the zip to view it again. Commit: Delete cached data. Dismiss: Keep cached data | `CONFIRM_CLEAR_MESSAGE`, `DELETE_CACHED_DATA_LABEL`, `KEEP_CACHED_DATA_LABEL` |
| Cleared acknowledgment | Cached data cleared | `CLEARED_ACK_MESSAGE` |

**Destructive actions in this phase.** "Start over" (`START_OVER_LABEL`) and "Clear my cached data" (`CLEAR_DATA_LABEL`) both open the clear-data ConfirmPanel with the same copy, as D-21 and D-22 already require. No other destructive action exists or is added.

---

## Guards (D-03, D-02, D-05)

Each guard reads raw source text, comment-stripped, one declaration per line. Each replaces an existing per-folder exemption or allow-list entry.

| Guard | Rule | Replaces |
|-------|------|----------|
| G1 font-size | Every `font-size` in `src/**/*.{svelte,css}` outside `tokens.css` and `type.css` is a `var(--fs-*)`, the `--fs-title` switch, or set by a `.t-*` role. No px or em values | `SCALE_PX` and `OVERVIEW_SCALE_PX` in `tests/helpers/components.ts`; the `features/overview/` exemption in `phase8-ui-review-guards` and `phase5-layout-guards` |
| G2 font floor | Every resolved `--fs-*` is at least 12px | The 14px floor and the 12px Overview floor exemption in `phase5-layout-guards` |
| G3 spacing | `padding*`, `margin*`, `gap`, `row-gap` and `column-gap` use only `0`, `auto`, `calc()`, `var(--space-N)` (N in 4, 8, 12, 16, 24) or `var(--layout-*)` | Raw px spacing (not guarded today) |
| G4 colour | No hex, `rgb()`, `rgba()` or `hsl()` in `.svelte` files or in any `src/styles/` file except `tokens.css` | `ALLOWED_COLOUR_LITERALS` in `phase8-ui-review-guards`: all entries removed |
| G5 shared names | The shared classes (`.t-*`, `.visually-hidden`, `.scroller`, `.error`, `.btn`) are defined only in `src/styles/`. A `.svelte` or `app.css` definition of one fails | The local `.caption`, `.body`, `.error`, `.scroller` and `.visually-hidden` definitions, which are deleted, not shadowed (a scoped selector outranks a global one) |
| G6 nesting | Every declaration sits on its own line, so nested rules keep the shape the regexes read | The flat-only assumption in the existing regexes |
| G7 breakpoints | Phone width is one `@media (max-width: 480px)` block in `app.css`. The 899px title switch in `tokens.css` is not a phone block | None; the count is kept |
| G8 ramp | `--ramp-*` appears nowhere in the repo once the last migration plan lands | The `--ramp-*` assertions in `contrast.test.ts` and the four other unit tests, reworded for `--heat-*` |

**Test changes named by CONTEXT.** `tests/unit/guards/phase8-ui-review-guards.test.ts`, `tests/unit/guards/phase5-layout-guards.test.ts`, `tests/unit/charts/contrast.test.ts` (the heat assertions below, and the adjacency floor, OI-4), `tests/helpers/components.ts` (`SCALE_PX` becomes `{12, 14, 18, 26, 32, 56}`, `OVERVIEW_SCALE_PX` is removed).

**Heat assertions in `contrast.test.ts`.** The test recomputes the five data ratios and the four mixed colours from the stops, in sRGB, matching `color-mix(in srgb)`. It asserts: each data step is at least 3:1 on white; lightness strictly falls across the six swatches (empty included); adjacent data steps are at least 1.1:1 apart.

**Nesting probe (D-05).** Before the first migration plan, the executor builds one nested rule and checks that Svelte 5.57.1 scopes every nested selector. This is OI-10.

---

## Verification

- **Before and after screenshots (D-13).** Use the synthetic three-account fixture. Capture every pane in `PANE_TITLES` that renders on it, at 1280px and 375px, plus 900px and 899px for the title switch. Review in UAT. Do not pixel-diff.
- **Overview.** Every pixel is identical except the title's own box (Allowed Visible Changes, item 2; D-16: the Overview compensates its title row, so nothing below the title moves and every element keeps its size). Check at 1040, 880, 479 and 340px, the widths 13-UI-SPEC uses: the screenshot sizes are equal, and the differing pixels outside the masked title box number 0.
- **Focal elements.** In the before and after screenshots at 1280px and 375px, each pane's focal element (Visual Focal Points) is still the first data element after the title. A changed order is a regression.
- **Copy drift.** The Copywriting drift check passes for every row (the verbatim strings and their source keys).
- **Titles.** No title wraps to a second line at 900px or 375px, except long identity nicknames, which wrap by design. "Not yet supported" and "Login history" stay on one line in the 375px phone bar.
- **Heat.** The `contrast.test.ts` assertions above pass. Empty cells keep their pixels. The calendar and world-map legends read the same stops.
- **Guards.** G1 to G8 pass. The old guards stay green through the migration on a temporary allow-list (D-14), and that allow-list is removed in the last plan.
- **Zero-network e2e.** Unchanged and must pass.

---

## UI Considerations

Applicable state considerations resolved: 5 covered, 2 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Calendar and hour grid with no data | ✅ covered | Level 0 keeps `--heat-empty` (`#eef0f2`), the same pixels as today |
| empty | Panes with no data (absent rows, status lines) | ✅ covered | Unchanged; only type roles and tokens change |
| populated | Calendar, hour grid, duration bars and world map at full scale | ✅ covered | Levels 1 to 5 from the heat scale; contrast test |
| partial | Export with some panes absent | ✅ covered | Unchanged |
| error | Error banner | ✅ covered | Same copy; `--danger-ink` and `--danger-bg` carry the existing values |
| overflow | Long pane title in the 375px phone bar | 🧪 backstop | `.t-title` at 26px with ellipsis as the last resort; UAT screenshot of "Not yet supported" and "Login history" |
| long-text | Long identity nickname at 375px and 900px | 🧪 backstop | Wraps (`overflow-wrap: anywhere`) at 26px below 900px; UAT screenshot |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable |

No third-party registry or block is declared.

---

## Open Items

| Id | Item | Position in this contract | Who decides |
|----|------|---------------------------|-------------|
| OI-1 | Overview title moves to 32px at 900px and up (D-12) while the Overview stays pixel-identical (D-15) | Moves, and the Overview compensates its line box (D-16): the title is 32px, its title block keeps today's row height, and the title's own box is the only Overview pixel change. The other panes' title rows may grow by about 8px | Owner (decided 2026-10-25) |
| OI-2 | Phone detail-bar title goes from 18px to 26px | 26px, as the title role | Owner |
| OI-3 | Identity nickname takes the title role | Yes, 32px desktop and 26px below 900px | Owner |
| OI-4 | Adjacent-step floor in `contrast.test.ts` goes from 1.25:1 to 1.1:1 | 1.1:1, plus strict monotonicity. The stops cannot change without touching the Overview | Owner (a test amendment) |
| OI-5 | Five data levels plus an empty neutral, instead of six data levels (D-11) | Five plus empty. Six would change the calendar's quantisation | Owner |
| OI-6 | The 44 sites of 6px radius: keep as `--radius-sm`, or collapse to 8px | Keep 6px | Owner (CONFIRMED in chat 2026-10-25; recorded as an amendment to D-04 in 14-CONTEXT.md) |
| OI-7 | Layout gutters (20, 32, 40, 48, 64 px): keep the pixels under `--layout-*`, or snap to the scale | Keep the pixels. Snapping would be a visible change the Allowed list does not cover | Owner, or planner by screenshot |
| OI-8 | `--warn-line` `#f9ab00` is 1.93:1 on white as a border | Kept as is. The warning box is identified by its text, but this is a known gap and is not changed here | Owner |
| OI-9 | `14-CONTEXT.md` cites D-24 and D-27, which do not exist there | Read as D-15 and the D-04 allowance | Maintainer: correct CONTEXT before planning |
| OI-10 | Svelte 5.57.1 scoping of nested rules (D-05) | Executor probe before the first migration plan | Executor |
| OI-11 | Where shared CSS lives. D-02 says `app.css` keeps only element resets. This contract keeps the shell layout and the single 480px phone block in `app.css` as well, so the phase-8 guard that reads the phone block stays stable | Keeps both in `app.css`. This deviates from D-02 as written and takes effect only if the owner confirms. The alternative is to move both to `src/styles/` and update the guard | Owner: confirm, or direct the planner to move them. **OPEN as of 2026-10-25 (not yet confirmed):** the plans follow this position, and plan 14-21 lists it under `Open items for the owner` |

---

## Checker Sign-Off

Verdicts are recorded by `gsd-ui-checker`, not pre-filled here. Boxes stay unticked until the checker reviews each dimension.

- [x] Dimension 1 Copywriting
- [x] Dimension 2 Visuals
- [x] Dimension 3 Color
- [x] Dimension 4 Typography
- [x] Dimension 5 Spacing
- [x] Dimension 6 Registry Safety
- [x] Dimension 7 Inventory Provenance (not applicable: `Tool: none`)

**Approval:** pending
