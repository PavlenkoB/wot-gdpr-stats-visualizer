# Requirements: WG Data Export Viewer

**Defined:** 2026-09-27
**Core Value:** Your data never leaves your machine — every decision is subordinate to keeping this verifiably true.

## v1 Requirements

### Import

- [x] **IMPORT-01**: User can drag-and-drop a Wargaming GDPR export `.zip` and have it unzipped + parsed entirely client-side (fflate + PapaParse, inside a single long-lived Web Worker reused across uploads)
- [ ] **IMPORT-02**: App auto-detects the zip's root/category-folder structure rather than assuming a fixed layout or naming
- [x] **IMPORT-03**: CSV parsing tolerates unexpected/missing columns and mixed line terminators (CRLF and bare-CR) rather than assuming the 2021 reference sample's exact schema
- [x] **IMPORT-04**: Double-UTF8-encoded (mojibake) text fields are corrected on parse
- [x] **IMPORT-05**: A zip that isn't a recognizable Wargaming export (wrong file, corrupt archive) shows a generic failure state
- [x] **IMPORT-06**: Uploading a new zip replaces the current dataset (single active dataset); re-uploading the identical zip is detected via hash and skipped rather than re-parsed

### Data Management

- [x] **DATA-01**: Parsed data is cached in IndexedDB (Dexie 4, bulkPut writes) so re-uploading isn't needed on repeat visits
- [x] **DATA-02**: A discoverable "clear my cached data" control wipes the IndexedDB cache, shipped in the same phase as caching itself
- [x] **DATA-03**: Export categories are classified 3-way — supported / known-deferred (Chat_history, Clans) / unknown (any folder never seen before) — all three render the same "detected but not yet supported" banner rather than being hidden, silently dropped, or crashing
- [x] **DATA-04**: A category folder absent from a given user's export (e.g. no Financial_data, no Warplanes data) shows that dashboard section empty/greyed-out rather than removing it

### Identity

- [x] **IDENTITY-01**: Dashboard opens with an account identity header (nickname, region, account-created date from `User_Info`) — the account's email (`LOGIN` field) is deliberately omitted from display

### Activity

- [x] **ACTIVITY-01**: Total hours / sessions / active days summary
- [x] **ACTIVITY-02**: Calendar heatmap, year-by-year, aggregated per-day (not one SVG node per session — scale requirement)
- [x] **ACTIVITY-03**: Day-of-week × hour-of-day heatmap, aggregated per-bucket
- [x] **ACTIVITY-04**: Session-duration distribution
- [x] **ACTIVITY-05**: Login-IP history table, masked by default (e.g. last octet hidden) with a click-to-reveal toggle
- [x] **ACTIVITY-06**: Country-level geolocation of login IPs, rendered on a bundled world-map SVG — offline lookup only (DB-IP Lite data from the official monthly download, pre-converted to a binary range table at build time; `@ip-location-db` is not installed), no live geo API, one-line attribution credit in the UI, bundled by default (small: ~1-2MB)
- [x] **ACTIVITY-07**: City-level geolocation available as an explicit opt-in ("load city-level detail") that lazy-loads a separate, much larger (~60-70MB) offline city-level database on demand — never bundled/downloaded by default, no live geo API

### Player Statistics

- [x] **STATS-01**: Per-vehicle battle stats (win rate, damage, battles, etc.) across WoT, WoT Blitz, World of Warships, and World of Warplanes

### Financial

- [x] **FINANCE-01**: Premium-time operations timeline
- [x] **FINANCE-02**: Virtual-currency flow timeline
- [x] **FINANCE-03**: Real-money spend summary from `Payment_history`, totaled **per currency** (PAID orders only) — never blended or converted into a single number

### Platform & Privacy

- [ ] **PLATFORM-01**: Dashboard is responsive and usable at phone width
- [ ] **PLATFORM-02**: Zero network requests after initial page load, enforced by an automated Playwright CI assertion, backed by a CSP meta tag as defense-in-depth
- [ ] **PLATFORM-03**: Deployed as a static site to GitHub Pages via the official `actions/deploy-pages` GitHub Actions workflow

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Categories

- **V2-CHAT-01**: Chat_history dashboard — deferred; also carries a bystander-data dimension (contains other players' messages, not just the account holder's) that needs a privacy-scoping pass before UI design
- **V2-CLANS-01**: Clans dashboard — same bystander-data caveat as Chat_history

### Localization

- **V2-I18N-01**: Ukrainian translation (English-only for v1)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Comparing two exports taken months apart | Explicitly rejected by project owner — too much work relative to value |
| Multiple simultaneously-stored exports / multi-account switching | Single active dataset only; re-architecting to a keyed multi-export store is a possible future direction, not a v1/v2 commitment |
| Live API polling / enrichment of any kind | Structural violation of Core Value (zero network requests) — never miscategorize this as an ordinary backlog item |
| WCAG/accessibility target for hand-rolled SVG charts | No a11y bar set for v1 |
| Active Safari/Firefox testing | Chrome-first target; other browsers are best-effort, not verified |
| Bans, Bonus_codes, Customer_support_tickets, Device_info, Payment_history (beyond the spend summary), Personal_coupons, Subscriptions, Tracking_data, Authorized_Third_Parties | No dedicated dashboard built for v1 — covered generically by DATA-03's "detected but not yet supported" classification |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| IMPORT-01 | Phase 2 | Complete |
| IMPORT-02 | Phase 1 | Complete |
| IMPORT-03 | Phase 2 | Complete |
| IMPORT-04 | Phase 2 | Complete |
| IMPORT-05 | Phase 1 | Complete |
| IMPORT-06 | Phase 2 | Complete |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| DATA-03 | Phase 3 | Complete |
| DATA-04 | Phase 3 | Complete |
| IDENTITY-01 | Phase 3 | Complete |
| ACTIVITY-01 | Phase 4 | Complete |
| ACTIVITY-02 | Phase 4 | Complete |
| ACTIVITY-03 | Phase 4 | Complete |
| ACTIVITY-04 | Phase 4 | Complete |
| ACTIVITY-05 | Phase 6 | Complete |
| ACTIVITY-06 | Phase 6 | Complete |
| ACTIVITY-07 | Phase 6 | Complete |
| STATS-01 | Phase 5 | Complete |
| FINANCE-01 | Phase 5 | Complete |
| FINANCE-02 | Phase 5 | Complete |
| FINANCE-03 | Phase 5 | Complete |
| PLATFORM-01 | Phase 7 | Pending |
| PLATFORM-02 | Phase 1 | Complete |
| PLATFORM-03 | Phase 7 | Pending |

**Coverage:**

- v1 requirements: 25 total (corrected from 24 — ACTIVITY-07 was added after the initial count)
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-27*
*Last updated: 2026-09-28 — IMPORT-02 + IMPORT-05 marked Complete by 01-03 (hardened classifier, reasoned outcome, A2 + no-inflation tests locked)*
