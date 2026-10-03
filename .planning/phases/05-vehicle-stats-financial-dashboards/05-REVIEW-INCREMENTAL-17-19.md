---
phase: 05-vehicle-stats-financial-dashboards
reviewed: 2026-10-02T12:26:14Z
depth: standard
scope: incremental (plans 05-17, 05-18, 05-19; diff 12e4539..HEAD)
supersedes: null
prior_review: 05-REVIEW.md
prior_review_commit: 12e453959daaf9cb94a7b6e05a1c33d737bcd9d8
files_reviewed: 13
files_reviewed_list:
  - src/lib/components/IdentityHeader.svelte
  - src/lib/finance-state.ts
  - src/lib/ui-copy.ts
  - src/lib/worker/finance.ts
  - tests/e2e/finance-scale.spec.ts
  - tests/e2e/finance.spec.ts
  - tests/fixtures/README.md
  - tests/fixtures/finance-fixtures.ts
  - tests/helpers/finance-oracle.ts
  - tests/unit/finance-fixtures.test.ts
  - tests/unit/finance.test.ts
  - tests/unit/replay-reclassify.test.ts
  - tests/unit/ui-copy.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 05 (incremental, plans 05-17..05-19): Code Review Report

**Reviewed:** 2026-10-02T12:26:14Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found
**Diff base:** `12e4539` (the three UAT gap-closure plans only; plans 05-01..05-16
are covered by the prior review, preserved unmodified at `05-REVIEW.md`)

## Summary

The three UAT gap closures are, on the evidence I could gather, correct and
honestly tested. The claims that were put to me to distrust did not survive
being distrusted:

- **The direction invariant holds.** `buildCurrency` increments `bucket.ops`
  once and then writes exactly one of `inOps`/`outOps` on the single month
  bucket for that row, with no path between the two, so
  `Σ(inOps + outOps) == ops` is structural rather than incidental. I re-checked
  it independently of the suite over the 50,000-row `CURRENCY_50K_SPEC` (six
  charted currencies, 65 excluded) and it holds for every chart. The new
  `data-ops == oracle.operations` assertion in the scale spec is genuinely
  assertable now and is a real cross-check (the app's per-month counters against
  an implementation that shares no code with it), not a tautology.
- **The date column really is decided once per file.** `premiumDateColumn` is
  called once, before the row loop, and the loop then reads a single `dateKey`
  for every row. The exclusion path increments `excluded` at most once per row
  and `continue`s, so there is no off-by-one and no double counting between the
  "unreadable date" arm and the "unrecognised value" arm.
- **The oracle is independent.** `tests/helpers/finance-oracle.ts` has **zero
  import statements** — not "no import from `src/`", none at all. The
  cross-check is not vacuous.
- **No real data, no vacuous canaries.** Fixture amounts are invented
  (600 = 112+87+240+95+66, stated in a comment next to the arithmetic), dates
  and the bulk stamp are invented, every `ORDER`/`ORDER_UUID` is the all-zero
  UUID, and the canary assertions are behavioural (parse the rendered CSV, match
  the pattern, sum the cells) rather than restatements of a constant the test
  also set.
- **No network capability was added.** The changed `src/` files are pure
  functions and a comment; nothing in the diff can initiate a request.

Two warnings remain, both in the oracle's fidelity rather than in the
application code — which is where I would least expect a gap, since the oracle
exists precisely to be the thing that does not share the implementation's
blind spots.

---

## Warnings

### WR-01: `oracleCurrency` cannot model the `CHART_MAX` overflow, so it provably disagrees with the builder past eight charted currencies

**File:** `tests/helpers/finance-oracle.ts:511-515`
**Severity:** WARNING

```ts
charted: ordered
  .filter((group) => group.operations >= CHART_MIN_OPERATIONS)
  .slice(0, CHART_MAX),
others: ordered.filter((group) => group.operations < CHART_MIN_OPERATIONS),
```

`buildCurrency` (`src/lib/worker/finance.ts:639-673`) routes by *rank*, not by
threshold: the first `CHART_MAX` currencies that clear `CHART_MIN_OPS` get a
chart, and **everything else** — including a currency with 60,000 operations
that merely lost the race for the ninth slot — is pushed to `others`, because
D-16 says the cap hides a bar chart, never a currency.

The oracle routes by *threshold only*. I built a nine-currency file with 60
deposits-and-withdrawals each and ran both:

```
app charts 8   app others [ 'c8' ]
oracle charted 8   oracle others []
```

The ninth currency exists in the app's view and in **no oracle list at all**.
That is a hole in the project's independent cross-check, not a cosmetic
disagreement: the file's entire stated purpose is to be the side that cannot
agree with the implementation by construction, and it silently drops a currency
the product is contractually required to show. `CHART_MAX` is 8 and the current
`SCALE_CODES` is 6, so nothing exercises it today — which is exactly why it
would surface later as a confusing diff on a future fixture rather than as a
clear one.

**Fix** — express the split the way the builder does, by rank:

```ts
const charted = ordered.filter((group) => group.operations >= CHART_MIN_OPERATIONS).slice(0, CHART_MAX);
const chartedCodes = new Set(charted.map((group) => group.code));
return {
  usable,
  excluded,
  charted,
  // The cap hides a BAR, never a currency: a group that clears the threshold
  // and still loses the race for the eighth slot is LISTED (D-16).
  others: ordered.filter((group) => !chartedCodes.has(group.code)),
};
```

Note the comparator is total (operations, then code, blank last), so keying on
`code` is safe; keying on object identity would be equally fine.

### WR-02: the premium date-column choice is decided by a strict timestamp shape, and the oracle accepts shapes the app rejects

**File:** `src/lib/worker/finance.ts:329-345` (decision), `tests/helpers/finance-oracle.ts:99-114` (oracle reader)
**Severity:** WARNING

`premiumDateColumn` returns `CURR_PREMIUM` only if `monthOfTimestamp` — i.e.
`parseSessionTimestamp` — reads at least one cell. `ISO_TIMESTAMP_RE`
(`src/lib/worker/playtime.ts:117`) **requires seconds**:
`/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/`. If no
`CURR_PREMIUM` cell matches, the whole file silently falls back to `CREATED` —
and on a real export that is the bulk-migration stamp, so the entire chart
collapses onto one meaningless month. **That is G-05-3, unchanged.**

The oracle's `readDate` is more permissive (`/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/`
— minutes optional, and `[ T]` on the dotted shape). The two independent sides
therefore disagree on precisely the input that decides the column. Demonstrated:

```
"2019-03-05 10:00"   app monthOfTimestamp = null    app months [24231]   oracle months [24230, 24231]
"2019-03-05"         app monthOfTimestamp = null    app months [24231]   oracle months [24231]        (app fell back to CREATED; oracle bucketed)
"15.07.2019T18:00"   app monthOfTimestamp = null    app months [24231]   oracle months [24231, 24234]
```

Every premium fixture in the repository is written in second-precision ISO, so
no test exercises a near-miss shape and the fallback is never forced to prove
itself. The plan's human check against the real zip reported 32 months, which is
good evidence the real column *is* second-precision — but the safety of the fix
rests entirely on a format the fixtures chose, and the shape sensitivity is
invisible to CI. A drifted export (a column that starts writing `10:00`, or
date-only) reintroduces the exact bug this plan closed with a green suite.

**Fix** — two parts, both cheap:

1. Add a unit case that pins the near-miss behaviour explicitly, so the
   sensitivity is a stated decision rather than an accident: a file whose
   `CURR_PREMIUM` cells are all `2019-03-05 10:00` must be dated by `CREATED`
   (one month at the bulk stamp) **and** the test comment must say that this is
   why the real-column format is worth a human check. If the intended behaviour
   is instead to accept minute precision, widen `ISO_TIMESTAMP_RE`'s seconds
   group to `(?::(\d{2}))?` in `playtime.ts` and re-run the playtime suite —
   that is a decision for D-01's owner, not for this review.
2. Narrow the oracle's `readDate` to the shapes the app actually accepts, so the
   cross-check fails loudly on an unknown shape instead of quietly accepting
   one the product would drop. (An oracle that is *more* permissive than the
   implementation makes the two agree for the wrong reason on exactly the
   interesting inputs.)

---

## Info

### IN-01: the direction-invariant test asserts a floor where the fixtures pin an exact count

**File:** `tests/unit/finance.test.ts` — `gives every usable operation exactly one direction, in every month`
**Severity:** INFO

```ts
// The generated spec is what makes this more than the two hand charts.
expect(charted).toBeGreaterThanOrEqual(7);
```

The fixtures pin this exactly: `CURRENCY_HAND_ROWS` charts `ru.wot.credits` and
`ru.shared_currency.gold` (2) and `CURRENCY_10K_SPEC` charts five of the six
`SCALE_CODES` (5), so `7` is a fact, not a guess — I confirmed it by running
the builder over the 50k spec (6 charts) and the hand rows. `toBe(7)` would make
a regression that silently stops charting a currency fail; the floor would let
it through. A `return` inside the `for` loop (the `if (view.status !== 'ready')`
narrowing guard) also exits the whole test rather than the iteration, so a
non-`ready` second view would skip this assertion — unreachable today, since
the `expect` above it throws first.

### IN-02: the 05-17 browser caption expectation is hard-coded rather than derived from the fixture key it names

**File:** `tests/e2e/finance.spec.ts` — `(income-only) an income-only currency reports its deposits, not zero`
**Severity:** INFO

```ts
const group = CURRENCY_INCOME_ONLY_EXPECTED.others[0]!;
const expectedCaption = formatOtherCurrencyRow({
  code: group.code,
  inUnits: 600_000_000n,   // <- hard-coded; the comment cites a `* 1000n` that is not in the code
  outUnits: 0n,
  ops: 5,
  firstMonth: 24_228,
  lastMonth: 24_231,
}, 'en-US');
```

The cross-check against the page is real (and the literal
`'Deposited 600 · Withdrawn 0 · 2019-01 to 2019-04 · 5 operations'` is a good
second opinion), but only `group.code` is read from the fixture. If
`CURRENCY_INCOME_ONLY_ROWS` ever changes, the hand key and this literal drift
apart silently and the failure will point at the wrong file. Deriving the
micro-units the way the rest of the suite does would fix both the drift and the
comment/code mismatch:

```ts
inUnits: BigInt(group.depositedThousandths) * 1000n,
ops: group.operations,
```

---

## What I verified and found sound

Recorded so the next reader does not have to re-derive it:

| Claim under test | Result |
|---|---|
| `inOps + outOps == ops`, per currency and per month, at 50k ops | Holds. Re-checked independently of the suite over `CURRENCY_50K_SPEC`. |
| `income` reaches `inUnits`, the month's `inUnits` and the month's `inOps` | Yes, `src/lib/worker/finance.ts:611-617`. The `else` arm is reachable only by `deposit` or `income` because the accepted-TYPE test above it refuses everything else. |
| Date column decided once per file, not per row | Yes. `premiumDateColumn` is called once at `finance.ts:374`; the loop reads the single `dateKey`. |
| No off-by-one / double counting on the exclusion path | No. Each arm is `excluded += 1; continue`, and the two arms are mutually exclusive per row. |
| Oracle independent of `src/` | Yes — zero import statements in the file. |
| `UPDATED` still never read | Yes; asserted with a live positive control on `CURR_PREMIUM` in the same test (`finance.test.ts:1176-1179`). |
| No `CURR_PREMIUM` text survives into a view | Yes; the test serialises the whole view and checks every grant date, which is stronger than the name-list rule it replaced. |
| Privacy canaries assert something | Yes — `ORDER` matches `/^0{8}-0{4}-0{4}-0{4}-0{12}$/` on the *parsed* CSV, not on a constant. |
| Any new network capability | None. The changed `src/` files are pure functions plus comments. |
| 05-19 label change is cosmetic only | Confirmed by diff: one string, one HTML comment, no markup/class/testid/logic change. No stale `Region (per export)` literal survives outside historical planning docs. |

Executed during this review: `pnpm run test:unit` (1350 passed / 46 files),
`pnpm run check` (exit 0), `pnpm run lint` (exit 0). The Playwright e2e specs
were read as source, not executed.

---

_Reviewed: 2026-10-02T12:26:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
