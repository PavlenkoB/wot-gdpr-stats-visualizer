---
phase: 04-activity-time-dashboards
plan: 12
subsystem: testing
tags: [scale, playwright, vitest, fixture, oracle, e2e, chromium, csp, driver, deferred]

requires:
  - phase: 04-activity-time-dashboards
    provides: >-
      04-03's seeded generator with its closed-form answer key and the
      independent oracle, 04-06's D-03 split and the lazy rebuild,
      04-10's three charts and their data attributes, 04-11's browser-spec
      patterns and its cluster-at-the-gap solution to the oracle's 400-day
      guard, and the 04-01..04-11 summaries that are the authoritative record
      of all of it.
provides:
  - >-
    tests/unit/playtime-scale.test.ts: seven tests running the 5k and 60k
    presets through the worker's exact parse, buildPlaytime,
    viewFromAggregates and the three chart models, asserting the analytic key
    field by field, 4,748 calendar cells and 168 hour cells and 12 bins for
    BOTH presets, a days-times-values stored-size bound that is the same
    number for the two, both hour-grid sums reconciling with the total, and
    two time budgets.
  - >-
    tests/unit/ingest-worker.test.ts: a new describe ingesting the
    60,000-session export ONCE through the real worker and the real Dexie
    database, then three tests that only post playtime-query messages and read
    the stored meta record — the All slice, every split value, and the stored
    aggregate's size and address-freedom. ingestWith gained an optional,
    defaulted timeoutMs.
  - >-
    tests/e2e/playtime-scale.spec.ts: five browser tests over ONE
    60,000-session import in a serial describe — every drawn bucket against
    the key, 5,405-vs-5,403 node-count parity against a second 5,000-session
    context, a full selector sweep, the zero-network assertion, and a return
    visit reading the stored aggregates.
  - >-
    tests/e2e/zero-network.spec.ts: one more test covering a 5,000-session
    import, every selector value and two chart interactions, with a
    securitypolicyviolation listener that records the directive NAME only.
  - >-
    .claude/skills/run-data-export-viewer/sessions-csv.mjs plus a driver and
    SKILL.md update: the repo's own demo now carries the real six-column
    Sessions shape, with a browser-free --check that re-derives the demo's
    tiles.
  - >-
    A MEASURED negative result: 04-11's cluster-at-the-gap solution to the
    oracle's 400-day bitmap guard does NOT extend to 60,000 sessions, because
    a dense twelve-year set has no gap wide enough to split at. The
    closed-form fixture key is the instrument at that scale, and the test that
    says so is committed.
  - >-
    A RECORDED DEFERRAL: no real Wargaming export exists on this machine, so
    the human check that would close the A1/A2 column-name and timestamp-shape
    assumptions was not performed and must not be reported as passed.
affects: [04-13, verify-work]

actuals:
  tokens: 74000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "The heavy import lives in ONE beforeAll with an explicit hook timeout,
      and the tests after it only post queries. A per-test import would make
      the file's wall-clock a function of its test count."
    - "The stored-size bound is written out TWICE on purpose, once in the pure
      test and once in the worker test, each pointing at the other. A shared
      helper would let the constant move on one side of the worker boundary
      while the other claim stayed quiet."
    - "Node-count parity is asserted as an ABSOLUTE DIFFERENCE between the two
      presets, never as a ratio, because the only nodes allowed to move are
      the two legends' level swatches."
    - "A CSP violation listener records the violated directive NAME and never
      the blocked address or row content: the instrument that proves data does
      not leave the machine must not be the thing that copies it out."
    - "The demo data lives in its own dependency-free module with a --check
      mode, so a change to the demo is verified in Node rather than by
      re-reading a screenshot."

key-files:
  created:
    - tests/unit/playtime-scale.test.ts
    - tests/e2e/playtime-scale.spec.ts
    - .claude/skills/run-data-export-viewer/sessions-csv.mjs
  modified:
    - tests/unit/ingest-worker.test.ts
    - tests/e2e/zero-network.spec.ts
    - .claude/skills/run-data-export-viewer/driver.mjs
    - .claude/skills/run-data-export-viewer/SKILL.md

metrics:
  duration: 62min
  completed: 2026-09-30
  status: complete

coverage:
  - id: ACTIVITY-01
    description: "Total hours / sessions / active days summary, exact at 60,000 sessions through the real worker and on the rendered tiles"
    verification:
      - type: unit
        target: "tests/unit/ingest-worker.test.ts (04-12 scale tracer, test 1)"
        status: pass
      - type: unit
        target: "tests/unit/playtime-scale.test.ts (test 2, analytic key)"
        status: pass
      - type: e2e
        target: "tests/e2e/playtime-scale.spec.ts (test 1, totals tiles step)"
        status: pass
    human_judgment: false
  - id: ACTIVITY-02
    description: "Calendar heatmap draws one cell per day in the active years, equal to the key, at 5k and 60k sessions alike"
    verification:
      - type: unit
        target: "tests/unit/playtime-scale.test.ts (test 3, 4,748 cells for both presets)"
        status: pass
      - type: e2e
        target: "tests/e2e/playtime-scale.spec.ts (test 1 calendar step, every cell by day/seconds/sessions)"
        status: pass
    human_judgment: false
  - id: ACTIVITY-03
    description: "Weekday-by-hour grid holds 168 cells, both bases stored, and the rendered basis reconciles with the total at scale"
    verification:
      - type: unit
        target: "tests/unit/playtime-scale.test.ts (tests 3 and 5, both grids summed)"
        status: pass
      - type: e2e
        target: "tests/e2e/playtime-scale.spec.ts (test 1 hour-grid step, 168 cells against HOUR_GRID_BASIS)"
        status: pass
    human_judgment: false
  - id: ACTIVITY-04
    description: "Session-duration distribution holds 12 bins summing to the Sessions tile at 60,000 sessions"
    verification:
      - type: unit
        target: "tests/unit/playtime-scale.test.ts (test 3) and the worker tracer (test 1)"
        status: pass
      - type: e2e
        target: "tests/e2e/playtime-scale.spec.ts (test 1 duration step)"
        status: pass
    human_judgment: false
  - id: SCALE-CRIT-5
    description: "ROADMAP success criterion 5: 50k+ sessions over 10-15 years render every chart without freezing, and node count follows buckets not sessions"
    verification:
      - type: unit
        target: "tests/unit/playtime-scale.test.ts (71,843 sessions, 13 years, equal model sizes and an equal stored-size bound)"
        status: pass
      - type: e2e
        target: "tests/e2e/playtime-scale.spec.ts (test 2: 5,405 nodes at 60k vs 5,403 at 5k)"
        status: pass
      - type: e2e
        target: "tests/e2e/playtime-scale.spec.ts (import 1,463 ms, no long task over 1,000 ms in a sweep or an interaction)"
        status: pass
    human_judgment: false
  - id: T-04-21
    description: "Zero-network holds over the large playtime flow: no request, no second worker, no securitypolicyviolation"
    verification:
      - type: e2e
        target: "tests/e2e/playtime-scale.spec.ts (test 4, 60,000 sessions)"
        status: pass
      - type: e2e
        target: "tests/e2e/zero-network.spec.ts (new test, 5,000 sessions, every selector value)"
        status: pass
    human_judgment: false
  - id: T-04-01
    description: "The Sessions address column is never read, stored or rendered — at scale, on the stored aggregate"
    verification:
      - type: unit
        target: "tests/unit/ingest-worker.test.ts (04-12 scale tracer, test 3, the fixture address against the stored JSON)"
        status: pass
    human_judgment: false
  - id: DEMO-SHAPE
    description: "The repo's headless demo drives the real six-column Sessions shape and screenshots the Playtime block"
    verification:
      - type: script
        target: "node .claude/skills/run-data-export-viewer/sessions-csv.mjs --check"
        status: pass
      - type: manual
        target: "driver.mjs run against pnpm run preview in real Chromium: 31.2 hours, 30 sessions, 21 active days, 4 selector options, 366 calendar / 168 hour / 12 duration cells, 03b-playtime.png"
        status: pass
    human_judgment: false
  - id: REAL-EXPORT-CHECK
    description: "A human runs one real Wargaming export through the app, closing the UI-SPEC column-rule row and the A1/A2 column-name and timestamp-shape assumptions"
    verification: []
    human_judgment: true
    rationale: >-
      DEFERRED — no real export exists on this machine. tests/fixtures/private/
      does not exist and nothing was downloaded or fabricated, so there is
      nothing to check against. The Sessions column names and the timestamp
      format have been fixture-derived assumptions (A1/A2 in 04-RESEARCH.md)
      since 04-01 and remain UNCONFIRMED. A mismatch would exclude every row
      rather than mis-bucket, by design, so the failure mode is a visibly empty
      Playtime block — loud, not silent. Only a human holding a real export can
      close this.
---

# Phase 04 Plan 12: Scale proof at 5k and 60k sessions, driver update, real-export check

**A 71,843-session, thirteen-year export is proven equal to its analytic answer key through the real import worker, in pure code and cell for cell in Chromium, with the charts' DOM at 5,405 nodes against 5,403 for a 5,000-session export over the same years — and the one check that would confirm the Sessions column names against a real file is recorded as deferred, not passed.**

## Performance

- **Duration:** 62 min
- **Started:** 2026-09-30T09:59:49+04:00
- **Completed:** 2026-09-30T11:02:00+04:00
- **Tasks:** 3 (2 fully, 3 minus the unavailable real-export check)
- **Files modified:** 7 (3 created, 4 modified)
- **Commits:** 3

## Accomplishments

- **The scale criterion is proven at three levels.** Worker level: one
  60,000-session import through the real worker and the real Dexie singleton,
  then the All slice, every one of the five split values and the stored
  aggregate compared to the fixture's closed-form key field by field. Pure
  level: the same preset through the worker's exact parse, aggregate, view and
  the three model builders. Browser level: every drawn cell, hour cell and
  duration bin on the page.
- **Model size, stored size and DOM node count all follow buckets.** Both
  presets draw 4,748 calendar cells, 168 hour cells and 12 bins. The stored
  aggregate is 108,629 bytes at 5,000 sessions and 332,502 at 60,000, both
  inside a 591,752-character bound derived from days × values — and the bound
  is the *same number* for the two, which is the whole claim.
- **The node-count proof is a measurement, not an estimate.** 5,405 nodes at
  60,000 sessions against 5,403 at 5,000: a difference of 2, against a slack of
  24 for the two legends. `CHART_OVERHEAD_NODES` was set to the measured
  overhead (657) plus the plan's 100, not the plan's 800 estimate.
- **The oracle's 400-day guard was measured, not assumed.** 04-11's
  cluster-at-the-gap solution does **not** extend to 60,000 sessions, and the
  reason is now a committed test rather than a footnote: a cluster is only
  split off at a gap *wider* than the guard, so the split exists exactly when
  the data is sparse, and 71,843 sessions over twelve years leaves exactly one
  gap — before the stray 1970 row.
- **The repo's own demo was lying about the export shape.** Its inline
  two-column `Sessions.csv` is classified `no-usable-sessions` by the Phase 4
  pipeline, so every Playtime screenshot since 04-01 would have shown an empty
  block. It now carries the real six-column header, and the driver run in real
  Chromium hit every hand-derived number.

## The measured numbers, for plan 04-13

Plan 04-13 budgets CI from these. They are measured, not projected.

| Measurement | Value | Budget |
| --- | --- | --- |
| `buildPlaytime`, 71,843 sessions, 13 years (Node) | **63.7 ms** | 5,000 ms |
| Three model builders together (Node) | **2.3 ms** | 2,000 ms |
| Same, 5,000-session preset (Node) | 9.4 ms / 2.9 ms | — |
| Worker-level 60,000-session import (parse + Dexie write + aggregate) | **1,570 ms** | 60,000 ms |
| Browser: submission → `data-state="ready"`, 60,000 sessions | **1,463 ms** | 60,000 ms |
| Browser: return visit (reload, no import) | **132 ms** | 15,000 ms |
| Browser: a selector change back to `ready` | well inside 5,000 ms | 5,000 ms |
| Longest recorded long task during import, sweep and interaction | **none over 1,000 ms** | 1,000 ms |
| `pnpm run test:unit` wall clock, whole suite | **3.2 s** (was 1.55 s) | 90 s |
| `pnpm exec playwright test` wall clock, whole suite | **40.7 s** (was ~41 s) | 8 min globalTimeout |

**Fixture cost.** The 60,000-session export is 0.78 MiB zipped and 4.49 MiB of
CSV, with 71,849 data rows; the 5,000-session one is 0.07 MiB.

**`--list` totals, per file, after this plan:**

| Spec | Tests |
| --- | --- |
| `playtime.spec.ts` | 1 |
| `playtime-charts.spec.ts` | 16 |
| `playtime-scale.spec.ts` | **5** (new) |
| `zero-network.spec.ts` | **3** (2 existing + 1 new) |
| **Whole suite** | **109 tests in 10 files** (was 103 in 9) |

**On 04-11's cap.** 04-11 recorded a 16-test cap for `playtime-charts.spec.ts`
and 36 for the two playtime files together, and noted that the two actually
list 17. This plan adds neither to those two files: `playtime.spec.ts` (1) plus
`playtime-charts.spec.ts` (16) is still **17**, inside the 36. The new file
brings the suite to 109, and 04-13's arithmetic should use 109 and a 40.7 s
local wall clock, not 103.

**The CI budget rule held.** The 60,000-session export is built at exactly one
call site and imported into exactly one browser page in the whole suite. The
node-count comparison and the zero-network extension both use the cheaper
5,000-session preset, the latter in the spec that already imports one. The
plan's own rule is verified by grep: `buildSessionsExport(SCALE_60K_SPEC)`
prints 1 in `playtime-scale.spec.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer, a 60,000-session export through the real worker, plus the 5k-versus-60k model-size proof** - `ae62d87` (test)
2. **Task 2: Browser scale specs and the zero-network extension over the large flow** - `ce95a11` (test)
3. **Task 3: Update the headless driver and its skill notes to the real six-column Sessions shape** - `36b5f36` (feat)

**Plan metadata:** `skipped_gitignored` does not apply — `.planning/` is
tracked (113 files), so the summary/state/roadmap commit below is a real one.

## Files Created/Modified

- `tests/unit/playtime-scale.test.ts` (new) — the pure-level scale proof: both
  presets through parse → aggregate → view → the three models, the analytic key
  field by field, the days × values stored-size bound, the hour-grid sums, two
  time budgets, and the measured oracle-cluster result.
- `tests/unit/ingest-worker.test.ts` (extended) — `ingestWith` gained an
  optional defaulted `timeoutMs`; a new describe ingests the 60,000-session
  export once in a `beforeAll` carrying an explicit 180,000 ms hook timeout and
  runs three 30,000 ms query tests after it.
- `tests/e2e/playtime-scale.spec.ts` (new) — five browser tests over one
  serial describe and one shared 60,000-session import.
- `tests/e2e/zero-network.spec.ts` (extended) — one new test; the two existing
  ones are unchanged in behaviour.
- `.claude/skills/run-data-export-viewer/sessions-csv.mjs` (new) — the demo
  Sessions.csv builder and its `--check` self-verification.
- `.claude/skills/run-data-export-viewer/driver.mjs` — imports the builder,
  waits for `playtime[data-state="ready"]`, logs tiles and counts, shoots
  `03b-playtime`. Every later milestone is unchanged.
- `.claude/skills/run-data-export-viewer/SKILL.md` — the new driver step, the
  new screenshot, and the browser-free `--check` command.

## Decisions Made

- **The oracle is not an instrument at 60,000 sessions, and that is now a
  committed test rather than a claim.** 04-11 solved the 400-day per-second
  bitmap guard by clustering at wider gaps and summing, with both safety
  properties asserted inside the helper. That composition is exact only when
  the data is SPARSE enough to have gaps wider than the guard. A 71,843-session
  twelve-year set is about seventeen sessions a day and the layout fills each
  year exactly, so it yields exactly two clusters under the rule — the 1970
  stray and everything else — and the second is itself wider than the guard.
  The instrument here is therefore the fixture's CLOSED-FORM key, which never
  calls the aggregator at all and is a stronger independence claim than the
  oracle. `test 7` in `playtime-scale.test.ts` proves the cluster count, both
  of 04-11's safety properties at this scale, and the over-guard body, so a
  future reader sees the boundary instead of an omission.
- **The stored-size bound is written out twice, once per file.** A single
  shared helper would let the constant be changed on the pure side while the
  worker-side bound silently moved with it, and the two claims are meant to be
  independent — one is about the pipeline, the other about what lands in
  IndexedDB. Each copy names the other.
- **The session ratio is asserted as the scale claim and used as no bound
  anywhere.** "12× the sessions, so at most 12× the size" is false: a
  per-value slice fills its day array *faster* than the All slice as sessions
  grow (at 60,000 sessions each value covers 4,023–4,083 of the 4,748 possible
  days; at 5,000 it covers 890–982). The bound is days × values; the ratio
  appears once, as the claim that 12× the sessions and 12× the model size
  disagree.
- **Node-count parity is an absolute difference, not a ratio.** The only nodes
  allowed to differ are the two legends' level swatches — the calendar's rank
  scale collapses duplicate levels differently when the distribution changes.
  Five nodes per legend is a 24-node slack; a ratio would have let a real
  regression through.
- **`CHART_OVERHEAD_NODES` is the measured value plus 100.** The plan's 800
  was an estimate; the measured overhead is 657, so the constant is 757,
  putting the ceiling at 5,505 — inside the plan's 5,748 + 1,500 = 6,248 and
  tight enough that one node per session would fail by three orders of
  magnitude.
- **The traffic recorder splits its listeners the way Playwright's types
  force.** `BrowserContext` has a `request` event but no `worker` event, so
  requests are counted on the context and workers on the page. Listening on the
  context also catches a request from a sub-frame or a worker, not only the top
  document's.
- **The long-task buffer is reset through a page-side resetter rather than a
  sleep.** `grep -c "waitForTimeout" tests/e2e/playtime-scale.spec.ts` prints
  0, and every wait in the file is on an attribute or a locator, so no
  assertion races a guessed duration.

## Deviations from Plan

### Auto-fixed Issues

**1. [TDD scope — test count] The pure-level scale file has seven tests, not six.**
- **Found during:** Task 1
- **Issue:** The plan's `<verify>` says "fewer than six from the
  playtime-scale file", so six is a floor and a seventh passes — but the
  `<action>` says "then six tests", and the seventh is not in the plan.
- **Fix:** The seventh is the measured oracle-cluster result described above.
  The briefing for this plan required the 400-day guard to be "handled with
  the 04-11 cluster approach, with its safety assertions still proven at this
  scale rather than assuming", and the honest answer turned out to be that the
  approach does not extend. Recording that as a test is what stops it being
  re-attempted in Phase 5 as though it were an oversight. It runs in the
  existing `beforeAll`'s data, so it costs no extra setup.
- **Files modified:** `tests/unit/playtime-scale.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/playtime-scale.test.ts` →
  7 passed. It is additive: the plan's six tests are unchanged.
- **Committed in:** `ae62d87` (part of task commit)

**2. [Constant accuracy — measured value] `CHART_OVERHEAD_NODES` is 757, not 800.**
- **Found during:** Task 2
- **Issue:** The plan's 800 was an estimate of the fixed node cost, with an
  explicit instruction to measure it and, if different, set it to the measured
  value plus 100 provided the total stays under cells + 1,500.
- **Fix:** Measured 657 (5,405 nodes over 4,748 cells) at 60,000 sessions and
  655 at 5,000. Set to 757. The 60,000-session total of 5,405 is 843 below the
  plan's 6,248 ceiling.
- **Files modified:** `tests/e2e/playtime-scale.spec.ts`
- **Verification:** All five browser tests pass with 757; the measured values
  are recorded in the constant's own comment.
- **Committed in:** `ce95a11` (part of task commit)

**3. [Instrument limitation — in-test bug] Two probes in the oracle-cluster test
were wrong about the data, and were fixed rather than the app.**
- **Found during:** Task 1
- **Issue:** (a) The probe's usability rule used `Date.UTC`, which rolls
  `2020-02-30` over into 1 March instead of refusing it, so it kept one row
  the aggregator correctly drops and the set being measured was not the set
  under test (71,844 against 71,843). (b) `Math.max(...cluster)` over 71,843
  sessions is past the engine's argument limit, so the probe would have
  crashed on its own input and reported nothing.
- **Fix:** (a) A round-trip check — format the `Date` back and compare with
  the input cell — rejects the impossible date, and the assertion
  `usable.length === expected.sessions` now holds. (b) A reduce-based
  `spanOf`. Both are noted in the file, and (a) is worth knowing for 04-11's
  local converter, which has the same property and is harmless only because the
  nine-row hand fixture carries no impossible date.
- **Files modified:** `tests/unit/playtime-scale.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/playtime-scale.test.ts` →
  7 passed. No product code changed.
- **Committed in:** `ae62d87` (part of task commit)

**4. [Expectation error — display projection] The split-value assertion had to
account for the view's `null` → `''` flattening.**
- **Found during:** Task 1
- **Issue:** The first run failed comparing `view.split.values[].value` to
  `expected.values`, which holds `null` for the blank server. This is **not a
  defect**: `viewFromAggregates` flattens the stored `null` to `''` for the
  display projection, and `splitValue('')` in playtime-state maps it straight
  back to `null` before `formatSplitValue` renders `(not recorded)`. The
  distinction between a blank cell and a server literally named
  `(not recorded)` is preserved where it matters — in `aggregates.values`.
- **Fix:** Both forms are now asserted, each with a comment naming which layer
  owns which shape.
- **Files modified:** `tests/unit/playtime-scale.test.ts`,
  `tests/unit/ingest-worker.test.ts`
- **Verification:** Both files pass; `playtime-state.ts` and `ui-copy.ts` are
  unchanged.
- **Committed in:** `ae62d87` (part of task commit)

**5. [Playwright typing] The traffic recorder could not listen for `worker` on
the context.**
- **Found during:** Task 2
- **Issue:** `BrowserContext` has no `worker` event in Playwright 1.63 — a
  worker belongs to the page that spawned it. The plan's phrase "counts the
  page's requests and created workers" is satisfiable, but not with both
  listeners on the context.
- **Fix:** Requests on the context, workers on the page, which is what
  `tests/e2e/zero-network.spec.ts` already does. A context-level request
  listener still catches a sub-frame's or a worker's request, so coverage is
  not weaker.
- **Files modified:** `tests/e2e/playtime-scale.spec.ts`
- **Verification:** `pnpm run check` clean; `pnpm run lint` clean; test 4
  asserts exactly one worker, same origin.
- **Committed in:** `ce95a11` (part of task commit)

**6. [Direct-execution guard] The `--check` entry point fired on import.**
- **Found during:** Task 3
- **Issue:** The first guard compared `import.meta.url` against
  `process.argv[1]` *or* an `endsWith('/sessions-csv.mjs')` fallback. The
  fallback is true whenever the driver imports the module, so importing it
  printed the usage line and exited 1 — caught by actually running the driver,
  not by `--check` alone.
- **Fix:** The plan's comparison only, using `pathToFileURL(process.argv[1])`.
  Both entry paths verified: `--check` prints the summary and exits 0;
  `import()` is side-effect free.
- **Files modified:** `.claude/skills/run-data-export-viewer/sessions-csv.mjs`
- **Verification:** `node sessions-csv.mjs --check` exits 0;
  `node -e "import('./sessions-csv.mjs')..."` prints the header and exits 0;
  the full driver run reached the Playtime block.
- **Committed in:** `36b5f36` (part of task commit)

**Total deviations:** 6 auto-fixed (1 test-count scope, 1 constant accuracy,
2 in-test bugs, 1 expectation error against correct behaviour, 1 Playwright
typing, 1 entry-point guard)
**Impact on plan:** All six are inside test and demo-tooling files, none touch
`src/`, and none weakens an assertion. Deviations 3, 4 and 6 were each found by
running the thing rather than by reading it — which is the argument for having
run the browser suite and the driver at all.

## Issues Encountered

- **`check tdd-red-evidence` remains unusable for this phase.** It parses
  node:test TAP while vitest 5's TAP reporter nests every test under a
  file-level group, so it reports `INVALID_RED` / `zero_tests_discovered` for
  every plan in Phase 4 — 04-01, 04-09, 04-10 and 04-11 all recorded the same.
  It is not a regression introduced here. No test was weakened to satisfy it
  and no workaround was attempted. Task 1 is `<task type="tracer" tdd="false">`
  and is exempt from the RED requirement in any case, and Tasks 2 and 3 deliver
  test and tooling files, which are exempt as their own deliverable. The
  **git-log scope gate** is the working one and it passes: this plan's three
  commits are `test(04-12):`, `test(04-12):` and `feat(04-12):` under
  `^[a-z]+\((0*4)-(0*12)\):`.
- **The first run of the pure-level file passed as characterization**, which is
  what the plan predicted for a tracer over already-shipped code. No defect was
  found in `src/`. Every failure encountered during this plan was in a test's
  own expectation or in the new demo module, and each is listed above with its
  classification.
- **`.planning/milestone.lock` is an untracked GSD runtime artifact** that
  predates this session (mtime 02:10, session start 09:59) and was left by a
  prior plan. It is not scratch and not this plan's, so it was neither
  committed nor deleted. It is the only untracked path in the tree.

## User Setup Required

None — no external service configuration required.

## The real-export check: DEFERRED, and what it leaves unverified

**`tests/fixtures/private/` does not exist on this machine.** There is no real
World of Tanks export available here. Nothing was downloaded, nothing was
fabricated, and the check is **not** reported as passed. Every earlier plan in
this phase deferred exactly this check to 04-12 on exactly this basis.

**What that leaves unverified:**

1. **The Sessions column names (A1 in `04-RESEARCH.md`).** `SESSION_START`,
   `SESSION_END`, `SERVER_NAME`, `CLIENT_PLATFORM`, `CLIENT_VERSION` and
   `CLIENT_ADDRESS` have been fixture-derived assumptions since 04-01. The
   synthetic fixtures write `SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP`,
   and `resolveSessionColumns` matches the first, second, fourth and fifth by
   name after trimming and upper-casing. If a real export names them
   differently, the parser resolves no columns, `sessionsFileSeen` is still
   true, and every row is EXCLUDED rather than mis-bucketed. The failure mode
   is a visibly empty Playtime block with a large excluded pill — loud, not
   silent — which is the right way for it to fail, but it is untested.
2. **The timestamp shape (A2).** That real exports write `YYYY-MM-DD
   HH:MM:SS` with no zone offset. The two frozen rejections from 04-03 — a
   timestamp without seconds, and a `+00:00` offset — remain exactly as they
   were, deliberately unfixed, because unfixing them without a real sample
   would be guessing. If a real export carries an offset, every row is
   excluded, on the same loud path.
3. **The split-column rule against real data.** `chooseSplit` takes
   `SERVER_NAME` when it holds 2–50 distinct usable values, else
   `CLIENT_PLATFORM`, else no split. It was derived from a sample of about
   3,870 rows. Whether a real account's server column qualifies, what the value
   list looks like, and whether the excluded count is small or near-total are
   all open. The UI-SPEC's unresolved column-rule row stays unresolved.
4. **That the zero-network guarantee survives a real file.** The guard was
   proven over a 0.78 MiB synthetic zip. A real export is larger and its
   filenames and folder names are attacker-shaped in a way synthetic ones are
   not. Nothing in the pipeline makes a network call regardless — the CSP is
   `connect-src 'none'` and the guards read a `securitypolicyviolation` event,
   which a CSP-refused attempt would raise — but it has not been observed on a
   real file.

**What the synthetic work *does* prove about the column assumption, and what it
does not.** The new `sessions-csv.mjs` drives the real running app, in real
Chromium, with a six-column row carrying the assumed header, and the app reads
it: 30 usable sessions, 1 excluded row, 31.2 hours, the `SERVER_NAME` split
with three servers and a blank rendered as `(not recorded)`, 366 calendar
cells, 168 hour cells and 12 bins. So the assumption is proven **mechanically
checkable and correct against a file that uses the assumed names**: the
resolver finds the four columns it needs, the timestamp parser accepts the
`YYYY-MM-DD HH:MM:SS` shape, and the rest of the pipeline consumes the result.
It proves **nothing** about whether a real export uses those names. A synthetic
fixture that shares the assumption cannot falsify it — that is exactly why the
check is a human one, and why a green suite here is not a reason to believe it.

**What a human needs to do.** Start `pnpm run preview`, drop a real Wargaming
Data Export zip from outside the repository (or from a locally created,
gitignored `tests/fixtures/private/`), and read the Activity_history card:
the three Playtime tiles, the selector's label and options, the excluded pill,
the calendar's years and the weekday-by-hour caption. Watch the browser's
Network panel stay empty after load. Then record in this SUMMARY, with no
addresses and no file content: the chosen split column, the value list, the
total, the session count and the excluded count — which closes the UI-SPEC
column-rule row. If the excluded pill counts nearly every row, the
timestamp-shape or column-name assumption is wrong for real exports and that
must be reported before this phase's work is trusted on real data.

## Next Phase Readiness

- **Plan 04-13 can budget CI from the table above.** Suite totals: **109 e2e
  tests in 10 files**; `playtime.spec.ts` 1, `playtime-charts.spec.ts` 16,
  `playtime-scale.spec.ts` 5, `zero-network.spec.ts` 3. Unit suite: **783
  tests in 25 files, 3.2 s**. Both e2e (40.7 s) and unit (3.2 s) wall clocks
  are measured, and the 60,000-session browser import costs 1.5 s of the 8 min
  global timeout. The one number to carry forward carefully: 04-11's recorded
  "16 and 36 caps" were already exceeded by its own 17, and this plan leaves
  that pair at 17.
- **`verify-work` has a real human gate to run**, listed as `REAL-EXPORT-CHECK`
  in `coverage:` with `human_judgment: true`. Everything else in the phase is
  auto-passable, and none of it was weakened to get there.
- **No product code changed in this plan.** `src/` is untouched, no Dexie
  version bump, `HOUR_GRID_BASIS` still `overlap`, both hour grids still
  stored, `resultFromMeta` and `ClassifyResult` unchanged, one dropzone in each
  mode, the teal ramp declared once in `src/app.css`, and 04-03's two frozen
  parse rejections are still frozen.
- **The residual risk the plan carried forward stands.** The scale fixtures have
  thirteen active years (twelve plus the 1970 stray). An export with a record
  decades away from the rest is the accepted T-04-08 risk, mitigated by the
  calendar's collapsed empty-year runs and not covered here.

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-09-30*
