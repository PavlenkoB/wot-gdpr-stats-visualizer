---
phase: "11"
slug: new-game-data
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-19"
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `11-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Node env, `tests/unit/**/*.test.ts`) and Playwright (`chromium`, `chromium-mobile`) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run <touched test file>` |
| **Full suite command** | `pnpm run test:unit && pnpm run check && pnpm run lint`; phase gate adds `pnpm run build` and `pnpm exec playwright test` |
| **Estimated runtime** | ~10 s per file; unit suite a few minutes |

---

## Sampling Rate

- **After every task commit:** the touched file's Vitest file
- **After every plan wave:** `pnpm run test:unit && pnpm run check && pnpm run lint`
- **Before `/gsd-verify-work`:** full unit suite, build, `playwright test --list` within the 264 budget, e2e on a machine that can launch Chromium
- **Max feedback latency:** ~60 seconds for per-task runs

---

## Per-Task Verification Map

| Requirement | Plan | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|------|----------|-----------|-------------------|-------------|--------|
| PRIV-01 | 01, 03 | Per spec file: planted email/ID/IP/coordinate variants absent from stored rows and channel JSON; family file with no spec stores nothing | unit (real worker + fake IndexedDB) | `pnpm exec vitest run tests/unit/import/new-data-allowlist.test.ts` | ❌ W0 | ⬜ pending |
| PRIV-01 | 04 | Legacy raw rows narrowed on check-cache; second run no-op | unit | `pnpm exec vitest run tests/unit/import/new-data-narrow.test.ts` | ❌ W0 | ⬜ pending |
| PRIV-01 | 03, 10 | WOWP allowlist covers vehicle vocabulary; `NAME` absent from stored account rows | unit | `pnpm exec vitest run tests/unit/vehicles/vehicle-stats.test.ts` | ✅ extend | ⬜ pending |
| PRIV-01 | 11 | Canary absent from rendered HEAT and Warships panes | e2e | `pnpm exec playwright test new-data-panes` | ❌ W0 | ⬜ pending |
| PRIV-02 | 11 | Zero requests, one worker, no CSP violation across new panes | e2e (extend) | `pnpm exec playwright test guards/zero-network` | ✅ extend | ⬜ pending |
| GAMES-01 | 07, 09 | `heat` channel states ready/not-in-export/no-rows/skipped; masked address | unit | `pnpm exec vitest run tests/unit/import/new-data-worker.test.ts` | ❌ W0 | ⬜ pending |
| GAMES-01 | 05 | List row/Overview card only with files | unit | `pnpm exec vitest run tests/unit/shell/selection-state.test.ts tests/unit/shell/overview-model.test.ts` | ✅ extend | ⬜ pending |
| GAMES-02 | 01 | Tokens, chip matrix, per-game scopes for HEAT/WOTC, no version bump unless test fails | unit | `pnpm exec vitest run tests/unit/shell/game-filter-state.test.ts tests/unit/playtime/playtime-new-games.test.ts` | ✅/❌ W0 | ⬜ pending |
| GAMES-03 | 10 | Warplanes account block per account, absent account yields nothing | unit + e2e | `pnpm exec vitest run tests/unit/vehicles/vehicle-stats.test.ts` | ✅ extend | ⬜ pending |
| GAMES-03 | 06 | No-vehicle-table note under HEAT/WOTC filter; last title kept | unit | `pnpm exec vitest run tests/unit/shell/game-filter-state.test.ts` | ✅ extend | ⬜ pending |
| GAMES-04 | 07, 09 | `warships-storage` rows account-tagged in identity-header order | unit + e2e | `pnpm exec vitest run tests/unit/import/new-data-worker.test.ts` | ❌ W0 | ⬜ pending |
| D-11 | 08 | >500 rows windowed; bounded DOM nodes | unit + e2e | `pnpm exec vitest run tests/unit/vehicles/vehicle-model.test.ts` | ❌ W0 | ⬜ pending |
| Footer SC5 | 05 | `unsupportedEntries` unchanged with every new file present | unit | `pnpm exec vitest run tests/unit/shell/dashboard-status.test.ts` | ✅ extend | ⬜ pending |
| Budget | 11 | Listed e2e tests ≤ 264 or all three limits raised together | unit guard | `pnpm exec vitest run tests/unit/guards/ci-budget.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Header capture output (plan 11-02 checkpoint) committed as names-only data
- [ ] `tests/fixtures/new-data-fixtures.ts`: synthetic files with captured headers, canary per file, drifted and header-only copies, >500-row generator
- [ ] Extend `tests/fixtures/multi-account-fixtures.ts` real-shape builder with pane files without changing existing literals
- [ ] `tests/unit/import/new-data-allowlist.test.ts`, `new-data-worker.test.ts`, `new-data-narrow.test.ts`, `tests/e2e/shell/new-data-panes.spec.ts`
- [ ] Update pinned tests (research Pattern 6, Pattern 8, Pitfall 7) together with the code that makes them false

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Header capture from the real export | PRIV-01 | Agent reads of the real zip are permission-blocked | Run `header_capture.py` per plan 11-02, review names-only output |
| Browser e2e run | PRIV-02 | Chromium may not launch in the agent sandbox | Run `pnpm exec playwright test` locally or in CI |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s per task
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
