---
phase: 07-mobile-layout-public-deploy
verified: 2026-10-06T10:30:00Z
status: human_needed
score: 3/4 must-haves verified
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
  - src/lib/charts/ChartTooltip.svelte
  - src/lib/charts/tooltip-pin.ts
  - src/lib/features/logins/CityList.svelte
  - src/lib/features/logins/CountryList.svelte
  - src/lib/features/logins/LoginTable.svelte
  - src/lib/features/vehicles/VehicleTable.svelte
  - src/lib/shell/DashboardNav.svelte
  - tests/deploy/deployed-build.spec.ts
  - tests/deploy/dist-artifact.spec.ts
  - tests/e2e/shell/scroll-nav.spec.ts
  - tests/unit/guards/phase7-layout-guards.test.ts
covered_digest: "v2:sha256:55c5764d2c6c18f40d231edc9b682053046b282cc6842fbd5f791bb2df69e1c4"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "GAP-WR01: nav link accessible name exact at <=480px (07-07)"
    - "G-07-5 (UAT test 5): table sticky cells painted over the sticky nav (07-08)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Make the repo public (or accept deferral), set Settings > Pages > Source = GitHub Actions, merge to main, wait for green ci.yml push run, dispatch Deploy on main"
    expected: "preflight, build, pre-deploy gate, deploy and smoke jobs all pass; the live URL https://<owner>.github.io/wot-gdpr-stats-visualizer/ serves the app; worker script and favicon resolve under the subpath; city file loads with manifest bytes/sha256; zero network after load; CSP present"
    why_human: "SC4 and the runtime half of SC3/PLATFORM-03 can only be observed on the live origin. Consciously deferred by the owner (D-12; UAT tests 1 and 2: 'still in dev state, Pages not enabled', 'Not deployed yet'). Not a code gap."
  - test: "On a real phone, press 'Load city-level detail' on the deployed build (~12 MB gzipped, ~50 MB decoded)"
    expected: "Download and decode complete without the tab crashing; city locations appear in the login table"
    why_human: "UAT test 6 skipped: the dev build ships no city file and peak worker memory on a phone-class device cannot be measured by any test (Phase 6 hand-off d)."
  - test: "Decide the self-hosted-runner exposure (review WR-04) BEFORE making the repository public"
    expected: "ci.yml either moves off `runs-on: self-hosted` for pull_request events, or fork PRs are gated by required approval / a pull_request_target-free restriction"
    why_human: "Owner security decision. README preconditions do not mention it; making the repo public (a Pages precondition) lets any fork PR run code on the owner's persistent machine."
  - test: "Optional: real screen reader speaks 'Tooltip pinned.' / 'Tooltip dismissed.'; finance bars and map re-driven on a real 375px phone"
    expected: "Announcements are spoken once; pins fit the card"
    why_human: "UAT tests 3 and 4 were accepted on emulated touch Chromium only; a real screen reader and device were not exercised."
---

# Phase 7: Mobile Layout & Public Deploy Verification Report

**Phase Goal:** The finished dashboard works on a phone and is publicly available on GitHub Pages. The zero-network guarantee is verified against the deployed build.
**Verified:** 2026-10-06T10:30:00Z
**Status:** human_needed
**Re-verification:** Yes, after gap closure (07-07, 07-08). Previous: gaps_found 2/4.

The code half of the goal (phone layout, touch, deploy machinery, deployed-build gate) is achieved and re-proven in this session. The "publicly available" and "verified against the deployed build" halves need a real deployment, which the owner has consciously deferred. No code gaps remain.

## Goal Achievement

### Observable Truths (ROADMAP success criteria, as amended by 07-06)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | At ~375px every section is readable and usable with no horizontal page scroll; wide charts scroll inside their own container | VERIFIED | Full `pnpm exec playwright test` run this session: 257 passed (chromium + chromium-mobile), including mobile-sweep, touch-targets, `(phone-375)` and the new `(phone-names)`/`(stacking)` tests. UAT test 5 (focal point at 375px) passed after 07-08. Nav name regression and stacking regression both closed, see gap-closure table. |
| 2 | Nav strip and shared chart tooltip work by touch: opens and pins on tap; dismisses on outside tap, second tap on same mark, Escape or scroll; no popovers added | VERIFIED | `src/lib/charts/tooltip-pin.ts` (pure decision module) wired by `ChartTooltip.svelte`; `tests/e2e/shell/touch-tooltips.spec.ts` on chromium-mobile covers hour grid, bars, calendar and map and passed in the 257-test run (behavioural tests exist and pass, so these state-transition truths are not presence-only). `grep bits-ui src package.json` is empty: no popover dependency (D-06 amendment holds). |
| 3 | Push to main runs full CI (`ci.yml`, self-hosted); deploy is a separate manual `deploy.yml` that refuses a commit without a green CI push run on main, builds on a GitHub-hosted runner with real DB-IP city data, runs the zero-network gate on the artifact before `upload-pages-artifact@v4`, publishes with `deploy-pages@v4`, then smokes the live URL | VERIFIED (structure) | Read `.github/workflows/deploy.yml`: `workflow_dispatch` only; `preflight` refuses non-main and requires a successful `ci.yml` push run for the exact SHA; `build` is `ubuntu-latest`, resolves the DB-IP month, caches by month, runs `pnpm run geo:city -- --download`, builds with `VITE_BASE=/wot-gdpr-stats-visualizer/`, runs `playwright.gate.config.ts` before the pinned `upload-pages-artifact` v4.0.0 step; `deploy` is the sole job with `pages: write`/`id-token: write` using `deploy-pages` v4.0.5; `smoke` waits for the entry script then runs `playwright.live.config.ts`. `ci.yml`: `push: branches: [main]`, `runs-on: self-hosted`. `deploy-workflow.test.ts` and `deploy-gate.test.ts` (mutation-tested guards) pass. Whether a real dispatch succeeds is human-only (see below). |
| 4 | On the live Pages subpath the worker script and opt-in city dataset load without 404s; CSP present; zero-network passes against the deployed build | UNCERTAIN (human_needed) | The gate harness exists and passes what can be checked locally: with a build under `VITE_BASE=/wot-gdpr-stats-visualizer/`, 5 of 9 gate tests pass (worker, favicon, CSP, zero-network idle and through an import, base-prefixed assets). The 4 that fail locally (city manifest is dbip-sourced, manifest baked into chunk, city file bytes/sha256, one-request opt-in) fail for the expected reason ("the artifact must carry a city manifest": no real city dataset is generated outside the deploy job, by design, and `public/geo-city-data` is not in git). Nothing has been deployed, so no live-URL evidence exists. Owner-deferred (D-12, UAT 1-2). |

**Score:** 3/4 truths verified; 0 behaviour-unverified; SC4 routed to human verification (deferred deployment, not a code defect).

### Gap Closure Verification (previous gaps, claims checked against code and tests)

| Gap | Claim | Evidence | Status |
|-----|-------|----------|--------|
| GAP-WR01 (07-07) | Phone-width nav link is a block box centred with block padding, so a muted link's name is exactly "Payment_history, not in this export" at <=480px | `src/lib/shell/DashboardNav.svelte` `@media (max-width: 480px)` rule is `a { padding-block: calc((44px - 3px - 1.4em) / 2); }`, no `display:flex`; `.screen-reader-only` comment documents the blockification hazard. `scroll-nav.spec.ts` has 4 `(phone-names)` tests (not-loaded and after-import at 375px and 480px); re-run this session: 4 passed. Red-first commits `f936f91` then `73ed505` in history. | CLOSED |
| G-07-5 (07-08, UAT 5) | Every table scroller is its own stacking context so sticky table cells cannot paint over the sticky nav | `isolation: isolate` present on `.scroller` in LoginTable, VehicleTable, CountryList and CityList (grep). Two `(stacking)` tests (login and vehicle tables) measure paint order with `elementsFromPoint`; re-run this session: 2 passed. `phase7-layout-guards.test.ts` source guard (all four scrollers) passes within `tests/unit/guards` 223/223. Red-first commits `65010e7`/`2852402` and `fde1787`/`9f284ce`. UAT test 5 re-verified by the user. | CLOSED |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/deploy.yml` | Manual, CI-gated deploy | VERIFIED | Substantive, SHA-pinned actions, guarded by `deploy-workflow.test.ts` |
| `tests/deploy/*.spec.ts`, `playwright.gate.config.ts`, `playwright.live.config.ts` | Deployed-build gate and live smoke | VERIFIED | Wired from `deploy.yml` build and smoke jobs; gate partially runnable locally (see SC4) |
| `src/lib/charts/tooltip-pin.ts`, `ChartTooltip.svelte` | Touch pin | VERIFIED | Wired; touch specs pass |
| `src/lib/shell/DashboardNav.svelte` | Phone nav, exact names | VERIFIED | See GAP-WR01 |
| Four table `.scroller` components | Stacking isolation | VERIFIED | See G-07-5 |
| `README.md` "Publishing to GitHub Pages" | Runbook, preconditions, rollback | VERIFIED | Lines 118+; preconditions and deferral recorded; omits WR-04 (see warning) |
| ROADMAP SC2/SC3 amendments | D-06, D-09 | VERIFIED | Present in ROADMAP Phase 7 section |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `deploy.yml` build job | `tests/deploy/playwright.gate.config.ts` | `playwright test -c ...` before upload step | WIRED |
| `deploy.yml` smoke job | `tests/deploy/playwright.live.config.ts` | `LIVE_URL` from deploy job output | WIRED |
| `deploy.yml` preflight | `ci.yml` | `gh api .../workflows/ci.yml/runs?head_sha=...&event=push&branch=main&status=success` | WIRED |
| `ChartTooltip.svelte` | `tooltip-pin.ts` | pure decision functions | WIRED |
| Table components | page stacking context | `isolation: isolate` on `.scroller` | WIRED |

### Data-Flow Trace (Level 4)

Not applicable beyond Phase 4-6 data paths: this phase adds layout, interaction and CI. The gate imports a real logins export through the built app and observes the city request, so the city path is exercised with real data flow in CI only.

### Behavioral Spot-Checks (run this session)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Nav exact names + paint order | `playwright test tests/e2e/shell/scroll-nav.spec.ts -g "phone-names\|stacking" --project=chromium` | 6 passed | PASS |
| Full e2e (both projects) | `pnpm exec playwright test` | 257 passed | PASS |
| Unit suite | `pnpm run test:unit` | 81 files, 2487 passed | PASS |
| Typecheck / lint | `pnpm run check`, `pnpm run lint` | 0 errors, 0 warnings; prettier and eslint clean | PASS |
| Deploy gate on local build | `VITE_BASE=/wot-gdpr-stats-visualizer/ playwright test -c tests/deploy/playwright.gate.config.ts` | 5 passed, 4 failed only on missing real city dataset (expected locally) | PASS (expected residue) |

One transient observation: the first `tests/unit/guards` run died with SIGKILL in `webserver-teardown.test.ts` and a Playwright `localhost:4173 already used` error preceded it; both are port/process contention from an earlier process and did not recur on re-run (guards 223/223).

### Probe Execution

Step 7c: SKIPPED. No `scripts/*/tests/probe-*.sh` exists and no PLAN declares a probe path.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| PLATFORM-01 (responsive, usable at phone width) | 07-03, 07-04, 07-05, 07-06, 07-07, 07-08 | SATISFIED | Truths 1 and 2 verified; both gaps closed. REQUIREMENTS.md still reads "Gaps Found" / unchecked (lines 50 and 112); it should be updated to Complete by the orchestrator. |
| PLATFORM-03 (static site on GitHub Pages via `actions/deploy-pages`) | 07-01, 07-02, 07-06 | NEEDS HUMAN | Workflow and gate are implemented and guarded; no deployment has happened (owner-deferred). Leave Pending until a live dispatch succeeds. |
| PLATFORM-02 (zero-network) | Phase 1 (not claimed here) | n/a | Standing check; still green in the 257-test run and in the gate's zero-network tests. Not an orphan of this phase. |

No orphaned requirement IDs: REQUIREMENTS.md maps only PLATFORM-01 and PLATFORM-03 to Phase 7, and both appear in plan frontmatter.

### Anti-Patterns Found

`grep TBD|FIXME|XXX` over `src tests .github README.md`: none. No stubs found in the touched components. Review findings (07-REVIEW.md) are 0 critical, 5 warnings, 11 info; all 16 rows in `07-REVIEW-DISPOSITION.md` still read `open`.

| Item | Severity | Impact |
|------|----------|--------|
| WR-04: `ci.yml` is `runs-on: self-hosted` with a bare `pull_request` trigger; the repo must go public for free Pages | WARNING | Once public, a fork PR can execute code on the owner's persistent runner, and the deploy preflight trusts that workflow's result. Not a must-have truth, but should be decided before the visibility change. Listed under human verification. |
| WR-01 still `open` in the disposition ledger | INFO | Fixed by 07-07 (verified above); ledger is stale, should be marked `fixed`. |
| WR-02 (touch opens on `pointerdown`, pan or scroll pins then silently dismisses), WR-03 (main-only enforced only inside the workflow; README calls the environment restriction optional), WR-05 (smoke job deadline ordering), IN-01 to IN-11 | WARNING / INFO | Untriaged, none blocks a must-have. UAT passed with 0 issues. |

### Deferred Items

Not a later-phase deferral (Phase 7 is the last phase). The live deployment, UAT tests 2 and 6, and the repo-visibility/Pages preconditions are owner-deferred and listed under human verification.

### Human Verification Required

See frontmatter `human_verification`: (1) first deploy dispatch and live-URL check, (2) city opt-in on a real phone, (3) WR-04 runner decision before going public, (4) optional real screen reader and real-device pass.

### Gaps Summary

No code gaps. GAP-WR01 and G-07-5 are closed with discriminating, red-first tests that pass again in this session; the full suite is green (257 e2e, 2487 unit, check and lint clean). The only residue is the consciously deferred first deployment and real-phone city load (SC4 and the runtime half of PLATFORM-03), plus an unfixed-and-untriaged review warning (WR-04) whose risk activates only when the repository becomes public.

---

_Verified: 2026-10-06T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
