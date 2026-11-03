# Phase 11: New Game Data - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-19
**Phase:** 11-new-game-data
**Areas discussed:** Where new data lives, Game filter extension, PII strip for unknown headers

---

## Where new data lives

| Option | Description | Selected |
|--------|-------------|----------|
| Own HEAT list row | Dedicated section, shown only with HEAT data | ✓ |
| Inside Vehicles as 5th title | Reuse title switcher | |
| Generic Other games section | Catch-all pane | |
| WoWP in Vehicles Warplanes title | Account stats + plane rows there | ✓ |
| WoWP own row | Duplicates existing Warplanes option | |
| WoWS crews & storage own row | Dedicated section | ✓ |
| WoWS inside Vehicles Warships | Mixed record types | |

**User's choice:** Recommended options for all three.

## Game filter extension

| Option | Description | Selected |
|--------|-------------|----------|
| Vehicles keeps last title, note it | Ignore unhonourable filter | ✓ |
| Empty state for that game | Dead pane | |
| Disable chips per pane | Divergent chip sets | |
| Per-game aggregates incl. HEAT/WOTC | Version bump | ✓ |
| Chips only when rows exist | Variant | |
| Filter stays Playtime + Vehicles | Keeps D-02 | ✓ |
| Add to Logins too | New capability | |

**User's choice:** Recommended options.

## PII strip for unknown headers

| Option | Description | Selected |
|--------|-------------|----------|
| Column allowlist per file | Fail-closed | ✓ |
| Denylist PII-like columns | Weaker | |
| Allowlist + value scan | Extra code, false positives | |
| Drift: empty state, import succeeds | Tolerant | ✓ |
| Drift: warn in summary | | |
| Drift: fail import | | |
| Research inspects headers only | | ✓ |
| Plan from file names | | |

**User's choice:** Recommended options.

## Claude's Discretion

HEAT pane layout and geolocation handling (not discussed; defaults in D-04), visuals, allowlist contents.

## Deferred Ideas

Finance/Logins game filter; HEAT geolocation on Logins map; Game_Forums EMAIL handling (Phase 12).
