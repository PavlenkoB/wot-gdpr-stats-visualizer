---
phase: 05-vehicle-stats-financial-dashboards
plan: 17
subsystem: finance
tags: [finance, virtual-currency, worker, d18, uat-gap, income, exact-decimals]

requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: "buildCurrency, the independent oracle, the hand currency answer key and the finance browser specs from 05-04 through 05-16"
provides:
  - "buildCurrency totals a TYPE income as money up, so an income-only currency reports its real deposit total (D-18, UAT G-05-4)"
  - "CURRENCY_INCOME_ONLY_ROWS / _CSV / _EXPECTED — a fixture shaped like the real export's stray UAH, with invented amounts"
  - "A per-currency and per-month invariant: every usable operation lands in exactly one direction, so inOps + outOps == ops"
  - "A scale-level operation-count equality between the rendered cells and the oracle, which was unassertable before"
affects: [05-vehicle-stats-financial-dashboards, finance, uat-verification, 05-UI-SPEC]

actuals:
  tokens: 8429
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A locked decision is pinned by THREE independent answer sources — a hand key, an oracle that shares no code with src/, and a real-shaped fixture — so a builder cannot agree with a key that agrees with it"
    - "An invariant is a stronger pin than a figure: inOps + outOps == ops holds for every currency and every month, so a swallowed operation fails without a new expected number"

key-files:
  created: []
  modified:
    - src/lib/worker/finance.ts
    - src/lib/finance-state.ts
    - tests/helpers/finance-oracle.ts
    - tests/fixtures/finance-fixtures.ts
    - tests/unit/finance-fixtures.test.ts
    - tests/unit/finance.test.ts
    - tests/e2e/finance.spec.ts
    - tests/e2e/finance-scale.spec.ts

key-decisions:
  - "Income takes the deposit path as an `else` arm rather than a third explicit branch, because the accepted-TYPE test above already refuses every other value. The arm is therefore reachable only by `deposit` or `income`, and the two share one line of accumulation rather than two that could drift."
  - "The oracle adds income and deposit on SEPARATE lines rather than combining the condition, so it keeps its own plain-number style and does not mirror the builder's branch structure — the independence the oracle exists to provide."

patterns-established:
  - "Real-shaped fixtures use INVENTED amounts and the all-zero ORDER uuid. The user's real totals appear only in a local human check, never in a repository file (T-05-53)."
  - "A browser assertion of a composed sentence pins it against BOTH the literal a reader reads and the app's own formatter, so a copy change and a figure change cannot quietly agree with each other."

requirements-completed: [FINANCE-02]

coverage:
  - id: D1
    description: "buildCurrency totals a TYPE income into inUnits, the month's inUnits and the month's inOps (D-18)"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/finance.test.ts#totals an income-only currency as its deposits instead of reporting zero"
        status: pass
      - kind: unit
        ref: "tests/unit/finance.test.ts#counts an income as an operation and as money up (D-18)"
        status: pass
      - kind: unit
        ref: "tests/unit/finance.test.ts#gives an income-only month its deposit-side operations and sum"
        status: pass
    human_judgment: false
  - id: D2
    description: "The hand answer key and the independent oracle agree with the builder on income, with crystal at 150,000 deposited and UAH at 512,500"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/finance-fixtures.test.ts#totals an income as a deposit beside the deposit itself (D-18)"
        status: pass
      - kind: unit
        ref: "tests/unit/finance-fixtures.test.ts#income-only currency fixture (four tests)"
        status: pass
      - kind: unit
        ref: "tests/unit/finance.test.ts#reproduces the hand-derived currency answer and agrees with the oracle"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every exclusion rule is unchanged: an unknown TYPE, a non-numeric or negative AMOUNT and an unbucketable CREATED still exclude and are still counted"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/finance.test.ts#excludes an unusable amount, a negative amount and an unknown TYPE"
        status: pass
    human_judgment: false
  - id: D4
    description: "The per-currency and per-month direction invariant holds over the hand rows and the 10,000-row generated spec"
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: "tests/unit/finance.test.ts#gives every usable operation exactly one direction, in every month"
        status: pass
    human_judgment: false
  - id: D5
    description: "The browser renders an income-only currency's Other-currencies caption with its real deposits, and an income-only month cell names its operations"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(income-only) an income-only currency reports its deposits, not zero"
        status: pass
      - kind: e2e
        ref: "tests/e2e/finance.spec.ts#(income-month) a month of nothing but incomes names its operations"
        status: pass
    human_judgment: false
  - id: D6
    description: "At 50,000 operations the sum of a chart's per-cell data-ops equals the oracle's operation count for that currency"
    requirement: FINANCE-02
    verification:
      - kind: e2e
        ref: "tests/e2e/finance-scale.spec.ts#(2) every chart draws the oracle's months and their figures add up to its totals"
        status: pass
    human_judgment: false
  - id: D7
    description: "The real export's own UAH row reads deposits 821, withdrawals 0, 5 operations in the Financial_data card"
    verification: []
    human_judgment: true
    rationale: "Requires the user's real zip, which is personal data and is never committed. The plan declares this an optional local human check outside CI; every amount in the committed fixture is invented, so no automated test can stand in for it."

# Metrics
duration: 6 min
completed: 2026-10-02
status: complete
commits: 3
---

# Phase 05 Plan 17: Income counts as up in the virtual-currency builder Summary

**`buildCurrency` now totals a TYPE income into the deposit side, so the real export's income-only UAH no longer reads "Deposited 0 / Withdrawn 0 over 5 operations" (D-18, UAT G-05-4)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-02T11:47:19Z
- **Completed:** 2026-10-02T11:52:49Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Fixed the decision-bearing code: the direction branch in `buildCurrency` sends `income` down the deposit path, so it adds to the currency's `inUnits`, to its month's `inUnits`, and increments that month's `inOps`. Withdrawal is untouched, and so are the accepted-TYPE test, the AMOUNT and CREATED exclusion rules, the title handling, the `ops` counter and the ORDER-column privacy rule.
- Re-derived the answer keys by hand rather than by rerunning the builder: crystal's deposited total became 150,000 (deposit 100 + income 50) and UAH's 512,500 (income 500 + deposit 12.5), and the independent oracle totals income into the deposited side with its own plain-Number logic.
- Added a real-shaped income-only fixture — five `UAH` rows, every one an `income`, a blank `CURRENCY_TITLE`, the all-zero `ORDER`, invented amounts summing to 600 — plus a hand-derived key and four tests that re-derive it from the rendered CSV.
- Made a previously unassertable equality assertable: because an income is up, every usable operation sits in exactly one direction, so a month's `inOps + outOps` adds back to its operation count. That is now pinned over the hand rows and the 10,000-row generated spec, and at 50,000 operations the sum of a chart's per-cell `data-ops` equals the oracle's operation count.
- Removed every comment that asserted the retired rule, in `src/` and in `tests/`.

## Task Commits

1. **Task 1: Income counts as up for one currency, from the parsed CSV to the view (D-18)** — `291eb7c` (test, RED) then `0812c5e` (fix, GREEN)
2. **Task 2: Browser proof, scale guard and stale comments (D-16, D-18)** — `26ec0cb` (test)

**Plan metadata:** (this commit)

_Note: Task 1 produced the RED/GREEN pair tdd.md requires; Task 2 added only tests and comments, so it committed once._

## TDD Red-Green-Refactor

**RED** (`291eb7c`) — the corrected hand key, the income-only fixture, the oracle change, the income-only parsed test, the per-month test, the mixed-exclusion retotal and the direction invariant were written before the builder changed. Against the unmodified builder, `pnpm exec vitest run tests/unit/finance.test.ts tests/unit/finance-fixtures.test.ts` reported **8 failed / 66 passed**:

```
× reproduces the hand-derived currency answer and agrees with the oracle
× totals an income-only currency as its deposits instead of reporting zero
× draws a twenty-year history past the twelve-year scale threshold
× excludes an unusable amount, a negative amount and an unknown TYPE
× counts an income as an operation and as money up (D-18)
× gives an income-only month its deposit-side operations and sum
× gives every usable operation exactly one direction, in every month
× aggregates fifty thousand operations inside a five-second ceiling
```

Every failure was an assertion diff on a deposited total (for example crystal `depositedThousandths: 100,000` against the key's `150,000`), not a crash, not zero-test discovery and not an unrelated assertion — so the RED is on the planned behaviour.

**GREEN** (`0812c5e`) — the builder change makes all five changed unit files green (124 tests), with `pnpm run check` and `pnpm run lint` at exit 0.

**REFACTOR** — none needed. The builder change is a four-line `else` arm and two rewritten doc blocks; there was no duplication to extract.

## TDD Gate Compliance

The RED and GREEN gates were both executed in order: `test(05-17)` at `291eb7c` is the only commit touching the fixtures, the oracle and the unit tests, and `fix(05-17)` at `0812c5e` is the only commit touching the builder. The sequence is verifiable with `git log -E --grep="^test\((0*5)-(0*17)\):"` and `git log -E --grep="^fix\((0*5)-(0*17)\):"`.

The GREEN commit is typed `fix` rather than tdd.md's `feat`, so the gate checker (`git log -E --grep="^feat\((0*5)-(0*17)\):"`) finds no GREEN commit and would report a violation. The commit type was chosen deliberately: D-18 is a LOCKED decision the code was already violating, so this is a defect repair rather than a new feature, and the repository's own history types a UAT-gap fix the same way. A rename would trade an accurate message for a passing grep, so the discrepancy is recorded here instead.

## Files Created/Modified

- `src/lib/worker/finance.ts` — `buildCurrency` sends `income` down the deposit path; the doc block above the function and the comment after the branch rewritten to say income is up per D-18
- `src/lib/finance-state.ts` — comment only: the `currencyChartInput` paragraph about a month with no operations now says a zero up and zero down month is one whose operations all carry a zero amount, since an income month now carries operations
- `tests/helpers/finance-oracle.ts` — `oracleCurrency` adds an income to the deposited total on its own line; the `FLOW_TYPES` note and the doc block rewritten
- `tests/fixtures/finance-fixtures.ts` — `CURRENCY_INCOME_ONLY_ROWS`, `CURRENCY_INCOME_ONLY_CSV`, `CURRENCY_INCOME_ONLY_EXPECTED` added; `CURRENCY_HAND_EXPECTED` corrected and its derivation comments rewritten
- `tests/unit/finance-fixtures.test.ts` — the retired-rule test renamed and retargeted; four income-only fixture tests added
- `tests/unit/finance.test.ts` — the exact-decimal, mixed-exclusion and income tests corrected; the income-only parsed test, the per-month test and the direction invariant added
- `tests/e2e/finance.spec.ts` — the two 05-17 browser tests added; the sample export's literal captions updated; the empty-month test's comment rewritten
- `tests/e2e/finance-scale.spec.ts` — test 2 now sums `data-ops` per chart and asserts it equals the oracle's operation count, with the "NOT ASSERTED HERE" comment replaced by why it is assertable

## Decisions Made

- Income shares an `else` arm with deposit rather than becoming a third explicit branch. The accepted-TYPE test immediately above already refuses every other value, so the arm is reachable only by one of the two, and two accumulating lines that could drift become one. The comment above the arm says so, so a future fourth TYPE cannot be added without the arm noticing.
- The oracle adds income and deposit on separate lines rather than in one condition. It is a different implementation by design; mirroring the builder's structure here would make the cross-check weaker for no benefit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Two small corrections inside the planned work, both caught before committing. A `page` fixture parameter was dropped from the second new e2e test, which `pnpm run check` caught immediately (TS2304), and Prettier reformatted the same file afterwards. Both were fixed in place; neither is a deviation in scope.
- `gsd_run check tdd-red-evidence` cannot classify a vitest RED on this project — STATE.md records from Phase 04 that the checker parses node:test TAP and reads vitest 5's nested output as a load crash, returning `INVALID_RED`/`zero_tests_discovered` for a run that is a genuine RED. The RED evidence above is therefore recorded by hand, and the git-log gate (`^test\((0*5)-(0*17)\):`) is the machine check that works here. `workflow.tdd_mode` is `false`, so the checker was not run.

## User Setup Required

None - no external service configuration required. No dependency was added and `git diff --quiet -- package.json pnpm-lock.yaml` exits 0.

## Verification

| Check | Result |
|-------|--------|
| `pnpm exec vitest run tests/unit/finance.test.ts tests/unit/finance-fixtures.test.ts` | 74 passed |
| `pnpm run test:unit` | 1340 passed / 46 files |
| `pnpm run check` | exit 0 |
| `pnpm run lint` | exit 0 |
| `pnpm exec playwright test tests/e2e/finance.spec.ts tests/e2e/finance-scale.spec.ts` | 32 passed |
| `git diff --quiet -- package.json pnpm-lock.yaml` | exit 0 |
| `! grep -rniE "in neither (currency )?total\|lands in neither\|neither side" src tests` | exit 0 |
| `git status --short` after the plan's commits | only `.planning/STATE.md` and `.planning/state.json` |

## Next Phase Readiness

UAT gap G-05-4 is closed in code, in all three answer sources and in the browser. The optional local human check remains open: drop the real export into `pnpm run preview` and confirm the Financial_data card's Other currencies row for UAH reads deposits 821, withdrawals 0, 5 operations. No real row or figure was copied into the repository to make this possible — the fixture's amounts are invented, and the real total appears only in that manual check.

`05-UI-SPEC.md` needs no amendment: its line 363 already reads "`deposit` and `income` are up", so the spec, the locked decision and this plan's own must-have truth were three sources saying UP while the code, the hand key and the oracle were three saying NEITHER. The disagreement was never inside the documentation. STATE.md's Phase 05 entry that recorded the old rule is annotated as resolved in this plan.

## Self-Check: PASSED

- All eight files in `files_modified` exist and were changed by this plan's three commits.
- `291eb7c`, `0812c5e` and `26ec0cb` are all present in `git log` and each touches only the plan's own files.
- No source or test comment asserts the retired rule (the grep above exits 0).
- No dependency, no real data committed, no network call added.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Completed: 2026-10-02*
