---
sketch: 029
name: overview-no-jump-expand
question: "Keep G2 (pinned tiles + expand in place) but stop the UI from jumping on click. Which approach?"
winner: "R2 (Down, in its column)"
tags: [overview, bento, layout-shift, expand, pinned]
---

# Sketch 029: G2 without the jump

## Result
Winner (2026-10-22): **R2, Smooth expand with "Down, in its column"**. Carried into the final synthesis, sketch 030.

## Why G2 jumped (measured, same real data, 724px pane)
Clicking a one-column tile in the right column of 025-G2: the tile moved 351px left and 123px up in one frame, its width grew by 351px, 9 other tiles moved up to 178px instantly. Causes: (1) the tile spans the full row, so the dense grid reflows around it; (2) the whole grid was re-rendered per click; (3) pinning moved a tile far up the page.

## How to View
`node .planning/sketches/_shared/gen-data.mjs` once, then `open .planning/sketches/029-overview-no-jump-expand/index.html`.

## Variants (measured the same way; px moved by the clicked tile / other tiles)
- **R1: Flip in place** - front and back faces share one grid cell, so the tile never changes size: clicked tile 0, other tiles 0, page height 0. Pinned is a fixed-height shortcut strip (chips), so pinning moves nothing either. Trade-off: every tile reserves room for its longer face.
- **R2: Smooth expand, scroll-anchored** - tiles are never re-rendered; expand/collapse and pin/unpin go through the View Transitions API (CSSOM-set names, CSP-safe) so changes animate instead of snapping, and the page scroll is adjusted so the clicked tile stays under the pointer. A switch chooses "Down, in its column" (clicked tile x/y/width delta 0; it only gets taller, the tiles below shift) or "To full width" (anchored vertically, still slides left, animated). Pinned stays as full tiles at the top (closest to G2).
- **R3: Reserved explain bar** - tiles do not change at all; a sticky bar with a permanently reserved height shows the selected tile's explanation (clicked tile 0, others 0, page height 0). Pinned is the same fixed-height strip as R1.

## What to Look For
- R1: does the flip feel clear, and is the taller metric tile row acceptable?
- R2: is an animated reflow acceptable, or must literally nothing below move? "Down in its column" vs "To full width"?
- R3: is a permanent bottom bar too heavy on phone (132px)? Does separating the number from its explanation hurt?
- Pinned: full tiles on top (R2) vs a fixed shortcut strip (R1/R3)?
- Esc closes the open tile in every variant; focus stays on the control you used.

## Platform notes
View Transitions API (Chrome/Edge, Safari 18+, Firefox recent); the code falls back to an instant (still scroll-anchored) change when it is missing or `prefers-reduced-motion` is set. No library.
