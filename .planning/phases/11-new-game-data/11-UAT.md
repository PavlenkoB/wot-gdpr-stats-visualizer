---
status: complete
phase: 11-new-game-data
source: [11-VERIFICATION.md]
started: 2026-10-19T20:30:00Z
updated: 2026-10-19T19:37:13.114Z
---

## Current Test

[testing complete]

## Tests

### 1. HEAT pane at 375px
expected: Four cards, no sideways page scroll, addresses masked until the reveal toggle is pressed.
result: pass
note: Driven in headless Chromium at 375x812 against the synthetic three-account new-games export. scrollWidth equals clientWidth (375). Four cards in order, addresses shown as 203.0.113.xxx, toggle data-masked=true. Tables scroll inside their cards.

### 2. Six-chip game filter wraps at 375px
expected: Two lines of at least 44px each, no clipped label.
result: pass
note: Screenshot shows All games, WoT, WoT Blitz on line one and Warships, WoT Console, HEAT on line two; every label is whole.

### 3. Eleven-row phone list screen at 375px
expected: Every row reachable, no clipping, no sideways scroll.
result: pass
note: With both optional panes the list holds 11 rows. It continues below the identity header and the page scrolls vertically; scrollWidth equals clientWidth. The 64px-per-row relaxation of the Phase 8 fold check is accepted, as the UI spec fixes 64px rows.

### 4. 40-character nickname inside an account tag at 375px
expected: The nickname wraps inside the tag phrase without widening the pane.
result: pass
note: Driven in headless Chromium at 375x812 with buildLongTextAccountsExport (40-character nickname, 20-digit root). The nickname wraps onto a second line inside the identity header and the 20-digit Account ID fits on one line. scrollWidth equals clientWidth (375) on the list screen and on Playtime, Login history, Vehicles and Account, with no element past the viewport edge outside a table scroller. Account tags show their letter only; the nickname sits in the tag's accessible label.

### 5. Full e2e suite on CI with one worker
expected: Wall time under the 31 minute globalTimeout.
result: pass
note: Reported by the user: the CI run is green. The 31 minute globalTimeout is enforced by the Playwright config, so a green run finished inside it. The exact wall time was not reported.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
