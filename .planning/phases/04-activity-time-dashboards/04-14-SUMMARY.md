---
phase: 04-activity-time-dashboards
plan: 14
subsystem: worker
tags: [gap-closure, csv, import, backfill, timestamp, fixture, oracle, privacy, per-file]

requires:
  - phase: 04-activity-time-dashboards
    provides: >-
      04-01's worker message contract and the per-slice PlaytimeSlice, 04-02's
      single-consumer Worker with a main-thread busy guard, 04-03's aggregation
      rules (D-01 no instant conversion, D-02 excluded rows counted, overlap
      merged, D-05 duration bins) and the INDEPENDENT per-second oracle in
      tests/helpers/session-oracle.ts, 04-06's lazy backfill and
      readSessionRowData, 04-08's copy for all four view statuses, 04-12's
      browser chart specs, and the synthetic Sessions.csv fixture in
      tests/fixtures/sessions-fixtures.ts that all of the above were built on.
provides:
  - >-
    src/lib/worker/playtime.ts: sessionFileNameGame and sessionFileGame, which
    read a game token out of a session file NAME (`WOT_Game_Sessions.csv` ->
    `WOT`) and reject the xlsx duplicate, a `._` sidecar, a nested path, a
    token over 24 characters and a token with a space, hyphen or angle bracket
    in it; and isSessionsRow, which now accepts both that shape and the
    synthetic `Sessions.csv`.
  - >-
    src/lib/worker/playtime.ts: a second, DAY-FIRST anchored pattern
    `DD.MM.YYYY HH:MM` for the real export's stamps, with seconds zero, both
    shapes converted by one shared range-checked `wallClockSeconds`, so an
    out-of-range month is rejected rather than swapped with the day (T-04-28).
  - >-
    src/lib/worker/playtime.ts: `STARTED_AT` and `FINISHED_AT` resolve beside
    `SESSION_START` and `SESSION_END`, by row order rather than spelling
    priority, so a hybrid header is well defined; the resolved column set is
    still exactly four fields and the real header's `IP` is not among them.
  - >-
    src/lib/worker/playtime.ts: buildPlaytimeFromSources, which resolves the
    columns PER SOURCE, plus the game carried on every SplitSession and read by
    nothing yet. buildPlaytime stays a named single-source wrapper, so the
    whole pre-existing matrix is unchanged.
  - >-
    src/lib/worker/db.ts: readSessionRowData answers one source per stored
    session file, grouped per category-and-file pair, so the backfill feeds the
    aggregator the same grouping the import used. The index-only distinct-key
    walk, the single-key reads and the absence of any multi-key query form are
    unchanged.
  - >-
    src/lib/playtime-shared.ts: PLAYTIME_VERSION 1 -> 2, which is what makes an
    aggregate written by the previous build stale, so a real export already in
    a user's browser shows its playtime on the next playtime query with no
    re-import (T-04-30).
  - >-
    tests/fixtures/playtime-real-shape-fixture.ts: a WRAPPED archive holding
    `Activity_history/{WOT,WOTB,WOWS}_Game_Sessions.csv` with the header
    `STARTED_AT;FINISHED_AT;IP`, CRLF endings, the WOTB and WOWS files
    header-only, a `.xlsx` duplicate and a `__MACOSX` sidecar — with a
    hand-derived answer key for WOT alone, WOWS alone and both merged. All
    values synthetic; the address is TEST-NET-1 and is written in EVERY row,
    including the two excluded ones, so T-04-01 can actually fail.
  - >-
    tests/unit/playtime-real-shape-fixture.test.ts: all three answer keys
    re-proved in Node by the 04-03 per-second oracle, through this file's own
    `Date.UTC` day-first converter and its own bin table — a third path, so the
    hand numbers are checked before any browser run rather than in CI hours
    later.
  - >-
    tests/e2e/playtime-real-shape.spec.ts: the real-shape archive through the
    real app — `data-state ready`, the three tiles, the excluded pill, no
    selector, 731 calendar cells, the two named days read off their own
    attributes, all 168 hour cells summing to the tile, the bins, and the whole
    page's HTML free of the address.
affects: [phase-04-15, per-game-split, backfill, ingest, playtime-model, ui-copy, plan-04-16]

# Actuals — chars/4 over the ten source and test files this plan changed.
actuals:
  tokens: 7550
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - >-
      A file-name rule is one anchored single-class regex with a length bound,
      and a backfill screens an index by that rule before paying for a read.
    - >-
      An import path and a rebuild path that must agree pass the SAME grouping:
      one shape per source, produced once and handed to one aggregation
      function, rather than a flat row list and a second code path.

key-files:
  created:
    - tests/fixtures/playtime-real-shape-fixture.ts
    - tests/e2e/playtime-real-shape.spec.ts
    - tests/unit/playtime-real-shape-fixture.test.ts
  modified:
    - src/lib/worker/playtime.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/worker/db.ts
    - src/lib/playtime-shared.ts
    - tests/unit/playtime.test.ts
    - tests/unit/ingest-worker.test.ts
    - tests/unit/db.test.ts

key-decisions:
  - >-
    The game token is taken from the FILE NAME and never from a cell, and it is
    UPPER-CASED, so no untrusted cell text can reach a label (T-04-27). The
    pattern bounds the token at 24 characters, which is what keeps the name a
    name: a 25-character token is a something-else file, not a game.
  - >-
    `sessionFileGame` returns null for BOTH "not a session file" and "the legacy
    Sessions.csv, which names no game", and `isSessionsRow` is kept as its own
    name because every existing caller and every existing test asks THAT
    question. The two nulls are separated in one private helper with a comment
    saying so, rather than by a truthiness test at each call site.
  - >-
    A hybrid header resolves by ROW ORDER, not by spelling priority: the key
    that appears first in the row wins. A priority order nobody can see in the
    file is indefensible; a stated rule about the file is not.
  - >-
    `buildPlaytime` stays as a named single-source wrapper over
    buildPlaytimeFromSources rather than being deleted. The pre-existing
    fixtures and their tests are the proof this change is backward compatible,
    and two aggregation paths would be two things to drift.
  - >-
    The 04-06 backfill treats a snapshot holding at least one SOURCE as
    `sessionsFileSeen`, matching the import's decision at the same granularity.
    The asymmetry for a header-only file is kept exactly as 04-06 documented it
    and is now asserted on the real shape, rather than papered over.
  - >-
    The two version assertions in the 04-06 describe now read the exported
    constant instead of the literal 1 — the only existing assertions this plan
    edited — and a separate test pins the constant to 2, so there is one place
    the number is written down.
  - >-
    The oracle's wide-span helper is COPIED from
    tests/unit/playtime-hand-fixture.test.ts rather than extracted, because
    extracting it would mean editing a passing phase-4 test this plan does not
    own. Both properties the composition depends on are asserted rather than
    assumed, and the copy says where it came from.
  - >-
    In tests/unit/playtime-real-shape-fixture.test.ts, the dotted stamp is
    converted with `Date.UTC` and the weekday read with `getUTCDay()` — a third
    path on purpose. A shared calendar routine would let a bug in it cancel out
    on both sides and prove nothing.

patterns-established:
  - >-
    "Pattern: a gap-closure fixture derives its expectations BY HAND in a plain
    module and a Node oracle test re-proves them, so a browser spec is never the
    first place a wrong number is found."
  - >-
    "Pattern: the privacy canary is written into every row of the fixture,
    including rows the aggregator refuses, so the privacy assertion can fail."

requirements-completed: [ACTIVITY-01, ACTIVITY-02, ACTIVITY-03, ACTIVITY-04]

coverage:
  - id: D1
    description: >-
      A real-shape export imports to a populated Playtime block: ready state,
      the three tiles, the excluded pill, no selector, and all three charts
      drawn from the hand-derived answer key.
    requirement: ACTIVITY-01
    verification:
      - kind: e2e
        ref: "tests/e2e/playtime-real-shape.spec.ts#real shape: a per-game export imports to a populated Playtime block"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime-real-shape-fixture.test.ts#the real-shape fixture: WOT alone against the independent oracle"
        status: pass
    human_judgment: false
  - id: D2
    description: >-
      The aggregator reads the real per-game files and the day-first dotted
      stamp, resolves STARTED_AT and FINISHED_AT beside the old names, and
      keeps the legacy Sessions.csv path working for the synthetic fixtures.
    requirement: ACTIVITY-02
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#04-14: sessionFileGame reads the game out of the file name"
        status: pass
      - kind: unit
        ref: "tests/unit/playtime.test.ts#T-04-28: a month field above 12 is excluded, never swapped with the day"
        status: pass
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#04-14 tracer: a real-shape export through the real worker"
        status: pass
    human_judgment: false
  - id: D3
    description: >-
      An export holding both a legacy Sessions.csv and a real per-game file
      counts every file's rows, with the columns resolved per source.
    requirement: ACTIVITY-03
    verification:
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#a legacy Sessions.csv and a real per-game file in ONE export are both counted"
        status: pass
    human_judgment: false
  - id: D4
    description: >-
      The lazy backfill and the version bump repair a dataset cached by the
      previous build, so the reporter of UAT G-04-1 sees their playtime with no
      re-import.
    requirement: ACTIVITY-04
    verification:
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#a real-shape dataset cached with the previous version repairs on the next query"
        status: pass
      - kind: unit
        ref: "tests/unit/db.test.ts#04-14 — readSessionRowData over the per-game files"
        status: pass
    human_judgment: false
  - id: D5
    description: >-
      The answer key's numbers are proved in Node against the independent
      per-second oracle before any browser run, so a wrong hand number fails
      in seconds rather than in CI hours later.
    requirement: ACTIVITY-04
    verification:
      - kind: unit
        ref: "tests/unit/playtime-real-shape-fixture.test.ts (15 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: >-
      The login address in the IP column is never read, never stored and never
      rendered, on the real header where that column is present.
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/playtime.test.ts#T-04-01: the real header's IP column is never read either"
        status: pass
      - kind: unit
        ref: "tests/unit/ingest-worker.test.ts#the stored aggregate carries sessionsFileSeen and no IP string (T-04-01)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/playtime-real-shape.spec.ts#page.locator('html').innerHTML()"
        status: pass
    human_judgment: false
  - id: D7
    description: >-
      The full 116-test browser suite re-runs green after this change, on a
      runner that can launch Chromium. This machine cannot launch Chromium at
      all, so it is unverified here.
    verification: []
    human_judgment: true
    rationale: >-
      The sandbox forbids Chromium's Mach port bootstrap
      (`bootstrap_check_in ... Permission denied (1100)`), so every spec fails
      before its first assertion under the project's own config. The only
      workaround found, `--single-process`, lets the browser start but it dies
      partway through a whole-suite run: 56 tests then fail on
      `browserContext.newPage` and none on an assertion. Per-spec runs are
      trustworthy and every number attributed to a browser in this SUMMARY comes
      from one, but the suite as a whole needs a runner that can hold a browser
      open for two and a half minutes.

# Metrics
duration: 33min
completed: 2026-10-01

---

# Phase 04 plan 14 Summary

**A real Wargaming export now shows its playtime instead of "This export has no session file" — the per-game files, the `STARTED_AT;FINISHED_AT;IP` header and the `DD.MM.YYYY HH:MM` stamp are all read, the synthetic `Sessions.csv` path still works, and a dataset cached by the previous build repairs itself on the next visit.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-10-01T00:12+04:00
- **Completed:** 2026-10-01T00:45+04:00
- **Tasks:** 3
- **Files modified:** 10 (4 source, 6 test/fixture), all inside the plan's `files_modified`

## Accomplishments

- **G-04-1 is closed on the export the product exists for.** The three per-game
  files are ingested through their wrapper folder, `STARTED_AT`/`FINISHED_AT`
  resolve beside the synthetic names, and `DD.MM.YYYY HH:MM` is read day first.
  A real-shape archive now reaches `data-state ready` with 3.5 hours, 5
  sessions, 3 active days and a 2-row excluded pill, where before this change
  it reported no session file at all.
- **Backward compatibility is proved, not assumed.** All 857 unit tests pass,
  including the entire pre-existing matrix over the synthetic fixture, and
  `buildPlaytime` is still the single-source path every one of them exercises.
  `tests/unit/playtime.test.ts` gained 257 lines and lost none.
- **The answer key is proved in Node, not in CI.** The 04-03 per-second oracle
  re-derives all three keys through its own `Date.UTC` day-first converter and
  its own bin table, so a wrong hand number fails in 217 ms instead of in a
  browser run hours later. It also confirms the plan's own arithmetic,
  including the D-02 non-additivity: the two game totals sum to 19,200 and the
  All total is 17,400, 1,800 less, because the WOWS row overlaps the WOT span by
  half an hour.
- **The reporter's case is covered.** A dataset imported by the previous build —
  `sessionsFileSeen: false`, the real files in storage, no re-import — answers
  `ready` with the answer key's numbers on the next playtime query, and the
  repair is persisted at version 2.
- **The privacy claim is made testable.** The fixture writes the canary address
  into every row including the two the aggregator refuses, so T-04-01 can fail
  rather than being unprovable, and the browser spec asserts the address is
  absent from the whole page's serialized HTML.

## Task Commits

Each task was committed atomically, and every task marked `tdd="true"` has its
RED commit as its own commit ahead of the implementation:

1. **Task 1: real-shape fixture, browser spec and worker tracer** — `f30a6b0`
   (test) — RED: `data-state` read `no-session-file` in Chromium, and the
   worker answered status `no-session-file` on all three tests
2. **Task 1 GREEN** — `3c48c79` (feat)
3. **Task 2: per-source columns, the game token and the oracle proof** —
   `ec0823e` (test) — RED: a mixed legacy and real export read 1 session
   instead of 6, and `buildPlaytimeFromSources` did not exist
4. **Task 2 GREEN** — `08c864e` (feat)
5. **Task 3: the backfill must read the per-game files, and the bump** —
   `27c7c07` (test) — RED: `readSessionRowData` answered `rows` and not
   `sources`, the reporter's cached dataset answered `no-session-file`, and
   `PLAYTIME_VERSION` was 1
6. **Task 3 GREEN** — `39d3344` (feat)

**Plan metadata:** this file, plus STATE.md and ROADMAP.md.

## Files Created/Modified

- `tests/fixtures/playtime-real-shape-fixture.ts` — a WRAPPED real-shape
  archive (three per-game csv files under the account folder, two of them
  header-only, plus a `.xlsx` duplicate and a `__MACOSX` sidecar) with the
  header `STARTED_AT;FINISHED_AT;IP`, CRLF endings, and a hand-derived answer
  key for WOT alone, WOWS alone and both merged. Plain module: no Playwright,
  no Vitest, no side effect, because a spec cannot import a spec.
- `tests/e2e/playtime-real-shape.spec.ts` — the real shape through the real
  app in a browser: state, tiles, pill, no selector, 731 cells, two named days,
  168 hour cells summing to the tile, the bins, and no address in the HTML.
- `tests/unit/playtime-real-shape-fixture.test.ts` — 15 tests re-proving all
  three keys with the 04-03 oracle, plus the file shape (CRLF, header-only,
  address in every row), the two excluded rows' reasons, the bin table, the
  hours text, the announcements and the cell counts.
- `src/lib/worker/playtime.ts` — `sessionFileNameGame` / `sessionFileGame` /
  `isSessionsRow`; the day-first dotted pattern and the shared
  `wallClockSeconds`; the two column aliases resolved by row order;
  `buildPlaytimeFromSources` plus `buildPlaytime` as its single-source wrapper.
  Module docstring rewritten to say which assumptions a real export evidences
  and which remain fixture-only.
- `src/lib/worker/ingest.worker.ts` — one `SessionSource` per session file
  instead of one flat row list, the source created before its row loop so a
  header-only file still marks the file seen, and the backfill switched to
  `buildPlaytimeFromSources`.
- `src/lib/worker/db.ts` — `readSessionRowData` answers `sources`, grouped per
  category-and-file pair in first-seen order via a Map of Maps (so no separator
  character has to be excluded from folder and file names), screened by a
  name-only helper built from the two exported predicates.
- `src/lib/playtime-shared.ts` — `PLAYTIME_VERSION` 1 → 2, with the reason
  written beside the constant.
- `tests/unit/playtime.test.ts` — 257 lines added, none removed: the game-token
  matrix, the per-source equivalence, the hybrid-header row order, the real
  header's IP column, and the out-of-range month field. New symbols are loaded
  by dynamic import so a missing export fails one test with a named message
  rather than the file's module scope.
- `tests/unit/ingest-worker.test.ts` — the `04-14 tracer` describe (three tests)
  plus the mixed-export test and the reporter's case; the two 04-06 version
  literals now read the exported constant.
- `tests/unit/db.test.ts` — the 04-06 describe re-pointed at `sources` with its
  expectations preserved and extended, plus a new describe for the per-game
  files covering the lower-cased folder and basename, the nested path, the
  other folder and the xlsx duplicate.

## Decisions Made

- **The game token comes from the file name, upper-cased, bounded at 24
  characters.** From a cell it would be untrusted text on its way to a label.
  The bound is what keeps the name a name.
- **`sessionFileGame`'s null is deliberately overloaded** — "not a session
  file" and "the legacy file, which names no game" — and `isSessionsRow` is
  kept as a separate name for the question every existing caller asks. The two
  are separated in one private helper with the reason in a comment, rather than
  by a truthiness test repeated at each call site.
- **A hybrid header resolves by row order, not by spelling priority.**
  Neither reading is correct for a malformed file; an invisible priority order
  is not a defensible rule, a stated one about the file is.
- **`buildPlaytime` survives as a named wrapper.** The compatibility proof is
  the pre-existing test matrix, and it only proves something if there is one
  aggregation path.
- **The header-only asymmetry is kept and now asserted on the real shape**, not
  fixed. A snapshot with zero stored rows cannot distinguish "there and empty"
  from "not there"; 04-06 documented that and the behaviour has not changed.
- **The oracle's wide-span helper is duplicated rather than extracted**, since
  extracting it means editing a passing phase-4 test this plan does not own.
  Both properties the composition relies on — no session straddles a cluster
  boundary, and consecutive clusters are at least a day apart — are asserted
  rather than assumed, because without the second the summed total could be
  wrong in a way no index-by-index comparison would catch.

## Deviations from Plan

### Auto-fixed Issues

**1. Rule: an assertion that cannot pass as written is a defect in the assertion**
- **Found during:** Task 2 (the oracle proof)
- **Issue:** The re-derived bin helper and the per-case oracle input in the new
  fixture test were wrong on arrival: the bounds list was written as a strict
  upper-edge list (off by one, so 1,200s landed in bin 6 instead of bin 5), and
  the `it.each` calendar case fed every case the ALL row set, so the WOWS case
  saw 2020. The failures were in the new test, not in the app.
- **Fix:** The bin helper is now written as the UI-SPEC's inclusive LOWER
  bounds with the last index falling through for 16 hours and over, and the
  calendar case passes its own row set per case.
- **Files modified:** `tests/unit/playtime-real-shape-fixture.test.ts`
- **Verification:** 15/15 pass; the answer keys themselves are unchanged, which
  is what says the plan's arithmetic was right and only my re-derivation was
  wrong.
- **Committed in:** `ec0823e`

**2. Rule: a source-grouped map keyed by a joined string needs a separator that cannot occur**
- **Found during:** Task 3 (the backfill)
- **Issue:** The first grouping in `readSessionRowData` keyed a Map on
  `` `${category} ${sourceFile}` ``. A folder name and a file name can both
  contain any character a zip entry name can, so a space — or any other single
  character — is a separator that can be mis-split. (The edit also introduced a
  stray NUL byte, which made the file register as binary to `grep` and to git.)
- **Fix:** A Map of Maps, category then file name, so no separator exists. The
  stray byte is gone and `src/lib/worker/db.ts` is valid UTF-8 text again.
- **Files modified:** `src/lib/worker/db.ts`
- **Verification:** `pnpm run check` clean; `grep` reads the file as text; the
  per-game describe asserts one source per category-and-file pair.
- **Committed in:** `39d3344`

---

**Total deviations:** 2 auto-fixed (1 test-assertion defect, 1 source-robustness defect)
**Impact on plan:** Both were necessary for the plan's own tests and invariant to
be correct. No scope creep: no file outside the plan's `files_modified` was
touched, and no dependency, config or CI file changed.

## Issues Encountered

- **Chromium cannot launch on this machine at all.** Every Playwright spec fails
  before its first assertion with
  `bootstrap_check_in org.chromium.Chromium...: Permission denied (1100)`, and
  the project's own config cannot get past it. The workaround found is
  `--single-process`, which the same sandbox does allow, applied through a
  scratch config in the session sandbox (never in the repo, never committed).
  Under that workaround a whole-suite run (`--workers=1`) reported 56 failures,
  and **every single one is
  `browserContext.newPage: Target page, context or browser has been closed` —
  zero assertion failures, zero timeouts**: the browser dies partway through and
  every later test never reaches its first line. This plan's own spec is among
  the 56 in that run and passes on its own. Two pre-existing tests that failed
  under the workaround also pass when run alone. So the honest position is:
  **this plan's browser spec passes 1/1 under the workaround, no assertion in
  the whole suite failed, and a suite run under the project's own config has NOT
  been observed.** D7 is recorded as human_judgment for exactly that reason.
- **The 04-13 flake note (`import-flow.spec.ts:102`) was not re-measured here.**
  It needs a suite run this machine cannot produce; it is unchanged by this
  plan.
- **A NUL byte entered `src/lib/worker/db.ts`** through one edit and made the
  file read as binary. Caught by `grep` reporting "Binary file matches",
  diagnosed with a byte scan, and removed as part of deviation 2 above.

## User Setup Required

None - no external service configuration required. No new dependency, no
`pnpm add`, no lockfile change: `git diff --quiet 5d39ae0 -- package.json
pnpm-lock.yaml` passes.

## Next Phase Readiness

- **04-15 (the per-game split selector) has everything it needs.** Every usable
  session already carries its file's `game`, read by nothing today, so the
  split needs no further plumbing through the worker or the database. The
  worker message contract is unchanged, the per-slice buckets are unchanged, and
  the answer key already contains the two per-game figures a selector will
  show: `REAL_SHAPE_WOT` 3.5 hours over 5 sessions and `REAL_SHAPE_WOWS` 1.8
  hours over 2, with the two announcement strings that D-03's existing
  formatter produces for them.
- **One thing 04-15 must decide and should not inherit silently:** a real
  export has no `SERVER_NAME` and no `CLIENT_PLATFORM`, so D-03's split column
  is null on every real export and the new selector keys on the file's game
  instead. That is a new rule in `resolveSplitColumn`'s territory, not a change
  to the current one, and the All-only render it produces today is correct in
  the meantime.
- **Follow-up worth doing, outside this plan's file set:** the
  `oracleOverWideSpan` helper and its merge now exist in two test files.
  Extracting them to `tests/helpers/` is the right end state and needs a plan
  that owns `tests/unit/playtime-hand-fixture.test.ts`.
- **Carry forward:** the 04-13 first-CI-run measurement is still the phase's
  last open item, and this machine cannot make it.

---
*Phase: 04-activity-time-dashboards*
*Completed: 2026-10-01*
