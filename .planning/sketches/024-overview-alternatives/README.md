---
sketch: 024
name: overview-alternatives
question: "Which fundamentally different Overview concept beats cards/bento: prose, then-vs-now, or a 14-year poster?"
winner: null
tags: [overview, alternatives, prose, calendar]
---

# Sketch 024: Overview alternatives

## Design Question
Three concepts that are not a grid of tiles, all fed by the same real numbers.

## How to View
Run `node .planning/sketches/_shared/gen-data.mjs` once, then open `.planning/sketches/024-overview-alternatives/index.html`
(or http://localhost:5173/.planning/sketches/024-overview-alternatives/index.html).

## Variants
- **D: Sentences (prose + facts)** - a short readable story where each number is a button that expands its rule inline (aria-expanded), plus a compact facts table below. Text-first, accessible, phone-friendly.
- **E: Then vs now (two eras)** - first five years (2013-2017) next to the last five (2022-2026) with deltas: logged hours per year, typical (median) session, evening and weekend share, hour-of-day shape. Only compares what sessions can honestly show; says why tank/win-rate stories are not split by era.
- **F: 14-year poster (calendar)** - one row per year, one cell per week, rank-based teal shades like Playtime; highlight buttons (longest streak, busiest day, longest session, peak year) light up the matching cells and dim the rest. Reuses the existing heatmap idea; aggregated per week.

## What to Look For
- D: does prose feel warm or too wordy? Is expand-to-read-the-rule discoverable?
- E: is the comparison interesting or does it only work for long-time players (needs data in both eras; what to show for a 2-year account)?
- F: does the poster make the story visible at a glance (the 52-day streak around the 2023 account change is obvious)?
- Which of the three could be a single chapter inside a B-style bento?
