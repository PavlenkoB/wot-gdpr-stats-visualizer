# Roadmap: WG Data Export Viewer

## Overview

This roadmap builds a browser-only viewer for Wargaming GDPR exports in horizontal layers, because every dashboard depends in the same way on a heavy shared foundation. First comes the **ingest pipeline**: one long-lived Web Worker that unzips the export, classifies its category folders, parses the CSVs defensively, and writes a single active dataset to IndexedDB. A zero-network CI guard runs from Phase 1 onward. Next is a single-page dashboard shell that shows every category honestly, whether present, missing, or unsupported. The feature dashboards come after that: activity heatmaps, vehicle stats and finances, and login-IP history with offline geolocation. The final phase makes everything usable at phone width and publishes it to GitHub Pages. The Core Value ("your data never leaves your machine") is checked on every push from Phase 1, not bolted on at the end.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Ingest Foundation & Zero-Network Guard** - Toolchain, typed worker contract, unzip + 3-way category detection, generic failure state, standing zero-network CI check + CSP
- [ ] **Phase 2: Defensive Parsing & Persistent Dataset** - Worker-less PapaParse, mojibake fix, Dexie schema, hash-dedup, replace-on-upload, "clear my cached data"
- [ ] **Phase 3: Dashboard Shell & Account Identity** - Runes app state, single-page layout, identity header, "detected but not yet supported" banners, empty/greyed sections
- [ ] **Phase 4: Activity Time Dashboards** - Totals, year-by-year calendar heatmap, day × hour heatmap, session-duration distribution at scale
- [ ] **Phase 5: Vehicle Stats & Financial Dashboards** - Per-vehicle stats across 4 titles, premium-time and currency timelines, per-currency real-money spend
- [ ] **Phase 6: Login-IP History & Offline Geolocation** - Geo build step, masked IP table, country-level world map, opt-in city-level lazy-load
- [ ] **Phase 7: Mobile Layout & Public Deploy** - Phone-width responsive layout, touch-friendly primitives, GitHub Pages deploy verified zero-network

## Phase Details

### Phase 1: Ingest Foundation & Zero-Network Guard
**Goal**: A user can drop an export zip onto the app and see it unzipped and its category folders classified entirely inside one long-lived Web Worker. CI already proves the app makes no network requests after load.
**Depends on**: Nothing (first phase)
**Requirements**: IMPORT-02, IMPORT-05, PLATFORM-02
**Success Criteria** (what must be TRUE):
  1. Dropping the real 2021 sample export shows the detected account root folder and sorts every category folder into supported, known-deferred, or unknown. A fixture with a renamed root folder and an extra, never-seen category folder is detected just as correctly, so no fixed layout or naming is assumed.
  2. Dropping a non-zip file, a corrupt archive, or a valid zip with no recognizable Wargaming structure shows one generic failure state, and the user can drop another file right away.
  3. The drop target is disabled while a file is processing. Every upload in a session goes through the same single Worker instance over the typed message contract, and the page stays responsive during unzip.
  4. CI runs lint, typecheck, Vitest, and Playwright on every push. A Playwright test loads the app, drops the sample export, and fails the build if any network request occurs after initial page load, including the worker script fetch. The served HTML includes a CSP meta tag as defense-in-depth.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Defensive Parsing & Persistent Dataset
**Goal**: The worker parses every supported CSV in the export defensively and stores the result in IndexedDB as a single active dataset. The dataset survives reloads, identical re-uploads are skipped, and the user can wipe it at any time.
**Depends on**: Phase 1
**Requirements**: IMPORT-01, IMPORT-03, IMPORT-04, IMPORT-06, DATA-01, DATA-02
**Success Criteria** (what must be TRUE):
  1. After importing the sample export and reloading the browser, per-category row counts are still available without re-uploading, and all unzip, parse, and write work ran in the worker. A synthetic export at least 10x the sample's size imports with progress advancing per category and the page never freezing.
  2. CSVs with CRLF or bare-CR-only line endings, missing columns, or unexpected extra columns import without errors. Double-UTF8 mojibake fields (e.g. Cyrillic clan text) come out as correct, readable text.
  3. Re-dropping the identical zip is reported as already loaded and skipped before any unzip or parse work starts. Dropping a different zip fully replaces the previous dataset, leaving no rows from the old export.
  4. A clearly visible "Clear my cached data" control deletes all cached export data. After clearing and reloading, the app is back in its empty upload state and IndexedDB holds no export rows.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Dashboard Shell & Account Identity
**Goal**: After an import, or on a return visit, the user lands on a single-page dashboard that shows whose account it is. Every category is represented honestly, whether it is present, missing, or not yet supported.
**Depends on**: Phase 2
**Requirements**: DATA-03, DATA-04, IDENTITY-01
**Success Criteria** (what must be TRUE):
  1. The dashboard opens with an identity header showing nickname, region, and account-created date from User_Info. The account email (`LOGIN`) appears nowhere in the rendered page, tooltips, or document title.
  2. Every detected category that has no dashboard, whether known-deferred (Chat_history, Clans) or never seen before, is listed with the same "detected but not yet supported" banner. None are hidden, silently dropped, or crash the app.
  3. A supported category missing from the export (e.g. no Financial_data) still shows its dashboard section, clearly empty or greyed out, rather than disappearing.
  4. The page reflects the processing, ready, duplicate, and error states driven by worker messages. A return visit with cached data opens straight to the dashboard without re-uploading.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Activity Time Dashboards
**Goal**: User can see how much and when they played: lifetime totals, a year-by-year calendar, a weekly rhythm, and typical session lengths. The charts hold up on a decade-long account.
**Depends on**: Phase 3
**Requirements**: ACTIVITY-01, ACTIVITY-02, ACTIVITY-03, ACTIVITY-04
**Success Criteria** (what must be TRUE):
  1. A summary shows total hours played, total sessions, and active days derived from Activity_history.
  2. A year-by-year calendar heatmap shows per-day activity. Its color scale keeps ordinary days distinguishable from each other despite outlier days, so it is not linear min-max.
  3. A day-of-week × hour-of-day heatmap shows when the user usually plays, with the timezone basis explicitly labeled.
  4. A session-duration distribution shows how long sessions typically last.
  5. With a synthetic fixture of 50k+ sessions spanning 10-15 years, every activity chart renders without freezing the tab. The rendered SVG node count scales with buckets (days, cells, bins), not with sessions.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Vehicle Stats & Financial Dashboards
**Goal**: User can review per-vehicle battle performance across all four Wargaming titles and see where their premium time, virtual currency, and real money went.
**Depends on**: Phase 3
**Requirements**: STATS-01, FINANCE-01, FINANCE-02, FINANCE-03
**Success Criteria** (what must be TRUE):
  1. Per-vehicle stats (battles, win rate, damage, and other available metrics) are shown for WoT, WoT Blitz, World of Warships, and World of Warplanes. A title absent from the export shows as empty instead of erroring, and a vehicle list in the thousands scrolls smoothly.
  2. A timeline shows premium-time operations over the account's history.
  3. A timeline shows virtual-currency flow, with income and spending over time.
  4. The real-money spend summary shows a separate total for each currency (e.g. USD, RUB, UAH), counting only PAID `Payment_history` orders. No blended or converted grand total appears anywhere. This is checked against a synthetic multi-currency fixture.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Login-IP History & Offline Geolocation
**Goal**: User can see where their account was accessed from through a masked login-IP history and a country-level world map, with optional city-level detail. Only offline geo data is used, never a live API.
**Depends on**: Phase 3 (the geo build step has no dependencies of its own and can be started earlier)
**Requirements**: ACTIVITY-05, ACTIVITY-06, ACTIVITY-07
**Success Criteria** (what must be TRUE):
  1. The login-IP history table masks every IP by default (e.g. last octet hidden), and a click-to-reveal toggle shows the full addresses. Copy actions, tooltips, and the page title all respect the current mask state.
  2. Each login IP is resolved to a country using the bundled DB-IP Lite range table from the geo build step. A world-map SVG shades countries by login count, and a DB-IP attribution line is visible. The zero-network Playwright check still passes.
  3. No city-level data is downloaded until the user explicitly chooses "load city-level detail". After opting in, a separate same-origin city dataset loads and logins show city-level locations. A Playwright check confirms the opt-in fetches only that same-origin asset.
  4. With a synthetic fixture of 10k+ login rows, the IP table stays smooth to scroll and sort, and the map stays responsive because it aggregates per country rather than drawing one marker per login.
**Plans**: TBD
**UI hint**: yes

### Phase 7: Mobile Layout & Public Deploy
**Goal**: The finished dashboard works on a phone and is publicly available on GitHub Pages. The zero-network guarantee is verified against the deployed build.
**Depends on**: Phase 4, Phase 5, Phase 6
**Requirements**: PLATFORM-01, PLATFORM-03
**Success Criteria** (what must be TRUE):
  1. At phone width (~375px), every section is readable and usable without horizontal page scrolling: identity header, heatmaps, tables, map, banners, and the clear-data control. Wide charts scroll inside their own container.
  2. Tabs, tooltips, and popovers work by touch as well as by mouse.
  3. Pushing to `main` runs the full CI suite. Only if it passes does the workflow deploy to GitHub Pages via `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4`, and the public URL serves the app.
  4. On the live GitHub Pages URL, which uses a project subpath, the worker script, the country geo table, and the opt-in city dataset all load without 404s. The CSP is present, and the zero-network check passes against the deployed build.
**Plans**: TBD
**UI hint**: yes

## Planning Notes

- **Terminology:** "ingest pipeline" means the runtime Web Worker (hash → unzip → classify → parse → write). "Geo build step" means the Node script that turns DB-IP Lite CSV into a binary range table. They are unrelated and must not be planned as stages of each other.
- **Standing checks:** the zero-network Playwright assertion and CSP from Phase 1 must stay green in every later phase. A phase that breaks them is not done.
- **Research flags:** Phase 4 needs work on SVG scale, a non-linear color scale, and the timezone basis. Phase 5 needs a synthetic multi-currency fixture and an explicit "no FX conversion" decision. Phase 6 needs work on geo lookup performance, per-country map aggregation, and how to host the ~60-70MB city dataset. Phases 1-3 and 7 follow standard patterns.
- **Independence:** Phases 4, 5, and 6 depend only on Phase 3 and can be built in any order.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ingest Foundation & Zero-Network Guard | 0/TBD | Not started | - |
| 2. Defensive Parsing & Persistent Dataset | 0/TBD | Not started | - |
| 3. Dashboard Shell & Account Identity | 0/TBD | Not started | - |
| 4. Activity Time Dashboards | 0/TBD | Not started | - |
| 5. Vehicle Stats & Financial Dashboards | 0/TBD | Not started | - |
| 6. Login-IP History & Offline Geolocation | 0/TBD | Not started | - |
| 7. Mobile Layout & Public Deploy | 0/TBD | Not started | - |
