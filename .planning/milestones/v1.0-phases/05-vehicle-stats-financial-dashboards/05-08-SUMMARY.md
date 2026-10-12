---
phase: 05-vehicle-stats-financial-dashboards
plan: 08
status: complete
started: 2026-10-01T18:47:29Z
completed: 2026-10-01T19:20:00Z
requirements: [STATS-01, FINANCE-01, FINANCE-02, FINANCE-03]
technologies: [svelte5, vitest, playwright, intl]
files_changed: 18
commits: 7
---

# Phase 05 Plan 08: Copy and format settlement

## Performance

- **7 commits** across 3 TDD tasks (test → feat per task, plus one follow-up for
  the two Task 1 items missed in the first pass)
- **18 files** changed — exactly the plan's `files_modified`, no more
- **+2385 / −25** lines

## Accomplishments

- **The deferred `ui-copy.test.ts:207` locale failure is closed.** The fix is on
  the test side, not the production side: `formatNumber` now defaults to the
  viewer's locale, and `tests/unit/setup.ts` pins `en-US` for the unit suite so
  expectations are statements about the code rather than about the machine. The
  two row-count formatters that grouped with the ambient locale now go through
  `formatNumber`.
- **The user's two open answers are written into the approved 05-UI-SPEC**, with
  an `Amendments (plan 05-08)` appendix recording each change and its reason.
  The ChartLegend deviation from D-27 is recorded rather than discovered later,
  and the spec's own unreachable `26.9M` example is corrected to `27M`.
- **The whole Phase 5 copy inventory exists once in `ui-copy.ts`**, pinned to the
  amended spec by a test that walks every name the plan's Artifacts table
  promises. Plans 05-10 to 05-15 are now pure consumers and cannot collide
  editing the file.

## Task Commits

Each task was committed atomically, RED before GREEN:

1. **Task 1: viewer-locale grouping, pinned on the test side** —
   `e8f8ea8` test (RED) → `2d6cd0f` feat (GREEN) → `97200f` test (the two items
   missed in the first pass: the Playwright `locale` and the
   `persistent-dataset.spec.ts` conversion)
2. **Task 2: flow colours and the amended spec copy** — `db7bddb` test (RED) →
   `24cc775` feat (GREEN)
3. **Task 3: the Phase 5 copy inventory** — `b9fcb35` test (RED) → `3ad4b1d`
   feat (GREEN)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `src/lib/ui-copy.ts` — viewer-locale `formatNumber`, the `setDefaultNumberLocale`
  test seam, and all 120 Phase 5 strings and formatters
- `tests/unit/ui-copy.test.ts` — 6-test locale tracer, the full copy inventory
  (4 groups), and the export-inventory contract test
- `tests/unit/setup.ts` — pins `en-US` for the whole unit suite
- `tests/e2e/pin-locale.ts` — **new**; pins the Node side of a Playwright
  assertion
- `playwright.config.ts` — `locale: 'en-US'` on the shared `use` block
- `tests/e2e/dashboard.spec.ts`, `import-failure.spec.ts`, `import-flow.spec.ts`,
  `persistent-dataset.spec.ts`, `playtime.spec.ts`, `playtime-charts.spec.ts`,
  `playtime-real-shape.spec.ts`, `playtime-scale.spec.ts`, `scroll-nav.spec.ts`,
  `uat-criteria.spec.ts` — one `import './pin-locale'` each;
  `persistent-dataset.spec.ts` also builds its expected row count with
  `formatNumber`
- `src/app.css` — `--flow-in: #4c3fa6`, `--flow-out: #a14a00`
- `tests/unit/contrast.test.ts` — 7 flow-colour tests and 11 amended-copy tests
- `.planning/phases/05-vehicle-stats-financial-dashboards/05-UI-SPEC.md` — the
  ten amendments plus the appendix
- `.planning/phases/05-vehicle-stats-financial-dashboards/deferred-items.md` —
  the locale item marked closed (outside the plan's declared `files_modified`)

## Decisions Made

- **The locale fix goes on the test side, not the production side.** Hardcoding
  `en-US` into `src/` would re-introduce the Phase 4 behaviour of imposing the
  author's locale on every reader's screen. Production default is `undefined`
  (the platform's locale); the tests declare which locale they assert in. A
  source-level test holds `src/lib/ui-copy.ts` as the only file that can pin it.
- **The two flow hues are 1.36:1 apart on purpose**, and that is asserted. It is
  why the legend words, the zero line, the tooltip and the monthly table all
  restate the direction in text: the colours may be subtle precisely because
  nothing depends on them alone.
- **Column keys are canonical slugs** (`win-rate`, `avg-damage`, …), not the
  export's per-title header names (`FRAGS_COUNT` in one file, `FRAGS` in
  another), and are the same slugs the `vehicle-sort-{key}` and
  `column-toggle-{key}` test ids use. The plan asked for "a record over every
  column key" but did not name the keys, so this is a necessary choice.
- **`formatPercent` takes a percentage, not a 0–1 ratio**, and the percent cell
  scales its ratio before calling it — one formatter, one rounding rule for win
  rate, hit ratio and survival rate.
- **`formatMoney` never emits a symbol and never re-cases the code.** A null
  code returns the bare amount rather than an invented unit, which is the
  UI-SPEC's own unknown-currency case.
- **`formatOtherCurrencyRow` does not include the code.** The component renders
  it in the Label role beside the Caption, so the code is not part of the
  sentence the Caption carries.

## Deviations from Plan

### Reported deviations

1. **All ten e2e specs got the pin import, not nine.** The plan's prose says
   "the nine specs in files_modified besides the config" but its `files_modified`
   list and the repo both contain **ten** specs importing `ui-copy`. The count in
   the prose is an arithmetic slip; the intent is unambiguous, so all ten are
   pinned. **Found during:** Task 1.

2. **One acceptance criterion is miscounted and was not satisfied literally.**
   The AC `grep -c "setDefaultNumberLocale" tests/unit/setup.ts
   tests/e2e/pin-locale.ts` "shows 1 in each file" cannot hold for a file that
   both imports and calls the function: `grep -c` counts *lines*, and there are
   two (the import and the call). The criterion's intent — each file pins the
   locale exactly once — does hold:
   `grep -c "^setDefaultNumberLocale(" tests/unit/setup.ts tests/e2e/pin-locale.ts`
   prints `1` for each. The code was not contorted to match the miscount.
   **Found during:** Task 1.

3. **Three test literals were corrected after GREEN, in the direction of the
   spec.** The premium summary's `{d}` and the currency tooltip's operation count
   were transcribed without their units. The spec writes the tooltip's line 2 as
   `{d} granted · {n} grants`, which has to read "5 days granted", so the
   summary's `{d}` carries the same unit, and "1 operation" is the singular the
   plan's own zero-one-many requirement demands. The **implementation** was
   corrected for two real bugs found the same way (see below); only these three
   literals were transcription errors, and the assertions themselves are
   unchanged in strength. **Found during:** Task 3.

4. **`deferred-items.md` was edited although it is not in `files_modified`.** The
   item it records is this plan's to close, and leaving it `open` would misreport
   the state. **Found during:** close-out.

### Auto-fixed Issues

**1. [W-03 class — spec contract] The Warplanes 20 note's second verb did not
agree with its subject.**
- **Found during:** Task 3 GREEN
- **Issue:** `formatWarplanes20Note(1, 1)` produced "1 plane record … has no
  names … **They** record 1 battle in total." The UI-SPEC's parenthetical
  requires the singular form, and my own doc comment claimed the verb agreed with
  the record count while the code keyed it on nothing.
- **Fix:** both verbs now key on `records` — "It records" for one, "They record"
  for more — while the trailing "battle/battles" still keys on `battles`, so
  four records with one battle reads correctly too.
- **Files modified:** `src/lib/ui-copy.ts`
- **Verification:** the 2-case unit test; the 4/8 case still reads "They record
  8 battles in total"
- **Committed in:** `3ad4b1d`

**2. [Spec contract] `formatOtherCurrencyRow` rendered a single-month currency as
a range.**
- **Found during:** Task 3 GREEN
- **Issue:** a currency with one month of history produced "2019-05 to 2019-05",
  which reads as a date-range bug. The UI-SPEC says a single month shows the bare
  `{ym}`, exactly as the summary sentence does.
- **Fix:** the span clause reuses the same single-vs-many rule as
  `formatCurrencySummary`.
- **Files modified:** `src/lib/ui-copy.ts`
- **Verification:** the unit test asserts the `2019-05` form
- **Committed in:** `3ad4b1d`

**3. [Scope — plan bookkeeping] Two Task 1 items were missed in the first pass.**
- **Found during:** Task 1, reading the acceptance criteria back
- **Issue:** `playwright.config.ts` had no `locale: 'en-US'` and
  `persistent-dataset.spec.ts` still built its expected number with a local
  conversion, so the browser and Node sides were not both pinned.
- **Fix:** both done, in a separate commit rather than amending the GREEN commit.
- **Files modified:** `playwright.config.ts`, `tests/e2e/persistent-dataset.spec.ts`
- **Verification:** `grep -c "toLocaleString" tests/e2e/persistent-dataset.spec.ts`
  prints `0`; `grep -c "locale: 'en-US'" playwright.config.ts` prints `1`
- **Committed in:** `97200f9`

## Issues Encountered

- **`gsd_run` and `gsd-tools` are not installed on this machine.** The executor
  workflow's commit and state-update helpers are unavailable, so all commits were
  made with plain `git` and the per-commit root/branch guard was run as a shell
  function instead. STATE.md and ROADMAP.md were updated by hand. Behaviour is
  equivalent; only the tooling differed.
- **Several large contract-file reads were externalized by the harness** rather
  than returned inline, and were re-read in smaller chunks. No file was missing
  or truncated in the end; the executor role definition, the execute-plan
  workflow, the summary template, the checkpoint table, the TDD reference and the
  path-safety reference were all read in full before the first edit.

## User Setup Required

None. No configuration, no new dependency, no manual step.

## Next Phase Readiness

- **Plans 05-10 to 05-15 can be pure consumers of `ui-copy.ts`.** Every name the
  Artifacts table promises exists and is covered by an export-inventory test, so
  a missing symbol fails here rather than at the end of a wave.
- **The later plans have their copy settled and their formatter moved.** The
  `27M` example, the viewer-locale default, the amended exclusion rules, the
  renamed disclosure, the `finance-tooltip` id and the flow tokens are all in
  the spec and the code.
- **`premium-unrecognised` and the other test ids are unchanged**, so the
  consumer plans' selectors resolve.
- Nothing in this plan is blocked on anything outside it.

## Verification Evidence

Run from the project root on this machine.

| Gate | Command | Result |
|------|---------|--------|
| Deferred locale item | `LC_ALL=de_DE.UTF-8 LANG=de_DE.UTF-8 pnpm exec vitest run tests/unit/ui-copy.test.ts` | **175 passed (175)** — was 1 failed / 114 passed before |
| Same, other locales | `LC_ALL=uk_UA.UTF-8` and `LC_ALL=fr_FR.UTF-8`, same command | **175 passed (175)** each |
| Whole suite, German locale | `LC_ALL=de_DE.UTF-8 LANG=de_DE.UTF-8 pnpm run test:unit` | **37 files, 1163 passed (1163)** |
| Whole suite, default env | `pnpm run test:unit` | **37 files, 1163 passed (1163)** |
| Types | `pnpm run check` | exit 0 |
| Lint | `pnpm run lint` | exit 0 |
| Build | `pnpm run build` | exit 0 |
| E2E specs load | `pnpm exec playwright test --list` | **120 tests in 12 files** |
| No new dependency (T-05-SC) | `git diff --quiet -- package.json pnpm-lock.yaml` | exit 0 |
| Declared scope | `git diff --stat <plan-start> HEAD` | 18 files, all declared |

The previously failing assertion, named explicitly:
`LC_ALL=de_DE.UTF-8 LANG=de_DE.UTF-8 pnpm exec vitest run
tests/unit/ui-copy.test.ts -t 'uses the existing thousands separator for the row
count'` → **1 passed**. Before this plan the same command reported
`expected '3 files, 1.204 rows' to be '3 files, 1,204 rows'`.

Production default confirmed unpinned, by importing the module with the seam
never called: `de-DE` → `1.204`, `uk-UA` → `1 204`, `en-US` → `1,204`. The app
follows the viewer; only the tests are pinned.

**Not verified:** no Playwright spec was *executed* — only listed. This plan adds
no browser behaviour (a locale pin and one import per spec), and the
`playwright.config.ts` change is a `use` option read at browser launch, so the
suite was not run end to end. If a grouped-number e2e assertion is found to fail
on a non-`en-US` machine, that is where to look first.

## Coverage Metadata

| Deliverable | Requirement | Plan | Verified by | Status |
|-------------|-------------|------|-------------|--------|
| Viewer-locale number grouping + test-side `en-US` pin | STATS-01, FINANCE-01, FINANCE-02, FINANCE-03 | 05-08 | `tests/unit/ui-copy.test.ts` (6 tracer tests), suite green under `de_DE`/`uk_UA`/`fr_FR` | automated |
| Flow data colours with measured contrast | STATS-01, FINANCE-01, FINANCE-02 | 05-08 | `tests/unit/contrast.test.ts` "flow data colours" (7 tests) | automated |
| Amended 05-UI-SPEC copy contract | FINANCE-01, FINANCE-02 | 05-08 | `tests/unit/contrast.test.ts` "05-UI-SPEC amended copy" (11 tests) | automated |
| Full Phase 5 copy inventory in `ui-copy.ts` | STATS-01, FINANCE-01, FINANCE-02, FINANCE-03 | 05-08 | `tests/unit/ui-copy.test.ts` (4 copy groups + export inventory) | automated |
| The two flow hues are distinguishable without colour | FINANCE-02 | 05-09+ | component plans, not this plan's scope | manual |
