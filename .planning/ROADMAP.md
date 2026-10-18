# Roadmap: WG Data Export Viewer

## Milestones

- ✅ **v1.0 MVP** — Phases 1-8 (shipped 2026-10-12; live GitHub Pages deploy deferred, see audit tech debt)
- 🚧 **v1.1 Multi-account & new data** — Phases 9-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-8) — SHIPPED 2026-10-12</summary>

- [x] Phase 1: Ingest Foundation & Zero-Network Guard — completed 2026-09-28
- [x] Phase 2: Defensive Parsing & Persistent Dataset — completed 2026-09-29
- [x] Phase 3: Dashboard Shell & Account Identity — completed 2026-09-29
- [x] Phase 4: Activity Time Dashboards — completed 2026-10-01
- [x] Phase 5: Vehicle Stats & Financial Dashboards — completed 2026-10-02
- [x] Phase 6: Login-IP History & Offline Geolocation — completed 2026-10-05
- [x] Phase 7: Mobile Layout & Public Deploy — completed 2026-10-09 (live deploy unobserved, owner override)
- [x] Phase 8: Master-detail UI redesign — completed 2026-10-09

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md). Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md).

</details>

### 🚧 v1.1 Multi-account & new data (In Progress)

**Milestone Goal:** Accept a real multi-account export (several account-ID folders from region migrations and extra accounts) and show it as one merged dashboard, then surface the data categories the app still ignores. Numbering continues from v1.0, so this milestone starts at Phase 9.

- [x] **Phase 9: Multi-account Import & Account Identity** - A zip with several account-ID folders imports, is cached as one dataset, and every account is listed in the identity header (completed 2026-10-18)
- [x] **Phase 10: Merged Dashboard Across Accounts** - Playtime, finance, vehicles and login history read as one combined history, with a game filter, no double-counting and a source account on every row (completed 2026-10-18)
- [ ] **Phase 11: New Game Data** - HEAT, WoT Console, World of Warplanes account and plane stats, and WoWS crews and storage, each through the fail-closed PII strip
- [ ] **Phase 12: Account Timeline & Perks** - Name, service, language/country history, bans, authorized third parties, subscriptions, coupons, bonus codes and surveys, with emails, IPs and codes masked

## Phase Details

### Phase 9: Multi-account Import & Account Identity

**Goal**: A user can drop a real export that contains several account-ID folders and see it imported, cached and identified account by account, instead of getting the generic failure banner.
**Depends on**: Phase 8 (the v1.0 master-detail shell)
**Requirements**: ACCOUNT-01, ACCOUNT-02, ACCOUNT-03, ACCOUNT-05, ACCOUNT-08
**Success Criteria** (what must be TRUE):
  1. Dropping the real three-account sample (an EU account with every category, an old RU account with no `User_Info`, an NA Blitz account), or a synthetic zip of the same shape, imports without the generic failure banner, and the identity header lists every account with its ID, the games it covers and its first-to-last activity years. The account with no `User_Info` still appears, identified by its ID.
  2. Each account folder is classified and parsed on its own: an account that lacks categories (no `User_Info`, no `Financial_data`, no Warplanes data) does not fail the import, and every existing pane opens on the multi-account dataset without an error. How the panes combine the accounts is Phase 10; this phase only guarantees nothing breaks and every stored row carries its account.
  3. After a reload the same accounts come back from the cache without re-uploading. Re-dropping the identical zip is reported as already loaded and skipped; dropping a different zip replaces every account with no rows left from the old one; "Clear my cached data" and "Start over" remove all accounts, leaving no export rows in IndexedDB.
  4. A single-account v1.0 export behaves exactly as before. Shapes that were rejected for safety still show the one generic failure banner: a non-zip, a corrupt archive, an account folder beside a stray unknown folder, an unknown wrapper that holds recognised categories. No account's email or birth date reaches storage or any rendered page, whichever root its `User_Info` sits under.
  5. Synthetic fixtures with one, two and three account roots exist, and the import, reload, replace and clear flows pass on all three. The zero-network assertion still passes through a multi-account import.

**Plans**: 11/11 plans complete

Plans:
**Wave 1**
- [x] 09-01-PLAN.md — Classify several account roots fail-closed, attribute every CSV to its root, add the synthetic multi-account fixtures
- [x] 09-07-PLAN.md — Gap closure CR-01: per-account grouping in `readRowsByFile` with per-account column resolution in the vehicles, finance and device-info aggregators, a divergent-header archive, and a corrected reader docstring
- [x] 09-08-PLAN.md — UI audit fixes: the caption's 4px block gap, the id-only account row demoted to the Label role, the repeated-key scan widened to every pane

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 09-02-PLAN.md — Import every root on its own: rows stamped with their account, identity per root, games and years, unsupported-category rows not stored
- [x] 09-09-PLAN.md — Worker cleanups: one normaliser for the account count (WR-01), a tolerant `toAccountSummary` (IN-01), a cast-free classifier (WR-03), an honest cost note (WR-02) and a CI comment that matches its workflow (IN-04)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 09-03-PLAN.md — Account-aware readers and the one-dataset lifecycle (rebuild equals import, reload, duplicate, replace, clear, abort, v1.0 cache)
- [x] 09-04-PLAN.md — Identity header for several accounts: copy, view model, stacked rows, phone rule
- [x] 09-10-PLAN.md — The account count decision (human checkpoint) and the one projection that makes the chosen answer true on the import and every replay

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 09-05-PLAN.md — Every pane opens on a multi-account dataset: combined caption, Overview and Account row, keyed-each fixes

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 09-06-PLAN.md — Browser lifecycle, zero-network and 375px proofs, CI budget reconciliation and the phase gate

**Wave 6** *(gap closure, blocked on Wave 5 completion)*
- [x] 09-11-PLAN.md — Gap closure Truth 21: the identity header, Account list row and Overview card follow the archive's ROOT count (`ClassifyResult.rootCount`, `hasMultipleRoots`) instead of the published account list, a singular '1 account' title, a browser step folded into the lifecycle test, and a dated UI-SPEC amendment on which roots each count describes

**UI hint**: yes

### Phase 10: Merged Dashboard Across Accounts

**Goal**: With several accounts loaded, the user reads their whole history as one: combined playtime, finance, vehicles and login history, filterable by game, without double-counting and without losing which account a row came from.
**Depends on**: Phase 9
**Requirements**: ACCOUNT-04, ACCOUNT-06, ACCOUNT-07, SCALE-01
**Success Criteria** (what must be TRUE):
  1. Playtime tiles and charts (total hours, sessions, active days, calendar heatmap, weekday-by-hour grid, session durations) cover all accounts together. Where sessions from two accounts overlap in time, the overlap is counted once, checkable against a hand-computed two-account fixture.
  2. A game filter on Playtime and Vehicles separates WoT, WoTB and WoWS; choosing one game shows only that game's sessions and vehicles across all accounts.
  3. Finance and Payments show combined totals per currency, never a blended or converted figure, and Vehicles combines the accounts' stats. Every listed row (vehicles, logins) shows or exposes which account it came from; aggregated Playtime buckets stay aggregates, and no new session table is added.
  4. Login-IP history lists the logins of all accounts in one table and one country map. IPs stay masked until the single global reveal, and city-level detail stays an explicit opt-in that fetches nothing until the user asks.
  5. A synthetic large three-account export, including a 54,000-row `Virtual_Currencies` file, imports and renders the merged panes without freezing the tab: node counts scale with buckets or visible windows, not with rows. The zero-network assertion holds through the merged flows.

**Plans**: 6/6 plans complete

Plans:
**Wave 1**
- [x] 10-01-PLAN.md — Per-game Playtime aggregates in the worker (PLAYTIME_VERSION 3, validated `game` on `playtime-query`) and the hand-computed two-account overlap fixture proved through the real worker

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-02-PLAN.md — The shared game filter: stamped shell cell, chip row on Playtime, empty-game state and About text, Vehicles Game select kept in sync

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 10-03-PLAN.md — Account tag chip (identity header legend, Vehicles rows), Vehicles combined summary and header, tag-aware search, nickname-as-text-only privacy assertion

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 10-04-PLAN.md — Merged Logins: accounts per address (LOGINS_VERSION 3), one chip per account on a row, 224px first column, masking and city opt-in unchanged

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 10-05-PLAN.md — Finance and Payments: per-currency sums across accounts proved exact, 'Per account' disclosure, combined note, caption reworded to "All N accounts combined"

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 10-06-PLAN.md — Large three-account fixture with a 54,000-row currency file, worker-level and browser-level scale proofs with zero network, and the three CI limits raised together to 31 / 33 / 41 min

**UI hint**: yes

### Phase 11: New Game Data

**Goal**: The user sees the games and records the dashboard used to ignore: HEAT, WoT Console, World of Warplanes account and plane stats, and WoWS crews and storage.
**Depends on**: Phase 10 (new categories are stored per account and merged from day one; the game filter is extended here)
**Requirements**: GAMES-01, GAMES-02, GAMES-03, GAMES-04, PRIV-01, PRIV-02
**Success Criteria** (what must be TRUE):
  1. HEAT and WoT Console (WOTC) sessions appear in Playtime and as choices in the game filter, and count toward the merged totals.
  2. A HEAT pane shows battle types, account stats, storage and geolocation. Geolocation addresses follow the existing IP masking: hidden until the global reveal.
  3. World of Warplanes (WOWP 19 and 20) account and plane statistics are shown alongside the per-vehicle table that v1.0 already ships, and a title absent from an account shows as empty instead of erroring.
  4. WoWS crews and account storage are shown, with each row traceable to its account.
  5. Every new category's files go through the same fail-closed PII strip as `LOGIN` and `BIRTH_DATE`, with a unit test per header, so a planted synthetic email from any new file appears in neither IndexedDB nor any rendered pane, and any IP address a new pane shows follows the existing masking. Folders that used to sit under "Not yet supported" now open their own pane and leave that footer. The zero-network assertion is extended to every new pane, and any table over a few thousand rows is windowed or aggregated.

**Plans**: TBD
**UI hint**: yes

### Phase 12: Account Timeline & Perks

**Goal**: The user can read the account's history and entitlements: what it was called, where it was linked, where it was registered, what was enforced against it, and what it received.
**Depends on**: Phase 10 (merged per-account storage); reuses the per-header PII-strip tests and masking patterns from Phase 11. No data dependency on Phase 11.
**Requirements**: TIMELINE-01, TIMELINE-02, PERKS-01, PERKS-02, PERKS-03
**Success Criteria** (what must be TRUE):
  1. An account timeline shows name history, external-services history and language/country history in date order, each entry tagged with its account. Email addresses are never shown in clear text and have no reveal path; IPs are masked until the single global reveal, as in Bans and Login history.
  2. Bans and Authorized_Third_Parties are shown, with IPs masked until the global reveal.
  3. Subscriptions and surveys are shown.
  4. Personal coupons and bonus-code usage are shown. Codes and the user IP are masked by default.
  5. The new panes honour the cross-cutting rules owned by earlier phases: planted synthetic emails never appear in clear text on any page, codes and IPs appear only masked until the single global reveal, the zero-network assertion covers each pane, and large tables are windowed or aggregated.

**Plans**: TBD
**UI hint**: yes

## Planning Notes

- **Phase ordering:** 9 → 10 → 11 → 12. Phases 11 and 12 depend on 10 and have no data dependency on each other; they run in numeric order so the PII-strip test pattern settles in Phase 11 first.
- **Cross-cutting requirements** are owned by one phase each (PRIV-01 and PRIV-02 by Phase 11, the first to add categories and panes; SCALE-01 by Phase 10, where the 54k-row `Virtual_Currencies` file first passes through merged code) but bind every later phase. Phase 11 and 12 carry a restating criterion, not a duplicate mapping.
- **Why 9 and 10 are split:** Phase 9 settles the data model (account provenance on every stored row, one cached dataset, lifecycle) and the identity header, which is observable on its own. Phase 10 changes how every pane reads that data. Phase 9 must not ship a pane that silently shows one account's data as if it were everything.
- **Dexie schema:** carrying an account key on stored rows probably touches the schema. v1.0 deliberately avoided version bumps with a clearing upgrader (Phase 6, 06-01) so returning users keep their cache; research should look for a lossless path before bumping.
- **Fail-closed classification:** `classify.ts` returns `ambiguous-root` today for several roots, and that rejection exists so a `User_Info` folder under an unknown parent cannot skip the LOGIN/BIRTH_DATE strip. Accepting N account roots must keep every v1.0 failure shape failing.
- **Open decision for discuss-phase 12 (PRIV-01 vs TIMELINE-01):** PRIV-01 says new categories go through the same fail-closed strip as `LOGIN`, which means the value is never stored. TIMELINE-01 says emails are "masked", which reads as stored and shown masked. Both cannot hold for an email in the name, service or language history files. Decide before planning Phase 12: strip emails at import (never stored, the timeline shows that an entry existed but not its address), or store them and render them masked with no reveal path. Until decided, the Phase 12 criteria are worded so either outcome passes: an email is never shown in clear text and cannot be revealed. The same question applies to bonus codes in PERKS-02, where the requirement says "masked by default", which does allow a reveal.
- **Unverified headers:** real column headers for HEAT, WOTC, name/service/language history, bans, third parties, subscriptions, coupons, bonus codes and surveys come from one sample export. Research must inspect that sample (or an updated one) before plan-phase commits to a schema. Tolerate drift, as in v1.0.
- **e2e budget:** the CI e2e limits are 30 / 32 / 40 min against a **262 of 262** spec ceiling after Phase 9, which measured **258 tests in 28 files** with `playwright test --list` (D-23's planning-time figure of 256 in 27 files, and the older figure this bullet carried, both predate the current suite; the count this phase actually started from is 257 in 28). Phase 9's two multi-account tests are priced as one block rather than at 5 s each, which is what forced the raise from 29 / 31 / 39. New specs must raise or reconcile the three limits together.
- **UI conventions:** new panes follow the Day 10 master-detail shell (`.claude/skills/sketch-findings-wot-gdpr-stats-visualizer/`): hand-rolled SVG and CSS grid, no new dependencies, one 480px phone block, 44px touch floor, selection as component state and never a route.

## Progress

**Execution Order:**
Phases execute in numeric order: 9 → 10 → 11 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 9. Multi-account Import & Account Identity | v1.1 | 11/11 | Complete    | 2026-10-18 |
| 10. Merged Dashboard Across Accounts | v1.1 | 6/6 | Complete    | 2026-10-18 |
| 11. New Game Data | v1.1 | 0/TBD | Not started | - |
| 12. Account Timeline & Perks | v1.1 | 0/TBD | Not started | - |
