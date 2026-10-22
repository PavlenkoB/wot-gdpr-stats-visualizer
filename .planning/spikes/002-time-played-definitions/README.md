---
spike: 002
idea: overview-personal-insights
name: time-played-definitions
type: comparison
validates: "Given the sessions CSVs and BATTLE_LIFE_TIME columns of a real 2026 export, when 'time in game' is computed several ways, then one honest definition (and its caveats) can be chosen for the Overview headline"
verdict: VALIDATED
related: [003]
tags: [playtime, sessions, honesty]
---

# Spike 002: Time-played definitions

## What This Validates
Given the real 2026 export (3 account folders), when "you spent N days in game" is computed from
sessions vs battle time vs per-vehicle sums, then we know which numbers agree, which don't, and why.

## How to Run
```bash
node .planning/spikes/002-time-played-definitions/run.mjs      # defaults to ~/Downloads/path/to/export.zip
node .planning/spikes/002-time-played-definitions/coverage.mjs
```
Prints aggregates only (no nickname/IP). Helper: `../_lib/export-reader.mjs` (fflate + PapaParse from the repo).

## Investigation Trail
1. Sessions per account/game: raw sum vs interval-union ("merged"). Equal everywhere (no overlap), also across accounts:
   WoT raw 279.6 d == merged 279.6 d. Overlap handling is cheap insurance, not a current need.
2. Battle time: `WOT_Account_Statistics.BATTLE_LIFE_TIME` (seconds) == sum of per-vehicle `BATTLE_LIFE_TIME_SEC`
   (117.4 d both). Two sources agree exactly.
3. First surprise: account 234… has only 70 d of sessions but 117.4 d of battle time. Not a bug:
   `coverage.mjs` shows account 1234567 holds sessions 2015-05-06..2023-02-10 and 234… holds
   2023-02-10..2026-03-09; 234…'s `CREATED_AT` is 2015-05-06. Same player, account was re-numbered/migrated;
   lifetime battle stats live in the new folder, the early session log lives in the old one.
4. Data-quality counts: 0 unparseable, 0 negative, 6 zero-length sessions, 0 sessions > 24 h, longest 13 h.
   Two timestamp formats seen (`dd.mm.yyyy hh:mm`, ISO with `.000`) — the app's parser already handles both.

## Results
- **Headline definition: "logged in" = union of WoT session intervals across ALL accounts.**
  Real data: 279.6 d (1,234 h) logged in, 2015-05-06 .. 2026-03-09. Multiple folders are one timeline here.
- **Second figure: "in battle" = `BATTLE_LIFE_TIME`** = 117.4 d (42% of logged-in time). Say "in battle", never "in game".
- Never mix: battle time (lifetime, from the newest account) vs sessions (spread over both accounts) look
  contradictory per folder but are consistent in total.
- Caveat for the build: per-account battle/vehicle stats can double-count if two exports of the same player
  (2021 + 2026) are loaded together — the Overview must not sum lifetime stats across folders blindly.
  (Within the single 2026 export: only 234… carries WoT stats, so no double count.)
- Other games: WoTB 1.9 d, WoWS 0.3 d, HEAT 0.1 d — fine as a "your Wargaming life" strip later.
