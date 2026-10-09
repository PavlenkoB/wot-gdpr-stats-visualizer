---
phase: 261009-0qw-fix-top-3-phase-08-ui-re-review-issues
plan: 261009-0qw
subsystem: ui
tags: [svelte, css, playwright, phase-08, ui-review]
requires:
  - phase: 08-master-detail-ui-redesign
    provides: the shell, the list pane, the Login history block and the single-phone-block rule
provides:
  - Account record note directly above the Login history table
  - one phone-width block (src/app.css) carrying every phone rule in the project
  - strict per-key selection-equals-focus assertions on a loaded export
  - ink empty-state heading
affects: [08-UI-SPEC Amendment A-3, 08-UI-REVIEW follow-up]
tech-stack:
  added: []
  patterns:
    - ".shell-prefixed global selectors on a component's own unique hook for phone rules, strictly more specific than the scoped rule they replace"
key-files:
  created: []
  modified:
    - src/lib/features/logins/LoginHistory.svelte
    - src/lib/features/logins/LoginSummary.svelte
    - src/app.css
    - src/lib/shell/ListPane.svelte
    - src/lib/shell/IdentityHeader.svelte
    - src/lib/shell/DashboardSection.svelte
    - src/lib/shell/Overview.svelte
    - src/lib/shell/DetailPane.svelte
    - src/lib/features/playtime/DurationList.svelte
    - src/lib/features/playtime/PlaytimeSummary.svelte
    - tests/unit/logins/login-blocks.test.ts
    - tests/unit/guards/phase8-ui-review-guards.test.ts
    - tests/unit/playtime/playtime-charts.test.ts
    - tests/e2e/logins/login-history.spec.ts
    - tests/e2e/shell/master-detail-nav.spec.ts
    - .planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md
decisions:
  - "Login tiles are correct per Phase 6 D-02; the fix is placement of the existing Account record note, not the arithmetic"
  - "Keyboard lag did not reproduce on a loaded export; strict assertions added, ListPane.svelte unchanged"
  - "Phone rules moved with .shell + unique hook selectors; list-row background is the one deliberate exception"
  - "Empty-state heading is ink; the prompt line stays muted"
  - "Amendment A-3 added to 08-UI-SPEC"
metrics:
  duration: "about 5 hours wall clock (host suspended several times; active work well under 1 hour)"
  completed: 2026-10-09
status: complete
commits: 4
plan_head_before: 07b7ea54ffbb0c7cb2c37ebc0cdeed79a3664a0f
plan_head_after: 4526b9cb59962e20bfd48781ffdce2f48700d467
actuals:
  tokens: 9500
  tasks: 3
  commits: 4
---

# Phase 261009-0qw Plan 261009-0qw: Fix top 3 phase-08 UI re-review issues Summary

One placement fix, one CSS consolidation proven pixel-identical by a before/after snapshot, and strict keyboard assertions that show the reported keyboard lag does not exist on a loaded export.

## Plain statements the requester asked for

- **Issue 3 (keyboard lag) did NOT reproduce.** On a loaded export, after every `j`, `ArrowDown`, `k`, `ArrowUp`, the clamp presses and the eight-press walk, exactly one list row is `aria-current` and it is the focused row. The new strict assertions were green on the first run against the unchanged code. `ListPane.svelte` and `Dashboard.svelte` were not touched. What was done instead: the strict per-key assertions were added to the existing `(keyboard)` test, and the `(empty-state)` test now documents the cause of the review observation (below).
- **Issue 1 (login tiles) is not a computation bug.** `loginTiles` never reads the Account record (Phase 6 D-02) and was not changed. The sentence that labels the Account record row was below the fold; it now sits directly above the table.
- **Issue 2 (nine phone blocks) is fixed**, with zero computed-style or bounding-box differences.

## Task results

| Task | Commit | What |
|------|--------|------|
| 1 (tracer) | 9cd05ee | Account record note moved between the count line and the table. Countries tile asserted equal to the distinct named country cells of the login rows. |
| 2 | 64b2724 | Every phone rule moved into the one `src/app.css` block. Guards added. |
| 3 | 9f59903 | Strict selection-equals-focus assertions, ink empty-state title, UI-SPEC Amendment A-3. |
| chore | 4526b9c | `graphify update .` (graphify-out is tracked). |

## Planner decisions (the requester can override any)

1. **Login tiles: the rule, not a bug.** Keep the counting (Account record excluded from every tile, Phase 6 D-02); move the existing note above the table. Departs from the 06-UI-SPEC "Notes under the table" placement for that one note only (Amendment A-3). Rejected: counting the Account record in the tiles.
2. **Keyboard lag: not reproducible on a loaded export.** The review script waited on `list-pane`, which exists in the empty state, so its first `j` ran before the import landed. With nothing loaded the selection is pinned to Overview by design, then the import reset it to Overview (D-03), and the next ArrowDown stepped from the still-focused row. Follow-up NOT done (outside the three findings): when the first import lands while focus sits on a row other than Overview, selection resets to Overview and focus stays where it was.
3. **Phone-rule mechanism:** `.shell` + the component's unique hook + the original selector, strictly more specific than the scoped rule. Exception: the list-row background is `.pane-list li .row` so hover and selected still beat it. Two new root class tokens (`playtime-summary`, `login-summary`) serve as hooks.
4. **Empty-state heading to ink:** done (removed the `.skeleton-title` muted colour; prompt line stays muted).
5. **One UI-SPEC amendment:** "Amendment A-3 (quick 261009-0qw)".

## Task 1 evidence (root cause of the tile/table report)

- `loginTiles` docstring and `accountCells`: the Account record is excluded on purpose. The existing answer key already expects Countries 2 beside an Account record whose recorded country is PL.
- RED before editing the component: the source-contract test failed (`noteAt 7017 > tableAt 6248`) and the e2e note-above-table assertion failed (note bottom 965 vs scroller top 580); the tile-equals-distinct-cells assertion passed already (the rule was right). GREEN after the one-element move.
- The e2e asserts: the Countries tile equals the number of distinct named country cells of the `login-row` rows; the Account record row has a country cell whose name is not among them, so counting it would be one too many; there is exactly one visible `login-account-note`, above the scroller.

## Task 2 snapshot results

Throwaway scripts in the session scratchpad (not committed): computed style (53 properties) plus bounding rectangle for every element under body, keyed by tag, nth-child path and `data-testid` only (never classes). Viewports 375x812, 480x900, 481x900, 800x900, 1280x800. States: empty; two datasets (the logins hand export, which renders the duration chart, and the sample export) with the list screen at 375 and 480, every one of the eight panes' detail screens at every width; hover (Vehicles), selected and focus-visible (Finance) rows at 375 and 1280.

| Comparison | Files | Keys compared | Differences |
|------------|-------|---------------|-------------|
| dev BEFORE vs dev BEFORE (determinism) | 97 | 32,258 | 0 |
| dev BEFORE vs dev AFTER | 97 | 32,258 | 0 |
| production BEFORE vs production AFTER (same build command, `GEO_FIXTURE=1 vite build`, vite preview on 4180, base `/`) | 97 | 34,973 | 0 |

- Excluded elements: none.
- Negative control: temporarily prefixing the row-background selector with `.shell` made the 375 capture report 25 differences (the selected and hover highlight lost), so the snapshot does detect the specificity flip decision 3 guards against. Reverted.
- The production CSS bundle went from 10 `@media (width<=480px)` blocks to 1.
- Guards (RED first, then GREEN): one phone-width query under `src`, only in `src/app.css`; no comment still says a component repeats the query because a scoped rule outranks the global one. The `playtime-charts` DurationList expectation now asserts the component has no phone query and the app.css block carries the two-line layout.

## Task 3 reproduction table

| Check | Result |
|-------|--------|
| Review script as written (waits on `list-pane`) | Keys land in the empty state: focus moves, `aria-current` stays on Overview, import resets to Overview, next press selects Login history (planning-time reproduction) |
| Same script waiting for the non-skeleton identity header | `aria-current` equals the focused row after every key at 1280x800, 800x900 and 375x812 (planning-time) |
| New strict assertions after j, ArrowDown, k, ArrowUp, both clamps, the 8-press walk and the extra ArrowDown at the end | Green on first run, code unchanged |
| Empty-state heading colour | RED (`rgb(92, 92, 92)`), GREEN (`rgb(17, 17, 17)`) after the one-rule removal |
| First import after a walk to Login history | Selection is Overview (D-03), asserted |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guard size floor and comment-regex whitespace**
- **Found during:** Task 2 RED run
- **Issue:** the plan asked the guard to assert the walk visited "more than 100 files", but `src` has exactly 100 `.svelte`/`.css`/`.ts` files, and the stale-comment pattern missed comments that wrap across lines.
- **Fix:** floor lowered to more than 50 (still non-vacuous); the pattern uses `\s+` between words.
- **Files modified:** tests/unit/guards/phase8-ui-review-guards.test.ts
- **Commit:** 64b2724

### Notes

- **E2E count:** the plan said 239 listed tests in 23 files; `playwright test --list` reports 254 in 26 files, before and after. No `test()` entry was added or removed (diff of `tests/e2e` adds none), so the plan's baseline figure was stale.
- **Overview and DashboardSection** share one combined phone selector list for the identical clip-pattern heading rule, instead of two copies. The declarations are unchanged.

## Verification

Prettier, `pnpm run test:unit` (86 files, 2,627 tests), `pnpm run check` (0 errors) and `pnpm run lint` clean. Full Playwright suite 254 passed. `git diff --stat 07b7ea5 HEAD -- package.json pnpm-lock.yaml src/lib/ui-copy.ts src/lib/features/logins/login-model.ts` prints nothing.

Environment note: the host suspended and ran under load average 20 to 45 during verification. At the default CPU-count worker count several full-suite runs stalled for about 15 minutes on in-flight import tests and hit the global timeout (different tests each time, none related to these changes). `--workers=2` ran the same suite green in 2.7 minutes, and the earlier unloaded run after Task 2 also passed at the default. Two unit tests with timing ceilings failed once under that load and passed on rerun.

## Known Stubs

None.

## Threat Flags

None. No network, auth, storage or parsing surface added; no `url(`, `@import`, font or script; no dependency change.

## Self-Check: PASSED

- Files modified exist and are committed; commits 9cd05ee, 64b2724, 9f59903 and 4526b9c are on `gsd/phase-08-master-detail-ui-redesign`.
- No `Co-Authored-By` trailer or "Generated with" line on any commit.
