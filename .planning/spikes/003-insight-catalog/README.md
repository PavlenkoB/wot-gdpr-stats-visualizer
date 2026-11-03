---
spike: 003
idea: overview-personal-insights
name: insight-catalog
type: standard
validates: "Given a real 2026 export, when every candidate Overview insight is computed from existing columns, then each is classified ready / needs-lookup / blocked, with real numbers to design against"
verdict: VALIDATED
related: [001, 002]
tags: [overview, insights, hall-of-fame]
---

# Spike 003: Insight catalog

## What This Validates
Which "personal story" facts the export can really back, with real numbers, before any layout is drawn.

## How to Run
```bash
node .planning/spikes/003-insight-catalog/run.mjs [path/to/export.zip]   # default ~/Downloads/path/to/export.zip
open .planning/spikes/003-insight-catalog/out.local/catalog.html          # real numbers; gitignored (*.local)
```

## Results (35 insights; groups: Time, Totals, Hall of Fame, Favourites, Modes, Economy, Social, Wargaming life)
Ready from the export alone: days logged in (51 d), years with the game (10.8), longest session (9.3 h), busiest day,
longest streak (52 d), peak hour/weekday, busiest years, days in battle (117 d), battles/damage/frags/XP totals,
damage blocked by armor, trees cut, series records, most-played tank (by battles/share/hours/win rate), top 5, best win
rate and best average damage (100+ battles), favourite nation, garage reach, credits earned, orders count, chat message
count, clan history count, per-game session counts, account-folder count.

Surprises / traps found while computing (each changes the build):
1. **Record tanks are numeric Wargaming `tank_id`s** (`MAX_DAMAGE_VEHICLE=16913`), not `nation:Tag` ids, and do NOT
   appear in the by-type file's `VEHICLE_ID` (a different internal id space). The lookup (001) needs BOTH keys:
   tag (for the vehicle table) and numeric tank_id (for records).
2. **`WOT_Battle_Types_Statistics` covers only 1,720 of 12,345 battles (5.4%).** The big mode (presumably Random) is not
   itemised. A "mode mix" chart would be false. Show "special-mode battles" with the caveat only. Codes stay unlabeled (D-07).
3. **Medals/ACHIEVEMENTS are empty in both exports** — "Hall of Fame" must be records (account MAX columns + series), not medals.
4. Name fallback from the tag is usable but ugly ("ELC EVEN 90", "Chi Nu", "Object252"); class/tier still need 001.
5. Streak, peak hour and "busiest day" use wall-clock sessions (no timezone), same rule as Playtime.
6. Sensitive-by-default: money (orders amounts), chat text, clan names — show counts only, amounts opt-in.

## Investigation Trail
Compute pass 1 → eyeballed against raw columns → mode table did not add up to the battle total → checked by-type file
(61 rows, 1,700 battles) → record vehicle ids looked like numbers → checked by-type VEHICLE_ID (no match) → reworded
catalog statuses.
