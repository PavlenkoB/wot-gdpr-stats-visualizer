---
phase: "10"
slug: merged-dashboard-across-accounts
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-18"
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Chip UI to worker | Game filter token sent via `playtime-query` postMessage | Validated game token (`^[A-Z0-9_]{1,24}$`) |
| Worker to stored aggregates | Per-game, per-account scopes in `meta` | Session counts and durations; no IPs |
| Merged panes to DOM | Account tags, login rows, spend splits | Nicknames and roots (text only, never attributes), masked IPs |
| Page to network | Zero requests after load; only the opt-in same-origin city file | None allowed beyond `city-fetch.ts` |
| Repo to CI | Scale fixtures and CI time budget | Synthetic RFC 5737 addresses only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Tampering | `handlePlaytimeQuery` game param | medium | mitigate | Anchored `GAME_TOKEN_RE`, `isGameToken` in worker; unit tests with hostile values | closed |
| T-10-02 | Information disclosure | per-game scopes in `meta.playtime` | low | mitigate | Aggregate reads four columns, never the IP column; test asserts no IP in stored JSON | closed |
| T-10-03 | Denial of service | unbounded `byGame` growth | medium | mitigate | `MAX_SPLIT_VALUES = 50` slice before scopes are built | closed |
| T-10-04 | Information disclosure | filter state persisted or in URL | medium | mitigate | `$state` + `$derived` only; shell guard bans storage/hash/history/html; reload e2e | closed |
| T-10-05 | Tampering | chip labels from untrusted tokens | low | mitigate | Chips come from the fixed `GAME_FILTER_TOKENS` list, rendered as text | closed |
| T-10-06 | Tampering | stale filter on another dataset | low | mitigate | `resolveGameFilter` checks the import stamp | closed |
| T-10-07 | Information disclosure | network request from chip path | medium | mitigate | Worker postMessage only; ESLint network ban; zero-request e2e | closed |
| T-10-08 | Information disclosure | nickname or ID in an attribute | high | mitigate | `AccountTag` text-only; `expectNicknameTextOnly` scans every attribute | closed |
| T-10-09 | Tampering | root-keyed lookups | medium | mitigate | `Map`/`Set`, not plain objects; `__proto__` and `constructor` tests | closed |
| T-10-10 | Tampering | cross-account row attribution | medium | mitigate | `mapRow` takes the owning group's root; same-vehicle-id test | closed |
| T-10-11 | Information disclosure | header showing one account's expiry as combined | medium | mitigate | Expiry shown only with one contributor; battles summed | closed |
| T-10-12 | Information disclosure | IP masking regression beside chips | high | mitigate | `loginCells`/`displayIp` untouched; masked-cell unit and e2e tests | closed |
| T-10-13 | Information disclosure | network request from merged Logins | high | mitigate | No new fetch code; request-listener e2e; scale spec baseline | closed |
| T-10-14 | Tampering | wrong account after v2 cache | medium | mitigate | `LOGINS_VERSION = 3` forces rebuild; missing account contributes none | closed |
| T-10-15 | Denial of service | many accounts inflating a cell | low | mitigate | `LOGIN_CHIPS_VISIBLE = 3` plus `+N`; `MAX_ACCOUNT_ROOTS = 32` | closed |
| T-10-16 | Tampering | blended totals across currencies | high | mitigate | Cards keyed by currency as written; no cross-currency field; oracle tests | closed |
| T-10-17 | Information disclosure | nickname or ID in Payments disclosure | high | mitigate | `AccountTag` text only; e2e attribute scan on the split | closed |
| T-10-18 | Tampering | inexact per-account sums | medium | mitigate | `bigint` accumulation, unit strings; float-failure control test | closed |
| T-10-19 | Information disclosure | real export committed as fixture | high | mitigate | In-memory synthetic builder, RFC 5737 addresses, `/*.zip` ignored | closed |
| T-10-20 | Denial of service | tab freeze at 54,000 rows | high | mitigate | Worker pipeline; ready budget, long-task and node-count assertions | closed |
| T-10-21 | Information disclosure | request from merged flow at scale | high | mitigate | Request/worker recorders from first navigation; zero requests, one same-origin worker, no CSP violations | closed |
| T-10-22 | Tampering | weakening the CI budget guard | medium | mitigate | Limits move together (31/33/41 min); older pins unchanged; guard test | closed |
| T-10-SC (10-01 to 10-06) | Tampering | npm/pip/cargo installs | high | mitigate | No manifest or lockfile change in phase 10 (six per-plan rows) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-18 | 28 | 28 | 0 | gsd-security-auditor |

Note (informational, not a gap): the Phase 8 shell guard's banned-API file list does not name `GameFilter.svelte` or `game-filter-state.ts`; a grep confirms neither uses a storage, history, hash or `{@html}` sink. Adding them to the guard list would harden T-10-04.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-18
