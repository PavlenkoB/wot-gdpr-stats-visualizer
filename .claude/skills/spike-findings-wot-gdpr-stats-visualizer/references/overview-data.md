# Overview data

## Requirements

- "Time in game" = union of session intervals over ALL account folders ("logged in"); battle time is a separate, labelled figure ("in battle").
- Never sum lifetime per-account stats across two exports of the same player (double count).
- Hall of Fame = records (account MAX/series columns), not medals (ACHIEVEMENTS is empty).
- No mode-mix percentages from the battle-types table (it covers ~5% of battles); battle-type codes stay unlabeled (D-07).
- Sensitive items (order amounts, chat text, clan names) default to counts only / hidden.
- Small-sample guard: no "best win rate / average" from under 100 battles per tank (30 for plain rates).
- Never estimate WN8, marks of excellence or mastery; any composite is an "export-only" figure.
- Separate "not in this export" from a true zero.

## How to Build It

Sessions (`activity_history/wot_game_sessions.csv`, columns `STARTED_AT`, `FINISHED_AT`):

- Parse both timestamp formats (`dd.mm.yyyy hh:mm` and ISO with `.000`) as wall clock, no timezone (the app's parser already does).
- Drop rows that are unparseable or negative; keep zero-length ones (harmless).
- Sort by start and merge overlapping intervals. Overlap never occurs in the real data (raw sum equals merged), so this is cheap insurance, not a current need. Do the merge across all account folders together.
- Derived: logged-in total, first/last session, distinct days, longest session, busiest day (hours per start day), longest streak (consecutive days), hour-of-day and weekday histograms by start time, hours per year, share between 00:00 and 05:00.

Battle time and totals (`player_statistics/wot_account_statistics.csv`, one row; fall back to summing `wot_vehicle_statistics.csv`):

- `BATTLE_LIFE_TIME` (seconds) equals the sum of per-vehicle `BATTLE_LIFE_TIME_SEC` exactly. Label it "in battle".
- Totals: `BATTLES_COUNT`, `WINS_COUNT`, `DAMAGE_DEALT`, `FRAGS_COUNT`, `DAMAGE_BLOCKED_BY_ARMOR`, `DAMAGE_ASSISTED_RADIO/TRACK`, `TREES_CUT_COUNT`, `XP_AMOUNT`.
- Records: `DAMAGE_MAX`, `XP_MAX`, `FRAGS_MAX` (+ `MAX_*_VEHICLE` numeric tank_id, see vehicle-lookup), series `KILLING_/SNIPER_/PIERCING_/DIEHARD_SERIES_MAX`. `\N` means no value.
- Favourites from `wot_vehicle_statistics.csv`: most-played by battles with share and hours, top 5, favourite nation (prefix of `VEHICLE_NAME`), garage reach, best win rate / average damage only with 100+ battles.
- Economy: `financial_data/virtual_currencies_operations.csv`, sum `AMOUNT` by `CURRENCY_CODE` and `TYPE` (deposit/withdrawal); orders as a count only.
- Social: chat messages, clan history entries as counts only.
- Other games' sessions give a "Wargaming life" strip (WoTB 1.9 d, WoWS 0.3 d, HEAT 0.1 d on the real export).

Real-export reference values (design against these): 51 d logged in (1,234 h, 2015-05-06 to 2026-03-09), 117 d in battle (42%), 13.5 years, longest session 12.8 h, longest streak 52 d, 12,345 battles.

## What to Avoid

- Calling battle time "in game": say "in battle".
- Per-folder comparison of sessions vs battle time: one player's early sessions can sit in an old account folder and the lifetime stats in the new one (account re-numbered); only the totals are consistent.
- A mode-mix chart: `wot_battle_types_statistics.csv` itemises only 1,720 of 12,345 battles (5.4%); the main mode is missing. Show "special-mode battles" with the caveat at most.
- Medal-based Hall of Fame: `ACHIEVEMENTS` is empty in both exports.
- Summing lifetime stats when two exports of the same player (e.g. 2021 and 2026) are loaded together.
- Showing order amounts, chat text or clan names by default.

## Constraints

- Streak, peak hour and busiest day use wall-clock sessions with no timezone; say so inline.
- Data quality on the real export: 0 unparseable, 0 negative, 6 zero-length, 0 over 24 h, longest 13 h.
- 35 insights were classified; all but class/tank-name items are computable from the export alone. Class and record-tank names need the lookup.

## Origin

Synthesized from spikes: 002, 003
Source files available in: sources/002-time-played-definitions/, sources/003-insight-catalog/, sources/_lib/
