# Stack Research

**Domain:** Browser-only, zero-backend static-site data-visualization SPA (Wargaming GDPR export viewer)
**Researched:** 2026-09-27
**Confidence:** MEDIUM overall (version numbers are LOW-confidence web-search snapshots — verify exact patch/minor at `pnpm install` time via `npm view <pkg> version`; architecture-level recommendations are MEDIUM-HIGH, cross-referenced across multiple sources)

## Scope note

Per PROJECT.md, the following are **already locked in and NOT re-litigated here**: Svelte 5 (runes) + Vite + pnpm, fflate, PapaParse, Dexie 4, Bits UI, hand-rolled SVG charts, Vitest + Playwright, `actions/deploy-pages`. This document sanity-checks those choices against current (Sept 2026) practice, pins them to specific current versions, and fills the gaps PROJECT.md leaves open: TypeScript config, linting/formatting, scaffolding, CI structure, worker tooling, and the two supporting pieces (world map, geo-IP data) that aren't yet named as concrete packages.

**Verdict on locked-in choices: all confirmed sound, no contradictions found.** One addition recommended (TypeScript version pin — see below) and two gaps filled (world map data source, geo-IP data source).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Svelte | ^5.57 | UI framework, runes-based reactivity | Already locked in. Confirmed current stable; Svelte 5 has been GA for ~18 months, runes are the settled reactivity model — no reason to touch Svelte 4 patterns. |
| Vite | ^8.3 | Build tool, dev server, module worker bundling | Already locked in. Vite 8 is current major; ships mature `new Worker(new URL(...), {type:'module'})` handling (the pattern the Web Worker pipeline needs) and Vite's built-in worker support is the reason this decision was cheap to make from day one per PROJECT.md. |
| @sveltejs/vite-plugin-svelte | ^7.3 | Vite↔Svelte integration | **Must pin together with Vite 8** — v7 of this plugin *requires* Vite `^8.0.0` as a hard peerDependency breaking change (v6 will not resolve). Also requires Svelte `>=5.46.4` and Node `^20.19 \|\| ^22.12 \|\| >=24`. Get this wrong and `pnpm install` fails on peer-dep mismatch. |
| pnpm | ^12.6 | Package manager | Already locked in (user preference). pnpm 12 is a from-scratch Rust rewrite (Aug 2026) — faster installs, relocatable `node_modules`. No compatibility concern for this stack. |
| TypeScript | **^6.x** (NOT TypeScript 7 / tsgo) | Static typing | **New recommendation, not yet in PROJECT.md.** TypeScript 7.0 (the Go-native `tsgo` compiler) went GA July 2026, but as of Sept 2026 the Svelte/Vue/Astro template-checking ecosystem and `typescript-eslint` cannot run against it — Language Service API stabilization is targeted for 7.1 (beta Oct 2026, stable ~Nov 2026). Using TS7 today would break `svelte-check` and ESLint's Svelte integration. Use TypeScript 6.x as the "stable bridge" every current source recommends; revisit 7.1 after it ships. |
| svelte-check | ^4.7 | Svelte+TS type checking / CI gate | Standard companion to any TypeScript Svelte project; run in CI as a lint-equivalent step, not just editor tooling. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fflate | ^0.8.3 | Zip decompression in a Web Worker | Already locked in and confirmed current. Note: there's also `@exodus/fflate`, a hardened fork — irrelevant here, stick with plain `fflate`. |
| PapaParse | ^5.7.0 | CSV parsing (semicolon-delimited, mixed line endings) | Already locked in and confirmed current; the bare-CR auto-detection behavior PROJECT.md verified against source still holds in this version line. |
| @types/papaparse | latest matching PapaParse | TS types for PapaParse | PapaParse itself ships untyped; this is a required companion since the project is TypeScript. |
| Dexie | ^4.4.6 | IndexedDB wrapper for cached parsed dataset | Already locked in and confirmed current (4.4.x line, actively maintained, latest patch ships OAuth-provider additions irrelevant here — the relevant Safari IndexedDB fixes are in the 4.x baseline already). |
| bits-ui | ^2.18 | Headless a11y primitives (tabs, tooltip, popover) | Already locked in and confirmed current; fully rewritten for Svelte 5, no Svelte-4-compat baggage. |
| world-atlas | ^2.0.2 (**devDependency only**, build-time) | Pre-built TopoJSON world map (Natural Earth `countries-110m.json`) for the login-IP world map | **Gap-fill.** PROJECT.md commits to "bundled world-atlas SVG map" but doesn't name a source. `world-atlas` is the standard, maintained TopoJSON redistribution used by nearly every D3/SVG world-map tutorial. Use it as a **build-time-only** input, not a runtime dependency (see Build Patterns below) — this respects the project's dependency-minimalism/hand-rolled-charts ethos while avoiding hand-drawing a world map by hand. |
| d3-geo, topojson-client | latest (**devDependency only**, build-time) | Project TopoJSON → SVG path `d` strings at build time | **Gap-fill, build-time only.** Do not ship d3-geo to the browser — it's a "chart library" the project deliberately avoids at runtime. Instead, write a small Node build script (or a one-time generation script, not part of the Vite runtime bundle) that uses `topojson-client` + `d3-geo`'s `geoPath()` to pre-render country `<path>` elements with `data-iso` attributes into a static `.svelte` component or `.svg` asset checked into the repo. At runtime, highlighting a country is just a CSS class toggle keyed by ISO code — zero D3 in the shipped bundle. |
| DB-IP Lite official monthly downloads (`https://download.db-ip.com/free/dbip-{country,city}-lite-YYYY-MM.csv.gz`) | monthly (month resolved at build time, one-month fallback) | Offline IP→country (and opt-in IP→city) CSV, DB-IP Lite | **Gap-fill — the concrete source behind PROJECT.md's "DB-IP Lite" decision (phase 06, Decision 1).** CC BY 4.0 licensed (one-line attribution only, no account/key). **Nothing from `@ip-location-db` is installed**: the deprecated npm mirror was rejected (npm marks it deprecated, the package-legitimacy gate flagged it SUS, its data is stale/buggy, and it has no city counterpart). Consumed **only at build time**: the build scripts download the official file and emit a binary range table as a static asset — country table 3,403,572 B raw / ~725 KB gzipped, inlined into the worker chunk; city table 50,130,477 B raw / 11,877,710 B gzipped, an opt-in download. No geo-IP package or CSV is a runtime dependency. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `sv` CLI (`npx sv create`) | Project scaffolding | This is the correct, current scaffolding tool — it replaced `npm create svelte@latest` when Svelte 5 shipped. Use `npx sv create` (or `pnpm dlx sv create`), choose the **minimal** template (not `demo`, no SvelteKit — this project explicitly has "no client-side router," so plain Vite+Svelte, not SvelteKit, is correct), select TypeScript, and let its add-on menu install `eslint`, `prettier`, `vitest`, `playwright` for you rather than wiring each up by hand. |
| ESLint + `eslint-plugin-svelte` + `typescript-eslint` + Prettier | Linting/formatting | **Recommendation: keep ESLint+Prettier, do NOT switch to Biome for this project.** Biome added Svelte support (v2.3+) but multiple 2026 sources still explicitly advise "if your project uses Vue or Svelte, stick with ESLint" — Svelte-file linting in Biome is newer and less complete than its JS/TS linting, and `typescript-eslint`'s type-aware rules (useful for catching CSV-parsing/schema-drift bugs given the defensive-parsing requirement in PROJECT.md) have no Biome equivalent yet. ESLint+Prettier is also what `sv create`'s add-on menu wires up natively, so this is the path of least setup friction, not just the conservative choice. |
| Vitest | ^5.0 | Unit/component tests | Already locked in and confirmed current; v5 is a recent major with a performance-focused rewrite — safe to adopt fresh on a greenfield project. |
| Playwright | ^1.63 | E2E smoke tests, incl. zero-network-requests CI assertion | Already locked in and confirmed current. Playwright's `page.on('request', ...)` / `page.route('**/*', ...)` assertion pattern is the standard way to implement PROJECT.md's "automated CI check" for zero network requests post-load — flag any request after initial load as a test failure. |
| `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4` | CI deploy to GitHub Pages | Already locked in; confirmed current majors. **Compatibility note:** these two must be upgraded together — artifacts uploaded with the current `upload-pages-artifact` require `deploy-pages@v4` or newer; mixing v3 artifact-upload with v4 deploy (or vice versa) breaks the Pages deployment step. |
| CSP via `<meta http-equiv="Content-Security-Policy">` | Defense-in-depth only for the zero-network-requests guarantee | GitHub Pages serves static files with no custom-header control, so a `<meta>` CSP tag is the *only* CSP mechanism available (no `_headers` file support on GitHub Pages, unlike Netlify/Vercel). Note the real limitation: some directives (e.g. `frame-ancestors`) silently don't work in `<meta>` form. Since plan 06-11 the shipped directive is `connect-src 'self'` (previously `'none'`), because the product has exactly one sanctioned request: the opt-in city-level file, same-origin, main thread, user-initiated. Plan 06-09 measured that a meta CSP is blind to worker traffic (with `connect-src 'none'` a main-thread fetch was blocked but a module-worker fetch returned 200), and a `'self'` host source cannot be path-restricted, so the CSP does not limit that request to the city asset. The real enforcement is the ESLint network ban (exactly one exempt file, `src/lib/geo/city-fetch.ts`, none under `src/lib/worker/**`) plus the Playwright request assertions, which prove which asset the single request fetched. |

## Installation

```bash
# Scaffold (recommended entry point — do this before any manual package.json edits)
pnpm dlx sv create wot-gdpr-stats-visualizer
# → choose: minimal template, TypeScript, add-ons: eslint, prettier, vitest, playwright

# Core (if not already added by sv create)
pnpm add fflate papaparse dexie bits-ui

# Types
pnpm add -D @types/papaparse

# Build-time-only geo/map tooling (devDependencies — must NOT end up in the shipped bundle)
pnpm add -D world-atlas d3-geo topojson-client

# Dev tooling (if scaffolding didn't already add these)
pnpm add -D typescript@^6 svelte-check eslint eslint-plugin-svelte typescript-eslint prettier prettier-plugin-svelte vitest @playwright/test
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| ESLint + Prettier | Biome | If Svelte-file linting quality is a non-issue for you (e.g. you mostly lint `.ts` utility modules and treat `.svelte` files as lightly-linted), Biome's single-binary, single-config, 10-25x-faster setup is genuinely compelling and worth revisiting once Biome's Svelte rule coverage matures further (it's improving release-over-release). Not recommended now because this project's correctness burden (per PROJECT.md) leans on TypeScript type-awareness that Biome doesn't yet match. |
| TypeScript 6.x | TypeScript 7 / tsgo | Once TS 7.1 ships stable (targeted ~Nov 2026) and `svelte-check`/`typescript-eslint` publish TS7-compatible releases, revisit — tsgo's 6-12x compile speedup would meaningfully help this project's larger Web-Worker-heavy codebase. Don't adopt pre-7.1; the ecosystem gap is a hard blocker (typescript-eslint closed a TS7-support request as "not planned" as of this research, and Svelte template-checking cannot run TS7 at all pre-7.1). |
| world-atlas + build-time d3-geo | react-simple-maps / a runtime charting library's built-in map component | Only relevant if this were a React/Vue project with an existing map-component ecosystem; this project is Svelte with hand-rolled visualization, so a runtime map library would violate the dependency-minimalism constraint. |
| Downloading the official DB-IP Lite CSV monthly at build time (phase 06, Decision 1) | `@ip-location-db/dbip-country` npm package as a build input (offline fallback only; nothing installs it) | The npm mirror is deprecated on npm, was flagged SUS by the package-legitimacy gate, carries stale/buggy data, and has no city counterpart. The official download gives current data for both country and city tables with no extra dependency; the cost is a build-script download step (month resolved with a one-month fallback). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| SvelteKit | PROJECT.md explicitly avoids client-side routing to sidestep GitHub Pages' refresh-404 problem; SvelteKit's file-based routing and adapter model are unneeded overhead for a single-page dashboard and reintroduce the exact routing complexity being avoided. | Plain Vite + Svelte (the `sv create` "minimal" template without SvelteKit). |
| `npm create svelte@latest` | Deprecated scaffolding path pre-Svelte-5; superseded when Svelte 5 shipped. | `sv create` (the current official Svelte CLI). |
| TypeScript 7 / `tsgo` (today) | Ecosystem-breaking: `typescript-eslint` and Svelte template checking don't support it yet (confirmed as of Sept 2026, targeted fix ~7.1/Nov 2026). | TypeScript 6.x now; reassess after 7.1 stable ships. |
| JSZip | Already correctly rejected in PROJECT.md — larger, and its async unzip API blocks the main thread; this project's Web-Worker pipeline needs full off-thread decompression, which fflate provides natively. | fflate (already the locked-in choice). |
| MaxMind GeoLite2 (direct) | Already correctly rejected in PROJECT.md — account-gated, 30-day destroy-old-versions clause, redistribution flow-down obligations incompatible with a simple static-site build pipeline. | DB-IP Lite via the official monthly downloads (`download.db-ip.com`, already the locked-in choice; the deprecated `@ip-location-db/dbip-country` mirror was rejected). |
| Shipping `d3-geo`/`topojson-client`/`world-atlas` as runtime dependencies | Would silently reintroduce a "charting library" at runtime, contradicting PROJECT.md's explicit hand-rolled-SVG-charts decision and adding bundle weight for a one-time geometry computation that only needs to happen once, at build time. | Pre-render the world map's SVG paths at build time (or as a one-off generation script), commit the static output, and treat country-highlighting as pure CSS/DOM at runtime. |
| Relying on GitHub Pages HTTP response headers for CSP | GitHub Pages does not support custom response headers (no `_headers` file mechanism like Netlify/Vercel) — a plan built around header-based CSP will silently not work on this host. | `<meta http-equiv="Content-Security-Policy">` in `index.html`, as defense-in-depth backing the Playwright zero-network-requests CI assertion (which is the real enforcement mechanism). |

## Stack Patterns by Variant

**If the project later needs multi-account/multi-export storage (explicitly deferred in PROJECT.md, not v1):**
- Dexie's schema would move from a single-dataset table design to a keyed-by-zip-hash design.
- No new library needed — Dexie 4 already supports this; it's a schema/migration concern, not a stack concern.

**If Safari/Firefox testing is later promoted from best-effort to actively tested (not v1 per PROJECT.md):**
- Add Playwright's `webkit` and `firefox` projects to the existing Chromium-only Playwright config — no new tooling, just config expansion in `playwright.config.ts`.

**If TypeScript 7.1 ships and the Svelte/ESLint ecosystem catches up (post-Nov 2026):**
- Revisit the TS6→TS7 migration; the `sv`/`svelte-check`/`typescript-eslint` toolchain will need coordinated version bumps, not a solo `typescript` bump.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @sveltejs/vite-plugin-svelte@^7.3 | vite@^8.0.0, svelte@>=5.46.4, node@^20.19 \|\| ^22.12 \|\| >=24 | Hard peerDependency requirement — v6 of the plugin will NOT resolve against Vite 8; both must be bumped together. |
| actions/upload-pages-artifact@v4 | actions/deploy-pages@v4 (or newer) | Must be upgraded as a pair; mismatched majors break the GitHub Pages deploy step. |
| svelte-check@^4.7 | typescript@^6.x | Do not pair with TypeScript 7 yet — TS7 support requires `--tsgo`/`--tsgo-experimental-api` flags and dual-installing TS6+TS7, an unnecessary complication for a greenfield project; just stay on TS6 until 7.1 stabilizes. |
| PapaParse@^5.7 | @types/papaparse (matching major) | PapaParse ships no built-in types; the `@types` package is required for the TypeScript setup, not optional. |

## Sources

- [svelte - npm](https://www.npmjs.com/package/svelte) — current Svelte 5 version (LOW confidence, unpinned web search; verify at install time)
- [Introducing the new Svelte CLI](https://svelte.dev/blog/sv-the-svelte-cli) — `sv create` as the current scaffolding tool, replacing `npm create svelte@latest` (MEDIUM — official Svelte blog)
- [sv create • Svelte CLI Docs](https://svelte.dev/docs/cli/sv-create) — add-on menu (eslint, prettier, vitest, playwright, etc.) (MEDIUM — official docs)
- [Biome vs ESLint + Prettier 2026 sources, multiple] — Svelte support in Biome still catching up; ESLint recommended for Svelte projects (LOW-MEDIUM — blog aggregation, cross-referenced across ~6 independent 2026 posts pointing the same direction)
- [fflate - npm](https://www.npmjs.com/package/fflate) — current fflate version (LOW, web search)
- [papaparse - npm](https://www.npmjs.com/package/papaparse) — current PapaParse version (LOW, web search)
- [dexie - npm](https://www.npmjs.com/package/dexie) / [Releases · dexie/Dexie.js](https://github.com/dexie/Dexie.js/releases) — current Dexie 4.x version (LOW-MEDIUM, npm + GitHub releases)
- [bits-ui - npm](https://www.npmjs.com/package/bits-ui) / [Releases · huntabyte/bits-ui](https://github.com/huntabyte/bits-ui/releases) — current Bits UI version, Svelte 5 rewrite confirmation (LOW-MEDIUM)
- [vitest - npm](https://www.npmjs.com/package/vitest) — current Vitest major (LOW)
- [playwright - npm](https://www.npmjs.com/package/playwright) — current Playwright version (LOW)
- [actions/deploy-pages](https://github.com/actions/deploy-pages) / [actions/upload-pages-artifact](https://github.com/actions/upload-pages-artifact) — current major versions and pairing requirement (MEDIUM — official GitHub Actions repos)
- [Content-Security-Policy (CSP) header - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) / [connect-src - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src) — meta-tag CSP mechanics and `connect-src 'none'` behavior (HIGH — MDN)
- [content-security-policy.com meta examples](https://content-security-policy.com/examples/meta/) — meta-tag CSP limitations (`frame-ancestors` doesn't work in meta form) (MEDIUM)
- [vite - npm](https://www.npmjs.com/package/vite) / [Vite 8.0 is out!](https://vite.dev/blog/announcing-vite8) — current Vite major (LOW-MEDIUM — official blog + npm)
- [@sveltejs/vite-plugin-svelte - npm](https://www.npmjs.com/package/@sveltejs/vite-plugin-svelte) — v7 requiring Vite 8 peerDependency (LOW-MEDIUM, web search synthesis)
- [TypeScript 7 One Week In: Migration Readiness Check](https://www.digitalapplied.com/blog/typescript-7-native-compiler-early-adopter-migration-readiness), [ecorpit.com TS7 migration readiness](https://ecorpit.com/typescript-7-migration-readiness-eslint-astro-blockers-2026/), [pas7.com.ua TS7 native compiler](https://pas7.com.ua/blog/en/typescript-7-native-compiler-2026) — TS7 GA July 2026, ecosystem (typescript-eslint, Svelte/Vue/Astro template checking) not yet compatible, 7.1 targeted Nov 2026 (LOW-MEDIUM — cross-referenced across 3 independent 2026 sources, consistent conclusion)
- [world-atlas - npm](https://www.npmjs.com/package/world-atlas) / [topojson/world-atlas GitHub](https://github.com/topojson/world-atlas) — standard TopoJSON world-map data source (MEDIUM — canonical/maintained package, widely cited)
- [ip-location-db GitHub](https://github.com/sapics/ip-location-db) / [@ip-location-db/dbip-country - npm](https://www.npmjs.com/package/@ip-location-db/dbip-country) — history only: the npm mirror originally considered for PROJECT.md's DB-IP Lite decision; **rejected in phase 06 Decision 1** (deprecated, flagged SUS, stale data, no city counterpart) in favour of the official db-ip.com downloads (CC BY 4.0 licensing confirmed)
- [pnpm - npm](https://www.npmjs.com/package/pnpm) / [pnpm 12.6 blog](https://pnpm.io/blog/releases/12.6) — current pnpm major, Rust rewrite note (LOW-MEDIUM)

---
*Stack research for: browser-only, zero-backend static-site data-visualization SPA (Wargaming GDPR export viewer)*
*Researched: 2026-09-27*
