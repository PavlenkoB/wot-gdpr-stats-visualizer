---
phase: 04-activity-time-dashboards
plan: 18
type: execute
wave: 2
status: complete
gap_closure: true
gap_ids: [G-04-UI-2, G-04-UI-3]
files_modified:
  - src/lib/components/PlaytimeSummary.svelte
  - src/lib/components/ChartLegend.svelte
  - tests/e2e/playtime-ui-review.spec.ts
  - tests/unit/playtime-charts.test.ts
  - .planning/phases/04-activity-time-dashboards/04-UI-SPEC.md
  - .planning/phases/04-activity-time-dashboards/04-UAT.md
requirements: [ACTIVITY-01, ACTIVITY-02, ACTIVITY-03]
commits:
  - a0d213a464d053066142b82203d919e4f6672b70
  - 6af5a337277f970891108fb0e6db1a807d47c4d2
  - 9c8bb0935be7a394fdf7ab1ba6cabbbd304673ed
  - 3d3caadc94ccaee863bc3a0dcc352cfb68f8dfda
  - 7910f14ebe46f33ea71e8ba120380b1e1fd0d372
---

# 04-18 Summary — the tile value and the legend note

The second of the two gap plans is done. **G-04-UI-2** (the Total playtime tile
breaks mid-word at 375px) and the **legend clause of G-04-UI-3** (the note runs
on from "More") are closed; with 04-17 that is all three gaps the Phase 4 UI
audit filed, and the UI-SPEC now carries dated amendments **A-1 to A-4**.

Both fixes are stylesheet-only and both were proven by a browser test that
failed on the old source and passes on the new.

## What was actually wrong, per task

### Task 1 — the tile (G-04-UI-2)

The `dd` is a flex row of a Display numeral and a Label unit, and it carried
`overflow-wrap: anywhere` — the rule the UI-SPEC assigns to children that hold
**untrusted text**. A formatted number is not untrusted text; the rule had been
applied by reading the sentence's subject rather than its wording. In a flex
row, `anywhere` makes an item's minimum width one character, so both parts
shrank instead of either wrapping.

Measured against the built app with the synthetic `SCALE_5K_SPEC` export, in the
RED run itself:

| | 375px | 1280px |
|---|---|---|
| tile inner width | 104.5px | 184px |
| numeral "2,467" | 66.9px, **2 lines** | 76.5px, 1 line |
| unit "hours" | 33.6px, **2 lines** | 38.4px, 1 line |
| `dd` height | **67.2px** (tile 124.8px) | 33.6px (tile 91.2px) |

At 375px the pair needs 118.9px of the 104.5px the tile has. The dd is now a
**wrapping flex row** (`flex-wrap: wrap`, a 0 row gap with the same 4px column
gap, `overflow-wrap: normal`) and the unit is `white-space: nowrap`, which
leaves the only two readable outcomes: both parts on one line, or the whole
unit on its own line under the whole numeral. `anywhere` stays for the
untrusted text in the split table's cells and the notes.

**Two tiles per row at 375px is unchanged.** The audit also offered raising the
tile minimum to force one tile per row; the plan declined it and so does the
code — the `dl` grid is untouched (`auto-fit`, `minmax(128px, 1fr)`), which the
new source-shape test pins so a future "fix" cannot widen the tile instead.

### Task 2 — the legend (G-04-UI-3, legend clause)

`ChartLegend` is a wrapping flex row of Less, the swatches, More and the
boundary note with a 4px gap in both directions, so the note's placement was a
consequence of its length. Measured, same build, same export:

| legend | width | old result |
|---|---|---|
| hour-legend | 1280px | **shares More's line** — note top 19.59px above More's bottom, 166.56px indented |
| calendar-legend | 1280px | own line, **4.00px** above it (only because the sentence is longer) |
| hour-legend | 375px | own line, **4.00px** above it |
| calendar-legend | 375px | own line, **4.00px** above it |

The row's gap is now the 8px `sm` step between the rows with the 4px column gap
kept (`gap: 8px 4px`), and the note takes a full-width `flex-basis: 100%`, so
it always starts its own line in both heatmaps. It keeps `min-width: 0` and
`overflow-wrap: anywhere` — the note embeds a formatted hours value.

**No DOM node, attribute or class was added or removed**, so the scale spec's
node-count comparison between the 5,000- and 60,000-session presets is
unaffected. `FlowLegend.svelte`, the Phase 5 copy of the same chrome, was read
to confirm it is a separate component and was not touched (it already declares
its own `gap: 4px 8px`).

## RED evidence (both tasks, against unchanged source)

| Group | Command | Result |
|---|---|---|
| Task 1 unit | `pnpm exec vitest run tests/unit/playtime-charts.test.ts` | **1 failed, 56 passed** — the dd rule declares no `flex-wrap: wrap` (it still declared `overflow-wrap: anywhere`) |
| Task 1 browser | `pnpm exec playwright test tests/e2e/playtime-ui-review.spec.ts -g "G-04-UI-2"` | **failed** — `playtime-total-hours numeral lines at 375px`, expected `1`, received **`2`** |
| Task 2 unit | `pnpm exec vitest run tests/unit/playtime-charts.test.ts` | **1 failed, 57 passed** — the legend `.row` rule declares no 8px row gap (`expected 'no' to be '8px'`) |
| Task 2 browser | `pnpm exec playwright test tests/e2e/playtime-ui-review.spec.ts -g "legend note"` | **failed** — `hour-legend note starts 4.00px under More at 375px`, expected `>= 355.6875`, received **`352.1875`** |

Both browser tests measure GEOMETRY (distinct rounded tops among the client
rects of a `Range` over an element's contents) rather than a computed style,
because in both cases the computed style was the defect: `overflow-wrap:
anywhere` is what the browser honoured, and the 4px gap is what it laid out.

Commit order is RED before GREEN for both tasks, checked with
`git log --grep='(04-18):'`: `test(04-18)` precedes its `fix(04-18)` in each
pair (`a0d213a` → `6af5a33`, `9c8bb09` → `3d3caad`).

## GREEN verification (exact commands and counts)

| Command | Result |
|---|---|
| `pnpm exec vitest run tests/unit/playtime-charts.test.ts` | **57 passed** (Task 1), **58 passed** (Task 2) |
| `pnpm exec vitest run tests/unit/playtime-charts.test.ts tests/unit/contrast.test.ts` | **97 passed** (Task 2) |
| `pnpm exec vitest run tests/unit/playtime-charts.test.ts tests/unit/contrast.test.ts tests/unit/lint-guards.test.ts` | **144 passed** |
| `pnpm run check` (`tsc -b`) | clean, no output |
| `pnpm run lint` (`prettier --check . && eslint .`) | exit 0, all files match |
| `pnpm run test:unit` | **1356 passed**, 46 files (includes `contrast.test.ts`, `lint-guards.test.ts`, `ci-budget.test.ts`, none edited) |
| `playwright test tests/e2e/playtime-ui-review.spec.ts -g "G-04-UI-2"` | **1 passed** (375px then 1280px) |
| `playwright test tests/e2e/playtime-ui-review.spec.ts -g "legend note"` | **1 passed** (four legend and width combinations) |
| `playwright test tests/e2e/playtime.spec.ts tests/e2e/playtime-scale.spec.ts` | **9 passed** |
| `playwright test tests/e2e/playtime-scale.spec.ts tests/e2e/playtime-charts.spec.ts` | **23 passed** |
| `playwright test tests/e2e/finance.spec.ts` | **28 passed** |
| `playwright test` over the eight phase-gate specs | **106 passed** |

The two known flakes named in the session brief did not fire: the finance
tooltip-hover race at `tests/e2e/finance.spec.ts:1568` passed in the run above,
and the unit suite was green.

## E2E count guard

`./node_modules/.bin/playwright test --list --reporter=list | tail -1` prints
**`Total: 191 tests in 17 files`** — the 189 measured after 04-17 plus this
plan's two, exactly as its guard section predicted.

- `L = 191`
- `E = 330 + 5 × (191 − 96) + 120 + 90 = 1015 s`
- floor `1.3 × E = 1319.5 s` ≤ `globalTimeout` 1500 s ✅
- with Phase 5's seven tests (plans 05-20 to 05-22): `L = 198`, `E = 1050 s`,
  `1.3 × E = 1365 s`
- Headroom: **27 listed tests** today; `L = 218` still passes (`1.3 × E = 1495 s`)

Neither `playwright.config.ts` nor `tests/unit/ci-budget.test.ts` was edited and
no limit moved.

## Documentation

`04-UI-SPEC.md` gains **A-3** (the tile value at narrow widths) and **A-4** (the
legend note) in the section 04-17 created, in the same voice: prose and bullets,
no table, no hex value (`sed -n '/^## Amendments/,$p' … | grep -c '#[0-9a-fA-F]\{6\}'
prints 0). Both entries record the measurement behind them and the rule that
replaced the old one; A-3 also writes down the **accepted limit** (a seven-digit
numeral overflows its padding rather than breaking) and states that the Spacing
section's blanket untrusted-text sentence is read as applying to children that
hold untrusted text. The change is **append-only**:
`git diff b001fce … | grep '^-' | grep -vc '^---'` prints **0** across both
plans.

`04-UAT.md`: **G-04-UI-2** is now `status: resolved`, `resolved_by:
04-18-PLAN.md`; **G-04-UI-3** is `status: resolved`, `resolved_by: 04-17-PLAN.md
and 04-18-PLAN.md` — the sticky-head clause by 04-17, the legend clause by this
plan. Both `resolved_at: 2026-10-02`. `status: resolved` went from **2 at
b001fce to 5**, exactly three more, one per UI gap. The header's Current Test
line said gaps `G-04-UI-1..4` when only three were ever filed; it now says
G-04-UI-1 to G-04-UI-3 are closed and the phase awaits re-verification. Test 6's
result, the summary counts, every other gap and the deferred follow-ups are
untouched.

## Acceptance greps (the plan's own checks)

| Check | Result |
|---|---|
| `grep -c "flex-wrap" src/lib/components/PlaytimeSummary.svelte` | 1 |
| the `dd` rule's `overflow-wrap: anywhere` count | 0 |
| `grep -c "flex-basis" src/lib/components/ChartLegend.svelte` | 1 |
| `font-size` in the diff of either component since `b001fce` | 0 and 0 |
| files in this plan's commits matching `ui-copy\|package.json\|pnpm-lock` | 0 |
| files in this plan's commits matching the Phase 5 / guard patterns | 0 |
| UI-SPEC deletions since `b001fce` | 0 |

The six files this plan commits are exactly its `files_modified` list.

## Deviations from the plan

1. **The RED measurements were taken in a throwaway spec, then deleted.** The
   committed RED assertion stops at the FIRST failure (the numeral's two lines),
   so the unit's line count, the tile heights and the 1280px legend run-on
   numbers were measured by a temporary `tests/e2e/tmp-measure.spec.ts`, run,
   read and removed before the RED commit. It was never staged and never
   committed; the same approach measured the legend table above. The committed
   tests carry the numbers as comments.
2. **`flex-basis: 100%` is declared before `overflow-wrap: anywhere`** in the
   `.note` rule, where the plan lists it after. Prettier does not reorder
   declarations and the order is immaterial; it sits next to `min-width: 0`,
   the property it works with.
3. **The unit legend test also pins the 4px column gap and the tile test also
   pins `minmax(128px, 1fr)`.** The plan requires both of those values to be
   preserved; a source-shape guard that cannot fail when they change is not
   holding the cause in place.

## Not done, and why

- **The UI-review items the user's instruction excluded** — the phone scroll
  affordance, tooltips on touch, the level-0 hairline, the nav clipping and the
  desktop chart width against the card — are untouched by the user's decision,
  and the level-0 hairline would touch the colour contract, whose guard lives in
  a Phase 5 plan's test file.
- **The tile minimum was not raised.** That was the audit's other suggestion;
  the plan chose stacking, which keeps the UI-SPEC's two-per-row contract.
- **The year head's height was not changed** (04-17's A-2 still governs it).
  This plan did not reopen that file.
- **No REFACTOR commit.** Nothing needed one: both changes are two declaration
  groups each, and the comments explaining them were written with them.

## Invariants

No network request, no new dependency (`package.json` and `pnpm-lock.yaml`
untouched), no new user-visible string (`ui-copy.ts` and its test untouched), no
inline style, no colour value, no font-size change, no DOM node added or
removed, no Svelte reactivity change, no Worker change, no Phase 5 file edited.
No real personal data appears in any source, fixture, comment or test output;
every measured figure in this summary, in the source comments and in the
UI-SPEC amendments is a font metric or a box in the DOM, taken against the
built app with the synthetic `SCALE_5K_SPEC` export. The real archive was
never opened.

Plan 04-17's work is preserved and still holds: its e2e tests
(`G-04-UI-1`, the focus-correction direction) pass in the 106-test phase gate,
its amendments A-1 and A-2 are untouched, and `git diff b001fce` on
`04-UI-SPEC.md` contains no deleted line.
