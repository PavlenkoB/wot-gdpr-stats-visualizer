# Phase 6: Login-IP History & Offline Geolocation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-03
**Phase:** 06-login-ip-history-offline-geolocation
**Areas discussed:** IP data source, Table layout & mask, World map & country view, City opt-in & hosting

---

## Geo lookup placement
Options: Worker at import (chosen), Main thread on demand, You decide.

## IP data source
(Re-asked after inspecting the real export zip: no Logins.csv; IPs in *_Game_Sessions.csv; 58 distinct IPs, 94% one IP.)
- Source files: All Game_Sessions files (chosen) / Reuse Phase 4 data / WoT only
- Row grouping: Group by IP (chosen) / Consecutive runs / Raw per-session
- Summary tiles: Yes (chosen) / No
- Account_Info IP: Show as separate labelled row (chosen) / Skip

## Table layout & mask
- Mask: Hide last octet (chosen) / last two octets
- Reveal: One global toggle (chosen) / plus per-row
- Collisions: Group by full IP (chosen) / masked prefix
- Columns/sort: Logins desc, sortable (chosen) / Last seen desc

## World map & country view
- Scale: Log, Phase 4 palette (chosen) / Percentile
- A11y: Tooltip + ranked list (chosen) / Tooltip only
- Unresolved: Show as Unknown, counted (chosen) / Hide
- Attribution: Caption under map, Intl.DisplayNames (chosen) / Footer, ISO codes

## City opt-in & hosting
- Hosting: Generate at CI build, ship in Pages artifact (chosen) / Commit / Shards
- Opt-in UX: Button with size warning, progress, cancel (chosen) / Button only
- Caching: Session only (chosen) / IndexedDB
- City view: user asked "what is more informative" — Claude chose city column plus ranked city list

## Deferred
Consecutive-run timeline; per-row reveal; IndexedDB city cache; per-login markers.
