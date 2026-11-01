---
phase: 15-tech-debt-cleanup
plan: 06
subsystem: styles
tags: [css, type-roles, shell, identity-header]

requires:
  - phase: 15-tech-debt-cleanup
    provides: note roles (15-01), muted-note rename and ImportSummary variant map (15-05), style-equality harness
provides:
  - "The seven shell components (section shell, exclusion notice, game filter, identity header, import bar, import summary, list pane) carry no local 14px/1.4 pair; each element takes .t-note or .t-note-strong"
  - "The ID-only account demotion is a role swap in markup, not a specificity override"
affects: [15-07, 15-13]

actuals:
  tokens: 11000
  tasks: 2
  commits: 2
plan_head_before: 4f7421737698e26b02a7c9c886464c418ff0aa9d
plan_head_after: 7cabfc33e8e5136993f11a85fc90310597045851

tech-stack:
  added: []
  patterns:
    - "Conditional role in one class attribute: class=\"multi-name {cond ? 't-note-strong id-only' : 't-heading'}\" so exactly one role is ever on an element"
    - "A variant-to-class map carries the role (VARIANT_CLASS banner: 'banner t-note-strong')"

key-files:
  created: []
  modified:
    - "src/lib/shell/DashboardSection.svelte"
    - "src/lib/shell/ExcludedNotice.svelte"
    - "src/lib/shell/GameFilter.svelte"
    - "src/lib/shell/IdentityHeader.svelte"
    - "src/lib/shell/ImportBar.svelte"
    - "src/lib/shell/ImportSummary.svelte"
    - "src/lib/shell/ListPane.svelte"
    - "tests/unit/shell/identity-model.test.ts"
    - "tests/unit/new-data/new-data-panes.test.ts"

key-decisions:
  - "ListPane .kbd-hint takes .t-note: the baseline dump records font-weight 400 in all 14 recorded rows, at every width"
  - "Row title role is chosen with a ternary inside the single class attribute at both templates; the id-only hook class stays for the shared colour/wrap rule"

requirements-completed: []

duration: 25min
completed: 2026-11-01
status: complete
---

# Phase 15 Plan 06: shell chrome on the note roles Summary

**All 16 14px/1.4 rules of the shell chrome are gone from seven components; each styled element carries `.t-note` or `.t-note-strong`, the ID-only identity demotion is a markup role swap (`.t-heading` vs `.t-note-strong`), and the style-equality harness reports 0 differing elements and 0 differing screenshots at all six widths.**

## Accomplishments

- `note-sites --count src`: 101 -> 85 (total), 0 for `src/lib/shell`.
- `DashboardSection`: `.provenance` -> `.t-note`; `.combined`, `.status` -> `.t-note-strong`. The 4px row gap, `flex-basis: 100%` and the flush-adjacency of the caption are untouched; comments now name the roles.
- `ExcludedNotice`: `.pill` -> strong, `.explanation` -> note. `GameFilter`: `.label` and `.chip` (both the "All games" chip and the `{#each}` chips) -> strong.
- `IdentityHeader`: four `<dt>` and both `.account-id` lines -> strong. The row title (two templates) is now `class="multi-name {row.idOnly ? 't-note-strong id-only' : 't-heading'}"` (the `class:id-only` directive is gone); the compound `.account-id, .multi-name.id-only` keeps margin, muted colour, min-width and wrap, and no type. The long comment above it was rewritten around the role swap.
- `ImportBar`: `.imported-at` -> strong. `ImportSummary`: `VARIANT_CLASS.banner` is `'banner t-note-strong'`; `.skip-tag` -> strong (border, padding, colours, display kept).
- `ListPane`: `.product`, `.title`, `.headline` -> strong; `.sub`, `.kbd-hint` -> note.

## Task Commits

1. **Task 1: section shell, exclusion notice, game filter** - `e2087f3` (refactor)
2. **Task 2: identity header, import bar, import summary, list pane** - `7cabfc3` (refactor)

## Verification

- `note-sites src/lib/shell`: 0 offenders; `--count src`: total 85 in 34 files.
- `vitest run tests/unit/shell tests/unit/new-data tests/unit/import/multi-account-keys.test.ts tests/unit/guards ...`: 42 files / 1379 passed.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: clean. `pnpm run build`: OK.
- `playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/shell/master-detail-nav.spec.ts`: 17 passed (ID-only title 14/600/muted, named title 18/600/ink, off-scale sweep).
- `style-equality.mjs check`: 120142 elements and 152 screenshots compared, 0 differing, EQUAL (archives 5, panes 13, widths 375/480/481/899/900/1280).
- `package.json` and `pnpm-lock.yaml` unchanged.
- Full `pnpm run test:unit`: 4898 passed, 1 failed (see Deferred Issues).

## Deviations from Plan

**1. [Rule 1 - Bug] A second reader pinned the removed `class:id-only` directive**
- **Found during:** Task 2
- **Issue:** `identity-model.test.ts` ("the row title takes a conditional ID-only modifier") asserted `class:id-only={row.idOnly}` and matched the h3 on it; the plan listed only the later "row name takes the heading role" test.
- **Fix:** Both tests now assert the role-swap expression on both `<h3>` templates, that two titles and two ID lines exist (non-vacuous), that the ID line takes `.t-note-strong`, that no role is stacked, and that the compound rule keeps `color: var(--muted)` with no `font-size`/`font-weight`/`line-height`. The non-empty `ruleDeclarations` check stays.
- **Commit:** 7cabfc3

**2. [Rule 1 - Bug] Provenance whitespace reader pinned the old one-line `<p>` tag**
- **Found during:** Task 1
- **Issue:** Adding the role pushed the caption `<p ...>` over the Prettier width, so it wraps its attributes; `new-data-panes.test.ts` compared the exact text. Whitespace between attributes is not a text node, so the flush-adjacency (`{#if ...}<p` and `</p>{/if}<span`) is unchanged.
- **Fix:** The expected string follows the reflowed attributes; the test still pins the adjacency and now also the caption's role class.
- **Commit:** e2087f3

## Deferred Issues

- `tests/unit/overview/overview-grid.test.ts` ("sparse flow ... every pin subset") timed out in one full `pnpm run test:unit` run (27 s against the default timeout); it passes alone (19 tests). Same known load-sensitive test as in 15-05; the file is a pure function this plan does not touch.

## Known Stubs

None.

## Threat Flags

None. T-15-12 mitigated (role swap, multi-account e2e, harness EQUAL); no package installed (T-15-SC).

## Self-Check: PASSED

- FOUND commits: `e2087f3`, `7cabfc3`
- FOUND: `src/lib/shell/IdentityHeader.svelte` contains `t-note-strong`
