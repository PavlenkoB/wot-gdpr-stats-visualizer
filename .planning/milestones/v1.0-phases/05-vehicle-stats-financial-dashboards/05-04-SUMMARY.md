---
phase: 05-vehicle-stats-financial-dashboards
plan: 04
subsystem: data
tags: [bigint, micro-units, csv, aggregation, privacy-canary, oracle, month-index]

requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: >-
      plan 05-01's three hand fixtures with hand-derived answer keys, the
      independent zero-import oracle, and the four seeded scale specs that this
      plan's builders are checked against.
  - phase: 04-activity-time-dashboards
    provides: >-
      `parseSessionTimestamp` (both export timestamp shapes, range-checked) and
      `civilFromDays`, reused here rather than a third calendar parser.
provides:
  - >-
    src/lib/finance-shared.ts: the whole view contract in a ZERO-import module —
    the seven constants, `monthIndex`/`monthParts`, and the eight view types the
    worker builds and the page reads.
  - >-
    src/lib/decimal.ts: exact money over `bigint` micro-units at scale 6, with
    one half-away-from-zero rounding at display and a single float conversion
    reserved for bar heights.
  - >-
    src/lib/worker/finance.ts: `parsePremium`, `monthOfTimestamp`, `buildPremium`,
    `currencyCodeOf`, `buildCurrency`, `spendCurrencyOf`, `parseGiftFlag` and
    `buildSpend` — pure, DOM-free, and proven against two answer keys.
  - >-
    35 new unit tests over the real-header fixtures, the seeded scale specs, a
    Proxy privacy canary and ten thousand seeded random orders.
affects: [05-07, 05-08, 05-09, 05-10, 05-11, 05-13, 05-15, 05-16, finance-dashboards]

actuals:
  tokens: 29600
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - >-
      Money is a `bigint` count of micro-units and crosses the worker boundary
      as a decimal STRING; a fraction is created exactly once, at display, by
      integer arithmetic, and a `number` is produced in exactly one function
      whose only caller will be a bar height.
    - >-
      Column resolution walks the first row's key list ONCE for the whole column
      set, which is both the cheaper shape and the one a Proxy canary can
      assert: one enumeration per file, never per row and never per column.
    - >-
      Every builder reads the columns it NAMES and no others, so an identifying
      value cannot reach a view even by accident; the canary proves the
      instrument is live by reading the coupon column on purpose first.
    - >-
      A disclosure list (unrecognised premium strings) is ranked by count
      descending then plain code units, capped, and paired with a count of the
      OCCURRENCES it does not account for — so the figure stays honest past the
      point where distinct strings stop being tracked.

key-files:
  created:
    - src/lib/finance-shared.ts
    - src/lib/decimal.ts
    - src/lib/worker/finance.ts
    - tests/unit/finance.test.ts
    - tests/unit/decimal.test.ts
  modified: []

key-decisions:
  - >-
    An `income` is a usable operation that lands in NEITHER currency total. The
    plan's own must-have truth and UI-SPEC section 5 say `income` is "up", and
    its own acceptance criteria plus BOTH answer keys (the hand fixture and the
    independent oracle) say otherwise; the answer keys won, and the conflict is
    written up below for 05-08 and 05-09 to reconcile in the copy.
  - >-
    An unreadable `GAME_CODE` is RANKED as the label the card draws
    (`(not recorded)`), not as `null`, so the breakdown table is sorted the way
    it is shown. Grouping stays keyed on `null`, so a file whose `GAME_CODE`
    literally reads `(not recorded)` is still its own row.
  - >-
    `unrecognisedMore` counts OCCURRENCES the list does not account for, not
    distinct strings, so it stays a true number past the 1,000-distinct tracking
    cap instead of becoming a lower bound.
  - >-
    A currency `AMOUNT` of zero is a usable operation that moves no money, and a
    PAID order of zero is an included paid order. Zero is not an unreadable
    cell, and a card that excluded a real 0.00 order would misreport it.

patterns-established:
  - >-
    The scale conversion lives in the TEST (`units(thousandths)`), never in the
    production side: the fixtures and the oracle work in thousandths because no
    fixture carries more than three decimals, and the app works in micro-units
    because a real amount may carry six. Every comparison goes through one
    helper applied to the fixture side.
  - >-
    A display string is derived TWICE from the two answer keys — once by
    `formatMoneyAmount` from the app's micro-unit total and once by integer
    arithmetic in the test from the oracle's thousandths — so the rounding rule
    is checked against something that shares no code with the money reader.
  - >-
    Ordering rules compare CODE UNITS and never a locale-aware collation, and a
    blank-vs-null tie-break is stated per list: a blank CURRENCY_CODE sorts last
    only among ties, the unit-less SPEND card sorts last unconditionally, and a
    blank GAME_CODE sorts as its drawn label.

requirements-completed: [FINANCE-01, FINANCE-02, FINANCE-03]

coverage:
  - id: D1
    description: >-
      The premium hand fixture travels from real-header CSV text through
      `parseCsvFile`, `parsePremium` and `buildPremium` to the hand-derived
      monthly answer, agreeing with `oraclePremium` field for field.
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: 'tests/unit/finance.test.ts#05-04 tracer: premium through the production parser to the hand-derived answer'
        status: pass
    human_judgment: false
  - id: D2
    description: >-
      Premium edge rules: a withdrawal is excluded rather than charted or
      subtracted, a blank cell is counted and never listed, an unreadable or
      out-of-window date is excluded without listing its (fine) text, and the
      disclosure order is count-descending then code units.
    verification:
      - kind: unit
        ref: 'tests/unit/finance.test.ts#orders the listed unrecognised strings by count, then by code units'
        status: pass
    human_judgment: false
  - id: D3
    description: >-
      Exact money: every accepted and rejected amount shape, and one half-away
      rounding where 1.005 draws 1.01 and 15.495 draws 15.50, against the float
      that draws 1.00 and 15.49.
    requirement: FINANCE-03
    verification:
      - kind: unit
        ref: 'tests/unit/decimal.test.ts#05-04 exact decimal arithmetic'
        status: pass
    human_judgment: false
  - id: D4
    description: >-
      The currency hand fixture reproduces CURRENCY_HAND_EXPECTED and
      `oracleCurrency`: two charts, four others, an exact non-integer amount, a
      blank code and a `__proto__` code in their pinned positions.
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: 'tests/unit/finance.test.ts#reproduces the hand-derived currency answer and agrees with the oracle'
        status: pass
    human_judgment: false
  - id: D5
    description: >-
      Chart selection: the 50-operation threshold, the eight-chart cap, code-unit
      tie order with a blank last, and a 240-month history past the scale
      threshold.
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: 'tests/unit/finance.test.ts#charts at most eight currencies and lists every code it did not chart'
        status: pass
    human_judgment: false
  - id: D6
    description: >-
      The spend hand fixture reproduces ORDERS_HAND_EXPECTED and `oracleSpend`:
      five cards, exact totals, gifts, every status bucket, and the two
      breakdowns summing back to the headline in exact micro-units.
    requirement: FINANCE-03
    verification:
      - kind: unit
        ref: 'tests/unit/finance.test.ts#reproduces the hand-derived spend answer and agrees with the oracle'
        status: pass
    human_judgment: false
  - id: D7
    description: >-
      No figure anywhere spans two currencies, and no non-PAID row moves a units
      figure — checked on a two-currency fixture and on ten thousand seeded
      random orders.
    requirement: FINANCE-03
    verification:
      - kind: unit
        ref: 'tests/unit/finance.test.ts#never blends two currencies into one figure'
        status: pass
    human_judgment: false
  - id: D8
    description: >-
      The privacy canary: none of ORDER_UUID, PAY_COUPON_NAME,
      PAY_AGGREGATOR_DESC, AA_PACKAGE_LIST, PAY_ITEM_TYPE_NAME, the currency
      ORDER column, CURR_PREMIUM, UPDATED, NAME or IP is read by any builder, and
      the first row's key list is enumerated exactly once per file.
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: 'tests/unit/finance.test.ts#sees no identifying column in the premium, currency or spend path'
        status: pass
    human_judgment: false
  - id: D9
    description: >-
      Fifty thousand currency operations aggregate inside a five-second ceiling
      and equal the oracle, with the excluded count derived from the spec rather
      than hard-coded.
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: 'tests/unit/finance.test.ts#aggregates fifty thousand operations inside a five-second ceiling'
        status: pass
    human_judgment: false
  - id: D10
    description: >-
      That the real export writes `INCOME` currency operations and `REFUND`
      rows, and that a real `CURRENCY_TITLE` is blank for some codes. All three
      come from the researched evidence table rather than a re-opened sample.
    verification: []
    human_judgment: true
    rationale: >-
      Only a human with a real export can confirm the physical shapes. This plan
      encodes the researched evidence faithfully; the 05-01 round-trip test
      already proves the fixture's shape survives the production parser, not that
      the shape is the export's.

duration: 19min
completed: 2026-10-01
status: complete
---

# Phase 05 Plan 04: The finance builders and the exact-decimal module

**Every figure the Financial_data cards will draw, produced by three pure functions and an exact-money module, each checked against a hand-derived key and an independent oracle — 35 new tests, 1001 in the suite**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-01T16:46:04Z
- **Completed:** 2026-10-01T17:05:03Z
- **Tasks:** 3
- **Files modified:** 5 (all created, 2,557 lines)

## Accomplishments

- **The premium path is proven from real CSV text to a hand-derived answer.**
  `PREMIUM_HAND_CSV` is parsed by the import path's own `parseCsvFile`, so the
  builder sees the quote-all cells, the export's trailing space on every
  premium-plus value and the bare-CR lines exactly as the worker will. The ready
  view equals `PREMIUM_HAND_EXPECTED` and `oraclePremium` field for field: 11
  grants, 7 excluded, 4,579,200 seconds over four sparse months inside a
  five-month axis, the July tooltip shipping 86,400 / 172,800 / 345,600 with one
  more size, and exactly the withdrawal string and `premium forever` listed.
- **Money is exact and the rounding is asserted against the float it replaces.**
  `parseDecimalUnits` accepts `.5` (five real PAID orders are written that way),
  `5.`, `5.250`, `+2` and `-3`, and refuses `1e3`, `1,5`, a blank, seven fraction
  digits and any cell over 40 characters. `formatMoneyAmount` rounds the
  magnitude once in `bigint` and hands `Intl.NumberFormat` the exact decimal
  TEXT, so 1,005,000 micro-units draws `1.01` and 15,495,000 draws `15.50` — the
  two cases the test file pins beside `(1.005).toFixed(2) === '1.00'` and
  `(15.495).toFixed(2) === '15.49'`.
- **The privacy canary is proved live before it is trusted.** A Proxy per row
  records every value read and every key listing; a control test reads
  `PAY_COUPON_NAME` on purpose and turns the canary red, and only then are the
  ten identifying column names asserted absent from all three builders — with
  the first row's key list enumerated exactly once per file.
- **The spend block cannot blend a currency, and the tests say so three ways.**
  A two-currency fixture asserts 30.00 units (the sum of the two cards) appears
  in no field of either card; a non-PAID row is added and no units figure moves
  while the counts do; and ten thousand seeded random orders assert that
  `byYear` and `byGame` each sum to the headline in exact micro-units, not in
  displayed text, because two individually rounded figures can differ from a
  rounded total by a cent.

## Task Commits

Each task was committed atomically, RED then GREEN:

1. **Task 1 (tracer): the premium hand fixture end to end** — `ac4a568` (test) → `874e515` (feat)
2. **Task 2: exact decimals and the currency flow builder** — `124b405` (test) → `0aa171a` (feat)
3. **Task 3: the spend builder, the canary and the scale ceiling** — `a72d064` (test) → `301414d` (feat)

The `actuals.commits` ledger counts **7**, not 6: `dd2654c parallelization true`
(an orchestrator config commit touching only `.planning/config.json`) landed on
the branch between the ledger being taken and this plan's first commit. Six of
the seven are this plan's.

### RED and GREEN evidence, as recorded

| Task | RED | GREEN |
|------|-----|-------|
| 1 | `Tests 5 failed (5)`, exit 1 — `expected { kind: 'grant', seconds: NaN }`, `expected 'no-usable' to be 'ready'`, `expected 'no-usable' to be 'not-in-export'`: five assertion failures against a stub, no module crash | `Tests 5 passed (5)`, exit 0 |
| 2 | `Tests 15 failed \| 5 passed (20)`, exit 1 — six decimal assertions failing on a stub returning `null`/`0`/`''`, nine currency tests on `finance.buildCurrency is not a function` | `Tests 21 passed (21)`, exit 0 |
| 3 | `Tests 12 failed \| 17 passed (29)`, exit 1 — `TypeError: parseGiftFlag is not a function` and eleven more, each inside its own test | `Tests 29 passed (29)`, exit 0; whole suite `1001 passed (1001)` |

Between RED and GREEN, each task had one intermediate run with real derivation
failures; those are the five findings under Deviations.

## Files Created/Modified

- `src/lib/finance-shared.ts` — the view contract in a module with **zero
  imports**: seven documented constants, `monthIndex`/`monthParts`, and the
  eight view types. Legal for the worker and the page to import because it
  depends on neither.
- `src/lib/decimal.ts` — `MICRO_SCALE`, `parseDecimalUnits`, `parseUnitsString`,
  `unitsToNumber`, `formatMoneyAmount`, `formatDecimalAmount`.
- `src/lib/worker/finance.ts` — the eight builders, each resolving only the
  columns it names and grouping only in a `Map`.
- `tests/unit/decimal.test.ts` — 6 tests: the amount table, the reject list, the
  rounding against the float, the exact formatter, the one float conversion, the
  transported-string validator.
- `tests/unit/finance.test.ts` — 29 tests: the premium tracer, the currency
  builder, the spend builder, the privacy canary, the scale ceiling.

## Decisions Made

- **An `income` is a usable operation and lands in NEITHER currency total.** See
  Deviations 1 — the plan contradicts itself here and its own answer keys won.
- **A blank `GAME_CODE` is ranked as the label the card draws.** Grouping stays
  keyed on `null`, but sorting substitutes `(not recorded)`, so the table is
  ordered the way it is rendered and a file whose game code literally reads
  `(not recorded)` is still its own row rather than a collision.
- **`unrecognisedMore` counts occurrences, not distinct strings.** Past the
  1,000-distinct tracking cap the distinct count is a lower bound, and a
  disclosure that says "and 3 more" when there are 4,000 would be a lie.
- **A zero amount is a real amount.** `0.00` is an included paid order and a
  usable currency operation; zero is not an unreadable cell, and the
  implementation deliberately draws no minus for a value that rounds to zero
  from below zero, because `-0.00` is a number that does not exist.
- **`parseUnitsString` does not trim, unlike a cell.** A transported sum is
  written by this app, so whitespace in it means the stored value is not what
  the app wrote.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] An `income` currency operation is in neither total, not "up"**
- **Found during:** Task 2, GREEN
- **Issue:** the plan's must-have truth #4 and UI-SPEC section 5 both say
  "`deposit` and `income` are up". The same plan's acceptance criterion demands
  `buildCurrency` equal `CURRENCY_HAND_EXPECTED` and `oracleCurrency`, and BOTH
  of those put crystal's income in neither sum (crystal: 100 deposited, 30
  withdrawn, 3 operations). Two independent answer keys against one summary
  line.
- **Fix:** an income counts toward the operation count and contributes to
  neither total; the fixture, the oracle and 05-01's own 38 tests all already
  encode that. A test pins it on its own so the rule cannot drift back.
- **Files modified:** `src/lib/worker/finance.ts`, `tests/unit/finance.test.ts`
- **Verification:** the hand fixture and the oracle agree; `inOps + outOps` is
  documented as not necessarily equal to `ops` for a currency that has an income
- **Committed in:** `0aa171a`
- **Flagged for:** 05-08 and 05-09 own the copy, and UI-SPEC section 5's
  direction sentence needs amending where it lives.

**2. [Rule 1 — Bug] The by-game breakdown was sorted with `null` last, not with the drawn label**
- **Found during:** Task 3, GREEN
- **Issue:** the plan's prose says `byGame` sorts "by paid descending then code
  in code-unit order with null last", but the hand answer key and the oracle
  both put `(not recorded)` BEFORE `WOT` on the unit-less card — because the
  oracle compares the LABEL, and `(` sorts before `W` in code units. The plan's
  own Task 3 behaviour line ("the unit-less card has game codes null and WOT")
  also lists null first.
- **Fix:** the comparator substitutes the drawn label for `null`; grouping stays
  keyed on `null` so a literal `(not recorded)` in a `GAME_CODE` cannot collide
  with the sentinel.
- **Files modified:** `src/lib/worker/finance.ts`, `tests/unit/finance.test.ts`
- **Verification:** the hand fixture and the oracle agree on every card
- **Committed in:** `301414d`

**3. [Rule 1 — Bug] Column resolution enumerated the key list once per column**
- **Found during:** Task 3, the privacy canary
- **Issue:** each builder called a per-column `resolveColumn`, so the Proxy
  recorded two key listings for the premium file and six for the orders file.
  Functionally correct and cheap, but it made the "one enumeration for the first
  row of a file" property untestable and it is not the shape T-05-11 describes.
- **Fix:** one `resolveColumns(row, names)` walks the keys once and resolves the
  whole set; the canary now asserts exactly one listing per file for all three
  builders.
- **Files modified:** `src/lib/worker/finance.ts`, `tests/unit/finance.test.ts`
- **Verification:** `premium:1`, `currency:1`, `spend:1` in the canary
- **Committed in:** `301414d`

### Planned deviations, made deliberately

**4. The listed unrecognised strings are compared as a SET against the fixture.**
`PREMIUM_HAND_EXPECTED.unrecognised` and the oracle both list in FIRST-SEEN file
order; this plan specifies count-descending then code units, which for the hand
fixture's two one-off strings yields the opposite order. The fixture module is
outside this plan's `files_modified`, so it was not edited: the test asserts the
set, the count and `unrecognisedMore === 0` against the fixture, and a
dedicated test pins the count-then-code-unit order with three strings of
different counts. 05-01's SUMMARY already anticipated this ("a later plan that
sorts them differently must update this answer key") — that update is still
outstanding and belongs to whoever owns the fixture.

**5. The RED commits carry a stub module, so the RED is assertion failures.**
`src/lib/worker/finance.ts` and `src/lib/decimal.ts` were created with their
final export names and no behaviour, so the RED recorded in the table above is
`expected 'no-usable' to be 'ready'` rather than a module-resolution crash —
the same reasoning 05-01 recorded for writing its oracle before its fixtures.
The GREEN commit for each task replaces the stub with the behaviour, so no stub
survives into `main`.

**6. `DAYS_RE` refuses a count of zero, and `OP_SEC_RE` does not.**
`0 days` is a premium grant of no time and is refused (the oracle refuses it
too, so the two agree); `deposit WOT premium_plus 0 sec` is a machine-written
counter and is read as written (the oracle reads it as written too). The
asymmetry is commented at both patterns.

**7. The two-decimal display strings are re-derived in the test.**
`ORDERS_HAND_EXPECTED` carries `displayTotal: '1000.00'` for RUB, written by
hand without a thousands separator, while UI-SPEC section 9 and D-25 require
grouped money. The comparison strips grouping from the app's string rather than
editing the fixture, and the oracle side derives its own display strings with
`halfAwayFromThousandths` — integer arithmetic in the test, sharing no code with
the module that reads the money.

---

**Total deviations:** 3 auto-fixed (all Rule 1 — each a real disagreement between
the plan's prose and the answer keys its own acceptance criteria demand), 4
planned.
**Impact on plan:** all three auto-fixes were necessary for the plan's own
acceptance criteria to hold; none widened scope. Two of them (income direction,
game-label ordering) are contradictions inside the plan and the UI-SPEC, and are
flagged for the plans that own that copy.

## Issues Encountered

- **`inOps + outOps` is not `ops` for a currency with an income.** Documented at
  the accumulator and asserted nowhere as an invariant, precisely because it is
  not one.
- **The 40-character and 40-digit boundaries are easy to write wrong by a factor
  of a million.** Both are now computed (`BigInt('9'.repeat(40)) * 1_000_000n`)
  rather than transcribed, after a literal cost two failed runs.
- **The pre-existing locale failure.** `tests/unit/ui-copy.test.ts:207` fails on
  this box because it is `uk_UA.UTF-8` and `formatImportSummary` groups with
  `toLocaleString()`. `LC_ALL=en_US.UTF-8 pnpm run test:unit` is green at 1001,
  and both that test and its module are untouched by this plan. RESEARCH
  Pitfall 7 names this exact test and hands the fix to 05-08, which owns the D-25
  formatter move. Logged in `deferred-items.md` and in `.planning/WINDOWS.md`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **05-07 (the worker round trip)** can call `buildPremium`, `buildCurrency` and
  `buildSpend` directly. `buildPremium` and `buildCurrency` take a `seen` flag
  (`false` is `not-in-export`, `true` with zero rows is `no-rows`); `buildSpend`
  does not, because UI-SPEC section 2 has no `not-in-export` state for the spend
  block, so an absent Orders file is `no-usable`.
- **05-08 / 05-09 (the cards and the copy)** own the display strings. Two
  sentences need amending where they live: UI-SPEC section 5's "deposit and
  income are up" (an income is in neither total) and the by-game ordering for a
  blank `GAME_CODE` (ranked as its drawn label, not last).
- **05-11 / 05-13 / 05-15** can rely on the sparse `months` arrays plus
  `firstMonth`/`lastMonth`: the axis is the caller's to fill, and the 240-month
  history is already built and asserted.
- **Nothing is wired to the worker or the page yet**, as planned. No component,
  message type or Dexie schema was touched.

## Verification

```
$ pnpm exec vitest run tests/unit/finance.test.ts tests/unit/decimal.test.ts
 Test Files  2 passed (2)
      Tests  35 passed (35)
exit 0

$ LC_ALL=en_US.UTF-8 pnpm run test:unit
 Test Files  32 passed (32)
      Tests  1001 passed (1001)
exit 0                      (baseline was 922 in 28 files; +79, no regression)

$ pnpm run check            # tsc -b
exit 0
$ pnpm run lint             # prettier --check . && eslint .
All matched files use Prettier code style!
exit 0
$ git diff --quiet -- package.json pnpm-lock.yaml
exit 0                      (T-05-SC: this plan installed no package)
```

Plan acceptance greps:

```
$ grep -c "^import" src/lib/finance-shared.ts                        -> 0
$ grep -c "new Date" src/lib/worker/finance.ts                        -> 0
$ grep -c "parseFloat\|toFixed" src/lib/decimal.ts                    -> 0
$ grep -c "parseFloat\|toFixed" src/lib/worker/finance.ts             -> 0
$ grep -c "parseFloat\|toFixed\|new Date" src/lib/worker/finance.ts  -> 0
$ git status --short -- src tests                                     -> empty
```

Not run: `pnpm exec playwright test`. This plan touches no component, no spec and
no message type; nothing on the page changed.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Plan: 04*
*Completed: 2026-10-01*

## Self-Check: PASSED

- All five `key-files.created` exist on disk (`[ -f ]` returns FOUND for each).
- All six task commits exist in `git log --oneline --all`: `ac4a568`, `874e515`,
  `124b405`, `0aa171a`, `a72d064`, `301414d`.
- Every task acceptance criterion re-run at close: the plan-level `<verification>`
  block exits 0, and each of the five grep acceptance criteria prints its expected
  count (0, 0, 0, 0, 0).
