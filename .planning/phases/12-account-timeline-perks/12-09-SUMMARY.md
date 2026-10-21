---
phase: 12-account-timeline-perks
plan: 09
subsystem: ui
tags: [svelte, perks, mask, reveal, stamped-answer, source-shape-guard]
status: complete

requires:
  - phase: 12-02
    provides: "the perks channel, PerksView and PERKS_CARD_IDS / PERKS_CARD_FILES"
  - phase: 12-05
    provides: "the Perks copy (intro, titles, mask set, About, loading, error, merge note)"
  - phase: 12-06
    provides: "NewDataCard / NewDataTable severalTags and the code-aware cell formatter"
provides:
  - "PerksPane.svelte: stamped perks answer, one live region, fixed error, merge note, code-aware mask toggle on the shell's single reveal, About disclosure and four ordered cards"
  - "hasMaskableRows: the pure decision whether a pane has anything for the reveal to govern"
  - "The Dashboard perks branch (shell reveal, no game filter)"
affects: [12-10, 12-11, 12-13]

actuals:
  tokens: 6570
  tasks: 2
  commits: 2
commits: 2
plan_head_before: accad7c0694f22f5c7f6e005af2ead30f44e1f40
plan_head_after: 5a7f3581e98fc19c9af4039672564c19b8926178

tech-stack:
  added: []
  patterns:
    - "A pane that masks takes revealed and onRevealChange from the shell and holds no reveal state of its own"
    - "The toggle's presence is a pure function over card status, row count and column kinds, never a cell"

key-files:
  created:
    - src/lib/features/new-data/PerksPane.svelte
    - tests/unit/new-data/perks-pane.test.ts
  modified:
    - src/lib/features/new-data/new-data-state.ts
    - src/lib/shell/Dashboard.svelte
    - tests/unit/new-data/new-data-state.test.ts
    - tests/unit/import/multi-account-keys.test.ts

key-decisions:
  - "The mask block is gated by hasMaskableRows over the coupons and bonus-codes cards only: Subscriptions and Surveys hold no code or address column, so they never make the toggle appear"
  - "The merge note requires both mergedAway > 0 and a non-null tag map, so a single-account dataset renders no note even if a view reported merged rows"
  - "A card whose file is null passes its own title as the file label (a not-in-export card prints no caption)"

patterns-established:
  - "The HEAT pane's address-only canReveal is generalised in new-data-state.ts; the HEAT pane itself was left byte-identical"

requirements-completed: [PERKS-01, PERKS-02, PERKS-03, PRIV-01, PRIV-02, SCALE-01]

duration: 14min
completed: 2026-10-20
---

# Phase 12 Plan 09: Perks pane Summary

**The Perks row now mounts a pane of four ordered cards (Subscriptions, Personal coupons, Bonus codes, Surveys) with codes and the redeeming IP masked behind the shell's one reveal, and a toggle that exists only when something is there to mask.**

## Performance

- **Duration:** 14 min
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `hasMaskableRows(cards)` in `new-data-state.ts`: true only for a ready card with at least one row and a `code` or `address` column; eight unit cases cover every card state and column kind, and a case checks the card is not mutated.
- `PerksPane.svelte`, the HEAT pane's twin: asks `channel: 'perks'`, accepts with the same channel into a stamped `$state.raw` cell (a replace falls back to loading, T-12-30), one explicit `aria-live` (the status line, loading sentence and mask announcements in state words only), a fixed `PERKS_ERROR` in a `role="alert"` (T-12-29), the intro, a merge note (only with rows merged and tags present), the mask block, the About disclosure and one `NewDataCard` per `PERKS_CARD_IDS` entry with `severalTags` on Subscriptions only.
- Dashboard `{:else if active === 'perks'}` branch passes `{revealed}` and `onRevealChange={setRevealed}` and no `gameFilter`.
- Source-shape guard `perks-pane.test.ts` (query and accept channel, stamped cell, no reveal state, one aria-live, alert content, all ten test ids, keyed fixed each, severalTags, gating, PERKS_MASK copy and not the IP-only set, no title/aria-label/cell-bearing attributes, no login-aggregate import, no new token/media query/transition, Dashboard wiring) and an AUDITED row for the pane's keyed each.

## Task Commits

1. **Task 1: The pure maskable-rows decision** - `2f32646` (feat)
2. **Task 2: PerksPane, the Dashboard branch and the guards** - `5a7f358` (feat)

## Deviations from Plan

None - plan executed as written. One test-only refinement: the first draft of the "no title attribute" guard also matched the `title=` prop passed to the `NewDataCard` component (a card heading, not an HTML attribute), so the guard was narrowed to lower-case element tags before the Task 2 commit.

## Verification

- `pnpm exec vitest run tests/unit/new-data tests/unit/shell tests/unit/import/multi-account-keys.test.ts`: 19 files, 943 tests pass.
- `pnpm run check`: 0 errors, 0 warnings. `pnpm run lint`: exit 0. `pnpm run build`: built.
- `git diff -- src/lib/features/new-data/HeatPane.svelte` is empty.
- Rendering is NOT proved here (no DOM in this environment); the mounted pane, the mask behaviour, 375px overflow and the no-value-in-markup scan are for the browser plan 12-13.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or file access; the pane reads the worker's answer through the existing channel-scoped client.

## Self-Check: PASSED

- FOUND: src/lib/features/new-data/PerksPane.svelte
- FOUND: tests/unit/new-data/perks-pane.test.ts
- FOUND commits: 2f32646, 5a7f358
