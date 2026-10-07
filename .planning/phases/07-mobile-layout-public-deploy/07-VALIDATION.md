---
phase: "7"
slug: "mobile-layout-public-deploy"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-05"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The per-task map below was filled by the planner from plans 07-01 to 07-07 (07-07 is the GAP-WR01 gap-closure plan); each Automated Command is the plan's own `<automated>` verify command (Playwright commands name the project because `playwright test --list` counts both projects).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit, incl. `tests/unit/guards/`) + Playwright (e2e against built `vite preview`, `GEO_FIXTURE=1`) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` (second `chromium-mobile` project added in this phase, scoped with `testMatch`/`testIgnore` on the `touch-*.spec.ts` glob), `tests/deploy/playwright.gate.config.ts` and `tests/deploy/playwright.live.config.ts` (outside `tests/e2e`, so the default config and the CI budget never list them) |
| **Quick run command** | `pnpm exec vitest run tests/unit/guards` |
| **Full suite command** | `pnpm run lint && pnpm run check && pnpm run test:unit && pnpm exec playwright test` |
| **Estimated runtime** | unit ~60 s; full e2e ~20 min on CI (budget raised together: globalTimeout, wrapper, job) |

---

## Sampling Rate

- **After every task commit:** quick run command plus the one touched spec (`pnpm exec playwright test <file>`)
- **After every plan wave:** `pnpm run lint && pnpm run check && pnpm run test:unit`, and the Playwright files that wave touched
- **Before `/gsd-verify-work`:** full suite green, including the existing zero-network specs
- **Max feedback latency:** 120 seconds for per-task checks

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-T1 | 07-01 | 1 | PLATFORM-03 | T-07-SC | Pages preconditions (repo visibility, Pages source) recorded; deferral allowed (D-12) | manual (human-action checkpoint) | none: `gh` is not authenticated; unauthenticated probe `curl -s -o /dev/null -w '%{http_code}' https://api.github.com/repos/PavlenkoB/wot-gdpr-stats-visualizer` returned 404 at planning time | n/a | ⬜ pending |
| 07-01-T2 | 07-01 | 1 | PLATFORM-03 | T-07-03, T-07-04 | built dist under VITE_BASE subpath loads; worker and favicon 200; every request under the base (D-11) | e2e (gate harness) + unit guard | `VITE_BASE=/wot-gdpr-stats-visualizer/ pnpm run build && VITE_BASE=/wot-gdpr-stats-visualizer/ pnpm exec playwright test -c tests/deploy/playwright.gate.config.ts deployed-build.spec.ts && pnpm exec vitest run tests/unit/guards/deploy-gate.test.ts tests/unit/guards/geo-seam.test.ts && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-01-T3 | 07-01 | 1 | PLATFORM-03 | T-07-01, T-07-02, T-07-03 | CSP exact, zero requests after load, served city file bytes+sha256 equal manifest, one opt-in request, artifact allowlist (D-13, D-14, D-15) | e2e (gate) + filesystem spec | `bash -c 'trap "rm -rf public/geo-city-data" EXIT; node scripts/geo/build-city-dataset.ts --csv tests/fixtures/geo/city-fixture.csv --month 2026-10 && VITE_BASE=/wot-gdpr-stats-visualizer/ pnpm run build && VITE_BASE=/wot-gdpr-stats-visualizer/ EXPECT_CITY_MONTH=2026-10 pnpm exec playwright test -c tests/deploy/playwright.gate.config.ts && pnpm exec vitest run tests/unit/guards/deploy-gate.test.ts tests/unit/guards/geo-seam.test.ts && pnpm run check && pnpm run lint'` | ❌ W0 | ⬜ pending |
| 07-02-T1 | 07-02 | 2 | PLATFORM-03 | T-07-05, T-07-06, T-07-07, T-07-08 | deploy.yml: workflow_dispatch only, Pages perms on deploy job only, SHA-pinned, no `${{` in run, refuses non-main / no green CI push run (D-09, D-10) | unit guard (parses workflow, mutation-tested) | `pnpm exec vitest run tests/unit/guards/deploy-workflow.test.ts tests/unit/guards/ci-budget.test.ts && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-02-T2 | 07-02 | 2 | PLATFORM-03 | T-07-01, T-07-09, T-07-10, T-07-11 | month-keyed cache, city file generated before build, entry-script output, gate before upload (D-13, D-14) | unit guard | `pnpm exec vitest run tests/unit/guards/deploy-workflow.test.ts tests/unit/geo && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-02-T3 | 07-02 | 2 | PLATFORM-03 | T-07-12 | smoke is its own job (needs build and deploy), waits for THIS build's entry script, no error masking; live config proven locally (D-14) | unit guard + local live run | `pnpm exec vitest run tests/unit/guards/deploy-workflow.test.ts && pnpm run check && pnpm run lint` (plus the local live-config proof recorded in the SUMMARY) | ❌ W0 | ⬜ pending |
| 07-03-T1 | 07-03 | 1 | PLATFORM-01 | T-07-SC | touch tap on an hour-grid cell opens the shared tooltip and it stays open; project routing (D-04, D-05) | e2e (touch project) + unit | `pnpm exec playwright test --project=chromium-mobile tests/e2e/shell/touch-tooltips.spec.ts && pnpm exec vitest run tests/unit/guards tests/unit/playtime && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-03-T2 | 07-03 | 1 | PLATFORM-01 | T-07-13, T-07-14 | pure tap/pin decisions, announcements through one page-level live region (count 4 to 5) (D-05) | unit (table-driven) + e2e | `pnpm exec vitest run tests/unit/charts tests/unit/guards tests/unit/playtime && pnpm exec playwright test --project=chromium tests/e2e/shell/dashboard.spec.ts -g "import region" && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-03-T3 | 07-03 | 1 | PLATFORM-01 | T-07-13, T-07-14 | hour-grid pin, move, tap-again, tap-outside, Escape, silent scroll; CI budget (D-04, D-05) | e2e (touch project) + guards | `pnpm exec playwright test --project=chromium-mobile tests/e2e/shell/touch-tooltips.spec.ts && pnpm exec playwright test --project=chromium tests/e2e/playtime/playtime-charts.spec.ts tests/e2e/playtime/playtime.spec.ts && pnpm exec vitest run tests/unit/guards tests/unit/geo/build-scripts.test.ts && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-04-T1 | 07-04 | 2 | PLATFORM-01 | T-07-15 | bar charts (shared tooltip) pin, move across charts, dismiss (D-05) | e2e (touch project) + guards | `pnpm exec playwright test --project=chromium-mobile tests/e2e/shell/touch-tooltips.spec.ts && pnpm exec playwright test --project=chromium tests/e2e/finance/finance.spec.ts && pnpm exec vitest run tests/unit/charts tests/unit/finance && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-04-T2 | 07-04 | 2 | PLATFORM-01 | T-07-15 | calendar pin, move, dismiss; hover ring and keyboard unchanged (D-05) | e2e (touch project) + source-contract | `pnpm exec playwright test --project=chromium-mobile tests/e2e/shell/touch-tooltips.spec.ts && pnpm exec playwright test --project=chromium tests/e2e/playtime/playtime-charts.spec.ts && pnpm exec vitest run tests/unit/playtime && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-04-T3 | 07-04 | 2 | PLATFORM-01 | T-07-16 | map pin anchored at the finger with its own element, no zoom or pan (D-02, D-05); CI budget raise | e2e (touch project) + guards | `pnpm exec playwright test --project=chromium-mobile && pnpm exec playwright test --project=chromium tests/e2e/logins/login-map.spec.ts && pnpm exec vitest run tests/unit/logins tests/unit/guards && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-05-T1 | 07-05 | 3 | PLATFORM-01 | T-07-18 | one 480px block, 16px padding at 375 and 24px at 481, no page-level horizontal scroll (D-03, D-04) | e2e (sweep, chromium 375x812) | `pnpm exec playwright test --project=chromium tests/e2e/shell/mobile-sweep.spec.ts && pnpm exec vitest run tests/unit/guards && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-05-T2 | 07-05 | 3 | PLATFORM-01 | T-07-17, T-07-18 | 44px floor on buttons, summaries, links; nav height and --nav-offset unchanged; existing 375px specs unmodified (D-08) | e2e (touch project bounding boxes) + regression | `pnpm exec playwright test --project=chromium-mobile && pnpm exec playwright test --project=chromium tests/e2e/shell/scroll-nav.spec.ts tests/e2e/shell/uat-criteria.spec.ts tests/e2e/shell/dashboard.spec.ts tests/e2e/playtime/playtime-ui-review.spec.ts tests/e2e/vehicles tests/e2e/logins/login-table.spec.ts tests/e2e/logins/login-history.spec.ts && pnpm exec vitest run tests/unit/guards tests/unit/vehicles tests/unit/logins && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-05-T3 | 07-05 | 3 | PLATFORM-01 | T-07-18 | every section, banner, opt-in state and table at 375px without page-level horizontal scroll; tables keep own scroll boxes; map only scales (D-01, D-02, D-16) | e2e (sweep) | `pnpm exec playwright test --project=chromium tests/e2e/shell/mobile-sweep.spec.ts && pnpm exec vitest run tests/unit/guards && pnpm run check && pnpm run lint` | ❌ W0 | ⬜ pending |
| 07-06-T1 | 07-06 | 4 | PLATFORM-01, PLATFORM-03 | T-07-21 | ROADMAP success criteria 2 and 3 amended with their decisions cited (D-06, D-09) | doc check (grep + scoped diff) | see 07-06-PLAN.md Task 1 `<automated>` (marker count, plan 06-06 amendment kept, only the two original lines removed) | n/a | ⬜ pending |
| 07-06-T2 | 07-06 | 4 | PLATFORM-03 | T-07-19, T-07-20, T-07-21 | README publishing section, preconditions, rollback, rehearsal; manual verification list (D-12, D-16) | doc check + human-check | see 07-06-PLAN.md Task 2 `<automated>` (required phrases present, lint) and its four `<human-check>` blocks | n/a | ⬜ pending |
| 07-07-T1 | 07-07 | 4 | PLATFORM-01 | T-07-22, T-07-23, T-07-24 | GAP-WR01: exact nav link names at 375px and 480px fail on the 07-05 component (red commit) and pass after the block-padding fix; link box stays 44px; nav height and --nav-offset unchanged (Phase 3 D-03, D-03, D-08) | e2e (chromium names, chromium-mobile geometry) + guards | `pnpm exec playwright test --project=chromium tests/e2e/shell/scroll-nav.spec.ts && pnpm exec playwright test --project=chromium-mobile tests/e2e/shell/touch-targets.spec.ts && pnpm exec vitest run tests/unit/guards tests/unit/charts/contrast.test.ts && pnpm run check && pnpm run lint` | n/a (extends scroll-nav.spec.ts) | ⬜ pending |
| 07-07-T2 | 07-07 | 4 | PLATFORM-01 | T-07-22, T-07-23, T-07-25 | mutation re-failure of the phone-names tests, real-app nav measurements at 375/480/481/1280, full regression and CI budget unchanged (D-03, D-04, D-08) | e2e (full suite) + unit | `pnpm exec playwright test && pnpm run test:unit && pnpm run check && pnpm run lint` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/deploy/playwright.gate.config.ts`, `tests/deploy/deployed-build.spec.ts`, `tests/deploy/dist-artifact.spec.ts`, `tests/unit/guards/deploy-gate.test.ts` (plan 07-01, PLATFORM-03)
- [ ] `.github/workflows/deploy.yml`, `scripts/geo/resolve-dbip-month.ts`, `tests/deploy/playwright.live.config.ts`, `tests/unit/guards/deploy-workflow.test.ts` (plan 07-02, PLATFORM-03)
- [ ] `chromium-mobile` project in `playwright.config.ts`, `src/lib/charts/tooltip-pin.ts`, `tests/unit/charts/tooltip-pin.test.ts`, `tests/e2e/shell/touch-tooltips.spec.ts` (plans 07-03 and 07-04, PLATFORM-01)
- [ ] `tests/e2e/shell/mobile-sweep.spec.ts`, `tests/e2e/shell/touch-targets.spec.ts` (plan 07-05, PLATFORM-01)
- [ ] `ci-budget.test.ts` pinned projection, `globalTimeout`, wrapper and job timeout updated together in the plans that push the listed total past the ceiling (07-03 to 07-05)

*Existing Vitest/Playwright infrastructure covers everything else; no new framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Repo visibility + Pages source = "GitHub Actions" | PLATFORM-03 | Repo setting, `gh` not authenticated here | Settings > Pages; confirm repo is public (free Pages) and source is GitHub Actions |
| First real deploy via Actions UI | PLATFORM-03 | `workflow_dispatch` runs on GitHub, from `main`, so only after this branch is merged | Run "Deploy" on `main` (green-CI SHA); preflight, build (gate), deploy and smoke jobs green; live URL serves the app (also a `<human-check>` in plan 07-06 Task 2) |
| City opt-in on a real phone | PLATFORM-01/03 | Peak decode memory (~120 MB est.) is unmeasurable in CI | Open live URL on a phone, import export, trigger opt-in, confirm it completes or shows the error state |
| Real touch feel (pin/move/dismiss) | PLATFORM-01 | Emulation is not a real finger | Tap heatmap, hour grid, bar chart, map on a phone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
