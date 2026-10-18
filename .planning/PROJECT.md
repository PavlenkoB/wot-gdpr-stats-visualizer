# WG Data Export Viewer

*(working title — repo is `wot-gdpr-stats-visualizer`; rename either to match if desired)*

## What This Is

A browser-only, zero-backend tool that turns a Wargaming GDPR personal-data export (the "Data Export" zip Wargaming provides on request for World of Tanks, WoT Blitz, World of Warships, and World of Warplanes accounts) into an interactive dashboard — session activity heatmaps, per-vehicle battle stats, financial/currency history, device information (the PC, Blitz and Assistant device lists), and a login-IP history table with country-level geolocation. Everything happens client-side: unzip, parse, store, and render, with zero network requests after the page loads. Built for players who requested their own export and want to actually see it, without uploading sensitive account data anywhere.

## Core Value

Your data never leaves your machine. Every other decision — architecture, library choices, feature scope — is subordinate to keeping this verifiably true (zero network requests post-load, with one sanctioned exception: the opt-in city-level file; enforced by CI and an ESLint network ban, with a CSP as defence in depth).

## Current Milestone: v1.1 Multi-account & new data

**Goal:** Accept a real multi-account export (several account-ID folders from region migrations and extra accounts) and show it as one merged dashboard, then surface the data categories the app still ignores.

**Target features:**
- Multi-account zips: detect N account roots, classify and parse each, store all in one dataset, render a single merged dashboard (no picker)
- New games: HEAT, WoT Console, World of Warplanes sessions and stats; WoWS crews and storage
- Account timeline: name history, external services, language/country history, bans, authorized third parties
- Subscriptions, personal coupons, bonus codes, surveys

## Requirements

### Validated

- ✓ Activity_history: total hours/sessions/active days, calendar heatmap (year-by-year), day-of-week × hour-of-day heatmap, session-duration distribution — Phase 4 (real per-game session files WOT/WOTB/WOWS_Game_Sessions.csv supported; legacy Sessions.csv still accepted)
- ✓ Activity_history: login-IP history table, masked by default with one global click-to-reveal toggle, with offline country-level geolocation (bundled DB-IP Lite range table, no live geo API) on a bundled world map, and city-level detail as an explicit opt-in download that is never fetched by default — Phase 6 (ACTIVITY-05, ACTIVITY-06, ACTIVITY-07)
- ✓ Device_info: a read-only Device info pane with three per-source tables (PC hardware from `WOT_Device_Info.csv`, Blitz devices from `WOTB_Device_Info.csv`, Assistant app devices from `WOT_Assistant_Device_Info.csv`) under a counts summary; `N/D` and blank cells read as a muted "not reported", memory arrives in MB and shows in GB; the Assistant file's single `POST` blob is reduced at import to four fields (device type, app, platform, version) and never stored, posted or shown, so the account id and the flags value inside it appear nowhere — quick task 261012-bog
- ✓ User can drag-and-drop a Wargaming GDPR export `.zip` and have it parsed entirely client-side — v1.0
- ✓ App auto-detects the zip's root/category-folder structure rather than assuming a fixed layout — v1.0
- ✓ Player_statistics: per-vehicle battle stats (win rate, damage, battles, etc.) across WoT, WoT Blitz, World of Warships, and World of Warplanes — v1.0
- ✓ Financial_data: premium-time operations and virtual-currency flow timelines — v1.0
- ✓ Parsed data is cached in IndexedDB so re-uploading isn't needed on repeat visits; re-uploading the same zip is detected (hash) and skipped; uploading a *different* zip replaces the current dataset (single active dataset, not multi-account storage) — v1.0
- ✓ Categories are classified 3-way — supported / known-deferred (Chat_history, Clans) / unknown (any folder never seen before, e.g. a future Wargaming export-format addition) — all three render the same "detected but not yet supported" banner, not hidden and not silently dropped or crashed on — v1.0
- ✓ A category folder missing from a given user's export (e.g. no Financial_data, no Warplanes data) shows that dashboard section empty/greyed-out rather than removing it — v1.0
- ✓ A zip that isn't a recognizable Wargaming export (wrong file, corrupt archive) shows a generic failure state — v1.0
- ✓ Dashboard is responsive and usable at phone width, not desktop-only — v1.0
- ✓ Zero network requests after initial page load — enforced by an automated CI check, backed by a CSP as defense-in-depth — v1.0
- ✓ Deployed as a static site to GitHub Pages via GitHub Actions — v1.0
- ✓ Account identity header at the top of the dashboard (nickname, region, account-created date from `User_Info`) — email address (the `LOGIN` field) is deliberately omitted from display even though it never leaves the device — v1.0
- ✓ Financial_data includes a real-money spend summary from `Payment_history`, totaled **per currency** (the real data spans USD/RUB/UAH in one account) — never blended into one converted number, since any conversion needs a live or hardcoded FX rate, both rejected — v1.0
- ✓ A discoverable "clear my cached data" control ships in the same phase as IndexedDB caching, not bolted on later — nothing currently wipes the unencrypted-on-disk cache otherwise — v1.0

### Active

- [ ] A zip with several account-ID folders imports instead of failing, and all accounts are shown merged in one dashboard
- [ ] New game data (HEAT, WoT Console, World of Warplanes, WoWS crews/storage) is shown
- [ ] Account timeline categories are shown (name history, external services, language/country, bans, authorized third parties)
- [ ] Subscriptions, personal coupons, bonus codes and surveys are shown

### Out of Scope

- Comparing two exports taken months apart — explicitly not wanted; too much work relative to value for this project
- i18n / Ukrainian translation — English-only for v1
- Chat_history, Clans dashboards — real data categories, deliberately deferred past v1
- City-level IP geolocation *bundled by default* — ruled out as a default-load cost (databases run tens of MB); available instead as an explicit opt-in lazy-load the user must trigger
- Multiple simultaneously-stored exports / switching between accounts — single active dataset only; re-architecting to a keyed multi-export store is a possible future direction, not v1
- Accessibility work beyond incidental — no WCAG target for hand-rolled SVG charts in v1
- Safari/Firefox active verification — Chrome-first target; other browsers get best-effort compatibility, not dedicated testing

## Context

**The real export, inspected directly** (sample dated 2021-10-12, ~2.2MB, ~4,200 session rows — small; no large veteran export has been inspected, so "how big can this get" is an assumption, not a verified fact):

- Root of the zip is a single folder (looked like a numeric account ID) containing category subfolders — do not assume a fixed name, auto-detect it.
- CSVs are semicolon-delimited, quoted fields.
- **Line terminators are inconsistent within the same archive** — some files use CRLF, some use bare-CR only (old Mac Classic style, zero LF bytes) — confirmed via byte-level inspection. PapaParse's default line-ending auto-detection handles bare-CR correctly (verified against its source), so no special config is needed, but this was a real risk worth checking rather than assuming.
- Some CSVs (e.g. clan data) contain Cyrillic/Ukrainian text that's double-UTF8-encoded (mojibake) — needs a small hand-rolled byte-roundtrip fix (decode as Latin-1, re-decode as UTF-8), no library needed.
- World of Warplanes data (`WOWP_19`/`WOWP_20` stats) showed up in Player_statistics despite not being mentioned anywhere in the original project idea — included in v1 scope.
- The inspected sample is 5 years old; the current (2026) export format may have drifted. Parsing is built defensively (tolerate unexpected/missing columns) rather than assuming the 2021 sample's exact schema.
- `Payment_history/Orders.csv` verified structure: `ACTION_DT;GAME_CODE;ITEM_CNT;PAYMENT_CURRENCY;PAYED_IN_CURR_AMT;IS_GIFT;ORDER_UUID;PAY_COUPON_NAME;PAY_ORDER_STATUS_CODE;...` — real sample spans USD, RUB, and UAH with PAID/FAILED/NEW statuses, confirming a per-currency spend summary is buildable (sum `PAYED_IN_CURR_AMT` where status is PAID, grouped by `PAYMENT_CURRENCY`).
- `User_Info/Account_Info.csv` verified structure: `ID;NAME;CREATED_AT;ACTIVATED_AT;IP;COUNTRY_CODE;REGION;CITY;LOGIN;USER_LANGUAGE;USER_STATED_COUNTRY;BIRTH_DATE;BIRTH_DATE_SRC` — `LOGIN` is a literal email address, deliberately excluded from the identity header display.

**Repo state at project start:** fully greenfield — only `README.md`, `LICENSE`, `.gitignore` existed; nothing built yet. The README's own feature checkboxes describe the target, not current state.

**Research conducted before scoping** (three rounds of parallel background research agents) informed most technical decisions below — see Key Decisions for the outcomes.

## Constraints

- **Privacy**: No backend, no API calls, no analytics, zero network requests after page load (the single exception is the opt-in, same-origin city-level geo file) — this is the product's entire reason to exist, not a nice-to-have.
- **Tech stack**: Svelte 5 (runes-based reactivity, not legacy Svelte 4 patterns) + Vite + pnpm (not npm).
- **No client-side router**: single dashboard page; avoids GitHub Pages' refresh-404 problem entirely.
- **Deployment**: static site on GitHub Pages via the official `actions/deploy-pages` + `actions/upload-pages-artifact` GitHub Actions flow (not the older `gh-pages` npm package).
- **Dependency minimalism**: every library addition was weighed against hand-rolling, given the privacy-tool ethos of minimal attack surface / bundle size. Charts and the file dropzone are hand-rolled deliberately, not by default.
- **Scale**: designed for scale from day one (Web Worker pipeline, table/chart virtualization) — a large veteran-player export is assumed plausible even though unverified, because retrofitting worker/virtualization boundaries later is expensive.
- **Browser target**: Chrome-first; Safari and Firefox are best-effort, not actively tested (though Dexie 4 was chosen partly for its Safari IndexedDB fixes).
- **Mobile**: must be responsive/usable at phone width.
- **TypeScript**: pinned to `^6` — TypeScript 7's native `tsgo` compiler (GA July 2026) isn't yet supported by `typescript-eslint`/`svelte-check`; revisit once TS 7.1 ships (~Nov 2026 target).
- **Scaffolding**: `pnpm dlx sv create` using the **minimal** (non-SvelteKit) template — SvelteKit's router would reintroduce the GitHub Pages refresh-404 problem already avoided by having no router.
- **Linting**: ESLint + Prettier + `eslint-plugin-svelte` + `typescript-eslint`, not Biome — Biome's Svelte-file linting is still catching up as of 2026.
- **Matched peer-dependency pairs to bump together, never independently**: `@sveltejs/vite-plugin-svelte@^7` requires Vite `^8` as a hard peer dependency; `actions/upload-pages-artifact@v4` pairs with `actions/deploy-pages@v4`.
- **Web Worker lifecycle**: one long-lived Worker instance reused across uploads, not spawned per upload — required for the "single active dataset, replace on new upload" model to be race-free; paired with a main-thread busy-guard while a parse is in flight.
- **Inside the pipeline worker**: use `Papa.parse({ worker: false })` and fflate's `unzipSync` — both PapaParse's own `worker: true` mode and fflate's async unzip spawn a *nested* worker, which is redundant (already off the main thread) and has documented friction (script-path resolution under bundlers, IPC stalls).
- **Geo-map assets are build-time only**: `world-atlas` + `d3-geo`/`topojson-client` run in a Node build script to pre-generate static SVG/lookup assets; none of the three ship as runtime dependencies. Concrete geo-IP source: the official monthly DB-IP downloads (`https://download.db-ip.com/free/dbip-{country,city}-lite-YYYY-MM.csv.gz`, CC BY 4.0), converted to a binary range table at build time; the deprecated `@ip-location-db/dbip-country` npm mirror is not installed (Phase 6, Decision 1).
- **Chart aggregation at scale**: heatmaps/histograms must aggregate per-bucket (e.g. per-day, per-hour-cell), never render one SVG node per raw session/row — hundreds of thousands of individual nodes is a documented browser-freeze risk. Verify against a synthetic large-export fixture, since the only real sample inspected is small (~4,200 rows).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| pnpm instead of npm | User preference; still full JS/Svelte/Vite ecosystem | — Pending |
| fflate instead of JSZip | Smaller; decompresses via Web Worker so the UI thread doesn't block during unzip (JSZip's async API blocks) | — Pending |
| PapaParse for CSV | Verified via source inspection: auto-detects bare-CR-only line endings correctly with no special config | — Pending |
| Web Worker pipeline (unzip → parse → Dexie writes) from day one | Cheap to design now (Vite has built-in worker support); expensive to retrofit later (would mean rewriting data-flow/message-passing boundaries) | — Pending |
| Dexie 4 + bulkPut + zip-hash dedup + navigator.storage.persist() | Dexie 4 has Safari IndexedDB fixes; bulkPut avoids main-thread blocking on large inserts; hash-dedup skips re-parsing an already-loaded archive; storage.persist() reduces eviction risk | — Pending |
| Hand-rolled SVG for all charts (no charting library) | All v1 chart types (heatmaps, histograms, per-vehicle bars, a currency timeline) are simple enough that libraries evaluated (uPlot, LayerChart, Chart.js) added bundle weight without saving meaningful boilerplate | — Pending |
| Country-level offline geo-IP bundled by default (DB-IP Lite from the official monthly downloads, pre-converted to a binary range table at build time, rendered on a bundled world-atlas SVG map); city-level offered as an explicit opt-in lazy-load (DB-IP `dbip-city-lite`, same CC BY 4.0 license) rather than bundled or omitted | City-level databases run tens of MB — too large to force on every visitor by default, but the user explicitly wants the capability available; DB-IP Lite is CC BY 4.0 (one-line attribution, no account/key) at both tiers, cleaner than MaxMind GeoLite2's EULA (account-gated, 30-day destroy-old-versions obligation, redistribution flow-down clauses). Revised in Phase 6: the `ip-location-db` npm mirror was dropped (deprecated, flagged by the package-legitimacy gate, stale data, no city counterpart) in favour of the official downloads, which serve both tiers from one source | ✓ Good — shipped Phase 6 (country table 3.4 MB raw / ~725 KB gzipped inlined in the worker chunk; city table 50.1 MB raw / 11.9 MB gzipped, opt-in) |
| Bits UI for accessibility-heavy primitives (tabs, tooltip, popover); hand-roll buttons/layout/tables/dropzone | Bits UI is Svelte-5-native and headless (no Tailwind lock-in); the Svelte dropzone ecosystem is stale/not Svelte-5-ready, so hand-rolling beats adopting an unmaintained dependency | — Pending |
| Vitest (unit/component) + Playwright (thin E2E smoke layer) | Vitest carries the real correctness burden (CSV-parsing quirks, component rendering); Playwright covers a handful of critical-path flows including a dedicated zero-network-requests CI assertion | — Pending |
| Unscoped export categories shown as "detected but not supported yet" | Keeps them visible/honest without committing to building 10+ more dashboard sections in v1 | — Pending |
| Single active dataset, replace on new upload | Simpler data model; multi-account storage deferred as a possible future direction | — Pending |
| The city file is fetched on the main thread under `connect-src 'self'`, never in the worker (Phase 6, 06-09) | A meta CSP was measured to be blind to worker traffic: with `connect-src 'none'` a main-thread fetch was blocked but a module-worker fetch returned 200. So the CSP cannot restrict the one sanctioned request to the city asset and is defence in depth only; the real enforcement is the ESLint network ban (exactly one exempt file, `src/lib/geo/city-fetch.ts`, none under `src/lib/worker/**`) plus Playwright request assertions that prove which asset was fetched. The `connect-src 'none'` shipped before Phase 6 never governed worker traffic either | ✓ Good |
| Browser tests see countries through a fixture table behind a build seam (`GEO_FIXTURE=1`, set only in `playwright.config.ts`) rather than committed real addresses (Phase 6, 06-06, D-17) | Documentation addresses resolve to unknown in the real table, so a real-table run could never shade a country; the seam keeps "no real address is committed" literally true and is the only way the 10,000-row per-country aggregation claim is meaningfully exercised | ✓ Good |
| Capped logins still count toward the country figures (Phase 6, 06-03) | Drawn + not-drawn + unknown-country logins must sum to the tile total; only the listed rows are capped at 20,000 | ✓ Good |
| No Dexie schema bump for the `logins` meta field; a stale aggregate is rebuilt lazily from stored rows keyed on `(v, geo)` (Phase 6, 06-01) | A version bump with the Phase 3 clearing upgrader would wipe every returning user's cached dataset; the stored rows still carry the IP column so the backfill is lossless | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-16 after v1.1 milestone start*
