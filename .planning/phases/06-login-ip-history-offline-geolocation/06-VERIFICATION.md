---
phase: 06-login-ip-history-offline-geolocation
verified: 2026-10-05T09:00:00Z
status: passed
score: 11/11 must-haves verified
covered_files:
  - .claude/skills/run-data-export-viewer/SKILL.md
  - .claude/skills/run-data-export-viewer/driver.mjs
  - .github/workflows/ci.yml
  - .planning/phases/06-login-ip-history-offline-geolocation/06-01-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-01-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-02-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-02-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-03-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-03-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-04-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-04-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-05-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-05-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-06-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-06-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-07-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-07-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-08-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-08-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-09-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-09-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-10-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-10-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-11-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-11-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-12-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-12-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-13-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-13-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-14-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-14-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-15-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-15-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-16-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-16-SUMMARY.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-17-PLAN.md
  - .planning/phases/06-login-ip-history-offline-geolocation/06-17-SUMMARY.md
  - .prettierignore
  - AGENTS.md
  - README.md
  - eslint.config.js
  - package.json
  - playwright.config.ts
  - pnpm-lock.yaml
  - scripts/geo/build-city-dataset.ts
  - scripts/geo/build-country-table.ts
  - scripts/geo/build-world-map.ts
  - scripts/geo/lib/city-manifest.ts
  - scripts/geo/lib/csv-ranges.ts
  - scripts/geo/lib/download.ts
  - scripts/geo/lib/geo-alias.ts
  - src/lib/core/types/worker-messages.ts
  - src/lib/core/windowing.ts
  - src/lib/features/logins/CityList.svelte
  - src/lib/features/logins/CityOptIn.svelte
  - src/lib/features/logins/CountryList.svelte
  - src/lib/features/logins/LoginHistory.svelte
  - src/lib/features/logins/LoginMapSection.svelte
  - src/lib/features/logins/LoginSummary.svelte
  - src/lib/features/logins/LoginTable.svelte
  - src/lib/features/logins/WorldMap.svelte
  - src/lib/features/logins/city-client.ts
  - src/lib/features/logins/city-shared.ts
  - src/lib/features/logins/city-state.ts
  - src/lib/features/logins/login-aggregate.ts
  - src/lib/features/logins/login-model.ts
  - src/lib/features/logins/login-shared.ts
  - src/lib/features/logins/login-state.ts
  - src/lib/features/logins/map-model.ts
  - src/lib/features/playtime/Playtime.svelte
  - src/lib/features/vehicles/PlayerStats.svelte
  - src/lib/features/vehicles/vehicle-model.ts
  - src/lib/geo/assets/country-table.bin
  - src/lib/geo/city-fetch.ts
  - src/lib/geo/city-manifest.d.ts
  - src/lib/geo/city-table.ts
  - src/lib/geo/country-lookup.ts
  - src/lib/geo/country-names.ts
  - src/lib/geo/country-table.ts
  - src/lib/geo/geo-assets.d.ts
  - src/lib/geo/ip.ts
  - src/lib/geo/range-table.ts
  - src/lib/geo/world-map.generated.ts
  - src/lib/import/worker-client.svelte.ts
  - src/lib/shell/Dashboard.svelte
  - src/lib/ui-copy.ts
  - src/lib/worker/data-queries.ts
  - src/lib/worker/db.ts
  - src/lib/worker/identity.ts
  - src/lib/worker/ingest.worker.ts
  - tests/e2e/_support/helpers.ts
  - tests/e2e/guards/zero-network.spec.ts
  - tests/e2e/logins/login-city.spec.ts
  - tests/e2e/logins/login-history.spec.ts
  - tests/e2e/logins/login-map.spec.ts
  - tests/e2e/logins/login-scale.spec.ts
  - tests/e2e/logins/login-table.spec.ts
  - tests/e2e/shell/dashboard.spec.ts
  - tests/fixtures/geo/city-fixture-manifest.json
  - tests/fixtures/geo/city-fixture.csv
  - tests/fixtures/geo/city-fixture.gz
  - tests/fixtures/geo/country-fixture.bin
  - tests/fixtures/geo/country-fixture.csv
  - tests/fixtures/logins-fixtures.ts
  - tests/helpers/components.ts
  - tests/helpers/login-oracle.ts
  - tests/unit/charts/contrast.test.ts
  - tests/unit/geo/build-scripts.test.ts
  - tests/unit/geo/city-build.test.ts
  - tests/unit/geo/city-fetch.test.ts
  - tests/unit/geo/city-manifest.test.ts
  - tests/unit/geo/city-table.test.ts
  - tests/unit/geo/country-lookup.test.ts
  - tests/unit/geo/country-names.test.ts
  - tests/unit/geo/country-table-shipped.test.ts
  - tests/unit/geo/ip.test.ts
  - tests/unit/geo/range-table.test.ts
  - tests/unit/geo/source-decision.test.ts
  - tests/unit/geo/world-map.test.ts
  - tests/unit/guards/ci-budget.test.ts
  - tests/unit/guards/fetch-scan.test.ts
  - tests/unit/guards/geo-seam.test.ts
  - tests/unit/guards/lint-guards.test.ts
  - tests/unit/guards/phase6-guards.test.ts
  - tests/unit/guards/typecheck-gate.test.ts
  - tests/unit/import/data-query-worker.test.ts
  - tests/unit/import/db.test.ts
  - tests/unit/import/ingest-client.test.ts
  - tests/unit/import/logins-backfill.test.ts
  - tests/unit/import/logins-city.test.ts
  - tests/unit/import/logins-country.test.ts
  - tests/unit/import/logins-sources.test.ts
  - tests/unit/import/logins-worker.test.ts
  - tests/unit/logins/city-client.test.ts
  - tests/unit/logins/city-state.test.ts
  - tests/unit/logins/login-aggregate.test.ts
  - tests/unit/logins/login-blocks.test.ts
  - tests/unit/logins/login-fixtures.test.ts
  - tests/unit/logins/login-model.test.ts
  - tests/unit/logins/login-state.test.ts
  - tests/unit/logins/map-model.test.ts
  - tests/unit/shell/identity.test.ts
  - tests/unit/shell/login-copy.test.ts
  - tsconfig.node.json
  - tsconfig.test.json
  - vite.config.ts
  - vitest.config.ts
covered_digest: "v2:sha256:7bea784b0fdff7068dd4bd98783708031b542323421b5012c155f8617d698503"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 11/11
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "The opt-in city dataset loads from the real deployed origin on the project subpath (real DB-IP city file, real ~50 MB container, real phone-class decode)"
    addressed_in: "Phase 7"
    evidence: "ROADMAP Phase 7 success criterion 4: 'On the live GitHub Pages URL, which uses a project subpath, the worker script and the opt-in city dataset both load without 404s.'"
advisory:
  - finding: "Code-review info items IN-01..IN-04 and IN-06 remain open in 06-REVIEW-DISPOSITION.md; IN-05 has its redirect sub-item fixed but a partial temp-file leak, no range-count floor and a '$' alias-replacement edge remain in build tooling"
    category: other
    reason: "Info severity, build-time tooling or markup only; 06-SECURITY.md records threats_open: 0. None touches a success criterion"
    evidence_status: "recorded in 06-REVIEW-DISPOSITION.md and 06-SECURITY.md"
---

# Phase 6: Login-IP History & Offline Geolocation Verification Report (Re-Verification, fresh digest)

**Phase Goal:** User can see where their account was accessed from through a masked login-IP history and a country-level world map, with optional city-level detail. Only offline geo data is used, never a live API.
**Verified:** 2026-10-05
**Status:** passed
**Re-verification:** Yes. The prior report (human_needed, 11/11) went stale because the post-UAT code-review fixes (WR-01..WR-04, WR-06, WR-07, IN-05 redirect) changed covered source files. This run re-checks the changed code and re-runs every automated gate against the current tree. The five human items from the prior report were all resolved by `06-UAT.md` (5/5 pass, status complete, 0 issues).

## Verdict

The phase goal is achieved in the current tree. Nothing regressed from the review-fix commits: typecheck, lint, 2,381 unit tests and 40 browser tests all pass on HEAD. All four roadmap success criteria hold, all seven plan-level prohibitions hold or were resolved by a human, and no human-verification item remains open.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: IP table masks every IP by default; click-to-reveal; copy, tooltips and page title respect the mask | VERIFIED | One toggle drives `displayIp`/`maskIp`; `LoginTable` IP cell carries no `title`; nothing under `src/` assigns `document.title` (grep: the only hit is a comment in `login-model.ts:76`); `index.html` title is static. `login-history.spec.ts` (innerHTML, title, every attribute, selection string while masked, replace/clear/reload return to masked) passes. UAT 4 (OS clipboard paste, masked then revealed) passed |
| 2 | SC2: Country from bundled DB-IP Lite range table; map shades by count; attribution visible; zero-network passes | VERIFIED | `country-table.bin` committed and decoded by `country-table-shipped.test.ts` (passes, on the post-WR-01 reader); lookup in worker only; attribution link at `LoginMapSection.svelte:101-108`; `zero-network.spec.ts:445` (all Phase 6 flows at 10,000 rows, opt-in never pressed) passes. IPv6 dotted-tail fix (CR-01, `LOGINS_VERSION = 2`) still in place |
| 3 | SC3: No city data until explicit opt-in; then only the same-origin dataset; Playwright confirms | VERIFIED | `grep "fetch(" src` returns exactly one call, `city-fetch.ts:151` (the review-fix diff only edited comments and a constant there). Called only from `CityOptIn.svelte` `onPress`. `login-city.spec.ts` (request count flat while idle, one same-origin GET after click, no query/hash/body/referer, City cell equals oracle) passes after the WR-01/WR-02 decoder changes. `familiesOf` still routes IPv4-mapped addresses to the IPv4 plane (`city-table.ts:87`, CR-02 fix intact) |
| 4 | SC4: 10k+ row fixture stays smooth; map aggregates per country | VERIFIED | `login-scale.spec.ts` (12,000 rows; windowed table; bounded node count; every sort key against an independent oracle inside the time bound; map draws per-country shapes only) passes. Scroll feel confirmed by UAT 3 |
| P1 | 06-06 (test tier): a fixture geo table is never served by a production build | VERIFIED | `geo-seam.test.ts` passes (fixture only under `GEO_FIXTURE=1` set in `playwright.config.ts` webServer env) |
| P2 | 06-08 (test tier): masked, no unmasked address in DOM, attributes, title, live region, selection, clipboard | VERIFIED | Specs above pass; the OS-clipboard residual was resolved by human UAT 4 |
| P3 | 06-10 (test tier): an unparsable IP value is never rendered, attributed, logged or announced | VERIFIED | `login-table.spec.ts` hostile-cell case passes |
| P4 | 06-11 (test tier): only a single same-origin GET for the user-requested city file after load | VERIFIED | `fetch-scan.test.ts`, lint exemption (one file), `zero-network.spec.ts`, `login-city.spec.ts` pass. The new WR-04 lint block bans `Worker`, `SharedWorker`, `caches`, `eval`, `new Function`, dynamic `import()` under the worker/`src` globs; `lint-guards.test.ts` probes (fail without the config) pass |
| P5 | 06-11 (test tier): no export-derived value in the city request | VERIFIED | `login-city.spec.ts` asserts empty search/hash, null body, no referer; passes |
| P6 | 06-13 (test tier): city data never persisted; reload/replace/Clear return to idle | VERIFIED | `login-city.spec.ts` persistence and replace/Clear cases pass |
| P7 | 06-13 (judgment tier): city results never presented as exact; accuracy caption accompanies city data | VERIFIED (human-resolved) | `CITY_ACCURACY_NOTE` rendered in the ready state; the judgment item was put to a person in UAT 5 and passed. No `unverified-prohibition` flag remains |

**Score:** 11/11 truths verified, 0 behavior-unverified.

### Review-fix delta (commits after the last verification)

| Change | Check | Result |
|--------|-------|--------|
| WR-01 `range-table.ts` header-count validation before allocation | `range-table.test.ts` new cases (typed-array construction count, no `split`), shipped country table still decodes, city fixture still decodes in the browser | PASS |
| WR-02 inflate into one buffer, cap equals decoder cap (96 MB) | `MAX_CITY_INFLATED_BYTES = MAX_CITY_TABLE_BYTES` (`city-table.ts`, `range-table.ts:138`); `city-table.test.ts` pins the two; city e2e passes with the gzipped fixture | PASS |
| WR-03/WR-04 ESLint worker import and network bans | `pnpm run lint` exit 0; `lint-guards.test.ts` probes pass | PASS |
| WR-06 refuse `--fixture` with `--download` | `build-scripts.test.ts` passes | PASS |
| WR-07 gzip-only contract (comment-only in `city-fetch.ts`, `city-table.ts`, worker, `CityOptIn.svelte`) | Diff reviewed: no behavior change | PASS |
| IN-05 per-hop https check in `scripts/geo/lib/download.ts` | `build-scripts.test.ts` redirect tests pass; build-time only, no runtime code | PASS |

## Required Artifacts

All 147 `covered_files` exist. The runtime artifacts (`ip.ts`, `range-table.ts`, `city-table.ts`, `city-fetch.ts`, `country-table.bin`, `world-map.generated.ts`, the `features/logins/*` components and models, `ingest.worker.ts`) are substantive, imported and exercised by the passing unit and browser suites. No stubs, no orphans.

## Key Link Verification

| From | To | Status |
|------|----|--------|
| `CityOptIn.svelte` `onPress` | `city-fetch.ts` (only `fetch(`) | WIRED |
| `city-fetch.ts` result | `ingest.worker.ts` `handleCityLoad` -> `inflateIfGzip` -> `decodeRangeTable` | WIRED |
| `ingest.worker.ts` | `familiesOf` / `lookupIp` (IPv4-mapped handled) | WIRED |
| worker `logins` channel | `LoginHistory.svelte` -> table, tiles, map, country list | WIRED (data flows; 40 e2e cases compare against an independent oracle) |

## Behavioral Spot-Checks (run in this verification)

| Check | Command | Result |
|-------|---------|--------|
| Typecheck + Svelte check | `pnpm run check` | exit 0, 299 files, 0 errors, 0 warnings |
| Lint | `pnpm run lint` (prettier + eslint) | exit 0 |
| Unit | `pnpm run test:unit` | 77 files, 2,381 tests passed |
| Browser | `pnpm exec playwright test tests/e2e/logins tests/e2e/guards` | 40 passed (42 s) |
| Single network call site | `grep -rn "fetch(" src` | one hit, `city-fetch.ts:151` |
| Debt markers | grep TBD/FIXME/XXX/TODO/HACK over `src scripts tests eslint.config.js` | none |

Probe execution: skipped, the phase declares no `probe-*.sh`.

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ACTIVITY-05 masked login-IP table, click-to-reveal | SATISFIED | Truths 1, 4; P2, P3 |
| ACTIVITY-06 offline country geolocation on bundled SVG map, attribution | SATISFIED | Truth 2; P1 |
| ACTIVITY-07 opt-in lazy city-level detail, no live API | SATISFIED | Truth 3; P4-P7 |

No orphaned requirements: REQUIREMENTS.md maps exactly these three IDs to Phase 6, all claimed by plans.

## Anti-Patterns Found

None blocking. Debt-marker grep is clean.

## Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | Opt-in city dataset served from the real GitHub Pages project subpath (real DB-IP city file, real container, phone-class decode) | Phase 7 | ROADMAP Phase 7 success criterion 4 |

## Advisory

Open review info items IN-01..IN-04, IN-06 and the remaining IN-05 sub-items (build tooling temp-file leak, range-count floor, `$` in alias path). Info severity, outside every success criterion; `06-SECURITY.md` reports `threats_open: 0`.

## Human Verification Required

None. The five items from the prior report were completed in `06-UAT.md` (5 passed, 0 issues).

## Gaps Summary

No gaps. Phase goal achieved.

---

_Verified: 2026-10-05_
_Verifier: Claude (gsd-verifier)_
