# WG Data Export Viewer

*(working title — repo is `wot-gdpr-stats-visualizer`; rename either to match if desired)*

## What This Is

A browser-only, zero-backend tool that turns a Wargaming GDPR personal-data export (the "Data Export" zip Wargaming provides on request for World of Tanks, WoT Blitz, World of Warships, and World of Warplanes accounts) into an interactive dashboard — session activity heatmaps, per-vehicle battle stats, financial/currency history, and a login-IP history table with country-level geolocation. Everything happens client-side: unzip, parse, store, and render, with zero network requests after the page loads. Built for players who requested their own export and want to actually see it, without uploading sensitive account data anywhere.

## Core Value

Your data never leaves your machine. Every other decision — architecture, library choices, feature scope — is subordinate to keeping this verifiably true (zero network requests post-load, enforced by CI and a CSP).

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can drag-and-drop a Wargaming GDPR export `.zip` and have it parsed entirely client-side
- [ ] App auto-detects the zip's root/category-folder structure rather than assuming a fixed layout
- [ ] Activity_history: total hours/sessions/active days, calendar heatmap (year-by-year), day-of-week × hour-of-day heatmap, session-duration distribution
- [ ] Activity_history: login-IP history table with country-level geolocation (offline, bundled dataset — no live geo API) and a world-map visualization; city-level geolocation available as an explicit opt-in lazy-load (much larger dataset, never downloaded by default)
- [ ] Player_statistics: per-vehicle battle stats (win rate, damage, battles, etc.) across WoT, WoT Blitz, World of Warships, and World of Warplanes
- [ ] Financial_data: premium-time operations and virtual-currency flow timelines
- [ ] Parsed data is cached in IndexedDB so re-uploading isn't needed on repeat visits; re-uploading the same zip is detected (hash) and skipped; uploading a *different* zip replaces the current dataset (single active dataset, not multi-account storage)
- [ ] Categories are classified 3-way — supported / known-deferred (Chat_history, Clans) / unknown (any folder never seen before, e.g. a future Wargaming export-format addition) — all three render the same "detected but not yet supported" banner, not hidden and not silently dropped or crashed on
- [ ] A category folder missing from a given user's export (e.g. no Financial_data, no Warplanes data) shows that dashboard section empty/greyed-out rather than removing it
- [ ] A zip that isn't a recognizable Wargaming export (wrong file, corrupt archive) shows a generic failure state
- [ ] Dashboard is responsive and usable at phone width, not desktop-only
- [ ] Zero network requests after initial page load — enforced by an automated CI check, backed by a CSP as defense-in-depth
- [ ] Deployed as a static site to GitHub Pages via GitHub Actions
- [ ] Account identity header at the top of the dashboard (nickname, region, account-created date from `User_Info`) — email address (the `LOGIN` field) is deliberately omitted from display even though it never leaves the device
- [ ] Financial_data includes a real-money spend summary from `Payment_history`, totaled **per currency** (the real data spans USD/RUB/UAH in one account) — never blended into one converted number, since any conversion needs a live or hardcoded FX rate, both rejected
- [ ] Login-IP history table is masked by default (e.g. last octet hidden) with a click-to-reveal toggle, not shown plaintext by default
- [ ] A discoverable "clear my cached data" control ships in the same phase as IndexedDB caching, not bolted on later — nothing currently wipes the unencrypted-on-disk cache otherwise

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

- **Privacy**: No backend, no API calls, no analytics, zero network requests after page load — this is the product's entire reason to exist, not a nice-to-have.
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
- **Geo-map assets are build-time only**: `world-atlas` + `d3-geo`/`topojson-client` run in a Node build script to pre-generate static SVG/lookup assets; none of the three ship as runtime dependencies. Concrete geo-IP package: `@ip-location-db/dbip-country`.
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
| Country-level offline geo-IP bundled by default (DB-IP Lite via `ip-location-db` mirror, pre-converted to a binary range table at build time, rendered on a bundled world-atlas SVG map); city-level offered as an explicit opt-in lazy-load (`dbip-city-lite`, same CC BY 4.0 license) rather than bundled or omitted | City-level databases run tens of MB — too large to force on every visitor by default, but the user explicitly wants the capability available; DB-IP Lite is CC BY 4.0 (one-line attribution, no account/key) at both tiers, cleaner than MaxMind GeoLite2's EULA (account-gated, 30-day destroy-old-versions obligation, redistribution flow-down clauses) | — Pending |
| Bits UI for accessibility-heavy primitives (tabs, tooltip, popover); hand-roll buttons/layout/tables/dropzone | Bits UI is Svelte-5-native and headless (no Tailwind lock-in); the Svelte dropzone ecosystem is stale/not Svelte-5-ready, so hand-rolling beats adopting an unmaintained dependency | — Pending |
| Vitest (unit/component) + Playwright (thin E2E smoke layer) | Vitest carries the real correctness burden (CSV-parsing quirks, component rendering); Playwright covers a handful of critical-path flows including a dedicated zero-network-requests CI assertion | — Pending |
| Unscoped export categories shown as "detected but not supported yet" | Keeps them visible/honest without committing to building 10+ more dashboard sections in v1 | — Pending |
| Single active dataset, replace on new upload | Simpler data model; multi-account storage deferred as a possible future direction | — Pending |

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
*Last updated: 2026-09-27 after initialization*
