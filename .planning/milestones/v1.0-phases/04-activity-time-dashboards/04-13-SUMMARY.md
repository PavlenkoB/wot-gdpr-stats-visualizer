---
phase: 04-activity-time-dashboards
plan: 13
subsystem: testing
tags: [ci, playwright, vitest, budget, timeout, workflow, guard, measured]

requires:
  - phase: 04-activity-time-dashboards
    provides: >-
      04-11's browser chart specs and their 16/36 caps, 04-12's 5-test scale
      spec plus the zero-network extension and the --list totals (109 tests in
      10 files) it recorded for this plan, and .planning/debug/resolved/ci-e2e-cancel.md,
      which is why CI runs one worker and why Playwright's own deadline has to
      be the innermost of the three.
provides:
  - >-
    tests/unit/ci-budget.test.ts: six tests that derive the projected e2e
    duration from the Total line of `playwright test --list` and hold the three
    nested CI limits to it in order — globalTimeout >= 1.3x the projection, the
    shell wrapper >= globalTimeout + 90 s, the job >= wrapper + 300 s. Every
    constant is labelled MEASURED or ESTIMATE in the file.
  - >-
    playwright.config.ts: globalTimeout 8 min -> 15 min, with the derivation
    beside the value and the worker comment's one-worker ballpark corrected to
    what was measured.
  - >-
    .github/workflows/ci.yml: the shell wrapper 10m -> 17m and the job
    timeout-minutes 10 -> 25, each with a comment naming the limit it sits
    above and pointing at the guard.
  - >-
    The corrected arithmetic itself: the projection is 540 s over the measured
    109 tests, not the 630 s the plan pre-computed over a projected 128.
affects: [phase-05, ci-workflow, playwright-config, test-suite-growth]

# Actuals — chars/4 over the three files changed.
actuals:
  tokens: 3200
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - >-
      A budget constant lives in the guard that enforces it, labelled
      MEASURED or ESTIMATE, not in a comment that can drift from the value it
      describes.
    - >-
      Nested deadlines are asserted in order, so the innermost one (the one
      that produces a per-test diagnosis) stays innermost.

key-files:
  created:
    - tests/unit/ci-budget.test.ts
  modified:
    - playwright.config.ts
    - .github/workflows/ci.yml

key-decisions:
  - >-
    The projection uses 04-12's MEASURED scale-spec count (5), not the 6 the
    plan assumed, because the constant's whole job is to exempt the tests that
    share the 60,000-session import from the per-test price.
  - >-
    15 minutes is kept over the 12 the guard's 1.3x floor would accept, and the
    reason is written in the config: the 330 s baseline is still an estimate,
    and the headroom is deliberate, not slack the suite is meant to consume.
  - >-
    The job's non-e2e share stays 5 minutes because the unit step measured
    3.36 s against a 90 s allowance — the plan's own escalation trigger was
    never approached.
  - >-
    No test was changed, merged or removed. The plan adjusts the budget to the
    measured suite, never the suite to the budget.

patterns-established:
  - "Red-then-green on a config guard: the failing assertion names the number to re-derive."
  - "Deferred means deferred: a check with no instrument available is recorded as pending, never as passed."

requirements-completed: [ACTIVITY-01, ACTIVITY-02, ACTIVITY-03, ACTIVITY-04]

coverage:
  - id: D1
    description: >-
      A unit guard that derives the projected e2e duration from the suite's
      real test count and fails when any of the three CI limits loses its
      margin or its place in the order.
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: tests/unit/ci-budget.test.ts#CI e2e budget
        status: pass
    human_judgment: false
  - id: D2
    description: >-
      The three nested limits raised to 15 min / 17 min / 25 min with the
      derivation beside each value, and the whole 109-test e2e suite green
      under them.
    verification:
      - kind: unit
        ref: tests/unit/ci-budget.test.ts#CI e2e budget > the shell wrapper outlives globalTimeout by at least 90 s
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test — 109 passed (40.1s) on three of four full runs; one run had 1 flake, see D4"
        status: pass
    human_judgment: false
  - id: D4
    description: >-
      A pre-existing timing race in import-flow.spec.ts's busy-state snapshot,
      found on the fourth full e2e run and recorded here rather than fixed —
      it is a Phase 2 spec and this plan does not own it.
    verification: []
    human_judgment: true
    rationale: >-
      The spec snapshots the processing status text in one atomic evaluate and
      matches it against a hand-written pattern of five plain stage strings, but
      src/lib/ui-copy.ts:51 legitimately renders a per-category variant
      ("Parsing Clans (6/8)..."). When a slower run makes the snapshot land
      there, the assertion fails. 5/5 green in isolation, so the test cannot be
      called broken or fixed from here; widening the pattern (ideally derived
      from the copy module rather than re-typed) is its owner's decision, and it
      matters for CI because that runner is slower than this machine.
  - id: D3
    description: >-
      The budget derived from measured values with the plan's stale arithmetic
      corrected, and the one number that is still an estimate named as such.
    verification: []
    human_judgment: true
    rationale: >-
      The 330 s pre-phase baseline was never measured for the 86-test suite on
      any runner — it descends from a ~5.5 min figure recorded for Phase 1's
      20-test suite — and no CI run has executed the phase-4 suite. A human must
      read the first CI E2E step's duration and re-derive if it exceeds 702 s.

# Metrics
duration: 14min
completed: 2026-09-30
status: complete
---

# Phase 04 Plan 13: The CI e2e budget, derived from the suite that exists

**The three nested CI deadlines around the one-worker Playwright run are now 15 / 17 / 25 minutes, each carrying the arithmetic that produced it, and a unit test holds all three to the suite's real 109-test count — which projects to 540 s, not the 630 s the plan was written against.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-30T10:33:20+04:00
- **Completed:** 2026-09-30T10:47:00+04:00
- **Tasks:** 1
- **Files modified:** 3 (1 created, 2 modified)
- **Commits:** 1

## Accomplishments

- **The budget comes from the suite that exists.** `playwright test --list`
  reports **109 tests in 10 files**; the projection is 540 s and the three
  limits are 900 / 1020 / 1500 s, a 1.67x margin on the innermost one. The
  plan's pre-written 630 s came from a projected 128 tests that were never
  built.
- **The three limits were related to each other for the first time.** Before
  this plan the shell wrapper and the job limit were both 10 minutes, so a
  hang would have killed the run with the wrapper's bare "operation canceled"
  — the exact failure `.planning/debug/resolved/ci-e2e-cancel.md` traced —
  before Playwright's own per-test diagnosis could fire. `tests/unit/ci-budget.test.ts`
  now asserts the order, so no later edit can quietly break it.
- **The numbers in the plan that were estimates are labelled as estimates in
  the file that enforces them**, including the 330 s baseline, which is the
  weakest number in the derivation and is now named as such.
- **04-11's caps still hold against the real per-file totals**: 16 of 16 for
  `playtime-charts.spec.ts`, 17 of 36 for the two playtime files together.

## The budget, with the measured number beside every figure

| Input | Plan wrote | What I observed | Where the measured value comes from |
| --- | --- | --- | --- |
| L — the `Total:` line | 128 (86 + 36 + 6, projected) | **109 tests in 10 files** | `playwright test --list --reporter=list` |
| Pre-phase test count | 86 | **86** (109 − 17 − 6) | 03-VERIFICATION's 86/86, confirmed arithmetically |
| 04-11's contribution | up to 36 (a cap) | **17** (1 + 16) | per-file `--list` totals |
| 04-12's contribution | 6 (assumed) | **6** (5 scale + 1 zero-network) | per-file `--list` totals |
| E — the projection | 630 s | **540 s** | 330 + 5 × (109 − 86 − 5) + 120 |
| Pre-phase baseline | 330 s | **not measured — see below** | plan, carried forward |
| Seconds per added test | 5 | estimate, not measured | plan |
| Scale-spec allowance | 120 s | estimate, not measured | plan |
| Global limit | 8 min (480 s) | **15 min (900 s)** | 1.67x E; the 1.3x floor passes at 12 min |
| Shell wrapper | 10 min | **17 min (1020 s)** | 900 + 120 s |
| Job limit | 10 min | **25 min (1500 s)** | 1020 + 300 s floor, + 5 min non-e2e, + 8 min headroom |
| `pnpm run test:unit` wall clock | ≤ 90 s | **3.36 s** (real 3.54 s) | 789 tests in 26 files |
| `pnpm exec playwright test` wall clock | — | **40.9 s** real 41.15 s | 109 passed, default local workers |
| The same suite at CI's worker count | "~5.5 min locally" | **110.5 s (1.8 min)** | `playwright test --workers=1` |
| `playwright test --list` cost | — | **0.32 s** | well inside the guard's 60 s ceiling |
| CI E2E step duration | ~692 s ceiling | **PENDING — no CI run has executed the phase-4 suite** | first run on this branch |

### `--list` totals, per file, measured now

| Spec | Tests |
| --- | --- |
| `dashboard.spec.ts` | 41 |
| `playtime-charts.spec.ts` | 16 |
| `scroll-nav.spec.ts` | 13 |
| `import-failure.spec.ts` | 10 |
| `persistent-dataset.spec.ts` | 8 |
| `import-flow.spec.ts` | 7 |
| `playtime-scale.spec.ts` | 5 |
| `identity-privacy.spec.ts` | 5 |
| `zero-network.spec.ts` | 3 |
| `playtime.spec.ts` | 1 |
| **Whole suite** | **109 tests in 10 files** |

## Where the plan's pre-written arithmetic was stale

**1. The total: 128 projected vs 109 measured (90 s of phantom budget).** The
plan multiplied 04-11's *cap* of 36 by the tests it actually shipped — 17. A
cap is a ceiling, not a forecast, and 04-12 said so explicitly: "Use 109, not
103." Corrected: L = 109.

**2. The scale spec: 6 assumed vs 5 measured (5 s).** `SCALE_SPEC_TEST_COUNT`
is the count of tests exempted from the per-test price because they share one
60,000-session import. Exempting 6 exempts a test that does not exist and
under-prices the suite. Corrected: 5, which is what the file now carries.

Together these move E from 630 s to 540 s. (Using the plan's 6 with the
measured 109 would give 535 s; the guard embeds 540 s, and both clear the same
verdicts.)

**3. The 330 s baseline is weaker than the plan describes, and this is the
finding.** The plan calls it "the figure the existing config comment gives for
the 86 pre-phase tests (about 3.8 seconds each)". The comment's figure —
"~5.5 min locally" — was recorded in `ci-e2e-cancel.md` for Phase 1's
**20-test** suite, not 86. Dividing 330 by 86 to get 3.8 s/test re-interprets a
20-test measurement as an 86-test one. It is now labelled an ESTIMATE in the
guard, with the reason. The scale of the gap: the same 109 tests take 110.5 s
at CI's worker count on the development machine, so 330 s is roughly **3x the
measured local cost of the pre-phase suite**. It is kept because the
self-hosted runner is the unknown, not this machine — but it is an upper-ish
bound presented as one, and the first CI run replaces it. Nothing else in the
derivation depends on it.

**4. The RED criterion's "630 seconds".** The plan's acceptance criterion
requires the failing assertion to name the projected value, and states that
value as 630 for the planned total of 128. With the measured total the correct
figure is 540. The criterion's *mechanism* is honoured — the failure message
names the projection and the smallest passing whole number of minutes — with
the number corrected to the one the derivation actually produces. The RED
below names **540**, not 630.

## The RED and GREEN runs

Written and run against the untouched 8 / 10 / 10-minute limits first:

```
❯ tests/unit/ci-budget.test.ts (6 tests | 2 failed) 580ms
  × globalTimeout is at least 1.3x the projected e2e duration
  × the job outlives the wrapper by at least 300 s

AssertionError: Global timeout 480 s is under 1.3x the projected e2e duration
540 s for 109 listed tests; the smallest passing whole number of minutes is 12.:
expected 480 to be greater than or equal to 702

AssertionError: Job timeout 600 s must be at least wrapper + 300 s (900 s),
or the job is cancelled while the e2e step is still running.:
expected 600 to be greater than or equal to 900

 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)
```

Two tests failed, not one. The plan expected only the global-timeout margin
to fail; the job limit also failed because the pre-change job limit equalled
the wrapper exactly (10 = 10), which the plan's own 300 s floor forbids. That
is the state of the file, recorded as observed rather than narrowed to make
the RED look tidier.

After the two-file edit: `Test Files 1 passed (1) / Tests 6 passed (6)`.

**TDD: the RED requirement was met, not waived.** This plan is a config-and-test
plan, which would normally qualify for the test-and-docs exemption — but its
single deliverable is a guard over committed values, so a RED was produced and
honoured rather than assumed. `check tdd-red-evidence` returns
`INVALID_RED`/`zero_tests_discovered` for every plan in this phase (it parses
node:test TAP while vitest 5 nests tests under a file-level group); the git-log
gate is the working one and this commit carries the `test(04-13):` scope.

## 04-11's caps, checked against the real totals

| Cap | Recorded by 04-11 | Measured now | Verdict |
| --- | --- | --- | --- |
| `playtime-charts.spec.ts` ≤ 16 | 16 | **16** | holds — at the cap, not over it |
| `playtime.spec.ts` + `playtime-charts.spec.ts` ≤ 36 | 17 | **17** | holds, 19 to spare |

The suite did not grow in those two files: 04-12 added its tests to
`playtime-scale.spec.ts` (new) and `zero-network.spec.ts` (1 more).

## What 04-12 left in the record, unchanged by this plan

- **`CHART_OVERHEAD_NODES` is 757** — the measured overhead 657 plus the plan's
  100, not the plan's 800 estimate. No product defect was found at 60,000
  sessions.
- **The real-export check is DEFERRED, not passed.** Nothing in this plan
  touches it; the Sessions column names are still unconfirmed against a real
  file.
- **The oracle's 400-day guard does not extend to 60,000 sessions**, and the
  reason is a committed test rather than a footnote.
- **04-11's head-height measurement has no observable browser behaviour** — it
  is not proof of anything on its own.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the CI budget guard first, then amend the three limits with their derivation** - `1560713` (test)

**Plan metadata:** `skipped_gitignored` does not apply — `.planning/` is
tracked in this repository, so the summary/state/roadmap commit is a real one.

## Files Created/Modified

- `tests/unit/ci-budget.test.ts` (new, 204 lines) — six tests: the workflow
  parses to exactly one job limit and one wrapper; `--list` exits 0 and reports
  at least 86; the projection is the stated arithmetic; `globalTimeout` ≥ 1.3 ×
  E; wrapper ≥ global + 90 s; job ≥ wrapper + 300 s. Each failure message names
  the value to re-derive.
- `playwright.config.ts` — `globalTimeout` 8 min → 15 min and its comment; the
  worker comment's one-worker ballpark corrected to the measured 1.8 min /
  40.9 s pair. `workers`, `timeout`, `retries`, reporters and `webServer`
  untouched.
- `.github/workflows/ci.yml` — wrapper 10m → 17m, job `timeout-minutes` 10 →
  25, each with a comment. No step, trigger, cache or action version changed.

## Decisions Made

- **Used 04-12's measured 5, not the assumed 6, for the scale spec's test
  count.** The constant exists to exempt shared-fixture tests from the
  per-test price; exempting a test that does not exist under-prices the suite.
- **Kept 15 minutes rather than the 12 the guard's floor would accept**, and
  said so in the config: the floor is a minimum, the extra three minutes cover
  an unmeasured runner, and the comment states that headroom is not slack the
  suite should grow into.
- **Left the 330 s baseline in place, labelled.** Replacing it with the
  local 1-worker figure (110.5 s for 109 tests) would make the budget fit the
  machine it was measured on, which is exactly the failure mode this plan
  exists to prevent. The estimate stays, named as an estimate, with the first
  CI run to replace it.
- **Did not touch the lint red.** `pnpm run lint` fails on this machine for a
  reason that predates this plan and lives outside the repository (below).
  Fixing it here would be scope the plan does not own.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Wrong premise] The plan's test total and scale count were projections, not measurements**
- **Found during:** Task 1, deriving E from `playwright test --list`
- **Issue:** L was 128 (86 + 04-11's 36-test *cap* + an assumed 6) against a
  measured 109; `SCALE_SPEC_TEST_COUNT` was 6 against a measured 5.
- **Fix:** Used the measured values; E is 540 s. Every affected constant and
  comment in the guard and both config files carries the measured figure.
- **Files modified:** `tests/unit/ci-budget.test.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`
- **Verification:** `grep -c "540"` in the config comment; guard pins
  `projectedE2eSeconds(109) === 540`; RED message names 540.
- **Committed in:** `1560713`

**2. [Rule 3 — Blocking instrument] The plan's RED criterion names a value the corrected arithmetic no longer produces**
- **Found during:** Task 1, RED run
- **Issue:** The criterion requires the failure to name 630 s, which was the
  projection for 128 tests.
- **Fix:** The criterion's mechanism is honoured — the message names the
  projection and the smallest passing whole number of minutes — with 540 s,
  the value the measured suite produces.
- **Files modified:** `tests/unit/ci-budget.test.ts`
- **Verification:** RED output quoted verbatim above.
- **Committed in:** `1560713`

**3. [Rule 2 — Wrong premise] The 330 s baseline was presented as a measurement of 86 tests**
- **Found during:** Task 1, `git log`-free audit of the config comment against
  `.planning/debug/resolved/ci-e2e-cancel.md`
- **Issue:** The "~5.5 min" it descends from was measured for Phase 1's
  20-test suite.
- **Fix:** Labelled ESTIMATE in the guard with the reason, and the measured
  1-worker figure recorded beside it. The value is unchanged — the claim about
  it is what was corrected.
- **Files modified:** `tests/unit/ci-budget.test.ts`, `playwright.config.ts`
- **Verification:** comment text; `projectedE2eSeconds` unchanged in value.
- **Committed in:** `1560713`

---

**Total deviations:** 3 auto-fixed (2 wrong premise, 1 blocking instrument)
**Impact on plan:** All three are the corrections this plan exists to make.
No scope creep; no product code touched; no test changed.

## Issues Encountered

- **`pnpm run lint` is red on this machine, and was already red before this
  plan.** 152 problems at HEAD, 153 with the new file. Every one is a
  `tsconfigRootDir` parsing error triggered by `.kilo/worktrees/flashy-bit/`,
  a local agent worktree that lives inside the project root, is excluded via
  `.git/info/exclude` (so git does not show it) and is not in `.gitignore` (so
  eslint's default globs pick it up). It is not in the repository and cannot
  exist in CI. Scoped to the repository's own paths, `pnpm exec eslint src
  tests playwright.config.ts vite.config.ts vitest.config.ts eslint.config.js
  svelte.config.js` exits **0**, and `prettier --check .` passes on the whole
  tree. Left for its owner; adding `.kilo/` to `.gitignore` is the one-line
  fix, deliberately not done here.
- **Two tests failed in RED, not one** — recorded above rather than suppressed.
- **Test suites were run one at a time.** The unit and e2e runs were never
  concurrent, per the accumulated context's SIGKILL note.
- **A pre-existing flake in `import-flow.spec.ts` surfaced on the fourth full
  e2e run — recorded, not fixed and not hidden.** Three full runs passed
  (109/109: 40.1 s, 40.9 s, 41.15 s real) and the fourth, at 57.8 s real, had
  `import-flow.spec.ts:102` fail:

  ```
  Expected pattern: /^\s*(Checking for a duplicate\.\.\.|Unzipping\.\.\.|Classifying folders\.\.\.|Parsing categories\.\.\.|Saving to local storage\.\.\.)\s*$/
  Received string:  "Parsing Clans (6/8)..."
  ```

  The test snapshots the processing text in one atomic `evaluate` and matches
  it against a hand-written pattern of five plain stage strings, but
  `src/lib/ui-copy.ts:51` legitimately renders a per-category progress variant
  (`Parsing <category> (i/n)...`, D-08's progress reporting). When a slower run
  makes the snapshot land on that variant, the assertion fails. `--repeat-each=5`
  on that test alone: **5 passed (3.5 s)**.

  Three things make this not mine to fix here: the spec is Phase 2's
  (`import-flow.spec.ts`, 7 tests, untouched by every Phase 4 plan and by this
  one), this plan's mandate is the CI budget and explicitly forbids changing a
  test to make a number fit, and the correct fix is to derive the accepted
  pattern from the copy module rather than widen it by hand — which is the
  owner's call. It is worth fixing before the first CI run, because the
  self-hosted runner is slower than this machine and a flaky test at 1 worker
  is exactly the failure this phase's budget work cannot see from here. It is
  recorded as coverage entry D4 with `human_judgment: true`.

## User Setup Required

None — no external service configuration required. The one outstanding human
action is reading the first CI E2E step's duration (below).

## Next Phase Readiness

- **The first CI run of this branch is the outstanding measurement.** If the
  E2E step exceeds **702 s** (900 s ÷ 1.3), the constants in
  `tests/unit/ci-budget.test.ts` and the three limits are re-derived from the
  measured value in one further deliberate edit, as the plan requires. That
  check cannot be closed from this machine and is recorded as pending, not
  passed.
- **The suite can still grow by 36 tests before the guard objects** — that is
  what the 1.3x margin buys at L = 109 — and the guard's own message names the
  smallest passing number of minutes when it objects.
- **The lint red is the only defect-class finding this plan surfaced**, and it
  is outside the repository. Flagged above for its owner.

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-09-30*
