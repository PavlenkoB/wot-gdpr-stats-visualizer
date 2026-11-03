# Phase 14: Design unification - Migration Playbook

**Role:** the shared rulebook that every pane-migration plan (14-05 to 14-20) and the closing plan (14-21) follows. Plans 14-01 to 14-04 build the machinery this playbook relies on. A plan's tasks name the files and the plan-specific exceptions; this file holds the rules that are the same for every file, so each plan stays short and the rules cannot drift between plans.

**Authority:** `14-CONTEXT.md` (D-01 to D-16, locked; D-04 and D-11 amended, D-16 added, all owner-confirmed 2026-10-25) > `14-UI-SPEC.md` (approved contract) > this playbook > `14-RESEARCH.md` / `14-PATTERNS.md` (reference). Where this playbook departs from the UI-SPEC, the departure is listed in section 10 and was decided by the planner under CONTEXT's "Claude's Discretion". Section 10 also lists what is not a planner decision: items 1 (D-07) and 8 (D-02 / OI-11) are OPEN ITEMS that belong to the owner, and items 9 (D-04 / OI-6) and 10 (D-16) record decisions the owner already made.

**Hard rules for every plan:** no new runtime dependency; no SCSS; no new network request; no inline `style=` attribute; no `url()` or `@import` in any CSS; no user-facing copy change (`src/lib/ui-copy.ts` strings are byte-identical, only comments may change); no DOM restructuring (a class name may be added or renamed, an element may not be added, removed or moved); no new e2e test (the listed Playwright count stays at or below 273, `tests/unit/guards/ci-budget.test.ts`); commits carry no Co-Authored-By trailer.

---

## 1. Per-plan procedure (P0)

1. Re-measure before editing: for each file in the plan, count raw `font-size`, spacing declarations, hex or `rgba(` literals and shared-class definitions. The numbers in `14-RESEARCH.md` go stale as plans land.
2. Read the file once, fully. Read the unit tests named in the plan's "Known readers" list (grep `tests/unit` and `tests/e2e` for the file's name to find any reader the list missed).
3. Migrate the file by sections 2 to 6 below. A scratch script that lives outside the repository and is not committed may apply the purely mechanical substitutions (px to token) to this plan's files only; nesting, role adoption and deletion of duplicates are hand edits. Review the diff of every file.
4. Update the readers (section 7), then remove the migrated files from `PENDING_FILES` in `tests/helpers/migration.ts` and from the matching entries of `ALLOWED_COLOUR_LITERALS` in `tests/unit/guards/phase8-ui-review-guards.test.ts` (both are forced: a clean file left in either list fails a stale-entry check).
5. Run the checks in section 8. Capture the "after" screenshots (section 9) for the pane.
6. Commit with `refactor(14-NN): ...` and no Co-Authored-By trailer.

## 2. Type (D-01, D-06, D-07, D-08, D-09)

| Raw value in a rule | Replace with | Notes |
|---|---|---|
| `font-size` 12px / 14px / 18px / 26px / 32px / 56px | `var(--fs-caption)` / `var(--fs-body)` / `var(--fs-heading)` / `var(--fs-display)` / `var(--fs-stat)` / `var(--fs-hero)` | |
| `font-size` 30px | `var(--fs-display)` | Only the two tile numerals (`PlaytimeSummary`, `LoginSummary`), D-08 |
| `font-weight` 400 / 600 | `var(--fw-regular)` / `var(--fw-semibold)` | |
| `line-height` 1.1 / 1.2 / 1.3 / 1.4 / 1.5 | `var(--lh-hero)` / `var(--lh-stat)` / `var(--lh-heading)` / `var(--lh-tight)` / `var(--lh-body)` | Bare `1`, `normal`, `inherit` and a px value (the four table cells at 18px) stay as written |
| a `font:` shorthand | split into `font-family: inherit` plus the three tokens above | `font: inherit` alone is fine |

- Keep every site's computed size, weight and line height exactly as it is (the Allowed Visible Changes in section 11 are the only exceptions). When a rule declares only some of the three, convert only what it declares; do not add the missing ones (an omitted property inherits, and adding it can change pixels).
- **Role classes.** `src/styles/type.css` defines the nine roles of the UI-SPEC: `.t-hero`, `.t-stat`, `.t-title`, `.t-display`, `.t-heading`, `.t-body`, `.t-body-strong`, `.t-caption`, `.t-label`. A role owns size, weight and line height (plus `overflow-wrap`, `text-transform`, `letter-spacing` where the UI-SPEC lists them) and never colour, margin, display or position.
- **Mandatory role adoption** (named per plan): pane titles and the identity titles take `.t-title`; the identity row name takes `.t-heading`; the figures take `.t-display`; the Overview's exact-match sites take `.t-hero`, `.t-stat`, `.t-label`, `.t-caption`. When an element takes a role, delete size, weight and line height from every local rule that styles it, so no local rule competes with the role.
- **Elsewhere the default is tokens inside the component rule.** The UI-SPEC role table has no 14px role at line height 1.4, and 105 of the 188 14px sites use 1.4 (67 at weight 600, 38 at weight 400). Mapping those onto `.t-body` (1.5) would change pixels, which the closed Allowed Visible Changes list forbids, so they stay as token declarations. **D-07 is therefore only partly delivered.** The planner does not narrow D-07 and does not close it: the remaining triples are an OPEN ITEM for the owner (section 10, item 1), surfaced in plan 14-21's UAT checklist and in the phase summary.
- A role is applied only when the site's computed triple equals the role's triple. If it does not, use tokens in the rule and leave the class off.

## 3. Spacing (D-04, D-15)

Properties checked: `padding`, `margin`, `gap`, `row-gap`, `column-gap` and their longhands (`*-top`, `*-right`, `*-bottom`, `*-left`, `*-block*`, `*-inline*`). Every whitespace-separated value token of a declaration must be one of: `0`, `auto`, `calc(...)`, `inherit`, `initial`, `unset`, `var(--space-4|8|12|16|24)` or `var(--layout-*)`.

| Raw token | Replace with |
|---|---|
| 4px / 8px / 12px / 16px / 24px | `var(--space-4)` / `var(--space-8)` / `var(--space-12)` / `var(--space-16)` / `var(--space-24)` |
| 20px | `var(--layout-gutter)` |
| 32px | `var(--layout-section)` |
| 40px | `var(--layout-page-x)` |
| 48px | `var(--layout-page-y)` |
| 64px | `var(--layout-page-bottom)` |
| 6px as a gap (one site, `PlayerStats`) | `var(--space-4)` (UI-SPEC fixes this at 4px) |
| a negative offset such as -4px | `calc(var(--space-4) * -1)` (value unchanged) |
| -1px | allowed only inside a rule that also declares `clip` (the visually-hidden idiom); leave as written there |

- `border-radius: 6px` becomes `var(--radius-sm)` (OI-6: the 44 radius sites keep 6px). Other radii are left alone.
- **The Overview is exempt from snapping (D-15):** its values already sit on the scale except its one 32px, which is `var(--layout-section)`. The 6px snap never applies there. The one margin that is not a plain token is the Overview title's compensation (D-16, section 10 item 10): `margin: 0 0 calc((var(--fs-display) - var(--fs-title)) * var(--lh-heading))`, a `calc()` of tokens, which the spacing guard allows as written.
- Non-spacing px are never tokenised: widths, heights, min-heights, borders, outlines, offsets (`top`, `inset`), strokes, the 44px touch floor.

## 4. Colour (D-01, D-03)

| Literal | Token |
|---|---|
| `#c5221f` | `var(--danger)` |
| `#8a1c17` | `var(--danger-ink)` |
| `#fce8e6` | `var(--danger-bg)` |
| `#f5d4d1` | `var(--danger-bg-strong)` |
| `#f9ab00` | `var(--warn-line)` |
| `#fef7e0` | `var(--warn-bg)` |
| `#8a5a00` | `var(--warn-ink)` |
| `#ffffff` used as a surface fill | `var(--page)` |
| `#ffffff` used as text, a stroke or a separator on a dark or data surface | `var(--white)` |
| `rgba(26, 115, 232, A)` (spinner) | `var(--spinner-track)` (alpha .25) or `var(--spinner-arc-still)` (alpha .6), both `color-mix(in srgb, var(--focus) A%, transparent)` in `tokens.css` |
| `rgba(17, 17, 17, A)` (Overview shadows) | `color-mix(in srgb, var(--ink) A%, transparent)` through tokens in `tokens.css` (plan 14-19) |

No hex, `rgb()`, `rgba()` or `hsl()` survives outside `src/styles/tokens.css`. A literal `color-mix()` must stay inside a custom property or a declaration whose input includes `var()`; Vite folds a fully literal one into a static colour.

## 5. Shared names (D-02)

Defined once in `src/styles/`, deleted (never shadowed) from every component and from `app.css`: `.t-*`, `.visually-hidden`, `.scroller`, `.error`, `.btn`, `.caption`, `.body`. A scoped selector outranks a global one, so a leftover local copy silently wins.

- **`.caption` and `.body` keep their names** (lowest-churn route, chosen by the planner per the orchestrator default). They are the two shared text blocks in `utilities.css`, not roles: `.caption` is the muted 14px/400/1.4 note with `margin: 0; min-width: 0; overflow-wrap: anywhere`; `.body` is the `--text` 14px/400/1.5 paragraph with the same three. Markup, the seven `tests/e2e/finance` locators and the two unit assertions that name them stay valid. **`.caption` is not `.t-caption`:** `.t-caption` is the 12px role used by the Overview.
- **Variants use a different hook class added next to the shared one** (`class="caption weighty"`), on EVERY element of that file that carries the shared class, because the deleted local rule applied to all of them; the hook's scoped rule wins on specificity and states only the difference (a margin, a weight, a line height). Known variants: `CityList` (margin-top 8px), `NewDataCard` (negative top margin), `Playtime` (line height 1.5), `IdentityHeader` (weight 600). `ImportSummary` needs no variant: its `<p>` element rule already supplies margin 0, min-width 0 and wrap, so its dynamic `caption` class value simply loses the local rule and takes the shared one.
- **`.error`** is the shared box: `padding: var(--space-8) var(--space-12); border: 1px solid var(--danger); border-radius: var(--radius-sm); background: var(--danger-bg); color: var(--danger-ink)`. It is declared after `.body` in `utilities.css` so an element with both classes (`class="body error"`) shows the danger colour. `CityOptIn` relied on a grouped body rule for its `.error` and `.info` paragraphs, so their markup becomes `class="body error"` and `class="body info"` (the `.info` chrome stays a local rule).
- **`.scroller`** is the focusable scroll region shared by the table and list scrollers: `min-width: 0; overflow: auto; isolation: isolate` plus the nested `&:focus-visible` ring (`outline: 3px solid var(--focus); outline-offset: 2px`). Table scrollers add `position: relative; max-height: 480px; border; radius; background` under a local hook (`table-scroll`); list scrollers add `max-height: 320px; margin-top` under `list-scroll`. The three chart scrollers (`MonthlyBarChart`, `CalendarHeatmap`, `HourGrid`) are not focusable regions and must not gain isolation: rename them to a local `chart-scroll` hook that keeps its own rule (`overflow-x: auto; overflow-y: hidden; max-width: 100%; padding: var(--space-4) 0; min-width: 0`). `DeviceTable` adopts the shared region but its `table-scroll` hook rule states `isolation: auto`, because today it has a sticky header with no z-index and no isolation, and this phase must not change stacking behaviour.
- **`.visually-hidden`** is the clip block of `utilities.css`. `AccountTimelinePane`'s `.caption.hidden` becomes `visually-hidden` on that element. A clip block under any other local name (`.chart-status`, `.notice-announcer`, the `ListPane` skip link, a file input) stays local - lowest churn, and several unit tests assert those local rules by name - and its `margin: -1px` is allowed because the same rule declares `clip`; only the rules named exactly `.visually-hidden` are deleted.

## 6. Nesting (D-05)

Every touched style block is restructured so that a rule whose selector begins with a **sibling** rule's selector is nested under that sibling. Guard G6b enforces this: within one scope, if rule B is a single complex selector and starts with rule A's single selector followed by a space, `>`, `+`, `~`, `.`, `:`, `[` or `#`, it fails.

- Always write `&`: descendant `& .b`, child `& > .b`, compound `&.b`, state `&:hover`, pseudo-element `&::before`, attribute `&[x]`. Never a top-level `&` (a Svelte compile error).
- One declaration per line (G6a). No single-line rule with a declaration in it.
- Do not nest under a comma list (`:is()` takes the maximum specificity of the list) and do not nest where the parent rule does not exist (leave such a rule top-level).
- `@media` / `@container` blocks may stay top-level; nesting them is optional.
- Moving B up under A changes B's source position. Before moving, check whether another rule between A and B can match the same element with equal specificity and conflicting properties; if so keep the original order by nesting that rule too, or leave B where it is only if it is not a prefix case.
- **Specificity and the phone block.** A nested descendant rule (`& .child`) carries its parent's scope class and can reach `(0,3,0)`, the specificity of the phone-block rules in `src/app.css` (`.shell` + hook + selector). The `app.css` comment at its phone block states that the outcome must never depend on source order. Therefore the rule for each target the phone block overrides stays **top-level in its component, never nested under a different parent selector** (a target's own states, such as `&:hover` or `&.muted`, nest under it as G6b requires, and add no scope class): `ListPane` (`.row`, `.row.footer`, `.chevron`, the `nav > ul` rules), `DurationList` (`.row`, `.label`, `.count`, `.bar`), `PlaytimeSummary` and `LoginSummary` (`dd`), `DashboardSection` and `Overview` (`.section-title`), `DetailPane` (`.phone-bar`, `.phone-title`), `IdentityHeader` (the title classes). Verify at 375px (section 9).
- Svelte reports an unused nested selector as `css_unused_selector` and drops it. `tests/unit/guards/nesting-guard.test.ts` fails on any such warning in a migrated component, and on any compile error.

## 7. Tests that read the CSS text (the readers)

About twenty unit tests read component sources as text and assert declarations (for example `padding: 16px`, `max-height: 480px`, `tbody tr { height: 40px }`, a `.scroller` rule's `isolation`). They break when a declaration becomes `var(--space-16)` or moves into a nested block. Rules:

- Update them in the **same plan** as the component, never later.
- **Keep the intent, change the form.** Resolve tokens with `resolveTokens()` and look rules up with the nested-aware `ruleDeclarations()` from `tests/helpers/css.ts` (plan 14-01). A px assertion becomes "the resolved value is still that px"; a selector-body regex becomes a `ruleDeclarations(source, selector)` lookup. Where a test asserted a literal that is now a token, assert the token name instead.
- Never delete an assertion, never weaken one to presence-only, and keep every sweep non-vacuous (`expect(matches.length).toBeGreaterThan(0)`). The two known vacuous passes are `tests/unit/device-info/device-info-blocks.test.ts` (font-size loop with no length check) and `tests/unit/new-data/new-data-blocks.test.ts` (same); they get a length check in plans 14-18 and 14-17.
- E2E: amend an assertion only where an Allowed Visible Change requires it (section 11). No new e2e test.

## 8. Checks that run after every plan

| Check | Command | Failure signal |
|---|---|---|
| Quick guards | `pnpm exec vitest run tests/unit/guards/design-tokens-guards.test.ts tests/unit/guards/nesting-guard.test.ts tests/unit/guards/phase5-layout-guards.test.ts tests/unit/guards/phase8-ui-review-guards.test.ts tests/unit/charts/contrast.test.ts tests/unit/guards/ci-budget.test.ts` | a named assertion fails; a stale `PENDING_FILES` entry names the file to remove |
| Unit suite | `pnpm run test:unit` | any failing test (baseline before the phase: 159 files, 4777 passing, 9 expected-fail) |
| Types and Svelte | `pnpm run check` | `tsc -b` or `svelte-check` error |
| Lint and format | `pnpm run lint` | prettier or eslint error (run `pnpm exec prettier --write <changed files>` first) |
| Build | `pnpm run build` | vite build error |
| Targeted e2e | the specs named in the plan, via `pnpm exec playwright test <specs>` | a failing computed-style, geometry or request assertion |

The quick-guards command names `nesting-guard.test.ts`, which plan 14-04 creates; plan 14-03 runs the same list without it, and every plan from 14-04 on runs it whole.

## 9. Visual verification (D-13, D-15), scratch scripts, retained Overview result

The screenshot harness and the Overview pixel compare are **scratch scripts outside the repository** (for example under `${TMPDIR:-/tmp}/wg-phase14/`), never committed, never listed by `playwright test --list`. They use the synthetic fixtures in `tests/fixtures/multi-account-fixtures.ts` only. A real export in `path/to/export.zip is PII and must never be loaded by the harness. The scripts and the PNGs are scratch; the **Overview result is not**: it is committed as `.planning/phases/14-design-unification/14-OVERVIEW-PIXEL-EVIDENCE.md` (see the last bullet), so the D-15 proof survives the scratch directory.

- **Baseline:** the build of commit `901a9e1` (the commit before any Phase 14 code), made in a `git worktree` outside the repository, served by `vite preview` on port 4174. "After" is the working tree served on 4173.
- **Panes:** every id in `PANE_TITLES` (`src/lib/ui-copy.ts`) that renders on the fixture, at 1280, 900, 899 and 375px. The drop goes through `[data-testid="file-input"]` as in `.claude/skills/run-data-export-viewer/driver.mjs` (it imports from `@playwright/test`, there is no `playwright` package).
- **Phone-block computed-style check:** at 375px, read `getComputedStyle` (font-size, font-weight, line-height, margin, padding, display) of the phone-block target elements before and after; any difference outside the Allowed Visible Changes is a regression (this is the Pitfall 1 check).
- **Overview pixel compare (D-15, D-16):** element screenshot of `[data-testid="overview"]` at 1040, 880, 479 and 340px, before and after; decode both in the page with `createImageBitmap` and an offscreen canvas and compare `ImageData` byte for byte; at 880px and above mask the title's bounding box. No pixel-diff dependency. Since D-16 the Overview title compensates its line box (a negative bottom margin that cancels the 7.8px a 32px title adds, plan 14-05), so the before and after captures have equal PNG sizes at every width and a size difference counts as a difference. The mask is the union of the title's bounding boxes in the two captures (the after box is the taller one at 900px and up); outside it every byte must be equal, so nothing below the title may have moved.
- **Retained evidence (D-15):** the harness subcommand `evidence` (defined in plan 14-01) writes one section of the committed `14-OVERVIEW-PIXEL-EVIDENCE.md` per call. `Baseline` (plan 14-01): the baseline commit and, per width, the PNG size and sha-256 of the `before` capture. `Result` (plan 14-20) and `Final re-run` (plan 14-21): per width the before and after sizes (equal), the masked title box (`x= y= w= h=` at 1040 and 880, `none (below 880px)` at 479 and 340), the differing-pixel count outside the mask, and the verdict `BYTE-EQUAL` or `DIFFERS`, plus the measured HEAD and the `Working tree (src/)` clean or dirty flag. The file holds only widths, sizes, counts, hashes and commit ids: no screenshot, no fixture byte, no export content. Only the scripts and PNGs stay uncommitted.
- Owner review happens in UAT at the end of the phase; nothing here is asserted pixel-exact except the Overview.

## 10. Planner decisions that go beyond the UI-SPEC (surfaced, not hidden)

Items 1 and 8 are OPEN ITEMS owned by the owner, not planner decisions; items 9 and 10 record owner decisions already made in chat on 2026-10-25; items 2 to 7 and 11 are planner decisions under CONTEXT's "Claude's Discretion" (item 2, the `.caption` naming, is also put to the owner at UAT by plan 14-21). Plan 14-21 carries items 1, 2, 8 and 9 into its UAT checklist and into the `Open items for the owner` section of `14-21-SUMMARY.md`.

1. **OPEN ITEM, owner decision: D-07 is only partly delivered (14px at line height 1.4).** D-07 says the roles bundle size, weight and line height so the repeated triples collapse to one class. The UI-SPEC role table (`.t-body` 1.5, `.t-body-strong` 1.5) has no counterpart for the 105 of 188 14px sites that use line height 1.4 (67 at weight 600, 38 at weight 400). Mapping them onto the 1.5 roles would change pixels, which the closed Allowed Visible Changes list (section 11) forbids, so those sites keep token declarations (section 2). The planner does not narrow D-07 and does not declare it complete: every site whose computed triple equals a role is on that role, and the 105 others are what is left open. **Owner decides, at UAT: add `.t-note` (14/400/1.4) and `.t-note-strong` (14/600/1.4) roles in a follow-up (collapses those triples, touches about 105 markup sites, no visible change), or accept the token declarations as the final state.** Where it is surfaced: the plan 14-21 UAT checklist and the `Open items for the owner` section of `14-21-SUMMARY.md`, which carries it into the phase summary.
2. **`.caption` / `.body` keep their names** as shared text blocks in `utilities.css` instead of being renamed to `.t-*` plus a scoped colour (UI-SPEC Pattern 4 option A). The cost is a naming trap (`.caption` 14px muted versus `.t-caption` 12px), documented in the file header.
3. **`--lh-*` tokens** (`--lh-hero` 1.1, `--lh-stat` 1.2, `--lh-heading` 1.3, `--lh-tight` 1.4, `--lh-body` 1.5) are added so the roles and the component rules read one source.
4. **`--fs-title`** switches with a single `min-width: 900px` media query (default `--fs-display`), which has the same effect as the UI-SPEC's min/max pair and cannot leave a gap at a fractional viewport width.
5. **`.scroller` is split** into the shared focusable region and three local variants (section 5), because the three chart scrollers must not gain isolation.
6. **Retired Activity ramp tokens are deleted by plan 14-09**, the moment their last consumer and last assertion are gone, instead of waiting for the closing plan. Plan 14-21 re-proves the zero-match check and updates the sketch-findings skill.
7. **Guards ship with a shrinking `PENDING_FILES` list** (D-14's temporary allowlist). A pending file that has become clean fails the suite, so the list cannot rot; plan 14-21 deletes it.
8. **OPEN ITEM, owner decision: D-02 is departed from as written (UI-SPEC OI-11).** D-02 says `app.css` keeps only what is not token, type or utility (the element resets). The plans keep the shell layout and the single `@media (max-width: 480px)` phone block in `app.css` as well (plans 14-05 and 14-06), because the phase-8 guard that reads the phone block stays stable that way. **The owner has not confirmed this as of 2026-10-25.** The plans follow the UI-SPEC position; the alternative is to move the layout and the phone block into `src/styles/` and repoint the guard. **Owner decides, at UAT: confirm, or direct a follow-up that moves them.** Surfaced in the plan 14-21 UAT checklist and in the `Open items for the owner` section of `14-21-SUMMARY.md`.
9. **CONFIRMED by the owner (2026-10-25, in chat; UI-SPEC OI-6): D-04's snap does not apply to the 44 sites of `border-radius: 6px`.** D-04 says the 6px values (45 uses) snap to 4 or 8. 44 of them are radii, not spacing, so they keep 6px through `--radius-sm` (section 3), and only the one spacing site (`gap: 6px` in `PlayerStats`, plan 14-14) becomes 4px. Recorded as an amendment to D-04 in `14-CONTEXT.md`. Listed in plan 14-21's UAT checklist and `Open items for the owner` section for the record, not as a question.
10. **Owner decision D-16 (2026-10-25): the Overview title compensates its line box.** The Overview title is 32px (OI-1, D-12) but the Overview's title block keeps today's row height, so content below the title keeps its position and every Overview element keeps its size (the whole page would otherwise shift down by 7.8px). Mechanism, chosen by the planner under CONTEXT's "Claude's Discretion": in `Overview.svelte` the `.section-title` rule declares `margin: 0 0 calc((var(--fs-display) - var(--fs-title)) * var(--lh-heading))`. At 900px and up that is (26px - 32px) x 1.3 = -7.8px, so the 41.6px line box nets 33.8px, the 26px x 1.3 row of the pre-phase build; below 900px `--fs-title` equals `--fs-display` and the margin is 0; at 480px and below the phone block hides the title and its `margin: -1px` outranks the rule. The role is not changed and no other pane carries the margin (their title rows grow by about 8px, section 11 item 6). The pixel gate masks only the title's own box and requires equal sizes (section 9); the title is never taken back to 26px and the mask is never widened. Implemented and unit-tested in plan 14-05 (`tests/unit/shell/overview-title.test.ts`), re-checked in plans 14-06, 14-20 and 14-21.
11. **Plans that stay whole, and why (sizing record).** The chain has 21 plans; each is under 15 files and the ones that cannot be split further are recorded here. `14-01` (14 files) stays whole: it is the tracer, and the three existing guard readers it amends must change in the same commit as the first consumer or the suite goes red between plans. `14-09` (14 files, estimate 100000) stays whole: the legend, the calendar, the hour grid, the duration list and the world map must change colour scale together, and the ramp may be deleted only when the last consumer and the last assertion that pins it leave in the same plan; splitting it would leave the legend and the map on different scales between commits. `14-17` (10 files) and `14-21` (11 files) are single-purpose groups (the optional-data panes with their ten literal-CSS readers; the close-out with its four skill files) and stay under the ceiling. Every other plan is at or under 10 files and at most 90000 estimated tokens.

## 11. Allowed Visible Changes (UI-SPEC, complete list; any other pixel change is a regression)

1. Calendar heatmap, hour grid, duration bars, login world map and chart legend move from the Activity ramp to `--heat-*`. Levels 1 to 5 change colour; level 0 keeps `#eef0f2`. `DurationList` fill becomes `--heat-3`.
2. Pane titles including the Overview title (OI-1): 26px to 32px at 900px and up; 26px below 900px. On a phone the detail-bar title goes from 18px to 26px (OI-2). The Overview title compensates its line box (D-16, section 10 item 10), so only its own glyph box changes there.
3. The identity nickname, its fallback, multi and skeleton titles: 26px to 32px at 900px and up; 18px to 26px below 900px (OI-3). The named multi-account **row** name (`.multi-name`) stays 18px (it is a row title, `.t-heading`).
4. The two tile numerals (`PlaytimeSummary`, `LoginSummary`): 30px to 26px at desktop width (D-08); they take `.t-display`, whose 1.3 line height replaces the old 1.2 at both widths (the phone block still sets 18px).
5. One `gap: 6px` (`PlayerStats` `.toggle`) to 4px (D-04).
6. The title rows of the panes other than the Overview grow by about 8px on desktop. The Overview's title row does not: it compensates its line box (D-16, owner-confirmed 2026-10-25), so content below the Overview title keeps its position and every Overview element keeps its size. Nothing else reflows.

**UI-SPEC `## UI Considerations` (the orchestrator was told none existed; the section is present in `14-UI-SPEC.md` and is lifted here):**

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| empty | Calendar and hour grid with no data | covered | Level 0 keeps `--heat-empty` (`#eef0f2`), same pixels (plan 14-09) |
| empty | Panes with no data | covered | Unchanged; only roles and tokens change (every pane plan) |
| populated | Calendar, hour grid, duration bars, world map at full scale | covered | Levels 1 to 5 from the heat scale; `contrast.test.ts` (plans 14-02, 14-09) |
| partial | Export with some panes absent | covered | Unchanged (every pane plan) |
| error | Error banner | covered | Same copy; `--danger-ink` and `--danger-bg` carry the existing values (plans 14-01, 14-07, 14-10 to 14-18) |
| overflow | Long pane title in the 375px phone bar | backstop | `.t-title` at 26px with ellipsis as the last resort; UAT screenshot of "Not yet supported" and "Login history" (plans 14-05, 14-21) |
| long-text | Long identity nickname at 375px and 900px | backstop | Wraps via `overflow-wrap: anywhere` at 26px below 900px; UAT screenshot (plans 14-05, 14-21) |

**Prohibitions and edge coverage (lifted from the UI-SPEC):** no new copy; no new emphasis on a focal element; the focus ring stays `3px solid var(--focus)` with `outline-offset: -3px`; the 44px touch floor is unchanged; empty heat cells keep `#eef0f2`; no title wraps at 900px or 375px except long identity nicknames; "Not yet supported" and "Login history" stay on one line in the 375px phone bar; the Overview is pixel-identical except its title's own box (D-16: nothing below the title moves, every size is equal).

**Copy drift check:** `src/lib/ui-copy.ts` strings must be byte-identical after every plan. The only permitted edit in that file is a comment (plan 14-09 updates two stale comments about the old ramp). Re-read `git diff 901a9e1 -- src/lib/ui-copy.ts`: only `//` or `/* */` lines may change.

## 12. Why the 21 plans are one strict linear chain (waves 1 to 21)

Plan 14-NN depends on 14-(NN-1) for every NN from 02 to 21, its wave equals its number, and `parallelization` is `false` in `.planning/config.json`. This is deliberate, not a missed parallel opportunity: the plans share files, and two of them in the same wave would edit the same lines.

| Wave and plan | What it does |
|---|---|
| 1 / 14-01 | Tracer: tokens, roles and utilities through the entry import, carried by `AccountTimelinePane`; CSS scanner and sRGB helpers; scratch harness and the Overview baseline record |
| 2 / 14-02 | Legacy custom properties move to `tokens.css`; the heat-scale contract in `contrast.test.ts` |
| 3 / 14-03 | Token, shared-name, nesting-shape, network and role guards with the shrinking `PENDING_FILES` allowlist |
| 4 / 14-04 | Nesting compile probe and sweep; the per-folder font exemption and the regex readers of the older guards retire |
| 5 / 14-05 | Title role on pane, identity and phone-bar titles; the Overview title compensates its line box (D-16); identity header |
| 6 / 14-06 | `app.css` to resets, layout and the phone block on tokens; `.btn` to utilities; list pane |
| 7 / 14-07 | Spinner tokens; failure banner, exclusion notice, import summary, confirm panel |
| 8 / 14-08 | Dashboard, dropzone, game filter, account tag, unsupported block |
| 9 / 14-09 | Heat scale replaces the Activity ramp on legend, calendar, hour grid, duration list and world map; the ramp is deleted |
| 10 / 14-10 | Playtime pane: Display role on the tile numerals (D-08), shared text blocks, status tokens |
| 11 / 14-11 | Logins: second numeral (the temporary 30 leaves `SCALE_PX`), map section, three scrolling regions |
| 12 / 14-12 | Logins: city opt-in and history block |
| 13 / 14-13 | Vehicles: table and battle-type summary |
| 14 / 14-14 | Vehicles: `PlayerStats` (the 4px toggle gap) |
| 15 / 14-15 | Chart pieces: tooltip, bar chart, flow legend, monthly table, About disclosure |
| 16 / 14-16 | Finance blocks and the spend summary |
| 17 / 14-17 | HEAT, Perks, Warships panes with their card and table |
| 18 / 14-18 | Device info and the rest of the account timeline |
| 19 / 14-19 | Overview tile: tokens, exact-match roles, elevation tokens |
| 20 / 14-20 | Remaining Overview components; the pixel gate and the committed D-15 result |
| 21 / 14-21 | Close-out: delete the allowlist and folder exemptions, update the design skill, full phase gate, owner open items |

| Shared file | Edited by | Why it forces the order |
|---|---|---|
| `tests/helpers/migration.ts` (the `PENDING_FILES` allowlist) | created in 14-03; every plan 14-05 to 14-20 removes its own files; deleted in 14-21 | A file that is clean but still listed fails the stale-entry check, so a pane plan is green only after it edits this one array; two plans editing it concurrently conflict on the same lines |
| `ALLOWED_COLOUR_LITERALS` in `tests/unit/guards/phase8-ui-review-guards.test.ts` | every plan from 14-01 to 14-21 (entries leave with their files; the `#ffffff` entry is deleted in 14-15, the `rgba(` entry in 14-19) | The same stale-entry rule applies to the colour allowlist; 14-21 deletes the list |
| `src/styles/tokens.css` | 14-01 (new families), 14-02 (legacy tokens moved in), 14-07 (`--spinner-*`), 14-09 (ramp deleted), 14-19 (`--elev-*`) | Tokens are added, moved and deleted in this one file, so each plan must start from its predecessor's result |
| `src/styles/utilities.css` and `src/app.css` | utilities: 14-01, 14-06 (`.btn` arrives); app.css: 14-02 (custom properties leave), 14-05 (title rules), 14-06 (finished) | The shared classes, the element resets and the single phone block reach their final form once, and every later pane plan relies on that form |
| `tests/helpers/components.ts` (`SCALE_PX`, `OVERVIEW_SCALE_PX`) | 14-04 (six sizes plus a temporary 30), 14-11 (the 30 is removed), 14-21 (the Overview-only scale is removed) | The scale constants change in steps that later plans' guards and e2e sweeps read |
| `tests/unit/charts/contrast.test.ts` | 14-02 (heat contract added), 14-09 (ramp describes removed around it) | The heat contract must exist before the ramp assertions beside it are deleted |
| `tests/unit/overview/overview-components-guard.test.ts` | 14-19 (tile parts), 14-20 (the rest) | One contract file, converted in two steps |
| `14-OVERVIEW-PIXEL-EVIDENCE.md` | 14-01 (Baseline), 14-20 (Result), 14-21 (Final re-run) | Each section describes the tree of the plan that wrote it |

A second reason is the rule from D-14 that the build and the whole test suite stay green between plans: the guards read the whole tree, so a plan is green only on top of every earlier plan's removals. Do not reorder the plans, and do not split a wave across parallel executors, without first removing these shared files from the plans' scope.

**Sizing (checker scope warnings).** Every plan has fewer than 15 files and, except 14-01 (14), 14-09 (14) and 14-21 (11), at most 10. The reasons the three larger plans stay whole are in section 10, item 11. Estimates are projections with calibration factor 1.0 and confidence `low` (fewer than three phases carry actuals); the largest are 14-09 (100000), 14-01 (90000) and 14-17 (90000), and every other plan is at most 80000.

---

## Appendix A: Source coverage audit (planner, mandatory)

Sources: GOAL (ROADMAP Phase 14), REQ (none mapped; D-IDs stand in), RESEARCH (14-RESEARCH.md), CONTEXT (D-01 to D-16).

| Source | ID | Item | Plan(s) | Status |
|---|---|---|---|---|
| GOAL | - | Every pane reads as one product; Overview system becomes app-wide; one-line style edits | 14-01 to 14-21 | COVERED |
| CONTEXT | D-01 | Tokenise type, spacing, shared classes, hex together | 14-01, 14-05 to 14-20 | COVERED |
| CONTEXT | D-02 | Split global files in `src/styles/`; guard rejects local redefinitions; delete not shadow | 14-01, 14-03, 14-05 to 14-20 | PARTIAL: tokens, roles and utilities are in `src/styles/`, but `app.css` keeps the shell layout and the phone block (UI-SPEC OI-11). OPEN ITEM, owner decides (section 10, item 8) |
| CONTEXT | D-03 | Guards: raw font-size, raw spacing, hex, shared names; replace per-folder exemption | 14-03, 14-04, 14-21 | COVERED |
| CONTEXT | D-04 (as amended 2026-10-25) | Spacing scale 4/8/12/16/24; the one spacing 6px snaps to 4px; the 44 radius sites keep 6px as `--radius-sm` | 14-01, 14-03, 14-14 | COVERED; radius departure CONFIRMED by the owner (section 10, item 9) |
| CONTEXT | D-05 | Native nesting in every touched block; guards read nested declarations | 14-03, 14-04, 14-05 to 14-20 | COVERED |
| CONTEXT | D-06 | Six-size role-named scale | 14-01, 14-03, 14-04 | COVERED |
| CONTEXT | D-07 | Role classes bundle size, weight, line height | 14-01, 14-05, 14-10, 14-11, 14-16, 14-19, 14-20; open item surfaced in 14-21 | PARTIAL: roles adopted wherever the computed triple matches; the 105 of 188 14px sites at line height 1.4 keep token declarations. OPEN ITEM, owner decides (section 10, item 1): add `.t-note` roles in a follow-up, or accept |
| CONTEXT | D-08 | The two 30px numerals snap to 26px | 14-10, 14-11 | COVERED |
| CONTEXT | D-09 | Overview keeps 12/14/32/56, adopts tokens | 14-19, 14-20 | COVERED |
| CONTEXT | D-10 | Heat replaces the ramp on five consumers; ramp deleted | 14-09, 14-21 | COVERED |
| CONTEXT | D-11 (as amended 2026-10-25) | Five data levels plus a neutral empty swatch derived with `color-mix()`; 3:1 on the five data steps, strictly monotonic lightness across the six swatches, adjacent floor 1.1:1; contrast test recomputes in the same space | 14-01, 14-02, 14-09, 14-21 (re-proof) | COVERED |
| CONTEXT | D-12 | Titles at 32px, 26px below 900px, role named `.t-title` | 14-01, 14-05 | COVERED |
| CONTEXT | D-13 | Before/after screenshots, contrast test, guards, zero-network e2e | 14-01 (harness), every plan (after captures), 14-21 (UAT) | COVERED |
| CONTEXT | D-14 | Foundation first, one plan per pane group, last plan deletes allowlist and exemptions | plan structure | COVERED |
| CONTEXT | D-15 | Overview pixel-identical; result retained in `14-OVERVIEW-PIXEL-EVIDENCE.md` | 14-01 (baseline record), 14-20 (result), 14-21 (final) | COVERED |
| CONTEXT | D-16 (added 2026-10-25) | The Overview title is 32px but compensates its line box: content below keeps its position, element sizes equal; the gate masks only the title's own box | 14-05 (mechanism and unit test), 14-06 and 14-19 (re-check), 14-20 (gate and evidence), 14-21 (final re-run); harness semantics in 14-01 | COVERED |
| RESEARCH | R1 | Brace-aware scanner helper | 14-01 | COVERED |
| RESEARCH | R2 | `mixSrgb` helper and string check against oklab drift | 14-01, 14-02 | COVERED |
| RESEARCH | R3 | Nesting compile probe and unused-selector warning gate (OI-10) | 14-04 | COVERED |
| RESEARCH | R4 | Vacuous-pass fixes (`device-info-blocks`, `new-data-blocks`) | 14-17, 14-18 | COVERED |
| RESEARCH | R5 | `.error` keeps border and radius (Pitfall 3) | 14-01 | COVERED |
| RESEARCH | R6 | `.scroller` variants (Pitfall 5), `phase7-layout-guards` follows | 14-01, 14-04, 14-09, 14-11, 14-13, 14-15, 14-17, 14-18 | COVERED |
| RESEARCH | R7 | `margin: -1px` clip exemption and `-4px` handling (G3 gap) | 14-03, 14-17 | COVERED |
| RESEARCH | R8 | `.caption`/`.body` markup and 7 e2e locators, 2 unit assertions | 14-01 (decision), 14-05 to 14-20 | COVERED (names kept) |
| RESEARCH | R9 | `overview-heat.ts` duplicate stops stay in step | 14-02, 14-19 | COVERED |
| RESEARCH | R10 | Phone overrides beat `.t-title` (Pitfall 2) | 14-05 | COVERED |
| RESEARCH | R11 | Nesting raises specificity (Pitfall 1) | playbook sections 6 and 9, 14-05 to 14-20 | COVERED |
| RESEARCH | R12 | Stale ramp comments (Pitfall 7) | 14-09 | COVERED |
| RESEARCH | R13 | Literal `color-mix()` folded by Vite (Pitfall 8) | 14-01, 14-02 | COVERED |
| RESEARCH | R14 | e2e ceiling 273 (Pitfall 9) | every plan (no new e2e), 14-03 (ci-budget in quick run) | COVERED |
| RESEARCH | R15 | CSS network guard, no `style=` (Security Domain) | 14-03 | COVERED |
| RESEARCH | R16 | Sketch skill still says keep the ramp (Pitfall 12) | 14-21 | COVERED |
| RESEARCH | R17 | `app.css` readers repointed to `tokens.css` | 14-02 | COVERED |
| RESEARCH | R18 | `graphify update .` after code edits | 14-21 | COVERED |
| RESEARCH | R19 | `phase7-layout-guards` reads utilities core plus variant | 14-04 (tolerant reader), 14-11, 14-13 | COVERED |
| RESEARCH | R20 | Off-scale layout values to `--layout-*` (OI-7) | 14-01, 14-05 to 14-08, 14-16, 14-19 | COVERED |
| RESEARCH | OQ6 | OI-11 shared-CSS placement (an owner decision, not a research question) | 14-06 (follows the UI-SPEC position), 14-21 (owner-open item) | OWNER-OPEN (section 10, item 8) |
| CONTEXT deferred | - | Dark mode, committed pixel baselines, `<Caption>` wrappers | none | EXCLUDED (deferred) |
