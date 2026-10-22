---
sketch: 022
name: overview-insights
question: "How should the Overview tell the player's story (time, favourite tank, records, habits) inside the Q2 master-detail shell?"
winner: null
tags: [overview, insights, hall-of-fame, master-detail]
---

# Sketch 022: Overview insights

## Design Question
The Overview is a grid of count cards today. Which structure best presents computed personal insights
(spikes 001-003) in the chosen Q2 light style, at desktop and phone width, with every figure showing its rule?

## How to View
Plain file (scripts need a real page, not a static snapshot):
open .planning/sketches/022-overview-insights/index.html
or with the dev server running: http://localhost:5173/.planning/sketches/022-overview-insights/index.html

## Variants
- **A: Your story (chapters)** - six vertical chapters (Time, Favourite tank, Style, Habits, Records, Explore), one hero number + one sentence + one small chart + rule line each; chapter chips jump within the page; every chapter links into its detail tab.
- **B: Hall of Fame bento** - a tile grid led by a big time tile; records, streak, session, totals as peers. A "preview data state" switch (full 2026 / old 2021 / almost empty) shows absent sources turning into dashed "not in this export" tiles, never a zero.
- **C: Player dossier** - identity header ("Player since 2013") with rule-based labels, a ledger of figures each with a "why" line, a main-tank plate, personal-best bars, and a "Save card as image" action that excludes nickname/id/IP/email.

All three: game switcher (WoT active, Blitz/Warships numbers stubbed) so the structure stays game-agnostic; real numbers from spike 003 (aggregates of the maintainer's own export); tank names/classes from spike 001's table; Viewport buttons (bottom right) switch Phone/Tablet/Desktop; the list pane hides under 760px (phone = list screen then detail).

## What to Look For
- Hierarchy: does one hero per screen read better than 14 equal tiles (A vs B)?
- Is the rule line under each number helpful or noisy? (A shows it per chart, B per tile, C per ledger row.)
- Missing data: B's dashed tiles vs hiding the chapter/tile entirely.
- Which one still works when only sessions exist (try B's "Almost empty")?
- Phone width: A scrolls naturally; B collapses to one column; C stacks.
- Is "Save card" (C) wanted at all, given the privacy-first positioning?
