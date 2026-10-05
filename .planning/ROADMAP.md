# Roadmap: WG Data Export Viewer

## Overview

This roadmap builds a browser-only viewer for Wargaming GDPR exports in horizontal layers, because every dashboard depends in the same way on a heavy shared foundation. First comes the **ingest pipeline**: one long-lived Web Worker that unzips the export, classifies its category folders, parses the CSVs defensively, and writes a single active dataset to IndexedDB. A zero-network CI guard runs from Phase 1 onward. Next is a single-page dashboard shell that shows every category honestly, whether present, missing, or unsupported. The feature dashboards come after that: activity heatmaps, vehicle stats and finances, and login-IP history with offline geolocation. The final phase makes everything usable at phone width and publishes it to GitHub Pages. The Core Value ("your data never leaves your machine") is checked on every push from Phase 1, not bolted on at the end.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Ingest Foundation & Zero-Network Guard** - Toolchain, typed worker contract, unzip + 3-way category detection, generic failure state, standing zero-network CI check + CSP (completed 2026-09-28)
- [x] **Phase 2: Defensive Parsing & Persistent Dataset** - Worker-less PapaParse, mojibake fix, Dexie schema, hash-dedup, replace-on-upload, "clear my cached data" (completed 2026-09-29)
- [x] **Phase 3: Dashboard Shell & Account Identity** - Runes app state, single-page layout, identity header, "detected but not yet supported" banners, empty/greyed sections (completed 2026-09-29)
- [x] **Phase 4: Activity Time Dashboards** - Totals, year-by-year calendar heatmap, day × hour heatmap, session-duration distribution at scale (completed 2026-10-01)
- [x] **Phase 5: Vehicle Stats & Financial Dashboards** - Per-vehicle stats across 4 titles, premium-time and currency timelines, per-currency real-money spend (completed 2026-10-02)
- [x] **Phase 6: Login-IP History & Offline Geolocation** - Geo build step, masked IP table, country-level world map, opt-in city-level lazy-load (completed 2026-10-05)
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

**Plans:** 10/10 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Wave-0 gate (package legitimacy, fixture PII policy) + tracer: plain Vite/Svelte scaffold, build-time CSP, typed worker contract, eager worker, path-only classify, zero-network e2e

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Standing guard: ESLint/Prettier/Vitest wiring, fail-first source-level network ban + XSS/CSP lint guards, SHA-pinned GitHub Actions CI on every push

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Classification hardening (renamed root, unknown folders, macOS/backslash quirks, reasoned rejection) + synthetic fixture matrix + A2/no-inflation unit locks

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Failure-path slice: hand-rolled dropzone (drag + click), main-thread pre-check, multi-file rejection, worker-crash handling, inline generic banner + import-failure e2e

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-05-PLAN.md — Success-path slice: stage spinner + 400 ms floor, account heading/summary/color badges, start over + import-flow e2e (session zero-network, single worker, responsiveness) + real-sample check

**Gap closure** *(UAT G-01-20, filed after Phase 1 UAT)*

- [x] 01-06-PLAN.md — Depth-tolerant classify: wrapper folder and rootless re-zip exports classify same as a normal single-root export

**Gap closure (advisory findings)** *(replanned under `--force --gaps` after Phase 1 verified `passed`; 12 advisory findings from 01-VERIFICATION.md)*

- [x] 01-07-PLAN.md — Correctness: CR-01 wrapper-around-categories misclassification + WR-06 rootless-fallback reachability + WR-03 empty-root footgun (Wave 1)
- [x] 01-08-PLAN.md — Worker robustness: WR-01 mark worker broken on idle `onerror` so a later submit does not hang on the busy floor (Wave 2)
- [x] 01-09-PLAN.md — Build/CI hygiene: WR-02 fold `unescapeQuotes` into `cspMeta` + WR-04 `tsc -b` + IN-01 `verbatimModuleSyntax` + IN-02 drop `checkJs` + IN-05 annotate `svelte.config.js` (Wave 2, parallel with 01-08)
- [x] 01-10-PLAN.md — Docs: IN-03 document the driver `--no-sandbox` flag + IN-04 README note that the zero-network assertion covers build/preview, not dev (Wave 3)

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

**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Package gate + tracer: hash-dedup, defensive CSV parse of every category, mojibake fix, chunked Dexie write

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Return-visit auto-load, skip-count display, mojibake/10x-scale validation

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Destructive-action UX: shared ConfirmPanel, replace-on-drop, destructive Start Over, Clear my cached data

**Gap closure** *(verifier G-02-20, filed after Wave 3)*

- [x] 02-04-PLAN.md — Replace-on-drop render sites: co-render `<Dropzone>` in `'done'`/`'duplicate'` branches, keep `<ResultsView>` mounted during replace-confirm

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

**Plans:** 7/7 plans complete
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Tracer + worker privacy core: strip LOGIN/BIRTH_DATE at write time, three-field identity in meta, Dexie v2 wipe of Phase 2 caches, Phase 3 fixtures
- [x] 03-02-PLAN.md — Pure section/unsupported/nav status, scroll-spy rule and all new UI copy with unit tests
- [x] 03-03-PLAN.md — IngestClient keeps the displayed dataset through replace and failure, widened replace guard, cache-check error recovery

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-04-PLAN.md — Identity header, shared section shell, Not yet supported banners, results view retired, leak spec

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-05-PLAN.md — Sticky anchor nav with scroll-spy, muted status-bearing links, 375px and long-text coverage
- [x] 03-06-PLAN.md — Import bar with notice slot, compact dropzone, confirm-panel focus management, app-state matrix e2e

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-07-PLAN.md — Rewrite Phase 1/2 e2e specs for the dashboard, retire summary/heading copy, update the run skill, full phase gate

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

**Plans:** 18/18 plans executed
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Tracer: Sessions.csv through the worker aggregate, Dexie meta, playtime-query and PlaytimeClient

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Status flip, minimal Playtime block, Phase 3 test migration
- [x] 04-03-PLAN.md — Aggregation core, seeded large fixtures and independent oracle
- [x] 04-05-PLAN.md — Pure chart models: rank scale, calendar, hour grid, bins, keyboard, tooltip clamp
- [x] 04-07-PLAN.md — Request seam hardening (stale ids, unavailable worker)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-04-PLAN.md — Copy, formatHours and the teal data ramp with contrast tests
- [x] 04-06-PLAN.md — Split column rule, per-value slices, lazy backfill

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-08-PLAN.md — Full Playtime block: states, selector, tiles, split table, Login history heading

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04-09-PLAN.md — Weekday x hour grid, duration list, shared tooltip and legend

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 04-10-PLAN.md — Year-by-year calendar heatmap

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 04-11-PLAN.md — Browser specs on a hand-checkable fixture
- [x] 04-12-PLAN.md — Scale proof at 5k and 60k sessions, driver update, real-export check

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 04-13-PLAN.md — CI time budget for the new browser tests

**Wave 9** *(gap closure — UAT G-04-1, G-04-5)*

- [x] 04-14-PLAN.md — Real export shape: per-game session files, `STARTED_AT;FINISHED_AT;IP`, `DD.MM.YYYY HH:MM`, and the backfill repair
- [x] 04-15-PLAN.md — Per-game split selector on top of the file-level game token
- [x] 04-16-PLAN.md — Cache-cleared feedback (G-04-5)

**UI-review gap closure** *(UAT gaps G-04-UI-1 to G-04-UI-3, filed after the Phase 4 UI audit)*

- [x] 04-17-PLAN.md — G-04-UI-1, G-04-UI-3 (head clause): calendar weekday labels fit a 40px gutter (grid 634px, still inside 640px), and a key move into a cell under the sticky nav or year head scrolls the page up instead of down (Wave 1)
- [x] 04-18-PLAN.md — G-04-UI-2, G-04-UI-3 (legend clause): hours tile never breaks inside its numeral or unit at 375px, legend note on its own line 8px under the swatch row, UI-SPEC amendments A-1 to A-4 (Wave 2, after 04-17)

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

**Plans:** 19/22 plans complete
Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Real-header Financial_data and Orders fixtures, hand-derived keys, independent money oracle, seeded 10k/50k/20-year generators
- [x] 05-02-PLAN.md — Real-named Player_statistics fixtures for four titles, NAME canary, vehicle oracle, 5,000-vehicle generator
- [x] 05-03-PLAN.md — Financial_data supported, replay re-classification of old caches, five sections and six nav links, Financial_data in the shared sample

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-04-PLAN.md — Pure premium, currency and spend builders over exact BigInt decimals
- [x] 05-05-PLAN.md — Pure vehicle view builder: column maps, special values, battle types, Warships and Warplanes cases
- [x] 05-06-PLAN.md — Real-shaped shared sample, derived count constants, real-named scale templates

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-07-PLAN.md — Channel-scoped QueryClient, data-query contract, one-snapshot row reader, per-file presence, worker handler and memo
- [x] 05-08-PLAN.md — Viewer-locale numbers pinned to en-US in tests, UI-SPEC amendments, flow colours, the full Phase 5 copy inventory

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 05-09-PLAN.md — Pure bar-chart and vehicle-table models, six-link nav that keeps its current link visible
- [x] 05-10-PLAN.md — Financial_data card live: Premium block, generalised excluded notice, unrecognised-strings list

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 05-11-PLAN.md — Premium monthly bar chart, extended tooltip, collapsible monthly data table
- [x] 05-12-PLAN.md — Player_statistics card live: title switcher, windowed sortable searchable vehicle table

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 05-13-PLAN.md — Virtual currency block: small-multiple diverging charts, other-currency rows, 240-month proof
- [x] 05-14-PLAN.md — Battle-type filter and summary, per-title header, Warships and Warplanes views, column picker
- [x] 05-15-PLAN.md — Payment_history card live: per-currency spend cards, gifts, breakdowns, no blended total

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 05-16-PLAN.md — 50,000-operation scale proof, zero-network through every Phase 5 flow, CI e2e budget, validation map

**Gap closure** *(UAT gaps G-05-3, G-05-4 and G-05-7, filed after the Phase 5 real-export UAT)*

- [x] 05-17-PLAN.md — G-05-4: income counts as up in the currency totals (D-18), income-only fixture, oracle and answer-key corrections, browser and scale guards (Wave 1)
- [x] 05-19-PLAN.md — G-05-7: identity header relabels the REGION value as a location code instead of a realm; Phase 3 copy contract amended (Wave 1)
- [x] 05-18-PLAN.md — G-05-3: premium chart buckets by CURR_PREMIUM (the real operation datetime) with a per-file CREATED fallback, real-shaped fixtures and oracle, D-19 amended (Wave 2, after 05-17)

**UI-review gap closure** *(UAT gaps G-05-8, G-05-9 and G-05-10, filed after the Phase 5 UI audit)*

- [x] 05-20-PLAN.md — G-05-8, G-05-10: Vehicle statistics controls render as a row, every text size at the 14px floor with a source and live guard, battle-type table contained and focusable at 375px (Wave 1)
- [x] 05-21-PLAN.md — G-05-9 (colour and empty-axis clauses): chart zero line and hairlines match the Color table, currency plot split on one shared scale with exact end labels, UI-SPEC amendments appendix; G-05-9 stays partial until 05-22 (Wave 1)
- [x] 05-22-PLAN.md — G-05-9 (width clause, user chose a finer integer pitch): whole-pixel bar pitch 4 to 16 that fills the 576px plot, 24-month label stride below pitch 8, UI-SPEC amendment; closes G-05-9 in full (Wave 2, after 05-21)

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

**Plans:** 17/17 plans complete
Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Worker tracer: the `logins` channel from session rows to a stored, versioned aggregate (Dexie schema decision recorded), lazy backfill
- [x] 06-02-PLAN.md — Full Phase 6 copy inventory and formatters in `ui-copy.ts`; Cancel label and cancel-presentation decisions recorded

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-03-PLAN.md — Full IP module (IPv6, canonical key, mask) and aggregation semantics with the listed-address cap decision, 10k fixture and independent oracle

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-04-PLAN.md — Country range-table container, build script, fixture table and the committed production table (geo source decision recorded)
- [x] 06-05-PLAN.md — Logins.csv merge, Account record and the one-snapshot backfill reader

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 06-06-PLAN.md — Country resolution in the worker: inlined table, fixture seam (decision recorded), guarded country names, worker-only import lint
- [x] 06-07-PLAN.md — World-map generator and committed per-country SVG path module (build-time packages only)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 06-08-PLAN.md — Login history block: states, one reveal control, six summary tiles, live region, flipped e2e expectations
- [x] 06-09-PLAN.md — City dataset build script and worker-side decode; fetch-location decision recorded

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 06-10-PLAN.md — Masked windowed IP table: hoisted windowing, sorting, pinned Account record row, excluded pill and notes
- [x] 06-11-PLAN.md — The one sanctioned city fetch: main-thread module, scoped lint exemption, CSP connect-src self, build-time manifest

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 06-12-PLAN.md — Country map: log-scale shading, tooltip, one-stop keyboard model, legend, DB-IP attribution, ranked country list

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 06-13-PLAN.md — City-level opt-in: size-warned button, progress and cancel, City column, ranked city list, nothing persisted

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 06-14-PLAN.md — 10,000-row scale proof, zero-network across all flows, CI budget reconciliation, phase guards, real-build smoke, Phase 7 hand-offs

**Gap closure** *(verifier gaps G-1 (SC2) and G-2 (SC3) plus review finding WR-05, filed after the Phase 6 verification)*

- [x] 06-15-PLAN.md — G-1 (CR-01): IPv6 dotted-tail words counted after expansion, a quad before the compression refused, a worker-level tracer, a seeded word-count property, and a LOGINS_VERSION bump so stored aggregates are rebuilt (Wave 1)
- [x] 06-16-PLAN.md — WR-05: LoginsView import and the two Phase 5 svelte-check errors fixed, svelte-check added to `check` and to CI's typecheck step behind a self-tested guard (Wave 1)
- [x] 06-17-PLAN.md — G-2 (CR-02): an IPv4-mapped address needs the IPv4 city plane (families rule relocated and unit-tested), review ledger closed for CR-01, CR-02 and WR-05 (Wave 2, after 06-15 and 06-16)

**UI hint**: yes

### Phase 7: Mobile Layout & Public Deploy

**Goal**: The finished dashboard works on a phone and is publicly available on GitHub Pages. The zero-network guarantee is verified against the deployed build.
**Depends on**: Phase 4, Phase 5, Phase 6
**Requirements**: PLATFORM-01, PLATFORM-03
**Success Criteria** (what must be TRUE):

  1. At phone width (~375px), every section is readable and usable without horizontal page scrolling: identity header, heatmaps, tables, map, banners, and the clear-data control. Wide charts scroll inside their own container.
  2. Tabs, tooltips, and popovers work by touch as well as by mouse.
  3. Pushing to `main` runs the full CI suite. Only if it passes does the workflow deploy to GitHub Pages via `actions/upload-pages-artifact@v4` + `actions/deploy-pages@v4`, and the public URL serves the app.
  4. On the live GitHub Pages URL, which uses a project subpath, the worker script and the opt-in city dataset both load without 404s. The country geo table is **inlined into the worker chunk, so it makes no request and there is nothing to 404 for** (amended by plan 06-06: RESEARCH Decision 5's inline delivery supersedes the original "the country geo table … load without 404s" wording; its correctness under a subpath is proved by the worker chunk itself being served and the zero-network check passing against the deployed build). The CSP is present, and the zero-network check passes against the deployed build.

**Plans**: TBD
**UI hint**: yes

## Planning Notes

- **Terminology:** "ingest pipeline" means the runtime Web Worker (hash → unzip → classify → parse → write). "Geo build step" means the Node script that turns DB-IP Lite CSV into a binary range table. They are unrelated and must not be planned as stages of each other.
- **Standing checks:** the zero-network Playwright assertion and CSP from Phase 1 must stay green in every later phase. A phase that breaks them is not done.
- **Research flags:** Phase 4 needs work on SVG scale, a non-linear color scale, and the timezone basis. Phase 5 needs a synthetic multi-currency fixture and an explicit "no FX conversion" decision. Phase 6 needs work on geo lookup performance, per-country map aggregation, and how to host the ~60-70MB city dataset. Phases 1-3 and 7 follow standard patterns.
- **Independence:** Phases 4, 5, and 6 depend only on Phase 3 and can be built in any order.
- **Phase 6 hand-offs to Phase 7 (06-14):** (a) the country table is inlined in the worker chunk, so there is no country asset to request or to 404 on the Pages subpath; Phase 7 success criterion 4 already says so (amended in 06-06), and its worker-chunk and zero-network checks are the proof. (b) Real city generation (`pnpm run geo:city -- --download`) runs in Phase 7's deploy job, not in git: cache the output keyed on the DB-IP month, assert the manifest's `source` is `dbip` (the fixture manifest says otherwise), and verify that `geo-city-data/<file>` is served on the project subpath with the recorded byte count and sha256. (c) `connect-src 'self'` may be narrowed to a path-restricted host source once the deployed origin is known; it stays defence in depth only, because a meta CSP does not govern a worker and the enforcement is the ESLint network ban plus the Playwright request counting. (d) Peak worker memory while decoding the city file (50,130,477 B raw as measured in 06-09, 11,877,710 B gzipped; about 120 MB at peak by the 06-RESEARCH Pitfall 21 estimate, which was made against a 42.8 MB container) should be re-checked on a phone-class device (06-RESEARCH A11 and A13), which no Phase 6 test can measure.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ingest Foundation & Zero-Network Guard | 6/6 | Complete    | 2026-09-28 |
| 2. Defensive Parsing & Persistent Dataset | 4/4 | Complete    | 2026-09-29 |
| 3. Dashboard Shell & Account Identity | 7/7 | Complete    | 2026-09-29 |
| 4. Activity Time Dashboards | 18/18 | In Progress|  |
| 5. Vehicle Stats & Financial Dashboards | 19/19 | Complete    | 2026-10-02 |
| 6. Login-IP History & Offline Geolocation | 17/17 | Complete    | 2026-10-05 |
| 7. Mobile Layout & Public Deploy | 0/TBD | Not started | - |
