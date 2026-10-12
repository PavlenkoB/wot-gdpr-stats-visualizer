---
phase: 05-vehicle-stats-financial-dashboards
plan: 06
subsystem: testing
tags: [fixtures, csv, bare-cr, quote-all, sample-export, e2e, derived-counts, import-cycle]

requires:
  - phase: 05-vehicle-stats-financial-dashboards (05-01)
    provides: >-
      `finance-fixtures.ts` with the three real 2021 header lists, the three
      hand fixtures (`PREMIUM_HAND_CSV`, `CURRENCY_HAND_CSV`,
      `ORDERS_HAND_CSV`), their row arrays and `FINANCE_CANARIES`.
  - phase: 05-vehicle-stats-financial-dashboards (05-02)
    provides: >-
      `player-stats-fixtures.ts` with `PLAYER_STATS_SAMPLE_FILES` (the
      nineteen real-named files), `PLAYER_STATS_SAMPLE_ROW_COUNT`,
      `STATS_NAME_CANARY` and `renderStatsCsv`.
  - phase: 05-vehicle-stats-financial-dashboards (05-03)
    provides: >-
      `Financial_data` as a supported category, the worker harness, the
      two inline real-header `Financial_data` entries this plan replaced, and
      the derived banner offsets the e2e specs already read.
  - phase: 02-defensive-parsing-persistent-dataset
    provides: >-
      `parseCsvFile` and the worker, which the tracer drives — the quote-all,
      bare-CR shape only proves something if it goes through the real pipeline.

provides:
  - >-
    A shared sample whose three Phase 5 folders are real-shaped:
    `Player_statistics` holds 05-02's nineteen files (47 rows),
    `Financial_data` holds 05-01's premium and currency hand fixtures
    (18 + 125 rows), and `Payment_history/Orders.csv` is the 12-column hand
    file (16 rows). All three are written in the export's payments-era
    physical shape — unquoted header, quote-all data cells, bare CR with no
    line feed — while every other sample file keeps CRLF, so the sample
    exercises BOTH terminators as the real archive does.
  - >-
    Every count derived from the data instead of typed:
    `SAMPLE_FILE_COUNTS.Player_statistics` from the file map's key count,
    `SAMPLE_ROW_COUNTS.Player_statistics` from `PLAYER_STATS_SAMPLE_ROW_COUNT`,
    `Financial_data` from the premium plus currency row arrays, and
    `Payment_history` from the orders row array.
  - >-
    `SCALE_ROW_TEMPLATES` on real file names — the four per-title main vehicle
    files, the 12-column Orders file and two `Financial_data` templates — each
    reading its header and first row out of the rendered fixture text through
    `templateOf`; plus the new exports `SCALE_10X_FILES_PER_CATEGORY` and
    `SCALE_TEMPLATES_BY_FOLDER`.
  - >-
    `tests/fixtures/sample-account.ts`, a leaf module holding
    `SAMPLE_ACCOUNT_ROOT`, which removes the import cycle that made the
    builder able to import the data modules and deletes 05-03's transcribed
    copy of the two finance headers.
  - >-
    `tests/unit/sample-export-shape.test.ts` (8 tests) pinning the sample's
    BYTES — file set, terminator, quoting, canary confinement, Orders columns
    and GAME_CODE case — and `tests/unit/ingest-worker.test.ts`'s new
    real-shape tracer asserting 19/47, 2/143, 1/16 with zero skipped rows.
  - >-
    `tests/fixtures/README.md` gains a "Phase 5 data modules" section stating
    the leaf-module rule, the mixed-terminator rule, the NAME canary and the
    all-zero order-id policy.

affects: [05-05, 05-07, 05-09, 05-10, 05-12, 05-16, 05-17, every-later-plan-touching-the-sample]

actuals:
  tokens: 13000
  tasks: 3
  commits: 3

plan_head_before: 77667032081309bd5b1ef7603c922820bae53d47
plan_head_after: cfc1b01628d0a88022b01165b4b93be5ca3f1b74

tech-stack:
  added: []
  patterns:
    - >-
      The rewrite nobody can see: a fixture's PHYSICAL shape is not covered by
      any assertion about its contents, because the parser normalises CR, LF
      and CRLF alike. Re-wrapping the real-shaped files in CRLF left the entire
      1010-test suite green. A shape test is not a restatement of the count
      tests; it is the only thing guarding the one property they cannot see.
    - >-
      A count constant and the data it counts are two answers to one question,
      and they only agree by accident until one is edited. Deriving the count
      from the row array removes the class of bug rather than this instance.

key-files:
  created:
    - tests/fixtures/sample-account.ts
    - tests/unit/sample-export-shape.test.ts
  modified:
    - tests/fixtures/export-fixtures.ts
    - tests/fixtures/sessions-fixtures.ts
    - tests/fixtures/README.md
    - tests/unit/ingest-worker.test.ts
    - tests/unit/zip-paths.test.ts
    - tests/e2e/import-flow.spec.ts
    - tests/e2e/persistent-dataset.spec.ts

key-decisions:
  - >-
    The plan's premise that the data modules "import nothing from this file,
    so there is no cycle" was FALSE, and following it literally killed five
    test files at module load. Rather than transcribe the constants again
    (what 05-03 did) or derive the counts lazily, the cycle was broken
    structurally: `SAMPLE_ACCOUNT_ROOT` moved to a leaf module that imports
    nothing. That is the fix the plan's own README instruction ("data modules
    never import the shared sample builder") was reaching for, and it is why
    the rule is now documented as a rule rather than a convention.
  - >-
    The count constants are derived, but the tracer's expected values stay
    LITERAL (19/47, 2/143, 1/16). Both, deliberately: the derived constant
    proves the builder agrees with the module, and the literal proves a human
    once checked that 47 is really the number of rows 05-02 wrote down. Two
    derivations of the same fact from two directions is what catches a
    fixture that grows a row without its count being updated.
  - >-
    The scale export's template headers are read out of the RENDERED fixture
    text (`templateOf`) rather than retyped as constants. It is a third copy
    of the header otherwise, and 05-01 already lost a commit to a header
    transcribed from research prose instead of from the real module.
  - >-
    `zip-paths.test.ts` was given a DERIVED entry count rather than the
    literal 29. It had been re-typed once already (12, then 14) and would
    need re-typing a third time; deriving it from `SAMPLE_FILE_COUNTS` keeps
    the lister's real claim (it enumerates every name without inflating)
    while removing the hand-maintained number.

patterns-established:
  - >-
    A cycle is a RUNTIME failure in a fixture module, not a compile error:
    the failure only appears when a test file happens to import the data
    module FIRST, so it can pass a full suite and then fail on a
    reordered import. The five-file load failure here is the same defect
    05-03 documented from the other direction.
  - >-
    When a rewrite cannot be shown to fail, mutate the thing it changed and
    run the WHOLE suite, not just the new test. The new test failing proves
    little; the rest of the suite staying green is the finding.

requirements-completed: [STATS-01, FINANCE-01, FINANCE-02, FINANCE-03]

coverage:
  - id: D1
    description: >-
      The shared sample's Player_statistics folder holds exactly the nineteen
      real-named files from plan 05-02 and no invented one.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/sample-export-shape.test.ts#the file set in the three Phase 5 folders > Player_statistics holds exactly the nineteen real-named files, and no invented one'
        status: pass
      - kind: unit
        ref: 'tests/unit/zip-paths.test.ts#buildSampleExport yields every name in the sample file-count contract, including the supported-csv names'
        status: pass
    human_judgment: false
  - id: D2
    description: >-
      Financial_data holds 05-01's premium and currency hand fixtures and
      Payment_history/Orders.csv is the 12-column hand file, all in the
      export's quote-all/bare-CR physical shape.
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: 'tests/unit/sample-export-shape.test.ts#every file in the three folders is header-unquoted, quote-all, bare CR, with no line feed'
        status: pass
      - kind: unit
        ref: 'tests/unit/replay-reclassify.test.ts#both finance files carry 05-01 headers verbatim, in 05-01 order'
        status: pass
    human_judgment: false
  - id: D3
    description: >-
      Every count the sample implies is derived from the fixture modules, and
      the tests that count files and rows read those constants rather than
      re-typing them.
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: 'tests/unit/classify.test.ts#buildSampleExport: category order is exactly SAMPLE_BADGE_ORDER and counts match SAMPLE_FILE_COUNTS'
        status: pass
      - kind: unit
        ref: 'tests/unit/zip-paths.test.ts (entry count derived from SAMPLE_FILE_COUNTS)'
        status: pass
    human_judgment: false
  - id: D4
    description: >-
      SCALE_ROW_TEMPLATES names the real per-title vehicle, Orders and
      Financial_data files, and the 10x export no longer imports invented
      ones.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/sample-export-shape.test.ts#no file anywhere in the sample carries an invented statistics name'
        status: pass
      - kind: e2e
        ref: 'tests/e2e/persistent-dataset.spec.ts#(c) a 10x-scale synthetic export imports with progress advancing per category and the page stays responsive'
        status: pass
    human_judgment: false
  - id: D5
    description: >-
      Importing the shared sample through the REAL worker yields 19 files /
      47 rows, 2 / 143 and 1 / 16 with zero skipped rows in every category,
      which is the proof the quote-all, bare-CR shape goes through the Phase 2
      parser exactly as a real export does.
    requirement: FINANCE-03
    verification:
      - kind: unit
        ref: 'tests/unit/ingest-worker.test.ts#(a-real-shape) the sample imports the real-shaped Phase 5 folders with exact file and row counts and NOTHING is skipped (05-06)'
        status: pass
    human_judgment: false
  - id: D6
    description: >-
      The e2e specs derive every row and file count from the fixture constants
      and pass in a real browser against the real-shaped sample and the larger
      scale export.
    requirement: FINANCE-03
    verification:
      - kind: e2e
        ref: 'pnpm exec playwright test (120 passed / all specs, LC_ALL=en_US.UTF-8)'
        status: pass
    human_judgment: false
  - id: D7
    description: >-
      The fixture README documents the Phase 5 modules, the leaf-module rule,
      the mixed terminators, the NAME canary and the all-zero order-id policy.
    requirement: STATS-01
    verification:
      - kind: other
        ref: "grep -c 'finance-fixtures|player-stats-fixtures' tests/fixtures/README.md => 4"
        status: pass
    human_judgment: false
  - id: D8
    description: >-
      Whether the REAL 2021 export writes these nineteen file names, these
      headers and this quote-all/bare-CR shape. This plan inherited 05-01's and
      05-02's fixture modules and installed them into the sample; no real
      archive was opened, because that is outside the plan.
    verification: []
    human_judgment: true
    rationale: >-
      Only a human with access to a real export can confirm the physical shape
      and the exact per-title column names. 05-RESEARCH recorded the header
      lines and shape histograms with digits replaced; this plan is faithful to
      that evidence and now propagates it into every later phase's fixtures.

duration: 27min
completed: 2026-10-01
status: complete
---

# Phase 05 Plan 06: The shared sample goes real-shaped — Summary

**The shared sample now carries plan 05-01's and 05-02's real-shaped `Player_statistics`, `Financial_data` and `Orders` files in the export's own quote-all/bare-CR physical form, every count is derived from the data rather than re-typed, and a new shape test is the only thing guarding the format the whole rest of the suite is blind to.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-01T17:07Z
- **Completed:** 2026-10-01T17:34Z
- **Tasks:** 3
- **Files modified:** 8 (2 created, 6 modified), 627 insertions / 165 deletions

## Accomplishments

- **The plan's central premise was false, and finding that out was most of the
  work.** The plan says the two data modules "import nothing from this file, so
  there is no cycle" and instructs the builder to import them. They do import it
  — indirectly, through `sessions-fixtures.ts`, which needs
  `SAMPLE_ACCOUNT_ROOT` for exactly one string. Following the instruction
  literally did not fail to compile; it killed **five test files at module
  load** with `TypeError: Cannot read properties of undefined (reading 'length')`,
  and only for the test files that happen to import a data module first. The
  fix was structural rather than cosmetic: the account-root constant moved to a
  new leaf module that imports nothing, which is exactly what the leaf-module
  rule this plan was supposed to *document* was reaching for. `05-03` had
  already hit this cycle and worked around it by hand-transcribing the two
  finance headers with a lockstep test to hold the copy honest; that
  transcription is now gone.
- **The counts moved, and every one of them moved for a stated reason.**
  `Player_statistics` 4 files / 4 rows → **19 / 47** (05-02's nineteen files for
  four titles plus the three recognised-but-never-displayed ones);
  `Financial_data` 2 / 2 → **2 / 143** (05-01's 18 premium plus 125 currency
  rows); `Payment_history` 1 / 1 → **1 / 16** (the 12-column hand Orders file).
  The sample grew from 14 archive entries to 29. `SAMPLE_FILE_COUNTS` and
  `SAMPLE_ROW_COUNTS` are now computed from the fixture modules, so those
  numbers cannot drift from the data.
- **The shape test is the only thing in the repo that can see the format.**
  This was proven, not assumed. Re-wrapping the `Player_statistics` files from
  bare CR to CRLF — a one-line edit — left **1008 of 1010 tests passing**, with
  every count, ingest and worker assertion still green, because PapaParse
  accepts CR, LF and CRLF alike. The new test was the only new failure, naming
  the offending file. A sample that had quietly stopped being real-shaped
  would otherwise have shipped green.
- **The e2e specs needed one real fix, not the anticipated many.** The scale
  assertion typed two of its three factors; those are now read from the
  template list that builds the archive. The other genuine break was
  `import-flow` test (a): its atomic busy-snapshot always used to land on one
  of the five coarse stages, and the larger 29-file sample can equally land on
  `Parsing Player_statistics (1/9)...` — the D-11 stage `ui-copy.ts` already
  documents and the 10x-scale test already asserts. The allow-list gained it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — the real-shaped sample goes through the real worker with exact row counts and no skipped rows** — `0883dbc` (test)
2. **Task 2: e2e specs against the real-shaped sample and the real-named scale export** — `a71cd01` (test)
3. **Task 3: A shape test for the shared sample and the README for the new fixture modules** — `cfc1b01` (test)
4. **Plan metadata** — this SUMMARY

### RED and mutation evidence, as recorded

| Step | Command | Result |
|------|---------|--------|
| Baseline (before any edit) | `pnpm run test:unit` | exit 1 — **1000 passed / 1 failed / 32 files**. The single failure is `ui-copy.test.ts › formatImportSummary`, pre-existing and unrelated (see Limitations). |
| Task 1 **RED** | `vitest run tests/unit/ingest-worker.test.ts -t "a-real-shape"` | exit 1 — `AssertionError: Player_statistics fileCount: expected 4 to be 19`. A **value** failure, not a module crash, which was the point of writing the expected counts as literals. |
| Task 1 **GREEN** | same | exit 0 — 1 passed. Importing the sample yielded 19/47, 2/143, 1/16 with zero skipped rows. |
| Task 1 first full run | `pnpm run test:unit` | exit 1 — **6 files failed to LOAD**, 3 assertion failures. The load failures were the import cycle described above. |
| Task 1 after the cycle fix | `pnpm run test:unit` | exit 1 — back to **1 failed / 1001 passed**, the one failure being the pre-existing locale case. |
| Task 3 **mutation** | re-wrap `Player_statistics` in CRLF, run the shape file | exit 1 — `AssertionError: 123456789/Player_statistics/WOTB_Account_Statistics.csv contains a line feed`. |
| Task 3 **mutation, whole suite** | `pnpm run test:unit` with the re-wrap still applied | exit 1 — **2 failed / 1008 passed / 33 files**: the shape test and the pre-existing locale case. Nothing else in the suite noticed. |
| Task 3 restored | `pnpm exec vitest run tests/unit/sample-export-shape.test.ts` | exit 0 — **8 passed**. |

## Files Created/Modified

- `tests/fixtures/export-fixtures.ts` — the rewrite. Imports the two data
  modules, writes the nineteen vehicle files / two finance files / the Orders
  file verbatim, derives both count maps, replaces the scale templates with
  real file names and adds `templateOf`, `SCALE_10X_FILES_PER_CATEGORY` and
  `SCALE_TEMPLATES_BY_FOLDER`; re-exports `SAMPLE_ACCOUNT_ROOT` from the new
  leaf so no importer changes.
- `tests/fixtures/sample-account.ts` (new) — the leaf holding
  `SAMPLE_ACCOUNT_ROOT`, with the cycle explained at the top.
- `tests/fixtures/sessions-fixtures.ts` — one import line, now from the leaf.
- `tests/fixtures/README.md` — the "Phase 5 data modules" section: the three
  modules and two oracles, the leaf-module rule with the cycle spelled out, the
  mixed-terminator rule and why nothing else guards it, the NAME canary, the
  all-zero order-id policy, and why a custom Phase 5 export is
  `buildCustomExport` rather than a new builder.
- `tests/unit/sample-export-shape.test.ts` (new) — 8 tests over the sample's
  bytes: the file set in each of the three folders, the invented-name sweep,
  the unquoted-header/quote-all/bare-CR/no-LF rule, the CRLF control over the
  other files, the canary confined to five account files, the twelve Orders
  columns, and the GAME_CODE case.
- `tests/unit/ingest-worker.test.ts` — the new real-shape tracer plus a comment
  correction on the stale "one synthetic data row per file" claim.
- `tests/unit/zip-paths.test.ts` — **outside the plan's `files_modified`**; see
  Deviations.
- `tests/e2e/persistent-dataset.spec.ts` — the scale row total now derived.
- `tests/e2e/import-flow.spec.ts` — the stage pattern gains the per-category
  progress string.

## Decisions Made

- **Break the cycle, do not transcribe around it.** The two available
  workarounds were 05-03's (hand-copy the headers, add a lockstep test) and
  making the counts lazy. Both leave a second copy of a fact in the repo. The
  leaf module removes the class of failure, and it is a two-line change to a
  file that already had a one-line import in it.
- **Keep the tracer's expectations literal AND the constants derived.** Two
  answers, deliberately. The literal is what fails when 05-02's row count was
  wrong; the derived constant is what fails when the builder and the module
  disagree. Either alone leaves a gap.
- **Read the scale templates out of the rendered text.** `templateOf` splits the
  module's own CSV on its bare CR and takes the first two lines, so the scale
  export cannot carry a header the sample does not.
- **Assert the canary's carrier list literally, not by filtering the fixture
  module.** The failure this test exists to catch is the canary leaking into a
  non-account file, and a derived list would follow the leak. The five names are
  spelled out in code-unit order, with a comment on why `WOTB_` sorts before
  `WOT_`.
- **Pin the deliberate blank `GAME_CODE` rather than requiring every cell
  populated.** 05-01's hand fixture pairs a blank currency with a blank
  `GAME_CODE` so D-24's "Unknown currency" group has a row. The test asserts
  "no lower-case code" and that exactly one cell is blank, so the deliberate
  blank cannot quietly become a second one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's "no cycle" premise was false; five test files failed to load**
- **Found during:** Task 1, on the first full `pnpm run test:unit` after the
  rewrite.
- **Issue:** the plan's Task 1 step 1 states the data modules "import nothing
  from this file, so there is no cycle". They do:
  `finance-fixtures.ts` and `player-stats-fixtures.ts` each import
  `mulberry32` from `sessions-fixtures.ts`, which imported `SAMPLE_ACCOUNT_ROOT`
  from `export-fixtures.ts`. The cycle bites at RUNTIME, not compile time: when
  a test file imports a data module first, `export-fixtures.ts` evaluates while
  the data module is mid-evaluation, so the count constants read
  `undefined`. Five test files died at load
  (`TypeError: Cannot read properties of undefined (reading 'length')`), and the
  failure is order-dependent — it would have passed on a differently ordered
  run and then broken later.
- **Fix:** `SAMPLE_ACCOUNT_ROOT` moved to a new leaf module
  `tests/fixtures/sample-account.ts`; `sessions-fixtures.ts` imports it from
  there and `export-fixtures.ts` re-exports it, so every existing importer is
  untouched. The cycle is now structurally impossible rather than merely
  absent today.
- **Files modified:** `tests/fixtures/sample-account.ts` (new),
  `tests/fixtures/sessions-fixtures.ts`, `tests/fixtures/export-fixtures.ts`
- **Verification:** the five files load; `pnpm run test:unit` back to one
  pre-existing failure.
- **Committed in:** `0883dbc`

**2. [Rule 1 - Bug] `tests/unit/zip-paths.test.ts` held the sample's entry count as a literal — outside `files_modified`**
- **Found during:** Task 1, in the same run.
- **Issue:** two tests asserted `toHaveLength(14)`. The sample now has 29
  entries, so `pnpm run test:unit` could not exit 0 without fixing it. The file
  is not in the plan's `files_modified` and RESEARCH Pitfall 3's dependant list
  missed it again (05-03 had already fixed the same two literals for the same
  reason).
- **Fix:** derived rather than re-typed — the expected count is
  `Object.values(SAMPLE_FILE_COUNTS).reduce(...)`, the same contract the badge
  and the e2e summaries read. The titles were corrected, and the happy-path
  test additionally asserts the real vehicle file names are enumerated and that
  no invented `_stats.csv` name is.
- **Files modified:** `tests/unit/zip-paths.test.ts`
- **Verification:** `pnpm run test:unit`, 1 pre-existing failure only.
- **Committed in:** `0883dbc`

**3. [Rule 1 - Bug] The import-flow stage allow-list predated the D-11 per-category progress stage**
- **Found during:** Task 2, in the browser run.
- **Issue:** test (a) takes a deliberately atomic busy-snapshot and matches the
  notice text against a fixed five-stage allow-list. The old 14-file sample was
  small enough that the snapshot always landed on a coarse stage; the
  real-shaped 29-file sample landed on
  `"Parsing Activity_history (1/9)..."` and the test reported a product
  regression for a stage the product is documented to emit.
- **Fix:** `STAGE_PATTERN` gains `Parsing <name> (i/t)`, the same regex shape
  `persistent-dataset.spec.ts` test (c) already uses, with a comment explaining
  why the sample's growth surfaced it.
- **Files modified:** `tests/e2e/import-flow.spec.ts`
- **Verification:** `pnpm exec playwright test tests/e2e/import-flow.spec.ts` —
  7/7 passed.
- **Committed in:** `a71cd01`

### Planned deviations, made deliberately

**4. `SCALE_10X_FILES_PER_CATEGORY` and `SCALE_TEMPLATES_BY_FOLDER` are new
exports.** The plan's Task 2 acceptance criterion says the diff should list only
the three spec files, but the sibling criterion — no typed count the constants
already provide — cannot be met while the multiplier and the template count stay
private. Two exports are the smaller change than either leaving a typed `5` in
the spec or moving the whole scale list out of the fixture module.

**5. The shape test asserts the canary in five files and a blank `GAME_CODE`,
rather than the plan's phrasing.** The plan's behaviour block says "each of the
five Player_statistics account files … contains the NAME canary" (implemented as
planned) and that "its `GAME_CODE` cells are upper case". Read strictly, the
second cannot hold: 05-01's fixture deliberately includes one blank
`GAME_CODE`, so the assertion is "no cell is lower case, and exactly one is
blank" — which is both true and a stronger guard.

---

**Total deviations:** 3 auto-fixed (1 blocking import cycle, 1 stale literal
contract, 1 stale stage allow-list), 2 planned
**Impact on plan:** all three auto-fixes were necessary for the suite to pass or
for a changed file's claim to stay true. Two files sit outside the plan's
`files_modified`: `tests/fixtures/sessions-fixtures.ts` (one import line, forced
by deviation 1) and `tests/unit/zip-paths.test.ts` (deviation 2). No product
code was touched — `git diff --quiet 7766703..HEAD -- src` exits 0.

## Issues Encountered

- **The cycle is order-dependent, which is what made it worth writing down.**
  It only appears when a test file imports a data module before the builder. The
  tracer run passed because `ingest-worker.test.ts` imports the builder first.
  A future edit that reorders an import could reintroduce the appearance
  without reintroducing the bug.
- **My own first draft of the shape test failed twice for the wrong reason**
  (a canary list in the wrong sort order, and an expectation that every
  `GAME_CODE` is populated). Both were my assumptions rather than fixture
  defects, and both are now commented where a future reader would otherwise
  repeat the reasoning.
- **The scale import is not slower in any way that matters.** The 10x export
  gained two templates and larger stats/Orders templates; the responsive-import
  test still completes in **1.4 s** against its 60 s budget, so no timeout was
  raised.

## Verification Actually Run

| Command | Result |
|---|---|
| `pnpm run test:unit` (baseline, before any edit) | exit 1 — 1000 passed / 1 failed / 32 files |
| `vitest run tests/unit/ingest-worker.test.ts -t "a-real-shape"` (Task 1 **RED**) | exit 1 — `expected 4 to be 19` |
| same, after the rewrite (Task 1 **GREEN**) | exit 0 — 1 passed |
| `pnpm run test:unit` (after the cycle fix) | exit 1 — 1 failed / **1001** passed |
| `pnpm run test:unit` (final, default locale) | exit 1 — 1 failed / **1009** passed / 33 files |
| `LC_ALL=en_US.UTF-8 pnpm run test:unit` | exit 0 — **1010 passed / 33 files** |
| `pnpm run check` (`tsc -b`) | exit 0 |
| `pnpm run lint` (`prettier --check . && eslint .`) | exit 0 |
| `pnpm exec playwright test` — all specs, `LC_ALL=en_US.UTF-8` | exit 0 — **120 passed** (40.8 s) |
| the five Task-2 specs, default locale | exit 1 — **70 passed / 2 failed**, both the locale defect |
| `pnpm exec playwright test --list` (five specs) | exit 0 — 72 collected |
| `git diff --quiet 7766703..HEAD -- package.json pnpm-lock.yaml src` | exit 0 — no dependency and no product change |

Plan acceptance criteria:

- `grep -c "WOT_stats\|WOTB_stats\|WOWS_stats\|WOWP_19_stats" tests/fixtures/export-fixtures.ts` → **0**
- `grep -c "finance-fixtures\|player-stats-fixtures" tests/fixtures/README.md` → **4**
- `git diff --stat -- src` → empty
- `git diff --quiet -- package.json pnpm-lock.yaml` → clean (T-05-SC)

## Limitations — what is NOT verified

**One test fails on this machine, and it is not this plan's.** `pnpm run
test:unit` reports `ui-copy.test.ts › formatImportSummary › uses the existing
thousands separator for the row count`: `expected '3 files, 1 204 rows' to be
'3 files, 1,204 rows'`. The host OS locale makes Node's `toLocaleString()` use a
non-breaking space while the browser and the test's expected string use a comma.
This is RESEARCH **Pitfall 7**, recorded before this plan as "**1 test already
fails today**", and it was failing at the baseline measured before a single file
was edited. It is the same defect behind the two e2e failures in the default-locale
run.

The decisive evidence that it is orthogonal to this plan: re-running
`LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8` turns all three green with no code change
—

```
LC_ALL=en_US.UTF-8 pnpm run test:unit   ->  1010 passed (33 files)
LC_ALL=en_US.UTF-8 pnpm exec playwright test  ->  120 passed
```

One of the two default-locale e2e failures
(`import-flow › (f) the page stays responsive while a large export is unzipped`)
exercises `buildLargeExport`, which this plan never touched, and the other
(`persistent-dataset › (c)`) computes an arithmetically identical number to the
one it computed before (`2 × 5 × 1000`). Pinning the locale — the `setup.ts` and
`playwright.config.ts` change Pitfall 7 prescribes — belongs to the plan that
owns D-25's locale move, and touching `src/` or the shared locale setup here
would have broken this plan's own `git diff -- src` criterion.

Also not done, and deliberately: `graphify update .` was not run, since
`graphify-out/` is not part of this plan's commit scope and the orchestrator
owns the post-merge state.

## User Setup Required

None.

## Next Phase Readiness

- **05-07 (the worker round trip)** can assert the canary never reaches a
  message: `STATS_NAME_CANARY` is now in the sample, in exactly the five account
  files and nowhere else, and `sample-export-shape.test.ts` fails if that
  changes. The sample imports with 19 Player_statistics files, zero skipped
  rows everywhere, so a leak assertion has a clean baseline to run against.
- **05-05 and 05-10 (the builders)** can read the real-shaped files straight out
  of the sample instead of building their own exports.
- **05-16 (the scale specs)** gets real file names and a larger template set for
  free. The responsive-import test is at 1.4 s of a 60 s budget, so the CI e2e
  budget concern in RESEARCH Pitfall 11 is unchanged — this plan added **no**
  e2e tests, and the suite is still 120.
- **Whoever owns D-25's locale move** has three concrete failures waiting:
  `ui-copy.test.ts:207`, and the two e2e grouping-separator comparisons in
  `import-flow.spec.ts` and `persistent-dataset.spec.ts`. All three go green
  under `LC_ALL=en_US.UTF-8` and are invisible under it.

## Self-Check: PASSED

- `tests/fixtures/sample-account.ts`, `tests/unit/sample-export-shape.test.ts` —
  created and present.
- `tests/fixtures/export-fixtures.ts`, `tests/fixtures/sessions-fixtures.ts`,
  `tests/fixtures/README.md`, `tests/unit/ingest-worker.test.ts`,
  `tests/unit/zip-paths.test.ts`, `tests/e2e/import-flow.spec.ts`,
  `tests/e2e/persistent-dataset.spec.ts` — all modified and committed.
- Commits `0883dbc`, `a71cd01`, `cfc1b01` all reachable from HEAD.
- Every `<acceptance_criteria>` item from all three tasks re-run and passing (see
  Verification Actually Run).

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Plan: 06*
*Completed: 2026-10-01*
