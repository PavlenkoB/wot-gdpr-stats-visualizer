# Feature Research

**Domain:** Browser-only personal-data-export viewer (GDPR "download your data" visualizer) applied to gaming stats — specifically a Wargaming (World of Tanks / WoT Blitz / World of Warships / World of Warplanes) GDPR export dashboard
**Researched:** 2026-09-27
**Confidence:** MEDIUM — no direct competitor exists (no other tool visualizes Wargaming GDPR exports specifically, per search), so findings are triangulated from two adjacent categories: (1) general GDPR/personal-data-export viewers (Muletto, TakeoutReader, Spotify Data Viewer/ListenStats/stats.fm) and (2) live Wargaming stats dashboards (wot-life, WoTLabs, WoTStars, NoobMeter) that use the public API rather than GDPR exports. Both are close enough analogues to be load-bearing, but neither is an exact match.

## Context: v1 Scope Is Already Locked

Per `.planning/PROJECT.md`, v1 scope is fixed and this document does **not** propose re-scoping it. v1 (Active requirements) covers: client-side zip parsing with auto-detected folder structure, Activity_history (calendar heatmap, day-of-week×hour heatmap, session-duration distribution, login-IP table + offline country-level geo map), Player_statistics (per-vehicle stats across all four titles), Financial_data (premium-time + virtual-currency timelines), IndexedDB caching with hash-dedup and single-active-dataset replacement, graceful handling of missing/unsupported categories and invalid files, mobile-responsive layout, and a CI-enforced zero-network guarantee. Explicitly out of scope: cross-export comparison, i18n, Chat_history, Clans, city-level geo, multi-export storage, and dedicated a11y/cross-browser work.

This document's job: confirm the locked scope covers genuine table stakes for this category, flag anything it's missing, and give reasoned categorization to the deferred items.

## Feature Landscape

### Table Stakes (Users Expect These)

Features every comparable tool in either adjacent category treats as baseline. Confirmed already present in locked v1 unless marked.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 100% client-side processing, zero upload | Every browser-based GDPR-export viewer found (Muletto, TakeoutReader, Spotify Data Viewer, ListenStats) leads with "nothing leaves your device" — it's the entry ticket to this exact category, not a bonus. Users requesting a GDPR export are self-selected as privacy-conscious. | HIGH (Worker pipeline, CSP, CI check) | Already locked in v1 and elevated to Core Value in PROJECT.md — correctly the single non-negotiable feature. |
| Drag-and-drop file input, no account/login | Standard interaction for every local-processing export viewer surveyed; a login step would contradict the "your data never leaves your machine" promise. | LOW | Locked in v1. |
| Auto-detect archive structure (don't assume fixed folder names) | Export formats drift over time (WG's own export changed enough between 2021 and today that the sample used for research is already 5 years stale); a tool that assumes a fixed schema breaks on the next format revision. | MEDIUM | Locked in v1; correctly treated as foundational rather than a nice-to-have. |
| Graceful handling of missing data categories | Every comparable tool (TakeoutReader explicitly reports unsupported/missing formats "not silently skipped" rather than erroring) treats partial exports as the norm, not the exception — not every WoT/WoWS/WoWP account has data in every category. | LOW-MEDIUM | Locked in v1 (empty/greyed section instead of removing it). |
| Generic failure state for invalid/corrupt input | Baseline error-handling expectation for any file-upload tool. | LOW | Locked in v1. |
| Calendar/activity heatmap for time-based data | The GitHub-style calendar heatmap is now the default visual language for "how active was I over time" across the whole genre (Spotify/stats.fm-style wrapped views, WoT-life's battles-per-day charts). Users expect it the moment "session/activity history" exists in the data. | MEDIUM | Locked in v1 (year-by-year calendar heatmap + day-of-week×hour heatmap). |
| Per-item/per-vehicle stats table | This is the single most central feature of every Wargaming-adjacent stats dashboard found (wot-life, WoTLabs, WoTStars, NoobMeter all center their entire UI on a per-vehicle table). Omitting it wouldn't just feel incomplete — it would fail to be recognizable as a WoT stats tool at all. | MEDIUM | Locked in v1 (Player_statistics across all 4 titles). |
| Persistence across visits (no re-upload every time) | Spotify Data Viewer/ListenStats and similar tools process-and-hold in-browser; re-forcing a multi-MB zip re-upload on every visit reads as broken state management to users used to any modern web app. | MEDIUM | Locked in v1 (IndexedDB + hash-dedup). |
| Responsive/mobile-usable layout | Baseline for any 2026 web dashboard; explicitly called out as a constraint in PROJECT.md. | MEDIUM (harder for hand-rolled SVG charts than for a charting library) | Locked in v1. |
| Login/session history table | A standard "security" page pattern across virtually every personal-data export (device/location/IP history is one of the most consistently-included categories in *any* GDPR export, not just Wargaming's) — users specifically look for this because it's the category that feels most "surveillance-adjacent" and thus most worth inspecting. | MEDIUM | Locked in v1, paired with offline country geo — see Differentiators, this exceeds pure table stakes. |

**Two candidate gaps not currently in the locked list** (flagged per this research's mandate — not a re-scope proposal, a note for the requirements phase to explicitly accept or reject):

| Feature | Why it may be table stakes here | Complexity | Why it's a candidate gap |
|---------|----------------------------------|------------|--------------------------|
| Lightweight account identity header (nickname, region, account-created date) | Every comparable tool opens with an identity/summary header before diving into charts: Muletto's profile view, TakeoutReader's report header, wot-life's player page banner. Without it, the dashboard has four data sections but no "whose data is this" anchor. | LOW — the source data (`User_Info`) is almost certainly already present in the export; this is a rendering task, not a new parser category of any real weight | `User_Info` is currently bucketed only as "detected but not yet supported," with no individual reasoning given (unlike the six items in the reasoned Out-of-Scope list). A one-line identity header is cheap enough that its absence looks like an oversight bucket-fill rather than a deliberate cut. |
| Real-money total spend summary | Total lifetime spend is arguably *the* headline stat in the "gaming data export" sub-genre specifically — the entire "how much have I spent on this game" calculator category (Steam, League of Legends, Genshin, loot-box trackers) exists because this exact number is what drives people to request a data export in the first place, more than session-activity heatmaps. | LOW-MEDIUM — depends on whether `Payment_history` contains structured transaction amounts (unverified; PROJECT.md's Context section did not confirm this category was inspected in the sample export) | `Payment_history` is bucketed with 9 other unscoped categories under a single blanket "not yet supported" treatment, with no individual reasoning recorded — unlike the deliberate, reasoned exclusions for Chat_history/Clans/comparison/etc. Given how central spend-awareness is to this genre, an unreasoned omission carries more risk than the other 9 categories in that bucket. |

Both are presented as flags for the requirements phase to accept or explicitly reject with reasoning — not as an instruction to expand locked v1 scope.

### Differentiators (Competitive Advantage)

Locked-v1 features (and one architectural choice) that go beyond table stakes into genuine competitive advantage, because no comparable tool found does them.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Offline, fully client-side login-IP geolocation + world map | No comparable tool found does IP-derived geo mapping entirely offline. Live WG stats dashboards (wot-life/WoTLabs) don't have access to login-IP data at all (it's GDPR-export-only, not in the public API), so this data simply doesn't exist anywhere else visualized. General GDPR viewers that do maps (Muletto, Google Timeline visualizer) map *GPS* location history, not IP-derived geo — a genuinely different, harder data-engineering problem (needing a bundled offline range-lookup dataset). | HIGH (bundled DB-IP Lite dataset converted at build time, world-atlas SVG rendering) | Already a locked v1 decision (Key Decisions table); this research confirms it's not just feasible but a real differentiator, not merely a nice visual. |
| Unified multi-title coverage (WoT + Blitz + WoWS + WoWP) in one tool | Every live competitor found is single-title: wot-life/WoTLabs/NoobMeter cover classic WoT only, WoTStars covers Modern Armor (console) only, and warships-specific trackers (e.g. wowsnumbers-style sites) are separate from tank trackers. A single dashboard spanning the whole WG portfolio from one export has no existing equivalent. | MEDIUM (mostly a data-modeling/UI concern once per-title parsers exist) | Reinforced by the unplanned discovery noted in PROJECT.md that WoWP data appeared unprompted in the sample — the multi-title breadth is larger than originally assumed, which strengthens this as a differentiator rather than diluting it. |
| CI-enforced zero-network-requests guarantee + CSP, not just a claim | Muletto's privacy claim ("nothing is sent anywhere") is asserted in marketing copy with a CSP as a runtime backstop; this project pairs the CSP with an automated CI check, i.e. a broken build if a future dependency ever makes a network call, not just a runtime safeguard against it. | MEDIUM (one CI job + Playwright network-assertion test) | Already locked in v1. Turns the core value into something verifiable rather than asserted — a meaningfully stronger trust signal for a privacy-focused audience than what the closest comparable ships. |
| Deeper time-granularity than competitor "battles per day" charts | Day-of-week × hour-of-day heatmap and session-duration distribution go beyond the single daily-activity line/bar chart that live dashboards (wot-life) typically show. | MEDIUM | Already locked in v1; genuinely differentiated slice of the activity data most competitors don't surface at all. |
| Hash-based re-upload dedup with single-dataset replace | None of the surveyed general-purpose export viewers (Spotify Data Viewer, ListenStats) mention re-upload detection; they just reprocess whatever's dropped. | LOW-MEDIUM | Already locked in v1; a small UX polish differentiator, not a headline one. |

### Anti-Features (Commonly Requested, Often Problematic)

Includes the six items PROJECT.md already excludes (with this research's added reasoning/context) plus two genre-informed additions.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Cross-export historical diffing (compare two exports months apart) | Progression-over-time tracking is the *entire* value proposition of live competitor tools (wot-life/WoTLabs exist specifically because they poll the API repeatedly and chart change over time) — it's tempting to want the same here. | A single GDPR export already contains a full session/activity timeline back to account creation, so most of the "progression" value is already captured within one export; diffing two separate exports adds a second full dataset to store, a comparison UI, and reconciliation logic (same vehicle/session appearing in both) for a genre where the live-tracker competitors already do this better with live data. PROJECT.md's "too much work relative to value" holds up under scrutiny. | If progression-over-time becomes a real ask later, point users at the existing live trackers (wot-life etc.) for that use case rather than rebuilding it here — the two tool categories solve different problems. |
| Global/percentile benchmarking vs. server averages (WoTLabs-style colored ratings) | This is the single most recognizable UI convention in the *live* WoT stats dashboard genre (color-coded WN8/win-rate ratings against server averages) — easy to assume it's "table stakes for a WoT stats tool." | A GDPR export contains only the account holder's own numbers; there's no server-average reference data inside it. Bundling and maintaining an external benchmarking dataset is exactly the kind of dependency the project's own "dependency minimalism" constraint warns against, and it would need periodic updates to stay meaningful — a maintenance burden this project's zero-backend, ship-once model isn't built for. | Show the raw numbers; let players who want percentile context cross-reference wot-life/WoTLabs, which already do this well with fresher, live data. |
| Chat_history full conversation viewer | Modeled on general GDPR viewers' flagship feature (Muletto's "Conversation View" consolidating DMs across platforms is explicitly their headline differentiator), so it's tempting to assume the same pattern transfers here. | Two compounding reasons beyond "deferred, real category" (PROJECT.md's stated reason): (1) WoT chat_history is mostly ephemeral battle/team chat, lower narrative density than the DMs/photos that make Muletto's conversation view compelling; (2) it inherently contains *other players'* messages, not just the account holder's — a bystander-data question (whose consent applies to displaying someone else's chat text back to a third party?) that the currently-locked v1 categories mostly avoid. This is a genuinely different risk profile from "just needs a chat-thread UI," worth carrying into v2 scoping explicitly. | Defer past v1 as already decided; when picked up for v2, scope it as a privacy/bystander-data question first, UI-design question second. |
| Clans dashboard | Reasonable to assume "table stakes" since every live WoT dashboard (wot-life, WoTLabs) has clan pages. | Same bystander-data issue as Chat_history: clan data is inherently about other players, not just the account holder, so it's a different privacy category from "personal activity/stats," not simply "another dashboard section to build." | Defer past v1 as already decided; scope as a bystander-data question in v2, same as chat. |
| City-level IP geolocation | Users will always want more precision than country-level once they see the login-IP map — "why not show the actual city" is a predictable request. | Confirmed technically correct to rule out: city-level geo-IP databases run tens of MB, which is unshippable in a client-side-only, zero-backend bundle without defeating the "instant load, no backend" model. This is a permanent physical constraint, not a v1-timing decision. | None needed — country-level is the sustainable ceiling for this architecture; communicate this clearly in-product so it doesn't read as an unfinished feature. |
| i18n / Ukrainian translation | The WoT playerbase is heavily international (RU/UA/PL/DE communities), so it's tempting to treat this as more urgent than a typical English-only web tool. | Genuinely lower-risk to defer than it looks: this is a single-player local utility (one person parsing their own export), not a hosted multi-tenant service — the audience that can find and use a GitHub-Pages-hosted GDPR-export tool at all has already cleared an English-literacy bar (reading Wargaming's own English-language export instructions to get the zip in the first place). | Revisit as a v2 candidate if usage data or direct requests show real demand; not a launch risk. |
| Multi-export / multi-account storage | Natural ask once dedup/caching exists — "why can't I keep both my WoT and my friend's export loaded." | Re-architecting from a single keyed dataset to a multi-export store is a real data-model change (PROJECT.md already flags this), not a UI toggle; doing it speculatively before there's a validated need risks building the wrong keying scheme. | Single active dataset for v1 as locked; revisit only if there's a validated multi-account use case. |
| Downloadable export of computed/derived stats (CSV/PDF of the dashboard) | Seems like natural symmetry — "I uploaded a file, let me download a summary file." | Not requested anywhere in the locked scope and not table stakes for this category: the user already possesses the raw GDPR zip, so a derived-data re-export duplicates Wargaming's own data without adding trust value, while reintroducing a file-leaves-the-tool interaction that (even though harmless) sits awkwardly next to a zero-network-requests trust story and adds testing surface for no validated demand. | Skip entirely; if ever requested, treat as a discrete, separately-scoped feature rather than default dashboard behavior. |
| Live polling of Wargaming's public API to enrich the export (as wot-life/WoTLabs do) | Would let the tool auto-refresh/enrich stats between export uploads, closing the gap with live trackers. | Directly violates the zero-network-requests Core Value — this isn't a scope-timing question like the others in this table, it's structurally incompatible with the stated reason the project exists. | Never add, at any version, without first renegotiating Core Value itself in PROJECT.md — flag this distinction explicitly so it isn't miscategorized as a garden-variety "v2 maybe." |

## Feature Dependencies

```
Zip parsing + auto-detected category folders
    └──requires──> (nothing upstream; foundational)
    └──enables──> Activity_history dashboard
    └──enables──> Player_statistics dashboard
    └──enables──> Financial_data dashboard
    └──enables──> "detected but not supported" listing for unscoped categories
                       (this listing is a side-effect of generic auto-detection
                        working across ALL categories, not a separate feature)

IndexedDB caching + hash-dedup
    └──requires──> Zip parsing pipeline producing a stable canonical representation to hash

Calendar heatmap ─┐
Day-of-week×hour heatmap ─┼──derive-from──> same Activity_history session-log parse
Session-duration distribution ─┘              (share one parsed table; no separate dependency chain)

Login-IP world map
    └──requires──> Offline geo-IP dataset (bundled at build time)
    └──enhances──> Login-IP history table (map is a visualization layer on top of the
                     table, not a separate data source — table can ship without the map,
                     map cannot ship without the table)

Per-vehicle stats table sorting/filtering (candidate gap)
    └──enhances──> Player_statistics table (table is useful without this; this makes
                     it usable at scale across 4 titles × many vehicles)

Account identity header (candidate gap)
    └──requires──> User_Info parsing added to the pipeline (currently unscoped)

Real-money spend summary (candidate gap)
    └──requires──> Payment_history parsing added to the pipeline (currently unscoped)

Chat_history viewer (v2) ──conflicts-with──> "personal data only" framing
    (contains other players' messages — needs its own bystander-data decision, not
     just a parser + UI)

Clans dashboard (v2) ──conflicts-with──> "personal data only" framing
    (contains other players' data — same bystander-data decision as chat)

Cross-export diffing ──conflicts-with──> Single-active-dataset data model
    (would require the multi-export storage re-architecture, not a UI addition)

Live API polling ──conflicts-with──> Zero-network-requests Core Value
    (structural incompatibility, not a scoping choice)
```

### Dependency Notes

- **Login-IP map requires the login-IP table, not the reverse:** ship the table first if the offline geo-dataset build step slips; the map is additive.
- **The two candidate gaps (identity header, spend summary) each require adding a new export category to the parsing pipeline** (`User_Info`, `Payment_history` respectively) that is currently only in the generic "detected but not supported" bucket. Accepting either candidate is therefore not a pure UI change — it's a small scope decision about which unscoped category gets a first-class parser.
- **Chat_history and Clans both carry a bystander-data dimension** that the currently-locked v1 categories (Activity_history, Player_statistics, Financial_data) don't have — all currently-locked categories describe only the account holder's own actions/data. This is a reason to scope both, when picked up in v2, as a privacy decision first and a feature-build second.
- **Cross-export diffing and live API polling are not the same kind of "no"** — diffing is a cost/value tradeoff (could be revisited), live polling is a Core Value violation (should not be revisited without a PROJECT.md-level conversation).

## MVP Definition

### Launch With (v1 — already locked, not being re-proposed here)

- [x] Client-side zip parsing with auto-detected category structure
- [x] Activity_history: totals, calendar heatmap, day-of-week×hour heatmap, session-duration distribution
- [x] Activity_history: login-IP table + offline country-level geo + world map
- [x] Player_statistics: per-vehicle stats across WoT/Blitz/WoWS/WoWP
- [x] Financial_data: premium-time + virtual-currency timelines
- [x] IndexedDB caching, hash-dedup, single-dataset replace
- [x] Unscoped-category "detected but not supported" listing
- [x] Missing-category empty/greyed state, invalid-file generic failure state
- [x] Mobile-responsive layout
- [x] CI-enforced zero-network-requests + CSP

### Recommended to Decide Before Launch (flagged gaps, not a scope mandate)

- [ ] Account identity header (nickname, region, created date) from `User_Info` — cheap enough that explicitly rejecting it (with a reason) costs less than silently omitting it
- [ ] Real-money total spend summary from `Payment_history` — the highest-value candidate gap found in this research; recommend an explicit accept/reject decision rather than leaving it in the generic unscoped bucket
- [ ] Confirm the Player_statistics table is sortable/filterable (likely already implied by "dashboard," but not spelled out in the locked requirements — worth making explicit given hundreds of vehicles across 4 titles)

### Future Consideration (v2+)

- [ ] Chat_history viewer — defer until the bystander-data question (other players' messages) is explicitly scoped
- [ ] Clans dashboard — defer until the bystander-data question (other players' clan data) is explicitly scoped
- [ ] i18n / Ukrainian translation — revisit only if real usage/demand signals appear; low risk to defer given the single-player-local-utility usage pattern
- [ ] Multi-export / multi-account storage — revisit only with a validated multi-account use case; re-architecting the data model speculatively is the wrong order of operations

### Permanently Out of Scope

- City-level IP geolocation — physically unshippable in a client-side-only bundle (tens-of-MB databases); this is an architectural ceiling, not a v1-timing decision
- Live polling of Wargaming's public API to enrich/refresh data — structurally incompatible with the zero-network-requests Core Value; would require renegotiating Core Value itself, not a normal v2 backlog item
- Cross-export historical diffing — PROJECT.md's "too much work relative to value" reasoning holds up: within-export timelines already capture most of the progression value; the live-tracker competitor category already solves cross-time progression better than a diffing feature here could

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Zero-network client-side processing | HIGH | HIGH | P1 |
| Auto-detected zip structure | HIGH | MEDIUM | P1 |
| Activity heatmaps (calendar, day×hour, duration) | HIGH | MEDIUM | P1 |
| Login-IP table + offline country geo map | HIGH | HIGH | P1 |
| Per-vehicle stats table (4 titles) | HIGH | MEDIUM | P1 |
| Financial timelines (premium + currency) | MEDIUM | MEDIUM | P1 |
| IndexedDB caching + hash-dedup | MEDIUM | MEDIUM | P1 |
| Missing/unsupported-category handling | MEDIUM | LOW | P1 |
| Mobile-responsive layout | MEDIUM | MEDIUM | P1 |
| CI zero-network guarantee | HIGH (trust signal) | LOW | P1 |
| Account identity header | MEDIUM | LOW | P2 (flagged gap) |
| Player_statistics table sort/filter | MEDIUM | LOW | P2 (flagged gap, likely implicit already) |
| Real-money spend summary | HIGH (genre-typical headline stat) | LOW-MEDIUM, unverified data shape | P2 (flagged gap) |
| Chat_history viewer | MEDIUM | HIGH (+ bystander-data scoping) | P3 |
| Clans dashboard | MEDIUM | MEDIUM (+ bystander-data scoping) | P3 |
| i18n | LOW (given audience) | MEDIUM | P3 |
| Multi-export storage | LOW (unvalidated demand) | HIGH (data-model rework) | P3 |
| Cross-export diffing | LOW (per PROJECT.md analysis) | HIGH | Not planned |
| Global percentile benchmarking | MEDIUM | HIGH (external dataset dependency) | Not planned |
| Live API enrichment | N/A — violates Core Value | N/A | Never |

**Priority key:**
- P1: Locked v1 (already decided)
- P2: Flagged gap — recommend an explicit decision before/around launch, not a silent omission
- P3: Reasoned v2 candidate
- Not planned / Never: anti-features, with reasoning above

## Competitor Feature Analysis

| Feature | Muletto (general GDPR viewer) | wot-life / WoTLabs / WoTStars (live WoT dashboards) | Our Approach |
|---------|-------------------------------|------------------------------------------------------|--------------|
| Data source | Any personal-data export (Meta, Apple, Google, Spotify, etc.) | Wargaming public API (live, polled repeatedly over time) | Wargaming GDPR export only (point-in-time, richer than the public API — includes login-IP, financial data the API doesn't expose) |
| Processing location | 100% client-side, CSP-enforced | Server-side (hosted service, not privacy-focused) | 100% client-side, CSP + CI-enforced |
| Per-vehicle stats | N/A (not gaming-specific) | Core feature, often with percentile coloring vs. server average | Core feature (locked v1), no percentile benchmarking (no reference dataset available in export) |
| Progression over time | Unified cross-service timeline | Core feature (repeated polling) | Within-export activity timeline only; no cross-export diffing (see anti-features) |
| Login/IP/location history | Maps GPS location history (not IP-derived) | Not available (not in public API) | Login-IP table + offline country geo map — a category neither comparable can offer, since it's GDPR-export-exclusive data |
| Chat/social content | Flagship "Conversation View" across platforms | N/A | Deferred to v2, pending bystander-data scoping |
| Multi-source/title breadth | Broad (many unrelated services) | Narrow (single WoT title per tool) | Narrow-but-complete (all 4 Wargaming titles, one export) |
| Trust signal | Marketing claim + CSP | N/A (not a claimed feature) | Marketing claim + CSP + automated CI check |

## Sources

- [Muletto — GDPR data export viewer](https://muletto.app/) — primary source, own product page, MEDIUM confidence (vendor-asserted claims, cross-checked structurally against TakeoutReader/Spotify tools which describe the same "processed locally" pattern)
- [TakeoutReader — Google Takeout parser](https://takeoutreader.com/) — MEDIUM confidence, general web search summary
- [Spotify Data Viewer (GitHub)](https://github.com/crm107-ua/spotify-data-viewer), [ListenStats](https://listenstats.com/), [stats.fm](https://thenextweb.com/news/a-simple-guide-to-visualising-your-spotify-listening-data-badass-ly) — MEDIUM confidence, general web search summary, consistent local-processing pattern across all three
- [WoT-Life.com](https://wot-life.com/), [WoTStars](https://www.wotstars.com/) — MEDIUM confidence, live WoT/Modern Armor stats dashboards, general web search summary; WoTLabs/NoobMeter referenced via search results and general domain knowledge of the WoT stats-tracker genre
- [Wargaming GDPR/Data Export official support article](https://wargaming.net/support/en/products/wot/article/10741/) — confirms the official "Data Export" tool exists in Account Management; did not surface a third-party GDPR-viewer specific to Wargaming, supporting the "no direct competitor" framing above
- `.planning/PROJECT.md` — primary grounding source for locked v1 scope, out-of-scope reasoning, and the real-export inspection notes (category list, format quirks) this document builds on

**Confidence caveat:** No tool was found that visualizes a *Wargaming* GDPR export specifically — this space is genuinely greenfield within its narrow niche. All comparisons here are cross-genre analogies (general personal-data-export viewers + live gaming-stats dashboards), which is why overall confidence is MEDIUM rather than HIGH. The two flagged candidate gaps (identity header, spend summary) are pattern-matched from the adjacent genres, not confirmed against an exact precedent — treat them as informed recommendations, not established facts.

---
*Feature research for: browser-only Wargaming GDPR export viewer*
*Researched: 2026-09-27*
