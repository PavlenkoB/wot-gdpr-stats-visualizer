---
spike: 001
idea: overview-personal-insights
name: vehicle-lookup-table
type: standard
validates: "Given vehicle ids from real exports, when mapped through a static build-time table, then each resolves to display name, class, tier and nation offline"
verdict: VALIDATED
related: [003]
tags: [lookup, build-time, tankopedia]
---

# Spike 001: Vehicle lookup table

## What This Validates
Tank name / class / tier / nation for the export's ids, with zero runtime network (table generated at build time, like the geo tables).

## Research
| Approach | Source | Pros | Cons | Status |
|----------|--------|------|------|--------|
| WG Developer API `wot/encyclopedia/vehicles` | official | gives `tank_id`, `tag`, `name`, `type`, `tier`, `nation`; both keys we need; clean licence | needs a free `application_id` (registered by the maintainer); `demo` id now returns `DEMO_APPLICATION_IS_BLOCKED` | **chosen, verified with a registered Standalone key** |
| Extracted game-client dumps on GitHub (StranikS-Scan/WorldOfTanks-Decompiled, izeberg/wot-src) | community | no key; vehicle XML + `.po` strings contain everything | no licence, proprietary client data, heavy to parse; redistributing derived data from it is a legal question | **rejected as a shipped source** |
| Derive from the tag (`R61_Object252` -> "Object252") | none | zero data | no class, no tier, ugly names, no numeric-id keys | fallback only |

## Results (run with a real key, 2026-10-22)
- API returned 1,035 vehicles. Compact table `[tank_id, "nation:tag", short_name, type, tier]`: 56.6 KB raw / **19.2 KB gzip**.
- **Tag coverage: 380/381 tanks, 31,810/12,345 battles (99.8%).** Only miss: `germany:G00_Example_Tank` (60 battles), a tank no longer in the API.
- Record tanks via numeric `tank_id`: 2 of 3 resolve (T-26 light tier 2, KV-1S heavy tier 5). The third (16913 = Germany, inner id 66) is not in the API;
  it is very likely the same retired an E-100 (unconfirmed). One record is `0`/empty -> "vehicle not recorded".
- Battles by class for this player: medium 4,100 · tank destroyer 3,300 · heavy 2,900 · light 2,200 · SPG 900. "Most-loved class" = medium.
- Retired/removed tanks will always miss: the build must keep the tag-derived fallback name and say "class unknown", never guess.
- Key handling: `WG_APPLICATION_ID` lives in `.env.local` (gitignored), used only by the build-time script; never shipped to the browser.
- Open (not a code question): read the Wargaming Terms of Use before committing the generated table to the public repo.

## Investigation Trail
`demo` key blocked -> client dumps rejected on licence -> official API with a Standalone key (10 req/s limit; ~11 paged requests) -> coverage measured
against the real 2026 export -> inspected the two misses (retired tank).
