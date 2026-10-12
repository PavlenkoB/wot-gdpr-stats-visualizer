---
phase: 07-mobile-layout-public-deploy
verified: 2026-10-11T12:53:48Z
status: passed
score: 4/6 truths verified or override (SC2b nav strip accepted as override of Phase 8 supersession; 2 need a live run)
covered_files:
  - .github/workflows/ci.yml
  - .github/workflows/deploy.yml
  - .planning/phases/07-mobile-layout-public-deploy/07-01-PLAN.md
  - .planning/phases/07-mobile-layout-public-deploy/07-01-SUMMARY.md
  - .planning/phases/07-mobile-layout-public-deploy/07-02-PLAN.md
  - .planning/phases/07-mobile-layout-public-deploy/07-02-SUMMARY.md
  - .planning/phases/07-mobile-layout-public-deploy/07-03-PLAN.md
  - .planning/phases/07-mobile-layout-public-deploy/07-03-SUMMARY.md
  - .planning/phases/07-mobile-layout-public-deploy/07-04-PLAN.md
  - .planning/phases/07-mobile-layout-public-deploy/07-04-SUMMARY.md
  - .planning/phases/07-mobile-layout-public-deploy/07-05-PLAN.md
  - .planning/phases/07-mobile-layout-public-deploy/07-05-SUMMARY.md
  - .planning/phases/07-mobile-layout-public-deploy/07-06-PLAN.md
  - .planning/phases/07-mobile-layout-public-deploy/07-06-SUMMARY.md
  - .planning/phases/07-mobile-layout-public-deploy/07-07-PLAN.md
  - .planning/phases/07-mobile-layout-public-deploy/07-07-SUMMARY.md
  - .planning/phases/07-mobile-layout-public-deploy/07-08-PLAN.md
  - .planning/phases/07-mobile-layout-public-deploy/07-08-SUMMARY.md
  - README.md
  - eslint.config.js
  - index.html
  - src/app.css
  - src/lib/charts/ChartTooltip.svelte
  - src/lib/charts/tooltip-pin.ts
  - src/lib/features/logins/CityList.svelte
  - src/lib/features/logins/CountryList.svelte
  - src/lib/features/logins/LoginTable.svelte
  - src/lib/features/vehicles/VehicleTable.svelte
  - tests/deploy/deployed-build.spec.ts
  - tests/deploy/dist-artifact.spec.ts
  - tests/deploy/playwright.gate.config.ts
  - tests/deploy/playwright.live.config.ts
  - tests/e2e/shell/mobile-sweep.spec.ts
  - tests/e2e/shell/touch-targets.spec.ts
  - tests/e2e/shell/touch-tooltips.spec.ts
  - tests/unit/guards/deploy-gate.test.ts
  - tests/unit/guards/deploy-workflow.test.ts
  - tests/unit/guards/phase7-layout-guards.test.ts
  - vite.config.ts
covered_digest: "v3:sha256:b7d4bcbfd438bc1f1aaca377ba80fcbe3e6b9767df720609206dc9385cd9ff25"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "SC2 (nav half): the navigation anchor strip works by touch"
    reason: "Superseded by Phase 8 plans 08-02, 08-03 and 08-07: DashboardNav.svelte, scroll-spy.ts and tests/e2e/shell/scroll-nav.spec.ts were deliberately deleted; the shell is now list-then-detail with phone list and detail screens. The tooltip half of SC2 is unchanged and verified. tests/unit/guards/phase8-shell-guards.test.ts asserts the nav stays deleted."
    accepted_by: "Bohdan_Pavlenko"
    accepted_at: "2026-10-11T13:52:49Z"
re_verification:
  previous_status: human_needed
  previous_score: 3/4
  gaps_closed: []
  gaps_remaining: []
  regressions:
    - "SC2 nav-strip truth: previously VERIFIED (07-07/07-08 era); Phase 8 retired DashboardNav.svelte, scroll-spy.ts and scroll-nav.spec.ts (plans 08-02, 08-03, 08-07). Accepted as an override by Bohdan_Pavlenko on 2026-10-11T13:52:49Z; no longer a gap."
deferred: []
human_verification:
  - test: "Make the repo public (or accept deferral), set Settings > Pages > Source = GitHub Actions, merge to main, wait for a green ci.yml push run, dispatch Deploy from main"
    expected: "preflight, build, pre-deploy gate, deploy and smoke jobs all pass; https://<owner>.github.io/wot-gdpr-stats-visualizer/ serves the app; worker script and favicon resolve under the subpath; city file loads with manifest bytes/sha256; zero network after load; CSP present"
    why_human: "SC3 runtime half, SC4 and PLATFORM-03 can only be observed on a live run. UAT tests 1 and 2 were skipped by the owner (repo not public; 'Deferred: not deployed until repo goes public'). Not resolved by this verification."
  - test: "On a real phone, press 'Load city-level detail' on the deployed build (~12 MB gzipped, ~50 MB decoded)"
    expected: "Download and decode complete without the tab crashing; city locations appear in the login table"
    why_human: "UAT test 6 is recorded as pass ('works on phone after geo:city --download + rebuild'), but that was a local build; the deployed-build run is still unobserved and peak worker memory on a phone-class device is not testable in CI."
  - test: "Decide the self-hosted-runner exposure (review WR-04) BEFORE making the repository public"
    expected: "ci.yml either moves off `runs-on: self-hosted` for pull_request events, or fork PRs are gated by required approval"
    owner_decision: "owner decision 2026-10-11 (Bohdan_Pavlenko): defer until going public; must be resolved before making the repository public. NOT resolved."
    why_human: "Owner security decision. ci.yml still has `runs-on: self-hosted` with a bare `pull_request` trigger (verified in this session). Making the repo public for free Pages lets fork PRs run on the owner's runner."
  - test: "Optional: real screen reader speaks 'Tooltip pinned.' / 'Tooltip dismissed.'; a real 375px device re-drives the tooltip and map taps"
    expected: "Announcements spoken once; pins fit the card"
    why_human: "UAT tests 3 and 4 were accepted by the owner, but only emulated touch Chromium was exercised by automation; a real screen reader and device were not."
---

# Phase 7: Mobile Layout & Public Deploy Verification Report

**Phase Goal:** The finished dashboard works on a phone and is publicly available on GitHub Pages. The zero-network guarantee is verified against the deployed build.
**Verified:** 2026-10-11T12:53:48Z
**Status:** passed
**Re-verification:** Yes. The previous report (2026-10-06, human_needed, 3/4) predates the Phase 8 redesign and folder refactor, so it was stale. This run re-derives every truth from the current tree and does not reuse the old verdict.

## Goal Achievement

### Observable Truths (ROADMAP Phase 7 success criteria, as amended by 07-06)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: at ~375px every section is readable and usable with no sideways page scroll; wide charts scroll in their own box | ✓ VERIFIED | Substance holds in the current shell. The structure is superseded by Phase 8 (08-02 list-then-detail, 08-03 phone list and detail screens): sections now mount one pane at a time. `tests/e2e/shell/mobile-sweep.spec.ts` was kept and driven through `openSection` (lines 163, 228, 410). `master-detail-nav.spec.ts` "(long-text)" asserts no sideways overflow at 375px and 720px. Regression evidence: orchestrator e2e gate 254 passed (g-e2e.log). Not re-run here. |
| 2a | SC2 (tooltip): the shared tooltip pins and dismisses on tap, and works by touch | ✓ VERIFIED | `src/lib/charts/ChartTooltip.svelte` and `src/lib/charts/tooltip-pin.ts` present and wired. Named unit test `tests/unit/charts/tooltip-pin.test.ts` passes (this session). `tests/e2e/shell/touch-tooltips.spec.ts` present (8 tests), covered by the orchestrator e2e gate. |
| 2b | SC2 (nav): the navigation anchor strip works by touch | ✓ PASSED (override) | `src/lib/shell/DashboardNav.svelte`, `scroll-spy.ts` and `tests/e2e/shell/scroll-nav.spec.ts` are absent. Phase 8 plan 08-07 deleted them on purpose. `tests/unit/guards/phase8-shell-guards.test.ts` asserts "the anchor nav and scroll-spy stay deleted" and passes. This is an intentional supersession, not a regression bug. Accepted as an override by Bohdan_Pavlenko on 2026-10-11T13:52:49Z. |
| 3 | SC3: CI runs on push to main; a separate manual Deploy workflow refuses unverified commits, builds with the real city data, runs the gate before upload, uses `upload-pages-artifact@v4` and `deploy-pages@v4`, then runs a live smoke | ? UNCERTAIN (structure VERIFIED, live run human) | `deploy.yml` (verified structurally this session): `workflow_dispatch` only; preflight refuses non-`refs/heads/main` and any commit without a successful `ci.yml` push run on main for that SHA; build runs `geo:city -- --download` on a cache miss, then `pnpm run build`, then the gate, then uploads `dist`; deploy job alone holds `pages: write` and `id-token: write`; smoke waits for the entry script and runs `playwright.live.config.ts`. `ci.yml` has `push: branches: [main]` and `pull_request:`. Both pinned to commit SHAs. Guard tests `deploy-workflow.test.ts` and `deploy-gate.test.ts` pass (this session). No live dispatch has been run; see human items. |
| 4 | SC4: on the live Pages subpath the worker, the city dataset and the CSP work, and the zero-network check passes against the deployed build | ? UNCERTAIN (static VERIFIED, live run human) | `vite.config.ts` sets `base` from `VITE_BASE` in `deploy.yml`, and `csp-meta` injects the CSP at build time with `connect-src 'self'`. `city-fetch.ts` builds the URL from the base path plus the manifest file. `tests/deploy/deployed-build.spec.ts` covers worker, favicon, CSP and city bytes/sha256. Country table is inlined (no request). Served-page checks have not run against the live origin. |
| 5 | Standing check: zero network after load (PLATFORM-02, Phase 1 guard stays green) | ✓ VERIFIED | `eslint.config.js` bans `fetch`, `XMLHttpRequest`, `WebSocket` and `fetchLater` (PLATFORM02 rules). Named guard tests pass. `tests/e2e/guards/zero-network.spec.ts` ran green in the orchestrator e2e gate. |

**Score:** 4/6 truths verified or override (SC1, SC2a, SC2b via override, zero-network). 0 FAILED. 2 UNCERTAIN, pending a live run (SC3 runtime, SC4).

**Behavior-unverified:** 0. The touch-tooltip truth has a passing behavioural unit test and an e2e spec.

### Deferred Items

None. Phase 7 is the final phase in ROADMAP.md. Phase 8 supersedes SC2b; it does not defer it.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `.github/workflows/deploy.yml` | Manual, main-only, gated Pages deploy | ✓ VERIFIED | Structure checked in full. Not executed live. |
| `.github/workflows/ci.yml` | Push-to-main and PR CI, zero-network gate | ✓ VERIFIED | Structure checked. Still `runs-on: self-hosted` (WR-04). |
| `src/lib/charts/ChartTooltip.svelte`, `tooltip-pin.ts` | Touch pin and dismiss | ✓ VERIFIED | Present, wired into chart owners, unit-tested. |
| `src/lib/shell/DashboardNav.svelte` | Anchor strip (SC2b) | ✓ PASSED (override; superseded by Phase 8) | Deleted by 08-07. |
| `tests/e2e/shell/scroll-nav.spec.ts` | Nav exact names at 375/480px | ✓ PASSED (override; superseded by Phase 8) | Deleted with the nav; no replacement touch-nav spec. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `deploy.yml` preflight | `ci.yml` push run on main | `gh api .../workflows/ci.yml/runs?head_sha=...&event=push&branch=main&status=success` | WIRED | Structural only. |
| `deploy.yml` build | pre-deploy gate, then `upload-pages-artifact` | step order | WIRED | Gate runs before upload. |
| `deploy.yml` smoke | live URL | `LIVE_URL` from deploy job output | WIRED (structure) | Live run not executed. |
| `ChartTooltip.svelte` | `tooltip-pin.ts` | pure decision functions | WIRED | Unit test passes. |
| `city-fetch.ts` | `geo-city-data/<manifest.file>` | base path plus manifest file | WIRED | Under base path. |

### Data-Flow Trace (Level 4)

Not applicable beyond the earlier phases' data paths. This phase adds layout, interaction and CI. The city path is exercised with real data only in the gate and smoke, which have not run live.

### Behavioral Spot-Checks (this session)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Named Phase 7/8 guard and tooltip unit tests | `pnpm exec vitest run tests/unit/charts/tooltip-pin.test.ts tests/unit/guards/phase7-layout-guards.test.ts tests/unit/guards/phase8-shell-guards.test.ts tests/unit/guards/deploy-workflow.test.ts tests/unit/guards/deploy-gate.test.ts` | 5 files, 123 tests passed, exit 0 | ✓ PASS |
| Orchestrator full unit gate (regression only) | g-unit.log | UNIT_EXIT=0, 2794 passed | ✓ PASS (not re-run) |
| Orchestrator check gate (regression only) | g-check.log | CHECK_EXIT=0, 306 files, 0 errors, 0 warnings | ✓ PASS (not re-run) |
| Orchestrator e2e gate (regression only) | g-e2e.log | E2E_EXIT=0, 254 passed | ✓ PASS (not re-run) |
| Live deploy dispatch | not run | Repository not public; Pages not enabled | ? SKIP (human) |

Playwright was not run by this verifier, per instruction.

### Probe Execution

Step 7c: SKIPPED. No `scripts/*/tests/probe-*.sh` exists and no PLAN declares a probe path.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
| ----------- | ------------ | ------ | -------- |
| PLATFORM-01 (responsive, usable at phone width) | 07-03, 07-04, 07-05, 07-06, 07-07, 07-08 | ✓ SATISFIED (note: nav portion superseded by Phase 8) | Truth 1 and 2a verified. The touch-nav clause is superseded by Phase 8. REQUIREMENTS.md still reads Gaps Found (line 112) and is unchecked (line 50). It should be updated by the owner, not by this verifier. |
| PLATFORM-03 (static site on GitHub Pages via `actions/deploy-pages`) | 07-01, 07-02, 07-06 | ? NEEDS HUMAN | Workflow and gate are implemented and structurally verified. No live dispatch has happened. Keep Pending (REQUIREMENTS.md line 114) until a real Deploy run succeeds. |
| PLATFORM-02 (zero-network) | Phase 1 (not claimed here) | n/a | Standing check, passing. Not an orphan. |

No orphaned requirement IDs. REQUIREMENTS.md maps only PLATFORM-01 and PLATFORM-03 to Phase 7, and both appear in PLAN frontmatter.

### Anti-Patterns Found

Debt-marker scan (`TBD|FIXME|XXX`) over the Phase 7 covered files: no matches. No stubs in the touched components.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `.github/workflows/ci.yml` | 27 | `runs-on: self-hosted` with bare `pull_request` (WR-04) | ⚠️ WARNING | Exposure once the repo is public. Owner decision 2026-10-11: defer until going public; must be resolved before making the repository public. Still open. |
| `.planning/phases/07-*/07-REVIEW-DISPOSITION.md` | 79-83 | WR-01 to WR-05 all `open` in the ledger | ⚠️ WARNING | WR-01 is fixed by 07-07 per the old verification, but the ledger is stale. WR-02, WR-03 and WR-05 are untriaged. None blocks a must-have. |
| `src/lib/charts/tooltip-pin.ts`, `ChartTooltip.svelte` | — | Touch-origin flag and silent-dismissal announcement | ℹ️ INFO | Known review items (WR-02 pan or scroll pin dismissal). Covered by unit and e2e tests. |

### Human Verification Required

1. **First live deploy (SC3 runtime, SC4, PLATFORM-03)**: make the repo public (or accept deferral), set Pages Source to GitHub Actions, wait for a green ci.yml push run on main, dispatch Deploy from main. The owner has deferred this: UAT tests 1 and 2 are `skipped` ("Deferred: keeping repo non-public until everything is done"; "Deferred: not deployed until repo goes public"). This verification does not mark them resolved.
2. **City opt-in on the deployed build (UAT 6, pass but local)**: UAT 6 is recorded as pass, but it was a local build after `pnpm run geo:city -- --download`. The deployed-build version and phone memory peak remain unobserved.
3. **WR-04 runner exposure**: decide before making the repository public. `ci.yml` remains `runs-on: self-hosted` with bare `pull_request`. Owner decision 2026-10-11 (Bohdan_Pavlenko): defer until going public; must be resolved before making the repository public. NOT resolved, stays open.
4. **Optional, real device and screen reader**: UAT 3 and 4 passed on emulated touch Chromium. A real screen reader and a real 375px device were not used.

### Gaps Summary

No FAILED must-have remains. The SC2 nav-strip truth was retired by Phase 8 (plan 08-07, with 08-02 and 08-03 replacing the phone navigation with list-then-detail) and was accepted as an override by the repo owner (Bohdan_Pavlenko, 2026-10-11T13:52:49Z). The phase goal (works on a phone) is substantively met through the Phase 8 structure.

Status is `human_needed`: the live deployment (SC3 runtime, SC4) cannot be verified from this environment. The workflow structure is verified and the pre-deploy gate is in place, but the publicly available half of the goal is not proven. The three open items (first live deploy, city opt-in on the deployed build, WR-04 runner exposure) and the optional real-device check remain with the owner.

---

_Verified: 2026-10-11T12:53:48Z_
_Verifier: Claude (gsd-verifier)_

Owner override (2026-10-12): owner chose "Mark passed anyway" in chat. Live deploy (SC3 runtime, SC4), deployed-build city opt-in on a phone, and WR-04 self-hosted-runner exposure remain UNOBSERVED/UNRESOLVED; WR-04 must be resolved before the repo goes public.
