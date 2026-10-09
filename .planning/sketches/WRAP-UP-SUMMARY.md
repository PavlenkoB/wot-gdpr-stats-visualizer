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
