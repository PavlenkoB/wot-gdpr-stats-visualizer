---
phase: 05-vehicle-stats-financial-dashboards
plan: 09
status: complete
started: 2026-10-01T19:08:53Z
completed: 2026-10-01T19:28:03Z
requirements: [STATS-01, FINANCE-01, FINANCE-02]
technologies: [svelte5, vitest, playwright]
files_changed: 8
commits: 3
---

# Phase 05 Plan 09: Pure chart and table models, and the six-link nav

**Two decision models with no words in them — the monthly bar chart's axis,
pitch, domains, labels, node bound and keyboard, and the vehicle table's sort,
search, counts, window and columns — plus the nav rule that keeps its own
current link in view with six links.**

## Performance

- **3 commits**, one per task, each with its RED recorded before the GREEN
- **8 files** changed — exactly the plan's `files_modified`, no more
- **+2134 / −6** lines
- **85 new unit tests** (25 bar chart, 37 vehicle table, 8 nav) and **1 new
  browser test**, all in files that did not exist before
- Whole suite: **1233 unit tests in 39 files, 121 e2e in 12 files, both green**,
  plus `lint`, `check` and `build`

## Accomplishments

- **Every decision both new components will need is now a pure function.** Vitest
  runs with no DOM, so a rule that lived inside a Svelte component could not
  have been tested at all. The bar chart's pitch ladder, its two domains, its
  label stride, its node ceiling and its keyboard reducer, and the vehicle
  table's comparator, search, zero-battle count, window arithmetic and column
  selection are all assertable, and plans 05-11 and 05-12 become wiring.
- **The node budget is a proven property, not a guideline (T-05-26).** The model
  declares its own `nodeCount` and `nodeBudget`, and the count is asserted at or
  under `3 × months + 40` for 1, 56, 144 and 240 months with flow in **both**
  directions in every month. The label stride doubling to 24 exactly when the
  pitch halves to 4 is what makes the worst case fit.
- **The six-link nav keeps its own current link visible, with a stable height.**
  `navScrollLeftFor` is the rule; the component writes its own `scrollLeft`; the
  scrollbar is hidden so the nav's auto height — and therefore the page's single
  `--nav-offset` — cannot move with scrollbar thickness. Proven in a real browser
  at 1280px and 375px.
- **Three of my own test expectations were wrong and the code was right**, so the
  tests were corrected and the reasons recorded in comments rather than quietly
  dropped. The 5,000-row oracle comparison had to change shape, and that is the
  most useful thing this plan found.

## Task Commits

Each task was committed atomically, RED recorded before GREEN:

1. **Task 1: the premium hand fixture's months become a geometry** — `da67f26`
   (RED: `Cannot find module '../../src/lib/bar-chart-model'` → GREEN: 25 tests)
2. **Task 2: the vehicle table's sort, search, counts, window and columns** —
   `9173daa` (RED: `Cannot find module '../../src/lib/vehicle-model'` → GREEN:
   37 tests)
3. **Task 3: the nav keeps its own current link in view with six links** —
   `0e489f9` (RED: 7 unit failures on a missing function, **and** the browser
   test failing with the nav's `scrollLeft` at 0 while the last link was marked
   current → GREEN: 14/14 `scroll-nav`, 121/121 whole e2e suite)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `src/lib/bar-chart-model.ts` — **new.** `BAR_LAYOUT`, `pitchFor`, `barHeight`,
  `nodeBudget`, `buildBarChartModel`, `barChartNavigate`, `initialBarFocus` and
  the `BarChartModel` / `BarCell` / `AxisLabel` types. Imports nothing at all.
- `src/lib/vehicle-model.ts` — **new.** `ROW_PX`, `OVERSCAN_ROWS`,
  `SCROLLER_MAX_PX`, `DEFAULT_SORT`, `firstDirection`, `nextSort`, `sortRows`,
  `filterRows`, `zeroBattleCount`, `windowRange`, `visibleColumns`. Type imports
  only.
- `src/lib/scroll-spy.ts` — `navScrollLeftFor`, the pure rule for where the nav
  scrolls to keep one link inside its box.
- `src/lib/components/DashboardNav.svelte` — binds the nav element, adds the one
  effect that depends on `activeId` and nothing else reactive, and hides the
  scrollbar for both engines. Link text, order, suffix handling, hover and focus
  styles untouched.
- `tests/unit/bar-chart-model.test.ts` — **new.** 25 tests, the premium hand
  geometry by literal, both currency cases, the label stride, the node bound and
  the keyboard reducer, plus the source-boundary test.
- `tests/unit/vehicle-model.test.ts` — **new.** 37 tests over the real WoT view
  and the generated 5,000-row view, checked against the zero-import oracle and
  the hand answer key.
- `tests/unit/scroll-spy.test.ts` — 8 tests for `navScrollLeftFor`, the existing
  15 untouched.
- `tests/e2e/scroll-nav.spec.ts` — the `(six-links)` browser test, and the
  Phase 3 wording that still said five links amended to six.

## Decisions Made

- **The first axis label is never dropped, but every later one is.** The plan
  states both "the first month then every 12 months" and "a label that would run
  past the right edge is skipped", and those two sentences cannot both hold for a
  one-month chart — a single label at x 56 with a 56px width overruns a 76px
  chart. The only reading that satisfies both is that the first label is the
  axis's origin and is never skipped. A 13-month chart is asserted to show
  exactly one label for that reason.
- **`windowRange`'s `last` is EXCLUSIVE.** The plan pins
  `windowRange(0, 480, 5000)` to `last: 18, padBottomPx: 199,280`, and that pair
  is only arithmetically consistent if `last` is one past the last drawn row:
  `first + (last - first) + (rows - last) === rows`. An inclusive reading gives
  199,240. The model and its docs say so explicitly.
- **The stale-offset pull-back gives back a viewport, not one row.** The plan
  requires "a non-empty window ending at 30" and never `first > last`, without
  pinning `first`. Pulling all the way to a single final row would satisfy the
  letter and land the reader on one row of a list they just filtered; the model
  therefore returns a viewport's worth of the list's final rows (rows 18–29 for
  a 30-row list at a 480px viewport).
- **The 5,000-row order is compared to the oracle on battle COUNTS, not ids.**
  The plan says the sort "yields the oracle's first row", but the generated
  fixture draws battles 1–3,000 across 5,000 vehicles, so the top of the order
  is a tie, and the oracle breaks ties on the raw `nation:V0000Tank` while the
  model breaks them on the cleaned `V0000Tank`. Both rules are right for their own
  vocabulary. The test now compares the whole 5,000-long sequence of battle
  counts — the one quantity the two sides share — and adds a separate check that
  every tie run is ascending by cleaned id, which pins the tie-break too.
- **`navEl` is a plain `let`, not `$state`.** The nav is the component's root
  element and is never re-created; making the handle reactive would add a
  dependency to every effect that reads it for no benefit.
- **The nav's scroll inset is READ from computed style, not repeated as 8.** The
  rule and the stylesheet cannot then drift apart, and it is the same
  `getComputedStyle` reading `parseNavOffset` already does.
- **The scrollbar is hidden for a height reason.** The nav's height is `auto` and
  the page has exactly one `--nav-offset`; a classic scrollbar is ~15px, so with
  it visible that constant would differ between a machine that draws scrollbars
  and one that does not — and headless Chromium draws none, so CI would never
  have seen it.

## Deviations from Plan

**None in scope.** The eight files changed are exactly the plan's
`files_modified`; nothing outside it was touched, and `git diff --quiet --
package.json pnpm-lock.yaml` exits 0 (T-05-SC).

### Auto-fixed Issues

These are corrections to the plan's own **test expectations**, discovered by
running them. No product code was changed to fit a wrong number, and no
assertion was weakened — in every case the code was right and the literal was
not.

**1. Test bug [Category: test] — the "one bar per cell" loop read a bar off the empty month**
- **Found during:** Task 1 (bar chart geometry)
- **Issue:** The test asserted `cell.up.x` for every cell, but April is absent
  from the hand fixture and correctly has no bar, so `up` is `null` and the
  optional chain yielded `undefined`.
- **Fix:** The loop now asserts the hit width for every cell and the bar
  geometry only where a bar exists.
- **Files modified:** `tests/unit/bar-chart-model.test.ts`
- **Verification:** 25/25 green.
- **Committed in:** `da67f26`

**2. Plan arithmetic [Category: test] — `last` was implemented inclusive, which made the plan's own `padBottomPx` unreachable**
- **Found during:** Task 2 (vehicle table model)
- **Issue:** The plan pins `last: 18` and `padBottomPx: 199,280` together. An
  inclusive `last` of 18 over 5,000 rows gives `(5000 - 1 - 18) × 40 = 199,240`.
  Only an exclusive `last` yields 199,280.
- **Fix:** The MODEL was changed to an exclusive `last` and its docs, the
  invariant test and the clamps all say so. The plan's number is now met exactly.
- **Files modified:** `src/lib/vehicle-model.ts`, `tests/unit/vehicle-model.test.ts`
- **Verification:** `windowRange(0, 480, 5000)` is asserted as `first 0, last 18,
  padTop 0, padBottom 199,280`; 37/37 green.
- **Committed in:** `9173daa`

**3. Test expectation [Category: test] — code-unit order, not an alphabet**
- **Found during:** Task 2
- **Issue:** My expected order for the vehicle column put `__proto__` first,
  "because `_` leads the letters". It does not: `_` is 0x5F, so it sorts after
  every capital letter and before the lower-case ones. The model was right.
- **Fix:** The expectation was rewritten with the code units spelled out beside
  it, so the reason survives the next edit.
- **Files modified:** `tests/unit/vehicle-model.test.ts`
- **Verification:** 37/37 green.
- **Committed in:** `9173daa`

**4. Test expectation [Category: test] — the undated row belongs LAST, not first**
- **Found during:** Task 2
- **Issue:** The ascending `lastBattle` expectation listed the vehicle that never
  fought first, which is the exact confusion D-09 exists to prevent.
- **Fix:** Moved to last, with the reason in the comment. The model was already
  correct: the cell is `{"t":"x","v":"na"}` and sorts last in both directions.
- **Files modified:** `tests/unit/vehicle-model.test.ts`
- **Verification:** 37/37 green.
- **Committed in:** `9173daa`

**5. Test helper [Category: test] — filtering the nation-prefixed id in the expectation**
- **Found during:** Task 2
- **Issue:** The "never changes order" test derived its expectation by filtering
  the raw `nation:id`, which matches on `china` — a prefix the reader never
  typed, and exactly what D-11 forbids.
- **Fix:** The expectation is now derived from the cleaned ids, with the wrong
  version's behaviour left as a comment.
- **Files modified:** `tests/unit/vehicle-model.test.ts`
- **Verification:** 37/37 green.
- **Committed in:** `9173daa`

**6. Test expectation [Category: test] — a zero inset does not mean "no scroll needed"**
- **Found during:** Task 3 (`navScrollLeftFor`)
- **Issue:** The "zero inset" case used a link that overran the nav by 40px and
  expected no movement. The model correctly scrolled by 40.
- **Fix:** The case now contrasts the SAME geometry at inset 0 and inset 8, which
  is what actually pins the difference, and a non-finite-measurement case was
  added beside it.
- **Files modified:** `tests/unit/scroll-spy.test.ts`
- **Verification:** 23/23 green.
- **Committed in:** `0e489f9`

---

**Total deviations:** 6 auto-fixed (1 model correction forced by the plan's own
arithmetic, 5 test-expectation corrections, 0 scope changes)
**Impact on plan:** No scope creep. One model change was required to make the
plan's own stated number reachable; the other five were wrong expectations of
mine, and fixing the tests rather than the code is what kept the models honest.

## Issues Encountered

- **Chromium launches on this machine, contrary to the Phase 4 note.** STATE.md
  records at length that `playwright.config.ts` "cannot launch Chromium at all"
  here and that per-test `-g` runs are the only trustworthy unit. That is no
  longer true: the new browser test was run RED and GREEN normally, and the
  **whole 121-test e2e suite passed in 40.6s in one run**. The Phase 4 caveat
  should be read as historical, and a future plan should not budget for
  per-test runs on the strength of it.
- **Prettier rejected both new model files on the first pass** (line length on
  the long doc-comment tables). Fixed with `prettier --write`; the suite was
  re-run after each reformat to confirm the geometry had not moved.
- **`windowRange` had a dead branch.** The comparator in `sortRows` carried a
  `? left < right : left < right` — both arms identical, left from drafting.
  Replaced with an explicit "both numbers compare numerically, anything else
  compares as text" so a future cell kind cannot silently produce the string
  comparison of `5` against `10`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 05-11 and 05-12, which are now wiring rather than design.**

- `src/lib/bar-chart-model.ts` and `src/lib/vehicle-model.ts` are complete and
  frozen by tests. Both hold **no words** and import nothing, so 05-11 and 05-12
  can format entirely through the 05-08 copy inventory without any string
  landing in a model. `formatMonthLabel` already exists for the `YYYY-MM` axis.
- The models' inputs are plain numbers. A component converts the exact decimal
  values from 05-04's views with the decimal module's number helper before
  calling `buildBarChartModel` — the model never sees BigInt.
- 05-12 needs to render the 40px row height the model assumes and the two spacer
  heights `windowRange` returns, and to keep `aria-rowcount` at `total + 1`.
- **Two open notes for 05-12.** First, the vehicle table's cell values are
  ratios: `formatPercent` takes a PERCENTAGE, not a 0–1 ratio (05-08's binding
  contract), and the view's `winRate` cell already holds the `× 100` product —
  so a cell must be handed to it as-is. Second, `windowRange` is pure arithmetic
  and cannot know the scroller's real height; 05-12 measures it and passes it
  in, and must re-run it after a filter shrinks the list, which is the T-05-27
  case.
- **The nav change is contained.** No other component touches the nav's scroll,
  and the whole e2e suite is green, so 05-10's Financial_data card can land
  without worrying about the nav.

---

*Phase: 05-vehicle-stats-financial-dashboards*
*Completed: 2026-10-01*
