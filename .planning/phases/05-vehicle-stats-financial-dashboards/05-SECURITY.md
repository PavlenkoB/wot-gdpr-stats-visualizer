---
phase: "05"
slug: "vehicle-stats-financial-dashboards"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-02"
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Phase 05 ("Vehicle Stats & Financial Dashboards") shipped 16 plans, each authored with a
`<threat_model>` STRIDE register. This audit verifies those 69 declared threat rows against the
implementation as committed on `gsd/phase-05-vehicle-stats-financial-dashboards`.

**Register authored at plan time:** yes — all 16 PLAN files carry a parseable `<threat_model>` block,
so this is a *verify-mitigations* audit, not a retroactive-STRIDE reconstruction.
**ASVS level:** 1 (`workflow.security_asvs_level`). Verification depth below is L1/L2 — source
inspection and targeted execution, per the L1 contract. No L3 end-to-end trace audit was performed.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| repository to real export data | Fixtures must never contain a row copied from a real Wargaming export | Account identifiers, order history, balances |
| app to network | Nothing may leave the page after load; the CSP is defence in depth | Any user export data |
| untrusted zip text to formatters | Currency codes, game codes, vehicle ids, month values and battle-type codes are interpolated into sentences | Attacker-controlled cell text |
| untrusted zip text to DOM | Unrecognised and withdrawal premium strings are zip-derived text shown in a list | Attacker-controlled cell text |
| builder to message boundary | Only a fixed-shape view with clamped strings may leave a worker | Aggregated account figures |
| main thread to worker | A data-query message is input to the worker and must be validated | Arbitrary structured-clone payload |
| account file to header | Only the battle count and premium expiry cell may be shown | Account nickname (must never pass) |
| order identifiers | Order ids, coupon names, aggregator names and package lists exist in stored rows and must never be rendered | Purchase metadata |
| IndexedDB snapshot | The rows read must belong to one dataset | Stale/torn answers under a newer export |
| IndexedDB cache to replay | A stored meta record from an older build is re-interpreted on every replay | Wrong status shown as fact |
| view months to SVG | Month spans are bounded by the 1970–2100 window | Untrusted dates driving chart geometry |
| fixture to later tests | The NAME canary and hostile ids are the inputs that let privacy and injection tests fail | Fabricated canaries |
| test seam to production | `setDefaultNumberLocale` must be unreachable from application code | Locale-dependent ordering |
| CI limits to run diagnostics | A shorter outer limit cancels a passing run without context | CI reliability |

---

## Threat Register

69 rows declared across 16 plans: 53 unique STRIDE threats plus 16 per-plan `T-05-SC`
supply-chain rows (one per plan, identical claim, verified once across the whole phase and
recorded below as a single entry). All 69 are disposition `mitigate`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Information disclosure | tests/fixtures/finance-fixtures.ts committing real order ids, coupon names or amounts | high | mitigate | closed — 05-01 | closed |
| T-05-02 | Information disclosure | Account NAME (the nickname) reaching a view row, message, attribute or DOM text | high | mitigate | closed — 05-02 | closed |
| T-05-03 | Tampering | Hostile vehicle ids (markup opener, __proto__) | medium | mitigate | closed — 05-02 | closed |
| T-05-04 | Information disclosure | Real vehicle names or counts committed | high | mitigate | closed — 05-02 | closed |
| T-05-05 | Tampering | resultFromMeta trusting a stored status | medium | mitigate | closed — 05-03 | closed |
| T-05-06 | Information disclosure | A Financial_data folder disappearing from both a card and the Not yet supported list between the classifier change and the section change | medium | mitigate | closed — 05-03 | closed |
| T-05-07 | Denial of service | parsePremium and the decimal parser on hostile cells | medium | mitigate | closed — 05-04 | closed |
| T-05-08 | Denial of service | One crafted date turning a chart into a huge month axis | medium | mitigate | closed — 05-04 | closed |
| T-05-09 | Tampering | Grouping by untrusted keys (currency code, game code, premium string, year) | medium | mitigate | closed — 05-04 | closed |
| T-05-10 | Tampering | Float drift or double rounding in money | high | mitigate | closed — 05-04 | closed |
| T-05-11 | Information disclosure | ORDER_UUID, PAY_COUPON_NAME, PAY_AGGREGATOR_DESC, AA_PACKAGE_LIST or the currency ORDER column reaching a view | high | mitigate | closed — 05-04. **Amended — 05-18:** `CURR_PREMIUM` is no longer listed as a column that must not be read; `buildPremium` now reads it, because a real export writes the premium operation's datetime there and the month bucket cannot be derived without it (UAT G-05-3). Its raw text must still not reach a view (T-05-54), and an unreadable cell must not be silently bucketed on the bulk-migration stamp instead (T-05-55). `UPDATED` remains on the forbidden list. | closed |
| T-05-12 | Information disclosure | The account NAME (the nickname) reaching a view | high | mitigate | closed — 05-05 | closed |
| T-05-13 | Tampering | Vehicle ids or battle-type codes named __proto__ or constructor | medium | mitigate | closed — 05-05 | closed |
| T-05-14 | Denial of service | A hostile huge cell or thousands of distinct battle-type codes | medium | mitigate | closed — 05-05 | closed |
| T-05-15 | Tampering | Misreading an N/D or N/A cell as zero (a wrong claim about the user's data) | medium | mitigate | closed — 05-05 | closed |
| T-05-16 | Information disclosure | Real values entering the shared sample while the fixtures are reshaped | high | mitigate | closed — 05-06 | closed |
| T-05-17 | Tampering | A count constant typed by hand drifting from the data | low | mitigate | closed — 05-06 | closed |
| T-05-18 | Tampering | A malformed or hostile data-query (unknown channel, long battleType, a title that is not an id) | medium | mitigate | closed — 05-07 | closed |
| T-05-19 | Integrity / information disclosure | A stale or torn answer rendered under a newer dataset | high | mitigate | closed — 05-07 | closed |
| T-05-20 | Information disclosure | Error detail carrying a cell (a builder or BigInt message can echo input) | medium | mitigate | closed — 05-07 | closed |
| T-05-21 | Denial of service | A crafted archive with thousands of files in the three folders, or a flood of distinct queries filling the memo | low | mitigate | closed — 05-07 | closed |
| T-05-22 | Denial of service (self) | Simultaneous blocks starving each other through the client | medium | mitigate | closed — 05-07 | closed |
| T-05-12b | Information disclosure | Account NAME, ORDER_UUID, coupon, aggregator or package text in any reply | high | mitigate | closed — 05-07 | closed |
| T-05-23 | Tampering | A formatter interpolating untrusted text into markup | medium | mitigate | closed — 05-08 | closed |
| T-05-24 | Tampering | Application code reaching the locale test seam and changing grouping for the user | low | mitigate | closed — 05-08 | closed |
| T-05-25 | Information disclosure | A copy string or formatter that would name the account nickname, an order id or a coupon | high | mitigate | closed — 05-08 | closed |
| T-05-26 | Denial of service | A chart whose month span or row count makes the SVG or the table enormous | medium | mitigate | closed — 05-09 | closed |
| T-05-27 | Tampering (self) | A stale scroll offset after a filter shrinks the list, rendering an empty window that reads as "no data" | low | mitigate | closed — 05-09 | closed |
| T-05-28 | Tampering | A locale-dependent comparison giving two users two orders for one export | low | mitigate | closed — 05-09 | closed |
| T-05-29 | Tampering | A crafted PREMIUM string rendered as markup or into an attribute | high | mitigate | closed — 05-10 | closed |
| T-05-30 | Integrity | A previous dataset's premium numbers shown under a new export | high | mitigate | closed — 05-10 | closed |
| T-05-31 | Information disclosure | The worker's error detail rendered | medium | mitigate | closed — 05-10 | closed |
| T-05-32 | Denial of service | A chart or table whose node count scales with rows or a huge month span | medium | mitigate | closed — 05-11 | closed |
| T-05-33 | Tampering | Markup or an inline style injected through a cell name, a data attribute or a tooltip line | medium | mitigate | closed — 05-11 | closed |
| T-05-34 | Information disclosure | Order ids, coupon names or the nickname appearing in the chart or tooltip | high | mitigate | closed — 05-11 | closed |
| T-05-35 | Tampering | A vehicle id carrying markup (the fixture's unterminated bold tag) or a very long unbroken string | high | mitigate | closed — 05-12 | closed |
| T-05-36 | Denial of service | A list of thousands of rows rendered whole | medium | mitigate | closed — 05-12 | closed |
| T-05-37 | Integrity | A slower answer for an earlier title overwriting a later choice | medium | mitigate | closed — 05-12 | closed |
| T-05-38 | Tampering | An inline style needed for window geometry violating the CSP | medium | mitigate | closed — 05-12 | closed |
| T-05-12c | Information disclosure | The account nickname or balances reaching the page | high | mitigate | closed — 05-12 | closed |
| T-05-39 | Tampering | A currency code or title carrying markup, or a code used to build a selector | medium | mitigate | closed — 05-13 | closed |
| T-05-40 | Denial of service | Many currencies or a very long history inflating the SVG | medium | mitigate | closed — 05-13 | closed |
| T-05-41 | Information disclosure (misleading) | Colour as the only cue between deposits and withdrawals (the two hues are 1.36:1 apart) | low | mitigate | closed — 05-13 | closed |
| T-05-42 | Tampering | A battle-type code or expiry text carrying markup, used in data-code or an option | medium | mitigate | closed — 05-14 | closed |
| T-05-43 | Information disclosure | The account NAME or a balance appearing in the header | high | mitigate | closed — 05-14 | closed |
| T-05-44 | Tampering (misleading) | A summed or invented per-ship total across Warships battle types, or N/D shown as 0 | medium | mitigate | closed — 05-14 | closed |
| T-05-45 | Tampering (misleading) | A blended, converted or grand total appearing anywhere | high | mitigate | closed — 05-15 | closed |
| T-05-46 | Tampering | A game code or currency value carrying markup, or very long unbroken text | medium | mitigate | closed — 05-15 | closed |
| T-05-47 | Information disclosure | Order ids, coupon names, aggregator names or package text reaching the page | high | mitigate | closed — 05-15 | closed |
| T-05-48 | Integrity | A stale spend view under a new export | high | mitigate | closed — 05-15 | closed |
| T-05-49 | Information disclosure | A Phase 5 interaction (chart hover, picker, breakdown, replace) causing a request or a CSP violation | high | mitigate | closed — 05-16 | closed |
| T-05-50 | Denial of service (CI) | The raised test count exceeding the e2e limits so a passing suite is cancelled with no context | medium | mitigate | closed — 05-16 | closed |
| T-05-51 | Denial of service (self) | A 50,000-row import freezing the page | medium | mitigate | closed — 05-16 | closed |
| T-05-SC | Tampering | npm/pip/cargo installs (any plan in the phase) | high | mitigate | `git diff --quiet -- package.json pnpm-lock.yaml` exits 0 for every plan in the phase — verified empty across `main..HEAD` (05-01 through 05-16). No dependency was added in Phase 5. | closed |

*Status: open · closed*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Severity distribution

| Severity | Count |
|----------|-------|
| high | 36 |
| medium | 27 |
| low | 6 |
| **Total** | **69** |

*(Counts are the 69 rows as declared across the 16 plans, including all 16 `T-05-SC` rows.
The register table above collapses those 16 identical rows into one, so it lists 54 entries:
53 unique STRIDE threats + 1 `T-05-SC`.)*

---

## Verification Evidence

Threats were not accepted on the strength of the plan text. Each load-bearing claim was checked
against the implementation as committed.

| Threat(s) | Claim | Evidence | Result |
|-----------|-------|----------|--------|
| T-05-SC (×16) | No package installed in any plan | `git diff --stat main..HEAD -- package.json pnpm-lock.yaml` → empty | closed |
| T-05-01 | Order ids fabricated, cells canaried | `tests/fixtures/finance-fixtures.ts:161-167` — `CANARY-COUPON`/`CANARY-AGGREGATOR`/`CANARY-PACKAGE`, orderId `00000000-0000-0000-0000-000000000000`; asserted by `tests/unit/finance-fixtures.test.ts` | closed |
| T-05-02, T-05-43 | Account NAME never reaches a view | `STATS_NAME_CANARY` in `tests/fixtures/player-stats-fixtures.ts:71`; Proxy read-recording tests in `tests/unit/vehicle-stats.test.ts`, `tests/unit/finance.test.ts` | closed |
| T-05-07, T-05-14 | Length caps before parsing / on output | `MAX_STORED_STRING = 200`, `MAX_LISTED_UNRECOGNISED = 20` (`src/lib/finance-shared.ts:79,90`); digit-length rejection `src/lib/decimal.ts:128` | closed |
| T-05-08 | Date window bounds the month axis | `MIN_MONTH_YEAR = 1970`, `MAX_MONTH_YEAR = 2100` (`src/lib/finance-shared.ts:66,69`) | closed |
| T-05-09, T-05-13, T-05-39 | `__proto__` treated as an ordinary key | `__proto__` rows present in `tests/fixtures/finance-fixtures.ts:485,588` and `player-stats-fixtures.ts:238` as trap inputs; grouping is Map-based | closed |
| T-05-10 | Money math free of float drift | `MICRO_SCALE = 6`, `UNITS_PER_WHOLE = 10n ** 6n`, integer-string sums (`src/lib/decimal.ts:68-74`) | closed |
| T-05-18 | Malformed data-query rejected before builders | `isDataQuery` (`src/lib/worker/data-queries.ts:181`) enforced at `src/lib/worker/ingest.worker.ts:228`; fixed detail `'invalid query'` | closed |
| T-05-19 | meta + rows read as one snapshot | `db.transaction('r', db.rows, db.meta, ...)` (`src/lib/worker/db.ts:414`) | closed |
| T-05-20 | Error detail cannot echo a cell | `detail: err instanceof Error ? err.name : 'Error'` — message to console only (`src/lib/worker/ingest.worker.ts:295-300`) | closed |
| T-05-21 | Bounded files and memo | `MAX_PRESENCE_FILES = 500` (`src/lib/worker/db.ts:128`); `MAX_MEMO_ENTRIES = 16` with eviction (`src/lib/worker/data-queries.ts:258,312`) | closed |
| T-05-23, T-05-29, T-05-33, T-05-35, T-05-38, T-05-39, T-05-42, T-05-46 | No raw-HTML or inline-style injection | `svelte/no-at-html-tags: 'error'` (`eslint.config.js:191`); zero `{@html}` and zero `style=` attributes in `src/**/*.svelte`; contract tests in `tests/unit/lint-guards.test.ts` | closed |
| T-05-30, T-05-48, T-05-19 | Stale answers dropped on dataset change | `acceptDataOutcome` returns `null` on superseded or mismatched `importedAt` (`src/lib/finance-state.ts:171-180`; mirrored in `vehicle-state.ts`) | closed |
| T-05-38, T-05-49 | CSP blocks inline styles / egress | Build-time meta injection `vite.config.ts:60` → `default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`, with **no** `style-src 'unsafe-inline'`; asserted in `dist/index.html:4` and `tests/e2e/zero-network.spec.ts:73` | closed |
| T-05-49 | Phase 5 flows cause no request or CSP violation | `tests/e2e/zero-network.spec.ts:181` — every Phase 5 flow, `securitypolicyviolation` listener at lines 102 and 198 | closed |
| T-05-50 | CI limits ordered so diagnostics fire first | `tests/unit/ci-budget.test.ts` — `globalTimeout ≥ 1.3×` projected e2e duration; wrapper outlives `globalTimeout` by ≥ 90 s | closed |

### Test-suite state (independently re-run, not assumed)

| Gate | Command | Result |
|------|---------|--------|
| Unit | `pnpm exec vitest run --maxWorkers=2` | **46/46 files, 1333/1333 tests pass** |
| Security-critical unit subset | `vitest run finance vehicle-stats lint-guards data-query-worker finance-fixtures` | 5/5 files, 164/164 pass |
| E2E (inventory) | `pnpm exec playwright test --list` | 184 tests in 16 files |
| Type-check | `pnpm run check` | clean |
| Lint + format | `pnpm run lint` | clean (Prettier + ESLint) |

> Note on a transient observation: an initial unconstrained `pnpm run test:unit` aborted with
> `Worker exited unexpectedly with signal SIGKILL` on `tests/unit/webserver-teardown.test.ts`.
> That file passes in isolation and the full suite is green at `--maxWorkers=2`, so this is
> sandbox worker pressure (46 forks), **not** a product defect and **not** a threat finding.

---

## Accepted Risks Log

No accepted risks.

Every declared threat is disposition `mitigate` and every mitigation was located in the
implementation. Nothing was waived, transferred, or deferred.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-02 | 69 | 69 | 0 | gsd-security-auditor (via gsd-secure-phase, ASVS L1) |

---

## Residual Risk / Limits of This Audit

Stated plainly so the next run does not over-read this document:

1. **Depth is ASVS L1.** Mitigation *presence* was verified by source inspection and targeted test
   execution. Per the workflow's L1 contract, no L3 end-to-end trace audit was performed, so a
   mitigation that exists but is bypassable on an untested path is not ruled out by this document.
2. **Register completeness is inherited, not re-derived.** Per the workflow's
   `register_authored_at_plan_time: true` constraint, this audit verified the 69 declared rows and
   did **not** scan for threats the plans never declared.
3. **E2E was inventoried, not executed.** All 184 tests were listed and the CSP meta tag was
   confirmed in the built `dist/index.html`; the full Playwright run was not re-executed here
   (it is the `/gsd-validate-phase` gate's job). The briefing's green-suite claim was independently
   confirmed for the unit, type-check and lint gates.
4. **T-05-SC is verified once, not 16 times.** The 16 per-plan supply-chain rows assert the same
   claim; it is checked phase-wide with `git diff main..HEAD -- package.json pnpm-lock.yaml`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer) — 69/69 `mitigate`
- [x] Accepted risks documented in Accepted Risks Log — none to document
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-02

---

## Post-UAT amendments (plan 05-18)

Plan 05-18 closes UAT gap G-05-3 and raises two threats the audit above could not have declared,
because the audit ran against a build that never read `CURR_PREMIUM`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-54 | Information disclosure | `buildPremium` now reads `CURR_PREMIUM`, a column T-05-11 previously forbade | medium | mitigate | The column is a timestamp, not an identifier, and it is read only through `monthOfTimestamp`, so only the month integer is kept. The unrecognised-string list is fed from `PREMIUM` alone. A privacy test serialises the whole premium view and asserts no `CURR_PREMIUM` cell text appears in it, keeps `UPDATED` on the forbidden list with a live positive control on the watched rows, and keeps the one-key-listing assertion. | closed by 05-18 (Task 1 privacy test) |
| T-05-55 | Tampering (misleading figure) | The date-column choice in `buildPremium` | medium | mitigate | The column is decided once per file, and a row whose `CURR_PREMIUM` cannot be read in a `CURR_PREMIUM`-dated file is excluded and counted rather than bucketed on the bulk `CREATED` stamp. Pinned by the hand key, the independent oracle (its own date reader, its own rule), the three file-level cases and the bulk-month-absent assertions in both fixtures and in the browser. The 1970-2100 year window that bounds the axis at 1,572 months still applies to the new column (T-05-08). | closed by 05-18 (Task 1 file-level tests, Task 2 browser test) |

**Audit totals above are intentionally NOT recomputed here.** The counts in the frontmatter, the
severity table and the sign-off describe the 05-01..05-17 audit run; this section is an addendum, not
a re-audit. The next security re-audit for this phase should fold these two rows into the register and
re-derive the totals.
