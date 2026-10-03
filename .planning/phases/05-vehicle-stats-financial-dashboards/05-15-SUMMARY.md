---
phase: 05-vehicle-stats-financial-dashboards
plan: 15
subsystem: ui
tags: [svelte-5, runes, playwright, vitest, money, bigint, decimal, disclosure, accessibility, privacy]

# Dependency graph
requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: "05-04's buildSpendView (per-currency cards, paid/failed/new/other, gifts, byYear, byGame, excluded; no cross-currency field), 05-07's channel-scoped QueryClient and the `spend` channel, 05-08's full copy inventory, 05-10's deriveFinanceState/acceptDataOutcome and the generalised ExcludedNotice, 05-12's PlayerStats and the four-id status set"
provides:
  - "SpendSummary.svelte — the Real-money spend block: one card per currency, exact Display headline, paid count, separate status counts, gift line, collapsed per-year and per-game tables, unit-less caption and the excluded pill"
  - "BUILT_DASHBOARDS now holds four ids; user-info is the only pending section the phase ends with"
  - "10 new browser specs and a 6-test source-contract file, plus the Phase 3 status assertions migrated with the flip"
  - "The roadmap's no-blended criterion, proved on structure AND on text against a five-group fixture"
affects: [05-16, finance, ui-copy, ci-budget, dashboard-status]

actuals:
  tokens: 21579
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A no-blended guarantee is proved TWICE — on structure (one total hook per card, none outside a card) and on text (the cross-currency sum absent under BOTH roundings, and every PAIRWISE sum absent) — never by a regex on the word total"
    - "A money figure that crosses the message boundary as TEXT is validated as text and rebuilt with parseUnitsString, never parsed with Number or BigInt directly"
    - "A row that is only sometimes present (Other status, the gift line) is a property of the DATA, not a markup branch, so its test ids come from one literal table"

key-files:
  created:
    - "src/lib/components/SpendSummary.svelte"
    - "tests/unit/spend-blocks.test.ts"
    - "tests/e2e/spend.spec.ts"
  modified:
    - "src/lib/components/Dashboard.svelte"
    - "src/lib/dashboard-status.ts"
    - "tests/unit/dashboard-status.test.ts"
    - "tests/e2e/dashboard.spec.ts"
    - "playwright.config.ts"
    - ".github/workflows/ci.yml"

key-decisions:
  - "INFERRED (the executor's own reasoning is not recoverable from the commits): the three status hooks are named by a single `statusFigures(card)` literal table and `data-testid` is bound to its `hook` field, rather than by three `{#if}` blocks. `tests/unit/spend-blocks.test.ts` asserts BOTH halves — that the three names are literals in the file AND that the attribute is bound to the table — because `Other status` exists only above zero and three branches would be three copies of the same markup to keep in step. Inferred from the commit message's own words ('one literal table rather than three copies of the same markup') and from the source contract that pins the binding."
  - "INFERRED: the `spend-breakdown` disclosure is CLOSED by default and is NOT the currency block's `bind:open` pattern. The plan's own comments say why — five cards would need five independent flags — and the e2e asserts CLOSURE as a visibility claim (`not.toHaveAttribute('open')` plus `toBeHidden()`) rather than a count of zero, because a native closed `<details>` keeps its children in the DOM. The spec comment records that two of this plan's own first-pass failures were the spec asserting the wrong thing on exactly this point."
  - "INFERRED: the excluded pill reuses the shared `ExcludedNotice` with `count`/`pill`/`explanation`/`testId` rather than a spend-local notice, which is what makes a zero pill unrepresentable from outside (the `{#if}` tests the RESOLVED pill, per 05-10's rule). `tests/unit/spend-blocks.test.ts` asserts the prop `testId=\"spend-excluded\"` and `ExcludedNotice` rather than an attribute literal, because the hook arrives as a prop."
  - "INFERRED: the unit-less group's breakdown totals carry no currency code, one level down from its bare headline. Asserted at `spend.spec.ts` for the unit-less card's year row, because a `By year` total that acquired a code would be the same invention the headline avoids."

patterns-established:
  - "A closed disclosure is asserted by VISIBILITY, not by absence. A native `<details>` hides its children rather than unmounting them, so `toHaveCount(0)` would pin a rendering strategy the component deliberately does not use."
  - "A RegExp cannot go through `expect(...).toContain` — it throws a type error that reads like a privacy failure. The privacy spec names the four STRING canaries and asserts `orderIdPattern` (a RegExp) is never passed to `toContain`."
  - "A negative proof needs a positive anchor or it passes for the wrong reason. The no-blended test asserts the five headlines ARE on the page before asserting the sums are NOT, and the long-text test asserts the 80-character code reached the page whole before measuring widths, because a truncated render and a wrapping render look identical from the outside."

requirements-completed: [FINANCE-03]

coverage:
  - id: D1
    description: "The Payment_history card reads ready, asks the spend channel through the channel-scoped client keyed on importedAt, and shows the Real-money spend block's loading, ready, no-usable and error states with a stale answer dropped and no worker detail rendered. User_Info is the only pending section."
    requirement: FINANCE-03
    verification:
      - kind: unit
        ref: "tests/unit/dashboard-status.test.ts — with the default built set the four shipped sections are ready and only user-info is pending; BUILT_DASHBOARDS holds exactly the four shipped section ids"
        status: pass
      - kind: unit
        ref: "tests/unit/spend-blocks.test.ts — client.query({ channel: 'spend' }), deriveFinanceState({ importedAt, shown }), acceptDataOutcome(outcome, 'spend', wanted, importedAt), role=alert, role=status, no aria-live"
        status: pass
      - kind: e2e
        ref: "tests/e2e/spend.spec.ts — (states) unrecognised statuses give the no-usable message; tests/e2e/dashboard.spec.ts — (sections-pending) four sections ready and only User_Info pending"
        status: pass
    human_judgment: false
  - id: D2
    description: "One card per currency, ordered by paid count descending with the unit-less group last, each with an h4 of the code as written, an exact two-decimal Display headline and a paid-order count; exactly one spend-total per card and none outside one."
    requirement: FINANCE-03
    verification:
      - kind: e2e
        ref: "tests/e2e/spend.spec.ts — (tracer) five cards with exact headlines and paid counts: USD 15.50, UAH 350.50, RUB 1,000.00, usd 3.00 and 13.34, four/five spend-total elements"
        status: pass
    human_judgment: false
  - id: D3
    description: "The roadmap's no-blended criterion, proved on a five-currency fixture: one spend-total per card, none outside a card, an intro with no digit, the five-currency sum absent under both roundings with and without a code, and every pairwise sum absent. Never by a regex on the word total."
    requirement: FINANCE-03
    verification:
      - kind: e2e
        ref: "tests/e2e/spend.spec.ts — (no-blended) nothing anywhere on the page is a figure across currencies"
        status: pass
      - kind: unit
        ref: "tests/unit/spend-blocks.test.ts — exactly one data-testid=\"spend-total\" in the file, inside the card loop, with no .reduce( and no 'grand'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each card carries its own separate Failed, New and (only above zero) Other status counts in a definition list, a gift line only when gifts are above zero, and the excluded-order pill inside its own card — none of them added into the headline."
    requirement: FINANCE-03
    verification:
      - kind: e2e
        ref: "tests/e2e/spend.spec.ts — (figures) failed, new and other counts, the gift lines and the excluded pill per card; exactly one spend-excluded on the page"
        status: pass
    human_judgment: false
  - id: D5
    description: "A closed native disclosure per card holding two native tables with visible captions and scope=col headers, whose rows are views of the same paid rows and whose micro-unit sums add up to the headline."
    requirement: FINANCE-03
    verification:
      - kind: e2e
        ref: "tests/e2e/spend.spec.ts — (breakdown) closed by default, the two tables open with the fixture-derived rows, including the unit-less card's codeless year total"
        status: pass
      - kind: unit
        ref: "tests/unit/finance.test.ts — sums the by-year and by-game breakdowns back to the headline (05-04, inherited and re-verified here)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A blank or non-three-letter currency group is one Unknown currency card whose headline is the bare amount with no code and whose caption warns the amount has no unit; usd and USD stay two cards, each shown as written."
    requirement: FINANCE-03
    verification:
      - kind: e2e
        ref: "tests/e2e/spend.spec.ts — (unit-less) the caption and the bare headline; the caption appears exactly once on the page"
        status: pass
    human_judgment: false
  - id: D7
    description: "A paid order with a non-numeric amount is excluded from every total and counted in the amber pill inside its own card, never at zero; singular forms are explicit (1 paid order, 1 gift order, 1 paid order excluded)."
    requirement: FINANCE-03
    verification:
      - kind: e2e
        ref: "tests/e2e/spend.spec.ts — (figures) asserts '1 paid order excluded' on the USD card and 'Includes 1 gift order worth UAH 250.50.' on UAH, with no pill on the other three"
        status: pass
    human_judgment: false
  - id: D8
    description: "Currency codes, game codes and years are zip-derived text rendered by interpolation only; no order id, coupon name, aggregator name, package list or column name reaches the page content or any attribute."
    requirement: FINANCE-03
    verification:
      - kind: e2e
        ref: "tests/e2e/spend.spec.ts — (privacy) no order id, coupon, aggregator or package canary reaches the page, in content or in any attribute"
        status: pass
      - kind: unit
        ref: "tests/unit/spend-blocks.test.ts — no {@html, no style attribute or directive, no viewBox, no transition or animation"
        status: pass
    human_judgment: false
  - id: D9
    description: "An 80-character unbroken game code and a 60-character unbroken unit-less currency cell never widen the card or the page at 375px or 720px."
    requirement: FINANCE-03
    verification:
      - kind: e2e
        ref: "tests/e2e/spend.spec.ts — (long-text) at 375px and at 720px: scrollWidth at most the viewport, no card wider than its list"
        status: pass
    human_judgment: false
  - id: D10
    description: "A header-only Orders file leaves the section `empty` with the section's own message and renders no spend block at all, while a populated file whose statuses are all unrecognisable gives the block's `no-usable` message inside a `ready` card."
    requirement: FINANCE-03
    verification:
      - kind: e2e
        ref: "tests/e2e/spend.spec.ts — (states) and (empty) a header-only Orders file leaves the section empty and renders no block at all"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
started: 2026-10-02T11:51:16Z
completed: 2026-10-02T12:08:11Z
commits: 4
plan_head_before: 8837739d4c656dd3bdf7be6a8010ff5e61af5f0e
plan_head_after: 1e0d4918eea0bf4eaffbd1254525b1cfc1d68bf7
status: complete
---

# Phase 05 Plan 15: The Payment_history card, live

**One card per currency with the paid total as the exact two-decimal headline, the failed/new/gift figures kept separate, the collapsed per-year and per-game tables and the excluded pill — and no figure anywhere on the page that adds two currencies together.**

> **This SUMMARY was written in a second session.** The 05-15 executor
> completed and committed all three tasks and then died on an API 529 while
> writing this file, so nothing below the commits was recorded at the time.
> Every verification entry here was re-run by the close-out session against
> `1e0d491`, and every "INFERRED" decision says explicitly that the
> executor's own reasoning is not recoverable from the commits.

## Performance

- **Duration:** 17 min of committed work (11:51:16 → 12:08:11), plus a separate close-out session
- **Tasks:** 3
- **Files modified:** 9 (the plan's 7, plus the 2 CI budget files)
- **Commits:** 4

## Accomplishments

- **FINANCE-03's negative criterion is proved, not asserted.** The block has no cross-currency field to render because the worker never computes one, so the guarantee is structural AND textual: exactly one `spend-total` per card, none outside a card, an intro carrying no digit at all, the five-currency sum absent under both roundings with and without a code prefix, and every PAIRWISE sum absent — the subtler mistake of one card quietly containing another's rows. A `grep` for the word "total" would have failed here, because the intro's own copy contains it.
- **The USD headline is 15.50, not 15.49.** `9.99 + .5 + 1.005 + 4.00 = 15.495` units exactly, and a binary float draws 15.49. The value crosses the message boundary as a micro-unit STRING and is rebuilt through `parseUnitsString` and `formatMoney`; the e2e spec converts the fixture's thousandths to micro-units in the test and formats through the same path, so the boundary is crossed END TO END in the assertion rather than pinned on either side of it.
- **`usd` and `USD` are two cards, and the unit-less group is one card with no unit.** A blank currency and a two-letter one both land there, last, with a bare `13.34` headline and a caption saying the amount has no unit and may mix currencies. The breakdown rows below it are codeless for the same reason, one level down.
- **Only User_Info is pending.** `BUILT_DASHBOARDS` holds four ids; the `SECTION_NOTE_PENDING` loop in `dashboard.spec.ts`, which stood through 05-10, 05-12 and 05-13, is now empty and was removed with a comment rather than left iterating over nothing.

## Task Commits

Recorded in git order (oldest first):

1. **Task 1 (tracer): the Payment_history card turns ready and five currency cards show their headlines** — `217b355` (feat)
2. **Task 2: the failed, new, other and gift figures, the collapsed breakdowns and the excluded pill** — `707084f` (feat)
3. **Task 3: the no-blended criterion, the states, privacy and long text** — `698d768` (test)
4. **Budget: the three CI e2e limits for the ten new spend specs** — `1e0d491` (chore)

All three tasks were declared `tdd="true"`. **The RED evidence is not recoverable from the commits** — no commit message records a RED run, and the executor's SUMMARY is lost. What the commits and the code do show is the shape the plan called for: Task 1's `dashboard-status.test.ts` change is RED against a `BUILT_DASHBOARDS` that still held three ids, Task 2's `spend-blocks.test.ts` asserts the file EXISTS first because "three of them were caught passing vacuously" by an empty read of a file that did not exist, and Task 3's commit message names two of its own spec failures as the spec being wrong rather than the implementation. Treat the RED as unrecorded rather than as absent.

## Files Created/Modified

- `src/lib/components/SpendSummary.svelte` — **new, 573 lines.** The Real-money
  spend block. Root `div[data-testid=spend-block][data-state]` with
  `aria-busy` true only while loading; `h3 SPEND_HEADING` with the Premium
  block's sub-heading rule repeated in full (Svelte's scoped styles cannot
  cross two files, and a drifting copy should be visible in a diff); loading
  (`role=status`), no-usable and error (`role=alert`, the FIXED sentence, never
  the worker's `detail`, no live-region attribute); in `ready`, one intro
  Caption and a `ul` of one `li` card per currency with `data-currency` set to
  the code as written or the empty string. Each card: an `h4`, the Display
  headline, the unit-less caption on that card only, the paid count, a `dl` of
  the status counts, the gift line above zero, a closed native `details` with
  two native tables, and the shared `ExcludedNotice` last.
- `src/lib/components/Dashboard.svelte` — the `else-if` branch for
  `payment-history`, passing `{result}` and `client={ingestClient.data}`.
- `src/lib/dashboard-status.ts` — `BUILT_DASHBOARDS` gains `payment-history`,
  and the comment names the plan that flipped each of the four ids.
- `tests/unit/dashboard-status.test.ts` — the built-set and default-status
  assertions moved to four ids. The `rowCount above zero is pending` case now
  passes an explicit built set excluding the id, so the pending half is still
  asserted rather than deleted.
- `tests/e2e/dashboard.spec.ts` — the sections test renamed and re-pointed,
  the pending-note loop reduced to User_Info, the now-empty
  `SECTION_NOTE_PENDING` loop removed with a comment, and the
  `details`-in-a-card exemption widened to name Payment_history.
- `tests/unit/spend-blocks.test.ts` — **new, 6 tests.** The source-contract
  technique from 05-10, with comments stripped before every prohibition runs.
- `tests/e2e/spend.spec.ts` — **new, 10 tests.** Four sharing one sample
  import through a serial describe, six on their own exports.
- `playwright.config.ts` / `.github/workflows/ci.yml` — the three CI limits,
  19/21/27 → 20/22/28, moved together with the arithmetic in the comments.

## Decisions Made

1. **The three status hooks come from one literal table, not three `{#if}`
   blocks** (inferred — see the frontmatter). `statusFigures(card)` returns the
   rows and `data-testid` binds to the row's `hook`. The contract test asserts
   both halves, so a renamed hook fails in Node and in the browser.
2. **The breakdown is closed and uncontrolled.** Not the currency block's
   `bind:open`: five cards would need five flags, and a reader comparing two
   cards has no reason to have opened one. The spec asserts closure as a
   VISIBILITY claim rather than a count of zero, because a native closed
   `<details>` keeps its children in the DOM.
3. **The excluded pill is the shared notice, not a fifth local one.** The
   `{#if}` tests the RESOLVED pill rather than the count, so `formatPaidExcludedPill(0)`
   renders nothing and the zero case is unrepresentable from outside the
   component — the rule 05-10 established when it generalised the component.
4. **The no-blended test is proved twice, and the second half is the one that
   matters.** Structure cannot be argued with; text is where a "convenient"
   grand total would hide, in a `title` or an `aria-label` with no layout change
   at all. Both roundings of the five-currency sum are checked, because an
   exact sum and a float sum of the same displayed figures can differ by a cent
   and pinning one would pass against the other.
5. **`Other status` and the gift line are properties of the DATA.** Neither is a
   markup branch, and both are absent at zero, because "Includes 0 gift orders"
   and "no order had an unfamiliar status" are facts about nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] The CI e2e budget's three limits were left red by this plan's own specs**
- **Found during:** Task 3, the full unit suite.
- **Issue:** 178 listed tests project to 885 s and the 1.3x floor wants
  1150.5 s, so `globalTimeout: 19 * 60 * 1000` stopped passing and
  `tests/unit/ci-budget.test.ts` failed.
- **Fix:** All three moved together — 19/21/27 to **20/22/28** — with the
  derivation written at each site. Raising one alone would only move which of
  them fires first, which is the failure the guard exists to prevent. This is
  the third plan in the phase to do it (05-12, 05-14, 05-15) and the standing
  note in STATE.md anticipated each of them.
- **Files modified:** `playwright.config.ts`, `.github/workflows/ci.yml`
- **Verification:** `tests/unit/ci-budget.test.ts`, green; `playwright test --list` reports `Total: 178 tests in 15 files`
- **Committed in:** `1e0d491`

---

**Total deviations:** 1 auto-fixed (1 Rule 2 missing-functionality)
**Impact on plan:** The two files are outside the plan's `files_modified`, but
the plan's own `<verification>` could not pass without them, and 05-12/05-14
established the raise as a standing obligation rather than a surprise. No scope
added.

## Issues Encountered

- **The e2e suite is not reliably green at this HEAD — see the Verification
  section above for the full measurement and the identified mechanism.** One
  full run in six passed; `finance.spec.ts:1519` failed the other five. 05-15's
  own ten specs passed in every run. Recorded in `.planning/WINDOWS.md` as a
  `skipped-test`/hazard entry, because it is the second e2e flake this phase
  has produced and the first one with a measured failure RATE rather than an
  anecdote.
- **The executor died on an API 529 while writing this SUMMARY.** All four
  commits were already in place and the tree was clean and green, so nothing
  was lost but the record. Everything in the frontmatter's `key-decisions` and
  `INFERRED` is reconstruction from the diff, not recollection — a reader
  should treat the commit messages as the executor's own account and the
  INFERRED notes as a reading of it.
- **Two of Task 3's own spec failures were the spec being wrong**, recorded in
  `698d768`: a closed `<details>` HIDES its tables rather than unmounting them,
  and a RegExp canary cannot go through `toContain`. Both were spec defects, not
  implementation defects.
- **One unresolved documentation gap, found by this close-out and NOT fixed**
  (documentation-only scope). `src/lib/dashboard-status.ts:99` still opens its
  `BUILT_DASHBOARDS` comment with "**Two ids**, and each was added by the plan
  that gave its section a body" and then lists FOUR, ending with the
  `payment-history` entry this plan added. The plan's Task 1 said to "update the
  comment (the four built sections…)", and the per-id list below the sentence
  WAS updated — only the count in the sentence that introduces it was not. It
  is a comment, so nothing behavioural depends on it and no test reads it; the
  same plan's `tests/unit/dashboard-status.test.ts` comments say "Four
  sections have shipped", so the two files disagree with each other in prose
  only. Left in place for the orchestrator to decide on a re-dispatch; a
  one-word edit.

## Verification run by this close-out

Every command re-run against `1e0d491`, none taken on the executor's word:

| Command | Result |
|---------|--------|
| `pnpm vitest run tests/unit` | **1333 passed / 1333**, 46 files, 4.30 s |
| `pnpm check` | **exit 0** (`tsc -b`) |
| `pnpm lint` | **exit 0** — `prettier --check .` and `eslint .` both clean |
| `pnpm build` | **exit 0**, built in 229 ms |
| `pnpm exec playwright test` (run 1) | **178 passed / 0 failed**, 49.8 s |
| `pnpm exec playwright test` (runs 2-6) | **176 passed / 1 failed / 1 did not run** — the same test, five times out of five |
| `pnpm exec playwright test tests/e2e/finance.spec.ts -g "…keep the finance tooltip"`, 5x | **5 passed / 5** in isolation |
| `pnpm exec playwright test --grep-invert "05-15 real-money spend"`, 2x | **1 clean, 1 failed** — the same test |
| `git diff 8837739..1e0d491 -- package.json pnpm-lock.yaml` | **empty** (T-05-SC) |
| `git diff 8837739..1e0d491 -- DashboardSection.svelte ExcludedNotice.svelte` | **empty** (Task 1 AC) |

> ### The Playwright suite is NOT reliably green at `1e0d491`
>
> **One full-suite run in six passed.** The other five failed the same test:
>
> ```
> tests/e2e/finance.spec.ts:1519
> (clip) the first and last month keep the finance tooltip inside the viewport
> TypeError: Cannot read properties of null (reading 'y')
> ```
>
> `const flipped = (await tooltip.boundingBox())!` returned `null` immediately
> after `await expect(tooltip).toBeVisible()` had passed. The test is in a
> `mode: 'serial'` describe, so its failure also skipped the one test after it —
> that is the "1 did not run", not a second defect. **This is 05-13's spec, in a
> file plan 05-15 does not touch, and it is a load-dependent race, not a wrong
> expectation: it passes 5/5 in isolation.**
>
> **The mechanism is visible in the code.** `ChartTooltip.svelte:133` is
> `<svelte:window onscrollcapture={dismissIfStale} />`, and `dismissIfStale`
> dismisses when the anchoring cell has MOVED since the tooltip was recorded —
> deliberately, per 04-10's finding that a scroll which does not move the cell
> should not dismiss it. The test's FLIP half does:
>
> ```js
> await page.evaluate(() => window.scrollTo(0, …));   // fires scroll ASYNCHRONOUSLY
> await cells.nth(0).hover();                          // anchors the tooltip
> await expect(tooltip).toBeVisible();
> const flipped = (await tooltip.boundingBox())!;      // ← null when the scroll lands here
> ```
>
> A scroll event is delivered on a later task than the `scrollTo` call. If it is
> delivered after the hover, the cell really has moved, the tooltip really is
> stale, and dismissing it is CORRECT — the test is racing the browser's own
> event ordering. The sibling `(keys)` test in the same file documents having
> already been bitten by exactly this ("the scroll event lands after the tooltip
> has already been opened against the cell's old rect") and worked around it by
> scrolling BEFORE the interaction; the FLIP half does not.
>
> **Whether 05-15 caused it is NOT established, and this close-out did not
> establish it.** What the evidence does say:
> - It is **not** 05-15's added spec load: the failure still occurs with 05-15's
>   ten spend specs excluded from the run entirely (1 of 2 such runs failed).
> - It **is** consistent with 05-15 having widened the timing window. This test's
>   export is `buildCustomExport` with only the currency file overridden, so it
>   still carries Payment_history — which means `SpendSummary` now mounts, asks
>   the `spend` channel and renders five cards with their two breakdown tables on
>   every import this spec performs. 05-15 touched no chart, tooltip or
>   scroll-handling code.
> - Settling it needs a full-suite run at the pre-05-15 base (`8837739`) with the
>   same machine state. That was attempted and **refused by the permission layer**
>   as an overwrite of product files, correctly, because this dispatch is
>   documentation-only. It is left to the orchestrator.

Note that the historic `pnpm run lint` caveat in STATE.md — 152 errors from an
untracked-but-not-ignored `.kilo/worktrees/` inside the project root — **no
longer applies on this machine**: `pnpm run lint` exits 0 on the whole tree
today. The `.gitignore` fix is still the right one and is still unowned; the
STATE.md entry is not a current red.

## Must-have verification

Each of the plan's eleven `must_haves.truths` plus the backstop statement,
checked against the committed code rather than against the commit messages:

| # | Truth | Verdict | Where it is proved |
|---|-------|---------|--------------------|
| 1 | Card turns ready, spend channel keyed on `importedAt`, four states, stale dropped, no worker detail | **satisfied** | `BUILT_DASHBOARDS` 4 ids; `spend-blocks.test.ts` lines 77-86; `spend.spec.ts (states)` |
| 2 | One card per currency in paid-count order, code as written, two decimals, separate failed/new/other | **satisfied** | `spend.spec.ts (tracer)` + `(figures)`; the ORDER is 05-04's and the fixture's key states it |
| 3 | Exactly one total per card, no blended figure anywhere, proved on structure and text | **satisfied** | `spend.spec.ts (no-blended)`; `spend-blocks.test.ts` "never conditions a headline on anything but a card" |
| 4 | Gifts inside the paid total, shown separately, only above zero | **satisfied** | `spend.spec.ts (figures)`; the INCLUSION is 05-04's and USD's 15.495 contains both gift rows |
| 5 | Totals exact — 1.005 and `.5` included, 15.50 not 15.49, breakdowns sum to the headline | **satisfied** | `parseUnitsString` + `formatMoney`; `finance.test.ts:781-787` (05-04, re-verified green here); `spend.spec.ts (breakdown)` |
| 6 | Unknown currency card, bare headline, warning caption, `usd` and `USD` separate | **satisfied** | `spend.spec.ts (unit-less)`; fixture rows 15-16 (blank and two-letter) |
| 7 | Non-numeric amounts excluded from every total and counted in the card's pill, never at zero | **satisfied** | `spend.spec.ts (figures)`; one `spend-excluded` on the page, inside the USD card |
| 8 | Zip-derived codes interpolated only; no ids, coupons, aggregators, packages | **satisfied** | `spend.spec.ts (privacy)`; `spend-blocks.test.ts` prohibitions |
| 9 | Phase 3 pending assertions migrated with the flip; only User_Info pending | **satisfied** | `dashboard.spec.ts` re-pointed; `grep` for a pending Payment_history assertion returns nothing |
| 10 | E7, Pa5, Pa7, Z1 singulars, L1, Er1, IS_GIFT encodings, three-decimal amounts | **satisfied** | E7 `(states)`; Pa5 pill; Pa7 `(unit-less)`; Z1 `1 paid order` / `1 gift order` / `1 paid order excluded` all asserted as literals; L1/Er1 `role=status` / `role=alert` in the contract test; IS_GIFT `finance.test.ts:728-731` (05-04) |
| 11 | Long text at 375 and 720 | **satisfied** | `spend.spec.ts (long-text)`, both widths |
| — | Backstop: headlines wrap, breakdowns wrap long codes | **satisfied** | `overflow-wrap: anywhere` on the headline, h4, captions and every `td`; both long-text specs |

**One gap, and it is a comment, not a behaviour:** the `BUILT_DASHBOARDS` count
sentence in `src/lib/dashboard-status.ts` still says "Two ids" above a list of
four. See Issues Encountered. Nothing else was found unsatisfied.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **05-16 is the only plan left in Phase 5** and it gates on nothing 05-15
  still owes. What it inherits, stated so it does not have to be rediscovered:
  - **178 e2e tests in 15 files**, projecting to 885 s with the 330 s baseline
    still an ESTIMATE that descends from a 20-test Phase 1 measurement. The
    limits are 20/22/28 min. The first CI run replaces the arithmetic, exactly
    as 04-13's note promised three phases ago.
  - **`details` is now on four cards.** `dashboard.spec.ts` pins
    Player_statistics at EXACTLY two and names them; Payment_history joins the
    exempt set. A new disclosure in a Phase 5 card has to go there on purpose,
    and the query must be narrowed rather than the hook renamed.
  - **`spend-block`, `spend-card`, `spend-total`, `spend-paid-count`,
    `spend-gift`, `spend-breakdown`** are the hooks. The three status hooks
    (`spend-failed`, `spend-new`, `spend-other`) come from a literal table in
    `statusFigures`, and `spend-excluded` arrives as the `testId` PROP of
    `ExcludedNotice` rather than as an attribute literal. 05-16 must not rename
    any of them.
  - **FINANCE-01 is still open.** The Premium block (05-10) has shipped and
    FINANCE-02 was marked complete in 05-13, so the premium-time operations
    timeline is either 05-16's or a phase 5 verification item.
  - **05-16 inherits an unfixed flake at a ~83% rate, and it is a CI risk.** A
    full-suite run in six passed. This matters directly for 05-16's job: it owns
    the CI e2e budget, and a suite that fails one run in six cannot be costed or
    trusted until the `finance.spec.ts` FLIP half stops racing the browser's
    scroll-event ordering. The fix is a test-side ordering change — scroll and
    let the event land BEFORE hovering, as the sibling `(keys)` test in the same
    describe already does — not a product change, and not 05-15's file.
  - **Two carried-forward questions 05-15 did not touch and 05-16 inherits:**
    the income-currency wording the phase CONTEXT already flags for 05-08/05-09
    and UI-SPEC section 5, and the `PREMIUM_HAND_EXPECTED` unrecognised-string
    order in a fixture module 05-15 does not own.
- **Zero network after page load is intact.** `zero-network.spec.ts` passes
  unchanged in both runs, and this plan's privacy test adds a second, stronger
  instrument for the Payment_history block specifically: the four canaries
  searched in the page content AND in every attribute of every element.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Plan: 15*
*Completed: 2026-10-02*
