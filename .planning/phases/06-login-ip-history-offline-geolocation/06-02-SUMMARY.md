---
phase: 06-login-ip-history-offline-geolocation
plan: 02
subsystem: ui
tags: [svelte, copy, i18n, a11y, tdd, intl]

# Dependency graph
requires:
  - phase: 04-activity-time-dashboards
    provides: formatNumber, setDefaultNumberLocale, the under-half-percent share rule, LOGIN_HISTORY_HEADING
  - phase: 05-vehicle-stats-financial-dashboards
    provides: VEHICLE_SCROLL_HINT (the reused table keyboard hint), the per-phase section-fence convention in ui-copy.ts
  - phase: 06-login-ip-history-offline-geolocation
    provides: 06-UI-SPEC Copywriting Contract and section 7; 06-01's `logins` worker channel
provides:
  - "The complete Phase 6 copy inventory as named exports in src/lib/ui-copy.ts: 70 constants and 19 formatters covering the login block, the IP table, the map, the country list and the city block"
  - "Both UI-SPEC review decisions as readable constants: CITY_CANCEL_LABEL ('Cancel download') and CITY_CANCELLED_TONE ('neutral')"
  - "One shared private percent helper (formatSharePercent) now behind both the Phase 4 duration rows and the Phase 6 login copy"
  - "tests/unit/shell/login-copy.test.ts — 150 tests pinning every Phase 6 string byte-for-byte and every section-7 formatting rule"
affects: [06-08, 06-10, 06-12, 06-13, tests/e2e/shell/dashboard.spec.ts]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 16924
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-phase section fence in ui-copy.ts: one banner comment per phase, constants first grouped by surface, then formatters, then private shared helpers"
    - "Every count in the app goes through formatNumber, and every share through one private formatSharePercent, so grouping and the `<1%` rule cannot drift between cards"
    - "Copy tests pin the STRING; component tests pin that the string is RENDERED for a dataset. A component test alone cannot catch a sentence reworded in both places"

key-files:
  created:
    - tests/unit/shell/login-copy.test.ts
  modified:
    - src/lib/ui-copy.ts
    - .planning/phases/06-login-ip-history-offline-geolocation/06-UI-SPEC.md

key-decisions:
  - "Decision 1 (checkpoint, option-b): the city download's Cancel button reads 'Cancel download', not the Copywriting Contract's 'Cancel'. The button exists only while a download is in progress, so a screen-reader user who tabs straight to it hears a bare verb. Recorded as 06-UI-SPEC Delta 11 and the contract's copy table, state matrix and section 5 were amended to agree, because a departure from a checked-in design document that is not written down is indistinguishable from a drift."
  - "Decision 2 (checkpoint, option-a): a cancelled city download shows a neutral-info line, not the destructive-chrome error D-14's literal wording asks for. Cancel is the user's own choice, so the destructive treatment is spent only on real failures. Everything D-14 protects still holds — nothing is kept, the country view is untouched, the outcome is visible text; only the chrome and the live-region behaviour differ. Already recorded as 06-UI-SPEC Delta 10."
  - "A megabyte is 1,000,000 bytes in every Phase 6 formatter, because the sizes measured in 06-RESEARCH are decimal. A 1,048,576-byte megabyte would round the shipped 11.85 MB city file to 11 and misstate what the user is about to download."
  - "formatCityProgress drops a trailing '.0' (5 MB, not 5.0 MB), matching the existing formatHoursParts rule, rather than always showing a decimal."
  - "formatCityReady validates the manifest month against ^\\d{4}-\\d{2}$ and falls back to CITY_READY_NO_MONTH, so a corrupt or hand-edited manifest.json can never become a DOM string."
  - "The whole under-half-percent rule moved into one private formatSharePercent, shared with formatDurationRowText, instead of being implemented a second time for Phase 6."

patterns-established:
  - "Pattern: a review decision that changes a contract's own text is recorded as a numbered Delta in the UI-SPEC AND the contract's tables are amended — never contradicted silently in code alone"
  - "Pattern: a plan's acceptance criterion that names a boundary example is pinned by TWO cases, one on each side of the boundary"

requirements-completed: []

coverage:
  - id: D1
    description: "The complete Phase 6 copy inventory (70 constants) exists once as named exports in src/lib/ui-copy.ts, byte-matching the 06-UI-SPEC Copywriting Contract"
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/shell/login-copy.test.ts#pinned copy constants"
        status: pass
      - kind: unit
        ref: "tests/unit/shell/login-copy.test.ts#no Phase 6 string contains an angle bracket"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 19 formatters and every rule of UI-SPEC section 7 (locale grouping, whole percent, YYYY-MM-DD dates, megabyte sizes, YYYY-MM month) exist and are pinned by table-driven tests"
    requirement: ACTIVITY-05
    verification:
      - kind: unit
        ref: "tests/unit/shell/login-copy.test.ts#Shares and counts / Dates / Games / Map sentences / City block"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both UI-SPEC review decisions are recorded as exports read by the city plans: CITY_CANCEL_LABEL and CITY_CANCELLED_TONE, each carrying the checkpoint outcome in its doc comment"
    requirement: ACTIVITY-07
    verification:
      - kind: unit
        ref: "tests/unit/shell/login-copy.test.ts#CITY_CANCEL_LABEL — 06-UI-SPEC Delta 11"
        status: pass
      - kind: unit
        ref: "tests/unit/shell/login-copy.test.ts#CITY_CANCELLED_TONE — 06-UI-SPEC Delta 10, the D-14 deviation"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 06-UI-SPEC contract was amended (Delta 11 plus the copy table, state matrix and section 5) so it and CITY_CANCEL_LABEL agree rather than contradicting each other in the repository"
    requirement: ACTIVITY-07
    verification:
      - kind: other
        ref: "06-UI-SPEC.md: Delta 11 in 'Deltas from Phase 5', and the three rows it amends"
        status: pass
    human_judgment: true
    rationale: "A design-contract amendment is a wording judgement for a human reviewer. The bytes are pinned by the unit test; whether Delta 11 is the RIGHT place and the RIGHT wording for the departure is not a machine-checkable claim, and the plan's two review decisions were themselves taken at a human checkpoint."

# Metrics
duration: 8min
completed: 2026-10-03
status: complete
---

# Phase 06 Plan 02: Login History Copy Inventory Summary

**Every Phase 6 string and formatter in one place — 70 constants and 19 formatters in `ui-copy.ts`, pinned by 150 tests, with both UI-SPEC review decisions shipped as readable constants**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-03T14:30:12Z
- **Completed:** 2026-10-03T14:37:52Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **The whole copy inventory, once.** Every row of the 06-UI-SPEC Copywriting Contract now exists as a named export: the four block states, the six reveal-control strings, the six tile labels, the multi-file note, the special values and their four hidden texts, the table copy and seven column headers, the map copy, the country list, and the city block. No component in plans 06-08, 06-10, 06-12 and 06-13 has to invent a sentence or edit the shared file.
- **19 formatters, one rule per share.** Counts go through the existing `formatNumber`; the under-half-percent rule moved into a single private `formatSharePercent` now shared with the Phase 4 duration rows, so a page can no longer show `0%` beside a non-zero count in one card and `<1%` in another.
- **Dates that cannot shift.** `formatLoginDate` is `civilFromDays(floor(seconds / 86400))` — no `Date` object anywhere on the path, so the same export shows the same day to a viewer in Kyiv and one in Lisbon (D-03). `formatLoginDateRange` returns `null` rather than a dash, leaving the dash to the component that owns it.
- **No untrusted text reaches a formatter.** No formatter accepts an IP address; `formatGameName` maps only the four known tokens and returns an unknown one unchanged, so an export naming a game this build has never heard of renders rather than raising (T-06-05).
- **Both review decisions shipped as code, not just prose.** `CITY_CANCEL_LABEL` and `CITY_CANCELLED_TONE` carry their outcomes, reasons and deviations in doc comments, and each is pinned by a test that also asserts it is NOT the contract's original value — so a later tidy back toward the contract text fails here rather than in a component.

## Task Commits

Each task was committed atomically:

1. **Task 1: Decision — the Cancel button label** - `0e38427` (docs)
2. **Task 2: Decision — the cancel presentation** - `61c7c12` (feat)
3. **Task 3: The copy inventory and its formatters** - `9440a1d` (feat)

_Task 3 followed RED → GREEN: the test file was written and run first (141 failed, 8 passed), then the implementation._

**Plan metadata:** the `docs(06-02): complete the Phase 6 copy inventory plan` commit (its own hash is necessarily not recorded here — a commit cannot contain its own)

## Files Created/Modified

- `src/lib/ui-copy.ts` — 76 new constants and 19 new formatters under a Phase 6 section fence; `formatDurationRowText` refactored onto the shared percent helper
- `tests/unit/shell/login-copy.test.ts` — new, 150 tests: every pinned string, both decision constants, and a table-driven test per formatter
- `.planning/phases/06-login-ip-history-offline-geolocation/06-UI-SPEC.md` — Delta 11 added; the Primary CTA row, the city `cancelled` state row, the section 5 button markup and the copy table's "City button and Cancel" row amended to `Cancel download`

## Decisions Made

**Decision 1 — the Cancel button reads `Cancel download` (checkpoint option-b).**
The contract originally said `Cancel`. The button is rendered only while a download is in progress, so a screen-reader user who tabs straight to it hears a bare verb with no object and no state. The progress line beside it names the object, but a button's label is read before the surrounding text is scanned, and the button is reachable on its own. The cost is three extra characters and a departure from a checked-in document, so the departure is recorded as **06-UI-SPEC Delta 11** and the contract's own copy table, state matrix and section 5 were amended to match. A contract departure that is not written down is indistinguishable from a drift, and the next reader of the contract would be reading a string this app never ships. Consequence: the e2e selector text is `Cancel download`.

**Decision 2 — cancel is a neutral info line, not an error (checkpoint option-a).**
Already recorded as **06-UI-SPEC Delta 10**. Cancel is the user's own choice, so it does not wear the destructive chrome or the `role="alert"`, and the destructive treatment is spent only on real failures. Nothing D-14 protects is weakened: nothing is kept (D-15), the country view is untouched, and the outcome is visible text either way. The sentence is `City-level download cancelled. Nothing was kept.` in both cases — only the chrome and the live-region behaviour differ. Plan 06-13's `CityOptIn.svelte` reads `CITY_CANCELLED_TONE` to choose between them.

**Megabytes are decimal (1,000,000 bytes) everywhere in Phase 6.** The sizes in 06-RESEARCH are decimal, and the shipped city file is 11,850,000 bytes. A 1,048,576-byte megabyte would round that to 11 and misstate what the user is about to download.

**`formatCityProgress` drops a trailing `.0`.** `5 of 12 MB`, not `5.0 of 12.0 MB` — the same choice `formatHoursParts` already makes, documented in the formatter.

**`formatCityReady` validates the manifest month** against `^\d{4}-\d{2}$` and falls back to `CITY_READY_NO_MONTH` rather than printing an unvalidated value. The month is a build artefact, not export data, but a hand-edited `manifest.json` must not become a DOM string.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Four formatter bodies disagreed with the contract the tests pin**
- **Found during:** Task 3, the first GREEN run
- **Issue:** My first implementation produced `1 IP address (1 login) is counted…` (the contract reads `1 more IP address (1 login) is counted…`), `with 4,000 logins of 4,200 logins` (the contract reads `with 4,000 of 4,200 logins`), `has no known country and are not on the map` (the singular needs `is` in the second clause too), and `and 2 cities not listed` (missing `more`).
- **Fix:** Corrected all four against the contract, and added the `1 more IP address` / `1 more city` singulars the plan's zero-one-many must-have requires.
- **Files modified:** `src/lib/ui-copy.ts`
- **Verification:** 150/150 in `tests/unit/shell/login-copy.test.ts`; `pnpm run test:unit` 1650/1650 across 52 files.
- **Committed in:** `9440a1d`

**2. [Rule 1 - Bug] The plan's own acceptance criterion sits on the wrong side of its boundary**
- **Found during:** Task 3, while pinning the share rule
- **Issue:** The acceptance criterion reads *"`formatLoginShareLine(1, 200)` equals the text for a share under half a percent (less than one percent)"*. But 1/200 is **exactly** 0.5%, and the 06-UI-SPEC rule is *a non-zero share **under** 0.5% reads `<1%`*. The two cannot both hold: 0.5 is not under 0.5, so the correct output is `1 login (1%)`. The plan's example was wrong, not its intent.
- **Fix:** Implemented the contract's rule (`< 0.5`, matching `formatDurationRowText` exactly, as the plan's must-have "the Phase 4 rule" requires) and pinned the boundary from BOTH sides: `(1, 201)` → `1 login (<1%)` and `(1, 200)` → `1 login (1%)`. A dedicated test names the boundary and states why a `<=` would flip the Phase 4 duration rows too.
- **Files modified:** `src/lib/ui-copy.ts`, `tests/unit/shell/login-copy.test.ts`
- **Verification:** `pnpm run test:unit` green in full.
- **Committed in:** `9440a1d`

**3. [Rule 2 - Missing Critical] `formatDurationRowText` kept its own copy of the percent rule**
- **Found during:** Task 3
- **Issue:** The plan requires the percent text to come from *one private helper shared with the existing less-than-one-percent rule*. `formatDurationRowText` still computed `share < 0.5 ? '<1' : …` inline, which is precisely the two-implementations-of-one-rule failure the helper exists to prevent.
- **Fix:** Extracted `formatSharePercent(part, total)` and pointed `formatDurationRowText` at it. Behaviour is identical for every input, including `sessions === 0` (both the old inline path and the helper return `0`).
- **Files modified:** `src/lib/ui-copy.ts`
- **Verification:** The unmodified `tests/unit/shell/ui-copy.test.ts` still passes (327 tests across the two copy files).
- **Committed in:** `9440a1d`

### Placement deviation

The plan's action text said to add the new exports "after the existing `LOGIN_HISTORY_HEADING`". They were added in a **Phase 6 section fence at the end of the file** instead, which is where the module's own convention puts a phase's strings (Phase 4 and Phase 5 each have one) and where `LOGIN_HISTORY_HEADING` itself already sits inside the Phase 4 fence. The requirement the plan states as the `must_have` — that the strings exist once as named exports and that `LOGIN_HISTORY_HEADING` is untouched — is met either way.

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical), plus 1 placement choice
**Impact on plan:** All three auto-fixes were correctness: two were contract mismatches the tests caught, one was the plan's own "one shared helper" requirement left half-done. No scope creep; the deviation ledger's two corrections tightened the work rather than enlarging it.

## Issues Encountered

- **A `Co-Authored-By` trailer slipped into the Task 1 commit**, against this repository's explicit no-attribution rule. Caught immediately after the commit and removed with `git commit --amend` before anything was pushed; the hash in this summary (`0e38427`) is the amended commit, and no other commit in the plan carries a trailer.
- **The broken-windows ledger is un-appendable.** `gsd-tools windows append` refuses to run against `.planning/WINDOWS.md` because the rendered markdown table and the fenced JSON disagree for rows 8 and 9 — a pre-existing Phase 5 corruption, unrelated to this plan and out of its scope. The tool forbids hand-editing the table, and repairing rows 8–9 would mean editing a Phase 5 artifact inside a Phase 6 plan. The deviation it would have recorded (item 2 above) is documented in full here instead, and the un-appendable ledger is raised as a blocker in STATE.md so it is not lost.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plans 06-08, 06-10, 06-12 and 06-13 read this file and do not edit it.** Every string and formatter they need is exported; the two decisions they needed are constants with their reasoning attached.
- **`06-13`'s `CityOptIn.svelte` has its two answers:** `CITY_CANCEL_LABEL` for the button, `CITY_CANCELLED_TONE` for the chrome and the `role="alert"`-versus-neutral-live-region choice.
- **The e2e selector text for the city Cancel button is `Cancel download`** — `tests/e2e/shell/dashboard.spec.ts` must match that, not `Cancel`.
- **`dashboard.spec.ts` line 871** still pins the page-wide `aria-live` count at 3; the login block's status region takes it to 4 (UI-SPEC Delta 7), and the component plans own that flip.
- **The `formatMapSummary` denominator is a contract, not a default.** `{t}` is ALL counted logins — the same denominator as the Top country tile — so the two percentages on screen agree. A caller passing a resolved-country total instead would make them disagree silently.

---
*Phase: 06-login-ip-history-offline-geolocation*
*Completed: 2026-10-03*
