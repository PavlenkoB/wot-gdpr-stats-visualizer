# Project Research Summary

**Project:** WG Data Export Viewer (wot-gdpr-stats-visualizer)
**Domain:** Browser-only, zero-backend personal-data-export viewer with client-side analytics
**Researched:** 2026-09-27
**Confidence:** MEDIUM overall (core stack and architecture recommended strategies are HIGH; features and pitfalls triangulated across adjacent domains due to lack of direct precedent)

## Executive Summary

This project is a privacy-focused, single-page data-visualization tool that parses a Wargaming GDPR export entirely in the browser using a structured Web Worker pipeline (unzip → parse → IndexedDB) backed by a hand-rolled SVG dashboard. The core differentiator is offline, client-side geolocation of login IPs using a pre-built binary lookup table, combined with zero-network enforcement through CSP and automated CI checks — both unique to this tool in the gaming-data-export space.

The recommended approach combines proven technologies (Svelte 5, Vite, Dexie 4) with deliberate minimalism (hand-rolled charts, no router, no charting libraries) that keeps the attack surface small and the bundle lean. Key risk mitigation: the project must address PII masking/lifecycle management (Pitfalls 1-2) early and rigorously, since displaying sensitive fields (IPs, eventually emails) plaintext-by-default creates a false sense of safety. The architecture is sound and well-scoped; execution risk concentrates on two design areas: respecting the privacy implications of self-surveillance dashboards, and scaling hand-rolled SVG rendering to large veteran accounts.

Research confirms all locked decisions in PROJECT.md are sound. One gap-fill recommended: pin TypeScript to v6.x (not v7, which breaks the Svelte/ESLint ecosystem until ~Nov 2026). Two package recommendations: world-atlas + d3-geo/topojson-client (build-time only) for the world-map SVG, and @ip-location-db/dbip-country for the geo-IP dataset.

## Key Findings

### Recommended Stack

**All locked technologies confirmed current and sound.** Svelte 5 has been GA for ~18 months with a stable runes-based reactivity model; Vite 8 ships mature module worker support; pnpm 12 is a fresh Rust rewrite (Aug 2026) with no compatibility concerns. Dexie 4 is actively maintained with Safari IndexedDB fixes in the baseline. fflate and PapaParse are current and carry verified implementation details (PapaParse auto-detects bare-CR line endings; fflate's sync variant is correct for off-main-thread use).

**One addition recommended:** TypeScript 6.x, not 7. TypeScript 7.0 shipped in July 2026 as a native Go compiler, but as of Sept 2026, `typescript-eslint` (type-aware rules for this project's schema validation) and Svelte's template-checking ecosystem cannot target TS7 yet — ecosystem stabilization is targeted for 7.1 (Nov 2026 estimate). Pin TS6 as the "stable bridge" until 7.1 ships.

**Two development-tool gaps filled:**
- **world-atlas + d3-geo + topojson-client** (devDependencies only): Generate the world-map SVG paths at build time from Natural Earth data, then check the static `.svg` into the repo. Never ship d3-geo to the browser.
- **@ip-location-db/dbip-country** (devDependency): Convert the DB-IP Lite CSV to a binary IP-range lookup table at build time via a Node script, emit to src/assets/geo-ranges.bin, load synchronously at render time.

**Core technologies:**
- Svelte 5 + runes, Vite 8, TypeScript 6.x, ESLint + Prettier, Dexie 4.4.x, fflate, PapaParse, Vitest, Playwright

### Expected Features

**Table stakes (must-have for any export viewer):**
100% client-side zero-network processing, drag-and-drop file input, auto-detect folder structure, graceful missing/invalid handling, calendar + day-of-week heatmaps, per-vehicle stats table, IndexedDB caching with hash dedup, responsive layout, zero-network CI enforcement.

**Differentiators (locked in v1, genuinely unique):**
Offline client-side login-IP geolocation (no comparable tool found does this), unified multi-title coverage (WoT + Blitz + WoWS + WoWP), CI-enforced zero-network guarantee, deeper time-granularity than competitors.

**Candidate gaps** (flagged for explicit acceptance/rejection, not re-scoping):
Account identity header from User_Info (cheap enough that explicitly rejecting costs less than silent omission), real-money spend summary from Payment_history (highest-value candidate gap; currently in undifferentiated unscoped bucket).

**Anti-features** (ruled out with reasoning):
Cross-export diffing, percentile benchmarking, Chat_history/Clans (contain bystander data), city-level geolocation (unshippable client-side), live API polling (violates Core Value).

### Architecture Approach

Single long-lived Web Worker sequences: hash (dedup) → unzip (fflate sync) → classify (category detection) → parse (worker-less PapaParse) → write (Dexie bulkPut). Main thread owns dropzone, app state (runes), and four independent dashboards, each reading their own Dexie table. Build-time Node script converts DB-IP Lite CSV to binary range table; at runtime, login-IP normalization calls synchronous binary-search lookup to attach country codes once per row before write.

**Key patterns:**
1. Single long-lived worker (not per-upload) — ensures single-active-dataset invariant survives race conditions
2. Worker-less PapaParse inside our worker — avoids documented nested-worker friction
3. fflate unzipSync (not async) — avoids spinning up fflate's internal worker pool
4. Hash-check before unzip — dedup must avoid all costs, not just write cost

### Critical Pitfalls (Top 3)

1. **Plaintext-by-default PII creates false sense of total safety** — IP addresses and emails leak through screenshot/screen-share, not network. Prevention: mask by default, reveal-on-click. Phase: Activity_history / login-IP table.

2. **IndexedDB cached PII has no lifecycle on shared machines** — plaintext on disk, readable by XSS or next OS user. Prevention: ship "Clear my data" control from day one, paired with caching, not deferred. Phase: IndexedDB caching.

3. **Silently blending multi-currency amounts into one total** — real accounts span USD/RUB/UAH; a blended sum is meaningless and misinforms. Prevention: group by currency, never cross-currency sums. Test against synthetic 2+-currency fixture. Phase: Financial_data dashboard.

**Additional critical pitfalls:** hardcoded FX rates (false precision + retroactive drift), SVG-per-data-point rendering (hundreds-of-thousands DOM nodes freeze tab on large accounts), raw ungrouped IP table feels invasive (design with summary-first, grouped-table-second), convenience affordances leak PII (copy/title/export must route through mask state).

## Implications for Roadmap

Research suggests a 9-phase pipeline with explicit dependencies:

### Phase 1: Worker Contract & Skeleton
Prove end-to-end typed postMessage/transferable-ArrayBuffer round-trip. Every downstream phase depends on stable communication contract.

### Phase 2: Unzip + Category Auto-Detection
Real unzipSync + entry-path walking + three-bucket classification (supported/deferred/unknown). Tolerates format drift.

### Phase 3: CSV Parsing + Mojibake Fix
Defensive, worker-less PapaParse + double-UTF8 byte-roundtrip fix. Validates in-memory before Dexie exists.

### Phase 4: Dexie Schema + Write Stage
Shared db/schema.ts, meta table (hash + dedup), per-category tables, clear-then-replace. **Gating phase** — all dashboards depend on this. Must include "clear my data" control + deletion verification (Pitfall 2 prevention).

### Phase 5: App State + Page Shell
Svelte 5 runes wired to worker messages. Placeholder sections with empty/greyed states. Proves "detected but not supported" rendering works.

### Phases 6A–6D: Feature Dashboards (Parallelizable)
All independent after Phase 4:
- **6A: Activity Heatmaps** (calendar + day-of-week × hour + session duration) — highest user value, highest scaling risk; test against synthetic 10-15 year fixture. **Research flag: needs SVG rendering scale testing.**
- **6B: Vehicle Stats** (per-vehicle table across 4 titles) — single most recognizable WoT feature.
- **6C: Financial Timeline** (premium + currency) — test against synthetic 2+-currency fixture; record explicit "no conversion in v1" decision.
- **6D: Login-IP + World Map** (table + offline geo + world-atlas) — largest technical novelty, most pitfall risk; benefits from Phase 8 polish first. Design with summary-first, grouped-table-second layout (Pitfall 6).

### Phase 7: Build-Time Geo Script
Node script: CSV → binary range table. Zero dependency on Phases 1–6; can be parallel. Verify @ip-location-db/dbip-country stability and CC BY 4.0 licensing.

### Phase 8: Cross-Cutting Polish + UX Refinement
Responsive layout, Bits UI wiring, table/chart virtualization, timezone disclosure. **Critical: PII-masking audit across all surfaces** (copy buttons, document.title, export features). Verify virtualization tested at scale.

### Phase 9: Zero-Network CI + Deploy
Playwright zero-network-requests assertion + CSP meta tag + GitHub Pages deployment. Can be introduced early (Phase 1) and left running; listed here for clarity.

### Phase Ordering Rationale

Phases 1–4 are sequential gating phases (each unblocks the next). Phases 6A–6D are parallelizable after Phase 4. Phase 7 is independent. Phase 8 refines all feature work. Phase 9 is enforcement throughout.

**Why this avoids pitfalls:**
- Pitfall 1 (plaintext PII) + 7 (copy leaks unmasked): Phase 6D + Phase 8 pair design with implementation, verified across all surfaces.
- Pitfall 2 (IndexedDB lifecycle): Phase 4 includes "clear my data" from day one.
- Pitfall 3–4 (multi-currency): Phase 6C tests synthetic 2+-currency; explicit "no conversion" decision during planning.
- Pitfall 5 (SVG scaling): Phases 6A and 6D test against synthetic large fixtures before done.
- Pitfall 6 (invasive IP): Phase 6D includes design review during planning.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 6A (Heatmaps):** SVG rendering performance at scale — only real sample (2021, ~4k sessions) is small; must test synthetic 50k+ fixture before calling done.
- **Phase 6C (Financial):** Multi-currency dataset diversity — unverified in Payment_history; test synthetic 2+-currency fixture regardless.
- **Phase 6D (Login-IP):** Geo-binary-search performance and world-atlas SVG at scale (per-country aggregation needed, not per-login pins).

**Phases with standard patterns (skip research-phase):**
- **Phase 1–4:** Worker contracts, unzip/parse, Dexie patterns all well-documented.
- **Phase 7:** CSV-to-binary conversion is straightforward.
- **Phase 9:** Playwright network assertions + GitHub Pages deployment are standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All locked technologies verified current; ecosystem ready (Svelte 5 GA 18mo, Vite 8 stable, pnpm 12 current). TypeScript 6.x pin sourced to Sept 2026 ecosystem readiness. world-atlas + ip-location-db are standard, maintained packages. |
| Features | MEDIUM | No direct Wargaming GDPR viewer competitor found (greenfield). Findings triangulated across general GDPR viewers (Muletto, TakeoutReader) and live Wargaming dashboards (wot-life, WoTLabs). Two candidate gaps pattern-matched from adjacent genres, not confirmed exact precedent. All locked v1 features confirmed as table stakes or genuine differentiators. |
| Architecture | MEDIUM-HIGH | Component design synthesizes PROJECT.md's locked decisions + verified library constraints. Worker message contracts, Dexie patterns, fflate/PapaParse claims HIGH confidence (sourced official docs + GitHub issues). Suggested 9-phase build order is original synthesis, not external reference. |
| Pitfalls | MEDIUM | Seven critical pitfalls identified; PII-masking + IndexedDB-lifecycle are corroborated web search + project-specific reasoning. SVG-scaling is industry-corroborated (tens-of-thousands-node limits well-documented). Pitfall 6 (invasive IP UX) is project-specific, included because self-surveillance-dashboard framing is genuinely novel. Multi-currency pitfalls well-corroborated in personal-finance-app research. |

**Overall confidence:** MEDIUM (stack HIGH, architecture MEDIUM-HIGH, but features/pitfalls MEDIUM due to greenfield with no direct precedent)

### Gaps to Address During Planning & Execution

1. **Large account scale is unverified:** Only ~2.2MB / ~4,200 rows from 2021 inspected. Must build synthetic fixtures at 10–50x scale and test all hand-rolled SVG before considering heatmaps done. Pitfall 5 recovery cost is MEDIUM-HIGH.

2. **Currency-code diversity unconfirmed:** Only Financial_data (virtual currency) is v1 scope; if Payment_history lands in v1, verify actual dataset contains multiple currencies (USD/RUB/UAH confirmed possible, not yet confirmed present).

3. **Export format drift:** 5-year-old sample. Recommend periodic validation check (quarterly, fresh real export) rather than assuming format stays representative.

4. **Heatmap color-scale linearity:** Outlier-dominated scales hide patterns. During Phase 6A design, decide percentile- or log-scaled mapping, not linear min-max.

5. **Timezone basis for day-of-week × hour heatmap:** Recommendation timezones are server-time/UTC; pick one explicitly and label in UI.

6. **IP table sorting/filtering at scale:** Test explicitly against synthetic 10k+ rows for smooth performance before Phase 6D done.

7. **"Clear my data" control discoverability:** Phase 4/5 design should make this first-class UI, matching the privacy-conscious persona.

## Sources

### STACK.md (HIGH confidence)
- Official Svelte blog + docs, npm package pages, TypeScript 7 ecosystem sources
- PapaParse GitHub issues (worker-mode antipatterns)
- world-atlas + @ip-location-db/dbip-country documentation

### FEATURES.md (MEDIUM confidence)
- Muletto, TakeoutReader, Spotify Data Viewer, ListenStats (general GDPR patterns)
- wot-life, WoTStars, WoTLabs, NoobMeter (live WoT dashboards)
- No direct Wargaming GDPR viewer competitor found

### ARCHITECTURE.md (MEDIUM-HIGH confidence)
- fflate, PapaParse documentation + GitHub issues
- Project-specific synthesis of component boundaries + build order

### PITFALLS.md (MEDIUM confidence)
- Smashing Magazine, Mailtrap, DEV Community, Know Your Dosh (PII masking, multi-currency, SVG rendering)
- w3c/IndexedDB GitHub (plaintext storage discussion)
- Project-specific reasoning on self-surveillance dashboard UX

---
*Research completed: 2026-09-27*
*Ready for roadmap: yes*
