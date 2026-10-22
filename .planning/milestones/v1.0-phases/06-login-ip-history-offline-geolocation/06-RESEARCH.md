# Phase 6: Login-IP History & Offline Geolocation - Research

**Researched:** 2026-10-03
**Domain:** offline IP geolocation (build-time range tables), privacy-masked login table, hand-rolled SVG choropleth, opt-in same-origin binary dataset, all inside the project's zero-network contract
**Confidence:** MEDIUM-HIGH. Data sizes, formats and browser behaviour were measured this session (HIGH). Four findings contradict or complicate locked decisions and are listed under "Decisions Needing User Confirmation"; the plan should not lock until they are answered.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### IP data source (real 2021 export inspected 2026-10-03)
- **D-01:** Real export has **no `Logins.csv`**. IPs live only in the per-title `WOT_Game_Sessions.csv` (3,870 rows), `WOTB_Game_Sessions.csv` (47), `WOWS_Game_Sessions.csv` (12), header `STARTED_AT;FINISHED_AT;IP`. 58 distinct IPs, one IP holds 94% of rows, no IPv6, no blanks. Date formats differ per file (WOT `14.03.2013 14:30`, others quoted ISO). The login history is built from **all `*_Game_Sessions.csv` files merged**; each IP keeps the set of titles it appeared in. A `Logins.csv` (as in the invented fixtures), if an export has one, is merged in too. Researcher must confirm what Phase 4 already parses for these files and reuse it. A "login" = one session row. — **Reversibility:** costly — **Reversibility rationale:** the aggregate shape and worker message contract depend on the source set.
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
- **D-16:** After opt-in: a **city column in the IP table** plus a **ranked city list** (city, country, logins). The map stays country-level, no per-login markers. The CSP `connect-src` must allow only same-origin for this one asset; a Playwright check confirms the opt-in fetches only that asset and nothing before opt-in.

### Scale and testing
- **D-17:** Add a **synthetic fixture with 10k+ login rows** across many IPs and countries, including IPv6, malformed and unresolvable IPs, mixed date formats, and a `Logins.csv`-shaped file. Replace the invented `Logins.csv` shape in existing fixtures with real-shaped `*_Game_Sessions.csv` where tests allow. No real IPs committed (use RFC 5737/3849 ranges). The zero-network Playwright check must stay green.

### Claude's Discretion
- Geo build step design: `@ip-location-db/dbip-country` to binary range table, lookup algorithm (binary search), asset size, and where the table loads (worker only).
- Map asset generation (`world-atlas` + `d3-geo` at build time only), tiny-country handling, ISO code keys.
- Threshold for windowing, exact tile layout, tooltip styling, and wording of empty/unresolved states.
- City dataset format, and how the city lookup runs after opt-in (worker owns it, results re-aggregated).

### Deferred Ideas (OUT OF SCOPE)
- Consecutive-run grouping ("same IP, N logins, Jan-Mar") timeline view — possible later enhancement
- Per-row reveal control — rejected for now (global toggle only)
- Persisting city data in IndexedDB — rejected for v1
- Per-login map markers / city-level map — out of scope (country-level map only)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACTIVITY-05 | Login-IP history table, masked by default (e.g. last octet hidden) with a click-to-reveal toggle | IP parse/canonicalise/mask spec (Pattern 2), login aggregate at import with stored versioned record (Pattern 3), windowed table reuse of `windowRange` (Pattern 6), DOM-leak pitfalls (Pitfall 15), existing full-IP-never-in-DOM assertions that stay valid (Pitfall 20) |
| ACTIVITY-06 | Country-level geolocation of login IPs on a bundled world-map SVG; offline lookup only (DB-IP Lite pre-converted to a binary range table at build time), no live geo API, one-line attribution, bundled by default (~1-2MB) | Measured DB-IP country CSV and compact table sizes (Evidence), range-table container + lookup (Pattern 1), inline-in-worker delivery with `?inline` (Pattern 8), hybrid 110m+50m map with Intl-derived ISO keys (Pattern 5); the package named in AGENTS.md is deprecated (Decision 1) |
| ACTIVITY-07 | City-level geolocation as an explicit opt-in that lazy-loads a separate, much larger offline city database on demand, never bundled/downloaded by default, no live geo API | Measured city dataset (7.79M rows -> ~11.8 MB gzipped single file), opt-in loader + CSP/lint analysis (Pattern 7, Decision 3), GitHub Pages limits, route-fulfil e2e design, privacy argument against shards |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extracted from `./CLAUDE.md` -> `AGENTS.md` (the project instructions; same authority as locked decisions):

- **Privacy is the product:** no backend, no API calls, no analytics, zero network requests after page load, enforced by a Playwright CI assertion and a CSP meta tag. Every decision is subordinate to this.
- **Stack:** Svelte 5 with runes (no Svelte 4 patterns), Vite, pnpm (not npm). TypeScript pinned `^6` (repo has `~6.0.2`). No client-side router, no SvelteKit.
- **Dependency minimalism:** charts and the dropzone are hand-rolled on purpose; every library addition is weighed against hand-rolling. No chart or map library at runtime.
- **Worker rules:** ONE long-lived Worker reused across uploads, main-thread busy-guard; inside the worker `Papa.parse({ worker: false })` and fflate `unzipSync`; no nested workers.
- **Geo assets are build-time only:** `world-atlas` + `d3-geo` + `topojson-client` run in a Node script; none ships at runtime. AGENTS.md also names `@ip-location-db/dbip-country` as the concrete package (see Decision 1: this conflicts with measurements).
- **Scale:** designed for large exports; charts/maps aggregate per bucket, never one node per row; verify against a synthetic large fixture.
- **Browser target:** Chrome-first; mobile usable at phone width (Phase 7 owns the responsive pass, but Phase 6 components must not hard-code widths that break it).
- **Lint/format:** ESLint + Prettier + `eslint-plugin-svelte` + `typescript-eslint`; `svelte/no-inline-styles` and `svelte/no-at-html-tags` are errors in `src/`.
- **GSD workflow:** file edits go through a GSD command; **commits must NOT carry a `Co-Authored-By:` trailer** (AGENTS.md "Commits" rule, which overrides any tool-injected attribution text).

## Summary

The phase is feasible within the project's constraints, and almost every number the roadmap flagged as a risk was measured. The country table compacts to about 2.8 MB raw (about 0.8 MB gzipped on the wire) for IPv4 plus IPv6, exact to the 128-bit boundary, and a binary-search lookup of 10,000 addresses costs about 2 ms. The city dataset compacts from a 693 MB CSV (7.79 M rows) to one file of about 37-46 MB raw that gzips to about 11.8 MB; a Chromium worker inflated it in 64 ms and decoded the 3.4 M IPv4 entries in 25 ms. A single file fits GitHub Pages' 1 GB site limit with room to spare, and shards would leak which IP prefixes the user owns to the host, so one file is also the privacy-correct shape. The map is a 110m atlas (177 shapes, about 118 KB of path data) plus 61 small countries borrowed from the 50m atlas (about 17 KB), which leaves only 15 DB-IP codes with no polygon.

Four findings **contradict locked decisions or their premises** and need an explicit user answer before the plan locks: (1) the `@ip-location-db/*` npm packages named in AGENTS.md are deprecated by npm and by upstream, and are stale; the official DB-IP monthly downloads are the right source; (2) under D-17 every fixture IP resolves to "unknown" in the real table, so country shading cannot be proven from RFC 5737/3849 fixtures without a test seam; (3) a `<meta>` CSP does **not** govern a worker (measured), which changes how D-16's "CSP allows only this asset" can be honoured and where the opt-in `fetch` should live; (4) D-12's "Dexie schema bump per D-19 pattern" is a cache wipe, whereas the Phase 4/5 precedent (versioned aggregate plus lazy backfill from the stored rows, which still carry the IP) needs no bump. All four have a recommended default below.

The rest is established-pattern work: a new meta-backed `logins` channel on the existing worker contract, a pure aggregate module beside (not inside) the playtime aggregator so Phase 4's "IP never read" guarantee stays true, the existing `windowRange` for the table, the existing `--ramp-N` palette for a log-scale choropleth, and a build-script trio (`country` and `map` committed, `city` generated and gitignored). The only new dependencies are build-time: `world-atlas`, `d3-geo`, `topojson-client` (all named in AGENTS.md, all `OK` in the legitimacy gate) plus their `@types`.

**Primary recommendation:** Commit a generated country range table and world-map module (small, deterministic, no network or devDependency at `vite build` time, because the Playwright `webServer` runs `vite build` directly), inline the table into the worker chunk via `?inline` so the zero-network assertion is untouched, generate the city dataset as one pre-gzipped single file outside `vite build`, and fetch it from exactly one lint-exempt module. Resolve Decisions 1-4 first.

## Decisions Needing User Confirmation

Items 1-4 block locking the plan. Each has a recommended default so planning can proceed once the user answers; the planner should insert a `checkpoint:decision` for each. IDs map to the Assumptions Log.

| # | Decision | Why it needs the user | Recommended default | Planner action |
|---|----------|----------------------|---------------------|----------------|
| 1 | **Geo data source.** AGENTS.md / ACTIVITY-06 name `@ip-location-db/dbip-country`. | npm marks it `deprecated: "Package no longer supported..."`; the gate returned SUS (low downloads + deprecated); upstream says npm updates "are completely deprecated and will stop" and the npm data "contains bugs resulting in incorrect data"; `@ip-location-db/dbip-city` stops at 2025-01 and `dbip-city-lite` does not exist on npm. Measured: 97.35% of /24 blocks agree with the official 2026-10 CSV; its IPv4 has no gap rows. | Use the **official DB-IP downloads** `https://download.db-ip.com/free/dbip-country-lite-YYYY-MM.csv.gz` and `...dbip-city-lite-YYYY-MM.csv.gz` for both tiers (same CC BY 4.0, one source, same month, explicit `ZZ` rows for reserved space). Build scripts accept a local CSV path so the mirror remains a fallback. Install nothing from `@ip-location-db`. | `checkpoint:decision` first; if the user insists on the package, tag it `[WARNING: flagged as suspicious]` and add `checkpoint:human-verify` before install (A1) |
| 2 | **Fixtures vs real table (D-17).** | `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` and `2001:db8::/32` all map to `ZZ` in DB-IP. Against the production table the 10k fixture shades no country, so success criteria 2 and 4 cannot be proven as written. RFC 5737 also offers only 762 usable IPv4 addresses (3 x 254). | (a) The lookup is a **pure function taking the table as an argument**; unit tests inject a synthetic table that maps documentation ranges to countries. (b) For e2e, a **build seam**: `GEO_FIXTURE=1` (set via `webServer.env`) aliases the worker's table import to a small committed fixture table and emits a tiny fixture city file; production builds never set it, and a unit guard proves the shipped table resolves `192.0.2.1` to unknown. Use `2001:db8::/32` for bulk distinct addresses. | `checkpoint:decision`: seam vs a small exception list of public-infrastructure IPs (conflicts with D-17's literal wording) |
| 3 | **Where the city `fetch` lives and what the CSP says (D-16).** | **Measured:** a `<meta>` CSP with `connect-src 'none'` blocked a main-thread `fetch` but a module-worker `fetch` returned 200; Playwright's `context.on('request')` recorded the worker request. So "CSP allows only this asset" is unenforceable for a worker fetch, and `'self'` cannot be path-restricted. | **Option A (recommended): fetch on the main thread**, `connect-src 'self'` (this is D-16's wording), transfer the `ArrayBuffer` to the worker. Keeps the worker lint ban absolute (the worker holds the raw rows and must never be able to fetch), the CSP governs the one fetch, and Abort/cancel is a plain `AbortController`. Enforcement: one eslint-exempt call site, a guard test, Playwright request assertions. **Option B:** fetch in the worker with `connect-src 'none'` unchanged: needs a worker lint exemption, a new cancel message, and the fetch is invisible to CSP. | `checkpoint:decision`; update `zero-network.spec.ts` line 83 and the run skill text whichever option wins |
| 4 | **D-12 "Dexie schema bump per D-19 pattern".** | D-19's `version(2)` upgrader calls `rows.clear()` and `meta.clear()`: a bump costs every returning user their cached dataset. Phase 4/5 added meta fields with no bump and rebuilt stale ones lazily from the stored rows. The rows keep the `IP` column (the importer pushes every parsed row), so a backfill is lossless. | **No Dexie version bump.** Add a versioned `logins` field (`LOGINS_VERSION` plus the geo-table id) to the `meta` record and backfill lazily, exactly like `PLAYTIME_VERSION`. If a bump is still wanted: `version(3)` with **no clearing upgrader**, and keep the `version(2)` block (db.ts rule 1). | `checkpoint:decision` (confirm reading of D-12) |
| 5 | Country table delivery. Phase 7 SC4 says the "country geo table ... load[s] without 404s". | A separate runtime asset means a post-load request (and a worker fetch the lint bans); inlining means no request at all. | **Inline in the worker chunk** (`?inline`, measured 3.73 MB chunk for a 2.8 MB table). Amend Phase 7 SC4's wording: nothing to 404 for the country table. | Note in the plan; flag for the Phase 7 discuss |
| 6 | "Copy actions" and `document.title` (D-07, SC1). | The app sets no title and has no clipboard code today (grep: no `document.title`, no `clipboard` in `src/`). | Satisfy by **invariant, not features**: the DOM never holds an unmasked IP while masked (so native selection/copy is masked), the title stays static, and tests assert both. Add no copy button in v1. | Plan the tests; confirm no button wanted |
| 7 | City button when the build has no city asset (local `vite build`, CI PRs). | Nothing may be fetched, and the "~N MB" label needs the size at build time. | Bake `{file, bytes, month, sha256, source}` into the bundle from a manifest at build time; when absent, hide the opt-in and say once, in text, that this build ships no city data. | Specify in the UI-SPEC |
| 8 | D-03 "timestamps as written" vs mixed formats (`14.03.2013 14:30` vs ISO). | Ordering needs parsing; display of two formats in one column looks broken. | Parse with the existing `parseSessionTimestamp` for min/max, display **date-only `YYYY-MM-DD` from the wall-clock seconds** (no timezone conversion, so D-01 holds). | Confirm in UI-SPEC |
| 9 | Who runs real city generation and when. | D-13 says "CI build"; the CI workflow today has no deploy job (Phase 7). A 86 MB download per PR on a self-hosted runner is wasteful. | Phase 6 delivers `geo:city` (real) and fixture mode; PR CI stays hermetic on fixtures; Phase 7's deploy job runs real mode with `actions/cache` keyed on the DB-IP month and asserts `manifest.source === 'dbip'`. | Note the hand-off in both phases |
| 10 | e2e budget. | Every new Playwright test moves `ci-budget.test.ts` constants. | Raise `globalTimeout`, the `timeout Nm` wrapper and `timeout-minutes` **together** with the guard constants. | Include as a task |

## Architectural Responsibility Map

This is a single-page, zero-backend app, so "tiers" are runtime contexts.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse session/Logins rows into the login aggregate, resolve country per distinct IP | Web Worker (import) | Dexie `meta` record | D-12; the worker is the sole Dexie owner and the only place raw rows exist |
| Country range table (data + decode + lookup) | Web Worker (inline in worker chunk) | Build script (generation) | Main thread must never load it (D-12); inlining keeps zero post-load requests |
| Build-time table/map/city generation | Node build scripts | CI | Geo tooling is build-time only (project constraint) |
| Mask/reveal state, `maskIp` rendering | Browser main thread | — | Per-render, instantaneous toggle; state resets on replace/clear |
| IP table windowing, sort, tiles, ranked lists | Browser main thread (pure model + Svelte) | — | Same pattern as the Phase 5 vehicle table; rows arrive pre-aggregated |
| World map drawing | Browser main thread (static SVG paths generated at build) | — | Country highlight is a class/attribute toggle; zero D3 at runtime |
| City dataset download (fetch, progress, cancel) | Browser main thread (one lint-exempt module) | CDN/static (GitHub Pages) | Recommended Option A, so the CSP governs it and the worker stays fetch-free (Decision 3) |
| City decode and lookup | Web Worker | — | D-12/discretion: worker owns lookups; main thread only transfers bytes |
| City asset hosting | CDN / Static | — | Same-origin file in the Pages artifact, not in git (D-13) |
| Attribution caption | Browser main thread | — | Visible text plus a link-back (CC BY 4.0) |

## Standard Stack

### Core

No new runtime dependency. The phase is hand-rolled on browser and Node platform APIs plus what the repo already ships.

| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| Svelte 5 runes | `^5.57.0` in package.json [VERIFIED: package.json:31] | Block components | Project constraint |
| Dexie | `^4.4.6` [VERIFIED: package.json:39] | `meta` record (versioned `logins` field) | Existing persistence |
| PapaParse | `^5.7.0` [VERIFIED: package.json:41] | Session CSV parse (already done at import) | Existing; Phase 4 parse path reused |
| `Intl.DisplayNames` (browser) | platform | English country names (D-11) | No bundled name list |
| `DecompressionStream('gzip')` (browser/worker) | platform | Inflate the pre-gzipped city file | No library; measured 64 ms for 11.8 -> 37.2 MB in Chromium worker [VERIFIED: probe this session] |
| `node:zlib`, `node:readline`, `node:fs` | Node 24 (CI) / 26.10 (local) | Build scripts | Node runs `.ts` scripts natively, probed OK on 26.10 [VERIFIED: probe]; `erasableSyntaxOnly` is already on in `tsconfig.node.json` |

### Supporting (build-time devDependencies only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `world-atlas` | `2.0.2` (registry, modified 2022-06-29) [VERIFIED: npm registry + gsd package-legitimacy OK] | TopoJSON countries 110m + 50m | Map generation script only |
| `d3-geo` | `3.1.1` (2024-03-12) [VERIFIED: npm registry + gate OK] | `geoNaturalEarth1`, `geoPath`, `geoCentroid` | Map generation script only; never imported under `src/` |
| `topojson-client` | `3.1.0` (2022-06-27) [VERIFIED: npm registry + gate OK] | TopoJSON -> GeoJSON `feature()` | Map generation script only |
| `@types/d3-geo`, `@types/topojson-client` | registry showed 3.1.1 and 3.1.5 [ASSUMED: discovered by search, gate returned OK] | Type-check the `.ts` build scripts under `tsc -b` | Alternative: a local `declare module` shim; `checkpoint:human-verify` before install |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Official DB-IP downloads | `@ip-location-db/dbip-country` npm mirror | Pinned in the lockfile, but deprecated, stale (2026-06), 67.6 MB install, 97.35% /24 agreement with official, no `ZZ` rows. Fallback only |
| One single city file | Shards by IP prefix | Shard requests would reveal which IP prefixes the account used to the static host; a single file leaks nothing. Also fits Pages limits |
| `fetch` + `DecompressionStream` | A JS gzip/brotli library | Dependency for no gain; the native stream is available in Chrome-first target |
| Inline table in worker | Separate `.bin` fetched by the worker | Adds a post-load request, needs a worker lint exemption, and Playwright's baseline would have to change |
| Committed country table | Generate during `vite build` | `playwright.config.ts` runs `./node_modules/.bin/vite build && ./node_modules/.bin/vite preview` directly, so no `prebuild` script runs and the build would need a 4.5 MB download on every e2e run |

**Installation:**
```bash
pnpm add -D world-atlas@2.0.2 d3-geo@3.1.1 topojson-client@3.1.0
pnpm add -D @types/d3-geo @types/topojson-client   # after checkpoint:human-verify
```

**Version verification:** run this session: `npm view world-atlas|d3-geo|topojson-client version dist.unpackedSize license time.modified` returned 2.0.2 / 3.1.1 / 3.1.0 with ISC licences and no `postinstall`. `package-legitimacy` verdicts below.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `world-atlas` | npm | first published 2019-09-05 (~7 yrs) | ~1.4M/wk | github.com/topojson/world-atlas | OK | Approved (named in AGENTS.md) |
| `d3-geo` | npm | modified 2024-03-12 | ~39.5M/wk | github.com/d3/d3-geo | OK | Approved (named in AGENTS.md) |
| `topojson-client` | npm | first published 2019-11-06 | ~8.6M/wk | github.com/topojson/topojson-client | OK | Approved (named in AGENTS.md) |
| `@types/d3-geo` | npm | modified 2026-07-31 | ~32.6M/wk | github.com/DefinitelyTyped/DefinitelyTyped | OK | `[ASSUMED]`: name discovered by search, so `checkpoint:human-verify` before install |
| `@types/topojson-client` | npm | modified 2024-09-16 | ~2.4M/wk | github.com/DefinitelyTyped/DefinitelyTyped | OK | `[ASSUMED]`: same gating |
| `@ip-location-db/dbip-country` | npm | latest 2.3.2026060120 (2026-06-01) | ~432/wk | github.com/sapics/ip-location-db | **SUS** (low-downloads, deprecated) | **Not recommended.** `` `@ip-location-db/dbip-country` [WARNING: flagged as suspicious — verify before using.] `` If the user keeps it, the planner must add `checkpoint:human-verify` before install |
| `@ip-location-db/dbip-city` | npm | latest 2.3.2025010119 (2025-01-01) | ~244/wk | github.com/sapics/ip-location-db | **SUS** (low-downloads, deprecated) | **Not recommended:** 21 months stale, 196.8 MB unpacked |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `@ip-location-db/dbip-country`, `@ip-location-db/dbip-city` (planner inserts `checkpoint:human-verify` only if the user overrides Decision 1). `npm view @ip-location-db/dbip-city-lite` returned E404: that name does not exist, so CONTEXT D-13's "`dbip-city-lite` source" can only mean the DB-IP dataset itself.

*Postinstall check:* `npm view <pkg> scripts.postinstall` returned empty for the three approved packages [VERIFIED: gate `postinstall: null`].

## Evidence: measured geo data (all this session)

### DB-IP country (official `dbip-country-lite-2026-10.csv.gz`, published 2026-10-01)

| Fact | Value |
|------|-------|
| Format | `start,end,CC` (3 columns, IPv4 and IPv6 in one file), e.g. `1.0.0.0,1.0.0.255,AU` |
| Rows | 710,834 (IPv4 362,122; IPv6 348,712); 251 distinct codes including `ZZ` |
| Size | 31.2 MB raw, 4.49 MB gzip (HEAD `content-length: 4491785`) |
| Coverage | **Contiguous**: 0 gaps and 0 overlaps in both families; reserved space is explicit `ZZ` (`10.0.0.0/8`, `127.0.0.0/8`, `192.168.0.0/16`, `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, the IPv6 span `::` to `1fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff`, `2001:db8::/32`, `fc00::/7`, `fe80::/10`) |
| npm mirror `@ip-location-db/dbip-country@2.3.2026060120` | IPv4 355,800 rows, **0 `ZZ` rows**, 67.6 MB unpacked; separate `-ipv4`/`-ipv6` and `-num` files; same 3-column layout |
| Agreement, mirror vs official (v4, 14,486,865 /24-block sample points) | 97.35% (largest diffs US->GB 200,828 blocks, GB->US 22,467); part is normal 4-month drift, the cause was not isolated |

### Compact country table (prototype)

| Layout | Raw bytes | Gzip -9 | Notes |
|--------|-----------|---------|-------|
| IPv4: varint start-deltas + 1-byte code index | 1,100,929 | n/a | 362,122 entries; adjacent same-code merge removes nothing (already merged) |
| IPv6 exact: varint deltas of the high 64 bits + varint of the low 64 bits + 1-byte code | hi 1,338,473 + lo 348,870 + cc 348,712 | 253,881 as separate planes (lo plane gzips to 988 bytes) | **Exact**: 419 of 348,712 starts have non-zero low halves |
| IPv6 high-64-only | 1,684,928 incl. cc | n/a | **Lossy**: 298 ranges collide on the high 64 bits (country), so do not truncate |
| Whole table, interleaved | about 2.8-3.1 MB | about 0.8 MB | In the worker chunk as base64: 3.73 MB measured |

REQUIREMENTS says "small: ~1-2MB"; the raw table is about 2.8 MB, about 0.8 MB gzipped. Flag the delta; it is the cost of exact IPv6 and of ZZ gap rows.

### DB-IP city (official `dbip-city-lite-2026-10.csv.gz`)

| Fact | Value |
|------|-------|
| Format | `start,end,continent,CC,state,city,lat,lon`, quoted fields (`"South Brisbane"`) |
| Size | 692.8 MB raw, **85.8 MB gzip** (HEAD `content-length: 85827400`; the page text said "660.7 MB", which is the raw size) |
| Rows | 7,786,864 (IPv4 3,620,434; IPv6 4,166,430); 194,466 distinct (CC,state,city); 5 with empty city |
| After dropping lat/lon and merging adjacent same-place ranges | IPv4 3,419,135; IPv6 3,836,310 |
| Compact container | 37.2 MB ranges + 5.6 MB string table = 42.8 MB raw interleaved |
| Gzip -9 | interleaved 13.6 MB; **columnar planes with place ids sorted: 11.85 MB** (brotli 9.9 MB, but `DecompressionStream` is gzip/deflate); IPv4-only 6.3 MB |
| Timings (Node/V8, Chromium worker) | stream-parse of the 693 MB CSV about 8 s; decode 3.4 M IPv4 entries 25 ms; 10k binary searches 2.1 ms; BigInt decode of 3.8 M IPv6 entries 118 ms (split-32-bit 35 ms); worker `DecompressionStream` 11.8 -> 37.2 MB in 64 ms |
| IPv6 alignment | 7,836 of 4,166,430 starts have a non-zero low half; 271,449 are not /48-aligned, so a /48 key would be lossy; use exact (high 64 + sparse/dense low 64) |

ACTIVITY-07 and the roadmap estimated the city database at "~60-70MB"; the measured compact form is about 42.8 MB raw and **11.85 MB gzipped**, so the size warning in D-14 should be computed from the real manifest, not from that estimate.

### Month availability (HEAD probes)

`dbip-city-lite-2026-10` and `-2026-09` returned 200; `dbip-city-lite-2025-01` and `dbip-country-lite-2026-06` returned **404**. Old months disappear, so a pinned URL breaks; CI must try the current UTC month and fall back to the previous one, and record the month actually used in the manifest. (That only the recent two months are kept is inferred, A3.)

### World map (`world-atlas@2.0.2`, `geoNaturalEarth1` fit to 960x500, `geoPath().digits(1)`)

| Variant | Features | Path chars |
|---------|----------|-----------|
| 110m | 177 (3 with no `id`: N. Cyprus, Somaliland, Kosovo) | 118,075 |
| 50m | 241 (5 with no id) | 1,105,510 |
| Hybrid: 110m + the 61 50m features whose alpha-2 is absent from 110m | 238 | 118,075 + 16,967 |

DB-IP has 251 codes; 76 are absent from 110m (SG, HK, MT, BH, MC, LI, ...); after the hybrid only **15** have no polygon: `RE, GI, YT, MQ, GP, GF, XK, TK, TV, UM, BQ, BV, SJ, CC, CX`. `XK` can be assigned from the feature named "Kosovo" (it has no id). Numeric id -> alpha-2 needs **no table**: `Intl.getCanonicalLocales('und-' + id)[0].split('-')[1]` mapped all 174 ids with an id in 110m [VERIFIED: probe, Node 26.10]. Runtime names differ from the atlas's (`Türkiye`, `Congo - Kinshasa`, `Hong Kong SAR China`), which is why names come from `Intl.DisplayNames`, not the atlas.

### Probes that change the design

1. **Meta CSP vs worker** (Chromium 1243 via the repo's Playwright, throwaway server):
```
console: Connecting to 'http://127.0.0.1:63927/data.txt' violates the following Content Security Policy directive: "connect-src 'none'". The action has been blocked.
{"main":"ERR Failed to fetch","worker":200}
context requests: [ .../index.html, .../main.js, .../worker.js, .../data.txt ]
```
The worker's fetch succeeded under `connect-src 'none'` and `context.on('request')` recorded it, which contradicts the comment in `zero-network.spec.ts` that worker fetches are not reliably captured.
2. **Main-thread opt-in path under `connect-src 'self'`:** streaming `fetch` of an 11.8 MB gzip file, transfer to a worker, worker inflate: `{"status":200,"type":"application/gzip","got":11771757,"magic":[31,139],"detached":0,"worker":{"inBytes":11771757,"outBytes":37243769,"ms":64}}`. `content-length` was null only because the throwaway server sent none.
3. **`page.route(...).fulfill(...)` requests still appear in `context.on('request')`**, so a hermetic route-fulfilled city asset can still be counted.
4. **`?inline` on a `.bin`:** fails with `Could not load ...?inline` / `invalid JS syntax` until `assetsInclude: ['**/*.bin']` is set in **both** the Vite and Vitest configs; then the worker chunk was 3,733,472 bytes for a 2.8 MB file and a Vitest import returned a string.

## Architecture Patterns

### System Architecture Diagram

```
                  BUILD TIME (Node, never shipped)
  DB-IP country CSV.gz --scripts/geo/build-country-table.ts--> src/lib/geo/assets/country-v1.bin   (committed, ~2.8 MB)
  world-atlas 110m+50m --scripts/geo/build-world-map.ts------> src/lib/geo/world-map.generated.ts  (committed, ~135 KB)
  DB-IP city CSV.gz ----scripts/geo/build-city-dataset.ts----> public/geo-city-data/city-YYYY-MM.citydb.bin + manifest.json
                                                               (gitignored by `**/geo-city-data/`; ~11.8 MB gz; CI/deploy only)
  vite build: ?inline(country-v1.bin) -> worker chunk | manifest -> define __GEO_CITY__ | public/ -> dist/

                  RUNTIME (browser)
 drop .zip --> [Web Worker, single instance]
                 unzip -> parse CSVs (existing) -> session sources (+ Logins.csv)
                 buildLogins(sources, lookupCountry) --country table (inline, decoded once, lazily)--> LoginAggregates
                 writeDataset(... meta.logins ...)  (Dexie `meta` 'active' record, versioned)
 Main thread
   Dashboard -> LoginHistory block --data-query {channel:'logins'}--> worker answers from meta (or lazy backfill from rows)
        <-- LoginsView { tiles, rows[distinct IP], countries[], account record, unresolved }  (no raw rows, no per-login data)
   mask state (one rune, resets on importedAt change) --> maskIp() at render --> table (windowRange) / tiles / map tooltip
   WorldMap: static <path> per country, class=level-N from log scale over per-country counts
   [Opt-in click] --> city-fetch.ts (ONLY fetch call; AbortController; progress)
        --one same-origin GET of manifest.file--> bytes --postMessage(buf,[buf])--> worker: gunzip(sniff 1f8b) -> decode -> lookup
        <-- CityView { placeIds per row, places[], ranked[] }  --> city column + ranked list (session only, not persisted)
```

### Recommended Project Structure
```
scripts/geo/
├── build-country-table.ts   # DB-IP country CSV(.gz, path or --download) -> src/lib/geo/assets/country-v1.bin
├── build-world-map.ts       # world-atlas -> src/lib/geo/world-map.generated.ts
├── build-city-dataset.ts    # streaming DB-IP city CSV.gz -> public/geo-city-data/*.citydb.bin(+manifest.json)
└── lib/                     # download-with-month-fallback, quoted-CSV line parser
src/lib/geo/
├── ip.ts                    # parseIp / canonicalIp / maskIp (pure, no DOM)
├── range-table.ts           # container writer+reader, predecessor lookup (pure; shared with scripts)
├── country-table.ts         # WORKER-ONLY: decode the inlined asset once, cache
├── country-names.ts         # Intl.DisplayNames wrapper (guards ZZ / invalid codes)
├── city-fetch.ts            # MAIN-THREAD, the ONE eslint-exempt fetch (Decision 3 Option A)
├── world-map.generated.ts   # committed generator output
└── assets/country-v1.bin    # committed
src/lib/features/logins/
├── login-shared.ts          # types, LOGINS_VERSION, caps (pure, imported by both sides)
├── login-aggregate.ts       # pure: sources + lookup -> aggregates (separate from playtime-aggregate)
├── login-model.ts           # pure: sort, tiles, map levels, ranked lists, a11y strings
├── login-state.ts           # derive state / accept outcome (same shape as playtime-state)
├── LoginHistory.svelte, LoginSummary.svelte, LoginTable.svelte, WorldMap.svelte, CountryList.svelte, CityOptIn.svelte
tests/fixtures/geo/          # tiny fixture country/city tables (documentation ranges -> fake countries)
tests/fixtures/logins-fixtures.ts, tests/helpers/login-oracle.ts   # seeded generator + import-nothing oracle
tests/e2e/logins/            # history, map, city opt-in, scale
```
`src/lib/shell/LoginHistorySection.svelte` (the placeholder) is replaced; its heading constant `LOGIN_HISTORY_HEADING = 'Login history'` and both sub-headings' identical `h3` style (value-for-value with `Playtime.svelte`) must be kept.

### Pattern 1: Range-table container with a pure, table-injected lookup
**What:** one binary container used for country (`kind=1`) and city (`kind=2`): magic, version, kind, flags (bit0 = fixture), source month, counts, a place table (country: 2-letter codes; city: `CC\tState\tCity` strings), then IPv4 section (start-delta varints plane + id plane) and IPv6 section (high-64 delta plane + low-64 plane + id plane). The builder **normalises the source**: sort, fill gaps and the leading `0.0.0.0` hole with an explicit `ZZ`/unknown id, merge adjacent same-id ranges, so every address resolves and a mirror CSV without `ZZ` rows behaves the same as the official one. Lookup is predecessor search (largest start <= address) over typed arrays; the table is an **argument**, never a module global, so unit tests inject synthetic tables.
**When to use:** the only lookup used by both tiers. IPv6 uses `BigUint64Array` for the high half (decode 118 ms for 3.8 M entries; the BigInt-vs-split-32 difference is not worth extra code).
**Example:**
```ts
// Source: probe-measured design; see Evidence. Pure module, imported by worker AND scripts.
export interface RangeTable {
  v4Starts: Uint32Array;
  v4Ids: Uint32Array;          // index into `places`; id of the explicit unknown entry is table-specific
  v6Hi: BigUint64Array;
  v6Lo: BigUint64Array;        // dense plane, almost all zero (gzips to ~1 KB); sparse is an optimisation
  v6Ids: Uint32Array;
  places: readonly string[];
}

/** Predecessor search: the id of the last range whose start <= addr, or -1 before the first start. */
export function lookupV4(table: RangeTable, addr: number): number {
  const { v4Starts: s, v4Ids: ids } = table;
  if (s.length === 0 || addr < s[0]!) return -1;
  let lo = 0;
  let hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (s[mid]! <= addr) lo = mid;
    else hi = mid - 1;
  }
  return ids[lo]!;
}
```
The IPv6 analogue compares `(hi, lo)` lexicographically. Test edge cases: first and last address of a range, the address one before a boundary, address 0, `255.255.255.255`, `::`, `ffff:...:ffff`, an address inside a /64 that straddles two ranges.

### Pattern 2: IP parse, canonicalise, mask (pure, never throws, never echoes input)
**What:** `parseIp(raw)` accepts only strict dotted-quad decimal (each octet 0-255; **reject leading zeros** other than a lone `0`, because `inet_aton` reads them as octal) and RFC 4291 IPv6 text (compression `::`, mixed-case, embedded dotted tail such as `::ffff:192.0.2.1`; strip and reject a `%zone`). It returns `{ family, bytes, canonical }` or `null`. `canonical` is the grouping key: IPv4 dotted decimal; IPv6 lower-case fully expanded 8 groups without leading zeros, so `2001:DB8::1` and `2001:db8:0:0:0:0:0:1` are one row. An IPv4-mapped IPv6 address resolves through the IPv4 table. All regexes anchored with no nested quantifiers (RESEARCH Pitfall 3 of Phase 4 applies here too).
`maskIp(canonical)`: IPv4 -> `a.b.c.xxx`; IPv6 -> first three groups then `:xxxx` x5 (hides the low 80 bits, D-06). A value that does not parse is **never displayed**: it joins one "Unrecognised address" row (count only), because a cell can hold any text including an email or a name (Phase 3 D-21 keeps dataset text off the screen).
**When to use:** at aggregate time (canonicalise) and at render time (mask).
**Anti-pattern:** masking by `str.slice` or `lastIndexOf('.')`: it breaks on IPv6, IPv4-mapped addresses and padded values.

### Pattern 3: Login aggregate computed at import, stored versioned, backfilled lazily
**What:** a new module `login-aggregate.ts`, **beside, not inside, `playtime-aggregate.ts`**. `playtime-aggregate.ts` states "T-04-01 — the IP column is never read", and the tests `playtime.test.ts` (`describe('T-04-01: the IP column is never read'...)`, lines 350, 1167, 1516) assert it; keep that module and those tests untouched. The import loop already collects `SessionSource[]` per session file (`sessionFileGame`, `isSessionsRow`); push the same row objects into a second collection that also takes `Logins.csv` rows (header `LOGIN_DT;IP;...` in the existing fixture). Resolve columns from the first row's keys with `headerKey`/`cell`: IP column `IP`; time column among `STARTED_AT`, `SESSION_START`, `LOGIN_DT`.
Aggregate per canonical IP: `logins`, `first`/`last` (min/max of `parseSessionTimestamp`, kept as wall-clock seconds, displayed date-only), `titles` (set of `sessionFileGame` tokens; `Logins.csv` and legacy `Sessions.csv` have none), `cc` (resolved once per **distinct** IP, never per row). Blank/malformed IP rows count into one unrecognised bucket. Cap distinct rows (recommended `MAX_LOGIN_IPS = 20_000`; the excess folds into counted-but-unlisted "other addresses") so a hostile archive cannot bloat the record (same idea as `MAX_SPLIT_VALUES = 50`).
**Storage:** a `logins` field on the existing `meta` record `id: 'active'`, written in the same `meta.put` as the rows (atomic with them), with `{ v: LOGINS_VERSION, geo: <table id/month>, ... }`. A version or table-id mismatch triggers a lazy rebuild from stored rows through a reader generalising `readSessionRowData` (which today screens by `isSessionFileName`, so it would **skip `Logins.csv`**: extend the predicate or add a sibling reader), guarded by an `importedAt` compare-and-write like `writePlaytimeIfCurrent`. No Dexie version is added (Decision 4). `checkCache()` reads the whole `active` record on every query, so keep the aggregate compact (columnar arrays; about 50 bytes per row; 20,000 rows is about 1 MB).
**D-02 Account record:** `extractIdentity` has a private `pick`; add a sibling in `identity.ts` that reads `IP`, `COUNTRY_CODE`, `CITY` from the same already-sanitised row, and show those values as recorded (no lookup), as one labelled row that follows the mask and is excluded from every total.

### Pattern 4: Worker contract
**What:** extend `DataQuery`/`DataResult` with `{ channel: 'logins' }` -> `LoginsView`, so the existing per-channel supersede in `QueryClient` applies. But `handleDataQuery` today always reads `DATA_FILES[query.channel]` and calls `readRowsByFile`: the `logins` channel needs its **own branch before that lookup** (answer from `meta`, else backfill), `isDataQuery` must accept it (it rejects unknown channels and rejects stray fields), and `DATA_FILES` is typed `Record<DataQuery['channel'], ChannelFiles>`, so narrow it to `Exclude<..., 'logins'>`. Alternative with less coupling: a dedicated `login-query` pair like `playtime-query`. Either way: **keep the aggregate off `ClassifyResult`** (the client holds it as a deep `$state` proxy), echo `importedAt` so the main thread drops replies for a replaced dataset, and answer failures with a fixed detail string, never an error message.
**City messages:** `{ type: 'city-load', loadId, buffer, expectedBytes?, sha256? }` (transfer list: `WorkerLike.postMessage(message)` has no transfer parameter today, widen it) -> `{ type: 'city-result', loadId, importedAt, view }` or `{ type: 'city-error', loadId, detail }`. Under Option A there is **no cancel message**: cancelling is `AbortController.abort()` on the main thread. (The roadmap's "no CANCEL message in v1" concerns ingest; scope it that way if Option B is chosen.) The worker keeps the decoded city table in module memory until reload (nothing to wipe on Clear, D-15) and re-resolves cities for a replaced dataset without re-downloading.

### Pattern 5: Map = generated static paths + pure model + log-scale levels
**What:** `build-world-map.ts` does: `feature(topo, topo.objects.countries)` for 110m, then the 50m features whose alpha-2 is absent from 110m (hybrid), alpha-2 from `Intl.getCanonicalLocales('und-' + id)`, the feature named "Kosovo" -> `XK`, drop Antarctica (id `010`), project with `geoNaturalEarth1().fitSize([960, 500], { type: 'Sphere' })`, `geoPath(...).digits(1)`, and emit `export const WORLD_VIEWBOX` plus `{ iso, d, cx, cy, tiny }[]` (centroid from `geoPath.centroid`; `tiny` when the projected bbox area is under a threshold such as 12 px^2). Commit the output (about 135 KB; it joins the main chunk, so **no dynamic `import()` for the map**, see Pitfall 1).
Runtime: one `<path>` per country, `class="level-N"` painting `fill: var(--ramp-N)`, white hairline stroke; `tiny` countries with logins also get a 3-4 px circle at the centroid (still per country, never per login). Only countries with logins are focusable (`tabindex="0"`, `<title>` accessible name); everything else is decorative. Countries with no polygon (15 codes) are reachable only through the ranked list, and the caption says how many are not drawn.
**Log scale (D-09):** `level = count <= 0 ? 0 : 1 + min(4, floor(4 * ln(count) / ln(max)))` (max count gets level 5, count 1 gets level 1; `max === 1` -> all level 1). The legend states the bin edges as text. Use the existing `--ramp-0..5` tokens, never restate hex; pin the contrast pairs in `tests/unit/charts/contrast.test.ts` style (it recomputes ratios from the declarations in `src/app.css`).

### Pattern 6: Windowed IP table reuses `windowRange`
`windowRange(scrollTop, viewportPx, total, overscan)` is pure and generic but lives in `vehicle-model.ts` with `ROW_PX = 40`, `OVERSCAN_ROWS = 6`, `SCROLLER_MAX_PX = 480`. Hoist those four exports to a shared module (re-export from `vehicle-model.ts` so its tests stay green) and build `LoginTable.svelte` on the same structure as `VehicleTable.svelte`: scroller `role="region"` with `tabindex="0"`, two spacer rows sized through the CSSOM (`element.style.height`, because `style-src` has no `unsafe-inline` and `svelte/no-inline-styles` is an error), `aria-rowcount`/`aria-rowindex`, native `<th aria-sort>`. **Lesson recorded in that file:** read the derived values into locals *before* guarding on the element refs in the geometry `$effect`, or the effect registers no dependency on the first run and a 5,000-row table shows a scrollbar for 18 rows; do not name a derived value `window`. A reset key bumps the scroller to the top on sort. Threshold: window always (the cost is the same 30 DOM rows whatever the count; no "windowed above N" branch to get wrong).
Sorting is a pure comparator on the full canonical key (IP column sorts numerically by address). Whether IP-column order should be offered while masked is the planner's call (order leaks the relative size of the hidden octet; low risk, document the choice).

### Pattern 7: City opt-in (Option A shape)
**What:** `CityOptIn.svelte` holds one state machine `idle -> downloading(n/total) -> decoding -> ready | error | cancelled`. The button label comes from the build-time manifest (`~N MB` from `bytes`). `city-fetch.ts` (the only file with `fetch`) does `fetch(url, { signal })`, reads `response.body.getReader()`, reports progress against the manifest's `bytes` (`Content-Length` is unreliable: it was null in a probe and GitHub Pages may transfer-encode), concatenates into one `Uint8Array`, and returns its buffer. It then `postMessage(...)`s with the buffer transferred (a 11.8 MB transfer is zero-copy). The worker sniffs the gzip magic `1f 8b` (a server that re-encodes would already have been decoded by the browser; a server that serves `.gz` with `Content-Encoding: gzip` would strip our layer; sniffing handles all three), inflates with `new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()`, checks the header (magic, version, kind=city, counts consistent with section lengths, decompressed size under a hard cap), optionally verifies the manifest `sha256` with the existing `digestFile`, and decodes. Cancel or failure never touches the country view; the error is a fixed sentence, never `error.message`.
**URL:** build it from `import.meta.env.BASE_URL` (Phase 7 sets a subpath): `new URL(`${import.meta.env.BASE_URL}geo-city-data/${file}`, location.href)`; no query string, no user data in the request.
**What is shown after load (D-16):** a city column (`City, State, CC`; empty-city places read as the country only) and a ranked city list `(city, country, logins)`; the map stays country-level.

### Pattern 8: Delivering the country table without a request, and the test seam
`import tableUrl from '#geo/country-table?inline'` in the worker-only `country-table.ts`; the specifier is a Vite `resolve.alias` key so the build can point it at the real committed `country-v1.bin` or, when `GEO_FIXTURE=1`, at a tiny fixture table; `vitest.config.ts` needs the same alias and `assetsInclude: ['**/*.bin']` (it is a separate config and tried-and-failed without them), and an ambient `declare module '#geo/country-table?inline'` for `tsc`. Decode lazily on first lookup (base64 `atob` -> bytes -> typed arrays), cache in module state.
The decode is cheap but not free, so it must not run at worker start (the worker spawns eagerly and posts `ready`).
`webServer.env` in `playwright.config.ts` sets `GEO_FIXTURE=1`. A committed unit test must fail if the **production** table resolves a documentation address to anything but unknown, so the seam cannot leak a fixture table into a deploy build.

### Pattern 9: Build scripts run as Node `.ts`
Scripts are `.ts` executed natively (`node scripts/geo/build-country-table.ts`), importing the shared pure modules with explicit `.ts` extensions. Add them to `tsconfig.node.json` `include` (today only `vite.config.ts`), add `scripts/**` to the ESLint node-globals block (today a fixed file list), add `package.json` scripts (`geo:country`, `geo:map`, `geo:city`, `geo:city:fixture`). `build-city-dataset.ts` must **stream** (`createReadStream` -> `createGunzip` -> `readline`) and write varints into a growing buffer; never materialise 7.8 M tuples. Two passes (collect and sort place keys, then emit) give sorted ids and the 11.85 MB result versus 13.6 MB for first-seen ids; first-seen is acceptable if simplicity wins. Month resolution: try the current UTC month, fall back one month on 404, record `{ file, bytes, month, sha256, source: 'dbip' | 'fixture' }` in `manifest.json`. `vite.config.ts` reads that manifest if present and `define`s `__GEO_CITY__`.

### Anti-Patterns to Avoid
- **Dynamic `import()` for the map, the table or any geo code:** Vite emits a lazy chunk and the browser requests it after load, which breaks the zero-network assertion.
- **A `prebuild`/`pretest` hook that downloads data:** the Playwright `webServer` calls the `vite` binary directly; hooks never run there.
- **Truncating IPv6 keys to /64 or /48:** measurably lossy (298 country collisions; 271,449 non-/48 city starts).
- **Per-login anything on the map, or a flat per-session table:** violates D-05, D-09 and PITFALLS #6.
- **Putting the login aggregate inside `playtime-aggregate.ts`:** breaks the standing T-04-01 guarantee and its tests.
- **A `fetch` in `src/lib/worker/**` or anywhere but `city-fetch.ts`:** the lint ban is the only guard for the worker.
- **Reading the IP column through a shared "whole row" helper:** keep column resolution explicit, as every aggregator does.
- **Putting an unmasked IP in any attribute (`title`, `aria-label`, `data-*`, SVG `<title>`) or hidden element:** see Pitfall 15.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| gzip of the city file | A JS inflate | `DecompressionStream('gzip')` in the worker | Native, 64 ms measured, zero dependency |
| ISO numeric -> alpha-2 for the atlas | A 250-line hand-typed table | `Intl.getCanonicalLocales('und-' + id)` at generation time | Zero table to mistype; 174/174 mapped |
| Country display names | A bundled name list | `Intl.DisplayNames(['en'], { type: 'region' })` | D-11; guard `ZZ` and invalid codes (it throws `RangeError` on malformed codes) |
| Virtual scrolling | A new windowing function | `windowRange` (hoisted) | Already tested, handles the shrink-clamp edge case (T-05-27) |
| Tooltip placement/clamping | New positioning code | `ChartTooltip` + `clampTooltip` | CSP-safe CSSOM writes already solved |
| Sha-256 of the city file | A hash routine | existing `digestFile` (`src/lib/worker/hash.ts`) | Already used for dedup |
| IP geolocation itself | A heuristic / RDAP guesses | The DB-IP range table | The one thing that must be built (it is the build script), but only as a table writer/reader, not a geolocation algorithm |
| TopoJSON -> SVG at runtime | `d3-geo` or `topojson-client` in `src/` | Pre-generated static paths | Project constraint: none of the three ships at runtime |

**Key insight:** the genuinely custom parts are the range-table container, IPv6 parsing/masking, and the aggregate. Everything else is a platform API or an existing project module; the risk in this phase is wiring and guard-rails, not algorithms.

## Common Pitfalls

### Pitfall 1: Any lazy chunk is a post-load request
**What goes wrong:** the zero-network spec counts every request after the baseline, so a dynamic `import()` of the map or table fails it.
**Why:** Vite splits dynamic imports into separate files requested on demand.
**Avoid:** keep geo code in the initial graph (map in the main chunk, table inline in the worker chunk). **Warning sign:** a new `assets/*.js` appears in `dist/` that is not `index-*` or `ingest.worker-*`.

### Pitfall 2: Fixture addresses are all "Unknown country"
**What goes wrong:** `192.0.2.x`, `198.51.100.x`, `203.0.113.x` and `2001:db8::` resolve to `ZZ`; a "10k fixture across many countries" shades nothing, and RFC 5737 holds only 762 usable IPv4 addresses.
**Avoid:** table-injected lookup for unit tests; the `GEO_FIXTURE` seam for e2e (Decision 2); use `2001:db8::/32` slices for bulk distinct addresses; the oracle for the fixture imports nothing (Phase 4/5 precedent).

### Pitfall 3: The meta CSP does not govern a worker
**What goes wrong:** assuming `connect-src` protects against a fetch in the worker. Measured: it does not.
**Avoid:** the lint ban (src-wide, including the worker) stays the guard for the data-holding context; keep exactly one exempt module; add lint probes (see Validation) proving `fetch` still fires everywhere else; count requests in Playwright rather than trusting CSP. Update the stale comment in `zero-network.spec.ts` (worker requests *are* visible in this setup) without relying on it.

### Pitfall 4: `.bin` is not a Vite asset type, and there are two configs
**What goes wrong:** `import x from './t.bin?inline'` fails to load; fixing it in `vite.config.ts` still breaks `vitest` because `vitest.config.ts` is separate and has no plugins.
**Avoid:** `assetsInclude: ['**/*.bin']` and the alias in both configs; the Svelte plugin must not be added to Vitest (setup.ts documents why).

### Pitfall 5: `vite build` is invoked directly by Playwright
**What goes wrong:** relying on npm lifecycle hooks or on the city file existing locally.
**Avoid:** commit the country table; make the opt-in e2e hermetic with `page.route` + a tiny same-format asset; bake the manifest into the bundle at build time and handle "no manifest" in the UI (Decision 7).

### Pitfall 6: The ESLint network ban has a test, and one more thing to guard
**What goes wrong:** exempting `fetch` for `city-fetch.ts` silently widens the ban if the glob is loose.
**Avoid:** an override scoped to that exact path that re-declares the `no-restricted-globals` list **minus `fetch`** (an override replaces, it does not merge, the rule options); extend `tests/unit/guards/lint-guards.test.ts` with probes: `fetch` fires in `src/lib/__lint_probe__.ts` and in the worker path, does **not** fire in the exempt path, while `XMLHttpRequest`/`WebSocket` still fire there; add a source-scan test that `fetch(` occurs in exactly one `src/` file.

### Pitfall 7: CSP tests assert `connect-src 'none'`
`tests/e2e/guards/zero-network.spec.ts` line 83 is `expect(csp).toContain("connect-src 'none'");`, the run skill documents it (`SKILL.md` lines 171-172), and `playtime-scale.spec.ts` relies on a blocked `connect-src` to detect exfiltration. If Decision 3 picks Option A these change **on purpose**; every other flow must still assert zero requests, and the CSP-violation collector must stay in place.

### Pitfall 8: A Dexie "schema bump" is a wipe
See Decision 4. If anyone writes `version(3)` with the D-19 upgrader, returning users lose their dataset. Do not remove the `version(2)` block either (db.ts rule 1: the v1 email wipe must keep working for devices still on v1).

### Pitfall 9: The meta record is read whole, on every query
`checkCache()` returns `db.meta.get('active')` for every playtime and data query. Do not store per-login data there; store the per-distinct-IP aggregate compactly and capped (Pattern 3). An alternative, a second `meta` row `id: 'logins'`, is workable but `clearData()` only deletes `'active'` and `db.test.ts` asserts `meta.count()` is 1, so it would leave IP aggregates behind after "Clear my cached data" unless `clearData` becomes `meta.clear()` and the assertions are updated.

### Pitfall 10: The backfill reader skips `Logins.csv`
`readSessionRowData` keeps only keys `isSessionFileName` accepts (`sessions.csv` or a `*_game_sessions.csv` token). A rebuild through it would silently drop a merged `Logins.csv` (D-01). Generalise the screen and cover it with a test that imports Logins plus sessions, deletes the aggregate, and compares the rebuilt one to the import-time one.

### Pitfall 11: Counting rules for merged sources
A `Logins.csv` row and a session row are both "a login" (D-01). An export with both would double count, accepted by D-01's wording; say so in the UI-SPEC note rather than deduplicating by timestamp. Unparseable timestamps still count as a login but are excluded from first/last (and the summary's date range shows only usable ones).

### Pitfall 12: IPv6 text is not one string
`2001:DB8::1`, `2001:db8:0:0:0:0:0:1`, `::ffff:192.0.2.1`, `fe80::1%eth0`, and 8-group values with leading zeros all occur in the wild. Canonicalise before grouping, resolve mapped addresses through the IPv4 table, reject zone ids, and test each.

### Pitfall 13: `Intl.DisplayNames` throws and varies
`.of('ZZ')`-style and malformed codes can throw `RangeError`; special-case `ZZ` ("Unknown country", D-08) before calling and fall back to the raw code in a try/catch. Names differ across ICU versions (`Czechia`, `Türkiye`); tests assert only stable names (`Germany`, `United States`) and pin `locale: 'en-US'` as `playwright.config.ts` already does.

### Pitfall 14: Map data gaps
110m lacks 76 DB-IP codes (SG, HK, MT, ...), three features have no id, and micro-states project to a pixel. Use the hybrid, `XK` by name, tiny-country circle, and the "N not drawn" caption (Pattern 5). Drop Antarctica. Use `geoNaturalEarth1` fit to a sphere so the viewBox is stable.

### Pitfall 15: DOM leak vectors while masked
The full IP must be absent from **every** DOM surface: cell text, `title`/`aria-label`/`aria-describedby` targets, `data-*` attributes, SVG `<title>`, the tooltip, hidden spans, the status live region and the sort announcement. Two existing assertions already guard `innerText`/`innerHTML` for `192.0.2.10` and `192.0.2.77` and must keep passing (they stay valid because the masked form is `192.0.2.xxx`). Add: after masked render, `html.innerHTML` contains no full fixture IP; `document.title` is unchanged; `getSelection().toString()` over the table is masked. Reveal must be one rune read in one derived function (`displayIp(row, revealed)`), never a CSS toggle over both strings.

### Pitfall 16: Download and hosting realities
Old DB-IP months 404; the CSV is 693 MB raw (stream it, never write it); GitHub Pages limits are a 1 GB site, a 10-minute deploy timeout and a 100 GB/month soft bandwidth cap [CITED: docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits], so 12 MB gzipped is about 8,000 loads a month versus about 2,300 at 43 MB raw. Whether Pages gzips `application/octet-stream` is unknown (A1), which is why the file is pre-gzipped and the loader sniffs the magic bytes.

### Pitfall 17: Lessons from the Phase 4/5 UI that apply
Pure models hold no words (copy lives in `ui-copy.ts` with its test); one `$state.raw` cell holds the answer **together with its `importedAt`** and the derived state treats another dataset's answer as no answer; `data-state` on the block root is the e2e hook; counts read by e2e go through helpers that match both pending and ready layouts; a stale test *name* is a stale contract.

### Pitfall 18: The CI budget guard
`tests/unit/guards/ci-budget.test.ts` projects e2e time from `playwright test --list`; every new test moves the 1.3x floor. The three limits (`globalTimeout` in `playwright.config.ts`, the `timeout Nm` shell wrapper and `timeout-minutes` in `ci.yml`) move together with the guard's constants or the guard fails by design.

### Pitfall 19: Intentional edits to existing tests
`tests/e2e/shell/dashboard.spec.ts` line 279 asserts the Activity card **contains** `SECTION_NOTE_PENDING` "from the Login history block"; Phase 6 fulfils that promise, so flip it to `not.toContainText` like the other three ready cards. `ui-copy.test.ts` line 534 pins `LOGIN_HISTORY_HEADING`; keep the value. `LoginHistorySection`'s `data-testid="login-history-placeholder"` has no test consumer today.

### Pitfall 20: The Account record IP is stored raw
`sanitizeUserInfoRow` drops only `LOGIN`/`BIRTH_DATE`/`BIRTH_DATE_SRC` and the overflow bucket, so `IP`, `COUNTRY_CODE`, `CITY` are in the stored rows and in the sanitised pool the identity pick already uses; read them from there (Pattern 3). It must follow the mask, and `import-flow.spec.ts` line 533 (`expect(body).not.toContain('192.0.2.10')`) must keep passing with the row present and masked.

### Pitfall 21: Memory for the city table
Typed arrays for 7.3 M entries are about 75 MB (IPv4 3.4 M x 8 B plus IPv6 3.8 M x 12-16 B) on top of the ~45 MB inflated bytes at peak. Decode only the address families present among the dataset's distinct IPs (a v4-only account skips the IPv6 plane) and drop the inflated buffer after decoding. Phase 7 should re-check on a phone-class device (A13).

## Code Examples

Verified patterns; the in-repo values they depend on are quoted verbatim in the next block.

### Vite config seam (Pattern 8, Decision 3 Option A shown)
```ts
// vite.config.ts additions. Source: probes this session + existing file structure.
const GEO_FIXTURE = process.env.GEO_FIXTURE === '1';
export default defineConfig({
  plugins: [svelte(), cspMeta()],
  worker: { format: 'es' },
  assetsInclude: ['**/*.bin'],
  resolve: {
    alias: {
      '#geo/country-table': GEO_FIXTURE
        ? fileURLToPath(new URL('./tests/fixtures/geo/country-fixture.bin', import.meta.url))
        : fileURLToPath(new URL('./src/lib/geo/assets/country-v1.bin', import.meta.url)),
    },
  },
  define: { __GEO_CITY__: JSON.stringify(readCityManifestOrNull(GEO_FIXTURE)) },
  preview: { port: 4173, strictPort: true },
});
// CSP_POLICY: Option A changes ONLY the connect-src entry: "connect-src 'self'".
```

### ESLint override: the single sanctioned fetch (Pitfall 6)
```js
// eslint.config.js, AFTER block 7 (later entries win). Re-declare the list WITHOUT `fetch`.
{
  files: ['src/lib/geo/city-fetch.ts'],
  rules: {
    'no-restricted-globals': [
      'error',
      { name: 'fetchLater', message: PLATFORM02_MESSAGE },
      { name: 'XMLHttpRequest', message: PLATFORM02_MESSAGE },
      { name: 'WebSocket', message: PLATFORM02_MESSAGE },
      { name: 'WebTransport', message: PLATFORM02_MESSAGE },
      { name: 'EventSource', message: PLATFORM02_MESSAGE },
      { name: 'RTCPeerConnection', message: PLATFORM02_MESSAGE },
      { name: 'importScripts', message: PLATFORM02_MESSAGE },
    ],
  },
},
```

### Main-thread loader (the only `fetch`), worker decode
```ts
// src/lib/geo/city-fetch.ts. Pattern verified by probe 2 (streaming read, transfer, worker gunzip).
export async function fetchCityBytes(
  url: URL,
  expectedBytes: number,
  onProgress: (received: number, total: number) => void,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok || response.body === null) throw new Error('city fetch failed');
  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(received, expectedBytes);          // denominator is baked in at build time
  }
  const out = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out.buffer;                              // caller: worker.postMessage(msg, [buffer])
}

// worker side
async function inflateIfGzip(buffer: ArrayBuffer): Promise<Uint8Array> {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;   // already plain: a re-encoding host
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
```
`Response`, `Blob` and `DecompressionStream` are not in the lint ban list, so this passes `eslint` in the worker.

### Map generator core (build-time)
```ts
// scripts/geo/build-world-map.ts. Verified numbers in Evidence.
import { feature } from 'topojson-client';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
const alpha2 = (id: string | number): string | null => {
  try { return Intl.getCanonicalLocales(`und-${id}`)[0]!.split('-')[1] ?? null; } catch { return null; }
};
const projection = geoNaturalEarth1().fitSize([960, 500], { type: 'Sphere' });
const path = geoPath(projection).digits(1);
// 110m base; add 50m features whose alpha-2 is absent from the base; name 'Kosovo' -> 'XK'; skip id '010'.
```

### Hermetic opt-in e2e skeleton
```ts
// tests/e2e/logins/login-city.spec.ts. route.fulfill still emits context 'request' (probe 3).
const requests: string[] = [];
context.on('request', (r) => requests.push(r.url()));
await page.route('**/geo-city-data/*.citydb.bin', (route) =>
  route.fulfill({ status: 200, contentType: 'application/gzip', body: CITY_FIXTURE_GZ }));
await importExport(page, 'logins.zip', bytes);
const baseline = requests.length;                       // after networkidle and ready
await expect.poll(() => requests.length).toBe(baseline); // nothing before the click
await page.getByTestId('city-optin').click();
await expect(page.getByTestId('city-optin')).toHaveAttribute('data-state', 'ready');
const after = requests.slice(baseline);
expect(after).toHaveLength(1);
expect(new URL(after[0]!).origin).toBe(new URL(page.url()).origin);
expect(after[0]).toMatch(/\/geo-city-data\/[^/]+\.citydb\.bin$/);
```
Also cover: slow route then Cancel (country view intact, no city column), `status: 500` (visible error, country view intact), truncated/bad-magic body (fixed error sentence), and reload (city gone, D-15).

### Verbatim in-repo values this research relies on (read this session)

- `vite.config.ts:17-23`
```
const CSP_POLICY = [
  "default-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
```
- `eslint.config.js:130-140`: `'no-restricted-globals': ['error', { name: 'fetch', ... }, { name: 'fetchLater', ... }, { name: 'XMLHttpRequest', ... }, { name: 'WebSocket', ... }, { name: 'WebTransport', ... }, { name: 'EventSource', ... }, { name: 'RTCPeerConnection', ... }, { name: 'importScripts', ... }]`
- `.gitignore:38-39`: `**/geo-city-data/` and `**/*.citydb.bin`
- `playwright.config.ts:108`: `command: './node_modules/.bin/vite build && ./node_modules/.bin/vite preview',` and `locale: 'en-US',` (line 40)
- `src/lib/worker/db.ts:166-174`: `this.version(2).stores({ rows: '++id, category, sourceFile', meta: 'id', }).upgrade(async (tx: Transaction) => { await tx.table('rows').clear(); await tx.table('meta').clear(); });`
- `src/lib/worker/db.ts:497`: `await db.meta.delete('active');`
- `src/lib/features/vehicles/vehicle-model.ts:45,54,63`: `export const ROW_PX = 40;` `export const OVERSCAN_ROWS = 6;` `export const SCROLLER_MAX_PX = 480;`
- `src/app.css:31-36`: `--ramp-0: #eef0f2; --ramp-1: #b2dcd4; --ramp-2: #7cc7bc; --ramp-3: #43a89c; --ramp-4: #1f7a74; --ramp-5: #0d4f4c;`
- `src/lib/ui-copy.ts:723`: `export const LOGIN_HISTORY_HEADING = 'Login history';`
- `src/lib/worker/identity.ts:48`: `const DROPPED_COLUMN = /^(LOGIN|BIRTH_DATE|BIRTH_DATE_SRC)(_\d+)?$/;` (lines 80-83: every other column, "IP, city, country, NAME, ID", is kept)
- `src/lib/worker/csv-columns.ts:15-21`: `headerKey(name)` = `name.trim().toUpperCase()`; `cell(row, key)` = `key === null ? undefined : row[key]`
- `tsconfig.node.json:20,23`: `"erasableSyntaxOnly": true,` and `"include": ["vite.config.ts"]`
- `.github/workflows/ci.yml:72-75`: step `Setup Node` using `actions/setup-node` with `node-version: 24` (line 75)
- `tests/e2e/guards/zero-network.spec.ts:83`: `expect(csp).toContain("connect-src 'none'");`
- `tests/e2e/shell/dashboard.spec.ts:279`: `await expect(section(page, 'activity-history')).toContainText(SECTION_NOTE_PENDING);`
- `tests/e2e/import/import-flow.spec.ts:533`: `expect(body).not.toContain('192.0.2.10');`
- `tests/unit/import/db.test.ts:340`: `expect(await reopened.meta.count()).toBe(1);`
- `package.json`: `"packageManager": "pnpm@12.6.0"`, `"typescript": "~6.0.2"`, `"vitest": "^5.0.2"`, `"@playwright/test": "^1.63.0"`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@ip-location-db/*` via npm | Official DB-IP downloads, or the mirror's GitHub Releases | upstream notice: distribution method revised 2026-06-18; npm "completely deprecated" | Decision 1 |
| `world-atlas` ids as strings to match by hand | `Intl.getCanonicalLocales('und-' + numeric)` | ECMA-402 / CLDR territory aliases, available in Node and browsers | No ISO table to maintain |
| Ship gzip via a JS library | `DecompressionStream` | baseline in Chromium; Safari 16.4+/Firefox 113+ [ASSUMED] | No dependency |
| Config-time `prebuild` data generation | Commit small generated assets; generate large ones in a separate script/CI step | n/a (project constraint: `webServer` runs `vite build`) | Pipeline shape |
| Run `.ts` scripts through `tsx` | Node's native type stripping | unflagged in Node 24 [ASSUMED]; probed on 26.10 | `erasableSyntaxOnly` is already enabled |

**Deprecated/outdated:** `@ip-location-db/dbip-country` and `@ip-location-db/dbip-city` (npm), per the registry `deprecated` field and upstream's caution notice.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitHub Pages serves a `.bin`/`application/octet-stream` file without gzip and without `Content-Encoding`; also that it may serve `Cache-Control` of about 10 minutes (HTTP cache help for D-15 is minimal) | Pattern 7, Pitfall 16 | Pre-gzip + magic sniff handles every variant; if Pages does compress, transfer is slightly smaller than estimated. Phase 7 verifies on the live URL |
| A2 | Node 24 (CI) runs `.ts` scripts without a flag (probed only on local 26.10) | Pattern 9 | CI script step fails; fix by `--experimental-strip-types` or a Node bump |
| A3 | download.db-ip.com keeps only the most recent two or so months (observed: 2026-09 and 2026-10 present; 2026-06 and 2025-01 absent) | Evidence | If it keeps more or fewer, the current-month-then-previous fallback still works |
| A4 | `ZZ` means "unknown/reserved" in DB-IP data | Pattern 1 | Wrong label text; observed on reserved ranges only |
| A5 | Natural Earth/world-atlas shapes need no map attribution | Pattern 5 | A line of attribution is cheap to add if wrong |
| A6 | `@types/d3-geo` and `@types/topojson-client` are acceptable build-time installs | Standard Stack | Gate returned OK; shim `declare module` is the alternative |
| A7 | The self-hosted CI runner has network access to download.db-ip.com, about 90 MB of free disk for the gz, and enough memory for a streaming parse | Decision 9 | Real city generation fails in Phase 7's deploy job; fixture mode keeps PR CI green |
| A8 | Visible link-back "IP Geolocation by DB-IP" satisfies CC BY 4.0 for the shipped derived table and city file (DB-IP's own instruction) | Attribution | Legal reading, not advice; ship the DB-IP licence/attribution text beside the city asset as well |
| A9 | `DecompressionStream('gzip')` is available in the Chrome-first target and acceptably in Safari/Firefox | Pattern 7 | Opt-in fails on an old browser; the error path is a fixed sentence and the country view is intact |
| A10 | The fixture seam (Decision 2) is acceptable to the user in place of public-infrastructure IPs | Decision 2 | Needs the user's call; both are specified |
| A11 | Peak worker memory of about 120 MB during city decode is acceptable on desktop | Pitfall 21 | Phase 7 mobile pass may need the v4-only decode or an IPv6-skip |
| A12 | The `@ip-location-db` caution applies to the dbip data as well as to the geolite2 packages whose README showed it (the dbip-country README in the 2026-06 tarball does not carry it, but npm itself marks the package deprecated) | Decision 1 | The user may judge the risk lower; the 97.35% agreement and 21-month city staleness remain |
| A13 | The 4-month drift explains most of the 2.65% mirror-vs-official difference | Evidence | If the mirror carries real errors, the decision to use official data is stronger, not weaker |

## Open Questions (RESOLVED)

1. **Are the Decision 1-4 defaults accepted?** Planning can proceed on the recommended defaults, but `checkpoint:decision` tasks must exist for 1-4 so execution does not silently rely on them. RESOLVED: carried as `checkpoint:decision` tasks in 06-01 (Dexie), 06-04 (source), 06-06 (fixtures), 06-09 (city fetch).
2. **Account-record country and city shown as recorded, or re-resolved through DB-IP?** Recommended: as recorded (it is Wargaming's own statement, D-02), but then the row's "country" may disagree with the table's resolution of the same IP; the UI-SPEC should say which wins in the label. RESOLVED: shown as recorded, never re-resolved (06-UI-SPEC.md line 335).
3. **Does a dataset replace reset the loaded city view?** D-15 says "re-asked on each visit"; within a visit, keeping the decoded table in the worker and re-resolving is cheaper and consistent. Needs a UI-SPEC line. RESOLVED: replace or Clear resets the city view (06-UI-SPEC.md line 274).
4. **Ranked-city-list size.** Up to `MAX_LOGIN_IPS` distinct addresses can map to thousands of cities; cap the rendered list (top N with "and M more") and say so. RESOLVED: capped at 50 rows with a 'more cities' line (06-UI-SPEC.md line 554).
5. **Should IP-column sorting be disabled while masked?** Low risk either way; pick one in the UI-SPEC. RESOLVED: sortable while masked (06-UI-SPEC.md line 333).
6. **A UI-SPEC does not exist yet** (`ui_phase` is on in `config.json`; only CONTEXT and the discussion log are in the phase directory). The tiles layout, tooltip, caption wording and the empty/unresolved states are all still to be specified; consider `/gsd-ui-phase` before planning. RESOLVED: 06-UI-SPEC.md written and approved.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build scripts, tests | yes | 26.10.0 local; CI `node-version: 24` | none needed |
| pnpm | install | yes | 12.6.0 | none |
| Playwright Chromium | e2e | yes | chromium-1243 installed, `@playwright/test ^1.63.0` | none |
| Vitest | unit | yes | 5.0.2 (`node_modules/vitest/package.json`) | none |
| Network to `download.db-ip.com` | `geo:country` refresh, `geo:city` real mode | yes (HEAD 200 for 2026-10 and 2026-09) | n/a | local CSV path argument; fixture mode for PR CI |
| ~700 MB transient disk | city CSV | not needed | stream through gunzip | n/a |

**Missing dependencies with no fallback:** none for Phase 6 development. Real city generation needs network at generation time only.
**Missing dependencies with fallback:** the real city asset is absent locally by design; fixture mode and `page.route` cover tests.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.2 (Node env, `fake-indexeddb`), Playwright 1.63 (Chromium, 1 worker in CI) |
| Config file | `vitest.config.ts` (needs `assetsInclude` + alias), `playwright.config.ts` (needs `webServer.env`) |
| Quick run command | `pnpm exec vitest run tests/unit/geo tests/unit/logins` |
| Full suite command | `pnpm run test:unit && pnpm exec playwright test` (`workflow.test_command`) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACTIVITY-05 | `parseIp`/`canonicalIp`/`maskIp` table-driven (v4, v6 forms, mapped, malformed, never throws, never echoes) | unit | `pnpm exec vitest run tests/unit/geo/ip.test.ts` | Wave 0 |
| ACTIVITY-05 | Aggregate vs independent oracle on a hand fixture and a seeded 10k fixture; caps; merged `Logins.csv`; mixed date formats; backfill equals import-time | unit | `pnpm exec vitest run tests/unit/logins/login-aggregate.test.ts` | Wave 0 |
| ACTIVITY-05 | Masked by default, one reveal toggle, resets on replace/clear, no full IP in `innerHTML` / `document.title` / selection while masked; account-record row follows mask | e2e | `pnpm exec playwright test tests/e2e/logins/login-history.spec.ts` | Wave 0 |
| ACTIVITY-05 | Windowed table DOM bounded, sort works at 10k+, `aria-rowcount` true | e2e + unit (`windowRange`) | `pnpm exec playwright test tests/e2e/logins/login-scale.spec.ts` | Wave 0 |
| ACTIVITY-06 | Range-table writer/reader round trip; edge-address lookups; gaps become unknown; committed table sanity (header, coverage totals 2^32, sorted, `192.0.2.1` -> unknown) | unit | `pnpm exec vitest run tests/unit/geo/range-table.test.ts` | Wave 0 |
| ACTIVITY-06 | World-map module: 238 shapes, unique alpha-2 keys, Kosovo -> XK, Antarctica absent; log-scale levels; contrast pairs from `app.css` | unit | `pnpm exec vitest run tests/unit/geo/world-map.test.ts tests/unit/charts/contrast.test.ts` | Wave 0 (contrast exists) |
| ACTIVITY-06 | Map shades countries per fixture table, node count independent of login count, tooltip/keyboard/list, attribution link visible, unknown count shown | e2e | `pnpm exec playwright test tests/e2e/logins/login-map.spec.ts` | Wave 0 |
| ACTIVITY-06 | Zero requests and zero CSP violations through import, reveal, sort, map interaction | e2e | `pnpm exec playwright test tests/e2e/guards/zero-network.spec.ts` | extend existing |
| ACTIVITY-07 | City container: round trip, truncated / bad magic / wrong kind / oversize / hash mismatch all rejected with a fixed error; gzip sniff (gz, plain, double) | unit | `pnpm exec vitest run tests/unit/geo/city-table.test.ts` | Wave 0 |
| ACTIVITY-07 | Zero requests before click; exactly one same-origin request for the manifest file after; progress; cancel; 500; corrupt body; reload drops city data | e2e (route-fulfilled) | `pnpm exec playwright test tests/e2e/logins/login-city.spec.ts` | Wave 0 |
| ACTIVITY-07 | `fetch` exempt only in `city-fetch.ts`; other network APIs still banned there; `fetch(` occurs in one `src/` file | unit | `pnpm exec vitest run tests/unit/guards/lint-guards.test.ts` | extend existing |
| Build | `geo:city:fixture` output decodes and its manifest matches; month-fallback logic against a stubbed 404 | unit | `pnpm exec vitest run tests/unit/geo/build-scripts.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run tests/unit/geo tests/unit/logins` (target under 30 s)
- **Per wave merge:** `pnpm run test:unit` plus the touched Playwright specs
- **Phase gate:** `pnpm run test:unit && pnpm exec playwright test` green, `pnpm run lint`, `pnpm run check`, then `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/geo/{ip,range-table,city-table,world-map,build-scripts}.test.ts`
- [ ] `tests/unit/logins/{login-aggregate,login-model,login-state}.test.ts`
- [ ] `tests/fixtures/logins-fixtures.ts` (seeded 10k+, IPv6 via `2001:db8::/32`, malformed, mixed dates, `Logins.csv`-shaped, hand fixture with closed-form answer key) and `tests/helpers/login-oracle.ts` (imports nothing)
- [ ] `tests/fixtures/geo/` fixture country and city tables (documentation ranges -> fake countries, flag bit set)
- [ ] `tests/e2e/logins/{login-history,login-map,login-city,login-scale}.spec.ts`
- [ ] `vitest.config.ts`: `assetsInclude`, alias; `playwright.config.ts`: `webServer.env`; `tsconfig.node.json` include `scripts/**`; ESLint node globals for `scripts/**`
- [ ] Update the three CI-budget numbers and `ci-budget.test.ts` constants together

## Security Domain

`security_enforcement` is enabled in `.planning/config.json` (`security_asvs_level: 1`, `security_block_on: high`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no accounts or sessions |
| V3 Session Management | no | none |
| V4 Access Control | no | single-user local tool |
| V5 Input Validation | **yes** | strict, anchored IP parsers; binary-container validation (magic, version, kind, counts vs section lengths, decompressed-size cap) before trusting any length; fixed error strings; `Map`/arrays rather than keyed-object lookups for dataset-derived keys |
| V6 Cryptography | partial | integrity check of the downloaded city file with the platform's SHA-256 via the existing `digestFile`; never hand-rolled |
| V8 Data Protection | **yes** | mask-by-default as a property of the rendered data; no IP or cell text in logs, titles, attributes, clipboard; aggregate never leaves the worker except as the view |
| V14 Configuration | **yes** | CSP meta tag (`connect-src` decision), lint network ban, `referrerPolicy: 'no-referrer'` and `credentials: 'omit'` on the one fetch, `rel="noreferrer"` on the DB-IP link |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unmasked IP leaks through a secondary surface (attribute, tooltip, title, selection, a future copy button) | Information disclosure | DOM holds only the displayed string; one `displayIp(row, revealed)`; DOM-wide innerHTML assertions in e2e (Pitfall 15) |
| Crafted archive with huge distinct-IP counts bloats the meta record | DoS | `MAX_LOGIN_IPS` cap with an honest "other addresses" bucket |
| Hostile cell text (script, markup, an email) in the IP column | Tampering / disclosure | Unparseable values never rendered or logged; text interpolation only, `svelte/no-at-html-tags` stays an error |
| Malformed/crafted city asset (truncated, bomb, wrong kind) | DoS / tampering | header checks, decompressed-size cap from the manifest, hash compare, fixed error, country view untouched |
| Regex backtracking in IP parsing | DoS | anchored patterns, no nested quantifiers, length bound before matching |
| Exfiltration via the one allowed fetch (query string carrying data) | Information disclosure | URL built only from the build-time manifest, no query string, one exempt call site, Playwright asserts exactly one request with the expected path |
| CSP weakened from `'none'` to `'self'` (Option A) | Elevation of privilege | Same-origin only reaches the static host; request-count and CSP-violation assertions remain strict everywhere except the opt-in test; Phase 7 may path-restrict the host-source to the geo directory once the origin is known [ASSUMED] |
| Third-party link referrer leak (DB-IP attribution) | Information disclosure | `rel="noreferrer noopener"`; the link is a user-initiated navigation, not a request |

## Sources

### Primary (HIGH confidence)
- Repository files read this session (paths and line ranges quoted above): `06-CONTEXT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `config.json`, `AGENTS.md`, `vite.config.ts`, `eslint.config.js`, `playwright.config.ts`, `.github/workflows/ci.yml`, `src/lib/worker/{db,ingest.worker,identity,csv-columns,data-queries,csv-parse}.ts`, `src/lib/core/{types/worker-messages,query-client}.ts`, `src/lib/features/playtime/{playtime-aggregate,playtime-shared,Playtime.svelte}`, `src/lib/features/vehicles/{VehicleTable.svelte,vehicle-model.ts}`, `src/lib/shell/{Dashboard,LoginHistorySection}.svelte`, `src/app.css`, tests cited in the pitfalls.
- Probes run this session: Chromium 1243 + Playwright 1.63 (meta CSP vs worker, streaming fetch + transfer + `DecompressionStream`, `route.fulfill` request events), Vite 8.3.1 / Vitest 5.0.2 `?inline` build and test, Node 26.10 native TS, `Intl.getCanonicalLocales`, data analyses over the DB-IP 2026-10 CSVs and the npm tarball.
- `npm view` and `gsd-tools query package-legitimacy check` for every package named above.
- DB-IP download pages: https://db-ip.com/db/download/ip-to-country-lite and https://db-ip.com/db/download/ip-to-city-lite (formats, attribution snippet, CC BY 4.0); HEAD requests to `download.db-ip.com/free/...`.
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits (1 GB site, 10-minute deploy timeout, 100 GB/month soft bandwidth).

### Secondary (MEDIUM confidence)
- sapics/ip-location-db README and the CAUTION block in the `@ip-location-db/geolite2-city@2.3.2026061719` README (https://unpkg.com/@ip-location-db/geolite2-city@2.3.2026061719/README.md): npm updates deprecated, data bugs, switch to GitHub Releases.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src (APIs covered by `connect-src`; it says nothing about workers, which the probe settled empirically).

### Tertiary (LOW confidence)
- Training-knowledge items tagged `[ASSUMED]` in the Assumptions Log (Pages compression, Node 24 type stripping, browser support floors).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new runtime dependency; build-time packages verified through the registry and the legitimacy gate.
- Architecture: MEDIUM-HIGH. Every load-bearing mechanism (inline `?inline` table, worker inflate, main-thread streaming fetch, hermetic route-fulfilled e2e, CSP vs worker) was probed; the remaining risk is the four user decisions.
- Pitfalls: HIGH for the repo-specific ones (each traced to a file and line), MEDIUM for hosting behaviour that only Phase 7 can confirm on the live URL.

**Research date:** 2026-10-03
**Valid until:** 2026-10-31 for DB-IP month availability and sizes (monthly releases, old months vanish); 30 days for the rest.
