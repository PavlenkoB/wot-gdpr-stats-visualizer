# Spike Wrap-Up Summary

**Date:** 2026-10-22
**Spikes processed:** 3
**Feature areas:** Vehicle lookup, Overview data
**Skill output:** `./.claude/skills/spike-findings-wot-gdpr-stats-visualizer/`

## Processed Spikes
| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 001 | vehicle-lookup-table | standard | VALIDATED | Vehicle lookup |
| 002 | time-played-definitions | comparison | VALIDATED | Overview data |
| 003 | insight-catalog | standard | VALIDATED | Overview data |

## Key Findings
- Official WG API gives name/class/tier/nation for 1,035 vehicles in 19.2 KB gzip; 99.8% of battles resolve by tag. Record tanks are numeric tank_ids and need a second key. Retired tanks always miss (tag-derived fallback, "class unknown"). Terms of Use check is still pending before the table is committed.
- Headline time is "logged in" (union of session intervals across all account folders, 51 d on the real export); "in battle" (BATTLE_LIFE_TIME, 117 d) is a separate labelled figure. Folders must not be compared one by one, and lifetime stats must not be summed across two exports of the same player.
- 35 insights are computable from the export. Medals are empty (Hall of Fame = records), the battle-types table covers only 5.4% of battles (no mode mix), and order amounts, chat text and clan names stay count-only by default.
