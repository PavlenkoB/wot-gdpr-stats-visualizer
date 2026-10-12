---
phase: "02"
slug: "defensive-parsing-persistent-dataset"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-28"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^5.0.2 (unit, `environment: 'node'`), Playwright ^1.63.0 (e2e, built app only) |
| **Config file** | `vitest.config.ts` (unit), `playwright.config.ts` (e2e) |
| **Quick run command** | `pnpm test:unit` |
| **Full suite command** | `pnpm test:unit && pnpm build && pnpm test:e2e` |
| **Estimated runtime** | ~30 seconds (unit), ~2-3 minutes (full suite with build + e2e) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit`
- **After every plan wave:** Run `pnpm test:unit && pnpm build && pnpm test:e2e`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-TBD | TBD | TBD | IMPORT-01 | — | Full unzip + parse of every CSV, all work in worker | unit + e2e | `pnpm test:unit` (parse logic), `pnpm test:e2e` (worker-only assertion, mirrors Phase 1's pattern) | ❌ W0 | ⬜ pending |
| 02-TBD | TBD | TBD | IMPORT-03 | — | CRLF/bare-CR, missing/extra columns tolerated | unit | `vitest run tests/unit/csv-parse.test.ts` | ❌ W0 | ⬜ pending |
| 02-TBD | TBD | TBD | IMPORT-04 | — | Mojibake correction, no corruption of correct text | unit | `vitest run tests/unit/mojibake.test.ts` | ❌ W0 | ⬜ pending |
| 02-TBD | TBD | TBD | IMPORT-06 | — | Hash-dedup skip before unzip; replace on new hash | unit (hash logic) + e2e (re-drop same/different zip) | `vitest run tests/unit/hash.test.ts`, `pnpm test:e2e` | ❌ W0 | ⬜ pending |
| 02-TBD | TBD | TBD | DATA-01 | T: Information Disclosure (unencrypted-at-rest cache) | Dexie bulkPut cache, survives reload | unit (fake-indexeddb) + e2e (reload assertion) | `vitest run tests/unit/db.test.ts` | ❌ W0 | ⬜ pending |
| 02-TBD | TBD | TBD | DATA-02 | T: Information Disclosure (mitigation) | "Clear my cached data" wipes IndexedDB | unit + e2e | `vitest run tests/unit/db.test.ts`, `pnpm test:e2e` | ❌ W0 | ⬜ pending |

*Task IDs, plan numbers, and waves are TBD — the planner fills these in when it assigns tasks to plans.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/setup.ts` — add `import 'fake-indexeddb/auto'` before any Dexie import, so every Node-based unit test gets a working `indexedDB` global
- [ ] `src/lib/worker/db.ts` — new Dexie schema module (does not exist yet)
- [ ] `src/lib/worker/csv-parse.ts`, `mojibake.ts`, `hash.ts` — new pure-function modules, each needing a dedicated `tests/unit/*.test.ts`
- [ ] `tests/fixtures/export-fixtures.ts` — new fixture builders needed: a mojibake/Cyrillic-content fixture (byte-level, matching PROJECT.md's documented real-sample encoding bug) and a "10x sample size" fixture distinct from `buildLargeExport()`'s 20k-tiny-file responsiveness fixture (SC1 wants realistic row *content* at 10x scale, not just file count)
- [ ] Framework install: `pnpm add -D fake-indexeddb` (gated behind `checkpoint:human-verify` per package-legitimacy protocol)

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification per the map above (unit + e2e).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
