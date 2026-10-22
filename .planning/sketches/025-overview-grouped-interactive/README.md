---
sketch: 025
name: overview-grouped-interactive
question: "How do we combine B1 (grouped bento) with B3 (interactive: pin, details on demand)?"
winner: null
tags: [overview, bento, grouped, interactive, a11y]
---

# Sketch 025: Grouped + interactive bento

## Research applied (web search, Oct 2026)
- Tile size = priority, only 3 sizes (hero 2x2, feature 2x1, metric 1x1), hero top-left, reorder by importance on mobile, ~12-16px gaps, tab order = reading order (bento-grid guides).
- Summary visible, detail on demand through expandable cards / drill-down; calm default, whitespace; big number + context (KPI-card guides).
- Non-modal inspector: no focus trap, Esc closes, focus returns to the trigger, labelled complementary region instead of a dialog (drawer a11y docs; inference for the non-modal case).
- Profile pattern: identity header + category tabs; stats organised by mode (game profile UI guides).

## How to View
`node .planning/sketches/_shared/gen-data.mjs` once, then open `.planning/sketches/025-overview-grouped-interactive/index.html`
(or http://localhost:5173/.planning/sketches/025-overview-grouped-interactive/index.html).

## Variants
- **G1: Groups + inspector panel** - four collapsible groups (Time, Tanks, Records, Money), 3 tile sizes, select a tile to open a non-modal inspector (side panel; above the grid when narrow). Arrow keys move between tiles, Esc closes and returns focus.
- **G2: Pinned row + expand in place** - a "Pinned" group on top (pins kept on this device, localStorage guarded), then the groups; a tile expands to full width in place with how-it-is-computed and source, no panel.
- **G3: Identity header + chapter tabs** - "Player since 2013" with rule-based chips, four always-visible headline numbers, ARIA tabs (Highlights, Time, Tanks, Records, Money, arrow keys), selecting a tile opens the details as a sticky bottom sheet on phone / side panel on desktop.

## What to Look For
- G1 vs G2: where should "how it is computed" live: separate panel or inline expansion?
- Are collapsible groups useful or just extra clicks?
- Is pinning worth shipping (needs persistence) or is G1/G3 enough without it?
- G3: do the identity chips and always-visible numbers make a better first five seconds than a bare grid?
