---
phase: "06"
slug: login-ip-history-offline-geolocation
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-05"
validated: "2026-10-05"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Reconstructed after execution from the 17 PLAN files and 17 SUMMARY files (no VALIDATION.md was seeded at plan time because research ran without a Validation Architecture section).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5 (`environment: 'node'`, `fake-indexeddb`, `GEO_FIXTURE` alias) + Playwright 1.63 (chromium, `vite build && vite preview`, `GEO_FIXTURE=1` only in `playwright.config.ts` webServer.env) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts`, `tests/unit/setup.ts`, `eslint.config.js`, `tsconfig.test.json` |
| **Quick run command** | `pnpm exec vitest run tests/unit/geo tests/unit/logins tests/unit/guards tests/unit/shell/login-copy.test.ts tests/unit/import/logins-*.test.ts` |
| **Full suite command** | `pnpm run lint && pnpm run check && pnpm run test:unit && pnpm exec playwright test` (`check` = `tsc -b && svelte-check`) |
| **Estimated runtime** | quick ~10 s; unit ~6 s on an idle machine; Playwright 1.3 min with 5 workers, ~5 min single-worker (CI shape; budget guarded by `tests/unit/guards/ci-budget.test.ts`) |

Components cannot be rendered in unit tests (no jsdom). Logic lives in pure modules (`ip.ts`, `range-table.ts`, `city-table.ts`, `login-aggregate.ts`, `login-model.ts`, `map-model.ts`, `city-state.ts`); component contracts are asserted as source contracts plus Playwright for behaviour. Browser tests see countries and cities through the committed fixture tables, never the real 3.4 MB / 50 MB ones (D-17, 06-06 decision).

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` command (every non-decision task has one)
- **After every plan wave:** `pnpm run lint && pnpm run check && pnpm run test:unit`
- **Before `/gsd-verify-work`:** full suite green, including `playwright test`
- **Max feedback latency:** 60 seconds for the per-task run

---

## Per-Task Verification Map

48 tasks across 17 plans (06-15..06-17 are gap closure): 41 `auto`/`tracer` tasks, each with an `<automated>` command, and 7 `checkpoint:decision` tasks whose outcomes are recorded in 06-CONTEXT.md and pinned by tests in the same plan. Statuses reflect the full suite run on 2026-10-05 at HEAD c5ac8d6: unit 77 files / 2346 tests, `check` 0 errors 0 warnings across 299 files, lint clean, Playwright 234 passed.

| Plan / Task | Req | Threat Ref | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|-----|------------|----------|-----------|-------------------|-------------|--------|
| 06-01 T1 | ACTIVITY-05, ACTIVITY-06 | — | Task 1: Tracer - one session row to a logins answer, end to end in the worker | unit | `pnpm exec vitest run tests/unit/geo/ip.test.ts tests/unit/logins/login-aggregate.test.ts tests/unit/import/logins-worker.test.ts tests/unit/import/da…` | ✅ | ✅ green |
| 06-01 T2 | ACTIVITY-05, ACTIVITY-06 | — | No Dexie version bump (recommended) | decision | — (recorded decision; pinned by a test in a later task of the same plan) | ✅ | ✅ recorded |
| 06-01 T3 | ACTIVITY-05, ACTIVITY-06 | — | Task 3: Rebuild a stale or missing aggregate from stored rows, and apply the De… | unit | `pnpm exec vitest run tests/unit/import/logins-backfill.test.ts tests/unit/import/db.test.ts tests/unit/import/logins-worker.test.ts &amp;&amp; pnpm r…` | ✅ | ✅ green |
| 06-02 T1 | ACTIVITY-05, ACTIVITY-06, ACTIVITY-07 | — | Cancel (recommended) | decision | — (recorded decision; pinned by a test in a later task of the same plan) | ✅ | ✅ recorded |
| 06-02 T2 | ACTIVITY-05, ACTIVITY-06, ACTIVITY-07 | — | Neutral-info cancelled line (recommended) | decision | — (recorded decision; pinned by a test in a later task of the same plan) | ✅ | ✅ recorded |
| 06-02 T3 | ACTIVITY-05, ACTIVITY-06, ACTIVITY-07 | — | Task 3: Login history, IP table, map, country list and city detail copy with fo… | unit | `pnpm exec vitest run tests/unit/shell/login-copy.test.ts tests/unit/shell/ui-copy.test.ts &amp;&amp; pnpm run test:unit &amp;&amp; pnpm run check &am…` | ✅ | ✅ green |
| 06-03 T1 | ACTIVITY-05, ACTIVITY-06 | — | Capped logins still reach the country figures, tiles and map (recommended) | decision | — (recorded decision; pinned by a test in a later task of the same plan) | ✅ | ✅ recorded |
| 06-03 T2 | ACTIVITY-05, ACTIVITY-06 | — | Task 2: Tracer - one IPv6 address through parse, canonical grouping, aggregatio… | unit | `pnpm exec vitest run tests/unit/geo/ip.test.ts tests/unit/logins/login-aggregate.test.ts &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-03 T3 | ACTIVITY-05, ACTIVITY-06 | — | Task 3: Complete aggregation semantics, the seeded 10k fixture and the independ… | unit | `pnpm exec vitest run tests/unit/logins tests/unit/geo/ip.test.ts tests/unit/import/logins-worker.test.ts &amp;&amp; pnpm run check &amp;&amp; pnpm ru…` | ✅ | ✅ green |
| 06-04 T1 | ACTIVITY-06 | — | Task 1: Tracer - fixture CSV through the build script into a container that a l… | unit | `pnpm exec vitest run tests/unit/geo/range-table.test.ts &amp;&amp; pnpm run geo:country:fixture &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-04 T2 | ACTIVITY-06 | — | Official DB-IP downloads for both tiers (recommended) | decision | — (recorded decision; pinned by a test in a later task of the same plan) | ✅ | ✅ recorded |
| 06-04 T3 | ACTIVITY-06 | T-06-17 | Task 3: Download helper with month fallback, the committed production table, an… | unit | `pnpm exec vitest run tests/unit/geo &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-05 T1 | ACTIVITY-05 | — | Task 1: Tracer - a Logins.csv row and an Account_Info record reach the logins v… | unit | `pnpm exec vitest run tests/unit/import/logins-sources.test.ts tests/unit/shell/identity.test.ts tests/unit/import/logins-worker.test.ts &amp;&amp; pn…` | ✅ | ✅ green |
| 06-05 T2 | ACTIVITY-05 | — | Task 2: One-snapshot reader for every source, and rebuild equals import | unit | `pnpm exec vitest run tests/unit/import tests/unit/playtime/playtime.test.ts &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-05 T3 | ACTIVITY-05 | — | Task 3: Privacy and counting-rule regression across sources | unit | `pnpm run test:unit &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-06 T1 | ACTIVITY-06 | — | Table-argument lookup plus a build seam for the browser tests (recommended) | decision | — (recorded decision; pinned by a test in a later task of the same plan) | ✅ | ✅ recorded |
| 06-06 T2 | ACTIVITY-06 | — | Task 2: Tracer - a fixture address resolves to a fixture country through the in… | unit + e2e | `pnpm exec vitest run tests/unit/import tests/unit/geo &amp;&amp; pnpm run check &amp;&amp; pnpm run lint &amp;&amp; pnpm run build &amp;&amp; pnpm ex…` | ✅ | ✅ green |
| 06-06 T3 | ACTIVITY-06 | — | Task 3: Country names, the worker-only import restriction, and the seam guards | unit | `pnpm exec vitest run tests/unit/geo tests/unit/guards tests/unit/import/logins-country.test.ts &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-07 T1 | ACTIVITY-06 | — | Task 1: Tracer - install the build-time packages and generate a module from the… | unit | `pnpm run geo:map &amp;&amp; pnpm exec vitest run tests/unit/geo/world-map.test.ts &amp;&amp; pnpm run check` | ✅ | ✅ green |
| 06-07 T2 | ACTIVITY-06 | — | Task 2: Hybrid coverage, special cases, reproducibility check and runtime-depen… | unit | `pnpm run geo:map:check &amp;&amp; pnpm exec vitest run tests/unit/geo/world-map.test.ts &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-08 T1 | ACTIVITY-05 | — | Task 1: Tracer - one import shows a masked Most-used IP address in the new bloc… | unit + e2e | `pnpm exec vitest run tests/unit/logins/login-state.test.ts &amp;&amp; pnpm run check &amp;&amp; pnpm run lint &amp;&amp; pnpm exec playwright test te…` | ✅ | ✅ green |
| 06-08 T2 | ACTIVITY-05 | — | Task 2: All six tiles, the multi-file note, reset on replace or clear, and anno… | unit | `pnpm exec vitest run tests/unit/logins &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-08 T3 | ACTIVITY-05 | — | Task 3: Browser specs for states, reset, announcements, privacy surfaces and 37… | unit + e2e | `pnpm exec playwright test tests/e2e/logins/login-history.spec.ts &amp;&amp; pnpm exec vitest run tests/unit/guards/ci-budget.test.ts &amp;&amp; pnpm …` | ✅ | ✅ green |
| 06-09 T1 | ACTIVITY-07 | — | Task 1: Tracer - fixture CSV to a gzipped container to a city view in the real … | unit | `pnpm run geo:city:fixture &amp;&amp; pnpm exec vitest run tests/unit/import/logins-city.test.ts tests/unit/geo/range-table.test.ts &amp;&amp; pnpm ru…` | ✅ | ✅ green |
| 06-09 T2 | ACTIVITY-07 | — | Task 2: Inflate cap, hash check, family-limited decode, list rules and the real… | unit | `pnpm exec vitest run tests/unit/geo tests/unit/import/logins-city.test.ts &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-09 T3 | ACTIVITY-07 | — | Fetch on the main thread, connect-src 'self', transfer the buffer to the worker… | decision | — (recorded decision; pinned by a test in a later task of the same plan) | ✅ | ✅ recorded |
| 06-10 T1 | ACTIVITY-05 | — | Task 1: Tracer - hoist the windowing helpers and render a windowed three-column… | unit + e2e | `pnpm exec vitest run tests/unit/vehicles tests/unit/guards tests/unit/logins &amp;&amp; pnpm run check &amp;&amp; pnpm run lint &amp;&amp; pnpm exec …` | ✅ | ✅ green |
| 06-10 T2 | ACTIVITY-05 | — | Task 2: All columns, sorting, the pinned Account record row, pills and notes | unit | `pnpm exec vitest run tests/unit/logins tests/unit/vehicles tests/unit/guards &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-10 T3 | ACTIVITY-05 | — | Task 3: Browser specs for sort, the pinned row, privacy surfaces, keyboard and … | unit + e2e | `pnpm exec playwright test tests/e2e/logins &amp;&amp; pnpm exec vitest run tests/unit/guards/ci-budget.test.ts &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-11 T1 | ACTIVITY-07 | — | Task 1: Tracer - the one network module, its lint exemption and the proof that … | unit | `pnpm exec vitest run tests/unit/geo/city-fetch.test.ts tests/unit/guards &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-11 T2 | ACTIVITY-07 | — | Task 2: CSP connect-src self, the build-time manifest, the corrected zero-netwo… | unit + e2e | `pnpm exec vitest run tests/unit/geo/city-manifest.test.ts tests/unit/guards &amp;&amp; pnpm run check &amp;&amp; pnpm run lint &amp;&amp; pnpm exec p…` | ✅ | ✅ green |
| 06-12 T1 | ACTIVITY-06 | — | Task 1: Tracer - one real country is shaded on the real map from the real view | unit + e2e | `pnpm exec vitest run tests/unit/logins/map-model.test.ts &amp;&amp; pnpm run check &amp;&amp; pnpm run lint &amp;&amp; pnpm exec playwright test test…` | ✅ | ✅ green |
| 06-12 T2 | ACTIVITY-06 | — | Task 2: Tooltip, roving focus, legend, attribution, country list, empty states … | unit | `pnpm exec vitest run tests/unit/logins tests/unit/charts &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-12 T3 | ACTIVITY-06 | — | Task 3: Browser specs for node count, sums, keyboard, tooltip clipping, list an… | unit + e2e | `pnpm exec playwright test tests/e2e/logins &amp;&amp; pnpm exec vitest run tests/unit/guards/ci-budget.test.ts &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-13 T1 | ACTIVITY-07 | — | Task 1: Tracer - a click fetches the fixture, the worker decodes it and a City … | unit + e2e | `pnpm exec vitest run tests/unit/import/ingest-client.test.ts tests/unit/logins &amp;&amp; pnpm run check &amp;&amp; pnpm run lint &amp;&amp; pnpm exe…` | ✅ | ✅ green |
| 06-13 T2 | ACTIVITY-07 | — | Task 2: The full state machine, cancel, errors, reset, focus and announcements | unit | `pnpm exec vitest run tests/unit/logins tests/unit/import/ingest-client.test.ts &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-13 T3 | ACTIVITY-07 | — | Task 3: The ranked city list, the accuracy note and the hermetic browser suite | unit + e2e | `pnpm exec playwright test tests/e2e/logins &amp;&amp; pnpm exec vitest run tests/unit/guards/ci-budget.test.ts &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-14 T1 | ACTIVITY-05, ACTIVITY-06, ACTIVITY-07 | — | Task 1: The 10,000-row scale spec and the extended zero-network flow | unit + e2e | `pnpm exec playwright test tests/e2e/logins/login-scale.spec.ts tests/e2e/guards/zero-network.spec.ts` | ✅ | ✅ green |
| 06-14 T2 | ACTIVITY-05, ACTIVITY-06, ACTIVITY-07 | — | Task 2: Reconcile the CI budget, add the phase guards, apply D-17's fixture cle… | unit | `pnpm exec vitest run tests/unit/guards &amp;&amp; pnpm run test:unit &amp;&amp; pnpm run check &amp;&amp; pnpm run lint` | ✅ | ✅ green |
| 06-14 T3 | ACTIVITY-05, ACTIVITY-06, ACTIVITY-07 | — | Task 3: Real production build smoke, driver, README and the Phase 7 hand-offs | unit + e2e | `pnpm run test:unit &amp;&amp; pnpm run check &amp;&amp; pnpm run lint &amp;&amp; pnpm run build &amp;&amp; pnpm exec playwright test` | ✅ | ✅ green |
| 06-15 T1 | ACTIVITY-05, ACTIVITY-06 | — | Task 1: Tracer - an expanded IPv4-mapped address, a six-plus-dotted address and… | unit | `pnpm exec vitest run tests/unit/import/logins-country.test.ts tests/unit/geo/ip.test.ts tests/unit/logins tests/unit/guards/phase6-guards.test.ts &am…` | ✅ | ✅ green |
| 06-15 T2 | ACTIVITY-05, ACTIVITY-06 | — | Task 2: The dotted-tail matrix, the placement rule for a quad before the compre… | unit | `pnpm exec vitest run tests/unit/geo/ip.test.ts tests/unit/guards/phase6-guards.test.ts tests/unit/logins tests/unit/import/logins-country.test.ts &am…` | ✅ | ✅ green |
| 06-15 T3 | ACTIVITY-05, ACTIVITY-06 | — | Task 3: Bump LOGINS_VERSION so a dataset already in a browser is re-derived und… | unit | `pnpm exec vitest run tests/unit/import/logins-backfill.test.ts tests/unit/import/db.test.ts tests/unit/logins tests/unit/import/logins-country.test.t…` | ✅ | ✅ green |
| 06-16 T1 | ACTIVITY-05 | — | Task 1: Tracer - svelte-check goes from three errors to none on the real tree, … | unit | `pnpm exec svelte-check --tsconfig ./tsconfig.app.json --threshold warning &amp;&amp; pnpm exec vitest run tests/unit/vehicles tests/unit/logins tests…` | ✅ | ✅ green |
| 06-16 T2 | ACTIVITY-05 | — | Task 2: Put svelte-check inside the check script and the CI typecheck step, beh… | unit | `pnpm exec vitest run tests/unit/guards/typecheck-gate.test.ts tests/unit/guards/ci-budget.test.ts tests/unit/guards/geo-seam.test.ts tests/unit/geo/b…` | ✅ | ✅ green |
| 06-17 T1 | ACTIVITY-07 | T-06-34 | Task 1: Tracer - a mapped-only account asks for city detail through the real wo… | unit | `pnpm exec vitest run tests/unit/import/logins-city.test.ts tests/unit/geo/city-table.test.ts tests/unit/guards/phase6-guards.test.ts tests/unit/guard…` | ✅ | ✅ green |
| 06-17 T2 | ACTIVITY-07 | T-06-34 | Task 2: Pin the families rule with a table and with the decode-with-families eq… | unit | `pnpm exec vitest run tests/unit/geo/city-table.test.ts tests/unit/import/logins-city.test.ts tests/unit/guards/phase6-guards.test.ts &amp;&amp; pnpm …` | ✅ | ✅ green |
| 06-17 T3 | ACTIVITY-07 | — | Task 3: Close out the review ledger for CR-01, CR-02 and WR-05 | unit | `L=.planning/phases/06-login-ip-history-offline-geolocation/06-REVIEW-DISPOSITION.md; B=$(git log --diff-filter=A --format=%h -- $L); N=$(git diff --n…` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Commands are truncated to 150 characters; the full command is in the plan's `<verify>` block.*

---

## Requirement coverage

| Requirement | Tasks with automated verification | Key behaviours proven |
|-------------|-----------------------------------|-----------------------|
| ACTIVITY-05 (masked login-IP table, reveal toggle) | 26 | Mask by default and one global reveal; no full address in DOM, attributes, title, live region or selection before reveal (`login-history.spec.ts`, `login-table.spec.ts`); 10k-row table windowed and sorted against an independent oracle (`login-scale.spec.ts`); IPv4 and IPv6 parsing incl. the dotted-tail rule (`ip.test.ts`, 600-case property) |
| ACTIVITY-06 (offline country geolocation, world map) | 26 | Range-table container validation and lookup (`range-table.test.ts`); country resolution in the worker through the fixture seam (`logins-country.test.ts`); 235-shape map with bounded node count, tooltip, keyboard, legend and DB-IP attribution (`login-map.spec.ts`); no mapping package reaches `dist/` (`world-map.test.ts`) |
| ACTIVITY-07 (opt-in city detail) | 17 | Nothing requested before the click; exactly one same-origin GET for the manifest's file (`login-city.spec.ts`, `zero-network.spec.ts`); manifest hash and length checked before inflate, bomb cap, family-limited decode incl. IPv4-mapped addresses (`city-table.test.ts`, `logins-city.test.ts`); nothing persisted (every storage area read) |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Fixtures and helpers were created inside the plans that needed them (`tests/fixtures/logins-fixtures.ts`, `tests/helpers/login-oracle.ts`, `tests/fixtures/geo/*`) and are all present and passing.

---

## Manual-Only Verifications

All five were run by the user on 2026-10-05 in `06-UAT.md` and passed; they cannot be asserted by Playwright (visual judgment, real pointer, OS clipboard).

| Behavior | Requirement | Why Manual | Test Instructions | Result |
|----------|-------------|------------|-------------------|--------|
| World map legibility at 375px (shading, legend, no overflow, 295px overview) | ACTIVITY-06 | Visual legibility | DevTools device toolbar at 375 wide, scroll to "Logins by country" | pass |
| Map tooltip with a real pointer and touch near edges and in the list | ACTIVITY-06 | Real-pointer paths across irregular coastlines | Hover/touch the map edges and list, press Escape | pass |
| Scroll and sort feel on a 10k+ row table | ACTIVITY-05 | Perceived smoothness (the spec asserts a 5,000 ms settle bound only) | Load a large export, scroll and sort every column | pass |
| Clipboard masking | ACTIVITY-05 | The OS clipboard is unobservable to Playwright | Copy the IP column and Most-used tile masked, then revealed, paste | pass |
| City accuracy caption (judgment-tier prohibition, 06-13) | ACTIVITY-07 | Judgment on wording and placement | Load city detail, check every place city data appears | pass |

Deferred, not a Phase 6 gap: the real city dataset on the live GitHub Pages subpath (`.citydb.bin` served under a non-root base path) belongs to Phase 7 SC4 and its hand-off.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are recorded decisions pinned by tests
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none)
- [x] No watch-mode flags
- [x] Feedback latency < 60 s for the per-task run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-05

---

## Validation Audit 2026-10-05

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Known tooling limitation, not a validation gap: `gsd_run check tdd-red-evidence` cannot classify a valid Vitest RED in this repo (its Surefire path reads the test name with a regex that matches inside `classname=`), so TDD RED evidence for this phase is recorded as failing-test counts in commit messages and SUMMARYs instead.
