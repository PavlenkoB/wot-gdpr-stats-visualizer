---
phase: 04-activity-time-dashboards
plan: 17
type: execute
wave: 1
status: complete
gap_closure: true
gap_ids: [G-04-UI-1, G-04-UI-3]
files_modified:
  - src/lib/playtime-model.ts
  - src/lib/components/CalendarHeatmap.svelte
  - src/lib/focus-clear.ts
  - tests/unit/playtime-model.test.ts
  - tests/unit/focus-clear.test.ts
  - tests/unit/playtime-charts.test.ts
  - tests/e2e/playtime-ui-review.spec.ts
  - tests/e2e/playtime-charts.spec.ts
  - .planning/phases/04-activity-time-dashboards/04-UI-SPEC.md
  - .planning/phases/04-activity-time-dashboards/04-UAT.md
requirements: [ACTIVITY-02, ACTIVITY-03]
commits:
  - 77e2ad5d96016fd686cc412c3a5aefec27b3424a
  - 94a01d280257254d259f7e7b79b8154b08204e6a
  - da83df0a4e49e3281199e783af38027244ca336b
  - fd7412ce7e79ddc214da25751749db9571581d75
  - 44d930f566d85bad30330f65bb28a1e35c6cee35
  - daca3923df87389857a56ed9fe3ea4789c4435a4
  - 6edf850f080949d56d5e43adfbbc86f64f1d32fd
---

# 04-17 Summary — the calendar gutter and the focus-correction direction

Two of the four gaps the Phase 4 UI audit filed are closed: **G-04-UI-1** (the
calendar weekday labels are clipped at the left edge of every year grid) and the
**sticky-head clause of G-04-UI-3** (the focus correction does not clear a cell
from under the sticky head, and runs the wrong way). Plan 04-18 owns the tile
mid-word break, the legend run-on and the other half of G-04-UI-3; no file that
plan owns was touched.

## What was actually wrong, per task

### Task 1 — the gutter (G-04-UI-1)

The 32px gutter left **24px of room** for a label the audit measured at 29.02px,
because the labels are `text-anchor: end` and drawn 8px inside the gutter. "Mon"
and "Wed" therefore started at a negative x inside an svg whose overflow the
scroller clips, in every year of every export.

`CALENDAR_LAYOUT.gutter` is now **40**, the pad is a named `labelPad` of **4**
(so the component no longer carries an inline `- 8`), and `width` is **634**
(`40 + 54 * 11`). 36px of room against a 29.02px widest label leaves about 7px
of slack, which is what a self-hosted runner with a wider fallback face needs.
2020-12-31 moved from `x = 604` to `x = 612`; January's month label to `x = 40`
and February 2020's to `x = 84`.

**The 54-column fit still holds**: 634 is inside the 640px card content width
with 6px to spare, and `tests/unit/playtime-model.test.ts` now derives the width
from `gutter + maxColumns * pitch` rather than repeating it, so a future gutter
change cannot silently drop the 54th column.

The 10px cell, the 11px pitch, the 20px band, the 97px height and the weekday
label rows are unchanged. The hour grid is untouched: its labels measure 29px in
a 48px gutter and were never clipped.

### Task 2 — the direction (G-04-UI-3, sticky-head clause)

The head height was **not** the fault. `headHeightFor` already reads
`offsetHeight`, and it already reaches the correction as a measurement. The
fault was the **sign**: `scrollClear` negated `focusScrollDelta`, so a cell that
had to move down on screen scrolled the page down and moved up. The correction
fired, and it buried the cell.

One call changed — `window.scrollBy({ top: delta, … })` — plus the doc comment
that argued for the inverted form. The two callers, the head-height measurement
and `focusScrollDelta` itself are untouched, so the Phase 5 `MonthlyBarChart`
that shares this helper is repaired **without a Phase 5 file being edited**;
`tests/e2e/finance.spec.ts` (28 tests) is unaffected by this change.

> **Corrected 2026-10-02** during the gap-closure code review: this line read
> "`tests/e2e/finance.spec.ts` (30 tests) passes unchanged". The file holds
> **28** tests, not 30, and one of them —
> `the first and last month keep the finance tooltip inside the viewport` — fails
> deterministically (3/3 in isolation) on a tooltip-hover race. That failure is
> **pre-existing and not a regression from this plan**: it reproduces
> identically with this plan's `focus-clear.ts` reverted to its pre-04-17 sign.
> The claim was wrong in its count and in implying a clean run; the underlying
> code change is unaffected either way.


## RED evidence (both tasks, against unchanged source)

| Group | Command | Result |
|---|---|---|
| Task 1 unit | `pnpm exec vitest run tests/unit/playtime-model.test.ts` | **3 failed, 53 passed** — the hand-derived cell `x` (612), the two month-label `x` literals (40, 84) and the label-room invariant (`NaN` against 33.02, because `labelPad` did not exist) |
| Task 1 browser | `pnpm exec playwright test tests/e2e/playtime-ui-review.spec.ts -g "G-04-UI-1"` | **failed** — `Mon starts left of the svg at 1280px`, expected `>= 0`, received **`-4.234375`** |
| Task 2 unit | `pnpm exec vitest run tests/unit/focus-clear.test.ts tests/unit/playtime-charts.test.ts` | **6 failed, 55 passed** — four expect the `-36` / `-12` / `-80` request and got `+36` / `+12` / `+80`; two are the source-shape pins reading `top: -delta` off disk |
| Task 2 browser | `pnpm exec playwright test tests/e2e/playtime-ui-review.spec.ts -g "G-04-UI-3"` | **failed** — `the cell is still under the head at 375px`, expected `>= 101.78`, received **`20.78`** (81px under) |

Commit order is RED before GREEN for both tasks, checked with
`git log --grep='(04-17):'`: `test(04-17)` precedes its `fix(04-17)` in each
pair.

## Mutation check — the head height really is measured

`CalendarHeatmap.svelte:355` was temporarily changed from
`scrollClear(node, headHeightFor(node))` to `scrollClear(node, 32)` and
`playwright test tests/e2e/playtime-ui-review.spec.ts -g "G-04-UI-3"` was re-run:

```
Error: the cell is still under the head at 375px
  Expected: >= 108.1875
  Received:     96.78125
```

11.4px under a 52px head — the shortfall a declared 32px leaves, and the number
the plan predicted. The file was restored with
`git checkout -- src/lib/components/CalendarHeatmap.svelte`; `git diff --quiet`
on it then exited 0, and the test passes again.

## GREEN verification (exact commands and counts)

| Command | Result |
|---|---|
| `pnpm exec vitest run tests/unit/playtime-model.test.ts tests/unit/playtime-charts.test.ts` | 112 passed (Task 1) |
| `pnpm exec vitest run tests/unit/focus-clear.test.ts tests/unit/playtime-charts.test.ts tests/unit/playtime-model.test.ts` | 117 passed (Task 2) |
| `pnpm run check` (`tsc -b`) | clean, no output |
| `pnpm run lint` (`prettier --check . && eslint .`) | exit 0, all files match |
| `pnpm run test:unit` | **1352 passed**, 46 files (includes `contrast.test.ts`, `lint-guards.test.ts`, `ci-budget.test.ts`, all unedited) |
| `playwright test tests/e2e/playtime-ui-review.spec.ts tests/e2e/playtime-charts.spec.ts` | 19 passed |
| `playwright test tests/e2e/playtime-ui-review.spec.ts tests/e2e/finance.spec.ts` | 30 passed |
| `playwright test` over `playtime-ui-review, playtime-charts, playtime, playtime-scale, finance, zero-network` | **61 passed** |

## E2E count guard

`./node_modules/.bin/playwright test --list --reporter=list | tail -1` prints
**`Total: 189 tests in 17 files`** — the 187 measured before this plan plus the
two tests it adds, exactly as the plan's guard section predicted.

- `L = 189`
- `E = 330 + 5 × (189 − 96) + 120 + 90 = 330 + 465 + 210 = 1005 s`
- floor `1.3 × E = 1306.5 s` ≤ `globalTimeout` 1500 s ✅
- ceiling: `L = 218` projects `E = 1150 s` (`1.3 × E = 1495 s`, still passing);
  `L = 219` gives `1501.5 s` and fails.
- Headroom: **29 listed tests** today, 20 after plan 04-18 adds its two.

Neither `playwright.config.ts` nor `tests/unit/ci-budget.test.ts` was edited,
and no limit moved.

## Documentation

`04-UI-SPEC.md` gains a final `## Amendments` section with **A-1** (the gutter
and the 634px width) and **A-2** (the head's measured heights and the
correction's direction), plus one dated blockquote under the Spacing exceptions
table pointing at it — the same style as the 2026-10-01 notes. Both entries are
prose and bullets: no table, no hex value, so the sections `contrast.test.ts`
parses keep their shape. The change is **append-only**:
`git diff … | grep '^-' | grep -vc '^---'` prints **0**. Where the amendment and
the 2026-09-29 text disagree, the amendment governs; the original stays as
history.

`04-UAT.md`: **G-04-UI-1** is now `status: resolved`, `resolved_by:
04-17-PLAN.md`, `resolved_at: 2026-10-02`. **G-04-UI-2** and **G-04-UI-3** are
untouched and still read `status: failed` — 04-18 closes the first and the pair
resolves G-04-UI-3 only once both plans have run. The summary counts and the
other gaps were not touched.

## Deviations from the plan

1. **Three more stale `626` mentions in `CalendarHeatmap.svelte` were updated**,
   not just the two the plan names. They are the header comment about the sticky
   head ("scrolling a 626px grid") and a CSS comment ("card widening to 626px").
   Leaving a 634px chart described as 626px in the same file would have been an
   inconsistency inside the file this plan owns; both are comments, no behaviour.
2. **A fifth commit, `style(04-17)`.** `pnpm run lint` formats the **whole** tree,
   and the new spec was written before that gate was run, so prettier rewrapped
   two `querySelector` calls afterwards. Rather than amend the already-recorded
   RED commit (the plan forbids rewriting commits), the rewrap is its own
   whitespace-only commit.
3. **2022 is described as SCALE_5K_SPEC's second-newest block, not "the second
   block"** as the plan's parenthetical says. The spec covers 2012–2023 and the
   blocks are newest first, so 2022 is second from the top. The plan's actual
   requirements for the year — near the top, April cells at the top of the grid,
   head that wraps at 375px — are met, and the test asserts the wrap rather than
   trusting the comment.

## Not done, and why

- **G-04-UI-2 and the rest of G-04-UI-3** (tile mid-word break, legend run-on)
  belong to plan 04-18. `PlaytimeSummary.svelte` and `ChartLegend.svelte` were
  not opened, as instructed.
- **The UI-review items the user's instruction excluded** — touch scroll
  affordance, touch tooltips, the level-0 hairline, the nav clipping, and the
  desktop chart width against the card — are not planned. The hairline would
  touch the colour contract, whose guard lives in a Phase 5 plan's test file.
- **The year head's height was not changed.** Making a phone head a single line
  would truncate the per-year summary, which the UI-SPEC makes the non-colour
  relief for the ramp. A-2 records the measured heights as observations instead.

## Invariants

No network request, no new dependency (`package.json` and `pnpm-lock.yaml` are
untouched), no new user-visible string (`ui-copy.ts` and its test untouched), no
inline style, no ramp colour, no Svelte reactivity change, no Worker change. The
one shared helper's behaviour change reaches the Phase 5 bar chart by design and
is covered by its passing suite. No real personal data appears in any source,
fixture, comment or test output; every measured figure in the source and the
spec is a font metric or a box in the DOM, taken against the built app with the
synthetic `SCALE_5K_SPEC` export.
