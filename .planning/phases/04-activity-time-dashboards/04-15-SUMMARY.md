---
phase: 04-activity-time-dashboards
plan: 15
subsystem: worker
tags: [gap-closure, split-selector, per-game, d-03, ui-copy, ui-spec, privacy]

requires:
  - phase: 04-activity-time-dashboards
    provides: >-
      04-14's per-file session sources and the game carried on every
      SplitSession (`WOT_Game_Sessions.csv` -> `WOT`, read from the file NAME and
      upper-cased), its real-shape fixture with the hand-derived
      REAL_SHAPE_WOT / REAL_SHAPE_WOWS / REAL_SHAPE_ALL keys, its browser spec
      whose closing assertion is that a ONE-game export has no selector, and a
      mixed-export worker test that asserts the All slice only so this plan's
      change of what a mixed export splits on cannot break it; 04-06's split
      rule, its per-value slices and its SERVER_NAME tracer; 04-03's per-second
      oracle; 04-01's worker message contract and per-slice PlaytimeSlice.
provides:
  - >-
    src/lib/playtime-shared.ts: `SplitColumn` is now `'GAME' | 'SERVER_NAME' |
    'CLIENT_PLATFORM'` and `SPLIT_COLUMNS` is `['GAME', 'SERVER_NAME',
    'CLIENT_PLATFORM']`, so the real export's only candidate column is considered
    first. The comments say why: the export names the game in the session file's
    name, and a legacy `Sessions.csv` names none, so its one null game never
    qualifies alone.
  - >-
    src/lib/worker/playtime.ts: `splitValueOf`, ONE exhaustive accessor over a
    `SplitValues` shape and a `SplitColumn`, replacing the three conditionals
    that guessed between the server and platform values in the split choice, the
    grouping Map and the per-value excluded count. A fourth column is a compile
    error until it is handled. `buildPlaytimeFromSources` now gives every
    EXCLUDED row the source's game beside its server and platform, so a value's
    excluded count can be the excluded rows carrying that value.
  - >-
    src/lib/ui-copy.ts: `SPLIT_COLUMN_LABELS.GAME` is `Game`. No new formatter:
    `formatSplitColumnLower`, `formatSplitCaption` and `formatSplitOverlapNote`
    are written against the one label table, so the caption reads
    `Hours by game` and the overlap note ends `…across different games`.
  - >-
    src/lib/playtime-state.ts: `splitColumnOf` accepts `GAME` beside the other
    two, so the block renders the selector, the split table and the overlap note
    for a real export. It still answers null for anything else, so an
    unrecognised name can never reach the label table.
  - >-
    src/lib/types/worker-messages.ts: comments only. `sessionsFileSeen` and the
    `no-session-file` status now say "session file" (the legacy `Sessions.csv`
    or a per-game one) and `splitColumn` lists the three columns.
  - >-
    tests/unit/ingest-worker.test.ts: a `04-15 tracer: split by game through the
    real worker` describe driving the two-game export and the one-game export
    through the real worker and the real Dexie database, with each slice
    compared field for field to its fixture key including both 168-cell hour
    grids.
  - >-
    tests/unit/playtime.test.ts: seven rows pinning the GAME column's edges from
    real-shape CSV parsed through `parseCsvFile` — excluded-only games, two files
    of one game, legacy beside real, the inclusive 50-value cap, and a code
    reading like an `Object.prototype` member. 464 lines added, 0 removed.
  - >-
    tests/e2e/playtime-real-shape.spec.ts: a second test, `two games: the Game
    selector splits every total and the login IP is nowhere on the page`, on a
    second import. 04-14's `no selector` assertion is left in place.
  - >-
    04-UI-SPEC.md: amended in place, each edit carrying a dated note. The column
    rule is three columns deep with `GAME` first and one game with rows still
    giving no selector and no message; the label and the two copy rows gain
    `Game`; the state-matrix and empty-state rows read "no session file"; the
    `Which session column identifies the title` row moves from ⚠ unresolved to
    ✅ covered. The data ramp table and every colour value are untouched.
affects: [phase-04-16, per-game-split, d-03, ui-copy, worker-messages, gap-g-04-1]

# Actuals — chars/4 over the eleven source, test and contract files this plan
# changed (61,517 chars over the 0c465a0..HEAD diff).
actuals:
  tokens: 15379
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - >-
      One column-to-value accessor, exhaustive over the union, read by the
      split choice, the grouping and the per-value excluded count alike — so a
      column added to the union cannot be half-implemented, and `tsc` refuses to
      build until it is handled.
    - >-
      A label the page may show is only as honest as where it came from: the
      game is read from the file NAME the export ships, so the selector's label
      is a claim the export itself makes rather than an inference from a cell.

key-files:
  created: []
  modified:
    - src/lib/playtime-shared.ts
    - src/lib/worker/playtime.ts
    - src/lib/ui-copy.ts
    - src/lib/playtime-state.ts
    - src/lib/types/worker-messages.ts
    - tests/unit/playtime.test.ts
    - tests/unit/ui-copy.test.ts
    - tests/unit/playtime-state.test.ts
    - tests/unit/ingest-worker.test.ts
    - tests/e2e/playtime-real-shape.spec.ts
    - .planning/phases/04-activity-time-dashboards/04-UI-SPEC.md

key-decisions:
  - >-
    `GAME` leads `SPLIT_COLUMNS` and the split rule's SHAPE is unchanged: three
    columns in order, the first with 2 to 50 distinct values among USABLE
    sessions wins. Only the first entry is new, so the legacy SERVER_NAME then
    CLIENT_PLATFORM fallback is reached by exactly the same code as before.
  - >-
    One game with rows is NOT a split and no single-value state was added. A
    lone `WOT_Game_Sessions.csv` therefore shows exactly the all-only view and
    the page says nothing about which game the file holds. This is what keeps
    04-14's closing `playtime-selector` count 0 assertion true, and it is why
    that test was left alone and a second import added instead.
  - >-
    A value's excluded count is the excluded rows CARRYING that value, which is
    why the game had to reach the excluded rows and not only the usable
    sessions. Without it the two-game fixture would have reported WOT's two
    excluded rows as belonging to no value, and the All slice's excluded count
    and the per-value counts would no longer be the same statement.
  - >-
    The excluded row's shape is named (`SplitValues`) rather than written as
    `SplitSession | ExcludedRow`: the excluded row is not a session, it has no
    start and no end, and a union would have let a future caller read a session
    field off a row that has none.
  - >-
    The browser test is a SECOND import rather than a change to 04-14's. Editing
    that test's export would have deleted the only assertion that a lone game
    file says nothing about itself.
  - >-
    `splitValueOf` is an exhaustive `switch`, not a lookup table and not a
    ternary, so the return type excluding `undefined` makes an unhandled column
    a compile error rather than a silent `undefined` value in a group key.

patterns-established:
  - >-
    "Pinned, not RED" is a real outcome and is recorded as one: a test that
    passes on arrival is evidence the previous task's rule already held, and the
    summary says which it was rather than implying every test once failed.
  - >-
    Where a test row fails on first write, the first question is whether the
    test is wrong. Task 2's duplicate-game row contradicted the plan's own
    sentence, and the fix belonged in the test.

requirements-completed: [ACTIVITY-01, ACTIVITY-02, ACTIVITY-03, ACTIVITY-04]

coverage:
  - id: D1
    description: >-
      A two-game export answers split column GAME with values WOT (12,600s) then
      WOWS (6,600s) and allSeconds 17,400, and each selected slice equals its
      hand-derived fixture key field for field, through the real worker and
      Dexie.
    requirement: ACTIVITY-01
    verification:
      - kind: integration
        ref: "tests/unit/ingest-worker.test.ts#04-15 tracer: split by game through the real worker"
        status: pass
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#a two-game export answers column GAME with both games and the All total"
        status: pass
  - id: D2
    description: >-
      One game with rows is not a split: the one-game real export still answers a
      null split and the unchanged all-only view, so a user with a single
      WOT_Game_Sessions.csv sees exactly what they saw after 04-14.
    requirement: ACTIVITY-01
    verification:
      - kind: integration
        ref: "tests/unit/ingest-worker.test.ts#one game with rows is not a split: the WOT-only export answers no split at all"
        status: pass
  - id: D3
    description: >-
      The rule for when GAME is and is not a split is pinned at its edges: a game
      on excluded rows only is not a value, two files of one game are one value,
      a legacy file beside a real one is the blank value plus WOT, a legacy file
      alone never makes GAME the split, 50 codes is a split and 51 is not, and a
      code reading like an Object.prototype member upper-cases to a plain string
      and writes nothing onto a prototype.
    requirement: ACTIVITY-02
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#04-15: the GAME split column at its edges"
        status: pass
  - id: D4
    description: >-
      Legacy exports are unaffected: every pre-existing unit test still passes,
      including 04-06's SERVER_NAME split matrix, the CLIENT_PLATFORM fallback,
      the 50-value cap on the old columns, and 04-14's own real-shape tracer and
      mixed-export test.
    requirement: ACTIVITY-02
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#chooseSplit rule matrix"
        status: pass
      - kind: integration
        ref: "tests/unit/ingest-worker.test.ts#04-06 tracer: split by SERVER_NAME through the real worker"
        status: pass
  - id: D5
    description: >-
      The copy layer has words for the column: SPLIT_COLUMN_LABELS holds Game,
      Server name and Client platform, and the lower-case name, the caption and
      the overlap note read game, `Hours by game` and the full overlap sentence.
    requirement: ACTIVITY-03
    verification:
      - kind: unit
        ref: "tests/unit/ui-copy.test.ts#the split table names the column in lower case, twice, consistently"
        status: pass
  - id: D6
    description: >-
      The block renders the Game selector: its accessible name is Game, its
      options read All, WOT, WOWS, and every tile, the excluded pill, the
      calendar's cell count and the live region follow the chosen game.
    requirement: ACTIVITY-03
    verification:
      - kind: unit
        ref: "tests/unit/playtime-state.test.ts#GAME is recognised beside them, since the export names the game in the file"
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/playtime-real-shape.spec.ts#two games (run alone, --single-process scratch config)"
        status: pass
  - id: D7
    description: >-
      T-04-01 on the new path: the login address is absent from the whole page's
      serialized HTML with a game selected, and the zero-network, one-Worker
      guard still holds through a 5,000-session import driving every selector
      value.
    requirement: ACTIVITY-04
    verification:
      - kind: e2e
        ref: "playwright: tests/e2e/playtime-real-shape.spec.ts#two games (last assertion, game selected)"
        status: pass
      - kind: e2e
        ref: "playwright: tests/e2e/zero-network.spec.ts#every selector value and chart interaction"
        status: pass
  - id: D8
    description: >-
      The whole browser suite re-runs green under the project's own Playwright
      config on a runner that can hold a browser open. This machine cannot: the
      project's own config cannot launch Chromium at all, so that run is
      unverified here.
    verification: []
    human_judgment: true
    rationale: >-
      Under the project's own `playwright.config.ts` every spec fails at
      `browserType.launch` with `bootstrap_check_in
      org.chromium.Chromium.MachPortRendezvousServer...: Permission denied
      (1100)`, a macOS sandbox restriction, so no assertion in any spec runs.
      The `--single-process` launch flag that this sandbox does allow was applied
      through a scratch config outside the repo (never committed), and under it
      the browser still dies partway through a multi-test file, so only PER-TEST
      runs are trustworthy. Every test this plan depends on was run that way and
      passed (see Verification), and no assertion failure was observed anywhere,
      but a whole-suite run has NOT been. 04-14 recorded the same finding.

# Metrics
duration: 14min
completed: 2026-10-01
status: complete
---

# Phase 04 plan 15 Summary

**The real export's split column is finally nameable: `GAME` leads the rule, read
from the session file's own name, and a user with two game files gets a Game
selector whose every total, chart and live-region summary follows the choice.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-30T20:36:40Z
- **Completed:** 2026-09-30T20:50:43Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- **D-03's open question is answered with evidence, not a guess.** The real
  export keeps playtime in `{WOT,WOTB,WOWS}_Game_Sessions.csv` and its header is
  `STARTED_AT;FINISHED_AT;IP` — so it carries neither `SERVER_NAME` nor
  `CLIENT_PLATFORM`, and the only column it can ever produce is the game. The
  selector's label is therefore the column's true name, which is exactly what
  D-03 required, and it is read from the file NAME the export ships.
- **A column is now read in one place.** The three conditionals that guessed
  between the server and the platform became `splitValueOf`, an exhaustive
  switch over the union, read by the split choice, the grouping Map and the
  per-value excluded count alike.
- **Nothing about a legacy export moved.** A `Sessions.csv` still gives game
  `null` for every session, which is one distinct value, so `GAME` cannot
  qualify alone and the `SERVER_NAME` then `CLIENT_PLATFORM` fallback runs the
  same code as before — proved by the pre-existing matrix and the 04-06 and
  04-14 suites still passing untouched.
- **A single game stays silent.** One game with rows is one value, not a split,
  and no single-value state was invented, so 04-14's `no selector` assertion is
  still true and still load-bearing.
- **The privacy integration point is covered on the new path.** The page's whole
  serialized HTML is read once with a game selected and required to be free of
  the fixture's address, which is written into every row including the excluded
  ones.

## TDD Cycles

Both `tdd="true"` tasks wrote and committed their tests before any
implementation.

**Task 2 — `da6a948` (test).** RED, on the Task 1 source: 6 of the 7 new rows
passed on arrival, as the plan predicted ("Task 1 built the rule"). One row was
red, and it was the TEST that was wrong, not the source — see Deviations 1. No
implementation commit followed, because there was nothing to implement: this
task's deliverable is the pinning.

**Task 3 — `4f5e5bd` (test) RED, then `1173b55` (feat) GREEN.** RED observed
first-hand: `AssertionError: expected null to be 'GAME'` —
`splitColumnOf('GAME')` answered `null`, so the block rendered no selector, no
split table and no overlap note for a two-game export. GREEN is
`splitColumnOf` accepting all three names the worker can produce.

## Verification

Commands run from the repository root, in this order. Exit codes are the
command's own.

| Command | Result |
|---|---|
| `pnpm run test:unit` (baseline, before any change) | 27 files, **857 passed** |
| `pnpm exec vitest run tests/unit/ingest-worker.test.ts tests/unit/ui-copy.test.ts` (Task 1 RED) | **4 failed** / 163 passed — the intended RED |
| `pnpm exec vitest run` × 5 Task 1 suites (Task 1 GREEN) | 5 files, **380 passed** |
| `pnpm run check` (after each task) | exit **0** |
| `pnpm exec vitest run tests/unit/playtime.test.ts` (Task 2) | **135 passed** |
| `pnpm exec vitest run tests/unit/playtime.test.ts tests/unit/ingest-worker.test.ts` (Task 2 verify) | 2 files, **191 passed** |
| `pnpm exec vitest run tests/unit/playtime-state.test.ts tests/unit/contrast.test.ts tests/unit/ci-budget.test.ts` | 3 files, **59 passed** |
| `pnpm run test:unit` (final) | 27 files, **868 passed** (857 + 11 new) |
| `pnpm run check` (final) | exit **0** |
| `pnpm run lint` (final, `prettier --check . && eslint .`) | exit **0** |
| `pnpm exec playwright test tests/e2e/playtime-real-shape.spec.ts` (project's own config) | **NOT RUN as a suite** — see below |
| `pnpm exec playwright test --config=<scratch> <spec> -g "<title>"`, one test per run | **1 passed** each, 13 runs |

### Playwright: what was and was not verified

Under the project's **own** `playwright.config.ts`, both tests in
`playtime-real-shape.spec.ts` fail at `browserType.launch` with
`bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer...:
Permission denied (1100)` — a macOS sandbox restriction, reproduced first-hand
here, and not a product defect. The plan's acceptance criterion "exits 0 and
reports 2 passed" is therefore **NOT RUN** under the project's own config.

To get real signal anyway, the `--single-process` launch flag that this sandbox
does allow (the workaround 04-14 recorded) was applied through a scratch config
placed **outside the repository** and never committed. Under it the browser
still dies partway through a multi-test file — exactly 04-14's finding, and the
failures are all `browserContext.newPage: Target page, context or browser has
been closed` — so **per-test runs are the only trustworthy unit**. Run that way:

- `tests/e2e/playtime-real-shape.spec.ts#real shape: a per-game export imports` — **1 passed** (04-14's tracer, no regression)
- `tests/e2e/playtime-real-shape.spec.ts#two games: the Game selector splits every total…` — **1 passed** (this plan's new test)
- `tests/e2e/playtime.spec.ts` — all **3** passed (hand fixture's SERVER_NAME selector, and WR-1/WR-2)
- `tests/e2e/zero-network.spec.ts` — all **3** passed, including the one that drives *every selector value*
- `tests/e2e/playtime-charts.spec.ts` — 4 spot-checked passed, including `selector: choosing a server changes the CHARTS, not only the tiles`
- `pnpm exec playwright test tests/e2e/playtime-real-shape.spec.ts --list` — **2 tests discovered**, so the spec parses and loads

**No assertion failure was observed anywhere.** What remains unverified is a
whole-suite run, recorded as D8 with `human_judgment: true`.

## Task Commits

Each task was committed atomically, and both `tdd="true"` tasks have their RED
commit as its own commit ahead of the implementation:

1. **Task 1: Tracer, a two-game export through the real worker answers a GAME
   split** — `111620d` (feat) — RED recorded first: 3 of the 4 new rows failed
   (`expected undefined to be 'GAME'`, `expected null to be +0`, and
   `SPLIT_COLUMN_LABELS` answering the two-entry object). Row 3 passed on
   arrival and is recorded as pinned, not RED.
2. **Task 2: The edge cases of the split rule are pinned** — `da6a948` (test) —
   RED: 1 of 7 rows, and it was a test defect (deviation 1). The remaining 6
   passed on arrival, as the plan predicted.
3. **Task 3 RED: the block must render the Game selector on a two-game export**
   — `4f5e5bd` (test) — RED observed: `expected null to be 'GAME'`
4. **Task 3 GREEN: recognise GAME so the block renders the selector** —
   `1173b55` (feat) — plus the message-type comments and the 04-UI-SPEC
   amendments

**Plan metadata:** this file, plus STATE.md and ROADMAP.md.

## Files Created/Modified

- `src/lib/playtime-shared.ts` — `GAME` added to the `SplitColumn` union and put
  first in `SPLIT_COLUMNS`, with the rationale in the comments
- `src/lib/worker/playtime.ts` — `SplitValues` and the exhaustive `splitValueOf`
  replacing three conditionals; excluded rows now carry the source's game;
  `chooseSplit`'s doc comment covers three columns and the legacy null game
- `src/lib/ui-copy.ts` — `SPLIT_COLUMN_LABELS.GAME` is `Game`, and the table's
  comment names all three
- `src/lib/playtime-state.ts` — `splitColumnOf` accepts `GAME`; nothing else in
  the module was touched
- `src/lib/types/worker-messages.ts` — comments only: "session file" instead of
  `Sessions.csv`, and `splitColumn` lists the three columns
- `tests/unit/ingest-worker.test.ts` — the `04-15` tracer describe, three tests,
  with each slice compared field for field to its fixture key
- `tests/unit/playtime.test.ts` — seven edge rows built from `buildRealShapeCsv`
  through `parseCsvFile`; 464 added, **0 removed**
- `tests/unit/ui-copy.test.ts` — the labels equality widened to three entries,
  plus the `GAME` caption and overlap-note assertions
- `tests/unit/playtime-state.test.ts` — the `GAME` recognition row
- `tests/e2e/playtime-real-shape.spec.ts` — the second browser test, on a second
  import
- `.planning/phases/04-activity-time-dashboards/04-UI-SPEC.md` — amended in
  place with a dated note at each edit; the data ramp table and every colour
  value untouched

## Deviations from Plan

### 1. Task 2's duplicate-game row contradicted the plan's own sentence (test defect, fixed in the test)

- **Found during:** Task 2 (edge cases of the split rule)
- **Issue:** the row was first written as "two WOT files → `splitColumn` is
  `GAME`", which failed with `expected null to be 'GAME'`. Re-reading the plan's
  behaviour line: "two sources with the same game code (two WOT files) are one
  value; two WOT files alone are **not** a split." The plan was right and the
  test was wrong — one distinct game is one value, which is not a split, and
  asserting otherwise would have invented a single-value state this plan
  deliberately does not add.
- **Fix:** the row now proves both halves separately. Two WOT files beside one
  WOWS file give `values` `['WOT', 'WOWS']` with WOT's ten sessions and four
  excluded rows aggregated under one value, and the same two WOT files alone
  give a null split with every row still counted in All.
- **Files modified:** `tests/unit/playtime.test.ts`
- **Verification:** `pnpm exec vitest run tests/unit/playtime.test.ts` → 135
  passed
- **Committed in:** `da6a948` (the test commit)
- **No source defect was found in Task 1's accessor or grouping.** The
  implementation was correct as written; only the test was wrong.

### 2. Two stale test titles were corrected, as the phase's recorded precedent requires

- **Found during:** Task 1 and Task 3
- **Issue:** `ui-copy.test.ts`'s "both split columns carry the label the selector
  shows" and `playtime-state.test.ts`'s "the two columns the worker can choose are
  recognised" both became false the moment a third column existed. STATE.md
  records 03-07's executor treating a stale test NAME as the same stale contract
  as a stale comment, for the same reason.
- **Fix:** "all three split columns…" and "the two **legacy** columns…". No
  assertion was changed by either rename.
- **Verification:** both files' suites pass; `git diff --numstat 5d39ae0 --
  tests/unit/playtime.test.ts` reports **0** deleted lines.

### 3. Task 2's test commit is also its only commit (no GREEN was needed)

- **Issue:** Task 2 is `tdd="true"` but its deliverable is pinning a rule Task 1
  had already built, so there was no implementation to write after the RED.
- **Fix and reasoning:** the test commit `da6a948` is scoped `test(04-15):` and
  stands alone, exactly as tdd.md's commit shape asks; the GREEN step is
  recorded as "nothing to implement". No empty or trivial `feat` commit was
  manufactured to fill a slot.

**Total deviations:** 3 (1 test defect corrected, 2 stale test titles, 1
commit-shape note)
**Impact on plan:** none on product behaviour. The plan's own code path was
implemented as written; the only change of substance was to a test that
contradicted the plan's stated behaviour.

## Issues Encountered

- **Chromium cannot launch under the project's own Playwright config.** Every
  spec fails at `browserType.launch` with `bootstrap_check_in
  org.chromium.Chromium.MachPortRendezvousServer...: Permission denied (1100)`,
  a macOS sandbox restriction reproduced first-hand here. Reported as **NOT
  RUN**, never as passing. The `--single-process` scratch-config workaround that
  04-14 recorded was reused, and per-test runs under it pass; see Verification
  for the full per-test list and D8 for what that still leaves unverified.
- **The scratch Playwright config could not be deleted.** It was written to
  `/tmp/04-15-pw.config.mts`, outside the repository, and the sandbox refused to
  move it to the trash. It is outside the repo, was never committed, and
  `git status` is clean apart from GSD's own untracked `.planning/milestone.lock`
  — it cannot affect the repository or the suite, which reads
  `playwright.config.ts`.
- **Two `-g` patterns matched nothing** during the per-test e2e runs because the
  test titles contain literal parentheses, which Playwright treats as a regex
  group. Re-run with parenthesis-free substrings; both then passed. Recorded
  because the empty result looked like a missing test.
- **An unused fixture import** (`REAL_SHAPE_WOWS`) was caught by eslint during
  Task 2 and removed rather than left to be used speculatively.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **04-16 (closes UAT G-04-5)** can proceed. G-04-1's missing item — the game
  read from the file name, and the selector splitting by game when more than one
  file has rows — is implemented, unit-proved through the real worker and
  Dexie, and browser-proved per-test.
- **The UI contract no longer carries an unresolved data question.** "Which
  session column identifies the title" moved from ⚠ unresolved to ✅ covered, and
  the state matrix and empty-state rows now say "session file" rather than
  `Sessions.csv`. A future plan amending `04-UI-SPEC.md` should keep a dated
  note per edit and must not disturb the data ramp table, which
  `tests/unit/contrast.test.ts` parses.
- **Carried forward:** the whole-suite Playwright run is still unobserved on
  this machine (D8). The next plan that changes rendering should expect to
  re-run its own affected specs per-test under the same scratch config rather
  than trusting a suite run.

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-10-01*
