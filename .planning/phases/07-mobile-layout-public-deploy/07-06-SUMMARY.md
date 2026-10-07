---
phase: 07-mobile-layout-public-deploy
plan: 06
subsystem: docs
tags: [roadmap, readme, github-pages, deploy, manual-verification]

requires:
  - phase: 07-mobile-layout-public-deploy
    provides: "07-01 gate harness and the recorded D-12 deferral; 07-02 deploy.yml; 07-03/07-04 touch tooltips; 07-05 the 375px sweep"
provides:
  - "ROADMAP Phase 7 success criteria 2 and 3 amended to what D-06 and D-09 decided and what was built"
  - "README section 'Publishing to GitHub Pages': the four deploy jobs, owner-only preconditions, dispatch, rollback, local gate rehearsal, the shared github.io origin caveat, and the manual verification list"
  - "README note that the Playwright suite runs chromium and chromium-mobile, and names the pre-deploy gate command"
affects: [phase-07-verification, first-real-deploy]

actuals:
  tokens: 5200
  tasks: 2
  commits: 2

plan_head_before: cc6249273a71a00a7d9015c7cd336d337ea3b088
plan_head_after: 1e90e7c31c82b82dd0fcf10c2a6d23d3d31f4eb9
commits: 2

key-files:
  created: []
  modified:
    - .planning/ROADMAP.md
    - README.md

key-decisions:
  - "The README states the recorded D-12 answer as it was given (deferred: repo stays private for now) and carries repository visibility and the Pages source as unticked owner preconditions; it never implies the repository is or will be public"
  - "The README rehearsal commands were run, not just written: the gate rehearsal (9 passed) and the live-config spec against a locally served build (5 passed) both pass exactly as documented"
  - "PLATFORM-03 is deliberately NOT marked Complete: its wording is 'Deployed as a static site to GitHub Pages', and no deploy has happened or can happen before the branch is on main and the owner settings are satisfied"

requirements-completed: [PLATFORM-01]

coverage:
  - id: D1
    description: "ROADMAP Phase 7 success criteria 2 and 3 say what was decided and built, each carrying an 'amended by plan 07-06' note citing D-06 / D-09, with criteria 1 and 4 and the 06-06 amendment untouched"
    verification:
      - kind: other
        ref: "plan Task 1 <automated> command (marker count >= 2, 06-06 marker present, only the two original lines removed in git diff -U0 HEAD)"
        status: pass
    human_judgment: false
  - id: D2
    description: "README 'Publishing to GitHub Pages' section sits between 'Offline geolocation' and 'Test fixtures', names the manual main-only preflight, VITE_BASE, the real city generation, dispatch, rollback, rehearsal and the shared-origin caveat"
    verification:
      - kind: other
        ref: "plan Task 2 <automated> grep set + pnpm run lint (exit 0); heading line order 91 < 118 < 238"
        status: pass
    human_judgment: false
  - id: D3
    description: "The documented rehearsal and live-spec commands work as written"
    verification:
      - kind: other
        ref: "city fixture -> VITE_BASE build -> playwright.gate.config.ts: 9 passed; vite preview + LIVE_URL=http://localhost:4173/wot-gdpr-stats-visualizer/ -> playwright.live.config.ts: 5 passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Pages preconditions, the first real dispatch, the live city opt-in, real-phone touch feel and memory, the UI-SPEC focal-point check, the map's thumb reachability and a real screen reader speaking both announcements"
    verification: []
    human_judgment: true
    rationale: "Repository settings and a workflow_dispatch run exist only on GitHub, after merge to main; a real finger, a real phone's peak memory and a real screen reader are outside Chromium emulation. The list is recorded in the README and below."

duration: 9 min
completed: 2026-10-05
status: complete
---

# Phase 7 Plan 6: ROADMAP amendments and the Pages runbook Summary

**ROADMAP success criteria 2 and 3 now describe what was decided and built (the nav strip and shared tooltip, no popovers; a manual, CI-gated `deploy.yml`), and the README carries the publish, precondition, rollback and rehearsal runbook plus the phase's manual verification list. Docs only.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-05T17:49:31Z
- **Completed:** 2026-10-05T17:59:00Z
- **Tasks:** 2
- **Files modified:** 2 (`.planning/ROADMAP.md`, `README.md`)

## Accomplishments

- **ROADMAP criterion 2** now reads: the navigation anchor strip (the "tabs") and the shared chart tooltip work by touch, with the tap-to-pin and four-way dismissal behaviour; the application has no popovers and none is added; `amended by plan 07-06` cites D-06 and that `bits-ui` is unused. Criterion 3 now describes the built workflow (push runs CI; `deploy.yml` by `workflow_dispatch` from `main`; the green-CI preflight; GitHub-hosted build with the real DB-IP city dataset; the zero-network gate before `upload-pages-artifact@v4`; `deploy-pages@v4`; the smoke job) and cites D-09 with the rollback rule. Only those two lines were replaced; criteria 1 and 4, the 06-06 amendment and every other phase are byte-identical.
- **README "Publishing to GitHub Pages"** (between "Offline geolocation" and "Test fixtures"), in the plan's order: what the workflow is and why it is manual, the preconditions as an unticked checklist with the owner's recorded deferral, dispatch (UI and `gh workflow run deploy.yml --ref main`, no inputs), the live URL, rollback by re-running an earlier green run, the local gate rehearsal and the live-config run against a local server, the manual checks, and the caveats (shared `<owner>.github.io` origin; CSP is defence in depth). It says making the repository public is the owner's decision, not made or audited here.
- The "Verifying the privacy guarantee" section gained only the statement that Playwright runs `chromium` and `chromium-mobile` (`touch-*.spec.ts`) and names the gate command; its stale counts were left alone, as the plan directs.
- The documented commands were executed: the gate rehearsal and the live-config spec both pass as written (T-07-21).

## Task Commits

1. **Task 1: ROADMAP criteria 2 and 3** - `d940d56` (docs)
2. **Task 2: README publishing section** - `1e90e7c` (docs)

## Manual verification list (D-16, first deploy; none can run before merge to `main`)

1. Owner-only preconditions: repository visibility permits Pages (or publishing stays consciously deferred), Settings > Pages > Source = GitHub Actions, optionally restrict the `github-pages` environment to `main`. Recorded state: deferred, repo private.
2. First real dispatch from `main` after merge with green CI: preflight, build (gate), deploy and smoke jobs green; the printed URL serves the app; a real import works with an empty Network tab after load.
3. On the live URL, press the city opt-in once: exactly one request, for `geo-city-data/city-YYYY-MM.citydb.bin`, block reaches ready.
4. Real phone: tap heatmap, hour grid, bar chart and map marks; check the map's country targets with a real thumb at 375px; try the city opt-in (peak decode about 120 MB by estimate).
5. UI-SPEC focal-point check at 375x812 (count tiles, start of the login table or heatmap, the map inside the first 812px), carried from 07-05 as untestable as written.
6. A real screen reader speaks both tooltip announcements (carried from 07-03 and 07-04).

## Phase gate results (run once, last step)

| Gate | Result |
| ---- | ------ |
| `pnpm run lint` | exit 0 |
| `pnpm run check` | 0 errors, 0 warnings, 300 files |
| `pnpm run test:unit` | 80 files, 2483 tests passed |
| `pnpm exec playwright test` | 251 passed (5.2 min) |
| gate rehearsal (city fixture -> `VITE_BASE` build -> `playwright.gate.config.ts`) | 9 passed |
| live config against a locally served build | 5 passed |
| `git ls-files \| grep -E "(^\|/)(geo-city-data\|private)/\|\.citydb\.bin$"` | prints nothing |
| `git show --name-only --format= HEAD HEAD~1` | only `README.md` and `.planning/ROADMAP.md` |

## Deviations from Plan

None - plan executed exactly as written.

Two small notes that are not deviations: a line-number check run against the pre-edit numbering was re-run on the correct lines (criterion 2 is line 341, criterion 3 line 342 after the edit), and a first attempt to tweak one README word with a BSD `sed` failed harmlessly and was redone with the Edit tool.

## Issues Encountered

- A timing-sensitive pre-existing e2e check, `tests/e2e/playtime/playtime-scale.spec.ts` test 3 (long task under 1000 ms during a 60k-session sweep), failed once in 4 full-suite runs under load in an earlier plan and passed 2 of 2 in isolation. It passed in this plan's full run (251 passed). It is not a 07-0x regression and was neither changed nor mentioned in the README, which has no CI-flakiness section and where the plan did not ask for one.
- Three tracked `graphify-out/*` files remain modified in the working tree (regenerated by `graphify update .`). They are unrelated and were kept out of both plan commits.

## Authentication Gates

None. `gh` is unauthenticated on this machine (recorded by 07-01), which is why the Pages settings are owner-only checklist items rather than checks.

## Known Stubs

None. Docs only; the README's unticked checkboxes are deliberate owner preconditions, not placeholders.

## Threat Flags

None. No source, test, workflow or dependency file was touched. T-07-19 (shared `github.io` origin) and T-07-20 (making the repository public) are accepted and documented in the README as the plan specifies; T-07-21 is mitigated by executing the documented commands against the workflow and config as built.

## Self-Check: PASSED

- `README.md` and `.planning/ROADMAP.md` modified; commits `d940d56` and `1e90e7c` exist in `git log`.
- `commits: 2` measured from the persisted ledger (`cc62492..1e90e7c`).
- Task 1 and Task 2 acceptance criteria re-run and passing; plan-level verification above.
