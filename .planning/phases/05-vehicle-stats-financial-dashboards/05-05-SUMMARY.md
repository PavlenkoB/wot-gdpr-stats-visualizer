---
phase: 05-vehicle-stats-financial-dashboards
plan: 05
subsystem: data
tags: [csv, header-mapping, special-values, privacy-canary, map-grouping, battle-types, warplanes]

requires:
  - phase: 05-vehicle-stats-financial-dashboards
    provides: >-
      plan 05-02's real-header Player_statistics fixtures with their hand-derived
      answer key and the independent zero-import vehicle oracle, which every
      derived figure here is checked against.
  - phase: 04-activity-time-dashboards
    provides: >-
      `parseSessionTimestamp` (both export timestamp shapes, range-checked),
      reused for the last-battle and last-game cells rather than a third
      calendar parser.
  - phase: 02-defensive-parsing-pending-dataset
    provides: >-
      `parseCsvFile`, the reader every fixture below travels through unchanged.
provides:
  - >-
    src/lib/vehicle-shared.ts: the whole vehicle view contract in a ZERO-import
    module — four titles, the 200-character and 64-code clamps, the six special
    keys, a five-way cell union that makes every special a different KIND, and
    the nine view types.
  - >-
    src/lib/worker/vehicle-stats.ts: `VEHICLE_FILE_NAMES` (the sixteen
    lower-cased exact names the zip reader must fetch), `VehicleFileFacts`,
    `VehicleFiles` and `buildVehicleView` — pure, DOM-free, and reading only the
    columns it names.
  - >-
    The four titles' All and battle-type views, the derived win rate and average
    damage, the six special values, the battle-type filter and summary, the
    per-title header and the Warplanes 20 note — 35 new tests, 1036 in the suite.
affects: [05-07, 05-09, 05-12, 05-14, 05-16, vehicle-table]

actuals:
  tokens: 24645
  tasks: 3
  commits: 3
  plan_head_before: 77667032081309bd5b1ef7603c922820bae53d47
  plan_head_after: d4c8cb005517dd55260c32e940cfb9848a281af2

tech-stack:
  added: []
  patterns:
    - >-
      A cell is a discriminated union tagged with what it IS, not with its
      value: `N/D`, `N/A`, an absent column, a zero-denominator dash and a
      Warships per-type note are five cell kinds, so no arithmetic anywhere can
      accept one as a zero and the model and the table never have to guess.
    - >-
      One key listing per file, ever: the whole field set of a file is resolved
      in a single walk of the FIRST row's keys, and a Proxy canary asserts it —
      one listing for row 0, zero for every later row.
    - >-
      A field names the header SPELLINGS it accepts (its own title's first, the
      other titles' after it) and the match is on the key that appears first in
      the row, not the first spelling in the list — which is what keeps WoT's
      blank `FRAGS` column from winning over `FRAGS_COUNT`.
    - >-
      The view carries every column the FILE can show, core ones first and
      extras flagged `core: false`; which extras are drawn is the main thread's
      state, so the column picker has something to offer and the builder never
      decides what the user sees.
    - >-
      A requested battle-type code is applied only when the title's by_Type rows
      carry it, and the answer reports the APPLIED value — so a stale selection
      from another title degrades to All battles instead of to an empty table.

key-files:
  created:
    - src/lib/vehicle-shared.ts
    - src/lib/worker/vehicle-stats.ts
    - tests/unit/vehicle-stats.test.ts
  modified: []

key-decisions:
  - >-
    `not-in-export` means NO file of the title was in the zip, not that its main
    vehicle file was missing. A zip holding only `WOT_Account_Statistics.csv`
    really does contain WoT data, and calling the title absent would put "(not
    in this export)" beside a header the app does show. A title whose files
    parsed to no rows is `no-rows` and keeps its header (D-05).
  - >-
    The view's `columns` is the core six PLUS the extras this file can show,
    with the extras flagged `core: false`. This resolves a contradiction inside
    the plan against its own column-picker requirement; see Deviations 1.
  - >-
    `N/D` outranks a zero denominator in a derived cell, so the average damage
    of a never-flown Warplanes plane is `not defined` and not a dash — the
    export said the quantity does not exist, which outranks the fact that there
    was nothing to divide. The win rate and survival of the same plane are
    dashes, because their inputs ARE numbers.
  - >-
    `VEHICLE_FILE_NAMES` is built from the title file table rather than written
    out beside it, so the list the zip reader screens on and the table the
    builder resolves through cannot drift apart.
  - >-
    The Warplanes 20 account file is not read at all when the 19 one has a row.
    The fallback is a fallback, and the canary shows it as zero reads rather
    than as two.

patterns-established:
  - >-
    A hand answer key and the oracle spell the same four situations on purpose:
    the oracle says `'dash'` where the app says `'no-battles'` and draws an em
    dash with a visually hidden "no battles". The comparison goes through ONE
    translation helper on the test side, never by editing a fixture.
  - >-
    A date cell carries the text the export wrote AND the seconds it names, and
    the test computes those seconds with its own civil arithmetic rather than
    with the parser that produced them.
  - >-
    A canary is proved live before it is trusted: the same Proxy is pointed at
    the value it is meant to catch and turned red on purpose first.

requirements-completed: [STATS-01]

coverage:
  - id: D1
    description: >-
      The WoT All battles view travels from the real-header CSV text through
      `parseCsvFile` and `buildVehicleView` to the hand-derived answer: six rows
      in file order, the nation split, the derived win rate and average damage
      agreeing with `PLAYER_STATS_EXPECTED` and `oracleRatio` exactly, and the
      header's 162 reconciling with the rows' sum.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#05-05 tracer: WoT All battles view through the production parser'
        status: pass
    human_judgment: false
  - id: D2
    description: >-
      The per-title header reads the battle count and the premium expiry AS
      WRITTEN — the Unix epoch expiry and the Blitz `N/A` both shown, neither
      swallowed — and the account file's `NAME` is never read.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#reads the header as written and reconciles with the rows'
        status: pass
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#shows the account expiry as the export wrote it, and an N/A as not available'
        status: pass
    human_judgment: false
  - id: D3
    description: >-
      A numeric cell is a finite number; `N/D`, `N/A`, a blank, an unparseable
      cell and an absent column are four different specials, and a ratio over a
      zero denominator is a dash. None of them is ever 0 and none is summed.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#gives the zero-battle vehicle a dash, never a zero'
        status: pass
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#shows the named WOWP_19 planes with N/D damage that is never a zero'
        status: pass
    human_judgment: false
  - id: D4
    description: >-
      The battle-type filter offers only codes the by_Type rows carry, in
      numeric order, and agrees with `oracleBattleTypeCodes`; the summary lists
      every code of the Battle_Types file by battles descending with ties by
      code, and the two lists are allowed to disagree.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#lists only the codes the by_Type rows carry, in numeric order'
        status: pass
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#lists every code of the Battle_Types file, by battles descending then code'
        status: pass
    human_judgment: false
  - id: D5
    description: >-
      A requested code is applied only when the title has it; an absent or
      non-matching code comes back as the All-battles view with `battleType:
      null`, so a stale selection is never displayed as if the data supported it.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#applies null for a code this title does not have'
        status: pass
    human_judgment: false
  - id: D6
    description: >-
      The Warships All-battles view carries battles, last battle and in garage,
      its two computed columns are unsortable and fixed to the per-type note in
      every row, its nine battles are never recomputed from the 18 the by_Type
      rows add to, and choosing a code fills the same columns with real values.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#shows battles, last battle and in garage in All battles, and nothing summed'
        status: pass
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#fills the same columns in once a battle type is chosen'
        status: pass
    human_judgment: false
  - id: D7
    description: >-
      Blitz maps its own spellings of wins, frags and XP, dates its last-battle
      column as a date cell with wall-clock seconds, reads its garage flag as a
      boolean from both `1/0` and `T/F`, and takes its header battle figure from
      `BATTLES_COUNT` with an `N/A` expiry.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#offers the Blitz battle types and dates and booleans as their own cells'
        status: pass
    human_judgment: false
  - id: D8
    description: >-
      Warplanes shows the named `WOWP_19` planes, never a table for the 20 file,
      and reports the 20 file as four records and eight battles, never added to
      the title's own four; its header takes the battle figure from
      `GAMES_PLAYED` and falls back to the 20 file only when the 19 one has no
      row.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#reports the 20 file as a note, never a table'
        status: pass
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#takes the header battle figure from GAMES_PLAYED, then from the 20 file'
        status: pass
    human_judgment: false
  - id: D9
    description: >-
      Title selection and states: a null request picks the first title with
      vehicle rows else WoT, a title absent from the zip is `not-in-export` and
      one that parsed to nothing is `no-rows` with its header, and both answer
      with the view defaults, no rows, no codes and no summary.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#picks the first title with rows, and WoT when none has any'
        status: pass
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#gives an absent or empty title the view defaults and nothing else'
        status: pass
    human_judgment: false
  - id: D10
    description: >-
      The privacy canary: no account file's `NAME` is ever read, only the two
      resolved columns are, the first row of a file is listed at most once and
      no later row at all, and the nickname is absent from every serialised
      view of all four titles and every battle type. The instrument is proved
      live by reading the nickname on purpose first.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#reads only the two named columns of the account file, on every title'
        status: pass
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#proves the canary is live by reading the nickname on purpose'
        status: pass
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#keeps the nickname out of every serialised view of every title and code'
        status: pass
    human_judgment: false
  - id: D11
    description: >-
      Defensive parsing: a ragged later row, a padded lower-cased header, a
      missing wins column and a bare header file all degrade to a cell or a
      title state rather than to an error or a zero, and a core column whose
      header is absent stays listed as a column of "not in export" cells.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#05-05 defensive parsing over drifted headers'
        status: pass
    human_judgment: false
  - id: D12
    description: >-
      Hostile input: the markup-bearing id and `__proto__` come through as
      ordinary strings and add nothing to any prototype, a 500-character vehicle
      name is clamped to 200, a 500-character battle-type code to 64, and a
      request carrying the untruncated code is not applied.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#carries hostile ids through as ordinary strings and writes nothing to a prototype'
        status: pass
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#clamps a 500-character vehicle name to 200 characters'
        status: pass
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#clamps a 500-character battle-type code to 64 characters'
        status: pass
    human_judgment: false
  - id: D13
    description: >-
      Five thousand generated vehicles build inside a one-second ceiling and
      equal the oracle's row count, zero-battle count and largest battle count.
    requirement: STATS-01
    verification:
      - kind: unit
        ref: 'tests/unit/vehicle-stats.test.ts#builds five thousand vehicles inside a one-second ceiling'
        status: pass
    human_judgment: false
  - id: D14
    description: >-
      That the real export's four titles really carry these sixteen file names
      and these column spellings, and that a real `WOWP_19` damage cell really
      reads `N/D` on every row. Everything here encodes the researched evidence
      faithfully; the production-reader round trip already proves the fixtures'
      shape survives the parser, not that the shape is the export's.
    requirement: STATS-01
    verification: []
    human_judgment: true
    rationale: >-
      Only a human with a real export can confirm the physical shapes. The
      05-02 round-trip test proves the fixture's physical format survives
      `parseCsvFile` unchanged; it cannot prove that a 2021 sample is what a
      2026 export writes. RESEARCH A8 records the same assumption.

duration: 18min
completed: 2026-10-01
status: complete
---

# Phase 05 Plan 05: The vehicle view builder

**Every number a vehicle table draws, produced by one pure builder over the export's sixteen exact-named files — column maps per title, win rate and average damage computed here, six special values that are never a zero, and an account nickname that is never read. 35 new tests, 1036 in the suite**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-01T17:14:19Z
- **Completed:** 2026-10-01T17:32:33Z
- **Tasks:** 3
- **Files modified:** 3 (all created, 2,271 lines)

## Accomplishments

- **The WoT tracer runs on the real file shape.** The six hand rows travel as
  CSV text through `parseCsvFile` — quote-all cells, a bare CR on every line,
  mojibake already repaired — and come out as a view whose derived values equal
  `PLAYER_STATS_EXPECTED` and `oracleRatio` **exactly**, including the float
  artefact: 55 of 100 is `55.00000000000001`, not 55, and 3 of 7 is
  `42.857142857142854`. The header's 162 reconciles with the sum of the six
  rows without either being computed from the other.
- **`N/D` is a kind, not a value.** Five cell kinds, and no arithmetic in the
  file accepts a special: the Warplanes plane with four games shows a win rate
  of 50 and an average damage of `not defined`, because the export says the
  quantity does not exist — which outranks the fact that the denominator is
  there. The never-flown planes get dashes on the ratios whose inputs ARE
  numbers, and a `no-shots` dash of their own on the hit ratio.
- **The Warships All view cannot invent a figure.** Its two computed columns are
  declared per-type columns with `sortable: false`, so "every cell is the same
  note and neither header is a sort button" is structural rather than a promise.
  The test then checks the 9 real battles are not recomputed from the 18 the
  by_Type rows add to, and that the number 18 appears nowhere in the rows.
- **The nickname has no path to a view.** A Proxy per row records every value
  read and every key listing. The account files yield only the two resolved
  columns, the first row of a file is listed at most once and no later row at
  all, and the Warplanes 20 *fallback* account file is not read even once. The
  instrument is proved live first, by reading `NAME` on purpose.
- **Scale is measured, not asserted.** 5,000 generated vehicles build well
  inside a one-second ceiling (the file is parsed outside the timed region) and
  equal the oracle's row count, zero-battle count of 250 and largest battle
  count.

## Task Commits

Each task was committed atomically, with the RED and GREEN runs recorded below.

1. **Task 1 (tracer): the WoT All battles view end to end** — `fe1f0a2` (feat)
2. **Task 2: the four titles, the battle-type filter and the Warplanes note** — `6989f07` (feat)
3. **Task 3: the NAME canary, hostile ids and the scale ceiling** — `d4c8cb0` (feat)

### RED and GREEN evidence, as recorded

| Task | RED | GREEN |
|------|-----|-------|
| 1 | `Tests 8 failed (8)`, exit 1 — eight assertion failures against a stub module: `expected 'not-in-export' to be 'ready'`, `expected undefined to be 'china'`, `expected [] to deeply equal [ 'wot', 'wotb', 'wows', 'wowp' ]` and five more. No module-resolution crash, because the stub carries the final export names. | `Tests 8 passed (8)`, exit 0; `tsc -b` and `eslint` clean |
| 2 | `Tests 8 failed \| 16 passed (24)`, exit 1 — the battle-type lists, the summary, the applied code, the Warships All columns, the `N/D` damage cells and the 20-file note were all absent | `Tests 24 passed (24)`, exit 0; `tsc -b` and `eslint` clean |
| 3 | `Tests 1 failed \| 34 passed (35)`, exit 1 — the single failure was in the new test's own assertion form (see Deviation 5), not in the builder | `Tests 35 passed (35)`, exit 0; whole suite `1036 passed (1036)` |

Each task had one intermediate run between RED and GREEN with real derivation
findings; those are the four under Deviations.

## Files Created/Modified

- `src/lib/vehicle-shared.ts` — the vehicle view contract in a module with
  **zero imports**: four titles, the 200-character and 64-code clamps, the six
  special keys, the five-way cell union and the nine view types. Legal for the
  worker and the page to import because it depends on neither.
- `src/lib/worker/vehicle-stats.ts` — `VEHICLE_FILE_NAMES`, `VehicleFileFacts`,
  `VehicleFiles` and `buildVehicleView`, resolving every column by header name
  from the first row of a file and reading nothing it does not name.
- `tests/unit/vehicle-stats.test.ts` — 35 tests: the WoT tracer, the battle-type
  filter and summary, Blitz, Warships, Warplanes, the title states, the privacy
  canary, the defensive header shapes, the clamps and the scale ceiling.

## Decisions Made

- **`not-in-export` is about the TITLE, not about one file.** See Deviation 2.
- **The view carries the extras as well as the core.** See Deviation 1.
- **`N/D` outranks a zero denominator.** See Deviation 3.
- **A code is compared as a clamped string.** A request carrying the
  untruncated 500-character `TYPE` is not applied, because the filter's own
  option text is the clamped one and a selection made from anything else is not
  a selection this view can honour.
- **Dates carry both the text and the seconds.** The page sorts on the number
  and shows what the export wrote, and the test computes the seconds with its
  own civil arithmetic rather than with the parser under test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Plan contradiction] The view's `columns` carries the extras, not the core six alone**
- **Found during:** Task 1, GREEN
- **Issue:** the plan's Task 1 behaviour and its acceptance criterion say the
  WoT view returns "columns vehicle, battles, winRate, avgDamage, frags, xp in
  that order **all core**". Task 2's own action says "an extra is listed in the
  view's columns (**core false**) only when its source header resolved in the
  file". D-10 and UI-SPEC section 3 require a column picker with "one checkbox
  per extra field **available in the current view**" — which cannot be built
  from a view that lists only the six core, and which is also the only reason
  `VehicleColumn.core` would exist.
- **Fix:** the six core come first, in the stated order, all `core: true`; the
  extras this file can show follow with `core: false`, and the choice of which
  to draw is main-thread state. The acceptance criterion ("6 rows, columns in
  the stated order, header 162") still holds exactly.
- **Files modified:** `src/lib/worker/vehicle-stats.ts`,
  `tests/unit/vehicle-stats.test.ts`
- **Verification:** the WoT All view's core columns are asserted as the stated
  six in the stated order, and the extras as a `core: false` tail.
- **Committed in:** `fe1f0a2`
- **Flagged for:** 05-09 and 05-12, which own the "which extras are drawn"
  state and the picker.

**2. [Rule 1 — Plan contradiction] `not-in-export` means no file of the title, not a missing main file**
- **Found during:** Task 1, GREEN
- **Issue:** the plan's Task 1 behaviour says "a files map whose WoT **main
  file** is absent (seen false) gives titleState not-in-export". The must-have
  truth, Task 1's own action ("the title pick and title state **per the
  must_haves**"), Task 2's behaviour ("a title with **no seen file**") and
  UI-SPEC section 3 all define it as the title being absent from the export.
  A zip holding only `WOT_Account_Statistics.csv` really does contain WoT data:
  calling the title absent would put "(not in this export)" on the option
  beside a header the app is about to show.
- **Fix:** `present` means any of the title's files was in the zip (which is
  also what the plan's own `overview` action specifies). The test now covers
  all three cases separately: nothing of WoT → `not-in-export` with no header;
  the file present with no rows → `no-rows` with its header; and the title in
  the export with no vehicle file at all → `no-rows` with its header.
- **Files modified:** `tests/unit/vehicle-stats.test.ts`
- **Verification:** all three cases asserted; the overview's `present` is
  asserted true for all four titles over the sample.
- **Committed in:** `fe1f0a2`

**3. [Rule 1 — Wrong-data risk] A derived cell over `N/D` and zero is `not defined`, not a dash**
- **Found during:** Task 2, GREEN
- **Issue:** the plan's Task 2 behaviour reads "avg damage nd for plane two
  (damage is N/D), win rate 50.0 for plane two, **no-battles dashes for the
  zero-game planes**", which reads as though the dashes cover the average damage
  too. The independent oracle settles it and says so in its own comment: "Rule
  4 comes after them so that `N/D` over zero battles is 'nd', not 'dash'". The
  fixture's hand key and the must-have truth agree.
- **Fix:** the average damage of a never-flown plane is `not defined` (its
  input is `N/D`); its win rate and survival are `no-battles` dashes and its hit
  ratio a `no-shots` dash, because those inputs ARE numbers. The test says
  which is which and why.
- **Files modified:** `tests/unit/vehicle-stats.test.ts`
- **Verification:** all three planes' `avgDamage` and `maxDamage` are `nd`, and
  the two never-flown planes' `winRate`/`survival` are `no-battles`.
- **Committed in:** `6989f07`

**4. [Rule 1 — Missing critical] The Warplanes 20 plane file was missing from the title file table**
- **Found during:** Task 1, GREEN
- **Issue:** the plan's action says `VEHICLE_FILE_NAMES` is "the set of all
  sixteen" and names `wowp_20_plane_statistics.csv` among them, but a table that
  lists only a title's main, by_Type, battle-types and account files yields
  fifteen. The zip reader would then never fetch the 20 plane file, and D-09's
  note would have nothing to count.
- **Fix:** `TitleFiles` gained an `extras` list, holding the 20 plane file for
  Warplanes, and it counts towards both the sixteen and the title's `present`.
- **Files modified:** `src/lib/worker/vehicle-stats.ts`,
  `tests/unit/vehicle-stats.test.ts`
- **Verification:** `VEHICLE_FILE_NAMES.size` is 16 and the Fallout file is
  asserted absent, so the table is anchored and exact rather than a prefix.
- **Committed in:** `fe1f0a2`

### Planned deviations, made deliberately

**5. Task 1's GREEN ships all four title specs, so Task 2's RED failed on behaviour rather than on every title.**
The spec table is one data structure and splitting the Warplanes spec across two
tasks would be artificial. The tracer still builds from the four WoT files alone
at RED, which is exactly the slice the plan asked for, and Task 2's RED failed
8 of its 16 new tests — on the battle-type lists, the summary, the applied code,
the Warships All columns, the `N/D` cells and the 20-file note.

**6. Task 3's RED was `1 failed | 34 passed`, and the failure was in the test.**
The plan defers the hardening (clamping, the one-listing rule, `Map` grouping)
to Task 3 "because Tasks 1 and 2 did not harden them". They had: the must-haves
require the clamps and the one-listing rule in Task 1, so they were built
there. Task 3's RED therefore had almost nothing left to turn red, and its one
failure was the new test joining `[0, 0]` and expecting an empty string where
the two later rows had correctly listed nothing. This is recorded rather than
quietly re-run, because a RED that cannot fail is not evidence of anything.
The GREEN run additionally found that the plan's "the ownKeys trap fired for the
first row of the file **at most once**" is doing real work: the Warplanes 20
account file is listed **zero** times, because it is a fallback and the 19 file
supplied the header. The assertion was relaxed to "at most once" and the
zero-read case is now asserted explicitly.

**7. A hand key and the oracle spell the same four situations differently, and one helper translates.**
`PLAYER_STATS_EXPECTED` records `'dash'` where the app says `no-battles` (and
draws an em dash with a visually hidden "no battles" beside it, per UI-SPEC).
The comparison goes through one `oracleShape` helper on the test side rather
than by editing a fixture module this plan does not own.

---

**Total deviations:** 4 auto-fixed (all Rule 1 — each a real disagreement
inside the plan or a gap in its file table), 3 planned.
**Impact on plan:** all four auto-fixes were necessary for the plan's own
acceptance criteria or its stated file surface; none widened scope. Two of them
(Deviations 1 and 2) are contradictions inside the plan and are flagged for the
plans that consume the view.

## Issues Encountered

- **The plan's own numbers needed checking twice.** The WoT by_Type row under
  battle type 1 is 33 wins of 60 battles, not the 60 of 60 my first draft of the
  test comment claimed, and the app's `no-battles` is not the oracle's `'dash'`.
  Both were caught by the hand key and the oracle rather than by reading the
  fixture, which is the arrangement those two exist for.
- **The pre-existing locale failure is still the only one.**
  `tests/unit/ui-copy.test.ts:207` fails on this box because it is
  `uk_UA.UTF-8` and `formatImportSummary` groups with `toLocaleString()`.
  `LC_ALL=en_US.UTF-8 pnpm run test:unit` is green at 1036, and both that test
  and its module are untouched by this plan (`git diff` over both is empty).
  RESEARCH Pitfall 7 names this exact test and hands the fix to 05-08. Already
  logged in `deferred-items.md` and in `.planning/WINDOWS.md`; not re-logged
  here.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **05-07 (the worker round trip)** can call `buildVehicleView` directly with a
  `ReadonlyMap<string, { rows, seen }>` built from the rows it already reads,
  and can screen zip entries with `VEHICLE_FILE_NAMES` — sixteen anchored exact
  names, so `WOTB_`, `WOT_` and `WOT_Fallout_` cannot be conflated. The view
  reports the APPLIED title and battle type, so the client never has to decide
  whether a selection survived.
- **05-09 (the model)** owns which of the view's `core: false` columns are
  drawn; the builder deliberately never decides that, and the sort keys are
  already on the cells (`row.battles` for the default order, `k` on a date
  cell, a special that is never comparable to a number).
- **05-12 (the table)** has the six special keys to map to "not defined", "not
  available", "not in export", "—" and "available per battle type", and a
  `sortable: false` flag that is only ever set on the two Warships All columns.
- **Nothing is wired to the worker or the page yet**, as planned. No component,
  message type or Dexie schema was touched.

## Verification

```
$ pnpm exec vitest run tests/unit/vehicle-stats.test.ts
 Test Files  1 passed (1)
      Tests  35 passed (35)
exit 0                      (baseline was 0; 35 new)

$ LC_ALL=en_US.UTF-8 pnpm run test:unit
 Test Files  33 passed (33)
      Tests  1036 passed (1036)
exit 0                      (baseline was 1001 in 32 files; +35, no regression)

$ pnpm run check            # tsc -b
exit 0
$ pnpm run lint             # prettier --check . && eslint .
All matched files use Prettier code style!
exit 0
$ git diff --quiet -- package.json pnpm-lock.yaml
exit 0                      (T-05-SC: this plan installed no package)
```

Plan acceptance greps:

```
$ grep -c "^import" src/lib/vehicle-shared.ts                    -> 0
$ grep -c "localeCompare" src/lib/worker/vehicle-stats.ts        -> 0
$ grep -c "Object.entries\|for (const .* in " src/lib/worker/vehicle-stats.ts -> 0
$ grep -n "Object.keys" src/lib/worker/vehicle-stats.ts          -> 1 line, inside resolveFields
$ git status --short -- src tests                                 -> empty after the three commits
```

Not run: `pnpm exec playwright test`. This plan touches no component, no spec
and no message type; nothing on the page changed.

---
*Phase: 05-vehicle-stats-financial-dashboards*
*Plan: 05*
*Completed: 2026-10-01*

## Self-Check: PASSED

- All four `key-files.created` exist on disk (`ls` returns FOUND for each).
- All four commits exist in `git log`: `fe1f0a2`, `6989f07`, `d4c8cb0`
  (tasks) and `c17a886` (this metadata commit). The `actuals.commits` ledger
  reads **3** because the summary is written before its own commit lands;
  `git rev-list --count 7766703..HEAD` is 4 once it has.
- Every task's acceptance criteria re-run at close: the plan-level
  `<verification>` block exits 0, and each of the four grep criteria prints its
  expected count (0, 0, 0, and one `Object.keys` line inside
  `resolveFields`).
- `git status --short` is empty: nothing outside `files_modified` and this
  summary was touched. `STATE.md` and `ROADMAP.md` were deliberately not
  written — the orchestrator owns both after the wave merges.
