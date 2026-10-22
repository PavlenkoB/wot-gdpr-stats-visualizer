---
name: spike-findings-wot-gdpr-stats-visualizer
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building the Overview personal-insights page of wot-gdpr-stats-visualizer. Auto-loaded during implementation work.
---

<context>
## Project: wot-gdpr-stats-visualizer

### overview-personal-insights
Replace the card-grid Overview with a personal "your story" page (time in game, favourite tank, Hall of Fame records, habits, economy) computed from the export. WoT first; layout must later take WoWS / WoT Blitz. Three spikes ran against a real 2026 export (3 account folders, 12,345 battles): the vehicle lookup table, the time-played definitions, and a catalog of 35 candidate insights.

Spike sessions wrapped: 2026-10-22
</context>

<requirements>
## Requirements

### overview-personal-insights
- WoT only for now; structure must not hard-code WoT (later WoWS/Blitz).
- Everything computed client-side from the loaded dataset; no network, no new runtime dependency.
- "Time in game" = union of session intervals over ALL account folders ("logged in"); battle time is a separate, labelled figure ("in battle").
- Never sum lifetime per-account stats across two exports of the same player (double count).
- Hall of Fame = records (account MAX/series columns), not medals (ACHIEVEMENTS is empty).
- No mode-mix percentages from the battle-types table (it covers ~5% of battles); battle-type codes stay unlabeled (D-07).
- Tank names/classes come from a build-time table (official WG API, key in `.env.local`, ~19 KB gzip) keyed by tag AND numeric tank_id; retired tanks fall back to the tag-derived name and "class unknown". Terms of Use must be checked before committing the generated table.
- Sensitive items (order amounts, chat text, clan names) default to counts only / hidden.
- Layout: a story of 5-7 chapters with ONE hero stat each (not a grid of equal cards); hide chapters whose data is absent; separate "not in this export" from a true zero. (The sketches later settled on a grouped bento of tiles instead of chapters; see `sketch-findings-wot-gdpr-stats-visualizer`. The data rules still hold.)
- Every headline number carries its rule inline (what counts, which period); playful labels (night owl) always show the evidence; celebratory, never judgmental tone.
- Small-sample guard: no "best win rate / average" from under 100 battles per tank (30 for plain rates); pair averages with medians where cheap.
- Never estimate WN8, marks of excellence or mastery (need other players' data); any composite must be labelled an "export-only" figure.
- Animated numbers: final value in the DOM, `prefers-reduced-motion` respected, nothing in `aria-live`. Cards link into the existing detail tabs.
- Bans, money amounts, chat text, clan names: hidden or count-only by default.
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Vehicle lookup | references/vehicle-lookup.md | Official WG API gives name/class/tier/nation; 19.2 KB gzip table; 99.8% of battles resolve by tag; record tanks need the numeric tank_id key; retired tanks always miss |
| Overview data | references/overview-data.md | "Logged in" = union of session intervals over all accounts (51 d); "in battle" = BATTLE_LIFE_TIME (117 d); 35 insights classified; medals empty, mode table covers 5.4% of battles |

## Source Files

Original spike scripts and READMEs are preserved in `sources/` (`001-vehicle-lookup-table/`, `002-time-played-definitions/`, `003-insight-catalog/`, `_lib/export-reader.mjs`). Real-data outputs (`out.local/`) are never copied.
</findings_index>

<metadata>
## Processed Spikes

- 001-vehicle-lookup-table
- 002-time-played-definitions
- 003-insight-catalog
</metadata>
