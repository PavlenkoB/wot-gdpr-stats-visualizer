---
phase: 261009-qbo-fix-top-3-phase-08-ui-pass-3-review-issu
plan: 261009-qbo
subsystem: ui
tags: [a11y, live-region, confirm-panel, colour-tokens, guards, disclosure]
requires: [phase-08 A-2 palette tokens, A-3 table note placement]
provides:
  - About this table disclosure for the Login history table hints
  - one persistent polite notice announcer (WR-01)
  - Escape, Tab wrap and post-replace focus on the confirm panel (WR-05)
  - all-of-src colour literal guard with an explicit allow-list (IN-02)
affects: [Login history, import region, confirm panel, 21 component stylesheets]
tech-stack:
  added: []
  patterns: [persistent page-level live region, source-contract allow-list guard]
key-files:
  created: []
  modified:
    - src/App.svelte
    - src/lib/shell/ConfirmPanel.svelte
    - src/lib/shell/ImportBar.svelte
    - src/lib/features/logins/LoginHistory.svelte
    - src/lib/ui-copy.ts
    - tests/unit/guards/phase8-ui-review-guards.test.ts
    - tests/unit/guards/phase8-shell-guards.test.ts
    - .planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md
    - .planning/phases/08-master-detail-ui-redesign/08-REVIEW-DISPOSITION.md
key-decisions:
  - "Status colours allow-listed, not tokenised (the Color table declares roles, not properties)"
  - "Control and panel borders read --faint, not --border, to keep a 3:1 boundary"
  - "City opt-in intro stays visible: it is the consent text for the one sanctioned request"
  - "Both table hints go into one disclosure; one persistent announcer fixes WR-01"
  - "WR-04 closed as already fixed by the A-2 sticky footer and pinned at 1280x600"
requirements-completed: []
duration: ~85 min
completed: 2026-10-09
status: complete
commits: 4
plan_head_before: 9c61371e6e5e8b7da392d479bf697bdc0828ec89
plan_head_after: 16da279ddb658c7b6be57fd84a5300fff037e14e
actuals:
  tokens: 22000
  tasks: 3
  commits: 4
---

# Phase 08 Quick 261009-qbo: Fix top 3 pass-3 UI review issues Summary

One persistent notice announcer, an escapable and trapped confirm panel, an "About this table" disclosure for the Login history hints (city consent text deliberately left visible), and 21 components reading declared colour tokens behind an all-of-src guard with a reasoned, stale-checked allow-list.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 (tracer) | `7909bcd` | `ABOUT_NAME_LOGIN_TABLE`, About this table disclosure, A-4 first two paragraphs |
| 2 | `cedb7f0` | WR-01 announcer, WR-05 Escape/Tab wrap/focus, WR-04 pin, disposition entries |
| 3 | `7e42652` | colour tokens in 21 files, all-of-src guard, widened shell guards, contrast pins, A-4 complete, IN-02 fixed |
| chore | `16da279` | graphify code graph refresh |

All commits carry no co-author trailer and no generation line.

## The nine planner decisions (all proceeded as planned; the requester can override any)

1. Status colours (`#c5221f`, `#fce8e6`, `#8a1c17`, `#f5d4d1`, `#f9ab00`, `#fef7e0`, `#8a5a00`) are allow-listed with a reason and a file list, not tokenised.
2. `#80868b` control and panel borders read `--faint` (3.36:1 on the page), not `--border` (about 1.4:1).
3. State surfaces keep their light-to-dark order: header `--list`, sorted header `--hover`, sort-button hover `--sel`, selected row `--sel`, chips `--chip`, static panels `--list`, hover fills `--hover`, progress track `--track`, row separators `--hover`. The drag-over fill is `color-mix(in srgb, var(--focus) 10%, var(--page))`.
4. White background fills read `--page`; white SVG strokes and the tooltip's white text stay literal and allow-listed.
5. Both table hints (scroll and find) are in one disclosure named by the new constant `ABOUT_NAME_LOGIN_TABLE = 'table'`.
6. The city intro stays visible and outside every disclosure (Phase 6 D-14, D-16, 06-UI-SPEC section 5); pinned by a unit guard and an e2e assertion.
7. WR-01 is fixed with one persistent `role="status"` announcer in `App.svelte`, before the `checking-cache` branch; the bar's `notice-slot` is now only the visible container.
8. WR-04 closed as already fixed by the A-2 sticky footer, pinned at 1280x600 (see re-measurement below).
9. WR-05 keeps `aria-modal` and adds a keydown handler on the panel root only (Escape cancels; Tab/Shift+Tab wrap between the two buttons); no window handler (D-05).

## Task 2 reproduction table (my own measurements on the dev server, before any edit)

| Advisory | Measurement | Verdict |
|----------|-------------|---------|
| WR-01 | notice-slot handle taken before Start over then Delete cached data: `isConnected` false afterwards, cleared acknowledgement not in the old slot; 1 `[aria-live]` on the page | reproduced |
| WR-04 | 1280x600: confirm 422-592 (vh 600), duplicate 374-442, failure banner 332-442; 900x500: confirm 322-492, duplicate 274-342, banner 232-342; 1024x420: confirm 242-412, duplicate 194-262, banner 152-262. All nine cases inViewport true and inPane true | NOT reproduced, so no source change and no fallback (A-2 sticky footer holds them) |
| WR-05 | Escape left the panel open (focus on Cancel); Tab went commit then `ov-open-playtime` then `ov-open-login-history` (left the panel); after a confirmed replace `document.activeElement` was BODY | reproduced (all three) |

My numbers agree with the planning-time baselines, so the conditional WR-04 fallback was not applied.

## Colour literal counts (comments excluded, app.css `--x: #hex;` token declarations exempt)

- Before: 141 literals in 29 files (33 `#dadce0`, 24 `#ffffff`, 19 `#f1f3f4`, 11 `#80868b`, 8 `#f7f7fa`, 1 each of `#202124`, `#fff`, `#e8f0fe`, plus the status set and 4 `rgba(`).
- After: 53 literals in 19 files, every one allow-listed: 9+9+9 (`#c5221f`, `#fce8e6`, `#8a1c17`), 4+4+3 (`#f9ab00`, `#fef7e0`, `#8a5a00`), 1 `#f5d4d1`, 10 `#ffffff` (SVG strokes and tooltip text), 4 `rgba(` (spinner).
- The guard was observed RED naming exactly the 21 mapped files, then green. The widened shell guards were green throughout, as the plan expected.

## Changed expectations (each exists only because of the intended change)

| File | Old | New | Cause |
|------|-----|-----|-------|
| `tests/unit/charts/contrast.test.ts` (frame strokes) | hairline equals the 05 spec hex `#dadce0` | hairline reads `var(--border)`, resolves to the `--border` token, within 4 of 255 per channel of the 05 hex | colour mapping |
| `tests/e2e/finance/finance.spec.ts` (frame) | `HAIRLINE = rgb(218, 220, 224)` | `rgb(220, 220, 220)` (`--border`) | colour mapping |
| `tests/e2e/shell/dashboard.spec.ts` (single-live-region, slim-variant, busy) | the notice slot is the live region, the bar owns one `aria-live` | the announcer is the live region, the bar owns none; page-wide counts of 1, 2, 3 unchanged | WR-01 |
| `tests/e2e/shell/dashboard.spec.ts` (sections-pending) | Login history card holds 2 `details` | 3 `details` (adds `about-login-table`) | Task 1 disclosure |
| `tests/e2e/logins/login-map.spec.ts` (tab order) | Tab from the last sort button lands on the `about-map` summary | first lands on the `about-login-table` summary, then `about-map` | Task 1 disclosure |
| `tests/unit/guards/phase8-shell-guards.test.ts` | legacy-grey and blue tests scanned `src/lib/shell`, blue allowed in ImportBar and Dropzone | scan all of `src`, blue allowed in App.svelte and ImportBar.svelte only | plan (Dropzone carries no blue literal now) |

New assertions were appended to existing tests only: `playwright test --list` still reports 254 tests in 26 files, and the full suite passed (254 passed, `--workers=2`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two e2e expectations broke from the Task 1 disclosure and were not in the plan's file list**
- **Found during:** Task 1 verification (login-map tab order) and Task 2 verification (dashboard sections-pending details count)
- **Issue:** The new `about-login-table` summary is a tab stop and a `details` element, so `login-map.spec.ts` (Tab from the last sort button reaches the map disclosure) and `dashboard.spec.ts` (Login history card holds exactly 2 `details`) were stale by construction.
- **Fix:** One extra Tab press with an `about-login-table` focus assertion; the count became 3 with an `about-login-table` count assertion. The details-count fix landed in the Task 2 commit (`cedb7f0`) rather than Task 1, because the Task 1 verify command did not cover the shell dashboard spec.
- **Files modified:** `tests/e2e/logins/login-map.spec.ts` (commit `7909bcd`), `tests/e2e/shell/dashboard.spec.ts` (commit `cedb7f0`)

**2. [Rule 1 - Bug] svelte-check a11y warning on the confirm panel root**
- **Found during:** Task 2
- **Issue:** `a11y_interactive_supports_focus` fires for an `alertdialog` with a keydown handler and no tabindex.
- **Fix:** One `svelte-ignore a11y_interactive_supports_focus` with a comment (the root owns the dialog's keys but is never focused itself; focus lives on its two buttons). This is the one rule suppression the plan allowed; I suppressed the rule that actually fires.

**3. [Rule 1 - Bug] Hairline tolerance is 4, not 3**
- **Issue:** The plan said within 3 of 255 per channel; `#dadce0` to `#dcdcdc` is 2, 0, 4 on the three channels.
- **Fix:** The contrast test asserts a maximum drift of 4 and says why.

### Not changed on purpose

- `src/lib/ui-copy.ts:2206` still carries an old JSDoc comment naming `#80868b` / `#f1f3f4` / `#3c4043` (a Phase 4 description of the duplicate banner). The plan allows only the one added constant in that file, and the guard strips comments, so it is left alone.

### Observation (not a regression)

- `tests/e2e/shell/chart-fill.spec.ts` ("finance charts fill the detail pane") failed twice in the `tests/e2e/shell tests/e2e/import --workers=2` runs during Task 2 (`finance-tooltip right 367.2 > edge 359.0` at 375px), and passed in every other run: alone with 1 and 2 workers (12 repeats), in the shell directory alone, and in the final full suite. A baseline checkout of the starting commit (`9c61371`, in a throwaway worktree, since removed) passed the same 109-test run, so I cannot prove it pre-existing; it looks like a load-sensitive tooltip-under-the-pointer timing flake, and nothing in this plan touches the finance tooltip. Flagging it for the requester.

## Auth gates

None.

## Known Stubs

None. No placeholder values flow to the UI.

## Threat Flags

None. No new endpoint, auth path, file access or schema. The announcer interpolates plain text only (processing line and two fixed messages), the confirm panel handler is on the panel root, and no `url(`, `@import`, font or script was added.

## Verification (all run at the end of Task 3)

- `pnpm exec prettier --check src tests` clean; `pnpm run test:unit` 86 files, 2646 tests green; `pnpm run check` 0 errors, 0 warnings; `pnpm run lint` clean.
- `pnpm exec playwright test --workers=2` full suite: 254 passed; `--list` reports `Total: 254 tests in 26 files`.
- `package.json` and `pnpm-lock.yaml` untouched; `git diff -U0` on `src/lib/ui-copy.ts` shows only the added blank line and the one constant.
- Visual spot check at 1280x800 on the dev server: Vehicles (table, sorted header, Choose columns), Login history (table, Account record tag, About this table closed under the table, city intro and its button visible) and the list pane with the confirm panel open. No control boundary looked lost.

## Self-Check: PASSED

- Files: `src/App.svelte`, `src/lib/shell/ConfirmPanel.svelte`, `src/lib/features/logins/LoginHistory.svelte`, the guard tests and the two `.planning` phase files all exist and contain the described changes.
- Commits `7909bcd`, `cedb7f0`, `7e42652`, `16da279` are on the branch (`git rev-list --count 9c61371..HEAD` is 4).
