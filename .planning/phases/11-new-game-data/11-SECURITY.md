---
phase: "11"
slug: "new-game-data"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-19"
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| User's zip to worker row choke point | Family files (HEAT, WoT Console, Warplanes, Warships crews and storage) are read in the Web Worker and stored only through a per-file column allowlist | Personal data columns (nicknames, emails, account IDs, locations) must never be stored |
| Stored rows to pane views | Builders read cells only through the spec's own column ids | Allowlisted cells, IP addresses (masked by default) |
| Worker to page | Pane facts and card views cross as integers and spec-keyed cells | Counts, labels from constant tables, never zip entry names |
| Page to network | None: zero requests after load (PRIV-02), enforced by ESLint ban and Playwright request counting | Nothing |
| Developer machine to repo | `header_capture.py` reads the user's own export for column headers only | Column header names, never cell values |

---

## Threat Register

38 unique threat ids from the plan threat models plus T-11-SC (supply chain, repeated in all 11 plans and verified once). All 39 closed; evidence is in the audit report summarised below.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-11-01 | Information disclosure | HEAT/WOTC session rows stored with every column | high | mitigate | `projectRow` allowlist at the ingest choke point; spec-less family rows store `{}` | closed |
| T-11-02 | Tampering | Hostile header text used as a stored key | medium | mitigate | Map-keyed projection, spec ids only, 200-char cell clamp | closed |
| T-11-03 | Information disclosure | Family file misfiled under another folder | high | mitigate | `specFor` needs both file name and category, else nothing stored | closed |
| T-11-04 | Spoofing | Hostile game token as chip label | low | mitigate | Fixed `GAME_FILTER_TOKENS` tuple | closed |
| T-11-05 | Information disclosure | `header_capture.py` printing a data cell | high | mitigate | Identifier-only token regex, `[suppressed]` otherwise, guard test | closed |
| T-11-06 | Information disclosure | Real values committed in headers or decision table | high | mitigate | Roots relabelled `ACCT-X`, guard rejects `@` and 4+ digit runs | closed |
| T-11-07 | Tampering | Crafted entry or oversized entry in user's own zip | low | accept | In-memory `zipfile` read, no extract, `python3 -I` | closed (accepted) |
| T-11-08 | Information disclosure | Spec wider than decision table keeps a personal column | high | mitigate | No NAME/EMAIL/ACCOUNT_ID/CITY/REGION/ISP/ASN column in any spec; evidence and identity-pattern guards | closed |
| T-11-09 | Information disclosure | WOWP account-file nickname stored | high | mitigate | `NAME` absent from both WOWP account specs, test asserts it | closed |
| T-11-10 | Tampering | Allowlist narrower than Vehicles vocabulary blanks a column | medium | mitigate | WOWP specs include the builder vocabulary; superset and parity tests | closed |
| T-11-11 | Denial of service | Huge header names, many columns, surplus cells | medium | mitigate | Map lookups, unmatched keys never copied, cell clamp | closed |
| T-11-12 | Information disclosure | Cached rows hold unfiltered family rows | high | mitigate | `narrowStoredNewDataRows` on every `check-cache` | closed |
| T-11-13 | Tampering | Narrowing deletes or rewrites wrong data | medium | mitigate | Family rows only, one `rw` transaction, idempotent | closed |
| T-11-14 | Information disclosure | Pane facts carrying names, cells or ids | medium | mitigate | Facts are integers only, spec-gated | closed |
| T-11-15 | Denial of service | Thousands of family files inflating meta | low | mitigate | `MAX_PRESENCE_FILES` guard on the family branch | closed |
| T-11-16 | Spoofing | List or Overview string built from zip data | medium | mitigate | Constant titles and labels, integer counts | closed |
| T-11-17 | Information disclosure | Row counts of new panes shown in list | low | accept | Integers only, no network path | closed (accepted) |
| T-11-18 | Information disclosure | Reveal persisting across dataset replace or clear | high | mitigate | Stamped shell reveal cell, no storage/URL/history use | closed |
| T-11-19 | Information disclosure | Login history masking changing during lift | medium | mitigate | Toggle, `data-masked` and caption kept; props from the shell cell | closed |
| T-11-20 | Tampering | Remembered title from another dataset reaching vehicles query | low | mitigate | Fixed four-id list, stale stamp gives null, worker re-validates | closed |
| T-11-21 | Information disclosure | Builder reading non-allowlisted key of a legacy row | high | mitigate | Reads spec headers only via `Object.hasOwn`, canary tests | closed |
| T-11-22 | Tampering | Smuggled field on heat or warships-storage query | low | mitigate | `isDataQuery` rejects `title`/`battleType` on non-vehicle channels | closed |
| T-11-23 | Spoofing | Zip entry name in a card caption | medium | mitigate | View type has no file-name field; captions from `NEW_DATA_FILE_LABELS` | closed |
| T-11-24 | Denial of service | Very large table inflating posted message | low | accept | Cell clamp, inflate bounds, windowing above 500 rows | closed (accepted) |
| T-11-25 | Information disclosure | IP in cleartext in DOM while masked | high | mitigate | Address cells only through `displayIp`; no dynamic title/aria-label | closed |
| T-11-26 | Information disclosure | Account id or nickname in attribute or visible text of tagged row | medium | mitigate | `AccountTag` is the only renderer; label in visually hidden text | closed |
| T-11-27 | Tampering | Cell or label rendered as markup (XSS) | high | mitigate | No `{@html}`/`innerHTML` in new-data, shell or vehicles; guard tests | closed |
| T-11-28 | Denial of service | One DOM node per row for huge tables | medium | mitigate | `windowRange` above 500 rows, 40px rows, two spacers | closed |
| T-11-29 | Information disclosure | Error panel echoing worker detail | low | mitigate | Fixed `HEAT_ERROR` / `WOWS_STORAGE_ERROR` | closed |
| T-11-30 | Information disclosure | HEAT addresses revealed by default or fed to Logins map | high | mitigate | Masked by default; HEAT file matches no aggregator | closed |
| T-11-31 | Information disclosure | Error element echoing file names or paths | low | mitigate | Fixed sentence, `role="alert"` | closed |
| T-11-32 | Tampering | Previous dataset's view under a new dataset | medium | mitigate | `importedAt` stamp check, `acceptDataOutcome` drops stale outcomes | closed |
| T-11-33 | Information disclosure | Warplanes block showing account nickname | high | mitigate | No NAME column, no nickname field on `WowpAccountBlock` | closed |
| T-11-34 | Information disclosure | Builder reading non-spec key of a legacy row | high | mitigate | `directCell` on spec column ids only | closed |
| T-11-35 | Spoofing | Zip entry name printed in skipped line | medium | mitigate | `skipped` built from fixed `WOWP_FILE_KEYS` and label table | closed |
| T-11-36 | Information disclosure | New pane or toggle issuing a network request (PRIV-02) | high | mitigate | Zero-network e2e extended to every new pane; ESLint network ban and CSP unchanged | closed |
| T-11-37 | Information disclosure | Planted email/nickname or full HEAT address in rendered output | high | mitigate | e2e canary and masked-address checks | closed |
| T-11-38 | Denial of service | E2E suite exceeding CI timeouts | medium | mitigate | 263 listed tests under the 264 ceiling; `ci-budget` guard; CI run reported green by the user | closed |
| T-11-SC | Tampering | npm/pip/cargo installs | high | mitigate | No manifest or lockfile change since Phase 10; `header_capture.py` imports `re`, `sys`, `zipfile` only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward `threats_open`*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | T-11-07 | Crafted zip entry in the user's own export: header capture reads in memory, never extracts, runs under `python3 -I`. Low severity. | Phase 11 plan threat model (11-02); premises re-verified in code by the audit | 2026-10-19 |
| AR-11-02 | T-11-17 | Row counts of the new panes are integers shown only to the same user, with no network path. Low severity. | Phase 11 plan threat model (11-05); premises re-verified in code by the audit | 2026-10-19 |
| AR-11-03 | T-11-24 | Large table in the posted message: cells clamped to 200 characters, inflate bounded, table windowed above 500 rows. Low severity. | Phase 11 plan threat model (11-07); premises re-verified in code by the audit | 2026-10-19 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-19 | 39 | 39 | 0 | gsd-security-auditor |

Audit notes:
- T-11-18 "pane switch": by design (D-04) the same dataset keeps the reader's own reveal across a pane switch, because the reveal is one global flag. Reset on replace, clear and null dataset is enforced by the stamp comparison.
- `11-05-SUMMARY.md` and `11-06-SUMMARY.md` have no `## Threat Flags` section. Documentation gap only; their register entries (T-11-16 to T-11-20) were verified in code independently.
- The one-worker CI wall-time check behind T-11-38 was an open human item at audit time; the user has since reported the CI run green.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-19
