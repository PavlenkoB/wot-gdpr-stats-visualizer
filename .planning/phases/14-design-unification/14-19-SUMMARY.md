---
phase: 14-design-unification
plan: 19
subsystem: ui
tags: [svelte, css, design-tokens, type-roles, elevation-tokens, color-mix, nesting, pixel-compare, token-aware-tests]

# Dependency graph
requires:
  - phase: 14-design-unification
    provides: the token scale in `src/styles/tokens.css` (the `--fs-*`, `--fw-*`, `--lh-*`, `--space-*`, `--radius-*` and `--layout-*` custom properties)
  - phase: 14-design-unification
    provides: the shared type roles in `src/styles/type.css` (`.t-label`, `.t-caption`, `.t-body`, `.t-stat`, `.t-hero` and the rest) and the token-aware CSS test helpers `ruleDeclarations`, `resolveTokens`, `scanRules`, `styleText` and `tokenMap` (plan 14-15)
  - phase: 14-design-unification
    provides: the pre-phase Overview pixel baseline at commit `901a9e1` and the retained evidence file `14-OVERVIEW-PIXEL-EVIDENCE.md` (plan 14-01)
provides:
  - The Overview tile is on the token layer: no `rgba()`, every size, weight, leading, padding, margin and gap a token or a role
  - The tile's five text roles are the shared ones and every one of them is an EXACT match for the triple it replaces: `.t-label` (12/600/1.4 plus the uppercase and the letter spacing) on the label and the two panel headings, `.t-stat` (32/600/1.2) on the value, `.t-hero` (56/600/1.1) on the large numeral, `.t-body` (14/400/1.5) on the unit, the how-line and the open link, `.t-caption` (12/400/1.4) on the rule and the reads-line
  - `--elev-rest`, `--elev-hover` and `--elev-open` are the shared elevation tokens: mixes of the ink token with transparent that compute to the channels and the alpha the `rgba()` literals had
  - The Overview component guard reads the type through the ROLES: the sweep resolves the tokens, collects every `t-*` role the markup applies, requires a non-empty match on both halves and checks every size against the Overview's OWN four-size set, which is a local constant of the test
  - The phase-8 colour allow-list is EMPTY: the Overview tile was its last entry, and the sweep stays
  - The tile is off `PENDING_FILES`, so the design-token and nesting guards now sweep it
affects: [14-design-unification, overview, OverviewTile, overview-components-guard, phase-8-ui-review-guards, type-roles, elevation-tokens]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 7202
  tasks: 1
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A role may only be adopted where its triple is an EXACT match. The tile's five roles each match the triple they replace to the unit - 12/600/1.4, 32/600/1.2, 56/600/1.1, 14/400/1.5, 12/400/1.4 - so every local size, weight and line height could be deleted and the pixels did not move."
    - "A translucent colour can become a token without changing a pixel: `color-mix(in srgb, var(--ink) N%, transparent)` keeps the colour and mixes only the alpha, so it computes to `rgba(17, 17, 17, N/100)`. The pixel compare, not the arithmetic, is what proves it."
    - "G6b counts the rules INSIDE an at-rule as siblings of one another. The forced-colors block's `.star path` and `.star.on path` extend the `.star` in the SAME block, so they have to be nested there too - the plan's list named only the top-level ones."

key-files:
  created: []
  modified:
    - src/styles/tokens.css
    - src/lib/features/overview/OverviewTile.svelte
    - tests/unit/overview/overview-components-guard.test.ts
    - tests/unit/guards/phase8-ui-review-guards.test.ts
    - tests/helpers/migration.ts

key-decisions:
  - "The `.v.numeral` rule was DELETED rather than nested. Its two declarations were `font-size: 56px` and `line-height: 1.1`, which are exactly the `t-hero` role's, and the plan's own rule says that a local rule which gains a role loses its size and its line height. With both gone the rule had nothing left to declare, and an empty rule nested under `.v` would have been dead weight. The numeral is marked in the MARKUP instead - `class:numeral` next to `class:t-hero={numeral}` - and the guard reads the pair from there."
  - "The value carries its role through class DIRECTIVES, not through a class attribute, because the two roles are mutually exclusive: `.t-stat` (32px) and `.t-hero` (56px) have the same specificity and `.t-stat` is declared LATER in `src/styles/type.css`, so an element carrying both would paint at 32px. The markup writes `class:t-stat={!numeral} class:t-hero={numeral}`, and exactly one of them is ever on the element."
  - "The forced-colors block's `.star path` and `.star.on path` were nested under the `.star` in the SAME block, with the top-level ones. G6b's siblings are the rules of one scope, and the rules inside an at-rule form one scope of their own, so the block's own `.star` is the parent these two extend. The flattened selectors and their specificity are unchanged (`.star path` and `.star.on path`), so the compiled CSS paints the same."
  - "The Overview's four-size set is a LOCAL constant of the guard, not the shared `OVERVIEW_SCALE_PX`. The plan says so, and the reason holds: the shared set is the app's scale and the Overview has its own (D-15), so a guard that checked the Overview against the wider set would pass a size the Overview never uses. The shared export stays for the e2e spec, which measures the Overview page against BOTH scales, and plan 14-21 removes it."
  - "The phase-8 colour allow-list is now EMPTY, and the guard's own stale-entry check is what emptied it: the tile's shadows were the last `rgba(` entry and they had exactly one file. The entry went WHOLE, the way 14-18 deleted its three status entries, and the sweep stayed - a rule that is switched off is not a rule that is satisfied."
  - "The type sweep reads the ROLES as well as the declarations, and requires a non-empty match on BOTH halves. The tile declares no `font-size` at all any more, so a reader that only looked for `font-size: Npx` would find nothing in it and assert nothing. The sweep now collects every resolved declaration AND every `t-*` role the markup applies, resolves the role through `src/styles/type.css` and `src/styles/tokens.css`, and checks every size it finds against the Overview's own set."

patterns-established:
  - "When a local rule's every declaration moves into a role, the rule goes - do not nest an empty one. The markup's class directive is the marker that survives, and a guard can read the marker."
  - "A pixel compare needs its two sides captured by the SAME browser. A baseline captured days earlier can drift under the app because the BROWSER's rasterisation changed, not the code: the stored baseline set of plan 14-01 and a fresh capture of the SAME commit differ by one unit in the tile's shadow gradient at the two narrow widths, while the four widths' PNG sizes are equal. Capture the baseline again, or the compare measures the browser."

requirements-completed: [D-01, D-02, D-03, D-05, D-07, D-09, D-15, D-16]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "The Overview tile is on the token layer and the shared type roles: no rgba(), the five roles are exact matches, the spacing reads the space and layout tokens, and the file is off PENDING_FILES."
    verification:
      - kind: unit
        ref: "pnpm exec vitest run tests/unit/overview tests/unit/guards tests/unit/charts - 50 files, 1234 tests, all pass (the plan's verify)"
        status: pass
      - kind: unit
        ref: "pnpm run test:unit - 164 files, 4901 passed, 9 expected fail, 0 failed"
        status: pass
      - kind: unit
        ref: "pnpm run lint - prettier --check . && eslint ., exit 0"
        status: pass
      - kind: unit
        ref: "pnpm run check - tsc -b && svelte-check, 0 errors and 0 warnings"
        status: pass
      - kind: unit
        ref: "pnpm run build - vite build, exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The three tile shadows are the shared elevation tokens and compute to the same channels and alpha as the rgba() literals they replace."
    verification:
      - kind: unit
        ref: "tests/unit/overview/overview-components-guard.test.ts - 'the tile casts no colour function: its three shadows read the elevation tokens' - asserts the three box-shadow values and the three token values"
        status: pass
      - kind: other
        ref: "the scratch byte compare of the Overview root at 1040, 880, 479 and 340px - 4/4 pairs byte-equal against the pre-phase build of 901a9e1 and 4/4 against the plan's starting commit"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Overview is UNCHANGED: the tile's pixels are identical to the pre-phase build's."
    verification:
      - kind: other
        ref: "compare-labelled-14-19.mjs --before baseline-now-14-19 --after after-14-19-final --mask-title - 4/4 pairs BYTE-EQUAL, equal PNG sizes at every width"
        status: pass
      - kind: e2e
        ref: "playwright tests/e2e/shell/overview-insights.spec.ts overview-insights-gaps.spec.ts master-detail-nav.spec.ts touch-targets.spec.ts - 26 passed, 48.1s"
        status: pass
    human_judgment: false

# Metrics
duration: 38min
completed: 2026-10-28
status: complete
---

# Phase 14 Plan 19: the Overview tile on the shared tokens and roles, pixel-identical

**The Overview tile reads the shared tokens, the shared type roles and the shared elevation tokens, and it looks exactly as it did before: 4 of 4 Overview captures byte-equal against the pre-phase build.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-10-27T20:37:00Z
- **Completed:** 2026-10-27T21:15:00Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- The tile's type is the shared type. `.k` and the two `.heading` paragraphs take `.t-label`, `.v` takes `.t-stat`, the large numeral takes `.t-hero` instead, `.unit`, `.how` and `.link` take `.t-body`, and `.rule` and `.reads` take `.t-caption`. Every one of those roles is an EXACT match for the triple it replaces, so every local `font-size`, `font-weight` and `line-height` could be deleted and the pixels did not move.
- The three shadows are the shared elevation tokens. `--elev-rest`, `--elev-hover` and `--elev-open` are `color-mix(in srgb, var(--ink) N%, transparent)`, which compute to `rgba(17, 17, 17, 0.05 / 0.08 / 0.1)` — the same channels and the same alpha — and the phase-8 colour allow-list is now empty because the tile was its last entry.
- The spacing is the shared scale. The label's right padding reads `var(--layout-section)` (the one 32px), and the face's padding, the dot's margin, the figure's gap and margins, the panel's margin and padding and the three paragraph margins read the space tokens. Every one of them was already on the scale, so every one of them is the same number by a name.
- The Overview is unchanged, and that is proved rather than asserted: the scratch byte compare of the Overview root against a fresh capture of the pre-phase build `901a9e1` reports equal PNG sizes and **0 differing pixels** at 1040, 880, 479 and 340px with the title box masked, and the same compare against the plan's own starting commit is 4/4 byte-equal too.
- The guard reads the new form. `overview-components-guard.test.ts` finds a rule by selector (`ruleDeclarations`), resolves its tokens (`resolveTokens`), reads a role's size from `src/styles/type.css` through `src/styles/tokens.css`, and sweeps BOTH ways a size reaches the Overview: the declarations and the roles the markup applies. It requires a non-empty match on both halves, and it checks every size against the Overview's OWN four-size set, now a local constant of the test.

## Task Commits

Each task was committed atomically:

1. **Task 1: the Overview tile takes the shared tokens, the exact-match roles and the elevation tokens** - `cfeb228` (refactor)

**Plan metadata:** `14-19-SUMMARY.md` (docs: complete plan)

## Files Created/Modified

- `src/styles/tokens.css` - the three elevation tokens, next to the radius scale they belong with
- `src/lib/features/overview/OverviewTile.svelte` - the roles in the markup, the tokens in the rules, the G6b nesting
- `tests/unit/overview/overview-components-guard.test.ts` - the token-aware, role-aware reader and the Overview's local four-size set
- `tests/unit/guards/phase8-ui-review-guards.test.ts` - the colour allow-list, now empty
- `tests/helpers/migration.ts` - the tile off `PENDING_FILES`

## Decisions Made

- **The `.v.numeral` rule was deleted, not nested.** Its two declarations were exactly the Hero role's, and the plan says a local rule that gains a role loses its size and its line height; with both gone the rule had nothing left to say. The numeral stays marked in the markup (`class:numeral` beside `class:t-hero={numeral}`), which is where the guard reads it from.
- **The value's role is applied by class directive, not by a class attribute.** `.t-stat` and `.t-hero` have the same specificity and `.t-stat` is declared later in `type.css`, so an element carrying both would paint at 32px. `class:t-stat={!numeral} class:t-hero={numeral}` puts exactly one of them on the element.
- **The forced-colors block's star rules were nested with the top-level ones.** G6b's siblings are the rules of one scope, and the rules inside an at-rule make a scope of their own, so the block's own `.star` is the parent the block's `.star path` and `.star.on path` extend. The flattened selectors and their specificity are unchanged.
- **The Overview's four-size set is a local constant of the guard.** The shared `OVERVIEW_SCALE_PX` stays for the e2e spec, which measures the Overview page against both scales; plan 14-21 removes it.

## Deviations from Plan

### Auto-fixed Issues

**1. [G6b - nesting] The forced-colors block's `.star path` and `.star.on path` were nested too**
- **Found during:** Task 1 (the tile's rules)
- **Issue:** The plan's action names four nests (`.star svg`, `.star path`, `.star.on path`, `.v.numeral`, `.heading:first-child`, `.link:focus-visible`) and says the `@media` blocks stay as they are. But G6b counts the rules INSIDE an at-rule as siblings of one another, and the forced-colors block holds its own `.star`, `.star path` and `.star.on path` — so the block's two star rules were G6b offences in their own right, and the guard's sweep found them.
- **Fix:** The block's `.star path` and `.star.on path` were nested under the block's `.star` as `& path` and `&.on path`. The flat selectors are the same (`.star path`, `.star.on path`) and the specificity is the same, so the compiled CSS paints the same; the block's meaning is untouched.
- **Files modified:** `src/lib/features/overview/OverviewTile.svelte`
- **Verification:** `node check-offenders-14-19.mjs` — 0 offenders; `pnpm exec vitest run tests/unit/guards` — the nesting guard compiles the file and reports no unused selector.
- **Committed in:** `cfeb228` (part of the task commit)

**2. [Plan action - literal] `.v.numeral` was deleted rather than nested as `&.numeral`**
- **Found during:** Task 1 (the tile's rules)
- **Issue:** The plan's action says to nest `.v.numeral` as `&.numeral` under `.v`, and separately says that a local rule which gains a role loses its size and its line height. The two statements meet on this rule: its two declarations were `font-size: 56px` and `line-height: 1.1`, which are exactly `.t-hero`'s, so after the role adoption it had nothing left to declare. An empty nested rule would also have been a `css_unused_selector` risk.
- **Fix:** The rule was deleted. The numeral is marked in the markup instead, and the guard reads the marker.
- **Files modified:** `src/lib/features/overview/OverviewTile.svelte`, `tests/unit/overview/overview-components-guard.test.ts`
- **Verification:** the Svelte compiler reports zero warnings for the file; the pixel compare is 4/4 byte-equal.
- **Committed in:** `cfeb228` (part of the task commit)

---

**Total deviations:** 2 auto-fixed (1 nesting, 1 plan-literal)
**Impact on plan:** Both are the plan's own rules applied to the two places the plan's enumeration did not reach. No scope creep, and the pixels are unchanged.

## Issues Encountered

- **The stored pre-phase baseline set is stale, and the drift is the BROWSER's.** The plan's precondition points at the `before` set plan 14-01 captured on 2026-10-26. Comparing that stored set against a capture of the plan's starting commit shows differences at the two narrow widths (4239 differing pixels at 340px and 6185 at 479px) — and the differences are a single unit in the tile's shadow gradient, with the four widths' PNG sizes equal. The cause is not the code: re-capturing the SAME baseline commit `901a9e1` today reproduces exactly those differences, so the browser's box-shadow rasterisation changed between the two captures, while the fresh baseline capture and the fresh capture of the plan's starting commit are byte-equal at all four widths. The pre-phase baseline was therefore re-captured today, from the `baseline` worktree that was already on disk, and the compare was run against that. The shared `before`/`after` sets were left exactly as they were found, as plans 14-16, 14-17 and 14-18 did.
- **The `baseline` worktree's `node_modules` is broken** (a `rolldown/parseAst` module is missing), so `vite preview` cannot run there. Its committed `dist` was served read-only with `python3 -m http.server` instead; the worktree was not rebuilt and not modified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 14-20 (the remaining Overview components, the pixel gate and the committed D-15 result).

- The tile is migrated and the Overview is untouched, so plan 14-20 (the other four Overview components) starts from a component whose pixels are already proved identical.
- **Plan 14-20 and plan 14-21 must capture their own labelled pair** and must not read the shared `before` set as if it were current: it predates a browser change and carries the shadow drift described above. Plan 14-20 owns the `Result` section of `14-OVERVIEW-PIXEL-EVIDENCE.md`; the `Baseline` section still describes the 2026-10-26 set, which is the historical record and is not what this plan compared against.
- **Open item, reported not edited:** `tests/helpers/components.ts:63` says "Two readers still import it" for `OVERVIEW_SCALE_PX`. After this plan only the e2e spec imports it — the Overview guard owns a local set now. The file is in no plan's `files_modified` list; plan 14-21 removes the export anyway.
- **Open items carried in, still open and still not edited:** `tests/e2e/_support/helpers.ts:541` (says the stat tile numerals are 30px), `tests/e2e/shell/master-detail-nav.spec.ts:72` (names the retired 30), `src/lib/features/logins/map-model.ts:36` (still says "ramp" in prose).
- **Open item from 14-14, still with the owner:** the neutral `.info` box border is still `var(--border)` rather than `var(--faint)`. Not touched here.

---

*Phase: 14-design-unification*
*Completed: 2026-10-28*
