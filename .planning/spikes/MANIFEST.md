# Spike Manifest

## Ideas

### overview-personal-insights
Replace the card-grid Overview with a personal "your story" page (time in game, favourite tank, Hall of Fame records, habits,
economy) computed from the export. WoT first; layout must later take WoWS / WoT Blitz.

**Requirements:**

- WoT only for now; structure must not hard-code WoT (later WoWS/Blitz).
- Everything computed client-side from the loaded dataset; no network, no new runtime dependency.
- "Time in game" = union of session intervals over ALL account folders ("logged in"); battle time is a separate, labelled figure ("in battle").
- Never sum lifetime per-account stats across two exports of the same player (double count).
- Hall of Fame = records (account MAX/series columns), not medals (ACHIEVEMENTS is empty).
- No mode-mix percentages from the battle-types table (it covers ~5% of battles); battle-type codes stay unlabeled (D-07).
- Tank names/classes come from a build-time table (official WG API, key in `.env.local`, ~19 KB gzip) keyed by tag AND numeric tank_id; retired tanks fall back to the tag-derived name and "class unknown". Terms of Use must be checked before committing the generated table.
- Sensitive items (order amounts, chat text, clan names) default to counts only / hidden.
- Layout: a story of 5-7 chapters with ONE hero stat each (not a grid of equal cards); hide chapters whose data is absent; separate "not in this export" from a true zero.
- Every headline number carries its rule inline (what counts, which period); playful labels (night owl) always show the evidence; celebratory, never judgmental tone.
- Small-sample guard: no "best win rate / average" from under 100 battles per tank (30 for plain rates); pair averages with medians where cheap.
- Never estimate WN8, marks of excellence or mastery (need other players' data); any composite must be labelled an "export-only" figure.
- Animated numbers: final value in the DOM, `prefers-reduced-motion` respected, nothing in `aria-live`. Cards link into the existing detail tabs.
- Bans, money amounts, chat text, clan names: hidden or count-only by default.

## Spikes

| # | Idea | Name | Type | Validates | Verdict | Tags |
|---|------|------|------|-----------|---------|------|
| 001 | overview-personal-insights | vehicle-lookup-table | standard | Given vehicle ids, a static build-time table gives name/class/tier | VALIDATED | lookup, build-time |
| 002 | overview-personal-insights | time-played-definitions | comparison | Sessions vs battle time: one honest headline definition | VALIDATED | playtime, honesty |
| 003 | overview-personal-insights | insight-catalog | standard | Each candidate insight classified with real numbers | VALIDATED | overview, insights |
