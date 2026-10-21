# Requirements: WG Data Export Viewer

**Defined:** 2026-10-16
**Milestone:** v1.1 Multi-account & new data
**Core Value:** Your data never leaves your machine.

## v1.1 Requirements

### Multi-account

- [x] **ACCOUNT-01**: User can import a zip with several account-ID folders without the generic failure banner
- [x] **ACCOUNT-02**: Each account folder is classified and parsed independently; an account with missing categories (e.g. no `User_Info`) still imports
- [x] **ACCOUNT-03**: One cached dataset holds all accounts, with replace-on-new-upload and hash-dedupe behaving as before
- [x] **ACCOUNT-04**: The dashboard shows all accounts merged: combined playtime and activity, combined finance totals (per currency, never blended), combined vehicle stats
- [x] **ACCOUNT-05**: The identity header lists every account with its ID, the games it covers, and its first-to-last activity years
- [x] **ACCOUNT-06**: A game filter on merged playtime and vehicles separates WoT, WoTB and WoWS; overlapping sessions across accounts are not double-counted, and each row stays traceable to its account
- [x] **ACCOUNT-07**: Login-IP history merges across accounts, with masking and the city opt-in unchanged
- [x] **ACCOUNT-08**: Clear and Start Over wipe all accounts; fixtures and tests cover 1, 2 and 3 account roots

### New games

- [x] **GAMES-01**: HEAT sessions, battle types, account stats, storage and geolocation are shown
- [x] **GAMES-02**: WoT Console (WOTC) sessions are shown in activity
- [x] **GAMES-03**: World of Warplanes (WOWP 19 and 20) account and plane stats are shown
- [x] **GAMES-04**: WoWS crews and account storage are shown

### Account timeline

- [x] **TIMELINE-01**: Name history, external-services history and language/country history are shown as an account timeline; emails and IPs are masked
- [x] **TIMELINE-02**: Bans and Authorized_Third_Parties are shown; IPs stay masked

### Perks

- [x] **PERKS-01**: Subscriptions are shown
- [x] **PERKS-02**: Personal coupons and bonus-code usage are shown; codes and user IP are masked by default
- [x] **PERKS-03**: Surveys are shown

### Cross-cutting

- [x] **PRIV-01**: Every new category goes through the same fail-closed PII strip as `LOGIN` and `BIRTH_DATE`, with unit tests per header
- [x] **PRIV-02**: Zero network requests after load still holds; the Playwright guard is extended to the new panes
- [x] **SCALE-01**: All new panes aggregate or virtualize; the 54k-row Virtual_Currencies file is checked against a synthetic large export

## Future Requirements

- Chat_History and Game_Forums viewer (masked by default)
- Comparing two exports taken months apart
- Per-account picker view (merge-only chosen for v1.1)
- Multiple stored exports

## Out of Scope

| Feature | Reason |
|---------|--------|
| Account picker | Merge-only chosen for v1.1 |
| Chat/forum viewer | Deferred; sensitive, masked-by-default design needed |
| FX conversion across currencies | Needs live or hardcoded rates; still rejected |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACCOUNT-01 | Phase 9 | Complete |
| ACCOUNT-02 | Phase 9 | Complete |
| ACCOUNT-03 | Phase 9 | Complete |
| ACCOUNT-04 | Phase 10 | Complete |
| ACCOUNT-05 | Phase 9 | Complete |
| ACCOUNT-06 | Phase 10 | Complete |
| ACCOUNT-07 | Phase 10 | Complete |
| ACCOUNT-08 | Phase 9 | Complete |
| GAMES-01 | Phase 11 | Complete |
| GAMES-02 | Phase 11 | Complete |
| GAMES-03 | Phase 11 | Complete |
| GAMES-04 | Phase 11 | Complete |
| TIMELINE-01 | Phase 12 | Complete |
| TIMELINE-02 | Phase 12 | Complete |
| PERKS-01 | Phase 12 | Complete |
| PERKS-02 | Phase 12 | Complete |
| PERKS-03 | Phase 12 | Complete |
| PRIV-01 | Phase 11 | Complete |
| PRIV-02 | Phase 11 | Complete |
| SCALE-01 | Phase 10 | Complete |

**Coverage:** 20/20 v1.1 requirements mapped, no orphans, no duplicates.

PRIV-01, PRIV-02 and SCALE-01 are cross-cutting: each is owned by the phase that first needs it (see ROADMAP.md Planning Notes) and binds every later phase.

---
*Requirements defined: 2026-10-16*
