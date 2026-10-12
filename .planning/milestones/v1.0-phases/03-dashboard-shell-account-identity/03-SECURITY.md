---
phase: "03"
slug: "dashboard-shell-account-identity"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-29"
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Untrusted zip -> worker | A user-supplied Wargaming export; headers, cell values and entry names are all attacker-controlled | Arbitrary CSV rows, folder names, malformed markup |
| Worker -> IndexedDB | The only durable write path for parsed data | Sanitised rows plus the three-field identity |
| IndexedDB -> main thread | Read back through the worker; `ClassifyResult` crosses the boundary, rows do not | Classification and counters only |
| Main thread -> DOM | Svelte renders every value as text | Identity, section summaries, folder names, banner copy |
| Test fixtures -> repo | Synthetic exports used by unit and e2e suites | `.invalid` and RFC 5737 data only, never real export data |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation (verified) | Status |
|-----------|----------|-----------|----------|-------------|------------------------|--------|
| T-03-01 | Information disclosure | User_Info rows persisted to IndexedDB | high | mitigate | `identity.ts:48` normalised `LOGIN|BIRTH_DATE|BIRTH_DATE_SRC(_\d+)?`; `__parsed_extra` dropped; single choke point `ingest.worker.ts:199-205`. One `bulkPut` (`db.ts:132`), one `writeDataset` caller, one Dexie connection. Proven non-vacuous by mutation. | closed |
| T-03-02 | Information disclosure | Phase 2 v1 caches already holding the email at rest | high | mitigate | `db.ts:90-98` `version(2).upgrade` clears rows and meta, both awaited; DB name unchanged (`db.ts:61`). `db.test.ts:276` seeds a real v1 store holding a `LOGIN` row and asserts it is gone. | closed |
| T-03-03 | Information disclosure | A renamed sensitive column (for example EMAIL) or PII in other categories | medium | accept | Accepted - a deny-list cannot see a renamed column; D-18 locked it. Residual risk documented at `03-RESEARCH.md:714` and `identity.ts:32-36`. | closed |
| T-03-04 | Tampering | Prototype pollution through a `__proto__` header key | low | mitigate | `identity.ts:93-96` `Object.fromEntries` rebuild; test `identity.test.ts:110` proves `__proto__` stays an own data property. | closed |
| T-03-05 | Information disclosure | Identity object carrying more than nickname, region, created date | medium | mitigate | `identity.ts:142-146` returns exactly `{nickname, region, createdAt}` from sanitised rows; key-set assertion `ingest-worker.test.ts:366-370`. | closed |
| T-03-06 | Information disclosure | Console logging of row values or identity from the worker | low | mitigate | Zero `console.log/warn/debug/info` in `src/**`, only `console.error`. The one row-adjacent log (`csv-parse.ts:66-71`) carries category, file, index and reason only. | closed |
| T-03-SC | Tampering | Package installs (npm/pip/cargo) | high | mitigate | `git diff --quiet 9558a26 -- package.json pnpm-lock.yaml` exits 0 across 58 commits; no dependency added in this phase. | closed |
| T-03-07 | Tampering | Untrusted folder names and account root flowing through formatters | high | mitigate | Formatters are plain concatenation (`ui-copy.ts:408-410`); zero `@html` in `src/**/*.svelte`; `svelte/no-at-html-tags` is error-level. Test `ui-copy.test.ts:231` proves markup stays literal. | closed |
| T-03-08 | Denial of service | Regular expressions on untrusted strings (`/[ T]/` split, number parse) | low | accept | Accepted - regexes are single-character-class with no nested quantifiers (`ui-copy.ts:428`, `precheck.ts:56`). | closed |
| T-03-09 | Repudiation | Absent versus empty conflated, misleading the user about what the export contains | medium | mitigate | Five distinct statuses incl. `no-export` vs `empty` (`dashboard-status.ts:74-80`); e2e asserts absent and empty separately (`dashboard.spec.ts:234`, `:252`). | closed |
| T-03-10 | Tampering | Unconfirmed destructive replace through a widened drop path (duplicate, error, slim bar always showing the dropzone) | high | mitigate | Busy guard, confirm-pending guard and the `result !== null` replace guard (`worker-client.svelte.ts:356`, `:368-371`, `:408`); `confirmPending` posts only in the `replace` branch. | closed |
| T-03-11 | Denial of service | Permanent spinner when the first storage read fails (v2 upgrade can fail) | medium | mitigate | Cache-check error recovers to `idle` with no banner (`worker-client.svelte.ts:542-551`); a stale `jobId` returns without touching state. Tests at `ingest-client.test.ts:1420-1445`. | closed |
| T-03-12 | Information disclosure | Console logging of worker error detail | low | accept | Accepted - a single `catch` posts `name: message`; no row or identity source can reach it. Low severity, and the e2e console assertions would catch a leak. | closed |
| T-03-13 | Repudiation | User believes data was replaced or cleared when the write failed | medium | mitigate | `#fail` keeps `this.result` (`worker-client.svelte.ts:615-620`); e2e `dashboard.spec.ts:1055` proves the old dataset survives a failure, including after reload. | closed |
| T-03-14 | Tampering | XSS through a crafted nickname, account root or folder name | high | mitigate | Zero `@html`; untrusted folder names render as text - `dashboard.spec.ts:524` asserts zero `b` elements for an unterminated `<b` fixture name. | closed |
| T-03-15 | Information disclosure | Email or birth date reaching DOM text, attributes, title, accessible names, console or IndexedDB | high | mitigate | `identity-privacy.spec.ts:174-217` asserts absence in `innerText`, `outerHTML` incl. `<title>`, aria snapshot, console and a raw IndexedDB dump, each paired with a positive control. 5/5 pass. | closed |
| T-03-16 | Information disclosure | Nickname leaking into title, aria-label, tooltip, nav or logs | medium | mitigate | The nickname occurs exactly once in `outerHTML` and never in console output (`identity-privacy.spec.ts:199`, `:206`). | closed |
| T-03-17 | Repudiation | The header implying the nickname or region is permanent or historically accurate | low | mitigate | `IDENTITY_CAPTION` / `IDENTITY_REGION_LABEL` declare the values are per-export; the date renders without parsing (`ui-copy.ts:353-360`, `:426-430`). | closed |
| T-03-18 | Information disclosure | Account root folder name displayed (untrusted zip entry) | low | accept | Accepted - rendered as text via `formatAccountId`; D-14; e2e `dashboard.spec.ts:1192` proves literal rendering. | closed |
| T-03-19 | Denial of service | Scroll and resize listeners and the observer on a long page | low | mitigate | Passive scroll/resize with one rAF throttle, one `IntersectionObserver`, full teardown (`DashboardNav.svelte:106`, `:127-143`); the rule is unit-tested in `scroll-spy.test.ts`. | closed |
| T-03-20 | Tampering | Hash navigation | low | accept | Accepted - no `hashchange` / `location.hash` usage anywhere; native anchors only; D-04. e2e `scroll-nav.spec.ts:297`. | closed |
| T-03-21 | Information disclosure | Nav labels or accessible names exposing the nickname | low | mitigate | The nav imports only the label/suffix/title constants (`DashboardNav.svelte:3`, `:46-47`); the privacy spec re-runs green against the final page. | closed |
| T-03-22 | Tampering | Unconfirmed destructive replace now that the compact dropzone is always visible after an import | high | mitigate | Replace guard `worker-client.svelte.ts:408`; `cancelPending` mutates state only and posts nothing; e2e `dashboard.spec.ts:1174` proves a drop during confirm changes nothing. | closed |
| T-03-23 | Information disclosure | An off-target drop navigating the browser to the dropped file, exposing it outside the app | high | mitigate | Window-level `ondragover` / `ondrop` with `preventDefault()` (`App.svelte:215`, `:77`, `:83`); e2e `dashboard.spec.ts:1199` records `defaultPrevented` at the window bubble phase. | closed |
| T-03-24 | Information disclosure | Failure banner exposing worker error detail | low | accept | Accepted - the banner renders only the generic constant; every failure routes through `#fail` hardcoding it (`ui-copy.ts:10-11`, `worker-client.svelte.ts:619`). | closed |
| T-03-25 | Repudiation | User believing a replace or clear succeeded when it failed | medium | mitigate | Error notice over an intact dashboard, proven across a reload (`dashboard.spec.ts:1055-1091`); the failed-clear path is `worker-client.svelte.ts:564-570`. | closed |
| T-03-26 | Information disclosure | Real export data entering the repo through tests or the driver | high | mitigate | Fixtures carry `fixture=synthetic`, `.invalid` and RFC 5737 addresses (`tests/fixtures/README.md`); grep for real mail domains across `tests/` and `src/` returns nothing. | closed |
| T-03-27 | Tampering | Weakening an earlier guarantee while re-pointing assertions (zero network, one worker, no dialogs, generic failure copy) | medium | mitigate | The zero-network spec is inside the default gate (no `testIgnore`, `test:e2e` is unfiltered); zero-network, one-worker, no-dialog and generic-copy assertions are all preserved. | closed |
| T-03-28 | Denial of service | Leftover preview server on port 4173 blocking later runs | low | mitigate | `vite.config.ts:99-102` `strictPort: true`; the driver kills the listener before and after; regression test `webserver-teardown.test.ts:108`. | closed |

*Status: open, closed, or open-below-threshold (non-blocking).*
*Severity: critical > high > medium > low - only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`.*
*Disposition: mitigate (implementation required), accept (documented risk), transfer (third-party).*

**Result: 29/29 closed, 0 open, 0 above the `high` blocking threshold.**

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| T-03-03 | T-03-03 | A renamed sensitive column (for example EMAIL) or PII in other categories | locked by the user in 03-CONTEXT.md | 2026-09-29 |
| T-03-08 | T-03-08 | Regular expressions on untrusted strings (`/[ T]/` split, number parse) | locked by the user in 03-CONTEXT.md | 2026-09-29 |
| T-03-12 | T-03-12 | Console logging of worker error detail | locked by the user in 03-CONTEXT.md | 2026-09-29 |
| T-03-18 | T-03-18 | Account root folder name displayed (untrusted zip entry) | locked by the user in 03-CONTEXT.md | 2026-09-29 |
| T-03-20 | T-03-20 | Hash navigation | locked by the user in 03-CONTEXT.md | 2026-09-29 |
| T-03-24 | T-03-24 | Failure banner exposing worker error detail | locked by the user in 03-CONTEXT.md | 2026-09-29 |

*Accepted risks do not resurface in future audit runs.*

All 6 accepted risks trace to a decision the user locked in `03-CONTEXT.md`
(D-18 deny-list, D-14 literal account-ID rendering, D-04 native anchors) or to a
low-severity path with no reachable sensitive source.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-29 | 29 | 29 | 0 | gsd-security-auditor (ASVS L1, block_on high) |

### Method

The register was authored at plan time, so the audit verified declared mitigations
rather than hunting for new threats. Every threat was resolved by reading the shipped
implementation and recording a `file:line`, a named test or a grep result - never by
trusting the plan's claim. Three checks were run directly:

- Structural verification of the privacy choke point: exactly one `bulkPut`
  (`db.ts:132`), one production `writeDataset` caller (`ingest.worker.ts:229`), one
  Dexie connection, one `allRows` push. `ClassifyResult` carries no row data across
  the worker boundary, so there is no second write path that could forget the strip.
- Non-vacuity by mutation: neutering `sanitizeUserInfoRow` to `return { ...data }`
  in a throwaway copy of the tree turns all 5 privacy e2e tests red, failing at the
  at-rest IndexedDB assertion. The spec fails for the right reason at the durable
  layer, and its `"IP"` control prevents a vacuous pass.
- The full unit suite (316 tests) and the privacy spec (5/5) were executed during
  the audit, and `git diff --quiet 9558a26 -- package.json pnpm-lock.yaml` exits 0.

### Non-blocking observations

- **T-03-22, assertion depth.** The cancel path is verified in code (`cancelPending`
  posts nothing) and e2e proves the dashboard is intact after cancel, but neither test
  re-reads IndexedDB *after* the cancel. The storage half is covered indirectly by the
  reload assertions in the failed-replace test. Not a mitigation gap.
- **T-03-03, cross-reference precision.** The register points at "RESEARCH Open
  Question 3"; the residual-risk sentence actually lives at `03-RESEARCH.md:714` and
  in `src/lib/worker/identity.ts:32-36`, not in the Q3 body. The risk is genuinely
  documented in two other places; only the pointer is off.
- **T-03-12 residual.** `e.message` from the worker's single `catch` is not a
  hard-coded string, so a future throw carrying entry-path data would reach
  `console.error`. Low severity, accepted, and the e2e console assertions would catch
  it if it ever carried a fixture email.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-29
