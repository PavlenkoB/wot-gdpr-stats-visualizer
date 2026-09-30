---
phase: 04-activity-time-dashboards
plan: 02
subsystem: ui
tags: [svelte5-runes, ui-copy, dashboard-status, playwright, tdd, accessibility]

# Dependency graph
requires:
  - phase: 04-activity-time-dashboards (plan 01)
    provides: `PlaytimeClient.query(null)` resolving a `PlaytimeOutcome`, the `PlaytimeView` three-status union, and `aggregateSlice` returning `hourOverlap` / `hourStart` / `bins` zero-filled at final length
  - phase: 03-dashboard-shell-account-identity
    provides: `BUILT_DASHBOARDS` as a parameter rather than a hard-coded check, `DashboardSection`'s children-snippet contract, and the D-09 rule that a `ready` card renders its import counts as the `section-caption` after its dashboard
provides:
  - The six Phase 4 Playtime strings in ui-copy.ts (PLAYTIME_HEADING, PLAYTIME_LOADING, PLAYTIME_NO_SESSION_FILE, PLAYTIME_NO_USABLE_SESSIONS, PLAYTIME_ERROR, TILE_LABEL_SESSIONS), each pinned to a named 04-UI-SPEC copy table row
  - BUILT_DASHBOARDS holding exactly 'activity-history', so the first section reads `ready` and the other three stay `pending`
  - `src/lib/components/Playtime.svelte` — the block with the h3 sub-heading, the one `role="status"` line that exists in every state, and the Sessions tile, over the four states plus loading
  - The e2e helpers `importLine(card)` and `importLines(page)`, which read a card's import counts whichever element its status renders them in
affects: [04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12, 04-13]

actuals:
  tokens: 9323
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Answer-stamped state: one cell holds the reply TOGETHER WITH the importedAt it answers for, and a derived state treats any answer for another dataset as no answer — so a replace landing mid-query returns to loading by construction instead of by a hand-written reset"
    - "Kind-narrowed outcome handling: the effect branches on `outcome.kind` and ignores every other arm, so a `superseded` variant added by 04-07 needs no edit here and must still type-check"
    - "Status-agnostic test hooks: an e2e helper matches either element a card could render its import counts in, so a status flip is a product change and not a suite rewrite"

key-files:
  created:
    - src/lib/components/Playtime.svelte
  modified:
    - src/lib/ui-copy.ts
    - src/lib/dashboard-status.ts
    - src/lib/components/Dashboard.svelte
    - tests/unit/ui-copy.test.ts
    - tests/unit/dashboard-status.test.ts
    - tests/e2e/helpers.ts
    - tests/e2e/dashboard.spec.ts
    - tests/e2e/import-flow.spec.ts
    - tests/e2e/persistent-dataset.spec.ts

key-decisions:
  - "A null `view` on a result outcome renders as `error`, not as either empty state. The plan did not say, and both empty states are claims about the USER'S EXPORT: the worker answers view null only when it has no stored aggregate, which is a statement about its own storage. PLAYTIME_ERROR claims only that the numbers could not be worked out, which is what happened."
  - "The error paragraph carries the destructive chrome (border #c5221f / bg #fce8e6 / text #8a1c17) reused verbatim from FailureBanner, because the 04-UI-SPEC state matrix calls the error state 'the destructive-chrome message' and the Colour table already names those three values"
  - "The tile gets the 04-UI-SPEC tile surface (#f7f7fa, 1px solid #dadce0, radius 6px) and its dt/dd take the Label and Display roles from the Typography role table; the grid of three and the unit beside each number stay 04-04's"
  - "HOUR_GRID_BASIS, the Sessions.csv column names and the zero-filled `hourOverlap` / `hourStart` / `bins` contract are all left exactly as 04-01 left them — untouched, and still 04-12's and 04-03's to resolve"
  - "The e2e pending-note assertion for Activity_history is REMOVED, not replaced: the note belongs to a pending section, and the same sentence returns inside the card with the Login history block in 04-08. A comment in the spec names 04-08 so the removal reads as deferred, not dropped."

patterns-established:
  - "Copy constants are pinned by unit test to the literal in the UI-SPEC table, with the table and row named in the comment on both sides — a paraphrase has to be a deliberate edit to the test, never a side effect of editing a component"
  - "A namespace import (`import * as playtimeCopy`) for a constant that does not exist yet: a named import is a link error that takes the whole test file down, so the RED run would report zero discovered tests instead of six failing assertions. 04-04 reuses the import"
  - "The status line is rendered in EVERY state and empty when nothing is happening — an empty live region announces nothing and adds no height, while a region that appears only while loading is announced by its insertion"

requirements-completed: [ACTIVITY-01]

coverage:
  - id: D1
    description: "The six Playtime strings equal the 04-UI-SPEC wording exactly, each test literal copied from a named copy table rather than derived from the constant"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ui-copy.test.ts#04-02 tracer: Playtime state strings pinned to the UI-SPEC copy tables"
        status: pass
    human_judgment: false
  - id: D2
    description: "With the default built set activity-history reads ready and the other three supported sections read pending, and BUILT_DASHBOARDS holds exactly one id"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/dashboard-status.test.ts#with the default built set activity-history is ready and the other three pending"
        status: pass
    human_judgment: false
  - id: D3
    description: "A present-but-empty or absent Activity_history is still `empty` / `no-export`, so the DATA-04 ladder does not collapse the moment a dashboard lands"
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/dashboard-status.test.ts#an empty or absent Activity_history is still empty or no-export, never ready"
        status: pass
    human_judgment: false
  - id: D4
    description: "In the browser the Activity_history card reports data-status ready, renders the playtime block, and the other three supported cards stay pending with their notes"
    requirement: ACTIVITY-01
    verification:
      - kind: e2e
        ref: "tests/e2e/dashboard.spec.ts#(sections-pending) three sections pending and Activity_history ready, all four in D-02 order with counts"
        status: pass
    human_judgment: false
  - id: D5
    description: "A card's import counts are readable without naming the element its status happens to use, and the four-section snapshots still hold four entries before and after a reload"
    requirement: ACTIVITY-01
    verification:
      - kind: e2e
        ref: "tests/e2e/persistent-dataset.spec.ts#(reload) the same dashboard comes back from IndexedDB with the same counts"
        status: pass
    human_judgment: false
  - id: D6
    description: "The page carries exactly one live region besides the import bar's notice slot, and it is the playtime status line"
    requirement: ACTIVITY-01
    verification:
      - kind: e2e
        ref: "tests/e2e/dashboard.spec.ts#(slim-variant) after the import the same element is the slim bar"
        status: pass
    human_judgment: false
---

# 04-02 Summary

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-29T21:07Z
- **Completed:** 2026-09-29T21:25Z
- **Tasks:** 2
- **Files modified:** 10 in `src/` and `tests/`, plus this summary, STATE.md and ROADMAP.md

## Accomplishments

- **Activity_history is the first `ready` section, and it says so in one place.**
  `BUILT_DASHBOARDS` now holds exactly `'activity-history'`, so a populated
  Activity_history card renders its dashboard content instead of the pending
  note. The other three sections are untouched and still read `pending`, and
  the DATA-04 ladder is unchanged: an empty section is still `empty` and an
  absent one is still `no-export`, both asserted.
- **The block renders all four states from one derived value.** A single
  `$state.raw` cell holds the worker's answer together with the `importedAt`
  it belongs to, so an answer for a dataset that is no longer on screen is
  treated as no answer at all and the card returns to `loading` by
  construction — the rule that also protects the 168-cell grid 04-03 adds.
- **The worker's own words never reach the DOM.** The error branch renders
  `PLAYTIME_ERROR` and nothing else; `outcome.detail` appears in this
  repository only inside two comments. A rejected query is a state the card
  renders, not an exception that could take the page down from a render.
- **The six strings are pinned to the approved copy by test, not by memory.**
  Each test literal names the 04-UI-SPEC table and row it was copied from, on
  both the constant and the assertion side, so a paraphrase is a deliberate
  edit to `tests/unit/ui-copy.test.ts` rather than a diff buried in a
  component.
- **The e2e suite describes the section that now exists.** 86 tests green in
  39.7s with no assertion weakened: the status flip is asserted, the four
  summary snapshots still hold four entries, and the one global `[aria-live]`
  count was made specific instead of being relaxed.

## Task Commits

Each task was committed atomically, RED before GREEN:

1. **Task 1: Tracer, the Activity_history card turns ready and shows the Sessions tile, with the block's strings pinned to the UI-SPEC**
   - `40a70a8` (test) — RED: 10 failed | 339 passed (349)
   - `83c81fe` (feat) — GREEN
2. **Task 2: Migrate the Phase 3 e2e assertions that encode "Activity_history is pending"**
   - `aa33b15` (test) — test-only commit, no `src/` path in it

### RED → GREEN evidence

| Commit | State |
|--------|-------|
| `40a70a8` | RED — `pnpm run test:unit` exits 1 with **10 failed, 339 passed (349)** across 15 files. The six literal assertions each fail on a value (`expected undefined to be 'Playtime'`, `… to be 'Calculating playtime...'`, `… 'This export has no session file, so t…'`, `… 'No usable sessions were found in this…'`, `… 'Playtime could not be calculated from…'`, `… 'Sessions'`), because the constants do not exist yet; the two status assertions fail with `expected 'pending' to be 'ready'`; the built-set assertion fails on the empty set. All 15 files still load and 339 unrelated tests pass, so this is a per-test failure and not a crash. |
| `83c81fe` | GREEN — 349 passed (349); `pnpm run check` 0 errors 0 warnings; `pnpm run lint` exit 0; `pnpm run build` ok. |
| `aa33b15` | Test-only migration — `pnpm exec playwright test` 86 passed (39.7s). |

**One RED-commit blemish, stated rather than hidden.** At `40a70a8` the
`BUILT_DASHBOARDS holds exactly the activity-history id` test failed with
`ReferenceError: BUILT_DASHBOARDS is not defined` — the test file did not yet
import the constant — so in that commit that one test failed for a
mechanical reason as well as for the unimplemented behaviour. The behavioural
reason was proved independently: with `src/lib/dashboard-status.ts` reverted to
its `40a70a8` state and the import in place, the same test fails with
`AssertionError: expected [] to deeply equal [ 'activity-history' ]`. The
missing import is fixed in `83c81fe`.

**Machine gate caveat, carried forward unchanged from 04-01.** `gsd-tools check
tdd-red-evidence` cannot classify a vitest run (its parser reads node:test TAP,
which vitest 5 does not emit), so the RED record for this plan is this table
plus the git-log gate rather than a JSON evidence file. Every property the
gate exists to enforce holds and is independently verifiable: non-zero exit,
more than zero discovered tests, the named target tests failing, zero unrelated
failures, and a pre-implementation `test(04-02):` commit ahead of the
`feat(04-02):` commit:

```
40a70a8 test(04-02): failing tests for the Playtime copy and the shipped section id
83c81fe feat(04-02): the six Playtime strings, the one shipped id, and the block itself
```

## Files Created/Modified

- `src/lib/components/Playtime.svelte` (new) — `PlaytimeState`, `Shown`, the
  `importedAt` derivation, the query effect and the block markup: an `h3`, the
  `role="status"` line present in every state, the Sessions tile
  (`data-testid="playtime-total-sessions"`, `toLocaleString('en-US')`), the two
  empty-state paragraphs and the `role="alert"` error paragraph. Plain text
  interpolation only, hex colours in the style block, no `{@html}`, no motion,
  and `svelte-check` reports no a11y warning for it.
- `src/lib/ui-copy.ts` — a new `// Phase 4 — Playtime copy` block appended after
  the Phase 3 dashboard-shell block, with the six constants.
- `src/lib/dashboard-status.ts` — `BUILT_DASHBOARDS` seeded with
  `'activity-history'` and its doc-comment updated. Nothing else in the file
  changes, including the DATA-04 ladder.
- `src/lib/components/Dashboard.svelte` — imports `Playtime` and the
  `ingestClient` singleton and passes the block as the activity-history card's
  children snippet, inside the existing `{#each}` and branching on the id
  already in scope. No id or order is re-derived.
- `tests/unit/ui-copy.test.ts` — the namespace import and the
  `04-02 tracer: Playtime state strings pinned to the UI-SPEC copy tables`
  describe: six `test.each` rows plus two inequality tests (the error copy is
  not the generic import failure, and the two empty sentences differ).
- `tests/unit/dashboard-status.test.ts` — the Chat_history loop asserts per
  section; three new tests (default-set ready/pending, `BUILT_DASHBOARDS`
  contents, the DATA-04 empty/absent guard). The explicit-built-set tests are
  untouched.
- `tests/e2e/helpers.ts` — `importLine(card)` and `importLines(page)`.
- `tests/e2e/dashboard.spec.ts` — the sections-pending loop, the absent test, the
  pending-note loop, the `sectionSummaries` helper, two test titles, and the
  `(slim-variant)` live-region count.
- `tests/e2e/import-flow.spec.ts` — the per-section summary loop and the
  large-export Activity_history assertion.
- `tests/e2e/persistent-dataset.spec.ts` — both before/after-reload summary
  loops and the scale-export Activity_history assertion.

## Decisions Made

- **`view: null` renders as `error`.** The plan lists the four states "from the
  view" but not a null one, and 04-01's worker answers `view: null` only when it
  has no stored aggregate — a fact about the worker's storage, not about the
  user's zip. Neither empty state could be shown honestly, and
  `PLAYTIME_ERROR` ("Your imported data is unchanged") is exactly true. Decided
  in the derivation, with the reasoning in the component's doc-comment.
- **The error paragraph reuses FailureBanner's three hex values** rather than
  picking a second error red, per the state matrix's "destructive-chrome
  message" and the Colour table's existing row.
- **The tile surface and its Label/Display roles are applied now.** The Colour
  and Typography tables already fix them, and a bare `dt`/`dd` with no surface
  would be a visual decision nobody made. The three-tile grid and the units are
  left to 04-04.
- **The pending-note assertion is deferred, not deleted.** The comment added at
  the removal site names plan 04-08 and says the sentence returns inside the
  Login history block.

## Deviations from Plan

**1. One extra e2e assertion had to change, and the plan did not list it**
- **Found during:** Task 2 (verification)
- **Issue:** `dashboard.spec.ts` `(slim-variant)` asserted
  `page.locator('[aria-live]')` has count 1. The playtime status line is a
  second live region by design — the 04-UI-SPEC state matrix requires the status
  line to exist in every state and says it "is the only NEW live region; Phase
  3's notice slot keeps its own role". The count assertion failed.
- **Fix:** the existing count is now scoped to the import bar, which is what the
  test is actually about, and a page-level count of 2 plus a
  `playtime-status` count of 1 are asserted in its place — so the second live
  region is a recorded contract rather than a relaxed assertion.
- **Files modified:** `tests/e2e/dashboard.spec.ts` (a file the plan already
  names; test-only, no `src/` path in the Task 2 commit)
- **Verification:** `pnpm exec playwright test -g "slim-variant"` passes; the
  full suite is 86 passed.
- **Committed in:** `aa33b15`

**2. A test-only import added in the GREEN commit**
- **Found during:** Task 1 (GREEN)
- **Issue:** the RED commit's `BUILT_DASHBOARDS` test referenced a constant the
  test file had not imported (see the RED blemish note above).
- **Fix:** added to the existing import from `dashboard-status.ts`; no other test
  changed for this.
- **Files modified:** `tests/unit/dashboard-status.test.ts`
- **Committed in:** `83c81fe`

**3. Two `pnpm run check` errors in the new component**
- **Found during:** Task 1 (GREEN)
- **Issue:** `$derived<T>(fn)` passes the generic as the VALUE type, not the
  thunk's return type, and `state` is a reserved rune name that the compiler
  reads as a store.
- **Fix:** `$derived.by<PlaytimeState>(...)` and the local name `playtimeState`.
  No behaviour change.
- **Files modified:** `src/lib/components/Playtime.svelte`
- **Committed in:** `83c81fe`

**4. `git log -1` was amended twice, and the reason is stated here**
- **Found during:** Task 1 and after Task 1
- **Issue:** Task 1's GREEN commit was made before the component and the
  Dashboard wiring existed, which would have left one plan task split across two
  `feat(04-02)` commits. Separately, `prettier --write` had reformatted
  `tests/unit/dashboard-status.test.ts` in the working tree only, so HEAD was
  not `prettier --check` clean.
- **Fix:** both were folded into the same GREEN commit (`83c81fe`) rather than
  leaving a lint-failing commit in the history. Local, unpushed, and the RED
  commit ahead of it is untouched.
- **Files modified:** `src/lib/components/Playtime.svelte`,
  `src/lib/components/Dashboard.svelte`, `tests/unit/dashboard-status.test.ts`

**5. A tool limitation, documented not worked around**
- **Found during:** the roadmap update
- **Issue:** `gsd_run query roadmap.update-plan-progress 04 02 complete` runs
  before this summary exists, so it reported `summary_count: 1` and
  `complete: false`, and its only edit was a progress-table row it wrote with
  the spacing collapsed (`In Progress|  |`).
- **Fix:** the roadmap checkbox, the `Plans:` counter and the progress row were
  edited to the same shape 04-01's completion commit used, and the tool was
  re-run afterwards to confirm it agrees. `.planning/` is tracked in this
  repository, so nothing here is a `skipped_gitignored` path.

---

**Total deviations:** 5 (1 extra e2e assertion outside the plan's list, 1
test-only import fix, 2 compile-level fixes inside the new component, 1
documented tooling limitation, plus the two amends folded into deviation 4)
**Impact on plan:** No scope creep. Every deviation is a correction inside a
file the plan already names; nothing was added to or dropped from the plan's
`files_modified`, and no file outside it was modified.

## Issues Encountered

- **The e2e suite broke in a place the plan did not anticipate** — the global
  `[aria-live]` count. Caught by running the suite rather than `--list`, which
  the plan's automated verify would have passed.
- **`pnpm run test:unit` printed `Tests 338 passed` with `Errors 1 error` and
  exit 1 on the very first baseline run**, then ran clean twice afterwards. Not
  reproduced in any later run; recorded because a baseline that reports an
  unexplained non-zero exit is worth naming rather than re-running until it
  looks good.
- **A prettier-only diff sat in the working tree after the first GREEN commit**
  (deviation 4). Caught by the acceptance-criterion check on the plan's
  `git diff` rather than by a failing build.

## User Setup Required

None — no external service configuration required. No new dependency, no
environment variable, no schema migration.

## Next Phase Readiness

- **04-03 owns the three zero-filled arrays, unchanged by this plan.**
  `aggregateSlice` still returns `hourOverlap` / `hourStart` / `bins` at final
  length and zero-filled; the block reads only `slice.sessions`, so the
  calendar and the weekday × hour grid can be filled in without touching
  anything that exists.
- **04-04 has the surface it expects.** The `h3` sub-heading, the
  always-present status line, the tile surface and the `data-state` value are
  already in the right places; the remaining tiles and the charts are branches
  inside the same block, and the namespace import in
  `tests/unit/ui-copy.test.ts` is there to be reused.
- **04-07 can add a `superseded` outcome kind** without editing
  `Playtime.svelte`: the effect narrows on `kind` and ignores every other arm.
  The one place that must change is the state derivation, if a superseded
  outcome is meant to be visible.
- **Still open, still not resolved here:** `HOUR_GRID_BASIS` and the real
  `Sessions.csv` column names, both 04-12's, exactly as 04-01 left them.
