---
phase: 07-mobile-layout-public-deploy
plan: 02
subsystem: infra
tags: [github-actions, github-pages, deploy-workflow, playwright, dbip, least-privilege, zero-network]

requires:
  - phase: 07-mobile-layout-public-deploy
    provides: "plan 07-01's Pages subpath base, the vite-preview pre-deploy gate config, and the shared deployed-build spec"
provides:
  - ".github/workflows/deploy.yml — a manual, CI-gated Pages deploy: preflight, build, deploy, smoke"
  - "scripts/geo/resolve-dbip-month.ts — prints the DB-IP month a real download would resolve"
  - "tests/deploy/playwright.live.config.ts — the post-deploy smoke config, differing from the gate only in baseURL"
  - "tests/unit/guards/deploy-workflow.test.ts — a 57-test line-based structural guard, mutation-proven"
affects: [07-04, 07-05, 07-06, deploy, release]

actuals:
  tokens: 396000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A workflow's structure is a unit-testable artifact: parse it as text and mutation-test every rule against the real file"
    - "Reordering tests splice lines structurally rather than replacing long strings"

key-files:
  created:
    - .github/workflows/deploy.yml
    - scripts/geo/resolve-dbip-month.ts
    - tests/deploy/playwright.live.config.ts
    - tests/unit/guards/deploy-workflow.test.ts
  modified: []

key-decisions:
  - "The Pages action SHAs were re-resolved with git ls-remote at execution time rather than trusted from the plan text: upload-pages-artifact v4.0.0 = 7b1f4a76…, deploy-pages v4.0.5 = d6db9016… (the newest v4 tag, not v4.0.0). The plan's values were correct."
  - "The order rules are enforced by a structural line splice, not a string replacement, because a replacement that must reproduce a dozen lines of surrounding YAML breaks when a comment is reworded and then gets 'fixed' by weakening itself."
  - "The smoke URL/entry rules key on the OUTPUT EXPRESSION (needs.deploy.outputs.page_url), not on the variable's name: a mutation that pastes the expression into a run line removes the name from that line entirely, so a name-keyed rule would have missed the exact fault it exists to catch."
  - "The wait-loop bound is capped at 100 attempts, not merely required to be numeric: `-le 999999` is formally finite and practically a hang that outlasts the job timeout while reporting nothing."
  - "The month script calls the download's own resolveDbipUrl rather than re-deriving the month, so the cache key and the downloaded file cannot name different months."

patterns-established:
  - "A guard rule is only evidence once it has been shown to fail: every rule here has at least one test that mutates the real file into exactly that fault and requires the rule under test to be the one that names it."
  - "A single fault may legitimately trip several rules, so the mutation assertions come in two shapes: `rejects` (only this rule fires) and `namesRule` (this rule is among those that fire)."

requirements-completed: [PLATFORM-03]

coverage:
  - id: D1
    description: "Deploying is a deliberate manual dispatch that cannot ship a commit without a green CI push run on main, and runs on a GitHub-hosted runner with the Pages privileges on one job"
    verification:
      - kind: unit
        ref: "tests/unit/guards/deploy-workflow.test.ts — 6 tests over the trigger, the preflight literals, the job graph, the runner, and the Pages privileges (16 mutation tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The real DB-IP city file is cached by its resolved month, generated before the build, and verified on the shipped artifact before upload"
    verification:
      - kind: unit
        ref: "tests/unit/guards/deploy-workflow.test.ts — the eight build-step order assertions plus the cache-hit condition, absent fallback list, cache key, entry output and gate-month rules (11 mutation tests)"
        status: pass
      - kind: other
        ref: "node scripts/geo/resolve-dbip-month.ts → 2026-10, exit 0, against the real download.db-ip.com"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero-network is verified on the artifact before upload and on the live URL after deploy, and a live failure turns the run red"
    verification:
      - kind: e2e
        ref: "tests/deploy/deployed-build.spec.ts under tests/deploy/playwright.live.config.ts — 5 passed against a locally served build at http://localhost:4173/wot-gdpr-stats-visualizer/"
        status: pass
      - kind: other
        ref: "the wait step's shell script run verbatim against that same page with the real entry name assets/index-CpHx53r-.js → 'serves after 1 attempt(s)', exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The workflow's whole structure is under a mutation-tested guard with no YAML library and no new dependency"
    verification:
      - kind: unit
        ref: "tests/unit/guards/deploy-workflow.test.ts — 57 tests, 46 of them mutations of the real deploy.yml"
        status: pass
    human_judgment: false
  - id: D5
    description: "The first real workflow run: a dispatch on main that publishes the site, proves the live URL, and is reported to the maintainer"
    verification: []
    human_judgment: true
    rationale: "The workflow cannot execute before it is merged, and the repository answers 404 to an unauthenticated probe (plan 07-01 recorded the same), so no part of this deliverable is observable until the manual dispatch in plan 07-06. Carried there as the checklist item."

duration: 47 min
completed: 2026-10-05
status: complete
---

# Phase 7 Plan 2: The manual, CI-gated Pages deploy workflow Summary

**A `workflow_dispatch` deploy that cannot ship an unverified commit, generates the real DB-IP city dataset before it builds, proves the artifact before upload and the live URL after — with every structural rule mutation-tested against the real file**

## Performance

- **Duration:** 47 min
- **Started:** 2026-10-05T19:20:00Z
- **Completed:** 2026-10-05T20:07:00Z
- **Tasks:** 3
- **Files modified:** 4 created, 0 modified

## Accomplishments

- `.github/workflows/deploy.yml`: four jobs — `preflight` (main-only, green-CI-only, `actions: read` alone), `build` (contents: read, resolves the DB-IP month, caches the city dataset by it, generates on a cache miss, builds, reads the hashed entry script, runs the pre-deploy gate, then uploads `dist` and nothing else), `deploy` (the only job with `pages: write` + `id-token: write`, on `github-pages`, publishing `page_url`), and `smoke` (contents: read, waits boundedly for this build's entry script on the live HTML, then runs the shared spec).
- `scripts/geo/resolve-dbip-month.ts`: runs the shared `resolveDbipUrl`, prints one `YYYY-MM` line, exits non-zero with empty stdout on failure. **Run for real: `2026-10`, exit 0.**
- `tests/deploy/playwright.live.config.ts`: differs from the gate config in exactly one thing — its `baseURL` — and launches no server.
- `tests/unit/guards/deploy-workflow.test.ts`: 57 tests over 28 rules, 46 of which are mutations of the real workflow. No YAML library, no dependency (T-07-SC).

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — dispatch to preflight to build to deploy, with the structural guard** - `5f656ba` (feat)
2. **Task 2: Fill the build job — month, cache, generation, build, entry, gate, upload** - `a5430be` (feat)
3. **Task 3: The post-deploy smoke job and the live config** - `b0ab885` (feat)

**Plan metadata:** this commit

## Files Created/Modified

- `.github/workflows/deploy.yml` — the deploy workflow, 277 lines
- `scripts/geo/resolve-dbip-month.ts` — the month resolver, 46 lines
- `tests/deploy/playwright.live.config.ts` — the smoke config, 111 lines
- `tests/unit/guards/deploy-workflow.test.ts` — the structural guard, 1130 lines

## Verification results

| Check | Result |
|---|---|
| `vitest run tests/unit/guards/deploy-workflow.test.ts` | **57 passed** (plan required ≥ 20) |
| `vitest run tests/unit/guards/ci-budget.test.ts` | 6 passed — untouched, still green |
| `pnpm run test:unit` | **2483 passed / 80 files** |
| `pnpm run check` | 0 errors, 0 warnings, 300 files |
| `pnpm run lint` | prettier + eslint clean |
| `node scripts/geo/resolve-dbip-month.ts` | `2026-10`, exit 0 (network reachable) |
| Live-config local proof | **5 passed (9.4 s)** at `http://localhost:4173/wot-gdpr-stats-visualizer/` |
| Wait-step script run verbatim | `serves assets/index-CpHx53r-.js after 1 attempt(s)`, exit 0 |
| `git diff --quiet HEAD -- ci.yml playwright.config.ts ci-budget.test.ts package.json pnpm-lock.yaml` | exits 0 |

Acceptance criteria, all confirmed:

- `grep -c workflow_dispatch` = 1; no `push`/`pull_request`/`schedule`/`workflow_run` trigger line.
- `pages: write` and `id-token: write` appear once each, both in `deploy`.
- 5 `uses:` lines, 5 pinned to `@<40 hex> # v…`.
- No `self-hosted` anywhere.
- 25 Task-1 mutation tests; 46 mutation tests overall; all pass.
- Step order measured: month 112 → cache 125 → generate 131 → build 139 → gate 165 → upload 181.
- No `restore-keys`; `EXPECT_CITY_MONTH` on exactly one line, the gate's `env` value.
- `needs: [build, deploy]` on smoke; `continue-on-error` count **0**.
- No `GEO_FIXTURE` in `deploy.yml`, `resolve-dbip-month.ts` or anywhere under `tests/deploy`.
- `git status --short` after the proof shows no file under `public/`.
- The e2e budget was **not** touched: no limit moved, and no new e2e spec was added (the deploy specs live outside `testDir`).

## Decisions Made

- **Re-resolved the action SHAs rather than trusting the plan's text.** `git ls-remote --tags` confirmed `upload-pages-artifact v4.0.0 = 7b1f4a764d45c48632c6b24a0339c27f5614fb0b` and `deploy-pages` newest-v4 `v4.0.5 = d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`, both lightweight tags, so the listed SHA is the commit. Everything else reuses `ci.yml`'s pins verbatim, as D-10 requires.
- **Order is asserted by a structural line splice, not a string replacement.** The thing under test is a *reordering*, and a replacement that must reproduce a dozen lines of surrounding YAML breaks the moment a comment is reworded — after which the tempting fix is to weaken the test. The splice carries a step's comment lines with it, so it mutates the file the way a person editing it would.
- **The smoke URL/entry rules key on the output expression, not the variable name.** A mutation that pastes `needs.deploy.outputs.page_url` into a run line *removes* `LIVE_URL` from that line, so a name-keyed rule would pass the exact fault it exists to catch. This was found by the mutation failing, not by review.
- **The wait bound is capped at 100 attempts, not merely required to be numeric.** `-le 999999` satisfies "has an upper bound" and is a hang: it outlasts the 20-minute job timeout while reporting nothing.
- **The preflight queries `event=push&branch=main` for the head SHA**, because a pull-request run of `ci.yml` carries the PR's head commit, not the commit that landed on `main` — accepting any successful run would let an unmerged branch look verified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The trigger-block parse read a trigger that was not there**
- **Found during:** Task 1, first guard run
- **Issue:** The `on:` block was captured with a fixed-arity regex (`(?: {2}\S.*\n?)*`), which stops at the first *nested* line. `push:` brings `branches:` and `workflow_dispatch:` brings `inputs:`, both indented deeper than their key — so a `push` trigger or a declared input was read as absent, and the guard passed the file it was written to reject.
- **Fix:** The block is now read by indentation (every following line at indent ≥ 2), so nested keys are inside it. Proven by the two mutations that failed against the first version.
- **Files modified:** `tests/unit/guards/deploy-workflow.test.ts`
- **Verification:** both trigger mutations now fail as intended.
- **Committed in:** `5f656ba`

**2. [Rule 1 - Bug] A self-contradictory assertion shape made three mutation tests fail for the right reason**
- **Found during:** Tasks 1 and 3
- **Issue:** Every mutation test asserted `toEqual([stringContaining(rule)])` — exactly one problem, naming one rule. But one fault can legitimately trip one rule twice (moving `pages: write` into `build` both puts a privilege on the wrong job *and* strips it from the right one), and a run-line interpolation trips `no-interpolation`, the URL rule *and* the entry rule. The tests were demanding a coincidence, and the natural "fix" would have been to weaken a rule until the count came out right.
- **Fix:** Two assertion shapes. `rejects` requires the list to be non-empty and contain nothing but that rule; `namesRule` requires the rule to be among those that fire. The reason each test uses which shape is stated at the test.
- **Files modified:** `tests/unit/guards/deploy-workflow.test.ts`
- **Verification:** all 57 pass; the rules were not altered to fit the tests.
- **Committed in:** `5f656ba`, `a5430be`, `b0ab885`

**3. [Rule 1 - Bug] Three comment lines echoed the literals their own acceptance greps search for**
- **Found during:** Tasks 2 and 3
- **Issue:** `grep -n "restore-keys" deploy.yml` printed a *comment* explaining the absence of restore keys, and `grep -n "EXPECT_CITY_MONTH"` printed two lines (a comment and the real `env` line). This is the same class of failure STATE records for plan 04-06: a criterion that counts prose can be satisfied or broken by a comment.
- **Fix:** Reworded both comments to describe the idea in other words — "there is deliberately no prefix-fallback list", "the month the gate is told to expect". The same treatment for the live config's `webServer` comment.
- **Files modified:** `.github/workflows/deploy.yml`, `tests/deploy/playwright.live.config.ts`
- **Verification:** all three greps now print only the intended lines (or nothing).
- **Committed in:** `a5430be`, `b0ab885`

---

**Total deviations:** 3 auto-fixed (3 × Rule 1, all in the new test code itself)
**Impact on plan:** All three were defects in this plan's own new files, caught by the plan's own verify commands before their commits. No production behaviour was changed beyond the intended workflow and script, and no scope was added. **No acceptance criterion was relaxed** — in deviation 2 the *tests* were corrected to match correct behaviour, and every rule is stronger than before it.

## Issues Encountered

- **The `pkill -f "vite preview"` cleanup was correctly refused** by the permission classifier as too broad. The server this session started was identified by port (`lsof -ti:4173`), confirmed by `ps` to be exactly the `vite preview` process started here, and stopped by that exact PID. Nothing else on the machine was touched.
- **One acceptance criterion is prose-sensitive by construction.** `grep -n "LIVE_URL" deploy.yml` prints four lines, not one: the `env` line that expresses it plus three lines inside the wait script that read `$LIVE_URL` from the environment. The shell *must* name its own variable — that is the whole point of the `env` indirection T-07-06 requires. The criterion's intent (the URL is never interpolated into a command) is enforced by the `no-interpolation` and `smoke-url` rules and mutation-tested; the literal grep cannot distinguish the two cases. Recorded rather than worked around.

## User Setup Required

None - no external service configuration required. The first real dispatch is a manual verification item in plan 07-06, not a setup step.

## Next Phase Readiness

- **07-04** (touch coverage on the remaining three chart blocks) is unblocked and unaffected: no e2e limit moved, the e2e budget is still 239 tests / 23 files / E = 1243 s against a 1620 s `globalTimeout`, and 07-04 must still raise all three limits together.
- **07-05 / 07-06** can add the dispatch checklist. The inputs a first run needs are recorded: nothing manual, but the repository answers 404 to an unauthenticated API probe (recorded by 07-01), so Pages must be enabled and the `github-pages` environment must exist before the first dispatch.
- **The first real run cannot happen before merge.** Nothing in this plan is observable on GitHub until the workflow is merged and dispatched; the Vitest guard is the entire executable proof, and it is 57 tests of which 46 are mutations.

## Self-Check: PASSED

- Three task commits present (`5f656ba`, `a5430be`, `b0ab885`).
- Every Task 1 criterion, Task 2 criterion and Task 3 criterion re-run and confirmed (tables above).
- Plan-level verification: `pnpm run lint`, `pnpm run check` and `pnpm run test:unit` (80 files, 2483 tests) all pass; `ci.yml`, `playwright.config.ts`, `ci-budget.test.ts`, `package.json` and `pnpm-lock.yaml` all untouched (T-07-SC).
- The live-config proof and the wait-script proof were both run for real and recorded, then the generated city directory, `dist`, and the report directories were removed; `git status --short` shows only the three intended new/modified files.

---
*Phase: 07-mobile-layout-public-deploy*
*Completed: 2026-10-05*
