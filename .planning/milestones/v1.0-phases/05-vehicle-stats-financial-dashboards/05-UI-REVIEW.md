---
phase: "5"
slug: "vehicle-stats-financial-dashboards"
status: complete
baseline: "05-UI-SPEC.md incl. Amendments 05-08, 05-21, 05-22"
audited: "2026-10-03"
---

# Phase 5 — UI Review (re-audit after gap-closure plans 05-20/21/22)

**Audited:** 2026-10-03
**Baseline:** `05-UI-SPEC.md` with its dated amendments appendices (which supersede the original text where stated)
**Screenshots:** captured. A fresh build was served on a free port, a synthetic export (`buildSampleExport()`) was imported through `file-input`, and Chromium was measured at 1280 and 375. Captures are in the scratchpad, outside the repo. Real-archive captures taken after the fixes were also viewed; nothing from them is recorded here.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false). Geometry and computed styles were read from the live DOM. No post-interaction state is claimed.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Contract strings intact; no copy regressions; the battle-type scroll region reuses the existing heading as its name |
| 2. Visuals | 3/4 | Controls are a row (fixed). The five-month premium chart is still 140px in a 686px card; a heading colour mismatch remains |
| 3. Color | 3/4 | Chart zero line `#5f6368` and hairlines `#dadce0` confirmed live (fixed). Minor token drift remains (h4 and nation tag) |
| 4. Typography | 3/4 | 0 text nodes under 14px at 1280 and 375 (fixed). The `.count` line is still weight 600 where Caption is 400 |
| 5. Spacing | 3/4 | Battle-type table now scrolls inside its card at 375. The card, the page and the controls row all measure correctly. Off-scale 6px/20px values remain unchecked |
| 6. Experience Design | 3/4 | State coverage is strong; touch scroll affordance is still missing (deferred to Phase 7, WARNING) |

**Overall: 19/24** (previous 15/24, which was a stale pre-fix score). No pillar is a 1 or a BLOCKER. Scores were not averaged up: the three 3s in Visuals, Color and Typography each carry a residual finding below.

---

## Prior findings, re-measured live

| Prior finding | Status | Evidence (synthetic export) |
|---|---|---|
| `.controls` was a 215px column | **FIXED** | `flex-direction: row`. At 1280 the container is 63px tall and its three children sit on one row. At 375 it wraps to two rows (139px), as the contract allows. |
| Sub-14px text (36 nodes at 1440, 37 at 375) | **FIXED** | A text-node walk finds 0 nodes under 14px at both widths. The 13px phone media query is gone. |
| Battle-type table overflowed its card at 375 | **FIXED** | The table sits in a `role="region"` scroller with `overflow-x: auto`. The table is 327px wide inside a 293px container, so it scrolls inside the card. Page scrollWidth is 375/375, and the card right edge is 334. |
| Zero line `rgb(218,220,224)`, hairline `#e8eaed` | **FIXED** | Zero line and ticks compute to `rgb(95,99,104)` (`#5f6368`). Hairlines compute to `rgb(218,220,224)` (`#dadce0`). Confirmed on the premium chart and both currency charts. |
| Currency chart widths unequal | **FIXED within the amended contract** | Synthetic charts are 540px and 476px (both whole-pixel pitch, so near-equal not equal, as 05-22 item 3 states). The real-archive capture shows the currency charts filling about the same width, with the premium chart separate. |
| Currency plot split 80/80 | **FIXED** | In the real-archive capture, deposit-heavy currencies spend their height above the line, with a short lower band and the lower label adjacent to it. One scale is used above and below. |
| Premium chart 140px in a 686px card | **REMAINS (WARNING)** | 05-21 explicitly left it. Pitch is capped at 16 and the axis is five months, so the plot is about 20% of the card. Intentional but a visible emptiness. |
| h4 colour `#3c4043` on Player_statistics vs `#08060d` | **REMAINS (WARNING)** | Computed h4 colours are still two values: `rgb(8,6,13)` and `rgb(60,64,67)`. |
| `.count` weight 600 vs Caption 400 | **REMAINS (WARNING)** | Computed font-weight is 600. |
| Nation tag `#5f6368` vs contract `#3c4043` | **REMAINS (WARNING, minor)** | Computed `rgb(95,99,104)`. This is 6.05:1, still passing contrast. |
| Tab order reaches the vehicle scroller before the sort buttons | **Not re-run** | Unchanged in code; recorded as defensible. |

**Regressions found:** none. Page-level overflow is 0 at 1280 and 375. The vehicle scroller is 684/684 at 1280 and 633/291 at 375 (intended internal scroll). The controls children bottom edges differ by 5px on desktop (two controls end at the same y; the search input block starts 5px higher because its label height differs). This is a minor alignment note, not a contract breach.

**New issues:**
- Real phone capture: the battle-type table's "Damage dealt" column and the vehicle table's "Win rate" column are cut off at the scroller edge with no fade or hint (the same affordance gap as before, now inside correct scrollers). WARNING, Phase 7.
- In the real-archive phone capture the sticky nav appears across the middle of the page. This is a capture artifact of a full-page screenshot, not a defect; the nav's clipping at 375 is Phase 3.

---

## Top 3 Priority Fixes

None is a BLOCKER. Ordered by user impact:

1. **Touch scroll affordance on the phone scrollers (WARNING, deferred to Phase 7)** — the battle-type, vehicle, hour-grid, calendar and chart scrollers are 1.1x to 2x wider than the 293px content box at 375, and the only hint is keyboard copy. Fix: edge fade or "scroll for more" text, plus touch tooltip handling.
2. **Premium chart is 140px in a 686px card** — `MonthlyBarChart` caps pitch at 16, so short histories leave about 80% of the card empty. Fix: a left-aligned chart is acceptable, so add a short explanatory line, or amend the cap for axes of 12 months or fewer.
3. **Token drift in three places** — `.count` weight 600 (`PlayerStats.svelte`), h4 `#3c4043` on Player_statistics headings, nation tag `#5f6368` (`VehicleTable.svelte`). Fix: weight 400, `#08060d`, `#3c4043`, or amend the spec to ratify the shipped values.

Deferred and rated WARNING only: touch scroll affordance and touch tooltip (Phase 7); nav clipping at phone width (Phase 3); 31 interactive elements under 44px at desktop and 30 at 375 (Phase 7).

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- No copy file changed except reuse of `BATTLE_TYPE_SUMMARY_HEADING` as the scroll region's accessible name. No new strings were added, and no generic labels appear.
- Residual gap (not scored down): the table hint is keyboard-only copy.

### Pillar 2: Visuals (3/4)
- Controls render as a single row at 1280 and wrap at 375, which restores the intended hierarchy; dead height above the data is gone.
- Spend headline remains the focal point. Real-archive financial section shows legend, axis labels and bars crisp, with 14px axis text.
- WARNING: premium chart emptiness (above). WARNING: h4 colour split.

### Pillar 3: Color (3/4)
- Chart strokes verified live: `#5f6368` zero line and ticks, `#dadce0` hairlines. A unit test and a browser test now pin them.
- Flow hues, accent reservation and non-colour direction cues are unchanged from the prior audit.
- WARNING: h4 and nation-tag drift.

### Pillar 4: Typography (3/4)
- 0 text nodes under 14px at both widths, guarded by a source scan and a rendered walk (05-20).
- WARNING: `.count` is 600 vs Caption 400. Only declared roles otherwise.

### Pillar 5: Spacing (3/4)
- Controls row: 63px at 1280. Battle-type region fits the card at both widths. The page has no horizontal overflow.
- Bar pitch is whole-pixel (05-22): measured chart widths 540 and 476 are both integer multiples of a whole pitch.
- WARNING: the 5px bottom-edge offset between the search control and its siblings at 1280; off-scale `6px`/`20px` not re-measured this pass.

### Pillar 6: Experience Design (3/4)
- Containment is correct: battle-type region is focusable with an accent focus ring, and page scrollWidth equals viewport at 375.
- WARNING (Phase 7): no touch affordance or touch tooltip.
- Not scored: destructive confirmation and disabled states do not apply to Phase 5.

---

## Files Audited

`05-UI-SPEC.md` (including Amendments 05-08, 05-21, 05-22), `05-20/21/22-SUMMARY.md`, prior `05-UI-REVIEW.md`; `src/lib/components/` PlayerStats, BattleTypeSummary, VehicleTable, MonthlyBarChart, CurrencyBlock, PremiumBlock (via live computed styles); `tests/fixtures/export-fixtures.ts`; real-archive captures (viewed only, nothing recorded).

**Unverified:** scale backstops (5,000 vehicles, 144+ months); Safari/Firefox; real touch device behaviour.
