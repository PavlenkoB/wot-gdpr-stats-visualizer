---
phase: 12-account-timeline-perks
plan: 12
subsystem: ui
tags: [account-timeline, pane, kind-filter, windowed-table, mask, live-region]
status: complete

requires:
  - phase: 12-05
    provides: "timeline contract, copy constants (TIMELINE_*, formatTimelineShowing, formatMergeNote)"
  - phase: 12-09
    provides: "PerksPane as the pane template; the single-reveal wiring in Dashboard"
  - phase: 12-11
    provides: "the account-timeline channel, TimelineView and the fifth optional pane in the list"
provides:
  - "timeline-state.ts: kindsPresent, showKindFilter, filterEntries, KindChoice, resolveKindFilter, fileStateLines, isWholePaneEmpty, hasMaskableEntries (pure, Node-tested)"
  - "TimelineKindFilter.svelte: native radio chip row, 44px chips, wraps with no component media query"
  - "TimelineTable.svelte: Date / Kind / Entry table, plain up to 500 entries and windowed above, kind badge, account tags, every part through formatNewDataCell"
  - "AccountTimelinePane.svelte: the pane body wired to the account-timeline channel and the shell's single reveal"
  - "Dashboard account-timeline branch (no gameFilter)"
affects: [12-13]

actuals:
  tokens: 15100
  tasks: 3
  commits: 3
commits: 3
plan_head_before: 594b4539f981446935c3599e62245c878cf5a6d0
plan_head_after: a8573f8ea19568760e3e7d16574724a647a82022

tech-stack:
  added: []
  patterns:
    - "A dataset-keyed filter reset as a pure read (resolveKindFilter), the reveal-state rule applied to a pane-local choice"
    - "A single persistent live region outside every state branch, carrying loading, showing and mask announcement text"

key-files:
  created:
    - src/lib/features/account-timeline/timeline-state.ts
    - src/lib/features/account-timeline/TimelineKindFilter.svelte
    - src/lib/features/account-timeline/TimelineTable.svelte
    - src/lib/features/account-timeline/AccountTimelinePane.svelte
    - tests/unit/account-timeline/timeline-state.test.ts
    - tests/unit/account-timeline/timeline-pane.test.ts
  modified:
    - src/lib/shell/Dashboard.svelte
    - tests/helpers/components.ts
    - tests/unit/import/multi-account-keys.test.ts
    - tests/unit/guards/phase8-ui-review-guards.test.ts

key-decisions:
  - "The showing line is one persistent element placed outside the loading/ready/empty branches, so the loading-to-showing change is a text change in an existing live region rather than a fresh insertion"
  - "The About disclosure and the mask block sit inside the not-whole-pane-empty branch, so an all-skipped pane shows the per-file lines only"
  - "Secondary parts are drawn as given (the 12-11 builder already drops null secondaries), each introduced by a middle dot in muted text"

patterns-established:
  - "The features/account-timeline folder is in tests/helpers/components.ts COMPONENT_DIRS, so the keyed-each, contrast, layout and 14px-floor sweeps cover it"
requirements-completed: [TIMELINE-01, TIMELINE-02, PRIV-01, PRIV-02, SCALE-01]
---

# Phase 12 Plan 12: Account timeline pane Summary

**The Account timeline pane is mounted: one newest-first chronology with a pane-local kind chip row, a windowed Date / Kind / Entry table, per-file state lines, and IP parts masked behind the shell's single reveal.**

## What was built

- **Task 1 (e718e62)** - `timeline-state.ts` holds the pane's decisions as pure functions: which kinds have chips (fixed order), whether the chip row shows (two or more kinds), the filter, the stamp-keyed reset (`resolveKindFilter` answers All entries for a stale stamp, an absent kind or a hostile string), the per-file lines, the whole-pane-empty test and the maskable-entry test. 19 Node tests.
- **Task 2 (b7cd89a)** - `TimelineKindFilter.svelte` (GameFilter's pattern: native radios in labels, group named by the visible label through `$props.id()`, 44px chips on the label, no title or aria-label) and `TimelineTable.svelte` (NewDataTable's geometry: CSSOM spacer rows and minimum width, `shouldWindow` / `windowRange`, 40px rows, sticky header and first column; Date cell with account tags flush before the date text, Kind cell with the inert `kind-badge`, Entry cell with the primary part then muted middle-dot secondaries, all through `formatNewDataCell`). No media query, colour, token or transition.
- **Task 3 (a8573f8)** - `AccountTimelinePane.svelte` (Perks' twin: stamped `$state.raw` answer, `acceptDataOutcome`, `deriveFinanceState`, shell-owned reveal, IP-only `MASK_*` copy, About disclosure, merge note, per-file lines), the Dashboard `account-timeline` branch, and the source-shape guard `timeline-pane.test.ts`.

## Test, check, lint, build

`pnpm run test:unit` (133 files, 4124 tests), `pnpm run check` (0 errors, 0 warnings), `pnpm run lint` and `pnpm run build` are green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Component sweep helper did not know the new folder**
- **Found during:** Task 2
- **Issue:** `tests/helpers/components.ts` `COMPONENT_DIRS` lists the folders that hold components; `componentPath` / `listComponentFiles` could not find the new components, so the source-shape guards would read a missing file and the keyed-each, contrast, layout and 14px-floor sweeps would silently skip the new folder.
- **Fix:** added `features/account-timeline` to `COMPONENT_DIRS`.
- **Files modified:** tests/helpers/components.ts
- **Commit:** b7cd89a

**2. [Rule 3 - Blocking] Keyed-each audit and colour-literal guard needed rows for the new components**
- **Found during:** Tasks 2 and 3
- **Issue:** `multi-account-keys.test.ts` requires an AUDITED row for every keyed each, and `phase8-ui-review-guards.test.ts` requires an allow-list entry for the error panel's status colour literals (the Perks precedent). The plan named the audit rows for Task 3; they were added with Task 2 so every commit leaves the suite green, plus the `lineIndex` row for the pane and the `index` row for the chip row.
- **Files modified:** tests/unit/import/multi-account-keys.test.ts, tests/unit/guards/phase8-ui-review-guards.test.ts
- **Commits:** b7cd89a, a8573f8

Otherwise the plan was executed as written.

## Notes for plan 12-13 and the reader

- Rendering is NOT proved here: no Chromium was run. The chip row, the windowed table (DOM node count against the window), the mask (planted IP absent from text and markup until the reveal), the 375px overflow of a 40-character nickname and of seven wrapping chips, and the zero-network assertion are plan 12-13's.
- The Language/Country discriminator match in the 12-11 builder is tolerant (`lang` / `countr`) and still unconfirmed against a real export; open bans store `EXPIRED_AT` as `\N` (not a timeline column, so the pane never draws it).
- Accessibility: the pane owns one explicit `aria-live` (the showing line), asserted across the pane and both children. The error is the fixed `TIMELINE_ERROR` sentence in a `role="alert"`.

## Known Stubs

None. No placeholder data reaches the UI; every part is drawn from the posted view.

## Threat Flags

None. The pane adds no endpoint, storage or attribute surface beyond the plan's threat register (T-12-38 to T-12-41); the source-shape guard enforces the attribute and storage rules.

## Self-Check: PASSED

- Created files present: timeline-state.ts, TimelineKindFilter.svelte, TimelineTable.svelte, AccountTimelinePane.svelte, timeline-state.test.ts, timeline-pane.test.ts.
- Commits e718e62, b7cd89a, a8573f8 are ancestors of HEAD.
