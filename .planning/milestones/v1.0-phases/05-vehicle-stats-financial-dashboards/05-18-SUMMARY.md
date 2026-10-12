---
phase: 05-vehicle-stats-financial-dashboards
plan: 18
subsystem: finance
tags: [finance, premium, worker, d19-amended, d20, uat-gap, real-shape, tdd]

requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: "buildPremium, the independent oracle, the hand premium answer key and the finance browser specs from 05-04 through 05-17"
provides:
  - "buildPremium dates a premium file by CURR_PREMIUM once per file, with CREATED as the fallback column (D-19 amended by UAT G-05-3, D-20)"
  - "PREMIUM_BULK_STAMP and premiumRow — every premium fixture row carries the real export's shape, so the invented currency-code column is gone from the repository"
  - "PREMIUM_REAL_SHAPE_ROWS / _CSV / _EXPECTED — seven invented rows in the real export's shape, 6 grants, 1 excluded, 5,641,711 s over months 24,167 to 24,170"
  - "A browser proof that a real-shaped premium file draws four months by CURR_PREMIUM and no bar at the bulk stamp's month 24,197"
affects: [05-vehicle-stats-financial-dashboards, finance, uat-verification, 05-UI-SPEC, 05-SECURITY, 05-CONTEXT]

actuals:
  tokens: 15348
  tasks: 3
  commits: 4

plan_head_before: 77f3455
plan_head_after: d14fbc8

tech-stack:
  added: []
  patterns:
    - "A fixture can encode the wrong SEMANTICS, not just the wrong numbers: the 05-01 premium fixture put a currency code in CURR_PREMIUM and a real date in CREATED, so the hand key, the oracle and the builder all agreed on a bug that a real export exposed. Real-SHAPED fixtures, with invented values but the export's own column meanings, are what close that class of gap."
    - "A date column is chosen once per FILE, never per row: a per-row fallback would quietly re-create the same bug on exactly the rows that cannot be read, and those are the rows nobody inspects."
    - "When a privacy rule has to change shape, change the ASSERTION's shape too — not 'this column is never read' but 'this column is read and none of its text survives the serialised view', with a positive control so the second claim cannot pass vacuously."

key-files:
  created: []
  modified:
    - src/lib/worker/finance.ts
    - tests/helpers/finance-oracle.ts
    - tests/fixtures/finance-fixtures.ts
    - tests/fixtures/README.md
    - tests/unit/finance.test.ts
    - tests/unit/finance-fixtures.test.ts
    - tests/unit/replay-reclassify.test.ts
    - tests/e2e/finance.spec.ts
    - .planning/phases/05-vehicle-stats-financial-dashboards/05-CONTEXT.md
    - .planning/phases/05-vehicle-stats-financial-dashboards/05-UI-SPEC.md
    - .planning/phases/05-vehicle-stats-financial-dashboards/05-SECURITY.md

key-decisions:
  - "The date column is resolved by a helper that stops at the FIRST readable CURR_PREMIUM cell and falls back to CREATED, rather than scanning the whole column first. The answer is a property of the file either way, and one pass over a file that has a readable date is cheaper than reading every cell of a file that has none — which matters at the scale this file is designed for."
  - "The fixture row builder takes (premium, grantedAt) rather than the whole tuple, so the column ORDER of the real export is expressed once. Eighteen hand rows, seven real-shaped rows, three browser row sets and the replay fixture now all get the bulk stamp in CREATED and UPDATED by construction, not by eighteen repetitions that could drift."
  - "The 05-11 threat row's amendment lives inside the table cell rather than as a paragraph after it. A paragraph between two rows of a Markdown table splits it into two tables, and the audit reader would then see a register with a hole in it."

requirements-completed: [FINANCE-01]

patterns-established:
  - "Real-shaped fixtures use INVENTED amounts, INVENTED dates and an invented bulk stamp. The user's real totals appear only in a local human check and in the already-committed UAT file, never in a repository file (T-05-53, T-05-56)."
  - "The strongest single assertion for a date-column fix is the ABSENCE of the wrong month: one bar at 24,197 is exactly what a regression draws, so `[data-month=\"24197\"]` having count 0 catches the whole bug in one line."

coverage:
  - id: D1
    description: "buildPremium dates a real-shaped premium file by CURR_PREMIUM, and the builder, the oracle and the hand-derived key agree"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/finance.test.ts#buckets a real-shaped premium file by CURR_PREMIUM, not by CREATED"
        status: pass
      - kind: unit
        ref: "tests/unit/finance-fixtures.test.ts#buckets the real-shaped set by CURR_PREMIUM and never by the bulk stamp"
        status: pass
      - kind: unit
        ref: "tests/unit/finance-fixtures.test.ts#keeps the real-shaped answer through the rendered CSV"
        status: pass
    human_judgment: false
  - id: D2
    description: "The bulk-migration month never appears, in either fixture or in the browser"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/finance.test.ts#never draws the bulk-migration month, in either fixture"
        status: pass
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(real-shape) four months of grant dates, and never the bulk stamp month"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 18-row hand key is unchanged: 11 grants, 7 excluded, 53 days, months 24,230 / 24,232 / 24,233 / 24,234 and the same two listed strings"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/finance.test.ts#reproduces the hand-derived premium answer and agrees with the oracle"
        status: pass
      - kind: unit
        ref: "tests/unit/finance.test.ts#still gives the reshaped eighteen-row hand fixture its original answer"
        status: pass
      - kind: unit
        ref: "tests/unit/finance-fixtures.test.ts#premium hand fixture (six tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The date column is decided once per file: absent column, all-unreadable column, and one unreadable cell in a dated file"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/finance.test.ts#decides the date column once per file, and never guesses at an unreadable cell"
        status: pass
      - kind: unit
        ref: "tests/unit/finance-fixtures.test.ts#falls back to CREATED for a file with no readable CURR_PREMIUM date"
        status: pass
    human_judgment: false
  - id: D5
    description: "CURR_PREMIUM is read to derive a month integer and none of its text reaches a view; UPDATED is still never read; keys are still listed once"
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: "tests/unit/finance.test.ts#reads CURR_PREMIUM to derive a month and keeps its text out of the view"
        status: pass
      - kind: unit
        ref: "tests/unit/finance.test.ts#sees no identifying column in the premium, currency or spend path"
        status: pass
      - kind: unit
        ref: "tests/unit/finance.test.ts#reads the key list of the first row only, so a ragged row cannot remap a column"
        status: pass
    human_judgment: false
  - id: D6
    description: "No test, fixture or comment keeps the invented premium-currency-code shape, and the browser's existing premium specs pass on real-shaped rows"
    requirement: FINANCE-01
    verification:
      - kind: command
        ref: "! grep -rn \"ru.wot.gold\" tests src"
        status: pass
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts (28 tests, all premium specs rebuilt on premiumRow)"
        status: pass
      - kind: unit
        ref: "tests/unit/replay-reclassify.test.ts#(premium duration is TEXT in the sample, not a number) — assertions unchanged"
        status: pass
    human_judgment: false
  - id: D7
    description: "The D-19 amendment is recorded in the decision file, the UI contract and the security register, with the original decision text preserved"
    verification:
      - kind: command
        ref: "grep -c \"G-05-3\" 05-CONTEXT.md (1) and 05-UI-SPEC.md (2)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The user's real export renders 32 months, the largest 2014-01 at 58.0 days and 577.3 days in total"
    verification: []
    human_judgment: true
    rationale: "Requires the user's real zip, which is personal data and is never committed. The plan declares this an optional local human check outside CI; every amount in the committed fixtures is invented, so no automated test can stand in for it."

# Metrics
duration: 9 min
completed: 2026-10-02
status: complete
commits: 4
---

# Phase 05 Plan 18: Bucket the premium chart by the real grant date Summary

**`buildPremium` now dates a premium file by `CURR_PREMIUM` — the column a real export writes the operation datetime into — decided once per file, so a real export's 128 rows on a bulk-migration stamp no longer collapse onto one meaningless month (D-19 as amended, UAT G-05-3)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-02T16:05:00Z
- **Completed:** 2026-10-02T16:14:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Fixed the decision-bearing code. `buildPremium` resolves `CURR_PREMIUM` in its existing single `resolveColumns` call, picks the date column once for the whole file with a small internal helper, and reads the month for every row from that one key. Duration parsing, removals, unrecognised-string tracking, ranking, sizes, the `ops`-style counters and the trailing-space handling are untouched; `UPDATED` is still never read and the first row's keys are still listed exactly once.
- Reshaped the fixture to the real export's column semantics rather than inventing a parallel one. `PREMIUM_BULK_STAMP` and `premiumRow` put the grant datetime in `CURR_PREMIUM` and the same invented stamp in `CREATED` and `UPDATED`; the eighteen hand rows were rebuilt through it, so `PREMIUM_HAND_EXPECTED` did not change by a single digit — the dates moved a column, not a value.
- Added a seven-row real-shaped set covering what the hand set structurally could not: a day count with a seconds-bearing clock, a zero-second machine removal, a grant on the last second of a month, and grants in a year the bulk stamp is not in. Its key is derived by hand in the comment beside it (6 grants, 1 excluded, 5,641,711 s, months 24,167–24,170) and the oracle reproduces it field for field.
- Gave the oracle the same file-level rule with its own `readDate`, so the cross-check still shares no primitive with the builder and still writes the two sides in different shapes.
- Replaced the privacy rule's SHAPE rather than its list. `CURR_PREMIUM` came off `IDENTIFYING_COLUMNS` and a new test asserts what actually matters: the column is read (positive control on the watched rows), none of its cell text appears anywhere in the serialised view, `UPDATED` is never opened, and the month integers that the read produces do appear.
- Rebuilt every remaining inline premium row in the browser spec, the replay fixture and the fixtures README on `premiumRow`, and deleted the invented currency code — `ru.wot.gold` no longer appears anywhere in `tests/` or `src/`.
- Recorded the D-19 amendment in the three places a contract lives: 05-CONTEXT keeps the original wording and adds a dated paragraph beneath it, 05-UI-SPEC section 4 names the date column in its Source and Value bullets with no colour, geometry or copy row touched, and 05-SECURITY amends the T-05-11 row in place and adds a Post-UAT amendments section for T-05-54 and T-05-55 that explicitly declines to recompute the audit totals.

## Task Commits

1. **Task 1: Bucket a real-shaped premium file by CURR_PREMIUM, from the parsed CSV to the view (D-19 amended, D-20)** — `09cf39d` (test, RED) then `bd24842` (fix, GREEN)
2. **Task 2: Real-shaped rows in every remaining test, and a browser proof (D-19 amended, D-03)** — `e232684` (test)
3. **Task 3: Amend the contract documents and run the phase gate (D-19 amended)** — `5bb59bc` (docs)

_Note: Task 1 produced the RED/GREEN pair tdd.md requires. Task 2 added tests and a fixture README only; Task 3 edited three planning documents only. Neither had production code to make pass, so each committed once._

## TDD Red-Green-Refactor

**RED** (`09cf39d`) — the reshaped fixtures, the amended oracle, the hand-derived real-shape key and all the new builder tests were written before the builder changed. Against the unmodified `buildPremium`, `pnpm exec vitest run tests/unit/finance.test.ts tests/unit/finance-fixtures.test.ts` reported **6 failed / 77 passed**:

```
× reproduces the hand-derived premium answer and agrees with the oracle
× buckets a real-shaped premium file by CURR_PREMIUM, not by CREATED
× never draws the bulk-migration month, in either fixture
× still gives the reshaped eighteen-row hand fixture its original answer
× decides the date column once per file, and never guesses at an unreadable cell
× reads CURR_PREMIUM to derive a month and keeps its text out of the view
```

Every failure was an assertion on a month, a count or a figure — for example the mixed-rule case expecting 1 grant and being given 2, because the unmodified builder read the unreadable row's perfectly valid bulk `CREATED`. None was a crash, a zero-test discovery or an unrelated assertion, so the RED is on the planned behaviour. The four fixture-level tests that pass in the RED run are the oracle's own: they compare the oracle against the hand key, which is exactly the independence the oracle exists for.

**GREEN** (`bd24842`) — the date-column helper and the one-key read make all five changed unit files green (83 tests in the two premium files, 33 in the worker / sample-shape / replay files), with `pnpm run check` and `pnpm run lint` at exit 0.

**REFACTOR** — none needed. The helper is eight lines, is used once, and exists because naming the rule is the documentation; there was no duplication to extract.

## TDD Gate Compliance

The RED and GREEN gates were executed in order: `test(05-18)` at `09cf39d` is the only commit touching the fixtures, the oracle and the unit tests, and `fix(05-18)` at `bd24842` is the only commit touching `src/lib/worker/finance.ts`. The sequence is verifiable with `git log -E --grep="^test\((0*5)-(0*18)\):"` and `git log -E --grep="^fix\((0*5)-(0*18)\):"`.

As in plan 05-17, the GREEN commit is typed `fix` rather than tdd.md's `feat`, so a checker grepping for `^feat\((0*5)-(0*18)\):` finds no GREEN commit and would report a violation. The type was chosen deliberately: D-19 is a LOCKED decision the code was already violating in a real export, so this is a defect repair rather than a new feature, and plan 05-17's history types the identical UAT-gap fix the same way. A rename would trade an accurate message for a passing grep, so the discrepancy is recorded here instead. `workflow.tdd_mode` is `false`, so no gate checker was run.

## Files Created/Modified

- `src/lib/worker/finance.ts` — `premiumDateColumn` added above `buildPremium`; `resolveColumns` now also resolves `CURR_PREMIUM`; the row loop reads `dateKey`; the header rule 3, the `monthOfTimestamp` doc and the `buildPremium` doc rewritten (CURR_PREMIUM is no longer claimed to name a currency, and the reason the rule is per-file is stated in the helper's own comment)
- `tests/helpers/finance-oracle.ts` — `premiumDateColumn` with the oracle's own `readDate`; `oraclePremium` reads one `dateColumn` for the whole file; the doc block rewritten to state the amended rule and keep the "as recorded, no zone" point
- `tests/fixtures/finance-fixtures.ts` — header doc corrected to the real column meanings and to `Financial_data/`; `PREMIUM_BULK_STAMP` and `premiumRow` added; `HAND_CURR_PREMIUM` deleted; `PREMIUM_HAND_ROWS` rebuilt through `premiumRow` with its doc rewritten; `PREMIUM_REAL_SHAPE_ROWS` / `_CSV` / `_EXPECTED` added with the arithmetic in the key's comment
- `tests/unit/finance.test.ts` — `premiumRealShapeRows` and `premiumRowIn` helpers; the `at` helper and the no-usable rows switched to the real shape; five new premium tests; `CURR_PREMIUM` removed from `IDENTIFYING_COLUMNS` with the reason; the new privacy canary
- `tests/unit/finance-fixtures.test.ts` — four new tests: the bulk stamp on every row of both sets (as written and as parsed), the real-shaped oracle answer with its month assertion, the CSV round trip, and the oracle's CREATED fallback
- `tests/e2e/finance.spec.ts` — the fixture imports extended; the single-month, junk-overflow and impossible-date rows rebuilt on `premiumRow`; `FABRICATED_CURR_PREMIUM` and its doc deleted; the `05-18` describe with the real-shape browser test added
- `tests/unit/replay-reclassify.test.ts` — the premium row built with `premiumRow` and the doc corrected; no assertion changed
- `tests/fixtures/README.md` — the finance-fixtures bullet extended with the premium file's real shape, `premiumRow`, the invented stamp and the data policy
- `.planning/phases/05-vehicle-stats-financial-dashboards/05-CONTEXT.md` — one dated amendment paragraph directly beneath D-19, which is otherwise untouched
- `.planning/phases/05-vehicle-stats-financial-dashboards/05-UI-SPEC.md` — the Source and Value bullets of section 4 only
- `.planning/phases/05-vehicle-stats-financial-dashboards/05-SECURITY.md` — the T-05-11 row amended in place; a Post-UAT amendments section appended

## Decisions Made

- The helper stops at the first readable `CURR_PREMIUM` cell instead of testing the whole column first. The answer is identical either way, and a file that does carry grant dates — which is every real one — pays for one cell rather than for all of them.
- `premiumRow` takes `(premium, grantedAt)` rather than a whole tuple, so the export's column ORDER is stated once in the module instead of eighteen times in the row list. That is what makes the hand fixture's unchanged key a proof rather than a coincidence.
- The T-05-11 amendment went inside the table cell rather than into a paragraph after the row. A paragraph between two Markdown rows splits the table in two, and an audit reader would then be looking at a register with a hole in the middle of it.
- The browser test asserts the pill with `toContainText` rather than `toHaveText`, because the pill also carries the shared explanation sentence. The figure is still derived from `formatPremiumExcludedPill(1, 'en-US')`, so it is an expectation and not a transcript; the element's whole text is not a claim this block owns.

## Deviations from Plan

**1. [Rule 1 - Bug] The new browser test asserted the excluded pill with `toHaveText`.**
- **Found during:** Task 2
- **Issue:** The `premium-excluded` pill renders the figure AND the shared `PREMIUM_EXCLUDED_EXPLANATION` sentence, so `toHaveText(formatPremiumExcludedPill(1, 'en-US'))` failed against a page that was rendering correctly.
- **Fix:** Match the formatter's output inside the element instead of as its whole text, with a comment saying why the whole text is not this block's claim. The existing 05-10 specs already use `toContainText` for the same pill.
- **Files modified:** `tests/e2e/finance.spec.ts`
- **Commit:** `e232684`

## Issues Encountered

- `gsd_run check tdd-red-evidence` cannot classify a vitest RED on this project — STATE.md records from Phase 04 that the checker parses node:test TAP and reads vitest 5's nested output as a load crash, returning `INVALID_RED` / `zero_tests_discovered` for a run that is a genuine RED. The RED evidence above is recorded by hand and the git-log gate is the machine check that works here. `workflow.tdd_mode` is `false`, so the checker was not run.

## User Setup Required

None — no external service configuration required. No dependency was added, and `git diff --quiet -- package.json pnpm-lock.yaml` exits 0.

## Verification

| Check | Result |
|-------|--------|
| `pnpm exec vitest run tests/unit/finance.test.ts tests/unit/finance-fixtures.test.ts` | 83 passed |
| `pnpm exec vitest run tests/unit/data-query-worker.test.ts tests/unit/sample-export-shape.test.ts tests/unit/replay-reclassify.test.ts` | 33 passed |
| `pnpm exec vitest run tests/unit/contrast.test.ts` | 39 passed |
| `pnpm run test:unit` | 1350 passed / 46 files |
| `pnpm run check` | exit 0 |
| `pnpm run lint` | exit 0 |
| `pnpm run build` | exit 0 |
| `pnpm exec playwright test tests/e2e/finance.spec.ts tests/e2e/dashboard.spec.ts tests/e2e/zero-network.spec.ts` | 73 passed |
| `! grep -rn "ru.wot.gold" tests src` | exit 0 |
| `git diff --quiet -- package.json pnpm-lock.yaml` | exit 0 |
| `grep -c "G-05-3" 05-CONTEXT.md` / `05-UI-SPEC.md` | 1 / 2 |

## Next Phase Readiness

UAT gap G-05-3 is closed in the builder, in the independent oracle, in the hand-derived key and in the browser. One optional human check remains, deliberately outside CI because the real zip is personal data and must never be committed: run the built app, drop the local real export, and read the Premium time block under `Financial_data`. Expect 32 months with premium granted, the largest month 2014-01 at 58.0 days, 577.3 days in total, and a span starting in 2013-09. No real row, date or figure was copied into the repository to make this possible — every date, duration and the bulk stamp in the fixtures are invented, and the real totals appear only in that manual check and in the already-committed UAT file.

05-SECURITY.md's frontmatter counts, severity table and sign-off are deliberately NOT recomputed: the Post-UAT amendments section says so and names the next security re-audit as the place where T-05-54 and T-05-55 fold into the register. Anyone reading `threats_open: 0` there should read it as the 05-01..05-17 audit's statement, which is still accurate for what it audited.

## Self-Check: PASSED

- All eleven files in `files_modified` exist and were changed by this plan's four commits.
- `09cf39d`, `bd24842`, `e232684` and `5bb59bc` are all present in `git log`; `bd24842` touches only `src/lib/worker/finance.ts` and `09cf39d` touches no `src/` file, so the RED/GREEN split is visible in the tree as well as in the log.
- No fixture, test or comment keeps the invented premium-currency-code shape (`ru.wot.gold` is absent from `tests/` and `src/`), and `PREMIUM_HAND_EXPECTED` is byte-identical to what 05-17 committed.
- No dependency added, no network call added, no real data committed.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Completed: 2026-10-02*
