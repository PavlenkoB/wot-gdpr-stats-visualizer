# Vehicle lookup

## Requirements

- Tank names/classes come from a build-time table (official WG API, key in `.env.local`, ~19 KB gzip) keyed by tag AND numeric tank_id; retired tanks fall back to the tag-derived name and "class unknown". Terms of Use must be checked before committing the generated table.
- Everything computed client-side; no network, no new runtime dependency (the API is called only by the build script).

## How to Build It

1. Build script (Node, like the geo tables) reads `WG_APPLICATION_ID` from env or `<repo>/.env.local` (gitignored; never shipped to the browser).
2. Page `https://api.worldoftanks.eu/wot/encyclopedia/vehicles/?application_id=KEY&language=en&limit=100&page_no=N&fields=tank_id,tag,name,short_name,type,tier,nation,is_premium,is_gift` until `meta.page_total`; ~11 requests, limit 10 req/s. Stop on `status !== 'ok'`.
3. Emit a compact table `[tank_id, "nation:tag", short_name || name, type, tier]` (1,035 vehicles, 56.6 KB raw / 19.2 KB gzip) and build two maps at runtime: `byTag` (key `nation:tag`, matches `wot_vehicle_statistics.csv` `VEHICLE_NAME`) and `byId` (string `tank_id`, matches `MAX_DAMAGE_VEHICLE` / `MAX_XP_VEHICLE` / `MAX_FRAGS_VEHICLE` in `wot_account_statistics.csv`).
4. Fallback for a miss: strip the tag prefix (`R61_Object252` becomes "Object252"), show "class unknown", never guess.
5. Most-loved class = sum battles by `type` over resolved tanks (real data: medium 4,100, TD 3,300, heavy 2,900, light 2,200, SPG 900).

## What to Avoid

- The `demo` application id: returns `DEMO_APPLICATION_IS_BLOCKED`. A registered Standalone key is required.
- Game-client dumps on GitHub (decompiled sources): no licence, proprietary data; do not ship anything derived from them.
- Using only the tag key: record tanks are numeric ids and do not match tags.
- Assuming the record id equals the by-type `VEHICLE_ID`: different internal id space.

## Constraints

- Coverage on the real export: 380/381 tanks, 31,810/12,345 battles (99.8%). Only miss: `germany:G00_Example_Tank` (60 battles, retired). One of three record tank ids (16913) is not in the API, likely the same retired tank.
- A record may be `0`/empty: show "vehicle not recorded".
- Open, not a code question: read the Wargaming Terms of Use before committing the generated table to the public repo.

## Origin

Synthesized from spikes: 001
Source files available in: sources/001-vehicle-lookup-table/
