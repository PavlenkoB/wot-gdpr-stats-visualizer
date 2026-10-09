# Phase 08 — UI Review (re-audit 3)

**Audited:** 2026-10-09
**Baseline:** 08-UI-SPEC.md (including Amendments A-1, A-2, A-3)
**Screenshots:** captured (1280x800, 800x900, 375x812). Empty state and loaded Overview at all three widths; Login history at 1280x800. Captures in `.planning/ui-reviews/08-r2-20261009-163101/` (git-ignored). Phone detail screen was not re-captured in this pass.
**Import:** sample export built from `tests/fixtures/export-fixtures.ts` `buildSampleExport()`, loaded through `[data-testid=file-input]`, and the identity header waited on without the skeleton variant before keys were sent.
**Computed-style sweep:** font sizes on visible text: 14, 18, 26, 30px only (1280 and 800: 14/26/30; 375: 14/18). Text colours: `rgb(17,17,17)`, `rgb(58,58,58)`, `rgb(92,92,92)`. One `rgb(0,0,0)` text node appeared on the empty-state drop target at 1280x800 and was not traced to source.
**Horizontal overflow:** 0px at 375, 800 and 1280 on empty and loaded views.
**Keyboard:** scripted j, j, k, ArrowDown, ArrowUp on a loaded export at 1280x800. `aria-current` equalled the focused row after every key.
**Interaction captures:** off (workflow.ui_interaction_capture is false). Keyboard result is from a scripted key sequence outside the capture driver.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Login history carries a 139-character support paragraph in the main flow, not in an "About this chart" disclosure (UI-SPEC pattern) |
| 2. Visuals | 3/4 | Empty-state heading is now ink (fixed). Overview hierarchy and footer read cleanly at 1280x800 and 375x812 |
| 3. Color | 2/4 | Amendment A-2 says greys are read only through tokens. Source still hard-codes `#dadce0`, `#80868b`, `#f1f3f4`, `#202124`, `#f9ab00`, `#e8f0fe`, `#fce8e6` in about 25 files, including rendered borders |
| 4. Typography | 4/4 | Sizes limited to 14, 18, 26, 30px across all sampled views. Typography fixes hold |
| 5. Spacing | 3/4 | The 480px phone rules are now one block in `src/app.css` (fixed). No horizontal overflow at any sampled width. Spacing scale not swept per element |
| 6. Experience Design | 3/4 | Keyboard selection now follows focus on a loaded export (fixed). WR-01, WR-04 and WR-05 from 08-REVIEW-DISPOSITION.md remain open |

**Overall: 18/24**

Previous review (08-UI-REVIEW, 18/24): Copywriting 3, Visuals 3, Color 3, Typography 4, Spacing 2, Experience 3. Net change: Spacing 2 to 3 (480px split fixed). Color 3 to 2 (the off-token scan was extended from text colours to borders and backgrounds; the A-2 token rule does not hold in source). Total unchanged.

---

## Top 3 Priority Fixes

1. **Off-token greys and warning colours in source** — borders and backgrounds in ConfirmPanel, UnsupportedBlock, Playtime, PlayerStats, CityOptIn, Dropzone, ImportSummary, ExcludedNotice, FailureBanner and the login and finance feature blocks use literals such as `#80868b`, `#dadce0`, `#f1f3f4`, `#202124`, `#f9ab00`, `#e8f0fe`. Users see them as borders and chips, so the 60/30/10 and hairline system drifts from the contract. Fix: map `#dadce0` and `#80868b` to `var(--border)` (or `var(--faint)` only for decoration), `#f1f3f4` to `var(--list)`, `#202124` to `var(--ink)`, `#f9ab00` and `#fef7e0` and `#8a5a00` to the declared warning tokens, `#fce8e6` and `#8a1c17` to a declared destructive tint, and `#e8f0fe` to a `--focus`-derived or `--hover` value. Then add the greys to the existing colour guard so it scans `src` rather than `src/lib/shell`.

2. **Login history support paragraph in the main flow** — "Only the rows on screen are loaded into the page, so your browser's find cannot see the rest..." (139 characters) sits directly under the table, and the city opt-in paragraph (205 characters) sits in the main flow too. Users must read support text before the data. Fix: wrap both in the spec's `About this chart` disclosure (`<details><summary>`, 44px summary height) and keep the Account record note above the table as A-3 requires.

3. **Import notices and ConfirmPanel focus handling (open advisory WR-01, WR-04, WR-05)** — the "Cached data cleared" notice is not announced reliably because the import region is rebuilt between panes (WR-01). At 900px and wider, import notices can sit below the scrolling list pane (WR-04). ConfirmPanel has `aria-modal` but no Escape handling, no focus trap and no focus return after a confirmed replace (WR-05). Fix: keep one persistent polite live region in the shell root, make the import region a single component instance across panes, add Escape and focus return to ConfirmPanel, and add an e2e assertion that focus returns to the trigger after confirm and cancel.

---

## Verified From the Previous Review (08-UI-REVIEW, 18/24)

| Previous finding | Status now | Evidence |
|------------------|-----------|----------|
| Nine components with their own `max-width: 480px` | **Fixed** | `grep` finds one occurrence, `src/app.css:249` |
| Muted empty-state heading "No export loaded" | **Fixed** | Rendered as ink at 26px on desktop (screenshot empty-1280x800) |
| Keyboard selection lags one press | **Fixed on a loaded export** | Scripted j, j, k, ArrowDown, ArrowUp: `aria-current` equals focused row after each press. The earlier lag came from sending keys before the import landed |
| Login tiles "Countries 0" vs table "United States" | **Partly fixed** | Account record note now sits above the table. The tile arithmetic is by Phase 6 D-02. The copy gap is only partly closed because the tiles still show "0" beside the table's country cell and the note is the only bridge |
| Footer clipped at 800px | **Fixed** | Start over and Clear my cached data visible at 1280x800 and 800x900 |
| Off-token text colours (`#3c4043`, `#5f6368`, `#08060d`) | **Fixed for text** | Absent from rendered text. Still present as borders and backgrounds (see Top 3 item 1) |
| 16px and 13.33px text | **Fixed** | Sweep shows 14, 18, 26, 30px only |
| 14px root regressions | **None found** | No overflow at 375, 800 or 1280 |

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Empty state strings render verbatim: "No export loaded", "Drop an export to see this section", "Your data stays in this tab."
- Overview status chips and CTAs follow the singular and plural rules: "6 sections with data", "0 not in this export", "4 folders not yet supported", "Open Playtime →" and so on.
- **WARNING:** Login history paragraph at 139 characters is in the main flow (`LoginHistory.svelte`). Spec pattern is an "About this chart" disclosure.
- **WARNING:** The city opt-in paragraph ("Add the city for each IP address. This downloads a database of about 12 MB from this site...", 205 characters) is in the main flow of Login history.
- **INFO:** The empty state repeats "Drop an export to see this section" on all eight rows. Repetition is intentional per the contract but reads as noise.

### Pillar 2: Visuals (3/4)
- Desktop 1280x800: two-pane layout reads clearly. Identity header anchors the list, the selected Overview row carries the ink bar on `#e0e0e0`, and the 26px section title is the largest text in the pane.
- Overview grid: two columns at 800 and 1280, one column at 375, 16px gaps, 20px card padding. Numerals (30px) and CTAs (underlined ink) read as the focal points.
- Phone list at 375x812: chevrons, 64px rows and the footer "Not yet supported" row are present. The bottom action area (Imported on..., Start over, Clear my cached data) is visible without scrolling.
- Empty-state heading is now ink (fixed).

### Pillar 3: Color (2/4)
- Rendered text colours are on token: ink `rgb(17,17,17)`, body `rgb(58,58,58)`, muted `rgb(92,92,92)`. The warning chip uses the spec's `#8a5a00`.
- **WARNING:** Source contains off-token literals used for borders and backgrounds:
  - `#80868b` border: `ConfirmPanel.svelte:104`, `UnsupportedBlock.svelte:117`, `Playtime.svelte:539`, `PlayerStats.svelte:978, 1005, 1071`, `CityOptIn.svelte:318, 383`
  - `#dadce0`: `MonthlyBarChart.svelte`, `MonthlyDataTable.svelte`, `CurrencyBlock.svelte`, `PremiumBlock.svelte`, `LoginTable.svelte`, `WorldMap.svelte`, `CalendarHeatmap.svelte`, `VehicleTable.svelte` and others
  - `#f1f3f4`, `#202124`, `#f9ab00`, `#e8f0fe`, `#fce8e6`, `#8a1c17`, `#f7f7fa`: `Dropzone.svelte:176`, `FailureBanner.svelte:22-25`, `ExcludedNotice.svelte:97-100`, `ImportSummary.svelte:107-110`, `ConfirmPanel.svelte:81`
- **INFO:** The empty-state drop target text was observed near-black (one `rgb(0,0,0)` text node at 1280x800) and was not traced to a source rule.
- 60/30/10: not measured by pixel. On the Overview at 1280x800 the white page, `#f5f5f5` list pane and ink accents read as the intended split by eye.

### Pillar 4: Typography (4/4)
- Computed sizes on visible text: 14px, 18px, 26px, 30px only. At 375 only 14px and 18px appear, as the phone collapse specifies.
- Font weights were not re-swept in this pass.

### Pillar 5: Spacing (3/4)
- One phone-width block: `src/app.css:249` (`@media (max-width: 480px)`). Previous ten occurrences across nine files are gone.
- No horizontal overflow at 375, 800 or 1280 on either view.
- Spacing values were not swept per element against the 4px scale in this pass.

### Pillar 6: Experience Design (3/4)
- Keyboard: on a loaded export, selection follows focus on every j, k, ArrowDown and ArrowUp press (fixed).
- Click navigation to each section works; the empty state with no export shows the drop target and the "Your data stays in this tab." line.
- **WARNING (open, advisory, from 08-REVIEW-DISPOSITION.md):** WR-01 import notice in a fresh live region; WR-04 import notices below the fold at 900px and wider; WR-05 ConfirmPanel without Escape handling, focus trap or focus return. Not re-tested in this pass beyond the states that render.
- **INFO (open, advisory):** WR-02 modifier keys swallowed by chart key handlers; WR-03 list routing keyed on data-testid; IN-01 to IN-08 unchanged.

---

## Files Audited
- .planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md (including A-1, A-2, A-3)
- .planning/phases/08-master-detail-ui-redesign/08-CONTEXT.md
- .planning/phases/08-master-detail-ui-redesign/08-UI-REVIEW.md (previous review)
- .planning/phases/08-master-detail-ui-redesign/08-REVIEW-DISPOSITION.md
- .planning/quick/261009-0qw-fix-top-3-phase-08-ui-re-review-issues/261009-0qw-SUMMARY.md
- Rendered app at http://localhost:5173 (screenshots, computed-style sweep, scripted keyboard sequence)
- src/app.css (480px block at line 249)
- Grep: `max-width: 480px` (1 occurrence), hex literals across `src` (listed above), `font-size` values (14, 18, 26, 30px only)
- src/lib/features/logins/LoginHistory.svelte (support paragraph)
