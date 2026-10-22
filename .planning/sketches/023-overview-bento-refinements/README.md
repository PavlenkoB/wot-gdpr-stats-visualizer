---
sketch: 023
name: overview-bento-refinements
question: "Which refinement of the Hall of Fame bento (022-B) is best?"
winner: null
tags: [overview, bento, hall-of-fame]
---

# Sketch 023: Bento refinements

## Design Question
022-B (bento) was liked. Three ways to push it further, all with real numbers (spike 003) and tank names/classes (spike 001).

## How to View
Run `node .planning/sketches/_shared/gen-data.mjs` once, then open `.planning/sketches/023-overview-bento-refinements/index.html`
(or http://localhost:5173/.planning/sketches/023-overview-bento-refinements/index.html). Phone/Tablet/Desktop buttons bottom right.

## Variants
- **B1: Grouped bento** - four labelled groups (Time, Tanks, Records, Money and social), each its own small bento with a clear hero; every tile carries a date or rule line (streak dates, session date, busiest day).
- **B2: Story strip + visual tiles** - one generated sentence on top ("Since 6 May 2015 you have logged 51 days ... 52-day streak in early 2023"), then tiles that each hold a micro-chart: years, hour of day, streak strip, tier mix, class stack, personal-best dots.
- **B3: Interactive** - filter chips (All/Time/Tanks/Records/Money), Comfortable/Compact density, star-to-pin (pinned tiles go first and span 2), and select a tile to open a "how it is computed / reads / open tab" drawer (side panel on desktop, above the grid on phone).

## What to Look For
- B1: does grouping make 15 facts feel calmer, or is it just a longer page?
- B2: does the sentence + micro-charts make it feel personal; is it too busy?
- B3: is the drawer a good home for the rule text (keeps tiles clean) or should the rule stay visible on the tile?
- Pinning and density: wanted features or scope creep?
