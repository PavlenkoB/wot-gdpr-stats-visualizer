---
phase: "10"
slug: "merged-dashboard-across-accounts"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-18"
---

# Phase 10 - Validation Strategy

> Per-phase validation contract. Full requirement-to-test map: `10-RESEARCH.md` section "Validation Architecture".

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^5.0.2 (unit, Node env) + Playwright ^1.63.0 (e2e) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm run test:unit -- tests/unit/playtime tests/unit/vehicles tests/unit/logins tests/unit/finance tests/unit/shell` |
| **Full suite command** | `pnpm run test:unit && pnpm exec playwright test` |
| **Estimated runtime** | unit ~37 s; e2e ~23 min |

## Sampling Rate

- **After every task commit:** the touched unit file(s)
- **After every plan wave:** `pnpm run test:unit`, `pnpm run check`, `pnpm run lint`
- **Before `/gsd-verify-work`:** full unit + e2e green
- **Max feedback latency:** 60 seconds (unit)

## Per-Task Verification Map

Filled by the planner (2026-10-18). Every task is a tracer or an expansion task with its own automated command; the shared gates after each task are `pnpm run check` and the touched unit files. Plans are strictly sequential (waves 1 to 6) because they share `ui-copy.ts` and `multi-account.spec.ts`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | ACCOUNT-04, ACCOUNT-06 | T-10-01, T-10-03 | unit (worker harness) | `pnpm run test:unit -- tests/unit/playtime/playtime-multi-account.test.ts tests/unit/import/ingest-worker.test.ts` | created by the task | pending |
| 10-01-02 | 01 | 1 | ACCOUNT-04, ACCOUNT-06 | T-10-01, T-10-02, T-10-03 | unit (worker + pure) | `pnpm run test:unit -- tests/unit/playtime` then `pnpm run test:unit` | extends 10-01-01 | pending |
| 10-02-01 | 02 | 2 | ACCOUNT-06 | T-10-04, T-10-05, T-10-06, T-10-07 | unit + e2e step | `pnpm run test:unit -- tests/unit/shell tests/unit/playtime tests/unit/guards tests/unit/import/multi-account-keys.test.ts` and `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts -g "three-account dataset"` | `game-filter-state.test.ts` created by the task | pending |
| 10-02-02 | 02 | 2 | ACCOUNT-06 | T-10-04 | unit + e2e step | `pnpm run test:unit -- tests/unit/playtime tests/unit/shell` and `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts` | extends | pending |
| 10-02-03 | 02 | 2 | ACCOUNT-06 | T-10-04, T-10-06 | e2e step | `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/vehicles` | extends | pending |
| 10-03-01 | 03 | 3 | ACCOUNT-06 | T-10-08, T-10-09, T-10-10 | unit + e2e step | `pnpm run test:unit -- tests/unit/shell tests/unit/vehicles tests/unit/guards` and `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/vehicles` | `identity-model` tests extended | pending |
| 10-03-02 | 03 | 3 | ACCOUNT-04 | T-10-10, T-10-11 | unit + e2e step (3 pins flip) | `pnpm run test:unit -- tests/unit/vehicles tests/unit/import/multi-account-keys.test.ts tests/unit/import/multi-account-lifecycle.test.ts` and `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/vehicles` | extends | pending |
| 10-03-03 | 03 | 3 | ACCOUNT-06 | T-10-08 | unit + e2e (+ human check at 375px) | `pnpm run test:unit -- tests/unit/vehicles tests/unit/shell` and `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/shell/identity-privacy.spec.ts tests/e2e/vehicles` | extends | pending |
| 10-04-01 | 04 | 4 | ACCOUNT-06, ACCOUNT-07 | T-10-12, T-10-14, T-10-15 | unit + e2e step | `pnpm run test:unit -- tests/unit/logins tests/unit/shell tests/unit/import/logins-backfill.test.ts tests/unit/import/logins-sources.test.ts tests/unit/import/multi-account-keys.test.ts` and `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/logins` | extends | pending |
| 10-04-02 | 04 | 4 | ACCOUNT-07 | T-10-12, T-10-13, T-10-14 | unit (worker) + e2e (+ human check) | `pnpm run test:unit` and `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/logins` | extends | pending |
| 10-05-01 | 05 | 5 | ACCOUNT-04, ACCOUNT-06 | T-10-17, T-10-18 | unit + e2e step | `pnpm run test:unit -- tests/unit/finance tests/unit/shell tests/unit/import/multi-account-keys.test.ts` and `pnpm exec playwright test tests/e2e/shell/multi-account.spec.ts tests/e2e/finance/spend.spec.ts` | extends | pending |
| 10-05-02 | 05 | 5 | ACCOUNT-04 | T-10-16, T-10-18 | unit (oracles) + e2e step (caption pin flips) | `pnpm run test:unit` and `pnpm exec playwright test tests/e2e/shell tests/e2e/finance` | extends | pending |
| 10-06-01 | 06 | 6 | SCALE-01, ACCOUNT-04 | T-10-19, T-10-20 | unit (worker, fake-indexeddb, oracles) | `pnpm run test:unit -- tests/unit/import/multi-account-scale.test.ts tests/unit/import/db.test.ts tests/unit/finance` | created by the task | pending |
| 10-06-02 | 06 | 6 | SCALE-01 | T-10-20, T-10-21 | e2e (serial, listed test 1) | `pnpm exec playwright test tests/e2e/shell/multi-account-scale.spec.ts` and `pnpm run test:unit -- tests/unit/guards` | created by the task | pending |
| 10-06-03 | 06 | 6 | SCALE-01 | T-10-21, T-10-22 | e2e (listed test 2) + guard | `pnpm run test:unit -- tests/unit/guards` and `pnpm exec playwright test tests/e2e/shell/multi-account-scale.spec.ts`; phase gate: full unit, `pnpm run check`, `pnpm run lint`, full Playwright | extends | pending |

Cross-cutting checks owned by these tasks: D-12 caption wording (`tests/unit/shell/ui-copy.test.ts`, 10-05-02); D-16 `db.verno` 2 (`tests/unit/import/db.test.ts`, 10-06-01); ci-budget pins 1860 / 1980 / 2460 and ceiling 268 (10-06-03); keyed-each audit (`multi-account-keys.test.ts`, every plan that adds an each block); single-account DOM unchanged (the existing single-account specs run in every plan's e2e command).

## Wave 0 Requirements

These artifacts are created inside the tracer tasks that first need them (a separate Wave 0 plan would add no information), so each is checked off when its task lands:

- [ ] `tests/fixtures/multi-account-fixtures.ts`: `buildOverlapTwoAccountExport()` (10-01-01) and `buildLargeThreeAccountExport()` (10-06-01)
- [ ] `tests/unit/playtime/playtime-multi-account.test.ts` (answer key 6.5 h / 9 sessions / 5 days; WOT 5 h, WOTB 1.5 h, WOWS 1 h; created by 10-01-01)
- [ ] `tests/unit/shell/game-filter-state.test.ts` (10-02-01)
- [ ] `tests/unit/import/multi-account-scale.test.ts` (10-06-01)
- [ ] `tests/e2e/shell/multi-account-scale.spec.ts` (2 listed tests: 10-06-02 and 10-06-03)
- [ ] `CURRENCY_54K_SPEC` in `tests/fixtures/finance-fixtures.ts` (10-06-01)

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chip row, tags and caption look right at 480px | ACCOUNT-06 | Visual judgement | Drop the 3-account fixture, check Playtime, Vehicles, Logins at phone width |

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Wave 0 covers all missing references
- [ ] `nyquist_compliant: true` set after execution

**Approval:** pending
