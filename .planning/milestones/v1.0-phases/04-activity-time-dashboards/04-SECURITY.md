---
phase: "04"
slug: "activity-time-dashboards"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-01"
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Untrusted zip -> worker aggregator | Session CSV cells (timestamps, server/platform names, IP) and entry names are attacker-controlled | Arbitrary text; the login IP column sits in the same row |
| Worker -> main thread | Only the aggregate view (numbers, split labels) crosses; raw rows and the IP column never do | Aggregates, fixed copy |
| Stored aggregate -> later query | Aggregate is trusted only when its version and dataset stamp match | `meta.playtime`, `PLAYTIME_VERSION` |
| Split/game label -> DOM | Server, platform and game-file-name text appears in a select, table and live region | Untrusted strings rendered as text |
| Second tab -> first tab | Another tab can empty the origin's store while this tab still shows the dataset | Cache state |
| Page -> network | Nothing leaves the machine after load | None allowed |
| CI config -> self-hosted runner | Workflow limits bound how long PR code holds the runner | Timeouts |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Information disclosure | Sessions IP column reaching meta, a message or the DOM | high | mitigate | Column resolver names only start/end/server/platform (`src/lib/worker/playtime.ts:323-326`); no IP identifier anywhere in `src/`; fixture-IP absence asserted in `tests/unit/playtime.test.ts`, `db.test.ts`, `ingest-worker.test.ts` | closed |
| T-04-02 | Tampering | Hostile timestamp string | medium | mitigate | Anchored regexes (`playtime.ts:117,133`), calendar validation via `daysInMonth`, invalid rows excluded and counted | closed |
| T-04-03 | Denial of service | Aggregation exception aborting import | medium | mitigate | try/catch in worker; query path reports error state (`ingest.worker.ts:154`) | closed |
| T-04-04 | Information disclosure | Console output with row contents | low | mitigate | Only fixed messages plus the Error object are logged (`ingest.worker.ts:154,179,208`) | closed |
| T-04-05 | Denial of service | `addHourOverlap` on corrupt year-9999 row | medium | mitigate | Bounded by closed-form span handling; year-9999 and 8,000-year spans unit tested | closed |
| T-04-06 | Information disclosure | Real data committed as fixtures | low | mitigate | Fixtures generated in memory with RFC 5737 `192.0.2.99`; `tests/fixtures/private/` gitignored | closed |
| T-04-07 | Tampering | Formatters carrying markup-like values | high | mitigate | Formatters return plain strings; `svelte/no-at-html-tags` and `svelte/no-inline-styles` are lint errors (`eslint.config.js:191-192`); zero `{@html` / `style=` in `src/`; `__proto__` literal tests in `tests/unit/playtime.test.ts` | closed |
| T-04-08 | Denial of service | Thousands of distinct active years from a crafted export | medium | accept | Nodes scale with active years, empty-year runs collapse; see Accepted Risks | closed |
| T-04-09 | Denial of service | Unbounded arrays from a hostile slice | low | mitigate | Model sizes are functions of active years, 168 cells, 12 bins; unit tested | closed |
| T-04-10 | Tampering | Split value `__proto__` / `constructor` | medium | mitigate | Values grouped in a Map and selected by index; prototype tests in `tests/unit/playtime.test.ts` | closed |
| T-04-11 | Tampering | Stale write-back onto a replaced dataset | medium | mitigate | `writePlaytimeIfCurrent` guard (`src/lib/worker/db.ts:317`), single read transaction | closed |
| T-04-12 | Denial of service | High value cardinality during column choice | low | mitigate | Counting stops past `MAX_SPLIT_VALUES` (50) | closed |
| T-04-13 | Tampering | Stale or duplicate reply applied to wrong request | medium | mitigate | Replies resolve only a live queryId; superseded on issue; importedAt checked | closed |
| T-04-14 | Denial of service | Permanent loading state after worker death | low | mitigate | onerror/onmessageerror/broken-worker probe resolve as error outcomes | closed |
| T-04-15 | Tampering | Markup or script injected via a split value | high | mitigate | Text interpolation only; `{@html` and inline styles are lint errors; none present in `src/` | closed |
| T-04-16 | Tampering | Stale or foreign response shown after replace/clear | medium | mitigate | `acceptOutcome` drops superseded, wrong-dataset and null answers; unit tested | closed |
| T-04-17 | Denial of service | Node/listener count growing with data | low | mitigate | 168 cells, 12 rows; delegated events; scale spec asserts node-count parity | closed |
| T-04-18 | Information disclosure | Tooltip/aria/data attribute carrying more than derived hours | medium | mitigate | Cell text built only from weekday/hour/seconds; IP-absence asserted in e2e | closed |
| T-04-19 | Denial of service | Per-cell listeners / O(n) lookups in calendar | low | mitigate | Delegated events, day-to-cell Map, roving tab stop | closed |
| T-04-20 | Information disclosure | Playwright traces retaining fixture data | low | accept | Synthetic fixtures only; see Accepted Risks | closed |
| T-04-21 | Information disclosure | Request, second worker or blocked attempt on the large-import path | high | mitigate | `tests/e2e/zero-network.spec.ts` and `playtime-scale.spec.ts` assert zero requests and one worker; CSP `connect-src 'none'` injected at build (`vite.config.ts:19`); network-API ban is a lint error; no `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` in `src/` | closed |
| T-04-22 | Denial of service | Aggregation time, stored size, DOM nodes scaling with sessions | medium | mitigate | Unit budgets and 5k vs 60k node-parity e2e spec | closed |
| T-04-23 | Information disclosure | Driver logs/screenshots from real-export runs | low | mitigate | Driver uses the synthetic export only; screenshots go outside the repo | closed |
| T-04-24 | Information disclosure | Error detail rendered instead of fixed copy | low | mitigate | Error branch renders fixed `PLAYTIME_ERROR` only | closed |
| T-04-25 | Denial of service | Nested CI timeouts outgrown by test growth | medium | mitigate | `tests/unit/ci-budget.test.ts` enforces margins; global 15 min, job 25 min | closed |
| T-04-26 | Elevation of privilege | Longer job limit widens runner hold time | low | accept | Permissions stay `contents: read` (`.github/workflows/ci.yml:21-22`); see Accepted Risks | closed |
| T-04-27 | Information disclosure | IP column present in every real session row | high | mitigate | Same as T-04-01; game comes from the file name; real-shape fixture test asserts the IP is ignored | closed |
| T-04-28 | Tampering | Day-first stamp read in the wrong order | medium | mitigate | Single strict `DD.MM.YYYY HH:MM` pattern (`playtime.ts:133`), range-checked; 13th/14th-day rows in the answer key | closed |
| T-04-29 | Denial of service | Hostile file names, long cells, huge file | medium | mitigate | Game token `[A-Za-z0-9_]{1,24}` anchored (`playtime.ts:210`); anchored stamp patterns; header-only column resolution | closed |
| T-04-30 | Tampering | Old aggregate served under new rules | medium | mitigate | `PLAYTIME_VERSION = 2` (`src/lib/playtime-shared.ts:58`) forces rebuild from stored rows | closed |
| T-04-31 | Spoofing | Sidecar/nested/xlsx name posing as a session file | low | mitigate | Only a bare Activity_history basename matches; `.xlsx`, nested paths, `__MACOSX` asserted to add no rows | closed |
| T-04-32 | Tampering | Game code from a hostile file name injected into the DOM | medium | mitigate | Token class cannot express markup; rendered as text; lint bans raw HTML | closed |
| T-04-33 | Information disclosure | IP reaching the page via the game split | high | mitigate | Aggregator reads no IP; `tests/e2e/playtime-real-shape.spec.ts:162,287` assert the fixture IP is absent from the page HTML, including with a game selected | closed |
| T-04-34 | Denial of service | Many distinct game tokens inflating the aggregate | low | mitigate | Cap of 50 distinct values applies to GAME; boundary unit tested | closed |
| T-04-35 | Repudiation | Page labelling a value as a game the export did not name | low | accept | Label is the file's own name, shown as written; see Accepted Risks | closed |
| T-04-36 | Information disclosure | Cache-cleared notice leaking ids or paths | low | mitigate | One fixed sentence in `ui-copy.ts` (`PLAYTIME_CACHE_CLEARED`); unit test bars digits, separators, brackets | closed |
| T-04-37 | Denial of service | Notice stranding the block on "Updating charts..." | medium | mitigate | Reconcile statements pinned byte-for-byte; WR-2 e2e green; notice is orthogonal to `data-state` | closed |
| T-04-38 | Spoofing | Notice naming "another tab" when eviction emptied the store | low | accept | Same remedy for every cause; see Accepted Risks | closed |
| T-04-39 | Tampering | Stale notice persisting over a new dataset | low | mitigate | Flag cleared in the dataset effect and on any applied answer; re-drop e2e | closed |
| T-04-SC | Tampering | Package installs | high | mitigate | No dependency change in phase 4: `pnpm-lock.yaml` has zero diff since 40ac5c2 and since 5d39ae0; `package.json` differs from 40ac5c2 only by the `scripts.check` line, which came from phase-1 commit 0764923 merged from `main`, not from a phase-4 plan | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-08 | Node count is 366 per active year and empty years collapse; a crafted file with thousands of active years only slows the user's own tab, never another user | Plan 04-05 (recorded) | 2026-10-01 |
| AR-04-02 | T-04-20 | All e2e fixtures are synthetic, using RFC 5737 `192.0.2.99`; real exports never enter e2e | Plan 04-11 (recorded) | 2026-10-01 |
| AR-04-03 | T-04-26 | The longer job limit does not change who can run PR code on the runner or its permissions | Plan 04-13 (recorded) | 2026-10-01 |
| AR-04-04 | T-04-35 | The label shows the export's own file-name token; nothing is mapped to a friendlier title | Plan 04-15 (recorded) | 2026-10-01 |
| AR-04-05 | T-04-38 | The notice's "another tab" wording may be inexact if storage eviction emptied the cache; the remedy is identical | Plan 04-16 (recorded) | 2026-10-01 |

---

## Security Audit 2026-10-01

| Metric | Count |
|--------|-------|
| Threats found | 40 |
| Closed | 40 |
| Open | 0 |

**Method and depth (ASVS L1, block_on `high`):** the register was built from the `<threat_model>` blocks of plans 04-01 to 04-16 (every plan carries one). Audited against HEAD `6ee66ae`-era code. The seven high-severity threats (T-04-01, T-04-07, T-04-15, T-04-21, T-04-27, T-04-33, T-04-SC) were checked directly by grep of `src/`, the lint configuration, the build's CSP source, the lockfile diff, and the named tests. The medium and low threats rest on the plan-declared tests, which passed in the latest run (884 unit, 120 Playwright), plus spot-checks of the code named above; they were not each re-derived independently.

**Not covered:** post-phase quick tasks 261001-2qr and 261001-36p (hover rings) add only SVG overlays with no data path and carry their own plan threat models; they were not audited here. No agent subagent was used; the orchestrating session performed this audit inline.
