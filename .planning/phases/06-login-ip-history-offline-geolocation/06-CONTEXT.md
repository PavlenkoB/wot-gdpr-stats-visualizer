# Phase 6: Login-IP History & Offline Geolocation - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Show where the account was accessed from: a masked, grouped login-IP history table with summary tiles, a country-level world map shaded by login count, and an opt-in city-level detail loaded from a same-origin asset. Offline geo data only, never a live API. Fills the "Login history" sub-block inside the Activity_history section (Phase 3 D-02). Requirements: ACTIVITY-05, ACTIVITY-06, ACTIVITY-07.

</domain>

<decisions>
## Implementation Decisions

### IP data source (real 2021 export inspected 2026-10-03)
- **D-01:** Real export has **no `Logins.csv`**. IPs live only in the per-title `WOT_Game_Sessions.csv` (4,200 rows), `WOTB_Game_Sessions.csv` (54), `WOWS_Game_Sessions.csv` (10), header `STARTED_AT;FINISHED_AT;IP`. 58 distinct IPs, one IP holds 94% of rows, no IPv6, no blanks. Date formats differ per file (WOT `14.03.2013 14:30`, others quoted ISO). The login history is built from **all `*_Game_Sessions.csv` files merged**; each IP keeps the set of titles it appeared in. A `Logins.csv` (as in the invented fixtures), if an export has one, is merged in too. Researcher must confirm what Phase 4 already parses for these files and reuse it. A "login" = one session row. — **Reversibility:** costly — **Reversibility rationale:** the aggregate shape and worker message contract depend on the source set.
- **D-02:** `Account_Info.csv` (User_Info) IP/country/city is shown as **one separate labelled "Account record" row**, not counted as a login and not in country totals. The identity header stays 3 fields (Phase 3 D-18..D-20); this row is in the login table only and follows the mask state.
- **D-03:** Timestamps are shown as written, no timezone conversion (Phase 4 D-01).

### Table layout & masking
- **D-04:** **Summary tiles first, table second**: distinct IPs, distinct countries, top IP, top country, first-to-last date, and unresolved-IP count. This follows PITFALLS #6.
- **D-05:** **One row per distinct full IP** (not per session, not per consecutive run). Columns: IP, country, logins, first seen, last seen, titles. Default sort logins descending, sortable by clicking headers. Windowed rendering when rows exceed a threshold (Claude picks), reusing the Phase 5 vehicle-table pattern. Group key is the full IP, so two rows may look identical while masked.
- **D-06:** **Mask hides the last IPv4 octet** (`195.138.193.xxx`); IPv6 masks the last 80 bits (first 3 groups visible). Malformed values must not crash.
- **D-07:** **One global reveal toggle**. The mask state governs table cells, tooltips, copy actions, map labels and `document.title`. Resets to masked on dataset replace or Clear; not persisted across reloads. Masked is the default on every load.
- **D-08:** IPs with no country match (private ranges, DB-IP gaps) show as **"Unknown country"** in table and summary, with a count on screen; not drawn on the map.

### World map
- **D-09:** Country shading uses a **log scale** with the Phase 4 palette and contrast checks. Aggregate per country, never per login (node count scales with countries).
- **D-10:** Map has a hover/focus **tooltip** (country name, logins, distinct IPs) and a **collapsible ranked country list**, so small countries and keyboard users can reach every value. One-sentence text summary like other charts.
- **D-11:** A **DB-IP CC BY 4.0 attribution caption** sits visibly under the map. Country names via `Intl.DisplayNames` (English), no bundled name list.
- **D-12:** **Geo lookup runs in the worker at import**; country per IP is resolved once and stored with the login aggregates on the dataset meta record (or equivalent), following the Phase 4/5 pattern. The main thread never loads the range table and never scans raw rows. Dexie schema bump per Phase 3 D-19 pattern. — **Reversibility:** costly — **Reversibility rationale:** stored aggregates and the worker message contract carry the resolved country.

### City-level opt-in (ACTIVITY-07)
- **D-13:** City dataset is **generated at CI build** from the `dbip-city-lite` source into compact binary file(s), **shipped in the Pages artifact, not committed to git**. It must be same-origin and respect the project base path (Phase 7 subpath). The exact format (single file vs shards) is Claude's discretion after research on size and GitHub Pages limits. — **Reversibility:** costly — **Reversibility rationale:** build pipeline, deploy artifact and Phase 7 verification depend on it.
- **D-14:** Opt-in control: a button "Load city-level detail (~N MB)" with a **size warning, progress indicator and cancel**. Nothing is fetched before the click; cancel or failure leaves the country view intact with a visible error.
- **D-15:** **Not persisted**: city data is session-only, with no IndexedDB copy and re-asked on each visit (the HTTP cache may help). Nothing extra for Clear to wipe.
- **D-16:** After opt-in: a **city column in the IP table** plus a **ranked city list** (city, country, logins). The map stays country-level, no per-login markers. The CSP `connect-src` must allow only same-origin for this one asset; a Playwright check confirms the opt-in fetches only that asset and nothing before opt-in. **Amended by the recorded decision below (plan 06-09): the CSP cannot enforce "only this asset" — read that clause as "the one sanctioned request is same-origin, and the Playwright check proves which asset it was", not as a claim about what the CSP confines.**

### Scale and testing
- **D-17:** Add a **synthetic fixture with 10k+ login rows** across many IPs and countries, including IPv6, malformed and unresolvable IPs, mixed date formats, and a `Logins.csv`-shaped file. Replace the invented `Logins.csv` shape in existing fixtures with real-shaped `*_Game_Sessions.csv` where tests allow. No real IPs committed (use RFC 5737/3849 ranges). The zero-network Playwright check must stay green.

### Recorded decision (plan 06-06, checkpoint — option-a): the `GEO_FIXTURE` build seam

D-17's fixture addresses and D-12's real table cannot both be satisfied by one table: every RFC 5737 / RFC 3849 documentation address resolves to `ZZ` in the official DB-IP data, so a 10,000-row documentation-range fixture shades no country at all against the shipped table. Resolved as **option-a**:

- The browser (Playwright) tests run against the **committed 377-byte `tests/fixtures/geo/country-fixture.bin`**, selected by the environment variable `GEO_FIXTURE=1`, which is set in **exactly one place**: `playwright.config.ts`'s `webServer.env`. `vitest.config.ts` sets the same variable for unit tests, which need no seam in either option because the lookup takes its table as an argument.
- **Recorded under D-17:** No real public address is committed to the repository. The shipped 3.4 MB table stays covered structurally by `country-table-shipped.test.ts` (10 tests) rather than by a browser run.
- The scale argument, not a rule, is what settles it: the 10,000-row fixture draws its bulk distinct addresses from `2001:db8::/32` (all `ZZ` in the real table) plus the three RFC 5737 `/24`s — **762 usable hosts**. Committing real public-infrastructure addresses instead would have left the map shading at most a handful of countries, and Phase 6's success criterion that the map stays responsive because it aggregates per country would have been proven against that. Only the seam makes the criterion meaningfully exercised.
- The seam is **necessary, not convenient** (probed while planning): every documentation and reserved address answers `ZZ` via `unknownId` 250, and `places[250] === "ZZ"` in the shipped table, while `8.8.8.8` answers `US`.
- Guarded by `tests/unit/guards/geo-seam.test.ts` (Task 3): the alias targets the shipped table with no environment, the fixture only with `GEO_FIXTURE=1`, `playwright.config.ts` sets it only inside `webServer.env`, and no `package.json` script mentions it.

### Confirmed: the country table is inlined, never fetched

RESEARCH Decision 5's default stands and is not revisited: the table is imported with the `?inline` suffix into the worker chunk, so **no request is made for it and the main thread never loads it**. The measured cost is accepted and recorded: 3,403,572 raw bytes become roughly 4.5 MB of base64 text in the worker chunk, compressing back to about the table's 725 KB gzipped on the wire, paid on every page load for a table only needed once a dataset is loaded. No lazy fetch and no second network path is added — plan 06-11 owns the one sanctioned network path in this product.

### Recorded decision (plan 06-09, checkpoint — option-a): the city file is fetched on the MAIN THREAD

D-16 asks for a CSP that "allows only same-origin for this one asset". Measured in 06-RESEARCH with the repository's own Playwright, **that is not an enforceable property of a CSP**, in either of the two places the sentence could be read:

- A meta CSP carrying `connect-src 'none'` **blocked a main-thread fetch, but a module-worker's fetch returned 200**, and Playwright's context request event recorded the worker request. So the CSP is **blind to worker traffic** in this setup — it does not stop a worker from reaching the network, and a comment anywhere that says worker requests are not captured by the browser tests is wrong.
- `connect-src 'self'` is a **host source**: it cannot be path-restricted to `geo-city-data/`. Widening it admits any same-origin path, not one file.

Resolved as **option-a**: the city file is fetched on the **main thread** (`src/lib/geo/city-fetch.ts`, the single exempt module) and the resulting `ArrayBuffer` is **transferred** to the worker, which decodes it exactly as in this plan. The CSP becomes `connect-src 'self'`. Cancel is a plain `AbortController`. Plan 06-11 is already written for this shape and needs no revision.

**Why this and not option-b (fetch inside the worker, `connect-src` stays `'none'`).** Under option-b the CSP text would have stayed `none` while governing **nothing** — the one network call this product is permitted to make would have been the one call the policy could not see. That is the worst of both: the strongest-looking guard in the project would be theatre, and it would have bought a lint **exemption inside `src/lib/worker/**`** — the exact directory that holds the raw rows and must never be able to reach the network. Under option-a the CSP genuinely governs the one sanctioned fetch and `src/lib/worker/**` keeps its absolute lint ban with **no exemption anywhere in it**.

**The cost, stated plainly.** `connect-src` widens from `'none'` to `'self'` for the whole page. That is **defence in depth only** and must not be mistaken for the guarantee. The actual enforcement of "no network" remains, in both options: (1) the **ESLint network ban** on `src/lib/geo/` and `src/lib/worker/`, and (2) the **Playwright request assertions** that plan 06-14 extends. Anyone who reads the widened CSP as the guarantee has read it backwards.

**Corollary, which reaches further back than this plan.** Because the `connect-src 'none'` this project has been shipping was never governing worker traffic either, **any belief in this repository that rested on it needs re-checking.** It is not a regression — the ban that actually held was always the lint ban — but the CSP must not be cited as evidence that no worker can reach the network.

### Claude's Discretion
- Geo build step design: `@ip-location-db/dbip-country` to binary range table, lookup algorithm (binary search), asset size, and where the table loads (worker only).
- Map asset generation (`world-atlas` + `d3-geo` at build time only), tiny-country handling, ISO code keys.
- Threshold for windowing, exact tile layout, tooltip styling, and wording of empty/unresolved states.
- City dataset format, and how the city lookup runs after opt-in (worker owns it, results re-aggregated). **Partly spent:** the format is now one pre-gzipped container plus a manifest (D-13, plan 06-09), and the fetch location is decided — main thread, see the recorded decision above. The lookup itself is still the worker's.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `.planning/PROJECT.md` — Constraints (zero-network, geo assets build-time only, aggregate per bucket)
- `.planning/REQUIREMENTS.md` — ACTIVITY-05, ACTIVITY-06, ACTIVITY-07
- `.planning/ROADMAP.md` §Phase 6 and Planning Notes — success criteria, research flags (geo lookup performance, per-country aggregation, city dataset hosting)

### Prior decisions
- `.planning/phases/03-dashboard-shell-account-identity/03-CONTEXT.md` — D-02 sub-block placement, D-07 DashboardSection states, D-18..D-21 privacy
- `.planning/phases/04-activity-time-dashboards/04-CONTEXT.md` — D-01 time basis, chart/palette patterns
- `.planning/phases/05-vehicle-stats-financial-dashboards/05-CONTEXT.md` — D-14 windowed native table, D-27 shared chart pieces, D-28 selector reset

### Research
- `.planning/research/PITFALLS.md` — Pitfall 6 (summary-first IP presentation), masking rationale, 10k+ fixture checklist
- `.planning/research/FEATURES.md` — login-IP map and city-level notes

### Real export
- `/Users/you/Downloads/export/1234567_2021-10-12.zip` — real 2021 sample (local only, never commit); `Activity_history/*_Game_Sessions.csv`, `User_Info/Account_Info.csv`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/features/playtime/` (`playtime-aggregate.ts`, `playtime-shared.ts`): already references `Game_Sessions`; parsing and date handling to reuse
- `src/lib/features/vehicles/VehicleTable.svelte`: windowed sortable native table pattern
- `src/lib/charts/` (`ChartTooltip`, `ChartLegend`, palette, contrast checks): reuse for map tooltip and legend
- `src/lib/worker/` (`ingest.worker.ts`, `data-queries.ts`, `db.ts`, `categories.ts`): worker-owned Dexie and aggregates

### Established Patterns
- Worker is the only Dexie owner; aggregates precomputed or queried on demand; main thread never scans raw rows
- DashboardSection status per sub-block; "not in this export" / "no rows" wording (Phase 3 D-10, Phase 5 D-02)
- Selector/mask state resets on dataset replace/Clear (Phase 4, Phase 5 D-28)

### Integration Points
- Login history sub-block inside the Activity_history section next to Playtime
- Worker message contract (`src/lib/core/types/worker-messages.ts`) gains login aggregate and city-lookup messages
- Build pipeline: new Node geo build scripts; CI build must produce the city asset (Phase 7 verifies on deployed subpath)

</code_context>

<specifics>
## Specific Ideas

- Real account is ~94% one home IP, so log shading and a summary-first layout matter; avoid a table that looks like 4k near-identical rows.

</specifics>

<deferred>
## Deferred Ideas

- Consecutive-run grouping ("same IP, N logins, Jan-Mar") timeline view — possible later enhancement
- Per-row reveal control — rejected for now (global toggle only)
- Persisting city data in IndexedDB — rejected for v1
- Per-login map markers / city-level map — out of scope (country-level map only)

</deferred>

---

*Phase: 06-login-ip-history-offline-geolocation*
*Context gathered: 2026-10-03*
