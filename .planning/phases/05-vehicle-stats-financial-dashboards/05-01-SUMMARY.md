---
phase: 05-vehicle-stats-financial-dashboards
plan: 01
subsystem: testing
tags: [csv, fixtures, oracle, papaparse, deterministic, seeded, thousandths, hand-derived]

requires:
  - phase: 04-activity-time-dashboards
    provides: >-
      the independent-oracle method from 04-03 (a helper that recomputes an
      answer from raw rows with logic of its own) and the hand-fixture layout
      from 04-11 (rows plus hand-derived answer object in one plain module), both
      extended here for finance data.
  - phase: 02-defensive-parsing-persistent-dataset
    provides: >-
      `parseCsvFile`, which these fixtures have to survive unchanged, and the
      `mulberry32` PRNG in `tests/fixtures/sessions-fixtures.ts` that the seeded
      generators draw from rather than copying.

provides:
  - >-
    tests/fixtures/finance-fixtures.ts: the three real 2021 header lists
    verbatim (Operations_with_Premium_Days 4 columns, Virtual_Currencies_
    Operations 6, Orders 12), `renderQuoteAllCsv` writing the export's physical
    shape (bare unquoted header, quote-all data cells, bare-CR terminator on
    every line), three hand fixtures with hand-derived answer keys, and four
    seeded scale generators.
  - >-
    Premium hand fixture: 18 rows, 11 grants, 7 excluded, 4,579,200 seconds
    (53 days) over four usable months inside a five-month axis with April drawn
    empty, months keyed as `year * 12 + month - 1`, and exactly two listed
    duration strings (the withdrawal and `premium forever`).
  - >-
    Currency hand fixture: 125 rows, 119 usable, 6 excluded, credits (60) and
    gold (52) charted, four others listed with `__proto__` before the blank code,
    including a blank title, a blank code, an `income` and six unusable rows.
  - >-
    Orders hand fixture: 16 rows over five spend cards, USD at 15,495
    thousandths (15.495 exactly, drawn 15.50) with 2 gifts worth 5,005
    thousandths, a leading-dot `.5`, a three-decimal `1.005`, a non-numeric
    PAID row, FAILED, NEW, an unrecognised status and a unit-less card last.
  - >-
    tests/helpers/finance-oracle.ts: `oraclePremium`, `oracleCurrency` and
    `oracleSpend` recomputing all of it from raw rows with ZERO import
    statements, integer thousandths, no BigInt, no Intl and no formatting.
  - >-
    Four seeded specs (10k, 50k, 240-month, stray-year) plus `CurrencyOpsSpec`
    and `generateCurrencyOpsCsv`, deterministic per seed, whose answer key is
    the oracle's output.
  - >-
    tests/unit/finance-fixtures.test.ts: 38 tests — the tracer round trip
    through the production parser, every hand number against the oracle, the
    by-year and by-game breakdowns summing back to their headline, the float
    `toFixed` trap made explicit, the T-05-01 fabricated-data assertions, and
    generator determinism.

affects: [phase-05, finance-dashboards, 05-04, 05-07, 05-16, test-suite-growth]

actuals:
  tokens: 18600
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - >-
      A hand-fixture answer key lives beside the rows with the arithmetic in the
      comment, and is checked by an oracle that shares no primitive with the
      implementation, so a wrong hand number fails in Node instead of in a
      browser run hours later.
    - >-
      An oracle that computes and an oracle that also FORMATS are different
      things: the two-decimal half-away rounding is asserted in the test with
      integer arithmetic, never inside the oracle, so the rounding rule cannot
      be satisfied by the code that reads the money.
    - >-
      Bad-row counts are part of `spec.rows`, not added to it, and are drawn
      before any row is built so the bad kinds can never collide — that is what
      lets an excluded count be derived from the spec at all.

key-files:
  created:
    - tests/fixtures/finance-fixtures.ts
    - tests/helpers/finance-oracle.ts
    - tests/unit/finance-fixtures.test.ts
  modified: []

key-decisions:
  - >-
    The three header lists are the plan's verbatim strings, which agree with the
    real-sample evidence table in 05-RESEARCH.md and 05-01-PLAN.md line 195:
    premium has FOUR columns (PREMIUM first), currency ops puts CREATED first
    and ORDER last, and orders has TWELVE ending in AA_PACKAGE_LIST. A currency
    group is therefore keyed on PAYMENT_CURRENCY, not on a column called
    CURRENCY, and the status is PAY_ORDER_STATUS_CODE.
  - >-
    Months are the integer `year * 12 + month - 1` in every expected object,
    because the plan says so and it is the key the app buckets on — a month can
    then be read straight out of the export timestamp.
  - >-
    A blank CURRENCY_CODE sorts LAST but only as a tie-break on operation count,
    while the unit-less SPEND card is last UNCONDITIONALLY. They differ on
    purpose: a blank code still earns a chart by how much it moved, but a group
    that is explicitly not a currency must never sit among currency cards.
  - >-
    A negative AMOUNT is an excluded row, in the oracle and therefore in the
    answer key. An amount that reads as a negative deposit is an export
    integrity problem, not money flowing the wrong way.
  - >-
    Every order reference is the SAME literal all-zero UUID. T-05-01 asks the
    test to assert the all-zero pattern, and a per-row varying id cannot match
    that pattern; nothing in this phase groups or de-duplicates by order id, so
    uniqueness buys nothing and the assertion would be weakened for it.

patterns-established:
  - >-
    Fixture symbols are reached through a namespace import in the test file, so
    a symbol that does not exist yet fails ONE comparison instead of crashing the
    file at module resolution — which is what makes a RED run readable.
  - >-
    The oracle is written BEFORE the hand fixtures, inverting the plan's GREEN
    step order, because the test file imports it: a missing module would crash
    every test in the file and the plan requires a RED that fails on missing
    expectations instead of a crash.
  - >-
    A derived month key or total is asserted twice when it matters: once by the
    oracle and once by a plain arithmetic expression in the test, so a shared
    misreading of the export cannot hide in both.

requirements-completed: [FINANCE-01, FINANCE-02, FINANCE-03]

coverage:
  - id: D1
    description: >-
      Real-header Financial_data and Orders fixtures survive the production
      parser with the real column names, the bare-CR physical format and the
      export trailing space intact.
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: 'tests/unit/finance-fixtures.test.ts#05-01 tracer: real-header Financial_data and Orders fixtures through the production parser'
        status: pass
    human_judgment: false
  - id: D2
    description: >-
      Premium hand fixture: every FINANCE-01 figure (grants, excluded, month
      buckets, axis, tooltip sizes, listed strings) recomputed by the oracle.
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: 'tests/unit/finance-fixtures.test.ts#premium hand fixture'
        status: pass
    human_judgment: false
  - id: D3
    description: >-
      Currency hand fixture: charted and other-currency grouping, income
      handling, blank code, __proto__ code and six excluded rows, recomputed by
      the oracle.
    requirement: FINANCE-02
    verification:
      - kind: unit
        ref: 'tests/unit/finance-fixtures.test.ts#currency hand fixture'
        status: pass
    human_judgment: false
  - id: D4
    description: >-
      Orders hand fixture: five spend cards, exact thousandth totals, gifts,
      statuses, per-year and per-game breakdowns, and the float-rounding trap,
      recomputed by the oracle.
    requirement: FINANCE-03
    verification:
      - kind: unit
        ref: 'tests/unit/finance-fixtures.test.ts#orders hand fixture'
        status: pass
    human_judgment: false
  - id: D5
    description: >-
      Four seeded scale generators (10k, 50k, 240-month, stray-year) that are
      deterministic and whose excluded and charted counts the oracle confirms.
    requirement: FINANCE-01
    verification:
      - kind: unit
        ref: 'tests/unit/finance-fixtures.test.ts#seeded currency generators'
        status: pass
    human_judgment: false
  - id: D6
    description: >-
      Every order id is the all-zero UUID pattern and every coupon, aggregator
      and package cell is a literal CANARY string, asserted over the PARSED CSV
      rather than over the fixture source.
    requirement: FINANCE-03
    verification:
      - kind: unit
        ref: 'tests/unit/finance-fixtures.test.ts#fabricates every order id and canary cell (T-05-01)'
        status: pass
    human_judgment: false
  - id: D7
    description: >-
      Whether the real 2021 export really uses these four, six and twelve column
      headers and quote-all/bare-CR cells. This plan took the headers from the
      research evidence table; nobody re-opened a real sample to confirm them,
      because doing so is outside this plan.
    verification: []
    human_judgment: true
    rationale: >-
      Only a human with access to a real export can confirm the physical shape.
      The plan's contract for this phase is to encode the researched evidence
      faithfully, which the tracer tests do.

duration: 41min
completed: 2026-10-01
status: complete
---

# Phase 05-01: Finance fixtures, answer keys and the independent oracle

**Three real-header finance fixtures, three hand-derived answer keys, an oracle that shares no code with them, and four seeded scale generators — 38 tests, 922 in the suite**

## Performance

- **Duration:** 41 min
- **Started:** 2026-10-01T14:00:09
- **Completed:** 2026-10-01T14:41:58
- **Tasks:** 3
- **Files modified:** 3 (all created, 2,480 lines)

## Accomplishments

- **The answer key now exists and has already caught three wrong answers in it.**
  `PREMIUM_HAND_EXPECTED` reports 11 grants, 7 excluded and 4,579,200 seconds
  (53 days) across four usable months inside a five-month axis with April 2019
  drawn empty; `CURRENCY_HAND_EXPECTED` reports 119 usable and 6 excluded with
  credits (60) and gold (52) charted; `ORDERS_HAND_EXPECTED` reports the USD
  total as 15,495 thousandths. Every one of those numbers was checked against
  `tests/helpers/finance-oracle.ts`, and three of my hand derivations were wrong:
  a `moreSizes` that went negative when a month had fewer than three distinct
  sizes, UAH gift count (`true` IS a gift spelling, so UAH has one worth 250.50,
  not none), and a unit-less spend card that sorted by paid count instead of
  going last unconditionally. A fourth and fifth were caught by the generator:
  the 10k span keys were off by one in both directions, and the 50k line count
  forgot that a trailing CR leaves an empty final split.
- **The oracle has zero import statements.** Not "no import from `src/lib`" —
  no imports at all. It re-keys rows through `Record`, parses dates with two
  hand-written regexes and a hand-rolled leap-year table, buckets months as
  `year * 12 + month - 1`, reads durations by whitespace tokens rather than one
  anchored regex, and does money in integer thousandths with no `BigInt`, no
  `Intl` and no formatting whatsoever.
- **The float trap is a test, not folklore.** `(15.495).toFixed(2)` is `'15.49'`
  and `(5.005).toFixed(2)` is `'5.00'`; both are asserted in the test beside the
  half-away helper that yields `15.50` and `5.01`, so the reason FINANCE-03
  forbids float money sits next to the numbers it protects.
- **Four seeded generators, one PRNG.** `mulberry32` is imported from
  `sessions-fixtures.ts` rather than copied, bad-row counts are part of
  `spec.rows` rather than added to it, and the bad kinds are drawn before any
  row is built so they cannot collide. The 10k file yields 65 excluded rows and
  9,935 usable ones; the 240-month file covers every month of 2001–2020; the
  stray-year file excludes exactly its four out-of-window rows.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer — real-header Financial_data and Orders files through the production parser** — `3244e5f` (test)
2. **Task 2: Hand fixtures with hand-derived answers and an independent oracle** — `8d856f2` (test)
3. **Task 3: Seeded scale generators with the oracle as answer key** — `3a6d83f` (test)
4. **Plan metadata** — this SUMMARY

### RED and GREEN evidence, as recorded

| Task | RED | GREEN |
|------|-----|-------|
| 1 | `Tests 4 failed \| 5 passed (9)`, exit 1 — `AssertionError: expected [ 'CREATED', 'WITHOUT_TYPE', …(4) ] to deeply equal [ 'PREMIUM', 'CURR_PREMIUM', …(2) ]` on the header constants, and `expected '' to be 'deposit WOT premium_plus 86400 sec '` on the round trip | `Tests 9 passed (9)`, exit 0 |
| 2 | `Tests 19 failed \| 10 passed (29)`, exit 1 — all `TypeError: Cannot read properties of undefined (reading 'map')`, i.e. the expected objects do not exist yet; no module crash | `Tests 29 passed (29)`, exit 0 |
| 3 | `Tests 9 failed`, exit 1 — `TypeError: generateCurrencyOpsCsv is not a function` | `Tests 38 passed (38)`, exit 0 |

Between RED and GREEN, Tasks 2 and 3 each had one intermediate run with real
derivation failures (6 and 2 respectively); those are the five wrong numbers
listed under Accomplishments.

## Files Created/Modified

- `tests/fixtures/finance-fixtures.ts` — the three real header lists,
  `renderQuoteAllCsv`, the premium/currency/orders hand fixtures with their
  answer keys, `FINANCE_CANARIES`, and the four seeded specs with
  `generateCurrencyOpsCsv`.
- `tests/helpers/finance-oracle.ts` — `oraclePremium`, `oracleCurrency`,
  `oracleSpend`, and the exported answer shapes they return. Imports nothing.
- `tests/unit/finance-fixtures.test.ts` — 38 tests: the tracer, the three
  hand-fixture describes and the generator describe.

## Decisions Made

- **Headers come from the plan's verbatim strings, which agree with the
  research evidence table.** Premium is four columns with `PREMIUM` first,
  currency ops is six with `CREATED` first and `ORDER` last, orders is twelve.
  This is why a currency group is keyed on `PAYMENT_CURRENCY` and the status is
  `PAY_ORDER_STATUS_CODE` — see Deviations for why this mattered.
- **Formatting lives in the test, not the oracle.** `halfAwayTwo` is written in
  the test file with integer arithmetic. An oracle that also formatted its own
  numbers would be asserting its own formatter against itself.
- **Blank currency code and the unit-less card are sorted by two different
  rules**, because the plan's two expected orders require it and the reasons
  differ. Both rules are documented at the comparator.
- **`CURR_PREMIUM` and `UPDATED` carry fabricated values** rather than blanks in
  the premium rows. They are real columns no aggregation reads, and a blank
  would suggest the export never writes them, which is not the case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Task 1 headers] The three header lists were mis-transcribed and the Task 1 commit was replaced**
- **Found during:** Task 1, immediately after the first commit, when the
  authoritative plan text was re-read line by line
- **Issue:** the first attempt used a six-column premium header
  (`CREATED;WITHOUT_TYPE;WITHOUT_ID;SOURCE;PREMIUM;ADDITIONAL_DATA`), a
  five-column currency header and a thirteen-column orders header. None of those
  are the real export's headers, and every downstream plan indexes these files
  by name.
- **Fix:** the unpushed commit was soft-reset (it is `688f9c4`, reachable in the
  reflog and no longer in the branch) and Task 1 was rebuilt against the plan's
  verbatim strings. The corrected test was then run against the pre-correction
  module state — restored from `git show 688f9c4` — to produce the genuine
  assertion-failure RED quoted in the table above, rather than leaving the RED as
  the module-resolution crash it originally was.
- **Files modified:** `tests/fixtures/finance-fixtures.ts`, `tests/unit/finance-fixtures.test.ts`
- **Verification:** the whole corrected tracer, 9 tests, exit 0
- **Committed in:** `3244e5f`

**2. [Oracle independence] The oracle is written before the hand fixtures**
- **Found during:** Task 2
- **Issue:** the plan's GREEN order puts the oracle last, but the test file
  imports it, so a missing module crashes every test in the file. The plan's own
  acceptance criterion for Task 2 requires a RED "on missing hand expectations,
  not on a crash".
- **Fix:** the oracle was written first. It is a leaf with no dependency on the
  fixtures, so the dependency order is unaffected, and the RED could then be the
  19 assertion failures on the missing expected objects that the plan asks for.
- **Files modified:** none — order of work only
- **Verification:** RED output recorded above
- **Committed in:** `8d856f2`

### Planned deviations, made deliberately

**3. Every order reference is the SAME all-zero UUID.** The plan's Task 2 prose
says "a distinct fabricated all-zero ORDER_UUID", and T-05-01 asks the unit test
to assert that every `ORDER_UUID` and `ORDER` cell "matches the all-zero
pattern". Those cannot both hold: a per-row varying id does not match an all-zero
pattern. Since the pattern assertion is the checkable, threat-model-level
requirement and nothing in this phase groups or de-duplicates by order id, the
fixture uses the literal all-zero UUID on every row and says so in three places.

**4. `CurrencyOpsSpec` carries two extra fields beyond the plan's enumeration.**
`monthAssignment` ('uniform' | 'roundRobin') is required to satisfy the
20-year spec's round-robin guarantee, and `CurrencyCodeSpec` /
`MonthAssignment` are exported because the plan's `codes` field needs a type.
Nothing else was added to the export surface.

**5. The listed duration strings are in first-seen file order.**
`['withdrawal WOT premium_plus 86400 sec', 'premium forever']`. The plan names
both strings but not their order; first-seen is the only order derivable from
the rows themselves. A later plan that sorts them differently must update this
answer key.

**6. UAH has one gift worth 250.50.** The plan's Task 2 prose does not state
UAH's gift count, and D-22 makes `true` a gift spelling. The first hand
derivation said zero gifts and the oracle corrected it.

---

**Total deviations:** 2 auto-fixed (one wrong-data one wrong-order), 4 planned
**Impact on plan:** the Task 1 header correction was necessary for correctness —
the first commit described files that do not exist in a real export. Nothing
else widened scope; all four planned deviations are documented contracts that
later plans must honour or explicitly change.

## Issues Encountered

- **`moreSizes` went negative.** `sizes.length - 3` on a month with one distinct
  size produced `-2`, which would have drawn "+-2 more sizes". Clamped with
  `Math.max(0, …)`.
- **Every order row collapsed onto one card at first.** The currency had been
  read from a `CURRENCY` column that the real twelve-column header does not
  have, so all sixteen rows looked unit-less. Fixed by keying on
  `PAYMENT_CURRENCY`, which is what the real header and plan 05-04 both name.
- **A generated 50k file is a ~6 MB string.** It is counted by line rather than
  parsed, because 50,000 PapaParse rows would prove nothing that the 10k parse
  has not. The whole file currently costs about 340 ms.

## Not changed, but noticed

- `src/lib/worker/csv-parse.ts:79` — `fixed[k] = …` assigns through a plain
  object, so a header cell literally named `__proto__` would be silently dropped
  rather than read. Our fixture uses `__proto__` as a `CURRENCY_CODE` VALUE,
  which survives (asserted by the round-trip test), so nothing here is affected;
  but a real export with `__proto__` as a column name would lose that column.
  Out of scope for this plan (`src/` is untouched) and worth raising with 05-04
  or 05-07.
- `tests/fixtures/sessions-fixtures.ts` — `mulberry32` is exported and is now
  imported by a second fixture module, so it is a shared fixture primitive
  rather than a sessions detail.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **05-04 (the builders)** can import `PREMIUM_HAND_EXPECTED`,
  `CURRENCY_HAND_EXPECTED`, `ORDERS_HAND_EXPECTED` and the three header lists as
  they are, but two of its ordering rules are now pinned by the answer key and
  must be implemented as written: a blank currency code sorts last **only** as a
  tie-break on operation count, while the unit-less spend card is last
  **unconditionally**. A negative `AMOUNT` must be an excluded row.
- **05-07 (the worker round trip)** can feed the `*_HAND_CSV` texts through
  ingest; the currency round trip is known to preserve the `__proto__` code
  value, and the `__proto__`-as-column-name caveat above is the one open risk.
- **05-16 (scale specs)** can generate with the four specs; determinism is per
  spec version, so a later edit to any spec changes every generated byte and
  every answer key derived from it.
- **05-08 / 05-09** own the display strings; this plan deliberately formats
  nothing, and asserts the half-away rounding only as a test-side helper.

## Verification

```
$ pnpm exec vitest run tests/unit/finance-fixtures.test.ts
 Test Files  1 passed (1)
      Tests  38 passed (38)
exit 0

$ pnpm run test:unit
 Test Files  28 passed (28)
      Tests  922 passed (922)
exit 0                      (baseline was 884 in 27 files; +38, no regression)

$ pnpm run check            # tsc -b
exit 0

$ pnpm run lint             # prettier --check . && eslint .
All matched files use Prettier code style!
exit 0

$ pnpm run build
✓ built in 172ms
exit 0
```

Plan acceptance greps:

```
$ grep -c "from '../../src" tests/helpers/finance-oracle.ts   -> 0
$ grep -cE "^(import|const .* = require)" tests/helpers/finance-oracle.ts -> 0
$ grep -c "BigInt(" tests/helpers/finance-oracle.ts            -> 0
$ grep -c "export-fixtures" tests/fixtures/finance-fixtures.ts -> 0
$ git diff --stat 23ea38d..HEAD -- src                         -> empty
$ git diff --name-only 23ea38d..HEAD
tests/fixtures/finance-fixtures.ts
tests/helpers/finance-oracle.ts
tests/unit/finance-fixtures.test.ts
```

Two `src/` hits and one `BigInt` hit do exist in `finance-oracle.ts`, all three
inside the header comment that documents the independence rule. The file has no
import statement of any kind, which is the stronger form of the check.

Not run: `pnpm exec playwright test`. This plan touches no component and no spec,
and no e2e file imports these fixtures yet.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Plan: 01*
*Completed: 2026-10-01*
