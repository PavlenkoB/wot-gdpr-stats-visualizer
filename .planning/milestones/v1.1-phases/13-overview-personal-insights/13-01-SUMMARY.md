---
phase: 13-overview-personal-insights
plan: 01
subsystem: ui
tags: [svelte5, worker, dexie, postmessage, overview, insights, privacy]

requires:
  - phase: 10-merged-dashboard-across-accounts
    provides: the playtime aggregate (PLAYTIME_VERSION 3) stored on the meta record, and the per-game scopes it carries
  - phase: 12-account-timeline-perks
    provides: the ask-and-accept page pattern (shown cell, alive flag, acceptDataOutcome) that the Overview copies
provides:
  - "The `overview` worker channel: field-less, validated, answered from one Dexie snapshot and memoised per import"
  - "The shared OverviewView wire contract: sixteen catalogue-ordered tiles, a source for each, no field that can carry a sensitive value"
  - "RowsSnapshot.playtime: the meta record's aggregate read in the SAME transaction as the rows"
  - "buildOverviewView: the pure builder, with the Logged in tile real and the other fifteen absent"
  - "withCurrentPlaytime: the stale-aggregate rebuild, with the replace-lands-mid-read case answering null"
  - "The Logged in hero on the Overview, with its rule inline, and a skeleton while the one answer is pending"
affects: [13-02, 13-03, 13-04, 13-05, 13-06, 13-07, 13-08, 13-09, 13-10, 13-11, 13-12, 13-13, 13-14, 13-15]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 17792
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A channel's answer and its rows come from ONE Dexie read; the meta record's derived aggregate rides that read rather than taking a second snapshot"
    - "A view's tiles are an ARRAY of { id, ... } objects in catalogue order, never an object keyed by tile id, so a data-derived string can never sit in a property position"
    - "A stale derived aggregate is REBUILT from the stored rows and written back through a compare-and-set, and a replace that lands between the two reads answers nothing"

key-files:
  created:
    - src/lib/features/overview/overview-shared.ts
    - src/lib/features/overview/overview-aggregate.ts
    - src/lib/features/overview/overview-state.ts
    - src/lib/features/overview/OverviewTile.svelte
    - tests/unit/import/overview-worker.test.ts
    - tests/e2e/shell/overview-insights.spec.ts
  modified:
    - src/lib/core/types/worker-messages.ts
    - src/lib/worker/data-queries.ts
    - src/lib/worker/db.ts
    - src/lib/worker/ingest.worker.ts
    - src/lib/shell/Overview.svelte
    - src/lib/shell/Dashboard.svelte
    - src/lib/ui-copy.ts
    - tests/unit/import/new-data-worker.test.ts
    - tests/unit/import/data-query-worker.test.ts
    - tests/unit/import/multi-account-keys.test.ts

key-decisions:
  - "The number a tile shows is formatted by ui-copy (`formatLoggedDays`, `formatLoggedHours`), not by the component: the locale is then this module's pinned default — the viewer's in the app — exactly as every other number on the page is grouped, and the e2e can pin it."
  - "The first date is rendered with the project's own `formatCalendarDate` (pure integer civil-date arithmetic), not `Intl.DateTimeFormat`: `civil-date.ts` refuses `Date` on purpose and the repository uses no `Intl.DateTimeFormat` at all, so the export's date cannot move with the viewer's time zone."
  - "The stale-aggregate tracer writes `PLAYTIME_VERSION - 1`, not the plan's literal `v 3`: `PLAYTIME_VERSION` is 3 today, so a stored `v 3` is the CURRENT version and would not exercise the rebuild at all."
  - "The memo is emptied explicitly before the stale-rebuild ask: the memo is keyed by the query AND the dataset, so a rewrite of the stored aggregate behind the worker's back does not invalidate it, and the case is about the rebuild rather than about the memo."
  - "`onopen` is DECLARED and accepted by the new Overview but not read yet: plan 13-12 wires the tiles' own links to it, and declaring it now keeps the Dashboard's call site from changing shape."
  - "The absent tiles' `column` is null for every tile in this plan: a column-level absence is a later plan's fact, and a null column is the honest answer for a whole-source absence."

patterns-established:
  - "The shared contract module carries NO dependency of any kind (no import statement at all), because both the worker and the page import it; a unit test reads the file and asserts it."
  - "A page's channel ask is a `$state.raw` cell holding the applied answer TOGETHER WITH the dataset it answers for, and the screen state is a pure function of that cell — a replace lands as 'no answer for what is on screen' rather than as a hand-written reset."
  - "A page-level surface adds no live region of its own: the Overview keeps the page's two, and its failure banner uses `role=\"alert\"` with no `aria-live` attribute."

requirements-completed: [INSIGHT-01, INSIGHT-07, INSIGHT-08]

coverage:
  - id: D1
    description: "The bare `{ channel: 'overview' }` is accepted by the validator, every smuggled or inherited field is rejected, and the worker answers a malformed overview query with the fixed detail `invalid query`."
    requirement: INSIGHT-01
    verification:
      - kind: unit
        ref: "tests/unit/import/overview-worker.test.ts#the overview channel is a strict field-less query"
        status: pass
      - kind: unit
        ref: "tests/unit/import/new-data-worker.test.ts#the two channels are strict field-less queries"
        status: pass
    human_judgment: false
  - id: D2
    description: "The shared view contract carries sixteen catalogue-ordered tile ids, a source for every one, and no field that can hold an order amount, chat text, a clan name, a nickname or an e-mail."
    requirement: INSIGHT-08
    verification:
      - kind: unit
        ref: "tests/unit/import/overview-worker.test.ts#the channel table and the view contract cannot drift"
        status: pass
    human_judgment: false
  - id: D3
    description: "The answer is built from ONE Dexie snapshot: the meta record's playtime aggregate rides the rows' own transaction, a stale aggregate is rebuilt from the stored session rows, and a replace that lands between the two reads answers importedAt null."
    requirement: INSIGHT-01
    verification:
      - kind: unit
        ref: "tests/unit/import/overview-worker.test.ts#the tracer: one answer from stored session rows to the Logged in tile"
        status: pass
    human_judgment: false
  - id: D4
    description: "A legacy Sessions.csv lands on an Overview that draws a skeleton while the single answer is pending, then the Logged in hero with the union of session seconds across all games and the rule line saying 'across all games'."
    requirement: INSIGHT-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/overview-insights.spec.ts#(tracer) the Overview asks one channel and shows Logged in with its rule"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Overview asks the overview channel only: a second ask is answered from the memo, and an ask never supersedes another channel's question."
    requirement: INSIGHT-07
    verification:
      - kind: unit
        ref: "tests/unit/import/overview-worker.test.ts#the tracer: one answer from stored session rows to the Logged in tile"
        status: pass
      - kind: integration
        ref: "src/lib/core/query-client.ts#query — supersede is per channel, so an Overview ask cannot release an open pane's question"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Overview's visual composition: the hero's figure, its unit and its rule line read as the sketch's tile, with the page's two live regions untouched and no bold element of its own."
    requirement: INSIGHT-01
    verification:
      - kind: e2e
        ref: "tests/e2e/shell/overview-insights.spec.ts#(tracer) the Overview asks one channel and shows Logged in with its rule"
        status: pass
    human_judgment: true
    rationale: "The e2e proves the figure, the rule line, the live-region count and the absence of a `b`; whether the hero LOOKS like the sketch 030 tile is a visual judgement no assertion can make, and plan 13-09 replaces this component with the full tile anatomy."

duration: 26min
completed: 2026-10-23
status: complete
---

# Phase 13 Plan 01: The overview channel and the Logged in hero Summary

**One field-less worker channel answered from a single Dexie snapshot, the full sixteen-tile view contract written in advance, and one real slice through it — the "Logged in" hero, from the stored session rows to a tile on the page.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-10-23T09:44:00+04:00
- **Completed:** 2026-10-23T10:10:00+04:00
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- The `overview` channel is registered, validated as a strict field-less query, answered from one Dexie snapshot and memoised per import. A smuggled `title`, `battleType`, `game`, arbitrary extra key or an INHERITED key is rejected, and the worker answers the fixed detail `invalid query`.
- The whole wire contract is written in one place — sixteen catalogue-ordered tile ids, a source for each, and no field anywhere that can carry an order amount, chat text, a clan name, a nickname or an e-mail. Every later plan fills an absent entry without reshaping the type.
- The playtime aggregate now rides the rows' own transaction, so a channel that needs it never takes a second snapshot. A stale aggregate is rebuilt from the stored session rows and written back through a compare-and-set; a replace that lands between the two reads answers nothing at all rather than one export's numbers under another's date.
- The Overview was rewritten as a thin composer: one ask, a skeleton while the answer is pending, then the Logged in hero with its rule inline — "4.5 h across all games (24-hour days) since Mon, Mar 5, 2018." The page keeps exactly its two live regions.
- The chain is proven twice: through the real worker and Dexie (sixteen tiles, the merged 16,230 s, the memo, the rebuild, the clear) and in a real browser.

## Task Commits

Each task was committed atomically:

1. **Task 1: The overview contract and the channel registration** - `06d35ef` (feat)
2. **Task 2: End-to-end "Logged in"** - `b1793d3` (feat)

**Plan metadata:** `docs(13-01): complete the overview channel and the Logged in hero plan` — the commit that carries this SUMMARY, STATE.md, ROADMAP.md and the broken-windows ledger.

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified

- `src/lib/features/overview/overview-shared.ts` - The wire contract: `OVERVIEW_TILE_IDS`, `OVERVIEW_TILE_NEEDS`, the tile types, `OverviewView`. No dependency of any kind.
- `src/lib/features/overview/overview-aggregate.ts` - The pure builder `buildOverviewView`: the Logged in tile real, the other fifteen absent.
- `src/lib/features/overview/overview-state.ts` - `deriveOverviewScreen` and the re-exported `acceptDataOutcome`: loading / error / ready, decided in one pure place.
- `src/lib/features/overview/OverviewTile.svelte` - The Logged in hero: label, figure in days, unit, and the rule line.
- `src/lib/core/types/worker-messages.ts` - `{ channel: 'overview' }` in `DataQuery`, `{ channel: 'overview'; view: OverviewView }` in `DataResult`.
- `src/lib/worker/data-queries.ts` - `DATA_FILES.overview` (four files, three categories) and the `overview` case in `answerDataQuery`.
- `src/lib/worker/db.ts` - `RowsSnapshot.playtime`, read from the meta record in the same transaction as the rows.
- `src/lib/worker/ingest.worker.ts` - `withCurrentPlaytime`: the stale-aggregate rebuild and the replace-lands-mid-read rule.
- `src/lib/shell/Overview.svelte` - Rewritten as the composer.
- `src/lib/shell/Dashboard.svelte` - Passes `client={ingestClient.data}` to the Overview.
- `src/lib/ui-copy.ts` - `OVERVIEW_LOADING`, `OVERVIEW_ERROR`, `OVERVIEW_TILE_COPY`, `formatLoggedRule`, `formatLoggedDays`, `formatLoggedHours`.
- `tests/unit/import/overview-worker.test.ts` - The validator cases and the tracer proof through the real worker.
- `tests/e2e/shell/overview-insights.spec.ts` - The first browser proof.

## Decisions Made

1. **The tile's numbers are formatted by `ui-copy`, not by the component.** The plan said "numberFormatter"; calling it directly from the component would use the raw platform default, while every other number on the page goes through `ui-copy`'s own pinned default (the viewer's locale in the app, `en-US` under test). `formatLoggedDays` and `formatLoggedHours` now sit beside the rest of the copy, so the e2e can pin the locale the way `tests/e2e/_support/pin-locale.ts` exists to.
2. **The first date uses `formatCalendarDate`, not `Intl.DateTimeFormat`.** The plan said "the locale's date format"; the repository contains no `Intl.DateTimeFormat` at all, and `src/lib/core/civil-date.ts` refuses the `Date` type on purpose (a `Date` in the viewer's zone would move the export's date). The project's own pure civil-date arithmetic is the format every other date on the page uses.
3. **The stale-aggregate tracer writes `PLAYTIME_VERSION - 1`.** The plan's literal was "a copy with v 3", but `PLAYTIME_VERSION` is 3 today, so a stored `v 3` is the CURRENT version and the case would not have exercised the rebuild at all. The intent — a stale aggregate — is what the test now pins.
4. **The memo is emptied explicitly before the stale-rebuild ask.** The memo is keyed by the query AND the dataset, so rewriting the stored aggregate behind the worker's back does not invalidate it; the case is about the rebuild, so the test says so.
5. **`onopen` is declared and accepted, not read.** Plan 13-12 wires the tiles' own links to it; declaring it now keeps the Dashboard's call site stable and the phase-8 shell guard happy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed the stale `Overview.svelte (card.id)` row from the keyed-each audit**
- **Found during:** Task 2 (the full unit suite, after the Overview rewrite)
- **Issue:** `tests/unit/import/multi-account-keys.test.ts` audits every `{#each}` block keyed by an expression and fails on a row that names a block which no longer exists. The Overview's card grid was such a block, and the rewrite removed it, so the audit failed with "stale audit rows: Overview.svelte (card.id)".
- **Fix:** Removed that one audit row. `overview-model.ts` and `OVERVIEW_CARD_IDS` are untouched, so plan 13-13 still retires them; only the row about a Svelte block that no longer exists was dropped.
- **Files modified:** `tests/unit/import/multi-account-keys.test.ts`
- **Verification:** `pnpm run test:unit` — 137 files, 4,158 passed, 9 expected fail, 0 failed.
- **Committed in:** `b1793d3`

**2. [Rule 1 - Bug] Widened the `viewOf` helper's view union in `data-query-worker.test.ts`**
- **Found during:** Task 1 (`pnpm run check`)
- **Issue:** `DataResult` grew an `overview` member, so the shared test helper's declared return union no longer covered it and `tsc -b` failed.
- **Fix:** Added `OverviewView` to the union and to the file's type imports — the same one-line widening every earlier channel addition made there.
- **Files modified:** `tests/unit/import/data-query-worker.test.ts`
- **Verification:** `pnpm run check` exits 0.
- **Committed in:** `06d35ef`

**3. [Rule 1 - Bug] Moved the tile's number formatting into `ui-copy.ts`**
- **Found during:** Task 2 (the locale seam)
- **Issue:** `numberFormatter(undefined, …)` called from the component resolves the raw platform default locale, which is not the locale the rest of the page groups by and is not the locale a test can pin.
- **Fix:** `formatLoggedDays` and `formatLoggedHours` now live in `ui-copy.ts` and use that module's pinned default, exactly as `formatNumber` does.
- **Files modified:** `src/lib/ui-copy.ts`, `src/lib/features/overview/OverviewTile.svelte`
- **Verification:** the e2e asserts the rendered figure against the formatter's output with the locale pinned on both sides.
- **Committed in:** `b1793d3`

**4. [Rule 1 - Bug] Rewrote the stale-aggregate tracer case as `PLAYTIME_VERSION - 1`**
- **Found during:** Task 2 (reading the plan's "a copy with v 3" against the code)
- **Issue:** `PLAYTIME_VERSION` is 3, so a stored `v 3` is current and the case would have proved nothing about the rebuild.
- **Fix:** The tracer writes `PLAYTIME_VERSION - 1` and then asserts the stored aggregate is back at `PLAYTIME_VERSION` after the ask.
- **Files modified:** `tests/unit/import/overview-worker.test.ts`
- **Verification:** the tracer case passes and asserts both halves (the answer is unchanged and the stored aggregate's `v` is current again).
- **Committed in:** `b1793d3`

---

**Total deviations:** 4 auto-fixed (4 × Rule 1)
**Impact on plan:** All four are corrections inside the plan's own scope; none adds scope. Two are test-harness consequences of adding a channel to a shared union, one is the locale seam, and one is the plan's literal `v 3` not being stale.

## Issues Encountered

- The full e2e suite has **six failing assertions** after this plan, all of them expecting the retired Phase 8 Overview hooks (`ov-chip-*` / `ov-card-*`): `master-detail-nav.spec.ts` ("three chips and six cards"), `dashboard.spec.ts` (`ov-chip-unsupported`), `device-info.spec.ts` (`ov-card-device-info`), `account-timeline-perks.spec.ts` (`ov-card-account-timeline`) and two `multi-account.spec.ts` cases (`ov-card-account`). The plan anticipates exactly this ("the old e2e Overview assertions in other spec files fail until 13-13") and this plan's instruction is to leave the old tests untouched, so they were left. All six are recorded in the broken-windows ledger.
- The listed e2e suite is now **266 tests in 32 files**, one over the 265 it was. The three CI limits (32 / 34 / 42 minutes) cover up to 273, so the limits do not move and `tests/unit/guards/ci-budget.test.ts` stays green.

## Known Stubs

| Stub | File | Why |
|------|------|-----|
| Fifteen of the sixteen tiles are returned `absent` | `src/lib/features/overview/overview-aggregate.ts` | By design in 13-01: the wire contract is written in full so the later plans fill entries without reshaping the type. Plans 13-06 (copy), 13-07 (Tanks) and 13-08 (Records/Totals) fill them. |
| `Logged in.battleSeconds` is `null` | `src/lib/features/overview/overview-aggregate.ts` | The lifetime battle-time figure arrives with plan 13-08 from `BATTLE_LIFE_TIME`. The rule line omits the "In battle" sentence entirely rather than printing a zero. |
| `OverviewTile.svelte` draws only the Logged in hero | `src/lib/features/overview/OverviewTile.svelte` | Plan 13-09 replaces this component with the full tile anatomy (grouping, expansion, pinning). |
| `onopen` is accepted and not read | `src/lib/shell/Overview.svelte` | Plan 13-12 wires the tiles' "Open <Section>" links to it. |

All four are recorded in `.planning/WINDOWS.md`.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-worker-channel | `src/lib/worker/data-queries.ts` | A new trust-boundary entry point: the `overview` channel is answered from the posted query. It is field-less and validated by `isDataQuery` with the fixed `invalid query` detail, so a hostile message cannot smuggle a field into the builder. |
| threat_flag: new-cross-boundary-type | `src/lib/features/overview/overview-shared.ts` | The `OverviewView` wire type crosses from the worker to the page. It has no field for an amount, chat text, a clan name, a nickname or an e-mail, and its tiles are an array of objects, so no tile id can reach a prototype. |

## Requirements Not Marked Complete

`requirements.ready-ids` returned an EMPTY ready set for this plan: **INSIGHT-01**, **INSIGHT-07** and **INSIGHT-08** are each declared by several plans in phase 13 (INSIGHT-07 by nine of them), so the shared-ID gate blocks every one of them until the LAST plan that declares it has produced a SUMMARY. Flipping them here would put "Complete" on a requirement whose remaining declaring plans have not run — the exact false ledger entry the gate exists to prevent.

The frontmatter lists this plan's `requirements` verbatim, as the template requires; `.planning/REQUIREMENTS.md` is deliberately untouched and must be re-checked after the last declaring plan of each ID finishes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The channel, the contract, the snapshot rule, the builder and the page composer are all in place, and the "Logged in" slice is real end to end. Plans 13-02 to 13-12 add to this wiring without reshaping `OverviewView`, `OverviewInputs` or the answer branch.
- `buildOverviewView` already accepts the four file inputs (`accountStats`, `vehicleStats`, `currency`, `orders`) with their groups and presence, so the vehicle and account reducers of 13-07/13-08 have their inputs waiting.
- The Overview page currently draws one hero; the group grid, the absent row, the pinned group and the "Wargaming life" strip all belong to plan 13-09's tile anatomy, and the shell is ready for it.
- **Blocker for the phase's e2e budget:** the six failing old-Overview assertions are 13-13's to retire. Until then the e2e suite is red in six places, and every one of them names a hook this plan deliberately removed.

## Self-Check: PASSED

- All eleven created/modified source files exist on disk.
- Both task commits (`06d35ef`, `b1793d3`) are ancestors of HEAD.
- `commits: 2` measured from the plan ledger (`a0b0626..b1793d3`), not narrated.
- Every task's `<acceptance_criteria>` was re-run and passes: the unit tracer and the phase-8 shell guard, the e2e tracer, `pnpm run check`, `pnpm run lint`, and the full unit suite (137 files, 4,158 tests).

---
*Phase: 13-overview-personal-insights*
*Completed: 2026-10-23*
