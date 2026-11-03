---
phase: "9"
slug: "multi-account-import-account-identity"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-17"
---

# Phase 9 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Authored from the six PLAN threat models (state B). `register_authored_at_plan_time: true`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| zip entry names to classifier | Untrusted folder names (any text, any length, any count) decide which folders are account roots | Folder names; attacker-controlled text and count |
| zip entry contents to parse loop | Untrusted CSV headers and cells for every root and every category | PII columns (email, IP, birth date, login) |
| worker to IndexedDB | Everything written here rests on the device indefinitely | Every stored row and its account stamp |
| worker to main thread | Only derived values cross; no raw rows | Aggregates, identity, account list |
| returning cache at rest | A v1.0-shaped cache may still hold rows the current classifier rejects | Unknown / known-deferred rows, incl. `EMAIL` and `IP_ADDRESS` |
| stored rows to aggregates | Rows from several accounts are re-read by lazy rebuilds | Cross-account merges |
| worker result to DOM | Nicknames, account IDs (folder names) and game tokens are untrusted text | Untrusted text into the accessibility tree |
| page to observers | DOM, a11y tree, console and IndexedDB are all observable surfaces | Identity fields, per-account activity |
| merged rows to panes | Rows from several accounts reach panes written for one account | Combined counts |
| page to network | The product's central guarantee: no request after load | Any request at all |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Information disclosure | `classify.ts` root resolution | high | mitigate | A `User_Info` folder under an unrelated parent never becomes a root; root is an *unknown-named* folder directly holding a recognised category (D-01) | closed |
| T-09-02 | Denial of service | `classify.ts` N-root resolver | medium | mitigate | `MAX_ACCOUNT_ROOTS` (32) and `MAX_ROOT_NAME_LENGTH` (128) applied in one linear pass before any per-root counting (D-20) | closed |
| T-09-03 | Spoofing | root-name collision | medium | mitigate | Case-insensitive collision check (`root.toLowerCase()`) → `ambiguous-root` (T-09-03) | closed |
| T-09-04 | Tampering | prototype pollution | low | mitigate | Every per-root structure is a `Map`/`Set`, never a plain object keyed by a root name (`__proto__`, `constructor`) | closed |
| T-09-05 | Information disclosure | loose top-level files | low | mitigate | Loose files are skipped entirely — never a root, never resolved to a category, never counted (D-05) | closed |
| T-09-06 | Information disclosure | `csv-parse.ts` / `identity.ts` header strip | high | mitigate | Header-level strip removes `LOGIN`, `BIRTH_DATE`, `BIRTH_DATE_SRC` and friends; normalisation defeats padded and duplicated (`LOGIN_1`) column shapes | closed |
| T-09-07 | Information disclosure | D-18 store rule | high | mitigate | `const storeRows = entry.status === 'supported'` in `ingest.worker.ts` — unsupported/known-deferred rows are parsed for counts, never stored | closed |
| T-09-08 | Information disclosure | identity selection | high | mitigate | A root with no `User_Info` yields an ID-only identity; never another root's nickname | closed |
| T-09-09 | Denial of service | account string on rows | medium | mitigate | The account string copied onto every row is a bounded root name, capped at 128 characters | closed |
| T-09-10 | Tampering | replace transaction | medium | mitigate | Replacement is atomic in one transaction; a failed write leaves no half-replaced dataset | closed |
| T-09-11 | Information disclosure | error path | low | mitigate | Cells never reach the console through an error message; parse errors carry counts, not content | closed |
| T-09-12 | Information disclosure | D-21 purge | high | mitigate | `purgeUnsupportedCategoryRows()` in `db.ts`, awaited first in `handleCheckCache` — a returning v1.0 cache loses its unsupported-category rows on load | closed |
| T-09-13 | Information disclosure | login pane address pool | medium | mitigate | `accountPool` is empty for two or more accounts, so the pane shows no single account's address | closed |
| T-09-14 | Tampering | lazy rebuild merge | medium | mitigate | Rebuilds group by account → category → file and reproduce the import's result exactly (D-11 merge by design) | closed |
| T-09-15 | Tampering | lazy rebuild aggregate ownership | low | accept | Accepted — see Accepted Risks Log | closed |
| T-09-16 | Tampering | interrupted write | medium | mitigate | Abort leaves the previous dataset intact; the abort case is in the lifecycle matrix | closed |
| T-09-17 | Denial of service | schema version | medium | mitigate | `db.verno` stays 2 and the version-two upgrader is untouched — no returning user loses a cached dataset | closed |
| T-09-18 | Tampering | `IdentityHeader.svelte` untrusted text | medium | mitigate | `min-width: 0` and `overflow-wrap: anywhere` on the account rows; measured at 375 px, not assumed | closed |
| T-09-19 | Information disclosure | header copy | medium | mitigate | Copy is derived, never raw; nickname, email and birth date never reach the header (`identity-privacy.spec.ts` unchanged) | closed |
| T-09-20 | Spoofing | ID-only row | medium | mitigate | `data-user-info={row.idOnly ? 'absent' : undefined}` — the absent account renders its own ID, never another's identity | closed |
| T-09-21 | Repudiation | combined-pane caption | low | mitigate | `combinedCaption` is the single place the caption is decided; `accountCount >= 2` gates it | closed |
| T-09-22 | Denial of service | duplicate `{#each}` keys | medium | mitigate | Vehicles and battle-type blocks key by `(index)`; `tests/unit/import/multi-account-keys.test.ts` audits every keyed block | closed |
| T-09-23 | Information disclosure | lifecycle residue | high | mitigate | Reload, duplicate, replace, Clear and Start Over each re-prove a raw IndexedDB snapshot; zero rows and zero meta after the clear paths | closed |
| T-09-24 | Information disclosure | page to network | high | mitigate | `zero-network.spec.ts` stage 11 drives a three-account replace and every pane under the existing request/single-worker/origin/CSP assertions | closed |
| T-09-25 | Denial of service | e2e CI budget | low | mitigate | 258 listed tests in 28 files measured; the two long tests priced as one block; all three limits moved together to 30 / 32 / 40 min | closed |
| T-09-SC | Tampering | supply chain | high | mitigate | No dependency added this phase — `git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml` exits 0 | closed |
| T-09-26 | Tampering | `readRowsByFile` buckets and the merged readers | medium | mitigate | Per-account, per-file grouping (`AccountRowGroup`, `groupsOf` in `data-queries.ts`); every merged consumer resolves columns from its OWN group's first row. A union key map is forbidden — it is the same defect one layer down | closed |
| T-09-27 | Tampering | the grouping key | medium | mitigate | Grouping uses a `Map` keyed by the account root, never a plain object and never a joined account-and-file string — a root named `__proto__` or `constructor` is safe | closed |
| T-09-28 | Information disclosure | the id-only account row's demotion | medium | mitigate | `.multi-name.id-only` SHARES the existing `.account-id` rule rather than restating its values, so the demoted title and the ID line cannot drift apart. The element, its test id and its accessible name are unchanged — the type is demoted, never the content | closed |
| T-09-29 | Tampering | `readLoginRowData`'s account count | low | mitigate | Both the count AND the single root now come from `accountsOfMeta`, the one normaliser — rebuild and every replay cannot disagree on an empty `accounts` list | closed |
| T-09-30 | Denial of service | a stored `AccountMeta` written with partial fields | medium | mitigate | `toAccountSummary` is total: missing `games` projects to `[]`, missing years to `null`. `AccountMeta` was NOT weakened to accommodate it | closed |
| T-09-31 | Tampering | the published account list | medium | mitigate | One projection (`accountSummariesOf`) serves both the import's `done` payload (`ingest.worker.ts:1277`) and `resultFromMeta` (`:730`), so the count, the row list, the Overview card and the six pane captions read one number. `hasData` is optional and read as absent-means-has-data, so an existing cache renders unchanged | closed |
| T-09-32 | Information disclosure | the Account record for a dataset with a data-less root | high | mitigate | The STORE keeps every root and the Account-record gate still reads `ordered.length === 1` over the FULL root list (`ingest.worker.ts:1202`), never the published projection. A two-root-one-empty archive publishes no account address; only the published list is filtered | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-09-01 | T-09-15 | A lazy rebuild writes an aggregate that spans more than one account. Accepted: the aggregate is a derived count over rows the reader already owns, no identity or raw cell is exposed, and fixing ownership properly belongs to the Phase 10 de-duplication that also owns the D-11 merge. | planner (09-03) | 2026-10-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-17 | 26 | 26 | 0 | execute-phase (L1 classification, `asvs_level: 1`) |
| 2026-10-18 | 33 | 33 | 0 | execute-phase re-audit after gap closure (T-09-26 … T-09-32, L1 classification, `asvs_level: 1`) |

### Accepted product decision behind T-09-31

The user chose **option-a** at 09-10's blocking-human checkpoint: a root that stores no
supported-category row and has no `User_Info` is not published in the account list. The count,
the row list, the Overview card and all six pane captions therefore describe the **data**, not
the archive. The accepted cost, recorded in `09-10-SUMMARY.md`: a folder the user can plainly
see in their zip now contributes nothing and is named nowhere on the dashboard. That is this
decision, not a bug — "a folder in my zip disappeared" means exactly this. The alternative
(surfacing the classifier's full root list) is the named open follow-up.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-17

---

### Unrun verification

The optional read-only check against the user's private three-account archive was denied by the
environment's data-handling permission. Nothing was read, copied or committed from it, and no claim
is made about it — see `09-06-SUMMARY.md` and `.planning/WINDOWS.md` entry 12.