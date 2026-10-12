---
phase: 05-vehicle-stats-financial-dashboards
reviewed: 2026-10-02T10:08:22Z
depth: standard
files_reviewed: 96
files_reviewed_list:
  - .github/workflows/ci.yml
  - .gitignore
  - graphify-out/GRAPH_REPORT.md
  - graphify-out/graph.html
  - graphify-out/graph.json
  - playwright.config.ts
  - src/app.css
  - src/lib/bar-chart-model.ts
  - src/lib/components/BattleTypeSummary.svelte
  - src/lib/components/ChartTooltip.svelte
  - src/lib/components/CurrencyBlock.svelte
  - src/lib/components/Dashboard.svelte
  - src/lib/components/DashboardNav.svelte
  - src/lib/components/ExcludedNotice.svelte
  - src/lib/components/FinancialData.svelte
  - src/lib/components/FlowLegend.svelte
  - src/lib/components/MonthlyBarChart.svelte
  - src/lib/components/MonthlyDataTable.svelte
  - src/lib/components/PlayerStats.svelte
  - src/lib/components/PremiumBlock.svelte
  - src/lib/components/SpendSummary.svelte
  - src/lib/components/VehicleTable.svelte
  - src/lib/dashboard-status.ts
  - src/lib/decimal.ts
  - src/lib/finance-shared.ts
  - src/lib/finance-state.ts
  - src/lib/playtime-model.ts
  - src/lib/query-client.ts
  - src/lib/scroll-spy.ts
  - src/lib/types/worker-messages.ts
  - src/lib/ui-copy.ts
  - src/lib/vehicle-model.ts
  - src/lib/vehicle-shared.ts
  - src/lib/vehicle-state.ts
  - src/lib/worker-client.svelte.ts
  - src/lib/worker/categories.ts
  - src/lib/worker/classify.ts
  - src/lib/worker/data-queries.ts
  - src/lib/worker/db.ts
  - src/lib/worker/finance.ts
  - src/lib/worker/ingest.worker.ts
  - src/lib/worker/vehicle-stats.ts
  - tests/e2e/dashboard.spec.ts
  - tests/e2e/finance-scale.spec.ts
  - tests/e2e/finance.spec.ts
  - tests/e2e/helpers.ts
  - tests/e2e/import-failure.spec.ts
  - tests/e2e/import-flow.spec.ts
  - tests/e2e/persistent-dataset.spec.ts
  - tests/e2e/pin-locale.ts
  - tests/e2e/playtime-charts.spec.ts
  - tests/e2e/playtime-real-shape.spec.ts
  - tests/e2e/playtime-scale.spec.ts
  - tests/e2e/playtime.spec.ts
  - tests/e2e/scroll-nav.spec.ts
  - tests/e2e/spend.spec.ts
  - tests/e2e/uat-criteria.spec.ts
  - tests/e2e/vehicle-stats.spec.ts
  - tests/e2e/zero-network.spec.ts
  - tests/fixtures/README.md
  - tests/fixtures/export-fixtures.ts
  - tests/fixtures/finance-fixtures.ts
  - tests/fixtures/player-stats-fixtures.ts
  - tests/fixtures/sample-account.ts
  - tests/fixtures/sessions-fixtures.ts
  - tests/helpers/finance-oracle.ts
  - tests/helpers/vehicle-oracle.ts
  - tests/helpers/worker-harness.ts
  - tests/unit/bar-chart-components.test.ts
  - tests/unit/bar-chart-model.test.ts
  - tests/unit/ci-budget.test.ts
  - tests/unit/contrast.test.ts
  - tests/unit/currency-blocks.test.ts
  - tests/unit/dashboard-status.test.ts
  - tests/unit/data-query-worker.test.ts
  - tests/unit/db-rows-by-file.test.ts
  - tests/unit/decimal.test.ts
  - tests/unit/finance-blocks.test.ts
  - tests/unit/finance-fixtures.test.ts
  - tests/unit/finance-state.test.ts
  - tests/unit/finance.test.ts
  - tests/unit/ingest-worker.test.ts
  - tests/unit/player-stats-fixtures.test.ts
  - tests/unit/playtime-charts.test.ts
  - tests/unit/query-client.test.ts
  - tests/unit/replay-reclassify.test.ts
  - tests/unit/sample-export-shape.test.ts
  - tests/unit/scroll-spy.test.ts
  - tests/unit/setup.ts
  - tests/unit/spend-blocks.test.ts
  - tests/unit/ui-copy.test.ts
  - tests/unit/vehicle-blocks.test.ts
  - tests/unit/vehicle-model.test.ts
  - tests/unit/vehicle-state.test.ts
  - tests/unit/vehicle-stats.test.ts
  - tests/unit/zip-paths.test.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---
# Phase 05: Code Review Report

**Reviewed:** 2026-10-02T10:08:22Z
**Depth:** standard
**Files Reviewed:** 96
**Status:** issues_found

## Summary

Adversarial review of Phase 05 ("Vehicle Stats & Financial Dashboards") across a
96-file scope resolved from the 16 `SUMMARY.md` frontmatter blocks plus a
SUMMARY-diff cross-check (`10ec670e^..HEAD`), covering the `Financial_data` and
`Player_statistics` cards, the currency/decimal aggregation layer, the Web Worker
query path, and the zero-network + CSP build posture.

**No Critical/Blocker findings.** Three Warnings are reported; all are
correctness-of-documentation or latent-logic defects, none of which corrupt
data, crash a supported flow, or weaken the security posture.

What held up under adversarial tracing:

- **Money arithmetic is exact end to end.** Every amount is a `bigint` of
  micro-units from the CSV text through the worker sum, the `structuredClone`
  message boundary (serialised as `bigint.toString()`), and the display
  formatter. `unitsToNumber` (`src/lib/decimal.ts:161`) is the single
  `bigint`-to-`number` conversion and is reached only for a bar *height*. No
  component formats money from a float; `formatMoney`/`formatFlowAmount`
  (`src/lib/ui-copy.ts:1374`, `:1387`) both take `bigint`.
- **The display-edge trust boundary is real and consistent in intent.** The
  codebase has a purpose-built validator (`parseUnitsString`,
  `src/lib/decimal.ts:135`) that rejects a corrupted stored value rather than
  coercing it to zero, and the worker re-checks month ranges and currency codes
  in `src/lib/worker/finance.ts`.
- **`acceptDataOutcome` (`src/lib/finance-state.ts:163`) is a well-ordered trust
  boundary** - superseded, dataset-match, error, stamp-match, result-null,
  channel-match - with the worker's `detail` deliberately dropped so a worker
  string can never reach the DOM.
- **`windowRange` (`src/lib/vehicle-model.ts`) is correct at the boundaries.**
  Traced the `first > last` over-scroll case: the fourth clamp
  (`pulledFirst = min(first, max(0, last - rowsInView))`) restores
  `first <= last` and keeps `padTopPx + drawn + padBottomPx == rows` exact.
- **The zero-network + CSP posture is genuinely strict and specifically
  tested.** `vite.config.ts` injects
  `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none';
  img-src 'self' data:; object-src 'base-uri' 'none'; form-action 'none'` at
  build time, and `tests/e2e/zero-network.spec.ts` asserts the served meta tag,
  zero network requests, a single worker, and zero CSP violations across the
  whole Phase 5 flow. No `eval`, `new Function`, `innerHTML`, `fetch`,
  `XMLHttpRequest`, `WebSocket`, or `as any` anywhere in `src/`.

Independent gate results (re-run, not taken on trust):

| Gate | Result |
| --- | --- |
| `pnpm run check` (`tsc -b`) | pass |
| `pnpm run lint` (prettier + eslint) | pass |
| `pnpm run test:unit` | 45/45 files, 1332/1332 tests pass (see Verification Notes) |

## Warnings

### WR-01: Bar-chart node budget is not a valid upper bound for currency charts; the comment asserts the opposite

**File:** `src/lib/bar-chart-model.ts:186-189`
**Issue:** The comment claims the self-asserted DOM-node guardrail always holds:

> `nodeCount` is the number of SVG elements this chart's layout implies...
> The month span is bounded at 1,572 by the date window, so even the widest
> possible export is inside this bound; the test asserts it at 1, 56, 144 and
> 240 months with both bar directions in every month, **which is the worst
> case**.

`nodeBudget = 3 * months + 40` (`src/lib/bar-chart-model.ts:206`) omits the
`2 * labels` term, and `labels` grows with `months` even though the bar count is
already capped at `2 * months`. So `nodeCount` exceeds `nodeBudget` for
`kind: 'currency'` once the span passes ~386 months. Reproduced by re-running
the two pure functions verbatim:

| months (currency) | `nodeCount` | `nodeBudget` | result |
| --- | --- | --- | --- |
| 240 | 747 | 760 | ok |
| 385 | 1194 | 1195 | ok |
| 400 | 1241 | 1240 | **over by 1** |
| 600 | 1857 | 1840 | **over by 17** |
| 1572 (max legal) | 4853 | 4756 | **over by 97** |

The `premium` kind never exceeds the budget (one bar direction per month). So
the documented bound holds exactly where it was tested and fails just past it,
and the specific claim "which is the worst case" is false.

**Impact:** No runtime consequence. `nodeBudget` is consumed only by the
self-assertion in `tests/unit/bar-chart-model.test.ts:262` and a literal in
`tests/e2e/finance-scale.spec.ts`; no component gates rendering on it, and the
chart still lays out and scales correctly at these spans. The defect is a false
guarantee: `05-09-PLAN.md:135` scoped the assertion to 1/56/144/240 months (so
the *test* is correct against its plan), but the *code comment* tells a future
maintainer the invariant is total when it is not. Reaching the failure needs a
currency with both deposits and withdrawals in every month across a ~32-year
span; the month-range guard in `src/lib/worker/finance.ts` permits 1970-2100,
so the input is not excluded by validation.

**Fix:** Account for the label term in the budget, or restate the real bound.
Cleanest is to thread the label count into the budget:

```ts
// The per-label nodes are NOT covered by the `3 * months` term, so the
// budget has to carry them: at a 1,572-month span a currency chart with
// both directions in every month draws 66 labels - 132 of its 4,853 nodes.
const nodeBudget = (months: number, labels: number): number =>
  3 * Math.max(0, Math.floor(months)) + 2 * Math.max(0, labels) + 40;
```

Alternatively restate the comment to the span actually guaranteed ("holds for
every span up to 385 months; a currency chart across the full 1970-2100 date
window draws up to 97 nodes more than this bound, still ~4.9k nodes"). Either
way, do not leave the "worst case" claim in place.

### WR-02: `CurrencyBlock.svelte` converts transported unit strings with bare `BigInt()`, and the guard comments claim a safety property it does not have

**File:** `src/lib/components/CurrencyBlock.svelte:204`, `:221`, `:222`, `:245`, `:246`
**Issue:** `CurrencyBlock` reads the micro-unit strings straight off the view
and coerces them with the global `BigInt` constructor:

```ts
inUnits: BigInt(entry.inUnits || '0'),                  // :204
outUnits: BigInt(entry.outUnits || '0'),                // :205
formatFlowAmount(BigInt(found?.inUnits ?? '0')),        // :221
inUnits: BigInt(found?.inUnits ?? '0'),                 // :245
```

The sibling component does the opposite on purpose. `SpendSummary.svelte:122`
and `:145` use `parseUnitsString`, and documents why at `:114-119`:

> `parseUnitsString` rather than `BigInt` directly: the value crossed the
> message boundary as TEXT, and a stored value that is not a plain integer in
> range is a corrupted dataset, which is not something to render as zero.

`CurrencyBlock.svelte:242-244` makes the same kind of claim - "the `?? '0'` is
here so a hand-built entry cannot make a render throw" - but a nullish
coalesce is not a validation. The two functions disagree in **both** directions
(verified against `parseUnitsString` at `src/lib/decimal.ts:135`):

| transported string | `BigInt()` | `parseUnitsString()` |
| --- | --- | --- |
| `"12.5"` | **throws `SyntaxError`** | `null` |
| `"abc"` | **throws `SyntaxError`** | `null` |
| `"1e3"` | **throws `SyntaxError`** | `null` |
| `"0x10"` | `16` (silently wrong) | `null` |
| `" 12 "` | `12` (silently coerced) | `null` |
| `"+12"` | `12` | `null` |
| 45-digit string | accepted | `null` (length cap) |

Both conversions run inside `$derived.by(...)` (`:179-228`) and in
`monthFigure` (`:238`), which the template calls during render, so a throw would
surface as a render error rather than a handled failure.

**Impact:** **Not reachable through the app's own data path**, and I want to be
explicit about that rather than inflate the severity: every transported
`inUnits`/`outUnits` is produced by `bigint.toString()` in the worker
(`src/lib/worker/finance.ts:600`, `:610`, `:623`), so the string is always a
canonical integer, and the views are recomputed from the persisted rows rather
than read back as a frozen serialised blob. The residual defects are therefore
(a) a comment asserting a render-safety property the code does not have, and
(b) two components in the same feature applying the codebase's own documented
trust boundary inconsistently - which is how the inconsistency became invisible.
This is a defence-in-depth and documentation gap, not a live bug.

**Fix:** Route both components through the existing validator so the stated rule
is the enforced rule:

```ts
// CurrencyBlock.svelte - matches SpendSummary.svelte:122
function unitsOf(text: string | undefined): bigint {
  return parseUnitsString(text) ?? 0n;
}
// then: inUnits: unitsOf(entry.inUnits), etc.
```

and amend the `:242-244` comment to say the `?? '0'` handles a *missing* value
only, not a malformed one.

### WR-03: `navScrollLeftFor` does not implement its own "left edge wins for an over-wide link" rule

**File:** `src/lib/scroll-spy.ts:167-195`
**Issue:** The doc block at `:164-166` states:

> A link too wide for the nav cannot be shown whole; **its LEFT edge wins**,
> because the start of a name is the useful half of it.

The left-edge branch at `:190` is gated on `linkLeft < inset`, i.e. on the link
starting *before* the inset - not on the link being over-wide. An over-wide link
whose left edge already sits past the inset takes the right-edge branch at `:194`
instead, which scrolls the *right* edge to the limit and pushes the link's start
off-screen, inverting the documented rule. Reproduced against the function
verbatim:

```ts
navScrollLeftFor({ scrollLeft: 0, clientWidth: 100, linkLeft: 20, linkRight: 500, inset: 12 })
// -> 412;  the browser clamps to maxScroll 500 - 100 = 400
// -> linkLeft on screen = 20 - 400 = -380   (left edge OFF-SCREEN)
```

The link is 480 units wide against 76 units of usable width, yet the left edge
loses - the exact case the comment says it wins. The branch is ordered "past the
left inset first" (`:189`), so the over-wide condition is never tested at all.

**Impact:** Latent, not reachable today. The nav carries six short labels and
none is wider than the nav box, so the left-inset branch is the only one that
fires. It would become a visible defect if a label grows (e.g. localising
"Financial data" / "Player statistics" into a wider locale) or on a very narrow
viewport where `clientWidth` shrinks below a single label.

**Fix:** Test the over-wide condition first, before either edge:

```ts
// Over-wide links cannot be shown whole, so the START wins regardless of
// where the left edge currently sits. Checked FIRST: an over-wide link whose
// left edge is already past the inset must still show its start.
if (geometry.linkRight - geometry.linkLeft > rightLimit - inset) {
  return Math.max(0, geometry.linkLeft - inset);
}
```

## Verification Notes

Two boundaries worth recording, neither of which changes a finding above.

**1. One out-of-scope unit test cannot be run in this environment.**
`tests/unit/webserver-teardown.test.ts` is reproducibly SIGKILLed here - exit
137, within ~308ms during module import, on both the default `forks` pool and
`--pool=threads`. It is a **Phase 01** file (last touched by `9689001`), absent
from this phase's 96-file scope and unmodified by this phase, so it is not a
Phase 05 finding and is not counted in `findings` above. Excluding it, the unit
suite is green: **45/45 files, 1332/1332 tests**. Noted under the contract's
test-reliability clause because the test is inherently environment-coupled: it
spawns the real `playwright.config.ts` `webServer.command` with
`detached: true` and then does a process-group SIGKILL plus an `lsof`-based kill
of whatever holds fixed port 4173 (`:102-106`, `:68-84`). I could not determine
whether the SIGKILL here is a sandbox resource limit or a genuine port or
process-group collision, so **the teardown behaviour this test exists to guard
remains unverified in this review** - it is the one required check I could not
complete.

**2. A defect in the GSD review workflow itself (tooling, not phase code).**
The depth-resolution step in `.claude/gsd-core/workflows/code-review.md` reads:

```bash
DEPTH_OVERRIDES=$(gsd_run query config-get workflow.code_review_depth_overrides --default '[]' 2>/dev/null || echo '[]')
```

`config-get` without `--raw` emits the JSON-quoted string `"[]"`, which is then
handed to `JSON.parse` and passed to `resolveCodeReviewDepth` as a *string*. The
resolver's `validateOverrides` rejects that with
`{"ok":false,"errors":[{"reason":"not_an_array"}]}`, and the workflow's own guard
treats any `DEPTH_OK` other than the literal `true` as a hard exit that produces
**no REVIEW.md at all**. Confirmed: with `--raw` the same payload resolves
cleanly to `{"ok":true,"depth":"standard","source":"config","fileCount":96}`. This
fires on any project that has not set depth overrides, so it is a latent harness
break rather than a phase-05 code problem. I did not modify the workflow
(review-only); the review proceeded at depth `standard`, which is the value both
`workflow.code_review_depth` and the resolver independently agree on.

**Not verified:** the 184-test Playwright e2e suite was not re-run in this
environment. It is gated behind the same `webServer` spawn that the SIGKILL above
implicates. The e2e specs in scope were reviewed as source (the CSP and
zero-network assertions in `tests/e2e/zero-network.spec.ts` were read and
verified to assert what they claim), but not executed here.

---

_Reviewed: 2026-10-02T10:08:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
