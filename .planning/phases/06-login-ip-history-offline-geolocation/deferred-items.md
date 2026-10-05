# Phase 6 deferred items

Out-of-scope discoveries logged by plan executors. Nothing here blocks a plan; each is a fact somebody later may want.

## From 06-13

1. **`tests/fixtures/geo/city-fixture.csv`: six IPv6 rows are missing their continent column.** The rows for `2001:db8:3::/48`, `2001:db8:d::/48`, `2001:db8:17::/48`, `2001:db8:21::/48`, `2001:db8:2b::/48` and `2001:db8:35::/48` read `...,SG,Singapore,Singapore,Tampines,1.35,103.94` (8 cells) where every other row has `...,AS,SG,Singapore,Tampines,...` (9 cells). The container therefore carries the country code `Singapore`, the state `Singapore` and the city `Tampines` (and the same shift for the other five). The page is correct against that file (the Country cell of the ranked list falls back to the raw code when `Intl` cannot name it), and the browser spec mirrors the committed file's column positions, so nothing fails. Regenerating the fixture (`pnpm run geo:city:fixture`) changes the committed `.gz`, its `sha256` and byte count, and the pinned values in the 06-09 and 06-11 tests, so it was left for a plan that owns that fixture.
2. **The IPv6 city section is sixty `/48`s but `country-fixture.csv` covers only forty of them.** An address in `2001:db8:28::/48` or beyond has no country, and the city lookup skips an address with no country (rule one of `buildCityView`), so the sixty-place intent of the city fixture is not reachable through IPv6 alone. The 06-13 browser spec reaches more than fifty places by also using one address per IPv4 city range, computed from the CSVs.
3. **Stale `connect-src 'none'` text in `AGENTS.md`** (already recorded by 06-11): not edited here.
