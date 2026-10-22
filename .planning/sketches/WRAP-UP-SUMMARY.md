# Sketch Wrap-Up Summary

**Date:** 2026-10-07
**Sketches processed:** 21 (about 65 variants)
**Design areas:** Layout & navigation, Visual language
**Skill output:** `./.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/`
**Curation:** winner only, no alternatives (chosen by the user)

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 021 | q2-configurator | light + rows + minimal (props off, chips off, heatmap, prev/next off) | Layout & navigation; Visual language |

## Excluded Sketches
| # | Name | Reason |
|---|------|--------|
| 001-020 | exploration rounds | Explored directions; none chosen except via 021. Kept in `.planning/sketches/` for history; not carried into the skill. |

## Design Direction
Q2 master-detail, minimal: light theme, compact rows list (title, headline value, one-line summary) on the left, one section's detail on the right, standard teal heatmaps, j/k keyboard navigation.

## Key Decisions
- Layout: two panes, list 300px + detail; selection is component state (no router).
- Palette: neutral light surfaces; blue primary for chrome only; existing `--ramp-0..5` teal for data.
- Typography: Inter/system; 24px section title, 14px list titles, 30px tile numerals.
- Interaction: j/k move between sections; unavailable sections stay in the list at 45% opacity.
- Dropped after trying: preview cards, big-type list, polar clock, properties panel, KPI chips, Prev/Next, dark and Swiss themes.

## Open Questions
- Phone layout (list-then-detail with back) is only specified, not sketched at 480px.
- Where Finance and "Not yet supported" live in the list.
- Where long explanatory notes go now that the properties panel is off.
- Real app has more sections than the sketch (Account, User_Info).

## Design pass (2026-10-07)
A hi-fi canvas (https://claude.ai/artifact/XM5a7aV2p2XWze9DFi37G3) resolved the phone layout, Finance / "Not yet supported" placement, the explanatory-notes pattern, the extra sections (Account, User_Info) and the empty state, and corrected the palette and font to the app's real tokens. Skill references were rewritten accordingly. Still open for the build: ARIA pattern for the list, e2e budget reconciliation, final drop-target and empty-state copy.

## Final decisions (2026-10-07, after the design pass)
- Layout: Q2 master-detail with an **Overview** landing section (alternative B from the alternatives round).
- Palette: **Day 10, ink + teal (ramp kept)**: white page, neutral ink chrome, existing teal data ramp untouched, selected `#e0e0e0` vs hover `#ececec`, blue only for the focus ring.
- 12 palettes were compared (warm paper, dark graphite, slate, forest, orange, navy+gold, berry, ocean, plum, ink+teal, navy+teal, terracotta); only Day 10 is carried into the skill.
- Not chosen but recorded as candidates: Chart | Table toggle, row previews, hash deep link, derived "Busiest hour / Typical session" stats.

## Overview redesign round (2026-10-22)
**Sketches processed:** 9 (022-030)
**Design area added:** Overview (personal insights) → `references/overview-insights.md`
**Curation:** winner only. 030 carried into `sources/overview-final/`; the hi-fi canvas (https://claude.ai/artifact/BJc6oZ2QEQkphxoKkq1Pa1) is preserved in `sources/design-canvas-overview/` and supersedes the Overview boards of `design-canvas/`.

### Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 029 | overview-no-jump-expand | R2, expand down in its column | Overview (expand behaviour) |
| 030 | overview-final | Final synthesis: grouped bento + pinned tiles + R2 expand | Overview |

### Excluded Sketches
| # | Name | Reason |
|---|------|--------|
| 022-027 | structure, refinement and alternative rounds | Led to grouped bento (B1+B3); history only. |
| 028 | overview-explain-popover | Rejected: user wants expand-in-place, not a popover or sheet. |

### Key Decisions
- Tiles: hero 2×2, feature 2×1, metric 1×1; groups Pinned, Time, Tanks, Records, Totals; 4/2/1 columns by container width (880 / 480).
- Fill rule: only feature tiles widen to fill leftover cells; heroes and metrics never stretch; unfillable holes are accepted.
- Expand: down in its own column, no layout jump (View Transitions, scroll anchoring, 600 ms fallback).
- Colour: group dots and amber pinned stars only; value charts use a green-to-amber heat scale with the peak labelled in text.
- Shadows: lifted (rest, hover, open), hairline borders kept.
- Absent data: one dashed "Not in this export" row per group, never zero.
- Tank names, class and tier come from a build-time table built from the official WG API (Terms of Use check still pending).
- Open for the build: phone two-up adopt-or-not, default pins, dark mode, low-sample/error states, privacy toggle, locale formatting, lighter game switcher.
