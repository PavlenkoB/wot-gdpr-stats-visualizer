---
phase: "13"
slug: "overview-personal-insights"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on (high)
threats_open: 0
asvs_level: 1
created: "2026-10-23"
---

# Phase 13 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (every PLAN carries a `<threat_model>`); verified by
> `gsd-security-auditor` against the code and guard tests on 2026-10-23, verdict `SECURED`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Export zip to import worker | Untrusted CSV text from the user's own export | Nicknames, e-mail, clan, chat, order amounts, tank tags and names |
| Worker to page (`overview` channel) | The only path from stored rows to the DOM | Counts, durations, day numbers, ratios, micro-unit strings, resolved names. No field can hold a nickname, e-mail, clan, chat text or order amount |
| Page to localStorage (`wg-overview-pins`) | Per-viewer pin state | Tile ids from a closed set only |
| Maintainer machine to Wargaming API | Build-time only, never in CI, never at runtime | Application id (secret) outbound; public vehicle data inbound |
| Generated table to repository / bundle | One-way public commit, worker chunk only | Tank id, tag, short name, class, tier (Wargaming data, attributed) |
| Page to the network | Zero requests after load | Nothing; one anchor to the game site, no request before a click |

---

## Threat Register

All 44 rows are `closed`. Evidence is a mechanism in code plus a test or guard that fails
if it is removed, except where noted under "Evidence limits" below.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-13-01 | Info disclosure | OverviewView wire type | high | mitigate | No field for amount, chat, clan, nickname, e-mail; canary sweep over 9 fixture variants | closed |
| T-13-02 | Tampering | overview query shape | medium | mitigate | `isDataQuery` accepts exactly one own key; fixed `invalid query` detail | closed |
| T-13-03 | Info disclosure | worker error text | medium | mitigate | Errors send `err.name` only | closed |
| T-13-04 | Tampering | torn snapshot, rows vs rebuild | medium | mitigate | Aggregate read in the rows' own transaction; guarded write-back; replace race answers null | closed |
| T-13-05 | Tampering | tile ids as property keys | low | mitigate | Tiles are an array of objects, never keyed by id | closed |
| T-13-06 | Info disclosure | application key in logs, errors, generated file, src | high | mitigate | Key only in `searchParams`; `error.value` never read; key redacted from messages; literal scans of `src/` and `dist/` | closed |
| T-13-07 | Tampering | hostile API payload into the table | high | mitigate | Fail-closed validation of every field, duplicates, empty, `MAX_ROWS`; offline `--check` re-validates | closed |
| T-13-08 | Tampering | generator output path | low | mitigate | Output path is fixed; no API field reaches a path | closed |
| T-13-09 | Info disclosure | runtime fetch or dynamic import of the table | high | mitigate | ESLint bans `ImportExpression` and restricts the table to the worker; import-specifier guard; zero-network Overview stage | closed |
| T-13-10 | Info disclosure | real ids, names or paths in fixtures | high | mitigate | Invented ids, `Synth` tags, `.example.invalid`; `no-real-data` guard | closed |
| T-13-11 | Info disclosure | weak canary set | medium | mitigate | 9 canaries; fixture test proves which are present at rest | closed |
| T-13-12 | Tampering | font-size scale guard exemption | medium | mitigate | Scale chosen per file path; self-tests prove no leak into the shell | closed |
| T-13-13 | Tampering | heat and token drift | low | mitigate | Tokens parsed from `app.css`; contrast ratios recomputed | closed |
| T-13-14 | Tampering | stale v3 aggregate read as v4 | medium | mitigate | `PLAYTIME_VERSION` 4; stale aggregate rebuilt and written back; downgrade test | closed |
| T-13-15 | Denial of service | one-time rebuild cost | low | accept | Index-only walk of session rows, once per stale import | closed (accepted) |
| T-13-16 | Tampering | corrupt `wg-overview-pins` value | medium | mitigate | Validated on read, storage and JSON in try/catch, defaults on failure | closed |
| T-13-17 | Tampering | prototype keys via tile id | low | mitigate | Membership by `Set` over the closed tuple; `__proto__` test | closed |
| T-13-18 | Info disclosure | data persisted with pins | low | mitigate | Only a JSON array of known tile ids is written | closed |
| T-13-19 | Info disclosure | nickname (`NAME`) reaching a tile | high | mitigate | `NAME` is not in the field list; Proxy-row test proves it is never read | closed |
| T-13-20 | Tampering | one account's headers on another's cells (CR-01) | high | mitigate | `resolveFields` per account group; tests use different spellings per account | closed |
| T-13-21 | Tampering | hostile record cell as lookup key | medium | mitigate | `/^[1-9][0-9]{0,9}$/` before any Map lookup | closed |
| T-13-22 | Tampering | prototype keys via names or nation prefixes | low | mitigate | Maps throughout; names clamped to 100 | closed |
| T-13-23 | Info disclosure | order amount, product or id reaching the view | high | mitigate | Orders tile reads `rows.length` only; Proxy test | closed |
| T-13-24 | Tampering | money as float | medium | mitigate | Micro-units cross the wire as a string; formatted in bigint | closed |
| T-13-25 | Tampering | habit tile claiming WoT from a legacy file | low | mitigate | Habits read the `WOT` scope only; legacy file gives absent habits | closed |
| T-13-26 | Tampering | markup injection via tank name or nation | high | mitigate | No `{@html}`, `innerHTML`, `createElement`, `style=`; lint rules; hostile-name e2e | closed |
| T-13-27 | Tampering | style attribute or directive breaking CSP | medium | mitigate | CSSOM `style.setProperty` only; `svelte/no-inline-styles`; component guard | closed |
| T-13-28 | Info disclosure | chart or summary carrying data beyond the face | low | mitigate | Every `tileFace` string checked; no NAME in any tile type | closed |
| T-13-29 | Denial of service | view transition never calling back | medium | mitigate | 600 ms fallback armed first; throwing API commits at once; at-most-once | closed |
| T-13-30 | Tampering | layout driven by unvalidated pin id | low | mitigate | Pins matched against the closed definition set only | closed |
| T-13-31 | Info disclosure | planted value in a reply | high | mitigate | Canary sweep over every overview reply; chat/clan in no message of any type | closed |
| T-13-32 | Info disclosure | new field or string without review | medium | mitigate | Closed key and string vocabulary walk with a negative control | closed |
| T-13-33 | Info disclosure | PII to DOM or announcement | high | mitigate | `page.content()` canary and nickname sweep; announcements built from fixed copy | closed |
| T-13-34 | Tampering | markup injection via name or game token | high | mitigate | Same mechanism as T-13-26; bento guard | closed |
| T-13-35 | Tampering | new request from link, lazy chunk or transition | high | mitigate | Static href, `target=_blank`, `rel="noreferrer noopener"`; no `import()` or network global; no request before a click | closed |
| T-13-36 | Tampering | tampered pin value from storage | low | mitigate | Validated on read; exactly one `writePins` call site | closed |
| T-13-37 | Info disclosure | losing no-nickname/region assertions | high | mitigate | Privacy assertions kept on the overview root across five specs | closed |
| T-13-38 | Repudiation | dropped multi-account Account-row coverage | medium | mitigate | 13-13 SUMMARY maps each deleted case to its replacement test | closed |
| T-13-39 | Info disclosure | planted value or request after load via Overview | high | mitigate | Overview stage in the zero-network flow; canary page sweep | closed |
| T-13-40 | Denial of service | e2e job killed by a short limit | medium | mitigate | `ci-budget` guard; three limits move together | closed |
| T-13-41 | Info disclosure | key reaching a file, log, bundle or commit | high | mitigate | Env files gitignored and never tracked; generator never prints key or URL; `src/` and `dist/` literal scans | closed |
| T-13-42 | Tampering | unvalidated table committed | high | mitigate | Offline `--check` (count 1035, hash, per-row rules); committed-table tests | closed |
| T-13-43 | Repudiation | licence breach via one-way commit | high | mitigate | Human gate `approved-proposed-wording` recorded before generation; approved text pinned by tests | closed |
| T-13-SC | Tampering | supply chain (all 15 plans) | high | mitigate | Phase added two npm scripts and no dependency; lockfile untouched | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

### Evidence limits (stated, not hidden)

- **The Wargaming application id VALUE was not compared against the repository.** The agent may not read `.env*`. T-13-06 and T-13-41 rest on the gitignore rule, no env-named file ever tracked, literal scans for the key's parameter name, variable name and API host in `src/` and `dist/`, and the generator source. A scan for the value itself needs the maintainer to run it.
- **T-13-04's mismatch branch** (`ingest.worker.ts`, rebuild skipped when `importedAt` differs) has no dedicated test; evidence is code only.
- **The key-redaction branch** of the generator's `fetchPages` is verified by reading the code. No test fails if it is removed.
- **T-13-43** rests on the recorded human answer. The licence reading itself was not independently verified.

### Code-review findings against the register

Audited before the review fix pass; re-checked after it by the re-verification
(2026-10-24): no row is weakened or false. No row depended on a finding being fixed.

| Finding | Security reading | State now |
|---------|------------------|-----------|
| WR-01 rapid pins lost, WR-02 unpin-all not persisted | UI state, not confidentiality. T-13-16, T-13-29, T-13-36 hold | WR-01 fixed (`7a3afc0`); WR-02 left as a standing decision (the approved UI-SPEC says defaults apply) |
| WR-03, WR-04, WR-05 figure correctness | T-13-20 and T-13-24 hold independently | All three fixed. WR-04 adds one count-only `accounts` key to the overview reply; the closed vocabulary in `data-query-worker.test.ts` was extended deliberately and its negative control still holds (T-13-32) |
| WR-06 generator trusts API `page_total` | Not covered by any row; **low**, never counted in `threats_open` | Fixed (`969b6f3`): pages capped at 31, fails closed before another key-bearing request |
| IN-06 looser dotenv parsing | Failure mode was a rejected request, not a leak | Fixed (`e745b8d`); the value is returned to `fetchPages` only and is never printed or logged |
| IN-07 bidi, zero-width and C1 characters pass the name check | Low spoofing residual; names render as text only | Fixed (`d06deca`); `vehicles:table:check` still reports count 1035 |
| IN-05 record tank reads "vehicle not recorded" | Needs a new reply field, so a privacy-review decision | Not changed; the closed vocabulary is untouched |

T-13-36 still holds after the WR-01 fix: exactly one `writePins` call site.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-01 | T-13-15 | The first Overview ask after upgrading rebuilds the playtime aggregate once from stored session rows (index-only walk), then writes it back; later asks read the stored aggregate | Accepted in the 13-05 plan threat model (planner); recorded here by the orchestrator, not separately signed off by the maintainer | 2026-10-23 |
| AR-13-02 | (documentation) | The committed `vehicle-table.generated.ts` keeps its old header comment until the next `pnpm run vehicles:table` run; the file is generated and must not be hand-edited, and `--check` passes | Noted by the 13-15 executor | 2026-10-23 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-23 | 44 | 44 | 0 | gsd-security-auditor (ASVS 1, block_on high) |
| 2026-10-24 | 44 | 44 | 0 | gsd-verifier re-check of the fix-pass delta (not a full re-audit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-23 by the security auditor's verdict `SECURED`. Not a maintainer sign-off: the maintainer has not reviewed this file.
