---
phase: "02"
slug: "defensive-parsing-persistent-dataset"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-11"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Dropped zip to worker | Untrusted export bytes inflated and parsed inside the single long-lived worker | Raw export archive, CSV text (PII: LOGIN, BIRTH_DATE) |
| Worker to IndexedDB | Parsed rows and meta persisted in one transaction | Account rows after the header-keyed PII strip |
| Worker to UI | Category names, counts and skip numbers rendered by text interpolation | Folder names from the archive (untrusted strings) |
| Browser to network | None after load; the opt-in city file is the only sanctioned request (Phase 6) | n/a |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | DoS | Full inflate/parse of a large export | medium | mitigate | Parsing runs in the worker; declared-size caps in inflate-bounds.ts; 10x-scale e2e long-task test | closed |
| T-02-02 | Tampering / XSS | Untrusted category names and counts | high | mitigate | `svelte/no-at-html-tags: error`, no innerHTML/eval, text interpolation, numeric skip counts | closed |
| T-02-03 | Info disclosure | Unencrypted IndexedDB cache | medium | mitigate | "Clear my cached data" control with confirm; clearData wipes rows and meta in one transaction | closed |
| T-02-04 | Tampering | Interrupted write leaves inconsistent state | medium | mitigate | clear + chunked bulkPut + meta.put in one Dexie transaction (db.ts) | closed |
| T-02-07 | Tampering | Double-click racing confirmPending | low | accept | Guard on state; clearData idempotent | closed |
| T-02-08 | Repudiation | No undo on clear | low | accept | Warning copy states deletion is permanent (D-21) | closed |
| T-02-13 | Tampering | Drop-while-done affordance | low | accept | Replace guard routes every drop through confirm | closed |
| T-02-14 | Info disclosure | Glued header bypasses PII strip | high | mitigate | Header-driven delimiter; hasGluedSensitiveColumn withholds the whole file, counted | closed |
| T-02-15 | Tampering | Stray quote silently truncates file | high | mitigate | Quarantine only the physical line, re-parse the remainder, count exactly | closed |
| T-02-16 | Tampering | error.row mis-mapped by blank-line filter | medium | mitigate | skipEmptyLines false; blank records filtered in the wrapper | closed |
| T-02-17 | DoS | Quadratic quarantine loop | low | mitigate | MAX_QUARANTINED_RECORDS = 1000, remainder counted and logged | closed |
| T-02-18 | Info disclosure | Skip logs leak cell/header text | low | mitigate | Logs carry category, file, line, reason only | closed |
| T-02-19 | Tampering | Withhold false positive | low | accept | Visible, counted; negative controls tested | closed |
| T-02-20 | Info disclosure | Fullwidth/Cyrillic/Greek lookalike keys | high | mitigate | One shared NFKC + bounded confusable fold normaliser for strip, glued check and pick | closed |
| T-02-21 | Info disclosure | Unresolvable disguised key | high | mitigate | Additive predicate: 02-05 raw rule kept, plus folded-glue, invisible-char and pre-fold resemblance rules | closed |
| T-02-22 | Info disclosure | All-foreign-script header, translated names | medium | accept | Withholding all non-ASCII headers would drop legitimate native columns | closed |
| T-02-23 | Tampering | Resemblance-rule false positive | low | accept | Visible, counted withhold | closed |
| T-02-24 | Tampering | Mixed terminators glue records | high | mitigate | Canonicalise CRLF/CR to LF with newline '\n' when two or more kinds occur | closed |
| T-02-25 | Tampering | CR/CRLF in a quoted cell rewritten in a mixed file | low | accept | Line break stays in the cell; documented cost | closed |
| T-02-26 | DoS | Normaliser/resemblance cost on import hot path | low | mitigate | ASCII fast path, bitmask walk, no dynamic RegExp, once per file | closed |
| T-02-27 | Info disclosure | Header/cell text in diagnostics | low | mitigate | Same log shape as T-02-18 | closed |
| T-02-SC | Tampering | Supply chain (papaparse, dexie, @types/papaparse, fake-indexeddb) | high | mitigate | Audited versions pinned with integrity hashes; no dependency change in 02-05/02-06 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-07 | Duplicate confirm is harmless because clearData is idempotent | plan 02-03 | 2026-09-29 |
| AR-02-02 | T-02-08 | Destructive clear is explicit, confirmed and warned | plan 02-03 | 2026-09-29 |
| AR-02-03 | T-02-13 | Drop while a dataset is shown is always confirm-gated | plan 02-04 | 2026-09-29 |
| AR-02-04 | T-02-19 | Visible, counted false-positive withhold is preferable to a PII leak | plan 02-05 | 2026-10-10 |
| AR-02-05 | T-02-22 | A header in an unfolded script or a translated name passes strip and withhold; same class as T-03-03; real Wargaming headers are ASCII | plan 02-06 | 2026-10-11 |
| AR-02-06 | T-02-23 | Visible, counted false-positive withhold | plan 02-06 | 2026-10-11 |
| AR-02-07 | T-02-25 | Quoted-cell CR/CRLF becomes LF only in mixed-terminator files; content preserved | plan 02-06 | 2026-10-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-11 | 22 | 22 | 0 | gsd-security-auditor (sonnet) |

Observations (non-blocking): T-02-17 measured 7.3 s at 100k hostile lines against the plan's ~0.9 s estimate, bounded and in the worker. T-02-SC: the human approval reply for the 02-01 package gate is not persisted; closed on the pinned audited versions.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-11
