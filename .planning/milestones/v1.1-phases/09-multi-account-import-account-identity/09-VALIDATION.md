---
phase: "9"
slug: multi-account-import-account-identity
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-16"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `09-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit, fake IndexedDB) and Playwright (e2e) |
| **Config file** | repo-root vitest config; `playwright.config.ts` |
| **Quick run command** | `pnpm run test:unit -- tests/unit/import/classify.test.ts tests/unit/import/ingest-worker.test.ts` |
| **Full suite command** | `pnpm run test:unit && pnpm exec playwright test` |
| **Static gates** | `pnpm run check` (tsc and svelte-check), `pnpm run lint` (prettier and eslint) |
| **Estimated runtime** | quick ~20 s, unit ~2 min, full e2e within the 30 min CI budget (raised from 29 in 09-06 Task 3) |

---

## Sampling Rate

- **After every task commit:** the touched unit file, e.g. `pnpm run test:unit -- tests/unit/import/classify.test.ts`
- **After every plan wave:** `pnpm run test:unit`
- **Before `/gsd-verify-work`:** `pnpm run test:unit && pnpm exec playwright test`, plus `pnpm run check` and `pnpm run lint`, all green
- **Max feedback latency:** 120 seconds for unit; e2e only at the phase gate and on the plans that touch the shell

---

## Per-Task Verification Map

Filled by the planner (plan-phase, 2026-10-16). Every task carries an `<automated>` command with a `<fails_when>` signal; the requirement-level coverage comes first and the per-task map follows it.

Requirement-level coverage:

| Req | Behaviour | Type | Command |
|-----|-----------|------|---------|
| ACCOUNT-01 | 1/2/3-root, wrapped, and real-shape (loose PDFs) zips classify; stray folder and top-level category beside roots still fail; 32-root cap and 128-character root-name bound fail closed (D-20) | unit + e2e | `pnpm run test:unit -- tests/unit/import/classify.test.ts`; `pnpm exec playwright test tests/e2e/import/import-failure.spec.ts` |
| ACCOUNT-02 | Root without User_Info gets an ID-only identity; per-root pools; every pane opens (keyed-each fix) | unit | `pnpm run test:unit -- tests/unit/import/ingest-worker.test.ts` |
| ACCOUNT-03 | Reload, identical-zip duplicate, replace leaves no old rows; Dexie `verno` stays 2 | unit + e2e | `pnpm run test:unit -- tests/unit/import/replay-reclassify.test.ts tests/unit/import/db.test.ts` |
| ACCOUNT-05 | Header lists every account: ID, games, years, D-16 order, "No activity recorded" | unit + e2e | `pnpm run test:unit -- tests/unit/import/ingest-worker.test.ts`; `pnpm exec playwright test tests/e2e/shell/identity-privacy.spec.ts` |
| ACCOUNT-08 | Clear and Start Over remove every account; 1/2/3-root fixtures pass import, reload, replace, clear | unit + e2e | `pnpm run test:unit -- tests/unit/import`; `pnpm exec playwright test tests/e2e/import/persistent-dataset.spec.ts` |
| SC4 / D-18 | No email or birth date in IndexedDB or DOM for any root; unsupported-category rows not stored by a new import | unit + e2e | `pnpm run test:unit -- tests/unit/import/ingest-worker.test.ts`; `pnpm exec playwright test tests/e2e/shell/identity-privacy.spec.ts` |
| SC4 / D-21 | A returning v1.0 cache is purged of unknown and known-deferred rows on load (check-cache): canaries gone from the whole dump, supported rows (any casing) and meta untouched, idempotent, `verno` 2 | unit | `pnpm exec vitest run tests/unit/import/multi-account-lifecycle.test.ts tests/unit/import/db.test.ts tests/unit/import/replay-reclassify.test.ts` |
| SC5 | Zero network requests through a multi-account import | e2e | `pnpm exec playwright test tests/e2e/guards/zero-network.spec.ts` |
| Budget | Measured baseline 256 listed e2e tests in 27 files (D-23) — corrected by measurement in 09-06 Task 3, which found even that figure to predate plan 09-04's spec file: the count Phase 9 started from is 257 in 28 files and it ends at 258 in 28. The two long tests are priced as one block (E = 1360 s, floor 1768 s), so all three CI limits moved together to 30 / 32 / 40 min with a 262-test ceiling, and the stale figures in the guard comment and this file are reconciled | unit | `pnpm run test:unit -- tests/unit/guards/ci-budget.test.ts` |

Per-task map (the commands are the plans' own `<automated>` commands, run from the repository root):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-T1 | 01 | 1 | ACCOUNT-01, -02, -08 | T-09-01 | Real-shape three-root zip classifies; per-file owner agrees with category counts | unit | `pnpm exec vitest run tests/unit/import/classify.test.ts -t "Phase 9 tracer"` | W0 (new fixture module) | ✅ green |
| 09-01-T2 | 01 | 1 | ACCOUNT-01, -08 | T-09-01..05 | Stray folder, top-level category, wrapper, collision, cap and name bound (both sanctioned by D-20) fail closed; v1.0 reasons pinned | unit | `pnpm exec vitest run tests/unit/import/classify.test.ts tests/unit/guards/sample-export-shape.test.ts` | exists | ✅ green |
| 09-02-T1 | 02 | 2 | ACCOUNT-02, -03, -05 | T-09-08, T-09-10 | Every row stamped; identity per root; ordered accounts stored and replayed | unit | `pnpm exec vitest run tests/unit/import/multi-account-import.test.ts tests/unit/import/account-summary.test.ts tests/unit/import/db.test.ts` | W0 (new tests) | ✅ green |
| 09-02-T2 | 02 | 2 | ACCOUNT-02 | T-09-06, T-09-07 | Unsupported-category rows counted, never stored by a new import (returning caches: 09-03-T3); per-root canaries absent | unit | `pnpm exec vitest run tests/unit/import/ingest-worker.test.ts tests/unit/import/multi-account-import.test.ts tests/unit/import/device-info-worker.test.ts tests/unit/import/logins-sources.test.ts` | exists | ✅ green |
| 09-02-T3 | 02 | 2 | ACCOUNT-01, -02, -05 | T-09-09, T-09-01 | Edge matrix on import path; stray folder shows the one banner | unit + e2e | `pnpm exec vitest run tests/unit/import/multi-account-import.test.ts && pnpm exec playwright test tests/e2e/import/import-failure.spec.ts` | exists | ✅ green |
| 09-03-T1 | 03 | 3 | ACCOUNT-03 | T-09-14 | Deleted aggregates rebuilt identically with account-level grouping | unit | `pnpm exec vitest run tests/unit/import/multi-account-lifecycle.test.ts tests/unit/import/logins-backfill.test.ts tests/unit/import/logins-worker.test.ts tests/unit/import/logins-sources.test.ts tests/unit/import/data-query-worker.test.ts` | W0 (new tests) | ✅ green |
| 09-03-T2 | 03 | 3 | ACCOUNT-03 | T-09-13 | Account record only for one account; merging channels answer over all accounts | unit | `pnpm exec vitest run tests/unit/import/multi-account-lifecycle.test.ts tests/unit/import/logins-backfill.test.ts tests/unit/import/data-query-worker.test.ts tests/unit/import/db-rows-by-file.test.ts` | exists | ✅ green |
| 09-03-T3 | 03 | 3 | ACCOUNT-03, -08 | T-09-12, T-09-16, T-09-17 | Reload, duplicate, replace, clear, abort and v1.0 cache for 1, 2 and 3 accounts; returning v1.0 cache purged of unsupported-category rows on load via `purgeUnsupportedCategoryRows` (D-21), supported rows and meta untouched, idempotent; verno 2 | unit | `pnpm exec vitest run tests/unit/import/multi-account-lifecycle.test.ts tests/unit/import/db.test.ts tests/unit/import/replay-reclassify.test.ts` | exists | ✅ green |
| 09-04-T1 | 04 | 3 | ACCOUNT-05 | T-09-18, T-09-19, T-09-20 | Header lists three rows in order; nothing leaked, fresh and after reload | e2e | `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/shell/identity-privacy.spec.ts` | W0 (new spec) | ✅ green |
| 09-04-T2 | 04 | 3 | ACCOUNT-05 | T-09-18, T-09-19 | Copy, view model, header source contract | unit | `pnpm exec vitest run tests/unit/shell/ui-copy.test.ts tests/unit/shell/identity-model.test.ts tests/unit/shell/identity.test.ts` | W0 (new tests) | ✅ green |
| 09-05-T1 | 05 | 4 | ACCOUNT-02, -05 | T-09-21, T-09-22 | Every pane opens; combined caption on six panes; keyed lists by position (steps appended to the 09-04 test) | e2e | `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/vehicles/vehicle-stats.spec.ts` | exists after 09-04 | ✅ green |
| 09-05-T2 | 05 | 4 | ACCOUNT-05 | T-09-21 | Account row and Overview card name the accounts; one account unchanged | unit | `pnpm exec vitest run tests/unit/shell/overview-model.test.ts tests/unit/shell/selection-state.test.ts tests/unit/shell/dashboard-status.test.ts` | exists | ✅ green |
| 09-05-T3 | 05 | 4 | ACCOUNT-02, -08 | T-09-22 | Keyed-each source guard, repeated-value data, audited key list | unit | `pnpm exec vitest run tests/unit/import/multi-account-keys.test.ts tests/unit/vehicles/vehicle-blocks.test.ts` | W0 (new test) | ✅ green |
| 09-06-T1 | 06 | 5 | ACCOUNT-03, -08 | T-09-23 | One dataset survives reload, duplicate, replace, clear and Start Over (second and last new listed e2e test) | e2e | `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts` | exists after 09-05 | ✅ green |
| 09-06-T2 | 06 | 5 | ACCOUNT-01, -05 | T-09-24 | Zero requests through a three-account replace and every pane (stage of the Phase 5 flow); 375px step holds long text | e2e | `pnpm exec playwright test tests/e2e/guards/zero-network.spec.ts tests/e2e/shell/multi-account.spec.ts` | exists | ✅ green |
| 09-06-T3 | 06 | 5 | ACCOUNT-08 | T-09-25 | Listed e2e count 258 in 28 files (D-23's planning figure of 256 in 27 predates 09-04's spec file; Phase 9 started from 257 in 28); the long tests priced as one block in the guard; all three CI limits raised together to 30 / 32 / 40 min, which the priced projection required | unit | `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | exists | ✅ green |

| 09-07-T1 | 07 | 6 (gap) | ACCOUNT-02, -08 | T-09-26 | Per-account grouping in the reader; a divergent-header two-root archive resolves each account's own columns | unit | `pnpm exec vitest run tests/unit/import/multi-account-import.test.ts tests/unit/import/multi-account-lifecycle.test.ts` | W1 (new fixture) | ✅ green |
| 09-07-T2 | 07 | 6 (gap) | ACCOUNT-02 | T-09-26 | Every merged consumer resolves columns per group and reads each row through its own group's keys; no union key map; `no-usable` only when every group resolves nothing | unit | `pnpm exec vitest run tests/unit/vehicles tests/unit/finance tests/unit/features` | W1 (new tests) | ✅ green |
| 09-07-T3 | 07 | 6 (gap) | ACCOUNT-02, -03 | T-09-26 | The `db.ts` docstring states the per-account rule and no longer claims merging changes no parse | unit | `pnpm exec vitest run tests/unit/import/db.test.ts tests/unit/import/data-query-worker.test.ts` | exists | ✅ green |
| 09-08-T1 | 08 | 6 (gap) | ACCOUNT-05 | T-09-28 | 4px row-gap under the combined caption; `master-detail-nav.spec.ts`'s anchored `/^From …/` matcher untouched | e2e | `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/shell/master-detail-nav.spec.ts` | exists after 09-04/05 | ✅ green |
| 09-08-T2 | 08 | 6 (gap) | ACCOUNT-05 | T-09-28 | The id-only account row takes the Label role by sharing the existing `.account-id` selector; UI-SPEC amended in the same commit | unit + e2e | `pnpm exec vitest run tests/unit/shell/identity-model.test.ts` | exists | ✅ green |
| 09-08-T3 | 08 | 6 (gap) | ACCOUNT-02, -08 | T-09-22 | The repeated-key scan walks every pane in `PANE_IDS`, not only Vehicles; exclusions live at one named reader | e2e | `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts` | exists after 09-05 | ✅ green |
| 09-09-T1 | 09 | 6 (gap) | ACCOUNT-02, -03 | T-09-29 | Rebuild and replay agree on the account count and root; `accountsOfMeta` is the only count | unit | `pnpm exec vitest run tests/unit/import/logins-sources.test.ts tests/unit/import/multi-account-lifecycle.test.ts` | exists | ✅ green |
| 09-09-T2 | 09 | 6 (gap) | ACCOUNT-05 | T-09-30 | A partial stored account record still builds a row; no year renders as `null`, never the literal "undefined" | unit | `pnpm exec vitest run tests/unit/shell/identity-model.test.ts tests/unit/import/account-summary.test.ts` | exists | ✅ green |
| 09-09-T3 | 09 | 6 (gap) | — | T-09-SC | The CI comment guard reads the workflow RAW (not `activeWorkflowLines`, which strips comment lines) and matches the anchored `globalTimeout (N min)` sentence exactly once; dated "Raised from …" history left byte-identical | unit | `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | exists | ✅ green |
| 09-10-T1 | 10 | 6 (gap) | — | — | The account-count semantics decision is recorded as the SUMMARY's first line before any source change (blocking-human checkpoint) | — | MISSING — Wave 0: the decision record itself is the artefact; `head -1 .planning/phases/09-multi-account-import-account-identity/09-10-SUMMARY.md` | W1 (decision) | ✅ green |
| 09-10-T2 | 10 | 6 (gap) | ACCOUNT-05, -08 | T-09-31, T-09-32 | One projection publishes the accounts that hold data; `hasData` optional and absent-means-has-data; the Account-record gate still reads the FULL root list; Dexie stays `version(2)` | unit | `pnpm exec vitest run tests/unit/import/multi-account-import.test.ts tests/unit/import/db.test.ts` | exists | ✅ green |
| 09-10-T3 | 10 | 6 (gap) | — | — | The decision's reach is recorded as a dated amendment in VERIFICATION.md, with the original findings left intact | unit | `pnpm exec vitest run tests/unit/shell/identity-model.test.ts` | exists | ✅ green |
| 09-11-T1 | 11 | 7 (gap) | ACCOUNT-05, -08 | T-09-31 | One root count (`rootCountOf`/`hasMultipleRoots`) drives the header variant; a two-folder archive with one data-less folder keeps the multi header; done, cache-status and duplicate counts agree; `isMultiAccount` gone | unit | `pnpm exec vitest run tests/unit/import/multi-account-import.test.ts tests/unit/shell/identity-model.test.ts tests/unit/import/multi-account-lifecycle.test.ts tests/unit/import/db.test.ts` | exists | ✅ green |
| 09-11-T2 | 11 | 7 (gap) | ACCOUNT-05 | T-09-31 | Account list row, Overview card and title copy follow the same rule; `formatAccountCount(1)` singular | unit | `pnpm exec vitest run tests/unit/shell` | exists | ✅ green |
| 09-11-T3 | 11 | 7 (gap) | ACCOUNT-05, -08 | T-09-31 | One-account replace step holds the multi header inside the lifecycle e2e; 258 tests in 28 files; UI-SPEC amended | e2e + unit | `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts`; `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | exists | ✅ green |

Phase gate (re-run after gap closure): `pnpm run test:unit && pnpm exec playwright test --list && pnpm run check && pnpm run lint` — 3135 unit passed in 96 files, 258 listed tests in 28 files, 0 errors, lint clean.

Phase gate (run at the end of plan 06): `pnpm run test:unit && pnpm exec playwright test && pnpm run check && pnpm run lint && pnpm run build && git diff --exit-code b4e7f31 -- package.json pnpm-lock.yaml`.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/fixtures/multi-account-fixtures.ts` — one-, two-, three-root builders; stray folder; top-level category; wrapper; real-shape with loose PDFs; root without User_Info; per-root PII canaries (ACCOUNT-08)
- [x] `tests/unit/import/classify.test.ts` — flip the four `no-single-root` multi-root assertions and add the new cases
- [x] `tests/unit/import/ingest-worker.test.ts` — per-root identity, no-leak, replay, rebuild equality for N roots
- [x] `tests/unit/import/db.test.ts` — `account` and `accounts` round-trip, `clearData`, `purgeUnsupportedCategoryRows` casing and idempotence matrix (D-21)
- [x] `tests/unit/import/multi-account-lifecycle.test.ts` — rebuild equality and the returning v1.0 cache purge on load, canaries from `multi-account-fixtures.ts` (D-21)
- [x] A unit test that feeds each merged reader duplicate keys and asserts unique each-keys (VehicleTable, BattleTypeSummary)
- [x] Framework install: none

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Import the user's real 3-account zip (`2026-10-14.zip`) and read the header | ACCOUNT-01, ACCOUNT-05 | The real file is private and must not be committed | Drop it on the running app; confirm three account rows, no failure banner, no email/birth date visible |
| Account rows at 480px with long nickname/ID | ACCOUNT-05 | Layout judgement | Phone viewport, three accounts, no horizontal scroll |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120 s for unit checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-10-17 — 16 of 16 task rows green, no gaps found. Two manual-only verifications remain open (the user's real three-account zip, and the 480px layout judgement); the optional read-only check against that private archive was denied by the environment and is recorded as unrun in `09-06-SUMMARY.md` and `.planning/WINDOWS.md` (entry 12), so nothing is claimed about it.

## Validation Audit

| Check | Result |
|-------|--------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

## Validation Audit 2026-10-17

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

## Validation Audit 2026-10-18

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Gap plans audited | 4 |
| Task rows added | 12 |

## Validation Audit 2026-10-18 (re-audit)

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Gap plans audited | 1 (09-11) |
| Task rows added | 3 |
