---
phase: 06-login-ip-history-offline-geolocation
verified: 2026-10-11T12:56:00Z
status: passed
score: 12/13 must-haves verified or accepted (truth 12 accepted as session-only known limitation by owner 2026-10-11; 1 present-behavior-unverified)
behavior_unverified: 1
overrides_applied: 1
overrides:
  - must_have: "Phone Back keeps the opted-in city view (Phase 6 SC3 under the Phase 8 layout) (truth 12)"
    reason: "Accepted as a session-only known limitation. Phase 8 plans 08-02, 08-08 and 08-13 unmount the login-history branch on the phone list screen, so Back then reopen drops the opted-in city view and needs a new press. City data is never persisted by design (P6), so session-only behaviour is consistent with the privacy model. No code change."
    accepted_by: "Bohdan_Pavlenko"
    accepted_at: "2026-10-11"
covered_files: [".github/workflows/ci.yml", ".github/workflows/deploy.yml", ".planning/phases/06-login-ip-history-offline-geolocation/06-01-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-01-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-02-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-02-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-03-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-03-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-04-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-04-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-05-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-05-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-06-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-06-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-07-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-07-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-08-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-08-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-09-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-09-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-10-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-10-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-11-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-11-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-12-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-12-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-13-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-13-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-14-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-14-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-15-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-15-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-16-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-16-SUMMARY.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-17-PLAN.md", ".planning/phases/06-login-ip-history-offline-geolocation/06-17-SUMMARY.md", "AGENTS.md", "eslint.config.js", "index.html", "package.json", "scripts/geo/build-city-dataset.ts", "scripts/geo/build-country-table.ts", "scripts/geo/build-world-map.ts", "scripts/geo/lib/city-manifest.ts", "scripts/geo/lib/csv-ranges.ts", "scripts/geo/lib/download.ts", "scripts/geo/lib/geo-alias.ts", "scripts/geo/resolve-dbip-month.ts", "src/lib/core/types/worker-messages.ts", "src/lib/core/windowing.ts", "src/lib/features/logins/CityList.svelte", "src/lib/features/logins/CityOptIn.svelte", "src/lib/features/logins/CountryList.svelte", "src/lib/features/logins/LoginHistory.svelte", "src/lib/features/logins/LoginMapSection.svelte", "src/lib/features/logins/LoginSummary.svelte", "src/lib/features/logins/LoginTable.svelte", "src/lib/features/logins/WorldMap.svelte", "src/lib/features/logins/city-client.ts", "src/lib/features/logins/city-shared.ts", "src/lib/features/logins/city-state.ts", "src/lib/features/logins/login-aggregate.ts", "src/lib/features/logins/login-model.ts", "src/lib/features/logins/login-shared.ts", "src/lib/features/logins/login-state.ts", "src/lib/features/logins/map-model.ts", "src/lib/geo/assets/country-table.bin", "src/lib/geo/city-fetch.ts", "src/lib/geo/city-manifest.d.ts", "src/lib/geo/city-table.ts", "src/lib/geo/country-lookup.ts", "src/lib/geo/country-names.ts", "src/lib/geo/country-table.ts", "src/lib/geo/geo-assets.d.ts", "src/lib/geo/ip.ts", "src/lib/geo/range-table.ts", "src/lib/geo/world-map.generated.ts", "src/lib/shell/Dashboard.svelte", "src/lib/shell/overview-model.ts", "src/lib/shell/selection-state.ts", "src/lib/ui-copy.ts", "src/lib/worker/data-queries.ts", "src/lib/worker/db.ts", "src/lib/worker/ingest.worker.ts", "tests/e2e/_support/helpers.ts", "tests/e2e/guards/zero-network.spec.ts", "tests/e2e/logins/login-city.spec.ts", "tests/e2e/logins/login-history.spec.ts", "tests/e2e/logins/login-map.spec.ts", "tests/e2e/logins/login-scale.spec.ts", "tests/e2e/logins/login-table.spec.ts", "tests/fixtures/geo/city-fixture-manifest.json", "tests/fixtures/geo/city-fixture.csv", "tests/fixtures/geo/city-fixture.gz", "tests/fixtures/geo/country-fixture.bin", "tests/fixtures/geo/country-fixture.csv", "tests/unit/geo/build-scripts.test.ts", "tests/unit/geo/city-build.test.ts", "tests/unit/geo/city-fetch.test.ts", "tests/unit/geo/city-manifest.test.ts", "tests/unit/geo/city-table.test.ts", "tests/unit/geo/country-lookup.test.ts", "tests/unit/geo/country-names.test.ts", "tests/unit/geo/country-table-shipped.test.ts", "tests/unit/geo/ip.test.ts", "tests/unit/geo/range-table.test.ts", "tests/unit/geo/source-decision.test.ts", "tests/unit/geo/world-map.test.ts", "tests/unit/guards/fetch-scan.test.ts", "tests/unit/guards/geo-seam.test.ts", "tests/unit/guards/lint-guards.test.ts", "tests/unit/guards/phase6-guards.test.ts", "tests/unit/import/logins-backfill.test.ts", "tests/unit/import/logins-city.test.ts", "tests/unit/import/logins-country.test.ts", "tests/unit/import/logins-sources.test.ts", "tests/unit/import/logins-worker.test.ts", "tests/unit/logins/city-client.test.ts", "tests/unit/logins/city-state.test.ts", "tests/unit/logins/login-aggregate.test.ts", "tests/unit/logins/login-blocks.test.ts", "tests/unit/logins/login-fixtures.test.ts", "tests/unit/logins/login-model.test.ts", "tests/unit/logins/login-state.test.ts", "tests/unit/logins/map-model.test.ts", "vite.config.ts"]
covered_digest: "v3:sha256:d62b499c857c033e99c8b7d76c65baff8503a5e146c6dda787df055279f931fb"
superseded_by_phase8:
  - item: "Phone-width city opt-in: the opted-in city view is session-only component state in LoginHistory and is dropped when the phone detail screen unmounts (Back to list, then reopen)"
    plans: ["08-02", "08-08", "08-13"]
    note: "Dashboard.svelte detailMounted (line 127) unmounts the login-history branch on the phone list screen. Phase 6 SC3 holds while the block is mounted; the reset on Back is a Phase 8 layout consequence. Accepted as a session-only known limitation by owner Bohdan_Pavlenko on 2026-10-11 (see overrides). No code change."
  - item: "Map keyboard hint moved behind the About-map disclosure; tooltip edge check rewritten from sticky-nav clearance to top-clearance"
    plans: ["08-06", "08-14"]
    note: "Attribution line stays visible outside the disclosure (LoginMapSection.svelte). Phase 6 roadmap SCs do not name the hint placement, so no must-have fails on this; recorded for the human-verification re-check of UAT items 1 and 2."
  - item: "Login history placement: single-scroll section moved into the master-detail detail pane, with a phone list-then-detail flow"
    plans: ["08-01", "08-02", "08-05", "08-13", "08-14"]
    note: "Phase 6 UAT items 1 to 4 were run on the pre-Phase-8 layout (UAT completed 2026-10-04; Phase 8 merged 2026-10-09). Their results are carried as evidence to re-check, not as resolved."
behavior_unverified_items:
  - truth: "Leaving the city block while a city download is in flight aborts that download (06-13 cleanup invariant)"
    test: "Press Load city-level detail, then move away from the login-history block (desktop: select another section; phone: Back to list) before the download finishes"
    expected: "The in-flight request is aborted (no further progress updates, no city result, no request continues after leaving); reopening shows the idle block"
    why_human: "Teardown is present (CityOptIn.svelte lines 120-124 call controller.abort() on unmount) and city-state.test.ts covers the abort-silently effect mapping, but no test drives an unmount during a download. Presence cannot show the abort happens at runtime."
coincidental_reliance_items: []
deferred:
  - truth: "Opt-in city dataset loads from the real deployed GitHub Pages project subpath (real DB-IP city file, real container, phone-class decode)"
    addressed_in: "Phase 7"
    evidence: "ROADMAP Phase 7 success criterion 4 (live subpath load, zero-network against the deployed build). 07-VERIFICATION.md is human_needed on this item."
human_verification:
  - test: "Re-run UAT items 1 to 4 on the current Phase 8 layout at 375px and desktop: map legibility, map tooltip with real pointer near edges and in the country list, 10k-row IP table scroll and sort feel, and clipboard masking while masked then revealed"
    expected: "Same outcomes as the 2026-10-04 UAT: shaded countries legible with matching legend and no overflow; tooltip stays on screen and never shows a full address; no stutter or blank rows; masked copy shows only a.b.c.xxx forms, revealed copy shows full addresses"
    why_human: "Those four results were recorded on the pre-Phase-8 layout. Phase 8 moved the block into the detail pane and changed the phone flow and the map hint. Performance feel and pointer behaviour cannot be measured by grep or the automated suite. Not marked resolved."
    partial_evidence: "2026-10-11 walkthrough (Bohdan_Pavlenko approved), synthetic export only: Login history pane at 1280x800, 1280x600 and 375x812 had no page-level horizontal scroll and 0 loose overflow elements (40 past the right edge on phone, all inside scroll containers), so map/table fit at 375px is covered. NOT covered: map tooltip with a real pointer near edges and in the country list, 10k-row scroll and sort feel, clipboard masking. Item stays open."
  - test: "Re-confirm the city accuracy caption (judgment-tier prohibition P7) on the current layout after loading city detail"
    expected: "Every display of city data carries the accuracy caption; nothing presents a city as an exact location"
    why_human: "Judgment-tier prohibition. The 2026-10-04 human resolution (UAT 5) predates Phase 8; the caption is still rendered (CityOptIn.svelte line 261) and its e2e assertion passes, but the human resolution has not been repeated on the new layout."
  - test: "Opt-in city load on the deployed GitHub Pages build (deferred from Phase 6 to Phase 7)"
    expected: "Worker script and city file load on the project subpath without 404; city locations appear in the login table; no tab crash on a phone-class device"
    why_human: "Real city file, real container and phone-class memory cannot be exercised by the dev build or by any test. Owned by Phase 7 (07-VERIFICATION.md, human_needed)."
---

# Phase 6: Login-IP History & Offline Geolocation Verification Report

**Phase Goal:** User can see where their account was accessed from through a masked login-IP history and a country-level world map, with optional city-level detail. Only offline geo data is used, never a live API.
**Verified:** 2026-10-11T12:56:00Z
**Status:** passed
**Re-verification:** Yes. Previous report (2026-10-05) was passed 11/11 against code before the folder refactor, the Phase 7 deploy and the Phase 8 redesign. This run re-derived every truth from the current code and did not rely on the old verdict.

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: IP table masks every IP by default; click-to-reveal; copy, tooltips, title respect the mask | VERIFIED | One reveal control in `LoginHistory.svelte` (`data-masked`, lines 379-391) drives `revealed`, which feeds `displayIp` for the table, the Most-used tile and the Account row. `displayIp` and `maskIp` (`login-model.ts:93`, `ip.ts:381`) are the only address path. `LoginTable.svelte` IP cell carries no `title`. Nothing under `src/` assigns `document.title`; `index.html:10` is static. Unit: `login-model.test.ts`, `ip.test.ts`, `login-state.test.ts` (reveal reset on dataset replace) pass. E2E: `login-history.spec.ts` passes in the orchestrator gate. Clipboard residual: see human item 1. |
| 2 | SC2: Country from bundled DB-IP range table; world map shades by count; DB-IP attribution visible; zero-network passes | VERIFIED | `src/lib/geo/assets/country-table.bin` is tracked and decoded by `country-table-shipped.test.ts` and `country-lookup.test.ts` (both pass). Lookup runs in the worker (`ingest.worker.ts` imports `lookupCountry`). Map is hand-rolled SVG from `world-map.generated.ts`, shaded by count (`map-model.ts`, `WorldMap.svelte`). Attribution link `LoginMapSection.svelte:103-112` is outside the About disclosure. `world-map.test.ts` passes. Zero-network spec passes in the orchestrator E2E gate. |
| 3 | SC3: no city data until explicit opt-in; then only the same-origin dataset; Playwright confirms | VERIFIED | Single `fetch(` in `src` at `src/lib/geo/city-fetch.ts:151`, called only from `CityOptIn.svelte` on press. `cityAssetUrl` rebuilds the URL from `location.origin` plus the base path with no search or hash; `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `mode: 'same-origin'`. Idle-until-click asserted in `login-city.spec.ts` (test "tracer: nothing is requested before the click"). Passes in the orchestrator E2E gate. Phone-width caveat: truth 12. Deployed subpath: deferred to Phase 7. |
| 4 | SC4: 10k+ row fixture stays smooth; map aggregates per country | VERIFIED (automated) | Table windowed (`core/windowing.ts`, `LoginTable.svelte`); `login-scale.spec.ts` (5 tests, 12,000 rows) and `login-table.spec.ts` pass in the orchestrator E2E gate. Map aggregates per country (`rankCountries`, `map-model.ts`), node count bounded per shape. "Feels smooth" is human item 1. |
| 5 | P1 (test tier): a fixture geo table is never served by a production build | VERIFIED | `geo-seam.test.ts` passes. Fixture only under `GEO_FIXTURE=1` in `playwright.config.ts`. |
| 6 | P2 (test tier): masked everywhere in the DOM: attributes, body text, selection, title, live region | VERIFIED | `login-history.spec.ts` ("while masked, no full address exists anywhere on the page") passes in the orchestrator E2E gate; `LoginTable.svelte` line 159 comment and code carry no IP title. OS-clipboard residual: human item 1. |
| 7 | P3 (test tier): an unparsable IP value is never rendered, attributed, logged or announced | VERIFIED | `loginCells` and `plain()` (`login-model.ts:559-584`) route the IP cell only through `displayIp`; `login-table.spec.ts` hostile-cell case passes in the orchestrator E2E gate; `login-aggregate.test.ts` and `logins-worker.test.ts` pass. |
| 8 | P4 (test tier): exactly one same-origin GET for the user-requested city file after load; zero-network otherwise | VERIFIED | `fetch-scan.test.ts` and `lint-guards.test.ts` pass. `eslint.config.js` exempts only `src/lib/geo/city-fetch.ts` from the network ban. Grep of `src`: `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, `new Image(`, dynamic `import(` show one hit, `city-fetch.ts:151`. `zero-network.spec.ts` passes in the orchestrator E2E gate. |
| 9 | P5 (test tier): no export-derived value reaches the city request | VERIFIED | `cityAssetUrl` (`city-fetch.ts`) concatenates origin, base path and the manifest file name only; `city-fetch.test.ts` passes; `login-city.spec.ts` asserts empty search and hash, null body, no referer. |
| 10 | P6 (test tier): city data never persisted; reload, replace and Clear return to idle | VERIFIED | `cityShown` is component state only (`LoginHistory.svelte` lines 132-140), nulled on dataset change (line 197). `city-state.test.ts` and `city-client.test.ts` pass. `login-city.spec.ts` lifecycle test (line 573) passes in the orchestrator E2E gate. |
| 11 | P7 (judgment tier): city results never presented as exact; accuracy caption accompanies city data | VERIFIED (human-resolved earlier) | `CITY_ACCURACY_NOTE` (`ui-copy.ts:2556`) rendered in the ready state (`CityOptIn.svelte:261`); e2e asserts the note in the ready state (`login-city.spec.ts` line 450 test). Human resolution was UAT 5 on 2026-10-04, before Phase 8; see human item 3. |
| 12 | Phone Back keeps the opted-in city view (Phase 6 SC3 under the Phase 8 layout) | PASSED (override: accepted session-only known limitation, owner 2026-10-11) | `Dashboard.svelte:127` `detailMounted = !(phone && view === 'list')`; `Dashboard.svelte:249-285` unmounts the login-history branch on the phone list screen. `cityShown` is local to `LoginHistory`, so Back then reopen drops the city view and it needs a new press. Phase 6 SC3 holds while the block is mounted. Plans 08-02, 08-08, 08-13 (08-13 summary records the remount behaviour). Accepted as a session-only known limitation by owner Bohdan_Pavlenko on 2026-10-11 (override, no code change). |
| 13 | Leaving the city block mid-download aborts the download (06-13 cleanup invariant) | PRESENT_BEHAVIOR_UNVERIFIED | Teardown present: `CityOptIn.svelte:120-124` calls `controller?.abort()` on unmount; `city-state.test.ts` (abort-silently effect mapping, lines 139-163) passes. No test drives an unmount during a download. Counted as present, not verified. |

**Score:** 12/13 truths verified or accepted (truth 12 accepted as an override on 2026-10-11, 1 PRESENT_BEHAVIOR_UNVERIFIED)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Opt-in city dataset loads from the real deployed subpath (real DB-IP city file, real container, phone-class decode) | Phase 7 | ROADMAP Phase 7 SC4; `07-VERIFICATION.md` is human_needed on the same item |

### Known open items (not gaps, not deferred to a phase)

From `deferred-items.md` (06-13), checked against current files:

| # | Item | Status now |
|---|------|-----------|
| 1 | `tests/fixtures/geo/city-fixture.csv`: the six SG IPv6 rows (`2001:db8:0003::`, `:000d::`, `:0017::`, `:0021::`, `:002b::`, `:0035::`) have 8 cells, no continent column (`SG,Singapore,Singapore,Tampines,...`) | Still present (84 data rows at 8 cells; the other rows carry a continent). Test-fixture defect only; no production path. Left open. |
| 2 | City fixture covers 60 IPv6 `/48`s but `country-fixture.csv` covers about 40, so addresses beyond `2001:db8:28::/48` have no country | Still present. Fixture coverage only. Left open. |
| 3 | Stale `connect-src 'none'` text in `AGENTS.md` | `AGENTS.md` now documents `connect-src 'self'` as the shipped directive, with `'none'` only as history. Looks addressed. Not marked resolved here; a human should close it. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/geo/ip.ts` | Parse, canonical key, mask | VERIFIED | Substantive; `maskIp` at line 381; tested by `ip.test.ts`. |
| `src/lib/geo/range-table.ts` | Range-table reader (bounded) | VERIFIED | Substantive; used by country and city decoders; `range-table.test.ts`. |
| `src/lib/geo/country-table.ts`, `country-lookup.ts`, `assets/country-table.bin` | Shipped country table and lookup | VERIFIED | Table committed (3,403,572 B); decoded by `country-table-shipped.test.ts`. |
| `src/lib/geo/city-fetch.ts` | The one sanctioned city fetch | VERIFIED | Single `fetch(` call, same-origin URL builder, byte cap. |
| `src/lib/geo/city-table.ts` | City decoder | VERIFIED | Substantive; `city-table.test.ts` passes. |
| `src/lib/geo/world-map.generated.ts` | Committed per-country SVG paths | VERIFIED | 294 lines; `world-map.test.ts` passes. |
| `src/lib/features/logins/*.svelte` | Login block, table, tiles, map, city opt-in | VERIFIED | All imported; `LoginHistory.svelte` mounted from `Dashboard.svelte:285` (login-history pane). |
| `src/lib/features/logins/login-model.ts`, `login-state.ts`, `city-state.ts`, `map-model.ts` | Masking decision, reveal state, city state machine, map model | VERIFIED | Unit tests pass (`tests/unit/logins/*`). |
| `src/lib/worker/ingest.worker.ts` | Logins channel, country lookup, city-load | VERIFIED | `answerLogins`, `handleCityLoad` present; `logins-worker.test.ts`, `logins-city.test.ts` pass. |
| `src/lib/worker/db.ts` | Logins aggregate on meta, versioned write | VERIFIED | `writeLoginsIfCurrent` (line 671) and `logins` meta field; `logins-backfill.test.ts` passes. |
| `scripts/geo/*` | Build-time country, city and map generators | VERIFIED | Present; `build-scripts.test.ts` and `city-build.test.ts` pass. `geo:city` runs in `deploy.yml` (line 131). |
| `public/geo-city-data/` | Opt-in city asset | VERIFIED (build-time) | Gitignored by design (`.gitignore`); generated by `deploy.yml` at deploy, not committed. Local copy present. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `CityOptIn.svelte` press | `city-fetch.ts` `fetchCityBytes` | direct call | WIRED | `CityOptIn.svelte` is the only caller. |
| `city-fetch.ts` result | `ingest.worker.ts` `handleCityLoad` | transfer of ArrayBuffer | WIRED | `city-client.ts` posts `city-load`; worker decodes and builds the view. |
| `LoginHistory.svelte` | worker `logins` channel | `client.query({ channel: 'logins' })` | WIRED | `load()` in `LoginHistory.svelte` (line 175). |
| `Dashboard.svelte` | `LoginHistory.svelte` | login-history branch | WIRED | Line 285; detail pane only (see truth 12). |
| `ingest.worker.ts` | `lookupCountry` / `country-table` | `geoTableId`, `lookupCountry` | WIRED | Import at line 45; table inlined. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `LoginTable` | `rows` | worker `logins` aggregate from the imported export | Yes (`readLoginsSnapshot` rebuilds from rows when the stored aggregate is stale) | FLOWING |
| `WorldMap` / `CountryList` | `rows` | `rankCountries` over the aggregate | Yes | FLOWING |
| `CityOptIn` / `CityList` | city view | `city-load` to worker, decoded DB-IP table | Yes, after explicit press | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 6 named unit tests (23 files: geo, logins, import logins, guards) | `pnpm exec vitest run <23 named files>` | 23 files, 691 tests passed, exit 0 (`scratchpad/p6-named.log`) | PASS |
| Full unit gate (orchestrator) | `g-unit.log` | UNIT_EXIT=0, 2794 passed | PASS (regression evidence) |
| Typecheck and svelte-check (orchestrator) | `g-check.log` | CHECK_EXIT=0, 306 files, 0 errors, 0 warnings | PASS (regression evidence) |
| Full Playwright gate (orchestrator) | `g-e2e.log` | E2E_EXIT=0, 254 passed; login specs included | PASS (regression evidence) |
| Single network call site | grep over `src` | one hit, `city-fetch.ts:151` | PASS |
| Debt markers in phase files | grep TBD, FIXME, XXX over logins, geo, scripts/geo, tests | none | PASS |

Probe execution: skipped, the phase declares no `probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| ACTIVITY-05 | 06-01 to 06-04, 06-08, 06-10 (per PLAN frontmatter) | Masked login-IP table, click-to-reveal | SATISFIED | Truths 1, 5, 6, 7 |
| ACTIVITY-06 | 06-01, 06-04, 06-06, 06-07, 06-12 | Offline country geolocation on bundled SVG map, attribution | SATISFIED | Truth 2 |
| ACTIVITY-07 | 06-09, 06-11, 06-13 | Opt-in lazy city detail, no live API | SATISFIED with uncertainty | Truths 3, 8, 9, 10, 11; truth 12 accepted as override; truth 13 open |

Orphaned requirements: none. `REQUIREMENTS.md` maps ACTIVITY-05, -06 and -07 to Phase 6, and every one is declared in at least one PLAN.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/lib/features/logins/LoginHistory.svelte` | 140 (`cityShown`) | Session view held in component state, dropped on unmount | Warning | Drives truth 12 (phone Back); accepted as a session-only known limitation 2026-10-11. |
| `src/lib/features/logins/WorldMap.svelte` | 24 | Comment mentions dynamic `import()` | Info | Comment only; no runtime import. |
| `tests/fixtures/geo/city-fixture.csv` | SG rows | Malformed (8 cells) | Info | Test fixture only (deferred item 1). |
| Review IN-01 to IN-06 (`06-REVIEW-DISPOSITION.md`) | - | Open info items (`<p>` in `dl > div`, city country code not validated, `new Uint8Array(msg.buffer)` outside try, nested overlap tail, build tooling, self-hosted PR CI) | Info | Advisory only; outside every success criterion. |

### Human Verification Required

Decided 2026-10-11 (owner Bohdan_Pavlenko, in chat): the phone Back-to-list city-view reset (truth 12, formerly human item 2) is accepted as a session-only known limitation. It is no longer open.

1. **Re-check UAT 1 to 4 on the Phase 8 layout**
   - **Test:** At 375px and desktop, check map legibility and legend; map tooltip with a real pointer near edges and in the country list; 10k-row IP table scroll and sort feel; clipboard masking (copy while masked, then revealed).
   - **Expected:** Same outcomes as the 2026-10-04 UAT (all passed then).
   - **Why human:** Recorded before Phase 8 moved the block into the detail pane and changed the phone flow. Feel and pointer behaviour cannot be measured by grep.
2. **Re-confirm the city accuracy caption (P7) on the current layout**
   - **Test:** Load city detail on desktop and phone width; confirm the accuracy caption shows wherever city data shows.
   - **Expected:** Caption present; no city shown as an exact location.
   - **Why human:** Judgment-tier prohibition. The earlier resolution (UAT 5) predates Phase 8.
3. **Abort on leaving mid-download (truth 13)**
   - **Test:** Start a city download, then leave the login block before it finishes.
   - **Expected:** The request is aborted; no further progress; reopening shows idle.
   - **Why human:** Teardown is present but not exercised by any test.
4. **Deployed subpath city load (deferred to Phase 7)**
   - **Test:** On the live GitHub Pages build, load city detail on a phone-class device.
   - **Expected:** No 404; city locations appear; no tab crash.
   - **Why human:** Real file and device memory; owned by Phase 7.

### Visual walkthrough note (2026-10-11, partial coverage, nothing resolved)

Visual walkthrough accepted 2026-10-11 (accepted_by Bohdan_Pavlenko, approved in chat as "approved"): an agent drove the built app (preview build, headless Chromium) with a synthetic export (sessions, logins, all four player-stats titles, premium, currency, orders) at 1280x800, 1280x600 and 375x812 across all 8 panes. No page-level horizontal scroll at any size; elements past the right edge on phone (Playtime 265, Login history 40, Vehicles 42, Finance 65) all sit inside intentional scroll containers (0 loose); j/k moved Overview -> Playtime -> Overview on desktop at both heights; phone list -> detail with the Sections back control works on every pane; 0 console/page errors; 4 requests after load (page, JS, CSS, worker), 0 beyond baseline. Relevance to this phase: Login history pane had no loose overflow (40 elements past the right edge on phone, all inside scroll containers).

- Item 1 (UAT 1 to 4 on the Phase 8 layout): PARTIAL. Covered: map and table layout at 375px and desktop (no page overflow, containment). Not covered: map tooltip with a real pointer, 10k-row scroll and sort feel, clipboard masking. Stays open.
- Former item 2 (phone Back keeps city view): decided by the owner on 2026-10-11 as an accepted session-only limitation (override on truth 12). Not covered by the walkthrough, and no longer needed.
- Items 2, 3, 4 (city accuracy caption, abort mid-download, deployed city load; renumbered): not covered, because the preview build has no city file and nothing was deployed.

### Gaps Summary

No BLOCKER. No must-have is FAILED, no artifact is missing or a stub, and no key link is broken. Status is `human_needed`, not `passed`, for two reasons (the phone-Back city-view reset was accepted as a session-only known limitation by the owner on 2026-10-11):

1. The four human UAT results (items 1 to 4) predate the Phase 8 redesign and are carried as evidence to re-check, not as resolved.
2. The leave-mid-download abort (truth 13) is present in code but untested at runtime, and two further human checks (accuracy caption on the new layout, deployed subpath city load) remain open.

Accepted (not a reason for human_needed): Phase 8 introduced a phone-only reset of the opted-in city view on Back (truth 12). Superseded by Phase 8 (plans 08-02, 08-08, 08-13) and accepted by the owner as a session-only known limitation on 2026-10-11. Recorded as an override. No code change.

Changes from the 2026-10-05 report: the score is now 11/13 because the truth set includes two new items (truths 12 and 13) that were not in the previous report. The previous 11/11 was not a count of these two. No previous gap existed, so `gaps_closed` and `regressions` are empty.

---

_Verified: 2026-10-11T12:56:00Z_
_Verifier: Claude (gsd-verifier)_

Human validation (2026-10-12): owner confirmed all outstanding human items in chat ('All good'); status set to passed.
