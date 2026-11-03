---
phase: 10-merged-dashboard-across-accounts
plan: 03
subsystem: shell
tags: [account-tag, multi-account, vehicles, accessibility, privacy, search, ui-copy, shell]

requires:
  - phase: 10-merged-dashboard-across-accounts
    plan: 01
    provides: "`ClassifyResult.accounts` in D-16 order and the three-account fixtures (`MA_ROOT_*`, `MA_NICKNAME_*`)"
  - phase: 10-merged-dashboard-across-accounts
    plan: 02
    provides: "the stamped `gameChoice` cell, `GameFilter.svelte`, and `PlayerStats.svelte` importing only the pure filter helpers"
  - phase: 09
    provides: "the `.tag` chip look in `LoginTable.svelte`, the `sticky-first` cell and the `COLUMN_GEOMETRY` record"
provides:
  - "`AccountTag.svelte` — one inert letter chip plus a visually-hidden phrase, two root nodes, no attribute that could hold an ID or a nickname"
  - "`letterOf`, `AccountTagModel`, `accountTagsOf`, `accountTagsFor`, `tagLabel` in `identity-model.ts`"
  - "`formatAccountTagLabel`, `formatAccountLegendLabel`, `VEHICLE_SEARCH_ACCOUNT_HINT` in `ui-copy.ts`"
  - "`VehicleRow.account`, stamped from the owning `AccountRowGroup.account` and never from a cell"
  - "A Map-folded `buildSummary` (one row per code, summed) and a D-20 `buildHeader` (summed battles, expiry only for one contributor)"
  - "A tag-aware `filterRows(rows, query, accountTextOf?)` and a hint linked to the search input by `aria-describedby`"
  - "`expectNicknameTextOnly` in the multi-account e2e — the privacy rule a TAGGED pane can hold"
affects: [10-04, 10-05, 10-06, Logins.svelte, Payments.svelte, VehicleTable.svelte, IdentityHeader.svelte]

actuals:
  tokens: 28443
  tasks: 3
  commits: 3
plan_head_before: 005467e250f056777643205dc99cee4ce246ae4b
plan_head_after: 69f6dd106fb001e53f2cf0b12a421d25374ad440

tech-stack:
  added: []
  patterns:
    - "A tag is TWO root nodes and no wrapper: the chip renders conditionally, the visually-hidden phrase renders unconditionally, and the caller decides the gap. A wrapper would be a third node per windowed row for no layout gain."
    - "Untrusted text is proven to be TEXT, not asserted to be: the e2e counts a nickname in `innerText` and in `outerHTML` and requires the counts EQUAL, so an attribute copy fails without naming the attribute it forbids."
    - "Search fields are compared SEPARATELY, never concatenated into one haystack, so a needle cannot straddle two fields and match for a reason the reader never typed."
    - "A pure filter takes its new capability as an OPTIONAL argument, and the caller passes `undefined` rather than an empty function when the capability is absent — so the zero case is literally v1.0's call site."

key-files:
  created:
    - src/lib/shell/AccountTag.svelte
  modified:
    - src/lib/shell/identity-model.ts
    - src/lib/shell/IdentityHeader.svelte
    - src/lib/features/vehicles/vehicle-shared.ts
    - src/lib/features/vehicles/vehicle-aggregate.ts
    - src/lib/features/vehicles/vehicle-model.ts
    - src/lib/features/vehicles/VehicleTable.svelte
    - src/lib/features/vehicles/PlayerStats.svelte
    - src/lib/ui-copy.ts
    - tests/unit/shell/identity-model.test.ts
    - tests/unit/shell/ui-copy.test.ts
    - tests/unit/vehicles/vehicle-model.test.ts
    - tests/unit/vehicles/vehicle-stats.test.ts
    - tests/unit/import/multi-account-keys.test.ts
    - tests/unit/import/multi-account-lifecycle.test.ts
    - tests/unit/import/data-query-worker.test.ts
    - tests/e2e/shell/multi-account.spec.ts

key-decisions:
  - "The account letter is assigned by the PUBLISHED ORDER, never by a sort: `accountTagsOf` projects `result.accounts` as given, so the chip a row wears is decided by the same D-16 order the identity header lists, and a re-order bug would have to exist in both places at once."
  - "The tag lookup is a `Map` keyed by root, and the summary fold is a `Map` keyed by code. Both keys are untrusted archive text, and an object literal would have made a root named `__proto__` or a code named `__proto__` a silent collision rather than a row."
  - "A vehicle id is NEVER merged across accounts (D-09), but a battle-type CODE is (D-09's other half). Merging ids would invent a battle count belonging to neither account; merging codes sums two accounts' own figures for the same identifier."
  - "The combined header shows summed battles and DROPS the expiry rather than picking one (D-20). The earliest of two is a claim the export never made and the latest silently drops an account, so the term is omitted; one contributor still answers with its own cell, exactly as v1.0."
  - "`filterRows` gained the account strings as a THIRD OPTIONAL argument rather than as a required one, and `PlayerStats.svelte` passes `undefined` (not an empty function) when there are no tags. That is what makes the single-account call byte-identical to v1.0's rather than merely equivalent."
  - "`expectNoLeak`'s exactly-once nickname rule was left untouched and its call sites left on untagged panes; the tagged pane gets `expectNicknameTextOnly` instead. Loosening the old rule to a count comparison would have weakened the single-account proof that still stands."
  - "The 375px backstop is asserted as `scrollWidth <= innerWidth` only. The visual reading of the chip's spacing is a judgement no assertion makes, so it is routed to a human rather than dressed up as coverage."

requirements-completed: [ACCOUNT-04, ACCOUNT-06]

coverage:
  - id: D1
    description: "Every vehicle row on a multi-account dataset shows its owner's letter chip in the sticky first cell, the identity header shows the same letters as its legend, and the same account wears the same letter on every pane."
    requirement: ACCOUNT-04
    verification:
      - kind: unit
        ref: "tests/unit/shell/identity-model.test.ts#letterOf / accountTagsOf / accountTagsFor"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the account tag names each account in the header and on a Vehicles row"
        status: pass
    human_judgment: false
  - id: D2
    description: "A tagged row exposes its account through visually-hidden TEXT only — 'Account B, ID 500000001, nickname Synthetic EU Captain' — with the nickname clause omitted for the account that has none, and no attribute anywhere holding an ID or a nickname."
    requirement: ACCOUNT-04
    verification:
      - kind: unit
        ref: "tests/unit/shell/ui-copy.test.ts#the account tag label"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#expectNicknameTextOnly"
        status: pass
    human_judgment: false
  - id: D3
    description: "One account renders no tag node, no wrapper, no hint, no aria-describedby and no extra first-column width: the single-account Vehicles DOM is unchanged from Phase 9."
    requirement: ACCOUNT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#a one-account replace removes every caption and restores v1.0"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/identity-privacy.spec.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "A vehicle id two accounts own stays two rows, one per account, while the battle-type summary folds to one row per code with the battles, wins and damage summed and the pre-existing sort order kept."
    requirement: ACCOUNT-04
    verification:
      - kind: unit
        ref: "tests/unit/vehicles/vehicle-stats.test.ts#Phase 10: accounts combine"
        status: pass
      - kind: unit
        ref: "tests/unit/import/multi-account-lifecycle.test.ts#answers the battle-type summary from the merged rows"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the Vehicles pane repeats the ids and folds the codes (D-09, D-20)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Vehicles header sums lifetime battles across the contributing accounts and shows the premium expiry only when exactly one account contributes; with one account the header is exactly what v1.0 shows."
    requirement: ACCOUNT-06
    verification:
      - kind: unit
        ref: "tests/unit/vehicles/vehicle-stats.test.ts#the combined header"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the Vehicles pane repeats the ids and folds the codes (D-09, D-20)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The existing Vehicles search also matches the tag letter and the account ID, with a hint announced through the input by aria-describedby; there is no sort-by-account and no account picker."
    requirement: ACCOUNT-06
    verification:
      - kind: unit
        ref: "tests/unit/vehicles/vehicle-model.test.ts#filterRows — D-11, with the account strings"
        status: pass
      - kind: unit
        ref: "tests/unit/shell/ui-copy.test.ts#the Vehicles search hint"
        status: pass
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the Vehicles search finds an account by its ID and by its letter (D-11)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Rows are attributed from the owning group's account and every root-keyed lookup is a Map, so a root literally named `__proto__` is just another root."
    requirement: ACCOUNT-04
    verification:
      - kind: unit
        ref: "tests/unit/shell/identity-model.test.ts#__proto__ and constructor are ordinary roots"
        status: pass
      - kind: unit
        ref: "tests/unit/vehicles/vehicle-stats.test.ts#a code named __proto__ is an ordinary code"
        status: pass
    human_judgment: false
  - id: D8
    description: "A 40-character nickname inside the hidden phrase cannot widen the page at 375px; the letter chip sits left of the nation chip and the vehicle name, the row stays one 40px line and the sticky first column stays readable."
    requirement: ACCOUNT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/multi-account.spec.ts#the tagged Vehicles pane never widens the page at 375px"
        status: pass
    human_judgment: true
    rationale: "Only the measurable half is asserted (the document does not scroll sideways at 375px). Whether the chip's spacing, the 4px gap to the nation chip and the widened first column READ well beside the vehicle name is a visual judgement the code cannot make. The plan filed this as a backstop human check; it is routed here rather than claimed."

duration: 4h 27m
completed: 2026-10-18
status: complete
---

# Phase 10 Plan 03: The account tag and the combined Vehicles pane Summary

**Every row on a multi-account dataset carries its owner's inert letter chip and names its account in hidden text, Vehicles reads as one combined history (summed battle-type summary, summed lifetime header, search that finds an account), and one account renders exactly what Phase 9 rendered.**

## Performance

- **Duration:** 4h 27m elapsed — about 22 min for Tasks 1 and 2, a ~4h gap where the previous executor was killed by an HTTP 429 quota error mid-Task-3, then ~25 min to finish Task 3.
- **Started:** 2026-10-18T12:59:31Z
- **Completed:** 2026-10-18T17:26:39Z
- **Tasks:** 3
- **Files modified:** 17 (1 created)

## Accomplishments

- `AccountTag.svelte`: two root nodes, no wrapper. A visible `.tag` chip holding an `aria-hidden` letter, and an always-present visually-hidden phrase. `min-width: 24px`, `font-weight: 600`, `white-space: nowrap`, an 18px line box so the chip can never make a windowed 40px row taller. The file carries no attribute of any kind that could hold an ID or a nickname — proven from outside, not asserted in prose.
- `identity-model.ts`: `letterOf` (bijective base-26, so the 32-root cap ends at `AF`), `accountTagsOf` (a projection in the published D-16 order, keyed by root in a `Map`), `accountTagsFor` (null unless two or more accounts hold data) and `tagLabel`.
- `VehicleRow.account` is stamped from `group.account` — the owning group, never a cell — in both row loops, so a wrong owner is not expressible.
- `buildSummary` folds into a `Map` keyed by the untrusted code string: battles, wins and damage each sum the numeric cells and fall back to the first special only when every contributing cell is a special. The old sort is untouched and one account produces exactly the rows it produced before.
- `buildHeader` counts contributors per account (an account contributes once, via the first matching name in the title's preference list) and drops the expiry unless exactly one contributed (D-20, T-10-11).
- `filterRows` takes an optional `accountTextOf` and compares each string on its own; a row whose root is unknown contributes NO strings, because `"".includes("")` is true and an orphan would otherwise match anything.
- `expectNicknameTextOnly`: the privacy rule a TAGGED pane can actually hold — markup count equals text count per nickname, the EU nickname is drawn at least once (the anti-vacuity control), and no attribute on any element of the detail pane or the identity header holds either nickname or any of the three roots.
- Three Phase 9 pins flipped on purpose and renamed so the intent is visible: the vehicle ids still repeat while the summary codes are now distinct.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end account tag — a Vehicles row shows its owner's letter, the identity header shows the legend, and the sr-only phrase names the account** - `537b136` (feat)
2. **Task 2: Vehicles combines the accounts — summed battle-type summary and a header that sums lifetime battles** - `16c3225` (feat)
3. **Task 3: Search finds an account, and the nickname-is-text-only privacy rule is asserted on the tagged pane** - `69f6dd1` (feat)

## Files Created/Modified

- `src/lib/shell/AccountTag.svelte` — new; the chip and the hidden phrase, with the absence of every carrying attribute documented in words.
- `src/lib/shell/identity-model.ts` — `letterOf`, `AccountTagModel`, `accountTagsOf`, `accountTagsFor`, `tagLabel`.
- `src/lib/shell/IdentityHeader.svelte` — the legend chip before each multi-variant row's name, keyed by the index as before.
- `src/lib/features/vehicles/vehicle-shared.ts` — `VehicleRow.account` and `VehicleHeader.premiumExpires: VehicleCell | null`.
- `src/lib/features/vehicles/vehicle-aggregate.ts` — `mapRow` takes the owning root; the Map-folded `buildSummary`; the D-20 `buildHeader`.
- `src/lib/features/vehicles/vehicle-model.ts` — `filterRows`' optional `accountTextOf`.
- `src/lib/features/vehicles/VehicleTable.svelte` — the tag in the sticky first cell and `w-vehicle-tagged` (192px) in the geometry record, so `minWidthPx` is still the sum of the same record.
- `src/lib/features/vehicles/PlayerStats.svelte` — `accountTextOf`, the hint with its `aria-describedby`, and the outer/inner header gates.
- `src/lib/ui-copy.ts` — `formatAccountTagLabel`, `formatAccountLegendLabel`, `VEHICLE_SEARCH_ACCOUNT_HINT`.
- `tests/unit/shell/{identity-model,ui-copy}.test.ts`, `tests/unit/vehicles/{vehicle-model,vehicle-stats}.test.ts` — the new proofs.
- `tests/unit/import/{multi-account-keys,multi-account-lifecycle,data-query-worker}.test.ts`, `tests/e2e/shell/multi-account.spec.ts` — the three flipped pins and the four new steps.

## Decisions Made

- **`accountTextOf` is `undefined`, not `() => []`, on a single account.** Both return v1.0's rows, but only one makes `filterRows`' third argument literally absent at the call site, which is what the "without the argument the behaviour is exactly v1.0's" control in the unit test is actually testing.
- **The hint renders inside the search `.control` and its `{#if}` sits flush against the `<input>`'s closing tag.** A newline there would put a whitespace text node inside every single-account control, which the layout guards read. The visual gap is the control column's own 4px, not a margin.
- **`aria-describedby` is `undefined`, not `""`, with one account.** An empty `aria-describedby` is still an attribute a screen reader and a test both have to interpret; absent is the honest single-account DOM.
- **The letter query in the e2e is `C`, chosen because none of this fixture's Blitz ids contains that letter** (`blitz_alpha`, `ussr:R12_Blitz`, `blitz_gamma`). A needle that also matched ids would not separate "the letter narrowed it" from "the id narrowed it", so the step would prove less while looking identical.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A stylesheet comment described a rule that was not in the file**
- **Found during:** Task 3, reading back the interrupted executor's partial work
- **Issue:** The `.search-hint` comment claimed "a 4px negative-ish pull so it reads as belonging to the input above it", but the rule beneath it only sets `margin: 0` and `line-height: 1.5`. A comment that misdescribes its own rule is worse than no comment: it tells the next editor that a pull exists to remove and invites a layout change nobody measured.
- **Fix:** The comment now describes what the rule does — a 1.5 line height against the captions' 1.4 for a line the reader reads rather than the tight leading of a table caption, with everything else inherited from `.caption`.
- **Files modified:** `src/lib/features/vehicles/PlayerStats.svelte`
- **Verification:** `pnpm run lint` clean; `pnpm run check` 0 errors; the pane renders identically (no property changed).
- **Committed in:** `69f6dd1`

---

**2. [Rule 3 - Blocking] A new copy constant was inserted without a blank line separating it from the next declaration**
- **Found during:** Task 3, reading back the same partial work
- **Issue:** `VEHICLE_SEARCH_ACCOUNT_HINT` landed immediately above `VEHICLE_DERIVED_NOTE` with no separating blank line, so two unrelated exported constants read as one declaration group.
- **Fix:** The blank line restored, keeping the file's existing grouping convention.
- **Files modified:** `src/lib/ui-copy.ts`
- **Verification:** `pnpm run lint` clean (Prettier and ESLint).
- **Committed in:** `69f6dd1`

---

**Total deviations:** 2 auto-fixed (1 bug in documentation-of-code, 1 formatting block)

**Impact on plan:** Neither touched behaviour. Both were repairs to the interrupted executor's in-flight Task 3 text, whose logic was sound and whose tests all passed; the work was finished, not rewritten.

## Issues Encountered

- **The previous executor was killed by an HTTP 429 quota error partway through Task 3**, leaving five files modified and uncommitted. Its partial work was coherent — a completed `filterRows` third argument, the `accountTextOf` derived, the hint's markup and CSS, and a finished ui-copy test — so it was built on rather than reverted. The two deviations above are the only repairs it needed.
- **`pnpm run test:unit -- <paths>` does not filter in this repo** (unchanged from 10-01 and 10-02): it runs all 98 files, so every "targeted" unit command in this plan's verify blocks was in fact a full-suite run. Noted rather than worked around.
- **`tests/e2e/shell/chart-fill.spec.ts` "finance charts fill the detail pane" fails at 375px under parallel Playwright workers and passes standalone.** Proven pre-existing (not caused by 10-01, 10-02 or 10-03) and logged open in `.planning/WINDOWS.md` entry 15. Not fixed and not counted as this plan's failure. `tests/e2e/shell` + `tests/e2e/vehicles` is 113 passed with no failure in this run.

## Self-Check: PASSED

- All 16 created/modified files exist on disk; the three task commits are ancestors of HEAD and `git rev-list --count 005467e..HEAD` is 3, which is what `actuals.commits` records. No commit in the plan deleted a tracked file.
- `pnpm run test:unit` — 98 files / 3264 tests green. `pnpm run check` — 0 errors, 0 warnings. `pnpm run lint` — clean.
- `pnpm exec playwright test --list` reports 258 tests in 28 files — no new listed test, as D-23 requires.
- Every acceptance grep holds: `AccountTag.svelte` has exactly one `data-testid="account-tag"` and zero `aria-label`/`title=`/`@media`/`style=` lines outside comments; `letterOf` and `accountTagsFor` are each exported once; `vehicle-shared.ts` declares `account: string`; `vehicle-aggregate.ts` reads `group.account` four times; `VehicleTable.svelte` declares and uses `w-vehicle-tagged`; `buildSummary` uses a `Map`; `premiumExpires: VehicleCell | null` is declared once; `PlayerStats.svelte` gates the inner term on `headerExpires !== null` and renders `vehicle-search-hint` once, and its `lifetime-battles` count is unchanged.
- `expectNicknameTextOnly` is defined once and called once, plus its own doc comment reference.
- `graphify update .` run: 8484 nodes, 12643 edges. `graphify-out/` left uncommitted, per Plans 10-01 and 10-02.

## Known Stubs

None. Every rule this plan added is reachable: the tag by a multi-account dataset, the legend by a header with two or more published accounts, the combined summary and header by two contributing accounts, the account search and its hint by two or more accounts. Nothing is wired to an empty or placeholder value.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plans 10-04 and 10-05 can start.** Everything they need from this plan is exported and shared: `AccountTag.svelte`, `letterOf`, `accountTagsOf`, `accountTagsFor`, `tagLabel`, `formatAccountTagLabel`, `formatAccountLegendLabel`. The same `tags !== null` zero-one-many gate and the same `w-*-tagged` geometry-record pattern are what they should copy, so the first column's growth stays inside the existing `minWidthPx` sum.
- **The privacy pattern is now reusable as a helper.** `expectNicknameTextOnly` takes a `where` string and scans whatever panes it is pointed at, so a tagged Logins or Payments pane asserts D-19 the same way rather than inventing a second rule.
- **One caution for the next plan:** `tests/e2e/shell/chart-fill.spec.ts` is flaky under parallel workers and will appear in any grouped e2e run. It is not this phase's regression; see `deferred-items.md` and `.planning/WINDOWS.md` entry 15.
- **Carried forward unchanged:** `derivePlaytimeState`'s `awaiting` still compares the PAIR `(valueIndex, game)` from 10-02, and the account tag travels beside it without touching the filter path — `PlayerStats.svelte` still imports only the pure filter helpers.

---
*Phase: 10-merged-dashboard-across-accounts*
*Completed: 2026-10-18*