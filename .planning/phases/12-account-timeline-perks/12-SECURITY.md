---
phase: "12"
slug: account-timeline-perks
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-20"
---

# Phase 12 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| User's export zip to capture script | Script reads headers of the user's own zip, extracts nothing | Column names only (cell values never printed) |
| Zip rows to worker allowlist | Per-file column allowlist at the worker row choke point | Allowlisted cells only; email-shaped values dropped |
| Worker to Dexie (at rest) | Spec keys only; legacy rows narrowed in place | Allowlisted rows; codes and bonus-code IP stored in clear in the user's own IndexedDB by design (D-13/D-14) |
| Worker view to DOM | Field-less channels, constant-only formatters | Masked codes and IPs until the single global reveal |
| Page to network | Zero requests after load (sole exception: opt-in city file) | None |

---

## Threat Register

All mitigations were checked present in the cited code and tests (ASVS L1), and the cited suites were re-run by the auditor.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-12-01 | Info disclosure | header_capture_12.py | high | mitigate | TOKEN_RE and CODE_SHAPE_RE suppress code-shaped and single-token headers; folder scope excludes Account_Info and Game_Forums | closed |
| T-12-02 | Info disclosure | 12-HEADERS artifacts | high | mitigate | ACCT-X relabel; new-data-headers.test.ts rejects at-signs and digit runs; no zip tracked | closed |
| T-12-03 | Tampering | capture script input | low | accept | zipfile read-only, nothing extracted, python3 -I; input is the user's own zip | closed (accepted) |
| T-12-04 | Info disclosure | ingest.worker family storage | high | mitigate | FAMILY_CATEGORIES + specFor/fileMatchesSpec; spec-less or misfiled files store nothing | closed |
| T-12-05 | Info disclosure | new-data-specs | high | mitigate | Spec ids only; PROFILE_ID, BATTLE_ID omitted | closed |
| T-12-06 | Tampering | data-queries | medium | mitigate | Strict field-less channels, fixed 'invalid query' | closed |
| T-12-07 | Info disclosure | pane facts | medium | mitigate | Integer file and row counts only | closed |
| T-12-08 | DoS | CI budget | medium | mitigate | Timeouts and test-count ceiling pinned in ci-budget.test.ts | closed |
| T-12-09 | Info disclosure | promoted folders | high | mitigate | All six folders fail closed until specced; promoted-folders.test.ts plants canaries | closed |
| T-12-10 | Info disclosure | Game_Forums | high | mitigate | Folder in neither SUPPORTED nor FAMILY_CATEGORIES; counted, never stored | closed |
| T-12-11 | Info disclosure | Account_Info deny-list | medium | accept | No User_Info files beyond the three history files; Account_Info keeps its deny-list strip | closed (accepted) |
| T-12-12 | Tampering | migrated tests | medium | mitigate | Only the stand-in folder renamed; assertions kept | closed |
| T-12-13 | Tampering | account-merge | medium | mitigate | Signature over the whole column list, occurrence-index keys, Map not object | closed |
| T-12-14 | DoS | timeline-instant | low | mitigate | 40-char cap, anchored regexes, range-checked parse | closed |
| T-12-15 | Info disclosure | ui-copy formatters | medium | mitigate | Number-only formatters; constant file labels | closed |
| T-12-16 | Info disclosure | emailGuard | high | mitigate | EMAIL_SHAPE guard in projectRow, shared by import and narrowing | closed |
| T-12-17 | Info disclosure | code cells | high | mitigate | maskCode unless revealed; cells drawn as text nodes only | closed |
| T-12-18 | Info disclosure | maskCode | medium | mitigate | At most 5 code points; non-strings and short codes give xxx | closed |
| T-12-19 | Info disclosure | account tags | medium | mitigate | Letter and constant label only, position keys | closed |
| T-12-20 | Info disclosure | legacy narrowing | high | mitigate | narrowStoredNewDataRows by name and category on every check-cache | closed |
| T-12-21 | Tampering | narrowing scope | medium | mitigate | Grouped by account, file, category | closed |
| T-12-22 | Info disclosure | Game_Forums legacy rows | high | mitigate | Purge keyed on classifyFolder; game-forums-guard.test.ts | closed |
| T-12-23 | Info disclosure | nine specs | high | mitigate | Columns equal the allow rows of 12-HEADERS.md; lints | closed |
| T-12-24 | Info disclosure | emailGuard on specs | high | mitigate | emailGuard true on all nine Phase 12 specs | closed |
| T-12-25 | Spoofing | identity pools | medium | mitigate | History files kept out of identity and rebuild pools | closed |
| T-12-26 | Info disclosure | PLAYER_ANSWER | medium | mitigate | User-recorded rating statement; lint ties it to the recorded answers (residual: no value-shape check, WR-03) | closed |
| T-12-27 | Info disclosure | column labels | medium | mitigate | Object.hasOwn lookup with allowlisted id fallback | closed |
| T-12-28 | Info disclosure | PerksPane | high | mitigate | No cell-bearing attributes; reveal state owned by the shell | closed |
| T-12-29 | Info disclosure | Perks error | low | mitigate | Fixed PERKS_ERROR, worker detail dropped | closed |
| T-12-30 | Spoofing | Perks stale reply | medium | mitigate | importedAt stamp check on accept and at render | closed |
| T-12-31 | Tampering | Perks merge | medium | mitigate | Only Subscriptions merges, keyed on the whole column list | closed |
| T-12-32 | Info disclosure | Perks builder | high | mitigate | Reads spec columns only, never a row's own keys | closed |
| T-12-33 | Info disclosure | address cells | medium | mitigate | Address kind returns the canonical parse or null | closed |
| T-12-34 | Tampering | account-timeline channel | medium | mitigate | Strict field-less channel | closed |
| T-12-35 | Info disclosure | timeline builder | high | mitigate | Parts read through cellOf with spec kind; no timeline spec has an address column | closed |
| T-12-36 | DoS | timeline sort | medium | mitigate | One Map pass, one comparator sort, windowed table | closed |
| T-12-37 | Info disclosure | timeline view | medium | mitigate | Cells, kinds, dates, roots only | closed |
| T-12-38 | Info disclosure | TimelineTable | high | mitigate | Every part via formatNewDataCell; fixed-word attributes | closed |
| T-12-39 | Info disclosure | timeline tags | medium | mitigate | AccountTag with constant formatter labels | closed |
| T-12-40 | Spoofing | kind filter | low | mitigate | Stamped choice, pure resolve, no storage or URL | closed |
| T-12-41 | DoS | timeline table | medium | mitigate | Windowed above 500 rows, no SVG | closed |
| T-12-42 | Info disclosure | network | high | mitigate | zero-network stage 13; ESLint network ban clean; no fetch/XHR/WebSocket/Worker added | closed |
| T-12-43 | Info disclosure | planted values in DOM | high | mitigate | Browser expectAbsent over text, markup, content, title; Node proof | closed |
| T-12-44 | Info disclosure | single reveal | high | mitigate | Masked by default, shared with Login history, re-masked after reload and replace | closed |
| T-12-45 | DoS | large archive | medium | mitigate | Browser step asserts window plus spacers, no svg, bounded nodes | closed |
| T-12-SC | Tampering | supply chain (all 13 plans) | high | mitigate | package.json and pnpm-lock.yaml unchanged vs main; script imports re, sys, zipfile only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-12-01 | T-12-03 | Capture script input is the user's own zip, read-only, nothing extracted | Plan 12-01 (planner), confirmed by security auditor | 2026-10-20 |
| AR-12-02 | T-12-11 | No User_Info files beyond the three history files; Account_Info keeps its deny-list strip | Plan 12-04 (planner), confirmed by security auditor | 2026-10-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Non-blocking Observations (not in the register)

- Email guard is a heuristic: `user@localhost`, `user@example.` and full-width at-sign pass. `TIMELINE_ABOUT` copy overclaims "never read, stored or shown" (REVIEW WR-04).
- No value-shape check on allowlisted enum-like columns (PLAYER_ANSWER, STATUS, OPERATION, NAME, THIRD_PARTY_SITE); only the email guard and the 200-character clamp apply (REVIEW WR-03).
- Codes and the bonus-code IP are stored in clear in the user's own IndexedDB by design (D-13/D-14); masking is at render time.
- Timeline reveal wiring and the "IP addresses stay masked" copy are unreachable: no timeline spec has an address column (REVIEW IN-01).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-20 | 46 | 46 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-20
