# Phase 13 — UI Review (re-audit after the fix pass)

**Audited:** 2026-10-24
**Baseline:** 13-UI-SPEC.md (first audit: 20/24)
**Screenshots:** captured from the built app (`pnpm run build`, preview on 4173) with `buildOverviewInsightExport({ tanks: 'known' })`. Window widths 1440, 1280, 1100, 768, 375 and 340 (full-page). Pane widths were not all the ones the brief names (1040/880/479/340 px); the layouts seen were 4 columns (1440, 1280), 2 columns (1100, 768) and 1 column (375, 340). Column x-positions of the top-five rows were measured with `getBoundingClientRect` at every width. Not captured, graded from code or not at all: loading skeleton, error banner, absent-data rows, the open-tile state, and a chart whose peak is the LAST bar (the fixture has no such chart; its first-bar and mid-chart cases were seen).
**Interaction captures:** off (workflow.ui_interaction_capture is false).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Contract copy intact; "WoT Blitz under 0.1 days" replaces the misleading "0.0 days" |
| 2. Visuals | 3/4 | Records figures now share one line and top-five bars share tracks; the first-bar peak label starts at the bar centre rather than being centred over it, and the time row leaves a three-tile hole |
| 3. Color | 4/4 | Unchanged: tokens only, heat ramp and group dots per contract |
| 4. Typography | 4/4 | Unchanged: 12/14/32/56 px, weights 400 and 600 |
| 5. Spacing | 3/4 | 16px gaps hold at every width and no horizontal overflow; reserved two-line label zone costs about one line of dead space on one-line metrics; orphan tile at 2 columns |
| 6. Experience Design | 3/4 | No new defects seen; loading, error, absent states and the open-tile state were still not verified visually |

**Overall: 21/24 (first audit 20/24, delta +1)**

---

## What changed, verified

1. **Top-five subgrid (verified, fixed).** Measured left/right edges per column in every row. Most-played tank at 1440: name 905.7 to 1197.7, bar 1205.7 to 1348.9, figure 1356.9 to 1383 in all four rows. Class split at 1440: 378.5 to 666.3, 674.3 to 817.5, 825.5 to 855.7 in all three rows. The same holds at 1280, 1100, 768, 375 and 340 (for example 340: 33 to 182.7, 190.7 to 272.9, 280.9 to 307 in every row). Every bar starts at one x and every figure ends at one x, at 4, 2 and 1 columns. In the screenshots the figures 900/410/150/40 right-align cleanly. One oddity: the "Unknown 30%" class row has no bar while "Medium 10%" does. This looks deliberate (unknown is not a class), but nothing on the tile says so.
2. **Records two-line label zone (verified, fixed).** At 1440 "Most damage, one battle" and "Most kills, one battle" wrap to two lines and 6,100, 2,100, 8 and 9 now sit on one baseline (all at the same y in the screenshot). The first audit measured 16.8px of drift. The cost: at 2 and 1 columns, where the labels fit on one line, a one-line metric (Longest streak, Busiest day, Tanks played, Battles at 340) shows about one blank text line between label and figure. It is consistent between sibling tiles, so it reads as spacing rather than a fault, but on the phone, where tiles stack and nothing needs aligning, it is dead space. Acceptable; a container query that drops the reserve once the grid is one column would tighten it (optional).
3. **Peak label over the peak bar (verified for first and mid bar; last bar code-only).** Signature hour at 1440: "21:00" sits directly over the 21:00 bar. Logged in: "13.9 h · 2020" is over the first bar, but its left edge starts at about the bar's centre (x 404 against a bar centre of 408) and the text extends to the right, so it is neither centred on the bar nor flush at the chart edge. It does sit above the peak and reads correctly, which meets the spec's "labelled in text right above it". The last-bar case was not seen; the CSS (`left: peak%` with `translateX(-peak%)`) should flush it to the right edge, which I did not confirm visually.
4. **"under 0.1 days" (verified, fixed).** The Wargaming life strip reads "WoT 0.6 days  WoT Blitz under 0.1 days" at every width.

## Accepted per the spec (not marked down)

The stretched sibling tiles from the first audit (Tanks played and Favourite nation stretching to the height of Favourite class) are the approved bento behaviour: UI-SPEC line 219 sets `align-items: start` only while a tile is open. Accepted. As an optional product choice only: at 1440 those two tiles are roughly half blank (about 90px of empty card), which some would find excessive; no action required.

---

## Top fixes (all optional, no blocker)

1. **Orphan and hole in the Time group (WARNING, minor)** — at 1440 and 1280 the three small tiles (streak, session, busiest day) fill three of four columns and leave a blank quarter; at 2 columns Busiest day sits alone. The spec allows it, but it is the most visible gap left. Fix: let the last tile of a short row span the remaining columns, or accept it.
2. **Peak label anchor on the first bar (WARNING, minor)** — start the label at the chart's left edge when the peak is in the first bar's span, or centre it on the bar and clamp to the edges, so it does not begin at the bar's centre.
3. **One-line metrics at one column (WARNING, minor)** — drop the two-line label reserve when the grid is a single column.

Unverified and still open from the first audit: WR-01 (rapid pin / pending view transition) and IN-04, the loading, error and absent-data states, and keyboard behaviour (roving tabindex, P, Esc).

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
Provenance and hint lines, group headings, rule lines, "Count only. Amounts are never shown here." and "Deposits plus income, as in Finance. Exact figure in Finance." match the contract. The attribution footer has a live "World of Tanks" link. The sub-0.1-day case is fixed. The phone hint line still mentions keyboard keys (P, arrows, Esc), irrelevant on touch; minor. Absent, empty and error copy not exercised.

### Pillar 2: Visuals (3/4)
Clear anchor: Logged in and Most-played tank are the 56px heroes in the Pinned group with a hole-free pair at 1440. Records alignment and top-five alignment are fixed. Residual: peak label start on the first bar, the hole in the Time row, and the closed-state stretched tiles (accepted).

### Pillar 3: Color (4/4)
Colour appears only on group dots, stars, bars and the low-to-peak legend; the peak bar is the darkest. No changes since the first audit. Bars sit on white with no track.

### Pillar 4: Typography (4/4)
Four sizes (12, 14, 32, 56 px) and two weights, as in the first audit; the wrapped record labels did not introduce another size. "12 million" and "Type 64" fit their tiles at every width seen.

### Pillar 5: Spacing (3/4)
16px tile gaps, 24px group gaps at all widths; `scrollWidth - innerWidth` was 0 at 1440, 1280, 1100, 768, 375 and 340. Columns: 4, 4, 2, 2, 1, 1. Remaining: the orphan Busiest day at 2 columns, the 4-column hole in Time, and the one-line dead space noted above.

### Pillar 6: Experience Design (3/4)
No regressions seen; the list-first phone flow ("Sections" back button, then the Overview) works at 375 and 340. The score stays at 3 because the loading, error and absent states, the open-tile state, keyboard interaction and WR-01/IN-04 were not exercised in this pass.

---

## Files Audited
- src/lib/features/overview/OverviewRows.svelte (subgrid at lines 88 to 99)
- src/lib/features/overview/OverviewBars.svelte (peak label, lines 67 to 158)
- src/lib/features/overview/OverviewTile.svelte (label min-height, line 273)
- tests/fixtures/overview-fixtures.ts (`buildOverviewInsightExport`, `{ tanks: 'known' }`)
- 13-UI-SPEC.md, 13-UI-REVIEW.md (first audit), run-data-export-viewer SKILL.md
- Screenshots and measurements from the built app (git-ignored scratch captures)
