---
phase: 06-login-ip-history-offline-geolocation
plan: 06
subsystem: infra
tags: [vite-alias, vitest, playwright, eslint, no-restricted-imports, web-worker, range-table, intl-displaynames, offline-geolocation]

# Dependency graph
requires:
  - phase: 06-plan-04
    provides: the committed range-table container (writer, reader, three lookups) and both the shipped and fixture tables
  - phase: 06-plan-03
    provides: the login aggregate with its injected `CountryLookup` and the cap accounting every distinct address must keep
  - phase: 06-plan-05
    provides: `readLoginRowData`, the one-snapshot rebuild path that a stale `geo` triggers
provides:
  - "The country table inlined into the worker chunk with a lazy first-lookup decode: no request, no main-thread load"
  - "`geoAliasEntries`, one alias shared by the Vite and Vitest configs, and the `GEO_FIXTURE` build seam it carries"
  - "A table-backed `lookupCountry` / `geoTableId`, replacing 06-01's null seam"
  - "Guarded English country names from `Intl.DisplayNames`, main-thread safe"
  - "The worker-only import ban for the geo modules, in the same block as the fflate ban, with probes"
  - "The seam guard, the dynamic-import scan and the worker-path lint probes"
affects: [06-09, 06-11, 06-13, phase-07, geolocation, worker-boundary, zero-network]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 21130
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A Vite alias for a specifier that carries a query is a REGULAR EXPRESSION with a capture group in the replacement, not a string key"
    - "A test-only build switch lives in exactly one config object and is guarded by reading that file, the Vite config and package.json"
    - "A multi-megabyte data table is inlined with `?inline` and decoded lazily on first use, so the worker pays for it only when an export is actually imported"
    - "Two `no-restricted-imports` bans share ONE config block, because a second block replaces the first block's options rather than merging with them"

key-files:
  created:
    - scripts/geo/lib/geo-alias.ts
    - src/lib/geo/country-table.ts
    - src/lib/geo/country-names.ts
    - src/lib/geo/geo-assets.d.ts
    - tests/unit/import/logins-country.test.ts
    - tests/unit/geo/country-lookup.test.ts
    - tests/unit/geo/country-names.test.ts
    - tests/unit/guards/geo-seam.test.ts
  modified:
    - vite.config.ts
    - vitest.config.ts
    - playwright.config.ts
    - tsconfig.test.json
    - eslint.config.js
    - src/lib/geo/country-lookup.ts
    - tests/fixtures/logins-fixtures.ts
    - tests/unit/import/logins-worker.test.ts
    - tests/unit/import/logins-sources.test.ts
    - tests/unit/logins/login-aggregate.test.ts
    - tests/unit/guards/lint-guards.test.ts

key-decisions:
  - "CHECKPOINT ANSWER — option-a: the `GEO_FIXTURE` build seam. The browser tests run against the committed 377-byte fixture table, selected only by `playwright.config.ts`'s `webServer.env`, so D-17's 'no real IPs committed' holds literally and the shipped table stays covered structurally by `country-table-shipped.test.ts` rather than by a browser run. The argument is a test-quality one, not a rule: the 10,000-row scale fixture draws its bulk distinct addresses from `2001:db8::/32` (all `ZZ` in the real table) plus the three RFC 5737 /24s — 762 usable hosts — so under option-b the Phase 6 criterion that the map stays responsive because it aggregates per country would have been proven against a fixture shading at most a handful of countries. The seam is necessary rather than convenient: every documentation and reserved address answers `ZZ` via `unknownId` 250, and `places[250] === 'ZZ'` in the shipped table, while `8.8.8.8` answers `US`."
  - "Loading is inline via `?inline` and was not revisited: no request is made for the country table and the main thread never loads it. The measured cost is accepted — 3,403,572 raw bytes become roughly 4.5 MB of base64 text in the worker chunk, compressing back to about the table's 725 KB gzipped on the wire, paid on every page load for a table only needed once a dataset is loaded. No lazy fetch and no second network path was added; plan 06-11 owns the one sanctioned network path in this product."
  - "Phase 7 SC4 was amended in the roadmap: it said the country geo table 'loads without 404s', and under inline there is no request and nothing that can 404. RESEARCH Decision 5 had already proposed the change; leaving the contradiction in place would have been worse than the wrong wording."
  - "`Logins.csv`'s `COUNTRY_CODE` fixture value changed from `DE` to `XX`. T-06-20's assertion was 'this text appears nowhere in the serialised view', and once the table was wired `DE` legitimately appears — it is what the fixture table gives `192.0.2.10`. `XX` is user-assigned and never emitted by DB-IP, so the assertion is sharp again and sharper than before: the file claims `XX` for an address the table resolves to `CN`."

patterns-established:
  - "A fixture decision that depends on the DATA is recorded in the artifact that carries the decision (06-CONTEXT.md D-17) and in the roadmap criterion it contradicts, not only in the summary"
  - "A test whose expected value is a country reads the committed fixture CSV, never the binary the build inlined, so an encoder or reader bug cannot make the expectation agree with the implementation"
  - "A guard that depends on a build-time switch is proved by READING the files that could set it, because there is no instrument that observes a build-time decision from a unit test"

requirements-completed: [ACTIVITY-06]

coverage:
  - id: D1
    description: "A documentation address in a real import resolves to the fixture table's country in the worker, through the inlined table and the lazy decode, and the explicit-ZZ address is counted as unknown country"
    requirement: ACTIVITY-06
    verification:
      - kind: integration
        ref: "tests/unit/import/logins-country.test.ts#06-06 tracer: a documentation address resolves through the inlined table"
        status: pass
    human_judgment: false
  - id: D2
    description: "The fixture seam resolves the shipped table by default and the fixture only under GEO_FIXTURE=1, is set only in playwright.config.ts's webServer.env, and appears in no package.json script"
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/guards/geo-seam.test.ts#only Playwright may select the fixture"
        status: pass
    human_judgment: false
  - id: D3
    description: "A main-thread import of country-table, country-lookup or city-table fires no-restricted-imports; the same import from a worker path does not; the fflate ban still fires"
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/guards/lint-guards.test.ts#worker-boundary import ban — no-restricted-imports (geo worker-only modules)"
        status: pass
    human_judgment: false
  - id: D4
    description: "countryName returns German English names from Intl.DisplayNames, answers null for ZZ and every malformed code before Intl is constructed, and falls back to the raw code when Intl throws"
    requirement: ACTIVITY-06
    verification:
      - kind: unit
        ref: "tests/unit/geo/country-names.test.ts#countryName: English names from Intl"
        status: pass
    human_judgment: false
  - id: D5
    description: "A production build inlines the real 3.4 MB table into the worker chunk, emits no chunk beyond the main and worker ones, makes no request for the table, and leaves the CSP literal untouched"
    requirement: ACTIVITY-06
    verification:
      - kind: other
        ref: "pnpm run build (dist/assets/ingest.worker-*.js 4,702.54 kB; only index-*.js / index-*.css / ingest.worker-*.js) && pnpm exec playwright test tests/e2e/guards/zero-network.spec.ts (4 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phase 7 success criterion 4 no longer claims the country table must load without 404s, which is unsatisfiable under inline delivery"
    verification:
      - kind: other
        ref: ".planning/ROADMAP.md#Phase 7 success criterion 4"
        status: pass
    human_judgment: false

# Metrics
duration: 26min
completed: 2026-10-03
status: complete
---

# Phase 06 Plan 06: The country table in the worker Summary

**The committed 3.4 MB range table now inlines into the worker chunk and resolves every login address to a country at import, with no request for it and no main-thread load, behind a fixture seam only Playwright can select.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-10-03T19:30:00Z
- **Completed:** 2026-10-03T19:56:00Z
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- **The fixture decision is made, argued and recorded.** Option-a, the `GEO_FIXTURE` build seam. D-17 keeps its literal "no real IPs committed"; the shipped table stays covered by `country-table-shipped.test.ts` (10 tests) rather than by a browser run; and the reason is a test-quality argument, stated in full in 06-CONTEXT.md: documentation ranges offer 762 usable IPv4 hosts and `2001:db8::/32` is uniformly `ZZ` in the real table, so committing real addresses would have proven the map's per-country aggregation against a fixture shading a handful of countries.
- **The worker resolves real countries, and nothing is fetched for it.** The table is imported with `?inline`, so the 3,403,572 raw bytes become ~4.5 MB of base64 text inside `dist/assets/ingest.worker-*.js` and stay there — the build emits no other chunk, and the zero-network spec still passes. The decode is lazy because the worker spawns eagerly and posts `ready` first (T-06-24).
- **The 06-01 null seam is gone.** `geoTableId()` answers the table's kind, month and fixture flag, so a build that ships a different table makes every stored aggregate stale and rebuilds it lazily from the rows — which the tracer proves, by dropping the stored record and watching the rebuild come back country for country.
- **Two bans share one ESLint block, and that is not an accident.** `no-restricted-imports` takes one options object; a second block matching the same files would have replaced the fflate restriction rather than adding to it. The geo patterns were added to block 8 and the fflate probes now sit next to the new ones in the same test file, so a future careless split fails instead of passing.
- **The seam is guarded by reading the files that could select it.** `geo-seam.test.ts` checks the alias's two targets, the four near-miss environment values, that `?inline` survives the rewrite, that `playwright.config.ts` sets the variable once inside `webServer.env`, and that no `package.json` script or npm hook mentions it — plus a source scan proving no module under `src/lib/geo` or `src/lib/features/logins` contains a dynamic import, which would be a post-load request (RESEARCH Pitfall 1).

## The fixture decision, in full (option-a)

**How do the browser tests see countries when every RFC 5737 and RFC 3849 documentation address maps to unknown in the real table?**

Option-a, and the probe results are what make it necessary rather than convenient:

| Probe | Answer | Consequence |
|---|---|---|
| `192.0.2.0` / `198.51.100.0` / `203.0.113.0` / `2001:db8::` against the shipped table | `ZZ` | A 10,000-row documentation fixture shades no country, so success criteria 2 and 4 could not be proven as written |
| `places[250]` in the shipped table | `"ZZ"` | The unknown is a real PLACE, not a failed lookup — which is why `countryName` must guard it before `Intl`, and why `Intl`'s own `"Unknown Region"` would have been a country-column bug |
| `8.8.8.8` against the shipped table | `US` | The table is not degenerate; it is the fixture addresses that are outside it |
| RFC 5737's three `/24`s | 762 usable hosts | Under option-b the scale fixture would hold at most 762 distinct addresses, and the criterion "the map stays responsive because it aggregates per country" would be proven against a handful of shaded countries |

The seam is one environment variable in one object. `vitest.config.ts` also sets it — not because unit tests need a seam (they do not: `lookupCountryIn` takes the table as an argument) but because the worker-harness tests reach the table the way the worker does, and a country assertion there has to be a fact about the committed fixture rather than about whichever DB-IP month is on disk.

## The loading decision, and what it costs

Inline via `?inline` was the plan's default and was not revisited. The measured cost, accepted and recorded:

- 3,403,572 raw bytes → roughly 4.5 MB of base64 text in the worker chunk
- about 725 KB gzipped on the wire, the same as the table itself
- paid on every page load, for a table only needed once a dataset is loaded
- paid by the WORKER only: no request, no lazy chunk, and no path on which the main thread ever sees it

No lazy fetch was added and no second network path was created. Plan 06-11 owns the one sanctioned network path in this product, and the alternative here would have been the worse shape: a fetch that fires only when an export is loaded is still a fetch, and the zero-network spec counts every request after the baseline.

**The Phase 7 SC4 amendment.** ROADMAP.md's Phase 7 success criterion 4 said the worker script, the country geo table and the opt-in city dataset "all load without 404s". Under inline there is no request for the country table and nothing that can 404, so the criterion is amended to say so and to point at the worker chunk being served plus the zero-network check as what actually proves it. RESEARCH Decision 5 had already proposed this; the amendment is recorded rather than left as a contradiction for Phase 7 to trip over.

## Task Commits

Each task was committed atomically:

1. **Task 1: the fixture decision (checkpoint — option-a), recorded** — `198710e` (docs)
2. **Task 2: Tracer — a fixture address resolves through the inlined table** — `fe76875` (feat)
3. **Task 3: TDD RED** — `48649f2` (test)
4. **Task 3: GREEN — country names, the worker-only import ban, the seam guards** — `d4096b1` (feat)

**Plan metadata:** `e800a98` (base)

_Note: Task 3 is a TDD task, so it has the two commits the cycle requires._

## Files Created/Modified

- `scripts/geo/lib/geo-alias.ts` — `geoAliasEntries(env)`. The one alias both configs use; a RegExp with a capture group so `?inline` survives the rewrite, and the `GEO_FIXTURE === '1'` target switch.
- `src/lib/geo/country-table.ts` — worker-only. `getCountryTable()`: strips the data-URL prefix, `atob` to bytes, `decodeRangeTable`, cached. Never runs at module load.
- `src/lib/geo/geo-assets.d.ts` — the ambient `declare module '#geo/country-data?inline'`, plus the `tsconfig.test.json` include that lets the test program resolve the specifier.
- `src/lib/geo/country-lookup.ts` — the table-backed `lookupCountry`, the new table-argument `lookupCountryIn`, and a `geoTableId` carrying kind, month and the fixture flag.
- `src/lib/geo/country-names.ts` — main-thread safe, holds no table. `countryName` answers `ZZ` and every malformed code null BEFORE constructing `Intl.DisplayNames`.
- `vite.config.ts` / `vitest.config.ts` — `assetsInclude: ['**/*.bin']` and the alias; Vitest always at the fixture, Vite through `process.env`. `CSP_POLICY` untouched.
- `playwright.config.ts` — `env: { GEO_FIXTURE: '1' }` inside `webServer`, the only selection point in the repository.
- `eslint.config.js` — the geo worker-only patterns in block 8, beside the fflate `paths` entry rather than in a block of their own.
- `tests/fixtures/logins-fixtures.ts` — `LOGINS_HAND_KEY` now carries DE, AU and one explicit ZZ; `LOGINS_SOURCES_COUNTRY` is `XX`.
- `tests/unit/import/logins-country.test.ts` — the tracer: seven cases through the real worker, the parser, Dexie and a rebuild.
- `tests/unit/geo/country-lookup.test.ts`, `country-names.test.ts`, `tests/unit/guards/geo-seam.test.ts`, `lint-guards.test.ts` — the table-argument lookup, the names, the seam, and the worker-only probes.

## Decisions Made

Beyond the checkpoint answer and the confirmed inline decision, two smaller ones:

- **`Logins.csv`'s `COUNTRY_CODE` fixture value moved from `DE` to `XX`.** T-06-20's assertion is "this text appears nowhere in the serialised view", and once the table was wired, `DE` legitimately appears — it is what the fixture table gives `192.0.2.10`. The test had become unprovable by the only instrument it had. `XX` is user-assigned and never emitted by DB-IP, so the assertion is sharp again and stronger: the file claims `XX` for an address the table resolves to `CN`, so a leak shows up as the WRONG COUNTRY rather than as a missing token.
- **`countryName` accepts `string | null`**, where the plan wrote `code: string`. Every call site has a `cc` that is already `string | null` from the aggregate, and pushing that check to each caller is a null check the type was already carrying. Strictly additive: no `string` caller can break.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A fourth module had to join the ESLint `ignores`**
- **Found during:** Task 3
- **Issue:** The plan named three files for block 8's `ignores` — `country-table.ts`, `country-lookup.ts`, `city-table.ts`. `src/lib/features/logins/login-aggregate.ts` also imports `geoTableId` from `country-lookup.ts`, and it is imported only by `src/lib/worker/ingest.worker.ts` and `src/lib/worker/db.ts`, so it is a worker-only module by construction. Without the exemption `pnpm run lint` failed on a real, correct import.
- **Fix:** Added that one path to the same `ignores` array, with a comment saying it reaches the lookup for a provenance string and not for the table, plus a lint probe that names the exact file and asserts a NEIGHBOUR in the same directory is still restricted — so the exemption cannot widen unnoticed.
- **Files modified:** `eslint.config.js`, `tests/unit/guards/lint-guards.test.ts`
- **Verification:** `pnpm run lint` green; the fflate probes and both new probe pairs pass.
- **Committed in:** `d4096b1`

**2. [Rule 1 - Bug] A `**/` inside a block comment silently truncated `geo-assets.d.ts`**
- **Found during:** Task 2
- **Issue:** The ambient declaration's header comment contained the glob `src/**/*.ts`. The `*/` inside it ends a block comment, so the rest of the file was parsed as code and `tsc` reported eight syntax errors on a file that looked correct.
- **Fix:** Rewrote the sentence without the glob.
- **Files modified:** `src/lib/geo/geo-assets.d.ts`
- **Verification:** `pnpm run check` clean.
- **Committed in:** `fe76875`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both were necessary to get the plan's own acceptance criteria to pass. Neither changed scope: one named a fourth file for an exemption list whose stated purpose the file already served, and one fixed a comment. No behaviour was added or removed beyond the recorded decisions.

## Issues Encountered

- **TDD RED was half assertion-level, half load-level.** The three main-thread import probes failed properly on `expected [ ] to include 'no-restricted-imports'`. `country-names.test.ts` could not even load, because the module it targets did not exist — that is a load failure, not a behavioural one, and it is recorded as such rather than dressed up. `gsd_run check tdd-red-evidence` cannot classify a vitest RED in this project at all (recorded in STATE.md from 04-01: the tool parses node:test TAP and vitest 5's TAP reporter matches neither shape), so the git-log `test(06-06):` commit is the machine check.
- **`tsFilesUnder` in the seam guard walked into the wrong directory on its first run.** The recursion joined each entry against the OUTER directory constant rather than the current one, so `src/lib/geo/assets/country-table.bin` was looked up at `src/lib/geo/country-table.bin` and the test failed with an ENOENT that named a file which does not exist. Fixed before the RED commit; worth remembering because the failure looks like a missing asset rather than a path bug.
- **`Intl.DisplayNames` assigns real names to codes this project treats as unknown.** `XA` is "Pseudo-Accents" and `ZZ` is "Unknown Region" on this runtime, so both original expectations for the "unrecognised code" and the "ZZ is guarded" cases were wrong as written. `XX` is genuinely unassigned and echoes itself. The `ZZ` finding is now an explicit test: the platform WILL name `ZZ`, which is exactly why the guard is before the call rather than a `try/catch`.
- **The broken-windows ledger could not be appended to.** `gsd_run windows append` refused with "Ledger table in `.planning/WINDOWS.md` disagrees with the fenced JSON entries for row id(s): 8, 9" — a pre-existing inconsistency between the rendered table and the fenced JSON, left by an earlier plan and not caused by anything here. Repairing it means editing the fenced JSON block, which is outside this plan's scope and would rewrite entries belonging to other phases. **This plan's one deviation therefore has NO row in the ledger**, and it is recorded in the Deviations section above instead. Anyone repairing the ledger should add: kind `deviation`, phase 06, file `eslint.config.js`, the fourth `no-restricted-imports` ignore path.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **The worker resolves countries.** Plans 06-09 (city tier), 06-13 (the table and map UI) and the UI plans can build against `lookupCountry` and `countryName` as they are; the city plan inherits the same alias and the same `?inline` mechanism, and `city-table.ts` is already named in the lint ban so the rule is in force before the module exists.
- **Phase 7's deployed-asset check is smaller than it was written.** The country table is not an asset to fetch and cannot 404; the criterion has been amended in the roadmap. Phase 7 SC4's remaining content — the worker script, the opt-in city dataset, the CSP, the zero-network check — is unchanged.
- **The cost to re-state at ship time:** every page load carries ~725 KB gzipped for the country table, and the browser specs run against a 377-byte fixture rather than the shipped table. The shipped table is covered by `country-table-shipped.test.ts` (shape, sizes, documentation addresses resolving to the explicit unknown, byte-identical regeneration) and by `pnpm run build`, which is the strongest coverage available without a browser run against 3.4 MB of real data.

---
*Phase: 06-login-ip-history-offline-geolocation*
*Completed: 2026-10-03*
