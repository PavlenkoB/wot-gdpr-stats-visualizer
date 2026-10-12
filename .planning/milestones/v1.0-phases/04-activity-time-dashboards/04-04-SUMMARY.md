---
phase: 04-activity-time-dashboards
plan: 04
subsystem: ui
tags: [copy-constants, number-formatting, wcag-contrast, css-custom-properties, rank-scale, vitest]

# Dependency graph
requires:
  - phase: 04-activity-time-dashboards (04-01)
    provides: "civilFromDays and weekdayOfDay in civil-date.ts, plus HOUR_GRID_BASIS / HourGridBasis / DURATION_BIN_COUNT / SplitColumn in playtime-shared.ts — the date arithmetic, the basis constant and the bin count this plan's formatters read"
  - phase: 04-activity-time-dashboards (04-02)
    provides: "the first six Phase 4 strings in ui-copy.ts (PLAYTIME_HEADING, PLAYTIME_LOADING, PLAYTIME_NO_SESSION_FILE, PLAYTIME_NO_USABLE_SESSIONS, PLAYTIME_ERROR, TILE_LABEL_SESSIONS) and the `playtimeCopy` namespace import in ui-copy.test.ts, both reused here"
  - phase: 04-activity-time-dashboards (04-05)
    provides: "hoursAttribute and the rank-scale vocabulary in playtime-model.ts — the hours rule this plan centralises, named where it was first used"
  - phase: 03-dashboard-shell-account-identity
    provides: "tests/helpers/contrast.ts (contrastRatio, relativeLuminance) and the W-03 precedent in contrast.test.ts — read-from-disk colour contract, both directions pinned"
provides:
  - "The one hours-formatting rule (formatHoursParts / formatHours), with the unit keyed on the rendered numeral so 3601 s reads `1 hour` (UI-SPEC Page Anatomy 4)"
  - "25 Phase 4 string constants and 24 formatters, all in src/lib/ui-copy.ts, each pinned by a unit test against a literal copied from a 04-UI-SPEC copy table"
  - "--ramp-0 to --ramp-5 in src/app.css: the six teal steps declared once, read by every future chart as var(--ramp-N)"
  - "A read-from-disk contrast suite that parses the ramp out of 04-UI-SPEC.md and the stylesheet, asserts they are equal, recomputes every recorded ratio, and asserts the monotonicity / 1.25:1 / 4.5:1 / 7:1 floors from the arithmetic"
  - "A tripwire that no component stylesheet restates a ramp step as literal hex, for 04-09 and 04-10"
affects: [04-08, 04-09, 04-10, 04-11, 04-12, ui-copy, data-ramp, calendar, hour-grid]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 15653
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parse the contract, don't repeat it: the ramp hexes are read out of 04-UI-SPEC.md and the other recorded ratios are recomputed, so a test can never assert a literal equals itself — the W-03 lesson generalised from one hover surface to a six-step ramp"
    - "Pin in three directions: spec-to-code equality, rationale-to-code (recompute the recorded number), and code-to-floor (assert the guarantee from the arithmetic), because each is satisfiable by a regression in another"
    - "Build date text from recorded parts, never from `Date`: the export's dates are the contract (D-01), and a `toLocaleDateString` re-dates them in the viewer's timezone"
    - "Key an empty state off the fact you actually hold: the calendar's tooltip keys off the session COUNT (a zero-length session is still a session, Pitfall 4), the hour grid keys off seconds because it stores no count"
    - "Make an 'impossible' UI state unrepresentable rather than conditional: formatExcludedPill returns '' for zero, so a caller cannot forget the `> 0` the UI-SPEC requires"

key-files:
  created: []
  modified:
    - src/lib/ui-copy.ts
    - src/app.css
    - tests/unit/ui-copy.test.ts
    - tests/unit/contrast.test.ts

key-decisions:
  - "No amendment to 04-UI-SPEC.md was needed, and that was itself checked rather than assumed: all twelve recorded ramp figures (six on-white, six step ratios) and all five recorded chrome-pair ratios were recomputed with tests/helpers/contrast.ts and match to the digit the table prints. The W-03 precedent required an amendment because its table was wrong; this table is right, so the plan's own acceptance criterion — assert the code ships what the spec declares, and that the pair clears the floor the rationale argues from — is the whole deliverable."
  - "formatNumber pins 'en-US' rather than the viewer's locale, because the UI-SPEC gives `1,204 hours` and `1,203 sessions` as literal expected text. A viewer in a comma-grouping locale would otherwise see the spec's own example render differently from the spec."
  - "The singular cases are separate functions, not a shared pluraliser. '1 session' and '1 active day' are different decisions, and a helper that handles one of them is a helper that gets the other wrong. The test asserts all five singulars from the UI Considerations table individually."
  - "The hour-grid start-basis caption is a CONSTANT, not a branch. HOUR_GRID_BASIS is `overlap` and this plan must not write it, so no code path can currently render the note — and a reader told the wrong attribution rule is worse off than one told nothing. The wording itself is planner-authored (the UI-SPEC gives the tooltip swap but no caption text) and is flagged below for the user's decision."
  - "formatCalendarLegendNote takes `number | null` rather than a number, because 'no boundary' and 'a boundary of 0' are different facts. A zero boundary would render 'Darkest: more than 0 hours', a sentence about nothing."
  - "The plan's literal grep acceptance criterion for Task 3 counts a pre-existing Phase 2 function and could not be satisfied as written. See Deviations."

patterns-established:
  - "One source per kind of constant, one test per source: copy in ui-copy.ts against UI-SPEC tables, colour in app.css against the UI-SPEC Color table, and both read back off disk by the test that owns them"
  - "Rule first, then boundaries: each formatter's doc-comment states the rule in the UI-SPEC's own words and the boundary cases that make it a rule (59 is the last `<1 min`, 359856 the last one-decimal value), so the next reader sees the decision rather than the arithmetic"

requirements-completed: [ACTIVITY-01, ACTIVITY-02, ACTIVITY-03, ACTIVITY-04]

coverage:
  - id: D1
    description: "A seconds value becomes the exact text a tile shows, through the one hours rule, with the unit decided by the rendered numeral."
    requirement: ACTIVITY-01
    verification:
      - kind: unit
        ref: "tests/unit/ui-copy.test.ts#formatHours (Phase 4, UI-SPEC Page Anatomy 4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every user-visible Phase 4 string exists once in ui-copy.ts with the UI-SPEC's exact wording, including the six 04-02 added, and every singular form is explicit."
    requirement: ACTIVITY-02
    verification:
      - kind: unit
        ref: "tests/unit/ui-copy.test.ts#Phase 4 static copy and count formatters"
        status: pass
      - kind: unit
        ref: "tests/unit/ui-copy.test.ts#04-02 tracer: Playtime state strings pinned to the UI-SPEC copy tables"
        status: pass
    human_judgment: false
  - id: D3
    description: "The teal ramp is declared once, equals the UI-SPEC table level for level, and its recorded ratios and structural floors are proven rather than asserted."
    requirement: ACTIVITY-03
    verification:
      - kind: unit
        ref: "tests/unit/contrast.test.ts#playtime data ramp (04-UI-SPEC Color)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Calendar and weekday-hour text is built from the export's recorded date parts and does not move with the process timezone; the hour-basis wording switches on the one constant."
    requirement: ACTIVITY-04
    verification:
      - kind: unit
        ref: "tests/unit/ui-copy.test.ts#Phase 4 date, tooltip and accessible-name formatters"
        status: pass
    human_judgment: false
  - id: D5
    description: "The start-basis caption wording (HOUR_GRID_START_BASIS_NOTE) is the one string in this plan with no UI-SPEC source. It is unreachable while HOUR_GRID_BASIS is `overlap`, but a human must confirm the wording before the basis is ever switched."
    requirement: ACTIVITY-04
    verification: []
    human_judgment: true
    rationale: "Planner-authored copy. The UI-SPEC specifies the start-basis TOOLTIP swap but gives no caption wording, and no test can say whether a sentence explains midnight-crossing attribution correctly to a reader. It needs a human to accept the wording, and the decision about WHICH basis ships is still open."

# Metrics
duration: 12min
completed: 2026-09-30
status: complete
---

# Phase 04 Plan 04: Centralise the Phase 4 strings, the hours rule and the data ramp

**Every Phase 4 string, the one hours-formatting rule and the six teal ramp steps now exist exactly once each, and the ramp's recorded contrast ratios were recomputed and are all correct — so the UI-SPEC needed no amendment, and that was proven rather than assumed.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-30T02:33:32+04:00
- **Completed:** 2026-09-30T02:45:00+04:00
- **Tasks:** 3
- **Files modified:** 4 (exactly the plan's `files_modified` list; nothing else was touched)

## Accomplishments

- **The plan's precedent turned out not to be needed, and the plan says so.** 04-04's instruction was to follow W-03: amend the UI-SPEC where a recorded number is wrong, then pin both directions. So the first thing checked was whether 04-UI-SPEC's Color table is wrong. All twelve ramp figures (six on-white, six step ratios) and all five chrome-pair ratios were recomputed with `tests/helpers/contrast.ts` and match to the digit the table prints. The table is right, so the amendment was not made and the deliverable is the assertion instead: `tests/unit/contrast.test.ts` now parses the ramp out of the spec, asserts `--ramp-0..5` in `app.css` equals it level for level, recomputes every recorded ratio from the shipped hex, and asserts the structural floors from the arithmetic so a *consistent* future amendment that breaks the guarantee still fails.
- **The tracer closes end to end.** A seconds value now becomes the exact text a tile shows: `formatHoursParts(3601)` returns `{ value: '1', unit: 'hour' }` because the unit keys on the rendered numeral, not the duration, and `formatHours(4332600)` is `'1,204 hours'`. The boundary table is 18 cases wide and includes the four the plan named.
- **The excluded pill cannot render "0 … excluded".** `formatExcludedPill(0)` returns the empty string, so the UI-SPEC's "only when > 0" is structural rather than a conditional a component author can forget — and the test asserts the empty string, not just the non-zero forms.
- **Dates cannot drift into the viewer's timezone.** `formatCalendarDate` is built from `civilFromDays`/`weekdayOfDay` (pure integer arithmetic, no `Date`), and a test sets `process.env.TZ` to UTC+14 and then UTC-8 and asserts the same day index formats identically. That is the property `CALENDAR_BASIS_CAPTION` promises in the UI.

## Task Commits

Each task was committed atomically, RED before GREEN:

1. **Task 1: Tracer, formatHours end to end and one ramp from the UI-SPEC table through app.css into the contrast tests** — `5d6f580` (test, RED) → `708c39c` (feat, GREEN)
2. **Task 2: Static strings and count-based formatters** — `f921131` (test, RED) → `9d85e45` (feat, GREEN)
3. **Task 3: Date, tooltip and accessible-name formatters built from recorded parts, and the hour-basis wording** — `b3ed1a1` (test, RED) → `d2afa7f` (feat, GREEN)

**RED evidence recorded per task:**

| Task | Command | Result |
|------|---------|--------|
| 1 | `vitest run tests/unit/ui-copy.test.ts -t formatHours` | 19 failed — `TypeError: formatHours is not a function` |
| 1 | `vitest run tests/unit/contrast.test.ts -t "playtime data ramp"` | 4 failed, 4 passed — `expected [] to deeply equal [ +0, 1, 2, 3, 4, 5 ]` (no `--ramp-N` in `app.css`) |
| 2 | `vitest run tests/unit/ui-copy.test.ts -t "Phase 4 static copy"` | 33 failed — `TypeError: <export> is not a function` |
| 3 | `vitest run tests/unit/ui-copy.test.ts -t "Phase 4 date"` | 12 failed — `TypeError: <export> is not a function` |

**Plan metadata:** this SUMMARY commit.

## The teal ramp, and what it measures

Declared once, in `src/app.css:16-27`:

| Level | Hex | Contrast on `#ffffff` (spec) | Recomputed | Ratio to previous step (spec) | Recomputed |
|-------|-----|------------------------------|------------|-------------------------------|------------|
| 0 | `#eef0f2` | 1.14 | 1.1424 | — | — |
| 1 | `#b2dcd4` | 1.49 | 1.4914 | 1.31 | 1.3055 |
| 2 | `#7cc7bc` | 1.95 | 1.9530 | 1.31 | 1.3096 |
| 3 | `#43a89c` | 2.87 | 2.8689 | 1.47 | 1.4691 |
| 4 | `#1f7a74` | 5.13 | 5.1291 | 1.79 | 1.7879 |
| 5 | `#0d4f4c` | 9.38 | 9.3756 | 1.83 | 1.8280 |

Luminance falls strictly monotonically (0.8691 → 0.0620). Every adjacent pair clears the 1.25:1 separation floor; level 4 clears 4.5:1 and level 5 clears 7:1 against white, as the UI-SPEC considerations row requires. The five recorded chrome pairs were also recomputed: white on `#3c4043` 10.47, `#8a5a00` on `#fef7e0` 5.53, `#8a1c17` on `#fce8e6` 7.89, `#5f6368` on `#f7f7fa` 5.66, `#1a73e8` on white 4.51.

## Files Created/Modified

- `src/lib/ui-copy.ts` — 25 new string constants and 24 new formatters (+598 lines). No file was created; the Phase 4 section that 04-02 opened now holds the whole phase's copy.
- `src/app.css` — `--ramp-0` to `--ramp-5` inside `:root`, beside `--nav-offset` (+18 lines).
- `tests/unit/ui-copy.test.ts` — three new describes: the hours boundary table, the static copy and count formatters, the date/tooltip/accessible-name formatters (+463 lines).
- `tests/unit/contrast.test.ts` — a new `playtime data ramp (04-UI-SPEC Color)` describe, plus a header note and two new disk reads (+190/-1).

## Preserved, not resolved

Carried forward untouched, and checked after the work:

- `HOUR_GRID_BASIS` in `src/lib/playtime-shared.ts:33` is still the single unresolved constant with value `'overlap'`. This plan only READS it. `git diff` over `playtime-shared.ts` is empty.
- The Sessions column names stay fixture-derived; 04-12 is the real-export check.
- 04-03's two frozen parse rejections are untouched (this plan does not read the parser).

## Decisions Made

- **No UI-SPEC amendment.** The W-03 precedent was followed in method — recompute the recorded numbers, then amend if wrong — and the recomputation found nothing wrong. Amending a correct contract would have been the deviation.
- **`formatNumber` pins `'en-US'`.** Not a cosmetic choice: the UI-SPEC names `1,204 hours` and `1,203 sessions` as literal expected text, so a viewer whose locale groups differently would see the spec's own example render differently from the spec.
- **The start-basis note is a constant, not a branch.** Nothing can render it while the basis is `overlap`, and that is the correct state: the decision is open, and the wording below needs a human before any basis switch.
- **`formatCalendarLegendNote(null)` is a distinct case from a zero boundary**, so the parameter is `number | null` rather than a number that could be 0.

## Deviations from Plan

### 1. One acceptance-criterion grep could not pass as written (Task 3)

- **Found during:** Task 3 acceptance criteria.
- **Issue:** the criterion is `grep -v '^\s*\(//\|\*\|/\*\)' src/lib/ui-copy.ts | grep -c "toLocaleDateString\|getDay()\|new Date"` printing `0`. It prints `1`, because the filter removes comment lines only and `formatImportedOn` at `src/lib/ui-copy.ts:119` is a Phase 2 function (D-10, commit `8375846`) that legitimately does `new Date(isoDate).toLocaleDateString('en-US', …)`.
- **Why not "fixed":** that function is outside this plan's `files_modified` list and is a deliberate Phase 2 decision for a *different* date (the import timestamp, which genuinely should render in the viewer's locale). Changing it would be an unrequested behaviour change to shipped work. The criterion's intent — that the Phase 4 calendar/hour-grid formatters never route through a locale-sensitive date API — is satisfied.
- **Evidence:** the same grep restricted to this plan's additions (`awk '/Phase 4 — number formatting/,0'`) prints `0`.
- **Resolution:** left as-is and reported here. If the criterion is meant to hold for the whole file, it needs Phase 2's decision revisited; that is a human call, not this plan's.

### 2. The plan's "amend the spec" instruction was conditional, and the condition was false

Not a deviation in outcome — recorded because the plan told this executor to do something and the honest result is that it was not needed. The full ramp and chrome-pair tables were recomputed and every figure matches. See Decisions Made.

---

**Total deviations:** 1 (a plan acceptance criterion that cannot be satisfied without an out-of-scope Phase 2 change)
**Impact on plan:** none on behaviour. The code is the plan's; only the wording of one check differs, and its intent is verified by a scoped equivalent.

## Issues Encountered

- **The externalised-read pattern in this session.** Several large file reads were archived rather than returned inline, so the ramp table, the copy tables and the role/workflow files were re-read in chunks before anything was written. No incorrect assumption resulted, but it is why the plan's copy tables were re-verified against the source rows immediately before the constants were typed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **04-08 through 04-10 can import copy and read `var(--ramp-N)` directly** and must not invent either. Every string in the UI-SPEC copy tables now has a named export.
- **For the human, one decision is still open:** `HOUR_GRID_BASIS` is `overlap`, and the planner-authored start-basis caption (`HOUR_GRID_START_BASIS_NOTE`: "Each session is counted in the weekday and hour it starts.") needs accepting before the basis is ever switched. Flagged as coverage D5.
- **Not a blocker, but worth knowing:** 04-05's report stands — `04-VALIDATION.md` names a `tests/unit/civil-date.test.ts` that does not exist, so a quick-validation command built from it filters to nothing. This plan did not create it (it is not in `files_modified`). Flagged for whoever owns the validation file.

---

*Phase: 04-activity-time-dashboards*
*Plan: 04*
*Completed: 2026-09-30*
